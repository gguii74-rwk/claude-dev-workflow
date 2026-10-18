# task-02 — orchestrate.mjs 구현 (GREEN) (spec §3w · AC2·AC3·AC4)

**목적**: 오르카 상세의 유일한 거처인 `dev-workflow/skills/orchestrate/scripts/orchestrate.mjs`(서브커맨드 `watch`·`alive`·`key`)를 만들어 task-01 테스트 38건을 통과시킨다.

## Files

- Create: `dev-workflow/skills/orchestrate/scripts/orchestrate.mjs`
- Test: `tests/orchestrate/orchestrate.test.mjs`(task-01 — 수정 금지)

## Prep

- spec §3w 전체(서브커맨드 · 자가 점검 · 판정 우선순위 · 출력) · §3o ② · AC2·AC3·AC4 · D6·D41.
- 엔트리포인트 **SC-2**(CLI 계약 — 이 task가 정본을 구현한다) · **SC-3**(표지 문자열) · **SC-4**.
- 오르카 1.4.229 응답 사실(2026-10-18 맥북 실측 — 스크립트가 의존하는 것만): `terminal read --screen --json` → `result.terminal.tail`(문자열 배열) · `result.terminal.source`(`screen` | `stream` | `screen-unavailable`, 없으면 구버전 호스트) / `terminal wait --for tui-idle --json` → 만족 시 `{ok:true, result:{wait:{satisfied:true}}}`, 시간 초과 시 **`{ok:false, error:{code:"timeout"}}` + 프로세스 exit 1**(satisfied 필드 없음) / `terminal show --json` → `result.terminal.connected`·`writable`·`orphaned`(boolean) / 알 수 없는·stale 핸들 → `{ok:false, error:{code:"terminal_handle_stale"}}` + exit 1 / `terminal send` 영수증 → `result.send.accepted`.
- 화면 구조(실측): claude TUI는 프롬프트 박스 위·아래에 `────…` 구분선 2줄, 박스 안에 `❯` 입력 줄, 박스 **아래**에 상태줄(HUD — 타이머·사용률이 계속 바뀐다). 그래서 본문 = 끝에서 둘째 구분선 위 줄들이다.

## Deps

01

## Steps

### 1. RED 재확인

```bash
node --test tests/orchestrate/orchestrate.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: tests 38 · pass 0 · fail 38.

### 2. 스크립트 작성

`dev-workflow/skills/orchestrate/scripts/orchestrate.mjs`를 아래 내용 **그대로** 만든다(Write 도구. 실행 권한 불요 — 항상 `node <경로>`로 부른다):

````js
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
const PERMISSION_PATTERNS = ['could not be checked', 'Do you want to ', "Yes, and don't ask again", 'Yes, allow '];  // 'Do you want to ' = proceed·make this edit·create·overwrite·allow 권한 창 전체 — 좁으면 diff 미리보기의 질문 꼬리말 문구에 질문 창으로 오판돼 enter가 권한을 승인한다(D23)
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
````

### 3. 문법·GREEN 확인

```bash
node --check dev-workflow/skills/orchestrate/scripts/orchestrate.mjs && echo CHECK_OK
node --test tests/orchestrate/orchestrate.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: `CHECK_OK` · tests 38 · pass 38 · fail 0(약 20초 — `KEY_GAP_MS` 300ms × 키 수 · 호출 무응답 3초 시나리오 2건 등).

### 4. 회귀 확인

```bash
env -u DEV_WORKFLOW_MODE HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs 2>&1 | grep -E '^# (pass|fail)'
env -u DEV_WORKFLOW_MODE HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.1.0/context-threshold-hook.mode.test.mjs 2>&1 | grep -E '^# (pass|fail)'
git diff 151d9f0 -- dev-workflow/hooks | wc -l
```

기대: pass 11 · fail 0 / pass 2 · fail 0 / `0`.

### 5. 커밋

```bash
git add dev-workflow/skills/orchestrate/scripts/orchestrate.mjs
git commit -m "feat(orchestrate): orchestrate.mjs watch·alive·key — 오르카 상세의 유일한 거처(D3), 시작 자가 점검(필드 누락·화면 출처 screen 아님 = exit 2, D6), watch 판정 7종(표지 = 본문 마지막 줄 · --consumed 소비 D41 · 질문/권한 = 맨 아래 창 문구(alive와 공용 헬퍼) · 변화 없음+idle ≠ SETTLED), alive exit 0/1/2/3 상호 배타(종료 = 박스 아래 종료 표지 + 셸 프롬프트 · 생존 = 박스 또는 질문·권한 창, 입력 요소 뒤 셸 프롬프트면 판독 불가), key = 키마다 alive·화면 종류(맨 아래 입력 요소 기준) 유지 확인 뒤 argv 직접 전달, 오르카 호출 상한(무응답 = SIGKILL·ERR), 응답 루트·예기치 않은 예외 = ERR exit 2; 테스트 38/38(spec §3w·AC2·AC3)"
```

## Acceptance Criteria

- `node --test tests/orchestrate/orchestrate.test.mjs` → tests 38 · pass 38 · fail 0 (AC2·AC3).
- `node --check dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` → exit 0 (AC4 일부).
- `grep -c "shell: true" dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` → `0` (셸 보간 없음).
- 상수 자리: `grep -nE "^const (DONE_MARK|HANDOFF_MARK|QUESTION_PATTERNS|PERMISSION_PATTERNS|CLAUDE_EXIT_MARK|SHELL_PROMPT_RE|HUD_MARK) " dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` → 7줄 (검증 필요(실측) 문자열의 갱신 자리 1곳 — spec 잔여 리스크 (1)(2)).
- 기준선 11/11 · 2/2, `git diff 151d9f0 -- dev-workflow/hooks` 빈 출력 (AC8).

## Cautions

- **테스트를 고쳐서 통과시키지 마라.** 이유: task-01 테스트가 spec AC2·AC3의 정본 대응이다. 실패하면 스크립트를 고친다.
- **오르카 프로세스의 exit code로 성공·실패를 판정하지 마라.** 이유: `wait` 시간 초과와 stale 핸들은 exit 1과 함께 정상 JSON을 낸다 — JSON의 `ok`·`error.code`로 가른다(스크립트 `orca()` 주석).
- **`spawnSync`에 `shell: true`를 주거나 키·텍스트를 문자열 명령으로 합치지 마라.** 이유: `key text`의 원문(`$(…)`·백틱·따옴표)이 셸에서 실행된다 — argv 배열로만 넘긴다.
- **화면 출처가 `screen`이 아닌 응답을 판독에 쓰지 마라.** 이유: 누적 스트림에는 프롬프트 박스가 없어 살아 있는 claude를 종료로 오판 → 중복 재개(spec R4-1).
- **`alive`에서 「박스 없음」만으로 exit 1을 내지 마라.** 이유: 질문 창·출력 중 화면도 박스가 없다 — 종료는 「마지막 구분선 아래의 종료 표지 + 그 뒤 셸 프롬프트」 둘 다일 때만, 어느 쪽도 확정 못 하면 exit 2(spec R6-1).
- **python 의존을 더하지 마라.** 이유: M10 — 스크립트는 Node 하나.
- **어떤 실패도 exit 1로 끝내지 마라.** 이유: `alive`의 exit 1 = 「종료」라 메인이 `--resume` 복구로 같은 세션을 둘 만든다 — 응답 루트가 객체가 아니면 자가 점검 ERR, 예기치 않은 예외도 `main()`이 ERR exit 2로 바꾼다(plan ledger R5-1).
- **`key`에서 생존 확인을 첫 키 한 번으로 줄이지 마라.** 이유: 묶음 키 사이에 claude가 끝나면 남은 text·enter가 셸에서 실행된다 — 키마다 `alive` 0일 때만 보내고, 아니면 보낸 개수를 담아 `ERR 전송 중단`(plan ledger R1-2). **화면 종류(프롬프트 박스·질문 창·권한 창)가 첫 키 때와 달라져도 멈춘다** — 사용자가 직접 답해 권한 창이 뜨면 남은 enter가 권한을 승인한다(D23, plan ledger R2-2). 창 종류는 화면 전체가 아니라 **맨 아래 창 문구**로 정한다 — 전체에서 찾으면 본문에 인용된 권한 문구가 처음부터 「권한 창」으로 읽혀 전환을 못 잡는다(plan ledger R3-1). 박스도 같다 — 창 문구가 마지막 구분선보다 아래면 박스는 본문 인용이다(plan ledger R4-1).
- **`watch`의 QUESTION/PERMISSION을 화면 전체 부분 문자열로 가르지 마라.** 이유: 본문이 질문 창 문구(「Enter to select」)를 인용하고 그 아래 실제 권한 창이 뜨면 QUESTION으로 읽혀, 메인이 ③ 「그 외」 행대로 첫 선택지를 `enter`로 골라 권한 창의 「1. Yes」를 사람 없이 승인한다(D23) — `alive`의 창 종류와 같은 `bottomDialog()`(맨 아래 창 문구, 한 줄에 둘 다면 권한)로 가른다(7 impl 사전 점검 F3 사용자 판정).
- **`alive`의 「입력 요소 뒤 셸 프롬프트」 검사를 빼지 마라.** 이유: 종료 안내 없이(SIGKILL 등) 셸로 돌아간 잔존 화면이 생존으로 읽혀 전송이 셸로 간다(plan ledger R1-1·R2-1). 박스 아래 HUD 줄(`[Opus 5.5] │ Context 17%`)은 셸 프롬프트와 같은 끝 문자를 써서 `HUD_MARK`(`│`)로 가른다 — 구분자 없는 상태줄을 쓰는 환경이나 질문 창 아래에 HUD가 보이는 환경은 판독 불가(exit 2 — 안전한 쪽, 시끄럽게 멈춤)가 되므로 실측 때 상수 자리에서 갱신(검증 필요(실측)).
- **오르카 호출에서 `timeout`을 빼지 마라.** 이유: 응답하지 않는 CLI 한 번이 watch 상한(580초)과 메인의 대기 상한(600초)을 무력화한다 — 호출 상한 8초 · 상한은 시작 자가 점검부터 잰다(plan ledger R1-4). `killSignal: 'SIGKILL'`도 빼지 마라 — 기본 SIGTERM을 무시하는 CLI면 `spawnSync`가 자식 종료를 기다리며 돌아오지 않는다(plan ledger R2-3).
