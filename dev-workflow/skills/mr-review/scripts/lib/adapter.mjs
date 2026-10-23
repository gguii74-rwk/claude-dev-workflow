// adapter.mjs — 어댑터 문서의 기계 블록(SC-2)만 읽는다. 산문은 LLM 몫. 프로젝트 고유 값은 전부 여기서 들어온다(D10).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export class AdapterError extends Error {}
// SHA 보호 자리표시(pack.mjs `maskTextWithCounts` — NUL + U+E000~E00F 인코딩 + U+E010 구분)에 쓰는 문자 전부. mask 패턴이 여기에 걸리면 자리표시가 깨진다(impl C3 C2-N1).
const PLACEHOLDER_PROBE = `\u0000${Array.from({ length: 17 }, (_, i) => String.fromCharCode(0xE000 + i)).join('')}\uE000\u0000`;

export const DEPLOY_LAYOUTS = ['source', 'maven-war'];

const OPEN = '```json mr-review-adapter';
const CLOSE = '```';

// 필수 키(점 표기). 배열은 존재만, 객체는 존재만 — 내용 규칙은 아래 validate가 따로 본다.
const REQUIRED = [
  'schema', 'gitlab.host', 'workspaceRoot', 'docsRoot', 'projects',
  'policy.judgeId', 'policy.acceptedIds', 'policy.docs',
  'contract.lines', 'baselineCandidates', 'docsMap.always', 'docsMap.rules',
  'wiki.roots', 'wiki.linesPerPage', 'wiki.pagesPerPack', 'mask',
  'deploy.targets', 'deploy.excludes',
  'comments.verdictFirstLine', 'comments.baselineConfirm', 'comments.authorToken', 'comments.trustedReviewers',
  'report.dir',
];

function get(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function extractBlock(markdown) {
  const lines = markdown.split('\n');
  const starts = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].trim() === OPEN) starts.push(i);
  if (starts.length === 0) throw new AdapterError(`어댑터에 기계 블록(${OPEN})이 없다`);
  if (starts.length > 1) throw new AdapterError('어댑터에 기계 블록이 둘 이상이다 — 하나만 둔다');
  const body = [];
  for (let i = starts[0] + 1; i < lines.length; i++) {
    if (lines[i].trim() === CLOSE) return body.join('\n');
    body.push(lines[i]);
  }
  throw new AdapterError('기계 블록이 닫히지 않았다');
}

export function validate(cfg) {
  const missing = REQUIRED.filter((k) => get(cfg, k) === undefined);
  if (cfg.schema !== undefined && cfg.schema !== 1) missing.push('schema(=1)');
  // GitLab 호스트(impl R2-4) — glab 은 미지정이면 실행 디렉터리의 저장소 호스트를 고른다. 숫자 프로젝트 ID 는 서버마다 따로라 호스트를 어댑터가 고정한다(스킴·경로 없는 호스트[:포트])
  if (cfg.gitlab?.host !== undefined && !(typeof cfg.gitlab.host === 'string' && /^[A-Za-z0-9.-]+(?::\d+)?$/.test(cfg.gitlab.host))) missing.push('gitlab.host(호스트[:포트] — 스킴·경로 없이)');
  if (cfg.projects && (typeof cfg.projects !== 'object' || Object.keys(cfg.projects).length === 0)) missing.push('projects(1개 이상)');
  for (const [name, p] of Object.entries(cfg.projects || {})) {
    if (!p || !Number.isInteger(p.id)) missing.push(`projects.${name}.id`);
    if (!p || typeof p.path !== 'string') missing.push(`projects.${name}.path`);
    // 배포본 zip 배치(1.3.2 ⑨ — spec 2026-10-22 3.⑨ D37 → 1.3.3 D59) — 선택 키, 없으면 source. 의미 = zip 표지로 판별 못 할 때의 기본값(힌트)·zip 없는 ④ 의 배치(프로젝트 고정이 아니다). 매핑 표는 deploy.mjs 내장 프리셋
    if (p && p.deployLayout !== undefined && !DEPLOY_LAYOUTS.includes(p.deployLayout)) missing.push(`projects.${name}.deployLayout(${DEPLOY_LAYOUTS.map((l) => `"${l}"`).join('|')})`);
  }
  if (Array.isArray(cfg.policy?.acceptedIds) && cfg.policy.acceptedIds.length === 0) missing.push('policy.acceptedIds(비어 있음)');
  if (Array.isArray(cfg.contract?.lines) && cfg.contract.lines.length !== 10) missing.push('contract.lines(10개)');
  // 선택 키(1.3.5 ⑤·⑥ — spec 2026-10-23 D95·D96·D99) — 없으면 현행 동작(기존 어댑터 출력 바이트 불변). 값 오류는 deployLayout 선례대로 로드 단계에서 멈춘다
  if (cfg.baselineRepoPaths !== undefined && typeof cfg.baselineRepoPaths !== 'boolean') missing.push('baselineRepoPaths(true|false)');
  const bs = cfg.contract?.backgroundSections;
  if (bs !== undefined && !(Array.isArray(bs) && bs.length > 0 && bs.every((x) => typeof x === 'string' && x.trim() !== ''))) missing.push('contract.backgroundSections(비어 있지 않은 문자열 배열)');
  const v = cfg.comments?.verdictFirstLine;
  if (typeof v === 'string') for (const g of ['policy', 'sha', 'kind', 'verdict']) if (!v.includes(`(?<${g}>`)) missing.push(`comments.verdictFirstLine(그룹 ${g})`);
  const t = cfg.comments?.authorToken;
  if (typeof t === 'string' && !t.includes('(?<token>')) missing.push('comments.authorToken(그룹 token)');
  // 문서 참조 경로(8b FR1-4) — `<docsRoot 기준 경로>`·`repo:<저장소 루트 기준 경로>`의 경로 부분은 정규 상대 경로만(빈 값·앞 `/`·드라이브·역슬래시·빈 조각·`.`·`..` 거부).
  // docsRoot 밖(개인 위키 등 전송 금지 자료)을 공통 문서로 팩 B 에 넣는 설정 오류를 로드 단계에서 막는다. 실제 경로(심볼릭 링크) 탈출은 pack 이 다시 본다.
  const docRefs = [['policy.docs', cfg.policy?.docs], ['docsMap.always', cfg.docsMap?.always], ...(Array.isArray(cfg.docsMap?.rules) ? cfg.docsMap.rules.map((r, i) => [`docsMap.rules[${i}].docs`, r?.docs]) : [])];
  for (const [key, list] of docRefs) {
    for (const [i, ref] of (Array.isArray(list) ? list : []).entries()) {
      const rel = typeof ref === 'string' ? ref.replace(/^repo:/, '').split('#')[0] : '';
      if (!rel || /^[\\/]|^[A-Za-z]:|\\/.test(rel) || rel.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) missing.push(`${key}[${i}](정규 상대 경로만 — 문서 저장소·대상 저장소 밖을 가리킬 수 없다)`);
    }
  }
  for (const [i, m] of (cfg.mask || []).entries()) {
    if (!m || typeof m.name !== 'string' || typeof m.pattern !== 'string') { missing.push(`mask[${i}]`); continue; }
    let re;
    try { re = new RegExp(m.pattern, 'g' + (m.flags || '')); } catch { missing.push(`mask[${i}].pattern(정규식 오류)`); continue; }
    if (re.test(PLACEHOLDER_PROBE)) missing.push(`mask[${i}].pattern(SHA 보호 자리표시 문자 NUL·U+E000~E010 을 잡는다 — 정상 SHA 가 복원되지 않는다)`);
  }
  return missing;
}

export function homeDir() {
  return process.env.MR_REVIEW_HOME || os.homedir();
}

function expandHome(p) {
  return p === '~' || p.startsWith('~/') ? path.join(homeDir(), p.slice(1).replace(/^\//, '')) : p;
}

export function loadAdapter(file) {
  const abs = path.resolve(file);
  let md;
  try { md = fs.readFileSync(abs, 'utf8'); } catch (e) { throw new AdapterError(`어댑터 파일을 읽을 수 없다: ${abs} (${e.message})`); }
  let cfg;
  try { cfg = JSON.parse(extractBlock(md)); } catch (e) { if (e instanceof AdapterError) throw e; throw new AdapterError(`기계 블록 JSON 오류: ${e.message}`); }
  const missing = validate(cfg);
  if (missing.length) throw new AdapterError(`어댑터 필수 키 누락·오류: ${missing.join(', ')}`);
  const baseDir = path.dirname(abs);
  const workspaceRoot = path.resolve(baseDir, cfg.workspaceRoot);
  const projects = {};
  for (const [name, p] of Object.entries(cfg.projects)) {
    projects[name] = { id: p.id, checkout: path.resolve(workspaceRoot, p.path), deployExempt: p.deployExempt === true, deployLayout: p.deployLayout ?? 'source' };
  }
  const wikiRoots = cfg.wiki.roots.map((r) => {
    const root = path.resolve(expandHome(r.path));
    return { path: root, export: r.export === true, glossaryFile: r.glossary ? path.join(root, r.glossary) : null };
  });
  cfg.baselineRepoPaths = cfg.baselineRepoPaths ?? false;
  cfg.contract.backgroundSections = cfg.contract.backgroundSections ?? ['배경'];
  cfg.file = abs;
  cfg.markdown = md;
  cfg.resolved = { workspaceRoot, docsRoot: path.resolve(workspaceRoot, cfg.docsRoot), reportDir: path.resolve(workspaceRoot, cfg.report.dir), projects, wikiRoots };
  return cfg;
}

// glob → RegExp. `**` = 0개 이상 디렉터리, `*` = 구분자 제외, `?` = 한 글자. 경로는 `/` 구분 상대 경로.
export function globToRegExp(glob) {
  let re = '^';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const prevSlash = i === 0 || glob[i - 1] === '/';
        const nextSlash = glob[i + 2] === '/';
        if (prevSlash && nextSlash) { re += '(?:.*/)?'; i += 3; continue; }      // **/  → 0개 이상 디렉터리
        if (prevSlash && i + 2 === glob.length) { re += '.*'; i += 2; continue; } // 끝의 ** → 나머지 전부(앞의 / 포함 처리 아래)
        re += '.*'; i += 2; continue;
      }
      re += '[^/]*'; i += 1; continue;
    }
    if (c === '?') { re += '[^/]'; i += 1; continue; }
    if (c === '/' && glob[i + 1] === '*' && glob[i + 2] === '*' && i + 3 === glob.length) { re += '(?:/.*)?'; i += 3; continue; } // 끝의 /** → 자기 자신 또는 하위
    re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }
  return new RegExp(re + '$');
}

export function matchesAny(p, globs) {
  return (globs || []).some((g) => globToRegExp(g).test(p));
}

// CLI 인자: --key value · --flag · 반복 --resolve. env.MR_REVIEW_ADAPTER 는 --adapter 의 대체(인자 우선).
const FLAGS = new Set(['diff-only', 'early', 'paginate']);
const MULTI = new Set(['resolve']);
export function parseArgs(argv, env = process.env) {
  const out = { resolve: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { (out._ ||= []).push(a); continue; }
    const k = a.slice(2);
    if (FLAGS.has(k)) { out[k] = true; continue; }
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) { out[k] = true; continue; }
    if (MULTI.has(k)) out[k].push(v); else out[k] = v;
    i += 1;
  }
  if (!out.adapter && env.MR_REVIEW_ADAPTER) out.adapter = env.MR_REVIEW_ADAPTER;
  return out;
}
