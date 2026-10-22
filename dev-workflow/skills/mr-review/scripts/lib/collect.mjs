// collect.mjs — spec §5.1-1~3. MR 수집 → mr.json, 스냅샷 고정(세 SHA·워크트리) 또는 diff-only 복원 → snapshot.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { apiJson, apiRaw, encodePath } from './gitlab.mjs';

export class CollectError extends Error {
  constructor(message, code = 2) { super(message); this.code = code; }
}

const MAX_ATTEMPTS = 3;
const MAX_BUFFER = 512 * 1024 * 1024;

function git(cwd, args, { allowFail = false } = {}) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: MAX_BUFFER });
  if (r.status !== 0) {
    if (allowFail) return null;
    throw new CollectError(`git ${args.join(' ')} 실패(${cwd}): ${(r.stderr || '').trim().slice(0, 300)}`);
  }
  return r.stdout.trim();
}

export function isGitDir(p) {
  if (!p || !fs.existsSync(p)) return false;
  return spawnSync('git', ['-C', p, 'rev-parse', '--git-dir'], { encoding: 'utf8' }).status === 0;
}

// §5.1-1 — 메타·diff·overflow·댓글(system 포함)·연결 이슈·버전·승인.
// 보조 조회의 실패는 빈 응답이 아니다(R3-3) — `api_failures` 에 남겨 verdict 가 결정적 증거 부족으로 받는다. overflow 는 /changes 실패 시 null(모름 — fail-closed).
export function fetchMr(projectId, iid) {
  const base = `projects/${projectId}/merge_requests/${iid}`;
  const failures = [];
  const meta = apiJson(base);
  const diffs = apiJson(`${base}/diffs?per_page=100`, { paginate: true });
  let overflow = null;
  try { overflow = apiJson(`${base}/changes`)?.overflow === true; } catch { failures.push('changes'); }
  const notes = apiJson(`${base}/notes?per_page=100&sort=asc&order_by=created_at`, { paginate: true });
  let closes = [];
  try { closes = apiJson(`${base}/closes_issues?per_page=100`, { paginate: true }); } catch { failures.push('closes_issues'); }
  let versions = [];
  try { versions = apiJson(`${base}/versions`); } catch { failures.push('versions'); }
  let approvals = null;
  try { approvals = apiJson(`${base}/approvals`); } catch { failures.push('approvals'); }
  return { meta, diffs: Array.isArray(diffs) ? diffs : [], overflow, notes: Array.isArray(notes) ? notes : [], closes: Array.isArray(closes) ? closes : [], versions: Array.isArray(versions) ? versions : [], approvals, api_failures: failures };
}

export function normalize(project, projectName, iid, raw, collectedAt) {
  const m = raw.meta;
  const diffs = raw.diffs.map((d) => ({
    old_path: d.old_path, new_path: d.new_path,
    new_file: d.new_file === true, renamed_file: d.renamed_file === true, deleted_file: d.deleted_file === true,
    too_large: d.too_large === true || (raw.overflow !== false && !d.diff),   // overflow 를 모르면(null) 빈 diff 는 잘림으로 본다
    diff: d.diff || '',
  }));
  const notes = raw.notes.map((n) => ({ id: n.id, system: n.system === true, author: { id: n.author?.id ?? null, username: n.author?.username ?? '' }, created_at: n.created_at, body: n.body || '' }));
  const descChanged = notes.filter((n) => n.system && /^changed the description/.test(n.body)).map((n) => n.created_at).sort().pop() || null;
  return {
    project: { name: projectName, id: project.id, checkout: project.checkout, deployExempt: project.deployExempt === true },
    iid: Number(iid), title: m.title || '', description: m.description || '', state: m.state || '', updated_at: m.updated_at || null, web_url: m.web_url || '',
    author: { id: m.author?.id ?? null, username: m.author?.username ?? '' },
    reviewers: (m.reviewers || []).map((r) => ({ id: r.id, username: r.username })),
    source_branch: m.source_branch || '', target_branch: m.target_branch || '', api_head: m.sha || '', changes_count: m.changes_count == null ? null : String(m.changes_count),
    diff_refs: m.diff_refs ? { base_sha: m.diff_refs.base_sha, head_sha: m.diff_refs.head_sha, start_sha: m.diff_refs.start_sha } : null,
    detailed_merge_status: m.detailed_merge_status || '', has_conflicts: m.has_conflicts === true,
    approved_by: (raw.approvals?.approved_by || []).map((a) => a.user?.username).filter(Boolean),
    diffs, overflow: raw.overflow === true ? true : raw.overflow === false ? false : null, api_failures: raw.api_failures || [], notes, description_changed_at: descChanged,
    closes_issues: raw.closes.map((i) => ({ iid: i.iid, project_id: i.project_id, title: i.title || '', description: i.description || '', updated_at: i.updated_at || null, web_url: i.web_url || '' })),
    versions: raw.versions.map((v) => ({ head_commit_sha: v.head_commit_sha, base_commit_sha: v.base_commit_sha, start_commit_sha: v.start_commit_sha })),
    collected_at: collectedAt,
  };
}

// §5.1-2 — target·MR head fetch → API head 일치 확인 → 세 SHA 고정 → 임시 워크트리(기존 잔존물 제거)
// base(1.3.1 ② — spec 2026-10-22 3.②) = GitLab 이 기록한 MR diff 의 base(versions[0] → diff_refs) — 머지된 MR 은 target 이 head 를 품어 merge-base 가 head 자신이 된다.
// API base 가 head 의 조상이 아니면 ERR(fail-closed), 둘 다 없을 때만 merge-base 로 폴백한다. 판정·diff 는 워크트리를 만들기 전에 끝낸다(ERR 때 워크트리를 남기지 않는다).
export function pinWorktree(checkout, mr, work) {
  git(checkout, ['fetch', '-q', 'origin', mr.target_branch]);
  git(checkout, ['fetch', '-q', 'origin', `+refs/merge-requests/${mr.iid}/head:refs/mr-review/${mr.iid}/head`]);
  const head = git(checkout, ['rev-parse', `refs/mr-review/${mr.iid}/head`]);
  if (head !== mr.api_head) return null;
  const target = git(checkout, ['rev-parse', `origin/${mr.target_branch}`]);
  const apiBase = mr.versions[0]?.base_commit_sha || mr.diff_refs?.base_sha || null;
  let base;
  if (apiBase) {
    const present = spawnSync('git', ['-C', checkout, 'cat-file', '-e', `${apiBase}^{commit}`]).status === 0;
    if (!present || spawnSync('git', ['-C', checkout, 'merge-base', '--is-ancestor', apiBase, head]).status !== 0) {
      if (git(checkout, ['rev-parse', '--is-shallow-repository'], { allowFail: true }) === 'true') throw new CollectError(`BASE_MISMATCH — 얕은 clone(shallow)이라 base ${apiBase.slice(0, 7)}${present ? '와 head 사이 이력이' : '가'} 로컬에 없다. 체크아웃에서 git fetch --unshallow 뒤 다시 실행`);   // base 객체가 있어도 shallow 경계로 이력이 끊기면 조상 확인이 실패한다(R2-1)
      throw new CollectError(`BASE_MISMATCH — API base ${apiBase.slice(0, 7)}가 head ${head.slice(0, 7)}의 조상이 아니다`);
    }
    base = apiBase;
  } else {
    base = git(checkout, ['merge-base', target, head]);
  }
  const diffs = gitDiffs(checkout, base, head);
  if (diffs.length === 0 && mr.diffs.length > 0) throw new CollectError(`DIFF_EMPTY_MISMATCH — git diff 0건 ≠ API 변경 ${mr.diffs.length}건(base 산정 오류 의심)`);
  const worktree = path.join(work, 'worktree');
  if (fs.existsSync(worktree)) {
    git(checkout, ['worktree', 'remove', '--force', worktree], { allowFail: true });
    fs.rmSync(worktree, { recursive: true, force: true });
  }
  git(checkout, ['worktree', 'prune'], { allowFail: true });
  git(checkout, ['worktree', 'add', '--detach', '-q', worktree, head]);
  return { head, target, base, baseSource: apiBase ? 'api' : 'merge-base', diffs, worktree };
}

// 워크트리 모드의 변경 목록 정본(R3-4) — API 목록은 overflow 로 파일 항목이 통째로 빠질 수 있다. 고정 뒤에는 check(기준선 후보 탐색)·pack(문서 지도)·deploy 가
// 전부 이 git 목록(`--no-renames` — 이름 변경 = 삭제 + 추가, deploy 의 기대 목록과 같은 기준)을 소비한다.
export function gitDiffs(checkout, base, head) {
  const parts = git(checkout, ['diff', '-z', '--no-renames', '--name-status', base, head]).split('\0').filter(Boolean);
  const diffs = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const status = parts[i][0];
    const p = parts[i + 1];
    diffs.push({ old_path: p, new_path: p, new_file: status === 'A', renamed_file: false, deleted_file: status === 'D', too_large: false, diff: git(checkout, ['diff', '--no-renames', base, head, '--', p]) });
  }
  return diffs;
}

// 복원 경로 검증(impl SDD 이월 T02 + R1-3, 사용자 판정 2026-10-22) — API 의 new_path·old_path 는 외부 입력이다. 절대 경로·드라이브(`C:`)·역슬래시·NUL·`..` 성분은
// 거부하고, 해소한 목적지가 복원 루트 안인지 한 번 더 확인한다(Windows 의 `..\` 해소 포함). 밖이면 null → 그 파일은 원문 조회 없이 unrecovered(증거 부족).
export function insideRoot(root, rel) {
  if (typeof rel !== 'string' || !rel || /[\\\0]/.test(rel) || rel.startsWith('/') || /^[A-Za-z]:/.test(rel) || rel.split('/').includes('..')) return null;
  const dest = path.resolve(root, rel);
  const r = path.relative(path.resolve(root), dest);
  return r && r !== '..' && !r.startsWith(`..${path.sep}`) && !path.isAbsolute(r) ? dest : null;
}

// §5.1-3 — diff-only 검토 루트 `blobs/head/` 는 잘림 유무와 무관하게 항상 만든다: 삭제되지 않은 모든 변경 파일의 head 원문을 고정 SHA 로 받는다
// (task-07 의 검토자 cwd·파일 전문 위치). 잘린 diff 는 base·head 양쪽 blob 으로 재구성 — 한쪽만으로는 복원이 아니다(삭제분 누락).
// head 원문 확보 실패도 unrecovered 로 판정에 전달한다(검토자가 전문을 못 읽은 파일 = 증거 부족).
export function rebuildDiffOnly(projectId, mr, work) {
  const head = mr.api_head;
  const base = mr.versions[0]?.base_commit_sha || mr.diff_refs?.base_sha || null;
  const unrecovered = [];
  const rebuilt = [];
  const headRoot = path.join(work, 'blobs', 'head');
  fs.rmSync(path.join(work, 'blobs'), { recursive: true, force: true });   // 이전 실행의 blob 잔존물 제거
  fs.mkdirSync(headRoot, { recursive: true });
  const emptyFile = path.join(work, 'blobs', 'empty');
  fs.writeFileSync(emptyFile, '');
  for (const d of mr.diffs) {
    const label = d.new_path || d.old_path;
    const hfile = insideRoot(headRoot, d.new_path || d.old_path);
    if (!d.deleted_file) {
      if (!hfile) { unrecovered.push(label); continue; }
      try {
        fs.mkdirSync(path.dirname(hfile), { recursive: true });
        fs.writeFileSync(hfile, apiRaw(`projects/${projectId}/repository/files/${encodePath(d.new_path)}/raw?ref=${head}`));
      } catch {
        unrecovered.push(label);
        continue;
      }
    }
    if (!d.too_large) continue;
    if (!base) { unrecovered.push(label); continue; }
    try {
      const bfile = insideRoot(path.join(work, 'blobs', 'base'), d.old_path);
      if (!d.new_file) {
        if (!bfile) throw new Error(`복원 루트 밖 경로: ${d.old_path}`);
        fs.mkdirSync(path.dirname(bfile), { recursive: true });
        fs.writeFileSync(bfile, apiRaw(`projects/${projectId}/repository/files/${encodePath(d.old_path)}/raw?ref=${base}`));
      }
      const a = d.new_file ? emptyFile : bfile;
      const b = d.deleted_file ? emptyFile : hfile;
      const r = spawnSync('git', ['diff', '--no-index', '--', a, b], { encoding: 'utf8', maxBuffer: MAX_BUFFER });
      if (r.status !== 0 && r.status !== 1) throw new Error((r.stderr || '').trim());
      d.diff = r.stdout;
      d.too_large = false;
      rebuilt.push(label);
    } catch {
      unrecovered.push(label);
    }
  }
  // 변경 파일 목록 자체의 완전성 — overflow 면 API 가 파일 항목을 통째로 뺄 수 있다. 메타 changes_count("25" 또는 "25+")와 수신 항목 수를 대조해
  // 못 맞추면(모르면) 불완전으로 둔다(fail-closed) → verdict 의 결정적 증거 부족(M-diff-list). 파일별 복원 성공과는 별개다.
  // /changes 조회 실패(overflow null)도 「모름」이라 count 대조로만 완전 판정한다(R3-3).
  const expected = String(mr.changes_count ?? '');
  const n = parseInt(expected, 10);
  const diffListComplete = mr.overflow === false || (Number.isFinite(n) && !expected.endsWith('+') && n <= mr.diffs.length);
  return { head, base, target: base, unrecovered, rebuilt, diffListComplete };
}

// 메타 head 와 diff 버전(versions[0]·diff_refs)의 head 가 다르면 수집 중 push 가 있었다 — 서로 다른 head 의 자료를 한 스냅샷으로 섞지 않는다(R3-2, F6). 워크트리 모드도 같다(1.3.1 D27).
export function diffHeadMismatch(mr) {
  const vHead = mr.versions[0]?.head_commit_sha || null;
  const rHead = mr.diff_refs?.head_sha || null;
  if (vHead && vHead !== mr.api_head) return vHead;
  if (rHead && rHead !== mr.api_head) return rHead;
  return null;
}

export function collect({ adapter, projectName, iid, work, diffOnly = false }) {
  const project = adapter.resolved.projects[projectName];
  if (!project) throw new CollectError(`어댑터에 없는 프로젝트: ${projectName} (있는 것: ${Object.keys(adapter.resolved.projects).join(', ')})`);
  if (!/^\d+$/.test(String(iid))) throw new CollectError(`--iid 는 정수여야 한다: ${iid}`);
  fs.mkdirSync(work, { recursive: true });
  // 새 수집 = 이전 실행의 검사·팩·검토·판정 산출물 전부 무효화 — 같은 work 를 다시 쓸 때 옛 verdict.json·findings.json 이 render 에 읽히지 않게 한다
  for (const f of ['check.json', 'deploy.json', 'pack.json', 'pack-a.md', 'pack-b.md', 'review-claude.json', 'review-codex.json', 'findings.json', 'verdict.json']) fs.rmSync(path.join(work, f), { force: true });
  fs.rmSync(path.join(work, 'baseline'), { recursive: true, force: true });
  const useWorktree = !diffOnly && isGitDir(project.checkout);
  let mr = null;
  let snapshot = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const raw = fetchMr(project.id, iid);
    mr = normalize(project, projectName, iid, raw, new Date().toISOString());
    if (!mr.api_head) throw new CollectError('MR 메타에 head SHA(sha)가 없다');
    // 받은 MR 이 어댑터 호스트의 것인지(impl R2-4) — web_url 호스트가 다르거나 없으면 다른 서버의 같은 번호 MR 일 수 있다
    const urlHost = (mr.web_url.match(/^https?:\/\/([^/]+)/) || [])[1] || '';
    if (urlHost.toLowerCase() !== String(adapter.gitlab.host).toLowerCase()) throw new CollectError(`MR web_url 호스트(${urlHost || '없음'})가 어댑터 gitlab.host(${adapter.gitlab.host})와 다르다 — 다른 GitLab 서버의 MR 일 수 있어 멈춘다`);
    const fetchedAt = new Date().toISOString();
    if (useWorktree) {
      const moved = diffHeadMismatch(mr);
      if (moved) {
        if (attempt === MAX_ATTEMPTS) throw new CollectError(`HEAD_MOVED — ${MAX_ATTEMPTS}회 재수집에도 API head(${mr.api_head.slice(0, 7)})와 diff 버전 head(${moved.slice(0, 7)})가 다르다(push 진행 중?)`, 3);
        continue;
      }
      const pin = pinWorktree(project.checkout, mr, work);
      if (!pin) {
        if (attempt === MAX_ATTEMPTS) throw new CollectError(`HEAD_MOVED — ${MAX_ATTEMPTS}회 재수집에도 API head(${mr.api_head.slice(0, 7)})와 fetch head 가 다르다(push 진행 중?)`, 3);
        continue;
      }
      mr.diffs = pin.diffs;   // API 목록 → git 정본으로 교체(R3-4). overflow 는 더 이상 의미 없다
      mr.overflow = false;
      snapshot = { mode: 'worktree', target_sha: pin.target, base_sha: pin.base, base_source: pin.baseSource, head_sha: pin.head, checkout: project.checkout, worktree: pin.worktree, attempts: attempt, unrecovered: [], rebuilt: [], diff_list_complete: true, api_failures: mr.api_failures, fetched_at: fetchedAt };
    } else {
      const moved = diffHeadMismatch(mr);
      if (moved) {
        if (attempt === MAX_ATTEMPTS) throw new CollectError(`HEAD_MOVED — ${MAX_ATTEMPTS}회 재수집에도 API head(${mr.api_head.slice(0, 7)})와 diff 버전 head(${moved.slice(0, 7)})가 다르다(push 진행 중?)`, 3);
        continue;
      }
      const rb = rebuildDiffOnly(project.id, mr, work);
      snapshot = { mode: 'diff-only', target_sha: rb.target, base_sha: rb.base, base_source: rb.base ? 'api' : null, head_sha: rb.head, checkout: isGitDir(project.checkout) ? project.checkout : null, worktree: null, attempts: attempt, unrecovered: rb.unrecovered, rebuilt: rb.rebuilt, diff_list_complete: rb.diffListComplete, api_failures: mr.api_failures, fetched_at: fetchedAt };
    }
    break;
  }
  fs.writeFileSync(path.join(work, 'mr.json'), JSON.stringify(mr, null, 2));
  fs.writeFileSync(path.join(work, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
  return { mr, snapshot };
}

const s7 = (s) => (s ? String(s).slice(0, 7) : '-');

export async function cmdCollect(args, ctx) {
  if (!args.project || !args.iid) throw new CollectError('--project <이름> --iid <n> 이 필요하다');
  const { snapshot } = collect({ adapter: ctx.adapter, projectName: args.project, iid: args.iid, work: ctx.work, diffOnly: args['diff-only'] === true });
  return `COLLECTED ${snapshot.mode} head=${s7(snapshot.head_sha)} base=${s7(snapshot.base_sha)} target=${s7(snapshot.target_sha)} attempts=${snapshot.attempts} unrecovered=${snapshot.unrecovered.length}`;
}
