# task-01 — 훅 테스트 작성 + RED (F5, D5)

**목적**: 1.0.0 훅 동작(비오르카 바이트 동일 · 오르카 (2-0)~(2-5)·폴백 · `--terminal` 바인딩 · 판정 로직 회귀 · E2E(안전 문자 집합 밖 핸들 포함) · 제목 절단 · 셸 안전 · 상태 프로브 fail-closed)을 `node --test` 케이스 11개로 고정하고, 0.19.0 훅에서 **RED(4 pass / 7 fail)** 를 확인한다. repo에는 파일을 추가하지 않는다(D5) — `.remember/`(gitignore, claude-memories 심링크) 아래에 둔다.

## Files

- Create: `.remember/hook-test-1.0.0/context-threshold-hook.test.mjs` (repo 밖 — `git status`에 나타나지 않는다)
- Modify: 없음
- Test: 이 파일 자체

## Prep

- spec §3 F5(케이스 목록), §5 AC1·AC2·AC5, §4 D5·D6. 엔트리포인트 SC-2(정본 문장 3종 — C1·C2 고정 문자열의 원천), SC-4(명령 상수 출력 계약), SC-5(needle 목록 = C4), SC-6(위치·실행·기대 RED/GREEN).
- 현행 확인: `grep -c 'orcaHandle' dev-workflow/hooks/scripts/context-threshold-hook.mjs` → 0 · `ls -la .remember | head -3`(심링크 → `~/workspace/claude-memories/claude-dev-workflow/remember`) · `git check-ignore -q .remember && echo IGNORED`.

## Deps

없음.

## Steps

### 1. 테스트 파일 작성

```bash
mkdir -p .remember/hook-test-1.0.0
cat > .remember/hook-test-1.0.0/context-threshold-hook.test.mjs <<'TEST_EOF'
// 1.0.0 오르카 후계 세션 — Stop 훅 테스트 (D5: repo 파일 아님, .remember/ 아래에서 node --test로 실행)
// 실행: HOOK=<훅 절대경로> node --test <이 파일>
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const HOOK = process.env.HOOK;
if (!HOOK) throw new Error("HOOK=<context-threshold-hook.mjs 절대경로> 가 필요하다");
const { decideNudge } = await import(pathToFileURL(HOOK).href);

const H = "term_a39dabc5-f1d9-40ac-a081-3fa97b258356";
const base = { threshold: 0.4, stopHookActive: false };
const first = (extra = {}) => decideNudge({ ...base, ratio: 0.5, lastNudgeStep: null, ...extra });
const renudge = (extra = {}) => decideNudge({ ...base, ratio: 0.6, lastNudgeStep: 0, ...extra });

// ── 비오르카: 0.19.0 문자열에서 (0)의 마지막 문장 1개만 교체(고정 문자열 스냅샷, AC1) ──
const UNIT =
  `(0) 넛지 이후 새 작업 단위를 시작하지 마세요 — 작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회(phase·루프 전체가 아닙니다). ` +
  `진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 넛지 (2)의 인계 절차를 따르라. ` +
  `이 지시는 이 턴에서 끝나지 않고 완료 알림으로 깨어난 뒤에도 유효합니다. `;
const HANDOFF_FIRST = `(1) repo·트랙 규약이 정한 핸드오프 파일(기본 .remember/remember.md)에 현재 작업 상태(무엇을 하던 중인지·다음 할 일·미해결 항목)를 핸드오프로 작성하세요. review-loop 실행 중이면 그 스킬의 루프 파일에 그 스킬의 핸드오프 규정대로 쓰세요. `;
const HANDOFF_RE = `(1) repo·트랙 규약이 정한 핸드오프 파일(기본 .remember/remember.md)에 현재 작업 상태(무엇을 하던 중인지·다음 할 일·미해결 항목)를 핸드오프로 작성하세요 — 이미 작성했다면 그 뒤의 진행분을 반영해 갱신하세요. review-loop 실행 중이면 그 스킬의 루프 파일에 그 스킬의 핸드오프 규정대로 쓰세요. `;
const CLEAR = `(2) 사용자에게 "이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요"라고 안내하세요. 자가 /clear는 불가하므로 실제 초기화는 사용자가 합니다.`;

test("C1 비오르카 최초 넛지 = 고정 문자열", () => {
  const r = first();
  assert.equal(r.shouldNudge, true);
  assert.equal(r.reason, `컨텍스트 사용량이 약 50%로 임계(40%)를 넘었습니다. 멈추기 전에: ` + UNIT + HANDOFF_FIRST + CLEAR);
});

test("C2 비오르카 재넛지 = 고정 문자열", () => {
  const r = renudge();
  assert.equal(r.shouldNudge, true);
  assert.equal(r.reason, `컨텍스트 사용량이 약 60%입니다. 임계(40%)에서 한 번 안내했고 그 뒤로 더 늘었습니다. 멈추기 전에: ` + UNIT + HANDOFF_RE + CLEAR);
});

test("C3 비오르카(orcaHandle 생략·null·빈 문자열 아님)에는 후계 절차가 없다", () => {
  for (const r of [first(), first({ orcaHandle: null })]) {
    assert.ok(!r.reason.includes("terminal create"));
    assert.ok(!r.reason.includes("(2-0)"));
    assert.ok(r.reason.includes("자가 /clear는 불가"));
  }
});

// ── 오르카: reason에 (2-0)~(2-5)·폴백·옛 핸들, "자가 /clear는 불가" 없음 (AC1·AC2) ──
const NEEDLES = [
  // (2-0) CLI 해소 순서 + 사전 검증 + review gate 사전 조건(R1-1·R6-2·C2)
  "ORCA_CLI_COMMAND가 있으면 그 값, 없고 ORCA_DEV_REPO_ROOT가 있으면 orca-dev, 그 외 orca",
  `"$CLI" terminal show --terminal "${H}" --json`,
  "installed_plugins.json",
  "resolveStateFile(process.cwd())",
  'stopReviewGate===true?"GATE_ON":"GATE_OFF"',
  "STATE_UNREADABLE",
  "GATE_ON이면 자동 인계를 하지 않고 [폴백]",
  "loadState",
  "status --all",
  // (2-1) 토큰·제목 정규화·예약 절단·정확 조회 (R2-3·R3-1·R4-1)
  "[A-Za-z0-9._-]",
  "전체 길이 ≤ 40",
  'TITLE="${NAME:0:$((40 - ${#TOKEN} - 1))}-$TOKEN"',
  '"$CLI" terminal create --worktree active --title "$TITLE" --command claude --json',
  "result.startupTerminal.handle",
  '"$CLI" terminal list --worktree active --json',
  "정확히 1개가 아니면(0 또는 2+) [폴백]",
  "successor",
  // (2-2)
  '"$CLI" terminal wait --terminal "<새 핸들>" --for tui-idle --timeout-ms 90000 --json',
  "--timeout-ms 180000",
  // (2-3) 프롬프트 파일 + "$(cat …)" 전달 + turn_started + --retry-request (R2-2·R1-2)
  `cat > ".remember/successor-$TOKEN.prompt" <<'SUCCESSOR_PROMPT_EOF'`,
  `--wait-submit 15 --json --text "$(cat ".remember/successor-$TOKEN.prompt")"`,
  "result.send.prompt.stages에 turn_started",
  "--wait-submit 30 --retry-request <id>",
  // (2-4) 재개 프롬프트 템플릿: 0번째 동작(R5-3·R6-1a) · 첫 동작 세 명령 + 성공 조건(R2-1·R5-2·C1) · D4 · D9
  "[0번째 동작 — 공유 브로커 단일 실행권 검사]",
  "FOREIGN_ACTIVE",
  "15초 간격",
  "상한 10분",
  "[첫 동작 — 옛 세션 정상 종료]",
  "--terminal 생략 금지",
  `"$CLI" terminal send --terminal "${H}" --text "/exit" --enter --json`,
  `"$CLI" terminal wait --terminal "${H}" --for exit --timeout-ms 30000 --json`,
  "tui-idle 불인정",
  "Resume this session with",
  `"$CLI" terminal close --terminal "${H}" --json`,
  "close도 codex 시작도 하지 말고",
  "닫기가 실패하면 사용자에게 알리고 codex 라운드를 시작하지 마라",
  "다른 단계(spec→plan, plan→impl)의 시작이면 시작하지 말고 사용자에게 확인하라",
  "/review-loop --resume",
  // (2-5)
  "(2-5) turn_started를 확인했으면 더 아무것도 하지 말고 턴을 끝내세요",
  // 폴백 4종 + 정리 방식 + 소멸 확인 + 복귀 문장 (F2·R1-3·D10)
  "[폴백] 조건 4종: (a)",
  "(b) (2-2) wait satisfied:false",
  "(c) (2-3) turn_started 미확인",
  "(d) CLI 실행 오류",
  "재생성과 /clear 안내를 모두 차단",
  "미전달이 확정되기 전(재관찰·재조정 중)에는 후계를 닫지 마세요",
  `"$CLI" terminal wait --terminal "<새 핸들>" --for exit --timeout-ms 30000 --json`,
  "/exit 처리 증거 없이 close하지 마세요",
  "소멸을 확인하고",
  "소멸이 확인된 경우에만",
  "/clear를 안내하지 말고 차단 상태",
  `"이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요"라고 안내하세요`,
];

test("C4 오르카 최초 넛지 — (2-0)~(2-5)·폴백·옛 핸들 그대로, '자가 /clear는 불가' 없음", () => {
  const r = first({ orcaHandle: H });
  assert.equal(r.shouldNudge, true);
  assert.ok(r.reason.startsWith(`컨텍스트 사용량이 약 50%로 임계(40%)를 넘었습니다. 멈추기 전에: ` + UNIT + HANDOFF_FIRST + "(2) "));
  for (const k of ["(2-0)", "(2-1)", "(2-2)", "(2-3)", "(2-4)", "(2-5)", "[폴백]"]) assert.ok(r.reason.includes(k), k);
  assert.ok(r.reason.includes(`(핸들 ${H})`));
  assert.ok(!r.reason.includes("자가 /clear는 불가"));
  const missing = NEEDLES.filter((n) => !r.reason.includes(n));
  assert.deepEqual(missing, []);
});

test("C5 오르카 재넛지 = 최초와 같은 (2) (D6: 지시 동일 + 사실 추가)", () => {
  const a = first({ orcaHandle: H }).reason;
  const b = renudge({ orcaHandle: H }).reason;
  assert.ok(b.startsWith(`컨텍스트 사용량이 약 60%입니다. 임계(40%)에서 한 번 안내했고 그 뒤로 더 늘었습니다. 멈추기 전에: ` + UNIT + HANDOFF_RE));
  assert.equal(a.slice(a.indexOf("(2) ")), b.slice(b.indexOf("(2) ")));
});

test("C6 오르카 reason 안의 send/wait/close/read/show 전부 --terminal 바인딩(옛 핸들 또는 새 핸들)", () => {
  const r = first({ orcaHandle: H }).reason;
  const all = [...r.matchAll(/"\$CLI" terminal (send|wait|close|read|show)([^\n]{0,40})/g)];
  assert.ok(all.length >= 10, `명령 수 ${all.length}`);
  const unbound = all.filter((m) => !m[2].startsWith(" --terminal "));
  assert.deepEqual(unbound.map((m) => m[0]), []);
  // 옛 핸들 바인딩은 --terminal "<옛 핸들>" 리터럴, 새 핸들은 "<새 핸들>" 자리표시자만
  assert.ok(!/terminal (send|wait|close) --terminal "(?!<새 핸들>"|term_)/.test(r));
});

// ── 기존 동작 불변: stopHookActive·구간 로직 (7a·0.18.0 회귀) ──
test("C7 판정 로직 불변(orcaHandle 유무와 무관)", () => {
  const cases = [
    [0.39, null, false, null],
    [0.4, null, true, 0],
    [0.54, 0, false, 0],
    [0.55, 0, true, 1],
    [0.2, 3, false, null],
    [0.85, 1, true, 3],
  ];
  for (const orcaHandle of [null, H]) {
    for (const [ratio, last, nudge, next] of cases) {
      const r = decideNudge({ ratio, threshold: 0.4, stopHookActive: false, lastNudgeStep: last, orcaHandle });
      assert.equal(r.shouldNudge, nudge, `${ratio}/${last}/${orcaHandle}`);
      assert.equal(r.nextStep, next, `${ratio}/${last}/${orcaHandle}`);
    }
    const s = decideNudge({ ratio: 0.9, threshold: 0.4, stopHookActive: true, lastNudgeStep: 2, orcaHandle });
    assert.deepEqual(s, { shouldNudge: false, reason: "", nextStep: 2 });
  }
});

// ── E2E: main()이 ORCA_TERMINAL_HANDLE 값을 그대로 넘긴다(빈 문자열 = 미설정) ──
test("C8 E2E ORCA_TERMINAL_HANDLE 유무·안전 문자 집합으로 (2)가 갈린다", () => {
  const dir = mkdtempSync(join(tmpdir(), "ctx-hook-"));
  try {
    const transcript = join(dir, "t.jsonl");
    writeFileSync(transcript, JSON.stringify({ message: { role: "assistant", model: "claude-x", usage: { input_tokens: 500_000 } } }) + "\n");
    const run = (env, sid) =>
      spawnSync(process.execPath, [HOOK], {
        input: JSON.stringify({ stop_hook_active: false, transcript_path: transcript, session_id: sid }),
        env: { ...process.env, CLAUDE_CTX_LIMIT: "1000000", ...env },
        encoding: "utf8",
      });
    const orca = run({ ORCA_TERMINAL_HANDLE: H }, "e2e-orca");
    assert.equal(orca.status, 0);
    const o = JSON.parse(orca.stdout);
    assert.equal(o.decision, "block");
    assert.ok(o.reason.includes(`--terminal "${H}"`));
    const plain = run({ ORCA_TERMINAL_HANDLE: "" }, "e2e-plain");
    const p = JSON.parse(plain.stdout);
    assert.ok(p.reason.endsWith(CLEAR));
    // 안전 문자 집합([A-Za-z0-9._-]) 밖 핸들 = 오염된 환경 → 오르카 밖 경로. 셸 명령에 보간되지 않는다(R1-1)
    const hostile = run({ ORCA_TERMINAL_HANDLE: 'term_bad"; printf INJECTED; #' }, "e2e-hostile");
    const q = JSON.parse(hostile.stdout);
    assert.ok(q.reason.endsWith(CLEAR));
    assert.ok(!q.reason.includes("INJECTED") && !q.reason.includes("terminal create"));
    const stopped = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ stop_hook_active: true, transcript_path: transcript, session_id: "e2e-stop" }),
      env: { ...process.env, ORCA_TERMINAL_HANDLE: H },
      encoding: "utf8",
    });
    assert.equal(stopped.status, 0);
    assert.equal(stopped.stdout, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
    for (const s of ["e2e-orca", "e2e-plain", "e2e-hostile", "e2e-stop"]) rmSync(join(tmpdir(), `claude-ctx-nudge-${s}`), { force: true });
  }
});

// ── 제목 규칙(문구가 지시하는 셸 식)을 실제 bash에서: 토큰 예약 절단(R4-1) + 정확 조회 ──
test("C9 40자 초과 작업명에서도 토큰이 온전히 남고 title 정확 조회가 1건", () => {
  const NAME = "review-loop-impl-round-3-ledger-fix-and-readme-sync-long-name"; // 62자
  const TOKEN = "213045ab7k";
  const title = execFileSync("bash", ["-c", 'NAME="$1"; TOKEN="$2"; TITLE="${NAME:0:$((40 - ${#TOKEN} - 1))}-$TOKEN"; printf %s "$TITLE"', "_", NAME, TOKEN], { encoding: "utf8" });
  assert.equal(title.length, 40);
  assert.ok(title.endsWith(`-${TOKEN}`));
  assert.equal(title, `${NAME.slice(0, 29)}-${TOKEN}`);
  const list = [{ title: "◑ Claude Code" }, { title }, { title: `${title}x` }, { title: title.slice(0, 39) }];
  assert.equal(list.filter((t) => t.title === title).length, 1);
});

// ── 셸 안전(R3-1): 정규화 규칙을 메타문자 입력에 적용하면 큰따옴표 안에서 치환이 일어나지 않는다 ──
test("C10 정규화된 제목은 $()·백틱·따옴표가 없어 셸 큰따옴표 안에서 원문 그대로다", () => {
  const hostile = '$(printf SUBSTITUTED) `id` "x" \'y\' a b';
  const normalized = hostile.replace(/[^A-Za-z0-9._-]/g, "-");
  assert.match(normalized, /^[A-Za-z0-9._-]+$/);
  const out = execFileSync("bash", ["-c", `printf %s "${normalized}"`], { encoding: "utf8" });
  assert.equal(out, normalized);
  assert.ok(out.includes("-printf-SUBSTITUTED-")); // printf 토큰이 글자로 남아 있다 = 실행되지 않았다
  const control = execFileSync("bash", ["-c", 'printf %s "$(printf SUBSTITUTED)"'], { encoding: "utf8" });
  assert.equal(control, "SUBSTITUTED"); // 대조군: 정규화 없이 큰따옴표에 넣으면 실행된다
});

// ── 상태 프로브 fail-closed(R6-1a·C2·plan R1-2): reason이 지시하는 STATE_PROBE_CMD를 가짜 companion 루트로 실제 실행 ──
test("C11 STATE_PROBE_CMD는 손상·스키마 이탈 상태를 STATE_UNREADABLE(exit 2)로 차단한다", () => {
  const r = first({ orcaHandle: H }).reason;
  const a = r.indexOf("node -e 'const fs=require(\"fs\");import(");
  const b = r.indexOf(". 출력이 GATE_ON", a);
  assert.ok(a > 0 && b > a, "STATE_PROBE_CMD 위치");
  const probe = r.slice(a, b); // `node -e '…' "$CR"` — CR은 env로 준다
  const dir = mkdtempSync(join(tmpdir(), "ctx-probe-"));
  try {
    mkdirSync(join(dir, "cr", "scripts", "lib"), { recursive: true });
    writeFileSync(join(dir, "cr", "scripts", "lib", "state.mjs"), "export function resolveStateFile() { return process.env.FAKE_STATE_FILE; }\n");
    const f = join(dir, "state.json");
    const run = (content) => {
      if (content === null) rmSync(f, { force: true }); else writeFileSync(f, content);
      const p = spawnSync("bash", ["-c", probe], { env: { ...process.env, CR: join(dir, "cr"), FAKE_STATE_FILE: f, CODEX_COMPANION_SESSION_ID: "me" }, encoding: "utf8" });
      return [p.stdout.trim(), p.status];
    };
    assert.deepEqual(run(null), ["GATE_OFF FOREIGN_ACTIVE=0", 0]); // 파일 부재 = 잡 없음
    assert.deepEqual(run('{"config":{"stopReviewGate":true},"jobs":[{"status":"running","sessionId":"other"},{"status":"queued","sessionId":"me"},{"status":"done","sessionId":"x"}]}'), ["GATE_ON FOREIGN_ACTIVE=1", 0]);
    assert.deepEqual(run('{"version":1,"config":{"stopReviewGate":false},"jobs":[]}'), ["GATE_OFF FOREIGN_ACTIVE=0", 0]); // companion saveState 형태
    // 파일이 있으면 config·jobs 둘 다 필수 + 중첩 타입(R3-1·R2-2) — 어느 하나라도 이탈하면 차단
    for (const bad of ["[]", "null", "42", "not json", "{}", '{"jobs":[]}', '{"config":{"stopReviewGate":false}}', '{"config":{},"jobs":[]}', '{"config":{"stopReviewGate":false},"jobs":"x"}', '{"config":{"stopReviewGate":false},"jobs":{}}', '{"config":{"stopReviewGate":false},"jobs":[null]}', '{"config":{"stopReviewGate":false},"jobs":[{"status":1,"sessionId":"x"}]}', '{"config":[],"jobs":[]}', '{"config":null,"jobs":[]}', '{"config":{"stopReviewGate":"true"},"jobs":[]}', '{"config":{"stopReviewGate":1},"jobs":[]}']) {
      assert.deepEqual(run(bad), ["STATE_UNREADABLE", 2], bad);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
TEST_EOF
wc -l .remember/hook-test-1.0.0/context-threshold-hook.test.mjs    # 249
```

### 2. RED 확인 (0.19.0 훅)

```bash
HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs 2>&1 | grep -E '^(ok|not ok|# (tests|pass|fail))'
```
기대(그대로):
```
not ok 1 - C1 비오르카 최초 넛지 = 고정 문자열
not ok 2 - C2 비오르카 재넛지 = 고정 문자열
ok 3 - C3 비오르카(orcaHandle 생략·null·빈 문자열 아님)에는 후계 절차가 없다
not ok 4 - C4 오르카 최초 넛지 — (2-0)~(2-5)·폴백·옛 핸들 그대로, '자가 /clear는 불가' 없음
not ok 5 - C5 오르카 재넛지 = 최초와 같은 (2) (D6: 지시 동일 + 사실 추가)
not ok 6 - C6 오르카 reason 안의 send/wait/close/read/show 전부 --terminal 바인딩(옛 핸들 또는 새 핸들)
ok 7 - C7 판정 로직 불변(orcaHandle 유무와 무관)
not ok 8 - C8 E2E ORCA_TERMINAL_HANDLE 유무·안전 문자 집합으로 (2)가 갈린다
ok 9 - C9 40자 초과 작업명에서도 토큰이 온전히 남고 title 정확 조회가 1건
ok 10 - C10 정규화된 제목은 $()·백틱·따옴표가 없어 셸 큰따옴표 안에서 원문 그대로다
not ok 11 - C11 STATE_PROBE_CMD는 손상·스키마 이탈 상태를 STATE_UNREADABLE(exit 2)로 차단한다
# tests 11
# pass 4
# fail 7
```
C1·C2는 (0) 문장 교체 때문에, C4·C5·C6·C8·C11은 오르카 분기 부재 때문에 실패한다(C11은 reason에 STATE_PROBE_CMD가 없어 위치 단언에서 실패). C3·C7·C9·C10은 현행에서도 통과하는 회귀·규칙 케이스다(자동 보완 — RED 미재현은 실패가 아니라 기록 대상).

### 3. repo 무변경 확인 (커밋 없음)

```bash
git status --short | wc -l        # 0 — .remember/는 gitignore
```

## Acceptance Criteria

```bash
[ -f .remember/hook-test-1.0.0/context-threshold-hook.test.mjs ] && echo FILE_OK
git status --short | wc -l                                                      # 0 (D5·AC5 — repo 파일 없음)
git ls-files | grep -c 'hook-test'                                              # 0
HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs 2>&1 | grep -E '^# (pass|fail)'   # "# pass 4" / "# fail 7"
grep -c '^test("C' .remember/hook-test-1.0.0/context-threshold-hook.test.mjs   # 11 (AC5 케이스 ≥ 5)
```

## Cautions

- **테스트 파일을 repo 안(`dev-workflow/` · `docs/` · `test/`)에 두지 않는다. 이유: D5(08-09 D10) — repo에는 테스트 러너·package.json이 없고 인프라 신설은 G1·G2 저촉.**
- **C1·C2의 고정 문자열을 "비슷하게" 고쳐 쓰지 않는다. 이유: AC1 = 0.19.0과 바이트 동일(교체 문장 1개 제외) — 문자열은 SC-2와 0.19.0 훅 원문에서 그대로 온다. 테스트가 통과하지 않으면 훅(task-02)을 고치지 테스트를 고치지 않는다.**
- **needle 목록을 줄이지 않는다. 이유: SC-5가 계약이고 각 항목이 spec ledger의 FIXED 행(R1-1~C2)에 대응한다 — 하나를 빼면 그 finding의 회귀를 놓친다.**
- **C10의 대조군(정규화 없이 `$(printf SUBSTITUTED)`를 큰따옴표에 넣으면 `SUBSTITUTED`가 나온다)을 지우지 않는다. 이유: 정규화가 실제로 무언가를 막았다는 증거가 그 대조군이다.**
- **`node --test`를 `.remember/` 디렉터리 전체에 대해 돌리지 않는다(`node --test .remember/`). 이유: 다른 트랙의 하네스·잔여 파일이 섞인다 — 파일 하나를 지정한다.**
