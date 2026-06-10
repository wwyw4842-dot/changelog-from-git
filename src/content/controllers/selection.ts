import { mapChromeRuntimeError } from "@shared/chrome-runtime-error";
import { send } from "@shared/messaging";
import { detectLangHint, normalizeText, suggestTargetLang } from "@shared/utils";
import type { TranslationRequest, TranslationResult } from "@shared/types";
import type { BubbleHandle } from "../bubble/BubbleHost";
import { refreshVocabHighlight } from "../vocabHighlight/highlighter";
import type { SettingsAccessor, ShowCardParams } from "./types";

const MAX_TEXT_LENGTH = 1200;
const CONTEXT_MAX_LENGTH = 320;
const CONTEXT_MARGIN = 140;

export interface SelectionController {
  handleSelection: () => void;
  translate: (text: string, options?: { openSidePanel?: boolean }) => Promise<void>;
  translateDeep: (text: string) => Promise<void>;
  saveVocabulary: (text: string) => Promise<void>;
  getSelectionPosition: () => { x: number; y: number } | null;
  retryLast: () => void;
  setAltKeyDown: (value: boolean) => void;
}

export function createSelectionController({
  getSettings,
  host,
  isWhitelisted,
  showCard,
}: SettingsAccessor & {
  host: BubbleHandle;
  isWhitelisted: () => boolean;
  showCard: (params: ShowCardParams) => void;
}): SelectionController {
  let altKeyDown = false;
  let activePort: chrome.runtime.Port | null = null;
  let lastRequest: {
    text: string;
    from: string;
    to: string;
    position: { x: number; y: number };
    mode: "quick" | "deep";
  } | null = null;

  function handleSelection(): void {
    const settings = getSettings();
    if (!settings) return;
    if (isWhitelisted()) {
      host.hideTrigger();
      return;
    }
    if (settings.triggerMode === "shortcut") {
      host.hideTrigger();
      return;
    }
    if (settings.triggerMode === "altSelection" && !altKeyDown) {
      host.hideTrigger();
      return;
    }
    const text = normalizeText(window.getSelection()?.toString() || "");
    if (!text) {
      host.hideTrigger();
      return;
    }
    if (!shouldTranslate(text)) {
      host.hideTrigger();
      return;
    }
    const position = getSelectionPosition();
    if (!position) {
      host.hideTrigger();
      return;
    }
    host.showTrigger({ x: position.x + 6, y: Math.max(8, position.y - 30) }, "译", () => {
      void translate(text);
    });
  }

  function shouldTranslate(text: string): boolean {
    if (text.length > MAX_TEXT_LENGTH) return false;
    if (/^[\d\s.,:;!?()[\]{}'"`~\-+=/*\\|_]+$/.test(text)) return false;
    if (!/[a-zA-Z\u4e00-\u9fa5]/.test(text)) return false;
    return true;
  }

  function getSelectionPosition(): { x: number; y: number } | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return { x: rect.right, y: rect.bottom };
  }

  async function translate(text: string, options: { openSidePanel?: boolean } = {}): Promise<void> {
    const settings = getSettings();
    if (!settings) return;
    if (isWhitelisted()) return;
    host.hideTrigger();
    const position = getSelectionPosition() || { x: 16, y: 16 };
    const from = detectLangHint(text);
    const to = suggestTargetLang(text, settings.targetLang);
    lastRequest = { text, from, to, position, mode: "quick" };
    showCard({
      originalText: text,
      translatedText: "",
      provider: settings.primaryProvider,
      state: "loading",
      position,
    });
    try {
      const result = await send("translate:selection", {
        text,
        from,
        to,
        mode: "quick",
        openSidePanel: options.openSidePanel,
      });
      showCard({
        originalText: result.originalText || text,
        translatedText: result.translatedText,
        phonetic: result.phonetic,
        provider: result.provider,
        fromCache: result.fromCache,
        isError: result.isError,
        state: "done",
        position,
      });
      if (settings.autoRead && result.translatedText) {
        try {
          await send("tts:speak", { text, lang: from === "auto" ? undefined : from });
        } catch (error) {
          console.warn("[polyglot] tts failed", error);
        }
      }
    } catch (error) {
      const err = mapChromeRuntimeError(error);
      showCard({
        originalText: text,
        translatedText: "",
        provider: settings.primaryProvider,
        isError: true,
        errorMessage: err.message,
        state: "error",
        position,
      });
    }
  }

  async function translateDeep(text: string): Promise<void> {
    const settings = getSettings();
    if (!settings) return;
    if (isWhitelisted()) return;
    const position = getSelectionPosition() || { x: 16, y: 16 };
    const from = detectLangHint(text);
    const to = suggestTargetLang(text, settings.targetLang);
    lastRequest = { text, from, to, position, mode: "deep" };

    showCard({
      originalText: text,
      translatedText: "",
      provider: settings.deepProvider,
      state: "streaming",
      position,
    });

    if (activePort) {
      try {
        activePort.disconnect();
      } catch {
        // ignore
      }
    }

    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: "polyglot-stream" });
    } catch (error) {
      const err = mapChromeRuntimeError(error);
      showCard({
        originalText: text,
        translatedText: "",
        provider: settings.deepProvider,
        isError: true,
        errorMessage: err.message,
        state: "error",
        position,
      });
      return;
    }
    activePort = port;
    let streamFinished = false;

    port.onMessage.addListener((message: { type: string; payload?: unknown }) => {
      if (message.type === "chunk") {
        const chunk = message.payload as Partial<TranslationResult>;
        host.updateStream({ translatedText: chunk.translatedText });
      } else if (message.type === "done") {
        streamFinished = true;
        const result = message.payload as TranslationResult;
        showCard({
          originalText: text,
          translatedText: result.translatedText,
          phonetic: result.phonetic,
          explanation: result.explanation,
          examples: result.examples,
          partOfSpeech: result.partOfSpeech,
          alternatives: result.alternatives,
          provider: result.provider,
          state: "done",
          position,
        });
      } else if (message.type === "error") {
        streamFinished = true;
        const err = message.payload as { message?: string };
        host.updateStream({
          isError: true,
          errorMessage: mapChromeRuntimeError(new Error(err?.message || "unknown")).message,
        });
      }
    });
    port.onDisconnect.addListener(() => {
      if (activePort === port) activePort = null;
      if (!streamFinished) {
        host.updateStream({
          isError: true,
          errorMessage: mapChromeRuntimeError(new Error("Extension context invalidated.")).message,
        });
      }
    });
    try {
      const payload: TranslationRequest = { text, from, to, mode: "deep" };
      port.postMessage({ type: "translate:stream", payload });
    } catch (error) {
      streamFinished = true;
      const err = mapChromeRuntimeError(error);
      showCard({
        originalText: text,
        translatedText: "",
        provider: settings.deepProvider,
        isError: true,
        errorMessage: err.message,
        state: "error",
        position,
      });
    }
  }

  async function saveVocabulary(text: string): Promise<void> {
    const settings = getSettings();
    if (!settings) return;
    const from = detectLangHint(text);
    const to = suggestTargetLang(text, settings.targetLang);
    const context = captureSelectionContext(text);
    try {
      const result = await send("translate:request", { text, from, to, mode: "quick" });
      await send("vocabulary:add", {
        word: text,
        translation: result.translatedText,
        phonetic: result.phonetic,
        context,
      });
      if (settings.vocabHighlightEnabled !== false) {
        void refreshVocabHighlight();
      }
    } catch (error) {
      console.warn("[polyglot] save vocab failed", error);
    }
  }

  function captureSelectionContext(text: string): string {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return "";
      const range = selection.getRangeAt(0);
      let node: Node | null = range.startContainer;
      let paragraph: Element | null = null;
      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const tag = element.tagName.toLowerCase();
          if (
            [
              "p",
              "li",
              "blockquote",
              "dd",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "figcaption",
              "article",
              "section",
            ].includes(tag)
          ) {
            paragraph = element;
            break;
          }
        }
        node = node.parentNode;
      }
      const raw = (paragraph?.textContent || selection.toString()).trim().replace(/\s+/g, " ");
      if (!raw) return "";
      if (raw.length <= CONTEXT_MAX_LENGTH) return raw;
      const index = raw.indexOf(text);
      if (index < 0) return raw.slice(0, CONTEXT_MAX_LENGTH) + "...";
      const start = Math.max(0, index - CONTEXT_MARGIN);
      const end = Math.min(raw.length, index + text.length + CONTEXT_MARGIN);
      const prefix = start > 0 ? "..." : "";
      const suffix = end < raw.length ? "..." : "";
      return `${prefix}${raw.slice(start, end)}${suffix}`;
    } catch (error) {
      console.warn("[polyglot] capture context failed", error);
      return "";
    }
  }

  function retryLast(): void {
    if (!lastRequest) return;
    if (lastRequest.mode === "deep") {
      void translateDeep(lastRequest.text);
    } else {
      void translate(lastRequest.text);
    }
  }

  return {
    handleSelection,
    translate,
    translateDeep,
    saveVocabulary,
    getSelectionPosition,
    retryLast,
    setAltKeyDown: (value) => {
      altKeyDown = value;
    },
  };
}
