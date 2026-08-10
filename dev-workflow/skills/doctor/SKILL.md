---
name: doctor
description: Use when the dev-workflow pipeline's own environment looks broken — the context-threshold nudge never fires, codex is unavailable outside a running review-loop, or the installed plugin may be stale on this machine. 트리거 예 — "넛지가 안 떠", "codex가 안 돌아", "플러그인 최신인가", "버전 맞나", "환경 점검해줘". Does NOT trigger on codex failures inside a running review-loop (that is review-loop's own concern), on vague failure sentences that name no tool or symptom ("왜 안 돼", "에러 났어"), or on the same words about another product ("playwright 플러그인 최신인가", "node 버전 맞나", "codex로 딴 작업 돌리는데 안 돌아").
---

# doctor

**Announce:** "doctor로 dev-workflow 환경 4항목을 진단합니다(읽기 전용)."

## 핵심 원칙

**진단 전용이다 — 사용자 작업물·설정을 쓰지 않는다.** repo 파일·CLAUDE.md·settings.json·설치본 어느 것도 고치지 않고, 갱신·인증·설정 쓰기도 하지 않는다. 발견한 이상은 **기존 경로로 위임**한다(`/plugin update` · `/codex:setup` · `/dev-workflow:setup`).

유일한 예외는 마켓플레이스 clone의 `git fetch`다 — **진단에 필수인 조회 행위**이고 상위 clone의 작업 트리를 바꾸지 않는다. fetch 없이 판정하면 clone이 뒤처진 만큼 상시 "판정 불가"가 나온다.

**이 머신 하나만 본다.** 다른 머신은 진단하지 않는다 — 3머신 정렬은 "각 머신이 각자 돌린다"로 달성한다.

## 언제 뜨고, 언제 뜨면 안 되는가

**뜬다** — dev-workflow 파이프라인의 **환경 요소**(컨텍스트 넛지 · codex 연동 · 플러그인 버전)를 가리키는 증상 문장. 제품 이름이 붙지 않아도 된다: "넛지가 안 떠" · "codex가 안 돌아" · "플러그인 최신인가" · "버전 맞나".

**뜨면 안 된다** — 아래 4종.

| 잠식 위험 | 경계 |
|---|---|
| review-loop | **루프 실행 중의 codex 실패는 review-loop 소관**이다(`review-loop` §실행). doctor가 끼면 루프가 끊긴다 — doctor는 **루프 밖**의 증상 문장에만 뜬다 |
| setup | "이 repo에 세팅해줘"는 `setup`. 진단 결과 **쓰기가 필요하면** setup으로 보낸다 |
| dev-cycle | "다음 단계 뭐야"·"어디서부터 시작해"는 `dev-cycle`. doctor는 **환경**만 본다 |
| 제외 문장 2종 | ① **도구·현상에 묶이지 않은 일반 실패 문장** — "왜 안 돼" · "에러 났어" · "환경이 꾸직해" ② **다른 제품·도구를 주어로 한 같은 어휘** — "playwright 플러그인 최신인가" · "node 버전 맞나" · "codex로 딴 작업 돌리는데 안 돌아" |

## 두 루트 — 먼저 1회 결정해 전 프로브가 공유한다

```bash
R="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"            # 설정 루트 — 글로벌 settings.json
P="${CLAUDE_CODE_PLUGIN_CACHE_DIR:-$R/plugins}"    # 플러그인 루트 — registry · marketplaces · cache
```

**경로를 하드코딩하지 않는다.** 두 변수가 옮기는 것이 다르다 — `CLAUDE_CONFIG_DIR`은 프로필 전체를, `CLAUDE_CODE_PLUGIN_CACHE_DIR`은 **플러그인 루트만** 따로 옮긴다(후자가 설정되면 `$R/plugins`는 쓰이지 않는다). 어느 쪽이든 무시하면 **활성 프로필이 아닌 곳을 진단해 "미설치"·"미등록"·"companion 없음"을 한꺼번에 오진**한다 — 가장 망가져 보이는 출력이 실은 doctor가 엉뚱한 데를 본 결과다.

`installed_plugins.json` · 마켓플레이스 clone · plugin cache 조회는 **`$P`**, 글로벌 `settings.json` 조회는 **`$R`**을 쓴다.

## 점검 4항목 — 프로브

아래 명령을 **그대로** 쓴다(매 실행 재조합 금지).

### 1. 설치본 — 엔트리 배열을 전부 열거한다

```bash
node -e '
const fs=require("fs"),p=require("path");
const f=p.join(process.argv[1],"installed_plugins.json");
if (!fs.existsSync(f)) { console.log("REGISTRY_MISSING"); process.exit(0); }
const d=JSON.parse(fs.readFileSync(f,"utf8"));
for (const [key, entries] of Object.entries(d.plugins||{})) {
  if (!key.startsWith("dev-workflow@")) continue;
  for (const e of entries||[]) console.log([key, e.scope, e.projectPath||"-", e.version||"-", e.gitCommitSha||"-"].join("\t"));
}' "$P"
```

**출력이 `REGISTRY_MISSING`이거나 한 줄도 없으면 "미설치"다** — (b)의 "판정 불가"가 아니다. 레지스트리 파일 부재·엔트리 0건은 *조회가 실패한 것*이 아니라 **이 프로필에 설치 이력이 없다는 확정 사실**이다. (b)가 다루는 것은 *엔트리는 있는데* 근거 필드가 없거나 object 조회가 실패한 경우다.

**스코프 이름을 하드코딩하지 않는다.** 설치 스코프는 `claude plugin install -s <scope>` 기준 `user`·`project`·`local` 3종이고, `claude plugin update -s <scope>`는 여기에 `managed`를 더한 4종을 받는다. 엔트리는 **배열**이다. 두 종만 열거하면 **stale한 local 설치가 활성인 repo에서 그 설치를 못 보고 "최신"이라 보고**한다. 배열 전체를 돌고 스코프 이름은 **출력에 그대로 옮긴다**(새 스코프가 생겨도 자동으로 덮인다).

### 2. 마켓플레이스 최신 — subtree object id 대조

```bash
KEY=<1번 출력 1열>                 # `dev-workflow@<marketplace>`
MP="${KEY#*@}"
C="$P/marketplaces/$MP"
[ -d "$C/.git" ] || echo "미등록"     # 미등록이면 여기서 이 프로브를 끝낸다 (아래를 돌리지 않는다)
git -C "$C" fetch -q origin
REF="$(git -C "$C" symbolic-ref -q --short refs/remotes/origin/HEAD || echo origin/main)"
git -C "$C" rev-parse "$REF:dev-workflow"          # 최신 subtree id — 엔트리 전체에 1회
```

**미등록이면 거기서 끝낸다.** `.git`이 없는데 `fetch`·`rev-parse`를 이어 돌리면 fatal만 쌓이고 판정은 이미 "미등록"으로 확정돼 있다. **1번이 엔트리를 0건 냈을 때도 `KEY`가 없으므로 같다** — 그때는 `ls -1 "$P/marketplaces" 2>/dev/null`로 clone 유무만 보고(glob을 쓰지 않는다 — 점검 3 참조), 없으면 "미등록"·있으면 "판정 불가"(대조할 설치 sha가 없다)로 적는다.

**기본 브랜치를 `main`으로 가정하지 않는다** — 원격 HEAD에서 유도하고 실패할 때만 `origin/main`으로 떨어진다.

그다음 **1번이 낸 엔트리마다** 설치본 subtree id를 낸다(엔트리가 여럿이면 각각 돌린다 — 한 번만 돌리면 나머지 스코프가 판정 없이 남는다):

```bash
git -C "$C" rev-parse "$SHA:dev-workflow"          # SHA = 그 엔트리의 gitCommitSha
```

어떤 엔트리든 최신 id와 **다를 때만** 무엇이 달라졌는지 보조 근거를 붙인다:

```bash
git -C "$C" log --oneline "$SHA..$REF" -- dev-workflow/
```

### 3. codex — 신호 3종까지만

```bash
command -v codex                                                  # CLI 존재
codex login status                                                # 인증
```

```bash
# companion 존재 — 캐시를 훑지 않고 레지스트리가 가리키는 활성 설치본만 본다
node -e '
const fs=require("fs"),p=require("path");
const f=p.join(process.argv[1],"installed_plugins.json");
if (!fs.existsSync(f)) { console.log("REGISTRY_MISSING"); process.exit(0); }
const d=JSON.parse(fs.readFileSync(f,"utf8"));
for (const e of (d.plugins||{})["codex@openai-codex"]||[]) {
  const c = e.installPath ? p.join(e.installPath,"scripts","codex-companion.mjs") : null;
  console.log([e.scope, e.installPath||"-", (c && fs.existsSync(c)) ? "OK" : "MISSING"].join("\t"));
}' "$P"
```

**캐시 디렉터리를 훑어서 판정하지 않는다.** plugin cache에는 **갱신 후에도 구버전 디렉터리가 남는다**(이 머신 실측: `dev-workflow` 캐시에 6개 버전이 있고 활성은 2개다). 캐시를 훑어 companion을 하나라도 찾으면 정상이라 판정하면, **활성 설치본에서 companion이 사라져도 고아 버전의 파일이 발견돼 거짓 정상**이 된다 — codex가 실제로 안 도는 바로 그 상황에서 doctor가 "정상"이라 답한다. 엔트리의 `installPath`가 활성 설치본을 가리키는 유일한 근거다.

**glob으로 존재를 확인하지 않는다.** `ls -d …/*/…`는 무매치일 때 셸에 따라(zsh 기본 `nomatch`) **`ls`가 실행되기도 전에** 셸이 에러를 내고 `2>/dev/null`도 이를 막지 못한다. 위 조회가 셸 glob 대신 레지스트리를 읽는 이유이기도 하다.

**판정 매핑** — `command -v codex`가 빈 출력이면 `CLI 없음`, `codex login status`가 비정상 종료하거나 로그인 상태가 아니라고 답하면 `미로그인`, companion 조회가 `MISSING`을 내거나 엔트리를 **0건**(또는 `REGISTRY_MISSING`) 내면 `companion 없음`, 셋 다 정상이면 `정상`이다. **둘 이상이 동시에 실패하면 전부 적는다**(`CLI 없음 · companion 없음`) — 하나만 골라 적으면 나머지가 조용히 사라진다.

**이 3종이 전부다.** 3종이 정상인데도 문제가 있으면 `codex doctor`로 위임한다 — 깊은 진단을 여기서 재구현하지 않는다. codex의 **플러그인 버전은 대조하지 않는다**(버전 대조 범위는 dev-workflow 하나뿐이다).

### 4. `CLAUDE_CTX_LIMIT` — 실제 환경변수 값이 먼저다

```bash
echo "env: ${CLAUDE_CTX_LIMIT:-<미설정>}"
grep -Hn CLAUDE_CTX_LIMIT "$R/settings.json" .claude/settings.json .claude/settings.local.json 2>/dev/null
```

`.claude/…` 두 곳은 **현재 repo** 기준이다(프로젝트 스코프 설정이라 그게 맞다) — project-scope 설치가 다른 repo에 있어도 그 repo의 settings를 뒤지지 않는다. 상대경로이므로 **repo 루트에서 돌린다**(cwd가 repo 밖이면 조용히 "값 없음"이 된다). `grep`의 **종료코드는 보지 않는다**: 무매치와 파일 부재를 구분할 필요가 없다(둘 다 "이 파일에 값 없음"이다).

훅이 실제로 읽는 것은 **프로세스 환경변수**다(`hooks/scripts/context-threshold-hook.mjs`). 셸 프로필 등 다른 경로로 주입되면 settings.json grep만으로는 "미설정" 오탐이 난다. settings.json 3곳은 **"어디서 왔는가 / 어디에 넣으면 되는가"**를 밝혀 조치 안내를 붙이는 용도로 병행 조회한다.

**한계 — 이 `echo`가 보는 것은 셸 프로세스의 env다.** Claude Code 프로세스가 훅에 넘기는 env와 다를 수 있다(셸 프로필이 주입하면 셸에만 보이고, 반대도 가능하다). 스킬이 볼 수 있는 최선이므로 그대로 쓰되, **settings.json 어디에도 없는데 env에만 값이 있으면 주입 지점을 사용자에게 확인**한다.

**현재 모델은 네가 안다** — 훅은 런타임에 윈도 크기를 알 수 없지만(모델 ID가 베어 ID라 `[1m]` 접미사가 없다) 스킬은 자기 모델을 안다. 이 대조가 doctor의 고유 기여다.

## 판정 규칙 5건

**(a) 버전 뒤처짐·스코프 드리프트는 `dev-workflow/` subtree 비교로 판정한다.**

- 1차 판정은 항상 **subtree object id 비교**다(`git rev-parse <sha>:dev-workflow`). 같으면 내용이 동일하므로 **뒤처짐 없음 / 드리프트 없음**이다. `git log`는 다를 때만 붙이는 **보조 근거**다.
- **raw sha를 비교하지 않는다.** 이 repo는 `docs/specs` 커밋이 압도적이라 sha 비교는 커밋할 때마다 거짓 경보한다. 늑대소년이 되면 진짜 뒤처짐도 무시된다.
- **로그로 판정하지 않는다.** `git log A..B -- <path>`는 *그 경로를 건드린 커밋을 세는 것*이지 최종 트리를 비교하지 않는다. 변경 후 되돌린 이력이 있으면 **트리는 같은데 로그는 남아** 거짓 뒤처짐이 된다.
- **스코프 간 드리프트도 같은 방식**이다 — 설치 sha들을 raw로 비교하지 않고 **각 sha의 `dev-workflow/` subtree id가 모두 같은지**만 본다.
- 이 방식은 **"version 문자열은 같은데 내용은 낡음"**(범프 없는 문면 변경)도 잡는다. version은 표시용이지 판정 근거가 아니다.

**(b) 근거가 없으면 "판정 불가"로 표시하고 절대 "최신"이라 말하지 않는다.** 네트워크·fetch·object 조회 실패뿐 아니라 **`gitCommitSha`·`version` 필드 결측**도 같다. `installed_plugins.json`에는 `gitCommitSha`가 아예 없는 엔트리와 `version: "unknown"`이 실제로 존재한다. version 문자열로 폴백하지 않는다 — (a)가 막은 "버전 같은데 내용 다름"이 다시 새어 들어온다.

**(c) 마켓플레이스 clone 부재는 "미등록"으로 별도 표시한다.** 네트워크 실패와 **원인도 조치도 다르다** — 전자는 기다림, 후자는 `marketplace add` → `install`이다.

**(d) `CLAUDE_CTX_LIMIT`은 실제 환경변수 값을 먼저 본다.** settings.json 3곳은 출처·조치 위치를 밝히는 병행 조회다.

**(e) 모델↔limit 불일치는 양방향으로 판정한다.**

**먼저 두 수를 확정한다 — 어느 쪽도 눈대중으로 넘기지 않는다.**

- **유효 limit** = 환경변수에 양수 값이 있으면 그 값, **없으면 훅 기본값 `1,000,000`**이다(훅은 미설정 시 1M을 가정한다). settings.json 값은 **출처 표시용**이지 유효 값이 아니다 — 훅은 프로세스 환경변수만 읽는다.
- **모델 윈도** = 현재 모델 ID에 `[1m]` 접미가 있으면 `1,000,000`, 없으면 `200,000`이다.

그다음 둘을 비교한다. **네 조합이 전부 이 표에 들어온다** — 판정을 못 내리는 상태가 남으면 (b)로 흘러가 "판정 불가"가 되는데, 그건 이 검사에서는 오답이다.

| 유효 limit vs 모델 윈도 | 판정 | 결과 |
|---|---|---|
| **같다** (1M 모델 + 미설정 · 200k 모델 + 200k 설정) | **정상** | — |
| **유효 limit > 모델 윈도** (200k 모델인데 미설정이거나 1M으로 설정) | **과소평가** | 사용량이 5배 과소평가돼 **넛지가 아예 안 뜬다** |
| **유효 limit < 모델 윈도** (1M 모델인데 200k로 설정) | **과대평가** | 실제 8% 사용 시점을 40%로 계산해 **조기 넛지**가 뜬다 |

훅은 설정된 양수 값을 **검증 없이 그대로** 쓰므로 두 방향이 다 실패한다. 훅 자신이 과대평가 쪽을 *"더 해롭다"*고 적어 뒀다 — 한 방향만 보는 진단은 그쪽을 못 잡는다.

## 출력

**정상이든 아니든 4항목 표를 항상 출력한다.** 조치 안내만 이상 항목에 붙인다. 증상 트리거로 뜬 경우 사용자는 이미 문제를 의심하는 중이라 "이상 없음" 한 줄로는 납득되지 않고, 무엇을 봤는지 안 보이면 결국 수동 대조로 되돌아간다 — 그것이 doctor가 없애려던 행동이다.

| # | 항목 | 상태 | 근거 |
|---|---|---|---|
| 1 | 설치본 | **엔트리마다** 최신 / 뒤처짐 / 판정 불가 / 미설치 + **스코프 간 드리프트 유무** | 엔트리별 scope(·projectPath) · version · sha(짧게) · subtree id |
| 2 | 마켓플레이스 | 등록됨 / 미등록 / 판정 불가 | clone 경로 · 최신 subtree id(비교 기준을 확보했는가) |
| 3 | codex | 정상 / CLI 없음 / 미로그인 / companion 없음 | **3종 각각의 결과** — CLI 경로 · `login status` 출력 · companion 경로 |
| 4 | `CLAUDE_CTX_LIMIT` | 정상 / 과소평가 / 과대평가 / 판정 불가 | 현재 모델 · 모델 윈도 · 유효 limit · 출처 |

**근거 칸에 적을 것이 없으면 `해당 없음`으로 적고 빈칸으로 두지 않는다.** 엔트리 0건일 때의 스코프 간 드리프트, 어디에도 값이 없을 때의 CTX_LIMIT 출처가 그렇다 — 후자는 "출처 없음 = **유효 limit이 훅 기본값**"이라는 뜻이므로 그렇게 적는다.

**행은 4개로 고정하고 엔트리 수만큼 늘리지 않는다.** 설치 엔트리가 여럿이면 1행 안에 **스코프별 판정을 모두 적고**, 스코프 간 드리프트도 거기 적는다 — 드리프트 전용 행을 새로 만들지 않는다. **뒤처짐 판정은 1행 소관**이고 2행은 *비교 기준(최신 subtree id)을 얻었는가*만 답한다. 둘을 섞으면 스코프가 갈릴 때 2행에 단일 값을 적을 수 없다.

**부분 실패에도 중단하지 않는다.** 한 프로브가 실패해도(fetch 실패 · object 조회 실패 · 파일·clone 부재 · codex 명령 실패) **나머지 프로브를 계속 수행하고 표 4행을 반드시 출력**한다. 실패한 항목만 정의된 상태("판정 불가" · "미등록" · "미설치")로 적고 그 항목에 조치를 붙인다. 중단하면 **환경이 가장 망가진 순간에 사용자가 아무 정보도 못 얻는다** — doctor의 존재 이유와 정면으로 어긋난다.

## 조치 안내 (이상 항목에만)

| 이상 | 안내 |
|---|---|
| user-scope 뒤처짐 | `/plugin update dev-workflow@<marketplace>` |
| **project-scope 뒤처짐** | 그 repo(`projectPath`) **안에서** 돌린다. 설치 트리거는 그 repo의 `.claude/settings.json`(`extraKnownMarketplaces` + `enabledPlugins`)이다. **CLI로 돌린다면 스코프를 명시한다** — `claude plugin update dev-workflow@<marketplace> --scope project`. `--scope`의 **기본값이 `user`**라 생략하면 user 설치만 갱신되고 project 설치는 뒤처진 채 남는다 |
| **local-scope 뒤처짐** | 같은 규칙이다 — 그 repo 안에서 `--scope local`을 명시한다. 스코프를 빠뜨리면 갱신은 안 됐는데 표에는 뒤처짐이 그대로 남아, 사용자가 같은 명령을 반복하게 된다 |
| 미등록 · **미설치** | `/plugin marketplace add gguii74-rwk/claude-dev-workflow` → `/plugin install dev-workflow@claude-dev-workflow` (설치 경로가 같다) |
| **스코프 간 드리프트** | 뒤처진 스코프의 안내를 따른다 — 드리프트는 그 갱신으로 해소된다. **모든 스코프가 최신인데 드리프트가 남으면** 근거를 다시 본다((b)의 판정 불가일 수 있다) |
| 판정 불가 | 원인(네트워크·필드 결측)을 밝히고 재시도를 안내한다. **"최신"이라는 단어를 쓰지 않는다** |
| codex 이상 | `/codex:setup`. 3종이 정상인데도 문제면 `codex doctor` |
| CTX_LIMIT 이상 | `/dev-workflow:setup`이 값을 묻고 settings.json에 쓴다. **doctor가 직접 쓰지 않는다.** 반영은 Claude Code 재시작 후. 단 **값의 출처가 환경변수면 settings.json에 써도 환경변수가 이긴다** — 그 경우 주입 지점(셸 프로필 등)을 함께 안내한다 |

**스코프 행은 사용자가 갱신할 수 있는 3종까지다.** 그 밖의 스코프(예: `managed`)가 열거되면 조치를 지어내지 말고 **판정과 근거만 보고**한다 — 진단 전용이라는 원칙이 그대로 적용된다.

## 하지 말 것

- 자동 수정 → 설치본 갱신·인증·설정 쓰기 전부 금지. 진단하고 위임한다.
- 다른 머신 진단 → 이 머신 하나만 본다.
- 스크립트·훅 추가 → 산출물은 이 `SKILL.md` 하나다. 프로브가 한두 줄이라 스크립트는 과설계다.
- 루프 실행 중의 codex 실패에 끼어들기 → review-loop 소관이다.
- 근거 없이 "최신" 판정 → (b) 위반. 판정 불가로 남긴다.
- 한 프로브 실패로 중단 → 나머지를 계속하고 표 4행을 낸다.
