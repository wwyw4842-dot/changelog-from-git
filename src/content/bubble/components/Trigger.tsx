import { UI } from "./ui";

/** 划词后出现的小触发按钮（点击后才真正发起翻译并展开气泡） */
export function Trigger({
  position,
  label,
  onClick,
}: {
  position: { x: number; y: number };
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        pointerEvents: "auto",
      }}
      className={UI.trigger}
    >
      {label}
    </button>
  );
}
