import type { EvaluationIssue, EvaluationResult, Severity } from "@/domain/evaluation/EvaluationResult";
import { ScoreReadout, MeterBar } from "@/components/ScoreReadout";

const SEVERITY_STYLES: Record<Severity, { border: string; text: string; label: string }> = {
  high: { border: "border-bad/50", text: "text-bad", label: "High" },
  medium: { border: "border-amber/50", text: "text-amber", label: "Medium" },
  low: { border: "border-info/40", text: "text-info", label: "Low" },
};

/**
 * Renders the structured EvaluationResult. Every field the evaluator
 * produced is visible here — the review is explainable end to end.
 */
export function EvaluationView({ evaluation }: { evaluation: EvaluationResult }) {
  const covered = evaluation.requirementCoverage.filter((r) => r.covered).length;
  const coveragePct =
    evaluation.requirementCoverage.length > 0
      ? Math.round((covered / evaluation.requirementCoverage.length) * 100)
      : 0;

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-paper">Design review</h1>
          <p className="mt-3 leading-relaxed text-muted">{evaluation.summary}</p>
        </div>
        <div className="border border-line bg-panel px-6 py-4 text-center">
          <p className="microlabel mb-2">Score</p>
          <ScoreReadout score={evaluation.overallScore} />
          <p className="mt-2 font-mono text-[0.6875rem] text-faint">
            {evaluation.sources.llmContributed
              ? "deterministic checks + AI reasoning"
              : "deterministic checks only"}
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="microlabel mb-3 text-good">What works</h2>
          {evaluation.strengths.length === 0 ? (
            <p className="text-sm text-faint">
              Nothing strong enough to call out yet — focus on the issues first.
            </p>
          ) : (
            <ul className="space-y-3">
              {evaluation.strengths.map((s) => (
                <li key={s.title} className="border-l-2 border-good/60 bg-panel px-4 py-3">
                  <p className="flex items-start gap-2 text-sm font-medium text-paper">
                    <span className="mt-0.5 text-good" aria-hidden>✓</span>
                    {s.title}
                  </p>
                  <p className="mt-1 pl-5 text-xs leading-relaxed text-muted">{s.explanation}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="microlabel mb-3 text-amber">Needs attention</h2>
          {evaluation.issues.length === 0 ? (
            <p className="text-sm text-faint">No significant issues found. Strong submission.</p>
          ) : (
            <ul className="space-y-3">
              {evaluation.issues.map((issue, i) => (
                <IssueCard key={`${issue.title}-${i}`} issue={issue} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Requirement coverage. */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="microlabel">Requirement coverage</h2>
          <span className="font-mono text-xs text-muted">
            {covered}/{evaluation.requirementCoverage.length} · {coveragePct}%
          </span>
        </div>
        <MeterBar value={coveragePct} />
        <ul className="mt-4 space-y-2">
          {evaluation.requirementCoverage.map((req) => (
            <li key={req.requirementId} className="border border-line bg-panel px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-paper/90">
                <span className={`mt-0.5 font-mono ${req.covered ? "text-good" : "text-bad"}`} aria-hidden>
                  {req.covered ? "✓" : "✕"}
                </span>
                {req.requirement}
              </p>
              <p className="mt-1 pl-6 text-xs leading-relaxed text-muted">{req.explanation}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Design quality dimensions. */}
      <section>
        <h2 className="microlabel mb-4">Design quality dimensions</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {evaluation.dimensions.map((d) => (
            <div key={d.name} className="border border-line bg-panel px-4 py-3">
              <MeterBar value={d.score} label={d.name} hint={d.explanation} />
              <p className="mt-2 text-xs leading-relaxed text-muted">{d.explanation}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Next-attempt suggestions. */}
      {evaluation.suggestions.length > 0 && (
        <section className="border border-amber/25 bg-amber/[0.04] p-5">
          <h2 className="microlabel mb-3 !text-amber">For your next attempt</h2>
          <ol className="space-y-3">
            {evaluation.suggestions.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="mt-0.5 font-mono text-xs text-amber">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="text-sm font-medium text-paper">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function IssueCard({ issue }: { issue: EvaluationIssue }) {
  const style = SEVERITY_STYLES[issue.severity];
  return (
    <li className={`border-l-2 ${style.border} bg-panel px-4 py-3`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`border ${style.border} px-1.5 py-0.5 font-mono text-[0.625rem] tracking-[0.1em] uppercase ${style.text}`}
        >
          {style.label}
        </span>
        <span className="font-mono text-[0.625rem] tracking-[0.1em] text-faint uppercase">
          {issue.category}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-paper">{issue.title}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{issue.explanation}</p>
      <p className="mt-2 text-xs leading-relaxed text-paper/80">
        <span className="font-mono text-[0.625rem] tracking-[0.1em] text-faint uppercase">Try: </span>
        {issue.suggestion}
      </p>
      {issue.example && (
        <pre className="mt-2 overflow-x-auto border border-line bg-ink px-3 py-2 font-mono text-[0.6875rem] leading-relaxed text-muted">
          {issue.example}
        </pre>
      )}
    </li>
  );
}
