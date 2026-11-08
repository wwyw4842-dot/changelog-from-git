import type { TranslationRequest, TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import { translationCache } from "./cache";
import { isAsyncIterable, type ProviderContext, type TranslationProvider } from "./types";
import { myMemoryProvider } from "./mymemory";
import { googleProvider } from "./google";
import { bingProvider } from "./bing";
import { deeplProvider } from "./deepl";
import { volcanoProvider } from "./volcano";
import { openaiProvider } from "./llm/openai";
import { claudeProvider } from "./llm/claude";
import { geminiProvider } from "./llm/gemini";
import { ollamaProvider } from "./llm/ollama";
import { deepseekProvider, deepseekReasonProvider } from "./llm/deepseek";
import { mimoProvider, mimoProProvider } from "./llm/mimo";

const registry = new Map<string, TranslationProvider>();

const QUICK_PROVIDER_TIMEOUT_MS = 5_000;
const DEEP_PROVIDER_TIMEOUT_MS = 20_000;
const LOCAL_PROVIDER_TIMEOUT_MS = 60_000;

export function registerProvider(provider: TranslationProvider): void {
  registry.set(provider.id, provider);
}

export function getProvider(id: string): TranslationProvider | undefined {
  return registry.get(id);
}

export function listProviders(): TranslationProvider[] {
  return Array.from(registry.values());
}

registerProvider(googleProvider);
registerProvider(bingProvider);
registerProvider(deeplProvider);
registerProvider(volcanoProvider);
registerProvider(myMemoryProvider);
registerProvider(openaiProvider);
registerProvider(claudeProvider);
registerProvider(geminiProvider);
registerProvider(ollamaProvider);
registerProvider(deepseekProvider);
registerProvider(deepseekReasonProvider);
registerProvider(mimoProvider);
registerProvider(mimoProProvider);

export interface TranslateViaChainOptions {
  primary: string;
  fallback: string[];
  credentialsFor: (providerId: string) => ProviderContext["credentials"];
  signal?: AbortSignal;
  onChunk?: (chunk: Partial<TranslationResult>) => void;
}

export async function translateViaChain(
  req: TranslationRequest,
  options: TranslateViaChainOptions
): Promise<TranslationResult> {
  const chain = Array.from(
    new Set([options.primary, ...options.fallback].filter((id) => Boolean(id)))
  );
  const text = req.text.trim();
  if (!text) {
    throw new ProviderError({
      code: "EMPTY_TEXT",
      providerId: options.primary,
      retryable: false,
      userMessage: "Empty text.",
    });
  }
  const cached = translationCache.get(options.primary, req.from, req.to, req.mode, text);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  let lastError: unknown = null;
  for (const providerId of chain) {
    throwIfAborted(options.signal);
    const provider = registry.get(providerId);
    if (!provider) continue;
    const attempt = createAttemptSignal(
      options.signal,
      providerId === "ollama"
        ? LOCAL_PROVIDER_TIMEOUT_MS
        : req.mode === "deep"
          ? DEEP_PROVIDER_TIMEOUT_MS
          : QUICK_PROVIDER_TIMEOUT_MS
    );
    try {
      const ctx: ProviderContext = {
        credentials: options.credentialsFor(providerId) || {},
        signal: attempt.signal,
      };
      const raw = await provider.translate(req, ctx);
      throwIfAborted(options.signal);
      const final = isAsyncIterable<Partial<TranslationResult>>(raw)
        ? await collectStream(raw, req, provider.id, options.onChunk, options.signal)
        : raw;
      if (attempt.timedOut()) {
        throw providerTimeoutError(providerId);
      }
      throwIfAborted(options.signal);
      if (!final.translatedText?.trim()) {
        throw new ProviderError({
          code: "EMPTY_RESULT",
          providerId,
          retryable: true,
          userMessage: `${provider.displayName} returned an empty translation`,
        });
      }
      translationCache.set(options.primary, req.from, req.to, req.mode, text, final);
      if (providerId !== options.primary) {
        translationCache.set(providerId, req.from, req.to, req.mode, text, final);
      }
      return final;
    } catch (error) {
      if (options.signal?.aborted || (isAbortError(error) && !attempt.timedOut())) {
        throw error;
      }
      const normalizedError = attempt.timedOut() ? providerTimeoutError(providerId) : error;
      console.warn(`[polyglot] provider ${providerId} failed:`, error);
      lastError = normalizedError;
    } finally {
      attempt.cleanup();
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All providers failed");
}

function providerTimeoutError(providerId: string): ProviderError {
  return new ProviderError({
    code: "TIMEOUT",
    providerId,
    retryable: true,
    userMessage:
      providerId === "ollama"
        ? "本地 Qwen 响应超时，请确认 Ollama 已启动。"
        : `${providerId} 请求超时，正在尝试备用服务。`,
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (typeof signal.throwIfAborted === "function") {
    signal.throwIfAborted();
  }
  throw new DOMException("The operation was aborted", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function createAttemptSignal(
  parent: AbortSignal | undefined,
  timeoutMs: number
): {
  signal: AbortSignal;
  timedOut: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timeoutReached = false;
  const onParentAbort = () => controller.abort(parent?.reason);

  if (parent?.aborted) {
    onParentAbort();
  } else {
    parent?.addEventListener("abort", onParentAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    timeoutReached = true;
    controller.abort(new DOMException("Provider timed out", "TimeoutError"));
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => timeoutReached,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", onParentAbort);
    },
  };
}

async function collectStream(
  iterable: AsyncIterable<Partial<TranslationResult>>,
  req: TranslationRequest,
  providerId: string,
  onChunk?: (chunk: Partial<TranslationResult>) => void,
  signal?: AbortSignal
): Promise<TranslationResult> {
  let accumulated: TranslationResult = {
    originalText: req.text,
    translatedText: "",
    provider: providerId,
  };
  for await (const chunk of iterable) {
    throwIfAborted(signal);
    accumulated = {
      ...accumulated,
      ...chunk,
      translatedText: chunk.translatedText ?? accumulated.translatedText,
    };
    if (onChunk) onChunk({ ...chunk, provider: providerId });
  }
  accumulated.streamed = true;
  return accumulated;
}
