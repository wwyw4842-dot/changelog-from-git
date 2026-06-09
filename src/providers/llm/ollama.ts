import type { TranslationResult } from "@shared/types";
import { ProviderError } from "@shared/provider-error";
import { OllamaChatChunkSchema } from "@shared/validation";
import type { TranslationProvider } from "../types";
import { buildSystemPrompt, buildUserPrompt, parseDeep } from "./prompt";
import { readJSONLines } from "./sse";

export const ollamaProvider: TranslationProvider = {
  id: "ollama",
  displayName: "Ollama (本地)",
  description: "本地部署的 Ollama，无需网络外发。",
  capabilities: { stream: true, deep: true, needsCredentials: false, langs: "*" },
  async translate(req, ctx) {
    const base = (ctx.credentials?.apiBase?.trim() || "http://localhost:11434").replace(/\/$/, "");
    const model = ctx.credentials?.model?.trim() || "qwen2.5:7b";

    async function* streamIter(): AsyncGenerator<Partial<TranslationResult>, void, unknown> {
      const response = await fetch(`${base}/api/chat`, {
        method: "POST",
        signal: ctx.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            {
              role: "system",
              content: buildSystemPrompt(req.mode, {
                ieltsMode: req.ieltsMode,
                ieltsTarget: req.ieltsTarget,
              }),
            },
            { role: "user", content: buildUserPrompt(req) },
          ],
        }),
      });
      if (!response.ok) {
        throw new ProviderError({
          code: "HTTP_ERROR",
          providerId: "ollama",
          status: response.status,
          userMessage: `Ollama ${response.status}`,
        });
      }
      let buf = "";
      for await (const line of readJSONLines(response, ctx.signal)) {
        try {
          const parsed = OllamaChatChunkSchema.safeParse(JSON.parse(line));
          if (!parsed.success) continue;
          const chunk = parsed.data;
          const content = chunk.message?.content || "";
          if (content) {
            buf += content;
            yield { translatedText: req.mode === "deep" ? extractQuickField(buf) : buf };
          }
          if (chunk.done) break;
        } catch {
          // ignore partial
        }
      }
      if (req.mode === "deep") {
        const parsed = parseDeep(buf);
        yield {
          translatedText: parsed.translatedText || buf,
          phonetic: parsed.phonetic,
          alternatives: parsed.alternatives,
          explanation: parsed.explanation,
          examples: parsed.examples,
          partOfSpeech: parsed.partOfSpeech,
          provider: "ollama",
        };
      } else {
        yield { translatedText: buf.trim(), provider: "ollama" };
      }
    }
    return streamIter();
  },
};

function extractQuickField(buf: string): string {
  const match = /"translatedText"\s*:\s*"([^"]*)/.exec(buf);
  return match ? match[1] : "";
}
