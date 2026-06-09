import type { MessageRouter } from "@shared/messaging";
import { clearHistory, listHistory } from "@shared/storage/history";
import { getSettings } from "@shared/storage/settings";
import { bumpActivity } from "@shared/storage/activity";
import { runTranslation } from "../translate-helper";

export function registerTranslationHandlers(router: MessageRouter): void {
  router.on("translate:request", async (req) => {
    const settings = await getSettings();
    const result = await runTranslation(req, settings);
    void bumpActivity("queries");
    return result;
  });

  router.on("translate:selection", async (req, sender) => {
    const settings = await getSettings();
    try {
      const result = await runTranslation(req, settings);
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
