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

export const FINAL_LOCAL_PROVIDER_ID = "ollama";

/** 用户配置在线备用顺序；本地 Ollama 始终作为翻译链最后一道保障。 */
export function withFinalLocalFallback(primary: string, fallback: string[]): string[] {
  const onlineFallback = Array.from(
    new Set(
      fallback.filter(
        (providerId) =>
          providerId && providerId !== primary && providerId !== FINAL_LOCAL_PROVIDER_ID
      )
    )
  );
  return primary === FINAL_LOCAL_PROVIDER_ID
    ? onlineFallback
    : [...onlineFallback, FINAL_LOCAL_PROVIDER_ID];
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
  const primary = req.providerId || options.primaryOverride || settings.primaryProvider;
  const result = await translateViaChain(enriched, {
    primary,
    fallback: withFinalLocalFallback(primary, settings.fallbackChain),
    credentialsFor: (id) => mergeLlmCredentials(id, settings.credentials),
    signal: options.signal,
    onChunk: options.onChunk,
  });
  if (options.signal?.aborted) {
    return result;
  }
  await addHistory({
    ...result,
    from: req.from,
    to: req.to,
    context: req.context,
    ts: Date.now(),
  });
  return result;
}
