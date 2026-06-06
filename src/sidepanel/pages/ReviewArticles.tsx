import { useEffect, useState } from "react";
import { send } from "@shared/messaging";
import type { ReviewArticleEntry } from "@shared/types";
import { PolyProse } from "@shared/PolyProse";
import { sideUi } from "./ui";

export function ReviewArticlesTab() {
  const [items, setItems] = useState<ReviewArticleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await send("reviewArticle:list", { limit: 300 });
      setItems(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const removeItem = async (id?: number) => {
    if (!id) return;
    await send("reviewArticle:remove", { id });
    setItems((list) => list.filter((x) => x.id !== id));
  };

  if (loading) {
    return <div className={sideUi.loadingText}>加载中...</div>;
  }

  if (!items.length) {
    return (
      <div className={sideUi.emptyCard}>
        暂无复习文章。去生词本生成后点击“保存”即可。
      </div>
    );
  }

  return (
    <div className={sideUi.pageStack}>
      {items.map((item) => (
        <section key={item.id} className={sideUi.cardCompact}>
          <header className={sideUi.panelHeader}>
            <div>
              <div className={sideUi.dayTitleBrand}>{item.dayLabel}</div>
              <div className={sideUi.bodyMuted}>
                {new Date(item.createdAt).toLocaleString()} · 引擎：{item.provider}
              </div>
            </div>
            <div className={sideUi.tinyMetaRow}>
              <button
                onClick={() => navigator.clipboard.writeText(item.content).catch(() => undefined)}
                className={sideUi.ghostButton}
              >
                复制
              </button>
              <button onClick={() => void removeItem(item.id)} className={sideUi.dangerButton}>
                删除
              </button>
            </div>
          </header>
          {item.words?.length > 0 && (
            <p className={sideUi.metaText}>词汇：{item.words.join(" / ")}</p>
          )}
          <PolyProse
            content={item.content}
            className={sideUi.prosePanel}
          />
        </section>
      ))}
    </div>
  );
}
