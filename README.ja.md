<div align="center">

  <img src="ServerDeck/src-tauri/icons/icon.png" alt="ServerDeck logo" width="128" height="128" />

  # ServerDeck — リモートサーバーワークベンチ

  macOS 向けのデスクトップアプリ。SSH、ターミナルタブ、SFTP、サーバー監視、アプリ内アップデートに対応します。

  [![Release](https://img.shields.io/github/v/release/qfxiongbinbin/serverdeck?display_name=tag&style=for-the-badge)](https://github.com/qfxiongbinbin/serverdeck/releases)
  [![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-macOS-black?style=for-the-badge)](#)
  [![Stack](https://img.shields.io/badge/stack-Tauri%20%7C%20React%20%7C%20Rust-5b5bd6?style=for-the-badge)](#)

  言語: [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md)

</div>

ServerDeck は、macOS 向けのリモートサーバーワークフロー用デスクトップアプリです。Tauri、React、TypeScript、Rust を使って構築されています。製品の方向性は Termius のようなツールに着想を得ており、まずは SSH、ターミナルのタブ管理、SFTP ブラウズに注力しています。

## 現在のスコープ

- 保存済みホストの管理（プロジェクト分類に対応）
- 複数タブのターミナルセッション
- ローカル / リモートの 2 ペイン対応 SFTP ブラウザ
- アップロード、ダウンロード、削除などのファイル操作
- サーバープロセス監視（CPU・メモリ・ディスク）
- ターミナルテーマとフォントサイズ設定
- GitHub Release ベースのアップデート確認とダウンロードフロー

現在、このリポジトリは macOS を優先対象としています。

## ロードマップ

ServerDeck は**シングルユーザー・ローカルファースト**のサーバーワークベンチとして開発しています。Termius との機能的な同等性ではなく、Termius 系ツールが個人の日常的な開発フローで苦手としている領域に焦点を当てます。`~/.ssh/config` のライブデータソース化、ジャンプホストのチェーン、ポートフォワード管理、変数付きスニペット、ターミナルの作業ディレクトリに追従する SFTP ペイン、tmux による永続セッション、アカウント不要のローカルファースト同期です。

| マイルストーン | テーマ | 計画内容 |
| --- | --- | --- |
| M1 | 接続 | ⌘K クイック接続、`~/.ssh/config` のライブ同期とジャンプホストチェーン、鍵と known_hosts の管理、ホストの代替アドレスと環境ラベル |
| M2 | 作業 | ポートフォワードマネージャー、変数付きスニペット、tmux 永続セッション、分割ペインとワークスペーステンプレート |
| M3 | 転送 | SFTP の作業ディレクトリ追従、パスのブックマークと転送キュー、リモートファイルの直接編集、ディレクトリ差分と一方向同期 |
| M4 | 拡張 | CLI、外部エージェント向け MCP サーバー、アカウント不要のローカルファースト同期とエクスポート、監査履歴 |

現在のフォーカス：**M1 — ⌘K クイック接続と `~/.ssh/config` ライブデータソース。**

設計上スコープ外：チーム Vault とコラボレーション、モバイルアプリ、マルチプロトコル対応（Telnet/RDP/VNC）、アカウント前提のクラウド同期、内蔵 AI チャットアシスタント。AI ワークフローは今後の CLI / MCP 経由で外部エージェントに委ねます。

詳細な計画は社内ナレッジベースで管理し、リリース済みの変更は [`docs/changelog.md`](docs/changelog.md) に記載しています。

## エージェント連携と CLI

アプリの起動中、ServerDeck は同一ユーザー専用のローカルソケット
（`~/.serverdeck/agent.sock`、モード `0600`）を公開します。スクリプトや
コーディングエージェントは、保存済みのホスト・鍵・ジャンプホスト設定を
そのまま再利用でき、接続情報をハードコードする必要がありません。

```bash
cd ServerDeck
npm run serverdeck -- ping                    # アプリが起動しているか確認
npm run serverdeck -- list                    # 保存済みホストを一覧表示
npm run serverdeck -- exec <host> -- "df -h"  # ssh 経由でコマンドを実行
```

`<host>` はラベル・アドレス・id のいずれかを受け付け、CLI の終了コードは
リモートコマンドの終了コードになります。`SERVERDECK_SOCKET` でソケットパスを
上書きできます。同じソケットを使う MCP サーバーは次の計画です。

## リポジトリ構成

- `ServerDeck/` — アプリケーション本体のソースコード
- `ServerDeck/src/` — React UI、テーマプリセット、API ラッパー、スタイル
- `ServerDeck/src-tauri/` — Rust バックエンド、Tauri 設定、アイコン、デスクトップコマンド
- プロダクトおよび技術計画ドキュメントはナレッジベース内の `工作/serverdeck/` にあります
- `docs/release-process.md` — バージョン管理と GitHub Release フロー
- `docs/changelog.md` — 各リリースの変更内容

## ローカル開発

必要環境:

- Node.js `20+`
- Rust ツールチェーン

ローカル実行:

```bash
cd ServerDeck
npm install
npm run tauri dev
```

よく使うコマンド:

```bash
npm run build                  # フロントエンドのビルド
./node_modules/.bin/tsc --noEmit
cd src-tauri && cargo check
```

## パッケージング

macOS 向け成果物をビルドするには:

```bash
cd ServerDeck
npm run tauri build
```

現在設定されているバンドルターゲット:

- `.app`
- `.dmg`

## リリースとアップデート

リリースは GitHub Actions により Git タグからビルドされます。デスクトップアプリは起動時に最新の GitHub Release を確認し、新しいバージョンがある場合のみ `Update` ボタンを表示します。

リリース手順の詳細:

- `docs/release-process.md`

## 補足

- GitHub 配布の macOS ビルドは、他のマシンでのスムーズなインストールのために Apple の署名や notarization が今後さらに必要になる場合があります。
- コントリビュータ向けワークフローは `AGENTS.md` を参照してください。

## ライセンス

このプロジェクトは Apache License 2.0 のもとで公開されています。詳細は `LICENSE` を参照してください。
