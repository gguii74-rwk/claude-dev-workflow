# task-02 — RL 실행 절차 재작성 (F1 실행 신뢰성 + F2 경로 해소 통일)

**목적**: review-loop의 적대·확인 실행 문면을 "파일로 띄우고 파일로 받는" 분리 실행 절차로 바꾼다 — 레지스트리 경로 해소(F2)·래퍼/출력/pid/마커·백그라운드 대기·진행 중 금지 2종·회수 경로·`--help` 금지·`task --prompt-file` + 버전 게이트. RL:156 `--background` job id 문단과 RL:285 폴링 문장은 삭제된다.

## Files

- Modify: `dev-workflow/skills/review-loop/SKILL.md`
  - `### 실행 (task 커맨드)` 절 전체(0.17.0 기준 148~160행) → 아래 §A로 교체
  - `#### 2b. 리뷰 실행 (모드 분기)` 절 전체(273~289행, 다음 헤더 `#### 2c.` 직전까지) → 아래 §B로 교체
- Test: 없음(문면 — 검증은 grep AC + task-06 GREEN)

## Prep

- spec §3 F1(방향 1~8)·F2, §1 F6 원인 사슬 2(/clear 기제), §4 D1·D4~D11·D16~D19. 엔트리포인트 SC-2·SC-3(HOOK-②)·SC-4·SC-5·SC-7·SC-8.
- 현행 문면을 먼저 읽는다: `sed -n '148,160p;273,289p' dev-workflow/skills/review-loop/SKILL.md`. 이 task가 **원문 그대로 보존**하는 행(task-03이 바꾼다):
  - 282행: `- **빈 가드 = focus 인자 미부착**: 재논의 금지 블록·닫힌 ledger 항목·미확인 FIXED 큐가 **모두 없으면** `-- "$(cat …)"`을 통째로 빼고 호출한다(companion 기본값에 맡긴다 — 빈 목록을 보내 "닫힌 게 없다"는 신호로 오해될 여지를 만들지 않는다). **미확인 FIXED 큐만 비어 있지 않으면 진행 상태 한 줄만으로 focus를 부착한다**(§기결정 가드 — 계열 B 고지가 빈 가드 분기로 소실되지 않게).`
  - 286행: `- 출력 JSON을 파싱한다: `{ verdict, summary, findings[{severity,title,body,file,line_start,line_end,confidence,recommendation}], next_steps }`.`
  - 287행: `- 출력이 스키마와 다르면 루프를 멈추고 원문을 보고한다(추측 금지). 자동 재시도 금지 — 재실행은 사용자 판단.`
  - 288행: `- companion이 미설치/미인증으로 실패하면 멈추고 `/codex:setup`을 안내한다(임의 수정 금지).`
  - 158행(프롬프트 첨부물 ①~⑥): 그대로 유지. 148행이 `### 실행 (task 커맨드)`, 273행이 `#### 2b. 리뷰 실행 (모드 분기)`, 289행이 `- **확인 모드**: §확인 모드의 실행·응답 계약을 따른다(`task` 커맨드).`인지 확인하고 시작한다(다르면 행 번호를 재탐색 — 내용 기준으로 교체).

## Deps

task-01(RED 기록이 먼저 있어야 GREEN 대조가 성립).

## Steps

### 1. 교체 §A — `### 실행 (task 커맨드)` 절(148~160행)을 다음으로 바꾼다

원문 첫 줄 `### 실행 (task 커맨드)` ~ 원문 마지막 줄(160행) `` - `task` 커맨드 부재(codex 플러그인 구버전) 시: 멈추고 `/codex:setup`(플러그인 갱신) 안내. 임의 대체 실행 금지. `` 까지를 통째로 다음 텍스트로 교체한다. 158행(프롬프트 첨부물 ①~⑥)은 **원문 그대로** 유지해 아래 `[158행 원문 그대로]` 자리에 둔다.

````markdown
### 실행 (task 커맨드)

실행 기제는 **§2b 라운드 실행 공통 절차**와 같다 — 파일 접미만 `-C<N>`, 래퍼 안의 명령만 `node "$ROOT/scripts/codex-companion.mjs" task --prompt-file "$L.prompt"`. 프롬프트는 파일로 넘겨 원 지적 원문의 `$(...)`·백틱·인용부호가 셸·argv에 닿지 않게 한다. `--prompt-file`은 companion **≥1.0.6** — §2b ① 게이트가 `COMPANION_TOO_OLD`면(또는 `task` 커맨드 부재면) 멈추고 `/codex:setup` 안내, 임의 대체 실행 금지. 마커 뒤 `$L.out` 본문이 확인 응답이다(아래 계약; 회수는 §2b ⑤). `adversarial-review`+focus로 대체하지 않는다(기저 템플릿이 적대라 확인 목적함수를 누르지 못한다).
[158행 원문 그대로]
- codex 샌드박스는 read-only — 게이트(테스트)는 루프 세션이 실행한다.
````

### 2. 교체 §B — `#### 2b. 리뷰 실행 (모드 분기)` 절(273~289행)을 다음으로 바꾼다

원문 첫 줄 `#### 2b. 리뷰 실행 (모드 분기)` ~ 원문 마지막 줄 `` - **확인 모드**: §확인 모드의 실행·응답 계약을 따른다(`task` 커맨드). `` 까지 교체. 원문 282행(`- **빈 가드 = focus 인자 미부착**: …`)과 286~288행(JSON 파싱·스키마 불일치·미설치 3줄)은 **원문 그대로** 아래 표시 자리에 둔다(task-03이 바꾼다).

````markdown
#### 2b. 리뷰 실행 — 라운드 실행 공통 절차(모드 분기는 래퍼 안의 명령만)

라운드는 **파일로 띄우고 파일로 받는다**(실측: Bash 도구 timeout·/clear·조기 사망으로 결과 소실 11건, macOS 세션 분리 명령 부재 1건). companion 1.0.6의 `adversarial-review --background`·`--wait`는 무시된다(항상 포그라운드) — 분리는 이 절차가 한다.

**① companion 경로 — 라운드마다 레지스트리에서 해소**(캐시 디렉터리 glob 금지 — 고아 캐시가 거짓 정상, zsh `nomatch` 에러). 우선순위 = cwd 일치 project/local > user > managed. `RESOLVE_FAIL`이면 멈추고 `/codex:setup` 안내 — glob 폴백 없음.
```bash
P="${CLAUDE_CODE_PLUGIN_CACHE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins}"
ROOT=$(node -e 'const fs=require("fs"),p=require("path");let d;try{d=JSON.parse(fs.readFileSync(p.join(process.argv[1],"installed_plugins.json"),"utf8"))}catch{process.exit(1)}
const r=e=>e.projectPath===process.argv[2]?0:e.scope==="user"?1:e.scope==="managed"?2:9;
const a=((d.plugins||{})["codex@openai-codex"]||[]).filter(e=>r(e)<9).sort((x,y)=>r(x)-r(y))[0];
if(!a||!fs.existsSync(p.join(a.installPath,"scripts","codex-companion.mjs")))process.exit(1);console.log(a.installPath)' "$P" "$PWD") || echo RESOLVE_FAIL
V=$(node -p 'require(process.argv[1]+"/.claude-plugin/plugin.json").version' "$ROOT")
[ "$(printf '1.0.6\n%s\n' "$V" | sort -V | head -1)" = 1.0.6 ] || echo "COMPANION_TOO_OLD $V"
```

**② 라운드 파일 = `.remember/`**(clean 판정·커밋 제외 — 추적 파일 편집 금지와 무충돌): `L=.remember/loop-<ledger basename>-<phase>-R<N>`(확인은 `-C<N>`). 적대는 매 라운드 가드 focus를 `$L.focus`에 **재조립**(§기결정 가드), 확인은 `$L.prompt`. 래퍼 `$L.sh` → 출력 `$L.out`(기동 시 **새로 쓴다** — 같은 `$L` 재실행에서 이전 마커·본문이 현재 라운드로 읽히지 않게) → pid `$L.pid`, 끝에 마커 `COMPANION_EXIT:<code>`. 분리 = **node `spawn(detached)` 1줄, 전 플랫폼 공통**(스크립트 동봉 없음). focus는 `--` 뒤 인자 하나(파일 내용은 재평가되지 않는다). `$L.pid`가 살아 있으면(`kill -0`) 띄우지 않고 ③으로.
```bash
cat > "$L.sh" <<EOF
#!/bin/bash
cd "$PWD" || exit 97
node "$ROOT/scripts/codex-companion.mjs" adversarial-review --wait --base <해소한 base SHA> -- "\$(cat "$L.focus")"
echo COMPANION_EXIT:\$?
EOF
node -e 'const fs=require("fs"),[sh,out,pid]=process.argv.slice(1),fd=fs.openSync(out,"w");
const c=require("child_process").spawn("bash",[sh],{detached:true,stdio:["ignore",fd,fd]});fs.writeFileSync(pid,String(c.pid));c.unref()' "$L.sh" "$L.out" "$L.pid"
```
[282행 원문 그대로]

**③ 대기 = 백그라운드 기본** — `run_in_background: true`의 until-loop 또는 Monitor로 마커를 기다리며 **턴을 끝낸다**(라운드 경계마다 Stop 훅 넛지 체크포인트가 서서 §2i 진행 중 라운드 분기가 성립한다. 포그라운드 대기는 넛지를 없애 기본이 아니다).
```bash
timeout 570 bash -c "until grep -q '^COMPANION_EXIT:' '$L.out'; do sleep 15; done"; grep -q '^COMPANION_EXIT:' "$L.out" || echo WAIT_EXPIRED
```
- **대기 프로세스 사망 ≠ 라운드 실패**: `WAIT_EXPIRED`면 `kill -0 "$(cat "$L.pid")"`로 생존 확인(**`pgrep -f` 금지** — 자기 매칭) 후 마커 재확인·대기 재개. 마커 없이 pid도 죽었으면 실행 실패(④).
- **진행 중 금지 2종.** (1) **/clear 금지** — codex 플러그인 `SessionEnd` 훅이 이 세션의 running 잡을 kill한다. Stop 훅 ②와 동일 문구(규범 원본은 여기): "진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 /clear를 안내하라." — 앞 문장(완료 전 /clear 금지)은 항상, 뒷 문장(기록만 하고 멈춤)은 **넛지를 받은 세션에만** 적용된다(§2i 경로 ①). 넛지 없이 완료 알림이 오면 ④ → §2c로 정상 진행한다. (2) **추적 파일 편집 금지** — 리뷰어가 디스크를 직접 읽는다.
- 라운드 시작 시 HEAD SHA를 기록한다(base·target 병기; 공유 워킹트리면 응답 후 재확인). `--base` = §1에서 해소한 base SHA.

**④ 완료·유효 판정**
[286~288행 원문 그대로 — 3줄]

**⑤ 회수(사용자 판단 — 자동 재실행 금지·예산 미소모·원문 보고).** 적대는 **재실행뿐**(ephemeral 스레드). 확인 `task`는 `$L.out`의 `Thread ready (<id>)`로 `codex exec … resume <id>`(옵션은 `resume` 앞). 클라이언트만 죽으면 job이 `running`으로 잔존해 다음 라운드와 겹친다 — `status --all`의 Job id로 `cancel <id>`. **`--help`·무인자 호출 금지**(실제 job이 뜬다) · `| head` 등 파이프 금지(job 잔존).
- **확인 모드**: 위 ①~⑤ + §확인 모드 실행(`task --prompt-file`)·응답 계약.
````

### 3. 자기 점검 — 문면 grep

```bash
F=dev-workflow/skills/review-loop/SKILL.md
grep -c '/codex:status' $F; grep -c 'job id' $F; grep -c 'setsid' $F; grep -c 'sort -V | tail' $F; grep -c 'cache/openai-codex' $F; grep -c 'ls -d' $F   # 기대: 전부 0 (`sort -V | head -1`은 SC-4 버전 비교 — 금지 대상은 glob 최신 정렬 `sort -V | tail`만)
grep -n 'run_in_background' $F              # 기대: ③ 대기 문단 1건만
grep -c 'COMPANION_EXIT' $F                  # 기대: ≥3
grep -c 'installed_plugins.json' $F          # 기대: 1
grep -c 'pgrep -f' $F                        # 기대: 1 (금지 문구)
grep -c '진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 /clear를 안내하라.' $F   # 기대: 1 (SC-3 HOOK-② 바이트 동일)
wc -c $F                                     # 소프트 예산: ≤ 64,750 (SC-7 — plan 합성값 64,621 + 여유)
```
### 4. 커밋

```bash
git add dev-workflow/skills/review-loop/SKILL.md
git commit -m "fix(review-loop): 라운드 실행 공통 절차 — 레지스트리 경로 해소·래퍼/출력/pid/마커 분리 실행·백그라운드 대기·진행 중 금지 2종·회수 경로·task --prompt-file(≥1.0.6 게이트), --background job id 문단·폴링 문장 삭제 (F1·F2)"
```

## Acceptance Criteria

```bash
F=dev-workflow/skills/review-loop/SKILL.md
for s in '/codex:status' 'job id' 'setsid' 'sort -V | tail' 'cache/openai-codex' 'ls -d'; do printf '%s\t' "$s"; grep -c -- "$s" $F; done   # 전부 0 (AC2의 `sort -V` = glob 최신 정렬 — SC-4의 `sort -V | head -1` 버전 비교는 대상 아님)
grep -c 'installed_plugins.json' $F; grep -c 'spawn(' $F; grep -c '\-\-prompt-file' $F; grep -c '1\.0\.6' $F; grep -c 'status --all' $F; grep -c 'cancel <id>' $F   # 전부 ≥1
grep -c 'COMPANION_TOO_OLD' $F               # 2 (게이트 명령 + 확인 모드 문장)
grep -n '^#### 2b\. 리뷰 실행' $F             # 1행
[ "$(wc -c < $F)" -le 64750 ] && echo SIZE_OK  # 소프트 예산(SC-7)
git log -1 --format=%B | grep -ciE 'co-authored|generated with|claude-session'   # 0
```

## Cautions

- **RL:158(프롬프트 첨부물 ①~⑥)과 RL:282·286~288을 고쳐 쓰지 않는다. 이유: 282·286~288은 task-03이 유효성 블록·빈 가드 정밀화로 바꾼다 — 여기서 손대면 두 task의 diff가 겹친다.**
- **`--wait`를 래퍼 명령에서 빼지 않는다. 이유: 1.0.6은 무시하지만 상위 버전이 백그라운드 기본으로 바뀌어도 포그라운드 완주 의도를 문면에 남긴다(래퍼가 완주해야 마커가 찍힌다).**
- **`CODEX_COMPANION_SESSION_ID`를 비우는 우회를 쓰지 않는다. 이유: D5 미채택 — 사실 기록만 한다.**
- **HOOK-② 인용문 안에 넛지 조건을 넣지 않는다 — 조건은 인용 밖 문장으로 둔다. 이유: SC-3 바이트 동일(훅은 넛지 시에만 발화하므로 조건이 내재) — 인용을 고치면 훅과 어긋난다. 조건이 없으면 백그라운드 기본(D1) 아래 모든 라운드 완료가 중단 지시로 읽힌다(review-loop(plan) R2).**
- **SC-4·SC-5 명령을 다시 쓰지 않고 그대로 붙인다. 이유: task-06 AC 그렙과 SC-3·SC-4 문자열이 바이트 단위로 맞아야 한다.**
- **`$L.out`에 `| head`·`| tail`을 붙인 예시를 쓰지 않는다. 이유: F1-6 — 파이프가 클라이언트만 죽이고 job을 잔존시킨다.**
- **spawn 1줄의 `fs.openSync(out,"w")`를 `"a"`로 바꾸지 않는다. 이유: 같은 `$L`로 재실행하면 이전 마커가 남아 대기가 즉시 끝나고 이전 결과를 현재 라운드로 판정한다(review-loop(plan) R1 high). 대기 재개(③)는 파일을 열지 않으므로 영향 없다.**
- **소프트 예산(SC-7)을 넘으면 §B 첫 문단의 근거를 "실행 신뢰성 사고 11건 + macOS 1건"만 남긴다. 이유: AC9 상한은 올리지 않는다(D34) — 교체문은 plan 합성으로 크기를 이미 맞췼으므로 통상 초과하지 않는다.**
