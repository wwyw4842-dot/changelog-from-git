import type { TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import type { TranslationProvider } from "../types";
import { parseOllamaDelta } from "./delta-parsers";
import { buildSystemPrompt, buildUserPrompt, parseDeep } from "./prompt";
import { extractQuickField } from "./sse-provider";
import { readJSONLines } from "./sse";

export const DEFAULT_OLLAMA_BASE = "http://127.0.0.1:11434";
export const DEFAULT_OLLAMA_MODEL = "qwen2.5:0.5b";
const OLLAMA_BASE_CANDIDATES = [DEFAULT_OLLAMA_BASE, "http://127.0.0.1:11435"] as const;
const OLLAMA_PROBE_TIMEOUT_MS = 800;
const OLLAMA_BASE_CACHE_MS = 5 * 60 * 1_000;

let detectedBase: { base: string; expiresAt: number } | null = null;

export function resetOllamaBaseDetectionForTests(): void {
  detectedBase = null;
}

export const ollamaProvider: TranslationProvider = {
  id: "ollama",
  displayName: "Ollama (本地)",
  description: "本地部署的 Ollama，无需网络外发。",
  capabilities: { stream: true, deep: true, needsCredentials: false, langs: "*" },
  async translate(req, ctx) {
    const configuredBase = ctx.credentials?.apiBase?.trim().replace(/\/$/, "") || "";
    const model = ctx.credentials?.model?.trim() || DEFAULT_OLLAMA_MODEL;

    async function* streamIter(): AsyncGenerator<Partial<TranslationResult>, void, unknown> {
      try {
        const base = configuredBase || (await detectOllamaBase(ctx.signal));
        const response = await fetch(`${base}/api/chat`, {
          method: "POST",
          signal: ctx.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: true,
            keep_alive: "30m",
            options: { temperature: 0.1 },
            messages: [
              {
                role: "system",
                content: buildSystemPrompt(req.mode, {
                  ieltsMode: req.ieltsMode,
                  ieltsTarget: req.ieltsTarget,
                }),
              },
              { role: "user", content: buildUserPrompt(req) },
            ],
          }),
        });
        if (!response.ok) {
          const details = await response.text().catch(() => "");
          const modelMissing = response.status === 404 || /model.*not found/i.test(details);
          throw new ProviderError({
            code: "HTTP_ERROR",
            providerId: "ollama",
            status: response.status,
            retryable: !modelMissing,
            userMessage: modelMissing
              ? `本地 Qwen 模型 ${model} 未安装，请先在 Ollama 中下载。`
              : `本地 Qwen 请求失败（${response.status}）。`,
          });
        }
        let buf = "";
        for await (const line of readJSONLines(response, ctx.signal)) {
          const { text, done } = parseOllamaDelta(line);
          if (text) {
            buf += text;
            yield { translatedText: req.mode === "deep" ? extractQuickField(buf) : buf };
          }
          if (done) break;
        }
        if (!buf.trim()) {
          throw new ProviderError({
            code: "EMPTY_RESULT",
            providerId: "ollama",
            retryable: true,
            userMessage: "本地 Qwen 没有返回译文。",
          });
        }
        if (req.mode === "deep") {
          const parsed = parseDeep(buf);
          yield {
            translatedText: parsed.translatedText || buf,
            phonetic: parsed.phonetic,
            alternatives: parsed.alternatives,
            explanation: parsed.explanation,
            examples: parsed.examples,
            partOfSpeech: parsed.partOfSpeech,
            provider: "ollama",
          };
        } else {
          yield { translatedText: buf.trim(), provider: "ollama" };
        }
      } catch (error) {
        if (!configuredBase) detectedBase = null;
        if (error instanceof Error && error.name === "AbortError") throw error;
        if (error instanceof ProviderError) throw error;
        throw new ProviderError({
          code: "HTTP_ERROR",
          providerId: "ollama",
          retryable: true,
          userMessage: "本地 Qwen 不可用，请先启动 Ollama。",
        });
      }
    }
    return streamIter();
  },
};

async function detectOllamaBase(signal?: AbortSignal): Promise<string> {
  if (detectedBase && detectedBase.expiresAt > Date.now()) return detectedBase.base;

  for (const base of OLLAMA_BASE_CANDIDATES) {
    const controller = new AbortController();
    const onAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), OLLAMA_PROBE_TIMEOUT_MS);
    try {
      const response = await fetch(`${base}/api/version`, { signal: controller.signal });
      if (response.ok) {
        detectedBase = { base, expiresAt: Date.now() + OLLAMA_BASE_CACHE_MS };
        return base;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  return DEFAULT_OLLAMA_BASE;
}
