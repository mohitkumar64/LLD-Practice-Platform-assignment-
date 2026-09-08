"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Problem } from "@/domain/problem/Problem";
import type { AttemptSnapshot } from "@/domain/attempt/Attempt";
import type {
  DesignEntity,
  DesignRelationship,
  PatternUsage,
} from "@/domain/submission/StructuredDesignSubmission";
import { api } from "@/lib/api";
import { EntityEditor, RelationshipEditor, PatternEditor } from "@/components/DesignEditors";

type Tab = "classes" | "relationships" | "patterns" | "tradeoffs";

const TABS: { id: Tab; label: string }[] = [
  { id: "classes", label: "1 · Classes" },
  { id: "relationships", label: "2 · Relationships" },
  { id: "patterns", label: "3 · Patterns" },
  { id: "tradeoffs", label: "4 · Trade-offs" },
];

interface ServerError {
  code?: string;
  message: string;
  issues?: { field: string; message: string }[];
}

export function PracticeWorkspace({
  problem,
  attempt,
}: {
  problem: Problem;
  attempt: AttemptSnapshot;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("classes");
  const [entities, setEntities] = useState<DesignEntity[]>(attempt.submission?.entities ?? []);
  const [relationships, setRelationships] = useState<DesignRelationship[]>(
    attempt.submission?.relationships ?? [],
  );
  const [patterns, setPatterns] = useState<PatternUsage[]>(attempt.submission?.patterns ?? []);
  const [tradeoffs, setTradeoffs] = useState<string>(attempt.submission?.tradeoffs.join("\n") ?? "");
  const [pseudocode, setPseudocode] = useState<string>(attempt.submission?.pseudocode ?? "");
  const [serverIssues, setServerIssues] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorMap = useMemo(() => new Map(serverIssues), [serverIssues]);

  const completeness = {
    classes: entities.filter((e) => e.name && e.responsibilities.length > 0).length,
    relationships: relationships.length,
    patternsJustified: patterns.filter((p) => p.justification).length,
    tradeoffs: tradeoffs.split("\n").filter((t) => t.trim()).length,
  };

  async function submit() {
    setSubmitting(true);
    setError(null);
    setServerIssues(new Map());
    try {
      await api.submitDesign(attempt.id, {
        entities,
        relationships,
        patterns,
        tradeoffs: tradeoffs.split("\n").map((t) => t.trim()).filter(Boolean),
        pseudocode: pseudocode || null,
      });
      router.push(`/attempts/${attempt.id}`);
    } catch (err) {
      const e = err as ServerError;
      if (e.issues && Array.isArray(e.issues)) {
        const map = new Map<string, string>();
        for (const issue of e.issues) map.set(issue.field, issue.message);
        setServerIssues(map);
        setError("Some parts of the design need attention before it can be submitted.");
      } else {
        setError(e.message ?? "Submission failed. Try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
      {/* Left rail: problem requirements, sticky while designing. */}
      <aside className="h-fit lg:sticky lg:top-24">
        <div className="border border-line bg-panel">
          <div className="border-b border-line px-4 py-3">
            <p className="microlabel">Problem</p>
            <h2 className="mt-1 font-semibold text-paper">{problem.title}</h2>
          </div>
          <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
            <section>
              <h3 className="microlabel mb-2">Requirements</h3>
              <ol className="space-y-2">
                {problem.requirements.map((req, i) => (
                  <li key={req.id} className="flex gap-2 text-xs leading-relaxed text-muted">
                    <span className="font-mono text-faint">{String(i + 1).padStart(2, "0")}</span>
                    {req.description}
                  </li>
                ))}
              </ol>
            </section>
            <section className="mt-5">
              <h3 className="microlabel mb-2">Consider</h3>
              <ul className="space-y-2">
                {problem.designConsiderations.map((c) => (
                  <li key={c} className="flex gap-2 text-xs leading-relaxed text-muted">
                    <span className="mt-1.5 size-1 shrink-0 bg-amber/70" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>

        <div className="mt-4 border border-line bg-panel px-4 py-3">
          <p className="microlabel mb-2">Draft coverage</p>
          <ul className="space-y-1 font-mono text-xs text-muted">
            <li>
              types with responsibilities:{" "}
              <span className={completeness.classes >= 3 ? "text-good" : "text-amber"}>
                {completeness.classes}
              </span>
            </li>
            <li>relationships: <span className="text-paper">{completeness.relationships}</span></li>
            <li>justified patterns: <span className="text-paper">{completeness.patternsJustified}</span></li>
            <li>
              trade-offs:{" "}
              <span className={completeness.tradeoffs >= 1 ? "text-good" : "text-amber"}>
                {completeness.tradeoffs}
              </span>
            </li>
          </ul>
        </div>
      </aside>

      {/* Right: the design editor. */}
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="microlabel">Attempt #{attempt.attemptNumber} · workspace</p>
            <h1 className="mt-1 text-xl font-semibold text-paper">Design your solution</h1>
          </div>
          <SubmitButton onClick={submit} busy={submitting} />
        </div>

        <div className="mb-5 flex flex-wrap gap-px border border-line bg-line" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-3 py-2.5 font-mono text-xs tracking-[0.1em] uppercase transition-colors ${
                tab === t.id ? "bg-raise text-amber" : "bg-panel text-muted hover:text-paper"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-5 border border-bad/40 bg-bad/5 p-4" role="alert">
            <p className="font-mono text-xs tracking-[0.12em] text-bad uppercase">Cannot submit yet</p>
            <p className="mt-1 text-sm text-muted">{error}</p>
          </div>
        )}

        <div className="min-h-[420px]">
          {tab === "classes" && (
            <EntityEditor entities={entities} onChange={setEntities} errors={errorMap} />
          )}
          {tab === "relationships" && (
            <RelationshipEditor
              relationships={relationships}
              entities={entities}
              onChange={setRelationships}
              errors={errorMap}
            />
          )}
          {tab === "patterns" && (
            <PatternEditor patterns={patterns} onChange={setPatterns} errors={errorMap} />
          )}
          {tab === "tradeoffs" && (
            <div className="space-y-5">
              <div>
                <label htmlFor="tradeoffs" className="microlabel mb-2 block">
                  Trade-offs & conscious assumptions (one per line)
                </label>
                <textarea
                  id="tradeoffs"
                  rows={6}
                  className="w-full border border-line bg-raise px-3 py-2.5 text-sm leading-relaxed text-paper placeholder:text-faint focus:border-amber/70 focus:outline-none"
                  placeholder={
                    "Chose a flat spot list per floor over a spatial index — scan cost is fine at this scale.\nPayment is settle-at-exit only; prepayment can be added behind the same interface."
                  }
                  value={tradeoffs}
                  onChange={(e) => setTradeoffs(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="pseudocode" className="microlabel mb-2 block">
                  Optional pseudocode / signatures
                </label>
                <textarea
                  id="pseudocode"
                  rows={8}
                  className="w-full border border-line bg-raise px-3 py-2.5 font-mono text-[0.8125rem] leading-relaxed text-paper placeholder:text-faint focus:border-amber/70 focus:outline-none"
                  placeholder={"interface PricingStrategy {\n  fee(ticket: Ticket, exit: DateTime): Money\n}"}
                  value={pseudocode}
                  onChange={(e) => setPseudocode(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <p className="max-w-md text-xs leading-relaxed text-faint">
            Deterministic checks plus a senior-engineer-style AI review will judge your
            decisions — not match them against a reference answer.
          </p>
          <SubmitButton onClick={submit} busy={submitting} />
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="bg-amber px-5 py-2.5 font-mono text-sm font-semibold tracking-[0.08em] text-ink transition hover:bg-amber/85 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Submitting…" : "Submit for review"}
    </button>
  );
}
