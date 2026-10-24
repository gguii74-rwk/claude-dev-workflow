// merge 계약 테스트 (spec 2026-10-24 3.③ · 3.①-6 · 3.②-4 — SC-6 merge · SC-5 findings.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync, symlinkSync, linkSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { tmp, writeAdapter, runCli, readJson, LIB } from './helpers.mjs';

const { mergeReviews } = await import(join(LIB, 'merge.mjs'));
const HEAD = 'a'.repeat(40);
const RF = (over = {}) => ({ lens: 'L5', type: 'DEFECT', title: 't', file: 'src/A.java', line_start: 1, line_end: 1, evidence: 'e', scenario: 's', confidence: 'high', recommendation: 'r', fixableInDesign: 'yes', brokenPremise: '', ...over });
const REV = (reviewer, findings = [], over = {}) => ({ reviewer, head_sha: HEAD, findings, intent: [], baselineCandidateRelevant: true, decisions: [], ...over });
const DEC = (id) => ({ id, baseline: Number(id.match(/^B(\d+)/)[1]), key: id.split('-')[1], line: 1, text: `결정 ${id}` });
const SNAP = { mode: 'worktree', target_sha: 'b'.repeat(40), base_sha: 'b'.repeat(40), head_sha: HEAD, checkout: null, worktree: null, attempts: 1, unrecovered: [], rebuilt: [], fetched_at: '2026-10-24T00:00:00Z' };
const PACK = (b2 = true) => ({ sources: [{ id: 'S1', kind: 'baseline', ref: 'baseline/1.md', exportAllowed: true, inPackB: true, lines: 3 }, { id: 'S2', kind: 'baseline', ref: 'baseline/2.md', exportAllowed: b2, inPackB: b2, lines: 3 }] });
const FULL_CHECK = {
  contract: { found: true, policyId: 'TEST-POLICY-v1.0', policyStatus: '채움(구버전)', lines: [{ name: 'Policy', status: '채움(구버전)', value: 'TEST-POLICY-v1.0' }], complete: true, incompleteLines: [] },
  track: '정식', baselineType: 'MR 본문 배경', baselineLinks: [], reason: { why: true, what: true, source: 'body', text: '' }, baselineCandidateFiles: [], baselineConfirm: { status: '해당 없음' }, attachments: [], attachmentClaimedButMissing: false,
  deployRequired: false, deployExempt: false, deployNote: '비해당', rebase: { need: false, detailed_merge_status: 'mergeable' }, reviewerMismatch: false, priorVerdicts: [], authorTokens: [], ignoredComments: [],
  rereview: { active: false }, earlyExit: { would: false, reason: '', draftVerdict: null },
};

function mkW({ claude, codex, decisions = [], pack = PACK(), stats = null, codexFirst = false, full = false } = {}) {
  const root = tmp();
  const adapter = writeAdapter(root);
  const work = join(root, 'work');
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, 'snapshot.json'), JSON.stringify(SNAP));
  writeFileSync(join(work, 'check.json'), JSON.stringify({ ...(full ? FULL_CHECK : {}), baselineDecisions: decisions }));
  if (pack) writeFileSync(join(work, 'pack.json'), JSON.stringify(pack));
  const put = (name, v) => { if (v) writeFileSync(join(work, `review-${name}.json`), typeof v === 'string' ? v : JSON.stringify(v)); };
  if (codexFirst) { put('codex', codex); put('claude', claude); } else { put('claude', claude); put('codex', codex); }
  if (stats) writeFileSync(join(work, 'codex-stats.json'), JSON.stringify(stats));
  if (full) {
    writeFileSync(join(work, 'mr.json'), JSON.stringify({ project: { name: 'alpha', id: 101 }, iid: 7, title: 'fix(x): y', description: '', web_url: '', author: { id: 1, username: 'author-a' }, reviewers: [], approved_by: [], diffs: [], notes: [] }));
    writeFileSync(join(work, 'deploy.json'), JSON.stringify({ applicable: false, reason: '운영 배포 대상 변경 없음', expected: { deploy: [], deleted: [] }, zip: { attachment: null, downloaded: false, comment_sha: null, entries: [] }, bodyDeletedList: [], result: '해당 없음', mismatches: [] }));
  }
  return { root, adapter, work };
}
const merge = (w, ...extra) => runCli(['merge', '--adapter', w.adapter, '--work', w.work, ...extra]);
const fj = (w) => readJson(join(w.work, 'findings.json'));
const rest = (r) => r.out.split('\n').slice(1);
const line2 = (r, key) => rest(r).find((l) => l.startsWith(`${key}:`));
const both = (claude, codex, opts = {}) => mkW({ claude: REV('claude', claude, opts.claudeOver), codex: REV('codex', codex, opts.codexOver), ...opts });

test('merge 규칙 (가)~(다): decisionIds 로 다른 파일·제목·유형의 같은 사안을 합친다 · 센 유형 쪽 대표 + alt · 키 합집합 · 파일 읽는 순서가 바뀌어도 findings.json 바이트 동일 (1.4.0 AC③-1)', () => {
  const claude = [RF({ title: '적용일이 지난 날짜', file: 'privacy.html', line_start: 699, decisionIds: ['B2-D4'], intentRows: [13] }), RF({ type: 'MISSING_EVIDENCE', title: '2차 spec 승인 증거 없음', file: 'design.md', line_start: 6, decisionIds: ['B1-D3'] })];
  const codex = [RF({ type: 'MISSING_EVIDENCE', title: 'V13 적용일 확인 대기', file: 'design.md', line_start: 522, decisionIds: ['B2-D4'] }), RF({ type: 'FOLLOW_UP', title: 'Baseline 링크 빠짐', file: null, line_start: 0, decisionIds: ['B1-D3'] })];
  const opts = { decisions: [DEC('B1-D3'), DEC('B2-D4')] };
  const w = both(claude, codex, opts);
  const r = merge(w, '--valid', 'claude,codex');
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.first, /^MERGED reviewers=claude,codex findings=2 joined=2 candidates=0 needsMain=\d+$/);
  const f = fj(w);
  const [f1, f2] = f.findings;
  assert.deepEqual([f1.id, f1.source, f1.joinedBy, f1.type, f1.title, f1.file, f1.alt.codex.type], ['F1', 'both', 'decisionIds', 'DEFECT', '적용일이 지난 날짜', 'privacy.html', 'MISSING_EVIDENCE']);
  assert.deepEqual([f1.decisionIds, f1.intentRows], [['B2-D4'], [13]]);
  assert.deepEqual([f2.id, f2.source, f2.joinedBy, f2.type, f2.alt.codex.type], ['F2', 'both', 'decisionIds', 'MISSING_EVIDENCE', 'FOLLOW_UP']);
  assert.deepEqual(f1.alt.codex, { type: 'MISSING_EVIDENCE', title: 'V13 적용일 확인 대기', file: 'design.md', line_start: 522, evidence: 'e' });
  const w2 = both(claude, codex, { ...opts, codexFirst: true });
  assert.equal(merge(w2, '--valid', 'claude,codex').code, 0);
  assert.equal(readFileSync(join(w2.work, 'findings.json'), 'utf8'), readFileSync(join(w.work, 'findings.json'), 'utf8'));
  // 순수 함수도 입력 객체의 키 순서와 무관
  const check = { baselineDecisions: opts.decisions };
  const a = mergeReviews({ claude: REV('claude', claude), codex: REV('codex', codex), check, pack: PACK(), snapshot: SNAP, valid: ['claude', 'codex'] });
  const b = mergeReviews({ valid: ['codex', 'claude'], snapshot: SNAP, pack: PACK(), check, codex: REV('codex', codex), claude: REV('claude', claude) });
  assert.equal(JSON.stringify(a.findings), JSON.stringify(b.findings));
});

test('merge 짝 짓기: 1:1 · 강한 규칙부터 패스(지문이 배열 뒤에 있어도 먼저) · (다) 는 같은 파일만, 행만 같으면 후보 · 같은 파일 후보 · --same 패스 0 · 범위 밖 --same ERR (1.4.0 AC③-2 · D136·D137·D138)', () => {
  const D = { decisions: [DEC('B1-D1')] };
  const w1 = both([RF({ title: 'A', decisionIds: ['B1-D1'] }), RF({ title: 'B', file: 'src/B.java', decisionIds: ['B1-D1'] })], [RF({ title: 'one', file: 'src/C.java', decisionIds: ['B1-D1'] })], D);
  assert.match(merge(w1, '--valid', 'claude,codex').first, /findings=2 joined=1 /);
  assert.deepEqual(fj(w1).findings.map((f) => [f.title, f.source]), [['A', 'both'], ['B', 'claude']]);
  const w2 = both([RF({ title: 'X', file: 'p', intentRows: [5] })], [RF({ title: 'Y', file: 'p', intentRows: [5] }), RF({ title: 'X', file: 'p' })]);
  merge(w2, '--valid', 'claude,codex');
  const f2 = fj(w2).findings;
  assert.deepEqual(f2.map((f) => [f.title, f.source, f.joinedBy ?? null]), [['X', 'both', 'fingerprint'], ['Y', 'codex', null]]);
  const w3 = both([RF({ title: 'doc', file: 'docs/a.md', intentRows: [13] })], [RF({ title: 'code', file: 'src/A.java', intentRows: [13] })]);
  const r3 = merge(w3, '--valid', 'claude,codex');
  assert.match(r3.first, /findings=2 joined=0 candidates=1 /);
  assert.equal(line2(r3, 'candidates'), 'candidates: claude:1~codex:1(같은 행 13)');
  assert.deepEqual(fj(w3).mergeCandidates, [{ pair: ['F1', 'F2'], why: '같은 행 13' }]);
  const w4 = both([RF({ title: 'a', file: 'src/P.java' }), RF({ title: 'b', file: 'src/Q.java' })], [RF({ title: 'c', file: 'src/Q.java' })]);
  const r4 = merge(w4, '--valid', 'claude,codex');
  assert.equal(line2(r4, 'candidates'), 'candidates: claude:2~codex:1(같은 파일 src/Q.java)');
  assert.deepEqual(fj(w4).mergeCandidates, [{ pair: ['F2', 'F3'], why: '같은 파일' }]);
  const r5 = merge(w4, '--valid', 'claude,codex', '--force', '--same', 'claude:2=codex:1');
  assert.match(r5.first, /findings=2 joined=1 candidates=0 /);
  assert.deepEqual(fj(w4).findings.map((f) => [f.title, f.joinedBy ?? null]), [['a', null], ['b', 'same']]);
  for (const bad of ['claude:9=codex:1', 'claude:1=codex:0', 'codex:1=claude:1']) {
    const r = merge(w4, '--valid', 'claude,codex', '--force', '--same', bad);
    assert.equal(r.code, 2, bad);
    assert.match(r.first, /^ERR .*--same/, bad);
  }
  const dup = merge(w4, '--valid', 'claude,codex', '--force', '--same', 'claude:1=codex:1', '--same', 'claude:2=codex:1');
  assert.match(dup.first, /^ERR .*--same/);
});

test('merge 초안 값·needsMain: 단독 설계 유형은 확신 무관 fixableInDesign null + 1인 주장(unresolved false) · DESIGN_DRIFT blocking null · 낮은 확신 · 유형 상충 · 섞인 유형 주장 · 순서 (1.4.0 AC③-3 · AC②-5 · D126·D127·D141·R2-2)', () => {
  const w = mkW({ claude: REV('claude', [RF({ type: 'DESIGN_DRIFT', title: 'dd', file: 'a', fixableInDesign: 'yes' }), RF({ title: 'hi', file: 'b' }), RF({ type: 'MISSING_EVIDENCE', title: 'me', file: 'c' }), RF({ type: 'DEFECT', title: 'mix', file: 'd', fixableInDesign: 'no', brokenPremise: '전제 P', decisionIds: ['B1-D1'] }), RF({ type: 'FOLLOW_UP', title: 'fu', file: 'e' })]),
    codex: REV('codex', [RF({ title: 'med', file: 'f', confidence: 'medium' }), RF({ type: 'FOLLOW_UP', title: 'me', file: 'c' }), RF({ type: 'MISSING_EVIDENCE', title: 'mix2', file: 'g', fixableInDesign: 'yes', decisionIds: ['B1-D1'] })]), decisions: [DEC('B1-D1')] });
  const r = merge(w, '--valid', 'claude,codex');
  assert.equal(r.code, 0, r.out);
  const f = fj(w);
  const by = Object.fromEntries(f.findings.map((x) => [x.title, x]));
  const pick = (x) => [x.blocking, x.fixableInDesign, x.fixableInDesignClaims, x.unresolved];
  assert.deepEqual(pick(by.dd), [null, null, { claude: 'yes' }, false]);
  assert.deepEqual(pick(by.hi), [true, null, { claude: 'yes' }, false]);           // 단독 high 도 초안 null(D127)
  assert.deepEqual(pick(by.med), [true, null, { codex: 'yes' }, false]);
  assert.deepEqual(pick(by.fu), [false, 'yes', null, false]);
  assert.deepEqual([by.me.source, by.me.type, by.me.blocking, by.me.fixableInDesignClaims], ['both', 'MISSING_EVIDENCE', true, null]);
  assert.deepEqual([by.mix.source, by.mix.fixableInDesign, by.mix.fixableInDesignClaims, by.mix.brokenPremise, by.mix.unresolved], ['both', null, { claude: 'no' }, '전제 P', false]);   // 섞인 유형(D141)
  const nm = f.needsMain.map((n) => [n.id, n.why, n.decided]);
  assert.deepEqual(nm, [
    [by.dd.id, 'DESIGN_DRIFT 차단 승격 판단', null], [by.dd.id, '단독 출처 설계 내 수정 가능 판단', null],
    [by.hi.id, '단독 출처 설계 내 수정 가능 판단', null],
    [by.me.id, '유형 상충 — 한쪽 비차단', null],
    [by.mix.id, '단독 출처 설계 내 수정 가능 판단', null],
    [by.med.id, '단독 출처 낮은 확신 차단', null], [by.med.id, '단독 출처 설계 내 수정 가능 판단', null],
  ]);
  assert.match(r.first, /needsMain=7$/);
  // both 같은 값 · 상충 · DEFECT↔MISSING_EVIDENCE 는 유형 상충 아님
  const w2 = mkW({ claude: REV('claude', [RF({ title: 'same', file: 'a' }), RF({ title: 'diff', file: 'b', fixableInDesign: 'yes' }), RF({ title: 'dm', file: 'c' })]), codex: REV('codex', [RF({ title: 'same', file: 'a' }), RF({ title: 'diff', file: 'b', fixableInDesign: 'no', brokenPremise: '코덱스 전제' }), RF({ type: 'MISSING_EVIDENCE', title: 'dm', file: 'c' })]) });
  merge(w2, '--valid', 'claude,codex');
  const f2 = fj(w2);
  const b2 = Object.fromEntries(f2.findings.map((x) => [x.title, x]));
  assert.deepEqual([b2.same.fixableInDesign, b2.same.fixableInDesignClaims, b2.same.blocking], ['yes', null, true]);
  assert.deepEqual([b2.diff.fixableInDesign, b2.diff.fixableInDesignClaims, b2.diff.brokenPremise, b2.diff.unresolved], [null, { claude: 'yes', codex: 'no' }, '코덱스 전제', false]);
  assert.deepEqual(f2.needsMain.map((n) => [n.id, n.why]), [[b2.diff.id, '설계 내 수정 가능 상충'], [b2.dm.id, '단독 출처 설계 내 수정 가능 판단']]);   // DEFECT(claude)+ME(codex) — 설계 유형 주장 1명, 유형 상충 아님
});

test('merge intent: row 기준 · criterion 은 claude 값(비면 codex · 둘 다 비면 고정 문구 + criterionMissing) · result 다르면 UNKNOWN · basis·location 은 코드로 확인 쪽 · --rows 범위 밖 버림 · row 없음은 배열 순서 (1.4.0 AC③-4 · D122·D143)', () => {
  const I = (row, criterion, result, basis = '작성자 주장', location = '-') => ({ row, criterion, result, location, basis });
  const claude = [I(1, 'M1 claude', 'PASS'), I(2, 'M2 claude', 'PASS'), I(3, 'M3 claude', 'PASS'), I(6, '', 'PASS')];
  const codex = [I(2, 'M2 codex', 'FAIL', '코드로 확인', 'src/A.java:9'), I(3, 'M3 codex', 'PASS'), I(4, 'M4 codex', 'PASS'), I(6, 'M6 codex', 'PASS'), I(7, '', 'UNKNOWN')];
  const w = mkW({ claude: REV('claude', [], { intent: claude }), codex: REV('codex', [], { intent: codex }) });
  const r = merge(w, '--valid', 'claude,codex');
  const it = fj(w).intent;
  assert.deepEqual(it.map((x) => x.row), [1, 2, 3, 4, 6, 7]);
  assert.deepEqual(it.map((x) => x.criterion), ['M1 claude', 'M2 claude', 'M3 claude', 'M4 codex', 'M6 codex', '(행 7 — criterion 없음)']);
  assert.deepEqual([it[1].result, it[1].basis, it[1].location], ['UNKNOWN', '코드로 확인', 'src/A.java:9']);
  assert.equal(line2(r, 'criterionMissing'), 'criterionMissing: 7');
  const r2 = merge(w, '--valid', 'claude,codex', '--force', '--rows', '3');
  assert.deepEqual(fj(w).intent.map((x) => x.row), [1, 2, 3]);
  assert.equal(line2(r2, 'rowsDropped'), 'rowsDropped: claude: 6 · codex: 4, 6, 7');
  const w3 = mkW({ claude: REV('claude', [], { intent: [I(1, 'a', 'PASS')] }), codex: REV('codex', [], { intent: [{ criterion: 'x', result: 'PASS', location: '-', basis: '작성자 주장' }, { criterion: 'y', result: 'PASS', location: '-', basis: '작성자 주장' }] }) });
  const r3 = merge(w3, '--valid', 'claude,codex');
  assert.deepEqual(fj(w3).intent.map((x) => [x.row, x.criterion]), [[1, 'a'], [2, 'y']]);
  assert.equal(line2(r3, 'rowsMissing'), 'rowsMissing: codex');
});

test('merge decisions: id 병합 · 상충은 UNKNOWN + claims · 미응답 · 검토자별 허용 id(Codex = 팩 B 에 실린 기준선) · 걸러 낸 decisionIds · decisionGaps 는 유형 기준 (1.4.0 AC①-7 · AC①-6 · D132·D133·R6-2)', () => {
  const C = (id, result, location = null) => ({ id, result, location, basis: '코드로 확인' });
  const decisions = [DEC('B1-D1'), DEC('B1-D3'), DEC('B1-D7'), DEC('B2-D4')];
  const w = mkW({ decisions, pack: PACK(false),
    claude: REV('claude', [RF({ type: 'DESIGN_DRIFT', title: 'gap', file: 'x', decisionIds: ['B1-D1', 'B1-D9'] })], { decisions: [C('B1-D1', 'VIOLATED', ':357'), C('B1-D3', 'KEPT'), C('B2-D4', 'VIOLATED', 'src/B.java:1')] }),
    codex: REV('codex', [RF({ title: 'cx', file: 'y', decisionIds: ['B2-D4'] })], { decisions: [C('B1-D1', 'KEPT'), C('B1-D3', 'KEPT'), C('B1-D9', 'UNKNOWN'), C('B2-D4', 'KEPT')] }) });
  const r = merge(w, '--valid', 'claude,codex');
  assert.equal(r.code, 0, r.out);
  const f = fj(w);
  const d = Object.fromEntries(f.decisions.map((x) => [x.id, x]));
  assert.deepEqual([d['B1-D1'].result, d['B1-D1'].claims, d['B1-D1'].location], ['UNKNOWN', { claude: 'VIOLATED', codex: 'KEPT' }, ':357']);
  assert.equal(d['B1-D3'].result, 'KEPT');
  assert.deepEqual(d['B1-D7'], { id: 'B1-D7', result: '미응답' });
  assert.deepEqual([d['B2-D4'].result, d['B2-D4'].claims, d['B2-D4'].source], ['VIOLATED', undefined, 'claude']);   // 전송 금지 기준선 — claude 값(상충 아님)
  assert.equal(line2(r, 'decisionsDropped'), 'decisionsDropped: claude: B1-D9 · codex: B1-D9, B2-D4');
  assert.equal(line2(r, 'decisionsMissing'), 'decisionsMissing: claude: 1건 · codex: 1건');                     // codex 는 B2-* 를 세지 않는다
  const byT = Object.fromEntries(f.findings.map((x) => [x.title, x]));
  assert.deepEqual(byT.gap.decisionIds, ['B1-D1']);
  assert.deepEqual(byT.cx.decisionIds, []);                                                                     // 받지 못한 id 로 짝 짓지 않는다
  assert.deepEqual(f.decisionGaps, ['B2-D4']);                                                                  // B1-D1 은 DESIGN_DRIFT(초안 blocking null)가 대응
  assert.ok(f.needsMain.some((n) => n.id === 'decisions:B2-D4' && n.why === '결정 어김 대응 발견 없음'));
  // FOLLOW_UP 뿐이면 대응 아님
  const w2 = mkW({ decisions: [DEC('B1-D1')], claude: REV('claude', [RF({ type: 'FOLLOW_UP', title: 'fu', decisionIds: ['B1-D1'] })], { decisions: [C('B1-D1', 'VIOLATED', ':1')] }) });
  merge(w2, '--valid', 'claude');
  assert.deepEqual(fj(w2).decisionGaps, ['B1-D1']);
  // codex 가 유효인데 pack.json 없음 → ERR
  const w3 = mkW({ pack: null, claude: REV('claude'), codex: REV('codex') });
  assert.match(merge(w3, '--valid', 'claude,codex').first, /^ERR .*pack\.json/);
  // check 에 없는 같은 id 뿐인 같은 파일 두 DEFECT 는 (나) 로 합치지 않는다(걸러 낸 뒤 빈 교집합)
  const w4 = mkW({ claude: REV('claude', [RF({ title: 'p', file: 'z', decisionIds: ['B9-D9'] })]), codex: REV('codex', [RF({ title: 'q', file: 'z', decisionIds: ['B9-D9'] })]) });
  merge(w4, '--valid', 'claude,codex');
  assert.deepEqual(fj(w4).findings.map((x) => x.source), ['claude', 'codex']);
});

test('merge 유효성·골격·통계·기존 findings.json·옛 판정 무효화 (1.4.0 AC③-5 · D139 · R3-1)', () => {
  const stale = mkW({ claude: REV('claude', [RF()]), codex: REV('codex', [RF()], { head_sha: 'c'.repeat(40) }), stats: { commands: 3, changedFiles: 4, filesMentioned: 1, weak: false } });
  const r = merge(stale, '--valid', 'claude,codex');
  assert.match(r.first, /^MERGED reviewers=claude findings=1 /);
  assert.equal(line2(r, 'invalid'), 'invalid: codex(head 다름)');
  const f = fj(stale);
  assert.deepEqual([f.validReviewers, f.crossChecked, f.outsideWorktreePaths, f.head_sha], [['claude'], false, [], HEAD]);
  assert.deepEqual(f.reviewerStats, { codex: { commands: 3, changedFiles: 4, filesMentioned: 1, weak: false } });
  // 둘 다 무효 → 골격
  const none = mkW({ claude: REV('claude', [], { head_sha: 'c'.repeat(40) }), codex: '{ broken' });
  const rn = merge(none, '--valid', 'claude,codex');
  assert.equal(rn.first, 'MERGED reviewers=- findings=0 joined=0 candidates=0 needsMain=0');
  const sk = fj(none);
  assert.deepEqual([sk.validReviewers, sk.crossChecked, sk.findings, sk.intent], [[], false, [], []]);
  // 기존 findings.json: 같은 head → ERR · --force → 덮어씀 · 다른 head → replaced · JSON 아님 → ERR
  const same = merge(stale, '--valid', 'claude');
  assert.equal(same.code, 2);
  assert.equal(same.first, 'ERR findings.json 이미 있음(같은 head) — --force 로 덮어쓴다(메인이 채운 칸을 잃는다)');
  assert.equal(merge(stale, '--valid', 'claude', '--force').code, 0);
  writeFileSync(join(stale.work, 'findings.json'), JSON.stringify({ head_sha: 'd'.repeat(40), findings: [] }));
  assert.equal(line2(merge(stale, '--valid', 'claude'), 'replaced'), 'replaced: findings.json(head ddddddd)');
  writeFileSync(join(stale.work, 'findings.json'), 'not json');
  const nj = merge(stale, '--valid', 'claude', '--force');
  assert.equal(nj.code, 2);
  assert.match(nj.first, /^ERR findings\.json/);
  assert.equal(readFileSync(join(stale.work, 'findings.json'), 'utf8'), 'not json');
});

test('merge 옛 판정 무효화: --force 재병합이 verdict.json(APPROVE)을 먼저 지우고 invalidated 줄 · 이어서 verdict ERR · render 는 APPROVE 블록을 만들지 않는다 (1.4.0 AC③-5 · R3-1)', () => {
  const w = mkW({ full: true, claude: REV('claude', [RF({ type: 'DESIGN_DRIFT', title: 'dd' })]) });
  writeFileSync(join(w.work, 'findings.json'), JSON.stringify({ head_sha: HEAD, validReviewers: ['claude'], crossChecked: false, baselineCandidateRelevant: true, findings: [], intent: [], outsideWorktreePaths: [] }));
  assert.equal(runCli(['verdict', '--adapter', w.adapter, '--work', w.work]).first, 'VERDICT determined APPROVE');
  const r = merge(w, '--valid', 'claude', '--force');
  assert.equal(r.code, 0, r.out);
  assert.ok(!existsSync(join(w.work, 'verdict.json')));
  assert.equal(line2(r, 'invalidated'), 'invalidated: verdict.json');
  const v = runCli(['verdict', '--adapter', w.adapter, '--work', w.work]);
  assert.equal(v.code, 2);
  assert.match(v.first, /^ERR needsMain 미처리 F1 — 메인이 판단해 decided 를 채운다$/);
  const out = join(w.root, 'r.md');
  assert.equal(runCli(['render', '--adapter', w.adapter, '--work', w.work, '--out', out]).code, 0);
  const md = readFileSync(out, 'utf8');
  assert.doesNotMatch(md, /추천 판정\(초안\) APPROVE/);
  assert.match(md, /리뷰 실패/);
});

test('merge 출력 가림: 버린 결정 id·후보 파일 경로의 비밀값이 stdout 에 없고 줄 구분 문자가 없다 · 무효 이유는 고정 범주만(파서 인용 없음) (1.4.0 AC③-5 · R3-2·R6-1)', () => {
  const w = mkW({ decisions: [DEC('B1-D1')], claude: REV('claude', [RF({ title: 'a', file: 'src/X.java\u2028--password hunter2pass' })]), codex: REV('codex', [RF({ title: 'b', file: 'src/X.java\u2028--password hunter2pass' })], { decisions: [{ id: 'password=hunter2pass', result: 'KEPT', location: null, basis: '미확인' }] }) });
  const r = merge(w, '--valid', 'claude,codex');
  assert.equal(r.code, 0, r.out);
  assert.doesNotMatch(r.out, /hunter2pass/);
  assert.ok(!/[\r\u0085\u2028\u2029]/.test(r.out));
  assert.ok(line2(r, 'candidates') && line2(r, 'decisionsDropped'), r.out);
  const bad = mkW({ claude: REV('claude'), codex: `{"password":${' '.repeat(80)}SYNTHPRIVATE12345}` });
  const rb = merge(bad, '--valid', 'claude,codex');
  assert.equal(line2(rb, 'invalid'), 'invalid: codex(JSON 아님)');
  assert.doesNotMatch(rb.out, /SYNTHPRIVA/);
  const sch = mkW({ claude: REV('claude'), codex: REV('codex', [RF({ type: 'BOGUS password=hunter2pass' })]) });
  const rs = merge(sch, '--valid', 'claude,codex');
  assert.equal(line2(rs, 'invalid'), 'invalid: codex(스키마 불통과: findings[0].type)');
  const nm = mkW({ claude: REV('claude'), codex: REV('claude') });
  assert.equal(line2(merge(nm, '--valid', 'claude,codex'), 'invalid'), 'invalid: codex(검토자 이름 다름)');
});

test('merge --valid: 필수 · 목록 밖 파일은 읽지 않고 excluded · 이름 오류 ERR · - 는 골격 · 목록 안 파일 없음은 invalid · verdict.json 삭제 실패면 ERR 이고 findings.json 불변 (1.4.0 AC③-8b · R4-1·R4-2)', () => {
  const w = mkW({ claude: REV('claude', [RF()]), codex: REV('codex', [RF({ title: 'only codex', file: 'q' })]) });
  const r = merge(w, '--valid', 'claude');
  assert.match(r.first, /^MERGED reviewers=claude findings=1 /);
  assert.equal(line2(r, 'excluded'), 'excluded: codex(--valid 밖)');
  assert.deepEqual([fj(w).validReviewers, fj(w).crossChecked], [['claude'], false]);
  assert.match(merge(w, '--force').first, /^ERR .*--valid/);
  assert.match(merge(w, '--force', '--valid', 'claude,gemini').first, /^ERR .*--valid/);
  assert.equal(merge(w, '--force', '--valid', '-').first, 'MERGED reviewers=- findings=0 joined=0 candidates=0 needsMain=0');
  // cleanup(마스킹 사본) 뒤 재병합도 같은 결과(§5 9단계 ⓒ — 원 validReviewers 를 그대로 넘긴다)
  const cw = mkW({ full: true, claude: REV('claude', [RF()]), codex: REV('codex', [RF({ title: 'only codex', file: 'q' })]) });
  assert.equal(merge(cw, '--valid', 'claude').code, 0);
  const first = readFileSync(join(cw.work, 'findings.json'), 'utf8');
  assert.equal(runCli(['cleanup', '--adapter', cw.adapter, '--work', cw.work]).code, 0);
  const rc = merge(cw, '--force', '--valid', readJson(join(cw.work, 'findings.json')).validReviewers.join(','));
  assert.match(rc.first, /^MERGED reviewers=claude findings=1 /);
  assert.equal(line2(rc, 'excluded'), 'excluded: codex(--valid 밖)');
  assert.equal(readFileSync(join(cw.work, 'findings.json'), 'utf8'), first);
  const nf = mkW({ claude: REV('claude') });
  assert.equal(line2(merge(nf, '--valid', 'claude,codex'), 'invalid'), 'invalid: codex(파일 없음)');
  // 삭제 실패 주입 — verdict.json 자리가 비어 있지 않은 디렉터리
  mkdirSync(join(w.work, 'verdict.json', 'x'), { recursive: true });
  const before = readFileSync(join(w.work, 'findings.json'), 'utf8');
  const rd = merge(w, '--force', '--valid', 'claude,codex');
  assert.equal(rd.code, 2);
  assert.match(rd.first, /^ERR .*verdict\.json/);
  assert.equal(readFileSync(join(w.work, 'findings.json'), 'utf8'), before);
});

test('CLI merge: KNOWN·NEEDS_ADAPTER · 첫 줄 형식 · snapshot.json 없음 ERR · 어댑터 필요 (1.4.0 AC③-8)', () => {
  const unk = runCli(['nope']);
  assert.match(unk.first, /merge/);
  const w = mkW({ claude: REV('claude') });
  assert.match(merge(w, '--valid', 'claude').first, /^MERGED reviewers=claude findings=0 joined=0 candidates=0 needsMain=0$/);
  const w2 = mkW({ claude: REV('claude') });
  rmSync(join(w2.work, 'snapshot.json'));
  assert.match(merge(w2, '--valid', 'claude').first, /^ERR .*snapshot\.json/);
  assert.match(runCli(['merge', '--work', w.work, '--valid', 'claude'], { MR_REVIEW_ADAPTER: '' }).first, /^ERR .*--adapter/);
});

test('merge: 한 검토자의 intent:[null] 은 그 모델만 invalid(스키마 불통과: intent[0]) — 정상 검토자로 단일 모델 병합을 끝낸다(TypeError 없음) (1.4.0 impl R2-2)', () => {
  const w = mkW({ claude: REV('claude', [RF()]), codex: REV('codex', [], { intent: [null] }) });
  const r = merge(w, '--valid', 'claude,codex');
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /^MERGED reviewers=claude /);
  assert.equal(line2(r, 'invalid'), 'invalid: codex(스키마 불통과: intent[0])');
  assert.doesNotMatch(r.err, /TypeError/);
});

test('merge 지문은 가린 뒤 정규화 — 제목·파일의 비밀값이 선언 문맥(=)을 잃은 채 findings.json 에 남지 않고 cleanup 사본에도 없다 · 순수 함수는 mask 를 받아 같은 순서로 (1.4.0 impl R3-1)', () => {
  const t = 'token=syntheticsecret123 로그 노출';
  const w = mkW({ claude: REV('claude', [RF({ title: t, file: 'src/password=filesecret77.java' })]), codex: REV('codex', [RF({ title: t, file: 'src/password=filesecret77.java' })]), full: true });
  const r = merge(w, '--valid', 'claude,codex');
  assert.equal(r.code, 0, r.out + r.err);
  const f = fj(w).findings[0];
  assert.equal(f.source, 'both');                                                                   // 가린 값끼리도 같은 지문으로 짝 지어진다
  assert.doesNotMatch(f.fingerprint, /syntheticsecret123|filesecret77/);
  assert.equal(runCli(['cleanup', '--adapter', w.adapter, '--work', w.work]).code, 0);
  for (const n of readdirSync(w.work)) assert.doesNotMatch(readFileSync(join(w.work, n), 'utf8'), /syntheticsecret123|filesecret77/, n);
  const mask = (v) => String(v).replace(/token=\S+/g, 'token=[masked]');
  const res = mergeReviews({ claude: REV('claude', [RF({ title: t })]), valid: ['claude'], check: {}, snapshot: SNAP, mask });
  assert.equal(res.findings.findings[0].fingerprint, 'src/A.java:tokenmasked로그노출');
  assert.equal(mergeReviews({ claude: REV('claude', [RF({ title: 'A b.' })]), valid: ['claude'], check: {}, snapshot: SNAP }).findings.findings[0].fingerprint, 'src/A.java:ab');   // mask 없으면 현행
});

test('merge stdout replaced: 옛 findings.json head 가 40자 SHA 가 아니면 잘라 찍지 않는다(절단 전 가림 우회 금지) (1.4.0 impl R3-1 전수 점검)', () => {
  const w = mkW({ claude: REV('claude', []) });
  writeFileSync(join(w.work, 'findings.json'), JSON.stringify({ head_sha: 'pw=abcdefghij' }));
  const r = merge(w, '--valid', 'claude');
  assert.equal(r.code, 0, r.out + r.err);
  assert.equal(line2(r, 'replaced'), 'replaced: findings.json(head -)');
  writeFileSync(join(w.work, 'findings.json'), JSON.stringify({ head_sha: 'c'.repeat(40) }));
  assert.equal(line2(merge(w, '--valid', 'claude'), 'replaced'), 'replaced: findings.json(head ccccccc)');
});

test('merge 쓰기는 링크를 따라가지 않는다 — findings.json 이 W 밖을 가리키는 심볼릭 링크면 ERR·대상 불변 · 하드 링크면 W 항목만 새 파일로 교체(공유 원본 불변) (1.4.0 impl R4-1)', () => {
  const w = mkW({ claude: REV('claude', [RF()]) });
  const outside = join(w.root, 'settings.json');
  const body = '{"keep":true}';
  writeFileSync(outside, body);
  symlinkSync(outside, join(w.work, 'findings.json'));
  const r = merge(w, '--valid', 'claude');
  assert.equal(r.code, 2);
  assert.match(r.first, /^ERR findings\.json 이 일반 파일이 아니다/);
  assert.equal(readFileSync(outside, 'utf8'), body);
  assert.ok(lstatSync(join(w.work, 'findings.json')).isSymbolicLink());
  rmSync(join(w.work, 'findings.json'));
  const shared = join(w.root, 'shared.json');
  const sbody = JSON.stringify({ head_sha: 'c'.repeat(40) });
  writeFileSync(shared, sbody);
  linkSync(shared, join(w.work, 'findings.json'));
  assert.equal(merge(w, '--valid', 'claude').code, 0);
  assert.equal(readFileSync(shared, 'utf8'), sbody);                                              // 하드 링크 원본 불변
  assert.equal(fj(w).head_sha, HEAD);
  assert.ok(!readdirSync(w.work).some((n) => n.endsWith('.writing')));                            // 임시 파일 잔존 없음
});
