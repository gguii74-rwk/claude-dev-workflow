# claude-dev-workflow

내부 개발 워크플로 도구를 팀에 배포하는 Claude Code 플러그인 마켓플레이스.
검증된 도구 3종을 단일 플러그인 `dev-workflow`로 묶었다.

## 구성

| 도구 | 종류 | 역할 |
|---|---|---|
| `review-loop` | skill | spec/plan/impl 완료 후 커밋→codex 적대검증→보수적 판정(disposition)·자동수정 반복 루프 (미판정 blocking 0까지, 최대 5회) |
| `writing-plans-split` | skill | 다단계 구현 계획을 얇은 엔트리포인트 + 태스크별 파일로 분할 작성 |
| 컨텍스트 임계 넛지 | Stop hook | 컨텍스트 사용량이 임계(기본 40%) 초과 시 핸드오프 작성 + `/clear` 안내를 1회 넛지 |

설치 후 스킬은 `dev-workflow:review-loop`, `dev-workflow:writing-plans-split`로 호출된다.

## 요구사항

- Claude Code v2.1.140 이상 권장 (플러그인 의존성 기능 포함).
- **codex 플러그인**: `review-loop`가 codex companion(`adversarial-review`)을 호출하므로 `codex@openai-codex` 플러그인을 의존한다. 이 플러그인은 `plugin.json`의 `dependencies`로 선언돼 **설치 시 자동으로 함께 설치**된다 — 단 `openai-codex` 마켓플레이스가 등록돼 있어야 한다(아래 설치 절차 참고).
- **codex CLI 인증은 별도**: 플러그인 의존은 codex *플러그인*만 끌어온다. codex CLI 자체 설치·로그인(`/codex:setup`)은 사용자가 직접 해야 `review-loop`가 실제로 동작한다.

## 설치 (팀 공통 — 모든 프로젝트에서 사용)

```
/plugin marketplace add openai/codex-plugin-cc          # codex 의존성 출처(미등록 시)
/plugin marketplace add gguii74-rwk/claude-dev-workflow
/plugin install dev-workflow@claude-dev-workflow        # codex 의존성도 자동 설치
```

user 스코프(기본)로 설치하면 모든 프로젝트에서 스킬·훅이 활성화된다.

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

`openai-codex`를 함께 선언해야 cross-marketplace 의존(codex)이 자동 해결된다.
협업자는 `/plugin marketplace add`·`/plugin install`을 수동으로 칠 필요 없이, 폴더 trust 시 설치 프롬프트를 수락하면 된다.

## 주의

- user 스코프로 설치하면 컨텍스트 임계 Stop 훅이 **모든 프로젝트**에서 동작한다. 넛지 메시지는 `.remember/remember.md`에 핸드오프를 쓰라고 안내하므로, `.remember/`를 쓰지 않는 프로젝트에서는 그 문구만 맞지 않을 뿐 동작은 무해하다.
- 훅 임계·한도는 환경변수로 조정한다: `CLAUDE_CTX_LIMIT`(컨텍스트 토큰 상한, 미지정 시 모델명에 `[1m]`이 있으면 1,000,000 / 아니면 200,000 자동), `CLAUDE_CTX_THRESHOLD`(0~1, 기본 0.4).
- 적대검증은 커밋된 HEAD(브랜치 diff) 기준으로 본다 — `review-loop`는 "수정→커밋→리뷰" 순서를 강제한다.

## 개발 / 릴리스

```
claude-dev-workflow/
├── .claude-plugin/marketplace.json   # 마켓플레이스 카탈로그(repo 루트)
├── dev-workflow/                     # 플러그인
│   ├── .claude-plugin/plugin.json
│   ├── skills/{review-loop,writing-plans-split}/SKILL.md
│   └── hooks/{hooks.json,scripts/context-threshold-hook.mjs}
└── README.md
```

`plugin.json`의 `version`을 올린 커밋에서만 사용자가 업데이트를 받는다. 버전을 생략하면 git commit SHA가 버전이 되어 매 커밋이 새 버전으로 취급된다.
