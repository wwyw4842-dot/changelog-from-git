import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageEnvelope, MessageResponse, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { MessageRouter } from "./messaging";

type RuntimeListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | undefined;

describe("MessageRouter", () => {
  let listener: RuntimeListener | undefined;
  let sendResponse: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listener = undefined;
    sendResponse = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: {
        onMessage: {
          addListener: vi.fn((callback: RuntimeListener) => {
            listener = callback;
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function dispatch(message: MessageEnvelope): Promise<MessageResponse> {
    expect(listener).toBeDefined();
    listener?.(message, {}, sendResponse);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledTimes(1));
    return sendResponse.mock.calls[0][0] as MessageResponse;
  }

  it("handles a registered message successfully", async () => {
    const router = new MessageRouter();
    const handler = vi.fn((): Settings => ({ ...DEFAULT_SETTINGS, targetLang: "ja" }));
    router.on("settings:get", handler);
    router.attach();

    const response = await dispatch({ type: "settings:get" });

    expect(handler).toHaveBeenCalledWith(undefined, {});
    expect(response.ok).toBe(true);
    expect(response.data).toMatchObject({ targetLang: "ja" });
  });

  it("returns an error for an unknown type", async () => {
    const router = new MessageRouter();
    router.attach();

    const didKeepChannelOpen = listener?.({ type: "unknown:type" }, {}, sendResponse);

    expect(didKeepChannelOpen).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: false,
      error: "Unsupported type: unknown:type",
    });
  });

  it("returns handler errors as failed responses", async () => {
    const router = new MessageRouter();
    router.on("settings:get", () => {
      throw new Error("handler failed");
    });
    router.attach();

    const response = await dispatch({ type: "settings:get" });

    expect(response).toEqual({
      ok: false,
      error: "handler failed",
    });
  });
});
