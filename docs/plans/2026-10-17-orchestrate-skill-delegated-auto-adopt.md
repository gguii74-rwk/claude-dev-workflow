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
| 테스트 | `tests/orchestrate/orchestrate.test.mjs` (repo 루트 — 설치본 밖, M15) | 신규 38건 | 01 |
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
- 공통: `--environment <이름>` — 모든 오르카 호출 끝(`--json` 뒤)에 붙인다. CLI 해소 = `ORCA_CLI_COMMAND` → (`ORCA_DEV_REPO_ROOT` 있으면) `orca-dev` → `orca`(M4 — 훅 (2-0)ⓐ와 같다). 오르카 응답은 **exit code가 아니라 JSON**으로 판단(시간 초과·stale도 exit 1 + 정상 JSON). 오르카 호출 1회 상한 8초 — 넘으면 SIGKILL로 끊고 `ERR` exit 2(SIGTERM 무시 CLI 포함, R1-4·R2-3).
- **`watch <핸들> [최대초=580] [--consumed <표지 줄>]`**: 시작 때 화면 1회 + idle 1회로 자가 점검 → 첫 화면도 판정(감시 전 도착한 미처리 표지·열린 질문은 즉시) → 20초 간격(M5). 상한(최대초)은 시작 자가 점검부터 잰다(R1-4). stdout 첫 줄 = `DONE` | `HANDOFF` | `SETTLED` | `QUESTION` | `PERMISSION` | `TIMEOUT`(exit 0); DONE·HANDOFF는 둘째 줄 = 표지 줄(앞 공백·응답 글머리 `⏺`·`●` 뗀 값); 이어서 화면 마지막 70줄. 실패 = `ERR <메시지>` exit 2.
  - 본문 = 끝에서 둘째 `────` 구분선(프롬프트 박스 윗선) 위 줄들(박스 없으면 전체) − 스피너 줄(`✻ ✶ ✳ ✢ · ✽ *` 시작).
  - 우선순위: 표지(본문의 **마지막 비어 있지 않은 줄**이 `[TRACK-DONE `/`[TRACK-HANDOFF `로 시작 — 단 `--consumed`와 같고 본문이 시작값에서 안 바뀌었으면 소비됨, D41) > `QUESTION`·`PERMISSION` = 화면 **맨 아래** 창 문구 줄의 종류(QUESTION 「Enter to select」 또는 「to navigate」 · PERMISSION 「could not be checked」·「Do you want to 」(proceed·make this edit·create·overwrite·allow 권한 창 전체)·「Yes, and don't ask again」·「Yes, allow 」 — 한 줄에 둘 다면 권한; 위의 문구는 본문 인용 — `alive` 창 종류와 같은 규칙·공용 헬퍼, 7 impl 사전 점검 F3 사용자 판정) > `SETTLED`(본문 해시가 시작값에서 **바뀐 뒤** 직전 읽기와 같고 idle 만족) > `TIMEOUT`.
- **`alive <핸들>`**: stdout 1줄. `ALIVE …` exit 0(연결·쓰기 가능 + 화면에 프롬프트 박스(마지막 두 구분선 사이 `❯` 줄) 또는 질문·권한 창 + 박스 아래 종료 표지 없음 — 입력 요소 뒤 마지막 줄이 셸 프롬프트 모양이면(박스는 HUD 구분자 `│`도 없을 때) 제외, R1-1·R1-3·R2-1) · `EXITED …` exit 1(미연결·고아, 또는 마지막 구분선 **아래**에 「Resume this session with」 + 그 뒤 마지막 줄이 셸 프롬프트 `/[%$#>]\s*$/`) · `UNREADABLE … 종료로 보지 않는다` exit 2(쓰기 불가 · 어느 쪽도 확정 불가) · `STALE …` exit 3(`terminal_handle_stale`) · `ERR …` exit 2.
- **`key <핸들> <키…>`**: 키 = `enter`(`--enter` 플래그) · `tab`(`\t`) · `shift-tab`(`\x1b[Z`) · `up`(`\x1b[A`) · `down`(`\x1b[B`) · `text <문자열>`(`--text <원문>` — argv 직접, 셸 보간 없음). 키마다 `alive` 판정 0 + 화면 종류(프롬프트 박스·질문 창·권한 창 — 종류 = 화면 맨 아래 입력 요소: 창 문구가 박스 아래 구분선보다 아래면 창, R3-1·R4-1)가 첫 키 때와 같음 확인(아니면 `ERR 전송 중단 — <보낸 수>/<전체>개 …` exit 2, 나머지 미전송 — R1-2·R2-2) → `terminal send` 1회 + 300ms 간격, 영수증 `result.send.accepted !== true`면 `ERR` exit 2. 성공 = `SENT <n>` exit 0.
- **자가 점검 메시지**: 응답 루트가 객체가 아니거나(`null` 등) 의존 필드(`result.terminal.tail` 배열 · `result.wait.satisfied` boolean(또는 `error.code` `timeout`) · `result.terminal.connected`/`writable`/`orphaned` boolean)가 없거나 JSON 파싱 실패 → `ERR orca 응답 형식이 스크립트와 다릅니다 — \`orca skills get orca-cli\`를 참조해 scripts/orchestrate.mjs의 필드명을 갱신하세요(필드: <누락 필드>)`. 화면 출처 `source`가 `screen`이 아니면 → `ERR 렌더링 화면을 읽지 못했다(source=<값|없음>) — 종료로 보지 않는다`.
- 환경변수 `ORCHESTRATE_INTERVAL_MS`·`ORCHESTRATE_CALL_TIMEOUT_MS` = **테스트 전용** 감시 간격·호출 상한(테스트는 20ms·3000ms). 운영 문서에 쓰지 않는다.

### SC-3. 표지 · 출처 · 대장 문자열 정본 (템플릿·SKILL.md·review-loop·dev-cycle·README가 그대로 쓴다)

- 종료 표지(응답 **마지막 줄**): `[TRACK-DONE 〈단계〉 〈HEAD 7자리〉]` · 일시중단: 끝 두 줄 = `사유: 넛지 | 사용자 중단 | 폴백②`(하나만) + `[TRACK-HANDOFF 〈재개 파일 경로〉]`.
- ledger disposition 뒤 출처: `(추천 자동 채택(위임))` · focus·ledger 표시: `[자동 채택(위임)]` · 감사 이의 재질문 접두: `[감사 이의]` · 감사 기회 없음: `감사 미수행(마지막 확인 뒤)`.
- 대장 절: `## 확인 대기 대장`(문서당 1절, 문서 마지막) · 행: `| # | 일시 | phase·지점 | 질문 요지(쉬운 말 1줄) | 채택 선택지 | 출처 | 상태 |` · 출처 = `추천 자동 채택(위임)` · 상태 = `확인 대기` → `확인 (<날짜>, <단계 종료 보고 | 다음 세션 시작 | 트랙 종결 보고 | 감사 이의 재판정>)` | `번복 (<날짜>[, 감사 이의 재판정]) → <처리 커밋>`(소멸 확인 뒤 `· 확인됨(<라운드>)`) · 비면 「해당 없음」 1줄.
- §4 종료 요약 1줄: `추천 자동 채택(위임) N건(감사 미수행 m건) — 대장 참조` 또는 `해당 없음`.

### SC-4. 게이트 명령 (repo에 npm 게이트 없음 — review-loop(impl) §1 impl 게이트는 이 묶음으로 갈음)

```bash
node --test tests/orchestrate/orchestrate.test.mjs                       # T1 — 38/38 (폴더 인자 금지, P1)
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
| 01 | orchestrate.mjs 계약 테스트 38건 (RED) | [x] | [task-01](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-01-orchestrate-test-red.md) | — | `a7c37d0` 테스트 37건 RED(0/37) · 기준선 11/11·2/2 · 리뷰 승인(minor 3 이월) |
| 02 | orchestrate.mjs watch·alive·key (GREEN) | [x] | [task-02](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-02-orchestrate-script.md) | 01 | `e85a92c` 스크립트 · 리뷰 fix 1회 `dbd59c5`(사용자 판정 — 권한 문구 `Do you want to `·`Yes, allow `, 테스트 38) · `6976fc2` plan·spec 38 정합 · GREEN 38/38 · 기준선 11/11·2/2 · hooks diff 0 · minor 7 이월 |
| 03 | 트랙 프롬프트 템플릿 | [x] | [task-03](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-03-track-prompt-template.md) | — | `4e987b8` 템플릿(필수 9항목·고정 절) · 검증 bash·zsh 동일 · `$N` 0 · 리뷰 승인(minor 2 이월) |
| 04 | orchestrate SKILL.md | [x] | [task-04](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-04-orchestrate-skill-md.md) | 02, 03 | `a960117` SKILL.md · 리뷰 fix 1회 `0df3076`(사용자 판정 — 후계·복구 기동 = 원래 기동 명령(접두·권한 플래그·`--model`)) · `c23de6d` task-04·spec §3o·AC1 정합 · 15,313B · AC1·AC4 bash·zsh 통과 · minor 5 이월 |
| 05 | review-loop 위임 모드 효과 2 + 확인 대기 대장 | [x] | [task-05](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-05-review-loop-delegated.md) | — | `42c4ac4` 새 절 + 포인터 13곳 · 리뷰 fix 1회 `ac930e5`(사용자 판정 — 판정 감사 이의 재판정은 루프 직접 판정·자동 채택 모두 사람에게, D22 예외) · `0d9f236` task-05·spec §3e 정합 · AC5 기계 검증 DEL 3 BAD 0 · minor 4 이월 |
| 06 | dev-cycle 위임 = 확인 불가 신호 ② | [x] | [task-06](2026-10-17-orchestrate-skill-delegated-auto-adopt/task-06-dev-cycle-delegated.md) | 05 | `54d2b75` dev-cycle 5곳(위임 = 확인 불가 신호 ② · 대장 행 · 판별 출력) · AC6 bash·zsh 통과 · 리뷰 승인(minor 3 이월) |
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

## 적대검증 ledger (plan)

보안 크리티컬: no (호출자 지정) — 접촉면 권한 감지(위임 트랙 기동 기본 `--dangerously-skip-permissions`, D18 · PERMISSION 창 전달)

- 루프: base `151d9f0`(151d9f0ec1abe1a6ad62ba3684297038faeedf2f, 호출자 지정 — origin/main은 이미 리뷰 대상 커밋을 포함) · 예산 max 5 · confirm 2 · auto 3 · 위임 모드 세션(설치본 1.1.1 — 효과 2 없음, 질문은 사용자 직접).
- 사전 게이트: 형식 관문 ①②④ = repo에 CLAUDE.md 분할 규약 없음 → 스킵(참고: Execution contract 블록은 설치본 writing-plans-split canonical과 바이트 동일 · §Shared Contracts · status·outcome 컬럼 실재) · ③ spec ledger fingerprint 컬럼 실재.
- score 산식 = 전환용(미확인 FIXED 큐 제외, §2c 분류 직후·수정 전 스냅샷).

| 라운드 | 모드 | HEAD | critical/high/medium (신규/잔존) | 전환용 score | 미확인 FIXED 큐 | verdict |
|---|---|---|---|---|---|---|
| R1 | 적대·자동 | `44184c3` | 0/2/3 (신규 5/잔존 0) | 9 | 0 → 5 | needs-attention |
| R2 | 적대·자동 | `27b13c4` | 0/2/1 (신규 3 — 전부 R1 계열 2회째/잔존 0) — R1 FIXED 5건 적대 비재출현(R2), 큐 유지 | 7 | 5 → 7 | needs-attention |
| R3 | 적대·자동 | `7eafe16` | 0/1/2 (신규 2 = R3-1(R2-2 계열 3회째)·R3-2 / 잔존 1 = R3-3 → R2-3 재지목) — R1·R2 FIXED 7건 적대 비재출현(R3), 큐 유지 | 5 | 7 → 10 | needs-attention |
| R4 | 적대·정밀 | `62423d2` | 0/1/1 (신규 2 = R4-1(화면 판독 계열 4회째)·R4-2 / 잔존 0) — 큐 10건 적대 비재출현(R4), 큐 유지 | 4 | 10 → 12 | needs-attention |
| R5 | 적대·정밀 | `35474d8` | 0/0/1 (신규 1/잔존 0) — 큐 12건 적대 비재출현(R5), 큐 유지 | 1 | 12 → 13 | needs-attention |
| C1 | 확인(예산 1/2) | `26bbc1e` | 신규 0 · 잔존 0 · 감사 1건(R3-3) 이상 없음 | — | 13 → 0 | **pass** |

| # | fingerprint (file · title · recommendation 요지) | severity | disposition | 근거 |
|---|---|---|---|---|
| R1-1 | task-02 alive · 잔존 질문 문구만으로 셸을 살아 있는 claude로 판정(질문 화면 뒤 셸 프롬프트) · 과거 문구와 현재 입력 화면 구분, 창 뒤 셸 프롬프트면 exit 2 + 회귀 테스트 | high | FIXED `0de6f7b` | 질문·권한 창 = 창 문구 뒤 마지막 줄이 셸 프롬프트면 생존 아님 → exit 2 · 박스 화면은 HUD(`Context 17%`) 끝 문자 충돌로 검사 제외(Cautions — 검증 필요(실측)) · 테스트 +1 · SC-2·spec §3w·AC3 |
| R1-2 | task-02 key · 다중 키 전송 중 생존 확인 없이 다음 입력 전송 · 각 send 직전 alive 재검사, 0 아니면 중단 + 중간 종료 테스트 | high | FIXED `0de6f7b` | key = 키마다 alive 0일 때만 send, 아니면 `ERR 전송 중단 — n/m` exit 2 · key 테스트 send만 대조 + show 4회 · 중간 종료 테스트 +1 · task-04 SKILL.md (a) 1구절(15,147B) · SC-2·spec §3w·AC3 |
| R1-3 | task-02 alive · 권한 창(PERMISSION)에서 alive exit 2 → 사용자 승인도 전달 불가 · 권한 창을 입력 상태로 인정 + P 화면 alive 0 검증, 무인 자동 승인 금지 유지 | medium | FIXED `0de6f7b` | 권한 창 패턴도 입력 창(R1-1 조건 동일) · 테스트 +1 · D23(부재면 거부되게 둔다) 불변 · SC-2·spec §3w·AC3 |
| R1-4 | task-02 orca() · spawnSync timeout 없음 → 멈춘 CLI가 watch 최대초 무력화 · 모든 호출에 유한 timeout + 상한을 시작 자가 점검부터 + 무응답 스텁 테스트 | medium | FIXED `0de6f7b` | 호출 상한 8초(`ORCHESTRATE_CALL_TIMEOUT_MS` 테스트 전용) · deadline = 시작부터, 대기 = min(간격, 남은 시간) → 최악 ≈ 596초 < 메인 대기 600초 · 가짜 orca `hang` · 테스트 +1 · SC-2·spec AC2 |
| R2-1 | task-02 alive 박스 분기 · 종료 안내 없이(SIGKILL) 박스·셸 프롬프트가 남은 화면을 생존으로 판정 → key text·enter가 셸로 · HUD와 셸 복귀 구분, 확정 못 하면 exit 2 + 회귀 테스트 | high | FIXED `be73cc8` (사용자 — 즉시 ESCALATE 닫음) | **R1-1과 같은 계열 2회째**(alive 잔존 화면 오판) + 셸 실행 = 데이터 손상 경로 → 즉시 ESCALATE. 사용자 판정 = 추천안 「규칙 추가 후 고친다」: 박스 아래 마지막 줄이 셸 프롬프트 모양 + HUD 구분자 `│`(`HUD_MARK` 상수) 없음 = 판독 불가 · 구분자 없는 상태줄 환경은 exit 2(안전한 쪽, 실측 때 상수 갱신) · 테스트 +1 · SC-2·spec §3w·AC3 |
| R2-2 | task-02 key · 키 묶음 도중 화면이 바뀌어도(사용자 직접 응답 → 권한 창) 남은 enter 전송 = 권한 자동 승인 · 키마다 예상 화면 상태 검증 또는 한 키씩 + 전환 테스트 | high | FIXED `be73cc8` (사용자 — 즉시 ESCALATE 닫음) | **R1-2와 같은 계열 2회째**(key 묶음 중간 검증) + 권한 경계(D23) → 즉시 ESCALATE. 사용자 판정 = 추천안 「창 종류가 바뀌면 멈춘다」: alive가 화면 종류(프롬프트 박스·질문 창·권한 창)를 함께 돌려주고 key는 첫 키 때 종류와 다르면 나머지 미전송 `ERR 전송 중단` · 테스트 +2(질문→권한 · 질문→박스) · task-04 (a) 구절(15,209B) · SC-2·spec §3w·AC3 |
| R2-3 | task-02 orca() · spawnSync timeout은 SIGTERM 뒤 자식 종료를 기다려 SIGTERM 무시 CLI면 상한 무력 · `killSignal: 'SIGKILL'` 등 강제 종료 + SIGTERM 무시 가짜 orca 테스트 | medium | FIXED `ec6ecf3` (사용자 — batch R3 뒤, ESCALATE 닫음) | **R1-4와 같은 계열 2회째**(오르카 호출 상한) → 자동 수정 중단·사용자 판정(R3 뒤 batch). 사용자 판정 = 추천안 「지금 고친다」: `killSignal: 'SIGKILL'` + 가짜 orca `ignoreTerm`(15초 자진 종료 — 고아 방지) + 경과 시간 < 10초 단언(자진 종료와 구분) · 테스트 +1 · SC-2·spec §3w·AC2 |
| R3-1 | task-02 alive 화면 종류 · kind를 화면 전체의 권한 문구로 판정 → 본문에 권한 문구를 인용한 질문이 처음부터 「권한 창」이라 실제 권한 창 전환을 못 잡고 enter 전송 · 활성 입력창 영역으로 판정, 구별 못 하면 exit 2 + 회귀 테스트 | high | FIXED `ec6ecf3` (사용자 — 즉시 ESCALATE 닫음) | **R2-2와 같은 계열 3회째**(key 묶음 화면 변화) + 권한 경계(D23) → 즉시 ESCALATE(batch 제시와 함께). 사용자 판정 = 추천안 「맨 아래 창 문구로 정한다」: 창 종류 = 화면에서 가장 아래 창 문구(질문 꼬리말/권한 문구)의 종류 · 테스트 +1(QP → P) · 「둘 다 보이면 멈춘다」·ACCEPTED 대안 기각 · SC-2·spec §3w·AC3 |
| R3-2 | task-08 게이트 ② · impl 종결 뒤 단계 종료 번복 수정이 새 세션 확인 전이어도 게이트 통과(종결 행 1 · 확인 대기 0) → 미확인 수정 릴리스 · 번복 행 중 `확인됨` 없는 행 검사, 확인 전 버전 변경 차단 | medium | FIXED `9c5ff38` | 게이트 ② 둘째 줄 = `확인됨(` 없는 `번복 (` 행 수 → 0이어야 릴리스 · 임시 사본으로 1 → 확인됨 붙이면 0 실측(bash·zsh) · Cautions 1줄 · 부수 정정 = 릴리스 커밋 문구 「테스트 24/24」 → 현행 수 |
| R3-3 | task-02 orca() · SIGTERM 무시 CLI면 호출 상한 무력(ledger R2-3과 동일 — codex 스스로 명시) | medium | DUPLICATE → R2-3 `[루프 판정]` | 원 지적·권고 동일(R2-3 batch-pending 중 재지목) · 원 disposition = R2-3(batch R3 뒤 사용자 판정 FIXED `ec6ecf3`) — 확인 임무 ③ 우선 감사 대상(오매칭 여부만) |
| R4-1 | task-02 alive 박스 우선 분기 · 본문에 인용된 `──── / ❯ / ────` 박스가 아래 실제 질문·권한 창을 가려 종류 = 항상 박스 → 질문→권한 전환을 못 잡고 enter 전송 · 박스·창 문구 위치 비교로 아래 활성 요소가 종류 결정 + 회귀 테스트 | high | FIXED `b243093` (사용자 — 즉시 ESCALATE 닫음) | **화면 판독 우회 계열 4회째**(R1-1→R2-1→R3-1→R4-1) + 권한 경계(D23) → 즉시 ESCALATE. 사용자 판정 = 추천안 「더 아래 요소로 정한다」: 창 문구가 마지막 구분선보다 아래면 박스 = 본문 인용(R3-1과 같은 「활성 요소 = 맨 아래」 원리) · 테스트 +1 · 「창에는 키 하나씩」·ACCEPTED 대안 기각, 남은 우회는 AC9 실측 몫 · SC-2·spec §3w·AC3 |
| R4-2 | task-04 메인 라우팅표 · task-07 README 3종 · 위험군에서 비목표 변경 누락 → 트랙이 올린 비목표 변경 질문을 메인이 「그 외」로 대리 채택 · 라우팅표·README에 비목표 명시, task-05 정의와 일치 | medium | FIXED `b976655` | D10(위험군 = …AC·목표·**비목표**·D블록 변경) 문면 정합 · 라우팅표 「AC·목표·비목표·D블록 변경 · 애매하면 변경으로」(애매함 처리는 기존 문구) · README EN·KO·JA 각 2곳 · SKILL.md 15,220B · README 편집 단계 bash·zsh 적용 확인 |
| R5-1 | task-02 orca()·main() · JSON `null` 응답이 자가 점검을 우회해 TypeError → 미처리 예외로 exit 1(= alive 「종료」) → `--resume` 중복 재개 · 루트가 객체인지 검증, 형식 이탈 = Fail(formatFail) + null 회귀 테스트(alive·watch) | medium | FIXED `c26e0d2` | 루트 객체 검사(null·숫자·배열 = `JSON 응답 객체` 누락 ERR) + main()이 예기치 않은 예외도 ERR exit 2(같은 계열 차단 — 어떤 실패도 exit 1 금지, Cautions) · 테스트 +2 · SC-2·spec AC2 |
| R1-5 | 엔트리포인트 Task table · 08·09가 같은 표에 있어 dev-cycle 7단계(「task 표 완료 기록 전건」)가 01~07 완료 뒤에도 7 미완 판정 · 구현 범위만 완료 대상으로 | medium | FIXED `0de6f7b` | 권고안(dev-cycle 판별 수정)은 spec 범위 밖(dev-cycle 변경 = 위임 모드 5곳, D7) → plan 안 수정: 08·09행을 `## SDD 밖 task` 표로 분리(dev-cycle·convergence 대상 아님 명시) · task-08·09 참조 갱신 |

- 부수 정정(같은 커밋): task-01 테스트 파일 머리 주석의 실행법 `node --test tests/orchestrate/` → 파일 지정(P1 정합).
- 테스트 수 24 → 28(SC-1·SC-4 T1·task-01·02·08). 검증 = 스크래치 클론에서 task 파일만 꺼내 RED 0/28 → GREEN 28/28(≈15초) · 수정 전 스크립트로 새 테스트 = 23 pass / 5 fail · task-04 검증 블록 bash·zsh `ALL_PRESENT`.
- R2 뒤 테스트 수 28 → 31(스크래치 클론 RED 0/31 → GREEN 31/31 · R1판 스크립트로 새 테스트 = 28 pass / 3 fail · task-04 검증 블록 bash·zsh `ALL_PRESENT`, 15,209B).
- batch 제시(적대 소진 3 = auto-rounds, 2026-10-18): R2-3 추천안 채택 + 같은 질문 묶음에 즉시군 R3-1 추천안 채택 → FIXED `ec6ecf3`, 진행 질문 = 「모두 유지하고 계속」(자동 수정 R1 `0de6f7b`·R3 `9c5ff38` 유지). 이후 정밀 모드.
- R3 뒤 테스트 수 31 → 33(스크래치 클론 RED 0/33 → GREEN 33/33 ≈ 20초 · R2판 스크립트로 새 테스트 = 31 pass / 2 fail · 실행 뒤 고아 프로세스 0 — 앞선 검증에서 상한 없는 옛 스크립트가 남긴 옛 가짜 orca 1개는 정리).
- R4 뒤 테스트 수 33 → 34(스크래치 클론 RED 0/34 → GREEN 34/34 · R3판 스크립트로 새 테스트 = 33 pass / 1 fail · 고아 0).
- R5 뒤 테스트 수 34 → 36(스크래치 클론 RED 0/36 → GREEN 36/36 · R4판 스크립트로 새 테스트 = 34 pass / 2 fail · 고아 0) · 훅 기준선(`env -u DEV_WORKFLOW_MODE`) 11/11 · 2/2 · `git diff 151d9f0 -- dev-workflow/hooks` 0줄.
- 미확인 FIXED 큐(13): R1-1 · R1-2 · R1-3 · R1-4 · R1-5(`0de6f7b`) · R2-1 · R2-2(`be73cc8`) · R3-2(`9c5ff38`) · R2-3 · R3-1(`ec6ecf3`) · R4-2(`b976655`) · R4-1(`b243093`) · R5-1(`c26e0d2`).
- 전환: R5 응답으로 적대 소진 5 = max → 전환 신호 3(적대 예산 소진). batch 적재 0건 → 확인 모드 진입(C1, 확인 예산 2).
- **C1 소멸 확인(완전 응답)**: R1-1 · R1-2 · R1-3 · R1-4 · R1-5 · R2-1 · R2-2 · R2-3 · R3-1 · R3-2 · R4-1 · R4-2 · R5-1 (13건 소멸). 판정 감사 = R3-3 DUPLICATE(→ R2-3) 이상 없음(원인·영향·권고 동일, 원 disposition 연결 확인). 신규 finding 없음. verdict = pass.
- **종결(성공, 확인 경유)**: 미판정 blocking 0 · 미확인 FIXED 큐 0 · 확인 verdict pass. 소진 = 적대 5/5 · 확인 1/2 · 복귀 사용 = 아니오.
- **집계**: FIXED 13(루프 8 = R1-1~R1-5·R3-2·R4-2·R5-1 · 사용자 판정 5 = R2-1·R2-2·R2-3·R3-1·R4-1) · ACCEPTED 0 · DEFERRED_TO_IMPL 0 · OUT_OF_SCOPE 0 · DUPLICATE 1(R3-3 → R2-3) · ESCALATE 5(전부 사용자가 FIXED로 닫음) · low 0. 단계 경계 이월(ACCEPTED/DEFERRED/OUT_OF_SCOPE) 없음.
- **루프 건강**(분모 = blocking 13, fingerprint 병합 — R3-3은 R2-3에 병합): 재론률 0/13 = 0% · 철회 조항 3(루프 도입 조항 번복: R1-1 「박스 화면은 셸 검사 제외」 → R2-1 · R2-2 「창 종류 = 화면 전체의 권한 문구」 → R3-1 · R2-2 「종류 판정 박스 우선」 → R4-1) · 사람개입률 5/13 = 38%.
- **잔여 관찰(구현·실측 몫)**: 화면 판독 휴리스틱(alive·key 종류 판정) 우회가 같은 계열로 4회(R1-1→R2-1→R3-1→R4-1) — 사용자 판정으로 「활성 요소 = 화면 맨 아래」 원리까지 반영, 남은 우회는 AC9 (i) 실측과 상수 자리(`HUD_MARK` 등) 갱신의 몫. impl 루프에서 같은 계열이 다시 나오면 휴리스틱 확장보다 구조 선택(창에는 키 하나씩 — R2-2·R4-1에서 기각된 대안)을 사용자에게 다시 제시할 근거.
- 추천 자동 채택(위임): 해당 없음(설치본 1.1.1 — 효과 2 없음, 질문은 사용자 직접).
- 루프 직접 판정(ACCEPTED/OUT_OF_SCOPE/DEFERRED_TO_IMPL/DUPLICATE): R3-3 DUPLICATE(→ R2-3) — 확인 임무 ③ 우선 감사 대상(다음 적대 focus에 `[루프 판정]`으로 실음). batch-pending ESCALATE: 없음.

## 확인 대기 대장

해당 없음.
