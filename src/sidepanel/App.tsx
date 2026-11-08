import { useEffect, useMemo, useRef, useState } from "react";
import { LatestTab } from "./pages/Latest";
import { HistoryTab } from "./pages/History";
import { VocabularyTab } from "./pages/Vocabulary";
import { ChatTab } from "./pages/Chat";
import { PracticeTab } from "./pages/Practice";
import { ReviewArticlesTab } from "./pages/ReviewArticles";
import { WritingTab } from "./pages/Writing";
import { WritingAnalysisTab } from "./pages/WritingAnalysis";
import { Dashboard } from "./pages/Dashboard";
import { send } from "@shared/messaging";
import { t } from "@shared/i18n";
import { useRipple } from "@shared/useRipple";
import { useTheme } from "@shared/useTheme";
import type { Settings } from "@shared/types";

const PRIMARY_TABS = [
  { id: "latest", label: "sidepanel.tab.latest", ieltsOnly: false },
  { id: "vocab", label: "sidepanel.tab.vocab", ieltsOnly: false },
  { id: "history", label: "sidepanel.tab.history", ieltsOnly: false },
] as const;

const MORE_TABS = [
  { id: "overview", label: "sidepanel.tab.overview", ieltsOnly: false },
  { id: "practice", label: "sidepanel.tab.practice", ieltsOnly: false },
  { id: "reviewArticles", label: "sidepanel.tab.reviewArticles", ieltsOnly: false },
  { id: "writing", label: "sidepanel.tab.writing", ieltsOnly: true },
  { id: "writingAnalysis", label: "sidepanel.tab.writingAnalysis", ieltsOnly: false },
  { id: "chat", label: "sidepanel.tab.chat", ieltsOnly: false },
] as const;

type PrimaryTabId = (typeof PRIMARY_TABS)[number]["id"];
type MoreTabId = (typeof MORE_TABS)[number]["id"];
type TabId = PrimaryTabId | MoreTabId;

const TAB_STORAGE_KEY = "foliole-sidepanel-tab";

function isTabId(value: string | null): value is TabId {
  return [...PRIMARY_TABS, ...MORE_TABS].some((tab) => tab.id === value);
}

function initialTab(): TabId {
  if (typeof window === "undefined") return "latest";
  const saved = window.localStorage.getItem(TAB_STORAGE_KEY);
  return isTabId(saved) ? saved : "latest";
}

export function SidePanelApp() {
  useRipple();
  const [active, setActive] = useState<TabId>(initialTab);
  const [ieltsMode, setIeltsMode] = useState(false);
  const [settingsState, setSettingsState] = useState<"loading" | "ready" | "error">("loading");
  const [theme, setTheme] = useState<Settings["theme"]>("system");
  const moreMenuRef = useRef<HTMLDetailsElement | null>(null);
  useTheme(theme);

  useEffect(() => {
    window.localStorage.setItem(TAB_STORAGE_KEY, active);
  }, [active]);

  useEffect(() => {
    void send("settings:get")
      .then((settings) => {
        setIeltsMode(Boolean(settings.ieltsMode));
        setTheme(settings.theme || "system");
        setSettingsState("ready");
      })
      .catch(() => setSettingsState("error"));
    const listener = (changes: { [k: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "sync" && area !== "local") return;
      if (!changes.settings) return;
      const next = changes.settings.newValue as
        | { ieltsMode?: boolean; theme?: Settings["theme"] }
        | undefined;
      setIeltsMode(Boolean(next?.ieltsMode));
      if (next?.theme) setTheme(next.theme);
      setSettingsState("ready");
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    const closeMoreMenu = (event: MouseEvent | KeyboardEvent) => {
      const menu = moreMenuRef.current;
      if (!menu?.open) return;
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        menu.removeAttribute("open");
        (menu.querySelector("summary") as HTMLElement | null)?.focus();
        return;
      }
      if (event instanceof MouseEvent && !menu.contains(event.target as Node)) {
        menu.removeAttribute("open");
      }
    };
    document.addEventListener("mousedown", closeMoreMenu);
    document.addEventListener("keydown", closeMoreMenu);
    return () => {
      document.removeEventListener("mousedown", closeMoreMenu);
      document.removeEventListener("keydown", closeMoreMenu);
    };
  }, []);

  const primaryTabs = useMemo(
    () =>
      PRIMARY_TABS.filter((tab) => !tab.ieltsOnly || ieltsMode).map((tab) => ({
        ...tab,
        display: t(tab.label),
      })),
    [ieltsMode]
  );

  const moreTabs = useMemo(
    () =>
      MORE_TABS.filter((tab) => !tab.ieltsOnly || ieltsMode).map((tab) => ({
        ...tab,
        display: t(tab.label),
      })),
    [ieltsMode]
  );

  useEffect(() => {
    if (settingsState !== "loading" && !ieltsMode && active === "writing") setActive("latest");
  }, [active, ieltsMode, settingsState]);

  const navigate = (tab: TabId) => {
    setActive(tab);
    moreMenuRef.current?.removeAttribute("open");
  };

  const movePrimaryFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[nextIndex]?.focus();
    tabs[nextIndex]?.click();
  };

  const activeMore = moreTabs.find((tab) => tab.id === active);
  const activePrimary = primaryTabs.find((tab) => tab.id === active);

  return (
    <div className="foliole-shell">
      <header className="foliole-header">
        <div className="foliole-header-row">
          <div className="foliole-brand">
            <img
              className="foliole-brand-mark"
              src="/public/icons/foliole-icon.svg"
              alt=""
              aria-hidden
            />
            <span className="foliole-brand-name">Foliole</span>
          </div>
          <div className="foliole-header-actions">
            <span className={`foliole-status ${settingsState === "ready" ? "" : "is-pending"}`}>
              <span aria-hidden />
              {t(`sidepanel.status.${settingsState}`)}
            </span>
            <details ref={moreMenuRef} className="foliole-more">
              <summary className={activeMore ? "is-active" : ""}>
                {activeMore?.display || t("sidepanel.more")}
              </summary>
              <div className="foliole-more-menu" role="menu">
                <div className="foliole-more-label">{t("sidepanel.more.label")}</div>
                {moreTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="menuitem"
                    aria-current={active === tab.id ? "page" : undefined}
                    className={active === tab.id ? "is-active" : ""}
                    onClick={() => navigate(tab.id)}
                  >
                    {tab.display}
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
        <p className="foliole-tagline">{t("sidepanel.tagline")}</p>
      </header>

      <nav
        className="foliole-primary-tabs"
        role="tablist"
        aria-label={t("sidepanel.navigation")}
        aria-orientation="horizontal"
        onKeyDown={movePrimaryFocus}
      >
        {primaryTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`foliole-tab-${tab.id}`}
            aria-selected={active === tab.id}
            aria-controls="foliole-active-panel"
            tabIndex={active === tab.id || (activeMore && tab.id === "latest") ? 0 : -1}
            className={active === tab.id ? "is-active" : ""}
            onClick={() => navigate(tab.id)}
          >
            {tab.display}
          </button>
        ))}
      </nav>

      <main
        id="foliole-active-panel"
        className="foliole-main poly-scroll"
        role="tabpanel"
        aria-labelledby={activePrimary ? `foliole-tab-${activePrimary.id}` : undefined}
        aria-label={activeMore?.display}
      >
        <div key={active} className="foliole-panel-enter">
          {active === "latest" && <LatestTab onNavigate={navigate} />}
          {active === "vocab" && <VocabularyTab />}
          {active === "history" && <HistoryTab onNavigate={() => navigate("latest")} />}
          {active === "overview" && <Dashboard />}
          {active === "practice" && <PracticeTab />}
          {active === "reviewArticles" && <ReviewArticlesTab />}
          {active === "writing" && <WritingTab />}
          {active === "writingAnalysis" && <WritingAnalysisTab />}
          {active === "chat" && <ChatTab />}
        </div>
      </main>
    </div>
  );
}
