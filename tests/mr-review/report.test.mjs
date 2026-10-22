// report 계약 테스트 (spec §5.5-4 · §5.7 · SC-3 verdict.json · SC-4 · SC-5)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, symlinkSync, rmSync, chmodSync, linkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { tmp, writeAdapter, initRepos, runCli, readJson, git, LIB, CLI } from './helpers.mjs';

const { computeVerdict, validateReview, maskText: deepMaskText } = await import(join(LIB, 'report.mjs'));
const { cleanup } = await import(join(LIB, 'report.mjs'));
const HEAD = 'a'.repeat(40);

const baseCheck = () => ({
  contract: { found: true, policyId: 'TEST-POLICY-v1.0', policyStatus: '채움(구버전)', lines: [{ name: 'Policy', status: '채움(구버전)', value: 'TEST-POLICY-v1.0' }, { name: 'Baseline', status: '채움', value: 'MR 본문 「배경」' }], complete: true, incompleteLines: [] },
  track: '경량', baselineType: 'MR 본문 배경', baselineLinks: [{ kind: 'body', status: '확보', file: 'baseline/1.md', version: HEAD, raw: 'MR 본문' }], reason: { why: true, what: true, source: 'body', text: '' },
  baselineCandidateFiles: [], baselineConfirm: { status: '없음', note_id: null, note_at: null, changed_at: null }, attachments: [], attachmentClaimedButMissing: false,
  deployRequired: false, deployExempt: false, deployNote: '비해당', rebase: { need: false, detailed_merge_status: 'mergeable' }, reviewerMismatch: false, priorVerdicts: [], authorTokens: [], ignoredComments: [],
  rereview: { active: false, prior_head: null, prior_verdict: null, prior_note_id: null }, earlyExit: { would: false, reason: '', draftVerdict: null },
});
const baseSnap = () => ({ mode: 'worktree', target_sha: 'b'.repeat(40), base_sha: 'b'.repeat(40), head_sha: HEAD, checkout: null, worktree: null, attempts: 1, unrecovered: [], rebuilt: [], fetched_at: '2026-10-21T01:00:00Z' });
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
  assert.equal(bad.err, '');   // PF-7: 도메인 오류는 stderr 없이 stdout ERR 한 줄(SC-6)
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
    writeFileSync(join(work, 'review-claude.json'), JSON.stringify({ reviewer: 'claude', head_sha: HEAD, findings: [{ lens: 'L5', type: 'DEFECT', title: '비밀번호 평문 로그 010-1234-5678', file: 'src/A.java', line_start: 3, line_end: 3, evidence: 'S1 · src/A.java:3 db.password = "synthetic-db-password"; cfg {"password": "synthetic-json-password"}; secret = "two word secret"; api_key: SYNTH-KEY-12345', scenario: '로그 유출', confidence: 'high', recommendation: '마스킹', fixableInDesign: 'yes', brokenPremise: '' }], intent: [], baselineCandidateRelevant: true }));
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
  assert.match(md, /\{"password" "\[masked:secret\]"\}; secret "\[masked:secret\]"/);   // 리포트는 필드 선마스킹 뒤 비밀값 키의 `:`·`=` 를 지운다(impl C1 N1)
  assert.match(md, /db\.password "\[masked:secret\]"/);
  assert.match(md, /src\/A\.java:3/);                              // 파일:줄 위치는 남는다(§5.7)
  assert.match(md, /기준선 확인 — /);                               // 경량 + 확인 댓글 없음 → 리뷰어가 먼저 게시할 문안
  assert.match(md, /기준선 미확인/);                                // 헤더 표시(F8)
  assert.match(md, /## 부록 A/);
  assert.match(md, /## 부록 B[\s\S]*wiki-private\/x\.md.*Codex 미제공/);
  assert.match(md, /## 부록 C[\s\S]*claude[\s\S]*codex/);
  assert.match(md, /## 부록 C[\s\S]*근거: S1 · src\/A\.java:3 db\.password "\[masked:secret\]"; cfg \{"password" "\[masked:secret\]"\}; secret "\[masked:secret\]"; api_key \[masked:secret\]\n  - 시나리오: 로그 유출\n  - 설계 내 수정: yes/);   // 원본 발견의 근거·시나리오 보존(R1-9) + 비밀값만 제거
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
  const { maskText } = { maskText: (t, r) => deepMaskText(t, r, [SHA]) };                // 보존 대상 = 아는 SHA(8b FR1-2)
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
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify(baseSnap()));                              // 우리 작업 디렉터리 표지(1.3.1 D26)
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
  assert.equal(ok.first, 'CLEANED worktree=false zip=1 raw=2 masked=1 extra=0');                                 // raw = codex.pid + pack-a.md
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
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify({ mode: 'worktree', checkout, worktree: join(work, 'worktree'), head_sha: headSha, fetched_at: '2026-10-21T01:00:00Z' }));
  writeFileSync(join(work, 'deploy.json'), JSON.stringify({ applicable: true, result: '대조 불가', zip: { attachment: 'd.zip' }, mismatches: [{ kind: 'download', path: null, detail: '다운로드 실패: 403 https://gitlab.test/u/d.zip?token=synthetic-credential-abc' }] }));
  writeFileSync(join(work, 'verdict.json'), JSON.stringify({ status: 'determined', verdict: 'HOLD_EVIDENCE', head_sha: headSha, machineEvidence: [{ id: 'M-baseline-1', kind: 'baseline', detail: '기준선·이슈 원문 미확보: https://gitlab.test/g/x.md?token=synthetic-credential-xyz — 담당 someone@example.test' }] }));
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.first, 'CLEANED worktree=true zip=1 raw=7 masked=5 extra=0');            // raw = codex.* 4 + pack-a·pack-b 2 + baseline 1 · masked = mr·check·deploy·review-claude·verdict
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

test('findings.json 검증: 문자열 blocking·모르는 type·중복 id·head 누락·없는 id 의 --resolve·깨진 JSON 은 조용히 APPROVE 하지 않고 ERR (impl SDD 이월 T06 우선 minor)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const cases = [
    [findings([F({ blocking: 'true' })]), /blocking/],
    [findings([F({ type: 'DEFCT' })]), /type/],
    [findings([F(), F()]), /중복 id/],
    [findings([F({ id: 'M-x' })]), /id/],
    [findings([F()], { head_sha: undefined }), /head_sha/],
    [findings([F()], { validReviewers: ['gemini'] }), /validReviewers/],
    [{ ...findings([]), findings: 'none' }, /findings/],
  ];
  for (const [fnd, re] of cases) {
    const work = fullWork(tmp(), { fnd });
    const r = runCli(['verdict', '--adapter', adapter, '--work', work]);
    assert.equal(r.code, 2, JSON.stringify(fnd));
    assert.match(r.first, /^ERR findings\.json 검증 실패: /);
    assert.match(r.first, re);
    assert.ok(!existsSync(join(work, 'verdict.json')));
  }
  const ok = fullWork(tmp(), { fnd: findings([F()]) });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', ok]).first, 'VERDICT determined CHANGES_REQUESTED');
  const r2 = runCli(['verdict', '--adapter', adapter, '--work', ok, '--resolve', 'F9=dismissed']);
  assert.equal(r2.code, 2);
  assert.match(r2.first, /^ERR --resolve F9: findings\.json 에 없는 id/);
  const broken = fullWork(tmp(), {});
  writeFileSync(join(broken, 'findings.json'), '{ "head_sha": ');
  const r3 = runCli(['verdict', '--adapter', adapter, '--work', broken]);
  assert.equal(r3.code, 2);
  assert.match(r3.first, /^ERR findings\.json JSON 파싱 실패/);
  assert.equal(r3.err, '');
});

test('발견 제목에 따옴표 없는 비밀값 키가 있어도 같은 줄의 파일:줄은 남는다 — 필드를 먼저 가리고 조립 (impl C1 N1 · R4-2 감사 이의, 추천 자동 채택(위임))', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const fnd = findings([F({ title: '하드코딩 token: ABC_VALUE', file: 'src/OnlyLocation.java', line_start: 71 })]);
  const work = fullWork(root, { fnd });
  const rc = JSON.parse(readFileSync(join(work, 'review-claude.json'), 'utf8'));
  Object.assign(rc.findings[0], { title: '하드코딩 token: ABC_VALUE', file: 'src/OnlyLocation.java', line_start: 71 });
  writeFileSync(join(work, 'review-claude.json'), JSON.stringify(rc));
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
  const out = join(root, 'report.md');
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  const md = readFileSync(out, 'utf8');
  assert.doesNotMatch(md, /ABC_VALUE/);
  const lines = md.split('\n').filter((l) => /하드코딩 token/.test(l));
  assert.ok(lines.length >= 3, md);                                                  // 실행 블록 · 부록 C · 부록 D
  for (const l of lines) assert.match(l, /src\/OnlyLocation\.java/, l);
});

test('빈 따옴표 비밀값 키(`password = ""`·`""값`)가 제목에 있어도 같은 줄의 파일:줄은 남는다 (impl C2 C1-1 잔존, 추천 자동 채택(위임))', () => {
  for (const title of ['password = ""LEAKY_TWO', 'password = ""']) {
    const root = tmp();
    const adapter = writeAdapter(root);
    const fnd = findings([F({ title, file: 'src/OnlyLocation.java', line_start: 71 })]);
    const work = fullWork(root, { fnd });
    const rc = JSON.parse(readFileSync(join(work, 'review-claude.json'), 'utf8'));
    Object.assign(rc.findings[0], { title, file: 'src/OnlyLocation.java', line_start: 71 });
    writeFileSync(join(work, 'review-claude.json'), JSON.stringify(rc));
    assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
    const out = join(root, 'report.md');
    const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
    assert.equal(rr.code, 0, rr.out + rr.err);
    const md = readFileSync(out, 'utf8');
    assert.doesNotMatch(md, /LEAKY_TWO/);
    const lines = md.split('\n').filter((l) => /password ""/.test(l));
    assert.ok(lines.length >= 3, md);                                                // 실행 블록 · 부록 C · 부록 D
    for (const l of lines) assert.match(l, /src\/OnlyLocation\.java/, l);
  }
});

test('발견 제목에 명령줄 비밀값 옵션(`--password 값`)이 있어도 같은 줄의 파일:줄은 남는다 — 줄 끝까지 가림이 조립 뒤 위치를 먹지 않게 (8b FC3-1 · 대장 48 감사 이의 재판정, 추천 자동 채택(위임))', () => {
  for (const title of ['CLI 노출 tool --password LEAK_CLI_1', 'CLI 노출 tool -token "a"\'LEAK_CLI_2 x\' --verbose', 'CLI 노출 tool --password LEAK\\ CLI_3']) {
    const root = tmp();
    const adapter = writeAdapter(root);
    const fnd = findings([F({ title, file: 'src/Unique.java', line_start: 37 })]);
    const work = fullWork(root, { fnd });
    const rc = JSON.parse(readFileSync(join(work, 'review-claude.json'), 'utf8'));
    Object.assign(rc.findings[0], { title, file: 'src/Unique.java', line_start: 37 });
    writeFileSync(join(work, 'review-claude.json'), JSON.stringify(rc));
    assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
    const out = join(root, 'report.md');
    const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
    assert.equal(rr.code, 0, rr.out + rr.err);
    const md = readFileSync(out, 'utf8');
    assert.doesNotMatch(md, /LEAK|CLI_3/);
    const lines = md.split('\n').filter((l) => /CLI 노출/.test(l));
    assert.ok(lines.length >= 3, md);                                                // 실행 블록 · 부록 C · 부록 D
    for (const l of lines) assert.match(l, /src\/Unique\.java/, l);
  }
});

test('발견 제목이 값 없이 비밀값 키로 끝나도(`--password`·`password =`·`DB_PASSWORD:`) 같은 줄의 파일:줄은 남는다 — 필드 끝이 뒤에 붙는 글을 먹으면 가림 표시로 봉인 (릴리스 전 확인 PR1 · FC3-1 잔존 · 대장 51 감사 이의 재판정)', () => {
  for (const title of ['CLI 노출 option --password', 'CLI 노출 설정 password =', 'CLI 노출 DB_PASSWORD:', 'CLI 노출 dbPassword=', 'CLI 노출 --token ']) {
    const root = tmp();
    const adapter = writeAdapter(root);
    const fnd = findings([F({ title, file: 'src/Unique.java', line_start: 37 })]);
    const work = fullWork(root, { fnd });
    const rc = JSON.parse(readFileSync(join(work, 'review-claude.json'), 'utf8'));
    Object.assign(rc.findings[0], { title, file: 'src/Unique.java', line_start: 37 });
    writeFileSync(join(work, 'review-claude.json'), JSON.stringify(rc));
    assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
    const out = join(root, 'report.md');
    const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
    assert.equal(rr.code, 0, rr.out + rr.err);
    const lines = readFileSync(out, 'utf8').split('\n').filter((l) => /CLI 노출/.test(l));
    assert.ok(lines.length >= 3, title);                                             // 실행 블록 · 부록 C · 부록 D
    for (const l of lines) assert.match(l, /src\/Unique\.java/, l);
  }
});

test('cleanup: 마스킹이 실패한 JSON 은 원문으로 남기지 않고 지운 뒤 나머지를 끝까지 정리하고 오류로 알린다 (impl C3 신규, 추천 자동 채택(위임))', () => {
  const root = tmp();
  const work = join(root, 'work');
  mkdirSync(join(work, 'zip'), { recursive: true });
  writeFileSync(join(work, 'zip', 'd.zip'), 'x');
  const sha = 'abcdef0123456789abcdef0123456789abcdef01';
  writeFileSync(join(work, 'mr.json'), JSON.stringify({ api_head: sha, description: 'password: synthetic-plain-secret' }));   // SHA 가 있어 깨는 규칙에 걸린다
  writeFileSync(join(work, 'check.json'), JSON.stringify({ reason: { text: '평문 아님' } }));                            // SHA 없음 — 정상 마스킹
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify(baseSnap()));
  const breaker = { mask: [{ name: 'pua', pattern: '[\\uE000-\\uF8FF]' }] };                                         // 로드 검증을 거치지 않은 어댑터 객체 — 실행 중 실패 경로
  assert.throws(() => cleanup({ work, adapter: breaker }), /마스킹 실패.*mr\.json/);
  assert.ok(!existsSync(join(work, 'mr.json')), 'mr.json 원문이 남았다');
  assert.ok(existsSync(join(work, 'check.json')));
  assert.doesNotMatch(readFileSync(join(work, 'check.json'), 'utf8'), /synthetic-plain-secret/);
  assert.ok(!existsSync(join(work, 'zip')));
});

test('리포트: 발견 근거에 못 가린 비밀값 꼴(짝 없는 여러 줄 XML 값)이 있으면 그 필드만 [masked:unmaskable] — 다음 줄 비밀값도 리포트에 없고 나머지는 남는다 (8b FR2-3 FC1 재판정)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const fnd = findings([F({ evidence: '설정 발췌 <property name="password"><value>\nRENDER_MULTI_SECRET', title: '설정 평문 비밀번호' })]);
  const work = fullWork(root, { fnd });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT determined CHANGES_REQUESTED');
  const out = join(root, 'r.md');
  const r = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(r.code, 0, r.out + r.err);
  const md = readFileSync(out, 'utf8');
  assert.doesNotMatch(md, /RENDER_MULTI_SECRET/);
  assert.match(md, /근거: \[masked:unmaskable\]/);
  assert.match(md, /설정 평문 비밀번호/);                                                   // 다른 필드는 그대로
});

test('머지 뒤 리뷰: mr.state 가 merged·closed 면 헤더에 「머지 뒤 리뷰」 1줄, opened 면 없다 — 판정 블록은 같다 (1.3.1 AC②-8 · D29)', () => {
  const blocks = {};
  for (const state of ['merged', 'closed', 'opened']) {
    const root = tmp();
    const adapter = writeAdapter(root);
    const work = fullWork(root, { fnd: findings([]), mr: { state } });
    assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
    const out = join(root, 'r.md');
    const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
    assert.equal(rr.code, 0, rr.out + rr.err);
    const md = readFileSync(out, 'utf8');
    const header = md.split('\n## ')[0];
    if (state === 'opened') assert.doesNotMatch(md, /머지 뒤 리뷰/);
    else assert.match(header, new RegExp(`^- \\*\\*머지 뒤 리뷰\\*\\* — MR state=${state}\\. 작성자 보완 요청은 이 MR이 아니라 후속 MR로$`, 'm'));
    blocks[state] = md.match(/```text\n([\s\S]*?)\n```/)[1];
  }
  assert.equal(blocks.merged, blocks.opened);                         // 판정 계산·실행 블록 불변(D9 무관)
});

// ── 1.3.1 ⑤ cleanup 허용 목록 (spec 2026-10-22 3.⑤) ──
const ALLOWED9 = ['snapshot.json', 'pack.json', 'mr.json', 'check.json', 'deploy.json', 'review-claude.json', 'review-codex.json', 'findings.json', 'verdict.json'];

test('cleanup: 허용 9종 밖의 항목(zipx/·claude.prompt·tmp/·숨김 파일)은 전부 지우고 extra=<n> + 둘째 줄에 이름을 적는다 (1.3.1 AC⑤-1 · D23·D34)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]) });
  mkdirSync(join(work, 'zipx'), { recursive: true });
  writeFileSync(join(work, 'zipx', 'x.js'), '배포본 원문');
  writeFileSync(join(work, 'claude.prompt'), '팩 A 원문');
  mkdirSync(join(work, 'tmp'), { recursive: true });
  writeFileSync(join(work, 'tmp', 'a.txt'), 'x');
  writeFileSync(join(work, '.hidden'), 'x');
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, / extra=4$/);
  assert.equal(r.out.split('\n')[1], 'extra: .hidden, claude.prompt, tmp/, zipx/');
  const left = readdirSync(work).sort();
  assert.ok(left.every((n) => ALLOWED9.includes(n)), JSON.stringify(left));
  assert.ok(left.includes('snapshot.json') && left.includes('pack.json'));
  const clean = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.match(clean.first, / extra=0$/);
  assert.equal(clean.out.split('\n').length, 1);                     // 지운 추가 항목이 없으면 둘째 줄 없음
});

test('cleanup: snapshot.json 이 없거나 우리 형식이 아니면 아무것도 지우지 않고 ERR exit 2 (1.3.1 AC⑤-2 · D26)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const cases = [
    ['none', null, /^ERR snapshot\.json 없음 — mr-review 작업 디렉터리로 확인되지 않아 정리하지 않는다: a\.txt, notes\/, worktree\/$/],
    ['foreign', '{"foo":1}', /^ERR snapshot\.json 형식 불일치 — mr-review 작업 디렉터리로 확인되지 않아 정리하지 않는다: a\.txt, notes\/, snapshot\.json, worktree\/$/],
    ['short-sha', JSON.stringify({ mode: 'worktree', head_sha: 'abc', fetched_at: 'x' }), /^ERR snapshot\.json 형식 불일치/],
    ['bad-mode', JSON.stringify({ mode: 'other', head_sha: HEAD, fetched_at: 'x' }), /^ERR snapshot\.json 형식 불일치/],
    ['no-fetched', JSON.stringify({ mode: 'diff-only', head_sha: HEAD }), /^ERR snapshot\.json 형식 불일치/],
    ['broken', '{not json', /^ERR snapshot\.json 형식 불일치/],
  ];
  for (const [name, snap, re] of cases) {
    const work = join(root, name);
    mkdirSync(join(work, 'notes'), { recursive: true });
    mkdirSync(join(work, 'worktree'), { recursive: true });
    writeFileSync(join(work, 'a.txt'), 'keep');
    writeFileSync(join(work, 'notes', 'n.md'), 'keep');
    if (snap !== null) writeFileSync(join(work, 'snapshot.json'), snap);
    const before = readdirSync(work).sort();
    const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
    assert.equal(r.code, 2, `${name}: ${r.out}`);
    assert.match(r.first, re, name);
    assert.deepEqual(readdirSync(work).sort(), before, name);
    assert.equal(readFileSync(join(work, 'notes', 'n.md'), 'utf8'), 'keep');
    if (snap !== null) assert.equal(readFileSync(join(work, 'snapshot.json'), 'utf8'), snap);
  }
  const r0 = runCli(['cleanup', '--adapter', adapter, '--work', join(root, 'absent')]);   // W 자체가 없음(collect 가 snapshot 전에 실패) — 목록 (없음)
  assert.equal(r0.code, 2);
  assert.match(r0.first, /^ERR snapshot\.json 없음 — .*: \(없음\)$/);
});

test('cleanup 뒤 --resolve 재실행(verdict --resolve → render)이 성공한다 — 허용 목록이 재실행 입력을 전부 보존 (1.3.1 AC⑤-4)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([F({ unresolved: true, confidence: 'low', source: 'claude' })]) });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT undetermined -');
  writeFileSync(join(work, 'claude.prompt'), '팩 A 원문');
  assert.equal(runCli(['cleanup', '--adapter', adapter, '--work', work]).code, 0);
  const rv = runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=confirmed']);
  assert.equal(rv.first, 'VERDICT determined CHANGES_REQUESTED', rv.out);
  const out = join(root, 'after.md');
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  assert.equal(rr.first, `REPORT ${out}`);
});

test('cleanup: 보존 JSON 이 W 밖 파일의 하드 링크여도 외부 원본은 바뀌지 않고 W 사본만 마스킹된다 — 새 파일 + rename 교체 (1.3.1 R4-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]) });
  const outside = join(root, 'outside-review.json');
  const body = readFileSync(join(work, 'review-claude.json'), 'utf8');
  rmSync(join(work, 'review-claude.json'));
  writeFileSync(outside, body);
  linkSync(outside, join(work, 'review-claude.json'));
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(readFileSync(outside, 'utf8'), body);               // 외부 원본 바이트 불변
  const kept = readFileSync(join(work, 'review-claude.json'), 'utf8');
  assert.ok(!kept.includes('synthetic-db-password'));              // W 사본은 마스킹됐다
  assert.equal(statSync(join(work, 'review-claude.json')).nlink, 1);
  assert.deepEqual(readdirSync(work).filter((n) => n.startsWith('.')), []);   // 임시 파일 잔존 없음
});

test('cleanup: 지운 추가 항목 이름(extra:)과 표지 ERR 의 W 항목 목록도 어댑터·비밀값 마스킹을 거쳐 출력한다 (1.3.1 R5-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]) });
  writeFileSync(join(work, 'token=SYNTHETIC_FILENAME_SECRET.prompt'), 'raw');
  writeFileSync(join(work, '010-1234-5678.txt'), 'raw');
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, / extra=2$/);
  assert.doesNotMatch(r.out + r.err, /SYNTHETIC_FILENAME_SECRET|010-1234-5678/);
  assert.match(r.out, /^extra: .*\[masked:/m);
  assert.ok(!readdirSync(work).some((n) => n.includes('SYNTHETIC') || n.includes('010-')));
  const foreign = join(root, 'foreign');
  mkdirSync(foreign, { recursive: true });
  writeFileSync(join(foreign, 'token=SYNTHETIC_FILENAME_SECRET.prompt'), 'raw');
  const e = runCli(['cleanup', '--adapter', adapter, '--work', foreign]);
  assert.equal(e.code, 2, e.out);
  assert.match(e.first, /^ERR snapshot\.json 없음/);
  assert.doesNotMatch(e.out + e.err, /SYNTHETIC_FILENAME_SECRET/);
  assert.ok(existsSync(join(foreign, 'token=SYNTHETIC_FILENAME_SECRET.prompt')));   // 무삭제
});

test('cleanup: 마스킹 임시 경로(.mr.json.masking)에 디렉터리가 있어도 정리를 끝까지 한다 (1.3.1 R5-2)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]) });
  mkdirSync(join(work, '.mr.json.masking', 'sub'), { recursive: true });
  writeFileSync(join(work, '.mr.json.masking', 'sub', 'x'), 'raw');
  writeFileSync(join(work, 'claude.prompt'), 'raw');
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, /^CLEANED .* masked=\d+ extra=2$/);           // claude.prompt + 충돌 디렉터리 — 임시 이름이 매번 새 이름이라 부딪히지 않고, 충돌 항목은 허용 목록 정리가 지운다
  assert.ok(existsSync(join(work, 'mr.json')));
  assert.deepEqual(readdirSync(work).filter((n) => n.startsWith('.') || n === 'claude.prompt'), []);
});

test('cleanup: 지울 수 없는 항목(권한)이 있어도 나머지 마스킹·정리를 끝까지 하고 남은 항목을 ERR 로 보고한다 (1.3.1 R5-2 잔존 · C1)', { skip: process.getuid?.() === 0 && 'root 는 권한 오류가 나지 않는다' }, () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]) });
  const locked = join(work, '.mr.json.masking');
  mkdirSync(join(locked, 'sub'), { recursive: true });
  writeFileSync(join(locked, 'sub', 'x'), 'raw');
  writeFileSync(join(work, 'claude.prompt'), 'raw');
  chmodSync(locked, 0o500);
  let r;
  try { r = runCli(['cleanup', '--adapter', adapter, '--work', work]); } finally { chmodSync(locked, 0o700); }
  assert.equal(r.code, 2, r.out + r.err);
  assert.match(r.first, /^ERR .*정리하지 못한 항목: \.mr\.json\.masking\//);
  assert.ok(!readFileSync(join(work, 'review-claude.json'), 'utf8').includes('synthetic-db-password'));   // 마스킹은 끝까지 했다
  assert.ok(!existsSync(join(work, 'claude.prompt')));                // 나머지 정리도 했다
  assert.deepEqual(readdirSync(work).filter((n) => n.endsWith('.masking') && n !== '.mr.json.masking'), []);
});

test('cleanup: 마스킹 사본 교체와 원문 삭제가 함께 실패하면(읽기 전용 W) 「지웠다」가 아니라 원문 잔존으로 보고한다 (1.3.1 R6-1)', { skip: process.getuid?.() === 0 && 'root 는 권한 오류가 나지 않는다' }, () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]) });
  rmSync(join(work, 'baseline'), { recursive: true, force: true });
  chmodSync(work, 0o500);                                            // 새 파일도 못 쓰고 지우지도 못한다
  let r;
  try { r = runCli(['cleanup', '--adapter', adapter, '--work', work]); } finally { chmodSync(work, 0o700); }
  assert.equal(r.code, 2, r.out + r.err);
  assert.doesNotMatch(r.first, /원문을 남기지 않고 지웠다/);
  assert.match(r.first, /정리하지 못한 항목: .*review-claude\.json\([^)]*원문 잔존\)/);
  assert.ok(existsSync(join(work, 'review-claude.json')));           // 실제로 남아 있다 — 보고와 일치
});

test('cleanup: 표지 ERR 의 항목 목록은 조회 실패(권한 등)를 「(없음)」으로 보고하지 않는다 — 없는 W 만 「(없음)」 (1.3.1 R3-1 · D33)', { skip: process.getuid?.() === 0 && 'root 는 권한 오류가 나지 않는다' }, () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = join(root, 'locked');
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'claude.prompt'), 'raw');
  chmodSync(work, 0o300);                                            // 목록 읽기 불가(쓰기·통과는 가능)
  let r;
  try { r = runCli(['cleanup', '--adapter', adapter, '--work', work]); } finally { chmodSync(work, 0o700); }
  assert.equal(r.code, 2, r.out);
  assert.doesNotMatch(r.first, /\(없음\)/);
  assert.match(r.first, /항목 목록 조회 실패\(EACCES\)/);
  assert.ok(existsSync(join(work, 'claude.prompt')));
  const gone = runCli(['cleanup', '--adapter', adapter, '--work', join(root, 'never-made')]);
  assert.equal(gone.code, 2, gone.out);
  assert.match(gone.first, /^ERR snapshot\.json 없음 — .*정리하지 않는다: \(없음\)$/);
});

test('cleanup: W 밖 디렉터리를 가리키는 심볼릭 링크는 링크만 지우고 대상은 건드리지 않는다 (1.3.1 AC⑤-5)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]) });
  const outside = join(root, 'outside');
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, 'keep.txt'), 'keep');
  symlinkSync(outside, join(work, 'link'));
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, / extra=1$/);
  assert.ok(!readdirSync(work).includes('link'));
  assert.deepEqual(readdirSync(outside), ['keep.txt']);
  assert.equal(readFileSync(join(outside, 'keep.txt'), 'utf8'), 'keep');
});

test('cleanup: 허용 JSON 이름(mr.json)이 W 밖 파일을 가리키는 심볼릭 링크면 대상을 읽거나 덮어쓰지 않고 링크만 지운다 (1.3.1 R1-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]) });
  const outside = join(root, 'outside.json');
  const body = '{"secret":"db.password = \\"synthetic-db-password\\"","n":1}';
  writeFileSync(outside, body);
  rmSync(join(work, 'mr.json'));
  symlinkSync(outside, join(work, 'mr.json'));
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(readFileSync(outside, 'utf8'), body);             // 대상 바이트 불변(마스킹 사본으로 덮어쓰지 않음)
  assert.ok(!readdirSync(work).includes('mr.json'));             // 링크는 허용 9종이 아니다 — 지운다
  assert.match(r.out, /^extra: .*mr\.json/m);
});

test('SKILL.md: §0 공통 종료 절차에 cleanup ERR 목록이 비었을 때(없음)의 정상 종료 안내 · §8 cleanup 첫 줄 extra=<n> (1.3.1 AC⑤-6 · D33)', () => {
  const skill = readFileSync(join(CLI, '..', '..', 'SKILL.md'), 'utf8');
  const s0 = skill.slice(skill.indexOf('## 0. 전제 확인'), skill.indexOf('## 1. 작업 디렉터리'));
  assert.match(s0, /항목 목록이 `\(없음\)`이면 지울 것이 없는 정상 종료/);
  assert.match(s0, /허용 9종/);
  const s8 = skill.slice(skill.indexOf('## 8. 출력 · 정리'), skill.indexOf('## 9.'));
  assert.match(s8, /CLEANED worktree=<b> zip=<n> raw=<n> masked=<n> extra=<n>/);
  assert.match(s8, /snapshot\.json/);
});

test('SKILL.md §5 경로 감시: 제외 3종(CODEX_HOME 전체 · $ROOT · $W) + 위키 루트 우선 + 터미널 요약 「Codex 자체 경로 n건 제외」 (1.3.1 AC⑧-1 · D32)', () => {
  const skill = readFileSync(join(CLI, '..', '..', 'SKILL.md'), 'utf8');
  const item = skill.split('\n').find((l) => l.startsWith('- **경로 감시**'));
  assert.ok(item, '§5 경로 감시 항목');
  for (const re of [/\$CODEX_HOME/, /~\/\.codex\//, /\$ROOT/, /\$W/, /위키 루트[^。\n]*제외 3종 안에 있어도/, /제외/, /「Codex 자체 경로 n건 제외」/]) assert.match(item, re);
  const s8 = skill.slice(skill.indexOf('## 8. 출력 · 정리'), skill.indexOf('## 9.'));
  assert.match(s8, /Codex 자체 경로 n건 제외/);
});

// ── 1.3.2 ⑨ 표시 · ⑪ 불일치 목록 = 부록 A 한 곳, 본문은 요약 + 참조 (spec 2026-10-22 3.⑨ 5 · 3.⑪) ──
const { machineEvidence, mismatchSummary } = await import(join(LIB, 'report.mjs'));
const { parseAppendixD } = await import(join(LIB, 'check.mjs'));
const sectionOf = (md, start, end) => { const i = md.indexOf(start); const j = end ? md.indexOf(end, i + 1) : -1; return md.slice(i, j < 0 ? undefined : j); };
function renderWith(root, deploy, name = 'r.md') {
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]), deploy });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
  const out = join(root, name);
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  return readFileSync(out, 'utf8');
}
const pad = (i) => String(i).padStart(2, '0');
const MISS19 = Array.from({ length: 19 }, (_, i) => ({ kind: 'missing_in_zip', path: `src/main/java/com/example/acct/C${pad(i + 1)}.java`, detail: '배포 목록에 있으나 zip 에 없음' }));
const EXTRA19 = Array.from({ length: 19 }, (_, i) => ({ kind: 'extra_in_zip', path: `WEB-INF/classes/com/example/acct/C${pad(i + 1)}.class`, detail: 'zip 에 있으나 배포 목록에 없음' }));
const deploy38 = () => ({ ...baseDeploy(), applicable: true, reason: null, expected: { deploy: MISS19.map((m) => m.path), deleted: [] }, zip: { attachment: 'd.zip', downloaded: true, comment_sha: HEAD, entries: EXTRA19.map((m) => m.path), bytes_source: 'worktree', layout: 'source', bytes_skipped: [] }, result: '불일치', mismatches: [...MISS19, ...EXTRA19] });

test('render: bytes_skipped 2건 → 실행 블록 「2. 검증 상태」·부록 A 에 「바이트 대조 생략 2건(컴파일 산출물 — 존재만 확인)」 + 부록 A 에 경로 각 1줄 · 0건이면 문구 없음 · SKILL §8 터미널 요약에 문구 (1.3.2 AC⑨-10 · D47)', () => {
  const SK = ['WEB-INF/classes/com/example/acct/Foo$1.class', 'WEB-INF/classes/com/example/acct/Foo.class'];
  const d = { ...baseDeploy(), applicable: true, reason: null, expected: { deploy: ['src/main/java/com/example/acct/Foo.java'], deleted: [] }, zip: { attachment: 'd.zip', downloaded: true, comment_sha: HEAD, entries: SK, bytes_source: 'worktree', layout: 'maven-war', bytes_skipped: SK }, result: '일치', mismatches: [] };
  const md = renderWith(tmp(), d);
  const PHRASE = '바이트 대조 생략 2건(컴파일 산출물 — 존재만 확인)';
  const block = md.match(/```text\n([\s\S]*?)\n```/)[1];
  const s2 = block.split('\n').find((l) => l.startsWith('- [실행] 배포본 zip 대조'));
  assert.ok(s2 && s2.includes(PHRASE), s2);
  const appA = sectionOf(md, '## 부록 A', '## 부록 B');
  assert.ok(appA.includes(PHRASE));
  for (const p of SK) assert.ok(appA.split('\n').some((l) => l.trim() === `- ${p}`), p);
  assert.ok(!sectionOf(md, '# mr-review', '## 판정 초안').includes('바이트 대조 생략'));   // 헤더에는 넣지 않는다(D47)
  const md0 = renderWith(tmp(), { ...d, zip: { ...d.zip, bytes_skipped: [] } });
  assert.ok(!md0.includes('바이트 대조 생략'));
  const skill = readFileSync(join(CLI, '..', '..', 'SKILL.md'), 'utf8');
  const s8 = skill.slice(skill.indexOf('## 8. 출력 · 정리'), skill.indexOf('## 9.'));
  assert.match(s8, /배포본 대조 결과[^\n]*바이트 대조 생략/);
});

test('render: 불일치 38건 — 4번째 이후 경로는 부록 A 에만 · 실행 블록·보완 문안·부록 D 는 종류별 건수 + 앞 3개 + 「외 n건」 + 「 · 전체 목록 부록 A」, 줄 < 400자 · 부록 D 파서가 제목을 자르지 않는다 (1.3.2 AC⑪-1 · AC⑪-5)', () => {
  const md = renderWith(tmp(), deploy38());
  const appA = sectionOf(md, '## 부록 A', '## 부록 B');
  const lines = md.split('\n');
  const c04 = lines.filter((l) => l.includes('C04.java'));
  assert.equal(c04.length, 1, c04.join('\n'));
  assert.ok(appA.includes(c04[0]));
  for (const m of MISS19) assert.ok(appA.split('\n').includes(`- missing_in_zip ${m.path}: 배포 목록에 있으나 zip 에 없음`), m.path);   // AC⑪-5 전문 형식 불변
  const block = md.match(/```text\n([\s\S]*?)\n```/)[1];
  const sup = sectionOf(md, '## 작성자 보완 요청 문안', '\n## ');
  const appD = sectionOf(md, '## 부록 D');
  const targets = [
    block.split('\n').find((l) => l.startsWith('- [실행] 배포본 zip 대조')),
    block.split('\n').find((l) => l.startsWith('- 머지 전:')),
    block.split('\n').find((l) => l.startsWith('- M-deploy ')),
    sup.split('\n').find((l) => l.includes('배포본 대조 결과')),
    appD.split('\n').find((l) => l.startsWith('- **M-deploy**')),
  ];
  for (const l of targets) {
    assert.ok(l, '대상 줄');
    for (const s of ['missing_in_zip 19건(', '외 16건', 'extra_in_zip 19건(', ' · 전체 목록 부록 A']) assert.ok(l.includes(s), `${s} ∉ ${l}`);
    assert.ok(l.length < 400, `${l.length}자: ${l.slice(0, 80)}`);
  }
  assert.ok(targets[0].includes('missing_in_zip 19건(src/main/java/com/example/acct/C01.java, src/main/java/com/example/acct/C02.java, src/main/java/com/example/acct/C03.java 외 16건)'));
  const t = parseAppendixD(md).get('M-deploy').title;
  assert.ok(t.startsWith('배포본 불일치 — ') && t.endsWith(' · 전체 목록 부록 A'), t);
});

test('render: 보완 문안의 배포본 항목은 1개 · 「배포 목록에 있으나 zip 에 없음」은 리포트 전체에서 부록 A 의 19줄에만 (1.3.2 AC⑪-2)', () => {
  const md = renderWith(tmp(), deploy38());
  const sup = sectionOf(md, '## 작성자 보완 요청 문안', '\n## ');
  assert.equal(sup.split('\n').filter((l) => l.includes('배포본 대조 결과')).length, 1);
  assert.equal(md.split('배포 목록에 있으나 zip 에 없음').length - 1, 19);
  assert.equal(sectionOf(md, '## 부록 A', '## 부록 B').split('배포 목록에 있으나 zip 에 없음').length - 1, 19);
});

test('render: path 없는 종류(deleted_list)만이면 요약은 종류 이름만 — 「전체 목록 부록 A」 없음 (1.3.2 AC⑪-3)', () => {
  const d = baseDeploy(); d.applicable = true; d.result = '불일치'; d.mismatches = [{ kind: 'deleted_list', path: null, detail: '삭제 목록 불일치' }];
  const md = renderWith(tmp(), d);
  assert.match(md, /## 부록 D[\s\S]*- \*\*M-deploy\*\* \[기계\] MISSING_EVIDENCE \(차단\) — 배포본 불일치 — deleted_list \(-:-\) · 출처 machine/);
  assert.ok(!md.includes('전체 목록 부록 A'));
});

test('machineEvidence: M-deploy detail = 종류 등장 순 · 경로 등장 순 요약 (1.3.2 AC⑪-4)', () => {
  const d = { applicable: true, result: '불일치', mismatches: [{ kind: 'comment_sha', path: null, detail: 'x' }, { kind: 'bytes', path: 'src/b.js', detail: 'y' }, { kind: 'bytes', path: 'src/a.js', detail: 'z' }] };
  const m = machineEvidence({ check: {}, snapshot: {}, deploy: d }).find((x) => x.id === 'M-deploy');
  assert.equal(m.detail, '배포본 불일치 — comment_sha · bytes 2건(src/b.js, src/a.js) · 전체 목록 부록 A');
  assert.equal(mismatchSummary({ mismatches: [] }), '');
});

// ── 1.3.2 ⑫ 의도 대조표 병합 키 = intent[].row (spec 2026-10-22 3.⑫ D41·D44·D50·D51) ──
const skillText = () => readFileSync(join(CLI, '..', '..', 'SKILL.md'), 'utf8');
test('SKILL.md §5: 공통 입력 5 에 행 번호·총 n행·이어 세기·목록 항목 · 출력 스키마 intent 에 "row" (1.3.2 AC⑫-1)', () => {
  const skill = skillText();
  const s5 = skill.slice(skill.indexOf('## 5. 독립 병렬 검토'), skill.indexOf('## 6. 병합'));
  const in5 = s5.split('\n').find((l) => l.startsWith('5. 의도 대조표 입력'));
  assert.ok(in5, '공통 입력 5');
  for (const re of [/행 번호/, /총 n행/, /이어 센다/, /목록 항목/, /mr\.json\.description/]) assert.match(in5, re);
  const schema = s5.slice(s5.indexOf('```text'), s5.indexOf('\n```\n', s5.indexOf('```text')));   // 스키마 첫 줄의 인라인 ```json … ``` 표기를 건너뛰고 펜스 닫는 줄까지
  assert.match(schema.split('\n').find((l) => l.includes('"intent"')), /"row": /);
});

test('SKILL.md §6-5: row 번호 기준 병합 · criterion = 메인이 검증 표에서 읽은 원문 · 한쪽에만·누락·범위 밖·중복 처리 · §6-6 예시 intent 에 "row" (1.3.2 AC⑫-2)', () => {
  const skill = skillText();
  const s6 = skill.slice(skill.indexOf('## 6. 병합'), skill.indexOf('## 7. 재리뷰'));
  const r5 = s6.split('\n').find((l) => l.startsWith('5. `intent`'));
  assert.ok(r5, '§6-5');
  for (const re of [/`row` 번호 기준/, /`criterion`[^\n]*메인이[^\n]*원문/, /한쪽에만/, /누락/, /배열 순서/, /범위 밖/, /중복/, /intent 행 번호 누락/]) assert.match(r5, re);
  const ex = s6.slice(s6.indexOf('```json'), s6.indexOf('```', s6.indexOf('```json') + 7));
  assert.match(ex.split('\n').find((l) => l.includes('"intent"')), /"row": /);
});
