import Link from "next/link";
import { logout } from "@/app/admin/actions";
import { Icon } from "@/components/md/Icon";

export const metadata = { title: "Admin", robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/sources", label: "Sources", icon: "rss_feed" },
  { href: "/admin/articles", label: "Articles", icon: "article" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="border-b border-outline-variant bg-surface-container">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="grid place-items-center size-8 rounded-full bg-primary text-on-primary">
              <Icon name="hub" filled />
            </span>
            <span className="text-title-medium font-medium">Optimixed Admin</span>
          </div>
          <nav className="ml-4 flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-label-large text-on-surface-variant hover:bg-on-surface/8"
              >
                <Icon name={n.icon} className="text-[20px]" />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-label-large text-on-surface-variant hover:bg-on-surface/8"
            >
              <Icon name="open_in_new" className="text-[18px]" />
              View site
            </Link>
            <form action={logout}>
              <button className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-label-large text-on-surface-variant hover:bg-on-surface/8">
                <Icon name="logout" className="text-[18px]" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 flex-1">{children}</main>
    </div>
  );
}
