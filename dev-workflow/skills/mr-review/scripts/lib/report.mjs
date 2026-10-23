// report.mjs — spec §5.5-4 판정 계산(결정적) · §5.7 리포트 렌더 · F5 비밀값 제거 · F7 정리 · SC-4 검토자 출력 검증.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { maskText, maskTextWithCounts, SECRET_MASK, SECRET_KEYS, knownShas } from './pack.mjs';   // 엔진 마스킹 규칙은 pack.mjs 가 정본(팩 B·리포트·cleanup 공유, R6-1) — 여기서 다시 정의하지 않는다
export { maskText, SECRET_MASK };

export class ReportError extends Error {}

export const VERDICTS = ['APPROVE', 'HOLD_EVIDENCE', 'CHANGES_REQUESTED', 'RETURN_TO_DESIGN'];
const TYPES = ['DEFECT', 'MISSING_EVIDENCE', 'DESIGN_DRIFT', 'FOLLOW_UP'];
const CONF = ['high', 'medium', 'low'];
const BLOCK_MAX_LINES = 40;
// 정리(cleanup) 때 남기는 JSON 의 문자열 값에 어댑터 마스킹 + 비밀값 제거(`maskText` = 어댑터 mask + SECRET_MASK, 40자 SHA 보존 — pack.mjs, R5-2·C1-1)를 적용한다(R3-9) — 키 이름은 건드리지 않는다(`"token": "FIXED"` 같은 값이 키워드 패턴에 걸리지 않게 값만 본다).
// 보존할 SHA 는 호출자가 넘긴 아는 SHA(`knownShas` — 스냅샷·MR 구조화 칸)만이다(8b FR1-2).
export function deepMask(v, maskRules, keepShas = []) {
  if (typeof v === 'string') return maskText(v, maskRules, keepShas);
  if (Array.isArray(v)) return v.map((x) => deepMask(x, maskRules, keepShas));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepMask(x, maskRules, keepShas)]));
  return v;
}

// 손상 JSON 은 파일 이름과 함께 도메인 오류로(stdout ERR 한 줄 — SC-6) — 메인(LLM)이 쓰는 findings.json 은 깨질 수 있다(impl SDD 이월 T06)
const readJson = (work, name) => {
  const p = path.join(work, name);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new ReportError(`${name} JSON 파싱 실패: ${e.message.slice(0, 160)}`); }
};
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

// ── SC-5 병합 발견 검증(impl SDD 이월 T06 우선 minor) ──────────────────────────────
// findings.json 은 메인(LLM)이 손으로 쓴다 — `blocking:"true"`(문자열)·오타 type 이 판정 집합에서 조용히 빠지면 차단 발견이 있는데도 APPROVE 가 된다.
// verdict 가 계산 전에 형식을 검사하고 어긋나면 ERR(fail-closed) — 판정 규칙은 바꾸지 않는다(D9).
export function validateFindings(fnd) {
  const errors = [];
  if (!fnd || typeof fnd !== 'object' || Array.isArray(fnd)) return ['객체가 아니다'];
  if (!/^[0-9a-f]{40}$/.test(String(fnd.head_sha || ''))) errors.push('head_sha 는 40자 SHA(snapshot.head_sha)');
  if (!Array.isArray(fnd.validReviewers) || fnd.validReviewers.some((r) => !['claude', 'codex'].includes(r))) errors.push('validReviewers 는 claude|codex 배열');
  if (!Array.isArray(fnd.findings)) { errors.push('findings 배열 필요'); return errors; }
  const ids = new Set();
  fnd.findings.forEach((f, i) => {
    if (!f || typeof f !== 'object') { errors.push(`findings[${i}] 객체 아님`); return; }
    if (!/^F\d+$/.test(String(f.id))) errors.push(`findings[${i}].id 는 F<n>`);
    else if (ids.has(f.id)) errors.push(`중복 id ${f.id}`);
    ids.add(f.id);
    if (!TYPES.includes(f.type)) errors.push(`${f.id ?? i}.type 은 ${TYPES.join('|')}`);
    if (typeof f.blocking !== 'boolean') errors.push(`${f.id ?? i}.blocking 은 boolean(true|false)`);
    if (f.unresolved != null && typeof f.unresolved !== 'boolean') errors.push(`${f.id ?? i}.unresolved 는 boolean`);
    if (!['yes', 'no', null, undefined].includes(f.fixableInDesign)) errors.push(`${f.id ?? i}.fixableInDesign 은 yes|no|null`);
    if (![null, undefined, 'confirmed', 'dismissed'].includes(f.resolution)) errors.push(`${f.id ?? i}.resolution 은 confirmed|dismissed|null`);
  });
  return errors;
}

// ── 배포본 불일치 요약(1.3.2 ⑪ — spec 2026-10-22 3.⑪ D40·D46) ─────────────────────
// 목록 전문은 부록 A 한 곳 — 본문(실행 블록·보완 문안·부록 D)은 종류별 건수 + 앞 SUMMARY_PATHS 개 경로 + 「외 n건」(종류·경로 = mismatches 등장 순).
// path 없는 종류는 이름만. 끝 ` · 전체 목록 부록 A` 는 괄호 꼴로 쓰지 않는다 — 재리뷰 파서 APPENDIX_D_RE(check.mjs)가 제목 뒤 ` (…) · 출처` 로 위치 칸을 찾는다
const SUMMARY_PATHS = 3;
export function mismatchSummary(deploy) {
  const kinds = new Map();
  for (const m of deploy?.mismatches || []) { if (!kinds.has(m.kind)) kinds.set(m.kind, []); if (m.path) kinds.get(m.kind).push(m.path); }
  const parts = [...kinds].map(([k, ps]) => (ps.length ? `${k} ${ps.length}건(${ps.slice(0, SUMMARY_PATHS).join(', ')}${ps.length > SUMMARY_PATHS ? ` 외 ${ps.length - SUMMARY_PATHS}건` : ''})` : k));
  if ([...kinds.values()].some((ps) => ps.length)) parts.push('전체 목록 부록 A');
  return parts.join(' · ');
}
// 컴파일 산출물 존재 대조 표시(1.3.2 ⑨ D38·D47) — 실행 블록 「2. 검증 상태」·부록 A(헤더에는 넣지 않는다)
const skippedNote = (deploy) => ((deploy?.zip?.bytes_skipped || []).length ? `바이트 대조 생략 ${deploy.zip.bytes_skipped.length}건(컴파일 산출물 — 존재만 확인)` : '');
// 마크다운 표 셀(1.3.3 ⑭ — spec 2026-10-23 3.⑭ D56) — 줄바꿈(`\r\n`·단독 `\r`·`\n`, R6-1)은 공백 하나로, 이스케이프 안 된 `|` 는 `\|` 로(이미 `\|` 면 그대로).
// 마스킹 순서(R3-2·R4-1) = 원문 fieldMask(renderReport) → 평탄화 → 재 fieldMask → 이 함수. renderReport 의 `tc` 가 그 순서로 부른다
const NL = /\r\n|\r|\n/g;
export const cell = (s) => String(s).replace(NL, ' ').replace(/(?<!\\)\|/g, '\\|');

// 부록 A zip 줄(1.3.3 ⑬ — spec 2026-10-23 3.⑬-7) — zip 1개면 지금 줄에 배치(근거)·접두, 여럿이면 합산 줄 + zip 마다 한 줄. zips 가 없는 1.3.2 이전 deploy.json(--resolve 재실행)은 지금 줄 그대로
const layoutNote = (z) => `배치 ${z.layout ?? '-'}(${z.layout_source ?? '-'}) · 접두 ${z.prefix || '없음'}`;
function zipLines(deploy) {
  const z = deploy.zip;
  const head = `zip ${z.attachment || '없음'}(주석 ${z.comment_sha ? s7(z.comment_sha) : '-'}`;
  const zips = deploy.zips;
  if (!Array.isArray(zips) || zips.length === 0) return `${head})`;
  if (zips.length === 1) return `${head} · ${layoutNote(z)})`;
  return [`zip ${zips.length}개 합산(배치 ${z.layout}(${z.layout_source}))`, ...zips.map((x, i) => `- zip#${i + 1} ${x.attachment}(주석 ${x.comment_sha ? s7(x.comment_sha) : '없음'} · ${layoutNote(x)})`)].join('\n');
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
  if (deploy?.applicable && deploy.result !== '일치') out.push({ id: 'M-deploy', kind: 'deploy', detail: `배포본 ${deploy.result}${mismatchSummary(deploy) ? ' — ' + mismatchSummary(deploy) : ''}` });
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
function executionBlock({ verdict, mr, snapshot, check, deploy, findings, pack, tc }) {
  const fnd = findings?.findings || [];
  const byId = Object.fromEntries(fnd.map((f) => [f.id, f]));
  const models = findings?.validReviewers?.length ? findings.validReviewers.join(', ') : '-';
  const head = [`리뷰 계약 ${verdict.contractPolicyId} · head ${snapshot.head_sha} · 추천 판정(초안) ${verdict.verdict}`, `사람 승인 상태: ${approvalLine(mr)}`, ''];
  const intent = findings?.intent || [];
  let rows = intent.map((i) => `| ${tc(i.criterion)} | ${tc(i.result)} | ${tc(i.location || '-')} (${tc(i.basis || '작성자 주장')}) |`);
  if (!rows.length) rows = ['| (검증 표 없음) | UNKNOWN | - |'];
  const s1h = ['1. 의도 대조표', '| 수용기준·MR 주장 | 결과 | 코드 위치 |', '|---|---|---|'];
  const s2 = ['2. 검증 상태',
    `- [판독] base..head diff·변경 파일 전문 — head ${s7(snapshot.head_sha)} (돈 모델: ${models}${findings?.crossChecked ? '' : ' · 교차 검토 없음'})`,
    deploy?.applicable ? `- [실행] 배포본 zip 대조(스킬 직접 수행): ${[deploy.result, mismatchSummary(deploy)].filter(Boolean).join(' — ')}${skippedNote(deploy) ? ` · ${skippedNote(deploy)}` : ''}` : '- 배포본: 비해당(운영 배포 대상 변경 없음)',
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
  if (deploy?.applicable && deploy.result !== '일치') items.push(`배포본 대조 결과 「${deploy.result}」${mismatchSummary(deploy) ? ' — ' + mismatchSummary(deploy) : ''}. 최신 head 기준으로 zip·삭제 목록을 다시 만들어 주세요.`);
  for (const l of check.baselineLinks || []) if (l.status === '미확보') items.push(`Baseline 원문을 받을 수 없습니다(${l.raw || l.kind}: ${l.reason}). 접근 가능한 링크로 바꿔 주세요.`);
  if (check.rebase?.need) items.push('대상 브랜치와 충돌·리베이스가 필요합니다(need_rebase). 리베이스 뒤 Base SHA·Review head SHA 를 갱신해 주세요.');
  if (check.reviewerMismatch) items.push('Human reviewer 줄이 MR 의 Reviewer 와 다릅니다 — 같은 GitLab username 으로 맞춰 주세요.');
  if ((snapshot?.unrecovered || []).length) items.push(`잘린 diff 를 복원하지 못한 파일 ${snapshot.unrecovered.length}건 — 리뷰어가 로컬 clone 으로 다시 돌립니다(작성자 조치 불필요).`);
  return items;
}

function checkTable(check, deploy, tc) {
  const rows = [];
  for (const l of check.contract?.lines || []) rows.push(`| 계약 · ${tc(l.name)} | ${tc(l.status)} |`);
  rows.push(`| 트랙 | ${tc(check.track)} |`);
  rows.push(`| 기준선 확인 댓글 | ${tc(`${check.baselineConfirm?.status}${check.baselineConfirm?.status === '낡음' ? `(본문 변경 ${check.baselineConfirm.changed_at})` : ''}`)} |`);
  rows.push(`| Baseline 유형 | ${tc(check.baselineType)} |`);
  rows.push(`| 변경 사유 ①② | ①${check.reason?.why ? '있음' : '없음'} ②${check.reason?.what ? '있음' : '없음'} (${tc(check.reason?.source)}) |`);
  rows.push(`| 변경 파일 속 문서(후보) | ${tc((check.baselineCandidateFiles || []).join(', ') || '없음')} |`);
  rows.push(`| 첨부 | ${tc((check.attachments || []).map((a) => `${a.kind}:${a.filename}`).join(', ') || '없음')}${check.attachmentClaimedButMissing ? ' · **첨부 누락**' : ''} |`);
  rows.push(`| 배포본 | ${check.deployExempt ? '제외 프로젝트' : check.deployRequired ? `필수(${tc(check.deployNote || '표기 없음')})` : '비해당'} → ${tc(deploy ? deploy.result : '-')} |`);
  rows.push(`| 리베이스 | ${check.rebase?.need ? '필요' : '불필요'} (${tc(check.rebase?.detailed_merge_status || '-')}) |`);
  rows.push(`| reviewer 불일치 | ${check.reviewerMismatch ? '예' : '아니오'} |`);
  rows.push(`| 이전 판정(신뢰) | ${tc((check.priorVerdicts || []).filter((v) => v.trusted).map((v) => `#${v.note_id} ${v.verdict}@${s7(v.sha)}`).join(', ') || '없음')} |`);
  rows.push(`| 무시한 댓글 | ${tc((check.ignoredComments || []).map((c) => `#${c.note_id}(${c.reason})`).join(', ') || '없음')} |`);
  return ['| 검사 | 판정값 |', '|---|---|', ...rows].join('\n');
}

// 필드 선마스킹(impl C1 N1 · R4-2 감사 이의) — 발견·판정의 문자열을 필드마다 먼저 가리고 비밀값 키 뒤 `:`·`=` 구분자를 지운다.
// 문서 전체 마스킹(아래 F5)은 따옴표 없는 비밀값을 줄 끝까지 가리므로(R4-2), 구분자가 남으면 같은 줄에 조립한 파일:줄·출처·확신까지 지운다(§5.7 위치 보존).
// 빈 따옴표 값(`password = ""`·`""[masked:…]`)도 구분자를 지운다(impl C2 C1-1 잔존 — 따옴표 뒤 조각 규칙이 같은 줄 뒤를 가린다).
const KEY_SEP = new RegExp(`(${SECRET_KEYS}["'\`]?)[ \t]*[:=][ \t]*(?=["'\`]?(?:\\[masked:|["'\`]))`, 'gi');
// 명령줄 옵션(`--password [masked:secret]`)도 같은 이유로 옵션과 표시 사이 공백을 지운다(8b FC3-1 · 대장 48 감사 이의 재판정) — 옵션 값 규칙은 줄 끝까지 가리므로 공백이 남으면 같은 줄의 파일:줄·출처·확신을 지운다.
const CLI_SEP = new RegExp(`(?<![\\w-])(--?${SECRET_KEYS})[ \t]+(?=\\[masked:)`, 'gi');
// 값 없이 비밀값 키로 끝나는 필드(`--password`·`password =` 등)는 뒤에 조립한 위치를 값으로 먹는다(릴리스 전 확인 PR1 · FC3-1 잔존 · 대장 51 감사 이의 재판정) —
// 꼴을 따지지 않고 「뒤에 붙인 글이 남는가」를 시험해, 먹으면 필드 끝에 가림 표시를 붙여 봉인한다(대가 = 값 없는 제목에도 표시가 붙음).
const TAIL_PROBE = ' (-:-)';
const sepFold = (s) => s.replace(KEY_SEP, '$1 ').replace(CLI_SEP, '$1');
function fieldMask(v, maskRules, keepShas) {
  if (typeof v === 'string') {
    const m = sepFold(maskText(v, maskRules, keepShas));
    return maskText(m + TAIL_PROBE, maskRules, keepShas).endsWith(TAIL_PROBE) ? m : sepFold(`${m.replace(/[ \t]+$/, '')} [masked:secret]`);
  }
  if (Array.isArray(v)) return v.map((x) => fieldMask(x, maskRules, keepShas));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fieldMask(x, maskRules, keepShas)]));
  return v;
}

export function renderReport({ adapter, work, early = false }) {
  const mr = readJson(work, 'mr.json');
  const snapshot = readJson(work, 'snapshot.json');
  let check = readJson(work, 'check.json');
  if (!mr || !snapshot || !check) throw new ReportError('mr.json·snapshot.json·check.json 이 필요하다(collect·check 먼저)');
  const keep = knownShas({ mr, snapshot });
  let deploy = readJson(work, 'deploy.json');
  let pack = readJson(work, 'pack.json');
  let findings = early ? null : readJson(work, 'findings.json');
  let verdict = early ? null : readJson(work, 'verdict.json');
  // 판정 입력의 head 일치 검증 — 같은 work 에 남은 이전 실행의 verdict.json·findings.json 을 현재 head 의 판정으로 쓰지 않는다(F6). 비-early 인데 verdict 가 없으면 리뷰 실패로 렌더한다(판정 블록 없음).
  const failed = (reason) => ({ status: 'review-failed', verdict: null, reasons: [reason], unresolved: [], branches: {}, defects: [], evidence: [], machineEvidence: [], contractPolicyId: check.contract?.policyId || adapter.policy.judgeId, head_sha: snapshot.head_sha });
  if (!early) {
    if (!verdict) verdict = failed('verdict.json 없음 — verdict 를 실행하지 않았다(검토 결과 0개 경로에서도 verdict 를 실행한다)');
    else if (verdict.head_sha !== snapshot.head_sha) verdict = failed(`verdict.json 의 head ${s7(verdict.head_sha)} ≠ 스냅샷 head ${s7(snapshot.head_sha)} — 이전 실행의 판정은 쓰지 않는다(verdict 를 다시 실행)`);
    else if (findings?.head_sha && findings.head_sha !== snapshot.head_sha) verdict = failed(`findings.json 의 head ${s7(findings.head_sha)} ≠ 스냅샷 head ${s7(snapshot.head_sha)} — 이전 실행의 검토 결과는 쓰지 않는다`);
  }
  findings = fieldMask(findings, adapter.mask, keep);
  verdict = fieldMask(verdict, adapter.mask, keep);
  mr.title = fieldMask(mr.title, adapter.mask, keep);
  // 리포트 재료는 전부 필드 단위로 먼저 가린다(8b FR2-3 FC1 재판정) — 잔존 필드는 통째로 `[masked:unmaskable]`(maskText). 조립본 전체 검사는 아래에서 한 번 더.
  mr.web_url = fieldMask(mr.web_url, adapter.mask, keep);
  if (mr.project) mr.project.name = fieldMask(mr.project.name, adapter.mask, keep);
  check = fieldMask(check, adapter.mask, keep);
  deploy = fieldMask(deploy, adapter.mask, keep);
  pack = fieldMask(pack, adapter.mask, keep);
  // 표 셀 값(⑭ — R3-2·R4-1): 위 원문 마스킹 뒤 줄바꿈을 펴고, 편 값이 달라졌으면 다시 가린 다음 `cell()` 로 `|` 를 처리한다(줄로 나뉘어 있던 `--password⏎x` 가 펴져 `--password x` 가 되어도 여기서 가려진다)
  const tc = (v) => { const raw = String(v); const flat = raw.replace(NL, ' '); return cell(flat === raw ? raw : fieldMask(flat, adapter.mask, keep)); };
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
  if (mr.state === 'merged' || mr.state === 'closed') header.push(`- **머지 뒤 리뷰** — MR state=${mr.state}. 작성자 보완 요청은 이 MR이 아니라 후속 MR로`);   // 1.3.1 D29 — 표시만(판정·절 순서 불변)
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
    parts.push('```text', executionBlock({ verdict, mr, snapshot, check, deploy, findings, pack, tc }), '```');
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
  parts.push('## 부록 A — 작성 규칙 검사표 · 배포본 대조', '', checkTable(check, deploy, tc), '');
  if (deploy?.applicable) parts.push(`기대 배포 목록 ${deploy.expected.deploy.length}건 · 삭제 목록 ${deploy.expected.deleted.length}건 · ${zipLines(deploy)}${deploy.mismatches.length ? '\n' + deploy.mismatches.map((m) => `- ${m.kind}${m.path ? ` ${m.path}` : ''}: ${m.detail}`).join('\n') : ''}${skippedNote(deploy) ? `\n${skippedNote(deploy)}:\n${deploy.zip.bytes_skipped.map((p) => `- ${p}`).join('\n')}` : ''}`, '');
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
      r = fieldMask(r, adapter.mask, keep);
      if (!(findings?.validReviewers || []).includes(name) || !Array.isArray(r?.findings)) { parts.push(`(무효 결과 — 스키마 검증 실패 또는 유효 검토자 아님: findings=${Array.isArray(r?.findings) ? `${r.findings.length}건` : typeof r?.findings})`, ''); continue; }
      // §5.7 원본 발견 보존 — 근거·실패 시나리오·설계 내 수정 가능 여부·깨진 전제까지(마스킹은 아래 전체 적용). 필드마다 줄을 나눈다(impl R4-2 — 따옴표 없는 비밀값은 줄 끝까지 가려지므로 근거의 `password: …` 가 같은 줄 시나리오·권고까지 지우지 않게)
      parts.push(...(r.findings.flatMap((f) => [`- [${f?.lens}] ${f?.type} — ${f?.title} (${f?.file || '-'}:${f?.line_start || '-'}) · 확신 ${f?.confidence}`, `  - 근거: ${f?.evidence || '-'}`, `  - 시나리오: ${f?.scenario || '-'}`, `  - 설계 내 수정: ${f?.fixableInDesign || '-'}${f?.fixableInDesign === 'no' ? ` · 깨진 전제: ${f?.brokenPremise || '-'}` : ''}`, `  - 권고: ${f?.recommendation || ''}`])), r.findings.length ? '' : '(발견 없음)', '');
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
  // 조립본에 잔존이 남으면(재료 밖 문구가 비밀값 꼴을 만든 경우 등) 리포트를 쓰지 않는다 — 줄·필드를 지워 탐지 근거만 없애는 대신 멈춘다(8b FR2-3, fail-closed)
  const fin = maskTextWithCounts(text, adapter.mask, keep);
  if (fin.residual.length) throw new ReportError(`리포트 조립본에 마스킹 잔존(${fin.residual.map((r) => r.name).join(', ')}) — 리포트를 쓰지 않는다`);
  return fin.text;
}

// ── 정리(F7·F5) ───────────────────────────────────────────────────────────
// 산출물 수명주기(R3-9): 원문(워크트리·zip·blobs·codex.*·pack-a/b.md·baseline/)은 삭제, `--resolve`·재리뷰·re-render 에 필요한 JSON(mr·check·deploy·review-*·findings·verdict)은
// 문자열 값에 어댑터 마스킹 + 비밀값 제거를 적용한 사본으로 보존한다. 리포트는 저장 시 이미 마스킹됐다.
// deploy.json(zip 파일명·주석·API 오류 문자열)·verdict.json(machineEvidence 에 복사된 미확보 링크 raw·reason 등)에도 MR 원문이 흘러든다(R4-1) — 「원문 없음」으로 가정하지 않고 같은 마스킹을 건다.
// snapshot.json·pack.json 은 경로·SHA·카운트·패턴 이름만 담아 제외한다.
// 허용 목록(1.3.1 ⑤ — spec 2026-10-22 3.⑤): 위 처리 뒤 `W` 최상위에는 아래 9종(일반 파일)만 남긴다 — 검토자·메인이 임의 이름으로 만든 원문(`zipx/`·`claude.prompt` 등)도 지운다.
// 지우기 전 표지(D26): `snapshot.json` 이 우리 형식으로 파싱될 때만 우리 작업 디렉터리로 본다 — 아니면 아무것도 지우지 않는다(엉뚱한 디렉터리를 비우는 비가역 사고 방지).
const KEEP = new Set(['snapshot.json', 'pack.json', 'mr.json', 'check.json', 'deploy.json', 'review-claude.json', 'review-codex.json', 'findings.json', 'verdict.json']);
// 표지 ERR 에 적는 W 항목 목록 — 「(없음)」은 W 가 없거나 실제로 비었을 때만(SKILL §0 이 정상 종료로 읽는다, D33). 권한 등 조회 실패는 그 사실을 적는다(R3-1)
// 항목 이름은 임의 문자열이라 출력 전에 가린다(어댑터 mask + 비밀값, R5-1) — 세션 로그에 남는다
const maskNames = (names, adapter) => names.map((n) => maskText(n, adapter?.mask || []));
const topEntries = (work, adapter) => {
  let list;
  try { list = fs.readdirSync(work, { withFileTypes: true }); } catch (e) { return e?.code === 'ENOENT' ? '(없음)' : `항목 목록 조회 실패(${e?.code || e?.message})`; }
  return maskNames(list.map((d) => d.name + (d.isDirectory() ? '/' : '')).sort(), adapter).join(', ') || '(없음)';
};
function markerProblem(work) {
  const p = path.join(work, 'snapshot.json');
  if (!fs.existsSync(p)) return 'snapshot.json 없음';
  let s;
  try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return 'snapshot.json 형식 불일치'; }
  const ok = s && typeof s === 'object' && (s.mode === 'worktree' || s.mode === 'diff-only') && /^[0-9a-f]{40}$/.test(String(s.head_sha)) && typeof s.fetched_at === 'string';
  return ok ? null : 'snapshot.json 형식 불일치';
}
const tryRm = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); return true; } catch { return false; } };   // 링크는 링크만 지운다
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
  const problem = markerProblem(work);
  if (problem) throw new ReportError(`${problem} — mr-review 작업 디렉터리로 확인되지 않아 정리하지 않는다: ${topEntries(work, adapter)}`);
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
  let mrRaw = null;
  try { mrRaw = JSON.parse(fs.readFileSync(path.join(work, 'mr.json'), 'utf8')); } catch { /* 없거나 손상 — 스냅샷 SHA 만 보존 */ }
  const keep = knownShas({ mr: mrRaw, snapshot });   // 보존할 SHA = 구조화 칸의 실제 커밋만(8b FR1-2)
  let masked = 0;
  const failed = [];   // 마스킹 못 해 원문을 지운 것
  const stuck = [];    // 지우지 못해 W 에 남은 것 — 원문일 수 있다. 보고는 실제 삭제 결과대로 한다(R6-1)
  const dropRaw = (f, p, why) => { if (tryRm(p)) { if (why) failed.push(`${f}(${why})`); return true; } stuck.push(`${f}(${why || '파싱 불가'} — 원문 잔존)`); return false; };
  for (const f of MASKED_JSON) {
    const p = path.join(work, f);
    if (!fs.lstatSync(p, { throwIfNoEntry: false })?.isFile()) continue;   // 없거나 일반 파일이 아니다(심볼릭 링크·디렉터리) — 따라가 읽거나 쓰지 않는다. 아래 허용 목록 정리가 링크만 지운다(1.3.1 R1-1)
    let obj;
    try { obj = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { if (dropRaw(f, p, null)) raw += 1; continue; }   // 파싱 불가 JSON 은 마스킹할 수 없다 — 원문으로 남기지 않고 지운다
    let out;
    try { out = JSON.stringify(deepMask(obj, adapter?.mask || [], keep), null, 2); } catch (e) { dropRaw(f, p, e.message); continue; }   // 마스킹 실패도 같다 — 지우고 나머지를 끝까지 정리한 뒤 알린다(impl C3)
    // 기존 파일 실체(inode)는 고치지 않는다 — 새 파일에 쓰고 이름을 바꿔 교체한다. 하드 링크로 W 밖 원본과 실체를 공유해도 원본은 그대로다(R4-1), 검사 뒤 링크로 바뀌어도 따라가지 않는다(R1-1)
    const tmpFile = path.join(work, `.${f}.${randomBytes(6).toString('hex')}.masking`);   // 매번 새 이름 — W 에 이미 있는 항목과 부딪히지 않는다(R5-2)
    try {
      fs.writeFileSync(tmpFile, out, { flag: 'wx' });
      fs.renameSync(tmpFile, p);
    } catch (e) { tryRm(tmpFile); dropRaw(f, p, e.code || e.message); continue; }   // 교체 실패도 원문을 남기지 않으려 지우고, 나머지 정리를 계속한다
    masked += 1;
  }
  // 허용 9종 밖은 이름을 몰라도 지운다(숨김 파일 포함). 심볼릭 링크는 링크만 — rmSync 는 링크 대상을 따라가지 않는다
  // 지울 수 없는 항목(권한 등)은 모아 두고 나머지를 끝까지 지운 뒤 ERR 로 남은 항목을 알린다 — 항목 하나가 정리 전체를 멈추지 않게(R5-2 잔존)
  const extra = [];
  for (const d of fs.readdirSync(work, { withFileTypes: true })) {
    if (KEEP.has(d.name) && d.isFile()) continue;
    const name = d.name + (d.isDirectory() ? '/' : '');
    if (tryRm(path.join(work, d.name))) extra.push(name); else stuck.push(name);
  }
  const notes = [];
  if (failed.length) notes.push(`마스킹 실패로 원문을 남기지 않고 지웠다: ${failed.join(', ')}`);
  if (stuck.length) notes.push(`정리하지 못한 항목: ${maskNames(stuck.sort(), adapter).join(', ')}`);
  if (notes.length) throw new ReportError(`${notes.join(' · ')} — 나머지 정리는 끝냈다`);
  return { worktree, zip, raw, masked, extra: maskNames(extra.sort(), adapter) };
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
  const ferr = validateFindings(findings);
  if (ferr.length) throw new ReportError(`findings.json 검증 실패: ${ferr.slice(0, 5).join('; ')}${ferr.length > 5 ? ` 외 ${ferr.length - 5}건` : ''}`);
  const resolves = {};
  for (const r of args.resolve || []) { const m = String(r).match(/^([^=]+)=(.+)$/); if (!m) throw new ReportError(`--resolve 형식: <id>=confirmed|dismissed|confirmed:fixable|confirmed:design (${r})`); resolves[m[1]] = m[2]; }
  for (const id of Object.keys(resolves)) if (!findings.findings.some((f) => f.id === id)) throw new ReportError(`--resolve ${id}: findings.json 에 없는 id — 리뷰어 결정이 조용히 버려지지 않게 멈춘다`);
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
  // 첫 줄만 판독 대상(SKILL §8) — 지운 추가 항목 이름은 둘째 줄(D34)
  return `CLEANED worktree=${r.worktree} zip=${r.zip} raw=${r.raw} masked=${r.masked} extra=${r.extra.length}${r.extra.length ? `\nextra: ${r.extra.join(', ')}` : ''}`;
}
