/**
 * 高分作文多维建模分析模型 (Polyglot Writing Analysis Model v1)
 * 用于：通用英文写作、雅思/学术议论文等；与「写作批改」互补——侧重结构化诊断与升格路径，而非仅打分。
 */

export interface WritingAnalysisDimension {
  /** 稳定 ID，供测试与日志 */
  id: string;
  /** 中文维度名 */
  nameZh: string;
  /** 英文维度名（便于双语对照） */
  nameEn: string;
  /** 相对权重 1–10，合计不必为 100（由模型提示中说明为相对重要性） */
  weight: number;
  /** 高分档（7.5+/Band 8+ 或同类）典型信号 */
  highScoreSignals: string[];
  /** 常见失分点 / 风险信号 */
  riskSignals: string[];
  /** 分析时建议检查的微观指标 */
  microChecks: string[];
}

export const WRITING_ANALYSIS_MODEL_VERSION = "1.0.0";

export const WRITING_ANALYSIS_DIMENSIONS: WritingAnalysisDimension[] = [
  {
    id: "task_alignment",
    nameZh: "任务契合与立意",
    nameEn: "Task alignment & stance",
    weight: 10,
    highScoreSignals: [
      "全文紧扣题干限定词（范围、对象、因果、程度）",
      "立场清晰且贯穿首尾，无跑题段",
      "回应了题目所有部分（如 discuss both views + opinion）",
    ],
    riskSignals: [
      "只复述题目、无明确论点",
      "段落与题目关键词断裂",
      "泛化套话替代具体回应",
    ],
    microChecks: ["题干关键词覆盖度", "首段是否误答子问题", "结论是否回扣任务动词"],
  },
  {
    id: "thesis_evidence",
    nameZh: "论点—论据—例证链",
    nameEn: "Claim–reason–evidence chain",
    weight: 9,
    highScoreSignals: [
      "每段有可检验的核心句（claim）",
      "理由与例证分层：抽象论证 + 具体化支撑",
      "例证与观点因果一致，避免无关细节堆砌",
    ],
    riskSignals: [
      "只有观点没有展开",
      "例证与论点逻辑跳跃",
      "以个人感受代替可推广论据",
    ],
    microChecks: ["每段 topic sentence 是否可反驳", "是否出现 because / therefore 的显性或隐性链条"],
  },
  {
    id: "macro_structure",
    nameZh: "宏观结构（起承转合）",
    nameEn: "Macro structure",
    weight: 8,
    highScoreSignals: [
      "引言界定议题并预告行文路线",
      "主体段功能分明：展开 / 对比 / 让步等",
      "结尾收束立场并升华或限制范围（而非简单重复）",
    ],
    riskSignals: [
      "段落长短失衡、功能重复",
      "缺少过渡导致阅读跳跃",
      "结论引入新论点",
    ],
    microChecks: ["段数与任务是否匹配", "是否有功能重复的相邻段"],
  },
  {
    id: "cohesion",
    nameZh: "衔接与连贯",
    nameEn: "Cohesion & coherence",
    weight: 8,
    highScoreSignals: [
      "指代（this / these / such）语义清晰",
      "衔接手段多样：代词、同义复现、逻辑连接词、信息结构（已知→新知）",
      "句间顺序符合读者预期",
    ],
    riskSignals: [
      "连接词滥用或误用（However 接支持而非转折）",
      "代词悬空",
      "句子顺序违反逻辑时间线",
    ],
    microChecks: ["每段首尾句衔接", "连接词与真实逻辑是否一致"],
  },
  {
    id: "lexical",
    nameZh: "词汇资源（精度与地道性）",
    nameEn: "Lexical resource",
    weight: 9,
    highScoreSignals: [
      "搭配地道（verb + noun / adj + noun）",
      "同义替换有节制且准确，非炫词",
      "学术/正式语域与任务一致",
    ],
    riskSignals: [
      "大词误用、搭配中式",
      "重复用词无替换策略",
      "语域漂移（口语体混入正式文）",
    ],
    microChecks: ["高频名词是否可具体化", "形容词是否空洞（good / important）"],
  },
  {
    id: "grammar_syntax",
    nameZh: "语法与句式复杂度",
    nameEn: "Grammatical range & accuracy",
    weight: 9,
    highScoreSignals: [
      "复杂句（从句、非谓语、并列）服务清晰度而非炫技",
      "时态体系统一、条件与假设准确",
      "标点与平行结构正确",
    ],
    riskSignals: [
      "串句、悬垂修饰语",
      "主谓一致与限定词错误",
      "过度简单句堆叠",
    ],
    microChecks: ["长句主干是否可一眼读出", "冠词与单复数"],
  },
  {
    id: "style_rhetoric",
    nameZh: "文体与修辞（高分档关键）",
    nameEn: "Style & rhetorical control",
    weight: 7,
    highScoreSignals: [
      "适度使用让步、对比、强调结构增强说服力",
      "语气与读者预设一致（考官/教授/公众）",
      "避免口号式断言，保留认知谦逊（may / tends to）得当",
    ],
    riskSignals: [
      "空洞呼吁（we should...）无论证",
      "绝对化表述过多",
      "修辞与内容脱节",
    ],
    microChecks: ["是否有单一维度论证过窄", "强调句是否必要"],
  },
  {
    id: "presentation",
    nameZh: "规范与呈现",
    nameEn: "Presentation & conventions",
    weight: 5,
    highScoreSignals: ["拼写一致（英式/美式）", "段落清晰", "如为考试体，字数与格式合规"],
    riskSignals: ["明显拼写错误影响理解", "不分段", "标题与正文格式混乱"],
    microChecks: ["首行缩进/空行习惯", "专有名词大小写"],
  },
];

/** 供 LLM 内化的紧凑文本（避免 token 过长） */
export function formatDimensionsForPrompt(): string {
  return WRITING_ANALYSIS_DIMENSIONS.map((d) => {
    const highs = d.highScoreSignals.map((s) => `    + ${s}`).join("\n");
    const risks = d.riskSignals.map((s) => `    − ${s}`).join("\n");
    const micro = d.microChecks.join("；");
    return [
      `### ${d.nameZh} (${d.nameEn}) · 权重 ${d.weight}/10`,
      `  高分信号:\n${highs}`,
      `  风险信号:\n${risks}`,
      `  微观检查: ${micro}`,
    ].join("\n");
  }).join("\n\n");
}

export interface WritingAnalysisPromptOptions {
  /** 用户选择的体裁说明，如「雅思 Task2」「通用议论文」 */
  genreLabel: string;
  /** 目标分数档，如 6.5、7.0、Band 8；无则模型自行推断参照 */
  targetBand?: string;
  /** 是否提供了题目/材料 */
  hasExternalPrompt: boolean;
}

/**
 * 构建写作分析（多维建模）的系统提示：固定输出骨架 + 嵌入本模型维度。
 */
export function buildWritingAnalysisSystemPrompt(opts: WritingAnalysisPromptOptions): string {
  const bandLine = opts.targetBand
    ? `学习者目标档位（参考）：${opts.targetBand}。分析时对照该档给出「距目标差什么」。`
    : "未指定目标档位：请用 1–9 分制各维度打分，并说明相当于雅思写作大致区间（诚实区间，勿虚高）。";

  const promptLine = opts.hasExternalPrompt
    ? "用户已提供题目/材料：分析必须逐条对照题目要求。"
    : "用户未提供题目：从文本推断体裁与隐含任务，并在总览中注明「推断依据」。";

  return [
    "你是一名资深英文写作教研专家，熟悉雅思、学术英语与议论文体。",
    "你必须严格依据下方「高分作文多维建模」的八个维度进行分析；允许在子维度下合并论述，但八个维度都须出现且有据。",
    "",
    "--- 多维模型 (Polyglot v" + WRITING_ANALYSIS_MODEL_VERSION + ") ---",
    formatDimensionsForPrompt(),
    "--- 模型结束 ---",
    "",
    bandLine,
    promptLine,
    "",
    "输出要求：",
    "- 全文使用**简体中文**（引用学生英文原文时保持英文）。",
    "- 使用下列 **Markdown 标题结构**，顺序一致，勿增删顶级标题；不要代码块包裹全文。",
    "- 分析须**引用学生作文中的原句片段**作为证据（用短引号标出），忌空泛点评。",
    "- 评分诚实：若整体仅中等水平，不得写成高分。",
    "",
    "## 总览",
    "- 推断或确认的体裁与任务",
    "- 字数与分段概况",
    "- 一句话总评（30 字内）",
    "",
    "## 多维评分卡",
    "用表格列出八个维度（中文维度名即可），列：维度 | 得分(1-9) | 权重 | 证据摘录 | 距高分的核心差距",
    "",
    "## 分维度深度诊断",
    "按维度顺序，每维一个小节 `### 维度名`，包含：亮点（如有）/ 问题 / 修改示例（英→英，给出 1 句升格示例即可）",
    "",
    "## 结构图谱",
    "简述各段功能（起/承/转/合或对比/让步等），指出结构层面的唯一最大短板。",
    "",
    "## 语言微观清单",
    "列出 5–8 个具体问题：搭配/冠词/中式英语/冗余/指代（每条：原句片段 → 类型 → 建议）",
    "",
    "## 升格路径（可执行）",
    "按优先级 1–2–3 给出下周可练的具体动作（每条≤40字）。",
    "",
    "## 参考升格句",
    "从文中挑 3–5 个关键句，给出高分改写（不必重写全文）。",
    "",
    "禁止输出 <think>、思维链标签或 JSON。",
  ].join("\n");
}
