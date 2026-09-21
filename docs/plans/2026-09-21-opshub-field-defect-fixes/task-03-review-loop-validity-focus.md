# task-03 — RL 유효성 블록 + focus 고정 첫 줄 (F3 · F1-3 통합, D3·D12~D15)

**목적**: §2b ④를 "마커 → 헤더·스키마·실행 로그 ≥1 → 샌드박스 전면 실패 표지" 순서의 **유효성 블록 하나**로 바꾸고(실행 실패를 finding 0으로 오판하는 경로 차단), 적대 focus 규격 맨 앞에 정적 검토 완료형 고정 줄을 두며, "빈 가드 = focus 인자 미부착"을 guard-focus D10 정밀화 문언으로 바꾼다.

## Files

- Modify: `dev-workflow/skills/review-loop/SKILL.md`
  - §2b `**④ 완료·유효 판정**` 아래 3줄(task-02가 원문 그대로 둔 286~288행 상당) → §A
  - §2b `- **빈 가드 = focus 인자 미부착**: …` 1줄(task-02가 원문 그대로 둔 282행 상당) → §B
  - §기결정 가드의 `  - **문구 = 무효 선언형 + 정상보고 단서 짝 필수**:` 불릿(0.17.0 기준 110행) **바로 앞**에 §C 불릿 삽입
- Test: 없음(task-06 GREEN — V1~V4 픽스처)

## Prep

- spec §3 F1-3·F3, §4 D3·D12·D13·D14·D15, AC3. 엔트리포인트 SC-2(표지 문자열)·SC-3(FOCUS-LINE)·SC-7.
- 현행 확인: `grep -n '빈 가드 = focus 인자 미부착\|④ 완료·유효 판정\|문구 = 무효 선언형' dev-workflow/skills/review-loop/SKILL.md` — 3건 모두 1행씩 나와야 한다.

## Deps

task-02.

## Steps

### 1. §A — `**④ 완료·유효 판정**` 아래 3줄(JSON 파싱 · 스키마 불일치 · 미설치)을 다음으로 교체

원문 3줄:
```
- 출력 JSON을 파싱한다: `{ verdict, summary, findings[{severity,title,body,file,line_start,line_end,confidence,recommendation}], next_steps }`.
- 출력이 스키마와 다르면 루프를 멈추고 원문을 보고한다(추측 금지). 자동 재시도 금지 — 재실행은 사용자 판단.
- companion이 미설치/미인증으로 실패하면 멈추고 `/codex:setup`을 안내한다(임의 수정 금지).
```
교체 텍스트(헤더 줄 `**④ 완료·유효 판정**`도 아래 첫 줄로 바꾼다):
```markdown
**④ 완료·유효 판정 — 적대·확인 공통.** ⓐ 마커 `COMPANION_EXIT:` = 완료. 마커 없이 프로세스가 사라졌으면(③) **실행 실패**. ⓑ 적대: `sed -n '/^# Codex Adversarial Review/,$p' "$L.out"`로 본문을 추출해 **헤더 + 스키마 JSON**(`{ verdict, summary, findings[{severity,title,body,file,line_start,line_end,confidence,recommendation}], next_steps }`) + **`[codex] Running command:` 실행 로그 ≥1건**을 확인한다(정적 검토도 셸 명령이라 로그를 남긴다 — 0건 = 실행 실패, finding 0이 아니다). ⓒ **샌드박스 기동 실패 표지**(`bwrap:`·임시 디렉터리 생성 실패·비-JSON 종결 — 열린 예시)가 로그 **전반**이면 approve JSON이 붙어도 실행 실패. **개별 명령 실패는 무효 사유가 아니다** — 고정 첫 줄이 정적 검토 완료를 지시하므로 완주한 리뷰는 유효. 확인 응답은 §응답 완전성 계약. **실행 실패·스키마 불일치** = 소진 미반영·원문 보고·자동 재실행 금지(재실행은 사용자 판단). companion 미설치/미인증은 멈추고 `/codex:setup`.
```

### 2. §B — `- **빈 가드 = focus 인자 미부착**: …` 1줄을 다음으로 교체

원문(1줄):
```
- **빈 가드 = focus 인자 미부착**: 재논의 금지 블록·닫힌 ledger 항목·미확인 FIXED 큐가 **모두 없으면** `-- "$(cat …)"`을 통째로 빼고 호출한다(companion 기본값에 맡긴다 — 빈 목록을 보내 "닫힌 게 없다"는 신호로 오해될 여지를 만들지 않는다). **미확인 FIXED 큐만 비어 있지 않으면 진행 상태 한 줄만으로 focus를 부착한다**(§기결정 가드 — 계열 B 고지가 빈 가드 분기로 소실되지 않게).
```
교체:
```markdown
- **빈 가드 = 가드 블록 미포함 — focus 인자는 고정 줄로 항상 부착**: 재논의 금지 블록·닫힌 ledger 항목·미확인 FIXED 큐가 **모두 없으면** `$L.focus` = 고정 첫 줄만(빈 목록을 보내 "닫힌 게 없다"는 신호로 오해될 여지를 만들지 않는다 — guard-focus D10 취지, 문언만 정밀화). **미확인 FIXED 큐만 비어 있지 않으면 고정 줄 + 진행 상태 한 줄**(§기결정 가드 — 계열 B 고지가 빈 가드 분기로 소실되지 않게).
```

### 3. §C — §기결정 가드 focus 규격에 고정 첫 줄 불릿 삽입

`  - **문구 = 무효 선언형 + 정상보고 단서 짝 필수**:` 로 시작하는 불릿 **바로 앞**에 다음 불릿을 넣는다(같은 들여쓰기 2칸):
```markdown
  - **고정 첫 줄 — 적대 focus 맨 앞, 매 라운드, 무효 선언형 짝 바깥**: "샌드박스는 읽기 전용이라 테스트·빌드 실행이 실패할 수 있다 — 실패를 이유로 검토를 중단하지 말고 정적 검토로 완료하라(게이트는 루프가 실행한다). typecheck 같은 읽기 전용 명령은 그대로 실행하라." (실사례: 샌드박스 명령 실패 뒤 빈 응답 3건 → 첫 줄 뒤 재발 0.) **적대만**(확인 실사고 0). 가드 목록이 아니라 "빈 가드" 판정에 세지 않는다.
```

### 4. 자기 점검

```bash
F=dev-workflow/skills/review-loop/SKILL.md
grep -c 'focus 인자 미부착' $F                                   # 0
grep -c '가드 블록 미포함 — focus 인자는 고정 줄로 항상 부착' $F   # 1
grep -c '샌드박스는 읽기 전용이라 테스트·빌드 실행이 실패할 수 있다 — 실패를 이유로 검토를 중단하지 말고 정적 검토로 완료하라(게이트는 루프가 실행한다). typecheck 같은 읽기 전용 명령은 그대로 실행하라.' $F   # 1 (SC-3 FOCUS-LINE 바이트 동일)
grep -c '실행 로그 ≥1건' $F; grep -c '개별 명령 실패는 무효 사유가 아니다' $F; grep -c 'bwrap:' $F   # 각 1
grep -c 'Codex Adversarial Review' $F                            # ≥1 (sed 추출 유지)
wc -c $F                                                          # 소프트 예산 ≤ 65,800 (SC-7 — 합성값 65,662)
```

### 5. 커밋

```bash
git add dev-workflow/skills/review-loop/SKILL.md
git commit -m "fix(review-loop): §2b 유효성 블록 통합(마커→헤더·스키마·실행 로그 ≥1→샌드박스 전면 실패, 개별 실패 무효 아님) + 적대 focus 고정 첫 줄(정적 검토 완료형) + 빈 가드 문언 정밀화(guard-focus D10) (F3·D12~D15)"
```

## Acceptance Criteria

```bash
F=dev-workflow/skills/review-loop/SKILL.md
grep -c 'focus 인자 미부착' $F                                    # 0
grep -c '고정 첫 줄' $F                                            # ≥2 (규격 불릿 + ④ 참조)
grep -c '실행 로그 ≥1건' $F                                        # 1
grep -c '개별 명령 실패는 무효 사유가 아니다' $F                     # 1
grep -n '고정 첫 줄 — 적대 focus 맨 앞' $F | cut -d: -f1            # 행 번호 < '문구 = 무효 선언형' 행 번호 (D5 짝 바깥·앞)
grep -n '문구 = 무효 선언형' $F | cut -d: -f1
[ "$(wc -c < $F)" -le 65800 ] && echo SIZE_OK
git log -1 --format=%B | grep -ciE 'co-authored|generated with|claude-session'   # 0
```

## Cautions

- **고정 줄을 무효 선언형 + 정상보고 단서 짝(D5) 안에 끼우지 않는다. 이유: D5 짝은 가드 목록의 문구이고 고정 줄은 목록이 아니다 — 짝 바깥·맨 앞이 spec D12의 배치다.**
- **확인 `task` 프롬프트 첨부물 계약(RL:158)에 고정 줄을 추가하지 않는다. 이유: D14 — 확인 실사고 0, L1.**
- **"실행 로그 0건 = 실행 실패"와 "테스트 실행 금지"를 충돌로 보고 문장을 완화하지 않는다. 이유: 정적 검토도 셸 명령이라 로그를 남긴다 — XVAL2가 본 긴장은 이 조건으로 해소된다(spec F3-1).**
- **FOCUS-LINE 문자열을 다듬지 않는다. 이유: task-06의 `review-loop-new.md`·하네스 V/N 판정이 SC-3 바이트 동일을 전제한다.**
