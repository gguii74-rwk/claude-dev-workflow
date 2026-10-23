# mr-review 1.3.3 — 3차 실사용에서 드러난 엔진 결함 3건 + 1.3.2 보안 지적 1건 수정 (+ 경로 감시 한계 문구)

> 상태: **릴리스 1.3.3 커밋 `2013e1e`(미push)**(2026-10-23 14:0x — 9 릴리스 위임 트랙 · 게이트 ①②③ 통과 · README 1.3.3 줄 64 단계 상한 보강 `e8fe95e`) — 다음 = main 머지·push(메인) → 설치 갱신 → 실측(§5) · 이전: **review-loop(impl) 종결(성공 종료)**(2026-10-23 11:2x — 8 review-loop(impl) 위임 트랙, 보안 크리티컬 yes · 적대 5 + 확인 1 · FIXED 6 전부 소멸 확인 · ACCEPTED 3 · 최종 verdict pass(C1) · 마지막 코드 커밋 `b78682d` · 추천 자동 채택(위임) 7건 = 대장 #15~#21 확인 대기 · ledger = 말미 `## 적대검증 ledger (impl)` · 다음 = 9 릴리스) · 이전: **impl 완료(코드 HEAD `5305feb`)**(2026-10-23 10:1x — 7 impl 위임 트랙 · fix 커밋 8 + docs 정정 1 · AC 33 ↔ 테스트 GREEN · SC-7 T1 221/221 · T3 56/56 · T2·T4~T7 0 · 다음 = 8 review-loop(impl, 보안 yes)) · 이전: **review-loop(spec) 종결(성공 종료)**(2026-10-23 09:4x — 4 review-loop(spec) 위임 트랙, 보안 크리티컬 yes · 적대 5 + 복귀 1 · 확인 3 · FIXED 13 전부 소멸 확인 · 최종 verdict pass(C3) · 추천 자동 채택(위임) 14건 = 대장 #1~#14 확인 대기 · ledger = 말미 `## 적대검증 ledger (spec)`) · 이전: spec 확정·harden 완료(08:2x, 설계 질의 9 + 판단 갭 5 = 사용자 지시로 메인이 추천안 입력) · 작성 2026-10-23 · 버전 **1.3.3 패치** · 다음 = 7 impl → 8 review-loop(impl, 보안 yes) → 9 릴리스
> 선행: 1.3.0 spec `docs/specs/2026-10-21-mr-review-skill-design.md`(D1~D16 승계) · 1.3.1 spec `docs/specs/2026-10-22-mr-review-1-3-1-fixes.md`(D17~D34 승계 — 특히 D22 diff-only 바이트 대조·D23 cleanup 허용 목록·D32 경로 감시 제외·D34 배포본 결과 우선순위) · **1.3.2 spec `docs/specs/2026-10-22-mr-review-1-3-2-fixes.md`**(D35~D51 승계 — ⑬ 은 D37(deployLayout)·D38(`.class` 존재 대조)·3.⑨-3 ②③④ 절차·ledger(impl) R1-1·R2-1·R2-2·R3-1·R4-1·R4-2·R5-1·R5-2 위에 얹힌다. **D37 은 이 spec 의 D59 로 의미가 바뀐다**) · plan `docs/plans/2026-10-21-mr-review-skill.md`(SC-2 어댑터 계약·SC-3 `deploy.json` 계약·SC-7 게이트)
> 경로: **경량 — 단 4단계(spec 적대검증)는 유지, 5 plan·6 plan 적대검증 생략**(dev-cycle 1차 판정 + 사용자 지시로 메인이 추천안 입력 2026-10-23 08:1x — 접촉 표면 무신호: 스키마·마이그레이션·권한·인증·외부 연동 신설 없음, 도구는 읽기 전용이라 데이터 손상·비가역 없음. ⑬ 은 「zip 마다 배치를 정하는 규칙」이 새로 생겨 설계 폭이 크므로 spec 적대검증만 남긴다 — D53)

## 1. 배경 · 목표

1.3.2 설치본으로 2차 실사용과 **같은 코드 MR 을 워크트리 모드로 재실행**하고(2026-10-23 07:3x — 3차 실사용) **최근 머지된 MR 의 배포 zip 4개를 표본 조사**했다. 1.3.2 가 고친 ⑨(WAR 매핑 — 「일치 · 바이트 대조 생략 4건」)·⑩(경로 감시 제외 2건)·⑪(부록 A 단일 목록)·⑫(`row` 병합 34행)는 해소가 확인됐고, 새로 엔진 결함 후보 4건(⑬~⑯)이 드러났다. 여기에 1.3.2 push 뒤 자동 보안 리뷰가 지적한 `normBody` 결함 1건(S1)을 사용자 결정(2026-10-22 「실측 뒤 묶어서」)대로 이번에 넣는다. 번호는 실사용 기록(⑬~⑯)을 그대로 쓴다. 우선순위 = ⑬(정상 zip 이 MR 마다 「불일치」 수십 건 → `M-deploy` 차단 — 프로젝트 고정값으로는 한 프로젝트만 맞는다) > S1(살아 있는 파일 삭제 지시가 「일치」) > ⑭(리포트 1절 표 깨짐) > ⑯(마스킹 안 된 원문 잔존) > ⑮(한계 문구).

**목표**

- G1. 같은 프로젝트에서 소스 배치 zip·WAR 배치 zip·최상위 폴더 접두가 붙은 zip·zip 2개(소스판 + class 판)가 올라와도 정상 배포본은 **어댑터 변경 없이** 「일치」로 판정된다(⑬).
- G2. 판별 근거(표지·시험·어댑터 힌트·기본값)와 뗀 접두·zip 별 배치가 `deploy.json`·부록 A·터미널 요약에 보인다 — 리뷰어가 「엔진이 무엇을 보고 그렇게 읽었나」를 재현할 수 있다(⑬).
- G3. 본문 삭제 목록의 `Foo$X.class` 를 내부 클래스로 접기 전에 그 이름이 head 에 실제 파일로 살아 있는지 확인한다. 확인할 수 없으면(diff-only) 접지 않고 「대조 불가」(S1).
- G4. 검증 표 행 원문에 `|`·줄바꿈이 있어도 리포트 「1. 의도 대조표」·부록 A 검사표가 깨지지 않는다(⑭).
- G5. Claude 검토자가 작업 디렉터리 `W` 밖에 쓴 파일이 있으면 종료 자가 점검에서 그 건수가 보고된다(이름은 출력하지 않고 지우지도 않는다 — 사람이 직접 확인 · review-loop(spec) R6-2)(⑯).
- G6. companion 실행 로그가 명령을 자르는 한계가 SKILL.md 와 터미널 요약에 명시된다(⑮ — 문구만).

## 2. 범위 · 비목표

**범위**(impl 트랙이 고친다 — 이 세션은 spec 만, D62): `dev-workflow/skills/mr-review/scripts/lib/{adapter,deploy,report}.mjs` · `dev-workflow/skills/mr-review/scripts/lib/pack.mjs`(마스킹 입구의 줄바꿈 통일 한 줄만 — review-loop(spec) C2-N1, 추천 자동 채택(위임)) · `tests/mr-review/pack.test.mjs`(그 AC) · `dev-workflow/skills/mr-review/SKILL.md`(§5 Claude 검토자 프롬프트·경로 감시 한계 · §6-5 `criterion` 첫 칸 · §8 터미널 요약·자가 점검·리포트 구성 문구) · `tests/mr-review/{adapter,deploy,report}.test.mjs` · `dev-workflow/.claude-plugin/plugin.json`·`.claude-plugin/marketplace.json` 버전 1.3.3 · README 3종의 1.3.3 한 줄 + 어댑터 안내의 `deployLayout` 문장 정정(「고정」 → 「판별 못 할 때의 기본값」) · plan SC-2(`deployLayout` 의미)·SC-3(`deploy.json` 필드·`mismatches.kind`) 문장 정정(1.3.2 와 같은 방식 — impl 트랙이 「1.3.3에서 변경」 표기) · 1.3.2 spec D37 행 끝 부기(「1.3.3 D59 로 의미 변경」). 어댑터 계약(SC-2)의 **기존 키·값·형식은 바꾸지 않는다** — `deployLayout` 의 의미만 바뀐다(D59).

**비목표(이 트랙에서 하지 않는다)** — 사용자 결정 2026-10-23(D52)

- **실행 간 재현율 편차**(같은 입력인데 어제 찾은 실결함 2건을 이번엔 두 모델 모두 놓침) — 운영 한계. §6 잔여 리스크 1줄.
- **⑮ 의 엔진 보완**(Codex 세션 원본 로그를 읽어 명령 전문을 감시) — D32(Codex 홈은 감시 대상 아님)·cleanup 범위와 얽혀 별도 트랙 후보(§6). 이번엔 문구만(D54).
- 1.3.2 D38 재론(내부 클래스 `Foo$<무엇이든>.class` 를 존재 대조로 인정) — 자동 보안 리뷰 지적 ①은 설계 결정이라 재론하지 않는다. ⑬ 설계는 이 판단에 닿지 않는다(내부 클래스 인정 규칙은 zip 별 배치가 WAR 일 때 그대로 적용).
- cleanup 범위를 scratchpad 루트까지 넓히는 것 — 루트에 사용자 파일(어댑터 사본 등)이 있어 기각(D55).
- Maven WAR 외 배치 프리셋(Gradle·fat jar)·다중 모듈·`.java` 외 소스·리소스 필터링 — 1.3.2 비목표 승계. ⑬ 의 자동 판별은 **`source`·`maven-war` 두 배치 사이**에서만 고른다.
- `expected.deleted` 와 head 의 **같은 이름 리소스**(`src/main/resources/p/Foo.class` 같은 극단 케이스)의 충돌 — 배포 도구 몫, 기록만(§6).
- master 어댑터(프로젝트 문서)에 무엇을 적을지 — 프로젝트 몫. 1.3.3 뒤에는 WAR 프로젝트도 키 없이 동작한다(힌트는 삭제 전용 MR 에만 영향).
- 1.3.0·1.3.1·1.3.2 설계 결정 D1~D51 의 재론(D37 만 D59 로 변경 — 명시).

## 3. 결함별 명세

예시는 전부 가상 값이다(프로젝트 `alpha` = WAR 관행 + 소스 zip 혼용 · `gamma` = zip 2개 관행 · MR `!61`·`!62`·`!63` · head `d4d4d4d` · 패키지 `com/example/acct` · 접두 `app/`). 재현 근거의 사실은 3차 실사용 산출물(`deploy.json`·`findings.json`·리포트)·표본 zip 4개의 배치 서술(사용자 세션 보고 — zip 실물은 남아 있지 않다)·companion 1.0.6 원문을 **읽기 전용**으로 확인한 것이며, 리뷰 대상 프로젝트 식별자는 전부 치환했다(D10·SC-7 T6).

### 3.⑬ 배포 zip 의 배치가 프로젝트가 아니라 MR 마다 달라 프로젝트 고정값(`deployLayout`)으로는 정상 zip 이 「불일치」

**현상**: 1.3.2 는 어댑터 `projects.<이름>.deployLayout` 을 프로젝트별로 고정한다(D37). 표본 4개 — (가) `alpha` MR `!61` zip = 최상위 폴더 `app/` 아래 WAR 배치(`app/WEB-INF/classes/com/example/acct/Foo.class`·`app/WEB-INF/classes/com/example/acct/Foo$1.class`·`app/html/a.html` — 내부 클래스 포함) (나) 같은 `alpha` 의 MR `!62` zip = 소스 경로 그대로(`src/main/java/com/example/acct/Foo.java`) (다) `gamma` MR `!63` = 첨부 zip **2개**(소스판 `src/main/…` + class 판 `WEB-INF/classes/…`) (라) 2차 실사용 프로젝트 = WAR 배치, 접두 없음. `alpha` 를 `"maven-war"` 로 고정하면 (나)가, `"source"` 로 두면 (가)가 수십 건 `missing_in_zip`+`extra_in_zip` 으로 「불일치」 → `M-deploy` 차단 증거. (가)는 접두 `app/` 때문에 어느 고정값으로도 안 맞고, (다)는 `deploy.mjs:300-301` 이 **마지막 본문 zip 하나만** 보므로 다른 한쪽이 통째로 누락으로 보인다.

**재현 근거**: 3차 실사용 `deploy.json`(2차 실사용 프로젝트, 임시 어댑터 사본에 `"maven-war"`) = `zip.layout = "maven-war"` · `result = "일치"` · `bytes_skipped` 4건 · `mismatches = []` · `check.json.attachments` = zip 1건(`where: body`) — 1.3.2 매핑 자체는 맞다. 표본 (가)(나)(다)의 배치는 사용자 세션이 zip 을 받아 본 서술이며 실물 파일은 남아 있지 않다(실측은 9단계). 코드: `deploy.mjs:286` `layout = adapter.resolved.projects[<이름>].deployLayout || 'source'`(프로젝트 고정) · `:300-301` `zips.filter(where==='body').pop() || zips.pop()`(zip 1개) · `:330-345` 사상·조회가 `layout` 하나를 전제.

**원인**: 1.3.2 설계가 「zip 배치 = 프로젝트의 관행」을 전제했다(D37 근거 「프로젝트마다 zip 배치가 다르다(실측 2건)」). 표본 4개로 그 전제가 깨졌다 — 배치는 **작성자·MR 마다** 다르고, 접두 폴더와 zip 개수도 변한다. 어댑터 키를 「힌트」로 낮추고 zip 마다 판별하는 수밖에 없다.

**수정 방향(사용자 결정 2026-10-23 — D57·D58·D59·D60)**

1. **단위 = zip 하나.** 본문(`where: body`) 첨부 zip **전부**가 대상이다(D60). 본문에 zip 이 없으면 댓글 zip 중 마지막 1개(현행). 같은 링크(`secret` 동일)가 본문에 두 번 나오면 한 개로 센다(`check.json.attachments` 는 그대로 — `deploy` 가 중복을 뺀다). 저장 = zip 이 **2개 이상이면** `W/zip/<순번>-<파일명>`(순번 = 본문 등장 순 1부터 — 같은 파일명 zip 둘을 덮어쓰지 않게), **1개면 지금처럼** `W/zip/<파일명>`(AC⑬-11 기존 테스트 불변 — review-loop(impl) I-1, 추천 자동 채택(위임)). `uploadName` 검사는 그대로. `mismatches.detail`·부록 A 의 zip 식별 표기 = `zip#<순번> <파일명>`(zip 1개면 지금처럼 파일명만). 각 zip 을 받아 `readZip`(기존 구조 검증 전부 그대로) → 아래 2·3 을 zip 마다 독립 수행 → 4 에서 합산.
2. **공통 최상위 폴더 접두 제거(D57)**: 래퍼 폴더 항목(이름이 정확히 `P/` 인 폴더 항목) 외의 **모든 항목(폴더 항목 포함 — R2-2)** 이 `P/` 아래이고 그중 파일 항목이 1개 이상이며, `P` 가 `src`·`WEB-INF`·`META-INF` 가 아니고, 기대 배포 목록의 어느 경로도(소스 경로 그대로·`maven-war` 로 사상한 경로 둘 다) `P/` 로 시작하지 않으면 래퍼 폴더 항목 `P/` 는 **버리고**(빈 이름이 남지 않는다) 나머지 전 항목에서 `P/` 를 떼어 `zips[i].prefix` 에 이어 붙인다(`app/` · 반복해서 `app/build/` — 반복마다 같은 조건). 조건이 깨지면 멈춘다 — 접두 밖 항목이 하나라도 있으면(빈 폴더 `other/` 포함) 떼지 않아 불일치로 보인다(조용히 받지 않는다). **뗄 때마다(반복 한 번마다, 다음 반복 전에) 남은 이름 전부에 `notCanonical` 을 다시 적용**한다(R3-1 — `app/C:/WEB-INF/…` 는 `readZip` 의 이름 전체 검사를 통과하지만 `app/` 을 떼면 드라이브 접두 `C:/` 가 맨 앞에 드러난다. 최종 이름만 보면 다음 반복이 `C:/` 까지 떼어 흔적이 사라진다). 하나라도 걸리면 그 zip 은 `{kind:"corrupt", path:null, detail:"zip <이름>: 접두 <뗀 접두> 를 떼자 정규형이 아닌 이름이 드러남(절대·드라이브 접두·역슬래시·빈 조각·./..): <이름>"}` → 그 zip 은 ②③ 대조를 하지 않고 **「대조 불가」**(`readZip` 거부와 같은 처리). 빈 이름이 될 수 있는 래퍼 폴더 항목은 검사 전에 버린다. 접두 제거는 **판별(3)보다 먼저**다. 파일 항목이 0개면 접두 없음. 버린 래퍼 폴더 항목은 `entries` 에 남기지 않는다. **경로 깊이 상한(review-loop(impl) R4-1)**: zip 항목 이름이 **64 조각**을 넘으면 `readZip` 이 거부한다(그 zip `corrupt` — 「대조 불가」). 경로 깊이에 비례하는 검사(zip 안 경로 충돌·접두 제거·zip 사이 충돌)의 계산량을 묶는다. 접두 제거는 이름을 한 번만 조각으로 나눠 계산한다(동작 불변).
3. **배치 판별(D57 — 표지 우선, 시험은 보조)**: 접두를 뗀 **파일 항목**(폴더 항목 제외)의 첫 조각으로 두 표지를 본다 — WAR 표지 = `WEB-INF` **또는 `META-INF`**(D64 — WAR 의 `META-INF/context.xml` 류만 든 zip 도 표지로 잡힌다. 소스 루트에 `META-INF/` 를 두는 프로젝트는 §6 한계) 가 첫 조각인 항목 존재 · 소스 표지 = `src` 가 첫 조각인 항목 존재.
   - 한쪽만 → 그 배치, `layout_source = "signature"`.
   - **둘 다** → 혼합: `{kind:"layout_ambiguous", path:null, detail:"zip <이름>: WAR 표지(WEB-INF/·META-INF/)와 소스 표지(src/)가 함께 있음 — 배치를 정할 수 없음"}` → 그 zip 은 ②③ 대조를 하지 않고(항목은 `entries` 에 남긴다) 결과 **「대조 불가」**(D58 — D34 우선순위 「대조 불가 > 불일치 > 일치」 유지).
   - **둘 다 없음**(웹 자원만 든 zip `html/a.html`·`sql/x.sql` 만 든 zip 등) → **기대 목록 시험**: `source`·`maven-war` 각각으로 1.3.2 ② 목록 대조(`missing_in_zip`+`extra_in_zip`, 내부 클래스 2단계 조회 포함)를 계산해 **불일치 0 인 배치가 정확히 하나면 그것**(`"probe"`). 둘 다 0 이면(두 배치에서 사상이 같은 경로만 — `sql/**` 등) `source`(`"probe"`, 결과 동일). 둘 다 0 이 아니면 **어댑터 힌트** `deployLayout`(`"adapter"`), 키가 없으면 `source`(`"default"`) — 그 배치로 ②③ 을 대조해 `missing`/`extra` 목록을 내고 「불일치」로 끝낸다(D58 — 빠진 경로가 작성자에게 보이도록, 「대조 불가」가 아니다).
   - 시험은 **표지가 없을 때만** 돈다 — 표지가 있는 zip 은 기대 목록과 무관하게 배치가 정해진다(1.3.2 가 기각한 (C) 「둘 중 하나 맞으면 통과」와 다르다: 섞인 zip 은 혼합으로 거부되고, 표지 있는 zip 은 한 배치로만 대조된다).
4. **합산(D60)**: zip 별 ②③ 결과를 다음 규칙으로 합친다.
   - 기대 배포 경로 `x` 는 **어느 zip 에서든** 사상 경로가 있으면 충족. `missing_in_zip` = 모든 zip 에서 없는 `x`(`path` = 소스 경로, `detail` 에 zip 별 기대 경로 — 배치가 다르면 둘 다). `extra_in_zip` = 각 zip 에서 그 zip 의 배치로 조회(이름 그대로 → 내부 클래스 2단계)가 안 되는 항목(`path` = zip 경로(접두 뗀 뒤), zip 이 둘 이상이면 `detail` 에 zip 이름).
   - 바이트 대조(`compare: "bytes"`)는 zip 마다 head 원문과 한다(워크트리 `git show` / diff-only `W/blobs/head/`) — 어느 zip 에서든 다르면 `bytes`(`detail` 에 zip 이름). **같은 zip 경로**(접두 뗀 뒤)가 두 zip 에 있고 **바이트가 다르면** `{kind:"zip_conflict", path:<zip 경로>, detail:"zip#1 a.zip 와 zip#2 b.zip 의 같은 경로 내용이 다름 — 어느 쪽이 배포될지 정할 수 없음"}` → **「대조 불가」**. 같으면 한 번만 대조한다. **이 규칙은 존재 대조 항목(`.class`)에도 적용한다**(D66 — 한 MR 의 두 zip 이 같은 클래스를 다르게 담았으면 빌드가 어긋난 신호. head 와의 바이트 대조 생략(D38)은 그대로이고 zip 끼리만 비교한다). **서로 다른 배치**로 같은 원본을 담은 항목(소스판 `src/main/webapp/html/a.html` ↔ WAR 판 `html/a.html`)은 zip 경로가 달라 이 규칙에 걸리지 않고 **head 비교에 맡긴다**(D65) — 틀린 쪽만 `bytes` 불일치(둘 다 틀리면 2건), 둘 다 head 와 같으면 충돌이 아니다.
   - **합산 경로 충돌(R1-2)**: 접두 뗀 전 zip 항목(폴더 항목 포함)을 한 집합으로 보고 `readZip` 의 경로 충돌 검사 두 가지를 **zip 사이에도** 적용한다 — 키 = 끝 `/` 를 뗀 이름의 소문자. (가) 서로 다른 zip 의 두 항목이 같은 키인데 **둘 다 폴더 항목**이 아니고 **이름이 정확히 같은 파일 항목 둘**도 아니면(대소문자만 다름 `html/A.html`↔`html/a.html` · 파일↔폴더 `config`↔`config/`) 충돌. 이름이 정확히 같은 파일 항목은 위의 같은 경로 규칙(같은 바이트 = 한 번 대조 · 다른 바이트 = `zip_conflict`), 같은 폴더 항목끼리는 충돌 아님. (나) 한 zip 의 **파일** 키가 다른 zip 항목 키의 상위 조각이면(`WEB-INF/classes/config` 파일 ↔ `WEB-INF/classes/config/app.properties`) 충돌. 충돌은 `{kind:"zip_conflict", path:<하위·뒤 항목의 zip 경로>, detail:"zip#1 a.zip 의 <경로> 와 zip#2 b.zip 의 <경로> 가 풀 때 충돌(대소문자·파일/폴더) — 함께 배포할 수 없음"}` → **「대조 불가」**. 충돌은 **경로(키)마다 대표 1건**만 기록한다(zip 쌍마다 쌓지 않는다 — review-loop(impl) R3-1). zip 하나 안의 충돌은 지금처럼 `readZip` 이 `corrupt` 로 거부한다(접두 제거는 모든 항목에서 같은 접두를 떼므로 zip 안 충돌 관계를 바꾸지 않는다).
   - `bytes_skipped` = 존재 대조(`compare: "exists"`)한 zip 항목 중 **그 소스 경로가 어느 zip 에서도 바이트 대조되지 않은 것**(D60 — 소스판에서 `Foo.java` 를 바이트 대조했으면 class 판의 `Foo.class`·`Foo$1.class` 는 생략 목록에 남기지 않는다. 바이트 대조가 존재 대조보다 센 증거). 존재 대조 항목의 판독(CRC)·유형 검사(AC⑨-9)는 그대로.
   - `download`·`corrupt` 는 **zip 마다**(`detail` 에 zip 이름). **주석 SHA(①)는 「최소 한 zip」 규칙(D63)**: zip 이 둘 이상이면 주석이 head 와 일치하는 zip 이 **하나라도** 있으면 통과하고, 주석이 **있는데 다른** zip 은 지금처럼 `comment_sha` 불일치(낡은 zip — `detail` 에 zip 이름·그 주석), 주석이 **없는** zip 은 불일치가 아니라 `zips[i].comment_sha = null` + 부록 A zip 줄 「주석 없음」 표시만(class 판은 손으로 묶어 주석이 없는 관행). 모든 zip 에 주석이 없거나 일치하는 zip 이 하나도 없으면 `comment_sha` 불일치 1건(`detail` 에 zip 별 주석 상태). **zip 이 1개면 현행 그대로**(주석 없음 = 불일치).
   - ④ 삭제 목록의 정규화 배치 `L4` = 합산 zip 의 배치 중 **하나라도 `maven-war` 면 `maven-war`**(WAR 꼴·소스 꼴 표기를 모두 수용 — `zipPathFor('maven-war')` 는 소스 접두가 없는 경로를 그대로 두므로 둘 다 같은 꼴이 된다) · 전부 `source` 면 `source`(현행) · **zip 이 없으면(삭제 전용 MR·zip 누락·혼합뿐) 어댑터 힌트, 없으면 `source`**(D59). R3-1 「삭제 경로가 zip 에도 있음」 검사는 합산 `entries` 로.
5. **어댑터 키(D59 — D37 변경)**: `projects.<이름>.deployLayout: "source"|"maven-war"` 는 **값·형식·검증(`AdapterError`) 그대로**, 의미만 「판별 못 할 때의 기본값(힌트)」 — 3 의 시험 폴백과 4 의 ④ zip 없음 폴백에만 쓴다. 키가 있어도 zip 에 표지가 있으면 **표지가 이긴다**. 기존 어댑터는 무변경·무영향(키 있는 프로젝트는 폴백 때 그 값, 없는 프로젝트는 `source`).
6. **`deploy.json`(SC-3)**: `zip` 은 **합산 요약**으로 유지(기존 소비자 불변 — `report.mjs:365`·`:93`): `attachment` = zip 이름을 `, ` 로 이은 문자열(1개면 지금과 같다) · `downloaded` = 전부 받았을 때 `true` · `comment_sha` = head 와 일치하는 주석이 있으면 그 값, 없으면(전부 없음·전부 다름) `null`(zip 1개면 현행 — 그 zip 의 주석 원문) · `entries` = 접두 뗀 **파일** 항목의 합집합(정렬·중복 제거 — 폴더 항목은 1.3.2 계약대로 넣지 않는다, review-loop(impl) I-2) · `bytes_source` 그대로 · `layout` = 모든 zip 이 같으면 그 값, 다르면 `"mixed"`, **zip 이 없으면 힌트값**(`해당 없음`·제외·삭제 전용·zip 누락에도 항상 기록 — AC⑨-12 의 「항상」 유지, 값의 뜻만 「힌트」로) · **`layout_source`** `"signature"|"probe"|"adapter"|"default"|"mixed"`(zip 없음 = `adapter`|`default`) · **`prefix`** = 1개면 그 값(`""` 가능), 여럿이면 `null`, zip 없으면 `null` · `bytes_skipped` 합집합. 새 배열 **`zips: [{ attachment, downloaded, comment_sha, entries, layout, layout_source, prefix, bytes_skipped }]`**(zip 별 상세, zip 없으면 `[]`). `mismatches.kind` 에 **`layout_ambiguous`**(`path:null`)·**`zip_conflict`**(`path` = zip 경로) 추가 — 둘 다 「대조 불가」군. `expected.*`·`bodyDeletedList` 불변.
7. **표시**(`report.mjs` + SKILL §8 — D47 정신: 헤더에는 넣지 않는다): (가) 부록 A 의 zip 줄을 zip 마다 한 줄 `zip#<순번> <이름>(주석 <7자|없음> · 배치 <layout>(<layout_source>) · 접두 <prefix|없음>)` 로(1개면 지금 줄에 배치·접두만 붙는다). `zips` 가 없는 구 산출물(1.3.2 이전 `deploy.json` 으로 `--resolve` 재실행)은 지금의 한 줄 그대로(render 가 `zips` 부재를 허용한다) (나) §8 터미널 요약 「배포본 대조 결과」 항목에 「배치 <layout>(<근거>)」 + zip 이 둘 이상이면 「zip n개 합산」 (다) `mismatchSummary` 의 종류 분류: `layout_ambiguous` 는 `path:null` 군(이름만), `zip_conflict` 는 `path` 있는 군(경로 3개 + 외 n건).

- 기각: 작성자가 본문에 배치를 적게 하는 작성 규칙 — 사람이 또 적어야 하고 틀리면 지금과 같은 오탐(D57). 기대 목록 시험만으로 판별(불일치 적은 쪽) — 1.3.2 (C) 기각 사유 그대로(D57). 판별 실패 전부 「대조 불가」 — 파일 1개 빠진 흔한 zip 도 이유 없는 대조 불가(D58). 키 폐기 — WAR 프로젝트의 삭제 전용 MR 이 다시 오탐(D59). 키 + `"auto"` 값 — 기존 어댑터에 적힌 `maven-war` 가 소스 zip 을 계속 틀리게 함(D59). 댓글 zip 까지 합산 — 낡은 zip 의 주석·초과 항목 오탐(D60). 마지막 zip 1개 유지 — 표본 (다) 불일치 잔존(D60).
- 알려진 한계(§6): 표지도 없고 시험도 안 갈리는 zip 은 힌트/기본값 배치로 불일치가 난다(리뷰어가 부록 A 의 「배치 … (default)」를 보고 판단). 접두 제거 조건이 기대 경로 첫 조각과 겹치면(최상위 폴더 이름이 `html` 등) 떼지 못해 불일치 — 드물고 부록 A 에 접두 「없음」으로 보인다.

**AC(테스트로 검증 — `tests/mr-review/{adapter,deploy,report}.test.mjs`)**

- AC⑬-1. (접두 + WAR, 키 없음) 기대 = `src/main/webapp/html/a.html`·`src/main/resources/mapper/a.xml`·`src/main/java/com/example/acct/Foo.java` · zip = `app/html/a.html`(head 바이트)·`app/WEB-INF/classes/mapper/a.xml`(head 바이트)·`app/WEB-INF/classes/com/example/acct/Foo.class`·`app/WEB-INF/classes/com/example/acct/Foo$1.class` → `DEPLOY 일치` · `zip.layout = "maven-war"` · `zip.layout_source = "signature"` · `zip.prefix = "app/"` · `zip.entries` 는 접두 뗀 이름 · `bytes_skipped` = `Foo$1.class`·`Foo.class`(zip 경로, 접두 없이) · `zips.length = 1`.
- AC⑬-2. (같은 프로젝트, 소스 zip, 어댑터 `deployLayout = "maven-war"`) zip = `src/main/webapp/html/a.html`·`src/main/resources/mapper/a.xml`·`src/main/java/com/example/acct/Foo.java`(전부 head 바이트) → `일치` · `layout = "source"` · `layout_source = "signature"`(힌트보다 표지 우선) · `bytes_skipped = []`.
- AC⑬-3. (혼합) zip = `src/main/java/com/example/acct/Foo.java` + `WEB-INF/classes/mapper/a.xml` → `{kind:"layout_ambiguous", path:null}`(detail 에 zip 이름) · `대조 불가` · `missing_in_zip`·`extra_in_zip` 없음(그 zip 은 대조 안 함) · `entries` 에는 두 항목.
- AC⑬-4. (표지 없음 → 시험) 기대 = `src/main/webapp/html/a.html`·`src/main/webapp/html/b.html` · zip = `html/a.html`·`html/b.html`(head 바이트) → `일치` · `layout = "maven-war"` · `layout_source = "probe"` · 접두 `""`(`html/` 은 기대 사상 경로의 첫 조각이라 떼지 않는다).
- AC⑬-5. (표지 없음 → 시험 실패 → 힌트/기본값) 같은 기대에 zip = `html/a.html` 만 → 키 없음: `layout = "source"` · `layout_source = "default"` · `불일치`(`missing_in_zip` 2건(소스 경로) · `extra_in_zip` 1건 `html/a.html`) · 어댑터 `deployLayout = "maven-war"` 면 `layout_source = "adapter"` · `missing_in_zip` 1건(`src/main/webapp/html/b.html`, detail 에 `html/b.html`) · `extra_in_zip` 0.
- AC⑬-6. (zip 2개 — 소스판 + class 판, 두 zip 주석 = head) 본문 첨부 `src.zip` = `src/main/java/com/example/acct/Foo.java`·`src/main/webapp/html/a.html`(head 바이트) · `classes.zip` = `WEB-INF/classes/com/example/acct/Foo.class`·`WEB-INF/classes/com/example/acct/Foo$1.class` → `일치` · `zip.attachment = "src.zip, classes.zip"` · `zips.length = 2` · `zips[0].layout = "source"`·`zips[1].layout = "maven-war"` · `zip.layout = "mixed"`·`layout_source = "mixed"`·`prefix = null` · `bytes_skipped = []`(`Foo.java` 가 소스판에서 바이트 대조됨) · `entries` = 네 항목.
- AC⑬-7. (zip 2개 충돌) (가) 같은 zip 경로: WAR zip 둘(`a.zip`·`b.zip`)이 `WEB-INF/classes/com/example/acct/Foo.class` 를 **다른 바이트**로 담음 → `{kind:"zip_conflict", path:"WEB-INF/classes/com/example/acct/Foo.class"}`(detail 에 `zip#1 a.zip`·`zip#2 b.zip`) · `대조 불가`(D66 — `.class` 에도) · 같은 바이트면 `일치`(한 번만 대조) · 소스 zip 둘이 `src/main/webapp/html/a.html` 을 다르게 담아도 `zip_conflict`. (나) 교차 중복(D65): AC⑬-6 에서 `classes.zip` 에 `html/a.html` 을 **head 와 다른 바이트**로 추가 → `zip_conflict` 없음 · `{kind:"bytes", path:"src/main/webapp/html/a.html"}`(detail 에 `zip#2 classes.zip`) · `불일치` · head 와 같은 바이트면 `일치`.
- AC⑬-8. (zip 2개, 주석 — D63) `src.zip` 주석 = head · `classes.zip` 주석 **없음** → `일치` · `zips[1].comment_sha = null` · `zip.comment_sha` = head · 부록 A 의 `zip#2` 줄에 「주석 없음」. `classes.zip` 주석이 **다른 SHA** → `comment_sha` 불일치 1건(detail 에 `zip#2 classes.zip`과 그 주석) · 둘 다 주석 없음 → `comment_sha` 불일치 1건 · `zip.comment_sha = null`. zip 1개 주석 없음 → 불일치(1.3.0 테스트 불변).
- AC⑬-15. (중복·같은 이름) 본문에 같은 링크(같은 `secret`)가 두 번 → `zips.length = 1` · 다른 `secret` 의 같은 파일명 `deploy.zip` 둘 → `W/zip/1-deploy.zip`·`2-deploy.zip` 둘 다 받아 둘 다 대조(`zips.length = 2`, `zip.attachment = "deploy.zip, deploy.zip"`).
- AC⑬-16. (합산 경로 충돌 — R1-2) 기대 = `src/main/webapp/WEB-INF/classes/config`·`src/main/resources/config/app.properties` · `a.zip` = `WEB-INF/classes/config`(파일, head 바이트) · `b.zip` = `WEB-INF/classes/config/app.properties`(head 바이트) → `{kind:"zip_conflict", path:"WEB-INF/classes/config/app.properties"}`(detail 에 `zip#1 a.zip`·`zip#2 b.zip`) · `대조 불가` · `a.zip` = `html/A.html`, `b.zip` = `html/a.html` → `zip_conflict` · 두 zip 이 모두 폴더 항목 `WEB-INF/`·`WEB-INF/classes/` 를 가지면 충돌 아님(AC⑬-7 (가)의 같은 바이트 WAR zip 둘에 폴더 항목을 넣어도 `일치`).
- AC⑬-17. (경로 깊이 — review-loop(impl) R4-1) zip 에 65 조각 이름 항목(`a/…/x.txt`)이 있으면 `{kind:"corrupt"}`(detail 에 「깊이」) · `대조 불가` · 64 조각 항목은 판독(corrupt 없음) · 접두 `app/` 40단 반복으로 감싼 정상 WAR zip 은 `일치`·`prefix` = 그 접두.
- AC⑬-9. (④ 와 배치) zip 이 `maven-war`(표지) 인 MR 에서 본문 삭제 `WEB-INF/classes/com/example/acct/Old.class` ↔ 기대 삭제 `src/main/java/com/example/acct/Old.java` → `deleted_list` 불일치 없음(AC⑨-7 그대로) · zip 2개(mixed) 여도 같다(`L4 = maven-war`) · **zip 없는 삭제 전용 MR**: 어댑터 `"maven-war"` 면 통과, 키 없으면 `deleted_list` 불일치(`source` 정규화 — 현행).
- AC⑬-10. (접두 반복·조건) zip = `app/build/WEB-INF/classes/mapper/a.xml` → `prefix = "app/build/"` · zip 항목이 `src/main/…` 로 시작하면(`src` 는 뗄 수 없는 이름) `prefix = ""` · 기대 소스 경로가 `app/x.sql`(targets 에 걸림)이면 zip `app/x.sql` 의 `app/` 은 떼지 않는다(`prefix = ""`, 일치) · (폴더 항목 — R2-2) zip = 폴더 `app/`·`app/build/`·`app/build/WEB-INF/` + 파일 `app/build/WEB-INF/classes/mapper/a.xml` → `prefix = "app/build/"` · `entries` 에 빈 이름·`app/`·`app/build/` 없음(파일 항목만 — 폴더 항목은 넣지 않는다, review-loop(impl) I-2) · 여기에 빈 폴더 `other/` 를 더하면 `prefix = ""`(떼지 않음 — 불일치) · (드러난 드라이브 접두 — R3-1) zip = `app/C:/WEB-INF/classes/com/example/acct/Foo.class` 만(기대 = `src/main/java/com/example/acct/Foo.java`) → `{kind:"corrupt", path:null}`(detail 에 `app/`·`C:/`) · `대조 불가` · `일치` 가 아니다.
- AC⑬-11. (기존 불변) 1.3.2 AC⑨-2~⑨-12·R1-1~R5-2 테스트는 어댑터 `"maven-war"` 를 둔 채 **표지로 같은 배치가 잡히므로** 전부 통과(`layout_source = "signature"` 가 되는 것 외 단언 불변). `source` 레이아웃 기존 테스트(`deploy.test.mjs` 1.3.0·1.3.1 분)도 불변(`layout_source = "signature"`·`prefix = ""`·`zips.length = 1`). **예외 1건(S1 R2-1 — C1 감사 이의 A3)**: 1.3.2 R2-2 테스트(「`Foo$Bar.java` 의 내부 클래스 `Foo$Bar$1.class` 는 가장 긴 기대 클래스의 산출물」)의 **둘째 픽스처**(`r2` — 삭제 목록)는 `warRepo` 기본값으로 head 에 `Foo.java` 가 살아 있어 새 S1 규칙(`$` 경계 전부 조회)이면 `map_conflict` 다. 그 테스트의 의도(가장 긴 후보로 접기)를 지키도록 **픽스처만 정정**한다 — `r2` 의 head 에서 `Foo.java` 를 빼고(`add` = WAR4 − `Foo.java`) zip 에서 `Foo.class`·`Foo$1.class` 를 뺀다(`warEntries` 의 `null` 덮어쓰기). 단언 `DEPLOY 일치` 는 유지. `Foo.java` 가 살아 있는 경우의 「대조 불가」는 AC-S1-6 이 단언한다. 첫째 픽스처(`r1` — 배포 대조)와 그 밖의 단언은 불변.
- AC⑬-12. (렌더·문구) `deploy.json` 픽스처 `zips` 2건(둘째 `comment_sha: null`) → 부록 A 에 zip 줄 2개(`zip#1 …`·`zip#2 …` · 각각 `배치 source(signature)`·`배치 maven-war(signature)` · `접두 없음` · 둘째 줄 `주석 없음`) · 1건 `prefix = "app/"` 픽스처 → `접두 app/` · `zips` 키가 없는 1.3.2 꼴 픽스처 → 기존 한 줄 그대로(기존 render 테스트 불변) · SKILL.md §8 터미널 요약 배포본 항목에 「배치」·「합산」 문구 실재(grep) · `mismatchSummary` 단위: `layout_ambiguous` 1건 → `배포본 대조 불가 — layout_ambiguous`(괄호 없음) · `zip_conflict` 2건 → `zip_conflict 2건(<p1>, <p2>) · 전체 목록 부록 A`.
- AC⑬-13. (어댑터) `deployLayout` 검증·resolved 보존은 1.3.2 AC⑨-1 그대로 통과(값 집합·오류 메시지 불변).
- AC⑬-14. (9단계 실측) 1.3.3 설치본으로 표본 (가)(나)(다) MR 을 재실행 → 셋 다 「일치」, 부록 A 에 배치·접두·zip 수가 서술과 같다.

### 3.S1 `normBody` 가 본문의 `Foo$X.class` 를 내부 클래스로 접을 때 head 에 같은 이름의 실제 파일이 살아 있는지 확인하지 않는다 (1.3.2 보안 지적)

**현상**: `Foo.java` 를 지우는 MR 본문에 `WEB-INF/classes/com/example/acct/Foo.class`·`…/Foo$X.class` 삭제를 적었는데, `Foo$X.class` 가 내부 클래스 산출물이 아니라 **리소스 폴더에 있던 별도 파일**(`src/main/resources/com/example/acct/Foo$X.class`, 이번 MR 이 건드리지 않음)이면 — 엔진은 `Foo$X.class` 를 `Foo.class` 로 접어 삭제 목록 「일치」. 배포자가 본문대로 지우면 살아 있는 파일이 사라진다. 1.3.2 R3-1(삭제 경로가 zip 에도 있음)은 zip 에 없는 파일이라, R4-2(본 클래스 삭제 요구)는 본문에 `Foo.class` 도 있으니 막지 못한다.

**재현 근거**: 1.3.2 push 뒤 자동 보안 리뷰 지적(사용자 결정 2026-10-22 「실측 뒤 묶어서」). 실측 V2 에서 작성자가 내부 클래스를 zip 에 넣는 관행(3차 실사용 `bytes_skipped` 4건·표본 (가) `Foo$1.class`)이 확인돼 본문 삭제 목록에도 내부 클래스가 적힐 개연성이 있다. 코드: `deploy.mjs:395` `normBody` = 본문 경로가 기대 삭제에 없으면 `findOuterClass(zp, o => expClasses.has(o) && bodyZip.has(o))` 로 접는다 — head 조회 없음.

**원인**: 내부 클래스 접기(D38·R1-1·R4-2)가 「`$` 든 `.class` 는 그 `.java` 의 산출물」을 가정하고, 그 이름이 **배포 트리에 실제로 존재하는 다른 파일**일 가능성을 보지 않는다. 워크트리 모드는 head 트리가 있어 확인할 수 있고, diff-only 는 트리 조회를 하지 않는다(D22).

**수정 방향(사용자 결정 2026-10-23 — D61)**

1. **접기 전 head 트리 조회(워크트리 모드)**: 본문 경로 `zp`(④ 정규화 뒤 zip 경로)를 접으려 할 때, `zp` 로 사상될 수 있는 **소스 경로 후보 전부**를 head 에서 찾는다 — `L4 = maven-war` 기준 역사상: `src/main/webapp/<zp>` · `zp` 가 `WEB-INF/classes/<rest>` 꼴이면 `src/main/resources/<rest>`·`src/main/java/<rest>`(Java 폴더의 리소스)·**`src/main/java/<rest 의 .class 를 .java 로>`**(그 이름의 **살아 있는 소스**가 있으면 `Foo$X.class` 는 그 산출물이라 지우면 안 된다) · **모든 바깥 클래스의 소스** — `zp` 이름의 `$` 경계 **전부**(접힐 바깥 클래스보다 짧은 쪽 포함 · 이름이 `$` 로 시작하면 위치 0 경계도 — 바깥 이름이 빈 문자열이라 후보 `<dir>/.java`, review-loop(impl) R1-2)마다 그 이름의 `src/main/java/<dir>/<경계 이름>.java`(R1-1·R2-1 — `Foo$Bar$1.class` 면 `Foo$Bar.java`·`Foo.java` 둘 다 본다. head 는 MR 을 적용한 트리라 이번 MR 이 지운 소스는 원래 잡히지 않으므로 따로 빼지 않는다 — 정상 삭제 MR 은 영향 없다. 경계 수는 `findOuterClass` 의 `INNER_MAX`(32) 상한 그대로) · 그리고 `zp` 그대로(그 밖 경로). 하나라도 head 에 항목이 있으면(모드 무관 — 파일·링크·서브모듈 전부 「있음」) **접지 않고** `{kind:"map_conflict", path:zp, detail:"삭제 지시가 head 의 실제 파일을 가리킴: <head 의 실제 경로>"}` → **「대조 불가」**. 없으면 지금처럼 접는다(AC⑨-7·R1-1·R4-2 불변). **「head 에 있음」은 대소문자를 무시해 판정한다(R5-1)** — 대소문자를 구분하지 않는 배포 파일 시스템에서는 본문 `Foo$X.class` 삭제가 head 의 `Foo$x.class` 를 지운다(`readZip` 의 대소문자 무시 충돌 검사와 같은 기준). 조회 = head 트리의 경로 목록(`git ls-tree -r -z --name-only <head>` — 파일·링크·서브모듈 항목, 한 번 읽어 캐시)과 후보를 **소문자로** 비교하고, 맞으면 detail 에 head 의 실제 경로를 적는다(폴더 이름의 대소문자 차이도 같이 잡힌다). **목록은 반드시 `-z`(NUL 구분)로 읽는다(C1 감사 이의 A7)** — `-z` 없이 읽으면 기본 `core.quotePath=true` 에서 한글 등 비ASCII 경로가 따옴표·8진수 이스케이프(`"src/main/resources/\355…"`)로 나와 비교가 어긋나 살아 있는 파일을 놓친다. 줄바꿈 분리·역인용 구현은 쓰지 않는다.
2. **diff-only**: 트리 조회를 하지 않는다(D22 유지). 접기가 **성립하는 경우**(본문 경로가 기대 삭제 목록에 없고, `findOuterClass` 가 바깥 클래스를 찾았으며 그 바깥 클래스가 기대 삭제·본문 양쪽에 있어 — R4-2 — 지금이라면 접혔을 경우)에는 접지 않고 `{kind:"map_conflict", path:zp, detail:"head 존재 확인 불가(diff-only) — 내부 클래스 삭제 지시를 확인할 수 없음"}` → 「대조 불가」. 접기가 필요 없는 본문(내부 클래스를 적지 않음)은 지금과 같다.
3. 조회 결과는 `deploy.json` 에 따로 적지 않는다(`map_conflict` 의 `detail` 로 충분). git 호출 = 접기가 성립하는 본문 경로가 하나라도 있을 때 head 트리 목록 1회(캐시) · 비교 수 = 그 경로 수 × 후보 수(고정 5 + `$` 경계 수 — 통상 1~2).

- 기각: diff-only 도 GitLab 파일 API 로 존재 조회 — D22 변경·API 호출 증가, 폴백(대조 불가)이 fail-closed 로 충분. 접기 규칙 폐기 — D38·AC⑨-7·R4-2 변경(정상 MR 이 불일치).
- 알려진 한계(§6): 기대 삭제 `Foo.class` 자체와 같은 이름의 리소스(`src/main/resources/p/Foo.class`)는 이 검사 대상이 아니다(접기가 아니라 기대 목록 일치 — 배포 도구 몫).

**AC**

- AC-S1-1. (워크트리) head 에 `src/main/resources/com/example/acct/Foo$X.class`(MR 이 안 건드림)가 있고 MR 이 `src/main/java/com/example/acct/Foo.java` 를 지우며 본문 삭제 = `WEB-INF/classes/com/example/acct/Foo.class`·`…/Foo$X.class` → `{kind:"map_conflict", path:"WEB-INF/classes/com/example/acct/Foo$X.class"}`(detail 에 `src/main/resources/com/example/acct/Foo$X.class`) · `대조 불가`.
- AC-S1-2. 같은 픽스처에서 head 에 그 파일이 없으면 `일치`(1.3.2 AC⑨-7 그대로) · 후보가 `src/main/java/com/example/acct/Foo$X.class`(Java 폴더의 리소스)·`src/main/webapp/WEB-INF/classes/com/example/acct/Foo$X.class`·**`src/main/java/com/example/acct/Foo$X.java`(살아 있는 소스 — MR 이 안 건드림)** 로 있어도 각각 `map_conflict`(detail 에 그 후보 경로).
- AC-S1-3. (diff-only) 같은 본문(내부 클래스 포함) → `{kind:"map_conflict", path:"…/Foo$X.class"}`(detail 에 「diff-only」) · `대조 불가` · 본문이 `Foo.class` 만 적으면 `일치`.
- AC-S1-4. 기대 삭제 목록에 **이미 있는** 이름(`expDel.has(zp)`)은 조회하지 않는다 — `Foo$Bar.java` 삭제 ↔ 본문 `Foo$Bar.class`(R1-1 테스트) 불변.
- AC-S1-5. (중간 바깥 클래스 — R1-1) head 에 `src/main/java/com/example/acct/Foo$Bar.java`(MR 이 안 건드림)가 있고 MR 이 `Foo.java` 만 지우며 본문 삭제 = `…/Foo.class`·`…/Foo$Bar$1.class` → `{kind:"map_conflict", path:"WEB-INF/classes/com/example/acct/Foo$Bar$1.class"}`(detail 에 `src/main/java/com/example/acct/Foo$Bar.java`) · `대조 불가` · head 에 `Foo$Bar.java` 가 없으면 `일치` · MR 이 `Foo$Bar.java` 도 지우고 본문에 `…/Foo$Bar.class` 도 있으면 `Foo$Bar$1.class` 는 `Foo$Bar.class` 로 접히고 `Foo$Bar.java`·`Foo.java` 가 head 에 없으므로 `일치`(R2-2 불변).
- AC-S1-6. (짧은 쪽 바깥 소스 — R2-1) MR 이 `src/main/java/com/example/acct/Foo$Bar.java` 를 지우고 `Foo.java`(head 에 살아 있음 — 수정·무변경 무관)를 남기며 본문 삭제 = `…/Foo$Bar.class`·`…/Foo$Bar$1.class` → `Foo$Bar$1.class` 는 `Foo$Bar.class` 로 접힐 후보지만 head 에 `Foo.java` 가 있어 `{kind:"map_conflict", path:"WEB-INF/classes/com/example/acct/Foo$Bar$1.class"}`(detail 에 `src/main/java/com/example/acct/Foo.java`) · `대조 불가`.
- AC-S1-7. (대소문자 — R5-1) head 에 `src/main/resources/com/example/acct/Foo$x.class`(소문자 `x`, MR 이 안 건드림)가 있고 MR 이 `Foo.java` 를 지우며 본문 삭제 = `…/Foo.class`·`…/Foo$X.class`(대문자 `X`) → `{kind:"map_conflict", path:"WEB-INF/classes/com/example/acct/Foo$X.class"}`(detail 에 head 의 실제 경로 `src/main/resources/com/example/acct/Foo$x.class`) · `대조 불가`. · (비ASCII — C1 감사 이의 A7) 같은 픽스처를 패키지 폴더 `한글/` 로(head `src/main/resources/한글/Foo$x.class` · 기대 삭제 `src/main/java/한글/Foo.java` · 본문 `WEB-INF/classes/한글/Foo.class`·`WEB-INF/classes/한글/Foo$X.class`) → `map_conflict`(detail 에 head 의 실제 경로가 인용·이스케이프 없이 `src/main/resources/한글/Foo$x.class`) · `대조 불가` — 테스트 저장소의 `core.quotePath` 를 기본값(true)으로 둔 채.

### 3.⑭ 의도 대조표 셀의 `|` 를 이스케이프하지 않아 검증 표 행 원문이 들어오면 리포트 표가 깨진다

**현상**: 리포트 「1. 의도 대조표」(`report.mjs:195`)는 `| ${criterion} | ${result} | ${location} (${basis}) |` 로 행을 만든다. 1.3.2 D41 은 `criterion` 을 「메인이 검증 표에서 읽은 원문 행」으로 정했는데, 원문 행에는 표 칸 구분자 `|` 가 들어 있어(`| M3 틀린 비밀번호 | 200 | 탭 숨김 |`) 셀에 넣으면 6칸으로 벌어져 GitLab 에서 깨져 보인다. 3차 실사용은 메인이 **첫 칸만** 쓰는 우회로 넘겼다(`findings.json.intent` 34행, `|` 포함 0건).

**재현 근거**: 3차 실사용 `findings.json.intent` = 34행 · `criterion` 길이 5~12자(첫 칸만) · 리포트 1절 표 정상. `report.mjs` 에 `|` 이스케이프 함수 없음(grep 0건). 부록 A 검사표(`:250-261`)의 셀도 외부 입력(첨부 파일명·후보 문서 경로·`deployNote`·무시한 댓글 사유)을 그대로 넣는다.

**원인**: 렌더러가 마크다운 표 셀의 특수문자를 처리하지 않고, SKILL.md §6-5 는 「원문 행」이라고만 적어 행 전체를 넣으라는 뜻으로 읽힌다.

**수정 방향(사용자 결정 2026-10-23 — D56, 둘 다)**

1. **렌더러**: `report.mjs` 에 셀 정규화 `cell(s)` — `String(s)` 의 줄바꿈(`\r\n`·단독 `\r`·`\n` — 정규식 `\r\n|\r|\n`, R6-1)은 공백 하나로, 이스케이프되지 않은 `|` 는 `\|` 로(이미 `\|` 인 것은 그대로 — 이중 이스케이프 금지). 의도 대조표 행(`criterion`·`result`·`location`·`basis`)과 부록 A 검사표 행(`:250-261` 의 값 칸 전부)에 적용한다. **순서(R3-2·R4-1 — 마스킹 경계)**: ① **원문 마스킹** — 지금의 `fieldMask`(`renderReport` 의 `findings`·`check`·`deploy` 마스킹, `:302`·`:308`·`:309`)를 줄바꿈이 있는 원문에 그대로 먼저 한다(잘린 PEM 규칙 `pack.mjs:123` 은 BEGIN 뒤 줄바꿈으로 키 본문을 알아보므로, 먼저 펴면 BEGIN 표지만 가려지고 본문이 남는다 — R4-1). **① 의 전제(C2-N1)**: 마스킹 입구 `maskTextWithCounts`(`pack.mjs:331`)는 지금 `\r\n` 만 `\n` 으로 바꾸고 단독 `\r` 을 남겨, BEGIN 뒤가 단독 CR 이면 잘린 PEM 규칙(`:123` — `\n` 뒤 본문)이 본문을 못 잡는다(1.3.2 현행 모든 마스킹 경로 — 표 칸·본문·팩 — 공통 구멍). 입구를 `\r\n|\r` → `\n` 으로 바꾼다(한 줄). 마스킹 결과 글의 단독 CR 이 LF 가 되는 것 외 동작 불변. ② **평탄화** — 그 뒤 표 셀로 쓰일 값들의 줄바꿈(`\r\n|\r|\n` — 마크다운이 줄 경계로 읽는 세 꼴 전부. 단독 `\r` 을 남기면 칸 안에서 줄이 갈려 표·실행 블록 코드펜스가 깨지고 가짜 제목이 끼어든다, R6-1)을 공백 하나로. ③ **재마스킹** — 편 값에 `fieldMask` 를 **다시** 적용한다(줄로 나뉘어 있던 `run --password⏎x` 가 평탄화로 `--password x` 가 되면 여기서 가려지고 꼬리 봉인도 다시 시험된다 — 이것이 없으면 마지막 전체 마스킹이 그 뒤 행 전체(결과·위치·칸 구분자)를 먹는다, R3-2). ④ **`|` 이스케이프** — 행 조립 때 `cell()` 로. `cell()` 은 ④ 에서 줄바꿈 평탄화를 다시 해도 된다(①~③ 뒤라 무변경 — ②가 정본). 고정 문구 행(`(검증 표 없음)`·축약 ① 「… 외 n건 — 부록 A」·조기 종료 블록 `:333`)은 바꾸지 않는다. 재리뷰 파서(`check.mjs:242` `APPENDIX_D_RE`)는 부록 D 의 불릿 줄만 읽고 표를 읽지 않으므로(조회 사실) 영향 없다.
2. **SKILL.md §6-5**: 「`criterion` = 메인이 검증 표에서 읽은 **수용기준·주장을 적은 첫 칸의 원문** — 첫 칸이 번호·ID 만이면(숫자·`M3` 같은 짧은 표식) **그 다음 칸**(D67 — 번호는 `row` 에 이미 있다). 행 전체가 아니다(다른 칸은 기대·실제 값이라 `result`·`location` 과 겹친다). 불릿 목록이면 항목 문구 전체. 셀의 `|`·줄바꿈은 `render` 가 처리한다」.

- 기각: 렌더러만 — 행 전체가 한 셀에 들어가 읽기 불편. SKILL.md 만 — 첫 칸에도 `|`(코드 조각) 가 올 수 있어 다시 깨짐.

**AC**

- AC⑭-1. `findings.json` 픽스처 `intent[0].criterion = "a | b"`·`location = "x.java:10\ny"` → render 결과의 의도 대조표 행이 `| a \| b | PASS | x.java:10 y (작성자 주장) |`(이스케이프 안 된 `|` 로 나누면 칸 3개) · `\|` 실재.
- AC⑭-2. 부록 A 검사표: `check.json` 픽스처 `attachments[0].filename = "a|b.zip"`·`ignoredComments[0].reason = "x|y"` → 그 행들이 `\|` 로 이스케이프되고 칸 수 2.
- AC⑭-5. (마스킹 순서 — R3-2) `intent[0].criterion = "run --password\nx"`·`result = "PASS"`·`location = "a.java:3"` → 최종 리포트(전체 마스킹 뒤)의 의도 대조표 행에 `x` 가 남지 않고(가림 표시) · `PASS`·`a.java:3` 가 남으며 · 이스케이프 안 된 `|` 로 나누면 칸 3개. (잘린 PEM — R4-1) `criterion = "-----BEGIN RSA PRIVATE KEY-----\nMIIEow…(base64 본문 몇 줄, END 줄 없음)"` → 최종 리포트 어디에도 base64 본문 조각이 남지 않고 · 같은 행의 결과·위치가 남으며 · 칸 3개. (단독 CR — R6-1) `criterion = "a\r```\r# forged review\r```text\rb"` → 최종 리포트에 `\r` 없음 · `# forged review` 로 시작하는 줄 없음 · 의도 대조표 행이 한 줄이고 칸 3개 · 실행 블록 코드펜스 수 불변. (단독 CR + 잘린 PEM — C2-N1) `criterion = "-----BEGIN RSA PRIVATE KEY-----\rMIIEowIBAAKCAQEA"`(END 없음) → 최종 리포트에 `MIIEow` 조각 없음 · 결과·위치 유지 · 칸 3개. `pack.test.mjs`: `maskText("-----BEGIN RSA PRIVATE KEY-----\rMIIEowIBAAKCAQEA\rxyz", [])` 결과에 `MIIEow`·`xyz` 없음 · 기존 `\r\n`·`\n` 입력 결과 불변.
- AC⑭-3. 기존 render 테스트(`report.test.mjs`)의 의도 대조표·검사표 단언 불변(`|` 없는 입력은 출력 동일).
- AC⑭-4. SKILL.md §6-5 에 「첫 칸」·「수용기준」·「행 전체가 아니」·「번호·ID」(또는 「다음 칸」) 문구 실재(grep).

### 3.⑯ Claude 검토자가 `W` 밖(세션 scratchpad 루트)에 임시 파일을 남기고 cleanup 이 지우지 못한다

**현상**: Claude 검토자(서브에이전트)가 diff 임시 파일을 세션 scratchpad **루트**에 만들고 끝났다. cleanup(1.3.1 D23 — `W` 최상위의 허용 9종 외 삭제)은 `W` 안만 다루므로 못 지웠고, 사용자 세션이 손으로 지웠다. 마스킹되지 않은 diff 원문이 세션 끝까지 남는 F5·F7 사각지대다.

**재현 근거**: 사용자 세션 보고(파일은 수동 삭제돼 남아 있지 않다 — 3차 실사용 scratchpad 루트 조회: 어댑터 사본·렌즈 메모 등 **사용자 파일만** 있음). 코드: `report.mjs:431` `cleanup({work})` 는 `work` 아래만 순회. SKILL.md §5 Claude 검토자 프롬프트(`:137`)는 팩 경로와 출력 경로만 주고 임시 파일 위치를 말하지 않는다.

**원인**: 서브에이전트의 기본 작업 위치가 세션 scratchpad 루트라, 지시가 없으면 거기에 쓴다. 루트에는 사용자 파일이 섞여 있어 cleanup 범위를 넓힐 수 없다.

**수정 방향(사용자 결정 2026-10-23 — D55, 검토자 지시 + 종료 자가 점검 · 코드 변경 없음)**

1. **SKILL.md §5 Claude 검토자 프롬프트**에 1문장: 「임시 파일(diff 발췌·메모 등)이 필요하면 **반드시 `W/` 아래에만** 만들어라(이름은 `tmp-` 로 시작 — `snapshot.json`·`mr.json` 등 작업 파일 9종과 `review-*.json` 이름은 쓰지 마라. cleanup 이 지운다). `W` 밖(세션 scratchpad 루트·홈·`/tmp`)에는 아무것도 쓰지 마라.」 `W` 안의 임시 파일은 허용 9종 밖이라 cleanup 이 `extra` 로 지운다(D23 — `W/tmp/` 규약을 새로 두지 않는다).
2. **종료 자가 점검(§8)**: 검토자를 띄우기 **직전**(§5)에 scratchpad 루트와 `<루트>/mr-review/` 두 단계의 항목 이름을 `W/root-before.txt` 에 적어 두고(`ls -A`), §8 자가 점검 F7 줄에서 같은 두 단계를 다시 나열해 **`root-before.txt` 에 없는 새 항목의 건수**를 보고한다 — **이름은 출력하지 않는다**(R6-2 — 이름에 비밀값이 들어 있을 수 있는데 셸 비교 경로에는 엔진 비밀값 가림(`maskText`)을 부를 수단이 없다. 건수만 내면 노출 경로 자체가 없다) · **지우지 않는다**(사람이 scratchpad 루트를 열어 확인해 지운다). `root-before.txt` 는 `W` 안이라 cleanup 이 지운다(자가 점검은 cleanup **앞**에서 한다 — 「검토자 종료 확인 → 자가 점검 비교 → cleanup」 순). 줄 꼴 = 「W 밖 새 항목 n건 — scratchpad 루트에서 직접 확인·삭제(이름은 출력하지 않음)」, 0 이면 「W 밖 새 항목 없음」 1줄. 비교는 **검토자를 띄운 뒤의 모든 종료 경로**(§0 공통 종료 절차 — 정상·`ERR`·사용자 중단)에서 「검토자 종료 확인」 바로 다음에 한다(비교 결과는 메인이 기억해 cleanup 뒤 보고에 적는다). `root-before.txt` 가 없는 경로(§3 조기 종료 — 검토자 미기동 · §9 `--resolve` 재실행)는 비교 해당 없음(줄 생략).

- 기각: cleanup 범위 확대 — 루트의 사용자 파일 오삭제 위험. 메인이 새 항목 자동 삭제 — 다른 작업의 파일을 지울 수 있음.

**AC**

- AC⑯-1. SKILL.md §5 Claude 검토자 프롬프트 문단에 「`W/` 아래에만」(또는 「W 아래에만」)·「쓰지 마라」 실재(grep).
- AC⑯-2. SKILL.md 에 `root-before.txt` 가 §5(기록)·§8(비교) 두 곳에 실재하고, §8 자가 점검 F7 줄에 「W 밖 새 항목」·「지우지 않는다」 문구 실재(grep). 비교가 cleanup 보다 앞에 있다(§8 순서 문장) · §0 공통 종료 절차에 비교 단계가 들어 있고 조기 종료·`--resolve` 는 「해당 없음」 문장 실재(grep). · (R6-2) F7 줄 문구에 「n건」·「이름은 출력하지 않」 실재, §8 에 새 항목 이름을 출력·보고하라는 지시 없음(grep).
- AC⑯-3. 정상 `W` 에 `root-before.txt` 를 두고 cleanup → `extra` 에 포함돼 삭제(기존 AC⑤-1 방식).

### 3.⑮ companion 실행 로그가 명령을 96자에서 잘라 경로 감시가 뒤쪽 경로를 못 본다 (문구만)

**현상**: codex companion(외부 플러그인 1.0.6)은 실행 로그 `[codex] Running command: …`·`Command completed: …` 를 만들 때 명령을 공백 접기(연속 공백 → 하나) 뒤 **96자에서 잘라 `...`** 를 붙인다(`scripts/lib/codex.mjs:90` `shorten` · `:247`·`:277` 호출 — 읽기 전용 확인). `Running command: /bin/bash -lc '` 접두가 ~20자라 실제 명령은 앞 ~75자만 남는다. 그 뒤에 적힌 경로(예 `cat <워크트리>/a.java <워크트리>/b.java ~/notes/x.md` 의 마지막)는 경로 감시(1.3.1 D32·1.3.2 D39·D49)가 볼 수 없다. 외부 플러그인이라 엔진이 못 고친다.

**재현 근거**: companion 원문 위 줄 · 1.3.2 §6 「검증 필요」가 이미 「잘린 형식이 버전마다 같은지」를 실측 대상으로 뒀고 3차 실사용에서 확인됐다(사용자 세션 보고).

**수정 방향(사용자 결정 2026-10-23 — D54, SKILL.md 문구 + 터미널 요약 1줄 · 코드 변경 없음)**

1. SKILL.md §5 경로 감시 항목 끝에 **한계 문단**: 「**한계**: companion 실행 로그는 명령을 공백 접기 뒤 96자에서 잘라 `...` 를 붙인다(1.0.6 실측 — `Running command:` 접두 포함). 잘린 명령의 뒤쪽 경로는 감시하지 못한다. 끝이 `...` 인 `Running command:` 줄 수를 세어 둔다(=「잘린 명령 n건」). D49 의 「잘린 후보」 규칙은 **보이는 부분**에만 적용된다.」
2. §8 터미널 요약에 「경로 감시 한계: 잘린 명령 n건(companion 로그 96자)」 1줄(0 이면 생략). 리포트 헤더에는 넣지 않는다(D47 정신 — 헤더는 리뷰 자체 상태만).

- 기각: 리포트 헤더 표시 — 매번 뜨는 줄은 무시된다. 엔진 보완(Codex 세션 원본 로그) — 비목표(별도 트랙 후보).

**AC**

- AC⑮-1. SKILL.md §5 경로 감시에 「96자」·「`...`」·「한계」·「잘린 명령」 문구 실재(grep, `report.test.mjs` 의 SKILL.md 문구 테스트 방식).
- AC⑮-2. SKILL.md §8 터미널 요약에 「경로 감시 한계: 잘린 명령 n건」 실재(grep).

## 4. 영향 범위

| 대상 | 변경 |
|---|---|
| SC-2 어댑터 계약 | `projects.<이름>.deployLayout` **의미 변경**(고정 → 판별 못 할 때의 기본값·삭제 전용 MR 의 ④ 배치). 값·형식·검증·기본값 불변. plan SC-2 문장 정정은 impl 트랙(「1.3.3에서 변경」), 이 spec 이 정본 |
| SC-3 `deploy.json` | `zip` 요약에 `layout_source`·`prefix` 추가, `layout` 에 `"mixed"` 값 · `attachment` 가 여러 이름(`, ` 연결) 가능 · `comment_sha` = head 와 일치하는 주석(없으면 `null`) · 주석 규칙 「최소 한 zip」(D63) · 새 배열 `zips[]` · zip 저장 `W/zip/<순번>-<이름>`(2개 이상일 때 — 1개면 `W/zip/<이름>`) · `mismatches.kind` 에 `layout_ambiguous`·`zip_conflict`(둘 다 대조 불가군) · `map_conflict` 의 새 detail 2종(S1) — plan SC-3 정정도 impl 트랙 |
| `adapter.mjs` | 변경 없음(검증·resolved 그대로). 주석의 「고정」 문구만 정정 |
| `pack.mjs` | 마스킹 입구 `maskTextWithCounts` 의 줄바꿈 통일 `\r\n` → `\r\n\|\r`(→ `\n`) 한 줄(C2-N1 — 단독 CR 뒤 잘린 PEM 본문). 그 밖 무변경 |
| `deploy.mjs` | zip 전부 수집·접두 제거·표지/시험 판별·zip 별 ②③·합산·`zip_conflict`(같은 경로 다른 바이트 + 합산 경로 충돌 R1-2)·`layout_ambiguous`·④ `L4` 선택·S1 head 트리 조회(`git ls-tree -r -z --name-only` 1회 캐시·NUL 분리·대소문자 무시 비교 R5-1·C1, `$` 경계 전부의 `.java` 포함 R1-1·R2-1)·diff-only 폴백 |
| `report.mjs` | `cell()` 이스케이프(의도 대조표·검사표 — 순서 = 원문 `fieldMask` → 줄바꿈 평탄화 → 재 `fieldMask` → `|` 이스케이프, R3-2·R4-1) · 부록 A zip 줄(배치·근거·접두, zip 별) · `mismatchSummary` 종류 분류 2종 추가 |
| SKILL.md | §5 Claude 검토자 프롬프트 「W 아래에만」 + `root-before.txt` 기록 · §5 경로 감시 「한계」 문단 · §6-5 `criterion` = 첫 칸 · §8 터미널 요약(배치·합산·경로 감시 한계)·자가 점검 F7(W 밖 새 항목)·리포트 구성 문구(부록 A zip 줄) |
| README 3종 | 1.3.3 한 줄(결함 4건 + 보안 1건) + 어댑터 안내 `deployLayout` 문장 정정(「… 를 적는다」 → 「… 는 판별 못 할 때의 기본값」) |
| plugin.json·marketplace.json | 1.3.2 → 1.3.3 |
| 1.3.2 spec D37 | impl 트랙이 D37 행 끝에 「1.3.3 D59 로 의미 변경(힌트) — spec `2026-10-23-mr-review-1-3-3-fixes.md` 3.⑬」 부기(재론 아님) |
| 어댑터 문서(프로젝트 쪽) | 변경 불요. WAR 프로젝트는 키 없이도 zip 표지로 동작하고, 삭제 전용 MR 을 위해 두고 싶으면 그대로 둔다 |
| `tests/mr-review` | deploy(⑬ 15건·S1 7건)·report(⑭ 5건·⑬-12·⑮·⑯ 문구)·adapter(⑬-13)·pack(C2-N1 1건) — 기존 전부 불변(AC⑬-11), 단 1.3.2 R2-2 테스트 둘째 픽스처(`r2`)만 정정(head 에서 `Foo.java` 제외 — AC⑬-11 예외, 단언 불변) |

## 5. 검증 · 완료 조건

- 각 AC 를 `tests/mr-review/*.test.mjs` 에 **먼저 RED 로** 추가한 뒤 구현으로 GREEN(TDD). 게이트 = SC-7 T1~T7(기존 테스트 전부 통과 · T6 식별자 패턴 0건 · T7 AI 서명 0건 · T5 `$N` 0건).
- 4단계 review-loop(spec) — 이 spec 을 적대검증한다(D53). 5·6 생략.
- 8단계 impl 적대검증(review-loop `--phase impl`) 필수(하한). 보안 크리티컬 = **yes**(호출자(메인) 지정 — 접촉면 = zip 접두 제거·배치 판별(혼합 zip 수용 여부)·다중 zip 합산(충돌)·④ 정규화 배치 선택·S1 head 조회·표 셀 이스케이프).
- 9단계: 1.3.3 릴리스 커밋·push(사용자 확인) → 설치본 갱신 → 표본 (가)(나)(다) MR 재실행 「일치」(AC⑬-14) · 검증 표가 있는 MR 로 ⑭ 표 정상 · 터미널 요약에 「경로 감시 한계」·「배치」 줄 · 자가 점검 「W 밖 새 항목」 줄.

## 6. 잔여 리스크 (DEFERRED · 실측) · 미해결 질문

**미해결 질문: 없음.** 설계 선택 9건(경로·⑮ 범위·⑯·⑭·⑬ 4건·S1)과 harden-spec(2026-10-23 08:1x~08:2x, 이 세션)의 판단 갭 5건(H-A zip 주석·H-B META-INF 표지·H-C 교차 중복·H-D `.class` 충돌·H-E 첫 칸)은 전부 질문으로 해소됐고(사용자 지시로 메인이 추천안 입력) 사용자가 유예한 갭은 없다 — **DEFERRED 0건**. 사실 갭 10건은 코드 조회로 닫았다(`check.mjs:222` 첨부에 `secret` 있음 → 중복 제거 가능 · `deploy.mjs:312` 저장 경로가 파일명뿐 → 순번 접두 · `findOuterClass` 접기 성립 조건(R4-2) · `report.mjs` 표 행 조립 지점 = `:195`·`:250-261`·고정 문구 `:196`·`:219`·`:333` · 재리뷰 파서 `check.mjs:242` 는 표를 읽지 않음 · `cleanup` 범위 = `W`(`report.mjs:431`) · SKILL §9 는 §5 를 돌리지 않음 · `report.mjs:365` 가 `zip.attachment`·`comment_sha` 만 소비 · verdict 입력은 `deploy.result`·`applicable` 뿐(`report.mjs:106`) · javac 산출물 이름 규칙(내부·익명 클래스 = 바깥 이름 + `$`)).

**검증 필요(실측 — repo 조회로도 사용자 결정으로도 닫히지 않는 외부 사실)**

- 표본 (가)(나)(다) zip 의 실제 구조가 서술과 같은지(접두 1단계·내부 클래스·zip 2개의 배치) — 9단계 AC⑬-14. 실물이 남아 있지 않아 spec 은 서술을 사실로 썼다.
- WAR 표지가 `WEB-INF/` 없이 `META-INF/` 만으로 오는 zip 이 실제로 있는지(있으면 WAR 로 읽힌다 — 의도).
- 1.3.2 §6 의 Windows (마) 존재 검사(V1) — 여전히 미검증.
- 실행 간 재현율 편차(두 모델이 어제 찾은 실결함 2건을 오늘 모두 놓침) — 운영 한계, 범위 밖. 프롬프트·온도가 아니라 모델 비결정성이라 엔진으로 닫히지 않는다.

**수용된 한계(결정은 내려졌고 리스크만 기록)**

- ⑬ 표지도 없고 시험도 안 갈리는 zip 은 힌트/기본값 배치로 불일치가 난다 — 부록 A 의 `(default)` 표기로 리뷰어가 안다(D58).
- ⑬ 접두 제거는 「모든 항목 공유 + 기대 경로와 안 겹침」 조건이라 최상위 폴더 이름이 `html`·`WEB-INF` 등과 겹치면 떼지 못한다(불일치로 보임).
- ⑬ 혼합 zip 은 대조 불가 — 작성자가 소스·WAR 를 한 zip 에 섞으면 리뷰어가 사람 판단으로 넘긴다.
- ⑬ (impl 관찰) zip 이 둘 이상일 때도 표지 없는 zip 의 기대 목록 시험은 3.⑬-3 문면대로 **전체 기대 목록** 기준이라, 웹 자원만 든 zip 이 다른 zip 과 나눠 담기면 시험이 실패해 힌트·기본값 배치로 대조된다(힌트가 맞으면 일치, 틀리면 `extra_in_zip` 불일치 — 보이는 실패 · 부록 A `(adapter|default)` 표기).
- ⑬ 표지 없음 + 시험 실패 + 힌트 없음이면 `source` 기준 목록이라, WAR 꼴로 일부만 든 zip 은 `missing`·`extra` 가 이중으로 보인다(`(default)` 표기로 안다 — D58).
- ⑬ 소스 저장소 루트에 `META-INF/` 를 두고 그것을 배포 대상에 넣는 프로젝트는 소스 zip 이 「혼합」으로 읽힌다(D64 — 알려진 저장소에 없음, 생기면 표지 규칙 재검토).
- ⑬ zip 둘 이상일 때 주석 없는 zip 은 head 증명을 다른 zip 에 기댄다(D63) — 주석 없는 class 판이 다른 head 의 빌드여도 기계는 모른다(D38 의 리스크와 같은 종류, 부록 A 「주석 없음」으로 리뷰어가 안다).
- ⑬ zip 2개에서 바이트 대조된 소스의 `.class` 는 `bytes_skipped` 에 남지 않는다 — `.class` 바이트 자체는 여전히 미검증(D38 의 리스크 그대로).
- S1 diff-only 에서 내부 클래스를 본문에 적은 삭제 MR 은 「대조 불가」 — fail-closed 비용(리뷰어가 워크트리 모드로 재실행하거나 사람 판단).
- ⑬ 본문 zip 개수·총 다운로드량에는 상한이 없다 — 큰 zip 을 많이 붙이면 받은 크기만큼 메모리를 쓰고, 모자라면 리포트 없이 오류로 멈춘다(틀린 「일치」는 없음 · 압축 증폭 경로는 review-loop(impl) R2-1 로 닫음 · R2-2 ACCEPTED).
- ⑮ 잘린 명령 뒤의 경로는 보지 못한다 — 터미널 요약의 건수로 리뷰어가 안다. 엔진 보완은 별도 트랙 후보.
- ⑯ 검토자가 지시를 어기고 `W` 밖에 쓰면 자가 점검이 건수만 보고한다(이름·삭제는 사람이 직접 — R6-2).

## 재논의 금지(기결정)

사용자 지시 「추천안으로 대신 답해줘」(2026-10-23 08:10)에 따라 **메인이 추천안(첫 선택지)을 입력**한 결정(이 세션 질의 9건, 08:0x~08:1x). 리뷰에서 다시 제안하지 않는다. 1.3.0 spec D1~D16 · 1.3.1 spec D17~D34 · 1.3.2 spec D35~D51 은 전부 승계한다(**D37 만 D59 로 의미 변경**).

| D | 결정 | 근거 |
|---|---|---|
| D52 | 이 트랙 범위 = ⑬·⑭·⑯ + 1.3.2 보안 지적 S1 + ⑮(문구만). 재현율 편차·⑮ 엔진 보완·D38 재론·cleanup 범위 확대·1.3.2 비목표는 비목표 | 사용자 결정(2026-10-23 07:4x 「지금 1.3.3 트랙」) + 이 세션 Q2(⑮ 범위) |
| D53 | 경로 = **경량, 단 4단계 spec 적대검증은 유지**. 생략 = 5 plan·6 plan 적대검증(5 생략의 자동 귀결). 근거 = 접촉 표면 무신호, 그러나 ⑬ 판별 규칙이 새 설계라 spec 에서 codex 가 한 번 두드린다. 하한(spec·harden·impl 적대검증) 유지. ledger(spec) = 이 spec 말미 `## 적대검증 ledger (spec)`, ledger(impl) = 그 아래 | 사용자 지시로 메인이 추천안 입력(Q1) — 1.3.2 D36 선례 + 설계 폭 |
| D54 | ⑮ = SKILL.md §5 경로 감시 「한계」 문단(96자·`...`·잘린 명령 n건) + §8 터미널 요약 1줄. 리포트 헤더·엔진 보완 없음 | 사용자 지시로 메인이 추천안 입력(Q2) — 외부 플러그인, D47 정신 |
| D55 | ⑯ = Claude 검토자 프롬프트 「임시 파일은 W 아래에만」 + §5 `W/root-before.txt` 기록 → §8 자가 점검에서 scratchpad 루트·`mr-review/` 두 단계의 새 항목 **건수** 보고(삭제 안 함, cleanup 앞 · **이름은 출력하지 않음 — review-loop(spec) R6-2 보강, 추천 자동 채택(위임)**). cleanup 범위 확대·자동 삭제 기각 | 사용자 지시로 메인이 추천안 입력(Q3) — 루트에 사용자 파일 공존 |
| D56 | ⑭ = 둘 다 — `report.mjs` `cell()`(`|`→`\|`, 줄바꿈→공백, 의도 대조표·검사표) + SKILL.md §6-5 「`criterion` = 첫 칸(수용기준 칸) 원문」 | 사용자 지시로 메인이 추천안 입력(Q4) |
| D57 | ⑬ 판별 = zip 마다 **표지 우선**(접두 뗀 뒤 루트 `WEB-INF/`·`META-INF/` → WAR, 루트 `src/` → 소스), 표지 없을 때만 기대 목록 시험(불일치 0 인 배치가 정확히 하나). 접두 제거 = 래퍼 폴더 항목 외 모든 항목(폴더 포함 — review-loop(spec) R2-2 보강, 추천 자동 채택(위임) · 래퍼 폴더 항목은 버림 · 뗄 때마다 남은 이름 `notCanonical` 재검사, 걸리면 그 zip `corrupt` 대조 불가 — R3-1 보강, 추천 자동 채택(위임))이 같은 첫 폴더 공유 + 그 이름이 `src`·`WEB-INF`·`META-INF` 아님 + 어느 배치의 기대 경로 첫 조각과도 안 겹침(반복), `prefix` 기록. 작성자 표기·시험만 판별은 기각 | 사용자 지시로 메인이 추천안 입력(Q5) — zip 만 보고 설명 가능, 섞인 zip 을 조용히 받지 않음(1.3.2 (C) 기각 사유 유지) |
| D58 | ⑬ 모호 = 혼합(두 표지) → `layout_ambiguous` **대조 불가**. 표지 없음 + 시험 실패 → 어댑터 힌트 → 없으면 `source` 로 대조해 **불일치**(목록 노출). `layout_source` 기록. 전부 대조 불가·전부 source 는 기각 | 사용자 지시로 메인이 추천안 입력(Q6) — D34 우선순위 유지, 흔한 1건 누락은 작성자가 고칠 수 있게 |
| D59 | ⑬ 어댑터 키 `deployLayout` **유지, 의미 = 판별 못 할 때의 기본값(힌트)** — 시험 폴백·zip 없는 ④ 정규화에만. 표지가 힌트보다 우선. 값·형식·검증·기본값 불변. **1.3.2 D37(프로젝트별 고정) 변경**. 폐기·`"auto"` 추가는 기각 | 사용자 지시로 메인이 추천안 입력(Q7) — 기존 어댑터 무변경, WAR 프로젝트 삭제 전용 MR 보호 |
| D60 | ⑬ 다중 zip = **본문 zip 전부 합산**(없으면 댓글 마지막 1개). 기대 경로는 어느 zip 에서든 충족, 같은 zip 경로 다른 바이트 = `zip_conflict` 대조 불가(같으면 한 번 대조), 바이트 대조된 소스의 `.class` 는 `bytes_skipped` 제외, `comment_sha`·`download`·`corrupt` 는 zip 마다, ④ `L4` = 하나라도 WAR 면 WAR. `deploy.json.zip` 요약 유지 + `zips[]`. 마지막 1개·댓글 포함 합산은 기각. **보강(review-loop(spec) R1-2, 추천 자동 채택(위임))**: 합산 경로에도 `readZip` 의 대소문자·파일/폴더 충돌 검사를 zip 사이에 적용 → `zip_conflict` 대조 불가 | 사용자 지시로 메인이 추천안 입력(Q8) — 표본 (다), 낡은 댓글 zip 오탐 회피 |
| D61 | S1 = 접기 전 **head 트리 조회**(워크트리 — 역사상 후보(고정 5 — 3.S1-1 목록) + **`$` 경계 전부의 바깥 클래스 `.java`**(review-loop(spec) R1-1·R2-1 보강, 추천 자동 채택(위임))를 head 트리 목록(`git ls-tree -r -z` — NUL 구분, 인용 없음)과 **대소문자 무시**로 대조(R5-1 보강, 추천 자동 채택(위임) · `-z` 는 C1 감사 이의 A7·A8 재판정), 1.3.2 R2-2 테스트 둘째 픽스처는 head 에서 `Foo.java` 를 빼도록 정정(AC⑬-11 예외 — C1 감사 이의 A3·A8 재판정), 하나라도 있으면 `map_conflict` 대조 불가) · **diff-only 는 접지 않고 `map_conflict` 대조 불가**(D22 유지). GitLab 파일 API 조회·접기 규칙 폐기는 기각 | 사용자 지시로 메인이 추천안 입력(Q9) — fail-closed, D38·AC⑨-7·R4-2 워크트리 불변 |
| D62 | 이 세션(spec·harden)은 코드·테스트·SKILL.md·plan·README 를 수정하지 않는다. plan SC-2·SC-3·1.3.2 D37 부기·README 는 impl 트랙 몫 | 트랙 프롬프트 편집 범위(1.3.2 D42 방식) |

harden-spec(2026-10-23 08:1x~08:2x, 이 세션)에서 확정 — 판단 갭 5건 전부 사용자 지시로 메인이 추천안 입력.

| D | 결정 | 근거 |
|---|---|---|
| D63 | ⑬ zip 둘 이상일 때 주석 SHA(①) = **최소 한 zip** 이 head 와 일치하면 통과. 주석이 있는데 다른 zip = `comment_sha` 불일치, 주석 없는 zip = `zips[i].comment_sha = null` + 부록 A 「주석 없음」 표시만, 전부 없음·전부 다름 = 불일치 1건. zip 1개 = 현행 | 사용자 지시로 메인이 추천안 입력(갭 H-A) — class 판은 손으로 묶어 주석이 없는 관행, 소스판 주석이 head 를 증명 |
| D64 | ⑬ WAR 표지 = 루트 `WEB-INF/` **또는 `META-INF/`**. 소스 루트 `META-INF/` 프로젝트는 혼합(대조 불가)으로 수용 | 사용자 지시로 메인이 추천안 입력(갭 H-B) — `META-INF/context.xml` 만 든 WAR zip 도 표지로 잡힘 |
| D65 | ⑬ 서로 다른 배치로 같은 원본을 담은 두 zip 항목은 `zip_conflict` 가 아니라 **head 비교**(틀린 쪽만 `bytes`). `zip_conflict` 는 같은 zip 경로에만 | 사용자 지시로 메인이 추천안 입력(갭 H-C) — 작성자가 고칠 경로가 바로 보임 |
| D66 | ⑬ `zip_conflict` 는 존재 대조 항목(`.class`)에도 적용 — zip 끼리 같은 경로 다른 바이트면 대조 불가(D38 의 head 대조 생략은 불변) | 사용자 지시로 메인이 추천안 입력(갭 H-D) — 빌드 어긋남 신호, 규칙 하나 |
| D67 | ⑭ `criterion` = 수용기준·주장을 적은 첫 칸 원문, 첫 칸이 번호·ID 만이면 그 다음 칸. 행 전체 아님 | 사용자 지시로 메인이 추천안 입력(갭 H-E) — 번호는 `row` 에 있음 |

## 적대검증 ledger (spec)

보안 크리티컬: yes (호출자 지정) — 접촉면 zip 접두 제거·배치 판별(혼합 zip 수용 여부)·다중 zip 합산(충돌)·④ 정규화 배치 선택·S1 head 조회·표 셀 이스케이프

- 루프 = `/dev-workflow:review-loop --phase spec --security yes --auto-rounds 1 --base 486d5fe`(위임 모드) · base `486d5fe`(1.3.2 릴리스) · 예산 적대 5 · 확인 2 · 자동 1.
- **확인 임무 ③ 우선 감사 대상**: D52~D67 은 사용자 판정이 아니라 사용자 지시에 따른 메인 대리 입력이다 — 확인 첨부물 ⑥(감사 제외)에 넣지 않는다. 아래 `추천 자동 채택(위임)` 행도 같다.

| ID | fingerprint(파일 · 결함 · 권고) | severity | disposition | 근거 · 커밋 |
|---|---|---|---|---|
| R1-1 | spec §3.S1 · S1 head 조회 후보가 살아 있는 중간 바깥 클래스 소스(`Foo$Bar.java`)를 빠뜨려 `Foo$Bar$1.class` 삭제 지시가 `Foo.class` 로 접혀 「일치」 · `$` 경계마다 바깥 소스도 head 확인, INNER_MAX 유지, AC 추가 | high | FIXED `19d819b` (추천 자동 채택(위임)) | 즉시 ESCALATE(데이터 유실 · 1.3.2 내부 클래스 정규화 계열 반복) → 「경계마다 .java 확인」. 3.S1-1 후보 · 3.S1-3 호출 수 · AC-S1-5 · D61 보강 · 확인 임무 ③ 우선 감사 · **소멸 확인됨(C1)** |
| R1-2 | spec §3.⑬-4 · 다중 zip 합산이 같은 경로 다른 바이트만 충돌로 봐 zip 사이 대소문자·파일/폴더 충돌이 「일치」 · 합산 경로에도 `readZip` 충돌 검사 적용, AC 추가 | high | FIXED `19d819b` (추천 자동 채택(위임)) | 즉시 ESCALATE(배포 실패·파일 손실 · 경로 충돌/정규형 계열 인접) → 「합친 목록에도 충돌 검사」. 3.⑬-4 합산 경로 충돌 bullet · AC⑬-16 · D60 보강 · §4 · 확인 임무 ③ 우선 감사 · **소멸 확인됨(C1)** |
| R2-1 | spec §3.S1 · S1 후보가 접힐 바깥 클래스보다 짧은 살아 있는 바깥 소스(`Foo.java`)를 조회하지 않아 `Foo$Bar.java` → `Foo.java` 중첩 이동 MR 에서 `Foo$Bar$1.class` 삭제가 「일치」 · 모든 `$` 경계의 바깥 소스 조회, AC 추가 | high | FIXED `2045ccb` (추천 자동 채택(위임)) | **R1-1 과 같은 계열 2회째** → 계열 반복 규칙대로 즉시 ESCALATE(데이터 유실) → 「모든 `$` 경계 .java 확인」(head = MR 적용 트리라 지운 소스는 자연 제외 — R1-1 의 부분 목록을 전체 규칙으로 대체). 3.S1-1 · 3.S1-3 · AC-S1-5 문구 · AC-S1-6 · D61 보강 · 확인 임무 ③ 우선 감사 · **C1 blocking 재분류**(1.3.2 R2-2 테스트 불변 약속과 충돌 = C1-N2) → 감사 이의 A3 재판정 「규칙 유지 + 픽스처 정정 명시」(추천 자동 채택(위임)) → 재수정 `f1ac7a9` · 미확인 FIXED 큐 재편입 · **소멸 확인됨(C2)** |
| R2-2 | spec §3.⑬-2 · 접두 제거가 폴더 항목(래퍼 `app/` → 빈 이름, 접두 밖 빈 폴더 `other/`)의 처리를 정의하지 않음 · 래퍼 폴더 항목은 버리고 접두 아래 항목만 변환, 접두 밖 폴더·정규형·AC 명시 | medium | FIXED `2045ccb` (추천 자동 채택(위임)) | 경로 변환 계열(1.3.2 경로 정규형 인접) → ESCALATE → 「폴더도 조건에 넣고 래퍼는 버림」(접두 밖 항목이 있으면 떼지 않음 — fail-closed). 3.⑬-2 · 3.⑬-3 문구 · AC⑬-10 보강 · D57 보강 · 확인 임무 ③ 우선 감사 · **소멸 확인됨(C1)** |
| R3-1 | spec §3.⑬-2 · 반복 접두 제거가 `app/C:/…` 에서 드러난 드라이브 접두 `C:/` 까지 떼어 `readZip` 의 드라이브 접두 거부를 우회, 「일치」 · 뗄 때마다 남은 이름에 notCanonical 재검사·실패면 대조 불가, AC 추가 | high | FIXED `e39a13c` (추천 자동 채택(위임)) | **1.3.2 경로 정규형 계열(R4-1·R5-1) 반복** → 즉시 ESCALATE → 「뗄 때마다 정규형 재검사」(실패 = 그 zip `corrupt` 대조 불가). 3.⑬-2 · AC⑬-10 보강 · D57 보강 · 확인 임무 ③ 우선 감사 · **소멸 확인됨(C1)** |
| R3-2 | spec §3.⑭-1 · `cell()` 의 줄바꿈 평탄화가 `fieldMask` 뒤라 `run --password⏎x` 가 `--password x` 가 되어 최종 마스킹이 행의 결과·위치·칸 구분자를 먹음 · 평탄화를 fieldMask 앞으로, `\|` 이스케이프는 뒤, AC 추가 | medium | FIXED `e39a13c` (루프 판정) | 수정 방향 하나(순서 명시)라 루프 FIXED — 3.⑭-1 순서 문단 · AC⑭-5 · §4 · **소멸 확인됨(C1)** |
| R4-1 | spec §3.⑭-1 · R3-2 의 「평탄화 먼저」 순서가 잘린 PEM 규칙(BEGIN 뒤 줄바꿈으로 본문 인식)을 무력화해 키 본문이 리포트에 남음 · 원문 마스킹 → 평탄화 → 재마스킹 → `\|` 이스케이프, 잘린 PEM AC 추가 | high | FIXED `7ccc772` (추천 자동 채택(위임)) | **R3-2 와 같은 계열(마스킹 순서) 2회째** → 계열 반복 규칙대로 즉시 ESCALATE(보안 — 비밀값 노출) → 「가림→펴기→다시 가림→\| 처리」. 3.⑭-1 순서 문단 · AC⑭-5 보강 · §4 · R3-2 의 수정을 대체(R3-2 는 큐 유지 — 재마스킹 ③ 이 그 재현을 막는지 확인 대상) · 확인 임무 ③ 우선 감사 · **소멸 확인됨(C1)** |
| R5-1 | spec §3.S1 · S1 head 조회가 대소문자까지 같은 경로만 찾아, 대소문자 무시 배포 FS 에서 본문 `Foo$X.class` 삭제가 살아 있는 `Foo$x.class` 를 지우는데 「일치」 · 후보를 head 실제 경로와 대소문자 무시로도 대조, AC 추가 | high | FIXED `a523696` (추천 자동 채택(위임)) | **S1 후보 계열 3회째(R1-1·R2-1)** → 계열 반복 규칙대로 즉시 ESCALATE(데이터 유실) → 「대소문자 무시로도 조회」(head 트리 목록 1회 캐시·소문자 비교). 3.S1-1·3.S1-3 · AC-S1-7 · D61 보강 · §4 · 확인 임무 ③ 우선 감사 · **C1 blocking 재분류**(head 목록의 경로 인용 = C1-N1) → 감사 이의 A7 재판정 「규칙 유지 + `-z` 로 읽기」(추천 자동 채택(위임)) → 재수정 `f1ac7a9` · 미확인 FIXED 큐 재편입 · **소멸 확인됨(C2)** |
| C1-N1 | spec §3.S1-1 · S1 head 목록 `git ls-tree -r --name-only` 가 `core.quotePath` 기본값에서 비ASCII 경로를 인용·8진수로 출력해 대소문자 무시 비교가 어긋남 · `-z` NUL 구분 읽기, 비ASCII AC | high | FIXED `f1ac7a9` (추천 자동 채택(위임) — 감사 이의 A7 재판정) | S1 계열 4회째 · R5-1 재수정과 한 건 · 3.S1-1 · AC-S1-7 비ASCII · D61 보강 · 확인 임무 ③ 우선 감사 · **소멸 확인됨(C2)** |
| C1-N2 | spec AC⑬-11 · 「기존 테스트 전부 불변」 약속이 1.3.2 R2-2 테스트 둘째 픽스처(head 에 `Foo.java` 생존)와 새 S1 규칙에서 충돌 · 픽스처 변경 범위 명시, 불변 약속 정정 | medium | FIXED `f1ac7a9` (추천 자동 채택(위임) — 감사 이의 A3 재판정) | R2-1 재수정과 한 건 · AC⑬-11 예외 1건 · §4 · D61 보강 · 확인 임무 ③ 우선 감사 · **소멸 확인됨(C2)** |
| R6-1 | spec §3.⑭-1 · 셀 평탄화 패턴 `\r?\n` 이 단독 CR 을 남겨 마크다운이 줄 경계로 읽고 표·실행 블록 코드펜스가 깨지며 가짜 제목이 끼어듦 · `\r\n\|\r\|\n` 으로 확장, 회귀 AC | medium | FIXED `1c54364` (추천 자동 채택(위임)) | **⑭ 셀 정규화 계열 3회째(R3-2·R4-1)** → ESCALATE → 「단독 \r 도 줄바꿈으로 편다」. 3.⑭-1 · AC⑭-5 보강 · 확인 임무 ③ 우선 감사 · **C2 blocking 재분류**(단독 CR 평탄화는 ② 단계뿐이라 ① 원문 마스킹이 단독 CR 뒤 잘린 PEM 본문을 이미 놓침 = C2-N1) → 감사 이의 B4 재판정 「R6-1 유지 + 위 보강」(추천 자동 채택(위임)) → 재수정 `e2f948e` · 미확인 FIXED 큐 재편입 · **소멸 확인됨(C3)** |
| R6-2 | spec §3.⑯-2 · W 밖 새 항목 이름 보고가 「어댑터 마스킹」만 요구하고 셸 비교 경로엔 엔진 비밀값 가림 수단이 없어 `tmp-token=…` 같은 이름이 로그에 남음 · 엔진+어댑터 가림 적용 또는 이름 미출력 | medium | FIXED `1c54364` (추천 자동 채택(위임)) | 설계 선택지 2(코드로 가림 / 건수만) → ESCALATE → 「이름 대신 건수만 보고」(D55 「코드 변경 없음」 유지). 3.⑯-2 · G5 문구 · D55 보강 · AC⑯-2 · §6 · 확인 임무 ③ 우선 감사 · **소멸 확인됨(C2)** |
| C2-N1 | spec §3.⑭-1 · 마스킹 입구 `maskTextWithCounts`(`pack.mjs:331`)가 `\r\n` 만 LF 로 바꿔 BEGIN 뒤 단독 CR 이면 잘린 PEM 본문이 ①·③·최종 마스킹 모두에서 남음(1.3.2 현행 모든 마스킹 경로 공통) · ① 전에 단독 CR 도 LF 로 통일, AC 추가 | high | FIXED `e2f948e` (추천 자동 채택(위임)) | **재진입 확인(C2) blocking → 규칙상 ESCALATE** · ⑭ 마스킹 계열 4회째 → 「마스킹 엔진에서 단독 CR 도 LF 로」(범위에 `pack.mjs` 입구 한 줄 + `pack.test.mjs` 추가 — §2·§4 명시). 3.⑭-1 ① 전제 · AC⑭-5 · 확인 임무 ③ 우선 감사 · **소멸 확인됨(C3)** |

**라운드 기록**

| 라운드 | HEAD | verdict | 신규 (c/h/m) | score(전환용) | 미확인 FIXED 큐 |
|---|---|---|---|---|---|
| R1 적대 | `f29ff51` | needs-attention | 0/2/0 | 6 | 0 → 2 (R1-1·R1-2) |
| R2 적대 | `3b8a703` | needs-attention | 0/1/1 | 4 | 2 → 4 (+R2-1·R2-2) · R1-1·R1-2 적대 비재출현(R2) — 큐 유지 |
| R3 적대 | `a0fc645` | needs-attention | 0/1/1 | 4 | 4 → 6 (+R3-1·R3-2) · R1-1·R1-2·R2-1·R2-2 적대 비재출현(R3) — 큐 유지 |
| R4 적대 | `f1c1e70` | needs-attention | 0/1/0 | 3 | 6 → 7 (+R4-1) · 나머지 6건 적대 비재출현(R4) — 큐 유지 |
| R5 적대 | `ed4c22c` | needs-attention | 0/1/0 | 3 | 7 → 8 (+R5-1) · 나머지 7건 적대 비재출현(R5) — 큐 유지 |
| C1 확인 | `72d5969` | fail | 신규 0/1/1(C1-N1·N2) · 재분류 2(R2-1·R5-1) | — | 8 → 소멸 6 · 잔여 2(R2-1·R5-1 재수정) + 신규 2 = 4 |
| R6 복귀 적대 | `e18c740` | needs-attention | 0/0/2 | 2 | 4 → 6 (+R6-1·R6-2) · R2-1·R5-1·C1-N1·C1-N2 적대 비재출현(R6) — 큐 유지 |
| C2 재진입 확인(예약분) | `bec944d` | fail | 신규 0/1/0(C2-N1) · 재분류 1(R6-1) | — | 6 → 소멸 5 · 잔여 1(R6-1 재수정) + 신규 1 = 2 |
| C3 확인 | `eae2be3` | pass | 0/0/0 | 0 | 2 → 0 |

- score 산식 = 수정 전 스냅샷 · 미확인 FIXED 큐 제외(review-loop §blocking score). 보안 트랙이라 신호 1(정체)은 무시한다.
- **적대 예산 소진(R5 — 5/5) → 전환 신호 3**. batch 적재 0건(flush 없음) → 확인 모드 진입(확인 예산 2). 미확인 FIXED 큐 8건(R1-1·R1-2·R2-1·R2-2·R3-1·R3-2·R4-1·R5-1) · 추천 자동 채택(위임) 7건 + D52~D67(메인 대리 입력) = 확인 임무 ③ 우선 감사 · 루프 판정 FIXED 1건(R3-2 — R4-1 이 순서를 대체).
- **C1(확인 1/2, 완전 응답)**: 소멸 확인 = R1-1·R1-2·R2-2·R3-1·R3-2·R4-1 · blocking 재분류 = R2-1·R5-1 · 신규 = C1-N1(high)·C1-N2(medium) · 감사 = A1(R1-1)·A2(R1-2)·A4(R2-2)·A5(R3-1)·A6(R4-1) 이상 없음, **A3(R2-1)·A7(R5-1)·A8(D61) 이의** → `[감사 이의]` 재질문 3건 → 셋 다 「규칙 유지 + 보완」(TUI 답 = 메인 대리 — 사용자 지시 「추천안으로 대신 답해줘」 범위, 출처 추천 자동 채택(위임)) → 재수정 `f1ac7a9` · D52~D67 중 D61 외 이상 없음 · verdict fail. → **복귀**(상한 1회 사용): 복귀 적대 1(R6, 상한 밖) + 재진입 확인 1(C2, 상한 밖 예약분). 미확인 FIXED 큐 = R2-1·R5-1·C1-N1·C1-N2(4).
- **R6(복귀 적대 — 상한 밖, 적대 소진 5 불변)**: medium 2(R6-1·R6-2) → ESCALATE 2건 → 추천 자동 채택(위임) → `1c54364`. 다음 = **C2 재진입 확인(상한 밖 예약분)** — 미확인 FIXED 큐 6건(R2-1·R5-1·C1-N1·C1-N2·R6-1·R6-2) · 감사 = A3·A7·A8 재판정 3건 + R6-1·R6-2 채택 2건. C2 가 또 blocking 을 내면 ESCALATE(+ 새 세션 whole-branch 리뷰 권고).
- **C2(재진입 확인 — 상한 밖 예약분, 완전 응답)**: 소멸 확인 = R2-1·R5-1·C1-N1·C1-N2·R6-2 · blocking 재분류 = R6-1 · 신규 = C2-N1(high) · 감사 = B1(A3)·B2(A7)·B3(A8)·B5(R6-2) 이상 없음, **B4(R6-1) 이의** · C1 소멸 6건 재출현 없음 · verdict fail → 재진입 확인 blocking 이라 **ESCALATE**(+ `[감사 이의]` B4) → 둘 다 추천 자동 채택(위임) → `e2f948e`. 확인 예산 = 소진 1/2 → 남은 일반 확인 1회(C3)로 큐 2건(R6-1·C2-N1)·감사 2건 확인. **권고: 재진입 확인에서도 blocking 이 나온 만큼 edge 표면이 넓다 — impl 단계 review-loop(impl) 에서 마스킹·S1 접촉면을 우선 확인 항목으로 둘 것(새 세션 whole-branch 리뷰 권고에 갈음).**
- **C3(확인 2/2, 완전 응답)**: 소멸 확인 = R6-1·C2-N1 · 감사 = E1(C2-N1 채택)·E2(B4 재판정) 이상 없음 · 신규 없음 · 이전 소멸 항목 재출현·회귀 없음 · verdict **pass**.

**종결(2026-10-23)**: review-loop(spec) 성공 종료 — 적대 5(예산 소진) + 복귀 적대 1 · 확인 3(C1·C3 일반 2/2 + C2 재진입 예약분) · FIXED 13(R1-1·R1-2·R2-1·R2-2·R3-1·R3-2·R4-1·R5-1·C1-N1·C1-N2·R6-1·R6-2·C2-N1, 전부 소멸 확인) · ACCEPTED·DEFERRED_TO_IMPL·OUT_OF_SCOPE·DUPLICATE 0 · low 0 · 추천 자동 채택(위임) 14건(대장 #1~#14, 감사 미수행 0 — 감사 이의 4건(A3·A7·A8·B4)은 재판정으로 닫음) · D52~D67 감사 = D61 만 이의(A8 → 보강), 나머지 이상 없음 · 미확인 FIXED 큐 0 · 미판정 blocking 0 · 최종 verdict pass(C3). **impl 인계**: ① 마스킹(⑭ 셀 순서 ①~④ · `pack.mjs` 입구 단독 CR)과 S1 head 조회(`$` 경계 전부 · `-z` · 대소문자 무시)는 같은 계열이 3~4회 재지목된 접촉면이다 — review-loop(impl) 에서 우선 확인 항목으로 둘 것 ② 1.3.2 R2-2 테스트 둘째 픽스처 정정(AC⑬-11 예외)은 impl 이 할 일 ③ 범위에 `pack.mjs` 한 줄 + `pack.test.mjs` 추가(§2·§4).

## 적대검증 ledger (impl)

보안 크리티컬: yes (호출자 지정) — 접촉면 zip 해석·배치 판별·접두 제거·다중 zip 합산(경로 정규형·`..`·드라이브 접두·대소문자/파일-폴더 충돌) · S1 head 조회 · 마스킹 경계(⑭·`pack.mjs`) · ⑯ 자가 점검(W 밖 항목 이름 비노출)

- 루프 = `/dev-workflow:review-loop --phase impl --security yes --auto-rounds 1 --base 486d5fe`(위임 모드) · base `486d5fe`(486d5feddda7f8b97dcdbba80d554b146a852be0 — 1.3.2 릴리스 = 구현 착수 직전, SC-7 `<base>`, origin/main 과 같음) · branch = 트랙 워크트리 브랜치 `…/mr-review-1-3-3-fixes`(오르카 워크트리) · 착수 HEAD `42fe07a` · 예산 적대 5 · 확인 2 · 자동 1 · 입도 = 통합 1회(plan 생략 트랙 — ledger 는 spec 말미).
- 사전 게이트(SC-7, HEAD `42fe07a`): T1 `node --test tests/mr-review/*.test.mjs` 221/221 · T2 0 · T3 56/56 · T4 0 · T5 0 · T6 0(skills·tests 전체 0 · README·spec·plan 추가 줄 0) · T7 0 · 대장 확인 대기 0(#1~#14 확인됨) · 승계 미확인 FIXED 0 · codex companion 1.0.6.
- **우선 확인 항목(spec ledger 종결 행 impl 인계 ①)**: 마스킹(⑭ 셀 순서 ①~④ · `pack.mjs` 입구 단독 CR)과 S1 head 조회(`$` 경계 전부 `.java` · `git ls-tree -r -z --name-only` · 대소문자 무시 · diff-only 대조 불가) — 적대 focus 첫머리. 이 계열이 이 루프에서 다시 반복되면 즉시 ESCALATE.
- **impl 트랙 판단(빌더 결정 — 재론하지 않되 결함이면 finding)**: ③ 대조 못 한 zip 이 하나라도 있으면 「zip 에 없음」 계산 생략 ④ S1 `$` 로 시작하는 이름(`$Foo$1.class`) 위치 0 경계 결함 직접 수정 ⑤ 같은 링크 중복 = secret + 파일명 · 접두 못 떼는 이름(`src`·`WEB-INF`·`META-INF`) 비교는 대소문자 무시 · 배치 표지 판별은 정확 일치 ⑥ SKILL.md 셸 블록 실측 bash 만(spark2 에 zsh 없음). RED 없이 들어간 가드 테스트 2건(⑬-12 요약 문구 · ⑯-3). 판단 ①②는 spec 문구와 달라 아래 I-1·I-2 로 닫았다.
- **확인 임무 ③ 우선 감사 대상**: 아래 `추천 자동 채택(위임)` 행 전부(확인 첨부물 ⑥ 에 넣지 않는다).

| ID | fingerprint(파일 · 결함 · 권고) | severity | disposition | 근거 · 커밋 |
|---|---|---|---|---|
| I-1 | spec §3.⑬-1 · zip 저장 경로 「항상 `<순번>-<이름>`」 문구가 AC⑬-11(1.3.2 테스트 `W/zip/d.zip` 단언 불변)과 충돌, impl 은 2개 이상일 때만 순번 · spec 문구를 구현에 맞춤 | medium | ACCEPTED (추천 자동 채택(위임)) | 구현 유지(덮어쓰기 방지 목적은 그대로 달성 · plan SC-3 이 이미 같은 문구) — spec 3.⑬-1·§4 정정 `8717e3b`. 보완 단계 = 없음(문서 정합) · 확인 임무 ③ 우선 감사 |
| I-2 | spec AC⑬-10·§3.⑬-6 · `entries` 에 폴더 항목(`WEB-INF/`)을 넣는 것처럼 읽히는 문구가 1.3.2 계약(파일 항목만)과 다름 — 넣으면 「zip 에만 있음」 오탐 · spec 문구를 「파일 항목만」으로 | medium | ACCEPTED (추천 자동 채택(위임)) | 구현 유지(1.3.2 `deploy.mjs:326-327` · plan SC-3 과 같음) — spec AC⑬-10·3.⑬-6 정정 `8717e3b`. 보완 단계 = 없음 · 확인 임무 ③ 우선 감사 |
| R1-1 | `deploy.mjs` ③ 항목별 대조 · 다중 zip 의 같은 경로·같은 바이트 중복은 뒤 zip 항목을 `handled` 로 건너뛰어 유형 검사까지 생략 — 일반 파일 + 같은 바이트 심볼릭 링크면 「일치」(AC⑨-9 우회) · 모든 항목 유형 검사 후 바이트 대조만 중복 제거, 양쪽 순서 회귀 테스트 | high | FIXED `ebc6a86` (루프 판정) | 수정 방향 하나(AC⑨-9 복원 — AC·D 변경 없음)라 루프 FIXED. 중복 항목도 `exists`·`bytes` 양쪽 유형 검사(워크트리 git 유형 · diff-only 일반 파일) 후 바이트만 생략 · 테스트 4 케이스(.class·소스 × 순서) RED→GREEN |
| R1-2 | `deploy.mjs` S1 `headHit` · `$` 경계 후보가 `indexOf('$', 1)`·`k > 0` 로 위치 0 을 빼 `$Foo$1.class` 의 빈 바깥 이름 후보 `<dir>/.java` 를 조회하지 않음(spec 「경계 전부」와 다름) · 위치 0 포함, 테스트 | medium | FIXED `61333d0` (추천 자동 채택(위임)) | **S1 후보 계열 5회째(spec R1-1·R2-1·R5-1·C1-N1)** → 계열 반복 규칙대로 즉시 ESCALATE(데이터 유실) → 「맨 앞자리도 후보에 넣는다」. 3.S1-1 문구 보강 · AC-S1-6 테스트 보강(`.java` 있음 → 대조 불가 · 없음 → 일치) · 확인 임무 ③ 우선 감사. 참고: R1 focus 의 「위치 0 포함」은 루프가 impl 판단 ④를 잘못 옮긴 문구였으나 spec 문면도 「경계 전부」라 finding 은 성립 |
| R2-1 | `deploy.mjs` 다중 zip 같은 경로 비교 · 같은 경로 항목의 풀린 버퍼를 zip 수만큼 `bufs` 에 쌓아 작은 압축 zip 여러 개로 메모리 고갈 · 기준·현재 버퍼만 유지하며 즉시 비교 | medium | FIXED `ddd7767` (루프 판정) | 수정 방향 하나라 루프 FIXED. 메모리 특성이라 RED 재현 불가 — zip 3개 동작 가드 테스트(기준 = 첫 zip, 다른 쪽만 `zip_conflict`) 추가 |
| R2-2 | `deploy.mjs` 다중 zip 수집 · (R2-1 권고 후반) 본문 zip 개수·총 다운로드량 상한이 없어 큰 zip 다수면 받은 크기만큼 메모리 사용 · 전체 작업량 상한 → 초과 시 대조 불가 | medium | ACCEPTED (추천 자동 채택(위임)) | 증폭 경로(R2-1)는 닫힘 — 남은 것은 실제 업로드 크기에 비례하는 사용량이고 실패해도 리포트가 안 나올 뿐 틀린 「일치」 없음(fail-closed). 상한은 spec 에 없는 새 규칙. **보완 단계 = 9 릴리스 실측에서 문제가 보이면 별도 트랙**(§6 수용된 한계 1줄) · 확인 임무 ③ 우선 감사 |
| R3-1 | `deploy.mjs` zip 사이 충돌 검사 · 같은 키 항목을 모든 zip 쌍마다 `zip_conflict` 로 쌓고 `push` 가 매번 목록 전체를 훑어, 작은 zip 다수로 기록 O(n²)·연산 O(n⁴) 증폭(192 zip 36KB → 9,216건) · 경로 키마다 대표 1건 · 중복 판정 집합 | medium | FIXED `1c47965` (추천 자동 채택(위임)) | **R2-1·R2-2 와 같은 계열(다중 zip 자원 증폭) 2회째** → 계열 반복 규칙대로 ESCALATE(보안 — 가용성) → 「경로마다 충돌 1건으로 묶는다」. (가)·(나) 두 검사 모두 키마다 1건 · `push` 는 쌓인 항목을 집합으로 따라잡아 대조 · 3.⑬-4 문구 1줄 · 테스트(zip 8개 — (가)·(나) 각 1건) RED→GREEN · 확인 임무 ③ 우선 감사 |
| R4-1 | `deploy.mjs` `stripPrefix` · 반복마다 남은 이름 전체를 split·notCanonical 로 다시 분해해 깊이 D·항목 E 에 O(E×D²) — 64KB zip(`a/` 16,000단)으로 3.6초·32,000단 13.1초 · 한 번 분해·선형 검사, 깊은 경로 회귀 | medium | FIXED `e37e934` (추천 자동 채택(위임)) | **다중 zip·zip 해석 자원 증폭 계열 3회째(R2-1·R2-2·R3-1)** → ESCALATE(보안 — 가용성) — 같은 꼴(깊이²)이 `readZip` 경로 충돌 검사(1.3.2)·zip 사이 충돌 (나)(R3-1)에도 있음을 확인 → 「깊이 상한 + 접두 제거 한 번 분해」: `zipName` 64 조각 초과 거부(corrupt — 대조 불가, 세 곳 모두 묶임) · `stripPrefix` 이름 1회 분해(드러난 맨 앞 조각만 재검사 — R3-1 의미 불변) · 3.⑬-2 · **AC⑬-17 신설** · plan SC-3 `corrupt` detail 1줄 · 테스트(65 조각 거부 · 64 판독 · `app/` 40단 접두 일치) RED→GREEN · 확인 임무 ③ 우선 감사 |
| R5-1 | `deploy.mjs` zip 사이 충돌 (가) · 충돌 없는 같은 키(같은 이름 파일·공통 폴더)도 모든 zip 쌍을 끝까지 비교해 O(P·N²) — 242B zip 6,400개로 `clash()` 4,095만 회 · 한 번 순회 판별, 선형 회귀 | medium | FIXED `b78682d` (추천 자동 채택(위임)) | **자원 증폭 계열 4회째(R2-1·R2-2·R3-1·R4-1)** → ESCALATE(보안 — 가용성) → 「첫 항목과만 비교」: 한 zip 안 같은 키는 `readZip` 이 거부하므로 목록 항목은 모두 다른 zip 것 — 첫 항목이 누구와도 충돌하지 않으면 나머지는 전부 폴더이거나 전부 같은 이름 파일이라 충돌 없음(출력 동일, 새 규칙 없음). 출력 동일이라 RED 불가 — 뒤쪽 충돌(폴더 둘 뒤 파일) 가드 테스트. 루프 점검: 다중 zip 반복문의 남은 비용 = 항목 수 선형(깊이 ≤ 64) + zip 수 × 기대 목록 크기(배치별 기대 사상 — 두 입력의 곱, 증폭 아님) · 확인 임무 ③ 우선 감사 |

**라운드 기록**

| 라운드 | HEAD | verdict | 신규 (c/h/m) | score(전환용) | 미확인 FIXED 큐 |
|---|---|---|---|---|---|
| R1 적대 | `02832e7` | needs-attention | 0/1/1 | 4 | 0 → 2 (R1-1·R1-2) |
| R2 적대 | `2e93367` | needs-attention | 0/0/1 | 1 | 2 → 3 (+R2-1) · R1-1·R1-2 적대 비재출현(R2) — 큐 유지 |
| R3 적대 | `1992b41` | needs-attention | 0/0/1 | 1 | 3 → 4 (+R3-1) · R1-1·R1-2·R2-1 적대 비재출현(R3) — 큐 유지 |
| R4 적대 | `3ae0d40` | needs-attention | 0/0/1 | 1 | 4 → 5 (+R4-1) · R1-1·R1-2·R2-1·R3-1 적대 비재출현(R4) — 큐 유지 |
| R5 적대 | `22ac8fa` | needs-attention | 0/0/1 | 1 | 5 → 6 (+R5-1) · R1-1·R1-2·R2-1·R3-1·R4-1 적대 비재출현(R5) — 큐 유지 |
| C1 확인 | `041490c` | pass | 0/0/0 | — | 6 → 0 (소멸 6) |

- score 산식 = 수정 전 스냅샷 · 미확인 FIXED 큐 제외(review-loop §blocking score). 보안 트랙이라 신호 1(정체)은 무시한다.
- R1 응답 뒤 적대 소진 1 = auto-rounds → batch flush(적재 0건) → 정밀 모드. ESCALATE 는 R1-2(S1 계열 5회째) · R2-2(보안 트레이드오프) · R3-1·R4-1·R5-1(다중 zip·zip 해석 **자원 증폭 계열** 2~4회째 — R4-1 에서 같은 꼴 세 곳을 묶는 구조 선택지(깊이 상한)로 닫음, R5-1 은 남은 쌍 비교) — 전부 위험군이라 질문, 답은 메인 TUI 대리(사용자 지시 「추천안으로 대신 답해줘」 2026-10-23 08:10) = 출처 추천 자동 채택(위임).
- **적대 예산 소진(R5 — 5/5) → 전환 신호 3**. batch 적재 0건 → 확인 모드(확인 예산 2). 미확인 FIXED 큐 6건(R1-1·R1-2·R2-1·R3-1·R4-1·R5-1) · 감사 대상 9건(I-1·I-2·R1-1·R1-2·R2-1·R2-2·R3-1·R4-1·R5-1 — 위임 채택 7건 우선).
- **C1(확인 1/2, 완전 응답)**: 소멸 확인 = R1-1·R1-2·R2-1·R3-1·R4-1·R5-1 · 감사 9건 이상 없음 · 회귀 없음(`stripPrefix` 재작성의 R3-1 드라이브 접두 재검사 의미 보존 확인) · 신규 없음 · verdict **pass**.

**종결(2026-10-23)**: review-loop(impl) 성공 종료 — 적대 5(예산 소진) · 확인 1(C1) · 복귀 미사용 · FIXED 6(R1-1·R1-2·R2-1·R3-1·R4-1·R5-1, 전부 소멸 확인 — 코드 `ebc6a86`·`61333d0`·`ddd7767`·`1c47965`·`e37e934`·`b78682d`) · ACCEPTED 3(I-1·I-2·R2-2) · DEFERRED_TO_IMPL·OUT_OF_SCOPE·DUPLICATE 0 · low 0 · 추천 자동 채택(위임) 7건(대장 #15~#21, 감사 미수행 0 — C1 감사 이의 0) · AC 33 → 34(AC⑬-17 신설) · 미확인 FIXED 큐 0 · 미판정 blocking 0 · 최종 verdict pass(C1). 최종 게이트(SC-7, BASE `486d5fe`): T1 225/225 · T2 0 · T3 56/56 · T4 0 · T5 0 · T6 0 · T7 0. **릴리스 인계**: ① 대장 #15~#21 사용자 확인 ② §6 수용된 한계에 R2-2(zip 개수·총량 상한 없음) 추가 — 9단계 실측에서 문제가 보이면 별도 트랙 ③ zip 항목 이름 64 조각 상한(AC⑬-17)은 표본 MR 재실행(AC⑬-14)에서 정상 zip 이 걸리지 않는지 함께 본다.

## 확인 대기 대장

| # | 일시 | phase·지점 | 질문 요지(쉬운 말 1줄) | 채택 선택지 | 출처 | 상태 |
|---|---|---|---|---|---|---|
| (spec·harden 단계 — 수동 모드. 질문 14건(설계 9 + harden 5)은 사용자 지시 「추천안으로 대신 답해줘」(2026-10-23 08:10)에 따라 메인이 추천안을 입력했고 그 출처는 위 D52~D67 에 적었다 — 대기 0건) | | | | | | |
| 1 | 2026-10-23 08:5x | spec · R1 즉시 ESCALATE | 내부 클래스의 내부 클래스(`Foo$Bar$1.class`)를 접을 때 살아 있는 중간 클래스 `Foo$Bar.java` 도 확인할까 (R1-1) | 경계마다 .java 확인 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 2 | 2026-10-23 08:5x | spec · R1 즉시 ESCALATE | zip 을 나눠 담아 생기는 대소문자·파일/폴더 충돌도 합친 목록에서 검사할까 (R1-2) | 합친 목록에도 충돌 검사 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 3 | 2026-10-23 09:0x | spec · R2 즉시 ESCALATE | 내부 클래스를 접을 때 더 짧은 바깥 클래스 소스(`Foo.java`)까지 `$` 경계 전부를 확인할까 (R2-1) | 모든 '$' 경계 .java 확인 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 4 | 2026-10-23 09:0x | spec · R2 ESCALATE(계열) | zip 접두 폴더를 뗄 때 폴더 항목도 조건에 넣고 래퍼 폴더는 버릴까 (R2-2) | 폴더도 조건에 넣고 래퍼는 버림 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 5 | 2026-10-23 09:0x | spec · R3 즉시 ESCALATE | zip 접두 폴더를 뗄 때마다 남은 이름이 정상 경로 꼴인지 다시 검사해 드라이브 접두(`C:/`) 숨김을 막을까 (R3-1) | 뗄 때마다 정규형 재검사 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 6 | 2026-10-23 09:1x | spec · R4 즉시 ESCALATE | 표 칸의 줄바꿈 처리 순서를 「원문 가림 → 공백으로 펴기 → 다시 가림 → `\|` 처리」로 바꿔 잘린 비밀키 본문 노출을 막을까 (R4-1) | 가림→펴기→다시 가림→\| 처리 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 7 | 2026-10-23 09:2x | spec · R5 즉시 ESCALATE | 살아 있는 파일 삭제 막기(S1)의 head 조회를 대소문자 무시로도 할까 (R5-1) | 대소문자 무시로도 조회 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 8 | 2026-10-23 09:2x | spec · C1 감사 이의 재판정(A3) | S1 「`$` 경계 전부 조회」를 유지하고, 그와 부딪히는 1.3.2 R2-2 테스트는 픽스처를 고쳐(head 에서 `Foo.java` 제외) 맞출까 (R2-1·C1-N2) | 규칙 유지 + 테스트 픽스처 정정 명시 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 9 | 2026-10-23 09:2x | spec · C1 감사 이의 재판정(A7) | S1 의 head 파일 목록을 인용 없는 NUL 구분(`-z`)으로 읽어 한글 경로도 비교되게 할까 (R5-1·C1-N1) | 규칙 유지 + NUL 구분 출력(-z)으로 읽기 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 10 | 2026-10-23 09:2x | spec · C1 감사 이의 재판정(A8) | 메인 대리 결정 D61 은 유지하고 위 두 보강을 D61 행에 적을까 (D61) | D61 유지 + 보강 문구 추가 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 11 | 2026-10-23 09:3x | spec · R6 ESCALATE(계열) | 표 칸 줄바꿈 펴기에 단독 `\r`(옛 맥 줄바꿈)도 넣어 리포트 구조 조작을 막을까 (R6-1) | 단독 \r도 줄바꿈으로 편다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 12 | 2026-10-23 09:3x | spec · R6 ESCALATE(선택지 2) | 검토자가 W 밖에 남긴 새 항목은 이름 대신 건수만 보고할까 — 이름 속 비밀값 노출 방지 (R6-2 · 목표 G5 문구 변경 포함) | 이름 대신 건수만 보고 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 13 | 2026-10-23 09:4x | spec · C2 재진입 확인 ESCALATE | 단독 CR 뒤 잘린 비밀키 본문이 안 가려지는 구멍을 마스킹 엔진 입구(`pack.mjs` 한 줄)에서 막을까 — 범위에 pack.mjs 추가 (C2-N1) | 마스킹 엔진에서 단독 CR도 LF로 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 14 | 2026-10-23 09:4x | spec · C2 감사 이의 재판정(B4) | 표 칸 단독 CR 펴기(R6-1)는 유지하고 첫 마스킹 전 CR 처리를 위 보강으로 맞출까 (R6-1) | R6-1 유지 + 위 보강을 따름 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 15 | 2026-10-23 10:3x | impl · 루프 시작 전 판정(impl 판단 ①) | zip 저장 이름의 순번은 zip 이 2개 이상일 때만 붙이는 구현을 그대로 두고 spec 문구를 고칠까 (I-1) | 구현대로 두고 spec 문구 고침 (ACCEPTED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 16 | 2026-10-23 10:3x | impl · 루프 시작 전 판정(impl 판단 ②) | deploy.json 의 zip 항목 목록(entries)은 파일만 넣는 구현을 그대로 두고 spec 문구를 고칠까 (I-2) | 구현대로 파일만, spec 문구 고침 (ACCEPTED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 17 | 2026-10-23 10:3x | impl · R1 즉시 ESCALATE | 살아 있는 파일 삭제 막기(S1)에서 `$` 로 시작하는 이름의 맨 앞자리 경계(빈 바깥 이름 `.java`)도 head 에서 확인할까 (R1-2) | 맨 앞자리도 후보에 넣는다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 18 | 2026-10-23 10:4x | impl · R2 ESCALATE(보안 트레이드오프) | 본문 zip 개수·총량 상한 없이 둘까 — 큰 zip 이 아주 많으면 메모리 부족으로 리포트 없이 멈춤(틀린 일치는 없음) (R2-2) | 알고도 둔다 (ACCEPTED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 19 | 2026-10-23 10:5x | impl · R3 ESCALATE(계열 2회째·보안) | zip 여러 개 사이의 대소문자·파일/폴더 충돌을 zip 쌍마다가 아니라 경로마다 1건으로 묶어 기록 폭증을 막을까 (R3-1) | 경로마다 충돌 1건으로 묶는다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 20 | 2026-10-23 11:0x | impl · R4 ESCALATE(계열 3회째·보안) | 아주 깊은 경로가 든 작은 zip 으로 리뷰를 오래 붙잡는 걸 막으려 zip 항목 이름을 64 단계로 제한(넘으면 대조 불가)하고 접두 제거를 한 번 분해로 바꿀까 — AC⑬-17 신설 (R4-1) | 깊이 상한 + 접두 제거 한 번 분해 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
| 21 | 2026-10-23 11:1x | impl · R5 ESCALATE(계열 4회째·보안) | zip 여러 개 사이 충돌 검사를 경로마다 첫 항목과만 비교하게 바꿔(결과 동일) zip 이 아주 많을 때의 제곱 비교를 없앨까 (R5-1) | 첫 항목과만 비교로 바꾼다 (FIXED) | 추천 자동 채택(위임) | 확인 (2026-10-23) |
