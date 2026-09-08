import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServices } from "@/lib/container";
import { AttemptReview } from "@/components/AttemptReview";
import type { Problem } from "@/domain/problem/Problem";
import type { AttemptSnapshot } from "@/domain/attempt/Attempt";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Review — Schematic" };

export default async function AttemptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let attempt: AttemptSnapshot;
  let problem: Problem;
  let previousScore: number | null = null;
  try {
    const services = getServices();
    attempt = await services.attempts.getAttempt(id);
    problem = await services.problems.getProblem(attempt.problemSlug);
    // Improvement context: best score among this problem's earlier attempts.
    const history = await services.attempts.listAttempts(attempt.problemSlug);
    const earlier = history.filter(
      (a) =>
        a.attemptNumber < attempt.attemptNumber && a.evaluation !== null,
    );
    if (earlier.length > 0) {
      previousScore = Math.max(...earlier.map((a) => a.evaluation!.overallScore));
    }
  } catch {
    notFound();
  }

  return (
    <AttemptReview problem={problem} initial={attempt} previousScore={previousScore} />
  );
}
