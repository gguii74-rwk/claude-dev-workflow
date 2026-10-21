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

test('기준선 후보 문서가 diff 에 있고 Baseline 만 미완이면 조기 종료하지 않는다(관련성 검토 경로 도달 — R1-10) · 다른 줄도 미완이면 HOLD_EVIDENCE 조기 종료', () => {
  const desc = body({ contractOver: { Baseline: '`<issue/spec/승인 결정 링크>`' } });
  const diffs = [{ old_path: 'docs/specs/2026-10-01-feature.md', new_path: 'docs/specs/2026-10-01-feature.md', new_file: true, renamed_file: false, deleted_file: false, too_large: false, diff: '' }];
  const { root, adapter, work } = setup({ description: desc, diffs });
  runCli(['check', '--adapter', adapter, '--work', work], fakeGlab(root, []).env);
  const c = readJson(join(work, 'check.json'));
  assert.deepEqual(c.baselineCandidateFiles, ['docs/specs/2026-10-01-feature.md']);
  assert.equal(c.contract.complete, false);
  assert.deepEqual(c.contract.incompleteLines, ['Baseline']);   // Baseline 미완은 verdict 의 기계 증거 부족으로 그대로 전달된다
  assert.equal(c.earlyExit.would, false);                        // Baseline 만 미완 + 후보 있음 → §5.3 이후 진행
  assert.equal(c.earlyExit.draftVerdict, null);
  assert.equal(c.deployRequired, false);
  const desc2 = body({ contractOver: { Baseline: '`<issue/spec/승인 결정 링크>`', 'Base SHA': '' } });
  const { root: root2, adapter: adapter2, work: work2 } = setup({ description: desc2, diffs });
  runCli(['check', '--adapter', adapter2, '--work', work2], fakeGlab(root2, []).env);
  const c2 = readJson(join(work2, 'check.json'));
  assert.equal(c2.earlyExit.would, true);                        // Baseline 외 줄(Base SHA) 미완 → 조기 종료
  assert.equal(c2.earlyExit.draftVerdict, 'HOLD_EVIDENCE');      // 후보가 있어 기준선 없음은 아님
  assert.match(c2.earlyExit.reason, /^계약 미완: Base SHA$/);
});

test('문서 링크(브랜치 ref) → 그 저장소의 브랜치 API 로 SHA 해소 · raw 원문 확보 · 고정 아님 · 슬래시 브랜치(feature/topic)는 최장 일치로 경계 해소', () => {
  const link = 'http://gitlab.test/g/docs/-/blob/master/guide/policy.md';
  const link2 = 'http://gitlab.test/g/docs/-/blob/feature/topic/guide/policy.md';
  const desc = body({ track: '정식', contractOver: { Baseline: '`' + link + '` · ' + link2 } });
  const { root, adapter, work } = setup({ description: desc });
  const enc = encodeURIComponent('guide/policy.md').replace(/\./g, '%2E');
  const TOPIC_SHA = 'e'.repeat(40);
  const g = fakeGlab(root, [
    { match: '^api projects/103$', json: { id: 103, web_url: 'http://gitlab.test/g/docs' } },
    { match: '^api projects/103/repository/branches/master$', json: { name: 'master', commit: { id: DOCS_SHA } } },
    { match: `^api projects/103/repository/files/${enc}/raw\\?ref=${DOCS_SHA}$`, text: '# 정책 원문\n' },
    { match: '^api projects/103/repository/branches/feature%2Ftopic$', json: { name: 'feature/topic', commit: { id: TOPIC_SHA } } },
    { match: `^api projects/103/repository/files/${enc}/raw\\?ref=${TOPIC_SHA}$`, text: '# 토픽 원문\n' },
  ]);
  const r = runCli(['check', '--adapter', adapter, '--work', work], g.env);
  assert.equal(r.code, 0, r.out + r.err);
  const c = readJson(join(work, 'check.json'));
  assert.equal(c.track, '정식');
  assert.equal(c.baselineType, '문서 링크');
  assert.equal(c.baselineConfirm.status, '해당 없음');
  const l = c.baselineLinks.find((x) => x.kind === 'repo' && x.raw === link);
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
  const l2 = c.baselineLinks.find((x) => x.kind === 'repo' && x.raw === link2);
  assert.equal(l2.ref, 'feature/topic');                                                   // 첫 세그먼트 `feature` 가 아니다(R2-8)
  assert.equal(l2.path, 'guide/policy.md');
  assert.equal(l2.resolved_sha, TOPIC_SHA);
  assert.equal(l2.status, '확보');
  assert.match(readFileSync(join(work, l2.file), 'utf8'), /# 토픽 원문/);
  const calls = g.calls().map((x) => x.join(' '));
  assert.ok(calls.some((x) => /branches\/feature%2Ftopic%2Fguide$/.test(x)));              // 긴 후보부터 시도(최장 일치)
  assert.ok(!calls.some((x) => /branches\/feature$/.test(x)));                             // 짧은 후보는 긴 후보가 맞으면 시도하지 않는다
});

test('permalink(40자 SHA) 는 그대로 고정 · 어댑터에 없는 프로젝트 링크는 미확보 · basename 만 같은 다른 호스트·namespace 링크도 미확보(R3-5)', () => {
  const link = 'http://gitlab.test/g/docs/-/blob/' + DOCS_SHA + '/guide/policy.md';
  const other = 'http://gitlab.test/other/zeta/-/blob/main/x.md';
  const foreign = 'https://elsewhere.invalid/unregistered/alpha/-/blob/main/docs/approved.md';
  const desc = body({ track: '정식', contractOver: { Baseline: link + ' · ' + other + ' · ' + foreign } });
  const { root, adapter, work } = setup({ description: desc });
  const enc = encodeURIComponent('guide/policy.md').replace(/\./g, '%2E');
  const g = fakeGlab(root, [
    { match: '^api projects/103$', json: { id: 103, web_url: 'http://gitlab.test/g/docs' } },
    { match: '^api projects/101$', json: { id: 101, web_url: 'http://gitlab.test/g/alpha' } },
    { match: `^api projects/103/repository/files/${enc}/raw\\?ref=${DOCS_SHA}$`, text: 'x' },
    { match: '^api projects/101/repository/branches/main$', json: { name: 'main', commit: { id: 'f'.repeat(40) } } },
    { match: '^api projects/101/repository/files/.*/raw', text: 'WRONG DOC' },
  ]);
  runCli(['check', '--adapter', adapter, '--work', work], g.env);
  const c = readJson(join(work, 'check.json'));
  const a = c.baselineLinks.find((x) => x.path === 'guide/policy.md');
  assert.equal(a.pinned, true);
  assert.equal(a.resolved_sha, DOCS_SHA);
  assert.equal(a.project_url, 'http://gitlab.test/g/docs');
  const z = c.baselineLinks.find((x) => x.path === 'x.md');
  assert.equal(z.status, '미확보');
  assert.match(z.reason, /어댑터/);
  const f = c.baselineLinks.find((x) => x.raw === foreign);
  assert.equal(f.project, 'alpha');                                                       // basename 은 등록 프로젝트와 같지만
  assert.equal(f.status, '미확보');                                                       // 호스트·namespace 가 등록 web_url 과 달라 확보하지 않는다
  assert.match(f.reason, /elsewhere\.invalid.*등록 프로젝트 alpha/);
  assert.equal(g.calls().some((x) => x.join(' ').includes('branches')), false);           // 범위 밖 링크로 ref 해소·raw 를 호출하지 않았다
  assert.equal(g.calls().some((x) => /projects\/101\/repository/.test(x.join(' '))), false);
});

test('이슈 댓글 조회 실패는 「댓글 없음」이 아니라 미확보(R3-3)', () => {
  const desc = body({ contractOver: { Baseline: '#12' } });
  const { root, adapter, work } = setup({ description: desc });
  const g = fakeGlab(root, [{ match: '^api projects/101/issues/12$', json: { iid: 12, title: '버그', description: '- ① 왜: 민원\n- ② 무엇을: 처리기', updated_at: '2026-10-19T00:00:00Z' } }]);   // notes 규칙 없음 → 404
  runCli(['check', '--adapter', adapter, '--work', work], g.env);
  const c = readJson(join(work, 'check.json'));
  const i = c.baselineLinks.find((x) => x.kind === 'issue' && x.ref === '12');
  assert.equal(i.status, '미확보');
  assert.match(i.reason, /댓글 조회 실패/);
  assert.equal(i.file, null);
});

test('이슈 기준선(#n) 과 closes_issues 원문 수집 · 변경 사유는 이슈에서 · 본문 #n 도 수집 · 미등록 프로젝트의 연결 이슈는 대체 없이 미확보', () => {
  const desc = body({ background: '- 이슈/spec: 참고 없음', contractOver: { Baseline: '#12' }, extra: '## 참고\n- #88 의 재발 방지\n\n```\n#999 코드펜스 안 — 이슈 아님\n```\n' }) + '\n## 후속\n- 계약 블록 **뒤** 절의 #77 도 수집(C2 R2-6 잔존 보정)\n';   // 「배경」 밖 절·계약 뒤 절의 #n 도 수집(C1·C2 R2-6), 코드펜스 안은 제외
  const { root, adapter, work } = setup({ description: desc, closes_issues: [
    { iid: 12, project_id: 101, title: '버그', description: '', updated_at: '2026-10-19T00:00:00Z', web_url: '' },
    { iid: 12, project_id: 999, title: '다른 프로젝트', description: '', updated_at: '2026-10-19T00:00:00Z', web_url: 'http://gitlab.test/g/zeta/-/issues/12' },   // 어댑터 미등록
  ] });
  const g = fakeGlab(root, [
    { match: '^api projects/101/issues/12$', json: { iid: 12, title: '버그', description: '- ① 왜: 민원\n- ② 무엇을: 처리기', updated_at: '2026-10-19T00:00:00Z' } },
    { match: '^api --paginate projects/101/issues/12/notes', json: [{ id: 5, system: false, author: { username: 'author-a' }, body: '추가 설명', created_at: '2026-10-19T01:00:00Z' }] },
    { match: '^api projects/101/issues/88$', json: { iid: 88, title: '참고 이슈', description: '배경 설명 88', updated_at: '2026-10-18T00:00:00Z' } },
    { match: '^api --paginate projects/101/issues/88/notes', json: [] },   // 댓글 0건(정상 빈 응답) — 조회 실패(404)와 구분된다(R3-3)
    { match: '^api projects/101/issues/77$', json: { iid: 77, title: '후속 이슈', description: '계약 뒤 절', updated_at: '2026-10-18T00:00:00Z' } },
    { match: '^api --paginate projects/101/issues/77/notes', json: [] },
  ]);
  runCli(['check', '--adapter', adapter, '--work', work], g.env);
  const c = readJson(join(work, 'check.json'));
  assert.equal(c.baselineType, '이슈');
  const issues = c.baselineLinks.filter((x) => x.kind === 'issue');
  const i = issues.find((x) => x.project === 'alpha' && x.ref === '12');
  assert.equal(i.status, '확보');
  assert.equal(i.version, '2026-10-19T00:00:00Z');
  assert.match(readFileSync(join(work, i.file), 'utf8'), /추가 설명/);
  assert.equal(issues.filter((x) => x.project === 'alpha' && x.ref === '12').length, 1);   // #12 와 closes_issues 12 는 하나로
  const i88 = issues.find((x) => x.ref === '88');
  assert.equal(i88.status, '확보');                                                        // 본문 다른 절(「참고」)의 #88 도 수집(R2-6 · C1 사용자 결정 = 본문 전체)
  assert.equal(issues.find((x) => x.ref === '77')?.status, '확보');                        // Review Contract 블록 **뒤** 절의 #77 도 수집(C2 R2-6 잔존 — 블록 제거가 본문 끝까지 먹지 않는다)
  assert.ok(!issues.some((x) => x.ref === '999'));                                          // 코드펜스 안 #999 는 이슈 참조가 아니다
  assert.ok(!g.calls().some((x) => x.join(' ') === 'api projects/101/issues/999'));
  assert.match(readFileSync(join(work, i88.file), 'utf8'), /배경 설명 88/);
  const z = issues.find((x) => x.project_id === 999);
  assert.equal(z.status, '미확보');                                                        // 미등록 프로젝트 → 현재 프로젝트로 대체하지 않는다(R2-3)
  assert.equal(z.project, null);
  assert.match(z.reason, /id 999/);
  assert.equal(g.calls().filter((x) => x.join(' ') === 'api projects/101/issues/12').length, 1);   // 999 의 #12 를 101 에서 읽지 않았다
  assert.equal(c.reason.source, 'issue');
  assert.equal(c.reason.why, true);
  assert.equal(c.reason.what, true);
});

test('댓글: 신뢰 이전 판정(옛 head) → 재리뷰 · 작성자의 판정 댓글은 무시 · 작성자 토큰 · 기준선 확인 낡음', () => {
  const notes = [
    { id: 10, system: false, author: { id: 2, username: 'rev-b' }, created_at: '2026-10-19T00:00:00Z', body: '기준선 확인 — 배경 ①② 동의' },
    { id: 11, system: true, author: { id: 1, username: 'author-a' }, created_at: '2026-10-19T02:00:00Z', body: 'changed the description' },
    { id: 12, system: false, author: { id: 2, username: 'rev-b' }, created_at: '2026-10-20T00:00:00Z', body: `리뷰 계약 TEST-POLICY-v1.0 · head ${OLD} · 사람 판정 CHANGES_REQUESTED\n\n4. 차단 발견\n- F1 DEFECT — x\n- … 외 3건(차단 — 전부 부록 D 에 있음): F2, F3, M-deploy\n5. 비차단 후속\n- 없음` },
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
  // 이전 차단 발견 전체 목록(R4-3): 댓글 축약분(F2·F3)은 이전 리포트가 없으면 title:null → 불완전
  assert.equal(c.rereview.priorReport, null);
  assert.deepEqual(c.rereview.priorBlocking.map((b) => [b.id, b.title, b.source]), [['F1', 'x', 'comment'], ['F2', null, 'missing'], ['F3', null, 'missing'], ['M-deploy', null, 'missing']]);
  assert.equal(c.rereview.priorBlockingComplete, false);
  // 이전 리포트가 있으면 부록 D 에서 제목을 복원한다 → 완전
  const reportDir = join(root, 'reviews');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(join(reportDir, `alpha-7-${OLD.slice(0, 7)}.md`), '# 이전 리포트\n\n## 부록 D — 병합 발견 상세 · 리뷰어 결정\n\n- **F1** [L1] DEFECT (차단) — x (src/A.java:1) · 출처 both · 확신 high\n- **F2** [L2] DEFECT (차단) — 널 역참조 (src/B.java:9) · 출처 claude · 확신 medium\n- **F3** [L3] MISSING_EVIDENCE (차단) — 회귀 결과 없음 (-:-) · 출처 both · 확신 high\n- **M-deploy** [기계] MISSING_EVIDENCE (차단) — 배포본 불일치 — deleted_list (-:-) · 출처 machine · 확신 -\n  - 근거: 스크립트 결정적 검사(deploy) — 모델 발견이 아니다\n');
  runCli(['check', '--adapter', adapter, '--work', work], fakeGlab(root, []).env);
  const c2 = readJson(join(work, 'check.json'));
  assert.equal(c2.rereview.priorBlockingComplete, true);
  assert.match(c2.rereview.priorReport, /alpha-7-ccccccc\.md$/);
  assert.deepEqual(c2.rereview.priorBlocking.map((b) => [b.id, b.type, b.title, b.source]), [['F1', 'DEFECT', 'x', 'comment'], ['F2', 'DEFECT', '널 역참조', 'report'], ['F3', 'MISSING_EVIDENCE', '회귀 결과 없음', 'report'], ['M-deploy', 'MISSING_EVIDENCE', '배포본 불일치 — deleted_list', 'report']]);   // 기계 항목(R5-3)도 부록 D 에서
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
  assert.deepEqual(c.rereview.priorBlocking, []);
  assert.equal(c.rereview.priorBlockingComplete, null);                                       // 재리뷰가 아니면 평가하지 않는다
  assert.equal(c.priorVerdicts[0].trusted, true);
});

test('변경 사유 양식만 남은 본문(① 왜: <…> ② 무엇을: <…>)은 「없음」 — 연결 이슈 원문이 있으면 이슈로 대체, 없으면 none (R4-4)', () => {
  const tmpl = '- ① 왜: <관찰 가능한 현상·요청 근거>\n- ② 무엇을: <원인·위치·범위>';
  const a = setup({ description: body({ background: tmpl }) });
  runCli(['check', '--adapter', a.adapter, '--work', a.work], fakeGlab(a.root, []).env);
  const c1 = readJson(join(a.work, 'check.json'));
  assert.equal(c1.reason.source, 'none');
  assert.equal(c1.reason.why, false);
  assert.equal(c1.reason.what, false);
  const b = setup({ description: body({ background: tmpl, contractOver: { Baseline: '#12' } }), closes_issues: [] });
  const g = fakeGlab(b.root, [
    { match: '^api projects/101/issues/12$', json: { iid: 12, title: '버그', description: '- ① 왜: 민원\n- ② 무엇을: 처리기', updated_at: '2026-10-19T00:00:00Z' } },
    { match: '^api --paginate projects/101/issues/12/notes', json: [] },
  ]);
  runCli(['check', '--adapter', b.adapter, '--work', b.work], g.env);
  const c2 = readJson(join(b.work, 'check.json'));
  assert.equal(c2.reason.source, 'issue');                                                   // 빈 양식이 bodyReason 으로 남아 이슈 대체를 막지 않는다
  assert.equal(c2.reason.why, true);
  assert.equal(c2.reason.what, true);
  assert.match(c2.reason.text, /민원/);
  const d = setup({ description: body({ background: '- ① 왜: 민원\n- ② 무엇을: <원인·위치·범위>' }) });
  runCli(['check', '--adapter', d.adapter, '--work', d.work], fakeGlab(d.root, []).env);
  const c3 = readJson(join(d.work, 'check.json'));
  assert.deepEqual([c3.reason.source, c3.reason.why, c3.reason.what], ['body', true, false]);   // 한 칸만 채운 본문은 body — ② 만 없음
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

기대: tests 10 · pass 0 · fail 10.

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
// 양식 표지(①·② / 왜:·무엇을:) 뒤의 실내용만 센다 — 꺾쇠 자리표시자 `<…>`·빈 값은 내용이 아니다(§5.2 「양식 문구 그대로면 없음」, R4-4). 표지가 없으면 글자가 있는 줄 수로 본다.
const PLACEHOLDER_RE = /<[^<>\n]*>/g;
const hasContent = (s) => /[\p{L}\p{N}]/u.test((s || '').replace(PLACEHOLDER_RE, '').replace(/^\s*(?:왜|무엇을)\s*[:：]/, ''));
export function judgeReason(text) {
  if (!text) return { why: false, what: false };
  const whyM = text.match(/(?:①|왜\s*[:：])([^\n]*)/);
  const whatM = text.match(/(?:②|무엇을\s*[:：])([^\n]*)/);
  if (whyM || whatM) return { why: !!whyM && hasContent(whyM[1]), what: !!whatM && hasContent(whatM[1]) };
  const n = text.split('\n').filter((l) => hasContent(l)).length;
  return { why: n >= 1, what: n >= 2 };
}

// ── 링크 분해 ─────────────────────────────────────────────────────────────
// blob 링크의 ref/path 경계는 URL 만으로 정해지지 않는다(브랜치 이름에 `/` 가능) — `refpath` 로 보존하고 resolveRepoLink 가 그 저장소의 branch/tag 로 경계를 해소한다.
// 호스트·namespace(`project_url` = `/-/` 앞 전체)는 버리지 않는다 — basename 이 같은 다른 호스트·그룹의 링크를 등록 프로젝트로 오해소하지 않게 해소 때 `web_url` 과 대조한다(R3-5).
const BLOB_RE = /(https?:\/\/[^\s)<>`]+?\/([^\s/)<>`]+))\/-\/blob\/([^\s)<>`#]+)/g;
const ISSUE_URL_RE = /(https?:\/\/[^\s)<>`]+?\/([^\s/)<>`]+))\/-\/issues\/(\d+)/g;
const ISSUE_REF_RE = /(?:^|[\s(`])#(\d+)\b/g;
const SHA_RE = /^[0-9a-f]{7,40}$/;

function splitRefPath(refpath) {
  const segs = refpath.split('/').map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  return { segs, ref: segs[0], path: segs.slice(1).join('/') };   // 임시 경계(첫 세그먼트) — SHA·미확보 링크용. 브랜치·태그는 해소 시 재결정
}

export function parseBaselineValue(value, currentProject) {
  const links = [];
  for (const m of value.matchAll(BLOB_RE)) { const { ref, path } = splitRefPath(m[3]); links.push({ raw: m[0], kind: 'repo', project: m[2], project_url: m[1], ref, path, refpath: m[3] }); }
  for (const m of value.matchAll(ISSUE_URL_RE)) links.push({ raw: m[0], kind: 'issue', project: m[2], project_url: m[1], ref: m[3], path: '' });
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
function refSha(projId, ref) {
  try { return apiJson(`projects/${projId}/repository/branches/${encodeURIComponent(ref)}`).commit.id; }
  catch { return apiJson(`projects/${projId}/repository/tags/${encodeURIComponent(ref)}`).commit.id; }
}

// 등록 프로젝트의 정체성 대조(R3-5) — 링크의 호스트·전체 프로젝트 경로가 그 등록 ID 의 `web_url` 과 같아야 한다. 다르면 「확보」로 기록하지 않는다(다른 문서·이슈를 근거로 삼게 된다).
const webUrlCache = new Map();
function projectWebUrl(projId) {
  if (!webUrlCache.has(projId)) webUrlCache.set(projId, String(apiJson(`projects/${projId}`).web_url || ''));
  return webUrlCache.get(projId);
}
const normUrl = (u) => String(u || '').trim().replace(/\/+$/, '').replace(/^(https?:\/\/)([^/]+)/, (_, s, h) => s + h.toLowerCase());
function identityMismatch(link, proj) {
  if (!link.project_url) return null;   // `#n`·closes_issues(project_id 가 정체성) 은 대조 대상이 아니다
  const web = projectWebUrl(proj.id);
  return normUrl(web) === normUrl(link.project_url) ? null : `링크의 호스트·프로젝트 경로(${link.project_url})가 등록 프로젝트 ${link.project}(${web || 'web_url 없음'})와 다르다 — 범위 밖 링크`;
}

function resolveRepoLink(link, adapter, work, n) {
  const proj = adapter.resolved.projects[link.project];
  if (!proj) return { ...link, resolved_sha: null, pinned: false, status: '미확보', reason: `어댑터 projects 에 없는 프로젝트: ${link.project}`, file: null, version: null };
  let sha = null;
  let pinned = false;
  let ref = link.ref;
  let filePath = link.path;
  try {
    const mis = identityMismatch(link, proj);
    if (mis) throw new Error(mis);
    const { segs } = splitRefPath(link.refpath || `${link.ref}/${link.path}`);
    if (SHA_RE.test(segs[0])) {
      pinned = true;
      ref = segs[0];
      filePath = segs.slice(1).join('/');
      sha = ref.length === 40 ? ref : apiJson(`projects/${proj.id}/repository/commits/${ref}`).id;
    } else {
      // 브랜치·태그 이름에 `/` 가 있을 수 있다 — 긴 후보부터(GitLab 의 blob 라우팅과 같은 최장 일치) 그 저장소의 branch/tag API 로 경계를 정한다
      let found = null;
      for (let k = segs.length - 1; k >= 1 && !found; k--) {
        const cand = segs.slice(0, k).join('/');
        try { found = { ref: cand, sha: refSha(proj.id, cand), path: segs.slice(k).join('/') }; } catch { /* 다음 후보 */ }
      }
      if (!found) throw new Error(`브랜치·태그를 찾지 못함: ${link.refpath || link.ref}`);
      ref = found.ref;
      sha = found.sha;
      filePath = found.path;
    }
    const raw = apiRaw(`projects/${proj.id}/repository/files/${encodePath(filePath)}/raw?ref=${sha}`).toString('utf8');
    const file = `baseline/${n}.md`;
    fs.mkdirSync(path.join(work, 'baseline'), { recursive: true });
    fs.writeFileSync(path.join(work, file), `<!-- mr-review source: ${link.project}:${filePath}@${sha} ref=${ref} pinned=${pinned} -->\n${raw}`);
    return { ...link, ref, path: filePath, resolved_sha: sha, pinned, status: '확보', reason: '', file, version: sha };
  } catch (e) {
    return { ...link, ref, path: filePath, resolved_sha: sha, pinned, status: '미확보', reason: `원문 확보 실패: ${e.message.slice(0, 160)}`, file: null, version: null };
  }
}

function resolveIssue(link, adapter, work, n) {
  const proj = link.project ? adapter.resolved.projects[link.project] : null;
  if (!proj) return { ...link, resolved_sha: null, pinned: true, status: '미확보', reason: `어댑터 projects 에 없는 프로젝트: ${link.project ?? `id ${link.project_id}`}`, file: null, version: null, text: '' };
  try {
    const mis = identityMismatch(link, proj);
    if (mis) throw new Error(mis);
    const issue = apiJson(`projects/${proj.id}/issues/${link.ref}`);
    // 댓글 조회 실패는 「댓글 없음」이 아니다(R3-3) — 원문 일부를 못 받은 것이므로 미확보로 남긴다(verdict 의 결정적 증거 부족)
    let notes;
    try { notes = apiJson(`projects/${proj.id}/issues/${link.ref}/notes?per_page=100&sort=asc&order_by=created_at`, { paginate: true }); } catch (e) { throw new Error(`이슈 댓글 조회 실패: ${e.message.slice(0, 120)}`); }
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

// ── 재리뷰 — 이전 차단 발견 전체 목록(§5.6, R4-3) ──────────────────────────
// 이전 판정 댓글의 「4. 차단 발견」은 실행 블록 40줄 축약(task-06 ④)으로 일부가 `- … 외 n건(차단 — 전부 부록 D 에 있음): F9, F10` 으로 접힐 수 있다.
// 접힌 항목은 이전 리포트(<reportDir>/<프로젝트>-<iid>-<prior_head7>.md) 부록 D 에서 제목을 복원하고, 리포트가 없거나 부록 D 에 없으면 title:null 로 남겨
// complete=false 가 된다 — verdict 가 M-rereview(증거 부족)로 받아 「이전 차단 발견마다 확인」을 완료한 것으로 취급하지 않는다.
const BLOCK_ITEM_RE = /^- (?:([A-Za-z][\w-]*) )?(DEFECT|MISSING_EVIDENCE|DESIGN_DRIFT) — (.*)$/;
const BLOCK_MORE_RE = /^- … 외 (\d+)건\(차단[^)]*\)(?::\s*(.*))?$/;
const APPENDIX_D_RE = /^- \*\*([A-Za-z][\w-]*)\*\* \[[^\]]*\] (\S+)(?: \(차단\))? — (.*?) \([^()]*\) · 출처 /;
export function parseAppendixD(reportText) {
  const out = new Map();
  if (!reportText) return out;
  const i = reportText.indexOf('## 부록 D');
  if (i < 0) return out;
  for (const l of reportText.slice(i).split('\n')) { const m = l.match(APPENDIX_D_RE); if (m) out.set(m[1], { type: m[2], title: m[3] }); }
  return out;
}
export function priorBlockingList(noteBody, reportText) {
  const lines = (noteBody || '').split('\n').map((l) => l.trim());
  const s = lines.findIndex((l) => /^4\. 차단 발견/.test(l));
  if (s < 0) return { items: [], complete: false };                                   // 절 자체가 없으면 목록을 세울 수 없다
  const items = [];
  let foldedN = 0;
  let foldedIds = [];
  for (let i = s + 1; i < lines.length; i += 1) {
    const l = lines[i];
    if (/^5\. /.test(l) || l === '```') break;
    const m = l.match(BLOCK_ITEM_RE);
    if (m) { items.push({ id: m[1] || null, type: m[2], title: m[3], source: 'comment' }); continue; }
    const f = l.match(BLOCK_MORE_RE);
    if (f) { foldedN = Number(f[1]); foldedIds = (f[2] || '').split(/\s*,\s*/).filter(Boolean); }
  }
  if (foldedN > 0) {
    const appendix = parseAppendixD(reportText);
    if (foldedIds.length) for (const id of foldedIds) { const a = appendix.get(id); items.push(a ? { id, type: a.type, title: a.title, source: 'report' } : { id, type: null, title: null, source: 'missing' }); }
    else for (let k = 0; k < foldedN; k += 1) items.push({ id: null, type: null, title: null, source: 'missing' });   // id 목록 없는 옛 형식 — 복원 불가
  }
  return { items, complete: items.every((b) => b.title !== null) };
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
  const active = !!latest && !sameHead;
  let prior = { priorReport: null, priorBlocking: [], priorBlockingComplete: null };
  if (active) {
    const reportFile = path.join(adapter.resolved.reportDir, `${mr.project.name}-${mr.iid}-${latest.sha.slice(0, 7)}.md`);
    const reportText = fs.existsSync(reportFile) ? fs.readFileSync(reportFile, 'utf8') : null;
    const note = mr.notes.find((n) => n.id === latest.note_id);
    const pb = priorBlockingList(note ? note.body : '', reportText);
    prior = { priorReport: reportText === null ? null : reportFile, priorBlocking: pb.items, priorBlockingComplete: pb.complete };
  }
  const rereview = { active, prior_head: latest ? latest.sha : null, prior_verdict: latest ? latest.verdict : null, prior_note_id: latest ? latest.note_id : null, ...prior };
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

  // 연결 이슈(closes_issues)와 MR 본문의 #n 참조도 원문 수집 대상(§5.1-5) — 프로젝트·IID 로 중복 제거.
  // closes_issues 의 project_id 가 어댑터에 없으면 현재 프로젝트로 **대체하지 않는다**(같은 번호의 무관한 이슈를 근거로 삼게 된다) — 미확보로 남긴다.
  const hasIssue = (projName, iid) => links.some((l) => l.kind === 'issue' && l.project === projName && String(l.ref) === String(iid));
  for (const ci of mr.closes_issues || []) {
    const projName = Object.entries(adapter.resolved.projects).find(([, p]) => p.id === ci.project_id)?.[0] ?? null;
    if (!hasIssue(projName, ci.iid)) links.push({ raw: ci.web_url || `closes #${ci.iid}`, kind: 'issue', project: projName, ref: String(ci.iid), path: '', project_id: ci.project_id });
  }
  // 본문 #n·이슈 URL 은 **본문 전체**에서 수집한다(spec §5.1-5, 사용자 결정 C1 R2-6) — 코드펜스 안과 Review Contract 블록(계약 값·실행 블록 — Baseline 줄은 위에서 따로 파싱)은 제외.
  // 존재하지 않는 번호(「#3 항목」 오인 등)는 resolveIssue 가 미확보로 남겨 M-baseline → HOLD_EVIDENCE 로 전달된다 — 작성자가 본문을 고치게 하는 fail-closed 비용으로 수용(사용자 결정).
  // Review Contract 블록 = 그 제목 줄부터 **다음 `## ` 제목 앞까지**(C2 R2-6 잔존 보정 — `[\s\S]*$` 는 본문 끝까지 지워 계약 뒤 일반 절의 #n 이 빠졌다). 계약 뒤 절(「후속」·「참고」)도 수집 대상이다.
  const bodyText = desc.replace(/```[\s\S]*?```/g, '').replace(/^## Review Contract\b[^\n]*(?:\n(?!## )[^\n]*)*/m, '');
  for (const m of bodyText.matchAll(ISSUE_REF_RE)) if (!hasIssue(mr.project.name, m[1])) links.push({ raw: `#${m[1]}`, kind: 'issue', project: mr.project.name, ref: m[1], path: '' });
  for (const m of bodyText.matchAll(ISSUE_URL_RE)) if (!hasIssue(m[2], m[3])) links.push({ raw: m[0], kind: 'issue', project: m[2], project_url: m[1], ref: m[3], path: '' });
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

  // 변경 사유 출처: 본문 「배경」에 실내용(양식 표지·자리표시자를 뺀 글)이 있을 때만 body — 양식만 남은 본문은 「없음」이라 연결 이슈 원문으로 대체한다(§5.2, R4-4)
  const bodyReason = reasonText(desc);
  const bodyJ = judgeReason(bodyReason);
  const reasonSrc = (bodyJ.why || bodyJ.what) ? 'body' : issueText ? 'issue' : 'none';
  const reasonJ = reasonSrc === 'body' ? bodyJ : judgeReason(reasonSrc === 'issue' ? issueText : '');
  const reason = { why: reasonJ.why, what: reasonJ.what, source: reasonSrc, text: (reasonSrc === 'body' ? bodyReason : reasonSrc === 'issue' ? issueText : '').slice(0, 2000) };

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
  // §5.2 조기 종료: Baseline 만 미완이고 diff 에 기준선 후보 문서가 있으면 조기 종료하지 않는다(후보의 관련성은 §5.4 검토자가 본다 — 그 경로가 도달 가능해야 한다).
  // Baseline 미완 자체는 incompleteLines 에 그대로 남아 verdict 의 기계 증거 부족(M-contract-Baseline → HOLD_EVIDENCE 이상)으로 전달된다.
  const otherIncomplete = contract.incompleteLines.filter((n) => n !== 'Baseline');
  const would = otherIncomplete.length > 0 || baselineMissing;
  const earlyExit = { would, reason: would ? (baselineMissing ? '기준선 없음(후보 문서도 없음)' : `계약 미완: ${otherIncomplete.join(', ')}`) : '', draftVerdict: would ? (baselineMissing ? 'RETURN_TO_DESIGN' : 'HOLD_EVIDENCE') : null };

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

기대: check 10/10 · 앞선 17/17 · `CHECK_OK`.

```bash
git add dev-workflow/skills/mr-review/scripts/lib/check.mjs dev-workflow/skills/mr-review/scripts/mr-review.mjs tests/mr-review/check.test.mjs
git commit -m "feat(mr-review): check — 작성 규칙 검사표·댓글 신뢰(reviewers 필드·작성자 제외)·기준선 원문 수집(그 저장소 SHA 해소)·낡음·조기 종료 (spec §5.1-4·5, §5.2, §5.6)"
```

## Acceptance Criteria

- `node --test tests/mr-review/check.test.mjs` → 11/11.
- 본문 `#n`·이슈 URL 수집에서 제외하는 Review Contract 블록은 **그 제목 줄부터 다음 `## ` 제목 앞까지**만 — 계약 블록 뒤 절(「후속」 등)의 `#n` 은 수집된다(plan R2-6 C2 잔존 보정, 사용자 결정 「본문 전체」).
- 저장소·이슈 URL 링크는 호스트·전체 프로젝트 경로를 등록 프로젝트의 `web_url`과 대조하고 다르면 미확보(plan R3-5) · 이슈 댓글 조회 실패는 미확보(plan R3-3).
- 변경 사유 양식만 남은 본문(①·② 표지 + 꺾쇠 자리표시자)은 「없음」 — 연결 이슈 원문으로 대체(plan R4-4) · 재리뷰면 `rereview.priorBlocking`에 이전 차단 발견 전체(댓글 + 이전 리포트 부록 D 복원), 복원 못 한 항목은 `title:null`·`priorBlockingComplete:false`(plan R4-3).
- MR 작성자의 판정 댓글은 `trusted:false` + `ignoredComments`(R1-F5·R2-F1) · 브랜치형 Baseline 링크는 **그 프로젝트의** 브랜치 API로 SHA 해소하고 `pinned:false`(R5-F2) · 본문 변경 시각 뒤의 확인 댓글만 「있음」(R3-F3) · 기준선 후보 문서는 후보로만(R1-F6).
- `glab mr …` 호출 0건.

## Cautions

- **정규식·신뢰 리뷰어를 코드에 쓰지 마라 — 어댑터 값만. 이유:** P9·D10. 테스트 픽스처의 `TEST-POLICY-*`가 그 증거다.
- **`baselineConfirm`의 「낡음」은 system note `changed the description` 시각만 본다. MR `updated_at`은 쓰지 마라. 이유:** `updated_at`은 댓글 하나에도 바뀌어 항상 낡음이 된다.
- **Baseline 링크의 ref를 MR head 로 바꾸지 마라. 이유:** 다른 저장소엔 그 SHA가 없고, 같은 저장소라도 L2는 승인본과 대조해야 한다(R5-F2).
- **`closes_issues`와 본문 `#n`이 같은 이슈면 한 번만 받는다. 이유:** 팩 중복·API 호출 낭비. 본문 `#n`·이슈 URL 은 **본문 전체**(코드펜스·Review Contract 블록 제외)가 수집 대상이다 — 「배경」 절로 좁히지 마라(C1 R2-6 잔존, 사용자 결정 · §5.1-5). 존재하지 않는 번호는 미확보 → HOLD_EVIDENCE 가 정상 동작이다(작성자가 본문을 고친다).
- **`closes_issues`의 `project_id`가 어댑터에 없으면 현재 프로젝트로 대체하지 마라 — `project:null`·미확보. 이유:** R2-3 — 현재 프로젝트에 같은 번호의 무관한 이슈가 있으면 그 본문이 변경 사유·설계 근거가 되고 미확보 차단도 안 생긴다.
- **blob 링크의 ref/path 경계를 URL의 첫 세그먼트로 정하지 마라 — 그 저장소의 branch/tag API로 긴 후보부터 해소. 이유:** R2-8 — `feature/topic` 브랜치 링크가 `ref=feature, path=topic/…`로 깨져 다른 문서를 확보로 기록할 수 있다. SHA(permalink)만 첫 세그먼트로 확정.
- **`judgeReason`은 양식 표지(①·②)의 존재가 아니라 표지 뒤의 실내용으로 판정한다 — 꺾쇠 `<…>`·빈 값은 내용이 아니다. 양식만 남은 본문을 `source:body`로 두지 마라. 이유:** plan R4-4 — `① 왜: <관찰 가능한 현상·요청 근거>` 두 줄이 둘 다 true 로 판정돼 보완 요청이 빠지고 S1 분류가 오염되며, 빈 양식이 bodyReason 으로 남으면 연결 이슈의 실제 사유도 대체 입력으로 쓰이지 못한다.
- **재리뷰의 이전 차단 발견은 댓글 「4. 차단 발견」 항목 + 「… 외 n건: F9, F10」 축약분까지 전체를 세우고, 축약분은 이전 리포트 부록 D 에서 복원하라. 복원 못 한 항목을 버리거나 완전한 목록으로 취급하지 마라. 이유:** plan R4-3 — task-06 의 40줄 축약(R3-10)이 차단 발견 일부를 부록 D(로컬 리포트)로 옮기므로 댓글만으로 대조표를 만들면 §5.6 「이전 차단 발견마다」 확인이 빠진 채 판정된다. `title:null` 항목은 `priorBlockingComplete:false` → verdict `M-rereview`.
- **URL 링크의 호스트·namespace 를 버리고 basename 만으로 등록 프로젝트에 매칭하지 마라 — `project_url`을 보존하고 해소 때 `projects/<id>`의 `web_url`과 대조해 다르면 미확보. 이유:** plan R3-5 — `https://elsewhere.invalid/unregistered/alpha/-/blob/…`가 등록된 `alpha`의 문서로 해석돼 기본 호스트의 다른 원문을 「확보」로 기록한다(L1·L2 대조 근거가 바뀜). `#n`·`closes_issues`는 `project_id`가 정체성이라 대조 대상이 아니다.
- **이슈 댓글 조회 실패를 빈 댓글로 바꾸지 마라 — 미확보. 이유:** plan R3-3 — 댓글 없는 원문이 「확보」로 기록돼 증거 부족이 사라진다.
- **`earlyExit`는 판정만 계산하고 여기서 멈추지 않는다. 이유:** 멈출지(`--full`)는 SKILL.md가 결정한다(§5.2 조기 종료).
- **Baseline 줄만 미완이고 후보 문서가 있으면 `would:false`. `!contract.complete`로 조기 종료하지 마라. 이유:** R1-10 — Baseline 자리표시자는 항상 계약 미완이라, 그렇게 하면 §5.2의 「후보 문서 관련성 검토」 경로가 기본 실행에서 도달 불가능해진다. Baseline 미완은 `incompleteLines`로 verdict에 남아 `APPROVE`를 막는다.
