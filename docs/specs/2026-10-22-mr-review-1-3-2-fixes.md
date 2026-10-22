# mr-review 1.3.2 — 2차 실사용에서 드러난 엔진 결함 4건 수정

> 상태: **impl 완료(HEAD)**(2026-10-22 21:1x — 7 impl 트랙, 위임 · 결함 ⑨ `eaef5a4`·`462b974`(⑨ 표시 + ⑪) · ⑫ `8c4ffa5` · ⑩ `aacc738` · README `08dde93` · D42 정정 `25328b3` · 게이트 SC-7 T1 182/182 · T2~T7 0 · T3 56/56 · version 1.3.1 유지) · 이전: spec 확정 — harden 완료(2026-10-22 20:1x) · 작성 2026-10-22 · 버전 **1.3.2 패치** · 다음 = 8 review-loop(impl) `--phase impl --security yes --auto-rounds 1 --base c3b946a` → 9 릴리스(version bump·실측 V1~V3·AC⑨-10·⑩-3·⑪·⑫-3 실측)
> 선행: 1.3.0 spec `docs/specs/2026-10-21-mr-review-skill-design.md`(D1~D16 승계) · 1.3.1 spec `docs/specs/2026-10-22-mr-review-1-3-1-fixes.md`(D17~D34 승계 — 특히 D22 diff-only 바이트 대조·D32 경로 감시 제외 3종·D34 배포본 결과 우선순위) · plan `docs/plans/2026-10-21-mr-review-skill.md`(SC-1~SC-8)
> 경로: **경량**(dev-cycle 1차 판정 + 사용자 확인 2026-10-22 19:5x, 수동 모드 — 접촉 표면 무신호: 스키마·마이그레이션·권한·인증·외부 연동 신설 없음. ⑨ `.class` 존재 대조·⑩ 경로 감시 제외 확대는 「증거를 약하게 만드는」 변경이라 리포트에 명시하고 테스트로 고정한다)

## 1. 배경 · 목표

1.3.1 설치본으로 **열린 정식 코드 MR 1건**을 워크트리 모드로 끝까지 리뷰했다(2026-10-22 19:4x — 2차 실사용). 1.3.1이 고친 ①(포트)·②(머지된 MR base)·③(diff-only 바이트)·⑤(cleanup)·⑧(Codex 홈 오탐)은 해소가 확인됐고, 새로 엔진 결함 4건이 드러났다. 번호는 실사용 기록(⑨~⑫)을 그대로 쓴다. 우선순위 = ⑨(정상 배포본을 차단 증거로 오판 → 모든 WAR 프로젝트 MR이 `HOLD_EVIDENCE`) > ⑫(의도 대조표 병합 실패 — 리포트 1절 전체) > ⑪(가독성) > ⑩(오탐 잔존 가능).

**목표**

- G1. Maven WAR 배치로 묶은 정상 배포본 zip이 「일치」로 판정된다. 소스 배치 zip을 쓰는 프로젝트의 동작은 그대로다(⑨).
- G2. 컴파일 산출물(`.class`)은 존재만 대조하고, 그 사실(「바이트 대조 생략 n건」)이 리포트와 실행 블록에 보인다(⑨).
- G3. Codex가 명령을 실행한 셸·인터프리터 경로와 코드 속 URL 라우트 문자열이 「격리 위반 의심」 후보로 남지 않는다(⑩).
- G4. 배포본 불일치 목록은 리포트 부록 A 한 곳에만 전문으로 있고, 본문(실행 블록·보완 문안·부록 D)은 종류별 건수 + 앞 3개 경로 + 참조로 끝난다(⑪).
- G5. 두 모델의 의도 대조표를 행 번호로 병합한다 — 두 모델의 행 문구가 달라도 같은 행이 합쳐진다(⑫).

## 2. 범위 · 비목표

**범위**(impl 트랙이 고친다 — 이 세션은 spec만): `dev-workflow/skills/mr-review/scripts/lib/{adapter,deploy,report}.mjs` · `dev-workflow/skills/mr-review/SKILL.md`(§5 공통 입력 5·출력 스키마 `intent`·경로 감시 · §6-5 병합 규칙 · §8 터미널 요약·리포트 구성 문구) · `tests/mr-review/{adapter,deploy,report}.test.mjs` · `dev-workflow/.claude-plugin/plugin.json`·`.claude-plugin/marketplace.json` 버전 1.3.2 · README 3종의 1.3.2 한 줄 + 어댑터 안내에 `deployLayout` 1문장 · plan SC-2(어댑터 선택 키)·SC-3(`deploy.json` 필드) 문장 정정(1.3.1 D30과 같은 방식 — impl 트랙이 「1.3.2에서 변경」 표기로). 어댑터 계약(SC-2)의 **기존 키·형식은 바꾸지 않는다** — 선택 키 1개(`projects.<이름>.deployLayout`)만 더한다.

**비목표(이 트랙에서 하지 않는다)** — 사용자 결정 2026-10-22(D35)

- ④ 위키 발췌가 관련성 아닌 알파벳순 앞 10페이지로 뽑히는 문제 — 팩 설계 변경, 별도 트랙(1.3.1 비목표 승계).
- ⑥ 두 모델 발견 지문이 제목 문자열이라 기계 병합이 안 되는 문제 — 지문 설계 변경, 별도 트랙(1.3.1 비목표 승계). ⑫(의도 대조표 병합)는 ⑥과 다른 표다 — 발견(`findings`)이 아니라 `intent`.
- ⑦ 어댑터 `verdictFirstLine` 정규식이 사람 판정 댓글 형식과 안 맞는 문제 — 어댑터(프로젝트 문서) 쪽.
- 「경량 MR의 변경 사유 누락을 차단으로 볼지」 정책 질문 — 어댑터·팀 정책 몫(D9).
- Maven WAR 외 배치(Gradle 커스텀·Spring Boot fat jar·`WEB-INF/lib/*.jar` 의존성 묶음)의 프리셋 — 요구가 생기면 엔진에 프리셋을 추가한다(어댑터 키 형식은 그대로).
- Maven 리소스 필터링(`${…}` 치환)으로 바이트가 바뀌는 리소스의 대조 — 지금처럼 `bytes` 불일치로 보인다(§6 수용된 한계).
- **다중 모듈 Maven**(WAR 모듈이 하위 폴더 — `web/src/main/webapp/…`) — 매핑 접두는 저장소 루트 고정(D45). 요구가 생기면 모듈 경로를 받는 프리셋 변종을 엔진에 추가한다.
- `.java` 외 소스(Kotlin `.kt`·Groovy 등)의 산출물 매핑 — 규칙 3은 `.java`만 다루고 그 밖은 「그대로」라 `.kt`는 `missing_in_zip`/`extra_in_zip`으로 보인다(spec 명시 귀결 — §6 한계).
- 경로 감시의 코드화(CLI 서브커맨드) — 1.3.1 D24 승계. ⑩은 문구 보완.
- 검증 표를 스크립트(`check.mjs`)가 파싱하는 것 — 조회 결과 `check.mjs`에 검증 표 파서가 없고, 행 수·원문은 메인(LLM)이 센다(D44). 표 모양이 프로젝트마다 달라 파싱 규칙을 어댑터 계약으로 올리지 않는다.
- 1.3.0·1.3.1 설계 결정 D1~D34의 재론.

## 3. 결함별 명세

예시는 전부 가상 값이다(프로젝트 `alpha` = Maven WAR 배치 · `beta` = 소스 배치 · MR `!52` · head `c3c3c3c` · 패키지 `com/example/acct`). 재현 근거의 사실은 2차 실사용 산출물(`deploy.json`·`check.json`·`findings.json`·`review-claude.json`·`review-codex.json`·리포트)과 그 세션 로그를 **읽기 전용**으로 확인한 것이며, 리뷰 대상 프로젝트 식별자는 전부 치환했다(D10·SC-7 T6).

### 3.⑨ 배포본 대조에 소스↔WAR 경로 매핑이 없어 정상 zip을 38건 불일치로 오판

**현상**: 어댑터 `deploy.targets = ["src/main/**"]`인 프로젝트에서 작성자가 Maven WAR 배치(`WEB-INF/classes/…`·웹 루트)로 변경 파일 19개를 묶어 올렸다. 엔진은 기대 배포 목록(소스 경로 19건)과 zip 항목(WAR 경로 19건)을 **글자 그대로** 비교해 `missing_in_zip` 19 + `extra_in_zip` 19 = 38건 「불일치」를 냈고, `M-deploy`가 차단 증거로 들어가 판정 입력을 `HOLD_EVIDENCE` 쪽으로 밀었다. 사용자가 손으로 대조한 결과는 19/19 일치(정상 zip).

**재현 근거**(`deploy.json`): `expected.deploy` 19건 = `src/main/webapp/**`(html 12 · js 2) + `src/main/java/**/*.java` 4 + `src/main/resources/**`(xml 1) · `zip.entries` 19건 = 웹 루트(html 12 · js 2) + `WEB-INF/classes/**/*.class` 4 + `WEB-INF/classes/**.xml` 1 · `zip.comment_sha` = head · `zip.bytes_source = worktree` · `mismatches` 38건 = `missing_in_zip` 19 · `extra_in_zip` 19, `bytes`·`type` 0건(바이트 대조 루프가 `expSet.has(e.name)`에서 전부 건너뜀). 아래 3규칙으로 기대 목록을 사상하면 **zip 항목 집합과 정확히 같다**(이 세션에서 산출물로 재계산). 내부 클래스(`$`) 항목은 이 zip에 없었다. 1차 실사용(다른 프로젝트, 1.3.1 spec 3.③ 재현 근거)의 zip 3건은 소스 경로 그대로였다 — **프로젝트마다 zip 배치가 다르다**.

**원인**: `deploy.mjs:19-34` `expectedLists()`가 소스 경로를 그대로 기대 목록으로 쓰고, `deploy.mjs:295-298`이 `inZip`·`expSet`을 문자열 집합으로 비교한다. 1.3.0 spec §5.2b(「② zip 파일 목록 = 배포 목록」)가 「배포 목록 = 소스 경로」를 전제했고, 정책 §6.1이 WAR 배치 zip을 허용하는 것을 설계가 놓쳤다. `deploy.mjs:302`·`:316`의 `if (!expSet.has(e.name)) continue;`는 매핑이 없으니 바이트 대조도 한 건도 안 했다.

**수정 방향(사용자 결정 2026-10-22 — D37·D38)**

1. **어댑터 선택 키** `projects.<이름>.deployLayout: "source" | "maven-war"`(SC-2). 없으면 `"source"` = 지금 동작(기존 어댑터 전부 무변경·무영향). 다른 값이면 `AdapterError`(`adapter.mjs:19` 필수 키 검사 옆, `:96` resolved 프로젝트에 `deployLayout` 보존). `deploy()`는 `mr.json.project`로 resolved 프로젝트를 찾아 레이아웃을 읽고 `deploy.json.zip.layout`에 적는다. 매핑 표는 **엔진에 내장**한다(어댑터는 이름 하나만) — Gradle 등 다른 배치가 나오면 프리셋을 엔진에 추가한다.
2. **`maven-war` 매핑**(소스 경로 → zip 경로, **저장소 루트 기준** 접두 일치 — D45; 셋은 서로 겹치지 않는다):
   - `src/main/webapp/<rest>` → `<rest>` (바이트 대조)
   - `src/main/resources/<rest>` → `WEB-INF/classes/<rest>` (바이트 대조)
   - `src/main/java/<rest>` → `.java`면 `WEB-INF/classes/<rest 에서 .java 를 .class 로>` (**존재 대조만** — D38) · **그 밖 파일**(`.xml`·`.properties` 등 — Java 폴더에 리소스를 두는 관행, D43)은 `WEB-INF/classes/<rest>` (바이트 대조)
   - 그 밖(`**/*.sql`·`pom.xml` 등 targets에 걸린 다른 경로, 하위 모듈의 `web/src/main/…`) → 그대로(바이트 대조)
   `source` 레이아웃은 전부 「그대로」다.
3. **대조 절차**(1.3.0 §5.2b ①~④ 유지, ②③④에 매핑 적용):
   - 기대 사상 `expectedZip`: zip 경로 → `{ source, compare: "bytes" | "exists" }`. **두 소스 경로가 같은 zip 경로로 사상되면**(예: `src/main/resources/a.xml`과 `src/main/webapp/WEB-INF/classes/a.xml`) `{kind:"map_conflict", path:<zip 경로>, detail:"소스 두 경로가 같은 배포 경로로 사상됨: A, B"}` → 결과 **대조 불가**(어느 원문과 비교할지 정할 수 없다 — fail-closed).
   - ② 목록: `missing_in_zip` = `expectedZip`의 키 중 zip에 없는 것(`path` = **소스 경로**, `detail` = 「배포 목록에 있으나 zip 에 없음(기대 경로 `<zip 경로>`)」) · `extra_in_zip` = zip 항목이 `expectedZip`에 없는 것(`path` = zip 경로) — 조회는 **2단계**: 먼저 zip 이름 그대로 찾고, 없으면 `.class` 항목에 한해 내부 클래스 접미를 제거한 **정규화 이름**으로 다시 찾는다(`WEB-INF/classes/com/example/acct/Foo$Bar.class`·`Foo$1.class` → `…/Foo.class`) — 내부 클래스는 `Foo.java`의 산출물이라 초과 항목이 아니다. 원래 이름을 먼저 보므로 소스 파일 이름에 `$`가 든 극단 케이스(`Foo$Bar.java`)도 깨지지 않는다. `source` 레이아웃에서는 정규화를 하지 않는다(`.class`가 기대 목록에 올 일이 없다). 경로 표기 규칙(D46): 요약·보완 문안에 나오는 `missing_in_zip` 경로는 **소스 경로**, 기대 zip 경로는 부록 A의 `detail`에만.
   - ③ 바이트: `compare: "bytes"`는 지금과 같다(워크트리 `git show <head>:<소스 경로>` / diff-only `W/blobs/head/<소스 경로>` ↔ zip 항목 바이트, 유형 대조 포함). `compare: "exists"`인 zip 항목(내부 클래스 포함)은 바이트·유형 대조를 **건너뛰고** `zip.bytes_skipped`(zip 경로 배열, 정렬)에 적는다. `bytes_skipped`는 `mismatches`가 **아니다**(판정 입력에 넣지 않는다 — D38). 단 유형이 `file`이 아닌 `.class` 항목(심링크 등)은 `type` 불일치로 남긴다(존재 대조도 일반 파일만 인정).
   - ④ 삭제 목록: 기대 삭제 목록(소스 경로)과 본문 삭제 목록을 **둘 다 zip 경로로 정규화**(소스 접두가 있으면 매핑, 이미 zip 경로 꼴이면 그대로, `.class` 내부 클래스 접미 제거)한 뒤 집합 비교. `detail`에는 양쪽 원문을 그대로 적는다. 작성자가 소스 경로로 적어도 WAR 경로로 적어도 통과한다.
   - 결과 산정: `map_conflict`는 `download`·`corrupt`·`bytes_unavailable`과 같은 「대조 불가」군(D34 우선순위 「대조 불가 > 불일치 > 일치」 유지). `bytes_skipped`만 있고 `mismatches`가 비면 **「일치」**.
4. **`deploy.json`(SC-3)**: `zip.layout: "source" | "maven-war"`(프로젝트 레이아웃 — `해당 없음`·제외 프로젝트로 일찍 끝나도 **항상** 기록) · `zip.bytes_skipped: [<zip 경로>]`(기본 `[]`) 추가 · `mismatches.kind`에 `map_conflict` 추가. `expected.deploy`·`expected.deleted`는 **소스 경로 그대로**(기존 소비자 불변).
5. **표시**(⑪과 함께 `report.mjs` + SKILL §8, D47): `bytes_skipped`가 1건 이상이면 (가) 실행 블록 「2. 검증 상태」 배포본 줄에 「바이트 대조 생략 n건(컴파일 산출물 — 존재만 확인)」 (나) 부록 A에 같은 문구 + 생략한 zip 경로를 한 줄에 하나씩 (다) §8 터미널 요약의 「배포본 대조 결과」 항목에 「(바이트 대조 생략 n건)」. 리포트 헤더에는 넣지 않는다(헤더는 리뷰 자체의 상태 — 교차 검토·기준선·머지 뒤 — 만 담는다). 리뷰어가 약한 증거임을 알고 판단한다(F8의 정신 — 표시 없는 「일치」로 읽히지 않게).

- 기각: (B) 어댑터에 매핑 표(`deploy.mapping: [{from,to,ext}]`) — 작은 규칙 언어가 생겨 검증·테스트·문서가 늘고 어댑터 작성자가 Maven 배치를 알아야 한다. (C) 엔진이 소스·WAR 둘 다 자동 시도 — 「둘 중 하나 맞으면 통과」라 초과 항목 판별이 흐려지고 섞인 배치를 조용히 받아들인다. `.class`를 「대조 불가」로 — Java를 고친 모든 MR이 영구 `HOLD_EVIDENCE`가 되어 배포본 대조가 무의미해진다. 새 결과값 「부분 일치」 — 결과 어휘 5종·판정 규칙 변경(D9 저촉).
- 알려진 한계(기록만, §6): 파일 이름과 다른 공개 클래스를 가진 `.java`(한 파일에 공개 클래스 둘은 컴파일 오류라 실질적으로 `package-info.java`·비공개 최상위 클래스만) → 산출물 이름이 달라 `missing_in_zip`/`extra_in_zip`. Maven 리소스 필터링 → `bytes` 불일치. 둘 다 리뷰어가 부록 A를 보고 사람 판단으로 넘긴다.

**AC(테스트로 검증 — `tests/mr-review/{adapter,deploy,report}.test.mjs`)**

- AC⑨-1. 어댑터 `projects.alpha.deployLayout = "maven-war"` → `loadAdapter().resolved.projects.alpha.deployLayout === "maven-war"` · 키 없음 → `"source"` · `"gradle"` → `AdapterError`(메시지에 `deployLayout`).
- AC⑨-2. (워크트리 모드) 기대 목록 = `src/main/webapp/html/a.html`·`src/main/webapp/js/a.js`·`src/main/resources/mapper/a.xml`·`src/main/java/com/example/acct/Foo.java` 4건, zip = `html/a.html`·`js/a.js`·`WEB-INF/classes/mapper/a.xml`(head 바이트)·`WEB-INF/classes/com/example/acct/Foo.class`·`WEB-INF/classes/com/example/acct/Foo$1.class`(임의 바이트) → `DEPLOY 일치` · `mismatches = []` · `zip.layout = "maven-war"` · `zip.bytes_skipped = ["WEB-INF/classes/com/example/acct/Foo$1.class", "WEB-INF/classes/com/example/acct/Foo.class"]`.
- AC⑨-3. 같은 픽스처에서 `html/a.html` 바이트 1바이트 변경 → `{kind:"bytes", path:"src/main/webapp/html/a.html"}` 불일치 · `Foo.class` 바이트를 바꿔도 `mismatches` 불변(존재만).
- AC⑨-4. 같은 픽스처에서 zip의 `Foo.class` 제거 → `{kind:"missing_in_zip", path:"src/main/java/com/example/acct/Foo.java"}`(detail에 `WEB-INF/classes/com/example/acct/Foo.class`) · zip에 `WEB-INF/classes/com/example/acct/Bar.class` 추가(기대에 `Bar.java` 없음) → `{kind:"extra_in_zip", path:"WEB-INF/classes/com/example/acct/Bar.class"}` · `Foo$2.class`만 추가 → 불일치 없음.
- AC⑨-5. `deployLayout` 없는(또는 `"source"`) 프로젝트 — 기존 `deploy.test.mjs` 전부 불변(`zip.layout = "source"` · `bytes_skipped = []`) · 소스 경로 zip 「일치」 그대로. 기존 픽스처 어댑터(`tests/mr-review/fixtures/adapter.md`)의 프로젝트는 레이아웃을 바꾸지 않고, `maven-war` 테스트는 **별도 프로젝트 키**(또는 별도 어댑터 픽스처)로 둔다(기존 테스트가 source zip을 쓴다 — 조회 사실).
- AC⑨-11. (`maven-war`) 기대 `src/main/java/com/example/acct/AcctMapper.xml` + zip `WEB-INF/classes/com/example/acct/AcctMapper.xml`(head 바이트) → 일치, `bytes_skipped`에 없음 · 바이트 1바이트 다르면 `{kind:"bytes", path:"src/main/java/com/example/acct/AcctMapper.xml"}` · zip에 없으면 `missing_in_zip`(detail에 `WEB-INF/classes/com/example/acct/AcctMapper.xml`).
- AC⑨-12. `exempt`·`해당 없음`으로 일찍 끝난 `deploy.json`에도 `zip.layout`이 프로젝트 값으로 있다.
- AC⑨-6. (diff-only 모드, `maven-war`) `W/blobs/head/src/main/webapp/html/a.html` ↔ zip `html/a.html` 바이트 대조 → 일치 / 1바이트 다르면 `bytes` / blob 없으면 `bytes_unavailable`(경로 = 소스 경로) · `.class`는 `bytes_skipped`.
- AC⑨-7. ④ 삭제 목록(`maven-war`): 기대 삭제 `src/main/java/com/example/acct/Old.java`·`src/main/webapp/html/old.html` · 본문 삭제 목록 `WEB-INF/classes/com/example/acct/Old.class`·`src/main/webapp/html/old.html`(혼용) → `deleted_list` 불일치 없음 · 본문에 `WEB-INF/classes/com/example/acct/Old$1.class`가 더 있어도 불일치 없음 · 본문이 `html/other.html`을 적으면 `deleted_list` 불일치.
- AC⑨-8. `map_conflict`: 기대 `src/main/resources/a.xml` + `src/main/webapp/WEB-INF/classes/a.xml` → `{kind:"map_conflict", path:"WEB-INF/classes/a.xml"}` · 결과 「대조 불가」(`extra_in_zip` 1건이 함께 있어도 대조 불가 — D34).
- AC⑨-9. `.class` zip 항목이 심볼릭 링크 유형이면 `{kind:"type", path:<zip 경로>}` 불일치(존재 대조도 일반 파일만).
- AC⑨-10. render: `deploy.json.zip.bytes_skipped` 2건 픽스처 → 실행 블록 「2. 검증 상태」 배포본 줄에 「바이트 대조 생략 2건(컴파일 산출물 — 존재만 확인)」 · 부록 A에 같은 문구 + 두 경로 각 1줄 · `bytes_skipped = []`면 그 문구 없음 · SKILL.md §8 터미널 요약의 배포본 항목에 「바이트 대조 생략」 문구가 실재한다(grep, D47).

### 3.⑩ 경로 감시 제외 목록에 Codex가 명령을 실행하는 셸 경로·비경로 문자열이 없어 수동 판별이 남는다

**현상**: 1.3.1 D32의 제외 3종(`$CODEX_HOME`·`$ROOT`·`W`) 뒤에도 경로 감시 후보가 2건 남았다 — (가) `/bin/bash`: Codex 실행 로그 `[codex] Running command: /bin/bash -lc '…'`의 **첫 토큰**(명령 실행기)이라 모든 명령 줄에 나온다. (나) `/infodownload`: 변경 코드 속 URL 라우트 리터럴로, 파일시스템 경로가 아니다. 메인이 손으로 둘을 걸러 `outsideWorktreePaths = []`로 썼다 — 규칙이 없으면 다음 리뷰어(세션)는 이를 「격리 위반 의심」으로 올리거나 매번 판단해야 한다.

**재현 근거**(2차 실사용 세션 로그, 읽기 전용): 경로 감시 grep(`(/|~)[A-Za-z0-9._/-]+`, 워크트리 접두 제외, `sort -u`) 결과 = `/bin/bash` · `<HOME>/.codex/plugins/cache/…`(D32 (가)로 제외) · `/infodownload` 3건. `codex.out` 5~12행이 전부 `[codex] Running command: /bin/bash -lc '…'`/`Command completed: /bin/bash -lc …` 꼴. 리포트 헤더에 「격리 위반 의심」 없음 · `findings.json.outsideWorktreePaths = []`(메인 수동 판별 결과). `codex.out` 원문은 cleanup(F7)이 지워 산출물에는 없다.

**원인**: `SKILL.md:160` 경로 감시(LLM 단계)의 후보 규칙이 「`/`·`~`·드라이브 문자로 시작하고 워크트리 접두가 아닌 것」 전부이고, 제외는 D32의 3종뿐이다. 명령 실행기 경로와 코드 속 절대 경로 꼴 문자열(URL 라우트·`/api/...`)이 규칙에 없다.

**수정 방향(D39 — SKILL.md §5 경로 감시 문구 보완, 코드 변경 없음)**: 제외 3종 뒤에 **제외 2종을 추가**한다.

- (라) **명령 실행기·시스템 실행 파일**(D48): `[codex] Running command:`·`Command completed:` 줄의 첫 토큰(셸·인터프리터 경로 — `/bin/bash`·`/bin/sh`·`/usr/bin/env` 등)과, 표준 시스템 디렉터리 아래 경로(`/bin/`·`/sbin/`·`/usr/bin/`·`/usr/sbin/`·`/usr/local/bin/`·`/usr/local/lib/`·`/usr/lib/`·`/usr/share/`·`/lib/`·`/lib64/`·`/opt/homebrew/`(전체) · Windows `C:\Windows\`·`C:\Program Files\`). 대상 저장소·위키 자료가 아니다. `/etc/`·`/opt/`(homebrew 외)·`/var/`·`/proc/`·`/usr/local/etc/`·사용자 홈 아래 다른 경로는 **제외하지 않는다**(설정 파일 등 호스트 정보가 외부로 갈 수 있는 읽기).
- (마) **존재하지 않는 경로**(D49): 후보 문자열(`~`는 `$HOME`으로 바꿔서)이 이 머신에 없으면(`[ -e "<경로>" ]` 거짓) 읽힌 자료가 없다 — URL 라우트(`/infodownload`)·코드 속 리터럴. **잘린 후보**(끝이 `...`·`…`이거나 companion 로그가 자른 자리)는 그 글자 그대로 검사하지 않고 **마지막 `/` 앞 디렉터리 부분**으로 검사한다(`~/notes/secret-plan/...` → `~/notes/secret-plan/`) — 디렉터리가 있으면 경로로 보고 제외하지 않는다(진짜 바깥 읽기를 「비경로」로 삼키지 않게). Codex 샌드박스는 같은 머신이라 존재 검사가 유효하다. 검사는 `[ -e ]`만 — 후보를 `cat`·`ls`로 열지 않는다.
- **우선 규칙은 그대로**: 어댑터 위키 루트(전송 금지 루트 포함) 아래 경로는 (가)~(마) 어디에 들어도 적는다.
- 터미널 요약(§8) 문구를 「Codex 자체 경로 n건 제외」에서 **「경로 감시 제외 n건(Codex 자체 a · 시스템 실행 파일 b · 존재하지 않는 경로 c)」**로 바꾼다(a·b·c 중 0인 항목은 생략). 리포트에는 여전히 적지 않는다.

- 기각: `/`로 시작하는 모든 비존재 문자열을 처음부터 후보에서 빼는 정규식 변경 — (마)와 같은 효과지만 「존재 검사」가 규칙으로 보이는 쪽이 리뷰어가 판단을 재현하기 쉽다. 경로 감시 코드화 — D24 승계(⑥ 트랙에서).

**AC**

- AC⑩-1. SKILL.md §5 경로 감시 항목에 제외 (라)(마)가 실재한다 — grep `Running command`·`/bin/bash`·`/usr/bin/`·`/usr/share/`·`/opt/homebrew/`·`-e `·「존재하지 않」·「잘린」(또는 `...`) 각 1건 이상 · `/etc/`가 「제외하지 않는다」 문맥에 있다 · 위키 루트 우선 문장이 (라)(마)를 포함하도록 갱신(「(가)~(마)」 또는 「제외 5종」) · 1.3.1 테스트 `report.test.mjs:849`의 「제외 3종」 단언은 「제외 5종」으로 갱신.
- AC⑩-2. SKILL.md §8 터미널 요약에 「경로 감시 제외 n건」 문구와 세 분류(Codex 자체·시스템 실행 파일·존재하지 않는 경로)가 실재한다(grep). §5 끝의 같은 문구도 함께 바뀐다.
- AC⑩-3. (9단계 실측) 1.3.2 설치본으로 코드 MR을 재실행한 터미널 요약에 「경로 감시 제외 n건(… 시스템 실행 파일 1 …)」이 있고 헤더에 「격리 위반 의심」이 없다.

### 3.⑪ 배포본 불일치 목록이 리포트 6군데에 반복되고 보완 문안에 같은 문장이 38회 나온다

**현상**: 불일치 38건이 날 때 리포트가 같은 경로 목록을 **6군데**에 썼다 — 실행 블록 안 3줄(「2. 검증 상태」 배포본 줄 · 「3. 통과해야 할 테스트」 머지 전 항목 · 「4. 차단 발견」 `M-deploy` 줄) · 「작성자 보완 요청 문안」 1항목 · 부록 A 목록 · 부록 D `M-deploy` 줄. 실행 블록 3줄은 각 2,700자 안팎(한 줄)이라 복사해 게시하면 댓글이 읽히지 않고, 보완 문안 1항목(890자)은 「배포 목록에 있으나 zip 에 없음」 19회 + 「zip 에 있으나 배포 목록에 없음」 19회를 ` / `로 이은 것이다.

**재현 근거**(리포트, 281줄): `missing_in_zip` 등장 줄 = 25·28·35(실행 블록, 길이 2,709·2,751·2,714자)·75~93(부록 A, 19줄)·280(부록 D, 2,755자) · 46행(보완 문안, 890자)에 같은 detail 문장 19+19회 · 부록 A 목록 38줄(`- missing_in_zip <경로>: …`·`- extra_in_zip <경로>: …`). 정책 실행 블록 40줄 상한(`BLOCK_MAX_LINES`)은 **줄 수**만 세서 긴 줄을 막지 못한다.

**원인**: `report.mjs:92` `machineEvidence()`가 `M-deploy.detail`에 모든 `mismatches`를 `kind(path)`로 이어 붙이고, 이 detail을 실행 블록(`:188` 머지 전 · `:198` 차단 발견)과 부록 D(`:379`)가 그대로 쓴다. `:186` 「2. 검증 상태」 줄은 같은 조립을 따로 한다. `:226` `supplementRequests()`는 `m.detail`(종류별 고정 문장)을 전부 ` / `로 잇는다. 전문 목록은 `:351` 부록 A에 이미 있다.

**수정 방향(D40 — 목록은 부록 A 한 곳, 본문은 요약 + 참조)**: `report.mjs`에 요약 함수 하나(`mismatchSummary(deploy)`)를 두고 `:92`·`:186`·`:226`이 그것을 쓴다(`:188`·`:198`·`:379`는 `:92`의 detail을 받으므로 자동).

- 요약 형식: `path`가 있는 종류(`missing_in_zip`·`extra_in_zip`·`bytes`·`bytes_unavailable`·`type`·`map_conflict`)는 **종류별 건수 + 앞 3개 경로 + 「외 n건」** — 예 `missing_in_zip 19건(src/main/java/com/example/acct/A.java, src/main/java/com/example/acct/B.java, src/main/java/com/example/acct/C.java 외 16건)`(경로는 D46대로 소스 경로·축약 없이, `건(` 사이에 공백 없음). `path:null`인 종류(`comment_sha`·`deleted_list`·`download`·`corrupt`)는 지금처럼 **종류 이름만**(건수 1이라 지금과 같은 글자 — 기존 테스트 `report.test.mjs:298`의 `배포본 불일치 — deleted_list` 불변). 종류 사이는 ` · `. 끝에 ` · 전체 목록 부록 A`를 `path` 있는 종류가 하나라도 있을 때만 붙인다 — **괄호 꼴 `(…)`로 끝내지 않는다**: 재리뷰 파서 `check.mjs:242` `APPENDIX_D_RE`가 제목 뒤 ` \([^()]*\) · 출처 `로 위치 칸을 찾으므로, 제목 끝의 ` (…)` 뒤에 바로 ` · 출처`가 오는 꼴을 만들면 제목이 잘린다(조회 사실 — 현행 `(-:-) · 출처`만 그 꼴이어야 한다). `n건(…)`은 `건` 뒤에 공백이 없어 그 패턴에 걸리지 않는다.
- `:92` `M-deploy.detail` = `배포본 <결과> — <요약>`. `:186` 배포본 줄 = `[실행] 배포본 zip 대조(스킬 직접 수행): <결과> — <요약>` + ⑨의 「바이트 대조 생략 n건(…)」. `:226` 보완 문안 = `배포본 대조 결과 「<결과>」 — <요약>. 최신 head 기준으로 zip·삭제 목록을 다시 만들어 주세요.`(종류별 고정 문장 반복 제거 — 경로 3개가 작성자에게 바로 보이고 나머지는 리뷰어가 부록 A에서 옮긴다).
- `:351` 부록 A는 **지금처럼 전문**(한 불일치 한 줄) + ⑨의 `bytes_skipped` 목록.
- 경로 3개 상한은 상수(`SUMMARY_PATHS = 3`). 실행 블록 축약 ①~④(`BLOCK_MAX_LINES`)는 바꾸지 않는다.

- 기각: 보완 문안에 경로 전문 — 정상 zip이 흔해지면(⑨) 불일치는 1~3건이라 앞 3개로 대부분 전문이 보이고, 많으면 부록 A가 있다. 실행 블록 줄 길이 상한 추가 — 요약으로 원인이 사라지므로 새 축약 단계를 두지 않는다.

**AC**

- AC⑪-1. `deploy.json` 픽스처 `missing_in_zip` 19 + `extra_in_zip` 19(소스 경로 `src/main/java/com/example/acct/C01.java`~`C19.java` 등) → render 결과에서 4번째 이후 경로(예 `C04.java`)가 나오는 줄은 **부록 A 안에만** 있다(절 제목으로 범위를 자르고 등장 횟수 1). 실행 블록·보완 문안·부록 D 줄에는 `missing_in_zip 19건(` · `외 16건` · `extra_in_zip 19건(` · ` · 전체 목록 부록 A`가 있고 각 줄 길이 < 400자. 부록 D의 `M-deploy` 줄을 `check.mjs` `parseAppendixD()`에 넣으면 `title`이 `배포본 불일치 — …`로 시작해 ` · 전체 목록 부록 A`로 끝난다(잘리지 않음).
- AC⑪-2. 보완 문안의 배포본 항목이 1개이고 「배포 목록에 있으나 zip 에 없음」 문장이 리포트 전체에서 부록 A의 19줄에만 있다(횟수 = 19).
- AC⑪-3. `deleted_list`(path null) 1건만 있는 기존 픽스처 — `report.test.mjs:298`의 `배포본 불일치 — deleted_list (-:-)` 단언 불변 · 요약 끝에 `(전체 목록 부록 A)` 없음.
- AC⑪-4. `machineEvidence` 단위: `bytes` 2건 + `comment_sha` 1건 → detail = `배포본 불일치 — comment_sha · bytes 2건(<p1>, <p2>) · 전체 목록 부록 A`(종류 순서 = `mismatches` 등장 순, 경로는 등장 순).
- AC⑪-5. 부록 A의 전문 목록(한 줄 한 불일치)은 기존 형식 그대로 — 기존 render 테스트 불변.

### 3.⑫ 두 모델의 의도 대조표(`intent`)를 criterion 문자열로 병합하면 행 문구가 달라 실패한다

**현상**: SKILL.md §6-5는 「`intent` = 두 결과를 행별로 합친다」고만 적고 §6-1 지문 규칙은 발견(`findings`)용이다. 메인은 `criterion` 문자열로 맞추려 했으나 Claude는 검증 표 행 원문(괄호 설명 포함)을, Codex는 **괄호를 뗀 축약 문구**를 써서 35행 중 일치 0건 → 메인이 **행 순서**로 병합했다. 또 Codex는 마지막 행(「대기: …」 — 수용기준이 아닌 보류 행)을 빼 34행이었다. 행 순서 병합은 빠진 행이 **가운데**면 이후 행이 전부 어긋난다.

**재현 근거**: `review-claude.json.intent` 35행(원문, 예 `M3 틀린 비밀번호 (200 {"result":9}, 탭 숨김 유지)`) · `review-codex.json.intent` 34행(축약, 예 `M3 틀린 비밀번호`) · 두 배열의 `criterion` 완전 일치 0건 · `findings.json.intent` 35행(순서 병합, 결과가 갈린 1행 = `UNKNOWN` — 규칙대로) · 두 모델 모두 `row`류 번호 없음(스키마에 없음).

**원인**: `SKILL.md:119` 공통 입력 5(「의도 대조표 입력 = MR 본문 「검증」 표의 행」)와 `:130` 출력 스키마 `intent`에 **행을 식별하는 키**가 없고, `:172` §6-5 병합 규칙이 「행별로」의 기준(문자열? 순서?)을 정하지 않았다. Codex는 비코드 입력을 팩 B의 MR 본문에서 직접 읽으므로(§5 「비코드 입력은 팩 B에서만」) 메인이 번호 붙인 행을 프롬프트에 넣을 수도 없다.

**수정 방향(D41 — SKILL.md 문구 보완, 코드 변경 없음)**

1. §5 공통 입력 5: 「의도 대조표 입력 = MR 본문 「검증」 절의 표 행. **행 번호 = 위에서부터 1부터 센 순서**(머리글·구분선 제외, 빈 행·주석 행 포함 — 검토자가 행을 거르지 않고 그대로 센다). 「검증」 표가 **둘 이상이면 문서 순서로 이어 센다**(1~n 연속, D50). 표가 아니라 **불릿 목록**이면 목록 항목이 행이다(들여쓴 하위 항목은 부모 행에 포함, D51). 프롬프트에는 **표(목록) 개수 k와 총 행 수 n**을 적는다(「검증 표 k개 · 총 n행(문서 순서로 이어 센다) — `row` 1~n 전부를 출력하라, 수용기준이 아닌 행(대기·메모)은 `result: UNKNOWN`으로」). k·n은 숫자라 팩 B 밖 입력 금지(D4·F5)에 걸리지 않는다. n·원문은 **메인이 `mr.json.description`을 읽어 센다**(D44 — `check.mjs`에 검증 표 파서가 없고 두지 않는다).」
2. §5 출력 스키마 `intent` 항목에 `"row": <표 순서 번호>`를 추가한다(`criterion`은 그대로 — 사람이 읽을 참고 문구).
3. §6-5 병합 규칙: 「`intent` = **`row` 번호 기준**으로 합친다. `criterion`은 메인이 `mr.json.description`의 검증 표에서 직접 읽은 원문 행(번호 순)으로 쓴다(검토자 문구는 쓰지 않는다 — 두 모델의 문구가 다르다). 둘 다 있는 번호: 결과가 다르면 `UNKNOWN`, `basis`는 「코드로 확인」이 하나라도 있으면 그것(기존). **한쪽에만 있는 번호**: 그 모델 값 그대로. `row`가 없는 결과(스키마 미준수)는 배열 순서를 번호로 쓰고 터미널 요약에 「intent 행 번호 누락(<모델>)」 1줄. 1~n 밖 번호·중복 번호는 그 항목을 버리고 같은 줄에 「행 번호 불일치(<모델>: <번호들>)」로 적는다. `findings.json.intent`에도 `row`를 넣는다(렌더는 `row` 순).」
4. `review-validate`(`report.mjs:33`)는 바꾸지 않는다 — `row`는 LLM 단계 병합 키이고 누락·범위 밖은 위 폴백으로 처리한다. `findings.json` 스키마의 `intent`에 `row`가 늘어나지만 `validateFindings`·`executionBlock`은 `intent`의 다른 키를 검사·사용하지 않으므로(`:181` `criterion`·`result`·`location`·`basis`만) 코드 영향이 없다.

- 기각: `criterion` 정규화 매칭(공백·괄호 제거) — Codex가 괄호를 뗀 수준이면 통하지만 어순·번역이 바뀌면 또 깨진다. 메인이 번호 붙인 행을 Codex 프롬프트에 넣기 — 검증 표 원문이 팩 B 밖에서 프롬프트에 들어간다(D4·F5 위반). `review-validate`에 `row` 필수 검사 — 한 모델의 스키마 미준수로 그 모델 전체를 무효화하기보다(F2 단일 모델 모드 전환) 폴백이 낫다.

**AC**

- AC⑫-1. SKILL.md §5 출력 스키마 블록의 `intent` 항목에 `"row"`가 있고, 공통 입력 5에 「행 번호」·「총 n행」(또는 「행 수」)·「이어 센다」·「목록」 문구가 실재한다(grep `"row"`·「행 번호」·「행」·「이어」·「목록 항목」 각 1건 이상).
- AC⑫-2. SKILL.md §6-5에 「`row` 번호 기준」 병합, `criterion` = 메인이 검증 표에서 읽은 원문, 한쪽에만 있는 번호 처리, `row` 누락 폴백(배열 순서), 범위 밖·중복 번호 처리 문장이 실재한다(grep 「한쪽에만」·「누락」·「중복」 각 1건 이상). §6-6 `findings.json` 예시 블록의 `intent`에도 `"row"`가 있다.
- AC⑫-3. (9단계 실측) 1.3.2 설치본으로 검증 표가 있는 MR을 재실행 → 두 `review-*.json.intent`에 `row`가 있고 `findings.json.intent`의 행 수 = 검증 표 행 수, 결과 병합이 `row`로 됐음을 터미널 요약·리포트 1절로 확인.

## 4. 영향 범위

| 대상 | 변경 |
|---|---|
| SC-2 어댑터 계약 | 선택 키 `projects.<이름>.deployLayout: "source"\|"maven-war"` 추가(기본 `source`). 다른 값 → `AdapterError`. 기존 키·형식 불변. **plan SC-2 문장 정정은 impl 트랙이 한다(1.3.1 D30 방식 — 「1.3.2에서 변경」 표기)**, 이 spec이 정본 |
| SC-3 `deploy.json` | `zip.layout` · `zip.bytes_skipped` 추가 · `mismatches.kind`에 `map_conflict` 추가 · `missing_in_zip.detail`에 기대 zip 경로 · `expected.*`는 소스 경로 그대로 — plan SC-3 정정도 impl 트랙 |
| `adapter.mjs` | `deployLayout` 검증·resolved 보존 |
| `deploy.mjs` | 매핑 표(`maven-war`)·`expectedZip` 사상·정규화(내부 클래스)·`bytes_skipped`·`map_conflict`·④ 정규화 비교 |
| `report.mjs` | `mismatchSummary()` + `:92`·`:186`·`:226` 적용 · 실행 블록·부록 A에 「바이트 대조 생략 n건」·부록 A 생략 목록 |
| SKILL.md | §5 공통 입력 5(행 번호·표 k개·총 n행·이어 세기·목록) · 출력 스키마 `intent.row` · 경로 감시 제외 (라)(마) + 우선 규칙 문구 · §6-5 병합 규칙 · §6-6 예시 `row` · §8 터미널 요약 「경로 감시 제외 n건(…)」 + 「배포본 대조 결과(바이트 대조 생략 n건)」 · §8 리포트 구성 문구(배포본 요약·부록 A 전문) |
| README 3종 | 1.3.2 한 줄(결함 4건) + mr-review 어댑터 안내에 `deployLayout` 1문장(WAR 배치 zip을 올리는 프로젝트는 `"maven-war"`) |
| plugin.json·marketplace.json | 1.3.1 → 1.3.2 |
| 어댑터 문서(프로젝트 쪽) | WAR 배치 프로젝트에 `deployLayout: "maven-war"` 1줄 추가(프로젝트 몫 — 없으면 지금과 같은 오탐이 계속된다) |
| 1.3.0 spec §5.2b | 「② zip 파일 목록 = 배포 목록」 문장을 impl 트랙이 「1.3.2에서 변경 — 레이아웃 매핑 뒤 비교, spec 2026-10-22 3.⑨」로 정정 |
| 1.3.1 spec D32·AC⑧-1 | 제외 3종 → 5종으로 늘어난 사실을 impl 트랙이 D32 행 끝에 「1.3.2 D39로 (라)(마) 추가」 부기(재론 아님) |

## 5. 검증 · 완료 조건

- 각 AC를 `tests/mr-review/*.test.mjs`에 **먼저 RED로** 추가한 뒤 구현으로 GREEN(TDD). 게이트 = SC-7 T1~T7(기존 테스트 전부 통과 · T6 식별자 패턴 0건 · T7 AI 서명 0건 · T5 `$N` 0건).
- 8단계 impl 적대검증(review-loop `--phase impl`)은 경량이어도 필수(dev-cycle 하한). 보안 크리티컬 여부는 호출자(메인)가 정한다 — 접촉면 = zip 해석·경로 사상(`..`·절대 경로가 매핑을 통해 새지 않는지)·경로 감시 제외 확대.
- 9단계: 1.3.2 릴리스 커밋·push(사용자 확인) → 설치본 갱신 → 어댑터에 `deployLayout: "maven-war"` 추가(프로젝트 몫) → 같은 코드 MR을 워크트리 모드로 재실행해 배포본 「일치」 + 「바이트 대조 생략 n건」 표시 · 리포트 본문 요약·부록 A 전문 · 터미널 요약 「경로 감시 제외 n건」 · `intent` `row` 병합을 확인(AC⑨-10·⑩-3·⑪·⑫-3의 실측).

## 6. 잔여 리스크 (DEFERRED · 실측) · 미해결 질문

**미해결 질문: 없음.** 설계 선택 4건(경로·범위·⑨ 매핑 위치·⑨ `.class` 격)과 harden-spec(2026-10-22, 이 세션)의 판단 갭 9건은 전부 질문으로 해소됐고 사용자가 유예한 갭은 없다 — **DEFERRED 0건**. 사실 갭 8건은 코드 조회로 닫았다(`collect.mjs:58` `mr.json.project.name` · `adapter.mjs` `validate()`가 모르는 키를 무시 → 1.3.1 설치본과 어댑터 호환 · `check.mjs:240-242` 재리뷰 파서는 id 키잉이라 요약 문구에 안전 · `check.mjs`에 검증 표 파서 없음 · 기존 deploy 테스트는 source zip · `$` 2단계 조회 · `.java` 외 소스는 명시 귀결 · `zip.layout` 총체성).

**검증 필요(실측 — repo 조회로도 사용자 결정으로도 닫히지 않는 외부 사실)**

- 어댑터에 `deployLayout: "maven-war"`를 넣은 뒤 실제 WAR 배치 zip이 「일치」로 끝나는지 — 9단계. 특히 작성자가 내부 클래스(`Foo$1.class`)를 zip에 포함하는 관행인지(포함하면 `bytes_skipped`에 잡히고, 빠지면 아무 표시 없음 — 둘 다 「일치」).
- (마) 존재 검사가 Windows(드라이브 문자 경로·`~` 부재·Git Bash의 `[ -e "C:\…" ]`)에서 같은 결과를 내는지 — 리뷰어 PC가 Windows일 때 1회 확인.
- companion 실행 로그가 긴 명령을 자르는 형식(`...`)이 버전마다 같은지 — (마)의 「잘린 후보」 판별이 그 형식에 의존한다. 9단계 실측 때 `codex.out`(cleanup 전)에서 1회 확인.

**수용된 한계(결정은 내려졌고 리스크만 기록)**

- ⑨ `.class`는 존재만 본다(D38): 작성자가 옛 빌드의 `.class`를 넣어도 이름이 같으면 통과한다. 표시(「바이트 대조 생략 n건」)로 리뷰어가 알되, 기계는 막지 못한다. 대안(빌드 재현)은 D3(테스트·빌드 미실행)에 어긋난다.
- ⑨ 파일 이름과 다른 공개 클래스·Maven 리소스 필터링은 불일치로 남는다 — 사람 판단.
- ⑨ 다중 모듈 Maven(하위 폴더 WAR)·`.java` 외 소스(Kotlin 등)는 매핑이 붙지 않아 지금과 같은 오탐이 난다(D45·비목표) — 요구가 생기면 프리셋 변종.
- ⑩ (라)의 시스템 디렉터리 목록은 고정 열거라 환경(nix·conda 등)에 따라 또 오탐이 날 수 있다 — 그때 목록을 늘린다(문구 변경). `/etc/`·`/opt/`(homebrew 외)·`/var/`는 의도적으로 후보에 남긴다(D48).
- ⑫ `row`는 검토자가 세는 번호라 머리글·구분선 처리 차이로 어긋날 수 있다 — 총 행 수 n을 프롬프트에 주고 범위 밖 번호를 터미널에 알리는 것으로 받아들인다.

## 재논의 금지(기결정)

사용자 결정(2026-10-22 19:5x~20:0x, 이 세션 질의 4건 — 전부 추천안 채택). 리뷰에서 다시 제안하지 않는다. 1.3.0 spec D1~D16 · 1.3.1 spec D17~D34는 전부 승계한다.

| D | 결정 | 근거 |
|---|---|---|
| D35 | 이 트랙 범위 = 결함 ⑨·⑩·⑪·⑫. ④·⑥·⑦·정책 질문은 비목표(1.3.1 비목표 승계) | 사용자 결정(이 세션 Q2 — 「넣지 않음」). ⑨가 설계 질문을 품고 있어 트랙을 작게 |
| D36 | 경로 = **경량**. 생략 = 4단계 spec 적대검증(review-loop spec)·5단계 plan·6단계 plan 적대검증(5 생략의 자동 귀결). 근거 = 결함 4건이 재현 근거·원인 줄까지 특정됐고 접촉 표면 무신호, 사용자 확인(수동 모드). 하한(spec·harden·impl 적대검증) 유지 | 사용자 결정(이 세션 Q1) — 1.3.1 D19 선례 |
| D37 | ⑨ 매핑 위치 = 어댑터 선택 키 `projects.<이름>.deployLayout: "source"\|"maven-war"`(기본 `source` = 현행), 매핑 표는 엔진 내장 프리셋. 매핑 표를 어댑터에 적는 방식·엔진 자동 양쪽 시도는 기각 | 사용자 결정(이 세션 Q3 — (A)). 프로젝트마다 zip 배치가 다르다(실측 2건) · SC-2 기존 키 불변 |
| D38 | ⑨ `.class`(컴파일 산출물) = **존재만 대조**, `zip.bytes_skipped`에 기록, `mismatches`·판정 입력에 넣지 않음, 실행 블록·부록 A에 「바이트 대조 생략 n건(컴파일 산출물 — 존재만 확인)」 표시. 내부 클래스(`$`)는 그 `.java`의 산출물로 인정. 「대조 불가」·새 결과값 「부분 일치」는 기각 | 사용자 결정(이 세션 Q4 — (A)). D3(빌드 미실행)·D9(결과 어휘 불변) |
| D39 | ⑩ 수정 위치 = SKILL.md §5 경로 감시 문구 — 제외 (라) 명령 실행기·시스템 실행 파일 디렉터리, (마) 존재하지 않는 경로. 위키 루트 우선 유지. 터미널 요약 문구 「경로 감시 제외 n건(…)」. 코드화하지 않는다 | 설계 결정(D24·D32 연장) — 실사용 잔존 후보 2건이 모두 이 두 종류 |
| D40 | ⑪ 불일치 목록 전문 = 부록 A 한 곳. 실행 블록 3줄·보완 문안·부록 D는 `mismatchSummary()`(종류별 건수 + 앞 3개 경로 + 「외 n건」 + 「(전체 목록 부록 A)」). `path:null` 종류는 이름만(기존 테스트 불변) | 설계 결정(트랙 입력 방향) — 40줄 상한이 줄 길이를 막지 못함 |
| D41 | ⑫ 병합 키 = `intent[].row`(검증 표 순서 번호, 검토자가 센다) · 프롬프트에 총 행 수 n · `criterion`은 메인이 `mr.json.description`에서 읽은 원문 · 한쪽만 있는 번호는 그 값 · `row` 누락은 배열 순서 폴백 · `review-validate` 불변 | 설계 결정 — Codex 비코드 입력은 팩 B에서만(D4·F5)이라 메인이 번호 붙인 행을 넣을 수 없음 |
| D42 | 이 세션(spec·harden)은 코드·테스트·SKILL.md·plan·README를 수정하지 않는다. plan SC-2·SC-3·1.3.0 §5.2b·1.3.1 D32 부기는 impl 트랙 몫 | 트랙 프롬프트 편집 범위(1.3.1 D25·D30 방식) |

harden-spec(2026-10-22 20:0x~20:1x, 이 세션)에서 확정 — 판단 갭 9건 전부 추천안 채택.

| D | 결정 | 근거 |
|---|---|---|
| D43 | ⑨ `src/main/java/` 아래 **`.java` 외 파일**은 `WEB-INF/classes/<rest>`로 사상해 바이트 대조(Java 폴더에 매퍼 XML 등을 두는 관행). `.java`만 `.class` 존재 대조 | 사용자 결정(갭 H-A, 단독) — 리소스 폴더로 설정된 프로젝트는 일치, 아니면 어차피 누락 1건이라 어느 쪽이든 사상이 오탐을 줄인다 |
| D44 | ⑫ 검증 표의 총 행 수 n·행 원문은 **메인(LLM)이 `mr.json.description`에서 센다**. `check.mjs`에 검증 표 파서를 두지 않는다(코드 변경 없음) | 사용자 결정(갭 H-E, 단독) — 표 모양이 프로젝트마다 달라 파싱 규칙을 어댑터 계약으로 올리지 않음. n은 범위 밖 번호 가드용 |
| D45 | ⑨ 매핑 접두는 **저장소 루트 고정**(`src/main/…`만). 다중 모듈(`web/src/main/…`)은 비목표 — 요구 시 모듈 경로를 받는 프리셋 변종 | 사용자 결정(갭 H-B) — 알려진 저장소 전부 루트 구조, `**/src/main/` 인정은 `map_conflict`·jar 모듈 기대 오류를 부른다 |
| D46 | ⑨⑪ 요약·보완 문안의 `missing_in_zip` 경로 표기 = **소스 경로**(MR 변경 파일과 대응). 기대 zip 경로는 부록 A의 `detail`에만 | 사용자 결정(갭 H-J) — 소스·WAR 배치 프로젝트에서 표기가 일관되고 SC-3 `path` 의미가 레이아웃에 따라 바뀌지 않음 |
| D47 | ⑨ 「바이트 대조 생략 n건」 표시 = 실행 블록 「2. 검증 상태」 + 부록 A + **§8 터미널 요약**. 리포트 헤더에는 넣지 않는다 | 사용자 결정(갭 H-C) — 헤더는 리뷰 자체 상태만, 매번 뜨는 헤더 줄은 무시된다 |
| D48 | ⑩ (라) 시스템 디렉터리 = 현행 목록 + `/usr/local/lib/`·`/usr/share/`·`/opt/homebrew/`(전체). `/etc/`·`/opt/`(기타)·`/var/`·`/usr/local/etc/`·홈 아래는 후보 유지 | 사용자 결정(갭 H-D) — 설정 파일이 들어갈 수 있는 곳은 열지 않는다(D16 ⓑ 유지) |
| D49 | ⑩ (마) **잘린 후보**(`...`·`…`·companion 자름)는 마지막 `/` 앞 디렉터리로 존재 검사 — 있으면 경로(제외 안 함). 검사는 `[ -e ]`만 | 사용자 결정(갭 H-K) — 제외 규칙이 진짜 바깥 읽기를 「비경로」로 삼키지 않게 |
| D50 | ⑫ 「검증」 표가 둘 이상이면 **문서 순서로 이어 센다**(1~n 연속). 프롬프트에 「표 k개 · 총 n행」 | 사용자 결정(갭 H-F) — 2차 실사용 선례(32+3=35행) |
| D51 | ⑫ 검증이 **불릿 목록**이면 목록 항목이 행(들여쓴 하위 항목은 부모 행에 포함) | 사용자 결정(갭 H-G) — 작성 형식이 달라도 의도 대조표가 나온다 |

## 적대검증 ledger (impl)

보안 크리티컬: yes (호출자 지정 — 사용자 확정 2026-10-22 20:44) — 접촉면 zip 해석·경로 사상(소스↔WAR 매핑)·경로 감시 제외 확대·리포트 요약(마스킹 경계)

- 루프: base `c3b946a`(c3b946af90faa984157ad9303b6cd804cc7c75cf = 1.3.1 릴리스 = origin/main, 호출자 지정 — SC-7 `<base>`) · branch `gguii74-rwk/mr-review-1-3-2-fixes`(오르카 워크트리) · 착수 HEAD `60d8990` · 예산 max 5 · confirm 2 · auto 1 · **위임 모드**(`DEV_WORKFLOW_MODE=delegated`) · 입도 = 통합 1회(경량 D36 — plan 없음, ledger = 이 spec 말미).
- 사전 게이트(SC-7, HEAD `60d8990`): T1 182/182 · T2 0 · T3 56/56 · T4 0 · T5 0 · T6 0(skills·tests 0 · README·docs 추가 줄 0) · T7 0 · 대장 대기 0건 승계 · codex companion 1.0.6.
- 승계 기결정(focus 전문): D1~D51 · 비목표·수용된 한계(§2·§6) · impl 트랙 자동 보안 리뷰 (가) maven-war 비매핑 소스 경로 그대로 통과·④ zip 경로 꼴 수용(D45·§3.⑨-2·④) (나) 내부 클래스 `Foo$<무엇이든>.class` 인정(D38·AC⑨-4) = 설계 동작(트랙 프롬프트 — 재론 금지) · 빌더 결정 3건(.class CRC 판독 · detail 「(기대 경로 …)」 조건 · 요약 꼬리 「 · 전체 목록 부록 A」) = 판단 재론 없음, 결함만 finding.

| R | fingerprint | severity | disposition | 근거 · 커밋 |
|---|---|---|---|---|
| R1 | R1-1 `deploy.mjs` ④ 삭제 목록 정규화가 `$` 든 `.class` 전부를 바깥 클래스로 줄여 서로 다른 파일을 합침(`$` 리소스 삭제 ↔ 다른 `$` 파일 · `Foo$Bar.java` 삭제 ↔ `Foo.class`가 「일치」) | high | FIXED `9e1f0d7` | 기대 쪽은 매핑만(고유 이름 보존), 본문은 이름 그대로 먼저 → 없을 때만 **삭제한 `.java` 산출물**의 바깥 클래스로(② 2단계 조회와 같은 방식). §3.⑨-3 ④ 「`.class` 내부 클래스 접미 제거」를 이 2단계로 구체화 — D38(내부 클래스 인정)·AC⑨-7 불변. 테스트 `deploy.test.mjs` 「R1-1」 |
| R1 | R1-2 `SKILL.md` §5 경로 감시 제외가 `.`·`..` 성분을 처리하지 않아 `/usr/share/../../etc/passwd`가 (라)로 빠짐 | medium | FIXED `edbd0b9` | `.`·`..` 성분 후보는 제외 5종 어디에도 넣지 않고 그대로 적는다 — D48 「`/etc/` 제외하지 않는다」 경계 구현(D 변경 아님). 테스트 `report.test.mjs` 「R1-2」 |
| R1 | (커밋 훅 자동 보안 리뷰, `9e1f0d7` 대상) 본문의 `Foo$1.class`가 실제로는 별도 리소스 파일이어도 삭제한 `Foo.java`의 내부 클래스로 흡수됨 | medium | DUPLICATE [루프 판정] | D38(내부 클래스 `Foo$<무엇이든>.class` = `Foo.java` 산출물)·impl 트랙 (나)와 같은 설계 동작. `9e1f0d7`이 흡수 범위를 「삭제한 `.java`가 있을 때만」으로 이미 좁힘 — **확인 임무 ③ 우선 감사 대상** |

- score 이력(전환용 = 미확인 FIXED 큐 제외 산식): R1 **4**(high 1 + medium 1, 수정 전 스냅샷).
- 미확인 FIXED 큐: R1-1(`9e1f0d7`) · R1-2(`edbd0b9`).
- R1 뒤 게이트(SC-7, HEAD `edbd0b9`): T1 184/184 · T2 0 · T3 56/56 · T4~T7 0.

## 확인 대기 대장

| # | 일시 | phase·지점 | 질문 요지(쉬운 말 1줄) | 채택 선택지 | 출처 | 상태 |
|---|---|---|---|---|---|---|
| (없음 — 수동 모드, 질문 4건은 사용자가 직접 답함) | | | | | | |
