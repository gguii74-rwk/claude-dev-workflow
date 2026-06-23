---
name: review-loop
description: spec/plan/impl 단계 완료 후 변경을 커밋하고 codex 적대검증을 돌린다. 목표는 "high 0"이 아니라 "미판정(unadjudicated) blocking 0" — 모든 critical/high/medium finding을 FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE/ESCALATE 중 하나로 판정해 ledger에 닫는다. 초반 --auto-rounds회(기본 3)는 자동 모드 — FIXED 자동수정 + 위험군(critical·보안·방향전제) 외 ESCALATE는 batch로 모아 일괄 제시(사람 개입 최소화). 이후 정밀 모드. 매 반복 "커밋 후 리뷰". 최대 5회.
---

# review-loop

`/codex:adversarial-review`는 `disable-model-invocation: true`라 직접 호출할 수 없으므로, 동일한 companion 스크립트를 Bash로 실행한다.

**Announce:** "review-loop로 적대검증 반복을 시작합니다."

## 핵심 원칙 — 판정(adjudication) 루프

- **목표는 finding 0이 아니라 미판정 blocking 0이다.** critical/high/medium이 남아도 무시하지 않는다. 반드시 disposition으로 닫는다. **위험한 건 high의 존재가 아니라 판정 없이 남은 high다.**
- **초반(1~2라운드) = 수정 루프**: 실제 누락·결함을 FIXED로 고친다.
- **3라운드~ 또는 blocking score 정체 시 = 판정 루프**: finding이 새 영역으로 이동하거나 severity만 흔들리면 더 고치지 말고, ledger에 각 항목을 명시 판정해 닫는다. (문서 비대화·새 high 양산 churn 차단)

## severity — blocking 여부

- **blocking** = critical / high / medium. 모두 반드시 분류·판정한다.
- **low** = 비-blocking. 요약 기록만(`DEFER_LOW`).

## disposition — blocking finding을 닫는 6가지 판정

| disposition | 의미 | 필수 기재 |
|---|---|---|
| **FIXED** | spec/plan/impl에 반영해 해결 | 다음 리뷰에서 사라져야 확정. 또 나오면 재판정 |
| **ACCEPTED** | 실제 위험이나 현 단계에서 의도적 수용 | **이유 + 보완 단계** |
| **DEFERRED_TO_IMPL** | 이 단계(spec/plan)에서 못 닫음, 구현으로 이전 | **impl plan의 AC/테스트에 연결**(spec/plan 전용) |
| **OUT_OF_SCOPE** | 이번 변경 범위 밖 | 별도 follow-up 기록 |
| **DUPLICATE** | 기존 finding과 동일 | 원 finding fingerprint 참조 |
| **ESCALATE** | 사용자 결정 필요 | 사용자가 위 중 하나로 닫음 |

- **미판정(unadjudicated) blocking** = critical/high/medium 중 아직 disposition이 없는 것 + FIXED로 수정했으나 아직 재확인 안 된 것.
- FIXED 외 판정(ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE)은 ledger에 기록되면 **비-blocking**으로 전환된다.

## 단계별 "blocking high" 기준 — 무엇을 반드시 닫아야 하나

| phase | blocking high = |
|---|---|
| spec | 목표/범위/정책/보안/데이터 정합성이 모순·누락되어, 이대로 plan을 세우면 잘못 구현될 위험 |
| plan | 구현자가 결정을 새로 해야 하거나, 테스트/마이그레이션/권한/데이터 흐름이 빠져 바로 구현하면 위험 |
| impl | 실제 코드 결함, 테스트 실패, 보안/권한/데이터 손상 가능성 |

- spec/plan에서 "구현 시 조심해야 함" 수준이면 high여도 **plan의 acceptance criteria/task에 반영하고 `DEFERRED_TO_IMPL`로 닫는다.** spec/plan 단계에서 이런 high까지 0으로 만들려 하면 루프가 끝나지 않는다.

## blocking score — 판정 루프 전환 신호

- weight: `critical=4 · high=3 · medium=1 · low=0`. `score = Σ weight(미판정 blocking)`.
- 매 리뷰마다 score를 기록한다. count가 아닌 score로 봐야 심각도 개선(예: high 2 → medium 2)을 정체로 오판하지 않는다.
- 2~3라운드 후 score가 2회 연속 줄지 않으면(`s_n ≥ s_{n-1} ≥ s_{n-2}`) → **수정 루프를 멈추고 판정 루프로 전환**. 남은 미판정 blocking을 ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/ESCALATE로 닫는다.

## finding ledger

모든 finding을 한 표로 추적한다:
- **fingerprint** = `file` + 정규화 `title` + 정규화 `recommendation`(또는 body 핵심 문장). `line`은 보조 참고. **severity는 key에서 제외**(같은 결함이 high↔medium으로 흔들림).
- 각 행: fingerprint · severity · disposition · 근거(ACCEPTED 이유·보완 / DEFERRED 연결 AC·task / DUPLICATE 원본 / OUT_OF_SCOPE follow-up).
- **같은 fingerprint 계열이 2회 이상 반복되면 더 고치지 말고 사용자/설계 결정으로 판정한다**(ESCALATE 또는 ACCEPTED/DEFERRED).
- ledger는 종료 시 핸드오프와 **단계 산출물 문서**(plan의 후속/AC 섹션 등)에 명시한다.

## ESCALATE 세분 — 즉시(IMMEDIATE) vs batch

- **즉시(IMMEDIATE)**: 미루면 잘못된 토대에 작업이 쌓이는 것 — ① critical severity, ② 보안/데이터 손상·유실, ③ **후속 작업의 전제가 되는 방향/아키텍처 결정**. 자동 모드에서도 그 자리에서 묻는다.
- **batch(지연)**: 그 외(UX·정책 범위·국소 선택지·저신뢰). 자동 모드에서는 묻지 않고 ledger에 `ESCALATE(batch-pending)`로 적재 → batch 시점에 일괄 제시.

## 자동 모드 (auto-rounds) — 사람 개입 최소화

사람 개입이 자동화의 병목이므로, 초반 `--auto-rounds`(기본 3) 라운드는 가급적 자동으로 돈다(초반은 실제 누락이 많아 수정 가치가 크다).

- **자동 모드(iteration ≤ auto-rounds)**: FIXED는 자동 수정. ESCALATE는 **즉시군만** 묻고 **batch군은 적재**(안 물음). 매 라운드 게이트 통과 + 커밋.
- **batch 전환(자동 모드 종료)** — 다음 중 하나면 모아둔 batch ESCALATE를 일괄 제시:
  ① iteration이 auto-rounds 도달, ② blocking score 2회 연속 비감소(정체/발산) **조기 전환**, ③ FIXED 큐가 비고 남은 게 batch ESCALATE뿐.
- **batch 제시**: 모아둔 batch ESCALATE 전부 + **round별 자동 수정 내역(커밋·diff 요약)**을 한 번에 `AskUserQuestion`. 사용자가 각 항목을 FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE로 닫고, 자동 수정도 검토·롤백할 수 있다.
- **정밀 모드(iteration > auto-rounds)**: 현행대로 ESCALATE 즉시 처리(사람 손을 탄 마무리).
- `--auto-rounds 0`이면 자동 모드 없이 매 라운드 즉시(현행 동작).

## 인자

- `--phase spec|plan|impl` (생략 시 변경 내용으로 추론)
- `--max <n>` (기본 5) — 리뷰 실행 횟수의 절대 상한
- `--base <ref>` (기본 `main`) — 적대검증이 보는 브랜치 diff 기준
- `--resume` — `.remember/remember.md`의 미완 루프 상태(ledger 포함)에서 이어서 시작
- `--auto-rounds <n>` (기본 3) — 초반 n회 **자동 모드**(FIXED 자동수정 + 위험군 외 ESCALATE batch 적재). `0`이면 매 라운드 즉시(현행). 보안 크리티컬 작업은 낮게(예: 1).

## 절차

### 0. resume 점검
`--resume`이거나 `.remember/remember.md`에 review-loop 미완 상태(phase/iteration/base/ledger/score 이력)가 있으면 복원한다. 없으면 iteration=1, 빈 ledger로 시작.

### 1. 사전 게이트 (phase별 관문)

| phase | 관문 |
|---|---|
| spec | 목표·범위·비목표·결정사항·acceptance criteria·미해결 질문이 문서에 명시 |
| plan | 구현 단위·파일/인터페이스 영향·테스트 계획·가정이 문서에 명시 |
| impl | `npm run typecheck && npm run lint && npm test && npm run build` |

impl 게이트가 실패하면 루프를 시작하지 말고 먼저 해결한다(systematic-debugging). 깨진 상태로 리뷰 금지. spec/plan은 위 명시 관문을 충족하는지 확인한 뒤 진행한다.

### 2. 반복 (iteration = 시작값..max)

#### 2a. 커밋 우선 — 핵심
작업 트리에 미커밋 변경이 있으면 의미 있는 메시지로 커밋한다(AI 서명 금지).
```bash
git add -A && git commit -m "<무엇을 했는지>"   # 변경 있을 때만
```
**이유: 적대검증은 커밋된 HEAD(브랜치 diff) 기준으로 본다. 미커밋이면 직전 수정을 놓친다.** 그래서 항상 "수정→커밋→리뷰" 순서.

#### 2b. 적대검증 실행 (entrypoint §SC-3)
```bash
ROOT=$(ls -d "$HOME"/.claude/plugins/cache/openai-codex/codex/*/ | sort -V | tail -1)
node "${ROOT}scripts/codex-companion.mjs" adversarial-review --wait --base <ref>
```
- 변경이 크면(여러 파일/디렉터리 단위) `run_in_background: true`로 띄우고 `/codex:status`로 폴링한다.
- 출력 JSON을 파싱한다: `{ verdict, summary, findings[{severity,title,body,file,line_start,line_end,confidence,recommendation}], next_steps }`.
- 출력이 스키마와 다르면 루프를 멈추고 원문을 보고한다(추측 금지).
- companion이 미설치/미인증으로 실패하면 멈추고 `/codex:setup`을 안내한다(임의 수정 금지).

#### 2c. 분류 · 판정(disposition) · ledger 갱신 (entrypoint §SC-2)
각 finding을 fingerprint로 ledger와 대조한다(신규/잔존/해결/중복).
- 이미 ledger에서 ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE로 닫힌 fingerprint면 → **DUPLICATE**(비-blocking, 재수정 금지).
- low → `DEFER_LOW`.
- 신규 blocking(critical/high/medium)에 disposition 부여(보수적):
  - **FIXED 후보**: 수정 방향이 명확 — 버그, 누락 가드, 테스트 공백, 경쟁조건/원자성, 잘못된 권한 검사 등. → FIXED 큐로.
  - **ACCEPTED / DEFERRED_TO_IMPL / OUT_OF_SCOPE**: 위 단계별 기준에 따라 즉시 판정해 닫는다(근거 기재).
  - **ESCALATE**: (a) 제품 범위/동작(UX·정책) 변경, (b) 설계 spec 의도에 반함, (c) 유효 설계 선택지 2+, (d) 보안·데이터 트레이드오프, (e) confidence 낮음 — 하나라도 해당.
- 미판정 blocking score를 계산해 이력에 기록.

#### 2d. ESCALATE 처리 (모드 분기)
- **자동 모드(iteration ≤ auto-rounds)**: **즉시(IMMEDIATE)군만** `AskUserQuestion`으로 처리(각 항목: 무엇이/왜/영향/선택지). batch군은 ledger에 `ESCALATE(batch-pending)`로 적재(안 물음).
- **batch 전환 시점 / 정밀 모드(iteration > auto-rounds)**: 모아둔 batch ESCALATE를 **일괄** `AskUserQuestion` + **round별 자동수정 내역(커밋·diff 요약)** 동반. 사용자가 각 항목을 **FIXED·ACCEPTED·DEFERRED_TO_IMPL·OUT_OF_SCOPE 중 하나로 닫거나** "지금 멈추고 직접 본다"를 택한다. 중단 선택 시 핸드오프(ledger 포함)를 쓰고 종료.

#### 2e. 종료 판정 (entrypoint §SC-1)
**미판정 blocking == 0 AND 이번 라운드 FIXED 큐 == 0이면 → 성공 종료. 4번으로.**
- 빠른 경로: 신규 blocking이 없고 ledger가 모두 닫혀 있으면 즉시 종료.
- FIXED 큐가 남아 있으면(이번에 고칠 게 있으면) 2f로 — 수정 후 다음 라운드 리뷰에서 사라졌는지 재확인.

#### 2f. FIXED 처리 (phase 분기)
FIXED 큐를 처리한다.
- **impl**: 각 항목을 TDD로 고친다 — 재현/실패 테스트 → 최소 수정 → 게이트 통과. 가능하면 `superpowers:subagent-driven-development` 패턴.
- **spec/plan**: 문서를 수정한 뒤 ① 해당 phase 관문(§1) 재확인 + ② **변경된 결정/가정/AC/테스트 기준이 문서 내부에서 상호모순 없는지 자체 점검**.
- `DEFERRED_TO_IMPL`로 닫은 항목은 impl plan의 acceptance criteria/테스트에 기재한다(연결 누락 금지).

#### 2g. 게이트 재실행
phase=impl이면 §1 게이트를 다시 통과시킨다. 깨지면 그 반복을 커밋하지 말고 원인부터 해결한다(spec/plan은 관문 재확인으로 갈음).

#### 2h. 조기 batch · 판정 루프 전환 · 횟수 한도
- **조기 batch 전환(자동 모드)**: 자동 모드 중 blocking score가 2회 연속 비감소면 auto-rounds를 다 쓰기 전이라도 batch 제시로 전환한다(자동 라운드 낭비 방지).
- **판정 루프 전환**: 최근 두 리뷰에서 blocking score가 연속 비감소(`s_n ≥ s_{n-1} ≥ s_{n-2}`)면 → 이후 라운드는 더 FIXED로 쫓지 말고 남은 미판정 blocking을 ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/ESCALATE로 닫는 데 집중한다. (churn 차단)
- **횟수 한도**: iteration > max(기본 5)이면 멈춘다. 멈추기 전 남은 미판정 blocking을 가능한 한 판정으로 닫고, 못 닫는 것만 ESCALATE로 사용자에게 넘긴다. (미판정 채로 방치 금지)

#### 2i. 컨텍스트 점검 (entrypoint §SC-4/SC-5)
컨텍스트 사용량이 ≥40%로 느껴지면(또는 Stop 훅이 넛지하면): `.remember/remember.md`에 핸드오프(phase/iteration/base/ledger/score 이력)를 쓰고, 사용자에게 "/clear 후 `/review-loop --resume`로 이어가세요"라고 안내한 뒤 이 세션의 루프를 종료한다. (자가 /clear 불가)

#### 2j. 다음 반복
iteration++ 하고 2a로 돌아간다(다음 반복도 커밋 후 리뷰).

### 3. (반복 끝의 커밋은 2a가 다음 반복 시작에 수행)

### 4. 종료 요약 + ledger
보고:
- 총 반복 횟수, blocking score **회차별 추세표**(iteration별 critical/high/medium 개수 + 신규/잔존 구분).
- **disposition별 집계**: FIXED / ACCEPTED / DEFERRED_TO_IMPL / OUT_OF_SCOPE / DUPLICATE / ESCALATE, 남은 low.
- 최종 verdict.

**단계 경계(spec→plan, plan→impl)**:
- ledger의 ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE를 **다음 단계 진입 전 단계 산출물 문서에 명시**한다(blocking unresolved 채로 다음 단계 진입 금지).
- spec/plan의 `DEFERRED_TO_IMPL` high는 impl plan의 테스트/acceptance criteria로 연결한다.
- 핸드오프를 쓰고 "다음 단계는 /clear 후 시작하세요 + <다음 단계 진입 안내>"를 덧붙인다.

## 종료 조건 요약
- ✅ 미판정 blocking == 0 (모든 critical/high/medium이 FIXED 또는 명시 판정; low·판정완료만 남음) → 성공 종료
- 🤖 자동 모드(iteration ≤ --auto-rounds, 기본 3): FIXED 자동수정 + batch ESCALATE 적재, 위험군만 즉시
- 📋 batch 전환(auto-rounds 도달 · score 정체 · FIXED 소진): 모아둔 ESCALATE + 자동수정 내역 일괄 제시
- 🔁 blocking score 2회 연속 비감소 → 수정 루프 → **판정 루프 전환**(종료가 아니라 모드 전환)
- ⏸ iteration > max(5) → 남은 미판정을 판정/ESCALATE로 닫고 사용자 대기
- ⏸ ESCALATE에서 사용자가 중단 선택 → 핸드오프(ledger 포함)
- ⏸ 컨텍스트 ≥40% → 핸드오프 + /clear 안내 후 종료(resume로 이어감)

## 운영 규칙 (불안 줄이는 기준)
- critical/high/medium은 **모두 반드시 분류·판정**한다.
- blocking unresolved(미판정)가 있으면 **다음 단계로 가지 않는다**.
- ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE는 다음 단계 진입 전 **문서에 명시**한다.
- spec/plan에서 DEFERRED된 high는 impl plan의 **테스트/acceptance criteria로 연결**한다.
- 같은 fingerprint 계열이 **2회 이상 반복되면 더 수정하지 말고** 사용자/설계 결정으로 판정한다.

## 하지 말 것
- high를 **판정 없이** 남기지 말 것(존재 자체보다 미판정이 위험).
- 3라운드 넘어 churn(새 영역·severity 흔들림)을 계속 FIXED로 쫓지 말 것 — 판정으로 닫아라.
- low를 이 루프에서 고치지 말 것(`DEFER_LOW` — 요약 기록만).
- 미커밋 상태로 적대검증 돌리지 말 것(직전 수정을 못 본다).
- fingerprint key에 severity를 넣지 말 것(high↔medium 흔들림으로 추적이 깨진다).
- ACCEPTED/DEFERRED_TO_IMPL을 근거·연결 없이 닫지 말 것.
- 커밋 메시지에 AI 서명 넣지 말 것(글로벌 규칙).
