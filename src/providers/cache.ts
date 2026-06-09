import type { TranslationResult } from "@shared/types";

interface CacheEntry {
  data: TranslationResult;
  ts: number;
}

interface PersistedCacheRecord {
  key: string;
  data: TranslationResult;
  ts: number;
}

const TTL_MS = 10 * 60 * 1000;
const PERSIST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX = 200;
const STORAGE_KEY = "translationCachePersist";

export class TranslationCache {
  private map = new Map<string, CacheEntry>();
  private hydrated = false;

  private key(providerId: string, from: string, to: string, mode: string, text: string): string {
    return `${providerId}::${from}::${to}::${mode}::${text}`;
  }

  async hydrate(): Promise<void> {
    if (this.hydrated || typeof chrome === "undefined" || !chrome.storage?.local) {
      this.hydrated = true;
      return;
    }
    try {
      const stored = await chrome.storage.local.get(STORAGE_KEY);
      const list = (stored[STORAGE_KEY] as PersistedCacheRecord[]) || [];
      const now = Date.now();
      for (const record of list) {
        if (now - record.ts < PERSIST_TTL_MS) {
          this.map.set(record.key, { data: record.data, ts: record.ts });
        }
      }
    } catch (error) {
      console.warn("[polyglot] cache hydrate failed", error);
    }
    this.hydrated = true;
  }

  private schedulePersist(): void {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return;
    const records: PersistedCacheRecord[] = [];
    for (const [key, entry] of this.map.entries()) {
      records.push({ key, data: entry.data, ts: entry.ts });
    }
    chrome.storage.local.set({ [STORAGE_KEY]: records }).catch((error) => {
      console.warn("[polyglot] cache persist failed", error);
    });
  }

  get(providerId: string, from: string, to: string, mode: string, text: string): TranslationResult | null {
    const key = this.key(providerId, from, to, mode, text);
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > TTL_MS) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.data;
  }

  set(
    providerId: string,
    from: string,
    to: string,
    mode: string,
    text: string,
    data: TranslationResult
  ): void {
    const key = this.key(providerId, from, to, mode, text);
    if (this.map.size >= MAX) {
      const oldest = this.map.keys().next().value;
      if (oldest) this.map.delete(oldest);
    }
    this.map.set(key, { data, ts: Date.now() });
    this.schedulePersist();
  }

  clear(): void {
    this.map.clear();
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.remove(STORAGE_KEY).catch(() => undefined);
    }
  }
}

export const translationCache = new TranslationCache();
