# 2026-08-20 — Foliole UI 优先级原型落地

## 目标

将 Open Design 的 `foliole-ui-priority` 原型落到真实浏览器扩展，重点实现右侧学习面板，而不照搬演示用浏览器外框、假文章和种子数据。

## 已完成

- Sidepanel 一级导航调整为“当前结果 / 生词本 / 最近记录”，学习概览及其他低频能力移入“更多”，功能未删除。
- 当前结果改为单卡优先，接通复制、TTS、加入生词本、按需深度解读、换翻译服务重试、跳转记录和生词本。
- 划词时捕获真实段落语境，并写入最新结果与新历史记录；旧记录保持兼容。
- 生词本增加可信的同步状态文案；历史搜索、导出、清空收为次级工具，清空前增加不可撤销确认。
- 新增 Sidepanel 专属样式，使用 Foliole 真实图标、暖纸/珊瑚/鼠尾草语义色、44px 主操作、键盘方向键导航、焦点态和 reduced-motion。
- 网页生词高亮从蓝色调整为珊瑚下划线、琥珀 hover 与暖纸 tooltip；划词气泡品牌名同步为 Foliole。
- 新增 `latest-utils` 单测和 Sidepanel 扩展 E2E；修正 Options E2E 的旧品牌断言。
- 工具栏 Popup 与 Options 继续使用同一套 Foliole 视觉；Popup 首屏突出学习侧栏，并直达当前结果、生词本和最近记录；Options 改为用途导向的设置分区，并提供返回学习侧栏的入口。
- 网页气泡的侧栏入口从无文字箭头改为可见主操作；新增 `sidepanel:open` 消息，打开侧栏不再重复翻译或等待 Provider 返回。
- 修复 Sidepanel Toast 的 fixed 定位、320px 历史筛选溢出和浅/深色主按钮对比度。

## 验证

- `npm test`：15 个文件、68 条测试通过。
- `npm run build`：TypeScript 与 Vite 生产构建通过；仍有既有 PNG 重复输出警告。
- `npm run lint`：通过，无 warning。
- `npm run test:e2e`：6 条全部通过（Bubble、Options ×2、Popup ×2、Sidepanel）。

Sidepanel E2E 在 Service Worker 内拦截 `fetch`，不会调用真实翻译 Provider 或本地 Folio Sidecar。

## 交付提醒

- 已加载的 unpacked 扩展需要在 `chrome://extensions` 点击一次“重新加载”，再刷新正在测试的普通网页。
- 真实网页的段落结构各不相同，仍需留意截取的 320 字符以内语境是否自然。
- 深度解读与换服务重试需要用户已配置相应 Provider，自动化测试没有使用真实密钥或外部请求。
