import { normalizeText } from "@shared/utils";
import { recognizeImage } from "../ocr/ocr";
import type { BubbleHandle } from "../bubble/BubbleHost";
import type { SettingsAccessor, ShowCardParams } from "./types";

export interface ShortcutsController {
  attach: () => void;
}

export function createShortcutsController({
  getSettings,
  host,
  setAltKeyDown,
  translate,
  translateDeep,
  saveVocabulary,
  toggleImmersive,
  isWhitelisted,
  showCard,
}: SettingsAccessor & {
  host: BubbleHandle;
  setAltKeyDown: (value: boolean) => void;
  translate: (text: string, options?: { openSidePanel?: boolean }) => Promise<void>;
  translateDeep: (text: string) => Promise<void>;
  saveVocabulary: (text: string) => Promise<void>;
  toggleImmersive: (force?: boolean) => Promise<void>;
  isWhitelisted: () => boolean;
  showCard: (params: ShowCardParams) => void;
}): ShortcutsController {
  let lastContextImageUrl: string | null = null;

  function attach(): void {
    document.addEventListener(
      "contextmenu",
      (event) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (target instanceof HTMLImageElement) {
          lastContextImageUrl = target.currentSrc || target.src;
        } else {
          lastContextImageUrl = null;
        }
      },
      true
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Alt") setAltKeyDown(true);
      if (e.key === "Escape" && host.isVisible()) host.hide();
    });
    document.addEventListener("keyup", (e) => {
      if (e.key === "Alt") setAltKeyDown(false);
    });

    chrome.runtime.onMessage.addListener((message) => {
      const envelope = message as { type?: string; payload?: { text?: string; enable?: boolean } };
      if (!envelope?.type) return;
      if (envelope.type === "context:translate" || envelope.type === "command:translate-selection") {
        const sel = normalizeText(window.getSelection()?.toString() || "");
        const text = sel || envelope.payload?.text || "";
        if (text) void translate(text, { openSidePanel: envelope.type.startsWith("command:") });
      } else if (envelope.type === "command:translate-deep") {
        const text = normalizeText(window.getSelection()?.toString() || "");
        if (text) void translateDeep(text);
      } else if (envelope.type === "command:translate-page" || envelope.type === "context:immersive") {
        void toggleImmersive();
      } else if (envelope.type === "immersive:toggle") {
        void toggleImmersive(envelope.payload?.enable);
      } else if (envelope.type === "context:addVocab") {
        const text = normalizeText(window.getSelection()?.toString() || envelope.payload?.text || "");
        if (text) void saveVocabulary(text);
      } else if (envelope.type === "context:ocrImage") {
        if (lastContextImageUrl) void runOcr(lastContextImageUrl);
      }
    });
  }

  async function runOcr(imageUrl: string): Promise<void> {
    const settings = getSettings();
    if (!settings) return;
    if (isWhitelisted()) return;
    const position = { x: 40, y: 40 };
    showCard({
      originalText: "(图像)",
      translatedText: "正在 OCR 识别...",
      provider: "tesseract",
      state: "loading",
      position,
    });
    try {
      const text = normalizeText(await recognizeImage(imageUrl));
      if (!text) throw new Error("未识别到文字");
      await translate(text);
    } catch (error) {
      showCard({
        originalText: "(图像 OCR)",
        translatedText: "",
        provider: "tesseract",
        isError: true,
        errorMessage: error instanceof Error ? error.message : String(error),
        state: "error",
        position,
      });
    }
  }

  return { attach };
}
