#!/usr/bin/env node
// 컨텍스트 임계 Stop 훅: transcript 마지막 assistant usage로 컨텍스트 사용량을 계산하고,
// 임계(기본 40%) 초과 시 핸드오프 작성 + /clear 안내를 넛지한다.
// 넛지는 1회가 아니라 15%p 구간마다 재발화한다(기본 임계에서 40 → 55 → 70 → 85%, 상한 없음).
// 윈도 상한은 기본 1M(최신 모델 기준) — 200k 세션은 CLAUDE_CTX_LIMIT로 명시한다.
// Stop 훅 계약: stdin JSON 입력, 넛지 시 {"decision":"block","reason":...} 출력, 그 외 exit 0.
// 자가 /clear는 불가하므로 실제 초기화는 사용자가 한다(설계 §2).

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

// 넛지 여부 결정(순수 함수).
// lastNudgeStep = 마지막으로 넛지한 구간 인덱스(아직 없으면 null).
// nextStep = 호출자가 영속화해야 할 다음 상태(null이면 "아직 넛지 없음" = 플래그 삭제).
// 넛지하지 않는 호출에서도 nextStep이 바뀔 수 있다(아래 주기 재초기화) — 호출자는 항상 반영해야 한다.
export function decideNudge({ ratio, threshold, stopHookActive, lastNudgeStep }) {
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
  // review-loop 세션은 진행 중 상태를 공유 remember.md가 아니라 자기 루프 파일에 쓴다.
  // 단서가 없으면 이 넛지가 그 규정을 덮어써 공유 파일의 트랙 인계가 유실된다.
  const handoff = renudge
    ? `(1) .remember/remember.md에 현재 작업 상태(무엇을 하던 중인지·다음 할 일·미해결 항목)를 핸드오프로 작성하세요 — 이미 작성했다면 그 뒤의 진행분을 반영해 갱신하세요. review-loop 실행 중이면 그 스킬의 핸드오프 규정을 따르세요. `
    : `(1) .remember/remember.md에 현재 작업 상태(무엇을 하던 중인지·다음 할 일·미해결 항목)를 핸드오프로 작성하세요. review-loop 실행 중이면 그 스킬의 핸드오프 규정을 따르세요. `;
  return {
    shouldNudge: true,
    nextStep: current,
    reason:
      `${head} 멈추기 전에: ` +
      handoff +
      `(2) 사용자에게 "이어서 진행하려면 /clear 후 같은 작업을 다시 시작하세요"라고 안내하세요. ` +
      `자가 /clear는 불가하므로 실제 초기화는 사용자가 합니다.`,
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
