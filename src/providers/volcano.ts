import type { TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import { normalizeText } from "@shared/utils";
import { VolcanoResponseSchema, parseProviderJson } from "@shared/validation";
import type { TranslationProvider } from "./types";

/**
 * 火山翻译公开 Web 端点（不需要鉴权 Key）。
 * 国内网络通常比 Google 稳定，中文翻译质量优。
 */
export const volcanoProvider: TranslationProvider = {
  id: "volcano",
  displayName: "火山翻译",
  description: "字节跳动火山翻译 Web 接口，国内稳定，中文表现佳。",
  capabilities: { stream: false, deep: false, needsCredentials: false, langs: "*" },
  async translate(req, ctx): Promise<TranslationResult> {
    const text = normalizeText(req.text);
    if (!text) {
      throw new ProviderError({
        code: "EMPTY_TEXT",
        providerId: "volcano",
        retryable: false,
        userMessage: "Empty text.",
      });
    }
    const body = JSON.stringify({
      text,
      source_language: req.from === "auto" ? "" : mapLang(req.from),
      target_language: mapLang(req.to),
    });
    const response = await fetch("https://translate.volcengine.com/crx/translate/v1/", {
      method: "POST",
      signal: ctx.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });
    if (!response.ok) {
      throw new ProviderError({
        code: "HTTP_ERROR",
        providerId: "volcano",
        status: response.status,
        userMessage: `Volcano ${response.status}`,
      });
    }
    const data = parseProviderJson(
      VolcanoResponseSchema,
      await response.json(),
      "volcano",
      "Volcano"
    );
    const translated = (data.translation || "").trim();
    if (!translated) {
      throw new ProviderError({
        code: "EMPTY_RESULT",
        providerId: "volcano",
        retryable: true,
        userMessage: data.message || "Volcano empty result",
      });
    }
    return {
      originalText: text,
      translatedText: translated,
      provider: "volcano",
    };
  },
};

function mapLang(code: string): string {
  const c = code.toLowerCase();
  if (c === "zh-cn" || c === "zh") return "zh";
  if (c === "zh-tw") return "zh-Hant";
  return c.split("-")[0];
}
