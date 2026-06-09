import { useEffect, useState } from "react";
import { send } from "@shared/messaging";
import type { Settings } from "@shared/types";
import {
  WRITING_ANALYSIS_DIMENSIONS,
  WRITING_ANALYSIS_MODEL_VERSION,
  buildWritingAnalysisSystemPrompt,
} from "@shared/writing-analysis-model";
import { PolyProse } from "@shared/PolyProse";
import { useStreamPort } from "../hooks/useStreamPort";
import { sideUi } from "./ui";

const GENRES = [
  { id: "general-argument", label: "通用议论文" },
  { id: "ielts-task2", label: "雅思 Task 2" },
  { id: "ielts-task1-a", label: "雅思 Task 1 · 图表" },
  { id: "ielts-task1-g", label: "雅思 Task 1 · 书信" },
  { id: "academic", label: "学术短文 / 课程作业" },
  { id: "narrative", label: "叙事 / 描述" },
] as const;

type GenreId = (typeof GENRES)[number]["id"];

export function WritingAnalysisTab() {
  const [genre, setGenre] = useState<GenreId>("general-argument");
  const [externalPrompt, setExternalPrompt] = useState("");
  const [essay, setEssay] = useState("");
  const [target, setTarget] = useState<string>("");
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const port = useStreamPort();

  useEffect(() => {
    void send("settings:get").then((s: Settings) => {
      if (s.ieltsTarget) setTarget(s.ieltsTarget);
    });
  }, []);

  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;
  const genreLabel = GENRES.find((g) => g.id === genre)?.label || genre;

  const runAnalysis = () => {
    if (!essay.trim()) return;
    setStreaming(true);
    setError(null);
    setOutput("");

    const system = buildWritingAnalysisSystemPrompt({
      genreLabel: `${genreLabel}（用户选择）`,
      targetBand: target.trim() || undefined,
      hasExternalPrompt: Boolean(externalPrompt.trim()),
    });

    const user = [
      `体裁：${genreLabel}`,
      target.trim() ? `目标档位（参考）：${target.trim()}` : "",
      "",
      externalPrompt.trim() ? `题目 / 材料 / 要求：\n${externalPrompt.trim()}` : "（用户未提供单独题目，请从正文推断任务。）",
      "",
      `学生作文（约 ${wordCount} words）：`,
      essay.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    port.startPrompt(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      {
        onChunk: (chunk) => {
          if (chunk.translatedText) setOutput(chunk.translatedText);
        },
        onDone: () => setStreaming(false),
        onError: (message) => {
          setError(message);
          setStreaming(false);
        },
      }
    );
  };

  const stop = () => {
    port.abort();
    setStreaming(false);
  };

  return (
    <div className={sideUi.pageStack}>
      <section className={sideUi.panelCard}>
        <div className={sideUi.panelHeader}>
          <span className={sideUi.groupDayLabel}>多维建模</span>
          <span className={sideUi.helperText}>模型 v{WRITING_ANALYSIS_MODEL_VERSION}</span>
        </div>
        <p className={sideUi.introText}>
          八个维度：{WRITING_ANALYSIS_DIMENSIONS.map((d) => d.nameZh).join(" · ")}。分析结果由当前「高级/推理」LLM
          生成，侧重证据化诊断与升格路径（与「写作批改」的考官打分报告可对照使用）。
        </p>
      </section>

      <section className={sideUi.panelCard}>
        <span className={sideUi.groupDayLabel}>体裁</span>
        <div className={sideUi.tabsRow}>
          {GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGenre(g.id)}
              className={genre === g.id ? sideUi.modeTabActiveButton : sideUi.modeTabIdleButton}
            >
              {g.label}
            </button>
          ))}
        </div>
      </section>

      <section className={sideUi.panelCard}>
        <label className={sideUi.blockGroupLabel}>
          目标档位（可选）
        </label>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="如 7.0、Band 7.5、课程 A-"
          className={sideUi.inputMonoMt1Full}
        />
      </section>

      <section className={sideUi.panelCard}>
        <label className={sideUi.blockGroupLabel}>
          题目 / 材料（可选）
        </label>
        <textarea
          value={externalPrompt}
          onChange={(e) => setExternalPrompt(e.target.value)}
          placeholder="有题干时粘贴在此，分析会更准；无题干则根据正文推断任务。"
          className={sideUi.inputMonoPromptTall}
        />
      </section>

      <section className={sideUi.panelCard}>
        <div className={sideUi.labelRow}>
          <label className={sideUi.groupDayLabel}>正文</label>
          <span className={sideUi.helperText}>{wordCount} words</span>
        </div>
        <textarea
          value={essay}
          onChange={(e) => setEssay(e.target.value)}
          placeholder="粘贴完整英文作文…"
          className={sideUi.inputMonoEssay}
        />
        <div className={sideUi.actionRow}>
          <span className={sideUi.helperText}>仅发送到本地/已配置的 LLM，扩展不保存正文。</span>
          <div className={sideUi.actionButtons}>
            {streaming && (
              <button
                type="button"
                onClick={stop}
                className={sideUi.subtleButtonMutedWide}
              >
                停止
              </button>
            )}
            <button
              type="button"
              onClick={runAnalysis}
              disabled={streaming || !essay.trim()}
              className={sideUi.primaryButton}
            >
              {streaming ? "分析中…" : "多维分析"}
            </button>
          </div>
        </div>
      </section>

      {(output || streaming || error) && (
        <section className={sideUi.accentCard}>
          <div className={sideUi.composeHeader}>
            <span className={sideUi.composeTitle}>
              分析报告 {streaming ? `· ${sideUi.stateStreaming}` : error ? `· ${sideUi.stateFailed}` : `· ${sideUi.stateDone}`}
            </span>
            {output && !streaming && (
              <button
                type="button"
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
