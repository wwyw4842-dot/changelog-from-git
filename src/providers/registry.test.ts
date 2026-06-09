import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "@shared/provider-error";
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
    const fallbackTranslate = vi.fn().mockResolvedValue(result("test-fallback-success", "回退成功"));
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
      signal: undefined,
    });
  });

  it("throws the last provider error when every provider fails", async () => {
    registerProvider(makeProvider("test-all-fail-primary", vi.fn().mockRejectedValue(new Error("first"))));
    registerProvider(makeProvider("test-all-fail-fallback", vi.fn().mockRejectedValue(new Error("last"))));

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
    translationCache.set("test-cache-hit", "en", "zh-CN", "quick", "hello", result("test-cache-hit", "cached"));

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

  it("passes AbortSignal cancellation through the provider chain", async () => {
    const controller = new AbortController();
    controller.abort();
    const translate = vi.fn((_req: TranslationRequest, ctx: ProviderContext) => {
      if (ctx.signal?.aborted) {
        throw new ProviderError({
          code: "HTTP_ERROR",
          providerId: "test-abort",
          retryable: false,
          userMessage: "aborted",
        });
      }
      return Promise.resolve(result("test-abort", "unused"));
    });
    registerProvider(makeProvider("test-abort", translate));

    await expect(
      translateViaChain(baseRequest, {
        primary: "test-abort",
        fallback: [],
        credentialsFor: () => ({}),
        signal: controller.signal,
      })
    ).rejects.toMatchObject({
      userMessage: "aborted",
    });
    expect(translate).toHaveBeenCalledWith(baseRequest, {
      credentials: {},
      signal: controller.signal,
    });
  });
});
