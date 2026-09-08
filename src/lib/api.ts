import type {
  AttemptSnapshot,
  AttemptStatus,
} from "@/domain/attempt/Attempt";
import type { EvaluationResult } from "@/domain/evaluation/EvaluationResult";
import type { Problem, ProblemWithProgress } from "@/domain/problem/Problem";

export type { AttemptSnapshot, AttemptStatus, EvaluationResult, Problem, ProblemWithProgress };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json()) as { error?: { code: string; message: string; details?: Record<string, unknown> } };
  if (!res.ok) {
    throw Object.assign(new Error(body.error?.message ?? `Request failed (${res.status})`), {
      code: body.error?.code,
      details: body.error?.details,
    });
  }
  return body as T;
}

export interface ApiErrorDetails {
  issues?: { field: string; message: string }[];
}

export const api = {
  async startAttempt(problemSlug: string): Promise<AttemptSnapshot> {
    const { attempt } = await request<{ attempt: AttemptSnapshot }>("/api/attempts", {
      method: "POST",
      body: JSON.stringify({ problemSlug }),
    });
    return attempt;
  },

  async getAttempt(id: string): Promise<AttemptSnapshot> {
    const { attempt } = await request<{ attempt: AttemptSnapshot }>(`/api/attempts/${id}`);
    return attempt;
  },

  async getEvaluation(id: string): Promise<{
    status: AttemptStatus;
    failureReason: string | null;
    evaluation: EvaluationResult | null;
  }> {
    return request(`/api/attempts/${id}/evaluation`);
  },

  async retryEvaluation(id: string): Promise<AttemptSnapshot> {
    const { attempt } = await request<{ attempt: AttemptSnapshot }>(`/api/attempts/${id}/evaluation`, {
      method: "POST",
    });
    return attempt;
  },

  async submitDesign(
    id: string,
    payload: unknown,
  ): Promise<AttemptSnapshot> {
    const { attempt } = await request<{ attempt: AttemptSnapshot }>(`/api/attempts/${id}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return attempt;
  },
};
