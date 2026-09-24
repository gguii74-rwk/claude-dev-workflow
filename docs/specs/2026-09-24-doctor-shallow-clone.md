# doctor 설치본 판정 — shallow 마켓플레이스 clone에서 옛 설치 sha 보강 조회

- 단계: **3 harden-spec 종결 (2026-09-24, D1~D10)** → **4 review-loop(spec) 종결 (2026-09-24, C1 approve — 말미 ledger)** — 다음 = 7 impl. 경로 = **경량 — 4 수행, 5·6 생략**(D8, 6은 5 생략의 자동 귀결). 3.5 비대상(화면 무관). planless — impl ledger 위치 = 이 spec 말미. 릴리스는 오르카 후계 세션 트랙 task-06 종결 **뒤**(D6).
- 출처: 2026-09-24 맥북 `/dev-workflow:doctor` 실행 — ops-hub project 스코프(0.18.0 · `9613013`)가 **판정 불가**로 나왔다. 원인 = 마켓플레이스 clone이 shallow(`.git/shallow` = `3fbc355` 1줄)라 설치 sha 객체가 clone에 없다.
- 대상: `dev-workflow/skills/doctor/SKILL.md` — 핵심 원칙의 fetch 예외 문단 1구절 · 점검 2의 "엔트리마다 설치본 subtree id" 절차와 보조 근거 · 조치 안내의 판정 불가 행.

## 1. 문제

doctor 점검 1행의 존재 이유는 **"이 설치본이 뒤처졌나"**에 답하는 것이다. 그런데 마켓플레이스 clone은 shallow다(실측: `git rev-parse --is-shallow-repository` = `true`, shallow root = 원격 tip 1개). `/plugin update`가 clone을 tip 깊이 1로 맞추므로, **tip이 아닌 커밋에 고정된 설치 엔트리는 거의 항상 clone에 객체가 없다** → `git rev-parse "$SHA:dev-workflow"` 실패 → (b)에 따라 **판정 불가**.

결과적으로 1행은 사실상 "최신" 또는 "판정 불가" 두 값만 낸다 — **뒤처진 설치본일수록 판정 불가**가 된다. 스코프가 갈리는 다중 설치(user 1.0.0 + ops-hub project 0.18.0)가 정확히 이 경우이고, 스코프 간 드리프트도 같은 subtree id를 쓰므로 판정 불가로 따라 떨어진다. 조치 안내는 "재시도"뿐이라 재시도해도 같은 결과가 반복된다.

실측 근거(2026-09-24, scratch shallow clone `--depth 1` of `gguii74-rwk/claude-dev-workflow`):

- 초기: `git cat-file -t 9613013` → `Not a valid object name`
- `git fetch -q --depth 1 origin 961301371a61974b80a24b4a1e8c7cceecabb688` → 약 1.1초, 성공(GitHub은 도달 가능한 커밋의 sha 지목 fetch를 허용)
- 이후 `git rev-parse 9613013…:dev-workflow` → `b0f5c02…`(개발 repo에서 같은 값 확인) — 최신 `fad6f81…`과 달라 **뒤처짐** 판정 가능
- 부작용: `.git/shallow`에 `9613013…`이 한 줄 추가된다(작업 트리·ref 불변).

## 2. 목표 / 범위 / 비목표

**목표** — 설치 sha가 shallow clone에 없어서 생기는 판정 불가를 없애, 원격에 도달 가능한 모든 설치 엔트리에 대해 최신/뒤처짐을 판정한다.

**범위** — 점검 2의 엔트리별 subtree 조회에 보강 fetch 추가, 보조 근거를 트리 비교로 교체, 판정 불가 사유·조치의 원인별 분리, 핵심 원칙 fetch 예외 문단에 1구절.

**비목표** —
- 원격 최신 기준(`ls-remote` → fetch → `$OID`) 절차 무변경.
- clone을 unshallow하지 않는다(전체 이력 다운로드 — 진단 비용·clone 상태 변화가 과함).
- 별도 임시 clone을 만들지 않는다(D1 — 마켓플레이스 clone에 받는다).
- 다른 마켓플레이스 키·필드 결측 등 기존 판정 불가 분기 무변경.
- 점검 1·3·4 무변경. 스크립트·훅 추가 없음(doctor 산출물 = `SKILL.md` 하나).

## 3. 설계

### 3a. 설치 sha 보강 fetch (D1·D2·D3·D10)

설치 sha 객체가 **clone에 없는 엔트리만**(D2) 그 sha를 지목해 1회 fetch한 뒤 다시 조회한다. D2의 "subtree 조회 실패"를 객체 부재로 좁혀 적은 것이다 — 객체가 있는데 경로가 없으면 fetch로 풀리지 않는다.

```bash
# 엔트리 순회 전에 1회 — 보강 fetch 전체가 나눠 쓰는 공유 상한(D10)
DL=$(( $(date +%s) + 30 ))

# 엔트리마다 — 끝에 T(subtree id)가 비면 WHY가 판정 불가 사유(3b)
T=""; WHY=""
if ! printf '%s' "$SHA" | grep -Eq '^[0-9a-f]{40}$'; then
  WHY="설치 sha 형식 이상"                 # 객체 조회도 fetch도 하지 않는다(D3)
else
  TY="$(git -C "$C" cat-file -t "$SHA" 2>/dev/null)"
  if [ -z "$TY" ]; then                    # 객체가 clone에 없는 엔트리만 보강(D2)
    LEFT=$(( DL - $(date +%s) ))
    if [ -n "$TIMED_OUT" ] || [ "$LEFT" -le 0 ]; then
      TIMED_OUT=1; WHY="시간 초과"          # D10 — fetch 없이 건너뜀
    else
      if [ "$(git -C "$C" rev-parse --is-shallow-repository)" = true ]; then D="--depth 1"; else D=""; fi
      perl -e 'alarm shift; exec @ARGV' "$LEFT" git -C "$C" fetch -q --no-write-fetch-head $D origin "$SHA" 2>/dev/null; RC=$?
      if [ "$RC" = 142 ]; then
        TIMED_OUT=1; WHY="시간 초과"
      else
        TY="$(git -C "$C" cat-file -t "$SHA" 2>/dev/null)"
        [ -n "$TY" ] || WHY="보강 fetch 실패"   # RC 무관 — 원격 부재와 접근 오류를 가르지 않는다
      fi
    fi
  fi
  if [ -z "$WHY" ]; then
    if [ "$TY" != commit ]; then
      WHY="설치 sha 객체 유형 이상"          # tree·tag·blob — subtree를 조회하지 않는다
    else
      T="$(git -C "$C" rev-parse "$SHA:dev-workflow" 2>/dev/null)" || T=""
      [ -n "$T" ] || WHY="설치 커밋에 dev-workflow/ 없음"
    fi
  fi
fi
printf 'ENTRY\t%s\t%s\t%s\n' "$SHA" "${T:--}" "${WHY:--}"   # 엔트리마다 한 줄 — 셸이 끝나면 변수는 사라진다
```

- **sha 형식 검사(D3)는 어떤 객체 조회보다 먼저**: `^[0-9a-f]{40}$`가 아니면 객체·subtree 조회도 fetch도 하지 않고 판정 불가 사유 = **"설치 sha 형식 이상"**. 조회 뒤에 검사하면 `HEAD`·`FETCH_HEAD`·해석 가능한 짧은 sha가 `rev-parse`를 통과해 형식 검사를 우회하고, 로컬 최신 revision을 가리킬 경우 거짓 "최신"이 나온다((b) 위반). 옵션 모양 값(`--upload-pack=…`)이 git 옵션으로 해석되는 경로도 같은 검사가 막는다. `gitCommitSha` **결측**은 기존 분기(필드 결측 → 판정 불가)가 이 검사보다 먼저다(비목표 — 무변경).
- **객체 유형이 commit일 때만 subtree를 조회한다**(R2-1 사용자 판정): `<sha>:dev-workflow` 문법은 tree-ish를 모두 받으므로, 형식만 맞는 **tree OID**(예: 최신 커밋의 root tree)가 들어오면 설치 커밋 근거 없이 최신 subtree id가 나와 거짓 "최신"이 된다. fetch로 받아 온 경우에도 같은 검사를 다시 거친다. commit이 아니면 판정 불가 사유 = **"설치 sha 객체 유형 이상"**.
- **`--depth 1`은 clone이 이미 shallow일 때만** 붙인다 — full clone에 붙이면 clone을 shallow로 바꾼다.
- **시간 초과 1회면 나머지 건너뜀(D10)** — 상한 30초는 **보강 fetch 전체가 나눠 쓰는 공유 deadline**(`DL`)이다. 각 fetch에는 남은 시간만 alarm으로 준다. 보강 fetch가 상한(exit 142)에 걸리거나 남은 시간이 0 이하면 네트워크 정지로 보고, 남은 엔트리는 fetch 없이 판정 불가(시간 초과)로 적는다 — 여러 fetch가 상한 직전에 142가 아닌 코드로 실패해도 **누적 추가 대기는 30초를 넘지 않는다**.
- 기존 네트워크 규약(`GIT_TERMINAL_PROMPT=0` · perl wall-clock 상한 · stderr `2>/dev/null`) 그대로.
- **보강 fetch는 `FETCH_HEAD`를 쓰지 않는다(`--no-write-fetch-head`)** — 객체만 필요하고, 마켓플레이스 clone은 공유 상태라 동시에 도는 `/plugin update`·다른 doctor가 자기 fetch와 `FETCH_HEAD` 소비 사이에 덮어쓰인 옛 설치 sha를 소비할 수 있다. doctor 자신의 최신 기준은 원래대로 고정한 `$OID`를 쓴다(SKILL.md 점검 2 "고정한 `$OID`" 문단 — 기본 브랜치 fetch는 무변경).
- 스코프 간 드리프트는 같은 subtree id를 비교하므로 보강으로 함께 판정 가능해진다(별도 변경 없음).

### 3b. 판정 불가 사유·조치의 원인별 분리 (D4)

보강 뒤에도 `T`가 비면 판정 불가이고, 사유(`WHY`)와 조치를 원인별로 나눈다. **어느 경우에도 "최신"·"뒤처짐"이라 단정하지 않는다**((b)).

| 원인 | 판정 불가 사유 | 조치 |
|---|---|---|
| sha 형식 이상 | 설치 sha 형식 이상 | 그 스코프 갱신 명령(조치 표의 스코프별 행) |
| 객체가 commit이 아님 | 설치 sha 객체 유형 이상 | 그 스코프 갱신 명령 |
| 보강 fetch 시간 초과(exit 142) · 공유 상한 소진 · D10으로 건너뜀 | 시간 초과 | 재시도 |
| 시간 초과가 아닌 fetch 뒤에도 객체 없음 | 보강 fetch 실패(원격에 없거나 접근 오류) | 재시도 — **같은 결과가 반복되면** 그 스코프 갱신 명령 |
| commit은 있는데 `dev-workflow/` 경로 없음 | 설치 커밋에 dev-workflow/ 없음 | 그 스코프 갱신 명령 |

**시간 초과가 아닌 fetch 실패는 원인을 단정하지 않는다**(R1-2 사용자 판정). 같은 결과(객체 없음)가 force-push로 커밋이 원격에서 사라진 경우에도, 인증·잠금·디스크 오류 같은 일시 장애에도 나온다 — 종료코드·빈 결과만으로는 둘을 가를 수 없고, git 오류 문구 판별은 git·호스트 버전에 따라 깨진다. 조치를 "재시도 → 반복되면 갱신"으로 두어 일시 장애는 재시도로 풀리고, 원격 부재는 재시도가 무한 반복되지 않는다(D4 취지).

### 3c. 보조 근거를 트리 비교로 (D5)

`git log --oneline "$SHA..$OID" -- dev-workflow/`는 shallow 경계에서 이력이 잘려 **`$OID` 커밋 하나만** 나오는 등 오해를 부른다. 보조 근거를 **`git diff --stat "$SHA" "$OID" -- dev-workflow/`**로 교체한다 — 두 트리만 있으면 되고, 판정 규칙 (a)(트리 비교가 1차, 로그는 되돌림 이력에서 거짓 뒤처짐)와 같은 축이다. 커밋 제목은 보이지 않게 된다(수용).

### 3d. fetch 예외의 범위 (D1)

이전 doctor spec(`2026-08-09-doctor-marker-description.md`) D9의 "마켓플레이스 clone `fetch`는 진단 필수 조회로 예외"에 **설치 sha 지목 fetch도 포함**한다 — 객체와 shallow root 1줄이 늘 뿐 작업 트리·ref는 불변이다. SKILL.md 핵심 원칙의 예외 문단에 이 구절을 1개 덧붙인다.

## 4. Acceptance Criteria

- **AC1**: shallow clone(tip 깊이 1)에서 tip보다 오래된 도달 가능한 설치 sha에 대해 3a 절차가 subtree id를 내고 1행이 최신/뒤처짐을 판정한다 — scratch `--depth 1` clone + `9613013` → `b0f5c02`.
- **AC2**: full clone에서는 보강 fetch가 `--depth`를 붙이지 않는다 — 실행 뒤 `git rev-parse --is-shallow-repository`가 `false` 유지. · 보강 fetch 전에 `FETCH_HEAD`에 임의 값을 기록해 두면 fetch 뒤에도 그 값이 불변이고 subtree 조회는 성공한다(shallow·full 모두).
- **AC3**: 원격에 없는 가짜 40자 sha는 상한 안에 끝나고 판정 불가 + "보강 fetch 실패(원격에 없거나 접근 오류)" + "재시도 → 반복되면 스코프 갱신" 조치로 적힌다 · origin URL을 도달 불가 경로로 바꾼 scratch clone에서도 같은 사유다("원격에 없음"으로 단정하지 않는다) · 현재 커밋의 **root tree OID**는 fetch 없이 "설치 sha 객체 유형 이상" · scratch clone에서 `dev-workflow/`를 뺀 로컬 커밋의 sha는 "설치 커밋에 dev-workflow/ 없음" · 형식이 깨진 sha(`--upload-pack=x` 등)와 **로컬에서 해석은 되는 비정상 값(`HEAD`·`FETCH_HEAD`·clone tip의 7자리 짧은 sha)**은 **subtree 조회·fetch를 실행하지 않고** "설치 sha 형식 이상"으로 적힌다 — 어느 경우도 "최신"·"뒤처짐"이 나오지 않는다((b)). 블록은 **엔트리마다 `ENTRY<TAB>sha<TAB>T<TAB>WHY` 한 줄을 출력**한다(성공·각 실패 사유 모두 — 셸 변수는 실행 뒤 사라진다).
- **AC4**: 뒤처짐 보조 근거가 `git diff --stat "$SHA" "$OID" -- dev-workflow/`이고, SKILL.md에 `log --oneline "$SHA..` 형태가 남지 않는다.
- **AC5**: 보강 fetch가 시간 초과에 걸리거나 공유 deadline(`DL`)이 소진되면 남은 엔트리는 fetch 없이 판정 불가(시간 초과)로 적히고, 각 fetch의 alarm 값이 고정 30이 아니라 **남은 시간**이다 — SKILL.md 문면 확인(재현 조작 불요, D9).
- **AC6**: 변경 파일 = doctor `SKILL.md` + 이 spec(+ 릴리스 시 plugin.json·README 규약대로).
- **AC7**(릴리스 뒤): 맥북 `/dev-workflow:doctor` 1회 — ops-hub project 엔트리가 판정 불가 대신 최신/뒤처짐으로 나온다(그 시점 설치 상태 기준). 이어서 `/plugin update` 1회가 늘어난 shallow root를 가진 clone에서 정상 동작한다(잔여 리스크 종결).

## 5. 결정사항

harden-spec 사용자 판정 2026-09-24(D1~D10). 정본은 §재논의 금지.

## 6. 미해결 질문

없음 — 초안 §6의 2건은 D2·D7로 닫혔다.

## 잔여 리스크 (DEFERRED)

- **DEFERRED(사용자 유예): 없음** — 판단 갭 10건 전건 질문·확정(D1~D10).
- **검증 필요(실측)**: shallow root가 늘어난 clone에서 이후 `/plugin update`(Claude Code의 마켓플레이스 갱신)가 정상 동작하는지 — Claude Code 내부 동작이라 repo 조회로 닫을 수 없다. AC7에서 1회 관찰로 닫는다.

## 재논의 금지(기결정)

> 표기: 접두어 없는 **D<n>은 이 트랙의 결정**이다. 이전 doctor 트랙 결정은 `doctor D<n>`으로 쓴다(`2026-08-09-doctor-marker-description.md`).

**승계 기결정 (재론 금지)** — doctor **D3**(이 머신 vs 마켓플레이스 최신만) · doctor **D5**(`dev-workflow/` subtree 비교, raw sha 비교 폐기) · doctor **D6·D11**(근거 없으면 판정 불가, version 폴백 금지) · doctor **D9**(읽기 전용 = 사용자 작업물·설정 불가침, clone fetch 예외 — 이 트랙 D1이 범위를 확장) · 네트워크 규약(`GIT_TERMINAL_PROMPT=0` · perl alarm 상한 · stderr `2>/dev/null` — doctor impl fp-7b-I7·I9) · 원격 OID 고정(fp-7b-I14) · 교훈 원칙 **L1**(실측 없이 규약을 키우지 않는다).

**이번 트랙 확정 (2026-09-24 사용자 판정)**:

| # | 결정 | 근거 |
|---|---|---|
| D1 | **설치 sha 지목 fetch를 doctor D9 예외 안에 넣는다** — 마켓플레이스 clone에 받는다(임시 clone 없음) | 진단 필수 조회이고 작업 트리·ref·사용자 설정 불변. 뒤처짐을 판정하는 유일한 경로. `/plugin update` 영향은 잔여 리스크(AC7) |
| D2 | **보강 fetch는 subtree 조회에 실패한 엔트리만** | 네트워크 호출·clone 변화 최소 |
| D3 | **sha가 `^[0-9a-f]{40}$`일 때만 fetch** — 아니면 판정 불가(설치 sha 형식 이상) | 레지스트리 값이 옵션 모양이면 git 옵션 주입 경로. 한 줄 검사로 차단 |
| D4 | **판정 불가 사유·조치를 원인별로 분리** — 시간 초과 = 재시도 / 원격에 없음·형식 이상 = 그 스코프 갱신 명령, "뒤처짐" 단정 금지 | 커밋이 사라진 경우 재시도 반복 루프 차단 |
| D5 | **보조 근거 = `git diff --stat "$SHA" "$OID" -- dev-workflow/`로 교체**(log 폐기) | shallow에서 log가 잘려 오해 유발. 트리 비교는 규칙 (a)와 같은 축. 커밋 제목 소실 수용 |
| D6 | **릴리스 = 오르카 후계 세션 트랙 task-06 종결 뒤** | AC6 증거 버전(1.0.0)·복구 patch 번호(1.0.1~)와 섞이지 않게 |
| D7 | **버전 = patch(1.0.x)** — 번호는 릴리스 시점의 다음 patch | 의도된 동작(뒤처짐 판정)의 결함 수정 |
| D8 | **경로 = 경량 — 4 수행, 5·6 생략**(6은 자동 귀결), planless(impl ledger = 이 spec 말미) | 변경이 SKILL.md 한 절·사용자 작업물·권한·데이터 비접촉. 이전 doctor 트랙과 같은 경로 |
| D9 | **검증 게이트 = scratch clone 실측(AC1~AC3) + 문면 확인(AC4·AC5) + 릴리스 뒤 맥북 doctor 1회(AC7)** — writing-skills TDD 없음 | 변경이 명령 절차라 실측이 더 직접적 |
| D10 | **보강 fetch 시간 초과 1회면 나머지 엔트리는 fetch 없이 판정 불가(시간 초과)** | 네트워크 정지 시 최악 추가 대기를 30초로 고정 — 표 4행 출력 보장(doctor 부분 실패 계속 원칙) |

**review-loop(spec) 사용자 판정 (2026-09-24 batch)** — 위 D표를 보강한다(뒤집지 않는다):

- **R1-2 → D4 보강**: 시간 초과가 아닌 보강 fetch 뒤 객체가 없으면 원인을 단정하지 않는다 — 사유 "보강 fetch 실패(원격에 없거나 접근 오류)", 조치 "재시도 → 반복되면 그 스코프 갱신". git 오류 문구 판별(버전 의존)·현행 유지(원격 부재 단정)는 기각됐다. commit은 있는데 경로가 없으면 별도 사유.
- **R2-1 → D3 보강**: 형식 검사 뒤 객체 유형이 **commit**일 때만 subtree를 조회한다(fetch 후 재확인) — 아니면 "설치 sha 객체 유형 이상". 레지스트리 손상 방어의 범위는 **형식(40자리 hex) + 객체 유형(commit)** 까지다.
- **R3-2 ACCEPTED**: 보강 fetch(`--depth 1`)가 `.git/shallow`를 갱신하므로 동시 `/plugin update`·다른 doctor와 겹치면 한쪽이 잠금 충돌로 실패할 수 있다 — 알고도 둔다. 동시 실행은 드물고, git 잠금으로 손상이 아니라 한쪽 실패로 드러나며 재실행으로 풀린다. 기존 기본 브랜치 fetch도 같은 성질이고 `/plugin update` 쪽 직렬화는 이 repo가 통제할 수 없다. 보완 = AC7 관찰. **직렬화·대기·재시도 규약 추가 요구는 재론이다.**

## 적대검증 ledger (spec)

루프 시작 2026-09-24 · base = 사용자 지정 `3fbc355`(SHA 고정) · 예산 max 5 · confirm 2 · auto 3 · 보안 크리티컬 아님(루프 자가 판정 — D8 비접촉 + 옵션 주입은 D3로 닫힘). score 산식 = critical 4 · high 3 · medium 1(§2c 분류 직후·수정 전 스냅샷, 미확인 FIXED 큐 제외).

| R | 모드 | score | 미확인 FIXED 큐 | 비고 |
|---|---|---|---|---|
| R1 | 적대(자동) | 4 (high 1·medium 1) | 0 → 1 | verdict needs-attention · 신규 2 · FIXED 1 · ESCALATE(batch-pending) 1 · 응답 수신 후 옛 세션 컨텍스트 넛지로 일시중단 → 후계 세션이 판정(수신 시점 모드 = 자동·적대) |
| R2 | 적대(자동) | 5 (high 1·medium 1 신규 + R1-2 미판정 medium 1) | 1 → 2 | 1차 실행 실패(본문 없음 — 잘린 요약 1줄만, 소진 미반영, 잡 잔존 없음, 사용자 판단으로 재실행 · 원문 `R2.out.fail1`) · 재실행 verdict needs-attention · 신규 2 · FIXED 1 · ESCALATE(batch-pending) 1 · R1-1 적대 비재출현(R2, 참고 — 큐 유지) · 신호 1 미발화(4→5, 2점뿐) |
| R3 | 적대(자동, 경계) | 6 (medium 2 신규 + 미판정 R1-2 medium 1·R2-1 high 1) | 2 → 3 | verdict needs-attention · 신규 2 · FIXED 1 · ESCALATE 1 · 큐 2건(R1-1·R2-2) 적대 비재출현(R3, 참고 — 큐 유지) · 소진 3 = auto 경계 → **batch flush**(R1-2·R2-1·R3-2 사용자 판정, 자동 수정 3건 유지) · **신호 1 발화(4→5→6)** → 확인 모드 진입 · batch 후 큐 3 → 5(R1-2·R2-1 FIXED `f5fcf2a`) |
| C1 | 확인(일반 1/2) | — | 5 → 0 | 완전 응답 · **소멸 5**(R1-1 `510001f` · R2-2 `ab85cd7` · R3-1 `eb00247` · R1-2·R2-1 `f5fcf2a`) · 회귀 없음 · 감사 해당 없음(루프 직접 판정 0) · 신규 없음 · **verdict approve** · 확인 소진 1 → **성공 종료**(미판정 0·큐 0·verdict 통과) |

**종결(2026-09-24)**: 적대 3 · 확인 1 · score 4 → 5 → 6(전환 신호 1로 확인 진입) · FIXED 5 · ACCEPTED 1(사용자) · DEFERRED_TO_IMPL 0 · OUT_OF_SCOPE 0 · DUPLICATE 0 · 남은 low 0 · merge-ready yes. 다음 = impl(경량 D8 — 5·6 생략, impl ledger = 이 문서 말미 `## 적대검증 ledger (impl)`).

| fingerprint | severity | disposition | 근거 |
|---|---|---|---|
| spec:3a · SHA 형식 검사가 revision 해석보다 늦어 `HEAD`·짧은 sha가 검사를 우회해 거짓 "최신" · 모든 rev-parse 앞에서 형식 검사 | high | FIXED `510001f` | D3 재론 아님(D3 "아니면 판정 불가"의 미구현). §3a 코드 순서 교체(형식 불일치면 rev-parse·fetch 모두 생략) + 결측 분기 선행 명시. AC3에 `HEAD`·`FETCH_HEAD`·짧은 sha 추가 |
| spec:3b · 빈 subtree 결과만으로 원격 커밋 부재를 단정 — 인증·잠금·디스크 오류·경로 부재도 "원격에 없음" · RC·commit·경로 상태 분리, 명시적 not-found 근거 있을 때만 "원격에 없음" | medium | FIXED `f5fcf2a`(사용자 판정 — batch R3) | 원인 묶기 채택(stderr 문구 판별·현행 수용 기각). §3a `WHY` 분기 · §3b 사유표 5행(보강 fetch 실패 = 재시도 → 반복 시 갱신, 경로 부재 별도) · AC3 가짜 sha·도달 불가 origin·경로 없는 로컬 커밋. 실측: scratch shallow clone에서 전 사례 기대 사유 |
| spec:3a · 40자리 tree OID가 설치 commit으로 오인되어 거짓 "최신" · 형식 검사 뒤 `cat-file -t`가 commit인지 확인(fetch 후 재확인), 아니면 "설치 sha 객체 유형 이상" | high | FIXED `f5fcf2a`(사용자 판정 — batch R3) | R1-1과 같은 계열 2회째 → 사용자가 객체 유형 검사 채택(방어 범위 = 형식 + commit 유형, 재논의 금지 블록). §3a `cat-file -t` = commit일 때만 조회(fetch 후 재확인) · AC3 root tree OID. 실측: tree OID → "설치 sha 객체 유형 이상" |
| spec:3a · 보강 fetch가 FETCH_HEAD를 덮어써 공유 clone의 동시 작업 교란 · `--no-write-fetch-head` + FETCH_HEAD 불변 AC | medium | FIXED `ab85cd7` | D1 재론 아님(pseudo-ref 쓰기만 제거). §3a 코드·불릿 교체, AC2에 FETCH_HEAD 불변 검증. 실측: git 2.54 scratch shallow clone에서 FETCH_HEAD 불변 + subtree 조회 성공 |
| spec:3a · 30초 총 대기 상한이 실제로는 엔트리마다 반복 · 보강 전체 공유 deadline, 각 fetch엔 남은 시간만 | medium | FIXED `eb00247` | D10 재론 아님(D10 "최악 추가 대기 30초 고정"의 미구현). §3a `DL` 공유 deadline + alarm "$LEFT" · AC5 남은 시간 alarm 문면 |
| spec:3a · FETCH_HEAD 보호만으로 공유 shallow clone 동시 fetch가 안전하지 않음(`.git/shallow` 쓰기 경쟁) · 직렬화·대기·재시도 규약 + 동시 실행 AC | medium | ACCEPTED(사용자 판정 — batch R3) | R2-2와 같은 "공유 clone 동시 fetch" 계열 2회째. 이유: 동시 실행 드묾 · git 잠금으로 손상 아닌 한쪽 실패 · 재실행으로 해소 · 기존 기본 브랜치 fetch도 동일 · `/plugin update` 쪽 직렬화 통제 불가. 보완 단계 = AC7 관찰(재논의 금지 블록 등재) |

## 적대검증 ledger (impl)

루프 시작 2026-09-24 · base = spec 종결 `99b59be`(SHA 고정) · 예산 max 5 · confirm 2 · auto 3 · 보안 크리티컬 아님. 게이트 = D9(npm 없음 — scratch GitHub shallow·full clone에서 SKILL.md 블록 그대로 실행한 AC1~AC3 + 문면 AC4~AC6). score 산식 = spec ledger와 같음.

| R | 모드 | score | 미확인 FIXED 큐 | 비고 |
|---|---|---|---|---|
| R1 | 적대(자동) | 3 (high 1) | 0 → 1 | verdict needs-attention · 신규 1 · FIXED 1 |

| fingerprint | severity | disposition | 근거 |
|---|---|---|---|
| impl:SKILL.md 점검 2 · 엔트리별 판정 결과(T·WHY)가 셸 밖으로 출력되지 않음 · 엔트리마다 sha/T/WHY 한 줄 출력 + AC | high | FIXED `0d042e7` | 블록 끝 `printf 'ENTRY\t…'` + 판정은 그 줄로 한다는 문단(SKILL.md) · spec §3a 동일 + AC3에 출력 요구. 실측: 성공 2·실패 5사유·시간 초과(DL 강제 소진) 전부 1줄 |
