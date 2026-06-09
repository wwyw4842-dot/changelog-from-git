import { ChatCompletionStreamChunkSchema } from "@shared/validation";
import { buildChatCompletionsBody, createSSEProvider } from "./sse-provider";

export function createDeepseekProvider(options: {
  id: string;
  displayName: string;
  defaultModel: string;
}) {
  return createSSEProvider({
    id: options.id,
    displayName: options.displayName,
    description: "DeepSeek 官方 API（OpenAI 兼容 /chat/completions，支持流式与深度 JSON）。",
    defaultBase: "https://api.deepseek.com/v1",
    defaultModel: options.defaultModel,
    missingApiKeyMessage: "DeepSeek 需要配置 API Key",
    errorLabel: "DeepSeek",
    buildEndpoint: ({ base }) => `${base}/chat/completions`,
    buildHeaders: ({ apiKey }) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
    buildBody: buildChatCompletionsBody,
    parseDelta(data) {
      try {
        const parsed = ChatCompletionStreamChunkSchema.safeParse(JSON.parse(data));
        if (!parsed.success) return "";
        const chunk = parsed.data;
        return chunk.choices?.[0]?.delta?.content ?? "";
      } catch {
        return "";
      }
    },
    isAuthenticationFailure: (status) => status === 401,
  });
}

export const deepseekProvider = createDeepseekProvider({
  id: "deepseek",
  displayName: "DeepSeek (Chat)",
  defaultModel: "deepseek-chat",
});

export const deepseekReasonProvider = createDeepseekProvider({
  id: "deepseek-reason",
  displayName: "DeepSeek (Reasoner)",
  defaultModel: "deepseek-reasoner",
});
