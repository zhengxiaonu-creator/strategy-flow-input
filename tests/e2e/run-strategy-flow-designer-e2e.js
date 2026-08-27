const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../../..");
const pagePath = path.join(root, "ebscn-strategy-flow-designer", "index.html");
const chromePath = process.env.CHROME_PATH;
let browser;

(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(chromePath ? { executablePath: chromePath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1480, height: 1000 } });
  const issues = [];
  page.on("pageerror", error => issues.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") issues.push(`console: ${message.text()}`);
  });

  await page.goto(`file://${encodeURI(pagePath)}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".node-card");

  assert.equal(await page.locator(".node-card").count(), 3);
  assert.equal(await page.locator('[data-bind$=".localId"]').count(), 0);
  await page.click("#toggleLeftPanelBtn");
  await page.click("#toggleRightPanelBtn");
  await page.click("#toggleBottomPanelBtn");
  await page.waitForFunction(() => document.getElementById("strategyFlowDesigner").classList.contains("left-collapsed"));
  assert.equal(
    true,
    await page.evaluate(() => ({
      left: document.getElementById("strategyFlowDesigner").classList.contains("left-collapsed"),
      right: document.getElementById("strategyFlowDesigner").classList.contains("right-collapsed"),
      bottom: document.getElementById("strategyFlowDesigner").classList.contains("bottom-collapsed"),
    }).left)
  );
  assert.equal(
    true,
    await page.evaluate(() => document.getElementById("strategyFlowDesigner").classList.contains("right-collapsed"))
  );
  assert.equal(
    true,
    await page.evaluate(() => document.getElementById("strategyFlowDesigner").classList.contains("bottom-collapsed"))
  );
  await page.reload();
  await page.waitForSelector(".node-card");
  assert.equal(
    true,
    await page.evaluate(() => document.getElementById("strategyFlowDesigner").classList.contains("left-collapsed"))
  );
  await page.click("#toggleLeftPanelBtn");
  await page.click("#toggleRightPanelBtn");
  await page.click("#toggleBottomPanelBtn");
  await page.waitForFunction(() => !document.getElementById("strategyFlowDesigner").classList.contains("bottom-collapsed"));

  await page.click('[data-node-type="process"]');
  await page.waitForFunction(() => document.querySelectorAll(".node-card").length === 4);
  const beforeDrag = await page.locator("#node-n4").boundingBox();
  assert.ok(beforeDrag);
  await page.mouse.move(beforeDrag.x + 45, beforeDrag.y + 18);
  await page.mouse.down();
  await page.mouse.move(beforeDrag.x + 150, beforeDrag.y + 92, { steps: 8 });
  await page.mouse.up();
  const afterDrag = await page.locator("#node-n4").boundingBox();
  assert.ok(afterDrag);
  assert.ok(afterDrag.x > beforeDrag.x + 80);
  assert.ok(afterDrag.y > beforeDrag.y + 45);
  await page.fill('[data-bind="nodes.n4.executor"]', "系统");
  await page.fill('[data-bind="nodes.n4.subject.state"]', "目标客群·持续跟进");
  const sourcePort = await page.locator("#node-n1 .node-port.output").boundingBox();
  const target = await page.locator("#node-n4").boundingBox();
  assert.ok(sourcePort && target);

  await page.mouse.move(
    sourcePort.x + sourcePort.width / 2,
    sourcePort.y + sourcePort.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 8 }
  );
  await page.mouse.up();
  await page.waitForSelector("#node-n4");
  await page.click("#node-n4");
  await page.click("#addStrategyActionBtn");
  await page.click("#addProcessActionBtn");
  await page.waitForFunction(() => {
    const json = JSON.parse(document.getElementById("jsonOutput").value);
    return json.nodes.length === 4
      && json.edges.length === 3
      && json.strategyActions.length === 2
      && json.processActions.length === 2;
  });

  const exported = await page.evaluate(() => JSON.parse(document.getElementById("jsonOutput").value));
  assert.equal(exported.schemaVersion, "strategy-flow-input/0.1");
  assert.equal(exported.nodes.length, 4);
  assert.equal(exported.edges.length, 3);
  assert.equal(exported.strategyActions.length, 2);
  assert.equal(exported.processActions.length, 2);

  const mermaid = await page.inputValue("#mermaidOutput");
  assert.match(mermaid, /^flowchart TD/);
  assert.match(mermaid, /n1 .* n4/s);

  await page.reload();
  await page.waitForSelector(".node-card");
  await page.waitForFunction(() => document.querySelectorAll(".node-card").length === 4);
  const restored = await page.evaluate(() => JSON.parse(document.getElementById("jsonOutput").value));
  assert.deepEqual(
    restored.nodes.map(node => node.localId),
    exported.nodes.map(node => node.localId)
  );

  assert.deepEqual(issues, []);
  await browser.close();
  console.log(JSON.stringify({
    ok: true,
    nodes: exported.nodes.length,
    edges: exported.edges.length,
    strategyActions: exported.strategyActions.length,
    processActions: exported.processActions.length,
  }));
})().catch(async error => {
  await browser?.close();
  console.error(error);
  process.exitCode = 1;
});
