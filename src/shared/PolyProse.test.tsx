// PolyProse 渲染测试：用 react-dom/server 直接序列化成 HTML 字符串再断言
// 不依赖 jsdom / @testing-library，最大兼容 vitest 默认 node 环境
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PolyProse } from "./PolyProse";

function html(content: string) {
  return renderToStaticMarkup(<PolyProse content={content} dropCap={false} />);
}

function htmlWithDrop(content: string) {
  return renderToStaticMarkup(<PolyProse content={content} dropCap={true} />);
}

describe("PolyProse markdown 解析", () => {
  it("渲染 H1/H2/H3 标题", () => {
    const out = html("# 一级\n## 二级\n### 三级\n");
    expect(out).toContain("<h1>一级</h1>");
    expect(out).toContain("<h2>二级</h2>");
    expect(out).toContain("<h3>三级</h3>");
  });

  it("段落合并连续多行（空格连接）", () => {
    const out = html("第一行\n第二行\n第三行");
    expect(out).toContain("<p>第一行 第二行 第三行</p>");
  });

  it("无序列表", () => {
    const out = html("- 苹果\n- 香蕉\n- 梨");
    expect(out).toMatch(/<ul><li>苹果<\/li><li>香蕉<\/li><li>梨<\/li><\/ul>/);
  });

  it("有序列表", () => {
    const out = html("1. 起\n2. 承\n3. 转");
    expect(out).toMatch(/<ol><li>起<\/li><li>承<\/li><li>转<\/li><\/ol>/);
  });

  it("行内 bold / italic / code", () => {
    const out = html("这是 **重点** 和 *强调* 和 `code`。");
    expect(out).toContain("<strong>重点</strong>");
    expect(out).toContain("<em>强调</em>");
    expect(out).toContain("<code>code</code>");
  });

  it("代码块", () => {
    const out = html("```\nconst x = 1;\nconsole.log(x);\n```");
    expect(out).toContain("<pre><code>const x = 1;\nconsole.log(x);</code></pre>");
  });

  it("blockquote 引用", () => {
    const out = html("> 一句\n> 又一句");
    expect(out).toContain("<blockquote>");
    expect(out).toContain("一句");
    expect(out).toContain("又一句");
  });

  it("hr 水平分隔符", () => {
    expect(html("---")).toContain("<hr/>");
    expect(html("***")).toContain("<hr/>");
    expect(html("___")).toContain("<hr/>");
  });

  it("链接 [text](url)，安全过滤 javascript:", () => {
    const safe = html("访问 [Polyglot](https://example.com) 站点");
    expect(safe).toContain('href="https://example.com"');
    expect(safe).toContain("Polyglot");
    expect(safe).toContain('target="_blank"');
    expect(safe).toContain('rel="noopener noreferrer"');

    const unsafe = html("[bad](javascript:alert(1))");
    expect(unsafe).toContain('href="#"');
    expect(unsafe).not.toContain("javascript:");
  });

  it("删除线 ~~text~~", () => {
    const out = html("~~删了~~ 留下");
    expect(out).toContain("<del>删了</del>");
  });

  it("任务列表 - [ ] / - [x]", () => {
    const out = html("- [x] 完成\n- [ ] 待办");
    expect(out).toContain("poly-prose-tasklist");
    expect(out).toContain("poly-task-checked");
    expect(out).toContain("poly-task-open");
    expect(out).toMatch(/<input[^>]+checked[^>]*\/?>/);
  });

  it("GFM 表格（含对齐）", () => {
    const out = html("| 名称 | 数量 | 价格 |\n| :--- | :---: | ---: |\n| 苹果 | 3 | 9.9 |\n| 梨 | 5 | 12.0 |");
    expect(out).toContain("<table");
    expect(out).toContain("poly-prose-table");
    expect(out).toContain("<th");
    expect(out).toContain("名称");
    expect(out).toMatch(/text-align:left/);
    expect(out).toMatch(/text-align:center/);
    expect(out).toMatch(/text-align:right/);
    expect(out).toContain("苹果");
    expect(out).toContain("12.0");
  });

  it("dropCap=true：首段首字符 wrap 成 poly-drop-letter", () => {
    const out = htmlWithDrop("Polyglot 是一个翻译扩展。\n\n第二段。");
    expect(out).toContain('class="poly-drop-letter"');
    // 首字符 P 被切走，剩下应该是 "olyglot 是一个..."
    expect(out).toContain(">P</span>");
  });

  it("dropCap 跳过前导空白与标点", () => {
    const out = htmlWithDrop("  「你好」世界。");
    // 首字符应是 "你"，不是空格也不是 「
    expect(out).toContain(">你</span>");
  });

  it("dropCap=true 但只对第一段生效，第二段保持普通", () => {
    const out = htmlWithDrop("First paragraph.\n\nSecond paragraph.");
    const occurrences = (out.match(/poly-drop-letter/g) || []).length;
    expect(occurrences).toBe(1);
  });
});
