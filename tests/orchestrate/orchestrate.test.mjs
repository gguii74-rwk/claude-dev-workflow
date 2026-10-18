// orchestrate.mjs 계약 테스트(spec §3w · AC2·AC3) — 가짜 orca를 PATH 앞에 두고 실제 오르카 없이 돈다.
// 실행: node --test tests/orchestrate/orchestrate.test.mjs (폴더 인자 금지 — Node 21 이상은 모듈 경로로 해석)
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
if (r.hang) { // 응답하지 않는 CLI — 스크립트의 호출 상한이 끊어야 한다(15초 뒤 스스로 끝나 고아로 남지 않는다)
  if (r.ignoreTerm) process.on('SIGTERM', () => {});
  setTimeout(() => process.exit(1), 15000);
}
else {
  process.stdout.write(typeof r.stdout === 'string' ? r.stdout : JSON.stringify(r.stdout));
  process.exit(r.code || 0);
}
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
const QP = ['⏺ 질문이 있습니다', '', ' 권한 창 문구 「Do you want to proceed?」를 어떻게 처리할까요?', '❯ 1. 지금 고친다 (추천)', '  2. 알고도 둔다', '', 'Enter to select · ↑/↓ to navigate · Esc to cancel'];
const R = ['⏺ 질문이 있습니다', '', '←  ☒ 보안  ☒ 진행  ✔ Submit  →', '', 'Review your answers', '', ' ● 보안 판정?', '   → 지금 고친다', '', 'Ready to submit your answers?', '', '❯ 1. Submit answers', '  2. Cancel']; // 묶음 질문 최종 제출 화면(꼬리말 없음)
const X = [...A, 'Resume this session with:', 'claude --resume 0b9c2f2e-1111-2222-3333-444455556666', '', 'wk@host claude-dev-workflow % '];

function run(cmd, args, scenario) {
  const dir = mkdtempSync(join(tmpdir(), 'orch-test-'));
  writeFileSync(join(dir, 'orca'), FAKE_ORCA);
  chmodSync(join(dir, 'orca'), 0o755);
  const scPath = join(dir, 'scenario.json');
  writeFileSync(scPath, JSON.stringify(scenario));
  const env = { ...process.env, PATH: dir + delimiter + process.env.PATH, FAKE_ORCA_SCENARIO: scPath, ORCHESTRATE_INTERVAL_MS: '20', ORCHESTRATE_CALL_TIMEOUT_MS: '3000' };
  delete env.ORCA_CLI_COMMAND;
  delete env.ORCA_DEV_REPO_ROOT;
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [SCRIPT, cmd, ...args], { env, encoding: 'utf8', timeout: 20000 });
  const logPath = scPath + '.log';
  const calls = existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
  return { code: r.status, out: r.stdout, first: r.stdout.split('\n')[0], calls, ms: Date.now() - t0 };
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

test('AC2 alive: 오르카가 JSON null을 돌려주면 exit 2(1 아님) + orca-cli', () => {
  const r = run('alive', ['term_t'], { show: [{ stdout: 'null' }] });
  assert.equal(r.code, 2);
  assert.match(r.first, /^ERR /);
  assert.match(r.out, /orca-cli/);
});

test('AC2 watch: 오르카가 JSON null을 돌려주면 exit 2 + orca-cli', () => {
  const r = run('watch', ['term_t', '0.2'], { read: [{ stdout: 'null' }], wait: [IDLE] });
  assert.equal(r.code, 2);
  assert.match(r.out, /orca-cli/);
});

test('AC2 watch: 오르카 호출이 응답하지 않으면 최대초를 기다리지 않고 exit 2', () => {
  const r = run('watch', ['term_t', '5'], { read: [{ hang: true }], wait: [IDLE] });
  assert.equal(r.code, 2);
  assert.ok(r.ms < 5000, `상한(3초)에서 끊겨야 한다 — 실제 ${r.ms}ms(최대초 5초 또는 가짜 orca 자진 종료 15초를 기다렸다)`);
  assert.match(r.first, /^ERR /);
});

test('AC2 watch: SIGTERM을 무시하는 오르카 호출도 상한에서 끊고 exit 2', () => {
  const r = run('watch', ['term_t', '5'], { read: [{ hang: true, ignoreTerm: true }], wait: [IDLE] });
  assert.equal(r.code, 2);
  assert.ok(r.ms < 10000, `상한(3초)에서 끊겨야 한다 — 실제 ${r.ms}ms(가짜 orca 자진 종료 15초를 기다렸다)`);
  assert.match(r.first, /^ERR /);
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

test('AC3 watch: 본문에 질문 창 문구를 인용하고 그 아래 실제 권한 창이 뜨면 PERMISSION(맨 아래 창 문구 기준)', () => {
  const lines = ['⏺ 질문 창 꼬리말은 「Enter to select · ↑/↓ to navigate」다', '', ...P];
  const r = run('watch', ['term_t', '5'], { read: [read(A), read(lines)], wait: [BUSY] });
  assert.equal(r.first, 'PERMISSION');
});

test('AC3 watch·alive: 파일 편집 권한 창의 diff 미리보기에 질문 꼬리말 문구가 있어도 PERMISSION·권한 창(질문 창 아님)', () => {
  const E = [' Edit file', ' …/orchestrate.mjs', " 48 +const QUESTION_PATTERNS = ['Enter to select', 'to navigate'];", ' Do you want to make this edit to orchestrate.mjs?', ' ❯ 1. Yes', '   2. Yes, allow all edits during this session (shift+tab)', '   3. No, and tell Claude what to do differently (esc)', ' Esc to cancel'];
  const w = run('watch', ['term_t', '5'], { read: [read(A), read(E)], wait: [BUSY] });
  assert.equal(w.first, 'PERMISSION');
  const a = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(E)] });
  assert.equal(a.code, 0);
  assert.match(a.first, /권한 창/);
});

test('AC3 watch·alive: 본문에 권한 창 문구를 인용하고 그 아래 입력 상자가 있으면 PERMISSION이 아니다·프롬프트 박스(같은 화면 같은 판정)', () => {
  const lines = box(['⏺ 권한 창 문구는 「Do you want to proceed?」다', '  다음 단계로 넘어간다']);
  const w = run('watch', ['term_t', '0.3'], { read: [read(lines)], wait: [IDLE] });
  assert.equal(w.first, 'TIMEOUT');
  const a = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(lines)] });
  assert.equal(a.code, 0);
  assert.match(a.first, /프롬프트 박스/);
});

test('AC3 watch·alive: 구분선 사이에 그려진 권한 창(선택 줄 「❯ 1. Yes」가 구분선 안)도 PERMISSION·권한 창(입력 상자로 보지 않는다)', () => {
  const lines = ['⏺ Bash(sh -c "rm -f x")', SEP, ' Command contains rm that could not be checked', ' Do you want to proceed?', ' ❯ 1. Yes', '   2. No', SEP];
  const w = run('watch', ['term_t', '5'], { read: [read(A), read(lines)], wait: [BUSY] });
  assert.equal(w.first, 'PERMISSION');
  const a = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(lines)] });
  assert.equal(a.code, 0);
  assert.match(a.first, /권한 창/);
});

test('AC3 watch·alive: 권한 문구 아래 구분선 사이에 번호 선택 줄(「❯ 1. Yes」)만 있으면 입력 상자가 아니다 → PERMISSION·권한 창', () => {
  const lines = ['⏺ Bash(sh -c "rm -f x")', ' Do you want to proceed?', SEP, ' ❯ 1. Yes', '   2. No', SEP];
  const w = run('watch', ['term_t', '5'], { read: [read(A), read(lines)], wait: [BUSY] });
  assert.equal(w.first, 'PERMISSION');
  const a = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(lines)] });
  assert.equal(a.code, 0);
  assert.match(a.first, /권한 창/);
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

// ── AC3 표지 인정 조건 9건
test('AC3 표지: 이전 DONE 줄 뒤 새 질문이 떠 있으면 QUESTION', () => {
  const lines = ['⏺ 단계 종료 보고', `  ${DONE_LINE}`, '', ...Q];
  const r = run('watch', ['term_t', '5', '--consumed', DONE_LINE], { read: [read(lines)], wait: [BUSY] });
  assert.equal(r.first, 'QUESTION');
});

test('AC3 표지: DONE 줄 아래 구분선 사이에 그려진 질문 창은 본문 경계가 아니다 → QUESTION(DONE 아님)', () => {
  const lines = ['⏺ 단계 종료 보고', `  ${DONE_LINE}`, SEP, ...Q.slice(2), SEP];
  const r = run('watch', ['term_t', '5'], { read: [read(lines)], wait: [BUSY] });
  assert.equal(r.first, 'QUESTION');
});

test('AC3 표지: HANDOFF 줄 아래 구분선 사이에 그려진 권한 창은 본문 경계가 아니다 → PERMISSION(HANDOFF 아님)', () => {
  const lines = ['⏺ 넛지를 받아 핸드오프를 썼다', '  [TRACK-HANDOFF .remember/loop-x-spec.md]', SEP, ...P.slice(1), SEP];
  const r = run('watch', ['term_t', '5'], { read: [read(lines)], wait: [BUSY] });
  assert.equal(r.first, 'PERMISSION');
});

test('AC3 표지: 화면 폭에서 접힌 긴 HANDOFF 표지(공백 없는 이어진 줄)는 이어 붙여 HANDOFF + 전체 경로', () => {
  const marker = '[TRACK-HANDOFF .remember/loop-2026-10-17-orchestrate-skill-delegated-auto-adopt-impl.md]';
  const lines = box(['⏺ 넛지를 받아 핸드오프를 썼다', '  사유: 넛지', `  ${marker.slice(0, 60)}`, `  ${marker.slice(60)}`]);
  const r = run('watch', ['term_t', '5'], { read: [read(lines)], wait: [BUSY] });
  assert.equal(r.first, 'HANDOFF');
  assert.equal(r.out.split('\n')[1], marker);
});

test('AC3 표지: 닫히지 않은 인용 표지 아래 문장(공백 포함)은 이어 붙이지 않는다 → 표지 아님', () => {
  const lines = box(['⏺ 예시 표지:', '  [TRACK-HANDOFF .remember/x', '  이건 인용이다]']);
  const r = run('watch', ['term_t', '0.3'], { read: [read(lines)], wait: [IDLE] });
  assert.equal(r.first, 'TIMEOUT');
});

test('AC3 표지: 아직 출력 중인 닫히지 않은 표지(`]` 없음)는 받지 않고 완성된 다음 화면에서 HANDOFF', () => {
  const marker = '[TRACK-HANDOFF .remember/loop-x-spec.md]';
  const partial = box(['⏺ 넛지를 받아 핸드오프를 썼다', '  사유: 넛지', '  [TRACK-HANDOFF .remember/loop-']);
  const done = box(['⏺ 넛지를 받아 핸드오프를 썼다', '  사유: 넛지', `  ${marker}`]);
  const r = run('watch', ['term_t', '5'], { read: [read(partial), read(done)], wait: [BUSY] });
  assert.equal(r.first, 'HANDOFF');
  assert.equal(r.out.split('\n')[1], marker);
  assert.equal(r.calls.filter((c) => c[1] === 'read').length, 2);
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

// ── AC3 alive 13건
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

test('AC3 alive: 박스 없이 권한 확인 창만 보임 → exit 0(사용자 답 전달 가능)', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(P)] });
  assert.equal(r.code, 0);
  assert.match(r.first, /^ALIVE/);
});

test('AC3 alive: 질문 창 문구 뒤에 셸 프롬프트가 남음(종료 안내 없음) → exit 2(생존 아님)', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read([...Q, 'wk@host claude-dev-workflow % '])] });
  assert.equal(r.code, 2);
  assert.match(r.first, /^UNREADABLE/);
});

test('AC3 alive: 프롬프트 박스·상태줄 뒤에 셸 프롬프트가 남음(종료 안내 없음) → exit 2(생존 아님)', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read([...A, 'wk@host claude-dev-workflow % '])] });
  assert.equal(r.code, 2);
  assert.match(r.first, /^UNREADABLE/);
});

test('AC3 alive: 프롬프트 박스·상태줄 뒤에 ❯로 끝나는 셸 프롬프트(pure·starship)가 남음 → exit 2(생존 아님)', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read([...A, 'claude-dev-workflow on main', '❯ '])] });
  assert.equal(r.code, 2);
  assert.match(r.first, /^UNREADABLE/);
});

test('AC3 alive: 묶음 질문의 최종 제출 화면(꼬리말 없음) + 상태줄 → exit 0(질문 창)', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read([...R, '  [Opus 5.5] │ Context 17%'])] });
  assert.equal(r.code, 0);
  assert.match(r.first, /^ALIVE .*질문 창/);
});

test('AC3 alive: 미연결·고아 → exit 1', () => {
  const r = run('alive', ['term_t'], { show: [{ stdout: { ok: true, result: { terminal: { connected: false, writable: false, orphaned: true } } } }] });
  assert.equal(r.code, 1);
  assert.match(r.first, /^EXITED/);
});

test('AC3 alive: 연결됐으나 claude 종료 표지 + 셸 프롬프트(셸만 남음) → exit 1', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(X)] });
  assert.equal(r.code, 1);
  assert.match(r.first, /^EXITED/);
});

test('AC3 alive: 질문 창 위 본문에 종료 안내 문구를 인용하고 마지막 줄이 상태줄이면 exit 0(종료 1 아님 — 중복 --resume 방지)', () => {
  const lines = ['⏺ 종료 안내는 「Resume this session with:」 뒤 셸 프롬프트다', '', ...Q, '  [Opus 5.5] │ Context 17%'];
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read(lines)] });
  assert.equal(r.code, 0);
  assert.match(r.first, /질문 창/);
});

test('AC3 alive: 질문 창 아래 상태줄(HUD)은 셸 프롬프트가 아니다 → exit 0', () => {
  const r = run('alive', ['term_t'], { show: [SHOW_OK], read: [read([...Q, '  [Opus 5.5] │ Context 17%'])] });
  assert.equal(r.code, 0);
  assert.match(r.first, /질문 창/);
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

// ── AC3 key 10건
test('AC3 key: tab shift-tab enter text — 시퀀스·원문·environment 전달', () => {
  const raw = '$(touch /tmp/x) `id` "q"';
  const r = run('key', ['term_k', 'tab', 'shift-tab', 'enter', 'text', raw, '--environment', 'spark2-ts'], { show: [SHOW_OK], read: [read(Q)], send: [SENT] });
  assert.equal(r.code, 0);
  assert.equal(r.first, 'SENT 4');
  const tail = ['--json', '--environment', 'spark2-ts'];
  assert.deepEqual(r.calls.filter((c) => c[1] === 'send'), [
    ['terminal', 'send', '--terminal', 'term_k', '--text', '\t', ...tail],
    ['terminal', 'send', '--terminal', 'term_k', '--text', '\x1b[Z', ...tail],
    ['terminal', 'send', '--terminal', 'term_k', '--enter', ...tail],
    ['terminal', 'send', '--terminal', 'term_k', '--text', raw, ...tail],
  ]);
  assert.equal(r.calls.filter((c) => c[1] === 'show').length, 4); // 키마다 전송 직전 생존 확인
});

test('AC3 key: 전송 중간에 claude가 끝나면 나머지를 보내지 않고 exit 2', () => {
  const r = run('key', ['term_k', 'down', 'text', 'rm -rf x', 'enter'], { show: [SHOW_OK], read: [read(Q), read(X)], send: [SENT] });
  assert.equal(r.code, 2);
  assert.match(r.first, /^ERR 전송 중단 — 1\/3/);
  assert.equal(r.calls.filter((c) => c[1] === 'send').length, 1);
});

test('AC3 key: 프롬프트 박스·상태줄 뒤에 ➜로 시작하는 셸 프롬프트(oh-my-zsh)가 남은 화면이면 하나도 보내지 않고 exit 2', () => {
  const r = run('key', ['term_k', 'text', 'yes', 'enter'], { show: [SHOW_OK], read: [read([...A, '➜  claude-dev-workflow git:(main) ✗ '])], send: [SENT] });
  assert.equal(r.code, 2);
  assert.match(r.first, /^ERR 전송 중단 — 0\/2/);
  assert.equal(r.calls.filter((c) => c[1] === 'send').length, 0);
});

test('AC3 key: 키 사이에 같은 종류의 다른 질문(사용자 직접 응답 뒤 감사 이의 등)으로 바뀌면 나머지를 보내지 않고 exit 2', () => {
  const Q2 = ['⏺ 질문이 있습니다', '', ' [감사 이의] R3-2 판정을 다시 고르세요', '❯ 1. 루프 판정 유지 (추천)', '  2. 번복', '', 'Enter to select · ↑/↓ to navigate · Esc to cancel'];
  const r = run('key', ['term_k', 'down', 'enter'], { show: [SHOW_OK], read: [read([...Q, '  [Opus 5.5] │ Context 17%']), read([...Q2, '  [Opus 5.5] │ Context 18%'])], send: [SENT] });
  assert.equal(r.code, 2);
  assert.match(r.first, /^ERR 전송 중단 — 1\/2/);
  assert.equal(r.calls.filter((c) => c[1] === 'send').length, 1);
});

test('AC3 key: 같은 질문에서 선택 표시(❯)만 움직이고 상태줄이 바뀌는 것은 계속 보낸다', () => {
  const Qd = ['⏺ 질문이 있습니다', '', ' 판정 방식을 고르세요', '  1. 지금 고친다 (추천)', '❯ 2. 알고도 둔다', '', 'Enter to select · ↑/↓ to navigate · Esc to cancel'];
  const r = run('key', ['term_k', 'down', 'enter'], { show: [SHOW_OK], read: [read([...Q, '  [Opus 5.5] │ Context 17%']), read([...Qd, '  [Opus 5.5] │ Context 18%'])], send: [SENT] });
  assert.equal(r.code, 0);
  assert.equal(r.first, 'SENT 2');
});

test('AC3 key: 마지막 질문 enter 뒤 최종 제출 화면으로 바뀌어도 마지막 enter까지 보낸다', () => {
  const r = run('key', ['term_k', 'enter', 'enter'], { show: [SHOW_OK], read: [read(Q), read(R)], send: [SENT] });
  assert.equal(r.code, 0);
  assert.equal(r.first, 'SENT 2');
});

test('AC3 key: 키 사이에 질문 창이 권한 창으로 바뀌면 나머지를 보내지 않고 exit 2', () => {
  const r = run('key', ['term_k', 'down', 'enter'], { show: [SHOW_OK], read: [read(Q), read(P)], send: [SENT] });
  assert.equal(r.code, 2);
  assert.match(r.first, /^ERR 전송 중단 — 1\/2/);
  assert.match(r.out, /질문 창 → 권한 창/);
  assert.equal(r.calls.filter((c) => c[1] === 'send').length, 1);
});

test('AC3 key: 본문에 권한 문구를 인용한 질문 창이 실제 권한 창으로 바뀌어도 나머지를 보내지 않고 exit 2', () => {
  const r = run('key', ['term_k', 'down', 'enter'], { show: [SHOW_OK], read: [read(QP), read(P)], send: [SENT] });
  assert.equal(r.code, 2);
  assert.match(r.out, /질문 창 → 권한 창/);
  assert.equal(r.calls.filter((c) => c[1] === 'send').length, 1);
});

test('AC3 key: 본문에 입력 상자 모양이 인용돼 있어도 그 아래 질문 창이 권한 창으로 바뀌면 나머지를 보내지 않고 exit 2', () => {
  const quoted = ['⏺ TUI 입력 상자 예시:', SEP, '❯ ', SEP];
  const r = run('key', ['term_k', 'down', 'enter'], { show: [SHOW_OK], read: [read([...quoted, ...Q]), read([...quoted, ...P])], send: [SENT] });
  assert.equal(r.code, 2);
  assert.match(r.out, /질문 창 → 권한 창/);
  assert.equal(r.calls.filter((c) => c[1] === 'send').length, 1);
});

test('AC3 key: 키 사이에 질문 창이 닫히고 입력 상자로 바뀌면 나머지를 보내지 않고 exit 2', () => {
  const r = run('key', ['term_k', 'down', 'enter'], { show: [SHOW_OK], read: [read(Q), read(A)], send: [SENT] });
  assert.equal(r.code, 2);
  assert.match(r.out, /질문 창 → 프롬프트 박스/);
  assert.equal(r.calls.filter((c) => c[1] === 'send').length, 1);
});
