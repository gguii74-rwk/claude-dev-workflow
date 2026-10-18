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
const QUESTION_PATTERNS = ['Enter to select', 'to navigate', 'Ready to submit your answers?'];  // 마지막 = 묶음 질문 최종 제출 화면(꼬리말 없음, claude 2.1.302 — impl R5-1)
const PERMISSION_PATTERNS = ['could not be checked', 'Do you want to ', "Yes, and don't ask again", 'Yes, allow '];  // 'Do you want to ' = proceed·make this edit·create·overwrite·allow 권한 창 전체 — 좁으면 diff 미리보기의 질문 꼬리말 문구에 질문 창으로 오판돼 enter가 권한을 승인한다(D23)
const SEPARATOR = '────';                       // 프롬프트 박스 위·아래 구분선
const PROMPT_CHAR = '❯';                        // 프롬프트 박스 안 입력 줄
const OPTION_ROW_RE = /^❯\s*\d+\./;             // 창의 번호 선택 줄(「❯ 1. Yes」) — 입력 줄이 아니다
const SPINNER_PREFIXES = ['✻', '✶', '✳', '✢', '·', '✽', '*'];
const RESPONSE_BULLETS = /^[\s⏺●]+/;            // 응답 첫 줄 글머리표 — 표지 비교 전에 뗀다
const CLAUDE_EXIT_MARK = 'Resume this session with';
const SHELL_PROMPT_RE = /[%$#>❯]\s*$/;            // 끝 문자 — ❯ = pure·starship 등(impl R3-1)
const SHELL_PROMPT_START_RE = /^\s*➜/;           // 첫 문자 — oh-my-zsh 기본 테마(impl R3-1)
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
const WRAP_ROWS = 3;                            // 접힌 표지를 이어 붙일 최대 줄 수(impl R2-1)

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
  const cli = resolveCli();
  const r = spawnSync(cli, full, { encoding: 'utf8', timeout: CALL_TIMEOUT_MS, killSignal: 'SIGKILL' });
  // 미설치(ENOENT)는 기동 전·운영 중 두 갈래를 한 문구로 안내한다(D11) — 그 밖(ETIMEDOUT 등)은 현행 문구
  if (r.error?.code === 'ENOENT') throw new Fail(`오르카 CLI 없음(${cli}) — 트랙 기동 전이면 단일 세션으로 진행 · 트랙이 떠 있으면 CLI 해소(ORCA_CLI_COMMAND·PATH)를 고쳐 재시도(복구·재생성 금지)`);
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
// 박스 = inputElements의 실제 입력 상자뿐 — 구분선 사이에 그려진 열린 창을 경계로 자르면 창이 사라져 그 위 표지가 DONE/HANDOFF로 읽힌다(impl R1-1)
function bodyLines(lines) {
  const seps = separatorIndexes(lines);
  const top = inputElements(lines).box ? seps[seps.length - 2] : lines.length;
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

// 활성 입력 요소 = 화면 맨 아래 요소 — 창 문구가 박스(마지막 두 구분선 사이 ❯ 입력 줄 — 번호 선택 줄 제외) 윗선보다 위일 때만 본문 인용이고, 박스 안·아래면 열린 창이다(R3-1·R4-1 · 권한 창은 닫힌 쪽으로, D23). watch·alive 공용
function inputElements(lines) {
  const seps = separatorIndexes(lines);
  const lastSep = seps.length ? seps[seps.length - 1] : -1;
  const topSep = seps.length >= 2 ? seps[seps.length - 2] : -1;
  const box = topSep >= 0 && lines.slice(topSep + 1, lastSep).some((l) => l.trimStart().startsWith(PROMPT_CHAR) && !OPTION_ROW_RE.test(l.trimStart()));
  const d = bottomDialog(lines);
  const open = d.index >= 0 && !(box && d.index < topSep);
  return { lastSep, box: box && !open, dialogIdx: open ? d.index : -1, dialogKind: open ? d.kind : null };
}

// 셸 프롬프트 모양 = 끝 문자 + HUD 구분자 없음 — 같은 끝 문자(%)를 쓰는 상태줄(HUD)을 셸로 보지 않는다(R2-1). 박스·창·종료 판정 공용
function isShellPrompt(line) {
  return (SHELL_PROMPT_RE.test(line) || SHELL_PROMPT_START_RE.test(line)) && !line.includes(HUD_MARK);
}

// 화면 폭에서 접힌 긴 표지(경로) — Claude Code는 줄을 직접 끊어 그려 오르카의 줄바꿈 표시(tailRows.wrapped)가 서지 않는다(impl R2-1).
// 표지 줄(닫는 `]` 없음) 아래 공백 없는 이어진 줄(최대 WRAP_ROWS)을 붙여 `]`로 끝날 때만 한 표지로 본다.
// 표지는 닫힌 것만(`]`로 끝나고 접두 뒤 내용 있음) — 아직 출력 중인 표지를 받으면 응답 중인 세션을 끝내거나 잘린 경로로 재개한다(impl R3-2). 없으면 null
function lastMarker(body) {
  const { line, index } = lastNonEmpty(body);
  const last = normalizeMarker(line);
  const isHead = (s) => s.startsWith(DONE_MARK) || s.startsWith(HANDOFF_MARK);
  const closed = (s) => (s.endsWith(']') && s.slice(s.indexOf(' ') + 1, -1).trim() ? s : null);
  if (isHead(last)) return closed(last);
  for (let i = index - 1; i >= 0 && index - i <= WRAP_ROWS; i--) {
    const head = normalizeMarker(body[i]);
    if (!isHead(head)) continue;
    const rest = body.slice(i + 1, index + 1).map((l) => l.trim());
    if (head.includes(']') || rest.some((r) => !r || /\s/.test(r) || isHead(r))) return null;
    return closed(head + rest.join(''));
  }
  return null;
}

// 표지는 본문의 마지막 비어 있지 않은 줄일 때만 인정(접힌 표지는 이어 붙인 한 줄) · --consumed와 같은 표지는 본문이 바뀌기 전까지 소비된 것(D41)
function classify(lines, consumed, changed) {
  const last = lastMarker(bodyLines(lines));
  if (last && !(consumed !== null && last === normalizeMarker(consumed) && !changed)) {
    return { verdict: last.startsWith(DONE_MARK) ? 'DONE' : 'HANDOFF', marker: last };
  }
  // 질문·권한 = 열린 창(맨 아래 창 문구가 박스보다 아래)의 종류 — alive와 같은 공용 헬퍼. 화면 전체에서 질문 문구를 먼저 찾으면 본문 인용 아래 실제 권한 창이 QUESTION이 된다(D23)
  const { dialogKind } = inputElements(lines);
  return dialogKind ? { verdict: dialogKind } : null;
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
  const el = inputElements(lines);
  let exitIdx = -1;
  lines.forEach((l, i) => { if (l.includes(CLAUDE_EXIT_MARK)) exitIdx = i; });
  const tail = lastNonEmpty(lines);
  const shellAfter = (i) => tail.index > i && isShellPrompt(tail.line);
  // 종료 표지 = 맨 아래 입력 요소(마지막 구분선·열린 창 문구)보다 아래의 「Resume this session with」(그 위는 본문 인용) + 그 뒤 셸 프롬프트 복귀
  const exitMarked = exitIdx > Math.max(el.lastSep, el.dialogIdx);
  if (exitMarked && shellAfter(exitIdx)) {
    return [1, 'EXITED claude 종료 표지와 셸 프롬프트 복귀 — 셸만 남음'];
  }
  // 종료 안내 없이 셸로 돌아간 잔존 화면(SIGKILL 등)은 생존으로 보지 않는다 — 입력 요소(박스·열린 창) 뒤 마지막 줄이 셸 프롬프트 모양이면 제외
  const box = el.box && !shellAfter(el.lastSep);
  const dialog = el.dialogIdx >= 0 && !shellAfter(el.dialogIdx);
  // 화면 종류 = key가 묶음 전송 중 변화를 잡는 기준(R2-2)
  const kind = box ? '프롬프트 박스' : el.dialogKind === 'PERMISSION' ? '권한 창' : '질문 창';
  // 창 내용 식별값 = 창 문구 줄까지(그 아래 상태줄 제외) − 스피너 줄, 선택 표시 ❯·앞 공백 무시 — 같은 종류의 다른 질문으로 바뀐 것을 key가 잡는다(impl R4-1)
  const content = box ? null : hash(lines.slice(0, el.dialogIdx + 1).filter((l) => !SPINNER_PREFIXES.some((p) => l.trimStart().startsWith(p))).map((l) => l.replace(/^[\s❯]+/, '')));
  if ((box || dialog) && !exitMarked) return [0, `ALIVE claude 입력 상태(${kind})`, kind, content];
  return [2, 'UNREADABLE 생존·종료 어느 쪽도 확정할 수 없다 — 종료로 보지 않는다'];
}

async function key(handle, keys, env) {
  let sent = 0;
  let firstKind = null;
  let base = null; // 창 내용 기준 — tab·shift-tab·enter(의도된 이동·제출) 뒤 다음 키에서 새로 잡는다
  for (const k of keys) {
    // 키마다 전송 직전 생존 확인(spec §3o ③(a)) — 묶음 키 사이에 claude가 끝나면 나머지가 셸로 들어간다
    let code, line, kind, content;
    try {
      [code, line, kind, content] = alive(handle, env);
    } catch (e) {
      if (!(e instanceof Fail)) throw e;
      [code, line] = [2, `ERR ${e.message}`];
    }
    if (code !== 0) throw new Fail(`전송 중단 — ${sent}/${keys.length}개 보낸 뒤 생존 확인 실패: ${line}`);
    // 첫 키 때의 화면 종류가 바뀌면 멈춘다 — 사용자가 직접 답해 다음 창(권한 창 등)이 떴을 수 있다(D16·D23)
    firstKind ??= kind;
    if (kind !== firstKind) throw new Fail(`전송 중단 — ${sent}/${keys.length}개 보낸 뒤 화면 종류가 바뀌었다(${firstKind} → ${kind}) — 화면을 다시 읽고 판단하라`);
    // 같은 종류라도 창 내용이 바뀌면 멈춘다 — 사용자가 직접 답해 다음 질문(감사 이의 등 사람 몫)이 떴을 수 있다(impl R4-1)
    base ??= content;
    if (content !== base) throw new Fail(`전송 중단 — ${sent}/${keys.length}개 보낸 뒤 창 내용이 바뀌었다(같은 ${kind}) — 화면을 다시 읽고 판단하라`);
    const args = ['terminal', 'send', '--terminal', handle];
    if (k.text !== undefined) args.push('--text', k.text); // argv 직접 전달 — 셸 보간 없음
    else if (k.name === 'enter') args.push('--enter');
    else args.push('--text', KEYS[k.name]);
    const res = orca(env, args);
    if (res.result?.send?.accepted !== true) throw new Fail(`키 전송이 수락되지 않았다(${k.name ?? 'text'}): ${res.error?.code ?? formatFail('result.send.accepted')}`);
    sent++;
    if (k.name === 'tab' || k.name === 'shift-tab' || k.name === 'enter') base = null;
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
