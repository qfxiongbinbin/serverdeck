<div align="center">

  <img src="ServerDeck/src-tauri/icons/icon.png" alt="ServerDeck logo" width="128" height="128" />

  # ServerDeck — リモートサーバーワークベンチ

  macOS 向けのデスクトップアプリ。SSH、ターミナルタブ、SFTP、アプリ内アップデートに対応します。

  [![Release](https://img.shields.io/github/v/release/qfxiongbinbin/serverdeck?display_name=tag&style=for-the-badge)](https://github.com/qfxiongbinbin/serverdeck/releases)
  [![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=for-the-badge)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-macOS-black?style=for-the-badge)](#)
  [![Stack](https://img.shields.io/badge/stack-Tauri%20%7C%20React%20%7C%20Rust-5b5bd6?style=for-the-badge)](#)

  言語: [English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md)

</div>

ServerDeck は、macOS 向けのリモートサーバーワークフロー用デスクトップアプリです。Tauri、React、TypeScript、Rust を使って構築されています。製品の方向性は Termius のようなツールに着想を得ており、まずは SSH、ターミナルのタブ管理、SFTP ブラウズに注力しています。

## 現在のスコープ

- 保存済みホストの管理
- 複数タブのターミナルセッション
- ローカル / リモートの 2 ペイン対応 SFTP ブラウザ
- アップロード、ダウンロード、削除などのファイル操作
- ターミナルテーマとフォントサイズ設定
- GitHub Release ベースのアップデート確認とダウンロードフロー

現在、このリポジトリは macOS を優先対象としています。

## リポジトリ構成

- `ServerDeck/` — アプリケーション本体のソースコード
- `ServerDeck/src/` — React UI、テーマプリセット、API ラッパー、スタイル
- `ServerDeck/src-tauri/` — Rust バックエンド、Tauri 設定、アイコン、デスクトップコマンド
- プロダクトおよび技術計画ドキュメントはナレッジベース内の `工作/serverdeck/` にあります
- `docs/release-process.md` — バージョン管理と GitHub Release フロー

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
