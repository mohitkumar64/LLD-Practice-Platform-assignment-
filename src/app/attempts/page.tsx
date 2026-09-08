import Link from "next/link";
import { getServices } from "@/lib/container";
import type { AttemptSnapshot } from "@/domain/attempt/Attempt";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";
export const metadata = { title: "History — Schematic" };

interface ProblemGroup {
  problemTitle: string;
  problemSlug: string;
  attempts: AttemptSnapshot[];
}

export default async function AttemptHistoryPage() {
  let groups: ProblemGroup[] = [];
  let loadError: string | null = null;
  try {
    const { attempts, problems } = getServices();
    const [allAttempts, allProblems] = await Promise.all([attempts.listAttempts(), problems.listProblems()]);
    const bySlug = new Map(allProblems.map((p) => [p.slug, p.title]));
    const grouped = new Map<string, AttemptSnapshot[]>();
    for (const attempt of allAttempts) {
      const list = grouped.get(attempt.problemSlug) ?? [];
      list.push(attempt);
      grouped.set(attempt.problemSlug, list);
    }
    groups = [...grouped.entries()].map(([slug, list]) => ({
      problemSlug: slug,
      problemTitle: bySlug.get(slug) ?? slug,
      attempts: list.sort((a, b) => b.attemptNumber - a.attemptNumber),
    }));
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load history.";
  }

  return (
    <div>
      <div className="mb-10">
        <p className="microlabel mb-2">Iteration log</p>
        <h1 className="text-3xl font-semibold tracking-tight text-paper">Attempt history</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          Every attempt is preserved with its submission and review. Improvement between
          attempts is where the learning happens.
        </p>
      </div>

      {loadError && (
        <div className="border border-bad/40 bg-bad/5 p-4">
          <p className="text-sm text-muted">{loadError}</p>
        </div>
      )}

      {!loadError && groups.length === 0 && (
        <div className="border border-line bg-panel p-10 text-center">
          <p className="text-sm text-muted">No attempts yet.</p>
          <Link
            href="/"
            className="mt-4 inline-block bg-amber px-5 py-2.5 font-mono text-sm font-semibold text-ink transition hover:bg-amber/85"
          >
            Pick a problem →
          </Link>
        </div>
      )}

      <div className="space-y-8">
        {groups.map((group) => {
          const scores = group.attempts
            .map((a) => a.evaluation?.overallScore ?? null)
            .filter((s): s is number => s !== null);
          const best = scores.length > 0 ? Math.max(...scores) : null;

          return (
            <section key={group.problemSlug} className="border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <Link
                  href={`/problems/${group.problemSlug}`}
                  className="font-semibold text-paper hover:text-amber"
                >
                  {group.problemTitle}
                </Link>
                {best !== null && (
                  <span className="font-mono text-xs text-muted">best {best}/100</span>
                )}
              </div>
              <ul className="divide-y divide-line">
                {group.attempts.map((attempt, i) => {
                  const score = attempt.evaluation?.overallScore ?? null;
                  const prev = group.attempts[i + 1];
                  const prevScore = prev?.evaluation?.overallScore ?? null;
                  const delta =
                    score !== null && prevScore !== null ? score - prevScore : null;
                  return (
                    <li key={attempt.id}>
                      <Link
                        href={`/attempts/${attempt.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-raise"
                      >
                        <span className="flex items-center gap-4">
                          <span className="w-14 font-mono text-xs text-muted">
                            #{attempt.attemptNumber}
                          </span>
                          <span className="font-mono text-xs text-faint">
                            {attempt.submittedAt
                              ? new Date(attempt.submittedAt).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </span>
                          <StatusBadge status={attempt.status} />
                        </span>
                        <span className="flex items-center gap-3">
                          {delta !== null && (
                            <span
                              className={`font-mono text-xs ${
                                delta > 0 ? "text-good" : delta < 0 ? "text-bad" : "text-faint"
                              }`}
                            >
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          )}
                          {score !== null ? (
                            <span className="w-10 text-right font-mono text-lg font-semibold text-paper">
                              {score}
                            </span>
                          ) : (
                            <span className="w-10 text-right font-mono text-sm text-faint">–</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
