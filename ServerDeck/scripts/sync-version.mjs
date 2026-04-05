import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const packageLockPath = path.join(projectRoot, "package-lock.json");
const tauriConfigPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");

// author: BrianXiong
// time: 2026/04/05/11:27:54
async function readJson(filePath) {
  const content = await readFile(filePath, "utf8");
  return JSON.parse(content);
}

// author: BrianXiong
// time: 2026/04/05/11:27:54
async function writeJsonIfChanged(filePath, data) {
  const nextContent = `${JSON.stringify(data, null, 2)}\n`;
  const currentContent = await readFile(filePath, "utf8");

  if (currentContent === nextContent) {
    return false;
  }

  await writeFile(filePath, nextContent, "utf8");
  return true;
}

// author: BrianXiong
// time: 2026/04/05/11:27:54
function applyVersion(packageVersion, packageLock, tauriConfig) {
  packageLock.version = packageVersion;

  if (packageLock.packages?.[""]) {
    packageLock.packages[""].version = packageVersion;
  }

  tauriConfig.version = packageVersion;
}

// author: BrianXiong
// time: 2026/04/05/11:27:54
async function main() {
  const packageJson = await readJson(packageJsonPath);
  const packageVersion = packageJson.version;

  if (typeof packageVersion !== "string" || !packageVersion.trim()) {
    throw new Error("package.json version is missing");
  }

  const [packageLock, tauriConfig] = await Promise.all([
    readJson(packageLockPath),
    readJson(tauriConfigPath)
  ]);

  applyVersion(packageVersion, packageLock, tauriConfig);

  const [packageLockChanged, tauriConfigChanged] = await Promise.all([
    writeJsonIfChanged(packageLockPath, packageLock),
    writeJsonIfChanged(tauriConfigPath, tauriConfig)
  ]);

  const updatedFiles = [
    packageLockChanged ? "package-lock.json" : null,
    tauriConfigChanged ? "src-tauri/tauri.conf.json" : null
  ].filter(Boolean);

  console.log(
    updatedFiles.length > 0
      ? `Synced version ${packageVersion} -> ${updatedFiles.join(", ")}`
      : `Version ${packageVersion} already synced`
  );
}

await main();
