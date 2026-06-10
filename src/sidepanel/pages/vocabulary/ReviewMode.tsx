import type { VocabularyEntry } from "@shared/types";
import { sideUi } from "../ui";

// 复习卡片模式：先显示单词，点击显示答案后可按 SM-2 质量评级打分
export function ReviewMode({
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
