import type { TranslationRequest, TranslationResult } from "./types";

/**
 * "polyglot-stream" Port 两端共用的消息协议。
 * 之前后台和各侧边栏页面各自声明 `{ type: string; payload?: unknown }`
 * 再手工断言，协议一改就两边漂移；集中定义后两端都走判别联合收窄。
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 客户端 → 后台 */
export type StreamRequestMessage =
  | { type: "translate:stream"; payload: TranslationRequest }
  | { type: "translate:stream:abort" }
  | { type: "llm:prompt"; payload: { providerId?: string; messages: ChatMessage[] } };

/** 后台 → 客户端 */
export type StreamEventMessage =
  | { type: "chunk"; payload: Partial<TranslationResult> }
  | { type: "done"; payload: TranslationResult }
  | { type: "error"; payload: { message: string } };

export const STREAM_PORT_NAME = "polyglot-stream";
