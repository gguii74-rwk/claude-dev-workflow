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
node -e 'const fs=require("fs"),[sh,out,pid]=process.argv.slice(1),fd=fs.openSync(out,"a");
const c=require("child_process").spawn("bash",[sh],{detached:true,stdio:["ignore",fd,fd]});fs.writeFileSync(pid,String(c.pid));c.unref()' "$L.sh" "$L.out" "$L.pid"
# 대기(run_in_background: true 또는 Monitor) — 이 명령이 끝나면 턴도 끝난다
timeout 570 bash -c "until grep -q '^COMPANION_EXIT:' '$L.out'; do sleep 15; done"; grep -q '^COMPANION_EXIT:' "$L.out" || echo WAIT_EXPIRED
```
확인 라운드의 래퍼 명령 = `node "$ROOT/scripts/codex-companion.mjs" task --prompt-file "$L.prompt"`(나머지 동일). 생존 확인 = `kill -0 "$(cat "$L.pid")"` — `pgrep -f` 금지. `setsid` 문자열 금지(macOS 부재).

### SC-6. 하네스 규약 (spec §6 · task-01 작성 · task-06 GREEN)

- 위치 `H=$HOME/workspace/claude-memories/claude-dev-workflow/remember/harness-0.18.0` (= 이 repo `.remember/harness-0.18.0`, 심링크). repo에 커밋하지 않는다(claude-memories 커밋은 사용자 몫). 판정 기준은 `PLAN.md`(호출자 전용)에만 두고 `RUN.md`·프롬프트에는 **절대 넣지 않는다**(7b 교훈: 기대 답 노출 런 60개 폐기).
- arm: `cur` = 0.17.0 문면(`$H/skills/review-loop-cur.md` · `$H/skills/hook-cur.txt`) / `new` = 웨이브 1 완료 HEAD 문면(`review-loop-new.md` · `hook-new.txt`). 스킬 사본으로만 읽는다 — `Skill` 도구 호출 금지.
- 케이스: `V1~V4`(§2b 유효성 픽스처 4종, 프롬프트 `prompts/V.md`, 3런/arm) · `N1`(RL 라운드 진행 중 넛지→완료 알림, auto-rounds 경계, `prompts/N1.md`, 5런/arm) · `N2`(비루프 harden 질문 대기 중 넛지, `prompts/N2.md`, 5런/arm). 출력 `$H/out/<arm>/<ID>-r<REP>.md`, 집계 `bash $H/tally.sh <arm>`.
- 훅 = `node $H/hook-cases.mjs <hook 경로>`(decideNudge 직접 import, 최초·재넛지 문구에 SC-3 ①②③ 포함 여부).
- 결과 기록 = `.remember/tdd-opshub-field-defect-fixes.md`(형식 = `tdd-7c-loop-handoff.md`) + 이 문서 task 표 outcome. cur arm이 이미 통과하는 축은 "효과 미확인(자동 보완)"으로 적는다 — RED 미재현은 plan 실패가 아니라 기록 대상이다.

### SC-7. AC9 규모 (D34)

기준 61,898B → 상한 **65,994B**(`wc -c dev-workflow/skills/review-loop/SKILL.md`). 소프트 예산: task-02 후 ≤ 63,900 · task-03 후 ≤ 64,800 · task-04 후 ≤ 65,300 · task-05 후 ≤ 65,900. 하드 확인 = task-06(초과 시 task-06 §압축 후보에서 줄인다 — 상한을 올리지 않는다).

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

> **이번 트랙 확정 결정 = D1~D38(spec §4, 2026-09-21 harden-spec, 전부 사용자 확정)** — 적대검증(plan·impl)에서 재론하지 않는다. 특히: D1 백그라운드 대기 기본 · D2 SLIM D15 → 순서 규정 대체 · D3 유효성 조건(실행 로그 ≥1, 전면 실패만 무효) · D4 스크립트 비동봉·node 1줄 · D5 세션 결속 해제 미채택 · D7 자동 재실행 금지 유지 · D16 라운드마다 경로 해소 · D25 15%p·PreToolUse 불변 · D26 루프 파일 필드 불변 · D33 트레일러 조건부 · D34 +4KB · D35 2웨이브 · D37 실사용 완료 조건.
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
