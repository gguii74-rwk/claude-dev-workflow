# claude-dev-workflow

[English](README.md) | **한국어** | [日本語](README.ja.md)

검증된 개발 워크플로 도구 모음을 단일 Claude Code 플러그인 **`dev-workflow`**로 묶어 배포하는 마켓플레이스. 한 번 설치하면 **모든 프로젝트**에서 쓸 수 있다.

| 도구 | 종류 | 호출 | 역할 |
|---|---|---|---|
| dev-cycle | skill | `/dev-workflow:dev-cycle` | 새 기능의 권장 파이프라인 지도(착수~통합 전 구간) + 현재 단계 안내 · 작은 변경의 경량/정식 경로 판정 (읽기 전용, 여기서 시작) |
| review-loop | skill | `/dev-workflow:review-loop` | spec/plan/impl 완료 후 커밋→codex 적대검증(기결정 가드 자동 주입으로 재지목 억제)→판정·자동수정 반복, 이어서 확인 라운드가 수정 소멸·머지 준비도를 판정 (판정 없이 남은 blocking — critical/high/medium — 0까지). plan 단계 루프는 시작 전에 형식 관문 4종을 통과시킨다 |
| writing-plans-split | skill | `/dev-workflow:writing-plans-split` | 다단계 구현 계획을 얇은 엔트리포인트 + 태스크별 파일로 분할 작성 — 완료 기록을 커밋 단계로 계약화 |
| harden-spec | skill | `/dev-workflow:harden-spec` | spec 초안을 plan/구현 전에 적대적으로 압박해 놓친 갭·가정·불변식 위반을 파내고 spec을 굳힌다 (project-aware) |
| ui-mockup | skill | `/dev-workflow:ui-mockup` | (옵션, 3.5단계) 굳은 spec이 화면을 만들거나 구성을 바꿀 때: 비실행 HTML 목업을 발산해 사용자가 고르고, UI 결정을 spec에 기결정으로 기록 |
| setup | skill | `/dev-workflow:setup` | (명시 요청 시) 이 repo의 CLAUDE.md에 파이프라인 규약 포인터를 멱등 삽입 |
| doctor | skill | `/dev-workflow:doctor` | 환경 4항목(설치본 버전 · 마켓플레이스 최신 · codex · 컨텍스트 윈도)을 읽기 전용으로 일괄 진단하고, 조치는 기존 경로로 위임 |
| orchestrate | skill | `/dev-workflow:orchestrate` | (1.2.0 이상) **메인 세션**이 트랙을 오르카 터미널로 운영하는 공통 절차 — 기동 · 감시 · 질문 라우팅 · 단계 종료 검증·핸드오프 · 후계 (프로젝트 규약 우선) |
| mr-review | skill | `/dev-workflow:mr-review <프로젝트> <iid>` | (1.3.0 이상) **남의 MR**을 읽기 전용으로 리뷰 — 작성 규칙 기계 검사 · 리뷰 head 고정 · 두 모델(Claude 서브에이전트 + Codex task) 독립 검토 · 팀 정책 판정 4종 형식의 초안 리포트. 프로젝트 어댑터 문서 필요 |
| 컨텍스트 임계 넛지 | Stop hook | (자동) | 컨텍스트 사용량이 임계(기본 40%)를 넘으면 핸드오프 작성 + `/clear` 안내를 넛지하고, 이후 **15%p 구간마다 재넛지**(40 → 55 → 70 → 85%, 상한 없음) |

## 목차

- [요구사항](#요구사항)
- [설치](#설치)
- [사용법](#사용법)
  - [dev-cycle](#1-dev-cycle--파이프라인-지도-여기서-시작)
  - [review-loop](#2-review-loop--적대검증-반복-루프)
  - [writing-plans-split](#3-writing-plans-split--분할-구현-계획)
  - [harden-spec](#4-harden-spec--spec-굳히기)
  - [ui-mockup](#5-ui-mockup--ui-목업-선택)
  - [setup](#6-setup--repo에-파이프라인-채택)
  - [doctor](#7-doctor--환경-진단)
  - [orchestrate](#8-orchestrate--메인-세션의-트랙-운영)
  - [컨텍스트 임계 핸드오프 훅](#9-컨텍스트-임계-핸드오프-훅-자동)
  - [mr-review](#10-mr-review--남의-mr-두-모델-리뷰-초안)
- [특정 repo에서 clone 시 자동 적용](#특정-repo에서-clone-시-자동-적용)
- [트러블슈팅](#트러블슈팅)
- [주의](#주의)
- [개발 / 릴리스](#개발--릴리스)

## 요구사항

- **Claude Code v2.1.140 이상** 권장 (플러그인 의존성 기능 포함).
- **codex 플러그인** — `review-loop`가 codex의 `adversarial-review`를 호출하므로 `codex@openai-codex` 플러그인을 의존한다. `plugin.json`의 `dependencies`로 선언돼 **설치 시 자동으로 함께 설치**된다(단 `openai-codex` 마켓플레이스가 등록돼 있어야 함 — 아래 설치 참고).
- **codex CLI 인증은 별도** — 플러그인 의존은 codex *플러그인*만 끌어온다. codex CLI 자체 설치·로그인(`/codex:setup`)은 직접 해야 `review-loop`가 실제로 동작한다. `writing-plans-split`·컨텍스트 훅은 이 인증 없이 바로 동작한다.
- **`glab` CLI(인증 완료)** — `mr-review`가 GitLab REST를 `glab api`로 읽는다(GET만). 다른 스킬은 `glab` 없이 동작한다.

## 설치

최초 1회만. 아래 줄을 **순서대로 각각** 실행한다(둘 중 하나가 아니라 전부).

```
# (codex를 한 번도 쓴 적 없는 사람만) codex 마켓플레이스 등록:
/plugin marketplace add openai/codex-plugin-cc

# 본체:
/plugin marketplace add gguii74-rwk/claude-dev-workflow
/plugin install dev-workflow@claude-dev-workflow      # codex 플러그인도 의존성으로 자동 설치
```

- `marketplace add`는 "카탈로그 등록"(어디서 받을지 알려주기)이고, `install`이 "실제 설치"다.
- `dev-workflow@claude-dev-workflow`는 `<플러그인>@<마켓플레이스>` 형식 — 앞이 플러그인, 뒤가 마켓플레이스다(이름이 비슷하지만 다른 것).
- user 스코프(기본)로 설치하면 모든 프로젝트에서 활성화된다. 한 번 설치하면 이후 세션·다른 프로젝트에서 다시 칠 필요 없다.

**설치 확인:**

```
/plugin                                   # Manage 탭에서 dev-workflow / codex 확인
# 또는 CLI:
claude plugin list                        # dev-workflow@claude-dev-workflow, codex@openai-codex 가 보이면 OK
```

## 사용법

### 1. `dev-cycle` — 파이프라인 지도 (여기서 시작)

새 기능·큰 변경을 어디서부터 어떤 순서로 진행할지 모를 때 호출한다. 이 툴킷의 **권장 개발 파이프라인**과 **지금 어느 단계인지**를 알려주는 **읽기 전용 지도**다(파일 미변경).

```
/dev-workflow:dev-cycle
```

권장 순서: **brainstorming → 스펙 → harden-spec → ui-mockup(옵션 — 화면이 바뀔 때만) → review-loop(spec) → writing-plans-split → review-loop(plan) → subagent-driven-development → review-loop(impl) → 통합·후속 검증**. 단계 경계(spec→plan, plan→impl)는 새 세션 + `/clear`가 규약이라, dev-cycle은 **현재 단계만 안내하고 다음은 넛지**한다(한 세션 오토파일럿 아님). 1·7·9단계(brainstorming·subagent-driven-development·finishing-a-development-branch)는 `superpowers` 플러그인 권장 — 없으면 자체 설계/구현/종료 절차로 대체 가능(하드 의존 아님).

0.11.0부터 지도가 **착수부터 종료까지 전 구간**을 덮는다. **9단계 — 통합·후속 검증(PR·머지·배포·실측)** 은 여기에 체크 항목을 복제하지 않고 **그 repo 규약을 가리키는 포인터**다(배포 대상이 없는 repo — 플러그인 등 — 에서는 릴리스 + 설치 갱신 안내가 그 자리를 대신한다). 착수 시에는 **5항목 브리프**(설계 결론·실측 근거·변경 대상 파일·검증 방법·9단계까지의 완료 조건)를 1회 **화면에만 출력**한다 — 파일은 만들지 않는다. 그리고 **경량 경로**가 "전부 아니면 무(無)" 이분법을 대체한다: 분기 축은 **접촉 표면·가역성이고 규모가 아니다** — 스키마·마이그레이션·권한·인증·보안 경계·외부 연동·데이터 손상/유실·비가역은 아무리 작아도 정식이다(12 task 문구 정리는 경량, 1 task 컬럼 삭제는 정식). 어떤 경량 트랙도 생략하지 못하는 **하한 3종 = spec 문서 · 3단계 harden-spec · 8단계 impl 적대검증**. 그 위의 단계는 **하나씩 개별로** 생략하고 **생략할 때마다 spec의 재논의 금지 블록에 근거를 남기며**, "지금 어느 단계인가" 판별은 그 기록을 읽은 뒤에 답한다 — 기록 없는 부재는 여전히 미완이다. 경량 승인은 **그 세션에서만 유효**하다 — `/clear` 이후에는 추정하지 않고 다시 묻고, 거절·모호한 답의 기본값은 정식이다. 확인 자체가 불가한 운용(질문을 전달할 수 없는 비대화 실행, 사용자의 부재·자율 진행 명시)에서는 0.17.0부터 **접촉 표면 스캔이 판정을 대신한다** — 명확히 무신호면 경량, 신호가 있거나 스캔이 불명확하면 정식(fail-closed)이고, 자동 판정으로 경량 진입할 때는 spec에 감사 기록 1줄을 남긴다(재개 시에는 기록과 무관하게 재스캔). 스캔이 대신하는 것은 그 경량/정식 확인뿐이다 — 가드 1의 fail-closed 확인이나 9단계 머지·배포 승인 등 다른 확인은 자동 결정되지 않으며, 물을 수 없으면 미완으로 남긴다.

### 2. `review-loop` — 적대검증 반복 루프

각 단계 완료 후 변경을 커밋하고 codex로 적대검증을 돌린다. 결함은 자동수정하거나 판정(disposition)으로 닫으면서, **"판정 없이 남은 blocking(critical/high/medium)이 0"**이 될 때까지 반복한다. 목표는 "지적사항 0"이 아니라 "미판정 0"이다.

루프는 **2모드**로 돈다. 초반은 **적대(발굴) 모드** — codex `adversarial-review`로 누락·결함을 캐낸다. 적대 리뷰어는 몇 번을 돌려도 finding 0을 내지 않으므로 그것만으로는 끝낼 수 없다. 그래서 전환 신호(score 정체 · 수정 큐 소진 · 적대 예산 소진)가 발화하면 **확인(중립) 모드**로 넘어간다 — 목적함수가 "머지 가능한가 판정"이라, 고쳤다고 한 항목이 정말 사라졌는지 확인하고 회귀·판정 비례성을 감사한 뒤 verdict를 낸다. "신규 blocking 없음, 수정 확인됨"이 정당한 출력이 되어 종료가 자연스러워진다.

0.9.0부터 **적대 라운드마다 기결정 가드를 리뷰 focus로 자동 주입**한다 — 재논의 금지 블록 전문 + 닫힌 ledger 항목 요약행을 매 라운드 직전 재조립해 리뷰 커맨드에 부착, 이미 닫힌 항목의 재지목을 원천에서 억제한다(실측: 가드가 diff 안에 있어도 동일 항목이 5라운드 연속 재지목됐다). 루프가 직접 내린 판정은 확인 라운드가 우선 감사해 오판정 재검토 경로를 보존한다.

0.10.0부터 **plan 단계 루프는 첫 라운드 전에 형식 관문 4종**을 통과시킨다 — 엔트리포인트의 현행 `writing-plans-split` 실행 계약 블록(존재만이 아니라 설치된 스킬의 canonical 블록과 대조한다. 낡은 블록은 이 관문이 지키려는 보호를 그대로 빠뜨린 채 통과할 수 있다), §Shared Contracts 섹션, 승계 ledger의 fingerprint 컬럼, 태스크 표의 `status`·`outcome` 컬럼. 저비용 수정(블록 교체·섹션·컬럼 추가)은 루프 시작 전에 해결하고, 구조 재작성(단일 파일 plan을 분할로 바꿔야 하는 경우)은 루프가 검증 밖에서 대수술하지 않고 사용자 판정으로 올린다. ①②④는 `CLAUDE.md`에 분할 plan 규약이 명시된 repo에서만 적용하며 단일 task 소형 변경은 예외다. ③(승계 ledger의 fingerprint 컬럼)은 분할 규약과 무관하게 승계 ledger가 있으면 적용된다.

0.18.0부터 라운드는 **분리 실행**된다: companion 호출을 `.remember/` 아래 래퍼 셸에 쓰고 node `spawn(detached)` 1줄로 띄우며, 출력·pid·`COMPANION_EXIT:` 마커가 파일에 남는다 — 루프는 백그라운드로 기다리고 마커로 완료를 판정하므로 Bash 도구 timeout이나 대기 프로세스 사망으로 라운드를 잃지 않는다. 라운드는 리뷰 헤더 + 스키마 JSON + 명령 실행 로그 ≥1건일 때만 유효하고, 샌드박스 전면 기동 실패는 "finding 0"이 아니라 실행 실패다. companion 경로는 라운드마다 플러그인 레지스트리에서 해소한다. FIXED 행의 해시 인용은 **수정 커밋 먼저, 다음 커밋에서 인용** 순서로 바뀌어 해시 전용 후속 커밋이 사라진다.

0.19.0부터 루프가 사용자에게 묻는 질문은 **읽는 사람이 finding·ledger 원문을 보지 않았다는 전제**로 쓴다 — 항목마다 쉬운 말 설명 + 「예:」 장면 1개, 첫 선택지 = 추천(「(추천)」 표시), 선택지 이름은 쉬운 행동 이름 뒤 괄호에 판정 코드(예: 「지금 고친다 (FIXED)」), batch 제시 끝에는 진행 질문 1개(모두 유지하고 계속 / 골라서 되돌린다 / 지금 멈추고 직접 본다)를 붙인다.

옵션은 전부 선택 — `/dev-workflow:review-loop`만 써도 동작한다.

| 옵션 | 기본값 | 역할 |
|---|---|---|
| `--phase spec\|plan\|impl` | 자동 추론 | 어느 단계를 검증할지. 생략하면 변경 내용으로 추론 |
| `--base <ref>` | `main` | 적대검증이 비교하는 기준 브랜치(이 diff를 본다). 루프 시작 시 SHA로 해소해 모든 라운드가 같은 스냅샷을 본다 |
| `--max <n>` | `5` | **적대(발굴) 라운드 상한.** 확인 라운드는 여기서 세지 않는다 |
| `--confirm-rounds <n>` | `2` | **확인 라운드 예산.** 루프 전체 누적이며 재진입 시 초기화되지 않는다 |
| `--auto-rounds <n>` | `3` | 초반 n회 **자동 모드** — 결함 자동수정 + 위험 없는 사용자 결정은 모아뒀다 한 번에 질문. `0`=매 라운드 즉시 질문, 보안 민감 작업은 `1`. 위임 모드(1.2.0 이상)는 batch 답을 트랙이 낸다 — 위험군만 사람에게 |
| `--security yes\|no` | — | (1.1.0 이상) **보안 크리티컬 트랙 판정을 미리 넘긴다** — 사용자(또는 오케스트레이터)가 이미 내린 판정을 넘길 때 쓴다. 있으면 루프가 묻지 않고 그 값으로 확정해 ledger 첫 줄·종료 요약에 출처 「호출자 지정」으로 기록한다. 생략하면 접촉면을 보고 필요 시 1회 묻는다. 세션 모드와 무관. `yes`면 `--auto-rounds 1` 병기 권고 |
| `--resume` | — | 중단된 루프를 `.remember/loop-*.md`의 저장 상태(ledger 포함)에서 재개 |

> **`--max`의 의미가 0.8.0에서 바뀌었다.** 0.7.x까지는 전체 반복 횟수의 절대 상한이었지만, 지금은 **적대 라운드만**의 상한이다. 총 라운드 수는 여전히 유계이되 더 크다 — 기본값 기준 **최대 10회**(적대 5 + 확인 2 + 확인이 blocking을 찾았을 때의 복귀 적대 1 + 재진입 확인 1 + 새 세션에서 도는 폴백② 확인 1). 실행 횟수를 예전처럼 묶고 싶으면 `--max`와 `--confirm-rounds`를 함께 낮춰라.

```
/dev-workflow:review-loop --phase impl                   # 구현 검증 (typecheck·lint·test·build 게이트 후)
/dev-workflow:review-loop --phase spec --auto-rounds 1   # 보안 민감 → 자동 모드 최소화
/dev-workflow:review-loop --phase impl --security yes --auto-rounds 1   # 보안 트랙 판정이 이미 났다 → 다시 묻지 않음
/dev-workflow:review-loop --base develop                 # main 대신 develop 기준 diff
/dev-workflow:review-loop --max 3 --confirm-rounds 1     # 라운드 수를 묶는다 (최대 7회)
/dev-workflow:review-loop --resume                       # 컨텍스트 한계로 끊겼던 루프 이어가기
```

**동작 흐름** — 적대 라운드마다: ① 미커밋 변경 커밋 → ② codex 적대검증 실행 → ③ finding을 fingerprint로 분류·판정(FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE/ESCALATE) → ④ FIXED는 (impl이면 TDD로) 수정 → ⑤ 게이트 재실행. 전환 신호가 발화하면 확인 모드로 넘어가 ⑥ 미확인 FIXED 큐 전체의 소멸 확인 → ⑦ 회귀·판정 감사 → ⑧ 머지 준비도 verdict. **미판정 blocking 0 + 미확인 FIXED 큐 빔 + 확인 verdict 통과**를 모두 충족해야 종료한다.

> 적대검증은 **커밋된 HEAD(브랜치 diff)** 를 본다. 미커밋 상태로 돌리면 직전 수정을 놓치므로, 루프는 항상 "수정→커밋→리뷰" 순서를 강제한다.
>
> **수정했다고 닫히지 않는다.** FIXED는 확인 라운드가 '소멸'을 명시 기록해야 확정된다 — 적대 라운드에서 그 항목이 다시 안 나온 건 발굴 결과일 뿐 확인이 아니다. 그래서 FIXED가 한 건이라도 있었던 트랙은 확인 라운드를 반드시 거친다(FIXED도 루프 직접 판정도 없는 클린 트랙만 확인 없이 즉시 종료).

### 3. `writing-plans-split` — 분할 구현 계획

spec이 준비된 상태에서 호출하면, 큰 구현 계획을 **얇은 엔트리포인트 + 태스크별 파일**로 쪼개 작성한다. 수천 줄짜리 단일 plan 파일이 작성·리뷰·실행 모두에 주는 부담을 피한다.

```
/dev-workflow:writing-plans-split
```

산출물 구조:

```
docs/plans/YYYY-MM-DD-<feature>.md     # 얇은 엔트리포인트(목표·아키텍처·Shared Contracts·태스크 표)
docs/plans/YYYY-MM-DD-<feature>/       # 태스크 본문
├── task-01-<slug>.md                  # 각 파일이 자족적: Files·TDD 단계·AC·Cautions
├── task-02-<slug>.md
└── task-NN-<slug>.md
```

실행은 `superpowers:subagent-driven-development`로 — 디스패처가 엔트리포인트의 Shared Contracts + 태스크 1개씩을 서브에이전트에 넘긴다.

0.10.0부터 엔트리포인트의 실행 계약은 **완료 기록**도 관행이 아니라 단계로 못박는다. 리뷰가 태스크를 승인한 뒤에야 — 구현자의 DONE 보고는 완료가 아니다 — 디스패처가 그 행을 `[x]`로 바꾸고 outcome 한 줄을 채워 **그 자리에서 엔트리포인트를 커밋**하고, 그다음에 다음 태스크를 디스패치한다. 재개 시에는 태스크 표를 SDD progress ledger·git log와 대조한다: ledger에 완료 기록이 없는 태스크는 미완료로 취급한다 — 구현 커밋은 리뷰 승인 전에도 존재하기 때문이다. 이 규칙은 살아 있는 ledger를 전제하므로, ledger가 사라졌거나 빈 채로 재생성된 상태(`git clean -fdx`로 유실된 워크스페이스, final review 후 정리된 경우)에서는 git log가 반박하지 않는 행을 일괄 되돌리지 않고 커밋된 표를 권위로 삼으며, 재구성한 ledger가 완료 상태만 복원한다는 사실을 함께 알린다.

### 4. `harden-spec` — spec 굳히기

brainstorming으로 뽑은 **spec 초안을 plan·구현으로 넘기기 전에** 적대적으로 압박해, 늦게 발각되면 재설계를 부르는 갭(놓친 요구·숨은 가정·엣지케이스·교차모듈 파급·불변식 위반)을 파내고 **spec을 그 자리에서 보강**한다. **project-aware** — 실행 repo의 `CLAUDE.md`·ADR·기존 spec을 읽어 *그 프로젝트의 불변식·기결정*으로 압박한다.

```
/dev-workflow:harden-spec [spec 경로]
```

**Fable 고정** — frontmatter(`model: fable` + `effort: max`)로 세션 모델과 무관하게 최고 모델로 압박한다. 질문은 **하이브리드** — 위험 높은 갭(비가역·교차모듈·불변식·AC 변경)은 단독으로 깊게, 나머지 판단 갭은 최대 4개 묶음 라운드(AskUserQuestion)로 **소진할 때까지** 묻는다. 사실은 코드에서 직접 조사하고, 판단이 걸린 갭은 전부 사용자에게 묻는다 — **질문을 거치지 않은 DEFERRED는 없다**. 이미 정해진 것(ADR·기결정)은 재론하지 않는다. 갭 해소마다 spec에 넣을 문구를 제안→승인 시 반영하고, 끝나면 잔여 리스크(DEFERRED)를 명시한 뒤 커밋하고 멈춘다(다음 단계는 새 세션 권고). `review-loop`(codex 산출물 검증) 앞단에서 *사람만 아는 누락*을 먼저 메우는 상보 도구다. "spec 굳혀줘 / 내가 놓친 것 찾아줘 / pre-mortem"처럼 말해도 자동 호출된다.

0.19.0부터 질문 본문은 **갭 대장·spec 원문을 보지 않은 사람**이 읽는다는 전제로 쓴다 — 쉬운 말 설명 + 「예:」 장면 1개, 갭 ID·D번호는 끝 괄호에 참조로만 둔다. 선택지 이름은 쉬운 행동 이름으로, 설명에는 고르면 무엇이 달라지는지를 적는다.

### 5. `ui-mockup` — UI 목업 선택

**옵션 3.5단계 — `harden-spec` 직후·`review-loop(spec)` 직전.** 굳은 spec이 **새 화면을 만들거나 기존 화면 구성을 바꿀 때** 호출한다. 자체완결 **비실행** 정적 HTML 목업을 발산해 사용자가 고르게 하고, 그 결정을 spec의 `## UI 설계` 섹션 + 재논의 금지(기결정) 블록에 기록한다 — plan·구현이 시각 방향을 나중에 재해석하지 못하게 막는 장치다. 선택 결과는 `docs/design/style-guide.md`로 수렴해 기능마다 UI가 파편화되는 것을 막는다.

```
/dev-workflow:ui-mockup [spec 경로]
```

발산 방식은 repo 상태가 정한다: 가이드 없음 + 기존 UI 없음 → **서로 다른 스타일 4종** / 가이드 없음 + 기존 UI 있음 → **유지(기존 UI에서 가이드 역추출)** 냐 **리뉴얼**이냐를 사용자가 선택 / 가이드 있음 → **레이아웃 변형 2~3종**만. 다중 화면 spec은 **대표 화면 1개만** 발산하고 나머지는 선택 확정 후 생성해, 탈락안에 비용이 들지 않는다. 발산은 총 2라운드 상한. **사용자 확인 없이 확정되는 경로가 없다** — 조합 지정("2번 레이아웃 + 4번 색")은 1회 재생성해 다시 확인받고, 다중 화면의 나머지 화면도 spec에 기록하기 전 최종 확인 1회를 거친다. 산출물은 `docs/design/<feature>/`에 놓이고 후보·비교 페이지까지 이력으로 커밋한다. 문구·색·단일 컨트롤 수준의 경미 변경은 완전히 건너뛰며, 대상 spec 없는 단독 호출은 거부하고 brainstorming → harden-spec 경로를 안내한다.

### 6. `setup` — repo에 파이프라인 채택

특정 repo가 이 파이프라인을 따르도록 **명시적으로** 채택할 때 호출한다. 프로젝트 CLAUDE.md에 마커 블록으로 **한 줄 포인터**(`dev-cycle`로의 포인터 + 미설치자용 설치법)를 멱등 삽입한다 — 전체 가이드를 복사하지 않으므로, 규약 본문이 바뀌어도(SSOT=`dev-cycle`) 각 repo의 CLAUDE.md는 낡지 않는다.

```
/dev-workflow:setup
```

이어서 **컨텍스트 임계 훅의 윈도 크기**(`CLAUDE_CTX_LIMIT`)를 물어 settings.json(글로벌 또는 프로젝트, 선택)에 적는다 — 훅은 윈도 크기를 런타임에 알 수 없어 기본 1M을 가정하므로, 200k 모델을 쓰면 명시해야 넛지가 제때 뜬다.

명시 요청 시에만 동작하며 마커 블록 밖 내용은 건드리지 않는다. 협업자·플러그인 미설치자도 CLAUDE.md만 보고 규약과 설치법을 알 수 있다.

### 7. `doctor` — 환경 진단

파이프라인 환경이 **조용히 틀린 상태**인지 확인할 때 호출한다. 읽기 전용이고 사용자 작업물·설정을 쓰지 않는다 — 발견한 이상은 기존 경로(`/plugin update` · `/codex:setup` · `/dev-workflow:setup`)로 위임한다.

```
/dev-workflow:doctor
```

명시 호출 외에 **증상 문장**("넛지가 안 떠", "codex가 안 돌아", "플러그인 최신인가", "버전 맞나")에서도 뜬다. 점검은 4항목이다 — ① 설치본 버전(엔트리 배열을 전부 열거해 user·project·local 스코프를 빠짐없이 본다) ② 마켓플레이스 최신 여부 ③ codex(CLI 존재·인증·companion 3종까지만, 그 이상은 `codex doctor`로 위임) ④ `CLAUDE_CTX_LIMIT`과 **현재 모델**의 대조(훅은 윈도 크기를 런타임에 알 수 없어 이 검사를 못 한다).

**버전 판정은 `dev-workflow/` subtree 비교로 한다.** 단순 sha 비교는 docs 커밋만 있어도 거짓 경보를 내고, `git log` 기반 판정은 되돌린 이력에서 트리가 같은데도 뒤처짐이라 답한다. 근거가 없으면(네트워크 실패·`gitCommitSha` 결측) **"판정 불가"**로 적고 "최신"이라 말하지 않는다. 정상이든 아니든 **4항목 표를 항상 출력**하고, 프로브 하나가 실패해도 나머지를 계속해 표 4행을 유지한다 — 환경이 가장 망가진 순간에 아무 정보도 못 얻는 일이 없게.

루프 실행 중의 codex 실패는 `review-loop` 소관이라 doctor가 끼지 않고, "왜 안 돼" 같은 막연한 실패 문장이나 **다른 제품 문맥**("playwright 플러그인 최신인가")에도 뜨지 않는다.

### 8. `orchestrate` — 메인 세션의 트랙 운영

(1.2.0 이상) **메인 세션**이 파이프라인 트랙을 별도 오르카 터미널로 띄워 기동 → 감시 → 질문 라우팅 → 단계 경계의 검증·핸드오프 → 후계까지 운영하는 공통 절차다. 공통 절차만 담는다 — **프로젝트 규약 우선**(repo id·브랜치·워크트리 정책·프롬프트 파일 위치·모델 배분·권한 플래그는 그 프로젝트의 CLAUDE.md·프로젝트 스킬이 정한다). 오르카 명령 상세는 스킬에 복사하지 않고 `orca skills get orca-cli`를 가리킨다.

```
/dev-workflow:orchestrate <트랙 · 단계 · spec 경로>
```

- **① 기동** — 그 체크아웃의 설치 버전을 조회만 하고, 모드를 고르고(사람 단계 = 수동, review-loop(spec)부터 = 위임), 모델은 `--model`로만(트랙에 `/model`을 보내지 않는다 — 새 세션 기본값으로 저장돼 전역 settings.json을 바꾼다), 세션 id는 `--session-id`로 정한 뒤, 동봉 템플릿으로 트랙 프롬프트를 채워 터미널을 만들고 프롬프트 파일 포인터 한 줄을 보낸다. 체크아웃당 트랙 1개.
- **② 감시** — 대기마다 `watch`를 백그라운드로 1회. 판정 `DONE | HANDOFF | SETTLED | QUESTION | PERMISSION | TIMEOUT | ERR`.
- **③ 질문** — 사람 단계와 수동으로 돌리는 트랙은 전부 사용자에게. 위임 트랙은 위험군(critical · 보안 · 방향 전제 · AC·목표·비목표·기결정 변경 · `[감사 이의]` · 권한 프롬프트)만 사용자에게. push · 다른 머신 변경 · 외부 실측 · 비가역은 언제나 사용자. 모든 전송 직전 `alive` 후 화면 재확인.
- **④ 단계 종료** — 메인이 트랙 보고를 직접 검증(커밋 범위 · 게이트 · AI 서명 · diff 범위 · 확인 대기 대장)하고 대기 항목을 사용자에게 물은 뒤 핸드오프를 쓰고 단계 경계에서 멈춘다.
- **⑤ 후계 · 페어링 · 다중 트랙** — `HANDOFF`는 사유가 넛지일 때만, 옛 세션 종료를 확인한 뒤에 자동 재개하고, 예기치 않게 끝난 트랙은 `claude --resume <세션 id>`로 복구하며, 원격 트랙은 `--environment`로 운영한다.

동봉 스크립트 `scripts/orchestrate.mjs`(오르카 상세의 유일한 거처): `watch`(트랙 상태) · `alive`(터미널 **과** claude 세션 생존 — exit 0 생존 / 1 종료 / 2 판독 불가 / 3 stale 핸들) · `key`(TUI 키 `enter` `tab` `shift-tab` `up` `down` `text`). 동봉 템플릿 `templates/track-prompt.md`(역할 · 읽을 파일 · 기결정 · 진행 범위 · review-loop 인자 · 사실 확인 · 정지 조건 · `[TRACK-DONE …]`/`[TRACK-HANDOFF …]` 표지 · 넛지 시 행동).

> ⚠️ 위임 트랙의 기동 명령 기본값에는 `--dangerously-skip-permissions`가 들어 있다 — 권한 창을 누를 사람이 없어서다. 안전장치는 프롬프트의 정지 조건(push 금지·비가역 금지)과 언제나 사용자에게 묻는 라우팅 행이고, 그래도 뜨는 권한 창은 메인이 허용하지 않는다(사용자 부재면 자동 거부된다).

### 9. 컨텍스트 임계 핸드오프 훅 (자동)

설치하면 바로 동작한다. 설정 불필요. 대화 컨텍스트 사용량이 임계(기본 40%)를 넘으면, 멈추기 전에 핸드오프를 작성하고 `/clear` 하라고 안내한다 — 컨텍스트가 터져 작업이 끊기기 전에 인계하도록 돕는다. 0.12.0부터 이 넛지는 **1회로 끝나지 않는다**: 임계 위로 **15%p 구간마다 재발화**한다(40 → 55 → 70 → 85%, 상한 없음). 첫 넛지를 흘려도 auto-compact가 걸릴 때까지 무경고로 남지 않는다. 재넛지는 지시 내용을 그대로 두고 사실만 더한다(이전에 안내했고 지금 몇 %인지). 사용률이 두 구간 이상 떨어지면 — auto-compact는 session id를 유지한다 — 새 주기로 보고 임계부터 다시 넛지한다. 0.18.0부터 넛지는 그 의미도 말한다 — **현재 작업 단위만 마무리**(리뷰 라운드 1회·SDD task 1개·수정 1건·질문 라운드 1회)하고 새 단위를 시작하지 않는다. 백그라운드 작업이 진행 중이면 완료 전 `/clear`하지 않고, 완료 알림으로 깨어나면 결과를 기록만 하고 멈춘 뒤 인계한다.

환경변수로 조정(선택):

```
CLAUDE_CTX_THRESHOLD=0.5    # 임계를 50%로 (0~1, 기본 0.4)
DEV_WORKFLOW_MODE=delegated # 위임 모드(1.1.0 이상) — 아래 「세션 모드」. 트랙 터미널 생성 명령의 접두로 건다
CLAUDE_CTX_LIMIT=200000     # 컨텍스트 토큰 상한 직접 지정
                            # 미지정 시 1,000,000(최신 모델 기준). 200k 윈도 모델을 쓸 때만 지정한다
                            # — 윈도 크기는 런타임에서 알 수 없어 자동 감지하지 않는다
```

1.0.0부터 **오르카 터미널**(`ORCA_TERMINAL_HANDLE`이 있는 세션)에서는 넛지의 `/clear` 안내가 **자동 인계**로 바뀐다: 핸드오프를 쓴 뒤 같은 체크아웃에 후계 `claude` 터미널을 직접 띄우고(제목 `<작업명>-<토큰>`), 재개 프롬프트를 파일(`.remember/successor-<토큰>.prompt`)로 조립해 보낸 다음 정지한다. 후계는 이 폴더에서 다른 세션의 codex 작업이 돌고 있지 않은지 확인한 뒤(최대 10분 대기) 첫 동작으로 옛 세션을 정상 종료시키며(`/exit` 전송 → 종료 확인 → `terminal close`), 그 전에는 codex를 실행하지 않는다. 사전 검증에서 실패하면 아직 만든 터미널이 없으므로 바로 현행 `/clear` 안내로 돌아가고, 생성·기동·전달 어느 단계가 실패하면 이 폴더에서 다른 세션의 codex 작업이 끝나기를 기다린 뒤(최대 10분) 만들다 만 터미널을 정리하고 소멸을 확인한 뒤에만 현행 `/clear` 안내로 돌아간다 — 후계를 하나로 확정할 수 없거나(생성 응답 유실 — 생성 직전 목록에 없던 새 핸들은 후보로 보고만 하고 1개여도 채택하지 않는다) 작업 검사가 통과하지 않거나 정리를 확인하지 못하면 `/clear`를 안내하지 않고 차단 상태를 보고한다. 단계 경계(spec→plan, plan→impl)의 `/clear`는 대상이 아니다 — 후계는 다른 단계를 시작하지 않고 사용자에게 확인한다. 오르카 밖에서는 이전과 같다.

**세션 모드 — 수동 / 위임 (1.1.0 이상).** 메인 세션(오케스트레이터)이 트랙 세션을 띄우고 그 질문에 대신 답하는 운영을 위해 세션 모드를 고른다. **수동**(기본 — `DEV_WORKFLOW_MODE` 미설정)은 사람이 단계별로 확인하며 진행하고, **위임**(`DEV_WORKFLOW_MODE=delegated` — 앞뒤 공백을 뗀 값이 정확히 일치할 때만, 그 외 값은 수동)은 야간·부재 중에 에이전트(통상 메인 세션)가 이 세션의 사용자 역할을 대행한다 — 질문은 오케스트레이터가 답하고 후계도 오케스트레이터가 띄운다. 브레인스토밍·harden-spec·ui-mockup은 사람·취향 단계라 모드와 무관하게 사람이 하고, 그 뒤 review-loop(spec)부터 수동 또는 위임으로 진행한다. 메인 세션 자신은 수동이다(자기 후계는 위 자동 인계 그대로). **설정은 트랙 터미널 생성 명령의 접두**가 기본이다: `orca terminal create … --command 'DEV_WORKFLOW_MODE=delegated claude …'` — 후계 터미널을 띄울 때도 같은 접두를 붙인다(빠뜨리면 그 후계만 자동 인계로 돌아간다). Windows(PowerShell)는 `$env:DEV_WORKFLOW_MODE='delegated'; claude …` 형태(미실측). settings.json `env`에 넣으면 프로젝트의 모든 세션 — **메인 세션까지** — 위임이 되어 자기 후계를 못 띄우므로 그 점을 알고 쓸 때만 쓴다. **위임 효과(1.2.0)**: ① 오르카 터미널에서도 자동 인계 대신 오르카 밖과 같은 `/clear` 안내 넛지를 받는다 — 후계는 오케스트레이터가 띄운다(1.1.0, 오르카 밖에서는 효과 없음) ② review-loop·dev-cycle이 위험군 외 질문의 추천안을 자동 채택한다 — 위험군(critical·보안·방향 전제·AC·목표·비목표·기결정 변경)은 여전히 묻고, 자동 채택한 결정은 출처 `추천 자동 채택(위임)`으로 기록되어 확인 라운드의 감사 대상이 된다 ③ 그 결정은 **확인 대기 대장**(spec·plan 말미 `## 확인 대기 대장`)에 모여 단계 경계에서 사용자가 확인·번복한다. 1.1.x 설치본은 ①만 받는다. 구버전 설치본은 이 변수를 모른다 — `doctor`로 버전을 확인한다.

### 10. `mr-review` — 남의 MR 두 모델 리뷰 초안

지정된 리뷰어가 MR 번호 하나로 **판정 초안 리포트**를 받는다. 저장소도 GitLab도 바꾸지 않는다(댓글·승인은 사람이 한다). 자기 spec/plan/구현을 고치는 `review-loop`와 다르다.

```
/dev-workflow:mr-review <프로젝트> <iid> [--adapter <어댑터 파일>] [--full] [--diff-only] [--resolve <id>=confirmed|dismissed|confirmed:fixable|confirmed:design …]
```

- **어댑터 문서 필수** — 프로젝트의 공통 문서 저장소에 두는 마크다운 한 파일(`--adapter` 또는 환경변수 `MR_REVIEW_ADAPTER`). 저장소 ID·정책 문서·렌즈·문서 지도·위키 루트(전송 허용/금지)·마스킹 패턴·배포 대상 규칙·댓글 형식·리포트 경로를 담는다. 스크립트는 그 안의 ```` ```json mr-review-adapter ```` 기계 블록만 읽고, 모델은 산문(렌즈·정책 설명)을 읽는다. 플러그인에는 프로젝트 고유 값이 없다.
- 흐름: `glab api`로 수집 → target·MR head를 fetch해 **API head = fetch head** 확인·세 SHA 고정(임시 워크트리) → 작성 규칙 검사표(계약 10줄·기준선·변경 사유·첨부·리베이스·댓글 신뢰) → 배포본 zip 대조(주석 SHA·목록·바이트·삭제 목록, 자체 zip 리더) → 컨텍스트 팩(공통 문서 절 발췌·위키·기준선 원문, Codex용 팩은 허용 출처 + 개인정보 마스킹 — 실패 시 Codex 생략) → Claude 서브에이전트·Codex `task` **독립 병렬** → 메인 병합 → 정책 순서로 판정 계산 → 리포트(정책 실행 블록 그대로, 전체 마스킹) → 임시 산출물 정리.
- 작성 규칙 미충족(계약 미완·기준선 없음)이면 검토 없이 **조기 종료** 리포트(초안 판정 + 작성자 보완 요청 문안). `--full`이면 끝까지 가되 미완은 증거 부족으로 남는다.
- 두 모델이 상충하거나 한쪽만 낮은 확신으로 잡은 차단 후보를 메인이 코드로 확인 못 하면 **판정 미확정** — 게시용 블록 없이 두 갈래를 보여 주고, 리뷰어가 `--resolve <id>=confirmed|dismissed|confirmed:fixable|confirmed:design`로 확정한다.
- Codex 플러그인·`glab`이 없으면: `glab` 없이는 돌지 않고, Codex가 없으면 **단일 모델 모드**(리포트 헤더에 「교차 검토 없음」).
- 포트 있는 GitLab(1.3.1 이상): 어댑터 `gitlab.host`는 `host[:port]` 그대로 쓰고(`gitlab.example.com:8443`), glab 설정에 **포트 없는 호스트 키** 항목(`hosts.gitlab.example.com`)이 있어 그 `api_host`가 `gitlab.example.com:8443`, `api_protocol`이 서버와 맞아야 한다 — 엔진은 `glab api --hostname`에 포트를 뗀 값을 넘기고 MR `web_url` 대조는 포트까지 본다. 시작 때 `glab api … version` GET 1회로 확인하고 실패하면 멈춘다.
- 1.3.2: 배포본 zip의 Maven WAR 배치(웹 루트·`WEB-INF/classes/…`)를 대조한다 — 어댑터 `projects.<이름>.deployLayout: "source"|"maven-war"`는 zip 으로 배치를 판별 못 할 때의 기본값이다(1.3.3부터 — 프로젝트 고정이 아니다, 없으면 `"source"`). `.java`는 `.class` 존재만 대조하고 리포트에 「바이트 대조 생략 n건」으로 표시된다. 같은 버전에서 배포본 불일치 목록 전문은 부록 A 한 곳(본문은 종류별 요약), 의도 대조표는 검증 표 행 번호(`row`)로 병합, 경로 감시는 명령 실행기·시스템 디렉터리·존재하지 않는 경로를 제외한다.
- 1.3.3: 배포본 zip 배치를 zip 마다 판별한다(공통 최상위 폴더 접두 제거 → `WEB-INF/`·`META-INF/`·`src/` 표지 → 기대 목록 시험 → 어댑터 기본값 — 리포트 부록 A 에 배치·근거·접두) — 같은 프로젝트에서 소스 zip·WAR zip·접두 붙은 zip 이 섞여도 어댑터 변경 없이 맞고, 본문 zip 여러 개(소스판 + class 판)는 합산 대조한다(같은 경로 다른 내용·zip 사이 경로 충돌·표지 혼합·항목 이름이 64 단계를 넘는 zip 은 「대조 불가」). 본문 삭제 목록의 내부 클래스(`Foo$X.class`)는 head 에 같은 이름의 파일이 살아 있으면 접지 않고 「대조 불가」(diff-only 는 확인할 수 없어 「대조 불가」). 그 밖에 리포트 표 셀의 `|`·줄바꿈 처리, 검토자가 `W` 밖에 쓴 새 항목 건수 자가 점검, companion 로그가 명령을 96자에서 자르는 경로 감시 한계 표시.
- 1.3.4: data descriptor(bit 3) 형식 배포본 zip(IDE·OS 압축 도구·스트리밍 `zip`·Python `zipfile`)도 서명 있는 꼬리표 값이 목차와 같고 압축 스트림 경계가 맞으면 대조한다(서명 없는 꼬리표·ZIP64·stored + 꼬리표는 「대조 불가」). 어댑터 `deploy.excludes` 에 걸리는 zip 항목(문서 등)은 불일치가 아니라 「배포 제외 경로 n건(참고)」로 따로 보인다(어댑터 어디에도 없는 파일은 지금처럼 불일치 · WAR 배치 zip 은 zip 경로가 곧 서빙 경로라 제외 경로여도 불일치). 리포트의 모든 줄에서 외부 유래 문자열의 줄바꿈(NEL·U+2028·U+2029 포함)을 펴고, 제어·서식·줄 구분 문자가 든 zip 항목 이름·첨부 파일명은 「대조 불가」, zip 주석 원문은 적지 않는다(SHA 또는 「SHA 없음(n자)」).
- 1.3.5: 워크트리 모드에서 Codex 팩은 대상 저장소 자신의 문서(`repo:` 문서·저장소 경로 기준선)를 본문 대신 경로 포인터로 보내고 Codex 가 작업 디렉터리에서 직접 읽는다(체크아웃 파일이 워크트리 안 일반 파일이고 head blob 과 바이트가 같을 때만 — 아니면 지금처럼 마스킹 본문 · diff-only 는 그대로). 리포트는 Codex 실행 로그에서 센 검토 깊이(`codex-stats` — 명령 수·변경 파일 언급 수)를 보이고 1/4 미만이면 「교차 검토: 있음(약함 — …)」. 기계 검사와 같은 사안의 모델 발견(`coveredBy`)은 기계 증거에 병합되고(판정 미확정 후보는 리뷰어가 `--resolve <id>=confirmed` 한 뒤에) 계약 미완 줄은 한 체크박스로 묶인다. 어댑터 선택 키 2개(기본 꺼짐 — 키가 없으면 출력 그대로): `baselineRepoPaths: true` 면 Baseline 의 저장소 상대 경로(`baselineCandidates` 에 맞고 head 에 일반 파일로 있으면 「저장소 문서 경로」 · 없으면 작성자 보완 문안 1줄 · 글롭 밖 경로는 표시 없이 「서술만」), `contract.backgroundSections: ["배경", "요약"]` 면 다른 배경 절 이름을 인정한다. review-loop 설명문이 남의 MR 은 mr-review 로 안내한다.
- 1.4.0: 기준선 결정 대조표 — `check` 가 확보한 기준선 원문을 가린 뒤 결정 항목(표 행·목록·제목의 `D<n>` · 다른 꼴은 어댑터 선택 키 `baselineDecisions.pattern`)을 뽑아 두 팩에 번호 목록으로 넣고, 두 검토자가 결정마다 KEPT·VIOLATED·UNKNOWN 을 낸다(`decisions` 필수 — 없는 결과는 INVALID · 리포트 부록 E · 어김은 대응 발견이 있어야 `verdict` 가 돈다). 한 모델만 잡은 차단 결함·설계 이탈의 「설계 안에서 고칠 수 있나」는 검토자 1명의 주장으로 보고 메인이 근거와 함께 정하거나, 못 하면 리뷰어가 `--resolve <id>=confirmed:fixable|confirmed:design` 으로 정한다. 새 서브커맨드 `merge` 가 두 결과를 지문·사안 키(`decisionIds`·`intentRows`)로 결정적으로 합쳐 `findings.json` 을 쓰고 메인은 `needsMain` 항목만 채운다(미처리면 `verdict` ERR) — `verdict.json` 이 발견 지문을 새겨 바뀐 발견에 옛 판정을 렌더하지 않는다.
- 업데이트 뒤에는 Claude Code 세션을 새로 연다(`/clear` 로는 옛 버전 스킬이 그대로 뜬다) — 1.4.0 부터 §0 이 옛 스킬 폴더를 감지해 멈추고 `/reload-plugins` → 새 세션을 안내한다.
- 테스트·빌드는 실행하지 않는다(검증 상태 전부 `[판독]`). 배포본 zip 대조만 스킬이 직접 수행한다.
- 글(MR 본문·댓글·문서 발췌) 속 비밀값 가림은 알려진 꼴 기준의 최선 노력이다: `키: 값`·`키=값`(따옴표·YAML 블록·이어지는 줄·properties `\` 줄 이음) · `--키 값` 옵션(줄 끝까지) · URL 자격증명 `scheme://사용자:비번@호스트`(빈 사용자명·비번 속 `@` 포함) · 비밀값 키 이름의 XML 요소·속성(`value` 속성과 짝 닫는 태그까지 본문 전체, CDATA·주석·같은 이름 중첩 포함) · `Bearer` · PEM 비밀키 — 키는 password·secret·token·api key·credential 등과 `DB_PASSWORD`·`dbPassword` 꼴. 가린 뒤 모양이 허용 꼴이 아닌 것(못 가린 꼴·해석 못 한 키 태그 등)은 Codex 를 생략한다(저장본은 그 값 전체를 바꾸고, 그래도 남는 리포트는 쓰지 않는다). 그 밖의 꼴(비밀값 단어 뒤 공백만으로 이어진 값 등)은 못 잡으며, 코드는 설계상 가리지 않고 Codex 로 간다. 프로젝트 고유 꼴은 어댑터 `mask` 에 넣는다 — 앞 문맥 없이 아무 글자나 잡는 패턴(`\S+`·`.+` 류)은 SHA 보호 자리표시 문자(NUL·U+E000~E010)까지 잡아 어댑터 로드에서 거부되니 앞 문맥(`(?<=token=)`)이나 글자 범위(`\w`·`[0-9a-f]`)로 좁힌다.

## 특정 repo에서 clone 시 자동 적용

협업자가 repo를 clone하고 trust할 때 이 플러그인을 자동으로 설치 프롬프트하려면, 그 repo의 `.claude/settings.json`에 마켓플레이스와 활성화를 선언한다:

```json
{
  "extraKnownMarketplaces": {
    "claude-dev-workflow": {
      "source": { "source": "github", "repo": "gguii74-rwk/claude-dev-workflow" }
    },
    "openai-codex": {
      "source": { "source": "github", "repo": "openai/codex-plugin-cc" }
    }
  },
  "enabledPlugins": {
    "dev-workflow@claude-dev-workflow": true
  }
}
```

`openai-codex`를 함께 선언해야 cross-marketplace 의존(codex)이 자동 해결된다. 협업자는 `/plugin marketplace add`·`/plugin install`을 수동으로 칠 필요 없이, 폴더 trust 시 설치 프롬프트만 수락하면 된다.

## 트러블슈팅

- **무엇이 문제인지 모르겠을 때** — `/dev-workflow:doctor`가 환경 4항목(설치본 버전 · 마켓플레이스 최신 · codex · 컨텍스트 윈도)을 한 번에 대조해 준다. 아래 항목들은 그 결과가 가리키는 조치다.
- **`marketplace add openai/codex-plugin-cc` 에서 SSH 인증 실패** (`Permission denied (publickey)`) — codex를 이미 쓰고 있다면 codex 마켓플레이스가 이미 `openai-codex`로 등록돼 있어 이 줄 자체가 불필요하다. `claude plugin marketplace list`로 `openai-codex`가 보이면 건너뛰면 된다. SSH 키가 없는 환경이면 슬래시 커맨드가 SSH를 시도하다 실패할 수 있는데, 어차피 안 해도 되는 작업이다.
- **`dependency-unsatisfied` 또는 codex가 안 깔림** — `openai-codex` 마켓플레이스가 등록 안 된 상태다. `/plugin marketplace add openai/codex-plugin-cc` 후 `/plugin install dev-workflow@claude-dev-workflow`를 다시 실행하면 의존이 해결된다.
- **`review-loop`가 codex 단계에서 멈춤** — codex CLI 미설치/미인증이다. `/codex:setup`으로 설정한다.
- **스킬이 안 보임** — `/plugin` Manage 탭에서 `dev-workflow`가 enabled인지 확인하고, 안 되면 `/reload-plugins` 또는 Claude Code 재시작. (훅·스킬 외 컴포넌트 변경은 재시작 후 반영)

## 주의

- user 스코프로 설치하면 컨텍스트 임계 Stop 훅이 **모든 프로젝트**에서 동작한다. 넛지 메시지는 `.remember/remember.md`에 핸드오프를 쓰라고 안내하며, **오르카 터미널에서는 넛지 뒤 후계 터미널 생성·`.remember/successor-<토큰>.prompt` 파일 쓰기·옛 세션 종료(`/exit`)가 자동으로 일어난다**(위임 모드 세션 제외 — 「세션 모드」) — `.remember/`를 쓰지 않는 프로젝트에서도 그 디렉터리가 생긴다(프롬프트 파일은 전달이 확인되면 지우고, 인계가 실패했을 때만 남는다). 오르카 밖에서는 안내 문구만 나오고 아무것도 자동으로 실행되지 않는다(현행과 같다).
- 오르카 터미널 핸들은 환경변수라 그 터미널 안에서 시작된 모든 프로세스가 물려받는다. 오르카 탭 안에서 띄운 중첩 `claude`(Bash로 실행한 `claude -p`, tmux 속 claude 등)가 넛지를 받으면 부모 탭을 자기 터미널로 여겨, 그 후계가 부모 세션에 `/exit`를 보낸다. 오르카 탭 안에서 긴 중첩 `claude`는 돌리지 말고 오르카 밖에서 돌린다 — 불가피하면 `DEV_WORKFLOW_MODE=delegated claude -p …`로 띄운다(1.1.0 이상): 부모 탭 핸들을 물려받아도 후계를 스폰하지 않는다.
- `writing-plans-split`은 분할 plan 관례를 쓰는 repo를 전제로 한다. 단일 plan 파일을 쓰는 repo에서는 `superpowers:writing-plans`를 그대로 쓰면 된다.

## 개발 / 릴리스

```
claude-dev-workflow/
├── .claude-plugin/marketplace.json   # 마켓플레이스 카탈로그(repo 루트)
├── dev-workflow/                     # 플러그인
│   ├── .claude-plugin/plugin.json    # name, version, dependencies(codex@openai-codex)
│   ├── skills/{dev-cycle,harden-spec,ui-mockup,writing-plans-split,review-loop,setup,doctor,orchestrate}/SKILL.md
│   ├── skills/orchestrate/{SKILL.md,scripts/orchestrate.mjs,templates/track-prompt.md}
│   ├── skills/mr-review/{SKILL.md,scripts/mr-review.mjs,scripts/lib/{adapter,gitlab,collect,check,deploy,pack,report}.mjs}
│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}
├── tests/orchestrate/                # orchestrate.mjs 테스트(스텁 orca — 플러그인 밖)
├── tests/mr-review/                  # mr-review 테스트(가짜 glab + 로컬 bare git — 플러그인 밖)
├── README.md                         # 영어(기본)
└── README.ko.md / README.ja.md       # 한국어 / 일본어
```

`plugin.json`의 `version`을 올린 커밋에서만 사용자가 업데이트를 받는다. 버전을 생략하면 git commit SHA가 버전이 되어 매 커밋이 새 버전으로 취급된다. 사용자는 `/plugin update` 또는 백그라운드 자동 업데이트로 갱신한다.

테스트: `node --test tests/orchestrate/orchestrate.test.mjs`(orchestrate — 스텁 `orca`) · `node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs tests/mr-review/deploy.test.mjs tests/mr-review/pack.test.mjs tests/mr-review/report.test.mjs`(mr-review — 가짜 `glab`·로컬 bare git, 실제 GitLab·오르카 불필요). 이 repo에는 npm 게이트가 없다(폴더 인자 금지 — Node 21 이상은 모듈 경로로 해석).

**README는 3개 언어로 유지한다** — `README.md`(영어, 기본) / `README.ko.md` / `README.ja.md`. 내용을 바꿀 때는 **3개 파일을 함께 갱신**한다(드리프트 방지).
