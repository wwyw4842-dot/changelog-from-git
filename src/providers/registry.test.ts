import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TranslationRequest, TranslationResult } from "@shared/types";
import { translationCache } from "./cache";
import { registerProvider, translateViaChain } from "./registry";
import type { ProviderContext, TranslationProvider } from "./types";

const baseRequest: TranslationRequest = {
  text: " hello ",
  from: "en",
  to: "zh-CN",
  mode: "quick",
};

function makeProvider(
  id: string,
  translate: TranslationProvider["translate"]
): TranslationProvider {
  return {
    id,
    displayName: id,
    description: `${id} test provider`,
    capabilities: {
      stream: false,
      deep: false,
      needsCredentials: false,
      langs: "*",
    },
    translate,
  };
}

function result(provider: string, translatedText: string): TranslationResult {
  return {
    originalText: baseRequest.text,
    translatedText,
    provider,
  };
}

describe("translateViaChain", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    translationCache.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    translationCache.clear();
    vi.restoreAllMocks();
  });

  it("returns the primary provider result when primary succeeds", async () => {
    const primaryTranslate = vi.fn().mockResolvedValue(result("test-primary-success", "你好"));
    const fallbackTranslate = vi.fn().mockResolvedValue(result("test-fallback-unused", "fallback"));
    registerProvider(makeProvider("test-primary-success", primaryTranslate));
    registerProvider(makeProvider("test-fallback-unused", fallbackTranslate));

    const actual = await translateViaChain(baseRequest, {
      primary: "test-primary-success",
      fallback: ["test-fallback-unused"],
      credentialsFor: () => ({}),
    });

    expect(actual.translatedText).toBe("你好");
    expect(actual.provider).toBe("test-primary-success");
    expect(primaryTranslate).toHaveBeenCalledTimes(1);
    expect(fallbackTranslate).not.toHaveBeenCalled();
  });

  it("falls back when the primary provider fails", async () => {
    const primaryTranslate = vi.fn().mockRejectedValue(new Error("primary failed"));
    const fallbackTranslate = vi
      .fn()
      .mockResolvedValue(result("test-fallback-success", "回退成功"));
    registerProvider(makeProvider("test-primary-fails", primaryTranslate));
    registerProvider(makeProvider("test-fallback-success", fallbackTranslate));

    const actual = await translateViaChain(baseRequest, {
      primary: "test-primary-fails",
      fallback: ["test-fallback-success"],
      credentialsFor: (providerId) => ({ apiKey: `${providerId}-key` }),
    });

    expect(actual.translatedText).toBe("回退成功");
    expect(actual.provider).toBe("test-fallback-success");
    expect(primaryTranslate).toHaveBeenCalledTimes(1);
    expect(fallbackTranslate).toHaveBeenCalledWith(baseRequest, {
      credentials: { apiKey: "test-fallback-success-key" },
      signal: expect.any(AbortSignal),
    });
  });

  it("throws the last provider error when every provider fails", async () => {
    registerProvider(
      makeProvider("test-all-fail-primary", vi.fn().mockRejectedValue(new Error("first")))
    );
    registerProvider(
      makeProvider("test-all-fail-fallback", vi.fn().mockRejectedValue(new Error("last")))
    );

    await expect(
      translateViaChain(baseRequest, {
        primary: "test-all-fail-primary",
        fallback: ["test-all-fail-fallback"],
        credentialsFor: () => ({}),
      })
    ).rejects.toThrow("last");
  });

  it("rejects empty text without calling a provider", async () => {
    const translate = vi.fn().mockResolvedValue(result("test-empty-text", "unused"));
    registerProvider(makeProvider("test-empty-text", translate));

    await expect(
      translateViaChain(
        { ...baseRequest, text: "   " },
        {
          primary: "test-empty-text",
          fallback: [],
          credentialsFor: () => ({}),
        }
      )
    ).rejects.toMatchObject({
      code: "EMPTY_TEXT",
      providerId: "test-empty-text",
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it("returns a cached result without calling the provider", async () => {
    const translate = vi.fn().mockResolvedValue(result("test-cache-hit", "fresh"));
    registerProvider(makeProvider("test-cache-hit", translate));
    translationCache.set(
      "test-cache-hit",
      "en",
      "zh-CN",
      "quick",
      "hello",
      result("test-cache-hit", "cached")
    );

    const actual = await translateViaChain(baseRequest, {
      primary: "test-cache-hit",
      fallback: [],
      credentialsFor: () => ({}),
    });

    expect(actual).toMatchObject({
      translatedText: "cached",
      fromCache: true,
    });
    expect(translate).not.toHaveBeenCalled();
  });

  it("stops before calling providers when the request is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const translate = vi.fn().mockResolvedValue(result("test-abort", "unused"));
    registerProvider(makeProvider("test-abort", translate));

    await expect(
      translateViaChain(baseRequest, {
        primary: "test-abort",
        fallback: [],
        credentialsFor: () => ({}),
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(translate).not.toHaveBeenCalled();
  });

  it("deduplicates repeated fallback providers", async () => {
    const primaryTranslate = vi.fn().mockRejectedValue(new Error("primary failed"));
    const fallbackTranslate = vi.fn().mockResolvedValue(result("test-dedup-fallback", "一次即可"));
    registerProvider(makeProvider("test-dedup-primary", primaryTranslate));
    registerProvider(makeProvider("test-dedup-fallback", fallbackTranslate));

    const actual = await translateViaChain(baseRequest, {
      primary: "test-dedup-primary",
      fallback: ["test-dedup-fallback", "test-dedup-fallback"],
      credentialsFor: () => ({}),
    });

    expect(actual.translatedText).toBe("一次即可");
    expect(fallbackTranslate).toHaveBeenCalledTimes(1);
  });

  it("continues to fallback when a provider returns an empty translation", async () => {
    const emptyTranslate = vi.fn().mockResolvedValue(result("test-empty-result", "   "));
    const fallbackTranslate = vi.fn().mockResolvedValue(result("test-after-empty", "有结果"));
    registerProvider(makeProvider("test-empty-result", emptyTranslate));
    registerProvider(makeProvider("test-after-empty", fallbackTranslate));

    const actual = await translateViaChain(baseRequest, {
      primary: "test-empty-result",
      fallback: ["test-after-empty"],
      credentialsFor: () => ({}),
    });

    expect(actual.translatedText).toBe("有结果");
    expect(fallbackTranslate).toHaveBeenCalledTimes(1);
  });

  it("moves to the next provider after a quick-provider timeout", async () => {
    vi.useFakeTimers();
    const slowTranslate = vi.fn(
      (_req: TranslationRequest, ctx: ProviderContext) =>
        new Promise<TranslationResult>((_resolve, reject) => {
          ctx.signal?.addEventListener("abort", () => reject(ctx.signal?.reason), { once: true });
        })
    );
    const fallbackTranslate = vi.fn().mockResolvedValue(result("test-after-timeout", "超时回退"));
    registerProvider(makeProvider("test-timeout", slowTranslate));
    registerProvider(makeProvider("test-after-timeout", fallbackTranslate));

    const translation = translateViaChain(baseRequest, {
      primary: "test-timeout",
      fallback: ["test-after-timeout"],
      credentialsFor: () => ({}),
    });
    await vi.advanceTimersByTimeAsync(5_001);

    await expect(translation).resolves.toMatchObject({ translatedText: "超时回退" });
    expect(fallbackTranslate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
