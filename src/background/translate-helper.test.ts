import { describe, expect, it } from "vitest";
import { withFinalLocalFallback } from "./translate-helper";

describe("withFinalLocalFallback", () => {
  it("appends Ollama for old settings that do not contain a local fallback", () => {
    expect(withFinalLocalFallback("google", ["google", "bing", "mymemory"])).toEqual([
      "bing",
      "mymemory",
      "ollama",
    ]);
  });

  it("keeps Ollama unique and last even when the user listed it earlier", () => {
    expect(withFinalLocalFallback("google", ["ollama", "bing", "ollama", "bing"])).toEqual([
      "bing",
      "ollama",
    ]);
  });

  it("does not append Ollama twice when it is the primary provider", () => {
    expect(withFinalLocalFallback("ollama", ["google", "ollama", "bing"])).toEqual([
      "google",
      "bing",
    ]);
  });
});
