const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../..");
const pagePath = path.join(root, "index.html");
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
  await page.click("#moreActionsBtn");
  await page.click("#autoLayoutBtn");
  const autoLayoutGeometry = await page.evaluate(() => {
    const canvas = document.getElementById("canvas");
    const base = canvas.getBoundingClientRect();
    const zoom = Number(canvas.dataset.zoom || 1);
    const logicalBox = element => {
      const rect = element.getBoundingClientRect();
      return {
        left: (rect.left - base.left) / zoom,
        right: (rect.right - base.left) / zoom,
        top: (rect.top - base.top) / zoom,
        bottom: (rect.bottom - base.top) / zoom,
      };
    };
    const intersects = (a, b) => a.left < b.right && a.right > b.left
      && a.top < b.bottom && a.bottom > b.top;
    const nodes = [...document.querySelectorAll(".node-card")].map(logicalBox);
    const labels = [...document.querySelectorAll(".edge-label")].map(logicalBox);
    const blockLabelOverlaps = [];
    nodes.forEach((node, nodeIndex) => labels.forEach((label, labelIndex) => {
      if (intersects(node, label)) blockLabelOverlaps.push(`${nodeIndex}:${labelIndex}`);
    }));
    const labelLabelOverlaps = [];
    labels.forEach((label, index) => labels.slice(index + 1).forEach((other, otherIndex) => {
      if (intersects(label, other)) labelLabelOverlaps.push(`${index}:${index + otherIndex + 1}`);
    }));
    const edges = JSON.parse(document.getElementById("jsonOutput").value).edges;
    return {
      nodeCount: nodes.length,
      labelCount: labels.length,
      blockLabelOverlaps,
      labelLabelOverlaps,
      normalOffsets: edges.map(edge => edge.layout.normalOffset),
    };
  });
  assert.equal(autoLayoutGeometry.nodeCount, 3);
  assert.equal(autoLayoutGeometry.labelCount, 2);
  assert.deepEqual(autoLayoutGeometry.blockLabelOverlaps, []);
  assert.deepEqual(autoLayoutGeometry.labelLabelOverlaps, []);
  assert.deepEqual(autoLayoutGeometry.normalOffsets, [0, 0]);
  // Restore the compact fixture before the later drag scenarios; auto-layout
  // intentionally expands rank pitch and would change their seeded positions.
  await page.click("#moreActionsBtn");
  await page.click("#undoBtn");
  await page.locator(".edge-label").first().click();
  await page.fill(
    '[data-bind="edges.e1.actorBehavior.action"]',
    "测试执行动作"
  );
  const edgeLabelText = await page.locator(".edge-label").first().innerText();
  const normalizedEdgeLabelText = edgeLabelText.replace(/\s+/g, "");
  assert.equal(
    true,
    normalizedEdgeLabelText.includes("执行人已执行启动日测试执行动作")
  );
  assert.equal(
    true,
    normalizedEdgeLabelText.includes("对象已发生启动日点击链接")
  );
  await page.locator("#node-n1").click();
  const nodeFieldHelp = await page.evaluate(() => ({
    objectHelp: [...document.querySelectorAll(".field-help")].some(node => node.textContent.includes("先选择对象类型，再填写该类型下的具体对象名称")),
    stateHelp: [...document.querySelectorAll(".field-help")].some(node => node.textContent.includes("对象进入这张卡片时的业务状态")),
    cardFacts: [...document.querySelectorAll("#node-n1 .node-fact")].map(node => node.textContent.trim()),
    hasNameField: Boolean(document.querySelector('[data-bind="nodes.n1.subject.name"]')),
    hasSortOrderField: Boolean(document.querySelector('[data-bind="nodes.n1.sortOrder"]')),
    sortOrderHelp: [...document.querySelectorAll(".field-help")].some(node => node.textContent.includes("看板排序按升序展示流程卡片")),
    cardSortLabel: document.querySelector("#node-n1 .node-id")?.textContent || "",
  }));
  assert.equal(nodeFieldHelp.objectHelp, true);
  assert.equal(nodeFieldHelp.stateHelp, true);
  assert.equal(nodeFieldHelp.hasNameField, true);
  assert.equal(nodeFieldHelp.hasSortOrderField, true);
  assert.equal(nodeFieldHelp.sortOrderHelp, true);
  assert.equal(nodeFieldHelp.cardSortLabel.includes("排序 10"), true);
  assert.equal(
    true,
    nodeFieldHelp.cardFacts.some(text => text.includes("对象") && text.includes("客群｜通用目标客群"))
  );
  assert.equal(
    true,
    nodeFieldHelp.cardFacts.some(text => text.includes("对象状态"))
  );
  assert.equal(await page.locator('[data-bind="nodes.n1.displayName"]').count(), 0);
  await page.fill('[data-bind="nodes.n1.subject.name"]', "测试对象名称");
  await page.fill(
    '[data-bind="nodes.n1.subject.state"]',
    "测试对象状态"
  );
  await page.fill('[data-bind="nodes.n1.sortOrder"]', "15");
  await page.click("#moreActionsBtn");
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
  assert.equal(15, explicitlySaved.json.nodes.find(node => node.localId === "n1").sortOrder);
  assert.equal(
    "测试执行动作",
    explicitlySaved.draft.edges.find(edge => edge.localId === "e1").actorBehavior.action
  );
  await page.locator(".action-chip.strategy").click();
  const strategyActionInspector = await page.locator("#inspector").innerText();
  assert.equal(true, strategyActionInspector.includes("时间（继承）"));
  assert.equal(true, strategyActionInspector.includes("测试对象状态"));
  assert.equal(true, strategyActionInspector.includes("进入条件"));
  assert.equal(await page.locator('[data-bind="strategyActions.sa1.time"]').count(), 0);
  assert.equal(await page.locator('[data-bind="strategyActions.sa1.subjectState"]').count(), 0);
  await page.click("#openRegistrationDrawerBtn");
  await page.click('[data-inspector-tab="taxonomy"]');
  await page.check('input[data-taxonomy-field="touchScene"][data-taxonomy-code="wecom"]');
  await page.check('input[data-taxonomy-field="touchMethod"][data-taxonomy-code="wecom_private_chat"]');
  await page.keyboard.press("Escape");
  await page.locator(".action-chip.strategy").click();
  const readTouchSelection = () => page.evaluate(() => {
    const action = JSON.parse(document.getElementById("jsonOutput").value)
      .strategyActions.find(item => item.localId === "sa1");
    return {
      scenes: action.touchScenes.map(item => item.code),
      methods: action.touchMethods.map(item => `${item.code}:${item.parentCode}`),
    };
  });
  await page.click('[data-touch-toggle="touchScenes"]');
  await page.check('input[data-touch-field="touchScenes"][data-touch-code="wecom"]');
  await page.keyboard.press("Escape");
  await page.click('[data-touch-toggle="touchMethods"]');
  await page.check('input[data-touch-field="touchMethods"][data-touch-code="wecom_private_chat"]');
  assert.deepEqual(await readTouchSelection(), {
    scenes: ["app", "wecom"],
    methods: ["in_app_message:app", "wecom_private_chat:wecom"],
  });
  await page.click('[data-touch-toggle="touchScenes"]');
  await page.uncheck('input[data-touch-field="touchScenes"][data-touch-code="wecom"]');
  assert.deepEqual(await readTouchSelection(), {
    scenes: ["app"],
    methods: ["in_app_message:app"],
  });
  await page.click("#moreActionsBtn");
  await page.click("#undoBtn");
  await page.waitForFunction(() => {
    const action = JSON.parse(document.getElementById("jsonOutput").value)
      .strategyActions.find(item => item.localId === "sa1");
    return action.touchScenes.some(item => item.code === "wecom")
      && action.touchMethods.some(item => item.code === "wecom_private_chat");
  });
  await page.locator('.multi-select-chip', { hasText: "APP触达" }).click();
  assert.deepEqual(await readTouchSelection(), {
    scenes: ["wecom"],
    methods: ["wecom_private_chat:wecom"],
  });
  await page.click("#moreActionsBtn");
  await page.click("#undoBtn");
  await page.waitForFunction(() => {
    const action = JSON.parse(document.getElementById("jsonOutput").value)
      .strategyActions.find(item => item.localId === "sa1");
    return action.touchScenes.some(item => item.code === "app")
      && action.touchMethods.some(item => item.code === "in_app_message");
  });
  await page.focus('[data-touch-toggle="touchMethods"]');
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator('[data-touch-container="touchMethods"].open').count(),
    1
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator('[data-touch-container="touchMethods"].open').count(),
    0
  );
  await page.focus('[data-touch-toggle="touchScenes"]');
  await page.keyboard.press("Enter");
  await page.focus('input[data-touch-field="touchScenes"][data-touch-code="app"]');
  await page.keyboard.press("Space");
  assert.deepEqual(await readTouchSelection(), {
    scenes: ["wecom"],
    methods: ["wecom_private_chat:wecom"],
  });
  await page.click("#moreActionsBtn");
  await page.click("#undoBtn");
  await page.waitForFunction(() => {
    const action = JSON.parse(document.getElementById("jsonOutput").value)
      .strategyActions.find(item => item.localId === "sa1");
    return action.touchScenes.some(item => item.code === "app")
      && action.touchMethods.some(item => item.code === "in_app_message");
  });
  await page.locator(".action-chip.process").click();
  const processActionInspector = await page.locator("#inspector").innerText();
  assert.equal(true, processActionInspector.includes("执行人 / 角色（继承）"));
  assert.equal(true, processActionInspector.includes("接收对象（继承）"));
  assert.equal(await page.locator('[data-bind="processActions.pa1.executor"]').count(), 0);
  assert.equal(await page.locator('[data-bind="processActions.pa1.recipient"]').count(), 0);
  await page.click("#node-n1");
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
  await page.dblclick("#node-n1");
  await page.waitForFunction(() => !document.getElementById("strategyFlowDesigner").classList.contains("right-collapsed"));
  assert.equal(
    true,
    (await page.locator("#inspector").innerText()).includes("流程卡片")
  );
  await page.click("#toggleRightPanelBtn");
  await page.locator(".edge-label").first().dblclick();
  await page.waitForFunction(() => !document.getElementById("strategyFlowDesigner").classList.contains("right-collapsed"));
  assert.equal(
    true,
    (await page.locator("#inspector").innerText()).includes("流转规则")
  );
  await page.click("#toggleLeftPanelBtn");
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
  assert.equal(
    40,
    await page.evaluate(() => JSON.parse(document.getElementById("jsonOutput").value)
      .nodes.find(node => node.localId === "n4").sortOrder)
  );
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
  assert.equal(
    40,
    await page.evaluate(() => JSON.parse(document.getElementById("jsonOutput").value)
      .nodes.find(node => node.localId === "n4").sortOrder)
  );
  await page.keyboard.press("Escape");
  const beforeGroupDrag = await page.evaluate(() => {
    const design = JSON.parse(document.getElementById("jsonOutput").value);
    return {
      n1: design.nodes.find(node => node.localId === "n1").layout,
      n4: design.nodes.find(node => node.localId === "n4").layout,
    };
  });
  await page.click("#node-n1", { modifiers: ["Control"] });
  await page.click("#node-n4", { modifiers: ["Control"] });
  assert.equal(await page.locator(".node-card.selected").count(), 2);
  const groupDragSource = await page.locator("#node-n4").boundingBox();
  assert.ok(groupDragSource);
  await page.waitForTimeout(500);
  await page.mouse.move(groupDragSource.x + 45, groupDragSource.y + 18);
  await page.mouse.down();
  await page.mouse.move(groupDragSource.x + 125, groupDragSource.y + 65, { steps: 8 });
  await page.mouse.up();
  const afterGroupDrag = await page.evaluate(() => {
    const design = JSON.parse(document.getElementById("jsonOutput").value);
    return {
      selected: document.querySelectorAll(".node-card.selected").length,
      n1: design.nodes.find(node => node.localId === "n1").layout,
      n4: design.nodes.find(node => node.localId === "n4").layout,
    };
  });
  assert.equal(afterGroupDrag.selected, 2);
  assert.notEqual(afterGroupDrag.n1.x, beforeGroupDrag.n1.x);
  assert.equal(
    afterGroupDrag.n1.x - beforeGroupDrag.n1.x,
    afterGroupDrag.n4.x - beforeGroupDrag.n4.x
  );
  assert.equal(
    afterGroupDrag.n1.y - beforeGroupDrag.n1.y,
    afterGroupDrag.n4.y - beforeGroupDrag.n4.y
  );
  await page.click("#moreActionsBtn");
  await page.click("#undoBtn");
  await page.waitForFunction(before => {
    const design = JSON.parse(document.getElementById("jsonOutput").value);
    const n1 = design.nodes.find(node => node.localId === "n1").layout;
    const n4 = design.nodes.find(node => node.localId === "n4").layout;
    return n1.x === before.n1.x && n1.y === before.n1.y
      && n4.x === before.n4.x && n4.y === before.n4.y;
  }, beforeGroupDrag);
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
  await page.click('[data-touch-toggle="touchScenes"]');
  await page.check('input[data-touch-field="touchScenes"][data-touch-code="app"]');
  await page.keyboard.press("Escape");
  await page.click('[data-touch-toggle="touchMethods"]');
  await page.check('input[data-touch-field="touchMethods"][data-touch-code="in_app_message"]');
  await page.keyboard.press("Escape");
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
  assert.equal(exported.schemaVersion, "strategy-flow-input/0.6");
  assert.equal(exported.nodes.every(node => !("displayName" in node)), true);
  assert.equal(exported.nodes.every(node => Number.isInteger(node.sortOrder) && node.sortOrder >= 0), true);
  assert.equal(new Set(exported.nodes.map(node => node.sortOrder)).size, exported.nodes.length, true);
  assert.equal(exported.strategyActions.every(action => !("time" in action || "subjectState" in action)), true);
  assert.equal(exported.strategyActions.every(action => !("touchScene" in action || "touchMethod" in action)), true);
  assert.equal(exported.strategyActions.every(action => action.touchScenes.every(item => Object.keys(item).join(",") === "code")), true);
  assert.equal(exported.strategyActions.every(action => action.touchMethods.every(item => Object.keys(item).sort().join(",") === "code,parentCode")), true);
  assert.equal(exported.processActions.every(action => !("executor" in action || "recipient" in action)), true);
  assert.equal("strategyId" in exported.strategy, false);
  assert.equal("registrationCaseId" in exported.strategy, false);
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
  assert.deepEqual(
    restored.nodes.map(node => node.sortOrder),
    exported.nodes.map(node => node.sortOrder)
  );

  await page.click('[data-node-type="classification"]');
  await page.waitForFunction(() => document.querySelectorAll(".node-card").length === 5);
  await page.dblclick("#node-n5");
  assert.equal(
    true,
    (await page.locator("#inspector").innerText()).includes("对象分类")
  );
  await page.click('[data-action="add-process"]');
  await page.waitForFunction(() => JSON.parse(document.getElementById("jsonOutput").value).processActions.length === 3);
  const classificationPort = await page.locator("#node-n5 .node-port.output").boundingBox();
  const classificationTarget = await page.locator("#node-n1").boundingBox();
  assert.ok(classificationPort && classificationTarget);
  await page.mouse.move(
    classificationPort.x + classificationPort.width / 2,
    classificationPort.y + classificationPort.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    classificationTarget.x + classificationTarget.width / 2,
    classificationTarget.y + classificationTarget.height / 2,
    { steps: 8 }
  );
  await page.mouse.up();
  await page.waitForFunction(() => JSON.parse(document.getElementById("jsonOutput").value).edges.length === 5);
  await page.check('[data-bind="edges.e5.subjectBehavior.noAction"]');
  await page.check('[data-bind="edges.e5.confirmed"]');
  const classificationExport = await page.evaluate(() => {
    const design = JSON.parse(document.getElementById("jsonOutput").value);
    return {
      schemaVersion: design.schemaVersion,
      sortOrder: design.nodes.find(node => node.localId === "n5").sortOrder,
      nodeType: design.nodes.find(node => node.localId === "n5").nodeType,
      subjectStatus: design.edges.find(edge => edge.localId === "e5").subjectBehavior.status,
      processActionCount: design.processActions.filter(action => action.nodeId === "n5").length,
      strategyActionCount: design.strategyActions.filter(action => action.nodeId === "n5").length,
      errors: design.validation.errors,
    };
  });
  assert.equal(classificationExport.schemaVersion, "strategy-flow-input/0.6");
  assert.equal(classificationExport.sortOrder, 50);
  assert.equal(classificationExport.nodeType, "classification");
  assert.equal(classificationExport.subjectStatus, "no_requirement");
  assert.equal(classificationExport.processActionCount, 1);
  assert.equal(classificationExport.strategyActionCount, 0);
  assert.deepEqual(classificationExport.errors, []);

  assert.deepEqual(issues, []);
  await browser.close();
  console.log(JSON.stringify({
    ok: true,
    nodes: exported.nodes.length + 1,
    edges: exported.edges.length + 1,
    strategyActions: exported.strategyActions.length,
    processActions: exported.processActions.length,
  }));
})().catch(async error => {
  await browser?.close();
  console.error(error);
  process.exitCode = 1;
});
