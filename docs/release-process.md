# Release Process

This repository publishes macOS release assets through GitHub Releases. The app checks for signed updater metadata on startup and shows the left-sidebar `Update` button only when a newer version is available.

## 1. Prepare the version

Update the version in all three files so they stay aligned:

- `ServerDeck/package.json`
- `ServerDeck/src-tauri/Cargo.toml`
- `ServerDeck/src-tauri/tauri.conf.json`

Example: `0.1.1`

Every version upgrade must also add release notes for the new version in `docs/changelog.md`.
The same notes must also appear in the GitHub Release body, not only in the repository changelog, so users can read the changes directly on the Releases page.

The note must compare against the previous version and explicitly list:

- `Added`
- `Changed`
- `Fixed`

If a section has no items, write `None` instead of leaving it out.

The release workflow reads the matching version section from `docs/changelog.md` and publishes it into the GitHub Release body automatically.

Release notes should describe the real changes shipped in that version, such as user-facing features, behavior changes, bug fixes, or meaningful engineering updates that affect the delivered app.
Do not fill release notes with release mechanics like version bumping, tag creation, changelog maintenance, or workflow-only adjustments unless those are the actual changes being shipped to users.

## 2. Merge to `main`

All changes should still land in `main` through a pull request.

After a pull request is merged into `main`, the workflow at `.github/workflows/auto-release-on-main.yml` will automatically:

- bump the patch version
- sync version files
- prepend release notes to `docs/changelog.md`
- commit the release change back to `main`
- create and push the matching `v*` tag

## 3. GitHub Actions builds the release

Once the auto-release workflow pushes the new tag, `.github/workflows/release.yml` runs on tags matching `v*`.

It will:

- install Node and Rust
- read the current version notes from `docs/changelog.md`
- run the Tauri build in `ServerDeck/`
- create or update the GitHub Release
- upload macOS assets, including `.dmg`
- upload signed updater artifacts such as `latest.json`

For updater metadata to be generated, keep `"bundle.createUpdaterArtifacts": true` in `ServerDeck/src-tauri/tauri.conf.json`.

Before the updater can work, configure these GitHub repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (optional if the key has no password)

The matching updater public key is embedded in `ServerDeck/src-tauri/tauri.conf.json`.

## 4. Notes about automatic release behavior

- The current auto-release flow bumps the patch version on every merged pull request into `main`.
- Release notes are generated from commit subjects since the previous tag.
- Conventional commit prefixes are mapped as follows:
  - `feat:` -> `Added`
  - `fix:` -> `Fixed`
  - everything else -> `Changed`

## 5. Client update behavior

The desktop app uses Tauri updater metadata on startup. If a signed newer release is available, the `Update` button appears. Clicking it opens an in-app update dialog where the user can download the update in the background and then restart the app to switch to the new version.
