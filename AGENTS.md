# Repository Guidelines

## Project Structure & Module Organization
- Root docs: `README.md`, `产品方案.md`, and `技术方案.md` describe scope and product direction.
- App code lives in `ServerDeck/`.
- Frontend sources are in `ServerDeck/src/`:
  - `App.tsx` for main UI flow
  - `components/` for reusable UI pieces
  - `data/` for static presets such as terminal themes
  - `lib/` for Tauri API wrappers
  - `styles/` for global CSS
- Tauri/Rust backend lives in `ServerDeck/src-tauri/`:
  - `src/main.rs` for commands and desktop runtime logic
  - `icons/` for app icons
  - `tauri.conf.json` for window and bundle configuration

## Build, Test, and Development Commands
- `cd ServerDeck && npm install` — install frontend and Tauri CLI dependencies.
- `cd ServerDeck && npm run dev` — run the Vite frontend only.
- `cd ServerDeck && npm run tauri dev` — run the desktop app in development.
- `cd ServerDeck && npm run build` — type-check and build frontend assets.
- `cd ServerDeck && npm run tauri build` — create a production macOS app bundle.
- `cd ServerDeck && ./node_modules/.bin/tsc --noEmit` — validate TypeScript without building.
- `cd ServerDeck/src-tauri && cargo check` — validate Rust changes quickly.

## Coding Style & Naming Conventions
- Use 2-space indentation in TypeScript, TSX, JSON, and CSS; follow existing Rust formatting in `main.rs`.
- Prefer `camelCase` for variables/functions, `PascalCase` for React components and types, and `SCREAMING_SNAKE_CASE` for constants.
- Keep changes focused and minimal. Reuse existing helpers in `src/lib/` before adding new wrappers.
- Do not add inline comments unless the logic is non-obvious and project style already supports them.

## Testing Guidelines
- There is no formal test suite yet. Validate changes with:
  - `./node_modules/.bin/tsc --noEmit`
  - `cargo check`
  - manual verification in `npm run tauri dev`
- For UI changes, include screenshots or a short verification note in your PR.

## Commit & Pull Request Guidelines
- Match the existing commit style: `feat: ...`, `refactor: ...`, `chore: ...`.
- Keep commit messages short, imperative, and scoped to one change.
- PRs should include: purpose, affected areas, validation steps, and screenshots for UI updates.
- Branch from `main` for all work:
  - new features use `feature/<name>`
  - bug fixes use `fix/<name>`
- Do not commit new work directly to `main`. Changes must return to `main` through a merged pull request.

## Security & Configuration Tips
- Do not commit secrets, tokens, or private keys.
- Treat host credentials carefully; verify any changes touching SSH, SFTP, or local file deletion paths.
