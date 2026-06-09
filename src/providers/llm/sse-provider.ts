import type { TranslationRequest, TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import type { TranslationProvider } from "../types";
import { buildSystemPrompt, buildUserPrompt, parseDeep } from "./prompt";
import { readSSE } from "./sse";

interface SSEProviderRuntime {
  apiKey: string;
  base: string;
  model: string;
}

interface SSEProviderRequest extends SSEProviderRuntime {
  req: TranslationRequest;
}

export interface SSEProviderConfig {
  id: string;
  displayName: string;
  description: string;
  defaultBase: string;
  defaultModel: string;
  missingApiKeyMessage: string;
  buildEndpoint: (runtime: SSEProviderRuntime) => string;
  buildHeaders: (runtime: SSEProviderRuntime) => HeadersInit;
  buildBody: (input: SSEProviderRequest) => unknown;
  parseDelta: (data: string) => string;
  isAuthenticationFailure?: (status: number) => boolean;
  errorLabel?: string;
}

export function createSSEProvider(config: SSEProviderConfig): TranslationProvider {
  return {
    id: config.id,
    displayName: config.displayName,
    description: config.description,
    capabilities: { stream: true, deep: true, needsCredentials: true, langs: "*" },
    async translate(req, ctx) {
      const rawKey = ctx.credentials?.apiKey?.trim();
      if (!rawKey) {
        throw new ProviderError({
          code: "MISSING_CREDENTIALS",
          providerId: config.id,
          retryable: false,
          userMessage: config.missingApiKeyMessage,
        });
      }
      const runtime: SSEProviderRuntime = {
        apiKey: rawKey,
        base: (ctx.credentials?.apiBase?.trim() || config.defaultBase).replace(/\/$/, ""),
        model: ctx.credentials?.model?.trim() || config.defaultModel,
      };

      async function* streamIter(): AsyncGenerator<Partial<TranslationResult>, void, unknown> {
        const response = await fetch(config.buildEndpoint(runtime), {
          method: "POST",
          signal: ctx.signal,
          headers: config.buildHeaders(runtime),
          body: JSON.stringify(config.buildBody({ ...runtime, req })),
        });
        if (!response.ok) {
          if (config.isAuthenticationFailure?.(response.status)) {
            throw new ProviderError({
              code: "AUTHENTICATION_FAILURE",
              providerId: config.id,
              status: response.status,
              retryable: false,
              userMessage: `${config.errorLabel || config.displayName} authentication failed`,
            });
          }
          throw new ProviderError({
            code: "HTTP_ERROR",
            providerId: config.id,
            status: response.status,
            userMessage: `${config.errorLabel || config.displayName} ${response.status}`,
          });
        }

        let buf = "";
        for await (const data of readSSE(response, ctx.signal)) {
          const delta = config.parseDelta(data);
          if (!delta) continue;
          buf += delta;
          yield { translatedText: req.mode === "deep" ? extractQuickField(buf) : buf };
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
            provider: config.id,
          };
        } else {
          yield { translatedText: buf.trim(), provider: config.id };
        }
      }

      return streamIter();
    },
  };
}

export function buildChatCompletionsBody(input: SSEProviderRequest): unknown {
  return {
    model: input.model,
    stream: true,
    temperature: input.req.mode === "deep" ? 0.2 : 0,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(input.req.mode, {
          ieltsMode: input.req.ieltsMode,
          ieltsTarget: input.req.ieltsTarget,
        }),
      },
      { role: "user", content: buildUserPrompt(input.req) },
    ],
  };
}

/** 深度模式下从未完成的 JSON 流里先扒出 translatedText 字段，用于打字机效果 */
export function extractQuickField(buf: string): string {
  const match = /"translatedText"\s*:\s*"([^"]*)/.exec(buf);
  return match ? match[1] : "";
}
