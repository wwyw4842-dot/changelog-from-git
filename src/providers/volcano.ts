import { VolcanoResponseSchema, parseProviderJson } from "@shared/validation";
import { mapLang } from "./lang-mapper";
import { createRestProvider } from "./rest-provider";

/**
 * 火山翻译公开 Web 端点（不需要鉴权 Key）。
 * 国内网络通常比 Google 稳定，中文翻译质量优。
 */
export const volcanoProvider = createRestProvider({
  id: "volcano",
  displayName: "火山翻译",
  description: "字节跳动火山翻译 Web 接口，国内稳定，中文表现佳。",
  errorLabel: "Volcano",
  buildRequest(text, req) {
    return {
      url: "https://translate.volcengine.com/crx/translate/v1/",
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          text,
          source_language: req.from === "auto" ? "" : mapLang("volcano", req.from),
          target_language: mapLang("volcano", req.to),
        }),
      },
    };
  },
  parseResponse: (raw) => parseProviderJson(VolcanoResponseSchema, raw, "volcano", "Volcano"),
  extractText: (data) => data.translation,
  emptyResultMessage: (data) => data.message || undefined,
});
