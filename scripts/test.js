"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {isDeepStrictEqual} = require("node:util");
const {spawnSync} = require("node:child_process");

const root = path.resolve(__dirname, "..");
const required = [
  "app.js",
  "bin/strategy-flow-input.js",
  "contracts/strategy-flow-input-0.2.schema.json",
  "contracts/strategy-flow-input-0.3.schema.json",
  "contracts/strategy-flow-input-0.4.schema.json",
  "contracts/strategy-flow-input-0.5.schema.json",
  "contracts/strategy-flow-registration-metadata-2.0.schema.json",
  "contracts/strategy-taxonomy-2026-09.json",
  "contracts/strategy-taxonomy-2026-09.js",
  "contracts/strategy-agent-response-0.1.schema.json",
  "contracts/strategy-agent-source-manifest-0.1.schema.json",
  "contracts/strategy-agent-evidence-corpus-0.1.schema.json",
  "contracts/strategy-agent-strategy-draft-0.1.schema.json",
  "contracts/strategy-agent-errors-0.1.json",
  "examples/contracts/strategy-flow-input-0.2.json",
  "examples/contracts/strategy-flow-input-0.3.json",
  "examples/contracts/strategy-flow-input-0.4.json",
  "examples/contracts/strategy-flow-input-0.5.json",
  "examples/contracts/strategy-flow-registration-metadata-2.0.json",
  "examples/contracts/agent/source-manifest.example.json",
  "examples/contracts/agent/evidence-corpus.example.json",
  "examples/contracts/agent/strategy-draft.example.json",
  "examples/contracts/agent/response-generate-draft-ok.example.json",
  "examples/contracts/agent/response-confirm-draft-error.example.json",
  "index.html",
  "package.json",
  "skills/strategy-flow-agent/SKILL.md",
  "skills/strategy-flow-agent/agents/openai.yaml",
  "skills/strategy-flow-agent/references/workbench-protocol.md",
  "skills/strategy-flow-agent/references/material-decomposition.md",
  "skills/strategy-flow-agent/references/human-collaboration.md",
  "schema/strategy-flow-input.schema.json",
  "schema/strategy-flow-input-0.2.schema.json",
  "styles.css",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

const clone = value => JSON.parse(JSON.stringify(value));

for (const relativePath of required) {
  assert(fs.existsSync(path.join(root, relativePath)), `Missing required file: ${relativePath}`);
}

const packageJson = readJson("package.json");
assert(packageJson.name === "strategy-flow-input", "Unexpected package name");
assert(packageJson.version === "1.5.0", "Package version must be 1.5.0");
assert(packageJson.files.includes("contracts"), "Package must include authority contracts");
assert(packageJson.bin?.["strategy-flow-input"] === "./bin/strategy-flow-input.js", "Missing CLI bin entry");

const skillEntry = fs.readFileSync(path.join(root, "skills/strategy-flow-agent/SKILL.md"), "utf8");
const skillFrontmatter = skillEntry.match(/^---\n([\s\S]*?)\n---\n/);
assert(skillFrontmatter, "Agent skill frontmatter is missing");
assert(/^name: strategy-flow-agent$/m.test(skillFrontmatter[1]), "Agent skill name is invalid");
assert(/^description: .+\S$/m.test(skillFrontmatter[1]), "Agent skill description is missing");
for (const reference of [
  "references/workbench-protocol.md",
  "references/material-decomposition.md",
  "references/human-collaboration.md",
]) {
  assert(skillEntry.includes(reference), `Agent skill reference is not linked: ${reference}`);
}
const openAiSkillPolicy = fs.readFileSync(path.join(root, "skills/strategy-flow-agent/agents/openai.yaml"), "utf8");
assert(openAiSkillPolicy.includes("allow_implicit_invocation: true"), "Agent skill must allow implicit invocation");
const skillDocumentation = {
  entry: fs.readFileSync(path.join(root, "skills/strategy-flow-agent/SKILL.md"), "utf8"),
  material: fs.readFileSync(path.join(root, "skills/strategy-flow-agent/references/material-decomposition.md"), "utf8"),
  human: fs.readFileSync(path.join(root, "skills/strategy-flow-agent/references/human-collaboration.md"), "utf8"),
  workbench: fs.readFileSync(path.join(root, "skills/strategy-flow-agent/references/workbench-protocol.md"), "utf8"),
};
for (const [text, phrase] of [
  [skillDocumentation.entry, "对象分类使用 Design 0.5 的 `classification` 卡片表达"],
  [skillDocumentation.material, "显式信号"],
  [skillDocumentation.material, "弱信号"],
  [skillDocumentation.material, "当前离线 stub 生成 Design 0.5，但不会自动生成 `classification`"],
  [skillDocumentation.human, "对象分类确认"],
  [skillDocumentation.entry, "不向业务人员询问本地工作区 `caseId`"],
  [skillDocumentation.workbench, "CLASSIFICATION_PROCESS_ACTION_REQUIRED"],
  [skillDocumentation.workbench, "新建策略导出时省略 `registrationCaseId` 与 `strategyId`"],
  [skillDocumentation.workbench, "0.2 candidate 导入编辑器后仍保持原有 `process`"],
]) {
  assert(text.includes(phrase), `Agent skill must document object classification guidance: ${phrase}`);
}
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
assert(readme.includes("[`skills/strategy-flow-agent/SKILL.md`](skills/strategy-flow-agent/SKILL.md)"), "README must link the agent skill");
for (const relativePath of required.filter(item => item.startsWith("skills/"))) {
  assert(!/\b(TODO|FIXME|PLACEHOLDER)\b/.test(fs.readFileSync(path.join(root, relativePath), "utf8")), `Agent skill contains unfinished marker: ${relativePath}`);
}

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
  "contracts/strategy-flow-input-0.3.schema.json",
  "contracts/strategy-flow-input-0.4.schema.json",
  "contracts/strategy-flow-input-0.5.schema.json",
  "contracts/strategy-flow-registration-metadata-2.0.schema.json",
  "contracts/strategy-taxonomy-2026-09.schema.json",
  "contracts/strategy-taxonomy-2026-09.json",
  "examples/contracts/strategy-flow-input-0.2.json",
  "examples/contracts/strategy-flow-input-0.3.json",
  "examples/contracts/strategy-flow-input-0.4.json",
  "examples/contracts/strategy-flow-input-0.5.json",
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
  "schema/strategy-flow-input-0.2.schema.json",
  "schema/strategy-flow-input-0.1.schema.json",
]) {
  readJson(relativePath);
}
assert(
  isDeepStrictEqual(
    readJson("schema/strategy-flow-input.schema.json"),
    readJson("contracts/strategy-flow-input-0.5.schema.json"),
  ),
  "Current schema and authority 0.5 contract must stay identical",
);

const designer = require(path.join(root, "app.js"));
assert(designer.SUPPORTED_SCHEMA_VERSIONS.join(",") === "strategy-flow-input/0.1,strategy-flow-input/0.2,strategy-flow-input/0.3,strategy-flow-input/0.4,strategy-flow-input/0.5", "Version registry contract failed");
assert(designer.parseSchemaVersion("strategy-flow-input/0.2").key === "0.2", "Valid version was not parsed");
assert(designer.parseSchemaVersion("strategy-flow-input/0.3").key === "0.3", "Valid 0.3 version was not parsed");
assert(designer.parseSchemaVersion("strategy-flow-input/0.4").key === "0.4", "Valid 0.4 version was not parsed");
assert(designer.parseSchemaVersion("strategy-flow-input/0.5").key === "0.5", "Valid 0.5 version was not parsed");
assert(designer.parseSchemaVersion("strategy-flow-input/v0.2").valid === false, "Invalid version suffix must fail");
assert(designer.parseSchemaVersion("other-flow/0.2").valid === false, "Invalid version namespace must fail");

const externalDesign = readJson("examples/contracts/strategy-flow-input-0.2.json");
const metadata = readJson("examples/contracts/strategy-flow-registration-metadata-2.0.json");
const canonical = designer.normalizeDocument(externalDesign);
canonical.registrationMetadata = metadata;
const validResult = designer.validateDocument(canonical);
assert(validResult.status === "ready_to_submit", `Authority example unexpectedly invalid: ${JSON.stringify(validResult)}`);

const exported = designer.toExportDocument(canonical);
assert(exported.schemaVersion === "strategy-flow-input/0.5", "Designer must export 0.5");
assert(exported.validation.status === "ready_to_submit", "Exported authority example must remain valid");
assert(!("registrationMetadata" in exported), "Companion metadata must not leak into design JSON");
assert(designer.validateRegistrationMetadata(metadata).status === "ready_to_submit", "Metadata authority example unexpectedly invalid");
assert(designer.toRegistrationMetadataDocument(canonical).schemaVersion === "strategy-flow-registration-metadata/2.0", "Metadata export version failed");

const roundTripped = designer.normalizeDocument(exported);
for (const key of ["strategy", "nodes", "edges", "strategyActions", "processActions"]) {
  assert(JSON.stringify(roundTripped[key]) === JSON.stringify(canonical[key]), `0.2 -> 0.5 round-trip changed ${key}`);
}
assert(JSON.stringify(roundTripped.taxonomy.selections) === JSON.stringify(canonical.taxonomy.selections), "0.2 -> 0.5 taxonomy round-trip failed");
assert(roundTripped.taxonomy.strategySubtype === canonical.taxonomy.strategySubtype, "0.2 -> 0.5 free-text round-trip failed");

const classificationDesign = readJson("examples/contracts/strategy-flow-input-0.5.json");
const classificationCanonical = designer.normalizeDocument(classificationDesign);
classificationCanonical.registrationMetadata = metadata;
const classificationResult = designer.validateDocument(classificationCanonical);
assert(classificationResult.status === "ready_to_submit", `Classification example unexpectedly invalid: ${JSON.stringify(classificationResult)}`);
assert(classificationResult.errors.length === 0 && classificationResult.warnings.length === 0, "Classification example must be a clean 0.5 contract sample");
const classificationExport = designer.toExportDocument(classificationCanonical);
assert(classificationExport.schemaVersion === "strategy-flow-input/0.5", "Classification example must export 0.5");
assert(classificationExport.nodes[0].nodeType === "classification", "Classification example must use the classification node type");
assert(!("strategyId" in classificationExport.strategy), "New 0.5 strategy must omit board-assigned strategyId");
assert(!("registrationCaseId" in classificationExport.strategy), "New 0.5 strategy must omit board-assigned registration case id");
const classificationRoundTrip = designer.normalizeDocument(classificationExport);
for (const key of ["strategy", "nodes", "edges", "strategyActions", "processActions"]) {
  assert(JSON.stringify(classificationRoundTrip[key]) === JSON.stringify(classificationCanonical[key]), `0.5 classification round-trip changed ${key}`);
}
const assertTouchError = (variant, code) => {
  const result = designer.validateDocument(variant);
  assert(result.errors.some(error => error.code === code), `Expected touch validation error ${code}: ${JSON.stringify(result.errors)}`);
};
const touchVariant = () => clone(classificationCanonical);
const noScene = touchVariant();
noScene.strategyActions[0].touchScenes = [];
assertTouchError(noScene, "ACTION_TOUCH_SCENE_REQUIRED");
const noMethod = touchVariant();
noMethod.strategyActions[0].touchMethods = [];
assertTouchError(noMethod, "ACTION_TOUCH_METHOD_REQUIRED");
assertTouchError(noMethod, "ACTION_TOUCH_CHILD_REQUIRED");
const unknownTouchCode = touchVariant();
unknownTouchCode.strategyActions[0].touchScenes[0].code = "unknown_touch_scene";
assertTouchError(unknownTouchCode, "ACTION_TOUCH_CODE_INVALID");
const mismatchedTouchParent = touchVariant();
mismatchedTouchParent.strategyActions[0].touchMethods[0].parentCode = "sms";
assertTouchError(mismatchedTouchParent, "ACTION_TOUCH_PARENT_MISMATCH");
const outOfScopeTouch = touchVariant();
outOfScopeTouch.taxonomy.selections.touchScene = outOfScopeTouch.taxonomy.selections.touchScene.filter(item => item.code !== "wecom");
outOfScopeTouch.taxonomy.selections.touchMethod = outOfScopeTouch.taxonomy.selections.touchMethod.filter(item => item.code !== "wecom_private_chat");
assertTouchError(outOfScopeTouch, "ACTION_TOUCH_TAXONOMY_SCOPE_MISMATCH");
const duplicateTouch = touchVariant();
duplicateTouch.strategyActions[0].touchScenes.push(clone(duplicateTouch.strategyActions[0].touchScenes[0]));
duplicateTouch.strategyActions[0].touchMethods.push(clone(duplicateTouch.strategyActions[0].touchMethods[0]));
assertTouchError(duplicateTouch, "ACTION_TOUCH_DUPLICATE");

const legacy04 = readJson("examples/contracts/strategy-flow-input-0.4.json");
const legacy04Unmatched = designer.normalizeDocument(legacy04);
assert(legacy04Unmatched.strategyActions.every(action => action.touchScenes.length === 0 && action.touchMethods.length === 0), "Unmatched 0.4 touch text must migrate to empty selections");
assert(designer.validateDocument(legacy04Unmatched).warnings.some(error => error.code === "MIGRATION_TOUCH_FIELD_DISCARDED" && error.path === "strategyActions[0].touchScene"), "Unmatched 0.4 touch scene must warn");
assert(designer.validateDocument(legacy04Unmatched).warnings.some(error => error.code === "MIGRATION_TOUCH_FIELD_DISCARDED" && error.path === "strategyActions[0].touchMethod"), "Unmatched 0.4 touch method must warn");
const legacy04Mapped = clone(legacy04);
legacy04Mapped.strategyActions[0].touchScene = "APP触达";
legacy04Mapped.strategyActions[0].touchMethod = "站内信";
const legacy04MappedCanonical = designer.normalizeDocument(legacy04Mapped);
legacy04MappedCanonical.registrationMetadata = metadata;
assert(
  JSON.stringify(legacy04MappedCanonical.strategyActions[0].touchScenes) === JSON.stringify([{code: "app"}]),
  "Exact 0.4 touch scene label must migrate to taxonomy code",
);
assert(
  JSON.stringify(legacy04MappedCanonical.strategyActions[0].touchMethods) === JSON.stringify([{code: "in_app_message", parentCode: "app"}]),
  "Exact 0.4 touch method label must migrate to taxonomy code",
);
assert(
  !designer.validateDocument(legacy04MappedCanonical).warnings.some(error => error.code === "MIGRATION_TOUCH_FIELD_DISCARDED"),
  "Exact 0.4 touch labels must not produce a discard warning",
);
const legacy04MethodMismatch = clone(legacy04);
legacy04MethodMismatch.strategyActions[0].touchScene = "短信触达";
legacy04MethodMismatch.strategyActions[0].touchMethod = "站内信";
const legacy04MethodMismatchCanonical = designer.normalizeDocument(legacy04MethodMismatch);
assert(legacy04MethodMismatchCanonical.strategyActions[0].touchMethods.length === 0, "A method outside the legacy scene must be discarded");
assert(designer.validateDocument(legacy04MethodMismatchCanonical).warnings.some(error => error.code === "MIGRATION_TOUCH_FIELD_DISCARDED" && error.path === "strategyActions[0].touchMethod"), "Method outside legacy scene must warn");
const legacy03 = readJson("examples/contracts/strategy-flow-input-0.3.json");
const legacyConflict = clone(legacy03);
legacyConflict.strategyActions[0].time = "冲突时间";
legacyConflict.processActions[0].executor = "冲突执行人";
legacyConflict.processActions[0].recipient = "冲突接收对象";
const legacyConflictCanonical = designer.normalizeDocument(legacyConflict);
assert(legacyConflictCanonical.nodes.every(node => !("displayName" in node)), "0.3 displayName must be discarded during 0.4 migration");
assert(legacyConflictCanonical.strategyActions.every(action => !("time" in action || "subjectState" in action)), "0.3 strategy derived fields must be discarded during 0.4 migration");
assert(legacyConflictCanonical.processActions.every(action => !("executor" in action || "recipient" in action)), "0.3 process derived fields must be discarded during 0.4 migration");
const legacyConflictResult = designer.validateDocument(legacyConflictCanonical);
assert(legacyConflictResult.warnings.some(error => error.code === "MIGRATION_DERIVED_FIELD_DISCARDED" && error.path === "strategyActions[0].time"), "Strategy derived-field conflict must warn");
assert(legacyConflictResult.warnings.some(error => error.code === "MIGRATION_DERIVED_FIELD_DISCARDED" && error.path === "processActions[0].executor"), "Process executor conflict must warn");
assert(legacyConflictResult.warnings.some(error => error.code === "MIGRATION_DERIVED_FIELD_DISCARDED" && error.path === "processActions[0].recipient"), "Process recipient conflict must warn");
const invalid04DerivedFields = clone(classificationDesign);
invalid04DerivedFields.nodes[0].displayName = "非法展示名";
invalid04DerivedFields.strategyActions[0].time = "非法动作时间";
invalid04DerivedFields.strategyActions[0].touchScene = "非法动作触达场景";
invalid04DerivedFields.processActions[0].executor = "非法动作执行人";
const invalid04DerivedResult = designer.validateDocument(invalid04DerivedFields);
assert(invalid04DerivedResult.errors.some(error => error.code === "SCHEMA_UNKNOWN_FIELD" && error.path === "nodes[0].displayName"), "0.4 must reject displayName");
assert(invalid04DerivedResult.errors.some(error => error.code === "SCHEMA_UNKNOWN_FIELD" && error.path === "strategyActions[0].time"), "0.4 must reject action-owned time");
assert(invalid04DerivedResult.errors.some(error => error.code === "SCHEMA_UNKNOWN_FIELD" && error.path === "strategyActions[0].touchScene"), "0.5 must reject singular legacy touch fields");
assert(invalid04DerivedResult.errors.some(error => error.code === "SCHEMA_UNKNOWN_FIELD" && error.path === "processActions[0].executor"), "0.4 must reject action-owned executor");
const invalidTouchReferences = clone(classificationDesign);
invalidTouchReferences.strategyActions[0].touchScenes[0].label = "非法 label";
invalidTouchReferences.strategyActions[0].touchMethods[0].extra = "非法字段";
assert(
  designer.validateDocument(invalidTouchReferences).errors.some(error => error.code === "SCHEMA_UNKNOWN_FIELD" && error.path === "strategyActions[0].touchScenes[0].label"),
  "0.5 touch scene references must not carry labels",
);
assert(
  designer.validateDocument(invalidTouchReferences).errors.some(error => error.code === "SCHEMA_UNKNOWN_FIELD" && error.path === "strategyActions[0].touchMethods[0].extra"),
  "0.5 touch method references must reject unknown fields",
);
for (const subjectType of ["customer", "scene", "event", "activity"]) {
  const variant = JSON.parse(JSON.stringify(classificationCanonical));
  variant.nodes[0].subject.type = subjectType;
  assert(designer.validateDocument(variant).status === "ready_to_submit", `Classification must support subject type ${subjectType}`);
}

const missingProcessAction = clone(classificationCanonical);
missingProcessAction.processActions = missingProcessAction.processActions.filter(action => action.nodeId !== "n0");
assert(designer.validateDocument(missingProcessAction).errors.some(error => error.code === "CLASSIFICATION_PROCESS_ACTION_REQUIRED"), "Classification without process action must be blocked");
const withStrategyAction = clone(classificationCanonical);
withStrategyAction.strategyActions.push({...clone(withStrategyAction.strategyActions[0]), localId: "sa-classification", nodeId: "n0", outgoingEdgeId: "e0"});
assert(designer.validateDocument(withStrategyAction).errors.some(error => error.code === "CLASSIFICATION_STRATEGY_ACTION_FORBIDDEN"), "Classification with strategy action must be blocked");
const noOutgoingEdge = clone(classificationCanonical);
noOutgoingEdge.edges = noOutgoingEdge.edges.filter(edge => edge.from !== "n0");
assert(designer.validateDocument(noOutgoingEdge).errors.some(error => error.code === "CLASSIFICATION_OUTGOING_EDGE_REQUIRED"), "Classification without outgoing edge must be blocked");
const invalidSubjectBehavior = clone(classificationCanonical);
invalidSubjectBehavior.edges.find(edge => edge.localId === "e0").subjectBehavior = {
  time: "策略启动前", action: "点击链接", status: "happened",
};
assert(designer.validateDocument(invalidSubjectBehavior).errors.some(error => error.code === "CLASSIFICATION_SUBJECT_BEHAVIOR_INVALID"), "Classification must not require subject behavior");

const classificationIn02 = clone(externalDesign);
classificationIn02.nodes[0].nodeType = "classification";
assert(designer.validateDocument(classificationIn02).errors.some(error => error.code === "ENUM_INVALID" && error.path === "nodes[0].nodeType"), "classification must not be accepted by the 0.2 contract");
const processPattern = clone(externalDesign);
processPattern.nodes.find(node => node.nodeType === "process").displayName = "客群分类（前置准备）";
const processPatternCanonical = designer.normalizeDocument(processPattern);
assert(processPatternCanonical.nodes.every(node => !("displayName" in node)), "0.4 canonical nodes must not store displayName");
assert(designer.validateDocument(processPatternCanonical).warnings.some(error => error.code === "SCHEMA_MIGRATED"), "0.2 import must expose migration");
assert(designer.validateDocument(processPatternCanonical).warnings.some(error => error.code === "MIGRATION_DISPLAY_NAME_DISCARDED"), "Discarded 0.2 displayName must be visible");
const boardIdClassification = clone(classificationCanonical);
boardIdClassification.strategy.registrationCaseId = "CASE-BOARD-ASSIGNED-001";
boardIdClassification.strategy.strategyId = "WB-BOARD-ASSIGNED-001";
const boardIdExport = designer.toExportDocument(boardIdClassification);
assert(boardIdExport.strategy.registrationCaseId === "CASE-BOARD-ASSIGNED-001", "Existing submission must retain its board-assigned case id");
assert(boardIdExport.strategy.strategyId === "WB-BOARD-ASSIGNED-001", "Existing strategy must retain its board-assigned id");
assert(designer.normalizeDocument(boardIdExport).strategy.registrationCaseId === "CASE-BOARD-ASSIGNED-001", "Board-assigned case id must round-trip");
assert(designer.normalizeDocument(boardIdExport).strategy.strategyId === "WB-BOARD-ASSIGNED-001", "Board-assigned id must round-trip");
const invalidLocalId = clone(classificationCanonical);
invalidLocalId.strategy.strategyId = "AG-LOCAL-001";
assert(designer.validateDocument(invalidLocalId).errors.some(error => error.code === "STRATEGY_ID_INVALID"), "Agent workspace id must never be used as strategyId");
const invalidLocalRegistrationCase = clone(classificationCanonical);
invalidLocalRegistrationCase.strategy.registrationCaseId = "AG-LOCAL-001";
assert(designer.validateDocument(invalidLocalRegistrationCase).errors.some(error => error.code === "REGISTRATION_CASE_ID_INVALID"), "Agent workspace id must never be used as registrationCaseId");
const sameBoardIds = clone(boardIdClassification);
sameBoardIds.strategy.registrationCaseId = sameBoardIds.strategy.strategyId;
assert(designer.validateDocument(sameBoardIds).errors.some(error => error.code === "REGISTRATION_CASE_ID_INVALID"), "Registration case id and strategy id must remain distinct");
const empty03Id = clone(classificationDesign);
empty03Id.strategy.strategyId = "";
assert(designer.validateDocument(empty03Id).errors.some(error => error.code === "STRATEGY_ID_INVALID"), "0.3 must reject an explicitly empty strategyId");
const empty03RegistrationCase = clone(classificationDesign);
empty03RegistrationCase.strategy.registrationCaseId = "";
assert(designer.validateDocument(empty03RegistrationCase).errors.some(error => error.code === "REGISTRATION_CASE_ID_INVALID"), "0.3 must reject an explicitly empty registrationCaseId");
const missing02Id = clone(externalDesign);
delete missing02Id.strategy.strategyId;
assert(designer.validateDocument(missing02Id).errors.some(error => error.code === "STRATEGY_FIELD_REQUIRED" && error.path === "strategy.strategyId"), "0.2 must still require strategyId");
const registrationCaseIn02 = clone(externalDesign);
registrationCaseIn02.strategy.registrationCaseId = "CASE-BOARD-ASSIGNED-001";
assert(designer.validateDocument(registrationCaseIn02).errors.some(error => error.code === "SCHEMA_UNKNOWN_FIELD" && error.path === "strategy.registrationCaseId"), "0.2 must not accept registrationCaseId");
const editable02NewStrategy = designer.normalizeDocument(missing02Id);
editable02NewStrategy.registrationMetadata = metadata;
assert(designer.validateDocument(editable02NewStrategy).status === "ready_to_submit", "An imported 0.2 draft with an empty id must be editable as a new 0.4 strategy");
assert(!("strategyId" in designer.toExportDocument(editable02NewStrategy).strategy), "An imported 0.2 draft with an empty id must export as a new 0.4 strategy");

const unsupported = designer.validateDocument({...externalDesign, schemaVersion: "strategy-flow-input/0.6"});
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

// strategy-agent/0.1 M0 contracts: shape, referential integrity, provenance
// review semantics, and the no-fabrication path from editable draft to design export.
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
assert(agentDraft.candidate.schemaVersion === "strategy-flow-input/0.5", "Draft candidate must use 0.5 create semantics");
assert(!("strategyId" in agentDraft.candidate.strategy), "New agent draft must omit strategyId");
assert(!("registrationCaseId" in agentDraft.candidate.strategy), "New agent draft must omit registrationCaseId");
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
assert(!draftValidation.errors.some(error => error.path === "strategy.strategyId"), "New strategy draft must not require a board id");
assert(designer.validateRegistrationMetadata(agentDraft.registrationMetadataCandidate).status === "ready_to_submit", "Draft metadata candidate unexpectedly invalid");

// A board-returned id turns the same draft into an update candidate; the
// normalize/validate/export round-trip must not introduce agent extensions.
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
assert(!("provenance" in confirmedExport) && !("evidenceCorpus" in confirmedExport), "Agent envelope must not leak into 0.4 export");

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
const autoParseEnvelope = executeCommand({command: "parse-sources", requestId: "req-test-auto-parse", input: {files: agentFiles}, store: agentStore});
assert(autoParseEnvelope.status === "ok" && /^AG-w[A-Za-z0-9_-]+$/.test(autoParseEnvelope.data.caseId), `Auto workspace id failed: ${JSON.stringify(autoParseEnvelope.error ?? null)}`);
const autoParseReplay = executeCommand({command: "parse-sources", requestId: "req-test-auto-parse", input: {files: agentFiles}, store: agentStore});
assert(autoParseReplay.replayed && autoParseReplay.data.caseId === autoParseEnvelope.data.caseId, "Auto workspace id must be stable across request replay");
const autoDraftEnvelope = executeCommand({command: "generate-draft", requestId: "req-test-auto-draft", input: {caseId: autoParseEnvelope.data.caseId}, store: agentStore});
assert(autoDraftEnvelope.status === "ok", `Generated draft must accept the auto workspace id: ${JSON.stringify(autoDraftEnvelope.error ?? null)}`);
const invalidWorkspaceEnvelope = executeCommand({command: "parse-sources", requestId: "req-test-invalid-workspace", input: {caseId: "WB-INVALID", files: agentFiles.slice(0, 1)}, store: agentStore});
assert(invalidWorkspaceEnvelope.error?.code === "E_INPUT_INVALID", "Explicit invalid workspace ids must be rejected");
const missingWorkspaceDraft = executeCommand({command: "generate-draft", requestId: "req-test-missing-workspace", input: {}, store: agentStore});
assert(missingWorkspaceDraft.error?.code === "E_INPUT_INVALID", "Non-parse commands must still require a workspace id");
const parseEnvelope = executeCommand({command: "parse-sources", requestId: "req-test-parse", input: {caseId: agentCaseId, files: agentFiles}, store: agentStore});
assert(parseEnvelope.status === "ok" && !parseEnvelope.replayed, `Agent parse failed: ${JSON.stringify(parseEnvelope.error ?? null)}`);
assert(parseEnvelope.data.caseId === agentCaseId, "Explicit workspace id must be echoed in parse response");
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
assert(generatedDraft.candidate.schemaVersion === "strategy-flow-input/0.5", "Offline stub must generate Design 0.5");
assert(generatedDraft.candidate.nodes.every(node => !("displayName" in node)), "Offline stub must omit removed displayName");
const selectedTaxonomy = new Map(generatedDraft.candidate.taxonomy.tagSelections.map(selection => [selection.fieldCode, selection.values.map(value => value.code)]));
for (const [fieldCode, codes] of [["lifecycle", "existing"], ["customerClass", "generic"], ["assetRange", "unlimited"], ["riskLevel", "unspecified"], ["businessScene", "user_activation"], ["strategyType", "tail_customer_operation"], ["touchScene", "app"], ["touchMethod", "in_app_message"]]) {
  assert(selectedTaxonomy.get(fieldCode)?.[0] === codes, `Stub taxonomy match failed: ${fieldCode}`);
}
assert(generatedDraft.candidate.nodes.length === 3 && generatedDraft.candidate.edges.length === 2, "Stub must build graph from flow table");
assert(generatedDraft.provenance.some(item => item.pointer === "/nodes" && item.status === "supported"), "Graph provenance missing");
const pageGate = designer.agentDraftGate(generatedDraft);
assert(pageGate.ready && pageGate.blocked.length === 0, "Draft layer must allow incomplete candidates into the editor");
assert(pageGate.warnings.some(item => item.reason === "open_question"), "Draft layer must preserve openQuestions as todos");
const outputGate = designer.outputContractGate({
  ...generatedDraft.candidate,
  registrationMetadata: generatedDraft.registrationMetadataCandidate,
});
assert(!outputGate.ready && !outputGate.blocking.some(item => item.path === "strategy.strategyId"), "Missing strategyId must not block a new 0.4 strategy");
const schemaCleanDraft = JSON.parse(JSON.stringify(generatedDraft));
schemaCleanDraft.registrationMetadataCandidate.submitDate = "2026-08-30";
schemaCleanDraft.registrationMetadataCandidate.effectiveFrom = "2026-08-30";
const schemaCleanGate = designer.outputContractGate({
  ...schemaCleanDraft.candidate,
  registrationMetadata: schemaCleanDraft.registrationMetadataCandidate,
});
assert(schemaCleanGate.ready, `Schema-clean candidate must pass the light export gate: ${JSON.stringify(schemaCleanGate.blocking)}`);
const schemaCleanExport = designer.toExportDocument({
  ...schemaCleanDraft.candidate,
  registrationMetadata: schemaCleanDraft.registrationMetadataCandidate,
});
assert(!("strategyId" in schemaCleanExport.strategy), "New agent strategy export must omit strategyId");
const danglingEdgeDraft = JSON.parse(JSON.stringify(schemaCleanDraft));
danglingEdgeDraft.candidate.edges[0].to = "node-does-not-exist";
const danglingEdgeGate = designer.outputContractGate({
  ...danglingEdgeDraft.candidate,
  registrationMetadata: danglingEdgeDraft.registrationMetadataCandidate,
});
assert(!danglingEdgeGate.ready && danglingEdgeGate.blocking.some(item => item.code === "EDGE_ENDPOINT_MISSING"), "Export gate must block dangling edge references");
const unknownTagDraft = JSON.parse(JSON.stringify(schemaCleanDraft));
unknownTagDraft.candidate.taxonomy.tagSelections[0].values[0].code = "custom_unknown_code";
const unknownTagGate = designer.outputContractGate({
  ...unknownTagDraft.candidate,
  registrationMetadata: unknownTagDraft.registrationMetadataCandidate,
});
assert(unknownTagGate.ready && unknownTagGate.warnings.some(item => item.code === "TAG_CODE_INVALID"), "Unknown taxonomy code should remain a review warning, not a schema hard gate");
const draftWith03Candidate = JSON.parse(JSON.stringify(generatedDraft));
assert(designer.parseAgentDraft(draftWith03Candidate).ok, "Draft parser must accept Design 0.3 candidates");
const {validateDraft} = require(path.join(root, "agent/validate"));
assert(validateDraft(draftWith03Candidate, parsedCorpus).valid, "Agent cross-file validator must accept Design 0.3 candidates");
assert(designer.parseAgentDraft({...generatedDraft, schemaVersion: "strategy-agent-strategy-draft/0.2"}).ok === false, "Draft parser must reject unknown versions");

const earlyApproval = executeCommand({command: "request-approval", requestId: "req-test-early-approval", input: {caseId: agentCaseId, draftId: generatedDraft.draftId, approver: "Terry"}, store: agentStore});
assert(earlyApproval.error?.code === "E_DRAFT_UNCONFIRMED_REQUIRED_FIELD", "Approval must be blocked while fields are unresolved");

// Evidence conflict is review material, not an audit-path gate. Once the output
// contract is schema/reference-clean, token issue and confirmation must succeed.
const auditDraft = JSON.parse(JSON.stringify(generatedDraft));
auditDraft.draftId = "sd-light-hitl-001";
auditDraft.candidate.strategy.strategyId = "WB-AGENT-LIGHT-001";
auditDraft.registrationMetadataCandidate.submitDate = "2026-08-30";
auditDraft.registrationMetadataCandidate.effectiveFrom = "2026-08-30";
auditDraft.provenance = auditDraft.provenance
  .filter(item => ![
    "design:/strategy/strategyId",
    "metadata:/submitDate",
    "metadata:/effectiveFrom",
  ].includes(`${item.target ?? "design"}:${item.pointer}`))
  .map(item => item.pointer === "/strategy/strategyName" ? {
  target: "design",
  pointer: "/strategy/strategyName",
  status: "conflict",
  evidenceRefs: [parsedCorpus.fragments[0].evidenceId, parsedCorpus.fragments[1].evidenceId],
  confidence: 0.7,
  note: "轻量工作流测试：冲突保留给人工裁决。",
} : item);
auditDraft.openQuestions.push({
  questionId: "q-light-conflict",
  target: "design",
  pointer: "/strategy/strategyName",
  question: "轻量工作流测试：openQuestion 不阻断可选审计路径。",
  evidenceRefs: [parsedCorpus.fragments[0].evidenceId],
});
agentStore.writeDraft(agentCaseId, auditDraft);
const conflictApproval = executeCommand({command: "request-approval", requestId: "req-test-light-approval", input: {caseId: agentCaseId, draftId: auditDraft.draftId, approver: "Terry"}, store: agentStore});
assert(conflictApproval.status === "ok", `Conflict/openQuestion must not block audit approval: ${JSON.stringify(conflictApproval.error ?? null)}`);
const conflictConfirm = executeCommand({command: "confirm-draft", requestId: "req-test-light-confirm", input: {caseId: agentCaseId, draftId: auditDraft.draftId, approvalToken: conflictApproval.data.approvalToken, confirmedBy: "Terry"}, store: agentStore});
assert(conflictConfirm.status === "ok" && conflictConfirm.data.draft.reviewState.status === "confirmed", `Conflict/openQuestion must not block audit confirmation: ${JSON.stringify(conflictConfirm.error ?? null)}`);
const resolvedFields = [
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
assert(!confirmEnvelope.data.submissionCommand.includes("--case "), "New strategy import template must not pretend to know a board case id");
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
assert(!("provenance" in agentConfirmedExport) && !("evidenceCorpus" in agentConfirmedExport), "Agent envelope must not leak into design export");

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
