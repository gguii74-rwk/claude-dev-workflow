// collect 계약 테스트 (spec §5.1 · SC-3) — 가짜 glab + 로컬 bare origin
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmp, writeAdapter, initRepos, fakeGlab, runCli, readJson } from './helpers.mjs';

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
function rules(headSha, { metaRules } = {}) {
  const p = `projects/101/merge_requests/${IID}`;
  return [
    ...(metaRules || [{ match: `^api ${p}$`, json: meta(headSha) }]),
    { match: `^api --paginate ${p}/diffs`, json: DIFFS },
    { match: `^api ${p}/changes$`, json: { overflow: false } },
    { match: `^api --paginate ${p}/notes`, json: NOTES },
    { match: `^api --paginate ${p}/closes_issues`, json: [{ iid: 12, project_id: 101, title: '버그', description: '① 왜 ② 무엇을', updated_at: '2026-10-19T00:00:00Z', web_url: 'http://gitlab.test/g/alpha/-/issues/12' }] },
    { match: `^api ${p}/versions$`, json: [{ head_commit_sha: headSha, base_commit_sha: 'b'.repeat(40), start_commit_sha: 'b'.repeat(40) }] },
    { match: `^api ${p}/approvals$`, json: { approved_by: [{ user: { username: 'rev-b' } }] } },
  ];
}

test('worktree 모드: fetch head = API head → 세 SHA 고정 + 워크트리 · 변경 목록은 API 가 아니라 git 정본(R3-4)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const { checkout, baseSha, headSha } = initRepos(root, { iid: IID });
  const p = `projects/101/merge_requests/${IID}`;
  const g = fakeGlab(root, [...rules(headSha).filter((x) => !x.match.includes('/diffs')), { match: `^api --paginate ${p}/diffs`, json: DIFFS.slice(0, 3) }]);   // API 목록에는 docs/specs 문서가 빠져 있다(overflow 흉내)
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
  assert.equal(mr.versions[0].base_commit_sha, 'b'.repeat(40));
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
  const { headSha } = initRepos(root, { iid: IID });
  const p = `projects/101/merge_requests/${IID}`;
  const g = fakeGlab(root, rules(headSha, { metaRules: [{ match: `^api ${p}$`, json: meta(DEAD), times: 1 }, { match: `^api ${p}$`, json: meta(headSha) }] }));
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
