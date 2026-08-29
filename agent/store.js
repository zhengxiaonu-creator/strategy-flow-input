"use strict";

// File-backed persistent state. Chat memory is never a state source: caseId,
// status, nextAction, artifacts and an append-only audit log own recovery.

const fs = require("node:fs");
const path = require("node:path");

class Store {
  constructor(rootDir) {
    this.rootDir = rootDir;
    fs.mkdirSync(path.join(rootDir, "cases"), {recursive: true});
    fs.mkdirSync(path.join(rootDir, "requests"), {recursive: true});
  }

  caseDir(caseId) {
    if (!/^[A-Z]{2}-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(caseId)) throw new Error(`Invalid caseId: ${caseId}`);
    const dir = path.join(this.rootDir, "cases", caseId);
    return dir;
  }

  ensureCase(caseId, now) {
    const dir = this.caseDir(caseId);
    const file = path.join(dir, "case.json");
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.join(dir, "manifests"), {recursive: true});
      fs.mkdirSync(path.join(dir, "corpora"), {recursive: true});
      fs.mkdirSync(path.join(dir, "drafts"), {recursive: true});
      fs.mkdirSync(path.join(dir, "tokens"), {recursive: true});
      this.writeJson(file, {
        caseId,
        status: "created",
        nextAction: "parse_sources",
        createdAt: now,
        updatedAt: now,
        manifestIds: [],
        corpusIds: [],
        draftIds: [],
        confirmedDraftId: null,
      });
    }
    return this.readJson(file);
  }

  getCase(caseId) {
    const file = path.join(this.caseDir(caseId), "case.json");
    if (!fs.existsSync(file)) return null;
    return this.readJson(file);
  }

  saveCase(caseId, caseRecord, now) {
    caseRecord.updatedAt = now;
    this.writeJson(path.join(this.caseDir(caseId), "case.json"), caseRecord);
    return caseRecord;
  }

  writeManifest(caseId, manifest) {
    this.writeJson(path.join(this.caseDir(caseId), "manifests", `${manifest.manifestId}.json`), manifest);
  }

  readManifest(caseId, manifestId) {
    return this.readOptional(path.join(this.caseDir(caseId), "manifests", `${manifestId}.json`));
  }

  writeCorpus(caseId, corpus) {
    this.writeJson(path.join(this.caseDir(caseId), "corpora", `${corpus.corpusId}.json`), corpus);
  }

  readCorpus(caseId, corpusId) {
    return this.readOptional(path.join(this.caseDir(caseId), "corpora", `${corpusId}.json`));
  }

  writeDraft(caseId, draft) {
    this.writeJson(path.join(this.caseDir(caseId), "drafts", `${draft.draftId}.json`), draft);
  }

  readDraft(caseId, draftId) {
    return this.readOptional(path.join(this.caseDir(caseId), "drafts", `${draftId}.json`));
  }

  saveToken(caseId, token) {
    this.writeJson(path.join(this.caseDir(caseId), "tokens", `${token.approvalTokenId}.json`), token);
  }

  readToken(caseId, approvalTokenId) {
    return this.readOptional(path.join(this.caseDir(caseId), "tokens", `${approvalTokenId}.json`));
  }

  appendAudit(caseId, entry) {
    const dir = this.caseDir(caseId);
    fs.mkdirSync(dir, {recursive: true});
    fs.appendFileSync(path.join(dir, "audit.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
  }

  readAudit(caseId) {
    const file = path.join(this.caseDir(caseId), "audit.jsonl");
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line));
  }

  saveRequest(requestId, envelope) {
    this.writeJson(path.join(this.rootDir, "requests", `${requestId}.json`), envelope);
  }

  readRequest(requestId) {
    return this.readOptional(path.join(this.rootDir, "requests", `${requestId}.json`));
  }

  readOptional(file) {
    if (!fs.existsSync(file)) return null;
    return this.readJson(file);
  }

  readJson(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.renameSync(temporary, file);
  }
}

module.exports = {Store};
