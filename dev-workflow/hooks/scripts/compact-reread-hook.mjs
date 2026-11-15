#!/usr/bin/env node
// 압축 뒤 재읽기 SessionStart 훅(matcher compact): 압축 직후 「스킬 문서와 진행 상태 파일을 다시 읽어라」는
// 고정 안내문을 hookSpecificOutput.additionalContext로 넣는다(1.5.0).
// 채우는 값은 스크립트 위치 기준 스킬 폴더 절대 경로 하나다 — 파일 조회·세션 기록 읽기·환경 변수 분기는 없다.
// stdin의 source가 문자열이고 compact가 아니면 침묵한다(등록 matcher가 빠져도 다른 세션 시작에 안내가 붙지 않게).
// stdin을 읽지 못하면(없음·빈 값·깨짐·source 없음) 안내를 낸다 — matcher를 통과해 온 호출이다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SKILLS = fileURLToPath(new URL("../../skills", import.meta.url));

const NOTICE = [
  "[dev-workflow] 이 대화는 방금 압축(요약)됐다. 압축 뒤에는 호출했던 스킬 본문이 앞부분만 남고(스킬당 약 5,000토큰), 진행 상태는 요약문에만 남는다.",
  "dev-workflow 스킬(review-loop · harden-spec · orchestrate · mr-review 등)을 실행하던 중이 아니면 이 안내를 무시한다. 실행하던 중이면 다음 행동 전에:",
  `1. 그 스킬의 SKILL.md 전문을 Read로 다시 읽는다(길면 나눠서 끝까지) — ${SKILLS}/<스킬 이름>/SKILL.md. 스킬을 다시 호출하지 않는다 — 처음부터 다시 시작하는 것이 아니라 하던 곳에서 이어 간다.`,
  "2. 진행 상태를 파일에서 다시 읽는다 — review-loop: 그 루프의 .remember/loop-<ledger 문서 이름>-<phase>.md 를 읽고 SKILL.md의 「압축 뒤 이어가기」를 따른다. 그 외: 작업 중이던 산출물 파일(spec·plan 등)과 핸드오프 파일(기본 .remember/remember.md)의 이 세션 몫.",
  "3. 트랙 프롬프트 파일(.remember/track-*.prompt 등)로 시작한 세션이면 그 파일을 다시 읽는다 — 역할·진행 범위·정지 조건·종료 표지 규약은 압축 뒤에도 그대로 유효하다.",
  "4. 대화에만 있던 작업 목록(예: harden-spec의 갭 대장 · 아직 묻지 않은 질문)은 요약문에 기대지 말고 산출물 파일과 대조해 다시 만든다.",
  "5. 요약문과 파일·git이 다르면 파일·git을 믿는다.",
].join("\n");

let source;
try {
  source = JSON.parse(readFileSync(0, "utf8")).source;
} catch {
  source = undefined;
}

if (typeof source === "string" && source !== "compact") process.exit(0);

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: NOTICE } }),
);
