import { getProvider } from "@providers/registry";
import { streamChat, type ChatMessage } from "@providers/llm/chat";
import { mergeLlmCredentials } from "@shared/llm-credentials";
import type { Settings, VocabExample, VocabularyEntry } from "@shared/types";

export async function generateVocabularyExamples(
  entry: VocabularyEntry,
  settings: Settings,
  signal: AbortSignal
): Promise<VocabExample[]> {
  if (entry.examples && entry.examples.length > 0) return entry.examples;

  const providerChain = buildExampleProviderChain(settings);
  let lastError: unknown = null;

  for (const providerId of providerChain) {
    const provider = getProvider(providerId);
    if (!provider) continue;
    const creds = mergeLlmCredentials(providerId, settings.credentials);
    if (provider.capabilities.needsCredentials && !creds?.apiKey?.trim()) {
      continue;
    }
    try {
      const messages: ChatMessage[] = exampleMessages(entry);
      let text = "";
      for await (const delta of streamChat(providerId, messages, { credentials: creds, signal })) {
        text += delta;
      }
      const parsed = parseExampleJson(text);
      if (parsed.length) return parsed;
      lastError = new Error("模型未返回有效 JSON 例句");
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("无法生成例句：未配置可用的 LLM 或 API Key");
}

function buildExampleProviderChain(settings: Settings): string[] {
  const preferred = settings.vocabExampleProvider?.trim();
  const chain = [
    preferred,
    "deepseek",
    settings.llmProProvider,
    settings.deepProvider,
    "ollama",
    "openai",
  ]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of chain) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function exampleMessages(entry: VocabularyEntry): ChatMessage[] {
  const ctx = entry.context?.trim();
  const system = [
    "You help language learners. Reply with JSON ONLY, no markdown fences, no extra keys.",
    'Schema: {"examples":[{"en":"...","zh":"..."},{"en":"...","zh":"..."}]}',
    "Rules:",
    "- Exactly 2 items in examples.",
    "- English sentences must be natural, 12-28 words, IELTS/academic tone when appropriate.",
    "- Chinese must be faithful, natural Simplified Chinese.",
    "- Use the target word/phrase clearly in each English sentence.",
    ctx ? "- Try to relate slightly to the user's context sentence if it makes sense." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userLines = [
    `word: ${entry.word}`,
    `translation: ${entry.translation}`,
    ctx ? `context: ${ctx}` : "",
    "Return only the JSON object.",
  ].filter(Boolean);

  return [
    { role: "system", content: system },
    { role: "user", content: userLines.join("\n") },
  ];
}

function parseExampleJson(raw: string): VocabExample[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    const data = JSON.parse(cleaned) as { examples?: unknown };
    const list = data.examples;
    if (!Array.isArray(list)) return [];
    const out: VocabExample[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const en = String((item as { en?: unknown }).en ?? "").trim();
      const zh = String((item as { zh?: unknown }).zh ?? "").trim();
      if (en && zh) out.push({ en, zh });
    }
    return out.slice(0, 4);
  } catch {
    return [];
  }
}
