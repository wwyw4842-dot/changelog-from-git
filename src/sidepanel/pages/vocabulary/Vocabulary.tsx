import { useEffect, useMemo, useState } from "react";
import type { VocabularyEntry } from "@shared/types";
import { send } from "@shared/messaging";
import { downloadAnkiExport } from "@shared/anki-export";
import { useStreamPort } from "../../hooks/useStreamPort";
import { sideUi } from "../ui";
import { VocabularyGrid } from "./VocabularyGrid";
import { ReviewMode } from "./ReviewMode";
import { groupByDay, type ComposeState } from "./utils";

type ViewMode = "grouped" | "due" | "review";

// 生词本主组件：负责状态管理、数据获取与模式切换，渲染委托给子组件
export function VocabularyTab() {
  const [items, setItems] = useState<VocabularyEntry[]>([]);
  const [mode, setMode] = useState<ViewMode>("grouped");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [composeState, setComposeState] = useState<ComposeState>({
    day: null,
    text: "",
    streaming: false,
    words: [],
  });

  const port = useStreamPort();

  const refresh = async (nextMode: ViewMode) => {
    const list = await send("vocabulary:list", { due: nextMode === "due" || nextMode === "review" });
    setItems(list);
  };

  useEffect(() => {
    void refresh(mode);
  }, [mode]);

  const current = items[reviewIndex];

  const onGrade = async (quality: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!current?.id) return;
    await send("vocabulary:review", { id: current.id, quality });
    const next = items.filter((_, idx) => idx !== reviewIndex);
    setItems(next);
    if (reviewIndex >= next.length) setReviewIndex(0);
    setRevealed(false);
  };

  const onRemove = async (id?: number) => {
    if (!id) return;
    await send("vocabulary:remove", { id });
    setItems(items.filter((item) => item.id !== id));
  };

  const onUpdate = async (id: number, patch: Partial<VocabularyEntry>) => {
    const updated = await send("vocabulary:update", { id, patch });
    setItems((list) => list.map((item) => (item.id === id ? updated : item)));
  };

  const onRegenExamples = async (id: number) => {
    const updated = await send("vocabulary:examples:regen", { id });
    setItems((list) => list.map((x) => (x.id === id ? updated : x)));
  };

  const groups = useMemo(() => groupByDay(items), [items]);

  const composeArticle = (day: string, dayItems: VocabularyEntry[]) => {
    if (!dayItems.length) return;
    setComposeState({ day, text: "", streaming: true, words: dayItems.map((item) => item.word) });

    const wordsList = dayItems
      .map(
        (item, idx) =>
          `${idx + 1}. "${item.word}" → ${item.translation}${item.context ? ` [原上下文: ${item.context}]` : ""}`
      )
      .join("\n");

    const system = [
      "你是一名资深语言教师，擅长把零散的词汇编织成自然、连贯、地道、难度适中的复习短文。",
      "严格输出下列结构：",
      "",
      "# 复习短文",
      "(一段 150-250 字的英文短文，把所有提供的词汇都自然地用进去，每个生词首次出现时用 **加粗** 标出)",
      "",
      "# 中文翻译",
      "(上面短文的中文翻译，自然地道)",
      "",
      "# 关键词回顾",
      "(逐行列出每个词汇：`word` — 中文含义 — 它在文中起到的作用/语境)",
      "",
      "除了这三个板块以外不要输出任何其他内容，不要使用代码块、不要用 <think> 标签。",
    ].join("\n");

    const user = [
      "请用下列生词写一篇复习短文：",
      "",
      wordsList,
      "",
      "要求：",
      "- 每个生词至少出现一次，顺序不限；",
      "- 英文短文自然流畅，长度 150-250 字；",
      "- 在关键生词首次出现时使用 **加粗**；",
      "- 然后给出完整中文翻译；",
      "- 最后附上关键词回顾。",
    ].join("\n");

    port.startPrompt(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      {
        onChunk: (chunk) => {
          if (chunk.translatedText) {
            setComposeState((prev) => ({
              ...prev,
              text: chunk.translatedText || "",
              provider: chunk.provider || prev.provider,
            }));
          }
        },
        onDone: (done) => {
          setComposeState((prev) => ({
            ...prev,
            streaming: false,
            provider: done.provider || prev.provider,
          }));
        },
        onError: (message) => {
          setComposeState((prev) => ({ ...prev, streaming: false, error: message }));
        },
      }
    );
  };

  const stopCompose = () => {
    port.abort();
    setComposeState((prev) => ({ ...prev, streaming: false }));
  };

  const closeCompose = () =>
    setComposeState({
      day: null,
      text: "",
      streaming: false,
      provider: undefined,
      words: [],
      error: undefined,
    });

  const [exporting, setExporting] = useState(false);
  const exportAnki = async () => {
    setExporting(true);
    try {
      const all = await send("vocabulary:list", {});
      downloadAnkiExport(all);
    } catch (error) {
      console.warn("[polyglot] anki export failed", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={sideUi.pageStack}>
      <div className={sideUi.vocabToolbar}>
        <div className={sideUi.vocabModeRow}>
          {(
            [
              { key: "grouped", label: "按日期" },
              { key: "due", label: "待复习" },
              { key: "review", label: "复习模式" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`${sideUi.modeTabButton} ${
                mode === key ? sideUi.modeTabActive : sideUi.modeTabIdle
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void exportAnki()}
          disabled={exporting || items.length === 0}
          className={sideUi.subtleButton}
          title="导出为 Anki 可导入的 .txt 文件"
        >
          {exporting ? "导出中…" : "导出 Anki"}
        </button>
      </div>

      {mode === "review" ? (
        current ? (
          <ReviewMode
            current={current}
            progress={`${reviewIndex + 1} / ${items.length}`}
            revealed={revealed}
            onReveal={() => setRevealed(true)}
            onGrade={onGrade}
          />
        ) : (
          <div className={sideUi.emptyCard}>
            暂无待复习生词。
          </div>
        )
      ) : items.length === 0 ? (
        <div className={sideUi.emptyCard}>
          {mode === "due"
            ? "暂无到期生词。"
            : "生词本为空。可在翻译气泡点击“生词本”添加。"}
        </div>
      ) : (
        <VocabularyGrid
          groups={groups}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
          onRemove={onRemove}
          onUpdate={onUpdate}
          onRegenExamples={onRegenExamples}
          composeState={composeState}
          onCompose={composeArticle}
          onStopCompose={stopCompose}
          onCloseCompose={closeCompose}
        />
      )}
    </div>
  );
}
