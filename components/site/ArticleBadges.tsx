import type { ReactNode } from "react";
import { clsx } from "@/lib/clsx";
import { Icon } from "@/components/md/Icon";
import type { PostWithRefs } from "@/lib/types";

function label(slug: string): string {
  const t = slug.replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const base = "inline-flex items-center gap-1 h-6 px-2 rounded-sm text-label-small";

/**
 * Public metadata badges: Breaking (timeliness), article type, confidence
 * (when not "confirmed"), and Evergreen. `compact` (cards) shows only the
 * strongest signals to avoid clutter.
 */
export function ArticleBadges({ post, compact = false }: { post: PostWithRefs; compact?: boolean }) {
  const badges: ReactNode[] = [];

  if (post.timeliness === "breaking") {
    badges.push(
      <span key="breaking" className={clsx(base, "bg-error-container text-on-error-container font-medium")}>
        <Icon name="bolt" filled className="text-[14px]" />
        Breaking
      </span>,
    );
  }

  if (post.article_type) {
    badges.push(
      <span key="type" className={clsx(base, "bg-surface-container-highest text-on-surface-variant")}>
        {label(post.article_type)}
      </span>,
    );
  }

  // "opinion" is the one value shared by both enums — don't render it twice.
  if (
    !compact &&
    post.confidence &&
    post.confidence !== "confirmed" &&
    post.confidence !== post.article_type
  ) {
    const tone =
      post.confidence === "opinion"
        ? "bg-secondary-container text-on-secondary-container"
        : "bg-tertiary-container text-on-tertiary-container";
    badges.push(
      <span key="confidence" className={clsx(base, tone)}>
        {label(post.confidence)}
      </span>,
    );
  }

  if (!compact && post.timeliness === "evergreen") {
    badges.push(
      <span key="evergreen" className={clsx(base, "bg-surface-container-high text-on-surface-variant")}>
        Evergreen
      </span>,
    );
  }

  if (badges.length === 0) return null;
  return <div className="flex flex-wrap items-center gap-1.5">{badges}</div>;
}
