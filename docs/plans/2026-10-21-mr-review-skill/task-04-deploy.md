# task-04 — 배포본 zip 대조 (deploy) (spec §5.2b · D6 · SC-3 `deploy.json`)

**목적**: 어댑터 4.7 규칙으로 거른 **배포 목록·삭제 목록**을 `--no-renames` 기준으로 먼저 계산하고, 첨부 zip을 내려받아 ① 주석 SHA = head ② 파일 목록 = 배포 목록 ③ 각 파일 바이트 = `git show <head>:<경로>` ④ 본문 삭제 목록 = 삭제 목록을 **모델 없이** 대조한다. zip은 자체 리더로 읽는다(P3).

## Files

- Create: `dev-workflow/skills/mr-review/scripts/lib/deploy.mjs`
- Modify: `dev-workflow/skills/mr-review/scripts/mr-review.mjs` (`deploy` 등록)
- Test: `tests/mr-review/deploy.test.mjs`

## Prep

- spec §5.2b 전체(기대 목록 → zip 유무 무관 대조 ①~④ → 결과 3종 → fail-closed) · D6 · F7.
- 엔트리포인트 **SC-3** `deploy.json` 정본(결과 순서 규칙) · **SC-6** · **SC-2** `deploy.targets`·`excludes`.
- 팀 정책 §6.1 사실: zip은 `git -c core.autocrlf=false archive --format=zip <head> -- <파일들>`로 만들어 **zip 주석(EOCD comment)에 커밋 SHA 40자**가 들어간다(2026-10-21 실측). 삭제만 있는 변경은 zip 없이 「배포본: 삭제만」 + 삭제 목록.
- GitLab 업로드 다운로드: `glab api projects/<id>/uploads/<secret>/<filename>` → zip 바이트(실측 OK).
- task-01~03 산출물: `lib/adapter.mjs`(`matchesAny`) · `lib/gitlab.mjs`(`apiRaw`) · `check.json`의 `attachments`·`deployExempt`.

## Deps

02 (03의 `check.json`도 입력이지만 테스트는 직접 둔다)

## Steps

### 1. 테스트 작성 (RED)

`tests/mr-review/deploy.test.mjs`를 아래 내용 그대로 만든다.

````js
// deploy 계약 테스트 (spec §5.2b · SC-3 deploy.json) — 실제 git archive 로 zip 을 만들어 자체 리더·대조를 검증한다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp, writeAdapter, initRepos, fakeGlab, runCli, readJson, git, LIB } from './helpers.mjs';

const { readZip, crc32, parseDeletedList, expectedLists } = await import(join(LIB, 'deploy.mjs'));
const SECRET = '3'.repeat(32);

function archive(checkout, sha, out, files) {
  const r = spawnSync('git', ['-c', 'core.autocrlf=false', 'archive', '--format=zip', '-o', out, sha, '--', ...files], { cwd: checkout, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  return out;
}

function workdir(root, { checkout, baseSha, headSha, mode = 'worktree', attachments = [], description = '', diffs = [], deployExempt = false }) {
  const work = join(root, 'work');
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'mr.json'), JSON.stringify({ project: { name: 'alpha', id: 101, checkout, deployExempt }, iid: 7, description, api_head: headSha, diffs, notes: [], closes_issues: [], versions: [] }));
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify({ mode, target_sha: baseSha, base_sha: baseSha, head_sha: headSha, checkout: mode === 'worktree' ? checkout : null, worktree: null, attempts: 1, unrecovered: [], rebuilt: [] }));
  writeFileSync(join(work, 'check.json'), JSON.stringify({ attachments, deployExempt, deployNote: null }));
  return work;
}

test('readZip: git archive zip 의 주석 SHA·목록·바이트를 읽는다', () => {
  const root = tmp();
  const { checkout, headSha } = initRepos(root);
  const zip = archive(checkout, headSha, join(root, 'a.zip'), ['src/main/java/app/A.java', 'src/main/java/app/B.java']);
  const z = readZip(readFileSync(zip));
  assert.equal(z.comment.trim(), headSha);
  assert.deepEqual(z.entries.map((e) => e.name).filter((n) => !n.endsWith('/')).sort(), ['src/main/java/app/A.java', 'src/main/java/app/B.java']);
  const a = z.entries.find((e) => e.name === 'src/main/java/app/A.java');
  assert.equal(z.read(a).toString('utf8'), 'class A { int v = 2; }\n');
});

test('expectedLists: --no-renames 기준 배포 목록·삭제 목록을 4.7 규칙으로 거른다 (worktree · diff-only)', async () => {
  const root = tmp();
  const adapterFile = writeAdapter(root);
  const { loadAdapter } = await import(join(LIB, 'adapter.mjs'));
  const adapter = loadAdapter(adapterFile);
  const { checkout, baseSha, headSha } = initRepos(root);
  const wt = expectedLists({ adapter, mr: { diffs: [] }, snap: { mode: 'worktree', checkout, base_sha: baseSha, head_sha: headSha } });
  assert.deepEqual(wt, { deploy: ['src/main/java/app/A.java', 'src/main/java/app/B.java'], deleted: ['src/main/java/app/Old.java'] });   // docs/specs 는 제외
  const diffs = [
    { old_path: 'src/main/x.sql', new_path: 'src/main/y.sql', new_file: false, renamed_file: true, deleted_file: false },
    { old_path: 'docs/a.md', new_path: 'docs/a.md', new_file: true, renamed_file: false, deleted_file: false },
    { old_path: 'src/test/T.java', new_path: 'src/test/T.java', new_file: true, renamed_file: false, deleted_file: false },
    { old_path: 'assets/res/app.js', new_path: 'assets/res/app.js', new_file: false, renamed_file: false, deleted_file: true },
  ];
  const d = expectedLists({ adapter, mr: { diffs }, snap: { mode: 'diff-only' } });
  assert.deepEqual(d, { deploy: ['src/main/y.sql'], deleted: ['assets/res/app.js', 'src/main/x.sql'] });   // 이름 변경 = 삭제 + 추가
});

test('parseDeletedList: 「배포본」 항목 아래 목록(불릿·펜스·삭제: 접두)을 경로로 뽑는다', () => {
  const body = '## 배포·롤백\n- 배포 대상: 운영\n- 배포본: [zip](/uploads/x/a.zip)\n  - 삭제: `src/main/java/app/Old.java`\n  - assets/res/old.js\n```\nassets/res/legacy.css\n```\n\n## 셀프 리뷰\n- src/not/this.js\n';
  assert.deepEqual(parseDeletedList(body), ['assets/res/legacy.css', 'assets/res/old.js', 'src/main/java/app/Old.java']);
  assert.deepEqual(parseDeletedList('## 배포·롤백\n- 배포본: 비해당\n'), []);
});

test('일치: head 기준 zip + 본문 삭제 목록 → 일치', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const zip = archive(checkout, headSha, join(root, 'd.zip'), ['src/main/java/app/A.java', 'src/main/java/app/B.java']);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: zip }]);
  const work = workdir(root, { checkout, baseSha, headSha, attachments: [{ url: `/uploads/${SECRET}/d.zip`, kind: 'zip', filename: 'd.zip', secret: SECRET, where: 'body' }], description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: src/main/java/app/Old.java\n' });
  const r = runCli(['deploy', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.first, 'DEPLOY 일치');
  const d = readJson(join(work, 'deploy.json'));
  assert.equal(d.applicable, true);
  assert.deepEqual(d.expected, { deploy: ['src/main/java/app/A.java', 'src/main/java/app/B.java'], deleted: ['src/main/java/app/Old.java'] });
  assert.equal(d.zip.downloaded, true);
  assert.equal(d.zip.comment_sha, headSha);
  assert.deepEqual(d.mismatches, []);
  assert.ok(existsSync(join(work, 'zip', 'd.zip')));
});

test('불일치: base 기준 zip(옛 주석·A 옛 내용·B 없음) + 삭제 목록 누락 → 4종 mismatch', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const zip = archive(checkout, baseSha, join(root, 'old.zip'), ['src/main/java/app/A.java', 'README.md']);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/old\\.zip$`, file: zip }]);
  const work = workdir(root, { checkout, baseSha, headSha, attachments: [{ url: `/uploads/${SECRET}/old.zip`, kind: 'zip', filename: 'old.zip', secret: SECRET, where: 'body' }], description: '## 배포·롤백\n- 배포본: [old.zip](/uploads/x/old.zip)\n' });
  const r = runCli(['deploy', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.first, 'DEPLOY 불일치');
  const d = readJson(join(work, 'deploy.json'));
  const kinds = d.mismatches.map((m) => m.kind).sort();
  assert.deepEqual(kinds, ['bytes', 'comment_sha', 'deleted_list', 'extra_in_zip', 'missing_in_zip']);
  assert.equal(d.mismatches.find((m) => m.kind === 'missing_in_zip').path, 'src/main/java/app/B.java');
  assert.equal(d.mismatches.find((m) => m.kind === 'extra_in_zip').path, 'README.md');
  assert.equal(d.mismatches.find((m) => m.kind === 'bytes').path, 'src/main/java/app/A.java');
});

test('zip 누락 · 어댑터 배포 제외 프로젝트 · 삭제만(zip 없이 ④만)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const w1 = workdir(root, { checkout, baseSha, headSha, description: '## 배포·롤백\n- 배포본: 첨부 예정\n' });
  assert.equal(runCli(['deploy', '--adapter', adapter, '--work', w1], fakeGlab(root, []).env).first, 'DEPLOY zip 누락');
  const root2 = tmp();
  const adapter2 = writeAdapter(root2);
  const w2 = workdir(root2, { checkout: null, baseSha: 'b'.repeat(40), headSha: 'a'.repeat(40), mode: 'diff-only', deployExempt: true, diffs: [{ old_path: 'docs/x.md', new_path: 'docs/x.md', new_file: true, renamed_file: false, deleted_file: false }] });
  const r2 = runCli(['deploy', '--adapter', adapter2, '--work', w2], fakeGlab(root2, []).env);
  assert.equal(r2.first, 'DEPLOY 해당 없음');
  assert.equal(readJson(join(w2, 'deploy.json')).applicable, false);
  const root3 = tmp();
  const adapter3 = writeAdapter(root3);
  const delDiffs = [{ old_path: 'assets/res/old.js', new_path: 'assets/res/old.js', new_file: false, renamed_file: false, deleted_file: true }];
  const w3 = workdir(root3, { checkout: null, baseSha: 'b'.repeat(40), headSha: 'a'.repeat(40), mode: 'diff-only', diffs: delDiffs, description: '## 배포·롤백\n- 배포본: 삭제만\n  - assets/res/old.js\n' });
  assert.equal(runCli(['deploy', '--adapter', adapter3, '--work', w3], fakeGlab(root3, []).env).first, 'DEPLOY 일치');
  const w4 = workdir(root3, { checkout: null, baseSha: 'b'.repeat(40), headSha: 'a'.repeat(40), mode: 'diff-only', diffs: delDiffs, description: '## 배포·롤백\n- 배포본: 삭제만\n' });
  const r4 = runCli(['deploy', '--adapter', adapter3, '--work', w4], fakeGlab(root3, []).env);
  assert.equal(r4.first, 'DEPLOY 불일치');
  assert.equal(readJson(join(w4, 'deploy.json')).mismatches[0].kind, 'deleted_list');
});

test('본문에만 있는 삭제 경로: 기대 삭제 목록이 비어 있어도 집합 비교해 deleted_list 불일치 (R1-4)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const zip = archive(checkout, headSha, join(root, 'd.zip'), ['src/main/java/app/A.java']);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: zip }]);
  const diffs = [{ old_path: 'src/main/java/app/A.java', new_path: 'src/main/java/app/A.java', new_file: false, renamed_file: false, deleted_file: false }];   // 삭제 없음
  const att = [{ url: `/uploads/${SECRET}/d.zip`, kind: 'zip', filename: 'd.zip', secret: SECRET, where: 'body' }];
  const w1 = workdir(root, { checkout: null, baseSha, headSha, mode: 'diff-only', attachments: att, diffs, description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: src/main/java/app/Keep.java\n' });
  const r1 = runCli(['deploy', '--adapter', adapter, '--work', w1], g.env);
  assert.equal(r1.code, 0, r1.out + r1.err);
  const d1 = readJson(join(w1, 'deploy.json'));
  assert.deepEqual(d1.expected.deleted, []);
  assert.deepEqual(d1.bodyDeletedList, ['src/main/java/app/Keep.java']);
  const dl = d1.mismatches.find((m) => m.kind === 'deleted_list');
  assert.ok(dl, JSON.stringify(d1.mismatches));
  assert.match(dl.detail, /Keep\.java/);
  const w2 = workdir(root, { checkout: null, baseSha, headSha, mode: 'diff-only', attachments: att, diffs, description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n' });
  runCli(['deploy', '--adapter', adapter, '--work', w2], g.env);
  assert.ok(!readJson(join(w2, 'deploy.json')).mismatches.some((m) => m.kind === 'deleted_list'));   // 둘 다 비어 있으면 일치
  const w3 = workdir(root, { checkout, baseSha, headSha, attachments: att, description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - src/main/java/app/Old.java\n  - src/main/java/app/Keep.java\n' });
  runCli(['deploy', '--adapter', adapter, '--work', w3], g.env);
  assert.ok(readJson(join(w3, 'deploy.json')).mismatches.some((m) => m.kind === 'deleted_list' && /Keep\.java/.test(m.detail)));   // 기대 ⊂ 본문이어도 불일치
});

test('기대 배포·삭제 목록이 모두 비어도 본문에 삭제 목록이 있으면 비해당으로 끝내지 않고 ④ 만 대조해 불일치 (R4-2)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const diffs = [{ old_path: 'docs/x.md', new_path: 'docs/x.md', new_file: true, renamed_file: false, deleted_file: false }];   // 문서만 — 기대 배포·삭제 0
  const w1 = workdir(root, { checkout: null, baseSha: 'b'.repeat(40), headSha: 'a'.repeat(40), mode: 'diff-only', diffs, description: '## 배포·롤백\n- 배포본: 비해당\n  - 삭제: src/main/java/app/Keep.java\n' });
  const r1 = runCli(['deploy', '--adapter', adapter, '--work', w1], fakeGlab(root, []).env);
  assert.equal(r1.first, 'DEPLOY 불일치');
  const d1 = readJson(join(w1, 'deploy.json'));
  assert.equal(d1.applicable, true);
  assert.deepEqual(d1.expected, { deploy: [], deleted: [] });
  assert.ok(d1.mismatches.some((m) => m.kind === 'deleted_list' && /Keep\.java/.test(m.detail)), JSON.stringify(d1.mismatches));
  assert.equal(d1.zip.attachment, null);                                                     // zip 단계는 돌지 않는다(기대 배포 없음)
  assert.match(d1.reason, /본문 삭제 목록만/);
  const w2 = workdir(root, { checkout: null, baseSha: 'b'.repeat(40), headSha: 'a'.repeat(40), mode: 'diff-only', diffs, description: '## 배포·롤백\n- 배포본: 비해당\n' });
  assert.equal(runCli(['deploy', '--adapter', adapter, '--work', w2], fakeGlab(root, []).env).first, 'DEPLOY 해당 없음');   // 둘 다 비어 있으면 그대로 비해당
  assert.equal(readJson(join(w2, 'deploy.json')).applicable, false);
});

test('CRC 손상 zip: 목록·주석·내용 길이는 맞아도 read() 가 CRC 불일치를 던져 corrupt → 대조 불가 (R2-7)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const good = readFileSync(archive(checkout, headSha, join(root, 'g.zip'), ['src/main/java/app/A.java', 'src/main/java/app/B.java']));
  const z = readZip(good);
  const e = z.entries.find((x) => x.name === 'src/main/java/app/A.java');
  assert.equal(crc32(z.read(e)), e.crc);                                   // 정상 zip 은 central directory CRC 와 일치
  const bad = Buffer.from(good);
  bad.writeUInt32LE((e.crc ^ 0xffffffff) >>> 0, e.cd + 16);                // central directory 의 CRC 만 뒤집는다(데이터·목록·주석 불변)
  const zb = readZip(bad);
  assert.equal(zb.comment.trim(), headSha);
  assert.throws(() => zb.read(zb.entries.find((x) => x.name === e.name)), /CRC 불일치/);
  const badFile = join(root, 'bad-crc.zip');
  writeFileSync(badFile, bad);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: badFile }]);
  const work = workdir(root, { checkout, baseSha, headSha, attachments: [{ url: `/uploads/${SECRET}/d.zip`, kind: 'zip', filename: 'd.zip', secret: SECRET, where: 'body' }], description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: src/main/java/app/Old.java\n' });
  const r = runCli(['deploy', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.first, 'DEPLOY 대조 불가');
  const d = readJson(join(work, 'deploy.json'));
  assert.ok(d.mismatches.some((m) => m.kind === 'corrupt' && m.path === 'src/main/java/app/A.java' && /CRC/.test(m.detail)));
});

test('local header 가 central directory 와 다른 파일을 가리키면 corrupt → 대조 불가 (R3-8)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const good = readFileSync(archive(checkout, headSha, join(root, 'g.zip'), ['src/main/java/app/A.java', 'src/main/java/app/B.java']));
  const z = readZip(good);
  const e = z.entries.find((x) => x.name === 'src/main/java/app/A.java');
  const bad = Buffer.from(good);
  bad.write('src/main/java/app/Z.java', e.lho + 30, 'utf8');                 // local header 의 파일명만 같은 길이의 다른 이름으로(central·CRC·데이터 불변)
  const zb = readZip(bad);
  assert.equal(zb.comment.trim(), headSha);
  assert.throws(() => zb.read(zb.entries.find((x) => x.name === e.name)), /local header 파일명 불일치/);
  const badFile = join(root, 'bad-local.zip');
  writeFileSync(badFile, bad);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: badFile }]);
  const work = workdir(root, { checkout, baseSha, headSha, attachments: [{ url: `/uploads/${SECRET}/d.zip`, kind: 'zip', filename: 'd.zip', secret: SECRET, where: 'body' }], description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: src/main/java/app/Old.java\n' });
  const r = runCli(['deploy', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.first, 'DEPLOY 대조 불가');
  assert.ok(readJson(join(work, 'deploy.json')).mismatches.some((m) => m.kind === 'corrupt' && m.path === 'src/main/java/app/A.java' && /파일명 불일치/.test(m.detail)));
});

test('대조 불가: 다운로드 실패 · 손상 zip · diff-only 모드의 바이트 대조', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const att = [{ url: `/uploads/${SECRET}/d.zip`, kind: 'zip', filename: 'd.zip', secret: SECRET, where: 'body' }];
  const w1 = workdir(root, { checkout, baseSha, headSha, attachments: att });
  const r1 = runCli(['deploy', '--adapter', adapter, '--work', w1], fakeGlab(root, []).env);
  assert.equal(r1.first, 'DEPLOY 대조 불가');
  assert.equal(readJson(join(w1, 'deploy.json')).mismatches[0].kind, 'download');
  const bad = join(root, 'bad.zip');
  writeFileSync(bad, 'PK\u0003\u0004 not a zip');
  const g2 = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: bad }]);
  const w2 = workdir(root, { checkout, baseSha, headSha, attachments: att });
  const r2 = runCli(['deploy', '--adapter', adapter, '--work', w2], g2.env);
  assert.equal(r2.first, 'DEPLOY 대조 불가');
  assert.equal(readJson(join(w2, 'deploy.json')).mismatches[0].kind, 'corrupt');
  const zip = archive(checkout, headSha, join(root, 'd.zip'), ['src/main/java/app/A.java', 'src/main/java/app/B.java']);
  const g3 = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: zip }]);
  const diffs = [
    { old_path: 'src/main/java/app/A.java', new_path: 'src/main/java/app/A.java', new_file: false, renamed_file: false, deleted_file: false },
    { old_path: 'src/main/java/app/B.java', new_path: 'src/main/java/app/B.java', new_file: true, renamed_file: false, deleted_file: false },
  ];
  const w3 = workdir(root, { checkout: null, baseSha, headSha, mode: 'diff-only', attachments: att, diffs });
  const r3 = runCli(['deploy', '--adapter', adapter, '--work', w3], g3.env);
  assert.equal(r3.first, 'DEPLOY 대조 불가');
  const d3 = readJson(join(w3, 'deploy.json'));
  assert.equal(d3.zip.comment_sha, headSha);
  assert.ok(d3.mismatches.some((m) => m.kind === 'bytes' && /diff-only/.test(m.detail)));
});
````

실행:

```bash
node --test tests/mr-review/deploy.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: tests 10 · pass 0 · fail 10.

### 2. `deploy.mjs`

`dev-workflow/skills/mr-review/scripts/lib/deploy.mjs`를 아래 내용 그대로 만든다.

````js
// deploy.mjs — spec §5.2b. 기대 목록(4.7 규칙·--no-renames) → zip 다운로드 → ①주석 SHA ②목록 ③바이트 ④삭제 목록 대조. 모델 없이.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { apiRaw } from './gitlab.mjs';
import { matchesAny } from './adapter.mjs';

const MAX_BUFFER = 512 * 1024 * 1024;

function gitZ(cwd, args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${(r.stderr || '').trim().slice(0, 200)}`);
  return r.stdout.split('\0').filter(Boolean);
}

export function expectedLists({ adapter, mr, snap }) {
  const inDeploy = (p) => matchesAny(p, adapter.deploy.targets) && !matchesAny(p, adapter.deploy.excludes);
  let acmr = [];
  let del = [];
  if (snap.mode === 'worktree') {
    acmr = gitZ(snap.checkout, ['diff', '-z', '--no-renames', '--name-only', '--diff-filter=ACMR', snap.base_sha, snap.head_sha]);
    del = gitZ(snap.checkout, ['diff', '-z', '--no-renames', '--name-only', '--diff-filter=D', snap.base_sha, snap.head_sha]);
  } else {
    for (const d of mr.diffs) {
      if (d.deleted_file) del.push(d.old_path);
      else if (d.renamed_file) { del.push(d.old_path); acmr.push(d.new_path); }
      else acmr.push(d.new_path);
    }
  }
  return { deploy: [...new Set(acmr.filter(inDeploy))].sort(), deleted: [...new Set(del.filter(inDeploy))].sort() };
}

// 「배포본」 줄 아래(같은 절 안) 목록 — 불릿·번호·펜스 한 줄 한 경로. `삭제:` 접두 허용. 경로 모양(구분자 또는 확장자)만 받는다.
export function parseDeletedList(description) {
  const lines = description.split('\n');
  const start = lines.findIndex((l) => /배포본\s*[:：]/.test(l));
  if (start < 0) return [];
  const out = [];
  let fence = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^##\s/.test(l)) break;
    if (/^\s*```/.test(l)) { fence = !fence; continue; }
    let s = l.trim();
    if (!fence) {
      if (!/^([-*]|\d+\.)\s/.test(s)) { if (s === '') continue; break; }   // 목록이 끝나면(다른 불릿 아닌 줄) 멈춘다
      s = s.replace(/^([-*]|\d+\.)\s+/, '');
    }
    s = s.replace(/^삭제\s*[:：]\s*/, '').replace(/`/g, '').trim();
    if (!s || /\s/.test(s) || /^\[.*\]\(.*\)$/.test(s) || s.includes('://')) continue;
    if (s.includes('/') || /\.[A-Za-z0-9]+$/.test(s)) out.push(s);
  }
  return [...new Set(out)].sort();
}

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0; } return t; })();
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// 자체 ZIP 리더(P3) — central directory 로 목록, stored(0)·deflate(8) 만. zip64 미지원(git archive 산출물 범위).
// read() 는 central directory 의 CRC-32·비압축 크기와 대조한다 — 표준 리더가 Bad CRC 로 거부할 배포본을 「일치」로 보증하지 않는다.
export function readZip(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip EOCD 없음');
  const count = buf.readUInt16LE(eocd + 10);
  const cdOff = buf.readUInt32LE(eocd + 16);
  const cLen = buf.readUInt16LE(eocd + 20);
  const comment = buf.subarray(eocd + 22, eocd + 22 + cLen).toString('utf8');
  const entries = [];
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip central directory 손상');
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nLen = buf.readUInt16LE(p + 28);
    const eLen = buf.readUInt16LE(p + 30);
    const cmLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nLen).toString('utf8');
    entries.push({ name, method, crc, csize, usize, lho, cd: p });
    p += 46 + nLen + eLen + cmLen;
  }
  const read = (e) => {
    const h = e.lho;
    if (h + 30 > buf.length || buf.readUInt32LE(h) !== 0x04034b50) throw new Error(`zip local header 손상: ${e.name}`);
    const nLen = buf.readUInt16LE(h + 26);
    const eLen = buf.readUInt16LE(h + 28);
    // local header ↔ central directory 정합(R3-8) — 파일명·압축 방식이 다르면 표준 리더가 거부하는 zip 이다
    const lName = buf.subarray(h + 30, h + 30 + nLen).toString('utf8');
    const lMethod = buf.readUInt16LE(h + 8);
    if (lName !== e.name) throw new Error(`zip local header 파일명 불일치(${lName} ≠ ${e.name})`);
    if (lMethod !== e.method) throw new Error(`zip local header 압축 방식 불일치(${lMethod} ≠ ${e.method}): ${e.name}`);
    const start = h + 30 + nLen + eLen;
    if (start + e.csize > buf.length) throw new Error(`zip 데이터 범위 초과: ${e.name}`);
    const data = buf.subarray(start, start + e.csize);
    let out;
    if (e.method === 0) out = Buffer.from(data);
    else if (e.method === 8) out = zlib.inflateRawSync(data);
    else throw new Error(`지원하지 않는 압축 방식(${e.method}): ${e.name}`);
    if (out.length !== e.usize) throw new Error(`zip 크기 불일치(${out.length} ≠ ${e.usize}): ${e.name}`);
    const c = crc32(out);
    if (c !== e.crc) throw new Error(`zip CRC 불일치(${c.toString(16)} ≠ ${e.crc.toString(16)}): ${e.name}`);
    return out;
  };
  return { comment, entries, read };
}

function gitShow(cwd, sha, p) {
  const r = spawnSync('git', ['-C', cwd, 'show', `${sha}:${p}`], { maxBuffer: MAX_BUFFER });
  if (r.status !== 0) return null;
  return r.stdout;
}

export function deploy({ adapter, work }) {
  const mr = JSON.parse(fs.readFileSync(path.join(work, 'mr.json'), 'utf8'));
  const snap = JSON.parse(fs.readFileSync(path.join(work, 'snapshot.json'), 'utf8'));
  const check = JSON.parse(fs.readFileSync(path.join(work, 'check.json'), 'utf8'));
  const out = { applicable: false, reason: null, expected: { deploy: [], deleted: [] }, zip: { attachment: null, downloaded: false, comment_sha: null, entries: [] }, bodyDeletedList: parseDeletedList(mr.description || ''), result: '해당 없음', mismatches: [] };
  const exempt = check.deployExempt === true || mr.project?.deployExempt === true;
  if (exempt) { out.reason = '어댑터 배포 제외 프로젝트'; return finish(work, out); }
  out.expected = expectedLists({ adapter, mr, snap });
  if (out.expected.deploy.length + out.expected.deleted.length === 0) {
    // 기대 변경이 없어도 본문에 삭제 목록이 있으면 비해당으로 끝내지 않는다(R4-2) — zip 단계는 건너뛰고 ④ 만 돌려 「기대에 없는 삭제 지시」를 불일치로 판정에 전달한다(배포자가 본문대로 정상 파일을 지우는 경로 차단)
    if (out.bodyDeletedList.length === 0) { out.reason = '운영 배포 대상 변경 없음'; return finish(work, out); }
    out.reason = '운영 배포 대상 변경 없음 — 본문 삭제 목록만 대조(④)';
  }
  out.applicable = true;
  const mm = out.mismatches;

  if (out.expected.deploy.length > 0) {
    const zips = (check.attachments || []).filter((a) => a.kind === 'zip');
    const att = zips.filter((a) => a.where === 'body').pop() || zips.pop() || null;
    if (!att) { out.result = 'zip 누락'; }
    else {
      out.zip.attachment = att.filename;
      let buf = null;
      try {
        buf = apiRaw(`projects/${mr.project.id}/uploads/${att.secret}/${att.filename}`);
        fs.mkdirSync(path.join(work, 'zip'), { recursive: true });
        fs.writeFileSync(path.join(work, 'zip', path.basename(att.filename)), buf);
        out.zip.downloaded = true;
      } catch (e) {
        mm.push({ kind: 'download', path: null, detail: `다운로드 실패: ${e.message.slice(0, 160)}` });
      }
      let z = null;
      if (buf) {
        try { z = readZip(buf); } catch (e) { mm.push({ kind: 'corrupt', path: null, detail: `zip 판독 실패: ${e.message}` }); }
      }
      if (z) {
        const cm = z.comment.trim().match(/[0-9a-f]{7,40}/);
        out.zip.comment_sha = cm ? cm[0] : (z.comment.trim() || null);
        if (!cm || !snap.head_sha.startsWith(cm[0])) mm.push({ kind: 'comment_sha', path: null, detail: `zip 주석 ${out.zip.comment_sha ?? '(없음)'} ≠ head ${snap.head_sha}` });
        const files = z.entries.filter((e) => !e.name.endsWith('/'));
        out.zip.entries = files.map((e) => e.name).sort();
        const inZip = new Set(out.zip.entries);
        const expSet = new Set(out.expected.deploy);
        for (const p of out.expected.deploy) if (!inZip.has(p)) mm.push({ kind: 'missing_in_zip', path: p, detail: '배포 목록에 있으나 zip 에 없음' });
        for (const p of out.zip.entries) if (!expSet.has(p)) mm.push({ kind: 'extra_in_zip', path: p, detail: 'zip 에 있으나 배포 목록에 없음' });
        if (snap.mode === 'worktree') {
          for (const e of files) {
            if (!expSet.has(e.name)) continue;
            let zb;
            try { zb = z.read(e); } catch (err) { mm.push({ kind: 'corrupt', path: e.name, detail: err.message }); continue; }
            const gb = gitShow(snap.checkout, snap.head_sha, e.name);
            if (!gb || !gb.equals(zb)) mm.push({ kind: 'bytes', path: e.name, detail: `git show ${snap.head_sha.slice(0, 7)}:${e.name} 와 바이트 불일치` });
          }
        } else {
          mm.push({ kind: 'bytes', path: null, detail: 'diff-only 모드 — 로컬 체크아웃이 없어 바이트 대조 불가(로컬 clone 권장)' });
        }
      }
    }
  }
  // ④ 삭제 목록은 기대가 비어 있어도 항상 집합 비교(순서 무관) — 본문에만 있는 삭제 지시(기대에 없는 경로)는 배포자가 정상 파일을 지우게 하므로 불일치다
  {
    const expDel = new Set(out.expected.deleted);
    const bodyDel = new Set(out.bodyDeletedList);
    const same = expDel.size === bodyDel.size && [...expDel].every((p) => bodyDel.has(p));
    if (!same) mm.push({ kind: 'deleted_list', path: null, detail: `삭제 목록 불일치 — 기대 [${[...expDel].join(', ') || '없음'}] / 본문 [${[...bodyDel].join(', ') || '없음'}]` });
  }
  if (out.result !== 'zip 누락') {
    if (mm.some((m) => m.kind === 'download' || m.kind === 'corrupt' || (m.kind === 'bytes' && m.path === null))) out.result = '대조 불가';
    else out.result = mm.length ? '불일치' : '일치';
  }
  return finish(work, out);
}

function finish(work, out) {
  fs.writeFileSync(path.join(work, 'deploy.json'), JSON.stringify(out, null, 2));
  return out;
}

export async function cmdDeploy(args, ctx) {
  const d = deploy({ adapter: ctx.adapter, work: ctx.work });
  return `DEPLOY ${d.result}`;
}
````

### 3. CLI 등록

`mr-review.mjs`에 import 추가 · `COMMANDS`의 `// task-04: deploy` 줄을 바꾼다:

```js
import { cmdDeploy } from './lib/deploy.mjs';
```
```js
  deploy: cmdDeploy,
```

### 4. GREEN 확인 · 커밋

```bash
node --test tests/mr-review/deploy.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
node --check dev-workflow/skills/mr-review/scripts/lib/deploy.mjs && echo CHECK_OK
```

기대: deploy 10/10 · 앞선 27/27 · `CHECK_OK`.

```bash
git add dev-workflow/skills/mr-review/scripts/lib/deploy.mjs dev-workflow/skills/mr-review/scripts/mr-review.mjs tests/mr-review/deploy.test.mjs
git commit -m "feat(mr-review): deploy — 4.7 규칙 배포·삭제 목록, 자체 zip 리더, 주석 SHA·목록·바이트·삭제 목록 대조 (spec §5.2b, D6)"
```

## Acceptance Criteria

- `node --test tests/mr-review/deploy.test.mjs` → 11/11.
- `git archive`로 만든 zip의 주석 SHA·목록·바이트를 외부 `unzip` 없이 읽는다(P3).
- 삭제만 있는 변경은 zip 없이 ④ 삭제 목록만으로 판정(R3-F2) · 기대 목록은 4.7 규칙으로 거른 것(R3-F4) · 결과가 무엇이든 exit 0(판정은 verdict 몫).
- 기대 배포·삭제 목록이 모두 비어도 본문에 삭제 목록이 있으면 `applicable:true`로 ④ 만 대조해 `deleted_list` 불일치(plan R4-2) — 둘 다 비면 그대로 「해당 없음」.

## Cautions

- **기대 목록을 전체 diff 로 비교하지 마라 — 4.7 규칙으로 거른 뒤에만. 이유:** spec·문서를 함께 고친 정상 MR이 불일치로 떨어진다(R3-F4).
- **삭제 목록은 zip 유무와 무관하게 대조한다. 「배포본: 삭제만」 표기만으로 통과시키지 마라. 이유:** OTA 단말의 이전 파일 제거 누락(R3-F2).
- **삭제 목록 대조는 기대 목록이 비어 있어도 항상 집합 비교다. `expected.deleted.length > 0`일 때만 대조하지 마라. 이유:** R1-4 — 본문에만 적힌 삭제 경로(변경하지 않은 파일)가 통과하면 배포자가 정상 파일을 지운다. 문자열 join 비교도 금지(순서 차이가 거짓 불일치).
- **기대 배포·삭제 목록이 모두 비었다는 이유로 ④ 전에 「해당 없음」으로 반환하지 마라 — 본문 삭제 목록이 비어 있을 때만. 이유:** plan R4-2 — R1-4 와 같은 영역의 다른 경로: 문서만 고친 비면제 MR 본문에 변경하지 않은 운영 파일 삭제를 적어도 `applicable:false`·불일치 0 으로 끝나 모델 발견 없이 APPROVE 까지 간다. 기대 변경이 없으면 zip 단계는 건너뛰고 ④ 만 돈다.
- **`git diff`는 `-z`로 읽어라. 이유:** 한글·공백 경로가 `core.quotePath`로 인용돼 목록이 어긋난다(정책 §6.1과 같은 이유).
- **zip 리더에 zip64·암호화를 넣지 마라. 이유:** git archive 산출물 범위 밖 — YAGNI. 판독 실패는 `corrupt` → 「대조 불가」로 fail-closed.
- **`read()`는 CRC-32·비압축 크기를 central directory 값과 대조한다 — inflate 성공만으로 정상으로 보지 마라. 이유:** R2-7 — 내용·목록·주석이 맞고 CRC만 깨진 zip은 표준 압축 해제가 거부하는 배포본인데 「일치」로 보증된다.
- **`read()`는 local header 의 파일명·압축 방식을 central directory 와 대조한다 — signature·길이만 보지 마라. 이유:** plan R3-8 — central 에는 `A.txt`, local 에는 `B.txt`인 zip 도 CRC·크기가 맞으면 「일치」로 보증되는데 표준 리더(Python `zipfile`)는 BadZipFile 로 거부한다.
- **내려받은 zip은 `work/zip/`에만 둔다. 이유:** F7 — `cleanup`(task-06)이 지운다.
