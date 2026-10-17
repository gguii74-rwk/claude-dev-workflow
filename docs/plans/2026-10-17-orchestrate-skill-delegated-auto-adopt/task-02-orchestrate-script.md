# task-02 — orchestrate.mjs 구현 (GREEN) (spec §3w · AC2·AC3·AC4)

**목적**: 오르카 상세의 유일한 거처인 `dev-workflow/skills/orchestrate/scripts/orchestrate.mjs`(서브커맨드 `watch`·`alive`·`key`)를 만들어 task-01 테스트 24건을 통과시킨다.

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

기대: tests 24 · pass 0 · fail 24.

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
const PERMISSION_PATTERNS = ['could not be checked', 'Do you want to proceed', "Yes, and don't ask again"];
const SEPARATOR = '────';                       // 프롬프트 박스 위·아래 구분선
const PROMPT_CHAR = '❯';                        // 프롬프트 박스 안 입력 줄
const SPINNER_PREFIXES = ['✻', '✶', '✳', '✢', '·', '✽', '*'];
const RESPONSE_BULLETS = /^[\s⏺●]+/;            // 응답 첫 줄 글머리표 — 표지 비교 전에 뗀다
const CLAUDE_EXIT_MARK = 'Resume this session with';
const SHELL_PROMPT_RE = /[%$#>]\s*$/;
const STALE_CODE = 'terminal_handle_stale';
const TIMEOUT_CODE = 'timeout';
const KEYS = { tab: '\t', 'shift-tab': '\x1b[Z', up: '\x1b[A', down: '\x1b[B' };

// ── 동작 상수 (M5) — 간격 환경변수는 테스트 전용
const INTERVAL_MS = Number(process.env.ORCHESTRATE_INTERVAL_MS) || 20000;
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
function orca(env, args) {
  const full = [...args, '--json', ...(env ? ['--environment', env] : [])];
  const r = spawnSync(resolveCli(), full, { encoding: 'utf8' });
  if (r.error) throw new Fail(`orca 실행 실패: ${r.error.message}`);
  try {
    return JSON.parse(r.stdout);
  } catch {
    throw new Fail(formatFail('JSON 응답'));
  }
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

// 표지는 본문의 마지막 비어 있지 않은 줄일 때만 인정 · --consumed와 같은 표지는 본문이 바뀌기 전까지 소비된 것(D41)
function classify(lines, consumed, changed) {
  const last = normalizeMarker(lastNonEmpty(bodyLines(lines)).line);
  const isMarker = last.startsWith(DONE_MARK) || last.startsWith(HANDOFF_MARK);
  if (isMarker && !(consumed !== null && last === normalizeMarker(consumed) && !changed)) {
    return { verdict: last.startsWith(DONE_MARK) ? 'DONE' : 'HANDOFF', marker: last };
  }
  const text = lines.join('\n');
  if (QUESTION_PATTERNS.some((p) => text.includes(p))) return { verdict: 'QUESTION' };
  if (PERMISSION_PATTERNS.some((p) => text.includes(p))) return { verdict: 'PERMISSION' };
  return null;
}

function emit(verdict, lines, marker) {
  const out = [verdict];
  if (marker) out.push(marker);
  out.push(...lines.slice(-OUTPUT_LINES));
  process.stdout.write(out.join('\n') + '\n');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function watch(handle, maxSeconds, consumed, env) {
  const first = readScreen(env, handle);
  if (first.stale) throw new Fail(`핸들이 stale이다(${STALE_CODE}) — alive로 확인하라`);
  idle(env, handle); // 자가 점검 — idle 플래그 존재 확인
  let lines = first.lines;
  const startHash = hash(bodyLines(lines));
  let last = startHash;
  let changed = false;
  let v = classify(lines, consumed, changed); // 감시 시작 전 도착한 미처리 표지·열린 질문은 즉시
  if (v) return emit(v.verdict, lines, v.marker);
  const start = Date.now();
  while (Date.now() - start < maxSeconds * 1000) {
    await sleep(INTERVAL_MS);
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
  const box = seps.length >= 2 && lines.slice(seps[seps.length - 2] + 1, lastSep).some((l) => l.trimStart().startsWith(PROMPT_CHAR));
  const question = QUESTION_PATTERNS.some((p) => lines.join('\n').includes(p));
  if ((box || question) && !exitBelowBox) return [0, `ALIVE claude 입력 상태(${box ? '프롬프트 박스' : '질문 창'})`];
  return [2, 'UNREADABLE 생존·종료 어느 쪽도 확정할 수 없다 — 종료로 보지 않는다'];
}

async function key(handle, keys, env) {
  for (const k of keys) {
    const args = ['terminal', 'send', '--terminal', handle];
    if (k.text !== undefined) args.push('--text', k.text); // argv 직접 전달 — 셸 보간 없음
    else if (k.name === 'enter') args.push('--enter');
    else args.push('--text', KEYS[k.name]);
    const res = orca(env, args);
    if (res.result?.send?.accepted !== true) throw new Fail(`키 전송이 수락되지 않았다(${k.name ?? 'text'}): ${res.error?.code ?? formatFail('result.send.accepted')}`);
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
    if (!(e instanceof Fail)) throw e;
    process.stdout.write(`ERR ${e.message}\n`);
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

기대: `CHECK_OK` · tests 24 · pass 24 · fail 0(약 11초 — `KEY_GAP_MS` 300ms × 4 등).

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
git commit -m "feat(orchestrate): orchestrate.mjs watch·alive·key — 오르카 상세의 유일한 거처(D3), 시작 자가 점검(필드 누락·화면 출처 screen 아님 = exit 2, D6), watch 판정 7종(표지 = 본문 마지막 줄 · --consumed 소비 D41 · 변화 없음+idle ≠ SETTLED), alive exit 0/1/2/3 상호 배타(종료 = 박스 아래 종료 표지 + 셸 프롬프트), key = argv 직접 전달; 테스트 24/24(spec §3w·AC2·AC3)"
```

## Acceptance Criteria

- `node --test tests/orchestrate/orchestrate.test.mjs` → tests 24 · pass 24 · fail 0 (AC2·AC3).
- `node --check dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` → exit 0 (AC4 일부).
- `grep -c "shell: true" dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` → `0` (셸 보간 없음).
- 상수 자리: `grep -nE "^const (DONE_MARK|HANDOFF_MARK|QUESTION_PATTERNS|PERMISSION_PATTERNS|CLAUDE_EXIT_MARK|SHELL_PROMPT_RE) " dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` → 6줄 (검증 필요(실측) 문자열의 갱신 자리 1곳 — spec 잔여 리스크 (1)(2)).
- 기준선 11/11 · 2/2, `git diff 151d9f0 -- dev-workflow/hooks` 빈 출력 (AC8).

## Cautions

- **테스트를 고쳐서 통과시키지 마라.** 이유: task-01 테스트가 spec AC2·AC3의 정본 대응이다. 실패하면 스크립트를 고친다.
- **오르카 프로세스의 exit code로 성공·실패를 판정하지 마라.** 이유: `wait` 시간 초과와 stale 핸들은 exit 1과 함께 정상 JSON을 낸다 — JSON의 `ok`·`error.code`로 가른다(스크립트 `orca()` 주석).
- **`spawnSync`에 `shell: true`를 주거나 키·텍스트를 문자열 명령으로 합치지 마라.** 이유: `key text`의 원문(`$(…)`·백틱·따옴표)이 셸에서 실행된다 — argv 배열로만 넘긴다.
- **화면 출처가 `screen`이 아닌 응답을 판독에 쓰지 마라.** 이유: 누적 스트림에는 프롬프트 박스가 없어 살아 있는 claude를 종료로 오판 → 중복 재개(spec R4-1).
- **`alive`에서 「박스 없음」만으로 exit 1을 내지 마라.** 이유: 질문 창·출력 중 화면도 박스가 없다 — 종료는 「마지막 구분선 아래의 종료 표지 + 그 뒤 셸 프롬프트」 둘 다일 때만, 어느 쪽도 확정 못 하면 exit 2(spec R6-1).
- **python 의존을 더하지 마라.** 이유: M10 — 스크립트는 Node 하나.
