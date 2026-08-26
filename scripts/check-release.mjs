#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

const rootFiles = [
  "LICENSE",
  "NOTICE",
  "README.md",
  "SECURITY.md",
  "electron-builder.yml",
  "package-lock.json",
  "scripts/release-local.mjs",
];

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const requestedTag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
const expectedTag = `v${pkg.version}`;
const errors = [];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
  errors.push(`package.json version is not valid semver: ${pkg.version}`);
}
if (requestedTag && requestedTag !== expectedTag) {
  errors.push(`release tag ${requestedTag} does not match package version ${expectedTag}`);
}
if (lock.packages?.[""]?.version !== pkg.version) {
  errors.push("package-lock.json root version does not match package.json");
}
if (!pkg.devDependencies?.["electron-builder"]) {
  errors.push("electron-builder must be a locked devDependency");
}
if (!pkg.license || pkg.license === "UNLICENSED") {
  errors.push("package.json must declare an open-source license");
}
for (const file of rootFiles) {
  if (!existsSync(file)) errors.push(`required release file is missing: ${file}`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(`release check: ${error}`);
  process.exit(1);
}

console.log(`release metadata is consistent for ${expectedTag}`);
