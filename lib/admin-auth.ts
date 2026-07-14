/**
 * Minimal single-admin auth: a password gate that sets an HMAC-signed cookie.
 * Uses Web Crypto so the same helpers run in Edge middleware and Node actions.
 *
 * Set ADMIN_PASSWORD in the environment. Without it, the admin area is locked
 * (no password can succeed).
 */

export const ADMIN_COOKIE = "optx_admin";
const TOKEN_MESSAGE = "optimixed-admin-session-v1";

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

/** The signed session token to store in the cookie. */
export async function makeSessionToken(): Promise<string | null> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  return hmac(TOKEN_MESSAGE, secret);
}

/** Verify a cookie value against the current ADMIN_PASSWORD. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await makeSessionToken();
  if (!expected) return false;
  return timingSafeEqual(token, expected);
}

/** Check a submitted password. */
export function checkPassword(password: string): boolean {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  return timingSafeEqual(password, secret);
}
