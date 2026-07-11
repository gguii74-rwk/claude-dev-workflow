---
name: writing-plans-split
description: Use when you have a spec or requirements for a multi-step task and are about to write an implementation plan that should be split into a thin entrypoint .md plus one file per task (instead of one large plan file). Use instead of superpowers:writing-plans when split plans are preferred in the repo you are working in. 트리거 예: "분할 계획 짜줘", "plan 나눠서 작성해줘", "구현 계획 작성해줘(분할 plan 규약 repo)", "태스크별 plan 파일로 쪼개줘".
---

# Writing Split Plans

## Overview

Write comprehensive implementation plans as a **thin entrypoint `.md` + one file per task**, not a single large file. Multi-task features written into one plan file balloon to thousands of lines, which burdens all three stages — writing, adversarial review, and execution.

This is a fork of `superpowers:writing-plans` adapted for **split output**. Only the *structure* changes; the rigor does not. All of writing-plans' discipline still applies: bite-sized steps, no placeholders, **full code in every code step**, DRY / YAGNI / TDD / frequent commits.

**Announce at start:** "I'm using writing-plans-split to create the implementation plan."

## When to use / not

- Use when a spec is ready and you are about to write a multi-step implementation plan in this repo.
- Use **instead of** `superpowers:writing-plans` here (repo `CLAUDE.md` mandates split plans).
- Not for single-task changes — a one-task change is a single short file or just do it.
- Not retroactive — existing single-file plans, if any, stay as-is. New plans only.

## Output structure

```
docs/plans/YYYY-MM-DD-<feature>.md     # thin entrypoint (same path as old single-file plans)
docs/plans/YYYY-MM-DD-<feature>/       # task body directory
├── task-01-<slug>.md
├── task-02-<slug>.md
└── task-NN-<slug>.md
```

- The entrypoint keeps the conventional `plans/<feature>.md` path → links/habits that point at a plan by path do not break. File `<feature>.md` and directory `<feature>/` coexist (different names).
- `task-NN` is zero-padded for sort order; `<slug>` is kebab-case, 1–2 words naming the core module (e.g. `task-03-calendar-event-projection.md`).

## Entrypoint `<feature>.md` (thin — target 100–200 lines)

1. **Header:** Feature name, Goal (one sentence), Architecture (2–3 sentences), Tech Stack.
2. **Execution contract (MUST)** — paste this block verbatim into the entrypoint:
   > **For agentic workers — execution contract (MUST):** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. This plan is split into per-task files (`<feature>/task-NN-<slug>.md`). Task bodies (Files, TDD steps, AC) are **NOT** in this entrypoint. To execute, MUST: ① read this entrypoint's §Shared Contracts → ② load exactly one target task file → ③ run its steps in order. Do not start implementing from the entrypoint alone (it has no steps). Do not load all task files at once.
3. **Shared Contracts:** schema / migrations, types & interfaces, key function signatures, shared constants referenced by 2+ tasks. The entrypoint is always read alongside any task file, so contracts live here **once** — this is the ONLY exception to "repeat everything." Task files point to "entrypoint §Shared Contracts" rather than re-inlining shared types.
4. **Task table:**

   ```markdown
   | # | title | status | file | deps | outcome |
   |---|-------|--------|------|------|---------|
   | 01 | Prisma multiSchema + outbox | [ ] | [task-01](<feature>/task-01-schema-foundation.md) | — | |
   | 02 | leave repository methods | [ ] | [task-02](<feature>/task-02-leave-repository.md) | 01 | |
   ```

   - **status:** `[ ]` todo / `[x]` done (markdown checkbox — current convention).
   - **outcome:** filled in one line on completion (files created, key decisions, what later tasks must know). Lightweight context accumulation in markdown — no JSON, no runner.

## Task file `<feature>/task-NN-<slug>.md` (self-contained — target 150–400 lines)

One task per file, following writing-plans' task structure:

1. **Title + one-line purpose.**
2. **Files:** exact Create / Modify / Test paths (+ line ranges where useful).
3. **Prep:** spec sections to read, prior task outputs, which §Shared Contracts items this task uses.
4. **Deps:** prior task numbers (if any).
5. **TDD steps:** failing test → run (expect FAIL) → minimal implementation → run (expect PASS) → commit. **Full code inline in every code step** (determinism preserved). Only shared types are replaced by an "entrypoint §Shared Contracts" reference.
6. **Acceptance Criteria:** runnable commands (`npm run typecheck`, `npm run lint`, `npm test`, `npm run prisma:validate`, …) with expected output.
7. **Cautions:** "**Don't do X. Reason: Y**" — not "be careful."

## No placeholders

Same as writing-plans — these are plan failures, never write them:
- "TBD", "TODO", "implement later", "add appropriate error handling", "handle edge cases".
- "Write tests for the above" without the actual test code.
- "Similar to Task N" — repeat the code; tasks are read independently, one file at a time.
- Steps that say what to do without showing how (code blocks required for code steps).
- References to types/functions not defined in this task or in §Shared Contracts.

## Self-review (after writing all files, fresh eyes)

- **(a) Spec coverage:** each spec requirement → a task? List gaps; add tasks.
- **(b) Placeholder scan:** any of the red flags above? Fix.
- **(c) Cross-file contract consistency:** types/signatures used in task files match entrypoint §Shared Contracts and each other (most fragile when split — a function named `clearLayers()` in task 3 but `clearFullLayers()` in task 7 is a bug).
- **(d) [REQUIRED GATE] Self-containment:** each task file is executable from the entrypoint + its own content alone. Execution relies on a prose contract, so this gate is mandatory — do not pass review until every task file stands on its own.

Fix inline. No need to re-review — fix and move on.

## Execution handoff

Execution uses `superpowers:subagent-driven-development`. The dispatcher reads the entrypoint, then per task loads §Shared Contracts + that one task file into the subagent prompt. The execution contract is stated in two places — the entrypoint header (above) and repo `CLAUDE.md` — to reduce reliance on any single prose instruction.

This is a **prose contract**, not a code-enforced loader (the dispatcher is an LLM). That is deliberate: determinism does not live in the dispatch mechanism — it lives in the **task files' full inlined code**, the same trust model single-file plans already use.
