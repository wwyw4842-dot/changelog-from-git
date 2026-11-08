# Folio 生词与复习进度对齐

用户要求连接、生词同步，并同时统一复习算法和进度。

## 交付

- Dexie v4 增加 syncOutbox 与 syncBinding。v3 升级保留原 SM-2 状态快照。
- 词条及不可变同步事件同事务落盘，ULID 与最终请求载荷在请求前固定；失败保留事件。浏览器启动、打开生词本、手动操作和待办每分钟重试触发同步。
- 来源 URL/标题/域名在采集时保存，补同步不读取当前活动网页。
- 统一 Again / Hard / Good / Easy 四档，移除 SM-2 新排期计算；完整 FSRS 到期时间及统计由 Folio 下发，已有词条也更新。
- 离线评分标记 pendingReview，显示待同步排期，避免展示旧算法的推测时间。
- 正式版固定 8787、开发版 8788；校验生产环境、协议版本和持久词库 ID。状态读取 POST `{}` 保留 Chromium Origin，未放宽后端鉴权。
- 本机移除采用标记，后续拉取不复活，原学习事件继续保留；显式重新添加可以恢复。
- 改词身份需移除后重新添加；首次保存时间只读，以服务器最早保存事实为准。原始保存和后续重新采集使用各自实际时间。

## 验证

- 113 单元测试（21 文件）、6 Playwright 测试通过；lint clean、build success。
- 真 IndexedDB 行为使用 fake-indexeddb 验证，替换原先复制 SM-2 公式的镜像测试。
- 相邻 Folio 的 `scripts/check-foliole-sync.mjs` 验证真实浏览器扩展与源码后端、最终打包后端，覆盖离线、确认丢失重试、桌面反向更新及本机移除。
- CRLF 文件保留原换行；`git -c core.whitespace=cr-at-eol diff --check` 通过。

## 使用与边界

- 新构建在 `dist/`；更新 Folio 桌面包并重新加载扩展后使用。
- 离线可保存评分，正式排期要等待 Folio；标签与例句仍仅本地保存。不同词库停止同步，暂无重新绑定界面。
- 当前浏览器真实数据未迁移，测试全用临时数据库与新浏览器配置。
- 详见 `architecture/02-folio-sync-fsrs.md`。分支 `codex/folio-sync-alignment`；既有修改保留，未提交或推送。
