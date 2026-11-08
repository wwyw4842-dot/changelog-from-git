import { GoogleTranslateResponseSchema, parseProviderJson } from "@shared/validation";
import { mapLang } from "./lang-mapper";
import { createRestProvider } from "./rest-provider";

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

export const googleProvider = createRestProvider({
  id: "google",
  displayName: "Google",
  description: "Google 翻译 Web 免费端点（非官方，易被风控）。",
  buildRequest(text, req) {
    const params = new URLSearchParams({
      client: "gtx",
      sl: req.from === "auto" ? "auto" : mapLang("google", req.from),
      tl: mapLang("google", req.to),
      dt: "t",
      dj: "1",
      q: text,
    });
    return {
      url: `${ENDPOINT}?${params}`,
      init: { headers: { Accept: "*/*" } },
    };
  },
  parseResponse: (raw) => parseProviderJson(GoogleTranslateResponseSchema, raw, "google", "Google"),
  extractText: (data) =>
    (data.sentences || [])
      .map((s) => s.trans || "")
      .join("")
      .trim(),
});
