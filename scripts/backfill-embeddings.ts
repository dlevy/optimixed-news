// Backfill dedup fields on existing posts: title_key for everyone (cheap), and
// embeddings when EMBEDDINGS_API_KEY is set (enables cross-source semantic dedup
// against the existing corpus). Run once after applying migration 0004.
//   npm run backfill-embeddings

async function main() {
  try {
    process.loadEnvFile?.(".env.local");
  } catch {}

  const { getAdminSupabase } = await import("../lib/supabase/admin");
  const { embedText, embeddingsEnabled } = await import("../lib/pipeline/embeddings");
  const { titleKey } = await import("../lib/pipeline/normalize");
  const sb = getAdminSupabase();

  // 1. title_key for all posts missing it (no API needed)
  const { data: needKey } = await sb
    .from("posts")
    .select("id,title")
    .is("title_key", null)
    .limit(5000);
  const keyPosts = (needKey ?? []) as { id: string; title: string }[];
  for (const p of keyPosts) {
    await sb.from("posts").update({ title_key: titleKey(p.title) }).eq("id", p.id);
  }
  console.log(`title_key set on ${keyPosts.length} posts.`);

  // 2. embeddings (optional)
  if (!embeddingsEnabled()) {
    console.log(
      "EMBEDDINGS_API_KEY not set — skipping embeddings (cross-source semantic dedup stays off).",
    );
    return;
  }

  const { data } = await sb
    .from("posts")
    .select("id,title,excerpt,tldr")
    .is("embedding", null)
    .limit(5000);
  const posts = (data ?? []) as {
    id: string;
    title: string;
    excerpt: string | null;
    tldr: string | null;
  }[];
  console.log(`Embedding ${posts.length} posts…`);

  let ok = 0;
  for (const p of posts) {
    const emb = await embedText(`${p.title}\n${p.excerpt ?? p.tldr ?? ""}`);
    if (emb) {
      await sb.from("posts").update({ embedding: emb }).eq("id", p.id);
      ok++;
      process.stdout.write(".");
    } else {
      process.stdout.write("x");
    }
  }
  console.log(`\nDone. ${ok}/${posts.length} embeddings generated.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
