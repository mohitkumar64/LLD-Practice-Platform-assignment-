import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getServices } from "@/lib/container";
import { PracticeWorkspace } from "@/components/PracticeWorkspace";
import type { Problem } from "@/domain/problem/Problem";
import type { AttemptSnapshot } from "@/domain/attempt/Attempt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Practice — Schematic" };

export default async function PracticePage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  let problem: Problem;
  let attempt: AttemptSnapshot;
  try {
    const services = getServices();
    attempt = await services.attempts.getAttempt(attemptId);
    problem = await services.problems.getProblem(attempt.problemSlug);
  } catch {
    notFound();
  }

  // A submitted attempt is already under review — send the learner to it.
  if (attempt.status !== "DRAFT") {
    const { redirect } = await import("next/navigation");
    redirect(`/attempts/${attempt.id}`);
  }

  return <PracticeWorkspace problem={problem} attempt={attempt} />;
}
