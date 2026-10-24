// merge.mjs — 1.4.0 ③(spec 2026-10-24 3.③ · 3.①-6 · 3.②-4 — SC-6 merge · SC-5 findings.json). 두 검토자 결과를 결정적으로 합쳐 findings.json 초안을 쓴다.
// 기계가 할 수 있는 단계(지문·사안 키 짝 짓기 · 센 유형 · 높은 확신 · intent row 병합 · decisions 병합 · 골격·reviewerStats)만 하고,
// 사람 판단 칸은 needsMain 으로 남긴다(메인이 decided 를 채우기 전 verdict 는 ERR). 같은 입력 = 같은 바이트(입력 파일 순서·실행 환경 무관).
import fs from 'node:fs';
import path from 'node:path';
import { validateReview, makeLineMask, writeWorkFile } from './report.mjs';
import { knownShas } from './pack.mjs';

export class MergeError extends Error {}

const MODELS = ['claude', 'codex'];
const STRENGTH = ['DEFECT', 'DESIGN_DRIFT', 'MISSING_EVIDENCE', 'FOLLOW_UP'];   // 앞이 센 쪽
const DESIGN = ['DEFECT', 'DESIGN_DRIFT'];
const BLOCKING_TYPES = ['DEFECT', 'MISSING_EVIDENCE', 'DESIGN_DRIFT'];
const CONF_RANK = { high: 0, medium: 1, low: 2 };
// needsMain 사유(고정 문구 — 이 순서가 같은 발견 안의 순서다)
export const WHY = {
  driftBlocking: 'DESIGN_DRIFT 차단 승격 판단',
  soloLow: '단독 출처 낮은 확신 차단',
  soloFixable: '단독 출처 설계 내 수정 가능 판단',
  fixableConflict: '설계 내 수정 가능 상충',
  typeConflict: '유형 상충 — 한쪽 비차단',
  decisionGap: '결정 어김 대응 발견 없음',
  relevance: '후보 문서 관련성 상충',
};
const WHY_ORDER = Object.values(WHY);

const norm = (t) => String(t ?? '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
// 지문 = 가린 뒤 정규화(impl R3-1 — spec 3.①-1 R1-1 순서와 같은 원칙): 정규화가 `token=` 같은 선언 문맥을 지우면 뒤의 가림(cleanup deepMask)이 비밀값을 못 알아본다
const fingerprint = (f, mask) => `${f.file == null ? '' : mask(f.file)}:${norm(mask(f.title ?? ''))}`;
const uniq = (xs) => [...new Set(xs)];
const blockingOf = (type) => (type === 'DESIGN_DRIFT' ? null : type !== 'FOLLOW_UP');

// 검토자별 허용 결정 id(R6-2): Claude = check 의 결정 전체 · Codex = 팩 B 에 실린 기준선(kind baseline · inPackB)의 결정만(D4·D14)
function allowedIds(check, pack) {
  const all = (check?.baselineDecisions || []).map((d) => d.id);
  const inB = new Set((pack?.sources || []).filter((s) => s.kind === 'baseline' && s.inPackB === true).map((s) => s.ref));
  return { claude: new Set(all), codex: new Set((check?.baselineDecisions || []).filter((d) => inB.has(`baseline/${d.baseline}.md`)).map((d) => d.id)) };
}

// 순수 함수(결정적). claude·codex = 스키마를 통과한 검토자 출력(없으면 null). valid = 실행 유효 검토자 목록(메인 판정 — §5).
// rows = --rows n(선택) · same = [[i, j]](1부터) · codexStats = W/codex-stats.json 값(선택)
// mask = 지문용 문자열 가림(cmdMerge 는 출력 입구와 같은 mline — 없으면 그대로)
export function mergeReviews({ claude = null, codex = null, check = {}, pack = null, snapshot = {}, codexStats = null, rows = null, same = [], valid = [], mask = (v) => String(v) }) {
  const rev = { claude, codex };
  const live = MODELS.filter((m) => valid.includes(m) && rev[m]);
  const allowed = allowedIds(check, pack);
  const notes = { candidates: [], decisionsDropped: {}, decisionsMissing: {}, rowsDropped: {}, rowsMissing: [], criterionMissing: [] };
  const drop = (m, id) => { (notes.decisionsDropped[m] ||= []); if (!notes.decisionsDropped[m].includes(id)) notes.decisionsDropped[m].push(id); };

  // 단위 = 각 검토자의 finding(배열 순). 사안 키는 허용 id 로 걸러 낸 뒤의 값(R5-2·R6-2), intentRows 는 --rows 범위 안만
  const items = {};
  for (const m of MODELS) {
    const decs = live.includes(m) ? rev[m].decisions || [] : [];
    for (const d of decs) if (!allowed[m].has(d.id)) drop(m, d.id);
    items[m] = (live.includes(m) ? rev[m].findings || [] : []).map((f, i) => {
      const ids = (Array.isArray(f.decisionIds) ? f.decisionIds : []).filter((id) => { if (allowed[m].has(id)) return true; drop(m, id); return false; });
      const rws = (Array.isArray(f.intentRows) ? f.intentRows : []).filter((r) => rows == null || (r >= 1 && r <= rows));
      return { m, n: i + 1, f, ids: uniq(ids), rws: uniq(rws), fp: fingerprint(f, mask) };
    });
  }

  // 짝 짓기(D136·D137): 1:1 · 패스 0 --same → 1 지문 → 2 decisionIds → 3 intentRows + 같은 file. 패스 안은 claude 순 → 아직 짝 없는 codex 첫 것
  const pairOf = new Map();   // claude item → { x: codex item, by }
  const usedX = new Set();
  for (const [i, j] of same) {
    const c = items.claude[i - 1];
    const x = items.codex[j - 1];
    if (!c || !x) throw new MergeError(`--same claude:${i}=codex:${j}: 범위 밖 번호(claude 1~${items.claude.length} · codex 1~${items.codex.length})`);
    if (pairOf.has(c) || usedX.has(x)) throw new MergeError(`--same claude:${i}=codex:${j}: 이미 짝 지은 발견`);
    pairOf.set(c, { x, by: 'same' }); usedX.add(x);
  }
  const inter = (a, b) => a.filter((v) => b.includes(v));
  const passes = [
    ['fingerprint', (c, x) => c.fp === x.fp],
    ['decisionIds', (c, x) => inter(c.ids, x.ids).length > 0],
    ['intentRows', (c, x) => inter(c.rws, x.rws).length > 0 && c.f.file != null && c.f.file === x.f.file],
  ];
  for (const [by, ok] of passes) {
    for (const c of items.claude) {
      if (pairOf.has(c)) continue;
      const x = items.codex.find((y) => !usedX.has(y) && ok(c, y));
      if (x) { pairOf.set(c, { x, by }); usedX.add(x); }
    }
  }

  // 발견 조립 — 순서 = claude 배열 순(짝이면 합친 것) → codex 단독 배열 순
  const findings = [];
  const meta = [];   // needsMain 계산용(같은 순서)
  const build = (parts, by) => {
    const rep = parts.reduce((a, b) => (STRENGTH.indexOf(b.f.type) < STRENGTH.indexOf(a.f.type) ? b : a));   // 같으면 앞(claude)
    const other = parts.find((p) => p !== rep);
    const type = rep.f.type;
    const conf = parts.map((p) => p.f.confidence).sort((a, b) => (CONF_RANK[a] ?? 9) - (CONF_RANK[b] ?? 9))[0];
    // fixableInDesign(D141): 주장으로 세는 쪽 = 그 발견을 설계 유형(DEFECT·DESIGN_DRIFT)으로 낸 검토자뿐
    let fixable = rep.f.fixableInDesign;
    let claims = null;
    let premise = rep.f.brokenPremise ?? '';
    if (DESIGN.includes(type)) {
      const claimers = parts.filter((p) => DESIGN.includes(p.f.type));
      const vals = uniq(claimers.map((p) => p.f.fixableInDesign));
      if (claimers.length === 2 && vals.length === 1) fixable = vals[0];
      else {
        fixable = null;
        claims = Object.fromEntries(claimers.map((p) => [p.m, p.f.fixableInDesign]));
        premise = claimers.find((p) => p.f.fixableInDesign === 'no')?.f.brokenPremise ?? '';
      }
    }
    const f = {
      id: `F${findings.length + 1}`, fingerprint: rep.fp, source: parts.length === 2 ? 'both' : rep.m, lens: rep.f.lens, type, blocking: blockingOf(type),
      title: rep.f.title, file: rep.f.file ?? null, line_start: rep.f.line_start ?? 0, line_end: rep.f.line_end ?? 0, evidence: rep.f.evidence ?? '', scenario: rep.f.scenario ?? '', confidence: conf, recommendation: rep.f.recommendation ?? '',
      fixableInDesign: fixable, fixableInDesignClaims: claims, brokenPremise: premise, unresolved: false, resolution: null, dismissReason: '',
      decisionIds: uniq(parts.flatMap((p) => p.ids)).sort(), intentRows: uniq(parts.flatMap((p) => p.rws)).sort((a, b) => a - b),
      ...(other ? { alt: { [other.m]: { type: other.f.type, title: other.f.title, file: other.f.file ?? null, line_start: other.f.line_start ?? 0, evidence: other.f.evidence ?? '' } }, joinedBy: by } : {}),
    };
    findings.push(f);
    meta.push({ f, parts });
  };
  for (const c of items.claude) { const p = pairOf.get(c); build(p ? [c, p.x] : [c], p?.by); }
  for (const x of items.codex) if (!usedX.has(x)) build([x]);

  // 병합 후보(D138): 합쳐지지 않은 claude·codex 쌍 — 같은 파일 · 또는 행이 겹치는데 파일이 다름
  const idOf = new Map(meta.map(({ f, parts }) => [parts[0], f.id]));
  const mergeCandidates = [];
  for (const c of items.claude.filter((y) => !pairOf.has(y))) {
    for (const x of items.codex.filter((y) => !usedX.has(y))) {
      let why = null;
      let label = null;
      if (c.f.file != null && c.f.file === x.f.file) { why = '같은 파일'; label = `같은 파일 ${c.f.file}`; }
      else if (inter(c.rws, x.rws).length) { why = `같은 행 ${inter(c.rws, x.rws).join(', ')}`; label = why; }
      if (!why) continue;
      mergeCandidates.push({ pair: [idOf.get(c), idOf.get(x)], why });
      notes.candidates.push(`claude:${c.n}~codex:${x.n}(${label})`);
    }
  }

  // decisions(3.①-6): id 기준 — 같으면 그 값 · 다르면 UNKNOWN + claims · 한쪽만이면 그 값 + source · 둘 다 없으면 미응답(D132)
  const answers = {};
  for (const m of live) { answers[m] = new Map(); for (const d of rev[m].decisions || []) if (allowed[m].has(d.id) && !answers[m].has(d.id)) answers[m].set(d.id, d); }
  const decisions = [];
  for (const { id } of check?.baselineDecisions || []) {
    const got = live.filter((m) => answers[m].has(id)).map((m) => [m, answers[m].get(id)]);
    for (const m of live) if (allowed[m].has(id) && !answers[m].has(id)) notes.decisionsMissing[m] = (notes.decisionsMissing[m] || 0) + 1;
    if (!got.length) { decisions.push({ id, result: '미응답' }); continue; }
    const pick = got.find(([, d]) => d.result === 'VIOLATED') ?? got[0];   // location·basis 는 VIOLATED 쪽, 같으면 claude
    const results = uniq(got.map(([, d]) => d.result));
    decisions.push({
      id, result: results.length === 1 ? results[0] : 'UNKNOWN', ...(results.length > 1 ? { claims: Object.fromEntries(got.map(([m, d]) => [m, d.result])) } : {}),
      location: pick[1].location ?? null, basis: pick[1].basis ?? null, ...(got.length === 1 ? { source: got[0][0] } : {}),
    });
  }
  // decisionGaps(D133): 어느 모델이든 VIOLATED(상충 포함)인데 그 id 를 decisionIds 에 가진 DEFECT·DESIGN_DRIFT 발견이 없음(blocking 무관)
  const covered = new Set(findings.filter((f) => DESIGN.includes(f.type)).flatMap((f) => f.decisionIds));
  const decisionGaps = decisions.filter((d) => (d.result === 'VIOLATED' || Object.values(d.claims || {}).includes('VIOLATED')) && !covered.has(d.id)).map((d) => d.id);

  // intent(§6-5 코드화 — D41 row 병합 · criterion = 검토자 값, D122·D143)
  const rowMaps = {};
  for (const m of live) {
    rowMaps[m] = new Map();
    let missing = false;
    (rev[m].intent || []).forEach((it, i) => {
      let r = it?.row;
      if (!(Number.isSafeInteger(r) && r >= 1)) { r = i + 1; missing = true; }
      if ((rows != null && r > rows) || rowMaps[m].has(r)) { (notes.rowsDropped[m] ||= []).push(r); return; }
      rowMaps[m].set(r, it);
    });
    if (missing) notes.rowsMissing.push(m);
  }
  const allRows = uniq(live.flatMap((m) => [...rowMaps[m].keys()])).sort((a, b) => a - b);
  const filled = (v) => typeof v === 'string' && v.trim() !== '';
  const intent = allRows.map((r) => {
    const got = live.filter((m) => rowMaps[m].has(r)).map((m) => rowMaps[m].get(r));
    const code = got.find((it) => it.basis === '코드로 확인');
    const crit = got.map((it) => it.criterion).find(filled);
    if (!crit) notes.criterionMissing.push(r);
    return { row: r, criterion: crit ?? `(행 ${r} — criterion 없음)`, result: uniq(got.map((it) => it.result)).length === 1 ? got[0].result : 'UNKNOWN', location: (code ?? got[0]).location ?? '-', basis: code ? '코드로 확인' : got[0].basis ?? '작성자 주장' };
  });

  // 후보 문서 관련성(§6-4) — 유효 결과 전부 같으면 그 값, 상충이면 null + needsMain
  const rel = uniq(live.map((m) => rev[m].baselineCandidateRelevant));
  const relevance = rel.length === 1 ? { baselineCandidateRelevant: rel[0], baselineCandidateReason: live.length > 1 ? '유효 결과 전부 일치' : '단일 모델 값' } : { baselineCandidateRelevant: null, baselineCandidateReason: '' };

  // needsMain — 발견 id 순 → 같은 발견 안은 사유 순 → 발견 밖(decisions:… id 순 → baselineCandidateRelevant)
  const needsMain = [];
  for (const { f, parts } of meta) {
    const whys = [];
    if (f.type === 'DESIGN_DRIFT') whys.push(WHY.driftBlocking);
    if (parts.length === 1 && BLOCKING_TYPES.includes(f.type) && (f.confidence === 'low' || f.confidence === 'medium')) whys.push(WHY.soloLow);
    if (f.fixableInDesignClaims && Object.keys(f.fixableInDesignClaims).length === 1) whys.push(WHY.soloFixable);
    if (f.fixableInDesignClaims && Object.keys(f.fixableInDesignClaims).length === 2) whys.push(WHY.fixableConflict);
    if (parts.length === 2 && parts.some((p) => p.f.type === 'FOLLOW_UP') && parts.some((p) => BLOCKING_TYPES.includes(p.f.type))) whys.push(WHY.typeConflict);
    for (const why of whys.sort((a, b) => WHY_ORDER.indexOf(a) - WHY_ORDER.indexOf(b))) needsMain.push({ id: f.id, why, decided: null });
  }
  for (const id of decisionGaps) needsMain.push({ id: `decisions:${id}`, why: WHY.decisionGap, decided: null });
  if (live.length && relevance.baselineCandidateRelevant === null) needsMain.push({ id: 'baselineCandidateRelevant', why: WHY.relevance, decided: null });

  const out = live.length
    ? { head_sha: snapshot?.head_sha ?? null, validReviewers: live, crossChecked: live.length === 2, ...relevance, findings, intent, decisions, decisionGaps, needsMain, mergeCandidates, outsideWorktreePaths: [] }
    : { head_sha: snapshot?.head_sha ?? null, validReviewers: [], crossChecked: false, findings: [], intent: [], decisions: [], decisionGaps: [], needsMain: [], mergeCandidates: [], outsideWorktreePaths: [] };   // 「유효 0개」 골격 — 그래도 verdict 를 돌린다(§6)
  if (codexStats) out.reviewerStats = { codex: codexStats };
  const joined = meta.filter((x) => x.parts.length === 2).length;
  return { findings: out, notes, counts: { reviewers: live.join(',') || '-', findings: out.findings.length, joined, candidates: mergeCandidates.length, needsMain: needsMain.length } };
}

// 검토자 결과 읽기 — 실패 이유는 고정 범주만(R6-1: 파서·검증기 오류 문구는 키 문맥 없이 비밀값 조각을 인용할 수 있다)
function loadReview(work, m, head) {
  const p = path.join(work, `review-${m}.json`);
  if (!fs.existsSync(p)) return { why: '파일 없음' };
  let obj;
  try { obj = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { why: 'JSON 아님' }; }
  if (obj && typeof obj === 'object' && typeof obj.head_sha === 'string' && obj.head_sha !== head) return { why: 'head 다름' };
  if (obj && typeof obj === 'object' && MODELS.includes(obj.reviewer) && obj.reviewer !== m) return { why: '검토자 이름 다름' };
  const v = validateReview(obj, { head, reviewer: m });
  if (!v.ok) {
    const fieldPath = (e) => { const t = String(e).split(' ')[0]; return /^[A-Za-z_]\w*(?:\[\d+\])?(?:\.[A-Za-z_]\w*)*$/.test(t) ? t : '?'; };
    return { why: `스키마 불통과: ${fieldPath(v.errors[0])}${v.errors.length > 1 ? ` 외 ${v.errors.length - 1}건` : ''}` };
  }
  return { obj };
}

const readOpt = (work, name) => {
  const p = path.join(work, name);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { throw new MergeError(`${name} JSON 파싱 실패`); }
};

export async function cmdMerge(args, ctx) {
  const work = ctx.work;
  let mr = null;
  try { mr = readOpt(work, 'mr.json'); } catch { mr = null; }
  const snapshot = (() => { try { return readOpt(work, 'snapshot.json'); } catch { return null; } })();
  // 출력 입구 한 곳(R3-2): stdout 의 모든 줄(첫 줄·둘째 줄 이하·ERR 문구)이 이 함수를 거친다 — 원문 가림 → 줄바꿈 평탄화 → 다시 가림(report.mjs mline 과 같은 순서)
  const { mline } = makeLineMask(ctx.adapter.mask, knownShas({ mr, snapshot }));
  try {
    return run(args, work, snapshot, mline).map((l) => mline(l)).join('\n');
  } catch (e) {
    if (e instanceof Error) e.message = mline(e.message);
    throw e;
  }
}

function run(args, work, snapshot, mask) {
  if (typeof args.valid !== 'string') throw new MergeError('--valid <claude,codex|claude|codex|-> 가 필요하다 — §5 에서 판정한 실행 유효 검토자 목록');
  const names = args.valid === '-' ? [] : args.valid.split(',');
  if (names.some((n) => !MODELS.includes(n)) || new Set(names).size !== names.length) throw new MergeError(`--valid ${args.valid}: claude·codex 의 쉼표 목록 또는 - 만 허용`);
  const valid = MODELS.filter((m) => names.includes(m));
  let rows = null;
  if (args.rows !== undefined) { rows = Number(args.rows); if (!Number.isSafeInteger(rows) || rows < 1) throw new MergeError(`--rows ${args.rows}: 양의 정수(검증 표 총 행 수 n)`); }
  const same = (args.same || []).map((s) => { const m = String(s).match(/^claude:(\d+)=codex:(\d+)$/); if (!m) throw new MergeError(`--same 형식: claude:<i>=codex:<j> (${s})`); return [Number(m[1]), Number(m[2])]; });
  if (!snapshot || !/^[0-9a-f]{40}$/.test(String(snapshot.head_sha || ''))) throw new MergeError('snapshot.json 이 필요하다(collect 먼저)');
  const check = readOpt(work, 'check.json');
  if (!check) throw new MergeError('check.json 이 필요하다(check 먼저)');
  const pack = readOpt(work, 'pack.json');
  if (valid.includes('codex') && !pack) throw new MergeError('pack.json 이 없다 — Codex 허용 결정 id(팩 B 에 실린 기준선)를 정할 수 없다(pack 먼저)');
  const extra = [];
  const rev = { claude: null, codex: null };
  const invalid = [];
  for (const m of MODELS) {
    if (!valid.includes(m)) { if (fs.existsSync(path.join(work, `review-${m}.json`))) extra.push(`${m}(--valid 밖)`); continue; }   // 목록 밖 파일은 읽지 않는다(R4-1)
    const r = loadReview(work, m, snapshot.head_sha);
    if (r.obj) rev[m] = r.obj; else invalid.push(`${m}(${r.why})`);
  }
  let codexStats = null;
  try { codexStats = readOpt(work, 'codex-stats.json'); } catch { codexStats = null; }
  const res = mergeReviews({ ...rev, check, pack, snapshot, codexStats, rows, same, valid, mask });

  // 기존 findings.json(D139) — 같은 head 면 --force 필요 · 다른 head 면 교체 · JSON 아님은 덮어쓰지 않는다
  const fp = path.join(work, 'findings.json');
  const lines = [];
  const fst = fs.lstatSync(fp, { throwIfNoEntry: false });
  if (fst && !fst.isFile()) throw new MergeError('findings.json 이 일반 파일이 아니다(심볼릭 링크·디렉터리) — 따라가 읽거나 쓰지 않는다(확인 뒤 지우고 다시 실행)');   // impl R4-1
  if (fst) {
    let old;
    try { old = JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { throw new MergeError('findings.json 이 JSON 이 아니다 — 무엇인지 모르는 파일은 덮어쓰지 않는다(확인 뒤 지우고 다시 실행)'); }
    if (old?.head_sha === snapshot.head_sha && args.force !== true) throw new MergeError('findings.json 이미 있음(같은 head) — --force 로 덮어쓴다(메인이 채운 칸을 잃는다)');
    if (old?.head_sha !== snapshot.head_sha) lines.push(`replaced: findings.json(head ${/^[0-9a-f]{40}$/.test(String(old?.head_sha)) ? old.head_sha.slice(0, 7) : '-'})`);   // SHA 꼴만 자른다 — 임의 값의 앞 7자는 가림 규칙 최소 길이 아래 조각이 된다(impl R3-1 전수 점검)
  }
  // 옛 판정 무효화(R3-1·R4-2): verdict.json 삭제를 먼저 끝낸 뒤 findings.json 을 쓴다 — 삭제 실패면 멈추고 findings.json 은 그대로
  const vp = path.join(work, 'verdict.json');
  if (fs.lstatSync(vp, { throwIfNoEntry: false })) {
    try { fs.rmSync(vp); } catch { throw new MergeError('verdict.json 을 지울 수 없다 — 옛 판정이 새 발견과 함께 렌더되지 않게 findings.json 을 쓰지 않는다'); }
    lines.push('invalidated: verdict.json');
  }
  writeWorkFile(work, 'findings.json', JSON.stringify(res.findings, null, 2));   // 새 파일에 쓰고 이름 바꾸기 — 하드 링크 원본 불변(impl R4-1)

  const n = res.notes;
  const byModel = (o, f = (v) => v) => MODELS.filter((m) => o[m] !== undefined && (Array.isArray(o[m]) ? o[m].length : o[m])).map((m) => `${m}: ${f(o[m])}`).join(' · ');
  const second = [];
  if (n.candidates.length) second.push(`candidates: ${n.candidates.join(' · ')}`);
  if (byModel(n.decisionsDropped)) second.push(`decisionsDropped: ${byModel(n.decisionsDropped, (v) => v.join(', '))}`);
  if (byModel(n.decisionsMissing)) second.push(`decisionsMissing: ${byModel(n.decisionsMissing, (v) => `${v}건`)}`);
  if (byModel(n.rowsDropped)) second.push(`rowsDropped: ${byModel(n.rowsDropped, (v) => v.join(', '))}`);
  if (n.rowsMissing.length) second.push(`rowsMissing: ${n.rowsMissing.join(', ')}`);
  if (n.criterionMissing.length) second.push(`criterionMissing: ${n.criterionMissing.join(', ')}`);
  second.push(...lines);
  if (invalid.length) second.push(`invalid: ${invalid.join(' · ')}`);
  if (extra.length) second.push(`excluded: ${extra.join(' · ')}`);
  const c = res.counts;
  return [`MERGED reviewers=${c.reviewers} findings=${c.findings} joined=${c.joined} candidates=${c.candidates} needsMain=${c.needsMain}`, ...second];
}
