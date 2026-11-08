// Foliole 设置页的语义样式映射。
// 具体视觉集中在 options.css，分区组件只表达控件用途。

const control = "foliole-settings-control";

export const optionUi = {
  pageStack: "foliole-options-page-stack",

  card: "foliole-settings-card",
  cardBody: "foliole-settings-card-body",
  cardBodyDense: "foliole-settings-card-body-dense",
  cardTitle: "foliole-settings-card-title",
  cardTitleStrong: "foliole-settings-card-title-strong",
  cardNote: "foliole-settings-card-note",
  cardTextMuted: "foliole-settings-muted",
  cardStatusSuccess: "foliole-settings-success",
  cardTextBody: "foliole-settings-text-card",

  sectionBody: "foliole-options-section-body",
  cardsStack: "foliole-options-cards-stack",
  groupHeading: "foliole-settings-group-heading",

  rowBetween: "foliole-settings-row-between",
  rowInlineActions: "foliole-settings-inline-actions",
  rowInlineMeta: "foliole-settings-inline-meta",
  confirmRow: "foliole-settings-confirm-row",

  credentialsGrid: "foliole-settings-credentials-grid",
  fieldColumn: "foliole-settings-field-column",
  toggleRow: "foliole-settings-toggle-row",
  toggleCopy: "foliole-settings-toggle-copy",

  listCompact: "foliole-settings-list",
  fieldRow: "foliole-settings-field-row",
  fieldLabel: "foliole-settings-field-label",
  hintInline: "foliole-settings-hint",

  subtleButton: "foliole-settings-button",
  subtleButtonMt: "foliole-settings-button has-top-margin",
  subtleButtonSm: "foliole-settings-button is-small",
  dangerButton: "foliole-settings-button is-danger",

  input: control,
  inputW24: `${control} is-compact`,
  inputH88: control,
  inputW80: `${control} is-wide`,
  inputMax320: `${control} is-medium`,
  inputMono: `${control} is-mono`,

  kbd: "foliole-settings-kbd",
} as const;
