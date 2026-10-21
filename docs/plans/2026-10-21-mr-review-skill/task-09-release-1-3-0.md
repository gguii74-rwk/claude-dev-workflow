# task-09 — 릴리스 1.3.0 (9단계 — SDD 밖, P6)

**목적**: review-loop(impl)가 성공 종결한 뒤 `plugin.json`의 `version`만 1.2.1 → 1.3.0으로 올려 사용자가 업데이트를 받게 한다. push·설치 갱신은 사용자 확인.

## Files

- Modify: `dev-workflow/.claude-plugin/plugin.json` (`version`만)
- Modify: `.claude-plugin/marketplace.json` (`version` 필드가 있을 때만 같은 값)
- Modify: `docs/plans/2026-10-21-mr-review-skill.md` (SDD 밖 task 표 09행)

## Prep

- 엔트리포인트 「impl ledger 종결 행 계약」 · **SC-7** T1~T7 · **SC-8**.
- 이전 릴리스 선례: `git log --oneline | grep 'release:'`(version만 바꾼 단독 커밋).

## Deps

task-01~08 전부 `[x]` + review-loop(impl) 종결

## Steps

### 1. 게이트 ① — impl ledger 종결 행

```bash
grep -nE '^\*\*종결\(20[0-9]{2}-[0-9]{2}-[0-9]{2}\)\*\*: .*미확인 FIXED 큐 0.*미판정 blocking 0.*(최종 verdict pass|빠른 종료)' docs/plans/2026-10-21-mr-review-skill.md | wc -l
```

기대 `1`. 0이면 **멈춘다**(impl 루프 미종결).

### 2. 게이트 ② — 확인 대기 대장

```bash
grep -nE '^\| .*\| 확인 대기 \|$' docs/plans/2026-10-21-mr-review-skill.md docs/specs/2026-10-21-mr-review-skill-design.md | wc -l   # 0
```

0이 아니면 사용자에게 대장 항목 확인(유지/번복)을 받은 뒤 진행.

### 3. 게이트 ③ — SC-7 전부

```bash
BASE=<구현 착수 직전 main SHA>
node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs tests/mr-review/deploy.test.mjs tests/mr-review/pack.test.mjs tests/mr-review/report.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'   # 51/51
for f in dev-workflow/skills/mr-review/scripts/mr-review.mjs dev-workflow/skills/mr-review/scripts/lib/*.mjs; do node --check "$f" || echo "CHECK_FAIL $f"; done; echo CHECK_DONE
node --test tests/orchestrate/orchestrate.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'   # 54/54
git diff "$BASE" --stat -- dev-workflow/hooks dev-workflow/skills/dev-cycle dev-workflow/skills/doctor dev-workflow/skills/harden-spec dev-workflow/skills/orchestrate dev-workflow/skills/review-loop dev-workflow/skills/setup dev-workflow/skills/ui-mockup dev-workflow/skills/writing-plans-split | wc -l   # 0
grep -nE '\$[0-9]' dev-workflow/skills/mr-review/SKILL.md | wc -l   # 0
grep -rnE '(172\.|safetyreport|안전신문고|kimkfc|gguii)' dev-workflow/skills/mr-review/ tests/mr-review/ README*.md | wc -l   # 0
git log --format=%B "$BASE"..HEAD | grep -iE 'co-authored|generated with|claude-session' | wc -l   # 0
```

하나라도 기대와 다르면 멈춘다.

### 4. version

`dev-workflow/.claude-plugin/plugin.json`의 `"version": "1.2.1"` → `"version": "1.3.0"`. `.claude-plugin/marketplace.json`에 `version` 필드가 있으면 같은 값으로.

```bash
git add dev-workflow/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "release: 1.3.0 — mr-review 스킬(남의 MR 두 모델 독립 리뷰 초안)"
```

### 5. 완료 기록

엔트리포인트 SDD 밖 task 표 09행을 `[x]` + outcome(릴리스 커밋 SHA · 게이트 ①②③ 결과 1줄 · **미push**)으로 바꾸고 그 파일만 커밋한다.

### 6. push·설치 갱신 — 사용자 확인

사용자에게 (a) `git push origin main` (b) 사용자 PC에서 `/plugin update dev-workflow@claude-dev-workflow` 후 세션 재시작 — 두 가지를 **묻는다**(자동 실행 금지).

## Acceptance Criteria

- 게이트 ①②③ 통과 기록 · `version` 1.3.0 단독 커밋 · README·SKILL 무변경.
- push는 사용자 승인 뒤에만.

## Cautions

- **version 외의 파일을 이 커밋에 섞지 마라. 이유:** 릴리스 커밋은 설치 사용자가 받는 경계 — 리뷰 안 받은 변경이 섞이면 안 된다.
- **게이트 ①을 grep 한 줄로 끝내지 말고 ledger 절을 눈으로 확인하라. 이유:** 패턴은 형식만 본다.
