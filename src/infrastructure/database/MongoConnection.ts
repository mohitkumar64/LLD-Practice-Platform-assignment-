import { MongoClient, type Db, type Collection } from "mongodb";
import type { Problem } from "@/domain/problem/Problem";
import type { AttemptSnapshot } from "@/domain/attempt/Attempt";

/** Stored document shapes: string _id keeps round-tripping explicit. */
export type ProblemDoc = Problem & { _id: string };
export type AttemptDoc = AttemptSnapshot & { _id: string };

/**
 * Singleton Mongo client. Next.js dev-mode hot reloads create a fresh
 * module graph on every change, so the client is cached on globalThis to
 * avoid exhausting Atlas connection pools.
 */

const uri = process.env.MONGODB_URI ?? "";
const dbName = process.env.MONGODB_DB ?? "schematic";

interface MongoCache {
  client?: MongoClient;
  ready?: Promise<Db>;
}

const globalCache = globalThis as typeof globalThis & { __schematicMongo?: MongoCache };
const cache: MongoCache = (globalCache.__schematicMongo ??= {});

export function isDatabaseConfigured(): boolean {
  return uri.length > 0;
}

async function connect(): Promise<Db> {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured");
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
  cache.client = client;
  await client.connect();
  const db = client.db(dbName);
  await db.collection("attempts").createIndex({ problemSlug: 1, attemptNumber: -1 });
  await db.collection("problems").createIndex({ slug: 1 }, { unique: true });
  return db;
}

export async function getDb(): Promise<Db> {
  cache.ready ??= connect();
  try {
    return await cache.ready;
  } catch (err) {
    // Allow a later request to retry a failed connection.
    cache.ready = undefined;
    throw err;
  }
}

export async function problemCollection(): Promise<Collection<ProblemDoc>> {
  const db = await getDb();
  return db.collection<ProblemDoc>("problems");
}

export async function attemptCollection(): Promise<Collection<AttemptDoc>> {
  const db = await getDb();
  return db.collection<AttemptDoc>("attempts");
}

export async function closeDatabase(): Promise<void> {
  await cache.client?.close();
  cache.client = undefined;
  cache.ready = undefined;
}
