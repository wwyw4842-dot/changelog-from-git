import { db } from "./db";
import type { VocabularyEntry } from "../types";

const DEFAULT_EASE = 2.5;

export async function addVocabulary(entry: Partial<VocabularyEntry> & { word: string; translation: string }): Promise<VocabularyEntry> {
  return db.transaction("rw", db.vocabulary, async () => {
    const now = Date.now();
    const word = entry.word.trim();
    const existing = await db.vocabulary.where("word").equals(word).first();
    if (existing?.id !== undefined) {
      const merged: VocabularyEntry = { ...existing, word, translation: entry.translation.trim() };
      if (entry.context !== undefined) merged.context = entry.context.trim();
      if (entry.phonetic !== undefined) merged.phonetic = entry.phonetic;
      if (entry.examples !== undefined) merged.examples = entry.examples;
      if (entry.tags !== undefined) merged.tags = entry.tags;
      await db.vocabulary.put(merged);
      return merged;
    }
    const record: VocabularyEntry = {
      word, translation: entry.translation.trim(), context: entry.context?.trim() || "",
      phonetic: entry.phonetic || "", examples: entry.examples, tags: entry.tags || [],
      addedAt: now, nextReviewAt: now, easeFactor: DEFAULT_EASE, interval: 0, reps: 0, lapses: 0,
    };
    const id = await db.vocabulary.add(record) as number;
    return { ...record, id };
  });
}

export async function listVocabulary(options: { due?: boolean; limit?: number } = {}): Promise<VocabularyEntry[]> {
  const limit = options.limit ?? 500;
  if (options.due) {
    const now = Date.now();
    return db.vocabulary
      .where("nextReviewAt")
      .belowOrEqual(now)
      .limit(limit)
      .toArray();
  }
  return db.vocabulary.orderBy("addedAt").reverse().limit(limit).toArray();
}

export async function removeVocabulary(id: number): Promise<void> {
  await db.vocabulary.delete(id);
}

export async function updateVocabulary(
  id: number,
  patch: Partial<VocabularyEntry>
): Promise<VocabularyEntry> {
  return db.transaction("rw", db.vocabulary, async () => {
    const entry = await db.vocabulary.get(id);
    if (!entry) throw new Error("Vocabulary entry not found");
    const merged: VocabularyEntry = { ...entry, ...patch, id: entry.id };
    await db.vocabulary.put(merged);
    return merged;
  });
}

/**
 * SM-2 间隔重复算法核心。quality 0-5：0~2 表示回忆失败，需要重置。
 */
export async function reviewVocabulary(
  id: number,
  quality: 0 | 1 | 2 | 3 | 4 | 5
): Promise<VocabularyEntry> {
  return db.transaction("rw", db.vocabulary, async () => {
    const entry = await db.vocabulary.get(id);
    if (!entry) {
      throw new Error("Vocabulary entry not found");
    }
    const nextEase = Math.max(
      1.3,
      entry.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    );
  
    let reps = entry.reps;
    let interval: number;
    let lapses = entry.lapses;
  
    if (quality < 3) {
      reps = 0;
      interval = 1;
      lapses = lapses + 1;
    } else {
      reps += 1;
      if (reps === 1) {
        interval = 1;
      } else if (reps === 2) {
        interval = 6;
      } else {
        interval = Math.round(entry.interval * nextEase);
      }
    }
  
    const updated: VocabularyEntry = {
      ...entry,
      reps,
      interval,
      lapses,
      easeFactor: nextEase,
      nextReviewAt: Date.now() + interval * 24 * 60 * 60 * 1000,
    };
    await db.vocabulary.put(updated);
    return updated;
  });
}
