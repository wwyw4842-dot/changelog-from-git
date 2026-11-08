import { useEffect, useState } from "react";
import type { FolioPairingStatus, Settings } from "@shared/types";
import { send } from "@shared/messaging";
import { optionUi } from "./ui";

interface Props {
  settings: Settings;
  onUpdate: (patch: Partial<Settings>) => void | Promise<void>;
}

export function AdvancedSection({ settings, onUpdate }: Props) {
  const [status, setStatus] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [pairing, setPairing] = useState<FolioPairingStatus | null>(null);
  const [pairingCode, setPairingCode] = useState("");
  const [pairingBusy, setPairingBusy] = useState(false);
  const [pairingMessage, setPairingMessage] = useState("");
  const [pairingError, setPairingError] = useState("");

  useEffect(() => {
    void send("vocabulary:pairing:status")
      .then(setPairing)
      .catch(() => setPairing(null));
  }, []);

  const copyExtensionId = async () => {
    if (!pairing?.extensionId) return;
    await navigator.clipboard.writeText(pairing.extensionId);
    setPairingError("");
    setPairingMessage("已复制扩展 ID，可粘贴到 Folio 扉页 → 数据 → Foliole 浏览器插件。");
  };

  const connectFolio = async () => {
    if (!pairingCode.trim() || pairingBusy) return;
    setPairingBusy(true);
    setPairingError("");
    setPairingMessage("");
    try {
      const res = await send("vocabulary:pairing:connect", { pairingCode: pairingCode.trim() });
      setPairing(res.status);
      setPairingCode("");
      if (res.sync.success) {
        setPairingMessage(`已与 Folio 配对并完成实时同步（推送 ${res.sync.pushed} · 拉取 ${res.sync.pulled}）。`);
      } else {
        setPairingError(res.sync.error || "配对码已保存，请确认 Folio 桌面端正在运行后重试同步。");
      }
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : "配对失败");
    } finally {
      setPairingBusy(false);
    }
  };

  const syncNow = async () => {
    setPairingBusy(true);
    setPairingError("");
    setPairingMessage("");
    try {
      const res = await send("vocabulary:sync");
      setPairing(await send("vocabulary:pairing:status"));
      if (res.success) {
        setPairingMessage(`同步成功（推送 ${res.pushed} · 拉取 ${res.pulled}）。`);
      } else {
        setPairingError(res.error || "无法连接 Folio 桌面端");
      }
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : "同步失败");
    } finally {
      setPairingBusy(false);
    }
  };

  const disconnectFolio = async () => {
    setPairingBusy(true);
    setPairingError("");
    try {
      setPairing(await send("vocabulary:pairing:disconnect"));
      setPairingMessage("已断开本机 Folio 配对（本地生词与待同步队列保留）。");
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : "断开失败");
    } finally {
      setPairingBusy(false);
    }
  };

  const clearHistory = async () => {
    await send("history:clear");
    setConfirmingClear(false);
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
      (v.examples || []).map((ex) => `${ex.en} / ${ex.zh}`).join(" | ");
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
    const mime =
      format === "csv" ? "text/csv;charset=utf-8" : "text/tab-separated-values;charset=utf-8";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `foliole-vocabulary-${new Date().toISOString().slice(0, 10)}.${format}`;
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
        <h3 className={optionUi.cardTitle}>Folio 桌面端实时同步</h3>
        <p className={optionUi.cardNote}>
          生词收藏与复习会通过显式配对令牌实时同步到本机 Folio（127.0.0.1:8787），由 Folio 权威 FSRS-6 统一排期。
        </p>
        <div className={optionUi.cardBody}>
          <div className={optionUi.fieldRow}>
            <span className={optionUi.fieldLabel}>当前扩展 ID</span>
            <code className={optionUi.kbd}>{pairing?.extensionId || "读取中…"}</code>
            <button type="button" onClick={copyExtensionId} className={optionUi.subtleButtonSm}>
              复制扩展 ID
            </button>
          </div>
          <div className={optionUi.fieldRow}>
            <span className={optionUi.fieldLabel}>配对状态</span>
            <span className={optionUi.cardTextMuted}>
              {pairing?.paired
                ? `已配对${pairing.boundLibraryId ? `（词库 ${pairing.boundLibraryId.slice(0, 8)}）` : ""}`
                : "未配对"}
            </span>
          </div>
          <div className={optionUi.fieldColumn}>
            <label className={optionUi.fieldLabel} htmlFor="folio-pairing-code-input">
              Folio 配对码
            </label>
            <input
              id="folio-pairing-code-input"
              type="text"
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              placeholder="粘贴 Folio 生成的 foliole1.<扩展ID>.<密钥> 配对码"
              className={optionUi.inputMono}
            />
          </div>
          <div className={optionUi.rowInlineActions}>
            <button
              type="button"
              disabled={pairingBusy || !pairingCode.trim()}
              onClick={connectFolio}
              className={optionUi.subtleButton}
            >
              {pairingBusy ? "连接中…" : pairing?.paired ? "更新配对码并同步" : "连接并同步"}
            </button>
            {pairing?.paired ? (
              <>
                <button
                  type="button"
                  disabled={pairingBusy}
                  onClick={syncNow}
                  className={optionUi.subtleButton}
                >
                  立即同步
                </button>
                <button
                  type="button"
                  disabled={pairingBusy}
                  onClick={disconnectFolio}
                  className={optionUi.dangerButton}
                >
                  断开配对
                </button>
              </>
            ) : null}
          </div>
          {pairingMessage ? <p className={optionUi.cardStatusSuccess}>{pairingMessage}</p> : null}
          {pairingError ? <p className={optionUi.cardTextMuted}>{pairingError}</p> : null}
        </div>
      </div>

      <div className={optionUi.card}>
        <h3 className={optionUi.cardTitle}>阅读与输入辅助</h3>
        <p className={optionUi.cardNote}>只开启你会使用的能力，之后也可以随时回来调整。</p>
        <div className={optionUi.cardBodyDense}>
          <Toggle
            label="整页双语翻译"
            description="在原文附近显示译文，适合连续阅读外刊。"
            value={settings.immersiveEnabled}
            onChange={(v) => onUpdate({ immersiveEnabled: v })}
          />
          <Toggle
            label="PDF 页面翻译"
            description="在浏览器打开 PDF 时提供翻译入口。"
            value={settings.pdfEnabled}
            onChange={(v) => onUpdate({ pdfEnabled: v })}
          />
          <Toggle
            label="输入框写作工具"
            description="在网页输入框旁显示改写、润色等快捷功能。"
            value={settings.inputEnhanceEnabled}
            onChange={(v) => onUpdate({ inputEnhanceEnabled: v })}
          />
          {settings.inputEnhanceEnabled ? (
            <Toggle
              label="自动展开写作工具"
              description="聚焦输入框时直接显示全部按钮；关闭后只显示一个简洁入口。"
              value={settings.inputEnhanceAutoExpandToolbar}
              onChange={(v) => onUpdate({ inputEnhanceAutoExpandToolbar: v })}
            />
          ) : null}
          <Toggle
            label="标出已收藏的生词"
            description="再次在网页中遇到生词时，用轻量标记帮助复习。"
            value={settings.vocabHighlightEnabled !== false}
            onChange={(v) => onUpdate({ vocabHighlightEnabled: v })}
          />
        </div>
      </div>

      <div className={optionUi.card}>
        <h3 className={optionUi.cardTitle}>数据管理</h3>
        <p className={optionUi.cardNote}>导出生词可用于备份或导入 Anki；历史记录只保存在本机。</p>
        <div className={optionUi.rowInlineActions}>
          {confirmingClear ? (
            <div className={optionUi.confirmRow} role="alert">
              <span>确定清空全部翻译历史吗？此操作无法撤销。</span>
              <button type="button" onClick={clearHistory} className={optionUi.dangerButton}>
                确认清空
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className={optionUi.subtleButton}
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStatus("");
                setConfirmingClear(true);
              }}
              className={optionUi.dangerButton}
            >
              清空历史
            </button>
          )}
          <button
            type="button"
            onClick={() => exportVocab("csv")}
            className={optionUi.subtleButton}
          >
            导出 CSV
          </button>
          <button
            type="button"
            onClick={() => exportVocab("tsv")}
            className={optionUi.subtleButton}
          >
            导出 Anki 文件
          </button>
        </div>
        {status && <p className={optionUi.cardStatusSuccess}>{status}</p>}
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={optionUi.toggleRow}>
      <span className={optionUi.toggleCopy}>
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
