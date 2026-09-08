import { describe, it, expect } from "vitest";
import {
  assertValidSubmission,
  findStructuralIssues,
  normalizeSubmission,
} from "@/domain/submission/SubmissionValidator";
import { InvalidSubmissionError } from "@/domain/errors/DomainError";
import { validSubmission } from "./helpers";

describe("structured submission validation (deterministic gates)", () => {
  it("accepts the baseline submission with zero issues", () => {
    expect(findStructuralIssues(validSubmission())).toEqual([]);
  });

  it("rejects a completely empty submission", () => {
    const issues = findStructuralIssues(
      normalizeSubmission({ entities: [], relationships: [], patterns: [], tradeoffs: [] }),
    );
    expect(issues.some((i) => i.field === "entities")).toBe(true);
  });

  it("rejects duplicate class names", () => {
    const submission = validSubmission();
    submission.entities.push({ ...submission.entities[0]!, name: "Vehicle" });
    const issues = findStructuralIssues(submission);
    expect(issues.some((i) => i.message.toLowerCase().includes("duplicate"))).toBe(true);
  });

  it("rejects relationships pointing at undeclared types", () => {
    const submission = validSubmission();
    submission.relationships.push({
      from: "ParkingLot",
      to: "Ghost",
      type: "composition",
      description: "dangling",
    });
    const issues = findStructuralIssues(submission);
    expect(issues.some((i) => i.message.includes("Ghost"))).toBe(true);
  });

  it("rejects inheritance pointing at undeclared types", () => {
    const submission = validSubmission();
    submission.entities[0]!.extends = "Nonexistent";
    const issues = findStructuralIssues(submission);
    expect(issues.some((i) => i.field === "entities.ParkingLot")).toBe(true);
  });

  it("rejects types with no stated responsibilities", () => {
    const submission = validSubmission();
    submission.entities[0]!.responsibilities = [];
    const issues = findStructuralIssues(submission);
    expect(issues.some((i) => i.field === "entities.ParkingLot.responsibilities")).toBe(true);
  });

  it("rejects patterns without justification (mentioning != using well)", () => {
    const submission = validSubmission();
    submission.patterns[0]!.justification = "";
    const issues = findStructuralIssues(submission);
    expect(issues.some((i) => i.field === "patterns[0].justification")).toBe(true);
  });

  it("requires at least one recorded trade-off", () => {
    const submission = validSubmission();
    submission.tradeoffs = [];
    const issues = findStructuralIssues(submission);
    expect(issues.some((i) => i.field === "tradeoffs")).toBe(true);
  });

  it("normalizes messy payloads (whitespace, unknown kinds, junk fields)", () => {
    const normalized = normalizeSubmission({
      entities: [
        { name: "  ParkingLot ", kind: "spaceship", responsibilities: ["- owns spots"], extra: true },
        42,
      ],
      relationships: [{ from: "ParkingLot", to: "Vehicle", type: "quantum" }],
      patterns: "not-an-array",
      tradeoffs: ["  ok  ", "", null],
    });
    expect(normalized.entities).toHaveLength(1);
    expect(normalized.entities[0]!.name).toBe("ParkingLot");
    expect(normalized.entities[0]!.kind).toBe("class"); // unknown kind coerced
    expect(normalized.entities[0]!.responsibilities).toEqual(["owns spots"]);
    expect(normalized.relationships[0]!.type).toBe("association"); // unknown type coerced
    expect(normalized.tradeoffs).toEqual(["ok"]);
  });

  it("throws InvalidSubmissionError with per-field issues via assertValidSubmission", () => {
    try {
      assertValidSubmission(
        normalizeSubmission({ entities: [], relationships: [], patterns: [], tradeoffs: [] }),
      );
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidSubmissionError);
      const details = (err as InvalidSubmissionError).details as {
        issues: { field: string }[];
      };
      expect(details.issues.length).toBeGreaterThan(0);
    }
  });
});
