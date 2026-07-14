import Link from "next/link";
import type { Metadata } from "next";
import { getSources } from "@/lib/queries";
import { Icon } from "@/components/md/Icon";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Sources" };

export default async function SourcesPage() {
  const sources = await getSources();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-headline-large text-on-surface mb-6">Sources</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map((s) => (
          <Link
            key={s.id}
            href={`/source/${s.slug}`}
            className="flex items-center gap-3 rounded-lg bg-surface-container-low p-5 shadow-e1 hover:shadow-e2 transition-shadow"
          >
            <Icon
              name={s.kind === "sitemap" ? "sitemap" : "rss_feed"}
              className="text-on-surface-variant"
            />
            <span className="text-title-medium text-on-surface flex-1">{s.name}</span>
            <Icon name="arrow_forward" className="text-on-surface-variant" />
          </Link>
        ))}
        {sources.length === 0 && (
          <p className="text-body-large text-on-surface-variant">No sources yet.</p>
        )}
      </div>
    </main>
  );
}
