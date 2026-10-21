# task-06 — 판정 계산 · 리포트 · 비밀값 제거 · 정리 (verdict / render / cleanup / review-validate) (spec §5.5-4 · §5.7 · F3 · F5 · F7 · F8 · SC-3 `verdict.json` · SC-4 · SC-5)

**목적**: 메인이 병합한 `findings.json`(SC-5)과 기계 검사 결과(`check`·`snapshot`·`deploy`)로 **정책 순서의 판정을 결정적으로** 계산하고(§5.5-4 — 결함 집합/증거 부족 집합, 계약 미완·미복원 diff·배포본 불일치·원문 미확보는 증거 부족에 자동 투입, 미해결 후보는 판정 미확정), §5.7 구성의 리포트를 렌더해 어댑터 비밀값 패턴으로 가린 뒤 저장한다. 검토자 출력 스키마 검증(`review-validate`)과 임시 산출물 정리(`cleanup`)도 여기 둔다.

## Files

- Create: `dev-workflow/skills/mr-review/scripts/lib/report.mjs`
- Modify: `dev-workflow/skills/mr-review/scripts/mr-review.mjs` (`review-validate`·`verdict`·`render`·`cleanup` 등록)
- Test: `tests/mr-review/report.test.mjs`

## Prep

- spec §5.4 출력 스키마 · §5.5-2(판정 미확정·`--resolve`) · §5.5-4(두 집합·판정 순서) · §5.7(리포트 구성 1~6·실행 블록·40줄·비밀값 제거·정리) · F3·F5·F7·F8 · D3·D9·D13.
- 엔트리포인트 **SC-3** `verdict.json` · **SC-4**(검토자 출력) · **SC-5**(`findings.json`) · **SC-6**(네 서브커맨드 출력).
- 팀 정책 §8.1 실행 블록 형식(어댑터가 아니라 정책이 정한 **고정 형식** — 첫 줄 `리뷰 계약 <정책ID> · head <sha> · 추천 판정(초안) <판정>`, 둘째 줄 `사람 승인 상태: …`, 절 1~5, 본문 40줄 이내). 정책 ID 문자열 자체는 `check.contract.policyId`(MR 계약) 또는 어댑터 `judgeId`에서 온다(D13).
- task-05 산출물 `applyMask`(비밀값 제거에 재사용).

## Deps

03, 04, 05

## Steps

### 1. 테스트 작성 (RED)

`tests/mr-review/report.test.mjs`를 아래 내용 그대로 만든다.

````js
// report 계약 테스트 (spec §5.5-4 · §5.7 · SC-3 verdict.json · SC-4 · SC-5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmp, writeAdapter, initRepos, runCli, readJson, git, LIB } from './helpers.mjs';

const { computeVerdict, validateReview } = await import(join(LIB, 'report.mjs'));
const HEAD = 'a'.repeat(40);

const baseCheck = () => ({
  contract: { found: true, policyId: 'TEST-POLICY-v1.0', policyStatus: '채움(구버전)', lines: [{ name: 'Policy', status: '채움(구버전)', value: 'TEST-POLICY-v1.0' }, { name: 'Baseline', status: '채움', value: 'MR 본문 「배경」' }], complete: true, incompleteLines: [] },
  track: '경량', baselineType: 'MR 본문 배경', baselineLinks: [{ kind: 'body', status: '확보', file: 'baseline/1.md', version: HEAD, raw: 'MR 본문' }], reason: { why: true, what: true, source: 'body', text: '' },
  baselineCandidateFiles: [], baselineConfirm: { status: '없음', note_id: null, note_at: null, changed_at: null }, attachments: [], attachmentClaimedButMissing: false,
  deployRequired: false, deployExempt: false, deployNote: '비해당', rebase: { need: false, detailed_merge_status: 'mergeable' }, reviewerMismatch: false, priorVerdicts: [], authorTokens: [], ignoredComments: [],
  rereview: { active: false, prior_head: null, prior_verdict: null, prior_note_id: null }, earlyExit: { would: false, reason: '', draftVerdict: null },
});
const baseSnap = () => ({ mode: 'worktree', target_sha: 'b'.repeat(40), base_sha: 'b'.repeat(40), head_sha: HEAD, checkout: null, worktree: null, attempts: 1, unrecovered: [], rebuilt: [] });
const baseDeploy = () => ({ applicable: false, reason: '운영 배포 대상 변경 없음', expected: { deploy: [], deleted: [] }, zip: { attachment: null, downloaded: false, comment_sha: null, entries: [] }, bodyDeletedList: [], result: '해당 없음', mismatches: [] });
const F = (over) => ({ id: 'F1', fingerprint: 'x', source: 'both', lens: 'L5', type: 'DEFECT', blocking: true, title: '비밀번호 평문 로그', file: 'src/A.java', line_start: 3, line_end: 3, evidence: 'S2', scenario: '로그에 평문', confidence: 'high', recommendation: '마스킹', fixableInDesign: 'yes', brokenPremise: '', unresolved: false, resolution: null, dismissReason: '', ...over });
const findings = (list, over = {}) => ({ head_sha: HEAD, validReviewers: ['claude', 'codex'], crossChecked: true, baselineCandidateRelevant: true, findings: list, intent: [{ criterion: 'V1 빌드', result: 'UNKNOWN', location: '-', basis: '작성자 주장' }], outsideWorktreePaths: [], ...over });
const V = (fnd, { check = baseCheck(), snapshot = baseSnap(), deploy = baseDeploy(), resolves = {} } = {}) => computeVerdict({ check, snapshot, deploy, findings: fnd, resolves, judgeId: 'TEST-POLICY-v1.1' });

test('validateReview: 스키마 통과·실패 사유', () => {
  const ok = { reviewer: 'claude', head_sha: HEAD, findings: [{ lens: 'L1', type: 'FOLLOW_UP', title: 't', file: null, line_start: 0, line_end: 0, evidence: '', scenario: '', confidence: 'low', recommendation: '', fixableInDesign: 'yes', brokenPremise: '' }], intent: [], baselineCandidateRelevant: true };
  assert.deepEqual(validateReview(ok), { ok: true, errors: [] });
  const bad = { reviewer: 'codex', head_sha: 'short', findings: [{ lens: 'L5', type: 'DEFECT', title: 't', scenario: '', confidence: 'high', fixableInDesign: 'maybe' }], intent: [], baselineCandidateRelevant: 'yes' };
  const r = validateReview(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /head_sha/.test(e)));
  assert.ok(r.errors.some((e) => /scenario/.test(e)));
  assert.ok(r.errors.some((e) => /fixableInDesign/.test(e)));
  assert.ok(r.errors.some((e) => /baselineCandidateRelevant/.test(e)));
  assert.equal(validateReview({ reviewer: 'x', head_sha: HEAD, findings: 'no', intent: [], baselineCandidateRelevant: true }).ok, false);
  // 기대 head·reviewer 대조(R2-4) — 이전 head 의 결과는 형식이 맞아도 INVALID
  assert.equal(validateReview(ok, { head: HEAD, reviewer: 'claude' }).ok, true);
  const stale = validateReview({ ...ok, head_sha: 'c'.repeat(40) }, { head: HEAD, reviewer: 'claude' });
  assert.equal(stale.ok, false);
  assert.ok(stale.errors.some((e) => /기대 head/.test(e)));
  assert.ok(validateReview(ok, { head: HEAD, reviewer: 'codex' }).errors.some((e) => /reviewer claude ≠ 기대 codex/.test(e)));
});

test('판정 순서: 없음→APPROVE · 증거 부족→HOLD · 결함→CHANGES · 설계 내 수정 불가→RTD · 결함+증거→CHANGES', () => {
  assert.equal(V(findings([])).verdict, 'APPROVE');
  assert.equal(V(findings([F({ type: 'MISSING_EVIDENCE' })])).verdict, 'HOLD_EVIDENCE');
  assert.equal(V(findings([F()])).verdict, 'CHANGES_REQUESTED');
  assert.equal(V(findings([F({ type: 'DESIGN_DRIFT', fixableInDesign: 'no', brokenPremise: '승인 전제 붕괴' })])).verdict, 'RETURN_TO_DESIGN');
  const both = V(findings([F(), F({ id: 'F2', type: 'MISSING_EVIDENCE' })]));
  assert.equal(both.verdict, 'CHANGES_REQUESTED');
  assert.deepEqual(both.defects, ['F1']);
  assert.deepEqual(both.evidence, ['F2']);
  assert.equal(V(findings([F({ type: 'FOLLOW_UP', blocking: false })])).verdict, 'APPROVE');
  assert.equal(V(findings([F({ blocking: false, type: 'DESIGN_DRIFT' })])).verdict, 'APPROVE');   // 비차단 DESIGN_DRIFT 는 판정 입력이 아니다
});

test('기계 증거 부족: 계약 미완·미복원 diff·배포본 불일치·원문 미확보는 발견이 없어도 HOLD (R5-F1·R1-F3·R4-F1)', () => {
  const c1 = baseCheck(); c1.contract.complete = false; c1.contract.incompleteLines = ['Base SHA'];
  const v1 = V(findings([]), { check: c1 });
  assert.equal(v1.verdict, 'HOLD_EVIDENCE');
  assert.ok(v1.machineEvidence.some((m) => m.id === 'M-contract-Base SHA'));
  const s2 = baseSnap(); s2.mode = 'diff-only'; s2.unrecovered = ['src/X.java'];
  assert.equal(V(findings([]), { snapshot: s2 }).verdict, 'HOLD_EVIDENCE');
  const d3 = baseDeploy(); d3.applicable = true; d3.result = '불일치'; d3.mismatches = [{ kind: 'comment_sha', path: null, detail: 'x' }];
  assert.equal(V(findings([]), { deploy: d3 }).verdict, 'HOLD_EVIDENCE');
  const c4 = baseCheck(); c4.baselineType = '문서 링크'; c4.baselineLinks = [{ kind: 'repo', status: '미확보', reason: 'x', raw: 'http://x' }];
  assert.equal(V(findings([]), { check: c4 }).verdict, 'HOLD_EVIDENCE');
  const c5 = baseCheck(); c5.contract.incompleteLines = ['Base SHA']; c5.contract.complete = false;
  assert.equal(V(findings([F()]), { check: c5 }).verdict, 'CHANGES_REQUESTED');   // 결함 + 증거 부족 → 앞 단계
  const s6 = baseSnap(); s6.mode = 'diff-only'; s6.diff_list_complete = false;    // 목록 불완전(overflow) — 파일별 복원 성공과 별개(R2-2)
  const v6 = V(findings([]), { snapshot: s6 });
  assert.equal(v6.verdict, 'HOLD_EVIDENCE');
  assert.ok(v6.machineEvidence.some((m) => m.id === 'M-diff-list'));
  const s7 = baseSnap(); s7.mode = 'worktree'; s7.diff_list_complete = false;    // 워크트리 모드는 git diff 가 정본 — 해당 없음
  assert.equal(V(findings([]), { snapshot: s7 }).verdict, 'APPROVE');
});

test('기준선 없음: 후보도 없으면 RTD · 후보가 있고 검토자가 관련 있다고 하면 통과 · 무관하면 RTD', () => {
  const c = baseCheck(); c.baselineType = '빈칸·자리표시자'; c.baselineLinks = [];
  assert.equal(V(findings([]), { check: c }).verdict, 'RETURN_TO_DESIGN');
  const c2 = { ...c, baselineCandidateFiles: ['docs/specs/x.md'] };
  assert.equal(V(findings([], { baselineCandidateRelevant: true }), { check: c2 }).verdict, 'APPROVE');
  assert.equal(V(findings([], { baselineCandidateRelevant: false }), { check: c2 }).verdict, 'RETURN_TO_DESIGN');
});

test('미해결 후보: 판정 미확정 + 두 갈래 · --resolve 로 확정 · 기각 근거 보존', () => {
  const fnd = findings([F({ unresolved: true, source: 'codex', confidence: 'low' })]);
  const u = V(fnd);
  assert.equal(u.status, 'undetermined');
  assert.equal(u.verdict, null);
  assert.deepEqual(u.unresolved, ['F1']);
  assert.deepEqual(u.branches.F1, { confirmed: 'CHANGES_REQUESTED', dismissed: 'APPROVE' });
  const r = V(findings([F({ unresolved: true })]), { resolves: { F1: 'dismissed' } });
  assert.equal(r.status, 'determined');
  assert.equal(r.verdict, 'APPROVE');
  const r2 = V(findings([F({ unresolved: true })]), { resolves: { F1: 'confirmed' } });
  assert.equal(r2.verdict, 'CHANGES_REQUESTED');
});

test('유효 검토 결과 0개 → review-failed(판정 없음, R4-F2) · 정책 ID = 계약 값, 없으면 judgeId', () => {
  const rf = V(findings([], { validReviewers: [] }));
  assert.equal(rf.status, 'review-failed');
  assert.equal(rf.verdict, null);
  assert.equal(V(findings([])).contractPolicyId, 'TEST-POLICY-v1.0');
  const c = baseCheck(); c.contract.policyId = null;
  assert.equal(V(findings([]), { check: c }).contractPolicyId, 'TEST-POLICY-v1.1');
});

function fullWork(root, { check = baseCheck(), snap = baseSnap(), deploy = baseDeploy(), fnd, verdict = true, pack = true, reviews = true, mr = {} } = {}) {
  const work = join(root, 'work');
  mkdirSync(join(work, 'baseline'), { recursive: true });
  writeFileSync(join(work, 'mr.json'), JSON.stringify({ project: { name: 'alpha', id: 101, checkout: null, deployExempt: false }, iid: 7, title: 'fix(x): y', description: '## 배경\n- ① 왜\n', web_url: 'http://gitlab.test/g/alpha/-/merge_requests/7', author: { id: 1, username: 'author-a' }, reviewers: [{ id: 2, username: 'rev-b' }], approved_by: [], diffs: [], notes: [], ...mr }));
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify(snap));
  writeFileSync(join(work, 'check.json'), JSON.stringify(check));
  writeFileSync(join(work, 'deploy.json'), JSON.stringify(deploy));
  if (pack) writeFileSync(join(work, 'pack.json'), JSON.stringify({ sources: [{ id: 'S1', kind: 'doc', ref: 'guide/policy.md@abc#5.', exportAllowed: true, inPackB: true, lines: 3 }, { id: 'S2', kind: 'wiki', ref: 'wiki-private/x.md', exportAllowed: false, inPackB: false, lines: 2 }], mask: { applied: { phone: 1 }, residual: [], ok: true }, packA: 'pack-a.md', packB: 'pack-b.md', codexSkipped: false, codexSkipReason: null }));
  if (reviews) {
    writeFileSync(join(work, 'review-claude.json'), JSON.stringify({ reviewer: 'claude', head_sha: HEAD, findings: [{ lens: 'L5', type: 'DEFECT', title: '비밀번호 평문 로그 010-1234-5678', file: 'src/A.java', line_start: 3, line_end: 3, evidence: 'S1 · src/A.java:3 db.password = "synthetic-db-password"; api_key: SYNTH-KEY-12345', scenario: '로그 유출', confidence: 'high', recommendation: '마스킹', fixableInDesign: 'yes', brokenPremise: '' }], intent: [], baselineCandidateRelevant: true }));
    writeFileSync(join(work, 'review-codex.json'), JSON.stringify({ reviewer: 'codex', head_sha: HEAD, findings: [], intent: [], baselineCandidateRelevant: true }));
  }
  if (fnd) writeFileSync(join(work, 'findings.json'), JSON.stringify(fnd));
  return work;
}

test('verdict CLI → verdict.json · render 전체 리포트(실행 블록 형식·40줄·부록·마스킹·기준선 확인 문안)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const fnd = findings([F({ title: '비밀번호 평문 로그 010-1234-5678' }), F({ id: 'F2', type: 'FOLLOW_UP', blocking: false, title: '주석 정리' }), F({ id: 'F3', type: 'MISSING_EVIDENCE', title: '회귀 결과 없음', source: 'claude' })]);
  const work = fullWork(root, { fnd });
  const rv = runCli(['verdict', '--adapter', adapter, '--work', work]);
  assert.equal(rv.code, 0, rv.out + rv.err);
  assert.equal(rv.first, 'VERDICT determined CHANGES_REQUESTED');
  const v = readJson(join(work, 'verdict.json'));
  assert.equal(v.head_sha, HEAD);
  const out = join(root, 'report.md');
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  assert.equal(rr.first, `REPORT ${out}`);
  const md = readFileSync(out, 'utf8');
  assert.match(md, new RegExp(`^리뷰 계약 TEST-POLICY-v1\\.0 · head ${HEAD} · 추천 판정\\(초안\\) CHANGES_REQUESTED$`, 'm'));
  assert.match(md, /^사람 승인 상태: 미승인 — reviewer rev-b$/m);
  const block = md.match(/```text\n([\s\S]*?)\n```/)[1];
  assert.ok(block.split('\n').length <= 40, `block lines = ${block.split('\n').length}`);
  for (const h of ['1. 의도 대조표', '2. 검증 상태', '3. 통과해야 할 테스트', '4. 차단 발견', '5. 비차단 후속']) assert.ok(block.includes(h), h);
  assert.match(block, /DEFECT — 비밀번호 평문 로그 \[masked:phone\]/);
  assert.match(block, /MISSING_EVIDENCE — 회귀 결과 없음/);
  assert.match(block, /- 주석 정리/);
  assert.match(block, /\[판독\]/);
  assert.doesNotMatch(md, /010-1234-5678/);                       // F5 — 리포트 전체 마스킹(부록 C 포함)
  assert.doesNotMatch(md, /synthetic-db-password|SYNTH-KEY-12345/); // 어댑터 mask 에 없는 비밀값 리터럴도 내장 패턴으로 제거(R2-1)
  assert.match(md, /db\.password = "\[masked:secret\]"/);
  assert.match(md, /src\/A\.java:3/);                              // 파일:줄 위치는 남는다(§5.7)
  assert.match(md, /기준선 확인 — /);                               // 경량 + 확인 댓글 없음 → 리뷰어가 먼저 게시할 문안
  assert.match(md, /기준선 미확인/);                                // 헤더 표시(F8)
  assert.match(md, /## 부록 A/);
  assert.match(md, /## 부록 B[\s\S]*wiki-private\/x\.md.*Codex 미제공/);
  assert.match(md, /## 부록 C[\s\S]*claude[\s\S]*codex/);
  assert.match(md, /## 부록 C[\s\S]*근거: S1 · src\/A\.java:3 db\.password = "\[masked:secret\]"; api_key: \[masked:secret\] · 시나리오: 로그 유출 · 설계 내 수정: yes/);   // 원본 발견의 근거·시나리오 보존(R1-9) + 비밀값만 제거
  assert.match(md, /## 부록 D[\s\S]*\*\*F1\*\*[\s\S]*실패 시나리오: 로그에 평문[\s\S]*\*\*F3\*\*/);   // 병합 발견 상세
  assert.match(md, /정책 버전: 계약 TEST-POLICY-v1\.0 \/ 판정 기준 TEST-POLICY-v1\.1/);
  assert.match(md, /교차 검토: 있음/);
});

test('--resolve 영속화: 호출을 나눠도 앞선 결정이 유지되고 리포트에 기각 근거가 남는다(R1-7) · head 불일치 verdict·findings 는 review-failed(R1-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const fnd = findings([F({ unresolved: true, source: 'codex', confidence: 'low', dismissReason: '리뷰어: 해당 로그는 테스트 전용 경로' }), F({ id: 'F2', unresolved: true, source: 'claude', confidence: 'medium', title: '널 역참조' })]);
  const work = fullWork(root, { fnd });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT undetermined -');
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=dismissed']).first, 'VERDICT undetermined -');   // F2 아직 미확정
  const persisted = readJson(join(work, 'findings.json')).findings.find((f) => f.id === 'F1');
  assert.equal(persisted.resolution, 'dismissed');
  assert.equal(persisted.unresolved, false);
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F2=confirmed']).first, 'VERDICT determined CHANGES_REQUESTED');   // F1 기각이 보존돼 F2 만으로 계산
  const out = join(root, 'r.md');
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  const md = readFileSync(out, 'utf8');
  assert.match(md, /## 리뷰어 결정\(--resolve\)[\s\S]*\*\*F1\*\* DEFECT — 비밀번호 평문 로그: 기각 · 근거: 리뷰어: 해당 로그는 테스트 전용 경로/);
  assert.match(md, /## 부록 D[\s\S]*\*\*F2\*\*[\s\S]*리뷰어 결정: confirmed/);
  const block = md.match(/```text\n([\s\S]*?)\n```/)[1];
  assert.doesNotMatch(block, /비밀번호 평문 로그/);                    // 기각된 F1 은 실행 블록에서 빠진다
  assert.match(block, /DEFECT — 널 역참조/);
  // head 불일치 — 이전 실행의 판정·검토 결과 재사용 차단
  const stale = { ...readJson(join(work, 'verdict.json')), head_sha: 'c'.repeat(40) };
  writeFileSync(join(work, 'verdict.json'), JSON.stringify(stale));
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  const md2 = readFileSync(out, 'utf8');
  assert.match(md2, /리뷰 실패[^\n]*verdict\.json 의 head ccccccc ≠ 스냅샷 head/);
  assert.doesNotMatch(md2, /^리뷰 계약 TEST-POLICY/m);
  const oldFnd = findings([F()], { head_sha: 'c'.repeat(40) });
  writeFileSync(join(work, 'findings.json'), JSON.stringify(oldFnd));
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT review-failed -');
  assert.match(readJson(join(work, 'verdict.json')).reasons[0], /findings\.json\)의 head ccccccc/);
  // verdict.json 없이 render → 리뷰 실패(블록 없음)
  const work2 = fullWork(tmp(), { fnd: findings([]) });
  const out2 = join(root, 'nv.md');
  runCli(['render', '--adapter', adapter, '--work', work2, '--out', out2]);
  assert.match(readFileSync(out2, 'utf8'), /리뷰 실패[^\n]*verdict\.json 없음/);
});

test('판정 미확정: 게시용 블록 없음 · 헤더 표시 · 리뷰어 확인 필요 절에 두 갈래 (R1-F4·R2-F4)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([F({ unresolved: true, source: 'codex', confidence: 'low' })]) });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT undetermined -');
  const out = join(root, 'r.md');
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  const md = readFileSync(out, 'utf8');
  assert.match(md, /판정 미확정 — 리뷰어 확인 필요 1건/);
  assert.doesNotMatch(md, /^리뷰 계약 TEST-POLICY/m);
  assert.match(md, /--resolve F1=confirmed/);
  assert.match(md, /확인 시 CHANGES_REQUESTED[\s\S]*기각 시 APPROVE/);
  const r2 = runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=dismissed']);
  assert.equal(r2.first, 'VERDICT determined APPROVE');
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=maybe']).code, 2);
});

test('조기 종료 리포트(--early): 초안 판정 + 보완 요청 문안 + 부록 A, 검토 절 없음', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const c = baseCheck(); c.contract.complete = false; c.contract.incompleteLines = ['Base SHA', 'Human reviewer']; c.baselineType = '빈칸·자리표시자'; c.baselineLinks = []; c.earlyExit = { would: true, reason: '기준선 없음', draftVerdict: 'RETURN_TO_DESIGN' };
  const work = fullWork(root, { check: c, pack: false, reviews: false });
  const out = join(root, 'e.md');
  const r = runCli(['render', '--adapter', adapter, '--work', work, '--early', '--out', out]);
  assert.equal(r.code, 0, r.out + r.err);
  const md = readFileSync(out, 'utf8');
  assert.match(md, /추천 판정\(초안\) RETURN_TO_DESIGN/);
  assert.match(md, /조기 종료/);
  assert.match(md, /## 작성자 보완 요청 문안[\s\S]*Base SHA[\s\S]*Human reviewer/);
  assert.match(md, /## 부록 A/);
  assert.doesNotMatch(md, /## 부록 C/);
});

test('리뷰 실패(유효 결과 0): 판정 블록 없이 실패 원인 + 결정적 검사만', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([], { validReviewers: [], crossChecked: false }), reviews: false });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT review-failed -');
  const out = join(root, 'f.md');
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  const md = readFileSync(out, 'utf8');
  assert.match(md, /리뷰 실패/);
  assert.doesNotMatch(md, /^리뷰 계약 TEST-POLICY/m);
});

test('review-validate CLI · cleanup 은 워크트리·zip·blobs·codex 원시 파일을 지우고 JSON·리포트는 남긴다 (F5·F7)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const good = join(root, 'ok.json');
  writeFileSync(good, JSON.stringify({ reviewer: 'codex', head_sha: HEAD, findings: [], intent: [], baselineCandidateRelevant: false }));
  assert.equal(runCli(['review-validate', '--file', good]).first, 'VALID');
  assert.equal(runCli(['review-validate', '--file', good, '--head', HEAD, '--reviewer', 'codex']).first, 'VALID');
  const rs = runCli(['review-validate', '--file', good, '--head', 'c'.repeat(40), '--reviewer', 'codex']);
  assert.equal(rs.code, 1);
  assert.match(rs.first, /^INVALID .*기대 head/);                                            // 이전 head 의 결과(R2-4)
  assert.match(runCli(['review-validate', '--file', good, '--head', HEAD, '--reviewer', 'claude']).first, /^INVALID .*reviewer/);
  const badf = join(root, 'bad.json');
  writeFileSync(badf, '{"reviewer":"codex"}');
  const rb = runCli(['review-validate', '--file', badf]);
  assert.equal(rb.code, 1);
  assert.match(rb.first, /^INVALID /);
  const { checkout, headSha } = initRepos(root);
  const work = join(root, 'work');
  mkdirSync(join(work, 'zip'), { recursive: true });
  mkdirSync(join(work, 'blobs', 'head'), { recursive: true });
  git(checkout, 'worktree', 'add', '--detach', join(work, 'worktree'), headSha);
  writeFileSync(join(work, 'zip', 'd.zip'), 'x');
  writeFileSync(join(work, 'blobs', 'head', 'A.java'), 'x');
  for (const f of ['codex.prompt', 'codex.out', 'codex.sh', 'codex.pid']) writeFileSync(join(work, f), 'secret token=abc');
  writeFileSync(join(work, 'mr.json'), '{}');
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify({ mode: 'worktree', checkout, worktree: join(work, 'worktree'), head_sha: headSha }));
  writeFileSync(join(work, 'verdict.json'), '{}');
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.first, 'CLEANED worktree=true zip=1 raw=4');
  assert.ok(!existsSync(join(work, 'worktree')));
  assert.ok(!existsSync(join(work, 'zip')));
  assert.ok(!existsSync(join(work, 'blobs')));
  assert.ok(!existsSync(join(work, 'codex.out')));
  assert.ok(existsSync(join(work, 'mr.json')));
  assert.ok(existsSync(join(work, 'verdict.json')));
  assert.doesNotMatch(git(checkout, 'worktree', 'list'), /work\/worktree/);
});
````

실행:

```bash
node --test tests/mr-review/report.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: tests 12 · pass 0 · fail 12.

### 2. `report.mjs`

`dev-workflow/skills/mr-review/scripts/lib/report.mjs`를 아래 내용 그대로 만든다.

````js
// report.mjs — spec §5.5-4 판정 계산(결정적) · §5.7 리포트 렌더 · F5 비밀값 제거 · F7 정리 · SC-4 검토자 출력 검증.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { applyMask } from './pack.mjs';

export class ReportError extends Error {}

export const VERDICTS = ['APPROVE', 'HOLD_EVIDENCE', 'CHANGES_REQUESTED', 'RETURN_TO_DESIGN'];
const TYPES = ['DEFECT', 'MISSING_EVIDENCE', 'DESIGN_DRIFT', 'FOLLOW_UP'];
const CONF = ['high', 'medium', 'low'];
const BLOCK_MAX_LINES = 40;
// 엔진 내장 비밀값 리터럴 패턴(프로젝트 무관 — D10 위배 아님): `password = "x"` · `api_key: x` · `secret=x` · `Bearer x` · PEM 블록. 값만 가린다.
export const SECRET_MASK = [
  { name: 'secret', pattern: '(?<=\\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|token|authorization)\\b\\s*[:=]\\s*["\'`]?)[^\\s"\'`,;)\\]]+' },
  { name: 'secret', pattern: '(?<=\\bBearer\\s+)[A-Za-z0-9._~+/=-]{8,}' },
  { name: 'secret', pattern: '-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----' },
];

const readJson = (work, name) => { const p = path.join(work, name); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const s7 = (s) => (s ? String(s).slice(0, 7) : '-');

// ── SC-4 검토자 출력 검증 ─────────────────────────────────────────────────
export function validateReview(obj, { head = null, reviewer = null } = {}) {
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['객체가 아니다'] };
  if (!['claude', 'codex'].includes(obj.reviewer)) errors.push('reviewer 는 claude|codex');
  if (!/^[0-9a-f]{40}$/.test(String(obj.head_sha || ''))) errors.push('head_sha 는 40자 SHA');
  // 기대값 대조(F6·D11) — 검토자가 이전 head 의 결과나 다른 검토자 이름을 내면 병합에서 숨겨지지 않게 여기서 떨어뜨린다
  if (head && obj.head_sha !== head) errors.push(`head_sha ${String(obj.head_sha).slice(0, 7)} ≠ 기대 head ${String(head).slice(0, 7)}(스냅샷) — 이전 head 의 검토 결과`);
  if (reviewer && obj.reviewer !== reviewer) errors.push(`reviewer ${obj.reviewer} ≠ 기대 ${reviewer}`);
  if (!Array.isArray(obj.findings)) errors.push('findings 배열 필요');
  if (!Array.isArray(obj.intent)) errors.push('intent 배열 필요');
  if (typeof obj.baselineCandidateRelevant !== 'boolean') errors.push('baselineCandidateRelevant 는 boolean');
  if (Array.isArray(obj.findings)) {
    obj.findings.forEach((f, i) => {
      if (!f || typeof f !== 'object') { errors.push(`findings[${i}] 객체 아님`); return; }
      if (!TYPES.includes(f.type)) errors.push(`findings[${i}].type 은 ${TYPES.join('|')}`);
      if (typeof f.title !== 'string' || !f.title.trim()) errors.push(`findings[${i}].title 필요`);
      if (!CONF.includes(f.confidence)) errors.push(`findings[${i}].confidence 는 high|medium|low`);
      if (!['yes', 'no'].includes(f.fixableInDesign)) errors.push(`findings[${i}].fixableInDesign 은 yes|no`);
      if ((f.type === 'DEFECT' || f.type === 'DESIGN_DRIFT') && !(typeof f.scenario === 'string' && f.scenario.trim())) errors.push(`findings[${i}].scenario 는 DEFECT·DESIGN_DRIFT 에 필수`);
    });
  }
  return { ok: errors.length === 0, errors };
}

// ── §5.5-4 판정 ───────────────────────────────────────────────────────────
export function machineEvidence({ check, snapshot, deploy }) {
  const out = [];
  for (const name of check?.contract?.incompleteLines || []) out.push({ id: `M-contract-${name}`, kind: 'contract', detail: `Review Contract 「${name}」 미완(${check.contract.lines.find((l) => l.name === name)?.status || '없음'})` });
  (snapshot?.unrecovered || []).forEach((p, i) => out.push({ id: `M-diff-${i + 1}`, kind: 'diff', detail: `복원하지 못한 diff: ${p} (diff-only — 로컬 clone 권장)` }));
  if (snapshot?.mode === 'diff-only' && snapshot.diff_list_complete === false) out.push({ id: 'M-diff-list', kind: 'diff', detail: '변경 파일 목록 불완전(API overflow — 파일 항목이 통째로 빠졌을 수 있음, 검토 범위·배포 목록 축소) — 로컬 clone 권장' });
  if (deploy?.applicable && deploy.result !== '일치') out.push({ id: 'M-deploy', kind: 'deploy', detail: `배포본 ${deploy.result}${deploy.mismatches?.length ? ' — ' + deploy.mismatches.map((m) => m.kind + (m.path ? `(${m.path})` : '')).join(', ') : ''}` });
  (check?.baselineLinks || []).forEach((l, i) => { if (l.status === '미확보') out.push({ id: `M-baseline-${i + 1}`, kind: 'baseline', detail: `기준선·이슈 원문 미확보: ${l.raw || l.kind} — ${l.reason || ''}` }); });
  return out;
}

export function computeVerdict({ check, snapshot, deploy, findings, resolves = {}, judgeId }) {
  const contractPolicyId = check?.contract?.policyId || judgeId;
  const base = { contractPolicyId, judgeId, head_sha: snapshot?.head_sha || null, defects: [], evidence: [], unresolved: [], baselineMissing: false, returnToDesignBy: [], branches: {}, machineEvidence: [], reasons: [] };
  if (!findings || !Array.isArray(findings.validReviewers) || findings.validReviewers.length === 0) {
    return { ...base, status: 'review-failed', verdict: null, reasons: ['완료되고 스키마를 통과한 검토 결과가 0개 — 판정을 만들지 않는다(§5.4)'] };
  }
  if (findings.head_sha && snapshot?.head_sha && findings.head_sha !== snapshot.head_sha) {
    return { ...base, status: 'review-failed', verdict: null, reasons: [`병합 발견(findings.json)의 head ${s7(findings.head_sha)} ≠ 스냅샷 head ${s7(snapshot.head_sha)} — 이전 실행의 검토 결과로는 판정을 만들지 않는다(F6)`] };
  }
  const list = (findings.findings || []).map((f) => ({ ...f }));
  for (const f of list) {
    const r = resolves[f.id];
    if (r !== undefined) {
      if (!['confirmed', 'dismissed'].includes(r)) throw new ReportError(`--resolve ${f.id}=${r}: confirmed|dismissed 만 허용`);
      f.resolution = r;
      f.unresolved = false;
    }
  }
  const typeMissing = check?.baselineType === '빈칸·자리표시자' || check?.baselineType === '칸 없음';
  const baselineMissing = typeMissing && ((check?.baselineCandidateFiles || []).length === 0 || findings.baselineCandidateRelevant !== true);
  const machine = machineEvidence({ check, snapshot, deploy });
  const calc = (assume) => {
    const active = list.filter((f) => f.blocking === true && (f.resolution ?? assume[f.id] ?? 'confirmed') !== 'dismissed');
    const defects = active.filter((f) => f.type === 'DEFECT' || f.type === 'DESIGN_DRIFT');
    const evidence = active.filter((f) => f.type === 'MISSING_EVIDENCE');
    const rtd = defects.filter((f) => f.fixableInDesign === 'no');
    let verdict;
    if (baselineMissing || rtd.length) verdict = 'RETURN_TO_DESIGN';
    else if (defects.length) verdict = 'CHANGES_REQUESTED';
    else if (evidence.length + machine.length) verdict = 'HOLD_EVIDENCE';
    else verdict = 'APPROVE';
    return { verdict, defects: defects.map((f) => f.id), evidence: [...evidence.map((f) => f.id), ...machine.map((m) => m.id)], rtd: rtd.map((f) => f.id) };
  };
  const unresolved = list.filter((f) => f.unresolved === true && !f.resolution).map((f) => f.id);
  if (unresolved.length) {
    const branches = {};
    for (const id of unresolved) branches[id] = { confirmed: calc({ [id]: 'confirmed' }).verdict, dismissed: calc({ [id]: 'dismissed' }).verdict };
    return { ...base, status: 'undetermined', verdict: null, unresolved, baselineMissing, branches, machineEvidence: machine, reasons: [`미해결 차단 후보 ${unresolved.length}건 — 리뷰어가 --resolve 로 확인·기각하기 전에는 판정을 계산하지 않는다(§5.5-2)`] };
  }
  const c = calc({});
  const reasons = [];
  if (baselineMissing) reasons.push('승인된 기준선 없음(후보 문서 없음 또는 무관)');
  if (c.rtd.length) reasons.push(`현 설계 안에서 안전하게 수정 불가: ${c.rtd.join(', ')}`);
  if (c.defects.length) reasons.push(`결함 집합 ${c.defects.length}건`);
  if (c.evidence.length) reasons.push(`증거 부족 집합 ${c.evidence.length}건(기계 ${machine.length})`);
  if (!reasons.length) reasons.push('차단 발견 없음 + 필수 증거 충분');
  return { ...base, status: 'determined', verdict: c.verdict, defects: c.defects, evidence: c.evidence, unresolved: [], baselineMissing, returnToDesignBy: c.rtd, branches: {}, machineEvidence: machine, reasons };
}

// ── §5.7 렌더 ─────────────────────────────────────────────────────────────
function approvalLine(mr) {
  if ((mr.approved_by || []).length) return `승인 — ${mr.approved_by.join(', ')}`;
  if ((mr.reviewers || []).length) return `미승인 — reviewer ${mr.reviewers.map((r) => r.username).join(', ')}`;
  return '미확인';
}

function executionBlock({ verdict, mr, snapshot, check, deploy, findings, pack }) {
  const fnd = findings?.findings || [];
  const byId = Object.fromEntries(fnd.map((f) => [f.id, f]));
  const models = findings?.validReviewers?.length ? findings.validReviewers.join(', ') : '-';
  const lines = [];
  lines.push(`리뷰 계약 ${verdict.contractPolicyId} · head ${snapshot.head_sha} · 추천 판정(초안) ${verdict.verdict}`);
  lines.push(`사람 승인 상태: ${approvalLine(mr)}`);
  lines.push('');
  lines.push('1. 의도 대조표');
  const intent = findings?.intent || [];
  const rows = intent.map((i) => `| ${i.criterion} | ${i.result} | ${i.location || '-'} (${i.basis || '작성자 주장'}) |`);
  lines.push('| 수용기준·MR 주장 | 결과 | 코드 위치 |', '|---|---|---|');
  if (!rows.length) lines.push('| (검증 표 없음) | UNKNOWN | - |');
  const rowStart = lines.length;
  lines.push(...rows);
  lines.push('2. 검증 상태');
  lines.push(`- [판독] base..head diff·변경 파일 전문 — head ${s7(snapshot.head_sha)} (돈 모델: ${models}${findings?.crossChecked ? '' : ' · 교차 검토 없음'})`);
  lines.push(deploy?.applicable ? `- [실행] 배포본 zip 대조(스킬 직접 수행): ${deploy.result}${deploy.mismatches?.length ? ' — ' + deploy.mismatches.map((m) => m.kind + (m.path ? `(${m.path})` : '')).join(', ') : ''}` : '- 배포본: 비해당(운영 배포 대상 변경 없음)');
  lines.push('- [다른 주체 제공] 작성자 검증 표 결과 — 작성자 주장(이 스킬은 테스트·빌드를 실행하지 않는다)');
  lines.push('3. 통과해야 할 테스트');
  const evidenceItems = verdict.evidence.map((id) => byId[id] ? `${byId[id].title}` : (verdict.machineEvidence.find((m) => m.id === id)?.detail || id));
  lines.push(evidenceItems.length ? `- 머지 전: ${evidenceItems.map((t) => `[ ] ${t}`).join(' · ')}` : '- 머지 전: 없음');
  lines.push('- 배포 후: —(릴리즈 게이트 이관)');
  lines.push('4. 차단 발견');
  const blockingLines = [];
  for (const id of verdict.defects) { const f = byId[id]; if (f) blockingLines.push(`- ${f.type} — ${f.title} (${f.file || '-'}${f.line_start ? `:${f.line_start}` : ''}) · ${f.recommendation || ''}`.trim()); }
  for (const id of verdict.evidence) { const f = byId[id]; if (f) blockingLines.push(`- MISSING_EVIDENCE — ${f.title} (${f.file || '-'}) · ${f.recommendation || ''}`.trim()); else { const m = verdict.machineEvidence.find((x) => x.id === id); if (m) blockingLines.push(`- MISSING_EVIDENCE — ${m.detail}`); } }
  lines.push(...(blockingLines.length ? blockingLines : ['- 없음']));
  lines.push('5. 비차단 후속');
  const fu = fnd.filter((f) => f.type === 'FOLLOW_UP' || (f.blocking === false && f.resolution !== 'dismissed' && f.type !== 'MISSING_EVIDENCE' && f.type !== 'DEFECT'));
  lines.push(...(fu.length ? fu.map((f) => `- ${f.title}`) : ['- 없음']));
  if (lines.length > BLOCK_MAX_LINES && rows.length > 6) {
    const over = rows.length - 6;
    lines.splice(rowStart + 6, over, `| … 외 ${over}건 — 부록 A | - | - |`);
  }
  if (lines.length > BLOCK_MAX_LINES) lines.push('(40줄 초과 — 차단 발견은 생략하지 않았고 상세는 부록 참조)');
  return lines.join('\n');
}

function confirmLiteral(adapter) {
  return adapter.comments.baselineConfirm.replace(/[\^$\\]/g, '').replace(/\(.*?\)|\[.*?\]|[+*?]/g, '').trim() || '기준선 확인';
}

function supplementRequests({ check, snapshot, deploy }) {
  const items = [];
  for (const n of check.contract?.incompleteLines || []) items.push(`Review Contract 「${n}」 줄을 실제 값으로 채워 주세요(자리표시자·빈칸 불가).`);
  if (check.baselineType === '빈칸·자리표시자' || check.baselineType === '칸 없음') items.push('Baseline 칸에 이 변경을 승인한 근거(이슈·spec·결정 기록 링크 또는 「MR 본문 「배경」」)를 적어 주세요.');
  if (!check.reason?.why) items.push('「배경」에 ① 왜(관찰한 현상·요청 근거)를 적어 주세요.');
  if (!check.reason?.what) items.push('「배경」에 ② 무엇을(원인·수정 위치·적용 범위)을 적어 주세요.');
  if (check.attachmentClaimedButMissing) items.push('「배포본」에 첨부했다고 적혀 있지만 업로드 링크가 없습니다 — zip 을 첨부해 주세요.');
  if (deploy?.applicable && deploy.result !== '일치') items.push(`배포본 대조 결과 「${deploy.result}」${deploy.mismatches?.length ? ' — ' + deploy.mismatches.map((m) => m.detail).join(' / ') : ''}. 최신 head 기준으로 zip·삭제 목록을 다시 만들어 주세요.`);
  for (const l of check.baselineLinks || []) if (l.status === '미확보') items.push(`Baseline 원문을 받을 수 없습니다(${l.raw || l.kind}: ${l.reason}). 접근 가능한 링크로 바꿔 주세요.`);
  if (check.rebase?.need) items.push('대상 브랜치와 충돌·리베이스가 필요합니다(need_rebase). 리베이스 뒤 Base SHA·Review head SHA 를 갱신해 주세요.');
  if (check.reviewerMismatch) items.push('Human reviewer 줄이 MR 의 Reviewer 와 다릅니다 — 같은 GitLab username 으로 맞춰 주세요.');
  if ((snapshot?.unrecovered || []).length) items.push(`잘린 diff 를 복원하지 못한 파일 ${snapshot.unrecovered.length}건 — 리뷰어가 로컬 clone 으로 다시 돌립니다(작성자 조치 불필요).`);
  return items;
}

function checkTable(check, deploy) {
  const rows = [];
  for (const l of check.contract?.lines || []) rows.push(`| 계약 · ${l.name} | ${l.status} |`);
  rows.push(`| 트랙 | ${check.track} |`);
  rows.push(`| 기준선 확인 댓글 | ${check.baselineConfirm?.status}${check.baselineConfirm?.status === '낡음' ? `(본문 변경 ${check.baselineConfirm.changed_at})` : ''} |`);
  rows.push(`| Baseline 유형 | ${check.baselineType} |`);
  rows.push(`| 변경 사유 ①② | ①${check.reason?.why ? '있음' : '없음'} ②${check.reason?.what ? '있음' : '없음'} (${check.reason?.source}) |`);
  rows.push(`| 변경 파일 속 문서(후보) | ${(check.baselineCandidateFiles || []).join(', ') || '없음'} |`);
  rows.push(`| 첨부 | ${(check.attachments || []).map((a) => `${a.kind}:${a.filename}`).join(', ') || '없음'}${check.attachmentClaimedButMissing ? ' · **첨부 누락**' : ''} |`);
  rows.push(`| 배포본 | ${check.deployExempt ? '제외 프로젝트' : check.deployRequired ? `필수(${check.deployNote || '표기 없음'})` : '비해당'} → ${deploy ? deploy.result : '-'} |`);
  rows.push(`| 리베이스 | ${check.rebase?.need ? '필요' : '불필요'} (${check.rebase?.detailed_merge_status || '-'}) |`);
  rows.push(`| reviewer 불일치 | ${check.reviewerMismatch ? '예' : '아니오'} |`);
  rows.push(`| 이전 판정(신뢰) | ${(check.priorVerdicts || []).filter((v) => v.trusted).map((v) => `#${v.note_id} ${v.verdict}@${s7(v.sha)}`).join(', ') || '없음'} |`);
  rows.push(`| 무시한 댓글 | ${(check.ignoredComments || []).map((c) => `#${c.note_id}(${c.reason})`).join(', ') || '없음'} |`);
  return ['| 검사 | 판정값 |', '|---|---|', ...rows].join('\n');
}

export function renderReport({ adapter, work, early = false }) {
  const mr = readJson(work, 'mr.json');
  const snapshot = readJson(work, 'snapshot.json');
  const check = readJson(work, 'check.json');
  if (!mr || !snapshot || !check) throw new ReportError('mr.json·snapshot.json·check.json 이 필요하다(collect·check 먼저)');
  const deploy = readJson(work, 'deploy.json');
  const pack = readJson(work, 'pack.json');
  const findings = early ? null : readJson(work, 'findings.json');
  let verdict = early ? null : readJson(work, 'verdict.json');
  // 판정 입력의 head 일치 검증 — 같은 work 에 남은 이전 실행의 verdict.json·findings.json 을 현재 head 의 판정으로 쓰지 않는다(F6). 비-early 인데 verdict 가 없으면 리뷰 실패로 렌더한다(판정 블록 없음).
  const failed = (reason) => ({ status: 'review-failed', verdict: null, reasons: [reason], unresolved: [], branches: {}, defects: [], evidence: [], machineEvidence: [], contractPolicyId: check.contract?.policyId || adapter.policy.judgeId, head_sha: snapshot.head_sha });
  if (!early) {
    if (!verdict) verdict = failed('verdict.json 없음 — verdict 를 실행하지 않았다(검토 결과 0개 경로에서도 verdict 를 실행한다)');
    else if (verdict.head_sha !== snapshot.head_sha) verdict = failed(`verdict.json 의 head ${s7(verdict.head_sha)} ≠ 스냅샷 head ${s7(snapshot.head_sha)} — 이전 실행의 판정은 쓰지 않는다(verdict 를 다시 실행)`);
    else if (findings?.head_sha && findings.head_sha !== snapshot.head_sha) verdict = failed(`findings.json 의 head ${s7(findings.head_sha)} ≠ 스냅샷 head ${s7(snapshot.head_sha)} — 이전 실행의 검토 결과는 쓰지 않는다`);
  }
  const adapterId = `${path.basename(adapter.file)}@${createHash('sha1').update(adapter.markdown).digest('hex').slice(0, 8)}`;
  const mode = early ? '조기 종료(결정적 검사만)' : `${check.rereview?.active ? '재리뷰' : '전체'}${snapshot.mode === 'diff-only' ? ' · diff-only' : ''}`;
  const models = findings?.validReviewers?.length ? findings.validReviewers.join(', ') : '-';
  const header = [
    `# mr-review 리포트 — ${mr.project.name} !${mr.iid} head ${s7(snapshot.head_sha)}`,
    '',
    `- MR: ${mr.title} · ${mr.web_url || ''}`,
    `- 리뷰 모드: ${mode} · 돈 모델: ${models} · 교차 검토: ${findings?.crossChecked ? '있음' : '없음'}${pack?.codexSkipped ? ` (Codex 생략 — ${pack.codexSkipReason})` : ''}`,
    `- SHA: head ${snapshot.head_sha} · base ${snapshot.base_sha} · target ${snapshot.target_sha}${snapshot.mode === 'diff-only' && snapshot.unrecovered?.length ? ` · **불완전 diff-only 리뷰** — 미복원 ${snapshot.unrecovered.join(', ')}` : ''}`,
    `- 어댑터: ${adapterId} · 정책 버전: 계약 ${check.contract?.policyId || '(없음)'} / 판정 기준 ${adapter.policy.judgeId}`,
  ];
  if (check.track === '경량' && (check.baselineConfirm?.status === '없음' || check.baselineConfirm?.status === '낡음')) header.push(`- **기준선 미확인**(${check.baselineConfirm.status}) — 아래 확인 문안을 먼저 게시한 뒤 판정을 게시`);
  if (check.rereview?.active) header.push(`- 재리뷰: 이전 판정 ${check.rereview.prior_verdict} @ ${s7(check.rereview.prior_head)} (댓글 #${check.rereview.prior_note_id})`);
  if (verdict?.status === 'undetermined') header.push(`- **판정 미확정 — 리뷰어 확인 필요 ${verdict.unresolved.length}건**`);
  if (verdict?.status === 'review-failed') header.push(`- **리뷰 실패** — ${verdict.reasons?.[0] || '유효한 검토 결과 0개'}. 게시용 판정 블록을 만들지 않는다`);
  if ((findings?.outsideWorktreePaths || []).length) header.push(`- **격리 위반 의심** — Codex 가 워크트리 밖을 읽었을 수 있음: ${findings.outsideWorktreePaths.join(', ')}`);
  if (early) header.push(`- **조기 종료** — ${check.earlyExit?.reason}`);

  const parts = [header.join('\n'), ''];
  parts.push('## 판정 초안 — 정책 실행 블록(복사해 게시)');
  if (early) {
    parts.push('```text', `리뷰 계약 ${check.contract?.policyId || adapter.policy.judgeId} · head ${snapshot.head_sha} · 추천 판정(초안) ${check.earlyExit?.draftVerdict}`, `사람 승인 상태: ${approvalLine(mr)}`, '', '1. 의도 대조표', '| 수용기준·MR 주장 | 결과 | 코드 위치 |', '|---|---|---|', '| (검토 전 조기 종료) | UNKNOWN | - |', '2. 검증 상태', '- [없음] 작성 규칙 미충족으로 검토를 시작하지 않음', '3. 통과해야 할 테스트', '- 머지 전: [ ] 아래 보완 요청 문안 해소', '4. 차단 발견', `- MISSING_EVIDENCE — ${check.earlyExit?.reason}`, '5. 비차단 후속', '- 없음', '```');
  } else if (!verdict || verdict.status !== 'determined') {
    parts.push(verdict?.status === 'review-failed' ? '(리뷰 실패 — 블록 없음)' : `(리뷰어 확인 후 \`verdict --resolve <id>=confirmed|dismissed\` 로 생성)`);
  } else {
    parts.push('```text', executionBlock({ verdict, mr, snapshot, check, deploy, findings, pack }), '```');
  }
  parts.push('');
  if (check.track === '경량' && (check.baselineConfirm?.status === '없음' || check.baselineConfirm?.status === '낡음')) {
    parts.push('## 리뷰어가 먼저 게시할 기준선 확인 문안', '', '```text', `${confirmLiteral(adapter)} — 배경 ①②(③)·검증 표 수용기준 동의 (head ${s7(snapshot.head_sha)})${check.baselineConfirm.status === '낡음' ? ` — 본문이 ${check.baselineConfirm.changed_at} 에 바뀌어 재확인` : ''}`, '```', '');
  }
  const sup = supplementRequests({ check, snapshot, deploy });
  if (sup.length) parts.push('## 작성자 보완 요청 문안', '', ...sup.map((s) => `- ${s}`), '');
  if (verdict?.status === 'undetermined') {
    parts.push('## 리뷰어 확인 필요', '');
    for (const id of verdict.unresolved) {
      const f = (findings?.findings || []).find((x) => x.id === id);
      const b = verdict.branches[id];
      parts.push(`- **${id}** ${f?.type} — ${f?.title} (${f?.file || '-'}:${f?.line_start || '-'} · 출처 ${f?.source} · 확신 ${f?.confidence})`, `  - 주장: ${f?.scenario || f?.evidence || ''}`, `  - 확인 시 ${b.confirmed} / 기각 시 ${b.dismissed}`, `  - 실행: \`verdict --resolve ${id}=confirmed\` 또는 \`--resolve ${id}=dismissed\``);
    }
    parts.push('');
  }
  if (verdict?.status === 'review-failed') parts.push('## 리뷰 실패', '', ...verdict.reasons.map((r) => `- ${r}`), '');
  const resolved = (findings?.findings || []).filter((f) => f.resolution === 'confirmed' || f.resolution === 'dismissed');
  if (resolved.length) {
    parts.push('## 리뷰어 결정(--resolve)', '');
    for (const f of resolved) parts.push(`- **${f.id}** ${f.type} — ${f.title}: ${f.resolution === 'confirmed' ? '확인(차단 유지)' : '기각'}${f.dismissReason ? ` · 근거: ${f.dismissReason}` : ''}`);
    parts.push('');
  }
  parts.push('## 부록 A — 작성 규칙 검사표 · 배포본 대조', '', checkTable(check, deploy), '');
  if (deploy?.applicable) parts.push(`기대 배포 목록 ${deploy.expected.deploy.length}건 · 삭제 목록 ${deploy.expected.deleted.length}건 · zip ${deploy.zip.attachment || '없음'}(주석 ${deploy.zip.comment_sha ? s7(deploy.zip.comment_sha) : '-'})${deploy.mismatches.length ? '\n' + deploy.mismatches.map((m) => `- ${m.kind}${m.path ? ` ${m.path}` : ''}: ${m.detail}`).join('\n') : ''}`, '');
  if (!early) {
    parts.push('## 부록 B — 근거 출처', '');
    parts.push(...((pack?.sources || []).map((s) => `- [${s.id}] ${s.kind} · ${s.ref}${s.inPackB ? '' : ' · (Codex 미제공)'}`)), '');
    parts.push('## 부록 C — 모델별 원본 발견(합치기 전)', '');
    for (const name of ['claude', 'codex']) {
      const r = readJson(work, `review-${name}.json`);
      parts.push(`### ${name}`, '');
      if (!r) { parts.push('(없음)', ''); continue; }
      // §5.7 원본 발견 보존 — 근거·실패 시나리오·설계 내 수정 가능 여부·깨진 전제까지(마스킹은 아래 전체 적용)
      parts.push(...((r.findings || []).map((f) => `- [${f.lens}] ${f.type} — ${f.title} (${f.file || '-'}:${f.line_start || '-'}) · 확신 ${f.confidence} · 근거: ${f.evidence || '-'} · 시나리오: ${f.scenario || '-'} · 설계 내 수정: ${f.fixableInDesign || '-'}${f.fixableInDesign === 'no' ? ` · 깨진 전제: ${f.brokenPremise || '-'}` : ''} · 권고: ${f.recommendation || ''}`)), (r.findings || []).length ? '' : '(발견 없음)', '');
    }
    // 부록 D — 병합 발견 상세: 실행 블록(40줄)이 생략한 근거·시나리오·전제·리뷰어 결정을 발견마다 보존한다(사람이 차단 판단을 검증할 수 있게)
    parts.push('## 부록 D — 병합 발견 상세 · 리뷰어 결정', '');
    const merged = findings?.findings || [];
    if (!merged.length) parts.push('(발견 없음)', '');
    for (const f of merged) {
      parts.push(`- **${f.id}** [${f.lens}] ${f.type}${f.blocking ? ' (차단)' : ''} — ${f.title} (${f.file || '-'}:${f.line_start || '-'}) · 출처 ${f.source} · 확신 ${f.confidence}`,
        `  - 근거: ${f.evidence || '-'}`, `  - 실패 시나리오: ${f.scenario || '-'}`, `  - 설계 내 수정 가능: ${f.fixableInDesign || '-'}${f.fixableInDesign === 'no' ? ` · 깨진 전제: ${f.brokenPremise || '-'}` : ''}`,
        `  - 권고: ${f.recommendation || '-'}`,
        `  - 리뷰어 결정: ${f.resolution ? `${f.resolution}${f.dismissReason ? ` · 근거: ${f.dismissReason}` : ''}` : (f.unresolved ? '미확정(리뷰어 확인 필요)' : '-')}`);
    }
    parts.push('');
  }
  const text = parts.join('\n');
  // F5 — 산출물 전체 비밀값 제거: 어댑터 개인정보 패턴 + 엔진 내장 비밀값 리터럴 패턴(§5.7 「하드코딩 비밀값은 [masked:secret] <파일:줄>로만」 — 어댑터 mask 에 비밀번호·API 키 패턴이 없어도 적용)
  return applyMask(applyMask(text, adapter.mask).text, SECRET_MASK).text;
}

// ── 정리(F7·F5) ───────────────────────────────────────────────────────────
export function cleanup({ work }) {
  const snapshot = readJson(work, 'snapshot.json') || {};
  let worktree = false;
  const wt = snapshot.worktree || path.join(work, 'worktree');
  if (fs.existsSync(wt)) {
    if (snapshot.checkout) spawnSync('git', ['-C', snapshot.checkout, 'worktree', 'remove', '--force', wt], { encoding: 'utf8' });
    fs.rmSync(wt, { recursive: true, force: true });
    if (snapshot.checkout) spawnSync('git', ['-C', snapshot.checkout, 'worktree', 'prune'], { encoding: 'utf8' });
    worktree = true;
  }
  let zip = 0;
  const zipDir = path.join(work, 'zip');
  if (fs.existsSync(zipDir)) { zip = fs.readdirSync(zipDir).length; fs.rmSync(zipDir, { recursive: true, force: true }); }
  fs.rmSync(path.join(work, 'blobs'), { recursive: true, force: true });
  let raw = 0;
  for (const f of ['codex.prompt', 'codex.out', 'codex.sh', 'codex.pid']) { const p = path.join(work, f); if (fs.existsSync(p)) { fs.rmSync(p); raw += 1; } }
  return { worktree, zip, raw };
}

// ── CLI 핸들러 ────────────────────────────────────────────────────────────
export async function cmdReviewValidate(args) {
  if (!args.file) throw new ReportError('--file <검토자 출력 JSON> 이 필요하다');
  let obj;
  try { obj = JSON.parse(fs.readFileSync(args.file, 'utf8')); } catch (e) { const err = new Error(`INVALID JSON 파싱 실패: ${e.message}`); err.code = 1; err.plain = true; throw err; }
  const r = validateReview(obj, { head: typeof args.head === 'string' ? args.head : null, reviewer: typeof args.reviewer === 'string' ? args.reviewer : null });
  if (r.ok) return 'VALID';
  const err = new Error(`INVALID ${r.errors.join('; ')}`);
  err.code = 1;
  err.plain = true;
  throw err;
}

export async function cmdVerdict(args, ctx) {
  const check = readJson(ctx.work, 'check.json');
  const snapshot = readJson(ctx.work, 'snapshot.json');
  const deploy = readJson(ctx.work, 'deploy.json');
  const findings = readJson(ctx.work, 'findings.json');
  if (!check || !snapshot) throw new ReportError('check.json·snapshot.json 이 필요하다');
  if (!findings) throw new ReportError('findings.json 이 없다 — 메인이 두 검토자 결과를 병합해 먼저 써야 한다(SC-5)');
  const resolves = {};
  for (const r of args.resolve || []) { const m = String(r).match(/^([^=]+)=(.+)$/); if (!m) throw new ReportError(`--resolve 형식: <id>=confirmed|dismissed (${r})`); resolves[m[1]] = m[2]; }
  const v = computeVerdict({ check, snapshot, deploy, findings, resolves, judgeId: ctx.adapter.policy.judgeId });
  // --resolve 결정은 findings.json 에 영속화한다 — 다음 호출(다른 후보의 --resolve·render)이 같은 결정을 다시 쓴다. 기각 근거(dismissReason)는 메인이 미리 적어 둔 값이 그대로 남는다.
  if (Object.keys(resolves).length) {
    let touched = false;
    for (const f of findings.findings || []) { const r = resolves[f.id]; if (r !== undefined) { f.resolution = r; f.unresolved = false; touched = true; } }
    if (touched) fs.writeFileSync(path.join(ctx.work, 'findings.json'), JSON.stringify(findings, null, 2));
  }
  fs.writeFileSync(path.join(ctx.work, 'verdict.json'), JSON.stringify(v, null, 2));
  return `VERDICT ${v.status} ${v.verdict || '-'}`;
}

export async function cmdRender(args, ctx) {
  const text = renderReport({ adapter: ctx.adapter, work: ctx.work, early: args.early === true });
  let out = args.out;
  if (!out) {
    const mr = readJson(ctx.work, 'mr.json');
    const snapshot = readJson(ctx.work, 'snapshot.json');
    out = path.join(ctx.adapter.resolved.reportDir, `${mr.project.name}-${mr.iid}-${s7(snapshot.head_sha)}.md`);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  return `REPORT ${out}`;
}

export async function cmdCleanup(args, ctx) {
  const r = cleanup({ work: ctx.work });
  return `CLEANED worktree=${r.worktree} zip=${r.zip} raw=${r.raw}`;
}
````

### 3. CLI 등록 — `review-validate`는 `ERR` 접두 없이 `INVALID …` exit 1(SC-6)

`mr-review.mjs`에 import 추가 · `COMMANDS`의 `// task-06: …` 줄을 바꾼다:

```js
import { cmdReviewValidate, cmdVerdict, cmdRender, cmdCleanup } from './lib/report.mjs';
```
```js
  'review-validate': cmdReviewValidate,
  verdict: cmdVerdict,
  render: cmdRender,
  cleanup: cmdCleanup,
```

파일 끝 `.catch` 블록을 아래로 바꾼다(`plain` 오류는 `ERR` 접두 없이 메시지 그대로):

```js
}).catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  process.stdout.write(e?.plain ? `${msg}\n` : `ERR ${msg}\n`);
  process.exitCode = Number.isInteger(e?.code) && e.code > 0 && e.code < 256 ? e.code : 2;
  if (!(e instanceof CliError) && !(e instanceof AdapterError) && !e?.plain && !Number.isInteger(e?.code)) process.stderr.write(`${e?.stack ?? ''}\n`);
});
```

### 4. GREEN 확인 · 커밋

```bash
node --test tests/mr-review/report.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
node --test tests/mr-review/adapter.test.mjs tests/mr-review/collect.test.mjs tests/mr-review/check.test.mjs tests/mr-review/deploy.test.mjs tests/mr-review/pack.test.mjs tests/mr-review/report.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
for f in dev-workflow/skills/mr-review/scripts/mr-review.mjs dev-workflow/skills/mr-review/scripts/lib/*.mjs; do node --check "$f" || echo "CHECK_FAIL $f"; done; echo CHECK_DONE
```

기대: report 12/12 · 전체 52/52 · `CHECK_DONE`만.

```bash
git add dev-workflow/skills/mr-review/scripts/lib/report.mjs dev-workflow/skills/mr-review/scripts/mr-review.mjs tests/mr-review/report.test.mjs
git commit -m "feat(mr-review): verdict·render·cleanup·review-validate — 두 집합 판정 순서, 기계 증거 부족 자동 투입, 판정 미확정·--resolve, §8.1 블록 렌더·비밀값 제거·정리 (spec §5.5, §5.7, F3·F5·F7·F8)"
```

## Acceptance Criteria

- `node --test tests/mr-review/report.test.mjs` → 12/12, 전체 52/52.
- 판정은 정책 4종만(D9) · 미해결 후보가 있으면 게시용 블록을 만들지 않고 헤더에 「판정 미확정」(R1-F4·R2-F4) · 발견 0건이어도 계약 미완·미복원 diff·배포본 불일치·원문 미확보면 `HOLD_EVIDENCE`(R5-F1·R1-F3·R4-F1·R4-F3) · 유효 검토 0개면 블록 없음(R4-F2) · 리포트 전체에 마스킹 패턴 잔존 0(F5) · `cleanup` 뒤 워크트리·zip·blobs·codex 원시 파일 없음(F7).
- `--resolve` 결정이 `findings.json`에 영속돼 호출을 나눠도 유지되고 리포트 「리뷰어 결정」·부록 D에 근거가 남는다(plan R1-7) · `verdict.json`·`findings.json`의 head가 `snapshot.head_sha`와 다르면 판정 블록 없이 리뷰 실패, 비-early에서 `verdict.json` 부재도 리뷰 실패(plan R1-1) · 부록 C·D에 근거·시나리오·깨진 전제 보존(plan R1-9).

## Cautions

- **판정 값을 4종 밖으로 만들지 마라(「보류」 등). 이유:** D9·R2-F4 — 미확정은 `status`로만 표현하고 블록을 비운다.
- **`MISSING_EVIDENCE`를 결함 집합에 넣지 마라. 이유:** §5.5-4 집합 분리(R4-F3) — 결함이 함께 있으면 `CHANGES_REQUESTED`, 증거 부족만이면 `HOLD_EVIDENCE`.
- **`--full`이나 조기 종료 여부로 기계 증거 투입을 끄지 마라. 이유:** R5-F1 — `--full`은 검토 범위만 넓힌다.
- **리포트 마스킹은 마지막에 전체 텍스트에 한 번. 절별로 빼먹지 마라. 이유:** 부록 C(모델 원문)가 비밀값 누출의 전형(R2-F3).
- **어댑터 `mask`(개인정보)와 별도로 엔진 내장 `SECRET_MASK`(비밀번호·API 키·토큰·Bearer·PEM 값)를 리포트 전체에 적용하라. 이유:** plan R2-1 — 어댑터 패턴은 개인정보용이라 L5 발견이 인용한 `password = "…"` 리터럴이 부록 C·D에 그대로 남는다(§5.7 `[masked:secret] <파일:줄>` 계약·F5). 파일:줄은 남긴다.
- **`review-validate`에 `--head`·`--reviewer`를 받아 원본 결과의 head·검토자 일치를 검사하라. 이유:** plan R2-4 — 형식만 보면 이전 head 의 검토 결과가 VALID 로 통과하고, 병합에서 `findings.head_sha`를 새로 적으면 후속 대조가 그것을 못 잡는다.
- **`review-validate`는 `ERR` 접두 없이 `INVALID …` exit 1. 이유:** SC-6 — SKILL이 `VALID`/`INVALID`만 본다.
- **`cleanup`은 JSON·리포트·`baseline/`을 지우지 않는다. 이유:** 재리뷰 입력(§5.6)·`--resolve` 재계산 입력이다.
- **`--resolve` 결정은 `findings.json`에 써서 영속화한다 — `verdict.json`에만 두지 마라. 이유:** R1-7 — 후보를 호출을 나눠 해결하면 앞선 결정이 사라진다. 기각 근거는 리포트 「리뷰어 결정」·부록 D에 남는다(§5.5-2).
- **`render`·`verdict`는 입력의 head 일치를 검증한다(`verdict.json`·`findings.json` ↔ `snapshot.json`). 이유:** R1-1·F6 — 같은 `W`에 남은 이전 실행의 APPROVE가 현재 head 의 판정으로 게시된다. 비-early에서 `verdict.json`이 없으면 리뷰 실패로 렌더한다.
- **부록 C·D에 근거·실패 시나리오·설계 내 수정 가능 여부·깨진 전제를 남겨라(마스킹은 전체 적용 뒤). 이유:** R1-9·§5.7 — 실행 블록 40줄은 제목만 담으므로, 사람이 차단 판단을 검증할 근거가 리포트 밖에 없다.
