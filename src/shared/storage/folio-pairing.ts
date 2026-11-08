import type { FolioPairingStatus } from "../types";
import { db } from "./db";
import { getSettings, updateSettings } from "./settings";

const FOLIO_PROVIDER_ID = "folio";
const PAIRING_PREFIX = "foliole1";
const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

let testTokenOverride: string | null | undefined;

export function setFolioTokenForTest(token: string | null | undefined): void {
  testTokenOverride = token;
}

export function getRuntimeExtensionId(): string {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;
  return chromeApi?.runtime?.id || "";
}

export function parseFolioPairingCode(
  rawCode: string,
  currentExtensionId = getRuntimeExtensionId()
): { extensionId: string; token: string } {
  const trimmed = rawCode.trim();
  const parts = trimmed.split(".");
  if (parts.length < 3 || parts[0] !== PAIRING_PREFIX) {
    throw new Error("配对码格式无效，请粘贴 Folio 扉页「数据」卡片生成的 foliole1... 配对码。");
  }
  const extensionId = parts[1].toLowerCase();
  const token = parts.slice(2).join(".").trim();
  if (!EXTENSION_ID_PATTERN.test(extensionId) || token.length < 24) {
    throw new Error("配对码不完整，请在 Folio 重新点击「生成配对码」后完整复制。");
  }
  if (currentExtensionId && extensionId !== currentExtensionId.toLowerCase()) {
    throw new Error(
      `该配对码对应扩展 ID（${extensionId}）与当前安装的 Foliole（${currentExtensionId}）不一致，请复制当前扩展 ID 到 Folio 重新生成。`
    );
  }
  return { extensionId, token };
}

export async function getFolioAuthToken(): Promise<string | null> {
  if (testTokenOverride !== undefined) {
    return testTokenOverride;
  }
  const chromeApi = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;
  if (!chromeApi?.storage?.local) {
    return null;
  }
  const settings = await getSettings();
  const token = settings.credentials?.[FOLIO_PROVIDER_ID]?.apiKey?.trim();
  return token || null;
}

export async function getFolioPairingStatus(): Promise<FolioPairingStatus> {
  const extensionId = getRuntimeExtensionId();
  const binding = await db.syncBinding.get("folio").catch(() => undefined);
  const chromeApi = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;
  if (!chromeApi?.storage?.local) {
    const token = testTokenOverride || null;
    return {
      paired: Boolean(token),
      extensionId,
      pairedExtensionId: token ? extensionId || null : null,
      boundLibraryId: binding?.libraryId || null,
    };
  }
  const settings = await getSettings();
  const record = settings.credentials?.[FOLIO_PROVIDER_ID];
  const token = record?.apiKey?.trim();
  return {
    paired: Boolean(token),
    extensionId,
    pairedExtensionId: record?.extra?.extensionId || null,
    boundLibraryId: binding?.libraryId || null,
  };
}

export async function saveFolioPairingCode(rawCode: string): Promise<FolioPairingStatus> {
  const parsed = parseFolioPairingCode(rawCode);
  const current = await getSettings();
  await updateSettings({
    credentials: {
      ...current.credentials,
      [FOLIO_PROVIDER_ID]: {
        apiKey: parsed.token,
        extra: {
          extensionId: parsed.extensionId,
          pairedAt: new Date().toISOString(),
        },
      },
    },
  });
  return getFolioPairingStatus();
}

export async function clearFolioPairing(): Promise<FolioPairingStatus> {
  const current = await getSettings();
  const nextCredentials = { ...current.credentials };
  delete nextCredentials[FOLIO_PROVIDER_ID];
  await updateSettings({ credentials: nextCredentials });
  return getFolioPairingStatus();
}
