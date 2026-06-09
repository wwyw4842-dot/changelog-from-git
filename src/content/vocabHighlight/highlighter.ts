import { send } from "@shared/messaging";
import type { VocabularyEntry } from "@shared/types";

const HIGHLIGHT_CLASS = "polyglot-vocab-mark";
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "BUTTON",
  "CANVAS",
  "SVG",
  "IFRAME",
  "MARK",
]);
const PROCESSED_ATTR = "data-polyglot-highlighted";
const CSS_ID = "__polyglot_highlight_style__";
const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

interface HighlightState {
  enabled: boolean;
  words: string[];
  wordSet: Set<string>;
  translations: Map<string, string>;
  pattern: RegExp | null;
  observer: MutationObserver | null;
  tooltip: HTMLDivElement | null;
  boundHover: ((e: MouseEvent) => void) | null;
  boundLeave: ((e: MouseEvent) => void) | null;
}

const state: HighlightState = {
  enabled: false,
  words: [],
  wordSet: new Set(),
  translations: new Map(),
  pattern: null,
  observer: null,
  tooltip: null,
  boundHover: null,
  boundLeave: null,
};

const STYLE = `
.${HIGHLIGHT_CLASS} {
  background: linear-gradient(180deg, transparent 60%, rgba(96, 165, 250, 0.35) 60%);
  border-bottom: 1px dashed rgba(96, 165, 250, 0.85);
  cursor: help;
  padding-bottom: 1px;
  transition: background 120ms ease;
}
.${HIGHLIGHT_CLASS}:hover {
  background: linear-gradient(180deg, transparent 30%, rgba(96, 165, 250, 0.6) 30%);
}
.__polyglot_vocab_tooltip__ {
  position: fixed;
  z-index: 2147483646;
  max-width: 320px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.96);
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 12.5px;
  line-height: 1.55;
  pointer-events: none;
  border: 1px solid rgba(96, 165, 250, 0.35);
  box-shadow: 0 10px 30px -12px rgba(15, 23, 42, 0.5);
  white-space: pre-wrap;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 120ms ease, transform 120ms ease;
}
.__polyglot_vocab_tooltip__.visible {
  opacity: 1;
  transform: translateY(0);
}
`;

export async function enableVocabHighlight(): Promise<void> {
  if (state.enabled) return;
  state.enabled = true;

  injectStyle();
  await reloadVocab();
  if (!state.pattern) return;

  processNode(document.body);

  state.observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          processNode(node);
        } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
          processTextNode(node as Text);
        }
      });
    }
  });
  state.observer.observe(document.body, { childList: true, subtree: true });

  state.boundHover = onHover;
  state.boundLeave = onLeave;
  document.addEventListener("mouseover", state.boundHover, true);
  document.addEventListener("mouseout", state.boundLeave, true);
}

export function disableVocabHighlight(): void {
  if (!state.enabled) return;
  state.enabled = false;

  state.observer?.disconnect();
  state.observer = null;
  if (state.boundHover) document.removeEventListener("mouseover", state.boundHover, true);
  if (state.boundLeave) document.removeEventListener("mouseout", state.boundLeave, true);
  state.boundHover = null;
  state.boundLeave = null;

  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    parent.normalize();
  });
  document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach((el) => {
    el.removeAttribute(PROCESSED_ATTR);
  });
  state.tooltip?.remove();
  state.tooltip = null;
}

export async function refreshVocabHighlight(): Promise<void> {
  if (!state.enabled) return;
  // 简单策略：清一遍再重来，保证新加的词立刻生效。
  disableVocabHighlight();
  await enableVocabHighlight();
}

async function reloadVocab(): Promise<void> {
  try {
    const list = await send("vocabulary:list", { limit: 5000 });
    buildIndex(list);
  } catch (error) {
    console.warn("[polyglot] load vocab list failed", error);
  }
}

function buildIndex(list: VocabularyEntry[]): void {
  state.words = [];
  state.wordSet.clear();
  state.translations.clear();
  for (const item of list) {
    const word = (item.word || "").trim();
    if (!word) continue;
    const lower = word.toLowerCase();
    if (lower.length < 2) continue;
    if (state.wordSet.has(lower)) continue;
    state.wordSet.add(lower);
    state.words.push(word);
    state.translations.set(lower, item.translation || "");
  }
  if (state.words.length === 0) {
    state.pattern = null;
    return;
  }
  const englishWords: string[] = [];
  const cjkWords: string[] = [];
  for (const word of state.words) {
    if (isCjkWord(word)) cjkWords.push(word);
    else englishWords.push(word);
  }

  const parts: string[] = [];
  const escapedEnglish = sortLongestFirst(englishWords).map(escapeRegExp);
  if (escapedEnglish.length > 0) parts.push(`\\b(${escapedEnglish.join("|")})\\b`);

  const escapedCjk = sortLongestFirst(cjkWords).map(escapeRegExp);
  if (escapedCjk.length > 0) parts.push(`(${escapedCjk.join("|")})`);

  state.pattern = parts.length > 0 ? new RegExp(parts.join("|"), "giu") : null;
}

function isCjkWord(word: string): boolean {
  return CJK_PATTERN.test(word);
}

function sortLongestFirst(words: string[]): string[] {
  return [...words].sort((a, b) => b.length - a.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function injectStyle(): void {
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement("style");
  style.id = CSS_ID;
  style.textContent = STYLE;
  document.documentElement.appendChild(style);
}

function shouldSkipElement(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.classList.contains(HIGHLIGHT_CLASS)) return true;
  if (el.closest("[contenteditable='true'], [data-polyglot-translation-host]")) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.id === "__polyglot_host__") return true;
  return false;
}

function processNode(root: Node): void {
  if (!state.pattern) return;
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const element = root as Element;
  if (shouldSkipElement(element)) return;
  if (element.hasAttribute(PROCESSED_ATTR)) return;

  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
      const value = node.nodeValue;
      if (!value || !value.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const targets: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    targets.push(current as Text);
    current = walker.nextNode();
  }
  for (const textNode of targets) {
    processTextNode(textNode);
  }
  element.setAttribute(PROCESSED_ATTR, "1");
}

function processTextNode(textNode: Text): void {
  if (!state.pattern) return;
  const parent = textNode.parentElement;
  if (!parent || shouldSkipElement(parent)) return;
  const value = textNode.nodeValue || "";
  if (!value) return;

  state.pattern.lastIndex = 0;
  if (!state.pattern.test(value)) return;

  state.pattern.lastIndex = 0;
  const fragments: (string | HTMLElement)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = state.pattern.exec(value)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (start > lastIndex) fragments.push(value.slice(lastIndex, start));
    const mark = document.createElement("mark");
    mark.className = HIGHLIGHT_CLASS;
    mark.textContent = match[0];
    mark.dataset.vocabWord = match[0];
    mark.dataset.vocabKey = match[0].toLowerCase();
    fragments.push(mark);
    lastIndex = end;
  }
  if (fragments.length === 0) return;
  if (lastIndex < value.length) fragments.push(value.slice(lastIndex));

  const frag = document.createDocumentFragment();
  for (const piece of fragments) {
    if (typeof piece === "string") frag.appendChild(document.createTextNode(piece));
    else frag.appendChild(piece);
  }
  parent.replaceChild(frag, textNode);
}

function onHover(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target || !target.classList?.contains(HIGHLIGHT_CLASS)) return;
  const key = target.dataset.vocabKey || "";
  const translation = state.translations.get(key);
  if (!translation) return;
  showTooltip(target, translation);
}

function onLeave(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target || !target.classList?.contains(HIGHLIGHT_CLASS)) return;
  hideTooltip();
}

function ensureTooltip(): HTMLDivElement {
  if (state.tooltip) return state.tooltip;
  const tooltip = document.createElement("div");
  tooltip.className = "__polyglot_vocab_tooltip__";
  document.documentElement.appendChild(tooltip);
  state.tooltip = tooltip;
  return tooltip;
}

function showTooltip(anchor: HTMLElement, text: string): void {
  const tooltip = ensureTooltip();
  tooltip.textContent = text;
  const rect = anchor.getBoundingClientRect();
  const margin = 10;
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";
  tooltip.classList.add("visible");
  requestAnimationFrame(() => {
    const tipRect = tooltip.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - tipRect.width - margin);
    }
    if (top + tipRect.height > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - tipRect.height - margin);
    }
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  });
}

function hideTooltip(): void {
  state.tooltip?.classList.remove("visible");
}
