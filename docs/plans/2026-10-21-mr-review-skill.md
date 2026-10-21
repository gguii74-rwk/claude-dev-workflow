# mr-review 스킬 (1.3.0) — 구현 계획 엔트리포인트

- **spec**: `docs/specs/2026-10-21-mr-review-skill-design.md` (§2 목표 G1~G5·실패 조건 F1~F8 · §4 어댑터 계약 · §5 동작 · §7 성공 기준 S1~S4 · D1~D16). **spec ledger = spec 말미 `## 적대검증 ledger (spec)`** — 단일 원본, 여기에 복제하지 않는다(종결 2026-10-21: FIXED 19 · ACCEPTED 1(R3-F1 = D16) · DEFERRED_TO_IMPL/OUT_OF_SCOPE 0 → 이월 항목 없음 · DEFER_LOW 3건은 `9017d1e`·어댑터 `08728df`에서 정정 완료). **plan·impl ledger는 review-loop가 이 문서 말미에 만든다**(`## 적대검증 ledger (plan)` · `## 적대검증 ledger (impl)`). **확인 대기 대장 = 이 문서 말미 1절** — 이 문서에 절을 더할 때는 항상 `## 확인 대기 대장` 앞에 넣는다.
- **어댑터 설계**(다른 저장소 — 프로젝트 공통 문서 저장소 브랜치 `docs/mr-review-adapter-design`, `docs/specs/2026-10-21-mr-review-adapter-design.md` HEAD `08728df`): 이 plan의 task-10이 확정본으로 옮긴다. 이 플러그인 저장소는 공개라 **프로젝트 이름·내부 주소·사람 이름은 이 문서와 task 파일에 쓰지 않는다**(D10) — 어댑터 측 작업은 「프로젝트 공통 문서 저장소」로만 부른다.
- **Goal**: 리뷰어가 MR 번호 하나를 주면 작성 규칙을 기계로 검사하고(§5.2·§5.2b), 두 모델이 독립 검토한 뒤(§5.4), 팀 정책 실행 블록 형식의 판정 초안 리포트를 만드는 **읽기 전용** 스킬 `mr-review`를 플러그인에 넣고 1.3.0으로 릴리스한다.
- **Architecture**: 결정적인 부분(GitLab 수집·스냅샷 고정·검사표·배포본 대조·컨텍스트 팩·마스킹·판정 계산·리포트 조립·정리)은 전부 `scripts/mr-review.mjs` 한 CLI(+ `scripts/lib/*.mjs`)가 하고, 작업 디렉터리의 JSON 파일(SC-3)로 단계를 잇는다. SKILL.md는 절차·두 검토자 기동·발견 병합·`--resolve`만 말한다(P2). 프로젝트 고유 값은 어댑터 문서의 **기계 블록**(SC-2)에서만 읽고 렌즈·정책 원문은 LLM이 어댑터 산문을 읽는다(P1). 외부 의존 없음 — zip은 자체 리더(P3).
- **Tech stack**: Node ESM(≥ 20 — `node:zlib` inflateRaw · `node:child_process` spawnSync · `node --test` 내장 러너), `glab api`(GitLab REST — 17.11 CE에서 2026-10-21 실측: `uploads/:secret/:filename` 다운로드·`repository/files/:path/raw`·`repository/branches/:name`·`merge_requests/:iid/{diffs,notes,versions,closes_issues}`·`--paginate` 모두 동작), git ≥ 2.43, codex 플러그인 companion ≥ 1.0.6(`task --prompt-file`), Markdown 스킬 문서.
- **경로 = 정식 · 생략 없음**. 3.5(ui-mockup) 해당 없음(화면 없음). 다음 = **6 review-loop(plan)** → 7 impl(SDD, **task-01~08**) → 8 review-loop(impl) → 9 릴리스 1.3.0(**task-09 — SDD 밖**) → push·설치 갱신(사용자 확인) → **task-10 어댑터 확정본(프로젝트 공통 문서 저장소, SDD 밖)** → **task-11 S1 측정·첫 실사용(트랙 완료 조건, SDD 밖)**.

> **For agentic workers — execution contract (MUST):** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. This plan is split into per-task files (`<feature>/task-NN-<slug>.md`). Task bodies (Files, TDD steps, AC) are **NOT** in this entrypoint. To execute, MUST: ① read this entrypoint's §Shared Contracts → ② load exactly one target task file → ③ run its steps in order → ④ **record completion**: when the task is **confirmed complete** (reviews approved — SDD's "mark todo complete" sync point; the implementer's DONE report is NOT completion), the dispatcher (the executor itself when running without subagents) immediately — before dispatching the next task — sets that task's row in this entrypoint's task table to `[x]`, writes its one-line outcome, and **commits this entrypoint file on the spot**. **Convergence check (MUST, at all three points — before starting any task, when initializing a resumed/recovered session, and before entering the final whole-branch review):** reconcile this task table against the SDD progress ledger and git log. The authority for "complete" is an **explicit completion record in the SDD progress ledger**; git log only corroborates that a recorded commit exists and was not reverted — an implementation commit by itself is NOT completion (implementer commits exist before review approval). A task whose ledger completion record is missing or ambiguous is **incomplete (fail-closed)** — including a row already marked `[x]`: revert it to `[ ]`. **That rule presumes a live ledger.** A ledger that is absent — or present but holding no completion record for any task while this table already has `[x]` rows — is fresh or lost, not authoritative. (Judge by content, not by the file: SDD's setup recreates an identity-only `progress.md` before reading the plan, so a workspace lost to `git clean -fdx` looks "present"; same after the post-final-review cleanup `rm -rf <workspace>`.) In that state authority falls back to **this committed task table**, which ④ writes only at confirmed completion, with git log corroborating each `[x]` row's commit. Never mass-revert the table over a fresh or lost ledger: revert only a row git log contradicts (no such commit, or reverted), and if the table itself is unreadable, ask your human partner instead of re-dispatching. Rebuild the ledger's completion lines from the surviving table before continuing, so later checks have a live ledger again — but that rebuild restores completion state **only**: a lost ledger may also have held deferred-minor and parked findings with their rulings, which this table never carried, so flag that gap and get your human partner's confirmation before the final whole-branch review instead of presenting the rebuilt ledger as whole. A row filled in but not yet committed is also unconverged: commit it before proceeding. **SDD adapter (`scripts/task-brief` contact point):** a split plan has no "Task N" section, so skip that extraction — **the task file itself is the brief**: pass its full text in the dispatch. Keep the SDD workspace and progress ledger keyed to **this entrypoint** (`scripts/sdd-workspace <entrypoint path>`) — one workspace per plan, never per task file. **No-AI-trace (conditional):** when the repo has a no-AI-trace rule (e.g. its `CLAUDE.md` forbids AI signatures in commits), every dispatch prompt MUST state that commit messages and documents carry no AI tool trace (no `Co-Authored-By` / `Generated with` trailers). Do not start implementing from the entrypoint alone (it has no steps). Do not load all task files at once.
> 확인 시점 각주(블록 밖 — 계약 블록에는 버전을 적지 않는다): `scripts/task-brief`·`scripts/sdd-workspace`는 superpowers 6.3.0 SDD SKILL.md:137·:252에서 실재 확인(2026-09-21). superpowers가 bump돼도 블록은 낡지 않는다.

이 repo의 no-AI-trace 규칙 = 글로벌 `~/.claude/CLAUDE.md`("git commit 메시지에 AI 서명을 절대 포함하지 않는다") — 디스패치 프롬프트마다 명시한다(SC-7).

## 재논의 금지(기결정) — spec에서 승계

> **이번 트랙 확정 결정 = D1~D16**(spec 「재논의 금지(기결정)」 — 사용자 결정·설계 결정, spec 루프 중 D4 확정·D16 추가). 적대검증(plan·impl)에서 재론하지 않는다. 상세·근거 = spec 표와 spec ledger(복제 금지).

| D | 결정(1줄) |
|---|---|
| D1 | 리뷰어가 MR이 올라온 뒤 수동으로 돌린다 — 작성자 사전 자가 점검용 아님 |
| D2 | 첫 사용자 1명 → 결과 좋으면 공유, 공유 경계 3종(§6)은 처음부터 |
| D3 | 테스트·빌드 실행 없음, 검증 상태 전부 `[판독]` |
| D4 | Codex 전송 범위 = 대상 저장소 워크트리 전체 + MR 본문·댓글 + 공통 문서·팀 위키 발췌. 개인 위키는 Claude만. 마스킹은 본문·댓글·발췌에 적용 |
| D5 | 렌즈 = 사유·설계 결정·사이드 이펙트·최소 범위 + 어댑터 추가 렌즈. 렌즈 추가는 어댑터 몫 |
| D6 | 배포본 zip 내려받아 정책 §6.1 세 가지 기계 대조 — 실행이 아니라 비교 |
| D7 | 경량 MR 기준선 확인 댓글 없어도 초안 + 리뷰어가 먼저 게시할 확인 문안 |
| D8 | GitLab에 아무것도 쓰지 않는다 |
| D9 | 출력 = 정책 실행 블록·판정 4종·발견 유형 4종 그대로, 판정 규칙 신설 금지 |
| D10 | 엔진(플러그인 공개)/어댑터(프로젝트 문서 비공개) 분리 — 플러그인에 프로젝트 이름·내부 주소·사람 이름 금지 |
| D11 | 두 검토자 독립 병렬 → 메인 통합 |
| D12 | 최소 범위 렌즈 기본 `FOLLOW_UP`, 접촉 표면 추가 시만 `DESIGN_DRIFT` |
| D13 | 정책 ID는 MR 계약 버전, 판정 기준은 어댑터 지정 최신판, 헤더 병기, 이전 판정 파싱은 두 ID 모두 |
| D14 | 마스킹 실패 시 Codex 건너뛰고 단일 모델(fail-closed) |
| D15 | GitLab 읽기는 `glab api`, 토큰 미관리 |
| D16 | 샌드박스 워크트리 밖 읽기 미차단은 알고 둔다 — 보완 = 프롬프트 금지 문구 + 출력 경로 감시·경고 |

**5 plan 단계 빌더 결정(2026-10-21 — spec §8이 빌더에게 맡긴 것. plan·impl 루프에서 재론하지 않는다)**:

| P | 결정(1줄) | 근거 |
|---|---|---|
| P1 | 어댑터 문서의 기계 값은 **펜스 블록 ```` ```json mr-review-adapter ```` 하나**(SC-2)에 두고 스크립트는 그 블록만 읽는다. 렌즈·정책·문서 지도 설명은 산문 그대로(LLM이 읽음) | §4 「절 제목 고정」을 지키면서 마크다운 표 파싱의 취약성을 피한다. 필수 키 누락은 fail-closed |
| P2 | 구현 = `SKILL.md` + `scripts/mr-review.mjs`(단일 CLI, 서브커맨드 8종) + `scripts/lib/*.mjs` 6모듈, 외부 의존 없음. 테스트 = `tests/mr-review/*.test.mjs`(가짜 `glab` + 로컬 bare git) | spec §8 「§5.2 검사와 §5.1 glab 호출은 스크립트가 낫다」. orchestrate 선례(스크립트 1곳 + 스텁 테스트) |
| P3 | zip 판독은 자체 리더(`node:zlib` inflateRaw, stored·deflate만) — `unzip` 외부 명령 금지 | Windows Git Bash 환경 보장 없음. git archive zip은 deflate/stored만 쓴다 |
| P4 | 작업 디렉터리 = `--work <dir>`(세션 scratchpad 아래 `mr-review/<프로젝트>-<iid>/`) · 단계별 JSON 파일 계약 = SC-3. 워크트리·zip·원시 로그·프롬프트는 `cleanup`이 지운다(F7·F5) | 단계 분리·재실행·`--resolve` 재계산이 파일로 가능 |
| P5 | 검토자 출력 = JSON(SC-4). 발견 병합·상충 확인은 메인(LLM), **판정 계산은 스크립트**(`verdict` — §5.5-4 결정적) | 판정 순서 실수를 코드로 고정. D9 |
| P6 | 릴리스 = 1.3.0(minor — 새 스킬). README 3종·manifest description은 impl(task-08), `version`만 릴리스(task-09) | 이전 트랙 P2 선례(README가 적대검증을 받게) |
| P7 | 어댑터 확정본(`guide/mr-review-adapter.md` + 기계 블록)은 프로젝트 공통 문서 저장소의 별도 task-10(SDD 밖) — MR 게시는 사용자 승인 | 다른 저장소·비공개·MR 규약 |
| P8 | 트랙 완료 조건 = S1 측정(표본 20건 §5.2 검사 ≤ 2건 불일치) + 열린 MR 1건 첫 실사용 리포트(task-11) | spec §7 |
| P9 | 이전 판정 댓글·기준선 확인 댓글·작성자 토큰의 정규식과 신뢰 리뷰어 목록은 전부 어댑터 블록 값 — 스크립트에 문자열 고정 금지 | D10·§4.9 |
| P10 | 재리뷰 delta·이전 리포트 읽기·`--resolve`는 1.3.0 범위. 고도화 포크 승격 MR·포크 내부 MR은 범위 밖(spec §9) | 범위 고정 |

**승계 기결정(전제 — 위배 금지)**: review-loop §2b 실행 절차(companion 경로 해소·래퍼·마커 `COMPANION_EXIT`·실행 로그 ≥1·자동 재실행 금지) · 1.1.1 D2(셸 블록 위치 인자 = `${N}`) · L3 기본값은 싼 쪽.

## Shared Contracts

### SC-1. 대상 파일 · 약칭

| 약칭 | 경로 | 이 plan에서 만드는 것 | task |
|---|---|---|---|
| CLI | `dev-workflow/skills/mr-review/scripts/mr-review.mjs` | 신규 — 서브커맨드 dispatch | 01(골격)·02~06(서브커맨드 연결) |
| adapter | `dev-workflow/skills/mr-review/scripts/lib/adapter.mjs` | 신규 — 기계 블록 파서·검증·glob | 01 |
| gitlab | `dev-workflow/skills/mr-review/scripts/lib/gitlab.mjs` | 신규 — `glab api` 래퍼(JSON·바이너리·페이지) | 02 |
| collect | `dev-workflow/skills/mr-review/scripts/lib/collect.mjs` | 신규 — §5.1 수집·스냅샷·diff-only 복원 | 02 |
| check | `dev-workflow/skills/mr-review/scripts/lib/check.mjs` | 신규 — §5.2 검사표·댓글 신뢰·§5.1-5 원문 수집 | 03 |
| deploy | `dev-workflow/skills/mr-review/scripts/lib/deploy.mjs` | 신규 — §5.2b 기대 목록·zip 리더·대조 | 04 |
| pack | `dev-workflow/skills/mr-review/scripts/lib/pack.mjs` | 신규 — §5.3 문서 지도·위키·마스킹·팩 A/B | 05 |
| report | `dev-workflow/skills/mr-review/scripts/lib/report.mjs` | 신규 — §5.5-4 판정 계산·§5.7 렌더·비밀값 제거·cleanup | 06 |
| 테스트 | `tests/mr-review/helpers.mjs` · `tests/mr-review/{adapter,collect,check,deploy,pack,report}.test.mjs` | 신규(repo 루트 — 설치본 밖) | 01~06 |
| 픽스처 | `tests/mr-review/fixtures/adapter.md` | 신규 — 테스트용 어댑터(가상 프로젝트명만) | 01 |
| SKILL | `dev-workflow/skills/mr-review/SKILL.md` | 신규 | 07 |
| README | `README.md`·`README.ko.md`·`README.ja.md` | 표 행·목차·절 신설·트리·테스트 명령 | 08 |
| manifest | `dev-workflow/.claude-plugin/plugin.json` · `.claude-plugin/marketplace.json` | description(08) · version 1.2.1→1.3.0(09) | 08·09 |
| 어댑터 확정본 | 프로젝트 공통 문서 저장소 `guide/mr-review-adapter.md` | 신규(SDD 밖) | 10 |
| 훅·기존 스킬 | `dev-workflow/hooks/**` · 다른 `skills/**` | **무변경**(`git diff <base> -- dev-workflow/hooks dev-workflow/skills/{dev-cycle,doctor,harden-spec,orchestrate,review-loop,setup,ui-mockup,writing-plans-split}` 빈 출력) | — |

### SC-2. 어댑터 기계 블록 — `adapter.mjs`가 읽는 유일한 입력 (P1)

어댑터 마크다운 안의 펜스 블록 하나: 여는 줄이 정확히 ```` ```json mr-review-adapter ````, 본문은 JSON 객체. 블록이 없거나 둘 이상·JSON 오류·필수 키 누락 → `loadAdapter()`가 `AdapterError`(메시지에 누락 키)를 던지고 CLI는 exit 2.

```json
{
  "schema": 1,
  "workspaceRoot": "..",
  "docsRoot": "common-docs",
  "projects": { "<이름>": { "id": 0, "path": "<workspaceRoot 기준 체크아웃 경로>", "deployExempt": false } },
  "policy": { "judgeId": "<판정 기준 정책 ID>", "acceptedIds": ["<계약에 허용하는 ID>", "..."], "docs": ["<docsRoot 기준 경로>", "..."] },
  "contract": { "lines": ["Policy", "Policy source", "Review type", "Reviewer role", "Baseline", "Base SHA", "Review head SHA", "Required acceptance criteria", "Required tests/evidence", "Human reviewer"] },
  "baselineCandidates": ["docs/specs/**", "..."],
  "docsMap": { "always": ["<docsRoot 기준 경로>"], "rules": [{ "match": ["<glob>", "..."], "docs": ["<docsRoot 기준 경로>"] }] },
  "wiki": { "roots": [{ "path": "<절대 또는 ~ 경로>", "export": true, "glossary": "<루트 기준 파일>" }], "linesPerPage": 60, "pagesPerPack": 12 },
  "mask": [{ "name": "phone", "pattern": "<JS 정규식 본문, 플래그 g 자동>" }],
  "deploy": { "targets": ["src/main/**"], "excludes": ["docs/**"] },
  "comments": {
    "verdictFirstLine": "<명명 그룹 policy·sha·kind·verdict 필수>",
    "baselineConfirm": "<줄 시작 정규식>",
    "authorToken": "<명명 그룹 token 필수·arg 선택>",
    "trustedReviewers": ["<GitLab username>"]
  },
  "report": { "dir": "<workspaceRoot 기준 디렉터리>" }
}
```

- 필수 키: `schema`(=1) · `workspaceRoot` · `docsRoot` · `projects`(1개 이상, 각 `id` 정수·`path` 문자열) · `policy.judgeId`·`policy.acceptedIds`(비어 있지 않음)·`policy.docs` · `contract.lines`(10개) · `baselineCandidates` · `docsMap.always`·`docsMap.rules` · `wiki.roots`(0개 가능)·`wiki.linesPerPage`·`wiki.pagesPerPack` · `mask` · `deploy.targets`·`deploy.excludes` · `comments.verdictFirstLine`(그룹 4종 포함 — 문자열에 `(?<policy>`·`(?<sha>`·`(?<kind>`·`(?<verdict>` 모두 있어야 함)·`comments.baselineConfirm`·`comments.authorToken`(`(?<token>` 포함)·`comments.trustedReviewers` · `report.dir`.
- `projects`의 키 = GitLab 프로젝트 경로의 **마지막 세그먼트(basename)** — 기준선 링크 URL(`…/<group>/<basename>/-/blob/<ref>/<path>`)의 프로젝트를 이 키로 찾는다(check). **찾은 뒤 링크의 호스트·전체 프로젝트 경로(`/-/` 앞)를 그 등록 ID의 `web_url`(`projects/<id>`)과 대조한다 — 다르면 미확보**(basename만 같은 다른 호스트·namespace 링크를 등록 프로젝트로 해소하지 않는다). 같은 basename이 두 그룹에 있으면 어댑터가 그 프로젝트를 다른 키로 둘 수 없으므로 범위 밖(spec §9 포크).
- 문서 참조(`policy.docs`·`docsMap.always`·`docsMap.rules[*].docs`)의 두 형식: `"<docsRoot 기준 경로>[#절제목접두]"`(공통 문서 저장소) · **`"repo:<대상 저장소 루트 기준 경로>[#절제목접두]"`**(리뷰 대상 저장소 자신의 문서 — `AGENTS.md`·`CLAUDE.md`·저장소 `docs/`). `repo:`는 pack이 **고정 head**에서 읽는다(워크트리 모드 = `snapshot.worktree`, diff-only = `repository/files/<경로>/raw?ref=<head>`), 출처 `repo:<경로>@<head7>`, 팩 B 포함(D4 워크트리 범위), 누락은 필수 여부와 무관하게 `missing:true`로 계속(저장소마다 있을 수도 없을 수도 있는 문서 — 공통 문서의 필수 누락 ERR 규칙과 다르다). 다른 저장소의 작업 트리를 상대 경로로 가리키는 참조는 두지 않는다.
- 경로 해소: `workspaceRoot`는 **어댑터 파일이 있는 디렉터리 기준** 상대 경로(절대 경로도 허용). `projects[*].path`·`docsRoot`·`report.dir`는 workspaceRoot 기준. `wiki.roots[*].path`의 선두 `~`는 `os.homedir()`로 바꾼다. `loadAdapter(file)`는 해소된 절대 경로를 `adapter.resolved = { workspaceRoot, docsRoot, reportDir, projects: {name: {id, checkout, deployExempt}}, wikiRoots: [{path, export, glossaryFile}] }`에 둔다.
- glob: `**`(0개 이상 디렉터리) · `*`(구분자 제외 임의) · `?` · 그 밖 문자 그대로. 경로는 `/` 구분, 저장소 루트 기준 상대 경로와 대조. 구현 = `globToRegExp(glob)`·`matchesAny(path, globs)`(adapter.mjs export).

### SC-3. 작업 디렉터리 파일 계약 (P4) — 모든 서브커맨드는 `--work <dir>`를 받는다

| 파일 | 생산 | 소비 | 내용(필드는 아래 정본) |
|---|---|---|---|
| `mr.json` | collect | check·deploy·pack·render | MR 메타·diff·댓글·이슈·버전(정규화) |
| `snapshot.json` | collect | check·deploy·pack·verdict·render·cleanup | 세 SHA·모드·워크트리·미복원 목록 |
| `check.json` | check | deploy·pack·verdict·render | §5.2 검사표 + 댓글 신뢰 + 기준선 원문 |
| `baseline/<n>.md` | check | pack | 기준선·이슈 원문(출처 헤더 포함) |
| `deploy.json` | deploy | verdict·render | §5.2b 결과 — zip 파일명·주석·API 오류 문자열에 MR 원문이 섞이므로 cleanup이 마스킹 사본으로 바꿔 남긴다 |
| `pack.json` · `pack-a.md` · `pack-b.md` | pack | SKILL(검토자 프롬프트)·render(`pack.json`) | 출처 목록·마스킹 보고·팩 본문 — **`pack-a.md`·`pack-b.md`는 원문이라 cleanup이 지운다**(`pack.json`은 남는다) |
| `review-claude.json` · `review-codex.json` | SKILL(검토자) | SKILL(병합) · `review-validate` · render(부록 C) | SC-4 — cleanup이 문자열 값을 마스킹한 사본으로 바꿔 남긴다 |
| `findings.json` | SKILL(메인 병합) · verdict(`--resolve` 결정 영속화) | verdict·render | SC-5 — `head_sha` = `snapshot.head_sha` — cleanup이 마스킹 사본으로 바꿔 남긴다 |
| `verdict.json` | verdict | render | 판정 결과 — render는 `head_sha` ≠ `snapshot.head_sha`이거나 부재(비-early)면 리뷰 실패로 렌더 — `machineEvidence`에 미확보 링크 `raw`·`reason`이 복사되므로 cleanup이 마스킹 사본으로 바꿔 남긴다 |
| `codex.prompt` · `codex.out` · `codex.sh` · `codex.pid` | SKILL | cleanup | Codex 실행 파일(원시 — 보존 금지) |
| `zip/<파일명>` · `worktree/` · `blobs/` · `baseline/` | deploy·collect·check | cleanup | 임시 산출물(F7) — `baseline/`은 원문이라 cleanup이 지운다(pack이 이미 소비) |

**산출물 수명주기(cleanup — F5·F7)**: 원문(`worktree/`·`zip/`·`blobs/`·`codex.*`·`pack-a.md`·`pack-b.md`·`baseline/`)은 삭제. `mr.json`·`check.json`·`deploy.json`·`review-*.json`·`findings.json`·`verdict.json`은 **문자열 값**(키 이름 제외)에 어댑터 `mask` + 엔진 `SECRET_MASK`를 적용한 사본으로 덮어써 남긴다 — `--resolve` 재계산(verdict·render)·재리뷰 입력으로 충분하다. `deploy.json`(zip 파일명·주석·API 오류 문자열)·`verdict.json`(`machineEvidence`에 복사된 미확보 링크 `raw`·`reason`)도 MR 원문이 흘러드는 파일이라 「원문 없음」으로 가정하지 않는다(plan R4-1). `snapshot.json`·`pack.json`·리포트는 그대로(경로·SHA·카운트·패턴 이름만, 리포트는 저장 시 마스킹). 파싱 불가 JSON은 마스킹할 수 없으므로 지운다.

**`mr.json`**:
```json
{ "project": { "name": "", "id": 0, "checkout": "<절대 경로|null>", "deployExempt": false }, "iid": 0,
  "title": "", "description": "", "state": "opened", "updated_at": "<ISO>", "web_url": "",
  "author": { "id": 0, "username": "" }, "reviewers": [{ "id": 0, "username": "" }],
  "source_branch": "", "target_branch": "", "api_head": "<40자>", "changes_count": "<\"25\"|\"25+\"|null>", "diff_refs": { "base_sha": "", "head_sha": "", "start_sha": "" }, "detailed_merge_status": "", "has_conflicts": false,
  "approved_by": ["<username>"],
  "diffs": [{ "old_path": "", "new_path": "", "new_file": false, "renamed_file": false, "deleted_file": false, "too_large": false, "diff": "" }],
  "overflow": "<true|false|null>", "api_failures": ["<changes|closes_issues|versions|approvals>"],
  "notes": [{ "id": 0, "system": false, "author": { "id": 0, "username": "" }, "created_at": "<ISO>", "body": "" }],
  "description_changed_at": "<ISO|null>",
  "closes_issues": [{ "iid": 0, "project_id": 0, "title": "", "description": "", "updated_at": "<ISO>", "web_url": "" }],
  "versions": [{ "head_commit_sha": "", "base_commit_sha": "", "start_commit_sha": "" }],
  "collected_at": "<ISO>" }
```
- `notes`는 `system: true`도 보존한다(「changed the description」 시각 산출용) — `description_changed_at` = system note 본문이 `changed the description`으로 시작하는 것 중 최신 `created_at`, 없으면 `null`.
- `overflow` = `/changes`의 `overflow`(`true`·`false`), **조회 실패면 `null`(모름)**. `api_failures` = 실패한 보조 조회 이름 목록(`changes`·`closes_issues`·`versions`·`approvals` — 메타·diffs·notes 실패는 collect 자체가 `ERR`). 실패를 `false`·빈 목록으로 바꾸지 않는다(fail-closed — verdict가 `M-api-<name>`으로 받는다). `too_large` = API `too_large` 또는 (`overflow !== false` 이고 diff 비어 있음).
- **워크트리 모드의 `diffs`는 API 목록이 아니라 git 정본**(`git diff -z --no-renames --name-status base..head` + 파일별 `git diff`) — API overflow로 빠진 파일 항목도 포함한다(check의 기준선 후보 탐색·pack의 문서 지도·deploy가 같은 목록을 쓴다). 이때 `overflow`는 `false`, `renamed_file`은 항상 `false`(이름 변경 = 삭제 + 추가).

**`snapshot.json`**:
```json
{ "mode": "worktree|diff-only", "target_sha": "", "base_sha": "", "head_sha": "", "checkout": "<절대|null>", "worktree": "<절대|null>",
  "attempts": 1, "unrecovered": ["<path>"], "rebuilt": ["<path>"], "diff_list_complete": true, "api_failures": ["<name>"], "fetched_at": "<ISO>" }
```
- `diff_list_complete`: 워크트리 모드는 항상 `true`(git diff 정본). diff-only는 `overflow === false || (changes_count 가 정수이고 "+" 없음이고 ≤ 수신 diffs 수)` — API overflow 로 파일 항목이 통째로 빠졌을 가능성을 못 배제하면(`overflow`가 `true`·`null`) `false`(fail-closed) → verdict 기계 증거 `M-diff-list`(HOLD_EVIDENCE 이상). `mr.json.changes_count` = 메타 `changes_count` 문자열("25"·"25+"·`null`). `api_failures` = `mr.json.api_failures` 복사(verdict가 snapshot만 읽는다).
- `mode: worktree` — `head_sha` = fetch한 `refs/mr-review/<iid>/head`가 가리키는 SHA(= `mr.json.api_head`와 같아야 함 — 다르면 collect가 1부터 다시, 최대 3회, 초과 시 exit 3 `HEAD_MOVED`). `target_sha` = fetch 직후 `origin/<target>`. `base_sha` = `merge-base`.
- `mode: diff-only` — `head_sha` = `api_head`, `base_sha`·`target_sha` = `versions[0].base_commit_sha`(없으면 `diff_refs.base_sha`). **`versions[0].head_commit_sha`·`diff_refs.head_sha`가 `api_head`와 다르면(수집 중 push) 재수집 — 최대 3회, 초과 시 exit 3 `HEAD_MOVED`**(서로 다른 head의 메타·diff·raw를 한 스냅샷으로 섞지 않는다, F6). **검토 루트 `<work>/blobs/head/`는 잘림 유무와 무관하게 항상 만들고 삭제되지 않은 모든 변경 파일의 head 원문을 그 SHA로 받는다**(task-07의 검토자 cwd·파일 전문 위치). `unrecovered` = head 원문을 받지 못했거나 양쪽 blob으로 diff를 재구성하지 못한 변경 파일. `rebuilt` = 재구성에 성공해 `mr.json.diffs[*].diff`를 교체한 파일. 새 `collect`는 이전 실행의 `check.json`·`deploy.json`·`pack*`·`review-*.json`·`findings.json`·`verdict.json`·`baseline/`·`blobs/`를 먼저 지운다.

**`check.json`**:
```json
{ "contract": { "found": true, "policyId": "<계약의 Policy 값|null>", "policyStatus": "채움|채움(구버전)|자리표시자|없음",
    "lines": [{ "name": "Policy", "status": "채움|채움(구버전)|자리표시자|없음", "value": "" }], "complete": false, "incompleteLines": ["<name>"] },
  "track": "경량|정식|핫픽스|미기재",
  "baselineType": "문서 링크|MR 본문 배경|이슈|서술만|빈칸·자리표시자|칸 없음",
  "baselineLinks": [{ "raw": "", "kind": "repo|issue|body|other", "project": "<이름|null>", "project_id": 0, "project_url": "<URL 의 /-/ 앞 전체 — URL 링크만>", "ref": "", "path": "", "refpath": "<blob 뒤 원문 — repo 만>", "resolved_sha": "<40자|null>", "pinned": true,
                      "status": "확보|미확보", "reason": "", "file": "baseline/1.md", "version": "<sha|updated_at|null>" }],
  "reason": { "why": true, "what": true, "source": "body|issue|none", "text": "" },
  "baselineCandidateFiles": ["<path>"],
  "baselineConfirm": { "status": "있음|없음|낡음|해당 없음", "note_id": 0, "note_at": "<ISO|null>", "changed_at": "<ISO|null>" },
  "attachments": [{ "url": "", "kind": "zip|doc|log|other", "filename": "", "secret": "", "where": "body|note" }],
  "attachmentClaimedButMissing": false,
  "deployRequired": true, "deployExempt": false, "deployNote": "<본문 「배포본」 줄|null>",
  "rebase": { "need": false, "detailed_merge_status": "" },
  "reviewerMismatch": false,
  "priorVerdicts": [{ "note_id": 0, "author": "", "policy": "", "sha": "", "kind": "", "verdict": "", "trusted": true, "reason": "" }],
  "authorTokens": [{ "note_id": 0, "token": "FIXED", "arg": "<sha|null>", "created_at": "" }],
  "ignoredComments": [{ "note_id": 0, "author": "", "reason": "" }],
  "rereview": { "active": false, "prior_head": null, "prior_verdict": null, "prior_note_id": null,
                "priorReport": "<이전 리포트 경로|null>", "priorBlocking": [{ "id": "F3|M-deploy|null", "type": "DEFECT|MISSING_EVIDENCE|DESIGN_DRIFT|null", "title": "<제목|null>", "source": "comment|report|missing" }], "priorBlockingComplete": "<true|false|null>" },
  "earlyExit": { "would": false, "reason": "", "draftVerdict": "RETURN_TO_DESIGN|HOLD_EVIDENCE|null" } }
```
- `contract.lines[*].status`: 값이 비어 있거나 꺾쇠 `<…>`·`#`만이면 `자리표시자`, 줄 자체가 없으면 `없음`, `Policy` 값이 `acceptedIds`에 있으나 `judgeId`와 다르면 `채움(구버전)`, 그 밖 `채움`. `complete` = 10줄 모두 `채움`/`채움(구버전)`. `Policy` 값이 `acceptedIds`에 없으면 `자리표시자`(알 수 없는 ID = 미완).
- `baselineType` 판정: Baseline 줄 값에 저장소 blob 링크(`/-/blob/<ref>/<path>`) 있음 → `문서 링크`; `#<n>`·`/-/issues/<n>` → `이슈`; 「배경」·`MR 본문` 문구 → `MR 본문 배경`; 자리표시자 → `빈칸·자리표시자`; 줄 없음 → `칸 없음`; 그 밖 비어 있지 않은 글 → `서술만`.
- `baselineConfirm`: 경량일 때만 평가. 댓글 작성자가 `reviewers` 또는 `trustedReviewers`이고 본문 첫 줄이 `baselineConfirm` 정규식에 맞으면 후보. 최신 후보의 `created_at` < `description_changed_at`이면 `낡음`. 정식·핫픽스 = `해당 없음`.
- `baselineLinks` 수집 범위 = Baseline 줄의 링크·`#n` + `closes_issues` + **MR 본문 「배경」 절의 `#n`·이슈 URL**(프로젝트·IID로 중복 제거). `closes_issues`의 `project_id`가 어댑터에 없으면 `project:null`·`미확보`(현재 프로젝트로 대체하지 않는다). 저장소 링크의 `ref`/`path` 경계는 URL 첫 세그먼트가 아니라 **그 저장소의 branch/tag API로 긴 후보부터 해소**한다(`feature/topic` 브랜치 지원 — SHA permalink만 첫 세그먼트 확정). **URL 링크(저장소·이슈)는 `project_url`을 보존하고 해소 때 등록 프로젝트의 `web_url`과 대조해 다르면 `미확보`**(SC-2 — basename만 같은 범위 밖 링크를 확보로 기록하지 않는다; `#n`·`closes_issues`는 `project_id`가 정체성이라 대조 없음). 이슈의 댓글 조회 실패는 「댓글 없음」이 아니라 `미확보`.
- `priorVerdicts[*].trusted` = 작성자가 `reviewers`∪`trustedReviewers`에 있고 **MR 작성자가 아님**. `rereview.active` = 신뢰 이전 판정 중 최신의 `sha`가 `snapshot.head_sha`와 다름(7자 이상 접두 비교).
- `rereview.priorBlocking`(재리뷰일 때만 — 아니면 `[]`·`priorBlockingComplete:null`) = 그 판정 댓글 「4. 차단 발견」의 **전체** 항목: 댓글 줄(`- <id> <type> — <제목>`, `source:comment`) + 40줄 축약 줄 `- … 외 n건(차단 — 전부 부록 D 에 있음): F9, F10`의 id 들을 이전 리포트 `<reportDir>/<프로젝트>-<iid>-<prior_head 7자>.md` 부록 D 에서 복원(`source:report`). 리포트가 없거나 부록 D 에 없으면 `title:null`·`source:missing`. `priorBlockingComplete` = 모든 항목에 `title`이 있음 — `false`면 verdict `M-rereview`(§5.6 「이전 차단 발견마다」 확인을 완료한 것으로 취급하지 않는다, plan R4-3).
- `reason.source` = 본문 「배경」에 **실내용**(①·② 표지와 꺾쇠 자리표시자 `<…>`를 뺀 글)이 있을 때만 `body`, 없으면 연결 이슈 원문이 있을 때 `issue`, 그 밖 `none`. 양식 문구만 남은 본문은 「없음」(§5.2, plan R4-4).
- `earlyExit.would` = `(incompleteLines 중 Baseline 외 줄 있음) || (baselineType ∈ {빈칸·자리표시자, 칸 없음} && baselineCandidateFiles.length === 0)` — **Baseline 줄만 미완이고 후보 문서가 있으면 `false`**(§5.2 후보 관련성 검토 경로 보장 — Baseline 미완은 `incompleteLines`로 verdict의 기계 증거 부족에 남는다). `draftVerdict` = 기준선 없음이면 `RETURN_TO_DESIGN`, 아니면 `HOLD_EVIDENCE`.

**`deploy.json`**:
```json
{ "applicable": true, "reason": "<해당 없음 사유|null>",
  "expected": { "deploy": ["<path>"], "deleted": ["<path>"] },
  "zip": { "attachment": "<filename|null>", "downloaded": false, "comment_sha": "<string|null>", "entries": ["<path>"] },
  "bodyDeletedList": ["<path>"],
  "result": "일치|불일치|대조 불가|zip 누락|해당 없음",
  "mismatches": [{ "kind": "comment_sha|missing_in_zip|extra_in_zip|bytes|deleted_list|download|corrupt", "path": "<path|null>", "detail": "" }] }
```
- `applicable` = `!deployExempt && (expected.deploy.length + expected.deleted.length > 0 || bodyDeletedList.length > 0)` — 기대 변경이 없어도 본문에 삭제 목록이 있으면 해당(zip 단계는 건너뛰고 ④ 삭제 목록 비교만, `reason` = 「운영 배포 대상 변경 없음 — 본문 삭제 목록만 대조(④)」) → 기대에 없는 삭제 지시는 `deleted_list` 불일치 → `M-deploy`(plan R4-2). 둘 다 비면 `applicable:false`·「해당 없음」. `expected`는 `--no-renames` 기준 `git diff --name-only --diff-filter=ACMR|D base..head`를 `deploy.targets`로 걸러 `deploy.excludes`를 뺀 것. diff-only 모드는 `mr.json.diffs`로 같은 목록을 계산하되 `bytes` 대조는 `대조 불가`.
- 결과 순서: zip 첨부 없음 + `expected.deploy` 비어 있지 않음 → `zip 누락`; 다운로드 실패·zip 손상(central directory·local header signature·**local header ↔ central directory 파일명·압축 방식 불일치**·**CRC-32·비압축 크기 불일치** 포함) → `대조 불가`; 그 밖 mismatches 비면 `일치`, 아니면 `불일치`. `bodyDeletedList`는 본문 「배포본」 항목 아래 목록(줄 시작 `-`·`*`·숫자. 또는 코드펜스 안 한 줄 한 경로)에서 뽑는다. `expected.deleted`와 집합 비교(순서 무관).

**`pack.json`**:
```json
{ "sources": [{ "id": "S1", "kind": "doc|wiki|baseline|issue|adapter", "ref": "<docsRoot 기준 경로@sha[#절] | repo:<경로>@<head7>[#절] | 위키 페이지명 | baseline/1.md>", "exportAllowed": true, "inPackB": true, "lines": 0, "missing": false }],
  "mask": { "applied": { "phone": 0 }, "residual": [{ "name": "", "where": "pack-b|body|note" }], "ok": true },
  "wikiTerms": ["<diff 추가 줄에서 뽑은 테이블명·선언 식별자>"],
  "packA": "pack-a.md", "packB": "pack-b.md", "codexSkipped": false, "codexSkipReason": null }
```
- `wikiTerms` = 위키 grep 검색어 중 변경 코드에서 뽑은 것(`codeTerms` — diff **추가 줄**의 SQL 테이블명(FROM/JOIN/INTO/UPDATE/TABLE 뒤·`@Table(name=)`)·선언 식별자(class/interface/enum/record/function/def·MyBatis `<select id>`), 길이 ≥ 4·SQL 예약어 제외·상한 40). 검색어 전체 = MR 제목·경로(용어집 대조 텍스트에는 추가 줄 본문도 포함) + 파일 basename + `wikiTerms`(spec §5.3-2 「변경 파일명·기능명·테이블명」, plan R4-5 — 스크립트 규칙, 어댑터 키 없음).
- `exportAllowed`(= 팩 B 투입) 규칙: `doc`(공통 문서·`repo:` 대상 저장소 문서 모두)·`adapter`·`issue`·본문 기준선 = `true` · `wiki` = 루트의 `export` · **`baseline`(저장소 링크) = 링크의 프로젝트가 리뷰 대상 프로젝트이거나 `docsRoot`와 같은 체크아웃인 프로젝트일 때만 `true`** — 어댑터 `projects` 등록은 수집 가능 범위이지 전송 허가가 아니다(어댑터 §6). `missing` = 문서 지도 규칙 문서의 파일·절 누락(계속 진행) — **공통 문서의 필수 참조(`policy.docs`·`docsMap.always`) 누락은 `pack`이 `ERR` exit 2**(fail-closed). **`repo:` 참조는 필수 여부와 무관하게 누락 = `missing:true`로 계속**(SC-2).

**`verdict.json`**:
```json
{ "status": "determined|undetermined|review-failed",
  "verdict": "APPROVE|HOLD_EVIDENCE|CHANGES_REQUESTED|RETURN_TO_DESIGN|null",
  "contractPolicyId": "<check.contract.policyId 또는 judgeId>", "judgeId": "", "head_sha": "",
  "defects": ["<finding id>"], "evidence": ["<finding id 또는 기계 항목 id>"], "unresolved": ["<finding id>"],
  "baselineMissing": false, "returnToDesignBy": ["<finding id>"],
  "branches": { "<unresolved id>": { "confirmed": "<판정>", "dismissed": "<판정>" } },
  "machineEvidence": [{ "id": "M-contract-Baseline", "kind": "contract|diff|deploy|baseline|api|rereview", "detail": "" }],
  "reasons": ["<한 줄>"] }
```
- `machineEvidence` 투입원: 계약 미완 줄(`M-contract-<name>`) · 미복원 diff(`M-diff-<n>`) · diff-only 목록 불완전(`M-diff-list`) · 배포본 비일치(`M-deploy`) · 기준선·이슈 원문 미확보(`M-baseline-<n>`) · **보조 API 조회 실패 `M-api-<name>`**(`snapshot.api_failures` — `closes_issues`는 모든 모드, `changes`·`versions`는 diff-only만, `approvals`는 판정 입력 아님) · **재리뷰 이전 차단 발견 목록 불완전 `M-rereview`**(`check.rereview.active && priorBlockingComplete === false`, plan R4-3). 하나라도 있으면 `HOLD_EVIDENCE` 이상.

### SC-4. 검토자 출력 스키마 — `review-claude.json` · `review-codex.json` (P5, spec §5.4)

```json
{ "reviewer": "claude|codex", "head_sha": "<40자>", "lensesSeen": ["L1"],
  "findings": [{ "lens": "L5", "type": "DEFECT|MISSING_EVIDENCE|DESIGN_DRIFT|FOLLOW_UP", "title": "", "file": "<저장소 상대 경로|null>", "line_start": 0, "line_end": 0,
                 "evidence": "<근거 문서 출처 id 또는 코드 경로>", "scenario": "<실패 시나리오 — DEFECT·DESIGN_DRIFT 필수>", "confidence": "high|medium|low",
                 "recommendation": "", "fixableInDesign": "yes|no", "brokenPremise": "<no일 때>" }],
  "intent": [{ "criterion": "", "result": "PASS|FAIL|UNKNOWN", "location": "", "basis": "작성자 주장|코드로 확인" }],
  "baselineCandidateRelevant": true,
  "outsideWorktreePaths": ["<절대 경로>"] }
```
- `review-validate --file <path> --head <snapshot.head_sha> --reviewer <claude|codex>`(CLI)가 검사: 최상위 키 5종(`reviewer`·`head_sha`·`findings`·`intent`·`baselineCandidateRelevant`) 존재, `findings[*].type` 4종, DEFECT·DESIGN_DRIFT면 `scenario` 비어 있지 않음, `confidence` 3종, `fixableInDesign` 2종, **`head_sha` = 기대 head · `reviewer` = 기대 검토자**(이전 head 의 결과·검토자 혼동은 INVALID — 메인이 head 를 고쳐 쓰지 않는다, F6). 통과 = stdout `VALID` exit 0, 실패 = `INVALID <이유>` exit 1. `outsideWorktreePaths`는 선택(Codex 출력 경로 감시 결과를 메인이 채운다 — D16 ⓑ).

### SC-5. 병합 발견 — `findings.json` (메인이 쓴다, verdict·render가 읽는다)

```json
{ "head_sha": "", "validReviewers": ["claude", "codex"], "crossChecked": true,
  "baselineCandidateRelevant": true, "baselineCandidateReason": "<유효 결과 전부 일치 | 단일 모델 값 | 상충 — 메인이 후보 문서를 읽고 판정한 근거 한 줄>",
  "findings": [{ "id": "F1", "fingerprint": "<file + 정규화 title>", "source": "both|claude|codex", "lens": "", "type": "", "blocking": true,
                 "title": "", "file": "", "line_start": 0, "line_end": 0, "evidence": "", "scenario": "", "confidence": "", "recommendation": "",
                 "fixableInDesign": "yes|no", "brokenPremise": "", "unresolved": false, "resolution": "confirmed|dismissed|null", "dismissReason": "" }],
  "intent": [{ "criterion": "", "result": "", "location": "", "basis": "" }],
  "outsideWorktreePaths": [] }
```
- `blocking` = `type ∈ {DEFECT, MISSING_EVIDENCE}` 또는 `DESIGN_DRIFT`이면서 어댑터 렌즈의 차단 승격 조건(산문 — 메인이 판단)에 해당. `FOLLOW_UP`은 항상 `false`.
- `unresolved: true` = §5.5-2 상충 또는 한쪽만의 낮은 확신 차단 후보를 메인이 코드로 확인하지 못함. `resolution`은 `--resolve <id>=confirmed|dismissed`로만 채워지며 `verdict`가 이 파일에 **영속화**한다(호출을 나눠도 유지 — `unresolved`는 `false`로). `dismissReason`은 메인이 리뷰어 말대로 미리 적고 리포트 「리뷰어 결정」·부록 D에 남는다.
- `head_sha` = `snapshot.head_sha`. `verdict`는 다르면 `review-failed`(이전 실행의 검토 결과로 판정하지 않는다 — F6).

### SC-6. CLI 계약 — `node <Base directory>/scripts/mr-review.mjs <서브커맨드> …` (`<Base directory>` = 스킬 로드 때 표시되는 「Base directory for this skill」)

| 서브커맨드 | 인자 | 출력(stdout 첫 줄) · exit |
|---|---|---|
| `collect` | `--adapter <파일> --project <이름> --iid <n> --work <dir> [--diff-only]` | `COLLECTED <mode> head=<sha7> base=<sha7> target=<sha7> attempts=<n> unrecovered=<n>` exit 0 · `ERR HEAD_MOVED …` exit 3(3회 재수집 뒤에도 API head ≠ fetch head) · 그 밖 `ERR <메시지>` exit 2 |
| `check` | `--adapter --work` | `CHECKED complete=<bool> baseline=<type> earlyExit=<bool> rereview=<bool>` exit 0 |
| `deploy` | `--adapter --work` | `DEPLOY <result>` exit 0(결과가 무엇이든 0 — 판정은 verdict 몫) |
| `pack` | `--adapter --work` | `PACKED sources=<n> codexSkipped=<bool>` exit 0 |
| `review-validate` | `--file <path> [--head <40자>] [--reviewer claude\|codex]` | `VALID` exit 0 · `INVALID <이유>` exit 1 — `--head`·`--reviewer`가 있으면 원본 결과의 `head_sha`·`reviewer`와 일치해야 VALID(SKILL은 항상 둘 다 준다) |
| `verdict` | `--adapter --work [--resolve <id>=<confirmed\|dismissed>]...` | `VERDICT <status> <verdict\|->` exit 0 · `findings.json` 없음 → exit 2 |
| `render` | `--adapter --work [--early] [--out <파일>]` | `REPORT <경로>` exit 0 — `--out` 생략 시 `<reportDir>/<프로젝트>-<iid>-<sha7>.md` |
| `cleanup` | `--adapter --work` | `CLEANED worktree=<bool> zip=<n> raw=<n> masked=<n>` exit 0 — `raw` = 지운 원문 파일 수(`codex.*`·`pack-*.md`·`baseline/*`), `masked` = 마스킹 사본으로 바꾼 JSON 수(SC-3 산출물 수명주기) |

- 공통: `--adapter`는 `MR_REVIEW_ADAPTER` 환경변수로 대체 가능(인자 우선). 모든 오류는 stderr 없이 stdout `ERR <메시지>` 한 줄 + exit 2(SKILL이 첫 줄만 읽는다). JSON 쓰기는 `JSON.stringify(v, null, 2)`.
- 셸 블록 표기: bash 위치 인자는 `${N}`(1.1.1 D2) — SKILL.md 셸 블록에 맨 `$`+숫자를 쓰지 않는다.

### SC-7. 게이트 명령 (repo에 npm 게이트 없음 — review-loop(impl) §1 impl 게이트는 이 묶음으로 갈음)

```bash
node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs tests/mr-review/deploy.test.mjs tests/mr-review/pack.test.mjs tests/mr-review/report.test.mjs   # T1 — 파일 지정(폴더 인자 금지, Node 21+)
for f in dev-workflow/skills/mr-review/scripts/mr-review.mjs dev-workflow/skills/mr-review/scripts/lib/*.mjs; do node --check "$f" || echo "CHECK_FAIL $f"; done   # T2
node --test tests/orchestrate/orchestrate.test.mjs                                                                   # T3 — 기존 54/54 회귀
git diff <base> --stat -- dev-workflow/hooks dev-workflow/skills/dev-cycle dev-workflow/skills/doctor dev-workflow/skills/harden-spec dev-workflow/skills/orchestrate dev-workflow/skills/review-loop dev-workflow/skills/setup dev-workflow/skills/ui-mockup dev-workflow/skills/writing-plans-split | wc -l   # T4 — 0
grep -nE '\$[0-9]' dev-workflow/skills/mr-review/SKILL.md | wc -l                                                    # T5 — 0 (1.1.1 D2)
grep -nE '(172\.|safetyreport|안전신문고|kimkfc|gguii)' dev-workflow/skills/mr-review/ tests/mr-review/ README*.md -r | wc -l   # T6 — 0 (D10 — 프로젝트 식별자 유출 없음)
git log --format=%B <base>..HEAD | grep -iE 'co-authored|generated with|claude-session' | wc -l                    # T7 — 0 (no-AI-trace)
```

- `<base>` = 구현 착수 직전 main SHA(plan 루프 종결 커밋). 테스트 전용 환경변수: `MR_REVIEW_GLAB`(가짜 `glab` 경로 — 미설정이면 PATH의 `glab`), `MR_REVIEW_HOME`(위키 `~` 해소용 — 미설정이면 `os.homedir()`). 운영 문서에 쓰지 않는다.

### SC-8. 커밋 규칙

- main 직접 커밋(워크트리·MR 없음). **push 금지**(공개 배포 = 사용자 확인).
- AI 서명·트레일러(`Co-Authored-By`·`Generated with`·`Claude-Session`) 금지 — 글로벌 no-AI-trace 규칙.
- 접두: `test(mr-review)`·`feat(mr-review)`·`docs(readme|spec|plan)`·`release:` — 메시지 본문은 한국어, 끝에 spec 절 참조.
- task당 1커밋(08은 2커밋) + 완료 기록 커밋(계약 ④).

## Task table

| # | title | status | file | deps | outcome |
|---|-------|--------|------|------|---------|
| 01 | 테스트 하네스 · 어댑터 파서 · CLI 골격 | [ ] | [task-01](2026-10-21-mr-review-skill/task-01-adapter-and-harness.md) | — | |
| 02 | GitLab 수집 · 스냅샷 고정 · diff-only 복원 (collect) | [ ] | [task-02](2026-10-21-mr-review-skill/task-02-collect.md) | 01 | |
| 03 | 작성 규칙 검사표 · 댓글 신뢰 · 기준선 원문 (check) | [ ] | [task-03](2026-10-21-mr-review-skill/task-03-check.md) | 02 | |
| 04 | 배포본 zip 대조 (deploy) | [ ] | [task-04](2026-10-21-mr-review-skill/task-04-deploy.md) | 02 | |
| 05 | 컨텍스트 팩 · 마스킹 (pack) | [ ] | [task-05](2026-10-21-mr-review-skill/task-05-pack.md) | 03 | |
| 06 | 판정 계산 · 리포트 · 비밀값 제거 · 정리 (verdict/render/cleanup) | [ ] | [task-06](2026-10-21-mr-review-skill/task-06-report.md) | 03, 04, 05 | |
| 07 | SKILL.md — 절차·두 검토자·병합·재리뷰 | [ ] | [task-07](2026-10-21-mr-review-skill/task-07-skill-md.md) | 06 | |
| 08 | README 3종 · manifest description | [ ] | [task-08](2026-10-21-mr-review-skill/task-08-readme-manifest.md) | 07 | |

**구현 순서** = 표 번호 순서로 디스패치한다(03·04는 02 뒤 병렬 가능, 05는 03 뒤).

**spec ↔ task**: G1·§5.2 → 03 · §5.2b·D6 → 04 · §5.1·F6 → 02 · §5.3·D4·D14·F4·F5 → 05(마스킹)·06(산출물 제거) · §5.4·§5.5·D9·D11·F2·F3 → 06(verdict)·07(SKILL) · §5.6 → 03(rereview)·07 · §5.7·F7 → 06·07 · G5 → 05·07 · D10 → SC-7 T6 · §4 → 01(SC-2) · S1~S4 → task-11.

**SDD 실행 범위 = 위 표(task-01~08) 전부.** 위 표가 전건 `[x]`이면 7 impl 완료다(dev-cycle 7단계 판별 — 아래 「SDD 밖 task」 표는 판별 대상이 아니다).

**review-loop(impl) 입도**: 통합 1회(task-01~08). base = 구현 착수 직전 main SHA. **§1 impl 게이트 = SC-7 T1~T7**. 보안 판정은 기동 전 사용자 1회 확인 — spec 루프는 `no (사용자 확인)`였다(접촉면 = 외부 전송·개인정보 경계 — impl에서는 마스킹 코드가 실체화되므로 `yes`를 권한다).

## SDD 밖 task (9단계 이후 — dev-cycle 7단계 판별·SDD convergence 대상 아님)

| # | title | status | file | deps | outcome |
|---|-------|--------|------|------|---------|
| 09 | 릴리스 1.3.0 — **9단계, SDD 디스패치 대상 아님** | [ ] | [task-09](2026-10-21-mr-review-skill/task-09-release-1-3-0.md) | 01~08 + review-loop(impl) 종결 | |
| 10 | 어댑터 확정본 — **프로젝트 공통 문서 저장소, SDD 디스패치 대상 아님** | [ ] | [task-10](2026-10-21-mr-review-skill/task-10-adapter-final.md) | 09 + push·설치 갱신 | |
| 11 | S1 측정(표본 20건) · 첫 실사용 리포트 — **트랙 완료 조건** | [ ] | [task-11](2026-10-21-mr-review-skill/task-11-s1-field-run.md) | 10 | |

task-09(릴리스)·10(어댑터 확정본)·11(S1·실사용)은 9단계 이후라 SDD가 디스패치하지 않는다 — 8 review-loop(impl)가 성공 종결(이 문서 말미 impl ledger 종결 행)한 뒤 그 세션 또는 새 세션이 task-09를, 릴리스·push·설치 갱신 뒤 사용자 PC 세션이 task-10·11을 단독 실행한다. **완료 권위 = 이 커밋된 표 + 각 task의 AC**(SDD progress ledger에 기록하지 않는다). 실행자는 완료 시 표 행 `[x]`·outcome을 쓰고 이 파일을 즉시 커밋한다. 트랙 완료 = 11행 `[x]`.

**impl ledger 종결 행 계약(task-09 게이트 ①이 소비)**: review-loop(impl)는 성공 종료 시 impl ledger 절 안에 `**종결(YYYY-MM-DD)**: `로 시작하는 한 줄을 쓰고 `미확인 FIXED 큐 0` · `미판정 blocking 0` · `최종 verdict pass`(확인 라운드 없는 빠른 종료면 `빠른 종료`) 세 문구를 담는다.

**트랙 밖(여기서 하지 않는다)**: 고도화 포크 승격·포크 내부 MR(spec §9) · GitLab 쓰기(D8) · 스킬 포장 분리(spec §9 — 첫 운용 뒤) · 다른 리뷰어 PC 배포(D2 — 결과 뒤).

## 적대검증 ledger (plan)

보안 크리티컬: no (호출자 지정) — 접촉면 외부 전송·개인정보 경계(마스킹·전송 허용 목록 코드 계획) 감지

- 루프: base `9017d1e`(9017d1e00a595993b73b2a684bdb74a6b655c5fc, 호출자 지정 — spec 루프 종결 커밋 = plan 착수 직전, diff = plan만) · branch `docs/mr-review-skill-design` · 예산 max 5 · confirm 2 · auto 3 · 수동 모드.
- 사전 게이트: 형식 관문 ①②④ = repo에 CLAUDE.md/AGENTS.md 분할 규약 없음 → 스킵(참고: Execution contract 블록 = 설치본 writing-plans-split canonical과 동일 · §Shared Contracts · status·outcome 컬럼 실재) · ③ spec ledger fingerprint 컬럼 실재 · 대장 대기 0.
- score 산식 = 전환용(미확인 FIXED 큐 제외, §2c 분류 직후·수정 전 스냅샷, weight c4/h3/m1). R1은 분류 전 중단(컨텍스트 넛지)이라 재개 세션(2026-10-21 16:5x)이 자동 모드로 §2c 처리 — 수신 시점 모드 유지, 적대 소진 1 불변.
- 인라인 코드 검증 = task-01~06 4-backtick 블록을 scratch 로 추출해 `node --test` 실행(R1 수정 전 47/47 재현 → R1 수정 후 51/51 → R2 수정 후 52/52 → R3 수정 후 **59/59**: adapter 8·collect 9·check 10·deploy 10·pack 8·report 14).
- R3 도 분류 전 중단(컨텍스트 넛지, 소진 3 저장)이라 재개 세션(2026-10-21 17:3x, 오르카 후계)이 수신 시점 모드 = 자동으로 §2c·§2f 처리. 전환 신호 1 은 「2회 연속 비감소(s_n ≥ s_{n-1} ≥ s_{n-2})」라 22→16→16 은 미발화(이전 핸드오프의 「16 이상이면 발화」 예상은 오독 — 정정). 소진 3 = auto-rounds → batch flush(적재 0건 — 통과) → 정밀 모드.
- R4 도 분류 전 중단(컨텍스트 넛지, 소진 4 저장)이라 재개 세션(2026-10-21 18:0x, 오르카 후계)이 수신 시점 모드 = **정밀**로 §2c·§2d 처리 — ESCALATE 즉시 질문 2건(R4-5 설계 선택지 4 · R4-2 R1-4 계열 재출현 → 사용자 결정) 모두 추천안 FIXED 채택, 나머지 3건 FIXED 후보. 수정 커밋 `f693a72`(scratch 62/62 = adapter 8·collect 9·check 11·deploy 11·pack 9·report 14). 전환 신호 1: 16→16→9 미발화 · 신호 2: FIXED 후보 5 미발화 → R5 적대(소진 5 = max → 신호 3 → 확인 모드).

| 라운드 | 모드 | HEAD | critical/high/medium (신규/잔존) | 전환용 score | 미확인 FIXED 큐 | verdict |
|---|---|---|---|---|---|---|
| R1 | 적대·자동 | `3f47b98` | 0/6/4 (신규 10) — 전부 FIXED 후보(기결정 재론 0·ESCALATE 0) | **22** | 0 → 수정 후 10 | needs-attention |
| R2 | 적대·자동 | `b5ff996` | 0/4/4 (신규 8 · R1 잔존 0 — 적대 비재출현, 큐 유지) — 전부 FIXED 후보(기결정 재론 0·ESCALATE 0) | **16** | 10 → 수정 후 18 | needs-attention |
| R3 | 적대·자동(수신 시점) | `4c50019` | 0/3/7 (신규 10 · R1·R2 잔존 0 — 적대 비재출현, 큐 유지) — 전부 FIXED 후보(기결정 재론 0·ESCALATE 0·루프 판정 2 = R3-6·R3-9 선택지 채택) | **16** | 18 → 수정 후 28 | needs-attention |
| R4 | 적대·정밀(수신 시점) | `f1fbc40` | 0/2/3 (신규 5 · R1~R3 잔존 0 — 적대 비재출현, 큐 유지) — 전부 FIXED(기결정 재론 0 · ESCALATE 즉시 2 = R4-2·R4-5 사용자 결정 FIXED) | **9** | 28 → 수정 후 33 | needs-attention |

| # | fingerprint (file · title · recommendation 요지) | severity | disposition | 근거 |
|---|---|---|---|---|
| R1-1 | task-07 §6 · 검토 결과 0개 분기가 verdict 를 건너뛰어 이전 verdict.json(APPROVE)이 재사용됨 · 0개 분기도 review-failed 저장 + render 가 검토자 수·head 일치 검증 + 새 수집 시 이전 판정 무효화 | high | FIXED | `6bf5e1b` — task-07 §6 0개 경로도 `verdict` 실행·`findings.head_sha` 기재 · task-06 `computeVerdict` findings head ≠ snapshot → review-failed, `renderReport` verdict 부재·head 불일치 → 리뷰 실패 렌더 · task-02 `collect` 가 하류 산출물(check·deploy·pack·review·findings·verdict·baseline·blobs) 선제 삭제 · SC-3 갱신 · 테스트(collect 잔존물 제거·report head 불일치) |
| R1-2 | task-07 §5 · 팩 B 밖 공통 입력(계약 10줄·검증 표)이 마스킹 없이 Codex 프롬프트에 들어감 · 비코드 입력은 마스킹된 자료에서만 또는 조립 단계에 동일 마스킹·잔존 검사(재리뷰 추가 입력 포함) | high | FIXED | `6bf5e1b` — task-07 §5 「Codex 비코드 입력은 팩 B에서만」(계약·검증 표·댓글은 팩 B 「## MR」 절 참조, 팩 B 밖은 diff·렌즈·스키마·고정 문구뿐) · §7 재리뷰 대조표는 note_id·토큰만, 이전 리포트 절은 마스킹 잔존 검사 후 복사 · 금지·AC·Cautions |
| R1-3 | task-05 pack · 어댑터 projects 등록 = 외부 전송 허가로 취급(대상 외 저장소 Baseline 원문이 팩 B 로) · 수집 가능 프로젝트와 전송 가능 출처 구분(SC-2·SC-3) | high | FIXED | `6bf5e1b` — pack 2단계 `exportable` = 이슈·본문 또는 링크 프로젝트 ∈ {대상 프로젝트, docsRoot 와 같은 체크아웃인 프로젝트}(어댑터 §6 원문 범위) · 그 밖은 팩 A 만 + `(Codex 미제공)` · SC-3 pack.json 규칙 명시 · 테스트(beta 원문 B 제외) |
| R1-4 | task-04 deploy · expected.deleted 가 비면 본문 삭제 목록을 대조하지 않아 잘못 추가된 삭제 지시가 통과 · 항상 집합 비교 + 회귀 테스트 | high | FIXED | `6bf5e1b` — ④ 삭제 목록을 기대 유무와 무관하게 집합 비교(순서 무관 — 기존 join 문자열 비교도 제거) · 회귀 테스트(기대 비고 본문만 Keep.java · 기대 ⊂ 본문) |
| R1-5 | task-02 collect · 정상 diff-only(잘림 없음)에서는 blobs/head 가 생기지 않아 task-07 의 검토자 cwd·파일 전문 위치가 없음(래퍼 exit 97) · diff-only 검토 루트를 항상 만들고 비삭제 변경 파일 head 원문을 고정 SHA 로 확보, 실패는 판정 전달 | high | FIXED | `6bf5e1b` — `rebuildDiffOnly` 가 `blobs/head/` 를 항상 만들고 비삭제 변경 파일 전부의 head 원문을 api_head 로 확보, 실패는 `unrecovered`(→ M-diff 증거 부족) · SC-3 snapshot 규칙 · 테스트(잘림 없는 diff-only 신규 + 기존 2건 보강) |
| R1-6 | task-07 · ERR 즉시 중단 경로에 cleanup 이 없어 F5·F7 이 제어 흐름에 미연결 · 수집 이후 모든 종료 경로의 공통 종료 절차 | high | FIXED | `6bf5e1b` — task-07 §0 「공통 종료 절차」(collect 이후 모든 종료 경로의 마지막 동작 = cleanup, 보고는 cleanup 뒤 마스킹 거쳐, cleanup ERR 시 잔존 경로 보고) · §8·금지·AC·Cautions 연결 |
| R1-7 | task-06 verdict · --resolve 결정이 findings 복사본에만 적용돼 호출 간 보존되지 않음, dismissReason 리포트 출력 경로 없음 · 결정·근거 영속화 + 리포트 출력 + 다회 resolve 테스트 | medium | FIXED | `6bf5e1b` — `cmdVerdict` 가 resolution 을 findings.json 에 영속화(unresolved=false) · render 「리뷰어 결정(--resolve)」 절 + 부록 D 에 근거 · SC-5 갱신 · 테스트(F1 기각 → 별도 호출 F2 확인 → CHANGES_REQUESTED, 블록에서 F1 제외) |
| R1-8 | task-05 pack · docText 의 missing 을 버려 필수 정책 문서·절 누락이 정상 출처로 등록됨 · 확보 상태를 pack.json 에 포함, 누락은 중단 또는 결정적 MISSING_EVIDENCE(선택 위키와 구분) | medium | FIXED **[루프 판정 — 선택지 2 중 「중단」 채택]** | `6bf5e1b` — 필수 문서(`policy.docs`·`docsMap.always`)의 파일·절 누락 = `PackError` ERR exit 2(fail-closed — 환경 결함이라 판정 입력이 아니라 중단으로 봄) · 규칙 문서(`docsMap.rules`) 누락 = `sources[*].missing:true` + 헤더 `(누락)` 표시로 계속 · SC-3 갱신 · 테스트. 대안(결정적 MISSING_EVIDENCE 투입)은 verdict 가 pack.json 을 읽어야 해 계약 확장 — 채택 안 함. **확인 임무 ③ 우선 감사 대상** |
| R1-9 | task-06 render · 부록 C·본문이 evidence·scenario·brokenPremise 를 버림(§5.7 원본 보존 미충족) · 부록에 마스킹 후 보존 | medium | FIXED | `6bf5e1b` — 부록 C 행에 근거·시나리오·설계 내 수정·깨진 전제 · 신규 부록 D(병합 발견 상세·리뷰어 결정: 근거·실패 시나리오·전제·resolution·dismissReason) · 마스킹은 전체 텍스트에 그대로 적용 · 테스트 |
| R1-10 | task-03 check · Baseline 자리표시자면 contract.complete=false 라 후보 문서가 있어도 earlyExit=true → §5.2 후보 관련성 검토 경로 도달 불가 · 다른 줄 완성 + Baseline 만 미완 + 후보 있음이면 검토 진행(Baseline 미완 기계 증거는 유지) | medium | FIXED | `6bf5e1b` — `would` = (Baseline 외 미완 줄 있음) ‖ (기준선 없음 ∧ 후보 0) · Baseline 미완은 incompleteLines 로 verdict 에 전달(APPROVE 불가) · SC-3·task-07 §3 문구 · 기존 테스트가 고정하던 반대 동작을 바꿈(+ 다른 줄 미완 사례). spec §5.2 문면(「계약이 미완이거나 … 후보 문서가 있으면 진행」)의 두 문장 중 후자를 따름 — spec 변경 없음 |

| R2-1 | task-06 render · 하드코딩 비밀값 리터럴이 리포트(부록 C·D)에 그대로 남음(어댑터 mask 는 개인정보용) · 비밀값 인용의 제거 경로를 원본 발견·최종 리포트에 동일 적용 + 회귀 사례 | high | FIXED | `1e4e75b` — 엔진 내장 `SECRET_MASK`(password·secret·api_key·token·authorization 값 · Bearer · PEM 블록 — 프로젝트 무관, D10 무관)를 어댑터 mask 뒤 리포트 전체에 적용, 파일:줄은 보존(§5.7) · 테스트(evidence 의 `db.password = "…"`·`api_key:` 제거) |
| R2-2 | task-02 collect · overflow 로 diff 목록에서 통째로 빠진 파일은 복원·판정 전달 경로 없음 · 목록 완전성 계약 + 미확보는 결정적 MISSING_EVIDENCE | high | FIXED | `1e4e75b` — `mr.json.changes_count` 보존, diff-only `snapshot.diff_list_complete` = `!overflow ‖ (changes_count 정수·"+" 없음·≤ 수신 수)`(모르면 false — fail-closed) · verdict `M-diff-list`(HOLD_EVIDENCE 이상) · SC-3 · 테스트(없음/"4"/"4+" 3경우 + verdict) |
| R2-3 | task-03 check · 미등록 프로젝트의 closes_issues 를 현재 프로젝트 이슈로 대체 · 원래 project_id·URL 보존, 미확보로 기록 | high | FIXED | `1e4e75b` — `project:null`·`project_id` 보존·`raw=web_url`, `resolveIssue` 가 미확보(`id 999`) · 테스트(999 의 #12 를 101 에서 읽지 않음) |
| R2-4 | task-06/07 · review-validate 가 head 형식만 검사하고 병합이 findings.head_sha 를 새로 적어 이전 head 검토 결과가 통과 · SC-4 검증에 기대 head·reviewer 전달, 불일치는 validReviewers 제외 | high | FIXED | `1e4e75b` — `review-validate --head <sha> --reviewer <name>`(`validateReview(obj, {head, reviewer})`) → 불일치 INVALID · task-07 §5 두 검토자 모두 인자 필수·실패 = 그 모델 제외(head 를 고쳐 쓰지 않음) · SC-4·SC-6 · 테스트(단위 + CLI) |
| R2-5 | task-07 §6-4 · baselineCandidateRelevant 를 「둘 다 true」로 계산해 단일 모델 모드에서 관련 후보가 무조건 기각 · 유효 결과만 통합, 상충 시 메인 확인 | medium | FIXED | `1e4e75b` — 유효 결과(`validReviewers`)만 대상 — 전부 true/false, 단일 모델이면 그 값, 상충이면 메인이 후보 문서를 직접 읽고 `baselineCandidateReason` 기재 · SC-5 필드 추가 · Cautions |
| R2-6 | task-03 check · MR 본문의 일반 `#n` 참조(종료 키워드 없음)는 수집 안 함(§5.1-5 위반) · 본문 이슈 참조 수집·중복 제거·미확보 보존 | medium | FIXED | `1e4e75b` — 「배경」 절의 `#n`·이슈 URL 을 수집 대상에 추가(프로젝트·IID 중복 제거, 다른 절의 `#3 항목` 오인 방지로 배경 절 한정) · SC-3 · 테스트(`이슈/spec: #88`) |
| R2-7 | task-04 deploy · zip 리더가 CRC 를 검증하지 않아 CRC 손상 zip 이 「일치」 · CRC32·크기·헤더 정합 검증, 실패는 corrupt | medium | FIXED | `1e4e75b` — `crc32()` 내장, `read()` 가 central directory 의 CRC·비압축 크기와 대조·범위 초과 검사 → `corrupt` → 「대조 불가」 · SC-3 결과 순서 문구 · 테스트(central CRC 만 뒤집은 zip) |
| R2-8 | task-03 check · BLOB_RE 가 blob 뒤 첫 세그먼트를 ref 로 취해 `feature/topic` 브랜치 링크 오해소 · 저장소 branch/tag 로 경계 해소·URL 디코딩 | medium | FIXED | `1e4e75b` — `refpath` 보존, `resolveRepoLink` 가 긴 후보부터 branch→tag API 로 최장 일치 해소(SHA permalink 만 첫 세그먼트 확정), 세그먼트 URL 디코딩 · SC-3 · 테스트(`feature/topic` + 최장 후보 먼저 호출 확인) |

| R3-1 | task-01 fixture mask · `Authorization:` 패턴이 인증 방식(Bearer)만 가리고 자격증명 값이 남음(residual 통과·SECRET_MASK 도 못 잡음) · 인증 방식+자격증명 전체 제거 패턴(fixture·task-10) + Bearer·Basic 회귀 | high | FIXED | `cbb2582` — 픽스처 `token` 패턴 = `(?<=…)(?:(?:Bearer\|Basic\|Token\|Digest)\s+)?[^\s\]]+` · `SECRET_MASK` 1번도 인증 방식 선택 소비 + `flags:'i'`(applyMask/residual 이 `flags` 지원) + 이미 가려진 자리 부정 전방탐색 · task-10 mask 매핑 행·검증 2단계에 Bearer 회귀 1줄 · 테스트(pack applyMask Bearer·Basic → `[masked:token]` 만, residual 0) |
| R3-2 | task-02 collect diff-only · head(메타)와 versions[0](base)의 head_commit_sha 를 대조하지 않아 중간 push 시 다른 head 자료가 결합 · 메타 head 와 일치하는 버전 선택·수집 중 head 변경 검출(재수집 또는 증거 부족) | high | FIXED | `cbb2582` — `diffHeadMismatch(mr)`(versions[0].head_commit_sha·diff_refs.head_sha ≠ api_head) → 재수집, 3회 뒤 `HEAD_MOVED` exit 3(워크트리 모드와 같은 처리) · SC-3 snapshot diff-only 규칙 · task-07 §2 안내 · 테스트(버전 head=DEAD → exit 3, 메타 3회, snapshot 미생성) |
| R3-3 | task-02/03 · /changes·/closes_issues·이슈 댓글 API 실패가 overflow=false·빈 목록·「확보」로 둔갑(R2-2 우회) · 실패와 빈 응답 구분, 미확보 상태 보존 → 결정적 MISSING_EVIDENCE, overflow 모르면 완전 판정 금지 | high | FIXED | `cbb2582` — `fetchMr` 가 실패 이름을 `api_failures`로, `/changes` 실패는 `overflow:null`(too_large·diff_list_complete 는 `!== false`/`=== false` 로 fail-closed) · snapshot 에 복사 · verdict `machineEvidence` `M-api-<name>`(closes_issues 전 모드, changes·versions 는 diff-only, approvals 제외) · check `resolveIssue` 댓글 조회 실패 = 미확보 · SC-3 mr/snapshot/verdict · task-07 §2 시작 요약 · 테스트(collect api_failures·overflow null·diff_list_complete false / report M-api / check 댓글 404 미확보) |
| R3-4 | task-02 collect worktree · 고정 뒤에도 mr.diffs 를 git 목록으로 교체하지 않아 check(후보 탐색)·pack(문서 지도)이 불완전 API 목록 사용 · base..head 완전 목록을 git 에서 만들어 check·pack 에 공급 | medium | FIXED | `cbb2582` — `gitDiffs(checkout, base, head)`(`git diff -z --no-renames --name-status` + 파일별 diff) 로 `mr.diffs` 교체·`overflow:false` · SC-3 mr.json 규칙 · 테스트(API 목록에서 docs/specs 를 뺐어도 mr.diffs 4건·삭제·diff 본문) |
| R3-5 | task-03 check · Baseline URL 의 호스트·namespace 를 버리고 basename 만으로 등록 프로젝트에 매칭(범위 밖 URL 이 확보) · 호스트·전체 경로 보존·등록 정체성 대조, 범위 밖은 미확보 | medium | FIXED | `cbb2582` — `BLOB_RE`·`ISSUE_URL_RE` 가 `/-/` 앞 전체를 `project_url` 로 보존, `identityMismatch` 가 `projects/<id>`.`web_url`(캐시)과 대조해 다르면 미확보(ref 해소·raw 호출 없음) · `#n`·closes_issues 는 대조 없음 · SC-2·SC-3 · 테스트(`elsewhere.invalid/unregistered/alpha/…` → 미확보, 101 repository 호출 0) |
| R3-6 | task-10/SC-2 · 어댑터가 요구하는 대상 저장소 문서(AGENTS.md·로컬 docs)를 SC-2(docsRoot 기준만)로 표현 불가 · 문서 참조에 출처(공통/대상 저장소) 구분·적용 조건·고정 워크트리 읽기·전송 허가 계약 | medium | FIXED **[루프 판정 — 선택지 2(생략 vs `repo:` 접두 지원) 중 「`repo:` 접두」 채택]** | `cbb2582` — SC-2 문서 참조 2형식(`<docsRoot 경로>[#절]` · `repo:<대상 저장소 경로>[#절]`) · pack `repoDocText` = 워크트리 파일 또는 `repository/files/…/raw?ref=<head>`, 출처 `repo:<경로>@<head7>`, 팩 B 포함(D4 워크트리 범위), 누락 = `missing:true` 로 계속(저장소 속성 — 필수 ERR 규칙의 예외) · task-10 §2·§4 매핑(AGENTS.md·CLAUDE.md·app docs → `repo:`, 「반대편 저장소」·위키 entity 는 산문) · 테스트(AGENTS.md raw → B 포함, 없는 문서 missing). 대안 「생략」은 어댑터 §2·§4 요구를 버리는 것이라 채택 안 함. **확인 임무 ③ 우선 감사 대상** |
| R3-7 | task-06 render · 부록 C 가 validReviewers 와 무관하게 review-*.json 을 다시 읽어 INVALID(비-배열 findings·JSON 오류) 결과에서 TypeError — 단일 모델 전환이 끝까지 안 됨 · 유효 결과만 구조화 렌더, 무효는 실패 기록 | medium | FIXED | `cbb2582` — 부록 C 가 파일별 try-parse + `validReviewers` 포함·배열 `findings` 일 때만 구조화, 아니면 「(무효 결과 — JSON 파싱 실패 / 스키마 검증 실패 …)」 · 테스트(codex findings 문자열·깨진 JSON 에서도 render exit 0, claude 절 정상) |
| R3-8 | task-04 deploy zip · local header 의 파일명·압축 방식을 central directory 와 대조하지 않음 · 정합 검증, 불일치 corrupt + 회귀 | medium | FIXED | `cbb2582` — `read()` 가 local header 파일명·압축 방식을 central 과 대조, 불일치 throw → `corrupt` → 「대조 불가」 · SC-3 결과 순서 문구 · 테스트(local 파일명만 바꾼 zip) |
| R3-9 | task-06 cleanup · pack-a.md(원문·개인 위키 발췌)·baseline 원문·review-*.json(비밀값 원문)이 cleanup 뒤 잔존(P4·F5) · 원문 팩·baseline 을 임시 산출물로 삭제, --resolve 용 구조화 결과는 비밀값 제거 사본 | medium | FIXED **[루프 판정 — 수명주기 결정: 원문 삭제 + JSON 은 마스킹 사본 보존]** | `cbb2582` — `cleanup({work, adapter})` 가 `pack-a/b.md`·`baseline/` 삭제(raw 에 합산), `mr`·`check`·`review-*`·`findings` JSON 의 **문자열 값**에 어댑터 mask + SECRET_MASK(`deepMask`, 키 이름 제외) 적용해 덮어씀(`masked=<n>`), 파싱 불가 JSON 은 삭제 · SC-3 「산출물 수명주기」·표 · SC-6 출력 · task-07 §0·§8 · 테스트(pack-a·baseline 없음, mr/check/review 값 마스킹, authorTokens 값 보존). 대안 「JSON 도 삭제」는 `--resolve`·재리뷰(§9·§5.6)를 같은 W 에서 못 돌려 채택 안 함. **확인 임무 ③ 우선 감사 대상** |
| R3-10 | task-06 executionBlock · 40줄 제한을 보장하지 않음(차단 발견 30건 → 48줄) · 5절 유지 + 상세를 부록으로 넘기는 결정적 축약 규칙 + 검증 | medium | FIXED | `cbb2582` — 절별 배열 조립 후 결정적 축약 순서 ① 의도 표 6행 초과 → 부록 A ② 차단 짧은 형태(위치·권고 생략) ③ 후속 1건 + 「외 n건 — 부록 D」 ④ 차단 앞 n건 + 「외 n건(차단 — 전부 부록 D 에 있음)」(n 은 40 에 맞춰, 최소 1) · 안내 문장 덧붙이기 제거 · 테스트(차단 30·후속 5·의도 10 → ≤40줄, 5절, 부록 D 에 F30) |

| R4-1 | task-06 cleanup · verdict.json(machineEvidence 의 미확보 링크 raw·reason)·deploy.json(zip 파일명·주석·API 오류 문자열)은 마스킹 대상에서 빠져 원문 비밀값(예: 링크의 `?token=…`)이 cleanup 뒤 남음(R3-9 정책 자체가 아니라 보존 파일 데이터 흐름 결함) · deploy.json·verdict.json 도 문자열 값 마스킹 + SC-3 갱신 + 회귀 | high | FIXED | `f693a72` — `MASKED_JSON` 에 `deploy.json`·`verdict.json` 추가(제외 = 경로·SHA·카운트만 담는 snapshot·pack) · SC-3 표·수명주기 문구 · task-07 §8 · Cautions · 테스트(cleanup `masked=5`, deploy 다운로드 오류 문자열의 `?token=`·verdict 미확보 링크의 `?token=`·이메일 마스킹) |
| R4-2 | task-04 deploy · 기대 배포·삭제 목록이 모두 비면 ④ 삭제 목록 비교 전에 `applicable:false`로 반환 — 문서만 변경한 비면제 MR 에 변경 안 한 운영 파일 삭제 목록을 적어도 통과(R1-4 와 같은 영역, 경로는 ④ 이전 비해당 반환) · 비해당 반환 전 본문 삭제 목록 비교, 기대에 없는 삭제 지시는 M-deploy 로 전달되게 applicable·결과 계약 | high | FIXED (사용자 결정 — R1-4 계열 재출현이라 ESCALATE, 선택지 3 중 「건너뛰기 전에 본문 삭제 목록을 먼저 본다」) | `f693a72` — 기대 변경 0 이어도 `bodyDeletedList` 가 비어 있지 않으면 `applicable:true`·zip 단계 생략·④ 만 대조 → `deleted_list` 불일치 → `M-deploy` · `reason` 「본문 삭제 목록만 대조(④)」 · SC-3 `applicable` 식 · Cautions · 테스트(문서만 MR + Keep.java 삭제 → 불일치, 둘 다 비면 해당 없음). 대안 「알고도 둔다(리뷰어 확인 필요 한 줄)」·「구현 때 처리」 — 사용자가 채택 안 함 |
| R4-3 | task-07 §7 재리뷰 · 이전 실행 블록 「4. 차단 발견」만으로 대조표를 만드는데 R3-10 축약으로 일부가 부록 D 로 옮겨져(30건 반례 8건 생략) 이전 리포트 없는 환경에서는 복원·미확보 처리 없음(§5.6 「이전 차단 발견마다」 미완) · 대조표는 부록 D 또는 보존된 구조화 발견 전체에서, 전체 미확보면 확인 완료로 취급 금지 + 검토자별 전송 범위·미확보 처리 명시 | medium | FIXED | `f693a72` — task-06 실행 블록 차단 줄에 id 접두(`- F3 DEFECT — …`·`- M-deploy MISSING_EVIDENCE — …`), 축약 ④ 줄에 생략분 id 목록 · task-03 `priorBlockingList`(댓글 항목 + 접힌 id 를 이전 리포트 `<reportDir>/<프로젝트>-<iid>-<prior_head7>.md` 부록 D 에서 복원, 못 하면 `title:null`) → `rereview.priorBlocking`·`priorBlockingComplete`·`priorReport` · task-06 verdict `M-rereview`(불완전 → HOLD_EVIDENCE 이상) · task-07 §7 대조표 원본 = `priorBlocking` 전체, 미확보 항목은 확인 완료 취급 금지, 복원 제목은 마스킹 잔존 검사 뒤 Codex · SC-3 check/verdict · 테스트(check: 리포트 없음 → 불완전, 부록 D 복원 → 완전 / report: 축약 줄 id 수 = 생략 수, M-rereview) |
| R4-4 | task-03 check · `judgeReason()`이 `① 왜: <…>` 같은 양식 표지만 있어도 true(§5.2 「양식 문구 그대로면 없음」 위반, 빈 양식이 bodyReason 으로 남아 이슈 대체도 막힘) · 표지와 실내용 분리, 빈 값·자리표시자·안내문 제외, 본문 실내용 없을 때 이슈 대체 규칙 + 회귀 | medium | FIXED | `f693a72` — `judgeReason` 이 표지 뒤 실내용(꺾쇠 `<…>`·빈 값 제외, `\p{L}\p{N}` 유무)으로 판정 · `reason.source` = 본문 실내용 있을 때만 `body`, 없으면 이슈 대체 · SC-3 `reason` 규칙 · Cautions · 테스트(양식만 → none / 양식만 + 이슈 #12 → issue / 한 칸만 채움 → body·②만 없음) |
| R4-5 | task-05 pack · 위키 검색어가 MR 제목·경로·basename 뿐이라 diff 안 기능명·테이블명이 검색에 안 들어감(§5.3-2·어댑터 §5 요구 — 구현자가 추출 방식을 새로 결정해야 함) · 변경 코드·diff 에서 기능명·테이블명 검색어 확보 계약 + 검증 | medium | FIXED (사용자 결정 — ESCALATE 설계 선택지 4 중 「스크립트가 코드 변경 줄에서 규칙으로 뽑는다」) | `f693a72` — `codeTerms(mr)`: diff 추가 줄의 SQL 테이블명(FROM/JOIN/INTO/UPDATE/TABLE 뒤·`@Table(name=)`)·선언 식별자(class/interface/enum/record/function/def·MyBatis `<select id>`), 길이 ≥ 4·예약어 제외·상한 40 → 위키 grep 검색어에 합산, 용어집 대조 텍스트에 추가 줄 포함 · `pack.json.wikiTerms` · SC-3 · 목적·AC·Cautions · 테스트(제목·파일명에 없는 `report_assign` 만 언급한 페이지 선택, 삭제 줄·산문 낱말 제외). 대안 「어댑터 블록 정규식」·「메인(Claude)이 `--terms`」·「요구 문구 축소(ACCEPTED)」 — 사용자가 채택 안 함 |

미확인 FIXED 큐(R4 수정 후): R1-1~R1-10 · R2-1~R2-8 · R3-1~R3-10 · R4-1~R4-5(**33건**) — 소멸 확인은 확인 라운드 임무 ①. 루프 직접 판정: R1-8 · R3-6 · R3-9 의 선택지 채택 3건(위 표시 — 확인 임무 ③ 우선 감사 대상). 사용자 판정: R4-2 · R4-5(정밀 모드 즉시 ESCALATE → FIXED, 감사 대상 아님 — 확인 첨부물 ⑥ 사용자 기결정 목록에 넣는다). batch ESCALATE 적재: 0건(flush 통과). 미판정 blocking: 0.

## 확인 대기 대장

해당 없음
