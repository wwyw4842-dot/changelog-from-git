import type { ProviderContext } from "@providers/types";
import type { ProviderCredentials } from "./types";

/**
 * 别名引擎只复用主引擎的 apiKey / apiBase，不复用 model。
 * 例如 `deepseek-reason` 与 `deepseek` 共用 Key，但默认分别走 V4 Pro / Flash。
 */
export const LLM_CREDENTIAL_ALIASES: Record<string, string> = {
  "deepseek-reason": "deepseek",
  "mimo-pro": "mimo",
};

/** 官方已下线的模型名 → 当前默认（DeepSeek Chat/Reasoner 已停用）。 */
export const LEGACY_LLM_MODELS: Record<string, string> = {
  "deepseek-chat": "deepseek-v4-flash",
  "deepseek-reasoner": "deepseek-v4-pro",
};

export function remapLegacyLlmModel(model: string | undefined): string | undefined {
  const trimmed = model?.trim();
  if (!trimmed) return model;
  return LEGACY_LLM_MODELS[trimmed] ?? trimmed;
}

export function migrateLegacyLlmCredentials(all: ProviderCredentials): ProviderCredentials {
  let changed = false;
  const out: ProviderCredentials = {};
  for (const [providerId, record] of Object.entries(all || {})) {
    if (!record) continue;
    const nextModel = remapLegacyLlmModel(record.model);
    if (nextModel !== record.model) {
      changed = true;
      out[providerId] = { ...record, model: nextModel };
    } else {
      out[providerId] = record;
    }
  }
  return changed ? out : all;
}

/**
 * 合并别名凭据：别名默认复用主引擎的 key/base，
 * 但允许在别名下单独覆盖 model（若填写）。不继承主引擎的 model。
 */
export function mergeLlmCredentials(providerId: string, all: ProviderCredentials): NonNullable<ProviderContext["credentials"]> {
  const direct = { ...(all[providerId] || {}) };
  const primaryId = LLM_CREDENTIAL_ALIASES[providerId];
  if (!primaryId) {
    return {
      ...direct,
      model: remapLegacyLlmModel(direct.model),
    };
  }

  const base = { ...(all[primaryId] || {}) };
  return {
    ...base,
    ...direct,
    apiBase: direct.apiBase?.trim() || base.apiBase,
    apiKey: direct.apiKey?.trim() || base.apiKey,
    model: remapLegacyLlmModel(direct.model?.trim() || undefined),
  };
}
