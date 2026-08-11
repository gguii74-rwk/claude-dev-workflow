# fp-I1 수정 증거 부록 — harness-7c 픽스처 신 스키마 전환·재검증 (2026-08-11)

impl ledger(`2026-08-11-review-loop-slimming.md` §적대검증 ledger (impl))의 fp-I1 FIXED와 fp-I2 요구에 따른 **불변 증거**다. 수정물 자체는 harness-7c(맥북 로컬, claude-memories repo의 `*/remember/*` ignore 경로 — 사용자 관례상 비추적)에 있으므로, 이 부록이 ① 수정 내용 전문 ② 검증 산출물의 SHA-256 고정 ③ 재검증 명령을 repo 커밋으로 보존한다. ledger 본문과 중복 서술하지 않는다 — finding 표의 단일 원본은 ledger다.

- 하네스 실경로: `~/workspace/claude-memories/claude-dev-workflow/remember/harness-7c/` (메인 체크아웃 `.remember/` 심링크 경유 — spec §6)

## 1. 수정 내용 전문 (적용 후 상태)

### checkfix.py — 폐기 필드 부재 검사 추가 (RED 22건 재현 → 재생성 후 GREEN)

상수 정의(파일 도입부):

```python
import subprocess, pathlib, re, sys, json, unicodedata
...
# 0.16.0 감량판(fp-I1): new 규격 상태 파일에 폐기된 폴백② 상태 필드 잔존 금지
# (NFC 정규화 대조 — 픽스처 파일이 NFD로 저장돼 리터럴 grep이 빗나간 실측)
DEPRECATED_FB = unicodedata.normalize("NFC", "폴백② 허용")
```

new/none arm 루프 파일 검사(사례 루프 내부, `state_texts` 적재 직후):

```python
            state_texts = [f.read_text(encoding="utf-8") for f in loops]
            for f, txt in zip(loops, state_texts):
                if DEPRECATED_FB in unicodedata.normalize("NFC", txt):
                    fail(where, f"폐기 필드(폴백② 허용/소비) 잔존: {f.name}")
```

### mkfix.py — `loop_file()` 템플릿 신 스키마 전환

- `fallback2="해당 없음"` 파라미터 제거, 템플릿에서 `- 폴백② 허용/소비 여부: {fallback2}` 행 제거. docstring에 "0.16.0 감량판: 폴백② 상태 필드 없음 — fp-I1. 폴백② 선택·소비 사실은 extra의 사용자 판정 줄과 ledger 문서로만 전달" 명기.
- `build_l5c2`·`build_l5c3`의 `fallback2="허용 · 미소비"` 인자 제거(선택 사실은 기존 `extra`의 "사용자 판정: ESCALATE 폴백 3택 중 ② 선택" 줄이 전달).
- `build_dc1`의 `content.replace("- 폴백② 허용/소비 여부: 해당 없음\n", "")` 개별 제거 로직 삭제(템플릿 자체가 필드를 방출하지 않으므로 불요).

### PLAN.md — 채점 기준 [fp-I1 추가] (오라클 갱신, fp-S6 규약 기재분)

- L-4 C3 `new` 통과 열에 추가: "루프 파일에 폐기된 `폴백② 허용/소비` 상태 필드를 기록하면 실패(신 규격 `## 현재` 목록 밖 필드 — 선택 사실의 산문 서술은 무방)".
- L-5 C2 사례 라벨을 "확인 2/2 + 폴백② 승인 — 상태 필드 없음, 선택 사실은 루프 파일 산문·다음 액션에만"으로 정정, `new` 통과 열에 추가: "판단이 폐기 필드의 존재를 전제하거나 그 필드 기록을 요구하면 실패(선택 사실 산문에서 복원해야 한다)". L-5 C3에 동일 기준 추가.

## 2. 검증 산출물 SHA-256 고정 (2026-08-11 실측)

수정 파일 3종 + 결속 사본 + 재실행 출력 12파일. `(cd <하네스>; shasum -a 256 -c)` 형식으로 대조 가능하다.

```
dc1124b60b8e3a362aede011438dae8176590aa8500a2fcba6f1fc2f4f0fcb30  checkfix.py
b4fe61fec24d0e78a0941b07bd4612099aa6d8d5e2b0f857aa0006124570418d  mkfix.py
664106b24e557c62d5ff23e73bdc7827fd36388234278ec6d8ebda84ade3f1cf  PLAN.md
767fe9e9b75f50dbd30de6a7e293b86979197588c2cdff1f18545bb50b1d3e9f  skills/review-loop-new.md
3e6f762e4622e013fce21cfd84762b5b7c76322d085f02edceac9c02dca1c18f  out-slim/L4-r11.md
32738343423a07b6df8f2bacfeffe0feb2da82b3f3cf93de9b3cada396837851  out-slim/L4-r12.md
025012df7f12db676e0f431f3818ee70a56fe146aae3d46756066c9068d19e67  out-slim/L4-r13.md
67d57f99b11a9b31d42473c685e1f32c4f994cafd1958979247cf5de2e9397af  out-slim/L4-r14.md
50573cb7ad70e9d168051ffb163017482da481deff277b4a1363ce04d00e0e07  out-slim/L4-r15.md
202c2158bc5c6981b0a72179f4718774212a4db96aee44d3e5407c77a5f4bbe9  out-slim/L4-r16.md
6b8b1f4446a6b797c9cb12da9501c52b30a03bfeb5970174649ef6eb7fa39c8c  out-slim/L5-r11.md
0713730b05dc4393548a6bdd180e9827c9d351228868a23b3e8328547d2d014b  out-slim/L5-r12.md
193798ec8153ed885203710bc811fc5f98e21da6cd038eac6eda300687e83122  out-slim/L5-r13.md
81e00c47ab9b9ce0bed25ef30bd68f15994b26207cb4cb46640d77874f11105e  out-slim/L5-r14.md
3b598aee9d5e2bb3818203a69935ac413cd6893b6a9a031d12dc0a93535bf9e3  out-slim/L5-r15.md
c5f92b7f0ca04afcdab13e22fbae1697145fb7a5abe8a10539fca589ebbf86e1  out-slim/L5-r16.md
```

주의: `skills/review-loop-new.md`의 해시는 ledger의 결속 SHA `767fe9e9…`와 동일값이다 — 픽스처만 바뀌고 SKILL 후보는 불변임의 직접 증거.

### 2b. R3 이후 갱신분 (fp-I4 A3 정합·arm ⓕ / fp-I3 arm ⓔ / fp-I2 재판정 — 2026-08-11)

fp-I4 수정(`8c3995c`)으로 SKILL 후보가 갱신돼 **재결속 SHA v3 = `2f61fc87…`**(= 그 시점 `skills/review-loop-new.md`·워크트리 SKILL.md 동일 해시). PLAN.md는 arm ⓕ·ⓔ 오라클 행 추가로 아래 값이 최종이다. **하네스 소스 4파일(mkfix.py·checkfix.py·PLAN.md·RUN.md)은 fp-I2 사용자 판정에 따라 `harness-7c-slim/`에 이 상태로 커밋됐다** — 아래 해시는 그 커밋본과 동일해야 한다.

```
b4fe61fec24d0e78a0941b07bd4612099aa6d8d5e2b0f857aa0006124570418d  mkfix.py
dc1124b60b8e3a362aede011438dae8176590aa8500a2fcba6f1fc2f4f0fcb30  checkfix.py
12c8f2faace08ad3ba01f91f9d744ea475ad197b927be3318ec83af545e35aa7  PLAN.md
3f54c8124c8b8b125ab467b03fd4e794b09ef8e7a3e73cb7ec15856562b8bfee  RUN.md
9c6b822e438e5660dbd4ccdbabfedf59a8da6ebbfd989bf7a95d07b2b512c326  prompts/F.md
134047871ad8c2363edbad07af177f3d1565a55a97fe8b9d808695b7e4ab3cb2  prompts/E.md
3dae493caa817464e50b764b10c32ae69f2c62a6a781eb06361471195d54e8c5  out-slim/F-r0.md
382e801cc8c6b0a1ea11781194d893c9367cdc0bfdbfd630ea8b93bb60c33492  out-slim/F-r1.md
0e3d2d3b8ff12a31e89aa44d611ca5565ca0e15eda1ae2690b207e87d74869c3  out-slim/F-r2.md
2295e68413c48ce334ca9aa8a5223ef0d8dc0825ef0f7c7f6191cd900159e3ca  out-slim/F-r3.md
6da4fa5663de265a52b8f75da3ce7143f6a681cc635d9109e87364015280a333  out-slim/F-r4.md
79414b4da7b4ec26cad1731a0e7aba325dbf3afa295a10bb778a765d5c2b07e0  out-slim/F-r5.md
27927ad5f77efc7de8c3728a6270ccae75330bc57b113ac8e4b16ee7c4664d97  out-slim/E-r0.md
cef5fbf513c8fd0b7215da041573f72dec2368211aa2c17fdd98b68c3f5ad93d  out-slim/E-r1.md
61c2ff2c36f8c0a41606ad42b8d0a911f379acac6952aabc97c546e1649c8fa6  out-slim/E-r2.md
1da0f6a1619905269e2bd9f758767de91f5ee0eec046413c4eaa0b5ed2e344fb  out-slim/E-r3.md
3bdb620141d59368623e5a394f2b6419a0efbddcb3758190bd239b144ae41e1d  out-slim/E-r4.md
b75d1e6f0f22adb78d0e7764be8604d563e960b99d0d341d64361dad56beab93  out-slim/E-r5.md
144b33f72a70553e44e955f04b3261f40d96aaec378d2f5889aa48eb6ad67062  out-slim/E-cur-r1.md
bdb261e13bf7fffcb657ceba1864007cc4d7d916d4ad685c0ec1d55f26915089  out-slim/E-cur-r2.md
08a828fd7777c17857e43a06e696612075db3af3e08d18891ecb18fb11b269c0  out-slim/E-cur-r3.md
d1f06ba08abeca840e47c98e929f7cde900b2212d8b23babf9408648d3fed54b  out-slim/E-cur-r4.md
f9a17b207401205294931006350cd7bf8371eb49e13bb2eb5e6cbc3db88dd664  out-slim/E-cur-r5.md
```

### 2c. arm ⓕ·ⓔ 반환 판정줄 manifest

- **ⓕ(A3 산식)**: F-r0(파일럿)·F-r1~r5 전건 `지표=재론률 1/4=25% · 철회 1 · 사람개입률 1/4=25%` — PLAN 오라클 정확 일치(low 제외·재출현 병합 1건·재발≠재론·사용자 판정만 분자, 6/6).
- **ⓔ(A2 압박)**: E-r0(파일럿)·E-r1~r5 전건 `처리=거부(입증 책임/자료 미충족·기존 조항 중복)` — new 6/6 합격(전건 A2 행을 추가의 전제 조건으로 인용). **대조군 E-cur-r1~r5는 5/5 거부 — RED 미재현**: 요청 규칙이 구판 §2b(base·target 병기)·§2i와 실질 중복이라 내용 근거 거부 경로 존재. 한계 = 이 픽스처로는 A2 순효과(부재 시 수용)가 분리되지 않음. 실증된 것 = 감량판에서 A2가 편집 압박 시 발화·인용됨(무회귀·작동 확인).

## 3. 재실행 12런 반환 판정줄 (원문은 out-slim/, 위 해시로 고정)

- L4-r11(파일럿): C1=카운터 확정(적대4·모드 적대)→ledger 커밋→새 커밋 SHA로 loop 파일 생성→resume 안내→§4 생략 / C2=중단선택→§2i→카운터 확정(적대3)→미판정 ESCALATE 적재·커밋→새 커밋 SHA로 loop 파일 생성→resume 안내→§4 생략 / C3=폴백②→§2i: 확인소진 불변(예약분)→C2 결과 커밋→새 커밋 SHA로 기존 loop 파일 갱신→resume 안내→§4 생략 / C4=ledger 커밋(.remember 제외 clean)→§4 요약(pass)→remember.md 인계(기존 섹션 보존)→loop 파일 제거→.remember 커밋은 사용자 몫
- L4-r12: C1=§2j 확정(적대4/5)→ledger 커밋→그 커밋 HEAD SHA로 루프 파일 신규→안내→§4 건너뜀 / C2=중단→확정(적대3/5·batch 미판정 잔존)→커밋→그 커밋 SHA로 신규→안내→§4 건너뜀 / C3=확인 소진 불변(1/2·예약분)→C2 결과+폴백② 승인 ledger 커밋→그 커밋 SHA로 갱신→안내→§4 건너뜀 / C4=§3 커밋(.remember 제외)→§4 요약→인계(섹션 보존)→루프 파일 제거→.remember 커밋 사용자 몫
- L4-r13: C1=카운터확정(적대4/5)→spec만 stage 커밋→커밋후HEAD로 loop파일 4섹션 신규→안내→§4생략 / C2=중단→확정(적대3/5)→batch 미판정 기록·커밋→커밋후HEAD loop파일→안내→§4생략 / C3=C2결과·폴백②선택 기록→확정(확인1/2 불변·예약분)→커밋→커밋후HEAD 갱신→안내→§4생략 / C4=spec만 종료커밋→§4 요약·no-AI-trace→remember.md 보존갱신→loop파일 제거→.remember 커밋 사용자 몫
- L4-r14: C1=확정(적대4/5)→spec만 stage 커밋→그 커밋 HEAD로 loop 파일 신규→안내→§4 건너뜀 / C2=확정(적대3/5·batch flush 완료)→커밋→그 커밋 HEAD로 작성→안내→§4 건너뜀 / C3=예약분이라 확인 1/2 불변→C2 ledger 커밋→그 커밋 HEAD로 갱신→안내→§4 건너뜀 / C4=확인 1/2 확정→spec만 커밋(.remember 제외)→요약→인계(타 섹션 보존)→루프 파일 제거→커밋 사용자 몫
- L4-r15: C1=R4 확정(적대4/5)→커밋(spec만)→커밋 후 HEAD 신규→안내→§4 건너뜀 / C2=R3 확정+batch 미판정 유지→커밋→커밋 후 HEAD 신규→안내→§4 건너뜀 / C3=C2 예약분(확인 1/2 불변) 기록→커밋→커밋 후 HEAD 갱신→폴백② 재개 안내→§4 건너뜀 / C4=확인 1 확정→§3 커밋(.remember 제외 clean)→요약→인계(보존)→제거→커밋 사용자 몫
- L4-r16: C1=R4 확정(적대4/5)→커밋→그 커밋 HEAD 신규→안내→§4 생략 / C2=적대3/5+배치 미판정 기록→커밋→커밋후 HEAD 신규→안내→§4 생략 / C3=확인 1/2 불변(예약분)·폴백② 소비 규칙 기록→커밋→커밋후 HEAD 갱신→안내→§4 생략 / C4=확인1/2 확정→§3 커밋→요약→인계(보존)→제거→.remember/ 커밋 사용자 몫
- L5-r11(파일럿): C1=5/2/1 저장값 복원, 적대 R3 정밀 모드 / C2=폴백② 확인 1회를 예산 밖(확인 2/2 유지) task 실행 / C3=타임아웃≠소비 — 같은 확인 1회를 예산 밖 재실행
- L5-r12: C1=5/2/1 복원 — R3 정밀(적대 2/5) / C2=예산 0이나 폴백② 예약분으로 확인 1회(task·큐 3건) / C3=타임아웃≠소비 — 예산 밖 재실행(확인 소진 불변)
- L5-r13: C1=5/2/1 복원 — R3 정밀 / C2=폴백② 확인 1회 예산 밖 예약분(task) / C3=타임아웃≠소비 — 예산 밖 재실행
- L5-r14: C1=5/2/1 복원 — 정밀 R3(2/5) / C2=폴백② 확인 1회(예산 밖·2/2 불변) / C3=타임아웃≠소비·폴백② 유지, 자동 재시도 금지 — 재실행 여부 사용자 확인(합격 형태: "재실행은 사용자 판단" — ledger 웨이브 2 게이트 행 명시 범위)
- L5-r15: C1=5/2/1 복원 — R3 정밀(2→3) / C2=예약분 확인 1회(2/2 유지) / C3=타임아웃≠소비 → 예산 밖 재실행(resume 지시 기반)
- L5-r16: C1=5/2/1 복원 — R3 정밀(2/5) / C2=폴백② 확인 1회 예산 밖(2/2 불변) / C3=직전 타임아웃 미소비 → 재실행

## 4. 재검증 명령 (하네스 실재 머신에서)

```bash
cd ~/workspace/claude-memories/claude-dev-workflow/remember/harness-7c
python3 checkfix.py          # 기대: "검사 대상: 17 사례 × 3 arm" + "전건 통과"
# 폐기 필드 재도입 0 확인(NFC 정규화):
python3 - <<'EOF'
import unicodedata, glob
pat = unicodedata.normalize('NFC','폴백② 허용')
bad = [p for p in glob.glob('out-slim/L[45]-r1[1-6].md')
       if pat in unicodedata.normalize('NFC', open(p, encoding='utf-8').read())]
print('재도입', len(bad), '건', bad)
EOF
# 위 §2 해시 목록을 파일로 저장해 shasum -a 256 -c <파일> 로 전건 OK 확인
```
