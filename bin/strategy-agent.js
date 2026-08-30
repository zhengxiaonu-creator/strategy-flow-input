#!/usr/bin/env node
"use strict";

// CLI facade for the single agent command entry. Output is always one
// strategy-agent-response/0.1 envelope; exit 0 on ok, 1 on error.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const {executeCommand, COMMANDS} = require("../agent");

const MIME_TYPES = new Map([
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".csv", "text/csv"],
  [".md", "text/markdown"],
  [".txt", "text/plain"],
]);

function usage() {
  console.log(`Usage: strategy-agent <command> [options]

Commands:
  parse-sources     Parse local files into an evidence corpus
  generate-draft    Generate a provenance-backed strategy draft (offline stub)
  get-draft         Read one draft
  resolve-draft     Fill missing facts as a human (no token needed)
  request-approval  Issue an optional audit token for a schema-clean draft
  confirm-draft     Record an optional audit confirmation with a one-time token
  discard-draft     Discard a draft
  get-case          Read case state, drafts and audit tail

Options:
  --case <id>             Local workspace id; optional for parse-sources and required by other commands
  --file <path>           Input file for parse-sources (repeatable)
  --corpus <id>           Corpus id for generate-draft
  --draft <id>            Draft id
  --token <token>         Approval token value
  --approver <name>       Approver display name
  --confirmed-by <name>   Confirmer identity
  --resolved <p=v>        resolvedFields entry, e.g. metadata:/submitDate=2026-08-30 (repeatable)
  --request-id <id>       Idempotency key (req-<slug>); auto-generated when omitted
  --store <dir>           State directory (default ./strategy-agent-store)
  --help                  Show this help
`);
}

const args = process.argv.slice(2);
const command = args[0];
if (!command || command === "--help" || command === "-h") {
  usage();
  process.exit(command ? 0 : 2);
}
if (!COMMANDS.includes(command)) {
  console.error(`Unknown command: ${command}`);
  usage();
  process.exit(2);
}

const options = {files: [], resolved: []};
for (let index = 1; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--help" || argument === "-h") {
    usage();
    process.exit(0);
  } else if (argument === "--case") options.caseId = args[++index];
  else if (argument === "--file") options.files.push(args[++index]);
  else if (argument === "--corpus") options.corpusId = args[++index];
  else if (argument === "--draft") options.draftId = args[++index];
  else if (argument === "--token") options.approvalToken = args[++index];
  else if (argument === "--approver") options.approver = args[++index];
  else if (argument === "--confirmed-by") options.confirmedBy = args[++index];
  else if (argument === "--resolved") options.resolved.push(args[++index]);
  else if (argument === "--request-id") options.requestId = args[++index];
  else if (argument === "--store") options.store = args[++index];
  else {
    console.error(`Unknown option: ${argument}`);
    process.exit(2);
  }
}

const requestId = options.requestId ?? `req-${crypto.randomBytes(6).toString("hex")}`;
const input = {
  caseId: options.caseId,
  corpusId: options.corpusId,
  draftId: options.draftId,
  approvalToken: options.approvalToken,
  approver: options.approver,
  confirmedBy: options.confirmedBy,
  resolvedFields: options.resolved.map(entry => {
    const separator = entry.indexOf("=");
    const targetAndPointer = entry.slice(0, separator);
    const target = targetAndPointer.includes(":") ? targetAndPointer.split(":")[0] : "design";
    const pointer = targetAndPointer.includes(":") ? targetAndPointer.slice(target.length + 1) : targetAndPointer;
    return {target, pointer, value: entry.slice(separator + 1)};
  }),
  files: options.files.map(file => {
    const buffer = fs.readFileSync(file);
    return {
      fileName: path.basename(file),
      mimeType: MIME_TYPES.get(path.extname(file).toLowerCase()) ?? "application/octet-stream",
      contentBase64: buffer.toString("base64"),
    };
  }),
};

const {Store} = require("../agent");
const envelope = executeCommand({
  command,
  requestId,
  input,
  ...(options.store ? {store: new Store(path.resolve(options.store))} : {}),
});
process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
process.exit(envelope.status === "ok" ? 0 : 1);
