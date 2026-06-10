import type {
  ActivityDay,
  ActivityStats,
  HistoryEntry,
  MessageResponse,
  Settings,
  TranslationRequest,
  TranslationResult,
  ReviewArticleEntry,
  VocabularyEntry,
} from "./types";
import { mapChromeRuntimeError } from "./chrome-runtime-error";
import { MessageEnvelopeSchema, MessagePayloadSchemas, formatValidationError } from "./validation";

export type ChannelMap = {
  "settings:get": { req: void; resp: Settings };
  "settings:update": { req: Partial<Settings>; resp: Settings };
  "translate:request": { req: TranslationRequest; resp: TranslationResult };
  "translate:selection": {
    req: TranslationRequest & { openSidePanel?: boolean };
    resp: TranslationResult;
  };
  "history:list": { req: { limit?: number; query?: string }; resp: HistoryEntry[] };
  "history:clear": { req: void; resp: void };
  "vocabulary:add": { req: Omit<VocabularyEntry, "id" | "addedAt" | "nextReviewAt" | "easeFactor" | "interval" | "reps" | "lapses"> & Partial<VocabularyEntry>; resp: VocabularyEntry };
  "vocabulary:list": { req: { due?: boolean; limit?: number }; resp: VocabularyEntry[] };
  "vocabulary:review": { req: { id: number; quality: 0 | 1 | 2 | 3 | 4 | 5 }; resp: VocabularyEntry };
  "vocabulary:remove": { req: { id: number }; resp: void };
  "vocabulary:update": {
    req: {
      id: number;
      patch: Partial<Pick<VocabularyEntry, "addedAt" | "context" | "tags" | "phonetic" | "translation" | "word" | "examples">>;
    };
    resp: VocabularyEntry;
  };
  "vocabulary:examples:regen": { req: { id: number }; resp: VocabularyEntry };
  "reviewArticle:add": {
    req: { dayLabel: string; content: string; provider: string; words: string[] };
    resp: ReviewArticleEntry;
  };
  "reviewArticle:list": { req: { limit?: number }; resp: ReviewArticleEntry[] };
  "reviewArticle:remove": { req: { id: number }; resp: void };
  "tts:speak": { req: { text: string; lang?: string }; resp: { spoken: boolean } };
  "tts:stop": { req: void; resp: void };
  "provider:test": { req: { providerId: string }; resp: { ok: boolean; message?: string } };
  "immersive:toggle": { req: { tabId?: number; enable?: boolean }; resp: { enabled: boolean } };
  "stats:daily": { req: void; resp: ActivityStats };
  "stats:year": { req: void; resp: ActivityDay[] };
  "vocabulary:words": { req: void; resp: string[] };
};

export type Channel = keyof ChannelMap;

export async function send<K extends Channel>(
  type: K,
  payload?: ChannelMap[K]["req"]
): Promise<ChannelMap[K]["resp"]> {
  const envelope = { type, payload };
  let response: MessageResponse<ChannelMap[K]["resp"]>;
  try {
    response = (await chrome.runtime.sendMessage(envelope)) as MessageResponse<ChannelMap[K]["resp"]>;
  } catch (error) {
    throw mapChromeRuntimeError(error);
  }
  if (!response) {
    throw mapChromeRuntimeError(new Error("Could not establish connection. Receiving end does not exist."));
  }
  if (!response.ok) {
    throw mapChromeRuntimeError(new Error(response.error || "Request failed"));
  }
  return response.data as ChannelMap[K]["resp"];
}

export type ChannelHandler<K extends Channel> = (
  payload: ChannelMap[K]["req"],
  sender: chrome.runtime.MessageSender
) => Promise<ChannelMap[K]["resp"]> | ChannelMap[K]["resp"];

type AnyHandler = (payload: unknown, sender: chrome.runtime.MessageSender) => Promise<unknown> | unknown;

export class MessageRouter {
  private handlers = new Map<Channel, AnyHandler>();

  on<K extends Channel>(type: K, handler: ChannelHandler<K>): void {
    this.handlers.set(type, handler as unknown as AnyHandler);
  }

  attach(): void {
    chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
      const envelopeResult = MessageEnvelopeSchema.safeParse(message);
      if (!envelopeResult.success) {
        sendResponse({
          ok: false,
          error: `Invalid message: ${formatValidationError(envelopeResult.error)}`,
        } satisfies MessageResponse);
        return false;
      }
      const envelope = envelopeResult.data;
      const handler = this.handlers.get(envelope.type as Channel);
      if (!handler) {
        sendResponse({ ok: false, error: `Unsupported type: ${envelope.type}` });
        return false;
      }
      const payloadSchema =
        MessagePayloadSchemas[envelope.type as keyof typeof MessagePayloadSchemas];
      let payload = envelope.payload;
      if (payloadSchema) {
        const payloadResult = payloadSchema.safeParse(envelope.payload);
        if (!payloadResult.success) {
          sendResponse({
            ok: false,
            error: `Invalid payload for ${envelope.type}: ${formatValidationError(payloadResult.error)}`,
          } satisfies MessageResponse);
          return false;
        }
        payload = payloadResult.data;
      }
      Promise.resolve()
        .then(() => handler(payload, sender))
        .then((data) => sendResponse({ ok: true, data } satisfies MessageResponse))
        .catch((error) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          } satisfies MessageResponse);
        });
      return true;
    });
  }
}
