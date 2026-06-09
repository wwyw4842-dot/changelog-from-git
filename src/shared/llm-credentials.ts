import type { ProviderContext } from "@providers/types";
import type { ProviderCredentials } from "./types";

/**
 * 合并别名凭据：例如 `deepseek-reason` 默认复用 `deepseek` 的 key/base，
 * 但允许在别名下单独覆盖 model（若填写）。
 */
export function mergeLlmCredentials(providerId: string, all: ProviderCredentials): NonNullable<ProviderContext["credentials"]> {
  const direct = { ...(all[providerId] || {}) };
  if (providerId === "deepseek-reason") {
    const base = { ...(all["deepseek"] || {}) };
    return {
      ...base,
      ...direct,
      model: direct.model?.trim() || base.model,
      apiBase: direct.apiBase?.trim() || base.apiBase,
      apiKey: direct.apiKey?.trim() || base.apiKey,
    };
  }
  return direct;
}
