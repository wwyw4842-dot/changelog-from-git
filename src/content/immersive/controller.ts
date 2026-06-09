import { send } from "@shared/messaging";
import type { Settings } from "@shared/types";
import { collectBlocks, markTranslationHost, clearImmersive, type ImmersiveBlock } from "./scanner";

const BATCH_SIZE = 6;
const OBSERVER_ROOT_MARGIN = "600px";

interface ImmersiveState {
  enabled: boolean;
  observer: IntersectionObserver | null;
  settings: Settings | null;
  translationCache: Map<HTMLElement, HTMLElement>;
  inflight: Set<HTMLElement>;
}

const state: ImmersiveState = {
  enabled: false,
  observer: null,
  settings: null,
  translationCache: new Map(),
  inflight: new Set(),
};

let toolbar: HTMLDivElement | null = null;

export async function enableImmersive(settings: Settings): Promise<void> {
  if (state.enabled) return;
  state.enabled = true;
  state.settings = settings;

  const blocks = collectBlocks();
  if (!blocks.length) {
    state.enabled = false;
    return;
  }

  state.observer = new IntersectionObserver(onIntersection, {
    rootMargin: OBSERVER_ROOT_MARGIN,
  });

  blocks.forEach((block) => {
    block.node.setAttribute("data-polyglot-original", "1");
    state.observer!.observe(block.node);
  });

  showToolbar(blocks.length);
}

export function disableImmersive(): void {
  if (!state.enabled) return;
  state.enabled = false;
  state.observer?.disconnect();
  state.observer = null;
  clearImmersive();
  state.translationCache.clear();
  state.inflight.clear();
  toolbar?.remove();
  toolbar = null;
}

export function isImmersiveActive(): boolean {
  return state.enabled;
}

function onIntersection(entries: IntersectionObserverEntry[]): void {
  const pending: ImmersiveBlock[] = [];
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const node = entry.target as HTMLElement;
    if (state.translationCache.has(node) || state.inflight.has(node)) continue;
    const text = (node.innerText || node.textContent || "").trim().replace(/\s+/g, " ");
    if (text) pending.push({ node, text });
  }
  if (!pending.length) return;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    void translateBatch(batch);
  }
}

async function translateBatch(batch: ImmersiveBlock[]): Promise<void> {
  if (!state.settings) return;
  const settings = state.settings;
  const targetLang = settings.targetLang || "zh-CN";
  const providerId = settings.immersiveDefaultEngine || settings.primaryProvider;

  await Promise.all(
    batch.map(async (block) => {
      state.inflight.add(block.node);
      try {
        const result = await send("translate:request", {
          text: block.text,
          from: "auto",
          to: targetLang,
          mode: "quick",
          providerId,
        });
        if (!state.enabled) return;
        renderTranslation(block.node, result.translatedText);
      } catch (error) {
        if (!state.enabled) return;
        renderTranslation(block.node, `[翻译失败: ${(error as Error).message}]`, true);
      } finally {
        state.inflight.delete(block.node);
      }
    })
  );
}

function renderTranslation(
  node: HTMLElement,
  translatedText: string,
  isError = false
): void {
  if (state.translationCache.has(node)) {
    const existing = state.translationCache.get(node);
    if (existing) existing.textContent = translatedText;
    return;
  }
  const host = document.createElement("div");
  host.style.cssText = [
    "margin: 6px 0 12px",
    "padding: 8px 10px",
    `border-left: 3px solid rgba(96,165,250,${isError ? "0.35" : "0.85"})`,
    "background: rgba(96,165,250,0.06)",
    "border-radius: 0 8px 8px 0",
    "line-height: 1.65",
    "color: inherit",
    "font-family: inherit",
    "font-size: 0.95em",
    "white-space: pre-wrap",
    "word-break: break-word",
  ].join(";");
  markTranslationHost(host);

  const content = document.createElement("span");
  content.textContent = translatedText;
  host.append(content);

  node.after(host);
  state.translationCache.set(node, host);
}

function showToolbar(total: number): void {
  toolbar?.remove();
  toolbar = document.createElement("div");
  toolbar.className = "polyglot-immersive-ignore";
  toolbar.style.cssText = [
    "position: fixed",
    "right: 16px",
    "bottom: 16px",
    "z-index: 2147483646",
    "display: flex",
    "gap: 8px",
    "padding: 8px 12px",
    "background: rgba(15,23,42,0.92)",
    "color: #e2e8f0",
    "font-size: 12px",
    "border-radius: 999px",
    "border: 1px solid rgba(96,165,250,0.35)",
    "box-shadow: 0 10px 30px -12px rgba(15,23,42,0.5)",
    "backdrop-filter: blur(6px)",
    "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  ].join(";");

  const info = document.createElement("span");
  info.textContent = `沉浸式 · 共 ${total} 段`;
  info.style.opacity = "0.75";
  const close = document.createElement("button");
  close.textContent = "退出";
  close.style.cssText =
    "background: transparent; border: 0; color: inherit; cursor: pointer; font: inherit; opacity: 0.8;";
  close.addEventListener("click", () => disableImmersive());

  toolbar.append(info, close);
  document.documentElement.appendChild(toolbar);
}
