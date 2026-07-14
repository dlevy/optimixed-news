import Anthropic from "@anthropic-ai/sdk";
import type { Category } from "@/lib/types";

export interface Classification {
  categorySlug: string | null;
  tldr: string;
  summary: string;
}

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic();
  return client;
}

/**
 * Classify one article into a category and generate a TLDR + summary.
 * Uses Claude Haiku 4.5 with a structured-output schema so the category is
 * constrained to the exact set of known slugs.
 */
export async function classifyArticle(
  input: { title: string; excerpt: string | null },
  categories: Category[],
): Promise<Classification> {
  const slugs = categories.map((c) => c.slug);
  const list = categories.map((c) => `- ${c.slug}: ${c.name}`).join("\n");

  const res = await anthropic().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 512,
    system:
      "You categorize SEO and digital-marketing news articles and write concise summaries. " +
      "Choose the single best-fitting category. Write a one-sentence TLDR and a 2–3 sentence " +
      "neutral summary. Never invent facts beyond the provided text.",
    messages: [
      {
        role: "user",
        content:
          `Categories:\n${list}\n\n` +
          `Article title: ${input.title}\n` +
          `Article excerpt: ${input.excerpt ?? "(none provided)"}`,
      },
    ],
    // Structured output — supported on Haiku 4.5.
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            category_slug: { type: "string", enum: slugs },
            tldr: { type: "string" },
            summary: { type: "string" },
          },
          required: ["category_slug", "tldr", "summary"],
          additionalProperties: false,
        },
      },
    },
  } as Anthropic.MessageCreateParamsNonStreaming);

  if (res.stop_reason === "refusal") {
    return { categorySlug: null, tldr: input.title, summary: input.excerpt ?? "" };
  }

  const text = res.content.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = JSON.parse(text) as { category_slug?: string; tldr?: string; summary?: string };
  const categorySlug =
    parsed.category_slug && slugs.includes(parsed.category_slug) ? parsed.category_slug : null;

  return {
    categorySlug,
    tldr: parsed.tldr?.trim() || input.title,
    summary: parsed.summary?.trim() || input.excerpt || "",
  };
}
