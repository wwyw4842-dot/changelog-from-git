import { useEffect, useRef, useState } from "react";
import type { TranslationResult } from "@shared/types";
import { sideUi } from "./ui";

type LatestPayload = TranslationResult & { from?: string; to?: string; ts?: number };

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

export function ChatTab() {
  const [latest, setLatest] = useState<LatestPayload | null>(null);
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    chrome.storage.local.get("latestSidePanelResult").then((res) => {
      setLatest((res.latestSidePanelResult as LatestPayload) || null);
    });
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local" || !changes.latestSidePanelResult) return;
      setLatest((changes.latestSidePanelResult.newValue as LatestPayload) || null);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
      portRef.current?.disconnect();
    };
  }, []);

  const ensurePort = () => {
    if (portRef.current) return portRef.current;
    const port = chrome.runtime.connect({ name: "polyglot-stream" });
    port.onMessage.addListener((message: { type: string; payload?: unknown }) => {
      const id = activeIdRef.current;
      if (!id) return;
      setTurns((prev) =>
        prev.map((turn) => {
          if (turn.id !== id) return turn;
          if (message.type === "chunk") {
            const chunk = message.payload as Partial<TranslationResult>;
            return { ...turn, text: chunk.translatedText || turn.text };
          }
          if (message.type === "done") {
            const done = message.payload as TranslationResult;
            return { ...turn, text: done.translatedText || turn.text, streaming: false };
          }
          if (message.type === "error") {
            const err = message.payload as { message?: string };
            return {
              ...turn,
              text: `出错：${err?.message || "unknown"}`,
              streaming: false,
            };
          }
          return turn;
        })
      );
      if (message.type === "done" || message.type === "error") {
        activeIdRef.current = null;
      }
    });
    port.onDisconnect.addListener(() => {
      portRef.current = null;
    });
    portRef.current = port;
    return port;
  };

  const ask = () => {
    if (!prompt.trim() || !latest) return;
    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now()}`;
    const question = prompt.trim();
    setTurns((prev) => [
      ...prev,
      { id: userId, role: "user", text: question },
      { id: assistantId, role: "assistant", text: "...", streaming: true },
    ]);
    setPrompt("");
    activeIdRef.current = assistantId;

    const context = [
      `原文 (${latest.from || "auto"} → ${latest.to || "zh-CN"})：${latest.originalText}`,
      `译文：${latest.translatedText}`,
      `问题：${question}`,
    ].join("\n");

    const port = ensurePort();
    port.postMessage({
      type: "translate:stream",
      payload: {
        text: context,
        from: "auto",
        to: latest.to || "zh-CN",
        mode: "deep",
      },
    });
  };

  const stop = () => {
    portRef.current?.postMessage({ type: "translate:stream:abort" });
  };

  if (!latest?.originalText) {
    return (
      <div className={sideUi.chatEmptyCard}>
        先在页面上翻译一段文本，再回来追问细节。
      </div>
    );
  }

  return (
    <div className={sideUi.chatShell}>
      <div className={sideUi.chatContextCard}>
        上下文：{latest.originalText} → {latest.translatedText}
      </div>
      <ul className={sideUi.chatTurnsList}>
        {turns.map((turn) => (
          <li
            key={turn.id}
            className={`${sideUi.chatTurnBubble} ${
              turn.role === "user" ? sideUi.chatTurnUser : sideUi.chatTurnAssistant
            }`}
          >
            <div className={sideUi.chatTurnMeta}>
              {turn.role === "user" ? "你" : "AI"}
              {turn.streaming ? ` · ${sideUi.stateStreaming}` : ""}
            </div>
            <p className={sideUi.chatTurnText}>{turn.text}</p>
          </li>
        ))}
      </ul>
      <div className={sideUi.chatComposer}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
          placeholder="对当前译文追问，例如：给 5 个同义表达"
          className={sideUi.chatComposerInputField}
        />
        <button
          onClick={ask}
          className={sideUi.chatSendButton}
        >
          发送
        </button>
        <button
          onClick={stop}
          className={sideUi.chatStopButton}
        >
          停止
        </button>
      </div>
    </div>
  );
}
