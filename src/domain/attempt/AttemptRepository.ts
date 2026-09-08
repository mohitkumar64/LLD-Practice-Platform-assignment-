import type { AttemptSnapshot } from "./Attempt";

/**
 * Port for attempt persistence. Snapshot-in / snapshot-out keeps the
 * aggregate boundary clean: repositories rehydrate Attempts, they never
 * mutate them.
 */
export interface AttemptRepository {
  save(snapshot: AttemptSnapshot): Promise<void>;
  findById(id: string): Promise<AttemptSnapshot | null>;
  /** Newest first, scoped to one learner (implicit in MVP) and problem. */
  listByProblem(problemSlug: string): Promise<AttemptSnapshot[]>;
  listAll(): Promise<AttemptSnapshot[]>;
}
