import { z } from "zod";
import { db } from "./db";
import { getFolioAuthToken } from "./folio-pairing";
import { ensureVocabularyCapture } from "./vocabulary";
import type { FolioReview, VocabularyEntry, VocabularySyncResult } from "../types";

const ReviewSchema = z.object({
  algorithm: z.literal("fsrs-6"), dueAt: z.iso.datetime(), intervalDays: z.number().nonnegative(),
  reviewCount: z.number().int().nonnegative(), lapseCount: z.number().int().nonnegative(),
  masteryState: z.string(), updatedAt: z.iso.datetime(),
});
const ItemSchema = z.object({
  expressionId: z.string().min(1), word: z.string().min(1), translation: z.string(), phonetic: z.string(),
  context: z.string(), url: z.string().nullable(), pageTitle: z.string().nullable(), domain: z.string().nullable(),
  savedAt: z.iso.datetime(), review: ReviewSchema,
});
const StateSchema = z.object({
  protocolVersion: z.literal(1), libraryId: z.string().min(1), environment: z.literal("production"),
  algorithm: z.literal("fsrs-6"), desiredRetention: z.number().gt(0).lt(1), items: z.array(ItemSchema),
});
const CaptureResponseSchema = z.object({ item: ItemSchema });
const ReviewResponseSchema = z.object({ expressionId: z.string(), review: ReviewSchema });
const BASE_URL = "http://127.0.0.1:8787/api/v1/sync";
let activeSync: Promise<VocabularySyncResult> | undefined;

async function request(path: string, body?: object): Promise<unknown> {
  const token = await getFolioAuthToken();
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}/${path}`, {
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    ...(Object.keys(headers).length ? { headers } : {}),
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 401) {
    throw new Error(
      token
        ? "Folio 配对码已失效或重置（HTTP 401），请在 Folio 扉页「数据」重新生成配对码，待同步记录已保留。"
        : "尚未与 Folio 配对（HTTP 401），请在 Folio 扉页「数据」生成配对码后填入插件，待同步记录已保留。"
    );
  }
  if (response.status === 403) {
    throw new Error("当前扩展 ID 与 Folio 已配对扩展不一致（HTTP 403），请重新生成配对码，待同步记录已保留。");
  }
  if (!response.ok) throw new Error(`Folio 同步请求失败（HTTP ${response.status}），待同步记录已保留。`);
  return response.json();
}

async function readState() {
  // Chromium omits Origin on privileged extension GETs; POST keeps backend Origin authentication.

  const parsed = StateSchema.safeParse(await request("state", {}));
  if (!parsed.success) throw new Error("连接的 Folio 不支持当前同步协议或不是正式环境，请启动新版正式应用。");
  const state = parsed.data;
  await db.transaction("rw", db.syncBinding, async () => {
    const binding = await db.syncBinding.get("folio");
    if (binding && binding.libraryId !== state.libraryId) throw new Error("Folio 词库与已绑定词库不同，已停止同步，待同步记录已保留。");
    if (!binding) await db.syncBinding.put({ id: "folio", libraryId: state.libraryId });
  });
  return state;
}

function applyReview(entry: VocabularyEntry, review: FolioReview): void {
  if (entry.pendingReview || (entry.review && Date.parse(entry.review.updatedAt) > Date.parse(review.updatedAt))) return;
  entry.review = review;
  entry.nextReviewAt = Date.parse(review.dueAt);
  entry.interval = review.intervalDays;
  entry.reps = review.reviewCount;
  entry.lapses = review.lapseCount;
}

// All callers own an IndexedDB transaction, so pending events and applied state are one snapshot.
async function applyItem(item: z.infer<typeof ItemSchema>, localId?: number): Promise<void> {
  const existing = localId ? await db.vocabulary.get(localId) :
    await db.vocabulary.where("expressionId").equals(item.expressionId).first() ??
    await db.vocabulary.where("word").equalsIgnoreCase(item.word).first();
  const pending = existing?.id ? await db.syncOutbox.where("vocabularyId").equals(existing.id).toArray() : [];
  const entry: VocabularyEntry = existing ?? {
    word: item.word, translation: item.translation, addedAt: Date.parse(item.savedAt),
    nextReviewAt: Date.parse(item.review.dueAt), easeFactor: 2.5, interval: 0, reps: 0, lapses: 0,
  };
  entry.expressionId = item.expressionId;
  entry.pendingReview = pending.some(event => event.kind === "review");
  entry.synced = pending.length === 0;
  if (!pending.some(event => event.kind === "capture")) {
    Object.assign(entry, { word: item.word, translation: item.translation, phonetic: item.phonetic,
      context: item.context, url: item.url, pageTitle: item.pageTitle, domain: item.domain,
      addedAt: Date.parse(item.savedAt) });
  }
  applyReview(entry, item.review);
  await db.vocabulary.put(entry);
}

export function syncVocabularyWithFolio(): Promise<VocabularySyncResult> {
  if (activeSync) return activeSync;
  activeSync = synchronize().finally(() => { activeSync = undefined; });
  return activeSync;
}

async function synchronize(): Promise<VocabularySyncResult> {
  let pushed = 0;
  let pulled = 0;
  let error: string | undefined;
  try {
    // Legacy cards become capture events only; their old SM-2 statistics stay a snapshot.
    await db.transaction("rw", db.vocabulary, db.syncOutbox, async () => {
      for (const entry of await db.vocabulary.toArray()) {
        if (!entry.id || entry.expressionId || entry.removedAt) continue;
        await ensureVocabularyCapture({ ...entry, id: entry.id });
      }
    });
    const initial = await readState();
    const events = await db.syncOutbox.orderBy("id").toArray();
    for (const event of events) {
      if (event.libraryId && event.libraryId !== initial.libraryId) throw new Error("待同步事件属于另一词库，已停止同步。");
      if (!event.libraryId) {
        event.libraryId = initial.libraryId;
        const entry = await db.vocabulary.get(event.vocabularyId);
        if (entry?.expressionId && !event.payload.expressionId) event.payload.expressionId = entry.expressionId;
        if (event.kind === "review" && !event.payload.expressionId) throw new Error("生词尚未取得 Folio 编号，评分已保留，等待重试。");
        // Persist the exact request before any network attempt, including resolved IDs.
        await db.syncOutbox.put(event);
      }
      const body = { libraryId: event.libraryId, ...event.payload };
      if (event.kind === "capture") {
        const response = CaptureResponseSchema.parse(await request("vocabulary", body));
        await db.transaction("rw", db.vocabulary, db.syncOutbox, async () => {
          await db.syncOutbox.delete(event.id!);
          await applyItem(response.item, event.vocabularyId);
        });
      } else {
        const response = ReviewResponseSchema.parse(await request("reviews", body));
        if (response.expressionId !== event.payload.expressionId) throw new Error("Folio 返回的词条编号不匹配，评分已保留。");
        await db.transaction("rw", db.vocabulary, db.syncOutbox, async () => {
          await db.syncOutbox.delete(event.id!);
          const entry = await db.vocabulary.get(event.vocabularyId);
          if (!entry) return;
          const remaining = await db.syncOutbox.where("vocabularyId").equals(event.vocabularyId).toArray();
          entry.pendingReview = remaining.some(row => row.kind === "review");
          entry.synced = remaining.length === 0;
          applyReview(entry, response.review);
          await db.vocabulary.put(entry);
        });
      }
      pushed += 1;
    }
    const state = await readState();
    await db.transaction("rw", db.vocabulary, db.syncOutbox, async () => {
      for (const item of state.items) { await applyItem(item); pulled += 1; }
    });
  } catch (failure) {
    error = failure instanceof z.ZodError ? "Folio 返回的数据格式不兼容，待同步记录已保留。" :
      failure instanceof Error ? failure.message : "Folio 同步失败，待同步记录已保留。";
  }
  const pending = await db.syncOutbox.count();
  return { pushed, pulled, pending, success: !error && pending === 0, ...(error ? { error } : {}) };
}
