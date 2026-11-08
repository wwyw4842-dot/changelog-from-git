import { describe, expect, it } from "vitest";
import {
  mergeLlmCredentials,
  migrateLegacyLlmCredentials,
  remapLegacyLlmModel,
} from "./llm-credentials";

describe("remapLegacyLlmModel", () => {
  it("maps retired DeepSeek Chat/Reasoner names to V4", () => {
    expect(remapLegacyLlmModel("deepseek-chat")).toBe("deepseek-v4-flash");
    expect(remapLegacyLlmModel("deepseek-reasoner")).toBe("deepseek-v4-pro");
  });

  it("leaves current V4 names unchanged", () => {
    expect(remapLegacyLlmModel("deepseek-v4-flash")).toBe("deepseek-v4-flash");
    expect(remapLegacyLlmModel("deepseek-v4-pro")).toBe("deepseek-v4-pro");
  });
});

describe("migrateLegacyLlmCredentials", () => {
  it("rewrites stored DeepSeek Chat/Reasoner model fields", () => {
    const next = migrateLegacyLlmCredentials({
      deepseek: { apiKey: "sk-test", model: "deepseek-chat" },
      "deepseek-reason": { model: "deepseek-reasoner" },
    });
    expect(next.deepseek?.model).toBe("deepseek-v4-flash");
    expect(next["deepseek-reason"]?.model).toBe("deepseek-v4-pro");
    expect(next.deepseek?.apiKey).toBe("sk-test");
  });

  it("returns the same object when nothing needs rewriting", () => {
    const source = { deepseek: { model: "deepseek-v4-flash" } };
    expect(migrateLegacyLlmCredentials(source)).toBe(source);
  });
});

describe("mergeLlmCredentials", () => {
  it("lets deepseek-reason reuse DeepSeek key/base without inheriting Flash model", () => {
    const merged = mergeLlmCredentials("deepseek-reason", {
      deepseek: {
        apiKey: "sk-ds",
        apiBase: "https://api.deepseek.com/v1",
        model: "deepseek-v4-flash",
      },
    });
    expect(merged.apiKey).toBe("sk-ds");
    expect(merged.apiBase).toBe("https://api.deepseek.com/v1");
    expect(merged.model).toBeUndefined();
  });

  it("lets mimo-pro reuse MiMo key/base without inheriting V2.5 model", () => {
    const merged = mergeLlmCredentials("mimo-pro", {
      mimo: {
        apiKey: "sk-mimo",
        apiBase: "https://api.xiaomimimo.com/v1",
        model: "mimo-v2.5",
      },
    });
    expect(merged.apiKey).toBe("sk-mimo");
    expect(merged.apiBase).toBe("https://api.xiaomimimo.com/v1");
    expect(merged.model).toBeUndefined();
  });

  it("allows an alias to override only its own model", () => {
    const merged = mergeLlmCredentials("mimo-pro", {
      mimo: { apiKey: "sk-mimo", model: "mimo-v2.5" },
      "mimo-pro": { model: "mimo-v2.5-pro" },
    });
    expect(merged.apiKey).toBe("sk-mimo");
    expect(merged.model).toBe("mimo-v2.5-pro");
  });

  it("remaps a stored DeepSeek Chat model on the primary engine", () => {
    const merged = mergeLlmCredentials("deepseek", {
      deepseek: { apiKey: "sk-ds", model: "deepseek-chat" },
    });
    expect(merged.model).toBe("deepseek-v4-flash");
  });
});
