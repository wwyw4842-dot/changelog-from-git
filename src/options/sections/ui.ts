// Polyglot Options · 莫兰迪柔光 (Morandi Soft Cream) tokens
// 与 sidepanel/pages/ui.ts 同一套语言：米奶 + 暖灰 + 珊瑚红 + 衬线大标题 + spring。
// 保留全部 key 名不变；其它 section 文件按 key 引用即可自动同步。

const baseInput =
  "rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 shadow-softer outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200/60";

export const optionUi = {
  pageStack: "space-y-4",

  // ========== Cards ==========
  card:
    "poly-spring relative rounded-2xl border border-cream-300/80 bg-cream-100 p-5 shadow-soft",
  cardBody: "space-y-3",
  cardBodyDense: "space-y-2",
  cardTitle: "poly-serif mb-3 text-[15px] font-semibold text-ink-900",
  cardTitleStrong: "poly-serif text-[15px] font-semibold text-ink-900",
  cardNote: "text-xs text-ink-500",
  cardTextMuted: "text-[11px] text-ink-500",
  cardStatusSuccess:
    "mt-3 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200",
  cardTextBody:
    "poly-spring rounded-2xl border border-cream-300/80 bg-cream-100 p-5 text-sm text-ink-700 shadow-soft",

  // ========== Section ==========
  sectionBody: "space-y-4 text-sm text-ink-700",
  cardsStack: "space-y-3",

  // ========== Rows ==========
  rowBetween: "flex items-center justify-between",
  rowInlineActions: "flex flex-wrap gap-2",
  rowInlineMeta: "flex items-center gap-3",

  credentialsGrid: "mt-3 grid gap-3 md:grid-cols-2",
  fieldColumn: "flex flex-col gap-1 text-xs text-ink-500",
  toggleRow:
    "flex items-center justify-between rounded-xl border border-cream-300 bg-cream-50 px-3.5 py-2.5 shadow-softer transition hover:border-brand-200 hover:bg-brand-50/40",

  listCompact: "mt-3 space-y-1.5 text-[13px] text-ink-700",
  fieldRow: "flex flex-wrap items-center gap-3 text-sm text-ink-700",
  fieldLabel:
    "min-w-[140px] text-[12px] font-medium uppercase tracking-[0.12em] text-ink-500",
  hintInline: "ml-2 text-xs text-ink-500",

  // ========== Buttons ==========
  subtleButton:
    "inline-flex items-center justify-center rounded-xl border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs font-medium text-ink-700 shadow-softer transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.97]",
  subtleButtonMt:
    "mt-4 inline-flex items-center justify-center rounded-xl border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs font-medium text-ink-700 shadow-softer transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.97]",
  subtleButtonSm:
    "inline-flex items-center justify-center rounded-lg border border-cream-300 bg-cream-100 px-2.5 py-1 text-xs text-ink-700 shadow-softer transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 active:scale-[0.97]",

  // ========== Inputs ==========
  input: `min-w-[180px] ${baseInput}`,
  inputW24: `w-24 min-w-[180px] ${baseInput}`,
  inputH88: `min-h-[88px] min-w-[180px] ${baseInput}`,
  inputW80: `w-80 min-w-[180px] ${baseInput}`,
  inputMax320: `max-w-[320px] min-w-[180px] ${baseInput}`,
  inputMono:
    "rounded-xl border border-cream-300 bg-cream-50 px-3 py-1.5 font-mono text-sm text-ink-900 shadow-softer outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200/60",

  // ========== Kbd ==========
  kbd:
    "inline-block rounded-md border border-cream-300 bg-cream-50 px-[8px] py-[2px] font-mono text-[11px] font-semibold text-ink-700 shadow-softer",
} as const;
