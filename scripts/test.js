"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

const root = path.resolve(__dirname, "..");
const required = [
  "app.js",
  "bin/strategy-flow-input.js",
  "index.html",
  "package.json",
  "schema/strategy-flow-input.schema.json",
  "styles.css",
];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageJson.name !== "strategy-flow-input") throw new Error("Unexpected package name");
if (!/^\d+\.\d+\.\d+$/.test(packageJson.version)) throw new Error("Invalid package version");
if (packageJson.bin?.["strategy-flow-input"] !== "./bin/strategy-flow-input.js") {
  throw new Error("Missing strategy-flow-input bin entry");
}

for (const script of ["app.js", "bin/strategy-flow-input.js", "scripts/test.js"]) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, script)], {stdio: "inherit"});
  if (result.status !== 0) process.exit(result.status);
}

const help = spawnSync(process.execPath, [path.join(root, "bin/strategy-flow-input.js"), "--help"], {encoding: "utf8"});
if (help.status !== 0 || !help.stdout.includes("Usage: strategy-flow-input")) {
  throw new Error("CLI help contract failed");
}

JSON.parse(fs.readFileSync(path.join(root, "schema/strategy-flow-input.schema.json"), "utf8"));
console.log("strategy-flow-input package checks passed.");
