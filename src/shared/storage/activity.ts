import { db } from "./db";
import type { ActivityDay, ActivityStats } from "../types";

export type ActivityField = "queries" | "vocabAdded" | "reviews" | "immersiveTriggers";

function dayKey(ts = Date.now()): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function emptyDay(date: string): ActivityDay {
  return { date, queries: 0, vocabAdded: 0, reviews: 0, immersiveTriggers: 0 };
}

export async function bumpActivity(field: ActivityField, amount = 1): Promise<void> {
  const date = dayKey();
  const existing = (await db.activity.get(date)) ?? emptyDay(date);
  existing[field] = (existing[field] || 0) + amount;
  await db.activity.put(existing);
}

export async function getYearActivity(): Promise<ActivityDay[]> {
  const year = new Date().getFullYear();
  return db.activity
    .where("date")
    .between(`${year}-01-01`, `${year}-12-31`, true, true)
    .toArray();
}

export async function getDailyStats(): Promise<ActivityStats> {
  const today = dayKey();
  const todayRecord = (await db.activity.get(today)) ?? emptyDay(today);

  const last7: ActivityDay[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayKey(d.getTime());
    const record = (await db.activity.get(key)) ?? emptyDay(key);
    last7.push(record);
  }

  const all = await db.activity.toArray();
  const totals = all.reduce(
    (acc, day) => {
      acc.queries += day.queries;
      acc.vocab += day.vocabAdded;
      acc.reviews += day.reviews;
      return acc;
    },
    { queries: 0, vocab: 0, reviews: 0 }
  );

  // 计算连续打卡天数：从今天往前，只要当天有任意活动就继续数
  let streakDays = 0;
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayKey(d.getTime());
    const record = all.find((item) => item.date === key);
    const hasActivity =
      record && (record.queries > 0 || record.vocabAdded > 0 || record.reviews > 0);
    if (hasActivity) {
      streakDays += 1;
    } else if (i === 0) {
      // 今天还没活动，不算断签（今天可能刚打开）
      continue;
    } else {
      break;
    }
  }

  return {
    today: todayRecord,
    last7Days: last7,
    streakDays,
    totals,
  };
}
