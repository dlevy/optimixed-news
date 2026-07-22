import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySessionToken } from "@/lib/admin-auth";
import { cancelGeneration, runNextStep, startGeneration, startRefine } from "@/lib/newsroom/run";

/**
 * Drives the newsroom pipeline one stage per request.
 *
 * The editor calls this in a loop: each response says what just finished and
 * whether more work remains. Splitting it this way keeps every stage inside a
 * single function invocation, so long research runs never hit the platform's
 * request timeout.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  postId?: string;
  action?: "generate" | "refine" | "step" | "cancel";
  instruction?: string;
};

export async function POST(req: Request) {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(ADMIN_COOKIE)?.value))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const postId = body.postId;
  if (!postId) return NextResponse.json({ error: "Missing article id." }, { status: 400 });

  try {
    switch (body.action) {
      case "generate":
        await startGeneration(postId);
        break;
      case "refine":
        await startRefine(postId, (body.instruction ?? "").slice(0, 2000));
        break;
      case "cancel":
        await cancelGeneration(postId);
        return NextResponse.json({ status: "idle", stage: "cancelled", label: "Cancelled", step: 0, total: 1, done: true });
      case "step":
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json(await runNextStep(postId));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed." },
      { status: 500 },
    );
  }
}
