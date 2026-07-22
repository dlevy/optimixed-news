import Anthropic from "@anthropic-ai/sdk";
import type { Category } from "@/lib/types";
import { ARTICLE_TYPES, CONFIDENCE_LEVELS, TIMELINESS_LEVELS } from "@/lib/article-meta";

export { ARTICLE_TYPES, CONFIDENCE_LEVELS, TIMELINESS_LEVELS };

export interface Classification {
  categorySlug: string | null;
  secondaryCategorySlugs: string[];
  articleType: string | null;
  importance: number | null; // 0–100
  importanceReason: string | null;
  confidence: string | null;
  timeliness: string | null;
  tldr: string;
  summary: string;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic();
  return client;
}

const SYSTEM =
  "You analyze SEO and digital-marketing news articles. For each article you: pick the single " +
  "best primary category and up to 3 distinct secondary categories; classify the article type; " +
  "rate importance/newsworthiness 0–100; judge the confidence level of its claims; judge how " +
  "time-sensitive it is; and write a one-sentence TLDR plus a 2–3 sentence neutral summary. " +
  "Never invent facts beyond the provided text.\n\n" +
  "Importance rubric: 0–20 trivial, 21–40 routine, 41–60 notable, 61–80 significant, " +
  "81–100 major/industry-defining. Give a one-line reason.\n" +
  "Article type: news (reporting), opinion (editorial/commentary), analysis (interpretation of " +
  "data/trends), guide (how-to/tutorial), research (studies/original data), case-study, " +
  "product-announcement, interview, roundup (link digest/recap).\n" +
  "Confidence: confirmed (verified facts), speculation (analysis of what might happen), opinion " +
  "(author's viewpoint), rumor (unverified reports).\n" +
  "Timeliness: breaking (urgent, just happened), timely (current but not urgent), evergreen " +
  "(stays relevant over time).";

export async function classifyArticle(
  input: { title: string; excerpt: string | null },
  categories: Category[],
): Promise<Classification> {
  const slugs = categories.map((c) => c.slug);
  const list = categories.map((c) => `- ${c.slug}: ${c.name}`).join("\n");

  const res = await anthropic().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 700,
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Categories:\n${list}\n\n` +
          `Article title: ${input.title}\n` +
          `Article excerpt: ${input.excerpt ?? "(none provided)"}`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            category_slug: { type: "string", enum: slugs },
            secondary_category_slugs: { type: "array", items: { type: "string", enum: slugs } },
            article_type: { type: "string", enum: [...ARTICLE_TYPES] },
            importance: { type: "integer" },
            importance_reason: { type: "string" },
            confidence: { type: "string", enum: [...CONFIDENCE_LEVELS] },
            timeliness: { type: "string", enum: [...TIMELINESS_LEVELS] },
            tldr: { type: "string" },
            summary: { type: "string" },
          },
          required: [
            "category_slug",
            "secondary_category_slugs",
            "article_type",
            "importance",
            "importance_reason",
            "confidence",
            "timeliness",
            "tldr",
            "summary",
          ],
          additionalProperties: false,
        },
      },
    },
  } as Anthropic.MessageCreateParamsNonStreaming);

  if ((res.stop_reason as string) === "refusal") {
    return {
      categorySlug: null,
      secondaryCategorySlugs: [],
      articleType: null,
      importance: null,
      importanceReason: null,
      confidence: null,
      timeliness: null,
      tldr: input.title,
      summary: input.excerpt ?? "",
    };
  }

  const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
  const p = JSON.parse(text) as Record<string, unknown>;

  const inList = (v: unknown, allow: readonly string[]): string | null =>
    typeof v === "string" && allow.includes(v) ? v : null;

  const categorySlug = inList(p.category_slug, slugs);
  const secondary = Array.isArray(p.secondary_category_slugs)
    ? [...new Set(p.secondary_category_slugs.filter((s): s is string => typeof s === "string"))]
        .filter((s) => slugs.includes(s) && s !== categorySlug)
        .slice(0, 3)
    : [];
  const importance =
    typeof p.importance === "number" ? Math.max(0, Math.min(100, Math.round(p.importance))) : null;

  return {
    categorySlug,
    secondaryCategorySlugs: secondary,
    articleType: inList(p.article_type, ARTICLE_TYPES),
    importance,
    importanceReason: typeof p.importance_reason === "string" ? p.importance_reason.trim() : null,
    confidence: inList(p.confidence, CONFIDENCE_LEVELS),
    timeliness: inList(p.timeliness, TIMELINESS_LEVELS),
    tldr: typeof p.tldr === "string" && p.tldr.trim() ? p.tldr.trim() : input.title,
    summary: typeof p.summary === "string" && p.summary.trim() ? p.summary.trim() : input.excerpt ?? "",
  };
}
