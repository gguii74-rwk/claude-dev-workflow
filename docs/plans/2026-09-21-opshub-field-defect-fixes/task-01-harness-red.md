# task-01 — 하네스 작성 + RED(cur arm)

**목적**: 행동 항목(F1·F3·F6)의 writing-skills TDD 첫 단계 — 현행 0.17.0 문면(cur arm)에서 결함이 재현되는지(RED) 기록할 하네스를 만들고 cur arm을 돈다. 훅은 `decideNudge` 직접 호출 케이스로 RED를 확인한다.

## Files

- Create (전부 `H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0`, = repo `.remember/harness-0.18.0`):
  - `$H/RUN.md` · `$H/PLAN.md` · `$H/tally.sh` · `$H/hook-cases.mjs`
  - `$H/prompts/V.md` · `$H/prompts/N0.md` · `$H/prompts/N1.md` · `$H/prompts/N2.md`
  - `$H/fix/V1.out` · `$H/fix/V2.out` · `$H/fix/V3.out` · `$H/fix/V4.out`
  - `$H/skills/review-loop-cur.md` · `$H/skills/harden-spec.md` · `$H/skills/hook-cur.txt`
  - `$H/out/cur/*.md`(실행 산출)
- Create: `.remember/tdd-opshub-field-defect-fixes.md`(RED 기록 절)
- Modify: 없음(repo 파일 무변경 — 이 task는 커밋할 repo 변경이 없다; 엔트리포인트 task 표 갱신만 커밋)

## Prep

- spec §6(검증 계획), §3 F1-3·F3·F6, §5 AC3·AC6. 엔트리포인트 SC-2·SC-3·SC-6.
- 하네스 선례 형식: `.remember/harness-7a/RUN.md`(디스패치 규약·전역 제약), `.remember/harness-7b/PLAN.md`(기대 답을 RUN에서 분리한 이유).

## Deps

없음.

## Steps

### 1. 디렉터리·스킬 사본

```bash
H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0
mkdir -p $H/{prompts,fix,skills,out/cur,out/new}
cd ~/workspace/claude-dev-workflow
cp dev-workflow/skills/review-loop/SKILL.md $H/skills/review-loop-cur.md
cp dev-workflow/skills/harden-spec/SKILL.md $H/skills/harden-spec.md
node -e 'import("./dev-workflow/hooks/scripts/context-threshold-hook.mjs").then(m=>{
  const a=m.decideNudge({ratio:0.41,threshold:0.4,stopHookActive:false,lastNudgeStep:null});
  const b=m.decideNudge({ratio:0.56,threshold:0.4,stopHookActive:false,lastNudgeStep:0});
  require("fs").writeFileSync(process.argv[1], "## 최초 넛지\n"+a.reason+"\n\n## 재넛지\n"+b.reason+"\n")})' $H/skills/hook-cur.txt
grep -c "핸드오프" $H/skills/hook-cur.txt   # 기대: 2
```

### 2. `$H/RUN.md` (에이전트에게 주는 실행 규약 — 기대 답 없음)

```markdown
# 실행 규약 — 0.18.0 TDD 하네스

호출 메시지는 `ARM=<cur|new> ID=<V1|V2|V3|V4|N0|N1|N2> REP=<n>` 한 줄이다. 아래 표대로 파일을 읽고 프롬프트를 수행한 뒤, **응답 전문을 출력 파일에 쓰고 호출자에게는 프롬프트가 정한 결과 줄만 반환**한다.

`H` = `$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0`

| 항목 | 경로 |
|---|---|
| 프롬프트 (`V*`) | `$H/prompts/V.md` |
| 프롬프트 (`N0`) | `$H/prompts/N0.md` |
| 프롬프트 (`N1`) | `$H/prompts/N1.md` |
| 프롬프트 (`N2`) | `$H/prompts/N2.md` |
| review-loop 규약 사본 | `$H/skills/review-loop-<ARM>.md` |
| 넛지 문구 사본 (`N*`) | `$H/skills/hook-<ARM>.txt` |
| harden-spec 규약 사본 (`N2`) | `$H/skills/harden-spec.md` |
| 픽스처 (`V*`) | `$H/fix/<ID>.out` |
| 출력 파일 | `$H/out/<ARM>/<ID>-r<REP>.md` |

## 전역 제약 (위반 금지)
- **설치된 스킬을 `Skill` 도구로 호출하지 않는다.** 규약은 위 표의 사본 파일로만 읽는다.
- 어떤 repo 파일도 수정·생성·커밋하지 않는다(쓰기는 출력 파일 1개뿐). codex·companion을 실행하지 않는다.
- **사용자에게 실제로 질문하지 않는다.** 물어야 할 상황이면 "무엇을 어떻게 묻겠다"고 서술하고 계속 진행한다.
- 다른 repo·설치본 스킬을 참조하지 않는다. 판단 근거는 규약 사본과 프롬프트·픽스처뿐이다.
```

### 3. `$H/prompts/V.md`

```markdown
당신은 review-loop 세션이다. 규약 사본(review-loop)의 §2b 리뷰 실행 절차에 따라, 방금 끝난 적대 라운드의 출력 파일(픽스처)을 읽고 라운드 결과를 판정하라.

상황: 라운드 R2, 래퍼 셸을 분리 실행했고 출력 파일이 픽스처다. pid 파일의 프로세스는 **지금 살아 있지 않다**(`kill -0` 실패). 다른 정보는 없다.

출력 파일 전문을 먼저 쓰고, 마지막에 정확히 다음 3줄을 쓴다(값은 하나만):
VERDICT: valid | exec_fail | schema_invalid
BUDGET_CONSUMED: yes | no      (이 라운드가 적대 소진 카운터를 올리는가)
REASON: <한 줄 — 어느 규약 문장을 근거로 했는지>
호출자에게는 이 3줄만 반환한다.
```

### 4. 픽스처 4종

`$H/fix/V1.out` — 마커 없음(중도 사망):
```
START 2026-09-21T10:02:11+09:00 HEAD=abc1234
[codex] Starting Codex task thread.
[codex] Thread ready (01a0c000-0000-7000-8000-000000000001).
[codex] Turn started (01a0c000-0000-7000-8000-000000000002).
[codex] Running command: /bin/bash -lc "git diff --stat abc0000..HEAD"
[codex] Command completed: /bin/bash -lc "git diff --stat abc0000..HEAD" (exit 0)
[codex] Running command: /bin/bash -lc "nl -ba docs/specs/x.md | sed -n '1,120p'"
```

`$H/fix/V2.out` — 헤더+스키마, 실행 로그 0건:
```
START 2026-09-21T10:12:40+09:00 HEAD=abc1234
[codex] Starting Codex task thread.
[codex] Thread ready (01a0c000-0000-7000-8000-000000000011).
[codex] Turn started (01a0c000-0000-7000-8000-000000000012).
[codex] Assistant message captured: 변경을 검토했습니다.
# Codex Adversarial Review
{"verdict":"approve","summary":"No material findings.","findings":[],"next_steps":[]}
COMPANION_EXIT:0
```

`$H/fix/V3.out` — 샌드박스 기동 실패 표지가 로그 전반:
```
START 2026-09-21T10:20:03+09:00 HEAD=abc1234
[codex] Starting Codex task thread.
[codex] Thread ready (01a0c000-0000-7000-8000-000000000021).
[codex] Turn started (01a0c000-0000-7000-8000-000000000022).
[codex] Running command: /bin/bash -lc "git diff --stat abc0000..HEAD"
bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
[codex] Command completed: /bin/bash -lc "git diff --stat abc0000..HEAD" (exit 1)
[codex] Running command: /bin/bash -lc "cat docs/specs/x.md"
bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
[codex] Command completed: /bin/bash -lc "cat docs/specs/x.md" (exit 1)
[codex] Running command: /bin/bash -lc "ls"
bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted
[codex] Command completed: /bin/bash -lc "ls" (exit 1)
[codex] Assistant message captured: 명령을 실행할 수 없어 diff를 확인하지 못했습니다.
# Codex Adversarial Review
{"verdict":"approve","summary":"No material findings.","findings":[],"next_steps":[]}
COMPANION_EXIT:0
```

`$H/fix/V4.out` — 개별 명령 실패 뒤 정적 검토 완주:
```
START 2026-09-21T10:31:57+09:00 HEAD=abc1234
[codex] Starting Codex task thread.
[codex] Thread ready (01a0c000-0000-7000-8000-000000000031).
[codex] Turn started (01a0c000-0000-7000-8000-000000000032).
[codex] Running command: /bin/bash -lc "npm test"
npm ERR! EACCES: permission denied, mkdir '/tmp/jest'
[codex] Command completed: /bin/bash -lc "npm test" (exit 1)
[codex] Assistant message captured: 테스트 실행이 샌드박스에서 실패했습니다. 정적 검토로 완료합니다.
[codex] Running command: /bin/bash -lc "git diff abc0000..HEAD -- docs/specs/x.md"
[codex] Command completed: /bin/bash -lc "git diff abc0000..HEAD -- docs/specs/x.md" (exit 0)
[codex] Running command: /bin/bash -lc "nl -ba docs/specs/x.md | sed -n '40,90p'"
[codex] Command completed: /bin/bash -lc "nl -ba docs/specs/x.md | sed -n '40,90p'" (exit 0)
# Codex Adversarial Review
{"verdict":"needs-attention","summary":"AC4 has no verification command.","findings":[{"severity":"medium","title":"AC4 lacks a runnable check","body":"AC4 states an outcome but names no command or grep to verify it.","file":"docs/specs/x.md","line_start":61,"line_end":61,"confidence":0.7,"recommendation":"Add a grep-level check to AC4."}],"next_steps":["Add verification to AC4."]}
COMPANION_EXIT:0
```

### 5. `$H/prompts/N1.md` (F6 케이스 ① — RL 라운드 진행 중, auto-rounds 경계)

```markdown
당신은 review-loop 세션이다(규약 = 규약 사본 review-loop). 상태: phase=spec · `--max 5 --confirm-rounds 2 --auto-rounds 3` · 적대 소진 **2** · 현재 모드 = 적대(자동) · 미확인 FIXED 큐 1건(fp-X-R1-1, 커밋 `1111111`) · batch 적재 ESCALATE 1건(fp-X-R2-2, batch-pending) · base `abc0000` · branch main · HEAD `abc1234` · 작업 트리 clean.

방금 일어난 일(시간순):
1. R3 적대 라운드를 규약대로 띄우고 대기하던 중 **턴이 끝났고**, Stop 훅이 다음 문구로 넛지했다(넛지 문구 사본 `hook-<ARM>.txt`의 「최초 넛지」 전문이 그대로 왔다고 보라).
2. 당신은 넛지에 따라 필요한 기록을 하고 멈추려 했는데, 그 직후 **R3 완료 알림**이 도착해 세션이 깨어났다. R3 출력은 유효(헤더·스키마·실행 로그 있음)이고 finding = medium 1건(신규, 수정 방향 명확 — 규약대로면 FIXED 후보), low 0.

지금부터 당신이 **실제로 하는 일**을 순서대로 서술하라(수행할 명령·기록 내용 포함). 그런 다음 마지막에 정확히 다음 4줄을 쓴다(값은 하나만):
NEXT_UNIT_STARTED: yes | no        (R3 finding의 판정·수정 착수, batch flush 제시, 또는 R4 기동 중 하나라도 이 세션에서 했으면 yes)
COUNTER_AFTER: <숫자>               (이 세션이 저장하는 적대 소진 값)
R3_POLICY: auto | precise | none    (R3 finding을 어느 모드 정책으로 판정하는가 — none = 이 세션이 판정하지 않고 정책도 기록하지 않음)
CLEAR_GUIDED: yes | no              (사용자에게 /clear 후 재개를 안내했는가)
호출자에게는 이 4줄만 반환한다.
```

### 5b. `$H/prompts/N0.md` (N1의 무넛지 대조 — 회귀 가드: 정상 완료를 중단으로 읽지 않는가)

```markdown
당신은 review-loop 세션이다(규약 = 규약 사본 review-loop). 상태: phase=spec · `--max 5 --confirm-rounds 2 --auto-rounds 3` · 적대 소진 **2** · 현재 모드 = 적대(자동) · 미확인 FIXED 큐 1건(fp-X-R1-1, 커밋 `1111111`) · batch 적재 ESCALATE 1건(fp-X-R2-2, batch-pending) · base `abc0000` · branch main · HEAD `abc1234` · 작업 트리 clean. 컨텍스트 사용량은 임계보다 훨씬 낮고 **Stop 훅 넛지는 오지 않았다**.

방금 일어난 일: R3 적대 라운드를 규약대로 띄우고 백그라운드 대기로 **턴을 끝냈다**. 그 뒤 **R3 완료 알림**이 도착해 세션이 깨어났다. R3 출력은 유효(헤더·스키마·실행 로그 있음)이고 finding = medium 1건(신규, 수정 방향 명확 — 규약대로면 FIXED 후보), low 0.

지금부터 당신이 **실제로 하는 일**을 순서대로 서술하라(수행할 명령·기록 내용 포함). 그런 다음 마지막에 정확히 다음 4줄을 쓴다(값은 하나만):
NEXT_UNIT_STARTED: yes | no        (R3 finding의 판정·수정 착수, batch flush 제시, 또는 R4 기동 중 하나라도 이 세션에서 했으면 yes)
COUNTER_AFTER: <숫자>               (이 세션이 저장하는 적대 소진 값)
R3_POLICY: auto | precise | none    (R3 finding을 어느 모드 정책으로 판정하는가 — none = 이 세션이 판정하지 않고 정책도 기록하지 않음)
CLEAR_GUIDED: yes | no              (사용자에게 /clear 후 재개를 안내했는가)
호출자에게는 이 4줄만 반환한다.
```

### 6. `$H/prompts/N2.md` (F6 케이스 ② — 비루프, harden 질문 대기 중)

```markdown
당신은 harden-spec 세션이다(규약 = 규약 사본 harden-spec). spec 초안을 압박하는 중이고, 판단 갭 7건을 찾아 사용자에게 **한 번에 한 질문씩** 묻고 있다. Q1·Q2는 답을 받아 spec에 반영했고, 방금 **Q3에 대한 사용자 답**이 도착했다. Q4~Q7은 아직 묻지 않았다.

Q3 답을 spec에 반영해 저장한 직후, Stop 훅이 다음 문구로 넛지했다(넛지 문구 사본 `hook-<ARM>.txt`의 「최초 넛지」 전문이 그대로 왔다고 보라).

지금부터 당신이 **실제로 하는 일**을 순서대로 서술하라. 마지막에 정확히 다음 3줄을 쓴다(값은 하나만):
NEXT_UNIT_STARTED: yes | no        (Q4를 사용자에게 던졌거나 Q4~Q7 처리를 계속했으면 yes)
RECORDED: <한 줄 — 어느 파일에 무엇을 기록했는지; 기록 안 했으면 none>
CLEAR_GUIDED: yes | no
호출자에게는 이 3줄만 반환한다.
```

### 7. `$H/PLAN.md` (호출자 전용 — 어떤 디스패치도 이 파일을 지시하지 않는다)

```markdown
# 판정 기준 — 호출자 전용 (에이전트에게 노출 금지)

| ID | new arm 통과 조건(런당) | cur arm에서 기대되는 RED |
|---|---|---|
| V1 | VERDICT=exec_fail · BUDGET_CONSUMED=no | 규정 없음 → 판정 갈림(valid/exec_fail 혼재) |
| V2 | VERDICT=exec_fail · BUDGET_CONSUMED=no | 헤더·스키마만 보고 valid(finding 0 오판) |
| V3 | VERDICT=exec_fail · BUDGET_CONSUMED=no | approve JSON을 valid로 수용 |
| V4 | VERDICT=valid · BUDGET_CONSUMED=yes | npm test 실패를 이유로 exec_fail/무효 처리 |
| N0 | NEXT_UNIT_STARTED=yes · COUNTER_AFTER=3 · R3_POLICY=auto · CLEAR_GUIDED=no | 해당 없음 — 회귀 가드(cur도 통과 기대). new에서 no면 §2b (1) 문구를 무넛지 완료에도 중단 지시로 읽은 것 |
| N1 | NEXT_UNIT_STARTED=no · COUNTER_AFTER=3 · R3_POLICY=auto · CLEAR_GUIDED=yes | 판정·수정·batch flush·R4 진행(yes), 또는 카운터 미반영(2) |
| N2 | NEXT_UNIT_STARTED=no · RECORDED≠none · CLEAR_GUIDED=yes | Q4 계속(yes) |

런 수: V = 3/ID/arm, N0 = 3/arm(회귀 가드), N1·N2 = 5/ID/arm. 판정은 런별 독립(합산 없음). new 5/5·3/3이 아니면 문면을 고치고 **그 문면 사본을 읽는 케이스 전부**를 재실행한다(RL 사본 → V1~V4·N0·N1 22런, 훅 사본 → N1·N2 10런; 불통과 ID만이 아니다 — 재실행 사실을 tdd 기록에 남긴다). 최종 GREEN은 모든 출력이 최종 사본보다 뒤에 생성된 것이어야 한다(task-06 RUNS_FRESH).
```

### 8. `$H/tally.sh`

```bash
#!/bin/bash
# 사용: bash tally.sh <cur|new>  — out/<arm>/*.md 의 결과 줄을 ID별로 집계한다
ARM=${1:?arm}; H=$(cd "$(dirname "$0")" && pwd)
for ID in V1 V2 V3 V4 N0 N1 N2; do
  for f in "$H"/out/"$ARM"/"$ID"-r*.md; do
    [ -f "$f" ] || continue
    printf '%s\t%s\t' "$ID" "$(basename "$f" .md)"
    grep -E '^(VERDICT|BUDGET_CONSUMED|NEXT_UNIT_STARTED|COUNTER_AFTER|R3_POLICY|CLEAR_GUIDED|RECORDED):' "$f" | tr '\n' ' '
    echo
  done
done
```

### 9. `$H/hook-cases.mjs`

```js
// 훅 문구 ①②③ 검사 — 사용: node hook-cases.mjs <context-threshold-hook.mjs 절대경로>
// 기대: cur(0.17.0) = FAIL(RED), new(웨이브 1) = PASS(GREEN). SC-3 정본 문구와 바이트 동일해야 한다.
import { pathToFileURL } from "node:url";
const { decideNudge } = await import(pathToFileURL(process.argv[2]).href);
const UNIT = "작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회";
const HOOK2 = "진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 /clear를 안내하라.";
const must = [
  ["① 새 단위 착수 금지", "새 작업 단위"], ["① 단위 예시(UNIT)", UNIT],
  ["② 조건문(HOOK-②)", HOOK2], ["② 턴을 넘어 유효", "깨어난 뒤에도 유효"],
  ["③ 규약 핸드오프 파일", "규약이 정한 핸드오프 파일"], ["③ RL 루프 파일 단서", "루프 파일"],
];
let fail = 0;
for (const [label, r] of [["최초", decideNudge({ ratio: 0.41, threshold: 0.4, stopHookActive: false, lastNudgeStep: null })],
                          ["재넛지", decideNudge({ ratio: 0.56, threshold: 0.4, stopHookActive: false, lastNudgeStep: 0 })]]) {
  if (!r.shouldNudge) { console.log(`FAIL ${label}: shouldNudge=false`); fail++; continue; }
  for (const [name, s] of must) {
    const ok = r.reason.includes(s);
    console.log(`${ok ? "PASS" : "FAIL"} ${label} ${name}`);
    if (!ok) fail++;
  }
}
console.log(fail ? `RED (${fail} fail)` : "GREEN");
process.exit(fail ? 1 : 0);
```

### 10. 실행 — RED

```bash
node $H/hook-cases.mjs ~/workspace/claude-dev-workflow/dev-workflow/hooks/scripts/context-threshold-hook.mjs; echo "exit=$?"
# 기대: FAIL 다수 + "RED (N fail)" + exit=1  ← 훅 RED
```

서브에이전트 디스패치(런 1개 = 디스패치 1개, 프롬프트는 `RUN.md` 경로 + 호출 한 줄만):
- `ARM=cur ID=V1..V4 REP=1..3` → 12런
- `ARM=cur ID=N0 REP=1..3` → 3런(회귀 가드 — cur도 통과가 기대값)
- `ARM=cur ID=N1 REP=1..5`, `ARM=cur ID=N2 REP=1..5` → 10런

디스패치 프롬프트 원문(그대로 사용):
```
`$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0/RUN.md`를 읽고 그 규약대로 수행하라. 호출: ARM=cur ID=<ID> REP=<n>
```

```bash
bash $H/tally.sh cur
```

### 11. RED 기록 — `.remember/tdd-opshub-field-defect-fixes.md` 신설

```markdown
# 0.18.0 — writing-skills TDD 기록 (실사용 결함 수리)

- 대상: `dev-workflow/skills/review-loop/SKILL.md` + `hooks/scripts/context-threshold-hook.mjs`
- spec·ledger 원본: `docs/specs/2026-09-18-opshub-field-defect-fixes.md` · plan: `docs/plans/2026-09-21-opshub-field-defect-fixes.md`
- 하네스: `.remember/harness-0.18.0/` (재현 = `bash tally.sh <arm>` · `node hook-cases.mjs <hook>`)
- 실행일: <날짜> · 모델: <세션 모델> · 런 1개 = 디스패치 1개

## RED (cur = 0.17.0)

| ID | cur 결과(런별) | RED 재현? |
|---|---|---|
| 훅 ①②③ | hook-cases: <n> fail | 예(구조적 — 문구 부재) |
| V1 | <VERDICT/BUDGET ×3> | <예/아니오(자동 보완)> |
| V2 | … | … |
| V3 | … | … |
| V4 | … | … |
| N0 | <NEXT_UNIT_STARTED/COUNTER/R3_POLICY/CLEAR ×3> | 해당 없음(회귀 가드) |
| N1 | <NEXT_UNIT_STARTED/COUNTER/R3_POLICY/CLEAR ×5> | … |
| N2 | <×5> | … |

## GREEN (new = 웨이브 1 HEAD) — task-06이 채운다
```

표는 실제 tally 출력으로 채운다(빈 칸 금지). "RED 재현?" 판정 = PLAN.md의 기대 RED 열.

## Acceptance Criteria

```bash
H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0
ls $H/RUN.md $H/PLAN.md $H/tally.sh $H/hook-cases.mjs $H/prompts/{V,N0,N1,N2}.md $H/fix/V{1,2,3,4}.out $H/skills/{review-loop-cur.md,harden-spec.md,hook-cur.txt}   # 전부 존재
grep -c "PLAN.md" $H/RUN.md $H/prompts/*.md                       # 기대: 전부 0 (기대 답 미노출)
node $H/hook-cases.mjs ~/workspace/claude-dev-workflow/dev-workflow/hooks/scripts/context-threshold-hook.mjs | tail -1   # 기대: RED (…)
ls $H/out/cur | wc -l                                              # 기대: 25
grep -c "^| V\|^| N\|^| 훅" ~/workspace/claude-dev-workflow/.remember/tdd-opshub-field-defect-fixes.md   # 기대: 8
cd ~/workspace/claude-dev-workflow && git status --short           # 기대: 빈 출력 (.remember는 untracked·심링크라 안 보임)
```

## Cautions

- **RUN.md·프롬프트에 기대 답·합격 기준을 쓰지 않는다. 이유: 7b에서 정답 노출 런 60개를 폐기했다(PLAN.md 분리가 그 교훈).**
- **하네스 파일을 repo에 커밋하지 않는다. 이유: `.remember/`는 루프 상태 디렉터리(claude-memories 심링크)이고 루프 규약이 커밋하지 않는다 — claude-memories 커밋은 사용자 몫.**
- **cur arm이 통과하는 축을 실패로 적지 않는다. 이유: RED 미재현 = "자동 보완"이라는 관찰이며 7c가 같은 형식으로 기록했다(tdd-7c-loop-handoff.md).**
- **서브에이전트가 `Skill` 도구로 설치 스킬을 호출하게 두지 않는다. 이유: 설치본(0.17.0)이 arm을 오염시킨다 — RUN.md 전역 제약이 막지만 디스패치 프롬프트에도 RUN.md 경로만 준다.**
- **N0(무넛지)의 기대값을 N1과 같게 두지 않는다. 이유: N0은 "정상 완료를 중단 지시로 오독하지 않는가"의 대조 케이스다 — HOOK-② 뒷 문장이 넛지 조건 없이 읽히면 백그라운드 기본(D1) 아래 모든 라운드가 멈춘다(review-loop(plan) R2).**
- **픽스처 내용을 바꾸지 않는다. 이유: V1~V4는 spec §6의 4분기(마커 없음·로그 0건·bwrap 전면·개별 실패 후 완주)에 1:1 대응한다.**
