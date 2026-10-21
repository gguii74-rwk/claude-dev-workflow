# task-01 — 테스트 하네스 · 어댑터 파서 · CLI 골격 (spec §4 · SC-2 · SC-6)

**목적**: 어댑터 문서의 기계 블록(SC-2)을 읽어 검증·경로 해소·glob 대조를 제공하는 `adapter.mjs`와, 서브커맨드를 dispatch하는 CLI 골격 `mr-review.mjs`를 만들고, 이후 task들이 공유할 테스트 헬퍼(가짜 `glab`·로컬 bare git·픽스처 어댑터)를 둔다.

## Files

- Create: `dev-workflow/skills/mr-review/scripts/lib/adapter.mjs`
- Create: `dev-workflow/skills/mr-review/scripts/mr-review.mjs`
- Create: `tests/mr-review/helpers.mjs`
- Create: `tests/mr-review/fixtures/adapter.md`
- Test: `tests/mr-review/adapter.test.mjs`

## Prep

- spec §4(어댑터 계약 4.1~4.9) · §3(제약 — `glab api`) · D10(프로젝트 식별자 금지).
- 엔트리포인트 **SC-1**(경로) · **SC-2**(기계 블록 — 이 task가 정본을 구현한다) · **SC-6**(CLI 출력 규약) · **SC-7**(T6 — 픽스처에도 실제 프로젝트 식별자를 쓰지 않는다).
- 이 repo의 테스트 선례: `tests/orchestrate/orchestrate.test.mjs`(가짜 CLI를 PATH 앞에 두는 방식) — 같은 방식으로 가짜 `glab`을 둔다. 실행은 `node --test <파일>`(폴더 인자 금지).

## Deps

없음

## Steps

### 1. 픽스처 어댑터 (가상 프로젝트명 `alpha`·`beta`·`docs`만 쓴다)

`tests/mr-review/fixtures/adapter.md`를 아래 내용 그대로 만든다. 산문 절은 LLM용 자리표시자이고, 스크립트는 ```` ```json mr-review-adapter ```` 블록만 읽는다. `workspaceRoot`·`projects[*].path`는 테스트가 임시 디렉터리로 바꿔 쓰므로(헬퍼 `writeAdapter`) 값은 상대 경로 예시다.

````markdown
# 테스트 어댑터 (가상 프로젝트)

> 테스트 전용. 실제 프로젝트 이름·주소·사람 이름을 넣지 않는다.

## 1. 저장소

| 이름 | ID | 경로 |
|---|---|---|
| alpha | 101 | `repos/alpha` |
| beta | 102 | `repos/beta` |
| docs | 103 | `docs` |

## 2. 정책·항상 읽는 절

- `guide/policy.md` — 판정 기준 `TEST-POLICY-v1.1`. 전환기: 계약은 `v1.0`도 허용.

## 3. 렌즈

| ID | 질문 | 발견 유형 |
|---|---|---|
| L1 사유 | 배경에 왜·무엇을이 있는가 | MISSING_EVIDENCE |
| L5 보안 | 하드코딩 비밀·로그 개인정보 | DEFECT(항상 차단) |

## 4. 문서 지도

(기계 블록 참조)

## 5. 위키

(기계 블록 참조)

## 6. 외부 전송 허용 목록

허용: 워크트리 전체 · diff · MR 본문·댓글 · 공통 문서 발췌 · 팀 위키 발췌 · 이 문서. 금지: 개인 위키.

## 7. 운영 배포 대상

(기계 블록 참조)

## 7a. 댓글 형식

(기계 블록 참조)

## 8. 리포트

(기계 블록 참조)

## 기계 블록

```json mr-review-adapter
{
  "schema": 1,
  "workspaceRoot": "..",
  "docsRoot": "docs",
  "projects": {
    "alpha": { "id": 101, "path": "repos/alpha", "deployExempt": false },
    "beta": { "id": 102, "path": "repos/beta", "deployExempt": false },
    "docs": { "id": 103, "path": "docs", "deployExempt": true }
  },
  "policy": {
    "judgeId": "TEST-POLICY-v1.1",
    "acceptedIds": ["TEST-POLICY-v1.0", "TEST-POLICY-v1.1"],
    "docs": ["guide/policy.md#5.", "guide/workflow.md#3.1.1"]
  },
  "contract": { "lines": ["Policy", "Policy source", "Review type", "Reviewer role", "Baseline", "Base SHA", "Review head SHA", "Required acceptance criteria", "Required tests/evidence", "Human reviewer"] },
  "baselineCandidates": ["docs/specs/**", "docs/*-design.md"],
  "docsMap": {
    "always": ["guide/policy.md#0."],
    "rules": [
      { "match": ["**/mapper/**/*.xml", "**/*.sql"], "docs": ["architecture/database.md"] },
      { "match": ["**/auth/**"], "docs": ["security/README.md"] }
    ]
  },
  "wiki": {
    "roots": [
      { "path": "~/wiki-team", "export": true, "glossary": "glossary.md" },
      { "path": "~/wiki-private", "export": false, "glossary": "glossary.md" }
    ],
    "linesPerPage": 8,
    "pagesPerPack": 3
  },
  "mask": [
    { "name": "phone", "pattern": "01[016789]-?\\d{3,4}-?\\d{4}" },
    { "name": "rrn", "pattern": "\\d{6}-?[1-4]\\d{6}" },
    { "name": "email", "pattern": "[\\w.+-]+@[\\w-]+\\.[\\w.-]+" },
    { "name": "token", "pattern": "(?<=(?:token=|Authorization:\\s*))(?:(?:Bearer|Basic|Token|Digest)\\s+)?[^\\s\\]]+" },
    { "name": "otp", "pattern": "(?<=(?:인증번호|OTP)[^\\n]{0,40}?)\\b\\d{6}\\b" }
  ],
  "deploy": {
    "targets": ["src/main/**", "assets/**", "**/*.sql"],
    "excludes": ["docs/**", ".gitlab/**", "AGENTS.md", "CLAUDE.md", "README*", "src/test/**"]
  },
  "comments": {
    "verdictFirstLine": "^리뷰 계약 (?<policy>TEST-POLICY-v1\\.[01]) · head (?<sha>[0-9a-f]{7,40}) · (?<kind>추천 판정\\(초안\\)|사람 판정) (?<verdict>APPROVE|HOLD_EVIDENCE|CHANGES_REQUESTED|RETURN_TO_DESIGN)",
    "baselineConfirm": "^기준선 확인",
    "authorToken": "^(?<token>FIXED|EVIDENCE|BASELINE_UPDATED|REFUTED|FOLLOW_UP_REQUESTED)\\b\\s*(?<arg>\\S+)?",
    "trustedReviewers": ["lead-reviewer"]
  },
  "report": { "dir": "reviews" }
}
```
````

### 2. 테스트 헬퍼

`tests/mr-review/helpers.mjs`를 아래 내용 그대로 만든다. 이후 task의 테스트는 전부 이 파일을 import한다.

````js
// mr-review 테스트 공통 헬퍼 — 가짜 glab(PATH 앞) · 로컬 bare git(origin) + 체크아웃 · 픽스처 어댑터 복제.
// 실행: node --test tests/mr-review/<모듈>.test.mjs (폴더 인자 금지 — Node 21 이상은 모듈 경로로 해석)
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLI = fileURLToPath(new URL('../../dev-workflow/skills/mr-review/scripts/mr-review.mjs', import.meta.url));
export const LIB = fileURLToPath(new URL('../../dev-workflow/skills/mr-review/scripts/lib/', import.meta.url));
const FIXTURE_ADAPTER = fileURLToPath(new URL('./fixtures/adapter.md', import.meta.url));

export function tmp(prefix = 'mrr-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x', GIT_CONFIG_GLOBAL: '/dev/null' } });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${r.stderr}`);
  return r.stdout.trim();
}

// 워크스페이스 뼈대: <root>/adapter/adapter.md (workspaceRoot = ..) · <root>/docs (공통 문서, git) · <root>/repos/alpha (체크아웃)
// 픽스처 어댑터의 기계 블록을 patch(객체 병합 1단계)로 덮어쓴다.
export function writeAdapter(root, patch = {}) {
  const src = readFileSync(FIXTURE_ADAPTER, 'utf8');
  const m = src.match(/```json mr-review-adapter\n([\s\S]*?)\n```/);
  const cfg = JSON.parse(m[1]);
  for (const [k, v] of Object.entries(patch)) cfg[k] = (v && typeof v === 'object' && !Array.isArray(v) && cfg[k] && typeof cfg[k] === 'object' && !Array.isArray(cfg[k])) ? { ...cfg[k], ...v } : v;
  const out = src.replace(m[0], '```json mr-review-adapter\n' + JSON.stringify(cfg, null, 2) + '\n```');
  mkdirSync(join(root, 'adapter'), { recursive: true });
  const file = join(root, 'adapter', 'adapter.md');
  writeFileSync(file, out);
  return file;
}

// 공통 문서 저장소(docsRoot) — 정책·절차·아키텍처 문서 최소본. git 저장소로 만들어 @sha 출처가 나오게 한다.
export function writeDocs(root) {
  const d = join(root, 'docs');
  mkdirSync(join(d, 'guide'), { recursive: true });
  mkdirSync(join(d, 'architecture'), { recursive: true });
  mkdirSync(join(d, 'security'), { recursive: true });
  writeFileSync(join(d, 'guide', 'policy.md'), ['# 정책', '', '## 0. 적용 방식', '', '계약 10줄.', '', '## 5. MR 리뷰 판정', '', '판정 4종.', '', '### 5.1 발견 유형', '', 'DEFECT 등.', '', '## 6. 증거', '', '증거 기준.', ''].join('\n'));
  writeFileSync(join(d, 'guide', 'workflow.md'), ['# 절차', '', '### 3.1.1 변경 사유 기록', '', '①왜 ②무엇을 ③결정.', '', '### 3.2 Plan', '', '정식만.', ''].join('\n'));
  writeFileSync(join(d, 'architecture', 'database.md'), ['# DB', '', '공유 테이블 TBL_X.', ''].join('\n'));
  writeFileSync(join(d, 'security', 'README.md'), ['# 보안', '', '취약점 트랙.', ''].join('\n'));
  git(d, 'init', '-q', '-b', 'master');
  git(d, 'add', '.');
  git(d, 'commit', '-q', '-m', 'docs');
  return { dir: d, sha: git(d, 'rev-parse', 'HEAD') };
}

// origin(bare) + 체크아웃(repos/alpha). master에 기준 파일, feat 브랜치에 MR 변경 3종(수정·추가·삭제) + 문서 1건.
// refs/merge-requests/<iid>/head 를 bare에 만든다. 반환: { bare, checkout, baseSha, headSha, targetSha }
export function initRepos(root, { iid = 7, extraHeadFiles = {} } = {}) {
  const bare = join(root, 'origin.git');
  mkdirSync(bare, { recursive: true });
  git(bare, 'init', '-q', '--bare', '-b', 'master');
  const seed = join(root, 'seed');
  mkdirSync(seed, { recursive: true });
  git(seed, 'init', '-q', '-b', 'master');
  mkdirSync(join(seed, 'src', 'main', 'java', 'app'), { recursive: true });
  mkdirSync(join(seed, 'src', 'main', 'resources', 'mapper'), { recursive: true });
  mkdirSync(join(seed, 'docs', 'specs'), { recursive: true });
  writeFileSync(join(seed, 'src', 'main', 'java', 'app', 'A.java'), 'class A { int v = 1; }\n');
  writeFileSync(join(seed, 'src', 'main', 'java', 'app', 'Old.java'), 'class Old {}\n');
  writeFileSync(join(seed, 'src', 'main', 'resources', 'mapper', 'XMapper.xml'), '<mapper><select id="selectX">SELECT 1 FROM TBL_X</select></mapper>\n');
  writeFileSync(join(seed, 'README.md'), '# alpha\n');
  git(seed, 'add', '.');
  git(seed, 'commit', '-q', '-m', 'base');
  const baseSha = git(seed, 'rev-parse', 'HEAD');
  git(seed, 'checkout', '-q', '-b', 'feat');
  writeFileSync(join(seed, 'src', 'main', 'java', 'app', 'A.java'), 'class A { int v = 2; }\n');
  writeFileSync(join(seed, 'src', 'main', 'java', 'app', 'B.java'), 'class B { String phone = "010-1234-5678"; }\n');
  rmSync(join(seed, 'src', 'main', 'java', 'app', 'Old.java'));
  writeFileSync(join(seed, 'docs', 'specs', '2026-10-01-feature.md'), '# feature spec\n\n결정사항: v를 2로.\n');
  for (const [p, c] of Object.entries(extraHeadFiles)) { mkdirSync(dirname(join(seed, p)), { recursive: true }); writeFileSync(join(seed, p), c); }
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'feat: v2');
  const headSha = git(seed, 'rev-parse', 'HEAD');
  git(seed, 'remote', 'add', 'origin', bare);
  git(seed, 'push', '-q', 'origin', 'master', 'feat');
  git(bare, 'update-ref', `refs/merge-requests/${iid}/head`, headSha);
  const checkout = join(root, 'repos', 'alpha');
  mkdirSync(join(root, 'repos'), { recursive: true });
  git(root, 'clone', '-q', bare, checkout);
  rmSync(seed, { recursive: true, force: true });
  return { bare, checkout, baseSha, headSha, targetSha: baseSha };
}

// 가짜 glab: `glab api [--paginate] <path>` 호출을 시나리오 규칙(정규식 → 응답)과 대조한다. 호출 기록은 <scenario>.log.
// 규칙: { match: '<정규식 — 인자 join(" ")>', json?: any, text?: string, file?: '<경로(바이너리)>', code?: 0, times?: n }
const FAKE_GLAB = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const scPath = process.env.FAKE_GLAB_SCENARIO;
const sc = JSON.parse(fs.readFileSync(scPath, 'utf8'));
const statePath = scPath + '.state';
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : { used: {} };
fs.appendFileSync(scPath + '.log', JSON.stringify(args) + '\\n');
const joined = args.join(' ');
let hit = null, idx = -1;
for (let i = 0; i < sc.rules.length; i++) {
  const r = sc.rules[i];
  const used = state.used[i] || 0;
  if (new RegExp(r.match).test(joined) && (r.times == null || used < r.times)) { hit = r; idx = i; break; }
}
if (!hit) { process.stdout.write(JSON.stringify({ message: '404 Not Found (fake: no rule for ' + joined + ')' })); process.stderr.write('glab: HTTP 404\\n'); process.exit(1); }
state.used[idx] = (state.used[idx] || 0) + 1;
fs.writeFileSync(statePath, JSON.stringify(state));
if (hit.file) process.stdout.write(fs.readFileSync(hit.file));
else if (hit.text != null) process.stdout.write(hit.text);
else process.stdout.write(JSON.stringify(hit.json == null ? null : hit.json));
process.exit(hit.code || 0);
`;

export function fakeGlab(root, rules) {
  const dir = join(root, 'fakebin');
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, 'glab');
  writeFileSync(bin, FAKE_GLAB);
  chmodSync(bin, 0o755);
  const scenario = join(dir, 'scenario.json');
  writeFileSync(scenario, JSON.stringify({ rules }));
  return {
    bin, scenario,
    env: { MR_REVIEW_GLAB: bin, FAKE_GLAB_SCENARIO: scenario },
    calls: () => (existsSync(scenario + '.log') ? readFileSync(scenario + '.log', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []),
  };
}

// CLI 실행 — stdout 첫 줄·전체·exit code
export function runCli(args, env = {}, cwd = process.cwd()) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, ...env } });
  const out = (r.stdout || '').trim();
  return { code: r.status, first: out.split('\n')[0] || '', out, err: r.stderr || '' };
}

export function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}
````

### 3. 테스트 작성 (RED)

`tests/mr-review/adapter.test.mjs`를 아래 내용 그대로 만든다.

````js
// adapter.mjs 계약 테스트 (SC-2) + CLI 골격 (SC-6 공통 규약)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmp, writeAdapter, runCli, LIB } from './helpers.mjs';

const { loadAdapter, extractBlock, globToRegExp, matchesAny, AdapterError } = await import(join(LIB, 'adapter.mjs'));

test('기계 블록 하나를 추출하고 필수 키를 검증한다', () => {
  const root = tmp();
  const file = writeAdapter(root);
  const a = loadAdapter(file);
  assert.equal(a.schema, 1);
  assert.equal(a.projects.alpha.id, 101);
  assert.equal(a.resolved.workspaceRoot, root);
  assert.equal(a.resolved.docsRoot, join(root, 'docs'));
  assert.equal(a.resolved.reportDir, join(root, 'reviews'));
  assert.equal(a.resolved.projects.alpha.checkout, join(root, 'repos', 'alpha'));
  assert.equal(a.resolved.projects.docs.deployExempt, true);
  assert.equal(a.contract.lines.length, 10);
});

test('블록이 없거나 둘 이상이면 AdapterError', () => {
  assert.throws(() => extractBlock('# no block\n'), AdapterError);
  const two = '```json mr-review-adapter\n{}\n```\n\n```json mr-review-adapter\n{}\n```\n';
  assert.throws(() => extractBlock(two), /둘 이상/);
});

test('필수 키 누락은 누락 키 이름을 담아 던진다', () => {
  const root = tmp();
  const file = writeAdapter(root, { report: { dir: undefined } });   // writeAdapter 는 1단계 병합이라 {} 로는 키가 안 지워진다 — undefined 로 비운다
  assert.throws(() => loadAdapter(file), (e) => e instanceof AdapterError && /report\.dir/.test(e.message));
  const file2 = writeAdapter(root, { comments: { verdictFirstLine: '^x$', baselineConfirm: '^y', authorToken: '^(?<token>A)', trustedReviewers: [] } });
  assert.throws(() => loadAdapter(file2), /verdictFirstLine/);
});

test('wiki 루트의 ~ 는 MR_REVIEW_HOME 으로 해소한다', () => {
  const root = tmp();
  const home = join(root, 'home');
  mkdirSync(home, { recursive: true });
  process.env.MR_REVIEW_HOME = home;
  try {
    const a = loadAdapter(writeAdapter(root));
    assert.equal(a.resolved.wikiRoots[0].path, join(home, 'wiki-team'));
    assert.equal(a.resolved.wikiRoots[0].export, true);
    assert.equal(a.resolved.wikiRoots[1].export, false);
    assert.equal(a.resolved.wikiRoots[0].glossaryFile, join(home, 'wiki-team', 'glossary.md'));
  } finally {
    delete process.env.MR_REVIEW_HOME;
  }
});

test('workspaceRoot 절대 경로도 허용한다', () => {
  const root = tmp();
  const file = writeAdapter(root, { workspaceRoot: join(root, 'elsewhere') });
  const a = loadAdapter(file);
  assert.equal(a.resolved.workspaceRoot, join(root, 'elsewhere'));
});

test('glob: ** · * · ? · 리터럴', () => {
  assert.ok(globToRegExp('src/main/**').test('src/main/java/app/A.java'));
  assert.ok(globToRegExp('src/main/**').test('src/main'));
  assert.ok(!globToRegExp('src/main/**').test('src/test/java/A.java'));
  assert.ok(globToRegExp('**/mapper/**/*.xml').test('src/main/resources/mapper/XMapper.xml'));
  assert.ok(globToRegExp('**/mapper/**/*.xml').test('mapper/X.xml'));
  assert.ok(!globToRegExp('**/mapper/**/*.xml').test('src/mapper/X.xmlx'));
  assert.ok(globToRegExp('README*').test('README.ko.md'));
  assert.ok(!globToRegExp('README*').test('docs/README.md'));
  assert.ok(globToRegExp('docs/*-design.md').test('docs/2026-10-21-x-design.md'));
  assert.ok(!globToRegExp('docs/*-design.md').test('docs/sub/2026-10-21-x-design.md'));
  assert.ok(globToRegExp('a?c').test('abc'));
  assert.ok(!globToRegExp('a?c').test('a/c'));
  assert.ok(globToRegExp('AGENTS.md').test('AGENTS.md'));
  assert.ok(!globToRegExp('AGENTS.md').test('xAGENTS.md'));
  assert.ok(matchesAny('src/main/x.sql', ['docs/**', '**/*.sql']));
  assert.ok(!matchesAny('docs/x.md', ['src/**']));
});

test('CLI: 알 수 없는 서브커맨드·어댑터 누락은 ERR exit 2 (stdout 한 줄)', () => {
  const r1 = runCli(['nope']);
  assert.equal(r1.code, 2);
  assert.match(r1.first, /^ERR /);
  const r2 = runCli(['check', '--work', tmp()], { MR_REVIEW_ADAPTER: '' });
  assert.equal(r2.code, 2);
  assert.match(r2.first, /^ERR .*--adapter/);
});

test('CLI: --adapter 는 MR_REVIEW_ADAPTER 로 대체되고 인자가 우선한다 (parseArgs)', async () => {
  const { parseArgs } = await import(join(LIB, 'adapter.mjs'));
  const p = parseArgs(['--work', '/w', '--resolve', 'F1=confirmed', '--resolve', 'F2=dismissed', '--diff-only', '--adapter', '/a']);
  assert.equal(p.work, '/w');
  assert.deepEqual(p.resolve, ['F1=confirmed', 'F2=dismissed']);
  assert.equal(p['diff-only'], true);
  assert.equal(p.adapter, '/a');
  const q = parseArgs(['--work', '/w'], { MR_REVIEW_ADAPTER: '/env' });
  assert.equal(q.adapter, '/env');
});
````

실행:

```bash
node --test tests/mr-review/adapter.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: tests 8 · pass 0 · fail 8(모듈 부재로 import 실패).

### 4. `adapter.mjs` 구현

`dev-workflow/skills/mr-review/scripts/lib/adapter.mjs`를 아래 내용 그대로 만든다.

````js
// adapter.mjs — 어댑터 문서의 기계 블록(SC-2)만 읽는다. 산문은 LLM 몫. 프로젝트 고유 값은 전부 여기서 들어온다(D10).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export class AdapterError extends Error {}

const OPEN = '```json mr-review-adapter';
const CLOSE = '```';

// 필수 키(점 표기). 배열은 존재만, 객체는 존재만 — 내용 규칙은 아래 validate가 따로 본다.
const REQUIRED = [
  'schema', 'workspaceRoot', 'docsRoot', 'projects',
  'policy.judgeId', 'policy.acceptedIds', 'policy.docs',
  'contract.lines', 'baselineCandidates', 'docsMap.always', 'docsMap.rules',
  'wiki.roots', 'wiki.linesPerPage', 'wiki.pagesPerPack', 'mask',
  'deploy.targets', 'deploy.excludes',
  'comments.verdictFirstLine', 'comments.baselineConfirm', 'comments.authorToken', 'comments.trustedReviewers',
  'report.dir',
];

function get(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function extractBlock(markdown) {
  const lines = markdown.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].trim() === OPEN) starts.push(i);
  if (starts.length === 0) throw new AdapterError(`어댑터에 기계 블록(${OPEN})이 없다`);
  if (starts.length > 1) throw new AdapterError('어댑터에 기계 블록이 둘 이상이다 — 하나만 둔다');
  const body = [];
  for (let i = starts[0] + 1; i < lines.length; i++) {
    if (lines[i].trim() === CLOSE) return body.join('\n');
    body.push(lines[i]);
  }
  throw new AdapterError('기계 블록이 닫히지 않았다');
}

export function validate(cfg) {
  const missing = REQUIRED.filter((k) => get(cfg, k) === undefined);
  if (cfg.schema !== undefined && cfg.schema !== 1) missing.push('schema(=1)');
  if (cfg.projects && (typeof cfg.projects !== 'object' || Object.keys(cfg.projects).length === 0)) missing.push('projects(1개 이상)');
  for (const [name, p] of Object.entries(cfg.projects || {})) {
    if (!p || !Number.isInteger(p.id)) missing.push(`projects.${name}.id`);
    if (!p || typeof p.path !== 'string') missing.push(`projects.${name}.path`);
  }
  if (Array.isArray(cfg.policy?.acceptedIds) && cfg.policy.acceptedIds.length === 0) missing.push('policy.acceptedIds(비어 있음)');
  if (Array.isArray(cfg.contract?.lines) && cfg.contract.lines.length !== 10) missing.push('contract.lines(10개)');
  const v = cfg.comments?.verdictFirstLine;
  if (typeof v === 'string') for (const g of ['policy', 'sha', 'kind', 'verdict']) if (!v.includes(`(?<${g}>`)) missing.push(`comments.verdictFirstLine(그룹 ${g})`);
  const t = cfg.comments?.authorToken;
  if (typeof t === 'string' && !t.includes('(?<token>')) missing.push('comments.authorToken(그룹 token)');
  for (const [i, m] of (cfg.mask || []).entries()) {
    if (!m || typeof m.name !== 'string' || typeof m.pattern !== 'string') { missing.push(`mask[${i}]`); continue; }
    try { new RegExp(m.pattern, 'g'); } catch { missing.push(`mask[${i}].pattern(정규식 오류)`); }
  }
  return missing;
}

export function homeDir() {
  return process.env.MR_REVIEW_HOME || os.homedir();
}

function expandHome(p) {
  return p === '~' || p.startsWith('~/') ? path.join(homeDir(), p.slice(1).replace(/^\//, '')) : p;
}

export function loadAdapter(file) {
  const abs = path.resolve(file);
  let md;
  try { md = fs.readFileSync(abs, 'utf8'); } catch (e) { throw new AdapterError(`어댑터 파일을 읽을 수 없다: ${abs} (${e.message})`); }
  let cfg;
  try { cfg = JSON.parse(extractBlock(md)); } catch (e) { if (e instanceof AdapterError) throw e; throw new AdapterError(`기계 블록 JSON 오류: ${e.message}`); }
  const missing = validate(cfg);
  if (missing.length) throw new AdapterError(`어댑터 필수 키 누락·오류: ${missing.join(', ')}`);
  const baseDir = path.dirname(abs);
  const workspaceRoot = path.resolve(baseDir, cfg.workspaceRoot);
  const projects = {};
  for (const [name, p] of Object.entries(cfg.projects)) {
    projects[name] = { id: p.id, checkout: path.resolve(workspaceRoot, p.path), deployExempt: p.deployExempt === true };
  }
  const wikiRoots = cfg.wiki.roots.map((r) => {
    const root = path.resolve(expandHome(r.path));
    return { path: root, export: r.export === true, glossaryFile: r.glossary ? path.join(root, r.glossary) : null };
  });
  cfg.file = abs;
  cfg.markdown = md;
  cfg.resolved = { workspaceRoot, docsRoot: path.resolve(workspaceRoot, cfg.docsRoot), reportDir: path.resolve(workspaceRoot, cfg.report.dir), projects, wikiRoots };
  return cfg;
}

// glob → RegExp. `**` = 0개 이상 디렉터리, `*` = 구분자 제외, `?` = 한 글자. 경로는 `/` 구분 상대 경로.
export function globToRegExp(glob) {
  let re = '^';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const prevSlash = i === 0 || glob[i - 1] === '/';
        const nextSlash = glob[i + 2] === '/';
        if (prevSlash && nextSlash) { re += '(?:.*/)?'; i += 3; continue; }      // **/  → 0개 이상 디렉터리
        if (prevSlash && i + 2 === glob.length) { re += '.*'; i += 2; continue; } // 끝의 ** → 나머지 전부(앞의 / 포함 처리 아래)
        re += '.*'; i += 2; continue;
      }
      re += '[^/]*'; i += 1; continue;
    }
    if (c === '?') { re += '[^/]'; i += 1; continue; }
    if (c === '/' && glob[i + 1] === '*' && glob[i + 2] === '*' && i + 3 === glob.length) { re += '(?:/.*)?'; i += 3; continue; } // 끝의 /** → 자기 자신 또는 하위
    re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }
  return new RegExp(re + '$');
}

export function matchesAny(p, globs) {
  return (globs || []).some((g) => globToRegExp(g).test(p));
}

// CLI 인자: --key value · --flag · 반복 --resolve. env.MR_REVIEW_ADAPTER 는 --adapter 의 대체(인자 우선).
const FLAGS = new Set(['diff-only', 'early', 'paginate']);
const MULTI = new Set(['resolve']);
export function parseArgs(argv, env = process.env) {
  const out = { resolve: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { (out._ ||= []).push(a); continue; }
    const k = a.slice(2);
    if (FLAGS.has(k)) { out[k] = true; continue; }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) { out[k] = true; continue; }
    if (MULTI.has(k)) out[k].push(v); else out[k] = v;
    i += 1;
  }
  if (!out.adapter && env.MR_REVIEW_ADAPTER) out.adapter = env.MR_REVIEW_ADAPTER;
  return out;
}
````

### 5. CLI 골격 `mr-review.mjs`

`dev-workflow/skills/mr-review/scripts/mr-review.mjs`를 아래 내용 그대로 만든다. 서브커맨드 핸들러는 이후 task가 `COMMANDS`에 추가한다(이 task에서는 전부 `미구현` ERR).

````js
#!/usr/bin/env node
// mr-review.mjs — mr-review 스킬의 결정적 단계 CLI(SC-6). 모든 오류는 stdout `ERR <메시지>` 한 줄 + exit 2.
//   collect · check · deploy · pack · review-validate · verdict · render · cleanup — 각 lib 모듈이 구현(task-02~06).
import { loadAdapter, parseArgs, AdapterError } from './lib/adapter.mjs';

export class CliError extends Error {
  constructor(message, code = 2) { super(message); this.code = code; }
}

// 서브커맨드 → async (args, ctx) => string(stdout 첫 줄). ctx = { adapter, work }
const COMMANDS = {
  // task-02: collect
  // task-03: check
  // task-04: deploy
  // task-05: pack
  // task-06: 'review-validate', verdict, render, cleanup
};

const KNOWN = ['collect', 'check', 'deploy', 'pack', 'review-validate', 'verdict', 'render', 'cleanup'];
const NEEDS_ADAPTER = new Set(['collect', 'check', 'deploy', 'pack', 'verdict', 'render', 'cleanup']);

export async function main(argv) {
  const [sub, ...rest] = argv;
  const args = parseArgs(rest);
  if (!KNOWN.includes(sub)) throw new CliError(`알 수 없는 서브커맨드: ${sub ?? '(없음)'} — ${KNOWN.join('|')}`);
  const ctx = {};
  if (NEEDS_ADAPTER.has(sub)) {
    if (!args.adapter) throw new CliError('--adapter <어댑터 파일> 이 필요하다(또는 MR_REVIEW_ADAPTER)');
    ctx.adapter = loadAdapter(args.adapter);
    if (!args.work) throw new CliError('--work <작업 디렉터리> 가 필요하다');
    ctx.work = args.work;
  }
  const handler = COMMANDS[sub];
  if (!handler) throw new CliError(`${sub}: 아직 구현되지 않았다`);
  return handler(args, ctx);
}

export function register(name, fn) { COMMANDS[name] = fn; }

main(process.argv.slice(2)).then((line) => {
  process.stdout.write(`${line}\n`);
}).catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stdout.write(`ERR ${msg}\n`);
  process.exitCode = e instanceof CliError ? e.code : 2;
  if (!(e instanceof CliError) && !(e instanceof AdapterError)) process.stderr.write(`${e?.stack ?? ''}\n`);
});
````

### 6. GREEN 확인 · 커밋

```bash
node --test tests/mr-review/adapter.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
node --check dev-workflow/skills/mr-review/scripts/mr-review.mjs && node --check dev-workflow/skills/mr-review/scripts/lib/adapter.mjs && echo CHECK_OK
grep -rnE '(172\.|safetyreport|안전신문고|kimkfc|gguii)' dev-workflow/skills/mr-review/ tests/mr-review/ | wc -l
```

기대: tests 8 · pass 8 · fail 0 · `CHECK_OK` · 마지막 `0`.

```bash
git add dev-workflow/skills/mr-review/scripts/mr-review.mjs dev-workflow/skills/mr-review/scripts/lib/adapter.mjs tests/mr-review/helpers.mjs tests/mr-review/fixtures/adapter.md tests/mr-review/adapter.test.mjs
git commit -m "feat(mr-review): 어댑터 기계 블록 파서·glob·CLI 골격 + 테스트 하네스 (spec §4, SC-2·SC-6)"
```

## Acceptance Criteria

- `node --test tests/mr-review/adapter.test.mjs` → 8/8.
- `node --check` 2파일 통과.
- `tests/mr-review/fixtures/adapter.md`·헬퍼·스크립트에 실제 프로젝트 식별자 0건(SC-7 T6 grep).
- `node dev-workflow/skills/mr-review/scripts/mr-review.mjs nope` → stdout `ERR …` 한 줄, exit 2.

## Cautions

- **기계 블록 외의 마크다운 표를 파싱하지 마라. 이유:** 산문 표는 프로젝트가 자유롭게 고치는 영역이라(P1) 파서가 깨진다 — 기계 값은 전부 블록으로 받는다.
- **필수 키 검증을 느슨하게 하지 마라(기본값 보충 금지). 이유:** 마스킹 패턴·신뢰 리뷰어가 비어 있는 채로 돌면 전송 경계(F4·F5)와 판정 신뢰(R1-F5)가 조용히 무너진다 — fail-closed.
- **`parseArgs`에서 `--resolve`만 반복 인자다. 이유:** SC-6의 `verdict --resolve <id>=… …` 계약. 다른 키는 마지막 값이 이긴다.
- **헬퍼의 `git()`은 `GIT_CONFIG_GLOBAL=/dev/null`로 돌린다. 이유:** 개발자 전역 설정(gpg 서명·훅)이 테스트 저장소를 오염시킨다.
- **픽스처·테스트에 `010-1234-5678` 같은 가짜 값만 쓴다. 이유:** T6 grep 대상이자 D10 — 실제 번호·이름을 넣지 않는다.
- **`Authorization:` 마스킹 패턴은 인증 방식(`Bearer`·`Basic` …)과 자격증명을 한 매치로 소비한다 — `[^\s]+` 하나로 끝내지 마라. 이유:** plan R3-1 — `Authorization: Bearer x`에서 `Bearer`만 가려지고 `x`가 남는데, `residual`은 `[masked:` 뒤를 다시 보지 않아 Codex 전송이 허용되고 리포트의 `SECRET_MASK`(`Bearer` 뒤 값)도 이미 `Bearer`가 지워져 못 잡는다. 어댑터 확정본(task-10)도 같은 형태여야 한다.
- (review-loop impl R2, 2026-10-22) 어댑터 필수 키 `gitlab.host`(호스트[:포트]) — CLI 가 `setHost` 로 넘기고 모든 `glab api` 에 `--hostname` · 미설정이면 GitLab 조회 자체를 거부(impl R2-4, 추천 자동 채택(위임)). task-10 어댑터 확정본도 이 키를 둔다(SC-2).
