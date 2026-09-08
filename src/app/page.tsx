import Link from "next/link";
import { getServices } from "@/lib/container";
import type { ProblemWithProgress } from "@/domain/problem/Problem";
import { DifficultyTag } from "@/components/DifficultyTag";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreReadout } from "@/components/ScoreReadout";

export const dynamic = "force-dynamic";

export default async function ProblemLibraryPage() {
  let problems: ProblemWithProgress[] = [];
  let loadError: string | null = null;

  try {
    const { problems: problemService } = getServices();
    problems = await problemService.listProblemsWithProgress();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not reach the database.";
  }

  return (
    <div>
      <div className="mb-10 max-w-2xl">
        <p className="microlabel mb-3">Low-level design · practice desk</p>
        <h1 className="text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
          Design it. Get it reviewed. Design it better.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Pick a problem, submit a structured design — classes, responsibilities,
          relationships, trade-offs — and get the kind of review a senior engineer
          would give: what was detected, why it matters, what to try next.
        </p>
      </div>

      {loadError && (
        <div className="border border-bad/40 bg-bad/5 p-4">
          <p className="font-mono text-xs tracking-[0.12em] text-bad uppercase">Database unavailable</p>
          <p className="mt-1 text-sm text-muted">{loadError}</p>
        </div>
      )}

      {!loadError && problems.length === 0 && (
        <div className="border border-line bg-panel p-10 text-center">
          <p className="font-mono text-sm text-muted">No problems available yet.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {problems.map((problem) => (
          <Link
            key={problem.slug}
            href={`/problems/${problem.slug}`}
            className="group flex flex-col border border-line bg-panel p-5 transition-colors hover:border-amber/60"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <DifficultyTag difficulty={problem.difficulty} />
              <span className="font-mono text-[0.6875rem] text-faint">
                ≈{problem.estimatedMinutes} min
              </span>
            </div>
            <h2 className="text-lg font-semibold text-paper group-hover:text-amber">
              {problem.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
              {problem.summary}
            </p>
            <div className="mt-5 border-t border-line pt-3">
              {problem.attemptCount === 0 ? (
                <p className="font-mono text-[0.6875rem] tracking-[0.12em] text-faint uppercase">
                  Not attempted
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge status={problem.lastAttemptStatus ?? "DRAFT"} />
                  {problem.bestScore !== null && (
                    <ScoreReadout score={problem.bestScore} compact />
                  )}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
