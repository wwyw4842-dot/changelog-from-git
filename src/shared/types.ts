export type TriggerMode = "selection" | "altSelection" | "shortcut";

export type TranslationMode = "quick" | "deep";

export interface TranslationRequest {
  text: string;
  from: string;
  to: string;
  context?: string;
  mode: TranslationMode;
  providerId?: string;
  ieltsMode?: boolean;
  ieltsTarget?: string;
}

export interface TranslationExample {
  src: string;
  tgt: string;
}

export interface PartOfSpeechEntry {
  pos: string;
  definition: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  provider: string;
  phonetic?: string;
  alternatives?: string[];
  explanation?: string;
  examples?: TranslationExample[];
  partOfSpeech?: PartOfSpeechEntry[];
  fromCache?: boolean;
  streamed?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

export interface HistoryEntry extends TranslationResult {
  id?: number;
  ts: number;
  from: string;
  to: string;
}

export interface VocabularyEntry {
  id?: number;
  word: string;
  translation: string;
  context?: string;
  phonetic?: string;
  /** 自动或手动的复习例句（英 + 中） */
  examples?: VocabExample[];
  addedAt: number;
  nextReviewAt: number;
  easeFactor: number;
  interval: number;
  reps: number;
  lapses: number;
  tags?: string[];
}

export interface VocabExample {
  en: string;
  zh: string;
}

export interface ActivityDay {
  date: string;
  queries: number;
  vocabAdded: number;
  reviews: number;
  immersiveTriggers: number;
}

export interface ActivityStats {
  today: ActivityDay;
  last7Days: ActivityDay[];
  streakDays: number;
  totals: {
    queries: number;
    vocab: number;
    reviews: number;
  };
}

export interface ReviewArticleEntry {
  id?: number;
  /** 来自哪个日期分组，比如“今天 · 2026/4/26” */
  dayLabel: string;
  content: string;
  provider: string;
  /** 参与生成的词条 */
  words: string[];
  createdAt: number;
}

export interface ProviderCredentials {
  [providerId: string]: {
    apiKey?: string;
    apiUser?: string;
    apiBase?: string;
    model?: string;
    extra?: Record<string, string>;
  };
}

export interface Settings {
  triggerMode: TriggerMode;
  autoRead: boolean;
  fontSize: number;
  bubbleOpacity: number;
  theme: "system" | "light" | "dark";
  sourceLang: string;
  targetLang: string;
  primaryProvider: string;
  fallbackChain: string[];
  deepProvider: string;
  /** 口语批改、写作批改、侧栏自由对话、重组文章等「重任务」默认 LLM */
  llmProProvider: string;
  /** 生词本：加入后自动补例句使用的 LLM（可与 deep 不同） */
  vocabExampleProvider: string;
  immersiveEnabled: boolean;
  immersiveDefaultEngine: string;
  whitelist: string[];
  pdfEnabled: boolean;
  inputEnhanceEnabled: boolean;
  /** 为 false 时仅显示「快捷」小按钮，点击后展开润色/纠错等（默认不占位） */
  inputEnhanceAutoExpandToolbar: boolean;
  vocabHighlightEnabled: boolean;
  ieltsMode: boolean;
  ieltsTarget: "6.0" | "6.5" | "7.0" | "7.5" | "8.0+";
  credentials: ProviderCredentials;
  migratedTo?: string;
}

export interface MessageEnvelope<T = unknown> {
  type: string;
  payload?: T;
}

export interface MessageResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  triggerMode: "selection",
  autoRead: false,
  fontSize: 14,
  bubbleOpacity: 0.96,
  theme: "system",
  sourceLang: "auto",
  targetLang: "zh-CN",
  primaryProvider: "google",
  fallbackChain: ["google", "bing", "mymemory"],
  deepProvider: "deepseek",
  llmProProvider: "deepseek-reason",
  vocabExampleProvider: "deepseek",
  immersiveEnabled: false,
  immersiveDefaultEngine: "google",
  whitelist: [],
  pdfEnabled: true,
  inputEnhanceEnabled: false,
  inputEnhanceAutoExpandToolbar: false,
  vocabHighlightEnabled: true,
  ieltsMode: false,
  ieltsTarget: "7.0",
  credentials: {},
};
