import { send } from "@shared/messaging";
import type { Settings } from "@shared/types";
import { observePdfTextLayers } from "./pdf-detector";

interface PdfState {
  enabled: boolean;
  disposer: (() => void) | null;
  rendered: WeakSet<HTMLElement>;
  settings: Settings | null;
  inflight: Set<HTMLElement>;
}

const state: PdfState = {
  enabled: false,
  disposer: null,
  rendered: new WeakSet(),
  settings: null,
  inflight: new Set(),
};

export function enablePdfMode(settings: Settings): void {
  if (state.enabled) return;
  state.enabled = true;
  state.settings = settings;
  state.disposer = observePdfTextLayers((layer) => {
    scheduleTranslate(layer);
  });
}

export function disablePdfMode(): void {
  if (!state.enabled) return;
  state.enabled = false;
  state.disposer?.();
  state.disposer = null;
  document
    .querySelectorAll("[data-polyglot-pdf-translation]")
    .forEach((el) => el.remove());
  state.inflight.clear();
}

function scheduleTranslate(layer: HTMLElement): void {
  if (!state.settings) return;
  if (state.rendered.has(layer)) return;
  state.rendered.add(layer);
  const text = (layer.innerText || layer.textContent || "").trim().replace(/\s+/g, " ");
  if (!text) return;
  if (text.length < 4) return;
  if (state.inflight.has(layer)) return;
  state.inflight.add(layer);
  void translatePdfLayer(layer, text);
}

async function translatePdfLayer(layer: HTMLElement, text: string): Promise<void> {
  const settings = state.settings!;
  try {
    const result = await send("translate:request", {
      text,
      from: "auto",
      to: settings.targetLang || "zh-CN",
      mode: "quick",
      providerId: settings.immersiveDefaultEngine || settings.primaryProvider,
    });
    if (!state.enabled) return;
    renderOverlay(layer, result.translatedText);
  } catch (error) {
    if (!state.enabled) return;
    renderOverlay(layer, `[翻译失败: ${(error as Error).message}]`, true);
  } finally {
    state.inflight.delete(layer);
  }
}

function renderOverlay(layer: HTMLElement, text: string, isError = false): void {
  const overlay = document.createElement("div");
  overlay.setAttribute("data-polyglot-pdf-translation", "true");
  overlay.classList.add("polyglot-immersive-ignore");
  overlay.style.cssText = [
    "margin-top: 6px",
    "padding: 6px 8px",
    `border-left: 3px solid rgba(96,165,250,${isError ? "0.45" : "0.85"})`,
    "background: rgba(15,23,42,0.65)",
    "color: #e2e8f0",
    "border-radius: 0 8px 8px 0",
    "font-size: 13px",
    "line-height: 1.55",
    "white-space: pre-wrap",
    "word-break: break-word",
    "pointer-events: none",
  ].join(";");
  overlay.textContent = text;
  layer.after(overlay);
}
