/**
 * 用 WebCrypto AES-GCM 加密/解密敏感字段（API Keys）。
 * 主密钥在安装时随机生成，保存在 `chrome.storage.local` 的 `__poly_master_key` 里（浏览器本地，不随同步漂移）。
 *
 * 注意：浏览器端加密并非绝对安全（用户清除数据时密钥也会清掉），主要目的是：
 * - 防止 Key 在 settings 导出/备份里以明文形式出现
 * - 避免 DevTools Application 面板直接看到明文
 */

const MASTER_KEY_STORAGE = "__poly_master_key";
const IV_LENGTH = 12;
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

let cachedKey: CryptoKey | null = null;

async function getOrCreateMasterKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const stored = await chrome.storage.local.get(MASTER_KEY_STORAGE);
  const raw = stored[MASTER_KEY_STORAGE] as string | undefined;
  if (raw) {
    const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    cachedKey = await crypto.subtle.importKey("raw", bytes, ALGORITHM, false, ["encrypt", "decrypt"]);
    return cachedKey;
  }
  const key = await crypto.subtle.generateKey({ name: ALGORITHM, length: KEY_LENGTH }, true, [
    "encrypt",
    "decrypt",
  ]);
  const exported = await crypto.subtle.exportKey("raw", key);
  const exportedBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
  await chrome.storage.local.set({ [MASTER_KEY_STORAGE]: exportedBase64 });
  cachedKey = key;
  return key;
}

export async function encryptString(plain: string): Promise<string> {
  if (!plain) return "";
  const key = await getOrCreateMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plain);
  const cipher = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded);
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipher), iv.length);
  return `enc:${btoa(String.fromCharCode(...combined))}`;
}

export async function decryptString(payload: string): Promise<string> {
  if (!payload) return "";
  if (!payload.startsWith("enc:")) return payload; // legacy plaintext
  const base64 = payload.slice(4);
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  if (bytes.length <= IV_LENGTH) return "";
  const iv = bytes.slice(0, IV_LENGTH);
  const cipher = bytes.slice(IV_LENGTH);
  const key = await getOrCreateMasterKey();
  try {
    const decoded = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, cipher);
    return new TextDecoder().decode(decoded);
  } catch (error) {
    console.warn("[polyglot] decrypt failed", error);
    return "";
  }
}

export function isEncrypted(payload: string | undefined | null): boolean {
  return typeof payload === "string" && payload.startsWith("enc:");
}
