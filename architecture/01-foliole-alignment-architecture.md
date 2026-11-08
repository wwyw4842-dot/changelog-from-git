# Foliole 伴生小分叶 —— 浏览器插件生态与主应用对齐架构设计

> 本文档阐述了 Foliole（原名 Polyglot）浏览器端词汇分生叶与 Folio 雅思备考主应用的深度对齐、品牌重命名以及双向同步技术架构。

---

## 1. 品牌重构与伴生关系 (Rebrand to Foliole)

为了使外刊阅读生态与备考主应用具备统一的视觉质感和母子套件层级：
* **核心意象**：`Folio` 意为对折页/主叶，`Foliole` 意为分生小叶。象征着用户在外网阅读时将每一次词汇的采集采蜜，一秒同步回主应用的雅思备考主本中。
* **视觉标识**：
  * 主色调采用古典莫兰迪纸张质感底色（深墨 `#26241f`）。
  * 中心为带玻璃态叠层的金色分生小叶，并带有金线叶脉与柔和橙金微光的词汇微粒。
  * 提供了超清 Retina 无损渲染的矢量 SVG 格式（`public/icons/foliole-icon.svg`）。
  * 通过 macOS 图像处理引擎 `sips` 渲染生成兼容所有 Chromium 浏览器内部管理器所需的 `icon-16.png`、`icon-32.png`、`icon-48.png` 与 `icon-128.png` 标准多尺寸无损图标包。

---

## 2. 后端双向对齐与实时同步管线 (Live Sync Pipe)

```
[ 浏览器任意网页: 选词/翻译 ]
       │
       ▼ (点击加入生词本)
[ Foliole 插件 (IndexedDB) ] ───( tryPushToFolio )───► [ 本地 Sidecar (127.0.0.1:8787) ]
                                                            │
                                                            ├──► /api/v1/lookups (查词/语境记录)
                                                            └──► /api/v1/saves   (入库生词)
```

### 2.1 极速实时单向推送 (Push-on-Save)
当用户在浏览器中查词并加入生词本时，`addVocabulary` 会静默触发 `tryPushToFolio` 管线：
1. **活动 Tab URL 探测**：插件利用 Chrome Tabs API 实时截取当前处于 Active 状态的标签页：
   - 提取 `url`（源网址）
   - 提取 `pageTitle`（外刊文章标题）
   - 提取 `domain`（来源域名，如 `economist.com`）
2. **级联推送端点**：
   - 先向本地 Sidecar 发送 `POST /api/v1/lookups`。
   - 携带完整的网页环境元数据（`url`, `pageTitle`, `domain`, `context`）。
   - 若本地端点成功建立表达式（Expression），利用返回的 `expressionId` 接着发送 `POST /api/v1/saves`，将生词来源标记为 `"plugin"`。

---

## 3. 安全免鉴权与跨域机制 (Bypass Sandbox Authorization)

为了消除配置 Token 的繁琐操作，提供丝滑体验，同时确保不破坏 API 的安全防护墙：
* **Origin 过滤**：后端 FastAPI 安全中间件利用 `allow_origin_regex=r"chrome-extension://.*"` 放行了来自 Chrome 沙箱环境的跨域请求。
* **物理防伪**：因 Chrome 的 `chrome-extension://` 属于高权限系统保留字段，任何普通 Web 网页、Curl 或第三方应用均**无法通过常规欺骗手段伪造该 Origin 请求头**。
* **安全绕过**：对于检测到 `Origin` 为 `chrome-extension://` 开头的本地查词/同步请求，后端安全网关判定其为本地伴生插件发送，一律**免除 Bearer Token 验证**，实现零配置秒级同步。

---

## 4. 离线高容错设计 (Offline Fault Tolerance)

* **零阻塞用户体验**：本地 Folio 主应用未启动或 Sidecar 离线时，网络请求会在 `tryPushToFolio` 中被 `catch` 捕获并静默熔断，绝不弹窗、不阻断用户当前的查词与翻译行为。
* **本地 IndexedDB 降级存储**：所有未同步的数据依然完好地储存在插件本地的 Dexie IndexedDB 中。后续可通过增量同步机制或同步管理器完成批量的差量合并。

---

## 5. 一键双向数据同步机制 (Bidirectional Sync Flow)

当用户在离线状态（或 Sidecar 离线）下添加了大量本地生词，或者反过来，在 `Folio` 雅思主阅读器中深度阅读并标记保存了生词时，通过生词本中集成的 **一键同步** 触发完整的双向对齐逻辑：

```
[ Foliole (IndexedDB) ] ── (1) PUSH (找未同步!synced的词) ──► [ Folio SQLite ]
          ▲                                                     │
          │                                                     │
          └─── (2) PULL (拉取完整 expressions 补齐本地) ────────┘
```

1. **增量推送阶段 (Push State)**：
   - 过滤本地库中 `synced !== true` 的词条。
   - 对其依次重放 `tryPushToFolio` 的级联写入。
   - 写入成功的词条，在 IndexedDB 中将状态更新为 `synced: true`，不重复补推。
2. **云端拉取阶段 (Pull State)**：
   - 调用 `GET /api/v1/expressions` 获取主应用所有保存的生词。
   - 对比本地数据库中 `word` 是否已存在（大小写不敏感匹配）。
   - 若本地缺漏，自动同步拉取回本地，充实插件侧的高光划词检索库及离线词典缓存，并将新词标志设为 `synced: true`。
3. **极佳的可视化交互**：
   - 提供优雅流畅的同步进行中动画（显示“同步中…”）。
   - 结束后弹出温润自然的莫兰迪软奶油色反馈条，详细显示补推、补拉的词汇详情。若离线，则予以用户详尽友善的指引提示。

---

## 6. Sidepanel 信息优先级与语境闭环

Foliole 侧栏以用户最频繁的阅读闭环为一级信息架构：

1. `当前结果`：显示真实划词、译文、原句语境、语言方向、翻译服务和时间，并直接提供复制、朗读、加入生词本、深度解读和换服务重试。
2. `生词本`：继续承载本地 IndexedDB、复习、Folio 同步、编辑与导出能力。
3. `最近记录`：保留翻译历史及其页面语境，搜索和导出作为折叠的次级工具。

学习概览、口语陪练、复习文章、写作和 AI 追问不删除，统一收进 `更多`。当前入口使用 `foliole-sidepanel-tab` 写入 `localStorage`，在侧栏重开后恢复；IELTS 专属入口仍受设置状态约束。

### 6.1 真实语境数据

网页划词时由 content script 从当前段落截取最长 320 字符的上下文，并随 `TranslationRequest.context` 发送。后台将该字段同时写入：

- `chrome.storage.local.latestSidePanelResult`，供当前结果卡立即显示；
- `HistoryEntry.context`，供后续记录检索和回看。

`context` 为可选字段，因此旧 IndexedDB 记录无需迁移。没有真实语境时，界面不以选中词伪造引用。

### 6.2 视觉与状态约束

- Sidepanel 专属样式放在 `src/sidepanel/sidepanel.css`，复用项目既有 paper / ink / coral token，并保留暗色模式。
- 一级操作至少 44px；键盘 Tab 支持左右方向键、Home 和 End；所有新增交互有 `focus-visible` 与 reduced-motion 降级。
- 顶栏只显示插件是否完成初始化的“可以使用”，不冒充 Folio 或翻译服务在线状态。
- 生词同步状态依据真实 `VocabularyEntry.synced` 呈现为“等待添加 / 有内容待同步 / 已同步”。
- 网页生词高亮使用珊瑚下划线、琥珀 hover 和暖纸 tooltip，与 Sidepanel 保持一致，不注入原型中的假文章或浏览器外框。

### 6.3 扩展页面入口与导航契约

工具栏 Popup 与 Options 使用同一套 paper / ink / coral / sage 语义色和真实 Foliole 图标。Popup 首屏把“打开学习侧栏”作为主操作，并为 `当前结果`、`生词本`、`最近记录` 提供直接入口；入口在打开前写入 `foliole-sidepanel-tab`，因此 Sidepanel 会落到用户选择的一级页面。

网页翻译气泡通过独立的 `sidepanel:open` 消息立即请求打开当前标签页的侧栏，不再为了打开侧栏重复发起翻译。快捷键携带 `openSidePanel` 时也先打开侧栏，再继续翻译并更新 `latestSidePanelResult`，避免网络延迟或翻译失败阻断入口。

Options 只负责设置展示与保存，不复制学习数据；顶部提供返回学习侧栏的主入口。设置分区保留全部底层 setting key 与 Provider ID，但界面按用户用途表述为翻译习惯、翻译服务、快捷键、功能与数据。

---

## 7. 本地 Qwen 最终翻译保障

快速翻译和深度翻译共用 `runTranslation`，其 Provider 链遵循以下约束：

```text
主服务 → 用户配置的在线备用服务（去重）→ Ollama / qwen2.5:0.5b
```

- `ollama` 由代码固定追加到链尾；旧设置中没有该 ID、或用户在输入框中删除/提前填写它，都不会取消最终本地保障。用户主动把 Ollama 选为主服务时不重复追加。
- 在线快速翻译单次最多等待 5 秒，在线深度翻译最多等待 20 秒，本地模型冷启动最多等待 60 秒。单个服务超时会继续下一项；用户主动取消或流端口断开则立即结束，不再启动本地模型。
- Ollama 默认连接 `http://127.0.0.1:11434`，并在未显式配置地址时自动探测本机备用端口 `11435`；探测结果缓存 5 分钟。默认模型为约 397 MB 的 `qwen2.5:0.5b`。模型必须在有网络时预先下载，离线时本机 Ollama 服务仍需保持运行。
- Ollama 的显式地址和模型设置仍优先于默认值；空流、模型未安装和 daemon 未启动分别提供可操作错误，不把底层 `Failed to fetch` 直接暴露给用户。
- Provider 返回空译文不会写入缓存，而是继续回退。实际成功的 Provider ID 随结果写入历史，侧栏能够辨认本次是否由 `ollama` 完成。

扩展 reload 或自动更新属于另一条故障边界：已经打开的网页仍可能保留失效的旧 content script，请求此时尚未进入后台 Provider 链。消息层会把 `chrome.runtime.sendMessage/connect` 失效统一转为“扩展已更新，请刷新本页后再翻译”，用户刷新宿主网页后才能重新注入脚本并使用在线或本地翻译。
