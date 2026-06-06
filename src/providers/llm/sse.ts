import { ProviderError } from "@shared/provider-error";

/**
 * Minimal Server-Sent-Events line reader over a Response body.
 * Yields raw data payloads (one per `data:` line), skipping comments and `[DONE]`.
 */
export async function* readSSE(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (!response.body) {
    throw new ProviderError({
      code: "RESPONSE_BODY_UNAVAILABLE",
      retryable: true,
      userMessage: "Response body not available",
    });
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel().catch(() => undefined);
        return;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const rawLine = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1);
        const line = rawLine.trim();
        if (!line || line.startsWith(":")) continue;
        if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          yield data;
        }
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      const data = tail.slice(5).trim();
      if (data && data !== "[DONE]") yield data;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Read plain JSON lines (used by Ollama) from a streaming body.
 */
export async function* readJSONLines(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<string, void, unknown> {
  if (!response.body) {
    throw new ProviderError({
      code: "RESPONSE_BODY_UNAVAILABLE",
      retryable: true,
      userMessage: "Response body not available",
    });
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel().catch(() => undefined);
        return;
      }
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf("\n")) >= 0) {
        const raw = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (raw) yield raw;
      }
    }
    const tail = buffer.trim();
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}
