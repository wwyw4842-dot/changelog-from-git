import { parseChatCompletionsDelta } from "./delta-parsers";
import { buildChatCompletionsBody, createSSEProvider } from "./sse-provider";

export const openaiProvider = createSSEProvider({
  id: "openai",
  displayName: "OpenAI GPT",
  description: "OpenAI 兼容接口（支持自定义 baseURL，可对接国内代理）。",
  defaultBase: "https://api.openai.com/v1",
  defaultModel: "gpt-4o-mini",
  missingApiKeyMessage: "OpenAI 需要配置 API Key",
  errorLabel: "OpenAI",
  buildEndpoint: ({ base }) => `${base}/chat/completions`,
  buildHeaders: ({ apiKey }) => ({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }),
  buildBody: buildChatCompletionsBody,
  parseDelta: parseChatCompletionsDelta,
  isAuthenticationFailure: (status) => status === 401,
});
