import type { Difficulty } from "@/domain/problem/Problem";

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "border-good/40 text-good",
  Medium: "border-amber/50 text-amber",
  Hard: "border-bad/50 text-bad",
};

export function DifficultyTag({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`border px-2 py-0.5 font-mono text-[0.6875rem] tracking-[0.12em] uppercase ${DIFFICULTY_STYLES[difficulty]}`}
    >
      {difficulty}
    </span>
  );
}
