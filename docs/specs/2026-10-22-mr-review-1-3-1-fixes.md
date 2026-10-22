# mr-review 1.3.1 — 첫 실사용에서 드러난 엔진 결함 5건 수정

> 상태: **impl 완료**(2026-10-22 — AC 26개(「27개」 표기는 §6 의 AC⑧-2 재언급까지 센 값) 중 25개 테스트 GREEN · AC⑧-2 와 실측 V1 은 9단계 · T1 153/153 · 구현 끝 커밋 `cc61ea0`) · harden 완료(harden-spec 2026-10-22 — 판단 갭 9건 전부 질문으로 해소, 유예 0건) · 작성 2026-10-22 · 버전 **1.3.1 패치** · 다음 = 8 review-loop(impl)(경량 — review-loop(spec)·plan 생략, D19)
> 선행: 1.3.0 spec `docs/specs/2026-10-21-mr-review-skill-design.md`(D1~D16 승계) · plan `docs/plans/2026-10-21-mr-review-skill.md`(SC-1~SC-8)
> 경로: **경량**(dev-cycle 1차 판정 + 사용자 확인 2026-10-22, 수동 모드 — 접촉 표면 무신호: 스키마·권한·인증·외부 연동 신설 없음. 호스트 처리·cleanup 삭제 범위 변경은 기존 기능의 결함 수정이며 테스트로 고정한다)

## 1. 배경 · 목표

1.3.0을 설치한 뒤 머지된 경량 MR 1건으로 첫 실사용 테스트를 끝까지 돌렸다(2026-10-22). 리포트는 나왔지만 엔진 쪽 결함·개선점 8건이 드러났다. 이 트랙은 그중 **엔진 결함 5건**(②·①·③·⑤·⑧ — 번호는 실사용 기록의 번호를 그대로 쓴다)을 고친다. 우선순위 = ②(안전 쪽 오판) > ①(비표준 포트에서 사용 불가) > ③·⑧ > ⑤.

**목표**

- G1. 머지된 MR을 워크트리 모드로 리뷰해도 「MR이 바꾼 것」이 보인다(②).
- G2. 포트가 붙은 GitLab 호스트(`gitlab.example.com:8443`)에서 `glab api`가 돈다. 어댑터 `gitlab.host` 형식(`host[:port]`)은 그대로다(①).
- G3. diff-only 모드에서도 head 원문이 있으면 배포본 zip 바이트를 대조한다(③).
- G4. cleanup이 작업 디렉터리 `W`에 허용된 파일 외 아무것도 남기지 않는다(⑤).
- G5. Codex가 자기 런타임 파일을 읽은 것을 「격리 위반 의심」으로 올리지 않는다(⑧).

## 2. 범위 · 비목표

**범위**: `dev-workflow/skills/mr-review/scripts/lib/{collect,gitlab,deploy,report}.mjs` · `dev-workflow/skills/mr-review/SKILL.md`(§0 전제·§5 경로 감시 문구) · `tests/mr-review/{collect,deploy,report}.test.mjs` · `dev-workflow/.claude-plugin/plugin.json`·`.claude-plugin/marketplace.json` 버전 1.3.1 · README 3종의 1.3.1 한 줄. 어댑터 계약(SC-2)의 키·형식은 바꾸지 않는다.

**비목표(이 트랙에서 하지 않는다)**

- ④ 위키 발췌가 관련성 아닌 알파벳순 앞 10페이지로 뽑히는 문제 — 팩 설계 변경이라 별도 트랙.
- ⑥ 두 모델 발견 지문이 제목 문자열이라 기계 병합이 안 되는 문제 — 지문 설계 변경, 별도 트랙.
- ⑦ 어댑터 `verdictFirstLine` 정규식이 사람 판정 댓글 형식과 안 맞는 문제 — 어댑터(프로젝트 문서) 쪽.
- 「경량 MR의 변경 사유 누락을 차단(MISSING_EVIDENCE)으로 볼지」 정책 질문 — 어댑터·팀 정책 몫. 엔진은 판정 규칙을 만들지 않는다(D9).
- IPv6 리터럴 호스트(`[::1]:8443`) — 어댑터 검증 정규식이 이미 거부한다. 요구가 생기면 별도.
- 1.3.0 설계 결정 D1~D16의 재론(D4 전송 범위·마스킹 방식 등).

## 3. 결함별 명세

예시는 전부 가상 값이다(호스트 `gitlab.example.com:8443` · 프로젝트 `alpha` · MR `!41` · head `e2e2e2e` · base `b1b1b1b`). 재현 근거의 사실은 실사용 산출물(`mr.json`·`snapshot.json`·`deploy.json`·`check.json`·`review-*.json`·리포트)과 대상 저장소 로컬 체크아웃을 **읽기 전용**으로 확인한 것이다.

### 3.② 머지된 MR에서 워크트리 모드 base = head → 변경 0건으로 조용히 통과 (안전 쪽 오판)

**현상**: MR이 target에 머지된 뒤 워크트리 모드로 collect하면 `base_sha = head_sha`, `mr.diffs = []`. deploy는 기대 목록이 비어 「운영 배포 대상 변경 없음」(`applicable:false`)으로 끝나고, 검토자는 빈 diff를 받는다. 리뷰어가 머지 뒤 리뷰를 돌리면 **배포본 대조도 변경 검토도 없이** 판정 초안이 나온다. 실사용에서는 `--diff-only`로 우회했다.

**재현 근거**: 머지된 MR의 로컬 체크아웃에서 `git merge-base origin/<target> <head>` = head(7자 일치) · 같은 head를 API `diff_refs.base_sha`(= `versions[0].base_commit_sha` = 머지 커밋의 첫 부모)와 비교하면 변경 파일 3건, merge-base와 비교하면 0건 · API base는 head의 조상(`merge-base --is-ancestor` 참).

**원인**: `collect.mjs:80` `pinWorktree()` — `base = git merge-base <origin/target> <head>`. 머지 뒤에는 target이 head를 포함하므로 merge-base가 head 자신이다. `collect.mjs:202` 가 그 base..head의 git 목록으로 `mr.diffs`를 **교체**해 API 목록(3건)까지 사라진다. 1.3.0 spec §5.1-2의 「base = merge-base <target SHA> <head SHA>」 문장이 머지 전만 가정했다.

**수정 방향(사용자 결정 2026-10-22 — 선택지 (A))**: 워크트리 모드의 base = **GitLab이 기록한 MR diff의 base** = `mr.versions[0].base_commit_sha`, 없으면 `mr.diff_refs.base_sha`. 그 커밋이 로컬에 있고(`git cat-file -e <base>^{commit}`) head의 조상인지(`git merge-base --is-ancestor <base> <head>`) 확인해 아니면 `ERR BASE_MISMATCH — API base <7자>가 head <7자>의 조상이 아니다` exit 2(fail-closed; `mr.json`·`snapshot.json`을 쓰지 않는다). 둘 다 없으면(versions 조회 실패 + diff_refs 부재) 지금처럼 merge-base로 폴백한다. **추가 방어**: 워크트리 모드에서 git diff가 0건인데 API 변경 목록(교체 전 `mr.diffs`)이 1건 이상이면 `ERR DIFF_EMPTY_MISMATCH — git diff 0건 ≠ API 변경 n건(base 산정 오류 의심)` exit 2. `target_sha`(fetch 직후 `origin/<target>`)는 그대로다. `snapshot.json`에 `base_source: "api" | "merge-base"`를 추가한다(감사용 — cleanup 비마스킹 대상인 경로·SHA·카운트 성격).

- 왜 (A)인가: diff-only 모드가 이미 같은 base를 쓴다(`collect.mjs:118`) → 두 모드가 같은 diff를 본다. 열린 MR에서는 target이 앞으로만 나가면 merge-base가 안 바뀌므로 결과가 지금과 같다. 기존 필드만 쓰므로 `mr.json` 계약(SC-3)이 늘지 않는다.
- 기각: (B) 머지 커밋 첫 부모 — `merge_commit_sha`를 새로 담아야 하고 squash·fast-forward 머지에는 머지 커밋이 없다. (C) merged면 diff-only 강제 — 워크트리 전문 검토를 잃는다.
- 머지 방식별 적용(사실): 머지 커밋·fast-forward 머지는 head가 target 이력에 들어가 merge-base = head가 되므로 이 수정이 필요하다. squash 머지는 target에 다른 SHA의 커밋이 생겨 head가 target 이력에 없으므로 1.3.0에서도 merge-base가 맞았고, (A)에서도 같은 base다.

**harden에서 확정한 보강(2026-10-22)**

- **수집 중 push(D27)**: 워크트리 모드도 diff-only와 같은 재수집 조건을 쓴다 — `versions[0].head_commit_sha` 또는 `diff_refs.head_sha`가 `api_head`와 다르면(메타 조회와 versions 조회 사이에 push) 그 base를 쓰지 않고 1부터 재수집(최대 3회, 초과 시 exit 3 `HEAD_MOVED`). 지금은 워크트리 모드가 「fetch head = API head」만 보고 diff 버전의 head는 보지 않아, rebase push가 끼면 새 base + 옛 head 조합이 `BASE_MISMATCH`로 끝났을 것이다.
- **얕은 clone(D28)**: 조상 확인에 실패했을 때 `git rev-parse --is-shallow-repository`가 `true`면 ERR 문구를 `ERR BASE_MISMATCH — 얕은 clone(shallow)이라 base <7자>가 로컬에 없다. 체크아웃에서 git fetch --unshallow 뒤 다시 실행` 으로 구분한다. 자동 `--unshallow`는 하지 않는다(읽기 전용 스킬이 사용자 체크아웃에 큰 fetch를 임의로 하지 않는다).
- **머지 뒤 리뷰 표시(D29)**: `mr.state`가 `merged`·`closed`면 리포트 헤더에 `- **머지 뒤 리뷰** — MR state=<state>. 작성자 보완 요청은 이 MR이 아니라 후속 MR로` 한 줄을 넣는다(render 헤더 1줄 — 판정 계산·절 순서 불변, D9 무관). 지금은 render·check·pack 어디서도 `mr.state`를 쓰지 않아 머지된 MR의 보완 요청 문안이 그대로 나간다.

**AC(테스트로 검증)**

- AC②-1. 픽스처에서 head를 target에 머지(머지 커밋)하고 origin/target을 갱신한 뒤 워크트리 모드 collect → `snapshot.base_sha` = 가짜 glab이 준 `versions[0].base_commit_sha`(= 머지 전 base) · `mr.diffs` 파일 수 = 머지 전과 동일 · 첫 줄 `COLLECTED worktree … base=<그 7자>` · `snapshot.base_source = "api"`.
- AC②-2. 같은 픽스처에서 deploy → `applicable:true`, 기대 배포 목록 = 머지 전과 동일(「운영 배포 대상 변경 없음」이 아니다).
- AC②-3. 가짜 glab의 `versions[0].base_commit_sha`·`diff_refs.base_sha`를 head의 조상이 아닌 40자 값으로 주면 → 첫 줄 `ERR BASE_MISMATCH …` exit 2, `W/mr.json`·`W/snapshot.json` 부재.
- AC②-4. `versions`·`diff_refs`가 모두 없고(versions 조회 실패 + 메타 diff_refs null) 머지된 상태 → git diff 0건 vs API 변경 ≥1 → 첫 줄 `ERR DIFF_EMPTY_MISMATCH …` exit 2. 같은 조건에서 API 변경도 0건이면 merge-base 폴백으로 정상(`base_source = "merge-base"`).
- AC②-5. 열린 MR(기존 픽스처) 결과 불변 — 기존 `collect.test.mjs` 단언(`snap.base_sha === baseSha` 등) 전부 통과.
- AC②-6. 워크트리 모드에서 가짜 glab이 `versions[0].head_commit_sha`를 첫 호출엔 다른 SHA, 둘째 호출엔 `api_head`로 주면 → `attempts = 2`로 성공(`base_source = "api"`). 3회 모두 다르면 → 첫 줄 `ERR HEAD_MOVED …` exit 3.
- AC②-7. 체크아웃을 얕은 clone(`git clone --depth 1`)으로 만든 픽스처에서 base가 로컬에 없으면 → 첫 줄 `ERR BASE_MISMATCH — 얕은 clone … git fetch --unshallow …` exit 2.
- AC②-8. `mr.json.state = "merged"`인 픽스처의 render 결과 헤더에 「머지 뒤 리뷰 — MR state=merged」 줄이 있고, `state = "opened"`면 없다.

### 3.① 비표준 포트 GitLab — `glab api --hostname host:port` 거부, 포트를 떼면 web_url 대조 실패

**현상**: 어댑터 `gitlab.host = "gitlab.example.com:8443"`이면 모든 `glab api` 호출이 `Error parsing --hostname: invalid hostname.`로 실패한다. 어댑터에 포트를 빼면 glab은 돌지만 collect의 MR `web_url` 호스트 대조(`gitlab.example.com:8443` ≠ `gitlab.example.com`)가 ERR. 실사용은 `MR_REVIEW_GLAB` 래퍼로 우회했다.

**재현 근거**: glab 1.115.0에서 `glab api --hostname 127.0.0.1:1 version` → `Error parsing --hostname: invalid hostname.` · `--hostname 127.0.0.1` → 접속 시도(설정 `hosts.<host>`의 `api_protocol`·`api_host`를 쓴다). 사용자 glab 설정에는 포트 있는 항목과 **포트 없는 항목(`api_host: <host>:<port>`, `api_protocol: http`)**이 함께 있다.

**원인**: `gitlab.mjs:16-19` `run()`이 `HOST`(어댑터 값 그대로, 포트 포함)를 `--hostname`에 넘긴다. `collect.mjs:193-194`의 web_url 대조는 포트 포함 문자열 비교라 어댑터와 web_url이 둘 다 포트를 가져야 통과한다. 두 소비자가 같은 값을 다른 형식으로 요구한다.

**수정 방향(사용자 결정 2026-10-22 15:3x)**: 어댑터 `gitlab.host` 형식 `host[:port]` 유지(SC-2 호환). `gitlab.mjs`가 `--hostname`에는 **포트를 제거한 호스트**(`host.replace(/:\d+$/, '')`)를 넘기고, `collect.mjs`의 web_url 대조는 **포트 포함 값**(지금과 같음)으로 한다. 전제 = glab 설정에 **포트 없는 호스트 키** 항목이 있고 그 항목의 `api_host`가 `host:port`, `api_protocol`이 맞아야 한다(glab이 `--hostname` 값으로 설정을 찾는다). 이 전제는 SKILL.md §0 전제 확인에 한 줄(「포트 있는 GitLab = glab `hosts.<포트 없는 호스트>.api_host`에 포트」)로 적고, 어댑터 작성 안내(README mr-review 절)에도 한 줄 붙인다.

**harden에서 확정한 보강(2026-10-22) — 사전 점검(D31)**: SKILL.md §0 전제 확인에 `glab api --hostname <어댑터 host에서 포트를 뗀 값> version`(GET 1회 — F1 「GET만」 범위 안) 을 추가한다. 실패하면 「glab 설정 `hosts.<호스트>`의 `api_host`(포트 포함)·`api_protocol`·토큰을 확인」을 안내하고 **멈춘다**(어댑터·glab 없이는 돌지 않는다는 §0 규칙과 같은 등급). 지금은 설정 미비가 collect의 첫 `glab api` 호출에서 `connection refused`류의 엉뚱한 오류로 나타난다.

**AC**

- AC①-1. 어댑터 `gitlab.host = "gitlab.test:8443"`, 가짜 glab의 MR `web_url = https://gitlab.test:8443/g/alpha/-/merge_requests/7` → collect 성공 · 가짜 glab이 기록한 `--hostname` 값 집합 = `{"gitlab.test"}`(포트 없음, 호출 전부).
- AC①-2. 같은 어댑터에서 `web_url = https://gitlab.test/g/alpha/-/merge_requests/7`(포트 없음) → `ERR … 호스트` exit 2(대조는 포트 포함 — 다른 서버·다른 포트의 같은 번호 MR을 받지 않는다).
- AC①-3. 포트 없는 어댑터(기존 픽스처 `gitlab.test`) → 기존 테스트 `collect.test.mjs:282`(`--hostname` 집합 = `{"gitlab.test"}`·web_url 불일치 ERR) 불변.
- AC①-4. SKILL.md §0에 (가) 포트 있는 GitLab의 glab 설정 전제 문구와 (나) `glab api --hostname … version` 사전 점검 명령 + 실패 시 안내·정지 문구가 실재한다(grep `api_host`·`version` 각 1건 이상).

### 3.③ diff-only 모드에서 head 원문이 있어도 배포본 바이트 대조 「불가」

**현상**: diff-only 모드는 삭제되지 않은 모든 변경 파일의 head 원문을 `W/blobs/head/`에 받는데(1.3.0 SC-3 snapshot 규약), deploy는 「diff-only 모드 — 로컬 체크아웃이 없어 바이트 대조 불가(로컬 clone 권장)」로 결과를 「대조 불가」로 둔다. 판정은 기계 증거 부족 `M-deploy` → `HOLD_EVIDENCE`. 실사용에서 Claude 검토자가 zip을 손으로 풀어 `cmp`로 대조했다(⑤의 원인이기도 하다).

**재현 근거**: 실사용 `deploy.json` — `zip.entries` 3건 = `expected.deploy` 3건, `comment_sha` = head, `mismatches` = `[{kind:"bytes", path:null, detail:"diff-only 모드 — 로컬 체크아웃이 없어 …"}]`, `result:"대조 불가"`. 같은 시점 `W/blobs/head/`에 세 파일 원문이 있었고 `snapshot.unrecovered = []`.

**원인**: `deploy.mjs:298-310` — `snap.mode === 'worktree'`일 때만 `git show`로 바이트를 읽고, 그 밖은 무조건 `bytes` 불가 항목을 넣는다. 메시지의 「로컬 체크아웃이 없어」도 부정확하다(실사용은 체크아웃이 있었고 `--diff-only`를 택했다).

**수정 방향(사용자 결정 2026-10-22 — 선택지 (A))**: diff-only 모드에서 기대 배포 목록의 zip 항목마다 —
1. zip 항목 유형이 `file`이 아니면 `{kind:"type", path, detail:"diff-only — zip 항목 유형 <type> 확인 불가(일반 파일만 대조)"}` → 불일치.
2. 그 경로가 `snapshot.unrecovered`에 있거나 `W/blobs/head/<경로>`가 없으면 `{kind:"bytes_unavailable", path, detail:"head 원문 미확보 — 바이트 대조 불가"}` → 대조 불가.
3. 그 밖은 `z.read(e)`와 blob 파일 바이트를 비교 → 다르면 `{kind:"bytes", path, detail:"blobs/head/<경로>와 바이트 불일치"}`.
blob 경로는 `insideRoot(W/blobs/head, 경로)`로 해소한다(zip 이름은 이미 정규형 검증을 통과했지만 복원 루트 밖은 읽지 않는다). 결과 산정: `bytes_unavailable`이 하나라도 있으면 「대조 불가」, 그 밖은 지금 규칙(`download`·`corrupt`·`bytes(path null)` → 대조 불가 / 불일치 있음 → 불일치 / 없음 → 일치). `path:null`인 `bytes` 항목은 더 이상 만들지 않는다. `deploy.json.zip`에 `bytes_source: "worktree" | "blobs"`를 추가한다.

- 알려진 한계(기록만): git에서 심링크인 경로의 raw API 응답은 링크 대상 문자열이다. zip 항목이 일반 파일이고 내용이 그 문자열과 같다는 극단 케이스는 「일치」가 된다 — 워크트리 모드의 git 유형 대조와 동급을 원하면 (B) `repository/tree` API 유형 대조가 필요하다(이번 범위 밖).
- 기각: (B) tree API 유형 대조 — 디렉터리 수만큼 호출·실패 경로 증가. (C) 문구만 정정 — 결함 유지.

**AC**

- AC③-1. diff-only 픽스처(`checkout:null`, `blobs/head/`에 head 원문) + head로 만든 정상 zip → `DEPLOY 일치`, `mismatches = []`, `zip.bytes_source = "blobs"`.
- AC③-2. zip 안 한 파일의 바이트를 1바이트 바꾸면 → `DEPLOY 불일치`, `mismatches`에 `{kind:"bytes", path:<그 파일>}`.
- AC③-3. 그 파일을 `snapshot.unrecovered`에 넣으면(또는 blob 파일 삭제) → `DEPLOY 대조 불가`, `{kind:"bytes_unavailable", path:<그 파일>}`.
- AC③-4. zip 항목 하나를 심링크 유형(Unix made-by, st_mode 0120000)으로 만들면 → `DEPLOY 불일치`, `{kind:"type", path:<그 파일>}`.
- AC③-5. 기존 `deploy.test.mjs:212`의 diff-only 단언(`bytes && /diff-only/`)은 새 규칙으로 교체(blob 없는 workdir → `bytes_unavailable`·대조 불가). 워크트리 모드 테스트 불변.
- AC③-6. `bytes_unavailable` 1건 + `extra_in_zip` 1건이 함께 있으면 결과 = 「대조 불가」(우선순위 유지, D34), `mismatches`에는 둘 다 남는다.

### 3.⑤ cleanup이 자기가 모르는 원문(`zipx/`·`claude.prompt`)을 남긴다

**현상**: cleanup은 알려진 이름(`worktree/`·`zip/`·`blobs/`·`codex.*`·`pack-a.md`·`pack-b.md`·`baseline/`)만 지운다. 실사용에서 Claude 검토자가 바이트 대조용으로 만든 `W/zipx/`(배포본 원문 전개)와 메인이 만든 `W/claude.prompt`(팩 A 원문 포함)가 남아 사람이 손으로 지웠다. F7(임시 원문 잔존 금지)·F5(원문 미보존)에 걸린다.

**재현 근거**: 실사용 세션 로그 — Claude 검토자(서브에이전트)의 `mkdir -p "$W/zipx" && unzip … && cmp …` · 메인의 `W/claude.prompt` 작성 · 메인의 수동 `rm -rf "$W/zipx" "$W/claude.prompt"`. 어느 쪽도 SKILL.md가 정한 파일이 아니다.

**원인**: `report.mjs:396-442` `cleanup()` — 삭제가 **열거 방식**(아는 이름만). 검토자·메인이 임의 이름으로 만드는 임시 파일은 규약 밖이라 잡히지 않는다.

**수정 방향(사용자 결정 2026-10-22 — 선택지 (A))**: cleanup을 **허용 목록 방식**으로 바꾼다. 선행 가드 둘 — ① `codex.pid` 생존 가드(지금과 같음) ② **작업 디렉터리 표지(D26)**: `W/snapshot.json`이 존재하고 JSON으로 파싱되며 `mode`가 `worktree|diff-only`, `head_sha`가 40자 16진수, `fetched_at`이 문자열일 때만 우리 작업 디렉터리로 본다. 파일이 없거나 형식이 다르면 **아무것도 지우지 않고** `ERR snapshot.json 없음|형식 불일치 — mr-review 작업 디렉터리로 확인되지 않아 정리하지 않는다: <W의 최상위 항목 목록>` exit 2(엉뚱한 디렉터리를 비우는 비가역 사고 방지; SKILL §0의 「cleanup ERR → 남은 경로 보고」 경로로 사람이 처리). 가드를 지나면 지금의 삭제·마스킹을 그대로 한 뒤, `W`의 최상위 항목 중 **허용 9종**(`snapshot.json`·`pack.json`·`mr.json`·`check.json`·`deploy.json`·`review-claude.json`·`review-codex.json`·`findings.json`·`verdict.json`) 외 파일·디렉터리(숨김 파일 포함, 심볼릭 링크는 링크만 — `fs.rmSync`는 링크 대상을 따라가지 않는다)를 전부 지우고 그 개수(최상위 항목 수)를 `extra`로 센다. 첫 줄 = `CLEANED worktree=<b> zip=<n> raw=<n> masked=<n> extra=<n>`, **둘째 줄 이후**에 지운 추가 항목 이름을 `extra: zipx/, claude.prompt` 꼴로 나열한다(D34 — SKILL은 첫 줄만 판독하므로 호환 영향 없음). 리포트는 `W` 밖(어댑터 `report.dir`)이라 영향 없다. `--resolve` 재실행 입력(`findings`·`verdict`·`check`·`snapshot`·`deploy`·`mr`)은 전부 허용 목록에 있다.

- **cleanup ERR 경로(D33)**: collect가 `snapshot.json`을 쓰기 전에 실패하면(예: 호스트 불일치 ERR) cleanup은 표지 부재로 ERR가 된다. 동작은 바꾸지 않고(fail-closed 유지 — `rebuildDiffOnly` 도중 예외로 `blobs/`만 남는 드문 경우도 같은 경로로 사람 눈에 든다) SKILL §0 「공통 종료 절차」의 cleanup ERR 보고 문구를 정정한다: 「ERR에 적힌 `W` 항목 목록이 비어 있으면 지울 것이 없는 정상 종료, 비어 있지 않으면 사람이 지운다」. 기각: cleanup이 알려진 이름만 있으면 정상 종료(분기 추가) · SKILL §0을 「`COLLECTED` 이후부터 cleanup」으로 좁힘(드문 blob 잔존을 놓친다).
- 기각: (B) 이름 추가 — 다음 변종이 또 남는다. (C) (A) + `W/tmp/` 규약 — 허용 목록 방식이면 규약이 없어도 지워지므로 문서 변경을 늘릴 이유가 없다.

**AC**

- AC⑤-1. 정상 `W`(우리 형식 snapshot.json 있음)에 `zipx/x.js`·`claude.prompt`·`tmp/a.txt`·`.hidden`을 만들어 두고 cleanup → 넷 다 삭제, 첫 줄 `… extra=4`, 둘째 줄 이후에 `extra:` + 네 이름, `W`에 허용 9종(존재하는 것)만 남는다.
- AC⑤-2. (가) `snapshot.json`이 없는 디렉터리(다른 파일 몇 개 있음)에 cleanup → 첫 줄 `ERR … snapshot.json 없음` exit 2, 디렉터리 내용 **불변**(파일 수·내용 동일). (나) `snapshot.json`이 있지만 우리 형식이 아닌 디렉터리(`{"foo":1}`) → 첫 줄 `ERR … 형식 불일치` exit 2, 내용 불변.
- AC⑤-3. `codex.pid` 생존 가드 테스트(`report.test.mjs:379`)·마스킹 실패 테스트(`:580`)·정상 정리 테스트(`:407`) — 첫 줄 형식(`extra=` 추가) 갱신 외 통과.
- AC⑤-4. cleanup 뒤 `--resolve` 재실행(`verdict --resolve … → render`)이 성공한다(허용 목록이 재실행 입력을 전부 보존).
- AC⑤-5. `W/link`가 `W` 밖 디렉터리를 가리키는 심볼릭 링크일 때 cleanup → 링크만 삭제되고 대상 디렉터리 내용은 불변.
- AC⑤-6. SKILL.md §0 「공통 종료 절차」에 cleanup ERR 목록이 비었을 때의 정상 종료 안내 문구가 실재한다(grep).

### 3.⑧ Codex가 자기 런타임 파일을 읽은 것을 「격리 위반 의심」으로 오탐

**현상**: 리포트 헤더에 「격리 위반 의심 — Codex가 워크트리 밖을 읽었을 수 있음: `<HOME>/.codex/plugins/cache/<공급자>/<스킬>/…`」. Codex가 자기 플러그인 스킬 파일을 읽은 것이며 대상 저장소·위키 자료 유출과 무관하다. 경고가 매번 뜨면 리뷰어가 실제 경고를 무시하게 된다(D16 ⓑ의 목적 훼손).

**재현 근거**: 실사용 리포트 헤더 8행 그대로. `codex.out`의 실행 로그에 그 경로가 있었고 SKILL.md §5 경로 감시 규칙(「`/`·`~`·드라이브 문자로 시작하고 워크트리 접두가 아닌 것」)이 그대로 잡았다.

**원인**: `SKILL.md:158` 경로 감시(LLM 단계 — 코드 없음)에 제외 규칙이 없다. Codex는 자기 설치본(`$CODEX_HOME`, 기본 `~/.codex/`)의 스킬·플러그인을 읽는 것이 정상 동작이다.

**수정 방향(harden 확정 D32)**: SKILL.md §5 「경로 감시」에 **제외 3종**을 명시한다 — (가) `$CODEX_HOME`(미설정이면 `~/.codex/`) 아래 **전부**(플러그인·스킬뿐 아니라 설정·인증·세션 기록 포함 — Codex 자기 홈은 D16이 감시하는 「워크트리 밖 자료의 외부 전송」 대상이 아니다), (나) companion 설치 경로 `$ROOT` 아래 전부, (다) 우리 작업 디렉터리 `W` 자체(`W/codex.prompt`·`W/codex.out`·`W/blobs/…` — diff-only에서 cwd가 `W/blobs/head`라 `W`의 다른 경로가 워크트리 밖으로 보인다). **우선 규칙**: 어댑터 위키 루트(전송 금지 루트 포함) 아래 경로는 어떤 제외보다 앞선다(위키가 그 아래에 있어도 경고). 제외한 경로는 리포트에 적지 않고 터미널 요약에 「Codex 자체 경로 n건 제외」 한 줄만 둔다. `findings.json` 스키마·`report.mjs`는 바꾸지 않는다. 기각: `$CODEX_HOME/plugins`·`skills`만 제외 — 그 밖 Codex 홈 읽기(설정 등)가 다음 오탐이 되고, 오탐 반복은 리뷰어가 진짜 경고를 무시하게 만든다.

- 기각: 경로 감시를 CLI 서브커맨드로 옮기는 것 — `codex.out` 판독은 이미 LLM 단계(JSON 추출과 같은 자리)이고 이번 결함은 규칙 누락이라 문구 수정으로 충분하다. 코드화는 ⑥(지문 병합) 트랙에서 `review-validate` 확장과 함께 보는 것이 자연스럽다.

**AC**

- AC⑧-1. SKILL.md §5 경로 감시 항목에 제외 (가)(나)(다)와 위키 루트 우선 문장, 터미널 요약 「Codex 자체 경로 n건 제외」 문구가 실재한다(grep `CODEX_HOME`·`\$ROOT`·`\$W`·「위키 루트」·「제외」 각 1건 이상).
- AC⑧-2. (9단계 실측) 1.3.1 설치본으로 같은 MR을 재실행한 리포트 헤더에 「격리 위반 의심」이 없고, 터미널 요약에 「Codex 자체 경로 n건 제외」가 있다.

## 4. 영향 범위

| 대상 | 변경 |
|---|---|
| SC-3 `snapshot.json` | `base_source` 필드 추가(`"api" \| "merge-base"`). `mode: worktree`의 `base_sha` 설명 = 「API diff base(조상 확인), 없으면 merge-base」, 재수집 조건 = 「fetch head ≠ API head **또는** diff 버전 head ≠ API head」로 정정 — **plan SC-3 문장 정정은 impl 트랙이 한다(D30)**, 이 spec이 정본 |
| SC-3 `deploy.json` | `zip.bytes_source` 추가, `mismatches.kind`에 `bytes_unavailable` 추가, `bytes(path null)` 제거 |
| cleanup 첫 줄 | `CLEANED … extra=<n>` + 둘째 줄 이후 `extra:` 이름 나열 — SKILL.md §8 문구 갱신 |
| render 헤더 | `mr.state`가 merged·closed면 「머지 뒤 리뷰」 1줄(D29) — 판정·절 순서 불변 |
| 1.3.0 spec §5.1-2 | 「base = merge-base」 문장을 impl 트랙이 「1.3.1에서 변경 — API diff base, spec 2026-10-22 3.②」로 정정(D30) |
| SKILL.md | §0 전제(① glab 설정 문구 + `version` GET 사전 점검 D31 · cleanup ERR 보고 문구 D33) · §5 경로 감시(⑧ 제외 3종 + 위키 우선 D32) · §8 cleanup 첫 줄·둘째 줄(⑤) |
| README 3종 | 1.3.1 한 줄(결함 5건) + mr-review 절 어댑터 안내에 포트 있는 GitLab의 glab 설정 전제 1문장 |
| plugin.json·marketplace.json | 1.3.0 → 1.3.1 |
| 어댑터 문서(프로젝트 쪽) | 변경 없음(SC-2 형식 유지) — 포트 있는 GitLab 사용자는 glab 설정만 확인 |

## 5. 검증 · 완료 조건

- 각 AC를 `tests/mr-review/*.test.mjs`에 **먼저 RED로** 추가한 뒤 구현으로 GREEN(TDD). 게이트 = 기존 테스트 전부 통과 + SC-7 T6 식별자 패턴 0건 + AI 서명 0건.
- 8단계 impl 적대검증(review-loop `--phase impl`)은 경량이어도 필수(dev-cycle 하한).
- 9단계: 1.3.1 릴리스 커밋·push → 설치본 갱신 → 머지된 MR 1건을 **워크트리 모드**로 재실행해 배포본 「일치」·헤더에 격리 위반 의심 없음·cleanup 뒤 `W` 허용 9종만 남음을 확인(AC②·③·⑤·⑧의 실측).

## 6. 잔여 리스크 (DEFERRED · 실측) · 미해결 질문

**미해결 질문: 없음.** harden-spec(2026-10-22)의 판단 갭 9건은 전부 질문으로 해소됐고 사용자가 유예한 갭은 없다 — **DEFERRED 0건**.

**검증 필요(실측 — repo 조회로도 사용자 결정으로도 닫히지 않는 외부 사실)**

- 포트 있는 GitLab에서 glab 설정 전제(포트 없는 호스트 키 + `api_host`에 포트)가 **다른 리뷰어 PC**에서도 성립하는지 — 9단계 실측 때 사용자 PC 1대로 확인. `glab auth login`이 자동으로 만드는 항목 형식은 버전마다 다를 수 있어 SKILL.md에는 「설정 항목이 있어야 한다」 + §0 사전 점검(D31)까지만 둔다.
- AC⑧-2(격리 위반 의심 헤더 소멸·「Codex 자체 경로 n건 제외」 표시)는 1.3.1 설치본 실사용에서만 확인된다 — 9단계.

**수용된 한계(결정은 내려졌고 리스크만 기록)**

- ③ 심링크 극단 케이스(D22): git 심링크 경로의 raw 응답은 링크 대상 문자열이라, zip 항목이 일반 파일이고 내용이 그 문자열과 같으면 「일치」. 실사용에서 심링크 배포 대상이 나오면 (B) tree API 유형 대조를 재검토.
- ⑤ collect가 `snapshot.json`을 쓰기 전에 실패한 뒤의 cleanup은 ERR로 끝난다(D33) — 정상 상황이 한 줄 보고로 보이지만, 원문 잔존 가능성을 사람 눈에 두는 쪽(fail-closed)을 택했다.

## 재논의 금지(기결정)

사용자 결정(2026-10-22, 메인 전달 15:3x + 이 세션 질의). 리뷰에서 다시 제안하지 않는다. 1.3.0 spec의 D1~D16은 전부 승계한다.

| D | 결정 | 근거 |
|---|---|---|
| D17 | 이 트랙 범위 = 결함 ②·①·③·⑤·⑧. ④·⑥·⑦·정책 질문은 비목표 | 사용자 결정(15:3x, 메인 전달) |
| D18 | 버전 = 1.3.1 패치. 릴리스 커밋은 impl 트랙 몫 | 사용자 결정(15:3x) |
| D19 | 경로 = **경량**. 생략 = 4단계 spec 적대검증(review-loop spec)·5단계 plan·6단계 plan 적대검증(5 생략의 자동 귀결). 근거 = 결함 5건이 재현 근거·원인 줄까지 특정됐고 접촉 표면 무신호, 사용자 확인(수동 모드) | 사용자 결정(이 세션 Q1) — 하한(spec·harden·impl 적대검증)은 유지 |
| D20 | ② base = API diff base(`versions[0].base_commit_sha` → `diff_refs.base_sha`) + 조상 확인, 아니면 ERR. 둘 다 없으면 merge-base 폴백 + 「git diff 0 ≠ API 변경 ≥1 → ERR」 방어 | 사용자 결정(이 세션 Q2 — (A)). (B) 머지 커밋 첫 부모·(C) diff-only 강제 기각 |
| D21 | ① `--hostname`에는 포트 제거, web_url 대조는 포트 포함, 어댑터 `gitlab.host` 형식 `host[:port]` 유지(SC-2 호환). glab 설정 전제는 SKILL §0·README에 안내 | 사용자 결정(15:3x) |
| D22 | ③ diff-only 바이트 대조 = `W/blobs/head/` 기준. 유형은 zip 쪽만 확인(일반 파일 아니면 불일치), 미확보 파일은 경로별 대조 불가. tree API 유형 대조는 하지 않는다 | 사용자 결정(이 세션 Q3 — (A)) |
| D23 | ⑤ cleanup = 허용 목록 9종 외 전부 삭제, `snapshot.json` 없으면 아무것도 지우지 않고 ERR, 첫 줄 `extra=<n>`. `W/tmp/` 규약은 두지 않는다 | 사용자 결정(이 세션 Q4 — (A)) |
| D24 | ⑧ 수정 위치 = SKILL.md 경로 감시 문구(제외 2종 + 위키 루트 우선). 코드화하지 않는다 | 설계 결정 — 경로 감시가 LLM 단계이고 결함이 규칙 누락이라 문구로 충분. 코드화는 ⑥ 트랙에서 |
| D25 | 이 세션(spec·harden)은 코드·테스트·SKILL.md·plan·README를 수정하지 않는다 | 트랙 프롬프트 편집 범위 |

harden-spec(2026-10-22, 이 세션)에서 확정 — 질문 9건 전부 추천안 채택.

| D | 결정 | 근거 |
|---|---|---|
| D26 | ⑤ cleanup 작업 디렉터리 표지 = `snapshot.json`이 **우리 형식으로 파싱**될 때만(`mode` worktree\|diff-only · `head_sha` 40자 16진수 · `fetched_at` 문자열). 없거나 형식이 다르면 무삭제 ERR | 사용자 결정(갭 H1) — 다른 도구의 동명 파일로 엉뚱한 디렉터리를 비우는 비가역 사고 방지 |
| D27 | ② 워크트리 모드도 diff 버전 head(`versions[0].head_commit_sha`·`diff_refs.head_sha`) ≠ `api_head`면 재수집(최대 3회 → exit 3 `HEAD_MOVED`) | 사용자 결정(갭 A1) — 두 모드의 재수집 조건 대칭 |
| D28 | ② 조상 확인 실패 + 얕은 clone이면 ERR 문구로 `git fetch --unshallow` 안내. 자동 unshallow 안 함 | 사용자 결정(갭 A2) — 읽기 전용 스킬이 사용자 체크아웃에 큰 fetch를 임의로 하지 않음 |
| D29 | ② `mr.state` merged\|closed면 리포트 헤더 「머지 뒤 리뷰」 1줄. 판정·절 순서 불변 | 사용자 결정(갭 A3) — 머지 뒤 리뷰라는 새 케이스의 최소 표시, D9 무관 |
| D30 | plan SC-3 snapshot 문장 · 1.3.0 spec §5.1-2 문장 정정 = impl 트랙(「1.3.1에서 변경」 표기). 이 세션은 안 고침(D25) | 사용자 결정(갭 A4) — SC-3은 구현이 읽는 계약, 어긋남 = 회귀 위험 |
| D31 | ① SKILL §0에 `glab api --hostname <포트 없는 host> version` GET 1회 사전 점검, 실패 = 설정 안내 + 정지 | 사용자 결정(갭 B1) — 어댑터 복사만으로 리뷰어를 늘리는 공유 경계(§6) 전제 |
| D32 | ⑧ 경로 감시 제외 = `$CODEX_HOME` 전체 + `$ROOT` + `W` 자체. 어댑터 위키 루트는 제외보다 우선 | 사용자 결정(갭 B2) — 오탐 반복은 진짜 경고를 무력화, Codex 홈은 D16 감시 대상 아님 |
| D33 | ⑤ snapshot 전 실패 뒤의 cleanup ERR는 동작 유지, SKILL §0 보고 문구만 「목록 비면 정상」으로 정정 | 사용자 결정(갭 B3) — fail-closed 유지 |
| D34 | 세부 4종 채택: `snapshot.base_source`·`deploy.zip.bytes_source` 진단 필드 · 이름 `bytes_unavailable`·`BASE_MISMATCH`·`DIFF_EMPTY_MISMATCH` · 배포본 결과 우선순위 「대조 불가 > 불일치」 유지 · cleanup 둘째 줄 이후 `extra:` 이름 나열 | 사용자 결정(갭 B4) |
