import type { TranslationRequest, TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import { normalizeText } from "@shared/utils";
import { MyMemoryResponseSchema, parseProviderJson } from "@shared/validation";
import type { ProviderContext, TranslationProvider } from "./types";

const SAFE_QUERY_CHARS = 420;

export const myMemoryProvider: TranslationProvider = {
  id: "mymemory",
  displayName: "MyMemory",
  description: "免费兜底翻译引擎，稳定可达但质量波动较大。",
  capabilities: { stream: false, deep: false, needsCredentials: false, langs: "*" },
  async translate(req, ctx): Promise<TranslationResult> {
    const normalized = normalizeText(req.text);
    if (!normalized) {
      throw new ProviderError({
        code: "EMPTY_TEXT",
        providerId: "mymemory",
        retryable: false,
        userMessage: "Empty text.",
      });
    }
    if (normalized.length <= SAFE_QUERY_CHARS) {
      return callMyMemory(normalized, req, ctx);
    }
    const chunks = splitIntoChunks(normalized, SAFE_QUERY_CHARS);
    const parts: string[] = [];
    for (const chunk of chunks) {
      const result = await callMyMemory(chunk, req, ctx);
      parts.push(result.translatedText);
    }
    const joiner =
      /[\u4e00-\u9fa5]/.test(req.to) || req.to.toLowerCase().startsWith("zh") ? "" : " ";
    return {
      originalText: normalized,
      translatedText: parts.join(joiner).trim(),
      provider: "mymemory",
    };
  },
};

async function callMyMemory(
  text: string,
  req: TranslationRequest,
  ctx: ProviderContext
): Promise<TranslationResult> {
  const apiKey = ctx.credentials?.apiKey?.trim() || "";
  const apiUser = ctx.credentials?.apiUser?.trim() || "";
  const langpair = `${req.from === "auto" ? "en" : req.from}|${req.to}`;
  const params = new URLSearchParams({ q: text, langpair });
  if (apiKey) params.set("key", apiKey);
  if (apiKey && apiUser) params.set("de", apiUser);
  const url = `https://api.mymemory.translated.net/get?${params.toString()}`;
  const response = await fetch(url, { signal: ctx.signal });
  if (!response.ok) {
    throw new ProviderError({
      code: "HTTP_ERROR",
      providerId: "mymemory",
      status: response.status,
      userMessage: `MyMemory ${response.status}`,
    });
  }
  const data = parseProviderJson(
    MyMemoryResponseSchema,
    await response.json(),
    "mymemory",
    "MyMemory"
  );
  const translatedText = String(data.responseData?.translatedText || "").trim();
  const status = Number(data.responseStatus || 0);
  const details = String(data.responseDetails || "");
  if (
    translatedText.toUpperCase().startsWith("AUTHENTICATION FAILURE") ||
    details.toUpperCase().includes("API KEY")
  ) {
    if (apiKey) {
      return callMyMemory(text, req, { ...ctx, credentials: {} });
    }
    throw new ProviderError({
      code: "AUTHENTICATION_FAILURE",
      providerId: "mymemory",
      retryable: false,
      userMessage: "MyMemory authentication failed",
    });
  }
  if (status >= 400) {
    throw new ProviderError({
      code: "HTTP_ERROR",
      providerId: "mymemory",
      status,
      userMessage: details || `MyMemory status ${status}`,
    });
  }
  return {
    originalText: text,
    translatedText,
    provider: "mymemory",
  };
}

function splitIntoChunks(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const segments = text
    .split(/(?<=[.!?。！？;；])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const segment of segments) {
    if (segment.length > max) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < segment.length; i += max) {
        chunks.push(segment.slice(i, i + max));
      }
      continue;
    }
    const candidate = current ? `${current} ${segment}` : segment;
    if (candidate.length <= max) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      current = segment;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, max)];
}
