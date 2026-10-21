# task-05 — 컨텍스트 팩 · 마스킹 (pack) (spec §5.3 · D4 · D14 · F4 · F5 · SC-3 `pack.json`)

**목적**: 변경 파일 → 공통 문서(절 단위 발췌), 용어집·grep → 팀/개인 위키 발췌, 기준선·이슈 원문, 어댑터 문서, MR 본문·댓글을 모아 **팩 A**(Claude 전부)와 **팩 B**(Codex — 전송 허용 출처만 + 개인정보 마스킹)를 만든다. 마스킹이 실패하거나 가려지지 않은 패턴이 남으면 팩 B를 만들지 않고 `codexSkipped`로 표시한다(fail-closed).

## Files

- Create: `dev-workflow/skills/mr-review/scripts/lib/pack.mjs`
- Modify: `dev-workflow/skills/mr-review/scripts/mr-review.mjs` (`pack` 등록)
- Test: `tests/mr-review/pack.test.mjs`

## Prep

- spec §5.3-1~5(문서 지도·위키 검색·팩 A/B·마스킹·출처 기록) · D4(전송 범위) · D14(마스킹 실패 = Codex 건너뜀) · F4·F5.
- 엔트리포인트 **SC-2** `docsMap`(`"경로#절제목접두"` 형식)·`wiki`·`mask` · **SC-3** `pack.json` · **SC-7** `MR_REVIEW_HOME`.
- task-01·03 산출물: `lib/adapter.mjs`(`matchesAny`) · `check.json.baselineLinks[*].file`.

## Deps

03

## Steps

### 1. 테스트 작성 (RED)

`tests/mr-review/pack.test.mjs`를 아래 내용 그대로 만든다.

````js
// pack 계약 테스트 (spec §5.3 · SC-3 pack.json) — 공통 문서(git) + 팀/개인 위키(MR_REVIEW_HOME) + 마스킹 fail-closed
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmp, writeAdapter, writeDocs, runCli, readJson, LIB } from './helpers.mjs';

const { extractSection, excerpt, applyMask, residual } = await import(join(LIB, 'pack.mjs'));
const HEAD = 'a'.repeat(40);

function wiki(home) {
  const team = join(home, 'wiki-team');
  mkdirSync(join(team, 'entities'), { recursive: true });
  mkdirSync(join(team, 'decisions'), { recursive: true });
  writeFileSync(join(team, 'glossary.md'), '# 용어집\n\n| 용어 | 슬러그 | 정의 |\n| --- | --- | --- |\n| 자동분류 | auto-classify | 신고 자동 배정 |\n| 결제 | billing | 요금 |\n');
  writeFileSync(join(team, 'entities', 'auto-classify.md'), '# 자동분류\n\n개요 줄.\n\n## 이유\n\n패턴분류를 먼저 둔 이유.\n두 번째 줄.\n\n## 이후 변경\n\n2026-10 변경.\n\n## 기타\n\n긴 본문 1.\n긴 본문 2.\n긴 본문 3.\n긴 본문 4.\n긴 본문 5.\n긴 본문 6.\n');
  writeFileSync(join(team, 'decisions', 'xmapper-note.md'), '# XMapper 결정\n\nXMapper 를 평면 디렉터리에 둔다.\n');
  writeFileSync(join(team, 'entities', 'billing.md'), '# 결제\n\n무관.\n');
  const priv = join(home, 'wiki-private');
  mkdirSync(priv, { recursive: true });
  writeFileSync(join(priv, 'glossary.md'), '| 용어 | 슬러그 | 정의 |\n| --- | --- | --- |\n| 자동분류 | sr-auto | 개인 메모 |\n');
  writeFileSync(join(priv, 'sr-auto.md'), '# 개인 메모\n\n비밀 연락처 010-9999-0000 은 전송 금지.\n');
}

function setup({ adapterPatch = {}, notes = [], description = '## 배경\n- ① 왜: 민원 010-1234-5678 번호로 접수\n- ② 무엇을: 자동분류 패턴', diffs } = {}) {
  const root = tmp();
  const home = join(root, 'home');
  mkdirSync(home, { recursive: true });
  wiki(home);
  const adapter = writeAdapter(root, adapterPatch);
  const docs = writeDocs(root);
  const work = join(root, 'work');
  mkdirSync(join(work, 'baseline'), { recursive: true });
  writeFileSync(join(work, 'baseline', '1.md'), '<!-- mr-review source: docs:x.md@abc ref=master pinned=false -->\n# 기준선 원문\n');
  const d = diffs || [
    { old_path: 'src/main/resources/mapper/XMapper.xml', new_path: 'src/main/resources/mapper/XMapper.xml', new_file: false, renamed_file: false, deleted_file: false, too_large: false, diff: '' },
    { old_path: 'src/main/java/app/auth/Login.java', new_path: 'src/main/java/app/auth/Login.java', new_file: false, renamed_file: false, deleted_file: false, too_large: false, diff: '' },
  ];
  writeFileSync(join(work, 'mr.json'), JSON.stringify({ project: { name: 'alpha', id: 101, checkout: null, deployExempt: false }, iid: 7, title: 'fix(autoClsf): 자동분류 보정', description, api_head: HEAD, author: { id: 1, username: 'author-a' }, reviewers: [], diffs: d, notes, closes_issues: [], versions: [] }));
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify({ mode: 'diff-only', target_sha: 'b'.repeat(40), base_sha: 'b'.repeat(40), head_sha: HEAD, checkout: null, worktree: null, attempts: 1, unrecovered: [], rebuilt: [] }));
  writeFileSync(join(work, 'check.json'), JSON.stringify({ baselineLinks: [{ kind: 'repo', project: 'docs', path: 'x.md', status: '확보', file: 'baseline/1.md', version: 'abc' }, { kind: 'issue', status: '미확보', file: null }] }));
  return { root, home, adapter, docs, work, env: { MR_REVIEW_HOME: home } };
}

test('extractSection: 절 제목 접두로 같은 레벨 다음 절까지', () => {
  const md = '# T\n\n## 5. 판정\n\n본문5.\n\n### 5.1 유형\n\n하위.\n\n## 6. 증거\n\n본문6.\n';
  const s = extractSection(md, '5.');
  assert.match(s, /본문5/);
  assert.match(s, /하위/);
  assert.doesNotMatch(s, /본문6/);
  assert.equal(extractSection(md, '9.'), null);
});

test('excerpt: 우선 절(이유·이후 변경·함정…)을 먼저, 상한 줄 수까지', () => {
  const md = readFileSync(join(setup().home, 'wiki-team', 'entities', 'auto-classify.md'), 'utf8');
  const e = excerpt(md, 8);
  assert.match(e, /## 이유/);
  assert.match(e, /## 이후 변경/);
  assert.doesNotMatch(e, /긴 본문 6/);
  assert.ok(e.split('\n').length <= 9);   // 상한 + 생략 표시 1줄
});

test('applyMask · residual: 패턴별 치환 수, 가린 자리는 [masked:<name>], 남은 패턴은 residual', () => {
  const rules = [{ name: 'phone', pattern: '01[016789]-?\\d{3,4}-?\\d{4}' }, { name: 'token', pattern: '(?<=(?:token=|Authorization:\\s*))[^\\s\\]]+' }];
  const r = applyMask('전화 010-1234-5678, token=abc.def 끝', rules);
  assert.equal(r.text, '전화 [masked:phone], token=[masked:token] 끝');
  assert.deepEqual(r.applied, { phone: 1, token: 1 });
  assert.deepEqual(residual(r.text, rules), []);
  assert.deepEqual(residual('x[masked:phone]5', [{ name: 'weird', pattern: '\\]\\d' }]), [{ name: 'weird' }]);
});

test('팩: 문서 지도(절 발췌·@sha) · 정책 항상 읽기 · 위키(용어집+grep, 팀만 B) · 기준선 · 어댑터 · 본문 마스킹', () => {
  const { adapter, docs, work, env } = setup();
  const r = runCli(['pack', '--adapter', adapter, '--work', work], env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, /^PACKED sources=\d+ codexSkipped=false$/);
  const p = readJson(join(work, 'pack.json'));
  const refs = p.sources.map((s) => s.ref);
  assert.ok(refs.includes(`architecture/database.md@${docs.sha}`), refs.join(','));
  assert.ok(refs.includes(`security/README.md@${docs.sha}`));
  assert.ok(refs.includes(`guide/policy.md@${docs.sha}#5.`));
  assert.ok(refs.includes(`guide/policy.md@${docs.sha}#0.`));
  assert.ok(refs.includes(`guide/workflow.md@${docs.sha}#3.1.1`));
  assert.ok(refs.includes('wiki-team/entities/auto-classify.md'));        // 용어집: 제목 「자동분류」
  assert.ok(refs.includes('wiki-team/decisions/xmapper-note.md'));        // grep: 파일 basename XMapper
  assert.ok(!refs.includes('wiki-team/entities/billing.md'));
  assert.ok(refs.includes('wiki-private/sr-auto.md'));
  assert.ok(refs.includes('baseline/1.md'));
  assert.ok(p.sources.some((s) => s.kind === 'adapter'));
  assert.equal(p.sources.find((s) => s.ref === 'wiki-private/sr-auto.md').inPackB, false);
  assert.equal(p.sources.find((s) => s.ref === 'wiki-team/entities/auto-classify.md').inPackB, true);
  const a = readFileSync(join(work, 'pack-a.md'), 'utf8');
  const b = readFileSync(join(work, 'pack-b.md'), 'utf8');
  assert.match(a, /010-1234-5678/);
  assert.doesNotMatch(b, /010-1234-5678/);
  assert.match(b, /\[masked:phone\]/);
  assert.match(a, /010-9999-0000/);           // 개인 위키는 A 에만
  assert.doesNotMatch(b, /010-9999-0000/);
  assert.doesNotMatch(b, /개인 메모/);
  assert.match(a, /## 5\. MR 리뷰 판정/);
  assert.doesNotMatch(a, /## 6\. 증거/);        // 절 발췌 — 6절은 안 들어간다
  assert.match(b, /\[S\d+\]/);                  // 출처 id 표기
  assert.equal(p.mask.ok, true);
  assert.equal(p.mask.applied.phone >= 1, true);
  assert.equal(p.codexSkipped, false);
});

test('마스킹 잔존 → 팩 B 미생성 · codexSkipped(fail-closed, D14)', () => {
  const { adapter, work, env } = setup({ adapterPatch: { mask: [{ name: 'weird', pattern: '\\]\\d' }, { name: 'phone', pattern: '01[016789]-?\\d{3,4}-?\\d{4}' }] }, description: '## 배경\n- 연락 010-1234-56789\n' });
  const r = runCli(['pack', '--adapter', adapter, '--work', work], env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, /codexSkipped=true$/);
  const p = readJson(join(work, 'pack.json'));
  assert.equal(p.codexSkipped, true);
  assert.match(p.codexSkipReason, /weird/);
  assert.equal(p.packB, null);
  assert.ok(!existsSync(join(work, 'pack-b.md')));
  assert.ok(existsSync(join(work, 'pack-a.md')));
  assert.equal(p.mask.ok, false);
});

test('위키 루트가 없어도 돈다 · 댓글의 이메일도 B 에서 가려진다', () => {
  const { adapter, work, env, home } = setup({ notes: [{ id: 1, system: false, author: { id: 1, username: 'author-a' }, created_at: '2026-10-20T00:00:00Z', body: '문의 someone@example.test 로' }] });
  const r = runCli(['pack', '--adapter', adapter, '--work', work], { MR_REVIEW_HOME: join(home, 'nowhere') });
  assert.equal(r.code, 0, r.out + r.err);
  const p = readJson(join(work, 'pack.json'));
  assert.equal(p.sources.filter((s) => s.kind === 'wiki').length, 0);
  const b = readFileSync(join(work, 'pack-b.md'), 'utf8');
  assert.doesNotMatch(b, /someone@example\.test/);
  assert.match(b, /\[masked:email\]/);
  assert.ok(p.mask.applied.email >= 1);
});
````

실행:

```bash
node --test tests/mr-review/pack.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: tests 6 · pass 0 · fail 6.

### 2. `pack.mjs`

`dev-workflow/skills/mr-review/scripts/lib/pack.mjs`를 아래 내용 그대로 만든다.

````js
// pack.mjs — spec §5.3. 문서 지도·위키·기준선·어댑터·MR 본문 → 팩 A(전부) / 팩 B(전송 허용 + 마스킹). 마스킹 잔존이면 B 를 만들지 않는다(D14).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { matchesAny } from './adapter.mjs';

const PRIORITY_HEADING = /이유|이후 변경|함정|교훈|체크리스트|결정/;
const MAX_DOC_LINES = 400;

function gitHead(dir) {
  const r = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : 'working';
}

// 절 제목 접두(예: "5." → "## 5. …")로 그 절(하위 절 포함)을 뽑는다. 없으면 null.
export function extractSection(markdown, prefix) {
  const lines = markdown.split('\n');
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
    if (m && m[2].trim().startsWith(prefix)) { start = i; level = m[1].length; break; }
  }
  if (start < 0) return null;
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

function splitSections(markdown) {
  const lines = markdown.split('\n');
  const sections = [];
  let cur = { heading: '', lines: [] };
  for (const l of lines) {
    if (/^#{1,6}\s/.test(l)) { if (cur.heading || cur.lines.some((x) => x.trim())) sections.push(cur); cur = { heading: l, lines: [l] }; }
    else cur.lines.push(l);
  }
  sections.push(cur);
  return sections;
}

// 위키 발췌 — 우선 절(이유·이후 변경·함정·교훈·체크리스트·결정) 먼저, 나머지는 위에서부터, 상한 줄 수.
export function excerpt(markdown, maxLines) {
  const secs = splitSections(markdown);
  const ordered = [...secs.filter((s) => PRIORITY_HEADING.test(s.heading)), ...secs.filter((s) => !PRIORITY_HEADING.test(s.heading))];
  const out = [];
  let truncated = false;
  for (const s of ordered) {
    for (const l of s.lines) {
      if (out.length >= maxLines) { truncated = true; break; }
      if (l.trim() === '' && out.length && out[out.length - 1].trim() === '') continue;
      out.push(l);
    }
    if (truncated) break;
  }
  if (truncated) out.push('(… 발췌 상한으로 생략)');
  return out.join('\n').trim();
}

export function applyMask(text, rules) {
  const applied = {};
  let t = text;
  for (const r of rules) {
    const re = new RegExp(r.pattern, 'g');
    let n = 0;
    t = t.replace(re, () => { n += 1; return `[masked:${r.name}]`; });
    applied[r.name] = (applied[r.name] || 0) + n;
  }
  return { text: t, applied };
}

export function residual(text, rules) {
  const out = [];
  for (const r of rules) {
    const re = new RegExp(r.pattern, 'g');
    for (const m of text.matchAll(re)) { if (!m[0].startsWith('[masked:')) { out.push({ name: r.name }); break; } }
  }
  return out;
}

function walkMd(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkMd(p, acc);
    else if (e.isFile() && e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

function parseGlossary(file) {
  if (!file || !fs.existsSync(file)) return [];
  const out = [];
  for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
    const cells = l.split('|').map((c) => c.trim());
    if (cells.length < 4) continue;
    const term = cells[1];
    const slug = cells[2];
    if (!term || !slug || term === '용어' || /^-+$/.test(term)) continue;
    out.push({ term, slug: slug.replace(/[[\]]/g, '') });
  }
  return out;
}

function basenames(mr) {
  const out = new Set();
  for (const d of mr.diffs || []) for (const p of [d.new_path, d.old_path]) if (p) out.add(path.basename(p).replace(/\.[^.]+$/, ''));
  return [...out].filter((b) => b.length >= 4);
}

function wikiPages(root, mr, areaText, limits) {
  if (!fs.existsSync(root.path)) return [];
  const pages = walkMd(root.path);
  const picked = new Map();
  const add = (file) => { if (!picked.has(file) && picked.size < limits.pagesPerPack) picked.set(file, true); };
  for (const g of parseGlossary(root.glossaryFile)) {
    if (!areaText.includes(g.term)) continue;
    const hit = pages.find((p) => path.basename(p, '.md') === g.slug);
    if (hit) add(hit);
  }
  const names = basenames(mr);
  for (const p of pages) {
    if (picked.size >= limits.pagesPerPack) break;
    if (root.glossaryFile && path.resolve(p) === path.resolve(root.glossaryFile)) continue;
    const text = fs.readFileSync(p, 'utf8');
    if (names.some((n) => text.includes(n))) add(p);
  }
  return [...picked.keys()].map((file) => ({ file, rel: `${path.basename(root.path)}/${path.relative(root.path, file).split(path.sep).join('/')}`, text: excerpt(fs.readFileSync(file, 'utf8'), limits.linesPerPage), export: root.export }));
}

function docText(docsRoot, ref) {
  const [rel, anchor] = ref.split('#');
  const file = path.join(docsRoot, rel);
  if (!fs.existsSync(file)) return { text: `(문서 없음: ${rel})`, missing: true };
  const md = fs.readFileSync(file, 'utf8');
  if (anchor) { const s = extractSection(md, anchor); return { text: s ?? `(절 없음: ${rel}#${anchor} — 문서 전체 생략)`, missing: s == null }; }
  const lines = md.split('\n');
  return { text: lines.length > MAX_DOC_LINES ? lines.slice(0, MAX_DOC_LINES).join('\n') + '\n(… 상한으로 생략)' : md, missing: false };
}

function renderSources(sources, texts, { onlyB }) {
  const parts = [];
  for (const s of sources) {
    if (onlyB && !s.inPackB) continue;
    parts.push(`\n---\n### [${s.id}] ${s.kind} · ${s.ref}\n\n${texts.get(s.id)}\n`);
  }
  return parts.join('');
}

export function pack({ adapter, work }) {
  const mr = JSON.parse(fs.readFileSync(path.join(work, 'mr.json'), 'utf8'));
  const snap = JSON.parse(fs.readFileSync(path.join(work, 'snapshot.json'), 'utf8'));
  const check = JSON.parse(fs.readFileSync(path.join(work, 'check.json'), 'utf8'));
  const sources = [];
  const texts = new Map();
  let n = 0;
  const add = (kind, ref, text, exportAllowed) => {
    n += 1;
    const id = `S${n}`;
    sources.push({ id, kind, ref, exportAllowed, inPackB: exportAllowed, lines: text.split('\n').length });
    texts.set(id, text);
    return id;
  };

  // 1. 문서 지도 + 정책 항상 읽는 절
  const docsRoot = adapter.resolved.docsRoot;
  const docsSha = fs.existsSync(docsRoot) ? gitHead(docsRoot) : 'missing';
  const refs = new Set([...adapter.docsMap.always, ...adapter.policy.docs]);
  for (const d of mr.diffs || []) for (const p of [d.new_path, d.old_path]) if (p) for (const rule of adapter.docsMap.rules) if (matchesAny(p, rule.match)) for (const r of rule.docs) refs.add(r);
  for (const ref of refs) {
    const [rel, anchor] = ref.split('#');
    const t = docText(docsRoot, ref);
    add('doc', `${rel}@${docsSha}${anchor ? `#${anchor}` : ''}`, t.text, true);
  }
  // 2. 기준선·이슈 원문(check 가 확보한 것)
  for (const l of check.baselineLinks || []) {
    if (l.status !== '확보' || !l.file) continue;
    add(l.kind === 'issue' ? 'issue' : 'baseline', l.file, fs.readFileSync(path.join(work, l.file), 'utf8'), true);
  }
  // 3. 위키 — 용어집(변경 영역 텍스트에 용어가 있으면 슬러그 페이지) + 변경 파일 basename grep
  const areaText = [mr.title, ...(mr.diffs || []).flatMap((d) => [d.new_path, d.old_path])].join(' ');
  for (const root of adapter.resolved.wikiRoots) {
    for (const pg of wikiPages(root, mr, areaText, { linesPerPage: adapter.wiki.linesPerPage, pagesPerPack: adapter.wiki.pagesPerPack })) add('wiki', pg.rel, pg.text, pg.export);
  }
  // 4. 어댑터 문서(렌즈·정책 설명) — 전송 허용. 기계 블록은 뗀다(마스킹 정규식 원문이 마스킹에 걸려 오염되고, LLM 에겐 산문만 필요)
  add('adapter', path.basename(adapter.file), adapter.markdown.replace(/```json mr-review-adapter[\s\S]*?```/, '(기계 블록 생략 — 스크립트 전용)'), true);

  // 5. MR 본문·댓글(system 제외)
  const notesText = (mr.notes || []).filter((x) => !x.system).map((x) => `- (${x.author?.username || '?'} · ${x.created_at} · #${x.id})\n${x.body}`).join('\n\n');
  const body = `# MR !${mr.iid} ${mr.title}\n\nhead ${snap.head_sha} · base ${snap.base_sha}\n\n## 본문\n\n${mr.description || ''}\n\n## 댓글\n\n${notesText || '(없음)'}\n`;

  const header = (label) => `# 컨텍스트 팩 ${label} — MR !${mr.iid} (${mr.project.name}) head ${snap.head_sha.slice(0, 7)}\n\n출처 목록:\n${sources.map((s) => `- [${s.id}] ${s.kind} · ${s.ref}${s.inPackB ? '' : ' · (Codex 미제공)'}`).join('\n')}\n`;
  const packA = `${header('A')}\n## MR\n\n${body}\n## 근거 자료\n${renderSources(sources, texts, { onlyB: false })}`;
  fs.writeFileSync(path.join(work, 'pack-a.md'), packA);

  // 팩 B = 허용 출처만 + 마스킹(본문·댓글·발췌 전부에 적용 — D4). 잔존이면 B 없음.
  const rawB = `${header('B')}\n## MR\n\n${body}\n## 근거 자료\n${renderSources(sources, texts, { onlyB: true })}`;
  const masked = applyMask(rawB, adapter.mask);
  const left = residual(masked.text, adapter.mask);
  const ok = left.length === 0;
  const out = { sources, mask: { applied: masked.applied, residual: left.map((r) => ({ name: r.name, where: 'pack-b' })), ok }, packA: 'pack-a.md', packB: ok ? 'pack-b.md' : null, codexSkipped: !ok, codexSkipReason: ok ? null : `마스킹 뒤에도 패턴 잔존: ${left.map((r) => r.name).join(', ')} — Codex 를 건너뛴다(단일 모델 모드)` };
  if (ok) fs.writeFileSync(path.join(work, 'pack-b.md'), masked.text);
  else if (fs.existsSync(path.join(work, 'pack-b.md'))) fs.rmSync(path.join(work, 'pack-b.md'));
  fs.writeFileSync(path.join(work, 'pack.json'), JSON.stringify(out, null, 2));
  return out;
}

export async function cmdPack(args, ctx) {
  const p = pack({ adapter: ctx.adapter, work: ctx.work });
  return `PACKED sources=${p.sources.length} codexSkipped=${p.codexSkipped}`;
}
````

### 3. CLI 등록

`mr-review.mjs`에 import 추가 · `COMMANDS`의 `// task-05: pack` 줄을 바꾼다:

```js
import { cmdPack } from './lib/pack.mjs';
```
```js
  pack: cmdPack,
```

### 4. GREEN 확인 · 커밋

```bash
node --test tests/mr-review/pack.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs tests/mr-review/deploy.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
node --check dev-workflow/skills/mr-review/scripts/lib/pack.mjs && echo CHECK_OK
```

기대: pack 6/6 · 앞선 30/30 · `CHECK_OK`.

```bash
git add dev-workflow/skills/mr-review/scripts/lib/pack.mjs dev-workflow/skills/mr-review/scripts/mr-review.mjs tests/mr-review/pack.test.mjs
git commit -m "feat(mr-review): pack — 문서 지도 절 발췌·위키 용어집/grep·기준선·팩 A/B·마스킹 fail-closed (spec §5.3, D4·D14)"
```

## Acceptance Criteria

- `node --test tests/mr-review/pack.test.mjs` → 6/6.
- 전송 금지 루트(`export:false`)의 텍스트가 `pack-b.md`에 한 글자도 없다(F4) · 마스킹 잔존 시 `pack-b.md`가 없고 `codexSkipped:true`(D14·F5).
- 출처마다 `[S<n>] <kind> · <경로@sha | 페이지>`가 `pack.json`과 두 팩 헤더에 있다(G4).

## Cautions

- **팩 B에 「허용 목록에 없는 출처」를 넣는 분기를 만들지 마라. 이유:** 전송 범위를 넓히는 쪽으로 실패하지 않는다(D14·F4). 뺀 출처는 `(Codex 미제공)`으로 헤더에 남긴다.
- **마스킹은 본문·댓글·발췌 전체에 건다 — 발췌만 걸지 마라. 이유:** D4 범위(본문·댓글·발췌). 워크트리 코드는 Codex가 직접 읽으므로 여기서 가리지 않는다(D4 — 코드 안 개인정보는 L5 발견).
- **`residual`은 `[masked:` 로 시작하는 매치를 무시한다. 이유:** 뒤보기 패턴(`token=`)이 가린 자리 자체를 다시 매치해 거짓 잔존이 된다.
- **위키 페이지는 전문이 아니라 `excerpt`. 이유:** 발췌 상한은 어댑터 값(§5.3-2) — 프롬프트 비대화 방지.
- **공통 문서 참조는 `경로#절접두` 로 절만 뽑는다. 정책 전문을 넣지 마라. 이유:** 어댑터 4.2 「항상 읽을 절」 — 정책 전문(350줄)은 두 모델 프롬프트를 압도한다.
