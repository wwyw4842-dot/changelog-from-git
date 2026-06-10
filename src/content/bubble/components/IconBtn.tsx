import type { ReactNode } from "react";
import { UI } from "./ui";

/** 头部小图标按钮（固定 / 关闭） */
export function IconBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={active ? UI.iconBtnActive : UI.iconBtnIdle}
    >
      {children}
    </button>
  );
}
