import type { Problem } from "./Problem";

/**
 * Port: the domain defines what persistence must do; infrastructure
 * (SQLite) decides how. One interface, one real implementation — no
 * repository factories for aesthetics.
 */
export interface ProblemRepository {
  list(): Promise<Problem[]>;
  findBySlug(slug: string): Promise<Problem | null>;
}
