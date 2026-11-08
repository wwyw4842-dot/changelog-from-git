import type { MessageRouter } from "@shared/messaging";

const OFFSCREEN_PATH = "src/offscreen/offscreen.html";

interface OffscreenOcrResponse {
  ok: boolean;
  text?: string;
  error?: string;
}

let creating: Promise<void> | null = null;

/** 确保用于 OCR 的 offscreen 文档已创建（幂等，可并发调用）。 */
async function ensureOffscreenDocument(): Promise<void> {
  const offscreen = chrome.offscreen;
  if (!offscreen) throw new Error("当前浏览器不支持 offscreen 文档");

  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  // getContexts 在较新 Chrome 可用；用于避免重复创建。
  const getContexts = (chrome.runtime as unknown as {
    getContexts?: (filter: {
      contextTypes: string[];
      documentUrls?: string[];
    }) => Promise<unknown[]>;
  }).getContexts;
  if (getContexts) {
    const existing = await getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [url],
    });
    if (existing.length > 0) return;
  }

  if (creating) {
    await creating;
    return;
  }
  creating = offscreen
    .createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["WORKERS" as chrome.offscreen.Reason],
      justification: "在离屏文档中运行 tesseract.js OCR，绕过宿主页面 CSP。",
    })
    .catch((error: unknown) => {
      // 并发下可能已被另一次调用创建，忽略“已存在”类错误。
      const msg = error instanceof Error ? error.message : String(error);
      if (!/single offscreen|already/i.test(msg)) throw error;
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

export function registerOcrHandlers(router: MessageRouter): void {
  router.on("ocr:recognize", async ({ src, lang }) => {
    await ensureOffscreenDocument();
    const response = (await chrome.runtime.sendMessage({
      target: "offscreen-ocr",
      src,
      lang,
    })) as OffscreenOcrResponse | undefined;
    if (!response) throw new Error("OCR 离屏文档无响应");
    if (!response.ok) throw new Error(response.error || "OCR 识别失败");
    return { text: response.text || "" };
  });
}
