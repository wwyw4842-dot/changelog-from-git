# Polyglot.io 修改日志

本文档依据项目对话与迭代记录整理，覆盖从「极简划词翻译」到 **Polyglot 语言助手** 的主要变更与问题修复。

---

## [未发布] 近期累积变更

### 架构与工程

- 使用 **Vite + TypeScript + React + Tailwind** 完整重构扩展；**Manifest V3** + **@crxjs/vite-plugin**。
- 接入 **ESLint、Prettier、Vitest**；路径别名 `@`、`@shared`、`@providers`。
- **Dexie (IndexedDB)**：历史、生词本、学习活动；**WebCrypto AES-GCM** 加密本地 API 密钥。
- 类型化消息总线 **`MessageRouter` / `send`**；后台 **`llm:prompt`** 与 **`translate:stream`** 端口流式输出。

### 翻译与引擎

- 多引擎：**Google、Bing、MyMemory、DeepL、Volcano**；LLM：**OpenAI、Claude、Gemini、Ollama**。
- **DeepSeek**：`deepseek`（Chat）与 `deepseek-reason`（Reasoner）；OpenAI 兼容 `/chat/completions`；`streamChat` 支持两档。
- **`deepseek-reason` 凭据默认合并自 `deepseek`**（`mergeLlmCredentials`），避免重复填 Key。
- 设置项：**深度解读引擎**、**高级/推理（llmProProvider）**、**生词例句引擎（vocabExampleProvider）**；`llm:prompt` 默认走 `llmProProvider`。
- **`provider:test`**：对流式 LLM 真实消费流直至有足够输出，避免「假通过」。
- MyMemory 中文分块拼接等与早期 bug 相关修复保留在代码库中。

### 划词与气泡

- 气泡 **Shadow DOM + React**；**可滚动**长文；译文/原文展示顺序优化；**Escape** 关闭。
- 选词上下文捕获（段落级）用于生词本；**IELTS 模式**下深度解读 prompt 增强（同义、等级、学术例句等）。
- **扩展上下文失效**：`Extension context invalidated` 等映射为中文说明；`connect`/`postMessage`/端口断开处理；**重试**区分快速与深度翻译。
- 气泡底部新增 **“本页白名单”滑块开关**：开启时复制当前页面完整 URL 并加入白名单，后续该页面不再显示翻译气泡；支持再次关闭恢复。
- 白名单规则扩展为 **域名整站 + 完整 URL 单页** 双模式；并在划词触发、快速翻译、深度翻译、OCR 入口统一校验。

### 生词本与学习

- 按日期分组、**可改添加日期**、详情编辑（上下文、标签等）；**SM-2** 复习与多级评分按钮。
- **例句**：`examples[]`（英/中）；加入后后台异步 LLM 补全；**重生成例句**（`vocabulary:examples:regen`）。
- **按日生词生成复习短文**（流式 LLM）。
- 复习短文结果新增 **“保存”** 操作，支持将生成内容持久化到 IndexedDB（`reviewArticles` 表）。
- 侧栏新增 **“复习文章”** 独立栏目：集中查看已保存文章，显示生成时间/模型/词汇，并支持复制与删除。
- **网页生词高亮**（可开关）；高级设置 **CSV/TSV（Anki）** 导出含例句列。

### 沉浸式与其他内容能力

- **沉浸式整页翻译**（IntersectionObserver）；**PDF** 文本层钩子；**Tesseract OCR**（图片）。
- **输入框增强**（润色、纠错、翻译等）；与扩展重载断开时尽量恢复原文字。

### 侧栏与雅思

- **仪表盘**：每日查询、生词、复习、连续天数、近 7 日统计。
- **口语陪练**：含雅思 Part 1/2/3；**写作批改**（IELTS 模式开启时显示 Tab）。
- **写作分析**：独立 Tab；**高分作文多维建模 v1**（八维度：任务契合、论点链、宏观结构、衔接、词汇、语法、文体修辞、规范呈现）+ 固定 Markdown 报告结构 + 流式分析。

### 设置与国际化

- 通用：**IELTS 模式、目标分数**；引擎页 DeepSeek 配置与多下拉调度说明。
- API Key 输入框改为 **明文**（按用户要求取消 password 隐藏）。
- i18n：**写作分析**等 Tab 文案（中/英词典条目）。
- Popup 新增 **键盘快捷方式卡片**（读取 `chrome.commands.getAll()`），显示当前实际绑定按键并提示 `chrome://extensions/shortcuts`。
- Popup 新增 **当前站点白名单开关**：支持 **整站 / 仅此页** 两种模式切换，滑块状态与命中来源同步显示。
- 输入框增强新增设置 **`inputEnhanceAutoExpandToolbar`**（默认关闭）；聚焦输入框默认仅显示 `✨ 快捷`，点击后再展开操作。

### 交互与 UI 连续优化（新增）

- Popup 状态拆分为 **翻译状态** 与 **白名单状态**，避免操作互相覆盖；白名单切换加入 busy 禁用、失败重试、状态自动淡出。
- 输入框增强工具条支持 **滚动/缩放重定位**、离屏自动隐藏（`IntersectionObserver` + rAF 节流），并在设置变更时即时重绘。
- 输入框增强动作新增 **5 秒撤销**（润色/纠错后可恢复原文）。
- Sidepanel 与 Options 引入语义样式常量（`optionUi` / `sideUi`），持续替换重复 class，统一卡片、按钮、输入框层级。
- Sidepanel 多页文案统一中文语气（如 `引擎：`、`生成中...`、`暂无...` 空态）。
- Sidepanel 继续完成按钮层级收敛：`primary/subtle/danger/ghost` 覆盖 Practice/Chat/Writing/History/Vocabulary/ReviewArticles，并统一 `Vocabulary` 详情区输入控件样式。
- Vocabulary 继续去散样式：`ReviewCard` 六档评分按钮与 `ComposeResult` 顶部“保存”动作改为复用 `sideUi` 语义类（`reviewGrade*`、`ghostBrandButton`），便于后续统一调整视觉层级。
- Vocabulary 页面继续收口：顶部 mode 切换（按日期/待复习/复习模式）与“生成复习文章”按钮改为复用 `sideUi`（`modeTab*`、`tinyPrimaryButton`），减少页面内联 Tailwind 分支。
- Vocabulary 细节样式再收敛：日期数量徽章、标签 chip、详情行容器与标签、例句小标题全部改为 `sideUi` 语义类（`badgeNeutral/tagChip/detail*/sectionLabel`），降低组件内视觉 token 分散度。
- Vocabulary 阅读态样式继续语义化：词条标题/音标/小字说明与例句项容器统一复用 `sideUi`（`bodyTitle/bodySubtle/bodyText/bodyMuted/exampleItem*`），进一步减少文本层级样式重复。
- Vocabulary 布局层也完成语义收口：分组区块头、词条头、详情面板与操作栏统一改为 `sideUi` 布局类（`group*`、`itemHeader*`、`itemDetailPanel`、`itemActionsBar`），页面结构样式不再散落在组件内部。
- Vocabulary 末尾零散文本样式收口：分组日期标题、复习进度/答案/上下文、错误提示与文章正文滚动区改为 `sideUi` 语义类（`groupDayLabel/review*/dangerText/prosePanel`），页面剩余硬编码视觉类进一步减少。
- Vocabulary 最后一批原子类继续抽离：`line-clamp` 摘要、日期编辑触发、括号副文案、详情栈/标签容器、复习卡标题与评分区、复习文章头部操作区统一迁移到 `sideUi`，页面样式基本完成语义化收口。
- WritingAnalysis 开始语义化收口：卡片容器、体裁按钮、输入区、报告头/错误态/正文滚动区改为复用 `sideUi`（含 `prosePanelTall/helperText/introText`），与 Writing/Vocabulary 视觉层级保持一致。
- WritingAnalysis 第二轮收口：补齐 header/tabs/label/action 行语义类（`panelHeader/tabsRow/labelRow/actionRow/actionButtons`），页面仅保留必要状态类，结构样式进一步统一。
- WritingAnalysis 完成页面级闭环：根容器间距 `space-y-3` 迁移为 `sideUi.pageStack`，至此该页通用结构/控件样式已基本全部语义化。
- Writing 页面开始复用页面级语义类：题型头、tab 行、正文标签行、操作行、报告头/错误态/长文滚动区统一改为 `sideUi`（`pageStack/composeHeader/groupDayLabel/modeTab*/labelRow/actionRow/composeTitle/dangerText/prosePanelTall`）。
- Writing 收口补完：目标 Band 徽章与字数状态颜色改为 `sideUi` 语义类（`targetBadge/statusText/statusGood/statusWarn`），减少页面中最后一处硬编码视觉 token。
- History / ReviewArticles 继续语义化：列表页根间距、分组标题、卡片头尾行、正文文本、加载态与文章元信息统一复用 `sideUi`（`pageStack/dayGroupTitle/card*Row/body*/metaText/loadingText`），跨页面样式复用进一步提升。
- History 小尾巴收口：移除 `metaText + ...` 拼接写法，统计行改为单一语义类 `historySummaryRow`，保证列表页样式调用一致且可检索。
- Latest / Practice 小步收口：`Latest` 页面根容器、底部元信息行、点分隔符与音标提示统一复用 `sideUi`（`pageStack/latestMetaRow/inlineMetaGroup/dotDivider/phoneticHint`）；`Practice` 顶部 IELTS 徽章复用 `targetBadge`。
- Practice 结构类继续收敛：页面壳层、顶栏行、分组标题、消息头与输入按钮列改为 `sideUi`（`practiceShell/practiceTopRow/practiceGroup*/cardTopRow/practiceInputActions`），减少页内重复布局类。
- Practice 小号文本与容器继续语义化：生词选择区容器/标题/列表、场景 tab 容器、顶部提示文案、对话正文文本、输入区组合容器统一迁移到 `sideUi`（`practiceHeaderHint/practiceVocab*/practiceScenarioTabs/practiceTip/practiceMessageText/practiceComposer`）。
- Practice 状态分支样式收口：场景按钮 active/idle、生词“使用最近 40 个”active/idle、生词 chip active/idle 改为 `sideUi` 语义状态类（`practiceScenario*/practiceUseAll*/practiceVocabChip*`），页面状态样式不再内联硬编码。
- Practice 最后一轮收口：头卡、场景标签、对话面板与 user/AI 气泡分支、输入区发送/停止/重置按钮全部迁移到 `sideUi`（`practiceHeaderCard/practiceScenarioLabel/practiceChatPanel/practiceTurn*/practice*Button`），页面主路径样式实现语义化闭环。
- Latest 组件分支样式收口：`Card/Value` 的 tone/highlight/error/large 状态以及空态卡片、pill、标题行改为 `sideUi` 语义类（`latestCard*/latestPill*/latestValue*`），去除组件内部 Tailwind 状态拼接。
- Chat 页面样式收口：上下文卡片、会话列表、user/assistant 气泡分支、元信息、输入区与发送/停止按钮统一迁移到 `sideUi`（`chat*`），移除页面内联分支样式。
- Dashboard 样式收口：主卡、头部、三指标网格、近 7 天柱状图区、metric tone 分支、连续打卡徽章分支统一迁移到 `sideUi`（`dashboard*/streak*`），`sidepanel/pages` 仅剩极少量可选细节可继续优化。
- 收尾扫描后继续清理 `Vocabulary`：页面主 stack、模式行、分组大间距、例句小间距、分组列表与 `Badge` 基类迁移到 `sideUi`（`pageStack/vocabModeRow/stackLg/stackTight/detailsStack/badgeBase`），进一步减少硬编码 class。
- 模板拼接类再收敛：`Writing/WritingAnalysis` 的 `card+p-3`、`inputMono+尺寸`、`subtleButton+文本色` 组合统一升级为单一语义类（`panelCard/blockGroupLabel/inputMono* / subtleButtonMuted*`），降低模板字符串 class 拼接数量。
- 模板拼接类继续收口：`Chat/Practice/History` 中空态卡、输入框组合、Practice 开始按钮与 History 条目卡片迁移为单一 `sideUi` 语义类（`chatEmptyCard/chatComposerInputField/practiceEmptyCard/practiceStartButton/practiceComposerInputField/historyItemCard`）。
- 收尾清理（第三轮）：`History/Vocabulary` 中可静态化组合类进一步改为单一语义类（如 `inputFlex1/bodySubtleClamp/inputInlineFull/subtleButtonMini*/dangerButtonMini/reviewRevealButton/accentCardCompact`），将模板字符串拼接压缩到仅剩必要动态分支。
- 收尾清理（第四轮）：继续压缩动态模板拼接，`WritingAnalysis` 的模式按钮改为 `modeTab*Button`，`Dashboard` metric 改为完整 tone 卡片类，`Vocabulary` 评分按钮改为完整 `reviewGrade*Button`，并将 `Badge` 基类并入 `dueColor` 返回值。
- 收尾清理（第五轮）：`OptionsApp` 头部与导航的容器/品牌/保存态/导航激活态改为静态语义类（`UI.headerInner/brand*/saveStatus*/navItem*Button`），移除页面内模板字符串 class 组合，便于后续统一调整设置页外观。
- 收尾清理（第六轮）：`PopupApp` 主壳层、标题区、输入/结果卡、白名单模式切换、iOS 开关 busy/active 分支、快捷键列表与底栏全部迁移为静态语义类（`UI.*`），去除 `className={\`...\`}` 模板拼接并统一弹窗样式入口。
- 收尾清理（第七轮）：`options/sections` 扩展 `optionUi` 语义类（`pageStack/cardBody/fieldRow/inputW24/inputMax320/inputW80/inputH88/...`），并将 `General/Providers/Shortcuts` 的尺寸组合类与模板拼接迁移为静态类调用，进一步降低设置页样式散点。
- 稳定性修复（第八轮）：修复 `HistoryTab` 与 `PracticeTab` 的 `react-hooks/exhaustive-deps` 警告；将 `History` 的 `refresh` 包装为 `useCallback` 并由 effect 依赖该回调，补齐 `Practice` IELTS 自动场景切换 effect 的 `scenario` 依赖，确保 Hook 依赖关系完整且行为不变。
- 收尾清理（第九轮）：继续清理 `options/sections` 与 `SidePanelApp` 的硬编码布局类；新增 `optionUi` 结构类（`sectionBody/cardsStack/rowBetween/toggleRow/...`）并替换 `Advanced/Providers` 剩余样式散点，同时将 `SidePanelApp` 顶栏与 Tab 激活态改为静态 `UI.*Button` 分支，进一步统一样式入口。
- 收尾清理（第十轮）：完成 `Bubble` 组件样式收口；将气泡头部、正文、详情区、底栏、白名单开关、工具按钮以及 `Row/IconBtn/ActionBtn` 的状态样式迁移到单一 `UI` 语义常量与状态函数，移除组件内部零散 class 与模板拼接。
- 收尾清理（第十一轮）：精简 `Bubble` 中 `Row` 的状态样式分支优先级，移除冲突组合类（如同一规则内重复字号/透明度），改为“错误色优先、字号次优先、弱化最后覆盖”的稳定映射，降低后续维护歧义。
- 体验微调（第十二轮）：统一 `Popup` 提示反馈节奏，抽离复制提示/白名单状态自动淡出的时长常量（`TOAST_MS_SUCCESS/TOAST_MS_ERROR/SITE_STATUS_MS`）并封装 `scheduleCopyToastClear`，减少重复计时逻辑，便于后续统一调参。
- 体验微调（第十三轮）：统一 `Sidepanel` 状态文案节奏，新增 `sideUi` 状态/动作文案常量（`stateStreaming/stateFailed/stateDone/actionSaving/actionSaved/actionSave`），并替换 `Chat/Practice/Writing/WritingAnalysis/Vocabulary` 中“生成中/失败/完成/保存”相关展示，消除 `...` 与 `…` 混用。
- 体验微调（第十四轮）：新增共享文案字典 `src/shared/ui-text.ts`，将 `Popup` 与 `Bubble` 的状态提示（翻译中、已更新、已复制、复制失败等）接入统一文本源，减少跨模块硬编码并为后续全局文案调整提供单点入口。
- 视觉升级（第十五轮）：Sidepanel 整体改版为「现代精致」深色风格，所有改动集中在 Token 层与 Shell 层，全部 8 个 Tab 自动同步。
  - `src/shared/theme.css`：`body.poly-sidepanel` 新增多层径向渐变背景（蓝青光晕 + 深空蓝过渡）；字体栈补充 Segoe UI Variable / Inter / PingFang SC，启用 `font-feature-settings: "ss01","cv11"`；滚动条改为细线 + 渐变 + 悬停高亮（Firefox `scrollbar-color` 与 WebKit 同步）；新增全局过渡基线、`::selection` 蓝色高亮、`poly-fade-in` 入场动画与 `.poly-tab-indicator` 激活下划线条。
  - `src/sidepanel/sidepanel.html`：body 切换到 `.poly-sidepanel .antialiased`，启用新的主题底。
  - `src/sidepanel/App.tsx`：Header 改为 sticky + `backdrop-blur-xl`，左侧加渐变 logo mark（brand→cyan 方块 + 阴影），标题用 `bg-clip-text` 做银白渐变，副标题改 `tracking-[0.18em]` caps；右侧改为绿点 + Online 状态指示。Tabs 栏改 sticky + 横向滚动，激活态用 `ring-1 ring-inset ring-brand/40` + 蓝色微光阴影 + 底部 2px 渐变指示条，化解 8 Tab 拥挤问题；`<main key={active}>` 触发切换淡入动画。
  - `src/sidepanel/pages/ui.ts`：保留全部 215 个 token key 名不变，整体升级值——卡片统一 `rounded-2xl` + `border-slate-800/60` + `bg-slate-900/50` + `backdrop-blur-sm` + 柔阴影 + hover 渐亮；主按钮升级为 brand 渐变 + 蓝光阴影 + `active:scale-[0.98]`；输入框改 `rounded-lg` + 双层 focus（border + ring）；复习评级 6 档加 inset ring + hover 微抬升；Dashboard 图表柱体改 brand→cyan 渐变 + hover 发光；聊天气泡用户态改 brand 半透明渐变；空状态统一虚线边框 + 居中文案；streak 徽章用 amber→orange 暖光阴影；排版统一 `tracking-[0.12em]/0.14em/0.18em` 三档字距。
  - 校验：`tsc --noEmit` 通过；Vite transform 190 modules 全部成功（最终 `closeBundle` 的 `tesseract.js` 资源拷贝报错与本次 UI 改动无关，属于既有 OCR 资源依赖问题）。
- 视觉重做（第十六轮）：用户改选「莫兰迪柔光（Morandi Soft Cream）」方向，把上一轮的深色精致与中间尝试过的「流光全息」全部推翻，Sidepanel + Bubble + Popup 三处主 UI 切到统一的浅色暖意语言。
  - `tailwind.config.ts`：主品牌 `brand` 从蓝/靛色重定义为珊瑚红（50→900 全段值，`DEFAULT=#b85f50`）；新增 `cream`（50→600，米奶基底）、`ink`（50→900，暖灰文字）、`sage` 与 `dusty.gold/plum` 辅色；阴影体系换为 `soft / softer / lifted / coral / paper`（柔暖偏 RGBA(120,90,80) 阴影 + 珊瑚发光）；新增 `fontFamily.serif`（Source Serif Pro / 思源宋体 / Songti SC 回退栈）；keyframe 加入 `ink-spread`、`letter-reveal`、`soft-float`、`breathe`、`fade-up`，并提供 `animate-fade-up` 工具类用于 toast 与卡片入场。
  - `src/shared/theme.css`：换回 light color-scheme；CSS token 改为 `--paper-{50,100,200,300}` + `--coral-{300,500,600}` + `--ink-*`；`body.poly-sidepanel` 用多层径向渐变（珊瑚 + 金 + 烟紫）叠加米奶基底 + 极淡纸纹（mask 渐隐边缘）；新增 `.poly-serif` 衬线字体类、`.poly-ink-underline` 墨水扩散下划线（用于激活 Tab）、`.poly-spring` 抬升动效、`.poly-spotlight` 光标追随暖光、`.poly-letter-reveal` 衬线大字逐字 reveal、`.poly-stagger` 子项序列入场、`.poly-pulse-dot` 在线呼吸、`.poly-accent-rule` 左侧珊瑚色 3px 装饰条；全局过渡基线统一 `cubic-bezier(0.34,1.56,0.64,1)` spring 曲线；保留 `prefers-reduced-motion` 兼容。
  - `src/content/bubble/bubble.css`：Shadow DOM 内同步切到米奶配色，`.poly-trigger-base` 触发按钮改珊瑚字 + 珊瑚边 + 珊瑚发光阴影；`.poly-bubble-base` 改 16px 圆角 + 三层暖阴影 + spring 入场动画；新增 `.poly-brand-dot` 立体小珊瑚珠（径向渐变 + inset 双向阴影 + 外光晕）；新增 `.poly-serif` 在 Shadow DOM 内可用；滚动条/选区/聚焦环全部换珊瑚色基调；保留暗色 media query 适配。
  - `src/sidepanel/App.tsx`：Header 左侧加圆形珊瑚渐变 P 字 mark + 衬线 Polyglot 标题（带 `poly-letter-reveal` 入场）；右侧改 sage 绿呼吸点 + Online；Tabs 用衬线字 + `poly-ink-underline` 激活态（墨水扩散 spring scaleX），悬停滑出柔光胶囊背景，鼠标离开回到当前激活项，化解 8 Tab 拥挤问题；切换 Tab 时 `<main key={active}>` 触发淡入。
  - `src/sidepanel/pages/ui.ts`：保留 215 个 token key 名不变，全体迁到莫兰迪体系——卡片统一 `bg-cream-100 + border-cream-300/80 + shadow-soft + poly-spring` hover 抬升；主按钮 `from-brand-400 to-brand-600 + shadow-coral`；输入框换 `border-cream-300 + bg-cream-50 + ring-brand-200/60` 双层 focus；衬线类 `poly-serif` 应用于所有标题/正文展示位（`bodyTitle / sectionLabel / groupDayLabel / dashboardTitle / reviewWord / dayTitleBrand / prosePanel`）；评级 6 档与状态色保留语义（rose/orange/amber/emerald），但全部抹掉霓虹与深色，统一柔色 + ring inset；Dashboard 图表柱用珊瑚渐变 + hover 珊瑚光；streak 徽章珊瑚渐变 + 珊瑚光；`accentCard / accentCardCompact / latestCardHighlight` 改为左侧 3px 珊瑚色 accent rule + 卡片柔阴影抬升。
  - `src/content/bubble/Bubble.tsx`：UI 常量整体换珊瑚 + 米奶 + 衬线；译文用 `poly-serif` + 15px + ink-900 强化阅读层级；同义替换 chip / 解读 / 词性等小标题用衬线 caps + 珊瑚 600；底部「深度」主按钮换珊瑚三段渐变 + 珊瑚发光阴影；白名单 switch 换珊瑚渐变；图标按钮 active 用珊瑚 50 + ring 珊瑚 200。
  - `src/popup/App.tsx`：Header 沿用珊瑚 P mark + 衬线 + 副标 caps；结果文本改衬线 15px 提升阅读感；复制 toast 改珊瑚渐变胶囊 + `animate-fade-up` 入场；白名单 switch 换珊瑚渐变 + 珊瑚光；模式 tab 段落改 cream/brand 双色；按钮全部统一 `border-cream-300 + hover:border-brand-300 + active:scale-95`。
  - `src/sidepanel/pages/Dashboard.tsx`：保留上一轮加入的 `useSpotlight` + `useOdometer`，主卡新增 `poly-spotlight` 类让光标追随时柔光跟随；图表柱体走品牌珊瑚渐变 + hover `shadow-coral`。
  - 校验：`tsc --noEmit` 通过（EXIT=0，无报错）；视觉所有改动集中在 token / theme / 三处 UI 常量，没有动业务逻辑。
- 视觉补完（第十七轮）：补上一轮遗漏的 Options 设置页，使 Sidepanel + Bubble + Popup + Options 四处主 UI 视觉完全统一到「莫兰迪柔光」。
  - `src/options/options.html`：body 加 `poly-options .antialiased` 类。
  - `src/shared/theme.css`：新增 `body.poly-options` 背景层（米奶基底 + 多层径向暖光 + 极淡纸纹 + mask 渐隐边缘 + `background-attachment: fixed`）。
  - `src/options/App.tsx`：UI 常量重写——外壳从深色 slate 切到透明壳承接 body 背景；Header sticky + `bg-cream-100/80 backdrop-blur-xl`，加圆形珊瑚渐变 P mark + 衬线 Polyglot 大标题 + `poly-letter-reveal` 入场 + 副标 caps；保存状态徽章改胶囊（emerald-50/700 与 cream-200/ink-500 两态），切换时 `key={savedAt}` 触发 `poly-fade-up` 反馈"已落盘"；导航按钮改衬线 + 激活态 ring-brand-200 胶囊 + spring；`<section key={active}>` + `poly-stagger` 让 section 切换时内部卡片错位入场。
  - `src/options/sections/ui.ts`：32 个 `optionUi` key **全部保留名字**，值整体迁到莫兰迪：卡片 `bg-cream-100 + border-cream-300/80 + shadow-soft + poly-spring`；5 个 input 尺寸变体共用 `baseInput`（`border-cream-300 + bg-cream-50 + ring-brand-200/60` 双层 focus）；`subtleButton/Sm/Mt` 三档统一 `border-cream-300 → hover:border-brand-300 + hover:bg-brand-50`、`active:scale-[0.97]`；toggleRow 加 hover 珊瑚色渐显；cardTitle/cardTitleStrong 用 `poly-serif`；kbd 改暖色键帽；cardStatusSuccess 改胶囊。
  - 校验：`tsc --noEmit` 通过（EXIT=0）；grep 验证 4 个 section 组件引用的 32 个 key 与新 ui.ts 完全一对一对齐，section 文件无需任何改动自动同步新视觉。
- 动效与微件 polish（第十八轮）：在不动信息结构的前提下，给关键交互加细节动效，并把 Bubble 内的 emoji 全部换成内联 SVG。
  - `src/shared/useTilt.ts`：**新建** `useTilt<T>(options)` hook，监听 mousemove 把鼠标位置归一化乘以 max 角度（默认 2.5°），写入 CSS 变量 `--tilt-x/-y` 由 transform 驱动；rAF 节流避免 React 重渲染；离开归零。可与 `useSpotlight` / `useOdometer` 完全正交叠加。
  - `src/shared/theme.css`：新增 5 个工具类——`.poly-tilt-host`（perspective + rotateX/Y + 弹簧 cubic-bezier）、`.poly-focus-glow:focus-within`（输入框包装柔珊瑚光晕）、`.poly-input-glow:focus`（自身聚焦柔光）、`.poly-toast-pop`（spring 弹跳 0.55→1.08→1）、`.poly-skeleton`（shimmer 占位）；`.poly-pulse-dot` 呼吸 1.8s→2.2s、振幅 2.2→2.0、opacity 0.4→0.35，更不刺眼；`prefers-reduced-motion` 下 `.poly-tilt-host` 强制 `transform: none`。
  - `src/content/bubble/Bubble.tsx`：Bubble 3 个 emoji 全部换内联 SVG 线性图标——`📌`→`PinIcon`、`✕`→`CloseIcon`、`→`→`ArrowRightIcon`，全部 13×13、currentColor 描边、跟随 IconBtn 主题色，避免不同 OS / 浏览器 emoji 字体不一致。
  - `src/sidepanel/pages/Dashboard.tsx`：引入 `useTilt`，主卡同时 `poly-spotlight + poly-tilt-host`（max 2°）双层光感。
  - `src/sidepanel/pages/Latest.tsx`：引入 `useTilt`，两张译文卡 tilt——高亮卡 2.5°、普通卡 1.5°。
  - `src/popup/App.tsx`：`UI.copyToast` 从 `animate-fade-up` 换 `poly-toast-pop` spring 弹跳；`UI.textarea` 加 `poly-input-glow`，聚焦时柔珊瑚光晕。
  - 校验：`tsc --noEmit` 通过（EXIT=0）。bash heredoc / Edit 同步问题再次出现（Bubble/Dashboard/Latest 末尾被截断），用 `python rstrip(NUL)` + `cat > file` 整文件覆盖修复，整理出"工具同步异常应对手册"已纳入 obsidian 日志。
- 长文阅读体验深化（第十九轮）：把复习文章 / 写作批改 / 写作分析三个 Tab 的 LLM 长文输出从 `whitespace-pre-wrap` 纯文本升级到「杂志文章」排版。不引 markdown 渲染依赖，先在 CSS 层提升阅读舒适度。
  - `src/shared/theme.css`：新增 3 类长文样式——`.poly-prose`（衬线字体栈 + `font-size: 15px` + `line-height: 1.85` + `letter-spacing: 0.005em` + `hyphens: auto` + `text-wrap: pretty`；内部 `h1/h2/h3` 衬线大字 + 字号梯度、`blockquote` 左 3px 珊瑚 + 米色背景 + 斜体、`code` 米纸背景 + 珊瑚字 + 等宽、`hr` 珊瑚渐变水平线、`strong` 暖深灰、`em` 珊瑚、`ul/ol li::marker` 珊瑚标记），`.poly-prose-dropcap::first-letter`（段首大字 float left 3.2em 衬线珊瑚），`.poly-prose-rule::before`（左侧 3px 珊瑚渐变装饰条 + top/bottom 缩进）。
  - `src/sidepanel/pages/ui.ts`：`prosePanel` / `prosePanelTall` 升级——移除原 `poly-serif text-[14px] leading-7`，改 `poly-prose poly-prose-dropcap poly-prose-rule`，`padding` 从 `p-3` 升到 `p-5 pr-4`（给左侧 accent rule 留空间）。
  - `src/content/bubble/Bubble.tsx`：`explanationText` 从 `poly-serif m-0 leading-7` 改 `poly-prose m-0 text-[13.5px] !leading-[1.75]`，气泡解读区也走杂志排版但用 `!leading` 覆盖默认 1.85 适应气泡空间。
  - 校验：`tsc --noEmit` 通过（EXIT=0）；同步异常修复手册已沉淀（Bubble 截断 → tail 看尾 → 缺多少补多少）。
- 交互与排版三合一（第二十轮）：按钮 ripple 点击波纹 + 长文 markdown 真正渲染 + 智能 drop cap。
  - `src/shared/theme.css`：新增 `.poly-ripple`（CSS-only 中心扩散，`:active::after` 触发 `poly-ripple-out` keyframe `scale(1)→scale(70)` + 透明度 0.32→0，540ms 完成）和 `.poly-drop-letter`（JS-wrap 首字符样式，3.2em 衬线珊瑚 float left）；`.poly-prose-dropcap:has(.poly-drop-letter)::first-letter { all: unset; }` 让 CSS ::first-letter 后备在已有 JS-wrapped drop letter 时自动关闭，避免双层放大。
  - `src/content/bubble/bubble.css`：同步加 `.poly-ripple` 类 + keyframe（Shadow DOM 内独立 CSS 不能共享 theme.css）。
  - `src/shared/PolyProse.tsx`：**新建 ~240 行**轻量 markdown 渲染组件。块级解析覆盖 H1/H2/H3、有序/无序列表（`-/*/•` 和 `1.`）、引用块（连续 `>` 行合并）、水平分隔符（`---/___/***`）、围栏代码块、普通段落（连续多行合并）；行内解析按优先级（行内代码 → 加粗 → 斜体）渲染为 React `<code>` `<strong>` `<em>`；`injectDropCap` 用 unicode 类正则 `^([\s\p{P}\p{S}]*)(\p{L}|\p{N}|[一-鿿])([\s\S]*)$` 剥离前导空白/标点，把第一个有意义字符（含中文）wrap 成 `<span class="poly-drop-letter">`。输出原生 React 元素而非 dangerouslySetInnerHTML，免 XSS。零外部依赖（不引 marked / react-markdown）。
  - `src/sidepanel/pages/ui.ts`：5 个主按钮挂 `poly-ripple`——`primaryButton` / `practiceStartButton` / `practiceSendButton` / `chatSendButton` / `reviewRevealButton`。
  - `src/content/bubble/Bubble.tsx`：`actionBtnAccent`（气泡内"深度"按钮）挂 `poly-ripple`。
  - `src/sidepanel/pages/ReviewArticles.tsx` / `Writing.tsx` / `WritingAnalysis.tsx` / `Vocabulary.tsx`：4 个长文展示位把 `<article>` 全部替换为 `<PolyProse content={...} className={...} />`，LLM 输出的 `# / ## / > / - / 1. / **bold** / `code` / ---` 全部正确渲染。
  - 校验：`tsc --noEmit` 通过（EXIT=0）。Bubble.tsx 又出现工具同步异常导致末尾重复 ArrowRightIcon 碎片，用 `head -n 561 > /tmp/clean && cp /tmp/clean → 目标` 截断到正确位置修复（跨设备 mv 会报错，必须用 cp）。
- 暗色模式 + PolyProse GFM 扩展 + 位置感 ripple + 测试覆盖（第二十一轮）：把上一轮收尾的三块剩余候选一次性做完，并补全自动化测试。
  - `src/shared/theme.css`：`:root` 暗色 token 用 `prefers-color-scheme: dark` + `[data-poly-theme="dark"]` 双轨；三个 body class（`poly-sidepanel/popup/options`）暗色背景径向渐变 + 纸纹 mask；Tailwind 写死浅色类（`bg-cream-*` / `text-ink-*` / `border-cream-*` / `bg-brand-*` 等）在 `body.poly-*` 范围内暗色覆盖；状态色（rose/amber/orange/emerald）暗色饱和度统一调低；`.poly-prose` 暗色补 blockquote/code/pre/hr/selection；`.poly-ripple::after` `left/top` 从 `50%` 改为 `var(--rx, 50%)` / `var(--ry, 50%)`；新增 GFM 排版样式（链接 slide-up underline、删除线、任务列表 absolute-positioned checkbox、表格圆角包裹 + hover row + 暗色 token）。
  - `src/content/bubble/bubble.css`：Shadow DOM 内补 `.poly-prose` 暗色对比度（h1/h2/h3/code/blockquote/pre/hr/drop-letter）；ripple `--rx/--ry` 默认值同步。
  - `src/shared/PolyProse.tsx`：parser 新增 `task` / `table` 两种 block（含 `isTableDivider` / `parseAlign` / `splitTableRow` 辅助）；`renderInline` 新增 `[text](url)` 链接（自动 `target="_blank"` + `rel="noopener noreferrer"` + `javascript:` 协议黑名单 → `#`）和 `~~删除线~~`；表格输出含 `.poly-prose-table-wrap` 横向滚动 + 三种 align inline style。
  - `src/shared/useRipple.ts`：**新建** 全局 pointerdown 监听 hook，用 `composedPath` 跨 Shadow DOM；命中 `.poly-ripple` 元素计算 (x,y) 相对位置写 `--rx/--ry` 百分比。
  - `src/sidepanel/App.tsx` / `src/popup/App.tsx` / `src/options/App.tsx` / `src/content/bubble/Bubble.tsx`：4 个入口各 mount 一次 `useRipple()`。
  - `src/shared/PolyProse.test.tsx`：**新增 15 测试**（H1/H2/H3、段落合并、ul/ol、bold/italic/code、代码块、blockquote、hr、链接 + JS 协议过滤、删除线、任务列表、GFM 表格三种对齐、dropCap CJK + 标点跳过、dropCap 只对首段生效）。
  - `src/shared/useRipple.test.tsx`：**新增 3 测试**（pointerdown 写百分比、非 ripple 不写、子元素冒泡找到外层）。
  - 校验：`tsc --noEmit` 通过；`npx vite build --outDir dist-pw` 194 modules 5.56s 通过；vitest 共 **46 测试全部 PASS**（含新增 18）。Playwright e2e 沙箱内 chromium 二进制网络受限不可下载，留本地一行命令；旧 `dist/` 目录在 Edge 加载时被锁，build 改用 `--outDir dist-pw` 绕开。

### 文档与运维提示（对话中已说明）

- 本地 **Ollama**：Endpoint、模型名、`OLLAMA_ORIGINS` 含 `chrome-extension://*` 后需**重启 Ollama**。
- **Gemini**：Web Pro ≠ API 配额；404/429 与模型 ID、结算/配额相关说明。
- 加载未打包扩展：使用构建产物 **`dist`** 目录。

### 测试

- 缓存、MyMemory、SM-2、LLM prompt、**writing-analysis-model** 等单元测试随代码迭代增加。

---

## 版本说明

当前仓库未统一打 Git tag；若需对外发布，可将 `[未发布]` 一节改为语义化版本号（如 `1.0.0`）并注明构建日期。

---

*本文件由助手根据对话历史生成，具体以仓库内实际提交为准。*
