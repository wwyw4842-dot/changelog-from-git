import { describe, it, expect } from "vitest";
import { toAnkiTsv } from "./anki-export";
import type { VocabularyEntry } from "./types";

const base: VocabularyEntry = {
  word: "ephemeral",
  translation: "短暂的；转瞬即逝的",
  phonetic: "/ɪˈfem.ər.əl/",
  context: "The ephemeral beauty of cherry blossoms.",
  examples: [
    { en: "Fame can be ephemeral.", zh: "名声可以是短暂的。" },
  ],
  addedAt: 0,
  nextReviewAt: 0,
  easeFactor: 2.5,
  interval: 0,
  reps: 0,
  lapses: 0,
  tags: ["adjective"],
};

describe("toAnkiTsv", () => {
  it("outputs header lines and one row per entry", () => {
    const tsv = toAnkiTsv([base]);
    expect(tsv).toContain("#separator:tab");
    expect(tsv).toContain("#html:true");
    const rows = tsv.split("\n").filter((l) => !l.startsWith("#") && l.trim());
    expect(rows).toHaveLength(1);
  });

  it("row has 5 tab-separated fields", () => {
    const tsv = toAnkiTsv([base]);
    const dataRow = tsv.split("\n").find((l) => l.startsWith("ephemeral"))!;
    const fields = dataRow.split("\t");
    expect(fields).toHaveLength(5);
    expect(fields[0]).toBe("ephemeral");
    expect(fields[1]).toBe("短暂的；转瞬即逝的");
    expect(fields[2]).toBe("/ɪˈfem.ər.əl/");
    expect(fields[4]).toBe("adjective");
  });

  it("context and examples joined with <br>", () => {
    const tsv = toAnkiTsv([base]);
    const dataRow = tsv.split("\n").find((l) => l.startsWith("ephemeral"))!;
    const context = dataRow.split("\t")[3];
    expect(context).toContain("<br>");
    expect(context).toContain("Fame can be ephemeral.");
  });

  it("tabs inside fields are replaced with spaces", () => {
    const entry: VocabularyEntry = { ...base, word: "tab\there" };
    const tsv = toAnkiTsv([entry]);
    const dataRow = tsv.split("\n").find((l) => !l.startsWith("#") && l.trim())!;
    expect(dataRow.split("\t")[0]).toBe("tab here");
  });
});
