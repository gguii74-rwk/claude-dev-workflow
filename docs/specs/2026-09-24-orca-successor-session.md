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
  1. `${ORCA_CLI_COMMAND:-orca} terminal create --worktree active --title <작업명> --command claude --json` → 새 핸들 = `startupTerminal.handle`(없으면 `terminal.handle`).
  2. `... terminal wait --terminal <새 핸들> --for tui-idle --timeout-ms 90000 --json` → `satisfied:true` 확인. false면 timeout 2배로 1회 재시도, 그래도 false면 F2.
  3. `... terminal send --terminal <새 핸들> --enter --wait-submit 15 --json --text "<재개 프롬프트>"` → `accepted:true` 확인. false면 F2.
  4. 재개 프롬프트(훅이 템플릿 제공) = "핸드오프 파일 <경로>를 읽고 같은 작업을 이어서 진행. **첫 동작**: 옛 터미널 `<ORCA_TERMINAL_HANDLE>`에 `/exit`를 보내고(`terminal send --text "/exit" --enter`) `tui-idle` 대기 뒤 `terminal close`. 그 전에는 codex를 실행하지 마라." 경로 = 핸드오프 규약 파일(기본 `.remember/remember.md`, review-loop면 루프 파일).
  5. `accepted:true`를 확인했으면 **더 아무것도 하지 말고 턴을 끝낸다** — 후계가 이 세션을 닫는다. 자기 터미널을 스스로 닫지 않는다.
- 정지 보장: 그 다음 Stop은 `stop_hook_active`로 훅이 통과(exit 0)하므로 재넛지 없이 idle. 후계의 `/exit`로 종료.
- 재넛지(15%p 구간) 변형도 같은 (2)를 붙인다(현행 D6 원칙: 재넛지 = 지시 동일 + 사실 추가).

### F2. 실패 폴백

wait `satisfied:false`(재시도 후) 또는 send `accepted:false` 또는 CLI 실행 오류 → 후계를 만들지 못한 것으로 보고 현행 문장("이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요")을 사용자에게 안내한다. 만들다 만 터미널이 있으면 그 핸들을 함께 알린다(닫기는 사람). fail-closed.

### F3. review-loop 문구

- §2b (1) 인용문("…그때 /clear를 안내하라")을 훅 (0)과 같은 새 문장으로 — 바이트 동일 규정 유지.
- §2i 표 3행 "/clear 후 `/review-loop --resume`로 이어가세요" 안내를 "넛지 (2)의 인계 절차(오르카면 후계 스폰, 아니면 /clear 안내)"로 조건화. 재개 프롬프트에 `--resume` 지시가 들어가야 하므로 §2i가 재개 프롬프트 문구를 정한다(훅 템플릿의 "같은 작업을 이어서" 자리에 review-loop 루프 파일 경로 + `/review-loop --resume`).
- 그 외 `/clear` 언급(단계 경계·§2b 완료 전 금지)은 불변.

### F4. 문서·릴리스 1.0.0

- README 3종 §8 끝에 1.0.0 문단(같은 위치): 오르카 터미널이면 후계를 직접 띄우고 정지 · 후계 첫 동작 = 옛 세션 `/exit`→close · 실패 시 /clear 안내로 복귀 · 단계 경계는 대상 밖.
- `plugin.json` `1.0.0`. 사용자 결정: 이 반영으로 정식 1.0.0.
- 설치 갱신 안내 4머신(맥북·OMEN·그램·spark2).

### F5. 훅 테스트

`dev-workflow/hooks/scripts/context-threshold-hook.test.mjs`(`node --test`, 의존성 없음):
- 비오르카: 최초·재넛지 reason이 (0) 인계 문장 교체분을 제외하고 현행 문자열과 동일(고정 문자열 스냅샷).
- 오르카: reason에 create/wait/send 3명령 · `ORCA_TERMINAL_HANDLE` 값 · `/exit` 첫 동작 · 폴백 문장이 있고, "자가 /clear는 불가" 문장이 없다.
- `stopHookActive`·구간 로직은 기존 동작 불변(기존 케이스 유지).

### F6. 실사용 확인 (트랙 완료 조건)

맥북 오르카에서 실제 세션 1회: 넛지 → 핸드오프 → 후계 스폰 → 옛 세션 종료(SessionEnd 정리 확인) → 후계가 review-loop §0 스냅샷 대조로 재개. 결과를 eval repo 보고서에 부기. 파일럿 미측정 3건(§0 재개·실 40% 흐름·서브에이전트 진행 중)을 여기서 닫는다.

## 4. 결정사항

brainstorming 확정(2026-09-24, 사용자): 후계 실행 명령 = `claude` 그대로(기본 설정 상속) · 설계안 1~7 승인. D번호 결정·근거는 3단계 harden-spec에서 채운다.

## 5. Acceptance Criteria (초안 — harden에서 확정)

- **AC1 (F1)**: `ORCA_TERMINAL_HANDLE` 미설정 시 `decideNudge` reason이 0.19.0과 동일하되 (0)의 인계 문장 1개만 신규 문장으로 바뀐다(최초·재넛지, 고정 문자열 대조). 설정 시 reason에 (2) 5항목이 있고 옛 핸들 값이 그대로 들어가며 "자가 /clear는 불가" 문장이 없다.
- **AC2 (F2)**: 오르카 reason에 폴백 조건 3종(wait false·send false·CLI 오류)과 복귀 문장이 명시된다.
- **AC3 (F3)**: RL §2b (1) 인용문 = 훅 (0) 문장(바이트 동일, grep 대조). §2i 표 3행이 조건화되고 재개 프롬프트에 `--resume`가 들어간다. 단계 경계 `/clear` 문장은 불변.
- **AC4 (F4)**: `plugin.json` `1.0.0` · README 3종 같은 위치에 1.0.0 문단 · 설치 갱신 안내 4머신.
- **AC5 (F5)**: `node --test dev-workflow/hooks/scripts/` GREEN, 케이스 ≥ 5.
- **AC6 (F6, 트랙 완료 조건)**: 실사용 1회 기록 — 후계가 옛 세션을 정리하고 §0 대조를 통과해 라운드를 이어감.

## 6. 검증 계획 (개요 — 배치는 5단계 plan에서)

- 단위: AC1·AC2·AC5 = 테스트 파일. AC3·AC4 = grep 대조.
- 실사용: AC6 = 오르카 맥북 1회(`CLAUDE_CTX_THRESHOLD`를 낮춰 재현 가능 — 실 40%까지 기다릴 필요 없음).
- 회귀: 비오르카 환경(env 제거)에서 넛지 문구 diff 0.

## 7. 미해결 질문

- spark2(Linux, Orca 클라이언트 접속)와 Windows에서 `ORCA_TERMINAL_HANDLE` 존재와 `orca` 실행 파일 해소(`ORCA_CLI_COMMAND`/`orca-ide`)가 맥북과 같은가 — 미실측. 1.0.0 완료 조건에는 넣지 않고 잔여 리스크로.
- 훅 reason 길이 증가(명령 3개 + 템플릿)가 넛지 가독성을 해치는가 — harden에서 상한 결정.

## 잔여 리스크 (DEFERRED)

- spark2·Windows 오르카 환경 미실측 — 실패하면 F2 폴백으로 현행 동작에 떨어진다(안전).
- 후계가 첫 동작(옛 세션 종료)을 건너뛰고 codex를 띄우면 옛 세션 `/exit` 시점에 브로커가 내려가 라운드가 죽는다 — 프롬프트 문면으로만 강제. F6에서 관찰.

## 재논의 금지(기결정)

(3단계 harden-spec에서 D번호로 채운다.)
