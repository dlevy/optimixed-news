import { PostCard } from "@/components/site/PostCard";
import { Icon } from "@/components/md/Icon";
import type { PostWithRefs } from "@/lib/types";

export function PostGrid({ posts, emptyLabel = "No articles yet." }: { posts: PostWithRefs[]; emptyLabel?: string }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-12 text-center">
        <Icon name="inbox" className="text-[40px] text-on-surface-variant" />
        <p className="mt-2 text-body-large text-on-surface-variant">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
