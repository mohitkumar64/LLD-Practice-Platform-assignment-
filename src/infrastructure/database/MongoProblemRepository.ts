import type { WithId, Document } from "mongodb";
import type { Problem } from "@/domain/problem/Problem";
import type { ProblemRepository } from "@/domain/problem/ProblemRepository";
import { SEED_PROBLEMS } from "@/infrastructure/data/seedProblems";
import { problemCollection, type ProblemDoc } from "./MongoConnection";

/**
 * Mongo-backed problem store. Problems are code-owned seed data: the
 * collection is hydrated from SEED_PROBLEMS on first use (idempotent upsert),
 * so "add a new problem" stays a one-file, code-reviewed change.
 */
export class MongoProblemRepository implements ProblemRepository {
  private seedOnce?: Promise<void>;

  async list(): Promise<Problem[]> {
    await this.ensureSeeded();
    const col = await problemCollection();
    const docs = await col.find({}).toArray();
    return docs.map(toProblem);
  }

  async findBySlug(slug: string): Promise<Problem | null> {
    await this.ensureSeeded();
    const col = await problemCollection();
    const doc = await col.findOne({ _id: slug });
    return doc ? toProblem(doc) : null;
  }

  private ensureSeeded(): Promise<void> {
    this.seedOnce ??= this.seed().catch((err) => {
      this.seedOnce = undefined; // allow retry on next request
      throw err;
    });
    return this.seedOnce;
  }

  private async seed(): Promise<void> {
    const col = await problemCollection();
    const operations = SEED_PROBLEMS.map((problem) => ({
      replaceOne: {
        filter: { _id: problem.slug },
        replacement: { ...problem, _id: problem.slug } satisfies ProblemDoc,
        upsert: true,
      },
    }));
    await col.bulkWrite(operations, { ordered: false });
  }
}

function toProblem(doc: ProblemDoc): Problem {
  const { _id, ...problem } = doc;
  void _id;
  return problem;
}
