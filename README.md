# claude-dev-workflow

**English** | [한국어](README.ko.md) | [日本語](README.ja.md)

A marketplace that ships a set of battle-tested development-workflow tools as a single Claude Code plugin, **`dev-workflow`**. Install once, use in **every project**.

| Tool | Kind | Invocation | Role |
|---|---|---|---|
| dev-cycle | skill | `/dev-workflow:dev-cycle` | Recommended pipeline map for a new feature + tells you which step you're on (read-only, start here) |
| review-loop | skill | `/dev-workflow:review-loop` | After each spec/plan/impl stage: commit → codex adversarial review → adjudicate/auto-fix, repeated until zero unadjudicated critical/high findings remain |
| writing-plans-split | skill | `/dev-workflow:writing-plans-split` | Write multi-step implementation plans as a thin entrypoint + one file per task |
| harden-spec | skill | `/dev-workflow:harden-spec` | Adversarially pressure a draft spec before plan/implementation to dig out missed gaps, assumptions, and invariant violations, and harden the spec in place (project-aware) |
| setup | skill | `/dev-workflow:setup` | (On explicit request) idempotently insert a pipeline-convention pointer into this repo's CLAUDE.md |
| Context-threshold nudge | Stop hook | (automatic) | When context usage exceeds a threshold (default 40%), nudges once to write a handoff + `/clear` |

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
  - [dev-cycle](#1-dev-cycle--pipeline-map-start-here)
  - [review-loop](#2-review-loop--adversarial-review-loop)
  - [writing-plans-split](#3-writing-plans-split--split-implementation-plans)
  - [harden-spec](#4-harden-spec--spec-hardening)
  - [setup](#5-setup--adopt-the-pipeline-in-a-repo)
  - [Context-threshold handoff hook](#6-context-threshold-handoff-hook-automatic)
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

Recommended order: **brainstorming → spec → harden-spec → review-loop(spec) → writing-plans-split → review-loop(plan) → subagent-driven-development → review-loop(impl)**. Stage boundaries (spec→plan, plan→impl) require a fresh session + `/clear` by convention, so dev-cycle **guides only the current step and nudges toward the next** (it is not a single-session autopilot). Steps 1 and 7 (brainstorming, subagent-driven-development) recommend the `superpowers` plugin — without it, you can substitute your own design/implementation process (not a hard dependency).

### 2. `review-loop` — adversarial review loop

After each stage, commit your changes and run codex adversarial review. Findings are auto-fixed or closed with a disposition, repeating until **"zero critical/high findings remain unadjudicated."** The goal is not "zero findings" but "zero unadjudicated."

All options are optional — plain `/dev-workflow:review-loop` works.

| Option | Default | Role |
|---|---|---|
| `--phase spec\|plan\|impl` | auto-inferred | Which stage to review. If omitted, inferred from the changes |
| `--base <ref>` | `main` | Base branch the adversarial review diffs against |
| `--max <n>` | `5` | Hard cap on the number of review iterations |
| `--auto-rounds <n>` | `3` | First n rounds run in **auto mode** — auto-fix defects and batch up non-risky user decisions to ask at once. `0` = ask immediately every round; use `1` for security-sensitive work |
| `--resume` | — | Resume an interrupted loop from the saved state (including the ledger) in `.remember/remember.md` |

```
/dev-workflow:review-loop --phase impl                  # review the implementation (after typecheck·lint·test·build gates)
/dev-workflow:review-loop --phase spec --auto-rounds 1  # security-sensitive → minimize auto mode
/dev-workflow:review-loop --base develop                # diff against develop instead of main
/dev-workflow:review-loop --resume                      # continue a loop cut off by context limits
```

**How it works** — each iteration: ① commit uncommitted changes → ② run codex adversarial review → ③ classify and adjudicate findings by fingerprint (FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE/ESCALATE) → ④ fix FIXED items (via TDD for impl) → ⑤ re-run gates. Terminates when unadjudicated blocking findings reach zero.

> Adversarial review looks at the **committed HEAD (branch diff)**. Running it with uncommitted changes misses your latest fixes, so the loop always enforces the order "fix → commit → review."

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

### 4. `harden-spec` — spec hardening

**Before a brainstormed draft spec moves on to plan/implementation**, adversarially pressure it to dig out the gaps that force a redesign when discovered late (missed requirements, hidden assumptions, edge cases, cross-module ripple, invariant violations), and **harden the spec in place**. **Project-aware** — it reads the running repo's `CLAUDE.md`, ADRs, and existing specs to pressure with *that project's* invariants and prior decisions.

```
/dev-workflow:harden-spec [spec path]
```

Questions come **one at a time**, highest-risk first (irreversible, cross-module, invariants). Facts are investigated directly in the code; only open decisions are asked. Settled matters (ADRs, prior decisions) are not relitigated. Each resolved gap becomes a proposed wording change applied to the spec on approval; at the end, residual risks are recorded as DEFERRED, the spec is committed, and the skill stops (next stage recommended in a fresh session). It is the complement that runs ahead of `review-loop` (codex artifact verification), filling in *what only a human knows* first. Also auto-triggers on phrases like "harden this spec" or "find what I missed" or "pre-mortem."

### 5. `setup` — adopt the pipeline in a repo

Invoke when a repo should **explicitly** adopt this pipeline. Idempotently inserts a marker block with a **one-line pointer** (to `dev-cycle`, plus install instructions for those without the plugin) into the project's CLAUDE.md — it does not copy the full guide, so when the convention body changes (SSOT = `dev-cycle`), each repo's CLAUDE.md never goes stale.

```
/dev-workflow:setup
```

Runs only on explicit request and never touches content outside the marker block. Collaborators and non-plugin users can learn the convention and how to install just by reading CLAUDE.md.

### 6. Context-threshold handoff hook (automatic)

Works immediately after installation; no configuration. When conversation context usage crosses a threshold (default 40%), it nudges once to write a handoff and `/clear` before stalling — helping you hand over before context blows up mid-task.

Tune via environment variables (optional):

```
CLAUDE_CTX_THRESHOLD=0.5    # set threshold to 50% (0–1, default 0.4)
CLAUDE_CTX_LIMIT=200000     # set the context token limit explicitly
                            # if unset: 1,000,000 when the model name contains [1m], otherwise 200,000
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
│   ├── skills/{dev-cycle,harden-spec,writing-plans-split,review-loop,setup}/SKILL.md
│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}
├── README.md                         # English (default)
└── README.ko.md / README.ja.md       # Korean / Japanese
```

Users receive updates only from commits that bump `version` in `plugin.json`. If the version is omitted, the git commit SHA becomes the version and every commit is treated as a new release. Users update via `/plugin update` or background auto-update.

**The README is maintained in three languages** — `README.md` (English, default) / `README.ko.md` / `README.ja.md`. When changing content, **update all three files together** (drift prevention).
