import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt, parseDeep } from "./prompt";

describe("LLM prompt", () => {
  it("quick prompt asks for plain translation", () => {
    const prompt = buildSystemPrompt("quick");
    expect(prompt.toLowerCase()).toContain("only the translated text");
  });

  it("deep prompt asks for JSON", () => {
    const prompt = buildSystemPrompt("deep");
    expect(prompt).toContain("translatedText");
    expect(prompt).toContain("examples");
  });

  it("user prompt includes source and target langs", () => {
    const prompt = buildUserPrompt({ text: "hello", from: "en", to: "zh-CN", mode: "quick" });
    expect(prompt).toContain("en");
    expect(prompt).toContain("zh-CN");
    expect(prompt).toContain("hello");
  });

  it("parseDeep extracts JSON payload", () => {
    const raw = `Sure! {"translatedText":"你好","phonetic":"həˈloʊ","examples":[]}`;
    const parsed = parseDeep(raw);
    expect(parsed.translatedText).toBe("你好");
    expect(parsed.phonetic).toBe("həˈloʊ");
  });

  it("parseDeep falls back to raw string on non-JSON", () => {
    const parsed = parseDeep("plain text");
    expect(parsed.translatedText).toBe("plain text");
  });
});
