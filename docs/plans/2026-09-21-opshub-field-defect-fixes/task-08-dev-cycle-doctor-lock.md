# task-08 — DC·DR·HS·UM 문면 정정 (F7 DC:38·DC:28·:33·:83·DR:16·DR:26 · F8(a) HS:151·UM:104, D28~D30)

**목적**: dev-cycle의 "40%"·"PR" 표기, doctor의 "3머신"·"§실행" 포인터, harden-spec·ui-mockup의 index.lock 경로를 SKILL 문면·GitLab 이전 현실과 맞춘다. 전부 1줄 단위 원문→교체다.

## Files

- Modify: `dev-workflow/skills/dev-cycle/SKILL.md`(4곳: 28·33·38·83행) · `dev-workflow/skills/doctor/SKILL.md`(2곳: 16·26행) · `dev-workflow/skills/harden-spec/SKILL.md`(151행) · `dev-workflow/skills/ui-mockup/SKILL.md`(104행)
- Test: 없음(grep AC7·AC8(a))

## Prep

- spec §3 F7(DC·DR 항목)·F8(a), §4 D28·D29·D30, AC7·AC8. 엔트리포인트 SC-8.
- 행 번호는 0.17.0 기준 — 원문 문자열로 찾는다(`grep -n`).

## Deps

task-06.

## Steps

### 1. DC:28 — 9단계 표 행 (D29)

원문:
```
| 9 | 통합·후속 검증 (PR·머지·배포·실측) | finishing-a-development-branch + 그 repo 규약 | superpowers + repo |
```
교체:
```
| 9 | 통합·후속 검증 (PR/MR·머지·배포·실측) | finishing-a-development-branch + 그 repo 규약 | superpowers + repo |
```

### 2. DC:33 — 9단계 포인터 (D29)

원문 행 시작:
```
- **9단계는 포인터만**이다 — PR·머지·배포·후속 실측의 절차 내용은 그 repo의 CLAUDE.md/AGENTS.md에 있다.
```
교체(행의 나머지는 그대로):
```
- **9단계는 포인터만**이다 — PR/MR·머지·배포·후속 실측의 절차 내용은 그 repo의 CLAUDE.md/AGENTS.md에 있다.
```

### 3. DC:38 — 단계 경계 절 "40%" (F7)

원문 문장(행 안):
```
review-loop의 컨텍스트 40% 핸드오프 넛지가 이를 돕는다.
```
교체:
```
Stop 훅의 컨텍스트 임계 넛지가 이를 돕는다.
```

### 4. DC:83 — 경량 경로 표 9행 완료 신호 (D29 — 신호 의미 보존)

원문 행 시작:
```
| 9 | PR merged + 그 repo 규약의 후속(배포·실측 — repo 밖 사실이라 불명확하면 사용자 확인) |
```
교체(행의 나머지는 그대로):
```
| 9 | PR/MR merged + 그 repo 규약의 후속(배포·실측 — repo 밖 사실이라 불명확하면 사용자 확인) |
```

### 5. DR:16 — 머신 수 제거 (D28)

원문:
```
**이 머신 하나만 본다.** 다른 머신은 진단하지 않는다 — 3머신 정렬은 "각 머신이 각자 돌린다"로 달성한다.
```
교체:
```
**이 머신 하나만 본다.** 다른 머신은 진단하지 않는다 — 머신 간 정렬은 "각 머신이 각자 돌린다"로 달성한다.
```

### 6. DR:26 — review-loop 포인터 (F7)

원문:
```
| review-loop | **루프 실행 중의 codex 실패는 review-loop 소관**이다(`review-loop` §실행). doctor가 끼면 루프가 끊긴다 — doctor는 **루프 밖**의 증상 문장에만 뜬다 |
```
교체:
```
| review-loop | **루프 실행 중의 codex 실패는 review-loop 소관**이다(적대 = `review-loop` §2b 라운드 실행 공통 절차, 확인 = §확인 모드 실행). doctor가 끼면 루프가 끊긴다 — doctor는 **루프 밖**의 증상 문장에만 뜬다 |
```

### 7. HS:151 · UM:104 — index.lock 경로 (D30)

원문(두 파일 동일 문장, 들여쓰기 2칸 불릿):
```
  - `.git/index.lock`이 있으면 다른 세션이 git 사용 중 — 지우지 말고 기다린다.
```
교체(두 파일 모두):
```
  - `$(git rev-parse --git-dir)/index.lock`이 있으면 다른 세션이 git 사용 중 — 지우지 말고 기다린다(링크드 워크트리에서는 `.git`이 파일이다).
```

### 8. 자기 점검 + 커밋

```bash
grep -c '40%' dev-workflow/skills/dev-cycle/SKILL.md                       # 0
grep -c 'PR/MR' dev-workflow/skills/dev-cycle/SKILL.md                     # 3
grep -c 'PR merged' dev-workflow/skills/dev-cycle/SKILL.md                 # 0
grep -c '3머신' dev-workflow/skills/doctor/SKILL.md                         # 0
grep -c '§2b 라운드 실행 공통 절차' dev-workflow/skills/doctor/SKILL.md      # 1
grep -rc '`\.git/index\.lock`이' dev-workflow/skills/                       # 전부 0
grep -rc 'git rev-parse --git-dir)/index.lock' dev-workflow/skills/ | grep -v ':0'   # review-loop·harden-spec·ui-mockup 각 1
git add dev-workflow/skills/dev-cycle/SKILL.md dev-workflow/skills/doctor/SKILL.md dev-workflow/skills/harden-spec/SKILL.md dev-workflow/skills/ui-mockup/SKILL.md
git commit -m "fix(dev-cycle,doctor,harden-spec,ui-mockup): 문서 드리프트 정정 — 임계 넛지 표기·PR/MR·머신 수 제거·review-loop §2b/§확인 포인터·index.lock 워크트리 경로 (F7·F8a)"
```

## Acceptance Criteria

```bash
grep -c 'Stop 훅의 컨텍스트 임계 넛지' dev-workflow/skills/dev-cycle/SKILL.md   # 1  (AC7)
grep -c 'PR/MR merged' dev-workflow/skills/dev-cycle/SKILL.md                  # 1  (AC7 — 완료 신호)
grep -c '40%' dev-workflow/skills/dev-cycle/SKILL.md dev-workflow/skills/review-loop/SKILL.md   # 각 0
grep -c '머신 간 정렬' dev-workflow/skills/doctor/SKILL.md                       # 1  (AC7 — DR:16)
grep -c '§확인 모드 실행' dev-workflow/skills/doctor/SKILL.md                    # 1  (AC7 — DR:26)
for f in review-loop harden-spec ui-mockup; do grep -c 'git rev-parse --git-dir)/index.lock' dev-workflow/skills/$f/SKILL.md; done   # 1 1 1 (AC8 a)
grep -rc '`\.git/index\.lock`이' dev-workflow/skills/ | grep -v ':0' | wc -l     # 0
git log -1 --format=%B | grep -ciE 'co-authored|generated with|claude-session'   # 0
```

## Cautions

- **DR:252·:260·README·훅 주석의 "40%"는 손대지 않는다. 이유: 기본값 설명이다 — AC7 대상은 DC:38·RL:337 2곳만.**
- **DC:83의 "merged" 신호 단어를 빼거나 다른 표현으로 바꾸지 않는다. 이유: 9단계 완료 판별 신호(가드) — D29는 용어 중립화만.**
- **DR의 다른 "review-loop" 언급(DR:196 등)을 고치지 않는다. 이유: 대상은 §실행 포인터 1건(DR:26).**
- **doctor에 codex 플러그인 버전 대조를 추가하지 않는다. 이유: DR:196 승계 기결정 — ≥1.0.6 게이트는 RL 런타임 검사다.**
