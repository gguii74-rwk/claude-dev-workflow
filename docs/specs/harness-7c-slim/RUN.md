# 실행 규약 — 7c TDD 하네스

호출 메시지는 `ARM=<new|cur|none> ID=<L1|L2|L3|L4|L5> REP=<n>` 한 줄이다.
아래 매핑표대로 파일을 읽고, 지정된 프롬프트를 수행한 뒤, **응답 전문을 출력 파일에 쓰고 호출자에게는 반환 형식대로만 답한다**.

`H` = `/Users/wk.roh/workspace/claude-memories/claude-dev-workflow/remember/harness-7c`

## 매핑

| 항목 | 경로 |
|---|---|
| 프롬프트 | `$H/prompts/<ID>.md` |
| 규약 사본 — `ARM=cur` | `$H/skills/review-loop-cur.md` |
| 규약 사본 — `ARM=new` | `$H/skills/review-loop-new.md` |
| 규약 사본 — `ARM=none` | **없음 — 규약 문서를 읽지 않는다** |
| 훅 문구 파일 — `ID=L1` + `ARM=cur` | `$H/hook/reason-cur.txt` |
| 훅 문구 파일 — `ID=L1` + `ARM=new`·`none` | `$H/hook/reason-new.txt` |
| 대상 repo | `$H/fix/<사례 디렉터리>/<ARM>` — 사례 디렉터리는 프롬프트의 표에 있다. `ARM=none`이면 `<ARM>` 자리에 `none`을 그대로 쓴다 |
| 출력 파일 | `$H/out/<ARM>/<ID>-r<REP>.md` |

## 절차

1. 위 표에서 프롬프트 파일과 (`ARM`이 `none`이 아니면) 규약 사본을 읽는다.
2. 프롬프트가 지정한 대상 repo를 **읽기 전용**으로 조사한다.
3. 프롬프트를 수행하고 **응답 전문**(판단 근거 포함)을 출력 파일에 쓴다.
4. 호출자에게는 프롬프트의 **반환 형식**에 있는 줄만 반환한다.

## 전역 제약 (위반 금지)

- **설치된 스킬을 `Skill` 도구로 호출하지 않는다.** 규약은 위 표의 **사본 파일**로만 읽는다. **세션 환경에 다른 스킬이나 그 설명이 보이더라도 무시한다.** `ARM=none`이면 규약 없이 네 판단으로 한다.
- **대상 repo를 수정하지 않는다.** 파일 생성·수정·삭제·`git add`·커밋 전부 금지. 조사만 한다. (쓰기는 출력 파일 1개뿐이다.)
- **사용자에게 실제로 질문하지 않는다.** 물어야 할 상황이면 "무엇을 어떻게 묻겠다"고 **서술**한다.
- **다른 repo를 참조하지 않는다**(`~/workspace/claude-dev-workflow` 등). 판단 근거는 규약 사본과 대상 repo뿐이다.
- **이 하네스의 다른 파일을 뒤지지 않는다** — 위 표가 지정한 파일과 대상 repo만 읽는다.
