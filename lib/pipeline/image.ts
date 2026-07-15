import { Jimp } from "jimp";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "thumbnails";
const MAX_WIDTH = 480; // small thumbnail — keeps storage + bandwidth low
const USER_AGENT = "OptimixedBot/1.0 (+https://www.optimixed.com)";

/**
 * Download a source image, resize it to a small JPEG, upload to our Storage
 * bucket, and return the public URL. Returns null on any failure so ingestion
 * never breaks on a bad image. Same source URL → same path (deduped).
 */
export async function processThumbnail(
  sb: SupabaseClient,
  imageUrl: string | null,
): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;

    const input = Buffer.from(await res.arrayBuffer());
    if (input.byteLength === 0) return null;

    const image = await Jimp.fromBuffer(input);
    if (image.width > MAX_WIDTH) image.resize({ w: MAX_WIDTH }); // height auto, aspect kept
    const output = await image.getBuffer("image/jpeg", { quality: 72 });

    const path = `${createHash("sha1").update(imageUrl).digest("hex").slice(0, 20)}.jpg`;
    const { error } = await sb.storage
      .from(BUCKET)
      .upload(path, output, { contentType: "image/jpeg", upsert: true });
    if (error) return null;

    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}
