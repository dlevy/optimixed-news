import { cookies } from "next/headers";
import { PostGrid } from "@/components/site/PostGrid";
import { PostList } from "@/components/site/PostList";
import { ViewToggle } from "@/components/site/ViewToggle";
import { VIEW_COOKIE, type ViewPref } from "@/lib/prefs";
import type { PostWithRefs } from "@/lib/types";

export async function Feed({
  posts,
  emptyLabel,
  startIndex = 0,
  toolbarStart,
}: {
  posts: PostWithRefs[];
  emptyLabel?: string;
  startIndex?: number;
  toolbarStart?: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const view: ViewPref = cookieStore.get(VIEW_COOKIE)?.value === "list" ? "list" : "tile";

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 justify-between min-h-9">
        <div className="text-body-medium text-on-surface-variant">{toolbarStart}</div>
        <ViewToggle current={view} />
      </div>
      {view === "list" ? (
        <PostList posts={posts} startIndex={startIndex} emptyLabel={emptyLabel} />
      ) : (
        <PostGrid posts={posts} emptyLabel={emptyLabel} />
      )}
    </div>
  );
}
