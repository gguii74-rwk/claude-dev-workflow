# 실사용 결함 수리 (0.18.0) — 구현 계획 엔트리포인트

- **spec**: `docs/specs/2026-09-18-opshub-field-defect-fixes.md` (F1~F8 · D1~D38 · AC1~AC11). **spec ledger = spec 말미 `## 적대검증 ledger (spec)`** — 단일 원본, 여기에 복제하지 않는다. plan·impl ledger는 review-loop가 **이 문서 말미**에 만든다(`## 적대검증 ledger (plan)` · `## 적대검증 ledger (impl)`).
- **Goal**: ops-hub 실사용에서 반복된 실행·인계 결함(codex 라운드 소실·넛지 후 폭주·어댑터 미도달·해시 전용 커밋·문서 드리프트)을 **스킬 문면과 훅 문구 수준**에서 제거하고 0.18.0으로 릴리스한다. 판정 규칙·예산·전환 신호·확인 임무는 바꾸지 않는다.
- **Architecture**: 산출물은 코드가 아니라 규약 문면이다 — `review-loop/SKILL.md`(RL) 전 편집 + Stop 훅 문구가 웨이브 1, 나머지 스킬·README·릴리스가 웨이브 2(D35 — 같은 §2b·§2i를 두 번 리뷰하지 않기 위해). 행동 항목(F1·F3·F6)은 writing-skills TDD(하네스 RED→GREEN), 문면 항목(F2·F4·F5·F7·F8)은 grep 대조로 검증한다(spec §6).
- **Tech stack**: Markdown 스킬 문서 · Node ESM 훅(`context-threshold-hook.mjs`) · bash · codex companion 1.0.6 · 하네스 = 서브에이전트 디스패치 + 3줄 응답 규격(`.remember/harness-0.18.0/`, claude-memories 보존).
- **경로 = 정식**(사용자 확정 2026-09-18). 3.5 비대상. 다음 = 6 review-loop(plan) → 7 impl(SDD) → 8 review-loop(impl) → 9 릴리스.

> **For agentic workers — execution contract (MUST):** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. This plan is split into per-task files (`<feature>/task-NN-<slug>.md`). Task bodies (Files, TDD steps, AC) are **NOT** in this entrypoint. To execute, MUST: ① read this entrypoint's §Shared Contracts → ② load exactly one target task file → ③ run its steps in order → ④ **record completion**: when the task is **confirmed complete** (reviews approved — SDD's "mark todo complete" sync point; the implementer's DONE report is NOT completion), the dispatcher (the executor itself when running without subagents) immediately — before dispatching the next task — sets that task's row in this entrypoint's task table to `[x]`, writes its one-line outcome, and **commits this entrypoint file on the spot**. **Convergence check (MUST, at all three points — before starting any task, when initializing a resumed/recovered session, and before entering the final whole-branch review):** reconcile this task table against the SDD progress ledger and git log. The authority for "complete" is an **explicit completion record in the SDD progress ledger**; git log only corroborates that a recorded commit exists and was not reverted — an implementation commit by itself is NOT completion (implementer commits exist before review approval). A task whose ledger completion record is missing or ambiguous is **incomplete (fail-closed)** — including a row already marked `[x]`: revert it to `[ ]`. **That rule presumes a live ledger.** A ledger that is absent — or present but holding no completion record for any task while this table already has `[x]` rows — is fresh or lost, not authoritative. (Judge by content, not by the file: SDD's setup recreates an identity-only `progress.md` before reading the plan, so a workspace lost to `git clean -fdx` looks "present"; same after the post-final-review cleanup `rm -rf <workspace>`.) In that state authority falls back to **this committed task table**, which ④ writes only at confirmed completion, with git log corroborating each `[x]` row's commit. Never mass-revert the table over a fresh or lost ledger: revert only a row git log contradicts (no such commit, or reverted), and if the table itself is unreadable, ask your human partner instead of re-dispatching. Rebuild the ledger's completion lines from the surviving table before continuing, so later checks have a live ledger again — but that rebuild restores completion state **only**: a lost ledger may also have held deferred-minor and parked findings with their rulings, which this table never carried, so flag that gap and get your human partner's confirmation before the final whole-branch review instead of presenting the rebuilt ledger as whole. A row filled in but not yet committed is also unconverged: commit it before proceeding. Do not start implementing from the entrypoint alone (it has no steps). Do not load all task files at once.

**SDD 어댑터(실행 세션용 — 0.17.0 블록에는 없다, F4가 0.18.0에서 블록 안으로 넣는다)**: 분할 plan에는 "Task N" 절이 없으니 `scripts/task-brief` 추출을 건너뛰고 **task 파일 전문을 brief로** 넘긴다. SDD workspace·progress ledger는 **이 엔트리포인트 기준**(`scripts/sdd-workspace docs/plans/2026-09-21-opshub-field-defect-fixes.md`) — task 파일별이 아니다. **디스패치 프롬프트마다 no-AI-trace를 명시한다**(이 repo 글로벌 규칙: 커밋 메시지·문서에 `Co-Authored-By`·`Generated with` 등 AI 서명 금지).

## Shared Contracts

### SC-1. 대상 파일 · 약칭 (행 번호 = 0.17.0 `21b68e9` 기준)

| 약칭 | 경로 | 이 plan에서 바꾸는 것 |
|---|---|---|
| RL | `dev-workflow/skills/review-loop/SKILL.md` (61,898B) | task-02·03·04·05 |
| 훅 | `dev-workflow/hooks/scripts/context-threshold-hook.mjs` | task-05 |
| WPS | `dev-workflow/skills/writing-plans-split/SKILL.md` | task-07 |
| DC | `dev-workflow/skills/dev-cycle/SKILL.md` | task-08 |
| DR | `dev-workflow/skills/doctor/SKILL.md` | task-08 |
| HS · UM | `dev-workflow/skills/harden-spec/SKILL.md` · `dev-workflow/skills/ui-mockup/SKILL.md` | task-08 (index.lock 1줄씩) |
| README | `README.md` · `README.ko.md` · `README.ja.md` | task-09 |
| plugin.json | `dev-workflow/.claude-plugin/plugin.json` | task-10 (`0.17.0` → `0.18.0`) |

companion = codex 플러그인 `<installPath>/scripts/codex-companion.mjs`(1.0.6: `adversarial-review`의 `--background`·`--wait`는 파싱만 되고 무시됨 `:714-735`, `task --prompt-file`은 `:764`, `cancel`·`status [--all]`·`result` 서브커맨드 실재).

### SC-2. 라운드 파일 규격 (F1-1, D6)

- `L=.remember/loop-<ledger basename>-<phase>-R<N>` — 확인 라운드는 `-C<N>`. 접미: `.sh`(래퍼) · `.out`(출력) · `.pid` · `.focus`(적대 가드 focus) · `.prompt`(확인 프롬프트).
- 마커 = 출력 마지막 줄 `COMPANION_EXIT:<exit code>`. 실행 로그 표지 = `[codex] Running command:` 행. 적대 본문 헤더 = `# Codex Adversarial Review`. 확인 스레드 id = `[codex] Thread ready (<id>)` 행.
- `.remember/`는 루프 상태 디렉터리 — clean 판정·커밋에서 제외(RL §0·§2i·§3 현행), 루프는 커밋하지 않는다(추적 repo에서는 사용자 몫).

### SC-3. 정본 문구 3종 — 훅과 RL에 **바이트 동일**하게 넣는다 (D24 · F1-4 "훅 ②와 동일" · F3-2)

- **UNIT**(작업 단위 예시): `작업 단위 = 리뷰 라운드 1회 · SDD task 1개 · 수정 1건 · 질문 라운드 1회`
- **HOOK-②**(진행 중 /clear 금지 — 조건문): `진행 중인 백그라운드 작업이 있으면 완료 전 /clear 금지. 완료 알림을 받으면 결과를 기록만 하고 멈춘 뒤, 그때 /clear를 안내하라.`
- **FOCUS-LINE**(정적 검토 완료형 고정 첫 줄, 적대만): `샌드박스는 읽기 전용이라 테스트·빌드 실행이 실패할 수 있다 — 실패를 이유로 검토를 중단하지 말고 정적 검토로 완료하라(게이트는 루프가 실행한다). typecheck 같은 읽기 전용 명령은 그대로 실행하라.`

### SC-4. companion 경로 해소 + 버전 게이트 (F2 D17·D18·D19, F1-7 D8) — RL에 넣는 명령 원문

```bash
P="${CLAUDE_CODE_PLUGIN_CACHE_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/plugins}"
ROOT=$(node -e 'const fs=require("fs"),p=require("path");let d;try{d=JSON.parse(fs.readFileSync(p.join(process.argv[1],"installed_plugins.json"),"utf8"))}catch{process.exit(1)}
const r=e=>e.projectPath===process.argv[2]?0:e.scope==="user"?1:e.scope==="managed"?2:9;
const a=((d.plugins||{})["codex@openai-codex"]||[]).filter(e=>r(e)<9).sort((x,y)=>r(x)-r(y))[0];
if(!a||!fs.existsSync(p.join(a.installPath,"scripts","codex-companion.mjs")))process.exit(1);console.log(a.installPath)' "$P" "$PWD") || echo RESOLVE_FAIL
V=$(node -p 'require(process.argv[1]+"/.claude-plugin/plugin.json").version' "$ROOT")
[ "$(printf '1.0.6\n%s\n' "$V" | sort -V | head -1)" = 1.0.6 ] || echo "COMPANION_TOO_OLD $V"
```
`RESOLVE_FAIL`(파일 없음·파싱 실패·활성 엔트리 0·companion 파일 없음) = 멈추고 `/codex:setup` 안내, glob 폴백 없음. `COMPANION_TOO_OLD` = 확인 모드(`--prompt-file`) 실행 금지 → 멈추고 `/codex:setup`. 라운드마다 재해소, 루프 파일 필드 없음(D16).

### SC-5. 분리 기동 + 백그라운드 대기 (F1-1·F1-2, D1·D4·D10·D11) — RL에 넣는 명령 원문

```bash
cat > "$L.sh" <<EOF
#!/bin/bash
cd "$PWD" || exit 97
node "$ROOT/scripts/codex-companion.mjs" adversarial-review --wait --base <해소한 base SHA> -- "\$(cat "$L.focus")"
echo COMPANION_EXIT:\$?
EOF
node -e 'const fs=require("fs"),[sh,out,pid]=process.argv.slice(1),fd=fs.openSync(out,"w");
const c=require("child_process").spawn("bash",[sh],{detached:true,stdio:["ignore",fd,fd]});fs.writeFileSync(pid,String(c.pid));c.unref()' "$L.sh" "$L.out" "$L.pid"
# 대기(run_in_background: true 또는 Monitor) — 이 명령이 끝나면 턴도 끝난다. 유계 = 38회×15초 = 570초(Bash 도구 10분 cap 안). 외부 timeout(1)·gtimeout 미사용 — macOS 기본 설치에 없다(DR:130 실측)
for i in $(seq 38); do grep -q '^COMPANION_EXIT:' "$L.out" && break; sleep 15; done; grep -q '^COMPANION_EXIT:' "$L.out" || echo WAIT_EXPIRED
```
확인 라운드의 래퍼 명령 = `node "$ROOT/scripts/codex-companion.mjs" task --prompt-file "$L.prompt"`(나머지 동일). 생존 확인 = `kill -0 "$(cat "$L.pid")"` — `pgrep -f` 금지. `setsid` 문자열 금지(macOS 부재). **`$L.out`은 기동 시 새로 쓴다(`"w"`)** — 실행 실패 뒤 사용자 승인 재실행은 같은 `$L`을 쓰므로 append면 이전 마커가 남아 대기가 즉시 끝나고 이전 결과를 현재 라운드로 판정한다(review-loop(plan) R1 high). 기동 전 `$L.pid`가 살아 있으면 띄우지 않는다. 대기 재개 명령은 파일을 열지 않으므로 영향 없다.

### SC-6. 하네스 규약 (spec §6 · task-01 작성 · task-06 GREEN)

- 위치 `H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0` (= 이 repo `.remember/harness-0.18.0`, 심링크). repo에 커밋하지 않는다(claude-memories 커밋은 사용자 몫). 판정 기준은 `PLAN.md`(호출자 전용)에만 두고 `RUN.md`·프롬프트에는 **절대 넣지 않는다**(7b 교훈: 기대 답 노출 런 60개 폐기).
- arm: `cur` = 0.17.0 문면(`$H/skills/review-loop-cur.md` · `$H/skills/hook-cur.txt`) / `new` = 웨이브 1 완료 HEAD 문면(`review-loop-new.md` · `hook-new.txt`). 스킬 사본으로만 읽는다 — `Skill` 도구 호출 금지.
- 케이스: `V1~V4`(§2b 유효성 픽스처 4종, 프롬프트 `prompts/V.md`, 3런/arm) · `N0`(N1과 같은 상태에서 **넛지 없이** 완료 알림 — 정상 진행 회귀 가드, `prompts/N0.md`, 3런/arm) · `N1`(RL 라운드 진행 중 넛지→완료 알림, auto-rounds 경계, `prompts/N1.md`, 5런/arm) · `N2`(비루프 harden 질문 대기 중 넛지, `prompts/N2.md`, 5런/arm). 출력 `$H/out/<arm>/<ID>-r<REP>.md`, 집계 `bash $H/tally.sh <arm>`.
- 훅 = `node $H/hook-cases.mjs <hook 경로>`(decideNudge 직접 import, 최초·재넛지 문구에 SC-3 ①②③ 포함 여부).
- 결과 기록 = `.remember/tdd-opshub-field-defect-fixes.md`(형식 = `tdd-7c-loop-handoff.md`) + 이 문서 task 표 outcome. cur arm이 이미 통과하는 축은 "효과 미확인(자동 보완)"으로 적는다 — RED 미재현은 plan 실패가 아니라 기록 대상이다.

### SC-7. AC9 규모 (D34 — 2026-09-22 갱신 +7KB)

기준 61,898B → 상한 **69,066B**(`wc -c dev-workflow/skills/review-loop/SKILL.md`). **plan 합성 실측**(task-02~05 교체문을 0.17.0 RL에 그대로 적용, review-loop(plan) R1): task-02 후 64,621 · task-03 후 65,893 · task-04 후 66,863 · task-05 후 68,610(R2·R3 수정 반영, 여유 456B). 소프트 예산(합성값 + ≈130B): task-02 후 ≤ 64,750 · task-03 후 ≤ 66,000 · task-04 후 ≤ 67,000 · task-05 후 ≤ 68,750. 하드 확인 = task-06(초과 시 task-06 §압축 후보에서 줄인다 — 상한을 다시 올리지 않는다). 소프트 예산을 넘으면 교체문을 그대로 붙이지 않은 것이므로 먼저 diff로 원인을 찾는다.

### SC-8. 커밋 규칙

명시 stage(`git add <파일>`, `git add -A` 금지) · `$(git rev-parse --git-dir)/index.lock` 있으면 대기 · **AI 서명·도구 흔적 금지**(글로벌 규칙 — `Co-Authored-By`·`Claude-Session`·`Generated with` 어느 것도 넣지 않는다) · 메시지 접두 관례: `fix(review-loop):` `fix(hook):` `fix(writing-plans-split):` `fix(dev-cycle):` `fix(doctor):` `docs(readme):` `release: 0.18.0 — …`. task당 1커밋 이상, 웨이브 1 RL 편집은 task마다 커밋(F5 순서 규정의 자기 적용: ledger 행은 다음 커밋에서 해시 인용).

## Task table

| # | title | status | file | deps | outcome |
|---|-------|--------|------|------|---------|
| 01 | 하네스 작성 + RED(cur arm) | [ ] | [task-01](2026-09-21-opshub-field-defect-fixes/task-01-harness-red.md) | — | |
| 02 | RL 실행 절차 재작성 — F1·F2 | [ ] | [task-02](2026-09-21-opshub-field-defect-fixes/task-02-review-loop-execution.md) | 01 | |
| 03 | RL 유효성 블록 + focus 고정 줄 — F3 | [ ] | [task-03](2026-09-21-opshub-field-defect-fixes/task-03-review-loop-validity-focus.md) | 02 | |
| 04 | RL ledger 순서 규정·소규모 정정 — F5·F7(RL:337)·F8 | [ ] | [task-04](2026-09-21-opshub-field-defect-fixes/task-04-review-loop-ledger-misc.md) | 03 | |
| 05 | 넛지 훅 문구 + RL §2i 진행 중 라운드 분기 — F6 | [ ] | [task-05](2026-09-21-opshub-field-defect-fixes/task-05-nudge-hook-resume.md) | 04 | |
| 06 | 웨이브 1 GREEN + AC1~3·5·6·8(RL) grep + AC9 | [ ] | [task-06](2026-09-21-opshub-field-defect-fixes/task-06-wave1-green-size.md) | 05 | |
| 07 | WPS 계약 블록 어댑터·트레일러 — F4·F8(d) | [ ] | [task-07](2026-09-21-opshub-field-defect-fixes/task-07-writing-plans-split-contract.md) | 06 | |
| 08 | DC·DR·HS·UM 문면 정정 — F7·F8(a) | [ ] | [task-08](2026-09-21-opshub-field-defect-fixes/task-08-dev-cycle-doctor-lock.md) | 06 | |
| 09 | README 3종 동기 — F7 + 0.18.0 신규 서술 3건 | [ ] | [task-09](2026-09-21-opshub-field-defect-fixes/task-09-readme-sync.md) | 06 | |
| 10 | 릴리스 0.18.0 + 설치 갱신 안내(4머신) + AC11 기록 지침 | [ ] | [task-10](2026-09-21-opshub-field-defect-fixes/task-10-release-0-18-0.md) | 07, 08, 09 | |

**웨이브 경계(D35)**: 01~06 = 웨이브 1(RL 전 편집 + 훅). 07~10 = 웨이브 2. review-loop(impl)은 RL 규약대로 task별 증분 + 마지막 통합 1회 — 단 RL 파일은 **task-06 완료 후**에만 리뷰 대상에 올린다(§2b·§2i 재리뷰 방지). base = 구현 착수 직전 main SHA(plan 종결 커밋). **8단계 impl 게이트**: 이 repo는 npm이 아니므로 RL 게이트 4종 대신 **task-06의 하네스 GREEN 기록 + AC grep**으로 갈음한다(dev-cycle 규약 · spec §6).

**AC ↔ task**: AC1 → 02(06 grep) · AC2 → 02 · AC3 → 03 · AC4 → 07 · AC5 → 04 · AC6 → 05(01 RED·06 GREEN) · AC7 → 04(RL:337)·08·09 · AC8 → 04(a RL·b·c·d RL)·07(d WPS)·08(a HS·UM) · AC9 → 06 · AC10 → 09·10 · AC11 → 10(릴리스 후 실사용 — 트랙 완료 조건).

**트랙 밖(D38, 여기서 하지 않는다)**: `~/workspace/dev-workflow-eval/FOLLOWUP-2026-09-18.md` §6에 O6·AUDIT §1c 추가(eval repo 별도 커밋), O13 = ops-hub 드리프트 브리프.

## 재논의 금지(기결정) — spec에서 승계

> **이번 트랙 확정 결정 = D1~D38(spec §4, 2026-09-21 harden-spec, 전부 사용자 확정)** — 적대검증(plan·impl)에서 재론하지 않는다. 특히: D1 백그라운드 대기 기본 · D2 SLIM D15 → 순서 규정 대체 · D3 유효성 조건(실행 로그 ≥1, 전면 실패만 무효) · D4 스크립트 비동봉·node 1줄 · D5 세션 결속 해제 미채택 · D7 자동 재실행 금지 유지 · D16 라운드마다 경로 해소 · D25 15%p·PreToolUse 불변 · D26 루프 파일 필드 불변 · D33 트레일러 조건부 · D34 +7KB(2026-09-22 갱신, 원안 +4KB — review-loop(plan) R1 합성 실측 68,378B 후 사용자 판정; 기존 문장 압축·신규 내용 축소 대안 불채택) · D35 2웨이브 · D37 실사용 완료 조건.
>
> 아래는 **승계 기결정** — 이 트랙이 위배하면 안 되는 것.

- **L1~L5 교훈 원칙**(`~/workspace/dev-workflow-eval/report/LESSONS-2026-08-12.md`) — 특히 L1 "성장은 실측 뒤에", L3 "기본값은 싼 쪽".
- **G1·G2** — 기계 검증 장치 과설계 금지(`docs/specs/2026-07-25-ui-mockup-skill-design.md:147-148`). C-10 **G-b**(파서·기계장치 금지)도 같은 계열 — F1의 node 분리 1줄은 실행 예시이지 검증 장치가 아니다(D4).
- **ESCALATE batch 기제 유지("무해라 유지")**(`docs/specs/2026-08-07-review-loop-and-pipeline-improvements-brief.md:41`).
- **하한 3종**(spec 문서·harden-spec·impl 적대검증) — DC 경량 경로 절.
- **SLIM D15**(FIXED 행 해시 인용, `docs/specs/2026-08-11-review-loop-slimming.md` §5 A1) → **이 트랙 D2가 대체**: 인용 의무 유지, 순서만 "수정 커밋 먼저 → 다음 커밋에서 인용". **SLIM D16**(`--background` job id 세부 MOTIVATED 잔류)은 F1이 삭제한다(SLIM A2 인용 = B1 11건·7a:455).
- **guard-focus D10**(빈 가드 = focus 인자 미부착) → **D12가 문언만 정밀화**("가드 블록 미포함 — focus 인자는 고정 줄로 항상 부착"), 취지 불변. guard-focus **D5**(무효 선언형 + 정상보고 단서 짝)·**D9**(인자 신설 없음) 불변.
- **7a D4**(재넛지 15%p)·**7a D6**(재넛지 = 지시 동일 + 사실 추가, "즉시 종료" 불채택) — F6 훅 문구 ①②③은 최초·재넛지 동일 적용으로 D6 안에 있다(D25).
- **C-4 D11**(훅 단서 "review-loop 실행 중이면 그 스킬 규정")·**D14**(§0↔§2i 동일 목록)·**D26**(일시중단 순서 0~4) — F6-2는 D26 앞단에 대기·기록을 더할 뿐 순서 불변, 필드 불변(D16·D26).
- **plan-gate fp-C1**(어댑터 = §Execution handoff, 2026-08-08 사용자 판정) → 배치만 계약 블록으로 이동(F4, 신규 근거 B11 4트랙) — 어댑터 내용 불변.
- **DR:196**(doctor는 codex 플러그인 버전을 대조하지 않는다) — F1-7의 ≥1.0.6 게이트는 RL 런타임 검사이지 doctor 확장이 아니다(D8).
- **C-11 판정 종결**(`docs/specs/2026-08-13-lightweight-skip-execution-rate.md` §6) — 재개는 새 트랙 spec으로.
- **사용자 결정(2026-09-18)** — 후속 작업은 전부 문서로 먼저 작성하고, Fable 교차검증을 거친 뒤 파이프라인(3 harden-spec~)으로 진행한다. **경로 = 정식**, 3.5 비대상.
- **spec ledger 닫힌 항목**: fp-OF-R1-1·fp-OF-R2-1(F6-2 재개 계약, FIXED `5ee91cc`·`898790f`, C1 소멸 확인) — 원문·근거는 spec 말미 ledger(복제 금지). ACCEPTED/DEFERRED/OUT_OF_SCOPE 인계 항목 없음.

## 적대검증 ledger (plan)

- 루프: review-loop(plan) 2026-09-22 시작(spark2 · Fable). base = `4e3cd8d`(해소 SHA `4e3cd8d5c2ef3611f88a118f9feb74191dd0381f`, plan 커밋 직전 main — spec diff 제외해 plan 11파일만 리뷰) · branch main · 시작 HEAD `b0acbfc`. 예산: max 5 · confirm 2 · auto 3. 게이트: 내용 관문 충족(SC-1~8·task 표·AC↔task), 형식 관문 ①②④ 스킵(repo에 CLAUDE.md/AGENTS.md 없음), ③ 통과(spec ledger fingerprint 컬럼 있음). 보안 크리티컬 아님. 입도 = 통합 1회(task 파일별 분할 리뷰 없음). 실행 방식 = spec 루프와 같은 F1 수동 선적용(`.remember/loop-2026-09-21-opshub-field-defect-fixes-plan-R<N>.{sh,out,pid,focus}` + node `spawn(detached)` + `COMPANION_EXIT:` 마커 + 백그라운드 대기, focus 첫 줄 = 정적 검토 완료형 고정 줄).
- score 이력(산식 = RL §blocking score, 미확인 FIXED 큐 제외): R1 = 6(high 1 + medium 3, 전부 FIXED 후보 — 그중 1건은 즉시 ESCALATE 경유) · R2 = 2(medium 2, 전부 FIXED 후보) · R3 = 2(medium 2, 전부 FIXED 후보) · R4 = 1(medium 1, FIXED 후보) — 신호 1 미발화(6→2→2→1 감소), 신호 2 미발화(신규 FIXED 후보 ≥1).
- 미확인 FIXED 큐: **9건**(fp-OF-P-R1-1 ~ R1-4 수정 커밋 `6698f68` · fp-OF-P-R2-1 ~ R2-2 `63fce1f` · fp-OF-P-R3-1 ~ R3-2 `ec031b4` · fp-OF-P-R4-1 `479065e`). 적대 소진 4/5 · 확인 소진 0/2 · 복귀 미사용 · 정밀 모드(적대 소진 3 = auto-rounds에서 batch 적재 0건 → flush 없음). R5 = 마지막 적대 라운드 → 소진 5 = max → 전환 신호 3 → 확인 모드.
- 사람 개입: fp-OF-P-R1-2 즉시 ESCALATE(후속 task 전제 — D34 기결정과 내용량 충돌) → 사용자 판정 2026-09-22 "D34 상한 +7KB 갱신"(대안 = 기존 0.17.0 문장 압축 / 신규 내용 축소 / 중단 — 불채택). 루프 직접 판정(ACCEPTED/OUT_OF_SCOPE/DEFERRED/DUPLICATE) 0건.

| fingerprint | severity | disposition | 근거 |
|---|---|---|---|
| fp-OF-P-R1-1 = task-02 §B ②(SC-5 spawn 1줄) · "재실행 시 이전 완료 마커와 리뷰 결과가 재사용됨(출력 append, 초기화 단계 없음 — 실패 재실행이 같은 R<N> 경로라 대기 즉시 종료·이전 JSON을 현재 결과로 판정)" · "기동 전 이전 프로세스 종료 확인·기존 출력 분리 후 현재 출력 초기화, 대기 재개는 초기화 안 함" | high | **FIXED** `6698f68` | SC-5·task-02 §B의 `fs.openSync(out,"a")` → `"w"`(기동 시 새로 씀), ② 산문에 재실행·이름 변경·`$L.pid` 생존 시 미기동(③으로) 명시, 대기 재개는 파일을 열지 않음. SC-5 ↔ task-02 diff 0 확인. task-02 Cautions에 `"a"` 회귀 금지 추가. 미확인 FIXED 큐 편입 |
| fp-OF-P-R1-2 = task-06 §5 · SC-7 · "지정 압축 후보로 AC9 상한(65,994B) 도달 불가 — task-02~05 교체문 합성 71,618B(+5,624B 초과), 후보 전부 제거해도 70,065B, 구현자가 plan 밖 대규모 재작성을 결정해야 함" · "상한을 만족하는 교체문을 plan에서 확정, SC-7·task별 예상 크기를 합성 결과에 맞출 것" | medium | **ESCALATE(즉시) → 사용자 판정 → FIXED** `6698f68` | 루프 재현: 합성 71,618B 일치. 신규 문면 압축 2회(근거 1줄 수준) → 68,378B(+6,480B)로 +4KB 불가 확정 → 즉시 ESCALATE(3택 + 중단). **사용자 판정: D34 상한 +7KB(≤69,066B)로 갱신**(컨텍스트 비용 ≈1K토큰/세션 < 라운드 소실 1건). 반영: spec D34 행·AC9·재논의 금지 블록, plan 재논의 금지 블록·SC-7(합성값 4점 + 소프트 예산)·task-02~05 SIZE_OK·task-06 상한/Caution. 압축 교체문은 유지(AC grep 전 항목 합성본에서 기대값 일치 확인). 미확인 FIXED 큐 편입 |
| fp-OF-P-R1-3 = task-06 §3(:51) · "GREEN 재실행이 수정 전 스킬 사본을 계속 검사 — 사본 생성은 단계 1에만 있고 불통과 수정·단계 5 압축 뒤 재생성 없음(GREEN 증거 ≠ 배포 문면)" · "RL 수정·압축 후 사본 재생성·영향 케이스 재실행, 원본·사본 동일성 확인 절차" | medium | **FIXED** `6698f68` | task-06 순서 재배치: 훅 GREEN → AC grep → AC9 확정(압축·커밋) → **확정 문면에서** 사본 `cp` + `cmp`(COPY_SYNC) → 22런. 불통과 수정 시 grep·AC9 재확인 → 사본 재생성 → 그 ID 재실행 명시. AC에 `cmp` 추가, outcome 문구에 COPY_SYNC, Caution 추가. 미확인 FIXED 큐 편입 |
| fp-OF-P-R1-4 = task-02 AC(:118-119) · task-06 §4 AC2 · "필수 삽입문(① 산문 `cache/openai-codex`·`sort -V`, SC-4 버전 비교 `sort -V`)이 AC2 0건 검사를 반드시 실패시킴(1건·2건)" · "금지 대상(glob 최신 정렬)과 버전 비교·설명 문구를 구분해 검사 범위를 정하거나 교체문 수정, SC-4·task-02·task-06 동기화" | medium | **FIXED** `6698f68` | ① 산문에서 리터럴 제거("캐시 디렉터리 glob 금지"), 0건 grep의 `sort -V` → `sort -V | tail`(glob 최신 정렬 = spec AC2 의도; SC-4의 `sort -V | head -1` 버전 비교는 대상 아님 — 주석으로 명시), task-02 자기 점검·AC, task-06 AC2·Caution 동기화. 합성본 grep: cache/openai-codex 0 · sort -V \| tail 0 · ls -d 0. 미확인 FIXED 큐 편입 |

| fp-OF-P-R2-1 = task-02 §B ③ (1)(:78) · "완료 후 중단 지시(HOOK-② 뒷 문장)에 넛지 수신 조건이 없어 백그라운드 기본 아래 임계 미만 정상 라운드도 판정 없이 중단됨 — task-05 경로 ① 한정 분기와 충돌, N1 하네스는 넛지 상황만 검사" · "완료 전 /clear 금지는 항상, 기록 후 중단은 넛지 수신 시로 인용문 밖에서 명시 + 무넛지 완료 대조 케이스" | medium | **FIXED** `63fce1f` | task-02 §B (1) 인용 뒤에 "앞 문장 항상 · 뒷 문장은 넛지 받은 세션에만(§2i 경로 ①), 무넛지 완료는 ④→§2c 정상 진행" 추가(SC-3 인용 바이트 불변, Caution 추가). 하네스 N0(N1 동일 상태·무넛지, 기대 NEXT_UNIT_STARTED=yes·COUNTER 3·auto·CLEAR no, 3런/arm — cur도 통과하는 회귀 가드) task-01(프롬프트·RUN·PLAN·tally·RED 표·AC 25런)·task-06(25런·AC 2줄·outcome)·SC-6 반영. 미확인 FIXED 큐 편입 |
| fp-OF-P-R2-2 = task-10 §3 AC11(:48-57) · "10분 미만 라운드에서 `timeout 570` 대기 명령만 끊고 재대기하는 것은 Bash 도구 자체의 timeout kill을 발생시키지 않아 Windows 미검증 분리 실행의 생존을 확인하지 않고 AC11을 통과로 채울 수 있음(D37 확인 방법 누락)" · "실제 도구 timeout을 라운드 중 발생시키는 절차 + 동일 래퍼 pid 생존·동일 라운드 마커 회수 기록, 대기 명령만 끊은 결과는 별도 항목·근거 불인정" | medium | **FIXED** `63fce1f` | AC11 절을 3단계(① 셸 `timeout` 없는 until-loop를 Bash 도구 `timeout` 인자 < 라운드 소요로 실행 → 도구 kill 시각 기록 ② `kill -0` = 0 + pid 동일 ③ 같은 `$L.out`에서 마커·헤더·로그 회수)로 재정의, 표 컬럼 3개로 교체, 정상 완료·`WAIT_EXPIRED`만 본 라운드는 비고 줄·근거 불인정, Windows 실패 정의를 ②③에 연결. 설치 안내 문안 갱신. 미확인 FIXED 큐 편입 |

| fp-OF-P-R3-1 = task-02 §B ③ 대기 명령 · SC-5(:73-77) · "공통 대기 명령이 macOS에 없는 `timeout`에 의존(doctor SKILL.md:130 실측: timeout·gtimeout 부재) — 맥북에서 즉시 WAIT_EXPIRED, 재대기도 반복 실패, 구현자가 대기 방식을 새로 결정" · "보장된 의존성의 유계 대기로 확정하고 SC-5·task-02·AC11 동기화" | medium | **FIXED** `ec031b4` | 대기 명령을 `for i in $(seq 38); do grep -q … && break; sleep 15; done; grep -q … \|\| echo WAIT_EXPIRED`(38×15초 = 570초, bash 내장 + seq)로 교체 — SC-5·task-02 §B ③ 바이트 동일, SC-5 주석에 DR:130 근거, task-02 자기 점검·AC에 외부 timeout 0건·`seq 38` 1건 grep, Caution 추가, AC11 ①(유계 없는 until-loop)·③(규약 유계 루프) 문구 동기화. 루프 세션 실측: 마커 감지 시 즉시 종료(WAIT_OK). 미확인 FIXED 큐 편입 |
| fp-OF-P-R3-2 = task-10 §2(:36-38)·AC(:92) · "릴리스 no-AI-trace 검사(`-liE 'co-authored-by\|generated with \[claude'`)가 규칙 문구·grep 예시를 위반으로 검출 — 현 diff에서 엔트리포인트·task-07·task-10 오탐, task-07 후 WPS 계약 블록도 검출, RL만 예외라 계획대로 구현해도 릴리스 검사 실패" · "실제 서명과 규칙·예시를 구분하는 검사 범위·판정 방법 명시" | medium | **FIXED** `ec031b4` | 파일 검사를 트레일러 실형 앵커 `^(Co-Authored-By\|Claude-Session): \|Generated with \[Claude Code\]\(`(대소문자 실형, 행 머리·링크형 푸터)로, 커밋 메시지 검사(§2·AC)를 `-ciE '^(co-authored-by\|claude-session): \|generated with \[claude code\]\('`로 교체 — RL 예외 처리 제거, 규칙 문구(백틱 인용)·RL §4 소문자 예시·WPS 조건부 서술은 비검출임을 주석에 명시. 루프 세션 실측: 현 diff 파일 0건·커밋 메시지 0건. 미확인 FIXED 큐 편입 |

| fp-OF-P-R4-1 = task-06 §5(:75-79) · task-01 PLAN.md · "공용 RL 문면 수정 후 실패한 ID만 재실행하면 교차 회귀를 놓침 — 이전 문면에서 통과한 다른 ID 출력이 그대로 집계돼 서로 다른 문면의 결과로 25런 GREEN·impl 게이트 통과 선언 가능(COPY_SYNC는 사본↔HEAD만 비교)" · "문면 변경 시 그 문면을 쓰는 케이스의 이전 결과를 무효화·재실행(N0·N1 함께), 최종 GREEN이 최종 문면 결과인지 확인, PLAN.md·Cautions의 '그 ID만 재실행' 동기 수정" | medium | **FIXED** `479065e` | task-06 §5: 재실행 범위 = 바뀐 사본을 읽는 케이스 전부(RL 사본 → `rm out/new/{V1..V4,N0,N1}-r*` 후 22런, 훅 → hook-new.txt 재생성 후 N1·N2 10런, N2는 RL 미사용), AC에 `RUNS_FRESH`(find ! -newer 사본 = 빈 출력 — RL·훅 사본 각각), outcome 문구·Caution 2건 갱신. task-01 PLAN.md 런 수 문단 동기(그 ID만 → 사본을 읽는 케이스 전부 + RUNS_FRESH 참조). 미확인 FIXED 큐 편입 |

- **R1**(적대, 2026-09-22 05:45~05:49, target `b0acbfc`): verdict needs-attention · 신규 4(high 1·medium 3) · FIXED 3 + ESCALATE→FIXED 1 · 가드 일치(DUPLICATE) 0 · low 0. 유효성: 마커 `COMPANION_EXIT:0` · 헤더 1 · 명령 실행 로그 16건 · `bwrap:` 0 → 유효. 수정 커밋 `6698f68`(plan 6파일 + spec D34/AC9).
- **R2**(적대, 2026-09-22 06:29~06:32, target `4e7c02f`): verdict needs-attention · 신규 2(medium 2) · FIXED 2 · DUPLICATE 0 · low 0. 유효성: 마커 `COMPANION_EXIT:0` · 헤더 1 · 명령 로그 17건 · `bwrap:` 0 → 유효. fp-OF-P-R1-1~4 적대 비재출현(R2, 참고 신호 — 큐 유지). 수정 커밋 `63fce1f`(plan 8파일 + spec AC9 수치). score 6→2 감소.
- **R3**(적대, 2026-09-22 06:36~06:38, target `ddb6a38`): verdict needs-attention · 신규 2(medium 2) · FIXED 2 · DUPLICATE 0 · low 0. 유효성: 마커 `COMPANION_EXIT:0` · 헤더 1 · 명령 로그 15건 · `bwrap:` 0 → 유효. fp-OF-P-R1-1~4·R2-1~2 적대 비재출현(R3, 참고 신호 — 큐 유지). 수정 커밋 `ec031b4`. 적대 소진 3 = auto-rounds → batch 적재 0건(flush 없음) → R4부터 정밀 모드. **운영 기록**: R4 1차 기동(06:42, target `0c3f46b`)은 수정 커밋 누락 상태(체인 중단으로 ledger 라벨 커밋만 생성)에서 떠서 즉시 중단(래퍼 kill + companion job cancel), `0c3f46b`를 soft reset해 수정 커밋 `ec031b4` → ledger 커밋으로 재구성, R4 재기동. 적대 소진 미반영(응답 미수신).
- **R4**(적대, 2026-09-22 06:43~06:46, target `af69565`, 정밀 모드): verdict needs-attention · 신규 1(medium 1) · FIXED 1 · DUPLICATE 0 · low 0. 유효성: 마커 `COMPANION_EXIT:0` · 헤더 1 · 명령 로그 23건 · `bwrap:` 0 → 유효. fp-OF-P-R1-1~R3-2(8건) 적대 비재출현(R4, 참고 신호 — 큐 유지). 수정 커밋 `479065e`.
