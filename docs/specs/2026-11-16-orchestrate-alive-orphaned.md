# orchestrate `alive` — 화면에서 분리된(고아) 터미널을 종료로 오판 (1.6.1)

- 단계: **1–2 spec 초안** (2026-11-16 · 수동 트랙 · 브랜치 `gguii74-rwk/orchestrate-alive-orphaned-1-6-1`, base main `408bf16` = 1.6.0 트랙 종결 상태 · 설계 질문 4건 Q1~Q4 + 경로 질문 Q5 전부 첫 선택지 → D1~D7) → 다음 = 3 harden-spec(같은 세션).
- 경로: **경량 (dev-cycle 1차 판정 + 질문 답 2026-11-16, Q5 — D6)** — 4 spec 적대검증은 **유지** · 5 plan 생략(6은 자동 해당없음). 하한 3종(spec 문서 · harden-spec · impl 적대검증)은 수행한다. 접촉 표면 스캔: 스키마 · 마이그레이션 · 권한 · 인증 · 외부 연동 신설 · 데이터 유실 · 비가역 — 해당 없음. 다만 `alive`는 「살아 있는 세션을 둘로 만든다」「셸만 남은 터미널에 키를 보낸다」를 막는 안전 판정이고 1.2.0 spec 적대검증에서 같은 판정에 high 지적이 3번 나왔다(R2-1 · R4-1 · R6-1) → spec 적대검증을 남긴다. plan을 생략하므로 impl ledger 위치 = 이 문서 말미 `## 적대검증 ledger (impl)`.
- 출처: 핸드오프 「[다음 세션 시작점] 1.6.0 트랙 종결」 남은 것 ③ ⓓ · 사용자 지시 2026-11-16 14:18 「좋습니다. 진행해주세요」(후속 후보 4건 중 ⓓ 먼저 — 핸드오프 트랙 블록) · 맥북 관측 기록 2026-11-15~16(§1 · §6a) · 메모리 `orchestrator-delegate-answers` 「터미널 「고아」 판정(2026-11-15)」 절 · 원 설계 `2026-10-17-orchestrate-skill-delegated-auto-adopt.md`(1.2.0 — §3w · F2 · AC3).
- 선행: **불변** — 1.2.0 D1~D44(특히 D3 오르카 상세는 스크립트 1곳 · D6 자가 점검 · D15 전송 전 `alive` + 종료 시 `--resume` · D16 · D23 · D36 본문 오르카 허용 범위 · 표지 2종 · 제목으로 터미널을 고르지 않는다) · 1.2.1 D9(orchestrate SKILL.md 분량 상한 17,408바이트) · 1.5.0 D1~D28 · 1.6.0 D블록. `alive` exit 코드 0 · 1 · 2 · 3의 뜻과 「조건 상호 배타」는 그대로다. **선행 spec 문장 변경 1건** — 1.2.0 §3w · AC3의 「exit 1 = 종료 · 미연결 · **고아**」에서 「고아」를 뺀다(§3e — 이 트랙의 수정 목적 그 자체 · Q1 답).
- 답 출처: 이 트랙의 AskUserQuestion은 사용자 상시 지시(2026-10-18 · 10-22)에 따라 메인 세션이 추천안을 대신 입력한다. Q1~Q5의 출처 = **메인 대리 답(추천안 — 사용자 상시 지시)** — 메인이 「사용자 본인 답」이라고 따로 알린 문항은 없다.
- 범위: 핸드오프 후속 후보 ⓐ~ⓓ 중 **ⓓ 하나**. ⓐ(압축 뒤 한 줄 보고) · ⓑ(§0b 위치 판정표 구간) · ⓒ(setup 「통째로 재작성」 문구)는 별도 후속 트랙이다.

## 1. 문제 (현상 · 재현 근거 · 원인)

**현상.** `node <orchestrate Base directory>/scripts/orchestrate.mjs alive <핸들>`이 오르카 화면에서 탭이 분리된(고아, `orphaned: true`) 트랙 터미널에 `EXITED … orphaned=true`(exit 1 = 종료)를 낸다. 그때 claude 프로세스는 살아 있었다.

**왜 문제인가.**

1. **같은 세션이 둘이 된다.** exit 1은 SKILL.md ② TIMEOUT 줄(「1 ⑤-5 종료 복구」) · ③ 입력 직전 확인 (a)(「1·3이면 ⑤로 복구」) · ⑤-5(「`alive`가 1이면 새 터미널에서 `claude --resume <세션 id>`」)로 이어진다. 문면대로 따르면 살아 있는 세션을 한 번 더 띄운다 — 1.2.0이 R1-3 · R2-1 · R4-1 · R6-1로 네 번 막은 바로 그 사고다.
2. **`key`가 키를 한 개도 못 보낸다.** `key`는 키마다 `alive`를 다시 보고 0이 아니면 `ERR 전송 중단`으로 멈춘다(`orchestrate.mjs:253` · `:258`).

**재현 근거(맥북 · 오르카 앱 화면이 있는 머신 — 이 저장소 밖 기록, 인용).**

- 핸드오프 2026-11-15 21:12(1.5.0 트랙 harden 국면 질문 1): 「메인의 `key`는 터미널이 화면에서 분리돼(`alive` = EXITED orphaned · pgrep 생존) **0/1로 중단**됐고 … 그 뒤 메인이 보낸 엔터 1개는 빈 입력 줄에 들어가 효과 없음」.
- 핸드오프 2026-11-16 「메인 인계」 블록(1.6.0 트랙): 「**트랙 터미널은 기동 직후부터 화면 분리(orphaned)라 `alive`가 EXITED를 낸다**: `pgrep -f "session-id …"` + `orca terminal read --terminal <핸들> --screen --json`으로 확인하고, 키·명령은 `orca terminal send --terminal <핸들> --text … --json` 직접 … `watch <핸들> 580` … 고아 상태에서도 QUESTION·DONE을 잡는다」.
- 핸드오프 2026-11-16 「다음 세션 시작점」 남은 것 ③ ⓓ: 「orchestrate `alive`의 orphaned 오판(이 세션의 트랙 터미널 **전부에서 재현** — pgrep + 화면 읽기 + 직접 send로 우회)」. 1.5.0 · 1.6.0 두 트랙의 트랙 블록마다 같은 메모가 붙어 있다(「터미널은 화면 분리(orphaned) — pgrep `session-id …` + 화면 읽기 · 직접 send」).
- 메모리 `orchestrator-delegate-answers`(2026-11-15): 「고아 상태에서도 `writable: true`면 들어간다 — 11-15 확인」 · 「`watch`는 고아 상태에서도 QUESTION을 잡는다」 · 「`orca terminal switch`로 다시 붙이면 풀리지만 사용자의 오르카 화면을 그 탭으로 옮기고, 사용자가 다른 탭으로 가면 다시 고아가 된다」.

**spark2에서는 재현되지 않는다(2026-11-16 · 화면 없는 오르카 호스트 · 오르카 CLI 1.4.252).** 메인이 이 트랙 터미널을 띄운 직후 본 값(핸드오프 트랙 블록)과 이 세션이 자기 터미널을 직접 조회한 값이 같다 — `connected: true · writable: true · orphaned: false · paneRuntimeId: -1` · `alive` = `ALIVE claude 입력 상태(프롬프트 박스)`(exit 0).

**원인.** `dev-workflow/skills/orchestrate/scripts/orchestrate.mjs:219`

```js
if (!t.connected || t.orphaned) return [1, `EXITED 터미널 미연결 또는 고아(connected=${t.connected}, orphaned=${t.orphaned})`];
```

「미연결」과 「고아」를 한 조건으로 묶어 둘 다 종료로 낸다(머리 주석 `:209`도 「1 종료(미연결·고아·셸만 남음)」). 원 설계(1.2.0 §3w)가 「1 종료·미연결·고아」로 적었고 AC3도 「종료/고아(exit 1)」 1건이라, 테스트 `tests/orchestrate/orchestrate.test.mjs:339` 「AC3 alive: 미연결·고아 → exit 1」은 `connected:false · writable:false · orphaned:true`를 한꺼번에 준다 — **`connected:true · orphaned:true`(연결됐는데 고아) 조합의 테스트는 없다**.

**`orphaned`가 실제로 뜻하는 것(§6a).** 오르카 공식 문서(`orca skills get orca-cli` · `orca terminal show --help`)에는 이 필드의 **정의가 없다**. spark2에 설치된 런타임 코드(비공식 조회 — 버전에 따라 바뀔 수 있다)로는 「그 터미널 프로세스(PTY)를 잡고 있는 탭·창이 현재 화면 구성에 없다」는 표시이고, `connected`(프로세스 생존 — 프로세스가 끝나면 false)와 **따로** 계산된다. 즉 고아는 「화면에 붙어 있나」이지 「살아 있나」가 아니다.

**미확인(L5 — 그대로 적는다).** 맥북 고아 터미널의 `terminal show` **원값**(`connected` · `writable`)은 기록에 없다. 남은 것은 `EXITED … orphaned=true`와 「`writable: true`면 전송된다」뿐이다. 「고아일 때도 `connected: true`」라는 이 수정의 전제는 간접 근거(spark2 런타임 코드에서 이 종류 핸들은 `writable` = `connected`)에 선다 → AC13에서 확인한다.

## 2. 목표 / 범위 / 비목표

**목표** — (a) `connected: true · orphaned: true` 터미널에서 `alive`가 고아만으로 종료(exit 1)를 내지 않고, 화면 판독으로 0 · 1 · 2를 가린다 (b) 그 상태에서 `key`가 평소처럼 키를 보낸다 (c) 메인이 「화면 분리」를 보고 탭을 화면에 다시 붙이려 사용자의 오르카 화면을 옮기지 않는다 (d) exit 코드 0 · 1 · 2 · 3의 뜻 · 조건 상호 배타 · SKILL.md의 `alive` 분기 문구는 바뀌지 않는다.

**범위**

| 파일 | 변경 | 단계 |
|---|---|---|
| `dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` | `alive()`의 종료 조건에서 `orphaned` 제거 · 판정 줄 꼬리표 ` · 화면 분리(orphaned)` · 머리 주석 1줄(§3a). `key()` · `watch()` · 그 밖 무변경 | 7 |
| `tests/orchestrate/orchestrate.test.mjs` | 신규 9건 · 기존 1건 이름 변경(§3d). 기존 55건의 단언 무변경 | 7 |
| `dev-workflow/skills/orchestrate/SKILL.md` | 「함정」 절에 1줄 추가(§3c). ① ~ ⑤ 무변경 · 크기 ≤ 17,408B | 7 |
| `dev-workflow/.claude-plugin/plugin.json` | 1.6.0 → 1.6.1(`version`만 — description 불변) | 9 |
| `docs/specs/2026-11-16-orchestrate-alive-orphaned.md` | 이 문서 | 1–9 |

**무변경(영향 범위 검토 결과)** — `README.md` · `README.ko.md` · `README.ja.md`(213행의 `alive` 설명 「exit 0 생존 / 1 종료 / 2 판독 불가 / 3 stale 핸들」은 그대로 맞다 · 「고아」 언급 없음 — D9) · `templates/track-prompt.md` · `references/codex-job-check.md` · `.claude-plugin/marketplace.json`(version 필드 없음) · 다른 스킬 · 훅 · 선행 spec 문서(1.2.0 §3w 문장 변경은 이 문서 §3e가 기록한다 — 옛 문서를 고치지 않는다).

**비목표**

- 새 exit 코드 · 새 판정 이름(「분리됨」 등)을 만들지 않는다(Q1 — 계약 추가 없음).
- `key`에 고아 전용 분기 · 묶음 제한을 넣지 않는다(Q2).
- 고아 터미널을 화면에 다시 붙이지 않는다 — 스크립트도 스킬 절차도 `terminal switch`(= `focus`)를 쓰지 않는다(D8).
- 고아가 **왜** 생기는지(맥북에서 기동 직후부터 · spark2에서는 아님)를 밝히거나 막지 않는다 — 오르카 쪽 동작이다.
- 프로세스 생존을 `pgrep`으로 따로 확인하는 절차를 스킬에 넣지 않는다 — 화면 판독이 이미 가린다(§3a).
- `connected: false`인데 살아 있는 세션(관측 없음)은 다루지 않는다 — 현행과 같다(exit 1).
- `watch`는 건드리지 않는다 — 고아 상태에서도 판정이 정상이었다(§1).
- 핸드오프 후속 후보 ⓐ · ⓑ · ⓒ.

## 3. 설계

### 3a. `alive` — 고아를 종료 판정에서 뺀다 (D1 · D2 · D10)

`terminal show` 뒤의 판정 순서(바뀌는 것은 첫 줄 하나):

| 순서 | 조건 | 현행 | 1.6.1 |
|---|---|---|---|
| 1 | `connected: false` | exit 1 EXITED | exit 1 EXITED(그대로) |
| 1′ | `connected: true · orphaned: true` | **exit 1 EXITED** | **다음 순서로 넘어간다** |
| 2 | `writable: false` | exit 2 UNREADABLE 쓰기 불가 | 그대로 |
| 3 | 화면 읽기 → stale | exit 3 | 그대로 |
| 4 | 종료 표지 + 셸 프롬프트 복귀 | exit 1 EXITED 셸만 남음 | 그대로 |
| 5 | 프롬프트 박스 · 질문 창 · 권한 창 | exit 0 ALIVE | 그대로 |
| 6 | 그 밖 | exit 2 UNREADABLE | 그대로 |

- **exit 1의 조건** = 「`connected: false`」 ∨ 「화면에 claude 종료 표지 + 셸 프롬프트 복귀」. `orphaned` 값은 어느 exit 코드도 정하지 않는다.
- **조건 상호 배타는 유지된다** — `!connected` → 1 / `connected ∧ !writable` → 2 / `connected ∧ writable` → 화면 판독(0 · 1 · 2 · 3은 현행 규칙 그대로 서로 배타).
- **꼬리표(D2).** `orphaned: true`면 `terminal show` 뒤에 내는 판정 줄(`ALIVE …` · `EXITED …` · `UNREADABLE …`)의 **끝에** ` · 화면 분리(orphaned)`를 붙인다. `orphaned: false`면 줄은 현행과 글자 그대로 같다. `STALE …` · `ERR …` 줄에는 붙이지 않는다(핸들이 바뀌었거나 값을 못 읽은 상태다). 꼬리표는 사람·메인이 읽는 표시일 뿐 — `key`는 `alive()`의 반환 코드 · 화면 종류 · 창 내용만 쓰고 줄 문자열을 해석하지 않는다(`orchestrate.mjs:253~264`).
- **미연결 줄의 문구.** `EXITED 터미널 미연결(connected=false)` + (고아면) 꼬리표. 「미연결 또는 고아」 문구는 사라진다.
- **머리 주석(`:209`).** 「exit 0 생존 · 1 종료(미연결·셸만 남음) · 2 판독 불가/ERR · 3 stale — 조건은 상호 배타. `orphaned`는 판정에 쓰지 않는다(화면에 탭이 없다는 표시 — 1.6.1)」 취지.
- **자가 점검 필드 목록은 그대로(D10).** `connected` · `writable` · `orphaned` 셋 다 boolean이어야 한다(없으면 exit 2 + orca-cli 안내 — 기존 AC2 테스트). `orphaned`는 꼬리표에 계속 쓰인다.
- **고아 터미널의 화면 읽기가 실패하면** 현행 규칙 그대로다 — 출처가 `screen`이 아니면 `ERR 렌더링 화면을 읽지 못했다 … 종료로 보지 않는다`(exit 2 · `readScreen()`). 맥북 관측에서는 고아 상태의 화면 읽기 · `watch` 판정이 정상이었다(§1).

**왜 화면 판독이면 충분한가.** 이 수정으로 exit 0이 새로 나오는 경우는 「고아 ∧ 연결 ∧ 쓰기 가능 ∧ 화면에 claude 입력 상태 ∧ 종료 표지 없음」 하나다. 고아가 아닌 터미널에서 exit 0을 내는 조건과 **화면 쪽 조건이 완전히 같다** — 셸만 남은 화면 · 종료 안내 뒤 셸 프롬프트 · 판독 불가 화면을 가리는 1.2.0의 규칙(R2-1 · R6-1 · plan R1-1 · R2-1 · impl R3-1)이 고아 터미널에도 그대로 적용된다.

### 3b. `key` — 평소대로 보낸다 (D3)

`key()` 코드는 바뀌지 않는다. `alive()`가 0을 내면 고아 여부와 무관하게 보내고, 기존 안전장치는 그대로다 — 키마다 생존 재확인 · 화면 종류(박스 · 질문 창 · 권한 창)가 바뀌면 중단 · 창 내용이 바뀌면 중단 · 오르카가 수락(`result.send.accepted`)하지 않으면 중단. 고아 터미널이 셸만 남은 화면이면 `alive()`가 1을 내므로 키는 한 개도 나가지 않는다(AC8).

### 3c. SKILL.md — 분기 문구 그대로 + 함정 1줄 (D4 · D8)

② TIMEOUT 줄 · ③ 입력 직전 2중 확인 (a) · ④ 트랙 터미널 처분 · ⑤-5는 **한 글자도 바꾸지 않는다** — exit 코드의 뜻이 같아 분기가 그대로 맞다(현재 SKILL.md에는 「고아」라는 말이 없다 — §6b).

「## 함정 (1줄씩)」 절 끝에 1줄을 더한다(초안 문구 — 가조립 실측 217바이트 → 17,086 + 217 = **17,303B** ≤ 17,408B, 여유 105B):

```
- `alive` 줄 끝 「화면 분리」 = 탭이 오르카 화면에 안 붙었다는 표시일 뿐 종료가 아니다 → 붙이려고 `terminal switch`·`focus`를 쓰지 않는다(사용자 화면이 옮겨진다).
```

- `terminal switch` · `focus`는 서브커맨드 이름이라 1.2.0 D36(본문 오르카 허용 = 기동 1줄 + 서브커맨드 이름)과 AC1 금지 목록(`--for ` · `--screen` · `--wait-submit` · `--retry-request` · `result.terminal`)에 걸리지 않는다.
- 분량이 넘치면 **문구를 줄인다**(상한 17,408B는 바꾸지 않는다 — 1.2.1 D9).

### 3d. 테스트 (스텁 `orca` — `tests/orchestrate/orchestrate.test.mjs`)

고아 응답 픽스처 1개(`connected: true · writable: true · orphaned: true`)를 더하고 아래 9건을 추가한다. 기존 「AC3 alive: 미연결·고아 → exit 1」은 입력·단언을 그대로 두고 **이름만** 「미연결 → exit 1(고아 표시와 무관)」 취지로 바꾼다. 나머지 기존 55건은 이름 · 입력 · 단언 무변경. 총 56 → **65건**.

| # | 입력(스텁) | 기대 | AC |
|---|---|---|---|
| T1 | `alive` · 고아 + 프롬프트 박스 화면 | exit 0 · 첫 줄 `^ALIVE` · `프롬프트 박스` · 줄 끝 `화면 분리(orphaned)` | AC1 |
| T2 | `alive` · 고아 + 질문 창 화면 | exit 0 · `질문 창` · 꼬리표 | AC1 |
| T3 | `alive` · 고아 + 종료 표지 + 셸 프롬프트 화면 | exit 1 · `^EXITED` · 꼬리표 | AC2 |
| T4 | `alive` · 고아 + 판독 불가 화면(빌드 출력) | exit 2 · `^UNREADABLE` · 「종료로 보지 않는다」 | AC3 |
| T5 | `alive` · `connected:false · writable:false · orphaned:false` | exit 1 · `^EXITED` · `미연결` · 꼬리표 없음 | AC4 |
| T6 | `alive` · `connected:true · writable:false · orphaned:true` | exit 2 · `^UNREADABLE` · 화면 읽기 호출 0회 | AC5 |
| T7 | `alive` · 고아 아님 + 프롬프트 박스 화면 | exit 0 · 출력에 `화면 분리` 없음 | AC6 |
| T8 | `key … enter` · 고아 + 질문 창 화면 · 전송 수락 | exit 0 · `SENT 1` · 전송 호출 1회 | AC7 |
| T9 | `key … enter` · 고아 + 종료 표지 + 셸 프롬프트 화면 | exit 2 · `^ERR 전송 중단 — 0/1` · 전송 호출 0회 | AC8 |

### 3e. 선행 spec 문장 변경 (근거 = Q1 답)

| 선행 | 옛 문장 | 1.6.1 |
|---|---|---|
| 1.2.0 §3w `alive` | 「1 종료·미연결·**고아** 또는 셸만 남음」 | 「1 종료·미연결 또는 셸만 남음」 — `orphaned`는 판정에 쓰지 않는다 |
| 1.2.0 AC3 `alive` | 「종료/**고아**(exit 1)」 1건 | 「미연결(exit 1)」 1건 + §3d T1~T7 |
| 1.2.0 F2 | 연결 필드 = `connected` · `writable` · `orphaned` | 불변(자가 점검 대상 그대로 — D10) |
| 1.2.0 D15 | 전송 전 `alive`, 종료 시 `--resume` 복구 | 불변 — 종료의 정의에서 고아만 빠진다 |

1.2.0 재논의 금지 표(D1~D44)에는 「고아」가 들어간 결정 행이 없다 — 바뀌는 것은 §3w 본문과 AC3의 문장이다.

### 3f. 버전 · 이행

- **1.6.1**(D7) — exit 코드 · 서브커맨드 · 인자 계약이 늘지 않는 결함 수정이다. 출력 줄 끝 꼬리표는 고아일 때만 붙고, 줄 문자열을 해석하는 소비처는 저장소에 없다(§6b).
- 설치본이 1.6.1 미만인 머신에서는 현행 동작(고아 = exit 1)이 남는다 — 그동안은 지금의 우회(프로세스 확인 + 화면 읽기 + 직접 전송 — 메모리 `orchestrator-delegate-answers`)를 쓴다. SKILL.md ① 1의 설치 버전 기준(1.6.0 미만이면 갱신 제안)은 건드리지 않는다.

## 4. Acceptance Criteria

실행: `node --test tests/orchestrate/orchestrate.test.mjs`(폴더 인자 금지). AC1~AC8은 §3d의 스텁 테스트로 검증한다.

- **AC1 (고아 + 입력 상태 → 생존)**: `connected:true · writable:true · orphaned:true` + 프롬프트 박스 화면 → exit 0 · 첫 줄이 `ALIVE`로 시작하고 `화면 분리(orphaned)`로 끝난다(T1). 같은 응답 + 질문 창 화면 → exit 0 · `질문 창` 포함 · 같은 꼬리표(T2).
- **AC2 (고아 + 셸만 남음 → 종료)**: 고아 + 종료 표지 「Resume this session with」와 셸 프롬프트 복귀 화면 → exit 1 · `EXITED`(T3).
- **AC3 (고아 + 판독 불가 → 2)**: 고아 + 입력 상태도 종료 표지도 없는 화면 → exit 2 · `UNREADABLE` · 「종료로 보지 않는다」(T4).
- **AC4 (미연결 → 종료 유지)**: `connected:false`면 `orphaned` 값과 무관하게 exit 1 · `EXITED` — `orphaned:true`(기존 테스트, 이름만 변경) · `orphaned:false`(T5) 각 1건. 스크립트에 문자열 `미연결 또는 고아` 0건.
- **AC5 (고아 + 쓰기 불가 → 2)**: `connected:true · writable:false · orphaned:true` → exit 2 · `UNREADABLE` · 스텁 호출 기록에 `read` 0회(T6).
- **AC6 (고아가 아니면 출력 불변)**: `orphaned:false` + 프롬프트 박스 화면 → exit 0 · 출력에 `화면 분리` 없음(T7). 기존 55건은 단언 무변경으로 통과한다.
- **AC7 (`key` — 고아 터미널에 전송)**: 고아 + 질문 창 화면 + 전송 수락 → `key <핸들> enter` exit 0 · `SENT 1` · 스텁 호출 기록에 `send` 1회(T8).
- **AC8 (`key` — 고아 + 셸만 남음 → 미전송)**: 고아 + 종료 표지 + 셸 프롬프트 화면 → exit 2 · 첫 줄 `ERR 전송 중단 — 0/1` · `send` 0회(T9).
- **AC9 (테스트 수)**: 56 → 65건 전부 통과(신규 9 · 이름 변경 1 · 삭제 0).
- **AC10 (SKILL.md 문구 · 분량)**: `dev-workflow/skills/orchestrate/SKILL.md`의 「## 함정」 절에 `화면 분리` ≥ 1 · `terminal switch` ≥ 1 · 「종료가 아니다」 ≥ 1 — 같은 한 줄 안. `git diff <구현 base> -- dev-workflow/skills/orchestrate/SKILL.md`의 추가 줄 1 · 삭제 줄 0. `wc -c` ≤ 17,408. 1.2.0 AC1 금지 문자열(`--for ` · `--screen` · `--wait-submit` · `--retry-request` · `result.terminal`) grep 0건 유지.
- **AC11 (문법)**: `node --check dev-workflow/skills/orchestrate/scripts/orchestrate.mjs` 통과 · `grep -nE '\$[0-9]' dev-workflow/skills/orchestrate/SKILL.md` 0건(1.1.1 AC1 승계).
- **AC12 (변경 범위)**: 구현 diff(7단계) = `orchestrate.mjs` · `orchestrate.test.mjs` · orchestrate `SKILL.md` · 이 spec 4파일뿐. `README*.md` · `templates/` · `references/` · 다른 스킬 · `hooks/` diff 0. `orchestrate.mjs`의 `key()` · `watch()` 함수 본문 diff 0.
- **AC13 (실측 — 릴리스 뒤 맥북 설치본 · 사용자 · 트랙 완료 조건 — D5)**: 맥북 user 범위 설치본을 1.6.1로 올린 뒤, 화면에서 분리된 실제 트랙 터미널 1개에서 세 가지를 관측해 이 문서 「AC13 기록」에 적는다 — ① `orca terminal show`의 원값(`connected` · `writable` · `orphaned`) ② `orchestrate.mjs alive <핸들>` = exit 0 + 줄 끝 「화면 분리(orphaned)」 ③ `orchestrate.mjs key <핸들> enter`(열린 질문 창의 추천안 — 메인이 대리 답할 실제 질문) = `SENT 1` + 화면 · 세션 기록에서 답 반영 확인. **①에서 `connected: false`가 나오면 전제 반증** — 트랙은 미완료로 두고 그 원값으로 다시 설계한다(이 수정은 그 경우 현행과 같은 동작이라 해가 없다). 맥북에서 고아가 더는 재현되지 않으면 그 사실을 적고 사용자 판정을 받는다.
- **AC14 (릴리스 — 9단계)**: `plugin.json`의 `version` = `1.6.1` · description diff 0.

## 5. 검증 · 릴리스

- 7 구현 = 경량 planless TDD(테스트 먼저 — T1~T9가 실패하는 것을 본 뒤 `alive()` 수정). 게이트 = AC1~AC12.
- 8 review-loop(impl) — 보안 판정은 기동 때 메인이 정한다(이 저장소 결함 수정 트랙의 상시 지시 = `--security yes`).
- 9 릴리스 = `plugin.json` 1.6.1(AC14) → push · main 머지는 사용자 확인 → 설치 갱신(사용자) → AC13.
- npm 게이트가 없는 저장소다 — impl 게이트는 위 `node --test` · `node --check` · grep으로 갈음한다(dev-cycle 8단계 규정).

## 6. 조회 기록

### 6a. 오르카 (2026-11-16 · spark2 · 오르카 CLI 1.4.252 · 런타임 `0.1.0+506b358db7f0`)

| # | 조회 | 결과 |
|---|---|---|
| F1 | `orca skills get orca-cli`(30,565B) · `orca terminal show --help` | `orphaned` · `connected` · `writable` 필드의 **정의 없음**. `terminal switch` = 「Switch to a terminal tab in the UI」. 「A paired server has no window. `terminal switch --environment <name>` moves the desktop app on this machine to that server's terminal」 |
| F2 | `orca terminal focus --help` | `terminal switch`의 도움말이 그대로 나온다 — `focus`는 `switch`의 다른 이름이다 |
| F3 | 이 세션 자기 터미널 `orca terminal show --terminal "$ORCA_TERMINAL_HANDLE" --json` | `connected: true · writable: true · orphaned: false · paneRuntimeId: -1` · `tabId` · `leafId`는 실제 id(`pty:` 접두 아님) |
| F4 | 런타임 코드(`orcad-server.js` — 압축된 번들을 읽은 **비공식** 조회) | 터미널 요약을 만드는 길이 둘이다. (i) 탭·창 기준 요약 = `orphaned: false` 고정. (ii) 프로세스(PTY) 기준 요약 = `orphaned` = 「그 PTY에 기록된 탭·창이 없거나, 현재 화면 구성에서 그 창이 이 PTY를 잡고 있지 않다」 · `connected` = PTY 생존(프로세스가 끝나면 false · `exitCause` 필드가 생긴다) · `writable` = `connected` · 고아면 `tabId` · `leafId`가 `pty:<ptyId>`로 나온다. (ii)의 `show` 응답은 `paneRuntimeId: -1` 고정 |
| F5 | F3 · F4에서 | `paneRuntimeId: -1`은 고아의 표시가 아니다(spark2에서는 고아가 아닌데도 -1). 메모리의 「고아 = `paneRuntimeId: -1`」은 정확하지 않다(범위 밖 관찰 O1) |
| F6 | 핸드오프 트랙 블록(메인 기록 2026-11-16) | spark2에서 `orca terminal create` 응답 = `surface: "background"` + 경고 「… Orca could not make it discoverable. Run `orca terminal focus --terminal …` to reveal and focus it.」 — 그래도 `orphaned: false` · `alive` exit 0 · 전송 수락 |

맥북의 오르카 버전은 **미확인**이다(1.2.0 F2 조회 때는 1.4.229). F4는 spark2 런타임의 코드이고 맥북 런타임이 같은 코드인지는 확인하지 않았다.

### 6b. 저장소 (2026-11-16 · base `408bf16`)

- `git status --short` 공란 · HEAD = main = origin/main = `408bf16` · `plugin.json` version 1.6.0 — 트랙 프롬프트의 사실과 일치.
- orchestrate `SKILL.md` 17,086B · `orchestrate.mjs` 19,095B · 테스트 `^test(` 56건.
- `orphaned` · 「고아」의 출현(터미널 뜻으로): `orchestrate.mjs:209`(주석) · `:217`(자가 점검 필드) · `:219`(판정) · `orchestrate.test.mjs:42`(`SHOW_OK`) · `:106` · `:339~340`. **SKILL.md · README 3종 · 템플릿에는 0건**.
- `alive()`의 호출부: `:253`(`key` — 반환값 `[code, line, kind, content]` 중 `line`은 오류 문구에만 쓴다) · `:304`(`alive` 서브커맨드 — 줄을 그대로 출력). 줄 문자열을 해석하는 코드는 없다. SKILL.md가 출력 문자열에 기대는 곳은 ③의 「`alive` 출력 `(권한 창)`」과 ④의 「`alive`가 프롬프트 박스」 둘 — 꼬리표는 줄 **끝**에 붙으므로 둘 다 그대로 읽힌다.
- README 213행(3종 같은 위치): `alive` = 「exit 0 생존 / 1 종료 / 2 판독 불가 / 3 stale 핸들」 — 고아 언급 없음.
- 선례: 1.4.1(orchestrate 패치 릴리스 `84d7d31`)은 `plugin.json` 1파일만 바꿨고 README는 건드리지 않았다.
- 이 저장소에는 프로젝트 CLAUDE.md가 없다.

### 6c. 실측 필요 (문서 · 스텁으로 확정되지 않음)

| # | 항목 | 어디서 |
|---|---|---|
| M1 | 맥북 고아 터미널의 `terminal show` 원값 — 특히 `connected` | AC13 ① |
| M2 | 실제 고아 터미널에서 `alive` exit 0 + 꼬리표 | AC13 ② |
| M3 | 실제 고아 터미널에서 `key` 전송이 TUI에 반영되는가 | AC13 ③ |

## 7. 미해결 질문

초안 시점에 막힌 질문은 없다. 아래는 **초안이 스스로 정한 것**(질문으로 받은 답이 아니다) — harden-spec에서 압박한다.

1. 꼬리표를 `ALIVE` 줄뿐 아니라 `EXITED` · `UNREADABLE` 줄에도 붙인다(D2 — Q1 선택지 문면은 exit 0 줄만 말했다).
2. 자가 점검 필드 목록에서 `orphaned`를 빼지 않는다(D10).
3. README 3종을 고치지 않는다(D9).
4. 미연결 줄의 문구에서 `orphaned=` 값 표기를 꼬리표로 대체한다(§3a).

## 범위 밖 관찰 (고치지 않는다)

- **O1** 메모리 `orchestrator-delegate-answers`의 「고아 = `terminal show`의 `paneRuntimeId: -1`」은 정확하지 않다(F5). 메모리 정정은 메인 몫이다.
- **O2** spark2의 `terminal create` 응답이 `surface: "background"` + 「`orca terminal focus`로 드러내라」 경고를 낸다(F6). orchestrate ① 5 생성 절차는 이 경고를 다루지 않는다 — 메인이 경고를 따라 `focus`를 실행하면 사용자 화면이 옮겨질 수 있다(§3c의 함정 1줄이 `focus`를 함께 적는 이유).
- **O3** `terminal show`에는 종료 원인(`exitCause`)과 입력 대기(`agentWait`) 필드가 있다 — `alive`는 쓰지 않는다. 화면 문자열 판독을 대체할 후보지만 이 트랙의 범위가 아니다.
- **O4** 1.2.0 F2의 필드 조회는 1.4.229 기준이고 지금은 1.4.252다 — 세 필드는 그대로 있다(F3).

## 잔여 리스크 (DEFERRED) · 수용된 한계

- **전제 미확인** — 맥북 고아 터미널이 `connected: true`인지는 AC13 ①에서야 확인된다(M1). 틀리면 수정이 효과가 없을 뿐 현행보다 나빠지지 않는다.
- **고아 터미널의 화면 읽기** — 화면에 붙지 않은 터미널의 「렌더링 화면」이 실제 TUI 상태와 같은지는 맥북 관측(화면 읽기 · `watch` 정상)에 선다. 다르게 나오는 경우의 방어는 현행 규칙이다(출처가 `screen`이 아니면 exit 2 · 입력 상태가 안 보이면 exit 2 — 어느 쪽도 종료로 보지 않고 키도 보내지 않는다).
- **`orphaned`의 뜻은 오르카 버전에 따라 바뀔 수 있다**(공식 정의 없음 — F1). 1.6.1부터는 판정에 쓰지 않으므로 영향은 꼬리표 표시뿐이다.

## 재논의 금지(기결정)

2026-11-16 초안 확정분. 근거 = 설계 질문 Q1~Q5의 답(출처 = 메인 대리 답(추천안 — 사용자 상시 지시)) · 트랙 프롬프트의 기결정 · 초안 판단(표기). 1.2.0 D1~D44 · 1.2.1 D9 · 1.5.0 D1~D28 · 1.6.0 D블록은 전제로 승계한다.

| D | 결정(1줄) | 근거 · 출처 |
|---|---|---|
| D1 | `connected: true · orphaned: true`는 종료가 아니다 — `alive`는 고아를 판정에서 빼고 화면 판독으로 0 · 1 · 2를 가린다. exit 코드 0 · 1 · 2 · 3의 뜻과 조건 상호 배타 불변. 새 exit 코드 · 새 판정 이름 없음 | Q1 「고아는 빼고 화면으로 판정」 — 고아는 「화면에 붙어 있나」이지 「살아 있나」가 아니다(F4) · 화면 판독이 이미 생존을 가린다 · 메인 대리 답 |
| D2 | 고아면 `terminal show` 뒤 판정 줄(`ALIVE` · `EXITED` · `UNREADABLE`) 끝에 ` · 화면 분리(orphaned)` — `STALE` · `ERR` 줄 제외 · 고아가 아니면 줄 불변 | Q1 선택지 문면(「출력 줄 끝에 화면 분리 표시」) + 줄 범위는 **초안 판단**(§7-1) |
| D3 | `key`는 고아 터미널에도 평소대로 보낸다 — `key()` 코드 무변경 · 고아 전용 분기 · 묶음 제한 없음 | Q2 「평소대로 보낸다」 — 11-15 고아 상태 직접 전송 확인 · 기존 안전장치 유지 · 메인 대리 답 |
| D4 | SKILL.md ② · ③ · ④ · ⑤-5 무변경 + 「함정」 절 1줄 추가 · 분량 상한 17,408B 불변(넘치면 문구를 줄인다) | Q3 「분기 문구 그대로 + 함정 1줄」 · 1.2.1 D9 · 메인 대리 답 |
| D5 | 실제 고아 터미널 실측 = 릴리스 뒤 맥북 설치본 · 사용자 · **트랙 완료 조건**(AC13). 전제 반증(`connected: false`)이면 미완료 → 재설계 | Q4 「릴리스 뒤 맥북 설치본 실측」 · 선례 1.5.0 AC13 · 1.6.0 AC14 · 메인 대리 답 |
| D6 | 경로 = 경량 — 4 spec 적대검증 유지 · **5 plan 생략**(6 자동 해당없음) · impl ledger = 이 문서 말미 | Q5 — 접촉 표면 무신호 · 변경 대상 4파일이라 plan이 주는 것이 없다 · 안전 판정이라 spec 적대검증은 남긴다(1.2.0 high 3건 전례) · 메인 대리 답 |
| D7 | 버전 = 1.6.1 | 트랙 프롬프트(메인 지정) — exit 코드 · 인자 계약 추가 없음(D1)이라 패치 유지 |
| D8 | 고아 터미널을 화면에 다시 붙이지 않는다 — 스크립트 · 스킬 절차는 `terminal switch`(= `focus`)를 쓰지 않는다 | 트랙 프롬프트 기결정 「사용자의 오르카 화면을 뺏지 않는다」 · F1 · F2 |
| D9 | README 3종 · 템플릿 · references · marketplace.json 무변경 | **초안 판단**(§7-3) — exit 코드 뜻 불변 · 고아 언급 0건(§6b) · 선례 1.4.1 |
| D10 | 자가 점검 필드 목록(`connected` · `writable` · `orphaned`) 불변 | **초안 판단**(§7-2) — `orphaned`는 꼬리표에 계속 쓰인다 · 1.2.0 D6 · F2 |
| D11 | 범위 = 핸드오프 후속 후보 ⓓ 하나 — 고치다 보이는 다른 결함은 「범위 밖 관찰」에 적는다 | 트랙 프롬프트 기결정 |
