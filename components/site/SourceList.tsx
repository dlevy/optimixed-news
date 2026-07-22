import { Icon } from "@/components/md/Icon";
import { formatDate } from "@/lib/format";
import type { PostSource } from "@/lib/types";

const ROLE_LABEL: Record<string, string> = {
  primary: "Primary source",
  secondary: "Reporting",
  analysis: "Analysis",
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Full attribution for an original article: every source consulted, grouped by
 * role, with uploaded evidence (tweet/post screenshots) shown inline.
 */
export function SourceList({ sources }: { sources: PostSource[] }) {
  if (sources.length === 0) return null;

  return (
    <section className="border-t border-outline-variant pt-6">
      <h2 className="text-title-large text-on-surface flex items-center gap-2">
        <Icon name="fact_check" className="text-[22px] text-on-surface-variant" />
        Sources
      </h2>
      <p className="mt-1 text-body-small text-on-surface-variant">
        This article was researched and written by Optimixed using the sources below.
      </p>

      <ol className="mt-4 flex flex-col gap-3">
        {sources.map((s) => (
          <li
            key={s.id}
            className="rounded-lg border border-outline-variant bg-surface-container-low p-4 flex gap-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-label-small text-on-surface-variant">
                <span className="px-2 py-0.5 rounded-sm bg-surface-container-highest">
                  {ROLE_LABEL[s.role] ?? "Source"}
                </span>
                {s.publisher && <span>{s.publisher}</span>}
                {s.published_at && (
                  <>
                    <span aria-hidden>·</span>
                    <time dateTime={s.published_at}>{formatDate(s.published_at)}</time>
                  </>
                )}
              </div>

              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block text-title-small text-on-surface hover:text-primary"
                >
                  {s.title || hostname(s.url)}
                  <Icon name="open_in_new" className="ml-1 text-[14px] align-middle" />
                </a>
              ) : (
                <p className="mt-1 text-title-small text-on-surface">{s.title || "Source"}</p>
              )}

              {s.note && (
                <p className="mt-1 text-body-small text-on-surface-variant line-clamp-3">{s.note}</p>
              )}
            </div>

            {s.kind === "screenshot" && s.image_url && (
              <a
                href={s.image_url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0"
                aria-label="View full screenshot"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.image_url}
                  alt={s.title ? `Screenshot: ${s.title}` : "Source screenshot"}
                  className="size-24 rounded-lg object-cover border border-outline-variant"
                />
              </a>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
