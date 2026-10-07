import { afterEach, describe, expect, it, vi } from "vitest";
import { createBubbleHost } from "../src/content/bubble/BubbleHost";

const render = vi.hoisted(() => vi.fn());
vi.mock("react-dom/client", () => ({ createRoot: () => ({ render }) }));

describe("bubble dismissal cancellation", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    document.getElementById("__polyglot_host__")?.remove();
    render.mockClear();
    vi.unstubAllGlobals();
  });

  it.each(["programmatic", "close button"])("cancels pending work on %s dismissal", (mode) => {
    vi.stubGlobal(
      "CSSStyleSheet",
      class {
        replaceSync(): void {}
      }
    );
    const cancel = vi.fn();
    const host = createBubbleHost(cancel);
    if (mode === "programmatic") host.hide();
    else render.mock.calls[0][0].props.onClose();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(host.isVisible()).toBe(false);
  });
});
