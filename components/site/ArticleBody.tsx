import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders an original article body. MD3 type scale rather than a prose plugin,
 * so headings/tables match the rest of the site. Internal links route through
 * next/link; external links open in a new tab and are marked as such.
 */
export function ArticleBody({ markdown }: { markdown: string }) {
  return (
    <div className="flex flex-col gap-4 text-on-surface">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="text-headline-small text-on-surface mt-6 first:mt-0">{children}</h2>
          ),
          h2: ({ children }) => (
            <h2 className="text-title-large text-on-surface mt-6 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-title-medium text-on-surface mt-4">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-body-large leading-relaxed text-on-surface">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 flex flex-col gap-1.5 text-body-large">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 flex flex-col gap-1.5 text-body-large">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 py-1 text-body-large italic text-on-surface-variant">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-outline-variant" />,
          strong: ({ children }) => <strong className="font-medium">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded-xs bg-surface-container-highest px-1.5 py-0.5 text-body-small font-mono">
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-outline-variant">
              <table className="w-full border-collapse text-body-medium">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-surface-container-high text-on-surface">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2 text-label-large border-b border-outline-variant">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 align-top border-b border-outline-variant text-on-surface-variant">
              {children}
            </td>
          ),
          a: ({ href, children }) => {
            const to = href ?? "";
            if (to.startsWith("/")) {
              return (
                <Link href={to} className="text-primary underline underline-offset-2">
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={to}
                target="_blank"
                rel="noreferrer nofollow"
                className="text-primary underline underline-offset-2"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
