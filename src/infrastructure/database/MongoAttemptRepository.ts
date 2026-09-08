import type { AttemptSnapshot } from "@/domain/attempt/Attempt";
import type { AttemptRepository } from "@/domain/attempt/AttemptRepository";
import { attemptCollection, type AttemptDoc } from "./MongoConnection";

/**
 * Mongo-backed attempt store. An AttemptSnapshot is plain JSON, so documents
 * are stored as-is with _id = attempt id. Nothing Mongo-specific leaks into
 * the domain: this repository deals purely in snapshots.
 */
export class MongoAttemptRepository implements AttemptRepository {
  async save(snapshot: AttemptSnapshot): Promise<void> {
    const col = await attemptCollection();
    await col.replaceOne({ _id: snapshot.id }, snapshot, { upsert: true });
  }

  async findById(id: string): Promise<AttemptSnapshot | null> {
    const col = await attemptCollection();
    const doc = await col.findOne({ _id: id });
    return doc ? toSnapshot(doc) : null;
  }

  async listByProblem(problemSlug: string): Promise<AttemptSnapshot[]> {
    const col = await attemptCollection();
    const docs = await col
      .find({ problemSlug })
      .sort({ attemptNumber: -1 })
      .toArray();
    return docs.map(toSnapshot);
  }

  async listAll(): Promise<AttemptSnapshot[]> {
    const col = await attemptCollection();
    const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
    return docs.map(toSnapshot);
  }
}

function toSnapshot(doc: AttemptDoc): AttemptSnapshot {
  const { _id, ...snapshot } = doc;
  void _id;
  return snapshot;
}
