import { useEffect, useRef } from "react";

/**
 * 光标追随光晕（spotlight）。把返回的 ref 绑定到任意元素，
 * 同时给该元素加上 `poly-spotlight` 类，便会在元素内部跟随鼠标渲染柔光。
 *
 * 实现：监听 mousemove，把指针的 (x, y) 以像素写入 CSS 变量 --mx / --my，
 * theme.css 里 `.poly-spotlight::after` 用 `radial-gradient` 读这两个变量绘制光晕。
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (event: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      el.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    const onLeave = () => {
      el.style.removeProperty("--mx");
      el.style.removeProperty("--my");
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);
  return ref;
}

/**
 * 数字 odometer 滚动入场：传入目标数字，组件渲染时数字从 0 平滑递增到目标。
 * 返回当前显示值（整数）。可在 `mt-0.5 text-xl font-bold tabular-nums` 内直接渲染。
 */
import { useState } from "react";
export function useOdometer(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setValue(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const initial = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(initial + (target - initial) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}
