import { addHistory } from "@shared/storage/history";
import { getSettings } from "@shared/storage/settings";
import { mergeLlmCredentials } from "@shared/llm-credentials";
import { translateViaChain } from "@providers/registry";
import { streamChat, type ChatMessage } from "@providers/llm/chat";

interface StreamRequestMessage {
  type: "translate:stream";
  payload: import("@shared/types").TranslationRequest;
}
interface StreamAbortMessage {
  type: "translate:stream:abort";
}
interface LLMPromptMessage {
  type: "llm:prompt";
  payload: {
    providerId?: string;
    messages: ChatMessage[];
  };
}
type StreamPortMessage = StreamRequestMessage | StreamAbortMessage | LLMPromptMessage;

export function registerStreamHandler(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "polyglot-stream") return;
    const controller = new AbortController();
    let disconnected = false;
    port.onDisconnect.addListener(() => {
      disconnected = true;
      controller.abort();
    });
    port.onMessage.addListener(async (rawMessage: unknown) => {
      const message = rawMessage as StreamPortMessage;
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
  message: StreamRequestMessage,
  controller: AbortController,
  isDisconnected: () => boolean
): Promise<void> {
  const request = message.payload;
  const settings = await getSettings();
  try {
    const result = await translateViaChain(request, {
      primary: request.providerId || settings.deepProvider || settings.primaryProvider,
      fallback: settings.fallbackChain,
      credentialsFor: (id) => mergeLlmCredentials(id, settings.credentials),
      signal: controller.signal,
      onChunk: (chunk) => {
        if (!isDisconnected()) {
          port.postMessage({ type: "chunk", payload: chunk });
        }
      },
    });
    await addHistory({ ...result, from: request.from, to: request.to, ts: Date.now() });
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
