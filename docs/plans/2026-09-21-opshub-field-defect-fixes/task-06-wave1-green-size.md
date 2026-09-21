# task-06 — 웨이브 1 GREEN + AC1~3·5·6·8(RL) grep + AC9 규모

**목적**: 웨이브 1(RL 전 편집 + 훅) 완료 HEAD의 RL 문면을 **먼저 확정**(AC grep + AC9 `wc -c` ≤69,066B, 초과 시 압축·커밋)한 뒤, 그 확정 문면의 사본을 `new` arm으로 하네스에 돌려 GREEN을 기록한다. 순서가 반대면(하네스 먼저 → 압축) GREEN 증거와 배포 문면이 달라진다(review-loop(plan) R1).

## Files

- Create: `$H/skills/review-loop-new.md` · `$H/skills/hook-new.txt` · `$H/out/new/*.md`(25런)
- Modify: `.remember/tdd-opshub-field-defect-fixes.md`(GREEN 절 + AC 대조표)
- Modify(조건부): `dev-workflow/skills/review-loop/SKILL.md` — AC9 초과 시 압축만
- Test: `$H/hook-cases.mjs` · `$H/tally.sh new`

## Prep

- spec §5 AC1·AC2·AC3·AC5·AC6·AC8·AC9, §6. 엔트리포인트 SC-3~SC-7. task-01의 RED 기록(`.remember/tdd-opshub-field-defect-fixes.md`)과 `$H/PLAN.md`(호출자 전용).

## Deps

task-05.

## Steps

### 1. 훅 GREEN

```bash
H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0
cd ~/workspace/claude-dev-workflow && git status --short | grep -v '^??' ; echo "clean? (위 출력 없어야 함)"
node $H/hook-cases.mjs "$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" | tail -1   # GREEN
```

### 2. AC grep 대조표(RL 부분)

```bash
F=dev-workflow/skills/review-loop/SKILL.md
echo "AC1"; for s in '/codex:status' 'job id' 'setsid' ; do printf '%s=%s ' "$s" "$(grep -c -- "$s" $F)"; done; echo   # 전부 0
for s in 'COMPANION_EXIT' 'spawn(' 'kill -0' 'pgrep -f' 'run_in_background' 'Thread ready' 'status --all' 'cancel <id>' '\-\-help' '\-\-prompt-file' '1\.0\.6' '추적 파일 편집 금지'; do printf '%s=%s ' "$s" "$(grep -c -- "$s" $F)"; done; echo   # 전부 ≥1
echo "AC2"; for s in 'cache/openai-codex' 'sort -V | tail' 'ls -d'; do printf '%s=%s ' "$s" "$(grep -c -- "$s" $F)"; done; echo   # 전부 0 — AC2의 `sort -V` = glob 최신 정렬(`| tail`); SC-4의 `sort -V | head -1` 버전 비교는 대상 아님
grep -c 'installed_plugins.json' $F; grep -c 'project/local > user > managed' $F; grep -c 'RESOLVE_FAIL' $F   # ≥1 · 1 · ≥1
echo "AC3"; grep -c '실행 로그 ≥1건' $F; grep -c '개별 명령 실패는 무효 사유가 아니다' $F; grep -c 'focus 인자 미부착' $F; grep -c '가드 블록 미포함 — focus 인자는 고정 줄로 항상 부착' $F   # 1 · 1 · 0 · 1
echo "AC5"; grep -c '순서 = 수정 커밋 먼저' $F; grep -c 'SHA 매핑 1줄' $F   # 1 · 1
echo "AC6"; grep -c '진행 중 라운드 분기(경로 ①' $F; grep -c '수신 시점 모드' $F; grep -c '작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회' $F dev-workflow/hooks/scripts/context-threshold-hook.mjs   # 1 · 2 · 각 1
echo "AC8"; grep -c 'git rev-parse --git-dir)/index.lock' $F; grep -c 'task 파일·런북·요약절' $F; grep -c 'merge하지 않는다' $F; grep -c 'no-AI-trace 규칙을 가지면' $F   # 각 1
echo "AC7(RL)"; grep -c '40%' $F   # 0
```
결과를 tdd 기록의 `## AC 대조(RL·훅)` 표에 "AC / grep / 기대 / 실측"으로 적는다.

### 3. AC9 규모 — 문면 확정

```bash
wc -c dev-workflow/skills/review-loop/SKILL.md    # ≤ 69,066 (D34 2026-09-22 갱신)
```
plan 합성값(SC-7)보다 크면 task-02~05 교체문을 그대로 붙이지 않은 것이다 — 먼저 diff로 원인을 찾는다. **그래도 초과하면 압축 후보(이 트랙이 더한 문장만, 위에서부터)**: ① §2b 첫 문단의 실측 괄호 삭제 ② §2b ⑤의 "(옵션은 `resume` 앞)"·"(ephemeral 스레드)" 삭제 ③ §기결정 가드 고정 첫 줄 불릿의 "(실사례: …)" 삭제 ④ F5 문장의 "(같은 문서에 … 제거)" 괄호 삭제 ⑤ §2i 분기의 "예: auto-rounds=3에서 R3 …" 예시를 한 절로 축약(`auto-rounds=3에서 R3` 문자열은 유지). 기존(0.17.0) 문장은 압축 대상이 아니다. 압축 후 단계 2 grep을 다시 돌려 0건·1건 요건이 그대로인지 확인하고 `fix(review-loop): AC9 압축 — …`로 커밋한다. **이 단계 뒤 RL은 이 task에서 더 바뀌지 않는다**(단계 4의 불통과 수정 제외).

### 4. new arm 사본 — 확정 문면에서

```bash
cp dev-workflow/skills/review-loop/SKILL.md $H/skills/review-loop-new.md
cmp -s dev-workflow/skills/review-loop/SKILL.md $H/skills/review-loop-new.md && echo COPY_SYNC
node -e 'import("./dev-workflow/hooks/scripts/context-threshold-hook.mjs").then(m=>{
  const a=m.decideNudge({ratio:0.41,threshold:0.4,stopHookActive:false,lastNudgeStep:null});
  const b=m.decideNudge({ratio:0.56,threshold:0.4,stopHookActive:false,lastNudgeStep:0});
  require("fs").writeFileSync(process.argv[1], "## 최초 넛지\n"+a.reason+"\n\n## 재넛지\n"+b.reason+"\n")})' $H/skills/hook-new.txt
grep -c '새 작업 단위' $H/skills/hook-new.txt    # 2
```

### 5. new arm 25런 디스패치(런 1개 = 디스패치 1개)

디스패치 프롬프트 원문:
```
`$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0/RUN.md`를 읽고 그 규약대로 수행하라. 호출: ARM=new ID=<ID> REP=<n>
```
- `ID=V1..V4 REP=1..3`(12런) · `ID=N0 REP=1..3`(3런, 무넛지 회귀 가드) · `ID=N1 REP=1..5` · `ID=N2 REP=1..5`(10런).
```bash
bash $H/tally.sh new
```
판정은 `$H/PLAN.md` 표의 new 통과 조건으로 런별 독립. **불통과 런이 있으면**: 그 런의 출력 전문에서 어느 문장을 오독했는지 찾아 RL 문면을 고치고(압축 예산 안에서) 커밋 → **단계 2·3을 다시 돌려 grep·AC9를 재확인** → **단계 4의 `cp`·`cmp`로 사본을 재생성**(하네스는 사본만 읽으므로 재생성 없이는 수정 효과를 검증하지 못한다) → **재실행 범위 = 바뀐 사본을 읽는 케이스 전부**: RL 사본이 바뀌면 `rm $H/out/new/{V1,V2,V3,V4,N0,N1}-r*.md` 후 그 22런 전부(불통과 ID만이 아니다 — 예: N1을 강화한 문면이 무넛지 N0을 중단시키는 교차 회귀는 이전 문면의 N0 결과로는 안 보인다), 훅이 바뀌면 `hook-new.txt` 재생성 후 N1·N2 10런. N2는 RL 사본을 읽지 않으므로 RL만 바뀌었으면 유지. 재실행 사실·수정 커밋을 tdd 기록에 남긴다.

### 6. tdd 기록 GREEN 절 + 커밋

`.remember/tdd-opshub-field-defect-fixes.md`의 `## GREEN (new = 웨이브 1 HEAD)` 아래에 표를 채운다(형식 = RED 표와 동일 열 + "판정" 열: `GREEN · 지침 효과 확정` / `GREEN · 효과 미확인(자동 보완)` / `GREEN · 부분 효과` — cur 결과와 대비해 적는다). 이어서 `## AC 대조(RL·훅)`·`## AC9` 절(`wc -c` 값, 압축 여부, **사본 `cmp` 결과 = 검증한 문면과 HEAD 문면의 동일성**, **RUNS_FRESH = 모든 출력이 최종 사본보다 최신**).

repo 커밋은 압축·불통과 수정이 있었을 때만(단계 3·5). 엔트리포인트 task 표 outcome에는 "V 12/12 · N0 3/3 · N1 5/5 · N2 5/5 · 훅 GREEN · RL <bytes>B · COPY_SYNC · RUNS_FRESH" 한 줄을 적는다(디스패처가 완료 확인 시).

## Acceptance Criteria

```bash
H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0
ls $H/out/new | wc -l                                                    # 25
bash $H/tally.sh new | grep -c 'V[1-3].*VERDICT: exec_fail'              # 9
bash $H/tally.sh new | grep -c 'V4.*VERDICT: valid'                      # 3
bash $H/tally.sh new | grep -c 'N0.*NEXT_UNIT_STARTED: yes'              # 3 (무넛지 완료 = 정상 진행)
bash $H/tally.sh new | grep -c 'N0.*CLEAR_GUIDED: no'                    # 3
bash $H/tally.sh new | grep -c 'N1.*NEXT_UNIT_STARTED: no'               # 5
bash $H/tally.sh new | grep -c 'N1.*R3_POLICY: auto'                     # 5
bash $H/tally.sh new | grep -c 'N2.*NEXT_UNIT_STARTED: no'               # 5
node $H/hook-cases.mjs "$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" | tail -1   # GREEN
[ "$(wc -c < dev-workflow/skills/review-loop/SKILL.md)" -le 69066 ] && echo AC9_OK
cmp -s dev-workflow/skills/review-loop/SKILL.md $H/skills/review-loop-new.md && echo COPY_SYNC   # GREEN이 검증한 사본 = HEAD 문면
[ -z "$(find $H/out/new -name '*.md' ! -newer $H/skills/review-loop-new.md)" ] && [ -z "$(find $H/out/new -name 'N[12]-r*.md' ! -newer $H/skills/hook-new.txt)" ] && echo RUNS_FRESH   # 모든 출력이 최종 사본(RL·훅)보다 뒤에 생성 — 이전 문면 결과 혼입 없음
grep -c '^## GREEN\|^## AC 대조\|^## AC9' ~/workspace/claude-dev-workflow/.remember/tdd-opshub-field-defect-fixes.md   # 3
git status --short | grep -v '^??' | wc -l                               # 0 (tracked 변경 없음)
```

## Cautions

- **new arm이 cur 결과와 같아도(자동 보완) 문면을 "더 강하게" 고치지 않는다. 이유: L1 — 실측에서 통과한 축은 그대로 기록한다(7c 형식).**
- **AC9 초과를 상한 상향으로 풀지 않는다. 이유: D34(+7KB, 2026-09-22 실측 갱신 — 재갱신 없음) — 압축 후보에서 줄인다.**
- **압축으로 SC-3·SC-4 정본 문자열이나 0건 요건(`setsid`·`/codex:status`·`sort -V | tail`)을 건드리지 않는다. 이유: task-02~05 AC가 그 문자열을 전제한다.**
- **하네스 25런을 AC9 확정(단계 3) 전에 돌리지 않고, RL을 고친 뒤 사본 재생성 없이 재실행하지 않는다. 이유: 하네스는 `review-loop-new.md` 사본만 읽는다 — 사본과 HEAD가 다르면 GREEN이 배포 문면의 증거가 아니다(review-loop(plan) R1).**
- **하네스 산출(`out/new`)·tdd 기록을 repo에 커밋하지 않는다. 이유: `.remember/` 규약 — claude-memories 커밋은 사용자 몫.**
- **불통과 런을 "모델 편차"로 넘기지 않는다. 이유: 5/5·3/3이 판정 기준(PLAN.md) — 문면을 고치고 그 사본을 읽는 케이스 전부를 재실행한다.**
- **문면을 고친 뒤 불통과 ID만 재실행하지 않는다. 이유: 다른 ID의 이전 문면 결과가 GREEN에 섞여 서로 다른 문면의 결과로 25런 통과를 선언하게 된다 — COPY_SYNC는 사본↔HEAD만 보고 출력의 신선도는 RUNS_FRESH가 본다(review-loop(plan) R4).**
