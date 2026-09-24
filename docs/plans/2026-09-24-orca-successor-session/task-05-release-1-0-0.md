# task-05 — 릴리스 1.0.0 + 설치 갱신 안내(4머신) + AC6 실사용 기록 절 (F4·F6, D11)

**목적**(9단계 — **review-loop(impl) 성공 종료 뒤** 단독 실행, SDD 범위 밖): `plugin.json`을 1.0.0으로 올려 릴리스 커밋을 만들고, 트랙 전체 커밋의 no-AI-trace를 확인하고, 4머신 설치 갱신 안내와 **트랙 완료 조건 AC6**(맥북 오르카 실사용 1회)의 **빈 표·절차 절**을 엔트리포인트에 남긴다. 표를 채우는 것은 task-06이다 — 이 task는 릴리스 커밋으로 완료되고 트랙 완료는 task-06 커밋이다(plan R3-3). push는 사용자 판단(트랙 내내 미push 관례).

## Files

- Modify: `dev-workflow/.claude-plugin/plugin.json` — `"version": "0.19.0"` → `"1.0.0"`
- Modify: `docs/plans/2026-09-24-orca-successor-session.md` — 말미에 `## AC6 실사용 확인 (트랙 완료 조건, D11)` 절 추가(`## 훅 테스트 기록` 절과 review-loop ledger 절들 **뒤**)
- Test: 없음(grep AC4 + 릴리스 후 AC6 실측)

## Prep

- spec §3 F4(릴리스 1.0.0·4머신)·F6(실사용 조건: 다른 탭 활성 · 메타문자 제목·경로 · 미측정 3건), §5 AC4·AC6, §4 D11, §6(`CLAUDE_CTX_THRESHOLD`를 낮춰 재현), 잔여 리스크(spark2·Windows · 첫 동작 건너뜀 · send 뒤 `/exit` 경쟁). 엔트리포인트 SC-7·SC-8. 이전 릴리스 커밋 형식: `git log --oneline | grep '^[0-9a-f]* release:' | head -3`.
- 실측 보고서: `~/workspace/dev-workflow-eval/report/ORCA-SUCCESSOR-2026-09-24.md` §미측정.

## Deps

task-04(task-02·03·04 문면 전부 커밋된 뒤) **+ 8단계 review-loop(impl) 성공 종료** — 엔트리포인트 말미에 `## 적대검증 ledger (impl)` 절과 그 종결 기록(verdict 통과)이 커밋돼 있어야 한다. 이 task는 SDD 실행 범위(task-01~04) 밖의 9단계다: SDD가 task-04까지 끝내고 review-loop(impl)가 종결된 뒤 그 세션(또는 새 세션)이 이 파일을 단독으로 실행한다. impl 검토 전에 1.0.0 커밋을 만들지 않는다(plan R2-1).

## Steps

### 1. 선점 재확인 + 버전 bump

```bash
git status --short | grep -v '^??' | wc -l                          # 0 — clean에서 시작
grep -n '"version"' dev-workflow/.claude-plugin/plugin.json          # "0.19.0"
git log --oneline | grep -c 'release: 1.0.0'                         # 0 — 선점 없음
grep -c '^## 적대검증 ledger (impl)' docs/plans/2026-09-24-orca-successor-session.md   # 1 — review-loop(impl) 절 존재(없으면 멈춘다: 8단계 미종결)
awk '/^## 적대검증 ledger \(impl\)/{f=1;next} /^## /{f=0} f' docs/plans/2026-09-24-orca-successor-session.md | grep -E '^\*\*종결\(' | grep '미확인 FIXED 큐 0' | grep '미판정 blocking 0' | grep -cE 'verdict approve|빠른 종료'   # 1 — impl ledger 절 범위 안의 종결 행이 성공 불변식 3종을 모두 담는다. 형식은 엔트리포인트 상단 "impl ledger 종결 행 계약"이 생산자(review-loop(impl) §4 종료 요약)에 요구한다: `**종결(날짜)**: … 미확인 FIXED 큐 0 · 미판정 blocking 0 · 최종 verdict approve`(빠른 종료면 `빠른 종료`). 0이면 8단계 미종결이거나 종결 행이 계약 형식이 아님 — 둘 다 멈춘다(형식 불일치면 impl ledger 종결 행을 계약대로 고친 뒤 재검사)
sed -i '' 's/"version": "0.19.0"/"version": "1.0.0"/' dev-workflow/.claude-plugin/plugin.json    # Linux: sed -i
grep -n '"version"' dev-workflow/.claude-plugin/plugin.json          # "1.0.0"
node -e 'JSON.parse(require("fs").readFileSync("dev-workflow/.claude-plugin/plugin.json","utf8")); console.log("json ok")'
```

### 2. 트랙 전체 no-AI-trace + AC4 대조

```bash
BASE=$(git log --format=%H --grep='ledger(spec) C3 기록·종결' -1)   # spec 종결 커밋(92e1374) = plan 착수 직전
git log --format=%B $BASE..HEAD | grep -ciE '^(co-authored-by|claude-session): |generated with \[claude code\]\('   # 0 — 트레일러 실형(행 머리 `Key: `·링크형 푸터)만. 규칙 언급(백틱 인용)은 대상 아님
git diff --name-only $BASE..HEAD | xargs grep -nE '^(Co-Authored-By|Claude-Session): |Generated with \[Claude Code\]\(' 2>/dev/null   # 빈 출력
for f in README.md README.ko.md README.ja.md; do grep -c 'ORCA_TERMINAL_HANDLE' $f; done   # 각 1 (AC4 — task-04)
```

### 3. 엔트리포인트에 AC6 절 추가

`docs/plans/2026-09-24-orca-successor-session.md` 말미(`## 훅 테스트 기록 (AC5, D5)` · review-loop가 만든 `## 적대검증 ledger (plan)`·`(impl)` 절 **뒤** — Deps에 따라 이 시점에 셋 다 존재한다)에 추가:
```markdown
## AC6 실사용 확인 (트랙 완료 조건, D11) — 릴리스 후 맥북 오르카 세션이 기록

**대상** = 릴리스된 최신 1.0.x **설치본**(최소 1.0.0 — AC6 실패 복구 뒤에는 그 patch, task-06 복구 절차)으로 오르카 터미널에서 도는 **실제 트랙**의 세션 1회(수동 선적용 아님). 넛지 → 핸드오프 → 후계 스폰 → 옛 세션 종료(SessionEnd 정리) → 후계가 review-loop §0 스냅샷 대조로 재개. `CLAUDE_CTX_THRESHOLD`를 낮춰 재현한다(예: `orca terminal create --worktree active --title "ac6-old" --command "CLAUDE_CTX_THRESHOLD=0.05 claude" --json`) — 실 40%까지 기다릴 필요 없다(spec §6).

**설치 버전**: <task-06이 맥북 `/dev-workflow:doctor` 출력의 설치본 버전으로 채운다 — 예 `1.0.0`>

**조건**(F6): ① 넛지 시점에 **다른 탭이 활성**인 상태(후계의 첫 동작이 옛 핸들만 닫는지, R2-1) ② 메타문자 케이스 2종 — (제목, R3-1) 작업명 후보 `ac6 $(echo x) \`id\`` → 제목이 `ac6---echo-x---id--<토큰>`으로 정규화되는지(집합 밖 문자 8개 — 공백·`$`·`(`·공백·`)`·공백·백틱·백틱 — 가 각각 `-` 하나로 치환되고 토큰 앞 하이픈이 붙는다). (전달, R2-2) 재개 프롬프트 **템플릿 자체**가 셸 메타문자를 담고 있다 — CLI 해소식 `$( [ -n "$ORCA_DEV_REPO_ROOT" ] && echo orca-dev || echo orca )`와 companion 해소식 `$(node -e '…' "$P" "$PWD")`. 후계가 받은 프롬프트(`"$CLI" terminal read --terminal "<새 핸들>" --json` 또는 후계 화면)에 이 식들이 **확장되지 않은 원문 그대로**(`CLI="orca"`·경로값으로 바뀐 흔적 없음) 있는지 본다. `<경로>` 슬롯은 review-loop 트랙에서 루프 파일 경로로 고정이라 메타문자를 넣을 수 없다 — 템플릿 내장 식이 spec F6 "경로" 프로브를 대신한다. ③ **필수** — codex 라운드(review-loop 백그라운드 대기) 또는 서브에이전트가 진행 중일 때 넛지가 오면 완료 알림까지 새 단위 없이 기다렸다가 결과 기록 → 스폰 순서를 지키는지(§2i 진행 중 라운드 분기, 파일럿 미측정 3). 재현: 옛 세션을 `CLAUDE_CTX_THRESHOLD=0.05`로 띄우고 review-loop를 시작하면 §0~§2b가 한 턴 안에서 라운드 기동까지 가고 §2b ③ 백그라운드 대기로 턴이 끝나는 그 Stop이 첫 넛지다(통상 경로). 넛지가 라운드 진행 중이 아닌 턴에서 먼저 왔으면 그 세션은 ③ 미충족 — 임계를 올려(예: 0.1) 다시 시작한다. "미발생"으로 넘기지 않는다. **review-loop 대상**(plan R4-3): 이 트랙은 그 시점에 종결돼 있으므로 이 트랙의 plan/impl ledger에 라운드를 추가하지 않는다 — AC6의 루프는 그 시점에 착수하는 **다른 실제 트랙**(후보: 0.18.0 트랙 AC11 실측 후속 · ops-hub 등 다음 작업)의 phase 산출물 문서에서 §0 "loop 파일 없음 → 새 루프"로 연다. 대상은 지금 확정할 수 없다(실사용 조건 D11이 실제 트랙을 요구) — 대신 9행 관찰 열에 repo · phase · ledger 문서 경로 · 해소된 base SHA · 루프 파일 경로(`.remember/loop-<ledger basename>-<phase>.md`)를 적어 재현을 결정적으로 만든다.

| # | 관찰 항목 | 기대 | 관찰(명령 출력·시각) | 결과 |
|---|---|---|---|---|
| 1 | (2-0) 사전 검증·게이트 | `terminal show` ok:true · `GATE_OFF FOREIGN_ACTIVE=0` | | |
| 2 | (2-1) 제목 정규화·토큰 | 제목 `[A-Za-z0-9._-]`만, ≤40, 끝 토큰 온전 · `terminal list` title 정확 1건 | | |
| 3 | (2-2) 기동 대기 | `result.wait.satisfied: true` (90s 이내) | | |
| 4 | (2-3) 전달 | `result.send.prompt.stages`에 `turn_started` · `--retry-request` 사용 여부 | | |
| 5 | (2-5) 옛 세션 정지 | send 뒤 옛 세션 추가 턴 0(재넛지 없음 — `stop_hook_active` 통과) | | |
| 6 | 후계 0번째 동작 | `FOREIGN_ACTIVE=0` 확인 후 진행(대기 발생 시 횟수) | | |
| 7 | 후계 첫 동작 — 옛 핸들만 | `/exit` accepted → `--for exit` satisfied, 또는 시간 초과(보통) 뒤 `terminal read` 끝줄에 종료 표지 `Resume this session with`와 셸 프롬프트 둘 다 — **표지 출력 여부를 관찰 열에 기록**(빈 세션은 표지 없음이 실측, 대화가 있는 세션은 미관찰 — impl 이월 F6) → close ok → list에 옛 핸들 없음 · **활성 탭·다른 탭 무사** | | |
| 8 | SessionEnd 정리 | 옛 세션 codex 상태 디렉터리: `broker.json` 소멸 · 옛 세션 잡 0(파일럿 E5와 동일) | | |
| 9 | §0 대조·라운드 이어감 | 후계가 `/review-loop --resume`(또는 핸드오프)로 §0 스냅샷 통과 · 다음 단위 시작 · 단계 경계면 사용자 확인(D4). 관찰 열에 대상 트랙의 repo · phase · ledger 문서 · base SHA · 루프 파일 경로 기록(이 트랙 ledger 재사용 아님) | | |
| 10 | 메타문자 원문 전달 | 후계가 받은 프롬프트에 CLI 해소식 `$( [ -n "$ORCA_DEV_REPO_ROOT" ] && echo orca-dev … )`(원문은 조건 ② — 셀 안에 세로줄을 쓰지 않는다)·`$(node -e` 원문 그대로 · `CLI="orca"` 등으로 확장된 흔적 없음 · 옛 세션 로컬 실행 흔적 없음 | | |
| 11 | codex 라운드/서브에이전트 진행 중 넛지 (**필수**) | 라운드 진행 중 Stop에서 넛지 → 완료 알림까지 새 단위 없음 → 응답 결과를 루프 파일 `## 미해결 ledger`에 미판정으로, `## 다음 액션`에 수신 라운드 번호·판정 정책(수신 시점 모드)·미처리 단계를 기록 → 스폰(§2i 진행 중 라운드 분기) | | |

- 통과 = 1~11 전부 기대와 일치(11 포함 — 파일럿 미측정 3건은 9·11행이 닫는다, "미발생" 불허). 표 셀 안에 세로줄(`|`)을 쓰지 않는다 — task-06 AC가 `|`로 열을 센다(plan L1). 어느 행이든 폴백이 발생했으면 그 원인·정리 결과(반쪽 터미널 소멸 확인)를 관찰 열에 적고 **통과로 세지 않는다** — 폴백 경로 관찰은 별도 줄(비고)로 남긴다.
- 채워진 뒤 `~/workspace/dev-workflow-eval/report/ORCA-SUCCESSOR-2026-09-24.md` §미측정에 결과를 부기한다(파일럿 미측정 3건 종결 — eval repo 별도 커밋).
- 채우는 절차·주체 = **task-06**(맥북에서 그 세션을 관찰한 사람/후계 세션 — 이 파일 커밋). task-06의 통과 커밋이 **트랙 완료**(dev-cycle 9단계 완료 신호). 결과 열은 `통과`/`실패`만(task-06 AC가 센다).
- spark2·Windows는 트랙 밖(D11 후속) — 각 머신 첫 넛지 때 1·3·4행(`ORCA_TERMINAL_HANDLE` 존재 · `orca`/`ORCA_CLI_COMMAND` 해소 · `--wait-submit` 지원)만 확인하고 실패 시 폴백으로 현행 동작임을 기록한다.

**설치 갱신(4머신) — 순서가 게이트다(plan R4-2)**: ① push(사용자 판단) → ② **맥북만** `/plugin update dev-workflow@claude-dev-workflow` → 재시작 → `/dev-workflow:doctor`(설치본 1.0.0) → ③ task-06(AC6 실사용 확인) 통과 → ④ 나머지 3머신(OMEN `D:\workspace` · 그램 `C:\workspace` · spark2 `~/workspace`) 같은 절차로 갱신. AC6가 실패하면 task-06 복구 절차(원인 수정 → review-loop(impl) 재진입 → patch bump·push → 맥북 갱신 → AC6 재실행; 증거 버전 = 그 patch) → 그 뒤 3머신. project 스코프로 고정된 repo(ops-hub 등)는 그 repo 안에서 `claude plugin update dev-workflow@claude-dev-workflow --scope project`.
```

### 4. 릴리스 커밋

```bash
git add dev-workflow/.claude-plugin/plugin.json docs/plans/2026-09-24-orca-successor-session.md
git commit -m "release: 1.0.0 — 오르카 터미널 후계 세션 자동 인계: Stop 훅 넛지 (2)가 같은 체크아웃에 후계 claude를 띄우고 정지(사전 검증·review gate·토큰 제목·프롬프트 파일·turn_started), 후계 첫 동작 = 옛 세션 /exit→--for exit→close, 실패 시 /clear 안내 폴백; review-loop §2i 경로 ① 조건화; README 3종"
git log -1 --format=%B | grep -ciE '^(co-authored-by|claude-session): |generated with \[claude code\]\('   # 0
```

### 5. 설치 갱신 안내(사용자에게 출력하는 문안 — 4머신)

```
1.0.0 릴리스 커밋이 로컬 main에 있습니다(미push — push는 사용자 판단). 배포 순서 = 게이트:
  ① push → ② 맥북만: /plugin update dev-workflow@claude-dev-workflow → 재시작 → /dev-workflow:doctor (설치본 1.0.0)
  → ③ task-06 AC6 통과 → ④ 나머지 3머신(OMEN D:\workspace · 그램 C:\workspace · spark2 ~/workspace) 같은 절차. AC6 실패면 task-06 복구 절차(수정 → impl 재검토 → patch bump·push → 맥북 갱신 → 재실행) 뒤 3머신.
project 스코프 repo는 그 안에서 --scope project.
트랙 완료 조건(AC6): 맥북 오르카에서 1.0.0 설치본으로 실제 트랙 세션 1회 — CLAUDE_CTX_THRESHOLD를 낮춰 넛지 → 후계 스폰 → 옛 세션 /exit→close → §0 재개. 다른 탭을 활성으로 두고, 작업명에 백틱·$(…)·공백을 섞고, review-loop 라운드가 백그라운드로 도는 중에 넛지가 오게 해서(11행 필수). plan 엔트리포인트 §AC6 표 11행 기록 → eval 보고서 ORCA-SUCCESSOR-2026-09-24.md 부기 = task-06(그 커밋이 트랙 완료).
spark2·Windows는 트랙 밖(D11) — 각 머신 첫 넛지 때 확인, 실패 시 폴백으로 현행 동작.
```

## Acceptance Criteria

```bash
grep -c '"version": "1.0.0"' dev-workflow/.claude-plugin/plugin.json        # 1  (AC4)
git log -1 --format=%s | grep -c '^release: 1.0.0'                          # 1
grep -c '^## AC6 실사용 확인' docs/plans/2026-09-24-orca-successor-session.md   # 1
awk '/^## AC6 실사용 확인/{f=1;next} /^## /{f=0} f' docs/plans/2026-09-24-orca-successor-session.md | grep -E '^\| [0-9]+ \|' | cut -d'|' -f2 | tr -d ' ' | paste -sd, -   # 1,2,3,4,5,6,7,8,9,10,11 (AC6 절 범위만 — task 표 행을 세지 않는다, 정확히 11행)
for m in 맥북 OMEN 그램 spark2; do grep -q "$m" docs/plans/2026-09-24-orca-successor-session.md && echo "$m OK" || echo "$m MISSING"; done   # 4줄 전부 OK (머신별 개별 검사)
grep -c '^## 적대검증 ledger (impl)' docs/plans/2026-09-24-orca-successor-session.md   # 1 (impl 검토 뒤 릴리스 — Deps)
awk '/^## 적대검증 ledger \(impl\)/{f=1;next} /^## /{f=0} f' docs/plans/2026-09-24-orca-successor-session.md | grep -E '^\*\*종결\(' | grep '미확인 FIXED 큐 0' | grep '미판정 blocking 0' | grep -cE 'verdict approve|빠른 종료'   # 1 (성공 종료 불변식 3종 — 단계 1과 같은 검사)
BASE=$(git log --format=%H --grep='ledger(spec) C3 기록·종결' -1); git log --format=%B $BASE..HEAD | grep -ciE '^(co-authored-by|claude-session): |generated with \[claude code\]\('   # 0
git status --short | grep -v '^??' | wc -l                                  # 0
```

## Cautions

- **review-loop(impl) 성공 종료 전에 이 task를 실행하지 않는다 — SDD가 task-04 직후 표의 deps만 보고 디스패치해도 거부한다. 이유: plan R2-1 — 엔트리포인트 순서 7 impl → 8 review-loop(impl) → 9 릴리스. 검토 전 1.0.0 커밋은 검토 결과로 다시 바뀔 수 있는 버전을 릴리스로 못 박는다.**
- **완료 기록 = 엔트리포인트 task 표 05행 `[x]`·outcome + 그 파일 커밋(단계 4 릴리스 커밋에 함께 실어도 된다). SDD progress ledger에는 쓰지 않는다. 이유: plan C1 재분류 R3-3 — 이 task는 SDD 밖이라 convergence 규칙의 대상이 아니고, 완료 권위는 커밋된 표 + 이 AC다.**
- **push하지 않는다. 이유: 이 트랙은 spec부터 미push로 진행했고 push 시점은 사용자 판단이다.**
- **AC6 표를 여기서 채우지 않는다(채우기 = task-06). 이유: 릴리스 후 1.0.0 설치본으로 실제 트랙 세션에서 관찰한 값만 근거다 — 빈 표 + 절차가 이 task의 산출물이고, 이 task의 `[x]`는 AC6 완료를 뜻하지 않는다(task 표 06행이 따로 있다, plan R3-3).**
- **AC6 통과 전 "트랙 완료"를 선언하지 않는다. 이유: D11 — 맥북 실사용 1회가 완료 조건. 9단계 완료 신호는 AC6 표가 채워진 커밋이다.**
- **plugin.json 외 marketplace.json·description·keywords를 손대지 않는다. 이유: 릴리스 표면은 version bump + README(task-04)만(spec §2 F4).**
- **버전을 0.20.0으로 낮추지 않는다. 이유: 사용자 결정(2026-09-24) — 이 반영으로 정식 1.0.0.**
- **"3머신" 표현을 어디에도 쓰지 않는다. 이유: 0.18.0 D28 — spark2 포함 4머신.**
