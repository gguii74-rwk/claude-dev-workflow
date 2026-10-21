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
- task-05 산출물 `maskText`·`maskTextWithCounts`·`SECRET_MASK`(엔진 마스킹 정본 — 팩 B·리포트·cleanup 공유, plan R6-1).

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
import { spawn } from 'node:child_process';
import { tmp, writeAdapter, initRepos, runCli, readJson, git, LIB } from './helpers.mjs';

const { computeVerdict, validateReview, maskText: deepMaskText } = await import(join(LIB, 'report.mjs'));
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
  assert.ok(v1.machineEvidence.some((m) => m.id === 'M-contract-Base_SHA'));                    // id 에 공백 없음 — 재리뷰 파서 문법(C1 R4-3)
  assert.ok(v1.machineEvidence.every((m) => /^[A-Za-z][\w-]*$/.test(m.id)));
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
  // 보조 API 조회 실패는 자료 없음이 아니다(R3-3) — closes_issues 는 모든 모드, changes·versions 는 diff-only 만, approvals 는 판정 입력 아님
  const s8 = baseSnap(); s8.api_failures = ['closes_issues', 'approvals'];
  const v8 = V(findings([]), { snapshot: s8 });
  assert.equal(v8.verdict, 'HOLD_EVIDENCE');
  assert.deepEqual(v8.machineEvidence.map((m) => m.id), ['M-api-closes_issues']);
  const s9 = baseSnap(); s9.api_failures = ['changes'];                            // 워크트리 모드 — git 목록이 정본이라 해당 없음
  assert.equal(V(findings([]), { snapshot: s9 }).verdict, 'APPROVE');
  const s10 = baseSnap(); s10.mode = 'diff-only'; s10.api_failures = ['changes'];
  assert.ok(V(findings([]), { snapshot: s10 }).machineEvidence.some((m) => m.id === 'M-api-changes'));
  // 재리뷰의 이전 차단 발견 목록이 불완전하면(댓글 축약분을 이전 리포트로 복원 못 함) 「이전 차단 발견마다 확인」을 완료할 수 없다 — 증거 부족(R4-3)
  const c11 = baseCheck(); c11.rereview = { active: true, prior_head: 'c'.repeat(40), prior_verdict: 'CHANGES_REQUESTED', prior_note_id: 12, priorReport: null, priorBlocking: [{ id: 'F1', type: 'DEFECT', title: 'x', source: 'comment' }, { id: 'F2', type: null, title: null, source: 'missing' }], priorBlockingComplete: false };
  const v11 = V(findings([]), { check: c11 });
  assert.equal(v11.verdict, 'HOLD_EVIDENCE');
  assert.ok(v11.machineEvidence.some((m) => m.id === 'M-rereview' && /1건 미확보/.test(m.detail)));
  const c12 = baseCheck(); c12.rereview = { ...c11.rereview, priorBlocking: [c11.rereview.priorBlocking[0]], priorBlockingComplete: true };
  assert.equal(V(findings([]), { check: c12 }).verdict, 'APPROVE');
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

test('fixableInDesign 상충(R6-3): 미확정 + 세 갈래 · 접미 없는 confirmed 는 ERR · confirmed:design → RTD · confirmed:fixable → CHANGES · 접미가 findings.json 에 영속', () => {
  const conflict = F({ unresolved: true, fixableInDesign: null, fixableInDesignClaims: { claude: 'yes', codex: 'no' }, brokenPremise: '승인 전제 붕괴(codex 주장)' });
  const u = V(findings([conflict]));
  assert.equal(u.status, 'undetermined');
  assert.deepEqual(u.branches.F1, { 'confirmed:fixable': 'CHANGES_REQUESTED', 'confirmed:design': 'RETURN_TO_DESIGN', dismissed: 'APPROVE' });
  assert.throws(() => V(findings([conflict]), { resolves: { F1: 'confirmed' } }), /confirmed:fixable 또는 confirmed:design/);   // 스크립트가 한쪽을 고르지 않는다(D9)
  assert.throws(() => V(findings([conflict]), { resolves: { F1: 'dismissed:design' } }), /접미/);
  assert.equal(V(findings([conflict]), { resolves: { F1: 'confirmed:design' } }).verdict, 'RETURN_TO_DESIGN');
  assert.equal(V(findings([conflict]), { resolves: { F1: 'confirmed:fixable' } }).verdict, 'CHANGES_REQUESTED');
  assert.equal(V(findings([conflict]), { resolves: { F1: 'dismissed' } }).verdict, 'APPROVE');
  assert.equal(V(findings([F({ unresolved: true })]), { resolves: { F1: 'confirmed' } }).verdict, 'CHANGES_REQUESTED');   // 상충 없는 항목은 접미 없이 그대로
  // CLI: 접미 결정이 findings.json 에 남고 리포트 「리뷰어 확인 필요」가 세 갈래를 안내한다
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([conflict]) });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT undetermined -');
  const out = join(root, 'u.md');
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  const md = readFileSync(out, 'utf8');
  assert.match(md, /설계 내 수정 가능 주장: claude=yes \/ codex=no/);
  assert.match(md, /confirmed:fixable → CHANGES_REQUESTED \/ confirmed:design → RETURN_TO_DESIGN \/ dismissed → APPROVE/);
  const bad = runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=confirmed']);
  assert.equal(bad.code, 2);
  assert.match(bad.first, /^ERR .*confirmed:fixable 또는 confirmed:design/);
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=confirmed:design']).first, 'VERDICT determined RETURN_TO_DESIGN');
  const persisted = readJson(join(work, 'findings.json')).findings[0];
  assert.equal(persisted.resolution, 'confirmed');
  assert.equal(persisted.fixableInDesign, 'no');
  assert.deepEqual(persisted.fixableInDesignClaims, { claude: 'yes', codex: 'no' });                                     // 양쪽 주장은 보존
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT determined RETURN_TO_DESIGN');   // 다음 호출도 같은 결정
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.match(readFileSync(out, 'utf8'), /설계 내 수정 가능: no · 깨진 전제: 승인 전제 붕괴\(codex 주장\) · 검토자 주장: claude=yes \/ codex=no/);
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
    writeFileSync(join(work, 'review-claude.json'), JSON.stringify({ reviewer: 'claude', head_sha: HEAD, findings: [{ lens: 'L5', type: 'DEFECT', title: '비밀번호 평문 로그 010-1234-5678', file: 'src/A.java', line_start: 3, line_end: 3, evidence: 'S1 · src/A.java:3 db.password = "synthetic-db-password"; api_key: SYNTH-KEY-12345; cfg {"password": "synthetic-json-password"}; secret = "two word secret"', scenario: '로그 유출', confidence: 'high', recommendation: '마스킹', fixableInDesign: 'yes', brokenPremise: '' }], intent: [], baselineCandidateRelevant: true }));
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
  assert.doesNotMatch(md, /synthetic-json-password|two word secret|word secret/); // JSON 키 형태·공백 포함 따옴표 값도 전체(C1 R2-1 잔존)
  assert.match(md, /\{"password": "\[masked:secret\]"\}; secret = "\[masked:secret\]"/);
  assert.match(md, /db\.password = "\[masked:secret\]"/);
  assert.match(md, /src\/A\.java:3/);                              // 파일:줄 위치는 남는다(§5.7)
  assert.match(md, /기준선 확인 — /);                               // 경량 + 확인 댓글 없음 → 리뷰어가 먼저 게시할 문안
  assert.match(md, /기준선 미확인/);                                // 헤더 표시(F8)
  assert.match(md, /## 부록 A/);
  assert.match(md, /## 부록 B[\s\S]*wiki-private\/x\.md.*Codex 미제공/);
  assert.match(md, /## 부록 C[\s\S]*claude[\s\S]*codex/);
  assert.match(md, /## 부록 C[\s\S]*근거: S1 · src\/A\.java:3 db\.password = "\[masked:secret\]"; api_key: \[masked:secret\]; cfg \{"password": "\[masked:secret\]"\}; secret = "\[masked:secret\]" · 시나리오: 로그 유출 · 설계 내 수정: yes/);   // 원본 발견의 근거·시나리오 보존(R1-9) + 비밀값만 제거
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

test('실행 블록 40줄 보장: 차단 발견 30건·후속 5건·의도 10행이어도 5개 절 유지 + 40줄 이하, 나머지는 부록 D 로 (R3-10)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const many = Array.from({ length: 30 }, (_, i) => F({ id: `F${i + 1}`, title: `차단 결함 ${i + 1}`, file: `src/X${i + 1}.java` }));
  const fus = Array.from({ length: 5 }, (_, i) => F({ id: `F${100 + i}`, type: 'FOLLOW_UP', blocking: false, title: `후속 ${i + 1}` }));
  const intent = Array.from({ length: 10 }, (_, i) => ({ criterion: `V${i + 1}`, result: 'UNKNOWN', location: '-', basis: '작성자 주장' }));
  const d = baseDeploy(); d.applicable = true; d.result = '불일치'; d.mismatches = [{ kind: 'deleted_list', path: null, detail: '삭제 목록 불일치' }];   // 기계 증거도 차단 목록에 — 축약돼도 부록 D 에서 복원돼야 한다(R5-3)
  const work = fullWork(root, { fnd: findings([...many, ...fus], { intent }), deploy: d });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT determined CHANGES_REQUESTED');
  const out = join(root, 'big.md');
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  const md = readFileSync(out, 'utf8');
  const block = md.match(/```text\n([\s\S]*?)\n```/)[1];
  const n = block.split('\n').length;
  assert.ok(n <= 40, `block lines = ${n}`);
  for (const h of ['1. 의도 대조표', '2. 검증 상태', '3. 통과해야 할 테스트', '4. 차단 발견', '5. 비차단 후속']) assert.ok(block.includes(h), h);
  assert.match(block, /\| … 외 4건 — 부록 A \|/);
  assert.match(block, /- F1 DEFECT — 차단 결함 1$/m);                                // 짧은 형태(위치·권고 생략) — id 접두(R4-3)
  const more = block.match(/- … 외 (\d+)건\(차단 — 전부 부록 D 에 있음\): (.*)$/m);
  assert.ok(more, '축약 ④ 줄');
  assert.equal(more[2].split(', ').length, Number(more[1]));                          // 생략분 id 전부 — 재리뷰 대조표 복원용(R4-3)
  assert.ok(more[2].split(', ').includes('F30'));
  assert.ok(more[2].split(', ').includes('M-deploy'));                                       // 기계 항목도 접혔다
  assert.match(block, /- … 외 4건 — 부록 D/);
  assert.match(md, /## 부록 D[\s\S]*\*\*F30\*\*/);                                  // 생략분은 부록 D 에 전부 있다
  assert.match(md, /## 부록 D[\s\S]*- \*\*M-deploy\*\* \[기계\] MISSING_EVIDENCE \(차단\) — 배포본 불일치 — deleted_list \(-:-\) · 출처 machine/);   // 기계 항목도 같은 형식으로(R5-3)
});

test('마스킹은 SHA 를 변조하지 않는다 — 개인정보 패턴(rrn)에 걸리는 정상 40자 SHA 가 게시 블록·헤더·cleanup 뒤 verdict/findings 에 그대로 남는다 (R5-2)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const SHA = 'aaaaaaaaaa1234561123456bbbbbbbbbbbbbbbbb';                                   // 40자 · rrn 패턴(\d{6}-?[1-4]\d{6}) 매치
  assert.equal(SHA.length, 40);
  const snap = baseSnap(); snap.head_sha = SHA;
  const fnd = findings([F({ title: '비밀번호 평문 로그 010-1234-5678' })], { head_sha: SHA });
  const work = fullWork(root, { snap, fnd, reviews: false });
  writeFileSync(join(work, 'review-claude.json'), JSON.stringify({ reviewer: 'claude', head_sha: SHA, findings: [], intent: [], baselineCandidateRelevant: true }));
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT determined CHANGES_REQUESTED');
  const out = join(root, 'sha.md');
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  const md = readFileSync(out, 'utf8');
  assert.match(md, new RegExp(`^리뷰 계약 TEST-POLICY-v1\\.0 · head ${SHA} · 추천 판정\\(초안\\) CHANGES_REQUESTED$`, 'm'));   // 이전 판정 정규식이 다시 읽을 첫 줄
  assert.doesNotMatch(md, /\[masked:rrn\]/);
  assert.match(md, /\[masked:phone\]/);                                                   // 진짜 개인정보는 여전히 가려진다
  // 이메일의 local-part·도메인 라벨이 40자 16진수여도 보호하지 않는다 — 개인정보 마스킹 우선(C1-1, 사용자 재판정)
  const { maskText } = { maskText: (t, r) => deepMaskText(t, r) };
  const rules = JSON.parse(readFileSync(adapter, 'utf8').match(/```json mr-review-adapter\n([\s\S]*?)\n```/)[1]).mask;
  const m1 = maskText(`담당 ${SHA}@example.test · head ${SHA}`, rules);                   // local-part 는 보호 대상에서 빠져 어댑터 패턴(rrn → email 순)에 그대로 걸린다 — 주소는 남지 않는다
  assert.ok(!m1.includes('@example.test') && !m1.includes(`${SHA}@`), m1);               // 주소도, 온전한 local-part 도 남지 않는다
  assert.match(m1, /\[masked:email\]/);
  assert.ok(m1.endsWith(`· head ${SHA}`), m1);                                          // 같은 문장의 진짜 SHA 는 보존
  assert.equal(maskText(`blob/${SHA}/docs/a.md 와 ${SHA}.`, rules), `blob/${SHA}/docs/a.md 와 ${SHA}.`);   // URL 경로·문장 끝은 보호 유지
  const rc = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(rc.code, 0, rc.out + rc.err);
  assert.equal(readJson(join(work, 'verdict.json')).head_sha, SHA);
  assert.equal(readJson(join(work, 'findings.json')).head_sha, SHA);
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=confirmed']).first, 'VERDICT determined CHANGES_REQUESTED');   // --resolve 재계산이 head 불일치로 깨지지 않는다
});

test('부록 C: 무효 검토 결과(비-배열 findings · JSON 오류)가 있어도 단일 모델 리포트는 끝까지 렌더된다 (R3-7)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([F()], { validReviewers: ['claude'], crossChecked: false }) });
  writeFileSync(join(work, 'review-codex.json'), JSON.stringify({ reviewer: 'codex', head_sha: HEAD, findings: 'no', intent: [], baselineCandidateRelevant: true }));   // review-validate 가 INVALID 로 뺀 결과
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT determined CHANGES_REQUESTED');
  const out = join(root, 'c.md');
  const r = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(r.code, 0, r.out + r.err);
  const md = readFileSync(out, 'utf8');
  assert.match(md, /### codex\n\n\(무효 결과 — 스키마 검증 실패[^\n]*findings=string\)/);
  assert.match(md, /### claude\n\n- \[L5\] DEFECT — 비밀번호 평문 로그/);
  assert.match(md, /교차 검토: 없음/);
  writeFileSync(join(work, 'review-codex.json'), '{ not json');
  const r2 = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(r2.code, 0, r2.out + r2.err);
  assert.match(readFileSync(out, 'utf8'), /### codex\n\n\(무효 결과 — JSON 파싱 실패/);
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

test('cleanup: codex.pid 의 프로세스가 살아 있으면 ERR 로 멈추고 아무것도 지우지 않는다 (R6-2) · 종료 뒤에는 정상 정리', async () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = join(root, 'work');
  mkdirSync(join(work, 'zip'), { recursive: true });
  writeFileSync(join(work, 'zip', 'd.zip'), 'x');
  writeFileSync(join(work, 'pack-a.md'), '원문 팩');
  writeFileSync(join(work, 'review-codex.json'), JSON.stringify({ reviewer: 'codex', head_sha: HEAD, findings: [{ title: 'x', evidence: 'db.password = "synthetic-db-password"' }] }));
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });   // 살아 있는 검토자 흉내
  writeFileSync(join(work, 'codex.pid'), String(child.pid));
  try {
    const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
    assert.equal(r.code, 2, r.out + r.err);
    assert.match(r.first, new RegExp(`^ERR 검토자 프로세스 생존\\(codex\\.pid ${child.pid}\\)`));
    assert.ok(existsSync(join(work, 'zip', 'd.zip')));                                                 // 아무것도 지우지 않았다
    assert.ok(existsSync(join(work, 'pack-a.md')));
    assert.ok(existsSync(join(work, 'codex.pid')));
    assert.match(readFileSync(join(work, 'review-codex.json'), 'utf8'), /synthetic-db-password/);        // 마스킹 사본으로 바꾸지도 않았다
  } finally {
    await new Promise((resolve) => { child.once('exit', resolve); child.kill('SIGKILL'); });              // 종료 확인(회수까지)
  }
  const ok = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(ok.code, 0, ok.out + ok.err);
  assert.equal(ok.first, 'CLEANED worktree=false zip=1 raw=2 masked=1');                                 // raw = codex.pid + pack-a.md
  assert.ok(!existsSync(join(work, 'codex.pid')));
  assert.equal(readJson(join(work, 'review-codex.json')).findings[0].evidence, 'db.password = "[masked:secret]"');
});

test('review-validate CLI · cleanup 은 워크트리·zip·blobs·codex 원시 파일·원문 팩·baseline 을 지우고 JSON 은 마스킹 사본으로 남긴다 (F5·F7·R3-9) · deploy.json·verdict.json 도 마스킹 대상 (R4-1)', () => {
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
  writeFileSync(join(work, 'pack-a.md'), '원문 팩 — 개인 위키 010-9999-0000');
  writeFileSync(join(work, 'pack-b.md'), '마스킹 팩');
  mkdirSync(join(work, 'baseline'), { recursive: true });
  writeFileSync(join(work, 'baseline', '1.md'), '기준선 원문 someone@example.test');
  writeFileSync(join(work, 'mr.json'), JSON.stringify({ project: { name: 'alpha' }, description: '연락 010-1234-5678', notes: [{ id: 1, body: 'Authorization: Bearer synthetic-credential-123' }] }));
  writeFileSync(join(work, 'check.json'), JSON.stringify({ reason: { text: '민원 010-1234-5678' }, authorTokens: [{ note_id: 1, token: 'FIXED', arg: headSha }] }));
  writeFileSync(join(work, 'review-claude.json'), JSON.stringify({ reviewer: 'claude', head_sha: headSha, findings: [{ title: 'x', evidence: 'db.password = "synthetic-db-password"' }] }));
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify({ mode: 'worktree', checkout, worktree: join(work, 'worktree'), head_sha: headSha }));
  writeFileSync(join(work, 'deploy.json'), JSON.stringify({ applicable: true, result: '대조 불가', zip: { attachment: 'd.zip' }, mismatches: [{ kind: 'download', path: null, detail: '다운로드 실패: 403 https://gitlab.test/u/d.zip?token=synthetic-credential-abc' }] }));
  writeFileSync(join(work, 'verdict.json'), JSON.stringify({ status: 'determined', verdict: 'HOLD_EVIDENCE', head_sha: headSha, machineEvidence: [{ id: 'M-baseline-1', kind: 'baseline', detail: '기준선·이슈 원문 미확보: https://gitlab.test/g/x.md?token=synthetic-credential-xyz — 담당 someone@example.test' }] }));
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.first, 'CLEANED worktree=true zip=1 raw=7 masked=5');            // raw = codex.* 4 + pack-a·pack-b 2 + baseline 1 · masked = mr·check·deploy·review-claude·verdict
  assert.ok(!existsSync(join(work, 'worktree')));
  assert.ok(!existsSync(join(work, 'zip')));
  assert.ok(!existsSync(join(work, 'blobs')));
  assert.ok(!existsSync(join(work, 'codex.out')));
  assert.ok(!existsSync(join(work, 'pack-a.md')));
  assert.ok(!existsSync(join(work, 'baseline')));
  assert.ok(existsSync(join(work, 'verdict.json')));
  const mr = readJson(join(work, 'mr.json'));
  assert.equal(mr.description, '연락 [masked:phone]');
  assert.equal(mr.notes[0].body, 'Authorization: [masked:token]');
  const ck = readJson(join(work, 'check.json'));
  assert.equal(ck.reason.text, '민원 [masked:phone]');
  assert.deepEqual(ck.authorTokens[0], { note_id: 1, token: 'FIXED', arg: headSha });   // 키 이름은 패턴에 안 걸린다 — 값만 본다
  assert.equal(readJson(join(work, 'review-claude.json')).findings[0].evidence, 'db.password = "[masked:secret]"');
  const dj = readJson(join(work, 'deploy.json'));
  assert.doesNotMatch(dj.mismatches[0].detail, /synthetic-credential/);                 // deploy.json(API 오류 문자열) 도 마스킹 사본(R4-1)
  assert.equal(dj.result, '대조 불가');
  const vj = readJson(join(work, 'verdict.json'));
  assert.doesNotMatch(vj.machineEvidence[0].detail, /synthetic-credential|example\.test/);   // verdict.json(미확보 링크 raw·reason) 도(R4-1)
  assert.equal(vj.verdict, 'HOLD_EVIDENCE');
  assert.doesNotMatch(git(checkout, 'worktree', 'list'), /work\/worktree/);
});
````

실행:

```bash
node --test tests/mr-review/report.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: tests 14 · pass 0 · fail 14.

### 2. `report.mjs`

`dev-workflow/skills/mr-review/scripts/lib/report.mjs`를 아래 내용 그대로 만든다.

````js
// report.mjs — spec §5.5-4 판정 계산(결정적) · §5.7 리포트 렌더 · F5 비밀값 제거 · F7 정리 · SC-4 검토자 출력 검증.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { maskText, SECRET_MASK } from './pack.mjs';   // 엔진 마스킹 규칙은 pack.mjs 가 정본(팩 B·리포트·cleanup 공유, R6-1) — 여기서 다시 정의하지 않는다
export { maskText, SECRET_MASK };

export class ReportError extends Error {}

export const VERDICTS = ['APPROVE', 'HOLD_EVIDENCE', 'CHANGES_REQUESTED', 'RETURN_TO_DESIGN'];
const TYPES = ['DEFECT', 'MISSING_EVIDENCE', 'DESIGN_DRIFT', 'FOLLOW_UP'];
const CONF = ['high', 'medium', 'low'];
const BLOCK_MAX_LINES = 40;
// 정리(cleanup) 때 남기는 JSON 의 문자열 값에 어댑터 마스킹 + 비밀값 제거(`maskText` = 어댑터 mask + SECRET_MASK, 40자 SHA 보존 — pack.mjs, R5-2·C1-1)를 적용한다(R3-9) — 키 이름은 건드리지 않는다(`"token": "FIXED"` 같은 값이 키워드 패턴에 걸리지 않게 값만 본다).
export function deepMask(v, maskRules) {
  if (typeof v === 'string') return maskText(v, maskRules);
  if (Array.isArray(v)) return v.map((x) => deepMask(x, maskRules));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepMask(x, maskRules)]));
  return v;
}

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
  // id 는 공백 없이(`[\w-]+`) — 실행 블록 축약 ④ 의 id 목록·task-03 파서(BLOCK_ITEM_RE·APPENDIX_D_RE)와 문법을 맞춘다(C1 R4-3 잔존: `M-contract-Base SHA` 가 파서에 안 읽혀 재리뷰 목록이 유실됐다)
  for (const name of check?.contract?.incompleteLines || []) out.push({ id: `M-contract-${String(name).replace(/\s+/g, '_')}`, kind: 'contract', detail: `Review Contract 「${name}」 미완(${check.contract.lines.find((l) => l.name === name)?.status || '없음'})` });
  (snapshot?.unrecovered || []).forEach((p, i) => out.push({ id: `M-diff-${i + 1}`, kind: 'diff', detail: `복원하지 못한 diff: ${p} (diff-only — 로컬 clone 권장)` }));
  if (snapshot?.mode === 'diff-only' && snapshot.diff_list_complete === false) out.push({ id: 'M-diff-list', kind: 'diff', detail: '변경 파일 목록 불완전(API overflow — 파일 항목이 통째로 빠졌을 수 있음, 검토 범위·배포 목록 축소) — 로컬 clone 권장' });
  // 보조 API 조회 실패(R3-3) — 빈 응답이 아니라 「모름」: 연결 이슈 목록(모든 모드), 변경 목록 overflow·diff 버전(diff-only — 워크트리 모드는 git 이 정본). approvals 는 승인 표시용이라 판정 입력이 아니다.
  for (const name of snapshot?.api_failures || []) {
    if (name === 'closes_issues' || (snapshot.mode === 'diff-only' && (name === 'changes' || name === 'versions'))) out.push({ id: `M-api-${name}`, kind: 'api', detail: `GitLab 조회 실패: ${name} — 자료가 없는 것이 아니라 받지 못한 것(재실행 또는 로컬 clone 권장)` });
  }
  if (deploy?.applicable && deploy.result !== '일치') out.push({ id: 'M-deploy', kind: 'deploy', detail: `배포본 ${deploy.result}${deploy.mismatches?.length ? ' — ' + deploy.mismatches.map((m) => m.kind + (m.path ? `(${m.path})` : '')).join(', ') : ''}` });
  // 재리뷰의 이전 차단 발견 목록이 불완전하면(댓글 축약분을 이전 리포트 부록 D 로 복원 못 함, R4-3) §5.6 「이전 차단 발견마다 확인」을 완료할 수 없다 — 원문 미확보와 같은 증거 부족
  if (check?.rereview?.active && check.rereview.priorBlockingComplete === false) out.push({ id: 'M-rereview', kind: 'rereview', detail: `이전 차단 발견 목록 불완전 — ${(check.rereview.priorBlocking || []).filter((b) => b.title === null).length}건 미확보(댓글 축약분 · 이전 리포트 ${check.rereview.priorReport ? '부록 D 에 없음' : '없음'}) — 확인 완료로 취급 금지` });
  (check?.baselineLinks || []).forEach((l, i) => { if (l.status === '미확보') out.push({ id: `M-baseline-${i + 1}`, kind: 'baseline', detail: `기준선·이슈 원문 미확보: ${l.raw || l.kind} — ${l.reason || ''}` }); });
  return out;
}

// fixableInDesign 상충(R6-3): 메인이 같은 지문의 두 결과를 합칠 때 `fixableInDesign` 이 갈리고 코드로 확인하지 못하면 `fixableInDesignClaims: { claude, codex }` 에 양쪽을 보존하고 `unresolved:true`·`fixableInDesign:null` 로 둔다(SC-5).
// 이 값 하나로 CHANGES_REQUESTED ↔ RETURN_TO_DESIGN 이 바뀌므로 스크립트가 한쪽을 고르지 않는다(D9 — 판정 규칙 신설 금지). 리뷰어가 `--resolve <id>=confirmed:fixable|confirmed:design` 으로 정한다. 상충이 없는 항목은 접미 없는 `confirmed` 그대로(접미를 주면 그 값으로 덮는다 — 리뷰어 결정).
export const claimsConflict = (f) => !!f?.fixableInDesignClaims && new Set(Object.values(f.fixableInDesignClaims).filter(Boolean)).size > 1;
export function parseResolve(id, value, f = null) {
  const m = String(value).match(/^(confirmed|dismissed)(?::(fixable|design))?$/);
  if (!m) throw new ReportError(`--resolve ${id}=${value}: confirmed|dismissed|confirmed:fixable|confirmed:design 만 허용`);
  if (m[1] === 'dismissed' && m[2]) throw new ReportError(`--resolve ${id}=${value}: dismissed 에는 접미를 붙이지 않는다`);
  if (m[1] === 'confirmed' && !m[2] && claimsConflict(f)) throw new ReportError(`--resolve ${id}=confirmed: 설계 내 수정 가능 여부가 검토자 간 상충(${Object.entries(f.fixableInDesignClaims).map(([k, v]) => `${k}=${v}`).join(' / ')}) — confirmed:fixable 또는 confirmed:design 으로 정하라`);
  return { resolution: m[1], fixableInDesign: m[2] === 'fixable' ? 'yes' : m[2] === 'design' ? 'no' : null };
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
      const d = parseResolve(f.id, r, f);
      f.resolution = d.resolution;
      if (d.fixableInDesign) f.fixableInDesign = d.fixableInDesign;
      f.unresolved = false;
    }
  }
  const typeMissing = check?.baselineType === '빈칸·자리표시자' || check?.baselineType === '칸 없음';
  const baselineMissing = typeMissing && ((check?.baselineCandidateFiles || []).length === 0 || findings.baselineCandidateRelevant !== true);
  const machine = machineEvidence({ check, snapshot, deploy });
  const calc = (assume) => calcOn(list, assume);
  const calcOn = (list, assume) => {
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
    for (const id of unresolved) {
      const f = list.find((x) => x.id === id);
      if (claimsConflict(f)) {   // fixableInDesign 상충(R6-3) — 확인 갈래가 둘(설계 내 수정 가능 / 불가)로 갈린다. 리뷰어가 `confirmed:fixable|confirmed:design` 로 정한다
        const withF = (v) => { const g = list.map((x) => (x.id === id ? { ...x, fixableInDesign: v } : x)); return calcOn(g, { [id]: 'confirmed' }).verdict; };
        branches[id] = { 'confirmed:fixable': withF('yes'), 'confirmed:design': withF('no'), dismissed: calc({ [id]: 'dismissed' }).verdict };
      } else branches[id] = { confirmed: calc({ [id]: 'confirmed' }).verdict, dismissed: calc({ [id]: 'dismissed' }).verdict };
    }
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

// 정책 §8.1 실행 블록 — 5개 절은 항상 유지하고 본문 40줄 이내를 **보장**한다(R3-10). 넘치면 결정적 축약 순서: ① 의도 표 6행 초과분 → 부록 A ② 차단 발견 짧은 형태(위치·권고 생략) ③ 비차단 후속 1건 + 「외 n건」 ④ 차단 발견 앞 n건 + 「외 n건 — 부록 D」(n 은 40줄에 맞춰 계산, 최소 1건). 상세는 부록 D 가 전부 보존한다.
function executionBlock({ verdict, mr, snapshot, check, deploy, findings, pack }) {
  const fnd = findings?.findings || [];
  const byId = Object.fromEntries(fnd.map((f) => [f.id, f]));
  const models = findings?.validReviewers?.length ? findings.validReviewers.join(', ') : '-';
  const head = [`리뷰 계약 ${verdict.contractPolicyId} · head ${snapshot.head_sha} · 추천 판정(초안) ${verdict.verdict}`, `사람 승인 상태: ${approvalLine(mr)}`, ''];
  const intent = findings?.intent || [];
  let rows = intent.map((i) => `| ${i.criterion} | ${i.result} | ${i.location || '-'} (${i.basis || '작성자 주장'}) |`);
  if (!rows.length) rows = ['| (검증 표 없음) | UNKNOWN | - |'];
  const s1h = ['1. 의도 대조표', '| 수용기준·MR 주장 | 결과 | 코드 위치 |', '|---|---|---|'];
  const s2 = ['2. 검증 상태',
    `- [판독] base..head diff·변경 파일 전문 — head ${s7(snapshot.head_sha)} (돈 모델: ${models}${findings?.crossChecked ? '' : ' · 교차 검토 없음'})`,
    deploy?.applicable ? `- [실행] 배포본 zip 대조(스킬 직접 수행): ${deploy.result}${deploy.mismatches?.length ? ' — ' + deploy.mismatches.map((m) => m.kind + (m.path ? `(${m.path})` : '')).join(', ') : ''}` : '- 배포본: 비해당(운영 배포 대상 변경 없음)',
    '- [다른 주체 제공] 작성자 검증 표 결과 — 작성자 주장(이 스킬은 테스트·빌드를 실행하지 않는다)'];
  const evidenceItems = verdict.evidence.map((id) => byId[id] ? `${byId[id].title}` : (verdict.machineEvidence.find((m) => m.id === id)?.detail || id));
  const s3 = ['3. 통과해야 할 테스트', evidenceItems.length ? `- 머지 전: ${evidenceItems.map((t) => `[ ] ${t}`).join(' · ')}` : '- 머지 전: 없음', '- 배포 후: —(릴리즈 게이트 이관)'];
  // 차단 발견 줄은 id 를 앞에 둔다(`- F3 DEFECT — …` · `- M-deploy MISSING_EVIDENCE — …`) — 재리뷰(task-03 `priorBlockingList`)가 댓글 항목을 부록 D 와 id 로 맞추고, 축약 ④ 가 생략분 id 를 댓글에 남길 수 있게(R4-3)
  const blockingFull = [];
  const blockingShort = [];
  const blockingIds = [];
  for (const id of verdict.defects) { const f = byId[id]; if (f) { blockingIds.push(f.id); blockingFull.push(`- ${f.id} ${f.type} — ${f.title} (${f.file || '-'}${f.line_start ? `:${f.line_start}` : ''}) · ${f.recommendation || ''}`.trim()); blockingShort.push(`- ${f.id} ${f.type} — ${f.title}`); } }
  for (const id of verdict.evidence) {
    const f = byId[id];
    if (f) { blockingIds.push(f.id); blockingFull.push(`- ${f.id} MISSING_EVIDENCE — ${f.title} (${f.file || '-'}) · ${f.recommendation || ''}`.trim()); blockingShort.push(`- ${f.id} MISSING_EVIDENCE — ${f.title}`); }
    else { const m = verdict.machineEvidence.find((x) => x.id === id); if (m) { blockingIds.push(m.id); blockingFull.push(`- ${m.id} MISSING_EVIDENCE — ${m.detail}`); blockingShort.push(`- ${m.id} MISSING_EVIDENCE — ${m.detail}`); } }
  }
  const fu = fnd.filter((f) => f.type === 'FOLLOW_UP' || (f.blocking === false && f.resolution !== 'dismissed' && f.type !== 'MISSING_EVIDENCE' && f.type !== 'DEFECT')).map((f) => `- ${f.title}`);
  let blocking = blockingFull.length ? blockingFull : ['- 없음'];
  let follow = fu.length ? fu : ['- 없음'];
  const assemble = () => [...head, ...s1h, ...rows, ...s2, ...s3, '4. 차단 발견', ...blocking, '5. 비차단 후속', ...follow];
  const over = () => assemble().length - BLOCK_MAX_LINES;
  if (over() > 0 && rows.length > 6) rows = [...rows.slice(0, 6), `| … 외 ${rows.length - 6}건 — 부록 A | - | - |`];           // ①
  if (over() > 0 && blockingFull.length) blocking = blockingShort;                                                                  // ②
  if (over() > 0 && fu.length > 1) follow = [fu[0], `- … 외 ${fu.length - 1}건 — 부록 D`];                                          // ③
  if (over() > 0 && blockingShort.length > 1) {                                                                                      // ④
    const keep = Math.max(1, blockingShort.length - over() - 1);
    blocking = [...blockingShort.slice(0, keep), `- … 외 ${blockingShort.length - keep}건(차단 — 전부 부록 D 에 있음): ${blockingIds.slice(keep).join(', ')}`];   // 생략분 id 는 댓글에 남긴다 — 재리뷰 대조표가 댓글만으로 전체 목록을 세울 수 있게(R4-3)
  }
  return assemble().join('\n');
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
    parts.push(verdict?.status === 'review-failed' ? '(리뷰 실패 — 블록 없음)' : `(리뷰어 확인 후 \`verdict --resolve <id>=confirmed|dismissed\`(설계 내 수정 가능 상충 항목은 \`confirmed:fixable|confirmed:design\`) 로 생성)`);
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
      const keys = Object.keys(b);   // 상충(R6-3)이면 confirmed:fixable / confirmed:design / dismissed 세 갈래 — 그 밖은 확인/기각 두 갈래 그대로
      parts.push(`- **${id}** ${f?.type} — ${f?.title} (${f?.file || '-'}:${f?.line_start || '-'} · 출처 ${f?.source} · 확신 ${f?.confidence})`, `  - 주장: ${f?.scenario || f?.evidence || ''}${f?.fixableInDesignClaims ? ` · 설계 내 수정 가능 주장: ${Object.entries(f.fixableInDesignClaims).map(([k, v]) => `${k}=${v}`).join(' / ')}${f?.brokenPremise ? ` · 깨진 전제(주장): ${f.brokenPremise}` : ''}` : ''}`,
        b.confirmed !== undefined ? `  - 확인 시 ${b.confirmed} / 기각 시 ${b.dismissed}` : `  - ${keys.map((k) => `${k} → ${b[k]}`).join(' / ')}`,
        `  - 실행: ${keys.map((k) => `\`verdict --resolve ${id}=${k}\``).join(' 또는 ')}`);
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
      parts.push(`### ${name}`, '');
      const file = path.join(work, `review-${name}.json`);
      if (!fs.existsSync(file)) { parts.push('(없음)', ''); continue; }
      // 무효 결과(JSON 오류·스키마 실패·validReviewers 밖)는 구조화하지 않는다(R3-7) — 한쪽이 깨져도 단일 모델 리포트는 끝까지 렌더된다
      let r = null;
      try { r = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { parts.push(`(무효 결과 — JSON 파싱 실패: ${e.message.slice(0, 120)})`, ''); continue; }
      if (!(findings?.validReviewers || []).includes(name) || !Array.isArray(r?.findings)) { parts.push(`(무효 결과 — 스키마 검증 실패 또는 유효 검토자 아님: findings=${Array.isArray(r?.findings) ? `${r.findings.length}건` : typeof r?.findings})`, ''); continue; }
      // §5.7 원본 발견 보존 — 근거·실패 시나리오·설계 내 수정 가능 여부·깨진 전제까지(마스킹은 아래 전체 적용)
      parts.push(...(r.findings.map((f) => `- [${f?.lens}] ${f?.type} — ${f?.title} (${f?.file || '-'}:${f?.line_start || '-'}) · 확신 ${f?.confidence} · 근거: ${f?.evidence || '-'} · 시나리오: ${f?.scenario || '-'} · 설계 내 수정: ${f?.fixableInDesign || '-'}${f?.fixableInDesign === 'no' ? ` · 깨진 전제: ${f?.brokenPremise || '-'}` : ''} · 권고: ${f?.recommendation || ''}`)), r.findings.length ? '' : '(발견 없음)', '');
    }
    // 부록 D — 병합 발견 상세: 실행 블록(40줄)이 생략한 근거·시나리오·전제·리뷰어 결정을 발견마다 보존한다(사람이 차단 판단을 검증할 수 있게)
    parts.push('## 부록 D — 병합 발견 상세 · 리뷰어 결정', '');
    const merged = findings?.findings || [];
    if (!merged.length && !(verdict?.machineEvidence || []).length) parts.push('(발견 없음)', '');
    for (const f of merged) {
      parts.push(`- **${f.id}** [${f.lens}] ${f.type}${f.blocking ? ' (차단)' : ''} — ${f.title} (${f.file || '-'}:${f.line_start || '-'}) · 출처 ${f.source} · 확신 ${f.confidence}`,
        `  - 근거: ${f.evidence || '-'}`, `  - 실패 시나리오: ${f.scenario || '-'}`, `  - 설계 내 수정 가능: ${f.fixableInDesign || '-'}${f.fixableInDesign === 'no' ? ` · 깨진 전제: ${f.brokenPremise || '-'}` : ''}${f.fixableInDesignClaims ? ` · 검토자 주장: ${Object.entries(f.fixableInDesignClaims).map(([k, v]) => `${k}=${v}`).join(' / ')}${f.fixableInDesign !== 'no' && f.brokenPremise ? ` · 깨진 전제(주장): ${f.brokenPremise}` : ''}` : ''}`,
        `  - 권고: ${f.recommendation || '-'}`,
        `  - 리뷰어 결정: ${f.resolution ? `${f.resolution}${f.dismissReason ? ` · 근거: ${f.dismissReason}` : ''}` : (f.unresolved ? '미확정(리뷰어 확인 필요)' : '-')}`);
    }
    // 기계 증거(machineEvidence)도 같은 줄 형식으로 — 실행 블록 축약 ④ 가 접은 `M-…` 항목을 재리뷰(task-03 parseAppendixD)가 여기서 복원한다(R5-3). 모델 발견만 적으면 접힌 기계 항목은 영구 미확보 → M-rereview 가 남는다.
    for (const m of verdict?.machineEvidence || []) parts.push(`- **${m.id}** [기계] MISSING_EVIDENCE (차단) — ${m.detail} (-:-) · 출처 machine · 확신 -`, `  - 근거: 스크립트 결정적 검사(${m.kind}) — 모델 발견이 아니다`);
    parts.push('');
  }
  const text = parts.join('\n');
  // F5 — 산출물 전체 비밀값 제거: 어댑터 개인정보 패턴 + 엔진 내장 비밀값 리터럴 패턴(§5.7 「하드코딩 비밀값은 [masked:secret] <파일:줄>로만」 — 어댑터 mask 에 비밀번호·API 키 패턴이 없어도 적용). SHA 는 보존(R5-2 — maskText).
  return maskText(text, adapter.mask);
}

// ── 정리(F7·F5) ───────────────────────────────────────────────────────────
// 산출물 수명주기(R3-9): 원문(워크트리·zip·blobs·codex.*·pack-a/b.md·baseline/)은 삭제, `--resolve`·재리뷰·re-render 에 필요한 JSON(mr·check·deploy·review-*·findings·verdict)은
// 문자열 값에 어댑터 마스킹 + 비밀값 제거를 적용한 사본으로 보존한다. 리포트는 저장 시 이미 마스킹됐다.
// deploy.json(zip 파일명·주석·API 오류 문자열)·verdict.json(machineEvidence 에 복사된 미확보 링크 raw·reason 등)에도 MR 원문이 흘러든다(R4-1) — 「원문 없음」으로 가정하지 않고 같은 마스킹을 건다.
// snapshot.json·pack.json 은 경로·SHA·카운트·패턴 이름만 담아 제외한다.
const MASKED_JSON = ['mr.json', 'check.json', 'deploy.json', 'review-claude.json', 'review-codex.json', 'findings.json', 'verdict.json'];
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; } };
export function cleanup({ work, adapter }) {
  // 검토자 생존 가드(R6-2, fail-closed): `codex.pid` 의 프로세스가 살아 있으면 아무것도 지우지 않는다 — 정리 뒤 완료되는 검토자가 마스킹 안 된 review-*.json 을 다시 쓰고, pid 파일이 먼저 사라지면 회수 경로도 없어진다.
  // 종료(TERM → 생존 확인 → KILL)는 SKILL §0 「검토자 종료 확인」이 cleanup 에 앞서 수행한다 — 이 가드는 그 절차를 건너뛴 호출을 막는 2차 방어다. Claude 서브에이전트는 pid 가 없으므로 SKILL 절차만이 막는다.
  const pidFile = path.join(work, 'codex.pid');
  if (fs.existsSync(pidFile)) {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    if (Number.isInteger(pid) && pid > 0 && alive(pid)) throw new ReportError(`검토자 프로세스 생존(codex.pid ${pid}) — 정리하지 않는다. 종료 확인(TERM → 생존 확인 → KILL) 뒤 cleanup 을 다시 실행하라(SKILL §0 공통 종료 절차)`);
  }
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
  for (const f of ['codex.prompt', 'codex.out', 'codex.sh', 'codex.pid', 'pack-a.md', 'pack-b.md']) { const p = path.join(work, f); if (fs.existsSync(p)) { fs.rmSync(p); raw += 1; } }
  const bl = path.join(work, 'baseline');
  if (fs.existsSync(bl)) { raw += fs.readdirSync(bl).length; fs.rmSync(bl, { recursive: true, force: true }); }
  let masked = 0;
  for (const f of MASKED_JSON) {
    const p = path.join(work, f);
    if (!fs.existsSync(p)) continue;
    let obj;
    try { obj = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { fs.rmSync(p); raw += 1; continue; }   // 파싱 불가 JSON 은 마스킹할 수 없다 — 원문으로 남기지 않고 지운다
    fs.writeFileSync(p, JSON.stringify(deepMask(obj, adapter?.mask || []), null, 2));
    masked += 1;
  }
  return { worktree, zip, raw, masked };
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
  for (const r of args.resolve || []) { const m = String(r).match(/^([^=]+)=(.+)$/); if (!m) throw new ReportError(`--resolve 형식: <id>=confirmed|dismissed|confirmed:fixable|confirmed:design (${r})`); resolves[m[1]] = m[2]; }
  const v = computeVerdict({ check, snapshot, deploy, findings, resolves, judgeId: ctx.adapter.policy.judgeId });
  // --resolve 결정은 findings.json 에 영속화한다 — 다음 호출(다른 후보의 --resolve·render)이 같은 결정을 다시 쓴다. 기각 근거(dismissReason)는 메인이 미리 적어 둔 값이 그대로 남는다. 접미(fixable|design)는 fixableInDesign 확정값으로 남는다(R6-3).
  if (Object.keys(resolves).length) {
    let touched = false;
    for (const f of findings.findings || []) { const r = resolves[f.id]; if (r !== undefined) { const d = parseResolve(f.id, r, f); f.resolution = d.resolution; if (d.fixableInDesign) f.fixableInDesign = d.fixableInDesign; f.unresolved = false; touched = true; } }
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
  const r = cleanup({ work: ctx.work, adapter: ctx.adapter });
  return `CLEANED worktree=${r.worktree} zip=${r.zip} raw=${r.raw} masked=${r.masked}`;
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

기대: report 17/17 · 전체 68/68(adapter 8·collect 9·check 11·deploy 11·pack 12·report 17) · `CHECK_DONE`만.

```bash
git add dev-workflow/skills/mr-review/scripts/lib/report.mjs dev-workflow/skills/mr-review/scripts/mr-review.mjs tests/mr-review/report.test.mjs
git commit -m "feat(mr-review): verdict·render·cleanup·review-validate — 두 집합 판정 순서, 기계 증거 부족 자동 투입, 판정 미확정·--resolve, §8.1 블록 렌더·비밀값 제거·정리 (spec §5.5, §5.7, F3·F5·F7·F8)"
```

## Acceptance Criteria

- `node --test tests/mr-review/report.test.mjs` → 17/17, 전체 68/68.
- `cleanup`은 `codex.pid`의 프로세스가 살아 있으면 `ERR 검토자 프로세스 생존(codex.pid <n>)` exit 2 로 멈추고 아무것도 지우지·마스킹하지 않는다(plan R6-2, fail-closed) · `fixableInDesign` 이 검토자 간 상충(`fixableInDesignClaims`)인 미해결 항목은 `branches`가 `confirmed:fixable`·`confirmed:design`·`dismissed` 세 갈래이고 접미 없는 `--resolve <id>=confirmed`는 ERR, 접미 결정은 `findings.json`의 `fixableInDesign` 확정값으로 영속(plan R6-3, D9).
- 실행 블록은 발견·표가 많아도 5개 절 유지 + 40줄 이하(plan R3-10) · 무효 검토 결과 파일이 있어도 render 는 실패하지 않고 부록 C 에 「무효 결과」(plan R3-7) · `cleanup` 뒤 `pack-*.md`·`baseline/` 없음, 남는 JSON(`deploy.json`·`verdict.json` 포함 — plan R4-1) 의 문자열 값에 마스킹 패턴·비밀값 잔존 0(plan R3-9) · `snapshot.api_failures`는 기계 증거 `M-api-<name>`(plan R3-3) · 실행 블록 차단 줄은 id 접두, 축약 ④ 는 생략분 id 목록을 남기고, 재리뷰 이전 차단 목록 불완전은 `M-rereview`(plan R4-3).
- 판정은 정책 4종만(D9) · 미해결 후보가 있으면 게시용 블록을 만들지 않고 헤더에 「판정 미확정」(R1-F4·R2-F4) · 발견 0건이어도 계약 미완·미복원 diff·배포본 불일치·원문 미확보면 `HOLD_EVIDENCE`(R5-F1·R1-F3·R4-F1·R4-F3) · 유효 검토 0개면 블록 없음(R4-F2) · 리포트 전체에 마스킹 패턴 잔존 0(F5) · `cleanup` 뒤 워크트리·zip·blobs·codex 원시 파일 없음(F7).
- `--resolve` 결정이 `findings.json`에 영속돼 호출을 나눠도 유지되고 리포트 「리뷰어 결정」·부록 D에 근거가 남는다(plan R1-7) · `verdict.json`·`findings.json`의 head가 `snapshot.head_sha`와 다르면 판정 블록 없이 리뷰 실패, 비-early에서 `verdict.json` 부재도 리뷰 실패(plan R1-1) · 부록 C·D에 근거·시나리오·깨진 전제 보존(plan R1-9).

## Cautions

- **판정 값을 4종 밖으로 만들지 마라(「보류」 등). 이유:** D9·R2-F4 — 미확정은 `status`로만 표현하고 블록을 비운다.
- **`cleanup`은 먼저 `codex.pid`의 프로세스 생존을 보고, 살아 있으면 `ReportError`(ERR exit 2)로 멈춰라 — 지우거나 죽이지 마라. 이유:** plan R6-2(사용자 결정 — 종료는 SKILL §0 「검토자 종료 확인」이 TERM→생존 확인→KILL 로 수행하고 cleanup 은 거부로 2차 방어) — 정리 뒤 완료되는 검토자가 마스킹 안 된 `review-*.json`을 다시 쓰고, pid 파일을 먼저 지우면 회수 경로도 사라진다.
- **같은 지문의 두 결과가 `fixableInDesign` 으로 갈리면 스크립트가 한쪽을 고르지 마라 — `fixableInDesignClaims` 양쪽 보존 + `unresolved` 로 「판정 미확정」, 리뷰어가 `--resolve <id>=confirmed:fixable|confirmed:design` 으로 정한다(접미 없는 `confirmed`는 ERR). 이유:** plan R6-3(사용자 결정) — 이 값 하나로 CHANGES_REQUESTED ↔ RETURN_TO_DESIGN 이 바뀌는데 엄한 쪽 자동 채택은 근거 없는 한쪽 주장으로 설계 반려를 만드는 새 판정 규칙(D9 위배)이고, 기존 미확정·`--resolve` 계약을 재사용하면 규칙이 늘지 않는다.
- **`SECRET_MASK`·`maskText`·`SHA40_RE`를 이 모듈에 다시 정의하지 마라 — `pack.mjs`에서 import(재export)한다. 이유:** plan R6-1 — 팩 B(Codex 전송)·리포트·cleanup 이 같은 규칙을 써야 한다. pack.mjs 가 report.mjs 를 import 하면 순환이라 정본은 pack.mjs 다.
- **`MISSING_EVIDENCE`를 결함 집합에 넣지 마라. 이유:** §5.5-4 집합 분리(R4-F3) — 결함이 함께 있으면 `CHANGES_REQUESTED`, 증거 부족만이면 `HOLD_EVIDENCE`.
- **`--full`이나 조기 종료 여부로 기계 증거 투입을 끄지 마라. 이유:** R5-F1 — `--full`은 검토 범위만 넓힌다.
- **리포트 마스킹은 마지막에 전체 텍스트에 한 번. 절별로 빼먹지 마라. 이유:** 부록 C(모델 원문)가 비밀값 누출의 전형(R2-F3).
- **`SECRET_MASK`는 따옴표 안 값을 공백 포함 전체로, JSON 키 형태(`"password": "…"`)도 가려야 한다 — 첫 토큰만 가리는 패턴으로 끝내지 마라. 이유:** plan C1(R2-1 잔존) — `{"password": "synthetic-json-password"}` 가 그대로 남고 `"two word secret"` 은 첫 단어만 가려졌다. 리포트·cleanup 사본이 같은 함수라 F5 미충족.
- **어댑터 `mask`(개인정보)와 별도로 엔진 내장 `SECRET_MASK`(비밀번호·API 키·토큰·Bearer·PEM 값)를 리포트 전체에 적용하라. 이유:** plan R2-1 — 어댑터 패턴은 개인정보용이라 L5 발견이 인용한 `password = "…"` 리터럴이 부록 C·D에 그대로 남는다(§5.7 `[masked:secret] <파일:줄>` 계약·F5). 파일:줄은 남긴다.
- **`review-validate`에 `--head`·`--reviewer`를 받아 원본 결과의 head·검토자 일치를 검사하라. 이유:** plan R2-4 — 형식만 보면 이전 head 의 검토 결과가 VALID 로 통과하고, 병합에서 `findings.head_sha`를 새로 적으면 후속 대조가 그것을 못 잡는다.
- **`review-validate`는 `ERR` 접두 없이 `INVALID …` exit 1. 이유:** SC-6 — SKILL이 `VALID`/`INVALID`만 본다.
- **`cleanup`은 원문(`pack-a.md`·`pack-b.md`·`baseline/`·`codex.*`·워크트리·zip·blobs)을 지우고, JSON(`mr`·`check`·`deploy`·`review-*`·`findings`·`verdict`)은 문자열 값에 어댑터 마스킹 + `SECRET_MASK`를 적용한 사본으로 남긴다. JSON 을 통째로 지우거나 원문 그대로 두지 마라. 이유:** plan R3-9 — `pack-a.md`는 MR 원문·개인 위키 발췌를, `review-*.json`은 비밀값 인용을 그대로 담는데 `codex.*`만 지우면 P4·F5 의 정리 요구를 못 채운다. 반대로 JSON 을 지우면 `--resolve` 재계산(§9)·재리뷰(§5.6)가 같은 `W`에서 불가능하다. 마스킹은 값만(키 이름 제외) — `deepMask`.
- **SHA 보호는 토큰 경계를 본다 — 바로 앞뒤에 `@` 가 붙거나 `.<영숫자>` 로 이어지는 40자 16진수는 보호하지 않는다(이메일 local-part·도메인 라벨). 이유:** plan C1-1(사용자 재판정으로 R5-2 보정) — `aaaa…40hex@example.test` 의 앞부분이 SHA 자리표시자로 먼저 빠지면 이메일 정규식이 매치하지 못해 주소 전체가 리포트·cleanup JSON 에 남는다. 개인정보 마스킹이 SHA 보존보다 우선이다.
- **마스킹(리포트 전체·cleanup `deepMask`)은 40자 SHA 를 보존해야 한다 — `maskText`가 16진수 40자(글자 포함) 토큰을 자리표시자로 빼고 복원한다. 어댑터 패턴을 SHA 에 그대로 돌리지 마라. 이유:** plan R5-2 — `aaaaaaaaaa1234561123456bbbb…` 같은 정상 SHA 가 rrn 패턴에 걸려 게시 블록 첫 줄의 head 가 `[masked:rrn]`으로 바뀌면 다음 리뷰의 이전 판정 정규식이 못 읽고, cleanup 이 `verdict`·`findings`의 `head_sha`를 바꾸면 `--resolve`가 head 불일치로 review-failed 가 된다. 글자 조건으로 숫자열(전화·주민번호)은 보호하지 않는다.
- **부록 D 에는 모델 발견뿐 아니라 `machineEvidence` 항목도 같은 줄 형식(`- **M-…** [기계] MISSING_EVIDENCE (차단) — <detail> (-:-) · 출처 machine …`)으로 적어라. 이유:** plan R5-3 — 축약 ④ 는 모델 발견과 기계 항목을 함께 접고 생략 id 를 부록 D 로 안내하는데, 부록 D 가 `findings.findings`만 담으면 접힌 `M-deploy`는 리포트가 있어도 재리뷰에서 `source:missing` → `M-rereview`가 남아 다음 head 에서 전부 고쳐도 HOLD_EVIDENCE 다.
- **`deploy.json`·`verdict.json`을 「원문 없음」으로 보고 마스킹에서 빼지 마라. 이유:** plan R4-1 — `machineEvidence()`는 미확보 링크의 `raw`·`reason`을, deploy 는 zip 파일명·주석·API 오류 문자열을 그대로 복사한다. 링크의 `?token=…`이 `check.json`에서는 가려지고 `verdict.json`에는 남는 데이터 흐름 결함. 제외는 경로·SHA·카운트만 담는 `snapshot.json`·`pack.json`뿐.
- **실행 블록의 차단 발견 줄에는 발견 id(`F3`·`M-deploy`)를 앞에 두고, 축약 ④ 의 「… 외 n건」 줄에는 생략분 id 목록을 붙여라. 이유:** plan R4-3 — 재리뷰(§5.6)는 이전 판정 댓글의 「4. 차단 발견」으로 대조표를 만드는데, R3-10 축약이 일부를 부록 D(로컬 리포트)로 옮기면 댓글만 남은 환경에서는 그 항목을 복원할 입력이 없다. id 가 있으면 이전 리포트 부록 D 에서 제목을 복원하고, 없으면 `title:null`로 미확보가 되어 `M-rereview`로 판정에 전달된다.
- **실행 블록은 40줄을 「보장」한다 — 넘치면 안내 문장을 덧붙이고 끝내지 마라. 축약 순서(의도 표 → 차단 짧은 형태 → 후속 1건 → 차단 앞 n건 + 「외 n건 — 부록 D」)는 결정적이다. 이유:** plan R3-10 — 차단 발견 30건이면 48줄이 나와 §5.7·정책 §8.1(40줄)을 어기고 리뷰어가 게시 전에 요약 방식을 새로 정해야 한다. 생략분은 부록 D 에 전부 남는다.
- **부록 C 는 `validReviewers`에 있는 검토자의 배열 `findings`만 구조화한다 — `review-*.json`을 무조건 읽어 `.map`하지 마라. 이유:** plan R3-7 — Codex 가 `findings`를 문자열로 내면 `review-validate`는 INVALID 로 빼지만 render 가 TypeError 로 죽어 단일 모델 전환(§5.4)이 끝까지 동작하지 않는다. JSON 오류도 같은 경로.
- **`--resolve` 결정은 `findings.json`에 써서 영속화한다 — `verdict.json`에만 두지 마라. 이유:** R1-7 — 후보를 호출을 나눠 해결하면 앞선 결정이 사라진다. 기각 근거는 리포트 「리뷰어 결정」·부록 D에 남는다(§5.5-2).
- **`render`·`verdict`는 입력의 head 일치를 검증한다(`verdict.json`·`findings.json` ↔ `snapshot.json`). 이유:** R1-1·F6 — 같은 `W`에 남은 이전 실행의 APPROVE가 현재 head 의 판정으로 게시된다. 비-early에서 `verdict.json`이 없으면 리뷰 실패로 렌더한다.
- **부록 C·D에 근거·실패 시나리오·설계 내 수정 가능 여부·깨진 전제를 남겨라(마스킹은 전체 적용 뒤). 이유:** R1-9·§5.7 — 실행 블록 40줄은 제목만 담으므로, 사람이 차단 판단을 검증할 근거가 리포트 밖에 없다.
- (impl 2026-10-21 전사 수정, PF-7) CLI `.catch` 의 stderr 스택 출력은 프로그래밍 오류(TypeError·ReferenceError·RangeError·SyntaxError)로만 한정 — 도메인 오류는 stdout `ERR` 한 줄만(SC-6「stderr 없이」)
