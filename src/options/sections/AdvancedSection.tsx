import { useState } from "react";
import type { Settings } from "@shared/types";
import { send } from "@shared/messaging";
import { optionUi } from "./ui";

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void | Promise<void>;
}

export function AdvancedSection({ settings, onUpdate }: Props) {
  const [status, setStatus] = useState("");

  const clearHistory = async () => {
    await send("history:clear");
    setStatus("历史记录已清空。");
  };

  const exportVocab = async (format: "csv" | "tsv") => {
    const list = await send("vocabulary:list", { limit: 2000 });
    const headers = ["word", "translation", "phonetic", "context", "examples", "nextReviewAt"];
    const sep = format === "csv" ? "," : "\t";
    const quote = (cell: string) =>
      format === "csv"
        ? `"${cell.replaceAll('"', '""')}"`
        : cell.replaceAll("\t", " ").replaceAll("\n", " ");
    const formatExamples = (v: (typeof list)[number]) =>
      (v.examples || [])
        .map((ex) => `${ex.en} / ${ex.zh}`)
        .join(" | ");
    const content = [headers.join(sep)]
      .concat(
        list.map((v) =>
          [
            v.word,
            v.translation,
            v.phonetic || "",
            v.context || "",
            formatExamples(v),
            new Date(v.nextReviewAt).toISOString(),
          ]
            .map((cell) => quote(String(cell)))
            .join(sep)
        )
      )
      .join("\n");
    const mime = format === "csv" ? "text/csv;charset=utf-8" : "text/tab-separated-values;charset=utf-8";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `polyglot-vocabulary-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(
      format === "tsv"
        ? `已导出 ${list.length} 条（TSV，Anki 官方推荐格式，导入时选 Fields separator: Tab）。`
        : `已导出 ${list.length} 条生词（CSV）。`
    );
  };

  return (
    <div className={optionUi.sectionBody}>
      <div className={optionUi.card}>
        <h3 className={optionUi.cardTitle}>能力模块</h3>
        <div className={optionUi.cardBodyDense}>
          <Toggle
            label="沉浸式整页翻译 (Phase 7)"
            value={settings.immersiveEnabled}
            onChange={(v) => onUpdate({ immersiveEnabled: v })}
          />
          <Toggle
            label="PDF 翻译 (Phase 8)"
            value={settings.pdfEnabled}
            onChange={(v) => onUpdate({ pdfEnabled: v })}
          />
          <Toggle
            label="输入框增强 (Phase 9)"
            value={settings.inputEnhanceEnabled}
            onChange={(v) => onUpdate({ inputEnhanceEnabled: v })}
          />
          {settings.inputEnhanceEnabled ? (
            <Toggle
              label="聚焦输入框时自动展开整排快捷按钮（关则只显示「✨ 快捷」小按钮）"
              value={settings.inputEnhanceAutoExpandToolbar}
              onChange={(v) => onUpdate({ inputEnhanceAutoExpandToolbar: v })}
            />
          ) : null}
          <Toggle
            label="网页生词自动高亮（被动复习）"
            value={settings.vocabHighlightEnabled !== false}
            onChange={(v) => onUpdate({ vocabHighlightEnabled: v })}
          />
        </div>
      </div>

      <div className={optionUi.card}>
        <h3 className={optionUi.cardTitle}>数据管理</h3>
        <div className={optionUi.rowInlineActions}>
          <button
            onClick={clearHistory}
            className={optionUi.subtleButton}
          >
            清空历史
          </button>
          <button
            onClick={() => exportVocab("csv")}
            className={optionUi.subtleButton}
          >
            导出生词本 (CSV)
          </button>
          <button
            onClick={() => exportVocab("tsv")}
            className={optionUi.subtleButton}
          >
            导出生词本 (TSV · Anki)
          </button>
        </div>
        {status && <p className={optionUi.cardStatusSuccess}>{status}</p>}
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={optionUi.toggleRow}>
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
