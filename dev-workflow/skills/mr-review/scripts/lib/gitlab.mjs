// gitlab.mjs — `glab api` 래퍼(D15: 토큰은 glab 이 관리). JSON·바이너리·페이지. 테스트는 MR_REVIEW_GLAB 로 가짜 glab 을 꽂는다.
import { spawnSync } from 'node:child_process';

// kind = exit(glab 이 0 아닌 코드로 끝남) | spawn(glab 실행 실패) | format(JSON 응답 아님) | host(호스트 미설정) · http = stderr 의 마지막 `HTTP <3자리>` 의 숫자만(D160)
// message 는 ERR 줄용(현행 그대로 — D165). 작업 파일·리포트에는 storedReason() 의 고정 문구만 저장한다(1.4.2 ⓕ D151)
export class GitLabError extends Error {
  constructor(message, status = null, { kind = 'exit', http = null } = {}) { super(message); this.status = status; this.kind = kind; this.http = http; }
}

// 도구 안내 오류(D159) — 이 도구가 직접 만든 문구라는 표지. 저장 사유에 문구 전체를 싣는다(자르지 않는다)
export class NoticeError extends Error {}

// 저장용 실패 사유(1.4.2 ⓕ D159·D161) — 외부 도구 오류문·예상 밖 오류의 message(로컬 경로 등)는 저장하지 않는다
export function storedReason(e) {
  if (e instanceof GitLabError) {
    if (e.kind === 'spawn') return 'GitLab 조회 실패(glab 실행 불가)';
    if (e.kind === 'format') return 'GitLab 조회 실패(응답 형식 오류)';
    if (e.kind === 'host') return 'GitLab 조회 실패(호스트 미설정)';
    if (e.http) return `GitLab 조회 실패(HTTP ${e.http})`;
    return `GitLab 조회 실패(종료 코드 ${Number.isInteger(e.status) ? e.status : '알 수 없음'})`;
  }
  if (e instanceof NoticeError) return e.message;
  const code = typeof e?.code === 'string' && /^[A-Z][A-Z0-9_]{1,31}$/.test(e.code) ? e.code
    : typeof e?.name === 'string' && /^[A-Za-z]{1,32}$/.test(e.name) ? e.name : '알 수 없음';
  return `내부 오류(${code})`;
}

const lastHttp = (stderr) => { const all = [...String(stderr).matchAll(/HTTP (\d{3})(?!\d)/g)]; return all.length ? all[all.length - 1][1] : null; };

const MAX_BUFFER = 512 * 1024 * 1024;

export function glabBin() {
  return process.env.MR_REVIEW_GLAB || 'glab';
}

// 요청 호스트(impl R2-4) — 어댑터 `gitlab.host` 를 CLI 가 설정한다. 미설정이면 조회하지 않는다(glab 이 실행 디렉터리의 다른 서버를 고르지 않게, fail-closed)
let HOST = null;
export function setHost(host) { HOST = host; }

function run(args, { binary = false } = {}) {
  if (!HOST) throw new GitLabError('GitLab 호스트 미설정 — 어댑터 gitlab.host 가 필요하다', null, { kind: 'host' });
  // glab `--hostname` 은 `host:port` 를 거부한다(1.3.1 ①) — 포트를 떼고 넘기며, 포트는 glab 설정 `hosts.<호스트>.api_host` 가 갖는다. MR web_url 대조(collect)는 포트 포함 값 그대로
  const r = spawnSync(glabBin(), ['api', '--hostname', HOST.replace(/:\d+$/, ''), ...args], { encoding: binary ? 'buffer' : 'utf8', maxBuffer: MAX_BUFFER });
  if (r.error) throw new GitLabError(`glab 실행 실패(${glabBin()}): ${r.error.message}`, null, { kind: 'spawn' });
  if (r.status !== 0) {
    const body = binary ? r.stdout.toString('utf8') : r.stdout;
    const err = binary ? r.stderr.toString('utf8') : r.stderr;
    throw new GitLabError(`glab api ${args.join(' ')} 실패(exit ${r.status}): ${String(body).slice(0, 300)} ${String(err).slice(0, 200)}`.trim(), r.status, { kind: 'exit', http: lastHttp(err) });
  }
  return r.stdout;
}

export function apiJson(apiPath, { paginate = false } = {}) {
  const out = run(paginate ? ['--paginate', apiPath] : [apiPath]);
  try { return JSON.parse(out); } catch { throw new GitLabError(`glab api ${apiPath}: JSON 응답이 아니다: ${String(out).slice(0, 200)}`, null, { kind: 'format' }); }
}

export function apiRaw(apiPath) {
  return run([apiPath], { binary: true });
}

// repository/files/:file_path 용 — `/` 와 `.` 까지 인코딩한다(GitLab 문서 예: app%2Fmodels%2Fkey%2Erb)
export function encodePath(p) {
  return encodeURIComponent(p).replace(/\./g, '%2E');
}
