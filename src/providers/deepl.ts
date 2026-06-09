import type { TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import { normalizeText } from "@shared/utils";
import { DeepLResponseSchema, parseProviderJson } from "@shared/validation";
import type { TranslationProvider } from "./types";

export const deeplProvider: TranslationProvider = {
  id: "deepl",
  displayName: "DeepL Free",
  description: "DeepL 官方 Free API，需要 API Key。",
  capabilities: { stream: false, deep: false, needsCredentials: true, langs: "*" },
  async translate(req, ctx): Promise<TranslationResult> {
    const text = normalizeText(req.text);
    if (!text) {
      throw new ProviderError({
        code: "EMPTY_TEXT",
        providerId: "deepl",
        retryable: false,
        userMessage: "Empty text.",
      });
    }
    const apiKey = ctx.credentials?.apiKey?.trim();
    if (!apiKey) {
      throw new ProviderError({
        code: "MISSING_CREDENTIALS",
        providerId: "deepl",
        retryable: false,
        userMessage: "DeepL 需要配置 API Key",
      });
    }
    const base = ctx.credentials?.apiBase?.trim() || "https://api-free.deepl.com";
    const body = new URLSearchParams({
      text,
      target_lang: mapLang(req.to),
    });
    if (req.from !== "auto") {
      body.set("source_lang", mapLang(req.from));
    }
    const response = await fetch(`${base.replace(/\/$/, "")}/v2/translate`, {
      method: "POST",
      signal: ctx.signal,
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) {
      if (response.status === 403) {
        throw new ProviderError({
          code: "AUTHENTICATION_FAILURE",
          providerId: "deepl",
          status: response.status,
          retryable: false,
          userMessage: "DeepL authentication failed",
        });
      }
      throw new ProviderError({
        code: "HTTP_ERROR",
        providerId: "deepl",
        status: response.status,
        userMessage: `DeepL ${response.status}`,
      });
    }
    const data = parseProviderJson(
      DeepLResponseSchema,
      await response.json(),
      "deepl",
      "DeepL"
    );
    const translated = data.translations?.[0]?.text?.trim();
    if (!translated) {
      throw new ProviderError({
        code: "EMPTY_RESULT",
        providerId: "deepl",
        retryable: true,
        userMessage: "DeepL empty result",
      });
    }
    return {
      originalText: text,
      translatedText: translated,
      provider: "deepl",
    };
  },
};

function mapLang(code: string): string {
  const c = code.toLowerCase();
  if (c === "zh" || c === "zh-cn" || c === "zh-tw") return "ZH";
  if (c === "en") return "EN";
  return c.split("-")[0].toUpperCase();
}
