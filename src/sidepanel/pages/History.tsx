import { useCallback, useEffect, useMemo, useState } from "react";
import type { HistoryEntry } from "@shared/types";
import { send } from "@shared/messaging";
import { sideUi } from "./ui";

export function HistoryTab() {
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [engineFilter, setEngineFilter] = useState<string>("all");

  const refresh = useCallback(async () => {
    const list = await send("history:list", { query, limit: 500 });
    setItems(list);
  }, [query]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const engines = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => set.add(item.provider));
    return Array.from(set);
  }, [items]);

  const filtered = useMemo(
    () =>
      engineFilter === "all"
        ? items
        : items.filter((item) => item.provider === engineFilter),
    [items, engineFilter]
  );

  const clearAll = async () => {
    await send("history:clear");
    setItems([]);
  };

  const exportJSON = () => {
    download(
      `polyglot-history-${stamp()}.json`,
      "application/json",
      JSON.stringify(filtered, null, 2)
    );
  };

  const exportCSV = () => {
    const header = "ts,from,to,provider,original,translation";
    const rows = filtered.map((entry) =>
      [
        new Date(entry.ts).toISOString(),
        entry.from,
        entry.to,
        entry.provider,
        entry.originalText,
        entry.translatedText,
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""').replaceAll("\n", " ")}"`)
        .join(",")
    );
    download(
      `polyglot-history-${stamp()}.csv`,
      "text/csv;charset=utf-8",
      [header, ...rows].join("\n")
    );
  };

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className={sideUi.pageStack}>
      <div className={sideUi.actionButtons}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索历史..."
          className={sideUi.inputFlex1}
        />
        <select
          value={engineFilter}
          onChange={(e) => setEngineFilter(e.target.value)}
          className={sideUi.select}
        >
          <option value="all">所有引擎</option>
          {engines.map((engine) => (
            <option key={engine} value={engine}>
              {engine}
            </option>
          ))}
        </select>
      </div>
      <div className={sideUi.historySummaryRow}>
        <span>共 {filtered.length} 条</span>
        <div className={sideUi.actionButtons}>
          <button
            onClick={exportJSON}
            className={sideUi.subtleButton}
          >
            JSON
          </button>
          <button
            onClick={exportCSV}
            className={sideUi.subtleButton}
          >
            CSV
          </button>
          <button
            onClick={clearAll}
            className={sideUi.dangerButton}
          >
            清空
          </button>
        </div>
      </div>
      {filtered.length === 0 && (
        <div className={sideUi.emptyCard}>
          暂无历史记录，翻译后会显示在这里。
        </div>
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
                <p className={sideUi.cardBodyText}>
                  {entry.originalText}
                </p>
                <p className={sideUi.cardBodyStrong}>
                  {entry.translatedText}
                </p>
                <div className={sideUi.cardBottomRow}>
                  <span>引擎：{entry.provider}</span>
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
