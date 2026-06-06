import { useEffect, useRef, useState } from "react";
import { send } from "@shared/messaging";
import type { Settings } from "@shared/types";
import { PolyProse } from "@shared/PolyProse";
import { sideUi } from "./ui";

type TaskType = "task1-academic" | "task1-general" | "task2";

interface TaskMeta {
  id: TaskType;
  label: string;
  wordTarget: string;
  description: string;
}

const TASKS: TaskMeta[] = [
  {
    id: "task1-academic",
    label: "Task 1 (学术·图表)",
    wordTarget: "≥ 150 字",
    description: "分析图表/流程图/地图等数据类任务。",
  },
  {
    id: "task1-general",
    label: "Task 1 (培训·信件)",
    wordTarget: "≥ 150 字",
    description: "正式 / 半正式 / 非正式信件写作。",
  },
  {
    id: "task2",
    label: "Task 2 (议论文)",
    wordTarget: "≥ 250 字",
    description: "观点 / 双边讨论 / 利弊 / 问题解决类议论文。",
  },
];

export function WritingTab() {
  const [task, setTask] = useState<TaskType>("task2");
  const [prompt, setPrompt] = useState("");
  const [essay, setEssay] = useState("");
  const [target, setTarget] = useState<string>("7.0");
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    void send("settings:get").then((settings: Settings) => {
      setTarget(settings.ieltsTarget || "7.0");
    });
    return () => {
      portRef.current?.disconnect();
    };
  }, []);

  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  const grade = () => {
    if (!essay.trim()) return;
    setStreaming(true);
    setError(null);
    setOutput("");

    portRef.current?.disconnect();
    const port = chrome.runtime.connect({ name: "polyglot-stream" });
    portRef.current = port;

    port.onMessage.addListener((message: { type: string; payload?: unknown }) => {
      if (message.type === "chunk") {
        const chunk = message.payload as { translatedText?: string };
        if (chunk.translatedText) setOutput(chunk.translatedText);
      } else if (message.type === "done") {
        setStreaming(false);
      } else if (message.type === "error") {
        const err = message.payload as { message?: string };
        setError(err?.message || "未知错误");
        setStreaming(false);
      }
    });
    port.onDisconnect.addListener(() => {
      if (portRef.current === port) portRef.current = null;
    });

    const taskMeta = TASKS.find((t) => t.id === task) || TASKS[2];
    const system = [
      "You are a certified IELTS Writing examiner. Apply the official IELTS public band descriptors strictly and honestly.",
      `The candidate is targeting band ${target} for IELTS Writing ${taskMeta.label.replace(/\s.*/, "")}.`,
      "",
      "Output in Chinese using this EXACT markdown structure, no other content:",
      "",
      "## 总体评分",
      "| 维度 | 分数 | 关键点 |",
      "|------|------|--------|",
      "| Task Response/Achievement | x.x | ... |",
      "| Coherence & Cohesion | x.x | ... |",
      "| Lexical Resource | x.x | ... |",
      "| Grammatical Range & Accuracy | x.x | ... |",
      "| **Overall (四舍五入到 0.5)** | **x.x** | 最需要优先提升的一项 |",
      "",
      "## 逐句诊断",
      "按顺序列出每个问题句：原句 → 问题类型（搭配/时态/介词/重复/...）→ 修改建议（直接给出修好的句子）",
      "",
      "## 词汇升级建议",
      "列出文中使用的 5-8 个 Band 6 及以下的词，给出 Band 7+ 的替换（包括同义词和更地道的搭配）。",
      "",
      "## 结构与连贯性点评",
      "段落结构、衔接词使用、论证逻辑是否清晰。",
      "",
      "## 范文参考 (Band-8 水平)",
      "按原题要求重写一篇同主题范文。",
      "",
      "## 下一步练习建议",
      "针对此篇薄弱点，给出 2-3 条具体练习方向。",
      "",
      "Rules:",
      "- Be honest: don't inflate scores. If essay is <7, say so.",
      "- Scores use 0.5 increments.",
      "- Quote student's original English sentences verbatim when diagnosing.",
      "- Do NOT wrap output in code blocks. Do NOT output <think> tags.",
    ].join("\n");

    const user = [
      `Task type: ${taskMeta.label} (${taskMeta.wordTarget})`,
      "",
      "Question / Prompt:",
      prompt.trim() || "(candidate did not paste the original question)",
      "",
      `Candidate essay (${wordCount} words):`,
      essay.trim(),
    ].join("\n");

    port.postMessage({
      type: "llm:prompt",
      payload: {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
    });
  };

  const stop = () => {
    portRef.current?.postMessage({ type: "translate:stream:abort" });
    setStreaming(false);
  };

  return (
    <div className={sideUi.pageStack}>
      <section className={sideUi.panelCard}>
        <div className={sideUi.composeHeader}>
          <span className={sideUi.groupDayLabel}>题目类型</span>
          <span className={sideUi.targetBadge}>
            目标 Band {target}
          </span>
        </div>
        <div className={sideUi.tabsRow}>
          {TASKS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTask(t.id)}
              className={`${sideUi.modeTabButton} ${
                task === t.id ? sideUi.modeTabActive : sideUi.modeTabIdle
              }`}
              title={t.description}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className={sideUi.panelCard}>
        <label className={sideUi.blockGroupLabel}>
          题目 / Prompt（可选）
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            task === "task2"
              ? "例如：Some people think that schools should teach students how to manage money. Do you agree or disagree?"
              : task === "task1-academic"
                ? "把图表 / 流程 / 地图说明粘到这里"
                : "例如：Write a letter to your landlord about a maintenance issue."
          }
          className={sideUi.inputMonoPrompt}
        />
      </section>

      <section className={sideUi.panelCard}>
        <div className={sideUi.labelRow}>
          <label className={sideUi.groupDayLabel}>
            你的作文
          </label>
          <span
            className={`${sideUi.statusText} ${
              (task === "task2" && wordCount >= 250) ||
              (task !== "task2" && wordCount >= 150)
                ? sideUi.statusGood
                : sideUi.statusWarn
            }`}
          >
            {wordCount} 字
            {task === "task2" ? " / 250" : " / 150"}
          </span>
        </div>
        <textarea
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
          placeholder="把你的作文完整粘贴到这里..."
          className={sideUi.inputMonoEssay}
        />
        <div className={sideUi.actionRow}>
          <span className={sideUi.helperText}>
            作文会被发送到深度解读引擎，不会保存到云端。
          </span>
          <div className={sideUi.actionButtons}>
            {streaming && (
              <button
                onClick={stop}
                className={sideUi.subtleButtonMuted}
              >
                停止
              </button>
            )}
            <button
              onClick={grade}
              disabled={streaming || !essay.trim()}
              className={sideUi.primaryButton}
            >
              {streaming ? "批改中..." : "开始批改"}
            </button>
          </div>
        </div>
      </section>

      {(output || streaming || error) && (
        <section className={sideUi.accentCard}>
          <div className={sideUi.composeHeader}>
            <span className={sideUi.composeTitle}>
              批改报告 {streaming ? `· ${sideUi.stateStreaming}` : error ? `· ${sideUi.stateFailed}` : `· ${sideUi.stateDone}`}
            </span>
            {output && !streaming && (
              <button
                onClick={() => navigator.clipboard.writeText(output).catch(() => undefined)}
                className={sideUi.ghostButton}
              >
                复制报告
              </button>
            )}
          </div>
          {error ? (
            <p className={sideUi.dangerText}>{error}</p>
          ) : (
            <PolyProse
              content={output || "正在请求模型..."}
              className={sideUi.prosePanelTall}
            />
          )}
        </section>
      )}
    </div>
  );
}
