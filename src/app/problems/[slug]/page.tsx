import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServices } from "@/lib/container";
import { DifficultyTag } from "@/components/DifficultyTag";
import { StartPracticeButton } from "@/components/StartPracticeButton";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { problems } = getServices();
    const problem = await problems.getProblem(slug);
    return { title: `${problem.title} — Schematic` };
  } catch {
    return { title: "Problem — Schematic" };
  }
}

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let problem;
  let attempts;
  try {
    const services = getServices();
    [problem, attempts] = await Promise.all([
      services.problems.getProblem(slug),
      services.attempts.listAttempts(slug),
    ]);
  } catch {
    notFound();
  }

  attempts = attempts.sort((a, b) => b.attemptNumber - a.attemptNumber);
  const lastEvaluated = attempts.find((a) => a.evaluation !== null);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
      <div>
        <p className="microlabel mb-3">Problem</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-paper">{problem.title}</h1>
          <DifficultyTag difficulty={problem.difficulty} />
          <span className="font-mono text-xs text-faint">≈{problem.estimatedMinutes} min</span>
        </div>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">{problem.statement}</p>

        <section className="mt-10">
          <h2 className="microlabel mb-3">Functional requirements</h2>
          <ol className="space-y-2.5">
            {problem.requirements.map((req, i) => (
              <li key={req.id} className="flex gap-3 text-sm leading-relaxed text-paper/90">
                <span className="mt-0.5 font-mono text-xs text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {req.description}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="microlabel mb-3">Assumptions you may make</h2>
          <ul className="space-y-2">
            {problem.assumptions.map((a) => (
              <li key={a} className="flex gap-3 text-sm leading-relaxed text-muted">
                <span className="mt-1.5 size-1 shrink-0 bg-faint" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 border border-amber/25 bg-amber/[0.04] p-5">
          <h2 className="microlabel mb-3 !text-amber">What the review will look for</h2>
          <ul className="space-y-2">
            {problem.designConsiderations.map((c) => (
              <li key={c} className="flex gap-3 text-sm leading-relaxed text-paper/85">
                <span className="mt-1.5 size-1 shrink-0 bg-amber/70" aria-hidden />
                {c}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <aside className="h-fit space-y-6 lg:sticky lg:top-24">
        <div className="border border-line bg-panel p-5">
          <StartPracticeButton problemSlug={problem.slug} />
          <p className="mt-4 text-xs leading-relaxed text-faint">
            You&apos;ll submit a structured design: classes with responsibilities,
            relationships, patterns (justified), and trade-offs. Not a giant text box.
          </p>
        </div>

        <div className="border border-line bg-panel p-5">
          <h2 className="microlabel mb-3">Your attempts</h2>
          {attempts.length === 0 ? (
            <p className="text-sm text-faint">No attempts yet — start your first.</p>
          ) : (
            <ul className="divide-y divide-line">
              {attempts.slice(0, 5).map((attempt) => (
                <li key={attempt.id} className="py-2.5 first:pt-0 last:pb-0">
                  <Link
                    href={`/attempts/${attempt.id}`}
                    className="flex items-center justify-between gap-2 hover:text-amber"
                  >
                    <span className="font-mono text-xs text-muted">
                      #{attempt.attemptNumber}
                    </span>
                    <span className="flex items-center gap-2">
                      {attempt.evaluation ? (
                        <span className="font-mono text-sm font-semibold text-paper">
                          {attempt.evaluation.overallScore}
                        </span>
                      ) : (
                        <StatusBadge status={attempt.status} />
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {attempts.length > 0 && (
            <Link
              href="/attempts"
              className="mt-3 inline-block font-mono text-[0.6875rem] tracking-[0.12em] text-muted uppercase hover:text-amber"
            >
              Full history →
            </Link>
          )}
        </div>

        {lastEvaluated && (
          <p className="font-mono text-[0.6875rem] leading-relaxed text-faint">
            Last review: {lastEvaluated.evaluation!.overallScore}/100. Iterate on the
            issues, then start a fresh attempt to compare.
          </p>
        )}
      </aside>
    </div>
  );
}
