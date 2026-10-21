# task-08 — README 3종 · manifest description (spec §1 · §6 · P6)

**목적**: 설치 사용자가 `mr-review`를 발견·설정·실행할 수 있게 README 3개 언어에 표 행·목차·절·트리·테스트 명령을 추가하고, `plugin.json`·`marketplace.json`의 description에 한 구절을 더한다. **version은 올리지 않는다**(릴리스 task-09).

## Files

- Modify: `README.ko.md` · `README.md` · `README.ja.md`
- Modify: `dev-workflow/.claude-plugin/plugin.json`(description만) · `.claude-plugin/marketplace.json`(description만)

## Prep

- `README.ko.md`의 현재 구조: 상단 도구 표 → 목차 → 요구사항 → 설치 → 사용법(1~9) → 특정 repo 자동 적용 → 트러블슈팅 → 주의 → 개발/릴리스(트리·테스트 명령·3개 언어 규칙). 세 파일은 **같은 행 위치**를 유지한다(이전 트랙 선례).
- task-07 SKILL.md(인자·경계·절차)를 요약해 쓴다. 프로젝트 식별자 금지(SC-7 T6 — README도 대상).

## Deps

07

## Steps

### 1. `README.ko.md`

(a) 상단 도구 표 — `orchestrate` 행 **다음**에 추가:

```markdown
| mr-review | skill | `/dev-workflow:mr-review <프로젝트> <iid>` | (1.3.0 이상) **남의 MR**을 읽기 전용으로 리뷰 — 작성 규칙 기계 검사 · 리뷰 head 고정 · 두 모델(Claude 서브에이전트 + Codex task) 독립 검토 · 팀 정책 판정 4종 형식의 초안 리포트. 프로젝트 어댑터 문서 필요 |
```

(b) 목차 — `- [orchestrate](#8-orchestrate--메인-세션의-트랙-운영)` 다음 줄에 추가:

```markdown
  - [mr-review](#10-mr-review--남의-mr-두-모델-리뷰-초안)
```

(c) 요구사항 절 끝에 추가:

```markdown
- **`glab` CLI(인증 완료)** — `mr-review`가 GitLab REST를 `glab api`로 읽는다(GET만). 다른 스킬은 `glab` 없이 동작한다.
```

(d) 사용법 — `### 9. 컨텍스트 임계 핸드오프 훅 (자동)` 절 **뒤**(다음 `## ` 제목 앞)에 새 절:

````markdown
### 10. `mr-review` — 남의 MR 두 모델 리뷰 초안

지정된 리뷰어가 MR 번호 하나로 **판정 초안 리포트**를 받는다. 저장소도 GitLab도 바꾸지 않는다(댓글·승인은 사람이 한다). 자기 spec/plan/구현을 고치는 `review-loop`와 다르다.

```
/dev-workflow:mr-review <프로젝트> <iid> [--adapter <어댑터 파일>] [--full] [--diff-only] [--resolve <id>=confirmed|dismissed …]
```

- **어댑터 문서 필수** — 프로젝트의 공통 문서 저장소에 두는 마크다운 한 파일(`--adapter` 또는 환경변수 `MR_REVIEW_ADAPTER`). 저장소 ID·정책 문서·렌즈·문서 지도·위키 루트(전송 허용/금지)·마스킹 패턴·배포 대상 규칙·댓글 형식·리포트 경로를 담는다. 스크립트는 그 안의 ```` ```json mr-review-adapter ```` 기계 블록만 읽고, 모델은 산문(렌즈·정책 설명)을 읽는다. 플러그인에는 프로젝트 고유 값이 없다.
- 흐름: `glab api`로 수집 → target·MR head를 fetch해 **API head = fetch head** 확인·세 SHA 고정(임시 워크트리) → 작성 규칙 검사표(계약 10줄·기준선·변경 사유·첨부·리베이스·댓글 신뢰) → 배포본 zip 대조(주석 SHA·목록·바이트·삭제 목록, 자체 zip 리더) → 컨텍스트 팩(공통 문서 절 발췌·위키·기준선 원문, Codex용 팩은 허용 출처 + 개인정보 마스킹 — 실패 시 Codex 생략) → Claude 서브에이전트·Codex `task` **독립 병렬** → 메인 병합 → 정책 순서로 판정 계산 → 리포트(정책 실행 블록 그대로, 전체 마스킹) → 임시 산출물 정리.
- 작성 규칙 미충족(계약 미완·기준선 없음)이면 검토 없이 **조기 종료** 리포트(초안 판정 + 작성자 보완 요청 문안). `--full`이면 끝까지 가되 미완은 증거 부족으로 남는다.
- 두 모델이 상충하거나 한쪽만 낮은 확신으로 잡은 차단 후보를 메인이 코드로 확인 못 하면 **판정 미확정** — 게시용 블록 없이 두 갈래를 보여 주고, 리뷰어가 `--resolve <id>=confirmed|dismissed`로 확정한다.
- Codex 플러그인·`glab`이 없으면: `glab` 없이는 돌지 않고, Codex가 없으면 **단일 모델 모드**(리포트 헤더에 「교차 검토 없음」).
- 테스트·빌드는 실행하지 않는다(검증 상태 전부 `[판독]`). 배포본 zip 대조만 스킬이 직접 수행한다.
````

(e) 개발/릴리스 트리 — `│   ├── skills/orchestrate/{…}` 줄 다음에 추가:

```
│   ├── skills/mr-review/{SKILL.md,scripts/mr-review.mjs,scripts/lib/{adapter,gitlab,collect,check,deploy,pack,report}.mjs}
```

그리고 `├── tests/orchestrate/ …` 줄 다음에:

```
├── tests/mr-review/                  # mr-review 테스트(가짜 glab + 로컬 bare git — 플러그인 밖)
```

(f) 테스트 명령 줄을 다음으로 바꾼다:

```markdown
테스트: `node --test tests/orchestrate/orchestrate.test.mjs`(orchestrate — 스텁 `orca`) · `node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs tests/mr-review/deploy.test.mjs tests/mr-review/pack.test.mjs tests/mr-review/report.test.mjs`(mr-review — 가짜 `glab`·로컬 bare git, 실제 GitLab·오르카 불필요). 이 repo에는 npm 게이트가 없다(폴더 인자 금지 — Node 21 이상은 모듈 경로로 해석).
```

### 2. `README.md`(영어) — 같은 위치에 같은 구조

(a) 표 행:

```markdown
| mr-review | skill | `/dev-workflow:mr-review <project> <iid>` | (1.3.0+) Read-only review of **someone else's MR** — deterministic authoring-rule checks · pinned review head · two independent model reviews (Claude subagent + Codex task) · draft report in the team policy's four-verdict format. Requires a project adapter document |
```

(b) TOC: `  - [mr-review](#10-mr-review--two-model-review-draft-for-someone-elses-mr)`

(c) Requirements: `- **\`glab\` CLI (authenticated)** — \`mr-review\` reads the GitLab REST API via \`glab api\` (GET only). The other skills work without \`glab\`.`

(d) 절:

````markdown
### 10. `mr-review` — two-model review draft for someone else's MR

A designated reviewer gets a **draft verdict report** from one MR number. Nothing in the repository or GitLab is changed (comments and approval are done by a human). It is different from `review-loop`, which fixes your own spec/plan/implementation.

```
/dev-workflow:mr-review <project> <iid> [--adapter <adapter file>] [--full] [--diff-only] [--resolve <id>=confirmed|dismissed …]
```

- **Adapter document required** — one Markdown file kept in the project's shared docs repository (`--adapter` or env `MR_REVIEW_ADAPTER`). It carries repository IDs, policy documents, review lenses, doc map, wiki roots (export allowed/forbidden), masking patterns, deploy-target rules, comment formats and the report directory. Scripts read only its ```` ```json mr-review-adapter ```` machine block; models read the prose (lenses, policy notes). The plugin holds no project-specific values.
- Flow: collect via `glab api` → fetch target and MR head, confirm **API head = fetched head**, pin three SHAs (temporary worktree) → authoring-rule table (10 contract lines, baseline, change reason, attachments, rebase, comment trust) → deploy-zip comparison (comment SHA, file list, bytes, deletion list — built-in zip reader) → context packs (section excerpts of shared docs, wiki, baseline originals; the Codex pack holds allowed sources only, with PII masking — Codex is skipped if masking fails) → Claude subagent and Codex `task` **independently in parallel** → merged by the main session → verdict computed in policy order → report (the policy execution block verbatim, fully masked) → temporary artifacts removed.
- If authoring rules are unmet (incomplete contract, no baseline) it **exits early** with a draft verdict plus a request-for-completion note for the author, without running the reviewers. With `--full` it runs to the end; the gaps remain as missing evidence.
- When the two models conflict, or only one flags a low-confidence blocker, and the main session cannot confirm it from code, the verdict is **undetermined** — no postable block, both branches are shown, and the reviewer settles it with `--resolve <id>=confirmed|dismissed`.
- Without the Codex plugin or `glab`: it does not run without `glab`; without Codex it runs in **single-model mode** (report header says "no cross-check").
- Tests and builds are never executed (every verification status is "read"). Only the deploy-zip comparison is performed by the skill itself.
````

(e) 트리 두 줄(동일 영문 주석: `# mr-review tests (fake glab + local bare git — outside the plugin)`), (f) 테스트 명령 줄 영문:

```markdown
Tests: `node --test tests/orchestrate/orchestrate.test.mjs` (orchestrate — stub `orca`) · `node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs tests/mr-review/deploy.test.mjs tests/mr-review/pack.test.mjs tests/mr-review/report.test.mjs` (mr-review — fake `glab` and a local bare git repo; no real GitLab or Orca needed). This repo has no npm gate (do not pass a directory — Node 21+ treats it as a module path).
```

### 3. `README.ja.md`(일본어) — 같은 위치에 같은 구조

(a) 표 行:

```markdown
| mr-review | skill | `/dev-workflow:mr-review <プロジェクト> <iid>` | (1.3.0 以上) **他人の MR** を読み取り専用でレビュー — 作成ルールの機械チェック · レビュー head の固定 · 2 モデル（Claude サブエージェント + Codex task）の独立レビュー · チームポリシーの判定 4 種形式のドラフトレポート。プロジェクトのアダプター文書が必要 |
```

(b) 目次: `  - [mr-review](#10-mr-review--他人の-mr-の-2-モデルレビュードラフト)`

(c) 要件: `- **\`glab\` CLI（認証済み）** — \`mr-review\` が GitLab REST を \`glab api\` で読む（GET のみ）。他のスキルは \`glab\` なしで動く。`

(d) 節:

````markdown
### 10. `mr-review` — 他人の MR の 2 モデルレビュードラフト

指名されたレビュアーが MR 番号ひとつで **判定ドラフトのレポート** を受け取る。リポジトリも GitLab も変更しない（コメント・承認は人が行う）。自分の spec/plan/実装を直す `review-loop` とは別物。

```
/dev-workflow:mr-review <プロジェクト> <iid> [--adapter <アダプターファイル>] [--full] [--diff-only] [--resolve <id>=confirmed|dismissed …]
```

- **アダプター文書が必須** — プロジェクトの共通文書リポジトリに置く Markdown 1 ファイル（`--adapter` または環境変数 `MR_REVIEW_ADAPTER`）。リポジトリ ID・ポリシー文書・レンズ・文書マップ・wiki ルート（送信許可/禁止）・マスキングパターン・デプロイ対象ルール・コメント形式・レポート出力先を持つ。スクリプトはその中の ```` ```json mr-review-adapter ```` 機械ブロックだけを読み、モデルは散文（レンズ・ポリシー説明）を読む。プラグインにはプロジェクト固有の値はない。
- 流れ: `glab api` で収集 → target と MR head を fetch し **API head = fetch head** を確認、3 つの SHA を固定（一時 worktree） → 作成ルール表（契約 10 行・ベースライン・変更理由・添付・リベース・コメント信頼） → デプロイ zip 照合（コメント SHA・ファイル一覧・バイト・削除一覧、内蔵 zip リーダー） → コンテキストパック（共通文書の節抜粋・wiki・ベースライン原文。Codex 用パックは許可ソースのみ + 個人情報マスキング、失敗時は Codex をスキップ） → Claude サブエージェントと Codex `task` を **独立に並列** → メインが統合 → ポリシー順で判定を計算 → レポート（ポリシー実行ブロックをそのまま、全体マスキング） → 一時成果物を削除。
- 作成ルール未達（契約未完・ベースラインなし）なら、レビューせずに **早期終了** レポート（ドラフト判定 + 作成者への補完依頼文）。`--full` なら最後まで進むが、未達は証拠不足として残る。
- 2 モデルが対立する、または片方だけが低確信のブロッカーを挙げ、メインがコードで確認できない場合は **判定未確定** — 投稿用ブロックなしで両分岐を示し、レビュアーが `--resolve <id>=confirmed|dismissed` で確定する。
- Codex プラグイン・`glab` がない場合: `glab` なしでは動かず、Codex なしは **単一モデルモード**（レポートヘッダーに「クロスレビューなし」）。
- テスト・ビルドは実行しない（検証状態はすべて「判読」）。デプロイ zip 照合だけはスキル自身が行う。
````

(e) ツリー 2 行(注釈 `# mr-review テスト（偽 glab + ローカル bare git — プラグイン外）`), (f) テストコマンド行:

```markdown
テスト: `node --test tests/orchestrate/orchestrate.test.mjs`（orchestrate — スタブ `orca`）· `node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs tests/mr-review/deploy.test.mjs tests/mr-review/pack.test.mjs tests/mr-review/report.test.mjs`（mr-review — 偽 `glab` とローカル bare git。実際の GitLab・Orca は不要）。この repo に npm ゲートはない（ディレクトリ引数は禁止 — Node 21 以上はモジュールパスとして解釈）。
```

### 4. manifest description

`dev-workflow/.claude-plugin/plugin.json`의 `description` 값 끝 `컨텍스트 임계 핸드오프 넛지(Stop 훅).` 앞에 `남의 MR 두 모델 독립 리뷰 초안(mr-review), ` 를 넣는다 — 결과:

```
"… 오케스트레이터 공통 절차(orchestrate), 남의 MR 두 모델 독립 리뷰 초안(mr-review), 컨텍스트 임계 핸드오프 넛지(Stop 훅)."
```

`.claude-plugin/marketplace.json`의 플러그인 `description`도 같은 구절을 같은 자리에 넣는다(파일을 열어 현재 문장을 확인하고 `orchestrate)` 뒤에 삽입). `version`은 **건드리지 않는다**.

### 5. 검증 · 커밋(2건 — README · manifest)

```bash
for f in README.md README.ko.md README.ja.md; do echo "$f $(grep -c 'mr-review' "$f")"; done     # 세 파일 모두 ≥ 8
grep -n '^### 10\.' README.md README.ko.md README.ja.md                                           # 세 파일 각 1줄, 같은 행 번호 ±2
grep -rnE '(172\.|safetyreport|안전신문고|kimkfc|gguii)' README*.md | wc -l                           # 0
node -e 'for (const f of ["dev-workflow/.claude-plugin/plugin.json",".claude-plugin/marketplace.json"]) { const j=JSON.parse(require("fs").readFileSync(f,"utf8")); const d=JSON.stringify(j); if(!/mr-review/.test(d)) throw new Error(f); } console.log("MANIFEST_OK")'
grep -n '"version"' dev-workflow/.claude-plugin/plugin.json                                        # 1.2.1 그대로
```

```bash
git add README.md README.ko.md README.ja.md
git commit -m "docs(readme): mr-review 스킬 — 표·목차·요구사항·절 10·트리·테스트 명령 (3개 언어)"
git add dev-workflow/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "docs(manifest): description 에 mr-review 추가 (version 유지)"
```

## Acceptance Criteria

- 세 README에 표 행·목차·요구사항·절 10·트리·테스트 명령이 같은 위치에 있고 `mr-review` 언급 ≥ 8.
- manifest 2종 description에 `mr-review` 포함, `version` 1.2.1 불변.
- 프로젝트 식별자 0건.

## Cautions

- **version을 올리지 마라. 이유:** P6 — 릴리스는 task-09(SDD 밖). 여기서 올리면 설치 사용자가 리뷰 전 코드를 받는다.
- **세 README를 한 파일만 고치지 마라. 이유:** 「3개 언어로 유지」 규칙 — 드리프트.
- **README에 어댑터 예시로 실제 프로젝트 값을 쓰지 마라. 이유:** D10 — 기계 블록 키만 설명한다.
- (impl 2026-10-21 전사 수정, PF-10) 목차 §10 링크는 기존 §9 줄 뒤에 넣는다 · README 3종 `--resolve` 설명에 `confirmed:fixable|confirmed:design` 포함
