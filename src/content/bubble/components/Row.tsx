import { UI } from "./ui";

/** 正文里的一行键值展示（译文/原文/音标/错误信息共用） */
export function Row({
  label,
  value,
  emphasized,
  error,
  small,
  muted,
}: {
  label?: string;
  value: string;
  emphasized?: boolean;
  error?: boolean;
  small?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={UI.valueRow}>
      {label && <span className={UI.valueLabel}>{label}</span>}
      <span className={valueClass(emphasized, small, muted, error)}>{value}</span>
    </div>
  );
}

// 按 emphasized / small / muted / error 组合挑选样式（error 优先级最高）
function valueClass(emphasized?: boolean, small?: boolean, muted?: boolean, error?: boolean) {
  if (error) {
    if (emphasized) return UI.valueEmphasizedError;
    if (small) return UI.valueSmallError;
    if (muted) return UI.valueMutedError;
    return UI.valueError;
  }
  if (emphasized) {
    if (muted) return UI.valueEmphasizedMuted;
    return UI.valueEmphasized;
  }
  if (small) {
    if (muted) return UI.valueSmallMuted;
    return UI.valueSmall;
  }
  if (muted) return UI.valueMuted;
  return UI.valueBase;
}
