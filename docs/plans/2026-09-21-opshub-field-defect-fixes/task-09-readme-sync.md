# task-09 — README 3종 동기 (F7 정정 3건 + 0.18.0 신규 서술 3건, D36)

**목적**: README·README.ko·README.ja의 review-loop 서술 3건(종료 목표 blocking 정의 · 빠른 종료 조건 · plan 관문 ③ 적용 범위)을 SKILL 문면과 맞추고, 0.18.0 신규 동작 3건(F1 분리 실행·마커 판정 / F5 수정 커밋 먼저 / F6 넛지 = 현재 단위만)을 **3언어 같은 위치**에 넣는다.

## Files

- Modify: `README.md` · `README.ko.md` · `README.ja.md` — 각 파일 6곳(10·83·89·116행 교체, 89행 뒤 문단 삽입, 188행 문장 추가). 행 번호는 0.17.0 기준, 원문 문자열로 찾는다.
- Test: 없음(grep AC7·AC10)

## Prep

- spec §2 릴리스 표면, §3 F7 README 항목, §4 D36, AC7·AC10. RL 최종 문면(task-06 이후)의 §2b·§finding ledger·§2i, 훅 문구(task-05).

## Deps

task-06.

## Steps

### 1. 10행 — 표 review-loop 행의 종료 목표

| 파일 | 원문 조각 | 교체 |
|---|---|---|
| README.md | `until zero unadjudicated critical/high findings remain.` | `until zero unadjudicated blocking (critical/high/medium) findings remain.` |
| README.ko.md | `(판정 없이 남은 critical/high 0까지)` | `(판정 없이 남은 blocking — critical/high/medium — 0까지)` |
| README.ja.md | `（未裁定の critical/high が 0 になるまで）` | `（未裁定の blocking — critical/high/medium — が 0 になるまで）` |

### 2. 83행 — review-loop 절 첫 문단

| 파일 | 원문 조각 | 교체 |
|---|---|---|
| README.md | `**"zero critical/high findings remain unadjudicated."**` | `**"zero blocking (critical/high/medium) findings remain unadjudicated."**` |
| README.ko.md | `**"판정 없이 남은 critical/high가 0"**` | `**"판정 없이 남은 blocking(critical/high/medium)이 0"**` |
| README.ja.md | `**「未裁定の critical/high が 0」**` | `**「未裁定の blocking（critical/high/medium）が 0」**` |

### 3. 89행 — plan 관문 적용 범위(마지막 문장)

| 파일 | 원문 문장 | 교체 |
|---|---|---|
| README.md | `The gate applies only in repos whose `CLAUDE.md` mandates split plans, and skips single-task changes.` | `Items ①②④ apply only in repos whose `CLAUDE.md` mandates split plans (and skip single-task changes); ③ — the fingerprint column in the inherited ledger — applies regardless of the split-plan convention whenever an inherited ledger exists.` |
| README.ko.md | `관문은 `CLAUDE.md`에 분할 plan 규약이 명시된 repo에서만 적용하며 단일 task 소형 변경은 예외다.` | `①②④는 `CLAUDE.md`에 분할 plan 규약이 명시된 repo에서만 적용하며 단일 task 소형 변경은 예외다. ③(승계 ledger의 fingerprint 컬럼)은 분할 규약과 무관하게 승계 ledger가 있으면 적용된다.` |
| README.ja.md | `ゲートは `CLAUDE.md` に分割 plan 規約が明記された repo でのみ適用し、単一タスクの小規模変更は例外とする。` | `①②④は `CLAUDE.md` に分割 plan 規約が明記された repo でのみ適用し、単一タスクの小規模変更は例外とする。③（継承 ledger の fingerprint 列）は分割規約と無関係に、継承 ledger があれば適用される。` |

### 4. 89행 뒤 — 0.18.0 신규 서술(F1·F5) 문단 삽입(빈 줄 + 문단 + 빈 줄)

README.md:
```markdown
Since 0.18.0, each round runs **detached**: the companion call is written to a wrapper script under `.remember/`, launched with a one-line node `spawn(detached)`, and its output, pid and a `COMPANION_EXIT:` marker land in files — the loop waits in the background and judges completion by the marker, so a Bash tool timeout or a dead waiter no longer loses the round. A round is valid only with the review header, the schema JSON and at least one command-execution log line; a sandbox-wide startup failure is an execution failure, not "zero findings". The companion path is resolved from the plugin registry every round. FIXED rows cite the fix commit **after** it lands (fix commit first, hash cited in the next commit), which removes the hash-only follow-up commits.
```
README.ko.md:
```markdown
0.18.0부터 라운드는 **분리 실행**된다: companion 호출을 `.remember/` 아래 래퍼 셸에 쓰고 node `spawn(detached)` 1줄로 띄우며, 출력·pid·`COMPANION_EXIT:` 마커가 파일에 남는다 — 루프는 백그라운드로 기다리고 마커로 완료를 판정하므로 Bash 도구 timeout이나 대기 프로세스 사망으로 라운드를 잃지 않는다. 라운드는 리뷰 헤더 + 스키마 JSON + 명령 실행 로그 ≥1건일 때만 유효하고, 샌드박스 전면 기동 실패는 "finding 0"이 아니라 실행 실패다. companion 경로는 라운드마다 플러그인 레지스트리에서 해소한다. FIXED 행의 해시 인용은 **수정 커밋 먼저, 다음 커밋에서 인용** 순서로 바뀌어 해시 전용 후속 커밋이 사라진다.
```
README.ja.md:
```markdown
0.18.0 からはラウンドを**分離実行**する: companion 呼び出しを `.remember/` 配下のラッパーシェルに書き、node の `spawn(detached)` 1 行で起動し、出力・pid・`COMPANION_EXIT:` マーカーをファイルに残す — ループはバックグラウンドで待ち、マーカーで完了を判定するため、Bash ツールの timeout や待機プロセスの死でラウンドを失わない。ラウンドはレビューヘッダー + スキーマ JSON + コマンド実行ログ 1 件以上があるときだけ有効で、サンドボックス全面の起動失敗は「finding 0」ではなく実行失敗である。companion のパスはラウンドごとにプラグインレジストリから解決する。FIXED 行のハッシュ引用は**修正コミットを先に、次のコミットで引用**する順序に変わり、ハッシュだけの後続コミットがなくなる。
```

### 5. 116행 — 빠른 종료 조건(인용 블록 두 번째 문단 마지막 괄호)

| 파일 | 원문 조각 | 교체 |
|---|---|---|
| README.md | `(only a clean track that never raised a finding terminates without one)` | `(only a clean track terminates without one — no FIXED and no loop-issued adjudication)` |
| README.ko.md | `(지적이 하나도 없던 클린 트랙만 확인 없이 즉시 종료)` | `(FIXED도 루프 직접 판정도 없는 클린 트랙만 확인 없이 즉시 종료)` |
| README.ja.md | `（指摘が一つも出なかったクリーンなトラックのみ確認なしで即終了）` | `（FIXED もループ直接裁定もないクリーンなトラックのみ確認なしで即終了）` |

### 6. 188행(단계 4 삽입 후 190행) — 훅 절 첫 문단 끝에 문장 추가(F6)

각 파일 188행(`Works immediately after installation…` / `설치하면 바로 동작한다…` / `インストールすればすぐ動く…`) 끝에 공백 1개 + 다음 문장을 붙인다:

- README.md: `Since 0.18.0 the nudge also states what it means: **finish only the current unit of work** (one review round, one SDD task, one fix, one question round) and start no new one; if a background job is running, do not `/clear` before it completes — when its completion wakes the session, record the result and stop, then hand over.`
- README.ko.md: `0.18.0부터 넛지는 그 의미도 말한다 — **현재 작업 단위만 마무리**(리뷰 라운드 1회·SDD task 1개·수정 1건·질문 라운드 1회)하고 새 단위를 시작하지 않는다. 백그라운드 작업이 진행 중이면 완료 전 `/clear`하지 않고, 완료 알림으로 깨어나면 결과를 기록만 하고 멈춘 뒤 인계한다.`
- README.ja.md: `0.18.0 からナッジはその意味も述べる — **現在の作業単位だけを終える**（レビューラウンド 1 回・SDD task 1 件・修正 1 件・質問ラウンド 1 回）こと、新しい単位を始めないこと。バックグラウンド作業が進行中なら完了前に `/clear` せず、完了通知で目覚めたら結果を記録するだけで止まり、その後に引き継ぐ。`

### 7. 자기 점검 + 커밋

```bash
for f in README.md README.ko.md README.ja.md; do echo "== $f"
  grep -c 'critical/high/medium' $f            # 2 (10행·83행)
  grep -c 'COMPANION_EXIT' $f                   # 1
  grep -c '0.18.0' $f                           # 2 (review-loop 절 + 훅 절)
  grep -n 'COMPANION_EXIT' $f | cut -d: -f1     # 3파일 모두 91행(0.10.0 문단 + 빈 줄 다음) — 같은 위치
  grep -n '0.18.0' $f | cut -d: -f1 | tr '\n' ' '; echo
done
grep -c 'zero critical/high findings\|critical/high가 0\|critical/high が 0' README.md README.ko.md README.ja.md   # 각 0
git add README.md README.ko.md README.ja.md
git commit -m "docs(readme): 3언어 동기 — blocking 정의·빠른 종료 조건·plan 관문 ③ 적용 범위 정정 + 0.18.0 신규 서술(분리 실행·마커 판정 / 수정 커밋 먼저 / 넛지 = 현재 단위만) (F7·D36)"
```

## Acceptance Criteria

```bash
for f in README.md README.ko.md README.ja.md; do
  grep -c 'critical/high/medium' $f; grep -c 'COMPANION_EXIT' $f; grep -c 'spawn(detached)' $f; grep -c '0.18.0' $f   # 2 · 1 · 1 · 2
done
diff <(grep -n 'COMPANION_EXIT' README.md | cut -d: -f1) <(grep -n 'COMPANION_EXIT' README.ko.md | cut -d: -f1) && diff <(grep -n 'COMPANION_EXIT' README.md | cut -d: -f1) <(grep -n 'COMPANION_EXIT' README.ja.md | cut -d: -f1) && echo SAME_POSITION   # D36 같은 위치
grep -c 'zero critical/high findings remain unadjudicated' README.md      # 0
grep -c 'never raised a finding' README.md                                 # 0
grep -c 'The gate applies only' README.md                                  # 0
grep -c '지적이 하나도 없던' README.ko.md; grep -c '指摘が一つも出なかった' README.ja.md   # 0 · 0
git log -1 --format=%B | grep -ciE 'co-authored|generated with|claude-session'   # 0
```

## Cautions

- **16행·188행의 "(default 40%)"·"(기본 40%)"·"（デフォルト 40%）"는 남긴다. 이유: 기본값 설명 — AC7 제외 대상.**
- **신규 서술을 한 언어에만 넣거나 위치를 달리하지 않는다. 이유: D36 "3언어 같은 위치" — AC의 행 번호 동일 검사가 이를 잡는다.**
- **README에 명령 원문(node 1줄·래퍼 셸)을 복사하지 않는다. 이유: 규약 SSOT는 SKILL.md — README는 서술 1~2문장(spec 릴리스 표면).**
- **codex 플러그인 버전(1.0.6) 요구를 README Requirements에 추가하지 않는다. 이유: 요구 범위는 RL 런타임 게이트(D8)이고, 이 task의 범위는 F7 정정 + 신규 서술 3건이다 — 필요하면 별도 follow-up.**
