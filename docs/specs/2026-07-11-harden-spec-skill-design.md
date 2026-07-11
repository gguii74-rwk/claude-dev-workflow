# harden-spec 스킬 설계 (spec-hardening pre-mortem)

- 상태: 설계 승인 대기 (brainstorming 산출물)
- 대상: `dev-workflow` 플러그인에 추가할 **신규** 스킬 `harden-spec`
- 날짜: 2026-07-11

## 1. 배경 / 문제

현재 개발 파이프라인은 `brainstorming → spec 작성 → review-loop → plan(writing-plans-split) → 구현`이다. 이 흐름에서 반복되는 실질 고통은 **초반에 생각 못 한 점이 산출물이 다 나온 뒤에야 발각돼, 기능을 설계부터 구현까지 통째로 재작업(rework)하는 것**이다. 즉 spec 단계의 구멍이 늦게 드러나 비용이 크다.

기존 도구는 이 구멍을 충분히 막지 못한다:
- `brainstorming`은 **협업 설계**다 — 같이 만드는 우호적 대화라, "이 설계가 왜 틀렸을 수 있는가"를 적대적으로 파고들지 않는다.
- `review-loop`(codex)는 **산출물의 결함**을 자동 검출하지만, 사용자의 제품 지식·기결정을 모르고 코드/문서 diff 수준에서 본다. "사람만 알 수 있는 누락된 요구·숨은 가정·교차 파급"은 잘 못 짚는다.
- 기존 `grill-me`는 범용 소크라테스식 압박이라 프로젝트 불변식을 모르고, 산출물이 "말로 합의"뿐이라 spec으로 이어지지 않는다.

## 2. 목표 / 비목표

**목표:** brainstorming으로 뽑은 spec 초안을, plan/review-loop로 넘어가기 **전에** 적대적으로 압박해 *rework를 유발할 갭*을 파내고, 그 결과를 **spec 파일에 반영해 굳힌다.**

**비목표 (YAGNI):**
- codex 적대검증을 대체하지 않는다 (그건 review-loop). harden-spec은 **사람 주도 대화**다.
- 코드/구현을 보지 않는다. 대상은 **spec 문서**다.
- 다음 단계로 **자동 전환하지 않는다** (단계 경계 = 새 세션 규약 준수).
- 기결정(ADR·spec `D<n>`·명시 규칙·사용자 결정)을 **재론하지 않는다**.
- `brainstorming`을 대체하지 않는다. brainstorming 뒤 spec이 있을 때 그것을 굳히는 후속 도구다.

## 3. 파이프라인 내 위치 & 기존 도구와의 경계

```
brainstorming → spec 초안 → [harden-spec] → review-loop(spec) → plan → 구현
   (협업 설계)              (사람 적대 압박)   (codex 산출물 검증)
```

- **brainstorming ↔ harden-spec:** 만든다 vs 구멍 뚫는다. 자세가 반대(우호 vs 적대).
- **harden-spec ↔ review-loop:** *사람이 놓친 것*(제품 지식·요구·가정) vs *산출물이 틀린 것*(정합성·결함). 앞(사람)에서 굳히고 뒤(codex)에서 검증하는 상보 관계. harden-spec이 먼저 도는 이유: codex가 검증하기 전에 사람만 채울 수 있는 갭을 먼저 메워, review-loop가 진짜 결함에 집중하게 한다.

## 4. 동작 설계

### 입력
- 대상 spec을 인자로 받는다(경로 또는 feature 슬러그).
- 생략 시 `docs/specs/`의 최신 파일 또는 현재 브랜치에 대응하는 spec을 찾아 **"이 spec을 압박합니다: `<path>` — 맞나요?"로 확인 후** 시작한다.
- `docs/specs/`가 없는 repo면 사용자에게 대상 문서를 묻는다(범용 폴백).

### 흐름 (5단계)

**1) 로드 (context 우선).** 대상 spec 본문 + 실행 repo의 `CLAUDE.md`·`AGENTS.md`·`docs/adr/`·`docs/specs/`를 읽어 세 바구니로 분류한다:
- **불변식/함정** — 이 repo가 반복적으로 밟는 규칙(예: 권한 fail-closed, 트랜잭션·CAS, 마이그레이션 가역성). CLAUDE.md에서 추출.
- **기결정** — ADR·spec `D<n>`·명시 규칙·이미 내려진 사용자 결정. **압박 대상에서 제외**.
- **spec의 주장** — 이 spec이 실제로 무엇을 하겠다고 말하는가(범위·정책·데이터·상태전이·AC).

**2) 갭 스윕.** §5 커버리지 축을 훑어, spec이 **침묵·모호·모순·미검증**인 지점을 후보 갭으로 수집한다. **rework 위험순으로 정렬**한다: 비가역(마이그레이션·데이터) → 교차모듈 파급 → 불변식 접촉 → 그 외. (사실로 확인 가능한 것은 코드·문서를 직접 조회해 갭 후보에서 제거한다.)

**3) 압박.** 위험 높은 갭부터 **한 번에 한 질문**, 매 질문에 **근거 있는 추천답**을 붙여 묻는다.
- **열린 갭/결정만** 묻는다.
- **기결정은 건너뛴다**(가드). 단, 신규 갭이 기결정과 *충돌*하면 재론이 아니라 "이 기결정이 이 spec과 실제로 양립하는가"만 확인한다.
- 여러 질문을 한꺼번에 던지지 않는다(혼란 유발).

**4) 하드닝 (제안 후 적용).** 갭이 해소될 때마다 **spec에 넣을 구체 문구(diff)를 제안**하고, 사용자가 승인하면 **파일에 반영**한다. 변경 단위를 작게 유지해 되돌리기 쉽게 한다. 해소된 결정·엣지케이스·실패 모드·범위 경계를 spec의 해당 섹션(결정사항·AC·비목표 등)에 실제로 기록한다.

**5) 종료.** §8 참조.

## 5. 커버리지 축 (project-aware)

갭 스윕이 훑는 갭 클래스. **이 목록을 실행 repo의 CLAUDE.md에서 실제로 추출**하고, 없거나 얕으면 범용 세트로 폴백한다.

| 축 | 묻는 것 |
|---|---|
| 완결성 | 명시 안 된 요구·엣지케이스·빈 상태·에러/실패 모드 |
| 불변식 준수 | repo 규칙 위반 소지(예: fail-closed, CAS·낙관락, timestamptz, enum 동기화) |
| 교차 영향 | 다른 모듈·기존 데이터·권한·마이그레이션에 미치는 파급 |
| 동시성·상태전이 | 트랜잭션 경계, 상태 전이 표의 누락 전이, 경쟁 조건 |
| 비가역·롤백 | 마이그레이션 가역성, cutover, 롤백 계획 |
| 검증가능성 | 이 spec이 맞는지 어떻게 테스트/관측하나 (AC가 검증 가능한가) |
| 범위 경계 | 무엇을 **안 하는지**가 명시됐나 (scope creep 방지) |
| 숨은 가정 | 명시 안 된 가정이 뒤집히면 설계가 무너지나 |

## 6. 기결정 가드 (review-loop 연동)

harden-spec은 압박 중 확정된 결정과 재론 금지 항목을 spec 안에 **"재논의 금지(기결정)" 블록**으로 기록한다. 이는 `review-loop`가 이미 쓰는 규약(가드는 *리뷰 대상 문서 안*에 있어야 codex가 본다)과 동일하다.

- harden-spec이 심은 기결정 블록 + 하드닝으로 확정된 결정 = review-loop가 spec을 검증할 때 **재지목을 원천 차단**하는 입력이 된다.
- 즉 harden-spec은 review-loop의 "기결정 가드"를 **선제적으로 채워주는** 역할도 한다(두 도구의 맞물림).

## 7. 하드닝 방식

- **제안 후 적용**: 갭 해소마다 spec에 넣을 문구를 diff로 제안 → 승인 시 반영. 자동 일괄 재작성(검토 부담·사고 위험)도, 갭 목록만 남기고 손 안 대기(수작업)도 아님.
- 사용자 통제권을 유지하면서 spec이 실제로 강해지는 중간 지점.

## 8. 종료 & 핸드오프

- **변경 요약**: 이번 세션이 spec에 무엇을 추가/수정했는지.
- **잔여 리스크(DEFERRED)**: 이번에 못 닫은 갭을 명시적으로 남긴다(무시·은폐 금지). review-loop의 disposition 어휘와 정합.
- **커밋**: spec 파일만 **명시적으로 stage 후 커밋**한다. `git add -A` 금지, `.git/index.lock` 존재 시 대기(다른 세션 git 사용 중). 커밋 메시지에 AI 서명 금지(글로벌 규칙).
- **정지**: 다음 단계(review-loop → plan)는 **자동 전환하지 않고** 권고만 한다. 단계 경계는 *새 세션 + `/clear`* 규약(핸드오프 후).

## 9. 인자

- (선택) 대상 spec 경로/슬러그. 생략 시 자동 탐색 + 확인. **그 외 인자는 두지 않는다**(harden-spec은 diff가 아니라 파일 하나를 읽으므로 `--base` 같은 git 기준이 불필요 — YAGNI).

프리모템 프레이밍("이 기능을 다 만들었는데 재설계하게 됐다 — 무엇을 놓쳤었나?")은 **옵션이 아니라 갭 스윕의 기본 태도**로 내장한다(사용자 고통을 겨냥한 핵심이므로 토글로 빼지 않는다).

## 10. 트리거 / frontmatter

- `name: harden-spec`
- `description`: **"언제 쓰는지"만 서술한다(워크플로 요약 금지 — writing-skills 원칙).** description이 절차를 요약하면 에이전트가 본문을 안 읽고 description만 따르는 함정이 있다. "Use when..." 형태 + 증상·트리거 키워드로 작성한다.
  - 예: *"Use when a spec/design doc is drafted and about to move to planning or implementation, and you want to catch gaps, unstated assumptions, missed edge cases, cross-module ripple, or project-invariant violations before committing to a plan. 트리거: spec 굳혀줘 / harden this spec / 내가 놓친 것 찾아줘 / spec 압박 / pre-mortem / 이 설계 구멍 찾아줘."*
- **grill-me는 이번 변경으로 삭제**되므로 트리거 충돌 우려는 없다. 다만 이름·트리거는 "grill" 대신 spec/harden/pre-mortem 계열로 유지한다.

## 11. review-loop와의 시너지 (요약)

1. harden-spec이 spec을 굳히고 **기결정 블록**을 심는다.
2. review-loop(spec)가 그 spec을 codex로 검증하되, harden-spec이 심은 가드로 재지목이 줄어든다.
3. harden-spec의 DEFERRED 잔여 리스크는 review-loop ledger로 이어져 판정(FIXED/ACCEPTED/DEFERRED_TO_IMPL…)으로 닫힌다.

## 12. 성공 기준 (acceptance criteria)

- ops-hub의 실제 spec 하나에 돌렸을 때, **CLAUDE.md의 불변식(fail-closed·CAS·timestamptz·enum·마이그레이션 가역성 등)에 근거한 질문**이 최소 1건 이상 나온다(범용 질문만 나오지 않는다).
- ADR·`D<n>` 등 기결정을 **재론하지 않는다**(가드 동작).
- 세션 종료 시 대상 spec 파일에 **실제 diff가 반영**되고, 잔여 리스크가 DEFERRED로 명시된다.
- 스킬이 **다음 단계로 자동 전환하지 않고** 새 세션 권고로 멈춘다.
- 다른 repo(예: `docs/specs` 없는 곳)에서도 범용 폴백으로 동작한다.

## 13. 구현 노트

- 파일: `dev-workflow/skills/harden-spec/SKILL.md` (기존 스킬 자동 발견 구조).
- **`grill-me` 삭제**: 기존 `grill-me`(외부 출처의 범용 압박면접 프롬프트)는 harden-spec이 그 역할을 대체하므로 **디렉터리째 삭제**한다(사용자 지시). grill-me를 참조하는 곳도 함께 정리:
  - `dev-workflow/skills/grill-me/` 삭제
  - `README.md` — 도구 표·목차·§3 사용법·개발 구조에서 grill-me → harden-spec
  - `dev-workflow/.claude-plugin/plugin.json` — description에서 grill-me 제거·harden-spec 추가, `version` 0.3.0 → **0.4.0**
  - `.claude-plugin/marketplace.json` — plugin description에서 grill-me → harden-spec
- 스타일: review-loop처럼 한국어·표·"Announce:" 도입부·정밀 서술.
- **입력 범위(확장 반영)**: harden-spec은 작성된 spec 파일을 1차 대상으로 하되, **파일 없는 느슨한 계획/아이디어도 압박**한다(grill-me 대체 — 사용자 요청으로 포함, §입력 느슨한 계획 모드). 압박할 계획 자체가 없는 백지 상태는 여전히 brainstorming의 몫이다.

## 14. 미해결 질문

없음. (버전 번호·README 문구는 구현 시 결정.)
