"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

const root = path.resolve(__dirname, "..");
const required = [
  "app.js",
  "bin/strategy-flow-input.js",
  "contracts/strategy-flow-input-0.2.schema.json",
  "contracts/strategy-flow-registration-metadata-2.0.schema.json",
  "contracts/strategy-taxonomy-2026-09.json",
  "contracts/strategy-taxonomy-2026-09.js",
  "contracts/strategy-agent-response-0.1.schema.json",
  "contracts/strategy-agent-source-manifest-0.1.schema.json",
  "contracts/strategy-agent-evidence-corpus-0.1.schema.json",
  "contracts/strategy-agent-strategy-draft-0.1.schema.json",
  "contracts/strategy-agent-errors-0.1.json",
  "examples/contracts/strategy-flow-input-0.2.json",
  "examples/contracts/strategy-flow-registration-metadata-2.0.json",
  "examples/contracts/agent/source-manifest.example.json",
  "examples/contracts/agent/evidence-corpus.example.json",
  "examples/contracts/agent/strategy-draft.example.json",
  "examples/contracts/agent/response-generate-draft-ok.example.json",
  "examples/contracts/agent/response-confirm-draft-error.example.json",
  "index.html",
  "package.json",
  "schema/strategy-flow-input.schema.json",
  "styles.css",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

for (const relativePath of required) {
  assert(fs.existsSync(path.join(root, relativePath)), `Missing required file: ${relativePath}`);
}

const packageJson = readJson("package.json");
assert(packageJson.name === "strategy-flow-input", "Unexpected package name");
assert(packageJson.version === "1.2.0", "Package version must be 1.2.0");
assert(packageJson.files.includes("contracts"), "Package must include authority contracts");
assert(packageJson.bin?.["strategy-flow-input"] === "./bin/strategy-flow-input.js", "Missing CLI bin entry");

for (const script of ["app.js", "bin/strategy-flow-input.js", "contracts/strategy-taxonomy-2026-09.js", "scripts/test.js"]) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, script)], {stdio: "inherit"});
  assert(result.status === 0, `Syntax check failed: ${script}`);
}
for (const script of ["agent/zip.js", "agent/parsers.js", "agent/parse.js", "agent/validate.js", "agent/taxonomy.js", "agent/models/stub.js", "agent/store.js", "agent/commands.js", "agent/index.js", "bin/strategy-agent.js"]) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, script)], {stdio: "inherit"});
  assert(result.status === 0, `Syntax check failed: ${script}`);
}

const help = spawnSync(process.execPath, [path.join(root, "bin/strategy-flow-input.js"), "--help"], {encoding: "utf8"});
assert(help.status === 0 && help.stdout.includes("Usage: strategy-flow-input"), "CLI help contract failed");
const agentHelp = spawnSync(process.execPath, [path.join(root, "bin/strategy-agent.js"), "--help"], {encoding: "utf8"});
assert(agentHelp.status === 0 && agentHelp.stdout.includes("Usage: strategy-agent"), "Agent CLI help contract failed");

for (const relativePath of [
  "contracts/strategy-flow-input-0.2.schema.json",
  "contracts/strategy-flow-registration-metadata-2.0.schema.json",
  "contracts/strategy-taxonomy-2026-09.schema.json",
  "contracts/strategy-taxonomy-2026-09.json",
  "examples/contracts/strategy-flow-input-0.2.json",
  "examples/contracts/strategy-flow-registration-metadata-2.0.json",
  "contracts/strategy-agent-response-0.1.schema.json",
  "contracts/strategy-agent-source-manifest-0.1.schema.json",
  "contracts/strategy-agent-evidence-corpus-0.1.schema.json",
  "contracts/strategy-agent-strategy-draft-0.1.schema.json",
  "contracts/strategy-agent-errors-0.1.json",
  "examples/contracts/agent/source-manifest.example.json",
  "examples/contracts/agent/evidence-corpus.example.json",
  "examples/contracts/agent/strategy-draft.example.json",
  "examples/contracts/agent/response-generate-draft-ok.example.json",
  "examples/contracts/agent/response-confirm-draft-error.example.json",
  "schema/strategy-flow-input.schema.json",
  "schema/strategy-flow-input-0.1.schema.json",
]) {
  readJson(relativePath);
}

const designer = require(path.join(root, "app.js"));
assert(designer.SUPPORTED_SCHEMA_VERSIONS.join(",") === "strategy-flow-input/0.1,strategy-flow-input/0.2", "Version registry contract failed");
assert(designer.parseSchemaVersion("strategy-flow-input/0.2").key === "0.2", "Valid version was not parsed");
assert(designer.parseSchemaVersion("strategy-flow-input/v0.2").valid === false, "Invalid version suffix must fail");
assert(designer.parseSchemaVersion("other-flow/0.2").valid === false, "Invalid version namespace must fail");

const externalDesign = readJson("examples/contracts/strategy-flow-input-0.2.json");
const metadata = readJson("examples/contracts/strategy-flow-registration-metadata-2.0.json");
const canonical = designer.normalizeDocument(externalDesign);
canonical.registrationMetadata = metadata;
const validResult = designer.validateDocument(canonical);
assert(validResult.status === "ready_to_submit", `Authority example unexpectedly invalid: ${JSON.stringify(validResult)}`);

const exported = designer.toExportDocument(canonical);
assert(exported.schemaVersion === "strategy-flow-input/0.2", "Designer must export 0.2");
assert(exported.validation.status === "ready_to_submit", "Exported authority example must remain valid");
assert(!("registrationMetadata" in exported), "Companion metadata must not leak into design JSON");
assert(designer.validateRegistrationMetadata(metadata).status === "ready_to_submit", "Metadata authority example unexpectedly invalid");
assert(designer.toRegistrationMetadataDocument(canonical).schemaVersion === "strategy-flow-registration-metadata/2.0", "Metadata export version failed");

const roundTripped = designer.normalizeDocument(exported);
for (const key of ["strategy", "nodes", "edges", "strategyActions", "processActions"]) {
  assert(JSON.stringify(roundTripped[key]) === JSON.stringify(canonical[key]), `0.2 round-trip changed ${key}`);
}
assert(JSON.stringify(roundTripped.taxonomy.selections) === JSON.stringify(canonical.taxonomy.selections), "0.2 taxonomy round-trip failed");
assert(roundTripped.taxonomy.strategySubtype === canonical.taxonomy.strategySubtype, "0.2 free-text round-trip failed");

const unsupported = designer.validateDocument({...externalDesign, schemaVersion: "strategy-flow-input/0.3"});
assert(unsupported.errors.some(error => error.code === "SCHEMA_VERSION_UNSUPPORTED"), "Unknown future version must be rejected explicitly");
const malformed = designer.validateDocument({...externalDesign, schemaVersion: "strategy-flow-input/v0.2"});
assert(malformed.errors.some(error => error.code === "SCHEMA_VERSION_INVALID"), "Malformed version must be rejected");
const missingVersion = designer.validateDocument({...externalDesign, schemaVersion: ""});
assert(missingVersion.errors.some(error => error.code === "SCHEMA_VERSION_REQUIRED"), "Missing version must be rejected");
const unknownField = designer.validateDocument({...externalDesign, unexpected: true});
assert(unknownField.errors.some(error => error.code === "SCHEMA_UNKNOWN_FIELD" && error.path === "unexpected"), "0.2 unknown top-level field must be rejected");
const invalidMetadata = designer.validateRegistrationMetadata({...metadata, businessUnit: "", unexpected: true});
assert(invalidMetadata.errors.some(error => error.code === "METADATA_FIELD_REQUIRED"), "Metadata required validation failed");
assert(invalidMetadata.errors.some(error => error.code === "SCHEMA_UNKNOWN_FIELD" && error.path === "unexpected"), "Metadata unknown field validation failed");

const invalidParent = JSON.parse(JSON.stringify(canonical));
invalidParent.taxonomy.selections.assetRange[0] = {code: "30w_50w", parentCode: "generic"};
const parentResult = designer.validateDocument(invalidParent);
assert(parentResult.errors.some(error => error.code === "TAG_PARENT_MISMATCH"), "Asset-range parent mismatch must be blocking");

const legacy = JSON.parse(JSON.stringify(externalDesign));
legacy.schemaVersion = "strategy-flow-input/0.1";
legacy.strategy = {
  ...legacy.strategy,
  businessScene: "用户激活",
  strategyType: "长尾客户运营策略",
  strategySubtype: "通用客群激活策略",
};
delete legacy.taxonomy;
const migrated = designer.normalizeDocument(legacy);
// 0.1 design did not own these facts; the former sidecar values must be
// explicitly merged before the 0.2 contract can become ready to submit.
migrated.taxonomy.selections.lifecycle = [{code: "existing", parentCode: null}];
migrated.taxonomy.selections.customerClass = [{code: "generic", parentCode: null}];
migrated.taxonomy.selections.assetRange = [{code: "unlimited", parentCode: "generic"}];
migrated.taxonomy.selections.riskLevel = [{code: "unspecified", parentCode: null}];
migrated.taxonomy.selections.touchScene = [{code: "app", parentCode: null}];
migrated.taxonomy.selections.touchMethod = [{code: "in_app_message", parentCode: "app"}];
migrated.registrationMetadata = metadata;
const migratedResult = designer.validateDocument(migrated);
assert(migratedResult.status === "ready_to_submit", `0.1 migration unexpectedly invalid: ${JSON.stringify(migratedResult)}`);
assert(migratedResult.warnings.some(error => error.code === "SCHEMA_MIGRATED"), "0.1 migration must be visible");
assert(migrated.taxonomy.selections.businessScene[0].code === "user_activation", "Legacy business scene migration failed");
assert(migrated.taxonomy.selections.strategyType[0].code === "tail_customer_operation", "Legacy strategy type migration failed");

const noActionDocument = JSON.parse(JSON.stringify(canonical));
noActionDocument.edges[0].actorBehavior = {time: "T0", action: "无动作", status: "no_requirement"};
noActionDocument.edges[0].subjectBehavior = {time: "T0", action: "无动作", status: "no_requirement"};
const noActionResult = designer.validateDocument(noActionDocument);
assert(noActionResult.errors.length === 0, `no_requirement unexpectedly invalid: ${JSON.stringify(noActionResult.errors)}`);
const exportedNoAction = designer.toExportDocument(noActionDocument);
assert(exportedNoAction.edges[0].actorBehavior.action === "无动作"
  && exportedNoAction.edges[0].actorBehavior.status === "no_requirement"
  && exportedNoAction.edges[0].subjectBehavior.action === "无动作"
  && exportedNoAction.edges[0].subjectBehavior.status === "no_requirement", "No-action round-trip contract failed");

// strategy-agent/0.1 M0 contracts: shape, referential integrity, provenance hard gates,
// and the no-fabrication round-trip from draft candidate to canonical 0.2 export.
const agentManifest = readJson("examples/contracts/agent/source-manifest.example.json");
const agentCorpus = readJson("examples/contracts/agent/evidence-corpus.example.json");
const agentDraft = readJson("examples/contracts/agent/strategy-draft.example.json");
const agentOkResponse = readJson("examples/contracts/agent/response-generate-draft-ok.example.json");
const agentErrorResponse = readJson("examples/contracts/agent/response-confirm-draft-error.example.json");
const agentErrors = readJson("contracts/strategy-agent-errors-0.1.json");

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function resolvePointer(root, pointer) {
  if (pointer === "") return {found: true, value: root};
  let value = root;
  for (const rawToken of pointer.slice(1).split("/")) {
    const key = rawToken.replace(/~1/g, "/").replace(/~0/g, "~");
    if (value === null || value === undefined || !(key in Object(value))) return {found: false};
    value = value[key];
  }
  return {found: true, value};
}

assert(agentManifest.schemaVersion === "strategy-agent-source-manifest/0.1", "Agent manifest version contract failed");
const manifestFileIds = new Set();
for (const file of agentManifest.files) {
  assert(!manifestFileIds.has(file.fileId), `Duplicate manifest fileId: ${file.fileId}`);
  manifestFileIds.add(file.fileId);
  assert(/^[0-9a-f]{64}$/.test(file.sha256), `Manifest sha256 must be lowercase hex: ${file.fileId}`);
  if (file.parserStatus === "parsed") {
    assert(file.parsedAt && Array.isArray(file.corpusIds) && file.corpusIds.length > 0, `Parsed file must cite corpus: ${file.fileId}`);
  }
  if (file.parserStatus === "unsupported" || file.parserStatus === "failed") {
    assert(Boolean(file.failureCode), `Failed file must record failureCode: ${file.fileId}`);
  }
}

assert(agentCorpus.schemaVersion === "strategy-agent-evidence-corpus/0.1", "Agent corpus version contract failed");
assert(agentCorpus.manifestId === agentManifest.manifestId, "Corpus must belong to the example manifest");
const evidenceIds = new Set();
for (const fragment of agentCorpus.fragments) {
  assert(!evidenceIds.has(fragment.evidenceId), `Duplicate evidenceId: ${fragment.evidenceId}`);
  evidenceIds.add(fragment.evidenceId);
  assert(manifestFileIds.has(fragment.fileId), `Corpus fileId not in manifest: ${fragment.fileId}`);
  assert(fragment.ordinal >= 1 && fragment.text.length > 0, `Fragment shape invalid: ${fragment.evidenceId}`);
  if (fragment.fragmentType === "table" || fragment.fragmentType === "sheet") {
    assert(fragment.table && fragment.table.columns.length > 0, `Table fragment missing structure: ${fragment.evidenceId}`);
  }
  if (fragment.fragmentType === "slide") {
    assert(fragment.slide && fragment.slide.slideNumber >= 1, `Slide fragment missing structure: ${fragment.evidenceId}`);
  }
}

assert(agentErrors.schemaVersion === "strategy-agent-errors/0.1", "Agent error registry version contract failed");
const errorCodeSet = new Set();
for (const error of agentErrors.errors) {
  assert(/^E_[A-Z][A-Z0-9_]*$/.test(error.code), `Invalid error code: ${error.code}`);
  assert(!errorCodeSet.has(error.code), `Duplicate error code: ${error.code}`);
  errorCodeSet.add(error.code);
  assert(Number.isInteger(error.httpStatus) && error.httpStatus >= 400 && error.httpStatus <= 599, `Invalid httpStatus: ${error.code}`);
  assert(typeof error.retryable === "boolean" && error.description.length > 0, `Invalid registry entry: ${error.code}`);
  assert(["request", "source", "corpus", "draft", "review", "approval", "model", "internal"].includes(error.stage), `Invalid stage: ${error.code}`);
}

assert(agentDraft.schemaVersion === "strategy-agent-strategy-draft/0.1", "Agent draft version contract failed");
assert(agentDraft.candidate.schemaVersion === "strategy-flow-input/0.2", "Draft candidate must stay on 0.2");
assert(agentDraft.registrationMetadataCandidate.schemaVersion === "strategy-flow-registration-metadata/2.0", "Draft metadata candidate must stay on 2.0");
assert(agentDraft.taxonomyVersion === agentDraft.candidate.taxonomy.schemaVersion, "Draft taxonomy version must match candidate");
assert(agentDraft.evidenceCorpus.corpusId === agentCorpus.corpusId, "Draft corpus id must match example corpus");
assert(agentDraft.evidenceCorpus.parserVersion === agentCorpus.parserVersion, "Draft parser version must match corpus");
const corpusFingerprint = require("node:crypto").createHash("sha256").update(canonicalJson(agentCorpus), "utf8").digest("hex");
assert(agentDraft.evidenceCorpus.sha256 === corpusFingerprint, "Corpus canonical fingerprint mismatch");

for (const item of [...agentDraft.provenance, ...agentDraft.openQuestions]) {
  const root = item.target === "metadata" ? agentDraft.registrationMetadataCandidate : agentDraft.candidate;
  const resolved = resolvePointer(root, item.pointer);
  assert(resolved.found, `Unresolvable pointer: ${item.target}:${item.pointer}`);
  if (!("status" in item)) continue;
  for (const ref of item.evidenceRefs) assert(evidenceIds.has(ref), `Unknown evidence ref: ${ref}`);
  if (item.status === "supported") {
    assert(item.evidenceRefs.length >= 1 && typeof item.confidence === "number", `Supported provenance needs evidence and confidence: ${item.pointer}`);
  } else if (item.status === "missing") {
    assert(item.evidenceRefs.length === 0, `Missing provenance must not cite evidence: ${item.pointer}`);
    const value = resolved.value;
    assert(value === "待确认" || value === "" || value === null || (Array.isArray(value) && value.length === 0), `Missing field must stay empty or 待确认: ${item.pointer}`);
  } else if (item.status === "conflict") {
    assert(item.evidenceRefs.length >= 2 && typeof item.confidence === "number" && item.note, `Conflict provenance needs two refs, confidence and note: ${item.pointer}`);
  }
}
assert(new Set(agentDraft.provenance.map(item => `${item.target || "design"}:${item.pointer}`)).size === agentDraft.provenance.length, "Duplicate provenance pointer");
assert(new Set(agentDraft.openQuestions.map(item => item.questionId)).size === agentDraft.openQuestions.length, "Duplicate openQuestion id");

const draftCanonical = designer.normalizeDocument(agentDraft.candidate);
const draftValidation = designer.validateDocument(draftCanonical);
assert(draftValidation.errors.some(error => error.code === "STRATEGY_FIELD_REQUIRED" && error.path === "strategy.strategyId"), "Draft must expose missing portal id instead of fabricating it");
assert(designer.validateRegistrationMetadata(agentDraft.registrationMetadataCandidate).status === "ready_to_submit", "Draft metadata candidate unexpectedly invalid");

// Human fills the registration fact, then the draft must flow through the
// unchanged normalize/validate/export round-trip without any agent extension.
const confirmedCandidate = JSON.parse(JSON.stringify(agentDraft.candidate));
confirmedCandidate.strategy.strategyId = "WB-CONTRACT-020-001";
const confirmedCanonical = designer.normalizeDocument(confirmedCandidate);
confirmedCanonical.registrationMetadata = agentDraft.registrationMetadataCandidate;
assert(designer.validateDocument(confirmedCanonical).status === "ready_to_submit", "Confirmed draft candidate unexpectedly invalid");
const confirmedExport = designer.toExportDocument(confirmedCanonical);
const confirmedRoundTrip = designer.normalizeDocument(confirmedExport);
for (const key of ["strategy", "nodes", "edges", "strategyActions", "processActions"]) {
  assert(JSON.stringify(confirmedRoundTrip[key]) === JSON.stringify(confirmedCanonical[key]), `Agent draft round-trip changed ${key}`);
}
assert(JSON.stringify(confirmedRoundTrip.taxonomy.selections) === JSON.stringify(confirmedCanonical.taxonomy.selections), "Agent draft taxonomy round-trip failed");
assert(!("provenance" in confirmedExport) && !("evidenceCorpus" in confirmedExport), "Agent envelope must not leak into 0.2 export");

assert(agentOkResponse.schemaVersion === "strategy-agent-response/0.1" && agentOkResponse.status === "ok", "Agent ok envelope contract failed");
assert(agentOkResponse.data && agentOkResponse.error === undefined, "Ok response must carry data and no error");
assert(JSON.stringify(agentOkResponse.data.draft) === JSON.stringify(agentDraft), "Ok response draft must match the draft example");
assert(agentErrorResponse.status === "error" && agentErrorResponse.error && agentErrorResponse.data === undefined, "Agent error envelope contract failed");
assert(errorCodeSet.has(agentErrorResponse.error.code), "Error response code must be registered");

// strategy-agent M1-M4: deterministic parsing, stub model, idempotency,
// one-time approval tokens, audit-backed case state, and the page gate.
const {executeCommand, Store} = require(path.join(root, "agent"));
const {buildDocx, buildXlsx, buildPptx} = require(path.join(root, "tests/fixtures/agent/office-fixtures.js"));
const taxonomyContract = readJson("contracts/strategy-taxonomy-2026-09.json");
const agentStoreDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "strategy-agent-test-"));
const agentStore = new Store(agentStoreDir);
const agentCaseId = "AG-TEST-001";
const fixtureDocx = buildDocx({
  paragraphs: [
    {text: "通用客群激活策略", style: "Heading1"},
    {text: "面向存量通用客群，资产区间不限资产，风险等级不设分风险等级；通过 APP触达 的 站内信 在启动日触达，以通用权益引导完成关键行为。"},
    {text: "业务场景为用户激活，策略类型为长尾客户运营策略。负责人：张三；提交人：李四；团队：数字金融总部客群经营与服务团队。"},
  ],
});
const fixtureXlsx = buildXlsx({
  sheets: [{
    name: "流程节点",
    columns: ["时间", "执行人", "对象", "状态", "动作"],
    rows: [
      ["启动日", "系统", "通用目标客群", "未触达", "多渠道触达"],
      ["启动后1日", "系统", "通用目标客群", "已触达", "点击链接"],
      ["观察期结束前", "责任执行人", "通用目标客群", "已转化", "人工跟进"],
    ],
  }],
});
const fixturePptx = buildPptx({slides: [["存量客群激活方案", "通过通用权益完成关键行为"]]});
const agentFiles = [
  {fileName: "brief.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contentBase64: fixtureDocx.toString("base64")},
  {fileName: "flow.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contentBase64: fixtureXlsx.toString("base64")},
  {fileName: "deck.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", contentBase64: fixturePptx.toString("base64")},
  {fileName: "notes.md", mimeType: "text/markdown", contentBase64: fs.readFileSync(path.join(root, "tests/fixtures/agent/notes.md")).toString("base64")},
];
const parseEnvelope = executeCommand({command: "parse-sources", requestId: "req-test-parse", input: {caseId: agentCaseId, files: agentFiles}, store: agentStore});
assert(parseEnvelope.status === "ok" && !parseEnvelope.replayed, `Agent parse failed: ${JSON.stringify(parseEnvelope.error ?? null)}`);
assert(parseEnvelope.data.manifest.files.every(file => file.parserStatus === "parsed"), "All fixture formats must parse");
const parsedCorpus = parseEnvelope.data.corpus;
assert(parsedCorpus.fragments.some(fragment => fragment.fragmentType === "heading" && fragment.text === "通用客群激活策略"), "docx heading not parsed");
assert(parsedCorpus.fragments.some(fragment => fragment.fragmentType === "sheet" && fragment.table?.name === "流程节点"), "xlsx sheet not parsed");
assert(parsedCorpus.fragments.some(fragment => fragment.fragmentType === "slide" && fragment.slide?.slideNumber === 1), "pptx slide not parsed");
assert(parsedCorpus.fragments.some(fragment => fragment.fragmentType === "paragraph" && fragment.text.includes("负责人：张三")), "markdown paragraph not parsed");
const parseReplay = executeCommand({command: "parse-sources", requestId: "req-test-parse", input: {caseId: agentCaseId, files: agentFiles}, store: agentStore});
assert(parseReplay.status === "ok" && parseReplay.replayed && parseReplay.data.corpus.corpusId === parsedCorpus.corpusId, "Agent parse idempotency failed");
const parseConflict = executeCommand({command: "parse-sources", requestId: "req-test-parse", input: {caseId: agentCaseId, files: agentFiles.slice(0, 1)}, store: agentStore});
assert(parseConflict.error?.code === "E_REQUEST_ID_CONFLICT", "Agent parse fingerprint conflict must be rejected");
const unsupportedEnvelope = executeCommand({command: "parse-sources", requestId: "req-test-unsupported", input: {caseId: "AG-TEST-002", files: [{fileName: "photo.png", mimeType: "image/png", contentBase64: Buffer.from("png").toString("base64")}]}, store: agentStore});
assert(unsupportedEnvelope.status === "ok" && unsupportedEnvelope.data.manifest.files[0].parserStatus === "unsupported" && unsupportedEnvelope.data.manifest.files[0].failureCode === "E_SOURCE_FILE_UNSUPPORTED", "Unsupported files must be recorded, not skipped");

const draftEnvelope = executeCommand({command: "generate-draft", requestId: "req-test-draft", input: {caseId: agentCaseId}, store: agentStore});
assert(draftEnvelope.status === "ok", `Agent draft generation failed: ${JSON.stringify(draftEnvelope.error ?? null)}`);
const generatedDraft = draftEnvelope.data.draft;
const selectedTaxonomy = new Map(generatedDraft.candidate.taxonomy.tagSelections.map(selection => [selection.fieldCode, selection.values.map(value => value.code)]));
for (const [fieldCode, codes] of [["lifecycle", "existing"], ["customerClass", "generic"], ["assetRange", "unlimited"], ["riskLevel", "unspecified"], ["businessScene", "user_activation"], ["strategyType", "tail_customer_operation"], ["touchScene", "app"], ["touchMethod", "in_app_message"]]) {
  assert(selectedTaxonomy.get(fieldCode)?.[0] === codes, `Stub taxonomy match failed: ${fieldCode}`);
}
assert(generatedDraft.candidate.nodes.length === 3 && generatedDraft.candidate.edges.length === 2, "Stub must build graph from flow table");
assert(generatedDraft.provenance.some(item => item.pointer === "/nodes" && item.status === "supported"), "Graph provenance missing");
const pageGateBlocked = designer.agentDraftGate(generatedDraft);
assert(!pageGateBlocked.ready && pageGateBlocked.blocked.some(item => item.pointer === "/strategy/strategyId"), "Page gate must block unresolved portal id");
assert(designer.parseAgentDraft({...generatedDraft, schemaVersion: "strategy-agent-strategy-draft/0.2"}).ok === false, "Draft parser must reject unknown versions");

const earlyApproval = executeCommand({command: "request-approval", requestId: "req-test-early-approval", input: {caseId: agentCaseId, draftId: generatedDraft.draftId, approver: "Terry"}, store: agentStore});
assert(earlyApproval.error?.code === "E_DRAFT_UNCONFIRMED_REQUIRED_FIELD", "Approval must be blocked while fields are unresolved");
const resolvedFields = [
  {target: "design", pointer: "/strategy/strategyId", value: "WB-AGENT-TEST-001"},
  {target: "metadata", pointer: "/submitDate", value: "2026-08-30"},
  {target: "metadata", pointer: "/effectiveFrom", value: "2026-08-30"},
];
const resolveEnvelope = executeCommand({command: "resolve-draft", requestId: "req-test-resolve", input: {caseId: agentCaseId, draftId: generatedDraft.draftId, resolvedFields}, store: agentStore});
assert(resolveEnvelope.status === "ok" && resolveEnvelope.data.draft.provenance.every(item => item.status === "supported"), `Human resolution failed: ${JSON.stringify(resolveEnvelope.error ?? null)}`);
const approvalEnvelope = executeCommand({command: "request-approval", requestId: "req-test-approval", input: {caseId: agentCaseId, draftId: generatedDraft.draftId, approver: "Terry"}, store: agentStore});
assert(approvalEnvelope.status === "ok" && approvalEnvelope.data.approvalToken.startsWith("at-"), `Approval failed: ${JSON.stringify(approvalEnvelope.error ?? null)}`);
const badToken = executeCommand({command: "confirm-draft", requestId: "req-test-confirm-bad", input: {caseId: agentCaseId, draftId: generatedDraft.draftId, approvalToken: "at-bad", confirmedBy: "Terry"}, store: agentStore});
assert(badToken.error?.code === "E_APPROVAL_TOKEN_INVALID", "Bad token must be rejected");
const confirmEnvelope = executeCommand({command: "confirm-draft", requestId: "req-test-confirm", input: {caseId: agentCaseId, draftId: generatedDraft.draftId, approvalToken: approvalEnvelope.data.approvalToken, confirmedBy: "Terry"}, store: agentStore});
assert(confirmEnvelope.status === "ok" && confirmEnvelope.data.draft.reviewState.status === "confirmed", `Confirm failed: ${JSON.stringify(confirmEnvelope.error ?? null)}`);
assert(confirmEnvelope.data.submissionCommand.includes("manage_case.py --json import-flow"), "Confirm must return the workbench import template");
const confirmReplay = executeCommand({command: "confirm-draft", requestId: "req-test-confirm", input: {caseId: agentCaseId, draftId: generatedDraft.draftId, approvalToken: approvalEnvelope.data.approvalToken, confirmedBy: "Terry"}, store: agentStore});
assert(confirmReplay.status === "ok" && confirmReplay.replayed, "Confirm idempotency failed");
const tokenReuse = executeCommand({command: "confirm-draft", requestId: "req-test-confirm-reuse", input: {caseId: agentCaseId, draftId: generatedDraft.draftId, approvalToken: approvalEnvelope.data.approvalToken, confirmedBy: "Terry"}, store: agentStore});
assert(tokenReuse.error?.code === "E_APPROVAL_TOKEN_REUSED", "One-time token reuse must be rejected explicitly");
const caseEnvelope = executeCommand({command: "get-case", requestId: "req-test-case", input: {caseId: agentCaseId}, store: agentStore});
assert(caseEnvelope.data.case.status === "confirmed" && caseEnvelope.data.case.nextAction === "export_and_import_flow", "Case state must be confirmed");
assert(caseEnvelope.data.audit.some(entry => entry.command === "confirm-draft" && entry.outcome === "ok"), "Audit must record confirmation");

const agentConfirmedCandidate = resolveEnvelope.data.draft.candidate;
const agentConfirmedCanonical = designer.normalizeDocument(agentConfirmedCandidate);
agentConfirmedCanonical.registrationMetadata = resolveEnvelope.data.draft.registrationMetadataCandidate;
assert(designer.validateDocument(agentConfirmedCanonical).status === "ready_to_submit", "Confirmed agent candidate unexpectedly invalid");
const agentConfirmedExport = designer.toExportDocument(agentConfirmedCanonical);
assert(!("provenance" in agentConfirmedExport) && !("evidenceCorpus" in agentConfirmedExport), "Agent envelope must not leak into 0.2 export");

const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const id of [
  "copySelectionBtn", "pasteSelectionBtn", "undoBtn", "redoBtn", "selectionBox",
  "importMetadataBtn", "copyMetadataBtn", "downloadMetadataBtn", "metadataOutput",
  "moreActionsBtn", "openExportDrawerBtn", "exportDrawer", "exportCliTemplate",
  "readinessSummary", "jsonCodePane", "metadataCodePane", "mermaidCodePane",
  "paradigmStatus", "registrationDrawer", "registrationDrawerContent", "openRegistrationDrawerBtn",
  "openAgentDrawerBtn", "agentDrawer", "agentLoadDraftBtn", "agentLoadCorpusBtn",
  "agentImportCandidateBtn", "agentProvenanceList", "agentQuestionList", "agentEvidenceView",
]) {
  assert(indexHtml.includes(`id="${id}"`), `Missing interaction element: ${id}`);
}
assert(indexHtml.includes("strategy-taxonomy-2026-09.js"), "Designer page must load the taxonomy contract");
assert(!indexHtml.includes("paradigm-icon"), "Paradigm icon decoration must stay removed");
assert(!indexHtml.includes("objectView"), "Current-object editing must stay in the right high-frequency panel");
assert(indexHtml.includes("openRegistrationDrawerBtn"), "Registration configuration must be reachable from the top bar");
for (const handle of ["left", "right", "bottom"]) {
  assert(indexHtml.includes(`data-panel-resizer="${handle}"`), `Missing resizable panel handle: ${handle}`);
}

console.log("strategy-flow-input package checks passed.");
