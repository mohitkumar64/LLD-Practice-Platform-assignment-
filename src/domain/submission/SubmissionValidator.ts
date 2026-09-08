import {
  InvalidSubmissionError,
  type SubmissionIssue,
} from "../errors/DomainError";
import type {
  DesignEntity,
  DesignRelationship,
  PatternUsage,
  RawSubmissionPayload,
  StructuredDesignSubmission,
} from "./StructuredDesignSubmission";

/**
 * Deterministic structural validation of a submission.
 *
 * This is deliberately NOT about correctness of the design — it enforces the
 * invariants a *structured* design must satisfy so that evaluation has
 * something meaningful to reason about. Quality judgment is the evaluator's
 * job; shape is the validator's job.
 */

const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{1,63}$/;

function asStringArray(value: unknown, limit = 40): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((s) => s.replace(/^-\s*/, "").trim()) // tolerate "- item" bullet lists
    .filter((s) => s.length > 0)
    .slice(0, limit);
}

/** Normalizes a raw API payload into a StructuredDesignSubmission. */
export function normalizeSubmission(payload: RawSubmissionPayload): StructuredDesignSubmission {
  const rawEntities = Array.isArray(payload.entities) ? payload.entities : [];

  const entities: DesignEntity[] = rawEntities
    .slice(0, 30)
    .map((e): DesignEntity => {
      const obj = (e ?? {}) as Record<string, unknown>;
      return {
        name: typeof obj.name === "string" ? obj.name.trim() : "",
        kind: obj.kind === "interface" || obj.kind === "abstract-class" ? obj.kind : "class",
        responsibilities: asStringArray(obj.responsibilities, 12),
        keyMethods: asStringArray(obj.keyMethods, 15),
        extends: typeof obj.extends === "string" && obj.extends.trim() ? obj.extends.trim() : null,
        implements: asStringArray(obj.implements, 8),
      };
    })
    .filter((e) => e.name.length > 0 || e.responsibilities.length > 0);

  const rawRelationships = Array.isArray(payload.relationships) ? payload.relationships : [];
  const allowedTypes = new Set([
    "association",
    "aggregation",
    "composition",
    "inheritance",
    "implements",
    "dependency",
  ]);
  const relationships: DesignRelationship[] = rawRelationships
    .slice(0, 60)
    .map((r): DesignRelationship => {
      const obj = (r ?? {}) as Record<string, unknown>;
      const type =
        typeof obj.type === "string" && allowedTypes.has(obj.type)
          ? (obj.type as DesignRelationship["type"])
          : "association";
      return {
        from: typeof obj.from === "string" ? obj.from.trim() : "",
        to: typeof obj.to === "string" ? obj.to.trim() : "",
        type,
        description: typeof obj.description === "string" ? obj.description.trim() : "",
      };
    })
    .filter((r) => r.from.length > 0 && r.to.length > 0);

  const rawPatterns = Array.isArray(payload.patterns) ? payload.patterns : [];
  const patterns: PatternUsage[] = rawPatterns
    .slice(0, 10)
    .map((p): PatternUsage => {
      const obj = (p ?? {}) as Record<string, unknown>;
      return {
        name: typeof obj.name === "string" ? obj.name.trim() : "",
        where: typeof obj.where === "string" ? obj.where.trim() : "",
        justification: typeof obj.justification === "string" ? obj.justification.trim() : "",
      };
    })
    .filter((p) => p.name.length > 0);

  const tradeoffs = asStringArray(payload.tradeoffs, 10);
  const pseudocode =
    typeof payload.pseudocode === "string" && payload.pseudocode.trim().length > 0
      ? payload.pseudocode.trim().slice(0, 20000)
      : null;

  return { entities, relationships, patterns, tradeoffs, pseudocode };
}

/** Structural checks — empty submission, missing names, dangling references. */
export function findStructuralIssues(submission: StructuredDesignSubmission): SubmissionIssue[] {
  const issues: SubmissionIssue[] = [];

  if (submission.entities.length === 0) {
    issues.push({ field: "entities", message: "Add at least one class or interface." });
    return issues; // nothing else can be checked without entities
  }

  const names = new Map<string, number>();
  for (const entity of submission.entities) {
    if (!entity.name) {
      issues.push({ field: "entities", message: "Every class needs a name." });
      continue;
    }
    if (!NAME_PATTERN.test(entity.name)) {
      issues.push({
        field: `entities.${entity.name}`,
        message: `"${entity.name}" is not a valid type name (use PascalCase letters/numbers).`,
      });
    }
    const key = entity.name.toLowerCase();
    names.set(key, (names.get(key) ?? 0) + 1);
    if (entity.responsibilities.length === 0) {
      issues.push({
        field: `entities.${entity.name}.responsibilities`,
        message: `"${entity.name}" has no responsibilities — say what it owns.`,
      });
    }
  }

  for (const [key, count] of names) {
    if (count > 1) {
      issues.push({
        field: "entities",
        message: `Duplicate class name "${key}" — each type must be unique.`,
      });
    }
  }

  const knownNames = new Set(submission.entities.map((e) => e.name.toLowerCase()));

  submission.relationships.forEach((rel, i) => {
    if (!knownNames.has(rel.from.toLowerCase())) {
      issues.push({
        field: `relationships[${i}].from`,
        message: `Relationship references unknown type "${rel.from}".`,
      });
    }
    if (!knownNames.has(rel.to.toLowerCase())) {
      issues.push({
        field: `relationships[${i}].to`,
        message: `Relationship references unknown type "${rel.to}".`,
      });
    }
    if (rel.from.toLowerCase() === rel.to.toLowerCase()) {
      issues.push({
        field: `relationships[${i}]`,
        message: `Relationship "${rel.from} → ${rel.to}" points at itself.`,
      });
    }
  });

  for (const entity of submission.entities) {
    const parents = [...(entity.extends ? [entity.extends] : []), ...entity.implements];
    for (const parent of parents) {
      if (!knownNames.has(parent.toLowerCase())) {
        issues.push({
          field: `entities.${entity.name}`,
          message: `"${entity.name}" extends/implements unknown type "${parent}".`,
        });
      }
    }
  }

  submission.patterns.forEach((pattern, i) => {
    if (!pattern.justification) {
      issues.push({
        field: `patterns[${i}].justification`,
        message: `Pattern "${pattern.name}" needs a justification — why does it earn its place?`,
      });
    }
  });

  if (submission.tradeoffs.length === 0) {
    issues.push({
      field: "tradeoffs",
      message: "Add at least one trade-off or assumption you consciously made.",
    });
  }

  return issues;
}

/** Domain entry point used by Attempt.submit — throws on invalid shape. */
export function assertValidSubmission(submission: StructuredDesignSubmission): void {
  const issues = findStructuralIssues(submission);
  if (issues.length > 0) {
    throw new InvalidSubmissionError(issues);
  }
}

