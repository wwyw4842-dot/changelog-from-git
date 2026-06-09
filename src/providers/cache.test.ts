import { describe, expect, it, beforeEach, vi } from "vitest";
import { TranslationCache } from "./cache";

describe("TranslationCache", () => {
  let cache: TranslationCache;
  beforeEach(() => {
    vi.stubGlobal("chrome", undefined);
    cache = new TranslationCache();
  });

  it("stores and retrieves entries", () => {
    cache.set("google", "en", "zh-CN", "quick", "hello", {
      originalText: "hello",
      translatedText: "你好",
      provider: "google",
    });
    const result = cache.get("google", "en", "zh-CN", "quick", "hello");
    expect(result?.translatedText).toBe("你好");
  });

  it("misses on different provider", () => {
    cache.set("google", "en", "zh-CN", "quick", "hello", {
      originalText: "hello",
      translatedText: "你好",
      provider: "google",
    });
    expect(cache.get("bing", "en", "zh-CN", "quick", "hello")).toBeNull();
  });

  it("expires after TTL", () => {
    cache.set("google", "en", "zh-CN", "quick", "hello", {
      originalText: "hello",
      translatedText: "你好",
      provider: "google",
    });
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 11 * 60 * 1000);
    expect(cache.get("google", "en", "zh-CN", "quick", "hello")).toBeNull();
    vi.restoreAllMocks();
  });

  it("clear empties map", () => {
    cache.set("google", "en", "zh-CN", "quick", "a", {
      originalText: "a",
      translatedText: "b",
      provider: "google",
    });
    cache.clear();
    expect(cache.get("google", "en", "zh-CN", "quick", "a")).toBeNull();
  });
});
