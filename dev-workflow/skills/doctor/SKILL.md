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
let d;
try { d=JSON.parse(fs.readFileSync(f,"utf8")); }
catch (e) { console.log("REGISTRY_UNREADABLE"); process.exit(0); }
for (const [key, entries] of Object.entries(d.plugins||{})) {
  if (!key.startsWith("dev-workflow@")) continue;
  for (const e of entries||[]) console.log([key, e.scope, e.projectPath||"-", e.version||"-", e.gitCommitSha||"-"].join("\t"));
}' "$P"
```

**네 결과를 구분한다 — 부재·읽기 실패·빈 목록은 같은 것이 아니다.**

| 출력 | 판정 |
|---|---|
| `REGISTRY_MISSING` | **미설치** — 파일이 없다는 확정 사실이다 |
| 정상 종료 + 엔트리 0줄 | **미설치** — 이 프로필에 설치 이력이 없다 |
| `REGISTRY_UNREADABLE` | **판정 불가** — 파일은 있는데 권한·부분 기록으로 읽거나 파싱하지 못했다. **설치본이 없다는 증거가 아니다** |
| 명령 자체가 비정상 종료 | **판정 불가** |

읽기·파싱 실패를 "출력이 없다"로 뭉뚱그리면 **레지스트리 장애 하나가 "미설치"와 "companion 없음" 두 확정 오진으로 번지고**, 멀쩡한 설치본에 재설치를 안내하게 된다. 그래서 두 레지스트리 조회 모두 파싱을 `try`로 감싸 sentinel을 낸다. (b)가 다루는 나머지 경우는 *엔트리는 있는데* 근거 필드가 없거나 object 조회가 실패한 것이다.

**스코프 이름을 하드코딩하지 않는다.** 설치 스코프는 `claude plugin install -s <scope>` 기준 `user`·`project`·`local` 3종이고, `claude plugin update -s <scope>`는 여기에 `managed`를 더한 4종을 받는다. 엔트리는 **배열**이다. 두 종만 열거하면 **stale한 local 설치가 활성인 repo에서 그 설치를 못 보고 "최신"이라 보고**한다. 배열 전체를 돌고 스코프 이름은 **출력에 그대로 옮긴다**(새 스코프가 생겨도 자동으로 덮인다).

### 2. 마켓플레이스 최신 — subtree object id 대조

```bash
KEY=<1번 출력 1열>                 # `dev-workflow@<marketplace>`
MP="${KEY#*@}"
# clone 위치는 조립하지 않고 레지스트리에 묻는다
C="$(node -e '
const fs=require("fs"),p=require("path");
const f=p.join(process.argv[1],"known_marketplaces.json");
if (!fs.existsSync(f)) { console.log("MARKETPLACES_MISSING"); process.exit(0); }
let d;
try { d=JSON.parse(fs.readFileSync(f,"utf8")); }
catch (e) { console.log("MARKETPLACES_UNREADABLE"); process.exit(0); }
const m=(d.marketplaces||d)[process.argv[2]];
console.log(m && m.installLocation ? m.installLocation : "UNREGISTERED");
' "$P" "$MP")"

export GIT_TERMINAL_PROMPT=0         # 자격증명 프롬프트로 매달리지 않는다

# 원격 기본 브랜치를 원격에 직접 묻는다
# 원격 기본 브랜치와 그 OID를 한 번에 확정한다
LS="$(perl -e 'alarm shift; exec @ARGV' 20 git -C "$C" ls-remote --symref origin HEAD 2>/dev/null)"
HB="$(printf '%s\n' "$LS" | awk '/^ref:/{print $2; exit}')"
OID="$(printf '%s\n' "$LS" | awk '$2=="HEAD" && $1 ~ /^[0-9a-f]{40}$/ {print $1; exit}')"
[ -n "$HB" ] && [ -n "$OID" ] || echo "판정 불가: 원격 HEAD 미확인"   # 못 읽으면 여기서 끝낸다 (main으로 추정하지 않는다)

perl -e 'alarm shift; exec @ARGV' 30 git -C "$C" fetch -q origin "$HB"
[ "$(git -C "$C" rev-parse FETCH_HEAD 2>/dev/null)" = "$OID" ] || echo "판정 불가: fetch가 원격 OID에 도달하지 못했다"   # 여기서 끝낸다
git -C "$C" rev-parse "$OID:dev-workflow"          # 최신 subtree id — 엔트리 전체에 1회
```

`$C`의 값에 따라 넷으로 갈린다. **아래 fetch·대조는 첫 줄에서만 이어 돌린다** — 나머지는 판정이 이미 확정돼 있고, 계속 돌리면 fatal만 쌓인다.

| `$C` | 판정 | 조치 |
|---|---|---|
| 경로 + 그 아래 `.git` 있음 | **등록됨** | 아래를 계속한다 |
| 경로인데 `.git` 없음 | **판정 불가** | 여기서 끝낸다. **`marketplace add`를 안내하지 않는다** — 등록은 돼 있고 doctor가 git으로 대조하지 못할 뿐이다 |
| `UNREGISTERED` · `MARKETPLACES_MISSING` | **미등록** | 여기서 끝낸다 + `marketplace add` 안내 |
| `MARKETPLACES_UNREADABLE` | **판정 불가** | 여기서 끝낸다 |

**경로를 조립하지 않는다.** `$P/marketplaces/<name>`은 통상값일 뿐이고 실제 위치는 `known_marketplaces.json`의 **`installLocation`**이 정한다(읽기 전용 seed 배포 등은 다른 곳을 쓸 수 있다 — 런타임에 `CLAUDE_CODE_PLUGIN_SEED_DIR`가 있다). **`.git` 부재를 미등록으로 읽지도 않는다** — 이 머신에도 `installLocation`은 정상인데 `.git`이 없는 마켓플레이스가 실재한다(`claude-plugins-official`). 그걸 "미등록"이라 부르면 **정상 배포에 대고 `marketplace add`를 시키는** 잘못된 조치가 나간다.

**1번이 엔트리를 0건 냈을 때는 `KEY`가 없어 `MP`를 모른다** — 그때는 위 조회를 돌리지 말고 `known_marketplaces.json`의 **키 목록만** 읽어 등록 여부를 적고, 대조할 설치 sha가 없으므로 **판정 불가**로 남긴다.

**`dev-workflow@` 키가 둘 이상이면 한 기준을 나머지에 돌려 쓰지 않는다.** 1번 출력 1열에 서로 다른 마켓플레이스가 섞여 있으면(본가 + fork 등) 위 절차는 **그중 한 키에 대해서만** 유효하다. 나머지 키의 엔트리는 **`판정 불가`(다른 마켓플레이스 — 대조 기준 미확보)** 로 남기고, 근거 칸에 **어느 마켓플레이스가 대조되지 않았는지** 적는다. 한 clone의 최신 id를 다른 마켓플레이스의 sha와 맞대면, 이력이 갈린 경우엔 sha를 못 찾아 판정 불가가 되지만 **이력을 공유하는 fork라면 거짓 "최신"이 나온다** — 뒤쪽이 (b) 위반이라 안전한 쪽으로 이탈한다.

**fetch 종료코드에 기대지 않는다 — 원격 OID와 대조한다.** `ls-remote --symref`는 ref 이름과 **그 OID를 함께** 준다. 이게 필요한 이유는 실패가 조용하기 때문이다: `$HB`가 비어 있으면 `git fetch -q origin ""`가 **exit 0으로 아무 것도 하지 않고 지나가고 낡은 `FETCH_HEAD`가 그대로 남는다**(실측). 그 값을 최신 기준으로 삼으면 **뒤처진 설치본이 "최신"으로 보고**되는데, 그건 규칙 (b)가 막으려던 바로 그 오답이다. 그래서 fetch 뒤 `FETCH_HEAD`가 **`ls-remote`가 준 OID와 같은지** 확인하고 다르면 판정 불가로 끝낸다. 이후 subtree 비교와 보조 로그는 `FETCH_HEAD`가 아니라 **고정한 `$OID`**를 쓴다 — 동시에 다른 fetch가 끼어들어도 기준이 흔들리지 않는다.

**기본 브랜치를 로컬에서 유도하지 않는다.** clone의 fetch refspec은 `+refs/heads/main:refs/remotes/origin/main` **한 줄뿐**이라(실측), 평범한 `git fetch origin`은 **`origin/HEAD`를 갱신하지도, 다른 브랜치를 가져오지도 않는다**. 원격 기본 브랜치가 바뀌면 로컬 `origin/HEAD`는 옛 `origin/main`을 계속 가리키고, 낡은 기준과 비교한 결과가 **"최신"으로 오판**된다. 그래서 `ls-remote --symref`로 **원격에 직접 묻고** 그 브랜치를 지목해 fetch한 뒤 `FETCH_HEAD`에서 subtree를 읽는다 — 새 remote-tracking ref를 만들지 않으므로 clone에 남는 상태가 늘지 않는다. 원격 HEAD를 못 읽으면 **`main`으로 추정하지 말고 판정 불가**다((b)).

**네트워크 호출은 매달리지 않게 감싼다.** `git ls-remote`·`git fetch`는 자격증명 프롬프트나 blackhole에서 **실패로 돌아오지 않고 그대로 멈출 수 있다** — 그러면 뒤의 codex·CTX 프로브와 **표 4행 출력에 아예 도달하지 못한다**. 이것은 아래 §출력의 "부분 실패에도 계속"이 받는 경우가 아니다: 실패로 전환되지 않기 때문이다.

- `GIT_TERMINAL_PROMPT=0` — 자격증명 프롬프트를 끄고 즉시 실패시킨다.
- `perl -e 'alarm shift; exec @ARGV' <초> <명령>` — **wall-clock 상한**. `alarm` 타이머는 `exec`을 넘어 유지되므로 git이 SIGALRM으로 죽는다(실측: 5초 제한이 30초 sleep을 5.011초에 exit 142로 끊고, 정상 명령은 그대로 통과).
- **`http.lowSpeedLimit`류 전송 옵션에 기대지 않는다** — 전송 **속도**만 감시해서 DNS·TCP·TLS **연결 단계 정지에는 걸리지 않는다**. wall-clock 상한이라야 정지 유형과 무관하게 닫힌다.
- **외부 `timeout(1)`을 쓰지 않는다** — macOS 기본 설치에는 `timeout`도 `gtimeout`도 없어(실측) 명령 부재로 프로브가 통째로 깨진다. `perl`은 macOS·Linux·git-bash 모두 기본으로 있다.
- **`2>&1`로 stderr를 파이프에 합치지 않는다.** SIGALRM은 `git`만 죽이고 git이 띄운 전송 헬퍼(`git-remote-https`)는 남는데, 그 헬퍼가 **합쳐진 파이프를 계속 붙들어** 상한이 실효된다(실측: 5초 상한인데 파이프가 75초 동안 열려 있었다 — curl의 connect 한계까지). 위처럼 **stderr는 `2>/dev/null`로 버린다**. 그러면 파이프를 써도 상한대로 끊긴다(실측 5초).

상한에 걸린 경우는 마켓플레이스 **판정 불가**로 적고 나머지 프로브와 4행 출력을 계속한다.

그다음 **1번이 낸 엔트리마다** 설치본 subtree id를 낸다(엔트리가 여럿이면 각각 돌린다 — 한 번만 돌리면 나머지 스코프가 판정 없이 남는다):

```bash
git -C "$C" rev-parse "$SHA:dev-workflow"          # SHA = 그 엔트리의 gitCommitSha
```

어떤 엔트리든 최신 id와 **다를 때만** 무엇이 달라졌는지 보조 근거를 붙인다:

```bash
git -C "$C" log --oneline "$SHA..$OID" -- dev-workflow/
```

**우변을 비워 두지 않는다.** `"$SHA.."`처럼 우변이 없으면 git이 **로컬 `HEAD`**로 채우는데, clone의 로컬 HEAD는 방금 받은 원격 최신과 다를 수 있다(이 머신에서도 1커밋 뒤처져 있었다 — fetch는 체크아웃 브랜치를 전진시키지 않는다). 그러면 원격의 최신 변경이 로그에서 통째로 빠지거나 근거가 빈칸으로 나온다. 기준은 위에서 subtree를 읽은 것과 **같은 `$OID`**여야 한다.

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
let d;
try { d=JSON.parse(fs.readFileSync(f,"utf8")); }
catch (e) { console.log("REGISTRY_UNREADABLE"); process.exit(0); }
const CWD=process.argv[2];
const all=(d.plugins||{})["codex@openai-codex"]||[];
const active=all.filter(e => e.scope==="user" || e.scope==="managed" || e.projectPath===CWD);
if (!active.length) { console.log(all.length ? "NO_ACTIVE_ENTRY" : "NO_ENTRY"); process.exit(0); }
for (const e of active) {
  const c = e.installPath ? p.join(e.installPath,"scripts","codex-companion.mjs") : null;
  console.log([e.scope, e.projectPath||"-", e.installPath||"-", (c && fs.existsSync(c)) ? "OK" : "MISSING"].join("\t"));
}' "$P" "$PWD"
```

**엔트리를 스코프 구분 없이 다 보지 않는다.** 런타임이 활성 후보로 삼는 것은 `user`·`managed` 엔트리와 **현재 프로젝트에 해당하는** `project`·`local` 엔트리다. 전부 훑으면 **다른 repo의 설치만 `OK`여도 "정상"이라 답하고**(이 repo에는 활성 companion이 없는데), 반대로 그 비활성 경로가 지워졌으면 멀쩡한 현재 설치를 `companion 없음`으로 찍는다. 그래서 후보를 먼저 거르고, 걸러진 게 없으면 `NO_ACTIVE_ENTRY`로 **판정 불가**다 — 있지도 않은 문제에 `/codex:setup`을 안내하지 않는다. 상대경로 비교이므로 이 조회도 **repo 루트에서 돌린다**(점검 4와 같다).

**캐시 디렉터리를 훑어서 판정하지 않는다.** plugin cache에는 **갱신 후에도 구버전 디렉터리가 남는다**(이 머신 실측: `dev-workflow` 캐시에 6개 버전이 있고 활성은 2개다). 캐시를 훑어 companion을 하나라도 찾으면 정상이라 판정하면, **활성 설치본에서 companion이 사라져도 고아 버전의 파일이 발견돼 거짓 정상**이 된다 — codex가 실제로 안 도는 바로 그 상황에서 doctor가 "정상"이라 답한다. 엔트리의 `installPath`가 활성 설치본을 가리키는 유일한 근거다.

**glob으로 존재를 확인하지 않는다.** `ls -d …/*/…`는 무매치일 때 셸에 따라(zsh 기본 `nomatch`) **`ls`가 실행되기도 전에** 셸이 에러를 내고 `2>/dev/null`도 이를 막지 못한다. 위 조회가 셸 glob 대신 레지스트리를 읽는 이유이기도 하다.

**판정 매핑**

| 신호 | 결과 |
|---|---|
| `command -v codex`가 빈 출력 | `CLI 없음` |
| `codex login status`가 비정상 종료하거나 로그인 상태가 아니라고 답함 | `미로그인` |
| companion 조회가 `MISSING` · `NO_ENTRY` · `REGISTRY_MISSING` | `companion 없음` |
| companion 조회가 **`NO_ACTIVE_ENTRY`** | **`판정 불가`** — 엔트리는 있는데 **이 문맥에서 활성이 아니다**(다른 repo의 project/local 설치뿐) |
| companion 조회가 **`REGISTRY_UNREADABLE`** | **`판정 불가`** — `companion 없음`이 **아니다** |
| 셋 다 정상 | `정상` |

**`REGISTRY_UNREADABLE`을 `companion 없음`으로 접지 않는다.** 레지스트리를 못 읽은 것은 companion이 없다는 증거가 아니다 — 그렇게 접으면 점검 1의 4분기표가 막은 오진(레지스트리 장애 하나가 확정 진단 둘로 번지는 것)이 **codex 행으로 그대로 새어 든다**. 원인은 하나인데 표에는 "미설치"와 "companion 없음"이 나란히 찍히고, 조치도 재설치와 `/codex:setup` 둘로 갈린다.

**둘 이상이 동시에 실패하면 전부 적는다**(`CLI 없음 · companion 없음`) — 하나만 골라 적으면 나머지가 조용히 사라진다.

**이 3종이 전부다.** 3종이 정상인데도 문제가 있으면 `codex doctor`로 위임한다 — 깊은 진단을 여기서 재구현하지 않는다. codex의 **플러그인 버전은 대조하지 않는다**(버전 대조 범위는 dev-workflow 하나뿐이다).

### 4. `CLAUDE_CTX_LIMIT` — 실제 환경변수 값이 먼저다

```bash
echo "env: ${CLAUDE_CTX_LIMIT:-<미설정>}"
```

```bash
# settings 3곳 — 원문 줄을 찍지 않고 값 하나만 투영한다
node -e '
const fs=require("fs");
for (const f of process.argv.slice(1)) {
  let v;
  try { v = (JSON.parse(fs.readFileSync(f,"utf8")).env||{}).CLAUDE_CTX_LIMIT; }
  catch (e) { console.log([f, fs.existsSync(f) ? "읽기·파싱 실패" : "없음"].join("\t")); continue; }
  console.log([f, v === undefined ? "값 없음" : String(v)].join("\t"));
}' "$R/settings.json" .claude/settings.json .claude/settings.local.json
```

`.claude/…` 두 곳은 **현재 repo** 기준이다(프로젝트 스코프 설정이라 그게 맞다) — project-scope 설치가 다른 repo에 있어도 그 repo의 settings를 뒤지지 않는다. 상대경로이므로 **repo 루트에서 돌린다**(cwd가 repo 밖이면 조용히 "값 없음"이 된다).

**`grep`으로 훑지 않는다 — 값 하나만 투영한다.** `grep`은 필드가 아니라 **일치한 줄 전체**를 출력한다. settings.json이 한 줄로 minify돼 있거나 `env` 객체가 한 줄이면, 같은 줄에 있던 **API 토큰·자격증명이 통째로 도구 출력과 세션 기록에 남는다**(합성 픽스처로 재현 확인). 그래서 파싱해 `env.CLAUDE_CTX_LIMIT` 하나만 찍고, **읽기·파싱이 실패해도 원문이나 인접 필드를 출력하지 않는다** — 실패는 파일명 + 상태로만 적는다. 파일 부재와 값 없음은 구분할 필요가 없으므로(둘 다 "이 파일에 값 없음") 종료코드도 보지 않는다.

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
- **모델 윈도** = 모델 메타데이터가 정한다. **`[1m]` 접미사로 가르지 않는다.**
  - **Claude 5 계열(`claude-opus-5` · `claude-sonnet-5` · `claude-fable-5`)은 접미사와 무관하게 `1,000,000`이다.** 셋 다 `context:{window:1e6, native_1m:true}`로 정의돼 있다(Claude Code 2.1.226 실측). `[1m]`은 Opus의 **선택 접미사**(`supports_1m_suffix`)일 뿐 1M 여부를 만드는 표식이 아니다.
  - 200k 모델(예: Haiku 4.5)은 `200,000`이다.
  - **모르는 모델이면 `200,000`으로 단정하지 말고 판정 불가**다((b)).

  **접미사로 판정하면 Claude 5 세션 전체가 오진된다.** 베어 ID 세션을 200k로 보면 유효 limit(미설정 시 훅 기본 1M) > 윈도(200k)가 되어 **정상 상태를 "과소평가"로 찍고 `CLAUDE_CTX_LIMIT=200000`을 유도**한다. 그 안내를 따르면 실제 1M 세션이 8% 지점에서 40%로 계산돼 **조기 넛지**가 뜬다 — 훅이 스스로 *"과대평가가 더 해롭다"*고 적어 둔 바로 그 방향이다.

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
| 3 | codex | 정상 / CLI 없음 / 미로그인 / companion 없음 / **판정 불가** | **3종 각각의 결과** — CLI 경로 · `login status` 출력 · companion 경로(또는 판정 불가 사유) |
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
| codex 이상 | `/codex:setup`. 3종이 정상인데도 문제면 `codex doctor`. **단 `판정 불가`에는 `/codex:setup`을 안내하지 않는다** — codex가 아니라 레지스트리를 못 읽은 것이라 아래 `판정 불가` 행을 따른다 |
| CTX_LIMIT 이상 | `/dev-workflow:setup`이 값을 묻고 settings.json에 쓴다. **doctor가 직접 쓰지 않는다.** 반영은 Claude Code 재시작 후. 단 **값의 출처가 환경변수면 settings.json에 써도 환경변수가 이긴다** — 그 경우 주입 지점(셸 프로필 등)을 함께 안내한다 |

**스코프 행은 사용자가 갱신할 수 있는 3종까지다.** 그 밖의 스코프(예: `managed`)가 열거되면 조치를 지어내지 말고 **판정과 근거만 보고**한다 — 진단 전용이라는 원칙이 그대로 적용된다.

**`version`이 같은데 subtree가 다르면 일반 갱신이 듣지 않을 수 있다.** 설치본은 version 디렉터리로 캐시되므로(`cache/<marketplace>/<plugin>/<version>/`), 범프 없이 내용만 바뀐 경우 갱신이 "이미 그 버전"이라 보고 넘어갈 수 있다. 그때 필요한 것은 사용자의 재실행이 아니라 **maintainer의 version bump**다 — 단서를 주지 않으면 사용자가 같은 명령을 반복하며 표의 뒤처짐이 사라지지 않는 상태에 갇힌다. (a)의 subtree 판정이 이 상태를 **탐지할 수 있는 유일한 경로**이므로, 뒤처짐 조치를 안내할 때 version 동일 여부를 함께 보고 이 단서를 붙인다.

## 하지 말 것

- 자동 수정 → 설치본 갱신·인증·설정 쓰기 전부 금지. 진단하고 위임한다.
- 다른 머신 진단 → 이 머신 하나만 본다.
- 스크립트·훅 추가 → 산출물은 이 `SKILL.md` 하나다. 프로브가 한두 줄이라 스크립트는 과설계다.
- 루프 실행 중의 codex 실패에 끼어들기 → review-loop 소관이다.
- 근거 없이 "최신" 판정 → (b) 위반. 판정 불가로 남긴다.
- 한 프로브 실패로 중단 → 나머지를 계속하고 표 4행을 낸다.
