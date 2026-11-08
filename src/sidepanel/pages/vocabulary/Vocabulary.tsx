import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FolioPairingStatus, VocabularyEntry, VocabularySyncResult, ReviewRating } from "@shared/types";
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
  const modeRef = useRef<ViewMode>(mode);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewNotice, setReviewNotice] = useState("");
  const gradingRef = useRef(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [composeState, setComposeState] = useState<ComposeState>({
    day: null,
    text: "",
    streaming: false,
    words: [],
  });

  const port = useStreamPort();

  const refresh = useCallback(async (nextMode: ViewMode) => {
    const list = await send("vocabulary:list", {
      due: nextMode === "due" || nextMode === "review",
    });
    setItems(list);
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    void refresh(mode);
  }, [mode, refresh]);

  // 页面加载时查询配对状态；若已配对则自动执行静默双向同步，保持两端一致
  useEffect(() => {
    const triggerSilentSync = async () => {
      try {
        const status = await send("vocabulary:pairing:status");
        setPairingStatus(status);
        if (!status.paired) return;
        const res = await send("vocabulary:sync");
        setSyncResult(res);
        await refresh(modeRef.current);
      } catch (err) {
        console.debug(
          "[polyglot] Silent auto-sync on mount bypassed (Folio might be offline).",
          err
        );
      }
    };
    void triggerSilentSync();
  }, [refresh]);

  const current = items[reviewIndex];

  const onGrade = async (rating: ReviewRating) => {
    if (!current?.id || gradingRef.current) return;
    gradingRef.current = true;
    try {
      await send("vocabulary:review", { id: current.id, rating });
      const next = items.filter((_, idx) => idx !== reviewIndex);
      setItems(next);
      if (reviewIndex >= next.length) setReviewIndex(0);
      setRevealed(false);
      setReviewNotice("复习已保存，待同步排期。");
      void send("vocabulary:sync").then(async result => {
        setSyncResult(result);
        if (result.success) setReviewNotice("复习已同步，Folio 已更新排期。");
        if (modeRef.current !== "review") await refresh(modeRef.current);
      }).catch(() => undefined);
    } catch (error) {
      setReviewNotice(error instanceof Error ? error.message : "保存评分失败，请重试。");
    } finally {
      gradingRef.current = false;
    }
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
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<VocabularySyncResult | null>(null);
  const [pairingStatus, setPairingStatus] = useState<FolioPairingStatus | null>(null);
  const [showPairingBox, setShowPairingBox] = useState(false);
  const [pairingCodeInput, setPairingCodeInput] = useState("");
  const [pairingMsg, setPairingMsg] = useState("");

  const handleSync = async () => {
    if (pairingStatus && !pairingStatus.paired) {
      setShowPairingBox(true);
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await send("vocabulary:sync");
      setSyncResult(res);
      await refresh(mode);
    } catch (err) {
      console.error(err);
      setSyncResult({ pushed: 0, pulled: 0, pending: 0, success: false, error: "无法连接扩展后台，请重试。" });
    } finally {
      setSyncing(false);

    }
  };

  const handleConnectFolio = async () => {
    if (!pairingCodeInput.trim() || syncing) return;
    setSyncing(true);
    setPairingMsg("");
    try {
      const { status, sync } = await send("vocabulary:pairing:connect", {
        pairingCode: pairingCodeInput.trim(),
      });
      setPairingStatus(status);
      setSyncResult(sync);
      setPairingCodeInput("");
      if (sync.success) setShowPairingBox(false);
      await refresh(mode);
    } catch (err) {
      setPairingMsg(err instanceof Error ? err.message : "配对失败，请检查配对码。");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectFolio = async () => {
    const status = await send("vocabulary:pairing:disconnect");
    setPairingStatus(status);
    setPairingMsg("已断开与 Folio 的配对，本地生词已保留。");
  };

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

  const syncLabel = syncing
    ? "同步中"
    : syncResult && !syncResult.success
      ? "同步未完成"
    : items.length === 0
      ? "等待添加"
      : items.every((item) => item.synced)
        ? "已同步"
        : "有内容待同步";

  return (
    <div className={sideUi.pageStack}>
      <div className="foliole-section-heading">
        <div>
          <h1>生词本</h1>
          <p>复习、整理，再把词带回语境。</p>
        </div>
        <span
          className={`foliole-status ${
            syncing || items.length === 0 || !items.every((item) => item.synced) ? "is-pending" : ""
          }`}
        >
          <span aria-hidden />
          {syncLabel}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-cream-200/60 p-1">
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
              className={`${sideUi.modeTabButton} min-h-10 ${
                mode === key ? sideUi.modeTabActive : sideUi.modeTabIdle
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <button
            onClick={() => setShowPairingBox((v) => !v)}
            className={sideUi.subtleButton}
            title="查看扩展 ID 或输入 Folio 配对码"
          >
            {pairingStatus?.paired ? "已配对 Folio" : "配对 Folio"}
          </button>
          <button
            onClick={() => void handleSync()}
            disabled={syncing}
            className={sideUi.subtleButton}
            title="同步正式 Folio 的生词、语境与 FSRS-6 复习进度"
          >
            {syncing ? "同步中…" : "同步 Folio"}
          </button>
          <button
            onClick={() => void exportAnki()}
            disabled={exporting || items.length === 0}
            className={sideUi.subtleButton}
            title="导出为 Anki 可导入的 .txt 文件"
          >
            {exporting ? "导出中…" : "导出 Anki"}
          </button>
        </div>

        {(showPairingBox || (pairingStatus !== null && !pairingStatus.paired)) && (
          <div className={`${sideUi.cardCompact} flex flex-col gap-2 text-xs`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-ink-800">
                {pairingStatus?.paired ? "Folio 实时同步已连接" : "连接 Folio 桌面端"}
              </span>
              {pairingStatus?.extensionId && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(pairingStatus.extensionId);
                    setPairingMsg("扩展 ID 已复制，请到 Folio 扉页「数据」粘贴并生成配对码。");
                  }}
                  className={sideUi.tinyPrimaryButton}
                >
                  复制扩展 ID
                </button>
              )}
            </div>
            {pairingStatus?.extensionId && (
              <div className="font-mono text-[11px] text-ink-500 break-all">
                ID: {pairingStatus.extensionId}
              </div>
            )}
            <div className="flex gap-1.5">
              <input
                value={pairingCodeInput}
                onChange={(e) => setPairingCodeInput(e.target.value)}
                placeholder="粘贴 foliole1... 配对码"
                className={`${sideUi.inputFlex1} !py-1.5 !text-xs font-mono`}
              />
              <button
                type="button"
                disabled={syncing || !pairingCodeInput.trim()}
                onClick={() => void handleConnectFolio()}
                className={sideUi.primaryButton}
              >
                {syncing ? "连接中…" : "连接"}
              </button>
              {pairingStatus?.paired && (
                <button
                  type="button"
                  onClick={() => void handleDisconnectFolio()}
                  className={sideUi.dangerButton}
                >
                  断开
                </button>
              )}
            </div>
            {pairingMsg && <div className="text-[11px] text-ink-600">{pairingMsg}</div>}
          </div>
        )}
      </div>

      {syncResult && (
        <div
          className={`text-[11px] px-3 py-1.5 rounded-xl flex items-center justify-between transition-all ${
            syncResult.success
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          <span>
            {syncResult.success
              ? `同步完成：上传 ${syncResult.pushed} 条记录，更新 ${syncResult.pulled} 个词条及排期。`
              : `${syncResult.error || "仍有记录等待同步。"} 已上传 ${syncResult.pushed} 条，待同步 ${syncResult.pending} 条。`}
          </span>
          <button
            onClick={() => setSyncResult(null)}
            className="ml-2 shrink-0 text-[10px] font-bold hover:opacity-80"
          >
            关闭
          </button>
        </div>
      )}

      {reviewNotice && <p role="status" className={sideUi.bodyMuted}>{reviewNotice}</p>}

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
          <div className={sideUi.emptyCard}>暂无待复习生词。</div>
        )
      ) : items.length === 0 ? (
        <div className={sideUi.emptyCard}>
          {mode === "due" ? "暂无到期生词。" : "生词本为空。可在翻译气泡点击“生词本”添加。"}
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
