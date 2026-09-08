"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Problem } from "@/domain/problem/Problem";
import type { AttemptSnapshot } from "@/domain/attempt/Attempt";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { EvaluationView } from "@/components/EvaluationView";

/**
 * Attempt review screen. Evaluation is explicitly a fallible process, not an
 * instant grade: while EVALUATING, this polls every 2.5s; FAILED shows the
 * reason with a retry; EVALUATED renders the full structured review.
 */
export function AttemptReview({
  problem,
  initial,
  previousScore,
}: {
  problem: Problem;
  initial: AttemptSnapshot;
  previousScore: number | null;
}) {
  const router = useRouter();
  const [attempt, setAttempt] = useState<AttemptSnapshot>(initial);
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const fresh = await api.getAttempt(initial.id);
      setAttempt(fresh);
    } catch {
      // transient network error — the next tick will retry
    }
  }, [initial.id]);

  const active = attempt.status === "EVALUATING" || attempt.status === "SUBMITTED";

  useEffect(() => {
    if (!active) return;
    pollTimer.current ??= setInterval(refresh, 2500);
    return () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
  }, [active, refresh]);

  async function retry() {
    setRetrying(true);
    setActionError(null);
    try {
      const fresh = await api.retryEvaluation(attempt.id);
      setAttempt(fresh);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetrying(false);
    }
  }

  async function tryAgain() {
    try {
      const next = await api.startAttempt(problem.slug);
      router.push(`/practice/${next.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not start a new attempt.");
    }
  }

  const evaluating = attempt.status === "EVALUATING" || attempt.status === "SUBMITTED";
  const delta =
    attempt.evaluation && previousScore !== null
      ? attempt.evaluation.overallScore - previousScore
      : null;

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href={`/problems/${problem.slug}`} className="microlabel transition hover:!text-amber">
            ← {problem.title}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-paper">
            Attempt #{attempt.attemptNumber}
          </h1>
          <p className="mt-1 font-mono text-xs text-faint">
            {attempt.submittedAt
              ? `submitted ${new Date(attempt.submittedAt).toLocaleString()}`
              : "draft"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {delta !== null && delta !== 0 && (
            <span
              className={`border px-2 py-0.5 font-mono text-xs ${
                delta > 0 ? "border-good/50 text-good" : "border-bad/50 text-bad"
              }`}
            >
              {delta > 0 ? `+${delta}` : delta} vs previous
            </span>
          )}
          <StatusBadge status={attempt.status} />
        </div>
      </header>

      {actionError && (
        <p className="mb-6 border border-bad/40 bg-bad/5 px-4 py-3 text-sm text-bad" role="alert">
          {actionError}
        </p>
      )}

      {evaluating && <EvaluatingPanel />}

      {attempt.status === "FAILED" && (
        <div className="border border-bad/40 bg-bad/5 p-6" role="alert">
          <p className="font-mono text-xs tracking-[0.12em] text-bad uppercase">
            Evaluation failed
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            The review could not be completed — {attempt.failureReason ?? "unknown error"}. Your
            submission is safe and the review can be retried.
          </p>
          <button
            onClick={retry}
            disabled={retrying}
            className="mt-4 border border-bad/60 px-4 py-2 font-mono text-xs tracking-[0.12em] text-bad uppercase transition hover:bg-bad/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? "Retrying…" : "Retry evaluation"}
          </button>
        </div>
      )}

      {attempt.status === "EVALUATED" && attempt.evaluation && (
        <EvaluationView evaluation={attempt.evaluation} />
      )}

      {attempt.status === "DRAFT" && (
        <div className="border border-line bg-panel p-8 text-center">
          <p className="text-sm text-muted">This attempt is still a draft.</p>
          <Link
            href={`/practice/${attempt.id}`}
            className="mt-4 inline-block bg-amber px-5 py-2.5 font-mono text-sm font-semibold text-ink transition hover:bg-amber/85"
          >
            Continue designing →
          </Link>
        </div>
      )}

      {attempt.status === "EVALUATED" && (
        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Fastest way to improve: pick the highest-severity issues above, redesign, and start
            a fresh attempt to compare scores.
          </p>
          <div className="flex gap-3">
            <Link
              href="/attempts"
              className="border border-line px-4 py-2.5 font-mono text-xs tracking-[0.12em] text-muted uppercase transition hover:border-line-strong hover:text-paper"
            >
              All history
            </Link>
            <button
              onClick={tryAgain}
              className="bg-amber px-5 py-2.5 font-mono text-sm font-semibold text-ink transition hover:bg-amber/85"
            >
              Try again →
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

function EvaluatingPanel() {
  return (
    <div className="mb-10 border border-info/30 bg-info/[0.04] p-8 text-center" role="status" aria-live="polite">
      <div className="mx-auto mb-4 flex w-fit gap-1.5" aria-hidden>
        <span className="size-2 animate-pulse rounded-full bg-info" />
        <span className="size-2 animate-pulse rounded-full bg-info [animation-delay:250ms]" />
        <span className="size-2 animate-pulse rounded-full bg-info [animation-delay:500ms]" />
      </div>
      <p className="font-mono text-sm tracking-[0.08em] text-info uppercase">Review in progress</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        Deterministic checks run first, then the design is reasoned over. This usually takes
        under a minute — the page updates automatically.
      </p>
      <div className="mx-auto mt-6 max-w-md space-y-2 text-left" aria-hidden>
        <div className="h-2 w-3/4 animate-pulse bg-line" />
        <div className="h-2 w-1/2 animate-pulse bg-line [animation-delay:300ms]" />
      </div>
    </div>
  );
}
