import "server-only";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { adminGetPost, adminListPostSources, adminSnapshotRevision } from "@/lib/admin-queries";
import {
  cancelBatch,
  collectDraft,
  collectResearch,
  draftParams,
  planStage,
  pollBatch,
  refineParams,
  researchRequests,
  submitBatch,
  verifyParams,
  collectVerification,
} from "@/lib/newsroom/stages";
import type { ArchiveRef, GenerationState, ResearchNote, StepResult } from "@/lib/newsroom/types";
import type { GenerationStatus, PostWithRefs } from "@/lib/types";

/**
 * The newsroom pipeline as a resumable state machine.
 *
 * Each call to `runNextStep` does exactly one short piece of work: an inline
 * model call that comfortably fits a request, or a batch submit/poll/collect.
 * The long-running research and writing happen off-platform in the Batches API,
 * so no single request ever approaches the serverless time limit.
 *
 * All progress lives in the database, which is what makes a run survivable if
 * the browser driving it goes away.
 */

const MAX_HARVESTED_SOURCES = 12;
const POLL_MS = 15_000;
const DRAFT_ID = "draft";
const VERIFY_ID = "verify";

async function setState(
  id: string,
  status: GenerationStatus,
  state?: GenerationState,
  error?: string | null,
): Promise<void> {
  const sb = getAdminSupabase();
  const patch: Record<string, unknown> = { generation_status: status };
  if (state !== undefined) patch.generation_state = state;
  if (error !== undefined) patch.generation_error = error;
  await sb.from("posts").update(patch).eq("id", id);
}

function stateOf(post: PostWithRefs): GenerationState {
  return ((post as unknown as { generation_state?: GenerationState }).generation_state ??
    {}) as GenerationState;
}

/** Prior Optimixed coverage the draft may link to. */
async function archiveRefs(post: PostWithRefs): Promise<ArchiveRef[]> {
  const sb = getAdminSupabase();
  let q = sb
    .from("posts")
    .select("slug,title,published_at")
    .eq("status", "published")
    .neq("id", post.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(8);
  if (post.category_id) q = q.eq("category_id", post.category_id);
  const { data } = await q;
  return (data as ArchiveRef[]) ?? [];
}

/** Persist sources the research actually opened, skipping ones already attached. */
async function saveHarvestedSources(postId: string, notes: ResearchNote[]): Promise<void> {
  const sb = getAdminSupabase();
  const existing = await adminListPostSources(postId);
  const seen = new Set(existing.map((s) => s.url).filter(Boolean) as string[]);

  const rows: Record<string, unknown>[] = [];
  let order = existing.length;
  for (const note of notes) {
    for (const s of note.sources) {
      if (seen.has(s.url) || rows.length >= MAX_HARVESTED_SOURCES) continue;
      seen.add(s.url);
      rows.push({
        post_id: postId,
        kind: "url",
        role: "secondary",
        url: s.url,
        title: s.title,
        publisher: s.publisher,
        note: `Consulted while researching: ${note.query}`,
        sort_order: order++,
      });
    }
  }
  if (rows.length) await sb.from("post_sources").insert(rows);
}

async function applyDraft(
  postId: string,
  draft: { headline: string; dek: string; body_md: string },
  state: GenerationState,
): Promise<void> {
  const sb = getAdminSupabase();
  await sb
    .from("posts")
    .update({
      title: draft.headline,
      dek: draft.dek,
      tldr: draft.dek,
      body_md: draft.body_md,
      generation_status: "ready",
      generation_error: null,
      generation_state: { ...state, batch: undefined },
    })
    .eq("id", postId);
}

// ---------------------------------------------------------------- //
// Entry points
// ---------------------------------------------------------------- //

export async function startGeneration(postId: string): Promise<void> {
  const post = await adminGetPost(postId);
  if (!post) throw new Error("Article not found.");
  if (post.origin !== "internal") throw new Error("Only Optimixed articles can be generated.");
  if (post.body_md?.trim()) await adminSnapshotRevision(postId, "Before regenerating from scratch");

  const sb = getAdminSupabase();
  await sb
    .from("posts")
    .update({
      generation_status: "planning",
      generation_state: {},
      generation_error: null,
      generation_started_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

export async function startRefine(postId: string, instruction: string): Promise<void> {
  const post = await adminGetPost(postId);
  if (!post) throw new Error("Article not found.");
  if (!post.body_md?.trim()) throw new Error("There is no copy to refine yet.");
  await adminSnapshotRevision(postId, "Before refining with new sources");

  const sb = getAdminSupabase();
  await sb
    .from("posts")
    .update({
      generation_status: "refining",
      generation_state: { ...stateOf(post), instruction, batch: undefined },
      generation_error: null,
      generation_started_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

/** Abandon a run, cancelling any batch still burning tokens. */
export async function cancelGeneration(postId: string): Promise<void> {
  const post = await adminGetPost(postId);
  const batch = post ? stateOf(post).batch : undefined;
  if (batch) await cancelBatch(batch.id);
  await setState(postId, "idle", { ...(post ? stateOf(post) : {}), batch: undefined }, null);
}

// ---------------------------------------------------------------- //
// The step machine
// ---------------------------------------------------------------- //

function result(
  status: GenerationStatus,
  stage: string,
  label: string,
  step: number,
  total: number,
  extra: Partial<StepResult> = {},
): StepResult {
  return { status, stage, label, step, total, done: false, ...extra };
}

export async function runNextStep(postId: string): Promise<StepResult> {
  const post = await adminGetPost(postId);
  if (!post) throw new Error("Article not found.");

  const status = post.generation_status;
  const state = stateOf(post);
  const total = (state.plan?.queries.length ?? 6) + 3;

  if (status === "ready" || status === "idle") {
    return result(status, "done", "Finished", 1, 1, { done: true });
  }
  if (status === "error") {
    return result("error", "error", "Failed", 0, 1, {
      done: true,
      error: post.generation_error ?? "Generation failed.",
    });
  }

  try {
    switch (status) {
      // ---- plan (inline: ~13s) ----
      case "planning": {
        const started = Date.now();
        const sources = await adminListPostSources(postId);
        const plan = await planStage({
          title: post.title,
          seedSummary: [post.tldr, post.summary, sources[0]?.note].filter(Boolean).join("\n\n"),
          sources,
        });
        await setState(postId, "researching", {
          ...state,
          plan,
          notes: [],
          timings: { ...state.timings, plan: Date.now() - started },
        });
        return result(
          "researching",
          "plan",
          `Planned ${plan.queries.length} lines of research`,
          1,
          plan.queries.length + 3,
        );
      }

      // ---- research (batched off-platform: minutes) ----
      case "researching": {
        const plan = state.plan;
        if (!plan) throw new Error("Missing research plan.");

        if (!state.batch) {
          const id = await submitBatch(researchRequests(plan));
          await setState(postId, "researching", {
            ...state,
            batch: { id, kind: "research", submitted_at: new Date().toISOString() },
          });
          return result(
            "researching",
            "research",
            `Submitted ${plan.queries.length} research jobs`,
            2,
            total,
            { waiting: true, retryAfterMs: POLL_MS },
          );
        }

        const progress = await pollBatch(state.batch.id);
        if (!progress.ended) {
          return result(
            "researching",
            "research",
            `Researching — ${progress.succeeded} of ${plan.queries.length} done`,
            2 + progress.succeeded,
            total,
            { waiting: true, retryAfterMs: POLL_MS },
          );
        }

        const notes = await collectResearch(state.batch.id, plan);
        await setState(postId, "verifying", { ...state, notes, batch: undefined });
        return result(
          "verifying",
          "research",
          `Research complete — ${new Set(notes.flatMap((n) => n.sources.map((s) => s.url))).size} sources consulted`,
          total - 2,
          total,
        );
      }

      // ---- verify (batched: scales with research volume) ----
      case "verifying": {
        const { plan, notes } = state;
        if (!plan || !notes) throw new Error("Missing research to verify.");

        if (!state.batch) {
          const id = await submitBatch([
            { custom_id: VERIFY_ID, params: verifyParams({ plan, notes }) },
          ]);
          await setState(postId, "verifying", {
            ...state,
            batch: { id, kind: "verify", submitted_at: new Date().toISOString() },
          });
          return result("verifying", "verify", "Verifying claims", total - 2, total, {
            waiting: true,
            retryAfterMs: POLL_MS,
          });
        }

        const progress = await pollBatch(state.batch.id);
        if (!progress.ended) {
          return result("verifying", "verify", "Verifying claims", total - 2, total, {
            waiting: true,
            retryAfterMs: POLL_MS,
          });
        }

        const verification = await collectVerification(state.batch.id, VERIFY_ID);
        await setState(postId, "drafting", { ...state, verification, batch: undefined });
        return result(
          "drafting",
          "verify",
          `Verified ${verification.claims.length} claims, found ${verification.conflicts.length} conflicts`,
          total - 1,
          total,
        );
      }

      // ---- draft (batched: ~45s, too close to the limit to run inline) ----
      case "drafting": {
        const { plan, notes, verification } = state;
        if (!plan || !notes || !verification) throw new Error("Missing verified research.");

        if (!state.batch) {
          const archive = await archiveRefs(post);
          const id = await submitBatch([
            { custom_id: DRAFT_ID, params: draftParams({ plan, notes, verification, archive }) },
          ]);
          await setState(postId, "drafting", {
            ...state,
            archive,
            batch: { id, kind: "draft", submitted_at: new Date().toISOString() },
          });
          return result("drafting", "draft", "Writing the article", total - 1, total, {
            waiting: true,
            retryAfterMs: POLL_MS,
          });
        }

        const progress = await pollBatch(state.batch.id);
        if (!progress.ended) {
          return result("drafting", "draft", "Writing the article", total - 1, total, {
            waiting: true,
            retryAfterMs: POLL_MS,
          });
        }

        const draft = await collectDraft(state.batch.id, DRAFT_ID);
        await applyDraft(postId, draft, state);
        await saveHarvestedSources(postId, notes);
        return result("ready", "draft", "Drafted the article", total, total, { done: true });
      }

      // ---- refine (batched, same reasoning as drafting) ----
      case "refining": {
        if (!state.batch) {
          const sources = await adminListPostSources(postId);
          const params = await refineParams({
            title: post.title,
            dek: post.dek,
            body_md: post.body_md ?? "",
            sources,
            instruction: state.instruction ?? "",
          });
          const id = await submitBatch([{ custom_id: DRAFT_ID, params }]);
          await setState(postId, "refining", {
            ...state,
            batch: { id, kind: "refine", submitted_at: new Date().toISOString() },
          });
          return result("refining", "refine", "Revising with the new sources", 1, 2, {
            waiting: true,
            retryAfterMs: POLL_MS,
          });
        }

        const progress = await pollBatch(state.batch.id);
        if (!progress.ended) {
          return result("refining", "refine", "Revising with the new sources", 1, 2, {
            waiting: true,
            retryAfterMs: POLL_MS,
          });
        }

        const draft = await collectDraft(state.batch.id, DRAFT_ID);
        await applyDraft(postId, draft, state);
        return result("ready", "refine", "Revised against the new sources", 2, 2, { done: true });
      }

      default:
        return result(status, "done", "Finished", 1, 1, { done: true });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed.";
    await setState(postId, "error", state, message);
    return result("error", "error", "Failed", 0, 1, { done: true, error: message });
  }
}
