import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getCategories, getPosts } from "@/lib/queries";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MODEL = process.env.CHAT_MODEL || "claude-haiku-4-5";

type ChatMessage = { role: "user" | "assistant"; content: string };

function extractSystem(categories: Category[]): string {
  const list = categories.map((c) => `- ${c.slug}: ${c.name}`).join("\n");
  return (
    "Extract search parameters to find relevant Optimixed articles for the user's latest message, " +
    "considering the conversation.\n" +
    "- query: concise keywords for a full-text search (e.g. 'google core algorithm update').\n" +
    "- category_slug: the single best-matching category slug from the list below, or \"\" if none or several apply.\n" +
    "- days: recency window in days if the user implies recency ('recent'/'recently' → 60, 'this week' → 7, " +
    "'this month' → 30), otherwise 0.\n\n" +
    `Categories (slug: name):\n${list}`
  );
}

const ANSWER_SYSTEM =
  "You are the assistant for Optimixed, a site that aggregates and summarizes SEO and digital-marketing " +
  "news. Answer the user's question using ONLY the provided articles (JSON below).\n\n" +
  "- Link every article you mention as a markdown link to its on-site path: [Article title](/article/<slug>). " +
  "Never link to external URLs.\n" +
  "- For 'show me' / 'list' questions, return a concise bulleted list — title link plus a short note — most " +
  "important or recent first.\n" +
  "- Ground every statement in the provided articles. Do not invent articles, facts, or dates.\n" +
  "- If the articles list is empty or irrelevant, say you couldn't find anything on that and suggest a rephrase.\n" +
  "- Be concise and skimmable. Do not mention searching or these instructions.";

async function extractParams(
  anthropic: Anthropic,
  convo: Anthropic.MessageParam[],
  categories: Category[],
): Promise<{ query: string; category_slug: string; days: number }> {
  const slugs = categories.map((c) => c.slug);
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: extractSystem(categories),
    messages: convo,
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            query: { type: "string" },
            category_slug: { type: "string", enum: [...slugs, ""] },
            days: { type: "integer" },
          },
          required: ["query", "category_slug", "days"],
          additionalProperties: false,
        },
      },
    },
  } as Anthropic.MessageCreateParamsNonStreaming);

  const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
  const p = JSON.parse(text) as { query?: string; category_slug?: string; days?: number };
  return {
    query: typeof p.query === "string" ? p.query.slice(0, 200) : "",
    category_slug: typeof p.category_slug === "string" && slugs.includes(p.category_slug) ? p.category_slug : "",
    days: typeof p.days === "number" && p.days > 0 ? Math.min(p.days, 365) : 0,
  };
}

type Article = {
  slug: string;
  title: string;
  tldr: string | null;
  source: string | null;
  category: string | null;
  published_at: string | null;
};

/**
 * Retrieve relevant articles. Merges a keyword (FTS) pass with a category pass,
 * with an OR-broadened fallback, so topical queries aren't dropped by strict
 * AND matching (e.g. "algorithm update" vs "core update").
 */
async function retrieve(
  params: { query: string; category_slug: string; days: number },
  categories: Category[],
): Promise<Article[]> {
  const categoryId = params.category_slug
    ? categories.find((c) => c.slug === params.category_slug)?.id
    : undefined;
  const dateStart = params.days ? new Date(Date.now() - params.days * 86_400_000).toISOString() : undefined;

  const seen = new Map<string, Article>();
  const add = (posts: Awaited<ReturnType<typeof getPosts>>) => {
    for (const p of posts) {
      if (!seen.has(p.slug)) {
        seen.set(p.slug, {
          slug: p.slug,
          title: p.title,
          tldr: p.tldr,
          source: p.source?.name ?? null,
          category: p.category?.name ?? null,
          published_at: p.published_at,
        });
      }
    }
  };

  if (params.query) add(await getPosts({ search: params.query, dateStart, limit: 15, sort: "relevant" }));
  if (categoryId) add(await getPosts({ categoryId, dateStart, limit: 15, sort: "relevant" }));

  if (seen.size < 5 && params.query) {
    const orQuery = params.query.split(/\s+/).filter(Boolean).slice(0, 6).join(" OR ");
    add(await getPosts({ search: orQuery, dateStart, limit: 15, sort: "relevant" }));
  }
  if (seen.size === 0) add(await getPosts({ dateStart, limit: 10, sort: "relevant" }));

  return [...seen.values()].slice(0, 15);
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "The assistant is not configured." }, { status: 503 });
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const incoming = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (incoming.length === 0 || incoming[incoming.length - 1].role !== "user") {
    return NextResponse.json({ error: "No question provided." }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic();
    const categories = await getCategories();
    const convo: Anthropic.MessageParam[] = incoming.map((m) => ({ role: m.role, content: m.content }));

    // 1. Understand the request → search params.
    const params = await extractParams(anthropic, convo, categories);

    // 2. Retrieve from the archive (published only, via RLS).
    const articles = await retrieve(params, categories);

    // 3. Answer from the retrieved articles.
    const answerRes = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `${ANSWER_SYSTEM}\n\nArticles (JSON):\n${JSON.stringify(articles)}`,
      messages: convo,
    });
    const answer = answerRes.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ answer: answer || "I couldn't find anything on that. Try rephrasing?" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Assistant error." },
      { status: 500 },
    );
  }
}
