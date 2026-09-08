import type { Problem, ProblemWithProgress } from "@/domain/problem/Problem";
import type { ProblemRepository } from "@/domain/problem/ProblemRepository";
import type { AttemptRepository } from "@/domain/attempt/AttemptRepository";
import { ProblemNotFoundError } from "@/domain/errors/DomainError";

/**
 * Read-side service for problems. It owns the "join" between problems and
 * attempt history (best score, attempt count) so API routes stay thin.
 */
export class ProblemService {
  constructor(
    private readonly problems: ProblemRepository,
    private readonly attempts: AttemptRepository,
  ) {}

  async listProblems(): Promise<Problem[]> {
    return this.problems.list();
  }

  async listProblemsWithProgress(): Promise<ProblemWithProgress[]> {
    const [problems, attempts] = await Promise.all([this.problems.list(), this.attempts.listAll()]);
    return problems.map((problem) => {
      const forProblem = attempts.filter((a) => a.problemSlug === problem.slug);
      const evaluated = forProblem.filter((a) => a.evaluation !== null);
      const bestScore = evaluated.reduce<number | null>(
        (best, a) => (best === null ? a.evaluation!.overallScore : Math.max(best, a.evaluation!.overallScore)),
        null,
      );
      const last = [...forProblem].sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
      return {
        ...problem,
        attemptCount: forProblem.length,
        bestScore,
        lastAttemptStatus: last?.status ?? null,
      };
    });
  }

  async getProblem(slug: string): Promise<Problem> {
    const problem = await this.problems.findBySlug(slug);
    if (!problem) throw new ProblemNotFoundError(slug);
    return problem;
  }
}
