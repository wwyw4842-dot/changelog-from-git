import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MessageEnvelope, MessageResponse, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { MessageRouter, send } from "./messaging";

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

  it("rejects legacy numeric grades before storing a review", async () => {
    const router = new MessageRouter();
    const handler = vi.fn();
    router.on("vocabulary:review", handler);
    router.attach();
    const response = await dispatch({ type: "vocabulary:review", payload: { id: 1, quality: 5 } });
    expect(response.ok).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps the canonical first-save timestamp out of editable vocabulary metadata", async () => {
    const router = new MessageRouter();
    const handler = vi.fn();
    router.on("vocabulary:update", handler);
    router.attach();
    const response = await dispatch({ type: "vocabulary:update", payload: { id: 1, patch: { addedAt: 123 } } });
    expect(response.ok).toBe(false);
    expect(handler).not.toHaveBeenCalled();
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

describe("send", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["chrome 不存在", undefined],
    ["runtime 不存在", {}],
    ["runtime id 不存在", { runtime: { sendMessage: vi.fn() } }],
    ["sendMessage 不存在", { runtime: { id: "extension-id" } }],
  ])("在%s时提示刷新网页", async (_caseName, chromeApi) => {
    vi.stubGlobal("chrome", chromeApi);

    await expect(send("settings:get")).rejects.toThrow("扩展已更新，请刷新本页后再翻译。");
  });

  it("通过有效运行时发送消息", async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: { ...DEFAULT_SETTINGS, targetLang: "ja" },
    });
    vi.stubGlobal("chrome", { runtime: { id: "extension-id", sendMessage } });

    await expect(send("settings:get")).resolves.toMatchObject({ targetLang: "ja" });
    expect(sendMessage).toHaveBeenCalledWith({ type: "settings:get", payload: undefined });
  });

  it("将失效运行时的 sendMessage TypeError 转为刷新提示", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(
        new TypeError("Cannot read properties of undefined (reading 'sendMessage')")
      );
    vi.stubGlobal("chrome", { runtime: { id: "extension-id", sendMessage } });

    await expect(send("settings:get")).rejects.toThrow("扩展已更新，请刷新本页后再翻译。");
  });

  it("将 no receiver 异常转为后台连接提示", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(
        new Error("Could not establish connection. Receiving end does not exist.")
      );
    vi.stubGlobal("chrome", { runtime: { id: "extension-id", sendMessage } });

    await expect(send("settings:get")).rejects.toThrow(
      "无法连接扩展后台，请刷新本页或确认扩展已启用。"
    );
  });

  it("将空响应视为 no receiver", async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", { runtime: { id: "extension-id", sendMessage } });

    await expect(send("settings:get")).rejects.toThrow(
      "无法连接扩展后台，请刷新本页或确认扩展已启用。"
    );
  });
});
