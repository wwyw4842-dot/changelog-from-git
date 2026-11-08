import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";

const BUBBLE_MARGIN = 12;

/**
 * 把气泡限制在视口内：以选区锚点为基准向右下偏移 BUBBLE_MARGIN，
 * 超出右/下边界时回弹（下方放不下则翻转到锚点上方），并叠加用户拖拽偏移。
 * 纯函数，便于单独理解与复用。
 */
export function clampPosition(
  target: { x: number; y: number },
  offset: { dx: number; dy: number }
): { x: number; y: number; width: number; height: number } {
  const width = Math.min(420, window.innerWidth - BUBBLE_MARGIN * 2);
  const height = Math.min(480, window.innerHeight - BUBBLE_MARGIN * 2);
  let x = target.x + BUBBLE_MARGIN + offset.dx;
  let y = target.y + BUBBLE_MARGIN + offset.dy;
  if (x + width > window.innerWidth - BUBBLE_MARGIN) {
    x = Math.max(BUBBLE_MARGIN, window.innerWidth - width - BUBBLE_MARGIN);
  }
  if (y + height > window.innerHeight - BUBBLE_MARGIN) {
    y = Math.max(BUBBLE_MARGIN, target.y - height - BUBBLE_MARGIN + offset.dy);
  }
  if (x < BUBBLE_MARGIN) x = BUBBLE_MARGIN;
  if (y < BUBBLE_MARGIN) y = BUBBLE_MARGIN;
  return { x, y, width, height };
}

/**
 * 气泡定位 + 头部拖拽逻辑：
 * - 返回的 style 直接作用于气泡根节点（fixed 定位、宽高上限、透明度/字号 CSS 变量）；
 * - startDrag 绑定在 header 的 onMouseDown 上，拖动期间监听 window 的 mousemove/mouseup；
 * - 锚点位置变化（新一次划词）时重置拖拽偏移。
 */
export function useBubblePosition(
  position: { x: number; y: number },
  opacity: number,
  fontSize: number
): { style: CSSProperties; startDrag: (event: ReactMouseEvent) => void } {
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const startPosRef = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);

  const style = useMemo(() => {
    const { x, y, width, height } = clampPosition(position, dragOffset);
    return {
      position: "fixed" as const,
      left: x,
      top: y,
      width,
      maxHeight: height,
      pointerEvents: "auto" as const,
      "--poly-bubble-opacity": opacity,
      fontSize,
    };
  }, [position, dragOffset, opacity, fontSize]);

  useEffect(() => {
    setDragOffset({ dx: 0, dy: 0 });
  }, [position.x, position.y]);

  const startDrag = useCallback(
    (event: ReactMouseEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      startPosRef.current = {
        x: event.clientX,
        y: event.clientY,
        dx: dragOffset.dx,
        dy: dragOffset.dy,
      };
      const onMove = (e: MouseEvent) => {
        if (!startPosRef.current) return;
        setDragOffset({
          dx: startPosRef.current.dx + (e.clientX - startPosRef.current.x),
          dy: startPosRef.current.dy + (e.clientY - startPosRef.current.y),
        });
      };
      const onUp = () => {
        startPosRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [dragOffset]
  );

  return { style, startDrag };
}
