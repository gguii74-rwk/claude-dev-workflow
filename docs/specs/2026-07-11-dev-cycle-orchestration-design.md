# dev-cycle — 개발 파이프라인 지도 스킬 + opt-in 채택 설계

- 상태: 설계 승인 대기 (brainstorming 산출물)
- 대상: `dev-workflow` 플러그인에 추가할 **신규 스킬 2종** — `dev-cycle`(지도), `setup`(opt-in 채택)
- 날짜: 2026-07-11

## 1. 배경 / 문제

플러그인이 여러 프로젝트·두 노트북·**공개 사용자**에게 퍼질 때, 새 프로젝트의 CLAUDE.md에는 이 워크플로 사용 지침이 없다. 그런데:

- **개별 스킬 "발견"은 이미 해결돼 있다.** user 스코프 설치 머신에서는 `harden-spec`·`review-loop`·`writing-plans-split`이 모든 프로젝트에서 Claude에게 자동으로 보인다(각 `description`). (머신당 1회 `/plugin install`만 필요 — `~/.claude`는 노트북 간 비동기.)
- **진짜 공백 = 파이프라인 순서(기본 워크플로)라는 규약이 어디에도 없다.** 개별 스킬은 "언제"만 알지 "이 순서로 엮어라"는 모른다.
- **제약: 한 세션 오토파일럿 불가.** 단계 경계(spec→plan, plan→impl)마다 새 세션 + `/clear`가 규약이고(review-loop), Claude는 자가 `/clear`를 못 한다. 따라서 만들 것은 "전 과정 자동 실행기"가 아니라 **"현재 단계 + 전체 지도 + 다음 단계 넛지"를 주는 안내**다.
- **SSOT/드리프트:** 전체 가이드를 각 프로젝트 CLAUDE.md에 복사하면 파이프라인이 바뀔 때(예: harden-spec 추가) N개가 낡는다. 규약은 한 곳(플러그인)에만 두고 프로젝트는 가리키기만 해야 한다.

## 2. 목표 / 비목표

**목표:** 권장 개발 파이프라인을 **플러그인 스킬 1곳(SSOT)** 에 두어 설치된 모든 프로젝트에서 자동 발견되게 하고, 원하는 repo만 **opt-in으로 한 줄 포인터**를 CLAUDE.md에 심는다.

**비포함 / 비목표:**
- **설치 시 CLAUDE.md 자동 편집 없음** — 공개 플러그인이 남의 프로젝트 파일을 말없이 고치지 않는다(에티켓 + 그럴 install 훅도 부적절).
- **단일 세션 전 과정 자동 실행 없음** — 단계 경계 `/clear` 규약 때문에 불가.
- **파이프라인 강제 없음** — "권장 사이클"로 프레이밍. 공개 사용자는 opt-in.
- **전체 가이드를 CLAUDE.md에 복사하지 않음** — SSOT는 `dev-cycle` 스킬.
- **superpowers 하드 의존 없음** — 느슨한 참조(§5).

## 3. 구성요소 A — `dev-cycle` 스킬 (파이프라인 SSOT)

### 트리거 / description
- "언제 쓰는지"만(워크플로 요약 금지 — writing-skills 원칙). "Use when starting a new feature / multi-step change and you want the recommended end-to-end dev pipeline and to know which step you're on". 트리거 예: "새 기능 시작", "어디서부터", "개발 사이클", "how do I run a feature".

### 본문
1. **8단계 지도표** (각 단계에 소속 플러그인 표기):

| # | 단계 | 스킬 | 소속 |
|---|---|---|---|
| 1–2 | 협업 설계 → spec 초안 작성 | brainstorming (종착점을 writing-plans 대신 아래 3–4로) | superpowers |
| 3 | spec 압박·굳히기 (사람 적대) | harden-spec | dev-workflow |
| 4 | spec 적대검증 (codex) | review-loop `--phase spec` | dev-workflow |
| 5 | 분할 구현계획 | writing-plans-split | dev-workflow |
| 6 | plan 적대검증 | review-loop `--phase plan` | dev-workflow |
| 7 | 구현 | subagent-driven-development | superpowers |
| 8 | impl 적대검증 | review-loop `--phase impl` | dev-workflow |

2. **단계경계 규약** — spec→plan, plan→impl 경계는 **핸드오프 작성 후 새 세션 + `/clear`**. 한 세션에서 전 과정을 밀어붙이지 않는다. review-loop의 컨텍스트 40% 핸드오프 넛지와 정합.
3. **"지금 어느 단계인가" 판별(휴리스틱)** — 현 작업의 `docs/specs/<feature>` 유무·`## 적대검증 ledger` 상태·`docs/plans/<feature>` 유무·git 브랜치로 추론:
   - spec 없음 → 1–2(brainstorming).
   - spec 있고 아직 안 굳음 → 3(harden-spec) → 4.
   - spec 굳음·plan 없음 → 5(writing-plans-split) → 6.
   - plan 있음·구현 미완 → 7 → 8.
   - **현재 단계만 수행**하고 다음 단계는 핸드오프 + 넛지로 넘긴다.
4. **superpowers 느슨한 참조**(§5): 1·7단계가 없으면 "superpowers 권장, 없으면 자체 설계/구현으로 대체 가능" 안내.

## 4. 구성요소 B — `setup` 스킬 (opt-in 채택)

### 트리거 / description
- **명시 요청 시에만** 트리거(오작동 방지): "Use ONLY when the user explicitly asks to adopt / set up / pin the dev-workflow pipeline in the current repo." 사용자 주도 액션.

### 동작
- 프로젝트 CLAUDE.md에 **마커 구분 블록**을 멱등 삽입/갱신(있으면 교체, 없으면 append):

  ```
  <!-- dev-workflow:pipeline -->
  이 repo는 dev-workflow 파이프라인을 따른다 — 기능 개발은 `/dev-workflow:dev-cycle`(또는 "개발 사이클")로 전체 순서·현재 단계를 확인한다.
  플러그인 미설치자: `/plugin marketplace add gguii74-rwk/claude-dev-workflow` 후 `/plugin install dev-workflow@claude-dev-workflow`.
  <!-- /dev-workflow:pipeline -->
  ```

- **전체 가이드 복사 안 함** — SSOT는 `dev-cycle` 스킬. 여기엔 포인터만.
- CLAUDE.md가 없으면 생성 여부를 사용자에게 확인. 기존 내용은 surgical하게 블록만 추가(다른 부분 건드리지 않음).
- 마커 블록으로 **협업자·비플러그인 사용자에게도 규약이 보이고**, 설치 방법까지 안내된다.

## 5. 공개 배포 고려

- 파이프라인은 **"이 툴킷의 권장 사이클"** 로 프레이밍(강제 아님). 공개 사용자는 dev-cycle을 읽고 취사선택.
- **superpowers = 느슨한 참조.** plugin.json에 하드 의존 선언하지 않는다(무거운 플러그인 강제 회피). dev-cycle이 1·7단계에 "superpowers 플러그인 권장 — 미설치 시 자체 브레인스토밍/구현으로 대체" 명시. dev-workflow 자체 스킬(harden-spec·review-loop·writing-plans-split)만으로도 3–6·8단계는 완결.
- README에 "권장 파이프라인" 섹션과 dev-cycle/setup 사용법 추가.

## 6. 등록 / 버전

- `dev-workflow/skills/dev-cycle/SKILL.md`, `dev-workflow/skills/setup/SKILL.md` 신설.
- README(도구 표·목차·사용법·개발 구조), `plugin.json`(description·version), `marketplace.json`(description)에 2종 추가.
- **버전 0.4.0 → 0.5.0**(신규 스킬 = minor).

## 7. 성공 기준 (acceptance criteria)

- dev-workflow만 설치된 (superpowers 없는) 새 프로젝트에서 "새 기능 시작"류 발화에 **dev-cycle이 트리거**되어 8단계 지도와 현재 단계를 제시한다.
- dev-cycle이 단계경계 `/clear`·새 세션 규약과 "현재 단계만 수행"을 명시한다(한 세션 전 과정 강행 안 함).
- `setup`은 **명시 요청에만** 동작하고, CLAUDE.md에 마커 블록(포인터, 전체 가이드 아님)을 멱등 삽입하며 다른 내용을 건드리지 않는다.
- 파이프라인이 바뀌어도 갱신 지점은 **dev-cycle 스킬 1곳**(프로젝트 CLAUDE.md들 아님).
- superpowers 미설치 환경에서도 dev-cycle 안내가 깨지지 않는다(느슨한 참조).

## 8. 구현 노트

- 두 스킬 모두 review-loop 스타일(한국어·표·"Announce:"). description은 트리거 중심(writing-skills 원칙).
- `setup` description은 **좁게**(명시 요청 한정) — 광범위 트리거로 CLAUDE.md를 함부로 고치지 않게.
- dev-cycle은 **읽기 전용 안내**(파일 수정 없음). CLAUDE.md 수정은 setup만.

## 9. 미해결 질문

없음. (마커 블록 문구·README 배치는 구현 시 확정.)
