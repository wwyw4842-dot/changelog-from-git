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

const NAV: {
  key: SectionKey;
  label: string;
  description: string;
  title: string;
  introduction: string;
}[] = [
  {
    key: "general",
    label: "通用",
    description: "翻译习惯与外观",
    title: "通用设置",
    introduction: "调整划词方式、语言、界面外观和学习目标。",
  },
  {
    key: "providers",
    label: "翻译服务",
    description: "选择并连接服务",
    title: "翻译服务",
    introduction: "为快速翻译、深度解读和学习功能选择合适的服务。",
  },
  {
    key: "shortcuts",
    label: "快捷键",
    description: "更快打开常用能力",
    title: "快捷键",
    introduction: "用键盘完成翻译、整页阅读和深度解读。",
  },
  {
    key: "advanced",
    label: "功能与数据",
    description: "扩展能力和数据管理",
    title: "功能与数据",
    introduction: "管理阅读辅助功能，并导出或清理本地数据。",
  },
];

export function OptionsApp() {
  useRipple();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  useTheme(settings.theme);
  const [active, setActive] = useState<SectionKey>("general");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [panelStatus, setPanelStatus] = useState<"idle" | "opening" | "opened" | "error">("idle");

  useEffect(() => {
    send("settings:get").then(setSettings).catch(console.error);
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = await send("settings:update", patch);
    setSettings(next);
    setSavedAt(Date.now());
  };

  const openLearningPanel = async () => {
    setPanelStatus("opening");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !chrome.sidePanel?.open) throw new Error("Side panel is unavailable");
      await chrome.sidePanel.open({ tabId: tab.id });
      setPanelStatus("opened");
    } catch (error) {
      console.error("[foliole] open side panel failed", error);
      setPanelStatus("error");
    }
  };

  const current = NAV.find((item) => item.key === active) ?? NAV[0];

  return (
    <div className="foliole-options-shell">
      <header className="foliole-options-header">
        <div className="foliole-options-header-inner">
          <div className="foliole-options-brand">
            <img
              className="foliole-options-brand-mark"
              src="/public/icons/foliole-icon.svg"
              alt=""
              aria-hidden
            />
            <span className="foliole-options-brand-copy">
              <span className="foliole-options-brand-name">Foliole</span>
              <span className="foliole-options-brand-subtitle">设置中心</span>
            </span>
          </div>
          <div className="foliole-options-header-actions">
            <button
              type="button"
              className="foliole-options-open-panel"
              onClick={openLearningPanel}
              disabled={panelStatus === "opening"}
            >
              <span aria-hidden>→</span>
              {panelStatus === "opening"
                ? "正在打开…"
                : panelStatus === "opened"
                  ? "学习侧栏已打开"
                  : "打开学习侧栏"}
            </button>
            <span
              key={savedAt ?? "auto"}
              className={`foliole-options-save-status ${savedAt ? "is-saved" : ""}`}
              role="status"
              aria-live="polite"
            >
              <span aria-hidden />
              {savedAt ? "已保存" : "自动保存"}
            </span>
          </div>
        </div>
      </header>

      {panelStatus === "error" ? (
        <div className="foliole-options-toast is-error" role="alert">
          暂时无法打开侧栏。请回到普通网页后重试，或点击 Chrome 右上角的侧栏按钮。
        </div>
      ) : null}

      <div className="foliole-options-layout">
        <nav className="foliole-options-nav" aria-label="设置分类">
          <div className="foliole-options-nav-intro">
            <span>设置</span>
            <p>按需要调整 Foliole</p>
          </div>
          <div className="foliole-options-nav-list">
            {NAV.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActive(item.key)}
                className={active === item.key ? "is-active" : ""}
                aria-current={active === item.key ? "page" : undefined}
              >
                <span className="foliole-options-nav-label">{item.label}</span>
                <span className="foliole-options-nav-description">{item.description}</span>
              </button>
            ))}
          </div>
        </nav>

        <main className="foliole-options-main">
          <div className="foliole-options-section-heading">
            <p>Foliole 设置</p>
            <h1>{current.title}</h1>
            <span>{current.introduction}</span>
          </div>
          <section key={active} className="foliole-options-content" aria-label={current.title}>
            {active === "general" && <GeneralSection settings={settings} onUpdate={update} />}
            {active === "providers" && <ProvidersSection settings={settings} onUpdate={update} />}
            {active === "shortcuts" && <ShortcutsSection />}
            {active === "advanced" && <AdvancedSection settings={settings} onUpdate={update} />}
          </section>
        </main>
      </div>
    </div>
  );
}
