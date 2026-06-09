import { ProviderError } from "@shared/provider-error";
import type { ChatMessage } from "@shared/stream-protocol";
import type { ProviderContext } from "../types";
import {
  parseChatCompletionsDelta,
  parseClaudeDelta,
  parseGeminiDelta,
  parseOllamaDelta,
} from "./delta-parsers";
import { readSSE, readJSONLines } from "./sse";

export type { ChatMessage } from "@shared/stream-protocol";

export type LLMProviderId =
  | "openai"
  | "claude"
  | "gemini"
  | "ollama"
  | "deepseek"
  | "deepseek-reason";

interface ChatRuntime {
  apiKey: string;
  base: string;
  model: string;
}

/**
 * 每个 LLM 的自由对话适配器：只描述请求差异（端点、headers、body 结构、
 * 流协议），鉴权检查 / fetch / 错误归类 / 流读取由 streamChat 统一负责。
 */
interface ChatAdapter {
  /** 错误信息中的引擎名 */
  label: string;
  /** 不需要 API Key 的本地引擎（Ollama）置 false */
  needsKey: boolean;
  defaultBase: string;
  defaultModel: string;
  buildEndpoint(rt: ChatRuntime): string;
  buildHeaders(rt: ChatRuntime): HeadersInit;
  buildBody(rt: ChatRuntime, messages: ChatMessage[]): unknown;
  /** SSE（默认）或 Ollama 的 JSON Lines */
  protocol: "sse" | "jsonl";
  parseDelta(data: string): string;
  isAuthFailure(status: number): boolean;
}

const openAICompatible = (label: string, defaultBase: string, defaultModel: string): ChatAdapter => ({
  label,
  needsKey: true,
  defaultBase,
  defaultModel,
  buildEndpoint: ({ base }) => `${base}/chat/completions`,
  buildHeaders: ({ apiKey }) => ({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  }),
  buildBody: ({ model }, messages) => ({ model, stream: true, temperature: 0.4, messages }),
  protocol: "sse",
  parseDelta: parseChatCompletionsDelta,
  isAuthFailure: (status) => status === 401,
});

const ADAPTERS: Record<LLMProviderId, ChatAdapter> = {
  openai: openAICompatible("OpenAI", "https://api.openai.com/v1", "gpt-4o-mini"),
  deepseek: openAICompatible("DeepSeek", "https://api.deepseek.com/v1", "deepseek-chat"),
  "deepseek-reason": openAICompatible("DeepSeek", "https://api.deepseek.com/v1", "deepseek-reasoner"),
  claude: {
    label: "Claude",
    needsKey: true,
    defaultBase: "https://api.anthropic.com",
    defaultModel: "claude-3-5-haiku-latest",
    buildEndpoint: ({ base }) => `${base}/v1/messages`,
    buildHeaders: ({ apiKey }) => ({
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    }),
    buildBody: ({ model }, messages) => ({
      model,
      stream: true,
      max_tokens: 2048,
      system: messages.find((m) => m.role === "system")?.content || "",
      messages: messages.filter((m) => m.role !== "system"),
    }),
    protocol: "sse",
    parseDelta: parseClaudeDelta,
    isAuthFailure: (status) => status === 401,
  },
  gemini: {
    label: "Gemini",
    needsKey: true,
    defaultBase: "https://generativelanguage.googleapis.com",
    defaultModel: "gemini-1.5-flash",
    buildEndpoint: ({ base, model, apiKey }) =>
      `${base}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    buildHeaders: () => ({ "Content-Type": "application/json" }),
    buildBody: (_rt, messages) => {
      const system = messages.find((m) => m.role === "system")?.content || "";
      return {
        systemInstruction: system ? { role: "system", parts: [{ text: system }] } : undefined,
        contents: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
      };
    },
    protocol: "sse",
    parseDelta: parseGeminiDelta,
    isAuthFailure: (status) => status === 401 || status === 403,
  },
  ollama: {
    label: "Ollama",
    needsKey: false,
    defaultBase: "http://localhost:11434",
    defaultModel: "qwen2.5:7b",
    buildEndpoint: ({ base }) => `${base}/api/chat`,
    buildHeaders: () => ({ "Content-Type": "application/json" }),
    buildBody: ({ model }, messages) => ({ model, stream: true, messages }),
    protocol: "jsonl",
    parseDelta: (line) => parseOllamaDelta(line).text,
    isAuthFailure: () => false,
  },
};

export async function* streamChat(
  providerId: string,
  messages: ChatMessage[],
  ctx: ProviderContext
): AsyncGenerator<string, void, unknown> {
  const adapter = ADAPTERS[providerId as LLMProviderId];
  if (!adapter) {
    throw new ProviderError({
      code: "UNSUPPORTED_PROVIDER",
      providerId,
      retryable: false,
      userMessage: `Provider ${providerId} does not support freeform chat`,
    });
  }

  const apiKey = ctx.credentials?.apiKey?.trim() || "";
  if (adapter.needsKey && !apiKey) {
    throw new ProviderError({
      code: "MISSING_CREDENTIALS",
      providerId,
      retryable: false,
      userMessage: `${adapter.label} 需要配置 API Key`,
    });
  }
  const runtime: ChatRuntime = {
    apiKey,
    base: (ctx.credentials?.apiBase?.trim() || adapter.defaultBase).replace(/\/$/, ""),
    model: ctx.credentials?.model?.trim() || adapter.defaultModel,
  };

  const response = await fetch(adapter.buildEndpoint(runtime), {
    method: "POST",
    signal: ctx.signal,
    headers: adapter.buildHeaders(runtime),
    body: JSON.stringify(adapter.buildBody(runtime, messages)),
  });
  if (!response.ok) {
    if (adapter.isAuthFailure(response.status)) {
      throw new ProviderError({
        code: "AUTHENTICATION_FAILURE",
        providerId,
        status: response.status,
        retryable: false,
        userMessage: `${adapter.label} authentication failed`,
      });
    }
    throw new ProviderError({
      code: "HTTP_ERROR",
      providerId,
      status: response.status,
      userMessage: `${adapter.label} ${response.status}`,
    });
  }

  if (adapter.protocol === "jsonl") {
    for await (const line of readJSONLines(response, ctx.signal)) {
      const { text, done } = parseOllamaDelta(line);
      if (text) yield text;
      if (done) break;
    }
    return;
  }
  for await (const data of readSSE(response, ctx.signal)) {
    const delta = adapter.parseDelta(data);
    if (delta) yield delta;
  }
}
