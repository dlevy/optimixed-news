import Link from "next/link";
import { Card } from "@/components/md/Card";
import { Chip } from "@/components/md/Chip";
import { Icon } from "@/components/md/Icon";
import { Thumbnail } from "@/components/site/Thumbnail";
import { ArticleBadges } from "@/components/site/ArticleBadges";
import { ExclusiveBadge } from "@/components/site/ExclusiveBadge";
import { timeAgo } from "@/lib/format";
import { clsx } from "@/lib/clsx";
import type { PostWithRefs } from "@/lib/types";

export function PostCard({ post }: { post: PostWithRefs }) {
  const exclusive = post.origin === "internal";

  return (
    <Card
      variant="elevated"
      className={clsx(
        "flex flex-col h-full transition-shadow hover:shadow-e3",
        exclusive && "ring-2 ring-tertiary",
      )}
    >
      <div className="p-5 flex flex-col gap-3 flex-1">
        {exclusive && <ExclusiveBadge size="small" className="self-start" />}

        <div className="flex items-center gap-2 text-label-medium text-on-surface-variant">
          <Icon name={exclusive ? "hub" : "newsmode"} className="text-[18px]" />
          {post.source ? (
            <Link href={`/source/${post.source.slug}`} className="hover:text-primary">
              {post.source.name}
            </Link>
          ) : (
            "Unknown source"
          )}
          {post.published_at && (
            <>
              <span aria-hidden>·</span>
              <time dateTime={post.published_at}>{timeAgo(post.published_at)}</time>
            </>
          )}
        </div>

        <div className="flex items-start gap-3">
          <h2 className="text-title-large text-on-surface text-balance flex-1">
            <Link href={`/article/${post.slug}`} className="hover:text-primary">
              {post.title}
            </Link>
          </h2>
          <Link href={`/article/${post.slug}`} className="shrink-0" aria-hidden tabIndex={-1}>
            <Thumbnail src={post.thumbnail_url} className="size-20 rounded-lg" />
          </Link>
        </div>

        {(post.dek ?? post.tldr) && (
          <p className="text-body-medium text-on-surface-variant line-clamp-3">
            {post.dek ?? post.tldr}
          </p>
        )}

        <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
          {post.category && (
            <Chip href={`/?cats=${post.category.slug}`}>{post.category.name}</Chip>
          )}
          <ArticleBadges post={post} compact />
        </div>
      </div>
    </Card>
  );
}
