# mr-review 1.3.5 — 다른 저장소 첫 실사용(스킬 vs 스킬 없는 리뷰 비교)에서 드러난 결함 4건 + 안내 누락 1건 수정

> 상태: **review-loop(spec) 종결(2026-10-23 23:4x · 성공 종료 · C3 대상 HEAD `56ea0aa` · blocking 10 전부 FIXED · D109~D112 신설 · 확인 대기 대장 #1~#7 = 추천 자동 채택(위임) — 사용자 확인 대기 · 다음 = 대장 확인 → 7 impl → 8 review-loop(impl, 보안 yes) → 9 릴리스)** · 이전: spec 확정·harden 완료(2026-10-23 22:4x — 3 harden-spec 수동 트랙(워크트리 `mr-review-1-3-5-fixes`) · 설계 질의 6건(Q1~Q6) + harden 판단 갭 15건(H-1~H-9·H-12·H-13·H-15·H-16·H-18·H-19) = 사용자 지시로 메인이 추천안 입력(사용자 지시 22:43 「이제부터 위임모드로 머지까지 진행」) · 사실 갭은 코드 조회로 닫음 · DEFERRED 0건 · 다음 = 4 review-loop(spec, 보안 yes) → 7 impl → 8 review-loop(impl, 보안 yes) → 9 릴리스(push·머지·릴리스는 사용자 확인)) · 이전: spec 초안(22:2x) · 작성 2026-10-23 · 버전 **1.3.5 패치**
> 선행: 1.3.0 spec `docs/specs/2026-10-21-mr-review-skill-design.md`(D1~D16 승계 — **D4·D14·D16 = ① 의 방어선**: Codex 전송 범위·마스킹 실패 시 단일 모델·워크트리 밖 읽기 감시) · 1.3.1 spec `docs/specs/2026-10-22-mr-review-1-3-1-fixes.md`(D17~D34) · 1.3.2 spec `docs/specs/2026-10-22-mr-review-1-3-2-fixes.md`(D35~D51 — D47 표시 자리 3곳) · 1.3.3 spec `docs/specs/2026-10-23-mr-review-1-3-3-fixes.md`(D52~D67) · **1.3.4 spec `docs/specs/2026-10-23-mr-review-1-3-4-fixes.md`**(D68~D89 승계 — D84 마스킹 입구·D88 평탄화 원칙은 ① 포인터 줄·④·⑤·⑥ 의 새 표시 줄에도 그대로 적용된다) · plan `docs/plans/2026-10-21-mr-review-skill.md`(SC-2 어댑터 계약 — ⑤·⑥ 선택 키 추가 · SC-3 `check.json`·`pack.json` — ⑤ 유형·① 포인터 표지 추가 · SC-5 `findings.json` — ①·④ 필드 추가 · SC-7 게이트 — A 로 T4 예외)
> 경로: **경량 — 단 4단계(spec 적대검증)는 유지, 5 plan·6 plan 적대검증 생략**(dev-cycle 1차 판정 + 사용자 지시로 메인이 추천안 입력 2026-10-23 22:2x, Q1 — 접촉 표면: 스키마·마이그레이션·권한·인증·외부 연동 신설 없음, 도구는 읽기 전용이라 데이터 손상·비가역 없음. 단 ① 은 Codex 전송 경계(D4·D14·D16)에 닿는 변경(전송 범위 **축소** — 워크트리 안 문서를 본문 대신 경로로)이라 1.3.3 D53·1.3.4 D69 와 같이 spec 적대검증(보안 yes)만 남긴다 — D91)

## 1. 배경 · 목표

1.3.4 설치본으로 **다른 프로젝트 저장소**(1.3.0~1.3.4 실사용 저장소와 다른, 그 저장소용 새 어댑터 v0)의 **큰 구현 MR 1건**(69파일 · +10.7k줄 · 2026-10-23 21:5x~22:0x)을 처음 리뷰했고, 같은 MR 을 「스킬 없는 독립 리뷰(모델 1개)」로 한 번 더 돌려 비교했다. 결과: 두 리뷰의 겹친 발견은 사실상 0건. 스킬은 정책 형식(계약·SHA 고정·판정 4종·게시 문안)·기계 확인(충돌·마스킹·정리)·문서 ↔ 문서 정합에 강했고, **스킬 없는 리뷰만 실질 코드 결함 1건을 잡았다** — 열린 화면에서 옛 값으로 저장하면 그 사이 자동 수신된 값을 덮어쓰고 잠기는 **lost update**(두 스킬 검토자 모두 놓침). 비교 결론 = 「지금 스킬만 믿으면 코드 결함을 놓친다」.

비교에서 고칠 점 8건이 나왔고 사용자가 이번 범위를 **①·④·⑤·⑥ + A(5건 전부)** 로 정했다(2026-10-23 22:1x). ②(렌즈 배분)·③(배포를 깨는 문서 오류의 차단 승격)은 **그 프로젝트 어댑터 몫**으로 어댑터 v1.1(공통 필수 렌즈 + 순서 분산 — 두 검토자가 영역을 나누지 않고 렌즈 전부를 보되 공통 필수 렌즈(상태·동시성 / 배포 절차 문서 대조 / 보안)를 먼저, 그 뒤 **Codex = 코드 렌즈부터 · Claude = 문서·설계 렌즈부터**, 코드 주 검토자 = Codex)로 이미 처리됐다(사용자 결정 22:2x). 그 결과 **① 이 1순위**다 — 코드 주 검토자가 된 Codex 가 지금처럼 프롬프트의 대부분을 문서 본문으로 받으면 어댑터 v1.1 의 배분이 효과를 못 낸다. 번호는 비교 기록(①·④·⑤·⑥)을 그대로 쓴다. 우선순위 = ① > ④ > ⑤ ≈ ⑥ > A.

예시는 전부 가상 값이다(프로젝트 `alpha` · MR `!66` · head `e5e5e5e` · 문서 `docs/specs/2026-10-06-auto-ingest-design.md`). 이 저장소는 공개 repo 다(D10) — 리뷰 대상 프로젝트·저장소 이름·호스트·사람 이름·계정은 spec·코드·테스트 어디에도 적지 않는다(SC-7 T6).

**목표**

- G1(①). Codex 프롬프트의 팩 B 에서 **대상 저장소 자신의 문서(워크트리 안 — Codex 가 직접 읽을 수 있는 파일)는 본문 대신 경로 포인터**로 가고, 워크트리 밖 자료(공통 정책 문서·위키·어댑터·기준선/이슈 원문·재리뷰)는 지금처럼 마스킹 본문으로 간다 — 전송 범위는 **줄어들기만** 한다(D4 축소 · D14·D16 불변). 리포트는 Codex 검토의 **실제 깊이**(명령 수 · 변경 파일 중 언급한 파일 수)를 표시하고, 하한 미달이면 「교차 검토: 있음(약함 — …)」으로 보인다. 판정 계산 불변.
- G2(④). 모델 발견이 기계 증거(계약 미완 줄 등)와 같은 사안이면 **기계 증거를 남기고 모델 발견을 그쪽에 병합**해 게시 블록에 같은 지시가 세 번 나오지 않는다. 「3. 통과해야 할 테스트」의 계약 미완 항목은 한 체크박스로 묶인다. 판정 불변(둘 다 증거 부족).
- G3(⑤). 어댑터가 **켰을 때만**(`baselineRepoPaths: true`) Baseline 값 안의 저장소 상대 경로가 `baselineCandidates` 글롭에 맞고 head 에 실재하면 「저장소 문서 경로」 유형으로 인정되고 그 원문이 기준선 원문으로 확보된다. 키가 없는 기존 어댑터의 출력은 **바이트 단위로 불변**(사용자 결정 22:1x).
- G4(⑥). 어댑터가 **켰을 때만**(`contract.backgroundSections: ["배경", "요약"]`) 「요약」 같은 다른 절 이름을 배경 절로 인정한다(기본 `["배경"]`). 보완 요청 문구는 실제 절 이름으로 나온다. 기존 어댑터 출력 **바이트 불변**.
- G5(A). review-loop 의 트리거 설명문(frontmatter `description`)에 「남의 MR 검토는 mr-review」 안내 1구가 들어가, 팀원 MR 브랜치에서 review-loop 을 돌리려는 오발동이 설명 단계에서 걸린다.

## 2. 범위 · 비목표

**범위**(impl 트랙이 고친다 — 이 세션은 spec 만, D98): `dev-workflow/skills/mr-review/scripts/lib/pack.mjs`(① 포인터 렌더 · `pack.json.sources[*].packB` 표지) · `scripts/lib/report.mjs`(① `codexStats()` 계산 함수 + 헤더·실행 블록 표시 · ④ `computeVerdict` 의 `coveredBy` 처리 + 「3. 통과해야 할 테스트」 묶기 + 부록 D 병합 표시 · ⑤ 검사표 「(이 MR 에서 수정됨)」 · ⑥ 보완 문구 절 이름) · `scripts/lib/check.mjs`(⑤ 경로 후보 추출·해소·`저장소 문서 경로` 유형 · ⑥ 배경 절 별칭) · `scripts/lib/adapter.mjs`(⑤·⑥ 선택 키 검증·기본값) · `scripts/mr-review.mjs`(① `codex-stats` 서브커맨드 1개) · `dev-workflow/skills/mr-review/SKILL.md`(§5 Codex 프롬프트 팩 B 문구·포인터 읽기 지시 · §5 Codex 종료 뒤 `codex-stats` · §6 병합 1b `coveredBy` · §8 터미널 요약 「교차 검토 약함」) · **`dev-workflow/skills/review-loop/SKILL.md` frontmatter `description` 1줄(A — 이 트랙의 유일한 review-loop 변경, T4 예외 D97)** · `tests/mr-review/{adapter,check,pack,report}.test.mjs`(A 의 문구 테스트는 SKILL.md 를 이미 읽는 기존 mr-review 테스트 파일에 — T1 목록 불변) · `dev-workflow/.claude-plugin/plugin.json`·`.claude-plugin/marketplace.json` 버전 1.3.5 · README 3종의 1.3.5 한 줄 · plan SC-2·SC-3·SC-5·SC-7 문장 정정(「1.3.5에서 변경」 표기 — 1.3.4 와 같은 방식). 어댑터 계약 SC-2 의 **기존 키·값·형식·의미는 불변**(⑤·⑥ 은 선택 키 추가, 기본값 = 현행).

**비목표(이 트랙에서 하지 않는다)** — 사용자 결정 2026-10-23 22:1x·22:2x(D90)

- **② 렌즈 배분(코드 깊이 담당 검토자 없음)** — 어댑터 v1.1 「공통 필수 렌즈 + 순서 분산 · 코드 주 검토자 = Codex」로 프로젝트 쪽에서 처리됐다(사용자 결정 22:2x). 엔진은 어댑터 렌즈 절을 원문 그대로 전달한다(SKILL §5 공통 입력 4 — 불변).
- **③ 배포를 깨는 문서 오류의 차단 승격** — 어댑터 L6·L8 「차단 승격」 조건 몫(어댑터 v1.1). 엔진의 `blocking` 규칙(SKILL §6-2)은 불변.
- **⑦ 제목 표현이 다른 같은 사안의 자동 병합**(지문 = `file` + 정규화 제목 — SKILL §6-1) — ④ 는 「모델 발견 ↔ 기계 증거」만 다룬다. 모델 ↔ 모델 지문 규칙은 불변(후속 기능 후보).
- **⑧ 출력 스키마 「확인한 범위(coverage)」 칸** — 검토자 자기 신고는 이번에 넣지 않는다. ① 의 깊이 표지는 **Codex 실행 로그에서 기계적으로 센 값**이고 검토자 신고가 아니다. Claude 검토자(Agent 도구)는 실행 로그가 없어 깊이를 세지 않는다(§6).
- **계약 줄 수 10개 고정**(`adapter.mjs:57`) · **어댑터 자동 선택**(`MR_REVIEW_ADAPTER` 전역 1개) — 후속 기능 후보.
- 1.3.4 이월(I-1 CPU 상한 · V1 Windows 경로 존재 검사 · 실행 간 재현율 편차) — 운영 한계 승계.
- ① 의 **팩 B 총량 상한**(출처 종류 구분 없는 바이트 상한) — 기각(Q2 — 정책 문서·기준선이 잘릴 수 있다). MR 본문·댓글은 워크트리 밖 자료라 지금처럼 본문으로 간다(상한 없음 — 큰 본문은 §6 한계).
- ① 의 **diff-only 모드 포인터** — cwd 가 `W/blobs/head`(변경 파일 blob 만)라 변경 밖 문서가 그 자리에 없다. diff-only 는 현행(본문) 유지(D92).
- ⑤ 의 **글롭 밖 경로·`#절` 접미·URL 아닌 다른 저장소 경로** — 켜도 「서술만」(또는 접미는 떼고 경로만 본다 — 3.⑤-2). `baselineCandidates` 밖 문서를 기준선으로 쓰려면 어댑터가 글롭을 넓힌다(어댑터 몫).
- ⑥ 의 **Baseline 값 「MR 본문 「요약」」 외 다른 문구 변형** — 별칭 이름과 `MR 본문` 두 가지만 본문 기준선 표지로 인정(3.⑥-2).
- A 의 **dev-cycle SKILL.md 안내 1줄** — 파이프라인 지도에 「남의 MR」 단계가 없어 안내 자리가 없다(Q6 기각). README 의 mr-review 절은 이미 「someone else's MR」 을 적고 있어 변경 불요.
- 1.3.0~1.3.4 설계 결정 D1~D89 의 재론. **변경은 명시**: D4(Codex 전송 범위) → **축소**(D92 — 범위 밖으로 넓히는 변경이 아니다) · SC-5 `findings.json`(1.3.0) → 필드 추가 D93·D94 · SC-3 `check.json.baselineType` 열거(1.3.0) → 값 추가 D95 · SC-7 T4(1.3.0 plan) → 이번 트랙만 예외 D97.

## 3. 결함별 명세

재현 근거의 사실은 첫 실사용 산출물(두 리포트·비교 파일 · 실행 기록)과 이 머신의 로컬 git(읽기 전용)에서 확인했고, 식별자는 전부 치환했다. 큰 구현 MR 의 수치(69파일 · +10.7k줄 · 팩 B 260,241바이트 · Codex 프롬프트 270,674바이트 · Codex 명령 16회 · 변경 파일 중 명령 로그에 등장한 파일 9개)는 그대로 쓴다(프로젝트 식별이 아니다).

### 3.① Codex 검토가 얕은데 리포트는 「교차 검토: 있음」 — 팩 B 본문(260KB)이 프롬프트를 채워 코드 읽기가 밀렸다

**현상**: `alpha !66`(69파일 · +10.7k줄) 리뷰에서 Codex 프롬프트 270,674바이트 중 **팩 B 본문이 260,241바이트**(출처 11개 = 대상 저장소 문서 `repo:` 6개(AGENTS.md·CLAUDE.md·runbook·설계 문서 — 각 최대 400줄, `MAX_DOC_LINES`) + 공통 정책 문서 절 4개 + 어댑터 산문 1개, 그리고 MR 본문·댓글). Codex 는 명령 16회 · 3분 20초 · 발견 1건(계약 누락 — 기계 검사 `M-contract` 가 이미 잡은 것). 변경 파일 69개 중 Codex 명령 로그에 경로가 등장한 파일은 9개(13% — companion 로그가 명령을 96자에서 자르므로 하한값). 두 모델 다 lost update 를 놓쳤는데 리포트 헤더(`report.mjs:346`)·실행 블록 「2. 검증 상태」(`report.mjs:217`)는 **「교차 검토: 있음」**(`findings.crossChecked` = 두 결과 모두 `review-validate` VALID)만 보여 리뷰어가 실제보다 강하게 읽는다.

**재현 근거**: 실행 기록의 `wc -c`(팩 A 260,710 · 팩 B 260,241 · `codex.prompt` 270,674) · `[codex] Running command:` 16줄(중복 제거) · 로컬 git `git diff --name-only <base> <head> | wc -l` = 69 · 그 69경로의 명령 로그 부분 문자열 일치 9건. 산출물 디렉터리(`pack.json` 포함)는 정리돼 출처별 바이트 분해는 남아 있지 않다 — 「`repo:` 6개 × 최대 400줄」은 코드 상한(`pack.mjs:14`)에서, 「MR 본문·댓글 포함」은 `pack.mjs:560`(`rawB` 조립)에서 읽은 사실이다.

**원인**: SKILL.md §5 「Codex 검토자」 2(`SKILL.md:148`) 「팩은 `W/pack-b.md` 본문을 그대로 붙인다(Codex는 cwd 밖을 읽어선 안 되므로 경로가 아니라 본문)」 — 이 이유는 **워크트리 밖 자료**(공통 문서 저장소·위키·어댑터·기준선 원문)에만 맞다. `repo:` 출처(`pack.mjs:520-524`)는 대상 저장소 head 의 blob 이고 Codex 의 cwd(`snapshot.worktree` = 그 head 의 체크아웃) 안에 같은 파일이 있다 — Codex 는 D4 대로 워크트리 전체를 이미 직접 읽을 수 있다(D16 「Codex 직접 읽기 한계」도 같은 전제). 그런데 팩 B 가 그 본문까지 실어 보내니 프롬프트가 문서로 채워지고(큰 저장소일수록 `repo:` 문서가 크다), 「교차 검토」 표시는 **유효 결과 2개**만 보고 깊이를 보지 않는다. 어댑터 v1.1 이 Codex 를 코드 주 검토자로 세웠으므로 이 둘을 고치지 않으면 배분이 효과를 못 낸다.

**보안 접촉면(설계 전제 — D4·D14·D16 과의 관계)**: 포인터는 **우리가 보내는 양을 줄이는** 변경이다. Codex 가 그 문서를 읽는 경로는 「우리가 보낸 본문」에서 「Codex 의 cwd 직접 읽기」로 바뀌는데, 후자는 D4 가 이미 허용한 범위(워크트리 전체)다. 마스킹(D14)은 팩 B 에 남는 모든 본문(워크트리 밖 자료·MR 본문·댓글·포인터 줄 자체)에 그대로 적용된다 — 포인터 줄에는 경로·head7·줄 수·절 제목 접두만 들어가고 문서 본문은 없다. 심볼릭 링크(120000)·서브모듈·부재는 `repoDocText`(`pack.mjs:469-487`, R5-1)가 이미 `missing:true` 로 거르므로 **포인터는 head 에 일반 blob(100644·100755)으로 실재하는 경로에만** 만든다(링크 대상을 가리키는 포인터를 만들지 않는다 — F4). 또 Codex 가 실제로 읽는 것은 커밋 트리가 아니라 **디스크의 체크아웃 파일**이므로 포인터 직전에 그 파일의 실물(일반 파일 · 실제 위치가 워크트리 안 · 바이트 = head blob)을 확인하고, 어긋나면 본문으로 보낸다(R1-2 — D109). 경로 감시(D16 ⓑ)는 불변 — 포인터 경로는 워크트리 안 상대 경로라 감시 대상이 아니다.

**수정 방향(사용자 지시로 메인이 추천안 입력 2026-10-23 22:2x, Q2 — D92·D93) — (가) 포인터 + (나) 깊이 표지**

1. **(가) 팩 B 포인터(`pack.mjs`)**: 출처가 **대상 저장소 head blob 에서 읽은 것**이고 `snapshot.mode === 'worktree'` 이며 `missing === false` 이고 **워크트리 실물 확인 3가지를 통과하면**(review-loop(spec) R1-2 — D109: ⓐ `fs.lstatSync(<worktree>/<경로>)` 가 일반 파일(심볼릭 링크 아님) ⓑ `fs.realpathSync` 결과가 `realpath(<worktree>)` 안(부모 디렉터리가 링크여도 걸린다) ⓒ 그 파일의 바이트가 `git show <head>:<경로>` blob 바이트와 동일(줄바꿈 변환·체크아웃 훅·작업 폴더 수정으로 달라지면 불일치) — 하나라도 어긋나거나 확인 중 오류면 **현행 마스킹 본문**(`packB:'body'` — 안전한 쪽)), 팩 B 의 그 출처 본문 자리에 아래 **한 블록**만 넣는다(팩 A 는 바이트 불변 — Claude 는 지금처럼 전부 받는다):
   ```
   ### [S7] doc · repo:docs/runbooks/ingest-operations.md@e5e5e5e
   (워크트리 문서 — 본문은 현재 작업 디렉터리에서 직접 읽어라: `docs/runbooks/ingest-operations.md` · 212줄)
   ```
   절 참조(`repo:<경로>#<절제목접두>`)면 ` · 절 「5.」 이하` 를 덧붙인다(절이 없으면 현행 `(절 없음: …)` 그대로 — `missing:true`). 대상 = `doc` 출처 중 `repo:` 참조(`pack.mjs:520`) **+ ⑤ 로 생기는 `baseline` 출처 중 `kind: repo-path`**(같은 head blob — 3.⑤-4 · harden H-16). 그 밖(공통 문서 `docsRoot` · 위키 · 어댑터 · `repo` URL 기준선(ref 가 head 와 다를 수 있다) · 이슈 · 본문 기준선 · 재리뷰)은 현행 마스킹 본문. **diff-only 모드는 전부 현행(본문)** — cwd `W/blobs/head` 에 변경 밖 문서가 없다. **포인터의 「n줄」 = head blob 파일 전체 줄 수**(`repoDocText` 가 자르기 전 본문에서 센다 — Codex 가 실제 읽을 양 · harden H-4). `pack.json.sources[*].lines` 는 현행대로 팩 A 발췌 줄 수(상한 400)라 두 값이 다를 수 있다.
2. **`pack.json.sources[*].packB`**(SC-3 추가 — 1.3.5에서 변경): `"body" | "pointer" | "none"`(`none` = `inPackB:false`). 기존 필드(`inPackB`·`exportAllowed`·`lines`)는 불변. 출처 목록 헤더 줄(`pack.mjs:556`)에서 포인터 출처는 ` · (경로만 — 작업 디렉터리에서 직접 읽음)` 을 붙인다(팩 B 헤더만 — 팩 A 헤더 불변 · 모델 이름을 적지 않는다, D11).
3. **마스킹·잔존 검사 불변**: 포인터가 들어간 `rawB` 전체가 지금처럼 `maskTextWithCounts` → 잔존이면 팩 B 없음(D14). 포인터 줄의 경로가 어댑터 마스킹 패턴에 걸리면 가려진 채 간다(그 문서는 Codex 가 못 찾는다 — 보이는 실패, §6).
4. **SKILL.md §5 Codex 프롬프트**: 2 의 문구를 「팩은 `W/pack-b.md` 본문을 그대로 붙인다(**워크트리 밖 자료**는 Codex 가 읽을 수 없으므로 본문 · **워크트리 안 문서는 팩 B 에 경로 포인터만 들어 있다** — 1.3.5 ①)」로 고치고, 고정 첫머리(D16 ⓐ) 뒤에 1문장 추가: 「팩 B 의 (워크트리 문서) 포인터는 현재 작업 디렉터리에서 그 경로를 읽어라.」 — **읽기 범위를 팩 B 목록으로 좁히는 문구는 넣지 않는다**(review-loop(spec) R1-1: 팩 B 에는 문서만 있고 코드 경로 목록이 없어 「팩 B 에 없는 경로는 읽지 마라」는 변경 파일 전문·호출부 탐색(§5 공통 입력 3 · D4 워크트리 전체)까지 막는다 — ① 의 목적과 반대). 금지 문구(cwd 밖 읽기 금지 — 고정 첫머리)는 불변.
5. **(나) 깊이 표지 — `codexStats()`(`report.mjs` export, 순수 함수) + CLI `codex-stats`**: 입력 = `W/codex.out` 전문 + `mr.json.diffs`. 출력 `{ commands, changedFiles, filesMentioned, weak }`:
   - `commands` = `[codex] Running command:` 로 시작하는 줄 수(현행 §5 「잘린 명령」 집계와 같은 줄 집합).
   - `changedFiles` = `mr.json.diffs[*]` 의 `new_path`·`old_path` 를 모은 **경로 집합 크기**(중복 제거 · 빈 값 제외).
   - `filesMentioned` = 그 집합 중 `codex.out` **전문**(명령 로그 + 최종 JSON — JSON 의 `file`·`location` 은 96자 절단을 받지 않는다)에 **경로 문자열 그대로** 부분 문자열로 등장하는 경로 수. basename 일치는 세지 않는다(흔한 이름 과대 집계). 96자 절단으로 못 세는 경로는 과소 집계 → 「약함」 쪽으로 기울어진다(보수적, §6).
   - `weak` = `filesMentioned < Math.ceil(changedFiles / 4)`(변경 파일의 1/4 미만 언급 — 이번 실측 9 < 18 → 약함). `changedFiles === 0` 이면 `weak:false`.
   - CLI: `<CLI> codex-stats --work "$W"` → 첫 줄 `CODEX_STATS commands=<n> changed=<n> mentioned=<n> weak=<true|false>` + `W/codex-stats.json`(허용 9종 밖 → cleanup 이 `extra` 로 지운다 — 값은 아래 6 으로 영속). `codex.out` 이 없으면 `ERR`(Codex 를 띄우지 않은 실행에서는 호출하지 않는다).
6. **`findings.json.reviewerStats`**(SC-5 추가 — 1.3.5에서 변경, 선택 필드): `{ "codex": { "commands": 16, "changedFiles": 69, "filesMentioned": 9, "weak": true } }`. SKILL.md §5 「유효 판정」 뒤에 「`codex-stats` 를 돌려 결과를 `findings.json.reviewerStats.codex` 에 적는다 — **Codex 결과가 유효든 무효(INVALID·단일 모델 모드)든 `codex.out` 이 있으면 항상**(harden H-9)」 1단계. 필드가 없으면(이전 실행·테스트 픽스처) 아래 7 의 표시는 **현행 문구 바이트 그대로**.
7. **표시(D47 자리 3곳 + 부록 D — 판정 계산 불변)**:
   - 헤더(`report.mjs:346`): `교차 검토: 있음` → `reviewerStats.codex` 가 있으면 `교차 검토: 있음(변경 파일 69 중 9 언급 · 명령 16회)`, `weak` 면 `교차 검토: 있음(약함 — 변경 파일 69 중 9 언급 · 명령 16회)`. `crossChecked:false` 는 현행 `없음` 그대로(통계가 있어도 붙이지 않는다 — 단일 모델 모드는 「없음」이 정보, harden H-8).
   - 실행 블록 「2. 검증 상태」 `[판독]` 줄(`report.mjs:217`): `(돈 모델: claude, codex)` 뒤에 `weak` 일 때만 ` · 교차 검토 약함` 을 붙인다(게시 블록은 짧게 — 수치는 헤더·부록).
   - §8 터미널 요약 「돈 모델/교차 검토」 항목: 같은 괄호 문구.
   - 부록 D 머리에 `- Codex 검토 통계: 명령 16회 · 변경 파일 69 중 9 언급(약함)` 1줄(통계 있을 때만 — 교차 검토 유무와 무관 · 단일 모델 모드에서 통계가 보이는 유일한 자리, harden H-13).
8. **`verdict`·`crossChecked` 불변**: `weak` 는 판정 입력이 아니다(`computeVerdict` 가 읽지 않는다). `crossChecked` 의 의미(유효 결과 2개)도 그대로 — 「약함」은 그 위에 얹는 표지다.

**AC(테스트로 검증)**

- AC①-1 `pack`: 워크트리 모드 · `docsMap.always: ["repo:AGENTS.md"]` · head 에 AGENTS.md(400줄 넘는 본문) → `pack-b.md` 에 그 본문의 고유 문장이 **없고** 포인터 블록(`repo:AGENTS.md@<head7>` · `` `AGENTS.md` `` · `n줄`)이 있다 · `pack-a.md` 는 이 변경 전후 **바이트 동일** · `pack.json.sources[0].packB === 'pointer'` · `inPackB === true` · `lines` = 본문 줄 수.
- AC①-2 `pack`: 같은 설정에서 `snapshot.mode === 'diff-only'` → `pack-b.md` 에 본문 그대로 · `packB === 'body'`.
- AC①-3 `pack`: `repo:` 참조가 심볼릭 링크(120000)·부재 → 현행 문구(`(대상 저장소 문서 … : …)`) 그대로 · `missing:true` · `packB === 'body'`(포인터 아님).
- AC①-4 `pack`: 절 참조 `repo:docs/x.md#5.` → 포인터에 ` · 절 「5.」 이하`; 절 없음 → 현행 `(절 없음: …)`·`missing:true`.
- AC①-5 `pack`: 공통 문서(`docsRoot`)·위키·어댑터 출처는 `packB === 'body'` 이고 팩 B 본문 바이트 불변(기존 pack 테스트 전부 통과 — 포인터 대상이 없는 픽스처는 출력 불변).
- AC①-6 `pack`: 포인터 줄을 포함한 `rawB` 에 어댑터 마스킹이 적용된다 — 경로에 마스킹 패턴이 걸리는 픽스처에서 포인터의 경로가 가려지고 `mask.applied` 가 센다 · 잔존 픽스처에서는 지금처럼 `codexSkipped:true`·팩 B 없음.
- AC①-7 `codexStats`: 픽스처 `codex.out`(명령 16줄 중 2줄은 `...` 절단 · 최종 JSON 의 `file` 에 변경 경로 1개) + `diffs` 69경로(rename 1건 포함 — `old_path`·`new_path` 둘 다 집합에) → `{ commands:16, changedFiles:70, filesMentioned:<명령 로그 8 + JSON 1 = 9>, weak:true }` · 같은 로그에 변경 경로 30개를 더 언급한 픽스처 → `weak:false` · `diffs:[]` → `changedFiles:0 · weak:false` · basename 만 같은 다른 경로는 세지 않는다.
- AC①-8 CLI: `codex-stats --work W` 첫 줄 `CODEX_STATS commands=… changed=… mentioned=… weak=…` · `codex.out` 없음 → `ERR`.
- AC①-9 `render`: `findings.reviewerStats.codex = { …, weak:true }` → 헤더 `교차 검토: 있음(약함 — 변경 파일 69 중 9 언급 · 명령 16회)` · 실행 블록 `[판독]` 줄에 ` · 교차 검토 약함` · 부록 D 통계 1줄; `weak:false` → 헤더 `있음(변경 파일 69 중 30 언급 · 명령 40회)` · 실행 블록 변화 없음; `reviewerStats` 없음 → 현행 리포트와 **바이트 동일**(기존 report 테스트 전부 통과) · `crossChecked:false` + 통계 있음 → `없음` 그대로.
- AC①-10 `verdict`: `reviewerStats` 유무·`weak` 값이 `verdict.json`(status·verdict·evidence·defects)을 바꾸지 않는다.
- AC①-11 SKILL.md 문구: §5 에 「워크트리 안 문서는 팩 B 에 경로 포인터만」·「포인터는 현재 작업 디렉터리에서 그 경로를 읽어라」·`codex-stats`·`reviewerStats` 가 있고 「경로가 아니라 본문」·「팩 B 에 없는 경로」 문구가 없으며 고정 첫머리의 「현재 작업 디렉터리(워크트리) 밖의 파일을 읽지 마라」는 그대로 있다(R1-1)(기존 SKILL.md 문구 테스트 파일에 추가).
- AC①-12 `cleanup`: `W/codex-stats.json` 은 허용 9종 밖이라 `extra` 로 지워지고 `findings.json` 의 `reviewerStats` 는 마스킹 사본에 남는다(숫자라 마스킹 영향 없음).
- AC①-13 `render`(단일 모델 — H-8·H-9·H-13): `validReviewers:['claude']`·`crossChecked:false` + `reviewerStats.codex` 있음 → 헤더 `교차 검토: 없음`(현행 바이트) · 실행 블록 `[판독]` 줄 현행(`· 교차 검토 없음`) · 부록 D 에 `- Codex 검토 통계: …` 1줄 있음.
- AC①-15 `pack`(R1-2 — D109): head 에 일반 blob 인 `repo:AGENTS.md` 인데 ⓐ 워크트리의 그 파일을 심볼릭 링크로 바꿈 ⓑ 부모 디렉터리(`docs/`)를 워크트리 밖 디렉터리 링크로 바꿈(`repo:docs/x.md`) ⓒ 워크트리 파일 내용을 blob 과 다르게 고침(미커밋) → 세 경우 모두 포인터 **없음** · 팩 B 에 현행 마스킹 본문(blob 에서 읽은 것) · `packB === 'body'` · 링크 대상 파일의 고유 문장은 팩 A·B 어디에도 없다.
- AC①-14 `pack`(H-4): head blob 450줄 문서 → 팩 A 발췌 400줄 + `(… 상한으로 생략)` · 팩 B 포인터 `450줄` · `pack.json.sources[*].lines` = 팩 A 발췌 줄 수(현행).

### 3.④ 계약 누락이 게시 블록에 세 번 반복 — 모델 발견 F1 + 기계 증거 M-contract 4건 + 체크박스 5개

**현상**: `alpha !66` 리포트 실행 블록: 「3. 통과해야 할 테스트」 = `[ ] Review Contract 10줄 중 4줄이 비어 있음(…)` + `[ ] Review Contract 「Policy source」 미완(없음)` × 4 = 체크박스 5개 · 「4. 차단 발견」 = `F1 MISSING_EVIDENCE — Review Contract 10줄 중 4줄이 비어 있음(…) · <권고>` + `M-contract-Policy_source MISSING_EVIDENCE — …` × 4. 같은 사안이 세 자리에 아홉 줄. 작성자 보완 요청 문안에도 4줄(이건 정당 — 줄마다 고칠 것).

**재현 근거**: 리포트 원문(위 줄들) · `report.mjs:221`(`evidenceItems` = `verdict.evidence` 의 발견 제목 또는 기계 증거 detail 을 **항목마다** 체크박스로) · `report.mjs:114-117`(`machineEvidence` — 계약 미완 줄마다 `M-contract-<name>`) · SKILL §6-1 지문 규칙은 모델 ↔ 모델만 다룬다(기계 증거와의 병합 규칙 없음).

**원인**: 기계 증거(`check.json.contract.incompleteLines`)와 모델 발견은 같은 사실을 보지만 **합치는 자리가 없다** — `computeVerdict`(`report.mjs:142`)는 `findings` 와 `machineEvidence` 를 각각 `evidence` 에 넣고, `executionBlock` 은 `evidence` 를 항목마다 체크박스로 편다. Claude 검토자는 `check.json` 을 받으므로(SKILL §5 「Claude 프롬프트는 원문 그대로(팩 A + `check.json`)」) 계약 미완을 발견으로 다시 내기 쉽다.

**수정 방향(사용자 지시로 메인이 추천안 입력 2026-10-23 22:2x, Q3 — D94) — 기계 증거를 남기고 모델 발견을 병합 + 체크박스 묶기**

1. **SC-5 `findings.json.findings[*].coveredBy`**(선택 — 1.3.5에서 변경): `["M-contract-Policy_source", …]` — 메인이 §6 병합에서 적는다. **SKILL.md §6 에 1b 단계 추가**: 「모델 발견이 `type: MISSING_EVIDENCE` 이고 그 사안이 기계 증거 항목(**모든 종류** — 계약 미완 줄 `M-contract-*` · 배포본 불일치 `M-deploy` · 원문 미확보 `M-baseline-*` · `M-diff-*` · `M-api-*` · `M-rereview`, harden H-12)과 같으면 — 제목·근거가 그 계약 줄 이름·배포본 결과·링크를 가리키면 — `coveredBy` 에 그 id 들을 적는다. 모델 발견은 지우지 않는다(부록 C·D 에 남는다). DEFECT·DESIGN_DRIFT·FOLLOW_UP 에는 적지 않는다.」 id 는 `verdict` 가 만드는 `machineEvidence` 의 id 문법(`M-contract-<공백→_>` 등 — `report.mjs:116`)을 그대로 쓴다.
2. **`computeVerdict`**: 발견에 `coveredBy` 가 비어 있지 않고 **`type === 'MISSING_EVIDENCE'`** 이며 **모든 id 가 이번 실행의 `machineEvidence` id 집합에 있으면** 그 발견은 `merged:true` — `evidence`·`defects` 에 넣지 않는다. **단 리뷰어 확인 전 미해결 후보(`unresolved:true` 이고 `resolves` 로 아직 정해지지 않음 — `report.mjs:177`)는 병합을 미룬다**(review-loop(spec) R2-1 — D111): 지금처럼 `unresolved`·`branches` 에 넣어 `status:'undetermined'`·게시 블록 미생성(§5.5-2 사람 확인 게이트 불변)이고, `--resolve <id>=confirmed` 뒤의 재계산에서 병합한다 · `dismissed` 면 현행대로 활성 발견이 아니어서 `evidence` 에도 `merged` 에도 없다. `branches` 계산(확인/기각 갈래 판정)은 현행 그대로. 하나라도 어긋나면(`type` 이 다름 · id 가 없음) `coveredBy` 를 **무시**하고 현행대로 넣으며 `reasons` 에 `coveredBy 무시: F1 → M-x 없음(또는 type DEFECT)` 1줄(fail-closed — 병합으로 판정이 약해지는 길을 막는다: DEFECT 가 병합되면 CHANGES_REQUESTED → HOLD_EVIDENCE 로 내려갈 수 있다). `verdict.json.merged: ["F1"]`(SC-3 추가) 로 영속.
3. **`executionBlock` 「3. 통과해야 할 테스트」**: `evidence` 항목 중 `M-contract-*` 가 **2건 이상이면 한 체크박스**로 묶는다 — `[ ] Review Contract n줄 미완(Policy source · Review type · …)`; 그 줄들을 `coveredBy` 로 덮은 `merged` 발견이 있으면 첫 번째 것의 `recommendation` 을 ` — 권고: <recommendation>` 으로 덧붙인다(모델이 준 「어떻게 채우나」가 살아남는 **유일한** 자리 — 「4.」 M- 줄마다 반복하지 않는다, harden H-2). **`M-contract-*` 가 1건이면 현행 문구 그대로**(`[ ] Review Contract 「Baseline」 미완(자리표시자)` — 기존 어댑터의 가장 흔한 게시 블록 바이트 불변, harden H-3) **+ 병합 발견이 있으면 그 줄 끝에도 ` — 권고: …`**. 그 밖 `evidence`(모델 발견·`M-deploy`·`M-baseline-*` 등)는 현행 항목별 체크박스.
4. **「4. 차단 발견」**: `merged` 발견은 싣지 않는다. `M-contract-*` 줄은 현행 그대로(줄마다 · 권고 없음 — 재리뷰 파서 `priorBlockingList` 의 id 단위 대조 불변). 축약 ①~④ 규칙 불변.
5. **부록 D**: `merged` 발견 줄의 ` (차단)` 자리에 ` (차단 — 기계 증거 M-contract-Policy_source, … 에 병합)` 표지, 다른 칸 현행 — 이 꼴은 재리뷰 파서 `APPENDIX_D_RE`(`check.mjs:242` — `(차단)` 뒤에 바로 ` — ` 를 요구)에 **일치하지 않아** `parseAppendixD` 가 그 줄을 이전 차단 발견으로 복원하지 않는다(의도 — 병합 발견은 「4.」에 없으므로 복원 대상이 아니다; 기계 증거 `M-*` 줄은 현행 꼴 그대로 복원된다). 부록 C(모델별 원본) 불변.
6. **보완 요청 문안**(`report.mjs:253`)은 줄마다(현행 — 작성자가 고칠 줄이 다르다).
7. 재리뷰(SKILL §7): 이전 「4. 차단 발견」에 `merged` 발견이 없으므로 대조표는 `M-contract-*` 로 센다 — 현행 파서 불변.

**AC**

- AC④-1 `computeVerdict`: `findings = [F1 MISSING_EVIDENCE coveredBy:[M-contract-Base_SHA, M-contract-Human_reviewer]]` + `check.contract.incompleteLines = ['Base SHA','Human reviewer']` → `verdict.evidence` 에 `F1` 없음 · `M-contract-Base_SHA`·`M-contract-Human_reviewer` 있음 · `verdict.merged = ['F1']` · `verdict.verdict === 'HOLD_EVIDENCE'`(`coveredBy` 없을 때와 같은 판정).
- AC④-2 `computeVerdict` fail-closed: `coveredBy:['M-contract-Nope']`(없는 id) → `F1` 은 `evidence` 에 현행대로 · `merged = []` · `reasons` 에 `coveredBy 무시` 1줄; `type: DEFECT` + `coveredBy:[M-contract-Base_SHA]` → 무시 · `defects` 에 `F1` · 판정 `CHANGES_REQUESTED`(병합으로 내려가지 않는다).
- AC④-3 `render` 실행 블록: `incompleteLines = ['Base SHA','Human reviewer']` + 위 F1 → 「3. 통과해야 할 테스트」 `- 머지 전: [ ] Review Contract 2줄 미완(Base SHA · Human reviewer) — 권고: <F1.recommendation>` **한 항목** · 「4. 차단 발견」에 `F1` 줄 없음 · `M-contract-Base_SHA`·`M-contract-Human_reviewer` 줄 있음 · 부록 D 의 `F1` 줄에 `에 병합` 표지.
- AC④-4 `render`: `coveredBy` 없는 현행 픽스처(`incompleteLines` 2건 · 모델 발견 없음) → 「3.」 은 `[ ] Review Contract 2줄 미완(Base SHA · Human reviewer)` 한 항목(권고 없음) · 「4.」 현행. **이 형식 변경으로 바뀌는 기존 단언(`report.test.mjs` 의 2건 이상 체크박스 문구 단언)은 새 형식으로 갱신하되 의도(항목 존재·id 문법)는 보존한다** — 1.3.4 D81 과 달리 형식 자체가 바뀌므로 단언 갱신이 정당(D94).
- AC④-5 `render`: `M-deploy`·`M-baseline-1`·모델 MISSING_EVIDENCE(`coveredBy` 없음)는 현행대로 항목별 체크박스(묶음은 `M-contract-*` 만).
- AC④-6 재리뷰 파서: `merged` 발견이 없는 「4. 차단 발견」 + 부록 D(병합 표지 줄 포함)에서 `priorBlockingList` 가 `M-contract-*` 만 이전 차단 발견으로 세고 `F1` 을 중복으로 세지 않는다 · `parseAppendixD` 가 병합 표지 줄(` (차단 — … 에 병합) — `)을 항목으로 읽지 않는다.
- AC④-9 `computeVerdict`(R2-1 — D111): `F1 MISSING_EVIDENCE unresolved:true coveredBy:[M-contract-Base_SHA]` + 그 기계 증거 실재 · `resolves` 없음 → `status === 'undetermined'` · `verdict === null` · `unresolved` 에 `F1` · `branches.F1` 현행 값 · `merged = []`(게시 블록 미생성 — 병합으로 확인 게이트를 건너뛰지 않는다); 같은 입력 + `resolves = { F1: 'confirmed' }` → `status === 'determined'` · `merged = ['F1']` · `evidence` 에 `F1` 없음 · `M-contract-Base_SHA` 있음; `resolves = { F1: 'dismissed' }` → `merged = []` · `evidence` 에 `F1` 없음.
- AC④-8 `render`(H-3): `incompleteLines = ['Baseline']` 1건 · 모델 발견 없음 → 「3.」 `[ ] Review Contract 「Baseline」 미완(자리표시자)` **현행 바이트** · 같은 1건 + `coveredBy:['M-contract-Baseline']` 인 F1 → `[ ] Review Contract 「Baseline」 미완(자리표시자) — 권고: <F1.recommendation>` · 「4.」 에 `M-contract-Baseline` 줄은 권고 없이 현행.
- AC④-7 SKILL.md 문구: §6 에 `coveredBy` 단계(1b)와 「DEFECT·DESIGN_DRIFT·FOLLOW_UP 에는 적지 않는다」가 있다.

### 3.⑤ Baseline 에 저장소 spec 경로를 적어도 「서술만」 — 어댑터가 켤 때만 「저장소 문서 경로」로 인정

**현상**: `alpha !66` 의 Baseline 값 = `spec docs/specs/2026-10-06-auto-ingest-design.md(§3·§6)`(링크 아님) → 검사표 「Baseline 유형 | 서술만」. 같은 실행의 `check.json.baselineCandidateFiles` 에는 바로 그 spec 이 잡혀 있었다(diff 안 문서). 그 저장소 관례는 「경로 기재」라 켜지 않으면 매번 「서술만」이 찍히고, 기준선 원문이 팩에 들어가지 않아 두 검토자가 기준선 없이 본다(`baselineLinks` 가 비어 pack 2 단계가 아무것도 넣지 않는다).

**재현 근거**: 리포트 부록 A 「Baseline 유형 | 서술만」 · 「변경 파일 속 문서(후보) | docs/specs/…」 · `check.mjs:109-121`(`parseBaselineValue` — `BLOB_RE`·`ISSUE_*_RE`·`/배경|MR 본문/` 만 보고 그 밖은 `서술만`).

**원인**: 1.3.0 설계가 Baseline = permalink(blob 링크)·이슈·「MR 본문 배경」 세 꼴만 상정했다(그 저장소의 정책이 permalink 고정이었다). 저장소 상대 경로는 꼴 자체가 없다. **기존 실사용 어댑터의 정책은 지금도 permalink 고정**이므로(사용자 결정 22:1x) 엔진이 모든 어댑터에 경로를 인정하면 그 정책을 어기는 MR 이 「문서」로 통과한다 → **어댑터 키로만 켠다, 기본값 = 현행(바이트 불변)**(D99).

**수정 방향(사용자 지시로 메인이 추천안 입력 2026-10-23 22:2x, Q4·Q5 — D95·D99)**

1. **SC-2 선택 키 `baselineRepoPaths: true | false`**(최상위 — `baselineCandidates` 옆 · 기본 `false` · 불리언 아니면 `AdapterError` 메시지에 `baselineRepoPaths(true|false)`). `adapter.baselineRepoPaths` 는 `loadAdapter` 가 `?? false` 로 채운다(`deployLayout` 선례 `adapter.mjs:54`·`:93`).
2. **경로 후보 추출(`check.mjs` `parseBaselineValue` 확장 — 켠 어댑터만)**: Baseline 값(코드 스팬 제거 뒤)에서 **허용 구분자로만 나눈 토큰을 통째로 검증한다**(review-loop(spec) R1-3 → C1 감사 이의 → R3-1 → C2 회귀·감사 이의 재판정으로 정정 — D112): ⓐ 토큰 = 값을 **허용 구분자** `/[\s,;()「」'"·]+/` 로 나눈 조각(허용 구분자 = 공백류·`,`·`;`·`(`·`)`·`「`·`」`·`'`·`"`·`·` — 이 목록 밖 글자는 토큰 안에 남는다) ⓑ 각 토큰에서 첫 `#` 부터 끝까지(절 접미 `#3`)를 떼고, 끝의 `.` 들(문장 끝 마침표·`…`)을 뗀다 ⓒ 남은 토큰 **전체**가 `^(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9]+$`(구분자 `/` 1개 이상 · 확장자 있음)이고 `.`/`..` 조각이 없을 때만 **저장소 상대 경로 꼴**(어댑터 문서 참조 검증 `adapter.mjs:63-69` 와 같은 정규 상대 경로 규칙). 허용 구분자 밖 글자(역슬래시·`:`·`~`·`$`·`%`·`@`·`=`·`?`·한글 등)가 토큰에 붙어 있으면 그 토큰은 **통째로 탈락**한다 — 토큰의 앞·뒷부분만 떼어 경로로 삼는 길은 없다(허용 목록 방식 — 금지 목록은 이 계열에서 4회 샜다): `C:\docs/specs/a.md`·`..\docs/specs/a.md`·`C:docs/specs/a.md`·`~/docs/specs/a.md`·`$HOME/docs/specs/a.md`·`/abs/docs/specs/a.md`·`docs/../specs/a.md`·`docs/specs/a.md-disabled`·`docs/specs/a.md.extra-disabled` 는 후보가 아니고, `docs/specs/a.md,docs/specs/b.md`·`「docs/specs/a.md」·docs/specs/b.md` 는 두 경로 모두 후보, `docs/specs/a.md(§3·§6)`·`docs/specs/a.md#3`·`docs/specs/a.md.` 는 `docs/specs/a.md`. 한글 조사가 바로 붙은 `docs/specs/a.md에서` 는 후보가 아니다(§6 한계 — 「서술만」, 현행과 같다). URL(`https://`)은 `BLOB_RE` 가 먼저 가져가므로 후보가 아니다. 공백·괄호가 든 경로(코드 스팬 안 값 그대로 인정)는 **범위 밖**(harden H-18 — §6). 후보 중 **`matchesAny(path, adapter.baselineCandidates)`** 인 것만 **경로 후보**로 삼는다(글롭 밖 경로는 무시 — 「서술만」 유지).
3. **유형 우선순위**(harden H-7): `문서 링크`(blob URL) > **`저장소 문서 경로`**(새 값 — SC-3 `baselineType` 열거 추가, 1.3.5에서 변경 · **확보된 경로 후보가 1개 이상**일 때) > `이슈` > `MR 본문 배경` > `빈칸·자리표시자` > `서술만`. 켜지 않은 어댑터는 경로 후보가 안 생기므로 현행 순서 그대로.
4. **해소(`resolveRepoPath` — `check()` 안, 경로 후보마다 · harden H-1 로 정정 · review-loop(spec) R1-4·R1-5 로 정정)**: 고정 head 의 **일반 blob 전문**을 읽는다 — `repoDocText`(`pack.mjs:469`)를 그대로 부르지 않는다(그 함수는 끝에 `sliceDoc` 로 400줄 발췌를 돌려주고, diff-only 분기는 모드를 확인하지 않는다). 모드 규칙은 같다: **워크트리 모드** = `git -C <worktree> ls-tree <head> -- <path>` 의 모드가 100644·100755 일 때만 `git show <head>:<path>` · **diff-only** = `apiJson('projects/<id>/repository/tree?path=<부모 디렉터리>&ref=<head>&per_page=100', { paginate: true })` 에서 이름이 같은 항목의 `mode` 가 100644·100755 일 때만 `repository/files/<path>/raw?ref=<head>`(항목 없음·120000·160000·조회 실패 = 미확인 — raw 응답만으로 확보하지 않는다: raw API 는 심볼릭 링크면 링크 대상 문자열을 돌려준다). 저장하는 원문은 **자르지 않은 전문**(URL 기준선 `check.mjs:172-175` 와 같은 규칙 — 기준선의 뒤쪽 수용기준이 사라지지 않게). **있으면** 링크 `{ raw: path, kind: 'repo-path', project: mr.project.name, ref: <head>, path, pinned: true, resolved_sha: <head>, status: '확보', file: 'baseline/<n>.md', version: <head>, inDiff }` 를 `baselineLinks` 에 넣고 `baseline/<n>.md` 에 `<!-- mr-review source: <project>:<path>@<head> ref=<head> pinned=true -->` 머리로 쓴다. **head 에 없음·심볼릭 링크·서브모듈이면 기준선 링크로 기록하지 않고**(`M-baseline` 이 생기지 않는다 — 판정 입력 불변) `check.json.baselineRepoPathMisses: ["<경로>"]`(SC-3 추가) 에 적는다 — 유형은 다른 후보가 없으면 현행 「서술만」(Q4 답변 문구 「부재는 서술만」 유지) · 작성자에게는 보완 문안으로 알린다(6). `inDiff` = `mr.diffs` 에 `new_path === path`(`deleted_file` 아님)가 있으면 `true`(SC-3 `baselineLinks[*].inDiff` 추가 — `repo-path` 만).
5. **pack**: `kind 'repo-path'` 는 `project === mr.project.name` 이라 `exportable` → `baseline` 출처로 두 팩에(현행 규칙 `pack.mjs:535-538`). 워크트리 모드에서는 **① 포인터 대상**(같은 head blob, harden H-16) — 팩 A 는 본문.
6. **표시**: 부록 A 검사표 「Baseline 유형」 칸 = 유형 + 접미 — `repo-path` 링크 중 `inDiff:true` 가 있으면 `(이 MR 에서 수정됨)`, `baselineRepoPathMisses` 가 비어 있지 않으면 `(경로 미확인 n건)`, 둘 다면 `(이 MR 에서 수정됨 · 경로 미확인 n건)` — 예 `저장소 문서 경로(이 MR 에서 수정됨)` · `서술만(경로 미확인 1건)`. **보완 요청 문안**(`report.mjs:251`)에 미확인 경로마다 「Baseline 에 적은 경로 「<경로>」 가 head 에 일반 파일로 없습니다(오타·삭제·심볼릭 링크) — 경로를 확인해 주세요.」 1줄(D88 — 경로는 `line()`). 리뷰어는 「기준선 문서를 같은 MR 에서 고쳤다」를 본다(판정 입력 아님 — 관련성 판단은 현행 `baselineCandidateRelevant` 경로·리뷰어 몫). 다른 자리(헤더·실행 블록) 불변. `report.mjs:161`·`:254`(빈칸·칸 없음만 본다) 불변 → `baselineMissing`·조기 종료·`RETURN_TO_DESIGN` 계산 불변.

**AC**

- AC⑤-1 `adapter`: 키 없음 → `adapter.baselineRepoPaths === false` · `true`/`false` 보존 · `"yes"` → `AdapterError` 메시지에 `baselineRepoPaths`.
- AC⑤-2 `check`(키 없음 — 현행): Baseline `spec docs/specs/2026-10-06-auto-ingest-design.md(§3)` → `baselineType === '서술만'` · `baselineLinks` 에 `repo-path` 없음 · `check.json` 전체가 이 변경 전과 **깊은 동치**(기존 check 테스트 전부 통과).
- AC⑤-3 `check`(켬 · 워크트리 모드): 같은 값 + `baselineCandidates: ['docs/specs/**']` + head 에 그 파일(일반 blob) → `baselineType === '저장소 문서 경로'` · 링크 `{ kind:'repo-path', path:'docs/specs/2026-10-06-auto-ingest-design.md', status:'확보', resolved_sha:<head>, pinned:true, version:<head>, file:'baseline/1.md', inDiff:<diff 에 있으면 true> }` · `baseline/1.md` 머리 `<!-- mr-review source: alpha:docs/specs/…@<head> ref=<head> pinned=true -->` + 원문 · `CHECKED … baseline=저장소 문서 경로`.
- AC⑤-4 `check`(켬): 값에 두 경로(`docs/specs/a.md`, `README.md`) + 글롭 `docs/specs/**` → `repo-path` 링크는 `a.md` 하나 · 값 `docs/specs/a.md,docs/specs/b.md`·`docs/specs/a.md;docs/specs/b.md`·`「docs/specs/a.md」·docs/specs/b.md`(공백 없는 나열) + 글롭 `docs/specs/**` → 두 경로 모두 후보(R3-1) — 둘 다 head 에 있으면 `repo-path` 링크 2개 · `b.md` 만 없으면 `baselineRepoPathMisses === ['docs/specs/b.md']`·검사표 `저장소 문서 경로(경로 미확인 1건)` · 값 `docs/specs/a.md.` (뒤 구두점) → 경로 `docs/specs/a.md` · 값 `docs/specs/a.md#3`·`docs/specs/a.md(§3·§6)` → 경로만 · 값 `/abs/docs/specs/a.md`·`..\\x.md`·`docs/../specs/a.md` → 후보 아님(`서술만`) · 값 `docs/specs/a.md-disabled`·`docs/specs/a.md_backup`·`docs/specs/a.md.extra-disabled`·`docs/specs/a.md.extra_backup`(head 에 `docs/specs/a.md` 실재) → 후보 아님(C1 감사 이의 — 점이 둘 이상인 꼴) · 값 `C:\docs/specs/a.md`·`..\docs/specs/a.md`·`C:docs/specs/a.md`·`~/docs/specs/a.md`·`$HOME/docs/specs/a.md`·`docs/specs/a.md에서`(head 에 `docs/specs/a.md` 실재) → 후보 아님 · `baselineLinks` 에 `repo-path` 없음 · `baselineRepoPathMisses` 비어 있음(C2 회귀 — 허용 구분자 밖 글자가 붙은 토큰은 통째 탈락) · `baselineLinks` 에 `repo-path` 없음 · `baselineRepoPathMisses` 비어 있음(R1-3 — 접두 오해소 금지).
- AC⑤-5 `check`·`render`(켬 · H-1): 경로가 head 에 없음 / 심볼릭 링크 → `baselineLinks` 에 `repo-path` **없음** · `baselineRepoPathMisses === ['docs/specs/…']` · `baselineType === '서술만'`(다른 후보 없음) · `verdict.machineEvidence` 에 `M-baseline-*` **없음** · 판정은 `coveredBy`·경로 없는 현행 픽스처와 동일 · 보완 문안에 「Baseline 에 적은 경로 「docs/specs/…」 가 head 에 일반 파일로 없습니다」 1줄 · 검사표 `| Baseline 유형 | 서술만(경로 미확인 1건) |`; 경로 둘 중 하나만 있음 → `baselineType === '저장소 문서 경로'` · 검사표 `저장소 문서 경로(경로 미확인 1건)`; 키 없음 → `baselineRepoPathMisses` 는 `[]`(또는 부재) 이고 보완 문안·검사표 현행 바이트.
- AC⑤-6 `check`(켬 · H-7): 값에 blob URL 과 경로가 둘 다 → `문서 링크`(URL 우선) · `repo-path` 링크도 함께 수집 · 값에 `#12` 와 경로 → `저장소 문서 경로`(경로 > 이슈) · 이슈 링크도 함께 수집.
- AC⑤-7 `check`(켬 · diff-only): tree API 항목 `mode:'100644'` → 원문은 `repository/files/<path>/raw?ref=<head>` 로 확보(가짜 glab 픽스처) · `pinned:true`; 같은 경로가 tree 에서 `mode:'120000'`·`'160000'`·항목 없음·tree 조회 실패 → raw 가 내용을 돌려줘도 `repo-path` 링크 **없음** · `baselineRepoPathMisses` 에 그 경로(R1-4).
- AC⑤-11 `check`(켬 · 워크트리 · R1-5): head blob 450줄 기준선 → `baseline/1.md` 에 450번째 줄의 고유 문장이 있다(400줄 발췌 표지 `(… 상한으로 생략)` 없음) · 팩 A 의 그 `baseline` 출처 본문에도 450번째 줄이 있다.
- AC⑤-8 `pack`(켬 · 워크트리): `baseline` 출처로 두 팩에 · 팩 B 는 **포인터**(①) · 팩 A 는 본문; diff-only 는 둘 다 본문.
- AC⑤-9 `render`: `baselineType '저장소 문서 경로'` + `repo-path inDiff:true` → 검사표 `| Baseline 유형 | 저장소 문서 경로(이 MR 에서 수정됨) |`; `inDiff:false` → `| Baseline 유형 | 저장소 문서 경로 |`; `inDiff:true` + `baselineRepoPathMisses` 1건 → `저장소 문서 경로(이 MR 에서 수정됨 · 경로 미확인 1건)`; 현행 유형들의 리포트(`baselineRepoPathMisses` 없음·빈 배열)는 **바이트 불변**.
- AC⑤-10 `verdict`: `저장소 문서 경로` 는 `baselineMissing` 계산에서 `서술만`·`문서 링크` 와 같이 「있음」 — `RETURN_TO_DESIGN` 을 만들지 않는다(기존 verdict 테스트 불변).

### 3.⑥ 「요약」 절이 있어도 「배경 없음」 보완 요청 — 어댑터가 켤 때만 배경 절 이름 별칭

**현상**: `alpha !66` 본문은 `## 요약` 절에 왜·무엇을 적었는데 보완 요청 문안에 「「배경」에 ① 왜(…)를 적어 주세요.」·「「배경」에 ② 무엇을(…)을 적어 주세요.」 2줄이 나갔고 검사표는 「변경 사유 ①② | ①없음 ②없음 (none)」.

**재현 근거**: 리포트 보완 문안·부록 A · `check.mjs:67`(`section(description, /^배경/)`) · `check.mjs:114`(`isBody = /배경|MR 본문/`) · `resolveBody`(`check.mjs` — `section(mr.description, /^배경/)` · 사유 문구 `MR 본문에 「배경」 절이 없다`) · `report.mjs:255-256`(문구 「배경」 고정).

**원인**: 절 이름이 코드에 고정됐다 — 1.3.0 실사용 저장소 템플릿이 「배경」이었다. **기존 어댑터 저장소는 「배경」 절이 정책상 필수**이므로(사용자 결정 22:1x) 엔진이 「요약」을 전 어댑터에 인정하면 그 정책 검사가 약해진다 → 어댑터 키, 기본값 = 현행(D99).

**수정 방향(사용자 지시로 메인이 추천안 입력 2026-10-23 22:2x, Q5 — D96·D99)**

1. **SC-2 선택 키 `contract.backgroundSections: ["배경"]`**(`contract.lines` 옆 · 기본 `["배경"]` · 비어 있지 않은 문자열 1개 이상의 배열이 아니면 `AdapterError` 메시지에 `contract.backgroundSections(비어 있지 않은 문자열 배열)`). `loadAdapter` 가 `?? ['배경']` 로 채운다.
2. **절 매칭**(harden H-19 · review-loop(spec) R1-6 으로 정정): 별칭마다 `^<정규식 이스케이프한 이름>`(**접두 일치**, 현행 `/^배경/` 과 같은 규칙 · 정확 일치는 기각)으로 **어댑터 순서대로 `section()` 을 한 번씩** 불러 **첫 번째로 실재하는 절**을 쓴다(둘 다 있으면 어댑터 순서의 앞 이름 — 본문에 나온 순서와 무관) — `reasonText`·`resolveBody` 두 곳. 이름들을 합친 정규식 하나(`^(?:배경|요약)`)를 `section()` 에 넘기지 않는다 — `section()`(`check.mjs:12-18`)은 본문 위에서부터 `findIndex` 로 찾으므로 본문에 먼저 나온 절이 이겨 어댑터 순서가 무시된다. 우선 별칭의 절이 실재하면 비어 있어도 그 절을 쓴다(「첫 실재 절」 — 뒤 별칭으로 넘어가지 않는다). `check.json.reason.section`(SC-3 추가) = 쓴 절에 **일치한 별칭 이름**(어댑터에 적힌 이름 그대로 — `## 요약 (Summary)` → `요약` · `## 배경 (Background)` → `배경`) 또는 `null`(없음). 실제 제목 전체를 쓰지 않는다(review-loop(spec) R1-7 — D110: 키 없는 기존 어댑터에서도 `## 배경 (Background)` 제목이면 문구가 바뀌어 D99 바이트 불변이 깨진다).
3. **본문 기준선 표지**(`check.mjs:114` · harden H-6): `isBody` = 값에 `MR 본문` 또는 **별칭 중 하나**가 있으면(별칭도 본문 표지 — 「MR 본문·배경만」은 기각) → 기본값에서는 `/배경|MR 본문/` 과 동일.
4. **보완 문구**(`report.mjs:255-256`): `「<check.reason.section ?? backgroundSections[0]>」에 ① 왜…` — 절이 있는데 내용이 비면 그 절에 일치한 별칭 이름, 절이 없으면 첫 별칭(둘 다 어댑터에 적힌 이름 — 실제 제목의 덧붙은 글자는 문구에 들어가지 않는다, D110). 기본 어댑터 + 「배경」 절 → 현행 문구 바이트 동일. `resolveBody` 사유 = `MR 본문에 「배경」(또는 「요약」) 절이 없다` — 별칭이 1개면 현행 문구 그대로.
5. `supplementRequests` 에 `adapter` 를 넘긴다(시그니처 내부 — SC 계약 아님).

**AC**

- AC⑥-1 `adapter`: 키 없음 → `['배경']` · `["배경","요약"]` 보존 · `[]`·`"배경"`·`[""]` → `AdapterError` 메시지에 `contract.backgroundSections`.
- AC⑥-2 `check`(키 없음): 본문 `## 요약` 만 → `reason = { why:false, what:false, source:'none', text:'', section:null }` · 보완 문안 「「배경」에 ① …」·「「배경」에 ② …」(현행 바이트) · 본문 `## 배경` → `section:'배경'` 이고 그 밖 `check.json`·리포트 **바이트 불변**(기존 check·report 테스트 전부 통과 — `reason.section` 필드 추가는 깊은 동치 단언이 있으면 그 단언에 필드를 더한다).
- AC⑥-3 `check`(켬 `["배경","요약"]`): `## 요약` 에 ①② → `why:true · what:true · source:'body' · section:'요약'` · 보완 문안에 배경 줄 없음; `## 요약` 에 ① 만 → 「「요약」에 ② 무엇을…」 1줄; 둘 다 있으면 `## 배경` 우선(`section:'배경'`) — **본문에 `## 요약` 이 먼저 나와도**(R1-6 — 본문 순서 `## 요약` → `## 배경` 픽스처) · `## 배경` 이 빈 절이고 `## 요약` 에 ①② 가 있으면 `section:'배경'`·`why:false`·`what:false`(첫 실재 절 — 뒤 별칭으로 넘어가지 않는다).
- AC⑥-4 `check`(켬): Baseline `MR 본문 「요약」` → `baselineType 'MR 본문 배경'` · `resolveBody` 가 `## 요약` 절을 `baseline/<n>.md` 로 확보; 키 없음 + 같은 값 → `MR 본문 배경`(「MR 본문」 문구) · 절 없음 → `미확보` 사유 현행 문구.
- AC⑥-5 `check`(켬): 접두 일치 — `## 요약 (Summary)` 도 `요약` 별칭에 걸린다(현행 `/^배경/` 과 같은 규칙) · 이름에 정규식 메타 문자(`C++ 배경`)가 있어도 이스케이프돼 문자 그대로 비교 · `## 요약 (Summary)` 에 ① 만 → `section:'요약'` · 보완 문안 「「요약」에 ② 무엇을…」(제목 전체 아님).
- AC⑥-6 `check`·`render`(키 없음 · R1-7 — D110): 본문 `## 배경 (Background)` 에 ① 만 → `reason.section === '배경'` · 보완 문안 「「배경」에 ② 무엇을(원인·수정 위치·적용 범위)을 적어 주세요.」 **현행 바이트**(1.3.4 리포트와 동일).

### 3.A review-loop 설명문에 「남의 MR 검토는 mr-review」 안내 없음

**현상**: 같은 저장소의 다른 세션이 「리뷰 루프로 3회전 돌려 점검」 요청에 **팀원 MR 브랜치 워크트리**에서 review-loop 을 돌리려 했다(고친 커밋을 팀원 브랜치에 올릴지 질문까지). mr-review 설명(`SKILL.md:3`)은 「Does NOT … review your own spec/plan/impl (that is review-loop)」 로 반대 방향을 안내하지만 review-loop 설명(`dev-workflow/skills/review-loop/SKILL.md:3`)에는 「남의 MR 은 mr-review」 가 없다.

**재현 근거**: 두 frontmatter 원문(review-loop description 668바이트 — 「MR」·「mr-review」 문자열 없음) · 사용자 세션 보고.

**원인**: 1.3.0 이 mr-review 쪽 경계만 적었다(review-loop 은 T4 로 「건드리지 않는다」 대상이어서).

**수정 방향(사용자 지시로 메인이 추천안 입력 2026-10-23 22:2x, Q6 — D97)**

1. `review-loop/SKILL.md:3` description 끝에 1구 추가: `남의 MR(다른 사람의 GitLab merge request) 검토에는 트리거하지 않는다 — 그건 mr-review 다 (Does NOT trigger on reviewing someone else's MR; that is mr-review).` — 다른 문구·본문은 불변. 설명 길이 ≈ 800바이트(Claude Code frontmatter 한도 안 — 현행 mr-review 630바이트·doctor 와 같은 「Does NOT」 관행).
2. dev-cycle·README 불변(비목표).
3. **SC-7 T4 예외(이번 트랙만)**: T4 = `git diff <base> --stat -- dev-workflow/hooks dev-workflow/skills/dev-cycle dev-workflow/skills/doctor dev-workflow/skills/harden-spec dev-workflow/skills/orchestrate dev-workflow/skills/setup dev-workflow/skills/ui-mockup dev-workflow/skills/writing-plans-split | wc -l` = 0(review-loop 제외) **+ T4a** `git diff <base> -- dev-workflow/skills/review-loop | grep -E '^[-+][^-+]' | wc -l` = 2(description 1줄의 삭제·추가) **+ T4b** `git diff <base> --numstat -- dev-workflow/skills/review-loop | wc -l` = 1(파일 1개). plan SC-7 에 「1.3.5 트랙 한정 T4 예외」 부기(impl 트랙).

**AC**

- AC-A-1 문구 테스트(기존 mr-review SKILL.md 문구 테스트 파일에 추가 — T1 목록 불변): review-loop `SKILL.md` frontmatter `description` 에 `mr-review` 와 `someone else's MR` 이 있고, mr-review `SKILL.md` description 에 `that is review-loop` 이 그대로 있다.
- AC-A-2 게이트: T4(review-loop 제외) 0 · T4a 2 · T4b 1 · T5 0 · T6 0 · T7 0.
- AC-A-3 review-loop `SKILL.md` 의 frontmatter 밖(본문)은 `<base>` 와 바이트 동일(`git diff <base> -- dev-workflow/skills/review-loop/SKILL.md` 의 변경 hunk 가 3행 1개).

## 4. 영향 범위

| 대상 | 변경 |
|---|---|
| SC-2 어댑터 계약 | **선택 키 2개 추가 — 기존 키·값·형식·의미 불변**: `baselineRepoPaths: false`(⑤) · `contract.backgroundSections: ["배경"]`(⑥). 키 없음 = 현행 동작·출력 바이트 불변(D99). 검증 = `deployLayout` 선례(값 오류 → `AdapterError`) |
| SC-3 `check.json` | `baselineType` 값 `저장소 문서 경로` 추가 · `baselineLinks[*].kind` 값 `repo-path`·필드 `inDiff` 추가 · `baselineRepoPathMisses: [경로]`(head 에 없는 경로 후보 — 기준선 링크 아님, H-1) 추가(⑤) · `reason.section` 추가(⑥) — 기존 값·필드 불변 |
| SC-3 `pack.json` | `sources[*].packB: "body"|"pointer"|"none"` 추가(①) — `inPackB`·`exportAllowed`·`lines` 불변 |
| SC-3 `verdict.json` | `merged: ["<finding id>"]` 추가(④) — `evidence`·`defects` 의미 불변(병합 발견만 빠진다) |
| SC-3 작업 파일 | `W/codex-stats.json`(①) — 허용 9종 밖, cleanup `extra` 로 삭제(값은 `findings.json` 에 영속) |
| SC-5 `findings.json` | `reviewerStats.codex { commands, changedFiles, filesMentioned, weak }`(① 선택) · `findings[*].coveredBy: ["M-…"]`(④ 선택 — 메인이 쓴다). 병합 결과(`merged`)는 `findings.json` 에 쓰지 않고 `verdict.json.merged` 로만 영속(verdict 가 계산) |
| SC-6 CLI | 서브커맨드 `codex-stats --work <dir>` 추가(①) — 첫 줄 `CODEX_STATS …` |
| SC-7 게이트 | 이번 트랙 T4 = review-loop 제외 + T4a·T4b(A, D97) · T1 파일 목록 불변 |
| `adapter.mjs` | ⑤·⑥ 키 검증·기본값(`validate`·`loadAdapter`) |
| `check.mjs` | ⑤ 경로 후보 추출(`parseBaselineValue` 에 어댑터 옵션 · 오른쪽 토큰 경계)·`resolveRepoPath`(head 일반 blob **전문** — 워크트리 `ls-tree` 모드 · diff-only tree API 모드 확인 뒤 raw)·유형 우선순위·`inDiff` · ⑥ 별칭별 `section()` 을 어댑터 순서로(`reasonText`·`resolveBody`)·`isBody`·`reason.section` |
| `pack.mjs` | ① 포인터 렌더(`renderSources` 의 B 분기 · 대상 = `repo:` doc + `repo-path` baseline · 워크트리 모드만 · 포인터 직전 워크트리 실물 확인 3가지(D109) — 불일치 = 본문)·`packB` 표지·B 헤더 표기 · 팩 A 바이트 불변 |
| `report.mjs` | ① `codexStats()`·헤더/실행 블록/부록 D 표시 · ④ `computeVerdict` `coveredBy`·`merged` · 「3.」 `M-contract-*` 2건 이상 묶음 + 권고(1건은 현행 + 권고) · 「4.」 병합 제외 · 부록 D 표지 · ⑤ 검사표 접미(수정됨·경로 미확인) + 보완 문안 「경로 미확인」 1줄 · ⑥ 보완 문구 절 이름(`supplementRequests(adapter)`) — D88 원칙: 새 표시 줄의 외부 유래 문자열(경로·권고·절 이름)은 전부 `line()`/`tc()` |
| `mr-review.mjs` | `codex-stats` 라우팅 1줄 |
| `collect.mjs`·`deploy.mjs`·`gitlab.mjs` | 변경 없음 |
| SKILL.md | §5 Codex 프롬프트 2 문구 + 고정 첫머리 뒤 포인터 읽기 1문장 + 유효 판정 뒤 `codex-stats` 단계 · §6 1b `coveredBy` · §8 터미널 요약 「교차 검토 약함」 · 리포트 구성 문구(「3.」 묶음) |
| review-loop SKILL.md | frontmatter description 1구(A) — **그 밖 불변** |
| README 3종 | 1.3.5 한 줄(결함 4건 + 안내 1건 — Codex 팩 B 포인터·교차 검토 깊이 표지·기계 증거 병합·어댑터 선택 키 2개·review-loop 안내) |
| plugin.json·marketplace.json | 1.3.4 → 1.3.5 |
| plan | SC-2·SC-3·SC-5·SC-6·SC-7 「1.3.5에서 변경」 부기(impl 트랙 — 1.3.4 방식) |
| 어댑터 문서(프로젝트 쪽) | 변경 불요(⑤·⑥ 은 쓰려는 어댑터만 키를 켠다 — 그 저장소 어댑터 v1.1 몫) |
| `tests/mr-review` | adapter(⑤ 1·⑥ 1) · check(⑤ 6·⑥ 4) · pack(① 6·⑤ 1) · report(① 4·④ 6·⑤ 2·⑥ 1·A 1) — 기존 전부 불변, **예외 = ④ 「3. 통과해야 할 테스트」 체크박스 문구 단언(새 형식으로 갱신 · 의도 보존, D94)** 과 ⑥ `reason` 깊은 동치 단언(`section` 필드 추가) |

## 5. 검증 · 완료 조건

- 각 AC 를 `tests/mr-review/*.test.mjs` 에 **먼저 RED 로** 추가한 뒤 구현으로 GREEN(TDD). 게이트 = SC-7 T1~T7 — **이번 트랙 T4 는 D97 의 예외 형식**(review-loop 제외 0 + T4a 2 + T4b 1) · T6 식별자 패턴 0건(픽스처의 경로·절 이름도 가상 값) · T7 AI 서명 0건 · T5 `$N` 0건.
- 4단계 review-loop(spec) — 이 spec 을 적대검증한다(D91). 보안 크리티컬 = **yes**(접촉면 = ① Codex 전송 경계 축소(포인터 대상 조건 · 심볼릭 링크 · diff-only 제외 · 마스킹 순서) · ④ 병합의 fail-closed(DEFECT 병합 금지 · 없는 id) · ⑤ 경로 꼴 검증(상대 경로 규칙·head blob 모드)). 5·6 생략.
- 8단계 impl 적대검증(review-loop `--phase impl`) 필수(하한). 보안 크리티컬 = **yes**(같은 접촉면 + 기존 어댑터 바이트 불변 AC 의 실측).
- 9단계(릴리스 뒤 외부 실측 — 사용자 결정 22:2x, **합격선**): 1.3.5 설치 뒤 **같은 큰 구현 MR(같은 head)** 을 어댑터 v1.1 로 다시 돌려 — ⓐ 두 검토자가 **각자** 상태·동시성 결함(열린 화면의 옛 값 저장이 자동 수신값을 덮어쓰는 lost update)을 잡고 ⓑ 두 검토자가 **각자** 배포 절차 문서 결함(런북 개통 시험 절차의 주소 오류)을 잡는다. 함께 기록: Codex 프롬프트 바이트(목표 = 팩 B 의 `repo:` 본문만큼 줄어듦) · `CODEX_STATS`(명령·언급 파일 — 목표 `weak:false`) · 헤더 「교차 검토」 문구 · 「3. 통과해야 할 테스트」 체크박스 수 · 어댑터 v1.1 이 `baselineRepoPaths`·`backgroundSections` 를 켰다면 「Baseline 유형 | 저장소 문서 경로」·배경 보완 문안 0줄. **기존 실사용 저장소(키 없음) MR 1건**도 재실행해 1.3.4 리포트와 바이트 비교(①·④ 표시 변경분만 다르고 검사표·보완 문안·판정은 동일 — harden H-15, D99 의 외부 증거).

## 6. 잔여 리스크 (DEFERRED · 실측) · 미해결 질문

**미해결 질문: 없음.** 설계 선택 6건(Q1 경로·Q2 ①·Q3 ④·Q4 ⑤·Q5 키 모양·Q6 A/T4)과 harden-spec(2026-10-23 22:3x~22:5x, 이 세션)의 판단 갭 15건(H-1 ⑤ 부재 처리 · H-2 ④ 권고 자리 · H-3 ④ 1건 묶음 · H-4 ① 포인터 줄 수 · H-5 ① 통계 주체 · H-6 ⑥ 본문 표지 · H-7 ⑤ 유형 우선순위 · H-8 ① 단일 모델 헤더 · H-9 ① 무효 때 통계 · H-12 ④ 병합 대상 · H-13 ① 부록 D 통계 · H-15 §5 기존 저장소 실측 · H-16 ⑤ 기준선 포인터 · H-18 ⑤ 코드 스팬 경로 · H-19 ⑥ 일치 규칙)은 전부 질문으로 해소됐고(사용자 지시로 메인이 추천안 입력 — 사용자 지시 22:43 「위임모드로 머지까지」) 사용자가 유예한 갭은 없다 — **DEFERRED 0건**. ⑤·⑥ 기본값 = 현행·어댑터 v1.1·재시험 합격선은 사용자 결정(22:1x·22:2x). 사실 갭은 코드 조회로 닫았다(워크트리 = `git worktree add --detach <head>` 의 깨끗한 체크아웃(`collect.mjs:102`) → 포인터 경로 = head blob · 재리뷰 파서 `APPENDIX_D_RE`(`check.mjs:242`)는 `(차단)` 뒤에 바로 ` — ` 를 요구해 병합 표지 줄을 읽지 않음 · cleanup `KEEP` 9종(`report.mjs:440`) 밖은 `extra` · 기준선 유형 열거는 plan SC-3 에만(SKILL·README 미열거) · README 의 어댑터 키 언급은 버전 줄뿐(`deployLayout` 1.3.2 줄) · `check.test.mjs` 에 `reason` 깊은 동치 단언 없음 · CLI `KNOWN` 목록(`mr-review.mjs:28`)에 `codex-stats` 추가(`NEEDS_ADAPTER` 아님) · Codex 명령 수는 실행 기록 중복 제거 기준 16회(트랙 프롬프트의 「17회」와 1 차이 — 로그 중복 또는 절단 1건, 결론 무관)).

**검증 필요(실측 — repo 조회로도 사용자 결정으로도 닫히지 않는 외부 사실)**

- ① 포인터로 Codex 프롬프트가 실제로 얼마나 줄고 Codex 가 코드 파일을 더 읽는가(`CODEX_STATS`) — §5 9단계. 줄어들어도 Codex 가 여전히 얕으면(약함 지속) 그 다음은 어댑터(렌즈 순서)·프롬프트 순서(diff 를 팩 B 앞에)의 몫 — 이번 spec 은 프롬프트 순서를 바꾸지 않는다(§6 한계).
- ① `weak` 임계(1/4)가 실제 MR 분포에 맞는가 — 작은 MR(변경 3개 · 언급 0)에서 `ceil(3/4)=1` 이라 1개만 언급하면 통과한다. 과대·과소 표지가 보이면 임계만 조정(한 줄).
- ⑤·⑥ 을 켠 어댑터 v1.1 에서 「저장소 문서 경로」 확보·「요약」 인정이 실제 MR 본문 꼴에 맞는가(값에 `(§3·§6)`·굵게·코드 스팬 등).
- 1.3.4 §6 승계(표본 zip 꼴 · Windows V1 · 재현율 편차).

**수용된 한계(결정은 내려졌고 리스크만 기록)**

- ① 포인터는 **워크트리 모드만** — diff-only 리뷰는 팩 B 가 지금처럼 크다(D92).
- ① MR 본문·댓글은 워크트리 밖 자료라 본문으로 간다 — 본문이 매우 긴 MR 은 여전히 프롬프트를 채운다(총량 상한 기각, Q2).
- ① 포인터 경로가 어댑터 마스킹 패턴에 걸리면 가려진 채 가서 Codex 가 그 문서를 못 찾는다(보이는 실패 — 팩 B 의 포인터 줄에 `[masked]`). 어댑터 패턴 몫.
- ① `filesMentioned` 는 companion 로그 96자 절단으로 과소 집계될 수 있다(「약함」 쪽으로 보수적) · Codex 가 경로를 출력하지 않는 명령(`rg` 결과만)으로 읽은 파일은 세지 못한다 · basename 만으로는 세지 않는다. 깊이 표지는 **하한 표지**이고 「충분히 봤다」의 증명이 아니다.
- ① Claude 검토자의 깊이는 세지 않는다(Agent 도구 — 실행 로그 없음, ⑧ 비목표). 「교차 검토 약함」은 Codex 쪽만 말한다.
- ① Codex 가 포인터 지시를 어기고 문서를 안 읽을 수 있다 — 지금도 코드를 안 읽을 수 있는 것과 같은 수준(모델 행동). `CODEX_STATS` 가 간접 신호.
- ④ 병합은 메인의 판단(`coveredBy` 기입)에 달렸다 — 메인이 적지 않으면 현행처럼 세 번 나온다(「3.」 묶음은 그래도 적용). 자동 지문 병합은 ⑦ 비목표.
- ④ 「3. 통과해야 할 테스트」 묶음은 모든 어댑터의 게시 블록 형식을 바꾼다(계약 미완 MR 만 — 사용자 지시 「①·④ 는 표시 변경 가능」).
- ⑤ 켠 어댑터에서 글롭에 맞는 경로가 head 에 없으면(오타·삭제·링크) 「서술만」 + 보완 문안 1줄 + 검사표 「(경로 미확인 n건)」 — 판정은 바뀌지 않으므로(H-1) 작성자가 문안을 무시하면 기준선 없이 리뷰가 진행된다(현행과 같은 수준 — 「조용한 강등」은 문안·검사표로 보이게만 했다). 글롭 밖 경로는 지금처럼 아무 표시 없는 「서술만」 — 두 결과가 다르다는 점은 어댑터 작성자가 알아야 한다(README 한 줄).
- ④ `M-contract-*` 1건은 현행 문구(H-3)라 「2줄 이상이면 묶음, 1줄이면 줄 이름」 두 형식이 공존한다 — 재리뷰 파서는 「4.」 만 읽으므로 영향 없음.
- ⑤ 기준선 문서를 **같은 MR 에서 고친** 경우도 「확보」다(head 기준) — 표시 「(이 MR 에서 수정됨)」만 하고 판정은 바꾸지 않는다. 자기 승인 위험의 판단은 리뷰어·어댑터 정책 몫.
- ⑤ 경로 후보는 허용 구분자로만 끊으므로(D112) 한글 조사·다른 글자가 바로 붙은 경로(`docs/specs/a.md에서`·`docs/specs/a.md를`)는 후보가 아니다 — 「서술만」(현행과 같은 결과, 글롭 밖 경로와 같이 표시 없음). 작성자가 경로 뒤에 공백·구두점을 두는 관례 몫.
- ⑤ 경로 꼴 정규식은 공백·괄호가 든 경로를 못 잡는다(`src/app/(app)/x.md` 는 `(`·`)` 가 경계 문자라 잘린다) — 기준선 문서는 `docs/**` 관례라 수용. 필요하면 코드 스팬(`` `경로` ``) 안의 값을 그대로 쓰는 규칙을 더하는 후속.
- ⑥ 별칭은 절 제목 **접두 일치**다(현행 `/^배경/` 과 같은 규칙) — 「요약」 별칭이 「요약 통계」 절에도 걸린다. 어댑터가 이름을 구체적으로 적는 몫.
- A 는 설명문 안내일 뿐 강제가 아니다 — 모델이 설명을 무시하면 지금과 같다. 추가 방어(review-loop 본문의 「소유 브랜치 확인」)는 review-loop 트랙 몫(T4 범위).

## 재논의 금지(기결정)

사용자 지시(2026-10-23 18:1x 「수정사항이 나오면 수정 진행해주세요」 · 22:0x 「확인 후 수정여부를 판단해 진행」)에 따라 **메인이 추천안(첫 선택지)을 입력**한 결정(이 세션 질의 6건 Q1~Q6, 22:2x)과 **사용자 결정**(22:1x 범위·⑤⑥ 기본값 제약 · 22:2x 어댑터 v1.1·합격선). 리뷰에서 다시 제안하지 않는다. 1.3.0 spec D1~D16 · 1.3.1 D17~D34 · 1.3.2 D35~D51 · 1.3.3 D52~D67 · 1.3.4 D68~D89 는 전부 승계한다(**변경 = D4 전송 범위 축소 → D92 · SC-5/SC-3 필드·값 추가 → D93·D94·D95·D96 · SC-7 T4 이번 트랙 예외 → D97** — 명시).

| D | 결정 | 근거 |
|---|---|---|
| D90 | 이 트랙 범위 = ①·④·⑤·⑥·A(5건 전부). ②·③ = 어댑터 v1.1 몫(처리됨) · ⑦·⑧·계약 줄 수 고정·어댑터 자동 선택 = 후속 · 1.3.4 이월·팩 B 총량 상한·diff-only 포인터·dev-cycle 안내 = 비목표 | 사용자 결정(22:1x 「5건 전부」 · 22:2x 어댑터 v1.1) |
| D91 | 경로 = **경량, 단 4단계 spec 적대검증 유지(보안 yes)**. 생략 = 5 plan·6 plan 적대검증(5 생략의 자동 귀결). 근거 = 접촉 표면 무신호 + ① 이 Codex 전송 경계 변경(축소)이라 codex 가 spec 에서 한 번 두드린다. 하한 유지. ledger(spec) = 이 spec 말미 `## 적대검증 ledger (spec)`, ledger(impl) = 그 아래 | 사용자 지시로 메인이 추천안 입력(Q1) — 1.3.3 D53·1.3.4 D69 선례 |
| D92 | ① = **팩 B 포인터**: 대상 저장소 head blob 에서 읽은 출처(`repo:` doc · ⑤ `repo-path` baseline)는 워크트리 모드에서 본문 대신 「경로@head7[#절] · n줄 — cwd 에서 직접 읽어라」 한 블록. 일반 blob(100644·100755)·`missing:false` 만 · 심볼릭 링크·서브모듈·부재·절 없음은 현행 · diff-only 는 전부 본문 · 워크트리 밖 자료(공통 문서·위키·어댑터·URL 기준선·이슈·본문 기준선·재리뷰·MR 본문·댓글)는 현행 마스킹 본문 · 팩 A 바이트 불변 · 마스킹·잔존 검사는 포인터 포함 `rawB` 전체. **D4 전송 범위의 축소**(D14·D16 불변). 총량 상한·깊이 표지만은 기각. **(review-loop(spec) 로 정정: 포인터 직전 워크트리 실물 확인 3가지 — D109)** | 사용자 지시로 메인이 추천안 입력(Q2) — Codex 는 D4 대로 워크트리를 이미 직접 읽으며, 보내는 양만 줄어든다 |
| D93 | ① = **깊이 표지**: `codexStats()`(`commands` = `[codex] Running command:` 줄 수 · `changedFiles` = `mr.json.diffs` 경로 집합 · `filesMentioned` = `codex.out` 전문에 경로 그대로 등장 · `weak` = `filesMentioned < ceil(changedFiles/4)`) + CLI `codex-stats` + `findings.json.reviewerStats.codex`(선택) → 헤더 `교차 검토: 있음(약함 — 변경 파일 n 중 m 언급 · 명령 k회)` · 실행 블록 `[판독]` 줄 ` · 교차 검토 약함`(약함일 때만) · 터미널 요약 · 부록 D 1줄. 통계 없음 = 현행 바이트. `crossChecked`·판정 계산 불변 | 사용자 지시로 메인이 추천안 입력(Q2 묶음) — 실측 9/69 를 「약함」으로 읽는 임계 · D47 표시 자리 3곳 |
| D94 | ④ = **기계 증거 유지 + 모델 발견 병합**: SC-5 `coveredBy: ["M-…"]`(메인이 §6 1b 에서 `MISSING_EVIDENCE` 에만) → `computeVerdict` 가 `type === MISSING_EVIDENCE` 이고 모든 id 가 이번 `machineEvidence` 에 있을 때만 `merged`(evidence·defects 제외 · `verdict.json.merged`), 아니면 무시 + `reasons`(fail-closed). 「3. 통과해야 할 테스트」의 `M-contract-*` 는 한 체크박스 `Review Contract n줄 미완(이름들)` + 병합 발견의 `recommendation` 을 ` — 권고: …`. 「4. 차단 발견」은 `M-contract-*` 줄마다(재리뷰 파서 불변) · 병합 발견 제외 · 부록 D 에 병합 표지. 바뀌는 기존 체크박스 단언은 새 형식으로 갱신(의도 보존). 「F1 남기고 기계 증거 접기」·「병합만」은 기각. **(harden 로 정정: 묶음은 2건 이상만·1건은 현행 문구 — D101 · 권고 자리 = 「3.」 1회 — D101 · 병합 대상 = 모든 기계 증거 종류 — D106 · review-loop(spec) 로 정정: 미해결 후보는 리뷰어 확인 뒤에만 병합 — D111)** | 사용자 지시로 메인이 추천안 입력(Q3) — 기계 증거 id 가 재리뷰·축약 파서의 키 · 판정 불변(둘 다 증거 부족) |
| D95 | ⑤ = **선택 키 `baselineRepoPaths`(기본 false) + `baselineCandidates` 글롭 + head 일반 blob 실재**: 값 안 정규 상대 경로 꼴(구분자·확장자·뒤 구두점 제거·`#`/`(§…)` 접미 제외) 중 글롭에 맞는 것만 경로 후보 · 실재하면 `kind: repo-path` 링크·유형 `저장소 문서 경로` · 해소 = `repoDocText` 와 같은 head blob 읽기(`ref=head`·`pinned:true`) · `inDiff` 표지 → 검사표 `(이 MR 에서 수정됨)` · 글롭 밖 = 서술만 · `baselineMissing`·조기 종료 계산 불변. 「head 의 .md 전부」·「diff 안 문서만」은 기각. **(harden 로 정정: 없음/링크/서브모듈 = 「서술만」 + `baselineRepoPathMisses` + 보완 문안 — `M-baseline` 아님 — D100 · 우선순위 링크 > 경로 > 이슈 — D105 · review-loop(spec) 로 정정: 경로 꼴 추출 = 덩어리 통째 검증 — D112)** | 사용자 지시로 메인이 추천안 입력(Q4·Q5) — 어댑터가 기준선 문서 위치를 이미 글롭으로 선언 |
| D96 | ⑥ = **선택 키 `contract.backgroundSections`(기본 `["배경"]`)**: 접두 일치 정규식(이스케이프 · 어댑터 순서의 첫 실재 절) 을 `reasonText`·`resolveBody`·`isBody` 에 · `check.json.reason.section` · 보완 문구 「<실제 절 이름 또는 첫 별칭>」. 기본 어댑터 = 현행 바이트. **(review-loop(spec) 로 정정: 「실제 절 이름」 → 「일치한 별칭 이름」 — D110 · 별칭별 `section()` 을 어댑터 순서로 — R1-6)** 「`authoring` 객체」·「엔진이 요약 인정」은 기각 | 사용자 지시로 메인이 추천안 입력(Q5) — 1.3.2 `deployLayout` 선례(선택 키 + 기본값 + 검증) |
| D97 | A = review-loop `SKILL.md` frontmatter description 끝 1구(「남의 MR … 그건 mr-review 다 (Does NOT trigger on reviewing someone else's MR; that is mr-review)」) · 그 밖 review-loop 불변 · dev-cycle·README 불변 · **SC-7 T4 이번 트랙만 예외** = review-loop 제외 0 + T4a(review-loop 변경 줄 2) + T4b(파일 1) · 문구 테스트는 기존 mr-review SKILL.md 문구 테스트 파일에(T1 목록 불변). 「별도 트랙 분리」·「dev-cycle 도 1줄」은 기각 | 사용자 지시로 메인이 추천안 입력(Q6) — 사용자 결정 「5건 전부」 유지 · 예외는 측정 가능한 두 줄로 좁힘 |
| D98 | 이 세션(spec·harden)은 코드·테스트·SKILL.md·review-loop·plan·README·plugin.json 을 수정하지 않는다. plan SC 부기·README·버전은 impl 트랙 몫 | 트랙 프롬프트 편집 범위(1.3.4 D74 방식) |
| D99 | ⑤·⑥ 은 **기본값 = 현행 동작(기존 어댑터 출력 바이트 불변)**, 새 동작은 어댑터 키로 켤 때만 — 그 불변을 AC 로 둔다(AC⑤-2·AC⑥-2·AC⑤-9·AC①-9 현행 바이트). ① 은 모든 어댑터에 적용(판정 계산 불변 · 표시만 변경). ②·③ 은 어댑터 몫 | 사용자 결정(22:1x — 기존 어댑터 정책 = Baseline permalink 고정·「배경」 절 필수) |

harden-spec(2026-10-23 22:3x~22:5x, 이 세션)에서 확정 — 판단 갭 15건 전부 사용자 지시로 메인이 추천안 입력(사용자 지시 22:43 「이제부터 위임모드로 머지까지 진행」 · 메인 확인 22:4x~22:5x).

| D | 결정 | 근거 |
|---|---|---|
| D100 | ⑤ 글롭에 맞는 경로 후보가 head 에 **일반 파일로 없으면**(오타·삭제·심볼릭 링크·서브모듈) 기준선 링크로 기록하지 않는다(`M-baseline` 없음 — 판정 입력 불변) · `check.json.baselineRepoPathMisses` 에 적고 보완 문안 1줄(「Baseline 에 적은 경로 … 가 head 에 일반 파일로 없습니다 — 경로를 확인해 주세요」) + 검사표 `(경로 미확인 n건)`. 「조용히 서술만」·「미확보 → 증거 부족」은 기각 | 사용자 지시로 메인이 추천안 입력(갭 H-1) — Q4 답변 문구 「부재는 서술만」 유지 + 작성자 안내 · 「①·④·⑤ 는 입력·표시만」 기결정과 일치 |
| D101 | ④ 병합 발견의 `recommendation` 은 **「3. 통과해야 할 테스트」의 계약 체크박스 끝에 1회**만(「4.」 M- 줄에는 붙이지 않는다) · `M-contract-*` 묶음은 **2건 이상**일 때만, 1건은 현행 문구 바이트 그대로(+ 병합 발견 있으면 ` — 권고: …`). 「4. M- 줄마다」·「둘 다」·「항상 묶음」은 기각 | 사용자 지시로 메인이 추천안 입력(갭 H-2·H-3) — 같은 문장 반복이 ④ 의 결함 · 기존 어댑터의 가장 흔한 블록(계약 1줄 미완) 불변 |
| D102 | ① 포인터의 「n줄」 = **head blob 파일 전체 줄 수**(자르기 전 본문) · 팩 B 출처 헤더 표기 = ` · (경로만 — 작업 디렉터리에서 직접 읽음)`(모델 이름 없음, D11). 「팩 A 발췌 줄 수」·「줄 수 생략」은 기각 | 사용자 지시로 메인이 추천안 입력(갭 H-4) — Codex 가 실제 읽을 양 |
| D103 | ① 깊이 통계는 **CLI 서브커맨드 `codex-stats`**(순수 함수 `codexStats()` · 첫 줄 `CODEX_STATS …`)가 계산 · `codex.out` 이 있으면 Codex 유효·무효 무관 **항상** 기록 · 단일 모델 모드 헤더는 「없음」 **그대로**(통계 미부착) · **부록 D 머리 1줄**(통계 있을 때만 — 단일 모델 모드에서 보이는 유일한 자리). 「SKILL bash 스니펫」·「유효할 때만」·「없음(…) 덧붙임」·「D47 3곳만」은 기각 | 사용자 지시로 메인이 추천안 입력(갭 H-5·H-8·H-9·H-13) — 결정적·테스트 가능 · 괄호·공백 경로 안전 · 무효 원인 분석 자료 |
| D104 | ⑥ 별칭은 **본문 기준선 표지(`isBody`)에도** 인정(값에 `MR 본문` 또는 별칭) · 절 매칭은 **접두 일치**(현행 `/^배경/` 규칙 그대로 · 이스케이프). 「MR 본문·배경만」·「정확 일치」는 기각 | 사용자 지시로 메인이 추천안 입력(갭 H-6·H-19) — 별칭 개념과 일관 · 기본 어댑터 동작 불변 |
| D105 | ⑤ 유형 우선순위 = **문서 링크 > 저장소 문서 경로 > 이슈 > MR 본문 배경 > 빈칸·자리표시자 > 서술만**(표시 우선순위만 — 링크·원문은 전부 수집) · 공백·괄호 경로(코드 스팬 안 값 그대로 인정)는 **범위 밖**(§6). 「이슈 > 경로」·「코드 스팬 규칙 포함」은 기각 | 사용자 지시로 메인이 추천안 입력(갭 H-7·H-18) — 경로는 문서라 링크 다음 · 기준선 문서는 `docs/**` 관례 |
| D106 | ④ `coveredBy` 대상 = **모든 기계 증거 종류**(`M-contract-*`·`M-deploy`·`M-baseline-*`·`M-diff-*`·`M-api-*`·`M-rereview` — 검증 = 이번 실행 id 실재 + `type` MISSING_EVIDENCE). 「M-contract-* 만」은 기각 | 사용자 지시로 메인이 추천안 입력(갭 H-12) — 같은 사안 반복은 계약뿐이 아니다 |
| D107 | §5 9단계 실측에 **기존 실사용 저장소(키 없는 어댑터) MR 1건 재실행 → 1.3.4 리포트와 바이트 비교** 포함(①·④ 표시 변경분만 다름). 「제외」는 기각 | 사용자 지시로 메인이 추천안 입력(갭 H-15) — D99 불변의 외부 증거, 비용 = 실행 1회 |
| D108 | ⑤ 로 확보한 `repo-path` 기준선 원문도 워크트리 모드에서 **① 포인터**(같은 head blob · 팩 A 는 본문 · URL permalink 기준선은 현행 본문). 「기준선은 본문 유지」는 기각 | 사용자 지시로 메인이 추천안 입력(갭 H-16) — 포인터 규칙 = 「대상 저장소 head blob」 한 가지 |

review-loop(spec)(2026-10-23 23:1x, 위임 트랙)에서 확정 — 위험군 질문(보안 접촉면·D블록 문구 변경)에 메인이 추천안 입력 **[자동 채택(위임)]**(사용자 판정 아님 — 확인 임무 ③ 우선 감사 대상 · `## 확인 대기 대장` 참조).

| D | 결정 | 근거 |
|---|---|---|
| D109 | ① 포인터는 D92 조건에 더해 **워크트리 실물 확인 3가지**를 통과할 때만: ⓐ 그 파일이 `lstat` 으로 일반 파일(링크 아님) ⓑ `realpath` 가 워크트리 실제 경로 안(부모 링크 포함) ⓒ 바이트 = `git show <head>:<경로>` blob. 하나라도 어긋나거나 확인 오류면 현행 마스킹 본문(`packB:'body'`). 「알고 둔다(같은 head 새 체크아웃 전제)」는 기각 | 추천 자동 채택(위임)(R1-2) — Codex 가 읽는 것은 커밋 트리가 아니라 디스크 파일 · 보안 트랙 fail-closed · 비용 = 파일 1회 비교 |
| D110 | ⑥ `check.json.reason.section`·보완 문구의 절 이름 = **일치한 별칭 이름**(어댑터에 적힌 이름 — `## 배경 (Background)` → `배경`). 실제 제목 전체는 쓰지 않는다(D96 「실제 절 이름」 정정). 「켠 어댑터만 실제 제목」은 기각 | 추천 자동 채택(위임)(R1-7) — 키 없는 어댑터에서도 긴 제목이면 문구가 바뀌어 D99 바이트 불변이 깨진다 · 규칙 하나 |
| D111 | ④ `coveredBy` 병합은 **리뷰어 확인 전 미해결 후보(`unresolved:true`·미결정)에는 적용하지 않는다** — 지금처럼 `unresolved`·`branches`·`status:'undetermined'`(§5.5-2 확인 게이트 불변), `--resolve … =confirmed` 뒤 재계산에서 병합 · `dismissed` 는 활성 발견이 아니라 병합 대상도 아니다. 「알고 둔다(갈래 판정이 같다)」는 기각 | 추천 자동 채택(위임)(R2-1) — 병합이 사람 확인 게이트를 건너뛰면 「판정 계산 불변」(G2·D94)이 깨진다 |
| D112 | ⑤ 경로 후보 추출 = **허용 구분자(공백류·`,`·`;`·`(`·`)`·`「`·`」`·`'`·`"`·`·`)로만 나눈 토큰**에서 `#` 뒤와 끝 `.` 만 떼고 **토큰 전체**를 정규 상대 경로 꼴로 검증 — 목록 밖 글자(역슬래시·`:`·`~`·`$`·한글 등)가 붙은 토큰은 통째 탈락 · 토큰의 앞·뒷부분만 떼어 경로로 삼지 않는다 · 구두점으로 붙은 다음 경로도 후보. 「공백 없는 나열은 알고 둔다」(R3-1)·「앞 글자 금지 목록」(C2)·「윈도우·상위 경로는 알고 둔다」(C2)는 기각 | 추천 자동 채택(위임)(R1-3 감사 이의 재판정 · R3-1 · **C2 회귀·감사 이의 재판정으로 정정** — 같은 계열 4회: 접두 오해소 → 점 둘 이상 → 나열 누락 → 비정규 경로 뒷부분) — 허용 목록 하나로 접두 오해소·후보 누락·비정규 경로 통과를 함께 닫는다 · 한글 조사 붙은 경로는 후보 아님(§6) · 글롭 필터가 추가 안전망 |

## 적대검증 ledger (spec)

보안 크리티컬: yes (호출자 지정) — 접촉면 = ① Codex 전송 경계 축소(팩 B 포인터 대상 조건·마스킹 순서·워크트리 밖 자료) · ④ 병합 fail-closed · ⑤ 경로 꼴 검증(head blob 모드) · 새 표시 줄의 D84 마스킹 입구·D88 평탄화

base `6e7bef3`(= origin/main, 1.3.4 릴리스) · 예산 `--max 5` · `--confirm-rounds 2` · `--auto-rounds 1` · 모드 위임(`DEV_WORKFLOW_MODE=delegated`) · 승계 대장 대기 0건.

| fingerprint | severity | disposition | 근거 · 커밋 |
|---|---|---|---|
| R1-1 | spec §3.①-4 · Codex 포인터 읽기 지시에 「팩 B 에 없는 경로는 읽지 마라」 — 팩 B 에 코드 경로 목록이 없어 변경 파일·호출부 탐색까지 금지 · 금지 범위를 워크트리 밖·자료 속 지시로 한정 | high | FIXED (추천 자동 채택(위임)) — `[자동 채택(위임)]` 확인 임무 ③ 우선 감사 | 그 문구 제거 · 포인터 읽기 1문장만 · cwd 밖 금지(고정 첫머리) 불변 · AC①-11 에 「팩 B 에 없는 경로」 부재 단언 · `fc88418` · 대장 #1 |
| R1-2 | spec §3.①·D92 · 포인터 조건이 커밋 트리 모드만 봄 — Codex 가 읽는 디스크 체크아웃 파일이 링크·다른 바이트여도 포인터 발급 · 실물(링크·realpath·blob 바이트) 확인 뒤 불일치는 본문 폴백 | high | FIXED (추천 자동 채택(위임)) — `[자동 채택(위임)]` 확인 임무 ③ 우선 감사 | D109 신설(실물 확인 3가지 · 불일치 = 현행 마스킹 본문) · §3.①-1·보안 접촉면 문단 · AC①-15 · §4 pack.mjs 행 · `fc88418` · 대장 #2 |
| R1-3 | spec §3.⑤-2 · 경로 정규식에 오른쪽 토큰 경계 없음 — `a.md-disabled`·`a.md_backup` 이 `a.md` 로 추출돼 다른 파일을 기준선으로 확보 · 전체 토큰 경계 | medium | FIXED (루프 판정 → C1 잔존 + 감사 이의 → 재판정 「토큰 전체 검증으로 다시 고친다」 추천 자동 채택(위임)) — `[자동 채택(위임)]` 확인 임무 ③ 우선 감사 | 1차 끝에 `(?![A-Za-z0-9_\/-])` · AC⑤-4 두 꼴 · `2c532c2` → C1: `a.md.extra-disabled` 꼴(점 둘 이상) 잔존(루프 재현 확인) → 2차 = 토큰(경로 글자 최대 덩어리) 전체를 자른 뒤 끝 `.` 만 떼고 통째로 경로 꼴 검증(앞부분만 떼는 길 없음) · AC⑤-4 에 점 둘 이상 꼴 추가 · node 16개 값 실측 · `f6a55fe` · 대장 #5 |
| R1-4 | spec §3.⑤-4 · diff-only 해소가 `repoDocText` raw API 만 — 모드 미확인이라 심볼릭 링크가 링크 대상 문자열로 「확보」(D100 위반) · tree 메타데이터 모드 확인 | medium | FIXED (루프 판정) | diff-only = tree API(`per_page=100`·paginate) 모드 100644·100755 일 때만 raw · 그 밖 = 미확인(`baselineRepoPathMisses`) · AC⑤-7 확장 · `2c532c2` |
| R1-5 | spec §3.⑤-4 · 기준선 해소에 발췌 함수(`repoDocText` → `sliceDoc` 400줄) 지정 — 뒤쪽 수용기준이 잘린 채 「확보」 · 전문 읽기 분리 | medium | FIXED (루프 판정) | 해소 = head 일반 blob **전문**(URL 기준선 `check.mjs:172-175` 와 같은 규칙) · AC⑤-11 신설(450줄) · `2c532c2` |
| R1-6 | spec §3.⑥-2 · 합친 정규식 `^(?:배경|요약)` 을 `section()` 에 넘기면 본문 순서가 이겨 어댑터 순서 미구현 · 별칭별로 어댑터 순서 검색 | medium | FIXED (루프 판정) | 별칭마다 `section()` 을 어댑터 순서로 · 첫 실재 절(빈 절이어도) · AC⑥-3 확장(본문 순서 역전·빈 우선 절) · §4 check.mjs 행 · `2c532c2` |
| R1-7 | spec §3.⑥-2·4·D96 · 「실제 절 제목」 사용이 키 없는 어댑터에서도 `## 배경 (Background)` 이면 보완 문구를 바꿔 D99 바이트 불변 위반 · 키 없으면 「배경」 유지 | medium | FIXED (추천 자동 채택(위임)) — `[자동 채택(위임)]` 확인 임무 ③ 우선 감사 | D110 신설(절 이름 = 일치한 별칭 이름) · D96 정정 표기 · AC⑥-5 확장·AC⑥-6 신설 · `fc88418` · 대장 #3 |
| R2-1 | spec §3.④-2·D94 · 유효한 `coveredBy` 가 리뷰어 확인 전 미해결 후보(`unresolved:true`)까지 `unresolved`·`branches` 에서 빼 §5.5-2 확인 게이트를 건너뛰고 판정이 확정됨 · 병합은 증거 집합에만, 미해결 후보의 확인 절차는 보존 | medium | FIXED (추천 자동 채택(위임)) — `[자동 채택(위임)]` 확인 임무 ③ 우선 감사 | D111 신설(미해결 후보는 confirmed 뒤 재계산에서만 병합 · dismissed 는 병합 대상 아님) · §3.④-2 · D94 정정 표기 · AC④-9 · `85c51b1` · 대장 #4 |
| R3-1 | spec §3.⑤-2 · 토큰 시작 경계가 공백·괄호·인용부호만 허용 — `docs/specs/a.md,docs/specs/b.md` 의 두 번째 경로가 후보에서 조용히 빠지고 부재여도 `baselineRepoPathMisses` 에 안 나옴(D105 원문 전부 수집 위반) · 구두점 뒤 다음 후보도 탐색 | medium | FIXED (추천 자동 채택(위임)) — `[자동 채택(위임)]` 확인 임무 ③ 우선 감사 · **R1-3 과 같은 계열 3회째 → 설계 판정으로 질문** | D112 신설(경로 글자 최대 덩어리를 값 어디서나 전부 · 앞 글자 조건 없음 · 덩어리 통째 검증) · D95 정정 표기 · AC⑤-4 에 공백 없는 나열 3꼴·두 번째만 부재 · node 13개 값 실측 · `4a4e1d0` · 대장 #6 |
| C2-1 | spec §3.⑤-2·D112 · (C2 회귀 — R3-1 수정의 회귀) 앞 경계 제거로 `C:\docs/specs/a.md`·`..\docs/specs/a.md` 의 뒷부분 `docs/specs/a.md` 가 후보·글롭 통과 → 다른 문서를 pinned 기준선으로 확보(드라이브·역슬래시·상위 경로 배제 위반) · 원 경로 전체를 거부 | medium | FIXED (추천 자동 채택(위임)) — `[자동 채택(위임)]` 확인 임무 ③ 우선 감사 · 재진입 확인 blocking → ESCALATE(규칙) + D112 감사 이의 → `[감사 이의]` 재질문 | 「허용 구분자 토큰 통째 검증」 — 허용 구분자(공백류·`,`·`;`·`(`·`)`·`「`·`」`·`'`·`"`·`·`)로만 나누고 목록 밖 글자가 붙은 토큰은 통째 탈락 · D112 재작성 · AC⑤-4 비정규 5꼴+한글 조사 · §6 한계 1줄 · node 17개 값 실측 · `eea885c` · 대장 #7 · **새 세션 whole-branch 리뷰 권고 → 8 review-loop(impl)(전체 브랜치 diff)로 갈음** |

**라운드 기록**

- **R1(적대 1/5, 자동 모드 — 대상 HEAD `32908b5`)**: 유효(명령 로그 24건 · verdict needs-attention) · 신규 blocking 7(high 2 · medium 5) · DUPLICATE 0 · low 0 · **전환용 score = 11**(산식 = 분류 직후·수정 전, 미확인 FIXED 큐 제외 — FIXED 후보 medium 4 + 위험군 ESCALATE high 2·medium 1) · 위험군 3건(R1-1·R1-2 = 보안 접촉면 즉시군, R1-7 = D96 문구 변경)은 질문 → 메인이 추천안 입력(추천 자동 채택(위임)) · 적대 소진 1 = auto-rounds → batch flush(적재 0건) · 이후 정밀 모드 · 미확인 FIXED 큐 7(R1-1~R1-7).
- **R2(적대 2/5, 정밀 모드 — 대상 HEAD `354d834`)**: 유효(명령 로그 25건 · verdict needs-attention) · 신규 blocking 1(medium — R2-1, ④ 병합의 사람 확인 게이트 우회 · 새 계열) · DUPLICATE 0 · R1 항목 7건 적대 비재출현(R2 — 참고 신호, 큐 유지) · **전환용 score = 1**(위험군 ESCALATE medium 1 — D94 조건 변경이라 질문 → 메인이 추천안 입력(추천 자동 채택(위임))) · 미확인 FIXED 큐 8(R1-1~R1-7 · R2-1).
- **C1(확인 1/2, 완전 응답 — 대상 HEAD `eec8d2f`, 전환 신호 2 = R2 분류 뒤 신규 FIXED 후보 0)**: 명령 로그 22건 · 소멸 확인 = R1-1·R1-2·R1-4·R1-5·R1-6·R1-7·R2-1(7건 명시 「소멸」) · **R1-3 잔존**(medium — 점 둘 이상 꼴 접두 오해소) · 회귀 없음 · 신규 finding 없음 · 감사: D91~D108 이상 없음 · R1-1·D109·D110·D111 이상 없음 · R1-4·R1-5·R1-6 이상 없음 · **R1-3 이의**(과소 대응) → `[감사 이의]` 재질문 → 메인이 추천안 입력(사용자 지시 10-22 강화·22:43 — 추천 자동 채택(위임), 대장 #5) 「토큰 전체 검증으로 다시 고친다」 → `f6a55fe` · verdict **merge-ready: no**(R1-3 잔존) → **복귀 적대 1(상한 밖 예약분) + 재진입 확인 1(예약분)** · 미확인 FIXED 큐 1(R1-3).
- **R3(복귀 적대 — 상한 밖 예약분 · 대상 HEAD `71e3754`)**: 유효(명령 로그 28건 · verdict needs-attention) · 신규 blocking 1(medium — R3-1, ⑤ 경로 추출 계열 3회째: R1-3 → C1 잔존 → R3-1) → 계열 반복 규칙으로 설계 판정 질문 → 메인이 추천안 입력(추천 자동 채택(위임), 대장 #6) · **전환용 score = 1** · 적대 소진 2/5 불변(예약분) · 미확인 FIXED 큐 2(R1-3 · R3-1) → 재진입 확인 C2(예약분).
- **C2(재진입 확인 — 예약분 · 완전 응답 — 대상 HEAD `3a05a37`)**: 명령 로그 20건 · 소멸 확인 = R1-3·R3-1(명시 「소멸」) · **회귀 1(medium — C2-1)** · 신규 finding 없음 · 감사: R1-3 재판정 이상 없음 · **D112 이의** · verdict **merge-ready: no** → 재진입 확인 blocking 이라 규칙상 ESCALATE(새 세션 whole-branch 리뷰 권고 동반) + `[감사 이의]` 재질문 → 메인이 추천안 입력(사용자 지시 10-22 강화·22:43 — 추천 자동 채택(위임), 대장 #7) 「허용 구분자 토큰 통째 검증」 → `eea885c` · 확인 소진 1/2 불변(예약분) · 복귀 사용됨 · 미확인 FIXED 큐 1(C2-1) → 일반 확인 예산 잔여 1 로 C3.
- **C3(확인 2/2, 완전 응답 — 대상 HEAD `56ea0aa`)**: 명령 로그 17건 · 소멸 확인 = C2-1(명시 「소멸」) · 회귀 없음(§3.⑤-2 절차를 28개 입력에 적용 — 4개 계열 모두 닫힘, AC⑤-4·§4·§6·D블록 정합) · 신규 finding 없음 · 감사: D112 이상 없음 · verdict **merge-ready: yes** → 미확인 FIXED 큐 0 · 성공 종료.

**종결(2026-10-23)**: review-loop(spec) **성공 종료** — 적대 3(R1·R2 일반 2/5 + 복귀 R3 예약분) · 확인 3(C1·C3 일반 2/2 + 재진입 C2 예약분) · 복귀 사용 · 전환 = R2 뒤 신호 2(수정 큐 소진) · blocking 10건 전부 FIXED(루프 판정 4 = R1-3(→ 감사 이의 재판정)·R1-4·R1-5·R1-6 · 추천 자동 채택(위임) 7 = 대장 #1~#7 — R1-3 은 두 쪽에 걸침) · ACCEPTED·DEFERRED_TO_IMPL·OUT_OF_SCOPE·DUPLICATE 0 · low 0 · 신설 D109~D112(D92·D94·D95·D96 정정 표기) · ⑤ 경로 추출 계열 4회(R1-3 → C1 잔존 → R3-1 → C2-1)는 D112 허용 구분자 방식으로 C3 에서 닫힘 · C2 의 「새 세션 whole-branch 리뷰 권고」는 8 review-loop(impl)(base 대비 전체 브랜치 diff)로 갈음 · 감사 미수행 0건 · **미확인 FIXED 큐 0 · 미판정 blocking 0 · 최종 verdict pass**(C3 merge-ready: yes).

## 확인 대기 대장

| # | 일시 | phase·지점 | 질문 요지(쉬운 말 1줄) | 채택 선택지 | 출처 | 상태 |
|---|---|---|---|---|---|---|
| 1 | 2026-10-23 23:1x | spec · R1 즉시 ESCALATE | Codex 에 「팩 B 에 없는 경로는 읽지 마라」를 넣으면 코드도 못 읽는다 — 금지 범위를 좁힐까? (R1-1) | 금지 범위를 좁힌다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23, 사용자 지시 22:43로 메인 대리) |
| 2 | 2026-10-23 23:1x | spec · R1 즉시 ESCALATE | 포인터를 주기 전 디스크 파일이 링크·다른 내용이 아닌지 확인할까? (R1-2) | 포인터 전에 실물 확인 (FIXED) — D109 | 추천 자동 채택(위임) | 확인 (2026-10-23, 사용자 지시 22:43로 메인 대리) |
| 3 | 2026-10-23 23:1x | spec · R1 위험군(D96 문구) | 보완 문구의 절 이름을 실제 제목 대신 일치한 별칭 이름으로 쓸까? (R1-7) | 일치한 별칭 이름을 쓴다 (FIXED) — D110 | 추천 자동 채택(위임) | 확인 (2026-10-23, 사용자 지시 22:43로 메인 대리) |
| 4 | 2026-10-23 23:2x | spec · R2 위험군(D94 조건) | 리뷰어가 아직 확인하지 않은 차단 후보도 기계 증거와 같으면 병합할까, 확인 뒤에만 병합할까? (R2-1) | 확인 뒤에만 병합 (FIXED) — D111 | 추천 자동 채택(위임) | 확인 (2026-10-23, 사용자 지시 22:43로 메인 대리) |
| 5 | 2026-10-23 23:2x | spec · C1 감사 이의 재판정 | 루프가 고친 기준선 경로 규칙이 점 두 개 꼴에서 여전히 다른 문서를 잡는다 — 토큰 전체 검증으로 다시 고칠까? (R1-3) | 토큰 전체 검증으로 다시 고친다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23, 사용자 지시 22:43로 메인 대리) |
| 6 | 2026-10-23 23:3x | spec · R3(복귀) 계열 반복 설계 판정 | 쉼표로 붙여 쓴 두 번째 기준선 경로가 빠진다 — 경로 글자 덩어리를 어디서나 전부 찾아 통째로 검증할까? (R3-1) | 앞 경계 없이 덩어리 전부 (FIXED) — D112 | 추천 자동 채택(위임) | 확인 (2026-10-23, 사용자 지시 22:43로 메인 대리) |
| 7 | 2026-10-23 23:4x | spec · C2 재진입 확인 ESCALATE + 감사 이의 재판정 | 쉼표 나열을 고치다 생긴 회귀(윈도우·상위 폴더 경로 뒷부분을 기준선으로 잡음) — 허용 구분자로만 나눈 토큰을 통째로 검증할까? (C2-1 · D112) | 허용 구분자 토큰 통째 검증 (FIXED) — D112 정정 | 추천 자동 채택(위임) | 확인 (2026-10-23, 사용자 지시 22:43로 메인 대리) |
