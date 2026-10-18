# task-07 — README 3종 · manifest 설명 · 1.1.0 spec §7 포인터 (spec §3r · AC7)

**목적**: README 3종에 orchestrate를 싣고(스킬 표 행 · 목차 · 사용법 새 절 8 · 훅 절 8→9 · 세션 모드 문단 1.2.0 효과 · `--auto-rounds` 1구절 · 트리 · 개발 절 테스트 1줄 — 3언어 같은 구조), plugin.json·marketplace.json **description**에 orchestrate를 더하고, 1.1.0 spec §7 끝에 1.2.0 포인터 1줄을 남긴다. **version은 바꾸지 않는다**(task-08 릴리스 몫 — 사용자 판정 P2).

## Files

- Modify: `README.md` · `README.ko.md` · `README.ja.md` (HEAD `dfdd243` 기준 각 263행 — 3언어 같은 행 위치: 스킬 표 :15 doctor 행 · 목차 :30 훅 · `--auto-rounds` 행 :103 · `### 8.` 훅 :194 · 세션 모드 문단 :210 · 트리 :254~255 · 개발 절 :259)
- Modify: `dev-workflow/.claude-plugin/plugin.json` (description만) · `.claude-plugin/marketplace.json` (plugins[0].description만)
- Modify: `docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md` (§7 끝 :88 뒤 1줄)

## Prep

- spec §3r(README 항목 · manifest · 1.1.0 포인터 · 구버전 안내) · §4 AC7 · D9·D18(경고 1줄) · P2(엔트리포인트 재논의 금지 — README·설명은 구현 단계).
- 엔트리포인트 **SC-4**(테스트 명령 정본 — README 개발 절에 그대로 쓴다).
- 사용법 새 절 번호 = `### 8.` (doctor 7 뒤), 기존 훅 절은 `### 9.`로 밀리고 목차 앵커도 `#9-…`로 바뀐다(3언어 동일).

## Deps

04(사용법 절이 SKILL.md 절차 ①~⑤를 요약한다) · 05·06(세션 모드 문단이 효과 ②③을 설명한다).

## Steps

### 1. 실패 확인

```bash
grep -c 'dev-workflow:orchestrate' README.md README.ko.md README.ja.md
grep -c 'orchestrate' dev-workflow/.claude-plugin/plugin.json .claude-plugin/marketplace.json
```

기대: 전부 `0`.

### 2. README 3종 편집 적용

````bash
python3 - . <<'PY'
import sys

TEST_CMD = "node --test tests/orchestrate/orchestrate.test.mjs"
TREE_OLD = "│   ├── skills/{dev-cycle,harden-spec,ui-mockup,writing-plans-split,review-loop,setup,doctor}/SKILL.md\n│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}\n"

L = {
"README.md": dict(
    row_anchor="| doctor | skill | `/dev-workflow:doctor` |",
    row="| orchestrate | skill | `/dev-workflow:orchestrate` | (1.2.0+) Shared procedure for a **main session** that runs tracks in Orca terminals — launch · watch · question routing · stage-end verification and handoff · successors (project rules come first) |",
    toc_old="  - [Context-threshold handoff hook](#8-context-threshold-handoff-hook-automatic)\n",
    toc_new="  - [orchestrate](#8-orchestrate--main-session-track-operation)\n  - [Context-threshold handoff hook](#9-context-threshold-handoff-hook-automatic)\n",
    hook_old="### 8. Context-threshold handoff hook (automatic)\n",
    hook_new="### 9. Context-threshold handoff hook (automatic)\n",
    section="""### 8. `orchestrate` — main-session track operation

(1.2.0+) For a **main session** that runs pipeline tracks in separate Orca terminals: launch → watch → route questions → verify and hand off at the stage boundary → successors. It is the shared procedure only — **project rules come first** (repo id, branches, worktree policy, prompt file location, model allocation and permission flags live in the project's CLAUDE.md or project skill). Orca command details are not copied into the skill — it points to `orca skills get orca-cli`.

```
/dev-workflow:orchestrate <track · stage · spec path>
```

- **① Launch** — look up the installed version for that checkout (lookup only), pick the mode (human stages = manual, review-loop(spec) on = delegated), set the model with `--model` only (never send `/model` to a track — it is saved as the new-session default in your global settings.json) and the session id with `--session-id`, fill in the bundled track-prompt template, then create the terminal and send a one-line pointer to the prompt file. One track per checkout.
- **② Watch** — one background `watch` run per wait; verdict `DONE | HANDOFF | SETTLED | QUESTION | PERMISSION | TIMEOUT | ERR`.
- **③ Questions** — human stages and manually run tracks: everything goes to you. Delegated tracks: only risky questions (critical · security · direction · AC/goal/non-goal/decision changes · `[감사 이의]` audit objections · permission prompts) reach you. Push · other-machine changes · external runs · irreversible steps: always you. Before every send: `alive`, then re-read the screen.
- **④ Stage end** — the main session verifies the track's report itself (commit range · gates · no AI trailers · diff scope · the confirmation-pending ledger), asks you about pending entries, writes the handoff, and stops at the stage boundary.
- **⑤ Successors · pairing · multiple tracks** — resumes a `HANDOFF` automatically only when its reason is the nudge and only after the old session has exited, recovers an unexpectedly exited track with `claude --resume <session id>`, and runs remote tracks via `--environment`.

Bundled script `scripts/orchestrate.mjs` (the only place Orca details live): `watch` (track state), `alive` (is the terminal **and** the claude session alive — exit 0 alive / 1 exited / 2 unreadable / 3 stale handle), `key` (TUI keys `enter` `tab` `shift-tab` `up` `down` `text`). Bundled template `templates/track-prompt.md` (role · files · decisions · scope · review-loop arguments · fact check · stop conditions · `[TRACK-DONE …]` / `[TRACK-HANDOFF …]` markers · nudge behavior).

> ⚠️ The default launch command for a delegated track includes `--dangerously-skip-permissions` — nobody is there to click permission prompts. The safety net is the prompt's stop conditions (no push, no irreversible steps) and the routing rows that always ask you; a permission prompt that still appears is never approved by the main session (it is auto-denied if you are away).

""",
    auto_old="use `1` for security-sensitive work |",
    auto_new="use `1` for security-sensitive work. In delegated mode (1.2.0+) the track answers the batch itself — only risky items reach a person |",
    mode_old="**Delegated mode has one effect in 1.1.0**: even in an Orca terminal, the nudge is the same `/clear` guidance as outside Orca instead of the automatic handover (no effect outside Orca). Further effects, such as auto-adopting the recommended answer for non-risky questions, will be added to this mode in a later version.",
    mode_new="**Delegated-mode effects (1.2.0)**: ① even in an Orca terminal, the nudge is the same `/clear` guidance as outside Orca instead of the automatic handover — the orchestrator launches the successor (1.1.0; no effect outside Orca) ② review-loop and dev-cycle auto-adopt the recommended answer for non-risky questions — risky ones (critical · security · direction · AC/goal/non-goal/decision changes) are still asked, and every auto-adopted decision is recorded with the source `추천 자동 채택(위임)` (auto-adopted recommendation) and is an audit target of the confirmation round ③ those decisions are collected in a **confirmation-pending ledger** (`## 확인 대기 대장` at the end of the spec/plan) that you confirm or overturn at the stage boundary. A 1.1.x install gets ① only.",
    tree_new="│   ├── skills/{dev-cycle,harden-spec,ui-mockup,writing-plans-split,review-loop,setup,doctor,orchestrate}/SKILL.md\n│   ├── skills/orchestrate/{SKILL.md,scripts/orchestrate.mjs,templates/track-prompt.md}\n│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}\n├── tests/orchestrate/                # orchestrate.mjs tests (stub orca — outside the plugin)\n",
    dev_anchor="Users update via `/plugin update` or background auto-update.\n",
    dev_line="\nTests: `" + TEST_CMD + "` (orchestrate script — a stub `orca` stands in, no real Orca needed; this repo has no npm gate).\n",
),
"README.ko.md": dict(
    row_anchor="| doctor | skill | `/dev-workflow:doctor` |",
    row="| orchestrate | skill | `/dev-workflow:orchestrate` | (1.2.0 이상) **메인 세션**이 트랙을 오르카 터미널로 운영하는 공통 절차 — 기동 · 감시 · 질문 라우팅 · 단계 종료 검증·핸드오프 · 후계 (프로젝트 규약 우선) |",
    toc_old="  - [컨텍스트 임계 핸드오프 훅](#8-컨텍스트-임계-핸드오프-훅-자동)\n",
    toc_new="  - [orchestrate](#8-orchestrate--메인-세션의-트랙-운영)\n  - [컨텍스트 임계 핸드오프 훅](#9-컨텍스트-임계-핸드오프-훅-자동)\n",
    hook_old="### 8. 컨텍스트 임계 핸드오프 훅 (자동)\n",
    hook_new="### 9. 컨텍스트 임계 핸드오프 훅 (자동)\n",
    section="""### 8. `orchestrate` — 메인 세션의 트랙 운영

(1.2.0 이상) **메인 세션**이 파이프라인 트랙을 별도 오르카 터미널로 띄워 기동 → 감시 → 질문 라우팅 → 단계 경계의 검증·핸드오프 → 후계까지 운영하는 공통 절차다. 공통 절차만 담는다 — **프로젝트 규약 우선**(repo id·브랜치·워크트리 정책·프롬프트 파일 위치·모델 배분·권한 플래그는 그 프로젝트의 CLAUDE.md·프로젝트 스킬이 정한다). 오르카 명령 상세는 스킬에 복사하지 않고 `orca skills get orca-cli`를 가리킨다.

```
/dev-workflow:orchestrate <트랙 · 단계 · spec 경로>
```

- **① 기동** — 그 체크아웃의 설치 버전을 조회만 하고, 모드를 고르고(사람 단계 = 수동, review-loop(spec)부터 = 위임), 모델은 `--model`로만(트랙에 `/model`을 보내지 않는다 — 새 세션 기본값으로 저장돼 전역 settings.json을 바꾼다), 세션 id는 `--session-id`로 정한 뒤, 동봉 템플릿으로 트랙 프롬프트를 채워 터미널을 만들고 프롬프트 파일 포인터 한 줄을 보낸다. 체크아웃당 트랙 1개.
- **② 감시** — 대기마다 `watch`를 백그라운드로 1회. 판정 `DONE | HANDOFF | SETTLED | QUESTION | PERMISSION | TIMEOUT | ERR`.
- **③ 질문** — 사람 단계와 수동으로 돌리는 트랙은 전부 사용자에게. 위임 트랙은 위험군(critical · 보안 · 방향 전제 · AC·목표·비목표·기결정 변경 · `[감사 이의]` · 권한 프롬프트)만 사용자에게. push · 다른 머신 변경 · 외부 실측 · 비가역은 언제나 사용자. 모든 전송 직전 `alive` 후 화면 재확인.
- **④ 단계 종료** — 메인이 트랙 보고를 직접 검증(커밋 범위 · 게이트 · AI 서명 · diff 범위 · 확인 대기 대장)하고 대기 항목을 사용자에게 물은 뒤 핸드오프를 쓰고 단계 경계에서 멈춘다.
- **⑤ 후계 · 페어링 · 다중 트랙** — `HANDOFF`는 사유가 넛지일 때만, 옛 세션 종료를 확인한 뒤에 자동 재개하고, 예기치 않게 끝난 트랙은 `claude --resume <세션 id>`로 복구하며, 원격 트랙은 `--environment`로 운영한다.

동봉 스크립트 `scripts/orchestrate.mjs`(오르카 상세의 유일한 거처): `watch`(트랙 상태) · `alive`(터미널 **과** claude 세션 생존 — exit 0 생존 / 1 종료 / 2 판독 불가 / 3 stale 핸들) · `key`(TUI 키 `enter` `tab` `shift-tab` `up` `down` `text`). 동봉 템플릿 `templates/track-prompt.md`(역할 · 읽을 파일 · 기결정 · 진행 범위 · review-loop 인자 · 사실 확인 · 정지 조건 · `[TRACK-DONE …]`/`[TRACK-HANDOFF …]` 표지 · 넛지 시 행동).

> ⚠️ 위임 트랙의 기동 명령 기본값에는 `--dangerously-skip-permissions`가 들어 있다 — 권한 창을 누를 사람이 없어서다. 안전장치는 프롬프트의 정지 조건(push 금지·비가역 금지)과 언제나 사용자에게 묻는 라우팅 행이고, 그래도 뜨는 권한 창은 메인이 허용하지 않는다(사용자 부재면 자동 거부된다).

""",
    auto_old="`0`=매 라운드 즉시 질문, 보안 민감 작업은 `1` |",
    auto_new="`0`=매 라운드 즉시 질문, 보안 민감 작업은 `1`. 위임 모드(1.2.0 이상)는 batch 답을 트랙이 낸다 — 위험군만 사람에게 |",
    mode_old="**1.1.0의 위임 효과는 하나**: 오르카 터미널에서도 자동 인계 대신 오르카 밖과 같은 `/clear` 안내 넛지를 받는다(오르카 밖에서는 효과 없음). 위험군 외 질문의 추천안 자동 채택 같은 효과는 후속 버전에서 이 모드에 더해진다.",
    mode_new="**위임 효과(1.2.0)**: ① 오르카 터미널에서도 자동 인계 대신 오르카 밖과 같은 `/clear` 안내 넛지를 받는다 — 후계는 오케스트레이터가 띄운다(1.1.0, 오르카 밖에서는 효과 없음) ② review-loop·dev-cycle이 위험군 외 질문의 추천안을 자동 채택한다 — 위험군(critical·보안·방향 전제·AC·목표·비목표·기결정 변경)은 여전히 묻고, 자동 채택한 결정은 출처 `추천 자동 채택(위임)`으로 기록되어 확인 라운드의 감사 대상이 된다 ③ 그 결정은 **확인 대기 대장**(spec·plan 말미 `## 확인 대기 대장`)에 모여 단계 경계에서 사용자가 확인·번복한다. 1.1.x 설치본은 ①만 받는다.",
    tree_new="│   ├── skills/{dev-cycle,harden-spec,ui-mockup,writing-plans-split,review-loop,setup,doctor,orchestrate}/SKILL.md\n│   ├── skills/orchestrate/{SKILL.md,scripts/orchestrate.mjs,templates/track-prompt.md}\n│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}\n├── tests/orchestrate/                # orchestrate.mjs 테스트(스텁 orca — 플러그인 밖)\n",
    dev_anchor="사용자는 `/plugin update` 또는 백그라운드 자동 업데이트로 갱신한다.\n",
    dev_line="\n테스트: `" + TEST_CMD + "`(orchestrate 스크립트 — 스텁 `orca`로 돌아 실제 오르카 불필요, 이 repo에는 npm 게이트가 없다).\n",
),
"README.ja.md": dict(
    row_anchor="| doctor | skill | `/dev-workflow:doctor` |",
    row="| orchestrate | skill | `/dev-workflow:orchestrate` | （1.2.0 以上）**メインセッション**がトラックを Orca ターミナルで運用する共通手順 — 起動 · 監視 · 質問ルーティング · 段階終了の検証・ハンドオフ · 後継（プロジェクト規約優先） |",
    toc_old="  - [コンテキスト閾値ハンドオフフック](#8-コンテキスト閾値ハンドオフフック自動)\n",
    toc_new="  - [orchestrate](#8-orchestrate--メインセッションのトラック運用)\n  - [コンテキスト閾値ハンドオフフック](#9-コンテキスト閾値ハンドオフフック自動)\n",
    hook_old="### 8. コンテキスト閾値ハンドオフフック（自動）\n",
    hook_new="### 9. コンテキスト閾値ハンドオフフック（自動）\n",
    section="""### 8. `orchestrate` — メインセッションのトラック運用

（1.2.0 以上）**メインセッション**がパイプラインのトラックを別の Orca ターミナルで起動し、起動 → 監視 → 質問ルーティング → 段階境界での検証・ハンドオフ → 後継まで運用する共通手順。共通手順だけを持つ — **プロジェクト規約優先**（repo id・ブランチ・ワークツリー方針・プロンプトファイルの場所・モデル配分・権限フラグはそのプロジェクトの CLAUDE.md・プロジェクトスキルが決める）。Orca コマンドの詳細はスキルに複製せず `orca skills get orca-cli` を指す。

```
/dev-workflow:orchestrate <トラック · 段階 · spec パス>
```

- **① 起動** — そのチェックアウトのインストール版を照会のみ行い、モードを選び（人の段階 = 手動、review-loop(spec) から = 委任）、モデルは `--model` のみで（トラックに `/model` を送らない — 新しいセッションのデフォルトとして保存され、グローバル settings.json を変える）、セッション id は `--session-id` で決めてから、同梱テンプレートでトラックプロンプトを埋めてターミナルを作り、プロンプトファイルへのポインタ 1 行を送る。チェックアウトごとにトラック 1 つ。
- **② 監視** — 待機ごとに `watch` をバックグラウンドで 1 回。判定 `DONE | HANDOFF | SETTLED | QUESTION | PERMISSION | TIMEOUT | ERR`。
- **③ 質問** — 人の段階と手動で回すトラックはすべてユーザーへ。委任トラックはリスク群（critical · セキュリティ · 方向の前提 · AC・目標・非目標・既決定の変更 · `[감사 이의]`（監査異議）· 権限プロンプト）のみユーザーへ。push · 他マシンの変更 · 外部実測 · 不可逆は常にユーザー。すべての送信の直前に `alive`、その後画面を再確認。
- **④ 段階終了** — メインがトラックの報告を自ら検証し（コミット範囲 · ゲート · AI 署名 · diff 範囲 · 確認待ち台帳）、待ち項目をユーザーに尋ねてからハンドオフを書き、段階境界で止まる。
- **⑤ 後継 · ペアリング · 複数トラック** — `HANDOFF` は理由がナッジのときだけ、旧セッションの終了を確認してから自動再開し、予期せず終了したトラックは `claude --resume <セッション id>` で復旧し、リモートトラックは `--environment` で運用する。

同梱スクリプト `scripts/orchestrate.mjs`（Orca 詳細の唯一の置き場）: `watch`（トラック状態）· `alive`（ターミナル**と** claude セッションの生存 — exit 0 生存 / 1 終了 / 2 判読不能 / 3 stale ハンドル）· `key`（TUI キー `enter` `tab` `shift-tab` `up` `down` `text`）。同梱テンプレート `templates/track-prompt.md`（役割 · 読むファイル · 既決定 · 進行範囲 · review-loop 引数 · 事実確認 · 停止条件 · `[TRACK-DONE …]`/`[TRACK-HANDOFF …]` 標識 · ナッジ時の行動）。

> ⚠️ 委任トラックの起動コマンドのデフォルトには `--dangerously-skip-permissions` が入っている — 権限ダイアログを押す人がいないからだ。安全装置はプロンプトの停止条件（push 禁止・不可逆禁止）と常にユーザーに尋ねるルーティング行で、それでも出る権限ダイアログはメインが許可しない（ユーザー不在なら自動拒否される）。

""",
    auto_old="`0`=毎ラウンド即質問、セキュリティ敏感な作業は `1` |",
    auto_new="`0`=毎ラウンド即質問、セキュリティ敏感な作業は `1`。委任モード（1.2.0 以上）は batch の答えをトラックが出す — リスク群のみ人へ |",
    mode_old="**1.1.0 の委任の効果は 1 つ**: Orca ターミナルでも自動引き継ぎの代わりに Orca の外と同じ `/clear` 案内ナッジを受ける（Orca の外では効果なし）。リスク群以外の質問の推奨案自動採用などの効果は後続バージョンでこのモードに追加される。",
    mode_new="**委任の効果（1.2.0）**: ① Orca ターミナルでも自動引き継ぎの代わりに Orca の外と同じ `/clear` 案内ナッジを受ける — 後継はオーケストレーターが起動する（1.1.0、Orca の外では効果なし）② review-loop・dev-cycle がリスク群以外の質問の推奨案を自動採用する — リスク群（critical・セキュリティ・方向の前提・AC・目標・非目標・既決定の変更）は引き続き質問し、自動採用した決定は出典 `추천 자동 채택(위임)`（推奨の自動採用）で記録され確認ラウンドの監査対象になる ③ その決定は**確認待ち台帳**（spec・plan 末尾の `## 확인 대기 대장`）に集まり、段階境界でユーザーが確認・撤回する。1.1.x のインストールは ① のみ。",
    tree_new="│   ├── skills/{dev-cycle,harden-spec,ui-mockup,writing-plans-split,review-loop,setup,doctor,orchestrate}/SKILL.md\n│   ├── skills/orchestrate/{SKILL.md,scripts/orchestrate.mjs,templates/track-prompt.md}\n│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}\n├── tests/orchestrate/                # orchestrate.mjs のテスト（スタブ orca — プラグインの外）\n",
    dev_anchor="ユーザーは `/plugin update` またはバックグラウンド自動更新で更新する。\n",
    dev_line="\nテスト: `" + TEST_CMD + "`（orchestrate スクリプト — スタブ `orca` で動き実際の Orca は不要、この repo には npm ゲートがない）。\n",
),
}

root = sys.argv[1]
for name, d in L.items():
    p = f"{root}/{name}"
    s = open(p, encoding='utf-8').read()
    def rep(old, new):
        global s
        n = s.count(old)
        assert n == 1, (name, n, old[:50])
        s = s.replace(old, new)
    # 스킬 표: doctor 행 바로 뒤에 orchestrate 행
    i = s.index(d["row_anchor"]); j = s.index("\n", i) + 1
    assert s.count(d["row_anchor"]) == 1
    s = s[:j] + d["row"] + "\n" + s[j:]
    rep(d["toc_old"], d["toc_new"])
    rep(d["hook_old"], d["section"] + d["hook_new"])
    rep(d["auto_old"], d["auto_new"])
    rep(d["mode_old"], d["mode_new"])
    rep(TREE_OLD, d["tree_new"])
    rep(d["dev_anchor"], d["dev_anchor"] + d["dev_line"])
    open(p, 'w', encoding='utf-8').write(s)
    print("applied", name)
PY
````

기대 출력: `applied README.md` · `applied README.ko.md` · `applied README.ja.md`.

### 3. manifest description

`dev-workflow/.claude-plugin/plugin.json`의 `description` 값에서

```
환경 진단(doctor), 컨텍스트 임계 핸드오프 넛지(Stop 훅).
```

를

```
환경 진단(doctor), 오케스트레이터 공통 절차(orchestrate), 컨텍스트 임계 핸드오프 넛지(Stop 훅).
```

로 바꾼다(Edit 도구, 그 외 키 불변 — `"version": "1.1.1"` 그대로).

`.claude-plugin/marketplace.json`의 plugins[0] `description`에서

```
"dev-cycle · harden-spec · ui-mockup · review-loop · writing-plans-split · setup · doctor 스킬 + 컨텍스트 임계 Stop 훅. review-loop는 codex 플러그인을 의존."
```

를

```
"dev-cycle · harden-spec · ui-mockup · review-loop · writing-plans-split · setup · doctor · orchestrate 스킬 + 컨텍스트 임계 Stop 훅. review-loop는 codex 플러그인을 의존."
```

로 바꾼다.

### 4. 1.1.0 spec §7 포인터

`docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md`의 §7 마지막 불릿(`- **후속(별도 경량 트랙 1.1.1 패치 — …)**: … → 1.1.1 트랙 \`docs/specs/2026-10-17-skill-positional-arg-substitution.md\``) **바로 다음 줄**에 아래 1줄을 넣는다(Edit 도구, 기존 줄 불변):

```
- **후속(위임 모드 효과 2 + orchestrate 스킬)**: 위 「내용」·「접점」은 → 1.2.0 트랙 `docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md`
```

### 5. 검증 (AC7)

```bash
for f in README.md README.ko.md README.ja.md; do
  echo "== $f"
  for p in '| orchestrate | skill | `/dev-workflow:orchestrate` |' '](#8-orchestrate--' '### 8. `orchestrate` — ' '### 9. ' '--dangerously-skip-permissions' '`watch`' '`alive`' '`key`' 'templates/track-prompt.md' 'orca skills get orca-cli' \
    'skills/orchestrate/{SKILL.md,scripts/orchestrate.mjs,templates/track-prompt.md}' '├── tests/orchestrate/' 'node --test tests/orchestrate/orchestrate.test.mjs' '1.2.0'; do
    printf '%s %s\n' "$(grep -cF -- "$p" $f)" "$p"; done | awk '$1==0{print "MISSING:", $0; bad=1} END{if(!bad) print "ALL_PRESENT"}'
  grep -cE 'later version|後続バージョン|후속 버전에서' $f
  grep -cF -- '--dangerously-skip-permissions' $f
done
grep -F 'Delegated-mode effects (1.2.0)' README.md | grep -c 'audit'; grep -F '위임 효과(1.2.0)' README.ko.md | grep -c '감사'; grep -F '委任の効果（1.2.0）' README.ja.md | grep -c '監査'   # 세션 모드 문단 줄만 — README 전체는 HEAD에서 이미 각 4건
diff <(grep -n '^#' README.md | cut -d: -f1) <(grep -n '^#' README.ko.md | cut -d: -f1) && diff <(grep -n '^#' README.md | cut -d: -f1) <(grep -n '^#' README.ja.md | cut -d: -f1) && echo SAME_HEADING_LINES
node -e 'for (const f of ["dev-workflow/.claude-plugin/plugin.json",".claude-plugin/marketplace.json"]) { const j=JSON.parse(require("fs").readFileSync(f,"utf8")); console.log(f, JSON.stringify(j).includes("orchestrate"), j.version ?? j.plugins[0].name); }'
grep -c '1.2.0 트랙 `docs/specs/2026-10-17-orchestrate-skill-delegated-auto-adopt.md`' docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md
```

기대: 3언어 각 `ALL_PRESENT` · 「후속 버전」류 `0` · 경고 `1` / 세션 모드 문단(위임 효과(1.2.0) 줄)의 audit·감사·監査 각 `1` 이상 / `SAME_HEADING_LINES` / plugin.json `true 1.1.1` · marketplace.json `true dev-workflow` / 포인터 `1`.

### 6. 커밋 (2개)

```bash
git add README.md README.ko.md README.ja.md dev-workflow/.claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "docs(readme): orchestrate 3언어 — 스킬 표 행·목차·사용법 절 8(절차 ①~⑤·프로젝트 규약 우선·orca-cli 포인터·스크립트 서브커맨드 3개·템플릿·위임 기동 --dangerously-skip-permissions 경고 1줄), 훅 절 9, 세션 모드 위임 효과(1.2.0)·--auto-rounds 1구절·트리·테스트 명령; plugin.json·marketplace.json description에 orchestrate(version 불변)(spec §3r·AC7)"
git add docs/specs/2026-10-10-review-loop-security-arg-successor-optout.md
git commit -m "docs(spec): 1.1.0 spec §7 끝에 1.2.0 트랙 포인터 1줄(spec §3r)"
```

## Acceptance Criteria

- 단계 5 기대 출력 그대로 (AC7 전부 + 1.1.0 포인터).
- `git diff HEAD~2 --stat` → README 3 · plugin.json · marketplace.json · 1.1.0 spec, 6파일.

## Cautions

- **plugin.json `version`을 올리지 마라.** 이유: P2 — 버전 숫자는 8 review-loop(impl) 종결 뒤 task-08 릴리스 몫이다. 지금 올리면 미검증 커밋이 업데이트로 배포될 수 있다.
- **3언어 중 하나만 고치거나 구조를 다르게 두지 마라.** 이유: README 3언어 동기 규약(개발 절) — `SAME_HEADING_LINES`가 깨지면 드리프트다.
- **세션 모드 문단의 다른 문장(접두 설정·PowerShell·settings env 주의)을 바꾸지 마라.** 이유: 1.1.0 AC5 문면 — 이번 변경은 「위임 효과」 문장 교체 1곳뿐이다.
- **1.1.0 spec §7의 기존 줄을 고치지 마라.** 이유: 종결된 트랙 문서 — 포인터 1줄 추가만(1.1.1 D10 선례).
