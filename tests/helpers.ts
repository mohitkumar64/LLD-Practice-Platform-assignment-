import type { AttemptSnapshot } from "@/domain/attempt/Attempt";
import type { AttemptRepository } from "@/domain/attempt/AttemptRepository";
import type { Problem } from "@/domain/problem/Problem";
import type {
  RawSubmissionPayload,
  StructuredDesignSubmission,
} from "@/domain/submission/StructuredDesignSubmission";

/** Minimal test problem so evaluation prompts/coverage have real input. */
export const TEST_PROBLEM: Problem = {
  slug: "parking-lot",
  title: "Parking Lot",
  difficulty: "Medium",
  summary: "Test problem",
  estimatedMinutes: 45,
  statement: "Design a parking lot.",
  requirements: [
    {
      id: "pl-req-1",
      description: "Support multiple vehicle types.",
      keywords: ["vehicle", "car"],
    },
    {
      id: "pl-req-2",
      description: "Allocate spots on entry.",
      keywords: ["allocat", "spot"],
    },
    {
      id: "pl-req-3",
      description: "Issue tickets and compute fees.",
      keywords: ["ticket", "fee", "price"],
    },
  ],
  assumptions: ["Single process."],
  designConsiderations: ["Where does pricing live?"],
};

/** A structurally valid submission used as the happy-path baseline. */
export function validSubmission(): StructuredDesignSubmission {
  return {
    entities: [
      {
        name: "ParkingLot",
        kind: "class",
        responsibilities: ["Owns floors and availability"],
        keyMethods: ["park(vehicle): Ticket"],
        extends: null,
        implements: [],
      },
      {
        name: "Vehicle",
        kind: "interface",
        responsibilities: ["Declares size"],
        keyMethods: ["size(): VehicleSize"],
        extends: null,
        implements: [],
      },
      {
        name: "Car",
        kind: "class",
        responsibilities: ["Implements a car vehicle"],
        keyMethods: [],
        extends: null,
        implements: ["Vehicle"],
      },
      {
        name: "PricingStrategy",
        kind: "interface",
        responsibilities: ["Computes fees"],
        keyMethods: ["fee(ticket): Money"],
        extends: null,
        implements: [],
      },
    ],
    relationships: [
      {
        from: "ParkingLot",
        to: "Vehicle",
        type: "dependency",
        description: "Allocation depends on the Vehicle abstraction",
      },
    ],
    patterns: [
      {
        name: "Strategy",
        where: "PricingStrategy for fees",
        justification: "Pricing rules change independently of the exit flow.",
      },
    ],
    tradeoffs: ["Flat spot scan instead of an index — fine at this scale."],
    pseudocode: null,
  };
}

export function rawValidSubmission(): RawSubmissionPayload {
  return validSubmission() as unknown as RawSubmissionPayload;
}

/** Simple in-memory AttemptRepository for behaviour tests (no Mongo). */
export class InMemoryAttemptRepository implements AttemptRepository {
  private store = new Map<string, AttemptSnapshot>();

  async save(snapshot: AttemptSnapshot): Promise<void> {
    this.store.set(snapshot.id, structuredClone(snapshot));
  }

  async findById(id: string): Promise<AttemptSnapshot | null> {
    const found = this.store.get(id);
    return found ? structuredClone(found) : null;
  }

  async listByProblem(problemSlug: string): Promise<AttemptSnapshot[]> {
    return [...this.store.values()]
      .filter((a) => a.problemSlug === problemSlug)
      .sort((a, b) => b.attemptNumber - a.attemptNumber)
      .map((a) => structuredClone(a));
  }

  async listAll(): Promise<AttemptSnapshot[]> {
    return [...this.store.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => structuredClone(a));
  }
}
