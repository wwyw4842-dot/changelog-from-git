import { db } from "./db";
import { ulid } from "../ulid";
import type { VocabularyEntry, ReviewRating } from "../types";
export { syncVocabularyWithFolio } from "./vocabulary-sync";

// Called inside the same transaction as the local vocabulary change.
export async function queueVocabularyCapture(record: VocabularyEntry & { id: number }, capturedAt = record.addedAt): Promise<void> {
  const eventId = ulid();
  await db.syncOutbox.add({
    eventId, vocabularyId: record.id, kind: "capture",
    payload: {
      eventId, word: record.word, translation: record.translation,
      phonetic: record.phonetic || "", context: record.context || "",
      url: record.url ?? null, pageTitle: record.pageTitle ?? null, domain: record.domain ?? null,
      addedAt: new Date(capturedAt).toISOString(),
      ...(record.expressionId ? { expressionId: record.expressionId } : {}),
    },
  });
}

export async function ensureVocabularyCapture(entry: VocabularyEntry & { id: number }): Promise<void> {
  if (entry.expressionId) return;
  const pending = await db.syncOutbox.where("vocabularyId").equals(entry.id).toArray();
  if (!pending.some(event => event.kind === "capture")) await queueVocabularyCapture(entry);
}

export async function addVocabulary(entry: Partial<VocabularyEntry> & { word: string; translation: string }): Promise<VocabularyEntry> {
  return db.transaction("rw", db.vocabulary, db.syncOutbox, async () => {
    const word = entry.word.trim();
    const existing = await db.vocabulary.where("word").equalsIgnoreCase(word).first();
    const now = Date.now();
    if (existing?.id) await ensureVocabularyCapture({ ...existing, id: existing.id });
    const record: VocabularyEntry = {
      ...(existing || { addedAt: now, nextReviewAt: now, easeFactor: 2.5, interval: 0, reps: 0, lapses: 0 }),
      word, translation: entry.translation.trim(),
      context: entry.context?.trim() ?? existing?.context ?? "",
      phonetic: entry.phonetic ?? existing?.phonetic ?? "",
      examples: entry.examples ?? existing?.examples,
      tags: entry.tags ?? existing?.tags ?? [],
      url: entry.url ?? null,
      pageTitle: entry.pageTitle ?? null,
      domain: entry.domain ?? null,
      removedAt: undefined, synced: false,
    };
    const id = (await db.vocabulary.put(record)) as number;
    await queueVocabularyCapture({ ...record, id }, now);
    return { ...record, id };
  });
}

export async function listVocabulary(options: { due?: boolean; limit?: number } = {}): Promise<VocabularyEntry[]> {
  const limit = options.limit ?? 500;
  if (options.due) {
    return db.vocabulary.filter(entry => !entry.removedAt && !entry.pendingReview &&
      (!entry.review || entry.nextReviewAt <= Date.now())).limit(limit).toArray();
  }
  return db.vocabulary.orderBy("addedAt").reverse().filter(entry => !entry.removedAt).limit(limit).toArray();
}

export async function removeVocabulary(id: number): Promise<void> {
  // Keep the mapping and pending evidence; this hides the card only in Foliole.
  await db.vocabulary.update(id, { removedAt: Date.now() });
}

export async function updateVocabulary(id: number, patch: Partial<VocabularyEntry>): Promise<VocabularyEntry> {
  return db.transaction("rw", db.vocabulary, db.syncOutbox, async () => {
    const entry = await db.vocabulary.get(id);
    if (!entry) throw new Error("Vocabulary entry not found");
    if (patch.word !== undefined && patch.word.trim().toLowerCase() !== entry.word.toLowerCase()) {
      throw new Error("如需更换单词，请从本机移除后重新添加；Folio 的原学习记录会保留。");
    }
    const sharedFieldsChanged = ["word", "translation", "context", "phonetic"].some(key => key in patch);
    const merged = { ...entry, ...patch, id, synced: sharedFieldsChanged ? false : entry.synced };
    await db.vocabulary.put(merged);
    if (sharedFieldsChanged) {
      await ensureVocabularyCapture({ ...entry, id });
      await queueVocabularyCapture(merged, Date.now());
    }
    return merged;
  });
}

export async function reviewVocabulary(id: number, rating: ReviewRating): Promise<VocabularyEntry> {
  const reviewedAt = new Date(Date.now()).toISOString();
  return db.transaction("rw", db.vocabulary, db.syncOutbox, async () => {
    const entry = await db.vocabulary.get(id);
    if (!entry || entry.removedAt) throw new Error("Vocabulary entry not found");
    await ensureVocabularyCapture({ ...entry, id });
    const eventId = ulid();
    await db.syncOutbox.add({
      eventId, vocabularyId: id, kind: "review",
      payload: { eventId, ...(entry.expressionId ? { expressionId: entry.expressionId } : {}), rating, reviewedAt },
    });
    const updated = { ...entry, pendingReview: true, synced: false };
    await db.vocabulary.put(updated);
    return updated;
  });
}
