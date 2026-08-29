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
const designer = require(path.join(root, "app.js"));
if (!designer.ACTOR_STATUSES.some(([value, label]) => value === "no_requirement" && label === "无动作要求")) {
  throw new Error("Actor no_requirement label contract failed");
}

const noActionDocument = designer.normalizeDocument({
  schemaVersion: "strategy-flow-input/0.1",
  strategy: {
    strategyName: "校验策略",
    paradigm: "customer",
    owner: "owner",
    submitter: "submitter",
  },
  nodes: [
    {localId: "n1", nodeType: "entry", time: "T0", executor: "系统", subject: {type: "customer", name: "对象", state: "初始"}},
    {localId: "n2", nodeType: "outcome", time: "T1", executor: "系统", subject: {type: "customer", name: "对象", state: "完成"}},
  ],
  edges: [{
    localId: "e1", from: "n1", to: "n2", edgeType: "outcome",
    actorBehavior: {time: "T0", action: "无动作", status: "no_requirement"},
    subjectBehavior: {time: "T0", action: "无动作", status: "no_requirement"},
  }],
  strategyActions: [],
  processActions: [],
});
const noActionResult = designer.validateDocument(noActionDocument);
if (noActionResult.errors.length) throw new Error(`no_requirement unexpectedly invalid: ${JSON.stringify(noActionResult.errors)}`);
const exportedNoAction = JSON.parse(designer.toJSON(noActionDocument));
if (exportedNoAction.edges[0].actorBehavior.action !== "无动作"
  || exportedNoAction.edges[0].actorBehavior.status !== "no_requirement"
  || exportedNoAction.edges[0].subjectBehavior.action !== "无动作"
  || exportedNoAction.edges[0].subjectBehavior.status !== "no_requirement") {
  throw new Error("No-action round-trip contract failed");
}

const branchedLayout = designer.autoLayoutDocument({
  strategy: {strategyName: "layout"},
  nodes: ["n1", "n2", "n3", "n4"].map((id, index) => ({
    localId: id,
    nodeType: index === 3 ? "outcome" : "process",
    time: `T${index}`,
    executor: "系统",
    subject: {type: "customer", name: "对象", state: `S${index}`},
    layout: {x: index * 13, y: index * 7},
  })),
  edges: [
    {localId: "e1", from: "n1", to: "n2", actorBehavior: {time: "T", action: "a", status: "executed"}, subjectBehavior: {time: "T", action: "b", status: "happened"}},
    {localId: "e2", from: "n2", to: "n4", actorBehavior: {time: "T", action: "a", status: "executed"}, subjectBehavior: {time: "T", action: "b", status: "happened"}},
    {localId: "e3", from: "n1", to: "n3", actorBehavior: {time: "T", action: "a", status: "executed"}, subjectBehavior: {time: "T", action: "b", status: "happened"}},
    {localId: "e4", from: "n3", to: "n4", actorBehavior: {time: "T", action: "a", status: "executed"}, subjectBehavior: {time: "T", action: "b", status: "happened"}},
  ],
});
const nodeById = new Map(branchedLayout.nodes.map(node => [node.localId, node]));
if (nodeById.get("n1").layout.x >= nodeById.get("n2").layout.x
  || nodeById.get("n2").layout.x >= nodeById.get("n4").layout.x
  || nodeById.get("n1").layout.x >= nodeById.get("n3").layout.x) {
  throw new Error("Auto layout did not preserve forward flow ranks");
}

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const id of ["copySelectionBtn", "pasteSelectionBtn", "undoBtn", "redoBtn", "selectionBox"]) {
  if (!indexHtml.includes(`id="${id}"`)) throw new Error(`Missing interaction element: ${id}`);
}

console.log("strategy-flow-input package checks passed.");
