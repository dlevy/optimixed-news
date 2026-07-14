import Link from "next/link";
import type { Metadata } from "next";
import { getCategories } from "@/lib/queries";
import { Icon } from "@/components/md/Icon";

export const revalidate = 3600;
export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="text-headline-large text-on-surface mb-6">Categories</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/category/${c.slug}`}
            className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low p-5 shadow-e1 hover:shadow-e2 transition-shadow"
          >
            <span className="text-title-medium text-on-surface">{c.name}</span>
            <Icon name="arrow_forward" className="text-on-surface-variant" />
          </Link>
        ))}
        {categories.length === 0 && (
          <p className="text-body-large text-on-surface-variant">No categories yet.</p>
        )}
      </div>
    </main>
  );
}
