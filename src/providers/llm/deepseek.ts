import { parseChatCompletionsDelta } from "./delta-parsers";
import { buildChatCompletionsBody, createSSEProvider } from "./sse-provider";

export const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com/v1";
export const DEEPSEEK_FLASH_MODEL = "deepseek-v4-flash";
export const DEEPSEEK_PRO_MODEL = "deepseek-v4-pro";

export function createDeepseekProvider(options: {
  id: string;
  displayName: string;
  defaultModel: string;
}) {
  return createSSEProvider({
    id: options.id,
    displayName: options.displayName,
    description: "DeepSeek V4 官方 API（OpenAI 兼容 /chat/completions，支持流式与深度 JSON）。",
    defaultBase: DEEPSEEK_DEFAULT_BASE,
    defaultModel: options.defaultModel,
    missingApiKeyMessage: "DeepSeek 需要配置 API Key",
    errorLabel: "DeepSeek",
    buildEndpoint: ({ base }) => `${base}/chat/completions`,
    buildHeaders: ({ apiKey }) => ({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }),
    buildBody: buildChatCompletionsBody,
    parseDelta: parseChatCompletionsDelta,
    isAuthenticationFailure: (status) => status === 401,
  });
}

export const deepseekProvider = createDeepseekProvider({
  id: "deepseek",
  displayName: "DeepSeek (V4 Flash)",
  defaultModel: DEEPSEEK_FLASH_MODEL,
});

export const deepseekReasonProvider = createDeepseekProvider({
  id: "deepseek-reason",
  displayName: "DeepSeek (V4 Pro)",
  defaultModel: DEEPSEEK_PRO_MODEL,
});
