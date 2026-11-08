import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryEntry } from "@shared/types";
import { send } from "@shared/messaging";
import { sideUi } from "./ui";

interface HistoryTabProps {
  onNavigate?: () => void;
}

export function HistoryTab({ onNavigate }: HistoryTabProps) {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [engineFilter, setEngineFilter] = useState<string>("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const refresh = useCallback(async () => {
    const list = await send("history:list", { query: debouncedQuery, limit: 500 });
    setItems(list);
  }, [debouncedQuery]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const engines = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => set.add(item.provider));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(
    () => (engineFilter === "all" ? items : items.filter((item) => item.provider === engineFilter)),
    [items, engineFilter]
  );

  const clearAll = async () => {
    if (!window.confirm("确定清空所有翻译记录吗？此操作无法撤销。")) return;
    await send("history:clear");
    setItems([]);
  };

  const exportJSON = () => {
    download(
      `foliole-history-${stamp()}.json`,
      "application/json",
      JSON.stringify(filtered, null, 2)
    );
  };

  const exportCSV = () => {
    const header = "ts,from,to,provider,original,translation,context";
    const rows = filtered.map((entry) =>
      [
        new Date(entry.ts).toISOString(),
        entry.from,
        entry.to,
        entry.provider,
        entry.originalText,
        entry.translatedText,
        entry.context || "",
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""').replaceAll("\n", " ")}"`)
        .join(",")
    );
    download(
      `foliole-history-${stamp()}.csv`,
      "text/csv;charset=utf-8",
      [header, ...rows].join("\n")
    );
  };

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className={sideUi.pageStack}>
      <div className="foliole-section-heading">
        <div>
          <h1>最近记录</h1>
          <p>共 {filtered.length} 条 · 保留原句，方便回到上下文。</p>
        </div>
        <button type="button" onClick={onNavigate}>
          返回当前
        </button>
      </div>
      <details className="foliole-tools">
        <summary>搜索与导出</summary>
        <div className="space-y-2 p-2 pt-0">
          <div className="foliole-history-filters">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索历史..."
              aria-label="搜索历史"
              className={sideUi.inputFlex1}
            />
            <select
              value={engineFilter}
              onChange={(e) => setEngineFilter(e.target.value)}
              aria-label="筛选翻译引擎"
              className={sideUi.select}
            >
              <option value="all">所有翻译服务</option>
              {engines.map((engine) => (
                <option key={engine} value={engine}>
                  {engine}
                </option>
              ))}
            </select>
          </div>
          <div className={sideUi.historySummaryRow}>
            <span>导出当前 {filtered.length} 条</span>
            <div className={sideUi.actionButtons}>
              <button onClick={exportJSON} className={sideUi.subtleButton}>
                导出 JSON
              </button>
              <button onClick={exportCSV} className={sideUi.subtleButton}>
                导出 CSV
              </button>
              <button onClick={clearAll} className={sideUi.dangerButton}>
                清空
              </button>
            </div>
          </div>
        </div>
      </details>
      {filtered.length === 0 && (
        <div className={sideUi.emptyCard}>暂无历史记录，翻译后会显示在这里。</div>
      )}
      {groups.map(({ day, entries }) => (
        <div key={day} className={sideUi.groupSection}>
          <div className={sideUi.dayGroupTitle}>{day}</div>
          <ul className={sideUi.detailsStack}>
            {entries.map((entry) => (
              <li
                key={entry.id ?? `${entry.ts}-${entry.originalText.slice(0, 8)}`}
                className={sideUi.historyItemCard}
              >
                <div className={sideUi.cardTopRow}>
                  <span>
                    {entry.from} → {entry.to}
                  </span>
                  <span>{new Date(entry.ts).toLocaleTimeString()}</span>
                </div>
                <p className={sideUi.cardBodyText}>{entry.originalText}</p>
                <p className={sideUi.cardBodyStrong}>{entry.translatedText}</p>
                {entry.context && entry.context.trim() !== entry.originalText.trim() && (
                  <blockquote className="foliole-source-quote">{entry.context}</blockquote>
                )}
                <div className={sideUi.cardBottomRow}>
                  <span>翻译服务：{entry.provider}</span>
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(entry.translatedText || "")
                        .catch(() => undefined)
                    }
                    className={sideUi.ghostButton}
                  >
                    复制译文
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function groupByDay(items: HistoryEntry[]): Array<{ day: string; entries: HistoryEntry[] }> {
  const map = new Map<string, HistoryEntry[]>();
  for (const entry of items) {
    const day = new Date(entry.ts).toLocaleDateString();
    const bucket = map.get(day);
    if (bucket) bucket.push(entry);
    else map.set(day, [entry]);
  }
  return Array.from(map.entries()).map(([day, entries]) => ({ day, entries }));
}

function download(filename: string, mime: string, data: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}
