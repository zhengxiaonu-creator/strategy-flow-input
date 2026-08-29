"use strict";

// Corpus assembly: deterministic ids + fingerprint. Evidence ids are assigned
// in manifest order and per-file document order, so identical inputs always
// produce an identical corpus.

const crypto = require("node:crypto");
const {parserFor} = require("./parsers");
const {corpusFingerprint} = require("./validate");

const PARSER_VERSION = "office-parser@0.1.0";

function buildCorpus({manifestId, files, now}) {
  const fragments = [];
  const manifestFiles = [];
  let fileIndex = 0;
  for (const file of files) {
    fileIndex += 1;
    const fileId = `sf-${String(fileIndex).padStart(3, "0")}`;
    const sha256 = crypto.createHash("sha256").update(file.buffer).digest("hex");
    const entry = {
      fileId,
      fileName: file.fileName,
      mimeType: file.mimeType || "application/octet-stream",
      byteSize: file.buffer.length,
      sha256,
      parserStatus: "pending",
    };
    const parser = parserFor(file.fileName, file.mimeType);
    if (!parser) {
      entry.parserStatus = "unsupported";
      entry.failureCode = "E_SOURCE_FILE_UNSUPPORTED";
      manifestFiles.push(entry);
      continue;
    }
    try {
      const parsed = parser.parse(file.buffer);
      const ordinals = new Map();
      for (const fragment of parsed) {
        const ordinal = (ordinals.get(fileId) ?? 0) + 1;
        ordinals.set(fileId, ordinal);
        fragments.push({
          evidenceId: `ev-${String(fragments.length + 1).padStart(4, "0")}`,
          fileId,
          fragmentType: fragment.fragmentType,
          ordinal,
          text: fragment.text,
          ...(fragment.table ? {table: fragment.table} : {}),
          ...(fragment.slide ? {slide: fragment.slide} : {}),
          ...(fragment.locator ? {locator: fragment.locator} : {}),
        });
      }
      entry.parserStatus = "parsed";
      entry.parsedAt = now;
      entry.corpusIds = [];
      manifestFiles.push(entry);
    } catch (error) {
      entry.parserStatus = "failed";
      entry.failureCode = "E_SOURCE_FILE_UNREADABLE";
      manifestFiles.push(entry);
    }
  }
  const inputFingerprint = crypto.createHash("sha256")
    .update(manifestId ?? "")
    .update(JSON.stringify(manifestFiles.map(file => [file.fileName, file.sha256])))
    .update(PARSER_VERSION)
    .digest("hex");
  const corpusId = `ec-${inputFingerprint.slice(0, 12)}`;
  const manifest = {
    schemaVersion: "strategy-agent-source-manifest/0.1",
    manifestId: `sm-${inputFingerprint.slice(12, 24)}`,
    caseId: null,
    requestId: null,
    createdAt: now,
    files: manifestFiles.map(file => file.parserStatus === "parsed" ? {...file, corpusIds: [corpusId]} : file),
  };
  const corpus = {
    schemaVersion: "strategy-agent-evidence-corpus/0.1",
    corpusId,
    manifestId: manifest.manifestId,
    parserVersion: PARSER_VERSION,
    createdAt: now,
    fragments,
  };
  const fingerprint = corpusFingerprint(corpus);
  return {manifest, corpus, fingerprint};
}

module.exports = {buildCorpus, PARSER_VERSION};
