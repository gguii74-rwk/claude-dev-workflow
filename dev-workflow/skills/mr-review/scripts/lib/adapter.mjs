// adapter.mjs — 어댑터 문서의 기계 블록(SC-2)만 읽는다. 산문은 LLM 몫. 프로젝트 고유 값은 전부 여기서 들어온다(D10).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export class AdapterError extends Error {}

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
  }
  if (Array.isArray(cfg.policy?.acceptedIds) && cfg.policy.acceptedIds.length === 0) missing.push('policy.acceptedIds(비어 있음)');
  if (Array.isArray(cfg.contract?.lines) && cfg.contract.lines.length !== 10) missing.push('contract.lines(10개)');
  const v = cfg.comments?.verdictFirstLine;
  if (typeof v === 'string') for (const g of ['policy', 'sha', 'kind', 'verdict']) if (!v.includes(`(?<${g}>`)) missing.push(`comments.verdictFirstLine(그룹 ${g})`);
  const t = cfg.comments?.authorToken;
  if (typeof t === 'string' && !t.includes('(?<token>')) missing.push('comments.authorToken(그룹 token)');
  for (const [i, m] of (cfg.mask || []).entries()) {
    if (!m || typeof m.name !== 'string' || typeof m.pattern !== 'string') { missing.push(`mask[${i}]`); continue; }
    try { new RegExp(m.pattern, 'g'); } catch { missing.push(`mask[${i}].pattern(정규식 오류)`); }
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
    projects[name] = { id: p.id, checkout: path.resolve(workspaceRoot, p.path), deployExempt: p.deployExempt === true };
  }
  const wikiRoots = cfg.wiki.roots.map((r) => {
    const root = path.resolve(expandHome(r.path));
    return { path: root, export: r.export === true, glossaryFile: r.glossary ? path.join(root, r.glossary) : null };
  });
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
