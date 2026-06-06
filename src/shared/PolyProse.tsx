import { useMemo, type ReactNode } from "react";

/**
 * Polyglot 轻量 markdown 渲染器。
 *
 * - 不引外部依赖，自己写解析。
 * - 块级支持：H1/H2/H3、blockquote、有序/无序列表、任务列表、表格（GFM）、代码块、水平分隔符、段落。
 * - 行内支持：加粗、斜体、行内代码、删除线、链接。
 * - 第一段第一个有意义字符自动 wrap 成 <span class="poly-drop-letter"> 做 drop cap。
 * - 输出 React 元素而非 dangerouslySetInnerHTML，避免 XSS。
 *
 * 容器一般搭 sideUi.prosePanel / prosePanelTall 使用（已自带 .poly-prose 排版规则）。
 */

interface Props {
  content: string;
  className?: string;
  /** 是否启用首字 drop cap，默认 true */
  dropCap?: boolean;
}

type TaskItem = { text: string; checked: boolean };
type TableAlign = "left" | "center" | "right" | null;
type Block =
  | { kind: "h"; level: 1 | 2 | 3; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "task"; items: TaskItem[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "hr" }
  | { kind: "code"; text: string }
  | { kind: "table"; header: string[]; align: TableAlign[]; rows: string[][] };

/** 判断一行是否是表格分隔行：| --- | :---: | ---: | */
function isTableDivider(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith("|") && !t.includes("|")) return false;
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(t);
}

function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

function parseAlign(divider: string): TableAlign[] {
  return splitTableRow(divider).map((c) => {
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // 水平分隔符 --- ___ ***
    if (/^(-{3,}|_{3,}|\*{3,})\s*$/.test(trimmed)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }

    // 标题 # / ## / ###
    const h = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (h) {
      const level = h[1].length as 1 | 2 | 3;
      blocks.push({ kind: "h", level, text: h[2] });
      i += 1;
      continue;
    }

    // 代码块 ``` ... ```
    if (/^```/.test(trimmed)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1; // 跳过结束的 ```
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }

    // 引用 > line（连续多行）
    if (/^>\s?/.test(trimmed)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        q.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", lines: q });
      continue;
    }

    // 任务列表 - [ ] / - [x] （优先于普通无序列表判定）
    if (/^[-*•]\s+\[[ xX]\]\s+/.test(trimmed)) {
      const items: TaskItem[] = [];
      while (i < lines.length && /^[-*•]\s+\[[ xX]\]\s+/.test(lines[i].trim())) {
        const m = /^[-*•]\s+\[([ xX])\]\s+(.*)$/.exec(lines[i].trim());
        if (m) items.push({ checked: m[1].toLowerCase() === "x", text: m[2] });
        i += 1;
      }
      blocks.push({ kind: "task", items });
      continue;
    }

    // 无序列表 - / * / •
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (
        i < lines.length &&
        /^[-*•]\s+/.test(lines[i].trim()) &&
        !/^[-*•]\s+\[[ xX]\]\s+/.test(lines[i].trim())
      ) {
        items.push(lines[i].trim().replace(/^[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // 有序列表 1. / 2.
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // 表格：当前行含 |，且下一行是分隔符
    if (trimmed.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const header = splitTableRow(trimmed);
      const align = parseAlign(lines[i + 1].trim());
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes("|")) {
        const r = lines[i].trim();
        if (!r) break;
        rows.push(splitTableRow(r));
        i += 1;
      }
      blocks.push({ kind: "table", header, align, rows });
      continue;
    }

    // 段落：连续多行合并（用空格连接），遇到空行或新块结束
    const paragraph: string[] = [trimmed];
    i += 1;
    while (i < lines.length) {
      const next = lines[i];
      const nt = next.trim();
      if (!nt) break;
      if (/^(#{1,3}|>\s?|[-*•]\s+|\d+\.\s+|`{3}|-{3,}|_{3,}|\*{3,})/.test(nt)) break;
      // 段落中也避免和表格判定冲突
      if (nt.includes("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) break;
      paragraph.push(nt);
      i += 1;
    }
    blocks.push({ kind: "p", text: paragraph.join(" ") });
  }

  return blocks;
}

/** 内联解析：把 `code` / **bold** / *italic* / _italic_ / ~~del~~ / [text](url) 渲染成 React 元素 */
function renderInline(text: string, keyPrefix = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  // 顺序：行内代码 → 链接 → 加粗 → 斜体 → 删除线
  const re = /(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+(?:\s+"[^"]*")?\))|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(~~[^~\n]+~~)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      out.push(text.slice(last, m.index));
    }
    const tok = m[0];
    const key = `${keyPrefix}-${k++}`;
    if (tok.startsWith("`")) {
      out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("[")) {
      const lm = /^\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/.exec(tok);
      if (lm) {
        const [, label, href, title] = lm;
        // 链接安全：仅允许 http(s)/mailto/相对 路径，避免 javascript:
        const safe = /^(https?:|mailto:|\/|#)/i.test(href) ? href : "#";
        out.push(
          <a key={key} href={safe} title={title} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        );
      } else {
        out.push(tok);
      }
    } else if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("~~")) {
      out.push(<del key={key}>{tok.slice(2, -2)}</del>);
    } else {
      out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** 在节点列表的第一个文本里，把首个非空白/非标点字符 wrap 成 poly-drop-letter */
function injectDropCap(nodes: ReactNode[]): ReactNode[] {
  for (let idx = 0; idx < nodes.length; idx += 1) {
    const n = nodes[idx];
    if (typeof n !== "string") continue;
    const m = /^([\s\p{P}\p{S}]*)(\p{L}|\p{N}|[一-鿿])([\s\S]*)$/u.exec(n);
    if (!m) continue;
    const [, lead, letter, rest] = m;
    const out = nodes.slice();
    out.splice(
      idx,
      1,
      lead || null,
      <span key="dropcap" className="poly-drop-letter">
        {letter}
      </span>,
      rest
    );
    return out.filter((v) => v !== null);
  }
  return nodes;
}

function alignToStyle(a: TableAlign): React.CSSProperties | undefined {
  if (!a) return undefined;
  return { textAlign: a };
}

export function PolyProse({ content, className = "", dropCap = true }: Props) {
  const blocks = useMemo(() => parseBlocks(content || ""), [content]);

  const children: ReactNode[] = [];
  let dropApplied = !dropCap;
  blocks.forEach((b, bi) => {
    switch (b.kind) {
      case "hr":
        children.push(<hr key={`b-${bi}`} />);
        break;
      case "h":
        if (b.level === 1)
          children.push(<h1 key={`b-${bi}`}>{renderInline(b.text, `b-${bi}`)}</h1>);
        else if (b.level === 2)
          children.push(<h2 key={`b-${bi}`}>{renderInline(b.text, `b-${bi}`)}</h2>);
        else
          children.push(<h3 key={`b-${bi}`}>{renderInline(b.text, `b-${bi}`)}</h3>);
        break;
      case "p": {
        let inline = renderInline(b.text, `b-${bi}`);
        if (!dropApplied) {
          inline = injectDropCap(inline);
          dropApplied = true;
        }
        children.push(<p key={`b-${bi}`}>{inline}</p>);
        break;
      }
      case "ul":
        children.push(
          <ul key={`b-${bi}`}>
            {b.items.map((t, ii) => (
              <li key={`b-${bi}-${ii}`}>{renderInline(t, `b-${bi}-${ii}`)}</li>
            ))}
          </ul>
        );
        break;
      case "ol":
        children.push(
          <ol key={`b-${bi}`}>
            {b.items.map((t, ii) => (
              <li key={`b-${bi}-${ii}`}>{renderInline(t, `b-${bi}-${ii}`)}</li>
            ))}
          </ol>
        );
        break;
      case "task":
        children.push(
          <ul key={`b-${bi}`} className="poly-prose-tasklist">
            {b.items.map((it, ii) => (
              <li key={`b-${bi}-${ii}`} className={it.checked ? "poly-task-checked" : "poly-task-open"}>
                <input type="checkbox" checked={it.checked} readOnly tabIndex={-1} />
                <span>{renderInline(it.text, `b-${bi}-${ii}`)}</span>
              </li>
            ))}
          </ul>
        );
        break;
      case "quote":
        children.push(
          <blockquote key={`b-${bi}`}>
            {b.lines.map((t, ii) => (
              <p key={`b-${bi}-${ii}`} style={{ margin: ii === 0 ? "0" : "0.4em 0 0 0" }}>
                {renderInline(t, `b-${bi}-${ii}`)}
              </p>
            ))}
          </blockquote>
        );
        break;
      case "code":
        children.push(
          <pre key={`b-${bi}`}>
            <code>{b.text}</code>
          </pre>
        );
        break;
      case "table":
        children.push(
          <div key={`b-${bi}`} className="poly-prose-table-wrap">
            <table className="poly-prose-table">
              <thead>
                <tr>
                  {b.header.map((cell, ci) => (
                    <th key={`h-${ci}`} style={alignToStyle(b.align[ci] ?? null)}>
                      {renderInline(cell, `b-${bi}-h-${ci}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.rows.map((row, ri) => (
                  <tr key={`r-${ri}`}>
                    {row.map((cell, ci) => (
                      <td key={`c-${ci}`} style={alignToStyle(b.align[ci] ?? null)}>
                        {renderInline(cell, `b-${bi}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        break;
    }
  });

  return <div className={className}>{children}</div>;
}
