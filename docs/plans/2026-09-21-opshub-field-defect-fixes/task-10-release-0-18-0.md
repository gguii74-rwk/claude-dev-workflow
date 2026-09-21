# task-10 — 릴리스 0.18.0 + 설치 갱신 안내(4머신) + AC11 기록 지침 (D36·D37)

**목적**: plugin.json을 0.18.0으로 올려 릴리스 커밋을 만들고, 트랙 전체 커밋의 no-AI-trace를 확인하고, 4머신 설치 갱신 안내와 **트랙 완료 조건 AC11**(Windows 1루프 + spark2 1루프 실사용 확인)의 기록 지침을 남긴다. push는 사용자 판단(트랙 내내 미push 관례).

## Files

- Modify: `dev-workflow/.claude-plugin/plugin.json` — `"version": "0.17.0"` → `"0.18.0"`
- Modify: `docs/plans/2026-09-21-opshub-field-defect-fixes.md` — 말미에 `## AC11 실사용 확인 (트랙 완료 조건)` 절 추가(impl ledger 절 **앞**이 아니라 **뒤** — ledger는 review-loop가 만든다)
- Test: 없음(grep AC10 + 릴리스 후 AC11 실측)

## Prep

- spec §2 릴리스 표면, §5 AC10·AC11, §4 D36·D37, 잔여 리스크(Windows 미검증). `README.ko.md` §Development / Release("version을 올린 커밋에서만 사용자가 업데이트를 받는다"). 이전 릴리스 커밋 형식: `git log --oneline | grep '^[0-9a-f]* release:' | head -3`.

## Deps

task-07 · task-08 · task-09(웨이브 2 문면 전부 커밋된 뒤).

## Steps

### 1. 선점 재확인 + 버전 bump

```bash
cd ~/workspace/claude-dev-workflow
git status --short | grep -v '^??' | wc -l                          # 0 — clean에서 시작
grep -n '"version"' dev-workflow/.claude-plugin/plugin.json          # "0.17.0"
git log --oneline | grep -c 'release: 0.18.0'                        # 0 — 선점 없음
sed -i 's/"version": "0.17.0"/"version": "0.18.0"/' dev-workflow/.claude-plugin/plugin.json
grep -n '"version"' dev-workflow/.claude-plugin/plugin.json          # "0.18.0"
node -e 'JSON.parse(require("fs").readFileSync("dev-workflow/.claude-plugin/plugin.json","utf8")); console.log("json ok")'
```

### 2. 트랙 전체 no-AI-trace + AC10 대조

```bash
BASE=$(git log --format=%H --grep='review-loop(spec) 종결' -1)     # spec 종결 커밋(4e3cd8d) = 구현 착수 직전
git log --format=%B $BASE..HEAD | grep -ciE 'co-authored|generated with|claude-session'   # 0
git diff --name-only $BASE..HEAD | xargs grep -liE 'co-authored-by|generated with \[claude' 2>/dev/null | grep -v 'review-loop/SKILL.md'   # 빈 출력 (RL §4의 grep 예시만 해당 문자열을 갖는다)
for f in README.md README.ko.md README.ja.md; do grep -c '0.18.0' $f; done   # 각 2 (AC10 — 신규 서술 3건: F1·F5 문단 + F6 문장)
```

### 3. 엔트리포인트에 AC11 절 추가

`docs/plans/2026-09-21-opshub-field-defect-fixes.md` 말미(review-loop가 만든 `## 적대검증 ledger (plan)`·`(impl)` 절이 있으면 그 **뒤**)에 추가:
```markdown
## AC11 실사용 확인 (트랙 완료 조건, D37) — 릴리스 후 기록

0.18.0 설치본으로 **실제 트랙의 review-loop 라운드 1회**를 돌리며 다음 3단계를 **같은 라운드 안에서** 기록한다. 검증 대상은 "Bash **도구**의 timeout kill이 분리 프로세스를 죽이지 않는가"이므로, 대기 명령의 자체 종료(`timeout 570 …` → `WAIT_EXPIRED`)를 끊는 것으로 대체하지 않는다 — 그 경로는 도구가 프로세스를 정리하는 상황을 만들지 않는다.

1. **Bash 도구 timeout 주입**: 기동 직후 대기를 셸 `timeout` 없이 `until grep -q '^COMPANION_EXIT:' "$L.out"; do sleep 15; done`로 띄우고 **Bash 도구의 `timeout` 인자를 라운드 소요보다 짧게**(예: 120000ms) 준다 → 도구가 대기 프로세스를 kill한다(도구의 timeout 에러 메시지 시각을 기록).
2. **동일 pid 생존**: 그 직후 `kill -0 "$(cat "$L.pid")"; echo $?` = 0(래퍼 pid가 도구 kill을 견딤). `$L.pid` 값이 기동 시 기록한 값과 같은지 함께 적는다.
3. **동일 라운드 마커 회수**: 규약대로 대기를 재개해(`timeout 570 …`) 같은 `$L.out`에서 `COMPANION_EXIT:` 마커와 헤더·실행 로그를 회수한다(재실행 없이).

| 호스트 | OS/셸 | 날짜 | 트랙·라운드 | 도구 timeout 주입(인자·에러 시각) | pid 생존(`kill -0` 결과·pid 동일) | 마커 회수(같은 `$L.out`) | 명령 로그 수 | 결과 |
|---|---|---|---|---|---|---|---|---|
| spark2 | Linux · bash | | | | | | | |
| OMEN 또는 그램 | Windows · Git Bash | | | | | | | |

- 통과 = 1·2·3 전부 기록되고 2가 0·3이 회수. 1을 건너뛴 라운드(도구 timeout이 발생하지 않은 정상 완료)나 대기 명령 자체 종료(`WAIT_EXPIRED`)만 본 라운드는 **별도 줄**(비고)로 남기고 AC11 통과 근거로 인정하지 않는다.
- spark2는 2026-09-21 spec 루프 4라운드(R1~R3·C1)가 같은 방식(수동 선적용)으로 마커 회수·bwrap 0을 보였으나 도구 timeout 주입은 없었다 — **0.18.0 문면 + 주입 절차로 1루프 재확인**해야 완료다.
- **Windows 실패 시**(2에서 pid 사망 또는 3에서 마커 미회수): RL §2b ②에 PowerShell 폴백 1줄(`Start-Process -NoNewWindow -FilePath bash -ArgumentList "$L.sh" -RedirectStandardOutput "$L.out"` 형태, 08-29 검증분)을 병기하는 패치 릴리스(0.18.1)가 완료 조건에 추가된다.
- 두 행이 채워지고 결과가 통과여야 **트랙 완료**(dev-cycle 9단계 "트랙 완료" 신호). 채우는 주체 = 그 호스트에서 루프를 돈 세션(이 파일 커밋).
```

### 4. 릴리스 커밋

```bash
git add dev-workflow/.claude-plugin/plugin.json docs/plans/2026-09-21-opshub-field-defect-fixes.md
git commit -m "release: 0.18.0 — 실사용 결함 수리: review-loop 분리 실행·마커 판정·레지스트리 경로 해소·유효성 블록·FIXED 해시 인용 순서·§2i 진행 중 라운드 분기, Stop 훅 넛지 = 현재 단위만, WPS 계약 블록 SDD 어댑터, 문서 드리프트 정정(README 3종·DC·DR·HS·UM)"
git log -1 --format=%B | grep -ciE 'co-authored|generated with|claude-session'   # 0
```

### 5. 설치 갱신 안내(사용자에게 출력하는 문안 — 4머신)

```
0.18.0 릴리스 커밋이 로컬 main에 있습니다(미push — push는 사용자 판단). push 뒤 각 머신에서:
  /plugin update dev-workflow@claude-dev-workflow
대상: 맥북(~/workspace) · OMEN(D:\workspace) · 그램(C:\workspace) · spark2(~/workspace).
갱신 확인: /dev-workflow:doctor (설치본 0.18.0 · 마켓플레이스 최신).
트랙 완료 조건(AC11): spark2 1루프 + Windows(OMEN 또는 그램) 1루프에서 F1 분리 실행 실측(Bash 도구 timeout 주입 → 동일 pid 생존 → 같은 라운드 마커 회수) → plan 엔트리포인트 §AC11 표 기록. Windows 실패 시 PowerShell 폴백 패치(0.18.1).
후속(트랙 밖, D38): ~/workspace/dev-workflow-eval/FOLLOWUP-2026-09-18.md §6에 O6·AUDIT §1c 추가(eval repo 별도 커밋) · F5 효과 실측 = ops-hub "해시 전용 커밋 수/라운드"(기준선 ≈0.28, D23) · F6 효과 = FOLLOWUP §3 관찰.
```

## Acceptance Criteria

```bash
grep -c '"version": "0.18.0"' dev-workflow/.claude-plugin/plugin.json      # 1  (AC10)
git log -1 --format=%s | grep -c '^release: 0.18.0'                        # 1
grep -c '^## AC11 실사용 확인' docs/plans/2026-09-21-opshub-field-defect-fixes.md   # 1
grep -c 'spark2' docs/plans/2026-09-21-opshub-field-defect-fixes.md        # ≥2 (SC/AC11 표)
for f in README.md README.ko.md README.ja.md; do grep -c '0.18.0' $f; done # 각 2  (AC10)
BASE=$(git log --format=%H --grep='review-loop(spec) 종결' -1); git log --format=%B $BASE..HEAD | grep -ciE 'co-authored|generated with|claude-session'   # 0
git status --short | grep -v '^??' | wc -l                                  # 0
```

## Cautions

- **push하지 않는다. 이유: 이 트랙은 spec부터 미push로 진행했고 push 시점은 사용자 판단이다.**
- **AC11 표를 여기서 채우지 않는다. 이유: 릴리스 후 실사용 실측이며 각 호스트의 세션이 채운다 — 빈 표 + 기록 지침이 이 task의 산출물이다.**
- **plugin.json 외 marketplace.json·description을 손대지 않는다. 이유: 릴리스 표면은 version bump + README(task-09)만(spec §2).**
- **"3머신" 표현을 어디에도 쓰지 않는다. 이유: D28·B20 — spark2 포함 4머신.**
- **AC11 통과 전 "트랙 완료"를 선언하지 않는다. 이유: D37 — 실사용 확인이 완료 조건이다. 9단계 완료 신호는 AC11 표 두 행이 채워진 커밋이다.**
