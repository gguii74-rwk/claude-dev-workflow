#!/usr/bin/env node
// orchestrate.mjs — orchestrate 스킬의 오르카 상세가 사는 유일한 곳(spec §3w · D3).
//   watch <핸들> [최대초=580] [--consumed <표지 줄>] [--environment <이름>]
//   alive <핸들> [--environment <이름>]
//   key   <핸들> <enter|tab|shift-tab|up|down|text <문자열>>... [--environment <이름>]
// 오르카 응답 필드가 바뀌면 자가 점검이 exit 2로 멈춘다 — 조용히 빈 결과로 진행하지 않는다(D6).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// ── 화면 판독 상수 — Claude Code TUI·오르카 문자열은 버전 의존(검증 필요(실측)). 갱신은 이 자리 1곳.
const DONE_MARK = '[TRACK-DONE ';
const HANDOFF_MARK = '[TRACK-HANDOFF ';
const QUESTION_PATTERNS = ['Enter to select', 'to navigate'];
const PERMISSION_PATTERNS = ['could not be checked', 'Do you want to proceed', "Yes, and don't ask again"];
const SEPARATOR = '────';                       // 프롬프트 박스 위·아래 구분선
const PROMPT_CHAR = '❯';                        // 프롬프트 박스 안 입력 줄
const SPINNER_PREFIXES = ['✻', '✶', '✳', '✢', '·', '✽', '*'];
const RESPONSE_BULLETS = /^[\s⏺●]+/;            // 응답 첫 줄 글머리표 — 표지 비교 전에 뗀다
const CLAUDE_EXIT_MARK = 'Resume this session with';
const SHELL_PROMPT_RE = /[%$#>]\s*$/;
const HUD_MARK = '│';                           // 박스 아래 상태줄(HUD) 구분자 — 같은 끝 문자(%)를 쓰는 셸 프롬프트와 가른다
const STALE_CODE = 'terminal_handle_stale';
const TIMEOUT_CODE = 'timeout';
const KEYS = { tab: '\t', 'shift-tab': '\x1b[Z', up: '\x1b[A', down: '\x1b[B' };

// ── 동작 상수 (M5) — 간격·호출 상한 환경변수는 테스트 전용
const INTERVAL_MS = Number(process.env.ORCHESTRATE_INTERVAL_MS) || 20000;
const CALL_TIMEOUT_MS = Number(process.env.ORCHESTRATE_CALL_TIMEOUT_MS) || 8000; // 오르카 호출 1회 상한 — 멈춘 CLI가 watch 상한을 무력화하지 않게
const DEFAULT_MAX_SECONDS = 580;
const IDLE_TIMEOUT_MS = 1500;
const OUTPUT_LINES = 70;
const KEY_GAP_MS = 300;

class Fail extends Error {}

// CLI 해소 = 훅 (2-0)ⓐ와 같은 규칙(M4)
function resolveCli() {
  if (process.env.ORCA_CLI_COMMAND) return process.env.ORCA_CLI_COMMAND;
  return process.env.ORCA_DEV_REPO_ROOT ? 'orca-dev' : 'orca';
}

function formatFail(missing) {
  return `orca 응답 형식이 스크립트와 다릅니다 — \`orca skills get orca-cli\`를 참조해 scripts/orchestrate.mjs의 필드명을 갱신하세요(필드: ${missing})`;
}

// 오르카는 실패(timeout·stale)에도 JSON을 stdout에 쓰고 exit 1을 낸다 → exit code가 아니라 JSON으로 판단한다.
// 응답하지 않는 호출은 CALL_TIMEOUT_MS에서 SIGKILL로 끊고 ERR(r.error = ETIMEDOUT)로 멈춘다 — SIGTERM은 무시하는 CLI가 있으면 상한이 무력해진다.
function orca(env, args) {
  const full = [...args, '--json', ...(env ? ['--environment', env] : [])];
  const r = spawnSync(resolveCli(), full, { encoding: 'utf8', timeout: CALL_TIMEOUT_MS, killSignal: 'SIGKILL' });
  if (r.error) throw new Fail(`orca 실행 실패: ${r.error.message}`);
  let res;
  try {
    res = JSON.parse(r.stdout);
  } catch {
    throw new Fail(formatFail('JSON 응답'));
  }
  // 루트가 객체가 아니면(null·숫자·배열) 형식 이탈 — 필드 접근 TypeError로 새지 않게 여기서 멈춘다
  if (res === null || typeof res !== 'object' || Array.isArray(res)) throw new Fail(formatFail('JSON 응답 객체'));
  return res;
}

function readScreen(env, handle) {
  const res = orca(env, ['terminal', 'read', '--terminal', handle, '--screen']);
  if (res.ok === false) {
    if (res.error?.code === STALE_CODE) return { stale: true };
    throw new Fail(`terminal read 실패: ${res.error?.code ?? '알 수 없음'}`);
  }
  const t = res.result?.terminal;
  if (!Array.isArray(t?.tail)) throw new Fail(formatFail('result.terminal.tail'));
  if (t.source !== 'screen') {
    throw new Fail(`렌더링 화면을 읽지 못했다(source=${t.source ?? '없음'}) — 종료로 보지 않는다`);
  }
  return { lines: t.tail.map((l) => String(l).replace(/\s+$/, '')) };
}

function idle(env, handle) {
  const res = orca(env, ['terminal', 'wait', '--terminal', handle, '--for', 'tui-idle', '--timeout-ms', String(IDLE_TIMEOUT_MS)]);
  if (res.ok === false && res.error?.code === TIMEOUT_CODE) return false;
  const s = res.result?.wait?.satisfied;
  if (typeof s !== 'boolean') throw new Fail(formatFail('result.wait.satisfied'));
  return s;
}

function separatorIndexes(lines) {
  return lines.flatMap((l, i) => (l.startsWith(SEPARATOR) ? [i] : []));
}

// 본문 = 프롬프트 박스 위 줄들(박스가 없으면 화면 전체) − 스피너·타이머 줄
function bodyLines(lines) {
  const seps = separatorIndexes(lines);
  const top = seps.length >= 2 ? seps[seps.length - 2] : lines.length;
  return lines.slice(0, top).filter((l) => !SPINNER_PREFIXES.some((p) => l.trimStart().startsWith(p)));
}

function hash(lines) {
  return createHash('sha256').update(lines.join('\n')).digest('hex');
}

function normalizeMarker(line) {
  return line.replace(RESPONSE_BULLETS, '').trim();
}

function lastNonEmpty(lines) {
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) return { line: lines[i], index: i };
  return { line: '', index: -1 };
}

// 맨 아래 창 문구 줄의 위치·종류 — 열린 창은 맨 아래에 그려지고 본문에 인용된 문구는 그 위다(R3-1). 한 줄에 둘 다면 권한
function bottomDialog(lines) {
  let index = -1;
  let kind = null;
  lines.forEach((l, i) => {
    if (PERMISSION_PATTERNS.some((p) => l.includes(p))) [index, kind] = [i, 'PERMISSION'];
    else if (QUESTION_PATTERNS.some((p) => l.includes(p))) [index, kind] = [i, 'QUESTION'];
  });
  return { index, kind };
}

// 표지는 본문의 마지막 비어 있지 않은 줄일 때만 인정 · --consumed와 같은 표지는 본문이 바뀌기 전까지 소비된 것(D41)
function classify(lines, consumed, changed) {
  const last = normalizeMarker(lastNonEmpty(bodyLines(lines)).line);
  const isMarker = last.startsWith(DONE_MARK) || last.startsWith(HANDOFF_MARK);
  if (isMarker && !(consumed !== null && last === normalizeMarker(consumed) && !changed)) {
    return { verdict: last.startsWith(DONE_MARK) ? 'DONE' : 'HANDOFF', marker: last };
  }
  // 질문·권한 = 맨 아래 창 문구의 종류(alive와 같은 규칙) — 화면 전체에서 질문 문구를 먼저 찾으면 본문 인용 아래 실제 권한 창이 QUESTION이 된다(D23)
  const { kind } = bottomDialog(lines);
  return kind ? { verdict: kind } : null;
}

function emit(verdict, lines, marker) {
  const out = [verdict];
  if (marker) out.push(marker);
  out.push(...lines.slice(-OUTPUT_LINES));
  process.stdout.write(out.join('\n') + '\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function watch(handle, maxSeconds, consumed, env) {
  const deadline = Date.now() + maxSeconds * 1000; // 시작 자가 점검부터 상한에 넣는다
  const first = readScreen(env, handle);
  if (first.stale) throw new Fail(`핸들이 stale이다(${STALE_CODE}) — alive로 확인하라`);
  idle(env, handle); // 자가 점검 — idle 플래그 존재 확인
  let lines = first.lines;
  const startHash = hash(bodyLines(lines));
  let last = startHash;
  let changed = false;
  let v = classify(lines, consumed, changed); // 감시 시작 전 도착한 미처리 표지·열린 질문은 즉시
  if (v) return emit(v.verdict, lines, v.marker);
  while (Date.now() < deadline) {
    await sleep(Math.min(INTERVAL_MS, Math.max(0, deadline - Date.now())));
    const r = readScreen(env, handle);
    if (r.stale) throw new Fail(`핸들이 stale이다(${STALE_CODE}) — alive로 확인하라`);
    lines = r.lines;
    const cur = hash(bodyLines(lines));
    if (cur !== startHash) changed = true;
    v = classify(lines, consumed, changed);
    if (v) return emit(v.verdict, lines, v.marker);
    // 「변화 없음 + idle」은 SETTLED가 아니다(f1) — 바뀐 뒤 안정 + idle만
    if (changed && cur === last && idle(env, handle)) return emit('SETTLED', lines);
    last = cur;
  }
  emit('TIMEOUT', lines);
}

// exit 0 생존 · 1 종료(미연결·고아·셸만 남음) · 2 판독 불가/ERR · 3 stale — 조건은 상호 배타(spec §3w)
function alive(handle, env) {
  const res = orca(env, ['terminal', 'show', '--terminal', handle]);
  if (res.ok === false) {
    if (res.error?.code === STALE_CODE) return [3, `STALE 핸들이 바뀌었다(${STALE_CODE}) — 종료가 아니다, 식별 규칙으로 재획득`];
    throw new Fail(`terminal show 실패: ${res.error?.code ?? '알 수 없음'}`);
  }
  const t = res.result?.terminal;
  const missing = ['connected', 'writable', 'orphaned'].filter((k) => typeof t?.[k] !== 'boolean');
  if (missing.length) throw new Fail(formatFail(missing.map((k) => `result.terminal.${k}`).join(', ')));
  if (!t.connected || t.orphaned) return [1, `EXITED 터미널 미연결 또는 고아(connected=${t.connected}, orphaned=${t.orphaned})`];
  if (!t.writable) return [2, 'UNREADABLE 쓰기 불가 — 종료로 보지 않는다'];
  const r = readScreen(env, handle);
  if (r.stale) return [3, `STALE 핸들이 바뀌었다(${STALE_CODE}) — 종료가 아니다, 식별 규칙으로 재획득`];
  const lines = r.lines;
  const seps = separatorIndexes(lines);
  const lastSep = seps.length ? seps[seps.length - 1] : -1;
  let exitIdx = -1;
  lines.forEach((l, i) => { if (l.includes(CLAUDE_EXIT_MARK)) exitIdx = i; });
  const tail = lastNonEmpty(lines);
  // 종료 표지 = 마지막 구분선 아래의 「Resume this session with」(대화 본문 속 인용은 박스 위라 제외) + 그 뒤 셸 프롬프트 복귀
  const exitBelowBox = exitIdx > lastSep;
  if (exitBelowBox && tail.index > exitIdx && SHELL_PROMPT_RE.test(tail.line)) {
    return [1, 'EXITED claude 종료 표지와 셸 프롬프트 복귀 — 셸만 남음'];
  }
  // 종료 안내 없이 셸로 돌아간 잔존 화면(SIGKILL 등)은 생존으로 보지 않는다 — 입력 요소 뒤 마지막 줄이 셸 프롬프트 모양이면 제외
  //   박스: 박스 아래 마지막 줄이 셸 프롬프트 모양 + HUD 구분자 없음 / 질문·권한 창: 창 문구 뒤 마지막 줄이 셸 프롬프트 모양
  // 창 종류 = 화면 맨 아래 창 문구의 종류 — 열린 창은 맨 아래에 그려지고 본문에 인용된 문구는 그 위다(R3-1)
  const { index: dialogIdx, kind: dialogVerdict } = bottomDialog(lines);
  const dialogKind = dialogVerdict === 'PERMISSION' ? '권한 창' : '질문 창';
  // 박스도 같은 원리 — 창 문구가 마지막 구분선보다 아래면 창이 활성 입력 요소이고 위의 박스는 본문 인용·잔존이다(R4-1)
  const box = seps.length >= 2 && lines.slice(seps[seps.length - 2] + 1, lastSep).some((l) => l.trimStart().startsWith(PROMPT_CHAR))
    && !(dialogIdx > lastSep)
    && !(tail.index > lastSep && SHELL_PROMPT_RE.test(tail.line) && !tail.line.includes(HUD_MARK));
  const dialog = dialogIdx >= 0 && !(tail.index > dialogIdx && SHELL_PROMPT_RE.test(tail.line));
  // 화면 종류 = key가 묶음 전송 중 변화를 잡는 기준(R2-2)
  const kind = box ? '프롬프트 박스' : dialogKind;
  if ((box || dialog) && !exitBelowBox) return [0, `ALIVE claude 입력 상태(${kind})`, kind];
  return [2, 'UNREADABLE 생존·종료 어느 쪽도 확정할 수 없다 — 종료로 보지 않는다'];
}

async function key(handle, keys, env) {
  let sent = 0;
  let firstKind = null;
  for (const k of keys) {
    // 키마다 전송 직전 생존 확인(spec §3o ③(a)) — 묶음 키 사이에 claude가 끝나면 나머지가 셸로 들어간다
    let code, line, kind;
    try {
      [code, line, kind] = alive(handle, env);
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      [code, line] = [2, `ERR ${e.message}`];
    }
    if (code !== 0) throw new Fail(`전송 중단 — ${sent}/${keys.length}개 보낸 뒤 생존 확인 실패: ${line}`);
    // 첫 키 때의 화면 종류가 바뀌면 멈춘다 — 사용자가 직접 답해 다음 창(권한 창 등)이 떴을 수 있다(D16·D23)
    firstKind ??= kind;
    if (kind !== firstKind) throw new Fail(`전송 중단 — ${sent}/${keys.length}개 보낸 뒤 화면 종류가 바뀌었다(${firstKind} → ${kind}) — 화면을 다시 읽고 판단하라`);
    const args = ['terminal', 'send', '--terminal', handle];
    if (k.text !== undefined) args.push('--text', k.text); // argv 직접 전달 — 셸 보간 없음
    else if (k.name === 'enter') args.push('--enter');
    else args.push('--text', KEYS[k.name]);
    const res = orca(env, args);
    if (res.result?.send?.accepted !== true) throw new Fail(`키 전송이 수락되지 않았다(${k.name ?? 'text'}): ${res.error?.code ?? formatFail('result.send.accepted')}`);
    sent++;
    await sleep(KEY_GAP_MS);
  }
  process.stdout.write(`SENT ${keys.length}\n`);
}

function parse(argv) {
  const [cmd, handle, ...rest] = argv;
  const opts = { env: null, consumed: null, positional: [], keys: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--environment') opts.env = rest[++i];
    else if (a === '--consumed' && cmd === 'watch') opts.consumed = rest[++i];
    else if (cmd === 'key' && a === 'text') {
      if (i + 1 >= rest.length) throw new Fail('usage: text 뒤에 문자열이 필요하다');
      opts.keys.push({ text: rest[++i] });
    } else if (cmd === 'key' && (a === 'enter' || a in KEYS)) opts.keys.push({ name: a });
    else if (cmd === 'key') throw new Fail(`usage: 알 수 없는 키 ${a}`);
    else opts.positional.push(a);
  }
  if (!handle || handle.startsWith('--')) throw new Fail('usage: orchestrate.mjs <watch|alive|key> <핸들> …');
  return { cmd, handle, ...opts };
}

async function main() {
  try {
    const a = parse(process.argv.slice(2));
    if (a.cmd === 'watch') {
      const max = a.positional.length ? Number(a.positional[0]) : DEFAULT_MAX_SECONDS;
      if (!(max > 0)) throw new Fail('usage: 최대초는 양수');
      await watch(a.handle, max, a.consumed, a.env);
    } else if (a.cmd === 'alive') {
      const [code, line] = alive(a.handle, a.env);
      process.stdout.write(line + '\n');
      process.exitCode = code;
    } else if (a.cmd === 'key') {
      if (!a.keys.length) throw new Fail('usage: 키가 하나 이상 필요하다');
      await key(a.handle, a.keys, a.env);
    } else {
      throw new Fail('usage: orchestrate.mjs <watch|alive|key> <핸들> …');
    }
  } catch (e) {
    // 예기치 않은 예외도 ERR exit 2 — 그대로 던지면 node가 exit 1로 끝나 alive의 「종료」로 오판된다(→ 중복 재개)
    process.stdout.write(`ERR ${e instanceof Fail ? e.message : `예기치 않은 오류: ${e?.message ?? e}`}\n`);
    process.exitCode = 2;
  }
}

main();
