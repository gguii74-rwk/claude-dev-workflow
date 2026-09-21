# task-06 — 웨이브 1 GREEN + AC1~3·5·6·8(RL) grep + AC9 규모

**목적**: 웨이브 1(RL 전 편집 + 훅) 완료 HEAD를 `new` arm으로 하네스에 돌려 GREEN을 기록하고, AC grep 대조표를 채우고, `wc -c`로 AC9(≤65,994B)를 확정한다. 초과하면 이 트랙이 더한 문장 안에서 압축한다(상한 불변).

## Files

- Create: `$H/skills/review-loop-new.md` · `$H/skills/hook-new.txt` · `$H/out/new/*.md`(22런)
- Modify: `.remember/tdd-opshub-field-defect-fixes.md`(GREEN 절 + AC 대조표)
- Modify(조건부): `dev-workflow/skills/review-loop/SKILL.md` — AC9 초과 시 압축만
- Test: `$H/hook-cases.mjs` · `$H/tally.sh new`

## Prep

- spec §5 AC1·AC2·AC3·AC5·AC6·AC8·AC9, §6. 엔트리포인트 SC-3~SC-7. task-01의 RED 기록(`.remember/tdd-opshub-field-defect-fixes.md`)과 `$H/PLAN.md`(호출자 전용).

## Deps

task-05.

## Steps

### 1. new arm 사본

```bash
H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0
cd ~/workspace/claude-dev-workflow && git status --short | grep -v '^??' ; echo "clean? (위 출력 없어야 함)"
cp dev-workflow/skills/review-loop/SKILL.md $H/skills/review-loop-new.md
node -e 'import("./dev-workflow/hooks/scripts/context-threshold-hook.mjs").then(m=>{
  const a=m.decideNudge({ratio:0.41,threshold:0.4,stopHookActive:false,lastNudgeStep:null});
  const b=m.decideNudge({ratio:0.56,threshold:0.4,stopHookActive:false,lastNudgeStep:0});
  require("fs").writeFileSync(process.argv[1], "## 최초 넛지\n"+a.reason+"\n\n## 재넛지\n"+b.reason+"\n")})' $H/skills/hook-new.txt
grep -c '새 작업 단위' $H/skills/hook-new.txt    # 2
```

### 2. 훅 GREEN

```bash
node $H/hook-cases.mjs "$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" | tail -1   # GREEN
```

### 3. new arm 22런 디스패치(런 1개 = 디스패치 1개)

디스패치 프롬프트 원문:
```
`$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0/RUN.md`를 읽고 그 규약대로 수행하라. 호출: ARM=new ID=<ID> REP=<n>
```
- `ID=V1..V4 REP=1..3`(12런) · `ID=N1 REP=1..5` · `ID=N2 REP=1..5`(10런).
```bash
bash $H/tally.sh new
```
판정은 `$H/PLAN.md` 표의 new 통과 조건으로 런별 독립. **불통과 런이 있으면**: 그 런의 출력 전문에서 어느 문장을 오독했는지 찾아 RL 문면을 고치고(압축 예산 안에서), 그 ID만 재실행한다. 재실행 사실·수정 커밋을 tdd 기록에 남긴다.

### 4. AC grep 대조표(RL 부분)

```bash
F=dev-workflow/skills/review-loop/SKILL.md
echo "AC1"; for s in '/codex:status' 'job id' 'setsid' ; do printf '%s=%s ' "$s" "$(grep -c -- "$s" $F)"; done; echo   # 전부 0
for s in 'COMPANION_EXIT' 'spawn(' 'kill -0' 'pgrep -f' 'run_in_background' 'Thread ready' 'status --all' 'cancel <id>' '\-\-help' '\-\-prompt-file' '1\.0\.6' '추적 파일 편집 금지'; do printf '%s=%s ' "$s" "$(grep -c -- "$s" $F)"; done; echo   # 전부 ≥1
echo "AC2"; for s in 'cache/openai-codex' 'sort -V' 'ls -d'; do printf '%s=%s ' "$s" "$(grep -c -- "$s" $F)"; done; echo   # 전부 0
grep -c 'installed_plugins.json' $F; grep -c 'project/local > user > managed' $F; grep -c 'RESOLVE_FAIL' $F   # ≥1 · 1 · ≥1
echo "AC3"; grep -c '실행 로그 ≥1건' $F; grep -c '개별 명령 실패는 무효 사유가 아니다' $F; grep -c 'focus 인자 미부착' $F; grep -c '가드 블록 미포함 — focus 인자는 고정 줄로 항상 부착' $F   # 1 · 1 · 0 · 1
echo "AC5"; grep -c '순서 = 수정 커밋 먼저' $F; grep -c 'SHA 매핑 1줄' $F   # 1 · 1
echo "AC6"; grep -c '진행 중 라운드 분기(경로 ①' $F; grep -c '수신 시점 모드' $F; grep -c '작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회' $F dev-workflow/hooks/scripts/context-threshold-hook.mjs   # 1 · 2 · 각 1
echo "AC8"; grep -c 'git rev-parse --git-dir)/index.lock' $F; grep -c 'task 파일·런북·요약절' $F; grep -c 'merge하지 않는다' $F; grep -c 'no-AI-trace 규칙을 가지면' $F   # 각 1
echo "AC7(RL)"; grep -c '40%' $F   # 0
```
결과를 tdd 기록의 `## AC 대조(RL·훅)` 표에 "AC / grep / 기대 / 실측"으로 적는다.

### 5. AC9 규모

```bash
wc -c dev-workflow/skills/review-loop/SKILL.md    # ≤ 65,994
```
**초과 시 압축 후보(이 트랙이 더한 문장만, 위에서부터)**: ① §2b 첫 문단의 근거 나열을 "실행 신뢰성 사고 11건(08-03~09-17) + 플러그인 repo 1건(macOS 세션 분리 명령 부재)"로 축약 ② §2b ⑤의 "companion `--resume-last`는 포그라운드 `task`에서 실패한다(state 미기록)." 삭제 ③ §확인 모드 실행 두 번째 불릿의 "(§2b ⑤)" 참조만 남기고 스레드 재개 설명 삭제 ④ §2b ①의 "(doctor와 같은 근거)"·"버전 게이트는 확인 모드용(…)" 삭제 ⑤ F5 문장의 규모 수치 "(08-11~09-14 ≈55건)" 삭제. 기존(0.17.0) 문장은 압축 대상이 아니다. 압축 후 §4 grep(단계 4)을 다시 돌려 0건 요건이 그대로인지 확인하고 `fix(review-loop): AC9 압축 — …`로 커밋한다.

### 6. tdd 기록 GREEN 절 + 커밋

`.remember/tdd-opshub-field-defect-fixes.md`의 `## GREEN (new = 웨이브 1 HEAD)` 아래에 표를 채운다(형식 = RED 표와 동일 열 + "판정" 열: `GREEN · 지침 효과 확정` / `GREEN · 효과 미확인(자동 보완)` / `GREEN · 부분 효과` — cur 결과와 대비해 적는다). 이어서 `## AC 대조(RL·훅)`·`## AC9` 절(`wc -c` 값, 압축 여부).

repo 커밋은 압축이 있었을 때만(단계 5). 엔트리포인트 task 표 outcome에는 "V 12/12 · N1 5/5 · N2 5/5 · 훅 GREEN · RL <bytes>B" 한 줄을 적는다(디스패처가 완료 확인 시).

## Acceptance Criteria

```bash
H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0
ls $H/out/new | wc -l                                                    # 22
bash $H/tally.sh new | grep -c 'V[1-3].*VERDICT: exec_fail'              # 9
bash $H/tally.sh new | grep -c 'V4.*VERDICT: valid'                      # 3
bash $H/tally.sh new | grep -c 'N1.*NEXT_UNIT_STARTED: no'               # 5
bash $H/tally.sh new | grep -c 'N1.*R3_POLICY: auto'                     # 5
bash $H/tally.sh new | grep -c 'N2.*NEXT_UNIT_STARTED: no'               # 5
node $H/hook-cases.mjs "$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" | tail -1   # GREEN
[ "$(wc -c < dev-workflow/skills/review-loop/SKILL.md)" -le 65994 ] && echo AC9_OK
grep -c '^## GREEN\|^## AC 대조\|^## AC9' ~/workspace/claude-dev-workflow/.remember/tdd-opshub-field-defect-fixes.md   # 3
git status --short | grep -v '^??' | wc -l                               # 0 (tracked 변경 없음)
```

## Cautions

- **new arm이 cur 결과와 같아도(자동 보완) 문면을 "더 강하게" 고치지 않는다. 이유: L1 — 실측에서 통과한 축은 그대로 기록한다(7c 형식).**
- **AC9 초과를 상한 상향으로 풀지 않는다. 이유: D34 — 압축 후보에서 줄인다.**
- **압축으로 SC-3·SC-4 정본 문자열이나 0건 요건(`setsid`·`/codex:status`·`sort -V`)을 건드리지 않는다. 이유: task-02~05 AC가 그 문자열을 전제한다.**
- **하네스 산출(`out/new`)·tdd 기록을 repo에 커밋하지 않는다. 이유: `.remember/` 규약 — claude-memories 커밋은 사용자 몫.**
- **불통과 런을 "모델 편차"로 넘기지 않는다. 이유: 5/5·3/3이 판정 기준(PLAN.md) — 문면을 고치고 그 ID만 재실행한다.**
