import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { disableInputEnhance, enableInputEnhance } from "./controller";
import type { Settings } from "@shared/types";

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

describe("input enhancement stream ownership", () => {
  let ports: ReturnType<typeof makePort>[];
  let first: HTMLTextAreaElement;
  let second: HTMLTextAreaElement;

  beforeEach(() => {
    vi.useFakeTimers();
    ports = [];
    vi.stubGlobal("chrome", {
      runtime: {
        connect: () => {
          const port = makePort();
          ports.push(port);
          return port.port;
        },
      },
    });
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe(): void {}
        disconnect(): void {}
      }
    );
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    document.body.innerHTML =
      '<textarea id="first">first</textarea><textarea id="second">second</textarea>';
    first = document.querySelector("#first")!;
    second = document.querySelector("#second")!;
    enableInputEnhance({ deepProvider: "test", inputEnhanceAutoExpandToolbar: true } as Settings);
    first.focus();
    (document.querySelector("[data-polyglot-input-toolbar] button") as HTMLButtonElement).click();
    expect(ports).toHaveLength(1);
  });

  afterEach(() => {
    disableInputEnhance();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("switching focus aborts the old stream without editing either target on late results", () => {
    ports[0].emit({ type: "chunk", payload: { translatedText: "partial" } });
    expect(first.value).toBe("partial");
    second.focus();
    expect(ports[0].disconnect).toHaveBeenCalledTimes(1);
    ports[0].emit({ type: "chunk", payload: { translatedText: "stale" } });
    ports[0].emit({ type: "done", payload: { translatedText: "stale" } });
    expect(first.value).toBe("first");
    expect(second.value).toBe("second");
  });

  it("editing the same input cancels the stream and preserves the newer text", () => {
    ports[0].emit({ type: "chunk", payload: { translatedText: "partial" } });
    first.value = "user edit";
    first.dispatchEvent(new Event("input", { bubbles: true }));
    expect(ports[0].disconnect).toHaveBeenCalledTimes(1);
    ports[0].emit({ type: "done", payload: { translatedText: "stale" } });
    expect(first.value).toBe("user edit");
  });

  it("does not overwrite a programmatic edit that emits no input event", () => {
    ports[0].emit({ type: "chunk", payload: { translatedText: "partial" } });
    first.value = "application edit";
    ports[0].emit({ type: "done", payload: { translatedText: "stale" } });
    expect(ports[0].disconnect).toHaveBeenCalledTimes(1);
    expect(first.value).toBe("application edit");
  });

  it("does not offer the previous input's undo when switching targets", () => {
    ports[0].emit({ type: "done", payload: { translatedText: "current" } });
    expect(document.querySelector("[data-polyglot-input-toolbar]")?.textContent).toContain("撤销");
    second.focus();
    expect(document.querySelector("[data-polyglot-input-toolbar]")?.textContent).not.toContain(
      "撤销"
    );
    expect(second.value).toBe("second");
  });

  it("disabling clears pending blur callbacks", () => {
    const schedule = vi.spyOn(window, "setTimeout");
    const cancel = vi.spyOn(window, "clearTimeout");
    first.blur();
    const blurIndex = schedule.mock.calls.findIndex(([, delay]) => delay === 120);
    expect(blurIndex).toBeGreaterThanOrEqual(0);
    const blurTimer = schedule.mock.results[blurIndex].value;
    disableInputEnhance();
    expect(cancel).toHaveBeenCalledWith(blurTimer);
    vi.advanceTimersByTime(120);
    expect(first.value).toBe("first");
  });

  it.each(["done", "error"])("disconnects a settled %s stream and ignores late chunks", (type) => {
    ports[0].emit({ type, payload: { translatedText: "current" } });
    expect(ports[0].disconnect).toHaveBeenCalledTimes(1);
    ports[0].emit({ type: "chunk", payload: { translatedText: "stale" } });
    expect(first.value).toBe(type === "done" ? "current" : "first");
  });
});
