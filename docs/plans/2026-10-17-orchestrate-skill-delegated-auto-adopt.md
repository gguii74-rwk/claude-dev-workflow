# orchestrate 스킬 · 위임 모드 효과 2 (1.2.0) — 구현 계획 엔트리포인트

- **spec**: `docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md` (§3o·§3t·§3w·§3e·§3l·§3d·§3r · AC1~AC9 · D1~D44). **spec ledger = spec 말미 `## 적대검증 ledger (spec)`** — 단일 원본, 여기에 복제하지 않는다(종결: FIXED 19 · ACCEPTED/DEFERRED/OUT_OF_SCOPE 0 → 이월 항목 없음). **plan·impl ledger는 review-loop가 이 문서 말미에 만든다**(`## 적대검증 ledger (plan)` · `## 적대검증 ledger (impl)`). **확인 대기 대장 = spec 말미 · 이 문서 말미 각 1절**(spec §3l — plan·impl phase 행은 이 문서의 `## 확인 대기 대장`). **이 문서에 절을 더할 때(ledger·AC9 기록)는 항상 `## 확인 대기 대장` 앞에 넣는다** — 대장 = 문서의 마지막 절.
- **impl ledger 종결 행 계약(생산자 측 — task-08 게이트 ①이 소비)**: review-loop(impl)는 성공 종료 시 impl ledger 절 안에 `**종결(YYYY-MM-DD)**: `로 시작하는 한 줄을 쓰고, 그 줄에 `미확인 FIXED 큐 0` · `미판정 blocking 0` · `최종 verdict approve`(확인 라운드 없는 빠른 종료면 `빠른 종료`) 세 문구를 그대로 담는다. 하나라도 없으면 task-08 게이트 ①이 0을 내고 멈춘다.
- **Goal**: 메인 세션이 트랙을 오르카 터미널로 운영하는 공통 절차를 플러그인 스킬 `orchestrate`(SKILL.md + 감시·생존·키 스크립트 + 트랙 프롬프트 템플릿)로 넣고, 위임 모드에서 review-loop·dev-cycle이 위험군 외 질문을 추천안으로 자동 채택하되 그 결정을 감사 대상으로 기록·확인 대기 대장에 모으게 한 뒤 1.2.0으로 릴리스한다.
- **Architecture**: 오르카 상세(응답 필드·대기·화면 읽기·키 시퀀스)는 `orchestrate.mjs` 1곳에만 두고 SKILL.md는 절차·라우팅·검증만 말한다(D3). 스크립트는 오르카 응답을 JSON으로 판독하고, 의존 필드가 없으면 조용히 진행하지 않고 exit 2로 멈춘다(D6). 위임 효과 2는 훅이 아니라 review-loop·dev-cycle 문면의 모드 분기다(D2 · 훅 무변경) — review-loop는 새 줄 삽입·줄 끝 덧붙임만 써서 수동 모드 문장 무변경을 기계로 증명한다(D37).
- **Tech stack**: Node ESM(`node:child_process` spawnSync · `node --test` 내장 러너, 외부 의존 없음) · Markdown 스킬 문서 · bash/zsh · Orca CLI 1.4.229(SC-2 사실) · python3(편집 적용 1회용 스크립트 — 커밋되지 않음).
- **경로 = 경량 · 생략 없음**(D4·D19). 3.5 해당없음. 다음 = **6 review-loop(plan)** → 7 impl(SDD, **task-01~07**) → 8 review-loop(impl) → 9 릴리스 1.2.0(**task-08 — SDD 밖**) → push·설치 갱신(사용자 확인) → **AC9 (i) = task-09**(트랙 완료 조건, D20).

> **For agentic workers — execution contract (MUST):** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. This plan is split into per-task files (`<feature>/task-NN-<slug>.md`). Task bodies (Files, TDD steps, AC) are **NOT** in this entrypoint. To execute, MUST: ① read this entrypoint's §Shared Contracts → ② load exactly one target task file → ③ run its steps in order → ④ **record completion**: when the task is **confirmed complete** (reviews approved — SDD's "mark todo complete" sync point; the implementer's DONE report is NOT completion), the dispatcher (the executor itself when running without subagents) immediately — before dispatching the next task — sets that task's row in this entrypoint's task table to `[x]`, writes its one-line outcome, and **commits this entrypoint file on the spot**. **Convergence check (MUST, at all three points — before starting any task, when initializing a resumed/recovered session, and before entering the final whole-branch review):** reconcile this task table against the SDD progress ledger and git log. The authority for "complete" is an **explicit completion record in the SDD progress ledger**; git log only corroborates that a recorded commit exists and was not reverted — an implementation commit by itself is NOT completion (implementer commits exist before review approval). A task whose ledger completion record is missing or ambiguous is **incomplete (fail-closed)** — including a row already marked `[x]`: revert it to `[ ]`. **That rule presumes a live ledger.** A ledger that is absent — or present but holding no completion record for any task while this table already has `[x]` rows — is fresh or lost, not authoritative. (Judge by content, not by the file: SDD's setup recreates an identity-only `progress.md` before reading the plan, so a workspace lost to `git clean -fdx` looks "present"; same after the post-final-review cleanup `rm -rf <workspace>`.) In that state authority falls back to **this committed task table**, which ④ writes only at confirmed completion, with git log corroborating each `[x]` row's commit. Never mass-revert the table over a fresh or lost ledger: revert only a row git log contradicts (no such commit, or reverted), and if the table itself is unreadable, ask your human partner instead of re-dispatching. Rebuild the ledger's completion lines from the surviving table before continuing, so later checks have a live ledger again — but that rebuild restores completion state **only**: a lost ledger may also have held deferred-minor and parked findings with their rulings, which this table never carried, so flag that gap and get your human partner's confirmation before the final whole-branch review instead of presenting the rebuilt ledger as whole. A row filled in but not yet committed is also unconverged: commit it before proceeding. **SDD adapter (`scripts/task-brief` contact point):** a split plan has no "Task N" section, so skip that extraction — **the task file itself is the brief**: pass its full text in the dispatch. Keep the SDD workspace and progress ledger keyed to **this entrypoint** (`scripts/sdd-workspace <entrypoint path>`) — one workspace per plan, never per task file. **No-AI-trace (conditional):** when the repo has a no-AI-trace rule (e.g. its `CLAUDE.md` forbids AI signatures in commits), every dispatch prompt MUST state that commit messages and documents carry no AI tool trace (no `Co-Authored-By` / `Generated with` trailers). Do not start implementing from the entrypoint alone (it has no steps). Do not load all task files at once.
> 확인 시점 각주(블록 밖 — 계약 블록에는 버전을 적지 않는다): `scripts/task-brief`·`scripts/sdd-workspace`는 superpowers 6.3.0 SDD SKILL.md:137·:252에서 실재 확인(2026-09-21). superpowers가 bump돼도 블록은 낡지 않는다.

이 repo의 no-AI-trace 규칙 = 글로벌 `~/.claude/CLAUDE.md`("git commit 메시지에 AI 서명을 절대 포함하지 않는다") — 디스패치 프롬프트마다 명시한다(SC-5).

## 재논의 금지(기결정) — spec에서 승계

> **이번 트랙 확정 결정 = D1~D44**(spec 「재논의 금지(기결정)」 — D1~D18 = 브레인스토밍 B1~B18, D19~D40 = harden H1~H22, D41~D44 = review-loop(spec) 사용자 판정). 적대검증(plan·impl)에서 재론하지 않는다. 상세·근거 = spec §5 표와 spec ledger(복제 금지).

| D | 결정(1줄) |
|---|---|
| D1 | 공통 절차 = 플러그인 스킬 / 프로젝트 고유 = 각 프로젝트, 프로젝트 규약 우선 (B1) |
| D2 | 효과 2 = `DEV_WORKFLOW_MODE=delegated`의 효과, 새 스위치 없음 (B2) |
| D3 | 오르카 명령 상세는 `orca-cli` 참조 + 스크립트 1곳, 본문 복사 금지 (B3) |
| D4 | 경로 경량(접촉 표면 무신호) — 생략 단계는 H1 (B4) |
| D5 | 스킬 비중 순서 = 감시 → TUI 조작 → 라우팅 → 단계 종료 (B5) |
| D6 | 감시 스크립트 동봉 + 자가 점검 실패(exit 2·orca-cli 안내) (B6) |
| D7 | 효과 2 범위 = review-loop + dev-cycle 폴백 입력 (B7) |
| D8 | 대장 = ledger 문서 말미 `## 확인 대기 대장` (B8) |
| D9 | 스킬명 `orchestrate` · 버전 1.2.0 (B9) |
| D10 | 위험군 = 즉시군 ①②③ + 기결정(AC·목표·비목표·D블록) 변경 (B10) |
| D11 | 대장 닫기 = 단계 종료 일괄 + 다음 세션 안전망 (B11) |
| D12 | fail-closed 자동 채택은 안전한 쪽일 때만 (B12 → H3) |
| D13 | 사람 단계 3종은 모드 무관 사람 (B13) |
| D14 | 트랙 모델 = 기동 `--model`만, 배분 Fable/Opus, `/model` 전송 금지 (B14) |
| D15 | send 전 생존 확인(`alive`), 종료 시 `--resume <세션 id>` 복구 (B15) |
| D16 | 질문 창 입력 직전 화면 재확인 (B16) |
| D17 | 자동 채택(위임) = 루프 직접 판정 동격 — 확인 감사 대상 (B17) |
| D18 | 위임 트랙 기동 기본에 `--dangerously-skip-permissions` 포함 (B18) |
| D19 | 5·6 수행 — 생략 없음, impl ledger = plan 말미 (H1) |
| D20 | 완료 조건 = AC9 (i)만, (ii)는 첫 발생 시 기록 (H2) |
| D21 | fail-closed 6곳 위임 = 보고하고 멈춤(안전한 쪽 5요소 + 보고 3항) (H3) |
| D22 | 확인 라운드 ESCALATE도 위험군 기준 (H4) |
| D23 | PERMISSION 부재 시 거부되게 둔다 — 사람만 허용 (H5) |
| D24 | 대장 읽기 = 트랙 ledger 문서 전부(spec + plan) (H6) |
| D25 | 감사 이의 재질문 `[감사 이의]` 표지 + 라우팅표 사용자 행 (H7) |
| D26 | dev-cycle 위임 자동 판정은 경량·정식 모두 대장 행 (H8) |
| D27 | 종료 표지 `[TRACK-DONE <단계> <HEAD>]` → `DONE` (H9) |
| D28 | 수동 트랙 권한 플래그 — 규약 침묵 시 기동 때 1회 질문 (H10) |
| D29 | 기동 전 설치 버전 확인(조회만) (H11) |
| D30 | 대장 상한·정리 규칙 없음 (H12) |
| D31 | 묶음 모순 점검 없음 — 감사에 맡김 (H13) |
| D32 | 메인 컨텍스트 상한 규칙 없음 — 자동 인계가 안전망 (H14) |
| D33 | 기결정 변경 판정 규칙 + 애매하면 묻는다 (H15) |
| D34 | 일시중단 표지 `[TRACK-HANDOFF <경로>]` → `HANDOFF` (H16) |
| D35 | 프롬프트에 review-loop 인자 4종 필수 (H17) |
| D36 | 본문 오르카 허용 = 기동 1줄 + 서브커맨드 이름, AC1 금지 목록 유지 (H18) |
| D37 | AC5 수동 무변경 = 기계 검증(삭제 줄 원문 ⊂ 추가 줄) (H19) |
| D38 | 다중 트랙 허용 — 체크아웃당 1개, 규칙 3줄, 같은 체크아웃 둘 금지 (H20) |
| D39 | 시작 때 메인 모드 자가 점검 1줄 (H21) |
| D40 | 트랙 프롬프트 템플릿 동봉 (H22) |
| D41 | `watch` 표지 소비 판정 = 메인이 처리한 마지막 표지 줄(`--consumed`) — 시작 화면 기준 아님 (review-loop(spec) R2-3 사용자 판정) |
| D42 | 단계 종료 대장 번복 = 단계 미완료 → 그 phase 수정 규칙 + 최종 HEAD 재검증 뒤 완료·push, 수정분 소멸 확인은 다음 phase 루프 큐 승계(impl→릴리스는 새 세션 확인 1회) (R3-2 사용자 판정) |
| D43 | 감사 기회 없는 확인 라운드의 자동 채택 = 채택하되 `감사 미수행(마지막 확인 뒤)` 표시로 단계 종료 대장 확인에 이월 (R3-3 사용자 판정) |
| D44 | 메인 대리 채택의 감사 규칙 = 트랙 프롬프트 템플릿 고정 문구(대리 채택 줄)로 루프 실행 전 적용, 선택 뒤 1줄은 재확인용 (R5-1 사용자 판정) |

**5 plan 단계 사용자 판정(2026-10-18 — 재논의 금지)**:

| P | 결정(1줄) | 근거 |
|---|---|---|
| P1 | 테스트 실행 명령 = `node --test tests/orchestrate/orchestrate.test.mjs`(파일 지정) — spec 5곳 정정 `dfdd243` | 폴더 인자 `tests/orchestrate/`는 Node 21 이상에서 모듈 경로로 해석돼 실패(맥북 Node 26 실측) |
| P2 | README 3종·plugin.json/marketplace.json **description** = 구현 단계(task-07, impl 리뷰 대상) · 릴리스(task-08) = plugin.json **version만** — spec §3r 정정 `dfdd243` | 릴리스 단계에서 쓰면 README가 적대검증을 안 받는다 · 1.1.0·1.0.0 선례 |

**승계 기결정(전제 — 위배 금지)**:

- **1.1.0 spec D1~D12**(`docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md`): D1 `--security` 있으면 묻지 않고 확정·출처 「호출자 지정」·ledger 첫 줄+§4 1줄 · D2 재개 시 저장값 권위 · **D3 모드 변수 `DEV_WORKFLOW_MODE`, trim 후 `delegated` 정확 일치만 위임** · D4 위임 = 훅 `resolveOrcaHandle` null(넛지 = 오르카 밖과 바이트 동일) · D5 훅은 환경변수, 스킬은 인자만 · D6 1.1.0 minor · D7 그 트랙 경량 · **D8 설정 단위 = 트랙 터미널 접두(후계 포함), 메인은 수동** · **D9 모드 정의(수동/위임), 사람 단계 뒤 선택, 향후 오케스트레이션은 이 모드의 효과로** · D10 `--security`는 모드와 독립·`--auto-rounds` 기본값 무변경 · D11 doctor 무변경 · D12 그 트랙 완료 조건.
- **1.1.1 spec D1~D12**(`docs/specs/2026-10-17-skill-positional-arg-substitution.md`): D1 경량 패치 · **D2 셸 블록 표기 = bash `${N}` · awk `$(N)`** · **D3 재발 방지 = 이유 구절 + AC1 grep(맨 `$`+숫자 0건)** · D4 그 트랙 보안 크리티컬 · D5 planless · D6 맥북 설치본 실측 · D7 그 트랙 크기 상한 · D8 실측 격리 조건 · D9 구버전 실측 안 함 · D10 1.1.0 §7 포인터 선례 · D11 §인자 문면 무변경 · D12 `${N}` 치환 변화는 잔여 리스크 기록만.
- **L1~L5**(`~/workspace/dev-workflow-eval/report/LESSONS-2026-08-12.md`) — 특히 L1 규약 성장은 실측 뒤(대장 상한·모순 점검·컨텍스트 절약 규칙 없음 = D30~D32), L3 기본값은 싼 쪽, L5 부정 결과도 산출물(AC9 기록).

## Shared Contracts

### SC-1. 대상 파일 · 약칭 (행 번호 = HEAD `dfdd243` 기준)

| 약칭 | 경로 | 이 plan에서 바꾸는 것 | task |
|---|---|---|---|
| 테스트 | `tests/orchestrate/orchestrate.test.mjs` (repo 루트 — 설치본 밖, M15) | 신규 28건 | 01 |
| 스크립트 | `dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` | 신규 | 02 |
| 템플릿 | `dev-workflow/skills/orchestrate/templates/track-prompt.md` | 신규 | 03 |
| OS | `dev-workflow/skills/orchestrate/SKILL.md` | 신규(≤ 15,360B) | 04 |
| RL | `dev-workflow/skills/review-loop/SKILL.md` (438행, 74,286B) | 새 절 1 + 포인터 13곳(삽입·줄 끝 덧붙임만) | 05 |
| DC | `dev-workflow/skills/dev-cycle/SKILL.md` (100행, 15,327B) | 5곳 | 06 |
| README | `README.md`·`README.ko.md`·`README.ja.md` (각 263행, 같은 행 위치) | 표·목차·절 8 신설·훅 절 9·세션 모드·`--auto-rounds`·트리·개발 절 | 07 |
| manifest | `dev-workflow/.claude-plugin/plugin.json` · `.claude-plugin/marketplace.json` | description(07) · version 1.1.1→1.2.0(08) | 07·08 |
| 1.1.0 spec | `docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md` | §7 끝 포인터 1줄 | 07 |
| spec | `docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md` | :3 단계 줄 | 08·09 |
| 훅 | `dev-workflow/hooks/**` | **무변경**(AC8 — `git diff 151d9f0 -- dev-workflow/hooks` 빈 출력) | — |

### SC-2. `orchestrate.mjs` CLI 계약 (정본 구현 = task-02, 테스트 = task-01, 본문 서술 = task-04·07)

- 호출: `node <Base directory>/scripts/orchestrate.mjs <watch|alive|key> <핸들> …` — `<Base directory>` = 스킬 로드 때 표시되는 「Base directory for this skill」(M14).
- 공통: `--environment <이름>` — 모든 오르카 호출 끝(`--json` 뒤)에 붙인다. CLI 해소 = `ORCA_CLI_COMMAND` → (`ORCA_DEV_REPO_ROOT` 있으면) `orca-dev` → `orca`(M4 — 훅 (2-0)ⓐ와 같다). 오르카 응답은 **exit code가 아니라 JSON**으로 판단(시간 초과·stale도 exit 1 + 정상 JSON). 오르카 호출 1회 상한 8초 — 넘으면 `ERR` exit 2(R1-4).
- **`watch <핸들> [최대초=580] [--consumed <표지 줄>]`**: 시작 때 화면 1회 + idle 1회로 자가 점검 → 첫 화면도 판정(감시 전 도착한 미처리 표지·열린 질문은 즉시) → 20초 간격(M5). 상한(최대초)은 시작 자가 점검부터 잰다(R1-4). stdout 첫 줄 = `DONE` | `HANDOFF` | `SETTLED` | `QUESTION` | `PERMISSION` | `TIMEOUT`(exit 0); DONE·HANDOFF는 둘째 줄 = 표지 줄(앞 공백·응답 글머리 `⏺`·`●` 뗀 값); 이어서 화면 마지막 70줄. 실패 = `ERR <메시지>` exit 2.
  - 본문 = 끝에서 둘째 `────` 구분선(프롬프트 박스 윗선) 위 줄들(박스 없으면 전체) − 스피너 줄(`✻ ✶ ✳ ✢ · ✽ *` 시작).
  - 우선순위: 표지(본문의 **마지막 비어 있지 않은 줄**이 `[TRACK-DONE `/`[TRACK-HANDOFF `로 시작 — 단 `--consumed`와 같고 본문이 시작값에서 안 바뀌었으면 소비됨, D41) > `QUESTION`(「Enter to select」 또는 「to navigate」) > `PERMISSION`(「could not be checked」·「Do you want to proceed」·「Yes, and don't ask again」) > `SETTLED`(본문 해시가 시작값에서 **바뀐 뒤** 직전 읽기와 같고 idle 만족) > `TIMEOUT`.
- **`alive <핸들>`**: stdout 1줄. `ALIVE …` exit 0(연결·쓰기 가능 + 화면에 프롬프트 박스(마지막 두 구분선 사이 `❯` 줄) 또는 질문·권한 창(창 문구 뒤 마지막 줄이 셸 프롬프트면 제외 — R1-1·R1-3) + 박스 아래 종료 표지 없음) · `EXITED …` exit 1(미연결·고아, 또는 마지막 구분선 **아래**에 「Resume this session with」 + 그 뒤 마지막 줄이 셸 프롬프트 `/[%$#>]\s*$/`) · `UNREADABLE … 종료로 보지 않는다` exit 2(쓰기 불가 · 어느 쪽도 확정 불가) · `STALE …` exit 3(`terminal_handle_stale`) · `ERR …` exit 2.
- **`key <핸들> <키…>`**: 키 = `enter`(`--enter` 플래그) · `tab`(`\t`) · `shift-tab`(`\x1b[Z`) · `up`(`\x1b[A`) · `down`(`\x1b[B`) · `text <문자열>`(`--text <원문>` — argv 직접, 셸 보간 없음). 키마다 `alive` 판정 0 확인(아니면 `ERR 전송 중단 — <보낸 수>/<전체>개 …` exit 2, 나머지 미전송 — R1-2) → `terminal send` 1회 + 300ms 간격, 영수증 `result.send.accepted !== true`면 `ERR` exit 2. 성공 = `SENT <n>` exit 0.
- **자가 점검 메시지**: 의존 필드(`result.terminal.tail` 배열 · `result.wait.satisfied` boolean(또는 `error.code` `timeout`) · `result.terminal.connected`/`writable`/`orphaned` boolean)가 없거나 JSON 파싱 실패 → `ERR orca 응답 형식이 스크립트와 다릅니다 — \`orca skills get orca-cli\`를 참조해 scripts/orchestrate.mjs의 필드명을 갱신하세요(필드: <누락 필드>)`. 화면 출처 `source`가 `screen`이 아니면 → `ERR 렌더링 화면을 읽지 못했다(source=<값|없음>) — 종료로 보지 않는다`.
- 환경변수 `ORCHESTRATE_INTERVAL_MS`·`ORCHESTRATE_CALL_TIMEOUT_MS` = **테스트 전용** 감시 간격·호출 상한(테스트는 20ms·3000ms). 운영 문서에 쓰지 않는다.

### SC-3. 표지 · 출처 · 대장 문자열 정본 (템플릿·SKILL.md·review-loop·dev-cycle·README가 그대로 쓴다)

- 종료 표지(응답 **마지막 줄**): `[TRACK-DONE 〈단계〉 〈HEAD 7자리〉]` · 일시중단: 끝 두 줄 = `사유: 넛지 | 사용자 중단 | 폴백②`(하나만) + `[TRACK-HANDOFF 〈재개 파일 경로〉]`.
- ledger disposition 뒤 출처: `(추천 자동 채택(위임))` · focus·ledger 표시: `[자동 채택(위임)]` · 감사 이의 재질문 접두: `[감사 이의]` · 감사 기회 없음: `감사 미수행(마지막 확인 뒤)`.
- 대장 절: `## 확인 대기 대장`(문서당 1절, 문서 마지막) · 행: `| # | 일시 | phase·지점 | 질문 요지(쉬운 말 1줄) | 채택 선택지 | 출처 | 상태 |` · 출처 = `추천 자동 채택(위임)` · 상태 = `확인 대기` → `확인 (<날짜>, <단계 종료 보고 | 다음 세션 시작 | 트랙 종결 보고 | 감사 이의 재판정>)` | `번복 (<날짜>[, 감사 이의 재판정]) → <처리 커밋>`(소멸 확인 뒤 `· 확인됨(<라운드>)`) · 비면 「해당 없음」 1줄.
- §4 종료 요약 1줄: `추천 자동 채택(위임) N건(감사 미수행 m건) — 대장 참조` 또는 `해당 없음`.

### SC-4. 게이트 명령 (repo에 npm 게이트 없음 — review-loop(impl) §1 impl 게이트는 이 묶음으로 갈음)

```bash
node --test tests/orchestrate/orchestrate.test.mjs                       # T1 — 28/28 (폴더 인자 금지, P1)
node --check dev-workflow/skills/orchestrate/scripts/orchestrate.mjs     # T2
env -u DEV_WORKFLOW_MODE HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs      # T3a — 11/11
env -u DEV_WORKFLOW_MODE HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.1.0/context-threshold-hook.mode.test.mjs # T3b — 2/2
git diff 151d9f0 -- dev-workflow/hooks | wc -l                            # T4 — 0 (AC8)
grep -nE '\$[0-9]' dev-workflow/skills/*/SKILL.md dev-workflow/skills/orchestrate/templates/*.md | wc -l   # T5 — 0 (AC4)
```

- T3은 **`env -u DEV_WORKFLOW_MODE` 필수** — 위임 트랙 세션(`DEV_WORKFLOW_MODE=delegated`)에서 그대로 돌리면 C8이 실패한다(10/11, 2026-10-18 실측 — 변수가 테스트 자식 프로세스로 샌다. 결함 아님). 기준선 파일은 git 미추적(md5 `be80d4e7…` · `129d9be9…`).
- T6 = AC5 수동 무변경 기계 검증(task-05 단계 4 — 1회용, repo 상설 스크립트 아님).

### SC-5. 커밋 규칙

- main 직접 커밋(워크트리·MR 없음). **push 금지**(공개 배포 = 사용자 확인).
- AI 서명·트레일러(`Co-Authored-By`·`Generated with`·`Claude-Session`) 금지 — 글로벌 no-AI-trace 규칙.
- 접두: `test(orchestrate)`·`feat(orchestrate|review-loop|dev-cycle)`·`docs(readme|spec|plan)`·`release:` — 메시지 본문은 한국어, 끝에 spec 절·AC 참조.
- task당 1커밋(07은 2커밋) + 완료 기록 커밋(계약 ④).

## Task table

| # | title | status | file | deps | outcome |
|---|-------|--------|------|------|---------|
| 01 | orchestrate.mjs 계약 테스트 28건 (RED) | [ ] | [task-01](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-01-orchestrate-test-red.md) | — | |
| 02 | orchestrate.mjs watch·alive·key (GREEN) | [ ] | [task-02](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-02-orchestrate-script.md) | 01 | |
| 03 | 트랙 프롬프트 템플릿 | [ ] | [task-03](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-03-track-prompt-template.md) | — | |
| 04 | orchestrate SKILL.md | [ ] | [task-04](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-04-orchestrate-skill-md.md) | 02, 03 | |
| 05 | review-loop 위임 모드 효과 2 + 확인 대기 대장 | [ ] | [task-05](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-05-review-loop-delegated.md) | — | |
| 06 | dev-cycle 위임 = 확인 불가 신호 ② | [ ] | [task-06](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-06-dev-cycle-delegated.md) | 05 | |
| 07 | README 3종 · manifest description · 1.1.0 §7 포인터 | [ ] | [task-07](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-07-readme-manifest-pointer.md) | 04, 05, 06 | |

**구현 순서** = spec §3r 끝 줄(스크립트+테스트 → 템플릿 → SKILL.md → review-loop → dev-cycle → README·manifest 설명 → 1.1.0 spec 포인터) — 표 번호 순서로 디스패치한다.

**AC ↔ task**: AC1 → 03(템플릿)·04(SKILL.md) · AC2·AC3 → 01·02 · AC4 → 02(`node --check`)·03·04(`$N`)·SC-4 T5 · AC5 → 05 · AC6 → 06 · AC7 → 07 · AC8 → SC-4 T3·T4(01·02 회귀 단계 + 08 게이트) · AC9 → 09.

**SDD 실행 범위 = 위 표(task-01~07) 전부.** 위 표가 전건 `[x]`이면 7 impl 완료다(dev-cycle 7단계 「entrypoint task 표의 완료 기록 전건」 = 이 표 — 아래 「SDD 밖 task」 표는 판별 대상이 아니다).

**review-loop(impl) 입도**: 통합 1회(task-01~07). base = 구현 착수 직전 main SHA(plan 루프 종결 커밋). **§1 impl 게이트 = SC-4 T1~T5**(npm 4종 대신 — repo에 npm 없음). 보안 판정은 기동 전 사용자 1회 확인(D35) — spec 루프는 `no (호출자 지정)`였다.

## SDD 밖 task (9단계 이후 — dev-cycle 7단계 판별·SDD convergence 대상 아님)

| # | title | status | file | deps | outcome |
|---|-------|--------|------|------|---------|
| 08 | 릴리스 1.2.0 — **9단계, SDD 디스패치 대상 아님** | [ ] | [task-08](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-08-release-1-2-0.md) | 01~07 + review-loop(impl) 종결 | |
| 09 | AC9 (i) 실측 기록 — **트랙 완료 조건, SDD 디스패치 대상 아님** | [ ] | [task-09](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-09-ac9-field-run.md) | 08 + push + 설치 갱신 | |

task-08(릴리스)·task-09(AC9 실측)는 9단계 이후라 SDD가 디스패치하지 않는다 — 8 review-loop(impl)가 성공 종결(이 문서 말미 impl ledger 종결 행)한 뒤 그 세션 또는 새 세션이 task-08을, 릴리스·push·설치 갱신 뒤 기록 세션이 task-09를 단독 실행한다. **위 Task table과 따로 두는 이유** = dev-cycle 7단계가 「entrypoint task 표의 완료 기록 전건」으로 7 완료를 판별해, 같은 표에 두면 01~07이 끝나도 7 미완으로 읽힌다(plan ledger R1-5) — 완료 기록(status·outcome)은 이 표에서 받는다. **task-08·09의 완료 권위 = 이 커밋된 표 + 각 task의 AC**(SDD progress ledger에 기록하지 않는다 — 계약 블록의 convergence 규칙(「ledger 완료 기록 부재 → `[ ]` 복원」)은 Task table(task-01~07)에만 적용한다). 실행자는 완료 시 표 행 `[x]`·outcome을 쓰고 이 파일을 즉시 커밋한다. task-09 착수나 어떤 복구 절차도 task-08 행을 되돌리지 않는다. 트랙 완료 = 09행 `[x]`.

**트랙 밖(여기서 하지 않는다)**: ops-hub `orca-worktree-ops`·CLAUDE.md 정리(spec §7 — 9단계 안내만) · Windows 오르카 실측 · 번복률 재측정(eval repo) · 나머지 머신 `/plugin update`(사용자 확인).

## 확인 대기 대장

해당 없음.
