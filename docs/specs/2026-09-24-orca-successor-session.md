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
  1. `<CLI> terminal create --worktree active --title "<작업명>-<토큰>" --command claude --json` → 새 핸들 = `startupTerminal.handle`(없으면 `terminal.handle`). **토큰** = 옛 세션이 만든 고유 상관 문자열(예: `HHMMSS` + 난수 4자, 영숫자·하이픈만)(R2-3). **제목 전체는 안전 문자 집합으로 정규화한다**(R3-1): `[A-Za-z0-9._-]` 외 문자는 `-`로 치환, 제목 전체 길이 ≤ 40 — **`-<토큰>` 길이를 먼저 예약하고 작업명 부분만 절단한 뒤 토큰을 온전히 붙인다**(R4-1: 토큰이 잘리면 응답 유실 회수가 막힌다). 제목은 셸 큰따옴표 안에 들어가므로 `$()`·백틱·따옴표·공백을 남기지 않는다(D7의 "짧은 작업명"은 이 정규화를 거친 값). 응답·JSON이 유실되면 재생성하지 말고 `<CLI> terminal list --worktree active --json`에서 title의 토큰으로 **정확 조회**해 핸들을 회수한다 — 결과가 정확히 1개가 아니면(0 또는 2+) F2(차단 보고).
  2. `... terminal wait --terminal <새 핸들> --for tui-idle --timeout-ms 90000 --json` → `satisfied:true` 확인. false면 timeout 2배로 1회 재시도, 그래도 false면 F2.
  3. 재개 프롬프트는 **파일로 조립한다**(R2-2): `.remember/successor-<토큰>.prompt`에 quoted heredoc으로 쓰고(파일명의 토큰은 정규화된 값) `<CLI> terminal send --terminal <새 핸들> --enter --wait-submit 15 --json --text "$(cat "<파일>")"`로 전달 — 파일 내용은 셸에서 재평가되지 않는다(RL §2b focus 전달과 같은 패턴). 프롬프트·제목·경로를 셸 문자열에 직접 보간하지 않는다(백틱·`$(…)`·따옴표가 로컬에서 실행되거나 인자가 깨진다). → 영수증의 **`turn_started` 단계**를 확인해야 인계 확정(R1-2 — `accepted:true`는 입력 수락일 뿐 턴 시작 증명이 아니다). `input_accepted`에서 멈추면 **재전송하지 말고** 같은 영수증의 request id로 `--wait-submit 30 --retry-request <id>` 1회 재관찰. 응답 유실 등 모호한 전송 오류도 같은 `--retry-request`로 재조정한다. 재관찰 뒤에도 `turn_started`가 없으면 F2.
  4. 재개 프롬프트(훅이 템플릿 제공) = "핸드오프 파일 <경로>를 읽고 같은 작업을 이어서 진행. **0번째 동작 — 공유 브로커 단일 실행권 검사**(R5-3, 사용자 확정): `/exit` 전에 `node <companion 루트>/scripts/codex-companion.mjs status --all --json`으로 이 폴더의 `queued`/`running` 잡 중 **자기 세션 외**의 것을 확인한다(companion 루트는 RL §2b ①과 같은 레지스트리 해소). 있으면 완료까지 15초 간격으로 기다리고(상한 10분), 상한에 닿으면 사용자에게 보고하고 `/exit`·codex 시작을 모두 보류한다 — 옛 세션의 SessionEnd가 폴더 공유 브로커를 내려 그 잡을 죽인다. 브로커 참조 계수화는 codex 플러그인 소관이라 범위 밖(후속). **첫 동작**(R2-1 — 세 명령 모두 옛 핸들에 바인딩, `--terminal` 생략 금지 — 생략하면 활성 터미널이 대상이 되어 후계 자신이나 무관한 탭을 닫는다): `<CLI> terminal send --terminal <옛 핸들> --text "/exit" --enter --json` → `<CLI> terminal wait --terminal <옛 핸들> --for tui-idle --timeout-ms 30000 --json` → `<CLI> terminal close --terminal <옛 핸들> --json` (CLI 해소는 0단계와 같은 순서). **각 단계의 성공 조건**(R5-2): `/exit` send 영수증 `accepted:true` → wait `satisfied:true` 또는 `terminal read`에 셸 프롬프트 복귀 증거 → close `ok:true` → `terminal list`에 옛 핸들 부재. 어느 단계가 실패하거나 모호하면(예: send 실패인데 옛 세션이 이미 idle이라 wait만 통과) **close도 codex 시작도 하지 말고** 상태를 사용자에게 보고하라(close만 하면 SessionEnd가 건너뛰어져 브로커·잡이 고아가 된다). 그 전에는 codex를 실행하지 마라. 옛 핸들이 `terminal list`에 없으면 이미 닫힌 것으로 보고 진행하고, 있는데 닫기가 실패하면 사용자에게 알리고 codex 라운드를 시작하지 마라(D9). **핸드오프의 다음 액션이 다른 단계(spec→plan, plan→impl)의 시작이면 시작하지 말고 사용자에게 확인하라**(D4)." 경로 = 핸드오프 규약 파일(기본 `.remember/remember.md`, review-loop면 루프 파일). `--title` = 모델이 현재 작업을 요약한 짧은 이름, 마땅치 않으면 `successor`(D7).
  5. `turn_started`를 확인했으면 **더 아무것도 하지 말고 턴을 끝낸다** — 후계가 이 세션을 닫는다. 자기 터미널을 스스로 닫지 않는다.
- 정지 보장: 그 다음 Stop은 `stop_hook_active`로 훅이 통과(exit 0)하므로 재넛지 없이 idle. 후계의 `/exit`로 종료.
- 재넛지(15%p 구간) 변형도 같은 (2)를 붙인다(현행 D6 원칙: 재넛지 = 지시 동일 + 사실 추가).

### F2. 실패 폴백

폴백 조건 4종: (a) 사전 검증 실패(F1 0) · (b) wait `satisfied:false`(재시도 후) · (c) `turn_started` 미확인(재관찰 후) · (d) CLI 실행 오류(재조정 후 — create 응답 유실은 토큰 조회로 회수를 먼저 시도하고, 핸들이 하나로 확정되지 않으면 **재생성과 `/clear` 안내를 모두 차단**하고 후보 핸들을 사용자에게 보고한다, R2-3). **미전달이 확정되기 전(재관찰·재조정 중)에는 후계를 닫지 않는다**(R1-2 — 후계가 이미 프롬프트를 받아 옛 세션에 `/exit`를 보내는 중일 수 있다). 확정되면 후계를 만들지 못한 것으로 보고 현행 문장("이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요")을 사용자에게 안내한다. 만들다 만 터미널은 옛 세션이 폴백 안내 전에 정리한다(D10 — 정리 주체). **정리 방식**(R1-3): claude가 뜬 이력이 있으면(wait `satisfied:true`였거나 `terminal read`에 claude 프롬프트가 보이면) `/exit` 전송 → tui-idle(셸 복귀) 대기 → `terminal close`; 뜨지 않았으면 `terminal close` 직접. 어느 쪽이든 `terminal list`로 소멸을 확인하고, 실패하면 `/clear` 안내 전에 차단 상태(핸들·원인)를 사용자에게 보고한다. fail-closed.

### F3. review-loop 문구

- §2b (1) 인용문("…그때 /clear를 안내하라")을 훅 (0)과 같은 새 문장으로 — 바이트 동일 규정 유지.
- §2i 표 3행 "/clear 후 `/review-loop --resume`로 이어가세요" 안내를 **경로 ①(컨텍스트 넛지)에서만** "넛지 (2)의 인계 절차(오르카면 후계 스폰, 아니면 /clear 안내)"로 조건화한다. **경로 ②(사용자가 "지금 멈추고 직접 본다" 선택)·③(폴백② 새 세션 확인)은 현행 수동 재개 안내 그대로** — 사용자가 멈추기로 한 직후 자동으로 이어가면 사람 게이트를 넘는다(R5-1, D4와 같은 취지). 재개 프롬프트에 `--resume` 지시가 들어가야 하므로 §2i가 재개 프롬프트 문구를 정한다(훅 템플릿의 "같은 작업을 이어서" 자리에 review-loop 루프 파일 경로 + `/review-loop --resume`).
- 그 외 `/clear` 언급(단계 경계·§2b 완료 전 금지)은 불변.

### F4. 문서·릴리스 1.0.0

- README 3종 §8 끝에 1.0.0 문단(같은 위치): 오르카 터미널이면 후계를 직접 띄우고 정지 · 후계 첫 동작 = 옛 세션 `/exit`→close · 실패 시 /clear 안내로 복귀 · 단계 경계는 대상 밖.
- README 3종 §주의의 전역 설치 문구("user 스코프 훅이 모든 프로젝트에서 실행돼도 `.remember/`를 쓰지 않는 프로젝트에서는 문구만 맞지 않고 동작은 무해")를 교체한다(R5-4): 오르카 터미널에서는 넛지 뒤 터미널 생성·프롬프트 파일 쓰기·옛 세션 종료가 자동으로 일어난다는 사실과, 오르카 밖에서는 현행과 같다는 것을 명시.
- `plugin.json` `1.0.0`. 사용자 결정: 이 반영으로 정식 1.0.0.
- 설치 갱신 안내 4머신(맥북·OMEN·그램·spark2).

### F5. 훅 테스트 (repo 파일 없음 — 08-09 D10 유지, D5)

스크래치패드에서 `node --test`로 돌리고 GREEN 출력을 impl ledger에 기록한다. 케이스:
- 비오르카: 최초·재넛지 reason이 (0) 인계 문장 교체분을 제외하고 현행 문자열과 동일(고정 문자열 스냅샷).
- 오르카: reason에 사전 검증(`terminal show`)·create/wait/send 명령 · `ORCA_TERMINAL_HANDLE` 값 · 제목 정규화 규칙(`[A-Za-z0-9._-]`)·토큰과 `terminal list` 회수 · 프롬프트 파일 + `"$(cat …)"` 전달 문구 · `turn_started` 확인과 `--retry-request` 재관찰 · 첫 동작 세 명령 전부에 `--terminal <옛 핸들>`과 단계별 성공 조건·실패 시 차단(R5-2) · 종료 전 폴더 잡 확인·대기(R5-3) · 폴백 조건 4종과 정리 방식이 있고, "자가 /clear는 불가" 문장이 없다. 재개 프롬프트 템플릿 안에 `--terminal` 없는 send/wait/close가 0건.
- `stopHookActive`·구간 로직은 기존 동작 불변(기존 케이스 유지).
- 제목 절단: 40자를 넘는 작업명에서도 제목 끝의 토큰이 온전히 남고 `terminal list` 정확 조회가 되는 케이스(R4-1).
- 셸 안전: 문구가 지시하는 제목 정규화 규칙을 `$(printf SUBSTITUTED)`·백틱·따옴표가 든 입력에 적용했을 때 치환이 일어나지 않음을 스크래치 셸에서 확인(R3-1).

### F6. 실사용 확인 (트랙 완료 조건)

맥북 오르카에서 실제 세션 1회: 넛지 → 핸드오프 → 후계 스폰 → 옛 세션 종료(SessionEnd 정리 확인) → 후계가 review-loop §0 스냅샷 대조로 재개. 조건: **다른 탭이 활성인 상태**에서 후계의 첫 동작이 옛 핸들만 닫는지(R2-1), 제목·경로에 백틱·`$(…)`·공백이 섞인 프롬프트가 원문 그대로 전달되는지(R2-2)를 함께 본다. 결과를 eval repo 보고서에 부기. 파일럿 미측정 3건(§0 재개·실 40% 흐름·서브에이전트 진행 중)을 여기서 닫는다.

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
- **AC2 (F2)**: 오르카 reason에 CLI 해소 순서와 사전 검증(R1-1) · 제목 상관 토큰·응답 유실 시 `terminal list` 정확 조회·미확정 시 재생성/안내 차단(R2-3) · 프롬프트 파일 전달·보간 금지(R2-2) · 제목 안전 문자 집합 정규화(R3-1)·토큰 길이 예약 후 작업명만 절단(R4-1) · 첫 동작 세 명령의 `--terminal <옛 핸들>` 바인딩(R2-1) · `turn_started` 확인·`--retry-request` 재관찰·미전달 확정 전 후계 유지(R1-2) · 폴백 조건 4종 · 반쪽 터미널 정리 방식(`/exit`→close 또는 직접 close)과 `terminal list` 소멸 확인·실패 시 차단 보고(R1-3) · 복귀 문장이 명시된다. 재개 프롬프트 템플릿에 단계 경계 확인(D4)·닫기 실패 처리(D9)·탭 제목 규칙(D7)이 들어간다.
- **AC3 (F3)**: RL §2b (1) 인용문 = 훅 (0) 문장(바이트 동일, grep 대조). §2i 표 3행이 **경로 ①에만** 조건화되고(경로 ②·③은 현행 문장 유지 — 세 경로의 기대 동작을 §2i에 각각 명시) 재개 프롬프트에 `--resume`가 들어간다. 단계 경계 `/clear` 문장은 불변.
- **AC4 (F4)**: `plugin.json` `1.0.0` · README 3종 같은 위치에 1.0.0 문단 · 설치 갱신 안내 4머신 · README 3종에서 "동작은 무해"류 전역 설치 문구 0건(교체 확인, R5-4).
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
- **범위 밖(후속)** codex 플러그인의 폴더 공유 브로커를 참조 계수 방식으로 바꾸는 것(R5-3 권고 후반) — 외부 플러그인 소관. 이 트랙은 종료 전 잡 확인·대기로 대응.
- **검증 필요(실측)** 옛 세션이 send 뒤 턴을 끝내기 전에 후계의 `/exit`가 도착하는 경쟁 — 입력은 턴 종료 후 처리될 것으로 예상. F6에서 관찰.

## 재논의 금지(기결정)

> **이번 트랙 확정 결정 = D1~D12(§4, 2026-09-24 harden-spec, 전부 사용자 확정)** — 적대검증(4단계~)에서 재론하지 않는다. 특히: D1 같은 체크아웃(워크트리 핑퐁 불채택) · D2 `claude` 그대로 · D3 `/exit`→close 순서(후계 첫 동작) · D4 단계 경계 불가침 · D5 테스트 repo 파일 없음 · D8 스위치 없음 · D11 완료 조건 맥북 1회.
>
> **승계 기결정**: 08-09 D3·D4·D5·D6·D10·D24·D26(넛지 구간·재넛지·플래그) · 0.18.0 D1·D25·D26·D27(백그라운드 대기·문구 동일·필드 불변·하네스 2케이스) · 08-13 사용자 합의(사람 게이트는 넘기지 않는다).

## 적대검증 ledger (spec)

루프 시작 2026-09-24 · base = origin/main `ee0a356` · 예산 max 5 · confirm 2 · auto 3 · 보안 크리티컬 아님(일반 트랙). score 산식 = critical 4 · high 3 · medium 1(§2c 분류 직후·수정 전 스냅샷, 미확인 FIXED 큐 제외).

| R | 모드 | score | 미확인 FIXED 큐 | 비고 |
|---|---|---|---|---|
| R1 | 적대(자동) | 5 (high 1·medium 2) | 0 → 3 | verdict needs-attention · 신규 3 · FIXED 3 |
| R2 | 적대(자동) | 7 (high 2·medium 1) | 3 → 6 | verdict needs-attention · 신규 3 · FIXED 3 · R1 큐 3건 적대 비재출현(R2, 참고 — 큐 유지) |
| R3 | 적대(자동, 경계) | 1 (medium 1) | 6 → 7 | 1차 실행 실패(본문 없음 — `orca terminal list` 실패 직후 종료, 소진 미반영, 잡 cancel, 사용자 판단으로 재실행) · 재실행 verdict needs-attention · 신규 1 · FIXED 1 · 큐 6건 적대 비재출현(R3, 참고) · 소진 3 = auto 경계, batch 적재 0 → flush 없음 · 전환 신호 미발화 → 정밀 모드 R4 |
| R4 | 적대(정밀) | 1 (medium 1) | 7 → 8 | verdict needs-attention · 신규 1 · FIXED 1 · 큐 7건 적대 비재출현(R4, 참고) · 신호 1 미발화(7→1→1) · 신호 2 미발화(수정 큐 1) · 소진 4 |

| fingerprint | severity | disposition | 근거 |
|---|---|---|---|
| spec:F1 · CLI 해소 규칙이 현재 Orca 인스턴스를 보장하지 않는다 · 해소 순서 명시 + 생성 전 핸들 조회 검증 | medium(재평가 ← high: 관리 터미널에서만 발화) | FIXED `6546ef3` | F1 (2) 0단계 신설: `ORCA_CLI_COMMAND`→`orca-dev`→`orca` + `terminal show` 사전 검증, 실패 시 F2. AC2 반영 |
| spec:F1/F2 · accepted:true만으로 인계 확정 — 전달 유실·상호 종료 경쟁 · turn_started 확인 + --retry-request 재조정 + 미전달 확정 전 후계 유지 | high | FIXED `6546ef3` | F1 (3)(5) `turn_started` 기준, `--retry-request` 1회 재관찰(재전송 금지). F2에 "미전달 확정 전 후계 미종료" 명시. AC1·AC2 반영 |
| spec:F2 · 폴백이 시작된 claude를 SIGKILL해 고아 상태 · claude 기동 확인 시 /exit→종료 대기→close + list 소멸 검증 | medium(재평가 ← high: 코덱스 미실행이라 브로커 없음) | FIXED `6546ef3` | F2 정리 방식: 기동 이력 있으면 `/exit`→tui-idle→close, 없으면 close 직접, `terminal list` 소멸 확인·실패 시 차단 보고. AC2 반영 |

| spec:F1 · 종료 명령이 옛 터미널 핸들에 바인딩되지 않았다 · send/wait/close 전부 `<CLI> … --terminal <옛 핸들>` 명시 | high | FIXED `bdadf55` | F1 (4) 첫 동작 세 명령 완전 표기 + `--terminal` 생략 금지 사유. AC1 "템플릿 안 `--terminal` 없는 명령 0건" · AC6 다른 탭 활성 상태 조건 |
| spec:F1 · 동적 프롬프트를 셸 문자열로 전달하면 명령 치환이 실행된다 · 파일 조립 + argv 전달 | high | FIXED `bdadf55` | F1 (3) `.remember/successor-<토큰>.prompt` quoted heredoc + `--text "$(cat …)"`(RL §2b 패턴), 보간 금지. AC2·AC6 메타문자 케이스 |
| spec:F1/F2 · create 응답 유실 시 생성된 후계를 식별해 정리할 수 없다 · 상관 토큰 + list 정확 조회 + 미확정 시 차단 | medium | FIXED `bdadf55` | F1 (1) 제목 `<작업명>-<토큰>`, 유실 시 `terminal list` 정확 조회(1개 아니면 F2). F2 (d) 재생성·`/clear` 안내 차단 + 후보 보고. D7과 양립(작업명 유지 + 접미) |

| spec:F1 · 동적 탭 제목을 통한 셸 명령 치환 · 제목 안전 문자 집합 정규화(또는 파일 전달) | medium(재평가 ← high: 제목은 모델이 짓는 짧은 문자열, 정규화 1줄) | FIXED `5548688` | F1 (1) `[A-Za-z0-9._-]` 정규화·≤40. AC1·AC2·F5 셸 안전 케이스. R2-2와 별개 sink(`--title`) |

| spec:F1 · 40자 제목 제한이 응답 유실 회수용 토큰을 잘라낸다 · 토큰 길이 예약 후 작업명만 절단 | medium | FIXED `09e2c67` | F1 (1) 예약·절단 규칙. AC2·F5 장문 작업명 케이스. R2-3·R3-1 조합 결함(재진술 아님) |

미확인 FIXED 큐 = 위 8건(R1 3 + R2 3 + R3 1 + R4 1, 소멸 확인 대기). 루프 직접 판정(ACCEPTED/OUT_OF_SCOPE/DEFERRED/DUPLICATE) = 0. low = 0.
