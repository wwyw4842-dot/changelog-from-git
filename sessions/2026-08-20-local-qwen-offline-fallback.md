# 2026-08-20 — 本地 Qwen 离线翻译保障

## 问题判断

用户截图仍显示旧品牌 `POLYGLOT`，并报错 `Cannot read properties of undefined (reading 'sendMessage')`。这不是在线 Provider 失败，而是扩展重新加载后，当前网页仍运行旧 content script；请求在进入 Service Worker 前已经失败，因此任何 Provider fallback 都无法介入。

## 本次实现

- 消息发送前安全检查 `chrome.runtime.id` 与 `sendMessage`，将失效的 `sendMessage/connect` TypeError 映射为“扩展已更新，请刷新本页后再翻译”。
- 快速与深度翻译均把 Ollama 固定为最后 fallback，并去除重复 Provider；旧用户设置无需迁移。
- 在线快速、在线深度与本地模型分别采用 5 秒、20 秒、60 秒的单次等待上限；用户取消时不继续回退。
- Ollama 默认改为 `http://127.0.0.1:11434` 与 `qwen2.5:0.5b`；未显式配置地址时也会自动探测本机备用端口 `11435`。同时增加 30 分钟 keep-alive、低温度、空响应检查，以及 daemon/模型缺失的友好提示。
- 设置页把可编辑项明确为“在线备用服务顺序”，另显示只读的本地 Qwen 固定保障。
- 本机已预下载 `qwen2.5:0.5b`（约 397 MB），并通过 Ollama API 实测将 `automate` 翻译为“自动化”。
- Ollama 官方要求浏览器扩展显式加入允许的 Origin。本机已通过 `~/Library/LaunchAgents/com.wyw.ollama-origins.plist` 持久放行当前 Foliole 扩展 ID，并从真实扩展 Service Worker 对 `127.0.0.1:11435` POST 实测成功。

## 边界

- 模型下载必须在断网前完成，扩展无法从 Chrome 沙箱自动启动或安装本机 Ollama。
- 已加载的 unpacked 扩展需重新加载；所有已打开的普通网页也必须刷新，才能从旧 content script 切换到新版本。
- 当前固定 fallback 覆盖快速翻译和深度翻译；自由对话、作文等 `llm:prompt` 流仍使用用户选择的学习与写作 Provider，不在本次翻译保障范围内。

## 验证

- `npm run lint`：通过。
- `npm test`：18 个测试文件、94 条测试通过。
- `npm run build`：TypeScript 与 Vite 生产构建通过；仍有既有 PNG 重复输出 warning。
- `npm run test:e2e`：6 条扩展 E2E 全部通过。
- 真实生产扩展：在全新浏览器 profile 中把主服务设为不存在、清空在线 fallback，再通过扩展消息 `translate:request` 翻译 `offline translation`；返回 `离线翻译`、`provider: "ollama"`、`streamed: true`。
- 当前任务文件的 `git diff --check` 通过。全仓检查仍会报告其他既有 CRLF 文件的 trailing-whitespace，未越权格式化这些无关改动。
