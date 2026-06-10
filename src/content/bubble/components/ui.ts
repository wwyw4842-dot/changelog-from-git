// 气泡内部共享的样式类名常量（样式实现在 bubble.css 与 Tailwind 原子类中）
// 注意：仅做结构拆分，类名字符串与拆分前完全一致，不要在此调整视觉样式。
export const UI = {
  trigger: "poly-trigger-base",
  bubble: "poly-bubble-base poly-surface flex flex-col overflow-hidden",
  header:
    "poly-drag-handle flex items-center justify-between border-b border-[rgba(120,90,80,0.12)] px-3 py-2 text-[11px] uppercase tracking-[0.14em]",
  rowInline: "flex items-center gap-2",
  rowInlineTight: "flex items-center gap-1",
  brandDot: "poly-brand-dot",
  text70:
    "poly-serif text-[11px] font-semibold tracking-[0.18em] text-[#9a4a3d]",
  text50: "text-[10px] font-medium tracking-[0.12em] text-[#867566]",
  body: "poly-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3",
  detailsPanel:
    "mt-2 space-y-3 rounded-xl border border-[rgba(120,90,80,0.10)] bg-[#fbf6f1] p-3 text-[12.5px]",
  sectionTitle:
    "poly-serif mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9a4a3d]",
  tagsWrap: "flex flex-wrap gap-1",
  altTag:
    "rounded-full border border-[rgba(184,95,80,0.30)] bg-[#fbf0eb] px-2 py-0.5 text-[11px] font-medium text-[#9a4a3d] transition hover:bg-[#f4dcd1]",
  explanationText:
    "poly-prose m-0 text-[13.5px] !leading-[1.75] text-[#43382e]",
  listTight: "m-0 list-none space-y-0.5 p-0",
  posItem: "flex gap-2 text-[12px]",
  posLabel: "poly-serif font-semibold text-[#9a4a3d]",
  examplesList: "m-0 list-none space-y-1.5 p-0",
  exampleTgt: "text-[#867566]",
  footer:
    "flex flex-wrap items-center gap-1 border-t border-[rgba(120,90,80,0.12)] bg-[rgba(244,236,230,0.4)] px-3 py-2",
  whitelistWrap:
    "mr-1 flex select-none items-center gap-1.5 text-[11px] text-[#867566]",
  nowrap: "whitespace-nowrap",
  rightTools: "ml-auto flex items-center gap-1",
  subtleToolBtn:
    "rounded-md px-2 py-1 text-[11px] text-[#867566] transition hover:bg-[rgba(244,236,230,0.7)] hover:text-[#43382e] active:scale-95",
  valueRow: "flex gap-2 text-[13px]",
  valueLabel:
    "min-w-[40px] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a89886]",
  valueBase: "whitespace-pre-wrap break-words",
  valueEmphasized:
    "poly-serif whitespace-pre-wrap break-words font-semibold text-[15px] text-[#1a1612]",
  valueSmall: "whitespace-pre-wrap break-words text-[12px] text-[#5e4f43]",
  valueMuted: "whitespace-pre-wrap break-words text-[#867566]",
  valueError: "whitespace-pre-wrap break-words text-rose-600",
  valueEmphasizedMuted:
    "poly-serif whitespace-pre-wrap break-words font-semibold text-[15px] text-[#867566]",
  valueEmphasizedError:
    "poly-serif whitespace-pre-wrap break-words font-semibold text-[15px] text-rose-600",
  valueSmallMuted: "whitespace-pre-wrap break-words text-[12px] text-[#a89886]",
  valueSmallError: "whitespace-pre-wrap break-words text-[12px] text-rose-600",
  valueMutedError: "whitespace-pre-wrap break-words text-rose-500",
  iconBtnActive:
    "rounded-md px-1.5 py-0.5 text-[12px] transition bg-[#fbf0eb] text-[#9a4a3d] ring-1 ring-inset ring-[rgba(184,95,80,0.30)]",
  iconBtnIdle:
    "rounded-md px-1.5 py-0.5 text-[12px] transition text-[#867566] hover:bg-[rgba(244,236,230,0.7)] hover:text-[#43382e] active:scale-95",
  whitelistSwitchOn:
    "relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full p-[3px] transition-all duration-200 bg-gradient-to-r from-[#d99989] via-[#b85f50] to-[#9a4a3d] shadow-[0_4px_12px_-2px_rgba(184,95,80,0.40)]",
  whitelistSwitchOff:
    "relative inline-flex h-[22px] w-[40px] shrink-0 items-center rounded-full p-[3px] transition-all duration-200 bg-[#dfd3c8] dark:bg-[#43382e]",
  whitelistKnobOn:
    "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-[0_2px_6px_rgba(184,95,80,0.40)] transition-transform duration-200 ease-out translate-x-[18px]",
  whitelistKnobOff:
    "pointer-events-none block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-out translate-x-0",
  actionBtnAccent:
    "poly-ripple rounded-lg px-2.5 py-1 text-[12px] font-semibold text-white bg-gradient-to-r from-[#d99989] via-[#b85f50] to-[#9a4a3d] shadow-[0_4px_14px_-4px_rgba(184,95,80,0.50)] transition hover:brightness-105 active:scale-95",
  actionBtnDefault:
    "rounded-lg px-2.5 py-1 text-[12px] text-[#43382e] bg-[#fbf6f1] border border-[rgba(120,90,80,0.15)] transition hover:border-[rgba(184,95,80,0.30)] hover:bg-[#fbf0eb] hover:text-[#9a4a3d] active:scale-95 dark:bg-[#43382e] dark:border-[rgba(255,230,210,0.15)] dark:text-[#f1ede8]",
} as const;
