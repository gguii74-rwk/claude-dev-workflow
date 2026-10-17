# task-04 — orchestrate SKILL.md (spec §3o · AC1 · AC4)

**목적**: 메인 세션용 공통 절차 스킬 `orchestrate`의 SKILL.md를 만든다 — 시작 자가 점검 · 역할 규칙(모델표) · 프로젝트 규약 우선 · ① 기동 · ② 감시 · ③ 질문 처리(라우팅표 + TUI 키) · ④ 단계 종료(검증 체크리스트 + 대장) · ⑤ 후계·재획득·페어링·다중 트랙. 오르카 상세는 본문에 두지 않는다(D3·D36).

## Files

- Create: `dev-workflow/skills/orchestrate/SKILL.md`

## Prep

- spec §3o 전체(①~⑤ · 라우팅표 · 분량 상한 · `$N` 금지) · §3t · §3w(서브커맨드 이름·exit code만) · §4 AC1 · D1·D3·D5·D13~D16·D18·D20·D23~D25·D27~D29·D34~D36·D38·D39·D41·D42·D44.
- 엔트리포인트 **SC-2**(서브커맨드·인자·exit code — 본문은 이름과 의미만) · **SC-3**(표지·출처 문자열).
- `<Base directory>` = Claude Code가 스킬을 로드할 때 본문 위에 표시하는 「Base directory for this skill」 경로(1.1.1 AC8에서 설치본 `…/dev-workflow/<버전>/skills/<스킬>` 실측). 메인 cwd는 프로젝트 repo라 상대 경로가 안 통한다(M14).

## Deps

02(서브커맨드 이름·exit code) · 03(템플릿 경로·고정 문구).

## Steps

### 1. 실패 확인

```bash
test -f dev-workflow/skills/orchestrate/SKILL.md && echo EXISTS || echo MISSING
```

기대: `MISSING`.

### 2. SKILL.md 작성

`dev-workflow/skills/orchestrate/SKILL.md`를 아래 내용 **그대로** 만든다(Write 도구):

````markdown
---
name: orchestrate
description: Use when a main session should run a pipeline track in a separate Orca terminal session — launch it, watch it, route its questions, verify and hand off at the stage boundary. 트리거 예 — "트랙 띄워", "메인 세션으로 돌려", "이 단계 위임으로 진행해", "트랙 감시해", "후계 띄워". Does NOT trigger on codex failures inside a running review-loop (review-loop's concern), on work done directly in a single session, on questions about Orca CLI usage itself (orca-cli's concern), or on worktree create/delete policy (the project's own rules).
---

# orchestrate

**Announce:** "orchestrate로 메인 세션의 트랙 운영 절차를 따릅니다."

메인 세션이 트랙 세션을 오르카 터미널로 띄워 **기동 → 감시 → 질문 처리 → 단계 종료 → 후계**까지 운영하는 공통 절차다. 오르카 명령 상세는 `orca skills get orca-cli`를 보고, 감시·생존·키 전송은 동봉 스크립트로 한다: `node <Base directory>/scripts/orchestrate.mjs watch|alive|key …`(`<Base directory>` = 스킬 로드 때 표시되는 「Base directory for this skill」 경로 — 메인 cwd 기준 상대 경로로는 못 찾는다). 트랙 프롬프트는 `<Base directory>/templates/track-prompt.md`의 빈칸을 채워 쓴다.

## 시작 자가 점검

메인 세션 자신의 `DEV_WORKFLOW_MODE`를 셸로 읽는다(`printenv DEV_WORKFLOW_MODE`). 앞뒤 공백을 뗀 값이 `delegated`면 「이 세션은 위임 모드라 메인 역할에 부적합하다(자기 후계를 띄우지 못한다)」를 1줄 경고하고 계속할지 AskUserQuestion 1회(추천 = 중단).

## 역할 규칙

- 메인은 **spec·plan·코드를 편집하지 않는다**(트랙 몫). 메인이 쓰는 파일 = 핸드오프(`.remember/remember.md`)·트랙 프롬프트 파일·메모리뿐.
- 사용자에게 묻는 질문은 전부 글로벌 질문 형식(① 무슨 일 ② 예: ③ 선택지별 결과 ④ 추천 첫 선택지). 트랙이 띄운 질문은 **그 형식으로 재작성**해 전달한다 — 읽는 사람은 트랙 화면을 보지 않았다.
- 트랙 모델은 **기동 명령의 `--model`로만** 정한다. **트랙에 `/model`을 보내지 않는다** — 「새 세션 기본값으로 저장」되어 사용자 전역 settings.json의 model을 바꾼다. 바꿔야 하면 그 단계의 새 트랙을 띄운다.

| 단계 | 기본 모델 |
|---|---|
| 브레인스토밍 · spec 초안 · harden-spec | Fable(`claude-fable-5-1`) |
| ui-mockup · plan · review-loop · impl · 운영(릴리스·실측) | Opus(`claude-opus-5-5`) |

## 프로젝트 규약 우선

repo id · 브랜치 규칙 · 워크트리 정책 · 프롬프트 파일 위치 · Windows 경로·따옴표 · 모델 배분 · 수동 트랙 권한 플래그는 **그 프로젝트 규약(CLAUDE.md·프로젝트 스킬)이 정한다**. 규약이 없을 때의 기본값 = 같은 체크아웃(워크트리 없음) · 프롬프트 파일 `.remember/track-<slug>.prompt` · 위 모델표.

## ① 기동

1. **설치 버전 확인(조회만)**: 그 체크아웃에 적용되는 dev-workflow 설치 버전을 스코프별로 본다(`~/.claude/plugins/installed_plugins.json` — 형식이 바뀌었으면 `doctor`). 1.2.0 미만이면 갱신을 **제안**만 하고(사용자 확인 — 자동 실행 금지), 거절하면 구버전 운영(③ 표 3행)으로 간다고 밝힌다. **같은 체크아웃에 이미 트랙이 있으면 둘째를 띄우지 않는다**(워크트리 — 프로젝트 규약 — 또는 순차).
2. **모드**: 브레인스토밍·harden-spec·ui-mockup = 수동 / review-loop(spec)부터 = 위임(`DEV_WORKFLOW_MODE=delegated` 접두). 사용자가 수동을 지정하면 그대로.
3. **기동 명령**: 위임 = `DEV_WORKFLOW_MODE=delegated claude --dangerously-skip-permissions --model <id> --session-id <uuid>`(위임은 권한 창을 누를 사람이 없다 — 안전장치는 프롬프트 정지 조건 + ③ 사용자 행). 수동 = `claude --model <id> --session-id <uuid>` — 권한 우회 플래그는 프로젝트 규약대로, 규약이 침묵하면 기동 직전 사용자에게 1회 묻는다(추천 = 포함; 답이 반복되면 규약에 적으라고 안내). uuid는 메인이 정한다(`uuidgen`).
4. **프롬프트**: 템플릿 빈칸을 채워 트랙 프롬프트 파일로 쓴다 — review-loop 단계면 인자 4종(`--phase`·`--security`·`--auto-rounds`·`--base`)을 넣고, 보안 판정은 기동 전 사용자에게 1회 확인한다. 사실(HEAD·push 여부·경로·설치 버전)은 git·파일에서 확인해 쓴다.
5. **생성**: `orca terminal create --worktree path:<abs> --title <트랙명> --command '<기동 명령>' --json` → 핸들 = **생성 응답의 핸들뿐**. 응답이 유실되면 **제목으로 찾지 않는다**(탭 제목은 셸·claude가 덮어쓴다) — 생성 전후 핸들 차분은 보고용 후보일 뿐, 재생성·전송 없이 사용자에게 보고하고 멈춘다. 이어서 idle 대기 → `alive` → 포인터 한 줄 「`<트랙 프롬프트 경로>` 파일을 읽고 그 지시대로 진행하라」를 프롬프트 제출로 보내고 turn_started를 확인한다(없으면 재전송하지 않는다 — orca-cli의 재시도 규칙).
6. **핸드오프 트랙별 블록**: 현재 핸들 · 제목 · 현재 세션 id · 워크트리 경로 · 단계 · 트랙 프롬프트 경로 · 모드 · 모델 id · environment(로컬이면 없음) · 마지막 처리 표지. 현재 핸들·현재 세션 id는 후계·재획득·복구마다 갱신한다(⑤).

## ② 감시

`node <Base directory>/scripts/orchestrate.mjs watch <핸들> [최대초=580] [--consumed <마지막 처리 표지 줄>] [--environment <이름>]`을 **백그라운드로 1회** 띄우고 결과로 깨어난다 — 폴링 턴을 직접 돌리지 않는다. `--consumed` = 핸드오프의 마지막 처리 표지(메인이 실제로 처리한 표지만 — 그와 같은 표지는 본문이 바뀌기 전까지 다시 판정되지 않는다). 첫 줄 판정별 행동:

- **DONE**(`[TRACK-DONE …]`) → ④. **HANDOFF**(`[TRACK-HANDOFF …]`) → ⑤-1. 처리한 표지 줄을 핸드오프의 마지막 처리 표지에 적는다.
- **SETTLED** → 화면을 읽어 판독(표지 없는 종료 보고면 ④, fail-closed 보고면 사실 오류는 프롬프트 정정·재기동 · 판단은 사용자, 그 외 재감시).
- **QUESTION** → ③. 화면이 권한 확인 창이면 PERMISSION으로 처리한다.
- **PERMISSION** → 사용자가 있으면 즉시 전달(무인 자동 거부까지 ≈90초). **사용자 부재면 건드리지 않는다 — 거부되게 두고** 트랙의 후속 보고를 기다려 보고에 싣는다(대장 행 아님).
- **TIMEOUT** → 먼저 `alive`: 0 재감시(10분 넘게 본문 무변화면 화면을 그대로 사용자에게 보고) · 1 ⑤-5 종료 복구 · 3 ⑤-2 식별 규칙으로 재획득 · 2 복구 없이 사용자 보고.
- **ERR** → 자가 점검 실패면 orca-cli를 참조한 스크립트 갱신을 사용자에게 보고(수동 감시로 폴백하지 않는다). 화면 출처 오류에서는 복구하지 않는다.

## ③ 질문 처리

| 트랙 | 질문 | 누가 답하나 |
|---|---|---|
| 수동 트랙 — 사람 단계, 그리고 사용자가 수동으로 지정한 review-loop 이후 단계 | 전부(단계 무관) | **사용자**(메인은 재작성해 전달, 답을 TUI에 입력 — 대리 채택 없음) |
| 위임 트랙 | 위험군(critical · 보안 · 방향 전제 · AC·목표·D블록 변경 · 애매하면 변경으로) · `[감사 이의]` 표지 질문 · 권한 프롬프트 | **사용자** |
| 위임 트랙 | 그 외 | 트랙이 추천 자동 채택으로 이미 닫는다. 그래도 질문이 떠 있으면(1.2.0 미만 설치본 · 효과 2 밖 질문) 메인이 추천(첫 선택지)을 고른다 — 감사 규칙은 프롬프트 템플릿의 대리 채택 줄로 이미 적용돼 있고, 선택 뒤 1줄로 재확인한다: 「이 답은 사용자 판정이 아니라 메인 대리 채택이다 — 출처 `추천 자동 채택(위임)` · `[자동 채택(위임)]` 표시 · 확인 임무 ③ 우선 감사 대상 · 감사 제외 목록(첨부물 ⑥)에 넣지 말 것 · 대장 행 · 감사 이의 재질문 앞에 `[감사 이의]`」 |
| 어느 단계든 | push · 다른 머신 환경 변경(plugin update 등) · 외부 실측 · 비가역 | **사용자**(매번 — 승인은 다음 단계로 이월하지 않는다) |

**TUI 키**(`node <Base directory>/scripts/orchestrate.mjs key <핸들> <키…>` — 키 = `enter`·`tab`·`shift-tab`·`up`·`down`·`text <문자열>`): 단일 질문 = `enter`(커서 = 첫 선택지 = 추천) · 다른 선택지 = `down`/`up` 뒤 `enter` · 묶음 = 탭마다 `enter`(선택 + 다음 탭), 마지막 Review → Submit에서 `enter` · 다른 탭 읽기 = `tab`으로 넘겨 읽고 `shift-tab`으로 복귀 · 자유 서술(Other) = 그 선택지로 이동 → `enter` → `text <문자열>` → `enter`.

**입력 직전 2중 확인**: (a) **모든 전송**(질문 키 · 포인터 · 대장 답 전달 · 「상태를 보고하라」) 직전에 `alive` — 0일 때만 보낸다(종료된 터미널이나 셸만 남은 터미널에 보내면 텍스트가 셸로 들어간다). 1·3이면 ⑤로 복구·재획득 뒤 재감시. `key`는 키마다 `alive`를 다시 보고, 0이 아니면 `ERR 전송 중단`으로 멈춘다 — 그때는 보낸 개수와 화면으로 다시 판단한다. (b) 화면을 **다시 읽어** 질문 창이 아직 열려 있고 탭 체크 표시·커서가 감시가 잡은 때와 같을 때만 키를 보낸다 — 사용자가 트랙 터미널에서 직접 답했을 수 있다. 다르면 보내지 않고 현 화면으로 다시 판단한다.

다중 트랙이면 사용자에게 올리는 질문·보고에 **「[트랙명 단계]」 접두**를 붙인다.

## ④ 단계 종료

DONE(또는 판독으로 확인한 종료) 뒤 메인이 **직접 검증**한다:

- [ ] 커밋 범위 `git log --oneline <기준>..HEAD`가 보고와 표지의 HEAD와 일치
- [ ] 테스트·게이트 재실행(프로젝트 규약의 명령)
- [ ] AI 서명·트레일러 grep 0건
- [ ] diff가 spec 대상 파일 안
- [ ] 확인 대기 대장 — **트랙의 ledger 문서 전부**(spec + plan 엔트리포인트)의 `## 확인 대기 대장`에서 `확인 대기` 행

보고를 올리며 대장 대기 행을 글로벌 형식 질문으로 함께 묻고(전부 확인 / 번복 n건) 답을 트랙에 전달한다 — 트랙이 대장을 갱신·커밋한다(메인은 편집하지 않는다). 「확인」만이면 그 커밋이 대장 절만 건드렸는지 본다. **「번복」이 1건이라도 있으면 그 단계는 미완료**다 — 트랙이 그 phase의 수정 규칙(impl = TDD+게이트, spec/plan = 관문 재확인)으로 고쳐 커밋하고 대장 행을 `번복 (<날짜>) → <처리 커밋>`으로 바꾼 뒤, 메인이 **최종 HEAD로 위 체크리스트를 다시 검증**해야 단계 완료다. 번복 수정분의 소멸 확인은 다음 phase 리뷰 루프가 승계하고, 다음 루프가 없는 impl → 릴리스는 새 세션 확인 라운드 1회 뒤 릴리스한다. 사용자 부재면 대기로 남긴다. push·plugin update·외부 실측은 사용자 확인 뒤에만.

핸드오프: `.remember/remember.md` 맨 위에 트랙별 블록(① 6항목 + 대장 대기 수) 추가(기존 블록 보존) + 메모리 → claude-memories 커밋(push는 프로젝트 규약). **단계 경계에서 정지** — 다음 단계는 사용자 지시로 새 트랙(①).

## ⑤ 후계·재획득·페어링·다중 트랙

1. **HANDOFF 후계**: 표지 바로 위 `사유:` 줄을 읽는다. **사유가 넛지일 때만** 자동 재개한다 — 사용자 중단·폴백②·불명은 보고하고 명시적 재개 지시를 기다린다. **옛 세션 종료가 먼저**다: (a) 이 폴더의 codex 잡(queued/running) 0 확인(훅 후계 프롬프트의 「0번째 동작」과 같은 상태 파일 직접 읽기 — 0이 아니거나 판독 불가면 보류·보고) → (b) 옛 터미널에 `/exit` → claude 종료·셸 복귀 확인 → close(실패·모호하면 후계를 만들지 않고 보고) → (c) 같은 접두·같은 `--model`·새 `--session-id`로 새 터미널, 프롬프트 = 「원래 트랙 프롬프트 파일 `<트랙 프롬프트 경로>`를 먼저 읽고 그 역할·진행 범위·정지 조건·표지 규약을 따르라. 그다음 `<재개 파일>`을 읽고 이어가라(review-loop면 `/review-loop --resume`)」. 그 뒤 트랙별 블록의 현재 핸들·현재 세션 id를 후계 값으로 갱신(옛 값은 이력 1줄).
2. **재획득**(수동 트랙의 자가 인계 등으로 핸들이 사라짐): **제목으로 고르지 않는다**. 목록의 새 핸들 중 화면에 식별 문자열(후계 프롬프트의 「옛 세션(핸들 <옛 핸들>)」 또는 메인이 보낸 프롬프트 파일 경로)이 보이는 터미널이 **정확히 1개**일 때만 채택, 0개·2개 이상이면 보내지 않고 후보를 보고한다. 첫 전송 = 「트랙 프롬프트 파일 `<경로>`를 다시 읽고 그 정지 조건·표지 규약을 따르라. 그다음 상태를 보고하라」. 현재 핸들을 갱신하고 세션 id는 「미상」으로 적는다.
3. **메인 자신의 후계**(메인은 수동 — 자동 인계): 후계 메인은 트랙별 블록의 environment·모드·모델·트랙 프롬프트 경로를 먼저 복원한 뒤 적힌 핸들로 `terminal list`에서 재획득한다(없거나 stale이면 2의 식별 규칙).
4. **다른 머신(페어링)**: 모든 orca 호출과 스크립트 서브커맨드에 `--environment <이름>`(이름은 환경 인벤토리 규약). 메인의 파일·git 작업은 **트랙의 호스트 체크아웃에서** ssh로 한다 — 설치 상태 조회 · 프롬프트 파일 작성과 포인터 전송 전 존재 확인 · ④ 검증 · codex 잡 조회. 메인 로컬 체크아웃으로 원격 트랙을 판정하지 않는다.
5. **예기치 않은 종료**: `alive`가 1이면 새 터미널(같은 접두·같은 `--model`)에서 `claude --resume <세션 id>`로 이어 붙인다 — 세션 id = 트랙별 블록의 **최신** 현재 세션 id(「미상」이면 복구하지 않고 보고). **stale(3)은 종료가 아니다** — 세션이 새 핸들로 살아 있을 수 있어 `--resume`하면 같은 세션이 둘 된다 → 2의 식별 규칙 먼저. 복구 뒤 현재 핸들을 갱신하고 첫 전송은 「상태를 보고하라」.
6. **다중 트랙**: 워크트리가 다르면 동시 운영 — 핸들별 `watch` 백그라운드 병행 · 「[트랙명 단계]」 접두 · 핸드오프 트랙별 블록. **같은 체크아웃에 트랙 둘은 금지**(커밋 경합).

## 함정 (1줄씩)

- idle만으로는 「백그라운드 대기」와 「완료」를 못 가른다 → `watch` 판정만 쓴다.
- 플러그인 user 스코프 갱신은 project 스코프를 올리지 않는다 → ① 1.
````

### 3. AC1·AC4 검증

```bash
f=dev-workflow/skills/orchestrate/SKILL.md
wc -c < $f                                   # ≤ 15360 (작성 시 실측 15,147 — plan R1-2 반영 뒤)
sed -n '1,5p' $f | grep -cE '^(model|effort):'   # 0
grep -cE -- '--for |--screen|--wait-submit|--retry-request|result\.terminal' $f   # 0
grep -nE '\$[0-9]' $f | wc -l                # 0
for p in 'Does NOT trigger' '트랙 띄워' '## 시작 자가 점검' '## 역할 규칙' '## 프로젝트 규약 우선' '## ① 기동' '## ② 감시' '## ③ 질문 처리' '**TUI 키**' '## ④ 단계 종료' '- [ ] ' '## ⑤ 후계·재획득·페어링·다중 트랙' \
  'orca skills get orca-cli' '프로젝트 규약' '/model' 'claude-fable-5-1' 'claude-opus-5-5' 'scripts/orchestrate.mjs' 'templates/track-prompt.md' \
  '모든 전송' 'alive' '--resume' 'stale(3)은 종료가 아니다' '트랙의 호스트' '수동으로 지정한' '먼저 `alive`' \
  '[자동 채택(위임)]' '감사 제외 목록' '[감사 이의]' '트랙 프롬프트 경로 · 모드 · 모델 id · environment' '먼저 복원' '--consumed' '최종 HEAD' \
  '현재 핸들·현재 세션 id' '트랙 프롬프트 파일' '제목으로 찾지 않는다' '제목으로 고르지 않는다' '사유가 넛지일 때만' '옛 세션 종료가 먼저' 'codex 잡' '다시 읽어' \
  '--dangerously-skip-permissions' '--session-id' '규약이 침묵하면' 'DEV_WORKFLOW_MODE' '설치 버전' '같은 체크아웃' '[트랙명' '거부되게' 'terminal create'; do
  printf '%s %s\n' "$(grep -cF -- "$p" $f)" "$p"; done | awk '$1==0{print "MISSING:", $0; bad=1} END{if(!bad) print "ALL_PRESENT"}'
```

기대: `≤ 15360` 수치 · `0` · `0` · `0` · `ALL_PRESENT`.

### 4. 커밋

```bash
git add dev-workflow/skills/orchestrate/SKILL.md
git commit -m "feat(orchestrate): 메인 세션 트랙 운영 공통 절차 SKILL.md — 시작 자가 점검(DEV_WORKFLOW_MODE) · 역할 규칙(편집 금지·모델은 --model만·/model 금지) · 프로젝트 규약 우선 · ①기동 ②감시(watch 7판정) ③질문(라우팅표·TUI 키·전송 직전 alive+재확인) ④단계 종료(검증 체크리스트·대장·번복=미완료) ⑤후계·재획득·페어링·다중 트랙; 오르카 상세는 orca-cli·스크립트(spec §3o·AC1)"
```

## Acceptance Criteria

- 단계 3 기대 출력 그대로 (AC1 SKILL.md 부분 — 절 8종 · 크기 ≤ 15KB · 오르카 옵션 문자열 0 · `orca-cli` 포인터 · 「프로젝트 규약」 · B14~B18·H 문면 항목 · frontmatter에 model/effort 없음; AC4 `$N` 0).
- `head -4 dev-workflow/skills/orchestrate/SKILL.md | grep -c '^name: orchestrate$'` → `1`.

## Cautions

- **오르카 옵션·응답 필드를 본문에 쓰지 마라**(`--for `·`--screen`·`--wait-submit`·`--retry-request`·`result.terminal`). 이유: D3·D36 — 버전마다 어긋나는 상세는 `orca-cli`와 스크립트 1곳에만 둔다. 본문에 허용되는 것은 기동 명령 1줄 예시(`orca terminal create … --command`)와 서브커맨드 이름뿐.
- **frontmatter에 `model`·`effort`를 넣지 마라.** 이유: F4 — 오버라이드는 invoke된 턴에만 유효하고 이 스킬은 여러 턴에 걸친다.
- **15KB를 넘기려면 문구를 줄여라, 절을 빼지 마라.** 이유: AC1은 절 8종과 문면 항목을 전부 요구한다 — 함정 목록·예시부터 줄인다(M3).
- **트랙 질문을 사용자에게 옮길 때 트랙 문면을 그대로 붙이라고 쓰지 마라.** 이유: 역할 규칙 — 읽는 사람은 트랙 화면을 보지 않았다, 글로벌 질문 형식으로 재작성한다.
