import type { MessageRouter } from "@shared/messaging";
import { clearHistory, listHistory } from "@shared/storage/history";
import { getSettings } from "@shared/storage/settings";
import { bumpActivity } from "@shared/storage/activity";
import { runTranslation } from "../translate-helper";

export function registerTranslationHandlers(router: MessageRouter): void {
  router.on("sidepanel:open", async (_payload, sender) => {
    await openSidePanel(sender);
    return { opened: true };
  });

  router.on("translate:request", async (req) => {
    const settings = await getSettings();
    const result = await runTranslation(req, settings);
    void bumpActivity("queries");
    return result;
  });

  router.on("translate:selection", async (req, sender) => {
    const source = {
      url: req.url ?? sender.tab?.url ?? null,
      pageTitle: req.pageTitle ?? sender.tab?.title ?? null,
      domain: req.domain ?? null,
    };
    if (req.openSidePanel) {
      try {
        await openSidePanel(sender);
      } catch (error) {
        console.warn("[polyglot] side panel open skipped", error);
      }
    }
    const settings = await getSettings();
    try {
      const result = await runTranslation(req, settings);
      void bumpActivity("queries");
      await chrome.storage.local.set({
        latestSidePanelResult: {
          ...result,
          from: req.from,
          to: req.to,
          context: req.context,
          ...source,
          ts: Date.now(),
        },
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const fallback = {
        originalText: req.text,
        translatedText: "",
        provider: req.providerId || settings.primaryProvider,
        isError: true,
        errorMessage: message,
      };
      await chrome.storage.local.set({
        latestSidePanelResult: {
          ...fallback,
          from: req.from,
          to: req.to,
          context: req.context,
          ...source,
          ts: Date.now(),
        },
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

async function openSidePanel(sender: chrome.runtime.MessageSender): Promise<void> {
  if (!chrome.sidePanel?.open) {
    throw new Error("当前浏览器不支持扩展侧边栏");
  }
  if (!sender.tab?.id) {
    throw new Error("无法确定当前网页标签");
  }
  await chrome.sidePanel.open({ tabId: sender.tab.id });
}
