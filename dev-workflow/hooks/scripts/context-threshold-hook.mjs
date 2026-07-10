#!/usr/bin/env node
// 컨텍스트 임계 Stop 훅: transcript 마지막 assistant usage로 컨텍스트 사용량을 계산하고,
// 임계(기본 40%) 초과 시 핸드오프 작성 + /clear 안내를 1회 넛지한다.
// Stop 훅 계약: stdin JSON 입력, 넛지 시 {"decision":"block","reason":...} 출력, 그 외 exit 0.
// 자가 /clear는 불가하므로 실제 초기화는 사용자가 한다(설계 §2).

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_LIMIT_1M = 1_000_000;
const DEFAULT_LIMIT_STD = 200_000;
const DEFAULT_THRESHOLD = 0.4;

// 글로벌 설정(~/.claude/settings.json 또는 CLAUDE_CONFIG_DIR)의 model 값을 읽는다.
// Claude Code 설정의 model은 "claude-fable-5[1m]"처럼 [1m] 접미사를 보존하므로
// transcript와 달리 1M 윈도를 세션 초반부터 식별할 수 있다. 실패 시 "".
export function readSettingsModel(env = {}) {
  try {
    const dir = env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
    const settings = JSON.parse(readFileSync(join(dir, "settings.json"), "utf8"));
    return typeof settings.model === "string" ? settings.model : "";
  } catch {
    return "";
  }
}

// transcript JSONL 텍스트에서 마지막 assistant usage를 찾아 컨텍스트 사용량을 계산한다.
export function computeContextUsage(transcriptText, env = {}, settingsModel = "") {
  const lines = String(transcriptText).split(/\r?\n/);
  const usedOf = (u) =>
    ((u && u.input_tokens) || 0) +
    ((u && u.cache_read_input_tokens) || 0) +
    ((u && u.cache_creation_input_tokens) || 0);
  let last = null;
  let peakUsed = 0; // 세션 전체에서 관측된 최대 used(자기보정용)
  for (const line of lines) {
    if (line.trim() === "") continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = obj && obj.message;
    if (msg && msg.role === "assistant" && msg.usage) {
      last = msg;
      const turnUsed = usedOf(msg.usage);
      if (turnUsed > peakUsed) peakUsed = turnUsed;
    }
  }
  if (!last) return null;
  const used = usedOf(last.usage);
  const model = last.model || "";
  const envLimit = Number(env.CLAUDE_CTX_LIMIT);
  // 1M 컨텍스트 감지의 한계: transcript의 message.model은 베어 ID("claude-opus-4-8")만 담고,
  // Claude Code 화면 라벨의 "[1m]" 접미사는 들어오지 않는다. 그래서 우선순위:
  //  (1) CLAUDE_CTX_LIMIT env 오버라이드(최우선·명시),
  //  (2) transcript model에 "[1m]"이 있거나(미래 호환) settings.json model에 "[1m]"이 있거나
  //      peakUsed가 200k 초과면 윈도가 1M임이 확정 → 자기보정,
  //  (3) 그 외 200k.
  // settings 감지는 글로벌 설정만 읽으므로, 프로젝트별 model 오버라이드를 쓰거나 세션 중
  // /model로 바꾼 경우는 CLAUDE_CTX_LIMIT로 명시하는 것이 확실하다.
  const limit =
    Number.isFinite(envLimit) && envLimit > 0
      ? envLimit
      : /\[1m\]/i.test(model) ||
          /\[1m\]/i.test(settingsModel) ||
          peakUsed > DEFAULT_LIMIT_STD
        ? DEFAULT_LIMIT_1M
        : DEFAULT_LIMIT_STD;
  return { used, limit, ratio: used / limit, model };
}

// 넛지 여부 결정(순수 함수).
export function decideNudge({ ratio, threshold, stopHookActive, alreadyNudged }) {
  if (stopHookActive) return { shouldNudge: false, reason: "" };
  if (alreadyNudged) return { shouldNudge: false, reason: "" };
  if (!(ratio >= threshold)) return { shouldNudge: false, reason: "" };
  const pct = Math.round(ratio * 100);
  const thr = Math.round(threshold * 100);
  return {
    shouldNudge: true,
    reason:
      `컨텍스트 사용량이 약 ${pct}%로 임계(${thr}%)를 넘었습니다. 멈추기 전에: ` +
      `(1) .remember/remember.md에 현재 작업 상태(무엇을 하던 중인지·다음 할 일·미해결 항목)를 핸드오프로 작성하세요. ` +
      `(2) 사용자에게 "이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요"라고 안내하세요. ` +
      `자가 /clear는 불가하므로 실제 초기화는 사용자가 합니다.`,
  };
}

function flagPath(sessionId) {
  const safe = String(sessionId || "unknown").replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(tmpdir(), `claude-ctx-nudge-${safe}`);
}

function resolveThreshold() {
  const t = Number(process.env.CLAUDE_CTX_THRESHOLD);
  return Number.isFinite(t) && t > 0 && t < 1 ? t : DEFAULT_THRESHOLD;
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
    usage = computeContextUsage(
      readFileSync(transcriptPath, "utf8"),
      process.env,
      readSettingsModel(process.env),
    );
  } catch {
    process.exit(0);
  }
  if (!usage) process.exit(0);

  const fp = flagPath(sessionId);
  const decision = decideNudge({
    ratio: usage.ratio,
    threshold: resolveThreshold(),
    stopHookActive,
    alreadyNudged: existsSync(fp),
  });

  if (!decision.shouldNudge) process.exit(0);

  try {
    writeFileSync(fp, "1");
  } catch {
    /* best effort */
  }
  process.stdout.write(JSON.stringify({ decision: "block", reason: decision.reason }));
  process.exit(0);
}

// 직접 실행 시에만 main() (vitest import 시에는 실행되지 않음)
const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
