# claude-dev-workflow

**English** | [한국어](README.ko.md) | [日本語](README.ja.md)

A marketplace that ships a set of battle-tested development-workflow tools as a single Claude Code plugin, **`dev-workflow`**. Install once, use in **every project**.

| Tool | Kind | Invocation | Role |
|---|---|---|---|
| dev-cycle | skill | `/dev-workflow:dev-cycle` | Recommended pipeline map for a new feature — kickoff through integration — + tells you which step you're on and whether a small change takes the standard or the fast lane (read-only, start here) |
| review-loop | skill | `/dev-workflow:review-loop` | After each spec/plan/impl stage: commit → codex adversarial review (settled-decisions guard auto-injected to suppress re-flags) → adjudicate/auto-fix, then a neutral confirm round verifies the fixes and rules on merge readiness — until zero unadjudicated blocking (critical/high/medium) findings remain. Plan-stage loops clear a four-item format gate before starting |
| writing-plans-split | skill | `/dev-workflow:writing-plans-split` | Write multi-step implementation plans as a thin entrypoint + one file per task, with completion recording as a committed contract step |
| harden-spec | skill | `/dev-workflow:harden-spec` | Adversarially pressure a draft spec before plan/implementation to dig out missed gaps, assumptions, and invariant violations, and harden the spec in place (project-aware) |
| ui-mockup | skill | `/dev-workflow:ui-mockup` | (Optional, step 3.5) When a hardened spec creates or reshapes a screen: diverge non-executable HTML mockups, let the user pick, and record the UI decision in the spec as a settled decision |
| setup | skill | `/dev-workflow:setup` | (On explicit request) idempotently insert a pipeline-convention pointer into this repo's CLAUDE.md |
| doctor | skill | `/dev-workflow:doctor` | Read-only diagnosis of four environment items (installed version · marketplace freshness · codex · context window); every fix is delegated to the existing path |
| orchestrate | skill | `/dev-workflow:orchestrate` | (1.2.0+) Shared procedure for a **main session** that runs tracks in Orca terminals — launch · watch · question routing · stage-end verification and handoff · successors (project rules come first) |
| mr-review | skill | `/dev-workflow:mr-review <project> <iid>` | (1.3.0+) Read-only review of **someone else's MR** — deterministic authoring-rule checks · pinned review head · two independent model reviews (Claude subagent + Codex task) · draft report in the team policy's four-verdict format. Requires a project adapter document |
| Context-threshold nudge | Stop hook | (automatic) | Past a threshold (default 40%), nudges to write a handoff + `/clear` — and again every 15pp band after it (40 → 55 → 70 → 85%, no cap) |

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
  - [dev-cycle](#1-dev-cycle--pipeline-map-start-here)
  - [review-loop](#2-review-loop--adversarial-review-loop)
  - [writing-plans-split](#3-writing-plans-split--split-implementation-plans)
  - [harden-spec](#4-harden-spec--spec-hardening)
  - [ui-mockup](#5-ui-mockup--ui-mockup-selection)
  - [setup](#6-setup--adopt-the-pipeline-in-a-repo)
  - [doctor](#7-doctor--diagnose-the-environment)
  - [orchestrate](#8-orchestrate--main-session-track-operation)
  - [Context-threshold handoff hook](#9-context-threshold-handoff-hook-automatic)
  - [mr-review](#10-mr-review--two-model-review-draft-for-someone-elses-mr)
- [Auto-prompting the plugin when a repo is cloned](#auto-prompting-the-plugin-when-a-repo-is-cloned)
- [Troubleshooting](#troubleshooting)
- [Caveats](#caveats)
- [Development / Release](#development--release)

## Requirements

- **Claude Code v2.1.140 or later** recommended (includes plugin dependency support).
- **codex plugin** — `review-loop` calls codex's `adversarial-review`, so this plugin depends on `codex@openai-codex`. The dependency is declared in `plugin.json`'s `dependencies`, so it is **installed automatically alongside** (provided the `openai-codex` marketplace is registered — see Installation below).
- **codex CLI authentication is separate** — the plugin dependency only pulls in the codex *plugin*. You must install and log in to the codex CLI yourself (`/codex:setup`) for `review-loop` to actually work. `writing-plans-split` and the context hook work without this authentication.
- **`glab` CLI (authenticated)** — `mr-review` reads the GitLab REST API via `glab api` (GET only). The other skills work without `glab`.

## Installation

One time only. Run each line below **in order** (all of them, not just one).

```
# (Only if you have never used codex) register the codex marketplace:
/plugin marketplace add openai/codex-plugin-cc

# The main plugin:
/plugin marketplace add gguii74-rwk/claude-dev-workflow
/plugin install dev-workflow@claude-dev-workflow      # the codex plugin is installed automatically as a dependency
```

- `marketplace add` is "catalog registration" (telling Claude Code where to fetch from); `install` is the actual installation.
- `dev-workflow@claude-dev-workflow` follows the `<plugin>@<marketplace>` format — plugin first, marketplace second (similar names, different things).
- Installing at user scope (the default) enables it in every project. Once installed, you never need to type this again in later sessions or other projects.

**Verify installation:**

```
/plugin                                   # check dev-workflow / codex in the Manage tab
# or via CLI:
claude plugin list                        # OK if dev-workflow@claude-dev-workflow and codex@openai-codex appear
```

## Usage

### 1. `dev-cycle` — pipeline map (start here)

Invoke when you don't know where or in what order to start a new feature or a large change. A **read-only map** that shows this toolkit's **recommended development pipeline** and **which step you're currently on** (modifies no files).

```
/dev-workflow:dev-cycle
```

Recommended order: **brainstorming → spec → harden-spec → ui-mockup (optional, only when screens change) → review-loop(spec) → writing-plans-split → review-loop(plan) → subagent-driven-development → review-loop(impl) → integrate & post-release verification**. Stage boundaries (spec→plan, plan→impl) require a fresh session + `/clear` by convention, so dev-cycle **guides only the current step and nudges toward the next** (it is not a single-session autopilot). Steps 1, 7, and 9 (brainstorming, subagent-driven-development, finishing-a-development-branch) recommend the `superpowers` plugin — without it, you can substitute your own design/implementation/wrap-up process (not a hard dependency).

Since 0.11.0 the map spans **kickoff to done**. **Step 9 — integrate & post-release verification (PR, merge, deploy, field check)** — is a *pointer* to the running repo's own convention, not a checklist copied in here; in a repo with nothing to deploy (a plugin, say) a release plus install-refresh instructions take its place. At kickoff the map prints a **five-item brief** once — design conclusion, measured evidence, files to change, verification method, done criteria through step 9 — **on screen only, creating no file**. And a **fast lane** replaces the old all-or-nothing choice: the branch axis is **contact surface and reversibility, not size** — schema, migration, permissions, auth, security boundary, external integration, data loss/corruption, and irreversible work stay on the standard path no matter how small (a 12-task wording cleanup is light; a 1-task column drop is not). Three things no fast-lane track may skip: **the spec document, step 3 harden-spec, and step 8 impl adversarial review**. Above that floor, steps are dropped **one at a time, each with its reason recorded in the spec's settled-decisions block**, and the "which step am I on" check reads those records before it rules — an absence with no record is still incomplete. Fast-lane approval is **session-scoped**: after a `/clear` the map asks again instead of assuming, and refusals or ambiguous answers default to the standard path. When confirmation itself is impossible — a non-interactive run that cannot deliver a question, or the user explicitly said to proceed unattended — since 0.17.0 a **contact-surface scan decides instead**: clearly no signal → fast lane; any signal or an unclear scan → standard path (fail-closed). An auto-judged fast-lane entry leaves a one-line audit record in the spec, and a resumed run re-scans regardless of that record. The scan stands in only for that fast-lane/standard confirmation — other confirmations (guard 1's fail-closed checks, step-9 merge/deploy approvals) are never auto-decided and stay pending when they cannot be asked.

### 2. `review-loop` — adversarial review loop

After each stage, commit your changes and run codex adversarial review. Findings are auto-fixed or closed with a disposition, repeating until **"zero blocking (critical/high/medium) findings remain unadjudicated."** The goal is not "zero findings" but "zero unadjudicated."

The loop runs in **two modes**. It opens in **adversarial (discovery) mode** — codex `adversarial-review` digs out omissions and defects. An adversarial reviewer never returns zero findings no matter how many times you run it, so that mode alone can never end the loop. Once a transition signal fires (score plateau · fix queue drained · adversarial budget spent), the loop switches to **confirm (neutral) mode**, whose objective is *"is this mergeable?"* — it verifies that items you claimed to have fixed are actually gone, audits regressions and the proportionality of your adjudications, and issues a verdict. "No new blocking findings, fixes confirmed" becomes a legitimate output, so termination is natural.

Since 0.9.0, **every adversarial round auto-injects the settled-decisions guard as review focus** — the full settled-decision block plus one-line summaries of closed ledger items, reassembled right before each round and attached to the review command, suppressing re-flags of already-closed items at the source (measured: even with the guard sitting in the diff, the same finding was re-raised five rounds in a row). Adjudications the loop made on its own are priority-audited by the confirm round, preserving the path to revisit a wrong call.

Since 0.10.0, a plan-stage loop clears a **four-item format gate** before its first round: the entrypoint carries the current `writing-plans-split` execution contract (compared against the installed skill's canonical block — presence alone is not enough, since a stale block can drop the very protection the gate exists for), a §Shared Contracts section, a fingerprint column in the inherited ledger, and `status`/`outcome` columns in the task table. Cheap fixes — replacing the block, adding the section or column — are resolved before the loop starts; a structural rewrite (a single-file plan that would have to be split) escalates to you instead of the loop performing surgery outside review. Items ①②④ apply only in repos whose `CLAUDE.md` mandates split plans (and skip single-task changes); ③ — the fingerprint column in the inherited ledger — applies regardless of the split-plan convention whenever an inherited ledger exists.

Since 0.18.0, each round runs **detached**: the companion call is written to a wrapper script under `.remember/`, launched with a one-line node `spawn(detached)`, and its output, pid and a `COMPANION_EXIT:` marker land in files — the loop waits in the background and judges completion by the marker, so a Bash tool timeout or a dead waiter no longer loses the round. A round is valid only with the review header, the schema JSON and at least one command-execution log line; a sandbox-wide startup failure is an execution failure, not "zero findings". The companion path is resolved from the plugin registry every round. FIXED rows cite the fix commit **after** it lands (fix commit first, hash cited in the next commit), which removes the hash-only follow-up commits.

Since 0.19.0, every question the loop asks the user is written on the assumption that **the reader has not seen the raw finding or the ledger**: each item gets a plain-language explanation plus one concrete example scenario, the first option is the recommendation (marked "(추천)"), option labels are plain action names with the disposition code in parentheses (e.g. 「지금 고친다 (FIXED)」 = "fix it now"), and a batch presentation ends with one progress question (keep and continue / roll back selectively / stop and review).

All options are optional — plain `/dev-workflow:review-loop` works.

| Option | Default | Role |
|---|---|---|
| `--phase spec\|plan\|impl` | auto-inferred | Which stage to review. If omitted, inferred from the changes |
| `--base <ref>` | `main` | Base branch the adversarial review diffs against. Resolved to a SHA at loop start so every round sees the same snapshot |
| `--max <n>` | `5` | Cap on **adversarial (discovery) rounds.** Confirm rounds do not count against it |
| `--confirm-rounds <n>` | `2` | **Confirm-round budget.** Cumulative across the whole loop; not reset on re-entry |
| `--auto-rounds <n>` | `3` | First n rounds run in **auto mode** — auto-fix defects and batch up non-risky user decisions to ask at once. `0` = ask immediately every round; use `1` for security-sensitive work. In delegated mode (1.2.0+) the track answers the batch itself — only risky items reach a person |
| `--security yes\|no` | — | (1.1.0+) **Pass the security-critical track decision in advance** — use it when you (or an orchestrator) have already made that call. With it, the loop doesn't ask; it adopts the value and records it with the source "caller-specified" (`호출자 지정`) in the ledger's first line and the final summary. Omitted, the loop checks the touched surface and asks once if needed. Independent of the session mode. With `yes`, adding `--auto-rounds 1` is recommended |
| `--resume` | — | Resume an interrupted loop from the saved state (including the ledger) in `.remember/loop-*.md` |

> **`--max` changed meaning in 0.8.0.** Through 0.7.x it was a hard cap on total iterations; it now caps **adversarial rounds only**. The total is still bounded but larger — at the defaults, **at most 10 rounds** (5 adversarial + 2 confirm + 1 returning adversarial round when confirm finds blocking + 1 re-entry confirm + 1 fallback-② confirm run in a fresh session). To bound execution the way it used to be, lower `--max` and `--confirm-rounds` together.

```
/dev-workflow:review-loop --phase impl                   # review the implementation (after typecheck·lint·test·build gates)
/dev-workflow:review-loop --phase spec --auto-rounds 1   # security-sensitive → minimize auto mode
/dev-workflow:review-loop --phase impl --security yes --auto-rounds 1   # security call already made → don't ask again
/dev-workflow:review-loop --base develop                 # diff against develop instead of main
/dev-workflow:review-loop --max 3 --confirm-rounds 1     # bound the round count (at most 7)
/dev-workflow:review-loop --resume                       # continue a loop cut off by context limits
```

**How it works** — each adversarial round: ① commit uncommitted changes → ② run codex adversarial review → ③ classify and adjudicate findings by fingerprint (FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE/ESCALATE) → ④ fix FIXED items (via TDD for impl) → ⑤ re-run gates. Once a transition signal fires, confirm mode takes over: ⑥ verify the entire unconfirmed-FIXED queue is gone → ⑦ audit regressions and adjudications → ⑧ issue a merge-readiness verdict. Termination requires **all three**: zero unadjudicated blocking findings, an empty unconfirmed-FIXED queue, and a passing confirm verdict.

> Adversarial review looks at the **committed HEAD (branch diff)**. Running it with uncommitted changes misses your latest fixes, so the loop always enforces the order "fix → commit → review."
>
> **Fixing something does not close it.** A FIXED item is settled only when a confirm round explicitly records it as gone — an adversarial round not raising it again is a discovery result, not a confirmation. So any track with even one FIXED item must pass through a confirm round (only a clean track terminates without one — no FIXED and no loop-issued adjudication).

### 3. `writing-plans-split` — split implementation plans

Invoke once a spec is ready: writes a large implementation plan as a **thin entrypoint + one file per task**. Avoids the burden a single thousands-of-lines plan file puts on writing, adversarial review, and execution alike.

```
/dev-workflow:writing-plans-split
```

Output structure:

```
docs/plans/YYYY-MM-DD-<feature>.md     # thin entrypoint (goal, architecture, Shared Contracts, task table)
docs/plans/YYYY-MM-DD-<feature>/       # task bodies
├── task-01-<slug>.md                  # each file self-contained: Files, TDD steps, AC, Cautions
├── task-02-<slug>.md
└── task-NN-<slug>.md
```

Execute with `superpowers:subagent-driven-development` — the dispatcher hands each subagent the entrypoint's Shared Contracts plus one task at a time.

Since 0.10.0 the entrypoint's execution contract also makes **recording completion** a step rather than a habit. Once reviews have approved a task — an implementer's DONE report is not completion — the dispatcher marks its row `[x]`, writes the one-line outcome, and commits the entrypoint on the spot, before dispatching the next task. On resume it reconciles the task table against the SDD progress ledger and git log: a task with no ledger completion record is treated as incomplete, because an implementation commit exists before review approval. That rule presumes a live ledger, so when the ledger is gone or was recreated empty — a workspace lost to `git clean -fdx`, or cleaned up after the final review — authority falls back to the committed table instead of mass-reverting rows that git log does not contradict, and the rebuilt ledger is flagged as restoring completion state only.

### 4. `harden-spec` — spec hardening

**Before a brainstormed draft spec moves on to plan/implementation**, adversarially pressure it to dig out the gaps that force a redesign when discovered late (missed requirements, hidden assumptions, edge cases, cross-module ripple, invariant violations), and **harden the spec in place**. **Project-aware** — it reads the running repo's `CLAUDE.md`, ADRs, and existing specs to pressure with *that project's* invariants and prior decisions.

```
/dev-workflow:harden-spec [spec path]
```

**Pinned to Fable** — frontmatter (`model: fable` + `effort: max`) so the pressure runs on the strongest model regardless of the session model. Questioning is **hybrid**: high-risk gaps (irreversible, cross-module, invariants, AC-changing) are probed one at a time in depth, while remaining judgment gaps go out in batched rounds of up to 4 (AskUserQuestion) **until the ledger is exhausted**. Facts are investigated directly in the code; every judgment gap is asked to the user — **no DEFERRED without a question first**. Settled matters (ADRs, prior decisions) are not relitigated. Each resolved gap becomes a proposed wording change applied to the spec on approval; at the end, residual risks are recorded as DEFERRED, the spec is committed, and the skill stops (next stage recommended in a fresh session). It is the complement that runs ahead of `review-loop` (codex artifact verification), filling in *what only a human knows* first. Also auto-triggers on phrases like "harden this spec" or "find what I missed" or "pre-mortem."

Since 0.19.0, each question body is written for a reader who has not seen the gap ledger or the spec text: a plain-language explanation plus one concrete example scenario, with gap IDs and decision numbers only as a trailing reference; option labels are plain action names and each description says what changes if that option is chosen.

### 5. `ui-mockup` — UI mockup selection

**Optional step 3.5 — between `harden-spec` and `review-loop(spec)`.** Invoke when a hardened spec **creates a new screen or changes an existing screen's composition**. It diverges self-contained **non-executable** static HTML mockups, has you pick one, and records the decision in the spec's `## UI 설계` section plus the settled-decision block — so plan and implementation cannot reinterpret the visual direction later. Selections converge into `docs/design/style-guide.md`, which keeps UI from fragmenting feature by feature.

```
/dev-workflow:ui-mockup [spec path]
```

Divergence follows repo state: no style guide and no existing UI → **4 distinct styles**; no guide but existing UI → you choose **keep (reverse-extract a guide from it)** or **renew**; guide present → **2–3 layout variants** only. Multi-screen specs diverge the **representative screen alone**; the rest are generated after the pick, so rejected candidates cost nothing. Divergence is capped at 2 rounds total. Nothing is finalized without your confirmation — a combination ("layout 2 + colors 4") is regenerated once and re-confirmed, and the remaining screens of a multi-screen spec get one final check before anything is written to the spec. Output lands in `docs/design/<feature>/`, with candidates and the comparison page committed as history. Minor changes (copy, color, a single control) are skipped entirely, and a call with no target spec is refused — it points you at brainstorming → harden-spec instead.

### 6. `setup` — adopt the pipeline in a repo

Invoke when a repo should **explicitly** adopt this pipeline. Idempotently inserts a marker block with a **one-line pointer** (to `dev-cycle`, plus install instructions for those without the plugin) into the project's CLAUDE.md — it does not copy the full guide, so when the convention body changes (SSOT = `dev-cycle`), each repo's CLAUDE.md never goes stale.

```
/dev-workflow:setup
```

It then asks for the **context window size** used by the threshold hook (`CLAUDE_CTX_LIMIT`) and writes it to settings.json (global or project — your choice). The hook cannot know the window size at runtime, so it assumes 1M; on a 200k model you need to state it for the nudge to fire on time.

Runs only on explicit request and never touches content outside the marker block. Collaborators and non-plugin users can learn the convention and how to install just by reading CLAUDE.md.

### 7. `doctor` — diagnose the environment

Call this when the pipeline environment may be **silently wrong**. It is read-only and never writes your work or settings — every problem it finds is delegated to the existing path (`/plugin update` · `/codex:setup` · `/dev-workflow:setup`).

```
/dev-workflow:doctor
```

Besides the explicit call, it also fires on **symptom sentences** ("the nudge never shows up", "codex won't run", "is the plugin up to date", "is the version right"). It checks four things — (1) installed version (enumerating the whole entry array so `user`, `project` and `local` scopes are all seen), (2) marketplace freshness, (3) codex (CLI presence, auth, companion — and nothing deeper; that goes to `codex doctor`), (4) `CLAUDE_CTX_LIMIT` against **the current model** (the hook cannot know the window size at runtime, so it cannot make this check).

**Staleness is judged by comparing the `dev-workflow/` subtree.** A raw sha comparison cries wolf on every docs-only commit, and a `git log` based judgment reports staleness even when the tree is identical after a revert. With no evidence (network failure, missing `gitCommitSha`) it says **"cannot determine"** and never says "up to date". The four-row table is **always printed**, healthy or not, and a failing probe does not stop the rest — so you never end up with no information at the exact moment the environment is most broken.

A codex failure *inside* a running review-loop belongs to `review-loop`, so doctor stays out of it; it also stays out of vague failure sentences ("why doesn't it work") and of the same words about **another product** ("is the playwright plugin up to date").

### 8. `orchestrate` — main-session track operation

(1.2.0+) For a **main session** that runs pipeline tracks in separate Orca terminals: launch → watch → route questions → verify and hand off at the stage boundary → successors. It is the shared procedure only — **project rules come first** (repo id, branches, worktree policy, prompt file location, model allocation and permission flags live in the project's CLAUDE.md or project skill). Orca command details are not copied into the skill — it points to `orca skills get orca-cli`.

```
/dev-workflow:orchestrate <track · stage · spec path>
```

- **① Launch** — look up the installed version for that checkout (lookup only), pick the mode (human stages = manual, review-loop(spec) on = delegated), set the model with `--model` only (never send `/model` to a track — it is saved as the new-session default in your global settings.json) and the session id with `--session-id`, fill in the bundled track-prompt template, then create the terminal and send a one-line pointer to the prompt file. One track per checkout.
- **② Watch** — one background `watch` run per wait; verdict `DONE | HANDOFF | SETTLED | QUESTION | PERMISSION | TIMEOUT | ERR`.
- **③ Questions** — human stages and manually run tracks: everything goes to you. Delegated tracks: only risky questions (critical · security · direction · AC/goal/non-goal/decision changes · `[감사 이의]` audit objections · permission prompts) reach you. Push · other-machine changes · external runs · irreversible steps: always you. Before every send: `alive`, then re-read the screen.
- **④ Stage end** — the main session verifies the track's report itself (commit range · gates · no AI trailers · diff scope · the confirmation-pending ledger), asks you about pending entries, writes the handoff, and stops at the stage boundary.
- **⑤ Successors · pairing · multiple tracks** — resumes a `HANDOFF` automatically only when its reason is the nudge and only after the old session has exited, recovers an unexpectedly exited track with `claude --resume <session id>`, and runs remote tracks via `--environment`.

Bundled script `scripts/orchestrate.mjs` (the only place Orca details live): `watch` (track state), `alive` (is the terminal **and** the claude session alive — exit 0 alive / 1 exited / 2 unreadable / 3 stale handle), `key` (TUI keys `enter` `tab` `shift-tab` `up` `down` `text`). Bundled template `templates/track-prompt.md` (role · files · decisions · scope · review-loop arguments · fact check · stop conditions · `[TRACK-DONE …]` / `[TRACK-HANDOFF …]` markers · nudge behavior).

> ⚠️ The default launch command for a delegated track includes `--dangerously-skip-permissions` — nobody is there to click permission prompts. The safety net is the prompt's stop conditions (no push, no irreversible steps) and the routing rows that always ask you; a permission prompt that still appears is never approved by the main session (it is auto-denied if you are away).

### 9. Context-threshold handoff hook (automatic)

Works immediately after installation; no configuration. When conversation context usage crosses a threshold (default 40%), it nudges you to write a handoff and `/clear` before stalling — helping you hand over before context blows up mid-task. Since 0.12.0 the nudge is **not once-only**: it fires again on every 15-percentage-point band above the threshold (40 → 55 → 70 → 85%, with no upper cap), so ignoring the first one no longer means silence until auto-compact hits. Re-nudges add the facts (you were told before, here is the current %) without escalating the instruction. If usage drops two bands or more — auto-compact keeps the same session id — the hook treats it as a new cycle and starts nudging from the threshold again. Since 0.18.0 the nudge also states what it means: **finish only the current unit of work** (one review round, one SDD task, one fix, one question round) and start no new one; if a background job is running, do not `/clear` before it completes — when its completion wakes the session, record the result and stop, then hand over.

Tune via environment variables (optional):

```
CLAUDE_CTX_THRESHOLD=0.5    # set threshold to 50% (0–1, default 0.4)
DEV_WORKFLOW_MODE=delegated # delegated mode (1.1.0+) — see "Session mode" below; set it as a prefix on the track terminal's launch command
CLAUDE_CTX_LIMIT=200000     # set the context token limit explicitly
                            # if unset: 1,000,000 (current models). Set this only for 200k-window
                            # models — the window size is not knowable at runtime, so it is not detected
```

Since 1.0.0, in an **Orca terminal** (a session with `ORCA_TERMINAL_HANDLE`), the nudge's `/clear` guidance becomes an **automatic handover**: after writing the handoff, the session spawns a successor `claude` terminal in the same checkout (titled `<task>-<token>`), assembles the resume prompt as a file (`.remember/successor-<token>.prompt`), sends it, and stops. After checking that no other session's codex job is running in this folder (waiting up to 10 minutes), the successor's first action is to shut the old session down cleanly (send `/exit` → confirm it exited → `terminal close`), and it runs no codex before that. If the preflight fails, no terminal has been made yet, so the current `/clear` guidance is shown right away; if a later step — create, boot, delivery — fails, the session first waits until no other session's codex job is running in this folder (up to 10 minutes), then cleans up the half-made terminal and confirms it is gone, and only then shows the current `/clear` guidance; if the successor cannot be pinned down (create response lost — new handles versus the list taken just before creation are only reported as candidates, never adopted even if there is exactly one), the job check does not pass, or the cleanup cannot be confirmed, it reports the blocked state instead of guiding `/clear`. Stage boundaries (spec→plan, plan→impl) are out of scope: the successor does not start another stage and asks you instead. Outside Orca, nothing changes.

**Session mode — manual / delegated (1.1.0+).** For setups where a main session (orchestrator) launches track sessions and answers their questions, you pick a session mode. **Manual** (default — `DEV_WORKFLOW_MODE` unset) means a person confirms each step; **delegated** (`DEV_WORKFLOW_MODE=delegated` — only when the value, with surrounding whitespace trimmed, matches exactly; any other value means manual) is for overnight or away-from-keyboard runs, where an agent (usually the main session) stands in for this session's user — the orchestrator answers its questions and launches its successor. Brainstorming, harden-spec and ui-mockup are human, taste-driven stages and stay with a person regardless of mode; from review-loop(spec) on, a track runs manual or delegated. The main session itself stays manual (its own successor uses the automatic handover above). **Set it as a prefix on the track terminal's launch command** (the default): `orca terminal create … --command 'DEV_WORKFLOW_MODE=delegated claude …'` — and use the same prefix when launching successor terminals (leave it off and that successor falls back to the automatic handover). On Windows (PowerShell): `$env:DEV_WORKFLOW_MODE='delegated'; claude …` (not yet verified). Putting it in settings.json `env` makes every session of the project delegated — **including the main session**, which then can't launch its own successor — so only do that knowingly. **Delegated-mode effects (1.2.0)**: ① even in an Orca terminal, the nudge is the same `/clear` guidance as outside Orca instead of the automatic handover — the orchestrator launches the successor (1.1.0; no effect outside Orca) ② review-loop and dev-cycle auto-adopt the recommended answer for non-risky questions — risky ones (critical · security · direction · AC/goal/non-goal/decision changes) are still asked, and every auto-adopted decision is recorded with the source `추천 자동 채택(위임)` (auto-adopted recommendation) and is an audit target of the confirmation round ③ those decisions are collected in a **confirmation-pending ledger** (`## 확인 대기 대장` at the end of the spec/plan) that you confirm or overturn at the stage boundary. A 1.1.x install gets ① only. Older installs don't know this variable — check the version with `doctor`.

### 10. `mr-review` — two-model review draft for someone else's MR

A designated reviewer gets a **draft verdict report** from one MR number. Nothing in the repository or GitLab is changed (comments and approval are done by a human). It is different from `review-loop`, which fixes your own spec/plan/implementation.

```
/dev-workflow:mr-review <project> <iid> [--adapter <adapter file>] [--full] [--diff-only] [--resolve <id>=confirmed|dismissed|confirmed:fixable|confirmed:design …]
```

- **Adapter document required** — one Markdown file kept in the project's shared docs repository (`--adapter` or env `MR_REVIEW_ADAPTER`). It carries repository IDs, policy documents, review lenses, doc map, wiki roots (export allowed/forbidden), masking patterns, deploy-target rules, comment formats and the report directory. Scripts read only its ```` ```json mr-review-adapter ```` machine block; models read the prose (lenses, policy notes). The plugin holds no project-specific values.
- Flow: collect via `glab api` → fetch target and MR head, confirm **API head = fetched head**, pin three SHAs (temporary worktree) → authoring-rule table (10 contract lines, baseline, change reason, attachments, rebase, comment trust) → deploy-zip comparison (comment SHA, file list, bytes, deletion list — built-in zip reader) → context packs (section excerpts of shared docs, wiki, baseline originals; the Codex pack holds allowed sources only, with PII masking — Codex is skipped if masking fails) → Claude subagent and Codex `task` **independently in parallel** → merged by the main session → verdict computed in policy order → report (the policy execution block verbatim, fully masked) → temporary artifacts removed.
- If authoring rules are unmet (incomplete contract, no baseline) it **exits early** with a draft verdict plus a request-for-completion note for the author, without running the reviewers. With `--full` it runs to the end; the gaps remain as missing evidence.
- When the two models conflict, or only one flags a low-confidence blocker, and the main session cannot confirm it from code, the verdict is **undetermined** — no postable block, both branches are shown, and the reviewer settles it with `--resolve <id>=confirmed|dismissed|confirmed:fixable|confirmed:design`.
- Without the Codex plugin or `glab`: it does not run without `glab`; without Codex it runs in **single-model mode** (report header says "no cross-check").
- GitLab on a non-standard port (1.3.1+): keep the adapter's `gitlab.host` as `host[:port]` (`gitlab.example.com:8443`); your glab config needs a **port-less host key** entry (`hosts.gitlab.example.com`) whose `api_host` is `gitlab.example.com:8443` and whose `api_protocol` matches the server — the engine passes the port-stripped host to `glab api --hostname` and still compares the MR `web_url` including the port. The skill checks this with one `glab api … version` GET at start and stops if it fails.
- 1.3.2: deploy zips in the Maven WAR layout (web root, `WEB-INF/classes/…`) are compared too — the adapter key `projects.<name>.deployLayout: "source"|"maven-war"` is the default used when the layout cannot be told from the zip (since 1.3.3 — not a per-project fixed value; default `"source"`). `.java` files are checked only for their `.class` being present, shown in the report as "byte comparison skipped n". The same release keeps the full deploy-mismatch list only in appendix A (body text shows per-kind summaries), merges the intent table by verification-table row number (`row`), and drops command runners, system directories and non-existent paths from the path watch.
- 1.3.3: the deploy-zip layout is decided per zip (strip a shared top-level folder → `WEB-INF/`·`META-INF/`·`src/` markers → expected-list probe → adapter default; appendix A shows layout, basis and prefix), so source zips, WAR zips and prefixed zips in the same project match without adapter changes, and several body zips (source + class builds) are compared together (same path with different bytes, cross-zip path collisions, mixed markers and entry names deeper than 64 segments are "cannot compare"). An inner class in the body deletion list (`Foo$X.class`) is no longer folded when a file of that name is alive in head — "cannot compare" (diff-only cannot check, so also "cannot compare"). Also: `|`/newline handling in report table cells, a self-check counting new entries a reviewer wrote outside `W`, and a note that the companion log truncates commands at 96 characters (path-watch limit).
- 1.3.4: deploy zips written with data descriptors (bit 3 — IDE/OS archivers, streaming `zip`, Python `zipfile`) are compared when the signed descriptor matches the central directory and the compressed stream ends exactly at its declared size (unsigned descriptors, ZIP64 and stored + descriptor stay "cannot compare"). Zip entries matching the adapter's `deploy.excludes` (docs etc.) are shown separately as "excluded deploy paths n (info)" instead of mismatches (files the adapter does not mention still mismatch; in WAR-layout zips, whose paths are served paths, they stay mismatches). Every report line flattens line breaks (including NEL, U+2028, U+2029) from external strings, zip entry names and attachment names with control, format or line-separator characters are "cannot compare", and the zip comment text is no longer written (SHA or "no SHA (n chars)").
- 1.3.5: in worktree mode the Codex pack no longer carries the target repository's own documents (`repo:` docs, repo-path baselines) as text — it carries a path pointer that Codex reads from its working directory (only after checking the checked-out file is a regular file inside the worktree with the same bytes as the head blob; otherwise the masked text as before; diff-only unchanged). The report shows how deep the Codex review went, counted from its run log (`codex-stats` — commands, changed files mentioned; "cross-check: yes (weak — …)" below a quarter). A model finding that restates a machine check (`coveredBy`) is merged into it (an undetermined candidate only after the reviewer's `--resolve <id>=confirmed`), and incomplete contract lines become one checkbox. Two optional adapter keys, off by default (adapters without them produce the same output): `baselineRepoPaths: true` accepts a repository-relative path in Baseline (matching `baselineCandidates`, present in head as a regular file → "repository doc path"; a missing path gets an author note; paths outside the globs stay "description only" with no note), and `contract.backgroundSections: ["배경", "요약"]` accepts other background section names. review-loop's description now points someone else's MR to mr-review.
- 1.4.0: baseline decision table — `check` masks each fetched baseline text and extracts its decision items (`D<n>` in table rows, list items, headings; other forms via the optional adapter key `baselineDecisions.pattern`), both packs carry the numbered list, and each reviewer answers KEPT / VIOLATED / UNKNOWN per decision (`decisions` is required — a result without it is INVALID; report appendix E; a violation needs a matching finding before `verdict` runs). For a blocking defect or design drift only one model raised, "fixable within the design" is treated as one reviewer's claim: the main session decides it with a stated basis, or the reviewer settles it with `--resolve <id>=confirmed:fixable|confirmed:design`. A new subcommand `merge` combines the two results deterministically by fingerprint and issue keys (`decisionIds`, `intentRows`) into `findings.json`; the main session only fills the `needsMain` items (`verdict` errors while any is open), and `verdict.json` records a digest of the findings so a changed `findings.json` never renders under an old verdict.
- After updating, open a new Claude Code session (`/clear` keeps the old skill version loaded) — from 1.4.0, §0 detects an old skill folder, stops, and points to `/reload-plugins` → new session.
- Tests and builds are never executed (every verification status is "read"). Only the deploy-zip comparison is performed by the skill itself.
- Secret masking in prose (MR body, comments, doc excerpts) is best-effort over known forms: `key: value` / `key=value` (quoted, YAML blocks, continuation lines, properties `\` line joins), `--key value` options (masked to end of line), URL credentials `scheme://user:pass@host` (empty user names and `@` inside the password included), XML elements/attributes keyed by a secret name (`value` attribute and the whole body up to the matching close tag, CDATA, comments and same-name nesting included), `Bearer`, PEM private keys — keys such as password, secret, token, api key, credential, including `DB_PASSWORD`/`dbPassword` forms. Anything whose masked shape is not an allowed form (unmaskable forms, unparsed secret-keyed tags, etc.) makes Codex skip (stored copies replace that whole value; a report that would still contain one is not written). Other forms (e.g. a bare value after a secret word with only spaces) are not caught; code is sent to Codex unmasked by design. Add project-specific forms to the adapter's `mask` — patterns that match any character without a leading context (`\S+`, `.+` and the like) also match the SHA-protection placeholder characters (NUL, U+E000–U+E010) and are rejected when the adapter loads, so narrow them with a lookbehind (`(?<=token=)`) or a character range (`\w`, `[0-9a-f]`).

## Auto-prompting the plugin when a repo is cloned

To automatically prompt collaborators to install this plugin when they clone and trust a repo, declare the marketplace and enablement in that repo's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-dev-workflow": {
      "source": { "source": "github", "repo": "gguii74-rwk/claude-dev-workflow" }
    },
    "openai-codex": {
      "source": { "source": "github", "repo": "openai/codex-plugin-cc" }
    }
  },
  "enabledPlugins": {
    "dev-workflow@claude-dev-workflow": true
  }
}
```

Declaring `openai-codex` alongside lets the cross-marketplace dependency (codex) resolve automatically. Collaborators don't need to type `/plugin marketplace add` or `/plugin install` — they just accept the install prompt when trusting the folder.

## Troubleshooting

- **You do not know what is wrong** — `/dev-workflow:doctor` checks all four environment items at once (installed version · marketplace freshness · codex · context window). The entries below are the fixes its result points to.
- **SSH authentication failure on `marketplace add openai/codex-plugin-cc`** (`Permission denied (publickey)`) — if you already use codex, the codex marketplace is already registered as `openai-codex` and this line is unnecessary. If `claude plugin marketplace list` shows `openai-codex`, skip it. On machines without SSH keys the slash command may try SSH and fail — but you didn't need to run it anyway.
- **`dependency-unsatisfied` or codex not installed** — the `openai-codex` marketplace isn't registered. Run `/plugin marketplace add openai/codex-plugin-cc`, then `/plugin install dev-workflow@claude-dev-workflow` again to resolve the dependency.
- **`review-loop` stalls at the codex step** — the codex CLI is not installed/authenticated. Set it up with `/codex:setup`.
- **Skills not showing up** — check that `dev-workflow` is enabled in the `/plugin` Manage tab; if not, `/reload-plugins` or restart Claude Code. (Changes to components other than hooks/skills take effect after a restart.)

## Caveats

- Installed at user scope, the context-threshold Stop hook runs in **every project**. The nudge message tells you to write a handoff to `.remember/remember.md`, and **in an Orca terminal it goes further: after the nudge, a successor terminal is created, a `.remember/successor-<token>.prompt` file is written, and the old session is shut down (`/exit`) automatically** (except in delegated-mode sessions — see "Session mode") — in projects that don't use `.remember/`, that directory will still appear (the prompt file is deleted once delivered and left behind only if the handover fails). Outside Orca, only the guidance text is shown and nothing runs automatically (same as before).
- The Orca terminal handle is an environment variable, so every process started inside that terminal inherits it. If a nested `claude` launched from an Orca tab (e.g. `claude -p` run from Bash, or claude inside tmux) receives the nudge, it treats the parent tab as its own terminal, and its successor sends `/exit` to the parent session. Don't run long nested `claude` sessions inside an Orca tab — run them outside Orca. If you must, launch it as `DEV_WORKFLOW_MODE=delegated claude -p …` (1.1.0+): it won't spawn a successor even though it inherits the parent tab's handle.
- `writing-plans-split` assumes a repo that uses the split-plan convention. In repos using single plan files, just use `superpowers:writing-plans` as is.

## Development / Release

```
claude-dev-workflow/
├── .claude-plugin/marketplace.json   # marketplace catalog (repo root)
├── dev-workflow/                     # the plugin
│   ├── .claude-plugin/plugin.json    # name, version, dependencies (codex@openai-codex)
│   ├── skills/{dev-cycle,harden-spec,ui-mockup,writing-plans-split,review-loop,setup,doctor,orchestrate}/SKILL.md
│   ├── skills/orchestrate/{SKILL.md,scripts/orchestrate.mjs,templates/track-prompt.md}
│   ├── skills/mr-review/{SKILL.md,scripts/mr-review.mjs,scripts/lib/{adapter,gitlab,collect,check,deploy,pack,report}.mjs}
│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}
├── tests/orchestrate/                # orchestrate.mjs tests (stub orca — outside the plugin)
├── tests/mr-review/                  # mr-review tests (fake glab + local bare git — outside the plugin)
├── README.md                         # English (default)
└── README.ko.md / README.ja.md       # Korean / Japanese
```

Users receive updates only from commits that bump `version` in `plugin.json`. If the version is omitted, the git commit SHA becomes the version and every commit is treated as a new release. Users update via `/plugin update` or background auto-update.

Tests: `node --test tests/orchestrate/orchestrate.test.mjs` (orchestrate — stub `orca`) · `node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs tests/mr-review/deploy.test.mjs tests/mr-review/pack.test.mjs tests/mr-review/report.test.mjs` (mr-review — fake `glab` and a local bare git repo; no real GitLab or Orca needed). This repo has no npm gate (do not pass a directory — Node 21+ treats it as a module path).

**The README is maintained in three languages** — `README.md` (English, default) / `README.ko.md` / `README.ja.md`. When changing content, **update all three files together** (drift prevention).
