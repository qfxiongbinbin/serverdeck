# ServerDeck

ServerDeck is a macOS desktop app for remote server workflows, built with Tauri, React, TypeScript, and Rust. The product direction is inspired by tools like Termius, with an initial focus on SSH, terminal tabs, and SFTP browsing.

## Current Scope

- Saved host management
- Multi-tab terminal sessions
- SFTP browser with local and remote panes
- File actions for upload, download, and delete
- Terminal theme and font size settings
- GitHub Release-based update check and download flow

This repository currently targets macOS first.

## Repository Layout

- `ServerDeck/` — application source
- `ServerDeck/src/` — React UI, theme presets, API wrappers, and styles
- `ServerDeck/src-tauri/` — Rust backend, Tauri config, icons, and desktop commands
- `产品方案.md` — product notes and MVP direction
- `技术方案.md` — architecture and implementation notes
- `docs/release-process.md` — versioning and GitHub Release flow

## Local Development

Requirements:

- Node.js `20+`
- Rust toolchain

Run locally:

```bash
cd ServerDeck
npm install
npm run tauri dev
```

Useful commands:

```bash
npm run build                  # frontend build
./node_modules/.bin/tsc --noEmit
cd src-tauri && cargo check
```

## Packaging

Build macOS artifacts:

```bash
cd ServerDeck
npm run tauri build
```

Configured bundle targets include:

- `.app`
- `.dmg`

## Release & Updates

Releases are built from GitHub tags using GitHub Actions. The desktop app checks the latest GitHub Release on startup and shows an `Update` button only when a newer version is available.

Release steps are documented in:

- `docs/release-process.md`

## Notes

- Current GitHub-hosted macOS builds may still require proper Apple signing and notarization for smooth installation on other machines.
- For contributor workflow, see `AGENTS.md`.
