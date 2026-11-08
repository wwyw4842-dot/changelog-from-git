import { ProviderError } from "@shared/provider-error";
import { DeepLResponseSchema, parseProviderJson } from "@shared/validation";
import { mapLang } from "./lang-mapper";
import { createRestProvider } from "./rest-provider";

export const deeplProvider = createRestProvider({
  id: "deepl",
  displayName: "DeepL Free",
  description: "DeepL 官方 Free API，需要 API Key。",
  needsCredentials: true,
  errorLabel: "DeepL",
  buildRequest(text, req, ctx) {
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
      target_lang: mapLang("deepl", req.to),
    });
    if (req.from !== "auto") {
      body.set("source_lang", mapLang("deepl", req.from));
    }
    return {
      url: `${base.replace(/\/$/, "")}/v2/translate`,
      init: {
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    };
  },
  parseResponse: (raw) => parseProviderJson(DeepLResponseSchema, raw, "deepl", "DeepL"),
  extractText: (data) => data.translations?.[0]?.text,
  isAuthFailure: (status) => status === 403,
});
