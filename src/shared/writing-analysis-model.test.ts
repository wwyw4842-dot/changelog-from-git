import { describe, expect, it } from "vitest";
import {
  WRITING_ANALYSIS_DIMENSIONS,
  buildWritingAnalysisSystemPrompt,
  formatDimensionsForPrompt,
} from "./writing-analysis-model";

describe("writing analysis model", () => {
  it("defines eight stable dimensions", () => {
    expect(WRITING_ANALYSIS_DIMENSIONS).toHaveLength(8);
    const ids = new Set(WRITING_ANALYSIS_DIMENSIONS.map((d) => d.id));
    expect(ids.size).toBe(8);
  });

  it("embeds all dimension names in prompt text", () => {
    const prompt = buildWritingAnalysisSystemPrompt({
      genreLabel: "测试",
      targetBand: "7.0",
      hasExternalPrompt: true,
    });
    for (const d of WRITING_ANALYSIS_DIMENSIONS) {
      expect(prompt).toContain(d.nameZh);
    }
    expect(prompt).toContain("## 总览");
    expect(prompt).toContain("## 多维评分卡");
  });

  it("formatDimensionsForPrompt is non-empty", () => {
    const s = formatDimensionsForPrompt();
    expect(s.length).toBeGreaterThan(200);
    expect(s).toContain("任务契合");
  });
});
