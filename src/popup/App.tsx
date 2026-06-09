import { useEffect, useRef, useState } from "react";
import { send } from "@shared/messaging";
import { detectLangHint } from "@shared/utils";
import type { Settings, TranslationResult } from "@shared/types";
import { uiText } from "@shared/ui-text";
import { useRipple } from "@shared/useRipple";
import { useTheme } from "@shared/useTheme";

const COMMAND_DEFAULTS: Record<string, string> = {
  "translate-selection": "Alt+T",
  "translate-page": "Alt+Shift+T",
  "translate-deep": "Alt+D",
};
const COMMAND_ORDER = ["translate-selection", "translate-deep", "translate-page"] as const;
const TOAST_MS_SUCCESS = 1400;
const TOAST_MS_ERROR = 1800;
const SITE_STATUS_MS = 2600;

type WhitelistMode = "domain" | "url";

const UI = {
  shell: "relative min-w-[340px] space-y-3 p-4 text-ink-900 poly-stagger",
  headerRow: "flex items-center justify-between",
  title: "flex items-center gap-2.5 text-sm font-semibold",
  brandMark:
    "relative grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold text-white shadow-coral bg-gradient-to-br from-brand-400 to-brand-600",
  brandText: "flex flex-col leading-tight",
  brandMain: "poly-serif poly-letter-reveal font-bold tracking-tight text-ink-900 text-[16px]",
  brandSub: "text-[10px] font-medium uppercase tracking-[0.20em] text-brand-600/80",
  optionsButton:
    "rounded-md px-2 py-0.5 text-[11px] text-ink-500 transition hover:bg-cream-200 hover:text-ink-900 active:scale-95",
  textarea:
    "poly-input-glow min-h-[84px] w-full rounded-xl border border-cream-300 bg-cream-50 p-2.5 text-sm text-ink-900 outline-none placeholder:text-ink-400 shadow-softer transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200/60",
  resultCard:
    "poly-spring relative rounded-2xl border border-cream-300/80 bg-cream-100 p-3 shadow-softer",
  copyToast:
    "absolute right-3 top-2 rounded-md bg-gradient-to-r from-brand-400 to-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-coral poly-toast-pop",
  resultText:
    "poly-serif min-h-[52px] whitespace-pre-wrap text-[15px] leading-relaxed text-ink-900",
  resultMetaRow: "mt-2 flex items-center justify-between text-[11px] text-ink-500",
  translateStatus: "mt-1 text-[11px] text-ink-500",
  card:
    "rounded-2xl border border-cream-300/80 bg-cream-100 px-3 py-2.5 shadow-softer transition hover:shadow-soft",
  cardTitle:
    "poly-serif mb-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-600",
  cardHintMt: "mt-1.5 text-[10px] leading-snug text-ink-400",
  modeTabsWrap:
    "mb-2 inline-flex rounded-xl border border-cream-300 bg-cream-200/60 p-0.5 text-[11px] shadow-softer",
  modeTabActive:
    "rounded-lg px-2.5 py-1 transition bg-cream-50 text-brand-700 font-semibold shadow-softer ring-1 ring-inset ring-brand-200",
  modeTabIdle:
    "rounded-lg px-2.5 py-1 transition text-ink-500 hover:text-ink-900",
  modeTabActiveDisabled:
    "rounded-lg px-2.5 py-1 transition bg-cream-50 text-brand-700 font-semibold shadow-softer ring-1 ring-inset ring-brand-200 cursor-not-allowed opacity-60",
  modeTabIdleDisabled:
    "rounded-lg px-2.5 py-1 transition text-ink-500 cursor-not-allowed opacity-60",
  whitelistRow: "flex items-center justify-between gap-3",
  whitelistTextWrap: "min-w-0",
  whitelistHost: "truncate text-[12px] font-medium text-ink-700",
  whitelistDesc: "mt-0.5 text-[10px] leading-snug text-ink-400",
  switchOn:
    "relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-all duration-200 bg-gradient-to-r from-brand-400 to-brand-600 shadow-coral",
  switchOnBusy:
    "relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-all duration-200 bg-gradient-to-r from-brand-400 to-brand-600 shadow-coral cursor-not-allowed opacity-60",
  switchOffBusy:
    "relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-all duration-200 bg-cream-300 cursor-not-allowed opacity-60",
  switchOffIdle:
    "relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-all duration-200 bg-cream-300 cursor-pointer hover:bg-cream-400",
  switchLabel:
    "pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-bold tracking-wider text-white/85",
  switchKnobOn:
    "inline-block h-5 w-5 rounded-full bg-white shadow-[0_2px_6px_rgba(184,95,80,0.40)] transition-transform duration-300 translate-x-[26px]",
  switchKnobOff:
    "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 translate-x-0.5",
  siteStatusRow: "mt-1.5 flex items-center justify-between gap-2",
  siteStatusText: "min-w-0 flex-1 text-[10px] leading-snug text-ink-500",
  retryButton:
    "shrink-0 rounded-md border border-cream-300 bg-cream-100 px-1.5 py-0.5 text-[10px] text-ink-700 shadow-softer transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60",
  commandList: "space-y-1 text-[11px] text-ink-600",
  commandItem: "flex items-start justify-between gap-2",
  commandDesc: "min-w-0 flex-1 leading-snug",
  shortcutsLink: "font-mono text-ink-500",
  footer: "flex items-center justify-between text-[11px]",
  footerVersion:
    "rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500",
  subtleButton:
    "rounded-lg border border-cream-300 bg-cream-100 px-2.5 py-1 text-[11px] text-ink-700 shadow-softer transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 active:scale-95",
  kbd:
    "shrink-0 rounded-md border border-cream-300 bg-cream-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-700 shadow-softer",
} as const;

export function PopupApp() {
  useRipple();
  const [theme, setTheme] = useState<Settings["theme"]>("system");
  useTheme(theme);
  const [text, setText] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [translateStatus, setTranslateStatus] = useState<string>("");
  const [siteStatus, setSiteStatus] = useState<string>("");
  const [commandRows, setCommandRows] = useState<Array<{ name: string; description: string; shortcut: string }>>([]);
  const [currentUrl, setCurrentUrl] = useState<string>("");
  const [currentHost, setCurrentHost] = useState<string>("");
  const [domainWhitelisted, setDomainWhitelisted] = useState(false);
  const [urlWhitelisted, setUrlWhitelisted] = useState(false);
  const [whitelistMode, setWhitelistMode] = useState<WhitelistMode>("domain");
  const [whitelistBusy, setWhitelistBusy] = useState(false);
  const [whitelistReady, setWhitelistReady] = useState(false);
  const [retryWhitelistAction, setRetryWhitelistAction] = useState<(() => Promise<void>) | null>(null);
  const [copyToast, setCopyToast] = useState("");
  const debounceRef = useRef<number | null>(null);
  const siteStatusTimerRef = useRef<number | null>(null);
  const copyToastTimerRef = useRef<number | null>(null);

  const scheduleCopyToastClear = (ms: number) => {
    if (copyToastTimerRef.current) window.clearTimeout(copyToastTimerRef.current);
    copyToastTimerRef.current = window.setTimeout(() => setCopyToast(""), ms);
  };

  useEffect(() => {
    chrome.commands.getAll((cmds) => {
      const rows = cmds
        .filter((c) => c.name && c.name in COMMAND_DEFAULTS)
        .map((c) => ({
          name: c.name!,
          description: c.description?.trim() || c.name!,
          shortcut: (c.shortcut && c.shortcut.trim()) || COMMAND_DEFAULTS[c.name!] || "",
        }))
        .sort((a, b) => COMMAND_ORDER.indexOf(a.name as (typeof COMMAND_ORDER)[number]) - COMMAND_ORDER.indexOf(b.name as (typeof COMMAND_ORDER)[number]));
      setCommandRows(rows);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootWhitelist = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const href = tab?.url || "";
      if (!href) return;
      let parsed: URL;
      try {
        parsed = new URL(href);
      } catch {
        return;
      }
      if (!["http:", "https:"].includes(parsed.protocol)) return;
      const host = parsed.hostname.toLowerCase();
      const settings = await send("settings:get");
      if (cancelled) return;
      setTheme(settings.theme || "system");
      setCurrentUrl(href);
      setCurrentHost(host);
      const state = getWhitelistState(settings.whitelist || [], href, host);
      setDomainWhitelisted(state.domainWhitelisted);
      setUrlWhitelisted(state.urlWhitelisted);
      setWhitelistReady(true);
    };
    void bootWhitelist().catch(() => {
      if (!cancelled) setWhitelistReady(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const current = text.trim();
    if (!current) {
      setResult(null);
      setTranslateStatus("");
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      translate(current).catch((error) => {
        setTranslateStatus(`翻译失败：${error instanceof Error ? error.message : String(error)}`);
      });
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [text]);

  const translate = async (value: string): Promise<void> => {
    setTranslateStatus(uiText.translating);
    const from = detectLangHint(value);
    const to = from === "zh-CN" ? "en" : "zh-CN";
    const data = await send("translate:request", {
      text: value,
      from,
      to,
      mode: "quick",
    });
    setResult(data);
    setTranslateStatus(data.fromCache ? uiText.translatedUpdatedCached : uiText.translatedUpdated);
  };

  const copyResult = async () => {
    if (!result?.translatedText) return;
    try {
      await navigator.clipboard.writeText(result.translatedText);
      setCopyToast(uiText.copySuccess);
      scheduleCopyToastClear(TOAST_MS_SUCCESS);
    } catch {
      setCopyToast(uiText.copyFailed);
      scheduleCopyToastClear(TOAST_MS_ERROR);
    }
  };

  const showSiteStatus = (message: string, allowRetry = false) => {
    setSiteStatus(message);
    if (siteStatusTimerRef.current) window.clearTimeout(siteStatusTimerRef.current);
    if (!allowRetry) {
      siteStatusTimerRef.current = window.setTimeout(() => setSiteStatus(""), SITE_STATUS_MS);
    }
  };

  const toggleCurrentSiteWhitelist = async () => {
    if (!currentUrl || !currentHost || whitelistBusy) return;
    setWhitelistBusy(true);
    try {
      const settings = await send("settings:get");
      const list = (settings.whitelist || []).map((item) => String(item || "").trim()).filter(Boolean);
      const state = getWhitelistState(list, currentUrl, currentHost);
      const modeEnabled = whitelistMode === "domain" ? state.domainWhitelisted : state.urlWhitelisted;
      const shouldEnable = !modeEnabled;
      const targetEntry = whitelistMode === "domain" ? currentHost : currentUrl;
      const next = shouldEnable
        ? list.includes(targetEntry)
          ? list
          : [...list, targetEntry]
        : list.filter((entry) => entry !== targetEntry);
      const updated = await send("settings:update", { whitelist: next } satisfies Partial<Settings>);
      const nextState = getWhitelistState(updated.whitelist || [], currentUrl, currentHost);
      setDomainWhitelisted(nextState.domainWhitelisted);
      setUrlWhitelisted(nextState.urlWhitelisted);
      const modeText = whitelistMode === "domain" ? "整站" : "仅此页";
      showSiteStatus(shouldEnable ? `已加入白名单（${modeText}）` : `已移出白名单（${modeText}）`);
      setRetryWhitelistAction(null);
    } catch (error) {
      showSiteStatus(`白名单更新失败：${error instanceof Error ? error.message : String(error)}`, true);
      setRetryWhitelistAction(() => toggleCurrentSiteWhitelist);
    } finally {
      setWhitelistBusy(false);
    }
  };

  useEffect(
    () => () => {
      if (siteStatusTimerRef.current) window.clearTimeout(siteStatusTimerRef.current);
      if (copyToastTimerRef.current) window.clearTimeout(copyToastTimerRef.current);
    },
    []
  );

  const switchEnabled = whitelistMode === "domain" ? domainWhitelisted : urlWhitelisted;
  const switchLabel = switchEnabled ? "ON" : "OFF";
  const domainModeClass = whitelistBusy
    ? whitelistMode === "domain"
      ? UI.modeTabActiveDisabled
      : UI.modeTabIdleDisabled
    : whitelistMode === "domain"
      ? UI.modeTabActive
      : UI.modeTabIdle;
  const urlModeClass = whitelistBusy
    ? whitelistMode === "url"
      ? UI.modeTabActiveDisabled
      : UI.modeTabIdleDisabled
    : whitelistMode === "url"
      ? UI.modeTabActive
      : UI.modeTabIdle;
  const switchClass = whitelistBusy
    ? switchEnabled
      ? UI.switchOnBusy
      : UI.switchOffBusy
    : switchEnabled
      ? UI.switchOn
      : UI.switchOffIdle;
  const switchKnobClass = switchEnabled ? UI.switchKnobOn : UI.switchKnobOff;

  return (
    <div className={UI.shell}>
      <div className={UI.headerRow}>
        <span className={UI.title}>
          <span className={UI.brandMark} aria-hidden>
            P
          </span>
          <span className={UI.brandText}>
            <span className={UI.brandMain}>Polyglot</span>
            <span className={UI.brandSub}>快速翻译</span>
          </span>
        </span>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className={UI.optionsButton}
        >
          设置
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="粘贴/输入文本，自动识别中英方向。"
        className={UI.textarea}
      />
      <div className={UI.resultCard}>
        {copyToast ? (
          <span className={UI.copyToast}>{copyToast}</span>
        ) : null}
        <p className={UI.resultText}>
          {result?.translatedText || "等待输入..."}
        </p>
        <div className={UI.resultMetaRow}>
          <span>
            {result?.provider ? `引擎：${result.provider}${result.fromCache ? "（缓存）" : ""}` : ""}
          </span>
          <button onClick={copyResult} className={UI.subtleButton}>
            复制结果
          </button>
        </div>
        <div className={UI.translateStatus}>{translateStatus}</div>
      </div>
      {whitelistReady ? (
        <div className={UI.card}>
          <div className={UI.cardTitle}>当前站点白名单</div>
          <div className={UI.modeTabsWrap}>
            <button
              type="button"
              onClick={() => setWhitelistMode("domain")}
              disabled={whitelistBusy}
              className={domainModeClass}
            >
              整站
            </button>
            <button
              type="button"
              onClick={() => setWhitelistMode("url")}
              disabled={whitelistBusy}
              className={urlModeClass}
            >
              仅此页
            </button>
          </div>
          <div className={UI.whitelistRow}>
            <div className={UI.whitelistTextWrap}>
              <p className={UI.whitelistHost}>{currentHost}</p>
              <p className={UI.whitelistDesc}>
                {whitelistMode === "domain"
                  ? domainWhitelisted
                    ? "整站已加入白名单（站点下页面不触发划词/气泡）"
                    : "整站未加入白名单"
                  : urlWhitelisted
                    ? "当前页面已加入白名单"
                    : "当前页面未加入白名单"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={switchEnabled}
              aria-label={`切换 ${currentHost} 白名单（${whitelistMode === "domain" ? "整站" : "仅此页"}）`}
              disabled={whitelistBusy}
              onClick={() => void toggleCurrentSiteWhitelist()}
              className={switchClass}
            >
              <span className={UI.switchLabel}>{switchLabel}</span>
              <span className={switchKnobClass} />
            </button>
          </div>
          <p className={UI.cardHintMt}>
            当前命中：{domainWhitelisted ? "整站" : ""}
            {domainWhitelisted && urlWhitelisted ? " + " : ""}
            {urlWhitelisted ? "仅此页" : ""}
            {!domainWhitelisted && !urlWhitelisted ? "无" : ""}
          </p>
          {siteStatus ? (
            <div className={UI.siteStatusRow}>
              <p className={UI.siteStatusText}>{siteStatus}</p>
              {retryWhitelistAction ? (
                <button
                  type="button"
                  disabled={whitelistBusy}
                  onClick={() => void retryWhitelistAction()}
                  className={UI.retryButton}
                >
                  重试
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {commandRows.length > 0 ? (
        <div className={UI.card}>
          <div className={UI.cardTitle}>键盘快捷方式</div>
          <ul className={UI.commandList}>
            {commandRows.map((row) => (
              <li key={row.name} className={UI.commandItem}>
                <span className={UI.commandDesc}>{row.description}</span>
                <kbd className={UI.kbd}>{row.shortcut || "未绑定"}</kbd>
              </li>
            ))}
          </ul>
          <p className={UI.cardHintMt}>
            若显示「未绑定」或与记忆不一致，请到{" "}
            <span className={UI.shortcutsLink}>chrome://extensions/shortcuts</span> 为 Polyglot 指定按键。
          </p>
        </div>
      ) : null}
      <div className={UI.footer}>
        <button
          className={UI.optionsButton}
          onClick={async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id }).catch(() => undefined);
          }}
        >
          打开侧边栏
        </button>
        <span className={UI.footerVersion}>v1.0</span>
      </div>
    </div>
  );
}

function getWhitelistState(whitelist: string[], href: string, host: string): {
  domainWhitelisted: boolean;
  urlWhitelisted: boolean;
} {
  let domainWhitelisted = false;
  let urlWhitelisted = false;
  whitelist.forEach((entry) => {
    const raw = String(entry || "").trim();
    if (!raw) return;
    if (raw.includes("://")) {
      if (raw === href) urlWhitelisted = true;
      return;
    }
    const domain = raw.toLowerCase();
    if (host === domain || host.endsWith(`.${domain}`)) domainWhitelisted = true;
  });
  return { domainWhitelisted, urlWhitelisted };
}
