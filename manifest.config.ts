import { defineManifest } from "@crxjs/vite-plugin";

const version = "2.0.0";

export default defineManifest({
  manifest_version: 3,
  name: "Polyglot - AI 语言助手",
  short_name: "Polyglot",
  description: "多引擎划词翻译 + LLM 深度解读 + 生词本 SRS + 沉浸式整页翻译 + PDF/OCR。",
  version,
  icons: {
    16: "public/icons/icon-16.png",
    32: "public/icons/icon-32.png",
    48: "public/icons/icon-48.png",
    128: "public/icons/icon-128.png",
  },
  action: {
    default_title: "Polyglot",
    default_popup: "src/popup/popup.html",
  },
  options_ui: {
    page: "src/options/options.html",
    open_in_tab: true,
  },
  side_panel: {
    default_path: "src/sidepanel/sidepanel.html",
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/bootstrap.ts"],
      run_at: "document_idle",
      all_frames: false,
    },
  ],
  permissions: [
    "storage",
    "activeTab",
    "scripting",
    "tts",
    "sidePanel",
    "contextMenus",
    "offscreen",
    "notifications",
  ],
  host_permissions: ["<all_urls>"],
  commands: {
    "translate-selection": {
      suggested_key: { default: "Alt+T" },
      description: "翻译当前选中的文本",
    },
    "translate-page": {
      suggested_key: { default: "Alt+Shift+T" },
      description: "沉浸式整页翻译",
    },
    "translate-deep": {
      suggested_key: { default: "Alt+D" },
      description: "对选中文本进行深度解读",
    },
  },
  web_accessible_resources: [
    {
      resources: [
        "assets/*",
        "src/content/bubble/*",
        "public/icons/*",
        "vendor/tesseract/*",
        "vendor/tesseract/lang/*",
      ],
      matches: ["<all_urls>"],
    },
  ],
});
