import { describe, expect, it } from "vitest";
import { readSSE } from "./sse";

function responseFromChunks(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    })
  );
}

async function collect(response: Response, signal?: AbortSignal): Promise<string[]> {
  const values: string[] = [];
  for await (const value of readSSE(response, signal)) {
    values.push(value);
  }
  return values;
}

describe("readSSE", () => {
  it("parses normal SSE data lines", async () => {
    const values = await collect(
      responseFromChunks([
        ": comment\n",
        "event: ignored\n",
        "data: {\"delta\":\"hello\"}\n\n",
        "data: {\"delta\":\"world\"}\n",
      ])
    );

    expect(values).toEqual(['{"delta":"hello"}', '{"delta":"world"}']);
  });

  it("stops when [DONE] is received", async () => {
    const values = await collect(
      responseFromChunks(["data: first\n", "data: [DONE]\n", "data: ignored\n"])
    );

    expect(values).toEqual(["first"]);
  });

  it("handles SSE lines split across chunks", async () => {
    const values = await collect(responseFromChunks(["data: {\"d", "elta\":\"split\"}\n"]));

    expect(values).toEqual(['{"delta":"split"}']);
  });

  it("stops reading after abort", async () => {
    const controller = new AbortController();
    const response = responseFromChunks(["data: before-abort\n", "data: after-abort\n"]);
    const values: string[] = [];

    for await (const value of readSSE(response, controller.signal)) {
      values.push(value);
      controller.abort();
    }

    expect(values).toEqual(["before-abort"]);
  });
});
