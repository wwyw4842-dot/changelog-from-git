import type { TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import { normalizeText } from "@shared/utils";
import { BingTranslateResponseSchema, parseProviderJson } from "@shared/validation";
import type { TranslationProvider } from "./types";

const SESSION_URL = "https://www.bing.com/translator";
const TRANSLATE_URL = "https://www.bing.com/ttranslatev3";

interface BingSession {
  ig: string;
  iid: string;
  key: string;
  token: string;
  fetchedAt: number;
}

let sessionCache: BingSession | null = null;
const SESSION_TTL_MS = 30 * 60 * 1000;

export const bingProvider: TranslationProvider = {
  id: "bing",
  displayName: "Bing",
  description: "微软必应翻译 Web 端点，对中英友好。",
  capabilities: { stream: false, deep: false, needsCredentials: false, langs: "*" },
  async translate(req, ctx): Promise<TranslationResult> {
    const text = normalizeText(req.text);
    if (!text) {
      throw new ProviderError({
        code: "EMPTY_TEXT",
        providerId: "bing",
        retryable: false,
        userMessage: "Empty text.",
      });
    }
    const session = await getSession(ctx.signal);
    const body = new URLSearchParams({
      fromLang: req.from === "auto" ? "auto-detect" : mapLang(req.from),
      to: mapLang(req.to),
      text,
      token: session.token,
      key: session.key,
    });
    const url = `${TRANSLATE_URL}?isVertical=1&IG=${session.ig}&IID=${session.iid}`;
    const response = await fetch(url, {
      method: "POST",
      signal: ctx.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "*/*",
      },
      body,
    });
    if (!response.ok) {
      sessionCache = null;
      throw new ProviderError({
        code: "HTTP_ERROR",
        providerId: "bing",
        status: response.status,
        userMessage: `Bing ${response.status}`,
      });
    }
    const data = parseProviderJson(
      BingTranslateResponseSchema,
      await response.json(),
      "bing",
      "Bing"
    );
    const translated = data?.[0]?.translations?.[0]?.text?.trim();
    if (!translated) {
      sessionCache = null;
      throw new ProviderError({
        code: "EMPTY_RESULT",
        providerId: "bing",
        retryable: true,
        userMessage: "Bing empty result",
      });
    }
    return {
      originalText: text,
      translatedText: translated,
      provider: "bing",
    };
  },
};

async function getSession(signal?: AbortSignal): Promise<BingSession> {
  if (sessionCache && Date.now() - sessionCache.fetchedAt < SESSION_TTL_MS) {
    return sessionCache;
  }
  const response = await fetch(SESSION_URL, { signal, headers: { Accept: "text/html" } });
  if (!response.ok) {
    throw new ProviderError({
      code: "HTTP_ERROR",
      providerId: "bing",
      status: response.status,
      userMessage: `Bing session ${response.status}`,
    });
  }
  const html = await response.text();
  const ig = /IG:"([^"]+)"/.exec(html)?.[1];
  const iid = /data-iid="([^"]+)"/.exec(html)?.[1];
  const paramsMatch = /params_AbusePreventionHelper\s*=\s*\[(\d+),"([^"]+)"/.exec(html);
  if (!ig || !iid || !paramsMatch) {
    throw new ProviderError({
      code: "PARSE_ERROR",
      providerId: "bing",
      retryable: true,
      userMessage: "Failed to parse Bing session",
    });
  }
  sessionCache = {
    ig,
    iid: `${iid}.1`,
    key: paramsMatch[1],
    token: paramsMatch[2],
    fetchedAt: Date.now(),
  };
  return sessionCache;
}

function mapLang(code: string): string {
  const c = code.toLowerCase();
  if (c === "zh-cn" || c === "zh") return "zh-Hans";
  if (c === "zh-tw") return "zh-Hant";
  if (c === "en") return "en";
  if (c === "ja") return "ja";
  if (c === "ko") return "ko";
  return c.split("-")[0];
}
