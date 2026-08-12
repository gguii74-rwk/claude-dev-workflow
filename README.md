# claude-dev-workflow

**English** | [한국어](README.ko.md) | [日本語](README.ja.md)

A marketplace that ships a set of battle-tested development-workflow tools as a single Claude Code plugin, **`dev-workflow`**. Install once, use in **every project**.

| Tool | Kind | Invocation | Role |
|---|---|---|---|
| dev-cycle | skill | `/dev-workflow:dev-cycle` | Recommended pipeline map for a new feature — kickoff through integration — + tells you which step you're on and whether a small change takes the standard or the fast lane (read-only, start here) |
| review-loop | skill | `/dev-workflow:review-loop` | After each spec/plan/impl stage: commit → codex adversarial review (settled-decisions guard auto-injected to suppress re-flags) → adjudicate/auto-fix, then a neutral confirm round verifies the fixes and rules on merge readiness — until zero unadjudicated critical/high findings remain. Plan-stage loops clear a four-item format gate before starting |
| writing-plans-split | skill | `/dev-workflow:writing-plans-split` | Write multi-step implementation plans as a thin entrypoint + one file per task, with completion recording as a committed contract step |
| harden-spec | skill | `/dev-workflow:harden-spec` | Adversarially pressure a draft spec before plan/implementation to dig out missed gaps, assumptions, and invariant violations, and harden the spec in place (project-aware) |
| ui-mockup | skill | `/dev-workflow:ui-mockup` | (Optional, step 3.5) When a hardened spec creates or reshapes a screen: diverge non-executable HTML mockups, let the user pick, and record the UI decision in the spec as a settled decision |
| setup | skill | `/dev-workflow:setup` | (On explicit request) idempotently insert a pipeline-convention pointer into this repo's CLAUDE.md |
| doctor | skill | `/dev-workflow:doctor` | Read-only diagnosis of four environment items (installed version · marketplace freshness · codex · context window); every fix is delegated to the existing path |
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
  - [Context-threshold handoff hook](#8-context-threshold-handoff-hook-automatic)
- [Auto-prompting the plugin when a repo is cloned](#auto-prompting-the-plugin-when-a-repo-is-cloned)
- [Troubleshooting](#troubleshooting)
- [Caveats](#caveats)
- [Development / Release](#development--release)

## Requirements

- **Claude Code v2.1.140 or later** recommended (includes plugin dependency support).
- **codex plugin** — `review-loop` calls codex's `adversarial-review`, so this plugin depends on `codex@openai-codex`. The dependency is declared in `plugin.json`'s `dependencies`, so it is **installed automatically alongside** (provided the `openai-codex` marketplace is registered — see Installation below).
- **codex CLI authentication is separate** — the plugin dependency only pulls in the codex *plugin*. You must install and log in to the codex CLI yourself (`/codex:setup`) for `review-loop` to actually work. `writing-plans-split` and the context hook work without this authentication.

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

Since 0.11.0 the map spans **kickoff to done**. **Step 9 — integrate & post-release verification (PR, merge, deploy, field check)** — is a *pointer* to the running repo's own convention, not a checklist copied in here; in a repo with nothing to deploy (a plugin, say) a release plus install-refresh instructions take its place. At kickoff the map prints a **five-item brief** once — design conclusion, measured evidence, files to change, verification method, done criteria through step 9 — **on screen only, creating no file**. And a **fast lane** replaces the old all-or-nothing choice: the branch axis is **contact surface and reversibility, not size** — schema, migration, permissions, auth, security boundary, external integration, data loss/corruption, and irreversible work stay on the standard path no matter how small (a 12-task wording cleanup is light; a 1-task column drop is not). Three things no fast-lane track may skip: **the spec document, step 3 harden-spec, and step 8 impl adversarial review**. Above that floor, steps are dropped **one at a time, each with its reason recorded in the spec's settled-decisions block**, and the "which step am I on" check reads those records before it rules — an absence with no record is still incomplete. Fast-lane approval is **session-scoped**: after a `/clear` the map asks again instead of assuming, and refusals or ambiguous answers default to the standard path. When confirmation itself is impossible — a non-interactive run that cannot deliver a question, or the user explicitly said to proceed unattended — since 0.17.0 a **contact-surface scan decides instead**: clearly no signal → fast lane; any signal or an unclear scan → standard path (fail-closed). An auto-judged fast-lane entry leaves a one-line audit record in the spec, and a resumed run re-scans regardless of that record.

### 2. `review-loop` — adversarial review loop

After each stage, commit your changes and run codex adversarial review. Findings are auto-fixed or closed with a disposition, repeating until **"zero critical/high findings remain unadjudicated."** The goal is not "zero findings" but "zero unadjudicated."

The loop runs in **two modes**. It opens in **adversarial (discovery) mode** — codex `adversarial-review` digs out omissions and defects. An adversarial reviewer never returns zero findings no matter how many times you run it, so that mode alone can never end the loop. Once a transition signal fires (score plateau · fix queue drained · adversarial budget spent), the loop switches to **confirm (neutral) mode**, whose objective is *"is this mergeable?"* — it verifies that items you claimed to have fixed are actually gone, audits regressions and the proportionality of your adjudications, and issues a verdict. "No new blocking findings, fixes confirmed" becomes a legitimate output, so termination is natural.

Since 0.9.0, **every adversarial round auto-injects the settled-decisions guard as review focus** — the full settled-decision block plus one-line summaries of closed ledger items, reassembled right before each round and attached to the review command, suppressing re-flags of already-closed items at the source (measured: even with the guard sitting in the diff, the same finding was re-raised five rounds in a row). Adjudications the loop made on its own are priority-audited by the confirm round, preserving the path to revisit a wrong call.

Since 0.10.0, a plan-stage loop clears a **four-item format gate** before its first round: the entrypoint carries the current `writing-plans-split` execution contract (compared against the installed skill's canonical block — presence alone is not enough, since a stale block can drop the very protection the gate exists for), a §Shared Contracts section, a fingerprint column in the inherited ledger, and `status`/`outcome` columns in the task table. Cheap fixes — replacing the block, adding the section or column — are resolved before the loop starts; a structural rewrite (a single-file plan that would have to be split) escalates to you instead of the loop performing surgery outside review. The gate applies only in repos whose `CLAUDE.md` mandates split plans, and skips single-task changes.

All options are optional — plain `/dev-workflow:review-loop` works.

| Option | Default | Role |
|---|---|---|
| `--phase spec\|plan\|impl` | auto-inferred | Which stage to review. If omitted, inferred from the changes |
| `--base <ref>` | `main` | Base branch the adversarial review diffs against. Resolved to a SHA at loop start so every round sees the same snapshot |
| `--max <n>` | `5` | Cap on **adversarial (discovery) rounds.** Confirm rounds do not count against it |
| `--confirm-rounds <n>` | `2` | **Confirm-round budget.** Cumulative across the whole loop; not reset on re-entry |
| `--auto-rounds <n>` | `3` | First n rounds run in **auto mode** — auto-fix defects and batch up non-risky user decisions to ask at once. `0` = ask immediately every round; use `1` for security-sensitive work |
| `--resume` | — | Resume an interrupted loop from the saved state (including the ledger) in `.remember/loop-*.md` |

> **`--max` changed meaning in 0.8.0.** Through 0.7.x it was a hard cap on total iterations; it now caps **adversarial rounds only**. The total is still bounded but larger — at the defaults, **at most 10 rounds** (5 adversarial + 2 confirm + 1 returning adversarial round when confirm finds blocking + 1 re-entry confirm + 1 fallback-② confirm run in a fresh session). To bound execution the way it used to be, lower `--max` and `--confirm-rounds` together.

```
/dev-workflow:review-loop --phase impl                   # review the implementation (after typecheck·lint·test·build gates)
/dev-workflow:review-loop --phase spec --auto-rounds 1   # security-sensitive → minimize auto mode
/dev-workflow:review-loop --base develop                 # diff against develop instead of main
/dev-workflow:review-loop --max 3 --confirm-rounds 1     # bound the round count (at most 7)
/dev-workflow:review-loop --resume                       # continue a loop cut off by context limits
```

**How it works** — each adversarial round: ① commit uncommitted changes → ② run codex adversarial review → ③ classify and adjudicate findings by fingerprint (FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE/ESCALATE) → ④ fix FIXED items (via TDD for impl) → ⑤ re-run gates. Once a transition signal fires, confirm mode takes over: ⑥ verify the entire unconfirmed-FIXED queue is gone → ⑦ audit regressions and adjudications → ⑧ issue a merge-readiness verdict. Termination requires **all three**: zero unadjudicated blocking findings, an empty unconfirmed-FIXED queue, and a passing confirm verdict.

> Adversarial review looks at the **committed HEAD (branch diff)**. Running it with uncommitted changes misses your latest fixes, so the loop always enforces the order "fix → commit → review."
>
> **Fixing something does not close it.** A FIXED item is settled only when a confirm round explicitly records it as gone — an adversarial round not raising it again is a discovery result, not a confirmation. So any track with even one FIXED item must pass through a confirm round (only a clean track that never raised a finding terminates without one).

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

### 8. Context-threshold handoff hook (automatic)

Works immediately after installation; no configuration. When conversation context usage crosses a threshold (default 40%), it nudges you to write a handoff and `/clear` before stalling — helping you hand over before context blows up mid-task. Since 0.12.0 the nudge is **not once-only**: it fires again on every 15-percentage-point band above the threshold (40 → 55 → 70 → 85%, with no upper cap), so ignoring the first one no longer means silence until auto-compact hits. Re-nudges add the facts (you were told before, here is the current %) without escalating the instruction. If usage drops two bands or more — auto-compact keeps the same session id — the hook treats it as a new cycle and starts nudging from the threshold again.

Tune via environment variables (optional):

```
CLAUDE_CTX_THRESHOLD=0.5    # set threshold to 50% (0–1, default 0.4)
CLAUDE_CTX_LIMIT=200000     # set the context token limit explicitly
                            # if unset: 1,000,000 (current models). Set this only for 200k-window
                            # models — the window size is not knowable at runtime, so it is not detected
```

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

- Installed at user scope, the context-threshold Stop hook runs in **every project**. The nudge message tells you to write a handoff to `.remember/remember.md`; in projects that don't use `.remember/`, only that wording is off — the behavior is harmless.
- `writing-plans-split` assumes a repo that uses the split-plan convention. In repos using single plan files, just use `superpowers:writing-plans` as is.

## Development / Release

```
claude-dev-workflow/
├── .claude-plugin/marketplace.json   # marketplace catalog (repo root)
├── dev-workflow/                     # the plugin
│   ├── .claude-plugin/plugin.json    # name, version, dependencies (codex@openai-codex)
│   ├── skills/{dev-cycle,harden-spec,ui-mockup,writing-plans-split,review-loop,setup,doctor}/SKILL.md
│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}
├── README.md                         # English (default)
└── README.ko.md / README.ja.md       # Korean / Japanese
```

Users receive updates only from commits that bump `version` in `plugin.json`. If the version is omitted, the git commit SHA becomes the version and every commit is treated as a new release. Users update via `/plugin update` or background auto-update.

**The README is maintained in three languages** — `README.md` (English, default) / `README.ko.md` / `README.ja.md`. When changing content, **update all three files together** (drift prevention).
