import { chmodSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ptyRoot = path.join(root, "node_modules", "node-pty");
if (!existsSync(ptyRoot)) process.exit(0);

const helpers = [path.join(ptyRoot, "build", "Release", "spawn-helper")];
const prebuilds = path.join(ptyRoot, "prebuilds");
if (existsSync(prebuilds)) {
  for (const dir of readdirSync(prebuilds)) {
    helpers.push(path.join(prebuilds, dir, "spawn-helper"));
  }
}

for (const file of helpers) {
  if (!existsSync(file)) continue;
  chmodSync(file, 0o755);
}
