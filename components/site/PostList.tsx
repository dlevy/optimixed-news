import Link from "next/link";
import { Icon } from "@/components/md/Icon";
import { ExclusiveBadge } from "@/components/site/ExclusiveBadge";
import { timeAgo } from "@/lib/format";
import type { PostWithRefs } from "@/lib/types";

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Hacker-News-inspired dense list, expressed in MD3:
 * ranked rows, title, source domain, then a muted meta line + short TLDR.
 */
export function PostList({
  posts,
  startIndex = 0,
  emptyLabel = "No articles yet.",
}: {
  posts: PostWithRefs[];
  startIndex?: number;
  emptyLabel?: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
        <Icon name="inbox" className="text-[40px] text-on-surface-variant" />
        <p className="mt-2 text-body-large text-on-surface-variant">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-outline-variant">
      {posts.map((post, i) => {
        const exclusive = post.origin === "internal";
        const domain = hostname(post.url);
        return (
          <li key={post.id} className="flex gap-3 py-3">
            <span className="w-7 shrink-0 pt-0.5 text-right text-title-medium text-on-surface-variant tabular-nums">
              {startIndex + i + 1}.
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-x-2 flex-wrap">
                {exclusive && <ExclusiveBadge size="small" className="self-center" />}
                <Link
                  href={`/article/${post.slug}`}
                  className="text-title-medium text-on-surface hover:text-primary"
                >
                  {post.title}
                </Link>
                {!exclusive && domain && post.source && (
                  <Link
                    href={`/source/${post.source.slug}`}
                    className="text-body-small text-on-surface-variant hover:text-primary"
                  >
                    ({domain})
                  </Link>
                )}
              </div>

              <div className="mt-0.5 flex items-center gap-2 flex-wrap text-body-small text-on-surface-variant">
                {post.published_at && (
                  <time dateTime={post.published_at}>{timeAgo(post.published_at)}</time>
                )}
                {post.category && (
                  <>
                    <span aria-hidden>·</span>
                    <Link href={`/?cats=${post.category.slug}`} className="hover:text-primary">
                      {post.category.name}
                    </Link>
                  </>
                )}
                {!exclusive && (
                  <>
                    <span aria-hidden>·</span>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-primary inline-flex items-center gap-0.5"
                    >
                      source
                      <Icon name="open_in_new" className="text-[14px]" />
                    </a>
                  </>
                )}
              </div>

              {(post.dek ?? post.tldr) && (
                <p className="mt-1 text-body-small text-on-surface-variant line-clamp-2">
                  {post.dek ?? post.tldr}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
