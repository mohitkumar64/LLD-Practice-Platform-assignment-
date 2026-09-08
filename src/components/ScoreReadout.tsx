/** Large mono score readout with a hairline progress track. */
export function ScoreReadout({ score, compact = false }: { score: number; compact?: boolean }) {
  const tone = score >= 80 ? "text-good" : score >= 55 ? "text-amber" : "text-bad";
  return (
    <div className={compact ? "flex items-baseline gap-1" : "flex items-end gap-2"}>
      <span className={`font-mono ${compact ? "text-lg font-semibold" : "text-5xl font-semibold tracking-tight"} ${tone}`}>
        {score}
      </span>
      {!compact && <span className="pb-1 font-mono text-sm text-faint">/ 100</span>}
    </div>
  );
}

export function MeterBar({
  value,
  label,
  hint,
}: {
  value: number;
  label?: string;
  hint?: string;
}) {
  const tone = value >= 80 ? "bg-good" : value >= 55 ? "bg-amber" : "bg-bad";
  return (
    <div>
      {label && (
        <div className="mb-1 flex items-baseline justify-between gap-4">
          <span className="text-sm text-paper/90">{label}</span>
          <span className="font-mono text-xs text-muted">{value}%</span>
        </div>
      )}
      <div
        className="h-1.5 w-full bg-line"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? "score"}
        title={hint}
      >
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
