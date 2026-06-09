import { db } from "./db";
import type { HistoryEntry } from "../types";

const HISTORY_LIMIT = 1000;

export async function addHistory(entry: HistoryEntry): Promise<number> {
  const id = (await db.history.add(entry)) as number;
  const count = await db.history.count();
  if (count > HISTORY_LIMIT) {
    const extras = await db.history.orderBy("ts").limit(count - HISTORY_LIMIT).toArray();
    await db.history.bulkDelete(extras.map((e) => e.id!).filter(Boolean));
  }
  return id;
}

export async function listHistory(options: { limit?: number; query?: string } = {}): Promise<HistoryEntry[]> {
  const limit = options.limit ?? 200;
  let collection = db.history.orderBy("ts").reverse();
  if (options.query) {
    const q = options.query.toLowerCase();
    collection = collection.filter(
      (entry) =>
        entry.originalText.toLowerCase().includes(q) ||
        entry.translatedText.toLowerCase().includes(q)
    );
  }
  return collection.limit(limit).toArray();
}

export async function clearHistory(): Promise<void> {
  await db.history.clear();
}
