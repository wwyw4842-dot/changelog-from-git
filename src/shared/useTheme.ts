import { useEffect } from "react";
import type { Settings } from "./types";

/**
 * 根据 settings.theme 在 <html> 上写 `data-poly-theme` 属性。
 *
 * - "system" → 移除属性，交给 @media (prefers-color-scheme) 处理
 * - "dark"   → data-poly-theme="dark"
 * - "light"  → data-poly-theme="light"
 *
 * CSS 侧通过 :root[data-poly-theme="dark"] 选择器覆盖所有暗色样式。
 */
export function useTheme(theme: Settings["theme"] | undefined): void {
  useEffect(() => {
    const root = document.documentElement;

    if (!theme || theme === "system") {
      root.removeAttribute("data-poly-theme");
      return;
    }

    root.setAttribute("data-poly-theme", theme);
  }, [theme]);
}
