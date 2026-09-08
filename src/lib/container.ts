import { ProblemService } from "@/application/ProblemService";
import { AttemptService } from "@/application/AttemptService";
import { EvaluationService } from "@/application/EvaluationService";
import type { Evaluator } from "@/domain/evaluation/Evaluator";
import { RuleBasedEvaluator } from "@/domain/evaluation/RuleBasedEvaluator";
import { HybridEvaluator } from "@/domain/evaluation/HybridEvaluator";
import { LlmDesignEvaluator } from "@/infrastructure/ai/LlmDesignEvaluator";
import { NvidiaLlmClient } from "@/infrastructure/ai/NvidiaLlmClient";
import { MongoProblemRepository } from "@/infrastructure/database/MongoProblemRepository";
import { MongoAttemptRepository } from "@/infrastructure/database/MongoAttemptRepository";
import { isDatabaseConfigured } from "@/infrastructure/database/MongoConnection";

/**
 * Composition root — the ONLY place that knows concrete implementations.
 *
 * Evaluator wiring: when an NVIDIA_API_KEY is configured, submissions get a
 * hybrid review (deterministic checks + LLM reasoning). Without a key the
 * platform degrades gracefully to rules-only review instead of failing —
 * deterministic checks alone still make a meaningful (if shallower) review.
 */
export interface Services {
  problems: ProblemService;
  attempts: AttemptService;
  evaluation: EvaluationService;
  llmConfigured: boolean;
  databaseConfigured: boolean;
}

let cached: Services | null = null;

export function getServices(): Services {
  if (cached) return cached;

  const problemRepo = new MongoProblemRepository();
  const attemptRepo = new MongoAttemptRepository();

  const llmClient = new NvidiaLlmClient();
  const llmConfigured = llmClient.isConfigured();

  const evaluator: Evaluator = llmConfigured
    ? new HybridEvaluator(new RuleBasedEvaluator(), new LlmDesignEvaluator(llmClient))
    : new RuleBasedEvaluator();

  cached = {
    problems: new ProblemService(problemRepo, attemptRepo),
    attempts: new AttemptService(attemptRepo, problemRepo),
    evaluation: new EvaluationService(attemptRepo, problemRepo, evaluator),
    llmConfigured,
    databaseConfigured: isDatabaseConfigured(),
  };
  return cached;
}
