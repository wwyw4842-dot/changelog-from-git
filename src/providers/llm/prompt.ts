import type { TranslationRequest } from "@shared/types";
import { DeepPayloadSchema } from "@shared/validation";

export interface PromptOptions {
  ieltsMode?: boolean;
  ieltsTarget?: string;
}

export function buildSystemPrompt(
  mode: "quick" | "deep",
  options: PromptOptions = {}
): string {
  if (mode === "deep") {
    if (options.ieltsMode) {
      return [
        "You are an IELTS tutor with 10+ years of teaching experience.",
        `The learner is aiming for IELTS band ${options.ieltsTarget || "7.0"}.`,
        "Return a compact JSON object. No prose outside the JSON.",
        "Shape:",
        `{"translatedText":"...","phonetic":"","alternatives":["synonym1","synonym2"],"explanation":"...","examples":[{"src":"...","tgt":"..."}],"partOfSpeech":[{"pos":"n.","definition":"..."}]}`,
        "IELTS-specific rules:",
        "- translatedText: natural Chinese translation of the input.",
        "- phonetic: IPA if input is a single English word, else empty string.",
        "- alternatives: 2-3 HIGHER-BAND synonyms or paraphrases that an IELTS examiner would reward. Prefer academic / less common word choices (Band 7-8 vocabulary).",
        "- explanation: In Chinese (2-4 sentences). MUST include: (a) 词汇 IELTS 等级估算 (Band 5-6 / 7-8 / 8+ 或 AWL 学术词表); (b) 使用语境提示 (Writing Task 2 / Speaking Part 3 / Reading / 日常); (c) 常见搭配 (collocations).",
        "- examples: 2-3 bilingual examples showing academic or exam-style usage (NOT casual).",
        "- partOfSpeech: only if input is a single word/phrase; else [].",
        "Do NOT wrap output in code blocks. Do NOT output <think> tags.",
      ].join("\n");
    }
    return [
      "You are a professional translator and language tutor.",
      "Return a compact JSON object. No prose outside the JSON. Example:",
      `{"translatedText":"...","phonetic":"","alternatives":[],"explanation":"...","examples":[{"src":"...","tgt":"..."}],"partOfSpeech":[{"pos":"n.","definition":"..."}]}`,
      "Rules:",
      "- translatedText: natural idiomatic translation.",
      "- phonetic: IPA if input is a single English word, else empty string.",
      "- alternatives: up to 3 alternate renderings if meaningful, else [].",
      "- explanation: 1-3 sentences in the target language explaining nuance, tone, or tricky grammar.",
      "- examples: 2-3 usage examples with bilingual pairs.",
      "- partOfSpeech: only if input is a single word/phrase; else [].",
    ].join("\n");
  }
  return [
    "You are a precise translator.",
    "Return only the translated text with no preamble, no quotes, no explanation.",
  ].join("\n");
}

export function buildUserPrompt(req: TranslationRequest): string {
  const context = req.context ? `\nContext: ${req.context}` : "";
  return `Translate from ${req.from === "auto" ? "auto-detected language" : req.from} to ${req.to}.${context}\n\nText:\n${req.text}`;
}

export interface DeepPayload {
  translatedText?: string;
  phonetic?: string;
  alternatives?: string[];
  explanation?: string;
  examples?: Array<{ src: string; tgt: string }>;
  partOfSpeech?: Array<{ pos: string; definition: string }>;
}

export function parseDeep(raw: string): DeepPayload {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    return { translatedText: trimmed };
  }
  const payload = trimmed.slice(jsonStart, jsonEnd + 1);
  try {
    const result = DeepPayloadSchema.safeParse(JSON.parse(payload));
    return result.success ? result.data : { translatedText: trimmed };
  } catch {
    return { translatedText: trimmed };
  }
}
