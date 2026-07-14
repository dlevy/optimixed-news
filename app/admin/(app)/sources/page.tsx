import { adminListSources } from "@/lib/admin-queries";
import { createSource, updateSource, deleteSource } from "@/app/admin/actions";
import { Button } from "@/components/md/Button";
import { Icon } from "@/components/md/Icon";
import type { Source } from "@/lib/types";

export const dynamic = "force-dynamic";

const inputCls =
  "h-11 rounded-xs border border-outline bg-surface px-3 text-body-medium text-on-surface outline-none focus:border-primary focus:border-2 w-full";
const labelCls = "flex flex-col gap-1 text-label-medium text-on-surface-variant";

function SourceFields({ source }: { source?: Source }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={labelCls}>
        Name
        <input name="name" defaultValue={source?.name} required className={inputCls} />
      </label>
      <label className={labelCls}>
        Slug (optional — auto from name)
        <input name="slug" defaultValue={source?.slug} className={inputCls} />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>
        Feed URL
        <input
          name="feed_url"
          type="url"
          defaultValue={source?.feed_url}
          required
          placeholder="https://example.com/feed/"
          className={inputCls}
        />
      </label>
      <label className={labelCls}>
        Kind
        <select name="kind" defaultValue={source?.kind ?? "rss"} className={inputCls}>
          <option value="rss">RSS / Atom</option>
          <option value="sitemap">XML Sitemap</option>
        </select>
      </label>
      <label className={labelCls}>
        Homepage URL (optional)
        <input name="homepage_url" type="url" defaultValue={source?.homepage_url ?? ""} className={inputCls} />
      </label>
      <label className="flex items-center gap-2 text-body-medium text-on-surface sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={source?.active ?? true} className="size-4" />
        Active (include in ingestion)
      </label>
    </div>
  );
}

export default async function SourcesPage() {
  let sources: Source[] = [];
  let error: string | null = null;
  try {
    sources = await adminListSources();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-headline-small text-on-surface">Sources</h1>
        <span className="text-body-medium text-on-surface-variant">{sources.length} total</span>
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container rounded-lg p-4 text-body-medium">
          {error}
        </div>
      )}

      {/* Add new source */}
      <section className="bg-surface-container-low rounded-lg shadow-e1 p-5">
        <h2 className="text-title-medium text-on-surface mb-4 flex items-center gap-2">
          <Icon name="add_circle" className="text-[20px] text-primary" />
          Add source
        </h2>
        <form action={createSource} className="flex flex-col gap-4">
          <SourceFields />
          <div>
            <Button type="submit">Add source</Button>
          </div>
        </form>
      </section>

      {/* Existing sources */}
      <section className="flex flex-col gap-3">
        {sources.map((s) => (
          <div key={s.id} className="bg-surface rounded-lg border border-outline-variant overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <Icon
                name={s.kind === "sitemap" ? "sitemap" : "rss_feed"}
                className="text-[22px] text-on-surface-variant"
              />
              <div className="min-w-0 flex-1">
                <div className="text-title-small text-on-surface truncate">{s.name}</div>
                <div className="text-body-small text-on-surface-variant truncate">{s.feed_url}</div>
              </div>
              <span
                className={`text-label-small px-2 py-1 rounded-full ${
                  s.active
                    ? "bg-secondary-container text-on-secondary-container"
                    : "bg-surface-container-highest text-on-surface-variant"
                }`}
              >
                {s.active ? "Active" : "Paused"}
              </span>
              <form action={deleteSource}>
                <input type="hidden" name="id" value={s.id} />
                <button
                  aria-label={`Delete ${s.name}`}
                  className="grid place-items-center size-9 rounded-full text-on-surface-variant hover:bg-error/8 hover:text-error"
                >
                  <Icon name="delete" className="text-[20px]" />
                </button>
              </form>
            </div>

            <details className="group border-t border-outline-variant">
              <summary className="cursor-pointer list-none px-4 py-2 text-label-large text-primary hover:bg-primary/8 flex items-center gap-1">
                <Icon name="edit" className="text-[18px]" />
                Edit
              </summary>
              <form action={updateSource} className="flex flex-col gap-4 p-4 pt-2">
                <input type="hidden" name="id" value={s.id} />
                <SourceFields source={s} />
                <div>
                  <Button type="submit" variant="tonal">
                    Save changes
                  </Button>
                </div>
              </form>
            </details>
          </div>
        ))}
        {sources.length === 0 && !error && (
          <p className="text-body-medium text-on-surface-variant">No sources yet — add one above.</p>
        )}
      </section>
    </div>
  );
}
