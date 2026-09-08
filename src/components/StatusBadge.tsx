import type { AttemptStatus } from "@/domain/attempt/Attempt";

const STYLES: Record<AttemptStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "border-line-strong text-muted" },
  SUBMITTED: { label: "Submitted", className: "border-info/50 text-info" },
  EVALUATING: { label: "Evaluating…", className: "border-info/50 text-info" },
  EVALUATED: { label: "Evaluated", className: "border-good/50 text-good" },
  FAILED: { label: "Evaluation failed", className: "border-bad/50 text-bad" },
};

export function StatusBadge({ status }: { status: AttemptStatus }) {
  const style = STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[0.6875rem] tracking-[0.12em] uppercase ${style.className}`}
    >
      {status === "EVALUATING" && (
        <span className="size-1.5 animate-pulse rounded-full bg-info" aria-hidden />
      )}
      {style.label}
    </span>
  );
}
