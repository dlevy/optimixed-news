"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/md/Icon";
import { clsx } from "@/lib/clsx";
import { setPrefCookie, VIEW_COOKIE, type ViewPref } from "@/lib/prefs";

/** MD3 segmented button switching between tile and list views. */
export function ViewToggle({ current }: { current: ViewPref }) {
  const router = useRouter();
  const [view, setView] = useState<ViewPref>(current);

  function choose(v: ViewPref) {
    if (v === view) return;
    setView(v);
    setPrefCookie(VIEW_COOKIE, v);
    router.refresh(); // re-render the server component with the new layout
  }

  const segment = (v: ViewPref, icon: string, label: string, side: "l" | "r") => (
    <button
      type="button"
      onClick={() => choose(v)}
      aria-pressed={view === v}
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex items-center justify-center h-9 w-11 border border-outline transition-colors",
        side === "l" ? "rounded-l-full border-r-0" : "rounded-r-full",
        view === v
          ? "bg-secondary-container text-on-secondary-container"
          : "text-on-surface-variant hover:bg-on-surface/8",
      )}
    >
      <Icon name={icon} className="text-[20px]" filled={view === v} />
    </button>
  );

  return (
    <div className="inline-flex shrink-0">
      {segment("tile", "grid_view", "Tile view", "l")}
      {segment("list", "view_list", "List view", "r")}
    </div>
  );
}
