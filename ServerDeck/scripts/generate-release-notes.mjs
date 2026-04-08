import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const changelogPath = path.join(projectRoot, "docs", "changelog.md");

// author: BrianXiong
// time: 2026/04/08/15:42:10
function normalizeVersion(rawVersion) {
  const trimmed = String(rawVersion || "").trim();
  if (!trimmed) {
    throw new Error("Missing version argument. Example: v0.0.14");
  }

  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}

// author: BrianXiong
// time: 2026/04/08/15:42:10
function extractVersionSection(changelogContent, version) {
  const lines = changelogContent.split(/\r?\n/);
  const heading = `## ${version}`;
  const startIndex = lines.findIndex((line) => line.trim() === heading);

  if (startIndex === -1) {
    throw new Error(`Cannot find changelog section for ${version} in docs/changelog.md`);
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex + 1, endIndex).join("\n").trim();
}

// author: BrianXiong
// time: 2026/04/08/15:42:10
function buildReleaseBody(version, changelogSection) {
  return `${changelogSection}\n\n---\n\nAssets include the macOS ".app" bundle, ".dmg" installer, and signed updater metadata.`;
}

// author: BrianXiong
// time: 2026/04/08/15:42:10
async function main() {
  const version = normalizeVersion(process.argv[2]);
  const changelogContent = await readFile(changelogPath, "utf8");
  const changelogSection = extractVersionSection(changelogContent, version);
  const releaseBody = buildReleaseBody(version, changelogSection);
  process.stdout.write(`${releaseBody}\n`);
}

await main();
