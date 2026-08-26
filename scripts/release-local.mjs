#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

function execute(command, args, { capture = false, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0 && !allowFailure) {
    const detail = capture ? result.stderr.trim() : "";
    fail(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

function output(command, args) {
  return execute(command, args, { capture: true }).stdout.trim();
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: npm run release:local -- vX.Y.Z");
  console.log("Builds signed macOS packages and creates or updates a draft GitHub release.");
  process.exit(0);
}

if (process.platform !== "darwin") fail("release:local must run on macOS");

const pkg = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile("package.json", "utf8")));
const tag = process.argv[2];
const expectedTag = `v${pkg.version}`;
if (!tag) fail(`tag is required (expected ${expectedTag})`);
if (tag !== expectedTag) fail(`tag ${tag} does not match package version ${expectedTag}`);

execute("gh", ["auth", "status"]);
execute("git", ["fetch", "origin", "main", "--tags"]);

if (output("git", ["status", "--porcelain"])) fail("working tree must be clean");
const head = output("git", ["rev-parse", "HEAD"]);
const remoteMain = output("git", ["rev-parse", "origin/main"]);
if (head !== remoteMain) fail("HEAD must exactly match origin/main");

const localTagCheck = execute("git", ["rev-parse", "--verify", `${tag}^{commit}`], {
  capture: true,
  allowFailure: true,
});
if (localTagCheck.status !== 0) fail(`local tag ${tag} does not exist`);
if (localTagCheck.stdout.trim() !== head) fail(`${tag} does not point to HEAD`);
if (
  execute("git", ["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/${tag}`], {
    capture: true,
    allowFailure: true,
  }).status !== 0
) {
  fail(`${tag} has not been pushed to origin`);
}

const repo = output("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
const runs = JSON.parse(
  output("gh", [
    "run",
    "list",
    "--repo",
    repo,
    "--workflow",
    "release.yml",
    "--event",
    "push",
    "--limit",
    "30",
    "--json",
    "databaseId,headSha,status,conclusion,url",
  ]),
);
const matchingRuns = runs.filter((run) => run.headSha === head);
const successfulRun = matchingRuns.find((run) => run.status === "completed" && run.conclusion === "success");
if (!successfulRun) {
  const latest = matchingRuns[0];
  fail(
    latest
      ? `release artifact workflow is ${latest.status}/${latest.conclusion || "pending"}: ${latest.url}`
      : `no release artifact workflow was found for ${tag}`,
  );
}

const authGroups = [
  {
    name: "Keychain profile",
    values: [process.env.APPLE_KEYCHAIN_PROFILE],
  },
  {
    name: "App Store Connect API key",
    values: [process.env.APPLE_API_KEY, process.env.APPLE_API_KEY_ID, process.env.APPLE_API_ISSUER],
  },
  {
    name: "Apple ID",
    values: [process.env.APPLE_ID, process.env.APPLE_APP_SPECIFIC_PASSWORD, process.env.APPLE_TEAM_ID],
  },
];
for (const group of authGroups) {
  const supplied = group.values.filter(Boolean).length;
  if (supplied > 0 && supplied !== group.values.length) fail(`${group.name} notarization credentials are incomplete`);
}
const completeAuthGroups = authGroups.filter((group) => group.values.every(Boolean));
if (completeAuthGroups.length !== 1) fail("configure exactly one local notarization method");

const identities = output("security", ["find-identity", "-v", "-p", "codesigning"]);
if (!identities.includes("Developer ID Application:")) {
  fail("no Developer ID Application certificate was found in the local Keychain");
}

execute("npm", ["ci"]);
execute("npm", ["run", "package:mac:release"]);

const stage = path.resolve("release", `staged-${tag}`);
const ciDirectory = path.join(stage, "ci");
const assetsDirectory = path.join(stage, "assets");
if (existsSync(stage)) fail(`${stage} already exists; move it aside before retrying`);
mkdirSync(ciDirectory, { recursive: true });
mkdirSync(assetsDirectory, { recursive: true });

execute("gh", [
  "run",
  "download",
  String(successfulRun.databaseId),
  "--repo",
  repo,
  "--name",
  "release-linux",
  "--name",
  "release-windows",
  "--dir",
  ciDirectory,
]);

const macPrefix = `Grok Build-${pkg.version}-mac-`;
const macAssets = readdirSync("release")
  .map((name) => path.resolve("release", name))
  .filter((file) => statSync(file).isFile())
  .filter((file) => path.basename(file).startsWith(macPrefix))
  .filter((file) => file.endsWith(".dmg") || file.endsWith(".zip"));
const ciAssets = walk(ciDirectory).filter((file) => file.endsWith(".AppImage") || file.endsWith(".exe"));
const candidates = [...macAssets, ...ciAssets];

const extensions = candidates.map((file) => path.extname(file));
if (!extensions.includes(".dmg") || !extensions.includes(".zip")) fail("macOS DMG or ZIP is missing");
if (!extensions.includes(".AppImage")) fail("Linux AppImage is missing");
if (!extensions.includes(".exe")) fail("Windows installer is missing");

const assetPaths = [];
for (const source of candidates) {
  const destination = path.join(assetsDirectory, path.basename(source));
  if (existsSync(destination)) fail(`duplicate artifact name: ${path.basename(source)}`);
  copyFileSync(source, destination);
  assetPaths.push(destination);
}
assetPaths.sort((left, right) => path.basename(left).localeCompare(path.basename(right)));

const checksumLines = [];
for (const asset of assetPaths) checksumLines.push(`${await sha256(asset)}  ${path.basename(asset)}`);
const checksumFile = path.join(assetsDirectory, "SHA256SUMS");
writeFileSync(checksumFile, `${checksumLines.join("\n")}\n`);
assetPaths.push(checksumFile);

const existing = execute("gh", ["release", "view", tag, "--repo", repo, "--json", "isDraft"], {
  capture: true,
  allowFailure: true,
});
if (existing.status === 0) {
  if (!JSON.parse(existing.stdout).isDraft) fail(`${tag} is already published`);
  execute("gh", ["release", "upload", tag, ...assetPaths, "--repo", repo, "--clobber"]);
} else {
  execute("gh", [
    "release",
    "create",
    tag,
    ...assetPaths,
    "--repo",
    repo,
    "--draft",
    "--generate-notes",
    "--title",
    `Grok Build ${tag}`,
    "--verify-tag",
  ]);
}

console.log(`Draft release assembled from ${completeAuthGroups[0].name} credentials.`);
console.log(`Review it at https://github.com/${repo}/releases before publishing.`);
