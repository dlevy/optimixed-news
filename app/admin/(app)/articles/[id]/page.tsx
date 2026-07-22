import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adminGetPost,
  adminListCategories,
  adminListPostSources,
  adminListRevisions,
} from "@/lib/admin-queries";
import {
  addArticleSource,
  deleteArticleSource,
  publishInternalArticle,
  restoreRevision,
  saveInternalArticle,
  unpublishInternalArticle,
} from "@/app/admin/actions";
import { Icon } from "@/components/md/Icon";
import { GeneratePanel } from "@/components/admin/GeneratePanel";
import { clsx } from "@/lib/clsx";
import { ARTICLE_TYPES, TIMELINESS_LEVELS } from "@/lib/article-meta";

export const dynamic = "force-dynamic";

const field =
  "w-full rounded-xs border border-outline bg-surface px-3 py-2 text-body-medium text-on-surface " +
  "focus:outline-2 focus:outline-offset-[-1px] focus:outline-primary";
const labelCls = "text-label-large text-on-surface-variant";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await adminGetPost(id);
  if (!post) notFound();

  // This editor is only for original articles.
  if (post.origin !== "internal") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-headline-small text-on-surface">Not an Optimixed article</h1>
        <p className="text-body-medium text-on-surface-variant max-w-prose">
          {post.title} is an externally sourced article. Convert it from the articles list to create
          an original Optimixed version.
        </p>
        <Link href="/admin/articles" className="text-primary text-label-large hover:underline">
          ← Back to articles
        </Link>
      </div>
    );
  }

  const [categories, sources, revisions] = await Promise.all([
    adminListCategories(),
    adminListPostSources(post.id),
    adminListRevisions(post.id),
  ]);

  const live = post.status === "published";
  const publishable = Boolean(post.body_md?.trim());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/articles"
          className="grid place-items-center size-9 rounded-full text-on-surface-variant hover:bg-on-surface/8"
          aria-label="Back to articles"
        >
          <Icon name="arrow_back" className="text-[20px]" />
        </Link>
        <h1 className="text-headline-small text-on-surface">Edit exclusive</h1>
        <span
          className={clsx(
            "text-label-small px-2 py-0.5 rounded-full",
            live
              ? "bg-secondary-container text-on-secondary-container"
              : "bg-tertiary-container text-on-tertiary-container",
          )}
        >
          {live ? "Live" : "Draft"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {live && (
            <Link
              href={`/article/${post.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 h-10 px-4 rounded-full text-label-large text-primary hover:bg-primary/8"
            >
              <Icon name="open_in_new" className="text-[18px]" />
              View
            </Link>
          )}
          <form action={live ? unpublishInternalArticle : publishInternalArticle}>
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="slug" value={post.slug} />
            <button
              disabled={!live && !publishable}
              title={!live && !publishable ? "Add some copy before publishing" : undefined}
              className={clsx(
                "inline-flex items-center gap-2 h-10 px-5 rounded-full text-label-large",
                "disabled:pointer-events-none disabled:opacity-[0.38]",
                live
                  ? "border border-outline text-primary hover:bg-primary/8"
                  : "bg-primary text-on-primary hover:shadow-e1",
              )}
            >
              <Icon name={live ? "visibility_off" : "publish"} className="text-[18px]" />
              {live ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        {/* ---------------- Copy ---------------- */}
        <form
          action={saveInternalArticle}
          className="flex flex-col gap-4 rounded-lg border border-outline-variant bg-surface p-5"
        >
          <input type="hidden" name="id" value={post.id} />

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Headline</span>
            <input name="title" defaultValue={post.title} className={field} required />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Dek</span>
            <textarea
              name="dek"
              defaultValue={post.dek ?? ""}
              rows={2}
              placeholder="One sentence that sets up the story — also used as the card teaser."
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Body (markdown)</span>
            <textarea
              name="body_md"
              defaultValue={post.body_md ?? ""}
              rows={28}
              placeholder={"## What happened\n\n## The evidence\n\n## Where sources disagree\n\n## Optimixed analysis"}
              className={clsx(field, "font-mono text-body-small leading-relaxed")}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Category</span>
              <select name="category_id" defaultValue={post.category_id ?? ""} className={field}>
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Type</span>
              <select name="article_type" defaultValue={post.article_type ?? ""} className={field}>
                <option value="">—</option>
                {ARTICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelCls}>Timeliness</span>
              <select name="timeliness" defaultValue={post.timeliness ?? ""} className={field}>
                <option value="">—</option>
                {TIMELINESS_LEVELS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-on-primary text-label-large hover:shadow-e1">
              <Icon name="save" className="text-[18px]" />
              Save
            </button>
            <span className="text-body-small text-on-surface-variant">
              Last edited {fmt(post.updated_at)}
            </span>
          </div>
        </form>

        {/* ---------------- Newsroom + sources ---------------- */}
        <aside className="flex flex-col gap-4">
          <GeneratePanel
            postId={post.id}
            status={post.generation_status}
            hasBody={publishable}
            error={post.generation_error}
          />

          <section className="rounded-lg border border-outline-variant bg-surface p-5 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Icon name="link" className="text-[20px] text-on-surface-variant" />
              <h2 className="text-title-medium text-on-surface">Sources</h2>
              <span className="ml-auto text-label-small text-on-surface-variant">
                {sources.length}
              </span>
            </div>

            <ol className="flex flex-col gap-2">
              {sources.map((s) => (
                <li
                  key={s.id}
                  className="rounded-sm border border-outline-variant p-3 flex gap-3 items-start"
                >
                  {s.kind === "screenshot" && s.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.image_url}
                      alt=""
                      className="size-12 rounded-xs object-cover shrink-0"
                    />
                  ) : (
                    <Icon
                      name={s.kind === "note" ? "sticky_note_2" : "public"}
                      className="text-[20px] text-on-surface-variant shrink-0 mt-0.5"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-body-small text-on-surface line-clamp-2">
                      {s.title || s.url || s.note || "Untitled source"}
                    </p>
                    <p className="text-label-small text-on-surface-variant mt-0.5">
                      {[s.publisher, s.role !== "secondary" ? s.role : null]
                        .filter(Boolean)
                        .join(" · ") || s.kind}
                    </p>
                    {s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-label-small text-primary hover:underline break-all"
                      >
                        {s.url}
                      </a>
                    )}
                  </div>
                  <form action={deleteArticleSource}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="post_id" value={post.id} />
                    <button
                      className="grid place-items-center size-8 rounded-full text-on-surface-variant hover:bg-error/8 hover:text-error"
                      aria-label="Remove source"
                    >
                      <Icon name="close" className="text-[18px]" />
                    </button>
                  </form>
                </li>
              ))}
              {sources.length === 0 && (
                <li className="text-body-small text-on-surface-variant">No sources yet.</li>
              )}
            </ol>

            <form
              action={addArticleSource}
              className="flex flex-col gap-3 border-t border-outline-variant pt-4"
            >
              <input type="hidden" name="post_id" value={post.id} />
              <input name="url" placeholder="https://…" className={field} />
              <input name="title" placeholder="Title (optional)" className={field} />
              <textarea
                name="note"
                rows={2}
                placeholder="Context for this source (optional)"
                className={field}
              />
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Or upload a screenshot</span>
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  className="text-body-small text-on-surface-variant file:mr-3 file:h-9 file:px-4 file:rounded-full file:border-0 file:bg-secondary-container file:text-on-secondary-container file:text-label-large"
                />
              </label>
              <select name="role" defaultValue="secondary" className={field}>
                <option value="primary">Primary source</option>
                <option value="secondary">Secondary coverage</option>
                <option value="analysis">Analysis / commentary</option>
              </select>
              <button className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-secondary-container text-on-secondary-container text-label-large hover:shadow-e1">
                <Icon name="add" className="text-[18px]" />
                Add source
              </button>
            </form>
          </section>

          {revisions.length > 0 && (
            <section className="rounded-lg border border-outline-variant bg-surface p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Icon name="history" className="text-[20px] text-on-surface-variant" />
                <h2 className="text-title-medium text-on-surface">Revisions</h2>
              </div>
              <ol className="flex flex-col gap-1">
                {revisions.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-body-small">
                    <span className="text-on-surface-variant flex-1 min-w-0">
                      <span className="block truncate">{r.note ?? "Snapshot"}</span>
                      <span className="text-label-small">{fmt(r.created_at)}</span>
                    </span>
                    <form action={restoreRevision}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="h-8 px-3 rounded-full text-label-large text-primary hover:bg-primary/8">
                        Restore
                      </button>
                    </form>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
