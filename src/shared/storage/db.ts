import Dexie, { type EntityTable } from "dexie";
import type { ActivityDay, HistoryEntry, ReviewArticleEntry, VocabularyEntry } from "../types";

export class PolyglotDB extends Dexie {
  history!: EntityTable<HistoryEntry, "id">;
  vocabulary!: EntityTable<VocabularyEntry, "id">;
  activity!: EntityTable<ActivityDay, "date">;
  reviewArticles!: EntityTable<ReviewArticleEntry, "id">;

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
  }
}

export const db = new PolyglotDB();
