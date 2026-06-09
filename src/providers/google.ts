import type { TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import { normalizeText } from "@shared/utils";
import { GoogleTranslateResponseSchema, parseProviderJson } from "@shared/validation";
import type { TranslationProvider } from "./types";

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

export const googleProvider: TranslationProvider = {
  id: "google",
  displayName: "Google",
  description: "Google 翻译 Web 免费端点（非官方，易被风控）。",
  capabilities: { stream: false, deep: false, needsCredentials: false, langs: "*" },
  async translate(req, ctx): Promise<TranslationResult> {
    const text = normalizeText(req.text);
    if (!text) {
      throw new ProviderError({
        code: "EMPTY_TEXT",
        providerId: "google",
        retryable: false,
        userMessage: "Empty text.",
      });
    }
    const params = new URLSearchParams({
      client: "gtx",
      sl: req.from === "auto" ? "auto" : mapLang(req.from),
      tl: mapLang(req.to),
      dt: "t",
      dj: "1",
      q: text,
    });
    const response = await fetch(`${ENDPOINT}?${params}`, {
      signal: ctx.signal,
      headers: { Accept: "*/*" },
    });
    if (!response.ok) {
      throw new ProviderError({
        code: "HTTP_ERROR",
        providerId: "google",
        status: response.status,
        userMessage: `Google ${response.status}`,
      });
    }
    const data = parseProviderJson(
      GoogleTranslateResponseSchema,
      await response.json(),
      "google",
      "Google"
    );
    const translated = (data.sentences || [])
      .map((s) => s.trans || "")
      .join("")
      .trim();
    if (!translated) {
      throw new ProviderError({
        code: "EMPTY_RESULT",
        providerId: "google",
        retryable: true,
        userMessage: "Google returned empty result",
      });
    }
    return {
      originalText: text,
      translatedText: translated,
      provider: "google",
    };
  },
};

function mapLang(code: string): string {
  const c = code.toLowerCase();
  if (c === "zh-cn" || c === "zh") return "zh-CN";
  if (c === "zh-tw") return "zh-TW";
  return c.split("-")[0];
}
