import type { Settings } from "@shared/types";
import { requestTranslation } from "./request";
import { collectBlocks, markTranslationHost, clearImmersive, type ImmersiveBlock } from "./scanner";

const MAX_IN_FLIGHT = 6;
const OBSERVER_ROOT_MARGIN = "600px";
const RETRY_LIMIT = 2;
const NAVIGATION_POLL_MS = 250;

interface ImmersiveState {
  enabled: boolean;
  observer: IntersectionObserver | null;
  settings: Settings | null;
  translationCache: Map<HTMLElement, HTMLElement>;
  queued: Map<HTMLElement, QueueJob>;
  inFlight: number;
  generation: number;
  pageKey: string;
  navigationTimer: number | null;
  controller: AbortController | null;
  pending: Set<HTMLElement>;
}

interface QueueJob {
  block: ImmersiveBlock;
  generation: number;
  attempt: number;
}

const state: ImmersiveState = {
  enabled: false,
  observer: null,
  settings: null,
  translationCache: new Map(),
  queued: new Map(),
  inFlight: 0,
  generation: 0,
  pageKey: "",
  navigationTimer: null,
  controller: null,
  pending: new Set(),
};

let toolbar: HTMLDivElement | null = null;

export async function enableImmersive(settings: Settings): Promise<void> {
  if (state.enabled) return;
  state.enabled = true;
  state.settings = settings;
  state.generation += 1;
  state.pageKey = location.href;
  state.queued.clear();
  state.pending.clear();
  state.controller = new AbortController();

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
  state.navigationTimer = window.setInterval(checkNavigation, NAVIGATION_POLL_MS);
}

export function disableImmersive(): void {
  if (!state.enabled) return;
  state.enabled = false;
  state.generation += 1;
  state.controller?.abort();
  state.controller = null;
  state.observer?.disconnect();
  state.observer = null;
  if (state.navigationTimer !== null) {
    window.clearInterval(state.navigationTimer);
    state.navigationTimer = null;
  }
  clearImmersive();
  state.translationCache.clear();
  state.queued.clear();
  state.pending.clear();
  toolbar?.remove();
  toolbar = null;
}

export function isImmersiveActive(): boolean {
  return state.enabled;
}

function onIntersection(entries: IntersectionObserverEntry[]): void {
  if (!state.enabled) return;
  checkNavigation();
  if (!state.enabled) return;
  const pending: ImmersiveBlock[] = [];
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const node = entry.target as HTMLElement;
    if (state.translationCache.has(node) || state.pending.has(node)) continue;
    const text = (node.innerText || node.textContent || "").trim().replace(/\s+/g, " ");
    if (text) pending.push({ node, text });
  }
  if (!pending.length) return;
  for (const block of pending) {
    state.pending.add(block.node);
    state.queued.set(block.node, {
      block,
      generation: state.generation,
      attempt: 0,
    });
  }
  pumpQueue();
}

function pumpQueue(): void {
  while (state.enabled && state.inFlight < MAX_IN_FLIGHT) {
    const job = state.queued.values().next().value as QueueJob | undefined;
    if (!job) return;
    state.queued.delete(job.block.node);
    if (job.generation !== state.generation) continue;
    state.inFlight += 1;
    void translateJob(job).finally(() => {
      if (job.generation === state.generation && !state.queued.has(job.block.node)) {
        state.pending.delete(job.block.node);
      }
      state.inFlight = Math.max(0, state.inFlight - 1);
      pumpQueue();
    });
  }
}

async function translateJob(job: QueueJob): Promise<void> {
  if (!state.settings || !state.controller || !isCurrentGeneration(job.generation)) return;
  const settings = state.settings;
  const targetLang = settings.targetLang || "zh-CN";
  const providerId = settings.immersiveDefaultEngine || settings.primaryProvider;
  try {
    const result = await requestTranslation(
      {
        text: job.block.text,
        from: "auto",
        to: targetLang,
        mode: "quick",
        providerId,
      },
      state.controller.signal
    );
    if (isCurrentGeneration(job.generation)) {
      renderTranslation(job.block.node, result.translatedText);
    }
  } catch (error) {
    if (!isCurrentGeneration(job.generation)) return;
    if (job.attempt < RETRY_LIMIT && isRetryable(error)) {
      await delay(150 * 2 ** job.attempt);
      if (isCurrentGeneration(job.generation)) {
        job.attempt += 1;
        state.queued.set(job.block.node, job);
      }
      return;
    }
    renderTranslation(job.block.node, `[翻译失败: ${(error as Error).message}]`, true);
  }
}

function isRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate.?limit|timeout|timed?\s*out|network|temporar|fetch/i.test(message);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isCurrentGeneration(generation: number): boolean {
  return state.enabled && generation === state.generation && location.href === state.pageKey;
}

function checkNavigation(): void {
  if (!state.enabled || location.href === state.pageKey) return;
  resetForNavigation();
}

function resetForNavigation(): void {
  state.generation += 1;
  state.controller?.abort();
  state.controller = new AbortController();
  state.pageKey = location.href;
  state.queued.clear();
  state.pending.clear();
  state.translationCache.clear();
  state.observer?.disconnect();
  clearImmersive();
  const blocks = collectBlocks();
  if (!blocks.length) {
    state.enabled = false;
    toolbar?.remove();
    toolbar = null;
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

function renderTranslation(node: HTMLElement, translatedText: string, isError = false): void {
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
