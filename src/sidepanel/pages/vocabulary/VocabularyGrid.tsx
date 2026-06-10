import { useState } from "react";
import type { VocabularyEntry } from "@shared/types";
import { sideUi } from "../ui";
import { ArticleComposer } from "./ArticleComposer";
import { dueColor, dueLabel, toDateInput, fromDateInput, type ComposeState } from "./utils";

// 按日期分组的词汇列表视图：分组标题 + 生成复习文章入口 + 可展开/编辑/删除的单词条目
export function VocabularyGrid({
  groups,
  expandedId,
  onToggleExpand,
  onRemove,
  onUpdate,
  onRegenExamples,
  composeState,
  onCompose,
  onStopCompose,
  onCloseCompose,
}: {
  groups: Array<{ day: string; entries: VocabularyEntry[] }>;
  expandedId: number | null;
  onToggleExpand: (id: number) => void;
  onRemove: (id?: number) => void;
  onUpdate: (id: number, patch: Partial<VocabularyEntry>) => void;
  onRegenExamples: (id: number) => Promise<void>;
  composeState: ComposeState;
  onCompose: (day: string, entries: VocabularyEntry[]) => void;
  onStopCompose: () => void;
  onCloseCompose: () => void;
}) {
  return (
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
                onClick={() => onCompose(day, entries)}
                disabled={composeState.streaming}
                className={sideUi.tinyPrimaryButton}
              >
                {isComposing && composeState.streaming ? sideUi.stateStreaming : "生成复习文章"}
              </button>
            </header>
            {isComposing && (composeState.text || composeState.streaming || composeState.error) && (
              <ArticleComposer
                day={day}
                text={composeState.text}
                streaming={composeState.streaming}
                provider={composeState.provider}
                words={composeState.words}
                error={composeState.error}
                onStop={onStopCompose}
                onClose={onCloseCompose}
              />
            )}
            <ul className={sideUi.detailsStack}>
              {entries.map((item) => (
                <VocabCard
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() => onToggleExpand(item.id!)}
                  onRemove={() => onRemove(item.id)}
                  onUpdate={(patch) => onUpdate(item.id!, patch)}
                  onRegenExamples={onRegenExamples}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// 单个生词条目卡片：折叠态显示摘要，展开后可查看详情、编辑字段、重生成例句、删除
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
