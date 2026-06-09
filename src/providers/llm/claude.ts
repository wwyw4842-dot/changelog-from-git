import { parseClaudeDelta } from "./delta-parsers";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { createSSEProvider } from "./sse-provider";

export const claudeProvider = createSSEProvider({
  id: "claude",
  displayName: "Anthropic Claude",
  description: "Anthropic Messages API，流式输出。",
  defaultBase: "https://api.anthropic.com",
  defaultModel: "claude-3-5-haiku-latest",
  missingApiKeyMessage: "Claude 需要配置 API Key",
  errorLabel: "Claude",
  buildEndpoint: ({ base }) => `${base}/v1/messages`,
  buildHeaders: ({ apiKey }) => ({
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
    "Content-Type": "application/json",
  }),
  buildBody: ({ model, req }) => ({
    model,
    stream: true,
    max_tokens: 1024,
    system: buildSystemPrompt(req.mode, {
      ieltsMode: req.ieltsMode,
      ieltsTarget: req.ieltsTarget,
    }),
    messages: [{ role: "user", content: buildUserPrompt(req) }],
  }),
  parseDelta: parseClaudeDelta,
  isAuthenticationFailure: (status) => status === 401,
});
