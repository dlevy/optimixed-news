/**
 * Timing spike for the newsroom pipeline.
 *
 * Each stage must fit inside one serverless invocation (60s on Vercel Hobby).
 * This runs a full generation against a real archive article and reports the
 * wall-clock cost of every stage.
 *
 *   npx tsx scripts/newsroom-spike.ts [postId]
 */

const BUDGET_MS = 60_000;
const WARN_MS = 45_000;

function mark(): () => number {
  const t = Date.now();
  return () => Date.now() - t;
}

function verdict(ms: number): string {
  if (ms >= BUDGET_MS) return "OVER BUDGET";
  if (ms >= WARN_MS) return "tight";
  return "ok";
}

async function main() {
  process.loadEnvFile?.(".env.local");

  const { getAdminSupabase } = await import("../lib/supabase/admin");
  const stages = await import("../lib/newsroom/stages");
  const sb = getAdminSupabase();

  const argId = process.argv[2];
  const query = sb
    .from("posts")
    .select("id,title,tldr,summary,url,published_at,source:sources(name)")
    .eq("origin", "external");
  const { data } = argId
    ? await query.eq("id", argId).maybeSingle()
    : await query
        .eq("status", "published")
        .order("importance", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

  const seed = data as unknown as {
    id: string;
    title: string;
    tldr: string | null;
    summary: string | null;
    url: string;
    published_at: string | null;
    source: { name: string } | null;
  } | null;
  if (!seed) throw new Error("No seed article found.");

  console.log(`seed: "${seed.title}"\n      ${seed.source?.name} · ${seed.url}\n`);

  const timings: Record<string, number> = {};

  // ---- plan ----
  let t = mark();
  const plan = await stages.planStage({
    title: seed.title,
    seedSummary: [seed.tldr, seed.summary].filter(Boolean).join("\n\n"),
    sources: [],
  });
  timings.plan = t();
  console.log(`[plan]      ${timings.plan} ms  ${verdict(timings.plan)}`);
  console.log(`  event: ${plan.event}`);
  console.log(`  angle: ${plan.angle}`);
  plan.queries.forEach((q, i) => console.log(`  q${i + 1}: ${q}`));
  console.log(`  claims to verify: ${plan.claims_to_verify.length}\n`);

  // ---- research (one call per query, as in production) ----
  const notes = [];
  for (const [i, q] of plan.queries.entries()) {
    t = mark();
    const note = await stages.researchStage({ plan, query: q });
    const ms = t();
    timings[`research${i + 1}`] = ms;
    notes.push(note);
    console.log(
      `[research ${i + 1}] ${ms} ms  ${verdict(ms)}  — ${note.sources.length} sources, ${note.findings.length} chars`,
    );
  }
  console.log();

  // ---- verify ----
  t = mark();
  const verification = await stages.verifyStage({ plan, notes });
  timings.verify = t();
  console.log(`[verify]    ${timings.verify} ms  ${verdict(timings.verify)}`);
  const byStatus = verification.claims.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`  claims: ${JSON.stringify(byStatus)}`);
  console.log(`  conflicts: ${verification.conflicts.length}, open questions: ${verification.open_questions.length}\n`);

  // ---- draft (the stage most at risk of blowing the budget) ----
  t = mark();
  const draft = await stages.draftStage({ plan, notes, verification, archive: [] });
  timings.draft = t();
  console.log(`[draft]     ${timings.draft} ms  ${verdict(timings.draft)}`);
  console.log(`  headline: ${draft.headline}`);
  console.log(`  body: ${draft.body_md.length} chars, ~${draft.body_md.split(/\s+/).length} words\n`);

  const { writeFileSync } = await import("node:fs");
  writeFileSync(
    "spike-article.md",
    `# ${draft.headline}\n\n**${draft.dek}**\n\n${draft.body_md}\n`,
    "utf8",
  );

  const slowest = Object.entries(timings).sort((a, b) => b[1] - a[1])[0];
  const total = Object.values(timings).reduce((a, b) => a + b, 0);
  console.log("---");
  console.log(`total ${Math.round(total / 1000)}s across ${Object.keys(timings).length} steps`);
  console.log(`slowest step: ${slowest[0]} at ${slowest[1]} ms (budget ${BUDGET_MS} ms)`);
  console.log(`unique sources consulted: ${new Set(notes.flatMap((n) => n.sources.map((s) => s.url))).size}`);
  console.log("article written to spike-article.md");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
