import type { TranslationRequest, TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import { normalizeText } from "@shared/utils";
import type { ProviderContext, TranslationProvider } from "./types";

export interface RestRequest {
  url: string;
  init?: RequestInit;
}

export interface RestProviderConfig<TData> {
  id: string;
  displayName: string;
  description: string;
  needsCredentials?: boolean;
  /** 错误信息里展示的引擎名，默认用 displayName */
  errorLabel?: string;
  /**
   * 构建请求。可以是异步的（Bing 需要先取 session）；
   * 凭据缺失等前置校验直接在这里抛 ProviderError。
   */
  buildRequest(
    text: string,
    req: TranslationRequest,
    ctx: ProviderContext
  ): Promise<RestRequest> | RestRequest;
  /** 校验并解析 JSON 响应（通常包一层 parseProviderJson + zod schema） */
  parseResponse(raw: unknown): TData;
  /** 从解析结果中取出译文；返回空则按 EMPTY_RESULT 处理 */
  extractText(data: TData): string | null | undefined;
  /** EMPTY_RESULT 的自定义文案（如火山把后端 message 透出） */
  emptyResultMessage?(data: TData): string | undefined;
  /** 哪些 HTTP 状态码视为鉴权失败 */
  isAuthFailure?(status: number): boolean;
  /** 请求失败（HTTP 错误或空结果）时的清理钩子，如 Bing 失效 session 缓存 */
  onRequestFailed?(): void;
}

/**
 * 免费 REST 翻译引擎的通用骨架：
 * 规范化文本 → 构建请求 → fetch → HTTP 错误归类 → schema 解析 → 提取译文。
 * 各引擎只描述差异（URL、headers、响应字段），错误语义保持一致。
 */
export function createRestProvider<TData>(config: RestProviderConfig<TData>): TranslationProvider {
  const label = config.errorLabel || config.displayName;
  return {
    id: config.id,
    displayName: config.displayName,
    description: config.description,
    capabilities: {
      stream: false,
      deep: false,
      needsCredentials: Boolean(config.needsCredentials),
      langs: "*",
    },
    async translate(req, ctx): Promise<TranslationResult> {
      const text = normalizeText(req.text);
      if (!text) {
        throw new ProviderError({
          code: "EMPTY_TEXT",
          providerId: config.id,
          retryable: false,
          userMessage: "Empty text.",
        });
      }
      const { url, init } = await config.buildRequest(text, req, ctx);
      const response = await fetch(url, { signal: ctx.signal, ...init });
      if (!response.ok) {
        config.onRequestFailed?.();
        if (config.isAuthFailure?.(response.status)) {
          throw new ProviderError({
            code: "AUTHENTICATION_FAILURE",
            providerId: config.id,
            status: response.status,
            retryable: false,
            userMessage: `${label} authentication failed`,
          });
        }
        throw new ProviderError({
          code: "HTTP_ERROR",
          providerId: config.id,
          status: response.status,
          userMessage: `${label} ${response.status}`,
        });
      }
      const data = config.parseResponse(await response.json());
      const translated = config.extractText(data)?.trim();
      if (!translated) {
        config.onRequestFailed?.();
        throw new ProviderError({
          code: "EMPTY_RESULT",
          providerId: config.id,
          retryable: true,
          userMessage: config.emptyResultMessage?.(data) || `${label} empty result`,
        });
      }
      return {
        originalText: text,
        translatedText: translated,
        provider: config.id,
      };
    },
  };
}
