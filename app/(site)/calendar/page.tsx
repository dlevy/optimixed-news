import Link from "next/link";
import type { Metadata } from "next";
import { getPostDatesInRange } from "@/lib/queries";
import { Icon } from "@/components/md/Icon";
import { clsx } from "@/lib/clsx";

export const revalidate = 300;
export const metadata: Metadata = { title: "Calendar" };

const MONTH_RE = /^\d{4}-\d{2}$/;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const now = new Date();
  const [year, monthIdx] =
    month && MONTH_RE.test(month)
      ? [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1]
      : [now.getUTCFullYear(), now.getUTCMonth()];

  const monthStart = `${year}-${pad(monthIdx + 1)}-01T00:00:00.000Z`;
  const nextMonthDate = new Date(Date.UTC(year, monthIdx + 1, 1));
  const monthEnd = nextMonthDate.toISOString();

  const dates = await getPostDatesInRange(monthStart, monthEnd);
  const counts = new Map<number, number>();
  for (const iso of dates) {
    const day = new Date(iso).getUTCDate();
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, monthIdx, 1)).getUTCDay();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const prev = new Date(Date.UTC(year, monthIdx - 1, 1));
  const next = new Date(Date.UTC(year, monthIdx + 1, 1));
  const prevMonth = `${prev.getUTCFullYear()}-${pad(prev.getUTCMonth() + 1)}`;
  const nextMonth = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}`;
  const monthLabel = new Date(Date.UTC(year, monthIdx, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const todayKey = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const currentKey = `${year}-${pad(monthIdx + 1)}`;
  const todayNum = now.getUTCDate();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-headline-large text-on-surface">{monthLabel}</h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${prevMonth}`}
            aria-label="Previous month"
            className="grid place-items-center size-10 rounded-full border border-outline text-primary hover:bg-primary/8"
          >
            <Icon name="chevron_left" />
          </Link>
          <Link
            href={`/calendar?month=${nextMonth}`}
            aria-label="Next month"
            className="grid place-items-center size-10 rounded-full border border-outline text-primary hover:bg-primary/8"
          >
            <Icon name="chevron_right" />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-center text-label-medium text-on-surface-variant py-2">
            {d}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const count = counts.get(day) ?? 0;
          const dateStr = `${year}-${pad(monthIdx + 1)}-${pad(day)}`;
          const isToday = currentKey === todayKey && day === todayNum;
          const cellCls = clsx(
            "aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 transition-colors",
            count > 0
              ? "bg-primary-container text-on-primary-container hover:shadow-e1"
              : "bg-surface-container-low text-on-surface-variant",
            isToday && "ring-2 ring-primary",
          );
          const inner = (
            <>
              <span className="text-body-medium">{day}</span>
              {count > 0 && <span className="text-label-small">{count}</span>}
            </>
          );
          return count > 0 ? (
            <Link key={dateStr} href={`/date/${dateStr}`} className={cellCls}>
              {inner}
            </Link>
          ) : (
            <div key={dateStr} className={cellCls}>
              {inner}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-body-small text-on-surface-variant">
        Days with published articles are highlighted — click to view that day’s archive.
      </p>
    </main>
  );
}
