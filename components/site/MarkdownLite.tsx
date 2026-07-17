import Link from "next/link";
import type { ReactNode } from "react";

/** Render inline markdown: [text](url) links and **bold**. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      const label = m[1];
      const href = m[2];
      const key = `${keyPrefix}-${k}`;
      nodes.push(
        href.startsWith("/") ? (
          <Link key={key} href={href} className="text-primary hover:underline">
            {label}
          </Link>
        ) : (
          <a key={key} href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {label}
          </a>
        ),
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-${k}`} className="font-medium">
          {m[3]}
        </strong>,
      );
    }
    last = re.lastIndex;
    k++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Minimal markdown: paragraphs, bullet lists, links, and bold. */
export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: ReactNode[] = [];

  const flush = (key: string) => {
    if (list.length) {
      blocks.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 flex flex-col gap-1">
          {list}
        </ul>,
      );
      list = [];
    }
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    if (/^[-*]\s+/.test(t)) {
      list.push(<li key={`li-${i}`}>{renderInline(t.replace(/^[-*]\s+/, ""), `li-${i}`)}</li>);
    } else {
      flush(String(i));
      if (t) blocks.push(<p key={`p-${i}`}>{renderInline(t, `p-${i}`)}</p>);
    }
  });
  flush("end");

  return <div className="flex flex-col gap-2">{blocks}</div>;
}
