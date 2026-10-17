# SKILL.md 셸 블록의 위치 인자 표기가 스킬 인자로 치환되는 결함 (1.1.1 패치)

- 단계: **1–2 spec 초안 (2026-10-17) → 3 harden-spec 완료 (2026-10-17, 갭 대장 22건 — 사실 13건 조회 해소 · 판단 9건 질문 해소 · DEFERRED 0)**
- 경로: **경량**(사용자 판정 2026-10-17 — 1.1.0 트랙 종결 핸드오프 「다음 실행 지점 1」) — D1. 생략은 **5 plan만**(6은 5가 해당없음이라 자동) · 4 spec 적대검증과 8 impl 적대검증은 수행 · impl ledger = 이 spec 말미 — D5.
- review-loop 호출(4·8): **`--security yes`** + `--auto-rounds 1` 권고 — D4.
- 출처: 1.1.0 트랙 AC6 (ii) 부수 발견(`docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md` §4 AC6 기록 · §7 끝 줄) · 2026-10-17 맥북 실측(Claude Code 2.1.302, 아래 §1 사실) · Claude Code 공식 문서 `code.claude.com/docs/en/skills` 「Available string substitutions」 · Claude Code `CHANGELOG.md`(2.1.19 · 2.1.163 · 2.1.210 항목) · 이 맥북 세션 transcript(`~/.claude/projects/`, review-loop·doctor 실제 로드 기록).
- 대상: `dev-workflow/skills/review-loop/SKILL.md`(§확인 모드 실행 ≈160행 래퍼 명령 · §2b ② 산문 1구절 + 래퍼 2행 ≈302–303) · `dev-workflow/skills/doctor/SKILL.md`(≈97–98행 awk 2줄 + 주석 1줄) · `dev-workflow/.claude-plugin/plugin.json`(1.1.0→1.1.1, 9 릴리스) · `docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md` §7 끝 줄(이 spec 포인터 1구절).

## 1. 문제

**사실(공식 문서 + 2026-10-17 실측, Claude Code 2.1.302).** Claude Code는 스킬을 불러올 때 SKILL.md 본문의 `$ARGUMENTS`·`$ARGUMENTS[N]`·`$N`(= `$ARGUMENTS[N]` 약식)을 호출 인자로 치환한다.

- **번호는 0부터**다 — `$0` = 첫 인자, `$1` = 둘째 인자. 인자는 셸식 인용으로 나뉜다.
- **펜스 코드 블록 안과 인라인 코드 안도 치환된다**(실측).
- 그 위치에 인자가 없으면 `$N`은 원문 그대로 남는다(2.1.210 이상). 인자 없이 부르거나 인자가 적은 호출에서 증상이 보이지 않았던 이유다.
- **맨 `$N`이 인자를 하나라도 받으면 `ARGUMENTS: <원 인자>` 덧붙임이 꺼진다**(문서 + 실측 — 같은 인자로 맨 `$N` 본문은 덧붙임 없음, `${N}` 본문은 덧붙임 있음). Claude Code는 본문의 placeholder가 인자를 받지 못했을 때만 원 인자 문자열을 끝에 붙여 준다.
- 치환되지 않는 표기(실측): `${1}`·`$(2)`·`${@:2:1}`·`"$@"`·`$RL_DIR`. 공식 탈출 `\$1`은 인자 유무와 무관하게 백슬래시가 지워져 `$1`로 보인다.
- **버전 연혁(CHANGELOG)**: 2.1.19 `$0`·`$1` 약식 도입 · 2.1.163 `\$` 탈출 도입 · **2.1.210 「인자를 받지 못한 `$1`/`$2`가 조용히 삭제되던 것」 수정**. 따라서 2.1.19~2.1.209에서는 인자가 없는 위치의 `$N`이 빈 문자열이 된다 — 인자 0개 호출에서도 review-loop 래퍼는 `cd "" || exit 97`가 되고, doctor awk는 인자 없이 불러도 항상 깨진다(`{print ; exit}` · `=="HEAD" && ~ /…/`).

**결함 ① review-loop.** §2b ② 래퍼(`cd "$1"` · `node "$2/scripts/codex-companion.mjs" … --base "$4" -- "$(cat "$3.focus")"`)와 §확인 모드 실행의 래퍼 명령(`node "$2/…" task --prompt-file "$3.prompt"`)이 인자 위치값으로 바뀌어 모델에게 보인다. `/review-loop --phase spec --security yes <대상> <base>`에서는 `cd "spec"` · `node "--security/scripts/…"` · `--base "<대상>"` · `"yes.focus"`가 된다(AC6 (ii) 관찰 = 위 규칙으로 정확히 재현). 문자 그대로 따르면 exit 97 또는 node 실행 실패로 라운드가 뜨지 않는다. 도입 = `eb38fd8`(2026-09-22, 래퍼를 quoted heredoc + argv 전달로 바꾼 보안 수정 — fp-OF-I-R1-1). 그 보안 성질 자체는 옳고, 표기만 치환에 걸린다.

**실피해(잠복 결함).** 이 맥북 transcript 기준 review-loop 실제 로드 8회 중 6회가 깨진 본문이었다(`cd "spec"`·`cd "impl"`, Claude Code 2.1.281·2.1.302). 같은 기록의 래퍼 실행 13회(적대 9 · 확인 4)는 전부 모델이 올바른 `$1`…`$4`로 재구성했고, 실패는 0이었다. 지금까지 피해는 없지만 모델의 재구성에 기대고 있다.

**결함 ② ARGUMENTS 덧붙임 소실.** 같은 이유로 인자를 2개 이상(위치 1 이상이 채워지게) 준 review-loop 호출에서는 원 인자 문자열이 본문 어디에도 들어오지 않는다. 지금까지는 대화 기록의 슬래시 명령 원문이나 모델이 Skill 도구에 넘긴 인자로 보완됐다.

**결함 ③ doctor(전수 점검으로 새로 발견).** ≈97–98행 awk 프로그램의 필드 참조 `$1`·`$2`가 같은 치환에 걸린다. `/doctor 넛지가 안 떠`처럼 단어 2개 이상 인자면 `$1`이, 3개 이상이면 `$2`도 바뀐다(2.1.19~2.1.209에서는 인자가 없어도 삭제). 그러면 원격 기본 브랜치(HB)·OID 추출 awk가 깨지거나 엉뚱한 값을 낸다. 문자 그대로 따르면 원격 HEAD 판정이 틀어진다(진단 결과 오염). 같은 경로로 ARGUMENTS 덧붙임도 꺼진다. 이 맥북의 doctor 실제 로드 기록(2.1.281·2.1.296)은 모두 인자 없는 호출이라 원문이 유지됐다.

**전수 점검 범위(2026-10-17).**
- `$N` 계열: `dev-workflow/skills/*/SKILL.md` 7종 + README 3종 + 그 밖의 추적 `.md`·`.json`(`docs/`·`.remember/` 제외 — 스킬 본문으로 로드되지 않는다)에서 `$[0-9]`·`$ARGUMENTS`·`arguments:` frontmatter를 찾았다. 결과는 review-loop 3곳(160·302·303행) · doctor 2줄(97·98행)뿐이다. 스킬이 Read로 읽는 부속 파일은 치환 대상이 아니다(치환은 SKILL.md 본문 로드 때만 일어난다).
- `${CLAUDE_*}` 계열: `${CLAUDE_CODE_PLUGIN_CACHE_DIR:-…}`·`${CLAUDE_CONFIG_DIR:-…}`·`${CLAUDE_CTX_LIMIT:-…}`(review-loop 289행 · doctor 34·35·255행)는 이 맥북의 실제 플러그인 로드(0.19.0~1.0.3) 전부에서 원형이 유지됐다. `:-` 기본값형은 치환 대상이 아니므로 범위 밖이다.
- 로드 시 셸 실행 문법 `` !` ``: 0건.
- 교차 영향: 이 맥북의 다른 repo·사용자 스킬은 0건이다(Anthropic 동기화 xlsx 스킬만 해당 — 대상 아님). eval 하네스·훅 스크립트도 옛 래퍼 문자열에 의존하지 않는다(0건). §2b ② 산문은 훅과의 바이트 동일 제약(SC-3) 대상 문장이 아니다. `$L.sh`는 라운드마다 다시 쓰이므로(≈300행) 진행 중인 루프의 이행 문제가 없다.

## 2. 목표 / 범위 / 비목표

**목표** — 스킬 본문의 셸·awk 위치 참조가 어떤 인자로 호출해도(그리고 2.1.210 이전처럼 미매칭 placeholder를 지우는 버전에서도) 원문 그대로 모델에게 보이게 한다. 그 결과 Claude Code의 `ARGUMENTS:` 덧붙임도 정상 복귀한다. `eb38fd8` 보안 성질(래퍼는 quoted heredoc, 경로·L·base는 argv로 전달 — 파일명 속 `$(…)` 비실행)은 그대로 유지한다.

**범위**
- review-loop: 160행 래퍼 명령 `$2`·`$3` → `${2}`·`${3}` · 302–303행 `$1`~`$4` → `${1}`~`${4}` · §2b ② 산문의 「래퍼는 quoted heredoc·경로는 argv(…)」 구절에 이유 1구절(D3).
- doctor: 97–98행 awk `$1`·`$2` → `$(1)`·`$(2)` + 같은 블록에 이유 주석 1줄(D3).
- 1.1.0 spec §7 끝 줄에 「→ 1.1.1 트랙 `docs/specs/2026-10-17-skill-positional-arg-substitution.md`」 포인터 1구절(D10).
- 9 릴리스: plugin.json 1.1.1(패치 릴리스 선례 — 1.0.1~1.1.0 release 커밋은 plugin.json만 바꿨고, marketplace.json에는 버전 필드가 없다).
- 릴리스 뒤 맥북 설치본 실측 1회 = 트랙 완료 조건(AC8, D6).

**비목표**
- 래퍼 구조 변경(환경변수 전달·스크립트 동봉) — D2.
- repo 상설 검사 스크립트·게이트 신설 — D3(재발 방지는 이유 구절 + AC grep까지).
- review-loop·doctor §인자 문면 변경 — 덧붙임 복귀는 Claude Code 기본 동작이다(D11).
- 구버전(2.1.19~2.1.209) Claude Code 실측(D9) · doctor 치환 탐지 항목(D12) · spark2·Windows 설치본 실측(D6).
- `${CLAUDE_*}` 치환 활용, README 문면 변경(사용자 대면 동작 변화 없음 — 패치 릴리스 선례).

## 3. 설계

### 3a. 표기 (D2)
- bash 위치 매개변수는 중괄호형 `${N}`을 쓴다. 의미는 `$N`과 같고(bash 문법), Claude Code 2.1.302는 치환하지 않는다(실측). quoted heredoc(`<<'EOF'`) 안이라 heredoc 생성 단계에서는 확장되지 않고, 래퍼 실행 때 argv에서 확장된다. 보안 성질은 변하지 않는다.
- awk 필드는 `$(N)`을 쓴다(POSIX awk 문법 `$` 식 — `$(NF-1)`과 같은 관용형이라 BSD awk·gawk·mawk 공통). BSD awk 20200816에서 실측했다.
- 사전 검증(브레인스토밍·harden, 2026-10-17, **bash·zsh 양쪽**): `${N}` 래퍼 + 주입 basename `loop-$(printf INJECTED >&2)-R1` + `$HOME` 포함 ROOT 경로 + focus 본문 `$(echo NO)`로, SKILL.md와 같은 node spawn 1줄을 통해 가짜 companion을 기동했다. 주입은 실행되지 않았고 argv는 원형(`["adversarial-review","--wait","--base","deadbeef","--","FOCUS TEXT $(echo NO)"]`), 마커는 `COMPANION_EXIT:0`이었다. awk `$(2)`·`$(1)`은 HB `refs/heads/main`·40자 OID를 정상 추출했다.

### 3b. 재발 방지 (D3)
- review-loop §2b ②: 기존 구절 「래퍼는 quoted heredoc·경로는 argv(셸 소스에 보간하면 파일명 속 `$(…)`가 실행된다)」 뒤에 「· 위치 인자는 `${N}`(맨 `$`+숫자는 Claude Code가 스킬 인자로 치환한다)」 취지 1구절을 붙인다. 근거 사례(review-loop 「신규 규칙 입증 책임」): 1.1.0 AC6 (ii) 관찰 + 이 맥북 로드 8회 중 6회 깨짐(§1).
- doctor 97–98행 블록: 「awk 필드는 `$(N)` — 맨 `$`+숫자는 스킬 인자로 치환된다」 취지 주석 1줄.
- 이유 문구 자체에 `$`+숫자를 쓰지 않는다(자기 치환 회피 — AC1 grep이 잡는다).

### 3c. 실측 격리 조건 (D8 — AC4·AC8 공통)
`claude -p`로 스킬을 불러 로드 본문을 볼 때, 모델이 본문 지시(커밋·codex 실행·메시지 전송)를 시작하지 못하게 한다.
- **repo 밖 스크래치 디렉터리**에서 실행한다(AC4의 사본 스킬은 `<스크래치>/.claude/skills/<이름>/SKILL.md`에 둔다).
- **`--tools "" --strict-mcp-config --max-turns 1`** — `--tools ""`만으로는 MCP 도구(Slack 전송·Drive 삭제 등)가 남는다(2026-10-17 실측). `--strict-mcp-config`를 더해야 도구 0개·MCP 0개가 된다. 이 조합에서도 플러그인은 로드돼 `/dev-workflow:review-loop` 슬래시 호출이 성립한다(init 이벤트로 확인).
- AC4의 사본은 frontmatter `name:`을 바꿔(`zz-` 접두) 플러그인 스킬과 겹치지 않게 한다. 비교 대상은 본문 줄이다.
- 로드 본문은 `--output-format stream-json --verbose`의 `session_id`로 `~/.claude/projects/` 아래 `<session_id>.jsonl`을 찾아, 「Base directory for this skill」로 시작하는 user 메시지에서 읽는다(stream-json 출력에는 로드 본문이 실리지 않는다).

## 4. Acceptance Criteria

- **AC1 (전수 0건)**: `grep -nE '\$[0-9]' dev-workflow/skills/*/SKILL.md` = 0건. `grep -n '\$ARGUMENTS' dev-workflow/skills/*/SKILL.md` = 0건(현행 유지).
- **AC2 (표기 반영)**: review-loop에 `cd "${1}" || exit 97` · `node "${2}/scripts/codex-companion.mjs" adversarial-review --wait --base "${4}" -- "$(cat "${3}.focus")"` · `node "${2}/scripts/codex-companion.mjs" task --prompt-file "${3}.prompt"` 각 1건. doctor에 `print $(2)` · `$(2)=="HEAD" && $(1) ~` · `print $(1)` 각 1건. 이유 구절(review-loop §2b ②)과 주석(doctor)이 각 1건 있고, 각각 `${N}`·`$(N)` 표기와 「스킬 인자」 문자열을 포함한다(D3).
- **AC3 (보안 성질 회귀 — bash·zsh)**: 수정된 review-loop SKILL.md에서 래퍼 heredoc 블록과 node spawn 1줄을 추출해, §3a 사전 검증과 같은 주입 재현을 **bash와 zsh 각각**으로 돌린다(메모리 규칙 — SKILL.md 셸 블록은 두 셸로 실측). 기대: 두 셸 모두 주입 미실행 · argv 원형 · 마커 `COMPANION_EXIT:0`.
- **AC4 (치환 실측 — 로드 결과, 릴리스 전)**: §3c 격리 조건으로 수정된 SKILL.md 사본을 부른다. review-loop은 인자 6개(`--phase spec --security yes docs/specs/x.md abc123`)·1개·0개, doctor는 인자 3개(`넛지가 안 떠`)·0개. 기대:
  - 래퍼·awk 줄이 원문과 바이트 동일
  - 인자가 있는 호출에서는 본문 끝에 `ARGUMENTS: <원 인자>`가 붙음(결함 ② 복귀)
  - 인자 0개 호출에서는 덧붙임 없음
- **AC5 (doctor 동작 — bash·zsh)**: 수정된 97–98행을 실제 `git ls-remote --symref origin HEAD` 출력(이 repo)에 **bash와 zsh 각각**으로 돌려, HB·OID가 수정 전 awk 결과와 같다.
- **AC6 (규모)**: review-loop SKILL.md 순증 ≤ +200B, doctor ≤ +150B(`wc -c` 전후) — D7.
- **AC7 (포인터)**: 1.1.0 spec §7 끝 줄에 이 spec 경로 1건 — D10.
- **AC8 (릴리스 뒤 맥북 설치본 실측 — 트랙 완료 조건, D6)**: 9 릴리스(plugin.json 1.1.1) push 뒤 맥북 user 스코프를 `/plugin update`로 1.1.1로 올린다. 그다음 §3c 격리 조건으로 `/dev-workflow:review-loop --phase spec --security yes docs/specs/x.md abc123`와 `/dev-workflow:doctor 넛지가 안 떠`를 각 1회 부른다. 기대:
  - 로드 본문의 Base directory 경로가 `/1.1.1/skills/`
  - 래퍼·awk 줄이 `${N}`·`$(N)` 원형
  - 본문 끝에 `ARGUMENTS:` 줄이 있음
  - spark2·Windows는 실측하지 않는다(D6).

## 5. 결정사항
§재논의 금지 D1~D12.

## 6. 미해결 질문
- 없음 — harden 2026-10-17에서 판단 갭 9건을 모두 질문으로 해소했다(G14~G22 → D4~D12).

## 잔여 리스크 (DEFERRED)
- **향후 Claude Code가 `${N}`·`$(N)` 형태도 치환하게 바뀌면 재발한다**(D12 — 사용자 판정 2026-10-17: 기록만). 현 문서는 중괄호형 placeholder를 `${CLAUDE_*}`로만 정의한다. AC1 grep은 그 변화를 잡지 못한다. 발생하면 실사용 중 깨진 본문으로 드러나고, D3 이유 구절이 원인을 가리킨다.
- **2.1.19~2.1.209 구버전에서 `${N}`·`$(N)` 비치환은 실측하지 않았다**(D9 — 사용자 판정 2026-10-17). 현행 맨 `$N`은 그 구버전에서 인자가 없어도 삭제돼 확실히 깨진다. 그래서 새 표기가 현행보다 나빠지는 경우는 없다. 이 맥북의 09-24 이후 기록은 전부 2.1.281 이상이다.

## 재논의 금지(기결정)

| D | 결정 | 근거 |
|---|---|---|
| D1 | 경로 = 경량, 1.1.1 패치 | 사용자 판정 2026-10-17(1.1.0 종결 핸드오프 다음 실행 지점 1). dev-cycle 정식 기준(보안 경계 접촉)과의 관계: 사용자는 `eb38fd8` 보안 성질 유지를 조건으로 경량을 판정했다(핸드오프 원문). 보안 쪽은 D4·AC3·4·8 적대검증으로 지키고, 생략은 5 plan뿐이다(D5) |
| D2 | 표기 = bash `${N}` · awk `$(N)`. 범위 = 전수 점검 결과 전부(review-loop 3곳 + doctor 2줄). 백슬래시 탈출 `\$N`·환경변수 전달·스크립트 동봉은 불채택 | 사용자 판정 2026-10-17(브레인스토밍). 근거: 치환 안 됨 실측 · 원문이 유효한 셸로 읽힘(codex·사람) · `\$` 탈출은 2.1.163부터라 그 전 버전에서는 `"\$1"`이 문자 `$1`이 됨(CHANGELOG) · 변경 최소(≈+12B) · eb38fd8 argv 구조와 09-18 D4(스크립트 비동봉) 무변경 |
| D3 | 재발 방지 = 이유 1구절(review-loop §2b ②) + 주석 1줄(doctor) + AC1 grep. 상설 검사 스크립트 없음 | 사용자 판정 2026-10-17. 실사고(AC6 · 로드 6/8) 근거가 있는 최소 장치 · L1(성장은 실측 뒤) |
| D4 | 이 트랙의 review-loop(4 spec · 8 impl)은 보안 크리티컬 — `--security yes` + `--auto-rounds 1` 권고 | 사용자 판정 2026-10-17(harden G14). 고치는 줄이 정확히 주입 방어 줄이라 표기 하나의 실수가 방어를 깬다. 변경이 작아 추가 비용이 작다 |
| D5 | 생략 = 5 plan만(6은 5 해당없음으로 자동). 4·8 수행. impl ledger = 이 spec 말미 `## 적대검증 ledger (impl)` | 사용자 판정 2026-10-17(harden G17). 근거: 3파일 수십 줄 변경이라 plan이 더할 것이 없음 · 보안 줄은 4·8에서 codex가 봄 · 1.1.0도 planless |
| D6 | 트랙 완료 조건 = 릴리스 뒤 맥북 설치본 실측 1회(AC8). spark2·Windows 실측 없음 | 사용자 판정 2026-10-17(harden G15). 임시 사본과 실제 설치본의 차이(로드 경로·버전 반영)를 가장 싸게 닫음 |
| D7 | AC6 크기 상한 유지(review-loop +200B · doctor +150B) | 사용자 판정 2026-10-17(harden G16). 이유 구절이 문단으로 불어나는 것을 막는 싼 장치 · review-loop은 크기 상한(SLIM·09-18 AC9)으로 비대화를 막아 온 파일 |
| D8 | AC4·AC8 실측은 §3c 격리 조건(repo 밖 · `--tools "" --strict-mcp-config --max-turns 1` · 사본 이름 변경 · transcript로 본문 확인) | 사용자 판정 2026-10-17(harden G18). `--tools ""` 단독은 MCP 도구가 남는다는 실측에 따라 `--strict-mcp-config`를 추가했다 |
| D9 | 구버전(2.1.19~2.1.209) 실측 안 함 — 잔여 리스크로 기록 | 사용자 판정 2026-10-17(harden G19). 4머신 자동 업데이트 · 현행 표기는 구버전에서 확실히 깨지므로 새 표기가 열등할 경우 없음 |
| D10 | 1.1.0 spec §7 끝 줄에 이 spec 포인터 1구절 | 사용자 판정 2026-10-17(harden G20). 선례: 1.1.0 트랙이 종결된 09-24 spec D8 행에 같은 방식 표기 |
| D11 | review-loop·doctor §인자 문면 무변경(`ARGUMENTS:` 덧붙임 복귀 안내 없음) | 사용자 판정 2026-10-17(harden G21). Claude Code 기본 동작이고, 모델은 지금도 인자를 읽어 왔다(래퍼 실행 13/13). 규칙 추가의 입증 사례 없음 |
| D12 | 향후 `${N}` 치환 변화 = 잔여 리스크 기록만(doctor 탐지 항목 없음) | 사용자 판정 2026-10-17(harden G22). 근거 없는 가정 · L1 |
