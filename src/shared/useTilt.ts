import { useEffect, useRef } from "react";

interface TiltOptions {
  /** 最大倾斜角度，默认 2.5° */
  max?: number;
  /** 弹簧曲线（true）还是 linear（false），默认 true */
  spring?: boolean;
}

/**
 * 卡片 3D 微倾斜：鼠标位置驱动 rotateX/rotateY，离开归位。
 * 用法：把返回的 ref 绑到任意元素，再加 `poly-tilt-host` 类即可。
 * 默认 ±2.5°，配合 `transform-style: preserve-3d` 实现轻微"看向鼠标"。
 *
 * 与 useSpotlight 完全正交，可叠加：
 *   <div ref={spotlightRef} className="poly-spotlight">
 *     <div ref={tiltRef} className="poly-tilt-host">…</div>
 *   </div>
 */
export function useTilt<T extends HTMLElement>(options: TiltOptions = {}) {
  const { max = 2.5, spring = true } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let rafId = 0;
    let pendingX = 0;
    let pendingY = 0;
    let hovering = false;

    const apply = () => {
      rafId = 0;
      el.style.setProperty("--tilt-x", `${pendingX.toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${pendingY.toFixed(2)}deg`);
    };

    const onMove = (event: MouseEvent) => {
      hovering = true;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // 鼠标相对中心的归一化坐标，范围 [-1, 1]
      const nx = (event.clientX - cx) / (rect.width / 2);
      const ny = (event.clientY - cy) / (rect.height / 2);
      // 注意 rotateX 由上下移动控制（绕水平轴），rotateY 由左右移动控制
      pendingY = nx * max;
      pendingX = -ny * max;
      if (!rafId) rafId = requestAnimationFrame(apply);
    };

    const onLeave = () => {
      hovering = false;
      pendingX = 0;
      pendingY = 0;
      if (!rafId) rafId = requestAnimationFrame(apply);
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    // 离开时也清掉 css 变量，避免页面切走还残留
    el.style.setProperty("--tilt-spring", spring ? "1" : "0");

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (rafId) cancelAnimationFrame(rafId);
      void hovering; // 仅用于压制 lint
    };
  }, [max, spring]);

  return ref;
}
