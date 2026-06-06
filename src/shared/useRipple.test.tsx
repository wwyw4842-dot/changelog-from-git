// useRipple hook 集成测试
// 用 jsdom 环境 + happy-events 模拟 pointerdown，断言 --rx/--ry 被注入到 .poly-ripple 元素上
// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRipple } from "./useRipple";

describe("useRipple 全局 ripple 注入", () => {
  let btn: HTMLButtonElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    btn = document.createElement("button");
    btn.className = "poly-ripple";
    // 给一个固定布局，方便算坐标
    Object.defineProperty(btn, "getBoundingClientRect", {
      value: () => ({ left: 100, top: 100, width: 200, height: 50, right: 300, bottom: 150 }),
    });
    document.body.appendChild(btn);
  });

  it("pointerdown 时把点击位置百分比写入 --rx/--ry", () => {
    renderHook(() => useRipple());

    // 点击坐标 (150, 110) — 元素 (100,100) 200x50
    // rx = (150-100)/200 = 25%; ry = (110-100)/50 = 20%
    const ev = new MouseEvent("pointerdown", {
      bubbles: true,
      composed: true,
      clientX: 150,
      clientY: 110,
    });
    btn.dispatchEvent(ev);

    expect(btn.style.getPropertyValue("--rx")).toMatch(/^25\.00%$/);
    expect(btn.style.getPropertyValue("--ry")).toMatch(/^20\.00%$/);
  });

  it("点击非 ripple 按钮 不写变量", () => {
    renderHook(() => useRipple());

    const other = document.createElement("button");
    other.className = "plain-btn";
    document.body.appendChild(other);
    Object.defineProperty(other, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 100, height: 30, right: 100, bottom: 30 }),
    });

    const ev = new MouseEvent("pointerdown", {
      bubbles: true,
      composed: true,
      clientX: 10,
      clientY: 10,
    });
    other.dispatchEvent(ev);

    expect(other.style.getPropertyValue("--rx")).toBe("");
    expect(other.style.getPropertyValue("--ry")).toBe("");
  });

  it("点击 ripple 内的子元素也能找到外层按钮（composedPath 内层冒泡）", () => {
    renderHook(() => useRipple());

    const inner = document.createElement("span");
    inner.textContent = "label";
    btn.appendChild(inner);
    Object.defineProperty(inner, "getBoundingClientRect", {
      value: () => ({ left: 120, top: 110, width: 50, height: 20, right: 170, bottom: 130 }),
    });

    const ev = new MouseEvent("pointerdown", {
      bubbles: true,
      composed: true,
      clientX: 140,
      clientY: 115,
    });
    inner.dispatchEvent(ev);

    // 仍写入 btn（即外层 .poly-ripple），不是 inner
    expect(btn.style.getPropertyValue("--rx")).not.toBe("");
    expect(btn.style.getPropertyValue("--ry")).not.toBe("");
    expect(inner.style.getPropertyValue("--rx")).toBe("");
  });
});
