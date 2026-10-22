// collect 계약 테스트 (spec §5.1 · SC-3) — 가짜 glab + 로컬 bare origin
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp, writeAdapter, initRepos, fakeGlab, runCli, readJson, git, CLI } from './helpers.mjs';

const IID = 7;
const ENC = (p) => encodeURIComponent(p).replace(/\./g, '%2E');
// diff-only 에서 비삭제 변경 파일마다 head 원문 raw 규칙(blobs/head 는 항상 만든다 — R1-5)
const headRaw = (headSha, paths) => paths.map((p) => ({ match: `^api projects/101/repository/files/${ENC(p)}/raw\\?ref=${headSha}$`, text: `// head ${p}\n` }));
const DEAD = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

function meta(headSha, extra = {}) {
  return {
    iid: IID, title: 'feat: v2', description: '## 배경\n- 트랙: 경량\n', state: 'opened', updated_at: '2026-10-21T01:00:00Z', web_url: 'http://gitlab.test/g/alpha/-/merge_requests/7',
    author: { id: 1, username: 'author-a' }, reviewers: [{ id: 2, username: 'rev-b' }],
    source_branch: 'feat', target_branch: 'master', sha: headSha, diff_refs: { base_sha: 'b'.repeat(40), head_sha: headSha, start_sha: 'b'.repeat(40) },
    detailed_merge_status: 'mergeable', has_conflicts: false, ...extra,
  };
}
const DIFFS = [
  { old_path: 'src/main/java/app/A.java', new_path: 'src/main/java/app/A.java', new_file: false, renamed_file: false, deleted_file: false, diff: '@@ -1 +1 @@\n-class A { int v = 1; }\n+class A { int v = 2; }\n' },
  { old_path: 'src/main/java/app/B.java', new_path: 'src/main/java/app/B.java', new_file: true, renamed_file: false, deleted_file: false, diff: '@@ -0,0 +1 @@\n+class B {}\n' },
  { old_path: 'src/main/java/app/Old.java', new_path: 'src/main/java/app/Old.java', new_file: false, renamed_file: false, deleted_file: true, diff: '@@ -1 +0,0 @@\n-class Old {}\n' },
  { old_path: 'docs/specs/2026-10-01-feature.md', new_path: 'docs/specs/2026-10-01-feature.md', new_file: true, renamed_file: false, deleted_file: false, diff: '@@ -0,0 +1 @@\n+# feature spec\n' },
];
const NOTES = [
  { id: 1, system: true, author: { id: 1, username: 'author-a' }, created_at: '2026-10-20T00:00:00Z', body: 'requested review from @rev-b' },
  { id: 2, system: false, author: { id: 2, username: 'rev-b' }, created_at: '2026-10-20T01:00:00Z', body: '기준선 확인 — 배경 ①② 동의' },
  { id: 3, system: true, author: { id: 1, username: 'author-a' }, created_at: '2026-10-20T02:00:00Z', body: 'changed the description' },
];
// base = API 가 기록한 MR diff 의 base(versions[0].base_commit_sha) — 워크트리 모드는 이 값을 base 로 쓰므로(1.3.1 ②) 워크트리 픽스처는 실제 baseSha 를 준다
function rules(headSha, { metaRules, base = 'b'.repeat(40) } = {}) {
  const p = `projects/101/merge_requests/${IID}`;
  return [
    ...(metaRules || [{ match: `^api ${p}$`, json: meta(headSha) }]),
    { match: `^api --paginate ${p}/diffs`, json: DIFFS },
    { match: `^api ${p}/changes$`, json: { overflow: false } },
    { match: `^api --paginate ${p}/notes`, json: NOTES },
    { match: `^api --paginate ${p}/closes_issues`, json: [{ iid: 12, project_id: 101, title: '버그', description: '① 왜 ② 무엇을', updated_at: '2026-10-19T00:00:00Z', web_url: 'http://gitlab.test/g/alpha/-/issues/12' }] },
    { match: `^api ${p}/versions$`, json: [{ head_commit_sha: headSha, base_commit_sha: base, start_commit_sha: base }] },
    { match: `^api ${p}/approvals$`, json: { approved_by: [{ user: { username: 'rev-b' } }] } },
  ];
}

test('worktree 모드: fetch head = API head → 세 SHA 고정 + 워크트리 · 변경 목록은 API 가 아니라 git 정본(R3-4)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root, { iid: IID });
  const p = `projects/101/merge_requests/${IID}`;
  const g = fakeGlab(root, [...rules(headSha, { base: baseSha }).filter((x) => !x.match.includes('/diffs')), { match: `^api --paginate ${p}/diffs`, json: DIFFS.slice(0, 3) }]);   // API 목록에는 docs/specs 문서가 빠져 있다(overflow 흉내)
  const work = join(root, 'work');
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'verdict.json'), JSON.stringify({ status: 'determined', verdict: 'APPROVE', head_sha: DEAD }));   // 이전 실행 잔존물
  writeFileSync(join(work, 'findings.json'), '{}');
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.first, `COLLECTED worktree head=${headSha.slice(0, 7)} base=${baseSha.slice(0, 7)} target=${baseSha.slice(0, 7)} attempts=1 unrecovered=0`);
  assert.ok(!existsSync(join(work, 'verdict.json')));          // 새 수집은 이전 판정·검토 산출물을 지운다(R1-1)
  assert.ok(!existsSync(join(work, 'findings.json')));
  const snap = readJson(join(work, 'snapshot.json'));
  assert.equal(snap.mode, 'worktree');
  assert.equal(snap.head_sha, headSha);
  assert.equal(snap.base_sha, baseSha);
  assert.equal(snap.target_sha, baseSha);
  assert.equal(snap.checkout, checkout);
  assert.equal(snap.worktree, join(work, 'worktree'));
  assert.equal(snap.diff_list_complete, true);                 // 워크트리 모드는 git diff 가 정본
  assert.ok(existsSync(join(work, 'worktree', 'src', 'main', 'java', 'app', 'B.java')));
  assert.ok(!existsSync(join(work, 'worktree', 'src', 'main', 'java', 'app', 'Old.java')));
  const mr = readJson(join(work, 'mr.json'));
  assert.equal(mr.project.name, 'alpha');
  assert.equal(mr.project.id, 101);
  assert.equal(mr.api_head, headSha);
  assert.equal(mr.diffs.length, 4);                                                        // git 목록 — API 가 뺀 docs/specs 도 들어 있다
  assert.ok(mr.diffs.some((d) => d.new_path === 'docs/specs/2026-10-01-feature.md' && d.new_file));
  assert.equal(mr.diffs.find((d) => d.new_path === 'src/main/java/app/Old.java').deleted_file, true);
  assert.match(mr.diffs.find((d) => d.new_path === 'src/main/java/app/A.java').diff, /-class A \{ int v = 1; \}[\s\S]*\+class A \{ int v = 2; \}/);
  assert.equal(mr.overflow, false);
  assert.deepEqual(snap.api_failures, []);
  assert.equal(mr.notes.length, 3);
  assert.equal(mr.description_changed_at, '2026-10-20T02:00:00Z');
  assert.deepEqual(mr.approved_by, ['rev-b']);
  assert.equal(mr.closes_issues[0].iid, 12);
  assert.equal(mr.versions[0].base_commit_sha, baseSha);
  assert.deepEqual(mr.reviewers, [{ id: 2, username: 'rev-b' }]);
});

test('HEAD_MOVED: API head 가 fetch head 와 계속 다르면 3회 뒤 exit 3', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  initRepos(root, { iid: IID });
  const g = fakeGlab(root, rules(DEAD));
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', join(root, 'work')], g.env);
  assert.equal(r.code, 3);
  assert.match(r.first, /^ERR HEAD_MOVED/);
  assert.equal(g.calls().filter((c) => c.join(' ') === `api projects/101/merge_requests/${IID}`).length, 3);
});

test('재수집: 첫 메타는 옛 head, 둘째는 fetch head 와 일치 → attempts=2', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { baseSha, headSha } = initRepos(root, { iid: IID });
  const p = `projects/101/merge_requests/${IID}`;
  const g = fakeGlab(root, rules(headSha, { base: baseSha, metaRules: [{ match: `^api ${p}$`, json: meta(DEAD), times: 1 }, { match: `^api ${p}$`, json: meta(headSha) }] }));
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', join(root, 'work')], g.env);
  assert.equal(r.code, 0, r.out);
  assert.match(r.first, /attempts=2 /);
});

test('diff-only 모드: 체크아웃이 없으면 잘린 diff 를 양쪽 blob 으로 재구성, 실패분은 unrecovered', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: { alpha: { id: 101, path: 'repos/missing', deployExempt: false } } });
  const headSha = 'a'.repeat(40);
  const base = 'b'.repeat(40);
  const diffs = DIFFS.map((d) => ({ ...d }));
  diffs[0] = { ...diffs[0], diff: '', too_large: true };                               // 복원 성공 대상
  diffs.push({ old_path: 'src/main/java/app/C.java', new_path: 'src/main/java/app/C.java', new_file: false, renamed_file: false, deleted_file: false, diff: '', too_large: true }); // raw 규칙 없음 → 실패
  const p = `projects/101/merge_requests/${IID}`;
  const enc = ENC('src/main/java/app/A.java');
  const g = fakeGlab(root, [
    ...rules(headSha).filter((x) => !x.match.includes('/diffs')),
    { match: `^api --paginate ${p}/diffs`, json: diffs },
    { match: `^api projects/101/repository/files/${enc}/raw\\?ref=${base}$`, text: 'class A { int v = 1; }\n' },
    { match: `^api projects/101/repository/files/${enc}/raw\\?ref=${headSha}$`, text: 'class A { int v = 2; }\n' },
    ...headRaw(headSha, ['src/main/java/app/B.java', 'docs/specs/2026-10-01-feature.md']),   // C.java 는 head raw 규칙 없음
  ]);
  const work = join(root, 'work');
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.first, `COLLECTED diff-only head=${headSha.slice(0, 7)} base=${base.slice(0, 7)} target=${base.slice(0, 7)} attempts=1 unrecovered=1`);
  const snap = readJson(join(work, 'snapshot.json'));
  assert.equal(snap.mode, 'diff-only');
  assert.equal(snap.worktree, null);
  assert.deepEqual(snap.rebuilt, ['src/main/java/app/A.java']);
  assert.deepEqual(snap.unrecovered, ['src/main/java/app/C.java']);
  const mr = readJson(join(work, 'mr.json'));
  assert.match(mr.diffs[0].diff, /-class A \{ int v = 1; \}/);
  assert.match(mr.diffs[0].diff, /\+class A \{ int v = 2; \}/);
  assert.equal(mr.diffs[0].too_large, false);
  assert.equal(mr.diffs[4].too_large, true);
  assert.ok(existsSync(join(work, 'blobs', 'head', 'src', 'main', 'java', 'app', 'A.java')));
  assert.ok(existsSync(join(work, 'blobs', 'head', 'src', 'main', 'java', 'app', 'B.java')));          // 잘리지 않은 파일도 head 원문 확보
  assert.ok(existsSync(join(work, 'blobs', 'head', 'docs', 'specs', '2026-10-01-feature.md')));
  assert.ok(!existsSync(join(work, 'blobs', 'head', 'src', 'main', 'java', 'app', 'Old.java')));       // 삭제 파일은 없음
});

test('정상 diff-only(잘림 없음)에서도 blobs/head 에 비삭제 변경 파일 전문이 전부 있다 — 검토자 cwd (R1-5)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: { alpha: { id: 101, path: 'repos/missing', deployExempt: false } } });
  const headSha = 'a'.repeat(40);
  const g = fakeGlab(root, [...rules(headSha), ...headRaw(headSha, ['src/main/java/app/A.java', 'src/main/java/app/B.java', 'docs/specs/2026-10-01-feature.md'])]);
  const work = join(root, 'work');
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, /^COLLECTED diff-only .* unrecovered=0$/);
  const snap = readJson(join(work, 'snapshot.json'));
  assert.deepEqual(snap.rebuilt, []);
  assert.deepEqual(snap.unrecovered, []);
  for (const p of ['src/main/java/app/A.java', 'src/main/java/app/B.java', 'docs/specs/2026-10-01-feature.md']) assert.equal(readFileSync(join(work, 'blobs', 'head', p), 'utf8'), `// head ${p}\n`);
  assert.ok(!existsSync(join(work, 'blobs', 'base')));            // 잘림이 없으면 base blob 은 받지 않는다
});

test('--diff-only 는 체크아웃이 있어도 diff-only 로 간다 · overflow 면 빈 diff 를 잘림으로 본다 · head 원문 실패도 unrecovered', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { headSha } = initRepos(root, { iid: IID });
  const p = `projects/101/merge_requests/${IID}`;
  const diffs = DIFFS.map((d) => ({ ...d }));
  diffs[1] = { ...diffs[1], diff: '' };
  const g = fakeGlab(root, [
    ...rules(headSha).filter((x) => !x.match.includes('/diffs') && !x.match.includes('/changes')),
    { match: `^api --paginate ${p}/diffs`, json: diffs },
    { match: `^api ${p}/changes$`, json: { overflow: true } },
    ...headRaw(headSha, ['src/main/java/app/A.java', 'docs/specs/2026-10-01-feature.md']),   // B.java 는 head raw 규칙 없음
  ]);
  const work = join(root, 'work');
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work, '--diff-only'], g.env);
  assert.equal(r.code, 0, r.out);
  const snap = readJson(join(work, 'snapshot.json'));
  assert.equal(snap.mode, 'diff-only');
  assert.deepEqual(snap.unrecovered, ['src/main/java/app/B.java']);   // new_file·잘림: head raw 규칙 없음 → 원문도 diff 도 확보 실패
  assert.equal(readJson(join(work, 'mr.json')).overflow, true);
  assert.equal(snap.diff_list_complete, false);                        // overflow + changes_count 없음 → 목록 완전성 미확인(fail-closed, R2-2)
  // overflow 지만 changes_count 가 수신 항목 수와 맞으면 목록은 완전
  const g2 = fakeGlab(root, [
    ...rules(headSha, { metaRules: [{ match: `^api ${p}$`, json: meta(headSha, { changes_count: '4' }) }] }).filter((x) => !x.match.includes('/diffs') && !x.match.includes('/changes')),
    { match: `^api --paginate ${p}/diffs`, json: diffs },
    { match: `^api ${p}/changes$`, json: { overflow: true } },
    ...headRaw(headSha, ['src/main/java/app/A.java', 'docs/specs/2026-10-01-feature.md']),
  ]);
  const work2 = join(root, 'work2');
  runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work2, '--diff-only'], g2.env);
  assert.equal(readJson(join(work2, 'snapshot.json')).diff_list_complete, true);
  assert.equal(readJson(join(work2, 'mr.json')).changes_count, '4');
  // "4+" 또는 수신 수보다 큰 값이면 불완전
  const g3 = fakeGlab(root, [
    ...rules(headSha, { metaRules: [{ match: `^api ${p}$`, json: meta(headSha, { changes_count: '4+' }) }] }).filter((x) => !x.match.includes('/changes')),
    { match: `^api ${p}/changes$`, json: { overflow: true } },
    ...headRaw(headSha, ['src/main/java/app/A.java', 'src/main/java/app/B.java', 'docs/specs/2026-10-01-feature.md']),
  ]);
  const work3 = join(root, 'work3');
  runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work3, '--diff-only'], g3.env);
  assert.equal(readJson(join(work3, 'snapshot.json')).diff_list_complete, false);
});

test('diff-only: 메타 head 와 diff 버전 head 가 계속 다르면 HEAD_MOVED exit 3 — 다른 head 의 자료를 섞지 않는다(R3-2)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: { alpha: { id: 101, path: 'repos/missing', deployExempt: false } } });
  const headSha = 'a'.repeat(40);
  const p = `projects/101/merge_requests/${IID}`;
  const g = fakeGlab(root, [
    ...rules(headSha).filter((x) => !x.match.includes('/versions')),
    { match: `^api ${p}/versions$`, json: [{ head_commit_sha: DEAD, base_commit_sha: 'b'.repeat(40), start_commit_sha: 'b'.repeat(40) }] },   // 중간 push — 버전의 head 가 메타와 다르다
    ...headRaw(headSha, ['src/main/java/app/A.java', 'src/main/java/app/B.java', 'docs/specs/2026-10-01-feature.md']),
  ]);
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', join(root, 'work')], g.env);
  assert.equal(r.code, 3, r.out);
  assert.match(r.first, /^ERR HEAD_MOVED/);
  assert.equal(g.calls().filter((c) => c.join(' ') === `api ${p}`).length, 3);
  assert.ok(!existsSync(join(root, 'work', 'snapshot.json')));
});

test('보조 API 실패는 빈 응답이 아니다 — api_failures 에 남고 overflow 는 null(목록 완전성 미확인)(R3-3)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: { alpha: { id: 101, path: 'repos/missing', deployExempt: false } } });
  const headSha = 'a'.repeat(40);
  const g = fakeGlab(root, [
    ...rules(headSha).filter((x) => !x.match.includes('/changes') && !x.match.includes('/closes_issues')),   // /changes · /closes_issues 는 404
    ...headRaw(headSha, ['src/main/java/app/A.java', 'src/main/java/app/B.java', 'docs/specs/2026-10-01-feature.md']),
  ]);
  const work = join(root, 'work');
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  const mr = readJson(join(work, 'mr.json'));
  assert.equal(mr.overflow, null);
  assert.deepEqual(mr.closes_issues, []);
  assert.deepEqual(mr.api_failures, ['changes', 'closes_issues']);
  const snap = readJson(join(work, 'snapshot.json'));
  assert.deepEqual(snap.api_failures, ['changes', 'closes_issues']);
  assert.equal(snap.diff_list_complete, false);                        // overflow 를 모르고 changes_count 도 없다 → 불완전(fail-closed)
});

test('어댑터에 없는 프로젝트 → ERR exit 2', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const r = runCli(['collect', '--adapter', adapter, '--project', 'zeta', '--iid', '1', '--work', join(root, 'w')]);
  assert.equal(r.code, 2);
  assert.match(r.first, /^ERR .*zeta/);
});

test('diff-only 복원 경로 검증: 상위 이동·절대 경로·역슬래시·드라이브 경로는 blobs 밖에 쓰지 않고 unrecovered (impl SDD 이월 T02 + R1-3, 사용자 판정)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: { alpha: { id: 101, path: 'repos/missing', deployExempt: false } } });
  const headSha = 'a'.repeat(40);
  const bad = ['../../../escape.txt', '/abs-escape.txt', '..\\..\\..\\win-escape.txt', 'C:/drive-escape.txt', 'ok/../../../../mid-escape.txt'];
  const diffs = [
    ...bad.map((p) => ({ old_path: p, new_path: p, new_file: true, renamed_file: false, deleted_file: false, diff: '@@ -0,0 +1 @@\n+x\n' })),
    { old_path: '../../../base-escape.txt', new_path: 'src/main/java/app/A.java', new_file: false, renamed_file: true, deleted_file: false, too_large: true, diff: '' },   // base 쪽 경로도 검증
    DIFFS[0],
  ];
  const g = fakeGlab(root, [
    { match: `^api --paginate projects/101/merge_requests/${IID}/diffs`, json: diffs },
    ...rules(headSha),
    { match: '^api projects/101/repository/files/.*/raw', text: 'PAYLOAD\n' },
  ]);
  const work = join(root, 'work');
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  const snap = readJson(join(work, 'snapshot.json'));
  for (const p of bad) assert.ok(snap.unrecovered.includes(p), `${p} ∉ ${JSON.stringify(snap.unrecovered)}`);
  assert.ok(snap.unrecovered.includes('src/main/java/app/A.java'));                    // base 경로가 밖이면 그 파일 재구성도 미확보
  for (const f of ['escape.txt', 'abs-escape.txt', 'win-escape.txt', 'drive-escape.txt', 'mid-escape.txt', 'base-escape.txt']) {
    assert.ok(!existsSync(join(root, f)), f);
    assert.ok(!existsSync(join(work, f)), f);
  }
  assert.ok(!existsSync('/abs-escape.txt'));
  assert.equal(readFileSync(join(work, 'blobs', 'head', 'src/main/java/app/A.java'), 'utf8'), 'PAYLOAD\n');   // 정상 경로는 그대로 받는다
  assert.ok(!g.calls().some((c) => /escape/.test(decodeURIComponent(c.join(' ')))));     // 밖으로 나가는 경로는 원문 조회도 하지 않는다
});

test('모든 glab 호출에 어댑터 호스트(--hostname)를 붙이고, MR web_url 호스트가 다르면 ERR — 다른 서버의 같은 번호 MR 을 받지 않는다 (impl R2-4)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { projects: { alpha: { id: 101, path: 'repos/missing', deployExempt: false } } });
  const headSha = 'a'.repeat(40);
  const g = fakeGlab(root, [...rules(headSha), ...headRaw(headSha, ['src/main/java/app/A.java', 'src/main/java/app/B.java', 'docs/specs/2026-10-01-feature.md'])]);
  const work = join(root, 'work');
  const r = runCli(['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(g.hosts().length > 5);
  assert.deepEqual([...new Set(g.hosts())], ['gitlab.test']);
  const root2 = tmp();
  const adapter2 = writeAdapter(root2, { projects: { alpha: { id: 101, path: 'repos/missing', deployExempt: false } } });
  const p = `projects/101/merge_requests/${IID}`;
  const g2 = fakeGlab(root2, rules(headSha, { metaRules: [{ match: `^api ${p}$`, json: meta(headSha, { web_url: 'https://gitlab.example.com/g/alpha/-/merge_requests/7' }) }] }));
  const r2 = runCli(['collect', '--adapter', adapter2, '--project', 'alpha', '--iid', String(IID), '--work', join(root2, 'work')], g2.env);
  assert.equal(r2.code, 2, r2.out);
  assert.match(r2.first, /^ERR .*호스트/);
  assert.ok(!existsSync(join(root2, 'work', 'mr.json')));
});

// ── 1.3.1 ② 머지된 MR — 워크트리 모드 base = API diff base (spec 2026-10-22 3.②) ──
// head 를 target 에 머지하고 origin/target 을 갱신한다(ff = fast-forward, 아니면 머지 커밋). 반환 = 머지 뒤 target SHA
function mergeIntoTarget(root, bare, { ff = false } = {}) {
  const m = join(root, 'merger');
  git(root, 'clone', '-q', bare, m);
  git(m, 'merge', '-q', ff ? '--ff-only' : '--no-ff', '-m', 'merge feat', 'origin/feat');
  git(m, 'push', '-q', 'origin', 'master');
  const sha = git(m, 'rev-parse', 'HEAD');
  rmSync(m, { recursive: true, force: true });
  return sha;
}
const collectArgs = (adapter, work, extra = []) => ['collect', '--adapter', adapter, '--project', 'alpha', '--iid', String(IID), '--work', work, ...extra];
const mergedMeta = (headSha, base, extra = {}) => meta(headSha, { state: 'merged', diff_refs: base ? { base_sha: base, head_sha: headSha, start_sha: base } : null, ...extra });

test('머지된 MR(머지 커밋) 워크트리 모드: base = API diff base — base·변경 목록·배포 기대 목록이 머지 전과 같다 (1.3.1 AC②-1·②-2)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { bare, baseSha, headSha } = initRepos(root, { iid: IID });
  const p = `projects/101/merge_requests/${IID}`;
  const before = join(root, 'work-before');
  const g0 = fakeGlab(root, rules(headSha, { base: baseSha }));
  assert.equal(runCli(collectArgs(adapter, before), g0.env).code, 0);
  const mergeSha = mergeIntoTarget(root, bare);
  const g = fakeGlab(root, rules(headSha, { base: baseSha, metaRules: [{ match: `^api ${p}$`, json: mergedMeta(headSha, baseSha) }] }));
  const work = join(root, 'work');
  const r = runCli(collectArgs(adapter, work), g.env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.first, `COLLECTED worktree head=${headSha.slice(0, 7)} base=${baseSha.slice(0, 7)} target=${mergeSha.slice(0, 7)} attempts=1 unrecovered=0`);
  const snap = readJson(join(work, 'snapshot.json'));
  assert.equal(snap.base_sha, baseSha);
  assert.equal(snap.base_source, 'api');
  assert.equal(snap.target_sha, mergeSha);
  const paths = (w) => readJson(join(w, 'mr.json')).diffs.map((d) => d.new_path).sort();
  assert.deepEqual(paths(work), paths(before));
  assert.equal(paths(work).length, 4);
  // AC②-2 — deploy 는 「운영 배포 대상 변경 없음」이 아니다
  for (const w of [before, work]) writeFileSync(join(w, 'check.json'), JSON.stringify({ attachments: [], deployExempt: false, deployNote: null }));
  const d0 = runCli(['deploy', '--adapter', adapter, '--work', before], g.env);
  const d1 = runCli(['deploy', '--adapter', adapter, '--work', work], g.env);
  assert.equal(d1.first, d0.first);
  const dj = readJson(join(work, 'deploy.json'));
  assert.equal(dj.applicable, true);
  assert.deepEqual(dj.expected, readJson(join(before, 'deploy.json')).expected);
  assert.deepEqual(dj.expected.deploy, ['src/main/java/app/A.java', 'src/main/java/app/B.java']);
});

test('API base 가 head 의 조상이 아니면(로컬에 없거나 다른 갈래) ERR BASE_MISMATCH exit 2 — mr.json·snapshot.json 을 쓰지 않는다 (1.3.1 AC②-3)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { bare, headSha } = initRepos(root, { iid: IID });
  const mergeSha = mergeIntoTarget(root, bare);                       // 로컬에 있지만 head 의 조상이 아닌 커밋
  const p = `projects/101/merge_requests/${IID}`;
  for (const bad of [mergeSha, DEAD]) {
    const g = fakeGlab(root, rules(headSha, { base: bad, metaRules: [{ match: `^api ${p}$`, json: mergedMeta(headSha, bad) }] }));
    const work = join(root, `work-${bad.slice(0, 4)}`);
    const r = runCli(collectArgs(adapter, work), g.env);
    assert.equal(r.code, 2, r.out + r.err);
    assert.match(r.first, new RegExp(`^ERR BASE_MISMATCH — API base ${bad.slice(0, 7)}가 head ${headSha.slice(0, 7)}의 조상이 아니다`));
    assert.ok(!existsSync(join(work, 'mr.json')));
    assert.ok(!existsSync(join(work, 'snapshot.json')));
  }
});

test('versions·diff_refs 가 모두 없으면 merge-base 폴백 — 머지 뒤 git diff 0 ≠ API 변경 ≥1 이면 ERR DIFF_EMPTY_MISMATCH, API 도 0 이면 정상 (1.3.1 AC②-4)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { bare, headSha } = initRepos(root, { iid: IID });
  mergeIntoTarget(root, bare);
  const p = `projects/101/merge_requests/${IID}`;
  const noVersions = (h, diffs) => [
    ...rules(h, { metaRules: [{ match: `^api ${p}$`, json: mergedMeta(h, null) }] }).filter((x) => !x.match.includes('/versions') && !x.match.includes('/diffs')),   // versions 404 → 조회 실패
    { match: `^api --paginate ${p}/diffs`, json: diffs },
  ];
  const work = join(root, 'work');
  const r = runCli(collectArgs(adapter, work), fakeGlab(root, noVersions(headSha, DIFFS)).env);
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.first, /^ERR DIFF_EMPTY_MISMATCH — git diff 0건 ≠ API 변경 4건\(base 산정 오류 의심\)/);
  assert.ok(!existsSync(join(work, 'snapshot.json')));
  const root2 = tmp();
  const adapter2 = writeAdapter(root2);
  const r2repo = initRepos(root2, { iid: IID });
  mergeIntoTarget(root2, r2repo.bare);
  const work2 = join(root2, 'work');
  const r2 = runCli(collectArgs(adapter2, work2), fakeGlab(root2, noVersions(r2repo.headSha, [])).env);
  assert.equal(r2.code, 0, r2.out + r2.err);
  const snap = readJson(join(work2, 'snapshot.json'));
  assert.equal(snap.base_source, 'merge-base');
  assert.equal(snap.base_sha, r2repo.headSha);                       // 머지 뒤 merge-base = head
  assert.deepEqual(snap.api_failures, ['versions']);
});

test('열린 MR 워크트리 모드는 base_source = "api" 이고 base 가 1.3.0 과 같다 (1.3.1 AC②-5)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { baseSha, headSha } = initRepos(root, { iid: IID });
  const work = join(root, 'work');
  const r = runCli(collectArgs(adapter, work), fakeGlab(root, rules(headSha, { base: baseSha })).env);
  assert.equal(r.code, 0, r.out + r.err);
  const snap = readJson(join(work, 'snapshot.json'));
  assert.equal(snap.base_sha, baseSha);
  assert.equal(snap.base_source, 'api');
});

test('워크트리 모드도 diff 버전 head ≠ API head 면 재수집 — 둘째에 맞으면 attempts=2, 3회 모두 다르면 HEAD_MOVED exit 3 (1.3.1 AC②-6 · D27)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { baseSha, headSha } = initRepos(root, { iid: IID });
  const p = `projects/101/merge_requests/${IID}`;
  const vRule = (h, times) => ({ match: `^api ${p}/versions$`, json: [{ head_commit_sha: h, base_commit_sha: baseSha, start_commit_sha: baseSha }], ...(times ? { times } : {}) });
  const base = rules(headSha, { base: baseSha }).filter((x) => !x.match.includes('/versions'));
  const work = join(root, 'work');
  const r = runCli(collectArgs(adapter, work), fakeGlab(root, [...base, vRule(DEAD, 1), vRule(headSha)]).env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, / attempts=2 /);
  assert.equal(readJson(join(work, 'snapshot.json')).base_source, 'api');
  const root2 = tmp();
  const adapter2 = writeAdapter(root2);
  const r2repo = initRepos(root2, { iid: IID });
  const base2 = rules(r2repo.headSha, { base: r2repo.baseSha }).filter((x) => !x.match.includes('/versions'));
  const g2 = fakeGlab(root2, [...base2, { match: `^api ${p}/versions$`, json: [{ head_commit_sha: DEAD, base_commit_sha: r2repo.baseSha, start_commit_sha: r2repo.baseSha }] }]);
  const r2 = runCli(collectArgs(adapter2, join(root2, 'work')), g2.env);
  assert.equal(r2.code, 3, r2.out + r2.err);
  assert.match(r2.first, /^ERR HEAD_MOVED/);
  assert.ok(!existsSync(join(root2, 'work', 'snapshot.json')));
});

test('얕은 clone 에서 API base 가 로컬에 없으면 ERR BASE_MISMATCH 문구로 git fetch --unshallow 를 안내한다 — 자동 unshallow 안 함 (1.3.1 AC②-7 · D28)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { bare, checkout, baseSha, headSha } = initRepos(root, { iid: IID });
  mergeIntoTarget(root, bare, { ff: true });                          // fast-forward 머지 — target 끝 = head
  rmSync(checkout, { recursive: true, force: true });
  git(root, 'clone', '-q', '--depth', '1', `file://${bare}`, checkout);   // head 만 있는 얕은 clone(base 없음)
  const p = `projects/101/merge_requests/${IID}`;
  const g = fakeGlab(root, rules(headSha, { base: baseSha, metaRules: [{ match: `^api ${p}$`, json: mergedMeta(headSha, baseSha) }] }));
  const work = join(root, 'work');
  const r = runCli(collectArgs(adapter, work), g.env);
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.first, new RegExp(`^ERR BASE_MISMATCH — 얕은 clone\\(shallow\\)이라 base ${baseSha.slice(0, 7)}가 로컬에 없다\\. 체크아웃에서 git fetch --unshallow 뒤 다시 실행`));
  assert.equal(git(checkout, 'rev-parse', '--is-shallow-repository'), 'true');   // 스킬이 체크아웃을 깊게 하지 않았다
  assert.ok(!existsSync(join(work, 'snapshot.json')));
});

test('얕은 clone 에서 base 객체는 있으나 head 까지의 이력이 shallow 경계로 끊겨 조상 확인이 실패해도 git fetch --unshallow 를 안내한다 (1.3.1 R2-1 · D28)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { bare, checkout, baseSha, headSha } = initRepos(root, { iid: IID });
  mergeIntoTarget(root, bare, { ff: true });
  rmSync(checkout, { recursive: true, force: true });
  git(root, 'clone', '-q', '--depth', '1', `file://${bare}`, checkout);   // head 만
  git(bare, 'tag', 'b0', baseSha);
  git(checkout, 'fetch', '-q', '--depth', '1', 'origin', 'refs/tags/b0:refs/tags/b0');   // base 객체도 받지만 head 와 이어지지 않는다
  git(checkout, 'cat-file', '-e', `${baseSha}^{commit}`);
  const p = `projects/101/merge_requests/${IID}`;
  const g = fakeGlab(root, rules(headSha, { base: baseSha, metaRules: [{ match: `^api ${p}$`, json: mergedMeta(headSha, baseSha) }] }));
  const work = join(root, 'work');
  const r = runCli(collectArgs(adapter, work), g.env);
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.first, /^ERR BASE_MISMATCH — 얕은 clone\(shallow\)이라 .*git fetch --unshallow 뒤 다시 실행/);
  assert.ok(!existsSync(join(work, 'snapshot.json')));
});

// ── 1.3.1 ① 포트 있는 GitLab — --hostname 은 포트 제거, web_url 대조는 포트 포함 (spec 2026-10-22 3.①) ──
test('포트 있는 어댑터 host: glab --hostname 에는 포트 없는 호스트만, web_url 은 포트까지 같아야 통과 (1.3.1 AC①-1·①-2)', () => {
  const root = tmp();
  const adapter = writeAdapter(root, { gitlab: { host: 'gitlab.test:8443' }, projects: { alpha: { id: 101, path: 'repos/missing', deployExempt: false } } });
  const headSha = 'a'.repeat(40);
  const p = `projects/101/merge_requests/${IID}`;
  const raws = headRaw(headSha, ['src/main/java/app/A.java', 'src/main/java/app/B.java', 'docs/specs/2026-10-01-feature.md']);
  const g = fakeGlab(root, [...rules(headSha, { metaRules: [{ match: `^api ${p}$`, json: meta(headSha, { web_url: 'https://gitlab.test:8443/g/alpha/-/merge_requests/7' }) }] }), ...raws]);
  const r = runCli(collectArgs(adapter, join(root, 'work')), g.env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(g.hosts().length > 5);
  assert.deepEqual([...new Set(g.hosts())], ['gitlab.test']);          // 호출 전부 포트 없음
  const root2 = tmp();
  const adapter2 = writeAdapter(root2, { gitlab: { host: 'gitlab.test:8443' }, projects: { alpha: { id: 101, path: 'repos/missing', deployExempt: false } } });
  const g2 = fakeGlab(root2, [...rules(headSha), ...raws]);            // web_url = http://gitlab.test/… (포트 없음)
  const r2 = runCli(collectArgs(adapter2, join(root2, 'work')), g2.env);
  assert.equal(r2.code, 2, r2.out);
  assert.match(r2.first, /^ERR .*호스트/);
  assert.ok(!existsSync(join(root2, 'work', 'mr.json')));
});

test('SKILL.md §0 에 포트 있는 GitLab 의 glab 설정 전제와 glab api … version 사전 점검(실패 = 안내 + 정지)이 있다 (1.3.1 AC①-4 · D31)', () => {
  const skill = readFileSync(join(CLI, '..', '..', 'SKILL.md'), 'utf8');
  const s0 = skill.slice(skill.indexOf('## 0. 전제 확인'), skill.indexOf('## 1. 작업 디렉터리'));
  assert.match(s0, /glab api --hostname "\$H" version/);
  assert.match(s0, /api_host/);
  assert.match(s0, /GLAB_HOST_FAIL[^\n]*\*\*멈춘다\*\*/);
  assert.match(s0, /포트 없는 호스트 키/);
});

test('SKILL.md §0 사전 점검의 호스트 추출이 어댑터 파서(extractBlock)와 같은 형식을 받는다 — CRLF·들여쓴 펜스에서도 포트 뗀 호스트 (1.3.1 R1-2)', () => {
  const skill = readFileSync(join(CLI, '..', '..', 'SKILL.md'), 'utf8');
  const line = skill.split('\n').find((l) => l.startsWith('H=$(node -e '));
  assert.ok(line, 'SKILL §0 의 H=$(node -e …) 줄');
  const js = line.slice('H=$(node -e \''.length, line.indexOf('\' "$A")'));
  const root = tmp();
  const lf = readFileSync(writeAdapter(root, { gitlab: { host: 'gitlab.test:8443' } }), 'utf8');
  const variants = { lf, crlf: lf.replace(/\n/g, '\r\n'), indented: lf.replace(/^```/gm, '  ```') };
  for (const [name, text] of Object.entries(variants)) {
    const f = join(root, `adapter-${name}.md`);
    writeFileSync(f, text);
    const r = spawnSync(process.execPath, ['-e', js, f], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${name}: ${r.stderr}`);
    assert.equal(r.stdout.trim(), 'gitlab.test', name);
  }
});
