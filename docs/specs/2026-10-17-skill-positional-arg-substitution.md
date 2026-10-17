# SKILL.md 셸 블록의 위치 인자 표기가 스킬 인자로 치환되는 결함 (1.1.1 패치)

- 단계: **1–2 spec 초안 (2026-10-17)**
- 경로: **경량**(사용자 판정 2026-10-17 — 1.1.0 트랙 종결 핸드오프 「다음 실행 지점 1」) — D1.
- 출처: 1.1.0 트랙 AC6 (ii) 부수 발견(`docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md` §4 AC6 기록 · §7 끝 줄) · 2026-10-17 맥북 실측(Claude Code 2.1.302, 아래 §1 사실) · Claude Code 공식 문서 `code.claude.com/docs/en/skills` 「Available string substitutions」.
- 대상: `dev-workflow/skills/review-loop/SKILL.md`(§확인 모드 실행 ≈160행 래퍼 명령 · §2b ② 산문 1구절 + 래퍼 2행 ≈302–303) · `dev-workflow/skills/doctor/SKILL.md`(≈97–98행 awk 2줄) · `dev-workflow/.claude-plugin/plugin.json`(1.1.0→1.1.1, 9 릴리스) · `docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md` §7 끝 줄(이 spec 포인터 1구절).

## 1. 문제

**사실(공식 문서 + 2026-10-17 실측, Claude Code 2.1.302).** Claude Code는 스킬을 불러올 때 SKILL.md 본문의 `$ARGUMENTS`·`$ARGUMENTS[N]`·`$N`(= `$ARGUMENTS[N]` 약식)을 호출 인자로 치환한다.

- **번호는 0부터**다 — `$0` = 첫 인자, `$1` = 둘째 인자. 인자는 셸식 인용으로 나뉜다.
- **펜스 코드 블록 안과 인라인 코드 안도 치환된다**(실측).
- 그 위치에 인자가 없으면 `$N`은 원문 그대로 남는다. 인자 없이 부르거나 인자가 적은 호출에서 증상이 보이지 않았던 이유다.
- **맨 `$N`이 인자를 하나라도 받으면 `ARGUMENTS: <원 인자>` 덧붙임이 꺼진다**(문서 + 실측 — 같은 인자로 맨 `$N` 본문은 덧붙임 없음, `${N}` 본문은 덧붙임 있음). Claude Code는 본문의 placeholder가 인자를 받지 못했을 때만 원 인자 문자열을 끝에 붙여 준다.
- 치환되지 않는 표기(실측): `${1}`·`$(2)`·`${@:2:1}`·`"$@"`·`$RL_DIR`. 공식 탈출 `\$1`은 인자 유무와 무관하게 백슬래시가 지워져 `$1`로 보인다.

**결함 ① review-loop.** §2b ② 래퍼(`cd "$1"` · `node "$2/scripts/codex-companion.mjs" … --base "$4" -- "$(cat "$3.focus")"`)와 §확인 모드 실행의 래퍼 명령(`node "$2/…" task --prompt-file "$3.prompt"`)이 인자 위치값으로 바뀌어 모델에게 보인다. `/review-loop --phase spec --security yes <대상> <base>`에서는 `cd "spec"` · `node "--security/scripts/…"` · `--base "<대상>"` · `"yes.focus"`가 된다(AC6 (ii) 관찰 = 위 규칙으로 정확히 재현). 문자 그대로 따르면 exit 97 또는 node 실행 실패로 라운드가 뜨지 않는다. 지금까지는 모델이 스스로 재구성해 라운드가 정상 기동했다. 도입 = `eb38fd8`(2026-09-22, 래퍼를 quoted heredoc + argv 전달로 바꾼 보안 수정 — fp-OF-I-R1-1). 그 보안 성질 자체는 옳고, 표기만 치환에 걸린다.

**결함 ② ARGUMENTS 덧붙임 소실.** 같은 이유로 인자를 2개 이상(위치 1 이상이 채워지게) 준 review-loop 호출에서는 원 인자 문자열이 본문 어디에도 들어오지 않는다. 지금까지는 대화 기록의 슬래시 명령 원문이나 모델이 Skill 도구에 넘긴 인자로 보완됐다.

**결함 ③ doctor(전수 점검으로 새로 발견).** ≈97–98행 awk 프로그램의 필드 참조 `$1`·`$2`가 같은 치환에 걸린다. `/doctor 넛지가 안 떠`처럼 단어 2개 이상 인자면 `$1`이, 3개 이상이면 `$2`도 바뀐다. 그러면 원격 기본 브랜치(HB)·OID 추출 awk가 깨지거나 엉뚱한 값을 낸다. 문자 그대로 따르면 원격 HEAD 판정이 틀어진다(진단 결과 오염). 같은 경로로 ARGUMENTS 덧붙임도 꺼진다.

**전수 점검 범위(2026-10-17).** `dev-workflow/skills/*/SKILL.md` 7종 + README 3종 + 그 밖의 추적 `.md`·`.json`(`docs/`·`.remember/` 제외 — 스킬 본문으로 로드되지 않는다)에서 `$[0-9]`·`$ARGUMENTS`·`arguments:` frontmatter를 찾았다. 결과는 review-loop 3곳(160·302·303행) · doctor 2줄(97·98행)뿐이다. 스킬이 Read로 읽는 부속 파일은 치환 대상이 아니다(치환은 SKILL.md 본문 로드 때만 일어난다).

## 2. 목표 / 범위 / 비목표

**목표** — 스킬 본문의 셸·awk 위치 참조가 어떤 인자로 호출해도 원문 그대로 모델에게 보이게 한다. 그 결과 Claude Code의 `ARGUMENTS:` 덧붙임도 정상 복귀한다. `eb38fd8` 보안 성질(래퍼는 quoted heredoc, 경로·L·base는 argv로 전달 — 파일명 속 `$(…)` 비실행)은 그대로 유지한다.

**범위**
- review-loop: 160행 래퍼 명령 `$2`·`$3` → `${2}`·`${3}` · 302–303행 `$1`~`$4` → `${1}`~`${4}` · §2b ② 산문의 「래퍼는 quoted heredoc·경로는 argv(…)」 구절에 이유 1구절(D3).
- doctor: 97–98행 awk `$1`·`$2` → `$(1)`·`$(2)` + 같은 블록에 이유 주석 1줄(D3).
- 1.1.0 spec §7 끝 줄에 「→ 1.1.1 트랙 `docs/specs/2026-10-17-skill-positional-arg-substitution.md`」 포인터 1구절.
- 9 릴리스: plugin.json 1.1.1.

**비목표**
- 래퍼 구조 변경(환경변수 전달·스크립트 동봉) — D2.
- repo 상설 검사 스크립트·게이트 신설 — D3(재발 방지는 이유 구절 + AC grep까지).
- review-loop §인자 해석 규칙 변경 — 덧붙임 복귀는 Claude Code 기본 동작이며, 인자 해석 문면은 그대로 둔다.
- `${CLAUDE_*}` 치환 활용, README 문면 변경(사용자 대면 동작 변화 없음).

## 3. 설계

### 3a. 표기 (D2)
- bash 위치 매개변수는 중괄호형 `${N}`을 쓴다. 의미는 `$N`과 같고(bash 문법), Claude Code 2.1.302는 치환하지 않는다(실측). quoted heredoc(`<<'EOF'`) 안이라 heredoc 생성 단계에서는 확장되지 않고, 래퍼 실행 때 argv에서 확장된다. 보안 성질은 변하지 않는다.
- awk 필드는 `$(N)`을 쓴다(POSIX awk 문법 — `$` 뒤 식). BSD awk 20200816에서 실측했다.
- 사전 검증(브레인스토밍, 2026-10-17): `${N}` 래퍼 + 주입 basename `loop-$(printf INJECTED >&2)-R1` + `$HOME` 포함 ROOT 경로 + focus 본문 `$(echo NO)`로 가짜 companion을 기동했다. 주입은 실행되지 않았고 argv는 원형(`["adversarial-review","--wait","--base","deadbeef","--","FOCUS TEXT $(echo NO)"]`), 마커는 `COMPANION_EXIT:0`이었다. awk `$(2)`·`$(1)`은 HB `refs/heads/main`·40자 OID를 정상 추출했다.

### 3b. 재발 방지 (D3)
- review-loop §2b ②: 기존 구절 「래퍼는 quoted heredoc·경로는 argv(셸 소스에 보간하면 파일명 속 `$(…)`가 실행된다)」 뒤에 「· 위치 인자는 `${N}`(맨 `$`+숫자는 Claude Code가 스킬 인자로 치환한다)」 취지 1구절을 붙인다.
- doctor 97–98행 블록: 「awk 필드는 `$(N)` — 맨 `$`+숫자는 스킬 인자로 치환된다」 취지 주석 1줄.
- 이유 문구 자체에 `$`+숫자를 쓰지 않는다(자기 치환 회피 — AC1 grep이 잡는다).

## 4. Acceptance Criteria

- **AC1 (전수 0건)**: `grep -nE '\$[0-9]' dev-workflow/skills/*/SKILL.md` = 0건. `grep -n '\$ARGUMENTS' dev-workflow/skills/*/SKILL.md` = 0건(현행 유지).
- **AC2 (표기 반영)**: review-loop에 `cd "${1}" || exit 97` · `node "${2}/scripts/codex-companion.mjs" adversarial-review --wait --base "${4}" -- "$(cat "${3}.focus")"` · `node "${2}/scripts/codex-companion.mjs" task --prompt-file "${3}.prompt"` 각 1건. doctor에 `print $(2)` · `$(2)=="HEAD" && $(1) ~` · `print $(1)` 각 1건. 이유 구절·주석 각 1건(D3).
- **AC3 (보안 성질 회귀)**: §3a 사전 검증과 같은 주입 재현을 수정된 SKILL.md 래퍼 원문(heredoc 본문을 파일에서 추출)으로 다시 돌린다. 기대: 주입 미실행 · argv 원형 · 마커 `COMPANION_EXIT:0`.
- **AC4 (치환 실측 — 로드 결과)**: 수정된 review-loop·doctor SKILL.md를 임시 프로젝트 스킬로 복사해 `claude -p`로 인자 6개(`--phase spec --security yes docs/specs/x.md abc123`)·1개·0개로 각각 부른다. 세션 transcript에 기록된 로드 본문을 확인한다. 기대:
  - 래퍼·awk 줄이 원문과 바이트 동일
  - 인자가 있는 호출에서는 본문 끝에 `ARGUMENTS: <원 인자>`가 붙음(결함 ② 복귀)
  - 인자 0개 호출에서는 덧붙임 없음
- **AC5 (doctor 동작)**: 수정된 97–98행을 실제 `git ls-remote --symref origin HEAD` 출력(이 repo)에 돌려 HB·OID가 수정 전 awk 결과와 같다.
- **AC6 (규모)**: review-loop SKILL.md 순증 ≤ +200B, doctor ≤ +150B(`wc -c` 전후).
- **AC7 (포인터)**: 1.1.0 spec §7 끝 줄에 이 spec 경로 1건.

## 5. 결정사항
§재논의 금지 D1~D3.

## 6. 미해결 질문
- (없음 — harden에서 채운다)

## 잔여 리스크 (DEFERRED)
- 향후 Claude Code가 `${N}` 형태도 치환하게 바뀌면 재발한다. 현 문서는 중괄호형 placeholder를 `${CLAUDE_*}`로만 정의한다. AC1 grep은 그 변화를 잡지 못한다.

## 재논의 금지(기결정)

| D | 결정 | 근거 |
|---|---|---|
| D1 | 경로 = 경량, 1.1.1 패치 | 사용자 판정 2026-10-17(1.1.0 종결 핸드오프 다음 실행 지점 1) |
| D2 | 표기 = bash `${N}` · awk `$(N)`(백슬래시 탈출 `\$N`·환경변수 전달·스크립트 동봉 불채택) | 사용자 판정 2026-10-17(브레인스토밍). 치환 안 됨 실측 · 원문이 유효한 셸로 읽힘(codex·사람) · 탈출 미지원 버전에서 `"\$1"`이 문자 `$1`이 되는 위험 없음 · 변경 최소(≈+12B) · eb38fd8 argv 구조 무변경 |
| D3 | 재발 방지 = 이유 1구절(review-loop §2b ②) + 주석 1줄(doctor) + AC1 grep. 상설 검사 스크립트 없음 | 사용자 판정 2026-10-17. 실사고(AC6) 근거가 있는 최소 장치 · L1(성장은 실측 뒤) |
