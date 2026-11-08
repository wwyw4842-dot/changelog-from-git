import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MessageRouter } from '@shared/messaging';
import { db } from '@shared/storage/db';
import { addVocabulary } from '@shared/storage/vocabulary';
import { registerVocabularyHandlers } from './vocabulary';

beforeEach(async () => { await db.delete(); await db.open(); });
afterEach(() => { vi.unstubAllGlobals(); });

it('retries persisted offline events on a browser alarm without an open vocabulary tab', async () => {
  const review = { algorithm: 'fsrs-6', dueAt: '2026-10-28T02:01:00.000Z', intervalDays: 0, reviewCount: 0, lapseCount: 0, masteryState: 'new', updatedAt: '2026-10-28T02:00:00.000Z' };
  const item = { expressionId: 'expr-1', word: 'harbor', translation: '港口', phonetic: '', context: '', url: null, pageTitle: null, domain: null, savedAt: '2026-10-28T00:00:00.000Z', review };
  const state = { protocolVersion: 1, libraryId: 'library-1', environment: 'production', algorithm: 'fsrs-6', desiredRetention: 0.9, items: [item] };
  const record = await addVocabulary({ word: 'harbor', translation: '港口' });
  let alarm: ((alarm: chrome.alarms.Alarm) => void) | undefined;
  let alarmName = '';
  vi.stubGlobal('chrome', { alarms: { create: async (name: string) => { alarmName = name; }, onAlarm: { addListener: (callback: typeof alarm) => { alarm = callback; } } }, runtime: { onStartup: { addListener: () => undefined } } });
  vi.stubGlobal('fetch', async (url: string) => new Response(JSON.stringify(url.endsWith('/sync/state') ? state : { item })));
  registerVocabularyHandlers(new MessageRouter());
  alarm?.({ name: alarmName, scheduledTime: Date.now(), periodInMinutes: 1 });
  await vi.waitFor(async () => expect(await db.vocabulary.get(record.id!)).toMatchObject({ synced: true, expressionId: 'expr-1' }));
  expect(await db.syncOutbox.count()).toBe(0);
});
