import type { MessageRouter } from "@shared/messaging";
import { ttsLangFor } from "@shared/utils";

export function registerTtsHandlers(router: MessageRouter): void {
  router.on("tts:speak", async ({ text, lang }) => {
    if (!text?.trim()) return { spoken: false };
    chrome.tts.stop();
    const finalLang = lang ? ttsLangFor(lang) : "en-US";
    await new Promise<void>((resolve, reject) => {
      chrome.tts.speak(text, { lang: finalLang, rate: 1, pitch: 1 }, () => {
        const err = chrome.runtime.lastError;
        if (err) reject(new Error(err.message));
        else resolve();
      });
    });
    return { spoken: true };
  });

  router.on("tts:stop", async () => {
    chrome.tts.stop();
  });
}
