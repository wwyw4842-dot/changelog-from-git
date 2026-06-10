import { send } from "@shared/messaging";
import { detectLangHint, suggestTargetLang } from "@shared/utils";
import { createBubbleHost, type BubbleHandle } from "../bubble/BubbleHost";
import type { SettingsAccessor, ShowCardParams } from "./types";

export interface BubbleController {
  host: BubbleHandle;
  showCard: (params: ShowCardParams) => void;
  handleGlobalMouseDown: (event: MouseEvent) => void;
  hideForWhitelist: () => void;
}

export function createBubbleController({
  getSettings,
  setSettings,
  saveVocabulary,
  translateDeep,
  retryLast,
}: SettingsAccessor & {
  saveVocabulary: (text: string) => Promise<void>;
  translateDeep: (text: string) => Promise<void>;
  retryLast: () => void;
}): BubbleController {
  const host = createBubbleHost();

  function handleGlobalMouseDown(event: MouseEvent): void {
    if (host.isPinned()) return;
    const target = event.target as Node;
    if (target && (target.nodeType === 1 || target.nodeType === 3)) {
      const polyHost = document.getElementById("__polyglot_host__");
      if (polyHost && polyHost.contains(target)) return;
    }
    host.hide();
    host.hideTrigger();
  }

  function showCard(params: ShowCardParams): void {
    const settings = getSettings();
    host.show({
      ...params,
      ...pageWhitelistBubbleProps(),
      opacity: settings?.bubbleOpacity ?? 0.96,
      fontSize: settings?.fontSize ?? 14,
      onCopySource: () => void navigator.clipboard?.writeText(params.originalText),
      onCopyTarget: () => void navigator.clipboard?.writeText(params.translatedText),
      onSpeak: () => {
        const lang = detectLangHint(params.originalText);
        return send("tts:speak", {
          text: params.originalText,
          lang: lang === "auto" ? undefined : lang,
        }).then(() => {});
      },
      onStop: () => void send("tts:stop"),
      onSave: () => void saveVocabulary(params.originalText),
      onDeep: () => void translateDeep(params.originalText),
      onRetry: () => retryLast(),
      onOpenPanel: () => {
        void send("translate:selection", {
          text: params.originalText,
          from: detectLangHint(params.originalText),
          to: suggestTargetLang(params.originalText, settings?.targetLang || "zh-CN"),
          mode: "quick",
          openSidePanel: true,
        });
      },
    });
  }

  function hideForWhitelist(): void {
    host.hide();
    host.hideTrigger();
  }

  function pageWhitelistBubbleProps(): {
    currentPageWhitelisted: boolean;
    onTogglePageWhitelist: (enabled: boolean) => void;
  } {
    return {
      currentPageWhitelisted: isCurrentPageHrefInWhitelist(getSettings()?.whitelist || []),
      onTogglePageWhitelist: (enabled: boolean) => void togglePageWhitelist(enabled),
    };
  }

  function isCurrentPageHrefInWhitelist(whitelist: string[]): boolean {
    const href = location.href;
    return whitelist.some((entry) => String(entry || "").trim() === href);
  }

  async function togglePageWhitelist(enable: boolean): Promise<void> {
    const settings = getSettings();
    if (!settings) return;
    const href = location.href;
    const list = settings.whitelist || [];
    const next = enable
      ? list.some((e) => e.trim() === href)
        ? list
        : [...list, href]
      : list.filter((e) => e.trim() !== href);
    try {
      if (enable) {
        void navigator.clipboard?.writeText(href).catch(() => {});
      }
      const updated = await send("settings:update", { whitelist: next });
      setSettings(updated);
      host.hide();
      host.hideTrigger();
    } catch (error) {
      console.warn("[polyglot] page whitelist toggle failed", error);
    }
  }

  return { host, showCard, handleGlobalMouseDown, hideForWhitelist };
}
