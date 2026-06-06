import type { MessageRouter } from "@shared/messaging";
import { addHistory, clearHistory, listHistory } from "@shared/storage/history";
import { getSettings } from "@shared/storage/settings";
import { bumpActivity } from "@shared/storage/activity";
import { translateViaChain } from "@providers/registry";
import { mergeLlmCredentials } from "@shared/llm-credentials";

export function registerTranslationHandlers(router: MessageRouter): void {
  router.on("translate:request", async (req) => {
    const settings = await getSettings();
    const enriched: typeof req = {
      ...req,
      ieltsMode: req.ieltsMode ?? settings.ieltsMode,
      ieltsTarget: req.ieltsTarget ?? settings.ieltsTarget,
    };
    const result = await translateViaChain(enriched, {
      primary: req.providerId || settings.primaryProvider,
      fallback: settings.fallbackChain,
      credentialsFor: (id) => mergeLlmCredentials(id, settings.credentials),
    });
    await addHistory({ ...result, from: req.from, to: req.to, ts: Date.now() });
    void bumpActivity("queries");
    return result;
  });

  router.on("translate:selection", async (req, sender) => {
    const settings = await getSettings();
    const enriched: typeof req = {
      ...req,
      ieltsMode: req.ieltsMode ?? settings.ieltsMode,
      ieltsTarget: req.ieltsTarget ?? settings.ieltsTarget,
    };
    try {
      const result = await translateViaChain(enriched, {
        primary: req.providerId || settings.primaryProvider,
        fallback: settings.fallbackChain,
        credentialsFor: (id) => mergeLlmCredentials(id, settings.credentials),
      });
      await addHistory({ ...result, from: req.from, to: req.to, ts: Date.now() });
      void bumpActivity("queries");
      await chrome.storage.local.set({
        latestSidePanelResult: { ...result, from: req.from, to: req.to, ts: Date.now() },
      });
      if (req.openSidePanel && chrome.sidePanel?.open && sender.tab?.id) {
        try {
          await chrome.sidePanel.open({ tabId: sender.tab.id });
        } catch (error) {
          console.warn("[polyglot] side panel open skipped", error);
        }
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = {
        originalText: req.text,
        translatedText: `翻译失败: ${message}`,
        provider: req.providerId || settings.primaryProvider,
        isError: true,
        errorMessage: message,
      };
      await chrome.storage.local.set({
        latestSidePanelResult: { ...fallback, from: req.from, to: req.to, ts: Date.now() },
      });
      throw error;
    }
  });

  router.on("history:list", async (payload) => listHistory(payload));
  router.on("history:clear", async () => {
    await clearHistory();
  });

  router.on("immersive:toggle", async ({ tabId, enable }) => {
    let targetTabId = tabId;
    if (!targetTabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTabId = tab?.id;
    }
    if (targetTabId) {
      chrome.tabs
        .sendMessage(targetTabId, { type: "immersive:toggle", payload: { enable } })
        .catch(() => undefined);
    }
    return { enabled: Boolean(enable) };
  });
}
