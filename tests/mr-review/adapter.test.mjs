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

test('mask 패턴이 SHA 보호 자리표시 문자(NUL·U+E000~E010)를 잡으면 AdapterError (impl C3 C2-N1 잔존, 추천 자동 채택(위임))', () => {
  const root = tmp();
  for (const pattern of ['\\u0000', '[\\uE000-\\uF8FF]', '\\S+']) {
    const file = writeAdapter(root, { mask: [{ name: 'bad', pattern }] });
    assert.throws(() => loadAdapter(file), (e) => e instanceof AdapterError && /mask\[0\]\.pattern\(SHA 보호 자리표시/.test(e.message), pattern);
  }
  const ok = writeAdapter(root, { mask: [{ name: 'rrn', pattern: '\\d{6}-?[1-4]\\d{6}' }, { name: 'email', pattern: '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' }] });
  assert.doesNotThrow(() => loadAdapter(ok));
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

test('gitlab.host 는 필수 키이고 호스트 이름 형태(스킴·경로 없음)여야 한다 (impl R2-4)', () => {
  assert.throws(() => loadAdapter(writeAdapter(tmp(), { gitlab: undefined })), /gitlab\.host/);
  assert.throws(() => loadAdapter(writeAdapter(tmp(), { gitlab: { host: 'https://gitlab.test/' } })), /gitlab\.host/);
  assert.equal(loadAdapter(writeAdapter(tmp(), { gitlab: { host: 'gitlab.test:8443' } })).gitlab.host, 'gitlab.test:8443');
});

test('문서 참조(policy.docs·docsMap.always·docsMap.rules[*].docs, repo: 포함)는 정규 상대 경로만 — 상위 이동·절대·역슬래시·빈 조각은 AdapterError (8b FR1-4)', () => {
  const root = tmp();
  for (const bad of ['../wiki-private/personal.md', '/etc/passwd', 'guide\\..\\x.md', 'guide//x.md', './guide/x.md', 'C:/x.md', 'repo:../outside.md', '']) {
    const file = writeAdapter(root, { docsMap: { always: [bad], rules: [] } });
    assert.throws(() => loadAdapter(file), (e) => e instanceof AdapterError && /docsMap\.always\[0\]\(정규 상대 경로/.test(e.message), bad);
  }
  const rules = writeAdapter(root, { docsMap: { always: ['guide/policy.md#0.'], rules: [{ match: ['**'], docs: ['guide/../../x.md'] }] } });
  assert.throws(() => loadAdapter(rules), /docsMap\.rules\[0\]\.docs\[0\]/);
  assert.doesNotThrow(() => loadAdapter(writeAdapter(root, { docsMap: { always: ['guide/policy.md#0.', 'repo:AGENTS.md', 'repo:docs/a.md#2.'], rules: [] } })));
});

test('projects.<이름>.deployLayout: "maven-war" 보존 · 키 없음 = "source" · 그 밖 값은 AdapterError (1.3.2 AC⑨-1)', () => {
  const root = tmp();
  const a = loadAdapter(writeAdapter(root, { projects: { gamma: { id: 104, path: 'repos/gamma', deployLayout: 'maven-war' } } }));
  assert.equal(a.resolved.projects.gamma.deployLayout, 'maven-war');
  assert.equal(a.resolved.projects.alpha.deployLayout, 'source');
  assert.equal(loadAdapter(writeAdapter(root, { projects: { gamma: { id: 104, path: 'repos/gamma', deployLayout: 'source' } } })).resolved.projects.gamma.deployLayout, 'source');
  const bad = writeAdapter(root, { projects: { gamma: { id: 104, path: 'repos/gamma', deployLayout: 'gradle' } } });
  assert.throws(() => loadAdapter(bad), (e) => e instanceof AdapterError && /projects\.gamma\.deployLayout/.test(e.message));
});

test('deployLayout 의미 = 판별 못 할 때의 기본값(힌트) — 검증·resolved 는 1.3.2 그대로, 키 유무는 원본 projects 에 남아 deploy 가 힌트 출처(adapter|default)를 가른다 (1.3.3 AC⑬-13 · D59)', () => {
  const root = tmp();
  const a = loadAdapter(writeAdapter(root, { projects: { gamma: { id: 104, path: 'repos/gamma', deployLayout: 'maven-war' } } }));
  assert.equal(a.projects.gamma.deployLayout, 'maven-war');
  assert.equal(a.projects.alpha.deployLayout, undefined);
  assert.equal(a.resolved.projects.alpha.deployLayout, 'source');
  assert.throws(() => loadAdapter(writeAdapter(root, { projects: { gamma: { id: 104, path: 'repos/gamma', deployLayout: 'auto' } } })), /deployLayout\("source"\|"maven-war"\)/);
});
