import { describe, it, expect } from "vitest";
import { mapLang } from "./lang-mapper";

describe("mapLang 各引擎语言码映射", () => {
  it("中文按引擎差异映射", () => {
    expect(mapLang("bing", "zh-CN")).toBe("zh-Hans");
    expect(mapLang("bing", "zh-TW")).toBe("zh-Hant");
    expect(mapLang("google", "zh")).toBe("zh-CN");
    expect(mapLang("google", "zh-TW")).toBe("zh-TW");
    expect(mapLang("deepl", "zh-CN")).toBe("ZH");
    expect(mapLang("volcano", "zh-CN")).toBe("zh");
    expect(mapLang("volcano", "zh-TW")).toBe("zh-Hant");
  });

  it("大小写不敏感", () => {
    expect(mapLang("bing", "ZH-CN")).toBe("zh-Hans");
    expect(mapLang("deepl", "EN")).toBe("EN");
  });

  it("未列出的语言取主标签；DeepL 大写其余小写", () => {
    expect(mapLang("google", "en-US")).toBe("en");
    expect(mapLang("bing", "ja")).toBe("ja");
    expect(mapLang("deepl", "ja")).toBe("JA");
    expect(mapLang("volcano", "ko-KR")).toBe("ko");
  });
});
