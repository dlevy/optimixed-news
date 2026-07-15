// Generate local thumbnails for existing posts that have a source image but no
// stored thumbnail yet. Run once after applying migration 0003.
//   npm run backfill-thumbnails

async function main() {
  try {
    process.loadEnvFile?.(".env.local");
  } catch {}

  const { getAdminSupabase } = await import("../lib/supabase/admin");
  const { processThumbnail } = await import("../lib/pipeline/image");
  const sb = getAdminSupabase();

  const { data, error } = await sb
    .from("posts")
    .select("id,image_url,url")
    .is("thumbnail_url", null)
    .limit(1000);
  if (error) throw new Error(error.message);

  const posts = (data ?? []) as { id: string; image_url: string | null; url: string }[];
  console.log(`Found ${posts.length} posts without a thumbnail. Resolving images…`);

  let ok = 0;
  for (const p of posts) {
    const url = await processThumbnail(sb, p.image_url, p.url);
    if (url) {
      await sb.from("posts").update({ thumbnail_url: url }).eq("id", p.id);
      ok++;
      process.stdout.write(".");
    } else {
      process.stdout.write("x");
    }
  }
  console.log(`\nDone. ${ok}/${posts.length} thumbnails generated.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
