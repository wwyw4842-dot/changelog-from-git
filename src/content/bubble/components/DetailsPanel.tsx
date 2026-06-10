import { UI } from "./ui";

export interface DetailsPanelProps {
  explanation?: string;
  examples?: Array<{ src: string; tgt: string }>;
  partOfSpeech?: Array<{ pos: string; definition: string }>;
  alternatives?: string[];
}

/** 是否有任何深度解读内容（决定底部"详情/收起"按钮与面板是否出现） */
export function hasDeepDetails({
  explanation,
  examples,
  partOfSpeech,
  alternatives,
}: DetailsPanelProps): boolean {
  return Boolean(
    explanation ||
      (examples && examples.length) ||
      (partOfSpeech && partOfSpeech.length) ||
      (alternatives && alternatives.length)
  );
}

/** 深度解读结果展示面板：同义替换 / 解读 / 词性 / 例句 */
export function DetailsPanel({
  explanation,
  examples,
  partOfSpeech,
  alternatives,
}: DetailsPanelProps) {
  return (
    <div className={UI.detailsPanel}>
      {alternatives && alternatives.length > 0 && (
        <section>
          <div className={UI.sectionTitle}>同义替换 / Paraphrase</div>
          <div className={UI.tagsWrap}>
            {alternatives.map((alt, idx) => (
              <span key={idx} className={UI.altTag}>
                {alt}
              </span>
            ))}
          </div>
        </section>
      )}
      {explanation && (
        <section>
          <div className={UI.sectionTitle}>解读</div>
          <p className={UI.explanationText}>{explanation}</p>
        </section>
      )}
      {partOfSpeech && partOfSpeech.length > 0 && (
        <section>
          <div className={UI.sectionTitle}>词性</div>
          <ul className={UI.listTight}>
            {partOfSpeech.map((p, idx) => (
              <li key={idx} className={UI.posItem}>
                <span className={UI.posLabel}>{p.pos}</span>
                <span>{p.definition}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {examples && examples.length > 0 && (
        <section>
          <div className={UI.sectionTitle}>例句</div>
          <ul className={UI.examplesList}>
            {examples.map((ex, idx) => (
              <li key={idx}>
                <div>{ex.src}</div>
                <div className={UI.exampleTgt}>{ex.tgt}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
