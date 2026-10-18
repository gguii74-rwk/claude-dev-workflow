# task-08 — 릴리스 1.2.0 (9단계 — SDD 디스패치 대상 아님)

**목적**: 8 review-loop(impl)가 성공 종결한 뒤, plugin.json version을 1.1.1 → 1.2.0으로 올리고 릴리스 게이트(AC1~AC8 재확인 · no-AI-trace)를 통과시켜 커밋한다. **push하지 않는다**(사용자 확인 몫).

## Files

- Modify: `dev-workflow/.claude-plugin/plugin.json` (`"version": "1.1.1"` → `"1.2.0"`만)
- Modify: `docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md` (:3 단계 줄 — 진행 표기만)
- Modify: 이 엔트리포인트(「SDD 밖 task」 표 08행 — 완료 기록)

## Prep

- 엔트리포인트 상단 「impl ledger 종결 행 계약」 · §SDD 밖 task 절(실행 범위·완료 권위) · **SC-4**(게이트 명령 전부) · **SC-5**(커밋 규칙).
- spec §3r · §4 AC1~AC8 · D9(버전 1.2.0).
- 실행 시점: 엔트리포인트 말미 `## 적대검증 ledger (impl)`에 종결 행이 있은 뒤. 실행 세션 = 8을 마친 세션 또는 새 세션(사용자 지시).

## Deps

01~07 전부 `[x]` + 8 review-loop(impl) 종결.

## Steps

### 1. 게이트 ① — impl 루프 종결 확인

```bash
P=docs/plans/2026-10-17-orchestrate-skill-delegated-auto-adopt.md
awk '/^## 적대검증 ledger \(impl\)/{p=1;next} /^## /{p=0} p' $P | grep -E '^\*\*종결\(20[0-9-]+\)\*\*: ' | grep -F '미확인 FIXED 큐 0' | grep -F '미판정 blocking 0' | grep -cE '최종 verdict approve|빠른 종료'
```

기대: `1`. `0`이면 **멈추고 보고**한다(릴리스하지 않는다).

### 2. 게이트 ② — 확인 대기 대장

```bash
grep -c '| 확인 대기 |' docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md $P
grep -hE '\| 번복 \(' docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md $P | grep -vcF '확인됨('
```

첫 줄(파일별 `확인 대기` 행 수)이 `0`이 아니면 대기 행을 사용자(또는 오케스트레이터 경유)에게 묻고 닫은 뒤 진행한다 — 「번복」이 나오면 이 단계는 미완료(D42: 수정 → 새 세션 확인 라운드 1회 → 릴리스). **둘째 줄(소멸 확인 `· 확인됨(<라운드>)`이 아직 없는 번복 행 수)은 `0`이어야 한다** — 1 이상이면 버전을 올리지 말고 멈춘다: 번복 수정이 새 세션 확인 라운드(최종 HEAD 대상)에서 소멸 확인되고 그 행에 `· 확인됨(<라운드>)`이 붙은 뒤에만 릴리스한다(중단 뒤 재개한 세션이 impl 종결 행만 보고 미확인 수정을 배포하는 경로 차단 — plan ledger R3-2).

### 3. 게이트 ③ — 테스트·회귀·문면 (SC-4 전부)

```bash
node --test tests/orchestrate/orchestrate.test.mjs 2>&1 | grep -E '^ℹ (pass|fail)'
node --check dev-workflow/skills/orchestrate/scripts/orchestrate.mjs && echo CHECK_OK
env -u DEV_WORKFLOW_MODE HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs 2>&1 | grep -E '^# (pass|fail)'
env -u DEV_WORKFLOW_MODE HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.1.0/context-threshold-hook.mode.test.mjs 2>&1 | grep -E '^# (pass|fail)'
git diff 151d9f0 -- dev-workflow/hooks | wc -l
grep -nE '\$[0-9]' dev-workflow/skills/*/SKILL.md dev-workflow/skills/orchestrate/templates/*.md | wc -l
wc -c < dev-workflow/skills/orchestrate/SKILL.md
```

기대: pass 37 · fail 0 / `CHECK_OK` / pass 11 · fail 0 / pass 2 · fail 0 / `0` / `0` / ≤ 15360. 그리고 task-03 단계 3 · task-04 단계 3 · task-05 단계 3·4 · task-06 단계 3 · task-07 단계 5의 검증 블록을 그대로 다시 돌려 같은 기대 출력을 얻는다(impl 루프 FIXED가 문면을 바꿨을 수 있다).

### 4. 버전

`dev-workflow/.claude-plugin/plugin.json`의 `"version": "1.1.1"`을 `"version": "1.2.0"`으로 바꾼다(Edit 도구, 다른 키 불변).

```bash
node -e 'const j=require("./dev-workflow/.claude-plugin/plugin.json"); console.log(j.version)'
git diff -- dev-workflow/.claude-plugin/plugin.json | grep -c '^[-+] '
```

기대: `1.2.0` · `2`(버전 줄 1삭제·1추가뿐).

### 5. 릴리스 커밋

```bash
git add dev-workflow/.claude-plugin/plugin.json
git commit -m "release: 1.2.0 — orchestrate 스킬(메인 세션 트랙 운영 공통 절차 + orchestrate.mjs watch·alive·key + 트랙 프롬프트 템플릿) · 위임 모드 효과 2(review-loop 위험군 외 추천 자동 채택·감사 동격·확인 대기 대장, dev-cycle 확인 불가 신호 ②); 게이트 impl 종결 행 1 · 테스트 37/37 · 기준선 11/11·2/2 · 훅 무변경 · \$N 0"
```

### 6. no-AI-trace 확인

```bash
git log --format=%B 151d9f0..HEAD | grep -ciE 'co-authored|generated with|claude-session'
```

기대: `0`. 0이 아니면 멈추고 보고한다(이력 재작성은 사용자 판단).

### 7. 단계 표기 · 완료 기록

- spec :3 단계 줄의 `→ 9 릴리스 1.2.0` 을 `→ **9 릴리스 1.2.0 완료 (<날짜>, <릴리스 커밋 7자리>)**` 로 바꾼다.
- 엔트리포인트 「SDD 밖 task」 표 08행 status `[x]` · outcome 1줄(릴리스 커밋 · 게이트 결과 · 미push).

```bash
git add docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md docs/plans/2026-10-17-orchestrate-skill-delegated-auto-adopt.md
git commit -m "docs(spec,plan): 1.2.0 9 릴리스 완료 표기 — 다음 = push(사용자 확인) → 설치 갱신 → AC9 (i) 실측(task-09)"
```

### 8. 보고 (사용자에게 — 실행은 하지 않는다)

릴리스 커밋·게이트 결과와 함께 아래 3줄을 보고하고 멈춘다:

- push 여부 = 사용자 확인(미push 커밋 범위 `git log --oneline origin/main..HEAD`).
- 설치 갱신 = 각 머신의 user 스코프 **와 각 project 스코프(ops-hub 등)를 따로** `/plugin update` 뒤 세션 재시작·`doctor`로 1.2.0 확인(user 갱신이 project를 같이 올리지 않는다 — spec f5).
- ops-hub 안내(spec §2 비목표·§7): 플러그인 `orchestrate`가 공통 절차를 덮으니 ops-hub `orca-worktree-ops` 스킬·CLAUDE.md는 프로젝트 고유 부분(repo id·브랜치·워크트리·Windows·모델 배분)만 남기면 된다 — repo 밖이라 이 트랙은 바꾸지 않는다.

## Acceptance Criteria

- 게이트 ①=`1` · ② `확인 대기` 0(또는 닫힘) · 확인 안 된 번복 행 `0` · ③ 기대 출력 전부 · 버전 `1.2.0` · no-AI-trace `0`.
- 08행 `[x]` 커밋됨. push 0회.

## Cautions

- **게이트 ①이 0이면 버전을 올리지 마라.** 이유: impl 적대검증(하한 3종 ③)을 거치지 않은 변경이 업데이트로 배포된다.
- **impl 종결 행이 있어도 확인 안 된 번복 행이 남아 있으면 버전을 올리지 마라.** 이유: 단계 종료 대장 번복의 수정은 impl 종결 뒤에 생겨 그 루프의 확인을 받지 않았다 — D42의 새 세션 확인 1회가 소멸을 기록해야 한다.
- **push하지 마라.** 이유: 공개 배포는 매번 사용자 확인(spec §3o ③ 라우팅표 4행) — 이 task는 로컬 릴리스 커밋까지.
- **plugin.json의 version 외 키를 이 task에서 바꾸지 마라.** 이유: description은 task-07에서 impl 리뷰를 받았다(P2) — 릴리스 diff는 버전 1줄이어야 검증이 쉽다.
- **이 task를 SDD progress ledger에 기록하지 마라.** 이유: SDD 실행 범위 밖 — 완료 권위 = 커밋된 task 표 + 이 AC(엔트리포인트 §SDD 밖 task).
