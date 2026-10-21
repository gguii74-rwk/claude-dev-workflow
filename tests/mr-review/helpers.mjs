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
const hi = args.indexOf('--hostname');
const host = hi >= 0 ? args.splice(hi, 2)[1] : null;   // --hostname 은 규칙 대조·호출 기록에서 빼고 따로 남긴다(impl R2-4)
fs.appendFileSync(scPath + '.hosts', JSON.stringify(host) + '\\n');
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
    hosts: () => (existsSync(scenario + '.hosts') ? readFileSync(scenario + '.hosts', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []),
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
