// Populate the new AI metadata (secondary topics, article type, importance,
// confidence, timeliness) on existing posts. Non-destructive: keeps each post's
// existing primary category. Run once after applying migration 0005.
//   npm run backfill-classify

async function main() {
  try {
    process.loadEnvFile?.(".env.local");
  } catch {}

  const { getAdminSupabase } = await import("../lib/supabase/admin");
  const { classifyArticle } = await import("../lib/pipeline/classify");
  const sb = getAdminSupabase();

  const { data: cats } = await sb.from("categories").select("id,slug,name").order("sort_order");
  const categories = (cats ?? []) as { id: string; slug: string; name: string }[];
  const catIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  const { data } = await sb
    .from("posts")
    .select("id,title,excerpt,category_id")
    .is("importance", null)
    .limit(5000);
  const posts = (data ?? []) as {
    id: string;
    title: string;
    excerpt: string | null;
    category_id: string | null;
  }[];
  console.log(`Classifying metadata for ${posts.length} posts…`);

  let ok = 0;
  for (const p of posts) {
    try {
      const c = await classifyArticle({ title: p.title, excerpt: p.excerpt }, categories as never);
      const secondaryIds = c.secondaryCategorySlugs
        .map((s) => catIdBySlug.get(s))
        .filter((id): id is string => Boolean(id) && id !== p.category_id)
        .slice(0, 3);
      await sb
        .from("posts")
        .update({
          secondary_category_ids: secondaryIds,
          article_type: c.articleType,
          confidence: c.confidence,
          timeliness: c.timeliness,
          importance: c.importance,
          importance_reason: c.importanceReason,
        })
        .eq("id", p.id);
      ok++;
      process.stdout.write(".");
    } catch {
      process.stdout.write("x");
    }
  }
  console.log(`\nDone. ${ok}/${posts.length} classified.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
