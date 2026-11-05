import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Heading ids follow GitHub's slug rules so `page.md#anchor` links in the docs resolve unchanged. */
export function slugify(text: string): string {
  return text
    .replace(/[`*_]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/ /g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const INLINE = /(`[^`]+`)|(\[(?:[^\]`]|`[^`]*`)+\]\([^)]+\))|(\*\*[^*]+\*\*)/g;

function renderTarget(label: ReactNode, target: string, key: number): ReactNode {
  if (/^https?:\/\//.test(target)) return <a key={key} href={target} target="_blank" rel="noreferrer">{label}</a>;
  const [path, hash] = target.split("#");
  // Links to engine source files stay as plain text: the sources are not part of the app.
  if (!/^[\w-]+\.md$/.test(path)) return <Fragment key={key}>{label}</Fragment>;
  return <Link key={key} to={`/guide/${path.replace(/\.md$/, "")}${hash ? `#${hash}` : ""}`}>{label}</Link>;
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<code key={k++}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) {
      const close = m[2].lastIndexOf("](");
      out.push(renderTarget(inline(m[2].slice(1, close)), m[2].slice(close + 2, -1), k++));
    } else out.push(<strong key={k++}>{inline(m[3].slice(2, -2))}</strong>);
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/** Renders the small Markdown subset the engine docs use: headings, paragraphs, lists, tables, inline code, bold and links. */
export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6); // the page title is rendered as h2 inside the panel
      const Tag = `h${level}` as "h2";
      blocks.push(<Tag key={i} id={slugify(heading[2])}>{inline(heading[2])}</Tag>);
      i++;
    } else if (line.trim().startsWith("|") && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={i} className="guide-table">
          <table>
            <thead><tr>{head.map((h, c) => <th key={c}>{inline(h)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
    } else if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(<Tag key={i}>{items.map((t, n) => <li key={n}>{inline(t)}</li>)}</Tag>);
    } else if (line.trim() === "") {
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,6}\s|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={i}>{inline(para.join(" "))}</p>);
    }
  }
  return <>{blocks}</>;
}
