import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSelectionController } from "./selection";
import { send } from "@shared/messaging";
import type { Settings, TranslationResult } from "@shared/types";
import type { BubbleHandle } from "../bubble/BubbleHost";

vi.mock("@shared/messaging", () => ({ send: vi.fn() }));

function makePort() {
  let receive: (message: { type: string; payload?: unknown }) => void;
  let disconnected: () => void;
  const disconnect = vi.fn(() => disconnected());
  const port = {
    onMessage: { addListener: (listener: typeof receive) => (receive = listener) },
    onDisconnect: { addListener: (listener: typeof disconnected) => (disconnected = listener) },
    disconnect,
    postMessage: vi.fn(),
  } as unknown as chrome.runtime.Port;
  return { port, disconnect, emit: (message: Parameters<typeof receive>[0]) => receive(message) };
}

describe("selection stream lifecycle", () => {
  const settings = {
    targetLang: "zh-CN",
    deepProvider: "test",
    primaryProvider: "test",
  } as Settings;
  let ports: ReturnType<typeof makePort>[];
  let showCard: ReturnType<typeof vi.fn>;
  let updateStream: ReturnType<typeof vi.fn>;
  let controller: ReturnType<typeof createSelectionController>;

  beforeEach(() => {
    ports = [];
    showCard = vi.fn();
    updateStream = vi.fn();
    vi.mocked(send).mockReset();
    vi.stubGlobal("chrome", {
      runtime: {
        connect: () => {
          const port = makePort();
          ports.push(port);
          return port.port;
        },
      },
    });
    controller = createSelectionController({
      getSettings: () => settings,
      setSettings: vi.fn(),
      host: { hideTrigger: vi.fn(), updateStream } as unknown as BubbleHandle,
      isWhitelisted: () => false,
      showCard,
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("a quick request cancels an older deep stream and drops its late messages", async () => {
    await controller.translateDeep("old deep");
    vi.mocked(send).mockResolvedValue({
      originalText: "new quick",
      translatedText: "new",
      provider: "test",
    });
    await controller.translate("new quick");
    expect(ports[0].disconnect).toHaveBeenCalledTimes(1);
    showCard.mockClear();
    ports[0].emit({ type: "chunk", payload: { translatedText: "stale" } });
    ports[0].emit({ type: "done", payload: { translatedText: "stale", provider: "test" } });
    expect(updateStream).not.toHaveBeenCalled();
    expect(showCard).not.toHaveBeenCalled();
  });

  it("a late quick result cannot reopen a closed or replaced card", async () => {
    let resolve: (value: TranslationResult) => void;
    vi.mocked(send).mockImplementation(
      () => new Promise<TranslationResult>((done) => (resolve = done)) as ReturnType<typeof send>
    );
    const quick = controller.translate("quick");
    controller.cancelDeep();
    showCard.mockClear();
    resolve!({ originalText: "quick", translatedText: "stale", provider: "test" });
    await quick;
    expect(showCard).not.toHaveBeenCalled();
  });

  it.each(["done", "error"])("disconnects a settled %s stream", async (type) => {
    await controller.translateDeep("deep");
    ports[0].emit({
      type,
      payload: { translatedText: "done", provider: "test", message: "failed" },
    });
    expect(ports[0].disconnect).toHaveBeenCalledTimes(1);
    updateStream.mockClear();
    ports[0].emit({ type: "chunk", payload: { translatedText: "late" } });
    expect(updateStream).not.toHaveBeenCalled();
  });
});
