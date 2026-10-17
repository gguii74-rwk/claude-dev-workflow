# 오케스트레이터 스킬(orchestrate) 도입 · 위임 모드 효과 2 — 위험군 외 추천 자동 채택 + 확인 대기 대장 (1.2.0)

- 단계: **1–2 spec 초안 (2026-10-17)** → 3 harden-spec → (3.5 해당없음 — 화면 없음) → 4 review-loop(spec) → 5·6(harden에서 생략 여부 확정) → 7 impl → 8 review-loop(impl) → 9 릴리스 1.2.0 → AC9 실측.
- 경로: **경량**(사용자 확인 2026-10-17, dev-cycle 1차 판정 — 접촉 표면 무신호: 스키마·권한·인증·보안 경계·외부 연동·데이터 손상·비가역 없음, 스킬 문면 + 플러그인 동봉 스크립트 1개). **5 plan · 6 plan 적대검증의 생략은 harden-spec에서 범위 확정 뒤 D번호로 결정**(사용자 선택 「생략은 harden 뒤에 결정」 — 4 spec 적대검증은 유지가 기본). 하한 3종(spec 문서 · 3 harden-spec · 8 impl 적대검증) 유지.
- 출처: `docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md` §1(0) 운영 배경 · §3m 확장 규칙 · §7 후속 · **메인 세션 운영 기록 2026-10-17**(원본 `.remember/orchestrator-ref/LESSONS-2026-10-17.md` + 실제 트랙 프롬프트 10건 + 즉석 감시 스크립트 `watch.py`·`rd.sh` — `.remember/`는 머신 간 비동기화라 아래 §1(0)에 요약) · ops-hub 10-10~17 실측(실세션 33 · 추천 수용 102/107 · 트랙 자가 인계 3, 메모리 `dev-workflow-opshub-usage-review-1010`) · dev-workflow-eval `report/UNATTENDED-2026-10-17.md` §0 분기 ①(핵심층 번복률 2.4%/4.3% · 배포 후 결함 0 · 미확인 2.4%) · eval `report/LESSONS-2026-08-12.md` L1~L5 · ops-hub 스킬 `claude-memories/ops-hub/skills/orca-worktree-ops/SKILL.md`(프로젝트 고유 실행 메모 — 플러그인으로 옮기지 않는 쪽) · `orca skills get orca-cli`(Orca 1.4.229 — 참조만).
- 대상: **신규** `dev-workflow/skills/orchestrate/SKILL.md` + `dev-workflow/skills/orchestrate/scripts/orchestrate.mjs`(서브커맨드 `watch`·`alive`·`key`) + repo 루트 `tests/orchestrate/orchestrate.test.mjs`(플러그인 설치본 밖) · `dev-workflow/skills/review-loop/SKILL.md`(§사람에게 묻는 형식 ≈121–128행 · §ESCALATE 세분 ≈115–119 · §자동 모드 batch 제시 ≈134–137 · §0 통합 규칙 ≈224 · §1 보안 자가 판정 ≈259–263 · §2d ≈336–337 · §finding ledger 위치 ≈85 · §4 종료 요약 ≈421–432 · §2i 순서 3 ≈380 · §확인 모드 ESCALATE ≈180) · `dev-workflow/skills/dev-cycle/SKILL.md`(§경량 경로 확인 불가 폴백 ≈56 · 폴백 감사 기록 ≈57 · 가드 3 ≈91 · §세션 모드 선택 지점 1줄) · README 3종(`README.md`·`README.ko.md`·`README.ja.md` — 스킬 표 ≈12행 · 목차 ≈18–35 · 사용법 새 절(≈7 doctor 뒤) · `--auto-rounds` 행 ≈103 · 세션 모드 문단 ≈210 · 디렉터리 트리 ≈255 — 3언어 동일 구조) · `dev-workflow/.claude-plugin/plugin.json`(version 1.1.1→1.2.0 · description에 orchestrate) · `.claude-plugin/marketplace.json`(description) · `docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md` §7(「→ 1.2.0 트랙」 포인터 1줄). **훅(`hooks/scripts/context-threshold-hook.mjs`) 무변경.**

## 1. 문제

**(0) 운영 배경 — 메인 세션 오케스트레이터(2026-10-17 실측, 1.1.0 spec §1(0)의 연장).** ops-hub와 이 repo 모두 메인 세션이 트랙 세션을 오르카 터미널로 띄우고 감시하며 질문에 답하는 운영이다. 1.1.0은 그 운영을 위해 세션 모드(수동/위임)와 위임 모드 효과 1(후계 자동 인계 끄기)을 넣었고, 효과 2는 §7 후속으로 남겼다. 2026-10-17 메인 세션(맥북)이 1.1.0 트랙 4~9단계·AC6과 1.1.1 트랙 전 단계를 이 방식으로 운영한 기록:

- **실제 흐름(4단계)** — ① 트랙 터미널 생성(`orca terminal create --worktree path:<abs> --title <트랙명> --command 'claude … --model <id>' --json` → 핸들) → tui-idle 대기 → 긴 지시는 `.remember/track-*.prompt` 파일로 쓰고 「이 파일을 읽고 그 지시대로 진행하라」 한 줄만 전송(`--enter --wait-submit 15`, `turn_started` 확인). ② 감시 — 즉석 스크립트(`watch.py`): 20초마다 렌더링 화면(`--screen`)을 읽어 프롬프트 박스 위 본문의 해시가 **바뀐 뒤 다시 안정 + tui-idle**이면 SETTLED, 「Enter to select」·「to navigate」가 보이면 QUESTION. ③ 질문 처리 — 화면을 읽고 단계별 라우팅 → 사용자에게 AskUserQuestion(글로벌 질문 형식으로 재작성) → TUI 키 입력. ④ 단계 종료 — 트랙의 보고를 메인이 **직접 검증**(`git log origin/main..HEAD` · 테스트 재실행 · AI 서명 grep · diff 범위) → (사용자 지시가 있을 때만) push → claude-memories에 핸드오프·메모리 커밋 → 보고 → 단계 경계에서 정지.
- **적용한 질문 라우팅** — 사람·취향 단계(브레인스토밍·harden-spec·ui-mockup): 모든 질문을 사용자에게(추천이 트랙·메인 동일해도). review-loop(spec)부터: 위험군(critical·보안·방향 전제·AC·목표 조정·비가역)만 사용자, 그 외는 추천안(첫 선택지)을 메인이 골라 전달. 공개 배포(push)·다른 머신 환경 변경(plugin update)·외부 실측은 매번 사용자 확인(승인은 다음 단계로 이월하지 않음). **결과: 사용자에게 전달한 질문 약 20건 전부 추천안 채택(번복 0) · 메인 대리 채택 1건.**
- **재현된 함정(8)** — (f1) `terminal wait --for tui-idle`은 트랙이 codex 백그라운드 대기로 턴을 끝내면 즉시 satisfied → 「진행 중 대기」와 「완료」를 구분 못 함(본문 변화+안정으로 판정해야 했다). (f2) 기본 `terminal read`(누적 스트림)는 claude TUI에서 1줄 조각만 → `--screen` 필수. (f3) AskUserQuestion TUI: 단일 질문 = 커서가 첫 선택지(추천)라 Enter만. 묶음 = Tab(`\t`) 다음 탭 · Shift-Tab(`\e[Z`) 이전 · 각 탭 Enter = 선택+다음 · 마지막 「Review your answers → Submit answers」 Enter. 다른 탭을 읽으려면 Tab으로 넘겨 읽고 Shift-Tab 복귀. (f4) `--dangerously-skip-permissions`여도 `sh -c` 안 `rm`은 「could not be checked」 확인 창이 떴고 무인 세션은 약 1분 30초 뒤 자동 거부 예정이었다(사용자가 직접 승인) → 오케스트레이터가 감지·전달해야 하는 화면 유형. (f5) 플러그인 user 스코프 갱신으로 project 스코프(ops-hub)는 같이 오르지 않는다 — 실측 전 `~/.claude/plugins/installed_plugins.json`으로 해당 경로 버전 확인. (f6) `claude plugin update --scope user` 직후 대기 중이던 트랙 세션이 종료(원인 미확정) → `--resume <세션 id>`로 새 터미널에 이어 붙여 복구. (f7) 종료된 터미널에 send하면 셸에 텍스트가 들어갈 위험 → send 전 `terminal show`의 connected/status 확인. (f8) 트랙이 메인 프롬프트의 사실 오류(미push 여부 등)를 스스로 정정한 사례 2건 → 메인 프롬프트는 사실을 git에서 확인해 쓸 것. (f9) 메인이 트랙에 `/model`을 보내자 **「새 세션 기본값으로 저장」되어 사용자 전역 `settings.json`의 model이 Fable로 바뀌어 되돌렸다** → 트랙 모델은 기동 명령의 `--model`로만. (f10) 사용자가 트랙 터미널의 질문 창에 **직접 답한 사례 여러 번** → 메인이 감시로 QUESTION을 잡은 시점과 키를 보내는 시점 사이에 창이 닫혔거나 탭 상태가 바뀌어 있을 수 있다. 다른 머신 실측은 맥북 오르카의 spark2 페어링(`--environment spark2-ts`)으로 원격 터미널 생성·읽기·전송이 됐다.

**(a) 오케스트레이터 절차가 플러그인 밖에만 있다.** 위 흐름·라우팅·함정은 메인 세션의 브리프 문면(`.remember/main-2026-10-17-mode-track.md`)과 즉석 스크립트에만 있다 — 다음 메인 세션은 다시 짜야 하고(f1·f2는 매번 재발견), 브리프 문면 의존이라 사실 오류(f8)가 트랙에 흘러간다. ops-hub 쪽은 `orca-worktree-ops` 스킬 + CLAUDE.md 규칙 #1~#9에 **프로젝트 고유** 부분(repo id·브랜치 개명·워크트리 삭제·Windows 경로·모델 배분)이 있지만, 머신·프로젝트 공통인 「트랙 기동 → 감시 → 질문 라우팅 → 검증·push → 핸드오프 → 후계 → 페어링」은 어디에도 규약으로 없다.

**(b) 위임 모드에서 위험군 외 질문도 사람 손(메인의 TUI 조작)을 탄다.** 1.1.0 위임 효과는 훅 1개(후계 인계)뿐이라, 위임 트랙의 batch ESCALATE·진행 질문은 여전히 AskUserQuestion으로 떠서 메인이 감시로 잡아 추천을 골라 Enter를 누른다. 실측상 이 결정들은 추천 수용 102/107(ops-hub) · 번복률 2.4%(핵심층) · 배포 후 결함 0인데, 매번 메인의 감시 턴 + 조작 턴이 든다. 그리고 그렇게 닫힌 **무인 결정의 기록 형식이 없다** — UNATTENDED §0 분기 ①의 뜻은 자율화 확대가 아니라 「확인 대기 대장 규약화」(무인 결정을 감사 가능한 형식으로 표준화)다.

## 2. 목표 / 범위 / 비목표

**목표** — (s) 플러그인 새 스킬 `orchestrate`: 메인 세션이 트랙 하나를 기동부터 단계 경계 정지까지 운영하는 **공통 절차** + 감시 스크립트. (e) 위임 모드 효과 2: `DEV_WORKFLOW_MODE=delegated` 세션의 review-loop·dev-cycle이 **위험군 외 질문을 추천안으로 자동 채택**하고 출처를 기록한다. (l) **확인 대기 대장**: 자동 채택된 결정을 ledger 문서 말미 한 절에 모아 사용자가 단계 경계에서 확인/번복한다.

**범위** — 신규 스킬 1(SKILL.md + `scripts/orchestrate.mjs`) · review-loop 질문 지점 5종의 위임 분기 + 기록 · dev-cycle 확인 불가 폴백에 위임 신호 1줄 + 대장 연동 · README 3종 · plugin.json/marketplace.json · 1.1.0 spec §7 포인터 · 릴리스 1.2.0 · AC9 실측.

**비목표** —
- **ops-hub 쪽 변경 없음**(CLAUDE.md 규칙 #1~#9 · `orca-worktree-ops` 스킬 — repo 밖. 9단계에서 「플러그인 스킬이 공통 절차를 덮으니 프로젝트 스킬은 고유 부분만 남기면 된다」 안내만). 플러그인 스킬은 **프로젝트 규약 우선**.
- 오르카 명령 상세(옵션·응답 필드)를 SKILL.md 본문에 복사하지 않는다 — 본문은 `orca skills get orca-cli`를 가리키고, 실행에 필요한 상세는 **`scripts/orchestrate.mjs` 1곳**에만 둔다(사용자 기결정 — 핸들 필드처럼 버전마다 어긋남).
- `orca orchestration …`(task DAG·inbox·dispatch) 채택 없음 — 오늘 운영은 terminal 기반이고 측정 근거도 그것뿐.
- **훅 무변경**(모드 판정은 1.1.0 D3 그대로 — 효과 2는 스킬 문면). 수동 모드 동작 무변경. 사람·취향 단계 3종(브레인스토밍·harden-spec·ui-mockup) 무변경 — harden-spec 「질문 없이 닫히는 판단 갭은 없다」 유지(L4).
- **자율화 확대 없음**: 위험군(§3e 정의)과 기결정 변경은 어느 모드에서도 자동 채택하지 않는다. batch 적재·`--auto-rounds`·확인 모드 규약 무변경 — 바뀌는 것은 「누가 답하나」뿐.
- 번복률 측정 자체(eval repo 몫 — 대장은 그 측정의 입력 형식). Windows 오르카 실측. 오르카 외 터미널(tmux 등) 감시 지원. doctor 변경(스킬 존재 여부 점검 추가 없음).

## 3. 설계

### 3o. `orchestrate` 스킬 — 메인 세션용 공통 절차

- **호출**: `/dev-workflow:orchestrate <트랙 설명·단계·spec 경로>`. description 트리거 예 — 「트랙 띄워」「메인 세션으로 돌려」「이 단계 위임으로 진행해」「트랙 감시해」「후계 띄워」. **오탐 방지 문구**(doctor 패턴): review-loop 안 codex 실패(review-loop 몫) · 단일 세션에서 직접 하는 작업 · 오르카 CLI 자체 사용법 질문(`orca-cli` 몫) · 워크트리 생성·삭제 정책(프로젝트 규약 몫)에는 트리거하지 않는다.
- **역할 규칙**: 메인은 **spec·plan·코드를 편집하지 않는다**(트랙 몫) — 손대는 파일 = 핸드오프(`.remember/remember.md`)·트랙 프롬프트 파일·메모리뿐(제 선택 M1 — 오늘 브리프 규칙의 일반화). 사용자에게 묻는 질문은 전부 글로벌 질문 형식(① 무슨 일 ② 예: ③ 선택지별 결과 ④ 추천 첫 선택지). 트랙이 띄운 질문을 전달할 때는 **그 형식으로 재작성**한다(트랙 문면을 그대로 복사하지 않는다 — 읽는 사람은 트랙 화면을 보지 않았다).
- **프로젝트 규약 우선**(사용자 기결정): repo id · 브랜치 규칙·개명 · 워크트리 정책(같은 체크아웃 vs 워크트리) · 브리프 파일 위치(`.dev/brief.md` vs `.remember/track-*.prompt`) · Windows 경로·따옴표 함정 · 모델 배분은 **그 프로젝트 문서(CLAUDE.md·프로젝트 스킬)가 정한다**. 스킬은 「프로젝트 규약이 있으면 그것, 없으면 아래 기본값」 구조로 쓴다. 기본값 = 같은 체크아웃(워크트리 없음) · 프롬프트 파일 `.remember/track-<slug>.prompt`.
- **트랙 모델(사용자 기결정 B14)**: **기동 명령의 `--model`로만** 지정한다. 단계별 배분 기본값 = 브레인스토밍·spec 초안·harden-spec = **Fable**(`claude-fable-5-1`) / ui-mockup·plan·적대검증(review-loop)·impl·운영(릴리스·실측) = **Opus**(`claude-opus-5-5`) — 프로젝트 규약이 다른 배분을 두면 그것. **트랙에 `/model`을 보내지 않는다** — `/model`은 「새 세션 기본값으로 저장」되어 사용자 전역 `settings.json`의 `model`을 바꾼다(f9 실사고). 모델을 바꿔야 하면 그 단계의 새 트랙을 `--model`로 띄운다.
- **절차 ① 트랙 기동** — (1) 단계 → 모드 결정표: 브레인스토밍·harden-spec·ui-mockup = **수동**(접두 없음, 질문 전부 사용자) / review-loop(spec)부터 = **위임**(`DEV_WORKFLOW_MODE=delegated` 접두) — 사용자가 수동을 지정하면 그대로. (2) 프롬프트 파일 작성 — **사실은 git에서 확인해 쓴다**(f8: HEAD·push 여부·spec 경로·설치 버전). 내용 = 역할·읽을 파일·기결정(다시 묻지 말 것)·진행 범위(어느 단계까지)·정지 조건(push 금지·다음 단계 시작 금지)·넛지 시 행동. (3) 터미널 생성 → 핸들 확보(응답에 없으면 목록에서 title로) → tui-idle 대기 → 포인터 한 줄 전송 → `turn_started` 확인(없으면 재전송 금지 — `orca-cli`의 `--retry-request` 규칙). 명령 상세는 `orca-cli`. **기동 명령 기본 문면(사용자 기결정 B18)**: 위임 트랙 = `DEV_WORKFLOW_MODE=delegated claude --dangerously-skip-permissions --model <id> --session-id <uuid>` — 위임 모드의 정의가 「사람 없이 진행」이라 권한 창을 누를 사람이 없다(안전장치 = 프롬프트의 push 금지·비가역 금지 지시 + 라우팅표 「사용자 확인」 행, README 경고 1줄). 수동 트랙(사람 단계)은 권한 우회 플래그를 기본에 넣지 않는다 — 프로젝트 규약·사용자 지정에 따른다. **세션 id는 메인이 기동 때 정한다**(`--session-id <uuid>`, 제 선택 M12 — 정상 동작 중 TUI 화면에는 id가 안 보이고 터미널이 죽으면 종료 표지도 못 읽는다) → 핸들·제목·세션 id·워크트리 경로·단계를 핸드오프에 적는다.
- **절차 ② 감시** — `node <Base directory>/scripts/orchestrate.mjs watch <핸들> [최대초=580] [--environment <이름>]`을 **백그라운드로 1회** 실행하고 결과로 깨어난다(짧은 간격 폴링 턴을 메인이 직접 돌리지 않는다). `<Base directory>` = 스킬 로드 때 표시되는 「Base directory for this skill」 경로(제 선택 M14 — 메인 세션 cwd는 프로젝트 repo라 상대 경로로는 못 찾는다; 1.1.1 AC8이 같은 표시를 실측). 출력 = 첫 줄 판정 `SETTLED | QUESTION | PERMISSION | TIMEOUT | ERR` + 마지막 N줄 화면. 판정 뒤 행동표: SETTLED → 화면을 읽고 단계 종료 보고인지 중간 정착인지 판독(종료 보고면 절차 ④, 아니면 재감시) / QUESTION → 절차 ③ / PERMISSION → **즉시 사용자에게 전달**(f4 — 무인 자동 거부 전 ≈90초, 실측 1건) / TIMEOUT → 재감시(10분 넘게 본문 무변화면 화면을 그대로 사용자에게 보고) / ERR → 메시지대로(스크립트 자가 점검 실패면 `orca-cli` 참조해 스크립트 갱신 — 수동 감시로 폴백하지 말고 사용자에게 보고).
- **절차 ③ 질문 처리** — 라우팅표:

  | 트랙 단계 | 질문 종류 | 누가 답하나 |
  |---|---|---|
  | 사람·취향 단계(수동 트랙) | 전부 | **사용자**(메인이 재작성해 전달, 답을 TUI에 입력) |
  | review-loop부터(위임 트랙) | 위험군(§3e) · 기결정 변경 · 권한 프롬프트 | **사용자** |
  | review-loop부터(위임 트랙) | 그 외 | 트랙이 효과 2로 이미 닫는다 — 메인은 화면만 확인. 그래도 TUI 질문이 떠 있으면(구버전 설치본·효과 2 밖 질문) 추천안(첫 선택지) 선택 후 대장에 적으라고 트랙에 1줄 지시 |
  | 어느 단계든 | push · 다른 머신 환경 변경(plugin update 등) · 외부 실측 · 비가역 | **사용자**(매번 — 승인 이월 없음) |

  TUI 키 표(f3): 단일 질문 = Enter(커서 = 첫 선택지 = 추천) · 묶음 = Tab/Shift-Tab 이동 · 탭마다 Enter · Review → Submit Enter · Other(자유 서술) = 해당 선택지로 이동 후 Enter → 텍스트 → Enter. **다른 선택지를 고를 때는 화살표로 이동 후 Enter**.
  키 전송은 `orchestrate.mjs key <핸들> <enter|tab|shift-tab|up|down|text …>`로 한다(제 선택 M13 — Tab `\t`·Shift-Tab `\e[Z`·화살표 같은 제어 시퀀스와 `terminal send` 사용법은 `orca-cli`에도 없는 상세라 스크립트 1곳에 둔다; SKILL.md 본문은 키 이름만 쓴다).
  **입력 직전 2중 확인(사용자 기결정 B15·B16)**: (a) `orchestrate.mjs alive <핸들>`(내부 = `terminal show`의 연결·쓰기 가능 플래그 — 1.4.229: `connected`·`writable`·`orphaned`)로 터미널이 **살아 있고 연결돼 있는지** 확인 — 종료된 터미널에 send하면 텍스트가 셸로 들어간다(f7). 종료됐으면 절차 ⑤(e)로 복구한 뒤 다시 감시. (b) 화면을 **다시 읽어** 질문 창이 **아직 열려 있고** 탭 체크 표시·커서 위치가 예상(감시가 잡은 시점)과 같은지 확인한 뒤에만 키를 보낸다 — 사용자가 트랙 터미널에서 직접 답했을 수 있다(f10). 다르면 키를 보내지 않고 현 화면 기준으로 다시 판단한다(이미 닫혔으면 재감시).
- **절차 ④ 단계 종료** — 트랙의 종료 보고를 받으면 메인이 **직접 검증**: (a) 커밋 범위 `git log --oneline <기준>..HEAD`가 보고와 일치 (b) 테스트·게이트 재실행(프로젝트 규약의 명령 — 이 repo면 훅 테스트 11/11·2/2) (c) AI 서명·트레일러 grep 0건 (d) diff가 spec 대상 파일 안 (e) **확인 대기 대장의 대기 항목**(§3l) 목록. 보고를 사용자에게 올리되 **대장 대기 항목을 글로벌 형식 질문으로 함께** 묻고(전부 확인 / 번복 n건), 답을 트랙에 전달해 트랙이 대장 상태를 갱신·커밋한다(메인 편집 금지 유지). 사용자 부재면 대기로 남긴다. push·plugin update·외부 실측은 사용자 확인 뒤에만. 핸드오프 = `.remember/remember.md` 맨 위 블록 추가(기존 블록 보존) + 메모리 → claude-memories 커밋(프로젝트 규약에 따라 push). **단계 경계에서 정지** — 다음 단계는 사용자 지시로 새 트랙(절차 ①).
- **절차 ⑤ 후계·재획득·페어링** — (a) 위임 트랙이 넛지로 「/clear 후 재시작」 안내에서 멈추면: **같은 접두**로 새 터미널 생성 + 프롬프트 = 「`.remember/remember.md`(또는 루프 파일 `.remember/loop-*.md`)를 읽고 `/review-loop --resume`(해당 시)로 이어가라」. 옛 터미널은 트랙이 스스로 닫지 않으므로 메인이 `/exit` 전송 → 셸 복귀 확인 → close(핸들 둘에 동시 전송 금지). (b) 트랙이 수동 모드(1.0.x 설치본 포함)로 자가 인계했으면 옛 핸들이 사라진다 → 목록에서 `<작업명>-<토큰>` 제목으로 새 핸들 재획득. (c) **메인 자신의 후계**(메인은 수동 — 자기 후계는 1.0.0 자동 인계): 후계 메인은 핸드오프에 적힌 트랙 핸들·제목으로 `terminal list`에서 재획득한다 — 핸드오프에 **트랙 핸들·제목·워크트리 경로·단계**를 반드시 적는다. (d) 다른 머신: 오르카 페어링 환경(`--environment <이름>` — 이름은 프로젝트·환경 인벤토리 규약) 접두를 모든 orca 호출과 orchestrate.mjs `watch`에 같이 준다; 설치 상태 조회는 ssh(별칭은 인벤토리). (e) **트랙 세션의 예기치 않은 종료**(f6 — 사용자 기결정 B15): send·감시 중 `terminal show`가 종료·미연결을 보이면 새 터미널(같은 접두·같은 `--model`)에서 `claude --resume <세션 id>`로 이어 붙인다 — 세션 id는 트랙 화면 종료 표지(「Resume this session with」) 또는 그 전 화면에서 확보해 **핸드오프에 미리 적어 둔다**(제 선택 M12). 복구 뒤 첫 전송은 「상태를 보고하라」 한 줄로 현재 위치를 확인하고 진행한다.
- **분량 상한**(제 선택 M3): SKILL.md ≤ 15KB(dev-cycle 수준) — 함정 목록은 1줄씩, 오르카 상세는 스크립트로, 프로젝트 고유는 포인터로. L1(규약은 실측 뒤 성장) — 이번 분량은 오늘 실측 1일분으로 방어 가능한 범위까지만.
- **`$N` 금지**(1.1.1 D3 승계): SKILL.md 본문·셸 블록에 맨 `$`+숫자를 쓰지 않는다(`${N}`·`$(N)`·서술로).

### 3w. `scripts/orchestrate.mjs` — 스크립트 계약(오르카 상세의 유일한 거처)

- **서브커맨드 3개**(제 선택 M13): `watch <핸들> [최대초] [--environment <이름>]`(감시) · `alive <핸들>`(터미널 생존·연결 판정 — exit 0 살아 있음 / 1 종료·미연결·고아 / 2 ERR, 1줄 요약 출력) · `key <핸들> <enter|tab|shift-tab|up|down|text <문자열>> …`(TUI 키 전송 — 여러 키를 순서대로, text는 `--text` 인자로 전달하고 셸 보간 없음). CLI 해소 = 환경변수 `ORCA_CLI_COMMAND`(있으면 그 값) → `ORCA_DEV_REPO_ROOT`(있으면 `orca-dev`) → `orca` — 훅 (2-0)ⓐ와 같은 규칙(제 선택 M4). `--environment`는 세 서브커맨드 공통.
- **자가 점검(사용자 기결정 B6)**: `watch` 시작 때 화면 읽기 1회 + idle 대기 1회(짧은 타임아웃), `alive`는 `terminal show` 1회로 **의존 필드 존재**를 검사한다 — 렌더링 화면 줄 배열(1.4.229: `result.terminal.tail`) · idle 만족 플래그(`result.wait.satisfied`) · 연결 플래그(`connected`·`writable`·`orphaned`). 하나라도 없거나 JSON 파싱 실패면 **exit 2 + 1줄 메시지** 「orca 응답 형식이 스크립트와 다릅니다 — `orca skills get orca-cli`를 참조해 scripts/orchestrate.mjs의 필드명을 갱신하세요(필드: …)」. 조용히 빈 결과로 진행하는 경로 없음. `key`는 전송 뒤 영수증의 `accepted`를 확인하고 없으면 exit 2.
- **판정**: 20초 간격(제 선택 M5 — 오늘 값). 본문 = 프롬프트 박스(구분선 `────`) 위 줄들에서 스피너·타이머 줄(`✻ ✶ ✳ ✢ · ✽ *` 시작)을 뺀 것의 해시. `QUESTION` = 화면에 「Enter to select」 또는 「to navigate」. `PERMISSION` = 권한 확인 창 패턴(후보: 「could not be checked」 · 「Do you want to proceed」 · 「Yes, and don't ask again」 — **검증 필요(실측)**, 패턴은 스크립트 상단 상수로 모아 둔다). `SETTLED` = 본문 해시가 시작값에서 **바뀐 뒤** 직전 읽기와 같고 idle 만족. `TIMEOUT` = 최대초 경과. `ERR` = CLI 실행 실패·파싱 실패(자가 점검 통과 뒤에도).
- **출력(`watch`)**: stdout 첫 줄 = 판정 토큰, 이어서 마지막 70줄(제 선택). exit 0(판정 4종) / 2(자가 점검·ERR).
- **테스트**: repo 루트 `tests/orchestrate/orchestrate.test.mjs`(제 선택 M15 — 플러그인 소스 `./dev-workflow` 밖이라 설치본 크기 무관 · git 동기화라 `.remember/` 훅 테스트의 stale 사본 사고 재발 없음) — `node --test` · 가짜 `orca` 실행 파일(PATH 앞에 둔 스텁 스크립트가 호출 순서별로 미리 준비한 JSON을 돌려줌)로 자가 점검 실패 1건 + `watch` 판정 4종 각 1건 + `alive` 2건(살아 있음/종료) + `key` 1건(스텁이 받은 인자 대조 — Shift-Tab 시퀀스·text 보간 없음). 실제 오르카 불필요. 실행법 = `node --test tests/orchestrate/`(repo npm 게이트 없음 — 이 명령을 spec·README 개발 절에 기록).

### 3e. 위임 모드 효과 2 — review-loop의 질문 지점별 동작

모드 판정 = 1.1.0 D3 그대로(`DEV_WORKFLOW_MODE` trim 후 `delegated` 정확 일치 — 스킬은 셸로 읽는다, 읽는 방식은 builder 몫이되 `$N` 금지). **수동 모드 = 현행 무변경.** 위임 모드:

| 질문 지점 | 현행(수동) | 위임 모드 |
|---|---|---|
| 즉시 ESCALATE(critical · 보안/데이터 손상·유실 · 후속 전제가 되는 방향/아키텍처) | 그 자리에서 AskUserQuestion | **동일 — 묻는다**(오케스트레이터가 받아 사용자에게) |
| batch ESCALATE 일괄 제시(각 항목 disposition) | AskUserQuestion 묶음 | 항목별로 **첫 선택지(추천) 채택**. 단 **추천안이 AC·목표·`## 재논의 금지(기결정)` D블록을 바꾸는 항목은 그 항목만 묻는다**(사용자 기결정 — 위험군 경계). 나머지는 채택 후 기록 |
| 진행 질문(「모두 유지하고 계속 (추천)」 등) | 묻는다 | 추천 채택 |
| 보안 크리티컬 확인(`--security` 없음 + 접촉면 즉시군) | 묻는다 | **묻는다**(위험군 = 보안). `--security` 있으면 1.1.0대로 묻지 않음 |
| fail-closed 확인(§0 통합 규칙 재개 대상 모호 · 재개 인자 불일치 · phase 대조 불일치 · 2차 대조 불일치) | 묻는다(기본 = 진행하지 않음) | **추천안이 안전한 쪽(멈춤 · 저장값 유지 · 복원하지 않음 · 리뷰 미실행)일 때만 채택**(= 멈추고 보고) — 추천이 「진행」 쪽이면 묻는다. **메인 보충 조건(2026-10-17) — harden 검증 대상** |
| 확인 라운드의 ESCALATE(군 구분 없이 즉시 처리) | 묻는다 | 「즉시 처리」 = batch에 적재하지 않는다는 뜻이고 **누가 답하느냐는 위험군 여부로** — 위험군·기결정 변경이면 묻고, 그 외는 추천 채택(제 선택 M6 — harden 대상) |
| 중단 선택지(「지금 멈추고 직접 본다」) | 사용자 선택 | 추천이 아니므로 자동 채택 대상 아님(사용자·오케스트레이터가 고를 때만) |

- **위험군 정의(사용자 기결정)** = review-loop 즉시군 ①②③ + 「추천안이 AC·목표·D블록 기결정을 바꾼다」. 1.1.0 §7의 「비가역」은 즉시군 ②에 포함.
- **기록(3곳)**: (1) ledger 행의 disposition 뒤 출처 `(추천 자동 채택(위임))` — 현행 `(사용자 ○○)`·`(루프 판정)` 표기와 같은 자리. (2) `## 확인 대기 대장`에 행 1개(§3l). (3) §4 종료 요약에 1줄 「추천 자동 채택(위임) N건 — 대장 참조 / 해당 없음」. 보안 판정 1줄(1.1.0 D1)은 그대로.
- **감사 지위(사용자 기결정 B17) = 루프 직접 판정과 동격.** 자동 채택 항목은 `[루프 판정]`과 같은 방식으로 **`[자동 채택(위임)]` 표시**를 달아 다음 라운드 focus에 싣고, **확인 라운드 임무 ③ 우선 감사 대상**으로 ledger에 기록한다. 확인 프롬프트 첨부물 ⑥(감사 제외 = 사용자 기결정 목록)에 **넣지 않는다**. 감사가 이의하면 그 항목은 **위험군 여부와 무관하게 사람에게**(ESCALATE — 확인 모드 예외대로 즉시, 오케스트레이터 경유 사용자) 간다 — 같은 항목을 다시 자동 채택하지 않는다. §4 루프 건강의 사람개입률 분모에서 자동 채택은 **사용자 개입으로 세지 않는다**(감사 이의 뒤 사용자 재판정이 있을 때만 센다). 근거: UNATTENDED 번복 3건이 전부 「루프 ACCEPTED → 확인 감사 이의 → 사용자 FIXED」 — 번복률 2.4%의 신뢰 근거가 이 감사다.
- **루프 시작(§0·§1)에 1줄 추가**: 대장에 `확인 대기` 행이 있으면 — 수동 모드는 **리뷰 전에 사용자에게 먼저 묻는다**(항목별 확인/번복, 글로벌 형식) · 위임 모드는 그대로 진행하고 시작 요약에 「대장 대기 n건 승계」 1줄(사용자 기결정 — 다음 세션 안전망). 번복 처리는 그 단계 몫(수정 = 그 라운드 FIXED 경로).
- **§2i 순서 3 · 핸드오프**: 루프 파일 `## 현재`에 「자동 채택 건수」를 더하지 않는다(대장이 단일 원본 — 복제 금지 원칙). 재개 세션은 대장을 읽는다.
- **`--auto-rounds`·batch 적재 규약 무변경** — 위임이어도 batch는 적재되고 전환 시점에 일괄 제시된다(그때 답을 트랙이 낼 뿐). 이 분리가 측정 근거(102/107은 batch 일괄 제시의 답)와 일치한다.

### 3l. 확인 대기 대장

- **위치(사용자 기결정 B8)**: ledger가 있는 문서(spec/plan) **말미**, 그 문서의 모든 `## 적대검증 ledger (<phase>)` 절 뒤에 **문서당 1절** `## 확인 대기 대장`(그 문서 ledger의 phase들 공통 — 행에 phase를 적는다). plan을 두는 트랙은 ledger 문서가 둘(spec → spec 문서 · plan·impl → plan 엔트리포인트)이라 대장도 둘이다(제 선택 M7 — B8 「spec/plan 말미」 문면 그대로; 「트랙당 1절」로 합치면 plan 루프가 spec 문서를 써야 해 ledger와 분리된다). **읽는 규칙**: 다음 단계 세션의 안전망(§3e §0 1줄)은 **직전 단계 ledger 문서의 대장**을 읽는다(spec→plan: spec 문서 · plan→impl: plan 문서 · planless: 항상 spec) · dev-cycle 판별은 spec·plan 둘 다 grep · 오케스트레이터 절차 ④(e)는 그 단계 ledger 문서. 복제 금지 — 대기 행을 다음 문서로 옮겨 적지 않는다(§4 단계 경계의 ACCEPTED 이월 명시와 달리 대장은 상태 열이 있는 원본 1곳).
- **행 형식**: `| # | 일시 | phase·지점 | 질문 요지(쉬운 말 1줄) | 채택 선택지 | 출처 | 상태 |` — 출처 = `추천 자동 채택(위임)` 고정(이 절에 들어오는 행은 전부 무인 결정). 상태 = `확인 대기` → `확인 (<날짜>, <경로: 단계 종료 보고 | 다음 세션 시작>)` 또는 `번복 (<날짜>) → <처리 커밋>`. finding 기원 행은 fingerprint를 질문 요지 끝 괄호에.
- **기록 주체**: 자동 채택한 그 세션(트랙)이 **그 라운드 ledger 커밋에 함께** 적는다(별도 커밋 아님).
- **닫기(사용자 기결정)**: ① 단계 종료 때 오케스트레이터가 보고에 대기 항목을 싣고 사용자 답을 받아 트랙에 전달 → 트랙이 상태 갱신·커밋. ② 사용자 부재면 대기로 남고, **다음 단계 세션이 시작 때 읽는다**(review-loop §0 — 수동 = 먼저 묻기, 위임 = 그대로 진행; dev-cycle 판별 출력에 「대장 대기 n건」 1줄 — 제 선택 M8: impl 직접 구현 세션은 dev-cycle을 경유하므로 거기서 보인다). 릴리스 뒤까지 남은 대기 항목은 트랙 종결 보고에서 사용자가 닫는다(단계 경계가 더 없으므로 — 제 선택 M9).
- **용도**: 감사(무엇을 누가 언제 자동으로 닫았나) + 번복률 재측정 입력(§7). 대장이 비면 절은 「해당 없음」 1줄.

### 3d. dev-cycle — 위임 모드 = 확인 불가 신호 ②의 공식 입력

- §경량 경로 확인 불가 폴백의 신호 ②에 「**또는 세션 모드가 위임**(`DEV_WORKFLOW_MODE=delegated`) — 문면 신호 없이도 성립」을 더한다(사용자 기결정 — 1.1.0 §7 접점). 그 뒤는 **현행 폴백 그대로**(접촉 표면 스캔 → 무신호 경량 · 그 외 정식 fail-closed · 즉시 승격 우선 · 가드 1·9단계 승인은 대체 안 함).
- 폴백 감사 기록 1줄의 신호 표기에 위임을 구분한다: `경량 자동 판정 (<날짜>): 확인 불가(신호 ② 위임 모드) · 접촉 표면 무신호` + **대장 행 1개**(spec이 있을 때 — 질문 요지 「경량/정식 경로」, 채택 「경량」). 정식 판정은 현행대로 기록 없음(되돌릴 결정이 아니다).
- 가드 3(세션 상태 재확인)의 「확인 불가면 폴백 준용」도 같은 신호를 본다 — 위임 트랙이 `/clear` 뒤 재개할 때 재스캔 재판정(기록과 무관, 현행).
- §세션 모드 선택 지점 문단에 「위임 모드의 효과(1.2.0): 후계 인계 + 위험군 외 추천 자동 채택(README 「세션 모드」)」 1구절.

### 3r. 릴리스 1.2.0 · 문서

- `plugin.json` version 1.2.0 · description에 「오케스트레이터 공통 절차(orchestrate)」 추가. `marketplace.json` description에 orchestrate 추가.
- README 3종: 스킬 표에 `orchestrate` 행 · 목차 · 사용법 새 절 「`orchestrate` — 메인 세션의 트랙 운영」(역할·절차 ①~⑤ 요약·프로젝트 규약 우선·`orca-cli` 포인터·orchestrate.mjs `watch` 1줄) · 세션 모드 문단: 「1.1.0의 위임 효과는 하나」→「위임 효과 2개(1.2.0): 후계 인계 + 위험군 외 추천 자동 채택·확인 대기 대장」, 「후속 버전에서 더해진다」 문구 제거 · `--auto-rounds` 행에 「위임 모드는 batch 답을 트랙이 낸다」 1구절 · 디렉터리 트리에 `orchestrate/{SKILL.md,scripts/orchestrate.mjs}`. 3언어 동일 구조(1.1.0 AC5 패턴).
- 1.1.0 spec §7 끝에 「→ 1.2.0 트랙 `docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md`」 1줄.
- 구버전 설치본 안내: 「1.2.0 이상」 표기 — 1.1.x 위임 트랙은 효과 1만 받는다(메인이 TUI로 답하는 현행 운영이 그대로 통한다 — 라우팅표 3행).

## 4. Acceptance Criteria

- **AC1 (orchestrate SKILL.md 구조·경계)**: frontmatter(name·description — 트리거 예 + 오탐 방지 문구 각 1건 이상) · 절 「역할 규칙」「프로젝트 규약 우선」「① 기동」「② 감시」「③ 질문 처리(라우팅표 + TUI 키 표)」「④ 단계 종료(검증 체크리스트 + 대장)」「⑤ 후계·재획득·페어링」 각 grep 1건 이상 · 크기 ≤ 15KB · **본문에 오르카 옵션 문자열 0건**(`--for `, `--screen`, `--wait-submit`, `--retry-request`, `result.terminal` grep 0 — 스크립트 파일 제외) · `orca skills get orca-cli` 포인터 ≥ 1 · 「프로젝트 규약」 ≥ 1 · **B14~B18 문면**: 「`/model`」 금지 1건 + 단계별 모델 배분표 1건 · `alive` 생존 확인 1건 + 「`--resume`」 복구 1건 · 입력 직전 「다시 읽」 재확인 1건 · 위임 기동 명령에 `--dangerously-skip-permissions`·`--session-id` 각 1건(수동 트랙 기본에는 없음 명시).
- **AC2 (orchestrate.mjs 자가 점검)**: 스텁 orca가 렌더링 줄 배열 · idle 플래그 · 연결 플래그 중 하나가 없는 JSON을 돌려주면 해당 서브커맨드가 exit 2 + 출력에 「orca-cli」와 누락 필드명 포함. 올바른 스텁이면 진행.
- **AC3 (orchestrate.mjs 동작)**: `watch` — 스텁 시나리오로 `SETTLED`(본문 변화 → 안정 + idle) · `QUESTION`(「Enter to select」) · `PERMISSION`(패턴 상수 중 1개) · `TIMEOUT`(최대초 경과, 변화 없음) 각 1건, 「변화 없음 + idle」은 SETTLED가 아니다(f1 재현 방지 — 케이스 1건). `alive` — 살아 있음(exit 0)·종료/고아(exit 1) 각 1건. `key` — `tab shift-tab enter text <s>` 호출이 스텁에 전달한 `--text` 인자 시퀀스가 기대와 일치(Shift-Tab = ESC `[Z`, text는 보간 없이 원문) 1건. 전부 `node --test tests/orchestrate/` GREEN.
- **AC4 (`$N`·문법)**: `grep -nE '\$[0-9]' dev-workflow/skills/*/SKILL.md` 0건(1.1.1 AC1 승계, 새 스킬 포함) · `node --check dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` 통과.
- **AC5 (review-loop 문면)**: 위임 분기 — §ESCALATE 세분 또는 §2d에 「위임 모드」 분기 · batch 제시의 「첫 선택지 채택」 · 「AC·목표·D블록 기결정을 바꾸는 항목은 묻는다」 · 진행 질문 채택 · fail-closed 확인의 「안전한 쪽일 때만」 조건 · 확인 라운드 ESCALATE의 위험군 기준 · 출처 `추천 자동 채택(위임)` · **`[자동 채택(위임)]` 표시 + 임무 ③ 우선 감사 대상 + 첨부물 ⑥ 제외 목록에 넣지 않음 + 이의 시 사람에게 + 사람개입률 분모 규칙**(B17) · `## 확인 대기 대장` 기록 · §4 종료 요약 1줄 · §0/§1 「직전 단계 ledger 문서의 대장 대기 행 — 수동은 먼저 묻기·위임은 승계 1줄」 — 각 grep 1건 이상. **수동 모드 문장 무변경**: diff가 조건절 삽입·추가 문장뿐(기존 문장 삭제·의미 변경 0 — 리뷰로 확인).
- **AC6 (dev-cycle 문면)**: 신호 ②에 「위임」 · 감사 기록 `신호 ② 위임 모드` · 대장 행 1줄 · 판별 출력 「대장 대기」 1줄 · 선택 지점 문단 1.2.0 효과 — 각 1건.
- **AC7 (README 3종)**: 스킬 표 행 · 목차 · 사용법 절(위임 트랙 기동 기본 문면의 `--dangerously-skip-permissions` **경고 1줄** 포함 — B18) · 세션 모드 문단 갱신(「후속 버전에서 더해진다」류 문구 0건, 「1.2.0」 ≥ 1) · `--auto-rounds` 1구절 · 트리(`orchestrate/{SKILL.md,scripts/orchestrate.mjs}` · `tests/orchestrate/`) · 개발/릴리스 절에 `node --test tests/orchestrate/` 1줄 — 3언어 각 1곳, 구조 동일. plugin.json·marketplace.json description에 「orchestrate」.
- **AC8 (훅 무변경 · 회귀)**: `git diff <base>..HEAD -- dev-workflow/hooks` 빈 출력 · 기준선 `.remember/hook-test-1.0.0/` 11/11 · `.remember/hook-test-1.1.0/` 2/2 GREEN(실행법 = 1.1.0 spec AC3).
- **AC9 (릴리스 뒤 실측 — 완료 조건 후보, harden 판정)**: (i) 메인 세션이 `/dev-workflow:orchestrate`로 **다음 트랙 1개**를 기동→감시→단계 종료까지 운영(설치본 기준 — Base directory 경로 해소 M14 포함) — `watch` 판정 `SETTLED`·`QUESTION` 각 1회 이상 관측, `alive`·`key` 각 1회 이상 사용, 질문 1건 이상 라우팅표대로 처리, 종료 검증 체크리스트 수행 기록. (ii) 위임 review-loop에서 **추천 자동 채택 ≥ 1건** → ledger 출처 + 대장 행 + §4 1줄 — **batch ESCALATE 발생에 의존**하므로 완료 조건으로 둘지, 「첫 발생 시 기록」(DEFERRED형)으로 둘지 harden에서 결정. Windows 미실측.

## 5. 결정사항

**기결정(사용자, 브레인스토밍 2026-10-17 — 다시 묻지 않는다)**:

| B | 결정 | 근거 |
|---|---|---|
| B1 | 둘로 나눈다 — 공통 절차 = 플러그인 새 스킬, 프로젝트 고유(repo id·브랜치·워크트리·Windows) = 각 프로젝트. 플러그인은 「프로젝트 규약 우선」 | 사용자 판정 10-17 20:4x |
| B2 | 효과 2는 새 스위치가 아니라 `DEV_WORKFLOW_MODE=delegated`의 효과(1.1.0 §3m 확장 규칙) | 사용자 판정 |
| B3 | 오르카 명령 상세는 `orca-cli` 참조만 — SKILL.md 본문에 복사 금지 | 핸들 필드처럼 버전마다 어긋남 |
| B4 | 경로 경량, 5·6 생략은 harden 뒤 결정 | 접촉 표면 무신호 · 범위가 1.1.0보다 큼 |
| B5 | 스킬 첫 절 비중 순서 = 감시(대기/완료/질문) → 질문 TUI 조작 → 질문 라우팅 → 단계 종료(검증·push·핸드오프) | 오늘 운영에서 아쉬웠던 순서(4건 전부 선택) |
| B6 | 감시 = **스크립트 동봉 + 시작 자가 점검 실패**(필드 없으면 `orca-cli` 참조 안내로 exit) | L3 기본값은 싼 쪽 · 명령 상세를 실행 가능한 1곳에 |
| B7 | 효과 2 범위 = **review-loop + dev-cycle 폴백 입력** | 102/107 근거는 review-loop · dev-cycle은 기존 폴백에 신호 1줄 |
| B8 | 대장 위치 = ledger 문서(spec/plan) 말미 `## 확인 대기 대장` 절 | 1.1.0 D1(판정은 산출물 옆) · git 동기화 |
| B9 | 스킬 이름 `orchestrate` · 버전 **1.2.0** | 동사형 결 · 새 기능 = minor, 수동 무변경 |
| B10 | 위험군 = 즉시군 ①②③ + 「추천안이 AC·목표·D블록 기결정을 바꾼다」 | 번복률 2.4%는 루프 운영 결정의 수치 · harden-spec 「AC 조정 추천은 단독 질문」과 같은 줄 |
| B11 | 대장 닫기 = 단계 종료 때 메인 보고→사용자 답→트랙이 갱신·커밋 + 다음 세션 시작 때 안전망(수동 = 먼저 묻기, 위임 = 승계) | 메인 편집 금지 유지 · 야간 연속 진행 비차단 |
| B12 | **fail-closed 확인의 위임 자동 채택은 추천이 안전한 쪽(저장값 유지·멈춤)일 때만** — spec 명시 + harden 검증 대상 | 메인 보충 10-17 — fail-closed는 어긋나면 멈추는 안전장치 |
| B13 | 브레인스토밍부터 시작 · 사람 단계 3종은 모드와 무관하게 사람(L4) | 사용자 판정 · 1.1.0 D9 |
| B14 | **트랙 모델은 기동 명령 `--model`로만**. 배분 기본값 = 브레인스토밍·spec·harden = Fable / 목업·plan·적대검증·impl·운영 = Opus(프로젝트 규약 우선). **트랙에 `/model` 전송 금지** | 메인 보충 10-17(사용자 승인) — `/model`은 새 세션 기본값으로 저장되어 전역 settings.json을 바꿈(f9 실사고) |
| B15 | **send 전 `terminal show`의 connected/status 확인**. 종료됐으면 새 터미널에서 `claude --resume <세션 id>`로 이어 붙인다 | 메인 보충 10-17 — 10-17 20:41 트랙 세션 예기치 않은 종료 실사례 · 종료된 터미널 send = 셸에 텍스트 유입 위험(f7) |
| B16 | **질문 창 입력 직전 화면 재확인** — 창이 아직 열려 있고 탭 체크 표시·상태가 예상과 같을 때만 키 전송 | 메인 보충 10-17 — 사용자가 트랙 터미널에서 직접 답한 실사례 여러 번(f10) |
| B17 | **자동 채택(위임) 판정 = 루프 직접 판정과 동격** — 확인 라운드 임무 ③ 감사 대상, 감사 제외 목록에 넣지 않음, 이의 시 사람에게 | 사용자 판정 10-17(검토 에이전트 질문) — UNATTENDED 번복 3건 전부 확인 감사가 잡음 |
| B18 | **위임 트랙 기동 명령 기본 = `--dangerously-skip-permissions` 포함**(수동 트랙은 프로젝트 규약·사용자 지정) | 사용자 판정 10-17 — 위임 = 사람 없이 진행이라 권한 창을 누를 사람이 없음 · 안전장치 = 프롬프트 금지 지시 + 라우팅표 사용자 확인 행 |

**제 선택(builder 재량 표시 — harden에서 뒤집힐 수 있음)**: M1 메인은 spec·plan·코드 편집 금지 · M2 (B14로 대체 — 모델 명시 규칙은 기결정) · M3 SKILL.md ≤ 15KB · M4 CLI 해소 규칙 = 훅 (2-0)ⓐ와 동일 · M5 감시 간격 20초·기본 상한 580초·출력 70줄 · M6 확인 라운드 ESCALATE도 위험군 기준으로 자동 채택 분기 · M7 대장은 ledger 문서마다 1절(B8 문면), 안전망은 직전 단계 ledger 문서를 읽음 · M8 다음 세션 읽기 = review-loop §0 + dev-cycle 판별 출력 · M9 릴리스 뒤 잔여 대기 항목은 트랙 종결 보고에서 닫음 · M10 스크립트는 Node(python 의존 추가 안 함) · M11 테스트는 스텁 orca로 `node --test`(repo 게이트 없음 — 실행법은 spec에 기록) · M12 세션 id는 기동 때 메인이 `--session-id <uuid>`로 정해 핸드오프에 적음 · M13 스크립트 1개(`orchestrate.mjs`)에 `watch`·`alive`·`key` 서브커맨드 — TUI 키 시퀀스·`terminal show` 필드 등 감시 외 오르카 상세도 이 1곳 · M14 스크립트 경로 = 스킬 로드 때 표시되는 Base directory · M15 테스트 파일 = repo 루트 `tests/orchestrate/`(설치본 밖·git 동기화).

## 6. 미해결 질문 (harden-spec 대상)

1. B12 검증: fail-closed 확인 지점 전수(§0 통합 규칙 3분기 · 재개 인자 불일치 · phase 대조 · 2차 대조 · 스냅샷 대조 중단)에서 「추천 = 안전한 쪽」이 현행 문면상 항상 첫 선택지인가 — 아니면 위임 분기에 「안전한 쪽 = 멈춤」을 명시해야 하나.
2. AC9 (ii) 완료 조건 여부(batch 발생 의존) · (i)의 「다음 트랙」을 무엇으로 할지.
3. 5 plan · 6 plan 적대검증 생략 여부(B4) — 변경 파일 ≈10종·신규 스크립트+테스트.
4. M6(확인 라운드 ESCALATE 위임 분기) — 확인 모드 예외의 취지(교착 방지)와 충돌하지 않는가.
5. PERMISSION 패턴·자동 거부 유예 시간 — 실측 근거 1건뿐(f4).
6. 대장 행이 많아질 때(장기 트랙) 문서 비대 — 상한·아카이브 규칙 필요한가.
7. 위임 트랙에서 효과 2가 자동 채택한 결정이 **같은 라운드의 다른 항목과 모순**될 때(예: 하나는 ACCEPTED 추천, 하나는 그것을 전제로 FIXED) — 묶음 단위 일관성 검사가 필요한가.
8. orchestrate 스킬의 메인 세션 컨텍스트 비용(SKILL.md 로드 + 감시 결과 70줄×N) — 트랙 1개당 상한 감각.
9. 구버전(1.1.x) 트랙 설치본과 1.2.0 메인의 혼재 — 라우팅표 3행으로 충분한가.
10. 「기결정 변경」 판정 주체 = 트랙 자신 — 애매하면 어느 쪽으로(묻는다 = fail-closed)?
11. (검토 에이전트 지적에서 승계) M7 문서별 대장 + 「직전 단계 ledger 문서를 읽는다」 규칙이 planless·plan 트랙·릴리스 뒤 잔여 항목(M9) 세 경로에서 모두 읽을 곳을 유일하게 정하는가.
12. (검토 에이전트) B17 감사 이의 뒤 「사람에게」의 전달 경로 — 확인 모드 예외(즉시)로 뜨는 AskUserQuestion을 오케스트레이터가 라우팅표 어느 행으로 다루나(위험군 행에 「감사 이의 항목」 명시 필요?).
13. (검토 에이전트) `--session-id <uuid>` 지정 세션이 `claude --resume <uuid>`로 그대로 재개되는지 — Claude Code 2.1.302 실측 필요(검증 필요(실측) 후보).

## 7. 후속 (이 spec 밖)

- **번복률 재측정**: 대장이 쌓이면 eval repo에서 「자동 채택(위임)」 결정의 번복률을 UNATTENDED 규칙으로 재측정(AB2급 — L1·L5). 20% 또는 배포 후 결함 ≥ 1이면 효과 2 축소(분기 ②).
- ops-hub `orca-worktree-ops`·CLAUDE.md에서 공통 절차 부분을 플러그인 스킬 포인터로 치환(repo 밖, 9단계 안내).
- Windows 오르카에서 orchestrate.mjs `watch`·접두 실측(첫 Windows 위임 사용 때).

## 잔여 리스크 (DEFERRED)

- **검증 필요(실측)**: (1) PERMISSION 화면 패턴과 무인 자동 거부 유예(≈90초 — 10-17 1건). (2) 오르카 1.4.229 이후 응답 필드명 변화 — 자가 점검이 잡는다(B6). (3) Windows PowerShell 트랙 터미널에서 `--environment`·접두·orchestrate.mjs 동작(범위 밖). (4) `--session-id`로 띄운 세션의 `--resume` 재개(§6 13).

## 재논의 금지(기결정)

harden-spec(3단계)에서 확정 — 초안 시점에는 §5 기결정 B1~B13을 승계 대상으로 둔다(D번호는 harden에서 부여).
