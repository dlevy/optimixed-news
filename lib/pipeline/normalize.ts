import { createHash } from "crypto";

// Query params that never identify the article — stripped during canonicalization.
const TRACKING_PARAM =
  /^(utm_|mc_|_hs|hsa_|hsctatracking|vero_|pk_|piwik_|matomo_|oly_|_openstat|trk_|cmpid|spm)/i;
const TRACKING_EXACT = new Set([
  "fbclid", "gclid", "gclsrc", "dclid", "wbraid", "gbraid", "msclkid", "yclid",
  "igshid", "igsh", "mkt_tok", "ref", "ref_src", "ref_url", "referrer", "source",
  "cmpid", "_ga", "_gl", "s_kwcid", "ncid", "cid", "recip",
]);

function isTracking(key: string): boolean {
  return TRACKING_PARAM.test(key) || TRACKING_EXACT.has(key.toLowerCase());
}

/**
 * Canonicalize a URL so superficial variants map to one key:
 * lowercase host, drop #fragment, remove tracking params, sort remaining
 * params, and strip a trailing slash. Scheme and `www` are left intact so the
 * "read original" link keeps working.
 */
export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    const kept = [...u.searchParams.entries()]
      .filter(([k]) => !isTracking(k))
      .sort((a, b) => a[0].localeCompare(b[0]));
    u.search = "";
    for (const [k, v] of kept) u.searchParams.append(k, v);
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/**
 * Stable fingerprint of a headline: lowercased, punctuation/whitespace
 * collapsed, hashed. Two titles that differ only in casing/punctuation share a
 * key — used to catch a republish at a new URL (and near-identical headlines).
 */
export function titleKey(title: string): string {
  const norm = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return createHash("sha1").update(norm).digest("hex").slice(0, 16);
}
