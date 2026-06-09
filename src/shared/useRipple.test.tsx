// useRipple hook 集成测试
// 用 jsdom 环境 + happy-events 模拟 pointerdown，断言 --rx/--ry 被注入到 .poly-ripple 元素上
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { useRipple } from "./useRipple";

function Fixture() {
  useRipple();
  return null;
}

describe("useRipple 全局 ripple 注入", () => {
  let btn: HTMLButtonElement;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    document.body.innerHTML = "";
    container = document.createElement("div");
    document.body.appendChild(container);

    btn = document.createElement("button");
    btn.className = "poly-ripple";
    Object.defineProperty(btn, "getBoundingClientRect", {
      value: () => ({ left: 100, top: 100, width: 200, height: 50, right: 300, bottom: 150 }),
    });
    document.body.appendChild(btn);

    root = createRoot(container);
    act(() => {
      root.render(createElement(Fixture));
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
  });

  it("pointerdown 时把点击位置百分比写入 --rx/--ry", () => {
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

    expect(btn.style.getPropertyValue("--rx")).not.toBe("");
    expect(btn.style.getPropertyValue("--ry")).not.toBe("");
    expect(inner.style.getPropertyValue("--rx")).toBe("");
  });
});
