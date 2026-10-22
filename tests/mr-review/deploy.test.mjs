// deploy 계약 테스트 (spec §5.2b · SC-3 deploy.json) — 실제 git archive 로 zip 을 만들어 자체 리더·대조를 검증한다
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
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

// blobs = diff-only 의 head 원문 { 경로: 내용 } → W/blobs/head/<경로>(collect 가 받는 위치) · unrecovered = snapshot.unrecovered
function workdir(root, { checkout, baseSha, headSha, mode = 'worktree', attachments = [], description = '', diffs = [], deployExempt = false, blobs = {}, unrecovered = [], name = 'work', project = 'alpha' }) {
  const work = join(root, name);
  mkdirSync(work, { recursive: true });
  for (const [p, c] of Object.entries(blobs)) { mkdirSync(dirname(join(work, 'blobs', 'head', p)), { recursive: true }); writeFileSync(join(work, 'blobs', 'head', p), c); }
  writeFileSync(join(work, 'mr.json'), JSON.stringify({ project: { name: project, id: 101, checkout, deployExempt }, iid: 7, description, api_head: headSha, diffs, notes: [], closes_issues: [], versions: [] }));
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify({ mode, target_sha: baseSha, base_sha: baseSha, head_sha: headSha, checkout: mode === 'worktree' ? checkout : null, worktree: null, attempts: 1, unrecovered, rebuilt: [] }));
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
  assert.throws(() => readZip(bad), /CRC·크기 불일치.*A\.java/);          // local 헤더 CRC ≠ 목차 — 목록 단계에서 거부(8b FR2-1)
  const badFile = join(root, 'bad-crc.zip');
  writeFileSync(badFile, bad);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: badFile }]);
  const work = workdir(root, { checkout, baseSha, headSha, attachments: [{ url: `/uploads/${SECRET}/d.zip`, kind: 'zip', filename: 'd.zip', secret: SECRET, where: 'body' }], description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: src/main/java/app/Old.java\n' });
  const r = runCli(['deploy', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.first, 'DEPLOY 대조 불가');
  const d = readJson(join(work, 'deploy.json'));
  assert.ok(d.mismatches.some((m) => m.kind === 'corrupt' && /CRC/.test(m.detail) && /src\/main\/java\/app\/A\.java/.test(m.detail)), JSON.stringify(d.mismatches));
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
  assert.throws(() => readZip(bad), /local header 파일명 불일치/);                   // 목록 단계에서 거부(8b FR2-1)
  const badFlag = Buffer.from(good);                                                   // central 플래그만 1(암호화) — 파일명·CRC·바이트는 정상(C1 R3-8 잔존)
  badFlag.writeUInt16LE(1, e.cd + 8);
  assert.throws(() => readZip(badFlag), /플래그·압축 방식 불일치/);
  const badEnc = Buffer.from(good);                                                    // local·central 둘 다 1 — 정합은 맞지만 암호화라 읽을 수 없는 배포본
  badEnc.writeUInt16LE(1, e.cd + 8);
  badEnc.writeUInt16LE(1, e.lho + 6);
  assert.throws(() => readZip(badEnc), /암호화 플래그/);                               // 목록 단계에서 거부(8b FR3-4 — 폴더 포함 모든 항목 공통 허용 검증)
  const badFile = join(root, 'bad-local.zip');
  writeFileSync(badFile, bad);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: badFile }]);
  const work = workdir(root, { checkout, baseSha, headSha, attachments: [{ url: `/uploads/${SECRET}/d.zip`, kind: 'zip', filename: 'd.zip', secret: SECRET, where: 'body' }], description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: src/main/java/app/Old.java\n' });
  const r = runCli(['deploy', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.first, 'DEPLOY 대조 불가');
  assert.ok(readJson(join(work, 'deploy.json')).mismatches.some((m) => m.kind === 'corrupt' && /파일명 불일치/.test(m.detail) && /src\/main\/java\/app\/A\.java/.test(m.detail)));
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
  // 1.3.1 ③(AC③-5) — head 원문(blobs/head)이 없는 diff-only 는 경로별 bytes_unavailable → 대조 불가. path 없는 bytes 항목은 더 이상 없다
  assert.deepEqual(d3.mismatches.filter((m) => m.kind === 'bytes_unavailable').map((m) => m.path), ['src/main/java/app/A.java', 'src/main/java/app/B.java']);
  assert.ok(!d3.mismatches.some((m) => m.kind === 'bytes' && m.path === null));
});

// 최소 zip 작성기(테스트 전용) — entries = [{ name(문자열|Buffer), data, method = 0|8, usize?, made?, ext?, flags?, tail? }]
function mkZip(entries, comment = '') {
  const locals = [];
  const cds = [];
  let off = 0;
  for (const e of entries) {
    const raw = Buffer.from(e.data);
    const comp = Buffer.concat([e.method === 8 ? zlib.deflateRawSync(raw) : raw, Buffer.from(e.tail || '')]);   // tail = 압축 스트림 뒤 덧붙인 바이트(크기 칸에 포함)
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
  assert.throws(() => readZip(mkZip([{ name: 'src/main/A.txt', data: 'x', localExtra: upath('src/main/A.txt', 'src/main/UNREVIEWED.txt') }])), /확장 필드/);   // local 쪽만 있어도 — 목록 단계에서(8b FR2-1)
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
    assert.throws(() => readZip(b), /local header/, `offset ${off}`);              // 목록 단계에서 거부(8b FR2-1)
  }
  assert.throws(() => readZip(mkZip([{ name: 'src/main/A.txt', data: 'reviewed', flags: 0x0008 }])), /data descriptor/);   // 레이아웃 검사가 목록 단계에서 거부(8b FR1-3)
});

test('zip 파일명: 해독 결과를 다시 UTF-8 로 바꾼 바이트가 원래와 다르면(BOM 제거 등) 거부 (impl R4-4 훅, 추천 자동 채택(위임))', () => {
  assert.throws(() => readZip(mkZip([{ name: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('src/a.txt')]), data: 'x', flags: 0x0800 }])), /UTF-8/);
});

test('zip 파일명의 NUL 등 제어문자는 거부 · `/` 로 끝나도 내용이 있으면 폴더로 인정하지 않는다 — 표준 리더가 다른 일반 파일로 푸는 항목 (impl R5-2, 추천 자동 채택(위임))', () => {
  assert.throws(() => readZip(mkZip([{ name: 'src/main/A.txt', data: 'ok' }, { name: Buffer.from('unexpected.js\u0000/'), data: 'evil()' }])), /제어문자/);
  assert.throws(() => readZip(mkZip([{ name: 'src/main/', data: 'payload' }])), /폴더/);
  assert.doesNotThrow(() => readZip(mkZip([{ name: 'src/main/', data: '' }, { name: 'src/main/A.txt', data: 'ok' }])));
});

test('zip 에서 파일과 같은 경로의 폴더 항목·파일 아래 항목은 거부 — 표준 리더는 충돌로 실패하거나 다르게 푼다 (impl C1 N2, 추천 자동 채택(위임))', () => {
  assert.throws(() => readZip(mkZip([{ name: 'src/main/A.txt', data: 'ok' }, { name: 'src/main/A.txt/', data: '' }])), /충돌/);
  assert.throws(() => readZip(mkZip([{ name: 'src/main/A.txt', data: 'ok' }, { name: 'src/main/A.txt/B.txt', data: 'x' }])), /충돌/);
  assert.doesNotThrow(() => readZip(mkZip([{ name: 'src/', data: '' }, { name: 'src/main/', data: '' }, { name: 'src/main/A.txt', data: 'ok' }])));
});

test('zip 파일명은 정규형만 — 앞 `/`·역슬래시·빈 조각·`.`·`..` 거부 · 대소문자만 다른 경로도 충돌로 거부 (impl R6-3 훅, 추천 자동 채택(위임))', () => {
  for (const name of ['./a.txt', 'a//b.txt', 'src/../x/', '/abs.txt', 'a\\b.txt', 'src/./a/']) {
    assert.throws(() => readZip(mkZip([{ name, data: '' }])), /정규형/, name);
  }
  assert.throws(() => readZip(mkZip([{ name: 'src/main/A.txt', data: 'ok' }, { name: 'SRC/main/A.txt/', data: '' }])), /충돌/);
  assert.throws(() => readZip(mkZip([{ name: 'src/A.txt', data: '1' }, { name: 'src/a.txt', data: '2' }])), /충돌/);
  assert.throws(() => readZip(mkZip([{ name: 'src/A.txt', data: '1' }, { name: 'SRC/a.txt/b.txt', data: '2' }])), /충돌/);
  assert.doesNotThrow(() => readZip(mkZip([{ name: 'src/', data: '' }, { name: 'src/A.txt', data: '1' }, { name: 'src/B.txt', data: '2' }])));
});

test('zip 허용 레이아웃: 목차에 없는 local 항목을 앞·사이·끝에 끼우거나 겹치면 거부 — 순차 리더만 푸는 내용 · git archive zip 은 통과 (8b FR1-3, 추천 자동 채택(위임))', () => {
  const root = tmp();
  const { checkout, headSha } = initRepos(root);
  const good = readFileSync(archive(checkout, headSha, join(root, 'g.zip'), ['src/main/java/app/A.java', 'src/main/java/app/B.java']));
  assert.doesNotThrow(() => readZip(good));
  const hidden = mkZip([{ name: 'injected.jsp', data: '<% evil %>' }]);
  const hiddenLocal = hidden.subarray(0, hidden.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])));   // central 앞까지 = local 레코드만
  // 정상 zip 앞에 숨은 local 항목을 붙이고 목차·EOCD 오프셋만 보정한다(리뷰 재현과 같은 형태)
  const shift = (zip, n) => {
    const b = Buffer.from(zip);
    const eocdAt = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const cdOff = b.readUInt32LE(eocdAt + 16);
    for (let p = cdOff; p < eocdAt; ) { b.writeUInt32LE(b.readUInt32LE(p + 42) + n, p + 42); p += 46 + b.readUInt16LE(p + 28) + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32); }
    b.writeUInt32LE(cdOff + n, eocdAt + 16);
    return b;
  };
  const prepended = Buffer.concat([hiddenLocal, shift(good, hiddenLocal.length)]);
  assert.throws(() => readZip(prepended), /레이아웃/);
  // 끝(마지막 항목 뒤·목차 앞)에 끼운 항목
  const two = mkZip([{ name: 'a.txt', data: 'A' }]);
  const cdAt = two.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  const tail = Buffer.concat([two.subarray(0, cdAt), hiddenLocal, two.subarray(cdAt)]);
  const eocdAt = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  tail.writeUInt32LE(cdAt + hiddenLocal.length, eocdAt + 16);
  assert.throws(() => readZip(tail), /레이아웃/);
  // 두 목차 항목이 같은 local 레코드를 가리키는 겹침
  const dup = mkZip([{ name: 'a.txt', data: 'A' }, { name: 'b.txt', data: 'A' }]);
  const cd2 = dup.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  dup.writeUInt32LE(0, cd2 + 42);
  assert.throws(() => readZip(dup), /레이아웃|local header/);
});

test('zip 폴더 항목도 local 헤더를 목차와 대조 — 목차엔 빈 폴더 · local 엔 다른 이름의 파일과 내용인 항목은 거부 (8b FR2-1 + 훅, 추천 자동 채택(위임))', () => {
  // 목차: `padding/`(크기 0) · local: `evil.jsp`(같은 길이 이름) + 내용 — 순차 리더만 evil.jsp 를 푼다
  const name = 'padding/';
  const evil = 'evil.jsp';
  assert.equal(name.length, evil.length);
  const z = mkZip([{ name, data: '' }, { name: 'a.txt', data: 'A' }]);
  const forged = Buffer.from(z);
  forged.write(evil, 30, 'utf8');                                                      // 첫 항목 local 이름만 바꾼다
  assert.throws(() => readZip(forged), /파일명 불일치/);
  // local 헤더 크기만 키운 폴더(이름은 같게) — 순차 리더는 뒤 바이트를 그 폴더의 데이터로 소비한다
  const grown = Buffer.from(z);
  grown.writeUInt32LE(5, 18);
  assert.throws(() => readZip(grown), /CRC·크기 불일치/);
  // 목차·local 모두 크기가 있는 폴더 항목
  assert.throws(() => readZip(mkZip([{ name: 'dir/', data: 'X' }])), /폴더 항목에/);
  assert.doesNotThrow(() => readZip(z));                                               // 정상 폴더 + 파일은 통과
});

test('zip 모든 항목(폴더 포함)에 허용 검증 선적용 — 암호화 플래그·미지원 압축 방식·CRC 있는 빈 폴더는 헤더끼리 같아도 거부 (8b FR3-4, 추천 자동 채택(위임))', () => {
  for (const flags of [0x0001, 0x0040]) assert.throws(() => readZip(mkZip([{ name: 'padding/', data: '', flags }, { name: 'a.txt', data: 'A' }])), /암호화/, `flags ${flags}`);
  assert.throws(() => readZip(mkZip([{ name: 'padding/', data: '', method: 99 }, { name: 'a.txt', data: 'A' }])), /압축 방식/);
  const crcDir = mkZip([{ name: 'padding/', data: '' }, { name: 'a.txt', data: 'A' }]);
  const cd = crcDir.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  crcDir.writeUInt32LE(0x1234, 14); crcDir.writeUInt32LE(0x1234, cd + 16);            // local·목차 CRC 를 같게 0 아닌 값으로
  assert.throws(() => readZip(crcDir), /폴더 항목/);
  assert.doesNotThrow(() => readZip(mkZip([{ name: 'padding/', data: '' }, { name: 'a.txt', data: 'A', method: 8 }])));
});

test('Deflate 스트림 뒤 미소비 바이트는 손상으로 거부 — 실제 소비한 입력 = 선언 압축 크기 (8b FR3-5, 추천 자동 채택(위임))', () => {
  const z = readZip(mkZip([{ name: 'a.txt', data: 'hello', method: 8, tail: 'JUNK_AFTER_DEFLATE' }]));
  assert.throws(() => z.read(z.entries[0]), /미소비|손상/);
  for (const data of ['hello', '', 'x'.repeat(100000)]) {
    const ok = readZip(mkZip([{ name: 'a.txt', data, method: 8 }]));
    assert.equal(ok.read(ok.entries[0]).toString(), data);
  }
});

// ── 1.3.1 ③ diff-only 바이트 대조 = W/blobs/head 기준 (spec 2026-10-22 3.③) ──
const AB = ['src/main/java/app/A.java', 'src/main/java/app/B.java'];
const abDiffs = [
  { old_path: AB[0], new_path: AB[0], new_file: false, renamed_file: false, deleted_file: false },
  { old_path: AB[1], new_path: AB[1], new_file: true, renamed_file: false, deleted_file: false },
];
const ATT = [{ url: `/uploads/${SECRET}/d.zip`, kind: 'zip', filename: 'd.zip', secret: SECRET, where: 'body' }];
const headBlobs = (checkout, headSha) => Object.fromEntries(AB.map((p) => [p, git(checkout, 'show', `${headSha}:${p}`) + '\n']));
function diffOnlyDeploy(root, adapter, { zipBuf, blobs, unrecovered = [], name }) {
  const zf = join(root, `${name}.zip`);
  writeFileSync(zf, zipBuf);
  const work = workdir(root, { checkout: null, baseSha: 'b'.repeat(40), headSha: zipBuf.headSha, mode: 'diff-only', attachments: ATT, diffs: abDiffs, blobs, unrecovered, name });
  const r = runCli(['deploy', '--adapter', adapter, '--work', work], fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: zf }]).env);
  return { r, d: readJson(join(work, 'deploy.json')) };
}

test('diff-only: head 원문(blobs/head)이 있으면 zip 바이트를 대조해 일치 — bytes_source = blobs, 워크트리 모드는 worktree (1.3.1 AC③-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const zipBuf = readFileSync(archive(checkout, headSha, join(root, 'g.zip'), AB));
  zipBuf.headSha = headSha;
  const { r, d } = diffOnlyDeploy(root, adapter, { zipBuf, blobs: headBlobs(checkout, headSha), name: 'w1' });
  assert.equal(r.first, 'DEPLOY 일치', JSON.stringify(d.mismatches));
  assert.deepEqual(d.mismatches, []);
  assert.equal(d.zip.bytes_source, 'blobs');
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: join(root, 'g.zip') }]);
  const wt = workdir(root, { checkout, baseSha, headSha, attachments: ATT, description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: src/main/java/app/Old.java\n', name: 'w-wt' });
  assert.equal(runCli(['deploy', '--adapter', adapter, '--work', wt], g.env).first, 'DEPLOY 일치');
  assert.equal(readJson(join(wt, 'deploy.json')).zip.bytes_source, 'worktree');
});

test('diff-only: zip 안 한 파일 1바이트가 다르면 그 경로의 bytes 불일치 (1.3.1 AC③-2)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, headSha } = initRepos(root);
  const blobs = headBlobs(checkout, headSha);
  const zipBuf = mkZip([{ name: AB[0], data: blobs[AB[0]].replace('2', '3') }, { name: AB[1], data: blobs[AB[1]] }], headSha);
  zipBuf.headSha = headSha;
  const { r, d } = diffOnlyDeploy(root, adapter, { zipBuf, blobs, name: 'w1' });
  assert.equal(r.first, 'DEPLOY 불일치');
  assert.deepEqual(d.mismatches.map((m) => [m.kind, m.path]), [['bytes', AB[0]]]);
  assert.match(d.mismatches[0].detail, /blobs\/head\/src\/main\/java\/app\/A\.java와 바이트 불일치/);
});

test('diff-only: head 원문 미확보(unrecovered 또는 blob 없음) 경로는 bytes_unavailable → 대조 불가 (1.3.1 AC③-3)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, headSha } = initRepos(root);
  const zipBuf = readFileSync(archive(checkout, headSha, join(root, 'g.zip'), AB));
  zipBuf.headSha = headSha;
  const blobs = headBlobs(checkout, headSha);
  const a = diffOnlyDeploy(root, adapter, { zipBuf, blobs, unrecovered: [AB[1]], name: 'w1' });   // blob 이 있어도 unrecovered 면 쓰지 않는다
  assert.equal(a.r.first, 'DEPLOY 대조 불가');
  assert.deepEqual(a.d.mismatches.map((m) => [m.kind, m.path]), [['bytes_unavailable', AB[1]]]);
  assert.equal(a.d.mismatches[0].detail, 'head 원문 미확보 — 바이트 대조 불가');
  const b = diffOnlyDeploy(root, adapter, { zipBuf, blobs: { [AB[0]]: blobs[AB[0]] }, name: 'w2' });   // B 의 blob 파일 자체가 없다
  assert.equal(b.r.first, 'DEPLOY 대조 불가');
  assert.deepEqual(b.d.mismatches.map((m) => [m.kind, m.path]), [['bytes_unavailable', AB[1]]]);
});

test('diff-only: zip 항목이 일반 파일이 아니면(심볼릭 링크) 유형 불일치 — zip 쪽 유형만 본다 (1.3.1 AC③-4)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, headSha } = initRepos(root);
  const blobs = headBlobs(checkout, headSha);
  const zipBuf = mkZip([{ name: AB[0], data: blobs[AB[0]], ext: (0o120777 << 16) >>> 0 }, { name: AB[1], data: blobs[AB[1]] }], headSha);
  zipBuf.headSha = headSha;
  const { r, d } = diffOnlyDeploy(root, adapter, { zipBuf, blobs, name: 'w1' });
  assert.equal(r.first, 'DEPLOY 불일치');
  assert.deepEqual(d.mismatches.map((m) => [m.kind, m.path]), [['type', AB[0]]]);
  assert.match(d.mismatches[0].detail, /diff-only — zip 항목 유형 symlink 확인 불가\(일반 파일만 대조\)/);
});

test('diff-only: bytes_unavailable 과 extra_in_zip 이 함께면 결과 = 대조 불가(우선순위 유지)이고 mismatches 에 둘 다 남는다 (1.3.1 AC③-6 · D34)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, headSha } = initRepos(root);
  const zipBuf = readFileSync(archive(checkout, headSha, join(root, 'g.zip'), [...AB, 'README.md']));
  zipBuf.headSha = headSha;
  const blobs = headBlobs(checkout, headSha);
  const { r, d } = diffOnlyDeploy(root, adapter, { zipBuf, blobs: { [AB[0]]: blobs[AB[0]] }, name: 'w1' });
  assert.equal(r.first, 'DEPLOY 대조 불가');
  assert.deepEqual(d.mismatches.map((m) => [m.kind, m.path]).sort(), [['bytes_unavailable', AB[1]], ['extra_in_zip', 'README.md']]);
});

// ── 1.3.2 ⑨ 배포본 레이아웃 매핑 maven-war (spec 2026-10-22 3.⑨) — 기존 픽스처 프로젝트(alpha·beta)는 source 그대로, maven-war 는 별도 프로젝트 키 gamma(AC⑨-5) ──
const WAR_PROJECT = { gamma: { id: 104, path: 'repos/gamma', deployLayout: 'maven-war' } };
const WAR4 = {
  'src/main/webapp/html/a.html': '<p>a</p>\n',
  'src/main/webapp/js/a.js': 'var a = 1;\n',
  'src/main/resources/mapper/a.xml': '<mapper id="a"/>\n',
  'src/main/java/com/example/acct/Foo.java': 'class Foo { Runnable r = new Runnable() { public void run() {} }; }\n',
};
const CLS = 'WEB-INF/classes/com/example/acct/';
// base = baseFiles, head = base + add − del. 반환 { checkout, baseSha, headSha }
function warRepo(root, { add = WAR4, del = [], baseFiles = {} } = {}) {
  const checkout = join(root, 'repos', 'gamma');
  mkdirSync(checkout, { recursive: true });
  git(checkout, 'init', '-q', '-b', 'master');
  writeFileSync(join(checkout, 'pom.xml'), '<project/>\n');
  for (const [p, c] of Object.entries(baseFiles)) { mkdirSync(dirname(join(checkout, p)), { recursive: true }); writeFileSync(join(checkout, p), c); }
  git(checkout, 'add', '-A');
  git(checkout, 'commit', '-q', '-m', 'base');
  const baseSha = git(checkout, 'rev-parse', 'HEAD');
  for (const [p, c] of Object.entries(add)) { mkdirSync(dirname(join(checkout, p)), { recursive: true }); writeFileSync(join(checkout, p), c); }
  for (const p of del) git(checkout, 'rm', '-q', p);
  git(checkout, 'add', '-A');
  git(checkout, 'commit', '-q', '-m', 'head');
  return { checkout, baseSha, headSha: git(checkout, 'rev-parse', 'HEAD') };
}
// WAR4 를 WAR 배치로 묶은 정상 zip 항목(내부 클래스 포함). over = { zip 경로: 내용 | null(빼기) }
function warEntries(over = {}) {
  const base = {
    'html/a.html': WAR4['src/main/webapp/html/a.html'],
    'js/a.js': WAR4['src/main/webapp/js/a.js'],
    'WEB-INF/classes/mapper/a.xml': WAR4['src/main/resources/mapper/a.xml'],
    [`${CLS}Foo.class`]: Buffer.from([0xca, 0xfe, 0xba, 0xbe, 1, 2, 3]),
    [`${CLS}Foo$1.class`]: Buffer.from([0xca, 0xfe, 0xba, 0xbe, 9]),
  };
  return Object.entries({ ...base, ...over }).filter(([, v]) => v !== null).map(([name, data]) => (data && data.ext ? { name, data: data.data, ext: data.ext } : { name, data }));
}
function warDeploy(root, adapter, { repo, entries, mode = 'worktree', description = '', blobs = {}, diffs = [], name = 'w' }) {
  const zf = join(root, `${name}.zip`);
  writeFileSync(zf, mkZip(entries, repo.headSha));
  const work = workdir(root, { checkout: mode === 'worktree' ? repo.checkout : null, baseSha: repo.baseSha, headSha: repo.headSha, mode, attachments: ATT, description, blobs, diffs, name, project: 'gamma' });
  const r = runCli(['deploy', '--adapter', adapter, '--work', work], fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: zf }]).env);
  return { r, d: readJson(join(work, 'deploy.json')) };
}
const kp = (d) => d.mismatches.map((m) => [m.kind, m.path]);

test('maven-war: 소스 경로 기대 목록을 WAR 배치로 사상해 정상 zip = 일치 · .class(내부 클래스 포함)는 bytes_skipped (1.3.2 AC⑨-2)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const repo = warRepo(root);
  const { r, d } = warDeploy(root, adapter, { repo, entries: warEntries() });
  assert.equal(r.first, 'DEPLOY 일치', JSON.stringify(d.mismatches));
  assert.deepEqual(d.mismatches, []);
  assert.equal(d.zip.layout, 'maven-war');
  assert.deepEqual(d.zip.bytes_skipped, [`${CLS}Foo$1.class`, `${CLS}Foo.class`]);
  assert.deepEqual(d.expected.deploy, Object.keys(WAR4).sort());   // expected 는 소스 경로 그대로
});

test('maven-war: 바이트 대조 항목 1바이트 변경 → 소스 경로의 bytes 불일치 · .class 바이트 변경은 불변(존재만) (1.3.2 AC⑨-3)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const repo = warRepo(root);
  const a = warDeploy(root, adapter, { repo, entries: warEntries({ 'html/a.html': '<p>b</p>\n' }), name: 'w1' });
  assert.equal(a.r.first, 'DEPLOY 불일치');
  assert.deepEqual(kp(a.d), [['bytes', 'src/main/webapp/html/a.html']]);
  const b = warDeploy(root, adapter, { repo, entries: warEntries({ [`${CLS}Foo.class`]: Buffer.from('other bytes') }), name: 'w2' });
  assert.equal(b.r.first, 'DEPLOY 일치');
  assert.deepEqual(b.d.mismatches, []);
});

test('maven-war: .class 누락 = 소스 경로 missing_in_zip(기대 zip 경로는 detail) · 대응 소스 없는 .class = extra_in_zip · 내부 클래스만 추가는 불일치 아님 (1.3.2 AC⑨-4)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const repo = warRepo(root);
  const a = warDeploy(root, adapter, { repo, entries: warEntries({ [`${CLS}Foo.class`]: null }), name: 'w1' });
  assert.deepEqual(kp(a.d), [['missing_in_zip', 'src/main/java/com/example/acct/Foo.java']]);
  assert.match(a.d.mismatches[0].detail, /WEB-INF\/classes\/com\/example\/acct\/Foo\.class/);
  const b = warDeploy(root, adapter, { repo, entries: warEntries({ [`${CLS}Bar.class`]: Buffer.from('x') }), name: 'w2' });
  assert.deepEqual(kp(b.d), [['extra_in_zip', `${CLS}Bar.class`]]);
  const c = warDeploy(root, adapter, { repo, entries: warEntries({ [`${CLS}Foo$2.class`]: Buffer.from('y') }), name: 'w3' });
  assert.equal(c.r.first, 'DEPLOY 일치', JSON.stringify(c.d.mismatches));
  assert.ok(c.d.zip.bytes_skipped.includes(`${CLS}Foo$2.class`));
});

test('source 레이아웃(키 없음): zip.layout = source · bytes_skipped = [] · 소스 경로 zip 일치 그대로 (1.3.2 AC⑨-5)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root);
  const zip = archive(checkout, headSha, join(root, 'd.zip'), AB);
  const g = fakeGlab(root, [{ match: `^api projects/101/uploads/${SECRET}/d\\.zip$`, file: zip }]);
  const work = workdir(root, { checkout, baseSha, headSha, attachments: ATT, description: '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: src/main/java/app/Old.java\n' });
  assert.equal(runCli(['deploy', '--adapter', adapter, '--work', work], g.env).first, 'DEPLOY 일치');
  const d = readJson(join(work, 'deploy.json'));
  assert.equal(d.zip.layout, 'source');
  assert.deepEqual(d.zip.bytes_skipped, []);
});

test('maven-war: src/main/java 아래 .java 외 파일은 WEB-INF/classes/<rest> 로 사상해 바이트 대조 (1.3.2 AC⑨-11 · D43)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const X = 'src/main/java/com/example/acct/AcctMapper.xml';
  const repo = warRepo(root, { add: { ...WAR4, [X]: '<mapper ns="acct"/>\n' } });
  const a = warDeploy(root, adapter, { repo, entries: warEntries({ [`${CLS}AcctMapper.xml`]: '<mapper ns="acct"/>\n' }), name: 'w1' });
  assert.equal(a.r.first, 'DEPLOY 일치', JSON.stringify(a.d.mismatches));
  assert.ok(!a.d.zip.bytes_skipped.includes(`${CLS}AcctMapper.xml`));
  const b = warDeploy(root, adapter, { repo, entries: warEntries({ [`${CLS}AcctMapper.xml`]: '<mapper ns="acck"/>\n' }), name: 'w2' });
  assert.deepEqual(kp(b.d), [['bytes', X]]);
  const c = warDeploy(root, adapter, { repo, entries: warEntries(), name: 'w3' });
  assert.deepEqual(kp(c.d), [['missing_in_zip', X]]);
  assert.match(c.d.mismatches[0].detail, /WEB-INF\/classes\/com\/example\/acct\/AcctMapper\.xml/);
});

test('zip.layout 은 배포 제외·해당 없음으로 일찍 끝나도 프로젝트 값으로 기록 (1.3.2 AC⑨-12)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const w1 = workdir(root, { checkout: null, baseSha: 'b'.repeat(40), headSha: 'a'.repeat(40), mode: 'diff-only', deployExempt: true, name: 'w1', project: 'gamma' });
  assert.equal(runCli(['deploy', '--adapter', adapter, '--work', w1], fakeGlab(root, []).env).first, 'DEPLOY 해당 없음');
  assert.equal(readJson(join(w1, 'deploy.json')).zip.layout, 'maven-war');
  const w2 = workdir(root, { checkout: null, baseSha: 'b'.repeat(40), headSha: 'a'.repeat(40), mode: 'diff-only', diffs: [{ old_path: 'docs/x.md', new_path: 'docs/x.md', new_file: true, renamed_file: false, deleted_file: false }], name: 'w2', project: 'gamma' });
  assert.equal(runCli(['deploy', '--adapter', adapter, '--work', w2], fakeGlab(root, []).env).first, 'DEPLOY 해당 없음');
  const d2 = readJson(join(w2, 'deploy.json'));
  assert.equal(d2.zip.layout, 'maven-war');
  assert.deepEqual(d2.zip.bytes_skipped, []);
  const w3 = workdir(root, { checkout: null, baseSha: 'b'.repeat(40), headSha: 'a'.repeat(40), mode: 'diff-only', deployExempt: true, name: 'w3' });
  runCli(['deploy', '--adapter', adapter, '--work', w3], fakeGlab(root, []).env);
  assert.equal(readJson(join(w3, 'deploy.json')).zip.layout, 'source');
});

test('maven-war diff-only: blobs/head/<소스 경로> ↔ WAR zip 항목 바이트 대조 — 일치 · bytes · bytes_unavailable(소스 경로) · .class 는 bytes_skipped (1.3.2 AC⑨-6)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const repo = warRepo(root);
  const diffs = Object.keys(WAR4).map((p) => ({ old_path: p, new_path: p, new_file: true, renamed_file: false, deleted_file: false }));
  const a = warDeploy(root, adapter, { repo, mode: 'diff-only', diffs, blobs: WAR4, entries: warEntries(), name: 'w1' });
  assert.equal(a.r.first, 'DEPLOY 일치', JSON.stringify(a.d.mismatches));
  assert.deepEqual(a.d.zip.bytes_skipped, [`${CLS}Foo$1.class`, `${CLS}Foo.class`]);
  const b = warDeploy(root, adapter, { repo, mode: 'diff-only', diffs, blobs: WAR4, entries: warEntries({ 'js/a.js': 'var a = 2;\n' }), name: 'w2' });
  assert.deepEqual(kp(b.d), [['bytes', 'src/main/webapp/js/a.js']]);
  const { ['src/main/webapp/html/a.html']: _, ...noHtml } = WAR4;
  const c = warDeploy(root, adapter, { repo, mode: 'diff-only', diffs, blobs: noHtml, entries: warEntries(), name: 'w3' });
  assert.equal(c.r.first, 'DEPLOY 대조 불가');
  assert.deepEqual(kp(c.d), [['bytes_unavailable', 'src/main/webapp/html/a.html']]);
});

test('maven-war ④ 삭제 목록: 기대·본문을 zip 경로로 정규화해 비교 — 소스·WAR 경로 혼용·내부 클래스 통과, 다른 경로는 deleted_list (1.3.2 AC⑨-7)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const OLD = { 'src/main/java/com/example/acct/Old.java': 'class Old {}\n', 'src/main/webapp/html/old.html': '<p>old</p>\n' };
  const repo = warRepo(root, { baseFiles: OLD, del: Object.keys(OLD) });
  const body = (items) => `## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n${items.map((i) => `  - 삭제: ${i}\n`).join('')}`;
  const a = warDeploy(root, adapter, { repo, entries: warEntries(), description: body([`${CLS}Old.class`, 'src/main/webapp/html/old.html']), name: 'w1' });
  assert.equal(a.r.first, 'DEPLOY 일치', JSON.stringify(a.d.mismatches));
  assert.deepEqual(a.d.expected.deleted, Object.keys(OLD).sort());
  const b = warDeploy(root, adapter, { repo, entries: warEntries(), description: body([`${CLS}Old.class`, `${CLS}Old$1.class`, 'html/old.html']), name: 'w2' });
  assert.equal(b.r.first, 'DEPLOY 일치', JSON.stringify(b.d.mismatches));
  const c = warDeploy(root, adapter, { repo, entries: warEntries(), description: body([`${CLS}Old.class`, 'html/old.html', 'html/other.html']), name: 'w3' });
  assert.deepEqual(kp(c.d), [['deleted_list', null]]);
  assert.match(c.d.mismatches[0].detail, /html\/other\.html/);
});

test('maven-war ④ 삭제 목록: 내부 클래스 정규화는 삭제한 .java 의 산출물에만 — `$` 든 리소스·`Foo$Bar.java` 의 고유 이름은 보존해 다른 파일 삭제 지시를 deleted_list 로 잡는다 (1.3.2 R1-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const body = (items) => `## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n${items.map((i) => `  - 삭제: ${i}\n`).join('')}`;
  // `$` 든 리소스 삭제(기대 = WEB-INF/classes/p/Foo$A.class) ↔ 본문은 다른 파일 Foo$B.class
  const RES = { 'src/main/resources/p/Foo$A.class': 'res\n' };
  const r1 = warRepo(join(root, 'r1'), { baseFiles: RES, del: Object.keys(RES) });
  const a = warDeploy(join(root, 'r1'), adapter, { repo: r1, entries: warEntries(), description: body(['WEB-INF/classes/p/Foo$B.class']), name: 'w1' });
  assert.deepEqual(kp(a.d), [['deleted_list', null]]);
  const a2 = warDeploy(join(root, 'r1'), adapter, { repo: r1, entries: warEntries(), description: body(['WEB-INF/classes/p/Foo$A.class']), name: 'w1b' });
  assert.equal(a2.r.first, 'DEPLOY 일치', JSON.stringify(a2.d.mismatches));
  // Foo$Bar.java 삭제(기대 = …/Foo$Bar.class) ↔ 본문은 바깥 클래스 Foo.class(정상 파일) 삭제
  const JB = { 'src/main/java/com/example/acct/Foo$Bar.java': 'class Foo$Bar {}\n' };
  const r2 = warRepo(join(root, 'r2'), { baseFiles: JB, del: Object.keys(JB) });
  const b = warDeploy(join(root, 'r2'), adapter, { repo: r2, entries: warEntries(), description: body([`${CLS}Foo.class`]), name: 'w2' });
  // zip 에 든 Foo.class 를 지우라는 지시라 R3-1 규칙(삭제 경로가 zip 에도 있음)의 map_conflict 도 함께 난다
  assert.deepEqual(kp(b.d).sort(), [['deleted_list', null], ['map_conflict', `${CLS}Foo.class`]]);
  const b2 = warDeploy(join(root, 'r2'), adapter, { repo: r2, entries: warEntries(), description: body([`${CLS}Foo$Bar.class`]), name: 'w2b' });
  assert.equal(b2.r.first, 'DEPLOY 일치', JSON.stringify(b2.d.mismatches));
});

test('maven-war: 두 소스 경로가 같은 zip 경로로 사상되면 map_conflict → 대조 불가(extra_in_zip 이 함께여도) (1.3.2 AC⑨-8)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const repo = warRepo(root, { add: { 'src/main/resources/a.xml': '<a/>\n', 'src/main/webapp/WEB-INF/classes/a.xml': '<a/>\n' } });
  const { r, d } = warDeploy(root, adapter, { repo, entries: [{ name: 'WEB-INF/classes/a.xml', data: '<a/>\n' }, { name: 'README.txt', data: 'x' }] });
  assert.equal(r.first, 'DEPLOY 대조 불가');
  const mc = d.mismatches.find((m) => m.kind === 'map_conflict');
  assert.equal(mc.path, 'WEB-INF/classes/a.xml');
  assert.match(mc.detail, /src\/main\/resources\/a\.xml/);
  assert.match(mc.detail, /src\/main\/webapp\/WEB-INF\/classes\/a\.xml/);
  assert.deepEqual(kp(d).sort(), [['extra_in_zip', 'README.txt'], ['map_conflict', 'WEB-INF/classes/a.xml']]);
});

test('maven-war: 배포 소스와 삭제 소스가 같은 zip 경로로 사상되면(소스 이동 — resources → java) map_conflict → 대조 불가 · 삭제 지시가 새 파일을 지우는 「일치」를 막는다 (1.3.2 R2-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const repo = warRepo(root, { baseFiles: { 'src/main/resources/a.xml': '<a/>\n' }, add: { 'src/main/java/a.xml': '<a/>\n' }, del: ['src/main/resources/a.xml'] });
  const description = '## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: WEB-INF/classes/a.xml\n';
  const { r, d } = warDeploy(root, adapter, { repo, entries: [{ name: 'WEB-INF/classes/a.xml', data: '<a/>\n' }], description });
  assert.equal(r.first, 'DEPLOY 대조 불가', JSON.stringify(d.mismatches));
  const mc = d.mismatches.find((m) => m.kind === 'map_conflict');
  assert.equal(mc.path, 'WEB-INF/classes/a.xml');
  assert.match(mc.detail, /src\/main\/java\/a\.xml/);
  assert.match(mc.detail, /src\/main\/resources\/a\.xml/);
});

test('삭제 목록(기대·본문)의 경로가 zip 항목에도 있으면 map_conflict → 대조 불가 — 내부 클래스로 받아들인 항목(`Foo$1.class`)을 지우는 지시도 잡는다 (1.3.2 R3-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const RES = { 'src/main/resources/com/example/acct/Foo$1.class': 'res\n' };
  const repo = warRepo(root, { baseFiles: RES, del: Object.keys(RES) });
  const description = `## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: ${CLS}Foo$1.class\n`;
  const { r, d } = warDeploy(root, adapter, { repo, entries: warEntries(), description });
  assert.equal(r.first, 'DEPLOY 대조 불가', JSON.stringify(d.mismatches));
  assert.deepEqual(kp(d), [['map_conflict', `${CLS}Foo$1.class`]]);
  assert.match(d.mismatches[0].detail, /zip 에도 들어 있음/);
});

test('maven-war: `Foo$Bar.java` 의 내부 클래스 `Foo$Bar$1.class` 는 가장 긴 기대 클래스(`Foo$Bar.class`)의 산출물 — 배포 대조·삭제 목록 모두 통과 (1.3.2 R2-2)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const FB = { 'src/main/java/com/example/acct/Foo$Bar.java': 'class Foo$Bar { Runnable r = new Runnable() { public void run() {} }; }\n' };
  const r1 = warRepo(join(root, 'r1'), { add: FB });
  const a = warDeploy(join(root, 'r1'), adapter, { repo: r1, entries: [{ name: `${CLS}Foo$Bar.class`, data: Buffer.from('a') }, { name: `${CLS}Foo$Bar$1.class`, data: Buffer.from('b') }] });
  assert.equal(a.r.first, 'DEPLOY 일치', JSON.stringify(a.d.mismatches));
  assert.deepEqual(a.d.zip.bytes_skipped, [`${CLS}Foo$Bar$1.class`, `${CLS}Foo$Bar.class`]);
  const r2 = warRepo(join(root, 'r2'), { baseFiles: FB, del: Object.keys(FB) });
  const body = `## 배포·롤백\n- 배포본: [d.zip](/uploads/x/d.zip)\n  - 삭제: ${CLS}Foo$Bar.class\n  - 삭제: ${CLS}Foo$Bar$1.class\n`;
  const b = warDeploy(join(root, 'r2'), adapter, { repo: r2, entries: warEntries(), description: body, name: 'w2' });
  assert.equal(b.r.first, 'DEPLOY 일치', JSON.stringify(b.d.mismatches));
});

test('maven-war: .class 항목이 심볼릭 링크면 zip 경로의 type 불일치(존재 대조도 일반 파일만) (1.3.2 AC⑨-9)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: WAR_PROJECT });
  const repo = warRepo(root);
  const { r, d } = warDeploy(root, adapter, { repo, entries: warEntries({ [`${CLS}Foo.class`]: { data: 'Foo$1.class', ext: (0o120777 << 16) >>> 0 } }) });
  assert.equal(r.first, 'DEPLOY 불일치');
  assert.deepEqual(kp(d), [['type', `${CLS}Foo.class`]]);
  assert.ok(!d.zip.bytes_skipped.includes(`${CLS}Foo.class`));
});
