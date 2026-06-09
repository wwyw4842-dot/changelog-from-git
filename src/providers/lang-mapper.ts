/**
 * 各翻译引擎的语言代码映射集中在这里维护。
 *
 * 背景：BCP-47 风格的内部语言码（zh-CN / zh-TW / en / ja …）在各引擎
 * API 中写法不同 —— Bing 用 zh-Hans/zh-Hant，Google 用 zh-CN/zh-TW，
 * DeepL 用全大写 ZH/EN，火山用 zh/zh-Hant。此前每个 provider 文件里
 * 各写一份 mapLang()，规则极易漂移；新增引擎时也容易漏写。
 */

type LangTable = Record<string, string>;

const TABLES = {
  bing: {
    zh: "zh-Hans",
    "zh-cn": "zh-Hans",
    "zh-tw": "zh-Hant",
  },
  google: {
    zh: "zh-CN",
    "zh-cn": "zh-CN",
    "zh-tw": "zh-TW",
  },
  deepl: {
    zh: "ZH",
    "zh-cn": "ZH",
    "zh-tw": "ZH",
  },
  volcano: {
    zh: "zh",
    "zh-cn": "zh",
    "zh-tw": "zh-Hant",
  },
} as const satisfies Record<string, LangTable>;

export type MappedProviderId = keyof typeof TABLES;

/**
 * 把内部语言码转换为指定引擎的 API 语言码。
 * 表中未列出的语言：DeepL 取主标签并大写（如 ja → JA），
 * 其他引擎取小写主标签（如 en-US → en）。
 */
export function mapLang(provider: MappedProviderId, code: string): string {
  const c = code.toLowerCase();
  const table: LangTable = TABLES[provider];
  const hit = table[c];
  if (hit) return hit;
  const primary = c.split("-")[0];
  return provider === "deepl" ? primary.toUpperCase() : primary;
}
