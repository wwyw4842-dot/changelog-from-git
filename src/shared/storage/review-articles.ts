import { db } from "./db";
import type { ReviewArticleEntry } from "../types";

const REVIEW_ARTICLE_LIMIT = 300;

export async function addReviewArticle(
  entry: Omit<ReviewArticleEntry, "id" | "createdAt"> & { createdAt?: number }
): Promise<ReviewArticleEntry> {
  const record: ReviewArticleEntry = {
    dayLabel: entry.dayLabel.trim(),
    content: entry.content.trim(),
    provider: entry.provider.trim(),
    words: (entry.words || []).map((w) => w.trim()).filter(Boolean),
    createdAt: entry.createdAt ?? Date.now(),
  };
  const id = (await db.reviewArticles.add(record)) as number;
  const count = await db.reviewArticles.count();
  if (count > REVIEW_ARTICLE_LIMIT) {
    const extras = await db.reviewArticles
      .orderBy("createdAt")
      .limit(count - REVIEW_ARTICLE_LIMIT)
      .toArray();
    await db.reviewArticles.bulkDelete(extras.map((e) => e.id!).filter(Boolean));
  }
  return { ...record, id };
}

export async function listReviewArticles(options: { limit?: number } = {}): Promise<ReviewArticleEntry[]> {
  const limit = options.limit ?? 200;
  return db.reviewArticles.orderBy("createdAt").reverse().limit(limit).toArray();
}

export async function removeReviewArticle(id: number): Promise<void> {
  await db.reviewArticles.delete(id);
}
