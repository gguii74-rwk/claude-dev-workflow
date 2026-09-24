# 오르카 후계 세션 스폰 (1.0.0) — 구현 계획 엔트리포인트

- **spec**: `docs/specs/2026-09-24-orca-successor-session.md` (F1~F6 · D1~D12 · AC1~AC6). **spec ledger = spec 말미 `## 적대검증 ledger (spec)`** — 단일 원본, 여기에 복제하지 않는다. plan·impl ledger는 review-loop가 **이 문서 말미**에 만든다(`## 적대검증 ledger (plan)` · `## 적대검증 ledger (impl)`).
- **Goal**: 오르카 터미널에서 돌던 세션이 컨텍스트 넛지를 받으면 `/clear` 안내 대신 **같은 체크아웃에 후계 claude 터미널을 띄워 재개 프롬프트를 보내고 정지**하게 하고, 후계가 옛 세션을 정상 종료(`/exit`→`--for exit` 대기→close)시킨 뒤 이어가게 한다. 오르카 밖은 (0)의 인계 문장 1개를 제외하고 0.19.0과 바이트 동일. 1.0.0으로 릴리스한다.
- **Architecture**: 산출물은 **훅 코드 1파일 + 규약 문면**이다 — `context-threshold-hook.mjs`의 `decideNudge`가 `orcaHandle`로 (2)를 가른다(순수 함수, 판정 로직 불변). 옛 세션·후계가 실행할 명령은 훅 reason 문면이 플래그까지 지시한다(D6 — 훅은 오르카·codex 상태를 직접 조회하지 않는다: codex 상태 디렉터리는 codex 플러그인의 `CLAUDE_PLUGIN_DATA`에 묶여 있어 다른 플러그인의 훅 프로세스에서 해소를 보장할 수 없고, 세션의 Bash에는 codex SessionStart 훅이 그 값을 심어 준다 — 실측 probe-A). review-loop SKILL.md는 (0) 문장 바이트 동일 + §2i 표 3행 경로 ① 조건화만. 검증 = `.remember/` 아래 `node --test`(D5, repo 파일 없음) + grep 대조.
- **Tech stack**: Node ESM 훅(`node --test` 내장 러너, 외부 의존 없음) · Markdown 스킬 문서 · bash · Orca CLI 1.4.209(`terminal create/show/list/wait/send/read/close`, send 영수증 = `result.send.accepted`·`result.send.prompt.{requestId,stages}`, wait = `result.wait.satisfied`) · codex companion 1.0.6(`scripts/lib/state.mjs`의 `resolveStateFile(cwd)`, 상태 파일 `state.json`의 `config.stopReviewGate`·`jobs[].{status,sessionId}`).
- **경로 = 정식**(사용자 확정 2026-09-24). 3.5 비대상. 다음 = 6 review-loop(plan) → 7 impl(SDD, **task-01~04만**) → 8 review-loop(impl) → 9 릴리스 1.0.0(**task-05 — SDD 범위 밖, 8 종결 뒤 단독 실행**) → **AC6 맥북 실사용 1회**(트랙 완료 조건, D11).

> **For agentic workers — execution contract (MUST):** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. This plan is split into per-task files (`<feature>/task-NN-<slug>.md`). Task bodies (Files, TDD steps, AC) are **NOT** in this entrypoint. To execute, MUST: ① read this entrypoint's §Shared Contracts → ② load exactly one target task file → ③ run its steps in order → ④ **record completion**: when the task is **confirmed complete** (reviews approved — SDD's "mark todo complete" sync point; the implementer's DONE report is NOT completion), the dispatcher (the executor itself when running without subagents) immediately — before dispatching the next task — sets that task's row in this entrypoint's task table to `[x]`, writes its one-line outcome, and **commits this entrypoint file on the spot**. **Convergence check (MUST, at all three points — before starting any task, when initializing a resumed/recovered session, and before entering the final whole-branch review):** reconcile this task table against the SDD progress ledger and git log. The authority for "complete" is an **explicit completion record in the SDD progress ledger**; git log only corroborates that a recorded commit exists and was not reverted — an implementation commit by itself is NOT completion (implementer commits exist before review approval). A task whose ledger completion record is missing or ambiguous is **incomplete (fail-closed)** — including a row already marked `[x]`: revert it to `[ ]`. **That rule presumes a live ledger.** A ledger that is absent — or present but holding no completion record for any task while this table already has `[x]` rows — is fresh or lost, not authoritative. (Judge by content, not by the file: SDD's setup recreates an identity-only `progress.md` before reading the plan, so a workspace lost to `git clean -fdx` looks "present"; same after the post-final-review cleanup `rm -rf <workspace>`.) In that state authority falls back to **this committed task table**, which ④ writes only at confirmed completion, with git log corroborating each `[x]` row's commit. Never mass-revert the table over a fresh or lost ledger: revert only a row git log contradicts (no such commit, or reverted), and if the table itself is unreadable, ask your human partner instead of re-dispatching. Rebuild the ledger's completion lines from the surviving table before continuing, so later checks have a live ledger again — but that rebuild restores completion state **only**: a lost ledger may also have held deferred-minor and parked findings with their rulings, which this table never carried, so flag that gap and get your human partner's confirmation before the final whole-branch review instead of presenting the rebuilt ledger as whole. A row filled in but not yet committed is also unconverged: commit it before proceeding. **SDD adapter (`scripts/task-brief` contact point):** a split plan has no "Task N" section, so skip that extraction — **the task file itself is the brief**: pass its full text in the dispatch. Keep the SDD workspace and progress ledger keyed to **this entrypoint** (`scripts/sdd-workspace <entrypoint path>`) — one workspace per plan, never per task file. **No-AI-trace (conditional):** when the repo has a no-AI-trace rule (e.g. its `CLAUDE.md` forbids AI signatures in commits), every dispatch prompt MUST state that commit messages and documents carry no AI tool trace (no `Co-Authored-By` / `Generated with` trailers). Do not start implementing from the entrypoint alone (it has no steps). Do not load all task files at once.
> 확인 시점 각주(블록 밖 — 계약 블록에는 버전을 적지 않는다): `scripts/task-brief`·`scripts/sdd-workspace`는 superpowers 6.3.0 SDD SKILL.md:137·:252에서 실재 확인(2026-09-21). superpowers가 bump돼도 블록은 낡지 않는다.

이 repo의 no-AI-trace 규칙 = 글로벌 `~/.claude/CLAUDE.md`("git commit 메시지에 AI 서명을 절대 포함하지 않는다") — 디스패치 프롬프트마다 명시한다(SC-8).

## Shared Contracts

### SC-1. 대상 파일 · 약칭 (행 번호 = HEAD `92e1374` = 0.19.0 문면 기준)

| 약칭 | 경로 | 이 plan에서 바꾸는 것 |
|---|---|---|
| 훅 | `dev-workflow/hooks/scripts/context-threshold-hook.mjs` (197행, 10,071B) | task-02 — 헤더 주석 2~8행 · `decideNudge` 57~108행 · `main()` 177~182행 호출부. `computeContextUsage`·플래그 파일·`invokedDirectly`는 불변 |
| RL | `dev-workflow/skills/review-loop/SKILL.md` (429행, 70,499B) | task-03 — :308 §2b 진행 중 금지 (1)의 인용문 1문장 · :372 §2i 순서 표 3행. :363(세 경로 정의)·:365(진행 중 라운드 분기)·:429(단계 경계 `/clear`)는 **불변** |
| README | `README.md` · `README.ko.md` · `README.ja.md`(3언어 같은 행 위치) | task-04 — 각 §8(:192~:203) 끝에 1.0.0 문단 추가 · §주의/Caveats/注意 첫 불릿(:237) 교체 |
| plugin.json | `dev-workflow/.claude-plugin/plugin.json` | task-05 — `"version": "0.19.0"` → `"1.0.0"` |
| 테스트 | `.remember/hook-test-1.0.0/context-threshold-hook.test.mjs` (gitignore — repo 파일 아님, D5) | task-01 작성 · task-02 GREEN |

RL 크기 상한은 이 트랙에 **없다** — 0.18.0 D34(≤69,066B)는 그 트랙의 AC9였고 0.19.0이 이미 70,499B다. task-03의 추가분(+621B → 71,120B, 합성 실측)은 그대로 둔다.

### SC-2. 정본 문장 — 훅과 RL에 **바이트 동일**하게 넣는다 (D12 · RL §2b "Stop 훅 ②와 동일 문구")

- **UNIT**(불변): `작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회`
- **HOOK-②(신규, 양 경로 공통)**: `진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 넛지 (2)의 인계 절차를 따르라.` — 0.19.0의 `그때 /clear를 안내하라.`를 대체한다. 훅 `unit`과 RL :308 인용문 둘 다.
- **CLEAR(복귀 문장, 불변)**: `"이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요"라고 안내하세요.` — 비오르카 (2)의 첫 문장이자 오르카 [폴백]의 마지막 문장. 비오르카 (2)는 뒤에 `자가 /clear는 불가하므로 실제 초기화는 사용자가 합니다.`가 붙고(0.19.0 그대로), 오르카 reason에는 그 문장이 **없다**(AC1).
- **RL-RESUME(경로 ① review-loop 변형, task-03이 §2i 표 3행에 넣고 훅 (2-4)가 "그 스킬 §2i가 정한 재개 문구"로 가리킨다)**: 재개 프롬프트의 `<경로>` = 이 루프 파일(`.remember/loop-<ledger basename>-<phase>.md`), "같은 작업을 이어서 진행하라" 자리 = `` `/review-loop --resume`로 이 루프를 이어서 진행하라 ``.

### SC-3. `decideNudge` 시그니처와 분기 계약 (F1)

```js
export function decideNudge({ ratio, threshold, stopHookActive, lastNudgeStep, orcaHandle = null })
// orcaHandle: string|null. main()은 resolveOrcaHandle(process.env)를 넘긴다 —
//   ORCA_TERMINAL_HANDLE을 trim한 값이 /^[A-Za-z0-9._-]+$/에 맞으면 그 값, 아니면 null(빈 문자열 = 미설정 ·
//   따옴표·$(…)·백틱·공백이 든 값 = 오염된 환경 → 오르카 밖 경로). 값은 (2)의 셸 명령에 --terminal "<핸들>"로
//   그대로 들어가므로 제목과 같은 안전 문자 집합만 허용한다(실제 핸들 term_<uuid>는 집합 안. plan R1-1).
// 반환 { shouldNudge, reason, nextStep } — 필드·판정 로직(current·due·reset·nextStep) 불변.
// reason = `${head} 멈추기 전에: ` + unit + handoff + handover
//   unit·handoff = 0.19.0과 동일(unit의 ② 마지막 문장만 HOOK-②로 교체)
//   handover = orcaHandle === null ? 0.19.0 (2) 그대로 : orcaHandoff(orcaHandle)   // 최초·재넛지 동일(D6)
```

### SC-4. 오르카 (2)가 지시하는 명령 원문 3종 — 훅 상수 (task-02가 넣고, task-01 테스트가 식별 문자열로 대조)

훅 파일 안의 상수 이름과 값(JS 템플릿 리터럴 안이라 `${`는 `\${`로 이스케이프한다). 출력 계약이 규범이다.

| 상수 | 역할 | 출력 계약 |
|---|---|---|
| `CLI_RESOLVE_CMD` | `CLI="${ORCA_CLI_COMMAND:-$( [ -n "$ORCA_DEV_REPO_ROOT" ] && echo orca-dev \|\| echo orca )}"` — orca-cli 스킬 순서(R1-1) | `$CLI` = 실행 파일 |
| `COMPANION_ROOT_CMD` | RL §2b ①과 같은 레지스트리 해소(cwd 일치 project/local > user > managed), 존재 확인 대상만 `scripts/lib/state.mjs` | `$CR` = companion 루트, 실패 시 `RESOLVE_FAIL` 출력 |
| `STATE_PROBE_CMD` | `resolveStateFile(process.cwd())`로 얻은 상태 파일을 **직접 한 번** 읽어 `JSON.parse`한 동일 객체에서 `config.stopReviewGate`와 `jobs`를 함께 읽는다(`loadState`·`status --all` 불사용, C2) | 한 줄 `GATE_ON\|GATE_OFF FOREIGN_ACTIVE=<n>` (n = `status ∈ {queued,running}` ∧ `sessionId ≠ $CODEX_COMPANION_SESSION_ID` 잡 수). 파일 부재 = `GATE_OFF FOREIGN_ACTIVE=0`. 읽기·파싱 실패·import 실패·루트 비객체(배열 포함)·`jobs` 비배열·`jobs[]` 항목 비객체/`status` 비문자열·`config` 비객체·`config.stopReviewGate` 비boolean(예: 문자열 `"true"` — companion은 truthy로 소비) = `STATE_UNREADABLE` + exit 2(스키마 이탈도 fail-closed — plan R1-2·R2-2) |

사용처: 옛 세션 (2-0)ⓒ(GATE_ON·STATE_UNREADABLE·RESOLVE_FAIL → 폴백) · 후계 0번째 동작(FOREIGN_ACTIVE≠0 → 15초 간격 대기, 상한 10분=40회 · STATE_UNREADABLE·RESOLVE_FAIL → 보고·보류). 실측(2026-09-24 이 repo): `GATE_OFF FOREIGN_ACTIVE=0`, exit 0.

### SC-5. 오르카 (2) 필수 요소 — task-01 테스트 C4의 needle 목록이 계약이다

task-02의 `orcaHandoff(h)` 출력은 아래를 **문자열 그대로** 포함한다(테스트가 `includes`로 대조). 괄호는 spec 근거.

- (2-0): `ORCA_CLI_COMMAND가 있으면 그 값, 없고 ORCA_DEV_REPO_ROOT가 있으면 orca-dev, 그 외 orca` · `"$CLI" terminal show --terminal "<옛 핸들>" --json` · `installed_plugins.json` · `resolveStateFile(process.cwd())` · `stopReviewGate===true?"GATE_ON":"GATE_OFF"` · `STATE_UNREADABLE` · `GATE_ON이면 자동 인계를 하지 않고 [폴백]` · `loadState` · `status --all` (R1-1·R6-2·C2)
- (2-1): `[A-Za-z0-9._-]` · `전체 길이 ≤ 40` · `TITLE="${NAME:0:$((40 - ${#TOKEN} - 1))}-$TOKEN"` · `"$CLI" terminal create --worktree active --title "$TITLE" --command claude --json` · `result.startupTerminal.handle` · `"$CLI" terminal list --worktree active --json` · `정확히 1개가 아니면(0 또는 2+) [폴백]` · `successor` (R2-3·R3-1·R4-1·D7)
- (2-2): `"$CLI" terminal wait --terminal "<새 핸들>" --for tui-idle --timeout-ms 90000 --json` · `--timeout-ms 180000`
- (2-3): `cat > ".remember/successor-$TOKEN.prompt" <<'SUCCESSOR_PROMPT_EOF'` · `--wait-submit 15 --json --text "$(cat ".remember/successor-$TOKEN.prompt")"` · `result.send.prompt.stages에 turn_started` · `--wait-submit 30 --retry-request <id>` (R2-2·R1-2)
- (2-4) 템플릿: `[0번째 동작 — 공유 브로커 단일 실행권 검사]` · `FOREIGN_ACTIVE` · `15초 간격` · `상한 10분` · `[첫 동작 — 옛 세션 정상 종료]` · `--terminal 생략 금지` · `"$CLI" terminal send --terminal "<옛 핸들>" --text "/exit" --enter --json` · `"$CLI" terminal wait --terminal "<옛 핸들>" --for exit --timeout-ms 30000 --json` · `tui-idle 불인정` · `Resume this session with` · `"$CLI" terminal close --terminal "<옛 핸들>" --json` · `close도 codex 시작도 하지 말고` · `닫기가 실패하면 사용자에게 알리고 codex 라운드를 시작하지 마라` · `다른 단계(spec→plan, plan→impl)의 시작이면 시작하지 말고 사용자에게 확인하라` · `/review-loop --resume` (R5-3·R6-1a·R2-1·R5-2·C1·D4·D9)
- (2-5): `(2-5) turn_started를 확인했으면 더 아무것도 하지 말고 턴을 끝내세요`
- [폴백]: `[폴백] 조건 4종: (a)` · `(b) (2-2) wait satisfied:false` · `(c) (2-3) turn_started 미확인` · `(d) CLI 실행 오류` · `재생성과 /clear 안내를 모두 차단` · `미전달이 확정되기 전(재관찰·재조정 중)에는 후계를 닫지 마세요` · `"$CLI" terminal wait --terminal "<새 핸들>" --for exit --timeout-ms 30000 --json` · `/exit 처리 증거 없이 close하지 마세요` · `소멸을 확인하고` · CLEAR (F2·R1-3·D10)
- 부정 요건: `자가 /clear는 불가` 0건 · `"$CLI" terminal (send|wait|close|read|show)` 뒤에 ` --terminal ` 없는 것 0건 · 옛 핸들 바인딩은 값 리터럴(`--terminal "term_…"`), 새 핸들은 `"<새 핸들>"` 자리표시자만 · 안전 문자 집합 밖 `ORCA_TERMINAL_HANDLE`은 오르카 경로에 들어가지 않는다(`resolveOrcaHandle` → null, E2E C8).

`<옛 핸들>`은 실제 값(`orcaHandle`)으로 치환된 상태. 프롬프트 파일은 **줄바꿈 없이 한 줄**로 쓰라고 지시한다(TUI에 줄바꿈이 조기 제출로 들어갈 위험 제거 — F6 관찰 항목).

### SC-6. 테스트 위치·실행·기록 (F5 · D5 · 08-09 D10)

- 파일: `.remember/hook-test-1.0.0/context-threshold-hook.test.mjs` — `.remember/`는 gitignore(= claude-memories 심링크)라 repo 파일이 아니다(0.18.0 `harness-0.18.0`과 같은 위치 규약). "스크래치패드 실행"의 취지(repo에 테스트 파일 없음)를 충족하면서 세션·머신을 넘어 재실행할 수 있다.
- 실행: `HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs`
- 케이스 11개(C1~C11): C1·C2 비오르카 고정 문자열 · C3 비오르카 부정 · C4 오르카 needle 전부 · C5 재넛지 (2) 동일 · C6 `--terminal` 바인딩 · C7 판정 로직 회귀(stopHookActive 포함) · C8 E2E(`ORCA_TERMINAL_HANDLE` 유무·빈 문자열·안전 문자 집합 밖 핸들·stop_hook_active) · C9 제목 절단·정확 조회(bash 실행) · C10 셸 안전(bash 실행, 대조군 포함) · C11 상태 프로브 fail-closed(bash 실행 — reason에서 잘라낸 `STATE_PROBE_CMD`를 가짜 companion 루트·상태 파일로 실행: `[]`·비JSON·`jobs` 비배열·`jobs[]` 항목 이탈·`config` 비객체·`stopReviewGate` 비boolean(`"true"`·`1`) → `STATE_UNREADABLE` exit 2, 정상 객체 → `GATE_ON FOREIGN_ACTIVE=1`, 파일 부재 → `GATE_OFF FOREIGN_ACTIVE=0`).
- 기대: 0.19.0 훅 = **RED 4 pass / 7 fail**(C3·C7·C9·C10만 통과) → task-02 후 **GREEN 11/11**.
- **기록(AC5)** = 이 엔트리포인트 말미 `## 훅 테스트 기록 (AC5, D5)` 절 — task-02가 TAP 출력 원문(`ok 1 …` ~ `# fail 0`)을 인용해 커밋한다. review-loop(impl)에서 훅이 다시 바뀌면 재실행해 같은 절에 추가한다(spec "impl ledger에 기록"의 구체 위치 — review-loop(impl) ledger는 이 절을 참조).

### SC-7. AC6 실사용 확인 절 (task-05가 말미에 추가, 릴리스 후 맥북 세션이 채운다 — D11)

절 제목 `## AC6 실사용 확인 (트랙 완료 조건, D11)`. 관찰 항목 표 11행(사전 검증 · 제목 정규화 · wait · turn_started · 옛 세션 정지 · 후계 0번째 · 첫 동작 옛 핸들만 · SessionEnd 정리 · §0 대조·라운드 이어감 · 메타문자 원문 전달 · 라운드 진행 중 넛지). **11행 전부 필수**(11행 "미발생" 불허 — spec F6 파일럿 미측정 3건은 9·11행이 닫는다, plan R1-3). 메타문자 전달 프로브 = 재개 프롬프트 템플릿에 내장된 `$(…)` 식(CLI·companion 해소식)이 확장 없이 도착하는지(`<경로>` 슬롯은 review-loop에서 고정 — plan R1-4). 채워진 뒤 eval repo `report/ORCA-SUCCESSOR-2026-09-24.md`에 부기(파일럿 미측정 3건 종결).

### SC-8. 커밋 규칙

명시 stage(`git add <파일>`, `git add -A` 금지 — `.remember/`는 gitignore라 stage 대상이 아니다) · `$(git rev-parse --git-dir)/index.lock` 있으면 대기 · **AI 서명·도구 흔적 금지**(글로벌 규칙 — `Co-Authored-By`·`Claude-Session`·`Generated with` 어느 것도 넣지 않는다; SDD 디스패치 프롬프트마다 명시) · 접두 관례: `feat(hook):` `fix(review-loop):` `docs(readme):` `release: 1.0.0 — …` · task당 1커밋 이상.

## Task table

| # | title | status | file | deps | outcome |
|---|-------|--------|------|------|---------|
| 01 | 훅 테스트 작성 + RED (F5) | [ ] | [task-01](2026-09-24-orca-successor-session/task-01-hook-test-red.md) | — | |
| 02 | 훅 오르카 분기·후계 스폰 절차·폴백 → GREEN + AC5 기록 (F1·F2·F5) | [ ] | [task-02](2026-09-24-orca-successor-session/task-02-hook-successor-spawn.md) | 01 | |
| 03 | RL §2b (1) 문장 + §2i 표 3행 경로 ① 조건화 (F3) | [ ] | [task-03](2026-09-24-orca-successor-session/task-03-review-loop-handoff-wording.md) | 02 | |
| 04 | README 3종 §8 1.0.0 문단 + §주의 전역 설치 문구 교체 (F4) | [ ] | [task-04](2026-09-24-orca-successor-session/task-04-readme-sync.md) | 03 | |
| 05 | 릴리스 1.0.0 + 4머신 갱신 안내 + AC6 절 (F4·F6) — **9단계, SDD 디스패치 대상 아님** | [ ] | [task-05](2026-09-24-orca-successor-session/task-05-release-1-0-0.md) | 04 + review-loop(impl) 종결 | |

**AC ↔ task**: AC1·AC2 → 02(01 테스트 C1~C6·C8) · AC3 → 03 · AC4 → 04(README)·05(plugin.json·4머신) · AC5 → 02(기록 절) · AC6 → 05(릴리스 후 실사용 — 트랙 완료 조건).

**SDD 실행 범위 = task-01~04.** task-05는 9단계(릴리스)라 SDD가 디스패치하지 않는다 — 8단계 review-loop(impl)가 성공 종료(엔트리포인트 말미 `## 적대검증 ledger (impl)` 종결 기록)한 뒤 그 세션 또는 새 세션이 task-05를 단독 실행한다. 표에 두는 이유는 완료 기록(status·outcome)을 같은 표에서 받기 위해서다(plan R2-1).

**review-loop(impl) 입도**: 통합 1회(task-01~04, 코드 1파일 — task-05는 그 뒤). base = 구현 착수 직전 main SHA(plan 종결 커밋). **8단계 impl 게이트**: 이 repo는 npm이 아니므로 RL 게이트 4종 대신 **SC-6 GREEN 기록 + 각 task AC grep**으로 갈음한다(dev-cycle 규약 · spec §6).

**트랙 밖(여기서 하지 않는다)**: spark2·Windows 오르카 환경 확인(D11 후속 — 각 머신 첫 넛지 때) · codex 브로커 참조 계수·drain/lease API(OUT_OF_SCOPE) · 0.18.0 트랙 AC11(별도 미결).

## 재논의 금지(기결정) — spec에서 승계

> **이번 트랙 확정 결정 = D1~D12(spec §4, 2026-09-24 harden-spec, 전부 사용자 확정)** — 적대검증(plan·impl)에서 재론하지 않는다. 특히: D1 같은 체크아웃(워크트리 핑퐁 불채택) · D2 후계 = `claude` 그대로(인자 복제 없음) · D3 옛 세션 종료 = 후계 첫 동작 `/exit`→종료 대기→close(옛 세션 자기 종료·close만 쓰기 불채택) · D4 단계 경계 불가침 · D5 테스트 repo 파일 없음 · D6 넛지 문구 길이 상한 없음 · D7 탭 제목 = 모델의 짧은 작업명(폴백 `successor`) · D8 끄기 스위치 없음 · D9 닫기 실패 처리 · D10 반쪽 터미널은 옛 세션이 닫는다 · D11 완료 조건 = 맥북 실사용 1회 · D12 (0) 인계 문장 양 경로 공통.
>
> **spec ledger 닫힌 항목 2행(승계 — 재수정·재논의 금지)**:
> - `spec:F1 · [R6-1b] 잡 검사와 SessionEnd 사이 경쟁 창(TOCTOU)` — **ACCEPTED(사용자 재판정, C2 감사 이의 후)**. 이유: 같은 폴더 동시 세션은 규약상 드묾 · 현행 사람 `/clear`와 동일 위험 · 수초 창. **보완 없음**(F6 미포함 — 사용자 선택).
> - `drain/lease API`(R6-1 권고) — **OUT_OF_SCOPE [루프 판정, C2 감사 타당]**. codex 플러그인 소관(잔여 리스크 기록).
>
> FIXED 12건의 원문·근거는 spec 말미 ledger(복제 금지). DEFERRED_TO_IMPL 0.
>
> 아래는 **승계 기결정** — 이 트랙이 위배하면 안 되는 것.

- **L1~L5 교훈 원칙**(`~/workspace/dev-workflow-eval/report/LESSONS-2026-08-12.md`) — 특히 L1 "성장은 실측 뒤에"(이 트랙의 실측 = `ORCA-SUCCESSOR-2026-09-24.md`), L3 "기본값은 싼 쪽"(오르카 밖 바이트 동일).
- **G1·G2** — 기계 검증 장치 과설계 금지(`docs/specs/2026-07-25-ui-mockup-skill-design.md:147-148`). 훅은 상태 조회 코드를 갖지 않는다(문면 지시).
- **08-09 D3·D4·D6·D10** — 재넛지 15%p · 재넛지 = 지시 동일 + 사실 추가(오르카 (2)도 최초·재넛지 동일) · 테스트 repo 파일 없음(D5로 유지).
- **0.18.0 D1·D25·D26·D27** — 백그라운드 대기 · 넛지 문구 ①②③ 최초·재넛지 동일 · 루프 파일 필드 불변 · PreToolUse 없음.
- **C-4 D11·D14·D26** — 훅 단서 "review-loop 실행 중이면 그 스킬 규정" 유지 · §0↔§2i 동일 목록 · §2i 순서 0~4 불변(3행 내용만 조건화).
- **08-13 사용자 합의** — 사람 게이트는 넘기지 않는다(단계 경계·경로 ②·③ 수동 유지, R5-1).
- **plan-gate fp-C1**(어댑터 = 계약 블록 안) · **DR:196**(doctor는 오르카·codex 상태를 새로 진단하지 않는다 — D8 스위치 없음과 같은 취지).

## 적대검증 ledger (plan)

루프 시작 2026-09-24 · base = origin/main `ee0a356` · 예산 max 5 · confirm 2 · auto 3 · 보안 크리티컬 아님(일반 트랙, spec 루프와 동일 판정). 게이트: repo CLAUDE.md 없음 → 분할 규약 관문 ①②④ 스킵 · ③ spec ledger fingerprint 컬럼 있음 · 내용 관문 통과. score 산식 = critical 4 · high 3 · medium 1(§2c 분류 직후·수정 전 스냅샷, 미확인 FIXED 큐 제외).

| R | 모드 | score | 미확인 FIXED 큐 | 비고 |
|---|---|---|---|---|
| R1 | 적대(자동) | 5 (medium 5) | 0 → 5 | verdict needs-attention · 신규 5 · FIXED 5 `49806b1`(R1-1 재평가 high→medium) · batch 적재 0 · 루프 직접 판정 0 |

| fingerprint | severity | disposition | 근거 |
|---|---|---|---|
| task-02 · [R1-1] ORCA_TERMINAL_HANDLE이 셸 명령에 무이스케이프 삽입 · 핸들 allowlist 불일치 시 폴백 + 적대 핸들 회귀 테스트 | medium(재평가 ← high: 핸들은 오르카 호스트가 심는 env, 검사 1줄) | FIXED `49806b1` | `resolveOrcaHandle` = trim 뒤 `/^[A-Za-z0-9._-]+$/` 불일치 → null(오르카 밖 경로). SC-3·SC-5 부정 요건·task-02 Cautions, E2E C8 적대 핸들 케이스 |
| task-02 · [R1-2] STATE_PROBE_CMD가 JSON 배열·스키마 이탈을 정상 상태로 오인(fail-open) · 루트 배열 차단 + config·jobs 형식 검증 + 실행 테스트 | medium | FIXED `49806b1` | `obj()` 헬퍼로 루트 비객체(배열 포함)·`jobs` 비배열·`config` 비객체 → `STATE_UNREADABLE` exit 2. SC-4 계약 갱신. 신규 C11(가짜 companion 루트·상태 파일로 reason에서 잘라낸 프로브를 bash 실행 — `[]`·비JSON·`{"jobs":"x"}`·`{"config":[]}` 차단, 정상 객체 `GATE_ON FOREIGN_ACTIVE=1`). 테스트 11개, RED 4/7 · GREEN 11/11 합성 실측 |
| task-05 · [R1-3] F6 진행 중 넛지 검증(11행)을 "미발생"으로 생략해도 AC6 통과 · 11행 필수 + 재현 절차 | medium | FIXED `49806b1` | 11행 필수(통과 = 1~11), 조건 ③ 재현 = `CLAUDE_CTX_THRESHOLD=0.05`로 review-loop 시작 → §2b ③ 백그라운드 대기 턴의 Stop이 첫 넛지; 먼저 온 넛지면 임계 올려 재시작. SC-7·설치 안내 문안 동기 |
| task-05 · [R1-4] AC6 메타문자 전달 검증이 정상 구현으로도 불성립(내용은 `<경로>`로 전달되지 않음) + 정규화 기대값 오기 · 프로브 재설계 + `ac6---echo-x---id--` | medium | FIXED `49806b1` | 전달 프로브 = 재개 프롬프트 템플릿 내장 `$(…)` 식(CLI·companion 해소식)이 확장 없이 도착하는지(`<경로>` 슬롯은 review-loop에서 고정 — spec F6 "경로" 항목의 구체화). 제목 기대값 정정(집합 밖 8자 → `-` 8개) |
| task-04 · [R1-5] README 1.0.0 문단이 모든 실패에서 `/clear` 복귀를 약속(차단 경로 누락) · F2와 정확히 동기 | medium | FIXED `49806b1` | 3언어 문단: 정리·소멸 확인 뒤에만 `/clear` 안내, 후계 미확정(0/2+)·정리 미확인이면 차단 보고. 표·python 치환 원문 둘 다 갱신 |

