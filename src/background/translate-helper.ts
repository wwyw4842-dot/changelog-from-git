import type { Settings, TranslationRequest, TranslationResult } from "@shared/types";
import { addHistory } from "@shared/storage/history";
import { mergeLlmCredentials } from "@shared/llm-credentials";
import { translateViaChain } from "@providers/registry";

interface ChainOptions {
  /** 不传则用 settings.primaryProvider；流式深度翻译传 settings.deepProvider */
  primaryOverride?: string;
  signal?: AbortSignal;
  onChunk?: (chunk: Partial<TranslationResult>) => void;
}

/**
 * translation.ts 与 stream.ts 共用的翻译执行管线：
 * 用 settings 补全请求里缺省的 IELTS 字段 → 走 provider 回落链 → 写历史。
 */
export async function runTranslation(
  req: TranslationRequest,
  settings: Settings,
  options: ChainOptions = {}
): Promise<TranslationResult> {
  const enriched: TranslationRequest = {
    ...req,
    ieltsMode: req.ieltsMode ?? settings.ieltsMode,
    ieltsTarget: req.ieltsTarget ?? settings.ieltsTarget,
  };
  const result = await translateViaChain(enriched, {
    primary: req.providerId || options.primaryOverride || settings.primaryProvider,
    fallback: settings.fallbackChain,
    credentialsFor: (id) => mergeLlmCredentials(id, settings.credentials),
    signal: options.signal,
    onChunk: options.onChunk,
  });
  await addHistory({ ...result, from: req.from, to: req.to, ts: Date.now() });
  return result;
}
