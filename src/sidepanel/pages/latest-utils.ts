import type { Settings, TranslationResult } from "@shared/types";
import type { LatestPayload } from "./Latest";

type RetrySettings = Pick<Settings, "primaryProvider" | "fallbackChain" | "deepProvider">;

export function chooseRetryProvider(
  settings: RetrySettings,
  currentProvider?: string
): string | undefined {
  const chain = [settings.primaryProvider, ...settings.fallbackChain, settings.deepProvider];
  const unique = chain.filter((provider, index) => provider && chain.indexOf(provider) === index);
  return unique.find((provider) => provider !== currentProvider) || unique[0];
}

export function hasDeepDetails(result: Partial<TranslationResult>): boolean {
  return Boolean(
    result.explanation?.trim() ||
    result.alternatives?.some((item) => item.trim()) ||
    result.examples?.length ||
    result.partOfSpeech?.length
  );
}

export function mergeDeepDetails(current: LatestPayload, deep: TranslationResult): LatestPayload {
  return {
    ...current,
    phonetic: deep.phonetic || current.phonetic,
    explanation: deep.explanation || current.explanation,
    alternatives: deep.alternatives?.length ? deep.alternatives : current.alternatives,
    examples: deep.examples?.length ? deep.examples : current.examples,
    partOfSpeech: deep.partOfSpeech?.length ? deep.partOfSpeech : current.partOfSpeech,
  };
}
