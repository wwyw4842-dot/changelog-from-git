import {
  ChatCompletionStreamChunkSchema,
  ClaudeStreamChunkSchema,
  GeminiStreamChunkSchema,
  OllamaChatChunkSchema,
} from "@shared/validation";

/**
 * 各 LLM 流式协议的增量文本解析器。
 * 翻译 provider（openai.ts / claude.ts / gemini.ts / ollama.ts）和
 * 自由对话（chat.ts）共用，保证两条链路对同一协议的解析一致。
 * 输入是单条 SSE data / JSON line，解析失败一律返回空串跳过。
 */

export function parseChatCompletionsDelta(data: string): string {
  try {
    const parsed = ChatCompletionStreamChunkSchema.safeParse(JSON.parse(data));
    if (!parsed.success) return "";
    return parsed.data.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

export function parseClaudeDelta(data: string): string {
  try {
    const parsed = ClaudeStreamChunkSchema.safeParse(JSON.parse(data));
    if (!parsed.success) return "";
    const chunk = parsed.data;
    if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
      return chunk.delta.text || "";
    }
    return "";
  } catch {
    return "";
  }
}

export function parseGeminiDelta(data: string): string {
  try {
    const parsed = GeminiStreamChunkSchema.safeParse(JSON.parse(data));
    if (!parsed.success) return "";
    return (parsed.data.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("");
  } catch {
    return "";
  }
}

/** Ollama 是 JSON Lines 而非 SSE；done=true 时返回哨兵让调用方停止 */
export function parseOllamaDelta(line: string): { text: string; done: boolean } {
  try {
    const parsed = OllamaChatChunkSchema.safeParse(JSON.parse(line));
    if (!parsed.success) return { text: "", done: false };
    return { text: parsed.data.message?.content || "", done: Boolean(parsed.data.done) };
  } catch {
    return { text: "", done: false };
  }
}
