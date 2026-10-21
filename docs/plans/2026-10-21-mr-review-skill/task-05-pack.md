# task-05 — 컨텍스트 팩 · 마스킹 (pack) (spec §5.3 · D4 · D14 · F4 · F5 · SC-3 `pack.json`)

**목적**: 변경 파일 → 공통 문서(절 단위 발췌), 용어집·grep(검색어 = 변경 파일명 + diff 추가 줄의 테이블명·선언 식별자) → 팀/개인 위키 발췌, 기준선·이슈 원문, 어댑터 문서, MR 본문·댓글을 모아 **팩 A**(Claude 전부)와 **팩 B**(Codex — 전송 허용 출처만 + 개인정보 마스킹)를 만든다. 마스킹이 실패하거나 가려지지 않은 패턴이 남으면 팩 B를 만들지 않고 `codexSkipped`로 표시한다(fail-closed).

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
import { mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmp, writeAdapter, writeDocs, fakeGlab, runCli, readJson, git, LIB } from './helpers.mjs';

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
  const rules = [{ name: 'phone', pattern: '01[016789]-?\\d{3,4}-?\\d{4}' }, { name: 'token', pattern: '(?<=(?:token=|Authorization:\\s*))(?:(?:Bearer|Basic|Token|Digest)\\s+)?[^\\s\\]]+' }];
  const r = applyMask('전화 010-1234-5678, token=abc.def 끝', rules);
  assert.equal(r.text, '전화 [masked:phone], token=[masked:token] 끝');
  assert.deepEqual(r.applied, { phone: 1, token: 1 });
  assert.deepEqual(residual(r.text, rules), []);
  assert.deepEqual(residual('x[masked:phone]5', [{ name: 'weird', pattern: '\\]\\d' }]), [{ name: 'weird' }]);
  // Authorization 값은 인증 방식 + 자격증명을 한 번에 가린다(R3-1) — `Bearer` 만 가리고 자격증명이 남으면 residual 도 못 잡는다
  const b = applyMask('헤더 Authorization: Bearer synthetic-credential-123 끝 · Authorization: Basic c3ludGg= 끝', rules);
  assert.equal(b.text, '헤더 Authorization: [masked:token] 끝 · Authorization: [masked:token] 끝');
  assert.doesNotMatch(b.text, /synthetic-credential|c3ludGg/);
  assert.deepEqual(residual(b.text, rules), []);
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

test('전송 경계: 대상 외 등록 저장소의 기준선 원문은 팩 B 제외(R1-3) · 필수 정책 문서 누락은 ERR · 규칙 문서 누락은 missing 표시(R1-8)', () => {
  const { adapter, work, env } = setup();
  writeFileSync(join(work, 'baseline', '2.md'), '<!-- mr-review source: beta:guide/other.md@fff -->\n# 베타 저장소 문서 BETA-ONLY-TEXT\n');
  writeFileSync(join(work, 'baseline', '3.md'), '<!-- mr-review source: alpha:docs/own.md@eee -->\n# 대상 저장소 문서 ALPHA-OWN-TEXT\n');
  writeFileSync(join(work, 'check.json'), JSON.stringify({ baselineLinks: [
    { kind: 'repo', project: 'docs', path: 'x.md', status: '확보', file: 'baseline/1.md', version: 'abc' },
    { kind: 'repo', project: 'beta', path: 'guide/other.md', status: '확보', file: 'baseline/2.md', version: 'fff' },
    { kind: 'repo', project: 'alpha', path: 'docs/own.md', status: '확보', file: 'baseline/3.md', version: 'eee' },
  ] }));
  const r = runCli(['pack', '--adapter', adapter, '--work', work], env);
  assert.equal(r.code, 0, r.out + r.err);
  const p = readJson(join(work, 'pack.json'));
  assert.equal(p.sources.find((s) => s.ref === 'baseline/1.md').inPackB, true);    // docsRoot 프로젝트
  assert.equal(p.sources.find((s) => s.ref === 'baseline/2.md').inPackB, false);   // 등록됐지만 대상 외 저장소
  assert.equal(p.sources.find((s) => s.ref === 'baseline/3.md').inPackB, true);    // 대상 저장소
  const b = readFileSync(join(work, 'pack-b.md'), 'utf8');
  assert.doesNotMatch(b, /BETA-ONLY-TEXT/);
  assert.match(b, /ALPHA-OWN-TEXT/);
  assert.match(readFileSync(join(work, 'pack-a.md'), 'utf8'), /BETA-ONLY-TEXT/);
  assert.match(b, /baseline\/2\.md · \(Codex 미제공\)/);
  // 규칙 문서 누락 → missing:true 로 계속
  const s2 = setup({ adapterPatch: { docsMap: { always: ['guide/policy.md#0.'], rules: [{ match: ['**/mapper/**/*.xml'], docs: ['architecture/none.md'] }] } } });
  const r2 = runCli(['pack', '--adapter', s2.adapter, '--work', s2.work], s2.env);
  assert.equal(r2.code, 0, r2.out + r2.err);
  const p2 = readJson(join(s2.work, 'pack.json'));
  const miss = p2.sources.find((s) => s.ref.startsWith('architecture/none.md@'));
  assert.equal(miss.missing, true);
  assert.match(readFileSync(join(s2.work, 'pack-a.md'), 'utf8'), /architecture\/none\.md@\w+ · \(누락 — 문서·절 없음\)/);
  // 필수 정책 문서·절 누락 → ERR(fail-closed)
  const s3 = setup({ adapterPatch: { policy: { judgeId: 'TEST-POLICY-v1.1', acceptedIds: ['TEST-POLICY-v1.0', 'TEST-POLICY-v1.1'], docs: ['guide/policy.md#9.'] } } });
  const r3 = runCli(['pack', '--adapter', s3.adapter, '--work', s3.work], s3.env);
  assert.equal(r3.code, 2);
  assert.match(r3.first, /^ERR 필수 정책 문서·절 누락: guide\/policy\.md#9\./);
  assert.ok(!existsSync(join(s3.work, 'pack.json')));
});

test('repo: 접두 문서 참조 — 대상 저장소 문서를 고정 head 에서 읽어 팩 B 에 넣고, 없으면 missing 으로 계속(R3-6)', () => {
  const enc = (p) => encodeURIComponent(p).replace(/\./g, '%2E');
  const s = setup({ adapterPatch: { docsMap: { always: ['guide/policy.md#0.', 'repo:AGENTS.md'], rules: [{ match: ['**/auth/**'], docs: ['repo:docs/security-notes.md#2.'] }] } } });
  const g = fakeGlab(s.root, [
    { match: `^api projects/101/repository/files/${enc('AGENTS.md')}/raw\\?ref=${HEAD}$`, text: '# alpha 규약\n\nmapper 는 평면 디렉터리 REPO-AGENTS-TEXT.\n' },
    // docs/security-notes.md 규칙 없음 → 404 → missing
  ]);
  const r = runCli(['pack', '--adapter', s.adapter, '--work', s.work], { ...s.env, ...g.env });
  assert.equal(r.code, 0, r.out + r.err);
  const p = readJson(join(s.work, 'pack.json'));
  const ag = p.sources.find((x) => x.ref === `repo:AGENTS.md@${HEAD.slice(0, 7)}`);
  assert.equal(ag.kind, 'doc');
  assert.equal(ag.inPackB, true);                                                        // 워크트리 전체가 D4 전송 범위 — 대상 저장소 문서도 B
  assert.equal(ag.missing, false);
  assert.match(readFileSync(join(s.work, 'pack-b.md'), 'utf8'), /REPO-AGENTS-TEXT/);
  const sec = p.sources.find((x) => x.ref === `repo:docs/security-notes.md@${HEAD.slice(0, 7)}#2.`);
  assert.equal(sec.missing, true);                                                       // 저장소에 없는 문서 — ERR 가 아니라 missing 으로 계속
  assert.equal(p.codexSkipped, false);
});

test('repo: 문서는 고정 head 의 git blob 으로 읽는다 — 워크트리 밖을 가리키는 심볼릭 링크는 missing(팩 B 에 대상 본문 없음) · 작업 트리의 미커밋 변경도 읽지 않는다 (R5-1)', () => {
  const s = setup({ adapterPatch: { docsMap: { always: ['guide/policy.md#0.', 'repo:AGENTS.md', 'repo:docs/notes.md'], rules: [] } } });
  const outside = join(s.root, 'private-wiki.md');
  writeFileSync(outside, 'OUTSIDE-PRIVATE-TEXT 전송 금지\n');
  const wt = join(s.root, 'wt');
  mkdirSync(join(wt, 'docs'), { recursive: true });
  git(wt, 'init', '-q', '-b', 'master');
  symlinkSync(outside, join(wt, 'AGENTS.md'));                                             // MR 이 AGENTS.md 를 바깥 파일로 향하는 링크로 바꿈
  writeFileSync(join(wt, 'docs', 'notes.md'), '# notes\n\nCOMMITTED-NOTES-TEXT\n');
  git(wt, 'add', '-A');
  git(wt, 'commit', '-q', '-m', 'link');
  const head = git(wt, 'rev-parse', 'HEAD');
  writeFileSync(join(wt, 'docs', 'notes.md'), '# notes\n\nDIRTY-UNCOMMITTED-TEXT\n');          // 작업 트리만 바뀐 상태
  writeFileSync(join(s.work, 'snapshot.json'), JSON.stringify({ mode: 'worktree', target_sha: 'b'.repeat(40), base_sha: 'b'.repeat(40), head_sha: head, checkout: wt, worktree: wt, attempts: 1, unrecovered: [], rebuilt: [] }));
  const mr = readJson(join(s.work, 'mr.json')); mr.api_head = head; writeFileSync(join(s.work, 'mr.json'), JSON.stringify(mr));
  const r = runCli(['pack', '--adapter', s.adapter, '--work', s.work], s.env);
  assert.equal(r.code, 0, r.out + r.err);
  const p = readJson(join(s.work, 'pack.json'));
  const ag = p.sources.find((x) => x.ref.startsWith('repo:AGENTS.md@'));
  assert.equal(ag.missing, true);                                                         // 링크 → missing(ERR 아님)
  const a = readFileSync(join(s.work, 'pack-a.md'), 'utf8');
  const b = readFileSync(join(s.work, 'pack-b.md'), 'utf8');
  assert.doesNotMatch(a + b, /OUTSIDE-PRIVATE-TEXT/);                                    // 링크 대상 본문은 어느 팩에도 없다
  assert.match(a, /심볼릭 링크/);
  assert.match(b, /COMMITTED-NOTES-TEXT/);                                                // 일반 blob 은 커밋된 내용으로
  assert.doesNotMatch(a + b, /DIRTY-UNCOMMITTED-TEXT/);                                   // 작업 트리의 미커밋 변경은 읽지 않는다(고정 head)
});

test('위키 검색어에 diff 추가 줄의 테이블명·선언 식별자가 들어간다 — 제목·파일명에 없는 테이블명만 언급한 페이지가 선택된다 (R4-5)', () => {
  const diff = '@@ -1,3 +1,4 @@\n <select id="findAssign" resultType="map">\n-  SELECT * FROM report_queue\n+  SELECT * FROM report_assign ra\n+  JOIN assign_rule r ON r.id = ra.rule_id\n+  -- from the old queue\n';
  const diffs = [{ old_path: 'src/main/resources/mapper/XMapper.xml', new_path: 'src/main/resources/mapper/XMapper.xml', new_file: false, renamed_file: false, deleted_file: false, too_large: false, diff }];
  const { home, adapter, work, env } = setup({ diffs });
  writeFileSync(join(home, 'wiki-team', 'decisions', 'assign-table-pitfall.md'), '# 배정 테이블 함정\n\nreport_assign 은 rule_id 가 NULL 일 수 있다.\n');
  const r = runCli(['pack', '--adapter', adapter, '--work', work], env);
  assert.equal(r.code, 0, r.out + r.err);
  const p = readJson(join(work, 'pack.json'));
  assert.ok(p.wikiTerms.includes('report_assign') && p.wikiTerms.includes('assign_rule'), p.wikiTerms.join(','));   // SQL 테이블명 — 추가 줄만(report_queue 는 삭제 줄)
  assert.ok(!p.wikiTerms.includes('report_queue'));
  assert.ok(!p.wikiTerms.some((t) => /^(the|old|queue)$/i.test(t)));                                                 // 산문 「from the」 는 식별자가 아니다
  assert.ok(p.sources.map((s) => s.ref).includes('wiki-team/decisions/assign-table-pitfall.md'));                     // 제목·파일명엔 없는 테이블명만 언급한 페이지
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

기대: tests 8 · pass 0 · fail 8.

### 2. `pack.mjs`

`dev-workflow/skills/mr-review/scripts/lib/pack.mjs`를 아래 내용 그대로 만든다.

````js
// pack.mjs — spec §5.3. 문서 지도·위키·기준선·어댑터·MR 본문 → 팩 A(전부) / 팩 B(전송 허용 + 마스킹). 마스킹 잔존이면 B 를 만들지 않는다(D14).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { matchesAny } from './adapter.mjs';
import { apiRaw, encodePath } from './gitlab.mjs';

export class PackError extends Error {}

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

// 규칙 = { name, pattern, flags? } — flags 는 `g` 에 덧붙는다(엔진 내장 SECRET_MASK 의 `i` 용. 어댑터 mask 는 플래그 없이 `g`).
export function applyMask(text, rules) {
  const applied = {};
  let t = text;
  for (const r of rules) {
    const re = new RegExp(r.pattern, 'g' + (r.flags || ''));
    let n = 0;
    t = t.replace(re, () => { n += 1; return `[masked:${r.name}]`; });
    applied[r.name] = (applied[r.name] || 0) + n;
  }
  return { text: t, applied };
}

export function residual(text, rules) {
  const out = [];
  for (const r of rules) {
    const re = new RegExp(r.pattern, 'g' + (r.flags || ''));
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

// 변경 코드에서 검색어(R4-5) — spec §5.3-2 「변경 파일명·기능명·테이블명으로 본문 grep」: diff 의 추가 줄(`+`, `+++` 제외)에서
//  (a) SQL 테이블명 — FROM/JOIN/INTO/UPDATE/TABLE 뒤 식별자(스키마 접두가 있으면 마지막 세그먼트도) · `@Table(name="…")`
//  (b) 선언 식별자 — class/interface/enum/record/function/def 뒤 이름 · MyBatis `<select|insert|update|delete id="…">`
// 결정적(같은 입력 = 같은 결과)이고 어댑터 키가 없다(설계 결정 — plan R4-5). 길이 ≥ 4 · SQL 예약어 제외 · 상한 TERM_MAX. 산문의 「from the」 같은 짧은 낱말은 길이·예약어 필터로 걸린다.
const SQL_STOP = new Set(['SELECT', 'FROM', 'WHERE', 'JOIN', 'INTO', 'UPDATE', 'TABLE', 'VALUES', 'INSERT', 'DELETE', 'SET', 'AND', 'OR', 'NOT', 'NULL', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'ON', 'AS', 'ORDER', 'GROUP', 'BY', 'HAVING', 'LIMIT', 'EXISTS', 'CREATE', 'ALTER', 'DROP', 'IF', 'DUAL', 'WITH', 'UNION', 'DISTINCT', 'TEMPORARY']);
const TERM_MAX = 40;
function addedLines(mr) {
  return (mr.diffs || []).flatMap((d) => (d.diff || '').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1)));
}
export function codeTerms(mr) {
  const out = new Set();
  const text = addedLines(mr).join('\n');
  const push = (t) => { if (t && t.length >= 4 && !SQL_STOP.has(t.toUpperCase()) && out.size < TERM_MAX) out.add(t); };
  for (const m of text.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+`?([A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)?)`?/gi)) { push(m[1]); if (m[1].includes('.')) push(m[1].split('.').pop()); }
  for (const m of text.matchAll(/@Table\s*\(\s*(?:name\s*=\s*)?["']([^"']+)["']/g)) push(m[1]);
  for (const m of text.matchAll(/\b(?:class|interface|enum|record|function|def)\s+([A-Za-z_]\w*)/g)) push(m[1]);
  for (const m of text.matchAll(/<(?:select|insert|update|delete)\s+id="([^"]+)"/g)) push(m[1]);
  return [...out];
}

function wikiPages(root, mr, areaText, limits, terms = []) {
  if (!fs.existsSync(root.path)) return [];
  const pages = walkMd(root.path);
  const picked = new Map();
  const add = (file) => { if (!picked.has(file) && picked.size < limits.pagesPerPack) picked.set(file, true); };
  for (const g of parseGlossary(root.glossaryFile)) {
    if (!areaText.includes(g.term)) continue;
    const hit = pages.find((p) => path.basename(p, '.md') === g.slug);
    if (hit) add(hit);
  }
  const names = [...new Set([...basenames(mr), ...terms])];   // 파일 basename + 코드 검색어(테이블명·선언 식별자, R4-5)
  for (const p of pages) {
    if (picked.size >= limits.pagesPerPack) break;
    if (root.glossaryFile && path.resolve(p) === path.resolve(root.glossaryFile)) continue;
    const text = fs.readFileSync(p, 'utf8');
    if (names.some((n) => text.includes(n))) add(p);
  }
  return [...picked.keys()].map((file) => ({ file, rel: `${path.basename(root.path)}/${path.relative(root.path, file).split(path.sep).join('/')}`, text: excerpt(fs.readFileSync(file, 'utf8'), limits.linesPerPage), export: root.export }));
}

function sliceDoc(md, rel, anchor) {
  if (anchor) { const s = extractSection(md, anchor); return { text: s ?? `(절 없음: ${rel}#${anchor} — 문서 전체 생략)`, missing: s == null }; }
  const lines = md.split('\n');
  return { text: lines.length > MAX_DOC_LINES ? lines.slice(0, MAX_DOC_LINES).join('\n') + '\n(… 상한으로 생략)' : md, missing: false };
}

function docText(docsRoot, ref) {
  const [rel, anchor] = ref.split('#');
  const file = path.join(docsRoot, rel);
  if (!fs.existsSync(file)) return { text: `(문서 없음: ${rel})`, missing: true };
  return sliceDoc(fs.readFileSync(file, 'utf8'), rel, anchor);
}

// `repo:<경로>[#절]` — 대상 저장소 자신의 문서(AGENTS.md·CLAUDE.md·저장소 docs/)를 고정 head 에서 읽는다(SC-2, R3-6). 워크트리 모드 = 워크트리 파일, diff-only = repository/files raw(ref=head).
// 전송 허용 = 워크트리 전체가 D4 범위라 true. 저장소마다 있을 수도 없을 수도 있는 문서라 누락은 필수 여부와 무관하게 missing:true 로 계속(ERR 아님).
// 대상 저장소 문서(repo:)는 **고정 head 의 git blob** 으로 읽는다 — 작업 트리 파일을 fs 로 읽지 않는다(R5-1). 작업 트리를 읽으면 MR 이 AGENTS.md 를 워크트리 밖(개인 위키 등)으로
// 향하는 심볼릭 링크로 바꿨을 때 그 대상 본문이 「대상 저장소 문서」로 팩 B(Codex)에 들어간다(F4 위반 — D16 의 Codex 직접 읽기 한계와 별개로 엔진이 금지 자료를 삽입하는 경로).
// `git ls-tree` 로 항목 모드를 확인해 일반 blob(100644·100755)만 읽고, 심볼릭 링크(120000)·서브모듈(160000)·부재는 missing. 경로 중간의 링크도 커밋 트리 조회라 따라가지 않는다.
// diff-only 의 raw API 도 blob 내용을 돌려주므로(링크면 링크 대상 문자열) 외부 파일을 따라가지 않는다.
function repoDocText(mr, snap, ref) {
  const [rel, anchor] = ref.slice('repo:'.length).split('#');
  let md = null;
  let why = '없음';
  try {
    if (snap.mode === 'worktree' && snap.worktree) {
      const ls = spawnSync('git', ['-C', snap.worktree, 'ls-tree', snap.head_sha, '--', rel], { encoding: 'utf8' });
      const mode = ls.status === 0 ? (ls.stdout.trim().split(/\s+/)[0] || '') : '';
      if (mode === '100644' || mode === '100755') {
        const show = spawnSync('git', ['-C', snap.worktree, 'show', `${snap.head_sha}:${rel}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        md = show.status === 0 ? show.stdout : null;
      } else if (mode === '120000') why = '심볼릭 링크 — 링크 대상은 읽지 않는다(F4)';
      else if (mode === '160000') why = '서브모듈';
    } else md = apiRaw(`projects/${mr.project.id}/repository/files/${encodePath(rel)}/raw?ref=${snap.head_sha}`).toString('utf8');
  } catch { md = null; }
  if (md == null) return { text: `(대상 저장소 문서 ${why}: ${rel} @ ${snap.head_sha.slice(0, 7)})`, missing: true };
  return sliceDoc(md, rel, anchor);
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
  const add = (kind, ref, text, exportAllowed, missing = false) => {
    n += 1;
    const id = `S${n}`;
    sources.push({ id, kind, ref, exportAllowed, inPackB: exportAllowed, lines: text.split('\n').length, missing });
    texts.set(id, text);
    return id;
  };

  // 1. 문서 지도 + 정책 항상 읽는 절. 필수 문서(policy.docs·docsMap.always)의 파일·절 누락은 fail-closed(ERR) — 정책을 읽지 않은 판정을 만들지 않는다.
  //    문서 지도 규칙(docsMap.rules)의 문서 누락은 출처에 missing:true 로 남기고 계속한다(선택 보강 자료).
  const docsRoot = adapter.resolved.docsRoot;
  const docsSha = fs.existsSync(docsRoot) ? gitHead(docsRoot) : 'missing';
  const required = new Set([...adapter.docsMap.always, ...adapter.policy.docs]);
  const refs = new Set(required);
  for (const d of mr.diffs || []) for (const p of [d.new_path, d.old_path]) if (p) for (const rule of adapter.docsMap.rules) if (matchesAny(p, rule.match)) for (const r of rule.docs) refs.add(r);
  for (const ref of refs) {
    if (ref.startsWith('repo:')) {   // 대상 저장소 문서(R3-6) — 출처 = repo:<경로>@<head7>[#절]
      const [rel, anchor] = ref.slice('repo:'.length).split('#');
      const t = repoDocText(mr, snap, ref);
      add('doc', `repo:${rel}@${snap.head_sha.slice(0, 7)}${anchor ? `#${anchor}` : ''}`, t.text, true, t.missing);
      continue;
    }
    const [rel, anchor] = ref.split('#');
    const t = docText(docsRoot, ref);
    if (t.missing && required.has(ref)) throw new PackError(`필수 정책 문서·절 누락: ${ref} (docsRoot ${docsRoot}) — 어댑터 policy.docs·docsMap.always 와 공통 문서 저장소 체크아웃을 확인하라`);
    add('doc', `${rel}@${docsSha}${anchor ? `#${anchor}` : ''}`, t.text, true, t.missing);
  }
  // 2. 기준선·이슈 원문(check 가 확보한 것). 외부 전송(팩 B)은 어댑터 §6 허용 범위만 — 연결 이슈 · MR 본문 「배경」 · 대상 저장소 또는 공통 문서 저장소(docsRoot 와 같은 체크아웃인 프로젝트)의 문서.
  //    어댑터 projects 에 등록됐다는 사실은 전송 허가가 아니다 — 그 밖 저장소의 원문은 Claude(팩 A)만 본다.
  const docsProject = Object.entries(adapter.resolved.projects).find(([, p]) => path.resolve(p.checkout) === path.resolve(docsRoot))?.[0] ?? null;
  for (const l of check.baselineLinks || []) {
    if (l.status !== '확보' || !l.file) continue;
    const exportable = l.kind !== 'repo' || l.project === mr.project.name || (docsProject !== null && l.project === docsProject);
    add(l.kind === 'issue' ? 'issue' : 'baseline', l.file, fs.readFileSync(path.join(work, l.file), 'utf8'), exportable);
  }
  // 3. 위키 — 용어집(변경 영역 텍스트 = 제목·경로·diff 추가 줄에 용어가 있으면 슬러그 페이지) + 변경 파일 basename·코드 검색어(테이블명·선언 식별자) grep — spec §5.3-2 「변경 파일명·기능명·테이블명」(R4-5)
  const terms = codeTerms(mr);
  const areaText = [mr.title, ...(mr.diffs || []).flatMap((d) => [d.new_path, d.old_path]), ...addedLines(mr)].join(' ');
  for (const root of adapter.resolved.wikiRoots) {
    for (const pg of wikiPages(root, mr, areaText, { linesPerPage: adapter.wiki.linesPerPage, pagesPerPack: adapter.wiki.pagesPerPack }, terms)) add('wiki', pg.rel, pg.text, pg.export);
  }
  // 4. 어댑터 문서(렌즈·정책 설명) — 전송 허용. 기계 블록은 뗀다(마스킹 정규식 원문이 마스킹에 걸려 오염되고, LLM 에겐 산문만 필요)
  add('adapter', path.basename(adapter.file), adapter.markdown.replace(/```json mr-review-adapter[\s\S]*?```/, '(기계 블록 생략 — 스크립트 전용)'), true);

  // 5. MR 본문·댓글(system 제외)
  const notesText = (mr.notes || []).filter((x) => !x.system).map((x) => `- (${x.author?.username || '?'} · ${x.created_at} · #${x.id})\n${x.body}`).join('\n\n');
  const body = `# MR !${mr.iid} ${mr.title}\n\nhead ${snap.head_sha} · base ${snap.base_sha}\n\n## 본문\n\n${mr.description || ''}\n\n## 댓글\n\n${notesText || '(없음)'}\n`;

  const header = (label) => `# 컨텍스트 팩 ${label} — MR !${mr.iid} (${mr.project.name}) head ${snap.head_sha.slice(0, 7)}\n\n출처 목록:\n${sources.map((s) => `- [${s.id}] ${s.kind} · ${s.ref}${s.inPackB ? '' : ' · (Codex 미제공)'}${s.missing ? ' · (누락 — 문서·절 없음)' : ''}`).join('\n')}\n`;
  const packA = `${header('A')}\n## MR\n\n${body}\n## 근거 자료\n${renderSources(sources, texts, { onlyB: false })}`;
  fs.writeFileSync(path.join(work, 'pack-a.md'), packA);

  // 팩 B = 허용 출처만 + 마스킹(본문·댓글·발췌 전부에 적용 — D4). 잔존이면 B 없음.
  const rawB = `${header('B')}\n## MR\n\n${body}\n## 근거 자료\n${renderSources(sources, texts, { onlyB: true })}`;
  const masked = applyMask(rawB, adapter.mask);
  const left = residual(masked.text, adapter.mask);
  const ok = left.length === 0;
  const out = { sources, wikiTerms: terms, mask: { applied: masked.applied, residual: left.map((r) => ({ name: r.name, where: 'pack-b' })), ok }, packA: 'pack-a.md', packB: ok ? 'pack-b.md' : null, codexSkipped: !ok, codexSkipReason: ok ? null : `마스킹 뒤에도 패턴 잔존: ${left.map((r) => r.name).join(', ')} — Codex 를 건너뛴다(단일 모델 모드)` };
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

기대: pack 8/8 · 앞선 37/37 · `CHECK_OK`.

```bash
git add dev-workflow/skills/mr-review/scripts/lib/pack.mjs dev-workflow/skills/mr-review/scripts/mr-review.mjs tests/mr-review/pack.test.mjs
git commit -m "feat(mr-review): pack — 문서 지도 절 발췌·위키 용어집/grep·기준선·팩 A/B·마스킹 fail-closed (spec §5.3, D4·D14)"
```

## Acceptance Criteria

- `node --test tests/mr-review/pack.test.mjs` → 10/10.
- `repo:<경로>[#절]` 참조는 대상 저장소의 고정 head(워크트리 또는 raw API)에서 읽고 출처 `repo:<경로>@<head7>`·팩 B 포함, 누락은 `missing:true`(plan R3-6).
- 전송 금지 루트(`export:false`)의 텍스트가 `pack-b.md`에 한 글자도 없다(F4) · 마스킹 잔존 시 `pack-b.md`가 없고 `codexSkipped:true`(D14·F5).
- 출처마다 `[S<n>] <kind> · <경로@sha | 페이지>`가 `pack.json`과 두 팩 헤더에 있다(G4).
- 위키 검색어 = 제목·경로·파일 basename + diff 추가 줄의 SQL 테이블명·선언 식별자(`pack.json.wikiTerms`) — 제목·파일명에 없는 테이블명만 언급한 페이지도 선택된다(plan R4-5, spec §5.3-2).

## Cautions

- **팩 B에 「허용 목록에 없는 출처」를 넣는 분기를 만들지 마라. 이유:** 전송 범위를 넓히는 쪽으로 실패하지 않는다(D14·F4). 뺀 출처는 `(Codex 미제공)`으로 헤더에 남긴다.
- **어댑터 `projects` 등록을 전송 허가로 읽지 마라 — 기준선 원문의 팩 B 투입은 대상 저장소·docsRoot 프로젝트·이슈·본문만. 이유:** R1-3 — 어댑터 §6 허용 범위는 「Baseline이 가리키는 공통 문서·대상 저장소 문서」다. `projects`는 수집 가능 범위(§5.1-5 SHA 해소)이지 전송 가능 범위가 아니다.
- **필수 문서(`policy.docs`·`docsMap.always`)의 파일·절 누락은 `PackError`(ERR exit 2). `missing`을 버리고 정상 출처로 등록하지 마라. 이유:** R1-8 — 정책 절 제목이 바뀌거나 공통 문서 체크아웃이 없으면 정책을 읽지 않은 `APPROVE`가 나온다. 규칙 문서(`docsMap.rules`)만 `missing:true`로 계속.
- **마스킹은 본문·댓글·발췌 전체에 건다 — 발췌만 걸지 마라. 이유:** D4 범위(본문·댓글·발췌). 워크트리 코드는 Codex가 직접 읽으므로 여기서 가리지 않는다(D4 — 코드 안 개인정보는 L5 발견).
- **`residual`은 `[masked:` 로 시작하는 매치를 무시한다. 이유:** 뒤보기 패턴(`token=`)이 가린 자리 자체를 다시 매치해 거짓 잔존이 된다.
- **위키 검색어를 제목·파일명에서만 뽑지 마라 — diff 추가 줄의 테이블명(FROM/JOIN/INTO/UPDATE/TABLE 뒤·`@Table`)·선언 식별자(class/function/MyBatis id)를 `codeTerms`로 더하고 용어집 대조 텍스트에도 추가 줄을 넣어라. 추출은 스크립트 규칙(결정적)이고 어댑터 키·LLM 입력을 두지 않는다. 이유:** plan R4-5(사용자 결정) — spec §5.3-2·어댑터 §5 가 요구한 기능명·테이블명 검색이 빠지면 테이블명만 언급한 위키 교훈이 조용히 누락된다. 삭제 줄은 제외(바뀐 뒤 코드가 기준).
- **위키 페이지는 전문이 아니라 `excerpt`. 이유:** 발췌 상한은 어댑터 값(§5.3-2) — 프롬프트 비대화 방지.
- **공통 문서 참조는 `경로#절접두` 로 절만 뽑는다. 정책 전문을 넣지 마라. 이유:** 어댑터 4.2 「항상 읽을 절」 — 정책 전문(350줄)은 두 모델 프롬프트를 압도한다.
- **`repo:` 문서를 워크트리의 파일로 `readFileSync` 하지 마라 — `git ls-tree <head> -- <경로>`로 모드를 확인한 뒤 일반 blob(100644·100755)만 `git show <head>:<경로>`로 읽고, 심볼릭 링크(120000)·서브모듈·부재는 `missing`. 이유:** plan R5-1 — MR 이 AGENTS.md 를 워크트리 밖(개인 위키 등)으로 향하는 링크로 바꾸면 fs 읽기는 그 대상 본문을 「대상 저장소 문서」로 팩 B 에 넣는다(F4 위반, 개인정보 정규식에 안 걸리는 내용은 그대로 전송). 커밋 트리 조회는 경로 중간의 링크도 따라가지 않고 작업 트리의 미커밋 변경도 읽지 않는다(F6).
- **대상 저장소 문서(`repo:` 접두)는 다른 체크아웃의 작업 트리를 상대 경로로 읽지 마라 — 워크트리(고정 head) 또는 `repository/files/…/raw?ref=<head>`. 이유:** plan R3-6 — 어댑터 §2·§4가 요구하는 `AGENTS.md`·저장소 `docs/`를 docsRoot 기준으로는 표현할 수 없고, 작업 트리를 읽으면 고정 head·출처 SHA(F6)가 깨진다. 누락은 저장소 속성이라 `missing:true`로 계속(필수 문서 ERR 규칙의 예외).
