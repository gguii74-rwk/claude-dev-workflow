# task-10 — 어댑터 확정본 (프로젝트 공통 문서 저장소 — SDD 밖, P7)

**목적**: 어댑터 설계 문서(그 저장소 `docs/specs/2026-10-21-mr-review-adapter-design.md`)를 확정본 `guide/mr-review-adapter.md`로 옮기면서 **SC-2 기계 블록**을 추가해 `loadAdapter`가 통과하게 한다. 이 plan 파일에는 그 저장소의 실제 값(이름·ID·주소·계정)을 쓰지 않는다(D10) — 값은 설계 문서 §1~§8에 전부 있다.

## Files (다른 저장소 — 프로젝트 공통 문서 저장소)

- Create: `guide/mr-review-adapter.md`
- Modify: 그 저장소 `README.md`·루트 `AGENTS.md`(문서 지도에 포인터 1줄 — 저장소 규약대로)

## Prep

- 설치된 1.3.0의 `<Base directory>/scripts/lib/adapter.mjs`(검증 규칙 정본) · 엔트리포인트 **SC-2**.
- 어댑터 설계 문서 §1(저장소 표) · §2(정책·버전) · §4 끝(기준선 후보 경로 패턴) · §5(위키 루트·전송 허용·용어집·상한) · §6(마스킹 패턴) · §7(배포 대상·제외) · §7a(댓글 형식 정규식·신뢰 리뷰어) · §8(리포트 경로).
- 그 저장소의 문서 MR 규칙(과정 로그 제외·결과 문서만·한글 경로 금지) — 어댑터 §3.2가 그 기준이다.

## Deps

09 + push + 사용자 PC 설치 갱신

## Steps

### 1. 확정본 작성

설계 문서 전문을 `guide/mr-review-adapter.md`로 복사하고 상태 줄을 「확정본 v1(날짜)」로 바꾼 뒤, 문서 끝에 `## 기계 블록 (스크립트 전용)` 절을 두고 SC-2 형식의 ```` ```json mr-review-adapter ```` 블록 하나를 쓴다. 값 매핑:

| SC-2 키 | 설계 문서 출처 |
|---|---|
| `workspaceRoot` | 확정본 위치(`guide/`) 기준 워크스페이스 루트까지의 상대 경로(그 저장소가 워크스페이스 루트 바로 아래면 `../..`) |
| `docsRoot` | 그 저장소 자신(워크스페이스 루트 기준 이름) |
| `projects.<basename>` | §1 표 — `id`·`path`(워크스페이스 루트 기준), 문서 저장소는 `deployExempt: true` |
| `policy.judgeId` · `acceptedIds` · `docs` | §2 — 판정 기준 ID, 전환기 허용 ID 2종, 항상 읽을 절(`경로#절제목접두` 형식 — 예: `guide/<정책 파일>#5.`). §2의 「대상 저장소 루트의 `AGENTS.md`·`CLAUDE.md`」는 **`repo:` 접두**(SC-2 — `repo:AGENTS.md`·`repo:CLAUDE.md`, 고정 head 에서 읽고 없으면 `missing`) · §2의 승격 MR 추가 문서는 2차 범위라 넣지 않는다 |
| `contract.lines` | 정책 §0의 10줄 이름 그대로 |
| `baselineCandidates` | §4 끝의 후보 경로 패턴(glob) |
| `docsMap.always` · `docsMap.rules` | §4 표 — 각 행의 변경 파일 패턴 → 읽을 문서(절 지정 가능). 공통 문서는 docsRoot 기준 경로, **대상 저장소 자신의 문서(§4의 app `docs/`·app `AGENTS.md`)는 `repo:<저장소 루트 기준 경로>`**(SC-2). 「반대편 저장소의 같은 기능」·위키 entity 는 기계 블록이 아니라 산문(§4 표 그대로 — LLM 이 읽는다) |
| `wiki.roots` · `linesPerPage` · `pagesPerPack` | §5 표 — 루트 경로(`~` 허용)·`export`(허용/금지)·용어집 파일명·상한 |
| `mask` | §6 — 패턴마다 `name`·JS 정규식 본문(전화·주민번호·이메일·token/Authorization·인증번호). **`Authorization:` 뒤 값은 인증 방식(`Bearer`·`Basic` …)과 자격증명을 한 매치로 소비하는 형태**(픽스처 `token` 패턴과 같은 모양 — `[^\s]+` 하나면 `Bearer`만 가려지고 자격증명이 남는다, plan R3-1). §6 산문의 「뒤 값」은 이 뜻으로 옮긴다 |
| `deploy.targets` · `excludes` | §7 |
| `comments.verdictFirstLine`(그룹 `policy`·`sha`·`kind`·`verdict`) · `baselineConfirm` · `authorToken`(그룹 `token`·`arg`) · `trustedReviewers` | §7a — 신뢰 리뷰어는 GitLab username(설계 초안에서 비워 둔 칸을 확정본에서 채운다) |
| `report.dir` | §8 |

### 2. 검증 (사용자 PC, 설치된 플러그인으로)

```bash
B="<Base directory for this skill>"   # /dev-workflow:mr-review 를 한 번 로드하면 표시된다
node -e 'import(process.argv[1]+"/scripts/lib/adapter.mjs").then(m=>{const a=m.loadAdapter(process.argv[2]);console.log("ADAPTER_OK projects="+Object.keys(a.projects).length+" wiki="+a.resolved.wikiRoots.length+" reportDir="+a.resolved.reportDir)}).catch(e=>{console.log("ADAPTER_FAIL "+e.message);process.exit(1)})' "$B" "<확정본 절대 경로>"
```

기대 `ADAPTER_OK …`. `ADAPTER_FAIL`이면 메시지의 누락 키를 채운다. 추가로 닫힌 MR 하나로 `collect`·`check`·`deploy`·`pack`까지만 돌려(검토자 없이) `pack.json.codexSkipped === false`와 `mask.applied`를 확인한다 — 마스킹 패턴이 실제 본문에서 동작하는지 보는 것. 마스킹 회귀 1줄(plan R3-1): 확정본의 `mask` 배열로 `applyMask('Authorization: Bearer synthetic-credential-123', mask).text`가 `Authorization: [masked:token]`이어야 한다(자격증명 잔존 0).

### 3. 게시

그 저장소 규약대로 브랜치 → MR(변경 사유 3줄·Baseline = 어댑터 설계 문서 permalink). **MR 생성·머지는 사용자 승인 뒤.** 머지 후 사용자 환경변수 `MR_REVIEW_ADAPTER=<확정본 절대 경로>`를 안내한다.

### 4. 완료 기록

엔트리포인트 SDD 밖 task 표 10행 `[x]` + outcome(그 저장소 MR 번호·머지 커밋·`ADAPTER_OK` 줄) — 이 플러그인 저장소에 커밋.

## Acceptance Criteria

- `ADAPTER_OK` · 닫힌 MR 1건에서 `pack` 까지 성공(`codexSkipped=false`).
- 확정본에 과정 로그·한글 경로·로컬 절대 경로 없음(어댑터 §3.2 기준).

## Cautions

- **이 plan 파일·커밋 메시지에 그 저장소의 실제 값을 옮겨 적지 마라. 이유:** 공개 저장소(D10).
- **`trustedReviewers`를 비워 두지 마라. 이유:** 비면 지정 리뷰어 외 판정 댓글을 전부 무시한다 — 의도한 운용이면 비워도 되지만 설계 §7a는 Maintainer 계정을 적기로 했다.
- **대상 저장소 문서를 docsRoot 상대 경로(`../<저장소>/AGENTS.md`)로 적지 마라 — `repo:` 접두. 이유:** plan R3-6 — 상대 경로는 다른 체크아웃의 작업 트리를 읽어 고정 head·출처 SHA·전송 허가(D4 워크트리 범위)가 어긋난다. `repo:`는 pack 이 워크트리 또는 raw API(ref=head)로 읽는다.
