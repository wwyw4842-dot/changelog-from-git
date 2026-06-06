// Polyglot Sidepanel · 莫兰迪柔光 (Morandi Soft Cream) tokens
// 米奶 + 暖灰 + 一抹珊瑚红 + 衬线大标题 + 暖光阴影 + spring 抬升。
// 所有 key 与上一版保持一致，只替换值。

const focusRing =
  "focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200/60";

const baseBtn =
  "inline-flex items-center justify-center transition active:scale-[0.97]";

export const sideUi = {
  // ========== Cards / Surfaces ==========
  card:
    "poly-spring relative rounded-2xl border border-cream-300/80 bg-cream-100 p-4 shadow-soft",
  cardCompact:
    "poly-spring relative rounded-xl border border-cream-300/80 bg-cream-100 p-3 shadow-softer",
  emptyCard:
    "rounded-2xl border border-dashed border-ink-300/60 bg-cream-100/60 p-6 text-center text-sm text-ink-500",

  // ========== Inputs ==========
  input:
    `rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition shadow-softer ${focusRing}`,
  inputFlex1:
    `flex-1 rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition shadow-softer ${focusRing}`,
  inputMono:
    `rounded-xl border border-cream-300 bg-cream-50 p-2.5 text-[13px] text-ink-900 placeholder:text-ink-400 transition shadow-softer ${focusRing}`,
  inputInline:
    "rounded-md border border-cream-300 bg-cream-50 px-2 py-0.5 text-[12px] text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
  select:
    `cursor-pointer rounded-xl border border-cream-300 bg-cream-50 px-2.5 py-2 text-xs text-ink-700 transition hover:bg-cream-200 shadow-softer ${focusRing}`,

  // ========== Buttons ==========
  subtleButton:
    `${baseBtn} rounded-xl border border-cream-300 bg-cream-100 px-2.5 py-1 text-xs text-ink-700 shadow-softer hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700`,
  dangerButton:
    `${baseBtn} rounded-xl border border-cream-300 bg-cream-100 px-2.5 py-1 text-xs text-rose-600 shadow-softer hover:border-rose-300 hover:bg-rose-50`,
  primaryButton:
    `${baseBtn} poly-ripple rounded-xl px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-br from-brand-400 to-brand-600 shadow-coral hover:shadow-glow hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`,

  // ========== Mode tabs (segmented) ==========
  modeTabButton:
    "poly-serif rounded-xl px-3 py-1.5 text-[13px] transition relative",
  modeTabActive:
    "bg-cream-100 text-brand-700 shadow-softer ring-1 ring-inset ring-brand-200",
  modeTabIdle:
    "text-ink-500 hover:text-ink-900 hover:bg-cream-100/70",
  modeTabActiveButton:
    "poly-serif rounded-xl px-3 py-1.5 text-[13px] transition relative bg-cream-100 text-brand-700 shadow-softer ring-1 ring-inset ring-brand-200",
  modeTabIdleButton:
    "poly-serif rounded-xl px-3 py-1.5 text-[13px] transition relative text-ink-500 hover:text-ink-900 hover:bg-cream-100/70",

  tinyPrimaryButton:
    `${baseBtn} rounded-lg bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition hover:bg-brand-100 hover:shadow-coral disabled:opacity-50`,
  ghostButton:
    "text-[11px] text-ink-500 transition hover:text-ink-900",
  ghostBrandButton:
    "text-[11px] font-semibold text-brand-600 transition hover:text-brand-700",

  // ========== Review grade buttons ==========
  reviewGradeButton:
    "rounded-xl px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-soft active:translate-y-0",
  reviewGradeDangerStrong:
    "bg-rose-100/70 text-rose-700 ring-1 ring-inset ring-rose-200",
  reviewGradeDanger:
    "bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200/70",
  reviewGradeWarn:
    "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  reviewGradeMid:
    "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  reviewGradeGood:
    "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  reviewGradeBest:
    "bg-emerald-100/80 text-emerald-800 ring-1 ring-inset ring-emerald-300",
  reviewGradeDangerStrongButton:
    "rounded-xl px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-soft bg-rose-100/70 text-rose-700 ring-1 ring-inset ring-rose-200",
  reviewGradeDangerButton:
    "rounded-xl px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-soft bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200/70",
  reviewGradeWarnButton:
    "rounded-xl px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-soft bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  reviewGradeMidButton:
    "rounded-xl px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-soft bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  reviewGradeGoodButton:
    "rounded-xl px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-soft bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  reviewGradeBestButton:
    "rounded-xl px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-soft bg-emerald-100/80 text-emerald-800 ring-1 ring-inset ring-emerald-300",

  // ========== Chips / Badges ==========
  badgeNeutral:
    "rounded-full bg-cream-200 px-2 py-0.5 text-[10px] font-medium text-ink-600 ring-1 ring-inset ring-cream-300",
  tagChip:
    "rounded-full border border-cream-300 bg-cream-50 px-2 py-0.5 text-[10px] text-ink-600 transition hover:border-brand-300 hover:text-brand-700",

  // ========== Detail rows ==========
  detailRow: "flex gap-3",
  detailLabel:
    "min-w-[64px] text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400",
  detailContent: "flex-1 text-ink-700",

  // ========== Typography ==========
  sectionLabel:
    "poly-serif text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500",
  bodyTitle: "poly-serif text-[15px] font-semibold text-ink-900",
  bodySubtle: "text-[11px] text-ink-500",
  bodyText: "text-[12px] text-ink-700",
  bodyMuted: "mt-1 text-[11px] text-ink-500",
  bodySummaryClamp: "mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-700",
  bodySubtleClamp: "mt-1 line-clamp-1 text-[11px] text-ink-500",

  inlineEditTrigger:
    "underline decoration-dotted decoration-cream-500 underline-offset-2 transition hover:text-brand-700 hover:decoration-brand-400",
  subtleParen: "text-ink-400",

  // ========== Examples ==========
  exampleItem:
    "rounded-xl border border-cream-300/80 bg-cream-50 p-2.5 transition hover:border-brand-200 hover:bg-brand-50/40",
  exampleItemReview:
    "rounded-xl border border-cream-300/80 bg-cream-50 p-2.5",

  detailsStack: "space-y-2",
  tagsWrap: "flex flex-wrap gap-1",
  contextItalic: "italic text-ink-500",
  groupSection: "space-y-2.5",
  groupHeader: "flex items-center justify-between border-b border-cream-300/80 pb-2",
  groupHeaderLeft: "flex items-center gap-2",
  groupDayLabel:
    "poly-serif text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-600",

  itemHeaderButton:
    "flex w-full items-start justify-between gap-3 text-left transition",
  itemHeaderMain: "flex-1 min-w-0",
  itemHeaderTop: "flex items-center gap-2 flex-wrap",
  itemHeaderMeta: "flex flex-col items-end gap-1 text-[10px] text-ink-400 shrink-0",
  itemDetailPanel:
    "mt-3 space-y-2 border-t border-cream-300/80 pt-3 text-[12px] text-ink-700",
  itemActionsBar:
    "flex flex-wrap items-center justify-end gap-2 pt-1 text-[11px]",

  // ========== Review card ==========
  reviewProgress:
    "text-xs font-semibold uppercase tracking-[0.14em] text-ink-400",
  reviewWord:
    "poly-serif poly-letter-reveal mt-3 text-[26px] font-bold tracking-tight text-brand-700",
  reviewPhonetic: "mt-1 text-sm text-ink-500",
  reviewAnswer: "mt-3 text-base text-ink-900",
  reviewContext: "mt-2 text-xs italic text-ink-500",
  reviewExamplesList: "mt-3 space-y-2 text-xs text-ink-700",
  reviewGradesGrid: "mt-4 grid grid-cols-6 gap-1.5 text-xs",
  reviewHint:
    "mt-3 text-[10px] uppercase tracking-[0.14em] text-ink-400",

  dangerText: "text-sm font-medium text-rose-600",
  prosePanel:
    "poly-scroll poly-prose poly-prose-dropcap poly-prose-rule max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-cream-100 p-5 pr-4",
  prosePanelTall:
    "poly-scroll poly-prose poly-prose-dropcap poly-prose-rule max-h-[560px] overflow-y-auto whitespace-pre-wrap rounded-xl bg-cream-100 p-5 pr-4",

  composeHeader: "mb-2 flex items-center justify-between",
  composeTitle:
    "poly-serif text-[12px] font-semibold uppercase tracking-[0.14em] text-brand-600",
  composeActions: "flex items-center gap-3 text-[11px]",
  stateStreaming: "生成中...",
  stateFailed: "失败",
  stateDone: "完成",
  actionSaving: "保存中...",
  actionSaved: "已保存",
  actionSave: "保存",

  helperText: "text-[10px] text-ink-400",
  statusText: "text-[10px] font-medium",
  statusGood: "text-sage-600",
  statusWarn: "text-amber-700",
  targetBadge:
    "rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200",

  introText: "text-[12px] leading-relaxed text-ink-500",
  panelHeader: "mb-2 flex flex-wrap items-center justify-between gap-2",
  panelCard:
    "poly-spring rounded-2xl border border-cream-300/80 bg-cream-100 p-3 shadow-softer",
  blockGroupLabel:
    "block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500",

  tabsRow: "mt-2 flex flex-wrap gap-1",
  labelRow: "mb-1 flex items-center justify-between",
  actionRow: "mt-2 flex items-center justify-between",
  actionButtons: "flex items-center gap-2",

  inputMonoMt1Full:
    `mt-1 w-full rounded-xl border border-cream-300 bg-cream-50 p-2.5 text-[13px] text-ink-900 placeholder:text-ink-400 transition shadow-softer ${focusRing}`,
  inputMonoPrompt:
    `mt-1 min-h-[64px] w-full rounded-xl border border-cream-300 bg-cream-50 p-2.5 text-[13px] text-ink-900 placeholder:text-ink-400 transition shadow-softer ${focusRing}`,
  inputMonoPromptTall:
    `mt-1 min-h-[72px] w-full rounded-xl border border-cream-300 bg-cream-50 p-2.5 text-[13px] text-ink-900 placeholder:text-ink-400 transition shadow-softer ${focusRing}`,
  inputMonoEssay:
    `min-h-[200px] w-full rounded-xl border border-cream-300 bg-cream-50 p-3 text-[13px] leading-6 text-ink-900 placeholder:text-ink-400 transition shadow-softer ${focusRing}`,

  subtleButtonMuted:
    `${baseBtn} rounded-xl border border-cream-300 bg-cream-100 px-2.5 py-1 text-xs text-ink-500 shadow-softer hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700`,
  subtleButtonMutedWide:
    `${baseBtn} rounded-xl border border-cream-300 bg-cream-100 px-3 py-1.5 text-xs text-ink-500 shadow-softer hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700`,

  pageStack: "space-y-3 poly-stagger",

  // ========== Practice ==========
  practiceShell: "flex h-full flex-col gap-3",
  practiceHeaderCard:
    "rounded-2xl border border-cream-300/80 bg-cream-100 p-3 shadow-softer",
  practiceTopRow: "mb-2 flex items-center justify-between",
  practiceScenarioLabel:
    "poly-serif flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500",
  practiceHeaderHint: "text-[10px] text-ink-400",
  practiceGroupWrap: "mb-2 last:mb-0",
  practiceGroupTitle:
    "mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400",
  practiceScenarioTabs: "flex flex-wrap gap-1",
  practiceScenarioButton:
    "poly-serif rounded-lg px-2.5 py-1 text-[12px] transition",
  practiceScenarioActive:
    "bg-cream-100 text-brand-700 ring-1 ring-inset ring-brand-300 shadow-softer",
  practiceScenarioIdle:
    "bg-cream-200/60 text-ink-500 hover:bg-cream-200 hover:text-ink-900",
  practiceVocabPanel: "mt-3 border-t border-cream-300/80 pt-2",
  practiceVocabHeader:
    "mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500",
  practiceUseAllActive: "text-brand-700 font-semibold",
  practiceUseAllIdle: "text-ink-500 hover:text-ink-900",
  practiceVocabList:
    "poly-scroll flex max-h-24 flex-wrap gap-1 overflow-y-auto",
  practiceVocabChip:
    "rounded-full border px-2 py-0.5 text-[11px] transition",
  practiceVocabChipActive:
    "border-brand-300 bg-brand-50 text-brand-700",
  practiceVocabChipIdle:
    "border-cream-300 bg-cream-50 text-ink-500 hover:text-ink-900 hover:border-cream-400",
  practiceTip: "mt-2 text-xs text-ink-500",
  practiceMessageText: "m-0 whitespace-pre-wrap leading-6",
  practiceEmptyCard:
    "rounded-2xl border border-dashed border-ink-300/60 bg-cream-100/60 p-4 text-sm text-ink-500",
  practiceChatPanel:
    "poly-scroll flex-1 space-y-2 overflow-y-auto rounded-2xl border border-cream-300/80 bg-cream-50 p-3 shadow-softer",
  practiceTurnBubble:
    "rounded-2xl border px-3 py-2 text-sm shadow-softer",
  practiceTurnUser:
    "ml-6 border-brand-200 bg-gradient-to-br from-brand-50 to-cream-100 text-ink-900",
  practiceTurnAssistant:
    "mr-6 border-cream-300 bg-cream-100 text-ink-800",
  practiceComposer: "flex items-end gap-2",
  practiceComposerInput: "min-h-[56px] flex-1",
  practiceComposerInputField:
    `min-h-[56px] flex-1 rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition shadow-softer ${focusRing}`,
  practiceInputActions: "flex flex-col gap-1.5",
  practiceStartButton:
    `${baseBtn} poly-ripple rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gradient-to-br from-brand-400 to-brand-600 shadow-coral hover:brightness-105 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`,
  practiceSendButton:
    `${baseBtn} poly-ripple rounded-xl px-3 py-2 text-sm font-semibold text-white bg-gradient-to-br from-brand-400 to-brand-600 shadow-coral hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`,
  practiceStopButton:
    `${baseBtn} rounded-xl border border-cream-300 bg-cream-100 px-3 py-1 text-[11px] text-ink-500 shadow-softer hover:border-cream-400 hover:bg-cream-200 hover:text-ink-900`,
  practiceResetButton:
    `${baseBtn} rounded-xl border border-cream-300 bg-cream-100 px-3 py-1 text-[11px] text-ink-400 shadow-softer hover:border-cream-400 hover:bg-cream-200 hover:text-ink-700`,

  // ========== Chat ==========
  chatShell: "flex h-full flex-col gap-3",
  chatEmptyCard:
    "rounded-2xl border border-dashed border-ink-300/60 bg-cream-100/60 p-5 text-sm text-ink-500",
  chatContextCard:
    "rounded-2xl border border-cream-300/80 bg-cream-100 p-3 text-xs text-ink-600 shadow-softer",
  chatTurnsList: "poly-scroll flex-1 space-y-2.5 overflow-y-auto",
  chatTurnBubble:
    "rounded-2xl border px-3.5 py-2.5 text-sm shadow-softer transition hover:shadow-soft",
  chatTurnUser:
    "border-brand-200 bg-gradient-to-br from-brand-50 to-cream-100 text-ink-900",
  chatTurnAssistant:
    "border-cream-300 bg-cream-100 text-ink-800",
  chatTurnMeta:
    "mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400",
  chatTurnText: "m-0 whitespace-pre-wrap leading-6",
  chatComposer: "flex items-end gap-2",
  chatComposerInput: "min-h-[56px] flex-1",
  chatComposerInputField:
    `min-h-[56px] flex-1 rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition shadow-softer ${focusRing}`,
  chatSendButton:
    `${baseBtn} poly-ripple rounded-xl px-3.5 py-2 text-sm font-semibold text-white bg-gradient-to-br from-brand-400 to-brand-600 shadow-coral hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none`,
  chatStopButton:
    `${baseBtn} rounded-xl border border-cream-300 bg-cream-100 px-3 py-2 text-xs text-ink-500 shadow-softer hover:border-cream-400 hover:bg-cream-200 hover:text-ink-900`,

  inputInlineFull:
    "w-full rounded-md border border-cream-300 bg-cream-50 px-2 py-1 text-[12px] text-ink-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
  subtleButtonMiniMuted:
    "rounded-md border border-cream-300 bg-cream-100 px-2 py-0.5 text-ink-700 shadow-softer transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
  subtleButtonMiniMutedDisabled:
    "rounded-md border border-cream-300 bg-cream-100 px-2 py-0.5 text-ink-700 shadow-softer transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed",
  dangerButtonMini:
    "rounded-md border border-cream-300 bg-cream-100 px-2 py-0.5 text-rose-500 shadow-softer transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600",

  reviewRevealButton:
    `${baseBtn} poly-ripple mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gradient-to-br from-brand-400 to-brand-600 shadow-coral hover:brightness-105 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none`,

  accentCardCompact:
    "poly-accent-rule poly-spring relative rounded-2xl bg-cream-100 p-3 pl-4 shadow-soft border border-cream-300/80",

  loadingText: "text-sm text-ink-500",
  metaText: "text-[11px] text-ink-500",

  historySummaryRow:
    "flex items-center justify-between text-[11px] text-ink-500",
  historyItemCard:
    "poly-spring rounded-2xl border border-cream-300/80 bg-cream-100 p-3 text-sm shadow-softer hover:shadow-soft",

  latestMetaRow:
    "flex items-center justify-between text-[11px] text-ink-500",
  inlineMetaGroup: "flex items-center gap-2",
  dotDivider: "h-1 w-1 rounded-full bg-cream-400",
  phoneticHint: "mt-2 text-xs text-ink-500",

  latestEmptyCard:
    "rounded-2xl border border-dashed border-ink-300/60 bg-cream-100/60 p-6 text-center text-sm text-ink-500",
  latestCardBase:
    "poly-spring relative rounded-2xl border p-4",
  latestCardHighlight:
    "poly-accent-rule bg-cream-100 shadow-lifted border-brand-200/70 pl-5",
  latestCardDefault:
    "border-cream-300/80 bg-cream-100 shadow-softer",
  latestCardHeader: "mb-2 flex items-center justify-between",
  latestPillBase:
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1 ring-inset",
  latestPillEmerald:
    "bg-brand-50 text-brand-700 ring-brand-200",
  latestPillSlate:
    "bg-cream-200 text-ink-600 ring-cream-300",
  latestValueBase: "m-0 whitespace-pre-wrap break-words leading-7",
  latestValueLarge: "poly-serif text-[17px] font-semibold text-ink-900",
  latestValueDefault: "text-[14px] text-ink-700",
  latestValueError: "!text-rose-600",

  // ========== Dashboard ==========
  dashboardCard:
    "poly-spring relative rounded-2xl border border-cream-300/80 bg-cream-100 p-4 shadow-lifted",
  dashboardHeader: "mb-3 flex items-center justify-between",
  dashboardHeaderLeft: "flex items-center gap-2",
  dashboardTitle:
    "poly-serif text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-600",
  dashboardSummary:
    "text-[10px] uppercase tracking-[0.12em] text-ink-400",
  dashboardMetricsGrid: "grid grid-cols-3 gap-2",
  dashboardChartWrap: "mt-4",
  dashboardChartHeader:
    "mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-ink-400",
  dashboardChartBars: "flex h-16 items-end gap-1",
  dashboardChartBarItem:
    "group relative flex flex-1 flex-col items-center",
  dashboardChartBarBase:
    "w-full rounded-t-md transition-all duration-300",
  dashboardChartBarActive:
    "bg-gradient-to-t from-brand-300 to-brand-500 group-hover:shadow-coral",
  dashboardChartBarIdle: "bg-cream-300",
  dashboardChartLabel:
    "mt-1.5 text-[9px] font-semibold text-ink-400",
  dashboardMetricCard:
    "rounded-xl border px-3 py-2 transition shadow-softer",
  dashboardMetricLabel:
    "text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80",
  dashboardMetricValue:
    "poly-serif mt-0.5 text-[22px] font-bold tracking-tight tabular-nums",
  dashboardMetricBlue:
    "bg-brand-50 text-brand-700 border-brand-200",
  dashboardMetricEmerald:
    "bg-sage-500/10 text-sage-600 border-sage-500/30",
  dashboardMetricAmber:
    "bg-amber-50 text-amber-700 border-amber-200",
  dashboardMetricBlueCard:
    "rounded-xl border px-3 py-2 transition shadow-softer bg-brand-50 text-brand-700 border-brand-200 hover:shadow-soft hover:-translate-y-0.5",
  dashboardMetricEmeraldCard:
    "rounded-xl border px-3 py-2 transition shadow-softer bg-sage-500/10 text-sage-600 border-sage-500/30 hover:shadow-soft hover:-translate-y-0.5",
  dashboardMetricAmberCard:
    "rounded-xl border px-3 py-2 transition shadow-softer bg-amber-50 text-amber-700 border-amber-200 hover:shadow-soft hover:-translate-y-0.5",

  streakEmptyBadge:
    "rounded-full bg-cream-200 px-2 py-0.5 text-[10px] text-ink-500 ring-1 ring-inset ring-cream-300",
  streakHotBadge:
    "rounded-full bg-gradient-to-r from-brand-100 to-brand-200 px-2 py-0.5 text-[10px] font-bold text-brand-700 ring-1 ring-inset ring-brand-300 shadow-coral",
  streakWarmBadge:
    "rounded-full bg-sage-500/15 px-2 py-0.5 text-[10px] font-bold text-sage-600 ring-1 ring-inset ring-sage-500/30",

  dayTitleBrand:
    "poly-serif text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-600",
  tinyMetaRow: "flex items-center gap-2 text-[11px]",
  dayGroupTitle:
    "poly-serif text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-500",

  stackLg: "space-y-4",
  vocabModeRow: "flex items-center gap-1 text-xs",
  stackTight: "space-y-1.5",
  badgeBase:
    "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
  cardTopRow:
    "flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-ink-400",
  cardBodyText:
    "mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-700",
  cardBodyStrong:
    "poly-serif mt-1 whitespace-pre-wrap text-[14px] font-semibold leading-relaxed text-ink-900",
  cardBottomRow:
    "mt-2 flex items-center justify-between text-[10px] text-ink-400",
  accentCard:
    "poly-accent-rule poly-spring relative rounded-2xl bg-cream-100 p-4 pl-5 shadow-lifted border border-cream-300/80",
} as const;
