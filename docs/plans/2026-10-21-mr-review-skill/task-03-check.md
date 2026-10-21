# task-03 — 작성 규칙 검사표 · 댓글 신뢰 · 기준선 원문 수집 (check) (spec §5.1-4·5 · §5.2 · §5.6 · SC-3 `check.json`)

**목적**: `mr.json`·`snapshot.json`만으로 §5.2 검사표를 결정적으로 만들고(계약 10줄·트랙·Baseline 유형·변경 사유·기준선 후보·첨부·배포본 필요·리베이스), 댓글에서 **신뢰 조건을 통과한** 이전 판정·작성자 토큰·기준선 확인(낡음 포함)을 뽑고, Baseline 링크·연결 이슈의 **원문을 출처·버전과 함께** `baseline/<n>.md`로 받아 둔다. 조기 종료 여부와 초안 판정도 여기서 계산한다.

## Files

- Create: `dev-workflow/skills/mr-review/scripts/lib/check.mjs`
- Modify: `dev-workflow/skills/mr-review/scripts/mr-review.mjs` (`check` 등록)
- Test: `tests/mr-review/check.test.mjs`

## Prep

- spec §5.1-4(댓글 신뢰 — reviewers 필드·신뢰 목록·작성자 제외) · §5.1-5(기준선·이슈 원문 — 링크 분해·그 저장소에서 SHA 해소·MR head 대체 금지) · §5.2 표 전체(「낡음」·「위치 미기재」 후보·「첨부 누락」) · 조기 종료 문단(`--full`) · §5.6(재리뷰 진입 조건) · D7·D13.
- 엔트리포인트 **SC-2**(`comments.*` 정규식 — 명명 그룹 · `projects` 키 = basename) · **SC-3** `check.json` 정본(판정값 규칙 포함) · **SC-6**.
- task-01·02 산출물: `lib/adapter.mjs`(`matchesAny`) · `lib/gitlab.mjs`(`apiJson`·`apiRaw`·`encodePath`) · 헬퍼.
- 팀 정책 사실(어댑터가 값으로 준다 — 코드에 고정 금지, P9): 계약 10줄은 `## Review Contract` 아래 `- <이름>: <값>` 불릿 · 자리표시자 = 빈 값·`<…>`·`#` · 판정 댓글 첫 줄 형식·작성자 토큰·기준선 확인 댓글은 어댑터 정규식.

## Deps

02

## Steps

### 1. 테스트 작성 (RED)

`tests/mr-review/check.test.mjs`를 아래 내용 그대로 만든다(`collect`를 돌리지 않고 `mr.json`·`snapshot.json`을 직접 둔다).

````js
// check 계약 테스트 (spec §5.1-4·5 · §5.2 · §5.6 · SC-3 check.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmp, writeAdapter, fakeGlab, runCli, readJson } from './helpers.mjs';

const HEAD = 'a'.repeat(40);
const OLD = 'c'.repeat(40);
const DOCS_SHA = 'd'.repeat(40);

function contract(over = {}) {
  const v = {
    Policy: '`TEST-POLICY-v1.0`', 'Policy source': '`http://gitlab.test/g/docs/-/blob/' + DOCS_SHA + '/guide/policy.md`', 'Review type': '`MR_IMPLEMENTATION`', 'Reviewer role': '`사람 reviewer`',
    Baseline: '`MR 본문 「배경」(경량 — 변경 사유 기록)`', 'Base SHA': 'b'.repeat(40), 'Review head SHA': HEAD,
    'Required acceptance criteria': '위 검증 표', 'Required tests/evidence': '위 검증 표', 'Human reviewer': 'rev-b', ...over,
  };
  return '## Review Contract\n' + Object.entries(v).map(([k, val]) => `- ${k}: ${val}`).join('\n') + '\n\n<details><summary>실행 블록</summary>\n\n```text\n[MR 구현 리뷰]\n```\n\n</details>\n';
}

function body({ track = '경량', background = '- ① 왜: 10-14 민원 — 버튼이 두 번 열린다.\n- ② 무엇을: Android 상위 처리기 → 등록 차단.', deploy = '- 배포본: 비해당', contractOver = {}, extra = '' } = {}) {
  return `## 배경\n- 이슈/spec: #\n- 트랙: ${track}\n${background}\n\n## 변경 요약\n- x\n\n## 배포·롤백\n${deploy}\n${extra}\n${contract(contractOver)}`;
}

function mrJson(over = {}) {
  return {
    project: { name: 'alpha', id: 101, checkout: null, deployExempt: false }, iid: 7, title: 'fix(x): y', description: body(), state: 'opened', updated_at: '2026-10-21T01:00:00Z', web_url: '',
    author: { id: 1, username: 'author-a' }, reviewers: [{ id: 2, username: 'rev-b' }], source_branch: 'feat', target_branch: 'master', api_head: HEAD, diff_refs: null,
    detailed_merge_status: 'mergeable', has_conflicts: false, approved_by: [],
    diffs: [
      { old_path: 'src/main/java/app/A.java', new_path: 'src/main/java/app/A.java', new_file: false, renamed_file: false, deleted_file: false, too_large: false, diff: '' },
      { old_path: 'docs/notes.md', new_path: 'docs/notes.md', new_file: true, renamed_file: false, deleted_file: false, too_large: false, diff: '' },
    ],
    overflow: false, notes: [], description_changed_at: null, closes_issues: [], versions: [{ head_commit_sha: HEAD, base_commit_sha: 'b'.repeat(40), start_commit_sha: 'b'.repeat(40) }], collected_at: '2026-10-21T01:00:00Z',
    ...over,
  };
}

function setup(mrOver = {}, adapterPatch = {}) {
  const root = tmp();
  const adapter = writeAdapter(root, adapterPatch);
  const work = join(root, 'work');
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'mr.json'), JSON.stringify(mrJson(mrOver)));
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify({ mode: 'diff-only', target_sha: 'b'.repeat(40), base_sha: 'b'.repeat(40), head_sha: HEAD, checkout: null, worktree: null, attempts: 1, unrecovered: [], rebuilt: [], fetched_at: '' }));
  return { root, adapter, work };
}

test('계약 10줄 채움(구버전 Policy) · 경량 · MR 본문 배경 · 변경 사유 ①② · 배포 비해당', () => {
  const { root, adapter, work } = setup();
  const g = fakeGlab(root, []);
  const r = runCli(['check', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.first, 'CHECKED complete=true baseline=MR 본문 배경 earlyExit=false rereview=false');
  const c = readJson(join(work, 'check.json'));
  assert.equal(c.contract.found, true);
  assert.equal(c.contract.policyId, 'TEST-POLICY-v1.0');
  assert.equal(c.contract.policyStatus, '채움(구버전)');
  assert.equal(c.contract.complete, true);
  assert.deepEqual(c.contract.incompleteLines, []);
  assert.equal(c.track, '경량');
  assert.equal(c.baselineType, 'MR 본문 배경');
  assert.equal(c.reason.why, true);
  assert.equal(c.reason.what, true);
  assert.equal(c.reason.source, 'body');
  assert.equal(c.baselineLinks.length, 1);
  assert.equal(c.baselineLinks[0].kind, 'body');
  assert.equal(c.baselineLinks[0].status, '확보');
  assert.ok(existsSync(join(work, c.baselineLinks[0].file)));
  assert.equal(c.deployRequired, true);                 // src/main/** 변경 있음
  assert.equal(c.deployNote, '비해당');
  assert.equal(c.baselineConfirm.status, '없음');
  assert.equal(c.reviewerMismatch, false);
  assert.equal(c.rebase.need, false);
  assert.deepEqual(c.baselineCandidateFiles, []);        // docs/notes.md 는 후보 패턴 밖
  assert.equal(c.earlyExit.would, false);
});

test('자리표시자·줄 없음 → 미완 · 기준선 없음 + 후보 없음 → 조기 종료 RETURN_TO_DESIGN', () => {
  const desc = body({ contractOver: { Baseline: '`<issue/spec/승인 결정 링크>`', 'Base SHA': '', 'Human reviewer': '' } }).replace('- Required tests/evidence: 위 검증 표\n', '');
  const { root, adapter, work } = setup({ description: desc });
  const r = runCli(['check', '--adapter', adapter, '--work', work], fakeGlab(root, []).env);
  assert.equal(r.code, 0, r.out);
  const c = readJson(join(work, 'check.json'));
  assert.equal(c.contract.complete, false);
  assert.deepEqual(c.contract.incompleteLines, ['Baseline', 'Base SHA', 'Required tests/evidence', 'Human reviewer']);
  assert.equal(c.contract.lines.find((l) => l.name === 'Required tests/evidence').status, '없음');
  assert.equal(c.contract.lines.find((l) => l.name === 'Baseline').status, '자리표시자');
  assert.equal(c.baselineType, '빈칸·자리표시자');
  assert.equal(c.earlyExit.would, true);
  assert.equal(c.earlyExit.draftVerdict, 'RETURN_TO_DESIGN');
});

test('기준선 후보 문서가 diff 에 있으면 조기 종료하지 않고 후보로 남긴다 · 계약만 미완이면 HOLD_EVIDENCE', () => {
  const desc = body({ contractOver: { Baseline: '`<issue/spec/승인 결정 링크>`' } });
  const diffs = [{ old_path: 'docs/specs/2026-10-01-feature.md', new_path: 'docs/specs/2026-10-01-feature.md', new_file: true, renamed_file: false, deleted_file: false, too_large: false, diff: '' }];
  const { root, adapter, work } = setup({ description: desc, diffs });
  runCli(['check', '--adapter', adapter, '--work', work], fakeGlab(root, []).env);
  const c = readJson(join(work, 'check.json'));
  assert.deepEqual(c.baselineCandidateFiles, ['docs/specs/2026-10-01-feature.md']);
  assert.equal(c.earlyExit.would, true);                 // Baseline 줄이 자리표시자 → 계약 미완
  assert.equal(c.earlyExit.draftVerdict, 'HOLD_EVIDENCE'); // 후보가 있어 기준선 없음은 아님
  assert.equal(c.deployRequired, false);
});

test('문서 링크(브랜치 ref) → 그 저장소의 브랜치 API 로 SHA 해소 · raw 원문 확보 · 고정 아님', () => {
  const link = 'http://gitlab.test/g/docs/-/blob/master/guide/policy.md';
  const desc = body({ track: '정식', contractOver: { Baseline: '`' + link + '`' } });
  const { root, adapter, work } = setup({ description: desc });
  const enc = encodeURIComponent('guide/policy.md').replace(/\./g, '%2E');
  const g = fakeGlab(root, [
    { match: '^api projects/103/repository/branches/master$', json: { name: 'master', commit: { id: DOCS_SHA } } },
    { match: `^api projects/103/repository/files/${enc}/raw\\?ref=${DOCS_SHA}$`, text: '# 정책 원문\n' },
  ]);
  const r = runCli(['check', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  const c = readJson(join(work, 'check.json'));
  assert.equal(c.track, '정식');
  assert.equal(c.baselineType, '문서 링크');
  assert.equal(c.baselineConfirm.status, '해당 없음');
  const l = c.baselineLinks.find((x) => x.kind === 'repo');
  assert.equal(l.project, 'docs');
  assert.equal(l.ref, 'master');
  assert.equal(l.path, 'guide/policy.md');
  assert.equal(l.resolved_sha, DOCS_SHA);
  assert.equal(l.pinned, false);
  assert.equal(l.status, '확보');
  assert.equal(l.version, DOCS_SHA);
  const txt = readFileSync(join(work, l.file), 'utf8');
  assert.match(txt, /^<!-- mr-review source: docs:guide\/policy\.md@d{40} ref=master pinned=false -->/);
  assert.match(txt, /# 정책 원문/);
});

test('permalink(40자 SHA) 는 그대로 고정 · 어댑터에 없는 프로젝트 링크는 미확보', () => {
  const link = 'http://gitlab.test/g/docs/-/blob/' + DOCS_SHA + '/guide/policy.md';
  const other = 'http://gitlab.test/other/zeta/-/blob/main/x.md';
  const desc = body({ track: '정식', contractOver: { Baseline: link + ' · ' + other } });
  const { root, adapter, work } = setup({ description: desc });
  const enc = encodeURIComponent('guide/policy.md').replace(/\./g, '%2E');
  const g = fakeGlab(root, [{ match: `^api projects/103/repository/files/${enc}/raw\\?ref=${DOCS_SHA}$`, text: 'x' }]);
  runCli(['check', '--adapter', adapter, '--work', work], g.env);
  const c = readJson(join(work, 'check.json'));
  const a = c.baselineLinks.find((x) => x.path === 'guide/policy.md');
  assert.equal(a.pinned, true);
  assert.equal(a.resolved_sha, DOCS_SHA);
  const z = c.baselineLinks.find((x) => x.path === 'x.md');
  assert.equal(z.status, '미확보');
  assert.match(z.reason, /어댑터/);
  assert.equal(g.calls().some((x) => x.join(' ').includes('branches')), false);
});

test('이슈 기준선(#n) 과 closes_issues 원문 수집 · 변경 사유는 이슈에서', () => {
  const desc = body({ background: '', contractOver: { Baseline: '#12' } });
  const { root, adapter, work } = setup({ description: desc, closes_issues: [{ iid: 12, project_id: 101, title: '버그', description: '', updated_at: '2026-10-19T00:00:00Z', web_url: '' }] });
  const g = fakeGlab(root, [
    { match: '^api projects/101/issues/12$', json: { iid: 12, title: '버그', description: '- ① 왜: 민원\n- ② 무엇을: 처리기', updated_at: '2026-10-19T00:00:00Z' } },
    { match: '^api --paginate projects/101/issues/12/notes', json: [{ id: 5, system: false, author: { username: 'author-a' }, body: '추가 설명', created_at: '2026-10-19T01:00:00Z' }] },
  ]);
  runCli(['check', '--adapter', adapter, '--work', work], g.env);
  const c = readJson(join(work, 'check.json'));
  assert.equal(c.baselineType, '이슈');
  const i = c.baselineLinks.find((x) => x.kind === 'issue');
  assert.equal(i.status, '확보');
  assert.equal(i.version, '2026-10-19T00:00:00Z');
  assert.match(readFileSync(join(work, i.file), 'utf8'), /추가 설명/);
  assert.equal(c.baselineLinks.filter((x) => x.kind === 'issue').length, 1);   // #12 와 closes_issues 12 는 하나로
  assert.equal(c.reason.source, 'issue');
  assert.equal(c.reason.why, true);
  assert.equal(c.reason.what, true);
});

test('댓글: 신뢰 이전 판정(옛 head) → 재리뷰 · 작성자의 판정 댓글은 무시 · 작성자 토큰 · 기준선 확인 낡음', () => {
  const notes = [
    { id: 10, system: false, author: { id: 2, username: 'rev-b' }, created_at: '2026-10-19T00:00:00Z', body: '기준선 확인 — 배경 ①② 동의' },
    { id: 11, system: true, author: { id: 1, username: 'author-a' }, created_at: '2026-10-19T02:00:00Z', body: 'changed the description' },
    { id: 12, system: false, author: { id: 2, username: 'rev-b' }, created_at: '2026-10-20T00:00:00Z', body: `리뷰 계약 TEST-POLICY-v1.0 · head ${OLD} · 사람 판정 CHANGES_REQUESTED\n\n4. 차단 발견\n- DEFECT x` },
    { id: 13, system: false, author: { id: 1, username: 'author-a' }, created_at: '2026-10-20T01:00:00Z', body: `리뷰 계약 TEST-POLICY-v1.0 · head ${HEAD} · 사람 판정 APPROVE` },
    { id: 14, system: false, author: { id: 1, username: 'author-a' }, created_at: '2026-10-20T02:00:00Z', body: `FIXED ${HEAD}\n설명\nREFUTED` },
    { id: 15, system: false, author: { id: 9, username: 'someone' }, created_at: '2026-10-20T03:00:00Z', body: 'FIXED abc1234' },
    { id: 16, system: false, author: { id: 3, username: 'lead-reviewer' }, created_at: '2026-10-20T04:00:00Z', body: `리뷰 계약 TEST-POLICY-v1.1 · head ${OLD} · 추천 판정(초안) APPROVE` },
  ];
  // acceptedIds 를 v1.0 만으로 좁혀 note 16(v1.1) 이 「형식은 맞지만 허용되지 않은 정책 ID」가 되게 한다
  const { root, adapter, work } = setup({ notes, description_changed_at: '2026-10-19T02:00:00Z' }, { policy: { judgeId: 'TEST-POLICY-v1.1', acceptedIds: ['TEST-POLICY-v1.0'], docs: ['guide/policy.md#5.'] } });
  const r = runCli(['check', '--adapter', adapter, '--work', work], fakeGlab(root, []).env);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, /rereview=true$/);
  const c = readJson(join(work, 'check.json'));
  assert.equal(c.baselineConfirm.status, '낡음');
  assert.equal(c.baselineConfirm.note_id, 10);
  assert.equal(c.baselineConfirm.changed_at, '2026-10-19T02:00:00Z');
  const trusted = c.priorVerdicts.filter((v) => v.trusted);
  assert.deepEqual(trusted.map((v) => v.note_id), [12]);
  assert.equal(trusted[0].verdict, 'CHANGES_REQUESTED');
  assert.equal(trusted[0].sha, OLD);
  assert.equal(c.priorVerdicts.find((v) => v.note_id === 13).trusted, false);
  assert.match(c.priorVerdicts.find((v) => v.note_id === 16).reason, /정책 ID/);
  assert.ok(c.ignoredComments.some((x) => x.note_id === 13 && /작성자/.test(x.reason)));
  assert.ok(c.ignoredComments.some((x) => x.note_id === 15));
  assert.deepEqual(c.authorTokens.map((t) => [t.note_id, t.token, t.arg]), [[14, 'FIXED', HEAD], [14, 'REFUTED', null]]);
  assert.equal(c.rereview.active, true);
  assert.equal(c.rereview.prior_head, OLD);
  assert.equal(c.rereview.prior_verdict, 'CHANGES_REQUESTED');
  assert.equal(c.rereview.prior_note_id, 12);
});

test('신뢰 판정의 head 가 현재 head 면 재리뷰 아님 · 기준선 확인 있음(본문 변경 없음)', () => {
  const notes = [
    { id: 10, system: false, author: { id: 3, username: 'lead-reviewer' }, created_at: '2026-10-19T00:00:00Z', body: '기준선 확인' },
    { id: 12, system: false, author: { id: 2, username: 'rev-b' }, created_at: '2026-10-20T00:00:00Z', body: `리뷰 계약 TEST-POLICY-v1.1 · head ${HEAD.slice(0, 12)} · 추천 판정(초안) APPROVE` },
  ];
  const { root, adapter, work } = setup({ notes });
  runCli(['check', '--adapter', adapter, '--work', work], fakeGlab(root, []).env);
  const c = readJson(join(work, 'check.json'));
  assert.equal(c.baselineConfirm.status, '있음');
  assert.equal(c.rereview.active, false);
  assert.equal(c.priorVerdicts[0].trusted, true);
});

test('첨부 분류 · 첨부 누락 · 리베이스 · reviewer 불일치 · 트랙 미기재', () => {
  const desc = body({ track: '경량 / 정식 / 핫픽스', deploy: '- 배포본: zip 첨부했음', extra: '[spec](/uploads/' + '1'.repeat(32) + '/design.md)', contractOver: { 'Human reviewer': 'someone-else' } });
  const notes = [{ id: 20, system: false, author: { id: 1, username: 'author-a' }, created_at: '2026-10-20T00:00:00Z', body: '로그 [log](/uploads/' + '2'.repeat(32) + '/app.log)' }];
  const { root, adapter, work } = setup({ description: desc, notes, detailed_merge_status: 'need_rebase' });
  runCli(['check', '--adapter', adapter, '--work', work], fakeGlab(root, []).env);
  const c = readJson(join(work, 'check.json'));
  assert.equal(c.track, '미기재');
  assert.deepEqual(c.attachments.map((a) => [a.kind, a.filename, a.where]), [['doc', 'design.md', 'body'], ['log', 'app.log', 'note']]);
  assert.equal(c.attachmentClaimedButMissing, true);
  assert.equal(c.rebase.need, true);
  assert.equal(c.reviewerMismatch, true);
  assert.equal(c.baselineConfirm.status, '해당 없음');
});
````

실행:

```bash
node --test tests/mr-review/check.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: tests 9 · pass 0 · fail 9.

### 2. `check.mjs`

`dev-workflow/skills/mr-review/scripts/lib/check.mjs`를 아래 내용 그대로 만든다.

````js
// check.mjs — spec §5.2 검사표(모델 없이) + §5.1-4 댓글 신뢰 + §5.1-5 기준선·이슈 원문 수집 + §5.6 재리뷰 진입. 입력 = mr.json·snapshot.json.
import fs from 'node:fs';
import path from 'node:path';
import { apiJson, apiRaw, encodePath } from './gitlab.mjs';
import { matchesAny } from './adapter.mjs';

export class CheckError extends Error {}

const FILLED = new Set(['채움', '채움(구버전)']);

// ── 본문 분해 ─────────────────────────────────────────────────────────────
export function section(markdown, titleRe) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => { const m = l.match(/^##\s+(.*)$/); return m && titleRe.test(m[1].trim()); });
  if (start < 0) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) { if (/^##\s/.test(lines[i])) break; out.push(lines[i]); }
  return out.join('\n').trim();
}

const stripCode = (v) => v.replace(/`/g, '').trim();
export function isPlaceholder(v) {
  const s = stripCode(v);
  return s === '' || s === '#' || /^<[^>]*>$/.test(s) || /^(없음|TBD|TODO)$/i.test(s);
}

// §5.2 「Review Contract 10줄」
export function parseContract(description, adapter) {
  const names = adapter.contract.lines;
  const lines = description.split('\n');
  const idx = lines.findIndex((l) => /^##\s+Review Contract\s*$/.test(l.trim()));
  const map = new Map();
  if (idx >= 0) {
    for (let i = idx + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^#{1,6}\s/.test(l) || /^\s*(<details|```)/.test(l)) break;   // 실행 블록(<details>·펜스) 안의 불릿은 계약 줄이 아니다
      const m = l.match(/^\s*[-*]\s*([^:]+?)\s*:\s*(.*)$/);
      if (m) map.set(m[1].trim(), m[2]);
    }
  }
  const rows = names.map((name) => {
    if (!map.has(name)) return { name, status: '없음', value: '' };
    const value = stripCode(map.get(name));
    if (isPlaceholder(value)) return { name, status: '자리표시자', value };
    if (name === 'Policy') {
      if (!adapter.policy.acceptedIds.includes(value)) return { name, status: '자리표시자', value };
      return { name, status: value === adapter.policy.judgeId ? '채움' : '채움(구버전)', value };
    }
    return { name, status: '채움', value };
  });
  const policy = rows.find((r) => r.name === 'Policy');
  const incomplete = rows.filter((r) => !FILLED.has(r.status)).map((r) => r.name);
  return { found: idx >= 0, policyId: policy && FILLED.has(policy.status) ? policy.value : null, policyStatus: policy ? policy.status : '없음', lines: rows, complete: incomplete.length === 0, incompleteLines: incomplete };
}

export function parseTrack(description) {
  const m = description.match(/트랙\s*[:：]\s*([^\n]+)/);
  if (!m) return '미기재';
  const tokens = m[1].split('/').map((t) => t.trim()).filter(Boolean);
  if (tokens.length !== 1) return '미기재';
  for (const k of ['경량', '정식', '핫픽스']) if (tokens[0].startsWith(k)) return k;
  return '미기재';
}

// 배경 절에서 양식 줄(이슈/spec·트랙)을 뺀 변경 사유 본문
export function reasonText(description) {
  const bg = section(description, /^배경/) || '';
  const kept = bg.split('\n').filter((l) => !/^\s*[-*]\s*(이슈\/spec|이슈|spec|트랙)\s*[:：]/.test(l) && l.trim() !== '');
  return kept.join('\n').trim();
}
export function judgeReason(text) {
  if (!text) return { why: false, what: false };
  const hasWhy = /①|왜\s*[:：]/.test(text);
  const hasWhat = /②|무엇을\s*[:：]/.test(text);
  if (hasWhy || hasWhat) return { why: hasWhy, what: hasWhat };
  const n = text.split('\n').filter((l) => l.trim()).length;
  return { why: n >= 1, what: n >= 2 };
}

// ── 링크 분해 ─────────────────────────────────────────────────────────────
const BLOB_RE = /https?:\/\/[^\s)<>`]+?\/([^\s/)<>`]+)\/-\/blob\/([^/\s)<>`]+)\/([^\s)<>`#]+)/g;
const ISSUE_URL_RE = /https?:\/\/[^\s)<>`]+?\/([^\s/)<>`]+)\/-\/issues\/(\d+)/g;
const ISSUE_REF_RE = /(?:^|[\s(`])#(\d+)\b/g;
const SHA_RE = /^[0-9a-f]{7,40}$/;

export function parseBaselineValue(value, currentProject) {
  const links = [];
  for (const m of value.matchAll(BLOB_RE)) links.push({ raw: m[0], kind: 'repo', project: m[1], ref: m[2], path: m[3] });
  for (const m of value.matchAll(ISSUE_URL_RE)) links.push({ raw: m[0], kind: 'issue', project: m[1], ref: m[2], path: '' });
  for (const m of value.matchAll(ISSUE_REF_RE)) links.push({ raw: `#${m[1]}`, kind: 'issue', project: currentProject, ref: m[1], path: '' });
  const isBody = /배경|MR 본문/.test(value);
  let type;
  if (links.some((l) => l.kind === 'repo')) type = '문서 링크';
  else if (links.some((l) => l.kind === 'issue')) type = '이슈';
  else if (isBody) type = 'MR 본문 배경';
  else if (isPlaceholder(value)) type = '빈칸·자리표시자';
  else type = '서술만';
  if (isBody) links.push({ raw: value, kind: 'body', project: currentProject, ref: '', path: '' });
  return { type, links };
}

// §5.1-5 — 저장소 링크는 호스트·프로젝트·ref·경로로 분해, 그 프로젝트에서 ref→SHA 해소, raw 원문. MR head 로 대체하지 않는다.
function resolveRepoLink(link, adapter, work, n) {
  const proj = adapter.resolved.projects[link.project];
  if (!proj) return { ...link, resolved_sha: null, pinned: false, status: '미확보', reason: `어댑터 projects 에 없는 프로젝트: ${link.project}`, file: null, version: null };
  let sha = null;
  let pinned = false;
  try {
    if (SHA_RE.test(link.ref)) {
      pinned = true;
      sha = link.ref.length === 40 ? link.ref : apiJson(`projects/${proj.id}/repository/commits/${link.ref}`).id;
    } else {
      try { sha = apiJson(`projects/${proj.id}/repository/branches/${encodeURIComponent(link.ref)}`).commit.id; }
      catch { sha = apiJson(`projects/${proj.id}/repository/tags/${encodeURIComponent(link.ref)}`).commit.id; }
    }
    const raw = apiRaw(`projects/${proj.id}/repository/files/${encodePath(link.path)}/raw?ref=${sha}`).toString('utf8');
    const file = `baseline/${n}.md`;
    fs.mkdirSync(path.join(work, 'baseline'), { recursive: true });
    fs.writeFileSync(path.join(work, file), `<!-- mr-review source: ${link.project}:${link.path}@${sha} ref=${link.ref} pinned=${pinned} -->\n${raw}`);
    return { ...link, resolved_sha: sha, pinned, status: '확보', reason: '', file, version: sha };
  } catch (e) {
    return { ...link, resolved_sha: sha, pinned, status: '미확보', reason: `원문 확보 실패: ${e.message.slice(0, 160)}`, file: null, version: null };
  }
}

function resolveIssue(link, adapter, work, n) {
  const proj = adapter.resolved.projects[link.project];
  if (!proj) return { ...link, resolved_sha: null, pinned: true, status: '미확보', reason: `어댑터 projects 에 없는 프로젝트: ${link.project}`, file: null, version: null, text: '' };
  try {
    const issue = apiJson(`projects/${proj.id}/issues/${link.ref}`);
    let notes = [];
    try { notes = apiJson(`projects/${proj.id}/issues/${link.ref}/notes?per_page=100&sort=asc&order_by=created_at`, { paginate: true }); } catch { notes = []; }
    const body = `${issue.description || ''}\n\n## 이슈 댓글\n${(Array.isArray(notes) ? notes : []).filter((x) => !x.system).map((x) => `- (${x.author?.username || '?'} ${x.created_at}) ${x.body}`).join('\n')}`;
    const file = `baseline/${n}.md`;
    fs.mkdirSync(path.join(work, 'baseline'), { recursive: true });
    fs.writeFileSync(path.join(work, file), `<!-- mr-review source: ${link.project}:issue#${link.ref} updated_at=${issue.updated_at} -->\n# ${issue.title || ''}\n\n${body}`);
    return { ...link, resolved_sha: null, pinned: true, status: '확보', reason: '', file, version: issue.updated_at || null, text: issue.description || '' };
  } catch (e) {
    return { ...link, resolved_sha: null, pinned: true, status: '미확보', reason: `이슈 원문 확보 실패: ${e.message.slice(0, 160)}`, file: null, version: null, text: '' };
  }
}

function resolveBody(link, mr, headSha, work, n) {
  const bg = section(mr.description, /^배경/) || '';
  const file = `baseline/${n}.md`;
  fs.mkdirSync(path.join(work, 'baseline'), { recursive: true });
  fs.writeFileSync(path.join(work, file), `<!-- mr-review source: ${mr.project.name}:MR!${mr.iid} 본문 「배경」 head=${headSha} -->\n${bg}`);
  return { ...link, resolved_sha: headSha, pinned: true, status: bg ? '확보' : '미확보', reason: bg ? '' : 'MR 본문에 「배경」 절이 없다', file, version: headSha };
}

// ── 첨부 ──────────────────────────────────────────────────────────────────
const UPLOAD_RE = /\[([^\]]*)\]\((\/uploads\/([0-9a-f]{32})\/([^)\s]+))\)/g;
function attachmentKind(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'zip') return 'zip';
  if (['md', 'hwpx', 'hwp', 'docx', 'pdf', 'xlsx', 'pptx'].includes(ext)) return 'doc';
  if (['log', 'txt'].includes(ext)) return 'log';
  return 'other';
}
export function parseAttachments(mr) {
  const out = [];
  const scan = (text, where) => { for (const m of text.matchAll(UPLOAD_RE)) out.push({ url: m[2], kind: attachmentKind(m[4]), filename: m[4], secret: m[3], where }); };
  scan(mr.description, 'body');
  for (const n of mr.notes) if (!n.system) scan(n.body, 'note');
  return out;
}

export function deployNote(description) {
  const m = description.match(/배포본\s*[:：]\s*([^\n]+)/);
  if (m) return stripCode(m[1]);
  const sec = section(description, /^배포본/);
  if (sec) return sec.split('\n').find((l) => l.trim())?.trim() || null;
  return null;
}

// ── 댓글 신뢰(§5.1-4) ─────────────────────────────────────────────────────
export function classifyNotes(mr, adapter, headSha) {
  const verdictRe = new RegExp(adapter.comments.verdictFirstLine);
  const tokenRe = new RegExp(adapter.comments.authorToken);
  const confirmRe = new RegExp(adapter.comments.baselineConfirm);
  const reviewers = new Set([...mr.reviewers.map((r) => r.username), ...adapter.comments.trustedReviewers]);
  const author = mr.author.username;
  const priorVerdicts = [];
  const authorTokens = [];
  const ignored = [];
  const confirms = [];
  for (const n of mr.notes) {
    if (n.system) continue;
    const first = (n.body.split('\n')[0] || '').trim();
    const who = n.author.username;
    const vm = first.match(verdictRe);
    if (vm) {
      let trusted = true;
      let reason = '';
      if (who === author) { trusted = false; reason = 'MR 작성자의 판정 댓글은 인정하지 않는다'; }
      else if (!reviewers.has(who)) { trusted = false; reason = 'GitLab reviewers 필드·신뢰 리뷰어 목록에 없는 작성자'; }
      else if (!adapter.policy.acceptedIds.includes(vm.groups.policy)) { trusted = false; reason = `허용되지 않은 정책 ID: ${vm.groups.policy}`; }
      priorVerdicts.push({ note_id: n.id, author: who, created_at: n.created_at, policy: vm.groups.policy, sha: vm.groups.sha, kind: vm.groups.kind, verdict: vm.groups.verdict, trusted, reason });
      if (!trusted) ignored.push({ note_id: n.id, author: who, reason });
      continue;
    }
    if (confirmRe.test(first)) {
      if (reviewers.has(who) && who !== author) confirms.push(n);
      else ignored.push({ note_id: n.id, author: who, reason: '기준선 확인 댓글이지만 지정 리뷰어·신뢰 리뷰어가 아니다' });
      continue;
    }
    const tokenLines = n.body.split('\n').map((l) => l.trim().match(tokenRe)).filter(Boolean);
    if (tokenLines.length) {
      if (who === author) for (const t of tokenLines) authorTokens.push({ note_id: n.id, token: t.groups.token, arg: t.groups.arg || null, created_at: n.created_at });
      else ignored.push({ note_id: n.id, author: who, reason: '작성자 응답 토큰이지만 MR 작성자가 아니다' });
    }
  }
  const trusted = priorVerdicts.filter((v) => v.trusted).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latest = trusted[trusted.length - 1] || null;
  const sameHead = latest ? headSha.startsWith(latest.sha) : false;
  const rereview = { active: !!latest && !sameHead, prior_head: latest ? latest.sha : null, prior_verdict: latest ? latest.verdict : null, prior_note_id: latest ? latest.note_id : null };
  return { priorVerdicts, authorTokens, ignoredComments: ignored, confirms, rereview };
}

export function judgeBaselineConfirm(track, confirms, descriptionChangedAt) {
  if (track !== '경량') return { status: '해당 없음', note_id: null, note_at: null, changed_at: descriptionChangedAt || null };
  if (!confirms.length) return { status: '없음', note_id: null, note_at: null, changed_at: descriptionChangedAt || null };
  const latest = [...confirms].sort((a, b) => a.created_at.localeCompare(b.created_at)).pop();
  const stale = !!descriptionChangedAt && latest.created_at < descriptionChangedAt;
  return { status: stale ? '낡음' : '있음', note_id: latest.id, note_at: latest.created_at, changed_at: descriptionChangedAt || null };
}

// ── 본체 ──────────────────────────────────────────────────────────────────
export function check({ adapter, work }) {
  const mr = JSON.parse(fs.readFileSync(path.join(work, 'mr.json'), 'utf8'));
  const snap = JSON.parse(fs.readFileSync(path.join(work, 'snapshot.json'), 'utf8'));
  const headSha = snap.head_sha;
  const desc = mr.description || '';

  const contract = parseContract(desc, adapter);
  const track = parseTrack(desc);
  const baselineRow = contract.lines.find((l) => l.name === 'Baseline');
  let baselineType;
  let links = [];
  if (!baselineRow || baselineRow.status === '없음') baselineType = '칸 없음';
  else if (baselineRow.status === '자리표시자') baselineType = '빈칸·자리표시자';
  else { const p = parseBaselineValue(baselineRow.value, mr.project.name); baselineType = p.type; links = p.links; }

  // 연결 이슈(closes_issues)도 원문 수집 대상 — Baseline 의 #n 과 중복이면 하나로
  for (const ci of mr.closes_issues || []) {
    const projName = Object.entries(adapter.resolved.projects).find(([, p]) => p.id === ci.project_id)?.[0] || mr.project.name;
    if (!links.some((l) => l.kind === 'issue' && l.project === projName && String(l.ref) === String(ci.iid))) links.push({ raw: `closes #${ci.iid}`, kind: 'issue', project: projName, ref: String(ci.iid), path: '' });
  }
  const baselineLinks = [];
  let n = 0;
  let issueText = '';
  for (const l of links) {
    n += 1;
    let r;
    if (l.kind === 'repo') r = resolveRepoLink(l, adapter, work, n);
    else if (l.kind === 'issue') { r = resolveIssue(l, adapter, work, n); if (r.text && !issueText) issueText = r.text; delete r.text; }
    else r = resolveBody(l, mr, headSha, work, n);
    baselineLinks.push(r);
  }

  const bodyReason = reasonText(desc);
  const reasonSrc = bodyReason ? 'body' : issueText ? 'issue' : 'none';
  const reasonJ = judgeReason(reasonSrc === 'body' ? bodyReason : reasonSrc === 'issue' ? issueText : '');
  const reason = { why: reasonJ.why, what: reasonJ.what, source: reasonSrc, text: (reasonSrc === 'body' ? bodyReason : issueText).slice(0, 2000) };

  const baselineCandidateFiles = mr.diffs.filter((d) => !d.deleted_file).map((d) => d.new_path).filter((p) => matchesAny(p, adapter.baselineCandidates));
  const attachments = parseAttachments(mr);
  const dNote = deployNote(desc);
  const deployExempt = mr.project.deployExempt === true;
  const inDeploy = (p) => matchesAny(p, adapter.deploy.targets) && !matchesAny(p, adapter.deploy.excludes);
  const deployRequired = !deployExempt && mr.diffs.some((d) => inDeploy(d.deleted_file ? d.old_path : d.new_path));
  const deploySec = section(desc, /^배포/) || '';
  const claimed = /\.zip|첨부/.test((dNote || '') + '\n' + deploySec) && !attachments.some((a) => a.kind === 'zip');
  const rebase = { need: mr.detailed_merge_status === 'need_rebase' || mr.has_conflicts === true, detailed_merge_status: mr.detailed_merge_status || '' };
  const hr = contract.lines.find((l) => l.name === 'Human reviewer');
  const hrVal = hr && FILLED.has(hr.status) ? hr.value.replace(/^@/, '') : null;
  const reviewerMismatch = !!hrVal && !mr.reviewers.some((r) => r.username === hrVal);

  const notesC = classifyNotes(mr, adapter, headSha);
  const baselineConfirm = judgeBaselineConfirm(track, notesC.confirms, mr.description_changed_at);

  const baselineMissing = (baselineType === '빈칸·자리표시자' || baselineType === '칸 없음') && baselineCandidateFiles.length === 0;
  const would = !contract.complete || baselineMissing;
  const earlyExit = { would, reason: would ? (baselineMissing ? '기준선 없음(후보 문서도 없음)' : `계약 미완: ${contract.incompleteLines.join(', ')}`) : '', draftVerdict: would ? (baselineMissing ? 'RETURN_TO_DESIGN' : 'HOLD_EVIDENCE') : null };

  const out = { contract, track, baselineType, baselineLinks, reason, baselineCandidateFiles, baselineConfirm, attachments, attachmentClaimedButMissing: claimed, deployRequired, deployExempt, deployNote: dNote, rebase, reviewerMismatch, priorVerdicts: notesC.priorVerdicts, authorTokens: notesC.authorTokens, ignoredComments: notesC.ignoredComments, rereview: notesC.rereview, earlyExit };
  fs.writeFileSync(path.join(work, 'check.json'), JSON.stringify(out, null, 2));
  return out;
}

export async function cmdCheck(args, ctx) {
  const c = check({ adapter: ctx.adapter, work: ctx.work });
  return `CHECKED complete=${c.contract.complete} baseline=${c.baselineType} earlyExit=${c.earlyExit.would} rereview=${c.rereview.active}`;
}
````

### 3. CLI 등록

`mr-review.mjs`에 import 추가 · `COMMANDS`의 `// task-03: check` 줄을 바꾼다:

```js
import { cmdCheck } from './lib/check.mjs';
```
```js
  check: cmdCheck,
```

### 4. GREEN 확인 · 커밋

```bash
node --test tests/mr-review/check.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
node --check dev-workflow/skills/mr-review/scripts/lib/check.mjs && echo CHECK_OK
```

기대: check 9/9 · 앞선 14/14 · `CHECK_OK`.

```bash
git add dev-workflow/skills/mr-review/scripts/lib/check.mjs dev-workflow/skills/mr-review/scripts/mr-review.mjs tests/mr-review/check.test.mjs
git commit -m "feat(mr-review): check — 작성 규칙 검사표·댓글 신뢰(reviewers 필드·작성자 제외)·기준선 원문 수집(그 저장소 SHA 해소)·낡음·조기 종료 (spec §5.1-4·5, §5.2, §5.6)"
```

## Acceptance Criteria

- `node --test tests/mr-review/check.test.mjs` → 9/9.
- MR 작성자의 판정 댓글은 `trusted:false` + `ignoredComments`(R1-F5·R2-F1) · 브랜치형 Baseline 링크는 **그 프로젝트의** 브랜치 API로 SHA 해소하고 `pinned:false`(R5-F2) · 본문 변경 시각 뒤의 확인 댓글만 「있음」(R3-F3) · 기준선 후보 문서는 후보로만(R1-F6).
- `glab mr …` 호출 0건.

## Cautions

- **정규식·신뢰 리뷰어를 코드에 쓰지 마라 — 어댑터 값만. 이유:** P9·D10. 테스트 픽스처의 `TEST-POLICY-*`가 그 증거다.
- **`baselineConfirm`의 「낡음」은 system note `changed the description` 시각만 본다. MR `updated_at`은 쓰지 마라. 이유:** `updated_at`은 댓글 하나에도 바뀌어 항상 낡음이 된다.
- **Baseline 링크의 ref를 MR head 로 바꾸지 마라. 이유:** 다른 저장소엔 그 SHA가 없고, 같은 저장소라도 L2는 승인본과 대조해야 한다(R5-F2).
- **`closes_issues`와 본문 `#n`이 같은 이슈면 한 번만 받는다. 이유:** 팩 중복·API 호출 낭비.
- **`earlyExit`는 판정만 계산하고 여기서 멈추지 않는다. 이유:** 멈출지(`--full`)는 SKILL.md가 결정한다(§5.2 조기 종료).
