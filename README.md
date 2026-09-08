# Schematic — LLD Practice Platform

Practice **low-level design** the way you'd get better at it in real life:
pick a problem, submit a **structured design** (classes, responsibilities,
relationships, patterns, trade-offs — not a giant text box), and receive the
kind of review a senior engineer would leave on your pull request:

> **What was detected → why it matters → what to try next.**

Then start a fresh attempt, fix the design, and compare scores. The product's
core value is **iteration with explainable feedback**, not an AI score generator.

```
Choose Problem → Understand Requirements → Design → Submit
      ↑                                                ↓
Try Again  ←  Review History  ←  Design Review (deterministic + AI)
```

---

## Screens

| Screen | What it does |
|---|---|
| **Problem Library** (`/`) | Cards with difficulty, estimated time, attempt status, best score |
| **Problem Detail** (`/problems/[slug]`) | Statement, functional requirements, assumptions, "what the review looks for" |
| **Practice Workspace** (`/practice/[attemptId]`) | Two-panel editor: sticky requirements rail + tabbed structured design editor (Classes → Relationships → Patterns → Trade-offs) with live draft-coverage counters |
| **Design Review** (`/attempts/[id]`) | Score, summary, strengths, issues (severity/category/what/why/try), per-requirement coverage, dimension meters, next-attempt suggestions. Polls while `EVALUATING`; retry UI on `FAILED` |
| **Attempt History** (`/attempts`) | Per-problem groups, scores, `+delta` vs previous attempt |

## Architecture

Single Next.js (App Router) monolith, strictly layered:

```
src/
├── domain/                      # pure TS — no React, no HTTP, no Mongo, no AI SDK
│   ├── problem/                 # Problem, ProblemRepository (port)
│   ├── attempt/                 # Attempt aggregate (lifecycle invariants), AttemptRepository (port)
│   ├── submission/              # StructuredDesignSubmission + structural validator
│   ├── evaluation/              # Evaluator (port), EvaluationResult, RuleBasedEvaluator, HybridEvaluator
│   └── errors/                  # typed DomainError hierarchy (stable error codes)
├── application/                 # use cases: ProblemService, AttemptService, EvaluationService
├── infrastructure/
│   ├── database/                # Mongo connection + repositories (snapshots in / snapshots out)
│   ├── ai/                      # NvidiaLlmClient, LlmDesignEvaluator, zod-validated output schema
│   └── data/                    # seed problems (code-owned, idempotently upserted)
├── app/api/                     # thin route handlers; domain errors → HTTP via one mapper
├── app/                         # pages (server components) + client components
├── components/                  # focused UI components
├── lib/                         # composition root (container.ts), typed browser API client
└── api/                         # errorResponse mapper
tests/                           # vitest — domain behaviour; no DB / no AI / no React required
```

**The key boundary:** the domain depends on the `Evaluator` *interface*
(`evaluate(problem, submission): Promise<EvaluationResult>`). OpenAI/NVIDIA
never leaks into the domain. Tests substitute evaluators freely; the app
composes `RuleBasedEvaluator` + `LlmDesignEvaluator` into a `HybridEvaluator`
at the composition root only.

## Evaluation architecture

```
Structured submission
        │
        ▼
┌──────────────────────────────┐   ┌─────────────────────────────┐
│ RuleBasedEvaluator           │   │ LlmDesignEvaluator          │
│ deterministic checks:        │   │ senior-engineer-style review│
│ • completeness               │   │ • coupling/cohesion         │
│ • duplicates / dangling refs │   │ • extensibility probes      │
│ • requirement keyword        │   │ • pattern appropriateness   │
│   coverage                   │   │ • trade-off quality         │
└──────────────┬───────────────┘   └──────────────┬──────────────┘
               │  facts (fed as evidence)         │  judgment
               └──────────────┬───────────────────┘
                              ▼
                     HybridEvaluator merge
              0.3 × deterministic + 0.7 × reasoned
        issues merged · coverage reconciled · provenance kept
                              ▼
                  EvaluationResult (zod-validated shape)
```

Rules never judge design *quality*; the LLM never invents *facts* unchecked.
The AI's raw output is JSON-extracted (brace-balanced scanner), shape-coerced
(deterministic container fixes), then **zod-validated** — malformed responses
fail the evaluation loudly (attempt → `FAILED`, learner can retry) rather than
silently producing a guess.

## Attempt lifecycle (domain-enforced)

```
DRAFT ──submit──▶ SUBMITTED ──▶ EVALUATING ──▶ EVALUATED
                    │               │    └──fail──▶ FAILED ──retry──▶ EVALUATING
  invalid submission stays DRAFT   └ EVALUATING restart = crash recovery
```

- A submitted attempt's submission is **immutable** — iterating means a new attempt.
- An `EVALUATED` attempt can never be re-scored.
- Only structural validity gates submission; design quality is the reviewer's job.

## Tech stack

- **Next.js 15** (App Router, Route Handlers, server components) + **TypeScript** (strict)
- **Tailwind CSS v4** (single styling strategy; dark "drafting desk" theme, IBM Plex)
- **MongoDB Atlas** (collections: `problems` seeded from code, `attempts` snapshots)
- **NVIDIA NIM** via the OpenAI-compatible SDK (`nvidia/nemotron-3.5-lightning-30b-a3b`)
- **zod** for AI output validation, **vitest** for domain tests

## Setup

```bash
npm install
```

Create `.env.local` (all values are server-side only — never shipped to the browser):

```ini
# NVIDIA NIM — OpenAI-compatible endpoint for the LLM design reviewer
NVIDIA_API_KEY=<your nvapi key>
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@<host>/schematic?retryWrites=true&w=majority
```

Run:

```bash
npm run dev        # http://localhost:3000
```

Problems seed themselves into Mongo on first request (idempotent upserts).
Without `NVIDIA_API_KEY` the platform degrades gracefully to rules-only review
instead of failing; with it, submissions get the full hybrid review.

## Tests

```bash
npm test           # vitest run (30 tests)
npm run typecheck  # tsc --noEmit (strict)
npm run build      # production build
```

Covered behaviour: the full attempt lifecycle, immutability after submit,
invalid submissions (empty, duplicates, dangling references, unjustified
patterns), evaluation failure → `FAILED` → retry, crash recovery from a stale
`EVALUATING`, attempt-history preservation, `PROBLEM_NOT_FOUND`, evaluator
substitution (swap evaluators without touching attempt logic), deterministic
reproducibility, and the hybrid merge rules (score blend, issue merging,
coverage reconciliation, strength de-duplication).

## Example API tour

```bash
# problems (with attempt progress)
curl localhost:3000/api/problems

# start an attempt
curl -X POST localhost:3000/api/attempts -H 'content-type: application/json' \
  -d '{"problemSlug":"parking-lot"}'

# submit a structured design (returns 202 with status EVALUATING)
curl -X POST localhost:3000/api/attempts/<id>/submit -H 'content-type: application/json' \
  -d '{"entities":[{"name":"ParkingLot","kind":"class","responsibilities":["Owns spots"],"keyMethods":["park(v)"]}],"relationships":[],"patterns":[],"tradeoffs":["flat scan"]}'

# poll the review
curl localhost:3000/api/attempts/<id>/evaluation

# retry a failed evaluation
curl -X POST localhost:3000/api/attempts/<id>/evaluation
```

## Limitations (intentional)

- **Single implicit learner** — no auth; the assignment is about the practice loop.
- **In-process evaluation** — modelled as a fail-able process with statuses and
  retry, but it runs in the server process (no job queue by design).
- **No diagram editor** — structured text is deliberately preferred: it evaluates better.
- Three seeded problems; a new problem is one array entry in
  `src/infrastructure/data/seedProblems.ts`.

## Future improvements

- Multiple submission formats (code, diagram) behind a `SubmissionParser` port.
- Evaluator selection per problem; configurable scoring weights.
- Human-review calibration signals for dimension rubrics.
- Streaming partial feedback (deterministic checks instantly, LLM section streams in).
