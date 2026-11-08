import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/types';
import { MessageRouter } from '@shared/messaging';
import { registerTranslationHandlers } from './translation';

vi.mock('../translate-helper', () => ({ runTranslation: vi.fn(async () => ({ originalText: 'harbor', translatedText: '港口', provider: 'test' })) }));
vi.mock('@shared/storage/settings', () => ({ getSettings: async () => DEFAULT_SETTINGS }));
vi.mock('@shared/storage/activity', () => ({ bumpActivity: async () => undefined }));
afterEach(() => { vi.unstubAllGlobals(); });

it('retains the original page source in the latest result when a sidepanel retry has no sender tab', async () => {
  const set = vi.fn(async () => undefined);
  let listener: ((message: unknown, sender: chrome.runtime.MessageSender, response: (value: unknown) => void) => void) | undefined;
  vi.stubGlobal('chrome', { runtime: { onMessage: { addListener: (callback: typeof listener) => { listener = callback; } } }, storage: { local: { set } } });
  const router = new MessageRouter(); registerTranslationHandlers(router); router.attach();
  const response = await new Promise(resolve => listener!({ type: 'translate:selection', payload: { text: 'harbor', from: 'en', to: 'zh', mode: 'quick', url: 'https://original.test/story', pageTitle: 'Original page', domain: 'original.test' } }, {}, resolve));
  expect(response).toMatchObject({ ok: true });
  expect(set.mock.calls[0]?.[0]).toMatchObject({ latestSidePanelResult: { url: 'https://original.test/story', pageTitle: 'Original page', domain: 'original.test' } });
});
