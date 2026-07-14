import Link from "next/link";
import { adminStats, type AdminStats } from "@/lib/admin-queries";
import { runIngestNow } from "@/app/admin/actions";
import { Button } from "@/components/md/Button";
import { Icon } from "@/components/md/Icon";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: string;
  href?: string;
}) {
  const inner = (
    <div className="bg-surface-container-low rounded-lg p-5 shadow-e1 h-full">
      <div className="flex items-center justify-between text-on-surface-variant">
        <span className="text-label-large">{label}</span>
        <Icon name={icon} className="text-[22px]" />
      </div>
      <div className="mt-2 text-display-small text-on-surface">{value.toLocaleString()}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function AdminDashboard() {
  let stats: AdminStats | null = null;
  let error: string | null = null;
  try {
    stats = await adminStats();
  } catch (e) {
    error = e instanceof Error ? e.message : "Unknown error";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <h1 className="text-headline-small text-on-surface">Dashboard</h1>
        <form action={runIngestNow}>
          <Button type="submit" variant="tonal">
            <Icon name="sync" className="text-[18px]" />
            Run ingest now
          </Button>
        </form>
      </div>

      {error ? (
        <div className="bg-error-container text-on-error-container rounded-lg p-5">
          <p className="text-title-medium mb-1">Supabase not configured</p>
          <p className="text-body-medium opacity-90">{error}</p>
          <p className="text-body-medium mt-2">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> in <code>.env.local</code>, then run the
            migrations in <code>supabase/migrations/</code>.
          </p>
        </div>
      ) : (
        stats && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total articles" value={stats.posts} icon="article" href="/admin/articles" />
            <StatCard label="Published" value={stats.published} icon="visibility" href="/admin/articles" />
            <StatCard label="Hidden" value={stats.hidden} icon="visibility_off" href="/admin/articles" />
            <StatCard label="Unclassified" value={stats.unclassified} icon="label_off" href="/admin/articles" />
            <StatCard label="Sources" value={stats.sources} icon="rss_feed" href="/admin/sources" />
            <StatCard label="Active sources" value={stats.activeSources} icon="check_circle" href="/admin/sources" />
          </div>
        )
      )}
    </div>
  );
}
