import { describe, expect, it } from "vitest";
import { mapChromeRuntimeError } from "./chrome-runtime-error";

describe("mapChromeRuntimeError", () => {
  it.each([
    "Extension context invalidated.",
    "Cannot read properties of undefined (reading 'sendMessage')",
    "Cannot read properties of null (reading 'connect')",
  ])("将运行时失效错误转为刷新提示：%s", (message) => {
    expect(mapChromeRuntimeError(new TypeError(message)).message).toBe(
      "扩展已更新，请刷新本页后再翻译。"
    );
  });

  it.each([
    "Could not establish connection. Receiving end does not exist.",
    "The message port closed before a response was received.",
  ])("将无接收端错误转为后台连接提示：%s", (message) => {
    expect(mapChromeRuntimeError(new Error(message)).message).toBe(
      "无法连接扩展后台，请刷新本页或确认扩展已启用。"
    );
  });

  it("保留其他错误", () => {
    const original = new Error("provider failed");
    expect(mapChromeRuntimeError(original)).toBe(original);
  });
});
