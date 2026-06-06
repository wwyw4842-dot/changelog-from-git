import type { MessageRouter } from "@shared/messaging";
import {
  addVocabulary,
  listVocabulary,
  removeVocabulary,
  reviewVocabulary,
  updateVocabulary,
} from "@shared/storage/vocabulary";
import { bumpActivity, getDailyStats } from "@shared/storage/activity";
import { db } from "@shared/storage/db";
import { getSettings } from "@shared/storage/settings";
import { addReviewArticle, listReviewArticles, removeReviewArticle } from "@shared/storage/review-articles";
import { generateVocabularyExamples } from "../vocab-examples";

export function registerVocabularyHandlers(router: MessageRouter): void {
  router.on("vocabulary:add", async (payload) => {
    const entry = await addVocabulary({
      word: payload.word,
      translation: payload.translation,
      context: payload.context,
      phonetic: payload.phonetic,
      tags: payload.tags,
      examples: payload.examples,
    });
    void bumpActivity("vocabAdded");
    if (entry.id && !entry.examples?.length) {
      void enrichVocabularyExamplesAfterAdd(entry.id);
    }
    return entry;
  });
  router.on("vocabulary:list", async (payload) => listVocabulary(payload));
  router.on("vocabulary:review", async ({ id, quality }) => {
    const entry = await reviewVocabulary(id, quality);
    void bumpActivity("reviews");
    return entry;
  });
  router.on("vocabulary:remove", async ({ id }) => removeVocabulary(id));
  router.on("vocabulary:update", async ({ id, patch }) => updateVocabulary(id, patch));
  router.on("vocabulary:examples:regen", async ({ id }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const settings = await getSettings();
      const row = await db.vocabulary.get(id);
      if (!row) throw new Error("生词记录不存在");
      const examples = await generateVocabularyExamples(
        { ...row, examples: [] },
        settings,
        controller.signal
      );
      return updateVocabulary(id, { examples });
    } finally {
      clearTimeout(timer);
    }
  });
  router.on("vocabulary:words", async () => {
    const list = await listVocabulary({ limit: 5000 });
    return list.map((item) => item.word).filter(Boolean);
  });
  router.on("reviewArticle:add", async ({ dayLabel, content, provider, words }) => {
    if (!content?.trim()) {
      throw new Error("复习文章内容不能为空");
    }
    return addReviewArticle({ dayLabel, content, provider, words });
  });
  router.on("reviewArticle:list", async ({ limit }) => listReviewArticles({ limit }));
  router.on("reviewArticle:remove", async ({ id }) => removeReviewArticle(id));
  router.on("stats:daily", async () => getDailyStats());
}

async function enrichVocabularyExamplesAfterAdd(id: number): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const settings = await getSettings();
    const row = await db.vocabulary.get(id);
    if (!row) return;
    if (row.examples && row.examples.length > 0) return;
    const examples = await generateVocabularyExamples(row, settings, controller.signal);
    if (!examples.length) return;
    await updateVocabulary(id, { examples });
  } catch (error) {
    console.warn("[polyglot] vocab examples enrich failed", error);
  } finally {
    clearTimeout(timer);
  }
}
