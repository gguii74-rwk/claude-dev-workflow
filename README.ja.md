# claude-dev-workflow

[English](README.md) | [한국어](README.ko.md) | **日本語**

実戦で検証された開発ワークフローツール群を、単一の Claude Code プラグイン **`dev-workflow`** としてまとめて配布するマーケットプレイス。一度インストールすれば**すべてのプロジェクト**で使える。

| ツール | 種類 | 呼び出し | 役割 |
|---|---|---|---|
| dev-cycle | skill | `/dev-workflow:dev-cycle` | 新機能の推奨パイプラインマップ + 現在のステップ案内（読み取り専用、ここから始める） |
| review-loop | skill | `/dev-workflow:review-loop` | spec/plan/impl の各段階完了後、コミット → codex 敵対的レビュー → 裁定・自動修正を反復（未裁定の critical/high が 0 になるまで） |
| writing-plans-split | skill | `/dev-workflow:writing-plans-split` | 多段階の実装プランを薄いエントリポイント + タスク別ファイルに分割して作成 |
| harden-spec | skill | `/dev-workflow:harden-spec` | plan・実装に進む前に spec ドラフトを敵対的に圧迫し、見逃したギャップ・前提・不変条件違反を掘り出して spec をその場で固める（project-aware） |
| setup | skill | `/dev-workflow:setup` | （明示的な依頼時のみ）このリポジトリの CLAUDE.md にパイプライン規約へのポインタを冪等に挿入 |
| コンテキスト閾値ナッジ | Stop hook | （自動） | コンテキスト使用量が閾値（デフォルト 40%）を超えたら、ハンドオフ作成 + `/clear` を一度だけ促す |

## 目次

- [要件](#要件)
- [インストール](#インストール)
- [使い方](#使い方)
  - [dev-cycle](#1-dev-cycle--パイプラインマップここから始める)
  - [review-loop](#2-review-loop--敵対的レビューの反復ループ)
  - [writing-plans-split](#3-writing-plans-split--分割実装プラン)
  - [harden-spec](#4-harden-spec--spec硬化)
  - [setup](#5-setup--リポジトリへのパイプライン導入)
  - [コンテキスト閾値ハンドオフフック](#6-コンテキスト閾値ハンドオフフック自動)
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

推奨順序: **brainstorming → spec → harden-spec → review-loop(spec) → writing-plans-split → review-loop(plan) → subagent-driven-development → review-loop(impl)**。段階境界（spec→plan、plan→impl）は新しいセッション + `/clear` が規約のため、dev-cycle は**現在のステップだけを案内し、次へはナッジ**する（1 セッションでのオートパイロットではない）。ステップ 1・7（brainstorming・subagent-driven-development）は `superpowers` プラグインを推奨 — なければ独自の設計/実装プロセスで代替可能（ハード依存ではない）。

### 2. `review-loop` — 敵対的レビューの反復ループ

各段階の完了後に変更をコミットし、codex で敵対的レビューを回す。欠陥は自動修正するか裁定（disposition）で閉じながら、**「未裁定の critical/high が 0」**になるまで反復する。目標は「指摘 0」ではなく「未裁定 0」。

オプションはすべて任意 — `/dev-workflow:review-loop` だけでも動く。

| オプション | デフォルト | 役割 |
|---|---|---|
| `--phase spec\|plan\|impl` | 自動推論 | どの段階を検証するか。省略時は変更内容から推論 |
| `--base <ref>` | `main` | 敵対的レビューが比較する基準ブランチ（この diff を見る） |
| `--max <n>` | `5` | レビュー反復回数の絶対上限 |
| `--auto-rounds <n>` | `3` | 序盤 n 回は**自動モード** — 欠陥を自動修正し、リスクのないユーザー判断はまとめて一括質問。`0`=毎ラウンド即質問、セキュリティ敏感な作業は `1` |
| `--resume` | — | 中断したループを `.remember/remember.md` の保存状態（ledger 含む）から再開 |

```
/dev-workflow:review-loop --phase impl                  # 実装検証 (typecheck·lint·test·build ゲート後)
/dev-workflow:review-loop --phase spec --auto-rounds 1  # セキュリティ敏感 → 自動モード最小化
/dev-workflow:review-loop --base develop                # main の代わりに develop 基準の diff
/dev-workflow:review-loop --resume                      # コンテキスト限界で切れたループの続き
```

**動作フロー** — 毎反復: ① 未コミットの変更をコミット → ② codex 敵対的レビュー実行 → ③ finding を fingerprint で分類・裁定（FIXED/ACCEPTED/DEFERRED_TO_IMPL/OUT_OF_SCOPE/DUPLICATE/ESCALATE）→ ④ FIXED は（impl なら TDD で）修正 → ⑤ ゲート再実行。未裁定の blocking が 0 になれば終了。

> 敵対的レビューは**コミット済みの HEAD（ブランチ diff）**を見る。未コミットのまま回すと直前の修正を見逃すため、ループは常に「修正 → コミット → レビュー」の順序を強制する。

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

### 4. `harden-spec` — spec硬化

brainstorming で得た **spec ドラフトを plan・実装に渡す前に**敵対的に圧迫し、後で発覚すると再設計を招くギャップ（見逃した要求・隠れた前提・エッジケース・モジュール横断の波及・不変条件違反）を掘り出して **spec をその場で補強**する。**project-aware** — 実行中リポジトリの `CLAUDE.md`・ADR・既存 spec を読み、*そのプロジェクトの*不変条件・既決事項で圧迫する。

```
/dev-workflow:harden-spec [spec パス]
```

質問は**一度に一つ**、リスクの高いもの（不可逆・モジュール横断・不変条件）から。事実はコードから直接調査し、開いた決定だけを尋ねる。すでに決まったこと（ADR・既決事項）は蒸し返さない。ギャップが解消するたびに spec へ入れる文言を提案 → 承認時に反映し、終了時は残余リスク（DEFERRED）を明記してコミットし停止する（次の段階は新しいセッションを推奨）。`review-loop`（codex による成果物検証）の前段で、*人間にしか分からない見落とし*を先に埋める補完ツール。「この spec を固めて / 見落としを探して / pre-mortem」のような発話でも自動起動する。

### 5. `setup` — リポジトリへのパイプライン導入

特定のリポジトリがこのパイプラインに従うことを**明示的に**採択するときに呼ぶ。プロジェクトの CLAUDE.md にマーカーブロックで**一行ポインタ**（`dev-cycle` へのポインタ + 未インストール者向けのインストール手順）を冪等に挿入する — ガイド全文はコピーしないため、規約本文が変わっても（SSOT = `dev-cycle`）各リポジトリの CLAUDE.md は古びない。

```
/dev-workflow:setup
```

明示的な依頼時のみ動作し、マーカーブロック外の内容には触れない。コラボレーターやプラグイン未インストールのユーザーも、CLAUDE.md を読むだけで規約とインストール方法が分かる。

### 6. コンテキスト閾値ハンドオフフック（自動）

インストールすればすぐ動く。設定不要。会話コンテキストの使用量が閾値（デフォルト 40%）を超えると、止まる前にハンドオフを書いて `/clear` するよう一度だけ案内する — コンテキストが溢れて作業が切れる前の引き継ぎを助ける。

環境変数で調整（任意）:

```
CLAUDE_CTX_THRESHOLD=0.5    # 閾値を 50% に (0〜1, デフォルト 0.4)
CLAUDE_CTX_LIMIT=200000     # コンテキストトークン上限を直接指定
                            # 未指定時: モデル名に [1m] があれば 1,000,000 / なければ 200,000
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
│   ├── skills/{dev-cycle,harden-spec,writing-plans-split,review-loop,setup}/SKILL.md
│   └── hooks/{hooks.json, scripts/context-threshold-hook.mjs}
├── README.md                         # 英語（デフォルト）
└── README.ko.md / README.ja.md       # 韓国語 / 日本語
```

`plugin.json` の `version` を上げたコミットでのみユーザーは更新を受け取る。version を省略すると git commit SHA がバージョンになり、毎コミットが新バージョン扱いになる。ユーザーは `/plugin update` またはバックグラウンド自動更新で更新する。

**README は 3 言語で維持する** — `README.md`（英語、デフォルト）/ `README.ko.md` / `README.ja.md`。内容を変えるときは **3 ファイルを一緒に更新**する（ドリフト防止）。
