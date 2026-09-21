# task-07 — WPS 계약 블록에 SDD 어댑터 + 조건부 no-AI-trace (F4 · F8(d)-WPS, D20·D21·D33)

**목적**: 실행 세션에 닿지 않던 task-brief 어댑터 2문장을 verbatim 계약 블록 안으로 옮기고(버전 무표기, 확인 시점은 블록 밖 각주), repo가 no-AI-trace 규칙을 가질 때의 디스패치 금지 문구를 같은 블록에 조건부로 넣는다. §Execution handoff의 "SDD 6.2.0 adapter" 문단은 포인터로 줄인다.

## Files

- Modify: `dev-workflow/skills/writing-plans-split/SKILL.md`
  - 40행 verbatim 블록(`   > **For agentic workers — execution contract (MUST):** …`) → §A
  - 40행 직후에 §B 각주 1줄 삽입
  - 89행 `**SDD 6.2.0 adapter:** …` 문단 → §C
- Test: 없음(grep AC4·AC8(d))

## Prep

- spec §3 F4·F8(d), §4 D20·D21·D33, AC4·AC8. 엔트리포인트 SC-8.
- `grep -n 'For agentic workers\|SDD 6.2.0 adapter' dev-workflow/skills/writing-plans-split/SKILL.md` — 40·89행.
- 파급 인지: 이 블록이 canonical이 되면 review-loop plan 관문 ①은 **이후 plan 루프 진입 시** 구판 블록을 교체하게 한다(RL:241~243) — 이 plan 자체의 엔트리포인트 블록은 0.17.0 문면이며, 진행 중 impl 트랙에는 소급하지 않는다(D20). 여기서 다른 plan을 고치지 않는다.

## Deps

task-06(웨이브 1 종료 — RL 리뷰 대상 확정 후 웨이브 2).

## Steps

### 1. §A — 40행 블록 교체

원문 40행 전체를 다음 1행으로 교체한다(기존 문장은 한 글자도 바꾸지 않고, `Do not start implementing from the entrypoint alone` 문장 **앞**에 두 문장을 끼운 것이다):
```markdown
   > **For agentic workers — execution contract (MUST):** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. This plan is split into per-task files (`<feature>/task-NN-<slug>.md`). Task bodies (Files, TDD steps, AC) are **NOT** in this entrypoint. To execute, MUST: ① read this entrypoint's §Shared Contracts → ② load exactly one target task file → ③ run its steps in order → ④ **record completion**: when the task is **confirmed complete** (reviews approved — SDD's "mark todo complete" sync point; the implementer's DONE report is NOT completion), the dispatcher (the executor itself when running without subagents) immediately — before dispatching the next task — sets that task's row in this entrypoint's task table to `[x]`, writes its one-line outcome, and **commits this entrypoint file on the spot**. **Convergence check (MUST, at all three points — before starting any task, when initializing a resumed/recovered session, and before entering the final whole-branch review):** reconcile this task table against the SDD progress ledger and git log. The authority for "complete" is an **explicit completion record in the SDD progress ledger**; git log only corroborates that a recorded commit exists and was not reverted — an implementation commit by itself is NOT completion (implementer commits exist before review approval). A task whose ledger completion record is missing or ambiguous is **incomplete (fail-closed)** — including a row already marked `[x]`: revert it to `[ ]`. **That rule presumes a live ledger.** A ledger that is absent — or present but holding no completion record for any task while this table already has `[x]` rows — is fresh or lost, not authoritative. (Judge by content, not by the file: SDD's setup recreates an identity-only `progress.md` before reading the plan, so a workspace lost to `git clean -fdx` looks "present"; same after the post-final-review cleanup `rm -rf <workspace>`.) In that state authority falls back to **this committed task table**, which ④ writes only at confirmed completion, with git log corroborating each `[x]` row's commit. Never mass-revert the table over a fresh or lost ledger: revert only a row git log contradicts (no such commit, or reverted), and if the table itself is unreadable, ask your human partner instead of re-dispatching. Rebuild the ledger's completion lines from the surviving table before continuing, so later checks have a live ledger again — but that rebuild restores completion state **only**: a lost ledger may also have held deferred-minor and parked findings with their rulings, which this table never carried, so flag that gap and get your human partner's confirmation before the final whole-branch review instead of presenting the rebuilt ledger as whole. A row filled in but not yet committed is also unconverged: commit it before proceeding. **SDD adapter (`scripts/task-brief` contact point):** a split plan has no "Task N" section, so skip that extraction — **the task file itself is the brief**: pass its full text in the dispatch. Keep the SDD workspace and progress ledger keyed to **this entrypoint** (`scripts/sdd-workspace <entrypoint path>`) — one workspace per plan, never per task file. **No-AI-trace (conditional):** when the repo has a no-AI-trace rule (e.g. its `CLAUDE.md` forbids AI signatures in commits), every dispatch prompt MUST state that commit messages and documents carry no AI tool trace (no `Co-Authored-By` / `Generated with` trailers). Do not start implementing from the entrypoint alone (it has no steps). Do not load all task files at once.
```

### 2. §B — 40행 직후(41행 `3. **Shared Contracts:**` 앞)에 각주 1줄 삽입

```markdown
   > 확인 시점 각주(블록 밖 — 계약 블록에는 버전을 적지 않는다): `scripts/task-brief`·`scripts/sdd-workspace`는 superpowers 6.3.0 SDD SKILL.md:137·:252에서 실재 확인(2026-09-21). superpowers가 bump돼도 블록은 낡지 않는다.
```

### 3. §C — 89행 `**SDD 6.2.0 adapter:** …` 문단 교체

원문(1문단):
```
**SDD 6.2.0 adapter:** SDD asks for `scripts/task-brief PLAN_FILE N` before dispatch — that script extracts a "Task N" section from a single plan file, which a split plan does not have (task files carry no "Task N" heading, and the entrypoint carries no task bodies). **Skip the extraction: the task file itself is the brief** — pass its full text as the brief in the dispatch (same intent: brief = the task's complete text). **Keep the SDD workspace and progress ledger keyed to the entrypoint** — `scripts/sdd-workspace <entrypoint path>` — one workspace per plan, never per task file.
```
교체:
```
**SDD adapter:** stated **inside the execution contract block** (§Entrypoint 2) so it reaches the executing session — while it lived only here, four tracks (2026-09-07~18) re-discovered it and wrote local brief scripts. Content unchanged: task file = brief, workspace keyed to the entrypoint. It reaches new plans and 0.18.0+ hosts only (plan-stage gate ① replaces a stale block at loop entry; running impl tracks are not retrofitted).
```

### 4. 자기 점검 + 커밋

```bash
F=dev-workflow/skills/writing-plans-split/SKILL.md
sed -n '40p' $F | grep -c 'task-brief'                       # 1  (AC4 — 블록 안)
sed -n '40p' $F | grep -c 'No-AI-trace (conditional)'        # 1  (AC8 d)
sed -n '40p' $F | grep -c 'sdd-workspace <entrypoint path>'  # 1
sed -n '40p' $F | grep -ciE '6\.2\.0|6\.3\.0'                # 0  (AC4 — 블록 안 버전 없음)
grep -n '6\.2\.0' $F | wc -l                                  # 0
grep -n '6\.3\.0' $F                                          # 41행 각주 1건만
sed -n '/^## Execution handoff/,/^This is a \*\*prose contract/p' $F | grep -ciE '6\.[0-9]\.[0-9]'   # 0 (본문 버전 표기 없음 — 각주는 §Entrypoint에 있다)
git add $F
git commit -m "fix(writing-plans-split): 계약 블록에 SDD 어댑터(task 파일 = brief·workspace = 엔트리포인트, 버전 무표기)와 조건부 no-AI-trace 디스패치 문구 편입, 확인 시점은 블록 밖 각주 (F4·F8d)"
```

## Acceptance Criteria

```bash
F=dev-workflow/skills/writing-plans-split/SKILL.md
awk 'NR==40' $F | grep -c 'task-brief'                                   # 1
awk 'NR==40' $F | grep -c 'the task file itself is the brief'            # 1
awk 'NR==40' $F | grep -c 'No-AI-trace (conditional)'                    # 1
awk 'NR==40' $F | grep -c 'Do not start implementing from the entrypoint alone'   # 1 (기존 문장 보존)
awk 'NR==40' $F | grep -ciE 'SDD 6\.[0-9]'                               # 0
grep -c 'SDD 6.2.0 adapter' $F                                            # 0
grep -c '확인 시점 각주' $F                                                 # 1
git log -1 --format=%B | grep -ciE 'co-authored|generated with|claude-session'   # 0
```

## Cautions

- **블록의 기존 문장을 고치거나 재배열하지 않는다. 이유: 관문 ①이 설치 스킬 블록과 "나란히 읽어" 대조한다 — 어댑터 2문장·조건부 1문장 삽입만이 이 트랙의 변경이다(plan-gate fp-C1 내용 불변).**
- **블록 안에 "6.3.0"·"6.2.0"을 쓰지 않는다. 이유: D21 — superpowers bump마다 canonical 블록이 낡고 모든 plan이 교체 대상이 된다.**
- **no-AI-trace를 무조건 금지로 쓰지 않는다. 이유: D33 — 플러그인은 공개 배포물이라 타 사용자 규약과 충돌한다.**
- **이 repo의 진행 중 plan 엔트리포인트(이 트랙 자신)의 블록을 새 블록으로 갈아 끼우지 않는다. 이유: D20 비소급 — 설치본(0.17.0)의 관문 ①이 0.17.0 블록을 canonical로 본다. 릴리스 후 다음 plan부터.**
