import { parseChatCompletionsDelta } from "./delta-parsers";
import { buildChatCompletionsBody, createSSEProvider } from "./sse-provider";

export const MIMO_DEFAULT_BASE = "https://api.xiaomimimo.com/v1";
export const MIMO_FLASH_MODEL = "mimo-v2.5";
export const MIMO_PRO_MODEL = "mimo-v2.5-pro";

export function createMimoProvider(options: {
  id: string;
  displayName: string;
  defaultModel: string;
}) {
  return createSSEProvider({
    id: options.id,
    displayName: options.displayName,
    description: "小米 MiMo 官方 API（OpenAI 兼容 /chat/completions，支持流式与深度 JSON）。",
    defaultBase: MIMO_DEFAULT_BASE,
    defaultModel: options.defaultModel,
    missingApiKeyMessage: "MiMo 需要配置 API Key",
    errorLabel: "MiMo",
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

export const mimoProvider = createMimoProvider({
  id: "mimo",
  displayName: "小米 MiMo (V2.5)",
  defaultModel: MIMO_FLASH_MODEL,
});

export const mimoProProvider = createMimoProvider({
  id: "mimo-pro",
  displayName: "小米 MiMo (V2.5 Pro)",
  defaultModel: MIMO_PRO_MODEL,
});
