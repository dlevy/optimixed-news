import Link from "next/link";
import { Card } from "@/components/md/Card";
import { Chip } from "@/components/md/Chip";
import { Icon } from "@/components/md/Icon";
import { timeAgo } from "@/lib/format";
import type { PostWithRefs } from "@/lib/types";

export function PostCard({ post }: { post: PostWithRefs }) {
  return (
    <Card variant="elevated" className="flex flex-col h-full transition-shadow hover:shadow-e3">
      {post.image_url && (
        <Link href={`/article/${post.slug}`} className="block aspect-video overflow-hidden bg-surface-container-high">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.image_url}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </Link>
      )}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2 text-label-medium text-on-surface-variant">
          <Icon name="newsmode" className="text-[18px]" />
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

        <h2 className="text-title-large text-on-surface text-balance">
          <Link href={`/article/${post.slug}`} className="hover:text-primary">
            {post.title}
          </Link>
        </h2>

        {post.tldr && (
          <p className="text-body-medium text-on-surface-variant line-clamp-4">{post.tldr}</p>
        )}

        {post.category && (
          <div className="mt-auto pt-2">
            <Chip href={`/category/${post.category.slug}`}>{post.category.name}</Chip>
          </div>
        )}
      </div>
    </Card>
  );
}
