import { GeminiStreamChunkSchema } from "@shared/validation";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { createSSEProvider } from "./sse-provider";

export const geminiProvider = createSSEProvider({
  id: "gemini",
  displayName: "Google Gemini",
  description: "Gemini API，支持流式输出。",
  defaultBase: "https://generativelanguage.googleapis.com",
  defaultModel: "gemini-1.5-flash",
  missingApiKeyMessage: "Gemini 需要配置 API Key",
  errorLabel: "Gemini",
  buildEndpoint: ({ base, model, apiKey }) =>
    `${base}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
  buildHeaders: () => ({ "Content-Type": "application/json" }),
  buildBody: ({ req }) => ({
    systemInstruction: {
      role: "system",
      parts: [
        {
          text: buildSystemPrompt(req.mode, {
            ieltsMode: req.ieltsMode,
            ieltsTarget: req.ieltsTarget,
          }),
        },
      ],
    },
    contents: [{ role: "user", parts: [{ text: buildUserPrompt(req) }] }],
    generationConfig: {
      temperature: req.mode === "deep" ? 0.2 : 0,
      maxOutputTokens: 1024,
    },
  }),
  parseDelta(data) {
    try {
      const parsed = GeminiStreamChunkSchema.safeParse(JSON.parse(data));
      if (!parsed.success) return "";
      const chunk = parsed.data;
      return (chunk.candidates?.[0]?.content?.parts || []).map((part) => part.text || "").join("");
    } catch {
      return "";
    }
  },
  isAuthenticationFailure: (status) => status === 401 || status === 403,
});
