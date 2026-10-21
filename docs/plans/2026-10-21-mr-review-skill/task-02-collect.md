# task-02 — GitLab 수집 · 스냅샷 고정 · diff-only 복원 (collect) (spec §5.1-1~3 · F6 · SC-3 `mr.json`·`snapshot.json`)

**목적**: `glab api`로 MR 메타·diff·댓글·이슈·버전·승인을 읽어 `mr.json`으로 정규화하고, 로컬 체크아웃이 있으면 target·MR head를 fetch해 **API head = fetch head**를 확인한 뒤 세 SHA(target·base·head)와 임시 워크트리를 `snapshot.json`에 고정한다. 체크아웃이 없으면 diff-only 모드로 잘린 diff를 base·head 양쪽 blob으로 재구성한다(못 하면 `unrecovered`).

## Files

- Create: `dev-workflow/skills/mr-review/scripts/lib/gitlab.mjs`
- Create: `dev-workflow/skills/mr-review/scripts/lib/collect.mjs`
- Modify: `dev-workflow/skills/mr-review/scripts/mr-review.mjs` (`COMMANDS`에 `collect` 등록 — 아래 단계 5)
- Test: `tests/mr-review/collect.test.mjs`

## Prep

- spec §5.1-1·2·3(수집·스냅샷 고정·diff-only 복원) · §3(`glab api`, `glab mr` 금지) · D15 · F6.
- 엔트리포인트 **SC-3**(`mr.json`·`snapshot.json` 정본) · **SC-6**(`collect` 출력) · **SC-7**(`MR_REVIEW_GLAB`).
- task-01 산출물: `tests/mr-review/helpers.mjs`(`initRepos`·`fakeGlab`·`writeAdapter`·`runCli`) · `lib/adapter.mjs`.
- GitLab 17.11 CE 실측(2026-10-21): `merge_requests/:iid` → `sha`·`diff_refs{base_sha,head_sha,start_sha}`·`reviewers[]`·`author`·`detailed_merge_status`·`has_conflicts` / `…/diffs`(페이지) → `old_path`·`new_path`·`new_file`·`renamed_file`·`deleted_file`·`diff` / `…/changes` → `overflow` / `…/notes` → `system`·`author`·`created_at`·`body` / `…/versions[0]` → `base_commit_sha`·`head_commit_sha` / `…/closes_issues` / `…/approvals` → `approved_by[].user.username` / `repository/files/<URL 인코딩 경로>/raw?ref=<sha>`. `glab api --paginate`는 배열을 하나로 합쳐 출력한다.

## Deps

01

## Steps

### 1. 테스트 작성 (RED)

`tests/mr-review/collect.test.mjs`를 아래 내용 그대로 만든다.

````js
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
    ...headRaw(headSha, ['src/main/java/app/B.java', 'docs/specs/2026-10-01-feature.md']),   // C.java 는 head raw 규칙 없음 → 실패
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
````

실행:

```bash
node --test tests/mr-review/collect.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: tests 9 · pass 0 · fail 9.

### 2. `gitlab.mjs`

`dev-workflow/skills/mr-review/scripts/lib/gitlab.mjs`를 아래 내용 그대로 만든다.

````js
// gitlab.mjs — `glab api` 래퍼(D15: 토큰은 glab 이 관리). JSON·바이너리·페이지. 테스트는 MR_REVIEW_GLAB 로 가짜 glab 을 꽂는다.
import { spawnSync } from 'node:child_process';

export class GitLabError extends Error {
  constructor(message, status = null) { super(message); this.status = status; }
}

const MAX_BUFFER = 512 * 1024 * 1024;

export function glabBin() {
  return process.env.MR_REVIEW_GLAB || 'glab';
}

function run(args, { binary = false } = {}) {
  const r = spawnSync(glabBin(), ['api', ...args], { encoding: binary ? 'buffer' : 'utf8', maxBuffer: MAX_BUFFER });
  if (r.error) throw new GitLabError(`glab 실행 실패(${glabBin()}): ${r.error.message}`);
  if (r.status !== 0) {
    const body = binary ? r.stdout.toString('utf8') : r.stdout;
    const err = binary ? r.stderr.toString('utf8') : r.stderr;
    throw new GitLabError(`glab api ${args.join(' ')} 실패(exit ${r.status}): ${String(body).slice(0, 300)} ${String(err).slice(0, 200)}`.trim(), r.status);
  }
  return r.stdout;
}

export function apiJson(apiPath, { paginate = false } = {}) {
  const out = run(paginate ? ['--paginate', apiPath] : [apiPath]);
  try { return JSON.parse(out); } catch { throw new GitLabError(`glab api ${apiPath}: JSON 응답이 아니다: ${String(out).slice(0, 200)}`); }
}

export function apiRaw(apiPath) {
  return run([apiPath], { binary: true });
}

// repository/files/:file_path 용 — `/` 와 `.` 까지 인코딩한다(GitLab 문서 예: app%2Fmodels%2Fkey%2Erb)
export function encodePath(p) {
  return encodeURIComponent(p).replace(/\./g, '%2E');
}
````

### 3. `collect.mjs`

`dev-workflow/skills/mr-review/scripts/lib/collect.mjs`를 아래 내용 그대로 만든다.

````js
// collect.mjs — spec §5.1-1~3. MR 수집 → mr.json, 스냅샷 고정(세 SHA·워크트리) 또는 diff-only 복원 → snapshot.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { apiJson, apiRaw, encodePath } from './gitlab.mjs';

export class CollectError extends Error {
  constructor(message, code = 2) { super(message); this.code = code; }
}

const MAX_ATTEMPTS = 3;
const MAX_BUFFER = 512 * 1024 * 1024;

function git(cwd, args, { allowFail = false } = {}) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new CollectError(`git ${args.join(' ')} 실패(${cwd}): ${(r.stderr || '').trim().slice(0, 300)}`);
  }
  return r.stdout.trim();
}

export function isGitDir(p) {
  if (!p || !fs.existsSync(p)) return false;
  return spawnSync('git', ['-C', p, 'rev-parse', '--git-dir'], { encoding: 'utf8' }).status === 0;
}

// §5.1-1 — 메타·diff·overflow·댓글(system 포함)·연결 이슈·버전·승인.
// 보조 조회의 실패는 빈 응답이 아니다(R3-3) — `api_failures` 에 남겨 verdict 가 결정적 증거 부족으로 받는다. overflow 는 /changes 실패 시 null(모름 — fail-closed).
export function fetchMr(projectId, iid) {
  const base = `projects/${projectId}/merge_requests/${iid}`;
  const failures = [];
  const meta = apiJson(base);
  const diffs = apiJson(`${base}/diffs?per_page=100`, { paginate: true });
  let overflow = null;
  try { overflow = apiJson(`${base}/changes`)?.overflow === true; } catch { failures.push('changes'); }
  const notes = apiJson(`${base}/notes?per_page=100&sort=asc&order_by=created_at`, { paginate: true });
  let closes = [];
  try { closes = apiJson(`${base}/closes_issues?per_page=100`, { paginate: true }); } catch { failures.push('closes_issues'); }
  let versions = [];
  try { versions = apiJson(`${base}/versions`); } catch { failures.push('versions'); }
  let approvals = null;
  try { approvals = apiJson(`${base}/approvals`); } catch { failures.push('approvals'); }
  return { meta, diffs: Array.isArray(diffs) ? diffs : [], overflow, notes: Array.isArray(notes) ? notes : [], closes: Array.isArray(closes) ? closes : [], versions: Array.isArray(versions) ? versions : [], approvals, api_failures: failures };
}

export function normalize(project, projectName, iid, raw, collectedAt) {
  const m = raw.meta;
  const diffs = raw.diffs.map((d) => ({
    old_path: d.old_path, new_path: d.new_path,
    new_file: d.new_file === true, renamed_file: d.renamed_file === true, deleted_file: d.deleted_file === true,
    too_large: d.too_large === true || (raw.overflow !== false && !d.diff),   // overflow 를 모르면(null) 빈 diff 는 잘림으로 본다
    diff: d.diff || '',
  }));
  const notes = raw.notes.map((n) => ({ id: n.id, system: n.system === true, author: { id: n.author?.id ?? null, username: n.author?.username ?? '' }, created_at: n.created_at, body: n.body || '' }));
  const descChanged = notes.filter((n) => n.system && /^changed the description/.test(n.body)).map((n) => n.created_at).sort().pop() || null;
  return {
    project: { name: projectName, id: project.id, checkout: project.checkout, deployExempt: project.deployExempt === true },
    iid: Number(iid), title: m.title || '', description: m.description || '', state: m.state || '', updated_at: m.updated_at || null, web_url: m.web_url || '',
    author: { id: m.author?.id ?? null, username: m.author?.username ?? '' },
    reviewers: (m.reviewers || []).map((r) => ({ id: r.id, username: r.username })),
    source_branch: m.source_branch || '', target_branch: m.target_branch || '', api_head: m.sha || '', changes_count: m.changes_count == null ? null : String(m.changes_count),
    diff_refs: m.diff_refs ? { base_sha: m.diff_refs.base_sha, head_sha: m.diff_refs.head_sha, start_sha: m.diff_refs.start_sha } : null,
    detailed_merge_status: m.detailed_merge_status || '', has_conflicts: m.has_conflicts === true,
    approved_by: (raw.approvals?.approved_by || []).map((a) => a.user?.username).filter(Boolean),
    diffs, overflow: raw.overflow === true ? true : raw.overflow === false ? false : null, api_failures: raw.api_failures || [], notes, description_changed_at: descChanged,
    closes_issues: raw.closes.map((i) => ({ iid: i.iid, project_id: i.project_id, title: i.title || '', description: i.description || '', updated_at: i.updated_at || null, web_url: i.web_url || '' })),
    versions: raw.versions.map((v) => ({ head_commit_sha: v.head_commit_sha, base_commit_sha: v.base_commit_sha, start_commit_sha: v.start_commit_sha })),
    collected_at: collectedAt,
  };
}

// §5.1-2 — target·MR head fetch → API head 일치 확인 → 세 SHA 고정 → 임시 워크트리(기존 잔존물 제거)
export function pinWorktree(checkout, mr, work) {
  git(checkout, ['fetch', '-q', 'origin', mr.target_branch]);
  git(checkout, ['fetch', '-q', 'origin', `+refs/merge-requests/${mr.iid}/head:refs/mr-review/${mr.iid}/head`]);
  const head = git(checkout, ['rev-parse', `refs/mr-review/${mr.iid}/head`]);
  if (head !== mr.api_head) return null;
  const target = git(checkout, ['rev-parse', `origin/${mr.target_branch}`]);
  const base = git(checkout, ['merge-base', target, head]);
  const worktree = path.join(work, 'worktree');
  if (fs.existsSync(worktree)) {
    git(checkout, ['worktree', 'remove', '--force', worktree], { allowFail: true });
    fs.rmSync(worktree, { recursive: true, force: true });
  }
  git(checkout, ['worktree', 'prune'], { allowFail: true });
  git(checkout, ['worktree', 'add', '--detach', '-q', worktree, head]);
  return { head, target, base, worktree };
}

// 워크트리 모드의 변경 목록 정본(R3-4) — API 목록은 overflow 로 파일 항목이 통째로 빠질 수 있다. 고정 뒤에는 check(기준선 후보 탐색)·pack(문서 지도)·deploy 가
// 전부 이 git 목록(`--no-renames` — 이름 변경 = 삭제 + 추가, deploy 의 기대 목록과 같은 기준)을 소비한다.
export function gitDiffs(checkout, base, head) {
  const parts = git(checkout, ['diff', '-z', '--no-renames', '--name-status', base, head]).split('\0').filter(Boolean);
  const diffs = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const status = parts[i][0];
    const p = parts[i + 1];
    diffs.push({ old_path: p, new_path: p, new_file: status === 'A', renamed_file: false, deleted_file: status === 'D', too_large: false, diff: git(checkout, ['diff', '--no-renames', base, head, '--', p]) });
  }
  return diffs;
}

// §5.1-3 — diff-only 검토 루트 `blobs/head/` 는 잘림 유무와 무관하게 항상 만든다: 삭제되지 않은 모든 변경 파일의 head 원문을 고정 SHA 로 받는다
// (task-07 의 검토자 cwd·파일 전문 위치). 잘린 diff 는 base·head 양쪽 blob 으로 재구성 — 한쪽만으로는 복원이 아니다(삭제분 누락).
// head 원문 확보 실패도 unrecovered 로 판정에 전달한다(검토자가 전문을 못 읽은 파일 = 증거 부족).
export function rebuildDiffOnly(projectId, mr, work) {
  const head = mr.api_head;
  const base = mr.versions[0]?.base_commit_sha || mr.diff_refs?.base_sha || null;
  const unrecovered = [];
  const rebuilt = [];
  const headRoot = path.join(work, 'blobs', 'head');
  fs.rmSync(path.join(work, 'blobs'), { recursive: true, force: true });   // 이전 실행의 blob 잔존물 제거
  fs.mkdirSync(headRoot, { recursive: true });
  const emptyFile = path.join(work, 'blobs', 'empty');
  fs.writeFileSync(emptyFile, '');
  for (const d of mr.diffs) {
    const label = d.new_path || d.old_path;
    const hfile = path.join(headRoot, d.new_path || d.old_path);
    if (!d.deleted_file) {
      try {
        fs.mkdirSync(path.dirname(hfile), { recursive: true });
        fs.writeFileSync(hfile, apiRaw(`projects/${projectId}/repository/files/${encodePath(d.new_path)}/raw?ref=${head}`));
      } catch {
        unrecovered.push(label);
        continue;
      }
    }
    if (!d.too_large) continue;
    if (!base) { unrecovered.push(label); continue; }
    try {
      const bfile = path.join(work, 'blobs', 'base', d.old_path);
      if (!d.new_file) {
        fs.mkdirSync(path.dirname(bfile), { recursive: true });
        fs.writeFileSync(bfile, apiRaw(`projects/${projectId}/repository/files/${encodePath(d.old_path)}/raw?ref=${base}`));
      }
      const a = d.new_file ? emptyFile : bfile;
      const b = d.deleted_file ? emptyFile : hfile;
      const r = spawnSync('git', ['diff', '--no-index', '--', a, b], { encoding: 'utf8', maxBuffer: MAX_BUFFER });
      if (r.status !== 0 && r.status !== 1) throw new Error((r.stderr || '').trim());
      d.diff = r.stdout;
      d.too_large = false;
      rebuilt.push(label);
    } catch {
      unrecovered.push(label);
    }
  }
  // 변경 파일 목록 자체의 완전성 — overflow 면 API 가 파일 항목을 통째로 뺄 수 있다. 메타 changes_count("25" 또는 "25+")와 수신 항목 수를 대조해
  // 못 맞추면(모르면) 불완전으로 둔다(fail-closed) → verdict 의 결정적 증거 부족(M-diff-list). 파일별 복원 성공과는 별개다.
  // /changes 조회 실패(overflow null)도 「모름」이라 count 대조로만 완전 판정한다(R3-3).
  const expected = String(mr.changes_count ?? '');
  const n = parseInt(expected, 10);
  const diffListComplete = mr.overflow === false || (Number.isFinite(n) && !expected.endsWith('+') && n <= mr.diffs.length);
  return { head, base, target: base, unrecovered, rebuilt, diffListComplete };
}

// diff-only 에서 메타 head 와 diff 버전(versions[0]·diff_refs)의 head 가 다르면 수집 중 push 가 있었다 — 서로 다른 head 의 자료를 한 스냅샷으로 섞지 않는다(R3-2, F6).
export function diffHeadMismatch(mr) {
  const vHead = mr.versions[0]?.head_commit_sha || null;
  const rHead = mr.diff_refs?.head_sha || null;
  if (vHead && vHead !== mr.api_head) return vHead;
  if (rHead && rHead !== mr.api_head) return rHead;
  return null;
}

export function collect({ adapter, projectName, iid, work, diffOnly = false }) {
  const project = adapter.resolved.projects[projectName];
  if (!project) throw new CollectError(`어댑터에 없는 프로젝트: ${projectName} (있는 것: ${Object.keys(adapter.resolved.projects).join(', ')})`);
  if (!/^\d+$/.test(String(iid))) throw new CollectError(`--iid 는 정수여야 한다: ${iid}`);
  fs.mkdirSync(work, { recursive: true });
  // 새 수집 = 이전 실행의 검사·팩·검토·판정 산출물 전부 무효화 — 같은 work 를 다시 쓸 때 옛 verdict.json·findings.json 이 render 에 읽히지 않게 한다
  for (const f of ['check.json', 'deploy.json', 'pack.json', 'pack-a.md', 'pack-b.md', 'review-claude.json', 'review-codex.json', 'findings.json', 'verdict.json']) fs.rmSync(path.join(work, f), { force: true });
  fs.rmSync(path.join(work, 'baseline'), { recursive: true, force: true });
  const useWorktree = !diffOnly && isGitDir(project.checkout);
  let mr = null;
  let snapshot = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = fetchMr(project.id, iid);
    mr = normalize(project, projectName, iid, raw, new Date().toISOString());
    if (!mr.api_head) throw new CollectError('MR 메타에 head SHA(sha)가 없다');
    const fetchedAt = new Date().toISOString();
    if (useWorktree) {
      const pin = pinWorktree(project.checkout, mr, work);
      if (!pin) {
        if (attempt === MAX_ATTEMPTS) throw new CollectError(`HEAD_MOVED — ${MAX_ATTEMPTS}회 재수집에도 API head(${mr.api_head.slice(0, 7)})와 fetch head 가 다르다(push 진행 중?)`, 3);
        continue;
      }
      mr.diffs = gitDiffs(project.checkout, pin.base, pin.head);   // API 목록 → git 정본으로 교체(R3-4). overflow 는 더 이상 의미 없다
      mr.overflow = false;
      snapshot = { mode: 'worktree', target_sha: pin.target, base_sha: pin.base, head_sha: pin.head, checkout: project.checkout, worktree: pin.worktree, attempts: attempt, unrecovered: [], rebuilt: [], diff_list_complete: true, api_failures: mr.api_failures, fetched_at: fetchedAt };
    } else {
      const moved = diffHeadMismatch(mr);
      if (moved) {
        if (attempt === MAX_ATTEMPTS) throw new CollectError(`HEAD_MOVED — ${MAX_ATTEMPTS}회 재수집에도 API head(${mr.api_head.slice(0, 7)})와 diff 버전 head(${moved.slice(0, 7)})가 다르다(push 진행 중?)`, 3);
        continue;
      }
      const rb = rebuildDiffOnly(project.id, mr, work);
      snapshot = { mode: 'diff-only', target_sha: rb.target, base_sha: rb.base, head_sha: rb.head, checkout: isGitDir(project.checkout) ? project.checkout : null, worktree: null, attempts: attempt, unrecovered: rb.unrecovered, rebuilt: rb.rebuilt, diff_list_complete: rb.diffListComplete, api_failures: mr.api_failures, fetched_at: fetchedAt };
    }
    break;
  }
  fs.writeFileSync(path.join(work, 'mr.json'), JSON.stringify(mr, null, 2));
  fs.writeFileSync(path.join(work, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
  return { mr, snapshot };
}

const s7 = (s) => (s ? String(s).slice(0, 7) : '-');

export async function cmdCollect(args, ctx) {
  if (!args.project || !args.iid) throw new CollectError('--project <이름> --iid <n> 이 필요하다');
  const { snapshot } = collect({ adapter: ctx.adapter, projectName: args.project, iid: args.iid, work: ctx.work, diffOnly: args['diff-only'] === true });
  return `COLLECTED ${snapshot.mode} head=${s7(snapshot.head_sha)} base=${s7(snapshot.base_sha)} target=${s7(snapshot.target_sha)} attempts=${snapshot.attempts} unrecovered=${snapshot.unrecovered.length}`;
}
````

### 4. CLI 등록

`dev-workflow/skills/mr-review/scripts/mr-review.mjs`를 두 곳 고친다.

(a) import 줄 아래에 추가:

```js
import { cmdCollect } from './lib/collect.mjs';
```

(b) `COMMANDS`의 `// task-02: collect` 줄을 다음으로 바꾼다:

```js
  collect: cmdCollect,
```

(c) `main`의 catch가 `CollectError.code`(3)를 exit code로 쓰도록, 파일 끝 `.catch` 블록의 `process.exitCode = …` 줄을 다음으로 바꾼다:

```js
  process.exitCode = Number.isInteger(e?.code) && e.code > 0 && e.code < 256 ? e.code : 2;
```

### 5. GREEN 확인 · 커밋

```bash
node --test tests/mr-review/collect.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
node --test tests/mr-review/adapter.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
for f in dev-workflow/skills/mr-review/scripts/mr-review.mjs dev-workflow/skills/mr-review/scripts/lib/*.mjs; do node --check "$f" || echo "CHECK_FAIL $f"; done; echo CHECK_DONE
```

기대: collect 9/9 · adapter 8/8 · `CHECK_DONE`만(CHECK_FAIL 없음).

```bash
git add dev-workflow/skills/mr-review/scripts/lib/gitlab.mjs dev-workflow/skills/mr-review/scripts/lib/collect.mjs dev-workflow/skills/mr-review/scripts/mr-review.mjs tests/mr-review/collect.test.mjs
git commit -m "feat(mr-review): collect — MR 수집·스냅샷 SHA 고정·워크트리·diff-only 양쪽 blob 복원 (spec §5.1-1~3, F6)"
```

## Acceptance Criteria

- `node --test tests/mr-review/collect.test.mjs` → 9/9, adapter 8/8 유지.
- 워크트리 모드에서 `snapshot.json.head_sha === mr.json.api_head`(F6) · HEAD 이동 시 `ERR HEAD_MOVED` exit 3 · 3회 재수집 로그 — diff-only 도 메타 head ≠ diff 버전 head 면 같은 처리(plan R3-2).
- 워크트리 모드의 `mr.json.diffs`는 git `--no-renames` 목록(API overflow 로 빠진 파일도 포함, plan R3-4) · 보조 API(`/changes`·`/closes_issues`·`/versions`·`/approvals`) 실패는 `api_failures`에 남고 `overflow`는 `null`(plan R3-3).
- diff-only에서 잘린 파일이 양쪽 blob으로 재구성되어 `-`·`+` 양쪽 줄이 diff에 있고, 실패 파일은 `unrecovered`에 남는다.
- `glab mr …` 호출 0건(헬퍼 로그의 첫 인자는 전부 `api`).

## Cautions

- **`git fetch origin <target>` 뒤 `origin/<target>`을 읽어라 — `FETCH_HEAD`를 읽지 마라. 이유:** 두 번째 fetch(MR head)가 `FETCH_HEAD`를 덮어쓴다.
- **API head ≠ fetch head 면 1부터 다시 — fetch head 를 믿고 진행하지 마라. 이유:** 그 사이 push가 있었으면 메타·diff·댓글은 옛 head 것이다(R1-F2).
- **diff-only 복원은 반드시 base·head 양쪽 blob. head 만 받으면 복원이 아니다. 이유:** 삭제된 코드가 안 보인다(R2-F2). 실패는 `unrecovered`로 남겨 verdict가 MISSING_EVIDENCE로 받는다.
- **없는 쪽(new_file·deleted_file)은 빈 파일과 비교한다(`/dev/null` 금지). 이유:** Windows Git Bash 경로 호환.
- **`overflow`면 파일 항목 자체가 빠질 수 있다 — `changes_count`와 수신 항목 수를 대조해 `diff_list_complete`를 적고, 못 맞추면 `false`. 이유:** R2-2 — 파일별 복원이 전부 성공해도 목록이 잘렸으면 검토 범위·배포 목록이 함께 줄어 모델 발견 없이 `APPROVE`가 난다. verdict가 `M-diff-list`로 받는다.
- **워크트리는 `work/worktree` 고정 경로, 기존 잔존물은 먼저 제거. 이유:** spec §5.1-2 「같은 이름 잔존물은 먼저 제거」 — 이전 실행의 잔재가 섞이면 F6·F7.
- **`notes`의 `system: true`를 버리지 마라. 이유:** `changed the description` 시각이 check의 「낡음」 판정 입력이다(R3-F3).
- **diff-only 에서 `versions[0].head_commit_sha`·`diff_refs.head_sha`가 `api_head`와 다르면 재수집(3회 뒤 `HEAD_MOVED`) — 그냥 `versions[0].base_commit_sha`를 쓰지 마라. 이유:** plan R3-2 — 메타와 diff 사이에 push 가 있으면 새 head 의 diff·base 를 옛 head 의 raw 와 섞어 다른 커밋의 변경을 검토하고 이전 SHA 로 판정한다.
- **보조 API 실패를 `overflow=false`·빈 목록으로 바꾸지 마라 — `api_failures`에 이름을 남기고 `overflow`는 `null`. 이유:** plan R3-3 — `/changes` 실패가 「완전한 목록」으로, `/closes_issues` 실패가 「연결 이슈 없음」으로 둔갑해 R2-2 의 보호가 우회되고 verdict 가 증거 부족을 모른다.
- **워크트리를 고정했으면 `mr.diffs`를 git 목록으로 교체하라 — API 목록을 그대로 두지 마라. 이유:** plan R3-4 — check 의 기준선 후보 탐색·pack 의 문서 지도가 API 목록을 소비하므로 overflow 로 후보 spec 파일이 빠지면 워크트리에 문서가 있어도 「기준선 없음」 조기 종료가 난다.
- (review-loop impl R1, 2026-10-22) diff-only 복원 경로는 `insideRoot` 로 검증한다 — 절대 경로·드라이브·역슬래시·NUL·`..` 성분 거부 + 해소 목적지가 복원 루트 안인지 재확인, 밖이면 원문 조회 없이 unrecovered(SDD 이월 T02 + R1-3, 사용자 판정).
