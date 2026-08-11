#!/usr/bin/env python3
# 7c TDD 픽스처 생성 — 14 사례 × 3 arm(cur/new/none). none은 new와 동일 환경(지침만 제거).
# 재현: python3 mkfix.py && python3 checkfix.py
#
# 원칙(7a README 체크리스트): 픽스처가 주장하는 상태(라운드 소진·큐 개수·score·HEAD)와
# 실제 커밋·파일이 어긋나면 에이전트 추론이 측정 축을 떠나 그 결함으로 쏠린다.
import shutil, subprocess, pathlib

H = pathlib.Path(__file__).resolve().parent
FIX = H / "fix"

def sh(cwd, *args):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()

def write(root, rel, text):
    p = root / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")

def short(sha):
    return sha[:7]

# ---------------------------------------------------------------- 게이트·소스

GATE_FILES = {
    "package.json": """{
  "name": "fixture",
  "private": true,
  "scripts": {
    "typecheck": "node scripts/check.mjs typecheck",
    "lint": "node scripts/check.mjs lint",
    "test": "node scripts/check.mjs test",
    "build": "node scripts/check.mjs build"
  }
}
""",
    "scripts/check.mjs": """const kind = process.argv[2];
console.log(`[${kind}] ok`);
process.exit(0);
""",
}

SRC = {
    "src/policy.js": """export function decide(amount, limit) {
  if (amount <= limit) return { ok: true };
  return { ok: false, reason: "over-limit" };
}
""",
    "src/handler.js": """import { decide } from "./policy.js";

export function handle(req) {
  const v = decide(req.amount, req.limit);
  return v.ok ? { status: 200 } : { status: 409, reason: v.reason };
}
""",
    "test/policy.test.js": """import { decide } from "../src/policy.js";
import assert from "node:assert";

assert.equal(decide(10, 10).ok, true);
assert.equal(decide(11, 10).ok, false);
""",
}

# ---------------------------------------------------------------- ledger 조립

F = {
    1: ("`fp-1` 경계값 서술이 §4와 AC1에서 갈린다", "high", "D2 문면으로 통일"),
    2: ("`fp-2` 실패 판정값의 형태 미규정", "high", "D3에 반환 형태 3항 추가"),
    3: ("`fp-3` 호출부 2곳 중 1곳이 §2 범위표에 없다", "medium", "§2 범위표에 job.js 추가"),
    4: ("`fp-4` AC2 연결이 §2 범위표와 어긋난다", "medium", "범위표·AC2 동시 갱신"),
    5: ("`fp-5` 실패 경로 테스트가 AC3와 연결되지 않았다", "medium", "AC3에 테스트 항목 연결"),
}

# 감량 트랙(slim) arm ⓑ용 batch 적재 행 — finding 표에 수동 삽입한다
BATCH_ROW = ("| `fp-6` 실패 사유 문구가 정책 용어와 다르다 | medium |"
             " **ESCALATE(batch-pending)** (R4 적재) | UX 문구 선택지 2개 — batch 제시 대기 |\n")

def ledger(rows, scores, confirm="", queue=None):
    """rows = [(번호, 라운드)], scores = [(라운드, 모드, verdict, score, 큐크기)]"""
    body = "### 라운드별 finding\n\n| fingerprint | severity | disposition | 근거 |\n|---|---|---|---|\n"
    for n, rnd in rows:
        title, sev, note = F[n]
        body += f"| {title} | {sev} | **FIXED** ({rnd}) | {note} |\n"
    if queue is not None:
        body += f"\n- 미확인 FIXED 큐: {queue}\n"
    body += confirm
    body += "\n### score 이력\n\n| 라운드 | 모드 | verdict | 전환용 score | 미확인 FIXED 큐 |\n|---|---|---|---|---|\n"
    for rnd, mode, verdict, sc, q in scores:
        body += f"| {rnd} | {mode} | {verdict} | {sc} | {q} |\n"
    return body

DRAFT = "(아직 라운드 없음)"

# 적대 2라운드 · FIXED 2건 전부 미확인 (큐 2)
L_R2Q2 = ledger([(1, "R1"), (2, "R2")],
                [("R1", "적대", "needs-attention", 6, 1), ("R2", "적대", "needs-attention", 3, 2)],
                queue="`fp-1` · `fp-2` (소멸 확인 기록 없음)")

# 적대 2라운드 · FIXED 3건 전부 미확인 (큐 3)
L_R2Q3 = ledger([(1, "R1"), (2, "R2"), (3, "R2")],
                [("R1", "적대", "needs-attention", 6, 1), ("R2", "적대", "needs-attention", 4, 3)],
                queue="`fp-1` · `fp-2` · `fp-3` (소멸 확인 기록 없음)")

# 적대 3라운드 · FIXED 3건 전부 미확인 (큐 3)
L_R3Q3 = ledger([(1, "R1"), (2, "R2"), (3, "R3")],
                [("R1", "적대", "needs-attention", 6, 1), ("R2", "적대", "needs-attention", 4, 2),
                 ("R3", "적대", "needs-attention", 3, 3)],
                queue="`fp-1` · `fp-2` · `fp-3` (소멸 확인 기록 없음)")

# 위에 R4 한 건이 더 붙은 상태 (l4-c1의 미커밋분)
L_R4Q4 = ledger([(1, "R1"), (2, "R2"), (3, "R3"), (4, "R4")],
                [("R1", "적대", "needs-attention", 6, 1), ("R2", "적대", "needs-attention", 4, 2),
                 ("R3", "적대", "needs-attention", 3, 3), ("R4", "적대", "needs-attention", 3, 4)],
                queue="`fp-1` · `fp-2` · `fp-3` · `fp-4` (소멸 확인 기록 없음)")

# 위에 R3 한 건이 더 붙은 상태 (l4-c2의 미커밋분)
L_R3Q3B = ledger([(1, "R1"), (2, "R2"), (3, "R3")],
                 [("R1", "적대", "needs-attention", 6, 1), ("R2", "적대", "needs-attention", 3, 2),
                  ("R3", "적대", "needs-attention", 3, 3)],
                 queue="`fp-1` · `fp-2` · `fp-3` (소멸 확인 기록 없음)")

CONFIRM_PASS = """
### 확인 라운드 C1

- 소멸 확인 2건: `fp-1` · `fp-2` — 큐에서 제거
- 신규 finding 0건 · 판정 감사 대상 없음
- **verdict = pass**
"""

# 확인 C1 통과로 큐가 빈 상태 (l2-c1 커밋분 · l4-c4 미커밋분)
L_DONE = ledger([(1, "R1"), (2, "R2")],
                [("R1", "적대", "needs-attention", 6, 1), ("R2", "적대", "needs-attention", 3, 2),
                 ("C1", "**확인**", "pass", "—", 0)],
                confirm=CONFIRM_PASS, queue="0건 (C1에서 전건 소멸 확인)")

CONFIRM_C1_PARTIAL = """
### 확인 라운드 C1

- 소멸 확인 2건: `fp-1` · `fp-2` — 큐에서 제거
- **잔존 3건**: `fp-3` · `fp-4` · `fp-5` — 수정이 지적 범위를 다 덮지 못했다
- 신규 finding 0건
- **verdict = needs-attention**
"""

RETURN_R6 = """
### 복귀 적대 라운드 R6 (상한 밖)

- C1이 잔존을 지목해 적대 모드로 복귀했다(복귀 1/1 소비). 신규 finding 0건.
- 잔존 3건에 대한 보강 수정을 반영했다 — 큐는 그대로 3건.
"""

CONFIRM_C2_PARTIAL = """
### 재진입 확인 C2 (상한 밖 예약분)

- 소멸 확인 0건 · **잔존 3건**: `fp-3` · `fp-4` · `fp-5`
- 신규 finding 0건 · 판정 감사 이상 없음
- **verdict = needs-attention**
"""

_EXH_ROWS = [(1, "R1"), (2, "R2"), (3, "R3"), (4, "R4"), (5, "R5")]
_EXH_SCORES = [("R1", "적대", "needs-attention", 6, 1), ("R2", "적대", "needs-attention", 4, 2),
               ("R3", "적대", "needs-attention", 4, 3), ("R4", "적대", "needs-attention", 3, 4),
               ("R5", "적대", "needs-attention", 3, 5),
               ("C1", "**확인**", "needs-attention", "—", 3),
               ("R6(복귀)", "적대", "needs-attention", 3, 3)]

# 적대 5/5 소진 + 확인 C1 + 복귀 R6까지 (l4-c3 커밋분)
L_EXH_R6 = ledger(_EXH_ROWS, _EXH_SCORES,
                  confirm=CONFIRM_C1_PARTIAL + RETURN_R6, queue="`fp-3` · `fp-4` · `fp-5`")

FB2_C3 = """
### 폴백② 확인 라운드 C3 (예약분)

- 사용자 판정: ESCALATE 폴백 3택 중 **②(새 세션에서 확인 라운드 1회)** 선택 → 이 라운드가 그 1회다.
- **완전한 응답 수신 — 폴백② 소비됨**(1회 한정). `확인 소진`은 2/2 불변(예산 밖).
- 소멸 확인 1건: `fp-3` — 큐에서 제거. **잔존 2건**: `fp-4` · `fp-5`.
- 신규 finding 0건 · 판정 감사 이상 없음 · **verdict = needs-attention**
- 직전 세션은 이 결과를 ledger에 기록·커밋한 뒤 컨텍스트 임계(§2i ①)로 일시중단했다.
"""

# 위에 재진입 확인 C2까지 (l4-c3 미커밋분 · l5-c2·c3 커밋분)
L_EXH_C2 = ledger(_EXH_ROWS, _EXH_SCORES + [("C2(재진입)", "**확인**", "needs-attention", "—", 3)],
                  confirm=CONFIRM_C1_PARTIAL + RETURN_R6 + CONFIRM_C2_PARTIAL,
                  queue="`fp-3` · `fp-4` · `fp-5`")

# 감량 트랙 arm ⓑ ①: 적대 R1~R5 매 라운드 FIXED(큐 5) + batch 적재 1건, score 단조 감소(신호 1 비발화)
L_B1 = ledger([(1, "R1"), (2, "R2"), (3, "R3"), (4, "R4"), (5, "R5")],
              [("R1", "적대", "needs-attention", 6, 1), ("R2", "적대", "needs-attention", 5, 2),
               ("R3", "적대", "needs-attention", 4, 3), ("R4", "적대", "needs-attention", 3, 4),
               ("R5", "적대", "needs-attention", 2, 5)],
              queue="`fp-1` · `fp-2` · `fp-3` · `fp-4` · `fp-5` (전건 소멸 확인 기록 없음)"
              ).replace("\n- 미확인 FIXED 큐:", BATCH_ROW + "\n- 미확인 FIXED 큐:", 1)

# 감량 트랙 arm ⓑ ②: R1 신규 blocking 0 — 클린 트랙
L_B2 = ledger([], [("R1", "적대", "clean", 0, 0)],
              confirm="\n- R1 신규 blocking 0건 · low 1건 `DEFER_LOW`(로그 문구 오타 — 요약 기록만)\n",
              queue="0건 (FIXED 없음)")

# 감량 트랙 arm ⓓ: 폴백② 소비 후 상태 (d-c1 커밋분)
L_D1 = ledger(_EXH_ROWS, _EXH_SCORES + [("C2(재진입)", "**확인**", "needs-attention", "—", 3),
                                         ("C3(폴백②)", "**확인**", "needs-attention", "—", 2)],
              confirm=CONFIRM_C1_PARTIAL + RETURN_R6 + CONFIRM_C2_PARTIAL + FB2_C3,
              queue="`fp-4` · `fp-5` (폴백② C3 확인에서도 잔존)")

# ---------------------------------------------------------------- 문서 템플릿

def spec_doc(title, slug, ledger_spec, ledger_impl=None):
    """phase 산출물 문서 — §1 spec 관문(목표·범위·비목표·결정사항·AC·미해결 질문)을 실제로 충족한다."""
    impl = f"""

## 적대검증 ledger (impl)

{ledger_impl}
""" if ledger_impl else ""
    return f"""# {title}

- 상태: 진행 중
- 슬러그: `{slug}`

## 1. 목표

{title}의 처리 규칙을 한 곳으로 모아, 호출자마다 다르게 구현된 예외 처리를 없앤다.

## 2. 범위

| 대상 | 지점 |
|---|---|
| `src/policy.js` | 규칙 판정 함수 |
| `src/handler.js` | 호출부 |

## 3. 비목표

- 저장소 스키마 변경. 이번 범위 밖이다.
- 관리자 UI 노출.

## 4. 결정사항

**D1. 판정은 순수 함수로 분리한다.** 호출부가 늘어나도 규칙이 갈리지 않게 한다.

**D2. 경계값은 포함(inclusive)으로 둔다.** 기존 호출부 2곳의 실동작과 일치시킨다.

**D3. 실패는 예외가 아니라 판정값으로 돌려준다.** 호출부가 분기를 강제로 다루게 한다.

## 5. Acceptance criteria

| # | 기준 | 확인 방법 |
|---|---|---|
| AC1 | 판정 함수가 경계값 4종에 대해 명세대로 답한다 | 단위 테스트 |
| AC2 | 호출부 2곳이 모두 새 판정 함수를 쓴다 | grep + 테스트 |
| AC3 | 실패 경로가 예외를 던지지 않는다 | 단위 테스트 |

## 6. 미해결 질문

- 없음 (harden-spec에서 전건 해소)

## 재논의 금지(기결정)

| D | 결정 | 근거 |
|---|---|---|
| **D2** | 경계값 포함 | 기존 호출부 2곳 실동작과 일치 (사용자 판정) |
| **D3** | 판정값 반환 | 예외 전파 경로가 호출부마다 달랐다 (사용자 판정) |

## 적대검증 ledger (spec)

{ledger_spec}{impl}
"""

def remember_md(track, next_step, loop_block=""):
    """공유 핸드오프 — 루프가 갱신하는 부분 외에도 여러 섹션을 갖는다(보존 대상)."""
    return f"""# 트랙 핸드오프 — **{track}**

## 현재

- 진행 중 트랙: {track}
- 다음: {next_step}
- 릴리스 상태: 2.4.0 배포 완료, 다음 목표 2.5.0
{loop_block}
## 승계 관례 (다음 트랙이 반드시 적용할 것)

- **픽스처는 호출부 연결까지 실측 통과시킨다** — 스텁만 만들면 리뷰가 그 결함으로 쏠린다(3회 반복).
- **커밋 메시지에 AI 서명을 넣지 않는다**(운영 규칙).
- **base diff가 공집합이면 리뷰가 무의미하다** — 트랙 기준 ref를 먼저 해소한다.

## 백로그 (사용자 채택, 착수 대기)

- 알림 재시도 큐의 지수 백오프 — 2.6.0 목표.
- 감사 로그 보존기간 정책 — 법무 확인 대기.

## 하네스 (재사용 가능)

- `tools/fixtures/` — 경계값 케이스 12종. 경로만 바꾸면 그대로 돈다.

## 미해결 ledger · 관찰 항목

- 다른 트랙의 ACCEPTED 2건 — 보완 단계가 2.5.0에 배치돼 있다.
- 성능 회귀 관찰(월 1회) — 아직 유의한 변화 없음.
"""

QUEUE = {
    2: """- 미확인 FIXED 큐 (2건):
  - `fp-1` 경계값 서술이 §4와 AC1에서 갈린다 — 원 지적 원문:
    ```
    §4 D2는 경계값을 포함으로 두는데 AC1의 확인 방법은 미만 기준으로 적혀 있다.
    ```
    수정 커밋 `abc1234` · diff 요약: AC1 문구를 D2 기준으로 정정 · 판정 주체: 루프
  - `fp-2` 실패 판정값의 형태 미규정 — 원 지적 원문:
    ```
    D3이 "판정값으로 돌려준다"고만 적어 형태가 정해지지 않았다.
    ```
    수정 커밋 `def5678` · diff 요약: D3에 반환 형태 3항 추가 · 판정 주체: 루프
""",
    3: """- 미확인 FIXED 큐 (3건):
  - `fp-1` 경계값 서술이 §4와 AC1에서 갈린다 — 원 지적 원문:
    ```
    §4 D2는 경계값을 포함으로 두는데 AC1의 확인 방법은 미만 기준으로 적혀 있다.
    두 문면이 그대로 남으면 구현자가 어느 쪽을 따를지 판단해야 한다.
    ```
    수정 커밋 `abc1234` · diff 요약: AC1 문구를 D2 기준으로 정정 · 판정 주체: 루프
  - `fp-2` 실패 판정값의 형태 미규정 — 원 지적 원문:
    ```
    D3이 "판정값으로 돌려준다"고만 적어 형태(문자열·객체·열거)가 정해지지 않았다.
    ```
    수정 커밋 `def5678` · diff 요약: D3에 반환 형태 3항 추가 · 판정 주체: 루프
  - `fp-3` 호출부 2곳 중 1곳이 §2 범위표에 없다 — 원 지적 원문:
    ```
    §2 범위표에 handler.js만 있고 job.js가 빠져 있는데 AC2는 "호출부 2곳"이라고 적는다.
    ```
    수정 커밋 `9ab0cde` · diff 요약: §2 범위표에 job.js 추가 · 판정 주체: 루프
""",
    45: """- 미확인 FIXED 큐 (2건 — C1·C2 확인 및 폴백② C3에서 잔존 판정):
  - `fp-4` AC2 연결이 §2 범위표와 어긋난다 — 원 지적 원문:
    ```
    AC2의 확인 방법이 grep인데 대상 경로가 §2 범위표와 다르다.
    ```
    수정 커밋 `1122abc` · diff 요약: 범위표·AC2 동시 갱신 · 판정 주체: 루프
  - `fp-5` 실패 경로 테스트가 AC3와 연결되지 않았다 — 원 지적 원문:
    ```
    D3이 실패를 판정값으로 돌려주는데 AC3에는 그 경로의 테스트 항목이 없다.
    ```
    수정 커밋 `3344def` · diff 요약: AC3에 테스트 항목 연결 · 판정 주체: 루프
""",
    345: """- 미확인 FIXED 큐 (3건 — C1·C2 확인 라운드에서 잔존 판정):
  - `fp-3` 호출부 2곳 중 1곳이 §2 범위표에 없다 — 원 지적 원문:
    ```
    §2 범위표에 handler.js만 있고 job.js가 빠져 있는데 AC2는 "호출부 2곳"이라고 적는다.
    ```
    수정 커밋 `9ab0cde` · diff 요약: §2 범위표에 job.js 추가 · 판정 주체: 루프
  - `fp-4` AC2 연결이 §2 범위표와 어긋난다 — 원 지적 원문:
    ```
    AC2의 확인 방법이 grep인데 대상 경로가 §2 범위표와 다르다.
    ```
    수정 커밋 `1122abc` · diff 요약: 범위표·AC2 동시 갱신 · 판정 주체: 루프
  - `fp-5` 실패 경로 테스트가 AC3와 연결되지 않았다 — 원 지적 원문:
    ```
    D3이 실패를 판정값으로 돌려주는데 AC3에는 그 경로의 테스트 항목이 없다.
    ```
    수정 커밋 `3344def` · diff 요약: AC3에 테스트 항목 연결 · 판정 주체: 루프
""",
}

SCORE = {
    "q2": "R1 6 → R2 3",
    "q3": "R1 6 → R2 4",
    "done": "R1 6 → R2 3 → C1(확인) pass",
    "r2": "R1 6 → R2 3",
    "r6": "R1 6 → R2 4 → R3 4 → R4 3 → R5 3 → C1(확인) → R6(복귀 적대) 3",
    "exh": "R1 6 → R2 4 → R3 4 → R4 3 → R5 3 → C1(확인) → R6(복귀 적대) 3 → C2(재진입 확인)",
    "d": "R1 6 → R2 4 → R3 4 → R4 3 → R5 3 → C1(확인) → R6(복귀 적대) 3 → C2(재진입 확인) → C3(폴백② 확인·소비)",
}

def cur_loop_block(phase, adv, conf, mode, base_sha, head_sha, branch, ledger_doc,
                   queue_lines, score, ret="미사용", extra=""):
    """cur 규격(0.13.0 §2i 핸드오프 필드)의 미완 루프 블록 — 공유 remember.md 안에 들어간다."""
    return f"""
## review-loop 미완 상태

- phase: {phase}
- 적대 라운드 소진: {adv}
- 확인 라운드 소진: {conf}
- 현재 모드: {mode}
- 복귀 사용 여부: {ret}
- base: `main` @ `{base_sha}`
- branch: `{branch}`
- 중단 시 HEAD SHA: `{head_sha}`
- 보안 크리티컬 트랙 판정: 아니오
- ledger 단일 원본: `{ledger_doc}` 말미
{queue_lines}- score 이력: {score}{extra}
"""

def loop_file(track, phase, adv, conf, mode, base_sha, head_sha, branch, ledger_doc,
              queue_lines, score, ret="미사용",
              budgets="`--max` 5 · `--confirm-rounds` 2 · `--auto-rounds` 3",
              extra="", next_action=""):
    """new 규격의 루프 파일 — 4섹션. (0.16.0 감량판: 폴백② 상태 필드 없음 — fp-I1.
    폴백② 선택·소비 사실은 extra의 사용자 판정 줄과 ledger 문서로만 전달된다.)"""
    return f"""# 루프 상태 — {track} ({phase})

## 현재

- phase: {phase}
- 적대 라운드 소진: {adv}
- 확인 라운드 소진: {conf}
- 현재 모드: {mode}
- 복귀 사용 여부: {ret}
- 실행 예산(해소된 값): {budgets}
- base: `main` @ `{base_sha}`
- branch: `{branch}`
- 중단 시 HEAD SHA: `{head_sha}`
- 보안 크리티컬 트랙 판정: 아니오
- ledger 단일 원본: `{ledger_doc}` 말미 `## 적대검증 ledger ({phase})`
- 작성자: 이 루프를 도는 세션

## task 진행

해당 없음 ({phase} phase)

## 미해결 ledger

{queue_lines}- 미판정 blocking: 0건
- score 이력: {score}{extra}

## 다음 액션

{next_action}
"""

# ---------------------------------------------------------------- repo 생성

def mkrepo(path, slug, main_files, branch_commits, ignore_remember=True):
    """main 초기 커밋 → feat 브랜치 → 커밋들. 반환: (base_sha, head_sha, branch)"""
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True)
    sh(path, "git", "init", "-q", "-b", "main")
    sh(path, "git", "config", "user.email", "fixture@example.com")
    sh(path, "git", "config", "user.name", "fixture")
    write(path, "README.md", f"# {slug}\n\n예제 서비스 저장소.\n")
    write(path, ".gitignore", (".remember/\n" if ignore_remember else "") + "node_modules/\n")
    for rel, text in main_files.items():
        write(path, rel, text)
    sh(path, "git", "add", "-A")
    sh(path, "git", "commit", "-q", "-m", "chore: 초기 골격")
    base = sh(path, "git", "rev-parse", "HEAD")
    branch = f"feat/{slug}"
    sh(path, "git", "checkout", "-q", "-b", branch)
    for msg, files in branch_commits:
        for rel, text in files.items():
            write(path, rel, text)
        sh(path, "git", "add", "-A")
        sh(path, "git", "commit", "-q", "-m", msg)
    head = sh(path, "git", "rev-parse", "HEAD")
    return base, head, branch

# ---------------------------------------------------------------- 사례별 빌더

def build_l1(arm, path):
    """L-1: 컨텍스트 40% 넛지 — 어디에 쓰는가. 전 arm 동일 환경(훅 문구만 arm별)."""
    slug, date, title = "order-cancel-policy", "2026-07-14", "주문 취소 정책 단일화"
    doc = f"docs/specs/{date}-{slug}.md"
    mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대검증 R1~R3 수정 반영", {doc: spec_doc(title, slug, L_R3Q3)}),
    ])
    write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프 진행 중"))

def build_l2(arm, path):
    """L-2: 종결 시 remember.md 보존 확인."""
    slug, date, title = "order-cancel-policy", "2026-07-14", "주문 취소 정책 단일화"
    doc = f"docs/specs/{date}-{slug}.md"
    base, head, branch = mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 확인 라운드 C1 결과 기록", {doc: spec_doc(title, slug, L_DONE)}),
    ])
    q = "- 미확인 FIXED 큐: 0건 (C1에서 `fp-1`·`fp-2` 전건 소멸 확인)\n"
    if arm == "cur":
        write(path, ".remember/remember.md", remember_md(
            title, "spec 루프 종료 처리",
            cur_loop_block("spec", "2 / 5", "1 / 2", "확인", short(base), short(head), branch, doc, q, SCORE["done"])))
    else:
        write(path, ".remember/remember.md", remember_md(title, "spec 루프 종료 처리"))
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "2 / 5", "1 / 2", "확인", short(base), short(head), branch, doc,
                        q, SCORE["done"],
                        next_action="- 확인 verdict pass — 성공 종료 처리\n- 다음 단계 = impl"))

def build_l3c1(arm, path):
    """L-3 ①: 재개 상태 파일 0개 + 명시적 --resume."""
    slug, date, title = "invoice-tax-rounding", "2026-07-09", "청구서 세금 반올림"
    doc = f"docs/specs/{date}-{slug}.md"
    mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): R1~R2 수정 반영", {doc: spec_doc(title, slug, L_R2Q3)}),
    ])
    # 어느 arm에도 재개 상태가 남아 있지 않다.
    write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프"))

def build_l3c2(arm, path):
    """L-3 ②: 재개 상태 1개(spec) + `--phase impl --resume`."""
    slug, date, title = "refund-window", "2026-07-21", "환불 가능 기간"
    doc = f"docs/specs/{date}-{slug}.md"
    base, head, branch = mkrepo(path, slug, dict(GATE_FILES), [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT, ledger_impl="(아직 라운드 없음)")}),
        ("feat: 환불 기간 판정 구현 + 테스트", dict(SRC)),
        ("docs(spec): R1~R2 수정 반영", {doc: spec_doc(title, slug, L_R2Q3, ledger_impl="(아직 라운드 없음)")}),
    ])
    if arm == "cur":
        write(path, ".remember/remember.md", remember_md(
            title, "spec 적대검증 루프",
            cur_loop_block("spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch, doc,
                           QUEUE[3], SCORE["q3"])))
    else:
        write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프"))
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch, doc,
                        QUEUE[3], SCORE["q3"],
                        next_action="- `/clear` 후 `/review-loop --phase spec --resume`"))

def build_l3c3(arm, path):
    """L-3 ③: 재개 상태 1개 + 자동 감지 — 상태가 가리키는 ledger 문서와 사용자가 지목한 트랙이 다르다."""
    slug, date, title = "catalog-sync", "2026-07-28", "카탈로그 동기화"
    doc_b = f"docs/specs/{date}-{slug}.md"
    doc_a = "docs/specs/2026-07-05-price-tier-migration.md"
    base, head, branch = mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc_b: spec_doc(title, slug, DRAFT)}),
        ("docs: 가격 티어 이관 spec 초안", {doc_a: spec_doc("가격 티어 이관", "price-tier-migration", DRAFT)}),
        ("docs(spec): 가격 티어 이관 R1~R2 수정 반영",
         {doc_a: spec_doc("가격 티어 이관", "price-tier-migration", L_R2Q3)}),
    ])
    if arm == "cur":
        write(path, ".remember/remember.md", remember_md(
            "가격 티어 이관", "spec 적대검증 루프",
            cur_loop_block("spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch, doc_a,
                           QUEUE[3], SCORE["q3"])))
    else:
        write(path, ".remember/remember.md", remember_md("가격 티어 이관", "spec 적대검증 루프"))
        write(path, ".remember/loop-2026-07-05-price-tier-migration-spec.md",
              loop_file("가격 티어 이관", "spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch,
                        doc_a, QUEUE[3], SCORE["q3"],
                        next_action="- `/clear` 후 `/review-loop --phase spec --resume`"))

def build_l3c4(arm, path):
    """L-3 ④: planless 트랙 — spec·impl ledger가 같은 문서. 상태는 spec, 사용자는 impl."""
    slug, date, title = "shipping-eta", "2026-08-02", "배송 도착 예정 산출"
    doc = f"docs/specs/{date}-{slug}.md"
    base, head, branch = mkrepo(path, slug, dict(GATE_FILES), [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT, ledger_impl="(아직 라운드 없음)")}),
        ("feat: ETA 판정 구현 + 테스트", dict(SRC)),
        ("docs(spec): R1~R2 수정 반영", {doc: spec_doc(title, slug, L_R2Q3, ledger_impl="(아직 라운드 없음)")}),
    ])
    if arm == "cur":
        write(path, ".remember/remember.md", remember_md(
            title, "spec 적대검증 루프",
            cur_loop_block("spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch, doc,
                           QUEUE[3], SCORE["q3"])))
    else:
        write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프"))
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch, doc,
                        QUEUE[3], SCORE["q3"],
                        next_action="- `/clear` 후 `/review-loop --phase spec --resume`"))

def build_l3c5(arm, path):
    """L-3 ⑤: 재개 대기 상태가 2개."""
    slug, date, title = "webhook-retry", "2026-08-02", "웹훅 재시도"
    doc1 = f"docs/specs/{date}-{slug}.md"
    doc2 = "docs/specs/2026-07-19-audit-log-retention.md"
    base, head, branch = mkrepo(path, slug, {}, [
        ("docs: 감사 로그 보존 spec 초안", {doc2: spec_doc("감사 로그 보존", "audit-log-retention", DRAFT)}),
        ("docs(spec): 감사 로그 보존 R1~R2 수정 반영",
         {doc2: spec_doc("감사 로그 보존", "audit-log-retention", L_R2Q2)}),
        (f"docs: {title} spec 초안", {doc1: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 웹훅 재시도 R1~R2 수정 반영", {doc1: spec_doc(title, slug, L_R2Q3)}),
    ])
    if arm == "cur":
        b1 = cur_loop_block("spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch, doc2,
                            QUEUE[2], SCORE["q2"])
        b2 = cur_loop_block("spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch, doc1,
                            QUEUE[3], SCORE["q3"])
        write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프", b1 + b2))
    else:
        write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프"))
        write(path, ".remember/loop-2026-07-19-audit-log-retention-spec.md",
              loop_file("감사 로그 보존", "spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch,
                        doc2, QUEUE[2], SCORE["q2"],
                        next_action="- `/clear` 후 `/review-loop --phase spec --resume`"))
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch,
                        doc1, QUEUE[3], SCORE["q3"],
                        next_action="- `/clear` 후 `/review-loop --phase spec --resume`"))

def build_l4c1(arm, path):
    """L-4 ①: 컨텍스트 ≥40% 유지 경로. R4 응답 처리분이 미커밋이다."""
    slug, date, title = "notification-digest", "2026-07-30", "알림 요약 다이제스트"
    doc = f"docs/specs/{date}-{slug}.md"
    mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대 R1~R3 수정 반영", {doc: spec_doc(title, slug, L_R3Q3)}),
    ])
    write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프 진행 중"))
    write(path, doc, spec_doc(title, slug, L_R4Q4))          # R4분 미커밋

def build_l4c2(arm, path):
    """L-4 ②: ESCALATE에서 사용자가 중단 선택. R3 응답 처리분이 미커밋이다."""
    slug, date, title = "quota-reset-window", "2026-07-26", "쿼터 리셋 기준시각"
    doc = f"docs/specs/{date}-{slug}.md"
    mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대 R1~R2 수정 반영", {doc: spec_doc(title, slug, L_R2Q2)}),
    ])
    write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프 진행 중"))
    write(path, doc, spec_doc(title, slug, L_R3Q3B))         # R3분 미커밋

def build_l4c3(arm, path):
    """L-4 ③: 폴백②(새 세션에서 확인 라운드 1회) 선택. C2 결과가 미커밋이다."""
    slug, date, title = "session-idle-timeout", "2026-07-24", "세션 유휴 타임아웃"
    doc = f"docs/specs/{date}-{slug}.md"
    base, head, branch = mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대 R1~R5 + 확인 C1 + 복귀 R6 기록", {doc: spec_doc(title, slug, L_EXH_R6)}),
    ])
    if arm == "cur":
        write(path, ".remember/remember.md", remember_md(
            title, "spec 적대검증 루프",
            cur_loop_block("spec", "5 / 5", "1 / 2", "확인(재진입 대기)", short(base), short(head), branch,
                           doc, QUEUE[345], SCORE["r6"], ret="사용함")))
    else:
        write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프"))
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "5 / 5", "1 / 2", "확인(재진입 대기)", short(base), short(head),
                        branch, doc, QUEUE[345], SCORE["r6"], ret="사용함",
                        next_action="- 재진입 확인 C2 실행 예정(상한 밖 예약분)"))
    write(path, doc, spec_doc(title, slug, L_EXH_C2))        # C2(재진입) 결과 미커밋

def build_l4c4(arm, path):
    """L-4 ④: `.remember/`를 git으로 추적하는 repo에서의 성공 종료. C1 결과가 미커밋이다.

    remember.md는 추적·커밋된 상태이고, 루프 파일은 그 위에 얹힌 untracked 파일이다
    (루프 파일에 자기 HEAD를 적는 순간 그 파일은 커밋할 수 없으므로 실제로도 이 형태가 된다).
    """
    slug, date, title = "coupon-stacking", "2026-07-17", "쿠폰 중복 적용 규칙"
    doc = f"docs/specs/{date}-{slug}.md"
    base, _, branch = mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대 R1~R2 수정 반영", {doc: spec_doc(title, slug, L_R2Q2)}),
    ], ignore_remember=False)
    write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프 진행 중"))
    sh(path, "git", "add", "-A")
    sh(path, "git", "commit", "-q", "-m", "chore: 트랙 핸드오프 갱신")
    head = sh(path, "git", "rev-parse", "HEAD")
    if arm != "cur":
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "2 / 5", "0 / 2", "확인", short(base), short(head), branch, doc,
                        QUEUE[2], SCORE["q2"],
                        next_action="- 확인 라운드 C1 실행 예정(큐 2건 소멸 확인)"))
    write(path, doc, spec_doc(title, slug, L_DONE))          # C1 결과 미커밋

def build_l5c1(arm, path):
    """L-5 ①: `--auto-rounds 1`로 시작한 루프의 재개."""
    slug, date, title = "api-key-rotation", "2026-08-05", "API 키 로테이션"
    doc = f"docs/specs/{date}-{slug}.md"
    base, head, branch = mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): R1~R2 수정 반영", {doc: spec_doc(title, slug, L_R2Q3)}),
    ])
    if arm == "cur":
        write(path, ".remember/remember.md", remember_md(
            title, "spec 적대검증 루프",
            cur_loop_block("spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch, doc,
                           QUEUE[3], SCORE["q3"])))
    else:
        write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프"))
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "2 / 5", "0 / 2", "적대", short(base), short(head), branch, doc,
                        QUEUE[3], SCORE["q3"],
                        budgets="`--max` 5 · `--confirm-rounds` 2 · `--auto-rounds` 1",
                        next_action="- `/clear` 후 `/review-loop --resume`"))

def build_l5c2(arm, path):
    """L-5 ②: 확인 소진 2/2 + 폴백② 승인 상태에서의 재개."""
    slug, date, title = "bulk-export-limit", "2026-07-31", "대량 내보내기 상한"
    doc = f"docs/specs/{date}-{slug}.md"
    fb = "\n- 사용자 판정: ESCALATE 폴백 3택 중 **②(새 세션에서 확인 라운드 1회)** 선택"
    base, head, branch = mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대 R1~R5 + 확인 C1·C2 결과 기록", {doc: spec_doc(title, slug, L_EXH_C2)}),
    ])
    if arm == "cur":
        write(path, ".remember/remember.md", remember_md(
            title, "spec 적대검증 루프",
            cur_loop_block("spec", "5 / 5", "2 / 2", "확인", short(base), short(head), branch, doc,
                           QUEUE[345], SCORE["exh"], ret="사용함", extra=fb)))
    else:
        write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프"))
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "5 / 5", "2 / 2", "확인", short(base), short(head), branch, doc,
                        QUEUE[345], SCORE["exh"], ret="사용함", extra=fb,
                        next_action="- `/clear` 후 `/review-loop --resume`"))

def build_l5c3(arm, path):
    """L-5 ③: 폴백② 라운드가 타임아웃으로 끝난 뒤의 재개."""
    slug, date, title = "webhook-signature", "2026-07-12", "웹훅 서명 검증"
    doc = f"docs/specs/{date}-{slug}.md"
    fb = ("\n- 사용자 판정: ESCALATE 폴백 3택 중 **②(새 세션에서 확인 라운드 1회)** 선택"
          "\n- 직전 시도: 폴백② 확인 라운드 실행 → **타임아웃**(응답 없음, ledger 기록 없음)")
    base, head, branch = mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대 R1~R5 + 확인 C1·C2 결과 기록", {doc: spec_doc(title, slug, L_EXH_C2)}),
    ])
    if arm == "cur":
        write(path, ".remember/remember.md", remember_md(
            title, "spec 적대검증 루프",
            cur_loop_block("spec", "5 / 5", "2 / 2", "확인", short(base), short(head), branch, doc,
                           QUEUE[345], SCORE["exh"], ret="사용함", extra=fb)))
    else:
        write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프"))
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "5 / 5", "2 / 2", "확인", short(base), short(head), branch, doc,
                        QUEUE[345], SCORE["exh"], ret="사용함", extra=fb,
                        next_action="- `/clear` 후 `/review-loop --resume`"))

def build_bc1(arm, path):
    """감량 arm ⓑ ①: 적대 예산 소진(5/5) + 큐 5건 + batch 적재 1건 — 종료가 아니라 flush 후 확인 진입.

    auto-rounds 5로 시작한 루프(전 라운드 자동 모드)라 batch flush 지점이 소진 5 == auto-rounds,
    즉 바로 지금이다 — R4 적재분(fp-6)이 규약 위반 없이 미flush로 남는 유일한 형태.
    """
    slug, date, title = "rate-limit-policy", "2026-08-03", "요율 제한 정책"
    doc = f"docs/specs/{date}-{slug}.md"
    mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대 R1~R5 수정 반영", {doc: spec_doc(title, slug, L_B1)}),
    ])
    write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프 진행 중"))

def build_bc2(arm, path):
    """감량 arm ⓑ ②: R1 신규 blocking 0 — 클린 트랙의 빠른 종료 판정."""
    slug, date, title = "audit-export-format", "2026-08-06", "감사 내보내기 형식"
    doc = f"docs/specs/{date}-{slug}.md"
    mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대 R1 결과 기록", {doc: spec_doc(title, slug, L_B2)}),
    ])
    write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프 진행 중"))

def build_dc1(arm, path):
    """감량 arm ⓓ: 폴백② 소비 후 재도달 — ②를 재제시하지 않는가(남은 선택지 ①·③)."""
    slug, date, title = "export-retention", "2026-08-04", "내보내기 보존 기한"
    doc = f"docs/specs/{date}-{slug}.md"
    fb = ("\n- 사용자 판정: 폴백 3택 중 **②** 선택 → C3(폴백② 확인, 예약분)로 수행 완료 — **완전한 응답 수신(소비됨)**"
          "\n- 직전 세션은 C3 기록·커밋 후 컨텍스트 임계(§2i ①)로 일시중단")
    base, head, branch = mkrepo(path, slug, {}, [
        (f"docs: {title} spec 초안", {doc: spec_doc(title, slug, DRAFT)}),
        ("docs(spec): 적대 R1~R5 + 확인 C1·C2 + 폴백② C3 결과 기록", {doc: spec_doc(title, slug, L_D1)}),
    ])
    if arm == "cur":
        write(path, ".remember/remember.md", remember_md(
            title, "spec 적대검증 루프",
            cur_loop_block("spec", "5 / 5", "2 / 2", "확인", short(base), short(head), branch, doc,
                           QUEUE[45], SCORE["d"], ret="사용함", extra=fb)))
    else:
        write(path, ".remember/remember.md", remember_md(title, "spec 적대검증 루프"))
        write(path, f".remember/loop-{date}-{slug}-spec.md",
              loop_file(title, "spec", "5 / 5", "2 / 2", "확인", short(base), short(head), branch, doc,
                        QUEUE[45], SCORE["d"], ret="사용함", extra=fb,
                        next_action="- `/clear` 후 `/review-loop --resume`"))

CASES = {
    "l1-c1": build_l1,
    "l2-c1": build_l2,
    "l3-c1": build_l3c1, "l3-c2": build_l3c2, "l3-c3": build_l3c3, "l3-c4": build_l3c4, "l3-c5": build_l3c5,
    "l4-c1": build_l4c1, "l4-c2": build_l4c2, "l4-c3": build_l4c3, "l4-c4": build_l4c4,
    "l5-c1": build_l5c1, "l5-c2": build_l5c2, "l5-c3": build_l5c3,
    "b-c1": build_bc1, "b-c2": build_bc2,
    "d-c1": build_dc1,
}

def main():
    if FIX.exists():
        shutil.rmtree(FIX)
    for case, fn in CASES.items():
        for arm in ("cur", "new", "none"):
            fn("new" if arm == "none" else arm, FIX / case / arm)   # none = new와 동일 환경
    print(f"생성 완료: {len(CASES)} 사례 × 3 arm = {len(CASES) * 3} repo")

if __name__ == "__main__":
    main()
