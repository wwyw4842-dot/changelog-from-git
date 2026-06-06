import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { LatestTab } from "./pages/Latest";
import { HistoryTab } from "./pages/History";
import { VocabularyTab } from "./pages/Vocabulary";
import { ChatTab } from "./pages/Chat";
import { PracticeTab } from "./pages/Practice";
import { ReviewArticlesTab } from "./pages/ReviewArticles";
import { WritingTab } from "./pages/Writing";
import { WritingAnalysisTab } from "./pages/WritingAnalysis";
import { send } from "@shared/messaging";
import { t } from "@shared/i18n";
import { useRipple } from "@shared/useRipple";
import { useTheme } from "@shared/useTheme";
import type { Settings } from "@shared/types";

const BASE_TABS = [
  { id: "latest", label: "sidepanel.tab.latest", ieltsOnly: false },
  { id: "history", label: "sidepanel.tab.history", ieltsOnly: false },
  { id: "vocab", label: "sidepanel.tab.vocab", ieltsOnly: false },
  { id: "practice", label: "sidepanel.tab.practice", ieltsOnly: false },
  { id: "reviewArticles", label: "sidepanel.tab.reviewArticles", ieltsOnly: false },
  { id: "writing", label: "sidepanel.tab.writing", ieltsOnly: true },
  { id: "writingAnalysis", label: "sidepanel.tab.writingAnalysis", ieltsOnly: false },
  { id: "chat", label: "sidepanel.tab.chat", ieltsOnly: false },
] as const;

type TabId = (typeof BASE_TABS)[number]["id"];

const UI = {
  shell: "relative flex h-full flex-col text-ink-900",
  header:
    "sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-cream-300/70 bg-cream-100/80 px-5 py-3 backdrop-blur-xl",
  brandRow: "flex items-center gap-2.5",
  brandMark:
    "relative grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold text-white shadow-coral bg-gradient-to-br from-brand-400 to-brand-600",
  brandText: "flex flex-col leading-tight",
  brandMain:
    "poly-serif poly-letter-reveal text-[18px] font-semibold tracking-tight text-ink-900",
  brandSuffix:
    "text-[10px] font-medium uppercase tracking-[0.22em] text-brand-600/80",
  titleSub: "hidden sm:flex items-center gap-2 text-[11px] text-ink-500",
  onlineDot:
    "relative h-1.5 w-1.5 rounded-full bg-sage-500 poly-pulse-dot text-sage-500",
  tabsBar:
    "poly-scroll sticky top-[60px] z-20 flex items-center gap-3 overflow-x-auto border-b border-cream-300/70 bg-cream-50/70 px-4 py-2.5 backdrop-blur-xl",
  tabRail: "relative flex items-center gap-3",
  tabButton:
    "poly-serif relative whitespace-nowrap px-1 py-1.5 text-[13px] font-medium transition-colors",
  tabActive: "text-brand-600 poly-ink-underline",
  tabIdle: "text-ink-500 hover:text-ink-900",
  tabSliderShadow:
    "pointer-events-none absolute -inset-x-1 -inset-y-1 rounded-lg bg-cream-200/0 transition-all duration-300",
  main: "poly-scroll relative flex-1 overflow-y-auto px-4 py-4",
  mainInner: "poly-fade-up",
} as const;

export function SidePanelApp() {
  useRipple();
  const [active, setActive] = useState<TabId>("latest");
  const [ieltsMode, setIeltsMode] = useState(false);
  const [theme, setTheme] = useState<Settings["theme"]>("system");
  useTheme(theme);
  const tabRailRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Map<TabId, HTMLButtonElement>>(new Map());
  const [hover, setHover] = useState<{ x: number; w: number; opacity: number }>({
    x: 0,
    w: 0,
    opacity: 0,
  });

  useEffect(() => {
    void send("settings:get").then((s) => {
      setIeltsMode(Boolean(s.ieltsMode));
      setTheme(s.theme || "system");
    });
    const listener = (changes: { [k: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "sync" || area === "local") {
        if (changes.settings) {
          const next = changes.settings.newValue as { ieltsMode?: boolean; theme?: Settings["theme"] } | undefined;
          setIeltsMode(Boolean(next?.ieltsMode));
          if (next?.theme) setTheme(next.theme);
        }
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const tabs = useMemo(
    () =>
      BASE_TABS.filter((tab) => !tab.ieltsOnly || ieltsMode).map((tab) => ({
        ...tab,
        display: t(tab.label),
      })),
    [ieltsMode]
  );

  const measureHover = useCallback((id: TabId | null) => {
    const rail = tabRailRef.current;
    if (!rail || !id) {
      setHover((h) => ({ ...h, opacity: 0 }));
      return;
    }
    const btn = tabRefs.current.get(id);
    if (!btn) return;
    const railRect = rail.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setHover({
      x: btnRect.left - railRect.left,
      w: btnRect.width,
      opacity: 1,
    });
  }, []);

  useLayoutEffect(() => {
    measureHover(active);
  }, [active, tabs.length, measureHover]);

  useEffect(() => {
    const onResize = () => measureHover(active);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, measureHover]);

  return (
    <div className={UI.shell}>
      <header className={UI.header}>
        <div className={UI.brandRow}>
          <span className={UI.brandMark} aria-hidden>
            P
          </span>
          <span className={UI.brandText}>
            <span className={UI.brandMain}>Polyglot</span>
            <span className={UI.brandSuffix}>AI · 语言助手</span>
          </span>
        </div>
        <div className={UI.titleSub}>
          <span className={UI.onlineDot} aria-hidden />
          <span>Online</span>
        </div>
      </header>
      <nav className={UI.tabsBar}>
        <div ref={tabRailRef} className={UI.tabRail}>
          <span
            aria-hidden
            className={UI.tabSliderShadow}
            style={{
              transform: `translateX(${hover.x}px)`,
              width: `${hover.w}px`,
              opacity: hover.opacity ? 0.5 : 0,
              background:
                "radial-gradient(120% 80% at 50% 50%, rgba(217,153,137,0.18), transparent 70%)",
            }}
          />
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              onMouseEnter={() => measureHover(tab.id)}
              onMouseLeave={() => measureHover(active)}
              className={`${UI.tabButton} ${active === tab.id ? UI.tabActive : UI.tabIdle}`}
              onClick={() => setActive(tab.id)}
            >
              {tab.display}
            </button>
          ))}
        </div>
      </nav>
      <main className={UI.main}>
        <div key={active} className={UI.mainInner}>
          {active === "latest" && <LatestTab />}
          {active === "history" && <HistoryTab />}
          {active === "vocab" && <VocabularyTab />}
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
