# task-06 — AC6 실사용 확인 기록 (트랙 완료 조건, F6 · D11)

**목적**(릴리스·push·spark2 설치 갱신 뒤 — SDD 범위 밖): **릴리스된 최신 1.0.x 설치본**(최소 1.0.0 — 복구 절차 뒤에는 그 patch)으로 spark2 오르카 터미널에서 실제 트랙 세션 1회를 관찰해 엔트리포인트 `## AC6 실사용 확인 (트랙 완료 조건, D11)` 표 11행의 관찰·결과 열을 채우고, eval 보고서에 부기한다. task-05가 만든 **빈 표·절차**가 입력이다. **이 task의 완료 커밋 = 트랙 완료**(dev-cycle 9단계 완료 신호, D11). task-05는 릴리스 커밋으로 완료되고 AC6 증거는 여기서만 닫힌다(plan R3-3).

## Files

- Modify: `docs/plans/2026-09-24-orca-successor-session.md` — `## AC6 실사용 확인` 표의 관찰(명령 출력·시각)·결과 열 11행 + 폴백 발생 시 비고 줄
- Modify(repo 밖, eval repo 별도 커밋): `~/workspace/dev-workflow-eval/report/ORCA-SUCCESSOR-2026-09-24.md` §미측정 — 파일럿 미측정 3건(§0 재개 · 실 흐름 · 진행 중 넛지) 결과 부기
- Test: 없음 — 실측 기록 자체가 산출물(AC는 표 검사)

## Prep

- 엔트리포인트 SC-7 · task-05 단계 3의 절 원문(조건 ①②③ · 표 11행 · 통과 규칙) · spec F6·AC6·D11 · spec 잔여 리스크(검증 필요 3건 — 이 세션에서 관찰 대상).
- 사전 조건 확인: 1.0.0 push 완료 · spark2에서 `/plugin update dev-workflow@claude-dev-workflow` → 재시작 → `/dev-workflow:doctor`가 설치본 버전(1.0.0 또는 그 뒤 patch)을 보고 — **그 값을 AC6 절 상단 `**설치 버전**:` 줄에 적는다**(표·eval·커밋 문구의 버전도 이 값) · `orca terminal list --worktree active --json` 동작(맥북 오르카 클라이언트 접속 중).

## Deps

task-05(릴리스 커밋) + push(사용자 판단) + **spark2만** 설치 갱신(OMEN·그램 갱신은 이 task 통과 **뒤** — plan R4-2; 맥북은 1회차에서 이미 갱신) (2회차 머신 = spark2 — 사용자 판정 A 2026-09-24: 실제 작업이 spark2에 몰려 있어 "맥북 먼저" 게이트를 "spark2 먼저"로 바꿨다. 1회차는 맥북 1.0.0). **SDD 디스패치 대상 아님** — 9단계 이후 이 파일을 단독 실행한다(엔트리포인트 "SDD 실행 범위 = task-01~04").

## Steps

### 1. 관찰 세션 준비 (조건 ①②③을 한 세션에 싣는다)

```bash
orca terminal create --worktree active --title "ac6-old" --command "CLAUDE_CTX_THRESHOLD=0.05 claude" --json   # 임계를 낮춰 재현(spec §6)
```
- 다른 탭을 **활성**으로 둔다(조건 ① — 후계 첫 동작이 옛 핸들만 닫는지, R2-1).
- 그 세션에서 **실제 트랙**의 review-loop를 시작한다 — 대상 = 그 시점에 착수하는 다른 실제 트랙(이 트랙의 종결 ledger 재사용 금지; 후보·기록 필드는 task-05 절 원문 조건 ③, plan R4-3). §0~§2b가 한 턴 안에서 라운드 기동까지 가고 백그라운드 대기로 턴이 끝나는 Stop이 첫 넛지가 되도록(조건 ③ — 11행). 작업명은 메타문자를 섞어 짓는다(조건 ② — 2·10행, 기대값은 task-05 절 원문). 9행 관찰 열에 repo · phase · ledger 문서 · base SHA · 루프 파일 경로를 적는다.

### 2. 관찰·기록

- 넛지 → 핸드오프 → 후계 스폰 → 옛 세션 종료(SessionEnd 정리) → 후계 §0 재개까지 지켜보며 표 11행의 **관찰 열**(명령 출력 요지·시각)과 **결과 열**(`통과` / `실패`)을 채운다. 결과 열은 이 두 값만 쓰고, 셀 안에 세로줄(`|`)을 쓰지 않는다(AC가 `|`로 열을 센다 — 명령 출력의 `||`는 `…`로). 11행 관찰 = 루프 파일 `## 미해결 ledger`의 미판정 기록 + `## 다음 액션`의 수신 라운드·모드(§2i).
- 폴백이 발생한 행은 `실패`로 적고 원인·정리 결과(반쪽 터미널 소멸 확인)를 표 아래 비고 줄에 남긴다 — 통과로 세지 않는다(SC-7).
- 11행이 "넛지 시점에 라운드 진행 중이 아니었음"이면 그 세션은 무효 — 임계를 올려(예: 0.1) 단계 1부터 다시 한다. "미발생"은 쓰지 않는다(plan R1-3).
- 어느 행이든 `실패`면 **복구 절차**(plan R5-3): 원인 수정 → review-loop(impl) 재진입(impl ledger에 라운드 추가) → patch 버전 bump(`release: 1.0.1 — …`, 이후 1.0.2 …)·push(사용자) → spark2 `/plugin update` → 재시작 → 단계 1부터 AC6 재실행. 표는 마지막 회차로 덮어쓰고 이전 회차는 비고에 요약, `**설치 버전**:`은 재실행한 patch로 갱신.

### 3. eval 보고서 부기 + 커밋

```bash
grep -n '미측정' ~/workspace/dev-workflow-eval/report/ORCA-SUCCESSOR-2026-09-24.md | head        # 부기 위치
# §미측정 아래에 "AC6 실측(YYYY-MM-DD, <설치 버전> 설치본)" 소절 — <설치 버전> = AC6 절 상단 `**설치 버전**:` 줄의 값(예 1.0.0, 복구 뒤엔 1.0.1) — 3건(§0 재개 · 실 흐름 · 진행 중 넛지) 결과 + plan 엔트리포인트 표 참조. eval repo에서 별도 커밋. 표·eval·커밋 세 곳의 버전이 같아야 한다(AC가 대조).
git add docs/plans/2026-09-24-orca-successor-session.md
git commit -m "docs(plan): AC6 실사용 확인 기록 — spark2 오르카 <설치 버전> 설치본 실측 11행 통과 (트랙 완료, D11)"   # <설치 버전> = 절 상단 설치 버전 줄의 값
git log -1 --format=%B | grep -ciE '^(co-authored-by|claude-session): |generated with \[claude code\]\('   # 0
```

## Acceptance Criteria

```bash
P=docs/plans/2026-09-24-orca-successor-session.md
awk '/^## AC6 실사용 확인/{f=1;next} /^## /{f=0} f' $P | grep -E '^\| [0-9]+ \|' | LC_ALL=C awk -F'|' '{gsub(/^ +| +$/,"",$5); gsub(/^ +| +$/,"",$6); if ($5 != "" && $6 == "통과") n++} END {print n+0}'   # 11 — 관찰 열 비어 있지 않고 결과 열 = 통과, 11행 전부(빈 표·부분 기록·실패 행이 있으면 < 11). LC_ALL=C 필수: macOS BSD awk는 == 비교에 locale collation을 써서 "실패"=="통과"가 참이 된다(실측 awk 20200816, plan L1)
awk '/^## AC6 실사용 확인/{f=1;next} /^## /{f=0} f' $P | grep -E '^\| [0-9]+ \|' | wc -l | tr -d ' '   # 11 (행 수 불변)
awk '/^## AC6 실사용 확인/{f=1;next} /^## /{f=0} f' $P | grep -cE '^\*\*설치 버전\*\*: 1\.0\.[0-9]+$'   # 1 (실제 설치 버전 기록 — 자리표시자 `<…>`면 0)
awk '/^## AC6 실사용 확인/{f=1;next} /^## /{f=0} f' $P | grep -E '^\| [0-9]+ \|' | LC_ALL=C awk -F'|' 'NF != 7' | wc -l | tr -d ' '   # 0 (모든 행이 5열 — 셀 안 `|`로 열이 밀린 행 없음, plan L1)
V=$(awk '/^## AC6 실사용 확인/{f=1;next} /^## /{f=0} f' $P | grep -oE '^\*\*설치 버전\*\*: 1\.0\.[0-9]+$' | sed 's/.*: //'); echo "V=$V"; grep -c "AC6 실측([0-9-]*, $V 설치본)" ~/workspace/dev-workflow-eval/report/ORCA-SUCCESSOR-2026-09-24.md   # ≥ 1 (eval 부기 소절의 버전 = AC6 절 설치 버전 — V가 비면 0, 다른 버전이면 0)
git -C ~/workspace/dev-workflow-eval log --oneline -1 -- report/ORCA-SUCCESSOR-2026-09-24.md            # 부기 커밋 1줄(이 task 시점 이후)
V=$(awk '/^## AC6 실사용 확인/{f=1;next} /^## /{f=0} f' $P | grep -oE '^\*\*설치 버전\*\*: 1\.0\.[0-9]+$' | sed 's/.*: //'); git log -1 --format=%s | grep -cF "AC6 실사용 확인 기록 — spark2 오르카 $V 설치본"   # 1 (커밋 제목의 버전 = 표 버전 — 자리표시자 미치환·다른 버전이면 0)
git status --short | grep -v '^??' | wc -l                                                              # 0
```

## Cautions

- **수동 선적용(로컬 파일 교체) 세션으로 채우지 않는다 — 릴리스된 설치본만(1.0.0 또는 복구 절차의 patch). 이유: D11·SC-7 — 설치 경로(`/plugin update` → 재시작)까지 검증 대상이다. 증거 버전은 `**설치 버전**:` 줄·커밋 문구에 실제 값으로 적는다(plan R5-3).**
- **폴백이 난 회차를 통과로 세지 않는다. 이유: SC-7 — 폴백 관찰은 비고 줄, 표는 정상 인계 1회의 기록이다.**
- **표 셀 안에 세로줄(`|`)을 쓰지 않는다(명령 출력의 `||`는 `…`로 줄인다). 이유: plan L1 — AC가 `|`로 열을 세므로 한 행이라도 열이 밀리면 통과 수가 줄어 미완료로 판정된다.**
- **AC의 `LC_ALL=C awk`에서 `LC_ALL=C`를 빼지 않는다. 이유: plan L1 — macOS BSD awk(20200816)는 문자열 `==`에 locale collation을 써서 한글 `"실패" == "통과"`가 참이 된다(실측). 빼면 실패 행이 통과로 세어져 빈 증거로 완료가 된다.**
- **eval 부기 소절 제목의 버전을 `1.0.0`으로 고정해 쓰지 않는다 — `**설치 버전**:` 줄의 값과 같아야 한다. 이유: plan C2 잔존 R5-3 — 복구 절차로 patch를 재검증한 회차에 eval만 1.0.0으로 적히면 증거 버전이 갈리고, AC가 그 대조로 막는다.**
- **결과 열에 `통과`/`실패` 외 표현("OK", "미발생", "해당 없음")을 쓰지 않는다. 이유: AC가 문자열 `통과`를 세어 11이어야 완료다 — 다른 표기는 미완료로 판정된다.**
- **11행을 "미발생"으로 넘기지 않는다. 이유: plan R1-3 — spec F6 파일럿 미측정 3건은 9·11행이 닫는다.**
- **엔트리포인트 task 표의 이 행을 표가 채워지기 전에 `[x]`로 바꾸지 않는다. 이유: plan R3-3 — 완료 기록 계약(Execution contract ④)의 권위가 이 표라, 빈 증거로 `[x]`가 되면 트랙이 완료된 것으로 복구된다.**
- **완료 기록 = 표 06행 `[x]`·outcome + 이 파일 커밋(단계 3 커밋에 함께). SDD progress ledger에는 쓰지 않고, task-05 행을 되돌리지 않는다. 이유: plan C1 재분류 R3-3 — SDD 밖 task의 완료 권위는 커밋된 표 + 이 AC다.**
- **Windows를 여기서 확인하지 않는다(spark2는 2회차 대상 — 사용자 판정 A). 이유: 트랙 밖(D11 후속 — 각 머신 첫 넛지 때). "3머신" 표현 금지(0.18.0 D28).**
