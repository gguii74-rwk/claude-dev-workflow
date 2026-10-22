// gitlab.mjs — `glab api` 래퍼(D15: 토큰은 glab 이 관리). JSON·바이너리·페이지. 테스트는 MR_REVIEW_GLAB 로 가짜 glab 을 꽂는다.
import { spawnSync } from 'node:child_process';

export class GitLabError extends Error {
  constructor(message, status = null) { super(message); this.status = status; }
}

const MAX_BUFFER = 512 * 1024 * 1024;

export function glabBin() {
  return process.env.MR_REVIEW_GLAB || 'glab';
}

// 요청 호스트(impl R2-4) — 어댑터 `gitlab.host` 를 CLI 가 설정한다. 미설정이면 조회하지 않는다(glab 이 실행 디렉터리의 다른 서버를 고르지 않게, fail-closed)
let HOST = null;
export function setHost(host) { HOST = host; }

function run(args, { binary = false } = {}) {
  if (!HOST) throw new GitLabError('GitLab 호스트 미설정 — 어댑터 gitlab.host 가 필요하다');
  // glab `--hostname` 은 `host:port` 를 거부한다(1.3.1 ①) — 포트를 떼고 넘기며, 포트는 glab 설정 `hosts.<호스트>.api_host` 가 갖는다. MR web_url 대조(collect)는 포트 포함 값 그대로
  const r = spawnSync(glabBin(), ['api', '--hostname', HOST.replace(/:\d+$/, ''), ...args], { encoding: binary ? 'buffer' : 'utf8', maxBuffer: MAX_BUFFER });
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
