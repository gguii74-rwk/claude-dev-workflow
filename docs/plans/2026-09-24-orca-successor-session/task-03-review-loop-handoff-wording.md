# task-03 — RL §2b (1) 인계 문장 + §2i 표 3행 경로 ① 조건화 (F3, D12 · R5-1)

**목적**: review-loop SKILL.md에서 (a) §2b 진행 중 금지 (1)의 인용문을 훅 (0)과 **바이트 동일**한 SC-2 HOOK-②로 바꾸고, (b) §2i 순서 표 3행의 재개 안내를 **경로 ①(컨텍스트 넛지)에서만** 넛지 (2)의 인계 절차로 조건화한다 — 오르카면 후계 스폰(재개 프롬프트에 루프 파일 경로 + `/review-loop --resume`), 오르카 밖이면 현행 안내. 경로 ②·③은 현행 수동 재개 그대로(사람 게이트). 그 외 `/clear` 언급(단계 경계·§2b 완료 전 금지)은 불변.

## Files

- Modify: `dev-workflow/skills/review-loop/SKILL.md`
  - :308 `- **진행 중 금지 2종.** (1) …` 행의 인용문 끝 `그때 /clear를 안내하라."` → `그때 넛지 (2)의 인계 절차를 따르라."` (그 행의 나머지는 불변)
  - :372 `| **3** | 사용자에게 "/clear 후 …` 행 전체 → §2
- Test: 없음(grep AC3 + 훅과 바이트 동일 대조)

## Prep

- spec §3 F3, §2 비목표(단계 경계 `/clear`·`--resume` 안내 불변), §4 D4·D12, AC3, spec ledger R5-1(경로 ①에만 — "사용자의 명시적 중단 선택도 자동 재개된다" FIXED `b4ced82`). 엔트리포인트 SC-1(행 번호)·SC-2(HOOK-②·RL-RESUME).
- task-02 결과: 훅에 HOOK-②가 들어 있다 — `grep -c '그때 넛지 (2)의 인계 절차를 따르라' dev-workflow/hooks/scripts/context-threshold-hook.mjs` → 1.
- 현행 확인: `grep -n '그때 /clear를 안내하라\|^| \*\*3\*\* |' dev-workflow/skills/review-loop/SKILL.md` → 308 · 372 각 1건.

## Deps

task-02.

## Steps

### 1. §2b (1) 인용문 — :308 1문장 교체

원문(행 안의 조각):
```
완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 /clear를 안내하라."
```
교체:
```
완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 넛지 (2)의 인계 절차를 따르라."
```
```bash
F=dev-workflow/skills/review-loop/SKILL.md
grep -c '그때 /clear를 안내하라' $F                                  # 1 (교체 전)
sed -i '' 's|그때 /clear를 안내하라\."|그때 넛지 (2)의 인계 절차를 따르라."|' $F    # macOS sed. Linux: sed -i 's|…|…|' $F
grep -c '그때 /clear를 안내하라' $F                                  # 0
grep -c '그때 넛지 (2)의 인계 절차를 따르라' $F                        # 1
```
행의 나머지("— 앞 문장(완료 전 /clear 금지)은 항상, 뒷 문장(기록만 하고 멈춤)은 **넛지를 받은 세션에만** 적용된다(§2i 경로 ①). …")는 그대로다 — 뒷 문장의 의미(기록만 하고 멈춤 → 인계 절차)가 §2i 경로 ①로 이어진다.

### 2. §2i 순서 표 3행 — :372 행 교체

원문(행 전체):
```
| **3** | 사용자에게 "/clear 후 `/review-loop --resume`로 이어가세요"라고 안내한다 (자가 /clear 불가) |
```
교체(행 전체, 한 줄):
```
| **3** | 재개 안내 — 경로별. **①(컨텍스트 넛지)**: 넛지 (2)의 인계 절차를 따른다 — 오르카 터미널이면 후계를 스폰하되 재개 프롬프트의 `<경로>` = 이 루프 파일, "같은 작업을 이어서 진행하라" 자리 = "`/review-loop --resume`로 이 루프를 이어서 진행하라"; 오르카 밖이면 사용자에게 "/clear 후 `/review-loop --resume`로 이어가세요"라고 안내한다. **②(사용자 중단 선택)·③(폴백② 새 세션 확인)**: 사용자에게 "/clear 후 `/review-loop --resume`로 이어가세요"라고 안내한다 (자가 /clear 불가) — 사용자가 멈추기로 한 직후 자동으로 이어가면 사람 게이트를 넘는다 |
```
방법(행 번호가 아니라 원문으로 찾는다 — task-02 이후 RL은 바뀌지 않았지만 안전하게):
```bash
F=dev-workflow/skills/review-loop/SKILL.md
python3 - <<'PY'
p='dev-workflow/skills/review-loop/SKILL.md'; s=open(p,encoding='utf8').read()
old='| **3** | 사용자에게 "/clear 후 `/review-loop --resume`로 이어가세요"라고 안내한다 (자가 /clear 불가) |\n'
new='| **3** | 재개 안내 — 경로별. **①(컨텍스트 넛지)**: 넛지 (2)의 인계 절차를 따른다 — 오르카 터미널이면 후계를 스폰하되 재개 프롬프트의 `<경로>` = 이 루프 파일, "같은 작업을 이어서 진행하라" 자리 = "`/review-loop --resume`로 이 루프를 이어서 진행하라"; 오르카 밖이면 사용자에게 "/clear 후 `/review-loop --resume`로 이어가세요"라고 안내한다. **②(사용자 중단 선택)·③(폴백② 새 세션 확인)**: 사용자에게 "/clear 후 `/review-loop --resume`로 이어가세요"라고 안내한다 (자가 /clear 불가) — 사용자가 멈추기로 한 직후 자동으로 이어가면 사람 게이트를 넘는다 |\n'
assert s.count(old)==1, s.count(old); open(p,'w',encoding='utf8').write(s.replace(old,new)); print('row3 replaced')
PY
```

### 3. 자기 점검 + 커밋

```bash
F=dev-workflow/skills/review-loop/SKILL.md; K=dev-workflow/hooks/scripts/context-threshold-hook.mjs
grep -o '진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 넛지 (2)의 인계 절차를 따르라.' $F $K | sort | uniq -c   # 훅 1 · RL 1, 문자열 동일(SC-2 바이트 동일)
grep -c '^| \*\*3\*\* | 재개 안내 — 경로별' $F        # 1
grep -o '/review-loop --resume' $F | wc -l            # 3 (0.19.0: 1 — 3행 안에 3회)
grep -c '다음 단계는 /clear 후 시작하세요' $F           # 1 (:429 단계 경계 불변)
grep -c '① 컨텍스트 사용량이 임계 이상(Stop 훅 넛지' $F  # 1 (:363 불변)
grep -c '진행 중 라운드 분기(경로 ①' $F                # 1 (:365 불변)
grep -n '^| \*\*[0-4]\*\* |' $F | wc -l                # 5 (순서 표 0~4 불변, D26)
git diff --stat -- $F                                  # 1 file, 2 insertions(+), 2 deletions(-) · wc -c → 71,120B(0.19.0 70,499B, +621B)
git add $F
git commit -m "fix(review-loop): §2b (1) 인계 문장 = 훅 (0)과 바이트 동일('넛지 (2)의 인계 절차'), §2i 표 3행 재개 안내를 경로 ①에만 조건화(오르카 후계 스폰 + --resume 재개 문구, 경로 ②·③ 수동 유지) (F3)"
git log -1 --format=%B | grep -ciE '^(co-authored-by|claude-session): |generated with \[claude code\]\('   # 0
```

## Acceptance Criteria

```bash
F=dev-workflow/skills/review-loop/SKILL.md; K=dev-workflow/hooks/scripts/context-threshold-hook.mjs
diff <(grep -o '진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지\. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 [^"]*' $F | head -1) \
     <(grep -o '진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지\. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 [^\`]*' $K | head -1 | sed 's/ $//') && echo BYTE_SAME   # AC3 — 훅 (0) 문장 = RL 인용문
grep -c '그때 /clear를 안내하라' $F $K                       # 각 0
grep -c '\*\*①(컨텍스트 넛지)\*\*' $F                         # 1  (경로 ①에만 조건화)
grep -c '\*\*②(사용자 중단 선택)·③(폴백② 새 세션 확인)\*\*' $F   # 1  (②·③ 현행 유지 명시)
grep -c '`/review-loop --resume`로 이 루프를 이어서 진행하라' $F   # 1  (재개 프롬프트에 --resume)
grep -c '다음 단계는 /clear 후 시작하세요' $F                  # 1  (단계 경계 불변)
grep -c '/clear 강행·대기 사망 뒤' $F                          # 1  (§2i 분기 불변)
git status --short | grep -v '^??' | wc -l                     # 0
```

## Cautions

- **:363(세 경로 정의)·:365(진행 중 라운드 분기)·:429(단계 경계 `/clear`)·순서 표 0·1·2·4행을 건드리지 않는다. 이유: spec 비목표(단계 경계는 사람 게이트) · C-4 D26 순서 불변 · 0.18.0 D26 필드 불변 — 이 task는 3행 내용 조건화와 인용문 1문장뿐이다.**
- **경로 ②·③의 안내를 "넛지 (2)의 인계 절차"로 바꾸지 않는다. 이유: R5-1(FIXED `b4ced82`) — 사용자가 멈추기로 한 직후 자동으로 이어가면 사람 게이트를 넘는다(D4와 같은 취지).**
- **인용문을 "-세요"체로 다듬거나 "(2)"를 "②"로 바꾸지 않는다. 이유: SC-2 — 훅 `unit`과 바이트 동일해야 한다(정본 = RL, 훅이 따른다 — 이번엔 훅이 먼저 커밋됐을 뿐 문자열은 SC-2 하나다).**
- **재개 프롬프트 전문을 RL에 복제하지 않는다. 이유: 템플릿의 원본은 훅 (2-4)다 — RL은 슬롯 2개(`<경로>`·"같은 작업을 이어서 진행하라" 자리)의 값만 정한다(SC-2 RL-RESUME). 두 곳에 두면 드리프트.**
- **RL 크기를 이유로 다른 문장을 압축하지 않는다. 이유: 이 트랙에 RL 크기 AC가 없다(SC-1) — 0.18.0 D34는 그 트랙 AC9.**
- **`sed -i ''`(macOS)와 `sed -i`(Linux)를 혼동하지 않는다. 이유: spark2에서 이어받을 수 있다 — 단계 2처럼 python3 치환이 플랫폼 무관.**
