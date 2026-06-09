export function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function isMostlyChinese(text: string): boolean {
  if (!text) return false;
  let cjk = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fa5]/.test(ch)) cjk += 1;
  }
  return cjk / Array.from(text).length > 0.3;
}

export function detectLangHint(text: string): string {
  if (isMostlyChinese(text)) return "zh-CN";
  if (/^[\s\p{P}\p{S}\w'-]+$/u.test(text)) return "en";
  return "auto";
}

export function suggestTargetLang(text: string, preferred: string): string {
  if (isMostlyChinese(text)) {
    return preferred === "zh-CN" ? "en" : preferred;
  }
  return preferred;
}

export function ttsLangFor(target: string): string {
  const t = target.toLowerCase();
  if (t.startsWith("zh")) return "zh-CN";
  if (t.startsWith("en")) return "en-US";
  if (t.startsWith("ja")) return "ja-JP";
  if (t.startsWith("ko")) return "ko-KR";
  return t;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
