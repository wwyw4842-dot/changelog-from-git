import { send } from "@shared/messaging";
import type { Settings } from "@shared/types";
import { createLimiter, type Limiter } from "@shared/concurrency";
import { collectBlocks, markTranslationHost, clearImmersive, type ImmersiveBlock } from "./scanner";

// 同时在途的翻译请求上限。对速率限制严格的 LLM 提供商保持较小并发，
// 避免一次性发起多路流式请求触发 429 / 连接重置。
const MAX_CONCURRENCY = 3;
const OBSERVER_ROOT_MARGIN = "600px";
// DOM 变更后合并扫描的防抖窗口，避免 SPA 频繁渲染导致的高频重扫。
const RESCAN_DEBOUNCE_MS = 400;

interface ImmersiveState {
  enabled: boolean;
  observer: IntersectionObserver | null;
  mutationObserver: MutationObserver | null;
  rescanTimer: ReturnType<typeof setTimeout> | null;
  settings: Settings | null;
  limiter: Limiter | null;
  observed: WeakSet<HTMLElement>;
  translationCache: Map<HTMLElement, HTMLElement>;
  inflight: Set<HTMLElement>;
  total: number;
}

const state: ImmersiveState = {
  enabled: false,
  observer: null,
  mutationObserver: null,
  rescanTimer: null,
  settings: null,
  limiter: null,
  observed: new WeakSet(),
  translationCache: new Map(),
  inflight: new Set(),
  total: 0,
};

let toolbar: HTMLDivElement | null = null;

export async function enableImmersive(settings: Settings): Promise<void> {
  if (state.enabled) return;
  state.enabled = true;
  state.settings = settings;
  state.limiter = createLimiter(MAX_CONCURRENCY);

  state.observer = new IntersectionObserver(onIntersection, {
    rootMargin: OBSERVER_ROOT_MARGIN,
  });

  const found = observeNewBlocks(collectBlocks());
  if (!found) {
    disableImmersive();
    return;
  }

  // 持续监听 DOM 变更，捕获 SPA / 无限滚动（Twitter、Reddit 等）动态插入的内容。
  state.mutationObserver = new MutationObserver(scheduleRescan);
  state.mutationObserver.observe(document.body, { childList: true, subtree: true });

  showToolbar(state.total);
}

export function disableImmersive(): void {
  if (!state.enabled) return;
  state.enabled = false;
  state.observer?.disconnect();
  state.observer = null;
  state.mutationObserver?.disconnect();
  state.mutationObserver = null;
  if (state.rescanTimer) {
    clearTimeout(state.rescanTimer);
    state.rescanTimer = null;
  }
  state.limiter = null;
  state.observed = new WeakSet();
  clearImmersive();
  state.translationCache.clear();
  state.inflight.clear();
  state.total = 0;
  toolbar?.remove();
  toolbar = null;
}

export function isImmersiveActive(): boolean {
  return state.enabled;
}

// 将尚未跟踪的块挂到 IntersectionObserver 上，返回本次新增数量。
function observeNewBlocks(blocks: ImmersiveBlock[]): number {
  if (!state.observer) return 0;
  let added = 0;
  for (const block of blocks) {
    if (state.observed.has(block.node)) continue;
    if (state.translationCache.has(block.node) || state.inflight.has(block.node)) continue;
    state.observed.add(block.node);
    block.node.setAttribute("data-polyglot-original", "1");
    state.observer.observe(block.node);
    added += 1;
  }
  if (added) {
    state.total += added;
    updateToolbar(state.total);
  }
  return added;
}

function scheduleRescan(): void {
  if (!state.enabled) return;
  if (state.rescanTimer) clearTimeout(state.rescanTimer);
  state.rescanTimer = setTimeout(() => {
    state.rescanTimer = null;
    if (!state.enabled) return;
    observeNewBlocks(collectBlocks());
  }, RESCAN_DEBOUNCE_MS);
}

function onIntersection(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const node = entry.target as HTMLElement;
    if (state.translationCache.has(node) || state.inflight.has(node)) continue;
    const text = (node.innerText || node.textContent || "").trim().replace(/\s+/g, " ");
    if (!text) continue;
    // 一旦进入可视区即停止观察，交给限流队列处理，避免重复触发。
    state.observer?.unobserve(node);
    void translateBlock({ node, text });
  }
}

async function translateBlock(block: ImmersiveBlock): Promise<void> {
  if (!state.settings || !state.limiter) return;
  const settings = state.settings;
  const targetLang = settings.targetLang || "zh-CN";
  const providerId = settings.immersiveDefaultEngine || settings.primaryProvider;

  state.inflight.add(block.node);
  try {
    const result = await state.limiter(() =>
      send("translate:request", {
        text: block.text,
        from: "auto",
        to: targetLang,
        mode: "quick",
        providerId,
      })
    );
    if (!state.enabled) return;
    renderTranslation(block.node, result.translatedText);
  } catch (error) {
    if (!state.enabled) return;
    renderTranslation(block.node, `[翻译失败: ${(error as Error).message}]`, true);
  } finally {
    state.inflight.delete(block.node);
  }
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
  info.setAttribute("data-polyglot-immersive-count", "1");
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

function updateToolbar(total: number): void {
  const info = toolbar?.querySelector<HTMLSpanElement>("[data-polyglot-immersive-count]");
  if (info) info.textContent = `沉浸式 · 共 ${total} 段`;
}
