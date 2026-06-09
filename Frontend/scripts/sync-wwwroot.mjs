import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendDir, '..');
const distDir = path.join(frontendDir, 'dist');
const wwwrootDir = path.join(repoRoot, 'Backend', 'TagFusion', 'wwwroot');

function ensureBuildOutputExists() {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Frontend build output missing: ${indexPath}`);
  }
}

function recreateDirectory(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
}

function copyDirectoryContents(sourceDir, targetDir) {
  const entries = fs.readdirSync(sourceDir);
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);
    const targetPath = path.join(targetDir, entry);
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
}

function main() {
  ensureBuildOutputExists();
  recreateDirectory(wwwrootDir);
  copyDirectoryContents(distDir, wwwrootDir);

  const indexPath = path.join(wwwrootDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`wwwroot sync failed: ${indexPath} was not created`);
  }

  console.log(`Synced ${distDir} -> ${wwwrootDir}`);
}

main();
