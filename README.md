# Polyglot · AI 语言助手（v1.0）

> 面向学习者与专业读者的 AI 驱动浏览器翻译扩展，支持 Edge / Chrome (Manifest V3)。

前身是一个极简划词翻译插件，本次完整重构为：多引擎矩阵 + LLM 深度解读 + 生词本 SRS + 沉浸式整页翻译 + PDF/OCR + 输入框增强的现代语言助手，同时保留了原版"划词 < 200ms 出气泡"的极简体验。

## 主要能力

| 分类 | 能力 |
| --- | --- |
| 划词翻译 | 划词即出浮动气泡；Alt 触发 / 快捷键 / 右键菜单三种入口 |
| 多引擎矩阵 | MyMemory · Google · Bing · DeepL · 火山翻译 · OpenAI · Claude · Gemini · Ollama（本地） |
| 深度解读 | LLM 流式输出：译文 / 音标 / 词性 / 2-3 例句 / 解读 |
| 侧边栏 | 四个 Tab：最新结果 / 历史（搜索+导出） / 生词本 / AI 对话追问 |
| 生词本 | Dexie + SM-2 间隔重复，6 级评级复习，CSV / TSV(Anki) 导出 |
| 沉浸式整页 | 段落扫描 + IntersectionObserver 懒翻译 + 双语对照 |
| PDF / OCR | pdf.js 文本层钩子；tesseract.js 按需 CDN 加载做图像 OCR |
| 输入框增强 | 聚焦到 textarea/contenteditable 时挂工具条：润色 / 纠错 / 中译英 / 扩写 / 精简 |
| 安全 | API Key 用 WebCrypto AES-GCM 本地加密保存；白名单域名跳过注入 |

## 快捷键

- `Alt + T` 翻译选中文本
- `Alt + Shift + T` 沉浸式整页翻译
- `Alt + D` 对选中文本调用 LLM 进行深度解读

## 本地开发

```bash
npm install        # 首次拉取依赖
npm run dev        # Vite + CRXJS，支持扩展 HMR
npm run build      # 产物输出到 dist/
npm test           # Vitest 单元测试（provider / 缓存 / SM-2 / prompt）
npm run lint       # ESLint（TypeScript + React）
npm run format     # Prettier 格式化
```

在 `edge://extensions/` 或 `chrome://extensions/` 中开启开发者模式，"加载已解压的扩展"选择 `dist/` 目录。

## 目录结构

```
src/
  background/service-worker.ts   # MV3 后台路由 + 右键菜单 + 命令 + 流式 Port
  content/
    bootstrap.ts                 # content 协调器：选区检测、键盘、消息分发
    bubble/                      # React + Tailwind 浮动气泡（Shadow DOM）
    immersive/                   # 沉浸式整页翻译 controller
    pdf/                         # PDF 文本层 hook
    ocr/                         # 按需加载 tesseract.js
    inputEnhance/                # 输入框工具条
  providers/                     # 翻译引擎抽象层
    types.ts                     # TranslationProvider 接口
    registry.ts                  # 主引擎 + fallback 链调度
    cache.ts                     # LRU + chrome.storage.local 持久化
    mymemory.ts / google.ts / bing.ts / deepl.ts / volcano.ts
    llm/                         # OpenAI / Claude / Gemini / Ollama 流式
  shared/
    messaging.ts                 # 类型安全 send/onMessage 总线
    storage/                     # settings / history(Dexie) / vocabulary(SM-2) / crypto
    i18n.ts                      # 中英文字典 + 自动检测
    utils.ts                     # 语言探测、TTS 语言映射、debounce 等
  sidepanel/                     # React + Tailwind 侧边栏
    pages/ Latest / History / Vocabulary / Chat
  options/                       # React + Tailwind 设置页
  popup/                         # 快速翻译 popup
```

## 架构要点

- **消息总线** `src/shared/messaging.ts` 用 TypeScript Mapped Type 把每个 channel 的请求/响应类型锁死在一张字典里，避免 `switch(message.type)` 的字符串散乱。
- **Provider 抽象** 所有引擎实现 `TranslationProvider`。LLM 通过 `AsyncIterable<Partial<TranslationResult>>` 支持流式；经典引擎一次性返回。`registry.translateViaChain` 支持主引擎 + 降级链 + onChunk 回调。
- **流式通道** content/sidepanel 通过 `chrome.runtime.connect({ name: "polyglot-stream" })` 建立 Port，background 会逐 chunk 转发，用户可在气泡或对话窗里看到 token 逐字流出。
- **Shadow DOM + Tailwind** `bubble.css` 通过 `?inline` 被 Vite/PostCSS 编译成完整的 Tailwind 样式字符串，随后通过 `adoptedStyleSheets` 注入到 Shadow Root，实现与宿主站 0 污染。
- **SM-2 间隔重复** 生词本 `reviewVocabulary(id, quality)` 严格按 SM-2 更新 `easeFactor / interval / reps`，最小 ease=1.3。测试覆盖在 `src/shared/storage/vocabulary.test.ts`。
- **加密存储** `src/shared/storage/crypto.ts` 在安装时生成 256-bit AES-GCM 主密钥存 local，API Key 保存时自动加密为 `enc:<base64>` 形态；settings.sync 里不放敏感字段，仅 local 存加密密文。

## 已知取舍

- Tesseract.js 在首次 OCR 时从 CDN 懒加载（避免把 10MB+ 模型塞进扩展包）。
- Google / Bing / 火山 使用的是 Web 免费端点，风控激增时请切到付费 API。
- MV3 service worker 随时休眠；缓存首次启动会从 `chrome.storage.local` 快速 hydrate。
- 沉浸式整页目前只翻译块级节点（`p/h1-h6/li/blockquote/dd/figcaption`），不处理表格单元格。

## 从 v0 迁移

`src/shared/storage/settings.ts` 的 `initializeSettings()` 会在首启自动检测旧 v0 数据，把 `triggerMode/fontSize/whitelist/apiKey/apiUser/sourceLang/targetLang` 迁移到 v1.0 schema，并打上 `_migratedTo: "1.0.0"` 标记。旧的 `translationHistory` 保留在 chrome.storage.local，不强行搬到 Dexie（避免一次性读写大对象）。

旧版源码保留在 `legacy/`，方便对照比较。

## License

MIT
