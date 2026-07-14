import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPosts } from "@/lib/queries";
import { Feed } from "@/components/site/Feed";
import { Icon } from "@/components/md/Icon";

export const revalidate = 300;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shiftDay(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  return { title: `Articles from ${date}` };
}

export default async function DatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const start = `${date}T00:00:00.000Z`;
  const end = `${shiftDay(date, 1)}T00:00:00.000Z`;
  const posts = await getPosts({ dateStart: start, dateEnd: end, limit: 100 });

  const pretty = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-label-large text-primary">Archive</p>
          <h1 className="text-headline-large text-on-surface">{pretty}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/date/${shiftDay(date, -1)}`}
            aria-label="Previous day"
            className="grid place-items-center size-10 rounded-full border border-outline text-primary hover:bg-primary/8"
          >
            <Icon name="chevron_left" />
          </Link>
          <Link
            href={`/date/${shiftDay(date, 1)}`}
            aria-label="Next day"
            className="grid place-items-center size-10 rounded-full border border-outline text-primary hover:bg-primary/8"
          >
            <Icon name="chevron_right" />
          </Link>
        </div>
      </header>

      <Feed posts={posts} emptyLabel={`No articles published on ${pretty}.`} />
    </main>
  );
}
