/**
 * StructuredDesignSubmission — what a learner actually submits.
 *
 * Product decision: we do NOT accept "a giant text box". A meaningful LLD
 * attempt captures design *decisions*: entities and their responsibilities,
 * relationships, patterns (with justification), and trade-offs. Pseudocode
 * is optional garnish, not the meal.
 */

export type DesignEntityKind = "class" | "abstract-class" | "interface";

export interface DesignEntity {
  name: string;
  kind: DesignEntityKind;
  /** What this type is responsible for — one entry per responsibility. */
  responsibilities: string[];
  /** Important behaviours / methods, e.g. "allocateSpot(vehicle): ParkingSpot". */
  keyMethods: string[];
  extends: string | null;
  implements: string[];
}

export type RelationshipType =
  | "association"
  | "aggregation"
  | "composition"
  | "inheritance"
  | "implements"
  | "dependency";

export interface DesignRelationship {
  from: string;
  to: string;
  type: RelationshipType;
  description: string;
}

export interface PatternUsage {
  /** e.g. "Strategy", "Factory Method". */
  name: string;
  /** Where it is applied, e.g. "PricingStrategy for fee calculation". */
  where: string;
  /** Why it earns its place — mentioning a pattern is not using it well. */
  justification: string;
}

export interface StructuredDesignSubmission {
  entities: DesignEntity[];
  relationships: DesignRelationship[];
  patterns: PatternUsage[];
  tradeoffs: string[];
  pseudocode: string | null;
}

/** Raw payload from the API before normalization (strings may be missing). */
export interface RawSubmissionPayload {
  entities?: unknown;
  relationships?: unknown;
  patterns?: unknown;
  tradeoffs?: unknown;
  pseudocode?: unknown;
}
