import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "..");
const packageJsonPath = path.join(appRoot, "package.json");
const packageLockPath = path.join(appRoot, "package-lock.json");
const tauriConfigPath = path.join(appRoot, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(appRoot, "src-tauri", "Cargo.toml");
const changelogPath = path.join(repoRoot, "docs", "changelog.md");

// author: BrianXiong
// time: 2026/04/15/11:40:00
function bumpPatchVersion(version) {
  const match = String(version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
async function getLatestTag() {
  try {
    const { stdout } = await execFile("git", ["describe", "--tags", "--abbrev=0", "--match", "v*"], {
      cwd: repoRoot
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
async function getCommitSubjects(previousTag) {
  const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
  const { stdout } = await execFile("git", ["log", range, "--no-merges", "--pretty=format:%s"], {
    cwd: repoRoot
  });

  const subjects = stdout
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !item.startsWith("chore(release):"));

  if (subjects.length > 0) {
    return subjects;
  }

  const fallback = await execFile("git", ["log", "-1", "--pretty=format:%s"], { cwd: repoRoot });
  return fallback.stdout.trim() ? [fallback.stdout.trim()] : [];
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
function normalizeCommitMessage(subject) {
  const stripped = subject
    .replace(/^[a-z]+(?:\([^)]+\))?!?:\s*/i, "")
    .replace(/^merge pull request\s+#\d+\s+from\s+/i, "")
    .trim();

  if (!stripped) {
    return "Maintenance updates";
  }

  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
function categorizeCommits(subjects) {
  const categories = {
    added: [],
    changed: [],
    fixed: []
  };

  for (const subject of subjects) {
    const normalized = normalizeCommitMessage(subject);
    const lower = subject.toLowerCase();

    if (lower.startsWith("feat:") || lower.startsWith("feat(")) {
      categories.added.push(normalized);
      continue;
    }

    if (lower.startsWith("fix:") || lower.startsWith("fix(") || lower.startsWith("bugfix:") || lower.startsWith("bugfix(")) {
      categories.fixed.push(normalized);
      continue;
    }

    categories.changed.push(normalized);
  }

  categories.added = [...new Set(categories.added)];
  categories.changed = [...new Set(categories.changed)];
  categories.fixed = [...new Set(categories.fixed)];
  return categories;
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
function formatSectionItems(items) {
  if (items.length === 0) {
    return "- None";
  }

  return items.map((item) => `- ${item}`).join("\n");
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
function buildChangelogEntry(newVersion, previousVersion, categories) {
  return [
    `## v${newVersion}`,
    "",
    `Compared with \`v${previousVersion}\`.`,
    "",
    "### Added",
    "",
    formatSectionItems(categories.added),
    "",
    "### Changed",
    "",
    formatSectionItems(categories.changed),
    "",
    "### Fixed",
    "",
    formatSectionItems(categories.fixed),
    ""
  ].join("\n");
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
function updateCargoTomlVersion(content, version) {
  const nextContent = content.replace(/^version = ".*"$/m, `version = "${version}"`);

  if (nextContent === content) {
    throw new Error("Failed to update version in Cargo.toml");
  }

  return nextContent;
}

// author: BrianXiong
// time: 2026/04/15/11:40:00
async function main() {
  const packageJson = await readJson(packageJsonPath);
  const packageLock = await readJson(packageLockPath);
  const tauriConfig = await readJson(tauriConfigPath);
  const cargoToml = await readFile(cargoTomlPath, "utf8");
  const changelog = await readFile(changelogPath, "utf8");
  const currentVersion = packageJson.version;
  const newVersion = bumpPatchVersion(currentVersion);
  const latestTag = await getLatestTag();
  const commitSubjects = await getCommitSubjects(latestTag);
  const categories = categorizeCommits(commitSubjects);
  const changelogEntry = buildChangelogEntry(newVersion, currentVersion, categories);

  packageJson.version = newVersion;
  packageLock.version = newVersion;
  if (packageLock.packages?.[""]) {
    packageLock.packages[""].version = newVersion;
  }
  tauriConfig.version = newVersion;

  const nextCargoToml = updateCargoTomlVersion(cargoToml, newVersion);
  const changelogLines = changelog.split(/\r?\n/);
  const insertionIndex = changelogLines.findIndex((line) => line.startsWith("## "));
  const nextChangelog = insertionIndex === -1
    ? `${changelog.trim()}\n\n${changelogEntry}`
    : [
        ...changelogLines.slice(0, insertionIndex),
        changelogEntry.trimEnd(),
        "",
        ...changelogLines.slice(insertionIndex)
      ].join("\n");

  await Promise.all([
    writeJson(packageJsonPath, packageJson),
    writeJson(packageLockPath, packageLock),
    writeJson(tauriConfigPath, tauriConfig),
    writeFile(cargoTomlPath, nextCargoToml, "utf8"),
    writeFile(changelogPath, `${nextChangelog.trimEnd()}\n`, "utf8")
  ]);

  console.log(`Released version prepared: ${currentVersion} -> ${newVersion}`);
}

await main();
