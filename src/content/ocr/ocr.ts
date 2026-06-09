/**
 * OCR 按需加载模块。tesseract.js 及其 worker/core/语言包由 Vite 从本地
 * node_modules 复制到 dist/vendor/tesseract，避免运行时访问远程 CDN。
 */

const TESSERACT_SCRIPT_PATH = "vendor/tesseract/tesseract.min.js";
const TESSERACT_WORKER_PATH = "vendor/tesseract/worker.min.js";
const TESSERACT_CORE_PATH = "vendor/tesseract/tesseract-core.wasm.js";
const TESSERACT_LANG_PATH = "vendor/tesseract/lang";

interface TesseractGlobal {
  recognize: (
    image: string | HTMLImageElement | HTMLCanvasElement,
    lang: string,
    options?: Record<string, unknown>
  ) => Promise<{ data: { text: string } }>;
}

let loaderPromise: Promise<TesseractGlobal> | null = null;

function loadTesseract(): Promise<TesseractGlobal> {
  if (loaderPromise) return loaderPromise;
  const globalScope = window as unknown as { Tesseract?: TesseractGlobal };
  if (globalScope.Tesseract) {
    loaderPromise = Promise.resolve(globalScope.Tesseract);
    return loaderPromise;
  }
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL(TESSERACT_SCRIPT_PATH);
    script.async = true;
    script.onload = () => {
      const ts = (window as unknown as { Tesseract?: TesseractGlobal }).Tesseract;
      if (ts) resolve(ts);
      else reject(new Error("tesseract.js 加载失败"));
    };
    script.onerror = () => reject(new Error("无法加载本地 tesseract.js"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export async function recognizeImage(src: string, lang = "eng+chi_sim"): Promise<string> {
  const ts = await loadTesseract();
  const result = await ts.recognize(src, lang, {
    workerPath: chrome.runtime.getURL(TESSERACT_WORKER_PATH),
    corePath: chrome.runtime.getURL(TESSERACT_CORE_PATH),
    langPath: chrome.runtime.getURL(TESSERACT_LANG_PATH),
  });
  return (result.data.text || "").trim();
}
