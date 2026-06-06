/// <reference types="chrome" />
import { send } from "@shared/messaging";
import { debounce } from "@shared/utils";
import type { Settings } from "@shared/types";
import { disableImmersive, enableImmersive, isImmersiveActive } from "./immersive/controller";
import { enablePdfMode } from "./pdf/pdf-hook";
import { isPdfPage } from "./pdf/pdf-detector";
import { disableInputEnhance, enableInputEnhance, updateInputEnhanceSettings } from "./inputEnhance/controller";
import {
  disableVocabHighlight,
  enableVocabHighlight,
} from "./vocabHighlight/highlighter";
import { createBubbleController } from "./controllers/bubble";
import { createSelectionController, type SelectionController } from "./controllers/selection";
import { createShortcutsController } from "./controllers/shortcuts";

const STATE_KEY = "__polyglot_injected__";
interface WindowWithFlag extends Window {
  [STATE_KEY]?: boolean;
}
declare const window: WindowWithFlag;

if (window[STATE_KEY]) {
  console.debug("[polyglot] already injected");
} else {
  window[STATE_KEY] = true;
  void bootstrap();
}

let settings: Settings | null = null;

async function bootstrap(): Promise<void> {
  try {
    settings = await send("settings:get");
  } catch (error) {
    console.warn("[polyglot] get settings failed", error);
    return;
  }
  if (isWhitelisted(settings.whitelist || [])) return;

  let selectionController: SelectionController;
  const bubbleController = createBubbleController({
    getSettings,
    setSettings,
    saveVocabulary: (text) => selectionController.saveVocabulary(text),
    translateDeep: (text) => selectionController.translateDeep(text),
    retryLast: () => selectionController.retryLast(),
  });

  selectionController = createSelectionController({
    getSettings,
    setSettings,
    host: bubbleController.host,
    isWhitelisted: isCurrentPageWhitelisted,
    showCard: bubbleController.showCard,
  });

  installFeatureControllers(settings);

  if (settings.theme && settings.theme !== 'system') {
    bubbleController.host.setTheme(settings.theme);
  }

  const runCheck = debounce(selectionController.handleSelection, 90);
  document.addEventListener("mouseup", runCheck);
  document.addEventListener("selectionchange", runCheck);
  document.addEventListener("mousedown", bubbleController.handleGlobalMouseDown, true);

  createShortcutsController({
    getSettings,
    setSettings,
    host: bubbleController.host,
    setAltKeyDown: selectionController.setAltKeyDown,
    translate: selectionController.translate,
    translateDeep: selectionController.translateDeep,
    saveVocabulary: selectionController.saveVocabulary,
    toggleImmersive,
    isWhitelisted: isCurrentPageWhitelisted,
    showCard: bubbleController.showCard,
  }).attach();

  chrome.storage.onChanged.addListener((changes, area) => {
    if ((area !== "sync" && area !== "local") || !changes.settings) return;
    const prev = settings;
    settings = { ...(settings as Settings), ...(changes.settings.newValue as Settings) };
    if (isCurrentPageWhitelisted()) {
      bubbleController.hideForWhitelist();
    }
    if (prev?.vocabHighlightEnabled !== settings.vocabHighlightEnabled) {
      if (settings.vocabHighlightEnabled) {
        void enableVocabHighlight();
      } else {
        disableVocabHighlight();
      }
    }
    if (settings.inputEnhanceEnabled) {
      if (!prev?.inputEnhanceEnabled) enableInputEnhance(settings);
      else updateInputEnhanceSettings(settings);
    } else if (prev?.inputEnhanceEnabled) {
      disableInputEnhance();
    }
    if (settings.theme) {
      bubbleController.host.setTheme(settings.theme);
    }
  });
}

function installFeatureControllers(currentSettings: Settings): void {
  if (currentSettings.pdfEnabled && isPdfPage()) {
    try {
      enablePdfMode(currentSettings);
    } catch (error) {
      console.warn("[polyglot] pdf hook failed", error);
    }
  }

  if (currentSettings.inputEnhanceEnabled) {
    try {
      enableInputEnhance(currentSettings);
    } catch (error) {
      console.warn("[polyglot] input enhance failed", error);
    }
  }

  if (currentSettings.vocabHighlightEnabled !== false) {
    void enableVocabHighlight();
  }
}

async function toggleImmersive(force?: boolean): Promise<void> {
  if (!settings) return;
  const target = force ?? !isImmersiveActive();
  if (target) {
    await enableImmersive(settings);
  } else {
    disableImmersive();
  }
}

function getSettings(): Settings | null {
  return settings;
}

function setSettings(next: Settings): void {
  settings = next;
}

function isCurrentPageWhitelisted(): boolean {
  return isWhitelisted(settings?.whitelist || []);
}

function isWhitelisted(whitelist: string[]): boolean {
  const hostName = location.hostname.toLowerCase();
  const href = location.href;
  return whitelist.some((entry) => {
    const raw = String(entry || "").trim();
    if (!raw) return false;
    if (raw.includes("://")) {
      return href === raw;
    }
    const domain = raw.toLowerCase();
    return hostName === domain || hostName.endsWith(`.${domain}`);
  });
}
