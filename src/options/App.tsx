import { useEffect, useState } from "react";
import { send } from "@shared/messaging";
import type { Settings } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/types";
import { GeneralSection } from "./sections/GeneralSection";
import { ProvidersSection } from "./sections/ProvidersSection";
import { ShortcutsSection } from "./sections/ShortcutsSection";
import { AdvancedSection } from "./sections/AdvancedSection";
import { useRipple } from "@shared/useRipple";
import { useTheme } from "@shared/useTheme";

type SectionKey = "general" | "providers" | "shortcuts" | "advanced";

const UI = {
  shell: "min-h-screen text-ink-900",
  surface:
    "sticky top-0 z-20 border-b border-cream-300/70 bg-cream-100/80 backdrop-blur-xl",
  headerInner: "mx-auto flex max-w-4xl items-center justify-between px-6 py-4",
  brandWrap: "flex items-center gap-3",
  brandMark:
    "relative grid h-9 w-9 place-items-center rounded-full text-[14px] font-bold text-white shadow-coral bg-gradient-to-br from-brand-400 to-brand-600",
  brandStack: "flex flex-col leading-tight",
  brandTitle:
    "poly-serif poly-letter-reveal text-[20px] font-bold tracking-tight text-ink-900",
  brandMain: "text-ink-900",
  brandSuffix: "text-brand-600/80 text-[11px] font-medium uppercase tracking-[0.2em] ml-1",
  brandSub:
    "text-[11px] font-medium uppercase tracking-[0.2em] text-brand-600/80 mt-0.5",
  saveStatusDone:
    "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 poly-fade-up",
  saveStatusAuto:
    "rounded-full bg-cream-200 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500 ring-1 ring-inset ring-cream-300",
  bodyWrap: "mx-auto flex max-w-4xl gap-6 px-6 py-8",
  nav: "w-52 shrink-0 space-y-1 text-sm",
  content: "flex-1 space-y-4 poly-stagger",
  navItemActiveButton:
    "poly-serif relative block w-full rounded-xl px-3.5 py-2 text-left text-[14px] font-semibold transition bg-cream-100 text-brand-700 shadow-softer ring-1 ring-inset ring-brand-200",
  navItemIdleButton:
    "poly-serif relative block w-full rounded-xl px-3.5 py-2 text-left text-[14px] text-ink-500 transition hover:bg-cream-100/70 hover:text-ink-900",
} as const;

const NAV: { key: SectionKey; label: string }[] = [
  { key: "general", label: "通用" },
  { key: "providers", label: "翻译引擎" },
  { key: "shortcuts", label: "快捷键" },
  { key: "advanced", label: "高级 / 数据" },
];

export function OptionsApp() {
  useRipple();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useTheme(settings.theme);
  const [active, setActive] = useState<SectionKey>("general");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    send("settings:get").then(setSettings).catch(console.error);
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await send("settings:update", patch);
    setSettings(next);
    setSavedAt(Date.now());
  };

  return (
    <div className={UI.shell}>
      <header className={UI.surface}>
        <div className={UI.headerInner}>
          <div className={UI.brandWrap}>
            <span className={UI.brandMark} aria-hidden>
              P
            </span>
            <span className={UI.brandStack}>
              <span className={UI.brandTitle}>Polyglot</span>
              <span className={UI.brandSub}>AI · 设置中心</span>
            </span>
          </div>
          <span
            key={savedAt ?? "auto"}
            className={savedAt ? UI.saveStatusDone : UI.saveStatusAuto}
          >
            {savedAt ? "已保存" : "自动保存"}
          </span>
        </div>
      </header>
      <div className={UI.bodyWrap}>
        <nav className={UI.nav}>
          {NAV.map((item) => (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className={active === item.key ? UI.navItemActiveButton : UI.navItemIdleButton}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <section key={active} className={UI.content}>
          {active === "general" && <GeneralSection settings={settings} onUpdate={update} />}
          {active === "providers" && <ProvidersSection settings={settings} onUpdate={update} />}
          {active === "shortcuts" && <ShortcutsSection />}
          {active === "advanced" && <AdvancedSection settings={settings} onUpdate={update} />}
        </section>
      </div>
    </div>
  );
}
