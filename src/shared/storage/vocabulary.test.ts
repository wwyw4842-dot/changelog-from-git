import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import Dexie from 'dexie';
import { addVocabulary, listVocabulary, removeVocabulary, reviewVocabulary, updateVocabulary, syncVocabularyWithFolio } from './vocabulary';
import { parseFolioPairingCode, setFolioTokenForTest } from './folio-pairing';

const review = { algorithm: 'fsrs-6', dueAt: '2026-10-28T02:01:00.000Z', intervalDays: 0, reviewCount: 3, lapseCount: 1, masteryState: 'learning', updatedAt: '2026-10-28T02:00:00.000Z' };
const item = { expressionId: 'expr-1', word: 'harbor', translation: '港口', phonetic: '/hɑːbə/', context: 'a quiet harbor', url: 'https://original.test/article', pageTitle: 'Original', domain: 'original.test', savedAt: '2026-10-20T00:00:00.000Z', review };
const state = { protocolVersion: 1, libraryId: 'library-1', environment: 'production', algorithm: 'fsrs-6', desiredRetention: 0.9, items: [item] };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => { setFolioTokenForTest(undefined); vi.stubGlobal('fetch', async () => { throw new Error('offline'); }); await db.delete(); await db.open(); });
afterEach(() => { setFolioTokenForTest(undefined); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('durable Folio synchronization', () => {
  it('commits the word and immutable capture together without waiting for a network request', async () => {
    vi.stubGlobal('fetch', () => new Promise(() => undefined));
    const result = await Promise.race([addVocabulary({ word: ' harbor ', translation: ' 港口 ', url: item.url, pageTitle: item.pageTitle, domain: item.domain }), new Promise<null>(resolve => setTimeout(() => resolve(null), 100))]);
    expect(result).not.toBeNull();
    expect(await db.vocabulary.count()).toBe(1);
    const [event] = await db.syncOutbox.toArray();
    expect(event).toMatchObject({ kind: 'capture', vocabularyId: result!.id, payload: { word: 'harbor', translation: '港口', url: item.url, pageTitle: 'Original' } });
    expect(event.payload.addedAt).toBe(new Date(result!.addedAt).toISOString());
    expect(event.eventId).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
  });

  it('retains failed requests and retries the exact event payload after reopening IndexedDB', async () => {
    const record = await addVocabulary({ word: 'harbor', translation: '港口', context: item.context, url: item.url, pageTitle: item.pageTitle, domain: item.domain });
    const requests: string[] = [];
    let fail = true;
    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      if (url.endsWith('/sync/state')) return json(state);
      requests.push(String(options?.body));
      return fail ? json({ error: 'offline' }, 503) : json({ item });
    });
    expect(await syncVocabularyWithFolio()).toMatchObject({ success: false, pending: 1 });
    db.close(); await db.open(); fail = false;
    expect(await syncVocabularyWithFolio()).toMatchObject({ success: true, pushed: 1, pending: 0 });
    expect(requests).toHaveLength(2);
    expect(requests[1]).toBe(requests[0]);
    expect(JSON.parse(requests[0])).toMatchObject({ libraryId: 'library-1', url: item.url, addedAt: new Date(record.addedAt).toISOString() });
    expect(await db.vocabulary.get(record.id!)).toMatchObject({ expressionId: 'expr-1', review, nextReviewAt: Date.parse(review.dueAt), synced: true });
  });

  it('updates existing words from authoritative state, preserves scheduling on repeated capture, and never resurrects local removal', async () => {
    vi.stubGlobal('fetch', async (url: string) => url.endsWith('/sync/state') ? json(state) : json({ item }));
    await syncVocabularyWithFolio();
    const [original] = await listVocabulary();
    const repeated = await addVocabulary({ word: 'HARBOR', translation: '港湾' });
    expect(repeated.id).toBe(original.id);
    expect(repeated.review).toEqual(review);
    expect(repeated.nextReviewAt).toBe(Date.parse(review.dueAt));
    await syncVocabularyWithFolio();
    const advanced = { ...review, dueAt: '2026-11-05T12:34:56.000Z', reviewCount: 8, updatedAt: '2026-10-29T02:00:00.000Z' };
    vi.stubGlobal('fetch', async () => json({ ...state, items: [{ ...item, review: advanced }] }));
    await syncVocabularyWithFolio();
    expect(await db.vocabulary.get(original.id!)).toMatchObject({ review: advanced, nextReviewAt: Date.parse(advanced.dueAt), reps: 8 });
    await removeVocabulary(original.id!);
    await syncVocabularyWithFolio();
    expect(await listVocabulary()).toEqual([]);
  });

  it('stores all four ratings with original times and excludes pending reviews from the due queue', async () => {
    vi.stubGlobal('fetch', async (url: string) => url.endsWith('/sync/state') ? json(state) : json({ item }));
    await syncVocabularyWithFolio();
    const [record] = await listVocabulary();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-28T03:04:05.000Z'));
    for (const rating of ['again', 'hard', 'good', 'easy'] as const) await reviewVocabulary(record.id!, rating);
    const events = await db.syncOutbox.toArray();
    expect(events.map(event => event.payload)).toEqual(['again', 'hard', 'good', 'easy'].map(rating => ({ eventId: expect.any(String), expressionId: 'expr-1', rating, reviewedAt: '2026-10-28T03:04:05.000Z' })));
    expect(new Set(events.map(event => event.eventId)).size).toBe(4);
    expect(await db.vocabulary.get(record.id!)).toMatchObject({ review, pendingReview: true, synced: false });
    expect(await listVocabulary({ due: true })).toEqual([]);
  });

  it.each([{ environment: 'development' }, { protocolVersion: 2 }, { algorithm: 'sm-2' }])('refuses an incompatible backend before sending data: %j', async incompatible => {
    const record = await addVocabulary({ word: 'harbor', translation: '港口' });
    const writes: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, options?: RequestInit) => { if (options?.method === 'POST' && !_url.endsWith('/sync/state')) writes.push(String(options.body)); return json({ ...state, ...incompatible }); });
    expect(await syncVocabularyWithFolio()).toMatchObject({ success: false });
    expect(writes).toEqual([]);
    expect(await db.vocabulary.get(record.id!)).toMatchObject({ synced: false });
  });

  it('refuses to send historical events to a different library', async () => {
    vi.stubGlobal('fetch', async () => json(state)); await syncVocabularyWithFolio();
    await addVocabulary({ word: 'harbor', translation: '港口' });
    const writes: string[] = [];
    vi.stubGlobal('fetch', async (_url: string, options?: RequestInit) => { if (options?.method === 'POST' && !_url.endsWith('/sync/state')) writes.push(String(options.body)); return json({ ...state, libraryId: 'other-library' }); });
    expect(await syncVocabularyWithFolio()).toMatchObject({ success: false, error: expect.stringContaining('词库') });
    expect(writes).toEqual([]);
    expect(await db.syncOutbox.count()).toBe(1);
  });

  it('does not overwrite a newer offline capture or grade when a pull is in flight', async () => {
    vi.stubGlobal('fetch', async () => json(state)); await syncVocabularyWithFolio();
    const [record] = await listVocabulary();
    let resolvePull: ((response: Response) => void) | undefined;
    let reads = 0;
    vi.stubGlobal('fetch', async () => { reads += 1; return reads === 1 ? json(state) : new Promise<Response>(resolve => { resolvePull = resolve; }); });
    const syncing = syncVocabularyWithFolio();
    await vi.waitFor(() => expect(resolvePull).toBeDefined());
    await addVocabulary({ word: 'harbor', translation: 'new local meaning', context: 'new local context' });
    await reviewVocabulary(record.id!, 'easy');
    resolvePull!(json(state)); await syncing;
    expect(await db.vocabulary.get(record.id!)).toMatchObject({ translation: 'new local meaning', context: 'new local context', pendingReview: true, synced: false });
    expect(await db.syncOutbox.count()).toBe(2);
  });
  it('rolls back the local word if the outbox cannot persist', async () => {
    const failWrite = () => { throw new Error('quota exhausted'); };
    db.syncOutbox.hook('creating', failWrite);
    await expect(addVocabulary({ word: 'harbor', translation: '港口' })).rejects.toThrow('quota exhausted');
    db.syncOutbox.hook('creating').unsubscribe(failWrite);
    expect(await db.vocabulary.count()).toBe(0);
  });

  it('preserves the old SM-2 snapshot on a real database upgrade without fabricating ratings', async () => {
    await db.delete();
    const old = new Dexie('polyglot');
    old.version(3).stores({ history: '++id, ts, provider, from, to', vocabulary: '++id, word, addedAt, nextReviewAt', activity: '&date', reviewArticles: '++id, createdAt, dayLabel, provider' });
    await old.open();
    await old.table('vocabulary').add({ word: 'harbor', translation: '港口', addedAt: 1000, nextReviewAt: 4102444800000, easeFactor: 2.8, interval: 30, reps: 5, lapses: 2, synced: true });
    old.close(); await db.open();
    const [migrated] = await listVocabulary();
    expect(migrated.legacyReview).toEqual({ nextReviewAt: 4102444800000, easeFactor: 2.8, interval: 30, reps: 5, lapses: 2 });
    expect(await listVocabulary({ due: true })).toHaveLength(1);
    await syncVocabularyWithFolio();
    const events = await db.syncOutbox.toArray();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'capture', payload: { addedAt: '1970-01-01T00:00:01.000Z' } });
  });

  it('resolves an offline grade after capture, keeps it on partial failure, and retries the identical request', async () => {
    const record = await addVocabulary({ word: 'harbor', translation: '港口' });
    await reviewVocabulary(record.id!, 'easy');
    let failGrade = true;
    const gradeBodies: string[] = [];
    const finalReview = { ...review, dueAt: '2026-11-01T03:04:05.000Z', reviewCount: 4, updatedAt: '2026-10-28T03:04:05.000Z' };
    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      if (url.endsWith('/sync/state')) return json({ ...state, items: [{ ...item, review: finalReview }] });
      if (url.endsWith('/sync/vocabulary')) return json({ item });
      gradeBodies.push(String(options?.body));
      return failGrade ? json({}, 503) : json({ expressionId: 'expr-1', review: finalReview });
    });
    expect(await syncVocabularyWithFolio()).toMatchObject({ success: false, pushed: 1, pending: 1 });
    expect(await db.vocabulary.get(record.id!)).toMatchObject({ pendingReview: true, synced: false });
    const [pending] = await db.syncOutbox.toArray();
    expect(pending).toMatchObject({ libraryId: 'library-1', payload: { expressionId: 'expr-1', rating: 'easy' } });
    failGrade = false;
    expect(await syncVocabularyWithFolio()).toMatchObject({ success: true, pushed: 1, pending: 0 });
    expect(gradeBodies[1]).toBe(gradeBodies[0]);
    expect(await db.vocabulary.get(record.id!)).toMatchObject({ pendingReview: false, synced: true, review: finalReview });
  });

  it('explicit re-add unhides a local removal without resetting its authoritative review', async () => {
    vi.stubGlobal('fetch', async () => json(state)); await syncVocabularyWithFolio();
    const [record] = await listVocabulary(); await removeVocabulary(record.id!);
    await addVocabulary({ word: 'harbor', translation: '港口', url: null, pageTitle: null, domain: null });
    const [restored] = await listVocabulary();
    expect(restored).toMatchObject({ id: record.id, review, url: null, pageTitle: null, domain: null });
  });

  it('rejects identity edits before they can create an undeliverable mapped capture', async () => {
    vi.stubGlobal('fetch', async () => json(state)); await syncVocabularyWithFolio();
    const [record] = await listVocabulary();
    await expect(updateVocabulary(record.id!, { word: 'shelter' })).rejects.toThrow('重新添加');
    expect(await db.vocabulary.get(record.id!)).toMatchObject({ word: 'harbor', expressionId: 'expr-1' });
    expect(await db.syncOutbox.count()).toBe(0);
  });

  it('reads state with an authenticated cross-origin POST so Chromium supplies its extension Origin', async () => {
    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      if (url.endsWith('/sync/state') && options?.method === 'POST' &&
          new Headers(options.headers).get('Content-Type') === 'application/json' && options.body === '{}') return json(state);
      return json({ error: 'missing_origin' }, 401);
    });
    expect(await syncVocabularyWithFolio()).toMatchObject({ success: true, pulled: 1 });
    expect(await listVocabulary()).toMatchObject([{ word: 'harbor', expressionId: 'expr-1' }]);
  });

  it('keeps the first saved date while dating a repeated capture at its real capture time', async () => {
    vi.stubGlobal('fetch', async () => json(state)); await syncVocabularyWithFolio();
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-28T03:04:05.000Z'));
    const added = await addVocabulary({ word: 'harbor', translation: '港湾', context: 'a new context' });
    const [event] = await db.syncOutbox.toArray();
    expect(added.addedAt).toBe(Date.parse('2026-10-20T00:00:00.000Z'));
    expect(event).toMatchObject({ kind: 'capture', payload: { context: 'a new context', addedAt: '2026-10-28T03:04:05.000Z' } });
  });

  it('preserves a legacy first capture when its metadata is edited before first synchronization', async () => {
    const id = await db.vocabulary.add({ word: 'harbor', translation: '港口', context: 'original context', addedAt: 1000, nextReviewAt: 1000, easeFactor: 2.5, interval: 0, reps: 0, lapses: 0 });
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-28T03:04:05.000Z'));
    const updated = await updateVocabulary(id!, { context: 'edited context' });
    const events = await db.syncOutbox.toArray();
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ kind: 'capture', payload: { context: 'original context', addedAt: '1970-01-01T00:00:01.000Z' } });
    expect(events[1]).toMatchObject({ kind: 'capture', payload: { context: 'edited context', addedAt: '2026-10-28T03:04:05.000Z' } });
    expect(updated.addedAt).toBe(1000);
  });

  it('validates explicit Folio pairing codes and sends Bearer token while retaining outbox on 401', async () => {
    const extId = 'dafcchpddcgohdjjopgclldeaepchojp';
    const secret = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcd';
    expect(parseFolioPairingCode(`foliole1.${extId}.${secret}`, extId)).toEqual({
      extensionId: extId,
      token: secret,
    });
    expect(() => parseFolioPairingCode(`foliole1.hbndffmjdcfebohmpocialgkogfgfjdg.${secret}`, extId)).toThrow(/不一致/);

    await addVocabulary({ word: 'harbor', translation: '港口' });
    const seenAuth: Array<string | null> = [];
    vi.stubGlobal('fetch', async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seenAuth.push(headers.get('Authorization'));
      if (headers.get('Authorization') !== `Bearer ${secret}`) {
        return json({ error: { code: 'AUTH_REQUIRED', message: 'auth required' } }, 401);
      }
      return json(state);
    });

    const unauth = await syncVocabularyWithFolio();
    expect(unauth.success).toBe(false);
    expect(unauth.pending).toBe(1);

    setFolioTokenForTest(secret);
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seenAuth.push(headers.get('Authorization'));
      expect(headers.get('Authorization')).toBe(`Bearer ${secret}`);
      return url.endsWith('/sync/state') ? json(state) : json({ item });
    });
    const authed = await syncVocabularyWithFolio();
    expect(authed).toMatchObject({ success: true, pushed: 1, pending: 0 });
    expect(seenAuth[0]).toBeNull();
    expect(seenAuth[1]).toBe(`Bearer ${secret}`);
  });

});
