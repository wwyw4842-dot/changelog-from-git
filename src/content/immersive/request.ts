import type { TranslationRequest, TranslationResult } from "@shared/types";

const REQUEST_TIMEOUT_MS = 30_000;

export function requestTranslation(
  payload: TranslationRequest,
  signal: AbortSignal
): Promise<TranslationResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Translation cancelled", "AbortError"));
      return;
    }
    const port = chrome.runtime.connect({ name: "polyglot-stream" });
    let settled = false;
    const finish = (result?: TranslationResult, error?: Error): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      try {
        port.disconnect();
      } catch {
        // A worker disconnect can race with settlement.
      }
      if (error) reject(error);
      else resolve(result!);
    };
    const abort = (): void =>
      finish(undefined, new DOMException("Translation cancelled", "AbortError"));
    const timer = setTimeout(
      () => finish(undefined, new Error("Translation request timeout")),
      REQUEST_TIMEOUT_MS
    );
    signal.addEventListener("abort", abort, { once: true });
    port.onMessage.addListener((message: { type: string; payload?: unknown }) => {
      if (message.type === "done") finish(message.payload as TranslationResult);
      else if (message.type === "error") {
        const payload = message.payload as { message?: string };
        finish(undefined, new Error(payload?.message || "Translation failed"));
      }
    });
    port.onDisconnect.addListener(() =>
      finish(undefined, new Error("Translation worker disconnected"))
    );
    try {
      port.postMessage({ type: "translate:stream", payload });
    } catch (error) {
      finish(undefined, error instanceof Error ? error : new Error(String(error)));
    }
  });
}
