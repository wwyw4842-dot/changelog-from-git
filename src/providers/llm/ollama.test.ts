import { afterEach, describe, expect, it, vi } from "vitest";
import type { TranslationResult } from "@shared/types";
import { isAsyncIterable, type ProviderResponse } from "../types";
import {
  DEFAULT_OLLAMA_BASE,
  DEFAULT_OLLAMA_MODEL,
  ollamaProvider,
  resetOllamaBaseDetectionForTests,
} from "./ollama";

const request = {
  text: "automate",
  from: "en",
  to: "zh-CN",
  mode: "quick" as const,
};

async function collect(response: ProviderResponse): Promise<Array<Partial<TranslationResult>>> {
  if (!isAsyncIterable<Partial<TranslationResult>>(response)) {
    return [response];
  }
  const chunks: Array<Partial<TranslationResult>> = [];
  for await (const chunk of response) chunks.push(chunk);
  return chunks;
}

afterEach(() => {
  resetOllamaBaseDetectionForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ollamaProvider", () => {
  it("uses the bundled small Qwen defaults and returns a streamed translation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"version":"0.32.6"}'))
      .mockResolvedValueOnce(
        new Response(
          [
            JSON.stringify({ message: { content: "自动化" }, done: false }),
            JSON.stringify({ done: true }),
          ].join("\n")
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const chunks = await collect(await ollamaProvider.translate(request, { credentials: {} }));

    expect(chunks.at(-1)).toMatchObject({ translatedText: "自动化", provider: "ollama" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(`${DEFAULT_OLLAMA_BASE}/api/chat`);
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: DEFAULT_OLLAMA_MODEL,
      keep_alive: "30m",
      options: { temperature: 0.1 },
      stream: true,
    });
  });

  it("honors an explicitly configured local address and model", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(`${JSON.stringify({ message: { content: "翻译" }, done: true })}\n`)
      );
    vi.stubGlobal("fetch", fetchMock);

    await collect(
      await ollamaProvider.translate(request, {
        credentials: { apiBase: "http://localhost:9999/", model: "custom-qwen" },
      })
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:9999/api/chat");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "custom-qwen" });
  });

  it("explains when the configured local model is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"version":"0.32.6"}'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "model not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      collect(await ollamaProvider.translate(request, { credentials: {} }))
    ).rejects.toMatchObject({
      code: "HTTP_ERROR",
      providerId: "ollama",
      message: expect.stringContaining(DEFAULT_OLLAMA_MODEL),
    });
  });

  it("asks the user to start Ollama when the daemon is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(
      collect(await ollamaProvider.translate(request, { credentials: {} }))
    ).rejects.toMatchObject({
      code: "HTTP_ERROR",
      providerId: "ollama",
      message: "本地 Qwen 不可用，请先启动 Ollama。",
    });
  });

  it("treats an empty Ollama stream as a failed translation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"version":"0.32.6"}'))
      .mockResolvedValueOnce(new Response('{"done":true}\n'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      collect(await ollamaProvider.translate(request, { credentials: {} }))
    ).rejects.toMatchObject({
      code: "EMPTY_RESULT",
      providerId: "ollama",
    });
  });

  it("detects the native 11435 service when the standard port is unavailable", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("connection refused"))
      .mockResolvedValueOnce(new Response('{"version":"0.32.6"}'))
      .mockResolvedValueOnce(
        new Response(`${JSON.stringify({ message: { content: "离线翻译" }, done: true })}\n`)
      );
    vi.stubGlobal("fetch", fetchMock);

    const chunks = await collect(await ollamaProvider.translate(request, { credentials: {} }));

    expect(chunks.at(-1)).toMatchObject({ translatedText: "离线翻译" });
    expect(fetchMock.mock.calls[2]?.[0]).toBe("http://127.0.0.1:11435/api/chat");
  });
});
