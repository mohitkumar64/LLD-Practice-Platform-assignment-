import type { Problem } from "../problem/Problem";
import type { StructuredDesignSubmission } from "../submission/StructuredDesignSubmission";
import type { Evaluator } from "./Evaluator";
import type {
  DeterministicCheck,
  DimensionScore,
  EvaluationResult,
  RequirementCoverage,
} from "./EvaluationResult";

/**
 * RuleBasedEvaluator — the deterministic half of the hybrid.
 *
 * It never judges design *quality* (that needs reasoning); it judges
 * structure and coverage: completeness, internal consistency, and whether
 * the problem's requirements appear addressed. Its findings are objective
 * and reproducible — and they are fed to the LLM as evidence so the AI
 * argues from checked facts, not vibes.
 */

const clampScore = (n: number): number => Math.min(100, Math.max(0, Math.round(n)));

export class RuleBasedEvaluator implements Evaluator {
  async evaluate(
    problem: Problem,
    submission: StructuredDesignSubmission,
  ): Promise<EvaluationResult> {
    const checks = this.runChecks(problem, submission);
    const completeness = this.scoreGroup(checks, ["has-entities", "has-responsibilities", "has-methods"]);
    const consistency = this.scoreGroup(checks, ["no-duplicates", "relationships-resolve", "hierarchy-resolves"]);
    const coverage = this.scoreGroup(checks, ["requirement-coverage"]);

    const deterministicScore = clampScore(
      completeness * 0.35 + consistency * 0.3 + coverage * 0.35,
    );

    const issues: EvaluationResult["issues"] = [];
    const strengths: EvaluationResult["strengths"] = [];

    for (const check of checks) {
      if (check.passed) {
        const s = this.strengthForCheck(check);
        if (s) strengths.push(s);
      } else {
        issues.push(...this.issueForCheck(check));
      }
    }

    const coveredRequirements = this.coverage(problem, submission);

    const dimensions: DimensionScore[] = [
      {
        name: "Completeness",
        score: completeness,
        explanation:
          "Whether the design specifies enough structure (types, responsibilities, key behaviours) to be reviewed at all.",
      },
      {
        name: "Internal consistency",
        score: consistency,
        explanation:
          "Whether relationships and hierarchies reference types that actually exist in the design.",
      },
      {
        name: "Requirement coverage",
        score: coverage,
        explanation:
          "How many of the problem's explicit requirements appear addressed by the submitted design.",
      },
    ];

    return {
      overallScore: deterministicScore,
      summary: this.summarize(deterministicScore, coverage, checks),
      strengths,
      issues,
      requirementCoverage: coveredRequirements,
      dimensions,
      suggestions: this.suggestions(problem, submission, coveredRequirements),
      sources: {
        deterministic: { score: deterministicScore, checks },
        llmContributed: false,
      },
    };
  }

  private runChecks(problem: Problem, submission: StructuredDesignSubmission): DeterministicCheck[] {
    const checks: DeterministicCheck[] = [];
    const names = submission.entities.map((e) => e.name.toLowerCase());
    const nameSet = new Set(names);

    checks.push({
      name: "has-entities",
      passed: submission.entities.length >= 3,
      detail:
        submission.entities.length >= 3
          ? `${submission.entities.length} types declared.`
          : `Only ${submission.entities.length} type(s) declared — most LLD designs need several collaborating types.`,
    });

    const withResponsibilities = submission.entities.filter((e) => e.responsibilities.length > 0);
    checks.push({
      name: "has-responsibilities",
      passed: withResponsibilities.length === submission.entities.length,
      detail:
        withResponsibilities.length === submission.entities.length
          ? "Every type declares at least one responsibility."
          : `${submission.entities.length - withResponsibilities.length} type(s) declare no responsibility.`,
    });

    const withMethods = submission.entities.filter((e) => e.keyMethods.length > 0);
    checks.push({
      name: "has-methods",
      passed: withMethods.length >= Math.min(2, submission.entities.length),
      detail:
        withMethods.length > 0
          ? `${withMethods.length} type(s) declare key behaviours.`
          : "No key behaviours declared — a design without behaviour is a data diagram.",
    });

    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    checks.push({
      name: "no-duplicates",
      passed: duplicates.length === 0,
      detail:
        duplicates.length === 0
          ? "No duplicate type names."
          : `Duplicate types: ${[...new Set(duplicates)].join(", ")}.`,
    });

    const dangling = submission.relationships.filter(
      (r) => !nameSet.has(r.from.toLowerCase()) || !nameSet.has(r.to.toLowerCase()),
    );
    checks.push({
      name: "relationships-resolve",
      passed: submission.relationships.length > 0 && dangling.length === 0,
      detail:
        dangling.length === 0
          ? `${submission.relationships.length} relationship(s) all reference declared types.`
          : `${dangling.length} relationship(s) reference types that do not exist in the design.`,
    });

    const danglingHierarchy = submission.entities.filter(
      (e) =>
        (e.extends !== null && !nameSet.has(e.extends.toLowerCase())) ||
        e.implements.some((i) => !nameSet.has(i.toLowerCase())),
    );
    checks.push({
      name: "hierarchy-resolves",
      passed: danglingHierarchy.length === 0,
      detail:
        danglingHierarchy.length === 0
          ? "All extends/implements references resolve."
          : `${danglingHierarchy.length} type(s) extend/implement undeclared types.`,
    });

    const coverage = this.coverage(problem, submission);
    const coveredCount = coverage.filter((c) => c.covered).length;
    checks.push({
      name: "requirement-coverage",
      passed: coveredCount >= Math.ceil(problem.requirements.length / 2),
      detail: `${coveredCount}/${problem.requirements.length} requirements appear addressed by keywords in the design.`,
    });

    return checks;
  }

  private scoreGroup(checks: DeterministicCheck[], names: string[]): number {
    const group = checks.filter((c) => names.includes(c.name));
    if (group.length === 0) return 0;
    return Math.round((group.filter((c) => c.passed).length / group.length) * 100);
  }

  private coverage(problem: Problem, submission: StructuredDesignSubmission): RequirementCoverage[] {
    const haystack = [
      ...submission.entities.flatMap((e) => [e.name, ...e.responsibilities, ...e.keyMethods]),
      ...submission.relationships.map((r) => `${r.from} ${r.to} ${r.description}`),
      ...submission.patterns.map((p) => `${p.name} ${p.where} ${p.justification}`),
      ...submission.tradeoffs,
      submission.pseudocode ?? "",
    ]
      .join("\n")
      .toLowerCase();

    return problem.requirements.map((req) => {
      const matched = req.keywords.filter((k) => haystack.includes(k.toLowerCase()));
      return {
        requirementId: req.id,
        requirement: req.description,
        covered: matched.length > 0,
        explanation:
          matched.length > 0
            ? `The design mentions: ${matched.slice(0, 4).join(", ")}.`
            : "Nothing in the submission references this requirement's vocabulary — it may be covered implicitly, but the design does not show it.",
      };
    });
  }

  private issueForCheck(check: DeterministicCheck): EvaluationResult["issues"] {
    switch (check.name) {
      case "has-entities":
        return [
          {
            severity: "high",
            category: "completeness",
            title: "Too few collaborating types",
            explanation: check.detail,
            suggestion:
              "Break the system into collaborating types, each owning one part of the behaviour — a design with one or two types usually hides the important decisions inside them.",
          },
        ];
      case "has-responsibilities":
        return [
          {
            severity: "medium",
            category: "responsibility",
            title: "Types without stated responsibilities",
            explanation: check.detail,
            suggestion:
              "For each type, write one sentence per responsibility. If you cannot, the type may not earn its place.",
          },
        ];
      case "has-methods":
        return [
          {
            severity: "medium",
            category: "behaviour",
            title: "No key behaviours declared",
            explanation: check.detail,
            suggestion:
              "Add the important methods (signatures where useful) — behaviour is where design decisions become visible.",
          },
        ];
      case "no-duplicates":
        return [
          {
            severity: "high",
            category: "completeness",
            title: "Duplicate type names",
            explanation: check.detail,
            suggestion: "Give each type a unique, intention-revealing name.",
          },
        ];
      case "relationships-resolve":
      case "hierarchy-resolves":
        return [
          {
            severity: "high",
            category: "completeness",
            title: "Dangling references",
            explanation: check.detail,
            suggestion:
              "Every relationship and inheritance edge must point at a type that exists in the design — reviewers cannot reason about dangling arrows.",
          },
        ];
      case "requirement-coverage":
        return [
          {
            severity: "medium",
            category: "completeness",
            title: "Some requirements look unaddressed",
            explanation: check.detail,
            suggestion:
              "Re-read the requirements list and make sure each one is either visibly handled by your design or acknowledged as a trade-off.",
          },
        ];
      default:
        return [];
    }
  }

  private strengthForCheck(check: DeterministicCheck): EvaluationResult["strengths"][number] | null {
    switch (check.name) {
      case "has-entities":
        return { title: "Decomposed into collaborating types", explanation: check.detail };
      case "has-responsibilities":
        return { title: "Every type has a stated purpose", explanation: check.detail };
      case "has-methods":
        return { title: "Behaviour is modelled, not just data", explanation: check.detail };
      case "relationships-resolve":
        return { title: "Structure is internally consistent", explanation: check.detail };
      default:
        return null;
    }
  }

  private summarize(score: number, coverage: number, checks: DeterministicCheck[]): string {
    const failed = checks.filter((c) => !c.passed);
    if (checks.every((c) => c.passed)) {
      return "The design passes all structural checks: every type is named and owns responsibilities, all references resolve, and the requirements look addressed. The detailed review focuses on quality-level observations that need reasoning rather than rules.";
    }
    if (coverage < 40) {
      return `The design covers ${Math.round(coverage)}% of the requirement keywords and has ${failed.length} structural issue(s). Start with the high-severity items, then revisit the requirements list.`;
    }
    return `Structurally sound overall (deterministic score ${score}/100), with ${failed.length} issue(s) to address. The detailed review focuses on design quality beyond these checks.`;
  }

  private suggestions(
    problem: Problem,
    submission: StructuredDesignSubmission,
    coverage: RequirementCoverage[],
  ): EvaluationResult["suggestions"] {
    const suggestions: EvaluationResult["suggestions"] = [];
    const uncovered = coverage.filter((c) => !c.covered).slice(0, 3);
    for (const req of uncovered) {
      suggestions.push({
        title: `Address requirement: ${req.requirement}`,
        detail:
          "Nothing in the current design references this requirement. Either model it explicitly (a type or method that owns it) or record it as a conscious trade-off.",
      });
    }
    if (submission.entities.length > 0 && submission.relationships.length === 0) {
      suggestions.push({
        title: "Declare how your types collaborate",
        detail:
          "You listed types but no relationships. Collaboration structure (who owns whom, who depends on whom) is where most design quality lives.",
      });
    }
    return suggestions;
  }
}



