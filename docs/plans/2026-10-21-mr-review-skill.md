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
  "gitlab": { "host": "<GitLab 호스트[:포트] — 스킴·경로 없이>" },
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

- 필수 키: `schema`(=1) · `gitlab.host`(호스트[:포트] — 모든 `glab api` 에 `--hostname` 으로 붙고, collect 가 MR `web_url` 호스트와 대조해 다르면 ERR — impl R2-4) · `workspaceRoot` · `docsRoot` · `projects`(1개 이상, 각 `id` 정수·`path` 문자열) · `policy.judgeId`·`policy.acceptedIds`(비어 있지 않음)·`policy.docs` · `contract.lines`(10개) · `baselineCandidates` · `docsMap.always`·`docsMap.rules` · `wiki.roots`(0개 가능)·`wiki.linesPerPage`·`wiki.pagesPerPack` · `mask` · `deploy.targets`·`deploy.excludes` · `comments.verdictFirstLine`(그룹 4종 포함 — 문자열에 `(?<policy>`·`(?<sha>`·`(?<kind>`·`(?<verdict>` 모두 있어야 함)·`comments.baselineConfirm`·`comments.authorToken`(`(?<token>` 포함)·`comments.trustedReviewers` · `report.dir`.
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
| `codex.prompt` · `codex.out` · `codex.sh` · `codex.pid` | SKILL | cleanup | Codex 실행 파일(원시 — 보존 금지) — **`codex.pid`의 프로세스가 살아 있으면 cleanup 은 `ERR` 로 거부**(아무것도 지우지·마스킹하지 않음, plan R6-2 — 종료 확인은 SKILL §0 몫) |
| `zip/<파일명>` · `worktree/` · `blobs/` · `baseline/` | deploy·collect·check | cleanup | 임시 산출물(F7) — `baseline/`은 원문이라 cleanup이 지운다(pack이 이미 소비) |

**산출물 수명주기(cleanup — F5·F7)**: **선행 조건 = 검토자 종료 확인**(SKILL §0 — Claude `TaskStop`+알림, Codex pid TERM→생존 확인→KILL; `codex.pid` 프로세스 생존이면 cleanup 이 `ERR`로 거부, plan R6-2). 원문(`worktree/`·`zip/`·`blobs/`·`codex.*`·`pack-a.md`·`pack-b.md`·`baseline/`)은 삭제. `mr.json`·`check.json`·`deploy.json`·`review-*.json`·`findings.json`·`verdict.json`은 **문자열 값**(키 이름 제외)에 어댑터 `mask` + 엔진 `SECRET_MASK`를 적용한 사본으로 덮어써 남긴다 — `--resolve` 재계산(verdict·render)·재리뷰 입력으로 충분하다. `deploy.json`(zip 파일명·주석·API 오류 문자열)·`verdict.json`(`machineEvidence`에 복사된 미확보 링크 `raw`·`reason`)도 MR 원문이 흘러드는 파일이라 「원문 없음」으로 가정하지 않는다(plan R4-1). `snapshot.json`·`pack.json`·리포트는 그대로(경로·SHA·카운트·패턴 이름만, 리포트는 저장 시 마스킹). 파싱 불가 JSON은 마스킹할 수 없으므로 지운다. **마스킹(리포트·JSON 사본 모두)은 40자 SHA(16진수, 글자 포함)를 보존한다**(`maskText` — 자리표시자로 빼고 복원, plan R5-2: 개인정보 패턴에 걸리는 정상 SHA 가 변조되면 이전 판정 파싱·`--resolve` head 대조가 깨진다).

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
- `baselineLinks` 수집 범위 = Baseline 줄의 링크·`#n` + `closes_issues` + **MR 본문 전체의 `#n`·이슈 URL**(코드펜스 안·Review Contract 블록 제외 — 코드펜스 = ``` 또는 ~~~ 3자 이상으로 열고 같은 문자·길이 이상으로 닫는 줄 범위(CommonMark, 줄 단위 추적 — `~~~`·4중 백틱 중첩 포함, C3 R2-6) · Review Contract 블록 = 제목 줄부터 다음 `## ` 앞까지(C2 R2-6) · 프로젝트·IID로 중복 제거, plan C1 R2-6 사용자 결정; 존재하지 않는 번호는 미확보 → `M-baseline`). `closes_issues`의 `project_id`가 어댑터에 없으면 `project:null`·`미확보`(현재 프로젝트로 대체하지 않는다). 저장소 링크의 `ref`/`path` 경계는 URL 첫 세그먼트가 아니라 **그 저장소의 branch/tag API로 긴 후보부터 해소**한다(`feature/topic` 브랜치 지원 — SHA permalink만 첫 세그먼트 확정). **URL 링크(저장소·이슈)는 `project_url`을 보존하고 해소 때 등록 프로젝트의 `web_url`과 대조해 다르면 `미확보`**(SC-2 — basename만 같은 범위 밖 링크를 확보로 기록하지 않는다; `#n`·`closes_issues`는 `project_id`가 정체성이라 대조 없음). 이슈의 댓글 조회 실패는 「댓글 없음」이 아니라 `미확보`.
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
- 결과 순서: zip 첨부 없음 + `expected.deploy` 비어 있지 않음 → `zip 누락`; 다운로드 실패·zip 손상(central directory·local header signature·**local header ↔ central directory 파일명·압축 방식·일반 목적 플래그 불일치**·**암호화 플래그(bit0·bit6, 미지원)**·**CRC-32·비압축 크기 불일치** 포함) → `대조 불가`; 그 밖 mismatches 비면 `일치`, 아니면 `불일치`. `bodyDeletedList`는 본문 「배포본」 항목 아래 목록(줄 시작 `-`·`*`·숫자. 또는 코드펜스 안 한 줄 한 경로)에서 뽑는다. `expected.deleted`와 집합 비교(순서 무관).

**`pack.json`**:
```json
{ "sources": [{ "id": "S1", "kind": "doc|wiki|baseline|issue|adapter", "ref": "<docsRoot 기준 경로@sha[#절] | repo:<경로>@<head7>[#절] | 위키 페이지명 | baseline/1.md>", "exportAllowed": true, "inPackB": true, "lines": 0, "missing": false }],
  "mask": { "applied": { "phone": 0, "secret": 0 }, "residual": [{ "name": "", "where": "pack-b|body|note" }], "ok": true },
  "wikiTerms": ["<diff 추가 줄에서 뽑은 테이블명·선언 식별자>"],
  "packA": "pack-a.md", "packB": "pack-b.md", "codexSkipped": false, "codexSkipReason": null }
```
- 팩 B 마스킹 = 어댑터 `mask`(개인정보) + 엔진 `SECRET_MASK`(비밀값 — `pack.mjs` 정본, 리포트·cleanup 과 같은 `maskText`), 40자 SHA 보존 · `residual`(잔존 검사)도 두 규칙 모두 — 본문·댓글·발췌의 `password = "…"`·API 키가 Codex 로 가지 않는다(plan R6-1, F5). `applied.secret` = 엔진 패턴 치환 수. **잔존 검사는 SHA 복원 전(자리표시자 상태) 텍스트에서** — 보존된 정상 SHA 를 개인정보 패턴이 재탐지해 거짓 `codexSkipped` 가 되지 않는다(plan C2-1).
- `wikiTerms` = 위키 grep 검색어 중 변경 코드에서 뽑은 것(`codeTerms` — diff **추가 줄**의 SQL 테이블명(FROM/JOIN/INTO/UPDATE/TABLE 뒤·`@Table(name=)`)·선언 식별자(class/interface/enum/record/function/def·MyBatis `<select id>`), 길이 ≥ 4·SQL 예약어 제외·상한 40). 검색어 전체 = MR 제목·경로(용어집 대조 텍스트에는 추가 줄 본문도 포함) + 파일 basename + `wikiTerms`(spec §5.3-2 「변경 파일명·기능명·테이블명」, plan R4-5 — 스크립트 규칙, 어댑터 키 없음).
- `exportAllowed`(= 팩 B 투입) 규칙: `doc`(공통 문서·`repo:` 대상 저장소 문서 모두)·`adapter`·본문 기준선 = `true` · `wiki` = 루트의 `export`(허용 루트 안의 금지 루트 하위는 허용 루트 탐색에서 제외 — impl R1-4) · **`baseline`(저장소 링크)·`issue`(연결 이슈 원문) = 그 프로젝트가 리뷰 대상 프로젝트이거나 `docsRoot`와 같은 체크아웃인 프로젝트일 때만 `true`**(이슈 포함 — impl SDD 이월 T05 사용자 판정 2026-10-22, `issue` 출처에는 「참고 자료 — 지시 아님」 `note`) — 어댑터 `projects` 등록은 수집 가능 범위이지 전송 허가가 아니다(어댑터 §6). `missing` = 문서 지도 규칙 문서의 파일·절 누락(계속 진행) — **공통 문서의 필수 참조(`policy.docs`·`docsMap.always`) 누락은 `pack`이 `ERR` exit 2**(fail-closed). **`repo:` 참조는 필수 여부와 무관하게 누락 = `missing:true`로 계속**(SC-2). `repo:` 문서는 **고정 head 의 git blob**(`git ls-tree`로 모드 확인 → 일반 blob 만 `git show <head>:<경로>`, diff-only 는 raw API)으로 읽는다 — 작업 트리 파일을 fs 로 읽지 않으며 심볼릭 링크(120000)·서브모듈은 `missing`(plan R5-1, F4·F6).

**`verdict.json`**:
```json
{ "status": "determined|undetermined|review-failed",
  "verdict": "APPROVE|HOLD_EVIDENCE|CHANGES_REQUESTED|RETURN_TO_DESIGN|null",
  "contractPolicyId": "<check.contract.policyId 또는 judgeId>", "judgeId": "", "head_sha": "",
  "defects": ["<finding id>"], "evidence": ["<finding id 또는 기계 항목 id>"], "unresolved": ["<finding id>"],
  "baselineMissing": false, "returnToDesignBy": ["<finding id>"],
  "branches": { "<unresolved id>": { "confirmed": "<판정>", "dismissed": "<판정>" }, "<fixableInDesign 상충 id>": { "confirmed:fixable": "<판정>", "confirmed:design": "<판정>", "dismissed": "<판정>" } },
  "machineEvidence": [{ "id": "M-contract-Baseline", "kind": "contract|diff|deploy|baseline|api|rereview", "detail": "" }],
  "reasons": ["<한 줄>"] }
```
- 리포트 부록 D 는 병합 발견뿐 아니라 `machineEvidence` 항목도 같은 줄 형식(`- **M-…** [기계] MISSING_EVIDENCE (차단) — <detail> (-:-) · 출처 machine · 확신 -`)으로 싣는다 — 실행 블록 축약 ④ 가 접은 기계 항목을 재리뷰 `parseAppendixD`가 복원할 수 있게(plan R5-3).
- `machineEvidence` 투입원: 계약 미완 줄(`M-contract-<name>` — 공백은 `_`, id 는 항상 `[A-Za-z][\w-]*` 로 실행 블록 축약 id 목록·재리뷰 파서 문법과 같다) · 미복원 diff(`M-diff-<n>`) · diff-only 목록 불완전(`M-diff-list`) · 배포본 비일치(`M-deploy`) · 기준선·이슈 원문 미확보(`M-baseline-<n>`) · **보조 API 조회 실패 `M-api-<name>`**(`snapshot.api_failures` — `closes_issues`는 모든 모드, `changes`·`versions`는 diff-only만, `approvals`는 판정 입력 아님) · **재리뷰 이전 차단 발견 목록 불완전 `M-rereview`**(`check.rereview.active && priorBlockingComplete === false`, plan R4-3). 하나라도 있으면 `HOLD_EVIDENCE` 이상.

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
                 "fixableInDesign": "yes|no|null", "fixableInDesignClaims": null, "brokenPremise": "", "unresolved": false, "resolution": "confirmed|dismissed|null", "dismissReason": "" }],
  "intent": [{ "criterion": "", "result": "", "location": "", "basis": "" }],
  "outsideWorktreePaths": [] }
```
- `blocking` = `type ∈ {DEFECT, MISSING_EVIDENCE}` 또는 `DESIGN_DRIFT`이면서 어댑터 렌즈의 차단 승격 조건(산문 — 메인이 판단)에 해당. `FOLLOW_UP`은 항상 `false`.
- `unresolved: true` = §5.5-2 상충 또는 한쪽만의 낮은 확신 차단 후보를 메인이 코드로 확인하지 못함. `resolution`은 `--resolve <id>=confirmed|dismissed`로만 채워지며 `verdict`가 이 파일에 **영속화**한다(호출을 나눠도 유지 — `unresolved`는 `false`로). `dismissReason`은 메인이 리뷰어 말대로 미리 적고 리포트 「리뷰어 결정」·부록 D에 남는다.
- **`fixableInDesign` 상충(plan R6-3)**: 같은 지문을 둘 다 차단으로 봤는데 `fixableInDesign`이 갈리고 메인이 코드로 확인하지 못하면 `fixableInDesign: null` · `fixableInDesignClaims: { "claude": "yes|no", "codex": "yes|no" }` · `brokenPremise` = `no` 쪽 주장 · `unresolved: true`. `verdict`는 이 항목에 `branches` 세 갈래(`confirmed:fixable`·`confirmed:design`·`dismissed`)를 내고, 리뷰어는 `--resolve <id>=confirmed:fixable|confirmed:design`으로 정한다(접미 없는 `confirmed`는 `ERR` — 스크립트가 한쪽을 고르지 않는다, D9). 접미 결정은 `fixableInDesign` 확정값으로 영속되고 `fixableInDesignClaims`는 보존된다. 상충이 없으면 `fixableInDesignClaims: null`.
- `head_sha` = `snapshot.head_sha`. `verdict`는 다르면 `review-failed`(이전 실행의 검토 결과로 판정하지 않는다 — F6).

### SC-6. CLI 계약 — `node <Base directory>/scripts/mr-review.mjs <서브커맨드> …` (`<Base directory>` = 스킬 로드 때 표시되는 「Base directory for this skill」)

| 서브커맨드 | 인자 | 출력(stdout 첫 줄) · exit |
|---|---|---|
| `collect` | `--adapter <파일> --project <이름> --iid <n> --work <dir> [--diff-only]` | `COLLECTED <mode> head=<sha7> base=<sha7> target=<sha7> attempts=<n> unrecovered=<n>` exit 0 · `ERR HEAD_MOVED …` exit 3(3회 재수집 뒤에도 API head ≠ fetch head) · 그 밖 `ERR <메시지>` exit 2 |
| `check` | `--adapter --work` | `CHECKED complete=<bool> baseline=<type> earlyExit=<bool> rereview=<bool>` exit 0 |
| `deploy` | `--adapter --work` | `DEPLOY <result>` exit 0(결과가 무엇이든 0 — 판정은 verdict 몫) |
| `pack` | `--adapter --work` | `PACKED sources=<n> codexSkipped=<bool>` exit 0 |
| `review-validate` | `--file <path> [--head <40자>] [--reviewer claude\|codex]` | `VALID` exit 0 · `INVALID <이유>` exit 1 — `--head`·`--reviewer`가 있으면 원본 결과의 `head_sha`·`reviewer`와 일치해야 VALID(SKILL은 항상 둘 다 준다) |
| `verdict` | `--adapter --work [--resolve <id>=<confirmed\|dismissed\|confirmed:fixable\|confirmed:design>]...` | `VERDICT <status> <verdict\|->` exit 0 · `findings.json` 없음 → exit 2 · `fixableInDesign` 상충 항목에 접미 없는 `confirmed` → `ERR` exit 2(SC-5, plan R6-3) |
| `render` | `--adapter --work [--early] [--out <파일>]` | `REPORT <경로>` exit 0 — `--out` 생략 시 `<reportDir>/<프로젝트>-<iid>-<sha7>.md` |
| `cleanup` | `--adapter --work` | `CLEANED worktree=<bool> zip=<n> raw=<n> masked=<n>` exit 0 — `raw` = 지운 원문 파일 수(`codex.*`·`pack-*.md`·`baseline/*`), `masked` = 마스킹 사본으로 바꾼 JSON 수(SC-3 산출물 수명주기) · `codex.pid`의 프로세스 생존 → `ERR 검토자 프로세스 생존(codex.pid <n>) …` exit 2(아무것도 지우지 않음, plan R6-2) |

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

- T6 의 README 부분은 **base 대비 추가 줄** 기준(`git diff <base> -- 'README*.md' | grep '^+' | grep -E '<같은 패턴>' | wc -l` = 0) — base 에 이미 있던 6줄은 플러그인 자체 공개 저장소 slug(`gguii74-rwk/claude-dev-workflow`)라 D10(리뷰 대상 프로젝트 식별자) 밖이다(SDD PF-1). `skills/mr-review`·`tests/mr-review` 는 전체 grep 0.
- `<base>` = 구현 착수 직전 main SHA(plan 루프 종결 커밋). 테스트 전용 환경변수: `MR_REVIEW_GLAB`(가짜 `glab` 경로 — 미설정이면 PATH의 `glab`), `MR_REVIEW_HOME`(위키 `~` 해소용 — 미설정이면 `os.homedir()`). 운영 문서에 쓰지 않는다.

### SC-8. 커밋 규칙

- main 직접 커밋(워크트리·MR 없음). **push 금지**(공개 배포 = 사용자 확인). (2026-10-21 사용자 결정: 워크트리 브랜치 `gguii74-rwk/mr-review-skill-impl` 에 커밋, main 머지·push 는 사용자)
- AI 서명·트레일러(`Co-Authored-By`·`Generated with`·`Claude-Session`) 금지 — 글로벌 no-AI-trace 규칙.
- 접두: `test(mr-review)`·`feat(mr-review)`·`docs(readme|spec|plan)`·`release:` — 메시지 본문은 한국어, 끝에 spec 절 참조.
- task당 1커밋(08은 2커밋) + 완료 기록 커밋(계약 ④).

## Task table

| # | title | status | file | deps | outcome |
|---|-------|--------|------|------|---------|
| 01 | 테스트 하네스 · 어댑터 파서 · CLI 골격 | [x] | [task-01](2026-10-21-mr-review-skill/task-01-adapter-and-harness.md) | — | `56f55bf` — adapter 8/8, 전사 수정 없음, 태스크 리뷰 승인(minor 3 이월) |
| 02 | GitLab 수집 · 스냅샷 고정 · diff-only 복원 (collect) | [x] | [task-02](2026-10-21-mr-review-skill/task-02-collect.md) | 01 | `d0c6b1e` — collect 9/9(누적 17), 전사 수정 없음, 태스크 리뷰 승인(SC-6 stderr 는 task-06 catch 에서 해소, minor 5 이월) |
| 03 | 작성 규칙 검사표 · 댓글 신뢰 · 기준선 원문 (check) | [x] | [task-03](2026-10-21-mr-review-skill/task-03-check.md) | 02 | `f4cc40f` — check 11/11(누적 28), plan 블록과 바이트 동일(stripFences 포함), 태스크 리뷰 승인(minor 6 이월) |
| 04 | 배포본 zip 대조 (deploy) | [x] | [task-04](2026-10-21-mr-review-skill/task-04-deploy.md) | 02 | `a63202a` — deploy 11/11(누적 39), 전사 수정 없음, 태스크 리뷰 승인(minor 6 이월 · 자동 보안 리뷰 3건 impl 루프 이월) |
| 05 | 컨텍스트 팩 · 마스킹 (pack) | [x] | [task-05](2026-10-21-mr-review-skill/task-05-pack.md) | 03 | `f6ef25a`·`157cb3d` — pack 13/13(누적 52), 수정 1라운드: 팩 B 헤더 미제공 출처 ref 제거(F4)·비밀값 키 `DB_PASSWORD` 류 마스킹(F5) — Cautions 1줄, 재리뷰 승인(이슈 전송 범위 보안 지적은 impl 루프 이월) |
| 06 | 판정 계산 · 리포트 · 비밀값 제거 · 정리 (verdict/render/cleanup) | [x] | [task-06](2026-10-21-mr-review-skill/task-06-report.md) | 03, 04, 05 | `e1b6856` — report 17/17(누적 69), plan 블록과 바이트 동일 + CLI `.catch` stderr 스택을 프로그래밍 오류로만 한정(SC-6, Cautions 1줄), 태스크 리뷰 승인(minor 6 이월) |
| 07 | SKILL.md — 절차·두 검토자·병합·재리뷰 | [x] | [task-07](2026-10-21-mr-review-skill/task-07-skill-md.md) | 06 | `5dd73b5`·`b20627d` — T5 `$숫자` 0·T6 0·회귀 69/69, 전사 수정: 어댑터 인자 우선(SC-6)·`--resolve` 접미형·수정 1라운드(Codex 대기 `WAIT_EXPIRED` 꼬리·findings.json SC-5 골격 인라인 `id`=`F<n>`) — Cautions 1줄, 재리뷰 승인(minor 7 이월) |
| 08 | README 3종 · manifest description | [x] | [task-08](2026-10-21-mr-review-skill/task-08-readme-manifest.md) | 07 | `db40243`·`66dcd29` — README 3종 §10·목차(§9 뒤)·`--resolve` 4형·plugin.json description(version 1.2.1 유지), marketplace.json description 은 task-09 로 이월(Cautions 08·09), 태스크 리뷰 승인 · 게이트 T1 69/69·T2 0·T3 56/56·T4 0·T5 0·T6 0(README 는 추가 줄 기준)·T7 0 |

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

**review-loop(impl) 필수 확인 항목(plan 루프 폴백 ① 이월 — 사용자 결정 2026-10-21)**: plan ledger R2-6 의 마지막 수정 `bf43318`(task-03 `stripFences` — `~~~` 펜스·4중 백틱 안 삼중 백틱의 `#n` 제외)은 plan 루프 안에서 소멸 확인을 받지 못했다(확인 예산 소진). impl 루프는 이 항목을 **첫 확인 라운드 임무 ① 큐에 승계**한다 — 원 지적 = plan ledger R2-6 행(C3 잔존 사유) · 확인 대상 = 구현된 `check.mjs` 의 펜스 제외 + 테스트(#998 `~~~`·#997 4중 백틱). impl 종결 행의 `미확인 FIXED 큐 0` 은 이 항목의 소멸 확인을 포함해야 한다.

**트랙 밖(여기서 하지 않는다)**: 고도화 포크 승격·포크 내부 MR(spec §9) · GitLab 쓰기(D8) · 스킬 포장 분리(spec §9 — 첫 운용 뒤) · 다른 리뷰어 PC 배포(D2 — 결과 뒤).

## 적대검증 ledger (plan)

보안 크리티컬: no (호출자 지정) — 접촉면 외부 전송·개인정보 경계(마스킹·전송 허용 목록 코드 계획) 감지

- 루프: base `9017d1e`(9017d1e00a595993b73b2a684bdb74a6b655c5fc, 호출자 지정 — spec 루프 종결 커밋 = plan 착수 직전, diff = plan만) · branch `docs/mr-review-skill-design` · 예산 max 5 · confirm 2 · auto 3 · 수동 모드.
- 사전 게이트: 형식 관문 ①②④ = repo에 CLAUDE.md/AGENTS.md 분할 규약 없음 → 스킵(참고: Execution contract 블록 = 설치본 writing-plans-split canonical과 동일 · §Shared Contracts · status·outcome 컬럼 실재) · ③ spec ledger fingerprint 컬럼 실재 · 대장 대기 0.
- score 산식 = 전환용(미확인 FIXED 큐 제외, §2c 분류 직후·수정 전 스냅샷, weight c4/h3/m1). R1은 분류 전 중단(컨텍스트 넛지)이라 재개 세션(2026-10-21 16:5x)이 자동 모드로 §2c 처리 — 수신 시점 모드 유지, 적대 소진 1 불변.
- 인라인 코드 검증 = task-01~06 4-backtick 블록을 scratch 로 추출해 `node --test` 실행(R1 수정 전 47/47 재현 → R1 수정 후 51/51 → R2 수정 후 52/52 → R3 수정 후 **59/59**: adapter 8·collect 9·check 10·deploy 10·pack 8·report 14).
- R3 도 분류 전 중단(컨텍스트 넛지, 소진 3 저장)이라 재개 세션(2026-10-21 17:3x, 오르카 후계)이 수신 시점 모드 = 자동으로 §2c·§2f 처리. 전환 신호 1 은 「2회 연속 비감소(s_n ≥ s_{n-1} ≥ s_{n-2})」라 22→16→16 은 미발화(이전 핸드오프의 「16 이상이면 발화」 예상은 오독 — 정정). 소진 3 = auto-rounds → batch flush(적재 0건 — 통과) → 정밀 모드.
- R4 도 분류 전 중단(컨텍스트 넛지, 소진 4 저장)이라 재개 세션(2026-10-21 18:0x, 오르카 후계)이 수신 시점 모드 = **정밀**로 §2c·§2d 처리 — ESCALATE 즉시 질문 2건(R4-5 설계 선택지 4 · R4-2 R1-4 계열 재출현 → 사용자 결정) 모두 추천안 FIXED 채택, 나머지 3건 FIXED 후보. 수정 커밋 `f693a72`(scratch 62/62 = adapter 8·collect 9·check 11·deploy 11·pack 9·report 14). 전환 신호 1: 16→16→9 미발화 · 신호 2: FIXED 후보 5 미발화 → R5 적대.
- R5(적대·정밀, HEAD `6beafe6`, 2026-10-21 19:1x): 신규 3건(high 1·medium 2) 전부 FIXED 후보(기결정 재론 0·ESCALATE 0) → 수정 커밋 `2f760e8`(scratch 64/64 = adapter 8·collect 9·check 11·deploy 11·pack 10·report 15). score 5(16→9→5 — 신호 1 미발화, 신호 2 미발화). **적대 소진 5 = max → 신호 3 발화** → batch 정리(적재 0건) → **확인 모드 C1 진입**(확인 예산 2 중 0 소진, 복귀 미사용).
- C1(확인, HEAD `28c66a5`, 2026-10-21 19:2x, `task --prompt-file`, 응답 완전 — 36건 전부 명시·감사 4·신규·verdict): **소멸 32 · 잔존 4**(R2-1·R2-6·R3-8·R4-3 — blocking 재분류) · 신규 high 1(C1-1) · 판정 감사 R1-8·R3-6·R3-9 **타당**, **R5-2 이의**(SHA 보호가 이메일 마스킹 우회) · verdict **fail**. 확인 소진 1. 처리: 잔존 4 + C1-1 을 §2c 로 분류 — R2-6(설계 선택지: 수집 범위)·R5-2 감사 이의는 즉시 ESCALATE → 사용자 판정(둘 다 추천안 FIXED: 본문 전체 수집·경계 조건으로 보호 보정), 나머지 FIXED → 수정 커밋 `32db86e`(scratch 64/64) → **복귀 적대 1회(R6, 상한 밖) + 재진입 확인 1회(C2, 예산 밖) 진입**. 복귀 사용 = 예.
- R6(복귀 적대 — 예약분, 카운터 불변, HEAD `ed1b05f`, 2026-10-21 19:4x): 신규 4건(high 2·medium 2) 수신 — 분류 전 중단(컨텍스트 넛지 42%, 세션 인계) → 재개 세션(2026-10-21 19:5x, 오르카 후계)이 **정밀 모드**로 §2c·§2d: 기결정 재론 0 · R6-1·R6-4 FIXED 후보(방향 1) · R6-2·R6-3 설계 선택지 2+ → 즉시 ESCALATE 2건(둘 다 추천안 FIXED 채택 = 사용자 결정) → 수정 커밋 `45cd070`(scratch **67/67** = adapter 8·collect 9·check 11·deploy 11·pack 11·report 17). score 8(참고값 — 복귀 라운드라 전환 신호 재평가 없음). **두 카운터 불변**(적대 소진 5·확인 소진 1). 다음 = **재진입 확인 C2**(예약분 — 확인 예산 검사 면제, 확인 소진 불변; C2 에서 또 blocking 이면 ESCALATE + whole-branch 리뷰 권고). 원 지적 원문은 루프 파일.
- C2(재진입 확인 — 예약분, 확인 소진 불변, HEAD `3748676`, 2026-10-21 20:0x, `task --prompt-file`, 응답 완전 — 9건 전부 명시·감사 3·신규·verdict): **소멸 8 · 잔존 1**(R2-6 — 3회째: 계약 블록 제거 정규식이 본문 끝까지) · 신규 medium 1(**C2-1** — R6-1 수정의 회귀: 복원된 정상 SHA 를 잔존 검사가 rrn 으로 재탐지 → 거짓 codexSkipped) · 판정 감사 R1-8·R3-6·R3-9 **타당** · verdict **fail**. 재진입 확인에서 또 blocking → 규칙대로 **ESCALATE**(복귀 이미 사용, 일반 확인 예산 잔여 1): 사용자 판정 3건 = R2-6 **FIXED**(3회째 계열 — 사용자 판정) · C2-1 **FIXED** · 진행 = **「고치고 새 세션에서 전체 브랜치 리뷰」**(선택지 3 중 — 「남은 예산으로 이 세션 C3」·「지금 멈춤」 미채택) → 수정 커밋 `d4398de`(scratch **68/68** = adapter 8·collect 9·check 11·deploy 11·pack 12·report 17) → §2i 일시중단. 다음 세션 = 일반 확인 라운드 **C3**(확인 소진 1→2, 예산 마지막) — 임무 ① 큐 2건(R2-6·C2-1) + 임무 ② 를 **전체 브랜치**(base..HEAD 전 범위) 회귀 확인으로 넓힘 + 감사 3 + verdict. C3 가 깨끗하면 성공 종료(§3·§4), 또 blocking 이면 확인 예산 소진 → ESCALATE + 폴백 3택(§확인 모드 결과 처리).
- C3(일반 확인 — **전체 브랜치**, 확인 소진 1→**2**(예산 소진), HEAD `c7e0a38`, 2026-10-21 20:2x 재개 세션, `task --prompt-file`, 응답 완전 — 2건 전부 명시·감사 3·신규·verdict · scratch 68/68 재현): **소멸 1(C2-1) · 잔존 1**(R2-6 — 4회째: 코드펜스 제외가 삼중 백틱 정규식뿐이라 `~~~` 펜스·4중 백틱 안 삼중 백틱의 `#n` 이 수집돼 없는 번호면 미확보 → HOLD_EVIDENCE, 영향 = 불필요한 보류(fail-closed)) · 전체 브랜치 회귀 그 밖 없음 · 판정 감사 R1-8·R3-6·R3-9 **타당** · 신규 없음 · verdict **fail**(사유 = R2-6 뿐). 확인 예산 소진 + 복귀 이미 사용 → 규칙대로 **ESCALATE + 폴백 3택**: 사용자 판정 = R2-6 **FIXED**(선택지 3 중 「지금 고친다」 — 루프가 직접 코드로 확인한 뒤 제시) → 수정 커밋 `bf43318`(scratch 68/68 · 옛 정규식으로 되돌리면 새 테스트 1건 실패 확인) · 확인 부채 = **폴백 ① impl 리뷰 이월**(「새 세션 확인 1회」·「배포 검증 대체」 미채택) → 루프 **종결**(§3·§4). 폴백 ② 미소비.

| 라운드 | 모드 | HEAD | critical/high/medium (신규/잔존) | 전환용 score | 미확인 FIXED 큐 | verdict |
|---|---|---|---|---|---|---|
| R1 | 적대·자동 | `3f47b98` | 0/6/4 (신규 10) — 전부 FIXED 후보(기결정 재론 0·ESCALATE 0) | **22** | 0 → 수정 후 10 | needs-attention |
| R2 | 적대·자동 | `b5ff996` | 0/4/4 (신규 8 · R1 잔존 0 — 적대 비재출현, 큐 유지) — 전부 FIXED 후보(기결정 재론 0·ESCALATE 0) | **16** | 10 → 수정 후 18 | needs-attention |
| R3 | 적대·자동(수신 시점) | `4c50019` | 0/3/7 (신규 10 · R1·R2 잔존 0 — 적대 비재출현, 큐 유지) — 전부 FIXED 후보(기결정 재론 0·ESCALATE 0·루프 판정 2 = R3-6·R3-9 선택지 채택) | **16** | 18 → 수정 후 28 | needs-attention |
| R4 | 적대·정밀(수신 시점) | `f1fbc40` | 0/2/3 (신규 5 · R1~R3 잔존 0 — 적대 비재출현, 큐 유지) — 전부 FIXED(기결정 재론 0 · ESCALATE 즉시 2 = R4-2·R4-5 사용자 결정 FIXED) | **9** | 28 → 수정 후 33 | needs-attention |
| R5 | 적대·정밀 | `6beafe6` | 0/1/2 (신규 3 · R1~R4 잔존 0 — 적대 비재출현, 큐 유지) — 전부 FIXED(기결정 재론 0·ESCALATE 0) · **적대 예산 소진(신호 3)** | **5** | 33 → 수정 후 36 | needs-attention |
| C1 | 확인 | `28c66a5` | 소멸 32 / 잔존 4(R2-1·R2-6·R3-8·R4-3) / 신규 0/1/0(C1-1) · 감사 3 타당·1 이의(R5-2) — 잔존·신규 전부 FIXED(사용자 판정 2 = R2-6·R5-2 재판정) | (확인 — 산정 없음) | 36 → 소멸 32 → 수정 후 **5**(R2-1·R2-6·R3-8·R4-3·C1-1) | **fail** → 복귀 |
| R6 | 복귀 적대(예약분)·정밀 | `ed1b05f` | 0/2/2 (신규 4 · 큐 5 잔존 0 — 적대 비재출현, 큐 유지) — 전부 FIXED(기결정 재론 0 · ESCALATE 즉시 2 = R6-2·R6-3 사용자 결정 FIXED) | **8**(참고값 — 복귀 라운드, 신호 재평가 없음) | 5 → 수정 후 9 | needs-attention |
| C2 | 재진입 확인(예약분) | `3748676` | 소멸 8 / 잔존 1(R2-6) / 신규 0/0/1(C2-1) · 감사 3 타당 — 잔존·신규 전부 FIXED(사용자 판정 2 = R2-6 3회째·C2-1) | (확인 — 산정 없음) | 9 → 소멸 8 → 수정 후 **2**(R2-6·C2-1) | **fail** → ESCALATE(사용자: 새 세션 전체 브랜치 확인 C3) |
| C3 | 일반 확인(전체 브랜치) | `c7e0a38` | 소멸 1(C2-1) / 잔존 1(R2-6 4회째) / 신규 0 · 감사 3 타당 — 잔존 FIXED(사용자 판정) `bf43318` | (확인 — 산정 없음) | 2 → 소멸 1 → 수정 후 **1**(R2-6 — impl 리뷰 이월, 폴백 ①) | **fail**(사유 R2-6 뿐) → ESCALATE(사용자: FIXED + 폴백 ① 이월) · 루프 종결 |

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

| R2-1 | task-06 render · 하드코딩 비밀값 리터럴이 리포트(부록 C·D)에 그대로 남음(어댑터 mask 는 개인정보용) · 비밀값 인용의 제거 경로를 원본 발견·최종 리포트에 동일 적용 + 회귀 사례 | high | FIXED → **C1 잔존(blocking 재분류) → FIXED** `32db86e`(SECRET_MASK 가 따옴표 안 값을 공백 포함 전체로, JSON 키 형태 `"password": "…"` 도 — 테스트 `synthetic-json-password`·`two word secret`) | `1e4e75b` — 엔진 내장 `SECRET_MASK`(password·secret·api_key·token·authorization 값 · Bearer · PEM 블록 — 프로젝트 무관, D10 무관)를 어댑터 mask 뒤 리포트 전체에 적용, 파일:줄은 보존(§5.7) · 테스트(evidence 의 `db.password = "…"`·`api_key:` 제거) |
| R2-2 | task-02 collect · overflow 로 diff 목록에서 통째로 빠진 파일은 복원·판정 전달 경로 없음 · 목록 완전성 계약 + 미확보는 결정적 MISSING_EVIDENCE | high | FIXED | `1e4e75b` — `mr.json.changes_count` 보존, diff-only `snapshot.diff_list_complete` = `!overflow ‖ (changes_count 정수·"+" 없음·≤ 수신 수)`(모르면 false — fail-closed) · verdict `M-diff-list`(HOLD_EVIDENCE 이상) · SC-3 · 테스트(없음/"4"/"4+" 3경우 + verdict) |
| R2-3 | task-03 check · 미등록 프로젝트의 closes_issues 를 현재 프로젝트 이슈로 대체 · 원래 project_id·URL 보존, 미확보로 기록 | high | FIXED | `1e4e75b` — `project:null`·`project_id` 보존·`raw=web_url`, `resolveIssue` 가 미확보(`id 999`) · 테스트(999 의 #12 를 101 에서 읽지 않음) |
| R2-4 | task-06/07 · review-validate 가 head 형식만 검사하고 병합이 findings.head_sha 를 새로 적어 이전 head 검토 결과가 통과 · SC-4 검증에 기대 head·reviewer 전달, 불일치는 validReviewers 제외 | high | FIXED | `1e4e75b` — `review-validate --head <sha> --reviewer <name>`(`validateReview(obj, {head, reviewer})`) → 불일치 INVALID · task-07 §5 두 검토자 모두 인자 필수·실패 = 그 모델 제외(head 를 고쳐 쓰지 않음) · SC-4·SC-6 · 테스트(단위 + CLI) |
| R2-5 | task-07 §6-4 · baselineCandidateRelevant 를 「둘 다 true」로 계산해 단일 모델 모드에서 관련 후보가 무조건 기각 · 유효 결과만 통합, 상충 시 메인 확인 | medium | FIXED | `1e4e75b` — 유효 결과(`validReviewers`)만 대상 — 전부 true/false, 단일 모델이면 그 값, 상충이면 메인이 후보 문서를 직접 읽고 `baselineCandidateReason` 기재 · SC-5 필드 추가 · Cautions |
| R2-6 | task-03 check · MR 본문의 일반 `#n` 참조(종료 키워드 없음)는 수집 안 함(§5.1-5 위반) · 본문 이슈 참조 수집·중복 제거·미확보 보존 | medium | FIXED → **C1 잔존(배경 절 한정이 §5.1-5 축소) → FIXED (사용자 결정 — 선택지 3 중 「본문 전체 수집, 없는 번호는 미확보 전달」)** `32db86e`(코드펜스·Review Contract 블록 제외 본문 전체에서 `#n`·이슈 URL 수집 · 존재하지 않는 번호 = 미확보 → HOLD_EVIDENCE 는 fail-closed 비용으로 수용 · 테스트 「참고」 절 #88 수집·펜스 안 #999 미수집) → **C2 잔존(3회째 — 계약 블록 제거 정규식 `[\s\S]*$` 가 본문 끝까지 지워 계약 뒤 절의 #n 누락) → FIXED (사용자 판정 — 같은 계열 3회 규칙)** `d4398de`(블록 = 제목 줄부터 다음 `## ` 앞까지 `^## Review Contract\b[^\n]*(?:\n(?!## )[^\n]*)*` · 테스트 계약 뒤 「후속」 절 #77 확보 · AC·Cautions) → **C3 잔존(4회째 — 코드펜스 제외가 삼중 백틱 정규식뿐이라 `~~~` 펜스·4중 백틱 안 삼중 백틱의 #n 이 새어 거짓 미확보 → HOLD_EVIDENCE) → FIXED (사용자 판정 — 확인 예산 소진 ESCALATE, 선택지 3 중 「지금 고친다」; 대안 「알고도 둔다(GitLab 본문은 ``` 위주·영향 = 불필요한 보류)」·「구현 때 처리」 미채택)** `bf43318`(`stripFences` — ```·~~~ 3자 이상으로 열고 같은 문자·길이 이상으로 닫는 줄 범위를 줄 단위로 제외, 미닫힘은 끝까지 · SC-3 · Cautions · 테스트 #998(~~~)·#997(4중 백틱 안 삼중 백틱) 미수집·미조회) — **소멸 확인 = impl review-loop 첫 확인 라운드로 이월(폴백 ①, 사용자 결정)** | `1e4e75b` — 「배경」 절의 `#n`·이슈 URL 을 수집 대상에 추가(프로젝트·IID 중복 제거, 다른 절의 `#3 항목` 오인 방지로 배경 절 한정) · SC-3 · 테스트(`이슈/spec: #88`) |
| R2-7 | task-04 deploy · zip 리더가 CRC 를 검증하지 않아 CRC 손상 zip 이 「일치」 · CRC32·크기·헤더 정합 검증, 실패는 corrupt | medium | FIXED | `1e4e75b` — `crc32()` 내장, `read()` 가 central directory 의 CRC·비압축 크기와 대조·범위 초과 검사 → `corrupt` → 「대조 불가」 · SC-3 결과 순서 문구 · 테스트(central CRC 만 뒤집은 zip) |
| R2-8 | task-03 check · BLOB_RE 가 blob 뒤 첫 세그먼트를 ref 로 취해 `feature/topic` 브랜치 링크 오해소 · 저장소 branch/tag 로 경계 해소·URL 디코딩 | medium | FIXED | `1e4e75b` — `refpath` 보존, `resolveRepoLink` 가 긴 후보부터 branch→tag API 로 최장 일치 해소(SHA permalink 만 첫 세그먼트 확정), 세그먼트 URL 디코딩 · SC-3 · 테스트(`feature/topic` + 최장 후보 먼저 호출 확인) |

| R3-1 | task-01 fixture mask · `Authorization:` 패턴이 인증 방식(Bearer)만 가리고 자격증명 값이 남음(residual 통과·SECRET_MASK 도 못 잡음) · 인증 방식+자격증명 전체 제거 패턴(fixture·task-10) + Bearer·Basic 회귀 | high | FIXED | `cbb2582` — 픽스처 `token` 패턴 = `(?<=…)(?:(?:Bearer\|Basic\|Token\|Digest)\s+)?[^\s\]]+` · `SECRET_MASK` 1번도 인증 방식 선택 소비 + `flags:'i'`(applyMask/residual 이 `flags` 지원) + 이미 가려진 자리 부정 전방탐색 · task-10 mask 매핑 행·검증 2단계에 Bearer 회귀 1줄 · 테스트(pack applyMask Bearer·Basic → `[masked:token]` 만, residual 0) |
| R3-2 | task-02 collect diff-only · head(메타)와 versions[0](base)의 head_commit_sha 를 대조하지 않아 중간 push 시 다른 head 자료가 결합 · 메타 head 와 일치하는 버전 선택·수집 중 head 변경 검출(재수집 또는 증거 부족) | high | FIXED | `cbb2582` — `diffHeadMismatch(mr)`(versions[0].head_commit_sha·diff_refs.head_sha ≠ api_head) → 재수집, 3회 뒤 `HEAD_MOVED` exit 3(워크트리 모드와 같은 처리) · SC-3 snapshot diff-only 규칙 · task-07 §2 안내 · 테스트(버전 head=DEAD → exit 3, 메타 3회, snapshot 미생성) |
| R3-3 | task-02/03 · /changes·/closes_issues·이슈 댓글 API 실패가 overflow=false·빈 목록·「확보」로 둔갑(R2-2 우회) · 실패와 빈 응답 구분, 미확보 상태 보존 → 결정적 MISSING_EVIDENCE, overflow 모르면 완전 판정 금지 | high | FIXED | `cbb2582` — `fetchMr` 가 실패 이름을 `api_failures`로, `/changes` 실패는 `overflow:null`(too_large·diff_list_complete 는 `!== false`/`=== false` 로 fail-closed) · snapshot 에 복사 · verdict `machineEvidence` `M-api-<name>`(closes_issues 전 모드, changes·versions 는 diff-only, approvals 제외) · check `resolveIssue` 댓글 조회 실패 = 미확보 · SC-3 mr/snapshot/verdict · task-07 §2 시작 요약 · 테스트(collect api_failures·overflow null·diff_list_complete false / report M-api / check 댓글 404 미확보) |
| R3-4 | task-02 collect worktree · 고정 뒤에도 mr.diffs 를 git 목록으로 교체하지 않아 check(후보 탐색)·pack(문서 지도)이 불완전 API 목록 사용 · base..head 완전 목록을 git 에서 만들어 check·pack 에 공급 | medium | FIXED | `cbb2582` — `gitDiffs(checkout, base, head)`(`git diff -z --no-renames --name-status` + 파일별 diff) 로 `mr.diffs` 교체·`overflow:false` · SC-3 mr.json 규칙 · 테스트(API 목록에서 docs/specs 를 뺐어도 mr.diffs 4건·삭제·diff 본문) |
| R3-5 | task-03 check · Baseline URL 의 호스트·namespace 를 버리고 basename 만으로 등록 프로젝트에 매칭(범위 밖 URL 이 확보) · 호스트·전체 경로 보존·등록 정체성 대조, 범위 밖은 미확보 | medium | FIXED | `cbb2582` — `BLOB_RE`·`ISSUE_URL_RE` 가 `/-/` 앞 전체를 `project_url` 로 보존, `identityMismatch` 가 `projects/<id>`.`web_url`(캐시)과 대조해 다르면 미확보(ref 해소·raw 호출 없음) · `#n`·closes_issues 는 대조 없음 · SC-2·SC-3 · 테스트(`elsewhere.invalid/unregistered/alpha/…` → 미확보, 101 repository 호출 0) |
| R3-6 | task-10/SC-2 · 어댑터가 요구하는 대상 저장소 문서(AGENTS.md·로컬 docs)를 SC-2(docsRoot 기준만)로 표현 불가 · 문서 참조에 출처(공통/대상 저장소) 구분·적용 조건·고정 워크트리 읽기·전송 허가 계약 | medium | FIXED **[루프 판정 — 선택지 2(생략 vs `repo:` 접두 지원) 중 「`repo:` 접두」 채택]** | `cbb2582` — SC-2 문서 참조 2형식(`<docsRoot 경로>[#절]` · `repo:<대상 저장소 경로>[#절]`) · pack `repoDocText` = 워크트리 파일 또는 `repository/files/…/raw?ref=<head>`, 출처 `repo:<경로>@<head7>`, 팩 B 포함(D4 워크트리 범위), 누락 = `missing:true` 로 계속(저장소 속성 — 필수 ERR 규칙의 예외) · task-10 §2·§4 매핑(AGENTS.md·CLAUDE.md·app docs → `repo:`, 「반대편 저장소」·위키 entity 는 산문) · 테스트(AGENTS.md raw → B 포함, 없는 문서 missing). 대안 「생략」은 어댑터 §2·§4 요구를 버리는 것이라 채택 안 함. **확인 임무 ③ 우선 감사 대상** |
| R3-7 | task-06 render · 부록 C 가 validReviewers 와 무관하게 review-*.json 을 다시 읽어 INVALID(비-배열 findings·JSON 오류) 결과에서 TypeError — 단일 모델 전환이 끝까지 안 됨 · 유효 결과만 구조화 렌더, 무효는 실패 기록 | medium | FIXED | `cbb2582` — 부록 C 가 파일별 try-parse + `validReviewers` 포함·배열 `findings` 일 때만 구조화, 아니면 「(무효 결과 — JSON 파싱 실패 / 스키마 검증 실패 …)」 · 테스트(codex findings 문자열·깨진 JSON 에서도 render exit 0, claude 절 정상) |
| R3-8 | task-04 deploy zip · local header 의 파일명·압축 방식을 central directory 와 대조하지 않음 · 정합 검증, 불일치 corrupt + 회귀 | medium | FIXED → **C1 잔존(원 지적의 「관련 플래그」 미대조 — local 0·central 1 정상 CRC zip 을 표준 리더는 암호화로 거부) → FIXED** `32db86e`(central `flags` 보존 · local ↔ central 플래그 대조 · bit0/bit6 암호화 = corrupt(미지원) · 테스트 2 사례) | `cbb2582` — `read()` 가 local header 파일명·압축 방식을 central 과 대조, 불일치 throw → `corrupt` → 「대조 불가」 · SC-3 결과 순서 문구 · 테스트(local 파일명만 바꾼 zip) |
| R3-9 | task-06 cleanup · pack-a.md(원문·개인 위키 발췌)·baseline 원문·review-*.json(비밀값 원문)이 cleanup 뒤 잔존(P4·F5) · 원문 팩·baseline 을 임시 산출물로 삭제, --resolve 용 구조화 결과는 비밀값 제거 사본 | medium | FIXED **[루프 판정 — 수명주기 결정: 원문 삭제 + JSON 은 마스킹 사본 보존]** | `cbb2582` — `cleanup({work, adapter})` 가 `pack-a/b.md`·`baseline/` 삭제(raw 에 합산), `mr`·`check`·`review-*`·`findings` JSON 의 **문자열 값**에 어댑터 mask + SECRET_MASK(`deepMask`, 키 이름 제외) 적용해 덮어씀(`masked=<n>`), 파싱 불가 JSON 은 삭제 · SC-3 「산출물 수명주기」·표 · SC-6 출력 · task-07 §0·§8 · 테스트(pack-a·baseline 없음, mr/check/review 값 마스킹, authorTokens 값 보존). 대안 「JSON 도 삭제」는 `--resolve`·재리뷰(§9·§5.6)를 같은 W 에서 못 돌려 채택 안 함. **확인 임무 ③ 우선 감사 대상** |
| R3-10 | task-06 executionBlock · 40줄 제한을 보장하지 않음(차단 발견 30건 → 48줄) · 5절 유지 + 상세를 부록으로 넘기는 결정적 축약 규칙 + 검증 | medium | FIXED | `cbb2582` — 절별 배열 조립 후 결정적 축약 순서 ① 의도 표 6행 초과 → 부록 A ② 차단 짧은 형태(위치·권고 생략) ③ 후속 1건 + 「외 n건 — 부록 D」 ④ 차단 앞 n건 + 「외 n건(차단 — 전부 부록 D 에 있음)」(n 은 40 에 맞춰, 최소 1) · 안내 문장 덧붙이기 제거 · 테스트(차단 30·후속 5·의도 10 → ≤40줄, 5절, 부록 D 에 F30) |

| R4-1 | task-06 cleanup · verdict.json(machineEvidence 의 미확보 링크 raw·reason)·deploy.json(zip 파일명·주석·API 오류 문자열)은 마스킹 대상에서 빠져 원문 비밀값(예: 링크의 `?token=…`)이 cleanup 뒤 남음(R3-9 정책 자체가 아니라 보존 파일 데이터 흐름 결함) · deploy.json·verdict.json 도 문자열 값 마스킹 + SC-3 갱신 + 회귀 | high | FIXED | `f693a72` — `MASKED_JSON` 에 `deploy.json`·`verdict.json` 추가(제외 = 경로·SHA·카운트만 담는 snapshot·pack) · SC-3 표·수명주기 문구 · task-07 §8 · Cautions · 테스트(cleanup `masked=5`, deploy 다운로드 오류 문자열의 `?token=`·verdict 미확보 링크의 `?token=`·이메일 마스킹) |
| R4-2 | task-04 deploy · 기대 배포·삭제 목록이 모두 비면 ④ 삭제 목록 비교 전에 `applicable:false`로 반환 — 문서만 변경한 비면제 MR 에 변경 안 한 운영 파일 삭제 목록을 적어도 통과(R1-4 와 같은 영역, 경로는 ④ 이전 비해당 반환) · 비해당 반환 전 본문 삭제 목록 비교, 기대에 없는 삭제 지시는 M-deploy 로 전달되게 applicable·결과 계약 | high | FIXED (사용자 결정 — R1-4 계열 재출현이라 ESCALATE, 선택지 3 중 「건너뛰기 전에 본문 삭제 목록을 먼저 본다」) | `f693a72` — 기대 변경 0 이어도 `bodyDeletedList` 가 비어 있지 않으면 `applicable:true`·zip 단계 생략·④ 만 대조 → `deleted_list` 불일치 → `M-deploy` · `reason` 「본문 삭제 목록만 대조(④)」 · SC-3 `applicable` 식 · Cautions · 테스트(문서만 MR + Keep.java 삭제 → 불일치, 둘 다 비면 해당 없음). 대안 「알고도 둔다(리뷰어 확인 필요 한 줄)」·「구현 때 처리」 — 사용자가 채택 안 함 |
| R4-3 | task-07 §7 재리뷰 · 이전 실행 블록 「4. 차단 발견」만으로 대조표를 만드는데 R3-10 축약으로 일부가 부록 D 로 옮겨져(30건 반례 8건 생략) 이전 리포트 없는 환경에서는 복원·미확보 처리 없음(§5.6 「이전 차단 발견마다」 미완) · 대조표는 부록 D 또는 보존된 구조화 발견 전체에서, 전체 미확보면 확인 완료로 취급 금지 + 검토자별 전송 범위·미확보 처리 명시 | medium | FIXED → **C1 잔존(생산자 id `M-contract-Base SHA` 의 공백을 파서 `[\w-]*` 가 못 읽어 목록 유실) → FIXED** `32db86e`(기계 id 공백 → `_`, id 문법 `[A-Za-z][\w-]*` 통일 · SC-3 · 테스트 `M-contract-Base_SHA`·전 id 문법 검사) | `f693a72` — task-06 실행 블록 차단 줄에 id 접두(`- F3 DEFECT — …`·`- M-deploy MISSING_EVIDENCE — …`), 축약 ④ 줄에 생략분 id 목록 · task-03 `priorBlockingList`(댓글 항목 + 접힌 id 를 이전 리포트 `<reportDir>/<프로젝트>-<iid>-<prior_head7>.md` 부록 D 에서 복원, 못 하면 `title:null`) → `rereview.priorBlocking`·`priorBlockingComplete`·`priorReport` · task-06 verdict `M-rereview`(불완전 → HOLD_EVIDENCE 이상) · task-07 §7 대조표 원본 = `priorBlocking` 전체, 미확보 항목은 확인 완료 취급 금지, 복원 제목은 마스킹 잔존 검사 뒤 Codex · SC-3 check/verdict · 테스트(check: 리포트 없음 → 불완전, 부록 D 복원 → 완전 / report: 축약 줄 id 수 = 생략 수, M-rereview) |
| R4-4 | task-03 check · `judgeReason()`이 `① 왜: <…>` 같은 양식 표지만 있어도 true(§5.2 「양식 문구 그대로면 없음」 위반, 빈 양식이 bodyReason 으로 남아 이슈 대체도 막힘) · 표지와 실내용 분리, 빈 값·자리표시자·안내문 제외, 본문 실내용 없을 때 이슈 대체 규칙 + 회귀 | medium | FIXED | `f693a72` — `judgeReason` 이 표지 뒤 실내용(꺾쇠 `<…>`·빈 값 제외, `\p{L}\p{N}` 유무)으로 판정 · `reason.source` = 본문 실내용 있을 때만 `body`, 없으면 이슈 대체 · SC-3 `reason` 규칙 · Cautions · 테스트(양식만 → none / 양식만 + 이슈 #12 → issue / 한 칸만 채움 → body·②만 없음) |
| R4-5 | task-05 pack · 위키 검색어가 MR 제목·경로·basename 뿐이라 diff 안 기능명·테이블명이 검색에 안 들어감(§5.3-2·어댑터 §5 요구 — 구현자가 추출 방식을 새로 결정해야 함) · 변경 코드·diff 에서 기능명·테이블명 검색어 확보 계약 + 검증 | medium | FIXED (사용자 결정 — ESCALATE 설계 선택지 4 중 「스크립트가 코드 변경 줄에서 규칙으로 뽑는다」) | `f693a72` — `codeTerms(mr)`: diff 추가 줄의 SQL 테이블명(FROM/JOIN/INTO/UPDATE/TABLE 뒤·`@Table(name=)`)·선언 식별자(class/interface/enum/record/function/def·MyBatis `<select id>`), 길이 ≥ 4·예약어 제외·상한 40 → 위키 grep 검색어에 합산, 용어집 대조 텍스트에 추가 줄 포함 · `pack.json.wikiTerms` · SC-3 · 목적·AC·Cautions · 테스트(제목·파일명에 없는 `report_assign` 만 언급한 페이지 선택, 삭제 줄·산문 낱말 제외). 대안 「어댑터 블록 정규식」·「메인(Claude)이 `--terms`」·「요구 문구 축소(ACCEPTED)」 — 사용자가 채택 안 함 |

| R5-1 | task-05 pack `repoDocText` · worktree 모드가 `repo:` 문서를 작업 트리 파일로 `readFileSync` — MR 이 AGENTS.md 를 워크트리 밖(개인 위키)으로 향하는 심볼릭 링크로 바꾸면 그 본문이 `repo:AGENTS.md@head`·전송 허용으로 팩 B 에 들어감(F4 위반, D16 과 별개) · 고정 SHA 의 git blob 으로 읽고 링크 모드·경로 중간 링크 처리, 외부 가리키는 문서는 미확보 + 회귀 | high | FIXED | `2f760e8` — `git ls-tree <head> -- <경로>`로 모드 확인 → 100644·100755 만 `git show <head>:<경로>`, 120000(링크)·160000(서브모듈)·부재 = `missing:true`(사유 문구) · diff-only raw API 는 blob 내용이라 링크를 따라가지 않음(주석) · SC-3 pack.json 규칙 · Cautions · 테스트(링크 → missing, 링크 대상 본문 두 팩에 없음, 일반 blob 은 커밋 내용·미커밋 변경 미반영) |
| R5-2 | task-06 마스킹 · 어댑터 rrn 패턴이 정상 40자 SHA(`aaaaaaaaaa1234561123456bbbb…`)에 매치해 게시 블록 첫 줄 head 가 `[masked:rrn]`으로 변조(이전 판정 정규식 미인식), cleanup `deepMask`도 findings·verdict `head_sha`를 바꿔 `--resolve` 가 head 불일치 review-failed · 자유 텍스트와 구조 필드 구분, 리포트·cleanup·--resolve 에서 SHA 보존 검증 | medium | FIXED — 루프 판정(토큰 보호) → **C1 감사 이의 → 사용자 재판정(`[감사 이의]`): 「보호 유지 + 이메일·도메인에 붙은 토큰 제외」(선택지 3 중) — 보정 수정 = C1-1 행** · C1 소멸 확인(원 지적 자체는 소멸) | `2f760e8` — `maskText(text, rules)`: `\b(?=[0-9a-f]{40}\b)(?=[0-9]*[a-f])[0-9a-f]{40}\b` 토큰을 자리표시자로 빼고 어댑터 mask + SECRET_MASK 뒤 복원 — 리포트 전체·`deepMask` 문자열 값 공통 · 글자 조건으로 숫자열(전화·주민번호)은 보호 안 함, 7자 SHA 는 패턴 길이 미달 · SC-3 수명주기 · Cautions · 테스트(rrn 매치 SHA 로 verdict→render 첫 줄 보존·`[masked:rrn]` 없음·phone 은 가려짐 → cleanup 뒤 verdict/findings head 보존 → `--resolve` 정상). 대안(필드 이름 예외 목록)은 자유 텍스트(블록 첫 줄·detail 안 SHA)를 못 지켜 채택 안 함. **확인 임무 ③ 우선 감사 대상** |
| R5-3 | task-06 render 부록 D · 실행 블록 축약 ④ 가 모델 발견과 `machineEvidence` 를 함께 접고 부록 D 로 안내하지만 부록 D 는 `findings.findings` 만 출력 — 접힌 `M-deploy` 는 리포트가 있어도 `source:missing`·`priorBlockingComplete:false` → 다음 head 에서 전부 고쳐도 `M-rereview` 로 HOLD_EVIDENCE(R4-3 복원 정책이 아니라 생성측 누락) · 기계 항목도 복원 가능한 형식으로 부록 저장 + 회귀 | medium | FIXED | `2f760e8` — 부록 D 에 `machineEvidence` 항목을 같은 줄 형식(`- **M-…** [기계] MISSING_EVIDENCE (차단) — <detail> (-:-) · 출처 machine · 확신 -` + 근거 줄)으로 기재 · 「(발견 없음)」은 둘 다 없을 때만 · SC-3 verdict 절 · Cautions · 테스트(report: 30건+M-deploy 축약 → 접힌 id 에 M-deploy·부록 D 에 기계 줄 / check: 부록 D 의 M-deploy 복원 → `source:report`·complete) |

| C1-1 | task-06 `maskText` · SHA 자리표시자가 이메일 마스킹을 우회 — local-part 가 16진수 40자인 주소(`aaaa…40hex@example.test`)의 앞부분이 먼저 빠져 이메일 정규식이 매치하지 못하고 주소가 리포트·cleanup JSON 에 남음 · 개인정보 마스킹이 SHA 보존보다 우선, 두 검증 함께 | high | FIXED (사용자 재판정 — R5-2 감사 이의 처리) | `32db86e` — `SHA40_RE` 에 경계: 앞에 `@`·`.`·단어 문자, 뒤에 `@`·`.<영숫자>`·단어 문자가 붙은 토큰은 보호하지 않음(URL 경로 `/<sha>/`·문장 끝 `<sha>.` 은 유지) · Cautions · 테스트(`<sha>@example.test` → 주소·온전한 local-part 잔존 없음, 같은 문장의 진짜 SHA 보존, URL·문장 끝 보존). 어댑터 패턴 순서(rrn → email)상 local-part 는 `aaaaaaaaaa[masked:rrn][masked:email]` 로 가려진다(주소 미노출) |

| R6-1 | task-05 pack 팩 B · 어댑터 개인정보 패턴만 적용해 MR 본문·댓글·발췌의 비밀값(`password = "…"`·API 키)이 그대로 Codex 전송, 잔존 검사도 통과(codexSkipped=false) — task-06 SECRET_MASK 는 리포트에만(F5) · 팩 B 에도 엔진 비밀값 제거 규칙 공유 + 잔존 검사 포함 + 회귀(D4 코드 전송 범위는 유지) | high | FIXED | `45cd070` — `SECRET_MASK`·`SHA40_RE`·`maskText`를 task-06 report.mjs 에서 task-05 **pack.mjs 로 이동**(정본 — report 는 import·재export, 순환 회피) · 팩 B = `maskTextWithCounts(rawB, adapter.mask)`(어댑터 mask + SECRET_MASK, SHA 보존) · `residual(masked, [...adapter.mask, ...SECRET_MASK])` · `pack.json.mask.applied.secret` · bare `Bearer` 패턴 문자 집합을 넓혀 SHA 자리표시자(`\u0000sha40:n\u0000`)가 비밀값 자리에서 복원되지 않게 · SC-3 pack.json 규칙 · task-05/06 AC·Cautions·Prep · task-09 게이트 주석 67 · 테스트(pack: 본문 `password = "…"`·댓글 `api_key:`·`{"client_secret": "two word"}` → B 에 없음·`[masked:secret]`·codexSkipped=false·헤더 SHA 보존·residual(SECRET_MASK) 0) |
| R6-2 | task-06 cleanup / task-07 §0 · 사용자 중단 시 백그라운드 검토자(Claude·Codex)의 종료·회수 계약이 없어 cleanup 뒤 살아 있는 검토자가 review-*.json 원문을 다시 쓰거나 같은 W 재사용 시 경합(codex.pid 도 먼저 삭제) · 공통 종료 절차에 두 검토자 종료 확인을 cleanup 선행 조건으로, 확인 전 PID 삭제·W 재사용 금지 | high | FIXED (사용자 결정 — 정밀 모드 즉시 ESCALATE, 선택지 3 중 「스킬이 먼저 종료 확인 + cleanup 은 살아 있으면 거부」) | `45cd070` — task-07 §0 「검토자 종료 확인」(cleanup 선행 조건: Claude = `TaskStop` + 중지·완료 알림 대기 · Codex = `codex.pid` 프로세스 그룹 TERM → 10초 생존 확인 → KILL · `REVIEWER_ALIVE`면 cleanup 금지·보고) · §1 같은 W 재사용 전 동일 확인 · §8·금지·AC·Cautions · task-06 `cleanup`이 `codex.pid` 프로세스 생존이면 `ReportError`(ERR exit 2, 아무것도 지우지·마스킹하지 않음) · SC-3 표·수명주기 · SC-6 cleanup 행 · 테스트(살아 있는 node 자식 pid → ERR·파일 전부 보존·review-codex 원문 유지 → kill·회수 뒤 정상 CLEANED). 대안 「cleanup 이 직접 죽인다」·「스킬 절차만」 — 사용자가 채택 안 함 |
| R6-3 | task-07 §6 병합 · 같은 지문의 두 결과가 `fixableInDesign` yes/no 로 갈릴 때 병합 규칙 없음(유형·확신만 선택, 상충 확인은 차단 여부 차이만) — 이 값으로 CHANGES_REQUESTED ↔ RETURN_TO_DESIGN 이 바뀜 · fixableInDesign·brokenPremise 불일치도 메인 확인 대상, 미해소면 양쪽 보존 + 판정 미확정·리뷰어 확정 절차 연결 | medium | FIXED (사용자 결정 — 정밀 모드 즉시 ESCALATE, 선택지 3 중 「판정 미확정으로 두고 리뷰어가 --resolve 로 정한다」) | `45cd070` — task-07 §6-1 `fixableInDesign`은 둘이 같을 때만 그 값 · §6-3 상충 = 메인이 코드·기준선 문서로 어느 전제가 깨졌는지 확인, 못 하면 `fixableInDesign:null` + `fixableInDesignClaims:{claude,codex}` + `brokenPremise`(no 쪽) + `unresolved` · §9 `--resolve <id>=confirmed:fixable|confirmed:design` · task-06 `parseResolve`(접미 없는 `confirmed`는 상충 항목에서 ERR, `dismissed` 접미 금지)·`claimsConflict`·`branches` 세 갈래(`calcOn`)·`cmdVerdict` 접미를 `fixableInDesign` 확정값으로 영속·render 「리뷰어 확인 필요」 세 갈래 안내 + 부록 D 「검토자 주장」(비상충 문구는 그대로) · SC-3 verdict.json branches · SC-5 필드·규칙 · SC-6 verdict 행 · 테스트(미확정 세 갈래 · confirmed ERR · design→RTD · fixable→CHANGES · 영속·claims 보존 · 리포트 문구). 대안 「엄한 쪽 자동 채택」(D9 — 새 판정 규칙)·「메인이 반드시 정한다」 — 사용자가 채택 안 함 |
| R6-4 | task-10 §검증 / task-11 표본 · 직접 CLI 호출(collect→check→deploy→pack)에 공통 종료 절차가 적용되지 않아 워크트리·zip·pack-a·원문 JSON 잔존 · 성공·실패 모두 cleanup 하는 종료 절차 + 측정값은 정리 전 추출 | medium | FIXED | `45cd070` — task-10 §2 검증 뒤 「종료 절차」(측정값(`codexSkipped`·`mask.applied`) 먼저 읽고 어느 단계가 ERR 여도 마지막에 `cleanup`, 검토자 없음 = 종료 확인 해당 없음, 원문 잔존 0 확인)·AC·Cautions · task-11 §2 표본 루프 마지막 줄 `cleanup`(ERR 여도 실행, 측정 줄은 그 앞)·AC·Cautions |

| C2-1 | task-05 pack 팩 B 잔존 검사 · `maskTextWithCounts`가 SHA 를 복원한 뒤 `residual`이 어댑터 패턴을 다시 적용해 rrn 에 걸리는 정상 head SHA(`aaaaaaaaaa1234561123456bbbb…`)가 거짓 잔존 → `codexSkipped:true`·`packB:null`(R6-1 수정의 회귀) · 잔존 검사에도 같은 SHA 보호 경계를 적용하거나 복원 전에 검사 + 오탐·제거 동시 검증 | medium | FIXED (사용자 판정 — C2 ESCALATE, 선택지 3 중 「복원 전 검사」) | `d4398de` — `maskTextWithCounts`가 자리표시자 상태 텍스트에서 `residual(…, [...maskRules, ...SECRET_MASK])`를 계산해 `residual` 필드로 반환, pack 은 그 값을 사용 · SC-3 pack.json 규칙 · AC·Cautions · 테스트(rrn 매치 head SHA + 전화 + password → codexSkipped=false·residual []·헤더·본문 SHA 보존·phone/secret 가려짐 / 단위: 보존 SHA 는 잔존 아님, weird→phone 순서의 진짜 잔존은 잡힘). 대안 「팩 B 에서 SHA 보호 제거」(헤더 head 변조 — R5-2 재발)·「구현 때 처리」 — 사용자가 채택 안 함 |

미확인 FIXED 큐(C3 뒤·재수정 후 — **루프 종결 시점**): **1건** = R2-6(C3 잔존 4회째 → 재수정 `bf43318`, 판정 주체 = 사용자) — **impl review-loop 첫 확인 라운드 임무 ① 필수 항목으로 이월(폴백 ①, 사용자 결정 2026-10-21)**. C3 소멸 확인 1건: C2-1(큐 이탈). (C2 뒤 참고: 2건 = R2-6 · C2-1) C2 소멸 확인 8건: R2-1 · R3-8 · R4-3 · C1-1 · R6-1 · R6-2 · R6-3 · R6-4(큐 이탈). (R6 수정 후 참고: 9건 = R2-1 · R2-6 · R3-8 · R4-3 · C1-1 · R6-1~R6-4) C1 소멸 확인 32건: R1-1~R1-10 · R2-2~R2-5 · R2-7 · R2-8 · R3-1~R3-7 · R3-9 · R3-10 · R4-1 · R4-2 · R4-4 · R4-5 · R5-1~R5-3(큐 이탈). (R5 수정 후 참고: 36건 = R1-1~R1-10 · R2-1~R2-8 · R3-1~R3-10 · R4-1~R4-5 · R5-1~R5-3) — 소멸 확인은 확인 라운드 임무 ①. 루프 직접 판정: R1-8 · R3-6 · R3-9 (C1·C2 감사 모두 「타당」 — 다음 확인 C3 에서도 감사 대상 유지) · R5-2 는 C1 감사 이의 → 사용자 재판정으로 전환(루프 판정 아님). 사용자 판정: R4-2 · R4-5 · R2-6(C1·C2) · R5-2 재판정/C1-1(C1) · R6-2 · R6-3(R6, 정밀 모드 즉시 ESCALATE → 추천안 FIXED) · **C2-1(C2 ESCALATE → 복원 전 검사)** · 진행 결정(C2 → 새 세션 전체 브랜치 확인 C3) · R2-6 C3 재판정(FIXED) · 확인 부채 처리(폴백 ① impl 이월) — 감사 대상 아님, 확인 첨부물 ⑥ 사용자 기결정 목록에 넣는다. batch ESCALATE 적재: 0건(flush 통과). 미판정 blocking: 0.

**종결(2026-10-21)**: plan 루프 종결 — 폴백 ①(확인 예산 2/2 소진 · 복귀 1회 사용 · 폴백 ② 미소비) · 미확인 FIXED 큐 **1**(R2-6 `bf43318` — impl 리뷰 이월, 위 문단) · 미판정 blocking 0 · 최종 verdict **fail**(C3, 사유 = R2-6 뿐 → 수정 `bf43318`·사용자 판정으로 닫음) · 적대 6(R1~R5 + 복귀 R6) · 확인 3(C1·C2 + 재진입 C2 는 예약분 — C1·C3 가 예산) · 루프 건강(분모 = 고유 blocking 42 = R1 10·R2 8·R3 10·R4 5·R5 3·R6 4·C1-1·C2-1): 재론률 0/42 · 철회 조항 0 · 사람개입률 8/42(R4-2·R4-5·R2-6·R5-2/C1-1·R6-2·R6-3·C2-1 + 진행 결정) · 추천 자동 채택(위임) 해당 없음(수동 모드) · no-AI-trace grep 0.

## 적대검증 ledger (impl)

보안 크리티컬: yes (호출자 지정 — 기동 전 사용자 확인 2026-10-21 22:2x) — 접촉면 외부 전송(팩 B → Codex)·개인정보 경계(마스킹)·zip 해석·경로(diff-only 복원·첨부 API 경로) · 근거 = SDD 자동 보안 리뷰 이월 6건

- 루프: base `6c0f5e7`(6c0f5e7ab3f346ff18897c2ba42531e23b9e9a18, 호출자 지정 — plan 루프 종결 커밋 = 구현 착수 직전, SC-7 `<base>`) · branch `gguii74-rwk/mr-review-skill-impl`(오르카 워크트리) · 착수 HEAD `2c80ce9` · 예산 max 5 · confirm 2 · auto 1 · **위임 모드**(`DEV_WORKFLOW_MODE=delegated`) · 입도 = 통합 1회(task 별 증분 없음 — 「review-loop(impl) 입도」).
- 사전 게이트(SC-7, HEAD `2c80ce9`): T1 69/69 · T2 0 · T3 56/56 · T4 0 · T5 0 · T6 0(skills·tests 전체 0 · README 추가 줄 0 — 위 SC-7 T6 기준 줄) · T7 0 · 대장 대기 0 · codex companion 1.0.6.
- 승계: plan 루프 **폴백 ① 종결**(성공 종료 아님) — plan R2-6 `bf43318`(구현 = task-03 `f4cc40f` `check.mjs` `stripFences` + 테스트 #998·#997)을 이 루프의 미확인 FIXED 큐에 처음부터 넣는다(「review-loop(impl) 필수 확인 항목」). SDD 원장(`.superpowers/sdd/2026-10-21-mr-review-skill/progress.md`, git 밖)의 이월 항목(보안 6 · 우선 minor 3 · 나머지 deferred minor)은 R1 §2c 분류 입력 — 행마다 출처 `SDD 이월`, 적대 라운드가 같은 결함을 내면 같은 행에 병합.
- score 산식 = 전환용(미확인 FIXED 큐 제외, §2c 분류 직후·수정 전 스냅샷, weight c4/h3/m1). 보안 트랙이라 전환 신호 1(정체) 무시.

- R1(적대·자동, HEAD `0f50625`, 2026-10-21 22:2x~22:3x, 실행 로그 40건 · 응답 유효): 신규 8건(high 6·medium 2) — 3건은 SDD 보안 이월 행에 병합(R1-3 → S-1 · R1-7 → S-3 · R1-8 → S-5), R1-4 는 SDD T05 minor(중첩 루트)를 같은 행에 병합. SDD 이월 입력: 보안 6(S-1~S-6, 위험군 → 즉시 ESCALATE 6건, 답 = 전부 첫 선택지(추천) FIXED — 기록 당시 메인 TUI 경유라 `추천 자동 채택(위임)`으로 적었으나 **메인 정정(2026-10-22): 사용자 직접 판정** → `(사용자 판정)`, 감사 제외(확인 첨부물 ⑥)·재논의 금지 · 대장 행 1~6 확인) · 우선 minor 3(M-1·M-2 FIXED, 같은 W·head 재사용은 재현 안 됨 → DEFER_LOW) · 나머지 minor(문서 결함 5건 M-3~M-7 = medium + FIXED, 그 밖 DEFER_LOW). 기결정 재론 0 · batch 적재 0. 수정 커밋 `4b345fa`(T1 **81/81** = adapter 8·collect 10·check 13·deploy 15·pack 17·report 18 · T2~T7 0 · T3 56/56). 적대 소진 1 = auto-rounds → batch flush(적재 0 — 통과) → **정밀 모드**. 전환 신호: 보안 트랙(신호 1 무시) · 신호 2 미발화(FIXED 후보 18) · 신호 3 미발화(1/5) → R2 적대. plan R2-6: 적대 비재출현(R1) — 참고 신호, 큐 유지.

- R2(적대·정밀, HEAD `e7ec905`, 2026-10-22 07:1x, 실행 로그 28건 · 응답 유효): 신규 4건(high 3·medium 1) · 기결정 재론 0. R2-1 = S-5 계열(zip 리더 간 해석 차이) 2회째 · R2-2·R2-3 = R1-1·R1-2 계열(비밀값 마스킹 범위 누락) 재출현 → 같은 계열 반복 + 보안 경계라 즉시 ESCALATE 4건(R2-4 포함 — 다른 서버 MR 전송, 설계 선택지 4). 답 = 전부 첫 선택지(추천) — **메인 정정(2026-10-22 08:5x): 사용자 판정이 아니라 메인 키 입력으로 제출된 것 → `추천 자동 채택(위임)`**, 확인 임무 ③ 우선 감사 대상 · 대장 행 7~10. 수정 커밋 `ea06f7d`(T1 **86/86** = adapter 9·collect 11·check 13·deploy 16·pack 19·report 18 · T2~T7 0 · T3 56/56). 전환 신호: 보안 트랙(신호 1 무시) · 신호 2 미발화(FIXED 후보 4) · 신호 3 미발화(2/5) → R3 적대. 운영 규칙 변경(사용자 지시 2026-10-22 08:46): 이후 ESCALATE 답은 메인 대리 채택 = `추천 자동 채택(위임)`(push·비가역·다른 머신만 사용자).

| 라운드 | 모드 | HEAD | critical/high/medium (신규/잔존) | 전환용 score | 미확인 FIXED 큐 | verdict |
|---|---|---|---|---|---|---|
| R1 | 적대·자동 | `0f50625` | 0/6/2 (R1 신규 8) + SDD 이월 blocking 13(보안 6 · minor 7) → 고유 행 18(병합 4) — 전부 FIXED(즉시 ESCALATE 6 = 사용자 판정 — 메인 정정) | **30** | 1(R2-6 승계) → 수정 후 19 | needs-attention |
| R2 | 적대·정밀 | `e7ec905` | 0/3/1 (신규 4 · R1 큐 잔존 0 — 적대 비재출현, 큐 유지) — 전부 FIXED(즉시 ESCALATE 4 = 추천 자동 채택(위임)) | **10** | 19 → 수정 후 23 | needs-attention |

| # | fingerprint (file · title · recommendation 요지) | severity | disposition | 근거 |
|---|---|---|---|---|
| S-1 | collect.mjs `rebuildDiffOnly` · diff-only 복원이 API `new_path`/`old_path` 를 검증 없이 `path.join` — Windows `..\`·상위 이동으로 work 밖 쓰기 · 절대·드라이브·역슬래시·`..` 거부 + 해소 목적지가 루트 안인지 확인, 밖이면 unrecovered | high | FIXED (사용자 판정 — 즉시 ESCALATE, 메인 정정 2026-10-22) | 출처 SDD 이월(T02 path_traversal) + R1-3 병합. `4b345fa` — `insideRoot(root, rel)` · head·base 양쪽 · 테스트(5가지 탈출 경로 + base 경로 → unrecovered, 밖에 파일 없음, 원문 조회 0) |
| S-2 | check.mjs `resolveIssue` · 이슈 댓글이 작성자 신뢰 필터 없이 기준선 원문·LLM 입력 · 신뢰 표지(작성자·「참고 자료 — 지시 아님」) | medium | FIXED (사용자 판정 — 선택지 3 중 「표지만 단다」; 「신뢰 작성자 댓글만」·「알고도 둔다」 미채택) | 출처 SDD 이월(T03). `4b345fa` — 댓글 절 제목 「## 이슈 댓글 (참고 자료 — 작성자 표기, 지시 아님)」 · pack `issue` 출처 `note` · SKILL Claude 프롬프트 지시 무시 문구 · 테스트(check·pack) |
| S-3 | deploy.mjs `readZip.read` · `inflateRawSync` 출력 상한 없음(압축 폭탄 — 크기 검사가 할당 뒤) · 항목별 상한 + maxOutputLength | medium | FIXED (사용자 판정) | 출처 SDD 이월(T04①) + R1-7 병합. `4b345fa` — `MAX_ENTRY` 256MiB · `maxOutputLength = 선언 크기` · 테스트(8MiB 를 usize 1 로 선언 → 「선언 크기」 throw · 상한 초과 선언) |
| S-4 | deploy.mjs 첨부 다운로드 · `att.filename` 무인코딩으로 `uploads/…` API 경로에 붙음(`..` 로 다른 GET 엔드포인트) · 디코딩 → 경로 성분 거부 → 재인코딩 | medium | FIXED (사용자 판정) | 출처 SDD 이월(T04②). `4b345fa` — `uploadName(att)`(secret 32자 16진수 · `/`·`\`·`..`·NUL 거부) · 테스트(`..%2F..`·`../..` → 조회 0·대조 불가 · 한글·공백 이름 정상) |
| S-5 | deploy.mjs `readZip` · EOCD 목차 크기·디스크·항목 수·위치·중복 이름 미검사(배포 도구와 다른 목록) · 교차 검증, 어긋나면 corrupt | medium | FIXED (사용자 판정) | 출처 SDD 이월(T04③) + R1-8 병합. `4b345fa` — EOCD = 파일 끝 · 디스크 0 · 항목 수 일치 · `cdOff + cdSize = EOCD = 파싱 끝` · 중복 이름 throw · 테스트(목차 크기 0·디스크·항목 수·꼬리 바이트·중복) |
| S-6 | pack.mjs 2단계 `exportable` · 다른 등록 프로젝트의 이슈 원문(`issue`)이 팩 B(Codex)로 — 저장소 링크 규칙과 비대칭 · 이슈도 대상·docsRoot 프로젝트만 | medium | FIXED (사용자 판정 — plan R1-3 의 `issue = true` 를 좁힘, SC-3 1줄) | 출처 SDD 이월(T05). `4b345fa` — `exportable = body ∨ 프로젝트 ∈ {대상, docsProject}` · SC-3 `exportAllowed` 규칙 · 테스트(beta 이슈 B 제외·alpha 이슈 B 포함) |
| R1-1 | pack.mjs `SECRET_MASK` · 개인정보 선치환(`"[masked:phone] 나머지"`)을 이미 가린 값으로 오인해 나머지 비밀값 노출·잔존 0 · 값 전체가 표식일 때만 건너뜀 + 회귀 | high | FIXED | `4b345fa` — `WHOLE_MARK`(표식 + 끝 구분자일 때만 제외) · 따옴표 없는 값은 표식 섞인 토큰을 한 덩어리로 · 테스트(따옴표 2종·따옴표 없음 · 멱등) |
| R1-2 | pack.mjs `SECRET_MASK` · 이스케이프된 따옴표(`"prefix\"remaining"`)를 값 끝으로 해석해 뒷부분 노출 · 이스케이프 소비 + 회귀 | high | FIXED | `4b345fa` — 따옴표 값 = `(?:[^"\\\n]\|\\.)+`(3종 따옴표) · 테스트(JSON `\"`·작은따옴표 `\'`) |
| R1-4 | pack.mjs `wikiPages` · 허용 루트(`~/wiki`) 안의 금지 루트(`~/wiki/private`) 페이지가 허용 루트 재귀로 팩 B 에 · 금지 하위 제외 | high | FIXED | R1 + SDD 이월(T05 minor 「export:true 안 export:false 중첩 F4 우회」) 병합. `4b345fa` — 허용 루트 탐색에서 모든 금지 루트 하위 제외(`inside`) · SC-3 · 테스트(금지 루트로만 1회 등록·B 에 본문·경로 없음) |
| R1-5 | SKILL.md §5 · 렌즈 원문을 팩 B 밖에서 Codex 프롬프트에 다시 붙여 마스킹 우회 · Codex 는 팩 B adapter 출처에서 렌즈를 읽게 | high | FIXED | `4b345fa` — 공통 입력 4·「팩 B 밖」 목록에서 렌즈 원문 제거(렌즈 id·순서만) |
| R1-6 | deploy.mjs `readZip` · creator·external attributes 미파싱 — 일반 파일을 심볼릭 링크로 바꾼 zip 도 「일치」 · 항목 유형을 head 의 git 모드와 대조 | high | FIXED | `4b345fa` — 항목 `type`(Unix 모드: file·symlink·dir·special) · `gitType`(ls-tree) 불일치 = `type` mismatch → 불일치 · 테스트(central 외부 속성만 링크로) |
| M-1 | check.mjs `BLOB_RE` · blob 링크의 `?ref_type=heads`·끝 구두점이 경로에 섞여 거짓 미확보 → HOLD_EVIDENCE · 쿼리·구두점 제거 | medium | FIXED | 출처 SDD 이월(T03 우선 minor). `4b345fa` — `?` 앞에서 끊기 · `TRAIL_PUNCT` · 테스트 |
| M-2 | report.mjs `cmdVerdict` · findings.json 검증 없음(`blocking:"true"`·오타 type → 차단 발견이 빠져 APPROVE) · 없는 id 의 `--resolve` 무시 · 손상 JSON 스택 · 형식 검증 ERR | medium | FIXED | 출처 SDD 이월(T06 우선 minor) + T06 minor(손상 JSON SyntaxError) 병합. `4b345fa` — `validateFindings` · 없는 id ERR · `readJson` ReportError(파일명) · 테스트(7 형태 + 없는 id + 깨진 JSON, stderr 0) |
| M-3 | SKILL.md §8 · 리포트 절 목록에 「리뷰어 확인 필요」 조건·「리뷰 실패」·「리뷰어 결정」·부록 D 누락 · 목록 보정 | medium(문자적 갭 — 저비용 수정 반영) | FIXED | 출처 SDD 이월(preflight). `4b345fa` |
| M-4 | SKILL.md §5 스키마 · `"reviewer": "<claude\|codex>"` 가 두 검토자에게 상대 모델 존재를 드러냄(D11) · 자기 이름 하나만 | medium | FIXED | 출처 SDD 이월(T07). `4b345fa` — `<REVIEWER>` + 바꿔 넣기 지시 |
| M-5 | SKILL.md §5 · Codex 본문 JSON 을 `review-codex.json` 에 쓰라는 지시 없음 · 명시 | medium | FIXED | 출처 SDD 이월(T07). `4b345fa` |
| M-6 | SKILL.md §0 · `$A`·`$W`·`$ROOT` 가 Bash 호출 간 남지 않음 · 블록마다 재지정 | medium | FIXED | 출처 SDD 이월(T07). `4b345fa` |
| M-7 | SKILL.md §8 · F1 자가 점검 「glab 호출 전부 api GET」 vs §0 `glab auth status` 문자 충돌 · 예외 명시 | medium | FIXED | 출처 SDD 이월(T07). `4b345fa` |
| R2-1 | deploy.mjs `readZip` · 확장 필드(0x7075 Unicode Path)를 건너뛰어 자체 리더와 unzip 이 다른 이름을 읽음(검토 안 한 파일이 「일치」로 배포) · 경로 재정의 칸 거부 + 회귀 | high | FIXED (추천 자동 채택(위임) — S-5 계열 2회째 즉시 ESCALATE, 선택지 3 중 「알려진 칸만 허용」; 「경로 덮어쓰기 칸만 거부」·「알고도 둔다」 미채택) **[자동 채택(위임)] 확인 임무 ③ 우선 감사** | `ea06f7d` — `SAFE_EXTRA` = {0x5455, 0x7875}(git archive 2.43 산출물 실측 = 0x5455 뿐) · `checkExtra` central·local · 길이 불일치 거부 · 테스트(0x7075 central·local · 깨진 칸 · 0x5455 통과) |
| R2-2 | pack.mjs `SECRET_MASK` · 여러 줄 비밀값(YAML `key: \|` 블록·줄바꿈 든 따옴표)이 `\|` 만 가려지고 잔존 0 으로 Codex 전송 · 전체 범위 마스킹, 판독 불가면 실패 + 회귀 | high | FIXED (추천 자동 채택(위임) — R1-1·R1-2 계열 재출현 즉시 ESCALATE, 선택지 3 중 「여러 줄 형태도 가린다」; 「애매하면 Codex 건너뜀」·「알고도 둔다」 미채택) **[자동 채택(위임)] 우선 감사** | `ea06f7d` — YAML 블록 스칼라 규칙(따옴표 없는 값 규칙보다 먼저) · 따옴표 값 줄바꿈 허용(상한 4000자) · 열린 따옴표는 줄 끝까지 · 테스트(5 형태 · 빈 값 옆 키 보존 · 잔존 0) |
| R2-3 | pack.mjs `excerpt` → 팩 B 마스킹 · 발췌 상한이 PEM END 줄을 잘라 완결 PEM 규칙이 못 잡음(키 본문 전송) · 발췌 전 마스킹 또는 닫히지 않은 PEM 실패 처리 | high | FIXED (추천 자동 채택(위임) — 마스킹 계열 즉시 ESCALATE, 선택지 3 중 「잘린 키도 가린다」; 「발췌 전에 원문에서 가린다」·「알고도 둔다」 미채택) **[자동 채택(위임)] 우선 감사** | `ea06f7d` — 완결 PEM 뒤에 「BEGIN + 키 본문 줄(base64·머리 줄)」 규칙 · 테스트(단위 + 위키 발췌가 키 중간에서 끊긴 CLI pack → 팩 B 에 키 본문 없음) |
| R2-4 | gitlab.mjs `run` · glab 이 실행 디렉터리의 인증 호스트를 골라 다른 서버의 같은 프로젝트 ID·MR 번호를 수집·전송 가능 · 어댑터 호스트 + `--hostname` + web_url 대조 | medium | FIXED (추천 자동 채택(위임) — 설계 선택지 4 즉시 ESCALATE, 「어댑터에 호스트 필수」; 「선택 키」·「실행 위치 안내만」·「알고도 둔다」 미채택 — SC-2 필수 키 추가) **[자동 채택(위임)] 우선 감사** | `ea06f7d` — 어댑터 필수 `gitlab.host`(호스트[:포트]) · `setHost` 미설정이면 조회 거부 · 모든 호출 `--hostname` · collect `web_url` 호스트 대조 ERR · SC-2 · 테스트(호스트 기록 · 다른 호스트 ERR · 어댑터 키 검증) |

DEFER_LOW(출처 SDD 이월 — 요약 기록, 판정 영향 없음·fail-closed 이거나 표기·성능): 같은 W·같은 head 재실행 시 이전 `review-claude.json` 재사용(T07 우선 minor — **재현 안 됨**: `collect.mjs:172` 가 새 수집마다 `review-*.json`·`findings.json`·`verdict.json` 을 지운다, §9 `--resolve` 는 §5 를 다시 돌리지 않음) · worktree 모드 이전 `blobs/` 미삭제(preflight·T02 — cleanup 이 지움, 검토자 cwd 는 워크트리) · check `deployRequired` 가 diff-only rename old path 미반영(표시 전용) · 테스트 `deepMaskText` 이름·no-op · P2 「6모듈」 vs lib 7 · task-02 「단계 5」 표기 · T01 main() 로드 시 실행·`validate()` 중첩 배열 TypeError·값 없는 끝 `--resolve`(TypeError 로 멈춤 — 조용한 손실 아님) · T02 HEAD_MOVED 뒤 이전 mr/snapshot 잔존(SKILL 이 멈추고 cleanup) · diff 끝 개행·헤더 형식 차이 · 파일별 git 프로세스 · T03 `isPlaceholder` 의 `없음|TBD|TODO`·양식 문구 고정 · sameHead 접두 길이(어댑터 정규식이 정함) · 후보 루프 일시 오류(최종은 미확보) · ENOENT 스택(PF-7 로 해소) · `attachmentClaimedButMissing` 의 「첨부 없음」 문장(표시) · T04 주석 SHA 7자 접두 · `parseDeletedList` 공백 경로·비고 오인(fail-closed) · export-ignore/subst 거짓 불일치(fail-closed) · 미사용 `git` import · T05 PackError 스택(PF-7 해소) · pack.mjs `repoDocText` 주석 「워크트리 파일」 표기 · 공통 문서 작업 트리 읽기 vs HEAD SHA 출처 표기 · diff-only `repo:` raw 경로 테스트 없음 · T06 정수 아닌 pid · 조기 종료 블록 id 접두·유형 표기 · T07 §7 Codex 표 열 문구·수동 잔존 검사 SECRET_MASK(리포트는 저장 시 이미 적용) · zsh `kill --` 미실측·그룹 생존은 리더만 · T08 README 트리 중괄호·`--resolve` 의미 설명.

미확인 FIXED 큐(R2 수정 후): **23건** = plan R2-6(승계) · S-1~S-6 · R1-1 · R1-2 · R1-4 · R1-5 · R1-6 · M-1~M-7 · R2-1~R2-4. (R1 수정 후 참고: 19건 — R2 적대 비재출현은 참고 신호, 큐 유지) 루프 직접 판정(ACCEPTED/OUT_OF_SCOPE/DEFERRED_TO_IMPL/DUPLICATE): 0. 사용자 판정: S-1~S-6(메인 정정 — 감사 제외). 추천 자동 채택(위임): R2-1~R2-4(확인 임무 ③ 우선 감사 · 대장 7~10). 미판정 blocking: 0. batch 적재: 0.

## 확인 대기 대장

| # | 일시 | phase·지점 | 질문 요지(쉬운 말 1줄) | 채택 선택지 | 출처 | 상태 |
|---|---|---|---|---|---|---|
| 1 | 2026-10-21 22:3x 질문 · 2026-10-22 07시 전 응답 | impl·R1 즉시 ESCALATE | diff-only 로 파일을 내려받을 때 작업 폴더 밖에 써질 수 있는 경로를 막을까 (S-1) | 지금 고친다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-22, 메인 정정 — 사용자 직접 판정) |
| 2 | 2026-10-21 22:3x 질문 · 2026-10-22 07시 전 응답 | impl·R1 즉시 ESCALATE | 이슈 댓글(누구나 쓰는 글)을 검토 모델에 줄 때 어떻게 다룰까 (S-2) | 표지만 단다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-22, 메인 정정 — 사용자 직접 판정) |
| 3 | 2026-10-21 22:3x 질문 · 2026-10-22 07시 전 응답 | impl·R1 즉시 ESCALATE | 배포본 zip 압축 폭탄으로 메모리가 바닥나는 걸 막을까 (S-3) | 지금 고친다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-22, 메인 정정 — 사용자 직접 판정) |
| 4 | 2026-10-21 22:3x 질문 · 2026-10-22 07시 전 응답 | impl·R1 즉시 ESCALATE | 첨부 파일명으로 다른 GitLab 주소를 읽게 되는 걸 막을까 (S-4) | 지금 고친다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-22, 메인 정정 — 사용자 직접 판정) |
| 5 | 2026-10-21 22:3x 질문 · 2026-10-22 07시 전 응답 | impl·R1 즉시 ESCALATE | 배포 도구와 다르게 읽히는 변조 zip 을 거부할까 (S-5) | 지금 고친다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-22, 메인 정정 — 사용자 직접 판정) |
| 6 | 2026-10-21 22:3x 질문 · 2026-10-22 07시 전 응답 | impl·R1 즉시 ESCALATE | 다른 등록 프로젝트의 이슈 원문도 Codex 로 보낼까 (S-6) | 저장소 문서와 같게 좁힌다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-22, 메인 정정 — 사용자 직접 판정) |
| 7 | 2026-10-22 07:2x | impl·R2 즉시 ESCALATE | zip 확장 필드로 파일 이름을 바꿔치기하는 zip 을 어떻게 막을까 (R2-1) | 알려진 칸만 허용 (FIXED) | 추천 자동 채택(위임) | 확인 대기 |
| 8 | 2026-10-22 07:2x | impl·R2 즉시 ESCALATE | 여러 줄 비밀값(YAML `\|` 블록 등)을 어떻게 가릴까 (R2-2) | 여러 줄 형태도 가린다 (FIXED) | 추천 자동 채택(위임) | 확인 대기 |
| 9 | 2026-10-22 07:2x | impl·R2 즉시 ESCALATE | 발췌가 END 줄을 잘라낸 비밀키를 어떻게 가릴까 (R2-3) | 잘린 키도 가린다 (FIXED) | 추천 자동 채택(위임) | 확인 대기 |
| 10 | 2026-10-22 07:2x | impl·R2 즉시 ESCALATE | glab 이 엉뚱한 GitLab 서버에 묻는 걸 어떻게 막을까 (R2-4) | 어댑터에 호스트 필수 (FIXED) | 추천 자동 채택(위임) | 확인 대기 |
