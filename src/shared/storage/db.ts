import Dexie, { type EntityTable } from "dexie";
import type { ActivityDay, HistoryEntry, ReviewArticleEntry, VocabularyEntry, SyncOutboxEntry, FolioSyncBinding } from "../types";

export class PolyglotDB extends Dexie {
  history!: EntityTable<HistoryEntry, "id">;
  vocabulary!: EntityTable<VocabularyEntry, "id">;
  activity!: EntityTable<ActivityDay, "date">;
  reviewArticles!: EntityTable<ReviewArticleEntry, "id">;

  syncOutbox!: EntityTable<SyncOutboxEntry, "id">;
  syncBinding!: EntityTable<FolioSyncBinding, "id">;

  constructor() {
    super("polyglot");
    this.version(1).stores({
      history: "++id, ts, provider, from, to",
      vocabulary: "++id, word, addedAt, nextReviewAt",
    });
    this.version(2)
      .stores({
        history: "++id, ts, provider, from, to",
        vocabulary: "++id, word, addedAt, nextReviewAt",
        activity: "&date",
      })
      .upgrade(() => {
        // activity 表首次创建，无需搬迁
      });
    this.version(3)
      .stores({
        history: "++id, ts, provider, from, to",
        vocabulary: "++id, word, addedAt, nextReviewAt",
        activity: "&date",
        reviewArticles: "++id, createdAt, dayLabel, provider",
      })
      .upgrade(() => {
        // reviewArticles 表首次创建，无需搬迁
      });
    this.version(4).stores({
      vocabulary: "++id, word, addedAt, nextReviewAt, expressionId",
      syncOutbox: "++id, &eventId, vocabularyId",
      syncBinding: "&id",
    }).upgrade(async (tx) => {
      await tx.table<VocabularyEntry>("vocabulary").toCollection().modify((entry) => {
        entry.legacyReview = {
          nextReviewAt: entry.nextReviewAt, easeFactor: entry.easeFactor,
          interval: entry.interval, reps: entry.reps, lapses: entry.lapses,
        };
        entry.synced = false;
      });
    });
  }
}

export const db = new PolyglotDB();
