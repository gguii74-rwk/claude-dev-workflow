# 오르카 후계 세션 스폰 — 40% 넛지의 /clear 안내를 자동 인계로 (1.0.0 후보)

작성 2026-09-24(맥북) · 경로 **정식**(접촉 표면: 외부 연동 = 오르카 CLI · 비가역 = 옛 세션 종료) · brainstorming 승인 2026-09-24.

## 1. 문제 (실측 근거)

컨텍스트 임계(기본 40%) 넛지 뒤 사람이 `/clear`를 치고 재프롬프트할 때까지 세션이 멈춘다. 부재 중이면 그대로 정지다. 사용자가 꼽은 현재 워크플로우 최대 병목.

실측(SSOT = `~/workspace/dev-workflow-eval/report/ORCA-SUCCESSOR-2026-09-24.md`, 프로브 `orca-pilot/`):
- 오르카 `terminal create --command claude`로 띄운 세션은 user 스코프 플러그인·Stop 훅을 운영 환경과 동일하게 로드한다(dev-workflow 스킬 7종, codex SessionStart 훅, 넛지 문구 그대로 발화). 권한 모드 auto 상속. 스폰·tui-idle 대기·send 수락 3/3 성공.
- `orca terminal close`는 SIGKILL 상당 — codex SessionEnd 훅이 돌지 않아 브로커·잡 기록이 고아로 남는다. `/exit` 전송은 SessionEnd가 돌아 정리된다.
- codex 브로커는 폴더당 하나를 세션들이 공유하고 SessionEnd가 그것을 내린다 → 옛 세션 종료는 후계의 첫 codex 라운드 **전**에 끝나야 한다.
- 서브에이전트 완료 알림은 프로세스 내부라 후계가 받을 수 없다 → 진행 중 단위는 옛 세션이 완료를 받아 기록한 뒤 넘긴다(현행 §2i 그대로가 인계 시점).

## 2. 목표 / 범위 / 비목표

**목표** — 오르카 터미널에서 돌던 세션이 넛지를 받으면, 핸드오프 작성 뒤 **같은 체크아웃에 후계 claude 터미널을 띄우고 재개 프롬프트를 보낸 다음 정지**한다. 후계는 옛 세션을 정상 종료시키고 이어서 진행한다. 오르카가 아니면 현행(/clear 안내)과 **바이트 동일**.

**범위**
- F1 훅 분기·문구: `dev-workflow/hooks/scripts/context-threshold-hook.mjs`
- F2 실패 폴백(사람에게 되돌림)
- F3 review-loop SKILL.md의 "/clear 안내" 조건화(§2b (1)·§2i 표 3행)
- F4 문서·릴리스: README 3종 §8 1.0.0 문단 · `plugin.json` 1.0.0
- F5 훅 테스트(`node --test`) 신설
- F6 실사용 확인(트랙 완료 조건)

**비목표**
- 단계 경계(spec→plan, plan→impl)의 `/clear` 안내와 `--resume` 안내(RL:372 표 밖 문장·RL:429)는 그대로 — 사람 게이트.
- 워크트리 신설·핑퐁 없음(같은 폴더).
- 후계가 옛 세션의 서브에이전트·codex 결과를 대신 기다리는 방식 없음.
- 옛 세션 실행 인자(모델·권한 모드) 복제 없음 — 후계는 `claude` 그대로(사용자 기본 설정 상속, brainstorming 확정).
- 메인/오케스트레이터 세션 없음 — 옛 세션 스스로 후계를 띄운다.

## 3. 설계 (문면 방향 — 최종 문구는 구현에서)

### F1. 훅 분기·문구

- `decideNudge`에 `orcaHandle`(string|null) 인자 추가. `main()`은 `process.env.ORCA_TERMINAL_HANDLE`(비어 있지 않은 문자열)을 넘긴다. 훅 프로세스는 claude의 환경을 물려받는다(실측 A: Bash 환경에서 값 확인).
- (0)의 "그때 /clear를 안내하라"는 **양 경로 공통**으로 "그때 (2)의 인계 절차를 따르라"로 바꾼다 — 이 문장은 RL §2b (1)과 바이트 동일 규정이 있어 경로별로 다를 수 없다(F3에서 RL도 같은 문장으로).
- `orcaHandle == null` → 그 한 문장 외에는 현행 reason **바이트 동일**(회귀 기준). (2)는 현행 /clear 안내 그대로.
- `orcaHandle != null` → (0)(1)은 위와 같고 (2)를 아래로 교체.
- 새 (2) 골격(오르카 경로):
  0. **CLI 해소·사전 검증**(R1-1): 실행 파일 = orca-cli 스킬 순서 — `ORCA_CLI_COMMAND`가 있으면 그 값, 없고 `ORCA_DEV_REPO_ROOT`가 있으면 `orca-dev`, 그 외 `orca`. 이어서 `<CLI> terminal show --terminal $ORCA_TERMINAL_HANDLE --json`이 `ok:true`가 아니면 그 CLI는 현재 인스턴스가 아니다 — 후계를 만들지 않고 F2.
  1. `<CLI> terminal create --worktree active --title <작업명> --command claude --json` → 새 핸들 = `startupTerminal.handle`(없으면 `terminal.handle`).
  2. `... terminal wait --terminal <새 핸들> --for tui-idle --timeout-ms 90000 --json` → `satisfied:true` 확인. false면 timeout 2배로 1회 재시도, 그래도 false면 F2.
  3. `... terminal send --terminal <새 핸들> --enter --wait-submit 15 --json --text "<재개 프롬프트>"` → 영수증의 **`turn_started` 단계**를 확인해야 인계 확정(R1-2 — `accepted:true`는 입력 수락일 뿐 턴 시작 증명이 아니다). `input_accepted`에서 멈추면 **재전송하지 말고** 같은 영수증의 request id로 `--wait-submit 30 --retry-request <id>` 1회 재관찰. 응답 유실 등 모호한 전송 오류도 같은 `--retry-request`로 재조정한다. 재관찰 뒤에도 `turn_started`가 없으면 F2.
  4. 재개 프롬프트(훅이 템플릿 제공) = "핸드오프 파일 <경로>를 읽고 같은 작업을 이어서 진행. **첫 동작**: 옛 터미널 `<ORCA_TERMINAL_HANDLE>`에 `/exit`를 보내고(`terminal send --text "/exit" --enter`) `tui-idle` 대기 뒤 `terminal close`. 그 전에는 codex를 실행하지 마라. 옛 핸들이 `terminal list`에 없으면 이미 닫힌 것으로 보고 진행하고, 있는데 닫기가 실패하면 사용자에게 알리고 codex 라운드를 시작하지 마라(D9). **핸드오프의 다음 액션이 다른 단계(spec→plan, plan→impl)의 시작이면 시작하지 말고 사용자에게 확인하라**(D4)." 경로 = 핸드오프 규약 파일(기본 `.remember/remember.md`, review-loop면 루프 파일). `--title` = 모델이 현재 작업을 요약한 짧은 이름, 마땅치 않으면 `successor`(D7).
  5. `turn_started`를 확인했으면 **더 아무것도 하지 말고 턴을 끝낸다** — 후계가 이 세션을 닫는다. 자기 터미널을 스스로 닫지 않는다.
- 정지 보장: 그 다음 Stop은 `stop_hook_active`로 훅이 통과(exit 0)하므로 재넛지 없이 idle. 후계의 `/exit`로 종료.
- 재넛지(15%p 구간) 변형도 같은 (2)를 붙인다(현행 D6 원칙: 재넛지 = 지시 동일 + 사실 추가).

### F2. 실패 폴백

폴백 조건 4종: (a) 사전 검증 실패(F1 0) · (b) wait `satisfied:false`(재시도 후) · (c) `turn_started` 미확인(재관찰 후) · (d) CLI 실행 오류(재조정 후). **미전달이 확정되기 전(재관찰·재조정 중)에는 후계를 닫지 않는다**(R1-2 — 후계가 이미 프롬프트를 받아 옛 세션에 `/exit`를 보내는 중일 수 있다). 확정되면 후계를 만들지 못한 것으로 보고 현행 문장("이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요")을 사용자에게 안내한다. 만들다 만 터미널은 옛 세션이 폴백 안내 전에 정리한다(D10 — 정리 주체). **정리 방식**(R1-3): claude가 뜬 이력이 있으면(wait `satisfied:true`였거나 `terminal read`에 claude 프롬프트가 보이면) `/exit` 전송 → tui-idle(셸 복귀) 대기 → `terminal close`; 뜨지 않았으면 `terminal close` 직접. 어느 쪽이든 `terminal list`로 소멸을 확인하고, 실패하면 `/clear` 안내 전에 차단 상태(핸들·원인)를 사용자에게 보고한다. fail-closed.

### F3. review-loop 문구

- §2b (1) 인용문("…그때 /clear를 안내하라")을 훅 (0)과 같은 새 문장으로 — 바이트 동일 규정 유지.
- §2i 표 3행 "/clear 후 `/review-loop --resume`로 이어가세요" 안내를 "넛지 (2)의 인계 절차(오르카면 후계 스폰, 아니면 /clear 안내)"로 조건화. 재개 프롬프트에 `--resume` 지시가 들어가야 하므로 §2i가 재개 프롬프트 문구를 정한다(훅 템플릿의 "같은 작업을 이어서" 자리에 review-loop 루프 파일 경로 + `/review-loop --resume`).
- 그 외 `/clear` 언급(단계 경계·§2b 완료 전 금지)은 불변.

### F4. 문서·릴리스 1.0.0

- README 3종 §8 끝에 1.0.0 문단(같은 위치): 오르카 터미널이면 후계를 직접 띄우고 정지 · 후계 첫 동작 = 옛 세션 `/exit`→close · 실패 시 /clear 안내로 복귀 · 단계 경계는 대상 밖.
- `plugin.json` `1.0.0`. 사용자 결정: 이 반영으로 정식 1.0.0.
- 설치 갱신 안내 4머신(맥북·OMEN·그램·spark2).

### F5. 훅 테스트 (repo 파일 없음 — 08-09 D10 유지, D5)

스크래치패드에서 `node --test`로 돌리고 GREEN 출력을 impl ledger에 기록한다. 케이스:
- 비오르카: 최초·재넛지 reason이 (0) 인계 문장 교체분을 제외하고 현행 문자열과 동일(고정 문자열 스냅샷).
- 오르카: reason에 사전 검증(`terminal show`)·create/wait/send 명령 · `ORCA_TERMINAL_HANDLE` 값 · `turn_started` 확인과 `--retry-request` 재관찰 · `/exit` 첫 동작 · 폴백 조건 4종과 정리 방식이 있고, "자가 /clear는 불가" 문장이 없다.
- `stopHookActive`·구간 로직은 기존 동작 불변(기존 케이스 유지).

### F6. 실사용 확인 (트랙 완료 조건)

맥북 오르카에서 실제 세션 1회: 넛지 → 핸드오프 → 후계 스폰 → 옛 세션 종료(SessionEnd 정리 확인) → 후계가 review-loop §0 스냅샷 대조로 재개. 결과를 eval repo 보고서에 부기. 파일럿 미측정 3건(§0 재개·실 40% 흐름·서브에이전트 진행 중)을 여기서 닫는다.

## 4. 결정사항 (3 harden-spec, 2026-09-24 — 전부 사용자 확정, 추천안 채택)

| D | 결정 | 근거 |
|---|---|---|
| D1 | **같은 체크아웃 + 후계 터미널**. 워크트리 2개 핑퐁 불채택 | git 동일 브랜치 이중 체크아웃 불가 · `.remember` 심볼릭 링크 미전파 · 실측(브레인스토밍 확정) |
| D2 | 후계 실행 명령 = **`claude` 그대로**(사용자 기본 설정 상속). 옛 세션 인자 복제 불채택 | 실측: auto 권한 상속 · OS별 인자 조회 실패 지점 제거 |
| D3 | 옛 세션 종료 = **후계의 첫 동작**: `/exit` 전송 → tui-idle 대기 → `terminal close`. 옛 세션 자기 종료·`terminal close`만 쓰기 불채택 | `/exit`만 SessionEnd 정리(브로커·잡) · close는 SIGKILL 상당(실측 E2·E3·E5) · 브로커는 폴더당 공유 |
| D4 | 후계는 **단계 경계를 넘지 않는다** — 다음 액션이 다른 단계의 시작이면 사용자 확인 | 08-13 합의(사람 게이트) · dev-cycle 경계 규약 불변 |
| D5 | 훅 테스트는 **repo 파일 없음** — 스크래치 실행 + impl ledger 기록(08-09 D10 유지) | 기결정 양립 확인 |
| D6 | 넛지 문구 **길이 상한 없음** — 명령을 정확히 적는다 | 세션당 수 회 · 플래그 추측 방지 |
| D7 | 후계 탭 제목 = **모델이 붙인 짧은 작업명**, 폴백 `successor` | 탭에서 작업 식별 |
| D8 | 자동 인계 **끄기 스위치 없음** | 설정·doctor 항목 증가 방지 · 수동은 오르카 밖 |
| D9 | 옛 터미널 닫기 실패 → `terminal list` 확인, 없으면 진행 / 있는데 실패면 사용자 알림 + codex 라운드 금지 | 브로커 공유 위험 · 무인 진행 유지 |
| D10 | 후계 생성 실패 시 **반쪽 터미널은 옛 세션이 닫는다** | 빈 탭 잔존 방지 · 손실 없음 |
| D11 | 1.0.0 완료 조건 = **맥북 실사용 1회**. spark2·Windows는 후속(각 머신 첫 넛지 때 확인) | 폴백이 있어 깨지지 않음 |
| D12 | (0)의 인계 문장은 **양 경로 공통** 신규 문장 — RL §2b (1) 바이트 동일 규정 유지 | 규정 조회(RL §2b) |

기결정 양립: 08-09 D3(재넛지 대응으로 RL 문면 불변 — 이번 RL 변경은 재넛지가 아니라 바이트 동일 규정 이행) · D6(재넛지 = 지시 동일 + 사실 추가 — (2)도 동일 적용) · D10(D5로 유지) · 0.18.0 D25(①②③ 최초·재넛지 동일).

## 5. Acceptance Criteria (harden 확정)

- **AC1 (F1)**: `ORCA_TERMINAL_HANDLE` 미설정 시 `decideNudge` reason이 0.19.0과 동일하되 (0)의 인계 문장 1개만 신규 문장으로 바뀐다(최초·재넛지, 고정 문자열 대조). 설정 시 reason에 (2) 0~5 항목이 있고 옛 핸들 값이 그대로 들어가며 "자가 /clear는 불가" 문장이 없다.
- **AC2 (F2)**: 오르카 reason에 CLI 해소 순서와 사전 검증(R1-1) · `turn_started` 확인·`--retry-request` 재관찰·미전달 확정 전 후계 유지(R1-2) · 폴백 조건 4종 · 반쪽 터미널 정리 방식(`/exit`→close 또는 직접 close)과 `terminal list` 소멸 확인·실패 시 차단 보고(R1-3) · 복귀 문장이 명시된다. 재개 프롬프트 템플릿에 단계 경계 확인(D4)·닫기 실패 처리(D9)·탭 제목 규칙(D7)이 들어간다.
- **AC3 (F3)**: RL §2b (1) 인용문 = 훅 (0) 문장(바이트 동일, grep 대조). §2i 표 3행이 조건화되고 재개 프롬프트에 `--resume`가 들어간다. 단계 경계 `/clear` 문장은 불변.
- **AC4 (F4)**: `plugin.json` `1.0.0` · README 3종 같은 위치에 1.0.0 문단 · 설치 갱신 안내 4머신.
- **AC5 (F5)**: 스크래치 `node --test` GREEN 기록이 impl ledger에 있다(케이스 ≥ 5, 출력 원문 인용). repo에 테스트 파일이 추가되지 않는다(D5).
- **AC6 (F6, 트랙 완료 조건)**: 실사용 1회 기록 — 후계가 옛 세션을 정리하고 §0 대조를 통과해 라운드를 이어감.

## 6. 검증 계획 (개요 — 배치는 5단계 plan에서)

- 단위: AC1·AC2·AC5 = 테스트 파일. AC3·AC4 = grep 대조.
- 실사용: AC6 = 오르카 맥북 1회(`CLAUDE_CTX_THRESHOLD`를 낮춰 재현 가능 — 실 40%까지 기다릴 필요 없음).
- 회귀: 비오르카 환경(env 제거)에서 넛지 문구 diff 0.

## 7. 미해결 질문

없음 — harden-spec에서 전부 결정(D6 길이 상한 없음 · D11 완료 조건 맥북). spark2·Windows 환경 차이는 잔여 리스크(검증 필요·실측).

## 잔여 리스크 (DEFERRED)

- **검증 필요(실측)** spark2·Windows 오르카 환경(`ORCA_TERMINAL_HANDLE` 존재 · `orca`/`ORCA_CLI_COMMAND` 해소 · `--wait-submit` 지원) — 실패하면 F2 폴백으로 현행 동작(안전). D11로 후속.
- **검증 필요(실측)** 후계가 첫 동작(옛 세션 종료)을 건너뛰고 codex를 띄우면 옛 세션 `/exit` 시점에 브로커가 내려가 라운드가 죽는다 — 프롬프트 문면으로만 강제. F6에서 관찰.
- **검증 필요(실측)** 옛 세션이 send 뒤 턴을 끝내기 전에 후계의 `/exit`가 도착하는 경쟁 — 입력은 턴 종료 후 처리될 것으로 예상. F6에서 관찰.

## 재논의 금지(기결정)

> **이번 트랙 확정 결정 = D1~D12(§4, 2026-09-24 harden-spec, 전부 사용자 확정)** — 적대검증(4단계~)에서 재론하지 않는다. 특히: D1 같은 체크아웃(워크트리 핑퐁 불채택) · D2 `claude` 그대로 · D3 `/exit`→close 순서(후계 첫 동작) · D4 단계 경계 불가침 · D5 테스트 repo 파일 없음 · D8 스위치 없음 · D11 완료 조건 맥북 1회.
>
> **승계 기결정**: 08-09 D3·D4·D5·D6·D10·D24·D26(넛지 구간·재넛지·플래그) · 0.18.0 D1·D25·D26·D27(백그라운드 대기·문구 동일·필드 불변·하네스 2케이스) · 08-13 사용자 합의(사람 게이트는 넘기지 않는다).
