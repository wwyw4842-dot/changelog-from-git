import { describe, it, expect, vi, afterEach } from "vitest";
import { myMemoryProvider } from "./mymemory";

const OriginalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = OriginalFetch;
  vi.restoreAllMocks();
});

describe("myMemoryProvider", () => {
  it("parses a successful response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseData: { translatedText: "你好" },
        responseStatus: 200,
      }),
    }) as unknown as typeof fetch;

    const result = await myMemoryProvider.translate(
      { text: "hello", from: "en", to: "zh-CN", mode: "quick" },
      { credentials: {} }
    );
    expect("translatedText" in result).toBe(true);
    if ("translatedText" in result) {
      expect(result.translatedText).toBe("你好");
      expect(result.provider).toBe("mymemory");
    }
  });

  it("throws on auth failure and retries anonymously on retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          responseData: { translatedText: "AUTHENTICATION FAILURE" },
          responseStatus: 403,
          responseDetails: "Invalid API KEY",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          responseData: { translatedText: "你好" },
          responseStatus: 200,
        }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await myMemoryProvider.translate(
      { text: "hello", from: "en", to: "zh-CN", mode: "quick" },
      { credentials: { apiKey: "bad" } }
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    if ("translatedText" in result) {
      expect(result.translatedText).toBe("你好");
    }
  });
});
