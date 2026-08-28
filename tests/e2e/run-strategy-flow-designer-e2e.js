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
  await page.locator(".edge-label").first().click();
  await page.fill(
    '[data-bind="edges.e1.actorBehavior.action"]',
    "测试执行动作"
  );
  const edgeLabelText = await page.locator(".edge-label").first().innerText();
  assert.equal(
    true,
    edgeLabelText.includes("执行人：启动日 已执行 测试执行动作")
  );
  assert.equal(
    true,
    edgeLabelText.includes("对象：启动日 已发生 点击链接")
  );
  await page.locator("#node-n1").click();
  const nodeFieldHelp = await page.evaluate(() => ({
    objectHelp: [...document.querySelectorAll(".field-help")].some(node => node.textContent.includes("先选择对象类型，再填写该类型下的具体对象名称")),
    stateHelp: [...document.querySelectorAll(".field-help")].some(node => node.textContent.includes("对象进入这张卡片时的业务状态")),
    cardObject: document.querySelector("#node-n1 .node-subject")?.textContent,
    cardStateLabel: document.querySelector("#node-n1 .node-state-label")?.textContent,
    hasNameField: Boolean(document.querySelector('[data-bind="nodes.n1.subject.name"]')),
  }));
  assert.equal(nodeFieldHelp.objectHelp, true);
  assert.equal(nodeFieldHelp.stateHelp, true);
  assert.equal(nodeFieldHelp.hasNameField, true);
  assert.equal(nodeFieldHelp.cardObject, "对象：客群｜通用目标客群");
  assert.equal(nodeFieldHelp.cardStateLabel, "对象状态");
  await page.fill('[data-bind="nodes.n1.subject.name"]', "测试对象名称");
  await page.fill(
    '[data-bind="nodes.n1.subject.state"]',
    "测试对象状态"
  );
  await page.click("#saveDraftBtn");
  const explicitlySaved = await page.evaluate(() => ({
    status: document.getElementById("saveStatus").textContent,
    json: JSON.parse(document.getElementById("jsonOutput").value),
    draft: JSON.parse(localStorage.getItem("ebscn.strategy-flow-designer.draft.v0")),
  }));
  assert.equal("草稿已保存", explicitlySaved.status);
  assert.equal(
    "测试执行动作",
    explicitlySaved.json.edges.find(edge => edge.localId === "e1").actorBehavior.action
  );
  assert.equal(
    "测试对象名称",
    explicitlySaved.json.nodes.find(node => node.localId === "n1").subject.name
  );
  assert.equal(
    "测试对象状态",
    explicitlySaved.json.nodes.find(node => node.localId === "n1").subject.state
  );
  assert.equal(
    "测试执行动作",
    explicitlySaved.draft.edges.find(edge => edge.localId === "e1").actorBehavior.action
  );
  const editorInput = page.locator('[data-bind="nodes.n1.subject.name"]');
  const editorBox = await editorInput.boundingBox();
  const canvasBox = await page.locator("#canvasShell").boundingBox();
  assert.ok(editorBox && canvasBox);
  await page.mouse.move(editorBox.x + editorBox.width / 2, editorBox.y + editorBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 320, canvasBox.y + 320, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-bind="nodes.n1.subject.name"]').count(), 1);
  assert.equal(
    true,
    (await page.locator("#inspector").innerText()).includes("流程卡片")
  );
  await page.reload();
  await page.waitForSelector(".node-card");
  assert.equal(
    "测试执行动作",
    await page.evaluate(() => JSON.parse(
      document.getElementById("jsonOutput").value
    ).edges.find(edge => edge.localId === "e1").actorBehavior.action)
  );
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
  await page.click('[data-panel="codeView"]');
  await page.waitForSelector("#codeView.on");
  const codeLayout = await page.evaluate(() => {
    const title = document.querySelector(".code-title").getBoundingClientRect();
    const output = document.getElementById("jsonOutput").getBoundingClientRect();
    return { titleHeight: title.height, outputHeight: output.height };
  });
  assert.ok(codeLayout.titleHeight <= 48, `code title is too tall: ${codeLayout.titleHeight}`);
  assert.ok(codeLayout.outputHeight >= codeLayout.titleHeight * 4, `code output is squeezed: ${JSON.stringify(codeLayout)}`);
  await page.click('[data-panel="validationView"]');

  const layoutsBeforeZoom = await page.evaluate(() => JSON.parse(
    document.getElementById("jsonOutput").value
  ).nodes.map(node => node.layout));
  await page.click("#zoomInBtn");
  await page.click("#zoomInBtn");
  await page.waitForFunction(() => document.getElementById("canvas").dataset.zoom === "1.2");
  assert.equal(await page.locator("#zoomLevel").textContent(), "120%");
  assert.equal(
    5760,
    await page.evaluate(() => document.getElementById("canvasSize").getBoundingClientRect().width)
  );
  await page.locator("#canvasShell").dispatchEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    deltaY: -240,
    clientX: 700,
    clientY: 400,
  });
  await page.waitForFunction(() => Number(document.getElementById("canvas").dataset.zoom) > 1.2);
  await page.click("#zoomResetBtn");
  await page.waitForFunction(() => document.getElementById("canvas").dataset.zoom === "1");
  for (let index = 0; index < 8; index += 1) await page.click("#zoomOutBtn");
  await page.waitForFunction(() => document.getElementById("canvas").dataset.zoom === "0.25");
  assert.equal(await page.locator("#zoomLevel").textContent(), "25%");
  assert.equal(
    true,
    await page.locator("#zoomOutBtn").isDisabled()
  );
  await page.click("#zoomResetBtn");
  await page.waitForFunction(() => document.getElementById("canvas").dataset.zoom === "1");
  await page.evaluate(() => document.getElementById("canvasShell").scrollTo(0, 0));
  await page.click("#zoomInBtn");
  await page.waitForFunction(() => document.getElementById("canvas").dataset.zoom === "1.1");
  const layoutsAfterZoom = await page.evaluate(() => JSON.parse(
    document.getElementById("jsonOutput").value
  ).nodes.map(node => node.layout));
  assert.deepEqual(layoutsAfterZoom, layoutsBeforeZoom);

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
  await page.fill('[data-bind="nodes.n4.subject.state"]', "持续跟进");
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
  const secondSourcePort = await page.locator("#node-n2 .node-port.output").boundingBox();
  const secondTarget = await page.locator("#node-n4").boundingBox();
  assert.ok(secondSourcePort && secondTarget);
  await page.mouse.move(
    secondSourcePort.x + secondSourcePort.width / 2,
    secondSourcePort.y + secondSourcePort.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    secondTarget.x + secondTarget.width / 2,
    secondTarget.y + secondTarget.height / 2,
    { steps: 8 }
  );
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll(".edge-label").length === 4);
  await page.click("#node-n4");
  await page.click("#addStrategyActionBtn");
  await page.click("#addProcessActionBtn");
  await page.waitForFunction(() => {
    const json = JSON.parse(document.getElementById("jsonOutput").value);
    return json.nodes.length === 4
      && json.edges.length === 4
      && json.strategyActions.length === 2
      && json.processActions.length === 2;
  });
  const parallelEdgeLayout = await page.evaluate(() => {
    const edges = JSON.parse(document.getElementById("jsonOutput").value).edges;
    const paths = [...document.querySelectorAll("#edgeSvg path.visible")];
    const pathByEdge = new Map(paths.map(path => [path.dataset.edgeId, path.getAttribute("d")]));
    const startOf = id => Number(pathByEdge.get(id).match(/^M([0-9.]+) ([0-9.]+)/)[2]);
    const endOf = id => {
      const match = pathByEdge.get(id).match(/\s(-?[0-9.]+) (-?[0-9.]+)\s*$/);
      return match && Number(match[2]);
    };
    const labelPositions = [...document.querySelectorAll(".edge-label")].map(label => ({
      left: label.style.left,
      top: label.style.top,
    }));
    return {
      edgeCount: edges.length,
      sameSourceStart: startOf("e1") === startOf("e3"),
      sameTargetEnd: endOf("e3") === endOf("e4"),
      labelPositions,
    };
  });
  assert.equal(parallelEdgeLayout.edgeCount, 4);
  assert.equal(parallelEdgeLayout.sameSourceStart, true);
  assert.equal(parallelEdgeLayout.sameTargetEnd, true);
  assert.equal(parallelEdgeLayout.labelPositions.length, 4);
  assert.equal(
    new Set(parallelEdgeLayout.labelPositions.map(position => `${position.left}|${position.top}`)).size,
    parallelEdgeLayout.labelPositions.length
  );
  const adjustableLabel = page.locator('.edge-label[data-edge-id="e3"]');
  const adjustableBox = await adjustableLabel.boundingBox();
  assert.ok(adjustableBox);
  await page.mouse.move(
    adjustableBox.x + adjustableBox.width / 2,
    adjustableBox.y + adjustableBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    adjustableBox.x + adjustableBox.width / 2,
    adjustableBox.y - 75,
    { steps: 8 }
  );
  await page.mouse.up();
  await page.waitForFunction(() => {
    const edge = JSON.parse(document.getElementById("jsonOutput").value)
      .edges.find(item => item.localId === "e3");
    return edge.layout.normalOffset < -10;
  });

  const exported = await page.evaluate(() => JSON.parse(document.getElementById("jsonOutput").value));
  assert.equal(exported.schemaVersion, "strategy-flow-input/0.1");
  assert.equal(exported.nodes.length, 4);
  assert.equal(exported.edges.length, 4);
  assert.equal(exported.strategyActions.length, 2);
  assert.equal(exported.processActions.length, 2);

  const mermaid = await page.inputValue("#mermaidOutput");
  assert.match(mermaid, /^flowchart TD/);
  assert.match(mermaid, /n1 .* n4/s);

  await page.reload();
  await page.waitForSelector(".node-card");
  await page.waitForFunction(() => document.querySelectorAll(".node-card").length === 4);
  assert.equal(
    "1.1",
    await page.evaluate(() => document.getElementById("canvas").dataset.zoom)
  );
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
