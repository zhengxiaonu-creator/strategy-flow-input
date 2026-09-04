"use strict";

// The single command entry for the strategy agent. Everything - CLI, page,
// tests - goes through executeCommand; no caller touches artifacts directly.

const crypto = require("node:crypto");
const {buildCorpus} = require("./parse");
const {generateDraft} = require("./models/stub");
const {validateManifest, validateCorpus, validateDraft, resolvePointer} = require("./validate");
const {Store} = require("./store");

const COMMANDS = ["parse-sources", "generate-draft", "get-draft", "resolve-draft", "request-approval", "confirm-draft", "discard-draft", "get-case"];
const TOKEN_TTL_MS = 10 * 60 * 1000;

function ok(command, requestId, data, replayed = false) {
  return {schemaVersion: "strategy-agent-response/0.1", requestId, command, status: "ok", replayed, data};
}

function fail(command, requestId, code, message, details) {
  return {
    schemaVersion: "strategy-agent-response/0.1",
    requestId,
    command,
    status: "error",
    replayed: false,
    error: {code, message, ...(details?.length ? {details} : {})},
  };
}

function timestamp(now = new Date()) {
  return new Date(now).toISOString().replace(/\.(\d{3})Z$/, "+00:00");
}

function pathToPointer(path) {
  return `/${path.replace(/\[(\d+)\]/g, "/$1").replace(/\./g, "/")}`;
}

function inputFingerprint(command, value) {
  return crypto.createHash("sha256").update(`${command}:${JSON.stringify(value)}`).digest("hex");
}

function listTokens(store, caseId) {
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = path.join(store.caseDir(caseId), "tokens");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(name => name.endsWith(".json"))
    .map(name => store.readJson(path.join(dir, name)));
}

function designerChecks(designer, draft) {
  const gate = designer.outputContractGate({
    ...draft.candidate,
    registrationMetadata: draft.registrationMetadataCandidate,
  });
  const issues = gate.blocking.map(error => {
    const target = error.code.startsWith("METADATA_") ? "metadata" : "design";
    const root = target === "metadata" ? draft.registrationMetadataCandidate : draft.candidate;
    return {target, pointer: anchorPointer(root, error.path), code: error.code, message: error.message};
  });
  return {ready: gate.ready, issues};
}

// Designer paths live in the canonical model; draft pointers live in the
// external candidate shape. Anchor upward to the nearest resolvable pointer
// so questions always land on a real node instead of failing resolution.
function anchorPointer(root, path) {
  const tokens = String(path || "schemaVersion").replace(/\[(\d+)\]/g, "/$1").split(".");
  while (tokens.length) {
    const pointer = `/${tokens.join("/")}`;
    if (resolvePointer(root, pointer).found) return pointer;
    tokens.pop();
  }
  return "/schemaVersion";
}

function mergeValidationQuestions(draft, checks) {
  const existing = new Set(draft.openQuestions.map(question => `${question.target ?? "design"}:${question.pointer}`));
  let index = draft.openQuestions.length;
  for (const issue of checks.issues) {
    const key = `${issue.target}:${issue.pointer}`;
    if (existing.has(key)) continue;
    existing.add(key);
    index += 1;
    draft.openQuestions.push({
      target: issue.target,
      questionId: `q-v${String(index).padStart(3, "0")}`,
      pointer: issue.pointer,
      question: `输出契约待办：${issue.code} ${issue.message}`,
      evidenceRefs: [],
    });
  }
}

function blockingDetails(checks) {
  const seen = new Set();
  const details = [];
  // Provenance blocking is intentionally excluded: evidence state is review
  // material, while the optional audit path gates only output contract issues.
  for (const item of checks.issues.map(issue => ({target: issue.target, pointer: issue.pointer, status: "invalid", code: issue.code}))) {
    const key = `${item.target}:${item.pointer}:${item.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    details.push(item);
  }
  return details;
}

function applyResolvedFields(draft, resolvedFields, audit) {
  for (const resolved of resolvedFields ?? []) {
    const root = resolved.target === "metadata" ? draft.registrationMetadataCandidate : draft.candidate;
    if (!resolvePointer(root, resolved.pointer).found) {
      return {ok: false, error: `E_DRAFT_PROVENANCE_POINTER_INVALID:${resolved.pointer}`};
    }
    const tokens = resolved.pointer.slice(1).split("/").map(token => token.replace(/~1/g, "/").replace(/~0/g, "~"));
    let target = root;
    for (const token of tokens.slice(0, -1)) target = target[token];
    target[tokens[tokens.length - 1]] = resolved.value;
    draft.provenance = draft.provenance.filter(item => !((item.target ?? "design") === (resolved.target ?? "design") && item.pointer === resolved.pointer));
    draft.openQuestions = draft.openQuestions.filter(item => !((item.target ?? "design") === (resolved.target ?? "design") && item.pointer === resolved.pointer));
    audit.push({action: "human_resolved", target: resolved.target ?? "design", pointer: resolved.pointer});
  }
  return {ok: true};
}

function executeCommand({command, requestId, input = {}, store, now = new Date(), designer, taxonomy}) {
  const designerModule = designer ?? require("../app.js");
  const taxonomyContract = taxonomy ?? require("../contracts/strategy-taxonomy-2026-09.json");
  if (!COMMANDS.includes(command)) return fail(command, requestId ?? "req-unknown", "E_COMMAND_UNKNOWN", `未知命令：${command}`);
  if (!/^req-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(requestId ?? "")) {
    return fail(command, requestId ?? "req-unknown", "E_REQUEST_ID_INVALID", "requestId 必须形如 req-<slug>。");
  }
  const agentStore = store ?? new Store(process.env.STRATEGY_AGENT_STORE || "./strategy-agent-store");
  const stampedAt = timestamp(now);
  const replayable = ["parse-sources", "generate-draft", "resolve-draft", "confirm-draft", "discard-draft"].includes(command);
  const fingerprint = replayable
    ? inputFingerprint(command, command === "parse-sources"
      ? {caseId: input.caseId, files: (input.files ?? []).map(file => [file.fileName, file.mimeType, file.contentBase64?.length ?? 0])}
      : command === "generate-draft" ? {caseId: input.caseId, corpusId: input.corpusId, model: input.model}
      : command === "resolve-draft" ? {caseId: input.caseId, draftId: input.draftId, resolvedFields: input.resolvedFields}
      : command === "confirm-draft" ? {caseId: input.caseId, draftId: input.draftId, approvalToken: input.approvalToken, resolvedFields: input.resolvedFields}
      : {caseId: input.caseId, draftId: input.draftId})
    : null;
  if (replayable) {
    const cached = agentStore.readRequest(requestId);
    if (cached) {
      if (cached.fingerprint === fingerprint) return {...cached.envelope, replayed: true};
      return fail(command, requestId, "E_REQUEST_ID_CONFLICT", "同一 requestId 携带了不同输入指纹。");
    }
  }
  const envelope = runCommand({command, requestId, input, store: agentStore, now: stampedAt, designer: designerModule, taxonomy: taxonomyContract});
  if (replayable && envelope.status === "ok") {
    agentStore.saveRequest(requestId, {fingerprint, envelope});
  }
  return envelope;
}

function runCommand({command, requestId, input, store, now, designer, taxonomy}) {
  try {
    if (command === "parse-sources") return parseSources({requestId, input, store, now});
    if (command === "generate-draft") return generateDraftCommand({requestId, input, store, now, designer, taxonomy});
    if (command === "get-draft") return getDraft({requestId, input, store});
    if (command === "resolve-draft") return resolveDraft({requestId, input, store, now, designer});
    if (command === "request-approval") return requestApproval({requestId, input, store, now, designer});
    if (command === "confirm-draft") return confirmDraft({requestId, input, store, now, designer});
    if (command === "discard-draft") return discardDraft({requestId, input, store, now});
    if (command === "get-case") return getCase({requestId, input, store});
    return fail(command, requestId, "E_COMMAND_UNKNOWN", `未知命令：${command}`);
  } catch (error) {
    if (error.message?.startsWith("AGENT_INPUT:")) {
      return fail(command, requestId, "E_INPUT_INVALID", error.message.replace("AGENT_INPUT:", ""));
    }
    return fail(command, requestId, "E_INTERNAL", `内部错误：${error.message}`);
  }
}

function requireCase(input, store, now) {
  if (!/^AG-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(input.caseId ?? "")) {
    throw new Error("AGENT_INPUT:caseId 必须形如 AG-<slug>。");
  }
  return store.ensureCase(input.caseId, now);
}

function createWorkspaceId(store) {
  let caseId;
  do {
    caseId = `AG-w${crypto.randomBytes(9).toString("hex")}`;
  } while (store.getCase(caseId));
  return caseId;
}

function parseSources({requestId, input, store, now}) {
  const caseId = input.caseId === undefined
    ? createWorkspaceId(store)
    : requireCase(input, store, now).caseId;
  const caseRecord = store.ensureCase(caseId, now);
  if (!Array.isArray(input.files) || !input.files.length) throw new Error("AGENT_INPUT:files 不能为空。");
  const files = input.files.map((file, index) => {
    if (!file?.fileName?.trim()) throw new Error(`AGENT_INPUT:files[${index}].fileName 缺失。`);
    const buffer = Buffer.from(file.contentBase64 ?? "", "base64");
    if (!buffer.length) throw new Error(`AGENT_INPUT:files[${index}].contentBase64 为空。`);
    return {fileName: file.fileName, mimeType: file.mimeType ?? "", buffer};
  });
  const {manifest, corpus, fingerprint} = buildCorpus({files, now});
  manifest.caseId = caseId;
  manifest.requestId = requestId;
  const manifestCheck = validateManifest(manifest);
  const corpusCheck = validateCorpus(corpus, manifest);
  if (!manifestCheck.valid || !corpusCheck.valid) {
    return fail("parse-sources", requestId, "E_CORPUS_INVALID", "解析产物未通过契约校验。", [...manifestCheck.errors, ...corpusCheck.errors].map(message => ({field: message})));
  }
  store.writeManifest(caseId, manifest);
  store.writeCorpus(caseId, {...corpus, fingerprint});
  if (!caseRecord.manifestIds.includes(manifest.manifestId)) caseRecord.manifestIds.push(manifest.manifestId);
  if (!caseRecord.corpusIds.includes(corpus.corpusId)) caseRecord.corpusIds.push(corpus.corpusId);
  caseRecord.status = "sources_parsed";
  caseRecord.nextAction = "generate_draft";
  store.saveCase(caseId, caseRecord, now);
  store.appendAudit(caseId, {at: now, command: "parse-sources", requestId, outcome: "ok", manifestId: manifest.manifestId, corpusId: corpus.corpusId});
  return ok("parse-sources", requestId, {caseId, manifest, corpus});
}

function generateDraftCommand({requestId, input, store, now, designer, taxonomy}) {
  const caseRecord = requireCase(input, store, now);
  if (input.model && input.model !== "stub") {
    return fail("generate-draft", requestId, "E_MODEL_ADAPTER_UNAVAILABLE", `模型适配器未注册：${input.model}；当前仅支持离线 stub。`);
  }
  const corpusId = input.corpusId ?? caseRecord.corpusIds[caseRecord.corpusIds.length - 1];
  const corpusRecord = corpusId ? store.readCorpus(input.caseId, corpusId) : null;
  if (!corpusRecord) return fail("generate-draft", requestId, "E_CORPUS_NOT_FOUND", `证据库不存在：${corpusId ?? "(none)"}`);
  const {fingerprint, ...corpus} = corpusRecord;
  const draftId = `sd-${crypto.createHash("sha256").update(`${corpusId}:${requestId}`).digest("hex").slice(0, 12)}`;
  const draft = generateDraft({corpus, corpusFingerprint: fingerprint, taxonomy, draftId, caseId: input.caseId, requestId, now});
  const checks = designerChecks(designer, draft);
  mergeValidationQuestions(draft, checks);
  const validation = validateDraft(draft, corpus);
  if (!validation.valid) {
    return fail("generate-draft", requestId, "E_MODEL_OUTPUT_INVALID", "模型输出未通过草稿契约校验。", validation.errors.map(message => ({field: message})));
  }
  store.writeDraft(input.caseId, draft);
  if (!caseRecord.draftIds.includes(draftId)) caseRecord.draftIds.push(draftId);
  caseRecord.status = "draft_generated";
  caseRecord.nextAction = "review_draft";
  store.saveCase(input.caseId, caseRecord, now);
  store.appendAudit(input.caseId, {at: now, command: "generate-draft", requestId, outcome: "ok", draftId, corpusId});
  return ok("generate-draft", requestId, {draft});
}

function getDraft({requestId, input, store}) {
  if (!store.getCase(input.caseId ?? "")) return fail("get-draft", requestId, "E_CASE_NOT_FOUND", `case 不存在：${input.caseId}`);
  const draft = store.readDraft(input.caseId, input.draftId);
  if (!draft) return fail("get-draft", requestId, "E_DRAFT_NOT_FOUND", `草稿不存在：${input.draftId}`);
  return ok("get-draft", requestId, {draft});
}

function requestApproval({requestId, input, store, now, designer}) {
  const caseRecord = requireCase(input, store, now);
  const draft = store.readDraft(input.caseId, input.draftId);
  if (!draft) return fail("request-approval", requestId, "E_DRAFT_NOT_FOUND", `草稿不存在：${input.draftId}`);
  if (!["draft", "in_review"].includes(draft.reviewState.status)) {
    return fail("request-approval", requestId, "E_DRAFT_STATE_INVALID", `草稿状态不允许审批：${draft.reviewState.status}`);
  }
  const corpusRecord = store.readCorpus(input.caseId, draft.evidenceCorpus.corpusId);
  const {fingerprint, ...corpus} = corpusRecord ?? {fingerprint: draft.evidenceCorpus.sha256};
  const validation = validateDraft(draft, corpus);
  const checks = designerChecks(designer, draft);
  const blocking = blockingDetails(checks);
  if (!validation.valid) {
    return fail("request-approval", requestId, "E_DRAFT_INVALID", "草稿 envelope / corpus 校验失败，禁止发起审计审批。", validation.errors.map(message => ({field: message})));
  }
  if (blocking.length) {
    return fail("request-approval", requestId, "E_DRAFT_UNCONFIRMED_REQUIRED_FIELD", "候选稿未达到导出契约，禁止发起审计审批。", blocking);
  }
  const tokenValue = `at-${crypto.randomBytes(24).toString("hex")}`;
  const approvalTokenId = `at-${crypto.createHash("sha256").update(tokenValue).digest("hex").slice(0, 12)}`;
  const expiresAt = timestamp(new Date(new Date(now).getTime() + TOKEN_TTL_MS));
  store.saveToken(input.caseId, {
    approvalTokenId,
    draftId: input.draftId,
    approver: input.approver ?? "",
    tokenSha256: crypto.createHash("sha256").update(tokenValue).digest("hex"),
    createdAt: now,
    expiresAt,
    consumedAt: null,
  });
  draft.reviewState.status = "in_review";
  store.writeDraft(input.caseId, draft);
  caseRecord.status = "in_review";
  caseRecord.nextAction = "confirm_with_token";
  store.saveCase(input.caseId, caseRecord, now);
  store.appendAudit(input.caseId, {at: now, command: "request-approval", requestId, outcome: "ok", draftId: input.draftId, approvalTokenId});
  return ok("request-approval", requestId, {approvalTokenId, approvalToken: tokenValue, expiresAt});
}

function resolveDraft({requestId, input, store, now, designer}) {
  const caseRecord = requireCase(input, store, now);
  const draft = store.readDraft(input.caseId, input.draftId);
  if (!draft) return fail("resolve-draft", requestId, "E_DRAFT_NOT_FOUND", `草稿不存在：${input.draftId}`);
  if (!["draft", "in_review"].includes(draft.reviewState.status)) {
    return fail("resolve-draft", requestId, "E_DRAFT_STATE_INVALID", `草稿状态不允许人工补齐：${draft.reviewState.status}`);
  }
  if (!Array.isArray(input.resolvedFields) || !input.resolvedFields.length) {
    throw new Error("AGENT_INPUT:resolvedFields 不能为空。");
  }
  const auditActions = [];
  const resolved = applyResolvedFields(draft, input.resolvedFields, auditActions);
  if (!resolved.ok) {
    const [code, pointer] = resolved.error.split(":");
    return fail("resolve-draft", requestId, code, `resolvedFields 指针无法解析：${pointer}`);
  }
  const corpusRecord = store.readCorpus(input.caseId, draft.evidenceCorpus.corpusId);
  const {fingerprint, ...corpus} = corpusRecord ?? {};
  const validation = corpusRecord ? validateDraft(draft, corpus) : {valid: true, errors: [], blocking: []};
  if (!validation.valid) {
    return fail("resolve-draft", requestId, "E_DRAFT_INVALID", "人工补齐后草稿契约校验失败。", validation.errors.map(message => ({field: message})));
  }
  store.writeDraft(input.caseId, draft);
  caseRecord.status = "in_review";
  caseRecord.nextAction = "request_approval";
  store.saveCase(input.caseId, caseRecord, now);
  store.appendAudit(input.caseId, {at: now, command: "resolve-draft", requestId, outcome: "ok", draftId: input.draftId, actions: auditActions});
  return ok("resolve-draft", requestId, {draft});
}

function confirmDraft({requestId, input, store, now, designer}) {
  const caseRecord = requireCase(input, store, now);
  const draft = store.readDraft(input.caseId, input.draftId);
  if (!draft) return fail("confirm-draft", requestId, "E_DRAFT_NOT_FOUND", `草稿不存在：${input.draftId}`);
  const tokenHash = crypto.createHash("sha256").update(input.approvalToken ?? "").digest("hex");
  const token = listTokens(store, input.caseId).find(item => item.tokenSha256 === tokenHash && item.draftId === input.draftId);
  if (!token) return fail("confirm-draft", requestId, "E_APPROVAL_TOKEN_INVALID", "审批 token 不存在或不属于该草稿。");
  if (token.consumedAt) return fail("confirm-draft", requestId, "E_APPROVAL_TOKEN_REUSED", "一次性审批 token 已被消费。");
  if (new Date(now) > new Date(token.expiresAt)) {
    return fail("confirm-draft", requestId, "E_APPROVAL_TOKEN_EXPIRED", "审批 token 已过期。");
  }
  if (!["draft", "in_review"].includes(draft.reviewState.status)) {
    return fail("confirm-draft", requestId, "E_DRAFT_STATE_INVALID", `草稿状态不允许确认：${draft.reviewState.status}`);
  }
  const auditActions = [];
  const resolved = applyResolvedFields(draft, input.resolvedFields, auditActions);
  if (!resolved.ok) {
    const [code, pointer] = resolved.error.split(":");
    return fail("confirm-draft", requestId, code, `resolvedFields 指针无法解析：${pointer}`);
  }
  const corpusRecord = store.readCorpus(input.caseId, draft.evidenceCorpus.corpusId);
  const {fingerprint, ...corpus} = corpusRecord ?? {fingerprint: draft.evidenceCorpus.sha256};
  const validation = validateDraft(draft, corpus);
  const checks = designerChecks(designer, draft);
  const blocking = blockingDetails(checks);
  if (!validation.valid || blocking.length) {
    store.appendAudit(input.caseId, {at: now, command: "confirm-draft", requestId, outcome: "blocked", draftId: input.draftId, blocking});
    return fail("confirm-draft", requestId, "E_DRAFT_UNCONFIRMED_REQUIRED_FIELD", "候选稿未达到导出契约，禁止审计确认。", blocking);
  }
  token.consumedAt = now;
  store.saveToken(input.caseId, token);
  draft.reviewState = {status: "confirmed", confirmedBy: input.confirmedBy ?? "", confirmedAt: now, approvalTokenId: token.approvalTokenId};
  store.writeDraft(input.caseId, draft);
  caseRecord.status = "confirmed";
  caseRecord.nextAction = "export_and_import_flow";
  caseRecord.confirmedDraftId = input.draftId;
  store.saveCase(input.caseId, caseRecord, now);
  store.appendAudit(input.caseId, {at: now, command: "confirm-draft", requestId, outcome: "ok", draftId: input.draftId, approvalTokenId: token.approvalTokenId, actions: auditActions});
  const registrationCaseId = cleanOptionalId(draft.candidate?.strategy?.registrationCaseId);
  return ok("confirm-draft", requestId, {
    draft,
    nextAction: "export_and_import_flow",
    submissionCommand: "python manage_case.py --json import-flow "
      + (registrationCaseId ? `--case ${registrationCaseId} ` : "")
      + `--design strategy-flow-0.4.json --metadata strategy-flow-registration-metadata-2.0.json `
      + `--actor ${input.confirmedBy ?? "<actor>"} --request-id ${requestId}`,
  });
}

function cleanOptionalId(value) {
  return String(value ?? "").trim();
}

function discardDraft({requestId, input, store, now}) {
  const caseRecord = requireCase(input, store, now);
  const draft = store.readDraft(input.caseId, input.draftId);
  if (!draft) return fail("discard-draft", requestId, "E_DRAFT_NOT_FOUND", `草稿不存在：${input.draftId}`);
  if (draft.reviewState.status !== "discarded") {
    draft.reviewState.status = "discarded";
    store.writeDraft(input.caseId, draft);
    caseRecord.status = caseRecord.confirmedDraftId ? caseRecord.status : "discarded";
    caseRecord.nextAction = "generate_draft";
    store.saveCase(input.caseId, caseRecord, now);
    store.appendAudit(input.caseId, {at: now, command: "discard-draft", requestId, outcome: "ok", draftId: input.draftId});
  }
  return ok("discard-draft", requestId, {draft});
}

function getCase({requestId, input, store}) {
  const caseRecord = store.getCase(input.caseId ?? "");
  if (!caseRecord) return fail("get-case", requestId, "E_CASE_NOT_FOUND", `case 不存在：${input.caseId}`);
  const drafts = caseRecord.draftIds.map(draftId => store.readDraft(input.caseId, draftId)).filter(Boolean)
    .map(draft => ({draftId: draft.draftId, reviewState: draft.reviewState.status, createdAt: draft.createdAt}));
  return ok("get-case", requestId, {case: caseRecord, drafts, audit: store.readAudit(input.caseId).slice(-50)});
}

module.exports = {executeCommand, COMMANDS};
