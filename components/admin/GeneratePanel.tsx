"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/md/Icon";
import { clsx } from "@/lib/clsx";
import type { GenerationStatus } from "@/lib/types";

/**
 * Drives generation from the browser: one request per stage, looping until the
 * pipeline reports it is done. Keeping the loop client-side means each stage
 * gets its own request budget without needing a queue service, and the progress
 * readout comes for free.
 *
 * Closing the tab is safe — progress is persisted server-side, and reopening
 * the editor offers Resume.
 */

type Step = {
  status: string;
  stage: string;
  label: string;
  step: number;
  total: number;
  done: boolean;
  waiting?: boolean;
  retryAfterMs?: number;
  error?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RUNNING: GenerationStatus[] = ["planning", "researching", "verifying", "drafting", "refining"];

const STATUS_LABEL: Record<string, string> = {
  planning: "Planning the reporting…",
  researching: "Researching sources…",
  verifying: "Verifying claims…",
  drafting: "Writing the article…",
  refining: "Revising with new sources…",
};

export function GeneratePanel({
  postId,
  status,
  hasBody,
  error,
}: {
  postId: string;
  status: GenerationStatus;
  hasBody: boolean;
  error?: string | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [failure, setFailure] = useState<string | null>(error ?? null);
  const [instruction, setInstruction] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const cancelled = useRef(false);

  const call = useCallback(
    async (action: "generate" | "refine" | "step" | "cancel"): Promise<Step> => {
      const res = await fetch("/api/newsroom/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action, instruction }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed.");
      return data as Step;
    },
    [postId, instruction],
  );

  const loop = useCallback(
    async (first: "generate" | "refine" | "step") => {
      cancelled.current = false;
      setRunning(true);
      setFailure(null);
      setLog([]);
      try {
        let current = await call(first);
        setStep(current);
        if (current.label) setLog([current.label]);

        // Each iteration is one short request. While an off-platform batch is
        // running the server says "waiting" and how long to hold off, so we
        // poll on its schedule instead of hammering the endpoint.
        while (!current.done && !cancelled.current) {
          if (current.waiting) await sleep(current.retryAfterMs ?? 15_000);
          if (cancelled.current) break;

          const previous = current;
          current = await call("step");
          setStep(current);
          if (current.error) throw new Error(current.error);
          // Polling repeats the same label — replace it rather than stacking.
          if (current.label) {
            setLog((l) =>
              previous.waiting && previous.stage === current.stage
                ? [...l.slice(0, -1), current.label]
                : [...l, current.label],
            );
          }
        }
        if (current.error) throw new Error(current.error);
      } catch (e) {
        setFailure(e instanceof Error ? e.message : "Generation failed.");
      } finally {
        setRunning(false);
        router.refresh();
      }
    },
    [call, router],
  );

  const cancel = useCallback(async () => {
    cancelled.current = true;
    setRunning(false);
    try {
      await call("cancel");
    } finally {
      router.refresh();
    }
  }, [call, router]);

  const midRun = RUNNING.includes(status);
  const pct = step && step.total > 0 ? Math.round((step.step / step.total) * 100) : 0;

  return (
    <section className="rounded-lg border border-outline-variant bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Icon name="auto_awesome" className="text-[20px] text-on-surface-variant" />
        <h2 className="text-title-medium text-on-surface">Newsroom</h2>
        {status === "ready" && !running && (
          <span className="ml-auto text-label-small px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container">
            Drafted
          </span>
        )}
      </div>

      {running && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-body-small text-on-surface">
            <span className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            {STATUS_LABEL[step?.status ?? status] ?? "Working…"}
          </div>
          <div className="h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(pct, 4)}%` }}
            />
          </div>
          {log.length > 0 && (
            <ol className="flex flex-col gap-1 text-label-small text-on-surface-variant max-h-40 overflow-y-auto">
              {log.map((l, i) => (
                <li key={i} className="flex gap-1.5">
                  <Icon name="check" className="text-[14px] text-primary shrink-0" />
                  <span className="line-clamp-2">{l}</span>
                </li>
              ))}
            </ol>
          )}
          <button
            onClick={cancel}
            className="self-start h-8 px-3 rounded-full text-label-large text-on-surface-variant hover:bg-on-surface/8"
          >
            Cancel
          </button>
          <p className="text-label-small text-on-surface-variant">
            Research runs off-site and takes a few minutes. You can close this tab — progress is
            saved after every stage, and reopening the editor offers Resume.
          </p>
        </div>
      )}

      {!running && failure && (
        <div className="rounded-sm bg-error-container text-on-error-container p-3 text-body-small">
          {failure}
        </div>
      )}

      {!running && midRun && (
        <div className="flex flex-col gap-2">
          <p className="text-body-small text-on-surface-variant">
            A run was interrupted at “{STATUS_LABEL[status] ?? status}”.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => loop("step")}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-primary text-on-primary text-label-large hover:shadow-e1"
            >
              <Icon name="play_arrow" className="text-[18px]" />
              Resume
            </button>
            <button
              onClick={cancel}
              className="h-10 px-4 rounded-full text-label-large text-on-surface-variant hover:bg-on-surface/8"
            >
              Discard run
            </button>
          </div>
        </div>
      )}

      {!running && !midRun && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => loop("generate")}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-primary text-on-primary text-label-large hover:shadow-e1"
            >
              <Icon name="auto_awesome" className="text-[18px]" />
              {hasBody ? "Regenerate from scratch" : "Research & write"}
            </button>
            <p className="text-label-small text-on-surface-variant">
              Researches primary sources, verifies each claim, then writes an original article.
              Takes a few minutes.
              {hasBody && " The current copy is saved to revisions first."}
            </p>
          </div>

          {hasBody && (
            <div className="flex flex-col gap-2 border-t border-outline-variant pt-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-label-large text-on-surface-variant">
                  Refine with the sources you’ve added
                </span>
                <textarea
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  rows={2}
                  placeholder="Optional: what should change? e.g. “lead with the pricing angle”"
                  className={clsx(
                    "w-full rounded-xs border border-outline bg-surface px-3 py-2",
                    "text-body-medium text-on-surface focus:outline-2 focus:outline-offset-[-1px] focus:outline-primary",
                  )}
                />
              </label>
              <button
                onClick={() => loop("refine")}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-secondary-container text-on-secondary-container text-label-large hover:shadow-e1"
              >
                <Icon name="edit_note" className="text-[18px]" />
                Refine
              </button>
              <p className="text-label-small text-on-surface-variant">
                Keeps the existing article and works the new sources in — screenshots are read
                directly. Repeat as many times as you like.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
