# review-loop·파이프라인 개선 착수 브리프 — ops-hub 실사용 점검(2026-08-07) 기반

- 상태: **착수 브리프** (spec 이전 입력 — 이 문서를 읽고 트랙 A부터 진행)
- 작성: 2026-08-07, ops-hub 점검 세션에서 인계
- 근거 저장소: 이웃 repo `../ops-hub/` (증거 파일 경로는 전부 그 기준. 세 머신 공통으로 workspace 루트에 두 repo가 나란히 있다)
- 사용자 방향 승인: **트랙 A의 골격(적대→확인 2모드 리뷰)은 2026-08-07 사용자가 발의·승인**했다. 세부 설계 질문(§트랙 A-4)은 harden-spec에서 확정한다.
- **사용자 결정(2026-08-07): 아래 §실행 순서의 1~7 전 항목을 우선순위대로 순차 진행한다.** 일부만 골라 하는 것이 아니다 — 순서·범위 재론 없이 1번부터 시작한다.

## 실행 순서 (사용자 결정 — 1~7 순차, 전 항목 · 순번 8은 2026-08-09 추가 결정)

| 순번 | 내용 | 이 문서의 트랙 | 대상 스킬 |
|---|---|---|---|
| 1 | review-loop 적대→확인 2모드 리뷰 (확인 부채·정체 규칙을 구조로 흡수) | **트랙 A** | review-loop |
| 2 | 기결정 가드 focus-text 자동 주입 | **트랙 B** | review-loop |
| 3 | 런북 자체 보완 흡수 + severity 재평가 지침 | C-1 + C-2 | review-loop |
| 4 | plan 게이트 강화 (outcome 기입 계약화 + 규약 준수·ledger 형식 체크) | C-5 | writing-plans-split·review-loop |
| 5 | 경량 경로(소형 트랙 fast lane) 공식화 | C-6③ | dev-cycle(+harden-spec 연동) |
| 6 | dev-cycle 9단계(통합·후속 검증) + 착수 브리프 생성 안내 | C-6①② | dev-cycle |
| 7 | 소폭 묶음: impl ledger 위치 명시 · 핸드오프 4섹션 승격 · ui-mockup 2건(생략 D번호화·슬러그 접미) · 훅 재넛지 · doctor | C-3·C-4·C-7·C-8·C-9 | review-loop·ui-mockup·훅·setup |
| 8 | dev-cycle 판별 ③ 구조 재검토 (경로 판정 상태 vs 단계별 생략 기록의 계층 분리) | **C-10** | dev-cycle |

- 한 순번 = 한 트랙(스펙→검증→구현→릴리스 완결) 후 다음 순번으로. 단계 경계·트랙 경계는 새 세션 + 핸드오프 규약을 따른다.
- 순번 1과 3은 같은 SKILL.md(review-loop)를 연속으로 고치므로, **순번 1의 harden-spec에서 3을 같은 릴리스로 흡수할지**(1+3 통합 spec) 판단해도 된다 — 흡수해도 "전 항목 진행" 결정과 모순되지 않는다. 순번 7은 성격상 한 트랙으로 묶는다.
- **C-10 = 순번 8 (2026-08-09 사용자 결정).** 순번 5+6(C-6) impl 루프에서 신규 발생한 항목이라 2026-08-07 "1~7 전 항목" 결정 시점에 없었고, **순번 7 흡수 대신 별도 순번 8로 배치**했다: 순번 7은 소폭 묶음인데 C-10은 dev-cycle SKILL.md 문면 변경이라 §0-2 규약상 writing-skills TDD가 따로 붙고, C-6 실측(5+6 흡수 = arm 29종·GREEN 136런 + impl 배치 66런)이 **한 트랙에 항목을 더 얹으면 TDD가 모델 주간 한도를 넘긴다**는 것을 보였다. 이 배치로 fp-I12·fp-I13 ACCEPTED의 보완 단계가 실행 순번을 갖는다.

## 0. 진행 방법 (이 repo 규약)

1. 이 브리프를 읽고 **현재 순번의 트랙을 spec 초안으로 변환** → `harden-spec` → `review-loop --phase spec` → **writing-skills TDD로 직접 구현**(plan phase 생략은 ui-mockup 트랙 전례: `docs/specs/2026-07-25-ui-mockup-skill-design.md` ledger 이월 해소 항목) → `review-loop --phase impl`.
2. 스킬 문구 변경은 **writing-skills TDD 필수** — 베이스라인(현행 스킬로 실패 재현) → 개정 → 마이크로테스트(5+ reps, no-guidance 대조군 포함). ui-mockup·review-loop 0.2.0 개정 전례와 동일.
3. 릴리스: `plugin.json` minor 범프 + **README 3종(en/ko/ja) 동기 갱신** + 각 머신 `/plugin update` 안내.
4. 트랙 종결 시 핸드오프에 "다음 순번"을 명시해 다음 세션이 이 브리프의 §실행 순서에서 이어받게 한다.

## 1. 배경 — ops-hub 실사용 점검 요약

점검 방법: 플러그인 0.7.1 스킬 6종 전문 + ops-hub `docs/`(specs 90·plans 88·design 9 디렉터리) 전수 + `../claude-memories/ops-hub/` 메모리·핸드오프 + 런북 교차 검증.

**정착한 것(건드리지 말 것):** 분할 plan 93.2%(task 파일 671개·명명 준수 98.5%), ui-mockup compare.html 100%, disposition 어휘 6종·"미판정 blocking 0" 목표(재논의 금지 블록이 125개 파일에 승계), harden-spec 확정 D번호가 코드 상수 주석까지 내려감. ESCALATE batch 기계장치는 실측 트랙당 0건(14회)·1건(7회)으로 거의 미가동이나 **"무해라 유지"가 기결정**이다(재론 금지).

**마찰 실측 (grep 카운트, ops-hub docs 기준):**

| 신호 | 실측 | 의미 |
|---|---|---|
| "확인 부채" 언급 | **78개 파일** | max 5 도달 시 마지막 라운드 FIXED가 재확인 없이 다음 단계로 — 최대 마찰 |
| "max 도달" 계열 | 55개 파일 | 대부분의 트랙이 예산 5회를 소진하고 끝난다 |
| 기결정 "재지목" | **400회 / 92개 파일** | 적대검증자가 기결정·전 라운드 판정을 모른다 |
| blocking score 추이 | **7개 트랙 실측 전부 비단조** (예: 3→4→5→7→7→0) | "2회 연속 비감소=정체" 규칙이 상시 성립 직전 — 적대 리뷰는 매회 전체 diff를 다시 보므로 절대 0은 도달 불가 |
| 자기유발 churn | 수정이 도입한 결함 계열 3회(cR2-B→cR4-A→cR5-A) 등 | 후반 라운드 finding의 상당수가 신규 영역이 아니라 직전 수정의 부산물 |

**확인 라운드의 가치 실증 (max 너머 수동 연장 사례):**

- `../ops-hub/docs/plans/2026-07-31-content-ops-visibility.md:361` — max 도달 후 사용자가 확인 라운드 R6 선택 → R6가 iR5-F1의 불완전성(iR6-F1)을 실제로 잡음, R7이 파생 결함 1건 추가, R8이 소멸 확인. impl 총 9라운드.
- `../ops-hub/docs/plans/2026-07-18-report-knowledge-search.md:302` — cR6(새 세션 whole-branch)가 확인 부채 해소를 확정했는데, cR7이 다시 "cR6 수정이 도입한 unsatisfiable 게이트"를 발견. 이 트랙은 spec·plan·impl **3연속 확인 부채** 발생.
- `../ops-hub/docs/plans/2026-06-23-teams-and-permission-matrix.md:198` — **보안 크리티컬 트랙**: R6→R8 연장이 critical(F-N)·데드락(F-P)·override in-tx(F-Q)·비활성 팀 경계(F-R)·배포 순서(F-T) **신규 5건**을 잡음. ⚠ 이 사례는 "후반 라운드=확인만"이 보안 트랙에서는 위험함을 보여준다(트랙 A 탈출구·예외의 근거).
- 대조: SDD 내장 리뷰를 잘 돌린 트랙은 review-loop impl이 R1 종결(`../ops-hub/docs/plans/2026-08-05-report-weekly-meeting-view.md:120`).

**적대검증자 성향 (이 repo 자신의 기록):** `docs/specs/2026-07-25-ui-mockup-skill-design.md` impl ledger R2 관찰 — "적대검증자는 보안 기계 장치를 반복 요구하는 성향이 있고, G1·G2 블록이 diff에 있어도 이를 억제하지 않는다." 같은 문서 "I1 실전 검증" — "문서 규칙의 문자적 논리 갭은 LLM 실행에서 자동 보완될 수 있으므로 severity를 실행 영향으로 재평가해야 한다(문자적 갭 ≠ 즉시 high)". **이 교훈이 review-loop SKILL.md 본문에는 미반영**(트랙 C-2).

**ops-hub가 스킬 밖에 발명한 보완(스킬로 흡수 후보, 트랙 C-1):** `../ops-hub/docs/workflow/review-loop-runbook.md`(2026-06-24 이후 동결) —
- phase별 리뷰 입도: spec=단일 1회 / plan=**통합 1회, task별로 쪼개지 말 것**(전체 정합성이 plan의 가치) / impl=per-task 증분+마지막 통합.
- 증분 base 안전조건: `--base <직전 task>`는 이전 task 회귀를 못 보므로 **반드시 마지막에 `--base main` 통합 1회**.
- SDD 연계: SDD 내장 리뷰(건설)와 codex(적대)는 보완 — codex를 task마다 끼우지 않고, **SDD가 approved 커밋을 끝낸 뒤 그 위에서** codex를 돌린다(동시 수정 금지).
- codex 실행 팁: 큰 diff는 `--wait`를 `run_in_background`로, 결과 추출 `sed -n '/^# Codex Adversarial Review/,$p'`.
- 핸드오프 4개 고정 섹션(현재/task 진행/미해결 ledger/다음 액션) — `--resume`의 실사용 기록은 0건이고 이 핸드오프가 실질 재개 수단.

---

## 트랙 A (주 트랙) — review-loop "적대→확인" 2모드 리뷰

### A-1. 문제

세 마찰의 뿌리가 같다: **적대 리뷰어의 목적함수는 "공격"이라 몇 번을 돌려도 finding 0이 나오지 않는다.**

1. **확인 부채(78파일)** — 마지막 라운드 FIXED를 재확인할 라운드가 예산에 없다.
2. **churn** — 후반 라운드가 신규 영역·자기유발 결함으로 소모되고 score가 수렴하지 않는다(7/7 비단조).
3. **오버엔지니어링 압력** — 적대검증자가 위협 모델 밖 기계 장치를 반복 요구한다(G2 관찰).

### A-2. 승인된 골격 (사용자 발의·승인 2026-08-07)

리뷰 라운드를 2모드로 나눈다:

- **적대(발굴) 모드** — 현행 adversarial-review. 초반 라운드.
- **확인(중립) 모드** — 후반 라운드. 목적함수가 "머지 가능한가 판정"이라 "신규 blocking 없음, 수정 확인됨"이 정당한 출력 → 종료가 자연스럽고, 확인 부채가 구조적으로 사라지며, 비례성 시각이 오버엔지니어링을 거른다.

사용자 원안은 "3회 적대 + 2회 확인"의 고정 분할이었고, 논의를 거쳐 다음 두 보완이 함께 승인됐다:

1. **고정 회차가 아니라 신호 기반 전환** — 트랙 편차가 크다(R1 종결 트랙 vs R8까지 실결함 트랙). 기존 "판정 루프 전환" 신호(score 2회 연속 비감소·FIXED 큐 소진)를 전환 트리거로 재활용하면 평균 트랙은 대략 3+2 근처로 수렴한다.
2. **확인 리뷰의 임무 4종 고정 + ledger 입력** — 빈손 "중립으로 봐줘"는 도장 찍기가 된다. 확인 리뷰어에게 ledger를 입력으로 주고:
   - ① 직전 라운드 FIXED fingerprint들의 소멸 확인
   - ② 수정이 닿은 영역 주변의 회귀 확인
   - ③ ACCEPTED/OUT_OF_SCOPE 판정의 비례성 점검(판정 감사)
   - ④ 머지 준비도 verdict
   - "신규 영역 발굴은 임무가 아니다. 단, 발견한 blocking은 보고한다"를 명시(도장/사냥 재개 사이 균형).
3. **탈출구** — 확인 라운드에서 blocking이 나오면 적대 모드 복귀. 보안·권한·데이터 크리티컬 트랙은 전환을 늦춘다(teams 사례가 근거).

### A-3. 구현 힌트 (companion 실측 확인, 2026-08-07 · codex 플러그인 1.0.6)

- `codex-companion.mjs adversarial-review [--wait|--background] [--base <ref>] [focus text]` — focus text가 리뷰 프롬프트의 `USER_FOCUS`로 들어간다(`scripts/codex-companion.mjs` `buildAdversarialReviewPrompt`). 단 기저 템플릿이 적대라 확인 모드를 focus만으로 온전히 누를 수 있을지는 미검증.
- `codex-companion.mjs task [--background] [prompt]` — 임의 프롬프트 실행. **확인 리뷰 프롬프트를 전체 통제할 수 있어 이쪽이 깨끗하다**(권고). codex 샌드박스는 read-only라 게이트(테스트) 실행은 못 시킨다 — 게이트는 현행대로 루프 세션이 돌린다.
- native `/codex:review` 매핑은 custom focus를 지원하지 않는다(companion `validateNativeReviewRequest`가 거부).

### A-4. harden-spec에서 확정할 설계 질문 (미확정 — 갭 대장 시드)

1. **예산 구조**: 확인 라운드를 max 5에 포함할지, 수정(적대) 라운드 상한과 분리해 확인 1~2회를 별도 예산으로 둘지. (분리 권고 — 정체가 R4~5에 와도 확인이 보장되도록)
2. **전환 신호의 정확한 정의**: 현행 score 정체 그대로 쓸지, 재지목(DUPLICATE)·자기유발 결함을 제외한 "신규 실결함 유입" 기준으로 바꿀지.
3. **확인 리뷰 실행 방식**: `task` 커맨드(프롬프트 전체 통제) vs `adversarial-review`+focus(기저 적대 프롬프트 잔존 위험). 마이크로테스트로 판가름.
4. **복귀 규칙**: 확인 라운드 blocking 발견 시 적대 복귀의 횟수 제한(무한 왕복 방지).
5. **보안 크리티컬 트랙 판별 기준과 예외 동작**(전환 지연·적대 연장).
6. **`--auto-rounds`와의 관계**: 자동/정밀 모드 축과 적대/확인 모드 축이 직교하는지, 통합할지.

### A-5. 검증 계획

- **베이스라인**: 현행 스킬로 "score 정체 시 판정 루프 전환" 시나리오를 돌려 확인 부채·churn 재현을 기록(writing-skills RED).
- **ops-hub 파일럿(선택, 스킬 개정 전 실측)** — ops-hub의 다음 review-loop(impl 권장) 세션에 아래 지시를 얹으면 스킬 수정 없이 효과를 실측할 수 있다:

  > 이번 review-loop에서 blocking score가 2회 연속 비감소하거나 FIXED 큐가 소진되면, 이후 라운드는 **확인 리뷰 모드**로 전환한다. 확인 리뷰 = codex companion `task` 커맨드에 ledger 표와 직전 FIXED fingerprint 목록을 첨부하고 임무 4종(소멸 확인·수정 인접 회귀·ACCEPTED/OOS 비례성·머지 준비도 verdict)을 지시한다. "신규 영역 발굴은 임무가 아니다. 단, 발견한 blocking은 보고한다"를 명시한다. 확인 리뷰에서 blocking이 나오면 적대 모드로 복귀한다. 종료 후 기록: 확인 라운드가 잡은 것 / 도장만 찍었는지 / 종료가 깨끗해졌는지.

- **판정 기준**: 확인 라운드가 (a) 실제 회귀·불완전 수정을 잡는가(content-ops R6 재현), (b) 승인 남발하지 않는가, (c) 종료 시 확인 부채 0인가.

---

## 트랙 B — 기결정 가드 focus-text 자동 주입 (2순위)

**문제**: 재지목 400회/92파일. 현행 방어(재논의 금지 블록을 리뷰 대상 문서 diff 안에 두기)는 실증적으로 불완전 — 이 repo 자신의 R2 관찰("G1·G2 블록이 diff에 있어도 억제하지 않는다").

**제안**: review-loop §2b 실행 시 대상 문서의 **재논의 금지 블록 + 닫힌 ledger 항목 요약을 focus text로 조립해 전달**한다(A-3에서 확인한 `adversarial-review [focus text]` 경로). 문서 내 가드는 유지(이중 방어).

**harden-spec 질문**: focus에 넣을 내용의 구성(블록 전문 vs D번호+한 줄 요약 vs fingerprint 목록)과 길이 상한 — 토큰 비용/억제 효과 균형은 마이크로테스트로.

**검증**: 재지목이 잦았던 실제 spec(예: ops-hub audit-log-coverage)의 가드 블록으로 주입 유/무 대조 리뷰를 돌려 재지목 건수 비교.

---

## 트랙 C — 부수 개선 묶음 (우선순위순)

| # | 항목 | 대상 | 근거 (요약) |
|---|---|---|---|
| C-1 | **런북 자체 보완의 스킬 흡수** — phase별 리뷰 입도 표, 증분 base 안전조건(마지막 `--base main` 통합 필수), SDD 연계(approved 커밋 뒤 codex·task마다 끼우지 않음), codex 실행 팁(run_in_background·sed 추출) | review-loop | `../ops-hub/docs/workflow/review-loop-runbook.md:38~78` — 범용 교훈이 프로젝트에 갇혀 있고 런북은 06-24 동결. SDD 선행 트랙의 R1 종결 실증 |
| C-2 | **severity 재평가 지침** — "LLM이 해석하는 문서의 문자적 논리 갭은 실행 영향으로 severity 재평가(문자적 갭 ≠ 즉시 high)"를 §2c에 추가 | review-loop | 이 repo `docs/specs/2026-07-25-ui-mockup-skill-design.md` "I1 실전 검증" 교훈 — 본문 미반영 |
| C-3 | **impl 단계 ledger 위치 명시** — "phase 산출물 문서"가 impl에선 모호. 실무 수렴대로 "impl ledger = plan 엔트리포인트 말미" 규약화 | review-loop | 모범: `../ops-hub/docs/plans/2026-08-05-report-weekly-meeting-view.md`(plan/impl ledger 병기) |
| C-4 | **핸드오프 4섹션 표준 승격** + 덮어쓰기 전 기존 내용 보존 확인 1줄. `--resume`은 안전판으로만 유지 | review-loop | resume 실사용 0건, 공유 핸드오프 덮어쓰기 실사고(`../ops-hub/docs/plans/2026-07-24-workflows-menu-ux.md:177` F3) |
| C-5 | **plan 게이트 강화** — ① Execution contract에 "task 완료 시 status·outcome 기입은 커밋 전 필수" ② review-loop plan 사전 게이트에 "repo 분할 규약 준수(Execution contract·Shared Contracts 존재) + ledger에 fingerprint 컬럼 존재" 확인 | writing-plans-split·review-loop | outcome 채움 17/67(25%, 08-05 이후 4트랙은 전량 채움=실현 가능), superpowers 템플릿 유입 12건(08-02까지), fingerprint 없는 ledger 3건 |
| C-6 | **dev-cycle 확장** — ① 9단계(통합·후속 검증: PR·머지·배포·실측, repo 규약 느슨 참조) ② 착수 브리프 생성 안내(읽기 전용 출력) ③ 경량 경로(소형 트랙 fast lane: 재논의 금지 D블록 포함 spec-lite + impl review-loop 1~2R) 분기 기준 | dev-cycle | dev-cycle 실채택 얕음(단계 번호 인용만), "잔여=육안" 반복 누적, 2026-08-01~03 소형 트랙 파이프라인 통째 우회 배치 → `report-management-hub`는 사후 수정 plan 유발 |
| C-7 | **ui-mockup 소폭 2건** — ① 생략 기록을 "한 줄"에서 "D번호 결정+근거"로(실무가 이미 그렇게 함) ② 슬러그 기본값에서 날짜 접두와 함께 `-design` 접미도 제거 | ui-mockup | 생략 D승격 실례 2건, 디렉터리 명명 5:4 분열(`-design` 접미 유무) |
| C-8 | **훅 재넛지** — 40% 1회 넛지 이후 상위 구간(예: +15%p마다) 재넛지 | Stop 훅 | 넛지 무시 후 장기 주행 시 재경고 없음 |
| C-9 | **doctor 점검(신설 또는 setup 확장)** — 플러그인 버전·codex 인증·`CLAUDE_CTX_LIMIT` 일괄 진단 | setup/신규 | 3머신 버전 불일치 상시 위험(그램 최초 install 백로그 잔존, 0.7.0 미만 조기 넛지 버그) |
| **C-10**<br>(순번 8) | **dev-cycle 판별 ③ 구조 재검토** — ① **경량/정식 경로 판정 상태**와 **단계별 생략 기록**의 계층을 문면에서 명시적으로 분리(현재는 세션 한정 승인 규칙과 생략 기록 존중 규칙이 같은 평면에 있어 경계 문장으로 봉합돼 있다) ② ③의 조건 열거를 상태 우선순위 규칙으로 재구성할지 판단 | dev-cycle | **C-6 impl 루프 실측**: 계열 A(경량 승인 상태) 5회차·계열 B(③ 조건 조합 미포괄) 3회차. 국소 수정으로 매번 닫았으나 상태 차원이 늘면 재발한다 — ledger `docs/specs/2026-08-08-dev-cycle-extension.md` fp-I6·I8·I10·I12·I13(계열 A) / fp-I1·I9·I11(계열 B). fp-I13-r ACCEPTED의 **보완 단계 귀착지** |

**ops-hub 측 후속(이 repo 범위 밖, 참고만):** 런북 갱신(06-24 동결·`:84` 구버전 훅 서술 잔존), `OPS_HUB_CTX_*` 드리프트 5파일 포인터 처리, 새 워크트리 `.remember` 링크 세팅(orca-worktree-ops), 그램 `/plugin install`.

---

## 기결정 대조 (이 repo 기존 결정과의 정합 — 충돌 없음 확인)

- **G1·G2**(ui-mockup spec — 기계 검증 장치 과설계 금지): 트랙 A·B는 프롬프트/절차 수준 변경이라 저촉 없음. C-5의 게이트 체크도 grep 수준 경량 확인으로 설계할 것(파서·스위트 금지).
- **ESCALATE batch 유지**(review-loop 0.2.0 회고 기결정): 건드리지 않는다. 실측(트랙당 0~1건)도 "무해라 유지" 판단을 뒤집지 않는다.
- **description은 트리거만**(writing-skills 원칙): 모든 스킬 개정에서 워크플로 요약을 description에 넣지 않는다.
- **no-AI-trace**: 스킬이 만드는 커밋·산출물 규약은 현행 유지(이 repo 문서에서 codex를 다루는 것은 도구 자체가 주제이므로 무관).

## 완료 조건

**순번별(각 트랙 공통):** 해당 스킬 개정 + writing-skills 마이크로테스트 통과 + `plugin.json` minor 범프 + README 3종 동기 갱신 + 종료 보고에 각 머신 `/plugin update` 안내.

**순번 1(트랙 A) 추가 기준:** review-loop SKILL.md에 적대/확인 2모드·전환 신호·임무 4종·탈출구·예산 구조가 반영되고, 베이스라인 대비 마이크로테스트로 (a) 확인 라운드가 도장 찍기가 아님 (b) 확인 부채 0 종료 (c) 보안 트랙 예외 동작을 확인.

**프로그램 전체:** §실행 순서 1~8이 모두 릴리스되면 종결. 각 트랙 종결 핸드오프가 다음 순번을 지목하고, 마지막 트랙 종료 보고에 ops-hub 실측 대조 항목(확인 부채 발생률·재지목 건수·outcome 채움률)을 후속 관찰 지표로 남긴다.
