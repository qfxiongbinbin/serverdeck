# Release Process

This repository publishes macOS release assets through GitHub Releases. The app checks the latest release on startup and shows the left-sidebar `Update` button only when a newer version is available.

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

## 5. Client update behavior

The desktop app calls GitHub’s latest-release API on startup. If the release version is newer than the current app version and a `.dmg` or `.app.tar.gz` asset exists, the `Update` button appears. Clicking it downloads the installer to the user’s `Downloads` folder and opens it.
