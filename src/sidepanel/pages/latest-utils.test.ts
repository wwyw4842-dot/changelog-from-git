import { describe, expect, it } from "vitest";
import { chooseRetryProvider, hasDeepDetails, mergeDeepDetails } from "./latest-utils";

describe("latest result actions", () => {
  it("retry picks the first configured provider that differs from the current one", () => {
    const settings = {
      primaryProvider: "google",
      fallbackChain: ["google", "bing", "mymemory"],
      deepProvider: "deepseek",
    };

    expect(chooseRetryProvider(settings, "google")).toBe("bing");
    expect(chooseRetryProvider(settings, "bing")).toBe("google");
  });

  it("detects structured deep translation content", () => {
    expect(hasDeepDetails({ explanation: "语境说明" })).toBe(true);
    expect(hasDeepDetails({ alternatives: ["", "store"] })).toBe(true);
    expect(hasDeepDetails({ translatedText: "普通译文" })).toBe(false);
  });

  it("merges deep fields without replacing the quick result metadata", () => {
    const current = {
      originalText: "sequester",
      translatedText: "吸收（碳）",
      provider: "google",
      from: "en",
      to: "zh-CN",
      context: "Forests sequester carbon.",
      ts: 123,
    };
    const merged = mergeDeepDetails(current, {
      originalText: "sequester",
      translatedText: "截存",
      provider: "deepseek",
      explanation: "在气候语境中表示长期储存。",
      alternatives: ["store", "absorb"],
    });

    expect(merged.translatedText).toBe("吸收（碳）");
    expect(merged.provider).toBe("google");
    expect(merged.context).toBe("Forests sequester carbon.");
    expect(merged.explanation).toContain("长期储存");
  });
});
