import { mapChromeRuntimeError } from "@shared/chrome-runtime-error";
import type { Settings, TranslationRequest } from "@shared/types";

interface InputState {
  enabled: boolean;
  settings: Settings | null;
  targetElement: HTMLElement | null;
  toolbar: HTMLDivElement | null;
  activePort: chrome.runtime.Port | null;
  originalText: string;
  toolbarExpanded: boolean;
  undoText: string | null;
  undoTimer: number | null;
  rafReposition: number | null;
  repositionBound: (() => void) | null;
  observer: IntersectionObserver | null;
  targetVisible: boolean;
}

const state: InputState = {
  enabled: false,
  settings: null,
  targetElement: null,
  toolbar: null,
  activePort: null,
  originalText: "",
  toolbarExpanded: false,
  undoText: null,
  undoTimer: null,
  rafReposition: null,
  repositionBound: null,
  observer: null,
  targetVisible: true,
};

const ACTIONS: Array<{ id: string; label: string; prompt: string }> = [
  { id: "polish", label: "润色", prompt: "Polish the following text to be more natural and fluent while preserving its meaning. Return ONLY the polished text." },
  { id: "grammar", label: "纠错", prompt: "Fix grammar, spelling and punctuation in the following text. Return ONLY the corrected text." },
  { id: "translate-en", label: "→ EN", prompt: "Translate the following text to natural idiomatic English. Return ONLY the translation." },
  { id: "translate-zh", label: "→ 中文", prompt: "把下面文本翻译成地道的简体中文。只返回译文。" },
  { id: "expand", label: "扩写", prompt: "Expand the following text by adding more detail and examples while keeping the original language and tone." },
  { id: "shorten", label: "精简", prompt: "Rewrite the following text in fewer words, keeping the original language and essential meaning." },
];

export function enableInputEnhance(settings: Settings): void {
  if (state.enabled) return;
  state.enabled = true;
  state.settings = settings;
  state.repositionBound = requestReposition;
  document.addEventListener("focusin", onFocusIn, true);
  document.addEventListener("focusout", onFocusOut, true);
}

export function disableInputEnhance(): void {
  if (!state.enabled) return;
  state.enabled = false;
  document.removeEventListener("focusin", onFocusIn, true);
  document.removeEventListener("focusout", onFocusOut, true);
  detachRepositionListeners();
  detachVisibilityObserver();
  clearUndo();
  removeToolbar();
  state.targetElement = null;
  state.toolbarExpanded = false;
  state.activePort?.disconnect();
  state.activePort = null;
}

function isEditable(element: EventTarget | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  if (element instanceof HTMLInputElement) {
    return ["text", "search", "email", "url"].includes(element.type);
  }
  if (element instanceof HTMLTextAreaElement) return true;
  return element.isContentEditable;
}

function onFocusIn(event: FocusEvent): void {
  if (!isEditable(event.target)) return;
  state.targetElement = event.target as HTMLElement;
  state.toolbarExpanded = false;
  state.targetVisible = true;
  showToolbar(false);
  attachRepositionListeners();
  attachVisibilityObserver(state.targetElement);
}

function onFocusOut(event: FocusEvent): void {
  const related = event.relatedTarget;
  if (related instanceof HTMLElement && state.toolbar?.contains(related)) return;
  setTimeout(() => {
    if (!document.activeElement || !isEditable(document.activeElement)) {
      removeToolbar();
      detachRepositionListeners();
      detachVisibilityObserver();
      state.toolbarExpanded = false;
      state.targetElement = null;
    }
  }, 120);
}

function baseToolbarStyles(rect: DOMRect): string {
  const top = Math.max(8, rect.bottom + window.scrollY + 6);
  const left = Math.max(8, rect.left + window.scrollX);
  return [
    "position: absolute",
    `top: ${top}px`,
    `left: ${left}px`,
    "z-index: 2147483646",
    "display: flex",
    "flex-wrap: wrap",
    "align-items: center",
    "gap: 6px",
    "padding: 6px 8px",
    "background: rgba(15,23,42,0.96)",
    "border: 1px solid rgba(96,165,250,0.3)",
    "border-radius: 999px",
    "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "font-size: 12px",
    "color: #e2e8f0",
    "box-shadow: 0 10px 30px -12px rgba(15,23,42,0.5)",
    "backdrop-filter: blur(6px)",
  ].join(";");
}

function attachActionButtons(container: HTMLElement): void {
  ACTIONS.forEach((action) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = action.label;
    btn.style.cssText =
      "background: transparent; border: 0; color: inherit; cursor: pointer; font: inherit; padding: 3px 8px; border-radius: 999px;";
    btn.addEventListener("mouseenter", () => (btn.style.background = "rgba(96,165,250,0.15)"));
    btn.addEventListener("mouseleave", () => (btn.style.background = "transparent"));
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", () => void runAction(action.prompt));
    container.appendChild(btn);
  });
}

function attachUndoButton(container: HTMLElement): void {
  if (!state.undoText) return;
  const undo = document.createElement("button");
  undo.type = "button";
  undo.textContent = "撤销";
  undo.title = "恢复到改写前文本（5 秒内有效）";
  undo.style.cssText =
    "background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.35); color: #fecaca; cursor: pointer; font: inherit; padding: 3px 8px; border-radius: 999px;";
  undo.addEventListener("mousedown", (e) => e.preventDefault());
  undo.addEventListener("click", () => {
    if (!state.targetElement || !state.undoText) return;
    replaceText(state.targetElement, state.undoText);
    clearUndo();
    showToolbar(false);
  });
  container.appendChild(undo);
}

/** @param forceExpanded 为 true 时忽略「自动折叠」设置（例如用户点击了小入口后） */
function showToolbar(forceExpanded: boolean): void {
  if (!state.targetElement || !state.settings) return;
  removeToolbar();
  const toolbar = document.createElement("div");
  toolbar.className = "polyglot-immersive-ignore";
  toolbar.setAttribute("data-polyglot-input-toolbar", "true");
  const rect = state.targetElement.getBoundingClientRect();
  toolbar.style.cssText = baseToolbarStyles(rect);

  const autoExpand = Boolean(state.settings.inputEnhanceAutoExpandToolbar);
  const expanded = forceExpanded || autoExpand || state.toolbarExpanded;
  if (expanded) {
    attachActionButtons(toolbar);
    attachUndoButton(toolbar);
    state.toolbarExpanded = true;
    if (!autoExpand) {
      const collapse = document.createElement("button");
      collapse.type = "button";
      collapse.textContent = "收起";
      collapse.title = "收起到小按钮";
      collapse.style.cssText =
        "background: transparent; border: 0; color: rgba(148,163,184,0.95); cursor: pointer; font: inherit; padding: 3px 8px; border-radius: 999px; font-size: 11px;";
      collapse.addEventListener("mousedown", (e) => e.preventDefault());
      collapse.addEventListener("click", () => {
        state.toolbarExpanded = false;
        showToolbar(false);
      });
      toolbar.appendChild(collapse);
    }
  } else {
    state.toolbarExpanded = false;
    const expand = document.createElement("button");
    expand.type = "button";
    expand.setAttribute("aria-expanded", "false");
    expand.title = "展开润色、纠错、翻译等快捷操作";
    expand.textContent = "✨ 快捷";
    expand.style.cssText =
      "background: transparent; border: 0; color: inherit; cursor: pointer; font: inherit; padding: 3px 10px; border-radius: 999px;";
    expand.addEventListener("mouseenter", () => (expand.style.background = "rgba(96,165,250,0.15)"));
    expand.addEventListener("mouseleave", () => (expand.style.background = "transparent"));
    expand.addEventListener("mousedown", (e) => e.preventDefault());
    expand.addEventListener("click", () => {
      state.toolbarExpanded = true;
      showToolbar(false);
    });
    toolbar.appendChild(expand);
  }

  document.body.appendChild(toolbar);
  state.toolbar = toolbar;
}

/** 设置变更时同步（例如切换「自动展开」） */
export function updateInputEnhanceSettings(next: Settings): void {
  if (!state.enabled) return;
  state.settings = next;
  if (state.targetElement && document.activeElement === state.targetElement) {
    showToolbar(false);
  }
}

function removeToolbar(): void {
  state.toolbar?.remove();
  state.toolbar = null;
}

function clearUndo(): void {
  if (state.undoTimer) {
    window.clearTimeout(state.undoTimer);
    state.undoTimer = null;
  }
  state.undoText = null;
}

function setUndo(text: string): void {
  clearUndo();
  state.undoText = text;
  state.undoTimer = window.setTimeout(() => {
    clearUndo();
    if (state.toolbar) showToolbar(false);
  }, 5000);
}

function isElementInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
}

function requestReposition(): void {
  if (state.rafReposition) return;
  state.rafReposition = window.requestAnimationFrame(() => {
    state.rafReposition = null;
    repositionToolbar();
  });
}

function repositionToolbar(): void {
  if (!state.toolbar || !state.targetElement) return;
  if (!state.targetVisible || !isElementInViewport(state.targetElement)) {
    state.toolbar.style.display = "none";
    return;
  }
  state.toolbar.style.display = "flex";
  const rect = state.targetElement.getBoundingClientRect();
  const top = Math.max(8, rect.bottom + window.scrollY + 6);
  const left = Math.max(8, rect.left + window.scrollX);
  state.toolbar.style.top = `${top}px`;
  state.toolbar.style.left = `${left}px`;
}

function attachVisibilityObserver(target: HTMLElement): void {
  detachVisibilityObserver();
  if (typeof IntersectionObserver === "undefined") return;
  state.observer = new IntersectionObserver(
    (entries) => {
      const first = entries[0];
      state.targetVisible = Boolean(first?.isIntersecting);
      requestReposition();
    },
    { threshold: 0.01 }
  );
  state.observer.observe(target);
}

function detachVisibilityObserver(): void {
  state.observer?.disconnect();
  state.observer = null;
  state.targetVisible = true;
}

function attachRepositionListeners(): void {
  if (!state.repositionBound) return;
  window.addEventListener("scroll", state.repositionBound, true);
  window.addEventListener("resize", state.repositionBound);
}

function detachRepositionListeners(): void {
  if (!state.repositionBound) return;
  window.removeEventListener("scroll", state.repositionBound, true);
  window.removeEventListener("resize", state.repositionBound);
  if (state.rafReposition) {
    window.cancelAnimationFrame(state.rafReposition);
    state.rafReposition = null;
  }
}

async function runAction(prompt: string): Promise<void> {
  if (!state.targetElement || !state.settings) return;
  const current = getText(state.targetElement);
  if (!current.trim()) return;
  state.originalText = current;

  state.activePort?.disconnect();

  let port: chrome.runtime.Port;
  try {
    port = chrome.runtime.connect({ name: "polyglot-stream" });
  } catch (error) {
    console.warn("[polyglot] input enhance connect failed", mapChromeRuntimeError(error));
    return;
  }
  state.activePort = port;
  let accumulated = "";
  let finished = false;

  port.onMessage.addListener((message: { type: string; payload?: unknown }) => {
    if (message.type === "chunk") {
      const chunk = message.payload as { translatedText?: string };
      if (chunk.translatedText) {
        accumulated = chunk.translatedText;
        replaceText(state.targetElement!, accumulated);
      }
    } else if (message.type === "done") {
      finished = true;
      const result = message.payload as { translatedText?: string };
      if (result?.translatedText) {
        replaceText(state.targetElement!, result.translatedText);
        setUndo(state.originalText);
        state.toolbarExpanded = true;
        showToolbar(false);
      }
    } else if (message.type === "error") {
      finished = true;
      replaceText(state.targetElement!, state.originalText);
    }
  });
  port.onDisconnect.addListener(() => {
    if (state.activePort === port) state.activePort = null;
    if (!finished && state.targetElement) {
      replaceText(state.targetElement, state.originalText);
    }
  });

  const payload: TranslationRequest = {
    text: `${prompt}\n\n${current}`,
    from: "auto",
    to: "auto",
    mode: "quick",
    providerId: state.settings.deepProvider,
  };
  try {
    port.postMessage({ type: "translate:stream", payload });
  } catch (error) {
    finished = true;
    console.warn("[polyglot] input enhance post failed", mapChromeRuntimeError(error));
    replaceText(state.targetElement, state.originalText);
  }
}

function getText(element: HTMLElement): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }
  return element.innerText;
}

function replaceText(element: HTMLElement, text: string): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  if (element.isContentEditable) {
    element.textContent = text;
    element.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
  }
}
