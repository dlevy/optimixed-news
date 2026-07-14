import { NextResponse } from "next/server";
import { runIngestion } from "@/lib/pipeline/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // seconds — allow the full run

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const provided = bearer ?? req.headers.get("x-cron-secret");
  return provided === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runIngestion();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// Vercel Cron issues GET (with the auto-injected Bearer secret); manual triggers can POST.
export const GET = handle;
export const POST = handle;
