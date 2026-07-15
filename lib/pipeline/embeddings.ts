// Semantic embeddings for cross-source duplicate detection. Optional: only
// active when EMBEDDINGS_API_KEY is set. Defaults to Voyage AI (pairs well with
// Anthropic); set EMBEDDINGS_PROVIDER=openai to use OpenAI instead.

export const EMBEDDING_DIM = 1024; // matches the posts.embedding vector(1024) column
export const SIMILARITY_THRESHOLD = 0.9; // cosine similarity to treat as the same story

type Provider = "voyage" | "openai";

function config(): { key: string; provider: Provider; model: string } | null {
  const key = process.env.EMBEDDINGS_API_KEY;
  if (!key) return null;
  const provider = (process.env.EMBEDDINGS_PROVIDER as Provider) || "voyage";
  const model =
    process.env.EMBEDDINGS_MODEL ||
    (provider === "openai" ? "text-embedding-3-small" : "voyage-3.5-lite");
  return { key, provider, model };
}

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.EMBEDDINGS_API_KEY);
}

/** Embed text to a 1024-dim vector, or null when disabled / on failure. */
export async function embedText(text: string): Promise<number[] | null> {
  const cfg = config();
  if (!cfg) return null;
  const input = text.slice(0, 8000).trim();
  if (!input) return null;

  try {
    const [url, body] =
      cfg.provider === "openai"
        ? [
            "https://api.openai.com/v1/embeddings",
            { input, model: cfg.model, dimensions: EMBEDDING_DIM },
          ]
        : [
            "https://api.voyageai.com/v1/embeddings",
            { input: [input], model: cfg.model, input_type: "document", output_dimension: EMBEDDING_DIM },
          ];

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { embedding?: number[] }[] };
    return json.data?.[0]?.embedding ?? null;
  } catch {
    return null;
  }
}
