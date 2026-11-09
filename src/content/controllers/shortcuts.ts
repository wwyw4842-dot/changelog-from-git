import { normalizeText } from "@shared/utils";
import { send } from "@shared/messaging";
import type { BubbleHandle } from "../bubble/BubbleHost";
import type { SettingsAccessor, ShowCardParams } from "./types";

export interface ShortcutsController {
  attach: () => () => void;
}

export function createShortcutsController({
  getSettings,
  host,
  setAltKeyDown,
  translate,
  translateDeep,
  cancelDeep,
  saveVocabulary,
  toggleImmersive,
  isWhitelisted,
  showCard,
}: SettingsAccessor & {
  host: BubbleHandle;
  setAltKeyDown: (value: boolean) => void;
  translate: (text: string, options?: { openSidePanel?: boolean }) => Promise<void>;
  translateDeep: (text: string) => Promise<void>;
  cancelDeep: () => void;
  saveVocabulary: (text: string) => Promise<void>;
  toggleImmersive: (force?: boolean) => Promise<void>;
  isWhitelisted: () => boolean;
  showCard: (params: ShowCardParams) => void;
}): ShortcutsController {
  let lastContextImageUrl: string | null = null;

  function attach(): () => void {
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target instanceof HTMLImageElement) {
        lastContextImageUrl = target.currentSrc || target.src;
      } else {
        lastContextImageUrl = null;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltKeyDown(true);
      if (e.key === "Escape" && host.isVisible()) {
        cancelDeep();
        host.hide();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") setAltKeyDown(false);
    };
    const onRuntimeMessage = (message: unknown) => {
      const envelope = message as { type?: string; payload?: { text?: string; enable?: boolean } };
      if (!envelope?.type) return;
      if (
        envelope.type === "context:translate" ||
        envelope.type === "command:translate-selection"
      ) {
        const sel = normalizeText(window.getSelection()?.toString() || "");
        const text = sel || envelope.payload?.text || "";
        if (text) void translate(text, { openSidePanel: envelope.type.startsWith("command:") });
      } else if (envelope.type === "command:translate-deep") {
        const text = normalizeText(window.getSelection()?.toString() || "");
        if (text) void translateDeep(text);
      } else if (
        envelope.type === "command:translate-page" ||
        envelope.type === "context:immersive"
      ) {
        void toggleImmersive();
      } else if (envelope.type === "immersive:toggle") {
        void toggleImmersive(envelope.payload?.enable);
      } else if (envelope.type === "context:addVocab") {
        const text = normalizeText(
          window.getSelection()?.toString() || envelope.payload?.text || ""
        );
        if (text) void saveVocabulary(text);
      } else if (envelope.type === "context:ocrImage") {
        if (lastContextImageUrl) void runOcr(lastContextImageUrl);
      }
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    chrome.runtime.onMessage.addListener(onRuntimeMessage);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      try {
        chrome.runtime.onMessage.removeListener(onRuntimeMessage);
      } catch {
        // ignore invalidated context
      }
    };
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
      // OCR 在后台触发的 offscreen 文档中执行，绕过宿主页 CSP。
      const { text: ocrText } = await send("ocr:recognize", { src: imageUrl });
      const text = normalizeText(ocrText);
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
