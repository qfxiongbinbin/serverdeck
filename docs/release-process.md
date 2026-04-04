# Release Process

This repository publishes macOS release assets through GitHub Releases. The app checks for signed updater metadata on startup and shows the left-sidebar `Update` button only when a newer version is available.

## 1. Prepare the version

Update the version in all three files so they stay aligned:

- `ServerDeck/package.json`
- `ServerDeck/src-tauri/Cargo.toml`
- `ServerDeck/src-tauri/tauri.conf.json`

Example: `0.1.1`

## 2. Merge to `main`

Release changes should land in `main` through a pull request.

## 3. Create and push a tag

From a clean `main` branch:

```bash
git checkout main
git pull --ff-only
git tag v0.1.1
git push origin v0.1.1
```

## 4. GitHub Actions builds the release

The workflow at `.github/workflows/release.yml` runs on tags matching `v*`.

It will:

- install Node and Rust
- run the Tauri build in `ServerDeck/`
- create or update the GitHub Release
- upload macOS assets, including `.dmg`
- upload signed updater artifacts such as `latest.json`

For updater metadata to be generated, keep `"bundle.createUpdaterArtifacts": true` in `ServerDeck/src-tauri/tauri.conf.json`.

Before the updater can work, configure these GitHub repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (optional if the key has no password)

The matching updater public key is embedded in `ServerDeck/src-tauri/tauri.conf.json`.

## 5. Client update behavior

The desktop app uses Tauri updater metadata on startup. If a signed newer release is available, the `Update` button appears. Clicking it opens an in-app update dialog where the user can download the update in the background and then restart the app to switch to the new version.
