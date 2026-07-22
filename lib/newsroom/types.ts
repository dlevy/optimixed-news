/** Shapes carried in posts.generation_state between pipeline steps. */

export interface ResearchPlan {
  /** The single news event at the centre of the story, in one sentence. */
  event: string;
  /** What makes this worth Optimixed's own reporting rather than a summary. */
  angle: string;
  /** Targeted search queries — one research step runs per query. */
  queries: string[];
  /** Factual claims that must be checked at the source. */
  claims_to_verify: string[];
  /** Primary sources worth hunting for (filings, company posts, datasets). */
  primary_sources_wanted: string[];
}

export interface DiscoveredSource {
  url: string;
  title: string | null;
  publisher: string | null;
}

export interface ResearchNote {
  query: string;
  /** The model's findings for this query, with inline attribution. */
  findings: string;
  /** Sources actually consulted, harvested from the server-tool result blocks. */
  sources: DiscoveredSource[];
}

export type ClaimStatus =
  | "Confirmed"
  | "Company claim"
  | "Independent data"
  | "Disputed"
  | "Unverified";

export interface VerifiedClaim {
  claim: string;
  status: ClaimStatus;
  basis: string;
}

export interface Verification {
  claims: VerifiedClaim[];
  /** Explicit disagreements between sources: who says what. */
  conflicts: string[];
  /** Questions no source can currently answer. */
  open_questions: string[];
}

/** Prior Optimixed coverage offered to the drafting step for internal links. */
export interface ArchiveRef {
  slug: string;
  title: string;
  published_at: string | null;
}

export interface BatchProgress {
  ended: boolean;
  processing: number;
  succeeded: number;
  errored: number;
}

/** An in-flight Message Batches job the pipeline is waiting on. */
export interface PendingBatch {
  id: string;
  kind: "research" | "draft" | "refine";
  submitted_at: string;
}

export interface GenerationState {
  plan?: ResearchPlan;
  notes?: ResearchNote[];
  verification?: Verification;
  archive?: ArchiveRef[];
  batch?: PendingBatch;
  instruction?: string;
  /** Wall-clock ms per stage — surfaced in the admin so slow steps are visible. */
  timings?: Record<string, number>;
}

/** What one step reports back to the browser driving the loop. */
export interface StepResult {
  status: string;
  stage: string;
  label: string;
  done: boolean;
  /** Progress within the current stage. */
  step: number;
  total: number;
  /** True while an off-platform batch is still running. */
  waiting?: boolean;
  /** How long the client should wait before asking again. */
  retryAfterMs?: number;
  error?: string;
}
