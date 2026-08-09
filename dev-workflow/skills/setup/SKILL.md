---
name: setup
description: Use ONLY when the user explicitly asks to adopt, set up, or pin the dev-workflow pipeline in the current repository — e.g. "이 repo에 dev-workflow 세팅해줘", "set up the dev-workflow pipeline here", "CLAUDE.md에 파이프라인 규약 넣어줘". Does NOT trigger on general questions or on plugin install.
---

# setup

**Announce:** "setup으로 이 repo의 CLAUDE.md에 dev-workflow 파이프라인 포인터를 추가하고, 컨텍스트 임계 훅의 윈도 크기를 확인합니다."

## 하는 일

프로젝트 CLAUDE.md에 **파이프라인 규약 포인터**(전체 가이드 아님)를 마커 블록으로 멱등 삽입한다. 규약 본문(SSOT)은 `dev-cycle` 스킬에 있고 여기엔 그리로의 포인터만 둔다 — 파이프라인이 바뀌어도 CLAUDE.md는 낡지 않는다.

이어서 **컨텍스트 임계 훅의 윈도 크기**(`CLAUDE_CTX_LIMIT`)를 사용자에게 확인해 settings.json에 적는다. 훅은 윈도 크기를 런타임에 알 수 없다 — transcript의 모델 ID는 베어 ID(`claude-opus-5`)만 담고 `[1m]` 접미사가 없으며 usage에도 윈도 값이 없다. 그래서 기본 1M을 가정하므로, **200k 모델을 쓰면 사용량이 5배 과소평가돼 넛지가 뜨지 않는다.**

## 절차

1. repo 루트 `CLAUDE.md`를 찾는다. 없으면 **생성 여부를 사용자에게 확인**한다.
2. 아래 마커 블록이 이미 있으면(`<!-- dev-workflow:pipeline -->`) **그 블록만 교체**, 없으면 파일 끝에 **append**한다. 마커 밖 기존 내용은 건드리지 않는다(surgical).

```
<!-- dev-workflow:pipeline -->
## 개발 워크플로 (dev-workflow)

이 repo의 기능 개발·코드 변경은 dev-workflow 파이프라인을 따른다 — **새 기능이든 한 단계짜리 작은 변경이든, 코드를 건드리기 전에** `/dev-workflow:dev-cycle`(또는 "개발 사이클")로 **경로(정식·경량)와 현재 단계**를 확인한다. **이 repo에서는 경로 판정이 항상 필요하다** — 규모는 기준이 아니고, 무엇을 생략할지는 지도가 판정한다.

플러그인 미설치 시: `/plugin marketplace add gguii74-rwk/claude-dev-workflow` → `/plugin install dev-workflow@claude-dev-workflow`.
<!-- /dev-workflow:pipeline -->
```

3. **컨텍스트 윈도 설정**(`CLAUDE_CTX_LIMIT`) — 임계 훅이 정확히 넛지하도록 확인한다.
   1. **현재 값을 조회한다** — 글로벌 `~/.claude/settings.json`(또는 `CLAUDE_CONFIG_DIR`)과 프로젝트 `.claude/settings.json`·`.claude/settings.local.json`을 **모두** 본다. 이미 값이 있으면 어디에 얼마로 있는지 밝히고, 선택지 첫 항목을 **"현재 값 유지"**로 둔다.
   2. **AskUserQuestion 1회로 두 질문을 함께 받는다**(왕복 1회):
      - **윈도 크기** — `1M`(1000000) / `200k`(200000) / **건너뜀**. 훅이 스스로 알 수 없는 이유를 한 줄로 밝히고(모델 ID에 `[1m]` 접미사가 없다), 모르면 `/model`에서 현재 모델 표기를 확인하도록 안내한다.
      - **쓸 위치** — **글로벌**(`~/.claude/settings.json` — 이 머신 전체·권장. 윈도는 repo 속성이 아니라 머신·모델 선택에 딸린 값이다) / **프로젝트 로컬**(`.claude/settings.local.json` — 이 repo + 이 머신만, 보통 git 미추적) / **프로젝트**(`.claude/settings.json` — 이 repo만). 프로젝트 선택지 설명에 **"커밋하면 다른 모델을 쓰는 협업자에게도 잘못 적용된다"**를 명시한다.
   3. 건너뜀이 아니면 선택한 settings.json의 **`env.CLAUDE_CTX_LIMIT`만** 멱등 반영한다(있으면 교체, 없으면 추가). `env`의 다른 항목과 다른 최상위 키는 그대로 둔다. 파일이나 `env`가 없으면 만든다.
   4. **Claude Code 재시작 후 적용됨**을 알린다 — 훅은 실행 중 세션에 즉시 반영되지 않는다.
4. 변경 결과를 사용자에게 보고한다. **커밋은 하지 않는다** — 사용자가 자신의 커밋 흐름으로 처리한다.

## 하지 말 것

- 전체 파이프라인 가이드를 CLAUDE.md에 복사 → 포인터만(SSOT는 dev-cycle). 드리프트 유발.
- 마커 블록 밖의 기존 CLAUDE.md 내용 수정 → 블록만.
- 명시 요청 없이 자동 실행 → 이 스킬은 사용자가 명시적으로 요청할 때만.
- 임계 비율(`CLAUDE_CTX_THRESHOLD`)을 임의로 조정 → 이 스킬은 **윈도 크기만** 다룬다. 사용자가 명시 요청할 때만 건드린다.
- settings.json을 통째로 재작성 → 대상 키만 수정. 다른 설정을 유실시키지 말 것.
- 윈도 크기를 모르는 채 추측해서 쓰기 → **건너뜀**으로 남긴다. 틀린 값은 기본값(1M)보다 나쁘다.
