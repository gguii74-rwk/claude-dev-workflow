// gitlab.mjs — `glab api` 래퍼(D15: 토큰은 glab 이 관리). JSON·바이너리·페이지. 테스트는 MR_REVIEW_GLAB 로 가짜 glab 을 꽂는다.
import { spawnSync } from 'node:child_process';

export class GitLabError extends Error {
  constructor(message, status = null) { super(message); this.status = status; }
}

const MAX_BUFFER = 512 * 1024 * 1024;

export function glabBin() {
  return process.env.MR_REVIEW_GLAB || 'glab';
}

function run(args, { binary = false } = {}) {
  const r = spawnSync(glabBin(), ['api', ...args], { encoding: binary ? 'buffer' : 'utf8', maxBuffer: MAX_BUFFER });
  if (r.error) throw new GitLabError(`glab 실행 실패(${glabBin()}): ${r.error.message}`);
  if (r.status !== 0) {
    const body = binary ? r.stdout.toString('utf8') : r.stdout;
    const err = binary ? r.stderr.toString('utf8') : r.stderr;
    throw new GitLabError(`glab api ${args.join(' ')} 실패(exit ${r.status}): ${String(body).slice(0, 300)} ${String(err).slice(0, 200)}`.trim(), r.status);
  }
  return r.stdout;
}

export function apiJson(apiPath, { paginate = false } = {}) {
  const out = run(paginate ? ['--paginate', apiPath] : [apiPath]);
  try { return JSON.parse(out); } catch { throw new GitLabError(`glab api ${apiPath}: JSON 응답이 아니다: ${String(out).slice(0, 200)}`); }
}

export function apiRaw(apiPath) {
  return run([apiPath], { binary: true });
}

// repository/files/:file_path 용 — `/` 와 `.` 까지 인코딩한다(GitLab 문서 예: app%2Fmodels%2Fkey%2Erb)
export function encodePath(p) {
  return encodeURIComponent(p).replace(/\./g, '%2E');
}
