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
  const ok = { reviewer: 'claude', head_sha: HEAD, findings: [{ lens: 'L1', type: 'FOLLOW_UP', title: 't', file: null, line_start: 0, line_end: 0, evidence: '', scenario: '', confidence: 'low', recommendation: '', fixableInDesign: 'yes', brokenPremise: '' }], intent: [], baselineCandidateRelevant: true, decisions: [] };
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
  writeFileSync(good, JSON.stringify({ reviewer: 'codex', head_sha: HEAD, findings: [], intent: [], baselineCandidateRelevant: false, decisions: [] }));
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

test('cleanup: verdict.json 이 W 밖 판정 사본을 가리키는 심볼릭 링크면 지문이 맞아도 따라가 읽거나 일반 파일로 바꿔 쓰지 않는다 — 원문 비밀값이 W 에 남지 않는다 (1.4.0 impl R1-1)', async () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(join(root, 'w'), { fnd: findings([]) });
  const outside = join(root, 'verdict-backup.json');
  const body = JSON.stringify({ status: 'determined', verdict: 'APPROVE', head_sha: HEAD, findingsDigest: (await import('node:crypto')).createHash('sha256').update(readFileSync(join(work, 'findings.json'))).digest('hex'), note: 'password=hunter2pass' });
  writeFileSync(outside, body);
  rmSync(join(work, 'verdict.json'), { force: true });
  symlinkSync(outside, join(work, 'verdict.json'));
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(readFileSync(outside, 'utf8'), body);                                             // 대상 불변
  for (const f of readdirSync(work)) if (statSync(join(work, f)).isFile()) assert.doesNotMatch(readFileSync(join(work, f), 'utf8'), /hunter2pass/, f);
  assert.ok(!readdirSync(work).includes('verdict.json'));                                         // 링크는 지운다(허용 9종 = 일반 파일만)
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

// 1.3.2 ⑩(D39)에서 제외 3종 → 5종 · 터미널 요약 문구 「경로 감시 제외 n건(…)」으로 갱신(spec 2026-10-22 AC⑩-1·2)
test('SKILL.md §5 경로 감시: 제외 5종 중 (가)~(다)(CODEX_HOME 전체 · $ROOT · $W) + 위키 루트 우선 + 터미널 요약 「경로 감시 제외 n건(Codex 자체 …)」 (1.3.1 AC⑧-1 · D32 → 1.3.2 D39)', () => {
  const skill = readFileSync(join(CLI, '..', '..', 'SKILL.md'), 'utf8');
  const item = skill.split('\n').find((l) => l.startsWith('- **경로 감시**'));
  assert.ok(item, '§5 경로 감시 항목');
  for (const re of [/\$CODEX_HOME/, /~\/\.codex\//, /\$ROOT/, /\$W/, /위키 루트[^。\n]*제외 5종 안에 있어도/, /제외/, /「경로 감시 제외 n건\(Codex 자체 a/]) assert.match(item, re);
  const s8 = skill.slice(skill.indexOf('## 8. 출력 · 정리'), skill.indexOf('## 9.'));
  assert.match(s8, /경로 감시 제외 n건\(Codex 자체/);
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

// ── 1.3.2 ⑩ 경로 감시 제외 (라)(마) (spec 2026-10-22 3.⑩ D39·D48·D49) ──
test('SKILL.md §5 경로 감시 제외 (라) 명령 실행기·시스템 실행 파일 · (마) 존재하지 않는 경로(잘린 후보는 디렉터리로 검사) · /etc/ 는 제외하지 않음 (1.3.2 AC⑩-1 · D48·D49)', () => {
  const item = skillText().split('\n').find((l) => l.startsWith('- **경로 감시**'));
  for (const s of ['(라)', '(마)', 'Running command', 'Command completed', '/bin/bash', '/usr/bin/', '/usr/local/lib/', '/usr/share/', '/opt/homebrew/', 'C:\\Windows\\', '[ -e ', '존재하지 않', '잘린', '...']) assert.ok(item.includes(s), s);
  assert.match(item, /`\/etc\/`[^。\n]*제외하지 않는다/);
  assert.match(item, /\(가\)~\(마\)|제외 5종/);
  assert.match(item, /`cat`·`ls`로 열지 않는다/);
});

test('SKILL.md §5 경로 감시: `.`·`..` 성분이 든 후보는 제외 5종 어디에도 넣지 않고 그대로 적는다(접두가 실제 위치가 아님) (1.3.2 R1-2)', () => {
  const item = skillText().split('\n').find((l) => l.startsWith('- **경로 감시**'));
  assert.match(item, /`\.`·`\.\.` 성분이 든 후보[^\n]*제외 5종 어디에도 넣지 않고 그대로 적는다/);
  assert.ok(item.includes('/usr/share/../../etc/passwd'));
});

test('SKILL.md §5 경로 감시: 제외 (가)~(라) 후보는 realpath 로 링크를 푼 실제 경로로 다시 판정 — 제외 영역 밖·위키 루트 안·실제 경로 확인 불가면 제외하지 않는다 (1.3.2 R3-2)', () => {
  const item = skillText().split('\n').find((l) => l.startsWith('- **경로 감시**'));
  assert.ok(item.includes('realpath'));
  assert.ok(item.includes('/usr/share/locale/locale.alias'));
  assert.match(item, /실제 경로가[^\n]*위키 루트 안이면 제외하지 않/);
  assert.match(item, /실제 경로를 구하지 못하면[^\n]*제외하지 않는다/);
});

test('SKILL.md 터미널 요약: 「경로 감시 제외 n건(Codex 자체 a · 시스템 실행 파일 b · 존재하지 않는 경로 c)」 — §5 끝과 §8 둘 다 (1.3.2 AC⑩-2 · D39)', () => {
  const skill = skillText();
  const item = skill.split('\n').find((l) => l.startsWith('- **경로 감시**'));
  const s8 = skill.slice(skill.indexOf('## 8. 출력 · 정리'), skill.indexOf('## 9.'));
  for (const t of [item, s8]) assert.ok(t.includes('경로 감시 제외 n건(Codex 자체 a · 시스템 실행 파일 b · 존재하지 않는 경로 c)'));
  assert.ok(!skill.includes('Codex 자체 경로 n건 제외'));
});

// ── 1.3.3 ⑭ 표 셀 정규화 cell() (spec 2026-10-23 3.⑭ D56 · R3-2·R4-1·R6-1·C2-N1) ──
const cellsOf = (row) => row.split(/(?<!\\)\|/).slice(1, -1);
function renderIntent(root, intent, { check = baseCheck(), name = 'r.md' } = {}) {
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([], { intent }), check });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
  const out = join(root, name);
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  return readFileSync(out, 'utf8');
}
const intentRows = (md) => { const b = md.match(/```text\n([\s\S]*?)\n```/)[1].split('\n'); const i = b.indexOf('|---|---|---|'); return b.slice(i + 1, b.indexOf('2. 검증 상태')); };

test('render: 의도 대조표 셀의 `|` 는 `\\|` 로 · 줄바꿈은 공백 하나로 — 칸 수 3 유지 (1.3.3 AC⑭-1)', () => {
  const md = renderIntent(tmp(), [{ criterion: 'a | b', result: 'PASS', location: 'x.java:10\ny' }]);
  const rows = intentRows(md);
  assert.deepEqual(rows, ['| a \\| b | PASS | x.java:10 y (작성자 주장) |']);
  assert.equal(cellsOf(rows[0]).length, 3);
  assert.equal(cellsOf(renderIntent(tmp(), [{ criterion: 'a \\| b', result: 'PASS', location: '-' }]).split('\n').find((l) => l.startsWith('| a '))).length, 3);   // 이미 `\|` 면 그대로(이중 이스케이프 없음)
  assert.ok(renderIntent(tmp(), [{ criterion: 'a \\| b', result: 'PASS', location: '-' }]).includes('| a \\| b | PASS |'));
});

test('render: 부록 A 검사표 값 칸의 `|` 도 이스케이프 — 첨부 파일명·무시한 댓글 사유 행의 칸 수 2 (1.3.3 AC⑭-2)', () => {
  const c = baseCheck();
  c.attachments = [{ kind: 'zip', filename: 'a|b.zip', where: 'body' }];
  c.ignoredComments = [{ note_id: 5, reason: 'x|y' }];
  const md = renderIntent(tmp(), [], { check: c });
  const appA = sectionOf(md, '## 부록 A', '## 부록 B').split('\n');
  const att = appA.find((l) => l.startsWith('| 첨부 |'));
  const ign = appA.find((l) => l.startsWith('| 무시한 댓글 |'));
  assert.equal(att, '| 첨부 | zip:a\\|b.zip |');
  assert.equal(ign, '| 무시한 댓글 | #5(x\\|y) |');
  for (const l of [att, ign]) assert.equal(cellsOf(l).length, 2, l);
});

test('render: 표 셀 마스킹 순서 = 원문 가림 → 펴기 → 다시 가림 → `|` — 줄로 나뉜 옵션 값·잘린 PEM 본문·단독 CR 이 행·코드펜스를 깨거나 남지 않는다 (1.3.3 AC⑭-5)', () => {
  const one = (criterion) => {
    const md = renderIntent(tmp(), [{ criterion, result: 'PASS', location: 'a.java:3' }]);
    const rows = intentRows(md);
    assert.equal(rows.length, 1, JSON.stringify(rows));
    assert.equal(cellsOf(rows[0]).length, 3, rows[0]);
    assert.ok(rows[0].includes('| PASS |') && rows[0].includes('a.java:3'), rows[0]);
    return { md, row: rows[0] };
  };
  const a = one('run --password\nx');
  assert.match(a.row, /\[masked:/);
  assert.doesNotMatch(a.row.split('|')[1], /(^|\s)x(\s|$)/, a.row);
  const b = one('-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAx1\nAbCdEf0123+/==');
  assert.doesNotMatch(b.md, /MIIEow|AbCdEf0123/);
  const base = renderIntent(tmp(), [{ criterion: 'a b', result: 'PASS', location: 'a.java:3' }]);
  const c = one('a\r```\r# forged review\r```text\rb');
  assert.ok(!c.md.includes('\r'));
  assert.ok(!c.md.split('\n').some((l) => l.startsWith('# forged review')));
  const fences = (md) => md.split('\n').filter((l) => l.startsWith('```')).length;
  assert.equal(fences(c.md), fences(base));
  const d = one('-----BEGIN RSA PRIVATE KEY-----\rMIIEowIBAAKCAQEA');
  assert.doesNotMatch(d.md, /MIIEow/);
});

// ── 1.3.3 ⑬ 표시 — 부록 A zip 줄(zip 마다 배치·근거·접두·주석) · 터미널 요약 · mismatchSummary 종류 (spec 2026-10-23 3.⑬-7) ──
test('render: zips 2건이면 부록 A 에 zip 줄 2개(zip#n · 주석 7자|없음 · 배치(근거) · 접두) · 1건이면 지금 줄에 배치·접두 · zips 없는 1.3.2 꼴은 그대로 · SKILL §8 「배치」·「합산」 · mismatchSummary 종류 (1.3.3 AC⑬-12)', () => {
  const zr = (o) => ({ attachment: 'd.zip', downloaded: true, comment_sha: HEAD, entries: [], layout: 'source', layout_source: 'signature', prefix: '', bytes_skipped: [], ...o });
  const base = { ...baseDeploy(), applicable: true, reason: null, expected: { deploy: ['src/main/java/com/example/acct/Foo.java'], deleted: [] }, result: '일치', mismatches: [] };
  const two = { ...base, zip: { attachment: 'src.zip, classes.zip', downloaded: true, comment_sha: HEAD, entries: [], bytes_source: 'worktree', layout: 'mixed', layout_source: 'mixed', prefix: null, bytes_skipped: [] }, zips: [zr({ attachment: 'src.zip' }), zr({ attachment: 'classes.zip', comment_sha: null, layout: 'maven-war' })] };
  const appA = (md) => sectionOf(md, '## 부록 A', '## 부록 B').split('\n');
  const a = appA(renderWith(tmp(), two));
  assert.ok(a.some((l) => l.includes('zip 2개 합산')), a.join('\n'));
  assert.ok(a.includes(`- zip#1 src.zip(주석 ${HEAD.slice(0, 7)} · 배치 source(signature) · 접두 없음)`), a.join('\n'));
  assert.ok(a.includes('- zip#2 classes.zip(주석 없음 · 배치 maven-war(signature) · 접두 없음)'), a.join('\n'));
  const one = { ...base, zip: { attachment: 'd.zip', downloaded: true, comment_sha: HEAD, entries: [], bytes_source: 'worktree', layout: 'maven-war', layout_source: 'signature', prefix: 'app/', bytes_skipped: [] }, zips: [zr({ layout: 'maven-war', prefix: 'app/' })] };
  const b = appA(renderWith(tmp(), one));
  assert.ok(b.includes(`기대 배포 목록 1건 · 삭제 목록 0건 · zip d.zip(주석 ${HEAD.slice(0, 7)} · 배치 maven-war(signature) · 접두 app/)`), b.join('\n'));
  const amb = { ...one, zip: { ...one.zip, layout: 'source', layout_source: 'default', prefix: '' }, zips: [zr({ layout: null, layout_source: 'signature' })] };   // 혼합 zip 1개 — 요약은 힌트값이지만 줄은 그 zip 값
  assert.ok(appA(renderWith(tmp(), amb)).some((l) => l.includes('배치 -(signature) · 접두 없음')));
  const old = { ...base, zip: { attachment: 'd.zip', downloaded: true, comment_sha: HEAD, entries: [], bytes_source: 'worktree', layout: 'source', bytes_skipped: [] } };
  assert.ok(appA(renderWith(tmp(), old)).includes(`기대 배포 목록 1건 · 삭제 목록 0건 · zip d.zip(주석 ${HEAD.slice(0, 7)})`));
  const s8 = skillText().slice(skillText().indexOf('## 8. 출력 · 정리'), skillText().indexOf('## 9.'));
  assert.match(s8.split('\n').find((l) => l.startsWith('- **터미널 요약')), /배포본 대조 결과[^\n]*배치 <layout>\(<근거>\)[^\n]*zip n개 합산/);
  assert.equal(machineEvidence({ check: {}, snapshot: {}, deploy: { applicable: true, result: '대조 불가', mismatches: [{ kind: 'layout_ambiguous', path: null, detail: 'x' }] } }).find((m) => m.id === 'M-deploy').detail, '배포본 대조 불가 — layout_ambiguous');
  assert.equal(mismatchSummary({ mismatches: [{ kind: 'zip_conflict', path: 'p1', detail: 'x' }, { kind: 'zip_conflict', path: 'p2', detail: 'y' }] }), 'zip_conflict 2건(p1, p2) · 전체 목록 부록 A');
});

// ── 1.3.3 ⑭ §6-5 · ⑯ 검토자 W 밖 쓰기 · ⑮ 경로 감시 한계 — SKILL.md 문구 (spec 2026-10-23 3.⑭-2·3.⑯·3.⑮) ──
const s5Of = (skill) => skill.slice(skill.indexOf('## 5. 독립 병렬 검토'), skill.indexOf('## 6. 병합'));
const s8Of = (skill) => skill.slice(skill.indexOf('## 8. 출력 · 정리'), skill.indexOf('## 9.'));
test('SKILL.md §6-5: criterion = 수용기준·주장을 적은 첫 칸 원문 · 번호·ID 만이면 다음 칸 · 행 전체가 아니다 (1.3.3 AC⑭-4 · D67)', () => {
  const skill = skillText();
  const r5 = skill.slice(skill.indexOf('## 6. 병합'), skill.indexOf('## 7. 재리뷰')).split('\n').find((l) => l.startsWith('5. `intent`'));
  for (const s of ['첫 칸', '수용기준', '행 전체가 아니', '번호·ID', '다음 칸']) assert.ok(r5.includes(s), s);
});

test('SKILL.md §5 Claude 검토자 프롬프트: 임시 파일은 W/ 아래에만 · W 밖에는 쓰지 마라 (1.3.3 AC⑯-1)', () => {
  const p = s5Of(skillText()).split('\n').find((l) => l.startsWith('**Claude 검토자**'));
  assert.match(p, /`W\/` 아래에만/);
  assert.match(p, /쓰지 마라/);
});

test('SKILL.md: root-before.txt 기록(§5)·비교(§8) · F7 줄 「W 밖 새 항목 n건」·이름 미출력·지우지 않는다 · 비교는 cleanup 앞 · §0 공통 종료 절차에 비교 단계, 조기 종료·--resolve 해당 없음 (1.3.3 AC⑯-2 · R6-2)', () => {
  const skill = skillText();
  assert.ok(s5Of(skill).includes('root-before.txt'));
  const s8 = s8Of(skill);
  assert.ok(s8.includes('root-before.txt'));
  const f7 = s8.split('\n').find((l) => l.startsWith('- 종료 전 자가 점검'));
  for (const s of ['W 밖 새 항목', '지우지 않는다', 'n건', '이름은 출력하지 않']) assert.ok(f7.includes(s), s);
  assert.match(f7, /검토자 종료 확인 → 자가 점검 비교 → cleanup/);
  const s0 = skill.slice(skill.indexOf('## 0. 전제 확인'), skill.indexOf('## 1. 작업 디렉터리'));
  const end = s0.split('\n').find((l) => l.startsWith('**공통 종료 절차'));
  assert.match(end, /「검토자 종료 확인」 → 「W 밖 새 항목 비교」[^\n]*→ `<CLI> cleanup/);
  assert.match(end, /조기 종료[^\n]*`--resolve`[^\n]*해당 없음|`--resolve`[^\n]*조기 종료[^\n]*해당 없음/);
  for (const t of [s5Of(skill), s8]) assert.doesNotMatch(t, /새 항목[^\n]{0,20}이름을 (적|보고|출력)한다/);
  const blocks = (t) => [...t.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => b.includes('root-before.txt'));
  assert.ok(blocks(s5Of(skill)).length === 1 && blocks(s8).length === 1);
  assert.match(blocks(s8)[0], /wc -l/);                                                       // 셸 비교는 건수만 낸다
});

test('cleanup: W 안의 root-before.txt 는 허용 9종 밖이라 extra 로 지운다 (1.3.3 AC⑯-3)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([]) });
  writeFileSync(join(work, 'root-before.txt'), 'root/a\n');
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, /extra=[1-9]/);
  assert.ok(!existsSync(join(work, 'root-before.txt')));
});

test('SKILL.md §5 경로 감시 한계: companion 로그 96자·`...`·잘린 명령 n건 · §8 터미널 요약 「경로 감시 한계: 잘린 명령 n건」 (1.3.3 AC⑮-1·⑮-2 · D54)', () => {
  const skill = skillText();
  const item = skill.split('\n').find((l) => l.startsWith('- **경로 감시**'));
  for (const s of ['96자', '`...`', '한계', '잘린 명령']) assert.ok(item.includes(s), s);
  assert.ok(s8Of(skill).split('\n').find((l) => l.startsWith('- **터미널 요약')).includes('경로 감시 한계: 잘린 명령 n건'));
  assert.ok(!sectionOf(skill, '## 8.', '## 9.').includes('헤더에 「경로 감시 한계'));
});

// ── 1.3.4 S2 리포트 조립 줄 평탄화 (spec 2026-10-23 1.3.4 3.S2-3·S2-5·S2-6 · D73·D84·D88) ──
// 주입 문자열 4종(R1-1) — 값에서 온 글자가 새 줄을 만들면 안 된다. 숨은 문자는 \uXXXX 표기로만(spec R4-3)
const INJ = ['\n## ZZINJ\n', '\r\n## ZZINJ\r\n', '\u2028## ZZINJ\u2029', '\u0085## ZZINJ'];
// 3.S2-3 목록의 자유 문자열 필드(1:1). 주입하지 않는 것 = 3.S2-5 「허용값이 강제되는 필드」뿐(SHA·result·verdict·deploy kind·status·mode·track · validateFindings 검증 필드 id·type·blocking·fixableInDesign·resolution·validReviewers)
// 장면 A(판정 확정 · diff-only · 재리뷰) — 헤더·실행 블록·기준선/보완 문안·리뷰어 결정·부록 A~D
const S2_FIELDS_A = ['mr.title', 'mr.web_url', 'snapshot.unrecovered[0]', 'check.rereview.prior_verdict', 'check.baselineLinks[0].raw', 'check.baselineLinks[0].reason',
  'pack.codexSkipReason', 'pack.sources[0].kind', 'pack.sources[0].ref',
  'deploy.zip.attachment', 'deploy.zips[0].prefix', 'deploy.zips[0].layout', 'deploy.zips[0].layout_source', 'deploy.mismatches[0].path', 'deploy.mismatches[0].detail', 'deploy.zip.bytes_skipped[0]', 'deploy.zip.excluded[0]',
  'findings[0].title', 'findings[0].file', 'findings[0].line_start', 'findings[0].recommendation', 'findings[0].evidence', 'findings[0].scenario', 'findings[0].source', 'findings[0].confidence', 'findings[0].lens', 'findings[0].brokenPremise', 'findings[0].dismissReason', 'findings[0].fixableInDesignClaims.claude',
  'intent[0].criterion', 'intent[0].result', 'intent[0].location', 'intent[0].basis', 'outsideWorktreePaths[0]',
  'review-claude.lens', 'review-claude.title', 'review-claude.file', 'review-claude.line_start', 'review-claude.confidence', 'review-claude.evidence', 'review-claude.scenario', 'review-claude.brokenPremise', 'review-claude.recommendation'];
// 장면 B(판정 미확정 — 리뷰어 확인 필요 절 · 설계 내 수정 가능 상충)
const S2_FIELDS_B = ['findings[0].title', 'findings[0].file', 'findings[0].line_start', 'findings[0].source', 'findings[0].confidence', 'findings[0].scenario', 'findings[0].brokenPremise', 'findings[0].fixableInDesignClaims.claude'];
// 장면 C(조기 종료)
const S2_FIELDS_C = ['check.earlyExit.reason'];
// 1.4.0: verdict 가 source·fixableInDesignClaims 값을 검사한다(AC①-9·AC②-3) — 주입 값은 verdict 를 통과하지 못하므로 유효 값으로 판정한 뒤
// 주입본으로 바꾸고 findingsDigest 를 뗀다(1.3.5 이전 verdict.json 꼴 — head 대조만). render 의 평탄화·가림 방어는 같은 입력으로 그대로 시험한다
const VALID_SRC = ['claude', 'codex', 'both', 'main'];
const saneFnd = (x) => ({ ...x, findings: x.findings.map((f) => ({ ...f, source: VALID_SRC.find((v) => String(f.source).startsWith(v)) ?? 'both', ...(f.fixableInDesignClaims ? { fixableInDesignClaims: Object.fromEntries(Object.entries(f.fixableInDesignClaims).map(([k, v]) => [['claude', 'codex'].find((n) => k.startsWith(n)) ?? 'claude', String(v).startsWith('no') ? 'no' : 'yes'])) } : {}) })) });
function verdictThenInject(adapter, work, fnd) {
  writeFileSync(join(work, 'findings.json'), JSON.stringify(saneFnd(fnd)));
  const r = runCli(['verdict', '--adapter', adapter, '--work', work]);
  writeFileSync(join(work, 'findings.json'), JSON.stringify(fnd));
  const vp = join(work, 'verdict.json');
  if (existsSync(vp)) { const v = readJson(vp); delete v.findingsDigest; writeFileSync(vp, JSON.stringify(v)); }
  return r;
}
function s2Render(root, scene, s, name) {
  const adapter = writeAdapter(root);
  const I = (v) => `${v}${s}`;
  const c = baseCheck();
  const snap = baseSnap();
  let fnd;
  let deploy = baseDeploy();
  let pack = { sources: [{ id: 'S1', kind: 'doc', ref: 'guide/policy.md@abc#5.', exportAllowed: true, inPackB: true, lines: 3 }], mask: { applied: {}, residual: [], ok: true }, packA: 'pack-a.md', packB: 'pack-b.md', codexSkipped: false, codexSkipReason: null };
  let mr = {};
  let review = null;
  if (scene === 'A') {
    mr = { title: I('fix(x): y'), web_url: I('http://gitlab.test/g/alpha/-/merge_requests/7') };
    Object.assign(snap, { mode: 'diff-only', unrecovered: [I('src/main/java/app/Big.java')] });
    c.rereview = { active: true, prior_head: 'c'.repeat(40), prior_verdict: I('CHANGES_REQUESTED'), prior_note_id: 12, priorReport: null, priorBlocking: [], priorBlockingComplete: true };
    c.baselineLinks = [{ kind: 'issue', status: '미확보', raw: I('#55'), reason: I('권한 없음') }];
    pack = { ...pack, codexSkipped: true, codexSkipReason: I('잔존'), sources: [{ ...pack.sources[0], kind: I('doc'), ref: I('guide/policy.md@abc#5.') }] };
    deploy = { ...baseDeploy(), applicable: true, reason: null, expected: { deploy: ['src/main/java/app/A.java'], deleted: [] }, zip: { attachment: I('d.zip'), downloaded: true, comment_sha: HEAD, entries: [], bytes_source: 'blobs', layout: 'source', layout_source: 'signature', prefix: '', bytes_skipped: [I('WEB-INF/classes/app/A.class')], excluded: [I('docs/a.md')] }, zips: [{ attachment: 'd.zip', downloaded: true, comment_sha: HEAD, entries: [], layout: I('source'), layout_source: I('signature'), prefix: I('app/'), bytes_skipped: [] }], result: '불일치', mismatches: [{ kind: 'extra_in_zip', path: I('extra.txt'), detail: I('zip 에 있으나 배포 목록에 없음') }] };
    const f1 = F({ title: I('제목'), file: I('src/A.java'), line_start: I(3), recommendation: I('권고'), evidence: I('근거'), scenario: I('시나리오'), source: I('both'), confidence: I('high'), lens: I('L5'), brokenPremise: I('전제'), dismissReason: I('결정 근거'), resolution: 'confirmed', fixableInDesignClaims: { claude: I('yes'), codex: 'yes' } });
    fnd = findings([f1, F({ id: 'F2', type: 'MISSING_EVIDENCE', title: '회귀 결과 없음' }), F({ id: 'F3', type: 'FOLLOW_UP', blocking: false, title: '주석 정리' })], { intent: [{ criterion: I('V1 빌드'), result: I('UNKNOWN'), location: I('a.java:3'), basis: I('작성자 주장') }], outsideWorktreePaths: [I('/tmp/x')] });
    review = { reviewer: 'claude', head_sha: HEAD, findings: [{ lens: I('L5'), type: 'DEFECT', title: I('원본 제목'), file: I('src/B.java'), line_start: I(9), line_end: 9, evidence: I('원본 근거'), scenario: I('원본 시나리오'), confidence: I('high'), recommendation: I('원본 권고'), fixableInDesign: 'no', brokenPremise: I('원본 전제') }], intent: [], baselineCandidateRelevant: true };
  } else if (scene === 'B') {
    fnd = findings([F({ unresolved: true, fixableInDesign: null, title: I('제목'), file: I('src/A.java'), line_start: I(3), source: I('codex'), confidence: I('low'), scenario: I('시나리오'), brokenPremise: I('전제'), fixableInDesignClaims: { claude: I('yes'), codex: 'no' } })]);
  } else {
    c.contract.complete = false; c.contract.incompleteLines = ['Base SHA']; c.earlyExit = { would: true, reason: I('기준선 없음'), draftVerdict: 'RETURN_TO_DESIGN' };
  }
  const work = fullWork(join(root, name), { check: c, snap, deploy, fnd, mr, pack: scene !== 'C', reviews: scene !== 'C' });
  writeFileSync(join(work, 'pack.json'), JSON.stringify(pack));
  if (review) writeFileSync(join(work, 'review-claude.json'), JSON.stringify(review));
  if (scene !== 'C') assert.equal(verdictThenInject(adapter, work, fnd).code, 0, scene);
  const out = join(root, `${name}.md`);
  const rr = runCli(['render', '--adapter', adapter, '--work', work, ...(scene === 'C' ? ['--early'] : []), '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  return readFileSync(out, 'utf8');
}

test('render: 조립 줄의 자유 문자열 필드 어디에 줄바꿈(CR·LF·CRLF·NEL·U+2028·U+2029)이 있어도 줄 수·코드펜스·부록 D 불릿·재리뷰 파서 결과가 같고 값에서 시작하는 줄이 없다 (1.3.4 AC-S2-3 · D73·D88)', () => {
  const root = tmp();
  const fences = (md) => md.split('\n').filter((l) => l.startsWith('```')).length;
  const bullets = (md) => sectionOf(md, '## 부록 D').split('\n').filter((l) => l.startsWith('- **')).length;
  for (const [scene, fields] of [['A', S2_FIELDS_A], ['B', S2_FIELDS_B], ['C', S2_FIELDS_C]]) {
    const base = s2Render(root, scene, '', `${scene}0`);
    INJ.forEach((s, k) => {
      const md = s2Render(root, scene, s, `${scene}${k + 1}`);
      const tag = `${scene}/${JSON.stringify(s)}`;
      assert.equal(md.split('\n').length, base.split('\n').length, tag);
      assert.ok(!md.split('\n').some((l) => l.startsWith('ZZINJ') || l.startsWith('## ZZINJ')), tag);
      assert.ok(md.split('ZZINJ').length - 1 >= fields.length, `${tag} ZZINJ ${md.split('ZZINJ').length - 1} < ${fields.length}`);
      assert.equal(fences(md), fences(base), tag);
      assert.equal(bullets(md), bullets(base), tag);
      assert.equal(parseAppendixD(md).size, parseAppendixD(base).size, tag);
      assert.ok(!/[\u0085\u2028\u2029]/.test(md), tag);
    });
  }
});

test('render: 검증되지 않는 검토자 필드 source 의 줄바꿈도 가짜 제목을 만들지 못한다 · 마스킹 순서(원문 가림 → 펴기 → 다시 가림)는 부록 A 줄에도 (1.3.4 AC-S2-3 회귀 R1-2 · AC⑭-5 꼴)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const fnd = findings([F({ unresolved: true, source: 'both\n## SOURCEINJ' })]);
  const work = fullWork(join(root, 'a'), { fnd });
  assert.equal(verdictThenInject(adapter, work, fnd).code, 0);
  const out = join(root, 'a.md');
  assert.equal(runCli(['render', '--adapter', adapter, '--work', work, '--out', out]).code, 0);
  const md = readFileSync(out, 'utf8');
  assert.ok(md.includes('SOURCEINJ'));
  assert.ok(!md.split('\n').some((l) => l.startsWith('## SOURCEINJ')));
  const d = { ...baseDeploy(), applicable: true, reason: null, expected: { deploy: ['src/main/java/app/A.java'], deleted: [] }, zip: { attachment: 'd.zip', downloaded: true, comment_sha: HEAD, entries: [], bytes_source: 'worktree', layout: 'source', bytes_skipped: [] }, result: '불일치', mismatches: [{ kind: 'extra_in_zip', path: 'p.txt', detail: 'run --password\nx' }] };
  const appA = sectionOf(renderWith(tmp(), d), '## 부록 A', '## 부록 B').split('\n');
  const l = appA.find((x) => x.startsWith('- extra_in_zip p.txt:'));
  assert.ok(l && l.includes('[masked:') && !/(^|\s)x(\s|$)/.test(l), l);
  assert.ok(!appA.some((x) => x.trim() === 'x'));
});

test('render: 부록 A zip 줄·불일치 줄·바이트 대조 생략 목록과 실행 블록·부록 D·보완 문안의 배포본 요약은 각각 한 줄 (1.3.4 AC-S2-4)', () => {
  const d = { ...baseDeploy(), applicable: true, reason: null, expected: { deploy: ['src/main/java/app/A.java'], deleted: [] }, zip: { attachment: 'd\n.zip', downloaded: true, comment_sha: HEAD, entries: [], bytes_source: 'worktree', layout: 'source', layout_source: 'signature', prefix: 'app\n/', bytes_skipped: ['p\nq.class'], excluded: ['docs/e\nf.md'] }, zips: [{ attachment: 'd\n.zip', downloaded: true, comment_sha: HEAD, entries: [], layout: 'source', layout_source: 'signature', prefix: 'app\n/', bytes_skipped: ['p\nq.class'] }], result: '불일치', mismatches: [{ kind: 'extra_in_zip', path: 'a\nb', detail: 'c\nd' }] };
  const md = renderWith(tmp(), d);
  const lines = md.split('\n');
  const appA = sectionOf(md, '## 부록 A', '## 부록 B').split('\n');
  assert.ok(appA.some((l) => l.includes('zip d .zip(주석 ') && l.includes('접두 app /')), appA.join('\n'));
  assert.ok(appA.includes('- p q.class'), appA.join('\n'));
  assert.ok(appA.includes('- docs/e f.md'), appA.join('\n'));
  assert.ok(appA.includes('- extra_in_zip a b: c d'), appA.join('\n'));
  const block = md.match(/```text\n([\s\S]*?)\n```/)[1].split('\n');
  assert.ok(block.some((l) => l.startsWith('- [실행] 배포본 zip 대조') && l.includes('extra_in_zip 1건(a b)')), block.join('\n'));
  assert.ok(lines.some((l) => l.startsWith('- **M-deploy** [기계]') && l.includes('extra_in_zip 1건(a b)')));
  assert.ok(lines.some((l) => l.startsWith('- 배포본 대조 결과 「불일치」') && l.includes('extra_in_zip 1건(a b)')));
  for (const frag of ['b', '.zip', '/', 'q.class', 'd']) assert.ok(!lines.some((l) => l === frag || l.startsWith(`${frag}(`) || l.startsWith(`${frag}:`) || l.startsWith(`${frag})`)), frag);
});

test('render: 부록 C 무효 결과(JSON 파싱 실패)는 고정 문구 한 줄 — 파싱 오류 메시지가 인용한 입력(가짜 제목·비밀값 꼴)을 싣지 않는다 (1.3.4 AC-S2-9 · D88)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([F()], { validReviewers: ['codex'], crossChecked: false }) });
  writeFileSync(join(work, 'review-claude.json'), '{"findings": [\n## ZZINJ\n password=hunter2pass ]}');
  writeFileSync(join(work, 'review-codex.json'), JSON.stringify({ reviewer: 'codex', head_sha: HEAD, findings: [{ lens: 'L1', type: 'DEFECT', title: '코덱스 발견', file: 'src/C.java', line_start: 1, evidence: 'e', scenario: 's', confidence: 'high', recommendation: 'r', fixableInDesign: 'yes' }], intent: [], baselineCandidateRelevant: true }));
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
  const out = join(root, 'c.md');
  assert.equal(runCli(['render', '--adapter', adapter, '--work', work, '--out', out]).code, 0);
  const md = readFileSync(out, 'utf8');
  assert.ok(md.includes('### claude\n\n(무효 결과 — JSON 파싱 실패)\n'), sectionOf(md, '### claude', '### codex'));
  assert.ok(!md.includes('ZZINJ') && !md.includes('hunter2pass'));
  assert.match(md, /### codex\n\n- \[L1\] DEFECT — 코덱스 발견/);
});

test('render: NEL·U+2028·U+2029 로 나뉜 잘린 PEM 본문은 평탄화 줄(검토자 근거)과 표 셀(의도 대조표) 어디에도 남지 않는다 (1.3.4 AC-S2-8 (나) · D84)', () => {
  for (const sep of ['\u0085', '\u2028', '\u2029']) {
    const pem = '-----BEGIN RSA PRIVATE KEY-----' + sep + 'MIIEowIBAAKCAQEA' + sep + 'abcd';
    const root = tmp();
    const adapter = writeAdapter(root);
    const work = fullWork(root, { fnd: findings([F({ evidence: pem })], { intent: [{ criterion: pem, result: 'PASS', location: 'a.java:3' }] }) });
    assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
    const out = join(root, 'r.md');
    const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
    assert.equal(rr.code, 0, rr.out + rr.err);
    const md = readFileSync(out, 'utf8');
    assert.ok(!md.includes('MIIEow'), JSON.stringify(sep));
    assert.equal(cellsOf(intentRows(md)[0]).length, 3);
  }
});

test('render: 검토자 출력 객체의 키(fixableInDesignClaims)도 가리고 편다 — 키의 줄바꿈이 가짜 제목을 만들지 못하고 키의 비밀값 꼴도 남지 않는다 (1.3.4 review-loop(impl) R1-1 · D88)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const fnd = findings([F({ unresolved: true, fixableInDesign: null, fixableInDesignClaims: { 'claude\n## KEYINJ\n': 'yes', 'codex password=hunter2pass': 'no' } })]);
  const work = fullWork(join(root, 'a'), { fnd });
  assert.equal(verdictThenInject(adapter, work, fnd).code, 0);
  const out = join(root, 'a.md');
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  const md = readFileSync(out, 'utf8');
  assert.ok(md.includes('KEYINJ'));
  assert.ok(!md.split('\n').some((l) => l.startsWith('## KEYINJ') || l.startsWith('KEYINJ')), md);
  assert.ok(!md.includes('hunter2pass'));
});

test('render: 스냅샷 값(diff-only 미복원 경로)도 원문을 먼저 가린 뒤 편다 — 줄로 나뉜 잘린 PEM 본문이 헤더에 남지 않는다 (1.3.4 review-loop(impl) R1-2 · D84·D88)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const snap = { ...baseSnap(), mode: 'diff-only', unrecovered: ['src/-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\nabcd'] };
  const work = fullWork(join(root, 'a'), { snap, fnd: findings([F()]) });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
  const out = join(root, 'a.md');
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  const md = readFileSync(out, 'utf8');
  assert.ok(md.includes('불완전 diff-only 리뷰'), md.slice(0, 800));
  assert.ok(!md.includes('MIIEow') && !md.includes('abcd'), md.split('\n').filter((l) => l.includes('MIIEow') || l.includes('abcd')).join('\n'));
});

test('render: 구조 키는 원형 보존 — 가림이 바꾼 키(리터럴 \\u0064)가 id·title 등 기존 필드를 덮어써 차단 발견이 게시 블록에서 사라지지 않는다 (1.3.4 review-loop(impl) R2-1 · R1-1 회귀)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const fnd = findings([{ ...F(), ['i' + '\\' + 'u0064']: 'F2' }]);
  const work = fullWork(join(root, 'a'), { fnd });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
  const out = join(root, 'a.md');
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  const md = readFileSync(out, 'utf8');
  const block = md.match(/```text\n([\s\S]*?)\n```/)[1];
  assert.ok(block.includes('F1') && block.includes('비밀번호 평문 로그'), block);
});

// ── 1.3.4 ⑱ 배포 제외 경로(참고) 표시 — D47 자리 3곳 (spec 2026-10-23 1.3.4 3.⑱-5 · D72·D80) ──
test('render: zip.excluded 2건 → 부록 A 에 「배포 제외 경로 2건(참고 — 어댑터 deploy.excludes):」 + 경로 각 1줄 · 실행 블록 「2. 검증 상태」 배포본 줄 끝 · bytes_skipped 와 둘 다면 둘 다 · 0건·키 없음은 문구 없음 · 헤더·보완 문안 없음 · SKILL §8 터미널 요약 (1.3.4 AC⑱-7)', () => {
  const EX = ['docs/a.md', 'AGENTS.md'];
  const d = { ...baseDeploy(), applicable: true, reason: null, expected: { deploy: ['src/main/java/com/example/acct/Foo.java'], deleted: [] }, zip: { attachment: 'd.zip', downloaded: true, comment_sha: HEAD, entries: [], bytes_source: 'worktree', layout: 'source', bytes_skipped: [], excluded: EX }, result: '일치', mismatches: [] };
  const md = renderWith(tmp(), d);
  const appA = sectionOf(md, '## 부록 A', '## 부록 B').split('\n');
  const i = appA.indexOf('배포 제외 경로 2건(참고 — 어댑터 deploy.excludes):');
  assert.ok(i >= 0, appA.join('\n'));
  assert.deepEqual(appA.slice(i + 1, i + 3), ['- docs/a.md', '- AGENTS.md']);
  const s2 = md.match(/```text\n([\s\S]*?)\n```/)[1].split('\n').find((l) => l.startsWith('- [실행] 배포본 zip 대조'));
  assert.ok(s2.endsWith(' · 배포 제외 경로 2건(참고)'), s2);
  assert.ok(!sectionOf(md, '# mr-review', '## 판정 초안').includes('배포 제외'));
  assert.ok(!md.includes('M-deploy') && !md.includes('## 작성자 보완 요청 문안\n\n- 배포본'));
  const SK = ['WEB-INF/classes/com/example/acct/Foo.class'];
  const both = renderWith(tmp(), { ...d, zip: { ...d.zip, bytes_skipped: SK } });
  const s2b = both.match(/```text\n([\s\S]*?)\n```/)[1].split('\n').find((l) => l.startsWith('- [실행] 배포본 zip 대조'));
  assert.ok(s2b.endsWith('바이트 대조 생략 1건(컴파일 산출물 — 존재만 확인) · 배포 제외 경로 2건(참고)'), s2b);
  const appB = sectionOf(both, '## 부록 A', '## 부록 B');
  assert.ok(appB.indexOf('바이트 대조 생략 1건') < appB.indexOf('배포 제외 경로 2건'));
  for (const z of [{ ...d.zip, excluded: [] }, (({ excluded, ...rest }) => rest)(d.zip)]) assert.ok(!renderWith(tmp(), { ...d, zip: z }).includes('배포 제외 경로'));
  assert.match(s8Of(skillText()).split('\n').find((l) => l.startsWith('- **터미널 요약')), /배포 제외 경로 n건/);
});

// ── 1.3.5 ① 교차 검토 깊이 표지 (spec 2026-10-23 1.3.5 3.①-5~8 · D93·D103) ──
const { codexStats } = await import(join(LIB, 'report.mjs'));
const D69 = () => [
  ...Array.from({ length: 68 }, (_, i) => ({ old_path: `src/main/java/app/m${i + 1}/C${i + 1}.java`, new_path: `src/main/java/app/m${i + 1}/C${i + 1}.java`, new_file: false, renamed_file: false, deleted_file: false })),
  { old_path: 'src/main/java/app/OldName.java', new_path: 'src/main/java/app/NewName.java', new_file: false, renamed_file: true, deleted_file: false },
];
// 명령 16줄(2줄은 96자 절단 `...`) · 명령 로그에 변경 경로 8개 · 최종 JSON file 에 1개 · basename 만 같은 다른 경로 1개
function codexOut(extraMentions = 0) {
  const cmds = [
    ...Array.from({ length: 8 }, (_, i) => `[codex] Running command: /bin/bash -lc "sed -n '1,200p' src/main/java/app/m${i + 1}/C${i + 1}.java"`),
    '[codex] Running command: /bin/bash -lc "rg -n \'saveDraft\' src/main/java/app/m50/C50.ja...',
    '[codex] Running command: /bin/bash -lc "sed -n \'1,400p\' src/main/java/app/m51/...',
    '[codex] Running command: /bin/bash -lc "cat lib/C12.java"',
    ...Array.from({ length: 5 }, (_, i) => `[codex] Running command: /bin/bash -lc "rg -n token${i}"`),
  ];
  const more = Array.from({ length: extraMentions }, (_, i) => `src/main/java/app/m${i + 20}/C${i + 20}.java`).join('\n');
  return ['[codex] Starting', ...cmds, 'Command completed: 0', more, '```json', JSON.stringify({ reviewer: 'codex', findings: [{ file: 'src/main/java/app/NewName.java', title: 'x' }] }), '```', 'COMPANION_EXIT:0', ''].join('\n');
}

test('codexStats: 명령 줄 수 · 변경 파일 경로 집합(rename 은 둘 다) · 경로 그대로 언급한 수(명령 로그 + 최종 JSON, basename 만 같은 경로는 안 셈) · 1/4 미만이면 약함 (1.3.5 AC①-7 · D93)', () => {
  assert.deepEqual(codexStats(codexOut(), D69()), { commands: 16, changedFiles: 70, filesMentioned: 9, weak: true });
  assert.deepEqual(codexStats(codexOut(30), D69()), { commands: 16, changedFiles: 70, filesMentioned: 39, weak: false });
  assert.deepEqual(codexStats(codexOut(), []), { commands: 16, changedFiles: 0, filesMentioned: 0, weak: false });
  assert.equal(codexStats(codexOut(), [{ old_path: 'src/main/java/app/C12.java', new_path: 'src/main/java/app/C12.java' }]).filesMentioned, 0);   // `lib/C12.java` 는 basename 만 같다
});

test('CLI codex-stats: 첫 줄 CODEX_STATS commands=… changed=… mentioned=… weak=… + W/codex-stats.json · codex.out 없으면 ERR (1.3.5 AC①-8)', () => {
  const root = tmp();
  const work = fullWork(root, { fnd: findings([]), mr: { diffs: D69() } });
  writeFileSync(join(work, 'codex.out'), codexOut());
  const r = runCli(['codex-stats', '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.first, 'CODEX_STATS commands=16 changed=70 mentioned=9 weak=true');
  assert.deepEqual(readJson(join(work, 'codex-stats.json')), { commands: 16, changedFiles: 70, filesMentioned: 9, weak: true });
  rmSync(join(work, 'codex.out'));
  const e = runCli(['codex-stats', '--work', work]);
  assert.equal(e.code, 2);
  assert.match(e.first, /^ERR /);
});

const STATS = (over = {}) => ({ codex: { commands: 16, changedFiles: 69, filesMentioned: 9, weak: true, ...over } });
function renderFnd(root, fnd, name = 'r.md') {
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
  const out = join(root, name);
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  return { md: readFileSync(out, 'utf8'), work, adapter };
}
const judgeLine = (md) => md.match(/```text\n([\s\S]*?)\n```/)[1].split('\n').find((l) => l.startsWith('- [판독]'));

test('render: reviewerStats.codex 약함 → 헤더 「있음(약함 — 변경 파일 69 중 9 언급 · 명령 16회)」 · [판독] 줄 「 · 교차 검토 약함」 · 부록 D 통계 1줄 / 약함 아님 → 헤더 수치만 · 실행 블록 변화 없음 / 통계 없음 → 현행 (1.3.5 AC①-9)', () => {
  const { md } = renderFnd(tmp(), findings([], { reviewerStats: STATS() }));
  assert.match(md, /^- 리뷰 모드: 전체 · 돈 모델: claude, codex · 교차 검토: 있음\(약함 — 변경 파일 69 중 9 언급 · 명령 16회\)$/m);
  assert.ok(judgeLine(md).includes(' · 교차 검토 약함'), judgeLine(md));
  assert.match(sectionOf(md, '## 부록 D'), /^## 부록 D — 병합 발견 상세 · 리뷰어 결정\n\n- Codex 검토 통계: 명령 16회 · 변경 파일 69 중 9 언급\(약함\)\n/);
  const { md: md2 } = renderFnd(tmp(), findings([], { reviewerStats: STATS({ commands: 40, filesMentioned: 30, weak: false }) }));
  assert.match(md2, /교차 검토: 있음\(변경 파일 69 중 30 언급 · 명령 40회\)$/m);
  assert.ok(!judgeLine(md2).includes('약함'));
  assert.match(sectionOf(md2, '## 부록 D'), /- Codex 검토 통계: 명령 40회 · 변경 파일 69 중 30 언급\n/);
  const { md: md0 } = renderFnd(tmp(), findings([]));
  assert.match(md0, /교차 검토: 있음$/m);
  assert.doesNotMatch(md0, /Codex 검토 통계|교차 검토 약함/);
  assert.equal(judgeLine(md0), judgeLine(md2));
});

test('render 단일 모델: crossChecked:false + reviewerStats.codex → 헤더 「없음」 현행 · [판독] 줄 현행 · 부록 D 통계 1줄 (1.3.5 AC①-13 · D103)', () => {
  const { md } = renderFnd(tmp(), findings([], { validReviewers: ['claude'], crossChecked: false, reviewerStats: STATS() }));
  assert.match(md, /· 돈 모델: claude · 교차 검토: 없음$/m);
  assert.equal(judgeLine(md), `- [판독] base..head diff·변경 파일 전문 — head ${HEAD.slice(0, 7)} (돈 모델: claude · 교차 검토 없음)`);
  assert.match(sectionOf(md, '## 부록 D'), /- Codex 검토 통계: 명령 16회 · 변경 파일 69 중 9 언급\(약함\)/);
});

test('verdict: reviewerStats 유무·weak 값은 판정 결과를 바꾸지 않는다 (1.3.5 AC①-10)', () => {
  const c = baseCheck(); c.contract.incompleteLines = ['Base SHA'];
  for (const list of [[], [F()], [F({ type: 'MISSING_EVIDENCE' })]]) {
    const plain = V(findings(list), { check: c });
    assert.deepEqual(V(findings(list, { reviewerStats: STATS() }), { check: c }), plain);
    assert.deepEqual(V(findings(list, { reviewerStats: STATS({ weak: false }) }), { check: c }), plain);
  }
});

test('cleanup: W/codex-stats.json 은 허용 9종 밖이라 extra 로 지우고 findings.json.reviewerStats 는 마스킹 사본에 남는다 (1.3.5 AC①-12)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([], { reviewerStats: STATS() }) });
  writeFileSync(join(work, 'codex-stats.json'), JSON.stringify(STATS().codex));
  const r = runCli(['cleanup', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(r.out.split('\n')[1], 'extra: codex-stats.json');
  assert.ok(!existsSync(join(work, 'codex-stats.json')));
  assert.deepEqual(readJson(join(work, 'findings.json')).reviewerStats, STATS());
});

test('SKILL.md §5: 워크트리 안 문서는 팩 B 에 경로 포인터만 · 포인터는 현재 작업 디렉터리에서 읽어라 · codex-stats → reviewerStats · 「경로가 아니라 본문」·「팩 B 에 없는 경로」 없음 · 고정 첫머리 cwd 밖 금지 유지 · §8 교차 검토 약함 (1.3.5 AC①-11 · R1-1)', () => {
  const skill = readFileSync(join(CLI, '..', '..', 'SKILL.md'), 'utf8');
  const s5 = skill.slice(skill.indexOf('## 5. 독립 병렬 검토'), skill.indexOf('## 6. 병합'));
  assert.match(s5, /워크트리 안 문서는 팩 B 에 경로 포인터만/);
  assert.match(s5, /포인터는 현재 작업 디렉터리에서 그 경로를 읽어라/);
  assert.match(s5, /<CLI> codex-stats --work "\$W"/);
  assert.match(s5, /reviewerStats\.codex/);
  assert.match(s5, /유효든 무효든[^\n]*codex\.out/);
  assert.doesNotMatch(skill, /경로가 아니라 본문|팩 B 에 없는 경로/);
  assert.match(s5, /현재 작업 디렉터리\(워크트리\) 밖의 파일을 읽지 마라/);
  const s8 = skill.slice(skill.indexOf('## 8. 출력 · 정리'), skill.indexOf('## 9.'));
  assert.match(s8, /돈 모델\/교차 검토[^\n]*교차 검토: 있음\(약함 — 변경 파일 n 중 m 언급 · 명령 k회\)/);
});

// ── 1.3.5 ④ 모델 발견 ↔ 기계 증거 병합 (spec 2026-10-23 1.3.5 3.④ · D94·D101·D106·D111) ──
const { priorBlockingList } = await import(join(LIB, 'check.mjs'));
const c2 = (names = ['Base SHA', 'Human reviewer']) => { const c = baseCheck(); c.contract.complete = false; c.contract.incompleteLines = names; c.contract.lines = [...c.contract.lines, ...names.filter((n) => n !== 'Baseline').map((name) => ({ name, status: '자리표시자', value: '' }))]; if (names.includes('Baseline')) c.contract.lines.find((l) => l.name === 'Baseline').status = '자리표시자'; return c; };
const ME = (over) => F({ type: 'MISSING_EVIDENCE', lens: 'L1', title: 'Review Contract 2줄이 비어 있음', recommendation: 'Base SHA·Human reviewer 줄을 채운다', coveredBy: ['M-contract-Base_SHA', 'M-contract-Human_reviewer'], ...over });

test('computeVerdict: MISSING_EVIDENCE 의 coveredBy 가 전부 이번 기계 증거 id 면 병합 — evidence 에서 빠지고 merged 로 · 판정 불변 (1.3.5 AC④-1)', () => {
  const v = V(findings([ME()]), { check: c2() });
  assert.equal(v.status, 'determined');
  assert.ok(!v.evidence.includes('F1'));
  assert.ok(v.evidence.includes('M-contract-Base_SHA') && v.evidence.includes('M-contract-Human_reviewer'));
  assert.deepEqual(v.merged, ['F1']);
  assert.equal(v.verdict, 'HOLD_EVIDENCE');
  assert.equal(V(findings([ME({ coveredBy: undefined })]), { check: c2() }).verdict, v.verdict);
  assert.deepEqual(V(findings([]), { check: c2() }).merged, []);
});

test('computeVerdict fail-closed: 없는 id · DEFECT 의 coveredBy 는 무시하고 현행대로 + reasons 1줄 — 병합으로 판정이 내려가지 않는다 (1.3.5 AC④-2)', () => {
  const v = V(findings([ME({ coveredBy: ['M-contract-Nope'] })]), { check: c2() });
  assert.ok(v.evidence.includes('F1'));
  assert.deepEqual(v.merged, []);
  assert.ok(v.reasons.some((r) => r === 'coveredBy 무시: F1 → M-contract-Nope 없음'), JSON.stringify(v.reasons));
  const d = V(findings([F({ coveredBy: ['M-contract-Base_SHA'] })]), { check: c2() });
  assert.deepEqual(d.defects, ['F1']);
  assert.deepEqual(d.merged, []);
  assert.equal(d.verdict, 'CHANGES_REQUESTED');
  assert.ok(d.reasons.some((r) => r === 'coveredBy 무시: F1 → type DEFECT'), JSON.stringify(d.reasons));
  // 배열이 아닌 coveredBy(형식 오류)도 「어긋남」 — 병합하지 않고 reasons 1줄(review-loop(impl) L-1 · 빌더 결정 ⑩)
  for (const bad of ['M-contract-Base_SHA', { id: 'M-contract-Base_SHA' }, 1]) {
    const s = V(findings([ME({ coveredBy: bad })]), { check: c2() });
    assert.ok(s.evidence.includes('F1'));
    assert.deepEqual(s.merged, []);
    assert.ok(s.reasons.some((r) => r === 'coveredBy 무시: F1 → 형식 오류(배열 아님)'), JSON.stringify(s.reasons));
  }
  for (const none of [undefined, null, []]) assert.ok(!V(findings([ME({ coveredBy: none })]), { check: c2() }).reasons.some((r) => r.startsWith('coveredBy 무시')));
});

test('computeVerdict: 리뷰어 확인 전 미해결 후보는 병합하지 않는다 — 미확정·갈래 현행 · confirmed 뒤 재계산에서 병합 · dismissed 는 병합 아님 (1.3.5 AC④-9 · D111)', () => {
  const f = () => findings([ME({ unresolved: true, confidence: 'low', coveredBy: ['M-contract-Base_SHA'] })]);
  const u = V(f(), { check: c2(['Base SHA']) });
  assert.equal(u.status, 'undetermined');
  assert.equal(u.verdict, null);
  assert.deepEqual(u.unresolved, ['F1']);
  assert.deepEqual(u.branches.F1, { confirmed: 'HOLD_EVIDENCE', dismissed: 'HOLD_EVIDENCE' });
  assert.deepEqual(u.merged, []);
  const c = V(f(), { check: c2(['Base SHA']), resolves: { F1: 'confirmed' } });
  assert.equal(c.status, 'determined');
  assert.deepEqual(c.merged, ['F1']);
  assert.ok(!c.evidence.includes('F1') && c.evidence.includes('M-contract-Base_SHA'));
  const d = V(f(), { check: c2(['Base SHA']), resolves: { F1: 'dismissed' } });
  assert.deepEqual(d.merged, []);
  assert.ok(!d.evidence.includes('F1'));
});

const blockOf = (md) => md.match(/```text\n([\s\S]*?)\n```/)[1];
function renderCheck(root, check, fnd, deploy = baseDeploy()) {
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd, check, deploy });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
  const out = join(root, 'r.md');
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  return readFileSync(out, 'utf8');
}

test('render: 계약 미완 2줄 + 병합 발견 → 「3.」 한 체크박스 + 권고 1회 · 「4.」 에 F1 없음·M-contract 줄은 현행 · 부록 D 병합 표지 · 재리뷰 파서는 M-contract 만 센다 (1.3.5 AC④-3·④-6 · D101)', () => {
  const md = renderCheck(tmp(), c2(), findings([ME()]));
  const block = blockOf(md);
  const s3 = block.split('\n').filter((l) => l.startsWith('- 머지 전:'));
  assert.deepEqual(s3, ['- 머지 전: [ ] Review Contract 2줄 미완(Base SHA · Human reviewer) — 권고: Base SHA·Human reviewer 줄을 채운다']);
  const s4 = block.slice(block.indexOf('4. 차단 발견'), block.indexOf('5. 비차단 후속'));
  assert.doesNotMatch(s4, /^- F1 /m);
  assert.ok(s4.includes('- M-contract-Base_SHA MISSING_EVIDENCE — Review Contract 「Base SHA」 미완(자리표시자)\n'), s4);
  assert.ok(s4.includes('- M-contract-Human_reviewer MISSING_EVIDENCE — Review Contract 「Human reviewer」 미완(자리표시자)\n'), s4);
  assert.doesNotMatch(s4, /권고/);
  const appD = sectionOf(md, '## 부록 D');
  assert.ok(appD.includes('- **F1** [L1] MISSING_EVIDENCE (차단 — 기계 증거 M-contract-Base_SHA, M-contract-Human_reviewer 에 병합) — Review Contract 2줄이 비어 있음 (src/A.java:3) · 출처 both'), appD);
  const prior = priorBlockingList(block, md);
  assert.deepEqual(prior.items.map((x) => x.id), ['M-contract-Base_SHA', 'M-contract-Human_reviewer']);
  assert.equal(prior.complete, true);
  const ad = parseAppendixD(md);
  assert.ok(!ad.has('F1'));
  assert.ok(ad.has('M-contract-Base_SHA') && ad.has('M-contract-Human_reviewer'));
});

test('render: coveredBy 없는 계약 미완 2줄은 한 체크박스(권고 없음) · M-deploy·M-baseline·병합 안 된 모델 증거 부족은 항목별 (1.3.5 AC④-4·④-5)', () => {
  const md = renderCheck(tmp(), c2(), findings([]));
  assert.ok(blockOf(md).split('\n').includes('- 머지 전: [ ] Review Contract 2줄 미완(Base SHA · Human reviewer)'), blockOf(md));
  const c = c2(); c.baselineLinks = [...c.baselineLinks, { kind: 'repo', status: '미확보', reason: '원문 확보 실패: x', raw: 'http://gitlab.test/g/alpha/-/blob/main/docs/x.md' }];
  const d = { ...baseDeploy(), applicable: true, reason: null, result: '불일치', mismatches: [{ kind: 'comment_sha', path: null, detail: 'x' }], zip: { attachment: 'd.zip', downloaded: true, comment_sha: null, entries: [] } };
  const md2 = renderCheck(tmp(), c, findings([ME({ id: 'F2', title: '회귀 결과 없음', coveredBy: undefined })]), d);
  const line = blockOf(md2).split('\n').find((l) => l.startsWith('- 머지 전:'));
  assert.equal(line, '- 머지 전: [ ] 회귀 결과 없음 · [ ] Review Contract 2줄 미완(Base SHA · Human reviewer) · [ ] 배포본 불일치 — comment_sha · [ ] 기준선·이슈 원문 미확보: http://gitlab.test/g/alpha/-/blob/main/docs/x.md — 원문 확보 실패: x');
});

test('render: 계약 미완 1줄은 현행 문구 그대로 · 병합 발견이 있으면 그 줄 끝에 권고 · 「4.」 M-contract 줄은 권고 없이 현행 (1.3.5 AC④-8 · H-3)', () => {
  const md = renderCheck(tmp(), c2(['Baseline']), findings([]));
  assert.ok(blockOf(md).split('\n').includes('- 머지 전: [ ] Review Contract 「Baseline」 미완(자리표시자)'), blockOf(md));
  const md2 = renderCheck(tmp(), c2(['Baseline']), findings([ME({ coveredBy: ['M-contract-Baseline'], recommendation: '기준선 링크를 적는다' })]));
  const block = blockOf(md2);
  assert.ok(block.split('\n').includes('- 머지 전: [ ] Review Contract 「Baseline」 미완(자리표시자) — 권고: 기준선 링크를 적는다'), block);
  assert.ok(block.split('\n').includes('- M-contract-Baseline MISSING_EVIDENCE — Review Contract 「Baseline」 미완(자리표시자)'), block);
});

test('SKILL.md §6: 1b coveredBy 단계 — MISSING_EVIDENCE 만 · 「DEFECT·DESIGN_DRIFT·FOLLOW_UP 에는 적지 않는다」 (1.3.5 AC④-7)', () => {
  const skill = readFileSync(join(CLI, '..', '..', 'SKILL.md'), 'utf8');
  const s6 = skill.slice(skill.indexOf('## 6. 병합'), skill.indexOf('## 7. 재리뷰'));
  assert.match(s6, /^1b\. /m);
  assert.match(s6, /coveredBy/);
  assert.match(s6, /DEFECT·DESIGN_DRIFT·FOLLOW_UP 에는 적지 않는다/);
  assert.match(s6, /"coveredBy"/);
});

// ── 1.3.5 ⑤ 검사표 접미·경로 미확인 보완 문안 · ⑥ 보완 문구 절 이름 (spec 2026-10-23 1.3.5 3.⑤-6 · 3.⑥-4 · D100·D110) ──
function renderAd(check, adapterPatch = {}) {
  const root = tmp();
  const adapter = writeAdapter(root, adapterPatch);
  const work = fullWork(root, { fnd: findings([]), check });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).code, 0);
  const out = join(root, 'r.md');
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  return { md: readFileSync(out, 'utf8'), v: readJson(join(work, 'verdict.json')) };
}
const SP = 'docs/specs/2026-10-06-auto-ingest-design.md';
const rp = (inDiff, p = SP) => ({ raw: p, kind: 'repo-path', project: 'alpha', ref: HEAD, path: p, pinned: true, resolved_sha: HEAD, status: '확보', reason: '', file: 'baseline/1.md', version: HEAD, inDiff });
const typeRow = (md) => md.split('\n').find((l) => l.startsWith('| Baseline 유형 |'));
const supOf = (md) => sectionOf(md, '## 작성자 보완 요청 문안', '\n## ');

test('render 검사표 Baseline 유형: 저장소 문서 경로 + 이 MR 에서 수정됨 · 경로 미확인 n건 접미 · 현행 유형은 바이트 불변 (1.3.5 AC⑤-9·⑤-5)', () => {
  const ck = (type, links, misses) => ({ ...baseCheck(), baselineType: type, baselineLinks: links, ...(misses ? { baselineRepoPathMisses: misses } : {}) });
  assert.equal(typeRow(renderAd(ck('저장소 문서 경로', [rp(true)])).md), '| Baseline 유형 | 저장소 문서 경로(이 MR 에서 수정됨) |');
  assert.equal(typeRow(renderAd(ck('저장소 문서 경로', [rp(false)], [])).md), '| Baseline 유형 | 저장소 문서 경로 |');
  assert.equal(typeRow(renderAd(ck('저장소 문서 경로', [rp(true)], ['docs/specs/b.md'])).md), '| Baseline 유형 | 저장소 문서 경로(이 MR 에서 수정됨 · 경로 미확인 1건) |');
  const miss = renderAd(ck('서술만', [], [SP])).md;
  assert.equal(typeRow(miss), '| Baseline 유형 | 서술만(경로 미확인 1건) |');
  assert.ok(supOf(miss).includes(`- Baseline 에 적은 경로 「${SP}」 가 head 에 일반 파일로 없습니다(오타·삭제·심볼릭 링크) — 경로를 확인해 주세요.\n`), supOf(miss));
  const cur = renderAd(baseCheck()).md;
  assert.equal(typeRow(cur), '| Baseline 유형 | MR 본문 배경 |');
  assert.equal(renderAd(ck('MR 본문 배경', baseCheck().baselineLinks, [])).md.replace(/\n- 어댑터: [^\n]*/, ''), cur.replace(/\n- 어댑터: [^\n]*/, ''));   // 빈 배열도 바이트 불변(어댑터 해시 줄 제외 — 임시 경로가 다르다)
});

test('verdict: 저장소 문서 경로 · 경로 미확인은 기준선 없음(RETURN_TO_DESIGN)·기계 증거를 만들지 않는다 (1.3.5 AC⑤-10·⑤-5)', () => {
  const c = { ...baseCheck(), baselineType: '저장소 문서 경로', baselineLinks: [rp(true)] };
  const v = V(findings([]), { check: c });
  assert.equal(v.baselineMissing, false);
  assert.equal(v.verdict, 'APPROVE');
  const m = { ...baseCheck(), baselineType: '서술만', baselineLinks: [], baselineRepoPathMisses: [SP] };
  const vm = V(findings([]), { check: m });
  assert.deepEqual(vm.machineEvidence, []);
  assert.equal(vm.verdict, V(findings([]), { check: { ...m, baselineRepoPathMisses: undefined } }).verdict);
});

test('render 보완 문구 절 이름: 키 없음 = 「배경」 현행 바이트 · 켬 + 「요약」 절 = 「요약」 · 절 없음 = 첫 별칭 (1.3.5 AC⑥-2·⑥-3·⑥-5·⑥-6 · D110)', () => {
  const r = (reason, patch) => supOf(renderAd({ ...baseCheck(), reason: { text: '', source: 'body', ...reason } }, patch).md);
  const off = r({ why: false, what: false, source: 'none', section: null });
  assert.ok(off.includes('- 「배경」에 ① 왜(관찰한 현상·요청 근거)를 적어 주세요.\n- 「배경」에 ② 무엇을(원인·수정 위치·적용 범위)을 적어 주세요.\n'), off);
  assert.ok(r({ why: true, what: false, section: '배경' }).includes('- 「배경」에 ② 무엇을(원인·수정 위치·적용 범위)을 적어 주세요.'));
  const ON = { contract: { backgroundSections: ['배경', '요약'] } };
  const sum = r({ why: true, what: false, section: '요약' }, ON);
  assert.ok(sum.includes('- 「요약」에 ② 무엇을(원인·수정 위치·적용 범위)을 적어 주세요.'), sum);
  assert.doesNotMatch(sum, /「배경」에/);
  assert.equal(r({ why: true, what: true, section: '요약' }, ON), '');
  assert.ok(r({ why: false, what: false, source: 'none', section: null }, { contract: { backgroundSections: ['요약', '배경'] } }).includes('- 「요약」에 ① 왜'));
});

test('render 보완 문구: 절이 없을 때 쓰는 첫 별칭(어댑터 값)도 평탄화·가림을 거친다 — 줄바꿈 제목 주입·줄로 나뉜 비밀값 차단 (1.3.5 review-loop(impl) R1-1 · D88)', () => {
  const r = (alias) => renderAd({ ...baseCheck(), reason: { why: false, what: false, source: 'none', text: '', section: null } }, { contract: { backgroundSections: [alias] } }).md;
  for (const nl of ['\n', '\r', '\u0085', '\u2028', '\u2029']) {
    const md = r(`요약${nl}## FORGED-APPROVAL${nl}`);
    assert.doesNotMatch(md, /^## FORGED-APPROVAL/m, JSON.stringify(nl));
    assert.ok(supOf(md).includes('- 「요약 ## FORGED-APPROVAL 」에 ① 왜'), supOf(md));
  }
  const sec = r('요약 --password\nDEMO-VALUE');
  assert.doesNotMatch(sec, /DEMO-VALUE/);
});

test('review-loop description 에 「남의 MR 은 mr-review」 안내 · mr-review description 의 「that is review-loop」 유지 (1.3.5 AC-A-1 · D97)', () => {
  const desc = (f) => readFileSync(f, 'utf8').match(/^---\n[\s\S]*?^description: (.*)$/m)[1];
  const rl = desc(join(CLI, '..', '..', '..', 'review-loop', 'SKILL.md'));
  assert.match(rl, /mr-review/);
  assert.match(rl, /someone else's MR/);
  assert.match(desc(join(CLI, '..', '..', 'SKILL.md')), /that is review-loop/);
});

// ── 1.4.0 ⑦ 옛 버전 스킬 경고 (spec 2026-10-24 3.⑦ D118·D119·D144~D146) ──
const { spawnSync: spawnSync7 } = await import('node:child_process');
test('SKILL.md §0: 스킬 버전 비교 블록이 어댑터 확인보다 앞 · SKILL_STALE·SKILL_VERSION_UNKNOWN·SKILL_DEV · ${CLAUDE_SKILL_DIR} · /reload-plugins · 새 세션 · /clear 비해소 · 배너 복사 지시 없음 (1.4.0 AC⑦-1)', () => {
  const skill = skillText();
  const s0 = skill.slice(skill.indexOf('## 0. 전제 확인'), skill.indexOf('## 1. 작업 디렉터리'));
  for (const s of ['SKILL_STALE', 'SKILL_VERSION_UNKNOWN', 'SKILL_DEV', '${CLAUDE_SKILL_DIR}', '`/reload-plugins`', '세션을 새로 열어', '`/clear` 로는 해소되지 않는다']) assert.ok(s0.includes(s), s);
  const cmp = s0.indexOf('B="${CLAUDE_SKILL_DIR}"');
  assert.ok(cmp >= 0 && cmp < s0.indexOf('ADAPTER_MISSING'), '비교 블록이 어댑터 확인 블록보다 앞');
  const block = s0.slice(s0.lastIndexOf('```bash', cmp), s0.indexOf('\n```\n', cmp));
  assert.doesNotMatch(block, /Base directory/);
});

test('SKILL.md §0 스킬 버전 비교 스니펫: 같은 설치 = 출력 없음 · 옛 폴더 = SKILL_STALE · 캐시 밖 = SKILL_DEV · 기록 없음·JSON 오류·엔트리 없음·빈 B·installPath 없음 = SKILL_VERSION_UNKNOWN · project 우선 · 심볼릭 링크 실제 경로 (1.4.0 AC⑦-2)', () => {
  const skill = skillText();
  const blk = skill.slice(skill.indexOf('B="${CLAUDE_SKILL_DIR}"'));
  const m = blk.match(/node -e '([\s\S]*?)' "\$P" "\$PWD" "\$B"/);
  assert.ok(m, 'node -e 스니펫');
  const run = (P, cwd, B) => { const r = spawnSync7(process.execPath, ['-e', m[1], P, cwd, B], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  const root = tmp();
  const P = join(root, 'plugins');
  const ver = (v) => join(P, 'cache', 'm', 'dev-workflow', v);
  for (const v of ['1.3.2', '1.3.5', '1.4.0']) mkdirSync(join(ver(v), 'skills', 'mr-review'), { recursive: true });
  const rec = (plugins) => writeFileSync(join(P, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins }));
  const cwd = join(root, 'proj');
  mkdirSync(cwd, { recursive: true });
  rec({ 'dev-workflow@m': [{ scope: 'user', installPath: ver('1.4.0'), version: '1.4.0' }] });
  assert.equal(run(P, cwd, join(ver('1.4.0'), 'skills', 'mr-review')), '');
  assert.equal(run(P, cwd, join(ver('1.3.2'), 'skills', 'mr-review')), 'SKILL_STALE loaded=1.3.2 installed=1.4.0');
  const repo = join(root, 'somewhere', 'repo', 'dev-workflow', 'skills', 'mr-review');
  mkdirSync(repo, { recursive: true });
  assert.equal(run(P, cwd, repo), 'SKILL_DEV');
  assert.equal(run(P, cwd, ''), 'SKILL_VERSION_UNKNOWN');                      // 치환 없음(옛 Claude Code)
  // project 엔트리(projectPath === PWD) 우선
  rec({ 'dev-workflow@m': [{ scope: 'user', installPath: ver('1.3.5'), version: '1.3.5' }, { scope: 'project', projectPath: cwd, installPath: ver('1.4.0'), version: '1.4.0' }] });
  assert.equal(run(P, cwd, join(ver('1.4.0'), 'skills', 'mr-review')), '');
  assert.equal(run(P, join(root, 'other'), join(ver('1.4.0'), 'skills', 'mr-review')), 'SKILL_STALE loaded=1.4.0 installed=1.3.5');
  // installPath 가 심볼릭 링크 → 실제 경로로 비교
  const link = join(root, 'link-140');
  symlinkSync(ver('1.4.0'), link);
  rec({ 'dev-workflow@m': [{ scope: 'user', installPath: link, version: '1.4.0' }] });
  assert.equal(run(P, cwd, join(ver('1.4.0'), 'skills', 'mr-review')), '');
  // installPath 가 디스크에 없음 → UNKNOWN(STALE 아님)
  rec({ 'dev-workflow@m': [{ scope: 'user', installPath: ver('9.9.9'), version: '9.9.9' }] });
  assert.equal(run(P, cwd, join(ver('1.4.0'), 'skills', 'mr-review')), 'SKILL_VERSION_UNKNOWN');
  rec({ 'other@m': [{ scope: 'user', installPath: ver('1.4.0'), version: '1.4.0' }] });
  assert.equal(run(P, cwd, join(ver('1.4.0'), 'skills', 'mr-review')), 'SKILL_VERSION_UNKNOWN');
  writeFileSync(join(P, 'installed_plugins.json'), '{ not json');
  assert.equal(run(P, cwd, join(ver('1.4.0'), 'skills', 'mr-review')), 'SKILL_VERSION_UNKNOWN');
  rmSync(join(P, 'installed_plugins.json'));
  assert.equal(run(P, cwd, join(ver('1.4.0'), 'skills', 'mr-review')), 'SKILL_VERSION_UNKNOWN');
});

// ── 1.4.0 ① 기준선 결정 대조표 — 검토자 스키마 · 부록 E · verdict 입력 검사 (spec 2026-10-24 3.①-5~8 · D123~D125·D131~D135) ──
const { validateFindings } = await import(join(LIB, 'report.mjs'));
const RV = (over = {}) => ({ reviewer: 'claude', head_sha: HEAD, findings: [], intent: [], baselineCandidateRelevant: true, decisions: [], ...over });
const RF = (over = {}) => ({ lens: 'L1', type: 'FOLLOW_UP', title: 't', file: null, line_start: 0, line_end: 0, evidence: '', scenario: '', confidence: 'low', recommendation: '', fixableInDesign: 'yes', brokenPremise: '', ...over });
test('validateReview: decisions 필수 배열 · result 3종 · VIOLATED 는 location 필수 · 사안 키는 선택이되 원소 형식 검사 (1.4.0 AC①-6 · D123·D125·R5-2)', () => {
  assert.deepEqual(validateReview(RV()), { ok: true, errors: [] });
  const { decisions, ...noDec } = RV();
  assert.ok(validateReview(noDec).errors.includes('decisions 배열 필요'));
  assert.equal(validateReview(RV({ decisions: [{ id: 'B1-D1', result: 'MAYBE', location: null, basis: '미확인' }] })).ok, false);
  assert.equal(validateReview(RV({ decisions: [{ id: 'B1-D1', result: 'VIOLATED', location: null, basis: '코드로 확인' }] })).ok, false);
  assert.equal(validateReview(RV({ decisions: [{ id: '', result: 'KEPT', location: null, basis: '미확인' }] })).ok, false);
  assert.equal(validateReview(RV({ decisions: [{ id: 'B1-D1', result: 'VIOLATED', location: 'src/A.java:357', basis: '코드로 확인' }, { id: 'B1-D3', result: 'KEPT', location: null, basis: '미확인' }] })).ok, true);
  assert.equal(validateReview(RV({ findings: [RF()] })).ok, true);                                       // decisionIds·intentRows 생략 = []
  assert.equal(validateReview(RV({ findings: [RF({ decisionIds: ['B1-D1'], intentRows: [5, 6] })] })).ok, true);
  for (const bad of [{ intentRows: [null] }, { intentRows: ['5'] }, { intentRows: [0] }, { intentRows: [1.5] }, { decisionIds: [null] }, { decisionIds: [''] }, { decisionIds: 'B1-D1' }, { intentRows: 5 }]) {
    assert.equal(validateReview(RV({ findings: [RF(bad)] })).ok, false, JSON.stringify(bad));
  }
  const root = tmp();
  const old = join(root, 'old.json');
  writeFileSync(old, JSON.stringify(noDec));                                                                // 1.3.5 꼴(decisions 없음) → INVALID
  const r = runCli(['review-validate', '--file', old]);
  assert.equal(r.code, 1);
  assert.match(r.first, /^INVALID .*decisions 배열 필요/);
});

test('validateReview: decisions 의 같은 id 중복은 INVALID — 뒤의 VIOLATED 가 병합에서 조용히 버려지는 길을 막는다(순서 무관) (1.4.0 impl R1-2)', () => {
  const kept = { id: 'B1-D1', result: 'KEPT', location: null, basis: '미확인' };
  const viol = { id: 'B1-D1', result: 'VIOLATED', location: 'src/A.java:357', basis: '코드로 확인' };
  for (const decisions of [[kept, viol], [viol, kept], [kept, { ...kept }]]) {
    const r = validateReview(RV({ decisions }));
    assert.equal(r.ok, false, JSON.stringify(decisions));
    assert.ok(r.errors.some((e) => /^decisions\[1\]\.id 중복\(앞 decisions\[0\]\)$/.test(e)), r.errors.join('; '));
  }
});

test('validateReview 오류 문장은 필드 위치·번호·고정 사유만 — 검토자 값(중복 id · reviewer · head_sha)의 비밀값·줄바꿈을 인용하지 않는다(CLI 한 줄) (1.4.0 impl R2-1)', () => {
  const evil = 'password=SYNTHPRIVATE12345\n가짜 줄\u2028둘째';
  const d = { id: evil, result: 'KEPT', location: null, basis: '미확인' };
  const r = validateReview(RV({ decisions: [d, { ...d }] }));
  assert.ok(r.errors.includes('decisions[1].id 중복(앞 decisions[0])'), r.errors.join('; '));
  const w = validateReview(RV({ reviewer: evil, head_sha: evil }), { head: HEAD, reviewer: 'codex' });
  assert.ok(w.errors.includes('reviewer (claude|codex 아님) ≠ 기대 codex'), w.errors.join('; '));
  assert.ok(w.errors.includes('head_sha (40자 SHA 아님) ≠ 기대 head aaaaaaa(스냅샷) — 이전 head 의 검토 결과'), w.errors.join('; '));
  for (const e of [...r.errors, ...w.errors]) assert.doesNotMatch(e, /SYNTHPRIVATE|가짜 줄|\u2028|\n/, e);
  const root = tmp();
  const f = join(root, 'dup.json');
  writeFileSync(f, JSON.stringify(RV({ reviewer: evil, decisions: [d, { ...d }] })));
  const c = runCli(['review-validate', '--file', f, '--reviewer', 'claude']);
  assert.equal(c.code, 1);
  assert.doesNotMatch(c.out + c.err, /SYNTHPRIVATE|가짜 줄|\u2028/);
  assert.equal((c.out + c.err).trim().split('\n').length, 1);
});

test('validateReview: intent 원소는 객체 — [null] 은 INVALID(그 모델만 무효 · 병합이 TypeError 로 멈추지 않는다) · row 없는 객체는 현행 VALID (1.4.0 impl R2-2)', () => {
  const r = validateReview(RV({ intent: [null] }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes('intent[0] 객체 아님'), r.errors.join('; '));
  assert.equal(validateReview(RV({ intent: ['x'] })).ok, false);
  assert.equal(validateReview(RV({ intent: [{ criterion: 'c', result: 'KEPT', location: null, basis: '미확인' }] })).ok, true);
});

const DCHK = () => ({ ...baseCheck(), baselineDecisions: [{ id: 'B1-D1', baseline: 1, key: 'D1', line: 12, text: '조회는 매번 비밀번호' }, { id: 'B1-D3', baseline: 1, key: 'D3', line: 40, text: '잔존 상태는 변경에만' }, { id: 'B1-D7', baseline: 1, key: 'D7', line: 52, text: '탈퇴는 즉시' }] });
const DFND = () => [{ id: 'B1-D1', result: 'UNKNOWN', claims: { claude: 'VIOLATED', codex: 'KEPT' }, location: 'src/A.java:357', basis: '코드로 확인' }, { id: 'B1-D3', result: 'KEPT', location: null, basis: '코드로 확인' }, { id: 'B1-D7', result: '미응답' }];
const MAIN_F = (over = {}) => F({ id: 'F4', source: 'main', type: 'DEFECT', decisionIds: ['B1-D1'], blocking: true, fixableInDesign: 'no', fixableInDesignBasis: '기준선 D1 의 전제가 깨짐', brokenPremise: '조회 때 매번 재인증', scenario: '남은 확인 상태로 조회 응답', evidence: 'src/A.java:357', title: '조회 관문 누락', ...over });
function renderOne(root, { check = baseCheck(), fnd, name = 'r' } = {}) {
  const adapter = writeAdapter(root);
  const work = fullWork(join(root, name), { check, fnd });
  const v = runCli(['verdict', '--adapter', adapter, '--work', work]);
  const out = join(root, `${name}.md`);
  const rr = runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.equal(rr.code, 0, rr.out + rr.err);
  return { md: readFileSync(out, 'utf8'), v, work, adapter };
}

test('render 부록 E: 머리 집계(어김·모름·상충·미응답) · 표 행(상충·미응답·메인 정정) · 관련 발견에 출처 main 포함 · 부록 D 「 · 결정 …」 은 출처 뒤 · 파서 불변 · 「결정 대조 미확인」 없음 (1.4.0 AC①-8 · D132·D134)', () => {
  const root = tmp();
  const { md, v } = renderOne(root, { check: DCHK(), fnd: findings([F({ id: 'F3', decisionIds: ['B1-D1'] })], { decisions: DFND() }) });
  assert.equal(v.first, 'VERDICT determined CHANGES_REQUESTED');
  const e = sectionOf(md, '## 부록 E');
  assert.match(e, /^## 부록 E — 기준선 결정 대조표\n\n- 결정 3건 · 어김 0 · 모름 0 · 상충 1 · 미응답 1\n/);
  assert.ok(e.includes('| id | 결정 | 결과 | 코드 위치 | 관련 발견 |\n|---|---|---|---|---|\n'), e);
  assert.ok(e.includes('| B1-D1 | 조회는 매번 비밀번호 | UNKNOWN(상충 — claude: VIOLATED / codex: KEPT) | src/A.java:357 | F3 |'), e);
  assert.ok(e.includes('| B1-D3 | 잔존 상태는 변경에만 | KEPT | - | - |'), e);
  assert.ok(e.includes('| B1-D7 | 탈퇴는 즉시 | 미응답 | - | - |'), e);
  const d = sectionOf(md, '## 부록 D', '## 부록 E');
  const fl = d.split('\n').find((l) => l.startsWith('- **F3**'));
  assert.match(fl, / · 출처 both · 확신 high · 결정 B1-D1$/);
  assert.deepEqual([...parseAppendixD(md).entries()].map(([id, x]) => [id, x.type, x.title]), [['F3', 'DEFECT', '비밀번호 평문 로그']]);
  assert.doesNotMatch(md, /결정 대조 미확인/);
  // 메인 정정 · 출처 main 발견 · 상한 초과 · 결정 추출 생략
  const chk = { ...DCHK(), baselineDecisionsTruncated: true, baselineDecisionsSkipped: [2] };
  const fixed = [{ id: 'B1-D1', result: 'KEPT', claims: { codex: 'VIOLATED' }, location: null, basis: '메인 정정' }, { id: 'B1-D3', result: 'VIOLATED', location: 'src/B.java:9', basis: '코드로 확인' }, { id: 'B1-D7', result: 'UNKNOWN', location: null, basis: '미확인' }];
  const m2 = renderOne(root, { check: chk, fnd: findings([F({ id: 'F3', decisionIds: ['B1-D3'] }), MAIN_F({ decisionIds: ['B1-D3'] })], { decisions: fixed }), name: 'r2' });
  assert.equal(m2.v.code, 0, m2.v.out);
  const e2 = sectionOf(m2.md, '## 부록 E');
  assert.match(e2, /^## 부록 E — 기준선 결정 대조표\n\n- 결정 3건 · 어김 1 · 모름 1 · 상충 0 · 상한 초과\(100건만\) · 결정 추출 생략\(기준선 2 — 마스킹 잔존\)\n/);
  assert.ok(e2.includes('| B1-D1 | 조회는 매번 비밀번호 | KEPT(메인 정정 — codex: VIOLATED) | - | - |'), e2);
  assert.ok(e2.includes('| B1-D3 | 잔존 상태는 변경에만 | VIOLATED | src/B.java:9 | F3, F4 |'), e2);
  assert.match(sectionOf(m2.md, '## 부록 D', '## 부록 E'), /- \*\*F4\*\* \[L5\] DEFECT \(차단\) — 조회 관문 누락 \(src\/A\.java:3\) · 출처 main · 확신 high · 결정 B1-D3/);
  // baselineDecisions [] · 키 없음 → 부록 E 없음
  assert.doesNotMatch(renderOne(root, { check: { ...baseCheck(), baselineDecisions: [] }, fnd: findings([F()]), name: 'r3' }).md, /## 부록 E/);
  assert.doesNotMatch(renderOne(root, { fnd: findings([F()]), name: 'r4' }).md, /## 부록 E/);
});

test('verdict: decisions·decisionGaps 는 판정을 바꾸지 않는다 · VIOLATED 에 대응 DEFECT·DESIGN_DRIFT 발견이 없으면 ERR · 출처 main 발견 추가·메인 정정·상충 유지는 통과 (1.4.0 AC①-9 · D124·D133)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const run = (fnd, name) => { const work = fullWork(join(root, name), { check: DCHK(), fnd }); return { r: runCli(['verdict', '--adapter', adapter, '--work', work]), work }; };
  const plain = run(findings([F({ id: 'F3' })]), 'p');
  const withDec = run(findings([F({ id: 'F3', decisionIds: ['B1-D1'] })], { decisions: DFND(), decisionGaps: ['B1-D1'] }), 'd');
  assert.equal(withDec.r.first, plain.r.first);
  const pick = (w) => { const v = readJson(join(w, 'verdict.json')); return [v.status, v.verdict, v.evidence, v.defects]; };
  assert.deepEqual(pick(withDec.work), pick(plain.work));
  const viol = [{ id: 'B1-D1', result: 'VIOLATED', location: 'src/A.java:357', basis: '코드로 확인' }];
  for (const [name, list] of [['none', [F({ id: 'F3' })]], ['fu', [F({ id: 'F3', type: 'FOLLOW_UP', blocking: false, decisionIds: ['B1-D1'] })]]]) {
    const { r } = run(findings(list, { decisions: viol }), `v-${name}`);
    assert.equal(r.code, 2, name);
    assert.equal(r.first, 'ERR 결정 어김 대응 발견 없음 B1-D1 — 결과를 정정하거나 출처 main 발견을 추가한다', name);
  }
  const added = run(findings([F({ id: 'F3', type: 'FOLLOW_UP', blocking: false }), MAIN_F()], { decisions: viol }), 'main');
  assert.equal(added.r.first, 'VERDICT determined RETURN_TO_DESIGN');
  const drift = run(findings([F({ id: 'F3', type: 'DESIGN_DRIFT', blocking: false, decisionIds: ['B1-D1'] })], { decisions: viol }), 'drift');   // 유형 기준(D133) — blocking 값 무관
  assert.equal(drift.r.code, 0, drift.r.out);
  const corr = run(findings([F({ id: 'F3' })], { decisions: [{ id: 'B1-D1', result: 'KEPT', claims: { codex: 'VIOLATED' }, location: null, basis: '메인 정정' }] }), 'corr');
  assert.equal(corr.r.code, 0, corr.r.out);
  const conf = run(findings([F({ id: 'F3' })], { decisions: DFND() }), 'conf');
  assert.equal(conf.r.code, 0, conf.r.out);
  // validateFindings — 출처 값 · 출처 main 의 필수 칸
  const vf = (f) => validateFindings(findings([f]));
  assert.ok(vf(F({ source: 'x' })).some((e) => /source/.test(e)));
  assert.deepEqual(vf(MAIN_F()), []);
  assert.ok(vf(MAIN_F({ decisionIds: [] })).length > 0);
  assert.ok(vf(MAIN_F({ fixableInDesignBasis: undefined })).length > 0);
  assert.ok(vf(MAIN_F({ type: 'FOLLOW_UP', blocking: false })).length > 0);
  assert.ok(vf(MAIN_F({ scenario: '' })).length > 0);
  assert.ok(vf(MAIN_F({ fixableInDesign: null })).length > 0);
});

// ── 1.4.0 ② 단독 출처 fixableInDesign 확인 (spec 2026-10-24 3.② · D116·D127·D135 · R1-2·R2-2·R3-3) ──
const S1 = (over = {}) => F({ type: 'DESIGN_DRIFT', source: 'claude', fixableInDesign: null, fixableInDesignClaims: { claude: 'yes' }, unresolved: true, ...over });
test('computeVerdict: 차단 설계 유형의 fixableInDesign null 은 1인 주장·주장 없음·unresolved 없음이어도 3갈래 · 접미 없는 confirmed 는 ERR · 현행 두 갈래 불변 (1.4.0 AC②-1 · R1-2·R2-2)', () => {
  const three = { 'confirmed:fixable': 'CHANGES_REQUESTED', 'confirmed:design': 'RETURN_TO_DESIGN', dismissed: 'APPROVE' };
  for (const f of [S1(), F({ fixableInDesign: null, unresolved: true }), S1({ unresolved: false }), F({ fixableInDesign: null, unresolved: false })]) {
    const u = V(findings([f]));
    assert.equal(u.status, 'undetermined', JSON.stringify(f));
    assert.deepEqual(u.branches.F1, three);
    assert.throws(() => V(findings([f]), { resolves: { F1: 'confirmed' } }), /confirmed:fixable 또는 confirmed:design/);
    assert.equal(V(findings([f]), { resolves: { F1: 'confirmed:design' } }).verdict, 'RETURN_TO_DESIGN');
    assert.equal(V(findings([f]), { resolves: { F1: 'confirmed:fixable' } }).verdict, 'CHANGES_REQUESTED');
  }
  assert.deepEqual(V(findings([F({ unresolved: true })])).branches.F1, { confirmed: 'CHANGES_REQUESTED', dismissed: 'APPROVE' });   // fixableInDesign 'yes' 미확정 후보 — 현행 두 갈래
  assert.equal(V(findings([F({ type: 'MISSING_EVIDENCE', fixableInDesign: null })])).status, 'determined');                       // 설계 유형만
  assert.equal(V(findings([F({ type: 'DESIGN_DRIFT', blocking: false, fixableInDesign: null })])).status, 'determined');           // 비차단은 판정 입력이 아니다
});

test('computeVerdict: 메인이 판단한 값(+basis)이면 확정 · 두 확인 겹침(낮은 확신 unresolved + 수정 가능 판단)은 리뷰어 확인 전 확정 안 됨 (1.4.0 AC②-2 · R2-2)', () => {
  assert.deepEqual([V(findings([S1({ fixableInDesign: 'no', fixableInDesignBasis: '전제 D1 깨짐', unresolved: false })])).status, V(findings([S1({ fixableInDesign: 'no', fixableInDesignBasis: '전제 D1 깨짐', unresolved: false })])).verdict], ['determined', 'RETURN_TO_DESIGN']);
  assert.equal(V(findings([S1({ fixableInDesign: 'yes', fixableInDesignBasis: '국소 수정', unresolved: false })])).verdict, 'CHANGES_REQUESTED');
  const both = V(findings([F({ type: 'DEFECT', source: 'codex', confidence: 'medium', unresolved: true, fixableInDesign: 'yes', fixableInDesignClaims: { codex: 'yes' }, fixableInDesignBasis: '국소 수정' })]));
  assert.equal(both.status, 'undetermined');
  assert.deepEqual(Object.keys(both.branches.F1), ['confirmed', 'dismissed']);
});

test('validateFindings: null 차단 설계 유형은 그 자체로 통과(미확정) · confirmed+null 은 오류 · claims 값·키 · baselineCandidateRelevant null · 주장 위 메인 값엔 basis 필수 (1.4.0 AC②-3 · R1-2·D135)', () => {
  const vf = (f, over = {}) => validateFindings(findings([f], over));
  assert.deepEqual(vf(F({ fixableInDesign: null, unresolved: false, resolution: null })), []);
  assert.deepEqual(vf(F({ fixableInDesign: null, unresolved: true })), []);
  assert.deepEqual(vf(F({ fixableInDesign: null, resolution: 'dismissed' })), []);
  assert.ok(vf(F({ fixableInDesign: null, resolution: 'confirmed' })).some((e) => /null 인 채 confirmed/.test(e)));
  assert.ok(vf(F({ fixableInDesignClaims: { claude: 'maybe' }, resolution: 'confirmed' })).length > 0);
  assert.ok(vf(F({ fixableInDesignClaims: { main: 'yes' }, resolution: 'confirmed' })).length > 0);
  assert.ok(vf(F(), { baselineCandidateRelevant: null }).some((e) => /후보 문서 관련성 미판정/.test(e)));
  assert.deepEqual(vf(F(), { baselineCandidateRelevant: true }), []);
  const { baselineCandidateRelevant, ...noKey } = findings([F()]);
  assert.deepEqual(validateFindings(noKey), []);
  assert.ok(vf(F({ fixableInDesignClaims: { claude: 'yes' }, fixableInDesign: 'no', unresolved: false, resolution: null })).some((e) => /fixableInDesignBasis/.test(e)));
  assert.deepEqual(vf(F({ fixableInDesignClaims: { claude: 'yes' }, fixableInDesign: 'no', unresolved: false, resolution: null, fixableInDesignBasis: '전제 깨짐' })), []);
  assert.deepEqual(vf(F({ fixableInDesignClaims: { claude: 'yes' }, fixableInDesign: 'no', unresolved: false, resolution: 'confirmed' })), []);
  // CLI 복구 순서(R3-3): 이전 버전이 남긴 confirmed+null → --resolve 없음 ERR · 접미 없는 confirmed ERR · confirmed:design 통과·영속
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(root, { fnd: findings([F({ fixableInDesign: null, resolution: 'confirmed', fixableInDesignClaims: { claude: 'no' } })]) });
  const r0 = runCli(['verdict', '--adapter', adapter, '--work', work]);
  assert.equal(r0.code, 2);
  assert.match(r0.first, /F1\.fixableInDesign 이 null 인 채 confirmed — confirmed:fixable\|confirmed:design 으로 정한다/);
  assert.match(runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=confirmed']).first, /^ERR .*confirmed:fixable 또는 confirmed:design/);
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=confirmed:design']).first, 'VERDICT determined RETURN_TO_DESIGN');
  assert.equal(readJson(join(work, 'findings.json')).findings[0].fixableInDesign, 'no');
});

test('render ②: 부록 D 「근거(메인)」·「검토자 주장」 · 없으면 현행 · 미확정 1인 주장은 리뷰어 확인 필요 절에 세 갈래 (1.4.0 AC②-4)', () => {
  const root = tmp();
  const judged = renderOne(root, { fnd: findings([S1({ fixableInDesign: 'no', brokenPremise: '조회 전제', fixableInDesignBasis: '기준선 D1 과 어긋남', unresolved: false })]), name: 'j' });
  assert.match(sectionOf(judged.md, '## 부록 D'), /  - 설계 내 수정 가능: no · 깨진 전제: 조회 전제 · 근거\(메인\): 기준선 D1 과 어긋남 · 검토자 주장: claude=yes\n/);
  const und = renderOne(root, { fnd: findings([S1({ unresolved: false })]), name: 'u' });
  const sec = sectionOf(und.md, '## 리뷰어 확인 필요', '\n## ');
  assert.match(sec, /설계 내 수정 가능 주장: claude=yes/);
  assert.match(sec, /`verdict --resolve F1=confirmed:fixable` 또는 `verdict --resolve F1=confirmed:design` 또는 `verdict --resolve F1=dismissed`/);
});

// ── 1.4.0 ③ verdict 의 needsMain 검사 · 판정 ↔ 발견 일치(findingsDigest) · 부록 D alt 표지 (spec 2026-10-24 3.③-3·5·7 · D140·D142 · R3-1·R5-1·C1) ──
const { createHash: createHash3 } = await import('node:crypto');
const sha = (p) => createHash3('sha256').update(readFileSync(p)).digest('hex');
test('verdict needsMain: decided null → ERR(exit 2) · 전부 채우면 현행 계산 · 키 없음은 검사 없음 · ERR 이면 기존 verdict.json 삭제 · blocking null 은 검증 오류 (1.4.0 AC③-6 · D142 · R3-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const nm = (decided) => [{ id: 'F3', why: 'DESIGN_DRIFT 차단 승격 판단', decided }, { id: 'baselineCandidateRelevant', why: '후보 문서 관련성 상충', decided: '후보 문서가 이번 변경을 다룬다' }];
  const work = fullWork(join(root, 'a'), { fnd: findings([F({ id: 'F3' })], { needsMain: nm(null) }) });
  writeFileSync(join(work, 'verdict.json'), JSON.stringify({ status: 'determined', verdict: 'APPROVE', head_sha: HEAD }));
  const r = runCli(['verdict', '--adapter', adapter, '--work', work]);
  assert.equal(r.code, 2);
  assert.equal(r.first, 'ERR needsMain 미처리 F3 — 메인이 판단해 decided 를 채운다');
  assert.ok(!existsSync(join(work, 'verdict.json')));                                          // ERR → 옛 판정 삭제(R3-1)
  writeFileSync(join(work, 'findings.json'), JSON.stringify(findings([F({ id: 'F3' })], { needsMain: nm('코드 확인 — :357 관문만 확인') })));
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT determined CHANGES_REQUESTED');
  const w2 = fullWork(join(root, 'b'), { fnd: findings([F({ type: 'DESIGN_DRIFT', blocking: null })]) });
  const r2 = runCli(['verdict', '--adapter', adapter, '--work', w2]);
  assert.equal(r2.code, 2);
  assert.match(r2.first, /^ERR findings\.json 검증 실패: F1\.blocking 은 boolean/);
});

test('findingsDigest: verdict 가 최종 findings.json 바이트 sha256 을 새긴다(--resolve 영속 뒤 값 포함) · 뒤에 findings.json 이 바뀌면 render 는 판정 블록 없이 리뷰 실패 · cleanup 은 일치하던 경우만 갱신 (1.4.0 AC③-6b · R5-1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(join(root, 'a'), { fnd: findings([F({ unresolved: true, source: 'codex', confidence: 'low' })]) });
  const fp = join(work, 'findings.json');
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work]).first, 'VERDICT undetermined -');
  assert.equal(readJson(join(work, 'verdict.json')).findingsDigest, sha(fp));
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=dismissed']).first, 'VERDICT determined APPROVE');
  assert.equal(readJson(join(work, 'verdict.json')).findingsDigest, sha(fp));                  // 영속된 바이트 기준
  const out = join(root, 'r.md');
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  assert.match(readFileSync(out, 'utf8'), /추천 판정\(초안\) APPROVE/);
  const f = readJson(fp); f.findings.push(F({ id: 'F2', title: '나중에 추가된 결함' })); writeFileSync(fp, JSON.stringify(f));
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  const md = readFileSync(out, 'utf8');
  assert.doesNotMatch(md, /추천 판정\(초안\) APPROVE/);
  assert.match(md, /리뷰 실패[^\n]*verdict\.json 이 지금 findings\.json 으로 계산한 판정이 아니다 — verdict 를 다시 실행/);
  // verdict → cleanup → render: 판정 블록 유지(cleanup 이 다이제스트 갱신) · cleanup 전에 이미 불일치면 그대로 리뷰 실패
  const ok = fullWork(join(root, 'b'), { fnd: findings([F({ title: '비밀번호 평문 로그 010-1234-5678' })]) });
  assert.equal(runCli(['verdict', '--adapter', adapter, '--work', ok]).first, 'VERDICT determined CHANGES_REQUESTED');
  assert.equal(runCli(['cleanup', '--adapter', adapter, '--work', ok]).code, 0);
  assert.doesNotMatch(readFileSync(join(ok, 'findings.json'), 'utf8'), /010-1234-5678/);       // 가린 사본
  assert.equal(readJson(join(ok, 'verdict.json')).findingsDigest, sha(join(ok, 'findings.json')));
  const o2 = join(root, 'b.md');
  runCli(['render', '--adapter', adapter, '--work', ok, '--out', o2]);
  assert.match(readFileSync(o2, 'utf8'), /추천 판정\(초안\) CHANGES_REQUESTED/);
  const bad = fullWork(join(root, 'c'), { fnd: findings([F()]) });
  runCli(['verdict', '--adapter', adapter, '--work', bad]);
  writeFileSync(join(bad, 'findings.json'), JSON.stringify(findings([F(), F({ id: 'F2' })])));
  runCli(['cleanup', '--adapter', adapter, '--work', bad]);
  const o3 = join(root, 'c.md');
  runCli(['render', '--adapter', adapter, '--work', bad, '--out', o3]);
  assert.match(readFileSync(o3, 'utf8'), /리뷰 실패[^\n]*verdict 를 다시 실행/);
});

test('JSON 파싱 실패 진단 줄은 고정 문구 — 파서 오류문이 인용하는 입력 앞 조각(비밀값 꼴)을 싣지 않는다(review-validate · verdict · readJson) (1.4.0 impl R3-1 전수 점검)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const bad = join(root, 'bad.json');
  writeFileSync(bad, 'password=SYNTHSECRET9 tail');
  const r = runCli(['review-validate', '--file', bad]);
  assert.equal(r.code, 1);
  assert.equal(r.first, 'INVALID JSON 파싱 실패');
  const work = fullWork(join(root, 'a'), { fnd: findings([]) });
  writeFileSync(join(work, 'findings.json'), 'password=SYNTHSECRET9 tail');
  const v = runCli(['verdict', '--adapter', adapter, '--work', work]);
  assert.equal(v.first, 'ERR findings.json JSON 파싱 실패');
  writeFileSync(join(work, 'check.json'), 'password=SYNTHSECRET9 tail');
  const c = runCli(['verdict', '--adapter', adapter, '--work', work]);
  assert.equal(c.first, 'ERR check.json JSON 파싱 실패');
  for (const x of [r, v, c]) assert.doesNotMatch(x.out + x.err, /SYNTH|password=/);
});

test('verdict 지문은 판정 계산에 쓴 바로 그 바이트로 — 계산 뒤 findings.json 이 바뀌어도 옛 판정이 새 파일의 지문을 얻지 않는다 (1.4.0 impl R3-2)', async () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = fullWork(join(root, 'a'), { fnd: findings([]) });
  const fp = join(work, 'findings.json');
  const original = readFileSync(fp);
  const fs = (await import('node:fs')).default;
  const real = fs.readFileSync;
  const { cmdVerdict } = await import(join(LIB, 'report.mjs'));
  const { loadAdapter } = await import(join(LIB, 'adapter.mjs'));
  let n = 0;
  const swapped = Buffer.from(JSON.stringify(findings([F({ title: '나중에 바뀐 차단 결함' })]), null, 2));
  // findings.json 을 처음 읽은 뒤 파일을 바꿔 둔다(두 번째 읽기가 있으면 새 바이트를 본다)
  fs.readFileSync = function (p, ...a) { const out = real.call(this, p, ...a); if (String(p) === fp && ++n === 1) fs.writeFileSync(fp, swapped); return out; };
  try { await cmdVerdict({}, { adapter: loadAdapter(adapter), work }); } finally { fs.readFileSync = real; }
  const v = readJson(join(work, 'verdict.json'));
  assert.equal(v.verdict, 'APPROVE');
  assert.equal(v.findingsDigest, createHash3('sha256').update(original).digest('hex'));            // 계산에 쓴 바이트의 지문 — 바뀐 파일과 불일치 → render 는 리뷰 실패
  assert.notEqual(v.findingsDigest, createHash3('sha256').update(swapped).digest('hex'));
});

test('findingsDigest 영속 순서: 옛 verdict.json(지문 없음 APPROVE) 이 있는 W 에서 --resolve 영속 직후 중단되면 verdict.json 이 없다 → render 리뷰 실패 · verdict.json 을 지울 수 없으면 --resolve ERR 이고 findings.json 불변 (1.4.0 AC③-6b · C1)', () => {
  const root = tmp();
  const adapter = writeAdapter(root);
  const fnd = findings([F({ fixableInDesign: null, fixableInDesignClaims: { claude: 'yes', codex: 'no' } })]);
  const work = fullWork(join(root, 'a'), { fnd });
  writeFileSync(join(work, 'verdict.json'), JSON.stringify({ status: 'determined', verdict: 'APPROVE', head_sha: HEAD, contractPolicyId: 'TEST-POLICY-v1.0', defects: [], evidence: [], unresolved: [], branches: {}, machineEvidence: [], reasons: [] }));
  // 새 verdict.json 쓰기에서 죽는 프로세스(영속은 끝남) — --import 훅으로 주입
  const hook = join(root, 'crash.mjs');
  writeFileSync(hook, "import fs from 'node:fs';\nconst w = fs.writeFileSync;\nfs.writeFileSync = function (p, ...a) { if (String(p).endsWith('verdict.json')) throw new Error('injected crash'); return w.call(this, p, ...a); };\n");
  const r = spawnSync7(process.execPath, ['--import', hook, CLI, 'verdict', '--adapter', adapter, '--work', work, '--resolve', 'F1=confirmed:design'], { encoding: 'utf8' });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(readJson(join(work, 'findings.json')).findings[0].fixableInDesign, 'no');      // 영속은 됐다
  assert.ok(!existsSync(join(work, 'verdict.json')));                                          // 옛 APPROVE 는 영속 전에 지워졌다
  const out = join(root, 'r.md');
  runCli(['render', '--adapter', adapter, '--work', work, '--out', out]);
  const md = readFileSync(out, 'utf8');
  assert.doesNotMatch(md, /추천 판정\(초안\) APPROVE/);
  assert.match(md, /리뷰 실패[^\n]*verdict\.json 없음/);
  // 지울 수 없는 verdict.json(비어 있지 않은 디렉터리) → ERR · findings.json 바이트 불변
  const w2 = fullWork(join(root, 'b'), { fnd });
  mkdirSync(join(w2, 'verdict.json', 'x'), { recursive: true });
  const before = readFileSync(join(w2, 'findings.json'), 'utf8');
  const r2 = runCli(['verdict', '--adapter', adapter, '--work', w2, '--resolve', 'F1=confirmed:design']);
  assert.equal(r2.code, 2);
  assert.match(r2.first, /^ERR .*verdict\.json/);
  assert.equal(readFileSync(join(w2, 'findings.json'), 'utf8'), before);
});

test('render 부록 D alt 표지: 합친 유형과 다른 쪽 원본 유형만 「(codex: … 로 분류 — 제목)」 · 같은 유형은 표지 없음 · alt 없는 현행 바이트 · 파서 불변 (1.4.0 AC③-7 · D140)', () => {
  const root = tmp();
  const fnd = findings([F({ alt: { codex: { type: 'MISSING_EVIDENCE', title: 'V13 적용일 확인 대기', file: 'design.md', line_start: 522, evidence: 'e' } }, joinedBy: 'decisionIds' }), F({ id: 'F2', title: '두 번째', alt: { codex: { type: 'DEFECT', title: '다른 제목', file: 'x', line_start: 1, evidence: 'e' } }, joinedBy: 'fingerprint' })]);
  const { md } = renderOne(root, { fnd });
  const d = sectionOf(md, '## 부록 D');
  assert.match(d.split('\n').find((l) => l.startsWith('- **F1**')), / · 출처 both · 확신 high · \(codex: MISSING_EVIDENCE 로 분류 — V13 적용일 확인 대기\)$/);
  assert.match(d.split('\n').find((l) => l.startsWith('- **F2**')), / · 출처 both · 확신 high$/);
  assert.doesNotMatch(md, /joinedBy|decisionIds/);
  assert.deepEqual([...parseAppendixD(md).entries()].map(([id, x]) => [id, x.type, x.title]), [['F1', 'DEFECT', '비밀번호 평문 로그'], ['F2', 'DEFECT', '두 번째']]);
});

// ── 1.4.0 SKILL.md 문구 (spec 2026-10-24 AC①-10 · AC②-6 · AC③-9) ──
const sec = (skill, a, b) => skill.slice(skill.indexOf(a), skill.indexOf(b));
test('SKILL.md §5: 공통 입력 7 기준선 결정 대조표(k건 · decisions · KEPT·VIOLATED·UNKNOWN · VIOLATED 엔 대응 finding) · Codex 프롬프트에 결정 문구를 붙이지 않는다 · 스키마 decisions·decisionIds·intentRows · 사안 키 규칙 · §6 출처 main·메인 정정 (1.4.0 AC①-10)', () => {
  const skill = skillText();
  const s5 = sec(skill, '## 5. 독립 병렬 검토', '## 6. 병합');
  const in7 = s5.split('\n').find((l) => l.startsWith('7. 기준선 결정 대조표'));
  assert.ok(in7, '공통 입력 7');
  for (const re of [/기준선 결정 k건/, /`decisions`/, /KEPT/, /VIOLATED/, /UNKNOWN/, /대응[^\n]*finding|finding[^\n]*대응/]) assert.match(in7, re);
  assert.match(s5, /결정 문구를 붙이지 않는다/);
  const schema = s5.slice(s5.indexOf('```text'), s5.indexOf('\n```\n', s5.indexOf('```text')));
  for (const k of ['"decisions"', '"decisionIds"', '"intentRows"', 'KEPT|VIOLATED|UNKNOWN']) assert.ok(schema.includes(k), k);
  assert.match(s5, /발견마다 관련 기준선 결정 id 와 검증 표 행 번호를 적어라/);
  assert.doesNotMatch(s5, /다른 검토가/);                                                       // D11
  const s6 = sec(skill, '## 6. 병합', '## 7. 재리뷰');
  assert.match(s6, /출처 `main`/);
  assert.match(s6, /메인 정정/);
});

test('SKILL.md §6-3: 단독 출처 차단 DEFECT·DESIGN_DRIFT 의 fixableInDesign 은 검토자 1명의 주장 · fixableInDesignBasis · 상충 문단과 D9 유지 · unresolved 를 건드리지 않는다 (1.4.0 AC②-6 · D116·R2-2)', () => {
  const s6 = sec(skillText(), '## 6. 병합', '## 7. 재리뷰');
  const r3 = s6.split('\n').find((l) => l.startsWith('3. '));
  assert.ok(r3, '§6-3');
  assert.match(r3, /단독 출처[^\n]*검토자 1명의 주장/);
  assert.match(r3, /`fixableInDesignBasis`/);
  assert.match(r3, /상충/);
  assert.match(r3, /엄한 쪽을 자동으로 고르지 않는다\(D9\)/);
  assert.match(r3, /`unresolved` 를 건드리지 않는다/);
});

test('SKILL.md §6 전면: <CLI> merge(--valid 필수 · --same · --force) → needsMain 의 decided → verdict · 유형 상충 · 허용 칸 목록 · 금지 「손으로 바꾸지 않는다」 · §8 needsMain 없음·결정 대조·merge 수치 · D41 「메인이 원문을 직접 읽어 적는다」 문구 없음 · 지문 규칙은 merge (가) (1.4.0 AC③-9 · D117·D124·D142)', () => {
  const skill = skillText();
  const s6 = sec(skill, '## 6. 병합', '## 7. 재리뷰');
  for (const s of ['<CLI> merge', '`needsMain`', '`decided`', '`--same`', '`--force`', '`--valid`', '유형 상충', '`coveredBy`', '출처 `main`']) assert.ok(s6.includes(s), s);
  assert.match(s6, /허용 칸/);
  assert.match(s6, /`file` \+ 정규화 제목/);
  assert.doesNotMatch(skill, /메인이 `mr\.json\.description` ?의 검증 표에서 직접 읽은 원문/);
  const ban = skill.slice(skill.indexOf('## 금지'));
  assert.match(ban, /손으로 바꾸지 않는다/);
  const s8 = sec(skill, '## 8. 출력', '## 9.');
  for (const s of ['needsMain 없음', '기준선 결정 k건 중 어김 n(모름 m)', '결정 추출 생략(기준선 n — 마스킹 잔존)', 'joined', 'candidates']) assert.ok(s8.includes(s), s);
});
