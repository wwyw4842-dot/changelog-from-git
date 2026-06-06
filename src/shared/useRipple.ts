import { useEffect } from "react";

/**
 * 全局点击位置 ripple 注入。
 *
 * 用法：在应用根组件 mount 一次 `useRipple()`，之后所有挂了
 * `.poly-ripple` 类的按钮在 pointerdown 时，会自动把 `--rx/--ry`
 * 写到 element style 上（百分比），CSS 中 `.poly-ripple::after`
 * 用 `left: var(--rx, 50%); top: var(--ry, 50%);` 即可让波纹从点击点扩散。
 *
 * 为什么用全局监听而不是每个按钮挂 ref：
 * - 已有 30+ 个按钮（ui.ts 中分散）已挂了 `.poly-ripple` 类
 * - 无需逐个改造 / 也兼容动态渲染的按钮
 */
export function useRipple() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // 用 composedPath 能透过 Shadow DOM 拿到真实 target（Bubble 在 content script 的 Shadow root 内）
      const path = (e.composedPath && e.composedPath()) || [];
      let btn: HTMLElement | null = null;
      for (const node of path) {
        if (node instanceof Element && node.classList && node.classList.contains("poly-ripple")) {
          btn = node as HTMLElement;
          break;
        }
      }
      if (!btn) {
        const target = e.target as Element | null;
        btn = target?.closest?.(".poly-ripple") as HTMLElement | null;
      }
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      btn.style.setProperty("--rx", `${x.toFixed(2)}%`);
      btn.style.setProperty("--ry", `${y.toFixed(2)}%`);
    };
    document.addEventListener("pointerdown", onDown, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, { capture: true } as any);
    };
  }, []);
}
