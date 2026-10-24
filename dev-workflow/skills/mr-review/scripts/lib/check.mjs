// check.mjs — spec §5.2 검사표(모델 없이) + §5.1-4 댓글 신뢰 + §5.1-5 기준선·이슈 원문 수집 + §5.6 재리뷰 진입. 입력 = mr.json·snapshot.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { apiJson, apiRaw, encodePath } from './gitlab.mjs';
import { matchesAny } from './adapter.mjs';
import { maskText, knownShas } from './pack.mjs';   // 결정 추출은 가린 원문에서(1.4.0 ① R1-1·R2-1) — 마스킹 정본은 pack.mjs

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

// 배경 절(1.3.5 ⑥ — spec 2026-10-23 3.⑥ D96·D110·R1-6): 어댑터 `contract.backgroundSections`(기본 ["배경"]) 별칭마다 접두 일치로 **어댑터 순서대로** 찾아 첫 실재 절(빈 절이어도)을 쓴다 —
// 이름들을 합친 정규식 하나는 본문에 먼저 나온 절이 이겨 어댑터 순서가 무시된다. name = 일치한 별칭 이름(실제 제목 전체가 아니다 — 키 없는 어댑터의 「## 배경 (Background)」 도 「배경」)
const escRe = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function backgroundSection(description, aliases = ['배경']) {
  for (const a of aliases) { const t = section(description, new RegExp(`^${escRe(a)}`)); if (t !== null) return { name: a, text: t }; }
  return { name: null, text: '' };
}

// 배경 절에서 양식 줄(이슈/spec·트랙)을 뺀 변경 사유 본문
export function reasonText(description, aliases = ['배경']) {
  const bg = backgroundSection(description, aliases).text;
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
// 쿼리(`?ref_type=heads` — GitLab 이 복사 링크에 붙인다)·조각(`#L10`)은 경로가 아니다 — `?`·`#` 앞에서 끊고, 문장 끝 구두점(`.`·`,` 등)은 떼어 낸다(impl SDD 이월 T03).
const BLOB_RE = /(https?:\/\/[^\s)<>`]+?\/([^\s/)<>`]+))\/-\/blob\/([^\s)<>`#?]+)/g;
const TRAIL_PUNCT = /[.,;:!]+$/;
const ISSUE_URL_RE = /(https?:\/\/[^\s)<>`]+?\/([^\s/)<>`]+))\/-\/issues\/(\d+)/g;
const ISSUE_REF_RE = /(?:^|[\s(`])#(\d+)\b/g;
// 코드펜스 안을 줄 단위로 제거 — 여는 줄 `{3,}|~{3,}(들여쓰기 ≤3), 닫는 줄 = 같은 문자·길이 이상 + 뒤는 공백만(CommonMark — `~~~not-close` 는 닫힘 아님, impl C1 R2-6 잔존). 열린 펜스가 끝까지 안 닫히면 끝까지 제외.
// 펜스 밖 줄을 [원문 줄 번호(1부터), 줄] 로 — 결정 추출(1.4.0 ①)이 줄 번호를 쓴다
const outsideFences = (text) => {
  const out = []; let open = null;
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (open) { if (m && m[1][0] === open[0] && m[1].length >= open.length && /^[ \t]*$/.test(line.slice(m[0].length))) open = null; return; }
    if (m) { open = m[1]; return; }
    out.push([i + 1, line]);
  });
  return out;
};
const stripFences = (text) => outsideFences(text).map(([, l]) => l).join('\n');

// ── 기준선 결정 추출(1.4.0 ① — spec 2026-10-24 3.①-1·2 D115·D128·D129·D131) ─────────────
// 입력 = 기준선 원문 전체를 maskText 로 가린 텍스트(R1-1·R2-1 — 줄바꿈 통일·여러 줄 비밀값 가림이 문맥과 함께 끝난 뒤). 표시·입력용이다(판정 입력 아님 — D9).
// 기본 규칙(어댑터 키 없음): 코드펜스 밖 줄의 ⓐ 표 행 첫 데이터 칸 ⓑ 목록 항목 ⓒ 제목 — `D<숫자>`(굵게 허용) 바로 뒤가 공백·`|`·`:`·`.`·`)`·줄 끝일 때만(D128 — `D4·D14`·`D4와` 는 아니다).
// 같은 key 는 꼴 우선 표 > 목록 > 제목, 같은 꼴은 문서 순 첫 것(D129). 문구는 가린 뒤 공백 정규화 → 300자(초과 `…`) · 원문 1건당 100건(D131)
export const DECISIONS_MAX = 100;
const DECISION_TEXT_MAX = 300;
const DKEY = /^(?:\*\*)?D(\d+)(?:\*\*)?(?=[ \t|:.)]|$)/;
const tidy = (t) => { const v = [...String(t).replace(/\s+/g, ' ').trim()]; return v.length > DECISION_TEXT_MAX ? `${v.slice(0, DECISION_TEXT_MAX).join('')}…` : v.join(''); };
const restText = (r) => r.replace(/^(?:\*\*)?D\d+(?:\*\*)?/, '').replace(/^[\s|:.)]+/, '');
export function extractDecisions(text, pattern = null) {
  const found = [];
  for (const [line, l] of outsideFences(String(text))) {
    if (pattern) {
      for (const m of l.matchAll(new RegExp(pattern, 'gm'))) {
        const key = m.groups?.key;
        if (key) found.push({ form: 0, key, line, text: m.groups.text ?? l.slice(m.index + m[0].length) });
      }
      continue;
    }
    let m;
    if (/^\s*\|/.test(l)) {
      const cells = l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      if ((m = cells[0]?.match(DKEY))) found.push({ form: 0, key: `D${m[1]}`, line, text: cells.length > 1 ? cells[1] : restText(cells[0]) });
    } else if ((m = l.match(/^\s*(?:[-*+]|\d+[.)])\s+(.*)$/)) && DKEY.test(m[1])) {
      found.push({ form: 1, key: `D${m[1].match(DKEY)[1]}`, line, text: restText(m[1]) });
    } else if ((m = l.match(/^\s{0,3}#{1,6}\s+(.*)$/)) && DKEY.test(m[1])) {
      found.push({ form: 2, key: `D${m[1].match(DKEY)[1]}`, line, text: restText(m[1]) });
    }
  }
  const best = new Map();
  for (const f of found) { const b = best.get(f.key); if (!b || f.form < b.form) best.set(f.key, f); }
  const all = [...best.values()].sort((a, b) => a.line - b.line);
  return { decisions: all.slice(0, DECISIONS_MAX).map((f) => ({ key: f.key, line: f.line, text: tidy(f.text) })), truncated: all.length > DECISIONS_MAX };
}
const SHA_RE = /^[0-9a-f]{7,40}$/;

function splitRefPath(refpath) {
  const segs = refpath.split('/').map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  return { segs, ref: segs[0], path: segs.slice(1).join('/') };   // 임시 경계(첫 세그먼트) — SHA·미확보 링크용. 브랜치·태그는 해소 시 재결정
}

// 저장소 상대 경로 후보(1.3.5 ⑤ — spec 2026-10-23 3.⑤-2 D112): 값을 **허용 구분자**로만 나눈 토큰에서 첫 `#` 뒤(절 접미)와 끝 `.`·`…` 만 떼고, 토큰 **전체**가 정규 상대 경로 꼴(`/` 1개 이상 · 확장자 · `.`/`..` 조각 없음)일 때만 후보.
// 목록 밖 글자(역슬래시·`:`·`~`·`$`·한글 등)가 붙은 토큰은 통째로 탈락한다 — 토큰의 앞·뒷부분만 떼어 경로로 삼지 않는다(허용 목록 방식). 글롭(`baselineCandidates`) 밖은 무시
const PATH_SEP_RE = /[\s,;()「」'"·]+/;
const REPO_PATH_RE = /^(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9]+$/;
export function repoPathCandidates(value, globs) {
  const out = [];
  for (const tok of value.split(PATH_SEP_RE)) {
    const t = tok.replace(/#.*$/, '').replace(/[.…]+$/, '');
    if (!REPO_PATH_RE.test(t) || t.split('/').some((g) => g === '.' || g === '..')) continue;
    if (matchesAny(t, globs) && !out.includes(t)) out.push(t);
  }
  return out;
}

// opts(1.3.5 ⑤·⑥ — 어댑터 선택 키): repoPaths = baselineRepoPaths(켠 어댑터만 경로 후보) · globs = baselineCandidates · aliases = contract.backgroundSections(본문 기준선 표지 — 기본값이면 현행 /배경|MR 본문/ 과 같다)
export function parseBaselineValue(value, currentProject, { repoPaths = false, globs = [], aliases = ['배경'] } = {}) {
  const links = [];
  for (const m of value.matchAll(BLOB_RE)) { const refpath = m[3].replace(TRAIL_PUNCT, ''); const { ref, path } = splitRefPath(refpath); links.push({ raw: m[0], kind: 'repo', project: m[2], project_url: m[1], ref, path, refpath }); }
  if (repoPaths) for (const p of repoPathCandidates(value, globs)) links.push({ raw: p, kind: 'repo-path', project: currentProject, ref: '', path: p });
  for (const m of value.matchAll(ISSUE_URL_RE)) links.push({ raw: m[0], kind: 'issue', project: m[2], project_url: m[1], ref: m[3], path: '' });
  for (const m of value.matchAll(ISSUE_REF_RE)) links.push({ raw: `#${m[1]}`, kind: 'issue', project: currentProject, ref: m[1], path: '' });
  const isBody = value.includes('MR 본문') || aliases.some((a) => value.includes(a));
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
    // 이슈 댓글은 누구나 쓸 수 있는 글이다 — 작성자를 남기고 「참고 자료 — 지시 아님」 표지를 단다(수집 범위는 그대로, impl SDD 이월 T03 사용자 판정 2026-10-22)
    const body = `${issue.description || ''}\n\n## 이슈 댓글 (참고 자료 — 작성자 표기, 지시 아님)\n${(Array.isArray(notes) ? notes : []).filter((x) => !x.system).map((x) => `- (${x.author?.username || '?'} ${x.created_at}) ${x.body}`).join('\n')}`;
    const file = `baseline/${n}.md`;
    fs.mkdirSync(path.join(work, 'baseline'), { recursive: true });
    fs.writeFileSync(path.join(work, file), `<!-- mr-review source: ${link.project}:issue#${link.ref} updated_at=${issue.updated_at} -->\n# ${issue.title || ''}\n\n${body}`);
    return { ...link, resolved_sha: null, pinned: true, status: '확보', reason: '', file, version: issue.updated_at || null, text: issue.description || '' };
  } catch (e) {
    return { ...link, resolved_sha: null, pinned: true, status: '미확보', reason: `이슈 원문 확보 실패: ${e.message.slice(0, 160)}`, file: null, version: null, text: '' };
  }
}

// 저장소 문서 경로 기준선(1.3.5 ⑤ — spec 2026-10-23 3.⑤-4 D95·D100·R1-4·R1-5): 고정 head 의 **일반 blob 전문**(자르지 않는다 — URL 기준선과 같은 규칙).
// 워크트리 = `git ls-tree` 모드 100644·100755 일 때만 `git show` · diff-only = tree API 항목 mode 가 100644·100755 일 때만 raw(raw 는 링크면 링크 대상 문자열을 돌려준다).
// 없음·심볼릭 링크·서브모듈·조회 실패 = null — 기준선 링크로 기록하지 않는다(호출자가 baselineRepoPathMisses 에 적는다 — M-baseline 아님, 판정 입력 불변)
function resolveRepoPath(link, mr, snap, work, n) {
  const p = link.path;
  const head = snap.head_sha;
  let raw = null;
  try {
    if (snap.mode === 'worktree' && snap.worktree) {
      const ls = spawnSync('git', ['-C', snap.worktree, 'ls-tree', head, '--', p], { encoding: 'utf8' });
      const mode = ls.status === 0 ? (ls.stdout.trim().split(/\s+/)[0] || '') : '';
      if (mode === '100644' || mode === '100755') {
        const show = spawnSync('git', ['-C', snap.worktree, 'show', `${head}:${p}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        raw = show.status === 0 ? show.stdout : null;
      }
    } else {
      const items = apiJson(`projects/${mr.project.id}/repository/tree?path=${encodeURIComponent(path.posix.dirname(p))}&ref=${head}&per_page=100`, { paginate: true });
      const it = (Array.isArray(items) ? items : []).find((x) => x?.name === path.posix.basename(p));
      if (it && (it.mode === '100644' || it.mode === '100755')) raw = apiRaw(`projects/${mr.project.id}/repository/files/${encodePath(p)}/raw?ref=${head}`).toString('utf8');
    }
  } catch { raw = null; }
  if (raw == null) return null;
  const file = `baseline/${n}.md`;
  fs.mkdirSync(path.join(work, 'baseline'), { recursive: true });
  fs.writeFileSync(path.join(work, file), `<!-- mr-review source: ${mr.project.name}:${p}@${head} ref=${head} pinned=true -->\n${raw}`);
  const inDiff = (mr.diffs || []).some((d) => d.new_path === p && !d.deleted_file);
  return { ...link, project: mr.project.name, ref: head, path: p, pinned: true, resolved_sha: head, status: '확보', reason: '', file, version: head, inDiff };
}

function resolveBody(link, mr, headSha, work, n, aliases = ['배경']) {
  const bs = backgroundSection(mr.description, aliases);
  const bg = bs.text;
  const file = `baseline/${n}.md`;
  fs.mkdirSync(path.join(work, 'baseline'), { recursive: true });
  fs.writeFileSync(path.join(work, file), `<!-- mr-review source: ${mr.project.name}:MR!${mr.iid} 본문 「${bs.name ?? aliases[0]}」 head=${headSha} -->\n${bg}`);
  const names = `「${aliases[0]}」${aliases.length > 1 ? `(또는 ${aliases.slice(1).map((a) => `「${a}」`).join('·')})` : ''}`;
  return { ...link, resolved_sha: headSha, pinned: true, status: bg ? '확보' : '미확보', reason: bg ? '' : `MR 본문에 ${names} 절이 없다`, file, version: headSha };
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
  const aliases = adapter.contract.backgroundSections || ['배경'];

  const contract = parseContract(desc, adapter);
  const track = parseTrack(desc);
  const baselineRow = contract.lines.find((l) => l.name === 'Baseline');
  let baselineType;
  let links = [];
  if (!baselineRow || baselineRow.status === '없음') baselineType = '칸 없음';
  else if (baselineRow.status === '자리표시자') baselineType = '빈칸·자리표시자';
  else { const p = parseBaselineValue(baselineRow.value, mr.project.name, { repoPaths: adapter.baselineRepoPaths === true, globs: adapter.baselineCandidates, aliases }); baselineType = p.type; links = p.links; }

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
  // 코드펜스 = ``` 또는 ~~~ **3자 이상**으로 여는 줄부터 같은 문자·같은 길이 이상으로 닫는 줄까지(CommonMark) — 줄 단위로 추적한다. 삼중 백틱 정규식은 `~~~` 펜스와 4중 백틱 안의 삼중 백틱을 못 가려 펜스 안 `#n` 이 미확보 → HOLD_EVIDENCE 가 됐다(C3 R2-6 잔존 보정).
  const bodyText = stripFences(desc).replace(/^## Review Contract\b[^\n]*(?:\n(?!## )[^\n]*)*/m, '');
  for (const m of bodyText.matchAll(ISSUE_REF_RE)) if (!hasIssue(mr.project.name, m[1])) links.push({ raw: `#${m[1]}`, kind: 'issue', project: mr.project.name, ref: m[1], path: '' });
  for (const m of bodyText.matchAll(ISSUE_URL_RE)) if (!hasIssue(m[2], m[3])) links.push({ raw: m[0], kind: 'issue', project: m[2], project_url: m[1], ref: m[3], path: '' });
  const baselineLinks = [];
  const baselineRepoPathMisses = [];
  let n = 0;
  let issueText = '';
  for (const l of links) {
    n += 1;
    let r;
    if (l.kind === 'repo') r = resolveRepoLink(l, adapter, work, n);
    else if (l.kind === 'repo-path') { r = resolveRepoPath(l, mr, snap, work, n); if (!r) { baselineRepoPathMisses.push(l.path); n -= 1; continue; } }
    else if (l.kind === 'issue') { r = resolveIssue(l, adapter, work, n); if (r.text && !issueText) issueText = r.text; delete r.text; }
    else r = resolveBody(l, mr, headSha, work, n, aliases);
    baselineLinks.push(r);
  }
  // 기준선 결정(1.4.0 ① — spec 2026-10-24 3.①-1): 확보된 기준선(repo·repo-path·body — 이슈 제외) 원문 전체를 먼저 가리고 그 결과에서 뽑는다(R1-1·R2-1).
  // 가림 뒤 잔존이면(maskText 가 통째로 [masked:unmaskable]) 그 기준선은 0건 + baselineDecisionsSkipped(fail-closed). id = B<n>-<key>(n = baseline/<n>.md)
  const baselineDecisions = [];
  const baselineDecisionsSkipped = [];
  let baselineDecisionsTruncated = false;
  const keepShas = knownShas({ mr, snapshot: snap });
  for (const l of baselineLinks) {
    if (l.status !== '확보' || !l.file || !['repo', 'repo-path', 'body'].includes(l.kind)) continue;
    const bn = Number(l.file.match(/(\d+)\.md$/)?.[1]);
    const masked = maskText(fs.readFileSync(path.join(work, l.file), 'utf8'), adapter.mask, keepShas);
    if (masked === '[masked:unmaskable]') { baselineDecisionsSkipped.push(bn); continue; }
    const r = extractDecisions(masked, adapter.baselineDecisions?.pattern ?? null);
    if (r.truncated) baselineDecisionsTruncated = true;
    for (const d of r.decisions) baselineDecisions.push({ id: `B${bn}-${d.key}`, baseline: bn, key: d.key, line: d.line, text: d.text });
  }
  // 유형 우선순위(1.3.5 ⑤ D105): 문서 링크 > 저장소 문서 경로(확보된 경로 후보 1개 이상) > 이슈 > MR 본문 배경 > 빈칸·자리표시자 > 서술만 — 링크·원문은 전부 수집
  if (baselineType !== '문서 링크' && baselineLinks.some((l) => l.kind === 'repo-path')) baselineType = '저장소 문서 경로';

  // 변경 사유 출처: 본문 「배경」에 실내용(양식 표지·자리표시자를 뺀 글)이 있을 때만 body — 양식만 남은 본문은 「없음」이라 연결 이슈 원문으로 대체한다(§5.2, R4-4)
  const bodyReason = reasonText(desc, aliases);
  const bodyJ = judgeReason(bodyReason);
  const reasonSrc = (bodyJ.why || bodyJ.what) ? 'body' : issueText ? 'issue' : 'none';
  const reasonJ = reasonSrc === 'body' ? bodyJ : judgeReason(reasonSrc === 'issue' ? issueText : '');
  const reason = { why: reasonJ.why, what: reasonJ.what, source: reasonSrc, text: (reasonSrc === 'body' ? bodyReason : reasonSrc === 'issue' ? issueText : '').slice(0, 2000), section: backgroundSection(desc, aliases).name };

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

  const out = { contract, track, baselineType, baselineLinks, baselineDecisions, ...(baselineDecisionsTruncated ? { baselineDecisionsTruncated } : {}), ...(baselineDecisionsSkipped.length ? { baselineDecisionsSkipped } : {}), ...(adapter.baselineRepoPaths === true ? { baselineRepoPathMisses } : {}), reason, baselineCandidateFiles, baselineConfirm, attachments, attachmentClaimedButMissing: claimed, deployRequired, deployExempt, deployNote: dNote, rebase, reviewerMismatch, priorVerdicts: notesC.priorVerdicts, authorTokens: notesC.authorTokens, ignoredComments: notesC.ignoredComments, rereview: notesC.rereview, earlyExit };
  fs.writeFileSync(path.join(work, 'check.json'), JSON.stringify(out, null, 2));
  return out;
}

export async function cmdCheck(args, ctx) {
  const c = check({ adapter: ctx.adapter, work: ctx.work });
  return `CHECKED complete=${c.contract.complete} baseline=${c.baselineType} earlyExit=${c.earlyExit.would} rereview=${c.rereview.active}`;
}
