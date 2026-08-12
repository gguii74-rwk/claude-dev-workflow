# review-loop 클린 종료 종결 기록 — 빠른 종료 ledger 계약 보강 (fp-I17 이월)

- 단계: **harden-spec 완료 (2026-08-12) — 다음 = 4 review-loop(spec)** (새 세션). 판단 갭 8건 전건 확정(D6~D13)·DEFERRED 0. 종결 시 이 줄을 갱신할 것.
- 출처: C-10 impl ledger fp-I17 — R2·R3 재출현(medium), 사용자 batch 판정 **OUT_OF_SCOPE(후속 이월, 백로그 기재 의무)**. 원본 = `2026-08-10-dev-cycle-state-priority.md` §적대검증 ledger (impl). 순번 미배치 백로그(`.remember/remember.md` §백로그).
- 대상: `dev-workflow/skills/review-loop/SKILL.md` (0.16.0 기준 402줄) — §2e 빠른 종료 + §1 plan 형식 관문 ③

## 1. 문제 (실측 근거)

무-finding 빠른 종료(§2e)는 phase 산출물 문서에 `## 적대검증 ledger (<phase>)` 섹션을 만들지 않고 끝난다. 소비처는 ledger 종결만 완료 신호로 읽는다:

- **dev-cycle 판별 4·6·8행** — 완료 신호 = "ledger 종결". 기록이 없으면 그 단계는 영구 미완으로 판독되어 **깨끗한 트랙일수록 같은 리뷰를 영구 재권고받는 교착**(9단계 도달 불가)이 성립한다.
- **review-loop 자신의 §1 plan 관문 ③** — "승계 ledger 부재 시(전 phase 루프 미실행·빠른 종료로 ledger 미생성)" 분기로 부재를 자인한다.

fp-I17 원문 요지 (C-10 impl ledger R2): "빠른 종료(무-finding) 시 review-loop가 ledger를 남기지 않을 수 있는데 판별은 종결 ledger만 완료 신호로 읽어 같은 리뷰를 영구 재권고(교착 — 깨끗한 트랙이 9 도달 불가)". batch 판정에서 해법 ⓐ(생산자 계약 보강)가 채택됐고 **dev-cycle 문면은 현행 유지**로 닫혔다.

## 2. 목표 / 범위 / 비목표

**목표** — 모든 빠른 종료가 소비처(dev-cycle 판별·§1 관문 ③)가 판독 가능한 종결 기록을 남기게 해, 클린 트랙 재리뷰 교착을 생산자 쪽에서 제거한다.

**범위** — review-loop SKILL.md 두 지점, 순변경 ±7줄 수준:
- §2e 빠른 종료 불릿에 하위 불릿 1개 추가(종결 1줄 기록 의무 — 3a).
- §1 plan 형식 관문 ③의 해당없음 판정 일반화(D6 — 3b): "대조할 finding 행이 없으면(ledger 부재 또는 종결 기록뿐) 해당 없음 + 사유 1줄 기록". 부재·클린 종결 두 케이스를 한 문구가 받는다.

**비목표** —
- dev-cycle 문면 변경 — C-10 batch 판정 기결정(거울면 금지). 소비처는 무변경으로 신규 기록을 판독한다.
- 종결 기록의 일반 규정화 — non-clean 경로는 확인 라운드 기록 의무(§finding ledger)로 이미 신호가 남는다. 실측 실패 사례가 있는 빠른 종료 경로에만 넣는다(D2).
- 새 커밋 장치 — §3 종료 전 커밋이 "어느 경로든 4번 전에 마지막 ledger 갱신을 커밋"하므로 그대로 받는다(D3).
- 감량 트랙 잔여 리스크의 **L-3 C3(오복원) 재평가 — 불편입**(D12). 실전 사고 미발생(조건부 포인터)이므로 이 트랙에서 예방 검증하지 않는다. 포인터는 차기 유지(조용한 무시 아님 — 근거 기록).
- 기계 장치(파서·스크립트) 도입 금지(G-b) · description/트리거 변경 없음.

## 3. 설계

### 3a. §2e 하위 불릿 (문면 초안 — 구현에서 최종 확정)

> **빠른 종료도 종결 기록은 남긴다** — phase 산출물 문서(위치 = §finding ledger 표)의 `## 적대검증 ledger (<phase>)` 섹션에 종결 1줄을 쓴다(섹션이 없으면 이 1줄로 신설): `루프 종결 (<날짜>): 빠른 종료 — 적대 <n>라운드, blocking 0 · low <m>건(DEFER_LOW), 확인 라운드 해당 없음, base <SHA> → target <SHA>`. 커밋은 §3이 그대로 받는다. 이 기록이 없으면 소비처(dev-cycle 판별·§1 관문 ③)가 루프 실행 사실을 판독할 수 없다(입증: C-10 fp-I17 — 클린 트랙 영구 재리뷰 교착).

- **필드 구성 확정(D8)**: 날짜 · 적대 라운드 수 · blocking 0 · low 건수 · 확인 해당없음 · base→target SHA — non-clean 종결 기록 관례(감량 트랙 실물 "루프 종결 (2026-08-11) — 성공 종료(확인 경유): …")와 동형이고, SHA는 재현·감사용(어느 커밋을 보고 클린이었는지).
- **입증 인용은 서술형 관례(D9)** — 규칙 문면에는 fp 번호+요지만("C-10 fp-I17 — 클린 트랙 영구 재리뷰 교착"), 파일 포인터는 이 spec에만 둔다. SKILL.md 기존 인용들("(실측: …)" 서술형)과 동형 유지.

### 3b. §1 관문 ③ — 해당없음 판정 일반화 (D6)

부재 한정 분기를 "대조 원본 없음" 판정으로 일반화한다(문면 초안 — 구현에서 최종 확정):

> **승계 ledger에 대조할 finding 행이 없으면**(ledger 부재 — 전 phase 루프 미실행·이 규정 도입 전 빠른 종료 — 또는 종결 기록뿐인 클린 종결) ③은 "해당 없음"으로 스킵하되, 사유를 게이트 기록에 1줄 남긴다(예: "승계 ledger = 종결 기록만 — spec 루프 클린 종결").

관문 ③의 목적(기결정 가드 focus 조립·DUPLICATE 대조의 원본 요건)상 대조 원본이 없으면 해당 없음이 논리적 귀결이다. 부재는 여전히 관문 실패가 아니다(비소급 — 기존 트랙의 ledger 부재 합법 유지).

해당없음의 경계 = **"대조할 finding 행 없음"에만 성립**. 종결 기록과 finding 행이 공존하면 행이 있는 것이므로 관문을 그대로 적용하고, finding 행이 있는데 fingerprint 컬럼이 없으면 기존 fail-closed(루프 시작 전 컬럼 보강)가 그대로 발동한다 — 이 개정은 해당없음 분기를 넓힐 뿐 관문의 적용·실패 동작을 바꾸지 않는다.

### 3c. low-only 경계

low만 나온 트랙도 빠른 종료 대상이다(DEFER_LOW는 disposition 6종 밖 — 미확인 FIXED 큐 0·직접 판정 0 성립). 종결 1줄의 `low <m>건` 표기가 그 요약 기록을 겸하므로 별도 규정을 두지 않는다. 이전 라운드의 DEFER_LOW 행이 이미 섹션에 있으면 종결 1줄은 그 말미에 덧붙인다.

### 3d. 문면 제약

- 감량 직후 repo 방향 유지: 신규 규칙 입증 책임(A2)에 따라 규칙 문면에 실패 사례(fp-I17)를 서술형으로 인용한다(D9). 402줄 근처 유지(순증 ±7줄).
- 거울면 금지: 종결 기록 규칙의 거처는 §2e 한 곳. §1 ③은 자기 판정(해당없음 조건)의 재정의이지 종결 기록 규칙의 재기술이 아니다.

## 4. Acceptance Criteria

- **AC1 (생산자)**: 무-finding 픽스처에서 — 현행 문면 RED(**배치 중 1런 이상** 종결 ledger 미생성 = 결함 재현, D7 — 비결정적 발현도 결함, C-10 X11 전례), 개정 문면 GREEN(**전건** 종결 1줄 실재 + §3 커밋 경유). 픽스처는 **phase 4변형** — spec(planless)·plan(분할 entrypoint)·impl-planful(plan entrypoint)·impl-planless(spec 문서): 각 변형 GREEN은 종결 1줄이 **§finding ledger 표가 규정한 그 문서 말미**에 실재해야 통과(위치 오기재 = RED — 특히 plan/impl-planful은 task 파일 아님). 진행 중 승격 케이스는 별도 변형 불요 — 위치 귀결이 impl-planless와 동일(spec 말미 유지)하고 그 유지 규칙은 §finding ledger 표 기존 규정으로 이 변경이 접촉하지 않는다.
- **AC2 (소비자)**: 종결 1줄만 있는 트랙에서 dev-cycle 판별이 해당 단계(**4/6/8**)를 완료로 판독하고 다음 단계를 안내(교착 소멸). plan 케이스 = plan ledger에 종결 1줄만 있는 상태(5 완료)에서 6을 재권고하지 않고 7을 안내. dev-cycle 문면 diff 0인 채로.
- **AC3 (회귀)**: non-clean 경로 ledger 동작 무변경 · §1 관문 ③ — 양성 2케이스(부재(도입 전 트랙)·종결-기록뿐 → "해당 없음 + 사유 1줄") + **음성 대조군 2케이스**(종결 기록+fingerprint finding 행 공존 → 관문 적용·정상 통과 / finding 행 존재+fingerprint 컬럼 부재 → 기존 fail-closed 발동 유지) · low-only 트랙 정상.
- **AC4 (구조)**: 거울면 0 — dev-cycle 문면 변경 0, 종결 기록 규칙의 거처는 §2e 유일.
- **AC5 (공정)**: no-AI-trace(커밋·문서) · 기계 장치 0(G-b).

## 5. TDD 계획 (writing-skills — 스킬 문면 변경 규약, 브리프 §0-2)

- arm 3축: **P(생산자)** 무-finding 픽스처(phase 4변형 — AC1) RED/GREEN · **C(소비자)** dev-cycle 판별 교착 소멸(4/6/8 — plan 6행 케이스 포함, AC2) · **R(회귀)** non-clean/관문 ③ 4케이스(양성 2·음성 2 — AC3)/low-only.
- **하네스(D13)**: arm P·R = **harness-7c-slim 규격 재사용**(review-loop 문면 시험용 — 소스 `docs/specs/harness-7c-slim/` 커밋 실재) + 무-finding 픽스처(phase 4변형)만 신작. arm C = **harness-8 재사용**(dev-cycle 판별용, C-10 — `.remember/harness-8` 생존 확인 2026-08-12) + plan 6행 상태 픽스처 신작(종결 1줄만 있는 클린 종결 상태 — D13의 무-finding 픽스처 계열, 신작 범위 불변). 세부 픽스처 설계는 구현 단계.
- 승계 관례(픽스처 정합 검사·arm당 파일럿 1런·fan-out 리포트 파일화·픽스처에 합격 기준 노출 금지) 적용.
- **본배치 하한(C-10 fp-S10 게이트 승계)**: P phase 4변형·C 4/6/8 케이스·R 경계 케이스별 **파일럿 제외 독립 5런 이상**(대조군 포함), 실행 모델 = 하네스 규격 고정. 하한 미달 상태로 GREEN 종결 불가 — AC1의 "전건"은 이 본배치 전 유효 런 기준이다(D7).
- **배치 실행 시점**: 주간 API 한도 리셋(8/17 09:00 KST) 후, 또는 그 전이면 토큰 사용량 보고 후 사용자 판단.

## 6. 트랙 운영 (자기적용)

- **경량 진입** — 접촉 표면: 스킬 문서 1개(실행 코드·스키마·권한·비가역 없음). 사용자 승인 2026-08-12(brainstorming·harden **동일 세션** — 세션 한정 규약 충족, 영속 근거는 아래 재논의 금지 블록 D4).
- **5 plan·6 plan 루프 생략(D4)** — C-6 D19·C-10 B6·SLIM D4 전례. **4 spec 적대검증은 실행**(파이프라인 핵심 스킬의 계약 변경 — codex는 주간 API 한도와 무관).
- impl ledger 위치 = 이 spec 문서 말미(C-6 D17). 루프 상태 파일 = `.remember/loop-2026-08-12-review-loop-clean-exit-ledger-<phase>.md`.
- **4단계 클린 종료 대비(D11)**: 이 트랙의 4 spec 루프가 무-finding 클린 종료하면 — 규정 구현 전이라 ledger가 안 남는다 — 3a 형식의 종결 1줄을 **수동 기재**한다(규정 선적용, 자기 교착 방지).
- 경로: 3 harden-spec(완료) → 4 review-loop(spec) → 7 직접 구현(TDD) → 8 review-loop(impl) → 9 릴리스(0.17.0).

## 7. 완료 조건

SKILL.md 개정(§2e·§1) + TDD GREEN(AC1~AC3) + spec 루프·impl 루프 종결 + `plugin.json` **0.17.0**(다른 트랙이 선점하면 차기 minor로 갱신 — D10) + README 3종 대조 + 3머신 `/plugin update` 안내. 릴리스는 무태그(G-f — SLIM D8 전례).

## 8. 확정 결정 (D번호 — D1~D5 = 브레인스토밍 B1~B5 승격, D6~D13 = harden 확정 2026-08-12)

| # | 결정 | 근거 |
|---|---|---|
| D1 | 방향 = ⓐ 생산자 계약 보강, dev-cycle 문면 무변경 | C-10 batch 판정 기결정 |
| D2 | 범위 = §2e 국소 보강(일반 규정화 기각) | non-clean 경로 기존 신호 + 재비대 방지(A1~A3) |
| D3 | 커밋 = §3 기존 장치 재사용(신규 장치 없음) | §3이 이미 전 경로를 받는다 |
| D4 | 트랙 = 경량, 5·6 생략·4 유지, impl ledger = spec 말미 | 접촉 표면 1개 + C-6·C-10·SLIM 전례, 사용자 승인 2026-08-12 |
| D5 | 파일명 `2026-08-12-review-loop-clean-exit-ledger.md`, 릴리스 0.17.0 | repo 명명 규약 |
| D6 | 관문 ③ 해당없음 판정 일반화 — "대조할 finding 행 없음(부재 또는 종결 기록뿐) = 해당 없음 + 사유 1줄" | 새 케이스(실재하나 행 0) 무규정 방치 = fp-I17형 구멍 재생산. 대조 원본 없음 → 해당 없음이 관문 목적의 논리적 귀결 |
| D7 | AC1 RED = 배치 중 1런 이상 미생성(비결정적 발현도 결함) · GREEN = 전건 생성 | LLM 변이로 일부 런이 관행 모방 가능 — 실질 게이트는 GREEN. C-10 X11 전례 |
| D8 | 종결 1줄 필드 = 날짜·라운드 수·blocking 0·low n·확인 해당없음·base→target SHA | non-clean 관례 동형 + 재현·감사성 |
| D9 | A2 입증 인용 = 서술형(fp 번호+요지), 파일 포인터는 spec에만 | SKILL.md 기존 인용 관례 동형·문면 비대 방지 |
| D10 | 버전 0.17.0 유지 + 선점 시 차기 minor 단서 | 완료 조건의 구체성과 stale 방지 양립 |
| D11 | 이 트랙 4단계 클린 종료 시 종결 1줄 수동 기재(규정 선적용) | 규정 구현 전 자기 교착 방지 |
| D12 | L-3 C3 재평가 불편입, 비목표 명시 | 실전 미발생(조건부 포인터) — 예방 검증은 범위 외, 포인터는 차기 유지 |
| D13 | TDD 하네스 = harness-7c-slim(P·R)·harness-8(C) 재사용, 무-finding 픽스처만 신작 | 소스 커밋 실재·스크래치패드 생존 확인 — 신작 비용 최소화 |

## 9. 미해결 질문 — harden-spec에서 전건 해소 (2026-08-12)

1. 종결 1줄 형식 → **D8**(초안 유지, SHA 포함).
2. §2i 일시중단 상호작용 → **사실 해소(조회)** — 빠른 종료 판정 지점은 §2e 유일. 중단·재개된 루프도 §2e 도달 시점에 기록하므로 시점 모호성 없음.
3. TDD 하네스 → **D13**(재사용 우선 확정).
4. A2 인용 입도 → **D9**(서술형 관례).

## 재논의 금지(기결정)

아래는 이미 판정으로 닫힌 항목이다. 이 트랙의 후속 루프(4 spec 적대검증·8 impl 적대검증)에서 다시 보고되면 DUPLICATE로 각하한다.

- **D1~D13** (§8 표 — 근거 포함 전문).
- 이 트랙이 전제로 존중하는 상위 기결정: ① **C-10 batch 판정** — fp-I17 해법 ⓐ(생산자 계약 보강)·dev-cycle 문면 현행 유지 ② **SLIM D13** — fp-I17은 별도 트랙(의미 추가 — 감량과 성격·검증 축이 다름) ③ **브리프 §0-2** — 스킬 문면 변경 = writing-skills TDD 필수 ④ **C-6 D17** — planless 트랙 impl ledger = spec 문서 말미 ⑤ **A1~A3(SLIM D3·D15·D17)** — 재비대 방지 3종(이 트랙의 신규 규칙은 A2 입증 인용을 3a 규격으로 충족).

## 잔여 리스크 (DEFERRED)

- **DEFERRED(사용자 유예): 없음** — 이번 압박의 판단 갭 8건 전건 질문·확정(D6~D13).
- **검증 필요(실측, 구현 단계): 없음** — 하네스 소스는 repo 커밋(`docs/specs/harness-7c-slim/`)·스크래치패드 생존(`.remember/harness-8`) 확인 완료. TDD 배치 실행 시점 제약(주간 API 한도, 8/17 09:00 KST 리셋)은 §5에 기재.

## 적대검증 ledger (spec)

- 루프: `review-loop --phase spec` · base = main@`9bd63223c98ef797dbdc9df6cbed4327bf99e572` · 예산 max 5 / confirm 2 / auto 3
- score 산식: Σ weight(§2c 분류 직후·수정 전 미판정 blocking), weight = critical 4 · high 3 · medium 1 · low 0. 미확인 FIXED 큐 제외.

| fingerprint | 발생 | severity | disposition | 근거·수정 |
|---|---|---|---|---|
| fp-S1 · spec §4 AC1·AC2·§5 · 문제 정의는 dev-cycle 4·6·8행을 교착 표면으로 특정하나 AC2·arm C는 4/8만 검증 — plan 빠른 종료의 종결 1줄 위치(plan entrypoint) 검증도 부재 · rec: AC1·AC2·P/C arm에 plan 케이스 추가 | R1 | medium | FIXED(R1) | AC1에 phase 2변형(spec·plan — plan은 entrypoint 말미 위치 검증), AC2 4/6/8 확장 + plan 6행 케이스, §5 arm P·C 반영 + D13 신작 범위 정합(무-finding 계열 명시). 커밋 `2faf8b2` |
| fp-S2 · spec §4 AC1·§5 · AC1 생산자 검증이 spec·plan 2변형뿐 — impl 빠른 종료의 위치 분기(planful=plan entrypoint·planless=spec 말미) 미검증, 8행 생산자 공백 · rec: AC1·P arm에 impl 무-finding 변형 추가 | R2 | medium | FIXED(R2) | AC1을 phase 4변형(spec·plan·impl-planful·impl-planless)으로 전수 확장 + 위치 검증 일반화(§finding ledger 표 규정 문서 말미) + 진행 중 승격 케이스 불요 근거 명기(위치 귀결 impl-planless와 동일·기존 규정 무접촉) + §5·D13 정합. 커밋 `8433f36` |
| fp-S3 · spec §3b·§4 AC3 · 관문 ③ 해당없음의 반대 경계 미검증 — 종결 기록+finding 행 공존(관문 적용)·finding 행 존재+fingerprint 컬럼 부재(기존 fail-closed) 음성 대조군이 AC3/R에 없음(과대 해석 시 승계 판정이 focus·DUPLICATE 대조에서 소실) · rec: AC3에 음성 케이스 명시 | R3 | medium | FIXED(R3) | §3b에 해당없음 경계 명문화("대조할 finding 행 없음"에만 성립·관문 적용/실패 동작 불변) + AC3에 음성 대조군 2케이스 추가. 커밋 `2ebaee9` |
| fp-S4 · spec §4 AC1·§5 · D7 비결정 판정(1런 미생성도 결함)을 실행할 본배치 최소 반복 수 부재 — 변형별 1런만으로 "전건 GREEN" 선언 가능 · rec: 변형·케이스별 본배치 하한·모델 고정, 파일럿 제외 전 유효 런 GREEN | R3 | medium | FIXED(R3) | §5에 본배치 하한 게이트 신설(C-10 fp-S10 승계 — P 4변형·C 4/6/8·R 경계 케이스별 파일럿 제외 독립 5런 이상·대조군 포함·모델 하네스 규격 고정·하한 미달 GREEN 종결 불가) + AC1 "전건"의 기준 명시. 커밋 `2ebaee9` |

- score 이력: R1 = 1 (medium 1, 신규) → R2 = 1 (medium 1, 신규 — 비감소 1회째) → R3 = 2 (medium 2, 전부 신규 — 비감소 2회째, **전환 신호 1 발화**) → C1 지목 = 1 (fp-S3 잔존 medium)
- batch ESCALATE 적재분: 0건 (flush 대상 없음 — 적대 소진 3 = auto-rounds 도달 겸 전환 신호 발화)
- **확인 C1 (2026-08-12)**: 소멸 확인 = **fp-S1·S2·S4 (3건)**. **fp-S3 잔존**(medium — AC3는 관문 ③ 4케이스로 확장됐으나 §5 arm R이 "2케이스"로 남아 모순, 불완전 수정) → FIXED 재수정 커밋 `68f208c`(arm R을 양성 2·음성 2 4케이스로 정합화) 후 재큐. 신규 finding 없음 · 판정 감사 해당 없음(루프 직접 판정 0건) · verdict **fail**(fp-S3 잔존 사유) → **적대 복귀 1회(상한 밖) + 재진입 확인** 경로. 복귀 사용 = 예.
- 미확인 FIXED 큐: fp-S3 (C1 재수정 `68f208c`) — 소멸 확인 대기
