import { useEffect, useMemo, useRef, useState } from "react";
import type { VocabularyEntry } from "@shared/types";
import { send } from "@shared/messaging";
import { PolyProse } from "@shared/PolyProse";
import { sideUi } from "./ui";

type ViewMode = "grouped" | "due" | "review";

export function VocabularyTab() {
  const [items, setItems] = useState<VocabularyEntry[]>([]);
  const [mode, setMode] = useState<ViewMode>("grouped");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [composeState, setComposeState] = useState<{
    day: string | null;
    text: string;
    streaming: boolean;
    provider?: string;
    words: string[];
    error?: string;
  }>({ day: null, text: "", streaming: false, words: [] });

  const portRef = useRef<chrome.runtime.Port | null>(null);

  const refresh = async (nextMode: ViewMode) => {
    const list = await send("vocabulary:list", { due: nextMode === "due" || nextMode === "review" });
    setItems(list);
  };

  useEffect(() => {
    void refresh(mode);
  }, [mode]);

  useEffect(() => {
    return () => {
      portRef.current?.disconnect();
    };
  }, []);

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

  const groups = useMemo(() => groupByDay(items), [items]);

  const composeArticle = (day: string, dayItems: VocabularyEntry[]) => {
    if (!dayItems.length) return;
    portRef.current?.disconnect();
    setComposeState({ day, text: "", streaming: true, words: dayItems.map((item) => item.word) });
    const port = chrome.runtime.connect({ name: "polyglot-stream" });
    portRef.current = port;

    port.onMessage.addListener((message: { type: string; payload?: unknown }) => {
      if (message.type === "chunk") {
        const chunk = message.payload as { translatedText?: string; provider?: string };
        if (chunk.translatedText) {
          setComposeState((prev) => ({
            ...prev,
            text: chunk.translatedText || "",
            provider: chunk.provider || prev.provider,
          }));
        }
      } else if (message.type === "done") {
        const done = message.payload as { provider?: string };
        setComposeState((prev) => ({ ...prev, streaming: false, provider: done.provider || prev.provider }));
      } else if (message.type === "error") {
        const err = message.payload as { message?: string };
        setComposeState((prev) => ({
          ...prev,
          streaming: false,
          error: err?.message || "未知错误",
        }));
      }
    });

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

  const stopCompose = () => {
    portRef.current?.postMessage({ type: "translate:stream:abort" });
    setComposeState((prev) => ({ ...prev, streaming: false }));
  };

  return (
    <div className={sideUi.pageStack}>
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

      {mode === "review" ? (
        current ? (
          <ReviewCard
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
        <div className={sideUi.stackLg}>
          {groups.map(({ day, entries }) => {
            const isComposing = composeState.day === day;
            return (
              <section key={day} className={sideUi.groupSection}>
                <header className={sideUi.groupHeader}>
                  <div className={sideUi.groupHeaderLeft}>
                    <span className={sideUi.groupDayLabel}>
                      {day}
                    </span>
                    <span className={sideUi.badgeNeutral}>
                      {entries.length} 个
                    </span>
                  </div>
                  <button
                    onClick={() => composeArticle(day, entries)}
                    disabled={composeState.streaming}
                    className={sideUi.tinyPrimaryButton}
                  >
                    {isComposing && composeState.streaming ? sideUi.stateStreaming : "生成复习文章"}
                  </button>
                </header>
                {isComposing && (composeState.text || composeState.streaming || composeState.error) && (
                  <ComposeResult
                    day={day}
                    text={composeState.text}
                    streaming={composeState.streaming}
                    provider={composeState.provider}
                    words={composeState.words}
                    error={composeState.error}
                    onStop={stopCompose}
                    onClose={() =>
                      setComposeState({
                        day: null,
                        text: "",
                        streaming: false,
                        provider: undefined,
                        words: [],
                        error: undefined,
                      })
                    }
                  />
                )}
                <ul className={sideUi.detailsStack}>
                  {entries.map((item) => (
                    <VocabCard
                      key={item.id}
                      item={item}
                      expanded={expandedId === item.id}
                      onToggle={() => setExpandedId((id) => (id === item.id ? null : item.id!))}
                      onRemove={() => onRemove(item.id)}
                      onUpdate={(patch) => onUpdate(item.id!, patch)}
                      onRegenExamples={async (id) => {
                        const updated = await send("vocabulary:examples:regen", { id });
                        setItems((list) => list.map((x) => (x.id === id ? updated : x)));
                      }}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VocabCard({
  item,
  expanded,
  onToggle,
  onRemove,
  onUpdate,
  onRegenExamples,
}: {
  item: VocabularyEntry;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<VocabularyEntry>) => void;
  onRegenExamples: (id: number) => Promise<void>;
}) {
  const [editingDate, setEditingDate] = useState(false);
  const [editingFields, setEditingFields] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);

  return (
    <li className={sideUi.cardCompact}>
      <button
        onClick={onToggle}
        className={sideUi.itemHeaderButton}
      >
        <div className={sideUi.itemHeaderMain}>
          <div className={sideUi.itemHeaderTop}>
            <p className={sideUi.bodyTitle}>{item.word}</p>
            {item.phonetic && (
              <span className={sideUi.bodySubtle}>{item.phonetic}</span>
            )}
          </div>
          <p className={sideUi.bodySummaryClamp}>{item.translation}</p>
          {item.examples && item.examples[0] && (
            <p className={sideUi.bodySubtleClamp}>
              例：{item.examples[0].en}
            </p>
          )}
        </div>
        <div className={sideUi.itemHeaderMeta}>
          <Badge color={dueColor(item)}>{dueLabel(item)}</Badge>
          <span>{expanded ? "收起" : "详情"}</span>
        </div>
      </button>

      {expanded && (
        <div
          className={sideUi.itemDetailPanel}
          onClick={(e) => e.stopPropagation()}
        >
          <DetailRow label="首次添加">
            {editingDate ? (
              <input
                type="date"
                defaultValue={toDateInput(item.addedAt)}
                autoFocus
                onBlur={(e) => {
                  const nextTs = fromDateInput(e.target.value) ?? item.addedAt;
                  setEditingDate(false);
                  if (nextTs !== item.addedAt) onUpdate({ addedAt: nextTs });
                }}
                className={sideUi.inputInline}
              />
            ) : (
              <button
                className={sideUi.inlineEditTrigger}
                onClick={() => setEditingDate(true)}
                title="点击修改日期"
              >
                {new Date(item.addedAt).toLocaleString()}
              </button>
            )}
          </DetailRow>
          <DetailRow label="下次复习">
            <span>
              {new Date(item.nextReviewAt).toLocaleString()}{" "}
              <span className={sideUi.subtleParen}>({dueLabel(item)})</span>
            </span>
          </DetailRow>
          <DetailRow label="复习次数">
            <span>
              {item.reps} 次（失败 {item.lapses} 次）
            </span>
          </DetailRow>
          <DetailRow label="熟练度">
            <span>{item.easeFactor.toFixed(2)} · 间隔 {item.interval} 天</span>
          </DetailRow>

          {editingFields ? (
            <div className={sideUi.detailsStack}>
              <DetailRow label="单词">
                <input
                  defaultValue={item.word}
                  onBlur={(e) => onUpdate({ word: e.target.value })}
                  className={sideUi.inputInlineFull}
                />
              </DetailRow>
              <DetailRow label="释义">
                <textarea
                  defaultValue={item.translation}
                  onBlur={(e) => onUpdate({ translation: e.target.value })}
                  className={sideUi.inputInlineFull}
                  rows={2}
                />
              </DetailRow>
              <DetailRow label="上下文">
                <textarea
                  defaultValue={item.context || ""}
                  onBlur={(e) => onUpdate({ context: e.target.value })}
                  placeholder="添加原始句子或备注"
                  className={sideUi.inputInlineFull}
                  rows={2}
                />
              </DetailRow>
              <DetailRow label="标签">
                <input
                  defaultValue={(item.tags || []).join(",")}
                  onBlur={(e) =>
                    onUpdate({
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="用逗号分隔"
                  className={sideUi.inputInlineFull}
                />
              </DetailRow>
            </div>
          ) : (
            <>
              {item.context && (
                <DetailRow label="上下文">
                  <span className={sideUi.contextItalic}>{item.context}</span>
                </DetailRow>
              )}
              {item.examples && item.examples.length > 0 && (
                <div className={sideUi.stackTight}>
                  <p className={sideUi.sectionLabel}>例句</p>
                  <ul className={sideUi.detailsStack}>
                    {item.examples.map((ex, idx) => (
                      <li key={idx} className={sideUi.exampleItem}>
                        <p className={sideUi.bodyText}>{ex.en}</p>
                        <p className={sideUi.bodyMuted}>{ex.zh}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {item.tags && item.tags.length > 0 && (
                <DetailRow label="标签">
                  <span className={sideUi.tagsWrap}>
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className={sideUi.tagChip}
                      >
                        #{tag}
                      </span>
                    ))}
                  </span>
                </DetailRow>
              )}
            </>
          )}

          <div className={sideUi.itemActionsBar}>
            {item.id && (
              <button
                type="button"
                disabled={regenBusy}
                onClick={async () => {
                  if (!item.id) return;
                  setRegenBusy(true);
                  try {
                    await onRegenExamples(item.id);
                  } catch {
                    // ignore; errors surface via devtools; optional toast could be added later
                  } finally {
                    setRegenBusy(false);
                  }
                }}
                className={sideUi.subtleButtonMiniMutedDisabled}
              >
                {regenBusy ? "例句生成中..." : "重生成例句"}
              </button>
            )}
            <button
              onClick={() => setEditingFields((v) => !v)}
              className={sideUi.subtleButtonMiniMuted}
            >
              {editingFields ? "完成编辑" : "编辑详情"}
            </button>
            <button
              onClick={onRemove}
              className={sideUi.dangerButtonMini}
            >
              删除
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ReviewCard({
  current,
  progress,
  revealed,
  onReveal,
  onGrade,
}: {
  current: VocabularyEntry;
  progress: string;
  revealed: boolean;
  onReveal: () => void;
  onGrade: (quality: 0 | 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className={sideUi.card}>
      <div className={sideUi.reviewProgress}>{progress}</div>
      <p className={sideUi.reviewWord}>{current.word}</p>
      {current.phonetic && <p className={sideUi.reviewPhonetic}>{current.phonetic}</p>}
      <button
        onClick={onReveal}
        className={sideUi.reviewRevealButton}
        disabled={revealed}
      >
        {revealed ? "已显示答案" : "显示答案"}
      </button>
      {revealed && (
        <>
          <p className={sideUi.reviewAnswer}>{current.translation}</p>
          {current.context && <p className={sideUi.reviewContext}>{current.context}</p>}
          {current.examples && current.examples.length > 0 && (
            <ul className={sideUi.reviewExamplesList}>
              {current.examples.map((ex, idx) => (
                <li key={idx} className={sideUi.exampleItemReview}>
                  <p>{ex.en}</p>
                  <p className={sideUi.bodyMuted}>{ex.zh}</p>
                </li>
              ))}
            </ul>
          )}
          <div className={sideUi.reviewGradesGrid}>
            {[
              { label: "记不起", q: 0, toneClass: sideUi.reviewGradeDangerStrongButton },
              { label: "差", q: 1, toneClass: sideUi.reviewGradeDangerButton },
              { label: "勉强", q: 2, toneClass: sideUi.reviewGradeWarnButton },
              { label: "合格", q: 3, toneClass: sideUi.reviewGradeMidButton },
              { label: "熟练", q: 4, toneClass: sideUi.reviewGradeGoodButton },
              { label: "完美", q: 5, toneClass: sideUi.reviewGradeBestButton },
            ].map(({ label, q, toneClass }) => (
              <button
                key={q}
                onClick={() => onGrade(q as 0 | 1 | 2 | 3 | 4 | 5)}
                className={toneClass}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={sideUi.reviewHint}>
            评级将影响下次复习间隔（SM-2 算法）
          </p>
        </>
      )}
    </div>
  );
}

function ComposeResult({
  day,
  text,
  streaming,
  provider,
  words,
  error,
  onStop,
  onClose,
}: {
  day: string;
  text: string;
  streaming: boolean;
  provider?: string;
  words: string[];
  error?: string;
  onStop: () => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (streaming) setSaved(false);
  }, [day, streaming]);

  const saveArticle = async () => {
    if (!text || streaming || saving) return;
    setSaving(true);
    try {
      await send("reviewArticle:add", {
        dayLabel: day,
        content: text,
        provider: provider || "unknown",
        words,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={sideUi.accentCardCompact}>
      <div className={sideUi.composeHeader}>
        <span className={sideUi.composeTitle}>
          复习文章 {streaming ? `· ${sideUi.stateStreaming}` : error ? `· ${sideUi.stateFailed}` : `· ${sideUi.stateDone}`}
        </span>
        <div className={sideUi.composeActions}>
          {streaming && (
            <button onClick={onStop} className={sideUi.ghostButton}>
              停止
            </button>
          )}
          {text && !streaming && (
            <button onClick={() => void saveArticle()} className={sideUi.ghostBrandButton}>
              {saving ? sideUi.actionSaving : saved ? sideUi.actionSaved : sideUi.actionSave}
            </button>
          )}
          {text && !streaming && (
            <button
              onClick={() => navigator.clipboard.writeText(text).catch(() => undefined)}
              className={sideUi.ghostButton}
            >
              复制
            </button>
          )}
          <button onClick={onClose} className={sideUi.ghostButton}>
            关闭
          </button>
        </div>
      </div>
      {error ? (
        <p className={sideUi.dangerText}>{error}</p>
      ) : (
        <PolyProse
          content={text || (streaming ? "正在请求模型..." : "")}
          className={sideUi.prosePanel}
        />
      )}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={sideUi.detailRow}>
      <span className={sideUi.detailLabel}>
        {label}
      </span>
      <span className={sideUi.detailContent}>{children}</span>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={color}>{children}</span>
  );
}

function dueColor(item: VocabularyEntry): string {
  const diff = item.nextReviewAt - Date.now();
  if (diff <= 0) return `${sideUi.badgeBase} bg-amber-500/15 text-amber-300`;
  if (diff < 24 * 60 * 60 * 1000) return `${sideUi.badgeBase} bg-emerald-500/10 text-emerald-300`;
  return `${sideUi.badgeBase} bg-slate-800 text-slate-400`;
}

function dueLabel(item: VocabularyEntry): string {
  const diff = item.nextReviewAt - Date.now();
  if (diff <= 0) return "待复习";
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  if (days < 1) return "今日内";
  if (days === 1) return "明天";
  return `${days} 天后`;
}

function groupByDay(items: VocabularyEntry[]): Array<{ day: string; entries: VocabularyEntry[] }> {
  const map = new Map<string, VocabularyEntry[]>();
  const sorted = [...items].sort((a, b) => b.addedAt - a.addedAt);
  for (const entry of sorted) {
    const day = formatDay(entry.addedAt);
    const bucket = map.get(day);
    if (bucket) bucket.push(entry);
    else map.set(day, [entry]);
  }
  return Array.from(map.entries()).map(([day, entries]) => ({ day, entries }));
}

function formatDay(ts: number): string {
  const date = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(date, today)) return `今天 · ${date.toLocaleDateString()}`;
  if (isSameDay(date, yesterday)) return `昨天 · ${date.toLocaleDateString()}`;
  return date.toLocaleDateString();
}

function toDateInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fromDateInput(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}
