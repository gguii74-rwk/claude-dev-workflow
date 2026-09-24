# 오르카 후계 세션 스폰 (1.0.0) — 구현 계획 엔트리포인트

- **spec**: `docs/specs/2026-09-24-orca-successor-session.md` (F1~F6 · D1~D12 · AC1~AC6). **spec ledger = spec 말미 `## 적대검증 ledger (spec)`** — 단일 원본, 여기에 복제하지 않는다. plan·impl ledger는 review-loop가 **이 문서 말미**에 만든다(`## 적대검증 ledger (plan)` · `## 적대검증 ledger (impl)`). **impl ledger 종결 행 계약(생산자 측 — task-05 게이트가 소비)**: review-loop(impl)는 성공 종료 시 impl ledger 절 안에 `**종결(YYYY-MM-DD)**: `로 시작하는 한 줄을 쓰고, 그 줄에 `미확인 FIXED 큐 0` · `미판정 blocking 0` · `최종 verdict approve`(확인 라운드 없는 빠른 종료면 `빠른 종료`) 세 문구를 그대로 담는다 — spec ledger 종결 행(spec :180)과 같은 형식. 이 문구가 하나라도 없으면 task-05 단계 1 게이트가 0을 내고 멈추므로, impl 루프 종료 요약(§4)을 쓸 때 이 형식을 따른다(plan C1 재분류 R3-2).
- **Goal**: 오르카 터미널에서 돌던 세션이 컨텍스트 넛지를 받으면 `/clear` 안내 대신 **같은 체크아웃에 후계 claude 터미널을 띄워 재개 프롬프트를 보내고 정지**하게 하고, 후계가 옛 세션을 정상 종료(`/exit`→`--for exit` 대기→close)시킨 뒤 이어가게 한다. 오르카 밖은 (0)의 인계 문장 1개를 제외하고 0.19.0과 바이트 동일. 1.0.0으로 릴리스한다.
- **Architecture**: 산출물은 **훅 코드 1파일 + 규약 문면**이다 — `context-threshold-hook.mjs`의 `decideNudge`가 `orcaHandle`로 (2)를 가른다(순수 함수, 판정 로직 불변). 옛 세션·후계가 실행할 명령은 훅 reason 문면이 플래그까지 지시한다(D6 — 훅은 오르카·codex 상태를 직접 조회하지 않는다: codex 상태 디렉터리는 codex 플러그인의 `CLAUDE_PLUGIN_DATA`에 묶여 있어 다른 플러그인의 훅 프로세스에서 해소를 보장할 수 없고, 세션의 Bash에는 codex SessionStart 훅이 그 값을 심어 준다 — 실측 probe-A). review-loop SKILL.md는 (0) 문장 바이트 동일 + §2i 표 3행 경로 ① 조건화만. 검증 = `.remember/` 아래 `node --test`(D5, repo 파일 없음) + grep 대조.
- **Tech stack**: Node ESM 훅(`node --test` 내장 러너, 외부 의존 없음) · Markdown 스킬 문서 · bash · Orca CLI 1.4.209(`terminal create/show/list/wait/send/read/close`, send 영수증 = `result.send.accepted`·`result.send.prompt.{requestId,stages}`, wait = `result.wait.satisfied`) · codex companion 1.0.6(`scripts/lib/state.mjs`의 `resolveStateFile(cwd)`, 상태 파일 `state.json`의 `config.stopReviewGate`·`jobs[].{status,sessionId}`).
- **경로 = 정식**(사용자 확정 2026-09-24). 3.5 비대상. 다음 = 6 review-loop(plan) → 7 impl(SDD, **task-01~04만**) → 8 review-loop(impl) → 9 릴리스 1.0.0(**task-05 — SDD 범위 밖, 8 종결 뒤 단독 실행**) → **AC6 맥북 실사용 1회 = task-06**(트랙 완료 조건, D11 — 표가 채워진 커밋이 완료 신호).

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
| `STATE_PROBE_CMD` | `resolveStateFile(process.cwd())`로 얻은 상태 파일을 **직접 한 번** 읽어 `JSON.parse`한 동일 객체에서 `config.stopReviewGate`와 `jobs`를 함께 읽는다(`loadState`·`status --all` 불사용, C2) | 한 줄 `GATE_ON\|GATE_OFF FOREIGN_ACTIVE=<n>` (n = `status ∈ {queued,running}` ∧ `sessionId ≠ $CODEX_COMPANION_SESSION_ID` 잡 수). 파일 부재(`readFileSync`의 **ENOENT만** — `existsSync`는 권한·경로 오류도 false로 축약하므로 쓰지 않는다, plan R5-1) = `GATE_OFF FOREIGN_ACTIVE=0`; 그 외 읽기 오류(EACCES·EISDIR 등) = `STATE_UNREADABLE`. 파일이 있으면 `config`·`jobs` **둘 다 필수**(companion `saveState`는 항상 `{version,config,jobs}`를 쓴다). 읽기·파싱 실패·import 실패·루트 비객체(배열 포함)·`jobs` 부재/비배열·`jobs[]` 항목 비객체/`status` 비문자열·`config` 부재/비객체·`config.stopReviewGate` 부재/비boolean(예: 문자열 `"true"` — companion은 truthy로 소비) = `STATE_UNREADABLE` + exit 2(부분 손상·스키마 이탈도 fail-closed — plan R1-2·R2-2·R3-1) |

사용처: 옛 세션 (2-0)ⓒ(GATE_ON·STATE_UNREADABLE·RESOLVE_FAIL → 폴백) · 후계 0번째 동작(FOREIGN_ACTIVE≠0 → 15초 간격 대기, 상한 10분=40회 · STATE_UNREADABLE·RESOLVE_FAIL → 보고·보류). 실측(2026-09-24 이 repo): `GATE_OFF FOREIGN_ACTIVE=0`, exit 0.

### SC-5. 오르카 (2) 필수 요소 — task-01 테스트 C4의 needle 목록이 계약이다

task-02의 `orcaHandoff(h)` 출력은 아래를 **문자열 그대로** 포함한다(테스트가 `includes`로 대조). 괄호는 spec 근거.

- (2-0): `ORCA_CLI_COMMAND가 있으면 그 값, 없고 ORCA_DEV_REPO_ROOT가 있으면 orca-dev, 그 외 orca` · `"$CLI" terminal show --terminal "<옛 핸들>" --json` · `installed_plugins.json` · `resolveStateFile(process.cwd())` · `stopReviewGate===true?"GATE_ON":"GATE_OFF"` · `STATE_UNREADABLE` · `GATE_ON이면 자동 인계를 하지 않고 [폴백]` · `loadState` · `status --all` (R1-1·R6-2·C2)
- (2-1): `[A-Za-z0-9._-]` · `전체 길이 ≤ 40` · `TITLE="${NAME:0:$((40 - ${#TOKEN} - 1))}-$TOKEN"` · `"$CLI" terminal create --worktree active --title "$TITLE" --command claude --json` · `result.startupTerminal.handle` · `"$CLI" terminal list --worktree active --json` · `정확히 1개가 아니면(0 또는 2+) [폴백]` · `successor` (R2-3·R3-1·R4-1·D7)
- (2-2): `"$CLI" terminal wait --terminal "<새 핸들>" --for tui-idle --timeout-ms 90000 --json` · `--timeout-ms 180000`
- (2-3): `cat > ".remember/successor-$TOKEN.prompt" <<'SUCCESSOR_PROMPT_EOF'` · `--wait-submit 15 --json --text "$(cat ".remember/successor-$TOKEN.prompt")"` · `result.send.prompt.stages에 turn_started` · `--wait-submit 30 --retry-request <id>` (R2-2·R1-2)
- (2-4) 템플릿: `[0번째 동작 — 공유 브로커 단일 실행권 검사]` · `FOREIGN_ACTIVE` · `15초 간격` · `상한 10분` · `[첫 동작 — 옛 세션 정상 종료]` · `--terminal 생략 금지` · `"$CLI" terminal send --terminal "<옛 핸들>" --text "/exit" --enter --json` · `"$CLI" terminal wait --terminal "<옛 핸들>" --for exit --timeout-ms 30000 --json` · `tui-idle 불인정` · `Resume this session with` · `"$CLI" terminal close --terminal "<옛 핸들>" --json` · `close도 codex 시작도 하지 말고` · `닫기가 실패하면 사용자에게 알리고 codex 라운드를 시작하지 마라` · `다른 단계(spec→plan, plan→impl)의 시작이면 시작하지 말고 사용자에게 확인하라` · `/review-loop --resume` (R5-3·R6-1a·R2-1·R5-2·C1·D4·D9)
- (2-5): `(2-5) turn_started를 확인했으면 더 아무것도 하지 말고 턴을 끝내세요`
- [폴백]: `[폴백] 조건 4종: (a)` · `(b) (2-2) wait satisfied:false` · `(c) (2-3) turn_started 미확인` · `(d) CLI 실행 오류` · `재생성과 /clear 안내를 모두 차단` · `미전달이 확정되기 전(재관찰·재조정 중)에는 후계를 닫지 마세요` · `"$CLI" terminal wait --terminal "<새 핸들>" --for exit --timeout-ms 30000 --json` · `/exit 처리 증거 없이 close하지 마세요` · `소멸을 확인하고` · `소멸이 확인된 경우에만` · `/clear를 안내하지 말고 차단 상태` · CLEAR (F2·R1-3·D10·plan R4-1 — 정리 미확인이면 안내 없이 보고·정지)
- 변수 보존(plan R5-2): `자리표시자입니다 — 도구 호출마다 셸이 새로 시작` · `리터럴로 치환해 실행하라` — `$CLI`·`$TOKEN`·`$TITLE`·`<새 핸들>`은 문면상 자리표시자이고 실행 시 리터럴 치환(또는 같은 호출 안 해소·사용)을 지시한다.
- 부정 요건: `자가 /clear는 불가` 0건 · `"$CLI" terminal (send|wait|close|read|show)` 뒤에 ` --terminal ` 없는 것 0건 · 옛 핸들 바인딩은 값 리터럴(`--terminal "term_…"`), 새 핸들은 `"<새 핸들>"` 자리표시자만 · 안전 문자 집합 밖 `ORCA_TERMINAL_HANDLE`은 오르카 경로에 들어가지 않는다(`resolveOrcaHandle` → null, E2E C8).

`<옛 핸들>`은 실제 값(`orcaHandle`)으로 치환된 상태. 프롬프트 파일은 **줄바꿈 없이 한 줄**로 쓰라고 지시한다(TUI에 줄바꿈이 조기 제출로 들어갈 위험 제거 — F6 관찰 항목).

### SC-6. 테스트 위치·실행·기록 (F5 · D5 · 08-09 D10)

- 파일: `.remember/hook-test-1.0.0/context-threshold-hook.test.mjs` — `.remember/`는 gitignore(= claude-memories 심링크)라 repo 파일이 아니다(0.18.0 `harness-0.18.0`과 같은 위치 규약). "스크래치패드 실행"의 취지(repo에 테스트 파일 없음)를 충족하면서 세션·머신을 넘어 재실행할 수 있다.
- 실행: `HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs`
- 케이스 11개(C1~C11): C1·C2 비오르카 고정 문자열 · C3 비오르카 부정 · C4 오르카 needle 전부 · C5 재넛지 (2) 동일 · C6 `--terminal` 바인딩 · C7 판정 로직 회귀(stopHookActive 포함) · C8 E2E(`ORCA_TERMINAL_HANDLE` 유무·빈 문자열·안전 문자 집합 밖 핸들·stop_hook_active) · C9 제목 절단·정확 조회(bash 실행) · C10 셸 안전(bash 실행, 대조군 포함) · C11 상태 프로브 fail-closed(bash 실행 — reason에서 잘라낸 `STATE_PROBE_CMD`를 가짜 companion 루트·상태 파일로 실행: `[]`·비JSON·`{}`·`config`/`jobs` 한쪽 누락·`jobs` 비배열·`jobs[]` 항목 이탈·`config` 비객체·`stopReviewGate` 부재/비boolean(`"true"`·`1`) → `STATE_UNREADABLE` exit 2, 정상 객체(`saveState` 형태) → `GATE_ON FOREIGN_ACTIVE=1` / `GATE_OFF FOREIGN_ACTIVE=0`, 파일 부재 → `GATE_OFF FOREIGN_ACTIVE=0`).
- 기대: 0.19.0 훅 = **RED 4 pass / 7 fail**(C3·C7·C9·C10만 통과) → task-02 후 **GREEN 11/11**.
- **기록(AC5)** = 이 엔트리포인트 말미 `## 훅 테스트 기록 (AC5, D5)` 절 — task-02가 TAP 출력 원문(`ok 1 …` ~ `# fail 0`)을 인용해 커밋한다. review-loop(impl)에서 훅이 다시 바뀌면 재실행해 같은 절에 추가한다(spec "impl ledger에 기록"의 구체 위치 — review-loop(impl) ledger는 이 절을 참조).

### SC-7. AC6 실사용 확인 절 (task-05가 빈 표·절차를 말미에 추가, task-06이 릴리스 후 맥북 세션에서 채운다 — D11)

절 제목 `## AC6 실사용 확인 (트랙 완료 조건, D11)`. 관찰 항목 표 11행(사전 검증 · 제목 정규화 · wait · turn_started · 옛 세션 정지 · 후계 0번째 · 첫 동작 옛 핸들만 · SessionEnd 정리 · §0 대조·라운드 이어감 · 메타문자 원문 전달 · 라운드 진행 중 넛지). **11행 전부 필수**(11행 "미발생" 불허 — spec F6 파일럿 미측정 3건은 9·11행이 닫는다, plan R1-3). 메타문자 전달 프로브 = 재개 프롬프트 템플릿에 내장된 `$(…)` 식(CLI·companion 해소식)이 확장 없이 도착하는지(`<경로>` 슬롯은 review-loop에서 고정 — plan R1-4). 채워진 뒤 eval repo `report/ORCA-SUCCESSOR-2026-09-24.md`에 부기(파일럿 미측정 3건 종결) — task-06. 배포 순서 = push → 맥북만 갱신 → task-06 통과 → 나머지 3머신(plan R4-2). AC6 대상 버전 = 릴리스된 최신 1.0.x(최소 1.0.0; 실패 복구 후엔 그 patch) — 실제 설치 버전을 절 상단 `**설치 버전**:` 줄에 적고 task-06 AC가 검사한다(plan R5-3). 결과 열은 `통과`/`실패`만: task-06 AC가 11행 전부 관찰 열 비어 있지 않고 `통과`인지 센다(빈 표·부분 기록으로는 06행이 `[x]`가 되지 않는다, plan R3-3).

### SC-8. 커밋 규칙

명시 stage(`git add <파일>`, `git add -A` 금지 — `.remember/`는 gitignore라 stage 대상이 아니다) · `$(git rev-parse --git-dir)/index.lock` 있으면 대기 · **AI 서명·도구 흔적 금지**(글로벌 규칙 — `Co-Authored-By`·`Claude-Session`·`Generated with` 어느 것도 넣지 않는다; SDD 디스패치 프롬프트마다 명시) · 접두 관례: `feat(hook):` `fix(review-loop):` `docs(readme):` `release: 1.0.0 — …` · task당 1커밋 이상.

## Task table

| # | title | status | file | deps | outcome |
|---|-------|--------|------|------|---------|
| 01 | 훅 테스트 작성 + RED (F5) | [x] | [task-01](2026-09-24-orca-successor-session/task-01-hook-test-red.md) | — | `.remember/hook-test-1.0.0/` 259행 11케이스, 0.19.0 훅 RED 4/7(C3·C7·C9·C10 통과) · repo 무변경(D5) · AC `grep -c 'hook-test'`는 plan 파일명 오탐 → `hook-test-1.0.0/`로 판정(0) |
| 02 | 훅 오르카 분기·후계 스폰 절차·폴백 → GREEN + AC5 기록 (F1·F2·F5) | [x] | [task-02](2026-09-24-orca-successor-session/task-02-hook-successor-spawn.md) | 01 | 훅 `958c1e5`(25,808B, plan 원문 바이트 동일) · GREEN 11/11 · 비오르카 reason diff = (0) 1문장 · 스니펫 `GATE_OFF FOREIGN_ACTIVE=0`·`CLI=orca`·`LEN=40` · AC5 기록 절 `7d64e3b` |
| 03 | RL §2b (1) 문장 + §2i 표 3행 경로 ① 조건화 (F3) | [x] | [task-03](2026-09-24-orca-successor-session/task-03-review-loop-handoff-wording.md) | 02 | `2d13115` — §2b (1) 인용문 = 훅 (0) 바이트 동일(BYTE_SAME) · §2i 3행 경로 ①만 조건화, ②·③ 수동 유지 · 불변 앵커 4종·표 0~4행 유지 · 71,120B |
| 04 | README 3종 §8 1.0.0 문단 + §주의 전역 설치 문구 교체 (F4) | [x] | [task-04](2026-09-24-orca-successor-session/task-04-readme-sync.md) | 03 | `18b1416` — 3언어 §8 1.0.0 문단 205행 동일(SAME_POSITION) · §주의 불릿 교체, "동작은 무해"류 0건 · 문구 plan 원문 정확 일치 |
| 05 | 릴리스 1.0.0 + 4머신 갱신 안내 + AC6 빈 표·절차 절 (F4·F6) — **9단계, SDD 디스패치 대상 아님** | [x] | [task-05](2026-09-24-orca-successor-session/task-05-release-1-0-0.md) | 04 + review-loop(impl) 종결 | 릴리스 커밋(`release: 1.0.0`) — plugin.json 0.19.0→1.0.0 · 게이트 impl ledger 종결 행 1 · no-AI-trace 0(`92e1374..HEAD`) · README 3종 `ORCA_TERMINAL_HANDLE` 각 1 · AC6 빈 표 11행·절차 절 추가(채우기 = task-06, 이 `[x]`는 AC6 완료 아님) · 미push |
| 06 | AC6 실사용 확인 기록 — **트랙 완료 조건** (F6·D11) — **릴리스·push·맥북 갱신 뒤, SDD 디스패치 대상 아님** | [ ] | [task-06](2026-09-24-orca-successor-session/task-06-ac6-field-run.md) | 05 + push + 맥북 설치 갱신 | |

**AC ↔ task**: AC1·AC2 → 02(01 테스트 C1~C6·C8) · AC3 → 03 · AC4 → 04(README)·05(plugin.json·4머신) · AC5 → 02(기록 절) · AC6 → 06(실사용 기록 — 트랙 완료 조건; 05는 빈 표·절차만 — 05의 `[x]`는 AC6 완료가 아니다).

**SDD 실행 범위 = task-01~04.** task-05(릴리스)·task-06(AC6 실측)은 9단계 이후라 SDD가 디스패치하지 않는다 — 8단계 review-loop(impl)가 성공 종료(엔트리포인트 말미 `## 적대검증 ledger (impl)` 종결 행)한 뒤 그 세션 또는 새 세션이 task-05를, 릴리스·push·맥북 갱신 뒤 맥북 세션이 task-06을 단독 실행한다. 표에 두는 이유는 완료 기록(status·outcome)을 같은 표에서 받기 위해서다(plan R2-1·R3-3). 트랙 완료 = 06행 `[x]`. **task-05·06의 완료 권위 = 이 커밋된 task 표 + 각 task의 AC**(SDD progress ledger에는 기록하지 않는다 — SDD 밖이라 계약 블록의 convergence 규칙, 즉 "ledger 완료 기록 부재 → `[ ]` 복원"의 대상이 아니다; 그 규칙은 SDD 실행 범위 task-01~04에만 적용한다). 실행자는 task-05/06 완료 시 표 행 `[x]`·outcome을 쓰고 이 파일을 즉시 커밋한다(계약 ④와 같은 기록, ledger 기록만 생략). task-06 착수나 어떤 복구 절차도 task-05 행을 되돌리지 않는다(plan C1 재분류 R3-3).

**review-loop(impl) 입도**: 통합 1회(task-01~04, 코드 1파일 — task-05·06은 그 뒤). base = 구현 착수 직전 main SHA(plan 종결 커밋). **필수 확인 항목(plan 루프 폴백 ① 이월)**: task-06 AC의 커밋 제목 버전 대조 검사(`d5ae7c9`)가 실제로 자리표시자·다른 버전을 0으로 판별하는지 — impl 루프의 확인 라운드 프롬프트 ②(미확인 FIXED 큐)에 원 지적(plan ledger C3 회귀 행)과 함께 첨부한다. **8단계 impl 게이트**: 이 repo는 npm이 아니므로 RL 게이트 4종 대신 **SC-6 GREEN 기록 + 각 task AC grep**으로 갈음한다(dev-cycle 규약 · spec §6).

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
| R2 | 적대(자동) | 3 (medium 3) | 5 → 8 | verdict needs-attention · 신규 3 · FIXED 3 `d722293` · R1 큐 5건 적대 비재출현(R2, 참고 — 큐 유지) · batch 적재 0 · 루프 직접 판정 0 · 신호 미발화(5→3 감소) |
| R3 | 적대(자동, 경계) | 5 (high 1·medium 2) | 8 → 11 | verdict needs-attention · 신규 3 · FIXED 3 `378c92e`(R3-1·R3-2 재평가 high→medium) · 큐 8건 적대 비재출현(R3, 참고 — 큐 유지) · 소진 3 = auto 경계, batch 적재 0 → flush 없음 · 신호 1 미발화(5→3→5) · 신호 2 미발화 → 정밀 모드 R4 |
| R4 | 적대(정밀) | 5 (medium 5 — R4 4 + 루프 자체 발견 L1) | 11 → 16 | verdict needs-attention · 신규 4 + L1 · FIXED 5 `f0febc9`(R4-1·R4-2 재평가 high→medium) · 큐 11건 적대 비재출현(R4, 참고 — 큐 유지) · 소진 4 · **신호 1 발화**(5→3→5→5: s4≥s3≥s2) → batch 적재 0(flush 없음) → **확인 모드 진입(C1)** |
| C1 | 확인 | — | 16 → 2 | 완전 응답(16건 전부 명시) · **소멸 14**(R1-1~R1-5 · R2-1~R2-3 · R3-1 · R4-1~R4-4 · L1) · **blocking 재분류 2**(R3-2 종결 게이트가 생산자 계약 없는 형식 강제 → medium · R3-3 SDD 밖 task-05/06 완료 권위 미규정 → medium) · 회귀 = 재분류 2건과 동일 · 감사 해당 없음 · 신규 low 1(EOF 빈 줄 — DEFER_LOW, 부수 정리) · verdict merge-ready: no → 2건 FIXED `914a832` → **복귀 적대 1(R5, 상한 밖) → 재진입 확인(C2, 상한 밖)** · 확인 소진 1 · 복귀 사용 |
| R5 | 적대(복귀, 상한 밖) | 3 (medium 3) | 2 → 5 | verdict needs-attention · 신규 3 · FIXED 3 `3def2a0` · 큐 2건 적대 비재출현(R5, 참고) · 루프 직접 판정 0 · 카운터 불변(예약분) → 재진입 확인 C2(상한 밖) |
| C2 | 확인(재진입, 상한 밖) | — | 5 → 1 | 완전 응답 · **소멸 4**(C1-R3-2 · C1-R3-3 · R5-1 · R5-2) · **잔존 1**(R5-3 — eval 부기 지시문 `1.0.0 설치본` 고정·eval AC 버전 미대조, medium) · 회귀 = 잔존과 동일 · 감사 해당 없음 · 신규 없음 · verdict merge-ready: no → **재진입 재발 = ESCALATE(즉시)** → 사용자 판정 **FIXED `27652ed` + 일반 확인 1회(C3, 예산 잔여 1)** · 카운터 불변(예약분) · whole-branch 리뷰 권고는 종료 보고에 기재 |
| C3 | 확인(일반 2/2) | — | 1 → 0 → 1 | 완전 응답 · **소멸 1**(R5-3) · **회귀 1**(task-06 AC 커밋 제목 검사가 버전 미대조, medium) · 감사 해당 없음 · 신규 없음 · verdict merge-ready: no → 확인 예산 소진·복귀 사용 완료 → **ESCALATE(즉시)** → 사용자 판정 **FIXED `d5ae7c9` + 폴백 ①(review-loop(impl) 필수 확인 항목으로 이월)** · 확인 소진 2 |

| fingerprint | severity | disposition | 근거 |
|---|---|---|---|
| task-02 · [R1-1] ORCA_TERMINAL_HANDLE이 셸 명령에 무이스케이프 삽입 · 핸들 allowlist 불일치 시 폴백 + 적대 핸들 회귀 테스트 | medium(재평가 ← high: 핸들은 오르카 호스트가 심는 env, 검사 1줄) | FIXED `49806b1` | `resolveOrcaHandle` = trim 뒤 `/^[A-Za-z0-9._-]+$/` 불일치 → null(오르카 밖 경로). SC-3·SC-5 부정 요건·task-02 Cautions, E2E C8 적대 핸들 케이스 |
| task-02 · [R1-2] STATE_PROBE_CMD가 JSON 배열·스키마 이탈을 정상 상태로 오인(fail-open) · 루트 배열 차단 + config·jobs 형식 검증 + 실행 테스트 | medium | FIXED `49806b1` | `obj()` 헬퍼로 루트 비객체(배열 포함)·`jobs` 비배열·`config` 비객체 → `STATE_UNREADABLE` exit 2. SC-4 계약 갱신. 신규 C11(가짜 companion 루트·상태 파일로 reason에서 잘라낸 프로브를 bash 실행 — `[]`·비JSON·`{"jobs":"x"}`·`{"config":[]}` 차단, 정상 객체 `GATE_ON FOREIGN_ACTIVE=1`). 테스트 11개, RED 4/7 · GREEN 11/11 합성 실측 |
| task-05 · [R1-3] F6 진행 중 넛지 검증(11행)을 "미발생"으로 생략해도 AC6 통과 · 11행 필수 + 재현 절차 | medium | FIXED `49806b1` | 11행 필수(통과 = 1~11), 조건 ③ 재현 = `CLAUDE_CTX_THRESHOLD=0.05`로 review-loop 시작 → §2b ③ 백그라운드 대기 턴의 Stop이 첫 넛지; 먼저 온 넛지면 임계 올려 재시작. SC-7·설치 안내 문안 동기 |
| task-05 · [R1-4] AC6 메타문자 전달 검증이 정상 구현으로도 불성립(내용은 `<경로>`로 전달되지 않음) + 정규화 기대값 오기 · 프로브 재설계 + `ac6---echo-x---id--` | medium | FIXED `49806b1` | 전달 프로브 = 재개 프롬프트 템플릿 내장 `$(…)` 식(CLI·companion 해소식)이 확장 없이 도착하는지(`<경로>` 슬롯은 review-loop에서 고정 — spec F6 "경로" 항목의 구체화). 제목 기대값 정정(집합 밖 8자 → `-` 8개) |
| task-04 · [R1-5] README 1.0.0 문단이 모든 실패에서 `/clear` 복귀를 약속(차단 경로 누락) · F2와 정확히 동기 | medium | FIXED `49806b1` | 3언어 문단: 정리·소멸 확인 뒤에만 `/clear` 안내, 후계 미확정(0/2+)·정리 미확인이면 차단 보고. 표·python 치환 원문 둘 다 갱신 |
| task-05 · [R2-1] task-05가 impl 검토(8단계)보다 먼저 릴리스되도록 배치(deps=04만, 미존재 impl ledger 뒤에 절 추가) · SDD 범위 task-01~04 + review-loop(impl) 종결을 명시적 선행 게이트로 | medium | FIXED `d722293` | 엔트리포인트 경로·task 표 deps·"SDD 실행 범위 = task-01~04" 절, task-05 목적·Deps·단계 1 게이트(`## 적대검증 ledger (impl)` 존재 + 종결 기록)·Cautions. task 수는 5 유지(완료 기록 계약을 같은 표에서 받기 위해) |
| task-02 · [R2-2] `config.stopReviewGate` 중첩 타입 이탈(문자열 `"true"`)이 `===true` 비교로 GATE_OFF 통과 · 필드 존재 시 boolean 검사 + job 항목 스키마 + C11 케이스 | medium | FIXED `d722293` | `jobsOk`(항목 객체·`status` 문자열)·`cfgOk`(`stopReviewGate` 있으면 boolean) 헬퍼 → 불일치 `STATE_UNREADABLE` exit 2. SC-4·SC-6·Cautions 갱신, C11 bad 케이스 4종 추가(`[null]`·`status:1`·`"true"`·`1`). R1-2와 같은 영역이나 컨테이너 검사 ≠ 중첩 필드 검사(별도 fingerprint) |
| task-05 · [R2-3] AC6 11행·4머신 grep 게이트가 문서 전체 숫자 행·이름 1개로 통과 · 절 범위 추출 + 머신별 개별 grep | medium | FIXED `d722293` | awk로 AC6 절만 추출해 행 번호 `1,…,11` 정확 대조(task 표 행 제외), 4머신 `grep -q` 각각 OK, ledger(impl) 존재 grep 추가. task-05 표 원문으로 실행 확인 |
| task-02 · [R3-1] 상태 파일의 필수 필드(`config`·`jobs`) 누락(`{}`)을 빈 상태로 오인 · 파일이 있으면 두 필드 필수 + C11 누락 케이스 | medium(재평가 ← high: companion `saveState`는 항상 `{version,config,jobs}`를 쓰므로 누락 = 부분 손상뿐, 검사 1줄) | FIXED `378c92e` | `jobsOk`·`cfgOk`에서 `undefined` 허용 제거, `stopReviewGate` boolean 필수. SC-4·SC-6·Cautions 갱신, C11 bad 케이스 `{}`·한쪽 누락·`config:{}` 추가, 정상 케이스는 `saveState` 형태. 실제 상태 파일(`keys: version,config,jobs`)로 필수 요구가 정상 경로를 막지 않음 확인 |
| task-05 · [R3-2] impl 검토 종결 게이트가 impl ledger 헤더 이후 어디든 `종결` 1회로 통과 · 절 범위 한정 + 종결 표지·verdict·미판정 0·큐 0 명시 검사 | medium(재평가 ← high: 사람/세션이 순서대로 실행하는 9단계 게이트, 문면 결함) | FIXED `378c92e` | awk로 `## 적대검증 ledger (impl)`~다음 `##` 범위만, `**종결(` 행이 `미확인 FIXED 큐 0`·`미판정 blocking 0`·`verdict approve|빠른 종료`를 모두 담아야 1(단계 1 + AC). spec ledger 종결 행으로 1, impl 절 부재로 0 실행 확인 |
| task-05 · [R3-3] AC6 표가 비어도 task-05가 `[x]`가 되어 트랙 완료로 복구됨 · AC6 실측을 별도 완료 행으로 + 11행 채움·eval 부기 게이트 | high | FIXED `378c92e` | task-06(AC6 실사용 기록) 신설 — Deps 05+push+맥북 갱신, SDD 범위 밖, AC = 11행 관찰 열 비어 있지 않고 결과 열 `통과`(빈 표 0 · 10통과+1실패 10 실행 확인; 11통과 케이스는 10행 셀의 `||`가 awk 열을 밀어 10 — 루프 자체 발견 L1로 R4 묶음에서 재수정) + eval 보고서 부기 grep·커밋. task 표 06행·AC6 매핑(05 `[x]` ≠ AC6)·SC-7·task-05 목적/Cautions/안내 동기. 트랙 완료 = 06행 `[x]` |
| task-02 · [R4-1] [폴백] 마지막 문장 "그런 다음"이 소멸 확인 실패 뒤에도 무조건 `/clear` 안내 · 소멸 확인 시에만 CLEAR, 미확인이면 보고·정지 + 부정 경로 테스트 | medium(재평가 ← high: 직전 문장이 "안내 전에 차단 보고"라 해석 갭, 문장 1개 교체) | FIXED `f0febc9` | 폴백 끝 문장 = "소멸이 확인된 경우에만 … 안내 / 남아 있거나 모호하면 /clear를 안내하지 말고 차단 상태 보고 뒤 정지". SC-5 [폴백] needle 2종·C4 NEEDLES 추가·Cautions. task-04 README 문장(R1-5)과 동기 |
| task-05 · [R4-2] AC6 게이트 전에 1.0.0 push·4머신 배포 · 맥북 먼저 → AC6 → 나머지 승격 | medium(재평가 ← high: push는 사용자 판단, 안내 문안 순서 변경) | FIXED `f0febc9` | 설치 갱신 = push → 맥북만 → task-06 통과 → 나머지 3머신(실패면 patch → 맥북 재검증). task-05 절·안내 문안·task-06 Deps·SC-7 동기. 트랙 밖 "각 머신 첫 넛지 때" 규정과 일관 |
| task-05 · [R4-3] AC6가 시작할 review-loop 대상 미지정(종결된 이 트랙 ledger 재사용 위험) · repo·phase·ledger·base·루프 파일 지정 + 재사용 가드 | medium | FIXED `f0febc9` | 대상 = 그 시점에 착수하는 다른 실제 트랙(후보 예시), 이 트랙 ledger에 라운드 추가 금지, 9행 관찰 열에 repo·phase·ledger 문서·base SHA·루프 파일 경로 기록(지금 확정 불가 — D11 실사용 조건). task-06 단계 1 동기 |
| task-05 · [R4-4] 11행이 `## 다음 액션`에 미판정 기록 요구(§2i는 `## 미해결 ledger`) · 기대값 정정 | medium | FIXED `f0febc9` | 11행 = `## 미해결 ledger` 미판정 + `## 다음 액션` 수신 라운드·판정 정책·미처리 단계. task-06 관찰 지침 동기 |
| task-05/06 · [L1, 루프 자체 발견] AC6 10행 셀의 `\|\|`가 task-06 AC awk 열을 밀고, macOS BSD awk가 한글 `==`를 locale collation으로 비교해 `"실패"=="통과"`가 참 · 셀 세로줄 금지 + NF 검사 + `LC_ALL=C` | medium | FIXED `f0febc9` | 10행 문구 `… )`로, task-05 통과 규칙·task-06 Cautions에 셀 `\|` 금지, AC에 `NF != 7` 0 검사와 `LC_ALL=C awk`(실측 awk 20200816: `LANG=en_US.UTF-8`에서 `("실패"=="통과")`=1, `LC_ALL=C`=0). python 생성 표로 11/10/10/0 확인 |

**확인 모드 진입(C1, 2026-09-24)**: 적대 4라운드 소진(max 5 중) · 신호 1 발화 · 미확인 FIXED 큐 16(R1 5 · R2 3 · R3 3 · R4 4 · L1 1) · 루프 직접 판정 0(임무 ③ 감사 대상 없음 — 사용자 기결정 D1~D12·spec 승계 ACCEPTED/OUT_OF_SCOPE는 대상 아님) · 확인 예산 2 · 복귀 미사용.
| task-05 · [C1 재분류 R3-2] 종결 게이트가 생산자(review-loop(impl))에 계약되지 않은 `**종결(`·`verdict approve\|빠른 종료` 형식을 강제 · 종결 행 형식을 생산자 계약으로 명시 | medium | FIXED `914a832` (재편입) | 엔트리포인트 상단 "impl ledger 종결 행 계약" 신설(3문구 + 빠른 종료 대안, spec :180 형식) — review-loop(impl) §4 종료 요약이 따른다. task-05 단계 1 주석이 계약을 가리키고 형식 불일치 시 종결 행 수정 후 재검사 |
| 엔트리포인트 · [C1 재분류 R3-3] SDD 밖 task-05·06에 progress ledger 완료 기록 절차가 없어 convergence 규칙이 `[x]`를 되돌릴 수 있음 · 완료 권위 예외 명시 | medium | FIXED `914a832` (재편입) | "SDD 실행 범위" 문단: task-05/06 완료 권위 = 커밋된 task 표 + AC, progress ledger 기록 없음, convergence 규칙(task-01~04 한정) 대상 아님, 표 행 `[x]`·outcome + 즉시 커밋. task-05/06 Cautions 동기 |

C1 소멸 확인 14건: R1-1~R1-5 · R2-1~R2-3 · R3-1 · R4-1~R4-4 · L1. low 1(EOF 빈 줄) = DEFER_LOW(같은 커밋에서 부수 정리).
| task-02 · [R5-1] `existsSync` false가 권한·경로 오류를 파일 부재로 축약해 GATE_OFF(fail-open) · `readFileSync` 직접 시도, ENOENT만 부재 | medium | FIXED `3def2a0` | 프로브: `readFileSync` catch에서 `e.code==="ENOENT"`만 `GATE_OFF FOREIGN_ACTIVE=0`, 그 외 `STATE_UNREADABLE` exit 2. SC-4·(2-0)ⓒ 문면·주석 갱신. C11에 부모 디렉터리 부재(ENOENT → GATE_OFF)·경로가 디렉터리(EISDIR → 차단) 케이스 |
| task-02 · [R5-2] `$CLI`·`$TOKEN`·`$TITLE`이 도구 호출 사이에 사라져 빈 값 명령이 실행됨 · 독립 셸에서 완결(리터럴 치환·상태 저장) + 테스트 | medium | FIXED `3def2a0` | (2) 셸 안전 문장에 "변수 보존: 자리표시자 — 도구 호출마다 셸이 새로 시작 → 해소된 실제 값을 리터럴로 치환한 완결 명령 또는 같은 호출 안 해소·사용, 빈 값 명령 실행 금지"; 재개 프롬프트에도 `$CLI` 자리표시자 고지. SC-5 변수 보존 항목·C4 needle 2종·Cautions. 상태 파일 대안은 채택 안 함(문면 지시로 충분, G1·G2) |
| task-05/06 · [R5-3] AC6가 1.0.0 고정이라 실패 후 patch(1.0.1) 재검증이 task-06을 완료할 수 없음 · 대상 버전 매개변수화 + 설치 버전 기록 + 복구 절차 | medium | FIXED `3def2a0` | AC6 절 대상 = 릴리스된 최신 1.0.x(최소 1.0.0), `**설치 버전**:` 줄(자리표시자 → task-06이 doctor 값으로 채움, AC grep `1\.0\.[0-9]+` — 자리표시자 0/채움 1 실측). task-06 목적·Prep·복구 절차(수정 → impl 재검토 → patch bump·push → 맥북 갱신 → 재실행)·커밋 문구 `<설치 버전>`·Cautions, task-05 설치 갱신 문단·안내 문안, SC-7 동기 |
| task-06 · [C2 잔존 R5-3] eval 부기 소절 제목이 `1.0.0 설치본`으로 고정·eval AC가 버전 미대조 · `<설치 버전>` 매개변수화 + eval 버전 = AC6 절 설치 버전 대조 | medium | FIXED `27652ed` (**사용자 판정** ESCALATE→FIXED, 재편입) | 단계 3 주석 `<설치 버전>`(세 곳 동일 요구), AC `V=$(… 설치 버전 …)` 추출 후 `grep -c "AC6 실측([날짜], $V 설치본)"` ≥1(스크래치: 1.0.1/1.0.1 → 1, 1.0.1/1.0.0 → 0), Cautions |
| task-06 · [C3 회귀] AC 커밋 제목 검사가 버전 없이 문구만 대조(자리표시자 미치환도 통과) · `$V` 대조 | medium | FIXED `d5ae7c9` (**사용자 판정** ESCALATE→FIXED) — **미확인, 폴백 ① 이월** | AC 마지막 검사 = `grep -cF "AC6 실사용 확인 기록 — 맥북 오르카 $V 설치본"`(스크래치: 1.0.1 일치 1 · 자리표시자 0 · 1.0.0 0). 소멸 확인은 review-loop(impl) 확인 프롬프트의 필수 항목(아래 이월) |

C3 소멸 확인 1건: R5-3.

**종결(2026-09-24)**: 적대 4 + 복귀 적대 1 · 확인 1 + 재진입 확인 1 + 일반 확인 1 = 총 8라운드(실행 실패 0). 미판정 blocking 0 · **미확인 FIXED 큐 1**(C3 회귀 `d5ae7c9` — 확인 예산 소진으로 **폴백 ①: review-loop(impl) 필수 확인 항목으로 이월**, 사용자 판정) · 최종 verdict = C3 merge-ready: no(그 1건이 사유이며 사용자 FIXED로 닫힘 — 확인은 impl 루프 몫). disposition 집계(고유 fingerprint 21): FIXED 21(그중 재분류·회귀 후 재수정 4: C1 재분류 2 · C2 잔존 1 · C3 회귀 1; 사용자 판정 2: C2 잔존 · C3 회귀) · ACCEPTED 0 · DEFERRED_TO_IMPL 0 · OUT_OF_SCOPE 0 · DUPLICATE 0 · low 1(EOF 빈 줄, 부수 정리) · ESCALATE 2건 전부 사용자가 FIXED로 닫음. 루프 건강: 재론률 0/21 · 철회 조항 0 · 사람개입률 2/21. **다음 phase 승계**: 재논의 금지 블록(D1~D12 + spec 2행)은 이 문서 상단에 이미 있음 · 이 루프의 ACCEPTED/OUT_OF_SCOPE/DEFERRED 0 · **review-loop(impl) 필수 확인 항목(폴백 ①)**: task-06 AC 커밋 제목 버전 대조 `d5ae7c9`의 소멸 확인 — impl 확인 프롬프트 ②에 첨부. **권고**: 재진입 확인(C2)과 일반 확인(C3)이 연속으로 새 blocking을 냈다(모두 task-05/06 AC6 게이트 문면) — 규정에 따라 **새 세션 whole-branch 리뷰 1회 권고**(impl 착수 전, 대상 = plan 전체; 사용자 판단).

## 훅 테스트 기록 (AC5, D5)

테스트 = `.remember/hook-test-1.0.0/context-threshold-hook.test.mjs`(repo 파일 아님, claude-memories) · 실행 = `HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap <파일>`.

| 일시 | 훅 커밋 | 결과 | 비고 |
|---|---|---|---|
| 2026-09-24 13:17 | 0.19.0 `92e1374` | RED 4 pass / 7 fail | C3·C7·C9·C10 자동 보완(현행에서도 통과) · C11은 오르카 문면 부재로 실패 |
| 2026-09-24 13:17 | `958c1e5` | GREEN 11/11 | 스니펫 실행: `GATE_OFF FOREIGN_ACTIVE=0` · `CLI=orca` · `LEN=40` |
| 2026-09-24 16:02 | `b11fef6` | GREEN 11/11 | 최종 리뷰 I1·M4 수정 — C4 needle 2개 추가(테스트 파일 .remember/), 비오르카 reason 수정 전과 동일 |
| 2026-09-24 16:25 | `bc958e4` | GREEN 11/11 | impl R1-1 — C4 needle 3개 추가, `b11fef6` 훅에서 C4 RED(pass 10 / fail 1) 확인 뒤 GREEN · 비오르카 reason 불변 |
| 2026-09-24 16:31 | `4770d6a` | GREEN 11/11 | impl R2-1 — C4 needle 1개 추가, `bc958e4` 훅에서 C4 RED(pass 10 / fail 1) 확인 뒤 GREEN |
| 2026-09-24 16:45 | `e9efda1` | GREEN 11/11 | impl R3-1·M3·M6 — C4 needle 4개 · C11 `CLAUDE_PLUGIN_DATA` 부재/빈 값 케이스(테스트 env에 명시 주입), `4770d6a` 훅에서 C4·C11 RED(pass 9 / fail 2) 확인 뒤 GREEN · 셸 env에서 변수를 빼도 GREEN · 실제 상태 파일 프로브 `GATE_OFF FOREIGN_ACTIVE=0`, 변수 제거 시 `STATE_UNREADABLE` exit 2 |

GREEN 원문:
````
ok 1 - C1 비오르카 최초 넛지 = 고정 문자열
ok 2 - C2 비오르카 재넛지 = 고정 문자열
ok 3 - C3 비오르카(orcaHandle 생략·null·빈 문자열 아님)에는 후계 절차가 없다
ok 4 - C4 오르카 최초 넛지 — (2-0)~(2-5)·폴백·옛 핸들 그대로, '자가 /clear는 불가' 없음
ok 5 - C5 오르카 재넛지 = 최초와 같은 (2) (D6: 지시 동일 + 사실 추가)
ok 6 - C6 오르카 reason 안의 send/wait/close/read/show 전부 --terminal 바인딩(옛 핸들 또는 새 핸들)
ok 7 - C7 판정 로직 불변(orcaHandle 유무와 무관)
ok 8 - C8 E2E ORCA_TERMINAL_HANDLE 유무·안전 문자 집합으로 (2)가 갈린다
ok 9 - C9 40자 초과 작업명에서도 토큰이 온전히 남고 title 정확 조회가 1건
ok 10 - C10 정규화된 제목은 $()·백틱·따옴표가 없어 셸 큰따옴표 안에서 원문 그대로다
ok 11 - C11 STATE_PROBE_CMD는 손상·스키마 이탈 상태를 STATE_UNREADABLE(exit 2)로 차단한다
# tests 11
# pass 11
# fail 0
````

review-loop(impl)에서 훅이 다시 바뀌면 재실행해 이 표에 행을 추가한다.

## 적대검증 ledger (impl)

루프 시작 2026-09-24 · base = origin/main `6731f49`(plan 종결) · 예산 max 5 · confirm 2 · auto 3 · **보안 크리티컬 아님**(사용자 확인 — 일반 트랙). 게이트(npm 없음 → SC-6 + task AC grep): 훅 테스트 GREEN 11/11 · task-01~04 AC 전항 통과(task-02 핸들 정규식 grep은 Claude Code 셸의 ugrep 래퍼에서 0, GNU grep 3.11에서 1 — 도구 차이 · task-01/02 `hook-test` 오탐은 `hook-test-1.0.0/`로 판정 0, 아래 이월). score 산식 = plan 루프와 동일(critical 4 · high 3 · medium 1, §2c 직후·수정 전, 미확인 FIXED 큐 제외). 테스트 기록 = 위 `## 훅 테스트 기록 (AC5, D5)` 절.

| R | 모드 | score | 미확인 FIXED 큐 | 비고 |
|---|---|---|---|---|
| R1 | 적대(자동) | 4 (high 1 · medium 1) | 1 → 2 | verdict needs-attention · 신규 1(R1-1, 즉시 ESCALATE — 데이터 유실군 → 사용자 FIXED `bc958e4`·`3165932`) · 이월 I2 즉시 ESCALATE → 사용자 ACCEPTED(README 보완 `3165932`) · 이월 소항목 7건 batch-pending · plan 이월 큐 1건(`d5ae7c9`) 적대 비재출현(R1, 참고 — 큐 유지) · 루프 직접 판정 0 |
| R2 | 적대(자동) | 1 (medium 1) | 2 → 3 | verdict needs-attention · 신규 1 · FIXED `4770d6a` · 큐 2건(`d5ae7c9`·R1-1) 적대 비재출현(R2, 참고 — 큐 유지) · batch 적재 0(신규) · 루프 직접 판정 0 · 신호 미발화(4→1 감소) |
| R3 | 적대(자동, 경계) | 3 (high 1) | 3 → 8 | verdict needs-attention · 신규 1(R3-1 = 이월 M2와 동일 → 병합) · 소진 3 = auto 경계 → **batch flush**(이월 소항목 7건 + R3-1 일괄 제시, 사용자 판정: FIXED 5 `e9efda1`·`336f19e` · ACCEPTED 2) · 큐 3건 적대 비재출현(R3, 참고 — 큐 유지) · 루프 직접 판정 0 · 신호 미발화(4→1→3) → 정밀 모드 R4. 이월 소항목은 R1부터 SDD minor 등급으로 score 제외, 사용자 FIXED 판정 시 medium으로 재평가해 큐 편입 |
| R4 | 적대(정밀) | 0 | 8 → 8 | verdict **approve** · 신규 0(샌드박스 EROFS/EPERM 개별 명령 실패 — 정적 검토 완료, 유효) · 큐 8건 적대 비재출현(R4, 참고 — 큐 유지) · 소진 4 · **신호 2 발화**(수정 큐 소진) → batch 적재 0 → **확인 모드 진입(C1)** |
| C1 | 확인(일반 1/2) | — | 8 → 0 | 완전 응답(Q1~Q8 전부 명시) · **소멸 8**(plan 이월 `d5ae7c9` · R1-1 · R2-1 · R3-1 · M3 · M6 · AC 오탐 · F6) · 회귀 없음 · 판정 감사 해당 없음(루프 직접 판정 0) · 신규 없음 · **verdict merge-ready: yes** · 확인 소진 1 · 복귀 미사용 |

| fingerprint | severity | disposition | 근거 |
|---|---|---|---|
| plan 이월 · task-06 · [C3 회귀] AC 커밋 제목 검사가 버전 없이 문구만 대조 · `$V` 대조 | medium | FIXED `d5ae7c9`(plan 루프, 사용자 판정) — **미확인(폴백 ① 이월, 확인 라운드 필수 항목)** | plan ledger C3 행 원문 참조 |
| 훅 · [R1-1] 폴백의 후계 /exit(와 뒤따르는 /clear)에 공유 브로커 잡 검사가 없어 다른 세션의 실행 중 codex 잡이 죽음 · 정리 전 queued/running 검사, 활성이면 대기, 조회 실패·상한 초과면 /exit·close·/clear 보류 | high | FIXED `bc958e4` · README 동기 `3165932` (**사용자 판정** 즉시 ESCALATE→FIXED) | codex 1.0.6 `handleSessionEnd`가 세션 무관하게 `loadBrokerSession(cwd)` 브로커를 shutdown함을 소스로 확인. (2-1) 뒤 [폴백] 정리 앞에 `COMPANION_ROOT_CMD; STATE_PROBE_CMD` → FOREIGN_ACTIVE≠0 15초 간격 최대 10분 · 상한·STATE_UNREADABLE·RESOLVE_FAIL → 보류·차단 보고. (2-0) 폴백은 사용자 판정(M4)대로 정리 없이 CLEAR 유지. C4 needle 3개(HEAD 훅 RED → GREEN 11/11) |
| 훅 · [이월 I2] `ORCA_TERMINAL_HANDLE`이 자식 프로세스에 상속되어 오르카 탭 속 중첩 claude(`claude -p`·tmux)가 넛지 시 부모 탭에 /exit | medium | ACCEPTED (**사용자 판정**) · 보완 = README 3종 주의 절 경고 `3165932` | 오르카 `terminal show`에 pid 없음(실측) → 소유 증명 수단 부재 · 발생 조건 드묾 · L1(실측 뒤 성장). 재론 조건 = 실사용에서 중첩 claude 오인 사례 발생 |
| 훅 · [R2-1] 폴백의 빈 후계 정리가 종료 표지+셸 프롬프트를 요구하나 프롬프트 미전달 빈 세션은 표지를 출력하지 않아(실측) 정리·/clear 안내가 항상 차단 · 빈 후계 전용 종료 증거 정의 | medium | FIXED `4770d6a` | SDD 실측(빈 세션 /exit → 셸 프롬프트 복귀·표지 없음·--for exit 31초 timeout) 근거. 폴백 정리 ② = 시간 초과 뒤 read에서 claude 화면 소멸 + 셸 프롬프트 복귀만으로 충분, 옛 세션 종료(첫 동작 ②) 조건 불변. C4 needle 1개(이전 훅 RED → GREEN 11/11) |
| 훅 · [R3-1 = 이월 M2] `CLAUDE_PLUGIN_DATA` 부재 시 companion이 tmpdir 폴백 경로를 해소해 ENOENT → GATE_OFF FOREIGN_ACTIVE=0(fail-open) · 변수 부재·빈 값이면 STATE_UNREADABLE | high | FIXED `e9efda1` (**사용자 판정** batch) | companion 1.0.6 `state.mjs` `FALLBACK_STATE_ROOT_DIR = os.tmpdir()/codex-companion` 확인. 프로브 첫 줄에 변수 검사 → exit 2, (2-0)ⓒ 문면 동기. C11 부재/빈 값 케이스(RED → GREEN), 실제 세션 프로브 정상 경로 불변 |
| 훅 · [이월 M3] 고아 running 잡이면 후계가 매번 10분 대기 후 보고만(원인 잡 불명) · 상한 보고에 잡 id | medium(재평가 ← SDD minor: 수정 반영) | FIXED `e9efda1` (**사용자 판정** batch) | 0번째 동작·폴백 브로커 검사 두 곳의 상한 보고에 해당 queued/running 잡 id·status·sessionId(고아 판단·cancel용). C4 needle 2개 |
| 훅 · [이월 M6] `.remember/successor-*.prompt` 미삭제로 누적 · 전달 확인 뒤 삭제 | medium(재평가 ← SDD minor: 수정 반영) | FIXED `e9efda1` (**사용자 판정** batch) | (2-3) turn_started 확인 뒤 `rm -f`, [폴백]이면 진단용 보존. README 3종 주의 절 "디렉터리와 파일" → 디렉터리(파일은 실패 시에만) 동기. C4 needle 1개 |
| plan · [이월] task-01:325·task-02:400 AC `grep -c 'hook-test'`가 plan 파일명에 걸려 항상 1 · `hook-test-1.0.0/` | medium(재평가 ← SDD Ruling: 수정 반영) | FIXED `336f19e` (**사용자 판정** batch) | 두 줄 패턴 교체, 실행 결과 0 |
| plan · [이월 F6 관찰] 대화가 있는 세션의 /exit 종료 표지(`Resume this session with`) 출력 미관찰 · AC6에 관찰 기록 | medium(재평가: 수정 반영) | FIXED `336f19e` (**사용자 판정** batch) | 질문 문면의 "5행"이 아니라 옛 세션 종료 증거를 다루는 **7행**에 반영(기대값이 I1 수정 전 `--for exit satisfied`만이던 것도 함께 정정 — 시간 초과 뒤 read 종료 표지+셸 프롬프트, 표지 출력 여부 기록). 행 NF 7 확인 |
| 훅 · [이월 M1] `terminal list` title은 Claude Code가 덮어쓴 실시간 제목이라 create 응답 유실 시 토큰 정확 조회 0건 가능 | low(SDD minor) | ACCEPTED (**사용자 판정** batch) | 실패 시 차단 보고(fail-closed) · create 응답 유실 자체가 드묾 · 대체 식별 수단은 새 설계·실측 필요. 재론 조건 = 실사용에서 응답 유실 발생 |
| 훅 · [이월 M5] 첫 동작 전 옛 핸들 목록 부재 = 닫힌 것으로 보고 진행(D9 순서와 다름) | low(SDD minor) | ACCEPTED (**사용자 판정** batch) | 사용자가 옛 탭을 직접 닫는 흔한 경우에 자연스럽고 D9 취지(없으면 진행)와 일치 · 핸들 변경(오르카 재시작) 중 옛 claude 생존은 드묾 |

**이월 소항목 — R1~R3 ESCALATE(batch-pending) → R3 batch flush에서 전부 사용자 판정으로 닫힘(위 표), 원문 = SDD ledger 사본 `.remember/sdd-2026-09-24-orca-successor-session-progress.md`**: M1 `terminal list` title은 Claude Code가 덮어쓴 실시간 제목이라 토큰 정확 조회 0건 가능(실측: 이 세션 탭 제목 "◐ 같은 작업 이어서 진행") · M2 `CLAUDE_PLUGIN_DATA` 부재 시 `/tmp/codex-companion` 폴백으로 GATE_OFF · M3 고아 running 잡이 매번 10분 대기 — 보고에 잡 id · M5 "첫 동작 전 목록 부재 = 진행"이 D9 순서와 다름 · M6 `successor-*.prompt` 미삭제 · task-01:325·task-02:400 AC `grep -c 'hook-test'` 오탐 문면 · F6 관찰: 실제 세션 /exit에 "Resume this session with" 표지 출력 여부.

**확인 모드 진입(C1, 2026-09-24)**: 적대 4라운드 소진(max 5 중) · 신호 2 발화 · 미확인 FIXED 큐 8(plan 이월 `d5ae7c9` · R1-1 · R2-1 · R3-1 · M3 · M6 · AC 오탐 · F6) · 루프 직접 판정 0(임무 ③ 감사 대상 없음 — 전 판정이 사용자 판정) · 확인 예산 2 · 복귀 미사용.

C1 소멸 확인 8건: plan 이월 C3 회귀(`d5ae7c9` — **폴백 ① 이월 필수 확인 항목 해소**) · R1-1 · R2-1 · R3-1(=M2) · M3 · M6 · AC 오탐 · F6.

**종결(2026-09-24)**: 적대 4 + 확인 1 = 총 5라운드(실행 실패 0) · 미확인 FIXED 큐 0 · 미판정 blocking 0 · 최종 verdict approve(C1 merge-ready: yes). score 이력 4 → 1 → 3 → 0(신호 2로 확인 진입). disposition 집계(고유 fingerprint 11, plan 이월 1 포함): FIXED 8(자동 1 R2-1 · 사용자 판정 7) · ACCEPTED 3(I2·M1·M5, 전부 사용자 판정) · DEFERRED_TO_IMPL 0 · OUT_OF_SCOPE 0 · DUPLICATE 0 · low 0. 루프 건강: 재론률 0/11 · 철회 조항 0 · 사람개입률 9/11(이월 소항목이 사용자 판정 대상으로 지정돼 들어온 영향). **task-05 인계**: ACCEPTED 3건의 재론 조건은 각 행에 기재(I2 = 중첩 claude 오인 사례 · M1 = create 응답 유실 발생 · M5 = 해당 없음), README 3종 주의 절에 I2 경고 반영. AC6(task-06) 7행에 종료 표지 출력 관찰 추가(F6). 훅 테스트 최종 GREEN 11/11(`e9efda1`, 위 기록 절).

## AC6 실사용 확인 (트랙 완료 조건, D11) — 릴리스 후 맥북 오르카 세션이 기록

**대상** = 릴리스된 최신 1.0.x **설치본**(최소 1.0.0 — AC6 실패 복구 뒤에는 그 patch, task-06 복구 절차)으로 오르카 터미널에서 도는 **실제 트랙**의 세션 1회(수동 선적용 아님). 넛지 → 핸드오프 → 후계 스폰 → 옛 세션 종료(SessionEnd 정리) → 후계가 review-loop §0 스냅샷 대조로 재개. `CLAUDE_CTX_THRESHOLD`를 낮춰 재현한다(예: `orca terminal create --worktree active --title "ac6-old" --command "CLAUDE_CTX_THRESHOLD=0.05 claude" --json`) — 실 40%까지 기다릴 필요 없다(spec §6).

**설치 버전**: <task-06이 맥북 `/dev-workflow:doctor` 출력의 설치본 버전으로 채운다 — 예 `1.0.0`>

**조건**(F6): ① 넛지 시점에 **다른 탭이 활성**인 상태(후계의 첫 동작이 옛 핸들만 닫는지, R2-1) ② 메타문자 케이스 2종 — (제목, R3-1) 작업명 후보 `ac6 $(echo x) \`id\`` → 제목이 `ac6---echo-x---id--<토큰>`으로 정규화되는지(집합 밖 문자 8개 — 공백·`$`·`(`·공백·`)`·공백·백틱·백틱 — 가 각각 `-` 하나로 치환되고 토큰 앞 하이픈이 붙는다). (전달, R2-2) 재개 프롬프트 **템플릿 자체**가 셸 메타문자를 담고 있다 — CLI 해소식 `$( [ -n "$ORCA_DEV_REPO_ROOT" ] && echo orca-dev || echo orca )`와 companion 해소식 `$(node -e '…' "$P" "$PWD")`. 후계가 받은 프롬프트(`"$CLI" terminal read --terminal "<새 핸들>" --json` 또는 후계 화면)에 이 식들이 **확장되지 않은 원문 그대로**(`CLI="orca"`·경로값으로 바뀐 흔적 없음) 있는지 본다. `<경로>` 슬롯은 review-loop 트랙에서 루프 파일 경로로 고정이라 메타문자를 넣을 수 없다 — 템플릿 내장 식이 spec F6 "경로" 프로브를 대신한다. ③ **필수** — codex 라운드(review-loop 백그라운드 대기) 또는 서브에이전트가 진행 중일 때 넛지가 오면 완료 알림까지 새 단위 없이 기다렸다가 결과 기록 → 스폰 순서를 지키는지(§2i 진행 중 라운드 분기, 파일럿 미측정 3). 재현: 옛 세션을 `CLAUDE_CTX_THRESHOLD=0.05`로 띄우고 review-loop를 시작하면 §0~§2b가 한 턴 안에서 라운드 기동까지 가고 §2b ③ 백그라운드 대기로 턴이 끝나는 그 Stop이 첫 넛지다(통상 경로). 넛지가 라운드 진행 중이 아닌 턴에서 먼저 왔으면 그 세션은 ③ 미충족 — 임계를 올려(예: 0.1) 다시 시작한다. "미발생"으로 넘기지 않는다. **review-loop 대상**(plan R4-3): 이 트랙은 그 시점에 종결돼 있으므로 이 트랙의 plan/impl ledger에 라운드를 추가하지 않는다 — AC6의 루프는 그 시점에 착수하는 **다른 실제 트랙**(후보: 0.18.0 트랙 AC11 실측 후속 · ops-hub 등 다음 작업)의 phase 산출물 문서에서 §0 "loop 파일 없음 → 새 루프"로 연다. 대상은 지금 확정할 수 없다(실사용 조건 D11이 실제 트랙을 요구) — 대신 9행 관찰 열에 repo · phase · ledger 문서 경로 · 해소된 base SHA · 루프 파일 경로(`.remember/loop-<ledger basename>-<phase>.md`)를 적어 재현을 결정적으로 만든다.

| # | 관찰 항목 | 기대 | 관찰(명령 출력·시각) | 결과 |
|---|---|---|---|---|
| 1 | (2-0) 사전 검증·게이트 | `terminal show` ok:true · `GATE_OFF FOREIGN_ACTIVE=0` | | |
| 2 | (2-1) 제목 정규화·토큰 | 제목 `[A-Za-z0-9._-]`만, ≤40, 끝 토큰 온전 · `terminal list` title 정확 1건 | | |
| 3 | (2-2) 기동 대기 | `result.wait.satisfied: true` (90s 이내) | | |
| 4 | (2-3) 전달 | `result.send.prompt.stages`에 `turn_started` · `--retry-request` 사용 여부 | | |
| 5 | (2-5) 옛 세션 정지 | send 뒤 옛 세션 추가 턴 0(재넛지 없음 — `stop_hook_active` 통과) | | |
| 6 | 후계 0번째 동작 | `FOREIGN_ACTIVE=0` 확인 후 진행(대기 발생 시 횟수) | | |
| 7 | 후계 첫 동작 — 옛 핸들만 | `/exit` accepted → `--for exit` satisfied, 또는 시간 초과(보통) 뒤 `terminal read` 끝줄에 종료 표지 `Resume this session with`와 셸 프롬프트 둘 다 — **표지 출력 여부를 관찰 열에 기록**(빈 세션은 표지 없음이 실측, 대화가 있는 세션은 미관찰 — impl 이월 F6) → close ok → list에 옛 핸들 없음 · **활성 탭·다른 탭 무사** | | |
| 8 | SessionEnd 정리 | 옛 세션 codex 상태 디렉터리: `broker.json` 소멸 · 옛 세션 잡 0(파일럿 E5와 동일) | | |
| 9 | §0 대조·라운드 이어감 | 후계가 `/review-loop --resume`(또는 핸드오프)로 §0 스냅샷 통과 · 다음 단위 시작 · 단계 경계면 사용자 확인(D4). 관찰 열에 대상 트랙의 repo · phase · ledger 문서 · base SHA · 루프 파일 경로 기록(이 트랙 ledger 재사용 아님) | | |
| 10 | 메타문자 원문 전달 | 후계가 받은 프롬프트에 CLI 해소식 `$( [ -n "$ORCA_DEV_REPO_ROOT" ] && echo orca-dev … )`(원문은 조건 ② — 셀 안에 세로줄을 쓰지 않는다)·`$(node -e` 원문 그대로 · `CLI="orca"` 등으로 확장된 흔적 없음 · 옛 세션 로컬 실행 흔적 없음 | | |
| 11 | codex 라운드/서브에이전트 진행 중 넛지 (**필수**) | 라운드 진행 중 Stop에서 넛지 → 완료 알림까지 새 단위 없음 → 응답 결과를 루프 파일 `## 미해결 ledger`에 미판정으로, `## 다음 액션`에 수신 라운드 번호·판정 정책(수신 시점 모드)·미처리 단계를 기록 → 스폰(§2i 진행 중 라운드 분기) | | |

- **비고 — 1회차(2026-09-24 17:14~17:22, 1.0.0 설치본) = 실패 1행(2행) → 복구 절차**: 대상 = claude-dev-workflow `docs/specs/2026-09-24-doctor-shallow-clone.md` review-loop(spec), base `3fbc355`, 옛 세션 `91ec3985`(`CLAUDE_CTX_THRESHOLD=0.05`) → 후계 `7466e1c4`(핸들 `term_221a4087…`). **2행 실패**: 제목 정규화는 기대와 일치(`ac6---echo-x---id--172051bqn2`)했으나, 후계 claude가 기동 직후(생성 5초 뒤) 탭 제목을 `Claude Code` → `Review loop 재개 …`로 덮어써 `terminal list` title 정확 조회 = 0건 — create 응답 유실 시 회수 경로가 항상 폴백으로 떨어진다. 수정 = 후계 생성 명령에 `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1`(`ec0d728`, 대화 1턴 뒤에도 제목 유지 실측). 나머지 10행은 기대와 일치: 1 `terminal show` ok:true·`GATE_OFF FOREIGN_ACTIVE=0` · 3 wait satisfied:true(3초) · 4 stages `input_accepted`·`turn_started`, `--retry-request` 미사용 · 5 send 뒤 옛 세션 Stop 1회 무넛지·추가 턴 0 · 6 `FOREIGN_ACTIVE=0` 대기 0회 · 7 `/exit` accepted → `--for exit` 시간 초과 → read 끝줄 `Resume this session with`(대화 있는 세션은 표지 출력 — impl 이월 F6 관찰) + 셸 프롬프트 → close ok → list 0 · 활성 탭(관찰 세션) 무사 · 8 `broker.json` 소멸·jobs 0 · 9 `--resume` §0 스냅샷 통과(main·HEAD `02d0d92`)·R1 판정 착수 · 10 CLI 해소식·`$(node -e` 원문 각 1회, `CLI="orca"` 0회 · 11 R1 진행 중 Stop(17:15:32)에서 넛지 → 완료(17:18:57)까지 새 단위 없음 → R1-1·R1-2 미판정 기록·`## 다음 액션` 수신 라운드 R1·자동 모드·미처리 단계 → 스폰(17:20:51). 부수 관찰(훅 무관): `.remember`가 repo 밖 심링크라 옛 세션 루프 파일 Write에서 권한 확인 1회(사용자 승인 61초) — 이후 `.claude/settings.local.json` `additionalDirectories`로 해소.

- 통과 = 1~11 전부 기대와 일치(11 포함 — 파일럿 미측정 3건은 9·11행이 닫는다, "미발생" 불허). 표 셀 안에 세로줄(`|`)을 쓰지 않는다 — task-06 AC가 `|`로 열을 센다(plan L1). 어느 행이든 폴백이 발생했으면 그 원인·정리 결과(반쪽 터미널 소멸 확인)를 관찰 열에 적고 **통과로 세지 않는다** — 폴백 경로 관찰은 별도 줄(비고)로 남긴다.
- 채워진 뒤 `~/workspace/dev-workflow-eval/report/ORCA-SUCCESSOR-2026-09-24.md` §미측정에 결과를 부기한다(파일럿 미측정 3건 종결 — eval repo 별도 커밋).
- 채우는 절차·주체 = **task-06**(맥북에서 그 세션을 관찰한 사람/후계 세션 — 이 파일 커밋). task-06의 통과 커밋이 **트랙 완료**(dev-cycle 9단계 완료 신호). 결과 열은 `통과`/`실패`만(task-06 AC가 센다).
- spark2·Windows는 트랙 밖(D11 후속) — 각 머신 첫 넛지 때 1·3·4행(`ORCA_TERMINAL_HANDLE` 존재 · `orca`/`ORCA_CLI_COMMAND` 해소 · `--wait-submit` 지원)만 확인하고 실패 시 폴백으로 현행 동작임을 기록한다.

**설치 갱신(4머신) — 순서가 게이트다(plan R4-2)**: ① push(사용자 판단) → ② **맥북만** `/plugin update dev-workflow@claude-dev-workflow` → 재시작 → `/dev-workflow:doctor`(설치본 1.0.0) → ③ task-06(AC6 실사용 확인) 통과 → ④ 나머지 3머신(OMEN `D:\workspace` · 그램 `C:\workspace` · spark2 `~/workspace`) 같은 절차로 갱신. AC6가 실패하면 task-06 복구 절차(원인 수정 → review-loop(impl) 재진입 → patch bump·push → 맥북 갱신 → AC6 재실행; 증거 버전 = 그 patch) → 그 뒤 3머신. project 스코프로 고정된 repo(ops-hub 등)는 그 repo 안에서 `claude plugin update dev-workflow@claude-dev-workflow --scope project`.
