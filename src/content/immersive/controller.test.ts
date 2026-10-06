import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { requestTranslation } from "./request";
import { disableImmersive, enableImmersive } from "./controller";
import type { Settings, TranslationResult } from "@shared/types";

vi.mock("./request", () => ({ requestTranslation: vi.fn() }));

interface FakeEntry {
  target: Element;
  isIntersecting: boolean;
}

function result(translatedText: string): TranslationResult {
  return { originalText: "source", translatedText, provider: "test" };
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly callback: (entries: FakeEntry[]) => void;
  readonly observed = new Set<Element>();

  constructor(callback: (entries: FakeEntry[]) => void) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.add(element);
  }

  disconnect(): void {
    this.observed.clear();
  }

  trigger(elements: Element[]): void {
    this.callback(elements.map((target) => ({ target, isIntersecting: true })));
  }
}

const settings = {
  targetLang: "zh-CN",
  primaryProvider: "google",
  immersiveDefaultEngine: "google",
} as Settings;

function createParagraphs(count: number): HTMLElement[] {
  document.body.innerHTML = "";
  return Array.from({ length: count }, (_, index) => {
    const node = document.createElement("p");
    node.textContent = `Paragraph ${index} with enough text for translation.`;
    document.body.append(node);
    return node;
  });
}

describe("immersive translation lifecycle", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.mocked(requestTranslation).mockReset();
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    history.replaceState({}, "", "/immersive");
    document.body.innerHTML = "";
  });

  afterEach(() => {
    disableImmersive();
    vi.restoreAllMocks();
  });

  it("keeps observer bursts at six logical requests and drains fairly", async () => {
    const blocks = createParagraphs(18);
    let active = 0;
    let peak = 0;
    const deferred: Array<{ resolve: (value: TranslationResult) => void }> = [];
    vi.mocked(requestTranslation).mockImplementation(
      () =>
        new Promise((resolve) => {
          active += 1;
          peak = Math.max(peak, active);
          deferred.push({
            resolve: (value) => {
              active -= 1;
              resolve(value);
            },
          });
        }) as ReturnType<typeof requestTranslation>
    );

    await enableImmersive(settings);
    FakeIntersectionObserver.instances[0].trigger(blocks);
    await vi.waitFor(() => expect(deferred).toHaveLength(6));
    expect(peak).toBe(6);

    deferred.splice(0, 6).forEach(({ resolve }, index) => resolve(result(`first-${index}`)));
    await vi.waitFor(() => expect(deferred).toHaveLength(6));
    expect(peak).toBe(6);
    deferred.splice(0, 6).forEach(({ resolve }, index) => resolve(result(`second-${index}`)));
    await vi.waitFor(() => expect(deferred).toHaveLength(6));
    deferred.splice(0, 6).forEach(({ resolve }, index) => resolve(result(`third-${index}`)));
    await vi.waitFor(() => expect(requestTranslation).toHaveBeenCalledTimes(18));
  });

  it("drops stale responses after stop and re-enable", async () => {
    const [block] = createParagraphs(1);
    const deferred: Array<{ resolve: (value: TranslationResult) => void }> = [];
    vi.mocked(requestTranslation).mockImplementation(
      () =>
        new Promise((resolve) => {
          deferred.push({ resolve });
        }) as ReturnType<typeof requestTranslation>
    );

    await enableImmersive(settings);
    FakeIntersectionObserver.instances[0].trigger([block]);
    await vi.waitFor(() => expect(deferred).toHaveLength(1));
    disableImmersive();
    await enableImmersive(settings);
    FakeIntersectionObserver.instances[1].trigger([block]);
    await vi.waitFor(() => expect(deferred).toHaveLength(2));

    deferred[0].resolve(result("stale"));
    await Promise.resolve();
    expect(document.querySelector("[data-polyglot-translation-host]")).toBeNull();
    deferred[1].resolve(result("current"));
    await vi.waitFor(() =>
      expect(document.querySelector("[data-polyglot-translation-host]")?.textContent).toBe(
        "current"
      )
    );
  });

  it("restarts observation when a single page application changes URL", async () => {
    const [block] = createParagraphs(1);
    vi.mocked(requestTranslation).mockResolvedValue(result("translated"));
    await enableImmersive(settings);
    FakeIntersectionObserver.instances[0].trigger([block]);
    await vi.waitFor(() =>
      expect(document.querySelector("[data-polyglot-translation-host]")).not.toBeNull()
    );

    history.pushState({}, "", "/immersive/next");
    FakeIntersectionObserver.instances[0].trigger([]);
    expect(FakeIntersectionObserver.instances).toHaveLength(2);
    expect(document.querySelector("[data-polyglot-translation-host]")).toBeNull();
  });

  it("retries transient provider failures without leaving a block stuck", async () => {
    const [block] = createParagraphs(1);
    vi.mocked(requestTranslation)
      .mockRejectedValueOnce(new Error("429 rate limit"))
      .mockResolvedValue(result("recovered"));
    await enableImmersive(settings);
    FakeIntersectionObserver.instances[0].trigger([block]);
    await vi.waitFor(() => expect(requestTranslation).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 180));
    await vi.waitFor(() =>
      expect(document.querySelector("[data-polyglot-translation-host]")?.textContent).toBe(
        "recovered"
      )
    );
    expect(requestTranslation).toHaveBeenCalledTimes(2);
  });
});
