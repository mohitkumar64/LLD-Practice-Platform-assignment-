import { describe, it, expect } from "vitest";
import { RuleBasedEvaluator } from "@/domain/evaluation/RuleBasedEvaluator";
import { HybridEvaluator } from "@/domain/evaluation/HybridEvaluator";
import { TEST_PROBLEM, validSubmission } from "./helpers";
import type { Evaluator } from "@/domain/evaluation/Evaluator";
import type { EvaluationResult } from "@/domain/evaluation/EvaluationResult";

describe("RuleBasedEvaluator (deterministic checks)", () => {
  it("scores a complete design high and reports no structural issues", async () => {
    const result = await new RuleBasedEvaluator().evaluate(TEST_PROBLEM, validSubmission());
    expect(result.overallScore).toBeGreaterThanOrEqual(80);
    expect(result.issues).toHaveLength(0);
    expect(result.sources.llmContributed).toBe(false);
    expect(result.sources.deterministic.checks.length).toBeGreaterThan(4);
  });

  it("is reproducible: identical input, identical output", async () => {
    const evaluator = new RuleBasedEvaluator();
    const a = await evaluator.evaluate(TEST_PROBLEM, validSubmission());
    const b = await evaluator.evaluate(TEST_PROBLEM, validSubmission());
    expect(a.overallScore).toBe(b.overallScore);
    expect(a.issues.map((i) => i.title)).toEqual(b.issues.map((i) => i.title));
  });

  it("flags thin designs with actionable, requirement-grounded issues", async () => {
    const evaluator = new RuleBasedEvaluator();
    const baseline = await evaluator.evaluate(TEST_PROBLEM, validSubmission());

    const thin = validSubmission();
    thin.entities = thin.entities.slice(0, 1);
    thin.relationships = [];
    thin.patterns = [];
    thin.tradeoffs = [];
    const result = await evaluator.evaluate(TEST_PROBLEM, thin);

    expect(result.overallScore).toBeLessThan(baseline.overallScore);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.title.includes("collaborating types"))).toBe(true);
    expect(result.issues.some((i) => i.title.includes("Dangling references"))).toBe(true);
    // requirement coverage is reported per-requirement, not hand-waved
    expect(result.requirementCoverage.length).toBe(TEST_PROBLEM.requirements.length);
  });
});

const reasonedResult: EvaluationResult = {
  overallScore: 70,
  summary: "Reasoned summary",
  strengths: [{ title: "Good abstraction", explanation: "Vehicle is an interface." }],
  issues: [
    {
      severity: "high",
      category: "coupling",
      title: "ParkingLot constructs Tickets directly",
      explanation: "Factory change ripples.",
      suggestion: "Depend on a TicketFactory.",
    },
  ],
  requirementCoverage: TEST_PROBLEM.requirements.map((r) => ({
    requirementId: r.id,
    requirement: r.description,
    covered: r.id !== "pl-req-3",
    explanation: "reasoned",
  })),
  dimensions: [
    { name: "Coupling", score: 60, explanation: "concrete dependency" },
    { name: "Completeness", score: 100, explanation: "llm agrees" },
  ],
  suggestions: [{ title: "Extract ticket creation", detail: "..." }],
  sources: { deterministic: { score: 0, checks: [] }, llmContributed: true, llmModel: "test-model" },
};

const deterministicStub: Evaluator = {
  evaluate: async (problem, submission) => {
    void problem;
    void submission;
    return {
      overallScore: 100,
      summary: "rules",
      strengths: [
        { title: "Good abstraction", explanation: "duplicate — should be dropped" },
        { title: "Consistent structure", explanation: "unique" },
      ],
      issues: [
        {
          severity: "high",
          category: "completeness",
          title: "structural issue",
          explanation: "e",
          suggestion: "s",
        },
      ],
      requirementCoverage: TEST_PROBLEM.requirements.map((r) => ({
        requirementId: r.id,
        requirement: r.description,
        covered: true,
        explanation: "keyword hit",
      })),
      dimensions: [{ name: "Completeness", score: 50, explanation: "rules say thinner" }],
      suggestions: [],
      sources: { deterministic: { score: 100, checks: [] }, llmContributed: false },
    };
  },
};

describe("HybridEvaluator (explicit, explainable merge)", () => {
  it("blends both scores with the configured weights and keeps provenance", async () => {
    const hybrid = new HybridEvaluator(deterministicStub, {
      evaluate: async () => reasonedResult,
    }, { deterministic: 0.3, llm: 0.7 });
    const result = await hybrid.evaluate(TEST_PROBLEM, validSubmission());

    expect(result.overallScore).toBe(79); // 100*0.3 + 70*0.7
    expect(result.summary).toBe("Reasoned summary"); // reasoning owns the narrative
    expect(result.sources.llmContributed).toBe(true);
    expect(result.sources.llmModel).toBe("test-model");
    expect(result.sources.deterministic.score).toBe(100);
  });

  it("merges issues from both sources", async () => {
    const hybrid = new HybridEvaluator(deterministicStub, { evaluate: async () => reasonedResult });
    const result = await hybrid.evaluate(TEST_PROBLEM, validSubmission());
    const titles = result.issues.map((i) => i.title);
    expect(titles).toContain("[structural] structural issue");
    expect(titles).toContain("ParkingLot constructs Tickets directly");
  });

  it("prefers reasoned requirement coverage and de-duplicates strengths", async () => {
    const hybrid = new HybridEvaluator(deterministicStub, { evaluate: async () => reasonedResult });
    const result = await hybrid.evaluate(TEST_PROBLEM, validSubmission());

    const byId = new Map(result.requirementCoverage.map((r) => [r.requirementId, r]));
    expect(byId.get("pl-req-3")?.covered).toBe(false); // reasoned verdict wins
    expect(byId.get("pl-req-1")?.covered).toBe(true);

    const titles = result.strengths.map((s) => s.title);
    expect(titles.filter((t) => t === "Good abstraction")).toHaveLength(1);
    expect(titles).toContain("Consistent structure");
  });

  it("blends shared dimensions 80/20 toward the LLM", async () => {
    const hybrid = new HybridEvaluator(deterministicStub, { evaluate: async () => reasonedResult });
    const result = await hybrid.evaluate(TEST_PROBLEM, validSubmission());
    const completeness = result.dimensions.find((d) => d.name === "Completeness");
    expect(completeness?.score).toBe(90); // 100*0.8 + 50*0.2
    expect(result.dimensions.some((d) => d.name === "Coupling")).toBe(true);
  });
});
