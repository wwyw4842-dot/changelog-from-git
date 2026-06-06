import { useEffect, useState } from "react";
import type { ActivityStats } from "@shared/types";
import { send } from "@shared/messaging";
import { useSpotlight, useOdometer } from "@shared/useSpotlight";
import { useTilt } from "@shared/useTilt";
import { sideUi } from "./ui";

export function Dashboard() {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const spotlightRef = useSpotlight<HTMLElement>();
  const tiltRef = useTilt<HTMLDivElement>({ max: 2 });

  const refresh = async () => {
    try {
      const data = await send("stats:daily");
      setStats(data);
    } catch (error) {
      console.warn("[polyglot] stats failed", error);
    }
  };

  useEffect(() => {
    void refresh();
    const listener = (changes: { [k: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === "local" && changes.latestSidePanelResult) void refresh();
    };
    chrome.storage.onChanged.addListener(listener);
    const timer = setInterval(refresh, 30000);
    return () => {
      chrome.storage.onChanged.removeListener(listener);
      clearInterval(timer);
    };
  }, []);

  if (!stats) return null;

  const maxChartValue = Math.max(
    1,
    ...stats.last7Days.map((d) => d.queries + d.vocabAdded + d.reviews)
  );

  return (
    <section ref={spotlightRef} className={`${sideUi.dashboardCard} poly-spotlight`}>
      <div ref={tiltRef} className="poly-tilt-host">
        <header className={sideUi.dashboardHeader}>
          <div className={sideUi.dashboardHeaderLeft}>
            <span className={sideUi.dashboardTitle}>今日学习</span>
            <StreakBadge days={stats.streakDays} />
          </div>
          <span className={sideUi.dashboardSummary}>
            累计 {stats.totals.queries} 次查词 · {stats.totals.vocab} 生词
          </span>
        </header>

        <div className={sideUi.dashboardMetricsGrid}>
          <Metric label="查词" value={stats.today.queries} tone="blue" />
          <Metric label="新生词" value={stats.today.vocabAdded} tone="emerald" />
          <Metric label="已复习" value={stats.today.reviews} tone="amber" />
        </div>

        <div className={sideUi.dashboardChartWrap}>
          <div className={sideUi.dashboardChartHeader}>
            <span>近 7 天活跃度</span>
            <span>查词+生词+复习</span>
          </div>
          <div className={sideUi.dashboardChartBars}>
            {stats.last7Days.map((day) => {
              const sum = day.queries + day.vocabAdded + day.reviews;
              const ratio = sum / maxChartValue;
              const label = day.date.slice(5);
              return (
                <div key={day.date} className={sideUi.dashboardChartBarItem}>
                  <div
                    title={`${day.date}\n查词 ${day.queries} · 生词 ${day.vocabAdded} · 复习 ${day.reviews}`}
                    className={`${sideUi.dashboardChartBarBase} ${
                      sum > 0 ? sideUi.dashboardChartBarActive : sideUi.dashboardChartBarIdle
                    }`}
                    style={{ height: `${Math.max(4, ratio * 100)}%`, minHeight: 3 }}
                  />
                  <span className={sideUi.dashboardChartLabel}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "blue"
      ? sideUi.dashboardMetricBlueCard
      : tone === "emerald"
        ? sideUi.dashboardMetricEmeraldCard
        : sideUi.dashboardMetricAmberCard;
  const displayed = useOdometer(value);
  return (
    <div className={toneClass}>
      <div className={sideUi.dashboardMetricLabel}>{label}</div>
      <div className={sideUi.dashboardMetricValue}>{displayed}</div>
    </div>
  );
}

function StreakBadge({ days }: { days: number }) {
  if (days <= 0) {
    return (
      <span className={sideUi.streakEmptyBadge}>今天开始打卡吧</span>
    );
  }
  const hot = days >= 7;
  return (
    <span
      className={hot ? sideUi.streakHotBadge : sideUi.streakWarmBadge}
      title="连续学习天数"
    >
      连续 {days} 天
    </span>
  );
}
