import type { VocabularyEntry } from "./types";

function esc(text: string): string {
  return text.replace(/\t/g, " ").replace(/\n/g, "<br>");
}

/**
 * Converts vocabulary entries to Anki tab-separated import format.
 * Import in Anki: File → Import → select .txt → separator=Tab, HTML enabled.
 * Fields: Front (word) | Back (translation) | Phonetic | Context+Examples | Tags
 */
export function toAnkiTsv(entries: VocabularyEntry[]): string {
  const header = [
    "#separator:tab",
    "#html:true",
    "#columns:Front\tBack\tPhonetic\tContext\tTags",
    "",
  ].join("\n");

  const rows = entries.map((entry) => {
    const front = esc(entry.word);
    const back = esc(entry.translation);
    const phonetic = entry.phonetic ? esc(entry.phonetic) : "";

    const contextLines: string[] = [];
    if (entry.context) contextLines.push(esc(entry.context));
    entry.examples?.forEach((ex) => {
      contextLines.push(`${esc(ex.en)} — ${esc(ex.zh)}`);
    });

    const tags = (entry.tags ?? []).join(" ");
    return [front, back, phonetic, contextLines.join("<br>"), tags].join("\t");
  });

  return header + rows.join("\n");
}

export function downloadAnkiExport(entries: VocabularyEntry[]): void {
  const content = toAnkiTsv(entries);
  const blob = new Blob(["﻿" + content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `polyglot-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
