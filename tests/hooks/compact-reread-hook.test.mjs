// compact-reread-hook.mjs 계약 테스트(spec 2026-11-15-compact-resilience §3a · AC1~AC5).
// 실행: node --test tests/hooks/compact-reread-hook.test.mjs (폴더 인자 금지 — Node 21 이상은 모듈 경로로 해석)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = fileURLToPath(new URL('../../dev-workflow/hooks/scripts/compact-reread-hook.mjs', import.meta.url));
const HOOKS_JSON = fileURLToPath(new URL('../../dev-workflow/hooks/hooks.json', import.meta.url));
// 스크립트 위치 기준 ../../skills = 저장소의 dev-workflow/skills 절대 경로
const SKILLS = fileURLToPath(new URL('../../dev-workflow/skills', import.meta.url));

// §3a 안내문 정본(문구 승인 2026-11-15) — <SKILLS>만 채운다
const NOTICE = [
  '[dev-workflow] 이 대화는 방금 압축(요약)됐다. 압축 뒤에는 호출했던 스킬 본문이 앞부분만 남고(스킬당 약 5,000토큰), 진행 상태는 요약문에만 남는다.',
  'dev-workflow 스킬(review-loop · harden-spec · orchestrate · mr-review 등)을 실행하던 중이 아니면 이 안내를 무시한다. 실행하던 중이면 다음 행동 전에:',
  `1. 그 스킬의 SKILL.md 전문을 Read로 다시 읽는다(길면 나눠서 끝까지) — ${SKILLS}/<스킬 이름>/SKILL.md. 스킬을 다시 호출하지 않는다 — 처음부터 다시 시작하는 것이 아니라 하던 곳에서 이어 간다.`,
  '2. 진행 상태를 파일에서 다시 읽는다 — review-loop: 그 루프의 .remember/loop-<ledger 문서 이름>-<phase>.md 를 읽고 SKILL.md의 「압축 뒤 이어가기」를 따른다. 그 외: 작업 중이던 산출물 파일(spec·plan 등)과 핸드오프 파일(기본 .remember/remember.md)의 이 세션 몫.',
  '3. 트랙 프롬프트 파일(.remember/track-*.prompt 등)로 시작한 세션이면 그 파일을 다시 읽는다 — 역할·진행 범위·정지 조건·종료 표지 규약은 압축 뒤에도 그대로 유효하다.',
  '4. 대화에만 있던 작업 목록(예: harden-spec의 갭 대장 · 아직 묻지 않은 질문)은 요약문에 기대지 말고 산출물 파일과 대조해 다시 만든다.',
  '5. 요약문과 파일·git이 다르면 파일·git을 믿는다.',
].join('\n');

// input === undefined 이면 stdin을 닫은 채(입력 없음) 실행한다
const run = (input) => spawnSync(process.execPath, [SCRIPT], {
  input: input === undefined ? '' : input,
  stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
  encoding: 'utf8',
  cwd: ROOT,
});

const assertNotice = (r) => {
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout); // JSON 1개로 파싱돼야 한다
  assert.equal(out.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(out.hookSpecificOutput.additionalContext, NOTICE);
  assert.ok(out.hookSpecificOutput.additionalContext.length <= 2000);
};

test('AC1 hooks.json — SessionStart(compact) 그룹 1개 · Stop 불변', () => {
  const h = JSON.parse(readFileSync(HOOKS_JSON, 'utf8')).hooks;
  assert.equal(h.SessionStart.length, 1);
  assert.equal(h.SessionStart[0].matcher, 'compact');
  assert.deepEqual(h.SessionStart[0].hooks, [
    { type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/compact-reread-hook.mjs"' },
  ]);
  assert.deepEqual(h.Stop, [
    { hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/context-threshold-hook.mjs"' }] },
  ]);
});

test('AC2 source=compact → 안내문 정본(스킬 폴더 절대 경로) JSON 1개 · exit 0', () => {
  assertNotice(run(JSON.stringify({ source: 'compact', session_id: 's', hook_event_name: 'SessionStart' })));
});

for (const [name, input] of [
  ['stdin 없음', undefined],
  ['빈 문자열', ''],
  ['깨진 JSON', '{"source":'],
  ['source 없는 JSON', '{"session_id":"s"}'],
]) {
  test(`AC3 ${name} → 안내문 출력`, () => assertNotice(run(input)));
}

for (const source of ['startup', 'resume', 'clear', 'fork']) {
  test(`AC3 source=${source} → 출력 0바이트 · exit 0`, () => {
    const r = run(JSON.stringify({ source }));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout, '');
  });
}

test('AC4 소스 — node:fs는 readFileSync만 · 호출 1곳 · transcript_path·process.env 없음', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  const fsImports = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']node:fs["']/g)].map((m) => m[1].trim());
  assert.deepEqual(fsImports, ['readFileSync']);
  assert.ok(!/require\(\s*["'](node:)?fs["']\s*\)/.test(src));
  assert.ok(!/import\s+\*\s+as\s+\w+\s+from\s*["'](node:)?fs/.test(src));
  assert.equal((src.match(/readFileSync\(/g) || []).length, 1);
  assert.ok(!src.includes('transcript_path'));
  assert.ok(!src.includes('process.env'));
});
