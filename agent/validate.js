"use strict";

// Runtime validator for the strategy-agent/0.1 contracts. JSON Schema owns
// the shape at design time; this module owns the cross-file gates that a
// single schema cannot express (pointer resolution, evidence membership,
// fingerprint, provenance hard rules).

const crypto = require("node:crypto");

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function corpusFingerprint(corpus) {
  return crypto.createHash("sha256").update(canonicalJson(corpus), "utf8").digest("hex");
}

function resolvePointer(root, pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/")) return {found: false};
  if (pointer === "/") return {found: true, value: root};
  let value = root;
  for (const rawToken of pointer.slice(1).split("/")) {
    const key = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
    if (value === null || value === undefined || typeof value !== "object" || !(key in value)) return {found: false};
    value = value[key];
  }
  return {found: true, value};
}

function validateManifest(manifest) {
  const errors = [];
  if (manifest?.schemaVersion !== "strategy-agent-source-manifest/0.1") errors.push("schemaVersion must be strategy-agent-source-manifest/0.1");
  if (!/^AG-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(manifest?.caseId ?? "")) errors.push("caseId format invalid");
  if (!Array.isArray(manifest?.files) || !manifest.files.length) errors.push("files must be a non-empty array");
  const fileIds = new Set();
  for (const file of manifest?.files ?? []) {
    if (!/^sf-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(file?.fileId ?? "")) errors.push(`fileId invalid: ${file?.fileId}`);
    if (fileIds.has(file?.fileId)) errors.push(`fileId duplicated: ${file?.fileId}`);
    fileIds.add(file?.fileId);
    if (!/^[0-9a-f]{64}$/.test(file?.sha256 ?? "")) errors.push(`sha256 invalid: ${file?.fileId}`);
    if (!["pending", "parsed", "unsupported", "failed"].includes(file?.parserStatus)) errors.push(`parserStatus invalid: ${file?.fileId}`);
    if (file?.parserStatus === "parsed" && !(file?.corpusIds?.length && file?.parsedAt)) errors.push(`parsed file missing corpus citation: ${file?.fileId}`);
    if (["unsupported", "failed"].includes(file?.parserStatus) && !file?.failureCode) errors.push(`failed file missing failureCode: ${file?.fileId}`);
  }
  return {valid: !errors.length, errors, fileIds};
}

function validateCorpus(corpus, manifest) {
  const errors = [];
  if (corpus?.schemaVersion !== "strategy-agent-evidence-corpus/0.1") errors.push("schemaVersion must be strategy-agent-evidence-corpus/0.1");
  if (!Array.isArray(corpus?.fragments)) errors.push("fragments must be an array");
  const manifestFileIds = new Set((manifest?.files ?? []).map(file => file.fileId));
  const evidenceIds = new Set();
  for (const fragment of corpus?.fragments ?? []) {
    if (!/^ev-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(fragment?.evidenceId ?? "")) errors.push(`evidenceId invalid: ${fragment?.evidenceId}`);
    if (evidenceIds.has(fragment?.evidenceId)) errors.push(`evidenceId duplicated: ${fragment?.evidenceId}`);
    evidenceIds.add(fragment?.evidenceId);
    if (!manifestFileIds.has(fragment?.fileId)) errors.push(`fragment fileId outside manifest: ${fragment?.fileId}`);
    if (!Number.isInteger(fragment?.ordinal) || fragment.ordinal < 1) errors.push(`ordinal invalid: ${fragment?.evidenceId}`);
    if (!fragment?.text?.trim()) errors.push(`text empty: ${fragment?.evidenceId}`);
    if (["table", "sheet"].includes(fragment?.fragmentType) && !fragment?.table?.columns?.length) errors.push(`table structure missing: ${fragment?.evidenceId}`);
    if (fragment?.fragmentType === "slide" && !(fragment?.slide && fragment.slide.slideNumber >= 1)) errors.push(`slide structure missing: ${fragment?.evidenceId}`);
  }
  return {valid: !errors.length, errors, evidenceIds};
}

function draftTargets(draft) {
  return {
    design: draft?.candidate,
    metadata: draft?.registrationMetadataCandidate,
  };
}

function validateDraft(draft, corpus) {
  const errors = [];
  if (draft?.schemaVersion !== "strategy-agent-strategy-draft/0.1") errors.push("schemaVersion must be strategy-agent-strategy-draft/0.1");
  if (!["strategy-flow-input/0.2", "strategy-flow-input/0.3", "strategy-flow-input/0.4", "strategy-flow-input/0.5", "strategy-flow-input/0.6", "strategy-flow-input/0.7", "strategy-flow-input/0.8"].includes(draft?.candidate?.schemaVersion)) errors.push("candidate must be strategy-flow-input/0.2, 0.3, 0.4, 0.5, 0.6, 0.7, or 0.8");
  if (draft?.registrationMetadataCandidate?.schemaVersion !== "strategy-flow-registration-metadata/2.0") errors.push("metadata candidate must be 2.0");
  if (draft?.taxonomyVersion !== draft?.candidate?.taxonomy?.schemaVersion) errors.push("taxonomyVersion mismatch");
  const evidenceIds = new Set((corpus?.fragments ?? []).map(fragment => fragment.evidenceId));
  const targets = draftTargets(draft);
  const seen = new Set();
  for (const item of draft?.provenance ?? []) {
    const target = item.target ?? "design";
    const key = `${target}:${item.pointer}`;
    if (seen.has(key)) errors.push(`duplicate provenance pointer: ${key}`);
    seen.add(key);
    const resolved = resolvePointer(targets[target] ?? {}, item.pointer);
    if (!resolved.found) {
      errors.push(`unresolvable pointer: ${key}`);
      continue;
    }
    for (const ref of item.evidenceRefs ?? []) if (!evidenceIds.has(ref)) errors.push(`unknown evidence ref: ${ref}`);
    if (item.status === "supported") {
      if (!(item.evidenceRefs ?? []).length) errors.push(`supported without evidence: ${key}`);
      if (typeof item.confidence !== "number") errors.push(`supported without confidence: ${key}`);
    } else if (item.status === "missing") {
      if ((item.evidenceRefs ?? []).length) errors.push(`missing must not cite evidence: ${key}`);
      const value = resolved.value;
      const container = value !== null && typeof value === "object";
      const emptyScalar = value === "待确认" || value === "" || value === null;
      const emptyContainer = container && (Array.isArray(value) ? value.length === 0 : Object.values(value).every(sub => sub === "待确认" || sub === "" || sub === null || (Array.isArray(sub) && !sub.length)));
      if (!emptyScalar && !emptyContainer) errors.push(`missing field not 待确认/empty: ${key}`);
    } else if (item.status === "conflict") {
      if ((item.evidenceRefs ?? []).length < 2) errors.push(`conflict needs two evidence refs: ${key}`);
      if (typeof item.confidence !== "number" || !item.note) errors.push(`conflict needs confidence and note: ${key}`);
    } else {
      errors.push(`provenance status invalid: ${key}`);
    }
  }
  for (const question of draft?.openQuestions ?? []) {
    const target = question.target ?? "design";
    if (!resolvePointer(targets[target] ?? {}, question.pointer).found) errors.push(`openQuestion pointer unresolvable: ${target}:${question.pointer}`);
    for (const ref of question.evidenceRefs ?? []) if (!evidenceIds.has(ref)) errors.push(`openQuestion unknown evidence ref: ${ref}`);
  }
  if (draft?.evidenceCorpus?.corpusId !== corpus?.corpusId) errors.push("corpusId mismatch");
  if (draft?.evidenceCorpus?.sha256 !== corpusFingerprint(corpus)) errors.push("corpus fingerprint mismatch");
  if (draft?.evidenceCorpus?.parserVersion !== corpus?.parserVersion) errors.push("parserVersion mismatch");
  return {
    valid: !errors.length,
    errors,
    blocking: (draft?.provenance ?? []).filter(item => item.status === "missing" || item.status === "conflict")
      .map(item => ({target: item.target ?? "design", pointer: item.pointer, status: item.status})),
  };
}

module.exports = {canonicalJson, corpusFingerprint, resolvePointer, validateManifest, validateCorpus, validateDraft};
