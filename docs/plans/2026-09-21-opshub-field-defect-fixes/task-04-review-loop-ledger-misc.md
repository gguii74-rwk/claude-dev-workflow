# task-04 — RL ledger 순서 규정 + 소규모 정정 (F5 · F7 RL:337 · F8 (a)(b)(c)(d)-RL)

**목적**: FIXED 행 해시 인용을 "수정 커밋 먼저 → 다음 커밋에서 인용" 순서 규정으로 바꾸고(SLIM D15 → D2), RL의 "40%" 고정 표기·index.lock 경로·§2f 자체 점검 범위·base 해소 2구·impl 디스패치 조건부 트레일러 금지를 넣는다. 전부 1~2줄 단위 편집이다.

## Files

- Modify: `dev-workflow/skills/review-loop/SKILL.md` — 6곳(아래 원문 1줄씩 → 교체 1줄씩). 0.17.0 행 번호는 task-02·03 이후 어긋나므로 **원문 문자열로 찾는다**.
- Test: 없음(grep AC)

## Prep

- spec §3 F5·F7(RL:337)·F8(a)(b)(c)(d), §4 D2·D22·D23·D30~D33, AC5·AC7(RL 부분)·AC8. 엔트리포인트 SC-7·SC-8.
- `grep -n 'FIXED 행은 수정 커밋 해시\|≥40%로 느껴지거나\|\.git/index\.lock\|상호모순 없는지 자체 점검\|\*\*base 해소\*\*\|각 항목을 TDD로 고친다' dev-workflow/skills/review-loop/SKILL.md` — 6행이 각 1건씩.

## Deps

task-03.

## Steps

각 항목: 원문 행을 찾아 **그 행 전체**를 교체 텍스트로 바꾼다.

### 1. F5 — finding ledger FIXED 행 규칙 (D2·D22)

원문:
```
- **FIXED 행은 수정 커밋 해시를 셀에 인용한다 — 전 phase(spec·plan·impl) 적용**(행 인용이 있어야 소멸 확인·감사가 기계 검증 가능하다).
```
교체:
```
- **FIXED 행은 수정 커밋 해시를 셀에 인용한다 — 전 phase(spec·plan·impl) 적용**(행 인용이 있어야 소멸 확인·감사가 기계 검증 가능하다). **순서 = 수정 커밋 먼저, ledger의 FIXED 행은 다음 커밋에서 그 해시를 인용한다** — spec·plan은 수정 대상과 ledger가 같은 문서라 한 커밋에 자기 해시를 넣을 수 없어, "되돌아가 채우는" 해시 전용 커밋이 라운드당 ≈0.28건 생겼다(08-11~09-14 ≈55건). 행은 다음 라운드 §2a 커밋 전에 들어가므로 가드·focus 조립 원본(커밋된 문서)에는 영향이 없다. **이력 재작성(filter-branch·저장소 이전)으로 인용 해시가 무효화되면 ledger에 구→신 SHA 매핑 1줄을 남긴다.**
```

### 2. F7 — §2i 경로 ① "40%" 고정 표기

원문(행 시작 부분만 다르고 나머지는 그대로):
```
① 컨텍스트 사용량이 ≥40%로 느껴지거나 Stop 훅이 넛지 · ② ESCALATE에서 사용자가 중단 선택(§2d) · ③ 폴백②(새 세션에서 확인 라운드 1회 — §확인 모드 결과 처리).
```
교체:
```
① 컨텍스트 사용량이 임계 이상(Stop 훅 넛지 — 임계는 `CLAUDE_CTX_THRESHOLD`로 바뀔 수 있다) · ② ESCALATE에서 사용자가 중단 선택(§2d) · ③ 폴백②(새 세션에서 확인 라운드 1회 — §확인 모드 결과 처리).
```

### 3. F8(a) — §2a index.lock 경로 (D30)

원문:
```
- `.git/index.lock`이 존재하면 다른 세션이 git 사용 중 — 지우지 말고 끝나길 기다린다.
```
교체:
```
- `$(git rev-parse --git-dir)/index.lock`이 존재하면 다른 세션이 git 사용 중 — 지우지 말고 끝나길 기다린다(링크드 워크트리에서는 `.git`이 파일이라 `.git/index.lock` 검사는 항상 "없음"으로 통과한다).
```

### 4. F8(b) — §2f spec/plan ② 자체 점검 범위 (D31)

원문:
```
- **spec/plan**: 문서를 수정한 뒤 ① 해당 phase 관문(§1) 재확인 + ② **변경된 결정/가정/AC/테스트 기준이 문서 내부에서 상호모순 없는지 자체 점검**.
```
교체:
```
- **spec/plan**: 문서를 수정한 뒤 ① 해당 phase 관문(§1) 재확인 + ② **변경된 결정/가정/AC/테스트 기준이 문서 내부와 교차 문서(같은 수치·경로·D번호를 담은 task 파일·런북·요약절)에서 상호모순 없는지 자체 점검**(상위 문구 미갱신으로 3회 연속 잔존 판정 실사례).
```

### 5. F8(c) — §1 base 해소 2구 (D32)

원문:
```
- **base 해소**: 트랙 기준 ref(기본 main, 비-main 트랙은 그 ref)를 확정하고 SHA와 함께 기록한다(§인자).
```
교체:
```
- **base 해소**: 트랙 기준 ref(기본 main, 비-main 트랙은 그 ref)를 확정하고 SHA와 함께 기록한다(§인자). 원격이 있으면 `git fetch` 후 **원격 추적 ref**(예: `origin/main`)로 해소한다. **루프 중 base 브랜치를 merge하지 않는다**(diff 오염).
```

### 6. F8(d) — §2f impl 디스패치 조건부 트레일러 금지 (D33)

원문:
```
- **impl**: 각 항목을 TDD로 고친다 — 재현/실패 테스트 → 최소 수정 → 게이트 통과. 가능하면 `superpowers:subagent-driven-development` 패턴.
```
교체:
```
- **impl**: 각 항목을 TDD로 고친다 — 재현/실패 테스트 → 최소 수정 → 게이트 통과. 가능하면 `superpowers:subagent-driven-development` 패턴. 서브에이전트에 디스패치할 때 **repo가 no-AI-trace 규칙을 가지면** 커밋 메시지·문서에 AI 서명/도구 흔적 금지를 프롬프트에 명시한다(조건부 — §4의 사후 grep은 무조건 유지).
```

### 7. 자기 점검 + 커밋

```bash
F=dev-workflow/skills/review-loop/SKILL.md
grep -c '수정 커밋 먼저' $F; grep -c 'SHA 매핑 1줄' $F                 # 각 1
grep -c '40%' $F                                                     # 0
grep -c '\.git/index\.lock' $F                                        # 1 (괄호 설명 안의 언급만) — 검사 명령 자체는 아래
grep -c 'git rev-parse --git-dir)/index.lock' $F                      # 1
grep -c 'task 파일·런북·요약절' $F; grep -c 'merge하지 않는다' $F; grep -c '원격 추적 ref' $F; grep -c 'no-AI-trace 규칙을 가지면' $F   # 각 1
grep -c 'co-authored|generated with' $F                              # 1 (§4 사후 grep 예시 불변)
wc -c $F                                                              # 소프트 예산 ≤ 65,300
git add $F
git commit -m "fix(review-loop): FIXED 행 해시 인용 순서 규정(수정 커밋 먼저·다음 커밋 인용, 이력 재작성 SHA 매핑) + 임계 표기·index.lock 워크트리 경로·§2f 교차 문서 점검·base fetch/merge 금지·impl 디스패치 조건부 no-AI-trace (F5·F7·F8)"
```

## Acceptance Criteria

```bash
F=dev-workflow/skills/review-loop/SKILL.md
grep -c '순서 = 수정 커밋 먼저' $F                 # 1  (AC5)
grep -c '구→신 SHA 매핑 1줄' $F                     # 1  (AC5·D22)
grep -c '40%' $F                                   # 0  (AC7 — RL:337)
grep -c '`\$(git rev-parse --git-dir)/index.lock`' $F   # 1  (AC8 a)
grep -c '`\.git/index\.lock`이 존재하면' $F         # 0
grep -c 'task 파일·런북·요약절' $F                  # 1  (AC8 b)
grep -c 'merge하지 않는다' $F; grep -c 'git fetch' $F   # 각 1  (AC8 c)
grep -c 'no-AI-trace 규칙을 가지면' $F              # 1  (AC8 d)
grep -c "grep -iE 'co-authored|generated with'" $F  # 1  (§4 사후 grep 불변)
[ "$(wc -c < $F)" -le 65300 ] && echo SIZE_OK
git log -1 --format=%B | grep -ciE 'co-authored|generated with|claude-session'   # 0
```

## Cautions

- **RL의 "재논의 금지" 승계 기록을 여기서 만들지 않는다. 이유: AC5의 "SLIM D15 대체 사실이 재논의 금지 블록에 기록" 은 spec·plan 문서의 블록 몫이고 이미 기록돼 있다(spec 재논의 금지 블록·plan 엔트리포인트) — RL은 규약이지 ledger 문서가 아니다.**
- **§4의 사후 `grep -iE 'co-authored|generated with'` 예시를 조건부로 바꾸지 않는다. 이유: D33 — 사후 grep은 보고이며 무조건 유지.**
- **훅 주석·DR·README의 "40%"는 손대지 않는다. 이유: AC7의 대상은 DC:38·RL:337 2곳뿐(기본값 설명은 제외) — DC:38은 task-08.**
- **merge-base 서술을 추가하지 않는다. 이유: companion 기본 동작이라 불필요(D32 축소 2구).**
- **F5 문장에 "(ii) 라운드 표식" 대안을 남기지 않는다. 이유: 불채택 근거는 spec에 있다 — 규약에 대안을 적으면 재론 표면이 생긴다.**
