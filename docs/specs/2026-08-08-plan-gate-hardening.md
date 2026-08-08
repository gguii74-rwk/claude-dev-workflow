# plan 게이트 강화 설계 (C-5)

- 상태: **review-loop spec 종결** (2026-08-08 — 미판정 blocking 0 · 미확인 FIXED 큐 0 · 확인 C2 verdict merge-ready. 다음 = 새 세션에서 writing-skills TDD 구현. ledger = 이 문서 §적대검증 ledger (spec))
- 대상: `dev-workflow` 플러그인 **기존** 스킬 `writing-plans-split` · `review-loop` 개정 (기준 0.9.0)
- 날짜: 2026-08-08
- 입력: `docs/specs/2026-08-07-review-loop-and-pipeline-improvements-brief.md` §실행 순서 4번 / §트랙 C C-5
- 승인 이력: **"순번 4를 지금 진행한다"만 기결정**(브리프 §실행 순서, 2026-08-07 사용자 결정 — 1~7 순차). C-5의 두 게이트 항목(①②)은 브리프의 *제안*이었고 harden-spec 2026-08-08에서 D1~D11로 확정했다. **"게이트 체크는 grep 수준 경량 확인으로 설계(파서·스위트 금지)"는 브리프 §기결정 대조에 명시된 기결정**이라 재론하지 않았다.
- 경로 결정: 트랙 A·B 전례대로 plan phase 생략 — **writing-skills TDD 직접 구현**. spec 종결 후 구현 → `review-loop --phase impl` → 릴리스(0.10.0 + README 3종).

## 1. 배경 / 문제

ops-hub 전수 점검(2026-08-07, 브리프 §1·§트랙 C C-5 행)에서 plan 단계의 규약 이탈 3종이 실측됐다. 셋 다 **작성·실행 시점에 잡을 관문이 없어** 사후(리뷰 라운드·다음 트랙)에야 드러난다.

| 신호 | 실측 | 문제 |
|---|---|---|
| **outcome 미기입** | 채움 **17/67 (25%)** — 단 08-05 이후 4트랙은 전량 채움(=비용 문제가 아니라 계약 부재) | writing-plans-split task 표의 outcome은 "후속 task가 알아야 할 것"의 축적 장치다. 비면 후속 task가 선행 task의 산출·결정을 모른 채 돌고, task 표가 진행 상태 SSOT 역할을 잃는다 |
| **superpowers 템플릿 유입** | 브리프 12건(08-02까지) · **재조사 2026-08-08: Execution contract 없는 plan 엔트리포인트 20/88** | 분할 plan 규약 repo에 단일 파일 plan(superpowers:writing-plans 템플릿)이 유입 — Execution contract·Shared Contracts가 없어 SDD 실행 계약이 깨진다. review-loop plan 리뷰가 이를 걸러낼 관문이 없다 |
| **fingerprint 없는 ledger** | 브리프 3건 · **재조사 2026-08-08: 문자열 기준 plans 6·specs 10·runbook 1(대부분 07월 이전 legacy)** | fingerprint 규약(정착 자산)이 없는 ledger는 재지목 추적·DUPLICATE 판정이 깨지고, 0.9.0부터는 **기결정 가드 focus 조립(요약행 = fingerprint·disposition·근거·후속 위치)의 원본 요건도 못 채운다** |

현행 review-loop §1 사전 게이트의 plan 관문은 "구현 단위·파일/인터페이스 영향·테스트 계획·가정이 문서에 명시"뿐 — **형식 규약(분할 구조·ledger 형식)은 검사하지 않는다.** writing-plans-split의 Execution contract는 실행 절차(①②③)만 계약하고 **완료 기록(status·outcome 기입)은 계약 밖**이다(task 표 설명에 "filled in one line on completion"으로 서술만 존재 — 기입 *시점·주체*가 규정되지 않은 것이 25%의 구조적 원인).

## 2. 목표 / 비목표

**목표:** plan 규약 이탈 3종을 **사전(작성·실행 계약) + 진입(리뷰 게이트)** 두 지점에서 잡는다.

- ① **writing-plans-split**: Execution contract에 완료 기록 의무(D2)를 계약 문면으로 추가.
- ② **review-loop**: plan 사전 게이트에 형식 관문 4종(D3)을 추가 — 적용 조건(D1)·실패 동작(D5)·경계 분기(D11) 포함.

**비목표 (YAGNI / 기결정 준수):**

- **기계 검증 장치(파서·스위트·자동 게이트·훅) 신설** — 게이트 체크는 grep 수준 경량 확인(브리프 §기결정 대조 기결정, G1·G2 정합). 출력 판정 기준까지 규정하는 커맨드 규약화도 금지(D7).
- **기존 단일 파일 plan 소급 적용** — writing-plans-split의 "Not retroactive" 원칙 유지. 게이트는 새 루프 진입 시점 검사다.
- **outcome 준수의 추가 검사 지점(impl 게이트·통합 리뷰 확장)** — D6. 브리프 ①② 범위 유지, 효과 실측 후 필요하면 후속 백로그.
- **outcome 형식·내용 규정 강화** — "한 줄" 규약 유지. 기입 *여부·시점*을 계약화하는 것이지 서식을 늘리는 게 아니다.
- **최종 fix wave 후 outcome 재갱신 의무** — 계약 범위는 task 간 수렴(④ 재개 경로 포함)까지. 전 task 완료 후 whole-branch review fix wave로 인한 outcome 낡음은 D6 백로그(검사 지점 확장)와 동일 취급(spec 루프 fp-C2 판정).
- **분할 plan 구조 자체 변경** — 93.2% 채택 정착 자산(브리프 §1 "건드리지 말 것").
- **superpowers:subagent-driven-development(SDD) 수정** — 외부 플러그인. subagent 로딩 계약(task 파일 + §Shared Contracts만)도 불변(D2).
- **setup 스킬·각 repo CLAUDE.md 수정** — setup은 접점 없음 확인(포인터 블록만), repo CLAUDE.md는 각 repo 소유(D8 — 안내만).
- **dev-cycle 개정** — 순번 5·6(C-6) 범위. dev-cycle은 접점 없음 확인(지도만).
- **impl ledger 위치 규약화** — 순번 7(C-3) 범위. 미흡수.
- **spec 절차 준수 강제** — plan 게이트는 형식 검사다. spec 루프를 돌았는지는 검사하지 않는다(D11 — 경량 경로 순번 5와 충돌 방지).

## 3. 설계 확정 (harden-spec 2026-08-08 · D1~D11)

**D1. 분할 규약 관문 적용 조건 = repo 규약 명시 기준** — 실행 repo의 CLAUDE.md(또는 AGENTS.md)에 분할 plan 규약이 명시된 repo에서만 분할 규약 관문(D3 ①②④)을 적용한다. 규약 없는 repo는 관문 스킵(정당한 단일 파일 plan 오탐 0). **단일 task 소형 변경은 관문 예외**(writing-plans-split 자신이 "one-task change는 단일 파일 또는 그냥 구현"으로 허용 — 규약 repo에서도 예외임을 관문에 명시).
- 근거: 판정 원천 실재 — ops-hub `CLAUDE.md:44`에 분할 plan 규약 문단이 이미 있다. plan 문서 형태 기준(분할 구조면 적용)은 superpowers 템플릿 유입이 바로 단일 파일 형태라 구조적으로 못 잡는다.

**D2. 완료 기록 계약 = dispatcher·다음 task 착수 전** — writing-plans-split Execution contract에 ④를 신설한다: task **완료 확정**(리뷰 승인·adjudication 종료 — SDD의 "mark todo complete" 동기점. 구현자 DONE 보고 시점이 아니다) 직후·**다음 task 착수 전**에 실행 dispatcher(subagent 없이 직접 실행하면 실행자 자신)가 entrypoint task 표의 해당 행 status(`[x]`)·outcome(한 줄)을 기입하고 **그 자리에서 커밋**한다. subagent 로딩 계약(자기 task 파일 + §Shared Contracts만)은 불변.
- 근거(SDD 실측): 실행 subagent는 entrypoint를 받지 않고 task 완료 커밋을 직접 만들며, task 간 동기 지점("mark todo complete")은 dispatcher에 있다 — dispatcher가 유일하게 entrypoint를 들고 있는 시점이 기입 지점이다. 브리프 문구 "커밋 전 필수"는 "다음 task 착수 전 필수"로 정밀화(트랙 종료 시 일괄 기입은 실측 25%의 원인 — 잊힘·중단 유실).
- **보강(spec 루프 R1, fp-C2 — 재개 수렴)**: ④의 기입 트리거는 재개 경로를 포함한다 — 완료 확정 직후뿐 아니라 **모든 task 착수 전에 이전 task 행들의 기입 여부를 확인하고, 미기입 행이 있으면 그 자리에서 수렴(기입+커밋) 후 착수**한다. SDD의 git-ignored progress ledger(재개 SSOT)와 entrypoint 표 사이에서 중단이 일어나도 계약 문면이 자체 수렴시킨다. 전 task 완료 후 whole-branch review fix wave가 outcome을 낡게 만드는 전이는 이 계약 밖 — 비목표에 명시하고 D6 백로그(검사 지점 확장)에 병기한다.
- **보강(spec 루프 R2, fp-C3 — 트리거 정밀화)**: "완료 보고 수신 직후"(브리프·harden-spec 표현)의 규범 의미 = **완료 확정 직후**. 구현자 DONE 보고 시점에 기입하면 task review 실패·fix loop 시 미승인 task가 `[x]`로 남는다 — D2 근거가 지목한 동기점("mark todo complete")이 SDD에서 리뷰 승인 후이므로, 이 정밀화는 기결정과 정합(번복 아님).
- **보강(spec 루프 R2, fp-C4 — 수렴 검사 시점 완결)**: 수렴 검사(미기입 행 확인·기입+커밋)는 ⓐ 모든 task 착수 전 + ⓑ **재개(세션 복구) 초기화 시점** + ⓒ **final whole-branch review 진입 전**에 수행한다. ⓑⓒ가 없으면 마지막 task 완료 직후 중단 시 다음 "task 착수"가 없어 최종 행이 영구 누락된다(fp-C2 잔존 경계 종결).
- **보강(확인 C1, fp-C2 잔존 해소 — 3원 대조·권위)**: 수렴 검사는 단방향(미기입 행 기입)이 아니라 **3원 대조**다 — entrypoint task 표 · SDD progress ledger · git log(실제 커밋)를 대조해 어긋난 쪽을 복구한다. **완료 판정의 권위 = SDD progress ledger의 명시적 완료 기록**("Task N: complete" — 리뷰 승인 후에만 적힌다); **git log는 그 기록이 가리키는 커밋의 존재·비-revert 검증 보조 증거로 제한**한다 — 구현자 커밋은 리뷰 승인 *전에* 존재하므로 git log 단독을 완료 근거로 삼으면 리뷰 실패·fix-loop 진행 중 task를 완료로 오인한다(R4 fp-C6 교정). **완료 기록이 없거나 모호하면 fail-closed(미완료로 간주)**. 역방향 불일치(행 `[x]`인데 SDD ledger에 완료 기록 없음)도 표를 맹신하지 않고 미완료로 복원한다 — 완료 task 재실행·미완료 task 건너뜀·미승인 구현 위 후속 작업 적재 방지. 기입-미커밋 상태(fp-C5)의 커밋 확인도 이 대조에 자연 포섭된다.
- **보강(impl 루프 R1, fp-I1 — 권위 기록 부재 경계)**: 위 fail-closed는 **ledger가 존재하는 상태**를 전제한다. SDD workspace는 git-ignored이고 final review 통과 후 `rm -rf <workspace>`로 삭제되며(SDD 6.2.0 §Finish), `git clean -fdx`로도 파괴된다(SDD 자신의 복구 지침 = git log). 게다가 이 repo README는 **SDD 없는 대체 실행을 명시 지원**한다(하드 의존 아님) — 이 3경로에서는 권위 기록이 아예 없어, 문면대로면 완료 행이 **일괄 되돌려져 완료 task가 재dispatch**된다(중복 마이그레이션·외부 부작용 재실행). 따라서 **ledger 전체 부재**와 **ledger 내 해당 task 기록 부재**를 구분한다: 전자에서는 권위가 **커밋된 entrypoint 표 자체**로 폴백하고(계약 ④가 완료 확정 시점에만 기입·커밋하므로 리뷰 승인된 완료의 영속 기록이다) git log는 각 `[x]` 행 커밋의 존재·비-revert 확인 보조에 머문다. **ledger 부재를 이유로 표를 일괄 되돌리지 않는다** — git log가 반증하는 행만 되돌리고, 표 자체가 판독 불가면 재dispatch 대신 사람에게 확인을 요청한다. fp-C6의 의미(구현자 커밋 ≠ 완료)는 그대로 보존된다.
- **보강(impl 루프 R2, fp-I2 — 판정 기준을 파일 존재에서 내용으로)**: fp-I1의 분기를 "ledger 파일 부재"로 잡으면 **실제 SDD 재개 순서에서 발동하지 않는다** — SDD 6.2.0 셋업은 plan을 읽기 전에 workspace를 만들고 identity-only `progress.md`를 생성하므로(SKILL.md 셋업 절), `git clean -fdx`로 유실된 뒤에도 수렴 검사 시점에는 ledger가 "존재"한다. 따라서 판정 기준을 **내용**으로 옮긴다: ledger가 없거나, 있어도 **어느 task의 완료 기록도 없는데 표에는 이미 `[x]` 행이 있으면** 그 ledger는 fresh 또는 유실이라 권위가 아니다 → 커밋된 표로 폴백(일괄 되돌림 금지). 폴백 후에는 **살아남은 표로 ledger의 완료 줄을 복원**해 이후 검사가 다시 live ledger를 갖게 한다. R1 수정 자신의 회귀 교정이다(spec 루프 fp-C6 전례 — 신규 경계 추격이 아님).

**D3. plan 사전 게이트 검사 항목 4종** — ① Execution contract 블록 존재 ② `§Shared Contracts` 섹션 존재 ③ **승계·참조 ledger**(D4)의 fingerprint 컬럼 존재 ④ task 표에 status·outcome 컬럼 존재. ④는 P1(D2) 계약의 전제 — 컬럼이 없으면 기입 의무가 공중에 뜬다(①②④는 D1 조건부, ③은 D4·D11 조건부).
- **보강(impl 루프 R2, fp-I3 — 관문 ①의 검사 내용)**: ①은 블록 **존재**만 보면 구버전 계약(④ 완료 기록 절 없음)을 정상 통과시킨다 — base 커밋의 구버전 entrypoint가 ①②④를 모두 통과하는 것이 실증이다. 구버전 플러그인·미갱신 머신이 만든 plan이 이번 트랙의 핵심 보호(D2) 없이 승인되므로, ①의 검사 내용을 **"현행 계약인지(④ 절 포함)"**까지로 명확히 한다. **항목 수는 4종 그대로**(D3 재론 아님) — 다섯 번째 관문·파서 신설 없음(D7·G1·G2 준수). 실패 시 처리 = 블록 교체(저비용 → D5의 "해결 후 진행"), 대상은 이번 루프가 리뷰할 plan뿐이다(§2 비목표 "소급 적용 없음" 경계 유지).

**D4. fingerprint 관문의 검사 대상 = 이 루프가 승계·참조할 ledger** — 통상 전 phase(spec) ledger. plan 루프가 새로 만들 ledger의 형식은 review-loop §finding ledger 규약이 이미 규정하므로 게이트에서 이중 규정하지 않는다.
- 근거: 0.9.0 기결정 가드 focus 조립·§2c DUPLICATE 대조의 원본이 승계 ledger다 — fingerprint가 없으면 재지목 억제가 깨진 채 루프가 시작된다. 실측 fingerprint 없는 ledger는 specs 쪽이 더 많다(10건).

**D5. 관문 실패 동작 = 수위 차등 fail-closed** — 저비용 수정(계약 블록 추가·§Shared Contracts 섹션 추가·표 컬럼 추가)은 impl 게이트 전례대로 **루프 시작 전 해결 후 진행**. **구조 재작성 수준(단일 파일 → 분할 전환)은 ESCALATE** — 루프가 plan을 자동 재작성하지 않는다(검증 밖 대수술 금지).

**D6. outcome 준수의 추가 검사 지점 없음** — P1 계약 문구(D2)만으로 마무리(브리프 ①② 범위 유지). plan 사전 게이트 시점엔 outcome이 빈 것이 정상(실행 전)이라 게이트 검사 대상이 아니다. impl 게이트·통합 리뷰 확장은 릴리스 후 채움률 실측이 부족할 때 후속 백로그로.

**D7. 검사 명세 수위 = 확인 항목 목록 + grep 예시 1줄** — 관문의 확인 항목(D3)을 목록으로 규정하고, grep 예시 커맨드 1줄을 참고로 병기한다(트랙 B §2b 커맨드 예시 전례). **출력 판정 기준까지는 규정하지 않는다** — 커맨드 규약화는 사실상 파서 신설로 미끄러진다(G1·G2 경계).

**D8. 이중화 처리 = 스킬 문면만 개정** — Execution contract는 entrypoint + repo CLAUDE.md 두 곳 명시 규약(writing-plans-split §Execution handoff)이나, 각 repo CLAUDE.md의 규약 문단 갱신은 repo 소유다 — 릴리스 종료 보고에 **안내 1줄만**(ops-hub 등 기채택 repo가 완료 기록 의무를 자기 CLAUDE.md 문단에 반영하도록). setup 스킬은 미수정(사실 확인: 포인터 블록만 삽입, Execution contract 미포함 — 접점 없음. setup 확장은 순번 7 C-9 계열).

**D9. 검증 = writing-skills 마이크로테스트 + 위반 plan 픽스처** — RED(현행 0.9.0 재현) → GREEN(개정판 5+ reps, no-guidance 대조군, variance 0). 픽스처 시나리오 3종 포함: (a) 단일 파일 plan 유입(Execution contract·Shared Contracts 없음) (b) fingerprint 없는 승계 ledger (c) task 표 컬럼 누락 — P2 검출(D3)·실패 동작(D5)·경계(D1 스킵·D11 해당 없음)를 재현 검증한다. **실호출 효과 대조는 하지 않는다**(트랙 B는 프롬프트 억제 효과라 필요했지만 C-5는 절차 준수 문제 — 마이크로테스트로 충분).

**D10. 릴리스 = `plugin.json` 0.9.0 → 0.10.0** + README en/ko/ja 3종 동기 + 각 머신 `/plugin update` 안내(브리프 §0-3 규약).

**D11. 승계 ledger 부재 시 = 관문 해당 없음 + 기록** — 승계·참조할 ledger가 아예 없는 트랙(spec 루프 미실행·빠른 종료로 ledger 미생성)에서는 D3 ③을 "해당 없음"으로 스킵하되, **ledger 부재 사실을 게이트 기록에 1줄 남긴다.** 게이트는 형식 검사지 spec 절차 준수 강제가 아니다(경량 경로 공식화 — 순번 5 — 선점 금지). 트랙 B fp-B2(빈 상태 분기 누락) 전례를 따라 경계를 명시한다.

## 4. 현행 스킬 접점 — 개정 지도

| 현행 위치 | 변경 방향 | 근거 결정 |
|---|---|---|
| writing-plans-split §Entrypoint 2 (Execution contract verbatim 블록) | ④ 완료 기록 의무 신설 — 기입 주체(dispatcher/직접 실행자)·시점(완료 확정 직후·다음 task 착수 전)·커밋·수렴 검사 3시점(task 착수 전/재개 초기화/final review 진입 전) 포함. 현행 ①②③ 불변 | D2 |
| writing-plans-split §Entrypoint 4 (task 표) | outcome 서술("filled in one line on completion")을 계약(④) 참조로 연결 — 기입 시점·주체는 계약이 규정 | D2 |
| writing-plans-split §Execution handoff | dispatcher의 task 간 의무에 완료 기록 1줄 반영(로딩 계약 불변 명시) + **SDD 6.2.0 접점 어댑터 신설 — 분할 plan에서는 task 파일 자체가 그 task의 brief다: `scripts/task-brief` 추출을 생략하고 task 파일 경로를 brief로 dispatch에 넣는다**(brief = "task 전문"이라는 SDD 의도와 동치 — task 파일에는 "Task N" 제목 규약이 없어 추출이 성립하지 않는다). **SDD workspace·progress ledger는 entrypoint 기준(`sdd-workspace <entrypoint>`)으로 유지**한다(plan당 단일 workspace 계약 보존). §Shared Contracts는 기존 계약대로 dispatch 프롬프트로 주입 | D2 · fp-C1(사용자 판정 FIXED, 확인 C1 잔존 → R4 정밀화) |
| review-loop §1 사전 게이트 plan 행 | 형식 관문 4종 추가(D3) + 적용 조건(D1)·단일 task 예외(D1)·승계 ledger 부재 분기(D11)·실패 동작(D5)·grep 예시 1줄(D7) | D1·D3·D4·D5·D7·D11 |
| review-loop §finding ledger | **변경 없음** — plan 루프 자신의 ledger 형식은 기존 규약이 커버(게이트 이중 규정 금지) | D4 |
| README 3종(en/ko/ja) | plan 게이트 강화 반영(개요 표 + 해당 절) | D10 |

## 5. 실측 현황 (2026-08-08 조회)

- **writing-plans-split**: Execution contract 블록은 실행 절차 ①(§Shared Contracts 읽기)→②(task 파일 1개 로드)→③(순서 실행)만 규정 — 완료 기록 없음. outcome 정의는 task 표 항목 서술로만 존재.
- **SDD(superpowers 6.2.0) 실측**: 실행 subagent는 entrypoint를 받지 않는다(dispatcher가 §Shared Contracts + task 파일만 프롬프트에 넣음). task 완료 커밋은 subagent가 만들고, dispatcher는 자체 SDD ledger에 완료를 기록한다("Append completion to ledger, mark todo complete") — **plan entrypoint task 표 갱신은 어느 쪽 규정에도 없다**(25%의 구조적 원인). task 간 동기 지점은 dispatcher에 있어 D2의 기입 지점과 일치한다.
- **SDD 6.2.0 task-brief 접점(spec 루프 fp-C1, 사용자 판정으로 흡수)**: 6.2.0은 dispatch 전 `scripts/task-brief PLAN_FILE N` 실행을 요구하고, 스크립트는 단일 PLAN_FILE의 "Task N" 제목에서 본문을 추출한다 — 분할 entrypoint에는 본문이 없어 그대로 돌리면 실패한다(exit 3 실증). 실행 자체는 프로즈 계약(Execution contract ②)을 읽은 dispatcher가 적응해 성립해 왔으나(분할 plan 93.2% 채택), 접점이 미문서화라 dispatcher별 우회가 갈릴 수 있다 → §Execution handoff에 어댑터를 명시한다(§4 표). SDD 자체는 불변. **어댑터 방식(확인 C1 잔존 지목 반영)**: task-brief의 입력만 task 파일로 치환하는 방식은 부적합 — 스크립트가 입력 경로로 workspace를 계산해 plan당 단일 workspace 계약이 깨지고, task 파일에는 "Task N" 제목 규약이 없어 추출이 빈 결과가 된다. 따라서 어댑터 = **추출 생략(task 파일 = brief) + workspace는 entrypoint 기준 유지**.
- **review-loop §1 plan 관문**: 내용 명시 확인만("구현 단위·파일/인터페이스 영향·테스트 계획·가정"). impl 관문만 실행 게이트를 가진다.
- **ops-hub `CLAUDE.md:44`**: "다단계 구현 계획은 … `dev-workflow:writing-plans-split` 스킬로 작성한다" 규약 문단 실재 — D1 판정 원천.
- **ops-hub 재조사**: Execution contract 없는 plan 엔트리포인트 20/88. fingerprint 문자열 없는 ledger 문서 17건(plans 6·specs 10·runbook 1) — 대부분 06-22~07-23 legacy, 08월 plan에는 없음. 08-05 모범 트랙(report-weekly-meeting-view)의 outcome은 "커밋 SHA + 리뷰 상태" 한 줄 형식으로 전량 채움 — 규약 문서 변경 없이 관행 수렴(ops-hub CLAUDE.md에 outcome 규약 부재), D2가 이를 계약으로 승격한다.
- **setup 스킬**: CLAUDE.md에 dev-cycle 포인터 블록만 멱등 삽입 — Execution contract 접점 없음(D8 근거). **dev-cycle 스킬**: 파이프라인 지도만(단계 5·6 포인터) — plan 게이트 서술 없음, 접점 없음.
- **0.9.0 가드 focus 조립**(review-loop §기결정 가드): 닫힌 ledger 항목 요약행이 fingerprint를 전제 — fingerprint 없는 승계 ledger는 focus 조립 원본 요건 미달(D4 근거).

## 6. 검증 계획 (D9)

브리프 §0-2 규약: 스킬 문구 변경은 **writing-skills TDD 필수**.

**(1) 절차 준수 마이크로테스트 (writing-skills RED → GREEN)**

- **RED 베이스라인 (현행 0.9.0)**: (a) task 완료 시나리오에서 표 갱신 없는 진행이 통과하는지 (b) 위반 plan(픽스처)으로 review-loop plan 루프가 관문 없이 그대로 시작되는지 재현 기록.
- **GREEN (개정판, 5+ reps)**: D2 — task 완료 확정 후 다음 task 착수 전에 status·outcome 기입+커밋이 나오는가 · **구현자 DONE 후 리뷰 실패·fix loop 시나리오에서 조기 `[x]` 기입이 없는가(fp-C3)** · **재개 시나리오(이전 task 행 미기입 상태에서 착수)에서 수렴 기입이 먼저 나오는가 · 역방향 시나리오(행 `[x]`인데 SDD ledger에 완료 기록 없음)에서 3원 대조로 미완료 복원하는가(fp-C2) · **"구현 커밋 존재 + 리뷰 실패/ledger mid-loop" 재개 시나리오에서 git log를 완료 근거로 삼지 않고 미완료로 유지하는가(fp-C6)** · **"모든 task 완료·마지막 행 미기입" 재개 시나리오에서 재개 초기화·final review 진입 전 수렴이 나오는가(fp-C4)** · **"기입 후 커밋 전 중단" 재개 시나리오에서 수렴 검사가 기입-미커밋 상태도 수렴(해당 파일 커밋 후 진행)하는가(fp-C5 — DEFERRED_TO_IMPL 연결)** / **"SDD workspace 유실(정상 cleanup 후 재개 · `git clean -fdx` 후 SDD 셋업이 identity-only ledger 재생성 · SDD 없이 직접 실행)" 시나리오에서 표를 일괄 되돌리지 않고 커밋된 표를 권위로 폴백한 뒤 ledger를 복원하는가(fp-I1·fp-I2 — impl 루프 R1·R2 추가분, GREEN 미실행. 실행 여부는 impl 루프 batch 판정)** / **구버전 Execution contract(④ 절 없음) 픽스처에서 관문 ①이 false-pass하지 않고 블록 교체 후 진행하는가(fp-I3 — 동일 batch 판정 대상)** / **fp-C1 — §Execution handoff 개정 문안이 분할 plan에서 task 파일을 brief로 쓰고(task-brief 추출 생략) SDD workspace를 entrypoint 기준으로 유지하도록 안내하는가(어댑터 접점)** / D1 — 규약 명시 repo에서만 분할 관문을 적용하고 규약 없는 repo·단일 task 예외에서 스킵하는가 / D3 — 4종 항목을 검사하는가 / D5 — 저비용 위반은 해결 후 진행, 구조 재작성은 ESCALATE로 가는가 / D11 — 승계 ledger 부재를 "해당 없음 + 기록"으로 처리하는가 / D7 — 예시 커맨드를 판정 규정으로 오용하지 않는가. **no-guidance 대조군 포함**(순진 프롬프트가 자발 수행하는 부분과 스킬 기여분 분리).
- 합격선: 트랙 A·B와 동일하게 **variance 0**.

**(2) 위반 plan 픽스처 (마이크로테스트 입력물)**

- (a) 단일 파일 plan(superpowers 템플릿 형태 — Execution contract·§Shared Contracts 없음) (b) fingerprint 컬럼 없는 승계 ledger를 가진 spec + plan 조합 (c) task 표에 outcome 컬럼이 없는 분할 plan. 각 픽스처는 검사 대상 최소 구성으로 만들고 실제 ops-hub 문서를 쓰지 않는다(이웃 repo 의존 금지).
- 실호출(codex) 효과 대조는 하지 않는다 — C-5는 리뷰어 프롬프트 효과가 아니라 루프 세션의 절차 준수 문제다.

## 7. 미해결 질문

없음 — 2026-08-08 harden-spec에서 판단 갭 11건을 전부 질문으로 확정(D1~D11), 사실 갭 10건은 조회로 해소(§5 실측 + ops-hub 재조사·SDD 구조·setup/dev-cycle 접점 부재·ops-hub CLAUDE.md 규약 문단·08-05 outcome 형식). 잔여는 §잔여 리스크의 실측 관찰 2건.

## 8. 완료 조건 (acceptance criteria)

- (a) writing-plans-split Execution contract에 완료 기록 의무 ④가 계약 문면으로 들어가고(D2 — 주체·시점(완료 확정 직후, fp-C3)·커밋·수렴 검사 3시점·3원 대조(완료 권위 = SDD ledger 완료 기록, git log는 보조 검증, 부재 시 fail-closed)(fp-C2·fp-C4·fp-C6) 포함), task 표 서술·§Execution handoff와 모순이 없다. 계약 문안의 수렴 검사는 미기입 행뿐 아니라 **기입-미커밋 상태**를 수렴 대상에 포함한다(fp-C5 DEFERRED_TO_IMPL — 구현 시 문안에 반영, §6 GREEN 시나리오로 검증). 또한 fail-closed 되돌림은 **live ledger를 전제**하고, ledger가 없거나 **완료 기록이 하나도 없는데 표에 `[x]`가 있는** fresh/유실 상태(cleanup·`git clean -fdx` 후 identity-only 재생성·SDD 없는 실행)에서는 커밋된 표를 권위로 폴백해 **일괄 되돌림을 금지**하고 표로 ledger를 복원한다(fp-I1·fp-I2). §Execution handoff에는 SDD 6.2.0 task-brief 접점 어댑터 1줄이 들어간다(fp-C1 — §4 표).
- (b) review-loop plan 사전 게이트에 형식 관문 4종(D3)이 추가되고, 적용 조건(D1)·단일 task 예외(D1)·승계 ledger 부재 분기(D11)·실패 동작(D5)·명세 수위(D7)가 명시된다. 관문 ①은 블록 **존재**가 아니라 **현행 계약(④ 절 포함)** 여부까지 본다(fp-I3 — 항목 수는 4종 불변).
- (c) 게이트 체크가 grep 수준 경량 확인을 벗어나지 않는다 — 파서·스위트·훅 신설 없음, 출력 판정 기준 미규정(기결정 + D7).
- (d) writing-skills 마이크로테스트 5+ reps variance 0(no-guidance 대조군 포함) + 위반 픽스처 3종으로 D1·D3·D5·D11 동작 재현(D9).
- (e) `plugin.json` 0.9.0 → 0.10.0 범프 + README en/ko/ja 3종 동기 갱신 + 각 머신 `/plugin update` 안내 + 기채택 repo CLAUDE.md 규약 문단 갱신 안내 1줄(D8·D10).
- (f) `review-loop --phase impl` 종결 — 미판정 blocking 0 · 확인 부채 0.

## 9. 이 트랙에서 관찰할 것

이 트랙의 review-loop 루프는 **0.9.0 기결정 가드 focus 자동 주입이 실제로 적용되는 첫 루프**다(트랙 B 자신의 루프는 0.8.0 규정 대조군이었다). 종료 보고에 남긴다:

- focus 주입 후 재지목 건수 — 대조군: 트랙 B spec 루프 재지목 1건·impl 루프 3건(fp-B1 계열 통산 4회 포함).
- 트랙 B spec §잔여 리스크 실측 관찰 2건 — ① focus가 기결정 자체를 공격받게 만드는 역효과 ② focus 길이로 인한 주의 희석.
- 적대/확인 라운드 실소진·전환 신호 발화 지점(2모드 규정 세 번째 데이터셋, 0.9.0 규정 첫 데이터셋).

## 재논의 금지(기결정)

2026-08-08 harden-spec 세션에서 확정. 아래는 재론하지 않는다.

- **D1.** 분할 규약 관문 적용 = **repo 규약 명시 기준**(CLAUDE.md/AGENTS.md에 분할 plan 규약 명시된 repo만). 규약 없는 repo 스킵(오탐 0) · 단일 task 소형 변경 예외 명시.
- **D2.** 완료 기록 계약 = Execution contract ④ 신설 — **실행 dispatcher(직접 실행 시 실행자)가 task 완료 보고 수신 직후·다음 task 착수 전에 status·outcome 기입 + 그 자리에서 커밋**. subagent 로딩 계약 불변. "커밋 전 필수"의 정밀화 = "다음 task 착수 전 필수". *("완료 보고 수신 직후"의 규범 의미 = 완료 확정(리뷰 승인) 직후 — spec 루프 R2 fp-C3 정밀화. D2 근거가 지목한 "mark todo complete" 동기점과 정합, 번복 아님.)*
- **D3.** 게이트 검사 항목 4종 = Execution contract 블록 · §Shared Contracts · 승계 ledger fingerprint 컬럼 · task 표 status·outcome 컬럼.
- **D4.** fingerprint 관문 대상 = **이 루프가 승계·참조할 ledger**(통상 전 phase spec ledger). plan 자신의 ledger 형식은 §finding ledger 규약이 커버 — 이중 규정 금지.
- **D5.** 실패 동작 = **수위 차등 fail-closed** — 저비용 수정(블록·섹션·컬럼 추가)은 해결 후 진행, 구조 재작성(단일→분할 전환)은 ESCALATE(자동 재작성 금지).
- **D6.** outcome 준수의 추가 검사 지점 없음 — P1 계약 문구만(브리프 범위). 확장은 채움률 실측 후 후속 백로그.
- **D7.** 명세 수위 = 확인 항목 목록 규정 + **grep 예시 1줄 참고 병기**(출력 판정 기준 미규정 — 파서화 경계).
- **D8.** 스킬 문면만 개정 — 각 repo CLAUDE.md 규약 문단 갱신은 릴리스 종료 보고 **안내 1줄**, setup 미수정(접점 없음 확인).
- **D9.** 검증 = writing-skills 마이크로테스트(5+ reps · no-guidance 대조군 · variance 0) + **위반 plan 픽스처 3종**(단일 파일 유입 · fingerprint 없는 승계 ledger · 컬럼 누락). 실호출 효과 대조 불요.
- **D10.** 릴리스 = `plugin.json` 0.9.0 → **0.10.0** + README en/ko/ja 3종 동기 + 각 머신 `/plugin update` 안내.
- **D11.** 승계 ledger 부재 시 = **관문 해당 없음 + 게이트 기록 1줄**. 게이트는 형식 검사지 spec 절차 준수 강제가 아니다(순번 5 경량 경로 선점 금지).

**승계 가드 (이 spec이 전제하는 기존 기결정 — 재론 금지):**

- 브리프 §실행 순서 1~7 순차 진행(2026-08-07 사용자 결정). 이 트랙 = 순번 4. 다음 = 순번 5(C-6③ 경량 경로).
- **C-5 게이트 체크 = grep 수준 경량 확인(파서·스위트 금지)** — 브리프 §기결정 대조 명시.
- G1·G2(ui-mockup spec 2026-07-25) — 기계 검증 장치·보안 하드닝 머신 과설계 금지. 이 트랙도 프롬프트/절차 수준 변경만.
- 트랙 A 기결정(2모드 구조·예산 분리·전환 신호·확인 임무 4종·복귀 1회 등) + 트랙 B 기결정 D1~D14(가드 focus 주입·provenance) — 이 트랙은 그 위에 얹는다.
- ESCALATE batch 기계장치 유지(review-loop 0.2.0 회고).
- description은 트리거만(writing-skills 원칙) — 워크플로 요약 금지. 두 스킬 모두 description 변경 없음.
- no-AI-trace — 커밋·산출물에 AI 서명 금지.
- disposition 어휘 6종·"미판정 blocking 0" 목표·fingerprint 규약·분할 plan 구조(93.2% 채택) — 정착 자산, 변경 금지.
- codex companion 스크립트는 수정하지 않는다(다른 플러그인 소유).
- 완료된 task-NN plan 파일 동결(ops-hub CLAUDE.md — plan churn 금지): D2의 기입 대상은 **entrypoint task 표**이지 task 본문 파일이 아니다.

## 잔여 리스크 (DEFERRED)

없음 — 판단 갭 11건 전부 질문으로 해소(사용자 유예 항목 0건).

**검증 필요(실측 관찰 항목, 결정 대상 아님):**

1. **outcome 채움률 개선 효과**: D2 계약화가 25%를 실제로 끌어올리는지는 릴리스 후 ops-hub 실사용에서만 관찰 가능(브리프 §프로그램 전체의 후속 관찰 지표 — outcome 채움률 — 와 동일 항목). 부족하면 D6의 후속 백로그(검사 지점 확장)를 연다.
2. **규약 명시 위치 변형**: D1의 판정 원천(CLAUDE.md/AGENTS.md)이 다른 위치(팀 위키·별도 규약 문서)에 있는 repo 변형이 나타나면 판정이 흔들릴 수 있다 — 첫 실전 게이트에서 관찰.

## 적대검증 ledger (spec)

review-loop `--phase spec` (2026-08-08 시작). base = `7171c73` (main 트랙, 0.9.0 릴리스 커밋). 이 표가 이 루프의 단일 원본이다 — 다른 문서는 참조만.

| fingerprint | severity | disposition | 근거 |
|---|---|---|---|
| **fp-C1** — spec §5 실측 · SDD 6.2.0 `task-brief`(단일 PLAN_FILE 전제)와 분할 entrypoint의 접점 미명시 → 완료 기록 계약이 정상 실행 경로에 못 닿을 위험 지적 · 권고 = Execution handoff에 6.2.0용 절차 어댑터 명시 | high (R1) | ESCALATE → **FIXED (사용자 판정, batch flush 2026-08-08)** | batch 제시 선택지 중 "C-5에 흡수" 채택 — §4 표(handoff 어댑터 1줄: task-brief를 해당 task 파일에 적용)·§5 실측 정밀화·§6 GREEN 확인 항목·§8 (a) 반영. 사실 검증: task-brief 스크립트·프로즈 계약·93.2% 채택 실측 병존 — "실행 불능"은 과대, 접점 미문서화는 실재. 판정 주체 = 사용자 |
| **fp-C2** — spec §3 D2 · 완료 기록 계약의 재개 수렴 갭(기입 트리거가 "완료 보고 수신"에만 묶여 중단·재개 시 미기입 행 잔존, SDD progress ledger와 불수렴) + fix wave 후 outcome 낡음 · 권고 = 멱등 수렴 절차 | medium (R1) | FIXED (R1) | ④ 트리거에 재개 경로 명시(모든 task 착수 전 이전 행 확인·수렴 — D2 "다음 task 착수 전" 기한의 정밀화, 기결정 불변). fix wave 후 재갱신은 비목표+D6 백로그 병기. §3 D2 보강·§2 비목표·§4 표·§6 GREEN·§8 (a) 반영 — **[루프 판정] 범위 획정 포함(확인 임무 ③ 우선 감사 대상)** |
| (R2 재출현) SDD 실행 경로 미연결 — 리뷰어 스스로 "기존 fp-C1과 동일한 열린 위험" 명시 | high (R2) | DUPLICATE | 원본 = fp-C1(ESCALATE batch-pending, 미판정 유지). 닫힌 항목 재지목 아님 — 미판정 ESCALATE의 재출현(가드 focus는 닫힌 항목만 억제). **[루프 판정]** R3 focus 요약행 등재(확인 임무 ③ 우선 감사 대상) |
| **fp-C3** — spec §3 D2 · 기입 트리거 "완료 보고 수신 직후"가 구현자 DONE(리뷰 전)으로 읽힘 — task review 실패·fix loop 시 미승인 task가 `[x]` 잔존 · 권고 = 트리거를 리뷰 승인 후 동기점("mark todo complete")으로 명시 | high (R2) | FIXED (R2) | 사실 실증(SDD 흐름: approved? → yes → mark todo complete). D2 근거 자체가 동기점을 "mark todo complete"로 지목 — 트리거 문구를 "완료 확정(리뷰 승인) 직후"로 정밀화(기결정 정합, 번복 아님). §3 D2 본문·보강 bullet·재논의 금지 D2 주석·§4 표·§6 GREEN·§8 (a) 반영 — **[루프 판정] 기결정 문구 정밀화 해석 포함(확인 임무 ③ 우선 감사 대상)** |
| **fp-C4** — spec §3 D2 보강 · 마지막 task의 재개 수렴 트리거 부재(fp-C2 잔존 계열 — "task 착수 전" 검사만으론 최종 task 완료 직후 중단 시 최종 행 영구 누락) · 권고 = 재개 초기화·final review 진입 전 수렴 + 픽스처 | medium (R2) | FIXED (R2) | 수렴 검사 시점을 3점으로 완결(ⓐ task 착수 전 ⓑ 재개 초기화 ⓒ final whole-branch review 진입 전). fp-C2와 지적 내용이 다른 신규 경계 — 계열 3회째 재출현 시 판정으로 닫음(anti-churn). §3 D2 보강·§4 표·§6 GREEN·§8 (a) 반영 |

| **fp-C5** — spec §3 D2 보강 · "기입 후 커밋 전 중단" 재개 변형 — 수렴 조건이 "미기입"만 검사해 기입-미커밋 상태가 통과, 다음 task 커밋에 혼입 위험 · 권고 = 수렴 시점에 커밋·clean 확인 추가 | medium (R3) | DEFERRED_TO_IMPL | fp-C2 계열 3회째(R1 미기입 행 → R2 마지막 task → R3 기입-미커밋) — fp-C4 행의 선기록(3회째 = 판정 마감) + R3 판정 루프 국면에 따라 설계 보강 중단. 실행 영향 낮음(수렴 규범 "기입+커밋"이 커밋 포함, dispatcher가 자연 수렴). **연결** = §8 (a) 계약 문안 요건("기입-미커밋 상태 포함") + §6 GREEN "기입 후 커밋 전 중단" 시나리오. **[루프 판정]**(확인 임무 ③ 우선 감사 대상) — 확인 C1 감사: 적정 |
| **fp-C6** — spec §3 D2 보강(C1 잔존 해소분) · 권위 순서 "git log 최상위"가 결함 — 구현자 커밋은 리뷰 승인 전에 존재하므로 git log를 완료 권위로 삼으면 리뷰 실패·fix-loop 중 task를 `[x]`로 복구, 미승인 구현 위에 후속 작업 적재 · 권고 = SDD ledger 완료 기록을 권위로, git log는 보조 검증, 부재 시 fail-closed | high (R4 복귀) | FIXED (R4) | 루프가 C1 잔존 해소에서 도입한 오류의 교정(anti-churn 대상 아님 — 신규 경계 추격이 아니라 자기 수정 회귀). 리뷰어 권고가 D2 "완료 확정 = 리뷰 승인 후"와 정합하는 유일한 의미론. §3 D2 보강 bullet 권위 교체·§6 GREEN(mid-loop 시나리오)·§8 (a) 반영 |

**미확인 FIXED 큐**: **비어 있음 (종결)** — fp-C3·fp-C4는 확인 C1에서, fp-C1·fp-C2·fp-C6은 재진입 확인 C2에서 소멸 확인(fingerprint별 명시). 확인 부채 0.

**batch flush (2026-08-08, 적대 소진 3 = auto-rounds 도달 + 전환 신호 2)**: batch ESCALATE 1건(fp-C1) 사용자 제시 → FIXED(C-5 흡수)로 종결. 자동 수정 3건(R1 `0d60dac` · R2 `b153e6f` · R3 `692cdfd` 판정) 전부 승인. → 확인 모드 진입(확인 필수 조건 성립: 큐 4건 + 루프 직접 판정 2건(DUPLICATE·DEFERRED_TO_IMPL), 확인 예산 2/2 잔여).

**확인 C1 (2026-08-08, base `7171c73` → target `513a477`)**: 응답 완전(계약 충족). ① 큐 소멸 확인 — **fp-C3 소멸 · fp-C4 소멸**(큐 제거) / **fp-C1 잔존**(어댑터가 입력 치환 방식이라 workspace 분산·"Task N" 제목 비호환 — 사실 검증됨) / **fp-C2 잔존**(단방향 복구만 규정 — 3원 대조·권위 순서 부재, 역방향 불일치 시 완료 task 재실행 위험). ② 회귀 없음. ③ 판정 감사 4건 **전부 적정**(DUPLICATE R2 오매칭 없음 · fp-C5 DEFERRED_TO_IMPL 비례 적정 · fp-C2 범위 획정 적정 · fp-C3 문구 해석 적정). ④ verdict **not-ready**(fp-C1·fp-C2 잔존 귀속). 신규 finding 0. → 잔존 2건 §2c 재판정: 둘 다 FIXED 후보(방향 명확 — fp-C1 = 추출 생략·workspace 고정 어댑터로 정밀화, fp-C2 = 3원 대조·권위 순서 보강) → R4 수정 반영 → **적대 복귀 발동(1/1 소진, 상한 밖)** → 재진입 확인 C2 예약(상한 밖, 예산 검사 면제).

**score 이력** (산식: 미판정 blocking Σweight, 분류 직후·수정 전 스냅샷, 미확인 FIXED 큐 제외):

| 라운드 | 모드 | score | 구성 | 큐 크기 |
|---|---|---|---|---|
| R1 | 적대(자동 1/3) | 4 | fp-C1 high(3, ESCALATE batch-pending) + fp-C2 medium(1, FIXED 후보) | 0 |
| R2 | 적대(자동 2/3) | 7 | fp-C1 high(3, batch-pending 잔존) + fp-C3 high(3, FIXED 후보) + fp-C4 medium(1, FIXED 후보) | 1 |
| R3 | 적대(자동 3/3) | 4 | fp-C1 high(3, batch-pending 잔존) + fp-C5 medium(1, DEFERRED_TO_IMPL로 즉시 판정) | 3 |
| C1 | 확인(소진 1/2) | — | 큐 4건 중 소멸 2(fp-C3·C4)·잔존 2(fp-C1·C2 → R4 재수정) · 감사 4 적정 · 신규 0 · verdict not-ready | 4→2 |
| R4 | 적대(복귀, 상한 밖 — 소진 3 유지) | 3 | fp-C6 high(3, FIXED 후보 — C1 잔존 해소분의 권위 순서 오류 교정) | 2 |
| C2 | 확인(재진입, 상한 밖 — 소진 1 유지) | — | 큐 3건(fp-C1·C2·C6) 전부 소멸 확인 · 감사 해당 없음 · 신규 0 · **verdict merge-ready** | 3→0 |

**성공 종료 (2026-08-08, 확인 경유)**: 미판정 blocking 0 · 미확인 FIXED 큐 0 · 확인 C2 verdict merge-ready — 불변식 3종 충족. 재진입 확인 C2(base `7171c73` → target `927f675`)의 소멸 확인 fingerprint = fp-C1·fp-C2·fp-C6(각 근거 명시). 복귀 1/1 소진, 재진입 blocking 재발 없음(ESCALATE 경로 미발동).

**전환 신호**: R3에서 신호 2(수정 큐 소진 — 신규 FIXED 후보 0건) 발화 + 적대 소진 3 = auto-rounds 도달. → batch ESCALATE 일괄 제시 후 확인 모드 진입.

**0.9.0 가드 focus 첫 실적용 관찰(spec §9)** — R1: 재지목 0건(대조군 트랙 B spec R1 재지목 1건). 기결정 역공격 없음 — 리뷰어가 finding 2건 모두에 "기결정 중복 가능성 낮다"를 자발 명시하고 D2 재론을 회피한 채 인접 갭만 지목(가드 정상 작동 신호). 주의 희석 없음 — 발굴 2건 모두 실질(사실 기반 실증됨). R2: 닫힌 항목 재지목 0건(재출현 1건은 미판정 fp-C1 — focus 억제 대상 아님, 정상). 기결정 역공격 없음 — fp-C3는 D2 재론이 아니라 근거("mark todo complete")와 문구의 어긋남 지적(가드 단서 ②의 의도된 동작). 주의 희석 없음 — 신규 2건 모두 실질. R3: 닫힌 항목 재지목 0건 — R2에서 focus에 실은 [루프 판정] DUPLICATE 요약행(fp-C1 계열)이 즉효(fp-C1 재보고 소멸, 리뷰어가 fp-C2와의 의미 차이를 자발 논증하며 신규 변형만 보고). R4(복귀): 재지목 0건 — focus에 fp-C1(사용자 FIXED)·fp-C5(DTI) 요약행 2건 탑재, 리뷰어는 C1 잔존 해소 수정의 신규 회귀(fp-C6)만 지목(복귀 라운드 목적에 정확히 부합). 루프 통산 재지목 1건(대조군 트랙 B: spec 1·impl 3).

**종결 집계(§9 관찰 최종)**: 총 라운드 = 적대 4(소진 3/5 + 복귀 1) · 확인 2(소진 1/2 + 재진입 1). 전환 신호 = R3에서 신호 2(수정 큐 소진)와 적대 소진 3=auto-rounds 도달 동시 발화. disposition 집계 = FIXED 5(fp-C1 사용자·fp-C2·C3·C4·C6) / DEFERRED_TO_IMPL 1(fp-C5) / DUPLICATE 1(R2 재출현) / ESCALATE 1(fp-C1 — batch에서 사용자 FIXED로 종결) / ACCEPTED·OUT_OF_SCOPE·low 0. 0.9.0 focus 주입 관찰 결론 — ① 재지목: 통산 1건(트랙 B spec+impl 4건 대비 감소, 그마저 미판정 ESCALATE 재출현이라 focus 억제 범위 밖·R3 focus 등재 후 소멸) ② 기결정 역공격: 0건(전 라운드에서 리뷰어가 기결정 재론 회피를 자발 명시) ③ 주의 희석: 0건(전 라운드 발굴이 실질 — 특히 R4가 focus 2행을 실은 채 신규 회귀 fp-C6을 정확히 지목).

## 적대검증 ledger (impl)

review-loop `--phase impl` (2026-08-08 시작). base = `7171c73` (main 트랙, 0.9.0 릴리스 커밋 — spec 루프와 동일 스냅샷, whole-branch). 리뷰 대상 = 구현 커밋 `0c08e5b`(스킬 2종 개정: writing-plans-split 계약 ④·task 표 연결·SDD 6.2.0 어댑터 / review-loop §1 plan 형식 관문 4종). 이 표가 이 루프의 단일 원본이다 — 다른 문서는 참조만.

**사전 게이트(impl)**: npm 프로젝트 아님(`package.json` 부재) → 트랙 B impl 전례대로 **writing-skills TDD GREEN 기록으로 갈음** — 10 시나리오 × 5 reps = 50 runs, 전건 variance 0 (`.remember/tdd-plan-gate.md`). 보안 크리티컬 자가 판정 = **일반 트랙**(접촉면 = 스킬 산문, 권한·인증·보안 경계·데이터 손상·비가역 마이그레이션 무접촉).

| fingerprint | severity | disposition | 근거 |
|---|---|---|---|
| **fp-I1** — writing-plans-split 계약 ④ · 완료 권위를 수명주기가 맞지 않는 SDD ledger에만 둠 — ledger 전체 부재 시 fail-closed가 완료 행을 일괄 되돌려 완료 task 재dispatch(중복 마이그레이션·외부 부작용 재실행) · 권고 = "ledger 존재하나 기록 없음"과 "ledger 자체 부재"를 구분하고 영속 권위 지정 + 재개 경로 마이크로테스트 추가 | high (R1) | FIXED (R1) | 사실 3건 독립 검증: ① SDD 6.2.0 workspace = git-ignored·final review 후 `rm -rf` 삭제(SKILL.md:123·419) ② `git clean -fdx` 파괴 시 SDD 자신의 복구 지침 = git log(SKILL.md:139) — 그런데 fp-C6 교정이 git log를 보조로 강등해 SDD의 유일한 복구 경로를 계약이 막음 ③ 이 repo README.ko.md:75가 **SDD 없는 대체 실행 명시 지원**("하드 의존 아님") → 권위 기록이 아예 없는 실행 경로 실재. fp-C6과 **지적 내용이 다른 신규 경계**(리뷰 전 구현 커밋 오인 ≠ 권위 파일의 정상 삭제·부재) — 리뷰어도 겹침 가능성을 자발 명시했고 대조 결과 DUPLICATE 아님. 기결정 번복 아님(D2는 권위 출처 무규정, fp-C6 의미 보존). 수정 = 계약 ④에 부재 분기 추가(ledger 부재 시 권위 = 커밋된 entrypoint 표 — ④가 완료 확정 시점에만 기입·커밋하므로 리뷰 승인된 영속 기록, git log는 커밋 존재·비-revert 보조 / 일괄 되돌림 금지 / 판독 불가 시 사람 확인). 리뷰어 2안 중 "cleanup 전 tracked completion snapshot"은 **승계 가드 G1·G2(기계 검증 장치 신설 금지) 저촉**이라 채택하지 않음 — 산문 분기만. spec §3 D2 보강·§6 GREEN·§8 (a) 동기 반영 |
| **fp-I2** — writing-plans-split 계약 ④ · fp-I1이 넣은 폴백 분기가 "ledger 파일 부재" 조건이라 실제 SDD 재개 순서에서 무력 — SDD 셋업이 plan을 읽기 전 identity-only `progress.md`를 재생성하므로 `git clean -fdx` 유실 후에도 ledger가 "존재"해 일괄 되돌림이 그대로 걸림 · 권고 = 새로 생성된 identity-only ledger를 부재로 취급, 커밋된 표로 ledger 복원 후 fail-closed 적용 | high (R2) | FIXED (R2) | 사실 검증: SDD 6.2.0 셋업 순서 = workspace 해소 → ledger 확인 → **identity 첫 줄로 ledger 생성** → plan 읽기 → todo 생성(SKILL.md 셋업 절). 지적대로 R1 조건은 유실 경로에서 발동하지 않는다. **R1 수정 자신의 회귀 교정** — 신규 경계 추격이 아니라 자기 수정이므로 anti-churn 대상 아님(spec 루프 fp-C6 전례 동형). 수정 = 판정 기준을 파일 존재에서 **내용**으로 이동(완료 기록 0건 + 표에 `[x]` 존재 → fresh/유실로 간주) + 폴백 후 표로 ledger 완료 줄 복원. 리뷰어도 "미확인 FIXED 큐 지적이 아니다"를 자발 명시 — 진행 상태 한 줄이 계열 B 오지적을 억제하면서 실질 잔존 경로 보고는 통과시킨 사례 |
| **fp-I3** — review-loop §1 plan 형식 관문 · 관문 ①이 블록 **존재**만 확인해 구버전 Execution contract(④ 완료 기록 절 없음)를 false-pass — 구버전 플러그인·미갱신 머신이 만든 plan이 이번 트랙의 핵심 보호 없이 승인됨 · 권고 = ①을 '현행 canonical 계약' 확인으로 명확히(별도 파서·5번째 관문 불요) | medium (R2) | FIXED (R2) | 사실 검증: base 커밋의 구버전 entrypoint가 ①②④를 모두 통과하는 것이 실증(관문 문면이 존재 확인뿐). **D3 재론 아님** — 항목 수 4종 불변, ①의 검사 *내용* 문제. 리뷰어도 이 경계를 자발 명시. 기결정 정합: 파서·5번째 관문 없이 문면만(D7·G1·G2), 실패 시 블록 교체는 저비용(D5 "해결 후 진행"), 대상은 이번 루프가 리뷰할 plan뿐(§2 비목표 "소급 적용 없음"). 수정 = ① 문면 + grep 예시에 `record completion` 추가(예시 1줄 유지). spec §3 D3 보강·§6 GREEN·§8 (b) 동기 반영 |

**미확인 FIXED 큐**: fp-I1 · fp-I2 · fp-I3 (R1~R2 수정, 소멸 확인 전).

**batch 적재(진행 중)**: **D9 재검증 범위** — fp-I1 수정이 스킬 계약 문면을 바꿨으므로 브리프 §0-2 규약("스킬 문구 변경은 writing-skills TDD 필수")상 신규 시나리오(SDD workspace 부재 재개 · SDD 없는 직접 실행)의 GREEN 마이크로테스트가 필요하다. 이번 세션에서는 하네스가 휘발됐고 실행에 별도 에이전트 디스패치가 필요해 미실행 — **"지금 재검증 / 릴리스 전 별도 세션 / 문면 신뢰로 생략" 중 사용자 판정**을 batch flush에서 받는다. finding이 아니라 FIXED 조치에서 파생된 결정이라 fingerprint를 부여하지 않는다. **R2에서 대상 확대** — fp-I2(내용 기준 폴백·ledger 복원)·fp-I3(관문 ① 현행 계약 확인)도 같은 재검증 대상에 들어간다(§6 GREEN 시나리오 2종 추가 기재).

**focus 조립 기록 (R1)**: 재논의 금지(기결정) 블록 전문(D1~D11 + 승계 가드)만 부착. **닫힌 ledger 요약행은 의도적으로 0행** — spec ledger의 닫힌 항목 중 fp-C1·C2·C3·C4·C6은 disposition이 FIXED로 focus 요약행 입도 규격(ACCEPTED/OUT_OF_SCOPE/DEFERRED_TO_IMPL/DUPLICATE)에 없고, fp-C5(DEFERRED_TO_IMPL)와 R2 DUPLICATE는 **도착지·원본이 바로 이 impl 단계**라 억제하면 "구현이 그 요건을 실제로 담았는가"라는 impl 리뷰 본무를 막는다. 미확인 FIXED 큐 0건이라 진행 상태 한 줄도 생략. **[루프 판정]** — 확인 임무 ③ 우선 감사 대상.

**score 이력** (산식: 미판정 blocking Σweight, 분류 직후·수정 전 스냅샷, 미확인 FIXED 큐 제외):

| 라운드 | 모드 | score | 구성 | 큐 크기 |
|---|---|---|---|---|
| R1 | 적대(자동 1/3) | 3 | fp-I1 high(3, FIXED 후보) | 0 |
| R2 | 적대(자동 2/3) | 4 | fp-I2 high(3, FIXED 후보) + fp-I3 medium(1, FIXED 후보) | 1 |
