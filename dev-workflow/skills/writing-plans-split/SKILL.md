---
name: writing-plans-split
description: Use when you have a spec or requirements for a multi-step task and are about to write an implementation plan that should be split into a thin entrypoint .md plus one file per task (instead of one large plan file). Use instead of superpowers:writing-plans when split plans are preferred in the repo you are working in. 트리거 예 — "분할 계획 짜줘", "plan 나눠서 작성해줘", "구현 계획 작성해줘(분할 plan 규약 repo)", "태스크별 plan 파일로 쪼개줘".
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
   > **For agentic workers — execution contract (MUST):** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. This plan is split into per-task files (`<feature>/task-NN-<slug>.md`). Task bodies (Files, TDD steps, AC) are **NOT** in this entrypoint. To execute, MUST: ① read this entrypoint's §Shared Contracts → ② load exactly one target task file → ③ run its steps in order → ④ **record completion**: when the task is **confirmed complete** (reviews approved — SDD's "mark todo complete" sync point; the implementer's DONE report is NOT completion), the dispatcher (the executor itself when running without subagents) immediately — before dispatching the next task — sets that task's row in this entrypoint's task table to `[x]`, writes its one-line outcome, and **commits this entrypoint file on the spot**. **Convergence check (MUST, at all three points — before starting any task, when initializing a resumed/recovered session, and before entering the final whole-branch review):** reconcile this task table against the SDD progress ledger and git log. The authority for "complete" is an **explicit completion record in the SDD progress ledger**; git log only corroborates that a recorded commit exists and was not reverted — an implementation commit by itself is NOT completion (implementer commits exist before review approval). A task whose ledger completion record is missing or ambiguous is **incomplete (fail-closed)** — including a row already marked `[x]`: revert it to `[ ]`. **That rule presumes a live ledger.** A ledger that is absent — or present but holding no completion record for any task while this table already has `[x]` rows — is fresh or lost, not authoritative. (Judge by content, not by the file: SDD's setup recreates an identity-only `progress.md` before reading the plan, so a workspace lost to `git clean -fdx` looks "present"; same for post-final-review cleanup `rm -rf <workspace>` and for execution without SDD.) In that state authority falls back to **this committed task table**, which ④ writes only at confirmed completion, with git log corroborating each `[x]` row's commit. Never mass-revert the table over a fresh or lost ledger: revert only a row git log contradicts (no such commit, or reverted), and if the table itself is unreadable, ask your human partner instead of re-dispatching. Rebuild the ledger's completion lines from the surviving table before continuing, so later checks have a live ledger again. A row filled in but not yet committed is also unconverged: commit it before proceeding. Do not start implementing from the entrypoint alone (it has no steps). Do not load all task files at once.
3. **Shared Contracts:** schema / migrations, types & interfaces, key function signatures, shared constants referenced by 2+ tasks. The entrypoint is always read alongside any task file, so contracts live here **once** — this is the ONLY exception to "repeat everything." Task files point to "entrypoint §Shared Contracts" rather than re-inlining shared types.
4. **Task table:**

   ```markdown
   | # | title | status | file | deps | outcome |
   |---|-------|--------|------|------|---------|
   | 01 | Prisma multiSchema + outbox | [ ] | [task-01](<feature>/task-01-schema-foundation.md) | — | |
   | 02 | leave repository methods | [ ] | [task-02](<feature>/task-02-leave-repository.md) | 01 | |
   ```

   - **status:** `[ ]` todo / `[x]` done (markdown checkbox — current convention). Set per execution contract ④ — only on confirmed completion (reviews approved), never on the implementer's DONE report.
   - **outcome:** one line (files created, key decisions, what later tasks must know). When and by whom it is written is governed by execution contract ④ — the dispatcher, at confirmed completion, before the next task starts, committed on the spot. Lightweight context accumulation in markdown — no JSON, no runner.
5. **UI mockup contract (only when the spec has a `## UI 설계` section):** state the selected mockup path (`docs/design/<feature>/…`) and `docs/design/style-guide.md` as an **implementation contract** — the implemented screen must match the chosen mockup's visual structure. Put it in the entrypoint **and in the Prep of every UI task file**: execution subagents read one task file (plus §Shared Contracts) and never see the spec, so a path that lives only in the entrypoint header does not reach them.

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

Execution uses `superpowers:subagent-driven-development` (SDD). The dispatcher reads the entrypoint, then per task loads §Shared Contracts + that one task file into the subagent prompt. Between tasks the dispatcher also owns contract ④ — status·outcome recording + commit at confirmed completion, and the three-point convergence check; the subagent loading contract is unchanged (each subagent still gets exactly one task file + §Shared Contracts).

**SDD 6.2.0 adapter:** SDD asks for `scripts/task-brief PLAN_FILE N` before dispatch — that script extracts a "Task N" section from a single plan file, which a split plan does not have (task files carry no "Task N" heading, and the entrypoint carries no task bodies). **Skip the extraction: the task file itself is the brief** — pass its full text as the brief in the dispatch (same intent: brief = the task's complete text). **Keep the SDD workspace and progress ledger keyed to the entrypoint** — `scripts/sdd-workspace <entrypoint path>` — one workspace per plan, never per task file.

The execution contract is stated in two places — the entrypoint header (above) and repo `CLAUDE.md` — to reduce reliance on any single prose instruction.

This is a **prose contract**, not a code-enforced loader (the dispatcher is an LLM). That is deliberate: determinism does not live in the dispatch mechanism — it lives in the **task files' full inlined code**, the same trust model single-file plans already use.
