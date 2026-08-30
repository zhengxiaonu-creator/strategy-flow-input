"use strict";

// Chrome E2E for the Agent draft review drawer. Requires Playwright, e.g.:
//   NODE_PATH=<workspace node_modules> node tests/e2e/run-agent-drawer-e2e.js

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {chromium} = require("playwright");

const root = path.resolve(__dirname, "../..");
const {executeCommand, Store} = require(path.join(root, "agent"));
const {buildDocx, buildXlsx, buildPptx} = require(path.join(root, "tests/fixtures/agent/office-fixtures.js"));

(async () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "strategy-agent-e2e-"));
  const store = new Store(path.join(workDir, "store"));
  const files = [
    {fileName: "brief.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", contentBase64: buildDocx({paragraphs: [
      {text: "通用客群激活策略", style: "Heading1"},
      {text: "面向存量通用客群，资产区间不限资产，风险等级不设分风险等级；通过 APP触达 的 站内信 在启动日触达，以通用权益引导完成关键行为。"},
      {text: "业务场景为用户激活，策略类型为长尾客户运营策略。负责人：张三；提交人：李四；团队：数字金融总部客群经营与服务团队。"},
    ]}).toString("base64")},
    {fileName: "flow.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", contentBase64: buildXlsx({sheets: [{
      name: "流程节点",
      columns: ["时间", "执行人", "对象", "状态", "动作"],
      rows: [["启动日", "系统", "通用目标客群", "未触达", "多渠道触达"], ["观察期结束前", "责任执行人", "通用目标客群", "已转化", "人工跟进"]],
    }]}).toString("base64")},
    {fileName: "deck.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", contentBase64: buildPptx({slides: [["存量客群激活方案"]]}).toString("base64")},
  ];
  const parsed = executeCommand({command: "parse-sources", requestId: "req-e2e-parse", input: {files}, store});
  assert.equal(parsed.status, "ok", JSON.stringify(parsed.error ?? null));
  const caseId = parsed.data.caseId;
  const generated = executeCommand({command: "generate-draft", requestId: "req-e2e-draft", input: {caseId}, store});
  assert.equal(generated.status, "ok", JSON.stringify(generated.error ?? null));
  const draftPath = path.join(workDir, "draft.json");
  const corpusPath = path.join(workDir, "corpus.json");
  fs.writeFileSync(draftPath, JSON.stringify(generated.data.draft));
  fs.writeFileSync(corpusPath, JSON.stringify(parsed.data.corpus));

  const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {})});
  const page = await browser.newPage({viewport: {width: 1480, height: 1000}});
  const issues = [];
  page.on("pageerror", error => issues.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") issues.push(`console: ${message.text()}`);
  });
  await page.goto(`file://${encodeURI(path.join(root, "index.html"))}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".node-card");

  await page.click("#openAgentDrawerBtn");
  await page.waitForSelector("#agentDrawer:not([hidden])");
  assert.equal(await page.locator("#agentImportCandidateBtn").isDisabled(), true);

  await page.setInputFiles("#agentDraftFile", draftPath);
  await page.waitForFunction(() => document.getElementById("agentDraftMeta").textContent.includes("待办 ×"));
  assert.equal((await page.locator("#agentDraftMeta").innerText()).includes(caseId), false);
  assert.equal(await page.locator("#agentImportCandidateBtn").isDisabled(), false);
  assert.equal((await page.locator("#agentProvenanceList .agent-item").count()) > 0, true);
  assert.equal((await page.locator("#agentQuestionList .agent-item").count()) > 0, true);

  await page.setInputFiles("#agentCorpusFile", corpusPath);
  await page.click("#agentProvenanceList .agent-ref");
  await page.waitForFunction(() => document.getElementById("agentEvidenceView").textContent.includes("ev-"));

  await page.click("#agentImportCandidateBtn");
  await page.waitForFunction(() => document.getElementById("agentDrawer").hidden);
  const imported = await page.evaluate(() => JSON.parse(document.getElementById("jsonOutput").value));
  assert.equal("strategyId" in imported.strategy, false);
  assert.equal("registrationCaseId" in imported.strategy, false);
  assert.equal(imported.strategy.strategyName, "通用客群激活策略");
  assert.equal(imported.nodes.length, 2);
  assert.equal(imported.taxonomy.tagSelections.some(selection => selection.fieldCode === "strategyType" && selection.values[0].code === "tail_customer_operation"), true);
  assert.equal("provenance" in imported, false);

  await page.click("#openAgentDrawerBtn");
  assert.equal((await page.locator("#agentQuestionList .agent-item").count()) > 0, true);
  const exportGate = await page.evaluate(() => {
    const design = JSON.parse(document.getElementById("jsonOutput").value);
    const metadata = JSON.parse(document.getElementById("metadataOutput").value);
    return window.StrategyFlowDesigner.outputContractGate({...design, registrationMetadata: metadata});
  });
  assert.equal(exportGate.ready, false);
  assert.equal(exportGate.blocking.some(item => item.path === "strategy.strategyId"), false);

  assert.deepEqual(issues, []);
  await browser.close();
  fs.rmSync(workDir, {recursive: true, force: true});
  console.log("agent drawer E2E passed.");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
