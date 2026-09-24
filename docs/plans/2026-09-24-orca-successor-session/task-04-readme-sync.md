# task-04 — README 3종 §8 1.0.0 문단 + §주의 전역 설치 문구 교체 (F4, R5-4)

**목적**: README·README.ko·README.ja의 §8(컨텍스트 임계 핸드오프 훅) 끝에 1.0.0 문단(오르카 터미널이면 후계를 직접 띄우고 정지 · 후계 첫 동작 = 옛 세션 `/exit`→close · 실패 시 `/clear` 안내로 복귀 · 단계 경계 대상 밖 · 오르카 밖 현행)을 **3언어 같은 위치**에 넣고, §주의/Caveats/注意의 전역 설치 불릿("동작은 무해")을 오르카에서는 터미널 생성·프롬프트 파일 쓰기·옛 세션 종료가 자동으로 일어난다는 사실로 교체한다.

## Files

- Modify: `README.md` · `README.ko.md` · `README.ja.md` — 각 2곳: §8 환경변수 코드 블록 뒤(:203 ` ``` ` 닫힘 뒤, :205 `## …` 앞 빈 줄 사이)에 문단 삽입 · :237 첫 불릿 교체. 행 번호는 0.19.0 기준, 원문 문자열로 찾는다.
- Test: 없음(grep AC4)

## Prep

- spec §3 F4(1.0.0 문단 4요소 · §주의 문구 교체), §5 AC4, spec ledger R5-4(README 전역 설치 경고가 1.0.0 동작과 모순 — FIXED `b4ced82`). 엔트리포인트 SC-1. 훅 최종 문면(task-02)의 (2-1)·(2-3)·(2-4)·[폴백] — 문단이 서술하는 동작의 원천.
- 현행 확인: `for f in README.md README.ko.md README.ja.md; do grep -n '^### 8\.\|^## Auto-prompting\|^## 특정 repo\|^## リポジトリ clone\|동작은 무해\|behavior is harmless\|動作は無害' $f; done` → 각 파일 3건(192 · 205 · 237).

## Deps

task-03.

## Steps

### 1. §8 끝 — 1.0.0 문단 삽입 (코드 블록 닫힘 ` ``` ` 다음 빈 줄 뒤, `## …` 앞)

세 파일 모두 :203이 ` ``` `(환경변수 블록 닫힘), :204 빈 줄, :205 `## …`다. :204와 :205 사이에 **문단 1개 + 빈 줄**을 넣는다.

| 파일 | 삽입 문단 |
|---|---|
| README.md | `Since 1.0.0, in an **Orca terminal** (a session with `ORCA_TERMINAL_HANDLE`), the nudge's `/clear` guidance becomes an **automatic handover**: after writing the handoff, the session spawns a successor `claude` terminal in the same checkout (titled `<task>-<token>`), assembles the resume prompt as a file (`.remember/successor-<token>.prompt`), sends it, and stops. The successor's first action is to shut the old session down cleanly (send `/exit` → wait for exit → `terminal close`), and it runs no codex before that. If any step — preflight, create, boot, delivery — fails, the half-made terminal is cleaned up and the current `/clear` guidance is shown instead. Stage boundaries (spec→plan, plan→impl) are out of scope: the successor does not start another stage and asks you instead. Outside Orca, nothing changes.` |
| README.ko.md | `1.0.0부터 **오르카 터미널**(`ORCA_TERMINAL_HANDLE`이 있는 세션)에서는 넛지의 `/clear` 안내가 **자동 인계**로 바뀐다: 핸드오프를 쓴 뒤 같은 체크아웃에 후계 `claude` 터미널을 직접 띄우고(제목 `<작업명>-<토큰>`), 재개 프롬프트를 파일(`.remember/successor-<토큰>.prompt`)로 조립해 보낸 다음 정지한다. 후계의 첫 동작은 옛 세션을 정상 종료시키는 것(`/exit` 전송 → 종료 대기 → `terminal close`)이며, 그 전에는 codex를 실행하지 않는다. 사전 검증·생성·기동·전달 어느 단계가 실패하면 만들다 만 터미널을 정리하고 현행 `/clear` 안내로 돌아간다. 단계 경계(spec→plan, plan→impl)의 `/clear`는 대상이 아니다 — 후계는 다른 단계를 시작하지 않고 사용자에게 확인한다. 오르카 밖에서는 이전과 같다.` |
| README.ja.md | `1.0.0 からは **Orca ターミナル**（`ORCA_TERMINAL_HANDLE` があるセッション）では、ナッジの `/clear` 案内が**自動引き継ぎ**に変わる: ハンドオフを書いた後、同じチェックアウトに後継の `claude` ターミナルを直接起動し（タイトル `<作業名>-<トークン>`）、再開プロンプトをファイル（`.remember/successor-<トークン>.prompt`）として組み立てて送信し、停止する。後継の最初の動作は旧セッションを正常終了させること（`/exit` 送信 → 終了待ち → `terminal close`）で、それまで codex を実行しない。事前検証・作成・起動・送信のいずれかが失敗すれば、作りかけのターミナルを片付けて従来の `/clear` 案内に戻る。段階境界（spec→plan、plan→impl）の `/clear` は対象外 — 後継は別の段階を始めず、ユーザーに確認する。Orca の外では従来どおり。` |

```bash
python3 - <<'PY'
import re
P={
 'README.md':('## Auto-prompting the plugin when a repo is cloned','Since 1.0.0, in an **Orca terminal** (a session with `ORCA_TERMINAL_HANDLE`), the nudge\'s `/clear` guidance becomes an **automatic handover**: after writing the handoff, the session spawns a successor `claude` terminal in the same checkout (titled `<task>-<token>`), assembles the resume prompt as a file (`.remember/successor-<token>.prompt`), sends it, and stops. The successor\'s first action is to shut the old session down cleanly (send `/exit` → wait for exit → `terminal close`), and it runs no codex before that. If any step — preflight, create, boot, delivery — fails, the half-made terminal is cleaned up and the current `/clear` guidance is shown instead. Stage boundaries (spec→plan, plan→impl) are out of scope: the successor does not start another stage and asks you instead. Outside Orca, nothing changes.'),
 'README.ko.md':('## 특정 repo에서 clone 시 자동 적용','1.0.0부터 **오르카 터미널**(`ORCA_TERMINAL_HANDLE`이 있는 세션)에서는 넛지의 `/clear` 안내가 **자동 인계**로 바뀐다: 핸드오프를 쓴 뒤 같은 체크아웃에 후계 `claude` 터미널을 직접 띄우고(제목 `<작업명>-<토큰>`), 재개 프롬프트를 파일(`.remember/successor-<토큰>.prompt`)로 조립해 보낸 다음 정지한다. 후계의 첫 동작은 옛 세션을 정상 종료시키는 것(`/exit` 전송 → 종료 대기 → `terminal close`)이며, 그 전에는 codex를 실행하지 않는다. 사전 검증·생성·기동·전달 어느 단계가 실패하면 만들다 만 터미널을 정리하고 현행 `/clear` 안내로 돌아간다. 단계 경계(spec→plan, plan→impl)의 `/clear`는 대상이 아니다 — 후계는 다른 단계를 시작하지 않고 사용자에게 확인한다. 오르카 밖에서는 이전과 같다.'),
 'README.ja.md':('## リポジトリ clone 時の自動適用','1.0.0 からは **Orca ターミナル**（`ORCA_TERMINAL_HANDLE` があるセッション）では、ナッジの `/clear` 案内が**自動引き継ぎ**に変わる: ハンドオフを書いた後、同じチェックアウトに後継の `claude` ターミナルを直接起動し（タイトル `<作業名>-<トークン>`）、再開プロンプトをファイル（`.remember/successor-<トークン>.prompt`）として組み立てて送信し、停止する。後継の最初の動作は旧セッションを正常終了させること（`/exit` 送信 → 終了待ち → `terminal close`）で、それまで codex を実行しない。事前検証・作成・起動・送信のいずれかが失敗すれば、作りかけのターミナルを片付けて従来の `/clear` 案内に戻る。段階境界（spec→plan、plan→impl）の `/clear` は対象外 — 後継は別の段階を始めず、ユーザーに確認する。Orca の外では従来どおり。'),
}
for f,(anchor,para) in P.items():
    s=open(f,encoding='utf8').read()
    old='```\n\n'+anchor+'\n'   # §8 코드 블록 닫힘(:203) + 빈 줄(:204) + 다음 절 제목(:205)
    assert s.count(old)==1,(f,s.count(old))
    s=s.replace(old,'```\n\n'+para+'\n\n'+anchor+'\n')
    open(f,'w',encoding='utf8').write(s); print(f,'para inserted')
PY
```
(0.19.0: :203 ` ``` ` · :204 빈 줄 1개 · :205 `## …` — `python3 -c "L=open('README.md',encoding='utf8').read().split('\\n');print([L[i] for i in range(202,205)])"`로 확인한다. 이 문단 앞의 코드 블록 닫힘은 파일에서 `## …` 절 제목 직전의 유일한 ` ``` `이라 `old`는 정확히 1회 일치해야 한다 — 0이면 문면이 바뀐 것이니 멈춘다.)

### 2. §주의/Caveats/注意 첫 불릿 교체 (:237)

| 파일 | 원문 불릿 → 교체 불릿 |
|---|---|
| README.md | `- Installed at user scope, the context-threshold Stop hook runs in **every project**. The nudge message tells you to write a handoff to `.remember/remember.md`; in projects that don't use `.remember/`, only that wording is off — the behavior is harmless.` → `- Installed at user scope, the context-threshold Stop hook runs in **every project**. The nudge message tells you to write a handoff to `.remember/remember.md`, and **in an Orca terminal it goes further: after the nudge, a successor terminal is created, a `.remember/successor-<token>.prompt` file is written, and the old session is shut down (`/exit`) automatically** — in projects that don't use `.remember/`, that directory and file will still appear. Outside Orca, only the guidance text is shown and nothing runs automatically (same as before).` |
| README.ko.md | `- user 스코프로 설치하면 컨텍스트 임계 Stop 훅이 **모든 프로젝트**에서 동작한다. 넛지 메시지는 `.remember/remember.md`에 핸드오프를 쓰라고 안내하므로, `.remember/`를 쓰지 않는 프로젝트에서는 그 문구만 맞지 않을 뿐 동작은 무해하다.` → `- user 스코프로 설치하면 컨텍스트 임계 Stop 훅이 **모든 프로젝트**에서 동작한다. 넛지 메시지는 `.remember/remember.md`에 핸드오프를 쓰라고 안내하며, **오르카 터미널에서는 넛지 뒤 후계 터미널 생성·`.remember/successor-<토큰>.prompt` 파일 쓰기·옛 세션 종료(`/exit`)가 자동으로 일어난다** — `.remember/`를 쓰지 않는 프로젝트에서도 그 디렉터리와 파일이 생긴다. 오르카 밖에서는 안내 문구만 나오고 아무것도 자동으로 실행되지 않는다(현행과 같다).` |
| README.ja.md | `- user スコープでインストールすると、コンテキスト閾値の Stop フックが**すべてのプロジェクト**で動作する。ナッジのメッセージは `.remember/remember.md` へのハンドオフ作成を案内するため、`.remember/` を使わないプロジェクトではその文言が合わないだけで、動作は無害。` → `- user スコープでインストールすると、コンテキスト閾値の Stop フックが**すべてのプロジェクト**で動作する。ナッジのメッセージは `.remember/remember.md` へのハンドオフ作成を案内し、**Orca ターミナルではさらに、ナッジ後に後継ターミナルの作成・`.remember/successor-<トークン>.prompt` ファイルの書き込み・旧セッションの終了（`/exit`）が自動で起きる** — `.remember/` を使わないプロジェクトでもそのディレクトリとファイルが作られる。Orca の外では案内文が出るだけで何も自動実行されない（従来どおり）。` |

```bash
python3 - <<'PY'
R={
 'README.md':("- Installed at user scope, the context-threshold Stop hook runs in **every project**. The nudge message tells you to write a handoff to `.remember/remember.md`; in projects that don't use `.remember/`, only that wording is off — the behavior is harmless.",
              "- Installed at user scope, the context-threshold Stop hook runs in **every project**. The nudge message tells you to write a handoff to `.remember/remember.md`, and **in an Orca terminal it goes further: after the nudge, a successor terminal is created, a `.remember/successor-<token>.prompt` file is written, and the old session is shut down (`/exit`) automatically** — in projects that don't use `.remember/`, that directory and file will still appear. Outside Orca, only the guidance text is shown and nothing runs automatically (same as before)."),
 'README.ko.md':("- user 스코프로 설치하면 컨텍스트 임계 Stop 훅이 **모든 프로젝트**에서 동작한다. 넛지 메시지는 `.remember/remember.md`에 핸드오프를 쓰라고 안내하므로, `.remember/`를 쓰지 않는 프로젝트에서는 그 문구만 맞지 않을 뿐 동작은 무해하다.",
                 "- user 스코프로 설치하면 컨텍스트 임계 Stop 훅이 **모든 프로젝트**에서 동작한다. 넛지 메시지는 `.remember/remember.md`에 핸드오프를 쓰라고 안내하며, **오르카 터미널에서는 넛지 뒤 후계 터미널 생성·`.remember/successor-<토큰>.prompt` 파일 쓰기·옛 세션 종료(`/exit`)가 자동으로 일어난다** — `.remember/`를 쓰지 않는 프로젝트에서도 그 디렉터리와 파일이 생긴다. 오르카 밖에서는 안내 문구만 나오고 아무것도 자동으로 실행되지 않는다(현행과 같다)."),
 'README.ja.md':("- user スコープでインストールすると、コンテキスト閾値の Stop フックが**すべてのプロジェクト**で動作する。ナッジのメッセージは `.remember/remember.md` へのハンドオフ作成を案内するため、`.remember/` を使わないプロジェクトではその文言が合わないだけで、動作は無害。",
                 "- user スコープでインストールすると、コンテキスト閾値の Stop フックが**すべてのプロジェクト**で動作する。ナッジのメッセージは `.remember/remember.md` へのハンドオフ作成を案内し、**Orca ターミナルではさらに、ナッジ後に後継ターミナルの作成・`.remember/successor-<トークン>.prompt` ファイルの書き込み・旧セッションの終了（`/exit`）が自動で起きる** — `.remember/` を使わないプロジェクトでもそのディレクトリとファイルが作られる。Orca の外では案内文が出るだけで何も自動実行されない（従来どおり）。"),
}
for f,(old,new) in R.items():
    s=open(f,encoding='utf8').read(); assert s.count(old)==1,(f,s.count(old))
    open(f,'w',encoding='utf8').write(s.replace(old,new)); print(f,'caveat replaced')
PY
```

### 3. 자기 점검 + 커밋

```bash
for f in README.md README.ko.md README.ja.md; do echo "== $f"; grep -n '1\.0\.0' $f | cut -c1-60; grep -c 'successor-<' $f; grep -n '^## ' $f | sed -n '5,7p'; done
# 각 파일: 1.0.0 = 1건(§8 문단, :205 부근) · successor-< = 2건(§8 + §주의) · 절 제목 순서 불변
grep -c '동작은 무해\|behavior is harmless\|動作は無害' README.md README.ko.md README.ja.md    # 각 0 (AC4)
for f in README.md README.ko.md README.ja.md; do grep -n 'Since 1.0.0\|1.0.0부터\|1.0.0 からは' $f | cut -d: -f1; done   # 세 파일 같은 행 번호 (SAME_POSITION)
git diff --stat -- README.md README.ko.md README.ja.md      # 3 files, 각 +3 −1 부근
git add README.md README.ko.md README.ja.md
git commit -m "docs(readme): 1.0.0 — 오르카 터미널 후계 세션 자동 인계 문단(§8) + 전역 설치 주의 문구 교체(오르카에서는 터미널 생성·프롬프트 파일·옛 세션 종료가 자동) 3언어 동기 (F4)"
git log -1 --format=%B | grep -ciE '^(co-authored-by|claude-session): |generated with \[claude code\]\('   # 0
```

## Acceptance Criteria

```bash
for f in README.md README.ko.md README.ja.md; do grep -c 'ORCA_TERMINAL_HANDLE' $f; done       # 각 1  (AC4 — 1.0.0 문단)
for f in README.md README.ko.md README.ja.md; do grep -c 'successor-<' $f; done                # 각 2  (§8 + §주의)
grep -c '동작은 무해\|behavior is harmless\|動作は無害' README.md README.ko.md README.ja.md      # 각 0  (AC4 — R5-4)
L=$(for f in README.md README.ko.md README.ja.md; do grep -n 'Since 1.0.0\|1.0.0부터\|1.0.0 からは' $f | cut -d: -f1; done | sort -u | wc -l | tr -d ' '); [ "$L" = 1 ] && echo SAME_POSITION   # macOS wc는 앞에 공백을 붙인다
for f in README.md README.ko.md README.ja.md; do grep -c '^### 8\. ' $f; done                   # 각 1 (절 구조 불변)
git status --short | grep -v '^??' | wc -l                                                     # 0
```

## Cautions

- **한 언어만 고치고 끝내지 않는다. 이유: README 3종 동기 규약(§개발/릴리스 "3개 파일을 함께 갱신") — AC4 SAME_POSITION.**
- **§8 첫 문단("…`/clear` 하라고 안내한다")을 고쳐 쓰지 않는다. 이유: 그 문장은 오르카 밖 동작으로 여전히 참이고, 0.12.0·0.18.0 서술을 같은 문단에 누적해 온 관례(1.0.0은 별도 문단 — spec "§8 끝에").**
- **"동작은 무해" 문구를 부드럽게 남겨 두지 않는다. 이유: R5-4 — 오르카에서는 터미널 생성·파일 쓰기·옛 세션 종료가 실제로 일어난다. AC4 0건.**
- **`plugin.json`·`marketplace.json`·§개발/릴리스 트리를 여기서 손대지 않는다. 이유: 릴리스는 task-05.**
- **README에 후계 명령 원문(플래그)을 적지 않는다. 이유: 원본은 훅 문면(D6) — README는 동작 서술만(드리프트 방지).**
