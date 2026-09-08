"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

/** "Start practice" — creates a DRAFT attempt, then routes into the workspace. */
export function StartPracticeButton({ problemSlug }: { problemSlug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const attempt = await api.startAttempt(problemSlug);
      router.push(`/practice/${attempt.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the attempt.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={busy}
        className="inline-flex items-center gap-2 bg-amber px-5 py-2.5 font-mono text-sm font-semibold tracking-[0.08em] text-ink transition hover:bg-amber/85 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Preparing draft…" : "Start practice"}
        {!busy && <span aria-hidden>→</span>}
      </button>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
