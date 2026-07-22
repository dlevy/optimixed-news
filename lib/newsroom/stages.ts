import Anthropic from "@anthropic-ai/sdk";
import {
  PLAN_SYSTEM,
  RESEARCH_SYSTEM,
  REFINE_SYSTEM,
  VERIFY_SYSTEM,
  draftSystem,
} from "@/lib/newsroom/prompts";
import type {
  ArchiveRef,
  BatchProgress,
  DiscoveredSource,
  ResearchNote,
  ResearchPlan,
  Verification,
} from "@/lib/newsroom/types";
import type { PostSource } from "@/lib/types";

/**
 * The research and drafting calls take minutes — far longer than a serverless
 * function may run. They are therefore submitted to the Message Batches API,
 * which executes them off-platform; the pipeline just submits, polls, and
 * collects, and every one of those requests is short.
 *
 * Planning and verification are fast enough (13s / 24s measured) to run inline.
 */

export const DRAFT_MODEL = process.env.NEWSROOM_DRAFT_MODEL || "claude-opus-4-8";
export const REFINE_MODEL = process.env.NEWSROOM_REFINE_MODEL || "claude-sonnet-5";

type Params = Anthropic.MessageCreateParamsNonStreaming;

function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set — generation is unavailable.");
  }
  return new Anthropic();
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function jsonOf<T>(message: Anthropic.Message): T {
  return JSON.parse(textOf(message) || "{}") as T;
}

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Harvest the URLs the model actually opened, from the server-tool result
 * blocks. More reliable than parsing citations out of prose, and it becomes the
 * article's attribution list.
 */
function harvestSources(message: Anthropic.Message): DiscoveredSource[] {
  const out = new Map<string, DiscoveredSource>();
  for (const block of message.content as unknown as Record<string, unknown>[]) {
    const type = block.type as string;
    if (type !== "web_search_tool_result" && type !== "web_fetch_tool_result") continue;

    const content = block.content as unknown;
    const items = Array.isArray(content) ? content : [content];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const doc = (rec.content ?? rec) as Record<string, unknown>;
      const url = (rec.url ?? doc.url) as string | undefined;
      if (!url || out.has(url)) continue;
      out.set(url, {
        url,
        title: ((rec.title ?? doc.title) as string) ?? null,
        publisher: hostname(url),
      });
    }
  }
  return [...out.values()];
}

const DRAFT_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    body_md: { type: "string" },
  },
  required: ["headline", "dek", "body_md"],
  additionalProperties: false,
} as const;

// ---------------------------------------------------------------- //
// Request builders (shared by inline calls and batch submission)
// ---------------------------------------------------------------- //

export function researchParams(plan: ResearchPlan, query: string): Params {
  return {
    model: DRAFT_MODEL,
    max_tokens: 3000,
    system: RESEARCH_SYSTEM,
    tools: [
      { type: "web_search_20260209", name: "web_search", max_uses: 3 },
      { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 },
    ],
    messages: [
      {
        role: "user",
        content:
          `Story: ${plan.event}\n\n` +
          `Claims this story depends on:\n${plan.claims_to_verify.map((c) => `- ${c}`).join("\n")}\n\n` +
          `Research this specific question and report your findings:\n${query}`,
      },
    ],
  } as unknown as Params;
}

export function draftParams(input: {
  plan: ResearchPlan;
  notes: ResearchNote[];
  verification: Verification;
  archive: ArchiveRef[];
}): Params {
  const notes = input.notes
    .map((n, i) => `### Research ${i + 1}: ${n.query}\n${n.findings}`)
    .join("\n\n");
  const claims = input.verification.claims
    .map((c) => `- [${c.status}] ${c.claim} — ${c.basis}`)
    .join("\n");

  return {
    model: DRAFT_MODEL,
    max_tokens: 8000,
    system: draftSystem(input.archive),
    messages: [
      {
        role: "user",
        content:
          `Story: ${input.plan.event}\n` +
          `Angle: ${input.plan.angle}\n\n` +
          `Verified claims:\n${claims}\n\n` +
          `Conflicts:\n${input.verification.conflicts.map((c) => `- ${c}`).join("\n") || "(none recorded)"}\n\n` +
          `Open questions:\n${input.verification.open_questions.map((q) => `- ${q}`).join("\n") || "(none recorded)"}\n\n` +
          `Research notes:\n\n${notes}\n\n` +
          `Write the article.`,
      },
    ],
    output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
  } as unknown as Params;
}

/** Screenshots are sent as images so the model reads the post itself. */
async function imageBlock(url: string): Promise<Anthropic.ImageBlockParam | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    if (!/^image\/(png|jpeg|gif|webp)$/.test(type)) return null;
    const data = Buffer.from(await res.arrayBuffer()).toString("base64");
    return { type: "image", source: { type: "base64", media_type: type as "image/png", data } };
  } catch {
    return null;
  }
}

export async function refineParams(input: {
  title: string;
  dek: string | null;
  body_md: string;
  sources: PostSource[];
  instruction: string;
}): Promise<Params> {
  const content: Anthropic.ContentBlockParam[] = [];

  const written = input.sources
    .filter((s) => s.kind !== "screenshot")
    .map(
      (s) =>
        `- ${[s.publisher, s.title].filter(Boolean).join(" — ") || "Source"}${
          s.url ? ` (${s.url})` : ""
        }${s.note ? `\n  Editor's note: ${s.note}` : ""}`,
    )
    .join("\n");

  content.push({
    type: "text",
    text:
      `Current article\n\nHeadline: ${input.title}\nDek: ${input.dek ?? "(none)"}\n\n${input.body_md}\n\n` +
      `---\n\nSources now attached:\n${written || "(none in text form)"}` +
      (input.instruction ? `\n\nEditor's instruction: ${input.instruction}` : ""),
  });

  for (const s of input.sources) {
    if (s.kind !== "screenshot" || !s.image_url) continue;
    const img = await imageBlock(s.image_url);
    if (!img) continue;
    content.push(img);
    content.push({
      type: "text",
      text: `Screenshot above — ${s.title ?? "supplied by the editor"}.${
        s.note ? ` Editor's note: ${s.note}` : ""
      } Read it and treat what it shows as a primary source.`,
    });
  }

  content.push({ type: "text", text: "Return the complete revised article." });

  return {
    model: REFINE_MODEL,
    max_tokens: 8000,
    system: REFINE_SYSTEM,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema: DRAFT_SCHEMA } },
  } as unknown as Params;
}

// ---------------------------------------------------------------- //
// Inline stages (fast enough for a single request)
// ---------------------------------------------------------------- //

export async function planStage(input: {
  title: string;
  seedSummary: string;
  sources: PostSource[];
}): Promise<ResearchPlan> {
  const seeds = input.sources
    .map((s) => `- ${s.publisher ?? "source"}: ${s.title ?? s.url ?? s.note ?? ""} ${s.url ?? ""}`)
    .join("\n");

  const res = await client().messages.create({
    model: DRAFT_MODEL,
    max_tokens: 2000,
    system: PLAN_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Seed coverage headline: ${input.title}\n\n` +
          `What that coverage says:\n${input.seedSummary || "(no summary available)"}\n\n` +
          `Sources already attached:\n${seeds || "(none)"}\n\n` +
          `Produce the research plan.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            event: { type: "string" },
            angle: { type: "string" },
            // Count is constrained in PLAN_SYSTEM — the validator rejects minItems > 1.
            queries: { type: "array", items: { type: "string" } },
            claims_to_verify: { type: "array", items: { type: "string" } },
            primary_sources_wanted: { type: "array", items: { type: "string" } },
          },
          required: ["event", "angle", "queries", "claims_to_verify", "primary_sources_wanted"],
          additionalProperties: false,
        },
      },
    },
  } as Params);

  return jsonOf<ResearchPlan>(res);
}

/**
 * Batched rather than inline: cost scales with how much research came back
 * (42.9s measured against 90 sources, versus 24s against 47), so it would
 * eventually cross the request limit on a well-researched story.
 */
export function verifyParams(input: { plan: ResearchPlan; notes: ResearchNote[] }): Params {
  const notes = input.notes
    .map((n, i) => `### Research ${i + 1}: ${n.query}\n${n.findings}`)
    .join("\n\n");

  return {
    model: DRAFT_MODEL,
    max_tokens: 4000,
    system: VERIFY_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Story: ${input.plan.event}\n\n` +
          `Claims flagged for verification:\n${input.plan.claims_to_verify.map((c) => `- ${c}`).join("\n")}\n\n` +
          `Research notes:\n\n${notes}`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            claims: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  claim: { type: "string" },
                  status: {
                    type: "string",
                    enum: ["Confirmed", "Company claim", "Independent data", "Disputed", "Unverified"],
                  },
                  basis: { type: "string" },
                },
                required: ["claim", "status", "basis"],
                additionalProperties: false,
              },
            },
            conflicts: { type: "array", items: { type: "string" } },
            open_questions: { type: "array", items: { type: "string" } },
          },
          required: ["claims", "conflicts", "open_questions"],
          additionalProperties: false,
        },
      },
    },
  } as unknown as Params;
}

export async function collectVerification(
  batchId: string,
  customId: string,
): Promise<Verification> {
  const messages = await collect(batchId);
  const message = messages.get(customId);
  if (!message) throw new Error("The verification request did not complete. Try again.");
  return jsonOf<Verification>(message);
}

// Direct calls used by the CLI timing spike; the web pipeline batches these.

export async function researchStage(input: {
  plan: ResearchPlan;
  query: string;
}): Promise<ResearchNote> {
  const res = await client().messages.create(researchParams(input.plan, input.query));
  return { query: input.query, findings: textOf(res), sources: harvestSources(res) };
}

export async function verifyStage(input: {
  plan: ResearchPlan;
  notes: ResearchNote[];
}): Promise<Verification> {
  return jsonOf<Verification>(await client().messages.create(verifyParams(input)));
}

// ---------------------------------------------------------------- //
// Batch submission / polling / collection
// ---------------------------------------------------------------- //

type BatchesAPI = {
  create(body: { requests: { custom_id: string; params: Params }[] }): Promise<{ id: string }>;
  retrieve(id: string): Promise<{
    processing_status: string;
    request_counts: Record<string, number>;
  }>;
  results(id: string): Promise<AsyncIterable<BatchResultRow>>;
  cancel(id: string): Promise<unknown>;
};

type BatchResultRow = {
  custom_id: string;
  result:
    | { type: "succeeded"; message: Anthropic.Message }
    | { type: "errored" | "canceled" | "expired"; error?: unknown };
};

function batches(): BatchesAPI {
  return client().messages.batches as unknown as BatchesAPI;
}

export async function submitBatch(requests: { custom_id: string; params: Params }[]): Promise<string> {
  const batch = await batches().create({ requests });
  return batch.id;
}

export async function pollBatch(batchId: string): Promise<BatchProgress> {
  const b = await batches().retrieve(batchId);
  const counts = b.request_counts ?? {};
  return {
    ended: b.processing_status === "ended",
    processing: counts.processing ?? 0,
    succeeded: counts.succeeded ?? 0,
    errored: (counts.errored ?? 0) + (counts.expired ?? 0) + (counts.canceled ?? 0),
  };
}

export async function cancelBatch(batchId: string): Promise<void> {
  try {
    await batches().cancel(batchId);
  } catch {
    // Already ended — nothing to cancel.
  }
}

async function collect(batchId: string): Promise<Map<string, Anthropic.Message>> {
  const out = new Map<string, Anthropic.Message>();
  const rows = await batches().results(batchId);
  for await (const row of rows) {
    if (row.result.type === "succeeded") out.set(row.custom_id, row.result.message);
  }
  return out;
}

export function researchRequests(plan: ResearchPlan): { custom_id: string; params: Params }[] {
  return plan.queries.map((q, i) => ({ custom_id: `research-${i}`, params: researchParams(plan, q) }));
}

/** Collect research results; a failed request yields an empty note rather than sinking the run. */
export async function collectResearch(
  batchId: string,
  plan: ResearchPlan,
): Promise<ResearchNote[]> {
  const messages = await collect(batchId);
  return plan.queries.map((query, i) => {
    const message = messages.get(`research-${i}`);
    if (!message) return { query, findings: "(this research request did not complete)", sources: [] };
    return { query, findings: textOf(message), sources: harvestSources(message) };
  });
}

export interface Draft {
  headline: string;
  dek: string;
  body_md: string;
}

export async function collectDraft(batchId: string, customId: string): Promise<Draft> {
  const messages = await collect(batchId);
  const message = messages.get(customId);
  if (!message) throw new Error("The writing request did not complete. Try again.");
  return jsonOf<Draft>(message);
}
