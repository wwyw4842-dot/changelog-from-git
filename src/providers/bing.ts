import { ProviderError } from "@shared/provider-error";
import { BingTranslateResponseSchema, parseProviderJson } from "@shared/validation";
import { mapLang } from "./lang-mapper";
import { createRestProvider } from "./rest-provider";

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

export const bingProvider = createRestProvider({
  id: "bing",
  displayName: "Bing",
  description: "微软必应翻译 Web 端点，对中英友好。",
  async buildRequest(text, req, ctx) {
    const session = await getSession(ctx.signal);
    const body = new URLSearchParams({
      fromLang: req.from === "auto" ? "auto-detect" : mapLang("bing", req.from),
      to: mapLang("bing", req.to),
      text,
      token: session.token,
      key: session.key,
    });
    return {
      url: `${TRANSLATE_URL}?isVertical=1&IG=${session.ig}&IID=${session.iid}`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "*/*",
        },
        body,
      },
    };
  },
  parseResponse: (raw) => parseProviderJson(BingTranslateResponseSchema, raw, "bing", "Bing"),
  extractText: (data) => data?.[0]?.translations?.[0]?.text,
  // 请求失败往往意味着 token 过期，强制下次重新抓取 session
  onRequestFailed: () => {
    sessionCache = null;
  },
});

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
