/**
 * Offscreen 文档：在扩展自身上下文中运行 tesseract.js OCR。
 *
 * 这样做的原因：tesseract 需要注入脚本并加载 WASM/Worker，而 GitHub、
 * Twitter 等站点的 CSP 会拦截在宿主页面注入脚本。Offscreen 文档使用扩展
 * 自己的 CSP（manifest 中 extension_pages 已放行 'wasm-unsafe-eval'），
 * 因此不受宿主页 CSP 影响，也不占用网页主线程。
 *
 * 协议：background 通过 chrome.runtime.sendMessage 发送
 *   { target: "offscreen-ocr", src, lang }
 * 本文档执行识别后以 { ok, text } / { ok:false, error } 回应。
 * 带 target 字段的消息会被严格校验的 MessageRouter 忽略，互不干扰。
 */
import { recognizeImage } from "@/content/ocr/ocr";

interface OffscreenOcrRequest {
  target?: string;
  src?: string;
  lang?: string;
}

interface OffscreenOcrResponse {
  ok: boolean;
  text?: string;
  error?: string;
}

chrome.runtime.onMessage.addListener((message: OffscreenOcrRequest, _sender, sendResponse) => {
  if (!message || message.target !== "offscreen-ocr") return undefined;
  (async () => {
    try {
      if (!message.src) throw new Error("缺少图片地址");
      const text = await recognizeImage(message.src, message.lang || "eng+chi_sim");
      sendResponse({ ok: true, text } satisfies OffscreenOcrResponse);
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      } satisfies OffscreenOcrResponse);
    }
  })();
  return true; // 异步回应，保持消息通道开启
});
