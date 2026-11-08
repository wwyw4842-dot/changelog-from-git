export type Locale = "zh-CN" | "en";

const dictionary: Record<Locale, Record<string, string>> = {
  "zh-CN": {
    "app.name": "Foliole 词汇分生叶",
    "bubble.translating": "翻译中...",
    "bubble.copy": "复制",
    "bubble.copy.original": "复制原文",
    "bubble.copy.translation": "复制译文",
    "bubble.speak": "朗读",
    "bubble.stop": "停止",
    "bubble.save": "加入生词本",
    "bubble.details": "详情",
    "bubble.retry": "重试",
    "bubble.pin": "固定",
    "bubble.close": "关闭",
    "sidepanel.tab.latest": "当前结果",
    "sidepanel.tab.history": "最近记录",
    "sidepanel.tab.vocab": "生词本",
    "sidepanel.tab.overview": "学习概览",
    "sidepanel.tab.practice": "口语陪练",
    "sidepanel.tab.reviewArticles": "复习文章",
    "sidepanel.tab.writing": "写作批改",
    "sidepanel.tab.writingAnalysis": "写作分析",
    "sidepanel.tab.chat": "AI 追问",
    "sidepanel.status.ready": "可以使用",
    "sidepanel.status.loading": "正在载入",
    "sidepanel.status.error": "请重新载入",
    "sidepanel.more": "更多",
    "sidepanel.more.label": "更多学习工具",
    "sidepanel.tagline": "把一次查词，变成下一次记住。",
    "sidepanel.navigation": "学习面板",
    "options.title": "Foliole 设置",
    "options.section.general": "通用",
    "options.section.providers": "翻译引擎",
    "options.section.shortcuts": "快捷键",
    "options.section.advanced": "高级",
    "popup.title": "快速翻译",
    "error.network": "网络请求失败",
    "error.auth": "鉴权失败，请检查 API Key",
  },
  en: {
    "app.name": "Foliole Vocabulary Leaflet",
    "bubble.translating": "Translating...",
    "bubble.copy": "Copy",
    "bubble.copy.original": "Copy source",
    "bubble.copy.translation": "Copy translation",
    "bubble.speak": "Speak",
    "bubble.stop": "Stop",
    "bubble.save": "Save to vocab",
    "bubble.details": "Details",
    "bubble.retry": "Retry",
    "bubble.pin": "Pin",
    "bubble.close": "Close",
    "sidepanel.tab.latest": "Current",
    "sidepanel.tab.history": "Recent",
    "sidepanel.tab.vocab": "Vocabulary",
    "sidepanel.tab.overview": "Overview",
    "sidepanel.tab.practice": "Practice",
    "sidepanel.tab.reviewArticles": "Review Articles",
    "sidepanel.tab.writing": "Writing",
    "sidepanel.tab.writingAnalysis": "Writing analysis",
    "sidepanel.tab.chat": "Ask AI",
    "sidepanel.status.ready": "Ready",
    "sidepanel.status.loading": "Loading",
    "sidepanel.status.error": "Reload needed",
    "sidepanel.more": "More",
    "sidepanel.more.label": "More learning tools",
    "sidepanel.tagline": "Turn one lookup into something you remember.",
    "sidepanel.navigation": "Learning panel",
    "options.title": "Foliole Settings",
    "options.section.general": "General",
    "options.section.providers": "Providers",
    "options.section.shortcuts": "Shortcuts",
    "options.section.advanced": "Advanced",
    "popup.title": "Quick Translate",
    "error.network": "Network request failed",
    "error.auth": "Authentication failed. Check your API Key.",
  },
};

let activeLocale: Locale = detectLocale();

function detectLocale(): Locale {
  if (typeof navigator !== "undefined") {
    const lang = (navigator.language || "en").toLowerCase();
    if (lang.startsWith("zh")) {
      return "zh-CN";
    }
  }
  return "en";
}

export function t(key: string, fallback?: string): string {
  return dictionary[activeLocale][key] ?? fallback ?? key;
}

export function setLocale(locale: Locale): void {
  activeLocale = locale;
}

export function getLocale(): Locale {
  return activeLocale;
}
