import { ProviderError } from "@shared/provider-error";
import {
  ChatCompletionStreamChunkSchema,
  ClaudeStreamChunkSchema,
  GeminiStreamChunkSchema,
  OllamaChatChunkSchema,
} from "@shared/validation";
import type { ProviderContext } from "../types";
import { readSSE, readJSONLines } from "./sse";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type LLMProviderId =
  | "openai"
  | "claude"
  | "gemini"
  | "ollama"
  | "deepseek"
  | "deepseek-reason";

export async function* streamChat(
  providerId: string,
  messages: ChatMessage[],
  ctx: ProviderContext
): AsyncGenerator<string, void, unknown> {
  switch (providerId) {
    case "openai":
      yield* streamOpenAI(messages, ctx);
      return;
    case "deepseek":
      yield* streamDeepSeek(messages, ctx, {
        defaultBase: "https://api.deepseek.com/v1",
        defaultModel: "deepseek-chat",
      });
      return;
    case "deepseek-reason":
      yield* streamDeepSeek(messages, ctx, {
        defaultBase: "https://api.deepseek.com/v1",
        defaultModel: "deepseek-reasoner",
      });
      return;
    case "claude":
      yield* streamClaude(messages, ctx);
      return;
    case "gemini":
      yield* streamGemini(messages, ctx);
      return;
    case "ollama":
      yield* streamOllama(messages, ctx);
      return;
    default:
      throw new ProviderError({
        code: "UNSUPPORTED_PROVIDER",
        providerId,
        retryable: false,
        userMessage: `Provider ${providerId} does not support freeform chat`,
      });
  }
}

async function* streamOpenAI(
  messages: ChatMessage[],
  ctx: ProviderContext
): AsyncGenerator<string, void, unknown> {
  const apiKey = ctx.credentials?.apiKey?.trim();
  if (!apiKey) throw missingCredentials("openai", "OpenAI 需要配置 API Key");
  const base = (ctx.credentials?.apiBase?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = ctx.credentials?.model?.trim() || "gpt-4o-mini";
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: ctx.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, stream: true, temperature: 0.4, messages }),
  });
  if (!response.ok) {
    if (response.status === 401)
      throw authenticationFailure("openai", response.status, "OpenAI authentication failed");
    throw httpError("openai", response.status, `OpenAI ${response.status}`);
  }
  for await (const data of readSSE(response, ctx.signal)) {
    try {
      const parsed = ChatCompletionStreamChunkSchema.safeParse(JSON.parse(data));
      if (!parsed.success) continue;
      const chunk = parsed.data;
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) yield delta;
    } catch {
      // ignore
    }
  }
}

async function* streamDeepSeek(
  messages: ChatMessage[],
  ctx: ProviderContext,
  opts: { defaultBase: string; defaultModel: string }
): AsyncGenerator<string, void, unknown> {
  const apiKey = ctx.credentials?.apiKey?.trim();
  if (!apiKey) throw missingCredentials("deepseek", "DeepSeek 需要配置 API Key");
  const base = (ctx.credentials?.apiBase?.trim() || opts.defaultBase).replace(/\/$/, "");
  const model = ctx.credentials?.model?.trim() || opts.defaultModel;
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    signal: ctx.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, stream: true, temperature: 0.4, messages }),
  });
  if (!response.ok) {
    if (response.status === 401)
      throw authenticationFailure("deepseek", response.status, "DeepSeek authentication failed");
    throw httpError("deepseek", response.status, `DeepSeek ${response.status}`);
  }
  for await (const data of readSSE(response, ctx.signal)) {
    try {
      const parsed = ChatCompletionStreamChunkSchema.safeParse(JSON.parse(data));
      if (!parsed.success) continue;
      const chunk = parsed.data;
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) yield delta;
    } catch {
      // ignore
    }
  }
}

async function* streamClaude(
  messages: ChatMessage[],
  ctx: ProviderContext
): AsyncGenerator<string, void, unknown> {
  const apiKey = ctx.credentials?.apiKey?.trim();
  if (!apiKey) throw missingCredentials("claude", "Claude 需要配置 API Key");
  const base = (ctx.credentials?.apiBase?.trim() || "https://api.anthropic.com").replace(/\/$/, "");
  const model = ctx.credentials?.model?.trim() || "claude-3-5-haiku-latest";
  const system = messages.find((m) => m.role === "system")?.content || "";
  const userMessages = messages.filter((m) => m.role !== "system");
  const response = await fetch(`${base}/v1/messages`, {
    method: "POST",
    signal: ctx.signal,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: 2048,
      system,
      messages: userMessages,
    }),
  });
  if (!response.ok) {
    if (response.status === 401)
      throw authenticationFailure("claude", response.status, "Claude authentication failed");
    throw httpError("claude", response.status, `Claude ${response.status}`);
  }
  for await (const data of readSSE(response, ctx.signal)) {
    try {
      const parsed = ClaudeStreamChunkSchema.safeParse(JSON.parse(data));
      if (!parsed.success) continue;
      const chunk = parsed.data;
      if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
        const text = chunk.delta.text || "";
        if (text) yield text;
      }
    } catch {
      // ignore
    }
  }
}

async function* streamGemini(
  messages: ChatMessage[],
  ctx: ProviderContext
): AsyncGenerator<string, void, unknown> {
  const apiKey = ctx.credentials?.apiKey?.trim();
  if (!apiKey) throw missingCredentials("gemini", "Gemini 需要配置 API Key");
  const base = (
    ctx.credentials?.apiBase?.trim() || "https://generativelanguage.googleapis.com"
  ).replace(/\/$/, "");
  const model = ctx.credentials?.model?.trim() || "gemini-1.5-flash";
  const system = messages.find((m) => m.role === "system")?.content || "";
  const userMessages = messages.filter((m) => m.role !== "system");
  const url = `${base}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    signal: ctx.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { role: "system", parts: [{ text: system }] } : undefined,
      contents: userMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw authenticationFailure("gemini", response.status, "Gemini authentication failed");
    }
    throw httpError("gemini", response.status, `Gemini ${response.status}`);
  }
  for await (const data of readSSE(response, ctx.signal)) {
    try {
      const parsed = GeminiStreamChunkSchema.safeParse(JSON.parse(data));
      if (!parsed.success) continue;
      const chunk = parsed.data;
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.text) yield part.text;
      }
    } catch {
      // ignore
    }
  }
}

async function* streamOllama(
  messages: ChatMessage[],
  ctx: ProviderContext
): AsyncGenerator<string, void, unknown> {
  const base = (ctx.credentials?.apiBase?.trim() || "http://localhost:11434").replace(/\/$/, "");
  const model = ctx.credentials?.model?.trim() || "qwen2.5:7b";
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    signal: ctx.signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: true, messages }),
  });
  if (!response.ok) throw httpError("ollama", response.status, `Ollama ${response.status}`);
  for await (const line of readJSONLines(response, ctx.signal)) {
    try {
      const parsed = OllamaChatChunkSchema.safeParse(JSON.parse(line));
      if (!parsed.success) continue;
      const chunk = parsed.data;
      const text = chunk.message?.content || "";
      if (text) yield text;
      if (chunk.done) break;
    } catch {
      // ignore
    }
  }
}

function missingCredentials(providerId: string, userMessage: string): ProviderError {
  return new ProviderError({
    code: "MISSING_CREDENTIALS",
    providerId,
    retryable: false,
    userMessage,
  });
}

function authenticationFailure(
  providerId: string,
  status: number,
  userMessage: string
): ProviderError {
  return new ProviderError({
    code: "AUTHENTICATION_FAILURE",
    providerId,
    status,
    retryable: false,
    userMessage,
  });
}

function httpError(providerId: string, status: number, userMessage: string): ProviderError {
  return new ProviderError({
    code: "HTTP_ERROR",
    providerId,
    status,
    userMessage,
  });
}
