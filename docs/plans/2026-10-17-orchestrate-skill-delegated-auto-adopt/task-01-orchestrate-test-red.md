# task-01 — orchestrate.mjs 계약 테스트 작성 (RED) (spec §3w · AC2·AC3)

**목적**: `orchestrate.mjs`의 계약(서브커맨드 3개·판정 7종·표지 인정 조건·생존 판정 exit 0/1/2/3·자가 점검)을 가짜 `orca`로 검증하는 테스트 파일을 repo 루트 `tests/orchestrate/`에 만들고, 스크립트가 없는 지금 **24건 전부 실패(RED)**함을 확인한다. 스크립트 구현은 task-02.

## Files

- Create: `tests/orchestrate/orchestrate.test.mjs` (repo 루트 — 플러그인 소스 `dev-workflow/` 밖, M15)
- 그 외 파일 변경 없음

## Prep

- spec `docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md` §3w(스크립트 계약 · 테스트 불릿) · §4 AC2·AC3.
- 엔트리포인트 §Shared Contracts **SC-2**(CLI 계약 — 출력 첫 줄 토큰·exit code·`ORCHESTRATE_INTERVAL_MS`) · **SC-4**(테스트·회귀 명령).
- 가짜 `orca`는 테스트 파일 안의 문자열(`FAKE_ORCA`)을 임시 디렉터리에 실행 파일 `orca`로 써서 PATH 맨 앞에 둔다. 서브커맨드(`read`·`wait`·`show`·`send`)별 응답 큐를 차례로 돌려주고, 큐가 끝나면 마지막 응답을 반복하며, 받은 argv를 `<scenario>.log`에 JSON 한 줄씩 남긴다.

## Deps

없음.

## Steps

### 1. 기준선 확인 (변경 전)

```bash
cd <repo 루트>
env -u DEV_WORKFLOW_MODE HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'
env -u DEV_WORKFLOW_MODE HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.1.0/context-threshold-hook.mode.test.mjs 2>&1 | grep -E '^# (tests|pass|fail)'
```

기대: `# tests 11 / # pass 11 / # fail 0` 그리고 `# tests 2 / # pass 2 / # fail 0`. (`env -u DEV_WORKFLOW_MODE`를 빼면 위임 트랙 세션에서 C8이 실패한다 — SC-4.)

### 2. 테스트 파일 작성

`tests/orchestrate/orchestrate.test.mjs`를 아래 내용 **그대로** 만든다(Write 도구):

````js
// orchestrate.mjs 계약 테스트(spec §3w · AC2·AC3) — 가짜 orca를 PATH 앞에 두고 실제 오르카 없이 돈다.
// 실행: node --test tests/orchestrate/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../../dev-workflow/skills/orchestrate/scripts/orchestrate.mjs', import.meta.url));

// 가짜 orca: 서브커맨드(read·wait·show·send)별 응답 큐를 차례로 돌려주고, 큐가 끝나면 마지막 응답을 반복한다.
const FAKE_ORCA = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const sc = JSON.parse(fs.readFileSync(process.env.FAKE_ORCA_SCENARIO, 'utf8'));
const statePath = process.env.FAKE_ORCA_SCENARIO + '.state';
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
fs.appendFileSync(process.env.FAKE_ORCA_SCENARIO + '.log', JSON.stringify(args) + '\\n');
const sub = args[1];
const queue = sc[sub] || [];
const i = state[sub] || 0;
state[sub] = i + 1;
fs.writeFileSync(statePath, JSON.stringify(state));
const r = queue[Math.min(i, queue.length - 1)] || { stdout: { ok: false, error: { code: 'no_scenario' } }, code: 1 };
process.stdout.write(typeof r.stdout === 'string' ? r.stdout : JSON.stringify(r.stdout));
process.exit(r.code || 0);
`;

const SEP = '─'.repeat(40);
const box = (body) => [...body, SEP, '❯ ', SEP, '  [Opus 5.5] │ Context 17%'];
const read = (lines, source = 'screen') => ({ stdout: { ok: true, result: { terminal: { handle: 'term_t', status: 'running', tail: lines, source } } } });
const IDLE = { stdout: { ok: true, result: { wait: { satisfied: true } } } };
const BUSY = { code: 1, stdout: { ok: false, error: { code: 'timeout', message: 'timeout' } } };
const SHOW_OK = { stdout: { ok: true, result: { terminal: { handle: 'term_t', connected: true, writable: true, orphaned: false } } } };
const SENT = { stdout: { ok: true, result: { send: { accepted: true } } } };

const A = box(['⏺ 작업 중입니다', '  1단계 진행']);
const B = box(['⏺ 작업 중입니다', '  1단계 진행', '  2단계 완료']);
const DONE_LINE = '[TRACK-DONE 5 abc1234]';
const D = box(['⏺ 단계 종료 보고', '  커밋 abc1234', `  ${DONE_LINE}`, '✻ Worked for 1m 2s']);
const H = box(['⏺ 넛지를 받아 핸드오프를 썼다', '  사유: 넛지', '  [TRACK-HANDOFF .remember/loop-x-spec.md]']);
const Q = ['⏺ 질문이 있습니다', '', ' 판정 방식을 고르세요', '❯ 1. 지금 고친다 (추천)', '  2. 알고도 둔다', '', 'Enter to select · ↑/↓ to navigate · Esc to cancel'];
const P = ['⏺ Bash(sh -c "rm -f x")', '', ' Command contains rm that could not be checked', ' Do you want to proceed?', ' ❯ 1. Yes', '   2. No'];

function run(cmd, args, scenario) {
  const dir = mkdtempSync(join(tmpdir(), 'orch-test-'));
  writeFileSync(join(dir, 'orca'), FAKE_ORCA);
  chmodSync(join(dir, 'orca'), 0o755);
  const scPath = join(dir, 'scenario.json');
  writeFileSync(scPath, JSON.stringify(scenario));
  const env = { ...process.env, PATH: dir + delimiter + process.env.PATH, FAKE_ORCA_SCENARIO: scPath, ORCHESTRATE_INTERVAL_MS: '20' };
  delete env.ORCA_CLI_COMMAND;
  delete env.ORCA_DEV_REPO_ROOT;
  const r = spawnSync(process.execPath, [SCRIPT, cmd, ...args], { env, encoding: 'utf8', timeout: 20000 });
  const logPath = scPath + '.log';
  const calls = existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { code: r.status, out: r.stdout, first: r.stdout.split('\n')[0], calls };
}

// ── AC2 자가 점검
test('AC2 watch: 렌더링 줄 배열이 없으면 exit 2 + orca-cli + 필드명', () => {
  const r = run('watch', ['term_t', '0.2'], { read: [{ stdout: { ok: true, result: { terminal: { source: 'screen' } } } }], wait: [IDLE] });
  assert.equal(r.code, 2);
  assert.match(r.out, /orca-cli/);
  assert.match(r.out, /result\.terminal\.tail/);
});

test('AC2 watch: idle 플래그가 없으면 exit 2 + orca-cli + 필드명', () => {
  const r = run('watch', ['term_t', '0.2'], { read: [read(A)], wait: [{ stdout: { ok: true, result: { wait: {} } } }] });
  assert.equal(r.code, 2);
  assert.match(r.out, /orca-cli/);
  assert.match(r.out, /result\.wait\.satisfied/);
});

test('AC2 alive: 연결 플래그가 없으면 exit 2 + orca-cli + 필드명', () => {
  const r = run('alive', ['term_t'], { show: [{ stdout: { ok: true, result: { terminal: { connected: true, writable: true } } } }] });
  assert.equal(r.code, 2);
  assert.match(r.out, /orca-cli/);
  assert.match(r.out, /orphaned/);
});

test('AC2 watch: 화면 출처가 screen-unavailable이면 exit 2 + 종료로 보지 않는다', () => {
  const r = run('watch', ['term_t', '0.2'], { read: [read(A, 'screen-unavailable')], wait: [IDLE] });
  assert.equal(r.code, 2);
  assert.match(r.out, /종료로 보지 않는다/);
});

test('AC2 alive: 화면 출처가 screen-unavailable이면 exit 2(1 아님) + 종료로 보지 않는다', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(['wk@host dir % '], 'screen-unavailable')] });
  assert.equal(r.code, 2);
  assert.match(r.out, /종료로 보지 않는다/);
});

// ── AC3 watch 판정
test('AC3 watch DONE: 표지가 본문 마지막 줄이면 DONE + 둘째 줄 표지', () => {
  const r = run('watch', ['term_t', '5'], { read: [read(A), read(D)], wait: [BUSY] });
  assert.equal(r.code, 0);
  assert.equal(r.first, 'DONE');
  assert.equal(r.out.split('\n')[1], DONE_LINE);
});

test('AC3 watch HANDOFF: 일시중단 표지면 HANDOFF', () => {
  const r = run('watch', ['term_t', '5'], { read: [read(A), read(H)], wait: [BUSY] });
  assert.equal(r.first, 'HANDOFF');
  assert.equal(r.out.split('\n')[1], '[TRACK-HANDOFF .remember/loop-x-spec.md]');
});

test('AC3 watch SETTLED: 본문 변화 뒤 안정 + idle', () => {
  const r = run('watch', ['term_t', '5'], { read: [read(A), read(B), read(B)], wait: [IDLE] });
  assert.equal(r.first, 'SETTLED');
});

test('AC3 watch QUESTION: 「Enter to select」', () => {
  const r = run('watch', ['term_t', '5'], { read: [read(A), read(Q)], wait: [BUSY] });
  assert.equal(r.first, 'QUESTION');
});

test('AC3 watch PERMISSION: 권한 확인 창 패턴', () => {
  const r = run('watch', ['term_t', '5'], { read: [read(A), read(P)], wait: [BUSY] });
  assert.equal(r.first, 'PERMISSION');
});

test('AC3 watch TIMEOUT: 최대초 경과·변화 없음', () => {
  const r = run('watch', ['term_t', '0.3'], { read: [read(A)], wait: [BUSY] });
  assert.equal(r.code, 0);
  assert.equal(r.first, 'TIMEOUT');
});

test('AC3 watch f1: 변화 없음 + idle은 SETTLED가 아니다', () => {
  const r = run('watch', ['term_t', '0.3'], { read: [read(A)], wait: [IDLE] });
  assert.equal(r.first, 'TIMEOUT');
});

test('AC3 watch: 표지가 마지막 줄이면 DONE이 QUESTION보다 우선', () => {
  const lines = box(['⏺ 질문 창 문구 「Enter to select」를 감시가 잡는다', `  ${DONE_LINE}`]);
  const r = run('watch', ['term_t', '5'], { read: [read(A), read(lines)], wait: [BUSY] });
  assert.equal(r.first, 'DONE');
});

// ── AC3 표지 인정 조건 4건
test('AC3 표지: 이전 DONE 줄 뒤 새 질문이 떠 있으면 QUESTION', () => {
  const lines = ['⏺ 단계 종료 보고', `  ${DONE_LINE}`, '', ...Q];
  const r = run('watch', ['term_t', '5', '--consumed', DONE_LINE], { read: [read(lines)], wait: [BUSY] });
  assert.equal(r.first, 'QUESTION');
});

test('AC3 표지: 본문 중간에 인용된 표지(마지막 줄 아님)는 DONE이 아니다', () => {
  const lines = box(['⏺ 예시 표지:', `  ${DONE_LINE}`, '  이건 인용이고 작업은 계속된다']);
  const r = run('watch', ['term_t', '0.3'], { read: [read(lines)], wait: [IDLE] });
  assert.equal(r.first, 'TIMEOUT');
});

test('AC3 표지: --consumed와 같은 표지가 무변화로 남아 있으면 DONE이 아니다', () => {
  const r = run('watch', ['term_t', '0.3', '--consumed', DONE_LINE], { read: [read(D)], wait: [IDLE] });
  assert.equal(r.first, 'TIMEOUT');
});

test('AC3 표지: 감시 시작 전 도착한 미처리 표지(--consumed와 다름)는 즉시 DONE', () => {
  const r = run('watch', ['term_t', '5', '--consumed', '[TRACK-DONE 4 0000000]'], { read: [read(D)], wait: [BUSY] });
  assert.equal(r.first, 'DONE');
  assert.equal(r.calls.filter((c) => c[1] === 'read').length, 1);
});

// ── AC3 alive 6건
test('AC3 alive: 연결 + 프롬프트 박스 → exit 0', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(A)] });
  assert.equal(r.code, 0);
  assert.match(r.first, /^ALIVE/);
});

test('AC3 alive: 박스 없이 질문 창만 보임 → exit 0', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(Q)] });
  assert.equal(r.code, 0);
  assert.match(r.first, /^ALIVE/);
});

test('AC3 alive: 미연결·고아 → exit 1', () => {
  const r = run('alive', ['term_t'], { show: [{ stdout: { ok: true, result: { terminal: { connected: false, writable: false, orphaned: true } } } }] });
  assert.equal(r.code, 1);
  assert.match(r.first, /^EXITED/);
});

test('AC3 alive: 연결됐으나 claude 종료 표지 + 셸 프롬프트(셸만 남음) → exit 1', () => {
  const lines = [...A, 'Resume this session with:', 'claude --resume 0b9c2f2e-1111-2222-3333-444455556666', '', 'wk@host claude-dev-workflow % '];
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(lines)] });
  assert.equal(r.code, 1);
  assert.match(r.first, /^EXITED/);
});

test('AC3 alive: 생존·종료 어느 쪽도 확정 불가 → exit 2(종료 아님)', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(['빌드 출력 1', '빌드 출력 2'])] });
  assert.equal(r.code, 2);
  assert.match(r.first, /^UNREADABLE/);
  assert.match(r.out, /종료로 보지 않는다/);
});

test('AC3 alive: stale 핸들 → exit 3', () => {
  const r = run('alive', ['term_t'], { show: [{ code: 1, stdout: { ok: false, error: { code: 'terminal_handle_stale', message: 'terminal_handle_stale' } } }] });
  assert.equal(r.code, 3);
  assert.match(r.first, /^STALE/);
});

// ── AC3 key 1건
test('AC3 key: tab shift-tab enter text — 시퀀스·원문·environment 전달', () => {
  const raw = '$(touch /tmp/x) `id` "q"';
  const r = run('key', ['term_k', 'tab', 'shift-tab', 'enter', 'text', raw, '--environment', 'spark2-ts'], { send: [SENT] });
  assert.equal(r.code, 0);
  assert.equal(r.first, 'SENT 4');
  const tail = ['--json', '--environment', 'spark2-ts'];
  assert.deepEqual(r.calls, [
    ['terminal', 'send', '--terminal', 'term_k', '--text', '\t', ...tail],
    ['terminal', 'send', '--terminal', 'term_k', '--text', '\x1b[Z', ...tail],
    ['terminal', 'send', '--terminal', 'term_k', '--enter', ...tail],
    ['terminal', 'send', '--terminal', 'term_k', '--text', raw, ...tail],
  ]);
});
````

### 3. RED 확인

```bash
node --test tests/orchestrate/orchestrate.test.mjs 2>&1 | grep -E '^ℹ (tests|pass|fail)'
```

기대: `ℹ tests 24` · `ℹ pass 0` · `ℹ fail 24`(스크립트 파일이 없어 모든 실행이 실패한다).

### 4. 커밋

```bash
git add tests/orchestrate/orchestrate.test.mjs
git commit -m "test(orchestrate): orchestrate.mjs 계약 테스트 24건(RED) — 가짜 orca로 자가 점검(필드 누락·screen-unavailable) · watch 판정 7종·f1·표지 인정 조건 4건 · alive exit 0/1/2/3 6건 · key 시퀀스(spec §3w·AC2·AC3)"
```

## Acceptance Criteria

- `node --test tests/orchestrate/orchestrate.test.mjs` → tests 24 · pass 0 · fail 24.
- `grep -c "^test('" tests/orchestrate/orchestrate.test.mjs` → `24`.
- `git diff HEAD~1 --stat` → `tests/orchestrate/orchestrate.test.mjs` 1파일만.
- 기준선 2종(단계 1) 11/11 · 2/2 그대로.

## Cautions

- **스크립트(`orchestrate.mjs`)를 이 task에서 만들지 마라.** 이유: RED를 먼저 커밋해야 task-02의 GREEN이 이 테스트로 증명된다.
- **테스트 기대값을 바꾸지 마라.** 이유: 24건이 spec AC2·AC3의 항목별 대응이다(SC-2 출력 토큰 포함) — 바꾸면 계약이 바뀐다.
- **실제 오르카를 부르지 마라.** 이유: `run()`이 `ORCA_CLI_COMMAND`·`ORCA_DEV_REPO_ROOT`를 지우고 PATH 앞에 가짜를 둔다 — 이 순서를 바꾸면 실제 터미널에 키가 들어갈 수 있다.
- **폴더 인자(`node --test tests/orchestrate/`)로 돌리지 마라.** 이유: Node 21 이상은 폴더를 모듈 경로로 해석해 테스트가 하나도 돌지 않는다(spec 정정 `dfdd243`).
