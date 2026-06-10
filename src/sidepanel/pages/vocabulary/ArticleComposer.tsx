import { useEffect, useState } from "react";
import { send } from "@shared/messaging";
import { PolyProse } from "@shared/PolyProse";
import { sideUi } from "../ui";

// 复习短文生成卡片：展示流式生成结果，支持停止 / 保存 / 复制 / 关闭
export function ArticleComposer({
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
