---
name: dev-cycle
description: Use when starting a new feature or multi-step change, or when unsure which development step to do next, and you want this repo's recommended end-to-end pipeline (design → spec → harden → review → plan → review → implement → review). 트리거 예: "새 기능 시작", "어디서부터 시작해", "개발 사이클", "다음 단계 뭐야", "how do I run this feature end to end".
---

# dev-cycle

**Announce:** "dev-cycle로 개발 파이프라인 지도를 잡습니다."

## 핵심 원칙

이건 **읽기 전용 지도**다. 다단계 기능 개발의 권장 순서와 **지금 어느 단계인지**를 알려주고 그 단계의 스킬로 안내한다 — 파일을 고치지 않는다.

**한 세션에서 전 과정을 자동으로 돌리지 않는다.** 단계 경계마다 새 세션 + `/clear`가 필요하고(아래), Claude는 자가 `/clear`를 못 한다. 그러니 **현재 단계 하나만 수행하고, 다음 단계는 핸드오프로 넘긴다.**

## 권장 파이프라인 (8단계)

| # | 단계 | 스킬 | 소속 |
|---|---|---|---|
| 1–2 | 협업 설계 → spec 초안 | brainstorming | superpowers |
| 3 | spec 압박·굳히기 (사람 적대) | harden-spec | dev-workflow |
| 4 | spec 적대검증 (codex) | review-loop `--phase spec` | dev-workflow |
| 5 | 분할 구현계획 | writing-plans-split | dev-workflow |
| 6 | plan 적대검증 | review-loop `--phase plan` | dev-workflow |
| 7 | 구현 | subagent-driven-development | superpowers |
| 8 | impl 적대검증 | review-loop `--phase impl` | dev-workflow |

- 1–2단계 후 brainstorming의 기본 종착점(writing-plans)으로 바로 가지 말고 **3–4(harden-spec → review-loop)로 spec을 굳힌 뒤** 5로 간다.
- **superpowers 미설치 시**: 1·7단계는 자체 브레인스토밍/구현으로 대체 가능하다. 3–6·8단계(dev-workflow 자체 스킬)만으로도 spec–plan–검증 골격은 완결된다.

## 단계 경계 = 새 세션 + `/clear`

spec→plan, plan→impl 경계는 **핸드오프를 쓰고 새 세션에서 시작**한다(review-loop 규약). 한 세션에서 여러 phase를 강행하지 않는다 — 컨텍스트가 커지고 phase가 섞인다. review-loop의 컨텍스트 40% 핸드오프 넛지가 이를 돕는다.

## 지금 어느 단계인가 (판별)

현 작업의 산출물로 추론해 **해당 단계만** 안내한다:

1. 대응하는 `docs/specs/<feature>`가 없다 → **1–2** (brainstorming으로 spec 초안).
2. spec은 있으나 아직 안 굳음(harden 미실시 / `## 적대검증 ledger` 미종결) → **3 harden-spec → 4 review-loop(spec)**.
3. spec이 굳었고 `docs/plans/<feature>`가 없다 → **5 writing-plans-split → 6 review-loop(plan)**.
4. plan이 있고 구현이 미완이다 → **7 subagent-driven-development → 8 review-loop(impl)**.

git 브랜치명·`docs/specs`·`docs/plans`·ledger 상태를 신호로 쓴다. 애매하면 사용자에게 현재 위치를 확인한다.

## 하지 말 것

- 한 세션에서 여러 phase 강행 → 경계에서 멈추고 `/clear` 넛지.
- 지도를 이유로 파일 수정 → dev-cycle은 읽기 전용. CLAUDE.md 채택은 `setup`, spec 수정은 `harden-spec`, plan/impl 수정은 각 단계 스킬이 한다.
- superpowers 없다고 중단 → 느슨한 참조이므로 대체 안내로 진행한다.
