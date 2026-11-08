import { useEffect, useState } from "react";
import type { ActivityDay, ActivityStats } from "@shared/types";
import { send } from "@shared/messaging";
import { useSpotlight, useOdometer } from "@shared/useSpotlight";
import { useTilt } from "@shared/useTilt";
import { sideUi } from "./ui";

export function Dashboard() {
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [yearDays, setYearDays] = useState<ActivityDay[]>([]);
  const spotlightRef = useSpotlight<HTMLElement>();
  const tiltRef = useTilt<HTMLDivElement>({ max: 2 });

  const refresh = async () => {
    try {
      const [data, year] = await Promise.all([
        send("stats:daily"),
        send("stats:year"),
      ]);
      setStats(data);
      setYearDays(year);
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

        {yearDays.length > 0 && <YearHeatmap days={yearDays} />}
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

/** 年度打卡热力图：当年 52 周 × 7 天，颜色深浅反映当日活跃度 */
function YearHeatmap({ days }: { days: ActivityDay[] }) {
  const activityMap = new Map<string, number>();
  for (const d of days) {
    activityMap.set(d.date, d.queries + d.vocabAdded + d.reviews);
  }

  const maxActivity = Math.max(1, ...activityMap.values());

  // 构造从今年 1 月 1 日起的完整日期格子（按周排列）
  const year = new Date().getFullYear();
  const jan1 = new Date(year, 0, 1);
  // 调整到该年第一个周日（Sunday = 0）
  const startOffset = jan1.getDay();
  const cells: Array<{ date: string; level: 0 | 1 | 2 | 3 | 4 }> = [];

  // 填充月初空格
  for (let i = 0; i < startOffset; i++) {
    cells.push({ date: "", level: 0 });
  }

  const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
  for (let i = 0; i < daysInYear; i++) {
    const d = new Date(year, 0, i + 1);
    const dateStr = `${year}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const count = activityMap.get(dateStr) ?? 0;
    const ratio = count / maxActivity;
    const level = count === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.75 ? 3 : 4;
    cells.push({ date: dateStr, level: level as 0 | 1 | 2 | 3 | 4 });
  }

  const LEVEL_CLASSES = [
    "bg-cream-200 dark:bg-ink-800",
    "bg-brand-100",
    "bg-brand-200",
    "bg-brand-400",
    "bg-brand-600",
  ];

  // 按列（周）分组渲染
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className={sideUi.heatmapWrap}>
      <div className={sideUi.dashboardChartHeader}>
        <span>{year} 年打卡记录</span>
      </div>
      <div className={sideUi.heatmapGrid}>
        {weeks.map((week, wi) => (
          <div key={wi} className={sideUi.heatmapWeekCol}>
            {week.map((cell, di) => (
              <div
                key={di}
                title={cell.date ? `${cell.date}` : ""}
                className={`${sideUi.heatmapCell} ${LEVEL_CLASSES[cell.level]}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
