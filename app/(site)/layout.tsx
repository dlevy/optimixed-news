import Link from "next/link";
import { TopAppBar } from "@/components/ui/TopAppBar";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopAppBar />
      <div className="flex-1">{children}</div>
      <footer className="border-t border-outline-variant mt-12">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row gap-4 sm:items-center justify-between text-body-small text-on-surface-variant">
          <span>© {new Date().getFullYear()} Optimixed · Aggregated SEO &amp; digital marketing news.</span>
          <nav className="flex gap-4">
            <Link href="/categories" className="hover:text-primary">
              Categories
            </Link>
            <Link href="/sources" className="hover:text-primary">
              Sources
            </Link>
            <Link href="/calendar" className="hover:text-primary">
              Calendar
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
