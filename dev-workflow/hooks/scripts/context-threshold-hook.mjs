#!/usr/bin/env node
// 컨텍스트 임계 Stop 훅: transcript 마지막 assistant usage로 컨텍스트 사용량을 계산하고,
// 임계(기본 40%) 초과 시 핸드오프 작성 + /clear 안내를 1회 넛지한다.
// 윈도 상한은 기본 1M(최신 모델 기준) — 200k 세션은 CLAUDE_CTX_LIMIT로 명시한다.
// Stop 훅 계약: stdin JSON 입력, 넛지 시 {"decision":"block","reason":...} 출력, 그 외 exit 0.
// 자가 /clear는 불가하므로 실제 초기화는 사용자가 한다(설계 §2).

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_LIMIT = 1_000_000;
const DEFAULT_THRESHOLD = 0.4;

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
    usage = computeContextUsage(readFileSync(transcriptPath, "utf8"), process.env);
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
