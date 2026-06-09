import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{ts,tsx,html}",
    "./src/content/bubble/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 主品牌：莫兰迪珊瑚红
        brand: {
          DEFAULT: "#b85f50",
          50: "#fbf0eb",
          100: "#f4dcd1",
          200: "#ecc4b3",
          300: "#e1a795",
          400: "#d48677",
          500: "#b85f50",
          600: "#9a4a3d",
          700: "#7a392f",
          800: "#5d2b24",
          900: "#3d1c17",
        },
        // 米奶基底
        cream: {
          50: "#fefbf6",
          100: "#fbf6f1",
          200: "#f4ece6",
          300: "#ece4dd",
          400: "#dfd3c8",
          500: "#cbbeb1",
          600: "#a89888",
        },
        // 暖灰文字
        ink: {
          50: "#fbf9f6",
          100: "#f1ede8",
          200: "#e3dcd2",
          300: "#cabfaf",
          400: "#a89886",
          500: "#867566",
          600: "#5e4f43",
          700: "#43382e",
          800: "#2e261f",
          900: "#1a1612",
        },
        // 辅助强调（仅在状态语义需要时使用）
        sage: {
          400: "#9ab09a",
          500: "#7d967d",
          600: "#5e7a5e",
        },
        dusty: {
          gold: "#c9a96a",
          plum: "#a07a8a",
        },
        surface: {
          DEFAULT: "rgba(255, 252, 247, 0.94)",
          dark: "rgba(46, 38, 31, 0.92)",
        },
      },
      fontFamily: {
        serif: [
          '"Source Serif Pro"',
          '"Source Han Serif SC"',
          '"Noto Serif SC"',
          '"Songti SC"',
          "Georgia",
          "serif",
        ],
        sans: [
          '"-apple-system"',
          "BlinkMacSystemFont",
          '"Segoe UI Variable"',
          '"Segoe UI"',
          "Inter",
          '"PingFang SC"',
          '"Microsoft YaHei"',
          "sans-serif",
        ],
      },
      boxShadow: {
        bubble: "0 12px 28px -10px rgba(120, 90, 80, 0.30)",
        glow: "0 8px 24px -10px rgba(184, 95, 80, 0.40)",
        soft: "0 1px 1px rgba(120, 90, 80, 0.05), 0 10px 30px -14px rgba(120, 90, 80, 0.25)",
        softer: "0 1px 1px rgba(120, 90, 80, 0.04), 0 4px 14px -8px rgba(120, 90, 80, 0.18)",
        lifted:
          "0 1px 2px rgba(120, 90, 80, 0.06), 0 18px 40px -16px rgba(120, 90, 80, 0.32), 0 28px 56px -28px rgba(184, 95, 80, 0.20)",
        coral: "0 0 24px -6px rgba(184, 95, 80, 0.45)",
        paper: "inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 6px 16px -10px rgba(120, 90, 80, 0.25)",
      },
      backdropBlur: {
        xs: "2px",
      },
      backgroundImage: {
        "page-wash":
          "radial-gradient(900px 380px at 8% -10%, rgba(217, 153, 137, 0.18), transparent 60%), radial-gradient(720px 320px at 100% 0%, rgba(201, 169, 106, 0.12), transparent 65%), radial-gradient(680px 320px at 50% 110%, rgba(160, 122, 138, 0.10), transparent 65%), linear-gradient(180deg, #faf7f2 0%, #f4ece6 100%)",
        "paper-grain":
          "radial-gradient(circle at 1px 1px, rgba(120, 90, 80, 0.04) 1px, transparent 0)",
        "coral-flow":
          "linear-gradient(120deg, #d99989 0%, #b85f50 50%, #d99989 100%)",
      },
      keyframes: {
        "ink-spread": {
          "0%": { transform: "scaleX(0)", opacity: "0" },
          "50%": { transform: "scaleX(1.1)", opacity: "1" },
          "100%": { transform: "scaleX(1)", opacity: "1" },
        },
        "soft-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "letter-reveal": {
          "0%": { opacity: "0", transform: "translateY(6px)", letterSpacing: "0.1em" },
          "100%": { opacity: "1", transform: "translateY(0)", letterSpacing: "normal" },
        },
        breathe: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "ink-spread": "ink-spread 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "soft-float": "soft-float 6s ease-in-out infinite",
        "fade-up": "fade-up 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "letter-reveal": "letter-reveal 600ms cubic-bezier(0.4, 0, 0.2, 1) both",
        breathe: "breathe 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
