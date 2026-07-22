import Link from "next/link";
import { adminListPosts, adminListCategories } from "@/lib/admin-queries";
import { setPostStatus, reclassifyPost, convertToInternal } from "@/app/admin/actions";
import { Icon } from "@/components/md/Icon";
import { clsx } from "@/lib/clsx";
import type { Category, PostStatus, PostWithRefs } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: { key: PostStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "hidden", label: "Hidden" },
  { key: "draft", label: "Draft" },
];
const SORTS = [
  { key: "recent", label: "Most recent" },
  { key: "importance", label: "Top importance" },
] as const;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function makeHref(status: string, sort: string): string {
  const p = new URLSearchParams();
  if (status !== "all") p.set("status", status);
  if (sort !== "recent") p.set("sort", sort);
  const q = p.toString();
  return q ? `/admin/articles?${q}` : "/admin/articles";
}

function label(slug: string): string {
  const t = slug.replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const tabCls = (on: boolean) =>
  clsx(
    "px-3 h-8 inline-flex items-center rounded-sm text-label-large border transition-colors",
    on
      ? "bg-secondary-container text-on-secondary-container border-transparent"
      : "bg-surface text-on-surface-variant border-outline-variant hover:bg-on-surface/8",
  );

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const active = (FILTERS.find((f) => f.key === sp.status)?.key ?? "all") as PostStatus | "all";
  const activeSort = sp.sort === "importance" ? "importance" : "recent";

  let posts: PostWithRefs[] = [];
  let categories: Category[] = [];
  let error: string | null = null;
  try {
    [posts, categories] = await Promise.all([
      adminListPosts({ status: active, sort: activeSort }),
      adminListCategories(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-headline-small text-on-surface">Articles</h1>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <a key={f.key} href={makeHref(f.key, activeSort)} className={tabCls(active === f.key)}>
            {f.label}
          </a>
        ))}
        <span className="mx-1 h-6 w-px bg-outline-variant" aria-hidden />
        {SORTS.map((s) => (
          <a key={s.key} href={makeHref(active, s.key)} className={tabCls(activeSort === s.key)}>
            {s.label}
          </a>
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
            className="bg-surface rounded-lg border border-outline-variant p-4 flex flex-col gap-3 md:flex-row md:items-start"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-body-small text-on-surface-variant mb-1">
                <span>{p.source?.name ?? "—"}</span>
                <span aria-hidden>·</span>
                <span>{fmtDate(p.published_at)}</span>
                <StatusBadge status={p.status} />
                {p.origin === "internal" && (
                  <span className="inline-flex items-center gap-1 text-label-small px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container font-medium">
                    <Icon name="editor_choice" filled className="text-[14px]" />
                    Exclusive
                  </span>
                )}
              </div>
              {p.origin === "internal" ? (
                <Link
                  href={`/admin/articles/${p.id}`}
                  className="text-title-small text-on-surface hover:text-primary line-clamp-2"
                >
                  {p.title}
                </Link>
              ) : (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-title-small text-on-surface hover:text-primary line-clamp-2"
                >
                  {p.title}
                </a>
              )}

              {/* AI metadata */}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-label-small">
                <ImportancePill score={p.importance} reason={p.importance_reason} />
                {p.article_type && <Meta>{label(p.article_type)}</Meta>}
                {p.confidence && <Meta>{label(p.confidence)}</Meta>}
                {p.timeliness && <Meta>{label(p.timeliness)}</Meta>}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {p.origin === "internal" ? (
                <Link
                  href={`/admin/articles/${p.id}`}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-tertiary-container text-on-tertiary-container text-label-large hover:shadow-e1"
                >
                  <Icon name="edit" className="text-[18px]" />
                  Edit
                </Link>
              ) : p.converted_to_post_id ? (
                <Link
                  href={`/admin/articles/${p.converted_to_post_id}`}
                  className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-outline text-primary text-label-large hover:bg-primary/8"
                  title="This article has already been converted"
                >
                  <Icon name="editor_choice" className="text-[18px]" />
                  Open exclusive
                </Link>
              ) : (
                <form action={convertToInternal}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-outline text-primary text-label-large hover:bg-primary/8"
                    title="Convert to an original Optimixed article"
                  >
                    <Icon name="auto_awesome" className="text-[18px]" />
                    Convert
                  </button>
                </form>
              )}

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

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-sm bg-surface-container-highest text-on-surface-variant">
      {children}
    </span>
  );
}

function ImportancePill({ score, reason }: { score?: number | null; reason?: string | null }) {
  if (score == null) return <Meta>Imp —</Meta>;
  const tone =
    score >= 81
      ? "bg-error-container text-on-error-container"
      : score >= 61
        ? "bg-tertiary-container text-on-tertiary-container"
        : score >= 41
          ? "bg-secondary-container text-on-secondary-container"
          : "bg-surface-container-highest text-on-surface-variant";
  return (
    <span
      className={clsx("px-2 py-0.5 rounded-sm font-medium", tone)}
      title={reason ?? undefined}
    >
      Importance {score}
    </span>
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
