# task-11 — S1 측정(표본 20건) · 첫 실사용 리포트 (트랙 완료 조건 — SDD 밖, P8 · spec §7)

**목적**: spec §7 S1(최근 5주 머지 MR 표본 20건에 §5.2 검사를 돌려 손 분류와 Baseline 유형·변경 사유 유무가 일치, 불일치 ≤ 2건)과 S2(두 모델 발견의 `양쪽/Claude만/Codex만` 비율 기록)를 측정하고, 열린 MR 1건으로 끝까지 실사용해 F1~F8 자가 점검을 기록한다. 결과는 엔트리포인트 `## S1 실측 기록` 절(대장 앞)에 적는다.

## Files

- Modify: `docs/plans/2026-10-21-mr-review-skill.md` (`## S1 실측 기록` 절 신설 + 11행)

## Prep

- 설치된 1.3.0 + task-10 확정본(`MR_REVIEW_ADAPTER`).
- 손 분류 원본 = 2026-10-21 운영팀 MR 재조사 표(스펙 `docs/` 커밋·본문 첨부·근거 없음·위치 미기재·이유만 — 사용자 메모/주간회의 자료). 플러그인 저장소에는 **집계 수치만** 적고 MR 번호·프로젝트명은 적지 않는다(D10).

## Deps

10

## Steps

### 1. 표본 추출(사용자 PC)

최근 5주 머지 MR을 4개 저장소에서 합쳐 20건(`glab api "projects/<id>/merge_requests?state=merged&updated_after=<5주 전 ISO>&per_page=100"` → 최신순 상위, 저장소별 최소 3건).

### 2. 결정적 검사만 일괄 실행

표본마다 `W=<scratch>/s1/<n>`에서:

```bash
<CLI> collect --adapter "$MR_REVIEW_ADAPTER" --project <p> --iid <iid> --work "$W" --diff-only
<CLI> check   --adapter "$MR_REVIEW_ADAPTER" --work "$W"
node -e 'const c=require(process.argv[1]+"/check.json");console.log([process.argv[2],c.track,c.baselineType,c.reason.why,c.reason.what,c.contract.complete,c.baselineCandidateFiles.length].join("\t"))' "$W" "<p>!<iid>"
<CLI> cleanup --adapter "$MR_REVIEW_ADAPTER" --work "$W"
```

(`--diff-only`는 S1이 §5.2 검사만 보기 때문 — 워크트리 불필요.) **표본마다 마지막 줄 `cleanup`은 `collect`·`check`가 `ERR`로 끝나도 실행한다**(plan R6-4 — 직접 CLI 호출에는 SKILL §0 공통 종료 절차가 없다. 측정 줄(`node -e …`)은 cleanup **앞**에 둔다 — `check.json`은 남지만 값이 마스킹 사본으로 바뀌므로 순서를 바꾸지 않는다). 20행을 손 분류 표와 대조해 **불일치 건수·원인**(예: 「서술만」 vs 손 분류 「위치 미기재」)을 센다. 불일치 > 2면 check 규칙을 고치는 후속 트랙(새 spec·루프)을 연다 — 이 task 안에서 코드를 고치지 않는다.

### 3. 첫 실사용(열린 MR 1건, 전체 흐름)

`/dev-workflow:mr-review <p> <iid>`를 끝까지(두 검토자 포함). 기록: 돈 모델·교차 검토·판정·차단 발견 수·`양쪽/Claude만/Codex만` 건수(S2)·기준선 미확인 여부·배포본 대조 결과·리포트 경로·소요 시간·F1~F8 자가 점검 8줄(§8). 「Codex만」이 0이면 어댑터 렌즈 배분 재검토를 후속으로 적는다.

### 4. 기록 · 완료

엔트리포인트에 `## S1 실측 기록` 절(대장 **앞**):

```markdown
## S1 실측 기록 (YYYY-MM-DD)

- S1: 표본 20건 · 불일치 n건(원인 요약) → 통과/미통과
- S2: 첫 실사용 MR 1건 — 발견 양쪽 a · Claude만 b · Codex만 c
- 실사용: 판정 …, 교차 검토 …, 기준선 미확인 …, 배포본 …, 소요 …, F1~F8 전부 통과/미통과(항목)
- 후속: …
```

11행 `[x]` + outcome(S1 결과·S2 비율) → 커밋 → **트랙 종결**. S3(리뷰어가 초안을 수정 없이 게시한 비율)는 1개월 뒤 측정 — 메모리/핸드오프에만 남긴다.

## Acceptance Criteria

- S1 불일치 ≤ 2 · S2 기록 · 실사용 F1~F8 전부 통과 기록.
- 표본 20건의 `W=<scratch>/s1/<n>` 전부가 `cleanup`으로 끝나 `blobs/`·`baseline/`·원문 JSON 이 남지 않음(plan R6-4 — 실사용 1건은 스킬 §0 이 정리한다).
- 플러그인 저장소 기록에 MR 번호·프로젝트명·사람 이름 없음.

## Cautions

- **S1에서 불일치가 나와도 이 task 안에서 check 규칙을 고치지 마라. 이유:** 릴리스된 코드의 변경은 새 트랙(spec→loop) — 측정과 수정을 섞으면 측정이 무의미해진다.
- **실사용 리포트를 게시하는 것은 사용자 몫이다. 이유:** D8·F1.
- **표본 루프에서 `cleanup`을 빼지 마라 — 측정값은 그 앞에서 읽는다. 이유:** plan R6-4 — 20개 `W` 에 실제 MR 본문·이슈 원문(`baseline/`)·`blobs/`가 그대로 남는다(F5·F7). 스킬을 거치지 않는 직접 CLI 호출은 §0 공통 종료 절차를 타지 않는다.
