# claude-dev-workflow

검증된 개발 워크플로 도구 4종을 단일 Claude Code 플러그인 **`dev-workflow`**로 묶어 배포하는 마켓플레이스. 한 번 설치하면 **모든 프로젝트**에서 쓸 수 있다.

| 도구 | 종류 | 호출 | 역할 |
|---|---|---|---|
| review-loop | skill | `/dev-workflow:review-loop` | spec/plan/impl 완료 후 커밋→codex 적대검증→판정·자동수정 반복 (판정 없이 남은 critical/high 0까지) |
| writing-plans-split | skill | `/dev-workflow:writing-plans-split` | 다단계 구현 계획을 얇은 엔트리포인트 + 태스크별 파일로 분할 작성 |
| harden-spec | skill | `/dev-workflow:harden-spec` | spec 초안을 plan/구현 전에 적대적으로 압박해 놓친 갭·가정·불변식 위반을 파내고 spec을 굳힌다 (project-aware) |
| 컨텍스트 임계 넛지 | Stop hook | (자동) | 컨텍스트 사용량이 임계(기본 40%) 초과 시 핸드오프 작성 + `/clear` 안내를 1회 넛지 |

## 목차

- [요구사항](#요구사항)
- [설치](#설치)
- [사용법](#사용법)
  - [review-loop](#1-review-loop--적대검증-반복-루프)
  - [writing-plans-split](#2-writing-plans-split--분할-구현-계획)
  - [harden-spec](#3-harden-spec--spec-굳히기)
  - [컨텍스트 임계 핸드오프 훅](#4-컨텍스트-임계-핸드오프-훅-자동)
- [특정 repo에서 clone 시 자동 적용](#특정-repo에서-clone-시-자동-적용)
- [트러블슈팅](#트러블슈팅)
- [주의](#주의)
- [개발 / 릴리스](#개발--릴리스)

## 요구사항

- **Claude Code v2.1.140 이상** 권장 (플러그인 의존성 기능 포함).
- **codex 플러그인** — `review-loop`가 codex의 `adversarial-review`를 호출하므로 `codex@openai-codex` 플러그인을 의존한다. `plugin.json`의 `dependencies`로 선언돼 **설치 시 자동으로 함께 설치**된다(단 `openai-codex` 마켓플레이스가 등록돼 있어야 함 — 아래 설치 참고).
- **codex CLI 인증은 별도** — 플러그인 의존은 codex *플러그인*만 끌어온다. codex CLI 자체 설치·로그인(`/codex:setup`)은 직접 해야 `review-loop`가 실제로 동작한다. `writing-plans-split`·컨텍스트 훅은 이 인증 없이 바로 동작한다.

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

### 1. `review-loop` — 적대검증 반복 루프

각 단계 완료 후 변경을 커밋하고 codex로 적대검증을 돌린다. 결함은 자동수정하거나 판정(disposition)으로 닫으면서, **"판정 없이 남은 critical/high가 0"**이 될 때까지 반복한다. 목표는 "지적사항 0"이 아니라 "미판정 0"이다.

옵션은 전부 선택 — `/dev-workflow:review-loop`만 써도 동작한다.

| 옵션 | 기본값 | 역할 |
|---|---|---|
| `--phase spec\|plan\|impl` | 자동 추론 | 어느 단계를 검증할지. 생략하면 변경 내용으로 추론 |
| `--base <ref>` | `main` | 적대검증이 비교하는 기준 브랜치(이 diff를 본다) |
| `--max <n>` | `5` | 리뷰 반복 횟수의 절대 상한 |
| `--auto-rounds <n>` | `3` | 초반 n회 **자동 모드** — 결함 자동수정 + 위험 없는 사용자 결정은 모아뒀다 한 번에 질문. `0`=매 라운드 즉시 질문, 보안 민감 작업은 `1` |
| `--resume` | — | 중단된 루프를 `.remember/remember.md`의 저장 상태(ledger 포함)에서 재개 |

```
/dev-workflow:review-loop --phase impl                  # 구현 검증 (typecheck·lint·test·build 게이트 후)
/dev-workflow:review-loop --phase spec --auto-rounds 1  # 보안 민감 → 자동 모드 최소화
/dev-workflow:review-loop --base develop                # main 대신 develop 기준 diff
/dev-workflow:review-loop --resume                      # 컨텍스트 한계로 끊겼던 루프 이어가기
```

**동작 흐름** — 매 반복: ① 미커밋 변경 커밋 → ② codex 적대검증 실행 → ③ finding을 fingerprint로 분류·판정(FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE/ESCALATE) → ④ FIXED는 (impl이면 TDD로) 수정 → ⑤ 게이트 재실행. 미판정 blocking이 0이 되면 종료.

> 적대검증은 **커밋된 HEAD(브랜치 diff)** 를 본다. 미커밋 상태로 돌리면 직전 수정을 놓치므로, 루프는 항상 "수정→커밋→리뷰" 순서를 강제한다.

### 2. `writing-plans-split` — 분할 구현 계획

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

### 3. `harden-spec` — spec 굳히기

brainstorming으로 뽑은 **spec 초안을 plan·구현으로 넘기기 전에** 적대적으로 압박해, 늦게 발각되면 재설계를 부르는 갭(놓친 요구·숨은 가정·엣지케이스·교차모듈 파급·불변식 위반)을 파내고 **spec을 그 자리에서 보강**한다. **project-aware** — 실행 repo의 `CLAUDE.md`·ADR·기존 spec을 읽어 *그 프로젝트의 불변식·기결정*으로 압박한다.

```
/dev-workflow:harden-spec [spec 경로]
```

질문은 **한 번에 하나**, 위험 높은 것(비가역·교차모듈·불변식)부터. 사실은 코드에서 직접 조사하고 열린 결정만 묻는다. 이미 정해진 것(ADR·기결정)은 재론하지 않는다. 갭 해소마다 spec에 넣을 문구를 제안→승인 시 반영하고, 끝나면 잔여 리스크(DEFERRED)를 명시한 뒤 커밋하고 멈춘다(다음 단계는 새 세션 권고). `review-loop`(codex 산출물 검증) 앞단에서 *사람만 아는 누락*을 먼저 메우는 상보 도구다. "spec 굳혀줘 / 내가 놓친 것 찾아줘 / pre-mortem"처럼 말해도 자동 호출된다.

### 4. 컨텍스트 임계 핸드오프 훅 (자동)

설치하면 바로 동작한다. 설정 불필요. 대화 컨텍스트 사용량이 임계(기본 40%)를 넘으면, 멈추기 전에 핸드오프를 작성하고 `/clear` 하라고 1회 안내한다 — 컨텍스트가 터져 작업이 끊기기 전에 인계하도록 돕는다.

환경변수로 조정(선택):

```
CLAUDE_CTX_THRESHOLD=0.5    # 임계를 50%로 (0~1, 기본 0.4)
CLAUDE_CTX_LIMIT=200000     # 컨텍스트 토큰 상한 직접 지정
                            # 미지정 시 모델명에 [1m]이 있으면 1,000,000 / 아니면 200,000 자동
```

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

- **`marketplace add openai/codex-plugin-cc` 에서 SSH 인증 실패** (`Permission denied (publickey)`) — codex를 이미 쓰고 있다면 codex 마켓플레이스가 이미 `openai-codex`로 등록돼 있어 이 줄 자체가 불필요하다. `claude plugin marketplace list`로 `openai-codex`가 보이면 건너뛰면 된다. SSH 키가 없는 환경이면 슬래시 커맨드가 SSH를 시도하다 실패할 수 있는데, 어차피 안 해도 되는 작업이다.
- **`dependency-unsatisfied` 또는 codex가 안 깔림** — `openai-codex` 마켓플레이스가 등록 안 된 상태다. `/plugin marketplace add openai/codex-plugin-cc` 후 `/plugin install dev-workflow@claude-dev-workflow`를 다시 실행하면 의존이 해결된다.
- **`review-loop`가 codex 단계에서 멈춤** — codex CLI 미설치/미인증이다. `/codex:setup`으로 설정한다.
- **스킬이 안 보임** — `/plugin` Manage 탭에서 `dev-workflow`가 enabled인지 확인하고, 안 되면 `/reload-plugins` 또는 Claude Code 재시작. (훅·스킬 외 컴포넌트 변경은 재시작 후 반영)

## 주의

- user 스코프로 설치하면 컨텍스트 임계 Stop 훅이 **모든 프로젝트**에서 동작한다. 넛지 메시지는 `.remember/remember.md`에 핸드오프를 쓰라고 안내하므로, `.remember/`를 쓰지 않는 프로젝트에서는 그 문구만 맞지 않을 뿐 동작은 무해하다.
- `writing-plans-split`은 분할 plan 관례를 쓰는 repo를 전제로 한다. 단일 plan 파일을 쓰는 repo에서는 `superpowers:writing-plans`를 그대로 쓰면 된다.

## 개발 / 릴리스

```
claude-dev-workflow/
├── .claude-plugin/marketplace.json   # 마켓플레이스 카탈로그(repo 루트)
├── dev-workflow/                     # 플러그인
│   ├── .claude-plugin/plugin.json    # name, version, dependencies(codex@openai-codex)
│   ├── skills/{review-loop,writing-plans-split,harden-spec}/SKILL.md
│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}
└── README.md
```

`plugin.json`의 `version`을 올린 커밋에서만 사용자가 업데이트를 받는다. 버전을 생략하면 git commit SHA가 버전이 되어 매 커밋이 새 버전으로 취급된다. 사용자는 `/plugin update` 또는 백그라운드 자동 업데이트로 갱신한다.
