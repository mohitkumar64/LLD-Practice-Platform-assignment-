# DESIGN.md

## MVP — what is in and what is out

**In:** problem library (3 seeded, real requirements) · problem detail ·
structured design submission (classes / relationships / patterns / trade-offs /
optional pseudocode) · hybrid evaluation (deterministic checks + LLM design
review) · structured, explainable feedback · attempt history with score deltas ·
failed-evaluation modelling with retry.

**Out (deliberately):** authentication (single implicit learner), diagram
editor, real-time collaboration, job queue / distributed processing,
analytics dashboards, gamification, more problems, payment, multi-tenancy.

The scope test applied to every idea: *does it make the learner better at LLD,
or is it just technology?*

## User journey

```
Choose  →  /            (library; shows attempt status + best score per problem)
Practice → /problems/[slug]         (requirements, assumptions, what review looks for)
Design  →  /practice/[attemptId]    (two-panel workspace, 4 sections, draft coverage)
Submit  →  POST /attempts/:id/submit (202 → EVALUATING)
Review  →  /attempts/[id]           (polls; score, strengths, issues, coverage, dimensions)
Retry   →  FAILED attempts get a one-click "Retry evaluation"
Compare →  /attempts               (per-problem history, +delta vs previous attempt)
Try again → new DRAFT attempt for the same problem
```

## Domain model

The domain was designed before the UI. Concepts earned their own class only
when they had behaviour or invariants — no anemic record-plus-getter classes,
no interface-per-class ceremony.

### `Problem` (value object, code-seeded)
- **State:** slug, title, difficulty, statement, `requirements[]` (id +
  description + keyword hints), assumptions, design considerations.
- **Deliberate absence:** no reference solution. LLD has many valid designs;
  grading against a canonical answer is the anti-pattern this product avoids.
  Keyword hints power *deterministic coverage checks*, not answer matching.

### `Attempt` (aggregate — the invariant owner)
- **State:** id, problemSlug, attemptNumber, status, timestamps, submission,
  evaluation, failureReason.
- **Behaviour:** `submit()` (validates + stamps, immutability enforced),
  `beginEvaluation()`, `completeEvaluation()`, `failEvaluation()`.
- **Invariants:**
  - submission only from `DRAFT`; once submitted it is immutable — iteration
    is a *new* attempt, never a rewrite of history;
  - invalid submissions never enter persistence (validator runs inside `submit`);
  - evaluation only from `SUBMITTED` (or `FAILED` retry, or `EVALUATING`
    restart for crash recovery);
  - completion/failure only from `EVALUATING`; an `EVALUATED` attempt can never
    be re-scored.
- Persistence works on immutable **snapshots** (`AttemptSnapshot`); repositories
  rehydrate aggregates, they never mutate them.

### `StructuredDesignSubmission` + validator
- **State:** entities (name, kind, responsibilities, keyMethods, extends,
  implements), relationships (typed, described), patterns (with mandatory
  justification), trade-offs, optional pseudocode.
- The validator enforces *shape*, not *quality*: non-empty, unique valid type
  names, responsibilities present, relationships and hierarchies resolve to
  declared types, patterns need justification, at least one trade-off.
  It also **normalizes** raw payloads (unknown kinds coerced, dash bullets
  stripped, junk filtered) so bad clients cannot corrupt the review input.

### `EvaluationResult` (value object — the feedback contract)
overallScore · summary · strengths[] · issues[] (severity, category, title =
what, explanation = why, suggestion = direction, optional example) ·
requirementCoverage[] · dimensions[] · suggestions[] · `sources` (provenance:
deterministic report, whether the LLM contributed, model id). Every field is
rendered in the UI — nothing is "stored but invisible".

## Interfaces (only where they earn their place)

| Port | Why it exists | Implementations |
|---|---|---|
| `Evaluator` | The AI provider must never leak into the domain; evaluation is a strategy | `RuleBasedEvaluator`, `LlmDesignEvaluator`, `HybridEvaluator`, test fakes |
| `AttemptRepository` / `ProblemRepository` | Persistence is infrastructure; services depend on ports | Mongo implementations, in-memory fakes in tests |
| `Clock` | Deterministic timestamps in tests | system clock |

**Where I refused abstractions:** no `RepositoryFactory`, no generic
`IEntityService`, no interface over `NvidiaLlmClient` (it *is* the adapter —
its one consumer is the evaluator), no per-field DTO/mapper layer. The
composition root (`src/lib/container.ts`) is the single place that knows
concrete classes.

## Evaluation architecture

Deterministic and AI evaluation have different jobs, and the hybrid makes the
division explicit:

- **`RuleBasedEvaluator`** produces *facts*: completeness, internal consistency,
  keyword-based requirement coverage. Instant, reproducible, free. Its score is
  a floor signal; its check results are passed to the LLM as evidence.
- **`LlmDesignEvaluator`** produces *judgment*: responsibility placement,
  coupling, cohesion, extensibility ("if a new vehicle type appears, what
  changes?"), pattern appropriateness, trade-off quality. The prompt frames it
  as a senior reviewer with rules: cite the learner's actual type names, never
  reward pattern names alone, many valid designs exist, calibrate scores honestly.
- **`HybridEvaluator`** merges: overall = 0.3 × deterministic + 0.7 × reasoned;
  issues from both (structural ones prefixed `[structural]`, sorted by
  severity); reasoned requirement coverage wins but inherits the deterministic
  explanation; shared dimensions blend 80/20 toward reasoning; strengths are
  de-duplicated. Provenance (`sources`) records where every part came from.

AI output handling: streaming completion (reasoning deltas discarded) →
strip `<think>`/fences → brace-balanced JSON extraction → deterministic shape
coercion (known container variations, numeric strings) → **zod schema
validation** → clamped score, mapped coverage. Any failure throws typed errors
and lands as attempt `FAILED`.

## Failure handling

Evaluation is modelled as a process that can fail, not an instant grade:

```
SUBMITTED → EVALUATING → EVALUATED
                └─fail─→ FAILED (human-readable reason) → retry → EVALUATING
```

- The submit endpoint returns **202 with `EVALUATING`** immediately; the UI
  polls. No HTTP request ever blocks on an LLM call.
- Failures (provider down, timeout, malformed output after one corrective
  retry) are recorded on the attempt with a reason the learner can read; the
  submission survives; retry is one click.
- A crash mid-evaluation leaves a stale `EVALUATING`; re-beginning evaluation
  is allowed (and tested) so attempts are never stuck forever.
- Domain errors map to precise HTTP codes (404 / 409 / 400 / 502) through one
  mapper; raw stack traces never reach the client.
- API keys and Mongo credentials are env-only, read server-side; AI output is
  never trusted without schema validation; evaluation results are stored in
  structured form, not prose.

## Persistence model

MongoDB Atlas, two collections:

- `problems` — `_id = slug`, upserted from code on first access. Adding a
  problem is a one-file, reviewable change.
- `attempts` — `_id = attempt id`, document = `AttemptSnapshot` verbatim
  (plain JSON), indexed by `(problemSlug, attemptNumber)`.

Snapshots-in/snapshots-out keeps Mongo knowledge out of the domain entirely.

## Extensibility

- **New problem:** append one entry to `SEED_PROBLEMS` (statement, requirements
  with keyword hints, assumptions, design considerations). Nothing else changes.
- **New submission format:** the domain consumes
  `StructuredDesignSubmission`; a new format (code, diagram) adds a parser that
  produces that shape — attempt/evaluation logic is untouched.
- **New evaluator:** implement `Evaluator`, wire it in the container (or in a
  test). The lifecycle already treats evaluation as a black box — proven by
  tests that swap evaluators mid-flow without touching attempt logic.
- **Different AI provider:** replace `NvidiaLlmClient` (one file). The
  evaluator's prompt/parse logic is provider-agnostic.

## Key trade-offs (what I chose NOT to build)

1. **No job queue.** The domain models evaluation as an async, fail-able
   process with statuses and crash recovery; a real queue is operational
   machinery the MVP doesn't need. The seams (status transitions, retry
   endpoint, in-flight guard) are exactly where a queue would plug in.
2. **No diagram editor.** Structured text evaluates better (names,
   responsibilities, relationships are checkable) and is faster to iterate on.
3. **No auth.** A single implicit learner keeps every screen honest. Adding a
   `learnerId` to `Attempt` + a session later is a contained change.
4. **Keyword coverage is a heuristic, not truth.** A design can cover a
   requirement without using its vocabulary — that is precisely why coverage is
   *merged* with the LLM's reasoned verdict instead of trusted alone.
5. **AI thinking-mode disabled for the review call.** Chain-of-thought
   multiplied latency to minutes and leaked prose into the JSON stream; the
   corrective-retry + strict-schema path gives better reliability per second.
   (Reasoning in AI_USAGE.md.)
6. **No reference solutions.** Grading against a canonical design would teach
   the wrong lesson. Quality of decisions is what gets reviewed.
