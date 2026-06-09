import { DEFAULT_SETTINGS, type ProviderCredentials, type Settings } from "../types";
import { decryptString, encryptString, isEncrypted } from "./crypto";

const SETTINGS_KEY = "settings";
const CREDENTIALS_KEY = "credentials";
const ENCRYPTED_FIELDS = ["apiKey", "apiUser"] as const;

export async function getSettings(): Promise<Settings> {
  const sync = await chrome.storage.sync.get(SETTINGS_KEY).catch(() => ({}) as Record<string, unknown>);
  const fromSync = sync[SETTINGS_KEY] as Partial<Settings> | undefined;
  const local = await chrome.storage.local.get([SETTINGS_KEY, CREDENTIALS_KEY]);
  const fromLocal = local[SETTINGS_KEY] as Partial<Settings> | undefined;
  const storedCredentials = local[CREDENTIALS_KEY] as ProviderCredentials | undefined;

  const base = fromSync
    ? { ...DEFAULT_SETTINGS, ...fromSync }
    : { ...DEFAULT_SETTINGS, ...(fromLocal || {}) };
  const credentials = await decryptCredentials(storedCredentials || base.credentials || {});
  return { ...base, credentials } satisfies Settings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch } satisfies Settings;

  const { credentials, ...withoutSecrets } = next;
  try {
    await chrome.storage.sync.set({ [SETTINGS_KEY]: withoutSecrets });
  } catch (error) {
    console.warn("[polyglot] sync storage failed, fallback to local", error);
    await chrome.storage.local.set({ [SETTINGS_KEY]: withoutSecrets });
  }
  const encryptedCreds = await encryptCredentials(credentials);
  await chrome.storage.local.set({ [CREDENTIALS_KEY]: encryptedCreds });
  return next;
}

async function encryptCredentials(source: ProviderCredentials): Promise<ProviderCredentials> {
  const out: ProviderCredentials = {};
  for (const [providerId, record] of Object.entries(source || {})) {
    if (!record) continue;
    const clone: ProviderCredentials[string] = { ...record };
    for (const field of ENCRYPTED_FIELDS) {
      const value = clone[field];
      if (value && !isEncrypted(value)) {
        clone[field] = await encryptString(value);
      }
    }
    out[providerId] = clone;
  }
  return out;
}

async function decryptCredentials(source: ProviderCredentials): Promise<ProviderCredentials> {
  const out: ProviderCredentials = {};
  for (const [providerId, record] of Object.entries(source || {})) {
    if (!record) continue;
    const clone: ProviderCredentials[string] = { ...record };
    for (const field of ENCRYPTED_FIELDS) {
      const value = clone[field];
      if (isEncrypted(value)) {
        clone[field] = await decryptString(value as string);
      }
    }
    out[providerId] = clone;
  }
  return out;
}

export async function initializeSettings(): Promise<Settings> {
  const current = await getSettings();
  if (!current.migratedTo) {
    return migrateLegacy(current);
  }
  return current;
}

async function migrateLegacy(current: Settings): Promise<Settings> {
  try {
    const legacy = await chrome.storage.local.get(["settings", "translationHistory"]);
    const legacySettings = legacy.settings as
      | {
          triggerMode?: "selection" | "altSelection";
          autoRead?: boolean;
          fontSize?: number;
          bubbleOpacity?: number;
          whitelist?: string[];
          apiKey?: string;
          apiUser?: string;
          sourceLang?: string;
          targetLang?: string;
        }
      | undefined;

    if (legacySettings) {
      const migrated: Settings = {
        ...current,
        triggerMode: legacySettings.triggerMode || current.triggerMode,
        autoRead: Boolean(legacySettings.autoRead),
        fontSize: legacySettings.fontSize || current.fontSize,
        bubbleOpacity: legacySettings.bubbleOpacity || current.bubbleOpacity,
        whitelist: Array.isArray(legacySettings.whitelist) ? legacySettings.whitelist : [],
        sourceLang: legacySettings.sourceLang || current.sourceLang,
        targetLang: legacySettings.targetLang || current.targetLang,
        credentials: {
          ...current.credentials,
          mymemory: {
            apiKey: legacySettings.apiKey || "",
            apiUser: legacySettings.apiUser || "",
          },
        },
        migratedTo: "1.0.0",
      };
      await updateSettings(migrated);
      return migrated;
    }
  } catch (error) {
    console.warn("[polyglot] legacy migration failed", error);
  }
  const next = { ...current, migratedTo: "1.0.0" };
  await updateSettings(next);
  return next;
}
