# claude-dev-workflow

[English](README.md) | [한국어](README.ko.md) | **日本語**

実戦で検証された開発ワークフローツール群を、単一の Claude Code プラグイン **`dev-workflow`** としてまとめて配布するマーケットプレイス。一度インストールすれば**すべてのプロジェクト**で使える。

| ツール | 種類 | 呼び出し | 役割 |
|---|---|---|---|
| dev-cycle | skill | `/dev-workflow:dev-cycle` | 新機能の推奨パイプラインマップ（着手〜統合の全区間）+ 現在のステップ案内・小さな変更の軽量/正式パス判定（読み取り専用、ここから始める） |
| review-loop | skill | `/dev-workflow:review-loop` | spec/plan/impl の各段階完了後、コミット → codex 敵対的レビュー（既決事項ガードの自動注入で再指摘を抑止）→ 裁定・自動修正を反復し、確認ラウンドが修正の消滅とマージ可否を判定（未裁定の critical/high が 0 になるまで）。plan 段階のループは開始前に形式ゲート 4 種を通過させる |
| writing-plans-split | skill | `/dev-workflow:writing-plans-split` | 多段階の実装プランを薄いエントリポイント + タスク別ファイルに分割して作成 — 完了記録をコミット段階として契約化 |
| harden-spec | skill | `/dev-workflow:harden-spec` | plan・実装に進む前に spec ドラフトを敵対的に圧迫し、見逃したギャップ・前提・不変条件違反を掘り出して spec をその場で固める（project-aware） |
| ui-mockup | skill | `/dev-workflow:ui-mockup` | （オプション、ステップ 3.5）固めた spec が画面を新設・再構成する場合: 非実行の HTML モックアップを発散させてユーザーに選ばせ、UI の決定を spec に既決事項として記録 |
| setup | skill | `/dev-workflow:setup` | （明示的な依頼時のみ）このリポジトリの CLAUDE.md にパイプライン規約へのポインタを冪等に挿入 |
| doctor | skill | `/dev-workflow:doctor` | 環境4項目（インストール版・マーケットプレイス最新・codex・コンテキストウィンドウ）を読み取り専用で一括診断し、対処は既存の経路に委譲 |
| コンテキスト閾値ナッジ | Stop hook | （自動） | コンテキスト使用量が閾値（デフォルト 40%）を超えたらハンドオフ作成 + `/clear` を促し、以降は **15%p 区間ごとに再ナッジ**（40 → 55 → 70 → 85%、上限なし） |

## 目次

- [要件](#要件)
- [インストール](#インストール)
- [使い方](#使い方)
  - [dev-cycle](#1-dev-cycle--パイプラインマップここから始める)
  - [review-loop](#2-review-loop--敵対的レビューの反復ループ)
  - [writing-plans-split](#3-writing-plans-split--分割実装プラン)
  - [harden-spec](#4-harden-spec--spec硬化)
  - [ui-mockup](#5-ui-mockup--ui-モックアップ選択)
  - [setup](#6-setup--リポジトリへのパイプライン導入)
  - [doctor](#7-doctor--環境診断)
  - [コンテキスト閾値ハンドオフフック](#8-コンテキスト閾値ハンドオフフック自動)
- [リポジトリ clone 時の自動適用](#リポジトリ-clone-時の自動適用)
- [トラブルシューティング](#トラブルシューティング)
- [注意](#注意)
- [開発 / リリース](#開発--リリース)

## 要件

- **Claude Code v2.1.140 以上**を推奨（プラグイン依存関係機能を含む）。
- **codex プラグイン** — `review-loop` が codex の `adversarial-review` を呼び出すため、`codex@openai-codex` プラグインに依存する。`plugin.json` の `dependencies` で宣言されており、**インストール時に自動で同時インストール**される（ただし `openai-codex` マーケットプレイスが登録済みであること — 下記インストール参照）。
- **codex CLI の認証は別途必要** — プラグイン依存で入るのは codex *プラグイン*だけ。codex CLI 自体のインストール・ログイン（`/codex:setup`）を自分で行わないと `review-loop` は実際には動かない。`writing-plans-split`・コンテキストフックはこの認証なしで動作する。

## インストール

初回のみ。以下の行を**順番にそれぞれ**実行する（どちらか一方ではなく全部）。

```
# （codex を一度も使ったことがない人のみ）codex マーケットプレイスを登録:
/plugin marketplace add openai/codex-plugin-cc

# 本体:
/plugin marketplace add gguii74-rwk/claude-dev-workflow
/plugin install dev-workflow@claude-dev-workflow      # codex プラグインも依存関係として自動インストール
```

- `marketplace add` は「カタログ登録」（どこから取得するかを教える）で、`install` が「実際のインストール」。
- `dev-workflow@claude-dev-workflow` は `<プラグイン>@<マーケットプレイス>` 形式 — 前がプラグイン、後ろがマーケットプレイス（名前が似ているが別物）。
- user スコープ（デフォルト）でインストールすると全プロジェクトで有効になる。一度インストールすれば、以後のセッション・他プロジェクトで打ち直す必要はない。

**インストール確認:**

```
/plugin                                   # Manage タブで dev-workflow / codex を確認
# または CLI:
claude plugin list                        # dev-workflow@claude-dev-workflow, codex@openai-codex が見えれば OK
```

## 使い方

### 1. `dev-cycle` — パイプラインマップ（ここから始める）

新機能・大きな変更をどこからどの順で進めるべきか分からないときに呼ぶ。このツールキットの**推奨開発パイプライン**と**いまどのステップにいるか**を教える**読み取り専用マップ**（ファイルは変更しない）。

```
/dev-workflow:dev-cycle
```

推奨順序: **brainstorming → spec → harden-spec → ui-mockup（オプション — 画面が変わる場合のみ）→ review-loop(spec) → writing-plans-split → review-loop(plan) → subagent-driven-development → review-loop(impl) → 統合・後続検証**。段階境界（spec→plan、plan→impl）は新しいセッション + `/clear` が規約のため、dev-cycle は**現在のステップだけを案内し、次へはナッジ**する（1 セッションでのオートパイロットではない）。ステップ 1・7・9（brainstorming・subagent-driven-development・finishing-a-development-branch）は `superpowers` プラグインを推奨 — なければ独自の設計/実装/終了プロセスで代替可能（ハード依存ではない）。

0.11.0 から、マップは**着手から終了までの全区間**を覆う。**ステップ 9 — 統合・後続検証（PR・マージ・デプロイ・実測）** はチェック項目をここに複製せず、**そのリポジトリの規約を指すポインタ**である（デプロイ対象のないリポジトリ — プラグインなど — では、リリース + インストール更新の案内がその位置を占める）。着手時には **5 項目のブリーフ**（設計結論・実測根拠・変更対象ファイル・検証方法・ステップ 9 までの完了条件）を一度だけ**画面に出力するだけ**で、ファイルは作らない。さらに **軽量パス（fast lane）** が「全部かゼロか」の二分法を置き換える: 分岐軸は**接触面と可逆性であって規模ではない** — スキーマ・マイグレーション・権限・認証・セキュリティ境界・外部連携・データ破損/消失・不可逆な作業は、どれだけ小さくても正式パスだ（12 タスクの文言整理は軽量、1 タスクのカラム削除は正式）。どの軽量トラックも省略できない**下限 3 種 = spec ドキュメント・ステップ 3 harden-spec・ステップ 8 impl 敵対的レビュー**。その上のステップは**一つずつ個別に**省略し、**省略のたびに spec の既決事項ブロックに根拠を残す**。「いまどのステップか」の判別はその記録を読んでから答える — 記録のない不在は依然として未完だ。軽量パスの承認は**そのセッション限り**有効 — `/clear` 後は推定せず改めて確認し、拒否・曖昧な回答のデフォルトは正式パスである。確認そのものが不可能な運用（質問を届けられない非対話実行、ユーザーの不在・自律進行の明示）では、0.17.0 から**接触面スキャンが判定を代行する** — 明確に無シグナルなら軽量、シグナルがあるかスキャンが不明確なら正式（fail-closed）。自動判定で軽量パスに入るときは spec に監査記録を 1 行残す（再開時は記録の有無にかかわらず再スキャン）。

### 2. `review-loop` — 敵対的レビューの反復ループ

各段階の完了後に変更をコミットし、codex で敵対的レビューを回す。欠陥は自動修正するか裁定（disposition）で閉じながら、**「未裁定の critical/high が 0」**になるまで反復する。目標は「指摘 0」ではなく「未裁定 0」。

ループは **2 モード**で回る。序盤は**敵対（発掘）モード** — codex `adversarial-review` で漏れ・欠陥を掘り出す。敵対的レビューアは何度回しても finding 0 を返さないため、それだけでは終われない。そこで遷移シグナル（score 停滞 · 修正キュー枯渇 · 敵対予算の消尽）が発火すると**確認（中立）モード**へ移る — 目的関数が「マージ可能か判定」なので、修正したとされる項目が本当に消えたかを確認し、リグレッションと裁定の比例性を監査したうえで verdict を出す。「新規 blocking なし、修正確認済み」が正当な出力になり、終了が自然になる。

0.9.0 からは**敵対ラウンドごとに既決事項ガードをレビュー focus として自動注入**する — 再議論禁止ブロック全文 + 閉じた ledger 項目の要約行を毎ラウンド直前に再組み立てしてレビューコマンドに添付し、すでに閉じた項目の再指摘を源から抑止する（実測: ガードが diff 内にあっても同一項目が 5 ラウンド連続で再指摘された）。ループが直接下した裁定は確認ラウンドが優先監査し、誤裁定を見直す経路を保存する。

0.10.0 からは **plan 段階のループが最初のラウンドの前に形式ゲート 4 種**を通過する — エントリポイントの現行 `writing-plans-split` 実行契約ブロック（存在するかだけでなく、インストール済みスキルの canonical ブロックと突き合わせる。古いブロックはこのゲートが守ろうとしている保護そのものを欠いたまま通過しうる）、§Shared Contracts セクション、継承 ledger の fingerprint 列、タスク表の `status`・`outcome` 列。低コストな修正（ブロック置換・セクションや列の追加）はループ開始前に解消し、構造の書き直し（単一ファイル plan を分割へ組み替える必要がある場合）はループが検証外で大手術をせずユーザー判断に上げる。ゲートは `CLAUDE.md` に分割 plan 規約が明記された repo でのみ適用し、単一タスクの小規模変更は例外とする。

オプションはすべて任意 — `/dev-workflow:review-loop` だけでも動く。

| オプション | デフォルト | 役割 |
|---|---|---|
| `--phase spec\|plan\|impl` | 自動推論 | どの段階を検証するか。省略時は変更内容から推論 |
| `--base <ref>` | `main` | 敵対的レビューが比較する基準ブランチ（この diff を見る）。ループ開始時に SHA へ解決され、全ラウンドが同じスナップショットを見る |
| `--max <n>` | `5` | **敵対（発掘）ラウンドの上限。** 確認ラウンドはここに数えない |
| `--confirm-rounds <n>` | `2` | **確認ラウンドの予算。** ループ全体の累積で、再進入時にもリセットされない |
| `--auto-rounds <n>` | `3` | 序盤 n 回は**自動モード** — 欠陥を自動修正し、リスクのないユーザー判断はまとめて一括質問。`0`=毎ラウンド即質問、セキュリティ敏感な作業は `1` |
| `--resume` | — | 中断したループを `.remember/loop-*.md` の保存状態（ledger 含む）から再開 |

> **`--max` の意味が 0.8.0 で変わった。** 0.7.x までは全反復回数の絶対上限だったが、現在は**敵対ラウンドのみ**の上限。総ラウンド数は依然として有界だがより大きい — デフォルト基準で**最大 10 回**（敵対 5 + 確認 2 + 確認が blocking を見つけた場合の復帰敵対 1 + 再進入確認 1 + 新セッションで回るフォールバック② 確認 1）。実行回数を以前のように抑えたい場合は `--max` と `--confirm-rounds` を一緒に下げる。

```
/dev-workflow:review-loop --phase impl                   # 実装検証 (typecheck·lint·test·build ゲート後)
/dev-workflow:review-loop --phase spec --auto-rounds 1   # セキュリティ敏感 → 自動モード最小化
/dev-workflow:review-loop --base develop                 # main の代わりに develop 基準の diff
/dev-workflow:review-loop --max 3 --confirm-rounds 1     # ラウンド数を抑える (最大 7 回)
/dev-workflow:review-loop --resume                       # コンテキスト限界で切れたループの続き
```

**動作フロー** — 敵対ラウンドごとに: ① 未コミットの変更をコミット → ② codex 敵対的レビュー実行 → ③ finding を fingerprint で分類・裁定（FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE/ESCALATE）→ ④ FIXED は（impl なら TDD で）修正 → ⑤ ゲート再実行。遷移シグナルが発火すると確認モードへ移り、⑥ 未確認 FIXED キュー全件の消滅確認 → ⑦ リグレッション・裁定の監査 → ⑧ マージ可否 verdict。**未裁定 blocking 0 + 未確認 FIXED キューが空 + 確認 verdict 通過**の 3 つをすべて満たして終了する。

> 敵対的レビューは**コミット済みの HEAD（ブランチ diff）**を見る。未コミットのまま回すと直前の修正を見逃すため、ループは常に「修正 → コミット → レビュー」の順序を強制する。
>
> **修正しただけでは閉じない。** FIXED は確認ラウンドが「消滅」を明示的に記録して初めて確定する — 敵対ラウンドでその項目が再出現しなかったのは発掘の結果であって確認ではない。したがって FIXED が 1 件でもあったトラックは必ず確認ラウンドを通る（指摘が一つも出なかったクリーンなトラックのみ確認なしで即終了）。

### 3. `writing-plans-split` — 分割実装プラン

spec が準備できた状態で呼ぶと、大きな実装プランを**薄いエントリポイント + タスク別ファイル**に分割して作成する。数千行の単一 plan ファイルが作成・レビュー・実行のすべてに与える負担を避ける。

```
/dev-workflow:writing-plans-split
```

成果物の構造:

```
docs/plans/YYYY-MM-DD-<feature>.md     # 薄いエントリポイント（目標・アーキテクチャ・Shared Contracts・タスク表）
docs/plans/YYYY-MM-DD-<feature>/       # タスク本体
├── task-01-<slug>.md                  # 各ファイルが自己完結: Files・TDD ステップ・AC・Cautions
├── task-02-<slug>.md
└── task-NN-<slug>.md
```

実行は `superpowers:subagent-driven-development` で — ディスパッチャがエントリポイントの Shared Contracts + タスク 1 件ずつをサブエージェントに渡す。

0.10.0 からはエントリポイントの実行契約が**完了記録**も慣行ではなく手順として固定する。レビューがタスクを承認した後にのみ — 実装者の DONE 報告は完了ではない — ディスパッチャがその行を `[x]` にし、outcome を 1 行書いて**その場でエントリポイントをコミット**し、それから次のタスクをディスパッチする。再開時にはタスク表を SDD progress ledger と git log に突き合わせる: ledger に完了記録がないタスクは未完了として扱う — 実装コミットはレビュー承認より前にも存在するからだ。この規則は生きた ledger を前提とするため、ledger が失われた、または空のまま再生成された状態（`git clean -fdx` で失われたワークスペース、final review 後にクリーンアップされた場合）では、git log が矛盾を示さない行を一括で巻き戻さずコミット済みの表を権威とし、再構成した ledger が完了状態のみを復元する事実も併せて伝える。

### 4. `harden-spec` — spec硬化

brainstorming で得た **spec ドラフトを plan・実装に渡す前に**敵対的に圧迫し、後で発覚すると再設計を招くギャップ（見逃した要求・隠れた前提・エッジケース・モジュール横断の波及・不変条件違反）を掘り出して **spec をその場で補強**する。**project-aware** — 実行中リポジトリの `CLAUDE.md`・ADR・既存 spec を読み、*そのプロジェクトの*不変条件・既決事項で圧迫する。

```
/dev-workflow:harden-spec [spec パス]
```

**Fable 固定** — frontmatter（`model: fable` + `effort: max`）により、セッションのモデルに関係なく最強モデルで圧迫する。質問は**ハイブリッド** — リスクの高いギャップ（不可逆・モジュール横断・不変条件・AC 変更）は一つずつ深く、残りの判断ギャップは最大 4 問のバッチラウンド（AskUserQuestion）で**台帳が尽きるまで**尋ねる。事実はコードから直接調査し、判断が絡むギャップはすべてユーザーに尋ねる — **質問を経ない DEFERRED はない**。すでに決まったこと（ADR・既決事項）は蒸し返さない。ギャップが解消するたびに spec へ入れる文言を提案 → 承認時に反映し、終了時は残余リスク（DEFERRED）を明記してコミットし停止する（次の段階は新しいセッションを推奨）。`review-loop`（codex による成果物検証）の前段で、*人間にしか分からない見落とし*を先に埋める補完ツール。「この spec を固めて / 見落としを探して / pre-mortem」のような発話でも自動起動する。

### 5. `ui-mockup` — UI モックアップ選択

**オプションのステップ 3.5 — `harden-spec` の直後・`review-loop(spec)` の直前。** 固めた spec が**新しい画面を作る、または既存画面の構成を変える**場合に呼ぶ。自己完結型の**非実行**な静的 HTML モックアップを発散させてユーザーに選ばせ、その決定を spec の `## UI 設計` セクション + 再議論禁止（既決事項）ブロックに記録する — plan・実装が視覚方針を後から再解釈できないようにする仕掛けだ。選択結果は `docs/design/style-guide.md` に収束させ、機能ごとに UI が断片化するのを防ぐ。

```
/dev-workflow:ui-mockup [spec のパス]
```

発散の形はリポジトリの状態が決める: ガイドなし + 既存 UI なし → **異なるスタイル 4 案** / ガイドなし + 既存 UI あり → **維持（既存 UI からガイドを逆抽出）** か **リニューアル** をユーザーが選択 / ガイドあり → **レイアウト変形 2〜3 案**のみ。複数画面の spec は**代表画面 1 つだけ**を発散し、残りは確定後に生成するため、落選案にコストがかからない。発散は合計 2 ラウンドが上限。**ユーザーの確認なしに確定する経路はない** — 組み合わせ指定（「2 番のレイアウト + 4 番の色」）は 1 回だけ再生成して再確認し、複数画面の残りも spec に記録する前に最終確認を 1 回とる。成果物は `docs/design/<feature>/` に置かれ、候補・比較ページまで履歴としてコミットする。文言・色・単一コントロール程度の軽微な変更は完全にスキップし、対象 spec のない単独呼び出しは拒否して brainstorming → harden-spec の経路を案内する。

### 6. `setup` — リポジトリへのパイプライン導入

特定のリポジトリがこのパイプラインに従うことを**明示的に**採択するときに呼ぶ。プロジェクトの CLAUDE.md にマーカーブロックで**一行ポインタ**（`dev-cycle` へのポインタ + 未インストール者向けのインストール手順）を冪等に挿入する — ガイド全文はコピーしないため、規約本文が変わっても（SSOT = `dev-cycle`）各リポジトリの CLAUDE.md は古びない。

```
/dev-workflow:setup
```

続けて、コンテキスト閾値フックの**ウィンドウ幅**（`CLAUDE_CTX_LIMIT`）を尋ね、settings.json（グローバルまたはプロジェクト・選択制）に書き込む — フックは実行時にウィンドウ幅を判別できず既定で 1M を仮定するため、200k のモデルを使う場合は明示しないとナッジが適時に出ない。

明示的な依頼時のみ動作し、マーカーブロック外の内容には触れない。コラボレーターやプラグイン未インストールのユーザーも、CLAUDE.md を読むだけで規約とインストール方法が分かる。

### 7. `doctor` — 環境診断

パイプラインの環境が**静かに壊れていないか**を確認するときに呼ぶ。読み取り専用で、ユーザーの成果物や設定は書き換えない — 見つかった異常はすべて既存の経路（`/plugin update`・`/codex:setup`・`/dev-workflow:setup`）に委譲する。

```
/dev-workflow:doctor
```

明示的な呼び出しに加えて、**症状の発話**（「ナッジが出ない」「codex が動かない」「プラグインは最新か」「バージョン合ってる?」）でも起動する。点検は4項目 — ① インストール版（エントリ配列を全列挙し `user`・`project`・`local` の全スコープを漏らさず見る）② マーケットプレイスの最新性 ③ codex（CLI の有無・認証・companion の3点まで。それ以上は `codex doctor` に委譲）④ `CLAUDE_CTX_LIMIT` と**現在のモデル**の照合（フックは実行時にウィンドウサイズを知れないためこの検査ができない）。

**バージョン判定は `dev-workflow/` の subtree 比較で行う。** 単純な sha 比較は docs だけのコミットでも誤警報を出し、`git log` ベースの判定は revert 済みの履歴でツリーが同一でも「遅れている」と答える。根拠がない場合（ネットワーク失敗・`gitCommitSha` 欠落）は**「判定不可」**と記し、「最新」とは言わない。正常でもそうでなくても**4項目の表を必ず出力**し、プローブが1つ失敗しても残りを続けて4行を維持する — 環境が最も壊れている瞬間に何の情報も得られない、という事態を避けるためだ。

実行中の review-loop 内での codex 失敗は `review-loop` の管轄なので doctor は介入しない。「なぜ動かないの」のような漠然とした失敗文や、**他製品を主語にした**同じ語彙（「playwright プラグインは最新か」）にも反応しない。

### 8. コンテキスト閾値ハンドオフフック（自動）

インストールすればすぐ動く。設定不要。会話コンテキストの使用量が閾値（デフォルト 40%）を超えると、止まる前にハンドオフを書いて `/clear` するよう案内する — コンテキストが溢れて作業が切れる前の引き継ぎを助ける。0.12.0 からこのナッジは**一度きりではない**: 閾値より上では **15 パーセントポイントの区間ごとに再発火**する（40 → 55 → 70 → 85%、上限なし）。最初のナッジを流しても、auto-compact が走るまで無警告のままにはならない。再ナッジは指示内容を変えず事実だけを添える（以前に案内したこと、現在が何 % か）。使用率が 2 区間以上下がった場合 — auto-compact はセッション id を維持する — 新しいサイクルとみなし、閾値から再びナッジする。

環境変数で調整（任意）:

```
CLAUDE_CTX_THRESHOLD=0.5    # 閾値を 50% に (0〜1, デフォルト 0.4)
CLAUDE_CTX_LIMIT=200000     # コンテキストトークン上限を直接指定
                            # 未指定時: 1,000,000（最新モデル基準）。200k ウィンドウのモデルを
                            # 使うときのみ指定する — ウィンドウ幅は実行時に判別できないため自動検出しない
```

## リポジトリ clone 時の自動適用

コラボレーターがリポジトリを clone して trust したときにこのプラグインのインストールを自動でプロンプトするには、そのリポジトリの `.claude/settings.json` にマーケットプレイスと有効化を宣言する:

```json
{
  "extraKnownMarketplaces": {
    "claude-dev-workflow": {
      "source": { "source": "github", "repo": "gguii74-rwk/claude-dev-workflow" }
    },
    "openai-codex": {
      "source": { "source": "github", "repo": "openai/codex-plugin-cc" }
    }
  },
  "enabledPlugins": {
    "dev-workflow@claude-dev-workflow": true
  }
}
```

`openai-codex` を併せて宣言すると、マーケットプレイス横断の依存（codex）が自動解決される。コラボレーターは `/plugin marketplace add`・`/plugin install` を手で打つ必要はなく、フォルダ trust 時のインストールプロンプトを承認するだけでよい。

## トラブルシューティング

- **何が問題か分からないとき** — `/dev-workflow:doctor` が環境4項目（インストール版・マーケットプレイス最新・codex・コンテキストウィンドウ）を一度に照合する。以下の項目はその結果が指す対処である。
- **`marketplace add openai/codex-plugin-cc` で SSH 認証失敗**（`Permission denied (publickey)`）— すでに codex を使っているなら codex マーケットプレイスは `openai-codex` として登録済みで、この行自体が不要。`claude plugin marketplace list` で `openai-codex` が見えればスキップしてよい。SSH キーのない環境ではスラッシュコマンドが SSH を試みて失敗することがあるが、そもそも実行不要な作業。
- **`dependency-unsatisfied` または codex が入らない** — `openai-codex` マーケットプレイスが未登録の状態。`/plugin marketplace add openai/codex-plugin-cc` の後に `/plugin install dev-workflow@claude-dev-workflow` を再実行すれば依存が解決される。
- **`review-loop` が codex の段階で止まる** — codex CLI が未インストール/未認証。`/codex:setup` で設定する。
- **スキルが見えない** — `/plugin` の Manage タブで `dev-workflow` が enabled か確認し、だめなら `/reload-plugins` または Claude Code を再起動。（フック・スキル以外のコンポーネント変更は再起動後に反映）

## 注意

- user スコープでインストールすると、コンテキスト閾値の Stop フックが**すべてのプロジェクト**で動作する。ナッジのメッセージは `.remember/remember.md` へのハンドオフ作成を案内するため、`.remember/` を使わないプロジェクトではその文言が合わないだけで、動作は無害。
- `writing-plans-split` は分割 plan 規約を使うリポジトリを前提とする。単一 plan ファイルのリポジトリでは `superpowers:writing-plans` をそのまま使えばよい。

## 開発 / リリース

```
claude-dev-workflow/
├── .claude-plugin/marketplace.json   # マーケットプレイスカタログ（repo ルート）
├── dev-workflow/                     # プラグイン
│   ├── .claude-plugin/plugin.json    # name, version, dependencies(codex@openai-codex)
│   ├── skills/{dev-cycle,harden-spec,ui-mockup,writing-plans-split,review-loop,setup,doctor}/SKILL.md
│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}
├── README.md                         # 英語（デフォルト）
└── README.ko.md / README.ja.md       # 韓国語 / 日本語
```

`plugin.json` の `version` を上げたコミットでのみユーザーは更新を受け取る。version を省略すると git commit SHA がバージョンになり、毎コミットが新バージョン扱いになる。ユーザーは `/plugin update` またはバックグラウンド自動更新で更新する。

**README は 3 言語で維持する** — `README.md`（英語、デフォルト）/ `README.ko.md` / `README.ja.md`。内容を変えるときは **3 ファイルを一緒に更新**する（ドリフト防止）。
