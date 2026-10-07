import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranslationRequest, TranslationResult } from "@shared/types";
import type { TranslateViaChainOptions } from "@providers/registry";

const mocks = vi.hoisted(() => ({
  translate: vi.fn(),
  history: vi.fn(),
  settings: vi.fn(),
}));
vi.mock("@providers/registry", () => ({ translateViaChain: mocks.translate }));
vi.mock("@shared/storage/history", () => ({ addHistory: mocks.history }));
vi.mock("@shared/storage/settings", () => ({ getSettings: mocks.settings }));
vi.mock("@shared/llm-credentials", () => ({ mergeLlmCredentials: () => ({}) }));
vi.mock("@providers/llm/chat", () => ({ streamChat: vi.fn() }));

interface FakePort {
  port: chrome.runtime.Port;
  send: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  disconnect: () => void;
  posted: ReturnType<typeof vi.fn>;
}

interface PendingRequest {
  request: TranslationRequest;
  options: TranslateViaChainOptions;
  resolve: () => void;
}

let connect: (port: chrome.runtime.Port) => void;
let pending: PendingRequest[];

function makePort(): FakePort {
  let receive: (message: unknown) => Promise<void>;
  let disconnect: () => void;
  const posted = vi.fn();
  const port = {
    name: "polyglot-stream",
    onMessage: { addListener: (listener: typeof receive) => (receive = listener) },
    onDisconnect: { addListener: (listener: typeof disconnect) => (disconnect = listener) },
    postMessage: posted,
  } as unknown as chrome.runtime.Port;
  connect(port);
  return {
    port,
    posted,
    send: (text) =>
      receive({
        type: "translate:stream",
        payload: { text, from: "en", to: "zh-CN", mode: "deep" },
      }),
    abort: () => receive({ type: "translate:stream:abort" }),
    disconnect: () => disconnect(),
  };
}

describe("stream request ownership and cancellation", () => {
  beforeEach(async () => {
    vi.resetModules();
    pending = [];
    mocks.history.mockReset().mockResolvedValue(undefined);
    mocks.settings.mockReset().mockResolvedValue({
      deepProvider: "test",
      fallbackChain: [],
      credentials: {},
    });
    mocks.translate.mockReset().mockImplementation(
      (request: TranslationRequest, options: TranslateViaChainOptions) =>
        new Promise<TranslationResult>((resolve) => {
          pending.push({
            request,
            options,
            resolve: () =>
              resolve({
                originalText: request.text,
                translatedText: `${request.text}-translated`,
                provider: "test",
              }),
          });
        })
    );
    vi.stubGlobal("chrome", {
      runtime: { onConnect: { addListener: (listener: typeof connect) => (connect = listener) } },
    });
    const { registerStreamHandler } = await import("./stream");
    registerStreamHandler();
  });

  afterEach(() => {
    pending.forEach((request) => request.resolve());
    vi.unstubAllGlobals();
  });

  it("disconnect aborts the provider and drops its late result and history", async () => {
    const port = makePort();
    const task = port.send("disconnected");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    port.disconnect();
    expect(pending[0].options.signal?.aborted).toBe(true);
    pending[0].options.onChunk?.({ translatedText: "late" });
    pending[0].resolve();
    await task;
    expect(port.posted).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("explicit abort suppresses late results even before the port disconnects", async () => {
    const port = makePort();
    const task = port.send("aborted");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    await port.abort();
    expect(pending[0].options.signal?.aborted).toBe(true);
    pending[0].options.onChunk?.({ translatedText: "late" });
    pending[0].resolve();
    await task;
    expect(port.posted).not.toHaveBeenCalled();
    expect(mocks.history).not.toHaveBeenCalled();
  });

  it("replacing a request on one port gives the new request its own signal", async () => {
    const port = makePort();
    const first = port.send("first");
    await vi.waitFor(() => expect(pending).toHaveLength(1));
    const second = port.send("second");
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0].options.signal?.aborted).toBe(true);
    expect(pending[1].options.signal?.aborted).toBe(false);
    pending[0].resolve();
    await first;
    expect(port.posted).not.toHaveBeenCalled();
    pending[1].resolve();
    await second;
    expect(port.posted).toHaveBeenCalledTimes(1);
    expect(port.posted).toHaveBeenCalledWith({
      type: "done",
      payload: { originalText: "second", translatedText: "second-translated", provider: "test" },
    });
    expect(mocks.history).toHaveBeenCalledTimes(1);
  });

  it("holds cancelled provider leases until settlement and removes queued disconnects", async () => {
    const ports = Array.from({ length: 8 }, makePort);
    const tasks = ports.map((port, index) => port.send(`request-${index}`));
    await vi.waitFor(() => expect(pending).toHaveLength(6));
    ports[0].disconnect();
    ports[6].disconnect();
    await tasks[6];
    expect(pending[0].options.signal?.aborted).toBe(true);
    expect(pending).toHaveLength(6);
    pending[0].resolve();
    await tasks[0];
    await vi.waitFor(() => expect(pending).toHaveLength(7));
    expect(pending[6].request.text).toBe("request-7");
    pending.slice(1).forEach((request) => request.resolve());
    await Promise.all(tasks);
    expect(mocks.history).toHaveBeenCalledTimes(6);
  });
});
