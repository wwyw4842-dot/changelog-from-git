# 2026-05-20 — Polyglot — 引入 Playwright E2E 自动化端到端测试

**Agent**: Antigravity (Gemini 3.5 Flash)
**任务**: 为 Polyglot 浏览器扩展引入 Playwright 端到端（E2E）测试框架，并实现完整的划词气泡注入和 Options 设置自动保存的自动化脚本校验。

## 做了什么
- **测试依赖安装与环境部署**：
  - 安装了 `@playwright/test` 开发依赖，并下载了测试用 Chromium 及 FFmpeg 核心。
  - 创建了 `playwright.config.ts`，配置单 Worker 串行，排除非 Chrome 环境，规避并发扩展测试产生的 Profile 冲突。
- **自定义 E2E Fixtures 封装**：
  - 创建了 `tests-e2e/fixtures.ts`，支持 Node ESM 的 `import.meta.url` 路径解析。
  - 自动在 Chromium 中动态加载打包好的 `dist/` 扩展目录，并精准拦截 Background Service Worker 提取随机 `extensionId`。
  - 开启 `--headless=new` 实现了完全 headless 下的 Chrome 扩展集成测试。
- **自动化测试用例编写与运行**：
  - 创建了本地静态页面 `tests-e2e/mock-page.html` 模拟划词选区。
  - 在 `tests-e2e/bubble.spec.ts` 中自建零依赖 node HTTP 服务器，模拟真实双击选词，断言 `#__polyglot_host__` 的 Shadow DOM 宿主容器成功注入页面，无样式污染。
  - 在 `tests-e2e/options.spec.ts` 中模拟设置项（触发模式、开启雅思模式）的选中、点击，并测试状态与 auto-save 的“已保存”标签显隐判定。
  - 配置 `package.json` 中的 `npm run test:e2e` 命令，并成功运行通过全部 2 个 Spec 的测试（共 2 个用例全部 PASS，用时 7.3s）。

## 关键决策
- **自建极简 HTTP 托管**：在 `bubble.spec.ts` 中通过 node 原生 `http` 和 `fs` 建立内存 web 服务器，彻底解决了 Chromium 默认禁止扩展内容脚本在 `file://` 下直接运行的问题。
- **ESM 兼容的 __dirname**：由于 package.json 声明为 `"type": "module"`，在 ts 脚本中通过 `url.fileURLToPath` 手动构建 `__dirname`，解决了模块查找时的 `ReferenceError` 报错。

## 当前状态
- E2E 自动化测试框架已 100% 部署并运行成功。
- 在 `D:\developer\my project\translate plugin\` 留下全新且跑通的 `tests-e2e/` 测试包。

## 给下一个智能体
- 开发或修改 UI 时，建议执行 `npm run test:e2e` 来验证基础交互是否被破坏。
- 可随时使用 `npm run test:e2e:ui` 唤起 Playwright 的 GUI 面板调试鼠标选词事件和元素快照。
