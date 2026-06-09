import { MessageRouter } from "@shared/messaging";
import { initializeSettings } from "@shared/storage/settings";
import { translationCache } from "@providers/cache";
import { registerSettingsHandlers } from "./handlers/settings";
import { registerTranslationHandlers } from "./handlers/translation";
import { registerVocabularyHandlers } from "./handlers/vocabulary";
import { registerTtsHandlers } from "./handlers/tts";
import { registerStreamHandler } from "./handlers/stream";

const router = new MessageRouter();

initializeSettings().catch((err) => console.warn("[polyglot] init settings failed", err));
translationCache.hydrate().catch(() => undefined);

chrome.runtime.onInstalled.addListener(async () => {
  await initializeSettings();
  await installContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await installContextMenus();
});

async function installContextMenus(): Promise<void> {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: "polyglot-translate-selection",
      title: "Polyglot: 翻译 “%s”",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "polyglot-add-vocab",
      title: "Polyglot: 加入生词本",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "polyglot-translate-page",
      title: "Polyglot: 沉浸式整页翻译",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: "polyglot-ocr-image",
      title: "Polyglot: OCR 翻译图片文字",
      contexts: ["image"],
    });
  } catch (error) {
    console.warn("[polyglot] context menu install failed", error);
  }
}

chrome.contextMenus?.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const send = (type: string, payload: unknown) =>
    chrome.tabs.sendMessage(tab.id!, { type, payload }).catch(() => undefined);
  if (info.menuItemId === "polyglot-translate-selection" && info.selectionText) {
    send("context:translate", { text: info.selectionText });
  } else if (info.menuItemId === "polyglot-add-vocab" && info.selectionText) {
    send("context:addVocab", { text: info.selectionText });
  } else if (info.menuItemId === "polyglot-translate-page") {
    send("context:immersive", {});
  } else if (info.menuItemId === "polyglot-ocr-image") {
    send("context:ocrImage", { src: info.srcUrl });
  }
});

chrome.commands?.onCommand.addListener((command) => {
  chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: `command:${command}` }).catch(() => undefined);
  });
});

chrome.action.onClicked?.addListener(async (tab) => {
  if (!tab.id) return;
  if (chrome.sidePanel?.open) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.warn("[polyglot] side panel open failed", error);
    }
  }
});

registerSettingsHandlers(router);
registerTranslationHandlers(router);
registerVocabularyHandlers(router);
registerTtsHandlers(router);
router.attach();

registerStreamHandler();
