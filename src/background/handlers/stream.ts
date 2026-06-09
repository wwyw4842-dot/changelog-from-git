import { getSettings } from "@shared/storage/settings";
import { mergeLlmCredentials } from "@shared/llm-credentials";
import { STREAM_PORT_NAME, type StreamRequestMessage } from "@shared/stream-protocol";
import { streamChat } from "@providers/llm/chat";
import { runTranslation } from "../translate-helper";

type LLMPromptMessage = Extract<StreamRequestMessage, { type: "llm:prompt" }>;
type TranslateStreamMessage = Extract<StreamRequestMessage, { type: "translate:stream" }>;

export function registerStreamHandler(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== STREAM_PORT_NAME) return;
    const controller = new AbortController();
    let disconnected = false;
    port.onDisconnect.addListener(() => {
      disconnected = true;
      controller.abort();
    });
    port.onMessage.addListener(async (rawMessage: unknown) => {
      const message = rawMessage as StreamRequestMessage;
      if (message.type === "translate:stream:abort") {
        controller.abort();
        return;
      }
      if (message.type === "llm:prompt") {
        await handlePromptStream(port, message, controller, () => disconnected);
        return;
      }
      if (message.type !== "translate:stream") return;
      await handleTranslationStream(port, message, controller, () => disconnected);
    });
  });
}

async function handlePromptStream(
  port: chrome.runtime.Port,
  message: LLMPromptMessage,
  controller: AbortController,
  isDisconnected: () => boolean
): Promise<void> {
  const settings = await getSettings();
  const providerId = message.payload.providerId || settings.llmProProvider || settings.deepProvider;
  try {
    let accumulated = "";
    for await (const delta of streamChat(providerId, message.payload.messages, {
      credentials: mergeLlmCredentials(providerId, settings.credentials),
      signal: controller.signal,
    })) {
      if (isDisconnected()) return;
      accumulated += delta;
      port.postMessage({
        type: "chunk",
        payload: { translatedText: accumulated, provider: providerId },
      });
    }
    if (!isDisconnected()) {
      port.postMessage({
        type: "done",
        payload: { translatedText: accumulated, provider: providerId },
      });
    }
  } catch (error) {
    postStreamError(port, error, isDisconnected);
  }
}

async function handleTranslationStream(
  port: chrome.runtime.Port,
  message: TranslateStreamMessage,
  controller: AbortController,
  isDisconnected: () => boolean
): Promise<void> {
  const request = message.payload;
  const settings = await getSettings();
  try {
    const result = await runTranslation(request, settings, {
      primaryOverride: settings.deepProvider,
      signal: controller.signal,
      onChunk: (chunk) => {
        if (!isDisconnected()) {
          port.postMessage({ type: "chunk", payload: chunk });
        }
      },
    });
    if (!isDisconnected()) {
      port.postMessage({ type: "done", payload: result });
    }
  } catch (error) {
    postStreamError(port, error, isDisconnected);
  }
}

function postStreamError(
  port: chrome.runtime.Port,
  error: unknown,
  isDisconnected: () => boolean
): void {
  if (isDisconnected()) return;
  port.postMessage({
    type: "error",
    payload: { message: error instanceof Error ? error.message : String(error) },
  });
}
