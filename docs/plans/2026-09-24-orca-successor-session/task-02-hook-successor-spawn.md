# task-02 — 훅 오르카 분기·후계 스폰 절차·폴백 → GREEN + AC5 기록 (F1·F2·F5)

**목적**: `decideNudge`에 `orcaHandle` 인자를 더해 (2)를 가른다 — 오르카면 후계 스폰·인계 절차(2-0)~(2-5)와 [폴백], 아니면 0.19.0 그대로. (0)의 마지막 문장은 양 경로 공통 SC-2 HOOK-②로 교체. `main()`은 `ORCA_TERMINAL_HANDLE`을 넘긴다. task-01 테스트를 GREEN 11/11로 만들고, 문면이 지시하는 셸 스니펫을 실제로 실행해 확인한 뒤, 엔트리포인트에 AC5 기록 절을 쓴다.

## Files

- Modify: `dev-workflow/hooks/scripts/context-threshold-hook.mjs` — **파일 전체를 §2의 내용으로 교체**(10,071B → 약 25,800B). 바뀌는 구역: 헤더 주석(2~9행) · 상수 3종 + `orcaHandoff()` 신설(`computeContextUsage` 뒤) · `decideNudge` 시그니처·`unit` 마지막 문장·`handover` 분기 · `resolveOrcaHandle()` 신설 · `main()` 호출부 1줄. `computeContextUsage`·`flagPath`·`readStep`·`persistStep`·`resolveThreshold`·`invokedDirectly`는 바이트 동일.
- Modify: `docs/plans/2026-09-24-orca-successor-session.md` — 말미에 `## 훅 테스트 기록 (AC5, D5)` 절 추가(§6)
- Test: `.remember/hook-test-1.0.0/context-threshold-hook.test.mjs`(task-01) — RED → GREEN

## Prep

- spec §3 F1(설계 골격 0~5)·F2(폴백 4종·정리 방식), §4 D2·D3·D4·D6·D7·D9·D10·D12, AC1·AC2·AC5, spec ledger FIXED 행(R1-1·R1-2·R1-3·R2-1·R2-2·R2-3·R3-1·R4-1·R5-2·R5-3·R6-1a·R6-2·C1·C2 — 문면의 각 문장이 어느 행에서 왔는지). 엔트리포인트 SC-2·SC-3·SC-4·SC-5·SC-6.
- 실측 근거: `~/workspace/dev-workflow-eval/report/ORCA-SUCCESSOR-2026-09-24.md`(E1~E5) · orca-cli 스킬(`~/.agents/skills/orca-cli/SKILL.md` — CLI 해소 순서, `accepted:true ≠ turn_started`, `--retry-request`).
- 현행 확인: `sed -n '57,62p;98,108p;177,182p' dev-workflow/hooks/scripts/context-threshold-hook.mjs`.

## Deps

task-01.

## Steps

### 1. RED 확인

```bash
HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs 2>&1 | grep -E '^# (pass|fail)'   # pass 4 / fail 7
```

### 2. 훅 파일 전체 교체

`dev-workflow/hooks/scripts/context-threshold-hook.mjs`를 아래 내용으로 **통째로** 쓴다(quoted heredoc — 본문의 `${`·백틱은 셸에서 재평가되지 않는다):

```bash
cat > dev-workflow/hooks/scripts/context-threshold-hook.mjs <<'HOOK_EOF'
#!/usr/bin/env node
// 컨텍스트 임계 Stop 훅: transcript 마지막 assistant usage로 컨텍스트 사용량을 계산하고,
// 임계(기본 40%) 초과 시 핸드오프 작성 + /clear 안내를 넛지한다.
// 오르카 터미널(ORCA_TERMINAL_HANDLE)에서는 /clear 안내 대신 같은 체크아웃에 후계 세션을 띄워 인계하는 절차를 지시한다(1.0.0).
// 넛지는 1회가 아니라 15%p 구간마다 재발화한다(기본 임계에서 40 → 55 → 70 → 85%, 상한 없음).
// 넛지의 의미는 "현재 작업 단위만 마무리, 새 단위 착수 금지"이며 백그라운드 완료 알림으로 깨어난 뒤에도 유효하다(F6).
// 윈도 상한은 기본 1M(최신 모델 기준) — 200k 세션은 CLAUDE_CTX_LIMIT로 명시한다.
// Stop 훅 계약: stdin JSON 입력, 넛지 시 {"decision":"block","reason":...} 출력, 그 외 exit 0.
// 오르카 밖에서는 자가 /clear가 불가하므로 실제 초기화는 사용자가 한다(설계 §2).

import { readFileSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_LIMIT = 1_000_000;
const DEFAULT_THRESHOLD = 0.4;
// 재넛지 구간 폭(15%p 고정). 임계 비례가 아니라 절대 폭이다.
const STEP = 0.15;
// 부동소수점 보정: (0.70 - 0.40) / 0.15 는 1.9999999999999996이라 보정 없이 floor하면
// 70%·115% 구간이 한 칸 앞으로 잘못 분류되어 그 지점의 넛지가 통째로 누락된다.
// 사용률을 양자화하지 않고 오차만 흡수하므로 경계 직전값은 여전히 이전 구간에 남는다.
const EPS = 1e-9;

// transcript JSONL 텍스트에서 마지막 assistant usage를 찾아 컨텍스트 사용량을 계산한다.
export function computeContextUsage(transcriptText, env = {}) {
  const lines = String(transcriptText).split(/\r?\n/);
  const usedOf = (u) =>
    ((u && u.input_tokens) || 0) +
    ((u && u.cache_read_input_tokens) || 0) +
    ((u && u.cache_creation_input_tokens) || 0);
  let last = null;
  for (const line of lines) {
    if (line.trim() === "") continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = obj && obj.message;
    if (msg && msg.role === "assistant" && msg.usage) last = msg;
  }
  if (!last) return null;
  const used = usedOf(last.usage);
  const model = last.model || "";
  const envLimit = Number(env.CLAUDE_CTX_LIMIT);
  // 컨텍스트 윈도 크기는 런타임에서 알 수 없다 — transcript의 message.model은 베어 ID
  // ("claude-opus-5")만 담고 Claude Code 화면 라벨의 "[1m]" 접미사가 없으며, usage·diagnostics에도
  // 윈도 크기가 없다. /model 런타임 선택은 settings.json에도 기록되지 않는다.
  // 그래서 최신 모델 기준인 1M을 기본으로 두고, 200k 세션에서만 CLAUDE_CTX_LIMIT로 명시한다.
  // (과대평가가 더 해롭다: 1M 세션에 200k를 가정하면 실제 8% 사용 시점에 40% 임계로 오판해
  //  멀쩡한 작업을 조기 종료시킨다. 과소평가는 auto-compact가 후위 안전망으로 남는다.)
  const limit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : DEFAULT_LIMIT;
  return { used, limit, ratio: used / limit, model };
}

// 오르카 경로 (2)에서 두 번(옛 세션 사전 조건 · 후계 0번째 동작) 쓰는 명령 원문.
// codex companion 루트 = 레지스트리 해소(review-loop §2b ①과 같은 우선순위: cwd 일치 project/local > user > managed).
// 상태 프로브 = 상태 파일을 직접 한 번 읽어 JSON.parse한 동일 객체에서 config.stopReviewGate와 jobs를 함께 읽는다
// (loadState는 읽기·파싱 실패를 기본값으로 숨기고, status --all은 자기 세션 잡만 보여준다 — 둘 다 쓰지 않는다).
// 부재 판정은 readFileSync의 ENOENT만이다 — existsSync는 권한(EACCES)·경로(EISDIR 등) 오류도 false로 축약해 "파일 없음"으로
// 오인시킨다(plan R5-1). ENOENT 외 읽기 오류 = STATE_UNREADABLE(exit 2).
// 루트가 객체가 아니거나(배열 포함 — typeof []도 "object"다) jobs가 배열이 아니거나 config가 객체가 아니면
// STATE_UNREADABLE(exit 2) — 손상·스키마 이탈도 fail-closed(빈 잡·GATE_OFF로 오인하지 않는다). 중첩 필드도 같다:
// 파일이 있으면 config·jobs 둘 다 필수(companion saveState는 항상 {version,config,jobs}를 쓴다 — 하나라도 없으면 부분
// 손상이지 빈 상태가 아니다, plan R3-1). jobs[] 항목은 객체이고 status가 문자열, config.stopReviewGate는 boolean 필수 —
// 문자열 "true"는 companion Stop 훅이 truthy로 소비해 게이트가 켜진 것과 같으므로 ===true 비교로 GATE_OFF를 내면
// 사전 조건이 우회된다(plan R2-2).
const COMPANION_ROOT_CMD =
  `P="\${CLAUDE_CODE_PLUGIN_CACHE_DIR:-\${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins}"; ` +
  `CR=$(node -e 'const fs=require("fs"),p=require("path");let d;try{d=JSON.parse(fs.readFileSync(p.join(process.argv[1],"installed_plugins.json"),"utf8"))}catch{process.exit(1)};` +
  `const r=e=>e.projectPath===process.argv[2]?0:e.scope==="user"?1:e.scope==="managed"?2:9;` +
  `const a=((d.plugins||{})["codex@openai-codex"]||[]).filter(e=>r(e)<9).sort((x,y)=>r(x)-r(y))[0];` +
  `if(!a||!fs.existsSync(p.join(a.installPath,"scripts","lib","state.mjs")))process.exit(1);console.log(a.installPath)' "$P" "$PWD") || echo RESOLVE_FAIL`;
const STATE_PROBE_CMD =
  `node -e 'const fs=require("fs");import(require("url").pathToFileURL(process.argv[1]+"/scripts/lib/state.mjs").href).then(m=>{` +
  `const f=m.resolveStateFile(process.cwd());let raw;try{raw=fs.readFileSync(f,"utf8")}catch(e){if(e&&e.code==="ENOENT"){console.log("GATE_OFF FOREIGN_ACTIVE=0");return}console.log("STATE_UNREADABLE");process.exit(2)}` +
  `let s;try{s=JSON.parse(raw)}catch{s=null}` +
  `const obj=v=>!!v&&typeof v==="object"&&!Array.isArray(v);` +
  `const jobsOk=v=>Array.isArray(v)&&v.every(j=>obj(j)&&typeof j.status==="string");` +
  `const cfgOk=v=>obj(v)&&typeof v.stopReviewGate==="boolean";` +
  `if(!obj(s)||!jobsOk(s.jobs)||!cfgOk(s.config)){console.log("STATE_UNREADABLE");process.exit(2)}` +
  `const me=process.env.CODEX_COMPANION_SESSION_ID||"";` +
  `const n=s.jobs.filter(j=>(j.status==="queued"||j.status==="running")&&j.sessionId!==me).length;` +
  `console.log((s.config&&s.config.stopReviewGate===true?"GATE_ON":"GATE_OFF")+" FOREIGN_ACTIVE="+n)}).catch(()=>{console.log("STATE_UNREADABLE");process.exit(2)})' "$CR"`;
const CLI_RESOLVE_CMD = `CLI="\${ORCA_CLI_COMMAND:-$( [ -n "$ORCA_DEV_REPO_ROOT" ] && echo orca-dev || echo orca )}"`;

// 오르카 경로의 (2) — 후계 스폰·인계 절차. h = 옛 세션(이 세션)의 터미널 핸들.
// 명령은 플래그까지 정확히 적는다(D6: 길이 상한 없음 — 세션당 수 회, 플래그 추측 방지).
function orcaHandoff(h) {
  const successorPrompt =
    `핸드오프 파일 <경로>를 읽고 같은 작업을 이어서 진행하라. 너는 오르카 터미널에서 옛 세션(핸들 ${h})의 후계로 띄워진 claude 세션이다. 반드시 아래 순서대로 하고, 그 전에는 codex를 실행하지 마라. ` +
    `CLI 해소 = ORCA_CLI_COMMAND가 있으면 그 값, 없고 ORCA_DEV_REPO_ROOT가 있으면 orca-dev, 그 외 orca: ${CLI_RESOLVE_CMD}. 아래의 $CLI는 자리표시자다 — 도구 호출 사이에 셸 변수는 남지 않으니 해소한 실행 파일 값을 리터럴로 치환해 실행하라(빈 값이면 실행하지 말고 다시 해소). ` +
    `[0번째 동작 — 공유 브로커 단일 실행권 검사] /exit를 보내기 전에 이 폴더의 codex 상태 파일을 직접 한 번 읽어(cwd = repo 루트) queued/running 잡 중 자기 세션 외(sessionId ≠ CODEX_COMPANION_SESSION_ID)의 것을 센다 — codex-companion status --all은 자기 세션 잡만 보여주고 loadState는 파싱 실패를 빈 목록으로 숨기므로 둘 다 쓰지 않는다: ${COMPANION_ROOT_CMD}; ${STATE_PROBE_CMD}. ` +
    `출력의 FOREIGN_ACTIVE가 0이 아니면 15초 간격으로 다시 세어 0이 될 때까지 기다린다(상한 10분 = 40회). 상한에 닿으면 사용자에게 보고하고 /exit와 codex 시작을 모두 보류하라 — 옛 세션의 SessionEnd가 폴더 공유 브로커를 내려 그 잡을 죽인다. STATE_UNREADABLE(읽기·파싱 실패)은 "잡 없음"이 아니라 차단이다 — 사용자에게 보고하고 보류하라. RESOLVE_FAIL도 보고·보류. 파일 부재 = 잡 없음(GATE_OFF FOREIGN_ACTIVE=0). ` +
    `[첫 동작 — 옛 세션 정상 종료] 세 명령 모두 --terminal "${h}"에 바인딩한다(--terminal 생략 금지 — 생략하면 활성 터미널이 대상이 되어 너 자신이나 무관한 탭을 닫는다): ` +
    `① "$CLI" terminal send --terminal "${h}" --text "/exit" --enter --json → 영수증 result.send.accepted가 true. ` +
    `② "$CLI" terminal wait --terminal "${h}" --for exit --timeout-ms 30000 --json → result.wait.satisfied가 true(claude 프로세스 종료 대기 — tui-idle은 옛 세션이 이미 idle이라 즉시 만족돼 증거가 못 된다). --for exit를 지원하지 않는 호스트면 "$CLI" terminal read --terminal "${h}" --json 의 마지막 줄들에 claude 종료 표지("Resume this session with" 안내)와 셸 프롬프트 복귀가 둘 다 보여야 한다(tui-idle 불인정). ` +
    `③ "$CLI" terminal close --terminal "${h}" --json → ok가 true, 그리고 "$CLI" terminal list --worktree active --json 에 "${h}"가 없어야 한다. ` +
    `어느 단계가 실패하거나 모호하면(예: send 실패인데 wait만 통과) close도 codex 시작도 하지 말고 상태를 사용자에게 보고하라 — close만 하면 SessionEnd가 건너뛰어져 브로커·잡이 고아가 된다. 첫 동작 전에 "${h}"가 terminal list에 이미 없으면 닫힌 것으로 보고 진행하고, 있는데 닫기가 실패하면 사용자에게 알리고 codex 라운드를 시작하지 마라. ` +
    `[단계 경계] 핸드오프의 다음 액션이 다른 단계(spec→plan, plan→impl)의 시작이면 시작하지 말고 사용자에게 확인하라.`;

  return (
    `(2) 이 세션은 오르카 터미널(핸들 ${h})에서 실행 중이므로 /clear 안내 대신 같은 체크아웃에 후계 claude 세션을 직접 띄워 인계합니다. 아래 (2-0)~(2-5)를 순서대로 수행하고, 각 단계의 성공 조건을 확인한 뒤에만 다음으로 넘어가세요. 어느 단계든 실패하면 [폴백]으로 갑니다. 셸 안전: 프롬프트·제목·경로를 셸 문자열에 직접 보간하지 마세요(백틱·$(…)·따옴표가 로컬에서 실행되거나 인자가 깨집니다) — 프롬프트는 파일로, 제목은 안전 문자 집합으로. 변수 보존: 아래 명령의 $CLI·$TOKEN·$TITLE·<새 핸들>은 자리표시자입니다 — 도구 호출마다 셸이 새로 시작되어 변수가 남지 않으므로, 실행할 때는 해소된 실제 값을 리터럴로 치환한 완결 명령으로 실행하거나 해소와 사용을 같은 호출 안에 두세요. 빈 값이 들어간 명령(예: successor-.prompt, 실행 파일 없는 terminal …)은 실행하지 마세요. ` +
    `(2-0) 사전 조건. ⓐ CLI 해소: ORCA_CLI_COMMAND가 있으면 그 값, 없고 ORCA_DEV_REPO_ROOT가 있으면 orca-dev, 그 외 orca — ${CLI_RESOLVE_CMD}. ` +
    `ⓑ 사전 검증: "$CLI" terminal show --terminal "${h}" --json 의 ok가 true가 아니면 그 CLI는 현재 인스턴스가 아닙니다 — 후계를 만들지 말고 [폴백]. ` +
    `ⓒ codex Stop review gate: 이 폴더의 codex 상태 파일을 직접 한 번 읽어 판정합니다(codex-companion의 loadState·status 서브커맨드는 실패를 기본값으로 숨기거나 자기 세션 잡만 보여주므로 쓰지 않습니다) — companion 루트 해소 뒤 상태 프로브: ${COMPANION_ROOT_CMD}; ${STATE_PROBE_CMD}. ` +
    `출력이 GATE_ON이면 자동 인계를 하지 않고 [폴백](그 게이트는 stop_hook_active를 보지 않고 동기 codex 작업 뒤 block을 돌려줄 수 있어 후계의 /exit가 그 턴을 끊습니다). STATE_UNREADABLE(읽기·파싱 실패 — 부재(ENOENT)만 잡 없음이고 권한·경로 오류는 차단)·RESOLVE_FAIL도 [폴백]. 파일 부재 = GATE_OFF·잡 없음. GATE_OFF일 때만 ⓓ로 진행합니다. ` +
    `ⓓ 생성 전 목록: (2-1) create 직전에 "$CLI" terminal list --worktree active --json 을 실행해 result.terminals[].handle 전부를 기록해 둡니다(create 응답 유실 시 회수 기준 — 탭 제목은 셸 프롬프트와 claude가 곧 덮어쓰므로 핸들 식별에 쓰지 않습니다). ok가 true가 아니거나 result.truncated가 false가 아니면 [폴백]. ` +
    `(2-1) 후계 생성. 토큰 = 이 세션이 만든 고유 상관 문자열(영숫자·하이픈만): TOKEN="$(date +%H%M%S)$(LC_ALL=C tr -dc a-z0-9 </dev/urandom | head -c 4)". 작업명 = 현재 작업을 요약한 짧은 이름을 [A-Za-z0-9._-] 문자만으로 짓고(그 외 문자는 -로 치환 — 공백·따옴표·백틱·$(…)를 남기지 않습니다), 마땅치 않으면 successor. 제목 = <작업명>-<토큰>, 전체 길이 ≤ 40 — 토큰과 하이픈 길이를 먼저 예약하고 작업명만 잘라 토큰을 온전히 붙입니다: NAME=<작업명>; TITLE="\${NAME:0:$((40 - \${#TOKEN} - 1))}-$TOKEN". ` +
    `생성: "$CLI" terminal create --worktree active --title "$TITLE" --command claude --json → 새 핸들 = result.startupTerminal.handle(없으면 result.terminal.handle). 제목은 탭 표시용입니다. 응답·JSON이 유실되면 재생성하지 말고 "$CLI" terminal list --worktree active --json 을 다시 실행해 ⓓ에서 기록한 핸들 집합에 없는 새 핸들로 회수합니다 — 새 핸들이 정확히 1개가 아니면(0 또는 2+) [폴백](차단 보고). 이 조회가 실패하거나 result.truncated가 true여도 [폴백](차단 보고). ` +
    `(2-2) 기동 대기: "$CLI" terminal wait --terminal "<새 핸들>" --for tui-idle --timeout-ms 90000 --json → result.wait.satisfied가 true여야 합니다. false면 --timeout-ms 180000으로 1회 재시도, 그래도 false면 [폴백]. ` +
    `(2-3) 재개 프롬프트 전달. 프롬프트는 파일로 조립합니다 — mkdir -p .remember; cat > ".remember/successor-$TOKEN.prompt" <<'SUCCESSOR_PROMPT_EOF' … SUCCESSOR_PROMPT_EOF (인용 heredoc — 내용은 셸에서 재평가되지 않습니다; 파일 내용 = (2-4) 템플릿의 <…>를 채운 것, 줄바꿈 없이 한 줄). 전달: "$CLI" terminal send --terminal "<새 핸들>" --enter --wait-submit 15 --json --text "$(cat ".remember/successor-$TOKEN.prompt")". ` +
    `영수증 result.send.prompt.stages에 turn_started가 있어야 인계 확정입니다(accepted:true는 입력 수락일 뿐 턴 시작 증명이 아닙니다). input_accepted에서 멈추면 재전송하지 말고 같은 영수증의 result.send.prompt.requestId로 같은 명령에 --wait-submit 30 --retry-request <id>를 붙여 1회 재관찰합니다. 응답 유실 등 모호한 전송 오류도 같은 --retry-request로 재조정합니다. 재관찰 뒤에도 turn_started가 없으면 [폴백]. ` +
    `(2-4) 재개 프롬프트 템플릿 — <경로> = repo·트랙 규약이 정한 핸드오프 파일(기본 .remember/remember.md). review-loop 실행 중이면 그 스킬 §2i가 정한 재개 문구(루프 파일 경로 + /review-loop --resume)를 "같은 작업을 이어서 진행하라" 자리에 넣습니다. 템플릿: 「${successorPrompt}」 ` +
    `(2-5) turn_started를 확인했으면 더 아무것도 하지 말고 턴을 끝내세요 — 후계가 이 세션을 닫습니다. 자기 터미널을 스스로 닫지 않습니다. 사용자에게는 후계 핸들·제목 한 줄만 남기세요. ` +
    `[폴백] 조건 4종: (a) (2-0) 사전 검증 실패 · (b) (2-2) wait satisfied:false(재시도 후) · (c) (2-3) turn_started 미확인(재관찰 후) · (d) CLI 실행 오류(재조정 후 — create 응답 유실은 생성 전후 핸들 집합 차분으로 회수를 먼저 시도하고, 핸들이 하나로 확정되지 않으면 재생성과 /clear 안내를 모두 차단하고 후보 핸들을 사용자에게 보고합니다). ` +
    `미전달이 확정되기 전(재관찰·재조정 중)에는 후계를 닫지 마세요 — 후계가 이미 프롬프트를 받아 이 세션에 /exit를 보내는 중일 수 있습니다. 확정되면 만들다 만 후계 터미널을 이 세션이 먼저 정리합니다: claude가 뜬 이력이 있으면(wait satisfied:true였거나 "$CLI" terminal read --terminal "<새 핸들>" --json 에 claude 프롬프트가 보이면) "$CLI" terminal send --terminal "<새 핸들>" --text "/exit" --enter --json → "$CLI" terminal wait --terminal "<새 핸들>" --for exit --timeout-ms 30000 --json(또는 "$CLI" terminal read --terminal "<새 핸들>" --json 의 종료 표지 + 셸 프롬프트 — tui-idle 불인정) → "$CLI" terminal close --terminal "<새 핸들>" --json; 뜨지 않았으면 close 직접. /exit 처리 증거 없이 close하지 마세요(증거가 없으면 사용자에게 보고). ` +
    `어느 쪽이든 "$CLI" terminal list --worktree active --json 로 소멸을 확인하고, 소멸이 확인된 경우에만 사용자에게 "이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요"라고 안내하세요. 핸들이 목록에 남아 있거나 조회가 실패·모호하면 /clear를 안내하지 말고 차단 상태(핸들·원인)를 사용자에게 보고한 뒤 정지하세요 — 남은 후계가 뒤늦게 프롬프트를 처리해 /clear로 재개한 세션에 /exit를 보내거나 같은 작업을 중복 수행할 수 있습니다.`
  );
}

// 넛지 여부 결정(순수 함수).
// lastNudgeStep = 마지막으로 넛지한 구간 인덱스(아직 없으면 null).
// nextStep = 호출자가 영속화해야 할 다음 상태(null이면 "아직 넛지 없음" = 플래그 삭제).
// 넛지하지 않는 호출에서도 nextStep이 바뀔 수 있다(아래 주기 재초기화) — 호출자는 항상 반영해야 한다.
// orcaHandle = ORCA_TERMINAL_HANDLE(안전 문자 집합에 맞는 비어 있지 않은 문자열 — resolveOrcaHandle)이면 오르카 경로 (2), null이면 현행 /clear 안내.
export function decideNudge({ ratio, threshold, stopHookActive, lastNudgeStep, orcaHandle = null }) {
  const keep = (step) => ({ shouldNudge: false, reason: "", nextStep: step });
  if (stopHookActive) return keep(lastNudgeStep);

  const current = Math.floor((ratio - threshold) / STEP + EPS);

  // auto-compact는 session_id를 유지하므로 플래그가 그대로 남는다. 구간이 2단(30%p) 이상
  // 떨어졌다면 압축 등으로 새 주기가 시작된 것이라 보고 상태를 되돌린다. 1단 하락이나
  // 임계 경계의 미세 진동(40% 직후 39%)은 새 주기로 보지 않는다 — 그 경계에서 매 턴 재넛지한다.
  let last = lastNudgeStep;
  if (last !== null && current <= last - 2) last = null;

  const due = last === null ? current >= 0 : current > last;
  if (!due) return keep(last);

  const pct = Math.round(ratio * 100);
  const thr = Math.round(threshold * 100);
  // 재넛지 문구는 "이전에 안내했다"는 사실을 더하는 것이므로, 구간 번호가 아니라
  // 실제 넛지 이력(last)으로 가른다. 통상 경로(40 → 55 → …)에서는 k >= 1과 같지만,
  // 세션이 처음부터 70%에서 시작하면 k >= 1이면서도 안내한 적은 없다.
  const renudge = last !== null;
  const head = renudge
    ? `컨텍스트 사용량이 약 ${pct}%입니다. 임계(${thr}%)에서 한 번 안내했고 그 뒤로 더 늘었습니다.`
    : `컨텍스트 사용량이 약 ${pct}%로 임계(${thr}%)를 넘었습니다.`;
  // 넛지의 의미 = 현재 작업 단위만 마무리하고 새 단위를 시작하지 않는다(F6). 단위 예시와 ② 조건문은
  // review-loop §2b·§2i와 바이트 동일해야 한다(정본 = review-loop). 훅은 진행 중 작업을 알 수 없으므로
  // ②는 조건문이고, 백그라운드 대기가 턴을 끝내므로 "완료 알림으로 깨어난 뒤에도 유효"를 명시한다.
  // ②의 마지막 문장은 양 경로 공통("넛지 (2)의 인계 절차") — 경로별로 다를 수 없다(1.0.0 D12).
  // 최초·재넛지에 동일하게 붙인다(7a D6: 재넛지 = 지시 동일 + 사실 추가).
  const unit =
    `(0) 넛지 이후 새 작업 단위를 시작하지 마세요 — 작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회(phase·루프 전체가 아닙니다). ` +
    `진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 넛지 (2)의 인계 절차를 따르라. ` +
    `이 지시는 이 턴에서 끝나지 않고 완료 알림으로 깨어난 뒤에도 유효합니다. `;
  // 핸드오프 파일 = repo·트랙 규약이 정한 파일(기본 .remember/remember.md). review-loop 세션은 진행 중 상태를
  // 공유 remember.md가 아니라 자기 루프 파일에 쓴다 — 단서가 없으면 이 넛지가 그 규정을 덮어써 트랙 인계가 유실된다.
  const handoff = renudge
    ? `(1) repo·트랙 규약이 정한 핸드오프 파일(기본 .remember/remember.md)에 현재 작업 상태(무엇을 하던 중인지·다음 할 일·미해결 항목)를 핸드오프로 작성하세요 — 이미 작성했다면 그 뒤의 진행분을 반영해 갱신하세요. review-loop 실행 중이면 그 스킬의 루프 파일에 그 스킬의 핸드오프 규정대로 쓰세요. `
    : `(1) repo·트랙 규약이 정한 핸드오프 파일(기본 .remember/remember.md)에 현재 작업 상태(무엇을 하던 중인지·다음 할 일·미해결 항목)를 핸드오프로 작성하세요. review-loop 실행 중이면 그 스킬의 루프 파일에 그 스킬의 핸드오프 규정대로 쓰세요. `;
  // (2) = 인계 절차. 오르카 밖에서는 현행 /clear 안내와 바이트 동일(회귀 기준). 오르카면 후계 스폰 절차로 교체.
  // 재넛지도 같은 (2)를 붙인다(D6: 재넛지 = 지시 동일 + 사실 추가).
  const handover =
    orcaHandle === null
      ? `(2) 사용자에게 "이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요"라고 안내하세요. ` +
        `자가 /clear는 불가하므로 실제 초기화는 사용자가 합니다.`
      : orcaHandoff(orcaHandle);
  return {
    shouldNudge: true,
    nextStep: current,
    reason: `${head} 멈추기 전에: ` + unit + handoff + handover,
  };
}

function flagPath(sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(tmpdir(), `claude-ctx-nudge-${safe}`);
}

// 플래그 파일 = 마지막으로 넛지한 구간. 파일 없음 = 아직 넛지 없음(null).
// 구버전 플래그는 내용이 "1"이라 step= 형식으로 파싱되지 않는다 — 첫 넛지는 이미 한 것으로
// 보고 0으로 간주해 다음 구간부터 재넛지한다.
function readStep(fp) {
  if (!existsSync(fp)) return null;
  try {
    const m = /^step=(-?\d+)$/.exec(readFileSync(fp, "utf8").trim());
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

function persistStep(fp, step) {
  try {
    if (step === null) {
      if (existsSync(fp)) rmSync(fp, { force: true });
    } else {
      writeFileSync(fp, `step=${step}`);
    }
  } catch {
    /* best effort */
  }
}

function resolveThreshold() {
  const t = Number(process.env.CLAUDE_CTX_THRESHOLD);
  return Number.isFinite(t) && t > 0 && t < 1 ? t : DEFAULT_THRESHOLD;
}

// 훅 프로세스는 claude의 환경을 물려받는다 — 오르카가 띄운 세션이면 ORCA_TERMINAL_HANDLE이 있다(실측 A).
// 빈 문자열은 미설정과 같다(오르카 밖 경로). 값은 (2)의 셸 명령에 --terminal "<핸들>"로 그대로 들어가므로
// 제목과 같은 안전 문자 집합([A-Za-z0-9._-])만 허용한다 — 따옴표·$(…)·백틱·공백·개행이 든 값은 오르카 핸들이
// 아니라 오염된 환경이다: 후계를 띄우지 않고 오르카 밖 경로(/clear 안내)로 보낸다(실제 핸들 = term_<uuid>, 집합 안).
function resolveOrcaHandle(env) {
  const h = typeof env.ORCA_TERMINAL_HANDLE === "string" ? env.ORCA_TERMINAL_HANDLE.trim() : "";
  return /^[A-Za-z0-9._-]+$/.test(h) ? h : null;
}

function main() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    /* stdin 없음 */
  }
  let input = {};
  try {
    input = JSON.parse(raw || "{}");
  } catch {
    input = {};
  }

  const stopHookActive = input.stop_hook_active === true;
  const transcriptPath = input.transcript_path;
  const sessionId = input.session_id;

  if (stopHookActive || !transcriptPath || !existsSync(transcriptPath)) {
    process.exit(0);
  }

  let usage;
  try {
    usage = computeContextUsage(readFileSync(transcriptPath, "utf8"), process.env);
  } catch {
    process.exit(0);
  }
  if (!usage) process.exit(0);

  const fp = flagPath(sessionId);
  const lastNudgeStep = readStep(fp);
  const decision = decideNudge({
    ratio: usage.ratio,
    threshold: resolveThreshold(),
    stopHookActive,
    lastNudgeStep,
    orcaHandle: resolveOrcaHandle(process.env),
  });

  // 넛지하지 않는 호출에서도 반영한다 — 주기 재초기화가 순수 함수 안에서만 일어나면
  // 다음 호출이 옛 구간을 다시 읽어 reset이 무효가 되고, 그 주기의 넛지가 통째로 억제된다.
  if (decision.nextStep !== lastNudgeStep) persistStep(fp, decision.nextStep);

  if (!decision.shouldNudge) process.exit(0);

  process.stdout.write(JSON.stringify({ decision: "block", reason: decision.reason }));
  process.exit(0);
}

// 직접 실행 시에만 main() (vitest import 시에는 실행되지 않음)
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
HOOK_EOF
```

바뀐 구역 요약(리뷰용): 헤더 4행·9행 · `COMPANION_ROOT_CMD`·`STATE_PROBE_CMD`·`CLI_RESOLVE_CMD` 상수(SC-4) · `orcaHandoff(h)`(SC-5 전부, 재개 프롬프트 템플릿 `successorPrompt` 포함) · `decideNudge` 시그니처 `orcaHandle = null`, `unit` 마지막 문장 = SC-2 HOOK-②, `handover` 분기 · `resolveOrcaHandle(env)` · `main()`의 `orcaHandle: resolveOrcaHandle(process.env)`.

### 3. GREEN 확인 + 비오르카 diff 0(교체 문장 1개 제외)

```bash
HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs 2>&1 | grep -E '^(ok|not ok|# (tests|pass|fail))'
# 기대: ok 1 ~ ok 11, "# pass 11", "# fail 0"
# 비오르카 회귀: 0.19.0 훅과 reason diff = (0) 문장 1개
git show HEAD:dev-workflow/hooks/scripts/context-threshold-hook.mjs > /tmp/hook-0.19.0.mjs
diff <(node -e 'import("/tmp/hook-0.19.0.mjs").then(m=>console.log(m.decideNudge({ratio:0.5,threshold:0.4,stopHookActive:false,lastNudgeStep:null}).reason))') \
     <(node -e 'import("./dev-workflow/hooks/scripts/context-threshold-hook.mjs").then(m=>console.log(m.decideNudge({ratio:0.5,threshold:0.4,stopHookActive:false,lastNudgeStep:null}).reason))') | grep -c '^[<>]'   # 2 (1행 교체)
rm -f /tmp/hook-0.19.0.mjs
```

### 4. 문면이 지시하는 셸 스니펫 실행 검증 (SC-4 출력 계약 — 이 repo, 읽기 전용)

reason에서 (2-0)ⓒ의 `COMPANION_ROOT_CMD; STATE_PROBE_CMD`, ⓐ의 `CLI_RESOLVE_CMD`, (2-1)의 토큰·제목 식을 잘라내 그대로 실행한다(reason 안의 문자열이 이스케이프 없이 셸에 통하는지):
```bash
node -e 'import("./dev-workflow/hooks/scripts/context-threshold-hook.mjs").then(m=>{const r=m.decideNudge({ratio:0.5,threshold:0.4,stopHookActive:false,lastNudgeStep:null,orcaHandle:"term_x"}).reason;const fs=require("fs");
const cut=(a,b)=>r.slice(r.indexOf(a)+a.length,r.indexOf(b,r.indexOf(a)));
fs.writeFileSync("/tmp/ss-probe.sh",cut("상태 프로브: ",". 출력이 GATE_ON")+"\n");
fs.writeFileSync("/tmp/ss-cli.sh",cut("orca — ",". ⓑ")+"; echo CLI=$CLI\n");
fs.writeFileSync("/tmp/ss-title.sh",cut("영숫자·하이픈만): ","\". 작업명")+"\"; NAME=review-loop-impl-round-3-ledger-fix-and-readme-sync-long-name; "+cut("붙입니다: NAME=<작업명>; ","\". 생성:")+"\"; echo TITLE=$TITLE LEN=${#TITLE}\n")})'
bash /tmp/ss-probe.sh; echo "exit=$?"     # GATE_OFF FOREIGN_ACTIVE=0 / exit=0 (파일 부재면 같은 출력; codex 미설치 머신이면 RESOLVE_FAIL + STATE_UNREADABLE exit=2 — 그것도 계약대로)
bash /tmp/ss-cli.sh                       # CLI=orca (ORCA_CLI_COMMAND·ORCA_DEV_REPO_ROOT 미설정 시)
bash /tmp/ss-title.sh                     # TITLE=review-loop-impl-round-3-ledg-<HHMMSS><4자> LEN=40
rm -f /tmp/ss-probe.sh /tmp/ss-cli.sh /tmp/ss-title.sh
```

### 5. 훅 E2E(stdin 계약) 회귀

```bash
echo '{"stop_hook_active":true,"transcript_path":"/nonexistent","session_id":"x"}' | node dev-workflow/hooks/scripts/context-threshold-hook.mjs; echo "exit=$?"   # 출력 없음, exit=0
node -e 'import("./dev-workflow/hooks/scripts/context-threshold-hook.mjs").then(m=>{for(const [r,l] of [[0.39,null],[0.40,null],[0.54,0],[0.55,0],[0.20,3],[0.85,1]]){const x=m.decideNudge({ratio:r,threshold:0.4,stopHookActive:false,lastNudgeStep:l});console.log(r,l,x.shouldNudge,x.nextStep)}})'
# 기대(판정 로직 불변): 0.39 null false null / 0.4 null true 0 / 0.54 0 false 0 / 0.55 0 true 1 / 0.2 3 false null / 0.85 1 true 3
```

### 6. AC5 기록 절 — 엔트리포인트 말미에 추가

`docs/plans/2026-09-24-orca-successor-session.md` 말미(`## 재논의 금지(기결정)` 절 뒤 — review-loop가 만든 `## 적대검증 ledger (plan)` 절이 있으면 그 **뒤**)에 아래를 추가하고, `<TAP 원문>` 자리에 단계 3의 출력(`ok 1 …` ~ `# fail 0` 13행)을 그대로 붙인다(바깥 울타리는 4개 백틱 — 안에 3개 백틱 블록이 있다):
````markdown
## 훅 테스트 기록 (AC5, D5)

테스트 = `.remember/hook-test-1.0.0/context-threshold-hook.test.mjs`(repo 파일 아님, claude-memories) · 실행 = `HOOK="$PWD/dev-workflow/hooks/scripts/context-threshold-hook.mjs" node --test --test-reporter=tap <파일>`.

| 일시 | 훅 커밋 | 결과 | 비고 |
|---|---|---|---|
| <YYYY-MM-DD HH:MM> | 0.19.0 `92e1374` | RED 4 pass / 7 fail | C3·C7·C9·C10 자동 보완(현행에서도 통과) · C11은 오르카 문면 부재로 실패 |
| <YYYY-MM-DD HH:MM> | <이 task 커밋 SHA — 단계 7 뒤 채운다> | GREEN 11/11 | 스니펫 실행: `GATE_OFF FOREIGN_ACTIVE=0` · `CLI=orca` · `LEN=40` |

GREEN 원문:
```
<TAP 원문>
```

review-loop(impl)에서 훅이 다시 바뀌면 재실행해 이 표에 행을 추가한다.
````

### 7. 커밋 (2건 — 훅 먼저, 기록 절은 SHA를 인용해야 하므로 뒤)

```bash
git add dev-workflow/hooks/scripts/context-threshold-hook.mjs
git commit -m "feat(hook): 오르카 터미널이면 넛지 (2) = 후계 세션 스폰·인계 절차(사전 검증·review gate·토큰 제목·프롬프트 파일·turn_started·후계 첫 동작 /exit→--for exit→close·폴백 4종), 오르카 밖은 (0) 인계 문장 1개만 교체 (F1·F2)"
SHA=$(git rev-parse --short HEAD)
# 단계 6의 표 2행 "<이 task 커밋 SHA>"를 $SHA로 치환한 뒤:
git add docs/plans/2026-09-24-orca-successor-session.md
git commit -m "docs(plan): 훅 테스트 기록 절 — RED 4/7(0.19.0) → GREEN 11/11($SHA), TAP 원문 인용 (AC5)"
git log -2 --format=%B | grep -ciE '^(co-authored-by|claude-session): |generated with \[claude code\]\('   # 0
```

## Acceptance Criteria

```bash
K=dev-workflow/hooks/scripts/context-threshold-hook.mjs
HOOK="$PWD/$K" node --test --test-reporter=tap .remember/hook-test-1.0.0/context-threshold-hook.test.mjs 2>&1 | grep -E '^# (pass|fail)'   # pass 11 / fail 0  (AC1·AC2·AC5)
grep -c 'orcaHandle = null' $K                                            # 1  (SC-3 시그니처)
grep -c '그때 넛지 (2)의 인계 절차를 따르라' $K                             # 1  (SC-2 HOOK-②)
grep -c '그때 /clear를 안내하라' $K                                        # 0
grep -c '자가 /clear는 불가하므로 실제 초기화는 사용자가 합니다' $K          # 1  (비오르카 (2)에만)
grep -c 'resolveOrcaHandle(process.env)' $K                               # 1
grep -c '/^\[A-Za-z0-9._-\]+$/.test(h)' $K                                 # 1  (핸들 안전 문자 집합, plan R1-1)
grep -c 'const obj=v=>!!v&&typeof v==="object"&&!Array.isArray(v)' $K     # 1  (상태 프로브 스키마 검사, plan R1-2)
grep -c 'typeof v.stopReviewGate==="boolean"' $K                          # 1  (중첩 필드 타입 검사, plan R2-2)
grep -c 'const COMPANION_ROOT_CMD\|const STATE_PROBE_CMD\|const CLI_RESOLVE_CMD' $K   # 3 (SC-4)
grep -o 'SUCCESSOR_PROMPT_EOF' $K | wc -l                                # 2 (heredoc 열고 닫기, R2-2)
git ls-files | grep -c 'hook-test-1.0.0/'                                 # 0 (D5)
grep -c '^## 훅 테스트 기록 (AC5, D5)' docs/plans/2026-09-24-orca-successor-session.md   # 1
grep -c '^# pass 11' docs/plans/2026-09-24-orca-successor-session.md      # 1 (TAP 원문 인용)
git status --short | grep -v '^??' | wc -l                                # 0
```

## Cautions

- **`decideNudge`의 판정 로직(`current`·`due`·reset·`nextStep`)과 `computeContextUsage`·플래그 파일 코드를 건드리지 않는다. 이유: 08-09 D3·D4, 0.18.0 D25 — 문구·분기만. C7과 단계 5 회귀 출력이 다르면 되돌린다.**
- **훅에 오르카·codex 상태를 직접 조회하는 코드(`child_process`, 상태 파일 읽기)를 넣지 않는다. 이유: G1·G2(기계 장치 과설계 금지) + codex 상태 디렉터리 해소는 codex 플러그인의 `CLAUDE_PLUGIN_DATA`에 묶여 있어 다른 플러그인 훅 프로세스에서 보장할 수 없다 — 세션의 Bash에서 실행하도록 문면이 지시한다(엔트리포인트 Architecture).**
- **오르카 reason에 "자가 /clear는 불가" 문장을 남기지 않는다. 이유: AC1·F5 — 오르카 경로는 `/clear`를 안내하지 않는다(폴백 끝에서만 CLEAR 문장).**
- **재개 프롬프트 템플릿 안의 send/wait/close/read에서 `--terminal "${h}"`를 빼거나 "활성 터미널"로 바꾸지 않는다. 이유: R2-1 — 생략하면 후계 자신이나 무관한 탭을 닫는다. C6이 잡는다.**
- **옛 세션 종료 대기를 `--for tui-idle`로 되돌리지 않는다. 이유: C1-#10 — 옛 세션은 이미 idle이라 즉시 만족돼 증거가 못 된다. `--for exit` 또는 종료 표지 + 셸 프롬프트.**
- **`STATE_PROBE_CMD`에서 파싱 실패를 `GATE_OFF`/빈 잡으로 돌리지 않는다. 이유: R6-1a·C2 — fail-closed(`STATE_UNREADABLE` exit 2 = 폴백/차단).**
- **`resolveOrcaHandle`의 안전 문자 집합 검사를 빼거나 "비어 있지 않으면 통과"로 되돌리지 않는다. 이유: plan R1-1 — 핸들은 (2)의 셸 명령에 `--terminal "<핸들>"`로 그대로 보간되므로 오염된 값(따옴표·`$(…)`·백틱)이 옛 세션·후계에서 실행된다. 실제 핸들(`term_<uuid>`)은 집합 안이라 정상 경로는 바뀌지 않는다. C8이 잡는다.**
- **`STATE_PROBE_CMD`의 루트 배열·`jobs` 비배열·`config` 비객체 검사(R1-2)와 중첩 필드 검사 — `jobs[]` 항목 객체·`status` 문자열, `config.stopReviewGate` boolean(R2-2) — 와 **두 필드 필수**(파일이 있으면 `config`·`jobs` 누락 = `STATE_UNREADABLE`, R3-1 — companion `saveState`는 항상 둘 다 쓴다) 를 빼지 않는다. 이유: `typeof [] === "object"`라 `[]`가 `GATE_OFF FOREIGN_ACTIVE=0`으로 통과하고, `"stopReviewGate":"true"`는 companion이 truthy로 켜진 게이트인데 `===true` 비교만으로는 GATE_OFF가 된다(fail-open). C11이 잡는다.**
- **`loadState(cwd)`·`codex-companion.mjs status --all`을 조회 수단으로 쓰지 않는다. 이유: C1-#11(`status --all`은 자기 세션 잡만 필터) · C2(`loadState`는 파싱 실패를 기본값으로 숨긴다).**
- **제목 절단을 `${TITLE:0:40}`처럼 제목 전체에 걸지 않는다. 이유: R4-1 — 토큰이 잘리면 탭에서 후계를 식별할 상관 문자열이 사라진다(1.0.2부터 응답 유실 회수는 제목이 아니라 생성 전후 핸들 집합 차분). 작업명만 `40 - ${#TOKEN} - 1`로 자른다.**
- **프롬프트를 `--text "<문자열 직접>"`로 보내는 예시를 넣지 않는다. 이유: R2-2 — 파일 + `"$(cat …)"`만. 파일 내용은 줄바꿈 없이 한 줄(SC-5).**
- **[폴백] 끝의 CLEAR 안내를 "소멸이 확인된 경우에만"에서 무조건("그런 다음")으로 되돌리지 않는다. 이유: plan R4-1 — 정리 미확인 상태에서 /clear로 재개하면 남은 후계가 재개 세션에 /exit를 보낸다(spec F2 fail-closed · task-04 README 문장과 동기). C4 needle 2종이 잡는다.**
- **`$CLI`·`$TOKEN`·`$TITLE` 자리표시자 고지("도구 호출마다 셸이 새로 시작")를 빼지 않는다. 이유: plan R5-2 — 각 단계는 별도 Bash 호출로 실행되므로 셸 변수가 남지 않아 `"" terminal …`·`successor-.prompt` 같은 빈 값 명령이 실행된다(orca-cli 스킬도 실행 파일을 변수로 두지 말라고 한다). C4 needle 2종이 잡는다.**
- **끄기 스위치(env·설정)를 더하지 않는다. 이유: D8.**
- **테스트 파일을 통과시키려고 테스트를 고치지 않는다. 이유: task-01 계약 — needle은 spec FIXED 행에 대응한다. 훅 문면이 needle을 포함하도록 고친다.**
