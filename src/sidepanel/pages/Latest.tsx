import { useEffect, useState } from "react";
import type { TranslationResult } from "@shared/types";
import { useTilt } from "@shared/useTilt";
import { Dashboard } from "./Dashboard";
import { sideUi } from "./ui";

type LatestPayload = TranslationResult & { from?: string; to?: string; ts?: number };

export function LatestTab() {
  const [data, setData] = useState<LatestPayload | null>(null);

  useEffect(() => {
    chrome.storage.local.get("latestSidePanelResult").then((res) => {
      setData((res.latestSidePanelResult as LatestPayload) || null);
    });
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local" || !changes.latestSidePanelResult) return;
      setData((changes.latestSidePanelResult.newValue as LatestPayload) || null);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  if (!data || !data.originalText) {
    return (
      <div className={sideUi.pageStack}>
        <Dashboard />
        <div className={sideUi.latestEmptyCard}>
          划词后点击“译”按钮或使用右键菜单，最新翻译会显示在这里。
        </div>
      </div>
    );
  }

  return (
    <div className={sideUi.pageStack}>
      <Dashboard />
      <Card pillLabel={`Source • ${data.from || "auto"}`} tone="slate">
        <Value text={data.originalText} />
      </Card>
      <Card
        pillLabel={`Target • ${data.to || "zh-CN"}`}
        tone="emerald"
        highlighted
      >
        <Value text={data.translatedText} large error={Boolean(data.isError)} />
        {data.phonetic && (
          <div className={sideUi.phoneticHint}>音标：{data.phonetic}</div>
        )}
      </Card>
      <div className={sideUi.latestMetaRow}>
        <span>
          {(data.from || "auto").toUpperCase()} → {(data.to || "zh-CN").toUpperCase()}
        </span>
        <span className={sideUi.inlineMetaGroup}>
          <span>引擎：{data.provider || "unknown"}</span>
          <span className={sideUi.dotDivider} />
          <span>{data.ts ? new Date(data.ts).toLocaleTimeString() : ""}</span>
        </span>
      </div>
    </div>
  );
}

function Card({
  pillLabel,
  tone,
  highlighted,
  children,
}: {
  pillLabel: string;
  tone: "slate" | "emerald";
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  const tiltRef = useTilt<HTMLElement>({ max: highlighted ? 2.5 : 1.5 });
  return (
    <section
      ref={tiltRef}
      className={`${sideUi.latestCardBase} poly-tilt-host ${
        highlighted ? sideUi.latestCardHighlight : sideUi.latestCardDefault
      }`}
    >
      <div className={sideUi.latestCardHeader}>
        <span
          className={`${sideUi.latestPillBase} ${
            tone === "emerald" ? sideUi.latestPillEmerald : sideUi.latestPillSlate
          }`}
        >
          {pillLabel}
        </span>
      </div>
      {children}
    </section>
  );
}

function Value({ text, large, error }: { text: string; large?: boolean; error?: boolean }) {
  return (
    <p
      className={`${sideUi.latestValueBase} ${
        large ? sideUi.latestValueLarge : sideUi.latestValueDefault
      } ${error ? sideUi.latestValueError : ""}`}
    >
      {text}
    </p>
  );
}
