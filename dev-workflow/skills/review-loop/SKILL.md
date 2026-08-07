---
name: review-loop
description: spec/plan/impl 단계 완료 후 변경을 커밋하고 codex 적대검증을 돌린다. 목표는 "high 0"이 아니라 "미판정(unadjudicated) blocking 0" — 모든 critical/high/medium finding을 FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE/ESCALATE 중 하나로 판정해 ledger에 닫는다. 초반 --auto-rounds회(기본 3)는 자동 모드 — FIXED 자동수정 + 위험군(critical·보안·방향전제) 외 ESCALATE는 batch로 모아 일괄 제시(사람 개입 최소화). 이후 정밀 모드. 매 반복 "커밋 후 리뷰". --max(기본 5)는 적대 라운드 상한이며 확인 라운드는 별도 예산(기본 2)이다.
---

# review-loop

`/codex:adversarial-review`는 `disable-model-invocation: true`라 직접 호출할 수 없으므로, 동일한 companion 스크립트를 Bash로 실행한다.

**Announce:** "review-loop로 적대검증 반복을 시작합니다."

## 핵심 원칙 — 2모드(적대/확인) 위의 판정(adjudication) 루프

- **목표는 finding 0이 아니라 미판정 blocking 0이다.** critical/high/medium이 남아도 무시하지 않는다. 반드시 disposition으로 닫는다. **위험한 건 high의 존재가 아니라 판정 없이 남은 high다.**
- **리뷰 라운드는 2모드로 나뉜다** (자동/정밀 축과 직교 — auto-rounds의 의미·기본값·batch 규약은 불변):
  - **적대(발굴) 모드** — adversarial-review. 목적함수 = 공격(누락·결함 발굴). 초반 라운드. 적대 리뷰어는 몇 번을 돌려도 finding 0을 내지 않는다 — 절대 0은 도달 불가.
  - **확인(중립) 모드** — 후반 라운드. 목적함수 = **"머지 가능한가 판정"**. ledger와 미확인 FIXED 큐를 입력으로 받아 임무 4종을 수행한다(§확인 모드). "신규 blocking 없음, 수정 확인됨"이 정당한 출력이 되어 종료가 자연스러워진다.
- **초반(1~2라운드) = 수정 루프**: 실제 누락·결함을 FIXED로 고친다.
- **3라운드~ 또는 전환 신호 발화 시 = 판정 루프**: finding이 새 영역으로 이동하거나 severity만 흔들리면 더 고치지 말고, ledger에 각 항목을 명시 판정해 닫는다. (문서 비대화·새 high 양산 churn 차단) **판정 루프 전환 신호는 확인 모드 진입 신호를 겸한다** — 순서: 신호 발화 → 모아둔 batch ESCALATE 일괄 제시(미판정 정리) → 확인 모드 진입(§2h).

## 두 큐 — 용어 구분 (혼동 금지)

| 큐 | 내용 | 소비처 |
|---|---|---|
| **수정 큐** | 이번 라운드 분류(§2c)에서 FIXED 후보로 배정되어 지금 고칠 항목들 | §2e·§2f, batch 전환 조건 ③, 전환 신호 ② |
| **미확인 FIXED 큐** | 수정·커밋했으나 아직 소멸 확인이 **기록되지 않은** FIXED의 누적(라운드·resume 경계를 넘어 유지) | 확인 모드 임무 ①, 성공 종료 불변식, 핸드오프 필드 |

- 미확인 FIXED 큐에서 빠지는 경로는 셋뿐: ① 후속 적대 리뷰의 fingerprint 대조에서 재출현하지 않아 ledger에 **'소멸 확인(R#)'을 명시 기록**, ② 확인 라운드 응답의 fingerprint별 **명시 '소멸'**, ③ blocking으로 재분류(재판정). **리뷰 출력의 침묵(언급도 기록도 없음)은 소멸 확인이 아니다** — 기록 없는 항목은 큐에 잔존한다.
- 전환 신호의 "수정 큐 소진" = 최신 적대 라운드 분류 후 신규 FIXED 후보 0건. **미확인 FIXED 큐가 비었는지와 무관하다** — 그 큐는 확인 라운드가 처리한다.

## severity — blocking 여부

- **blocking** = critical / high / medium. 모두 반드시 분류·판정한다.
- **low** = 비-blocking. 요약 기록만(`DEFER_LOW`).

## disposition — blocking finding을 닫는 6가지 판정

| disposition | 의미 | 필수 기재 |
|---|---|---|
| **FIXED** | spec/plan/impl에 반영해 해결 | 소멸 확인이 기록되어야 확정(§두 큐). 또 나오면 재판정 |
| **ACCEPTED** | 실제 위험이나 현 단계에서 의도적 수용 | **이유 + 보완 단계** |
| **DEFERRED_TO_IMPL** | 이 단계(spec/plan)에서 못 닫음, 구현으로 이전 | **impl plan의 AC/테스트에 연결**(spec/plan 전용) |
| **OUT_OF_SCOPE** | 이번 변경 범위 밖 | 별도 follow-up 기록 |
| **DUPLICATE** | 기존 finding과 동일 | 원 finding fingerprint 참조 |
| **ESCALATE** | 사용자 결정 필요 | 사용자가 위 중 하나로 닫음 |

- **미판정(unadjudicated) blocking** = critical/high/medium 중 아직 disposition이 없는 것 + 미확인 FIXED 큐의 항목.
- FIXED 외 판정(ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE)은 ledger에 기록되면 **비-blocking**으로 전환된다. 단, **루프가 직접 내린** 이 판정들은 확인 라운드의 감사 대상으로 남는다(§확인 모드 임무 ③).

## 단계별 "blocking high" 기준 — 무엇을 반드시 닫아야 하나

| phase | blocking high = |
|---|---|
| spec | 목표/범위/정책/보안/데이터 정합성이 모순·누락되어, 이대로 plan을 세우면 잘못 구현될 위험 |
| plan | 구현자가 결정을 새로 해야 하거나, 테스트/마이그레이션/권한/데이터 흐름이 빠져 바로 구현하면 위험 |
| impl | 실제 코드 결함, 테스트 실패, 보안/권한/데이터 손상 가능성 |

- spec/plan에서 "구현 시 조심해야 함" 수준이면 high여도 **plan의 acceptance criteria/task에 반영하고 `DEFERRED_TO_IMPL`로 닫는다.** spec/plan 단계에서 이런 high까지 0으로 만들려 하면 루프가 끝나지 않는다.

## blocking score — 전환 신호 (판정 루프 + 확인 모드 진입)

- weight: `critical=4 · high=3 · medium=1 · low=0`. `score = Σ weight(미판정 blocking)`.
- 매 리뷰마다 score를 기록한다. count가 아닌 score로 봐야 심각도 개선(예: high 2 → medium 2)을 정체로 오판하지 않는다.
- **전환 신호 3종** — 하나라도 발화하면 수정 루프를 멈춘다:
  1. score 2회 연속 비감소(`s_n ≥ s_{n-1} ≥ s_{n-2}`) — 상승 시퀀스(예: 3→4→5)도 포함(후반 상승은 churn의 전형; 실제 확장 중인 결함 표면은 확인 라운드의 blocking 보고→복귀, 재발 시 ESCALATE+whole-branch 권고, 보안 트랙 예외가 받는다)
  2. 수정 큐 소진 — 최신 적대 라운드 분류 후 신규 FIXED 후보 0건
  3. **적대 예산(`--max`) 소진** — 마지막 적대 라운드에서 새 FIXED가 생기고 score가 감소 중이어도, 미확인 FIXED가 있으면 batch 정리 후 **반드시 확인 모드로 진입**한다. 상한 도달이 확인을 건너뛰는 종료 경로가 되어선 안 된다. `--max`는 초과하지 않는다(추가 적대는 복귀 경로뿐)
- 신호 발화 시 소비 순서: ① 모아둔 batch ESCALATE 일괄 제시(미판정 정리) → ② 확인 모드 진입(§2h). 확인 리뷰어는 판정이 정리된 ledger를 받아야 임무 ③(판정 감사)이 유효하다.
- **보안 크리티컬 트랙 예외**: 신호 1(score 정체)을 무시한다 — 신호 2(수정 큐 소진) 또는 신호 3(적대 예산 소진)일 때만 확인 전환. 실결함이 계속 유입되는 동안은 적대가 자연 연장된다(§1 사전 게이트에서 판별).

## finding ledger

모든 finding을 한 표로 추적한다:
- **fingerprint** = `file` + 정규화 `title` + 정규화 `recommendation`(또는 body 핵심 문장). `line`은 보조 참고. **severity는 key에서 제외**(같은 결함이 high↔medium으로 흔들림).
- 각 행: fingerprint · severity · disposition · 근거(ACCEPTED 이유·보완 / DEFERRED 연결 AC·task / DUPLICATE 원본 / OUT_OF_SCOPE follow-up).
- **같은 fingerprint 계열이 2회 이상 반복되면 더 고치지 말고 사용자/설계 결정으로 판정한다**(ESCALATE 또는 ACCEPTED/DEFERRED).
- **위치·단일 원본**: ledger는 해당 phase 산출물 문서 말미의 고정 섹션 `## 적대검증 ledger (<phase>)`에 둔다. 같은 finding 표를 두 문서에 복제하지 말 것 — 다른 문서에서는 참조만 한다(예: plan 헤더에 "ledger = spec §10b"). 복제본은 반드시 어긋난다(실측: 통합 요약본에서 2건 누락 사고).
- **확인 라운드 기록 의무**: 확인 라운드마다 소멸 확인된 FIXED fingerprint 목록·신규 finding·머지 준비도 verdict를 ledger에 기록한다.
- ledger는 종료 시 핸드오프와 **단계 산출물 문서**(plan의 후속/AC 섹션 등)에 명시한다.

## 기결정 가드 — 재지목을 원천에서 줄인다

적대검증자는 spec 결정(D번호)·과거 라운드 판정·사용자 기결정을 모른다. 그래서 같은 결함이 라운드·phase를 넘어 반복 지목되는 것이 최대 낭비다(실측: 동일 fingerprint가 spec→plan→impl 6회차까지 재지목된 사례. 후반 라운드는 대부분 재지목으로 소모).

- **가드를 리뷰 대상 문서 안에 둔다.** 적대검증은 브랜치 diff(문서·코드)를 읽는다. ledger와 "재논의 금지" 목록이 spec/plan 문서 안에 있어야 검증자 눈에 들어간다 — 핸드오프(`.remember/`)에만 두면 검증자는 못 본다.
- phase 산출물 문서에 **"재논의 금지(기결정)" 고정 블록**을 유지한다: 사용자 기결정(D번호·판정 근거)과 ACCEPTED/OUT_OF_SCOPE fingerprint를 열거한다.
- **다음 phase 문서로 승계한다.** plan entrypoint·impl 관련 문서 상단에 전 phase의 재논의 금지 블록을 옮겨 적는다(cross-phase 재지목 차단 — 실측: 승계 가드를 둔 feature는 후속 phase 루프가 R1 즉시 종결됨).
- 2c 판정 시 **신규 finding을 이 가드 목록과 가장 먼저 대조**한다. 일치하면 즉시 DUPLICATE — 수정 큐에 넣지 않는다.

## ESCALATE 세분 — 즉시(IMMEDIATE) vs batch

- **즉시(IMMEDIATE)**: 미루면 잘못된 토대에 작업이 쌓이는 것 — ① critical severity, ② 보안/데이터 손상·유실, ③ **후속 작업의 전제가 되는 방향/아키텍처 결정**. 자동 모드에서도 그 자리에서 묻는다.
- **batch(지연)**: 그 외(UX·정책 범위·국소 선택지·저신뢰). 자동 모드에서는 묻지 않고 ledger에 `ESCALATE(batch-pending)`로 적재 → batch 시점에 일괄 제시.

## 자동 모드 (auto-rounds) — 사람 개입 최소화

사람 개입이 자동화의 병목이므로, 초반 `--auto-rounds`(기본 3) 라운드는 가급적 자동으로 돈다(초반은 실제 누락이 많아 수정 가치가 크다). 이 축(자동/정밀)은 적대/확인 축과 직교다.

- **자동 모드(iteration ≤ auto-rounds)**: FIXED는 자동 수정. ESCALATE는 **즉시군만** 묻고 **batch군은 적재**(안 물음). 매 라운드 게이트 통과 + 커밋.
- **batch 전환(자동 모드 종료)** — 다음 중 하나면 모아둔 batch ESCALATE를 일괄 제시:
  ① iteration이 auto-rounds 도달, ② blocking score 2회 연속 비감소(정체/발산) **조기 전환**, ③ 수정 큐가 비고 남은 게 batch ESCALATE뿐.
- **batch 제시**: 모아둔 batch ESCALATE 전부 + **round별 자동 수정 내역(커밋·diff 요약)**을 한 번에 `AskUserQuestion`. 사용자가 각 항목을 FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE로 닫고, 자동 수정도 검토·롤백할 수 있다.
- **정밀 모드(iteration > auto-rounds)**: 현행대로 ESCALATE 즉시 처리(사람 손을 탄 마무리).
- `--auto-rounds 0`이면 자동 모드 없이 매 라운드 즉시(현행 동작).

## 확인(중립) 모드 — 임무 4종·실행·응답 계약

### 필수 조건 (확인 생략 판단)

확인 라운드 필수 조건 = **미확인 FIXED 큐가 비지 않음 OR 루프가 직접 내린 판정(ACCEPTED/OUT_OF_SCOPE/DEFERRED_TO_IMPL/DUPLICATE) 존재**.
- 루프 전체에서 둘 다 0건이면(예: R1 신규 blocking 0) 확인할 대상이 없으므로 **확인 라운드 없이 빠른 종료**(§2e) — 클린 트랙에 라운드를 추가하지 않는다.
- 미확인 FIXED 없이 루프 직접 판정만 있으면 확인 라운드는 **임무 ③·④만** 수행한다. 루프 직접 DUPLICATE 1건뿐이어도 생략하지 않는다 — 오매칭(실제 신규 결함을 기결정 재론으로 잘못 각하)이 감사 없이 확정되는 경로를 막는다.

### 임무 4종

1. **미확인 FIXED 큐 전체의 소멸 확인** — 직전 라운드 FIXED만이 아니라 큐 전체(부분 확인·복귀·resume 재개 후의 과거 잔여분 포함).
2. **수정이 닿은 영역 주변의 회귀 확인**.
3. **판정 감사** — 루프가 직접 내린 ACCEPTED/OUT_OF_SCOPE/DEFERRED_TO_IMPL/DUPLICATE의 비례성 점검. DEFERRED_TO_IMPL은 impl AC·테스트 연결의 존재·타당성 포함. 루프 직접 DUPLICATE는 **원 fingerprint와의 의미적 동일성·원 disposition 확인만**(오매칭 검출) — 원 기결정 자체의 타당성 재론은 대상이 아니다. **감사 대상 = 루프가 직접 내린 판정만** — 사용자 기결정(D번호·사용자가 닫은 ESCALATE)은 감사 대상이 아니다(프롬프트에 명시).
4. **머지 준비도 verdict**.

프롬프트에 **"신규 영역 발굴은 임무가 아니다. 단, 발견한 blocking은 보고한다"를 명시**한다(도장 찍기 / 사냥 재개 사이 균형).

### 실행 (task 커맨드)

```bash
ROOT=$(ls -d "$HOME"/.claude/plugins/cache/openai-codex/codex/*/ | sort -V | tail -1)
node "${ROOT}scripts/codex-companion.mjs" task --background "<확인 리뷰 프롬프트>"
```
- `adversarial-review`+focus로 대체하지 않는다 — 기저 템플릿이 적대라 확인 목적함수를 누르지 못한다. `task`는 프롬프트 전체를 통제한다.
- **프롬프트 첨부물**: ① ledger 표(루프 직접 판정 표시 포함), ② 미확인 FIXED 큐 전체 — 각 항목에 **원 지적 원문(title·body·recommendation)과 수정 커밋·diff 요약**을 함께 준다(fingerprint만 주면 불완전 수정을 못 잡는다), ③ 리뷰 기준(base ref), ④ 임무 4종 + 응답 형식(아래 계약), ⑤ "신규 영역 발굴은 임무가 아니다. 단, 발견한 blocking은 보고한다", ⑥ 감사 대상 경계(사용자 기결정 제외).
- codex 샌드박스는 read-only — 게이트(테스트)는 현행대로 루프 세션이 실행한다.
- `task` 커맨드 부재(codex 플러그인 구버전) 시: 멈추고 `/codex:setup`(플러그인 갱신) 안내. 임의 대체 실행 금지.

### 응답 완전성 계약 (fail-closed)

확인 리뷰 응답은 다음을 **모두** 갖춰야 완전하다:
- 첨부한 미확인 FIXED 큐의 **전 fingerprint별 명시 결과**(소멸 / 잔존 / blocking 재분류)
- 판정 감사 결과(감사 대상이 있는 경우)
- 신규 finding 목록(없으면 "없음" 명시)
- 머지 준비도 verdict

하나라도 **누락·중복·판독 불가면 부분 응답**이다. 부분 응답과 실행 실패·타임아웃의 처리는 동일하다:
- **소멸 확인으로 간주하지 않는다 — 명시된 항목도 포함해 큐 불변**(부분 수용 금지: 3건 중 2건만 답한 응답으로 그 2건을 닫지 않는다).
- **확인 예산을 소모하지 않는다.**
- 멈추고 원문을 보고한다. **자동 재시도·대체 실행 금지** — 재실행은 사용자 판단.

### 결과 처리

- **큐 전 항목 소멸 확인 + 신규 blocking 0 + 감사 이상 없음 + verdict 통과** → 성공 종료(§2e 불변식 충족). 소멸 확인 fingerprint 목록·verdict를 ledger에 기록.
- **blocking 발견**(큐 항목 잔존/재분류, 회귀, 신규 blocking) → **적대 모드 복귀(상한 1회)**. 복귀 시 적대 1라운드 + 확인 재진입 1라운드가 누적 상한 밖에서 추가 허용된다. **재진입 확인에서 또 blocking이 나오면 → ESCALATE**(edge 표면이 넓다는 신호 — 새 세션 whole-branch 리뷰 권고 동반).
- **판정 감사 이의**(비례성·연결 누락·DUPLICATE 오매칭 지적) → 루프가 스스로 번복하지 않는다. **해당 항목만 ESCALATE로 사용자 재판정**(기결정 가드 규약 유지).
- **verdict 비통과인데 blocking 지목 없음** → 성공 종료 아님·침묵 종료 금지 → **ESCALATE(verdict 근거 동반, 사용자 판정)**. 모든 미충족 성공 불변식은 성공/복귀/ESCALATE 중 하나로 반드시 전이된다(종료 불능 상태 금지).
- **확인 예산 소진(복귀 발동 여부 무관) + 미확인 FIXED 큐 잔존** → ESCALATE + 폴백 3택을 ledger에 명시: ① 다음 phase 리뷰의 필수 확인 항목으로 이월, ② 새 세션에서 확인 라운드 1회(신규 결함이 나오면 whole-branch 리뷰 권고), ③ 배포 smoke/검증을 blocking 체크로 대체.

## 인자

- `--phase spec|plan|impl` (생략 시 변경 내용으로 추론)
- `--max <n>` (기본 5) — **적대(발굴·수정) 라운드 상한**. 확인 라운드는 세지 않는다
- `--confirm-rounds <n>` (기본 2) — **확인 라운드 예산**. 루프 전체 누적 상한이며 복귀 재진입 시 초기화되지 않는다. 복귀(1회) 시 적대 1 + 확인 재진입 1이 상한 밖 추가 허용 → 총 라운드 유계 = 기본값 기준 최대 9회(적대 5 + 확인 2 + 복귀 적대 1 + 재진입 확인 1). **확인 필수 조건이 성립하는데 0으로 설정되어 있으면 시작(resume 포함) 시 ESCALATE** — 그대로 진행하지 않는다
- `--base <ref>` — 적대검증이 보는 브랜치 diff 기준 = **트랙 기준 ref**(기본 `main`이되 release/develop 등 비-main 기준 트랙은 그 ref). **루프 시작 시 해소해 핸드오프 base 필드로 보존**한다
- `--resume` — `.remember/remember.md`의 미완 루프 상태에서 이어서 시작(§0 스냅샷 대조 통과 시)
- `--auto-rounds <n>` (기본 3) — 초반 n회 **자동 모드**(FIXED 자동수정 + 위험군 외 ESCALATE batch 적재). `0`이면 매 라운드 즉시(현행). 보안 크리티컬 작업은 낮게(예: 1).

## phase별 리뷰 입도 · 증분 base 안전조건 · SDD 연계

| phase | 리뷰 입도 |
|---|---|
| spec | 단일 1회 |
| plan | **통합 1회 — task 파일별로 쪼개지 말 것**(task 간 정합성이 plan의 가치; 분할 리뷰는 교차 결함을 구조적으로 못 본다) |
| impl | task별 증분(`--base <직전 task 커밋>`) + **마지막 통합 1회** |

- **증분 base 안전조건**: `--base <직전 task>` 증분 리뷰는 이전 task 회귀를 못 본다. **마지막에 반드시 트랙 기준 ref로 통합 리뷰 1회**(`--base <트랙 기준 ref>` — 루프 시작 시 해소해 둔 핸드오프 base 필드 값).
- **SDD 연계**: SDD(superpowers:subagent-driven-development) 내장 리뷰(건설)와 codex(적대)는 보완 관계다. **codex를 task마다 끼우지 않는다** — SDD가 approved 커밋을 끝낸 뒤 **그 위에서** 돌린다(동시 수정 금지). 실측: SDD 내장 리뷰를 잘 돌린 트랙은 review-loop impl이 R1 종결.

## 절차

### 0. resume 점검
`--resume`이거나 `.remember/remember.md`에 review-loop 미완 상태가 있으면 복원한다. 없으면 iteration=1, 빈 ledger, 적대 모드로 시작.
- **복원 필드**: phase / 적대 라운드 소진 카운트(iteration) / 확인 라운드 소진 카운트 / 현재 모드(적대·확인) / 복귀 사용 여부 / base(해소된 ref + SHA) / branch / 중단 시 HEAD SHA / ledger(미확인 FIXED 큐 명시 포함) / score 이력 / 보안 크리티컬 트랙 판정 상태.
- **스냅샷 대조(fail-closed)**: 복원 전에 현재 git 상태와 대조한다 — 브랜치 동일? HEAD == 기록된 HEAD SHA? base SHA 불변? **하나라도 불일치(중단 중 커밋 추가·브랜치 이동·base 이동)면 모드·예산·큐를 복원하지 않고 중단 보고한다.** 재개 방식은 사용자 판단(통상 적대 1회 재실행 권고). 확인 모드는 신규 발굴을 하지 않으므로, 미검토 커밋이 큐 소멸·merge-ready 판정을 받는 경로를 차단하는 것이 목적이다.
- 확인 필수 조건 성립 + 확인 예산 0이면 시작하지 않고 ESCALATE(§인자).

### 1. 사전 게이트 (phase별 관문)

| phase | 관문 |
|---|---|
| spec | 목표·범위·비목표·결정사항·acceptance criteria·미해결 질문이 문서에 명시 |
| plan | 구현 단위·파일/인터페이스 영향·테스트 계획·가정이 문서에 명시 |
| impl | `npm run typecheck && npm run lint && npm test && npm run build` |

impl 게이트가 실패하면 루프를 시작하지 말고 먼저 해결한다(systematic-debugging). 깨진 상태로 리뷰 금지. spec/plan은 위 명시 관문을 충족하는지 확인한 뒤 진행한다.

추가로 루프 시작 시:
- **base 해소**: 트랙 기준 ref(기본 main, 비-main 트랙은 그 ref)를 확정하고 SHA와 함께 기록한다(§인자).
- **보안 크리티컬 자가 판정**: 변경 접촉면이 ESCALATE 즉시군 계열(권한·인증·보안 경계·데이터 손상/유실·비가역 마이그레이션)에 닿으면, 사용자에게 "보안 크리티컬 트랙으로 취급할지" **확인 1회**. 보안 트랙이면 전환 신호에서 score 정체를 무시한다(§blocking score).

### 2. 반복 — 적대 라운드 (iteration = 시작값..max)

iteration은 **적대 라운드만** 센다. 확인 라운드는 `--confirm-rounds` 예산으로 별도 계수한다.

#### 2a. 커밋 우선 — 핵심
작업 트리에 미커밋 변경이 있으면 의미 있는 메시지로 커밋한다(AI 서명 금지).
```bash
git branch --show-current              # 의도한 브랜치인지 확인
git status --short                     # 이 루프의 변경만 식별
git add <이 루프에서 수정한 파일들>       # 명시적 stage
git commit -m "<무엇을 했는지>"
```
- **`git add -A` 금지.** 같은 워킹트리를 다른 세션과 공유할 수 있고, 커밋하면 안 되는 untracked 파일·다른 세션의 미커밋 작업이 섞인다. 이 루프에서 수정한 파일만 명시적으로 stage한다.
- `.git/index.lock`이 존재하면 다른 세션이 git 사용 중 — 지우지 말고 끝나길 기다린다.

**이유: 적대검증은 커밋된 HEAD(브랜치 diff) 기준으로 본다. 미커밋이면 직전 수정을 놓친다.** 그래서 항상 "수정→커밋→리뷰" 순서.

#### 2b. 리뷰 실행 (모드 분기)
- **적대 모드**:
```bash
ROOT=$(ls -d "$HOME"/.claude/plugins/cache/openai-codex/codex/*/ | sort -V | tail -1)
node "${ROOT}scripts/codex-companion.mjs" adversarial-review --wait --base <ref>
```
- 변경이 크면(여러 파일/디렉터리 단위) `run_in_background: true`로 띄우고 `/codex:status`로 폴링한다. 결과 파일에서 리뷰 본문만 추출: `sed -n '/^# Codex Adversarial Review/,$p' <출력 파일>`.
- 출력 JSON을 파싱한다: `{ verdict, summary, findings[{severity,title,body,file,line_start,line_end,confidence,recommendation}], next_steps }`.
- 출력이 스키마와 다르면 루프를 멈추고 원문을 보고한다(추측 금지). 자동 재시도 금지 — 재실행은 사용자 판단.
- companion이 미설치/미인증으로 실패하면 멈추고 `/codex:setup`을 안내한다(임의 수정 금지).
- **확인 모드**: §확인 모드의 실행·응답 계약을 따른다(`task` 커맨드).

#### 2c. 분류 · 판정(disposition) · ledger 갱신
각 finding을 fingerprint로 ledger와 대조한다(신규/잔존/해결/중복). 미확인 FIXED 큐 항목이 재출현하지 않았으면 '소멸 확인(R#)'을 명시 기록하고 큐에서 뺀다(§두 큐 — 기록 없는 침묵은 잔존).
- **기결정 가드 먼저**: 현 phase ledger뿐 아니라 **전 phase ledger와 "재논의 금지(기결정)" 블록**까지 대조한다. 이미 ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE로 닫혔거나 사용자 기결정(D번호)을 뒤집으라는 요구면 → **DUPLICATE**(비-blocking, 재수정·재논의 금지). 현 phase ledger가 비어 있어도 전 phase에서 닫힌 항목이면 신규 finding이 아니다.
- **severity 재평가 (문자적 갭)**: LLM이 해석하는 문서(스킬·spec·plan)의 문자적 논리 갭은 **실행 영향으로 severity를 재평가한다**(문자적 갭 ≠ 즉시 high). 실행이 자동 보완하는 갭(예: 규범 문구가 명시적이라 예시의 어긋남을 덮는 경우)은 낮춰 판정하되, **닫는 수정이 저비용이면 반영한다** — 하향은 score 오염(가짜 정체·발산 신호)을 막고, 수정 반영은 갭을 실제로 없앤다.
- low → `DEFER_LOW`.
- 신규 blocking(critical/high/medium)에 disposition 부여(보수적):
  - **FIXED 후보**: 수정 방향이 명확 — 버그, 누락 가드, 테스트 공백, 경쟁조건/원자성, 잘못된 권한 검사 등. → 수정 큐로.
  - **ACCEPTED / DEFERRED_TO_IMPL / OUT_OF_SCOPE**: 위 단계별 기준에 따라 즉시 판정해 닫는다(근거 기재).
  - **ESCALATE**: (a) 제품 범위/동작(UX·정책) 변경, (b) 설계 spec 의도에 반함, (c) 유효 설계 선택지 2+, (d) 보안·데이터 트레이드오프, (e) confidence 낮음 — 하나라도 해당.
- 미판정 blocking score를 계산해 이력에 기록.

#### 2d. ESCALATE 처리 (모드 분기)
- **자동 모드(iteration ≤ auto-rounds)**: **즉시(IMMEDIATE)군만** `AskUserQuestion`으로 처리(각 항목: 무엇이/왜/영향/선택지). batch군은 ledger에 `ESCALATE(batch-pending)`로 적재(안 물음).
- **batch 전환 시점 / 정밀 모드(iteration > auto-rounds)**: 모아둔 batch ESCALATE를 **일괄** `AskUserQuestion` + **round별 자동수정 내역(커밋·diff 요약)** 동반. 사용자가 각 항목을 **FIXED·ACCEPTED·DEFERRED_TO_IMPL·OUT_OF_SCOPE 중 하나로 닫거나** "지금 멈추고 직접 본다"를 택한다. 중단 선택 시 핸드오프(ledger 포함)를 쓰고 종료.

#### 2e. 종료 판정
- **빠른 종료**: 루프 전체에서 미확인 FIXED 큐 0건 **AND** 루프 직접 판정(ACCEPTED/OUT_OF_SCOPE/DEFERRED_TO_IMPL/DUPLICATE) 0건 **AND** 미판정 blocking 0 → 확인 라운드 없이 즉시 성공 종료. 4번으로. (확인할 대상이 없는 클린 트랙 — 라운드를 추가하지 않는다)
- **성공 종료(확인 경유) 불변식**: 미판정 blocking == 0 **AND** 미확인 FIXED 큐가 빔(전 항목 소멸 확인 또는 blocking 재분류 기록) **AND** 확인 라운드 verdict 통과. 셋 다 충족해야 성공 종료 → 4번으로. (적대 라운드의 verdict는 보고 항목일 뿐 게이트가 아니다 — 게이트는 확인 라운드 verdict)
- 수정 큐가 남아 있으면(이번에 고칠 게 있으면) 2f로.
- 전환 신호가 발화했으면 2h로(확인 모드 진입 판단).

#### 2f. FIXED 처리 (phase 분기)
수정 큐를 처리한다.
- **impl**: 각 항목을 TDD로 고친다 — 재현/실패 테스트 → 최소 수정 → 게이트 통과. 가능하면 `superpowers:subagent-driven-development` 패턴.
- **spec/plan**: 문서를 수정한 뒤 ① 해당 phase 관문(§1) 재확인 + ② **변경된 결정/가정/AC/테스트 기준이 문서 내부에서 상호모순 없는지 자체 점검**.
- 수정한 항목은 미확인 FIXED 큐에 들어간다(소멸 확인 기록 전까지).
- `DEFERRED_TO_IMPL`로 닫은 항목은 impl plan의 acceptance criteria/테스트에 기재한다(연결 누락 금지).

#### 2g. 게이트 재실행
phase=impl이면 §1 게이트를 다시 통과시킨다. 깨지면 그 반복을 커밋하지 말고 원인부터 해결한다(spec/plan은 관문 재확인으로 갈음).

#### 2h. 전환 신호 처리 — batch 정리 → 확인 모드
- **조기 batch 전환(자동 모드)**: 자동 모드 중 blocking score가 2회 연속 비감소면 auto-rounds를 다 쓰기 전이라도 batch 제시로 전환한다(자동 라운드 낭비 방지).
- **전환 신호 발화 시**(§blocking score 3종 — 보안 트랙은 신호 2·3만):
  1. 모아둔 batch ESCALATE를 일괄 제시해 미판정을 정리한다.
  2. 확인 필수 조건 점검(§확인 모드): 미확인 FIXED 큐도 루프 직접 판정도 0건이면 §2e 빠른 종료. 아니면 **확인 모드 진입** — 이후 라운드는 §확인 모드의 실행·응답 계약·결과 처리를 따른다(복귀 1회, 예산 소진 시 ESCALATE+폴백 3택 포함).
- 판정 루프 국면에서는 남은 미판정 blocking을 더 FIXED로 쫓지 말고 ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/ESCALATE로 닫는 데 집중한다. (churn 차단)
- **적대 예산 소진 시에도 동일**: 미확인 FIXED가 있으면 batch 정리 후 반드시 확인 모드로 진입한다 — §2h의 폴백 3택은 **확인 예산까지 소진된 뒤**의 안전망이다(§확인 모드 결과 처리).

#### 2i. 컨텍스트 점검
컨텍스트 사용량이 ≥40%로 느껴지면(또는 Stop 훅이 넛지하면): `.remember/remember.md`에 핸드오프를 쓰고, 사용자에게 "/clear 후 `/review-loop --resume`로 이어가세요"라고 안내한 뒤 이 세션의 루프를 종료한다. (자가 /clear 불가)
- **핸드오프 필드**(§0 복원 필드와 동일 목록): phase / 적대 라운드 소진 카운트 / 확인 라운드 소진 카운트 / 현재 모드 / 복귀 사용 여부 / base(해소된 ref + SHA) / branch / 중단 시 HEAD SHA / ledger(미확인 FIXED 큐 명시 포함) / score 이력 / 보안 크리티컬 트랙 판정 상태.

#### 2j. 다음 반복
iteration++ 하고 2a로 돌아간다(다음 반복도 커밋 후 리뷰).

### 3. (반복 끝의 커밋은 2a가 다음 반복 시작에 수행)

### 4. 종료 요약 + ledger
보고:
- 총 반복 횟수(적대/확인 구분), blocking score **회차별 추세표**(iteration별 critical/high/medium 개수 + 신규/잔존 구분).
- **disposition별 집계**: FIXED / ACCEPTED / DEFERRED_TO_IMPL / OUT_OF_SCOPE / DUPLICATE / ESCALATE, 남은 low.
- **확인 부채 보고**: 미확인 FIXED 큐가 비었는지(성공 종료면 0이어야 함). 폴백 3택으로 이월한 항목이 있으면 명시.
- 최종 verdict(확인 라운드 verdict — 빠른 종료면 해당 없음 명시).
- **no-AI-trace 확인**: 이번 루프가 만든 커밋 메시지·문서에 AI 도구 흔적이 없는지 grep으로 확인한다(예: `git log --format=%B <base>..HEAD | grep -iE 'co-authored|generated with'` + 이번 루프가 수정한 문서 동일 검사). 운영 프로젝트 no-AI-trace 규칙.
- **(impl 한정) UI 대조 안내**: UI 기능이면(spec에 `## UI 설계` 존재) `docs/design/<feature>/`의 선택 목업·`docs/design/style-guide.md`와 구현된 화면을 **사용자가 수동 대조**하도록 **1회 안내**한다(매 라운드 아님, 자동 비교 없음).

**단계 경계(spec→plan, plan→impl)**:
- ledger의 ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE를 **다음 단계 진입 전 단계 산출물 문서에 명시**한다(blocking unresolved 채로 다음 단계 진입 금지).
- spec/plan의 `DEFERRED_TO_IMPL` high는 impl plan의 테스트/acceptance criteria로 연결한다.
- 핸드오프를 쓰고 "다음 단계는 /clear 후 시작하세요 + <다음 단계 진입 안내>"를 덧붙인다.

## 종료 조건 요약
- ✅ 빠른 종료: 미확인 FIXED 큐 0 + 루프 직접 판정 0 + 미판정 0 → 확인 라운드 없이 성공 종료
- ✅ 확인 경유 성공 종료: 미판정 0 + **미확인 FIXED 큐가 빔** + 확인 verdict 통과 (확인 부채 0)
- 🤖 자동 모드(iteration ≤ --auto-rounds, 기본 3): FIXED 자동수정 + batch ESCALATE 적재, 위험군만 즉시
- 📋 batch 전환(auto-rounds 도달 · score 정체 · 수정 큐 소진): 모아둔 ESCALATE + 자동수정 내역 일괄 제시
- 🔁 전환 신호(score 2회 연속 비감소 · 수정 큐 소진 · 적대 예산 소진) → batch 정리 → **확인 모드 진입**(종료가 아니라 모드 전환; 보안 트랙은 score 정체 무시)
- 🔁 확인에서 blocking → 적대 복귀 1회 → 재진입 확인. 재발 시 ESCALATE + whole-branch 리뷰 권고
- ⏸ verdict 비통과(blocking 없음) → ESCALATE(근거 동반, 사용자 판정)
- ⏸ 확인 예산 소진 + 큐 잔존 → ESCALATE + 폴백 3택(이월/새 세션 확인/배포 검증 대체)
- ⏸ ESCALATE에서 사용자가 중단 선택 → 핸드오프(ledger 포함)
- ⏸ 컨텍스트 ≥40% → 핸드오프 + /clear 안내 후 종료(resume로 이어감)

## 운영 규칙 (불안 줄이는 기준)
- critical/high/medium은 **모두 반드시 분류·판정**한다.
- blocking unresolved(미판정)가 있으면 **다음 단계로 가지 않는다**.
- ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE는 다음 단계 진입 전 **문서에 명시**한다.
- spec/plan에서 DEFERRED된 high는 impl plan의 **테스트/acceptance criteria로 연결**한다.
- 같은 fingerprint 계열이 **2회 이상 반복되면 더 수정하지 말고** 사용자/설계 결정으로 판정한다.
- 성공 종료 전 **미확인 FIXED 큐가 비었는지** 확인한다(확인 부채 0).

## 하지 말 것
- high를 **판정 없이** 남기지 말 것(존재 자체보다 미판정이 위험).
- 3라운드 넘어 churn(새 영역·severity 흔들림)을 계속 FIXED로 쫓지 말 것 — 판정으로 닫아라.
- **기결정 가드·전 phase ledger에서 닫힌 항목을 다시 FIXED로 고치지 말 것** — 사용자 결정 번복이다. DUPLICATE로 각하한다(severity가 격상돼 다시 와도 동일).
- low를 이 루프에서 고치지 말 것(`DEFER_LOW` — 요약 기록만).
- `git add -A`로 커밋하지 말 것(무관한 untracked·다른 세션 작업 혼입 — 명시적 stage).
- 미커밋 상태로 적대검증 돌리지 말 것(직전 수정을 못 본다).
- fingerprint key에 severity를 넣지 말 것(high↔medium 흔들림으로 추적이 깨진다).
- ACCEPTED/DEFERRED_TO_IMPL을 근거·연결 없이 닫지 말 것.
- **리뷰 출력의 침묵을 소멸 확인으로 간주하지 말 것** — '소멸 확인' 명시 기록 없는 FIXED는 미확인 FIXED 큐에 잔존한다.
- **불완전한 확인 응답을 부분 수용하지 말 것** — 큐 일부만 답한 응답으로 그 일부를 닫으면 안 된다(전체 무효·큐 불변·예산 미차감).
- **적대 예산 소진을 이유로 확인 라운드를 건너뛰지 말 것** — 미확인 FIXED가 있으면 확인 모드로 진입한다(폴백 3택은 확인 예산까지 소진된 뒤의 안전망).
- **확인 라운드 실패·부분 응답을 자동 재시도하지 말 것** — 재실행은 사용자 판단.
- **판정 감사 이의를 루프가 스스로 번복 처리하지 말 것** — 해당 항목만 ESCALATE.
- 커밋 메시지에 AI 서명 넣지 말 것(글로벌 규칙).
