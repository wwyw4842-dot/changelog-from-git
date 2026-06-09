import type { TranslationRequest, TranslationResult } from "@shared/types";

export interface ProviderContext {
  credentials?: {
    apiKey?: string;
    apiUser?: string;
    apiBase?: string;
    model?: string;
    extra?: Record<string, string>;
  };
  signal?: AbortSignal;
}

export type ProviderResponse =
  | TranslationResult
  | AsyncIterable<Partial<TranslationResult>>;

export interface TranslationProvider {
  id: string;
  displayName: string;
  description: string;
  capabilities: {
    stream: boolean;
    deep: boolean;
    needsCredentials: boolean;
    langs: string[] | "*";
  };
  translate(req: TranslationRequest, ctx: ProviderContext): Promise<ProviderResponse>;
}

export function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return (
    !!value &&
    typeof value === "object" &&
    Symbol.asyncIterator in (value as object)
  );
}
