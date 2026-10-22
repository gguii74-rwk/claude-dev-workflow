// deploy 계약 테스트 (spec §5.2b · SC-3 deploy.json) — 실제 git archive 로 zip 을 만들어 자체 리더·대조를 검증한다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';
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
  const badFlag = Buffer.from(good);                                                   // central 플래그만 1(암호화) — 파일명·CRC·바이트는 정상(C1 R3-8 잔존)
  badFlag.writeUInt16LE(1, e.cd + 8);
  const zf = readZip(badFlag);
  assert.throws(() => zf.read(zf.entries.find((x) => x.name === e.name)), /플래그 불일치/);
  const badEnc = Buffer.from(good);                                                    // local·central 둘 다 1 — 정합은 맞지만 암호화라 읽을 수 없는 배포본
  badEnc.writeUInt16LE(1, e.cd + 8);
  badEnc.writeUInt16LE(1, e.lho + 6);
  const ze = readZip(badEnc);
  assert.throws(() => ze.read(ze.entries.find((x) => x.name === e.name)), /암호화 플래그/);
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

// 최소 zip 작성기(테스트 전용) — entries = [{ name(문자열|Buffer), data, method = 0|8, usize?, made?, ext?, flags? }]
function mkZip(entries, comment = '') {
  const locals = [];
  const cds = [];
  let off = 0;
  for (const e of entries) {
    const raw = Buffer.from(e.data);
    const comp = e.method === 8 ? zlib.deflateRawSync(raw) : raw;
    const name = Buffer.isBuffer(e.name) ? e.name : Buffer.from(e.name, 'utf8');
    const lx = e.localExtra || Buffer.alloc(0);
    const cx = e.centralExtra || Buffer.alloc(0);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(e.flags || 0, 6); lh.writeUInt16LE(e.method || 0, 8);
    lh.writeUInt32LE(crc32(raw), 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(e.usize ?? raw.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(lx.length, 28);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(e.made ?? 0x0314, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(e.flags || 0, 8); cd.writeUInt16LE(e.method || 0, 10);
    cd.writeUInt32LE(crc32(raw), 16); cd.writeUInt32LE(comp.length, 20); cd.writeUInt32LE(e.usize ?? raw.length, 24); cd.writeUInt16LE(name.length, 28); cd.writeUInt16LE(cx.length, 30);
    cd.writeUInt32LE(e.ext ?? ((0o100644 << 16) >>> 0), 38); cd.writeUInt32LE(off, 42);
    locals.push(lh, name, lx, comp);
    cds.push(cd, name, cx);
    off += 30 + name.length + lx.length + comp.length;
  }
  const cdBuf = Buffer.concat(cds);
  const c = Buffer.from(comment, 'utf8');
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12); eocd.writeUInt32LE(off, 16); eocd.writeUInt16LE(c.length, 20);
  return Buffer.concat([...locals, cdBuf, eocd, c]);
}

test('압축 폭탄: 선언 크기를 넘게 풀리는 항목은 할당 전에 멈춘다 — corrupt (impl SDD 이월 T04① + R1-7, 사용자 판정)', () => {
  const z = readZip(mkZip([{ name: 'src/main/java/app/A.java', data: Buffer.alloc(8 << 20), method: 8, usize: 1 }]));
  assert.throws(() => z.read(z.entries[0]), /선언 크기/);
  const big = readZip(mkZip([{ name: 'x.bin', data: Buffer.alloc(4), method: 0, usize: 0x7fffffff }]));
  assert.throws(() => big.read(big.entries[0]), /상한/);
  assert.equal(readZip(mkZip([{ name: 'ok.txt', data: 'hello', method: 8 }])).read(readZip(mkZip([{ name: 'ok.txt', data: 'hello', method: 8 }])).entries[0]).toString(), 'hello');
});

test('zip 구조 교차 검증: EOCD 목차 크기·항목 수·디스크 번호·위치가 어긋나거나 같은 이름이 두 번이면 거부 (impl SDD 이월 T04③ + R1-8, 사용자 판정)', () => {
  const root = tmp();
  const { checkout, headSha } = initRepos(root);
  const good = readFileSync(archive(checkout, headSha, join(root, 'g.zip'), ['src/main/java/app/A.java', 'src/main/java/app/B.java']));
  assert.doesNotThrow(() => readZip(good));
  const eocdAt = good.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const mut = (fn) => { const b = Buffer.from(good); fn(b); return b; };
  assert.throws(() => readZip(mut((b) => b.writeUInt32LE(0, eocdAt + 12))), /EOCD/);                 // 목차 크기 0(R1 재현)
  assert.throws(() => readZip(mut((b) => b.writeUInt16LE(1, eocdAt + 4))), /EOCD/);                  // 디스크 번호
  assert.throws(() => readZip(mut((b) => b.writeUInt16LE(b.readUInt16LE(eocdAt + 10) - 1, eocdAt + 8))), /EOCD/);   // 이 디스크 항목 수 ≠ 전체
  assert.throws(() => readZip(Buffer.concat([good, Buffer.from('trailing')])), /EOCD/);              // EOCD 가 끝이 아니다(주석 길이 불일치)
  assert.throws(() => readZip(mkZip([{ name: 'a.txt', data: '1' }, { name: 'a.txt', data: '2' }])), /중복/);
});

test('zip 항목 유형: 일반 파일을 심볼릭 링크로 바꾼 항목은 git 모드와 대조해 불일치 (impl R1-6)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const good = readFileSync(archive(checkout, headSha, join(root, 'g.zip'), ['src/main/java/app/A.java', 'src/main/java/app/B.java']));
  const e = readZip(good).entries.find((x) => x.name === 'src/main/java/app/A.java');
  const bad = Buffer.from(good);
  bad.writeUInt16LE((3 << 8) | (bad.readUInt16LE(e.cd + 4) & 0xff), e.cd + 4);                      // made-by = Unix
  bad.writeUInt32LE((0o120777 << 16) >>> 0, e.cd + 38);                                              // 외부 속성 = 심볼릭 링크
  const badFile = join(root, 'link.zip');
  writeFileSync(badFile, bad);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: badFile }]);
  const work = workdir(root, { checkout, baseSha, headSha, attachments: [{ url: `/uploads/${SECRET}/d.zip`, kind: 'zip', filename: 'd.zip', secret: SECRET, where: 'body' }], description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: src/main/java/app/Old.java\n' });
  const r = runCli(['deploy', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.first, 'DEPLOY 불일치', r.out + r.err);
  assert.ok(readJson(join(work, 'deploy.json')).mismatches.some((m) => m.kind === 'type' && m.path === 'src/main/java/app/A.java'));
});

test('첨부 파일명은 디코딩 뒤 경로 성분(`/`·`..`)이 있으면 조회하지 않고 대조 불가 · 정상 이름은 인코딩해 조회 (impl SDD 이월 T04②, 사용자 판정)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const desc = '## 배포·롤백\n- 배포본: 첨부\n  - 삭제: src/main/java/app/Old.java\n';
  for (const filename of ['..%2F..%2Fmerge_requests%2F7', '../../merge_requests/7.zip']) {
    const g = fakeGlab(root, [{ match: 'uploads', text: 'NOT A ZIP' }]);
    const work = workdir(root, { checkout, baseSha, headSha, attachments: [{ url: `/uploads/${SECRET}/${filename}`, kind: 'zip', filename, secret: SECRET, where: 'body' }], description: desc });
    const r = runCli(['deploy', '--adapter', adapter, '--work', work], g.env);
    assert.equal(r.first, 'DEPLOY 대조 불가', filename);
    assert.equal(g.calls().length, 0, filename);
  }
  const zip = archive(checkout, headSha, join(root, 'k.zip'), ['src/main/java/app/A.java', 'src/main/java/app/B.java']);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/%EB%B0%B0%ED%8F%AC%20%EB%B3%B8\\.zip$`, file: zip }]);
  const work = workdir(root, { checkout, baseSha, headSha, attachments: [{ url: `/uploads/${SECRET}/%EB%B0%B0%ED%8F%AC%20%EB%B3%B8.zip`, kind: 'zip', filename: '%EB%B0%B0%ED%8F%AC%20%EB%B3%B8.zip', secret: SECRET, where: 'body' }], description: desc });
  assert.equal(runCli(['deploy', '--adapter', adapter, '--work', work], g.env).first, 'DEPLOY 일치');
  assert.ok(existsSync(join(work, 'zip', '배포 본.zip')));
});

// zip 확장 필드 하나(id, 본문) — 0x7075 Unicode Path = 버전 1 + 원래 이름 CRC + 새 이름
const xf = (id, body) => { const h = Buffer.alloc(4); h.writeUInt16LE(id, 0); h.writeUInt16LE(body.length, 2); return Buffer.concat([h, body]); };
const upath = (orig, alt) => { const b = Buffer.alloc(5); b.writeUInt8(1, 0); b.writeUInt32LE(crc32(Buffer.from(orig, 'utf8')), 1); return xf(0x7075, Buffer.concat([b, Buffer.from(alt, 'utf8')])); };

test('zip 확장 필드는 알려진 무해 칸(0x5455 시간·0x7875 Unix 소유자)만 허용 — Unicode 경로(0x7075) 등 그 밖은 거부, 깨진 확장 필드도 거부 (impl R2-1, 사용자 판정)', () => {
  const ut = xf(0x5455, Buffer.from([1, 0, 0, 0, 0]));
  assert.doesNotThrow(() => { const z = readZip(mkZip([{ name: 'a.txt', data: 'x', localExtra: ut, centralExtra: ut }])); z.read(z.entries[0]); });
  assert.throws(() => readZip(mkZip([{ name: 'src/main/A.txt', data: 'x', centralExtra: upath('src/main/A.txt', 'src/main/UNREVIEWED.txt') }])), /확장 필드/);   // R2 재현
  const zl = readZip(mkZip([{ name: 'src/main/A.txt', data: 'x', localExtra: upath('src/main/A.txt', 'src/main/UNREVIEWED.txt') }]));
  assert.throws(() => zl.read(zl.entries[0]), /확장 필드/);                                                       // local 쪽만 있어도
  assert.throws(() => readZip(mkZip([{ name: 'a.txt', data: 'x', centralExtra: Buffer.from([0x55, 0x54, 9, 0, 1]) }])), /확장 필드/);   // 길이가 안 맞는 확장 필드
});

test('zip 파일명: UTF-8 표시(bit 11) 없는 비ASCII 이름·깨진 UTF-8 이름은 거부 — 표준 리더와 이름이 갈리는 zip · git archive 의 한글 이름(표시 있음)은 통과 (impl R3-2, 추천 자동 채택(위임))', () => {
  const ko = 'src/main/설정.txt';
  assert.throws(() => readZip(mkZip([{ name: ko, data: 'x' }])), /UTF-8/);                                    // R3 재현 — 표시 없이 UTF-8 바이트
  assert.throws(() => readZip(mkZip([{ name: Buffer.from([0x61, 0xff, 0xfe, 0x2e, 0x74]), data: 'x', flags: 0x0800 }])), /UTF-8/);   // 표시는 있는데 깨진 바이트
  const z = readZip(mkZip([{ name: ko, data: 'x', flags: 0x0800 }]));
  assert.equal(z.entries[0].name, ko);
  assert.equal(z.read(z.entries[0]).toString(), 'x');
  assert.doesNotThrow(() => readZip(mkZip([{ name: 'src/main/A.txt', data: 'x' }])));                         // ASCII 는 표시 없어도 된다
  const root = tmp();
  const { checkout, headSha } = initRepos(root);
  writeFileSync(join(checkout, '설정.txt'), 'k\n');
  git(checkout, 'add', '설정.txt');
  git(checkout, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'ko');
  const head2 = git(checkout, 'rev-parse', 'HEAD').trim();
  const gz = readZip(readFileSync(archive(checkout, head2, join(root, 'ko.zip'), ['설정.txt'])));
  assert.deepEqual(gz.entries.map((e) => e.name), ['설정.txt']);
  assert.equal(gz.read(gz.entries[0]).toString(), 'k\n');
});

test('zip local header 의 CRC·압축 크기·원본 크기가 목차와 다르거나 data descriptor(bit 3)를 쓰면 거부 — 표준 리더가 다른 바이트를 풀 수 있는 zip (impl R4-1, 추천 자동 채택(위임))', () => {
  const good = mkZip([{ name: 'src/main/A.txt', data: 'reviewed' }]);
  assert.equal(readZip(good).read(readZip(good).entries[0]).toString(), 'reviewed');
  for (const off of [14, 18, 22]) {
    const b = Buffer.from(good);
    b.writeUInt32LE(b.readUInt32LE(off) + 1, off);
    const z = readZip(b);
    assert.throws(() => z.read(z.entries[0]), /local header/, `offset ${off}`);
  }
  const dd = readZip(mkZip([{ name: 'src/main/A.txt', data: 'reviewed', flags: 0x0008 }]));
  assert.throws(() => dd.read(dd.entries[0]), /data descriptor/);
});

test('zip 파일명: 해독 결과를 다시 UTF-8 로 바꾼 바이트가 원래와 다르면(BOM 제거 등) 거부 (impl R4-4 훅, 추천 자동 채택(위임))', () => {
  assert.throws(() => readZip(mkZip([{ name: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('src/a.txt')]), data: 'x', flags: 0x0800 }])), /UTF-8/);
});
