# Folio 生词与复习同步（2026-10-28）

本说明更新 `01-foliole-alignment-architecture.md` 的同步实现描述。旧文档中的两步 lookup/save 推送、仅补齐缺词与插件 SM-2，不再是当前同步协议。

## 数据与排期

- Folio SQLite 保存学习事实并用 FSRS-6 计算排期；插件 IndexedDB 保存可离线使用的词条、权威排期快照和待同步事件。
- 插件评分统一为 Again（忘记）、Hard（吃力想起）、Good（正常想起）、Easy（轻松想起）。揭示答案本身不写评分。
- 本地词条和待同步事件先原子落盘，保存操作不等网络。断开 Folio 时仍可记录复习，显示“待同步排期”；连接后取得完整 UTC 到期时间、复习次数及遗忘次数。
- 原 SM-2 状态保留为历史快照，不把旧累计次数伪造成 FSRS 评分历史。
- 插件侧移除词条只隐藏本地条目，防止拉取时恢复，桌面端历史仍保留。

## 连接与协议

- 正式 Folio：`http://127.0.0.1:8787`；开发版：`8788`。插件默认正式版，不自动退回开发库。
- 显式扩展配对（2026-11-08）：用户在 Folio「扉页 → 数据 → Foliole 浏览器插件」粘贴当前扩展 ID 生成 `foliole1.<extensionId>.<token>` 配对码，填入 Foliole 设置页「功能与数据」或学习侧栏生词本完成绑定；令牌经 `settings.credentials.folio` AES-GCM 加密存储，并在所有 `/api/v1/sync/*` 请求附带 `Authorization: Bearer <token>`。
- 插件通过 `POST /api/v1/sync/state`（JSON `{}`，只读）获取协议版本、数据库标识、运行环境、FSRS 设置与所有已保存词条的排期；POST 使 Chromium 携带扩展 `Origin` 与配对 `Bearer` 令牌完成双向校验。配对状态下后台每分钟及启动/收藏/评分时自动双向同步。
- `POST /api/v1/sync/vocabulary` 上传原始保存时间、词条、释义、音标及原网页语境，无网页 URL 时也可保存。
- `POST /api/v1/sync/reviews` 上传四档评分和实际发生时间；晚到事件按时间顺序合并。
- 同步写入携带 `libraryId`；已绑定另一数据库时报告错误，不静默换库。
- 稳定事件 ID 和请求载荷先持久化，再发送；只有确认成功才清除事件。部分失败显示未完成，重试不重复计数。
- 每次推送后拉取最新状态，同时更新已存在词条的排期。同步保留仍未上传的本地变更。

完整字段契约保存在相邻 Folio 项目的 `architecture/foliole-sync-contract.md`。

## 验证入口

- `npm test`：存储、队列、重试和界面回归。
- `npm run lint`、`npm run build`、`npm run test:e2e`。
- 在 Folio 项目运行 `node scripts/check-foliole-sync.mjs`：真实扩展、真实 Python 后端、临时数据库与独立浏览器配置，覆盖离线保存、确认丢失重试、桌面评分回传和本地移除。

代码更新后需构建并更新两端。旧版 Folio 或仍占用 8787 的旧开发服务不能作为新版同步目标。
