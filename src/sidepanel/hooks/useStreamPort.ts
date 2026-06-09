import { useCallback, useEffect, useRef } from "react";
import type { TranslationResult } from "@shared/types";
import {
  STREAM_PORT_NAME,
  type StreamEventMessage,
  type StreamRequestMessage,
} from "@shared/stream-protocol";

export interface StreamCallbacks {
  onChunk?: (chunk: Partial<TranslationResult>) => void;
  onDone?: (result: TranslationResult) => void;
  onError?: (message: string) => void;
}

/**
 * "polyglot-stream" Port 的生命周期封装。
 * 每次 open() 建一条新连接并替换旧的（旧连接断开即触发后台 abort，
 * 避免上一个请求的流继续占用 token）；组件卸载时自动断开。
 */
export function useStreamPort() {
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    return () => {
      portRef.current?.disconnect();
      portRef.current = null;
    };
  }, []);

  const open = useCallback((callbacks: StreamCallbacks) => {
    portRef.current?.disconnect();
    const port = chrome.runtime.connect({ name: STREAM_PORT_NAME });
    port.onMessage.addListener((message: StreamEventMessage) => {
      if (message.type === "chunk") {
        callbacks.onChunk?.(message.payload);
      } else if (message.type === "done") {
        callbacks.onDone?.(message.payload);
      } else if (message.type === "error") {
        callbacks.onError?.(message.payload?.message || "未知错误");
      }
    });
    port.onDisconnect.addListener(() => {
      if (portRef.current === port) portRef.current = null;
    });
    portRef.current = port;
    return port;
  }, []);

  const post = useCallback((message: StreamRequestMessage) => {
    portRef.current?.postMessage(message);
  }, []);

  const abort = useCallback(() => {
    portRef.current?.postMessage({ type: "translate:stream:abort" });
  }, []);

  /** 一次性发起 LLM prompt 流（最常见的用法糖） */
  const startPrompt = useCallback(
    (
      messages: { role: "system" | "user" | "assistant"; content: string }[],
      callbacks: StreamCallbacks
    ) => {
      open(callbacks);
      post({ type: "llm:prompt", payload: { messages } });
    },
    [open, post]
  );

  return { open, post, abort, startPrompt };
}
