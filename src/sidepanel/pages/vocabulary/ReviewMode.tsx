import type { VocabularyEntry, ReviewRating } from "@shared/types";
import { sideUi } from "../ui";

// Folio uses these four recall ratings to calculate FSRS-6 scheduling.
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
  onGrade: (rating: ReviewRating) => void;
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
              { label: "忘记", q: "again", toneClass: sideUi.reviewGradeDangerStrongButton },
              { label: "吃力想起", q: "hard", toneClass: sideUi.reviewGradeWarnButton },
              { label: "正常想起", q: "good", toneClass: sideUi.reviewGradeGoodButton },
              { label: "轻松想起", q: "easy", toneClass: sideUi.reviewGradeBestButton },
            ].map(({ label, q, toneClass }) => (
              <button
                key={q}
                onClick={() => onGrade(q as ReviewRating)}
                className={toneClass}
              >
                {label}
              </button>
            ))}
          </div>
          <p className={sideUi.reviewHint}>
            评分先保存在本机，连接 Folio 后按 FSRS-6 更新排期。
          </p>
        </>
      )}
    </div>
  );
}
