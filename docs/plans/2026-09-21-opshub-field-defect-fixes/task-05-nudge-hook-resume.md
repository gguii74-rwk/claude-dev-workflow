# task-05 — 넛지 훅 문구 ①②③ + RL §2i 진행 중 라운드 분기 (F6, D1·D24~D27)

**목적**: Stop 훅 넛지의 의미를 "현재 작업 단위만 마무리, 새 단위 착수 금지"로 명시하고(①②③, 최초·재넛지 동일), review-loop §2i에 "라운드가 진행 중일 때" 분기(대기 → 순서 0 → 미판정 기록 → 1~4 + 재개 계약)를 넣는다. 훅은 코드라 `hook-cases.mjs`로 RED→GREEN, RL은 문면(task-06 N1·N2 GREEN).

## Files

- Modify: `dev-workflow/hooks/scripts/context-threshold-hook.mjs` — `decideNudge` 안 `const pct` 이후 `return { … }`까지(0.17.0 기준 75~97행) → §A. 파일 헤더 주석 3행(2~4행)에 1줄 추가.
- Modify: `dev-workflow/skills/review-loop/SKILL.md`
  - §2i 세 경로 문단(`① 컨텍스트 사용량이 임계 이상(…) · ② … · ③ …` 행) **바로 다음 빈 줄 뒤**에 §B 문단 삽입(순서 표 앞)
  - `` - `## 다음 액션` = 재개 명령 + 다음 단계·트랙 지목. `` 행 → §C
- Test: `$H/hook-cases.mjs`(task-01) — RED → GREEN

## Prep

- spec §1 F6 원인 사슬, §3 F6 1~3, §4 D1·D24·D25·D26·D27, AC6, spec ledger fp-OF-R1-1·R2-1(재개 계약 근거). 엔트리포인트 SC-3(UNIT·HOOK-② 바이트 동일)·SC-6·SC-7.
- 현행 확인: `sed -n '75,97p' dev-workflow/hooks/scripts/context-threshold-hook.mjs`(`const pct = …`로 시작, `};`로 끝) · `grep -n '임계 이상(Stop 훅 넛지\|`## 다음 액션` = 재개 명령' dev-workflow/skills/review-loop/SKILL.md`(각 1건).

## Deps

task-04.

## Steps

### 1. RED 확인(코드)

```bash
H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0
node $H/hook-cases.mjs "$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" | tail -1    # 기대: RED (…)
```

### 2. §A — 훅 `decideNudge` 문구 (75~97행 교체)

원문 75~97행(`  const pct = Math.round(ratio * 100);` ~ `  };`)을 다음으로 교체한다:
```js
  const pct = Math.round(ratio * 100);
  const thr = Math.round(threshold * 100);
  // 재넛지 문구는 "이전에 안내했다"는 사실을 더하는 것이므로, 구간 번호가 아니라
  // 실제 넛지 이력(last)으로 가른다. 통상 경로(40 → 55 → …)에서는 k >= 1과 같지만,
  // 세션이 처음부터 70%에서 시작하면 k >= 1이면서도 안내한 적은 없다.
  const renudge = last !== null;
  const head = renudge
    ? `컨텍스트 사용량이 약 ${pct}%입니다. 임계(${thr}%)에서 한 번 안내했고 그 뒤로 더 늘었습니다.`
    : `컨텍스트 사용량이 약 ${pct}%로 임계(${thr}%)를 넘었습니다.`;
  // 넛지의 의미 = 현재 작업 단위만 마무리하고 새 단위를 시작하지 않는다(F6). 단위 예시와 ② 조건문은
  // review-loop §2b·§2i와 바이트 동일해야 한다(정본 = review-loop). 훅은 진행 중 작업을 알 수 없으므로
  // ②는 조건문이고, 백그라운드 대기가 턴을 끝내므로 "완료 알림으로 깨어난 뒤에도 유효"를 명시한다.
  // 최초·재넛지에 동일하게 붙인다(7a D6: 재넛지 = 지시 동일 + 사실 추가).
  const unit =
    `(0) 넛지 이후 새 작업 단위를 시작하지 마세요 — 작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회(phase·루프 전체가 아닙니다). ` +
    `진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 /clear를 안내하라. ` +
    `이 지시는 이 턴에서 끝나지 않고 완료 알림으로 깨어난 뒤에도 유효합니다. `;
  // 핸드오프 파일 = repo·트랙 규약이 정한 파일(기본 .remember/remember.md). review-loop 세션은 진행 중 상태를
  // 공유 remember.md가 아니라 자기 루프 파일에 쓴다 — 단서가 없으면 이 넛지가 그 규정을 덮어써 트랙 인계가 유실된다.
  const handoff = renudge
    ? `(1) repo·트랙 규약이 정한 핸드오프 파일(기본 .remember/remember.md)에 현재 작업 상태(무엇을 하던 중인지·다음 할 일·미해결 항목)를 핸드오프로 작성하세요 — 이미 작성했다면 그 뒤의 진행분을 반영해 갱신하세요. review-loop 실행 중이면 그 스킬의 루프 파일에 그 스킬의 핸드오프 규정대로 쓰세요. `
    : `(1) repo·트랙 규약이 정한 핸드오프 파일(기본 .remember/remember.md)에 현재 작업 상태(무엇을 하던 중인지·다음 할 일·미해결 항목)를 핸드오프로 작성하세요. review-loop 실행 중이면 그 스킬의 루프 파일에 그 스킬의 핸드오프 규정대로 쓰세요. `;
  return {
    shouldNudge: true,
    nextStep: current,
    reason:
      `${head} 멈추기 전에: ` +
      unit +
      handoff +
      `(2) 사용자에게 "이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요"라고 안내하세요. ` +
      `자가 /clear는 불가하므로 실제 초기화는 사용자가 합니다.`,
  };
```
파일 헤더 주석 4행(`// 넛지는 1회가 아니라 15%p 구간마다 재발화한다(…)`) 바로 아래에 1줄 추가:
```js
// 넛지의 의미는 "현재 작업 단위만 마무리, 새 단위 착수 금지"이며 백그라운드 완료 알림으로 깨어난 뒤에도 유효하다(F6).
```

### 3. GREEN 확인(코드)

```bash
node $H/hook-cases.mjs "$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs"; echo "exit=$?"   # 기대: 전부 PASS + GREEN + exit=0
node -e 'import("./dev-workflow/hooks/scripts/context-threshold-hook.mjs").then(m=>{for(const [r,l] of [[0.39,null],[0.40,null],[0.54,0],[0.55,0],[0.20,3],[0.85,1]]){const x=m.decideNudge({ratio:r,threshold:0.4,stopHookActive:false,lastNudgeStep:l});console.log(r,l,x.shouldNudge,x.nextStep)}})'
# 기대(7a 회귀 — 판정 로직 불변): 0.39 null false null / 0.4 null true 0 / 0.54 0 false 0 / 0.55 0 true 1 / 0.2 3 false null / 0.85 1 true 3
echo '{"stop_hook_active":true,"transcript_path":"/nonexistent","session_id":"x"}' | node dev-workflow/hooks/scripts/context-threshold-hook.mjs; echo "exit=$?"   # 기대: 출력 없음, exit=0
```

### 4. §B — RL §2i 진행 중 라운드 분기 삽입

`① 컨텍스트 사용량이 임계 이상(Stop 훅 넛지 — …) · ② … · ③ …` 행과 그 다음 빈 줄 **뒤**(즉 `| 순서 | 동작 |` 표 **앞**)에 다음 문단 + 빈 줄을 삽입한다:
```markdown
**진행 중 라운드 분기(경로 ①에서 라운드가 백그라운드로 도는 중이면)** — 새 단위를 시작하지 않는다. **작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회**(phase·루프 전체가 아니다). 순서: 응답 수신까지 대기(완료 알림으로 깨어난다 — 완료 전 /clear 금지 = §2b (1)) → **순서 0**(§2j 카운터 반영 — **응답 수신 사실만, §2j 표 그대로**: 일반 예산 라운드만 +1(확인은 완전 응답일 때만 — 완전성은 첨부 큐 fingerprint 대조라 판정 없이 확인된다), 예약분은 불변) → 결과를 `## 미해결 ledger`에 **미판정**으로 기록 → 순서 1~4. 판정·수정·다음 라운드(batch flush 포함)는 재개 세션 몫. **재개 계약**: 판정 정책 = **수신 시점 모드**(카운터 증가 **전** 소진으로 정해진 자동/정밀·적대/확인) — 재개 세션은 `## 다음 액션`의 그 모드로 §2c·§2d를 처리하고 **카운터를 다시 올리지 않는다**. 결과 의존 전이(score·전환 신호·batch flush·확인 결과 처리)는 판정 뒤 확정 — 예: auto-rounds=3에서 R3 응답 수신 후 중단하면 소진=3이 저장되지만 R3 판정은 **자동 모드**로 하고 그 뒤 flush → 정밀(중단 없는 경로와 같다). 예약분 라운드 중단도 두 카운터 불변·후속 전이 동일. **새 필드는 없다** — /clear 강행·대기 사망 뒤 완료된 고아 라운드는 재실행(응답 미수신 = 예산 미소모).
```

### 5. §C — `## 다음 액션` 정의 행 교체

원문:
```
- `## 다음 액션` = 재개 명령 + 다음 단계·트랙 지목.
```
교체:
```
- `## 다음 액션` = 재개 명령 + 다음 단계·트랙 지목. 진행 중 라운드 분기로 중단했으면 **수신 라운드 번호·종류(일반/예약분)·판정 정책(수신 시점 모드)·미처리 단계**를 함께 적는다.
```

### 6. 자기 점검 + 커밋

```bash
F=dev-workflow/skills/review-loop/SKILL.md; K=dev-workflow/hooks/scripts/context-threshold-hook.mjs
grep -c '작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회' $F $K    # 각 1 (SC-3 UNIT 바이트 동일)
grep -c '진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 /clear를 안내하라.' $F $K   # RL 1 · 훅 1
grep -c '수신 시점 모드' $F                                              # 2 (분기 + 다음 액션)
grep -c '진행 중 라운드 분기' $F                                          # ≥2 (§2b ③ 참조 + §2i 정의)
sed -n '/^- `## 현재` = /p' $F | grep -c 'phase / 적대 라운드 소진 카운트 / 확인 라운드 소진 카운트 / 현재 모드 / 복귀 사용 여부'   # 1 (필드 목록 불변 D26)
wc -c $F                                                                 # 소프트 예산 ≤ 68,500 (SC-7 — 합성값 68,378; AC9 하드 상한 69,066은 task-06)
git add $F $K
git commit -m "fix(hook,review-loop): 넛지 = 현재 작업 단위만 마무리(①②③ 최초·재넛지 동일, 규약 핸드오프 파일·루프 파일 단서) + §2i 진행 중 라운드 분기(대기→순서 0→미판정 기록→1~4, 재개 계약: 수신 시점 모드·카운터 재증가 금지·예약분 불변) (F6)"
```

## Acceptance Criteria

```bash
H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0
node $H/hook-cases.mjs "$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" | tail -1     # GREEN
F=dev-workflow/skills/review-loop/SKILL.md
grep -c '진행 중 라운드 분기(경로 ①' $F        # 1  (AC6 — 분기 존재)
grep -c '카운터를 다시 올리지 않는다' $F         # 1  (AC6 — 재개 계약)
grep -c 'auto-rounds=3에서 R3' $F               # 1  (AC6 — 경계 예시)
grep -c '예약분 라운드 중단도 두 카운터 불변' $F  # 1  (AC6 — 예약분)
grep -c '새 필드는 없다' $F                       # 1  (D26)
grep -n '^| \*\*0\*\* |' $F | wc -l              # 1  (순서 표 0~4 불변)
[ "$(wc -c < $F)" -le 68500 ] && echo SIZE_OK
git log -1 --format=%B | grep -ciE 'co-authored|generated with|claude-session'   # 0
```

## Cautions

- **`decideNudge`의 판정 로직(`current`·`due`·reset·`nextStep`)을 건드리지 않는다. 이유: 7a D4(15%p)·주기 재초기화는 D25로 불변 — 문구만 바꾼다. 단계 3의 회귀 출력이 다르면 되돌린다.**
- **② 문구를 "-세요"체로 다듬지 않는다. 이유: RL §2b의 "훅 ②와 동일" 문구와 바이트 동일해야 한다(SC-3) — RL이 정본이다.**
- **§2i 순서 표(0~4)와 `## 현재` 필드 목록을 바꾸지 않는다. 이유: C-4 D26 순서·D14 동일 목록·이 트랙 D26 필드 불변 — 분기는 표 앞에 "대기·기록"을 더할 뿐이다.**
- **PreToolUse 훅이나 넛지 플래그 검사 코드를 추가하지 않는다. 이유: D25 — 문구만.**
- **RL:337 문면(task-04가 바꾼 "임계 이상")을 다시 고치지 않는다. 이유: 같은 문단이지만 task-04의 diff다 — 여기서는 그 뒤에 삽입만 한다.**
