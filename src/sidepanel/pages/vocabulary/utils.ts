import type { VocabularyEntry } from "@shared/types";
import { sideUi } from "../ui";

// 复习短文生成的流式状态（由主组件持有，传给列表视图与生成卡片）
export type ComposeState = {
  day: string | null;
  text: string;
  streaming: boolean;
  provider?: string;
  words: string[];
  error?: string;
};

// 根据下次复习时间返回徽章颜色样式
export function dueColor(item: VocabularyEntry): string {
  const diff = item.nextReviewAt - Date.now();
  if (diff <= 0) return `${sideUi.badgeBase} bg-amber-500/15 text-amber-300`;
  if (diff < 24 * 60 * 60 * 1000) return `${sideUi.badgeBase} bg-emerald-500/10 text-emerald-300`;
  return `${sideUi.badgeBase} bg-slate-800 text-slate-400`;
}

// 根据下次复习时间返回文案（待复习 / 今日内 / 明天 / N 天后）
export function dueLabel(item: VocabularyEntry): string {
  const diff = item.nextReviewAt - Date.now();
  if (diff <= 0) return "待复习";
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  if (days < 1) return "今日内";
  if (days === 1) return "明天";
  return `${days} 天后`;
}

// 按添加日期分组（新→旧），同组内同样按添加时间倒序
export function groupByDay(items: VocabularyEntry[]): Array<{ day: string; entries: VocabularyEntry[] }> {
  const map = new Map<string, VocabularyEntry[]>();
  const sorted = [...items].sort((a, b) => b.addedAt - a.addedAt);
  for (const entry of sorted) {
    const day = formatDay(entry.addedAt);
    const bucket = map.get(day);
    if (bucket) bucket.push(entry);
    else map.set(day, [entry]);
  }
  return Array.from(map.entries()).map(([day, entries]) => ({ day, entries }));
}

// 时间戳 → 分组标题（今天 / 昨天 / 本地日期）
export function formatDay(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(date, today)) return `今天 · ${date.toLocaleDateString()}`;
  if (isSameDay(date, yesterday)) return `昨天 · ${date.toLocaleDateString()}`;
  return date.toLocaleDateString();
}

// 时间戳 → <input type="date"> 的 value 格式
export function toDateInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// <input type="date"> 的 value → 时间戳（非法输入返回 null）
export function fromDateInput(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}
