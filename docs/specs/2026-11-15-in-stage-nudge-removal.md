# 단계 안 넛지·후계 절차 삭제 — 한 단계 안은 자동 압축에 맡긴다 (1.6.0)

- 단계: 1–2 spec 초안 `c2f08d1` (2026-11-15 · 수동 트랙 · 브랜치 `gguii74-rwk/in-stage-nudge-removal-1-6-0`, base main `6538b75` = 1.5.0 릴리스 · 설계 질문 9건 Q1~Q9 전부 첫 선택지 → D1~D10 — Q5는 사용자 본인 답) → **3 harden-spec 완료 (2026-11-15 · 초안과 같은 세션 — 갭 대장 41건: 사실 20건 조회 해소 · 판단 14건 질문 해소(전부 첫 선택지 = 추천안 → D11~D23 · 1건은 사용자 유예) · 검증 필요(실측) 7건 · DEFERRED 1)** → **4 review-loop(spec) 종결** (2026-11-15 · 위임 모드 · 적대 5 + 복귀 적대 1 · 확인 1 + 재진입 확인 1 · blocking 8건(high 1 · medium 7) 전부 FIXED(루프 판정) · 최종 확인 C2 verdict pass · 확인 대기 대장 해당 없음) → **7 구현 완료 (2026-11-16 · 위임 트랙 · 경량 planless TDD · 착수 근거 = 사용자 판정 2026-11-16 「착수 허용, 보고 줄은 후속」(AC-G) — `6196163` · `2edbe7f` · `f21e826` · `57fc8a2` · `55946e4` · `96ff1c3` · AC1~AC13 · AC-G · 게이트 G1~G4 통과 — 「구현 기록」)** → 다음 = 8 impl 적대검증 — 새 세션
- 경로: **경량 (사용자 확인 2026-11-15, Q1)** — 4 spec 적대검증은 **유지**(시험 게이트가 그 단계에 걸려 있다 — §3j) · 5 plan 생략(D2 — 6은 자동 해당없음). 하한 3종(spec 문서 · harden-spec · impl 적대검증)은 수행한다.
- 출처: 사용자 판정 2026-11-15(방향 · 순서 · 압축 지점 600K 출발 · 시험을 4단계에서 겸함 · 메인도 압축에 맡김 — 「재논의 금지」 머리말) · 메모리 `context-cap-review-2026-11-15`(실측 · 공식 근거 요약) · 선행 spec `2026-11-15-compact-resilience.md`(1.5.0 — 비목표로 이 트랙에 넘긴 항목) · Claude Code 공식 문서(§6a — 2026-11-15 직접 확인) · eval `report/LESSONS-2026-08-12.md` L1·L3·L5.
- 선행: **불변** — 1.5.0 spec의 재논의 금지 D1~D28 전부(압축 뒤 재읽기 훅 · 안내문 정본 · 라운드 기록 · §0b) · 08-10 D4·D5·D6·D9·D18·D22(루프 파일 이름 · 수명 · 단일 작성자) · 1.1.0 D1·D2·D3·D10(`--security` · 모드 변수) · 1.2.0의 위임 모드 효과 2(추천 자동 채택 · 확인 대기 대장) · 1.2.1 D9(orchestrate 분량 상한 17,408바이트) · 표지 2종(`[TRACK-DONE …]` · `[TRACK-HANDOFF …]`). **D블록 변경** — 넛지·후계를 들여온 결정들을 이 트랙이 폐기하거나 근거를 바꾼다(§3k 표 — 근거 = 사용자 판정 2026-11-15).
- 답 출처: 이 트랙의 AskUserQuestion은 사용자 지시(2026-10-18 · 10-22)에 따라 메인 세션이 추천안을 대신 입력할 수 있다. Q5(메인 오케스트레이터)는 사용자 본인 답이다.

## 1. 문제 (실측 · 공식 근거)

사용자 판정(2026-11-15)의 방향은 「진행 상황은 바로바로 파일에 기록 · 단계와 단계 사이는 새 세션 · 한 단계 안은 자동 압축으로 관리」다. 1.5.0이 「압축을 넘겨도 진행 상태와 절차가 남는다」를 넣었고(압축 뒤 재읽기 훅 · review-loop 라운드 기록 · §0b), 이 트랙은 그 위에서 **단계 안에서 세션을 갈아타게 만드는 장치**를 걷어 낸다.

1. **넛지는 단계 안에서 세션을 끊는다.** Stop 훅(`context-threshold-hook.mjs`)이 컨텍스트 40%(1M 기준 40만 토큰)부터 15%p마다 「핸드오프를 쓰고 새 세션으로 넘겨라」를 지시한다. 오르카 터미널에서는 후계 터미널을 스스로 띄워 인계한다(1.0.0). 실측(맥북 이 저장소 5턴 이상 48세션): 넛지 6건 — 전부 400K~443K. 사용 빈도가 높은 다른 저장소에서는 훨씬 잦았다(16일 104회).
2. **메인 오케스트레이터 세션도 교대한다.** 2026-11-15 하루에 두 번(42% · 43% — 두 번째는 이어받은 지 15분 만).
3. **넛지를 위해 유지하는 표면이 넓다.** 훅 스크립트 30,318바이트(임계 판정 · 넛지 문구 · 후계 스폰 절차 · 후계의 「0번째 동작」 · 폴백 4종) · review-loop §2i 경로 ①과 진행 중 라운드 분기 · orchestrate ⑤-1 자동 재개 · ⑤-3 메인 자동 인계 · 트랙 프롬프트 9절 · doctor 4번 점검(`CLAUDE_CTX_LIMIT`) · setup의 윈도 크기 질문 · README 3종의 훅 절과 주의사항.
4. **훅은 턴이 끝날 때마다 세션 기록 전체를 읽는다**(`readFileSync(transcriptPath)` → 줄마다 JSON 파싱). 넛지가 뜨지 않는 턴에도 드는 비용이다.

**실측에 없는 것(L5 — 그대로 적는다)**: 400K~967K 구간에서 작업 품질이 어떤지는 재지 않았다. 넛지를 지운 뒤 한 단계를 끝까지 간 사례도 아직 없다. 그래서 **구현 전에 시험이 선다**(§3j — 사용자 판정: 이 spec의 4단계 적대검증 루프를 넛지 끈 채 · 작은 압축 창으로 띄워 관측한다).

## 2. 목표 / 범위 / 비목표

**목표** — (a) 플러그인에서 컨텍스트 임계 넛지와 그에 딸린 후계(자동 인계) 절차가 사라진다 (b) 단계 안의 대화 길이는 Claude Code의 자동 압축이 관리하고, 압축 지점 60만 토큰을 설정으로 반영할 길이 생긴다 (c) 넛지와 무관한 일시중단(사용자 중단 · 폴백②) · 종료 복구 · 재획득 · 단계 경계의 새 세션은 그대로 남는다.

**범위**

| 파일 | 변경 | 단계 |
|---|---|---|
| `dev-workflow/hooks/hooks.json` | `Stop` 그룹 삭제. `SessionStart`(compact) 불변 | 7 |
| `dev-workflow/hooks/scripts/context-threshold-hook.mjs` | **파일 삭제** | 7 |
| `dev-workflow/skills/review-loop/SKILL.md` | §2i 경로 ① · 진행 중 라운드 분기(쓰는 쪽) · 순서 3의 넛지 갈래 삭제 · §2b ③과 (1)의 넛지 구절 삭제 · 「세 경로」 → 「두 경로」(§3c). §0 · §0b · 라운드 기록 · §4의 나머지 불변 | 7 |
| `dev-workflow/skills/orchestrate/SKILL.md` | ⑤-1 자동 재개 삭제 · ⑤-1 (a)가 참조 문서를 가리킴 · ⑤-2 식별 단서 · ⑤-3 = 새 메인 세션의 복원 순서 · ① 1 버전 기준 · 시작 자가 점검 사유 문구(§3d) | 7 |
| `dev-workflow/skills/orchestrate/references/codex-job-check.md` | **신규** — 닫기 전 codex 잡 확인의 명령 원문과 판독 규칙(훅 스크립트에서 글자 그대로 이전 — D12) | 7 |
| `dev-workflow/skills/orchestrate/templates/track-prompt.md` | 8절 사유 2종 · 9절 삭제(§3d) | 7 |
| `dev-workflow/skills/setup/SKILL.md` | 3번 절차 = 윈도 크기(`CLAUDE_CTX_LIMIT`) → 압축 지점(`autoCompactWindow`) 제안(§3e) | 7 |
| `dev-workflow/skills/doctor/SKILL.md` | 4번 점검 = 압축 지점 설정 조회 · 증상 문장에서 넛지 삭제(§3f) | 7 |
| `dev-workflow/skills/dev-cycle/SKILL.md` | 넛지·후계 언급 3곳(§3g) | 7 |
| `tests/hooks/compact-reread-hook.test.mjs` | 등록 테스트 1건의 이름과 기대값(`hooks` 키 = `SessionStart`뿐) | 7 |
| `tests/orchestrate/orchestrate.test.mjs` | 픽스처 문자열 4곳(「넛지」 → 「사용자 중단」) — 테스트 수 · 이름 · 단언 불변 | 7 |
| `README.md` · `README.ko.md` · `README.ja.md` | 구성 표 · 훅 절 · 압축 지점 설정 안내 · setup · doctor · orchestrate 절 · 트러블슈팅 · 주의 · 구조도 · 1.6.0 안내(§3h) | 7 |
| `dev-workflow/.claude-plugin/plugin.json` | 1.5.0 → 1.6.0 · description에서 넛지 구절 삭제 | 9 |
| `.claude-plugin/marketplace.json` | description 2곳에서 넛지 구절 삭제 | 9 |

**무변경(확인 대상)**: `compact-reread-hook.mjs`(안내문 정본 — 1.5.0 D4·D10·D16·D17) · `orchestrate/scripts/orchestrate.mjs`(`HANDOFF` 판정은 남는 일시중단 경로가 계속 쓴다) · harden-spec · mr-review · ui-mockup · writing-plans-split 스킬 문서(넛지 언급 0건 — §6b H3) · `docs/plans/` · 다른 spec.

**비목표**

- **단계 경계의 새 세션 규약 변경** — 그대로다(§3g). 한 세션 연속 진행은 만들지 않는다(1.4.1 D3 승계).
- **넛지를 대신할 새 규칙**(메인 세션의 수동 교대 권고 · 컨텍스트 양 경고 · 압축 횟수 상한 · 넛지를 되살리는 기준 등) — 근거가 없다(L1 · D23). 관측 항목으로만 둔다(§5).
- **harden-spec · mr-review 등 압축 대비가 없는 스킬의 보완**(D9) — 한계로 적고 관측한다.
- **1.5.0 spec 수정 · 시험 수행**(시험 수행과 기록은 메인 세션과 기록 트랙 몫 — 이 spec은 게이트만 적는다).
- **`orchestrate` 기동 명령에 압축 창 접두 추가**(D4) · 플러그인 수준 기본값(공식 문서에 경로 없음 — §6a F5) · setup의 「압축 지점만」 갈래(D18) · setup이 모델별 저장값을 고치는 것(D17).
- **`orchestrate.mjs`에 codex 잡 확인 서브커맨드 추가**(D12 — 명령 원문을 참조 문서로 옮길 뿐 새 코드를 만들지 않는다).
- **유휴 압축(`idleCompaction`) 설정 변경 · 자동 압축을 켜고 끄는 것** — 건드리지 않는다(꺼져 있으면 doctor가 알리기만 한다 — D19).
- 넛지 훅의 테스트(저장소 밖 — 08-09 D10 · 09-24 D5)는 대상이 사라지므로 따로 다루지 않는다.

## 3. 설계

### 3a. 삭제 · 유지 경계 (D3 · D6 · D7 · D10 · D12 · D14)

| 항목 | 현행 위치 | 처리 |
|---|---|---|
| 컨텍스트 임계 판정 · 넛지 문구 · 15%p 재넛지 · 주기 재초기화 | 훅 스크립트 | **삭제** |
| 넛지 뒤 후계 스폰 절차((2-0)~(2-5) · 폴백 4종) · 후계 프롬프트 · 「0번째 동작」 | 훅 스크립트 | **삭제** |
| 위임 모드의 「후계 대신 /clear 안내」 갈래 | 훅 스크립트(`resolveOrcaHandle`) | **삭제** — 위임 모드의 다른 효과(추천 자동 채택 · 대장)는 유지 |
| 닫기 전 codex 잡 확인의 **명령 원문**(companion 루트 해소 · 상태 프로브) | 훅 스크립트 | **이전**(D12) — orchestrate 참조 문서로 글자 그대로 |
| review-loop §2i 경로 ①(넛지) · 진행 중 라운드 분기의 **쓰는 쪽** 절차 · 순서 3의 「넛지 (2)를 따른다」 갈래 | review-loop SKILL.md | **삭제** |
| 넛지 훅과 글자까지 같아야 했던 문장 2개(§2b (1) 인용문 · 작업 단위 정의) | review-loop SKILL.md | **삭제**(짝이 사라진다) — 「완료 전 /clear 금지」는 자기 문장으로 남긴다 |
| 수신 라운드를 미판정으로 담은 일시중단 기록의 **이어받는 쪽** 규칙(재개 계약) | review-loop §2i · §0b 판정표 | **유지**(D10 — 구버전이 남긴 기록용 1구절) |
| 일시중단 — 사용자 중단(§2d) · 폴백②(새 세션 확인 1회) | review-loop §2i | **유지**(두 경로) |
| 라운드 기록 · §0b 압축 뒤 이어가기 · §0 재개 · §4 종결 | review-loop | **유지**(1.5.0 D블록) |
| HANDOFF 표지 · `사유:` 줄(사용자 중단 · 폴백②) · `watch`의 HANDOFF 판정 | 템플릿 8절 · orchestrate.mjs | **유지** — 사유에서 「넛지」만 뺀다 |
| HANDOFF 「사유가 넛지일 때만 자동 재개」 | orchestrate ⑤-1 | **삭제**(D7) — 모든 HANDOFF는 보고하고 재개 지시를 기다린다 |
| 후계 트랙을 띄우는 절차((a) codex 잡 확인 → (b) 옛 세션 종료 → (c) 새 터미널) | orchestrate ⑤-1 | **유지** — 사용자가 재개를 지시했을 때 · 터미널 처분(④) · 모델 불일치 닫기(① 5)가 쓴다 |
| 재획득(핸들이 사라진 트랙 찾기) | orchestrate ⑤-2 | **유지** — 식별 단서에서 훅 후계 프롬프트의 문구만 뺀다(D14) |
| 메인 자신의 후계(자동 인계) | orchestrate ⑤-3 | **바꿈**(D6) — 「새 메인 세션이 이어받을 때의 복원 순서」로. 자동 인계 전제 삭제 |
| 예기치 않은 종료 복구(`claude --resume`) · 페어링 · 다중 트랙 | orchestrate ⑤-4~6 | **유지** |
| 시작 자가 점검의 위임 모드 경고 | orchestrate | **유지** — 사유 문구만 교체(D13) |
| 트랙 프롬프트 9절 「넛지 시 행동」 | 템플릿 | **삭제** |
| 트랙 프롬프트 「후계 (고정)」(후계·재획득 세션은 원래 프롬프트부터 읽는다) | 템플릿 | **유지** |
| `CLAUDE_CTX_LIMIT` 질문 · 점검 | setup 3번 · doctor 4번 | **바꿈**(D4 · D8) — 압축 지점 설정 제안 · 조회 |
| 단계 경계의 새 세션 | dev-cycle · 각 단계 스킬의 「정지」 · review-loop §4 · orchestrate ④ · 템플릿 7절 | **유지**(§3g) |

### 3b. 넛지 훅 삭제 (D3)

- `hooks.json`의 `hooks` 아래에서 `Stop` 키를 지운다. 남는 것은 `SessionStart`(matcher `compact`) 하나다.
- `context-threshold-hook.mjs`를 지운다. 대체 스크립트 · 끄고 켜는 스위치는 두지 않는다.
- 그 결과 환경 변수 `CLAUDE_CTX_THRESHOLD` · `CLAUDE_CTX_LIMIT`은 플러그인 어디에서도 읽지 않는다(§3i).
- **달라지는 것(L3 — 기본값은 싼 쪽)**:
  - 오르카 없이 단일 세션으로 쓰는 사용자: 40만 토큰의 「핸드오프 쓰고 /clear」 안내가 사라진다. 대화는 압축 지점(설정이 없으면 1M 모델 약 967K — §6a F3)에서 자동 요약되고, 압축 직후 재읽기 안내(1.5.0 훅)는 계속 들어온다. 단계 사이의 새 세션은 스킬의 「정지」 안내가 맡는다.
  - 200K 모델 세션: 지금도 `CLAUDE_CTX_LIMIT=200000`을 직접 넣지 않으면 넛지가 뜨지 않는다(훅이 창을 1M으로 가정 — 200K를 다 채워도 20%). 넣어 둔 사용자만 8만 토큰 넛지를 잃고, 압축은 모델 창(200K) 경계에서 일어난다(§6a F3).
  - 자동 압축을 꺼 둔 환경(§6a F11): 넛지가 사라지면 대화 길이를 알려 주는 장치가 남지 않는다 — doctor 4번이 「자동 압축 꺼짐」을 보여 주고 README에 1줄 적는다(D19).
  - 모든 세션: 턴이 끝날 때마다 node 프로세스 1개를 띄워 세션 기록을 읽던 비용이 사라진다.
- **되돌리는 방법**(D23): 이 트랙의 삭제 커밋을 되돌려 패치 릴리스한다(스크립트 · 등록 · 문서는 git 이력에 있다). **언제 되살릴지의 기준은 미리 두지 않는다** — 관측(§5 O1~O3)이 쌓인 뒤 사용자가 판정한다.

### 3c. review-loop — 넛지 경로 삭제 (D10)

바꾸는 곳은 아래 7곳뿐이다. **§0 · §0b(판정표 11행 포함) · §2b 라운드 기록 · §4의 다른 문장은 건드리지 않는다**(1.5.0 D블록).

| 곳 | 현행 | 바꾼 뒤 |
|---|---|---|
| §2i 첫 문단 | 「세 경로가 이 절차를 쓴다 … 컨텍스트 임계와는 무관하게 세 경로 모두」 + ① 컨텍스트 임계(Stop 훅 넛지) · ② 사용자 중단 · ③ 폴백② | 「두 경로」 — ① ESCALATE에서 사용자가 중단 선택(§2d) · ② 폴백②. 임계 · 넛지 · `CLAUDE_CTX_THRESHOLD` 언급 삭제 |
| §2i 「진행 중 라운드 분기」 문단 | 넛지가 라운드 도는 중에 왔을 때의 쓰는 쪽 절차(작업 단위 정의 · 응답 대기 · 순서 0 · 미판정 기록) + 재개 계약 | 쓰는 쪽 절차와 작업 단위 정의 **삭제**. 남기는 것 = **재개 계약 1구절**: 「수신 라운드를 미판정으로 담은 일시중단 기록(1.6.0 미만 설치본이 남긴 것 — 1.6.0부터는 쓰지 않는다)을 재개하면 — 판정 정책 = 수신 시점 모드 · 카운터를 다시 올리지 않는다 · 결과 의존 전이는 판정 뒤 확정」 + 「완료된 고아 라운드는 재실행(응답 미수신 = 예산 미소모)」(라운드 기록 재개가 이 문장을 쓴다) |
| §2i 순서 3 | 경로별 재개 안내 — ① 넛지 (2)의 인계 절차(후계 스폰 또는 /clear 안내) · ②③ 「/clear 후 `/review-loop --resume`」 | 한 갈래 — 「/clear 후 `/review-loop --resume`로 이어가세요」(자가 /clear 불가 · 사람 게이트 문장 유지) |
| §2i `## 다음 액션` 정의 | 「진행 중 라운드 분기로 중단했으면 수신 라운드 번호 · 종류 · 판정 정책 · 미처리 단계를 함께 적는다」 | 삭제(쓰는 쪽이 없다 — 읽는 쪽 §0b 표는 그대로) |
| §2b ③ | 「대기 = 백그라운드 기본 … (라운드 경계마다 Stop 훅 넛지 체크포인트가 서서 §2i 진행 중 라운드 분기가 성립한다. 포그라운드 대기는 넛지를 없애 기본이 아니다)」 | 백그라운드 기본은 **유지**, 괄호의 넛지 근거만 삭제(남는 근거 = 분리 실행 · 마커 완료 판정 — 0.18.0 F1) |
| §2b 진행 중 금지 (1) | 「Stop 훅 ②와 동일 문구(규범 원본은 여기): "진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 넛지 (2)의 인계 절차를 따르라." — 앞 문장은 항상, 뒷 문장은 넛지를 받은 세션에만 …」 | 「진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지」(이유 = codex `SessionEnd` 훅이 running 잡을 kill)만 남긴다. 완료 알림이 오면 ④ → §2c로 정상 진행 |
| §4 | 「재개하는 경로(§2i의 세 경로)」 | 「두 경로」 |

- **크기**: 순감이어야 한다 — 변경 뒤 ≤ base의 크기(89,389바이트 · 1.5.0 상한 90,005).
- 「신규 규칙 입증 책임」과의 관계: 새 규칙이 없다(삭제 · 문구 축소뿐).

### 3d. orchestrate — 자동 재개 · 메인 자동 인계 삭제 (D6 · D7 · D12 · D13 · D14)

| 곳 | 바꾼 뒤 |
|---|---|
| ⑤-1 HANDOFF | 표지 바로 위 `사유:` 줄(사용자 중단 · 폴백②)을 읽어 **보고하고 명시적 재개 지시를 기다린다** — 자동으로 잇지 않는다. 사유가 `넛지`면 1.6.0 미만 설치본으로 뜬 트랙이다 — 같은 처리(보고 · 대기)에 ① 1의 갱신 제안을 붙인다. 재개 지시를 받으면 지금의 순서 그대로다: **옛 세션 종료가 먼저** — (a) 이 폴더의 codex 잡 0 확인 → (b) `/exit` · 종료 확인 · close → (c) 같은 기동 명령 · 새 `--session-id`로 새 터미널 + 「원래 트랙 프롬프트를 먼저 읽고 … 재개 파일을 읽고 이어가라」 |
| ⑤-1 (a) | 「훅 후계 프롬프트의 0번째 동작과 같은 상태 파일 직접 읽기」 → **「명령 원문 = `<Base directory>/references/codex-job-check.md`」**(D12). 「0이 아니거나 판독 불가면 보류 · 보고」는 그대로 |
| ⑤-2 재획득 | 식별 단서 = **메인이 보낸 프롬프트 파일 경로 하나**(D14 — 「후계 프롬프트의 옛 세션(핸들 …)」 문구 삭제). 사례 괄호 「수동 트랙의 자가 인계 등으로」 → 「오르카 재시작 등으로」. 「정확히 1개일 때만 채택 · 0개 · 2개 이상이면 보내지 않고 후보를 보고」는 그대로 |
| ⑤-3 | 제목 「메인 자신의 후계(메인은 수동 — 자동 인계)」 → **「새 메인 세션이 이어받을 때」**(사용자가 새로 열었거나 메인이 죽었다). 내용(트랙별 블록의 environment · 모드 · 권한 플래그 · 모델 · 트랙 프롬프트 경로를 먼저 복원 → 적힌 핸들로 재획득 → 없거나 stale이면 2의 식별 규칙)은 그대로. 끝에 1문장 — 「메인 세션의 대화 길이는 자동 압축에 맡긴다」(D6) |
| ① 1 설치 버전 확인 | 「1.2.0 미만이면 …」 → **「1.6.0 미만이면 갱신을 제안만 하고(사용자 확인 — 자동 실행 금지), 거절하면 그 설치본은 넛지 훅이 살아 있음(트랙이 40%에서 멈출 수 있고 멈추면 보고 · 대기)을 밝힌다 — 1.2.0 미만이면 구버전 운영(③ 표 3행)도」**. 두 기준의 뜻이 다르다: 1.6.0 = 넛지 유무 · 1.2.0 = 추천 자동 채택 유무(③ 표 3행은 그대로) |
| 시작 자가 점검 | 위임 모드 경고와 「계속할지 1회 질문」은 **유지**(D13), 사유 문구만 — 「(자기 후계를 띄우지 못한다)」 → 「(이 세션의 스킬 질문이 추천안으로 자동 채택된다)」 |
| 분량 | 변경 뒤 ≤ 17,408바이트(1.2.1 D9 — 현행 16,839 · 위 문구로 가조립한 실측 17,136 · 여유 약 270). 넘어야 하면 사유를 적고 사용자 확인(1.5.0 D23과 같은 처리) |

**참조 문서 `references/codex-job-check.md` (신규 — D12)**

- **명령 2줄** = base(`6538b75`)의 훅 스크립트가 넛지 문구에 넣던 「companion 루트 해소」와 「상태 프로브」 문자열을 **글자 그대로**(셸에 붙여 넣을 수 있는 한 줄씩 — 문구를 다듬지 않는다). 여러 차례의 검증 수정이 이 두 줄에 들어 있다: 자기 세션 잡만 보여 주는 status 서브커맨드와 실패를 빈 목록으로 숨기는 `loadState`를 쓰지 않는다 · 부재 판정은 `ENOENT`뿐 · 스키마 이탈과 `CLAUDE_PLUGIN_DATA` 부재는 판독 불가.
- **실행 위치** = 그 체크아웃 루트.
- **실행 계약 — 자기 세션 제외를 끈다**: 상태 프로브 줄은 실행 세션과 같은 `sessionId`의 잡을 세지 않는다(`CODEX_COMPANION_SESSION_ID` 비교 — 원래 후계 세션이 옛 세션을 닫기 전에 쓰던 줄이다). 이 확인은 **메인이 트랙을 닫기 전에** 하므로 메인 자신의 잡도 세야 한다 — `/exit`가 내리는 공유 브로커는 메인의 잡도 죽인다(H12). 그래서 상태 프로브 줄은 **앞에 `CODEX_COMPANION_SESSION_ID= `(빈 값) 접두를 붙여 실행한다** — 명령 원문은 글자 그대로 두고 접두만 실행 계약으로 적는다(D12). 이때 `FOREIGN_ACTIVE`는 이름과 달리 이 폴더의 queued/running 잡 **전체** 수다.
- **판독 규칙**: 출력의 `FOREIGN_ACTIVE=0`이면 통과 · 0이 아니면 보류 · 보고(같은 상태 파일의 해당 queued/running 잡 id · status · sessionId를 함께 적는다) · `STATE_UNREADABLE` · `RESOLVE_FAIL` = 보류 · 보고 · 상태 파일 부재 = 0건 · 출력 앞의 `GATE_ON` / `GATE_OFF`는 이 확인에서 쓰지 않는다. 기다렸다 다시 세는 반복은 두지 않는다(현행 ⑤-1 (a) 그대로 — 0이 아니면 보류 · 보고).
- 오르카 명령은 담지 않는다(1.2.0 D3 · D36은 오르카 명령의 거처 규정 — codex 상태 조회는 해당 없음).

**트랙 프롬프트 템플릿**

- 8절: 「일시중단(넛지·사용자 중단·폴백②)하면 … `사유: 넛지 | 사용자 중단 | 폴백②`」 → 「일시중단(사용자 중단·폴백②)하면 … `사유: 사용자 중단 | 폴백②`」.
- 9절 「넛지 시 행동」 **삭제**. 대신할 「압축 시 행동」 절은 넣지 않는다 — 압축 뒤 재읽기 안내 3번 줄이 「트랙 프롬프트 파일을 다시 읽어라」를 이미 넣는다(1.5.0 D16).
- 1~8절 번호 · 「대리 채택 (고정)」 · 「후계 (고정)」는 그대로.

**스크립트 · 테스트**: `orchestrate.mjs`는 고치지 않는다. `tests/orchestrate/orchestrate.test.mjs`의 픽스처 문자열(「넛지를 받아 핸드오프를 썼다」 · 「사유: 넛지」)만 남는 사유(「사용자 중단」)로 바꾼다 — 판정 로직은 사유 문자열을 읽지 않으므로 56건 그대로 통과해야 한다(테스트는 템플릿 · README를 읽지 않는다 — §6b H10).

### 3e. 압축 지점 60만 — setup이 사용자 설정에 제안한다 (D4 · D16 · D17 · D18)

**공식 계약(§6a)**: 설정 키 `autoCompactWindow`(토큰 수 · 사용자 · 프로젝트 · 로컬 · 관리 설정 어디든) · 환경 변수 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`(100,000~1,000,000 · 설정 · `/autocompact` · `--autocompact`보다 우선) · 어느 쪽이든 모델 창보다 크면 모델 창으로 깎인다 · 같은 파일의 `modelSettings.<모델 이름>.autoCompactWindow`(`/autocompact`가 현재 모델에 저장하는 값)가 있으면 그 모델에는 그 값이 우선한다.

**setup 3번 절차를 교체한다** — 「컨텍스트 윈도 설정(`CLAUDE_CTX_LIMIT`)」 → 「압축 지점 설정(`autoCompactWindow`)」:

1. **현재 값 조회** — 글로벌 `~/.claude/settings.json`(또는 `CLAUDE_CONFIG_DIR`) · 프로젝트 `.claude/settings.json` · `.claude/settings.local.json`에서 최상위 `autoCompactWindow`와 `modelSettings` 아래 모델별 `autoCompactWindow`를, 셸에서 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`를 본다. 파일은 **그 값들만 뽑아 읽는다**(줄 전체를 찍지 않는다 — doctor와 같은 이유: 같은 줄의 비밀값 노출 · 값이 숫자나 짧은 문자열이 아니면 값 대신 「형식 이상」). 이미 값이 있으면 어디에 얼마로 있는지 밝힌다.
2. **AskUserQuestion 1회로 두 질문**(왕복 1회 — 현행 구조 그대로):
   - **값** — 최상위 값이 이미 있으면: 첫 선택지 「현재 값 유지」 / `600000`으로 바꿈. 없으면(D16): 첫 선택지 `600000` — 설명에 「이 플러그인이 쓰는 출발값이다 — 기본(1M 모델 약 967K)보다 일찍 요약한다 · 조정 중인 값」을 밝힌다 / 건너뜀(모델 기본값). 200K 모델에서는 모델 창으로 깎여 영향이 없다는 것을 한 줄로 밝힌다.
   - **쓸 위치** — 글로벌(권장 — 머신 전체) / 프로젝트 로컬 / 프로젝트(커밋하면 협업자에게도 적용된다는 것을 명시). 현행 선택지 그대로.
3. 건너뜀 · 유지가 아니면 선택한 파일의 **최상위 `autoCompactWindow`만** 멱등 반영한다(다른 키는 그대로 · 파일이 없으면 만든다). **파일을 JSON으로 읽지 못하면 쓰지 않고 그 사실을 알린다**(다른 설정을 잃지 않는다 — 현행 「하지 말 것」).
4. **알림** — 새 세션부터 적용된다 · 환경 변수가 설정돼 있으면 그 값이 우선한다 · **모델별 저장값이 있으면(D17) 「모델 〈이름〉에는 〈파일〉에 저장값 〈N〉이 있다 — 바꾸려면 그 모델에서 `/autocompact`」를 알리기만 한다** — 「그 모델에는 그 값이 우선한다」는 setup이 쓴 파일과 **같은 파일**일 때만 붙인다(공식은 같은 파일 안의 우선만 말한다 — §6a F2). 다른 파일의 저장값이면 우선을 단정하지 않는다(설정 파일 사이의 순서는 스코프 순서다)(setup은 `modelSettings`를 고치지 않는다) · 옛 변수(`env.CLAUDE_CTX_LIMIT` · `env.CLAUDE_CTX_THRESHOLD`)가 남아 있으면 「더는 쓰이지 않는다 — 지워도 된다」를 알리기만 한다(지우지 않는다).

- Announce 문구 · 「하는 일」 2번째 문단 · 「하지 말 것」의 임계 비율 줄과 「윈도 크기를 추측해서 쓰기」 줄을 이에 맞춰 바꾼다(추측 금지 줄은 대상이 사라져 삭제).
- **setup의 구조는 그대로다**(D18) — CLAUDE.md 포인터 → 압축 지점 순서의 한 묶음. 「압축 지점만」 갈래 · 인자를 만들지 않는다. 압축 지점만 넣으려면 README의 수동 방법을 쓴다.
- **orchestrate는 접두를 붙이지 않는다.** 한 트랙만 다른 값이 필요하면(예: 시험) 프로젝트 규약이나 사용자 지시로 기동 명령에 `CLAUDE_CODE_AUTO_COMPACT_WINDOW=<값>` 접두를 붙인다 — 환경 변수가 설정보다 우선한다(공식).
- **README**에 수동 설정 방법 1단락을 적는다(§3h) — 설정 키 1줄(모든 모델) · 세션 안의 `/autocompact`(현재 모델에만 저장 — 같은 파일의 설정 키보다 그 모델에는 우선) · 값 범위 · 환경 변수 우선 · 200K 모델 무영향 · 60만은 출발값이라 조정 대상.
- 설정 파일의 `env` 블록으로 환경 변수를 넣는 방법은 **쓰지 않는다** — 이 변수가 `env` 블록에서 통하는지 문서로 확정되지 않았다(§6c M2). 설정 키가 있으므로 필요 없다.

### 3f. doctor — 4번 점검을 압축 지점 조회로 (D8 · D19)

- 4번 = **「압축 지점 설정 — 조회만」**. 프로브 대상:
  - 셸 환경 변수 — `CLAUDE_CODE_AUTO_COMPACT_WINDOW` · `DISABLE_AUTO_COMPACT` · `DISABLE_COMPACT` · 옛 변수 `CLAUDE_CTX_LIMIT` · `CLAUDE_CTX_THRESHOLD`.
  - 설정 3곳(글로벌 · 프로젝트 · 프로젝트 로컬) — 최상위 `autoCompactWindow` · `autoCompactEnabled` · `modelSettings` 아래 모델별 `autoCompactWindow` · `env` 블록의 위 다섯 변수.
  - 읽는 방식은 현행 프로브 그대로다 — **값 하나씩만 투영**하고(줄 전체 · 인접 필드를 찍지 않는다), 값이 숫자 · 불리언 · 짧은 문자열이 아니면 값 대신 「형식 이상」, 읽기 · 파싱 실패는 파일명 + 상태만 적는다.
- **상태 어휘**(위에서부터 먼저 해당하는 것): `자동 압축 꺼짐`(**실효값**으로 판정한다 — `DISABLE_AUTO_COMPACT` · `DISABLE_COMPACT`가 셸이나 실효 `env` 블록에서 **참 값**이거나(참 값 = `1` · `true` · `yes` · `on`, 대소문자 무관 — 공식 값 규칙 F11. 거짓 값 `0` · `false` · `no` · `off`와 문서에 없는 값은 꺼짐 원인이 아니다 — 값은 근거 칸에 그대로 적는다 · 환경 변수는 설정보다 우선 — F11), `autoCompactEnabled`의 실효값이 `false`. 실효값 = 그 키를 가진 설정 파일 중 스코프가 가장 높은 것의 값(프로젝트 로컬 > 프로젝트 > 사용자 — F2) — 사용자 설정의 `false`를 프로젝트 로컬의 `true`가 덮으면 꺼짐이 아니다 · D19) → `판정 불가`(조회 대상 설정 파일 중 읽기 · 파싱에 실패한 것이 있다 — 그 파일에 `autoCompactEnabled` · `env`의 `DISABLE_*` · 압축 창 값이 있을 수 있어, 하위 파일 값에 기댄 `꺼짐` · `설정됨` · `미설정`을 확정하지 않는다. 그 파일보다 우선하는 출처(셸 환경 변수 · 그보다 스코프가 높은 읽힌 설정 파일)만으로 `자동 압축 꺼짐`이 확정되면 그쪽이 먼저다 · 확인된 값은 근거 칸에 그대로 적는다) → `설정됨`(압축 창 값이 한 곳이라도 있다) → `미설정(모델 기본값)`. **상태는 doctor가 읽은 곳(환경 변수 · 설정 3곳) 기준이다** — F2의 스택에서 그보다 위인 관리 설정 · 명령줄 플래그는 읽지 않는다(조회 범위는 §3k대로 승계 — 넓히지 않는다). 그래서 근거 칸이 그 사실을 함께 적는다(아래) — 관리 설정에 `autoCompactEnabled: false`가 있는 환경은 `설정됨`으로 보일 수 있다.
- **근거 칸**: 찾은 값 전부를 출처와 함께(환경 변수 · 파일별 최상위 값 · 모델별 저장값) + 우선순위 1줄(「환경 변수 > 설정 파일(관리 > 명령줄 > 프로젝트 로컬 > 프로젝트 > 사용자) · 같은 파일 안에서는 모델별 저장값이 최상위 값보다 우선(그 모델에만) · **관리 설정 · 명령줄은 doctor가 읽지 않는다 — 있으면 그 값이 위 상태보다 우선한다**」 — 공식 F2 문언 그대로. 다른 파일에 있는 모델별 저장값과 최상위 값 사이의 우선은 단정하지 않는다) + 옛 변수 잔존 여부. **좋다 · 나쁘다를 판정하지 않는다**(D8) — 60만은 출발값이고 다른 값도 틀린 것이 아니다.
- **조치 안내**(현행 원칙 — doctor는 쓰지 않는다): `자동 압축 꺼짐`이면 「이 플러그인은 대화 길이를 알려 주지 않는다」에 **원인별 복구 1줄**을 붙인다 — `autoCompactEnabled: false`면 「`/config`의 Auto-compact를 켜거나 직접 `/compact`」 · `DISABLE_AUTO_COMPACT`가 참 값이면 「그 변수를 넣은 곳(셸 · 설정 `env` 블록 — 근거 칸의 출처)에서 지우고 새 세션 — 그 전까지는 직접 `/compact`」 · `DISABLE_COMPACT`가 참 값이면 「수동 `/compact`도 막혀 있다(F11 — 모든 압축 꺼짐) — 그 변수를 넣은 곳에서 지우고 새 세션」(`/compact`를 권하지 않는다). 원인이 여럿이면 해당하는 줄을 모두 — 단 `DISABLE_COMPACT`(참 값)가 원인에 있으면 다른 줄의 「직접 `/compact`」 대안은 빼고 적는다(수동 압축도 막혀 있다 — 어느 줄에서도 `/compact`를 권하지 않는다) · `미설정`이면 「1M 모델은 약 967K에서 압축된다 — 바꾸려면 `/dev-workflow:setup`」(참고) · 옛 변수가 남아 있으면 「더는 쓰이지 않음 — 지워도 된다」.
- 지우는 것: 「모델↔limit 불일치 양방향 판정」 규칙 (e)와 그 표 · 「현재 모델은 네가 안다」 대조 · 판정 규칙 (d)의 `CLAUDE_CTX_LIMIT` 문장 · 훅 파일 경로 언급. 4항목 표의 4행 = `압축 지점 설정 | 설정됨 / 미설정(모델 기본값) / 자동 압축 꺼짐 / 판정 불가 | 값 · 출처 · 옛 변수 잔존 여부`.
- 증상 문장: description과 「뜬다」 절에서 「넛지가 안 떠」(영문 `the context-threshold nudge never fires`)를 뺀다. 환경 요소 열거 = 「codex 연동 · 플러그인 버전 · 압축 지점 설정」. **새 증상 문장은 더하지 않는다**(L1 — 명시 호출 · 「환경 점검해줘」로 닿는다).
- 크기: 변경 뒤 ≤ base의 크기(39,072바이트 — 순감).

### 3g. dev-cycle · 단계 경계의 새 세션 (D15)

**단계 경계는 넛지 없이도 아래 문면이 지킨다**(조회 §6b H5 — 빈틈 없음 → 단계 경계에는 새 규칙 없음, L1):

| 곳 | 문면 |
|---|---|
| dev-cycle 「핵심 원칙」 · 「단계 경계 = 새 세션 + /clear」 · 「하지 말 것」 | 한 세션에서 전 과정을 돌리지 않는다 · 현재 단계 하나만 수행하고 다음은 핸드오프로 |
| harden-spec · ui-mockup 「정지」 | 다음 단계로 자동 전환하지 않는다 · 새 세션 권고 |
| review-loop §4 | 인계를 쓰고 「다음 단계는 /clear 후 시작하세요」 |
| orchestrate ④ · 템플릿 7절 | 단계 경계에서 정지 — 다음 단계는 사용자 지시로 새 트랙 · 「다음 단계 시작 금지」(정지 조건) |

넛지는 이 규약의 집행 장치가 아니었다 — dev-cycle이 「넛지가 이를 돕는다」고 한 문장 적었을 뿐이다.

**dev-cycle 변경 3곳**

1. 「단계 경계」 절: 문장 「Stop 훅의 컨텍스트 임계 넛지가 이를 돕는다.」를 **「한 단계 안의 대화 길이는 자동 압축이 관리한다 — 단계 도중에는 세션을 갈아타지 않는다.」로 교체**(D15 — 사용자 방향의 셋째 항목이 스킬 문서에 적히는 자리).
2. 「세션 모드 선택 지점」: 「오케스트레이터가 사용자 역할을 대행하고 후계도 띄운다」 → 「오케스트레이터가 사용자 역할을 대행한다」 · 「위임 모드의 효과(1.2.0): 후계 인계 + 위험군 외 추천 자동 채택 + 확인 대기 대장」 → 「위험군 외 추천 자동 채택 + 확인 대기 대장」.
3. 「하지 말 것」: 「경계에서 멈추고 `/clear` 넛지」 → 「경계에서 멈추고 `/clear` 안내」(여기의 「넛지」는 훅이 아니라 스킬의 안내였다 — 낱말만 바꾼다).

### 3h. README 3종 · 소개 문구

세 언어의 내용이 같아야 한다(README 자체 규칙 — 3개 파일을 함께 갱신).

- **구성 표**: 「컨텍스트 임계 넛지」 행 삭제. orchestrate 행의 「후계」는 유지(사용자 지시 재개).
- **9절(훅 절)**: 제목 「컨텍스트 임계 핸드오프 훅」 → 「압축 뒤 재읽기 훅」(목차 줄과 앵커 동기 — 이 앵커를 가리키는 곳은 README 3종의 목차뿐이다, §6b H9). 구성:
  - **첫 문단 = 1.6.0에서 바뀐 것**(README에는 버전별 안내 목록이 따로 없다 — 본문이 「〈버전〉부터」로 서술한다, §6b H8): 넛지와 오르카 자동 인계가 없어졌다 · 한 단계 안은 자동 압축에 맡긴다 · 압축 지점은 `/dev-workflow:setup` 또는 직접 설정 · `CLAUDE_CTX_THRESHOLD` · `CLAUDE_CTX_LIMIT`은 더는 쓰이지 않는다(지워도 된다) · 갱신 뒤 새 세션부터 적용 · 머신 · 스코프마다 버전이 다른 동안은 그 세션이 도는 설치본을 따른다 · **자동 압축을 꺼 둔 환경에서는 이 플러그인이 대화 길이를 알려 주지 않는다**(D19).
  - 삭제: 넛지 설명 문단 · 환경변수 예시 블록 · 1.0.0 오르카 자동 인계 문단.
  - 「압축 뒤 재읽기 훅」 문단: 「위의 컨텍스트 임계 넛지와 같이 돌고, 넛지의 상태 파일을 읽지도 쓰지도 않는다」 문장 삭제. 나머지 유지.
  - **「압축 지점 설정」 1단락**(§3e의 README 항목).
  - 「세션 모드」 문단: 후계 · 넛지 전제 구절을 삭제 · 교체한다 — 「후계도 오케스트레이터가 띄운다」 삭제 · 「메인 세션 자신은 수동이다(자기 후계는 위 자동 인계 그대로)」 → 「메인 세션 자신은 수동이다」 · 「후계 터미널을 띄울 때도 같은 접두를 붙인다(빠뜨리면 그 후계만 자동 인계로 돌아간다)」 → 「재개용 새 터미널을 띄울 때도 같은 접두를 붙인다」 · settings `env` 주의의 이유 「자기 후계를 못 띄우므로」 → 「메인의 질문까지 자동 채택되므로」 · 위임 효과 ①(넛지 /clear 안내) 삭제하고 ②(추천 자동 채택 · 대장)만 남긴다.
- **1절(dev-cycle 소개)**: 「다음은 넛지한다」 → 「다음은 안내한다」.
- **6절(setup)**: 윈도 크기 문단 → 압축 지점 제안 문단(§3e). **7절(doctor)**: 증상 문장 예시에서 넛지 삭제 · 점검 ④ = 압축 지점 설정 조회(자동 압축 꺼짐 표시 포함). **8절(orchestrate)**: ⑤ 줄 = 「`HANDOFF`는 보고하고 재개 지시를 기다린다 · 옛 세션 종료를 확인한 뒤에 새 터미널」 · 템플릿 절 목록에서 「넛지 시 행동」 삭제 · 참조 문서 1구절.
- **트러블슈팅**: doctor 줄의 「컨텍스트 윈도」 → 「압축 지점 설정」.
- **주의**: Stop 훅 관련 2항목(모든 프로젝트에서 동작 · 중첩 `claude`의 부모 탭 종료) 삭제.
- **구조도**: hooks 줄에서 `scripts/context-threshold-hook.mjs` 삭제 · orchestrate 줄에 `references/codex-job-check.md` 추가.
- `plugin.json` description: 「컨텍스트 임계 핸드오프 넛지(Stop 훅), 」 삭제. `marketplace.json`: 플러그인 description의 「컨텍스트 임계 Stop 훅 · 」 삭제 · 마켓 description의 「컨텍스트 핸드오프」 → 「압축 뒤 재읽기」.

### 3i. 이행 · 호환

| 상황 | 동작 |
|---|---|
| 구버전이 넛지로 남긴 루프 파일(수신 라운드 미판정 포함)을 1.6.0 세션이 재개 | §0 복원 + §2i 재개 계약(D10)으로 그대로 이어진다. 형식 변화 없음 |
| 1.6.0이 남긴 일시중단 기록(사용자 중단 · 폴백②)을 구버전 세션이 재개 | 형식이 같다 — 영향 없음. 라운드 기록 재개의 한계는 1.5.0 D26 그대로 |
| 구버전 트랙이 「사유: 넛지」 HANDOFF를 냄 | 1.6.0 메인 = 보고 · 재개 지시 대기 + 갱신 제안(D7). 기동 전 ① 1의 버전 확인이 먼저 걸러 준다 |
| 1.6.0 템플릿(9절 없음)으로 띄운 구버전 설치본 트랙이 넛지를 받음 | 그 세션의 훅 문구를 따른다(수동 = 자가 후계 · 위임 = /clear 안내). 표지가 없으면 메인 감시는 SETTLED → 화면 판독 → 보고. 자가 후계로 넘어간 수동 트랙은 재획득의 식별 단서가 맞지 않아 「후보 보고」로 떨어진다(D14). ① 1에서 미리 알린 상황이다 |
| 사용자 환경에 남은 `CLAUDE_CTX_THRESHOLD` · `CLAUDE_CTX_LIMIT` | 읽는 곳이 없다 — 해 없음. doctor 4번 · setup이 「지워도 된다」를 알린다 |
| 임시 폴더의 넛지 상태 파일(`claude-ctx-nudge-<세션>`) | 남아도 읽는 곳이 없다. 지우는 절차를 두지 않는다(OS 임시 폴더 정리 몫) |
| 갱신했지만 이미 떠 있던 세션 | 훅은 세션 시작 때 읽힌다 — 그 세션은 끝날 때까지 옛 훅 · 옛 스킬 문면으로 돈다(훅과 문면이 같은 버전이라 자체 정합). 새 세션부터 1.6.0 |
| 머신 · 스코프마다 버전이 다른 동안 | 넛지 유무는 **그 세션이 도는 설치본**이 정한다 — 갱신 순서를 강제하지 않는다. 옛 버전이 로드되는 프로젝트(스코프)에서는 넛지가 계속 뜬다(1.5.0 M6과 같은 기존 노출). orchestrate ① 1이 스코프별로 보고 알린다 |
| 이 트랙의 4 · 8단계 루프 | 릴리스 전이라 설치본(1.5.0) 문면으로 돈다 — 개발 사본으로 돌리지 않는다(08-10 D12 취지). 4단계는 넛지를 환경 변수로 끈 채 돈다(§3j) |
| 넛지를 되살려야 할 때 | 삭제 커밋을 되돌려 패치 릴리스(§3b — 기준은 미리 두지 않는다, D23) |

### 3j. 시험 게이트 — 구현 착수 조건 (사용자 판정 2026-11-15 · D11)

사용자 판정: 1.5.0의 AC13 실측과 「실제 트랙 시험(넛지만 끔)」을 **이 spec의 4단계(spec 적대검증 루프)에서 겸한다.** 메인 세션이 그 트랙을 넛지 끈 채(`CLAUDE_CTX_THRESHOLD=0.99`) · 작은 압축 창(`CLAUDE_CODE_AUTO_COMPACT_WINDOW` 15만~20만 토큰)으로 띄워 압축 두 순간을 관측한다.

- **게이트**: 7단계(구현)는 아래가 **모두** 충족된 뒤에만 착수한다.
  1. 1.5.0 spec(`2026-11-15-compact-resilience.md`) §4 **AC13의 관측 6항**이 **두 순간 모두** — (가) 응답 대기 중 수동 `/compact` · (나) 판정 · 수정 도중 자동 압축 — 에 대해 통과로 그 spec에 기록돼 있다.
  2. 그 4단계가 **넛지 없이 종결됐다**(`[TRACK-DONE …]`). 넛지와 무관한 일시중단(폴백② · 사용자 중단)을 거쳤어도 된다. 압축 뒤 이어가기가 멈추고 보고한 일(§0b 7)이 있었으면 미충족이다(1.5.0 AC13 ④와 같은 기준).
- **한 순간이라도 관측하지 못했으면 미충족이다**(D11) — 예: 루프가 일찍 끝나 대화가 압축 창에 닿지 않아 (나)가 일어나지 않았다. 실패가 아니라 미관측이어도 구현을 시작하지 않고, 메인이 사용자에게 올려 그때 판정한다(시험 전용 트랙을 띄운다 · 다른 실제 루프에서 본다 · 본 것만으로 착수한다 중에서).
- **실패면**(관측한 순간이 통과하지 못했다): 이 트랙은 구현 전에 멈춘다. 1.5.0 보완 수정(1.5.1)이 먼저다. 그 뒤 **게이트를 어느 루프에서 다시 확인할지 · 이 spec의 기준선(크기 · 무변경 대상)을 어떻게 다시 잴지는 그때 사용자가 정한다**(DEFERRED — 잔여 리스크).
- **역할**: 시험 수행 · 관측 = 메인 세션 · AC13 기록 = 기록 트랙(1.5.0 spec에 부기). 이 spec의 4단계 루프 세션은 평소대로 spec을 검증할 뿐이다. **7단계 구현 세션은 착수 때 1.5.0 spec의 AC13 기록을 읽어 게이트 충족을 확인하고, 이 spec 「구현 기록」 첫 줄에 적는다** — 기록이 없거나 두 순간 통과가 아니면(사용자 판정으로 착수가 허용된 경우는 그 판정을 적는다) 구현하지 않고 보고한다.
- **이 시험이 재지 않는 것**: 60만이라는 값 자체 · 40만~60만 구간의 작업 품질 · 메인 세션의 압축 · harden 세션의 압축 — 관측 항목이다(§5).

### 3k. 선행 spec의 D블록 변경 (근거 = 사용자 판정 2026-11-15 — 방향 · 트랙 2)

| 선행 spec | 결정 | 이 트랙에서 |
|---|---|---|
| `2026-08-09-ledger-handoff-mockup-nudge`(재넛지) | D3 · D4 · D5 · D6 · D24 · D26 · D30 | **폐기** — 훅 삭제 |
| `2026-08-10-loop-handoff-standardization` | D11(훅 넛지 문구의 단서 1줄) · D24(픽스처의 훅 원문) | **폐기** — 대상 소멸 |
| 〃 | D25 「유지 3경로」 · D26 종료 순서 | **3경로 → 2경로**(컨텍스트 임계 경로 삭제). 종료 순서는 남은 2경로에 그대로 |
| 0.18.0 spec(`docs/specs/` 2026-09-18 현장 결함 수정) | D1 백그라운드 대기 기본 | **결정 유지 · 근거 축소** — 「넛지 체크포인트」 근거 소멸, 남는 근거 = 분리 실행 · 마커 완료 판정(F1) |
| 〃 | D24(작업 단위 예시) · D27(F6 하네스 케이스) · D36의 F6 README 서술 | **폐기** |
| `2026-09-24-orca-successor-session`(1.0.0) | D1 · D2 · D3 · D4 · D6 · D7 · D9 · D10 · D12 | **폐기** — 훅의 후계 스폰 절차 삭제(D4 「후계는 단계 경계를 넘지 않는다」의 취지는 orchestrate ⑤-1 (c)의 「원래 트랙 프롬프트부터 읽는다」와 템플릿 7절이 계속 지킨다 · D3의 「/exit만 정리한다 · 브로커는 폴더당 공유」 사실은 참조 문서와 ⑤-1 (a)(b)가 계속 쓴다) |
| `2026-10-10-…-successor-optout`(1.1.0) | D4(위임 = 넛지가 /clear 안내) · D9의 「1.1.0 효과 = 훅 1개」 | **폐기** |
| 〃 | D8(설정 단위 = 트랙 터미널 — 근거 「메인은 자기 후계를 자동 인계로 띄운다」) | **결정 유지 · 근거 변경** — 메인은 자동 채택 없이 사용자에게 직접 묻는 세션이다 |
| `2026-10-17-orchestrate-…`(1.2.0) | 절차 ⑤ (a) 「사유가 넛지일 때만 자동 재개」 | **폐기**(D7) — D34(HANDOFF 표지)는 유지, 사유는 2종 |
| 〃 | 절차 ⑤ 재획득의 식별 문자열 「후계 프롬프트의 옛 세션(핸들)」 | **삭제**(D14) — 프롬프트 파일 경로 하나 |
| 〃 | D29(기동 전 설치 버전 확인) | **기준 추가** — 1.6.0(넛지 유무). 1.2.0(자동 채택 유무)의 뜻은 그대로 |
| 〃 | D32 「메인 컨텍스트 상한 규칙 없음 — 자동 인계가 안전망」 | **결정 유지 · 근거 변경** — 안전망 = 자동 압축 + 압축 뒤 재읽기(D6) |
| 〃 | D39(메인 모드 자가 점검) · D40(템플릿) | **유지 · 문구 변경** — 점검 사유(D13) · 템플릿 8절 사유 2종 · 9절 삭제 |
| `2026-10-18-orchestrate-followup-…`(1.2.1) | D12의 「후계 메인은 블록 값 신뢰」 | **용어만** — 「새 메인 세션」 |
| `2026-08-09-doctor-marker-description` | D7 · D10(`CLAUDE_CTX_LIMIT` 점검 · 프로브) · D18의 CTX_LIMIT 실측 2회 | **교체**(D8) — 압축 지점 조회. 프로브 방식(값 하나만 투영 · 환경 변수 + 설정 3곳)은 승계 |
| 〃 | D14 · D22(증상 어휘 — 넛지 · codex · 플러그인 버전) | **넛지 삭제** — 나머지 어휘 · 제외 2종은 그대로 |
| `2026-11-12-light-path-…`(1.4.1) | D3 근거의 「단계 하나가 이미 넛지 임계 직전」 | **결정 유지** — 연속 진행은 만들지 않는다. 근거 구절만 낡는다 |
| `2026-11-15-compact-resilience`(1.5.0) | D1~D28 | **불변.** §3d 「넛지와의 공존」 · AC1의 「Stop 불변」 · AC5 · AC9의 바이트 동일 문장 2개 · AC11의 「넛지와 같이 돈다」는 1.5.0 시점의 사실이다 — 그 spec이 비목표로 넘긴 대로 이 트랙이 대체한다(그 spec은 고치지 않는다) |

## 4. Acceptance Criteria

**훅**

- **AC1** `hooks.json`의 `hooks` 키 = `SessionStart` 하나뿐 · 그 값은 변경 전과 같다(JSON 값 동치). `Stop` 없음.
- **AC2** `dev-workflow/hooks/scripts/context-threshold-hook.mjs` 파일 없음 · `compact-reread-hook.mjs` 무변경(`git diff --stat <base>..HEAD`에 없음).

**스킬 문서**

- **AC3** review-loop SKILL.md — §3c 표 7곳 반영: 「두 경로」(「세 경로」 0건 · 「경로 ①」 0건) · 재개 계약 1구절(수신 시점 모드 · 카운터 재증가 금지 · 「1.6.0 미만 설치본이 남긴 것」) · 순서 3 한 갈래 · §2b ③ 백그라운드 기본 유지 · §2b (1) 「완료 전 /clear 금지」 유지. 「넛지」 · 「후계」 · `CLAUDE_CTX` 0건. **§0 · §0b · §2b 라운드 기록 · §4의 다른 문장은 무변경**(diff의 변경 덩어리가 §3c 표의 7곳 안). 크기 ≤ base(89,389바이트) · 맨 `$`+숫자 0건.
- **AC4** orchestrate SKILL.md — ⑤-1: 모든 HANDOFF는 보고 · 재개 지시 대기(「사유가 넛지일 때만」 0건) · 사유 `넛지` = 1.6.0 미만 설치본 트랙 1구절 · (a)(b)(c) 순서 유지 · (a)가 `references/codex-job-check.md`를 가리킨다(「0번째 동작」 0건) / ⑤-2: 식별 단서 = 프롬프트 파일 경로 하나(「옛 세션(핸들」 0건) / ⑤-3: 「새 메인 세션이 이어받을 때」 · 「자동 인계」 0건 · 「자동 압축에 맡긴다」 1문장 / ① 1: 1.6.0 기준 · 거절 시 문구 · 1.2.0 미만의 ③ 표 3행 안내 유지 / 시작 자가 점검: 경고 · 질문 유지 · 사유 문구 교체. 크기 ≤ 17,408바이트.
- **AC5** 참조 문서 `references/codex-job-check.md` — 명령 2줄이 **base(`6538b75`)의 훅 스크립트가 만드는 넛지 문구 안에 부분 문자열로 들어 있다**(기계 대조 — `git show <base>:dev-workflow/hooks/scripts/context-threshold-hook.mjs`를 임시 파일로 꺼내 `decideNudge`의 오르카 경로 출력과 비교) · 판독 규칙 5항(`FOREIGN_ACTIVE=0` 통과 · 0 아님 = 보류 · 보고 + 잡 3항목 · `STATE_UNREADABLE` · `RESOLVE_FAIL` = 보류 · 보고 · 부재 = 0건 · `GATE_` 표기 미사용) · 실행 위치 · 오르카 명령 없음. 두 명령을 bash · zsh에서 실제로 실행해 출력이 `GATE_(ON|OFF) FOREIGN_ACTIVE=<수>` · `STATE_UNREADABLE` · `RESOLVE_FAIL` 중 하나다. 실행 계약(빈 `CODEX_COMPANION_SESSION_ID` 접두)이 적혀 있고, **가짜 상태 파일**(임시 `CLAUDE_PLUGIN_DATA` 아래 — 실행 셸의 `CODEX_COMPANION_SESSION_ID`와 같은 `sessionId`의 running 잡 1건)로 접두를 붙인 실행이 `FOREIGN_ACTIVE=1`을 낸다(접두 없는 실행은 0 — 메인 소유 잡을 놓치는 경로의 재현).
- **AC6** 템플릿 — 8절 사유 2종 · 9절 없음 · 「넛지」 0건 · 1~8절 번호와 「대리 채택」 · 「후계」 절 유지.
- **AC7** dev-cycle SKILL.md — §3g의 3곳(1번은 문장 교체 — 「자동 압축이 관리한다」 · 「단계 도중에는 세션을 갈아타지 않는다」). 「넛지」 0건.
- **AC8** setup SKILL.md — §3e의 3번 절차 4단계: 조회 대상(최상위 값 · 모델별 저장값 · 환경 변수 — 값만 투영 · 형식 이상 처리) · 값 선택지 순서(있으면 「현재 값 유지」 첫 / 없으면 `600000` 첫 + 출발값 설명 / 건너뜀) · 위치 선택지 3종 · 최상위 `autoCompactWindow`만 멱등 반영 · JSON으로 읽지 못하면 쓰지 않음 · 알림 4종(새 세션 적용 · 환경 변수 우선 · 모델별 저장값 우선 — `modelSettings`는 고치지 않는다 · 옛 변수). Announce · 「하지 말 것」 정합. `CLAUDE_CTX_`는 「더는 쓰이지 않는다」 문맥에만. 맨 `$`+숫자 0건.
- **AC9** doctor SKILL.md — §3f: 4번 프로브 대상(환경 변수 5종 · 설정 3곳의 4종 — 값 하나씩 투영 · 형식 이상 · 실패는 파일명 + 상태) · 상태 어휘 4종과 우선순위 · 근거 칸(출처별 값 · 우선순위 1줄 — 관리 설정 · 명령줄 미조회 명시 · 옛 변수) · 좋고 나쁨 판정 없음 · 조치 안내 3종(꺼짐은 원인별 — `DISABLE_COMPACT`에 `/compact` 권고 0건) · 규칙 (e) 삭제 · 4항목 표 4행 · description과 「뜬다」 절에 넛지 증상 0건. 크기 ≤ base(39,072바이트) · 맨 `$`+숫자 0건. **조회 블록을 가짜 설정 파일로 직접 돌려 본다**(bash · zsh — 값 있음 · 없음 · 모델별 저장값 · `autoCompactEnabled: false` · **스코프 상충**(사용자 `false` + 프로젝트 로컬 `true` → 꺼짐 아님 · 사용자 모델별 저장값 + 프로젝트 최상위 값 → 우선 단정 없이 둘 다 출처와 함께) · `DISABLE_COMPACT=1`(복구 안내에 `/compact` 없음) · 원인 결합(`DISABLE_COMPACT=1` + `autoCompactEnabled: false` 또는 `DISABLE_AUTO_COMPACT=1` → 줄은 원인별로 모두 나오되 `/compact` 권고 0건) · 참 값 표기(`DISABLE_COMPACT=true` · `DISABLE_AUTO_COMPACT=yes` · `DISABLE_COMPACT=ON` → `1`과 같은 꺼짐 · 원인별 줄 · `/compact` 권고 규칙) · 거짓 값(`DISABLE_COMPACT=0` · `false` · `off` → 꺼짐 원인 아님) · 깨진 JSON(상위 스코프 파일이 깨지고 하위 파일에 압축 창 값 · `false` → `판정 불가` · 확인된 값은 근거 칸에 · 셸 `DISABLE_COMPACT=1`이 함께 있으면 `자동 압축 꺼짐`) · 같은 줄에 가짜 비밀값이 있는 한 줄 파일에서 비밀값이 출력되지 않음) — D20.

**스크립트 · 테스트**

- **AC10** `orchestrate.mjs` 무변경 · `tests/orchestrate/orchestrate.test.mjs` 56/56(픽스처 문자열만 변경 — 테스트 이름 · 수 · 단언 불변) · `tests/hooks/compact-reread-hook.test.mjs` 11/11(등록 테스트는 이름과 기대값이 바뀐다 — `hooks` 키가 `SessionStart`뿐) · `tests/mr-review/*.test.mjs` 371/371.

**문서 · 게이트**

- **AC11** README 3종 — §3h 항목 전부 · 세 언어의 내용이 같다. 9단계에서 `plugin.json` 1.6.0 + description · `marketplace.json` description 2곳.
- **AC12 (잔존 어휘 게이트)** `dev-workflow/` · `tests/` · `README*.md` · `.claude-plugin/`에서 대소문자 무시 검색 `넛지|nudge|ナッジ|CLAUDE_CTX_|context-threshold|컨텍스트 임계|コンテキスト閾値|자동 인계|automatic handover|自動引き継ぎ`의 결과가 **허용 목록뿐**이다 — (i) README 3종 9절 첫 문단(1.6.0에서 바뀐 것) (ii) setup · doctor의 「옛 변수 — 더는 쓰이지 않는다」 문맥 (iii) orchestrate ① 1 · ⑤-1의 1.6.0 미만 설치본 문구.
- **게이트** — G1 AC10의 세 테스트 묶음 통과 · G2 프로젝트 식별자 0건(skills · hooks · tests · README · 이 spec) · G3 AI 서명 · 트레일러 0건 · G4 편집 범위 = §2 표의 파일 + 이 spec의 「구현 기록」 · impl ledger · `## 확인 대기 대장`(§3j · AC-G · AC13 · D2가 요구하는 기록 — 그 밖의 본문은 고치지 않는다).

**시험 게이트 · 실측**

- **AC-G (7단계 착수 전 — §3j · D11)**: 구현 세션이 1.5.0 spec의 AC13 기록(**두 순간 × 6항 통과**)과 4단계의 넛지 없는 종결을 확인해 「구현 기록」 첫 줄에 적는다. 한 순간이라도 기록이 없으면 미충족 — 구현하지 않고 보고한다(사용자 판정으로 착수가 허용됐으면 그 판정을 적는다).
- **AC13 (7단계 — 훅 등록을 고친 직후, 스킬 문서 작업보다 먼저 · D21)**: 설치 없이 개발 사본을 불러 헤드리스 3호출(1.5.0 spec §5의 AC12 절차 그대로 — 저장소 밖 빈 임시 폴더 · `--plugin-dir` · 작은 모델 · 끝나면 그 세션 기록 삭제)로 **압축 뒤 안내문이 여전히 주입된다**를 확인한다(모델이 안내문 첫 문장을 글자 그대로 인용). 실패하면 구현을 멈추고 보고한다. 결과를 「구현 기록」에 적는다.
- **AC14 (9단계 뒤 — 릴리스 · 설치 갱신 뒤 설치본으로 · 트랙 완료 조건 · D22)**: **맥북** 설치본 1.6.0의 새 세션에서 — ① 설치본 `hooks.json`에 `Stop`이 없고 넛지 훅 스크립트 파일이 없다 ② `/dev-workflow:setup` 1회 → 사용자 설정에 `autoCompactWindow`가 반영되고, 새 세션에서 적용된 창이 그 값으로 보인다(확인 수단 = `/autocompact` 표시 — 인자 없이 무엇을 보여 주는지는 문서에 없어 실측 때 그대로 적는다, §6c M1) ③ `/dev-workflow:doctor` 1회 → 4번 행이 값 · 출처를 보여 준다. 수행 = 메인 세션 또는 사용자(②는 사용자 설정을 바꾸므로 사용자 확인 뒤).
- **AC15 (관측 — 완료 조건 아님 · D22)**: 1.6.0 설치본으로 띄운 다음 실제 트랙(기동 때 ① 1의 버전 확인 · 단계 끝까지 넛지 0 · 압축이 일어났으면 그 뒤 이어간 모습)과 다른 머신의 첫 사용은 핸드오프에 1줄씩 기록한다. 확인만을 위한 트랙은 띄우지 않는다(1.4.1 D9 전례).

## 5. 검증 · 릴리스

- **7 구현 순서** = ⓪ AC-G(게이트 확인) → ① 훅 등록 테스트의 기대값을 **먼저 RED로** 바꾸고(`hooks` 키 = `SessionStart`뿐) `hooks.json` · 스크립트 삭제로 GREEN(AC1 · AC2 · AC10) — **스크립트를 지우기 전에 참조 문서(AC5)를 먼저 만들고 대조한다**(명령 원문의 출처가 그 스크립트다) → ② **AC13**(훅 회귀 확인) → ③ review-loop(AC3) → ④ orchestrate · 템플릿 · 테스트 픽스처(AC4 · AC6 · AC10) → ⑤ setup · doctor · dev-cycle(AC7~AC9) → ⑥ README 3종(AC11) → ⑦ 잔존 어휘 게이트(AC12) · 전체 게이트.
- **스킬 문서 검증 수준(D20)**: 문자열 대조(이 저장소의 스킬 문서 변경 전례 — 1.4.1 D10 · 1.5.0) + setup · doctor의 조회 블록을 가짜 설정 파일로 bash · zsh에서 직접 실행(AC9) + 릴리스 뒤 맥북에서 각 1회 실제 실행(AC14 ②③). doctor의 증상 문장별 호출 실측(보조 에이전트 시나리오)은 돌리지 않는다 — 증상 문장을 빼는 변경이라 「뜨면 안 될 때 뜨는」 위험이 늘지 않는다.
- 8 impl 적대검증(하한) → 9 릴리스 = `plugin.json` 1.6.0 + description 3곳 → **push · main 머지는 사용자 확인** → 설치 갱신(4머신 `/plugin update` — 사용자) → AC14.
- **릴리스 안내(동작이 바뀌는 릴리스)**: ① 갱신 뒤 **새 세션부터** 넛지가 없다 — 떠 있던 세션은 끝날 때까지 옛 동작 ② 넛지 유무는 그 세션이 도는 설치본이 정한다 — 한 머신에서 메인과 트랙을 다 돌리면 그 머신(과 프로젝트 스코프 설치본)만 갱신하면 되고, 섞여 있는 동안은 §3i 표대로다 ③ 머신마다 `/dev-workflow:setup`(또는 직접 설정 · `/autocompact`)으로 압축 지점을 넣는다 — 넣지 않으면 1M 모델은 약 967K에서 압축된다 ④ `CLAUDE_CTX_THRESHOLD` · `CLAUDE_CTX_LIMIT`은 지워도 된다 ⑤ 자동 압축을 꺼 둔 환경은 이 플러그인이 대화 길이를 알려 주지 않는다.
- **관측 항목(완료 조건 아님 — 핸드오프 · 메모리에 기록 · 값 조정과 후속 트랙 · 되돌림 판정의 근거)**: O1 메인 세션이 압축된 뒤 감시 · 질문 처리를 이어 가는가(미실측 — D6) · O2 harden 세션이 압축되면 아직 묻지 않은 갭이 빠지는가(D9) · O3 60만 근처에서의 작업 모습과 압축 빈도(값 조정 근거) · O4 유휴 압축에서 재읽기 훅이 도는가(1.5.0 M1) · O5 Windows 머신의 첫 압축(1.5.0 M5) · O6 다음 실제 트랙과 다른 머신의 첫 사용(AC15).

## 6. 조회 · 실험 기록

### 6a. 공식 문서 (2026-11-15 — 직접 읽음)

출처: `code.claude.com/docs/en/` 아래 `settings` · `settings-reference` · `model-config` · `env-vars` · `context-window` · `hooks` · `best-practices` · `cli-reference` · `plugins` · `plugins-reference`. **[원문]** = 페이지 본문에서 글자 그대로 확인 · **[추출]** = 도구가 요약 · 추출한 문장(구현 때 해당 앵커에서 한 번 더 대조).

| # | 사실 | 근거 |
|---|---|---|
| F1 | 압축 창 = 환경 변수 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` — "Set the auto-compact window, how full the context gets before compaction, from `100000` to `1000000` tokens." 설정 키 `autoCompactWindow` — "Set how full the context window gets before Claude Code compacts automatically." · 기본 "unset, so Claude Code picks a window tuned for your model." · 예 `{"autoCompactWindow": 500000}` · 적용 범위 "Any file"(= 사용자 · 프로젝트 · 로컬 · 관리 설정 네 곳 모두) | [원문] env-vars#variables · settings-reference#autocompactwindow · #settings-index. 설정 키의 값 범위(100000~1000000)는 [추출] |
| F2 | 우선순위 — "Unless Claude Code ignores the value, the variable takes precedence over the command, the flag, and the `autoCompactWindow` setting." · "A window you saved for a model with `/autocompact` takes precedence over this key in the same file for that model." · `--autocompact <auto\|tokens>` = "Set the auto-compact window for this session without changing your saved settings" · 설정 파일 사이 = 관리 > 명령줄 > 프로젝트 로컬 > 프로젝트 > 사용자 · "Environment variables aren't a level in this stack" | [원문] model-config#set-the-auto-compact-window · cli-reference#cli-flags · settings#settings-precedence |
| F3 | 모델 창 상한 — "Whichever way you set the window, Claude Code caps it at the model's context window." 기본 압축 지점 — 설정이 없으면 모델의 컨텍스트 한도에서 · "Models running with a native 1M window compact before the window fills, at about 967K tokens by default." · 1M을 쓰지 않는 세션은 200K 경계 | [원문] model-config#set-the-auto-compact-window · #default-auto-compact-thresholds |
| F4 | 범위 밖 값(환경 변수): 하한 미만 → 「100,000과 모델 창 중 작은 값」 · 상한 초과 → 「1,000,000과 모델 창 중 작은 값」 · 쓸 수 없는 값 → 무시하고 `--autocompact` · `/autocompact` · `autoCompactWindow` 또는 기본값 | [원문] model-config#claude_code_auto_compact_window-values |
| F5 | **플러그인이 설정 기본값을 내려 주는 경로는 문서에 없다** — `plugins` · `plugins-reference`에 플러그인 루트 `settings.json`이나 지원 키 목록 서술이 없다 | 두 페이지 확인(서술 없음) |
| F6 | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` — 압축 창의 백분율(1~100)로 발동 시점을 **앞당기기만** 한다("the variable can't raise the threshold"). 이 트랙은 쓰지 않는다 | [원문] env-vars#variables |
| F7 | 유휴 압축 — `CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS` 기본 200,000(하한 100,000) · `idleCompaction` 기본 `true` · "a session past about 200K tokens that sits idle is compacted shortly before the cache expires" — 압축 창 설정과 별개로 일어난다 | [원문] env-vars#variables · settings-reference#idlecompaction · best-practices#keep-cost-and-context-down |
| F8 | 단계 사이 새 세션 — "Once `SPEC.md` exists, start a fresh session to build from it" · "`/clear` between unrelated tasks." 컨텍스트가 차면 품질이 떨어진다는 **수치 임계는 문서에 없다** | [원문] best-practices#brainstorm-with-claude-first · #keep-cost-and-context-down |
| F9 | 환경 변수는 시작할 때 읽힌다("Claude Code reads shell environment variables at startup") · 셸 변수와 설정 `env` 블록이 겹치면 대부분 설정 파일 값이 적용되고 일부 변수는 예외다 — 이 변수가 어느 쪽인지는 서술 없음 | [원문] env-vars#precedence |
| F10 | Stop 훅 — `decision: "block"` + `reason`으로 멈춤을 막는다(넛지 훅이 쓰던 계약). SessionStart `compact` = "Auto or manual compaction" · 압축 뒤 그 출력이 컨텍스트에 더해진다 | [원문] hooks#stop-decision-control · hooks#sessionstart · context-window#what-survives-compaction |
| F11 | **자동 압축 끄기** — 설정 `autoCompactEnabled`("`false`: Claude Code doesn't compact automatically." · 기본 `true` · `/config`의 **Auto-compact** · 끄면 "idle compaction turns off too") · 환경 변수 `DISABLE_AUTO_COMPACT`("Set to `1` to disable automatic compaction when approaching the context limit, along with idle compaction." · "Overrides the autoCompactEnabled setting.") · `DISABLE_COMPACT`("Set to `1` to disable all compaction") · 켜고 끄는 변수의 값 규칙(같은 절 머리 주석 — "For variables that turn a behavior on or off, set `1`, `true`, `yes`, or `on` to turn it on and `0`, `false`, `no`, or `off` to turn it off, in any casing." · 「값이 있기만 하면 켜짐」 예외 목록에 두 변수 없음 — 2026-11-15 확인). 꺼진 채 컨텍스트가 차면 — "sessions stop at the 200K boundary with the context-limit error instead of compacting"(1M을 끈 세션 서술) | [원문] settings-reference#autocompactenabled · env-vars#variables · model-config#turn-off-1m-context |
| F12 | **모델별 저장값** — `modelSettings` = "object mapping a model name to an object with any of these fields" · 그 필드 `autoCompactWindow` = "a number of tokens from `100000` to `1000000`, or `"auto"`" · `/autocompact`는 "saves it to your user settings under the current model in `modelSettings`"(v2.1.288 이상 — 그 전에는 최상위 `autoCompactWindow`에 저장). `/autocompact`를 인자 없이 실행했을 때의 표시 · 최상위 키의 최소 버전은 서술 없음 | [원문] settings-reference#modelsettings · model-config#set-the-auto-compact-window |

### 6b. 저장소 · 환경 조회 (2026-11-15 · base `6538b75` · 맥북 · Claude Code 2.1.325)

- **H1** 넛지 · 후계 · `CLAUDE_CTX_` 언급 파일(`docs/` · `.remember/` 제외): `hooks.json` · `context-threshold-hook.mjs` · review-loop · orchestrate · dev-cycle · doctor · setup SKILL.md · 템플릿 · README 3종 · `plugin.json` · `tests/hooks/compact-reread-hook.test.mjs`(등록 기대값) · `tests/orchestrate/orchestrate.test.mjs`(픽스처 문자열). `marketplace.json`은 「Stop 훅」 표현으로 언급.
- **H2** review-loop의 넛지 · 후계 언급은 §2b ③ · §2b (1) · §2i(첫 문단 · 진행 중 라운드 분기 · 순서 3)에만 있다. 「세 경로」 = §2i 첫 문단 · §4의 2곳 · 「경로 ①」 = §2b (1) · §2i의 3곳.
- **H3** harden-spec · mr-review · ui-mockup · writing-plans-split SKILL.md에는 넛지 · 후계 · 임계 언급이 없다. `orchestrate.mjs`는 `[TRACK-HANDOFF ` 표지만 보고 사유 문자열을 읽지 않는다.
- **H4** 크기: review-loop 89,389B(상한 90,005) · orchestrate 16,839B(상한 17,408) · doctor 39,072B · setup 4,779B · dev-cycle 16,417B · 넛지 훅 30,318B. 테스트 기준선: hooks 11 · orchestrate 56 · mr-review 371. `plugin.json` 1.5.0.
- **H5** 단계 경계 문면: dev-cycle 3곳 · harden-spec 「정지」와 「하지 말 것」 · ui-mockup 「정지」 · review-loop §4 · orchestrate ④ · 템플릿 7절(§3g 표).
- **H6** orchestrate ⑤-1 (a)는 codex 잡 확인 방법을 「훅 후계 프롬프트의 0번째 동작과 같은 상태 파일 직접 읽기」로 가리킨다 — 명령 원문은 훅 스크립트에만 있다(→ D12).
- **H7** setup 3번은 `env.CLAUDE_CTX_LIMIT`을 글로벌 · 프로젝트 로컬 · 프로젝트 중 고른 곳에 쓰는 절차다(질문 2개를 한 번에). doctor 4번은 그 값과 현재 모델 창을 대조한다(규칙 (d) · (e)).
- **H8** 저장소에 CLAUDE.md · AGENTS.md · `docs/adr/` · CHANGELOG가 없다 — 불변식은 선행 spec의 D블록과 README에 있다. README에는 버전별 안내 목록이 따로 없다(10절의 `1.3.x:` 목록은 mr-review 전용) — 본문이 「〈버전〉부터」로 서술한다.
- **H9** README 9절 앵커를 가리키는 곳은 README 3종의 목차 줄뿐이다.
- **H10** 두 테스트 파일은 템플릿 · README를 읽지 않는다.
- **H11 (실측)** 맥북 Claude 세션의 Bash에는 `CLAUDE_PLUGIN_DATA`가 설정돼 있고 companion 루트 해소 명령이 성공한다 — 잡 확인 명령은 메인 세션에서 실행할 수 있다.
- **H12** 닫기 전 잡 확인이 지키는 것: `/exit`가 부르는 codex `SessionEnd` 정리가 폴더 공유 브로커를 내려 같은 폴더의 다른 세션 잡을 죽인다(훅 스크립트 주석 · 1.0.0 D3).
- **H13 (조회 — 해당 값만 투영)** 맥북 사용자 설정: 최상위 `autoCompactWindow` 없음 · `modelSettings` 3모델은 `effortLevel`뿐(압축 창 저장값 없음) · `autoCompactEnabled` 키 없음(기본 켜짐) · 관련 환경 변수 4종 미설정.
- **H14 (가조립 실측)** §3d의 문구를 현행 orchestrate SKILL.md에 대입하면 17,136바이트(상한 17,408 · 여유 272). (a)를 서술 문장으로 두면 17,204 · 스크립트 서브커맨드로 두면 17,130.
- **H15** README의 「세션 모드」 문단 · 트러블슈팅의 doctor 줄 · 구조도에도 넛지 · 후계 전제 문구가 있다(§3h에 반영).
- **H16** 넛지 훅은 창을 1M으로 가정한다(`CLAUDE_CTX_LIMIT` 없을 때) — 200K 세션은 다 채워도 비율 20%라 기본 임계 40%에 닿지 않는다.
- **H17** 선행 spec의 관련 결정 번호는 §3k 표(각 spec의 재논의 금지 블록에서 확인).
- **H18 (실측)** 훅 스크립트가 만드는 넛지 문구(오르카 경로)에서 「companion 루트 해소」(591자) · 「상태 프로브」(1,070자) 두 명령을 그대로 뽑아 bash · zsh로 실행하면 둘 다 `GATE_OFF FOREIGN_ACTIVE=0`을 낸다(맥북 · 이 체크아웃) — AC5의 대조 · 실행이 성립한다.

### 6c. 실측 필요 (문서로 확정되지 않음)

| # | 항목 | 이 spec에서의 처리 |
|---|---|---|
| M1 | 사용자 설정의 `autoCompactWindow`가 새 세션에 적용됐는지 **보는 수단**(`/autocompact`를 인자 없이 실행했을 때의 표시 — 문서에 없음) | AC14 ② — 실측 때 표시를 그대로 적는다 |
| M2 | `CLAUDE_CODE_AUTO_COMPACT_WINDOW`가 설정 파일 `env` 블록으로도 통하는가 | **쓰지 않는다** — 설정 키를 쓴다(§3e). 재지 않는다(doctor는 `env` 블록의 값을 보이면 그대로 보여 주기만 한다) |
| M3 | 60만 근처에서의 작업 품질 · 압축 뒤 이어가기의 실제 모습 | 관측 O3 — 값 조정의 근거 |
| M4 | 메인 오케스트레이터 세션이 압축 뒤 이어 가는가(감시 재부착 · 트랙별 블록 복원) | 관측 O1 — 문제가 보이면 별도 트랙 |
| M5 | 넛지 없이 한 단계를 끝까지 가는가 · 압축 두 순간의 이어가기 | **시험 게이트**(§3j · AC-G) |
| M6 | 최상위 `autoCompactWindow` 키를 지원하는 Claude Code 최소 버전(문서에 없음) | 맥북(2.1.325)은 AC14 ②가 확인한다. 다른 머신은 각 머신의 첫 설정 때 관측(O6) |
| M7 | 잡 확인 명령이 원격 호스트의 ssh 셸(페어링)에서도 도는가 — `CLAUDE_PLUGIN_DATA` 유무 미확인 | 재지 않는다 — 훅 때와 같은 기존 노출이고, 판독 불가면 보류 · 보고다 |

## 7. 미해결 질문

없음 — 초안의 6건은 harden-spec에서 전부 닫혔다.

| 초안 # | 내용 | 처리 |
|---|---|---|
| 1 | orchestrate ⑤-1 (a)의 codex 잡 확인 명령의 거처 | D12(참조 문서로 원문 이전) |
| 2 | 스킬 문서 변경의 검증 수준 | D20 |
| 3 | setup이 제안하는 기본 선택 | D16 |
| 4 | 시험 게이트의 경계(한 순간을 보지 못했을 때) | D11 |
| 5 | 설치본 실측의 완료 조건 범위 · 머신 | D22 |
| 6 | 릴리스 순서 — 섞인 동안의 동작 | 사실 해소 — 넛지 유무는 그 세션이 도는 설치본이 정한다 · 순서를 강제하지 않는다(§3i · §5 릴리스 안내 ②) |

## 잔여 리스크 (DEFERRED) · 수용된 한계

**DEFERRED** (사용자 유예 — 질문 G14)

- **시험이 실패해 1.5.1이 먼저 나간 뒤의 재개 절차** — 게이트를 어느 루프에서 다시 확인할지(1.5.1 트랙의 루프 · 이 spec의 재검증 · 시험 전용 트랙) · 1.5.1이 review-loop 문서를 고쳤을 때 이 spec의 기준선(크기 · 무변경 대상)을 어떻게 다시 잴지. 실패가 실제로 나왔을 때 무엇이 깨졌는지를 보고 사용자가 정한다. 그때까지 이 트랙은 구현 전에 멈춰 있다(§3j).

**검증 필요(실측)** — §6c M1~M7. 구현 착수 조건 = 시험 게이트(M5). 트랙 완료 조건 = AC14(M1 포함). M3 · M4 · M6은 관측 항목, M2 · M7은 재지 않는다.

**수용된 한계** (질문으로 확인)

- **압축 대비가 없는 스킬**(D9) — harden-spec의 갭 대장 등 대화에만 있는 작업 목록은 넛지가 없어진 뒤 압축을 맞을 수 있다. 대비는 1.5.0 안내문 4번 줄뿐이다. 관측 O2에서 누락이 보이면 별도 트랙.
- **메인 세션의 압축 뒤 이어가기는 미실측**(D6) — 관측 O1.
- **40만~60만 구간의 품질은 미측정** — 60만은 출발값이다(사용자 판정). 관측 O3으로 조정한다. 넛지를 되살리는 기준은 미리 두지 않는다(D23).
- **압축 지점을 넣지 않은 머신**은 1M 모델에서 약 967K까지 간다 — setup · README 안내가 유일한 장치다(플러그인 기본값 경로 없음 — F5).
- **모델별 저장값이 있는 모델**은 setup이 넣은 값이 걸리지 않을 수 있다(같은 파일이면 확정 — F2 · D17) — setup · doctor가 알리기만 한다.
- **자동 압축을 꺼 둔 환경**에서는 대화 길이를 알려 주는 장치가 없다(D19) — doctor 표시와 README 1줄뿐이다.
- **구버전 설치본 트랙의 자가 후계**는 1.6.0 메인이 스스로 찾지 못한다(D14) — 후보를 보고하고 사용자 지시를 기다린다.
- **orchestrate 분량 여유가 약 270바이트로 줄어든다**(H14) — 검증 라운드 수정으로 넘어야 하면 사유를 적고 사용자 확인.

## 재논의 금지(기결정)

이 절의 결정은 적대검증에서 **재론 대상이 아니다.** 근거가 바뀐 새 사실이 나오면 그 사실을 먼저 제시한다.

**사용자 판정 (2026-11-15 — 트랙 착수 전)**

| | 결정 | 근거 |
|---|---|---|
| — | 방향 = 진행 상황은 바로바로 파일에 기록 · 단계와 단계 사이는 새 세션 · 한 단계 안은 자동 압축으로 관리 | 사용자 판정 |
| — | 순서 = 트랙 1(압축 대비 보완 — 1.5.0 릴리스 · 머지 완료) → 실제 트랙 시험(넛지만 끔) → **트랙 2(이 트랙 — 단계 안 넛지 · 후계 절차 삭제)** | 사용자 판정 |
| — | 압축 지점 = **60만 토큰에서 출발** — 이 트랙에서 설정으로 반영하고 시험 · 관측 결과로 조정한다 | 사용자 판정 |
| — | 1.5.0의 AC13 실측과 「실제 트랙 시험」을 **이 트랙의 4단계(spec 적대검증 루프)에서 겸한다** — 넛지 끔(`CLAUDE_CTX_THRESHOLD=0.99`) · 작은 압축 창(15만~20만). **구현(7단계) 착수 조건 = 그 시험 관측 통과.** 통하지 않으면 구현 전에 멈추고 1.5.1이 먼저다. 시험 수행 · 기록은 메인과 기록 트랙 몫 | 사용자 판정(트랙 기동 직전) |
| — | 1.5.0 spec의 재논의 금지 D블록은 그대로 둔다 — 이 트랙은 그 위에서 걷어 낸다 | 승계 |
| — | 플러그인은 공개 저장소다 — 다른 저장소 · MR 이름을 spec · 코드 · 테스트에 적지 않는다 | 저장소 규칙 |

**초안 확정분 (2026-11-15 · 질문 Q1~Q9 — 전부 첫 선택지)**

| D | 결정 | 근거 |
|---|---|---|
| **D1** | 경로 = **경량** · 4 spec 적대검증 **유지** | 접촉 표면에 정식 신호 없음(지우는 변경 · 진행 상태 보존은 1.5.0이 넣었다). 4단계는 사용자 판정의 시험 게이트가 걸려 있어 생략할 수 없다 (Q1) |
| **D2** | **5 plan 생략** — 6은 자동 해당없음 · impl ledger = 이 spec 말미 | 작업이 파일별 삭제 · 문구 교체라 서로 독립이고, §2 범위 표 + §3 절별 변경 표 + 잔존 어휘 게이트(AC12)로 검증된다(1.5.0 D2 전례) (Q1) |
| **D3** | 넛지 훅 = **통째로 삭제**(Stop 등록 + 스크립트). 기본 끔 · 임계 상향으로 남기지 않는다 | 방향(단계 안 = 자동 압축)과 D6에 맞고 유지보수할 갈래가 남지 않는다. 남기면 후계 절차를 지우기 위해 넛지 문구를 새로 써야 한다. 턴마다 세션 기록을 읽던 비용도 사라진다(L3). 쓰는 사람이 있다는 근거가 없다 (Q2) |
| **D4** | 압축 지점 반영 = **setup 스킬이 사용자 설정 `autoCompactWindow`에 제안 + README 안내.** orchestrate 기동 접두는 붙이지 않는다 | 메인 · 트랙 · 단독 세션 모두에 걸리는 자리는 사용자 설정뿐이다(D6 — 메인도 압축에 맡긴다). 값이 한 곳이라 조정이 쉽고, 사용자가 이미 둔 값을 덮어쓰지 않는다. 플러그인 기본값 경로는 문서에 없다(F5). 한 트랙만 다른 값은 환경 변수 접두로 덮는다(F2) (Q3) |
| **D5** | 버전 = **1.6.0** — 릴리스 안내에 「동작이 바뀌는 릴리스」를 밝힌다 | 스킬 호출 방법 · 파일 형식이 그대로라 기존 사용 흐름이 깨지지 않는다. 가칭 유지 (Q4) |
| **D6** | **메인 오케스트레이터 세션도 자동 압축에 맡긴다** — 메인용 넛지 · 자동 교대를 남기지 않는다. orchestrate ⑤-3은 「새 메인 세션이 이어받을 때의 복원 순서」로만 남는다. 압축 뒤 메인이 이어 가는지는 관측 항목(O1) | **사용자 본인 판정**(2026-11-15) — 하루 두 번 교대(42% · 43%)의 비용 · 메인의 상태는 이미 핸드오프의 트랙별 블록에 있다 · 실측 없는 새 규칙(수동 교대 권고)은 넣지 않는다(L1) (Q5) |
| **D7** | HANDOFF = **전부 보고하고 재개 지시를 기다린다**(「사유가 넛지일 때만 자동 재개」 삭제). 기동 전 설치 버전 확인에 **1.6.0 기준**을 둔다 — 미만이면 갱신 제안, 거절하면 넛지가 살아 있음을 밝힌다. 후계를 띄우는 순서 (a)(b)(c)는 남는다 | 넛지라는 사유가 없어진다. 지운 개념의 호환 갈래를 문서에 남기지 않는다. 옛 버전 머신은 기동 전에 걸러 알린다 (Q6) |
| **D8** | doctor 4번 = **압축 지점 설정 조회로 교체**(값만 투영 · 좋고 나쁨 판정 없음 · 옛 변수 잔존 1줄). 4항목 표 유지 · 증상 문장에서 넛지 삭제 · 새 증상 문장 없음 | 「이 머신에 압축 지점이 걸려 있나」 · 「옛 변수를 지워도 되나」에 답하는 자리가 필요하다. 60만은 출발값이라 좋고 나쁨을 판정하지 않는다 (Q7) |
| **D9** | 압축 대비가 없는 스킬(harden-spec 등) = **보완하지 않는다 — 한계로 적고 관측** | 실패 사례가 없다(L1). 1.5.0 D5 · D10(스킬 문서 수정은 review-loop뿐)을 잇는다 (Q8) |
| **D10** | review-loop = **쓰는 쪽만 삭제, 이어받는 규칙은 남긴다** — 재개 계약은 「구버전이 남긴 기록」용 1구절 · §0b 판정표 무변경 | 갱신 전에 넛지로 멈춘 루프를 갱신 뒤 이어받을 수 있어야 한다. 1.5.0 D블록(§0b 표)을 건드리지 않는다. 문서는 순감한다 (Q9) |

**harden-spec 확정분 (2026-11-15 · 갭 G1~G13 — 전부 첫 선택지)**

| D | 결정 | 근거 |
|---|---|---|
| **D11** | 시험 게이트 = **두 순간을 모두 관측해 통과해야 충족.** 한 순간이라도 보지 못했으면(실패가 아니라 미관측이어도) 미충족 — 구현을 시작하지 않고 사용자 판정 | 기결정 「착수 조건 = 시험 관측 통과」를 글자 그대로 지킨다. 「일하는 도중 압축돼도 멈추지 않고 횟수를 두 번 세지 않는다」는 (나)에서만 확인된다 — 보지 않은 채 넛지를 지우지 않는다 (G1) |
| **D12** | 닫기 전 codex 잡 확인의 명령 원문 = **orchestrate 참조 문서 1개로 글자 그대로 이전.** 스크립트 서브커맨드 신설 · 서술 문장만 두기 · 확인 삭제는 하지 않는다 | 실전에서 다듬어진 명령(1.0.0~1.0.2의 검증 수정)을 잃지 않고, 지우는 트랙에 새 코드 · 테스트가 늘지 않으며, 스킬 문서 분량 상한을 지킨다(H14). 확인이 지키는 위험(폴더 공유 브로커)은 그대로 있다(H12) (G2) |
| **D13** | orchestrate 시작 자가 점검의 위임 모드 경고 = **유지 · 사유 문구만 교체**(「이 세션의 스킬 질문이 추천안으로 자동 채택된다」) | 후계라는 이유는 사라지지만 위임 모드의 남는 효과(자동 채택)가 메인에 걸리면 사용자에게 묻지 않고 진행한다. 메인은 사용자에게 직접 묻는 세션이라는 정의(1.1.0 D9)를 지킨다 (G3) |
| **D14** | 재획득의 식별 단서 = **메인이 보낸 프롬프트 파일 경로 하나** — 훅 후계 프롬프트의 문구는 뺀다 | D7과 같은 방향(지운 개념의 호환 갈래를 남기지 않는다). 못 찾으면 후보를 보고하고 기다린다 — 잘못 고르지 않는다. 옛 버전 머신은 기동 전에 알린 상황이다 (G4) |
| **D15** | dev-cycle 「단계 경계」 절에 **1문장** — 「한 단계 안의 대화 길이는 자동 압축이 관리한다 — 단계 도중에는 세션을 갈아타지 않는다」(지우는 넛지 문장 자리) | 사용자 방향의 셋째 항목이 스킬 문서에 적힌 곳이 없다. 새 절차가 아니라 정해진 방향의 기록이다 (G5) |
| **D16** | setup — 값이 없으면 **첫 선택지 = `600000`**(「이 플러그인이 쓰는 출발값 · 조정 중」을 밝힘) · 둘째 = 건너뜀. 값이 있으면 첫 선택지 = 현재 값 유지 | 60만은 사용자 판정의 출발값이고 setup은 사용자가 일부러 부르는 스킬이다 — 언제든 건너뛸 수 있다 (G6) |
| **D17** | setup이 모델별 저장값을 발견하면 **알리기만 한다** — `modelSettings`는 고치지 않는다 | 사용자가 일부러 모델별로 둔 값을 건드리지 않는다. setup의 쓰기는 키 하나로 남는다. 그 자리는 추론 강도 등 다른 모델별 설정과 같은 곳이다(H13) (G7) |
| **D18** | setup에 **「압축 지점만」 갈래를 만들지 않는다** — 구조 그대로. 압축 지점만 넣으려면 README의 수동 방법 | 새 갈래 · 새 호출 방식 · 검증 대상이 늘지 않는다(L3). 수동 방법이 한 줄이다 (G8) |
| **D19** | doctor 4번이 **「자동 압축 꺼짐」을 보여 준다** + README 1.6.0 안내에 1줄 | 꺼져 있으면 「압축 지점 설정됨」이라는 조회 결과가 사실과 어긋난다. 넛지가 없어진 뒤 그 환경에는 대화 길이를 알려 주는 장치가 없다는 것을 알려야 한다. 좋고 나쁨 판정을 더하는 것이 아니다(F11) (G9) |
| **D20** | doctor · setup 변경의 검증 = **문자열 대조 + 조회 블록 직접 실행(가짜 설정 파일 · bash · zsh) + 릴리스 뒤 맥북에서 각 1회 실제 실행.** 증상 문장별 호출 실측은 돌리지 않는다 | 증상 문장을 빼는 변경이라 「뜨면 안 될 때 뜨는」 위험이 늘지 않는다. 최근 릴리스들의 방식(1.4.1 D10 · 1.5.0) (G10) |
| **D21** | 7단계에서 훅 등록을 고친 직후 **헤드리스 3호출로 「압축 뒤 안내문이 여전히 주입된다」를 1회 확인**(AC13) | 이제 단계 안을 지키는 장치는 이 훅뿐이고, 단위 테스트는 등록이 실제로 읽히는지를 보지 못한다. 절차와 비용이 1.5.0에서 검증됐다(몇 분 · 작은 모델) (G11) |
| **D22** | 트랙 완료 조건 = **맥북 설치본에서 ①②③**(훅 없음 · setup 반영과 새 세션 적용 · doctor 표시). 다음 실제 트랙의 모습과 다른 머신은 관측 항목 | 「넛지 없이 끝까지 간다」는 구현 전 4단계 시험이 확인한다 — 릴리스 뒤 새로 확인할 사실은 ①②③뿐이다. 완료 조건이 다른 트랙 · 다른 머신에 묶여 열려 있지 않게 한다 (G12) |
| **D23** | 넛지를 **되살리는 기준은 미리 두지 않는다** — spec에는 되돌리는 방법만 적는다. 판정은 관측이 쌓인 뒤 사용자 | 재지 않은 숫자를 기준으로 세우지 않는다(L1). 압축 지점 값 조정도 같은 관측을 따른다 (G13) |

## 구현 기록 (7단계 — 2026-11-16)

- **AC-G**: 1.5.0 spec §4 「AC13 기록」(`a6f95da`) = (가) 6항 통과 · (나) ①②④⑤ 통과 · **③ 한 줄 보고 미통과(5/10)** — 「두 순간 × 6항 통과」가 아니다. 4단계는 넛지 0으로 종결(`48c5cad`). **착수 근거 = 사용자 판정(2026-11-16) 「착수 허용, 보고 줄은 후속」** — ③(1.5.0 D13)과 §0b 위치 판정표 보강은 1.6.0 뒤 후속 트랙 몫이라 이 구현은 §0b · 라운드 기록 · 한 줄 보고 문장을 건드리지 않았다.
- 순서 = §5 그대로(경량 planless TDD · plan 문서 없음 — D2). base `a6f95da` · 커밋 `6196163`(① 참조 문서 + 훅 등록 · 스크립트 삭제) → AC13 → `2edbe7f`(③ review-loop) → `f21e826`(④ orchestrate · 템플릿 · 픽스처) → `57fc8a2`(⑤ setup · doctor · dev-cycle) → `55946e4`(⑥ README 3종) → `96ff1c3`(doctor 안내 문구 정정) → 이 기록. 트랙 프롬프트의 사실(HEAD · 미push · 크기 기준선 · 테스트 기준선 · 미추적 1건)은 git · 파일과 일치했다.
- **RED 확인**: 훅 등록 테스트 기대값을 먼저 바꿔 10/11(실제 키 `Stop,SessionStart`) → GREEN 11/11. 문서는 AC별 grep 대조를 편집 전에 돌려 실패를 본 뒤 고쳤다(review-loop 「넛지」 6행 · orchestrate 「사유가 넛지일 때만」 등 5종 1건씩 · doctor 「넛지」 5 · setup `CLAUDE_CTX_` 4 · dev-cycle 3곳 · AC5 참조 문서 부재 FAIL).

| AC | 확인 수단 | 결과 |
|---|---|---|
| AC1 | 테스트 `AC1 hooks.json — hooks 키 = SessionStart(compact) 그룹 1개뿐` · `Object.keys(hooks)` = `SessionStart` · `SessionStart` 값 base와 JSON 동치 | 통과 |
| AC2 | `test ! -e …/context-threshold-hook.mjs` · `git diff --stat a6f95da..HEAD -- compact-reread-hook.mjs orchestrate.mjs` 0줄 | 통과 |
| AC3 | grep — 「세 경로」·「경로 ①」·「넛지」·「후계」·`CLAUDE_CTX`·「임계」 0 · 「두 경로」 2행(§2i · §4) · 「1.6.0 미만 설치본이 남긴 것」·「카운터를 다시 올리지 않는다」 1 · 「완료 전 /clear 금지」 1 · 「백그라운드 기본」 1 · 변경 덩어리 = §2b ③ · §2b (1) · §2i 첫 문단(2덩어리) · 진행 중 분기 → 재개 계약 · 순서 3 · `## 다음 액션` · §4 = §3c 표 7곳 · 89,389 → **87,170B** · 맨 `$`+숫자 0 | 통과 |
| AC4 | grep — 「사유가 넛지일 때만」·「0번째 동작」·「옛 세션(핸들」·「자동 인계」·「자기 후계」 0 · `references/codex-job-check.md` 1 · 「새 메인 세션이 이어받을 때」·「자동 압축에 맡긴다」·「스킬 질문이 추천안으로 자동 채택된다」·「오르카 재시작 등으로」 1 · 「1.6.0 미만」 2(① 1 · ⑤-1) · 「1.2.0 미만」 2(① 1 · ③ 표 3행) · 16,839 → **17,086B**(≤ 17,408) | 통과 |
| AC5 | 아래 | 통과 |
| AC6 | 템플릿 「넛지」 0 · 8절 `사유: 사용자 중단 \| 폴백②` · 9절 없음 · 1~8절 · 「대리 채택」 · 「후계」 절 유지 · 4,366 → 3,952B | 통과 |
| AC7 | dev-cycle 「넛지」·「후계」 0 · 「자동 압축이 관리한다」·「단계 도중에는 세션을 갈아타지 않는다」·「`/clear` 안내」 1 · 16,417 → 16,444B | 통과 |
| AC8 | setup grep — 「넛지」·「임계」 0 · `CLAUDE_CTX_` 2(조회 블록의 옛 변수 줄 · 알림 ④ — 둘 다 「더는 쓰이지 않는다」 문맥) · 「현재 값 유지」 · `600000` · 출발값 설명(문면 그대로) · 「건너뜀」 · 위치 3종 · 「최상위 `autoCompactWindow`만」 · 「JSON으로 읽지 못하면」 · 알림 ①~④ · 맨 `$`+숫자 0 · 조회 블록 실행(아래) · 4,779 → 6,753B | 통과 |
| AC9 | doctor grep — 「넛지」·`nudge`·`context-threshold`·「모델↔limit」·「현재 모델은 네가 안다」 0 · 규칙 (d)(e) 삭제(「판정 규칙 3건」) · 4항목 표 4행 = `압축 지점 설정 \| 설정됨 / 미설정(모델 기본값) / 자동 압축 꺼짐 / 판정 불가 \| 값 · 출처 · 옛 변수 잔존 여부` · 「뜬다」 = 「codex 연동 · 플러그인 버전 · 압축 지점 설정」 · 우선순위 1줄(관리 설정 · 명령줄 미조회 명시) · 「좋다 · 나쁘다를 판정하지 않는다」 · 39,072 → **39,070B** · 맨 `$`+숫자 0 · 조회 블록 실행(아래) | 통과 |
| AC10 | 훅 11/11 · orchestrate 56/56(픽스처 문자열만 — 테스트 이름 · 수 · 단언 불변) · mr-review 371/371 · `orchestrate.mjs` 무변경 | 통과 |
| AC11 | README 3종 — 구성 표 넛지 행 삭제 · doctor 행 「압축 지점 설정」 · 9절 제목 · 목차 앵커 · 1.6.0 첫 문단(꺼진 환경 1줄 포함) · 압축 지점 설정 단락 · 재읽기 단락의 넛지 공존 문장 삭제 · 세션 모드 후계 · 넛지 전제 교체 · 1 · 6 · 7 · 8절 · 트러블슈팅 · 주의 2항목 삭제 · 구조도. 세 파일 각 307줄 · 같은 위치 · `codex-job-check.md` · `autoCompactWindow` 등 4건씩 | 통과(`plugin.json` · `marketplace.json`은 9단계) |
| AC12 | 아래 | 통과(`.claude-plugin/` 2건은 9단계) |
| AC13 | 아래 | 통과 |

- **AC5** — `git show 6538b75:…/context-threshold-hook.mjs`를 임시 파일로 꺼내 `decideNudge({ratio:.5, threshold:.4, …, orcaHandle:'term_X'})`의 출력에서 두 명령을 뽑았다(591자 · 1,070자 — H18과 같음). 참조 문서의 코드 블록 2개가 그 출력의 **부분 문자열**(2/2) · 판독 규칙 5항 · 실행 위치(체크아웃 루트) · 실행 계약(빈 `CODEX_COMPANION_SESSION_ID=` 접두) · 오르카 명령 0. **실행**(bash · zsh 같은 결과): 이 체크아웃 실제 = `GATE_OFF FOREIGN_ACTIVE=0` · 가짜 `CLAUDE_PLUGIN_DATA` 사례 — 부재 0/0 · **실행 셸과 같은 `sessionId`의 running 1건 = 무접두 0 · 접두 1** · 같은 세션 1 + 다른 세션 queued 1 + completed 1 = 무접두 1 · 접두 2 · 깨진 JSON = `STATE_UNREADABLE` · `CLAUDE_PLUGIN_DATA` 없음 = `STATE_UNREADABLE` · 빈 플러그인 캐시 = `RESOLVE_FAIL`.
- **AC9 조회 블록** (SKILL.md 코드 블록을 그대로 꺼내 가짜 설정 파일 · 가짜 `$R` · 환경 변수 5종을 비운 셸에서 23사례 × bash · zsh = 46회 — 두 셸 출력 동일 · 가짜 비밀값 출력 0): 값 없음 → `미설정(모델 기본값)` + 967K 참고 · 사용자 최상위 600000 → `설정됨` · 사용자 모델별 저장값 → `설정됨`(`modelSettings.opus.autoCompactWindow`) · 사용자 `autoCompactEnabled: false` → `자동 압축 꺼짐` + 「켜거나 직접 /compact」 · **스코프 상충** 사용자 `false` + 로컬 `true` → 꺼짐 아님(`미설정`) · 사용자 모델별 + 프로젝트 최상위 → 두 값 출처와 함께 · 우선 단정 없음 · `DISABLE_COMPACT=1` → 꺼짐 · `/compact` 권고 없음 · **원인 결합** `DISABLE_COMPACT=1` + `autoCompactEnabled: false` / + `DISABLE_AUTO_COMPACT=1` → 원인별 줄 모두 · `/compact` 권고 0 · 설정 `env`의 `DISABLE_AUTO_COMPACT=1` 단독 → 「그 전까지는 직접 /compact」 포함 · **참 값** `DISABLE_COMPACT=true` · `DISABLE_AUTO_COMPACT=yes` · `DISABLE_COMPACT=ON` → `1`과 같은 꺼짐 · **거짓 값** `0` · `false` · `off` → 꺼짐 아님(값은 근거 줄에 그대로) · **깨진 JSON** 로컬 깨짐 + 사용자 창 값 · `false` → `판정 불가`(확인된 값은 출력) · 같은 조건 + 셸 `DISABLE_COMPACT=1` → `자동 압축 꺼짐` · 사용자 깨짐 + 로컬 `env.DISABLE_COMPACT=1` → 꺼짐 · 상위 `env` 거짓이 하위 `env` 참을 덮음 → 꺼짐 아님 · 한 줄 파일의 가짜 API 키 · `apiKeyHelper` → 출력 없음 · 관련 키 없는 파일 → `값 없음` · 셸 옛 변수 + 객체 값 → `형식 이상` · 「옛 변수: 남아 있음 — 더는 쓰이지 않음 — 지워도 된다」. 이 머신 실제 실행(읽기만) = 사용자 · 로컬 `값 없음` · 프로젝트 `없음` · `미설정(모델 기본값)` (H13과 같음).
- **AC8 조회 블록** (같은 방식 4사례 × bash · zsh — 출력 동일 · 가짜 비밀값 0): 파일 없음 · 최상위 + 모델별 + `env.CLAUDE_CTX_LIMIT`(「더는 쓰이지 않는다」) + 한 줄 비밀값 · 깨진 JSON(`읽기·파싱 실패` — 쓰지 않는 근거) + 긴 문자열(`형식 이상`) · 셸 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` + 관련 키 없는 파일(`값 없음`). 쓰기는 사용자 설정을 바꾸지 않으려고 실행하지 않았다(AC14 ②).
- **AC12** — `grep -rniE '넛지|nudge|ナッジ|CLAUDE_CTX_|context-threshold|컨텍스트 임계|コンテキスト閾値|자동 인계|automatic handover|自動引き継ぎ' dev-workflow tests README*.md .claude-plugin` 9건: (i) README 3종 219행(9절 첫 문단) 3 · (ii) setup 43행(조회 블록 옛 변수) · 53행(알림 ④) · doctor 258행(조회 대상 변수 목록) · 280행(옛 변수 줄) 4 · (iii) orchestrate 35행(① 1) · 86행(⑤-1) 2 → 허용 목록 밖 0. **`.claude-plugin/` 2건**(`dev-workflow/.claude-plugin/plugin.json` description · `.claude-plugin/marketplace.json` description)은 9 릴리스에서 닫힌다(이 단계 편집 범위 밖).
- **AC13** (1.5.0 spec §5 AC12 절차 — 저장소 밖 빈 임시 폴더 · `--plugin-dir <저장소>/dev-workflow` · `--model haiku` · Claude Code 맥북 · 훅 등록 GREEN 직후 · 스킬 문서 작업 전): ① 첫 대화 → ② `/compact` → ③ 인용 요청. ③의 응답 = 「첫 문장: `[dev-workflow] 이 대화는 방금 압축(요약)됐다.`」 · 1번 줄 경로 = `<저장소 절대 경로>/dev-workflow/skills/<스킬 이름>/SKILL.md`(개발 사본 경로 — 일치). 세션 기록에서 `SessionStart:compact` 훅 성공과 `additionalContext` 정본 주입 확인 · 그 세션의 `Stop` 훅 4건은 다른 플러그인 명령이었고 넛지 훅 실행 0. 판정 = **통과**. 끝나고 그 세션 기록(프로젝트 폴더 JSONL · 빈 `memory` 폴더 · 프로젝트 폴더)과 세션 환경 폴더를 지웠다. 사용자 설정 · 설치본은 바꾸지 않았다.
- **spec 문면과 다르게 적은 것 (판단 — 위험군 아님 · D블록 · AC · 범위 불변)**:
  - doctor 꺼짐 안내 3번째 줄의 「(F11 — 모든 압축 꺼짐)」 → 「(모든 압축 꺼짐)」 — F11은 이 spec 안의 근거 번호라 스킬 문서에서 가리킬 곳이 없다. 안내 줄은 조회 블록의 출력이라 백틱 없이 적었다.
  - doctor 4번은 **조회 블록이 상태 · 안내 줄을 계산한다**(§3f 규칙을 코드 1곳에 — 문서 규칙과 실행 결과가 갈리지 않게, AC9 사례를 기계적으로 검증하려고). 관련 키가 없는 파일도 `값 없음`으로 찍는다(실제 환경 실행에서 그런 파일이 출력에서 빠지는 것을 보고 더함). 옛 셸 env 한계 문단(훅 env ≠ 셸 env)은 대상(훅)이 사라져 지웠다.
  - setup에도 값만 투영하는 조회 블록을 넣었다(§3e 1 「그 값들만 뽑아 읽는다」의 수단). 쓰기는 현행처럼 대상 키만 고치는 편집이다(JSON 재직렬화는 「통째로 재작성」 금지에 걸린다).
  - 테스트 픽스처는 §2 표의 「4곳」이 아니라 **5줄**(49 · 250 · 257 · 271 · 272행)이었다 — 전부 바꿨다(이름 · 수 · 단언 불변).
  - README: 재읽기 단락의 「두 번째 훅」 → 「이 훅」(훅이 하나가 됨) · 세션 모드 위임 효과를 ①② 재번호 · 「1.1.x 설치본은 ①만」 삭제(①이 넛지 효과라 소멸) · 환경변수 예시 블록과 함께 그 안의 `DEV_WORKFLOW_MODE` 줄도 삭제(같은 내용이 세션 모드 문단에 있다).
  - **(8단계 R1-1 · `14a9291`)** doctor 꺼짐 판정 — §3f 「셸이나 실효 `env` 블록에서 참 값」을 「셸 값과 실효 `env` 값의 참 · 거짓이 엇갈리면 원인으로 세지 않고 `판정 불가`」로 좁혔다(이기는 쪽이 실행 환경마다 다르다 — impl ledger R1-1).
  - review-loop 재개 계약은 「(중단 없는 경로와 같다)」 · 「새 필드는 없다」를 줄여 1구절로 썼다(수신 시점 모드 · 카운터 재증가 금지 · 결과 의존 전이 · 예약분 · 고아 라운드 재실행은 그대로).
- **게이트**: G1 훅 11/11 · orchestrate 56/56 · mr-review 371/371 · G2 `git diff a6f95da..HEAD -- dev-workflow tests README*` 추가 줄 식별자 0 · 이 spec 0(단계 줄의 기존 브랜치 이름 제외) · G3 `a6f95da..HEAD` 커밋 본문 AI 서명 · 트레일러 0 · G4 diff = §2 표의 7단계 파일 14개(`plugin.json` · `marketplace.json` · `compact-reread-hook.mjs` · `orchestrate.mjs` · 다른 스킬 · 1.5.0 spec 0줄) + 이 spec(이 절 · 단계 줄) · `git status --short` = 기존 미추적 1건뿐 · 확인 대기 대장 대기 0(이 단계의 추천 자동 채택 0 · 질문 0).
- **크기**: review-loop 87,170B(≤ 89,389) · orchestrate 17,086B(≤ 17,408 · 여유 322) · doctor 39,070B(≤ 39,072 · 여유 2) · setup 6,753B · dev-cycle 16,444B · 템플릿 3,952B · 참조 문서 3,617B. 맨 `$`+숫자(review-loop · setup · doctor) 0. **doctor 여유가 2바이트다** — 8단계 수정이 doctor를 늘려야 하면 같은 절 안에서 줄이거나 사유를 적고 사용자 확인(크기 상한 = 위험군).
- 다음 = 8 impl 적대검증(`--phase impl --security yes --base a6f95da`) — 새 세션.

## 적대검증 ledger (spec)

보안 크리티컬: yes (호출자 지정 — 사용자 상시 지시 2026-10-22) — 접촉면 = codex 잡 종료 경로(폴더 공유 브로커 · `/exit`) · 사용자 설정 파일 쓰기(setup 압축 지점)

- 루프: base `6538b75`(main = origin/main 1.5.0) · 브랜치 `gguii74-rwk/in-stage-nudge-removal-1-6-0` · 예산 `--max 5` · `--confirm-rounds 2` · `--auto-rounds 3` · 위임 모드(`DEV_WORKFLOW_MODE=delegated`) · 설치본 1.5.0 문면으로 실행 · 시험 게이트(§3j)를 겸하는 세션
- score 산식 = 전환용(미확인 FIXED 큐 제외 · §2c 분류 직후 스냅샷)

| 라운드 | HEAD | verdict | critical/high/medium (신규/잔존) | 전환용 score | 미확인 FIXED 큐 |
|---|---|---|---|---|---|
| R1 (적대) | `f3426e0` | needs-attention | 0/1/2 (신규 3) | 5 | 0 → 3 |
| R2 (적대) | `e7830fb` | needs-attention | 0/0/1 (신규 1 · 큐 3건 적대 비재출현) | 1 | 3 → 4 |
| R3 (적대) | `4ea0b90` | needs-attention | 0/0/2 (신규 2 · 큐 4건 적대 비재출현) | 2 | 4 → 6 |
| R4 (적대 · 정밀) | `d734668` | needs-attention | 0/0/1 (신규 1 · 큐 6건 적대 비재출현) | 1 | 6 → 7 |
| R5 (적대 · 정밀) | `9055dcd` | approve | 0/0/0 (신규 0 · 큐 7건 적대 비재출현) | 0 | 7 → 7 |
| C1 (확인 · 일반) | `f7a066d` | **fail** | 0/0/1 (신규 0 · 잔존 1 = R1-3) | — | 7 → 1 (소멸 6: R1-1 · R1-2 · R2-1 · R3-1 · R3-2 · R4-1) → 재FIXED 편입 1 |
| R6 (적대 · 복귀 예약분 · 정밀) | `30e3e26` | needs-attention | 0/0/1 (신규 1 · 큐 1건(R1-3) 적대 비재출현) | 1 | 1 → 2 |
| C2 (확인 · 재진입 예약분 · 정밀) | `272a6fd` | **pass** | 0/0/0 (신규 0 · 잔존 0) | — | 2 → 0 (소멸 2: R1-3 · R6-1) |

| # | fingerprint | severity | disposition | 근거 |
|---|---|---|---|---|
| R1-1 | spec §3d codex 잡 확인 · 이전하는 상태 프로브가 실행 세션과 같은 세션의 잡을 세지 않아 메인 소유 running 잡이 있어도 `FOREIGN_ACTIVE=0` → 메인 실행 시 자기 세션 잡도 세는 실행 계약 + AC5 사례 | high | FIXED `007ed80` (루프 판정 — 자동 모드) | §3d 참조 문서 블록에 실행 계약(빈 `CODEX_COMPANION_SESSION_ID` 접두 — 명령 원문은 글자 그대로 · D12 불변) · AC5에 가짜 상태 파일 사례(접두 실행 1 · 무접두 0). H12 위험 경로 차단 |
| R1-2 | spec §3e·§3f 압축 설정 판정 · 설정 스코프보다 모델별 값과 `false`를 우선해 오진 → 스코프 우선 적용 뒤 같은 파일 안에서만 모델별 우선 · 실효값 판정 + AC9 상충 사례 | medium | FIXED `007ed80` (루프 판정 — 자동 모드) | §3e 4번 알림 = 같은 파일일 때만 「우선」 단정(F2 문언) · §3f 「자동 압축 꺼짐」 = 실효값(스코프 최상위 파일의 값 · `DISABLE_*`) · 근거 칸 우선순위 1줄 · 수용된 한계·README 서술 문구 동기화 · AC9 스코프 상충 사례. D17·D19 불변 |
| R1-3 | spec §3f 조치 안내 · `DISABLE_COMPACT=1`(수동 `/compact`도 막힘 — F11)에 `/config`·`/compact`만 안내 → 꺼짐 원인별 복구 안내 | medium | FIXED `007ed80` (루프 판정 — 자동 모드) → **C1 잔존**(원인 결합 경로 — 「원인이 여럿이면 줄을 모두」가 `DISABLE_COMPACT=1`과 다른 원인이 겹칠 때 `/compact` 대안을 다시 싣는다) → 재FIXED `c6949a6` (루프 판정 — 정밀 모드 · 같은 계열 2회째 — 재진입 확인에서 또 나오면 ESCALATE) | 원인별 3줄(설정 키 false · `DISABLE_AUTO_COMPACT` · `DISABLE_COMPACT` — 마지막은 `/compact` 권고 없음) · AC9 「`DISABLE_COMPACT`에 `/compact` 권고 0건」. D19 불변 · C1 재수정: `DISABLE_COMPACT=1`이 원인에 있으면 다른 줄의 「직접 `/compact`」 대안을 빼고 적는다 · AC9 원인 결합 사례(줄은 모두 · `/compact` 권고 0건) |
| R2-1 | spec §3f doctor 압축 상태 · F2 스택에서 프로젝트·사용자보다 위인 관리 설정(·명령줄)을 읽지 않으면서 상태를 확정 → 관리 설정 `autoCompactEnabled: false`가 `설정됨`으로 보임 → 상태는 읽은 곳 기준임을 명시 · 근거 칸 우선순위 줄을 F2 스택 원문(관리 > 명령줄 > 프로젝트 로컬 > 프로젝트 > 사용자)대로 · 관리 설정·명령줄 미조회 표시 · AC9 | medium | FIXED `30a0e0c` (루프 판정 — 자동 모드) | R1-2와 같은 절이나 지적 내용이 다르다(조회 범위 밖 상위 스코프). 조회 범위는 넓히지 않는다 — 프로브 대상 「환경 변수 + 설정 3곳」은 §3k 승계 범위이고 넓히면 D블록 변경(위험군)이라, 읽지 않는 곳을 근거 칸에 드러내는 쪽으로 닫았다. D8·D19 불변 |
| R3-1 | spec §3f doctor 압축 상태 · 조회 대상 설정 파일 하나를 읽지 못해도 다른 파일 값으로 상태를 확정(상위 파일의 `false` 가능성 미배제 · 하위 `false`만 읽혀 꺼짐 오진) → 읽기 · 파싱 실패 파일이 있으면 `판정 불가`가 하위 값 기반 상태보다 먼저 · 확인된 값은 근거 칸 · AC9 결합 사례 | medium | FIXED `bf99baf` (루프 판정 — 자동 모드) | R2-1(조회 범위 밖 상위 스코프)과 다른 지적 — 조회 범위 안 파일의 읽기 실패. 상태 어휘 4종 · 우선순위 순서만 바뀐다(꺼짐 → 판정 불가 → 설정됨 → 미설정 · 더 우선하는 출처만으로 꺼짐 확정이면 꺼짐). D8 · D19 불변 |
| R3-2 | spec §5 게이트 G4 · 편집 범위 = §2 표의 파일뿐인데 §3j · AC-G · AC13 · D2가 구현 세션에 이 spec의 「구현 기록」 · impl ledger 작성을 요구 → G4에 그 기록의 편집 예외 명시 | medium | FIXED `bf99baf` (루프 판정 — 자동 모드) | G4 = §2 표의 파일 + 이 spec의 「구현 기록」 · impl ledger · `## 확인 대기 대장`(그 밖 본문은 고치지 않는다). D2(plan 생략 · impl ledger = 이 spec)와 일치 — D블록 불변 |
| R4-1 | spec §3k 선행 spec 인용 · 선행 spec 파일명에 다른 저장소 식별자가 들어 있어 공개 저장소 규칙 · G2(이 spec 포함 식별자 0건) 위반, G4가 구현 때 본문 수정을 막아 게이트 통과 불가 → 인용을 버전 · 날짜 · 중립 제목으로 | medium | FIXED `faabc87` (루프 판정 — 정밀 모드) | 인용 문구만 바꾼다(가리키는 문서 · D1 결정 유지 판정 불변). 수정 뒤 이 spec의 식별자 grep 0건 · G2 대상의 다른 파일(skills · hooks · tests · README)은 base에서 이미 0건 |
| R6-1 | spec §3f doctor 꺼짐 판정 · `DISABLE_AUTO_COMPACT` · `DISABLE_COMPACT`를 `1`일 때만 꺼짐으로 봐 공식 참 값(`true` · `yes` · `on` — 대소문자 무관)을 놓침(`DISABLE_COMPACT=true`가 `설정됨` · `/compact` 권고 억제 누락) → 참 값 정규화를 꺼짐 판정 · 원인별 안내 · `/compact` 억제에 같게 + AC9 참 · 거짓 값 사례 | medium | FIXED `3c13898` (루프 판정 — 정밀 모드 · 복귀 적대 R6) | 공식 env-vars 「Variables」 머리 주석의 값 규칙을 2026-11-15 원문으로 확인(두 변수는 「값이 있기만 하면 켜짐」 예외 목록에 없음) — F11 행에 인용. R1-3(원인 결합 시 `/compact` 권고)과 다른 지적 — 입력값 해석. §3f 상태 어휘 · 조치 안내의 `=1` → 「참 값」 · 거짓 값과 문서 밖 값은 원인 아님(근거 칸에 값 그대로) · AC9 사례 추가. D8 · D19 불변(D19 문면에 값 규정 없음) |

**미확인 FIXED 큐**: 비어 있음 — C1 소멸 확인 6건(R1-1 · R1-2 · R2-1 · R3-1 · R3-2 · R4-1) · C2 소멸 확인 2건(R1-3 · R6-1) 제거

- 전환: R5 뒤 적대 예산 소진(신호 3) · 신규 FIXED 후보 0(신호 2) — batch 적재 0건 → 확인 모드 진입(C1 · 확인 예산 2)
- C1(확인 소진 1/2): 완전 응답 · 판정 감사 대상 없음(루프 직접 판정 · 자동 채택 0건) · 신규 finding 없음 · verdict fail(R1-3 잔존 medium) → §2c 분류 = FIXED 후보(수정 방향 명확 · D19 불변) → `c6949a6` 수정 → **복귀**(예약분: 적대 R6 1회 + 재진입 확인 1회 — 두 카운터 불변)
- R6(복귀 적대 · 예약분 — 카운터 불변: 적대 소진 5 · 확인 소진 1): 유효 응답(실행 로그 13건) · 신규 medium 1(R6-1) → FIXED `3c13898` · 큐 1 → 2 → 다음 = 재진입 확인 C2(예약분 · 예산 검사 면제 — 여기서 blocking이 또 나오면 ESCALATE + 새 세션 whole-branch 리뷰 권고)
- C2(재진입 확인 · 예약분 — 카운터 불변: 적대 소진 5 · 확인 소진 1): 완전 응답(실행 로그 14건) · 소멸 확인 R1-3 · R6-1 · 판정 감사 대상 없음 · 신규 finding 없음 · verdict **pass** → 성공 종료(미판정 blocking 0 · 미확인 FIXED 큐 0 · 확인 verdict 통과)
- **종결(2026-11-15)**: blocking 8건(high 1 · medium 7) 전부 FIXED — 출처 전부 루프 판정(사용자 판정 0 · 추천 자동 채택(위임) 0 · ESCALATE 0) · ACCEPTED / DEFERRED_TO_IMPL / OUT_OF_SCOPE / DUPLICATE 0 · low 0. 루프 건강: 재론률 0/8 · 철회 조항 0 · 사람개입률 0/8. 확인 verdict 참고(C2): 구현 착수 때 §3j · AC-G 시험 게이트 충족 확인이 필요 — 이 spec의 기존 게이트 그대로(새 조건 아님)

## 적대검증 ledger (impl)

보안 크리티컬: yes (호출자 지정 — 사용자 상시 지시 2026-10-22) — 접촉면 = codex 잡 종료 경로(참조 문서 · ⑤-1 (a)) · 사용자 설정 파일 쓰기(setup 압축 지점)

- 루프: base `a6f95da`(구현 착수 직전 · 호출자 지정 — upstream 없음) · 브랜치 `gguii74-rwk/in-stage-nudge-removal-1-6-0` · 예산 `--max 5` · `--confirm-rounds 2` · `--auto-rounds 1` · 위임 모드(`DEV_WORKFLOW_MODE=delegated`) · 설치본 1.5.0 문면으로 실행 · 입도 = planless 통합 1회(task 증분 없음 — 커밋이 파일 묶음별이라 전체를 한 diff로 본다) · §1 impl 게이트 = 트랙 프롬프트의 G1~G4 · AC1 · AC2 · 크기 · AC12로 갈음(npm 아님) — R1 전 통과(11/11 · 56/56 · 371/371)
- score 산식 = 전환용(미확인 FIXED 큐 제외 · §2c 분류 직후 스냅샷)

| 라운드 | HEAD | verdict | critical/high/medium (신규/잔존) | 전환용 score | 미확인 FIXED 큐 |
|---|---|---|---|---|---|
| R1 (적대 · 자동) | `984a869` | needs-attention | 0/0/1 (신규 1) | 1 | 0 → 1 |
| R2 (적대 · 정밀) | `b607d85` | needs-attention | 0/0/2 (신규 2 · 큐 1건 적대 비재출현) | 1 | 1 → 2 |
| R3 (적대 · 정밀) | `8f0da37` | approve | 0/0/0 (신규 0 · 큐 2건 적대 비재출현) | 0 | 2 → 2 |

| # | fingerprint | severity | disposition | 근거 |
|---|---|---|---|---|
| R1-1 | doctor SKILL.md §4 조회 블록 `on()` · 압축 끄기 변수(`DISABLE_AUTO_COMPACT` · `DISABLE_COMPACT`)의 셸 값과 설정 `env` 값을 OR로 합쳐 거짓 override를 무시(셸 `0` + 설정 env `1` → 꺼짐 오진 — Desktop · self-hosted runner는 실행 환경이 설정 env를 이긴다) → 실효값 하나로 판정 · 엇갈림은 판정 불가 · 검증 사례 추가 | medium | FIXED `14a9291` (추천 자동 채택(위임) — 메인 대리 · R1 batch flush · 위험군 판단(§3f 판정 규칙 변경 · doctor 크기 상한)으로 질문했고 첫 선택지 「엇갈리면 판정 불가」 채택) · **[자동 채택(위임)] 확인 임무 ③ 우선 감사 대상** | 공식 settings-reference 「How env values interact with your shell」 원문 — 설정 env가 셸 export를 덮되 Desktop · runner가 띄운 세션은 실행 환경이 이긴다 → 엇갈림의 실효값은 실행 환경마다 다르다. 수정: 셸 값과 스코프 최상위 설정 env 값이 모두 있고 참 · 거짓이 다르면 그 변수는 원인으로 세지 않고 `판정 불가`(다른 원인으로 꺼짐이 확정되면 꺼짐이 먼저) · 「엇갈린다」 안내 1줄 · 엇갈린 `DISABLE_COMPACT`도 `/compact` 권고 억제 · 「참 값」 안내 줄은 확정 참일 때만. 하네스(가짜 설정 20사례 × bash · zsh) — 엇갈림 4사례만 바뀌고 나머지 16사례 출력 동일 · 비밀값 0. 크기 39,072 → 39,071B(같은 절 안에서 중복 정규식 묶음 · 주석 꼬리 · 코드가 계산하는 규칙을 되풀이한 설명 괄호 축약). spec §3f 문면(「셸이나 실효 env 블록에서 참 값」)은 G4로 본문을 고치지 않으므로 이 행과 「구현 기록」이 대신 기록한다. D8 · D19 불변 |
| R2-1 | doctor SKILL.md §4 조회 블록 `on()` · 조회 대상 설정 파일 하나가 읽기 실패(EACCES · 파싱)인데 셸 `DISABLE_COMPACT=1`만으로 꺼짐 확정 — 읽지 못한 파일의 env가 셸을 덮을 가능성 미배제 → 읽기 실패가 있으면 셸 참 값만으로 꺼짐을 확정하지 않는다 | medium | ACCEPTED (루프 판정 — 정밀 모드) · **확인 임무 ③ 우선 감사 대상** | 결함 아님 — spec AC9가 「깨진 JSON + 셸 `DISABLE_COMPACT=1` → `자동 압축 꺼짐`」을 명시한 사례이고 §3f 「그 파일보다 우선하는 출처(셸 환경 변수 …)만으로 꺼짐이 확정되면 그쪽이 먼저」 그대로다. 근거: doctor가 보는 셸 값은 Claude Code 프로세스 환경(설정 `env`가 시작 때 이미 써 넣어진 값 — env-vars 「Precedence」)이고, doctor가 읽지 못한 파일은 같은 사용자로 도는 Claude Code도 읽지 못해 그 `env`가 적용되지 않는다 → 셸 값이 실효값. R1-1(읽힌 두 값의 엇갈림 — 이기는 쪽이 실행 환경마다 다름)과 다르다. 고치면 AC9 사례의 기대값이 바뀐다(위험군) — 보완 단계 없음 |
| R2-2 | doctor SKILL.md §4 조회 블록 `add()` · 표시용 문자열 변환 뒤 값으로 판정해 `autoCompactEnabled`의 문자열 `"false"`도 꺼짐으로 확정(공식 타입 Boolean) → 판정용 원값 분리 · 불리언 false만 꺼짐 · 불리언 아님 = 형식 오류 · 사례 추가 | medium | FIXED `e58f09a` (루프 판정 — 정밀 모드) | §3f 「`autoCompactEnabled`의 실효값이 `false`」(공식 settings-reference — Boolean)를 엄밀히 — 불리언이 아닌 값은 `형식 이상`으로 표시하고 원인으로 세지 않는다(env 변수의 「문서에 없는 값은 원인 아님」과 같은 처리 · 새 `판정 불가` 원인은 만들지 않는다 — §3f 상태 어휘 불변). RED(문자열 `"false"` → 꺼짐) → GREEN. 하네스 25사례 × bash · zsh — 문자열 2사례 외 출력 동일 · 비밀값 0. 크기 39,071B 유지(같은 블록 안 축약) |

**미확인 FIXED 큐**: R1-1(`14a9291`) · R2-2(`e58f09a`)

- R1: 유효 응답(실행 로그 23건) · 적대 소진 0 → 1 = auto-rounds 도달 → batch flush(적재 1건 = R1-1 — 위험군이라 질문 · 진행 질문은 추천 채택) → 이후 정밀 모드
- R2: 유효 응답(실행 로그 28건) · 신규 medium 2(R2-1 ACCEPTED · R2-2 FIXED) · score 1 → 1(보안 트랙 — 신호 1 무시 · 신규 FIXED 1이라 신호 2 미발화) → 적대 계속
- R3: 유효 응답(실행 로그 25건) · finding 0 · 적대 소진 3 → 전환 신호 2(신규 FIXED 후보 0) · batch 적재 0건 → 확인 모드 진입(C1 · 확인 예산 2 — 큐 2건 + 루프 직접 판정 R2-1 · R2-2 + 자동 채택(위임) R1-1)

## 확인 대기 대장

| # | 일시 | phase·지점 | 질문 요지(쉬운 말 1줄) | 채택 선택지 | 출처 | 상태 |
|---|---|---|---|---|---|---|
| 1 | 2026-11-16 | impl · R1 batch flush(위험군 질문) | doctor가 압축 끄기 변수의 셸 값과 설정 env 값이 엇갈릴 때 어떻게 판정할지 (impl R1-1) | 엇갈리면 판정 불가 (FIXED) → `14a9291` | 추천 자동 채택(위임) | 확인 대기 |
