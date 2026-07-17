import Link from "next/link";
import { Icon } from "@/components/md/Icon";
import { ThemeToggle } from "@/components/site/ThemeToggle";

export function TopAppBar() {
  return (
    <header className="sticky top-0 z-40 bg-surface-container/80 backdrop-blur border-b border-outline-variant">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 text-on-surface">
          <span className="grid place-items-center size-9 rounded-full bg-primary text-on-primary">
            <Icon name="hub" filled />
          </span>
          <span className="text-title-large font-medium tracking-tight">Optimixed</span>
        </Link>

        <nav className="ml-auto hidden md:flex items-center gap-1 text-label-large">
          <Link href="/" className="px-3 py-2 rounded-full hover:bg-on-surface/8">
            Latest
          </Link>
          <Link href="/sources" className="px-3 py-2 rounded-full hover:bg-on-surface/8">
            Sources
          </Link>
        </nav>

        <Link
          href="/search"
          aria-label="Search"
          className="grid place-items-center size-10 rounded-full hover:bg-on-surface/8 text-on-surface-variant"
        >
          <Icon name="search" />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
