import type { MessageRouter } from "@shared/messaging";
import { getSettings, updateSettings } from "@shared/storage/settings";
import { translationCache } from "@providers/cache";
import { getProvider } from "@providers/registry";
import { mergeLlmCredentials } from "@shared/llm-credentials";

export function registerSettingsHandlers(router: MessageRouter): void {
  router.on("settings:get", async () => getSettings());
  router.on("settings:update", async (payload) => {
    const next = await updateSettings(payload);
    translationCache.clear();
    return next;
  });

  router.on("provider:test", async ({ providerId }) => {
    const provider = getProvider(providerId);
    if (!provider) return { ok: false, message: "未知引擎" };
    const settings = await getSettings();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const raw = await provider.translate(
        {
          text: "Hello, world.",
          from: "en",
          to: "zh-CN",
          mode: "quick",
        },
        {
          credentials: mergeLlmCredentials(providerId, settings.credentials),
          signal: controller.signal,
        }
      );
      const isStream =
        raw && typeof (raw as AsyncIterable<unknown>)[Symbol.asyncIterator] === "function";

      let previewText = "";
      if (isStream) {
        const iterable = raw as AsyncIterable<{ translatedText?: string }>;
        for await (const chunk of iterable) {
          if (chunk.translatedText) {
            previewText = chunk.translatedText;
            if (previewText.length >= 8) {
              controller.abort();
              break;
            }
          }
        }
        if (!previewText) {
          return { ok: false, message: "模型返回空内容（可能是模型名错误或服务未就绪）" };
        }
      } else {
        previewText = (raw as { translatedText?: string }).translatedText || "";
        if (!previewText) {
          return { ok: false, message: "引擎返回空内容" };
        }
      }
      return { ok: true, message: `通过：${previewText.slice(0, 60)}` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "AUTHENTICATION_FAILURE") {
        return { ok: false, message: "鉴权失败（API Key 无效或已过期）" };
      }
      if (message.includes("abort")) {
        return { ok: false, message: "请求超时（>20s），请检查网络或 API base" };
      }
      return { ok: false, message };
    } finally {
      clearTimeout(timeout);
    }
  });
}
