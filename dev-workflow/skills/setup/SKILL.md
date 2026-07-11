---
name: setup
description: Use ONLY when the user explicitly asks to adopt, set up, or pin the dev-workflow pipeline in the current repository — e.g. "이 repo에 dev-workflow 세팅해줘", "set up the dev-workflow pipeline here", "CLAUDE.md에 파이프라인 규약 넣어줘". Does NOT trigger on general questions or on plugin install.
---

# setup

**Announce:** "setup으로 이 repo의 CLAUDE.md에 dev-workflow 파이프라인 포인터를 추가합니다."

## 하는 일

프로젝트 CLAUDE.md에 **파이프라인 규약 포인터**(전체 가이드 아님)를 마커 블록으로 멱등 삽입한다. 규약 본문(SSOT)은 `dev-cycle` 스킬에 있고 여기엔 그리로의 포인터만 둔다 — 파이프라인이 바뀌어도 CLAUDE.md는 낡지 않는다.

## 절차

1. repo 루트 `CLAUDE.md`를 찾는다. 없으면 **생성 여부를 사용자에게 확인**한다.
2. 아래 마커 블록이 이미 있으면(`<!-- dev-workflow:pipeline -->`) **그 블록만 교체**, 없으면 파일 끝에 **append**한다. 마커 밖 기존 내용은 건드리지 않는다(surgical).

```
<!-- dev-workflow:pipeline -->
## 개발 워크플로 (dev-workflow)

이 repo의 다단계 기능 개발은 dev-workflow 파이프라인을 따른다 — 새 기능·큰 변경을 시작하면 `/dev-workflow:dev-cycle`(또는 "개발 사이클")로 전체 순서와 현재 단계를 확인한다.

플러그인 미설치 시: `/plugin marketplace add gguii74-rwk/claude-dev-workflow` → `/plugin install dev-workflow@claude-dev-workflow`.
<!-- /dev-workflow:pipeline -->
```

3. 변경 결과를 사용자에게 보고한다. **커밋은 하지 않는다** — 사용자가 자신의 커밋 흐름으로 처리한다.

## 하지 말 것

- 전체 파이프라인 가이드를 CLAUDE.md에 복사 → 포인터만(SSOT는 dev-cycle). 드리프트 유발.
- 마커 블록 밖의 기존 CLAUDE.md 내용 수정 → 블록만.
- 명시 요청 없이 자동 실행 → 이 스킬은 사용자가 명시적으로 요청할 때만.
