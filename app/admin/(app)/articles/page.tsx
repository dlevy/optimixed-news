import Link from "next/link";
import { adminListPosts, adminListCategories } from "@/lib/admin-queries";
import { setPostStatus, reclassifyPost } from "@/app/admin/actions";
import { Icon } from "@/components/md/Icon";
import type { Category, PostStatus, PostWithRefs } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: { key: PostStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "hidden", label: "Hidden" },
  { key: "draft", label: "Draft" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = (FILTERS.find((f) => f.key === status)?.key ?? "all") as PostStatus | "all";

  let posts: PostWithRefs[] = [];
  let categories: Category[] = [];
  let error: string | null = null;
  try {
    [posts, categories] = await Promise.all([
      adminListPosts({ status: active }),
      adminListCategories(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-small text-on-surface">Articles</h1>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/articles" : `/admin/articles?status=${f.key}`}
            className={`px-3 h-8 inline-flex items-center rounded-sm text-label-large border transition-colors ${
              active === f.key
                ? "bg-secondary-container text-on-secondary-container border-transparent"
                : "bg-surface text-on-surface-variant border-outline-variant hover:bg-on-surface/8"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container rounded-lg p-4 text-body-medium">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {posts.map((p) => (
          <div
            key={p.id}
            className="bg-surface rounded-lg border border-outline-variant p-4 flex flex-col gap-3 md:flex-row md:items-center"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-body-small text-on-surface-variant mb-1">
                <span>{p.source?.name ?? "—"}</span>
                <span aria-hidden>·</span>
                <span>{fmtDate(p.published_at)}</span>
                <StatusBadge status={p.status} />
              </div>
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="text-title-small text-on-surface hover:text-primary line-clamp-2"
              >
                {p.title}
              </a>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Reclassify */}
              <form action={reclassifyPost} className="flex items-center gap-1">
                <input type="hidden" name="id" value={p.id} />
                <select
                  name="category_id"
                  defaultValue={p.category_id ?? ""}
                  className="h-9 rounded-xs border border-outline bg-surface px-2 text-body-small text-on-surface max-w-44"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  className="grid place-items-center size-9 rounded-full text-primary hover:bg-primary/8"
                  aria-label="Apply category"
                >
                  <Icon name="check" className="text-[20px]" />
                </button>
              </form>

              {/* Hide / show toggle */}
              <form action={setPostStatus}>
                <input type="hidden" name="id" value={p.id} />
                <input
                  type="hidden"
                  name="status"
                  value={p.status === "published" ? "hidden" : "published"}
                />
                <button
                  className="grid place-items-center size-9 rounded-full text-on-surface-variant hover:bg-on-surface/8"
                  aria-label={p.status === "published" ? "Hide article" : "Publish article"}
                  title={p.status === "published" ? "Hide" : "Publish"}
                >
                  <Icon name={p.status === "published" ? "visibility_off" : "visibility"} className="text-[20px]" />
                </button>
              </form>
            </div>
          </div>
        ))}

        {posts.length === 0 && !error && (
          <p className="text-body-medium text-on-surface-variant">No articles in this view yet.</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: PostStatus }) {
  const map: Record<PostStatus, string> = {
    published: "bg-secondary-container text-on-secondary-container",
    hidden: "bg-surface-container-highest text-on-surface-variant",
    draft: "bg-tertiary-container text-on-tertiary-container",
  };
  return <span className={`text-label-small px-2 py-0.5 rounded-full ${map[status]}`}>{status}</span>;
}
