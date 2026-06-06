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

const registry = new Map<string, TranslationProvider>();

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
  const chain = [options.primary, ...options.fallback.filter((id) => id !== options.primary)];
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
    const provider = registry.get(providerId);
    if (!provider) continue;
    try {
      const ctx: ProviderContext = {
        credentials: options.credentialsFor(providerId) || {},
        signal: options.signal,
      };
      const raw = await provider.translate(req, ctx);
      const final = isAsyncIterable<Partial<TranslationResult>>(raw)
        ? await collectStream(raw, req, provider.id, options.onChunk)
        : raw;
      translationCache.set(options.primary, req.from, req.to, req.mode, text, final);
      if (providerId !== options.primary) {
        translationCache.set(providerId, req.from, req.to, req.mode, text, final);
      }
      return final;
    } catch (error) {
      console.warn(`[polyglot] provider ${providerId} failed:`, error);
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All providers failed");
}

async function collectStream(
  iterable: AsyncIterable<Partial<TranslationResult>>,
  req: TranslationRequest,
  providerId: string,
  onChunk?: (chunk: Partial<TranslationResult>) => void
): Promise<TranslationResult> {
  let accumulated: TranslationResult = {
    originalText: req.text,
    translatedText: "",
    provider: providerId,
  };
  for await (const chunk of iterable) {
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
