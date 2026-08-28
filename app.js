/*
 * EBSCN Strategy Flow Designer MVP.
 * Pure functions are kept at the top so Node tests can require this file; the
 * browser app is initialized only when the root element exists.
 */
(function () {
  "use strict";

  const SCHEMA_VERSION = "strategy-flow-input/0.1";
  const STORAGE_KEY = "ebscn.strategy-flow-designer.draft.v0";
  const LAYOUT_STORAGE_KEY = "ebscn.strategy-flow-designer.layout.v0";
  const NORMAL_OFFSET_LIMIT = 4800;
  const NODE_TYPES = ["entry", "process", "wait", "outcome", "recycle", "reentry", "terminal"];
  const EDGE_TYPES = ["state_transition", "handoff", "outcome", "recycle", "reentry", "exception"];
  const SUBJECT_TYPES = ["customer", "scene", "event", "activity"];
  const ACTOR_STATUSES = [
    ["executed", "已执行"],
    ["not_executed", "未执行"],
    ["no_requirement", "无行为要求"],
  ];
  const SUBJECT_STATUSES = [
    ["happened", "已发生"],
    ["not_happened", "未发生"],
    ["no_requirement", "无行为要求"],
  ];

  const clean = value => String(value ?? "").trim();
  const array = value => Array.isArray(value) ? value : [];
  const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const labelOf = (value, pairs) => pairs.find(item => item[0] === value)?.[1] || value || "待确认";
  const escapeHtml = value => clean(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));

  function string(value, fallback = "") {
    const result = clean(value);
    return result || fallback;
  }

  function normalizeStrategy(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      strategyName: string(source.strategyName),
      strategyId: string(source.strategyId),
      paradigm: source.paradigm === "scene" ? "scene" : "customer",
      owner: string(source.owner),
      submitter: string(source.submitter),
      businessScene: string(source.businessScene),
      strategyType: string(source.strategyType),
      strategySubtype: string(source.strategySubtype),
      version: string(source.version, "0.1"),
      versionStatus: ["draft", "candidate", "registered", "deprecated"].includes(source.versionStatus) ? source.versionStatus : "draft",
    };
  }

  function normalizeNode(value, index) {
    const source = value && typeof value === "object" ? value : {};
    const layout = source.layout && typeof source.layout === "object" ? source.layout : {};
    const subject = source.subject && typeof source.subject === "object" ? source.subject : {};
    const defaultY = 90 + index * 155;
    return {
      localId: string(source.localId),
      nodeType: NODE_TYPES.includes(source.nodeType) ? source.nodeType : "process",
      time: string(source.time),
      executor: string(source.executor),
      subject: {
        type: SUBJECT_TYPES.includes(subject.type) ? subject.type : "customer",
        name: string(subject.name),
        state: string(subject.state),
      },
      displayName: string(source.displayName),
      layout: {
        x: numberOr(layout.x, 90),
        y: numberOr(layout.y, defaultY),
      },
    };
  }

  function normalizeBehavior(value, kind) {
    const source = value && typeof value === "object" ? value : {};
    return {
      time: string(source.time),
      action: string(source.action),
      status: kind === "actor"
        ? (ACTOR_STATUSES.some(item => item[0] === source.status) ? source.status : "")
        : (SUBJECT_STATUSES.some(item => item[0] === source.status) ? source.status : ""),
    };
  }

  function normalizeEdge(value) {
    const source = value && typeof value === "object" ? value : {};
    const layout = source.layout && typeof source.layout === "object" ? source.layout : {};
    return {
      localId: string(source.localId),
      from: string(source.from),
      to: string(source.to),
      edgeType: EDGE_TYPES.includes(source.edgeType) ? source.edgeType : "state_transition",
      actorBehavior: normalizeBehavior(source.actorBehavior, "actor"),
      subjectBehavior: normalizeBehavior(source.subjectBehavior, "subject"),
      confirmed: source.confirmed === true,
      mutexGroup: string(source.mutexGroup),
      overwriteSource: source.overwriteSource === true,
      label: string(source.label),
      layout: {
        normalOffset: Math.max(
          -NORMAL_OFFSET_LIMIT,
          Math.min(NORMAL_OFFSET_LIMIT, numberOr(layout.normalOffset, 0)),
        ),
      },
    };
  }

  function normalizeStrategyAction(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      localId: string(source.localId),
      nodeId: string(source.nodeId),
      outgoingEdgeId: string(source.outgoingEdgeId),
      time: string(source.time),
      subjectState: string(source.subjectState),
      judge: string(source.judge),
      touchScene: string(source.touchScene),
      touchMethod: string(source.touchMethod),
      theme: string(source.theme),
      goal: string(source.goal),
      hook: string(source.hook),
      copy: string(source.copy),
      hasLink: source.hasLink === true,
      metrics: array(source.metrics).map(clean).filter(Boolean),
    };
  }

  function normalizeProcessAction(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      localId: string(source.localId),
      nodeId: string(source.nodeId),
      outgoingEdgeId: string(source.outgoingEdgeId),
      executor: string(source.executor),
      scene: string(source.scene),
      condition: string(source.condition),
      result: string(source.result),
      action: string(source.action),
      hook: string(source.hook),
      recipient: string(source.recipient),
      metrics: array(source.metrics).map(clean).filter(Boolean),
    };
  }

  function normalizeDocument(value) {
    const source = value && typeof value === "object" ? value : {};
    const normalized = {
      schemaVersion: string(source.schemaVersion, SCHEMA_VERSION),
      strategy: normalizeStrategy(source.strategy),
      nodes: array(source.nodes).map(normalizeNode),
      edges: array(source.edges).map(normalizeEdge),
      strategyActions: array(source.strategyActions).map(normalizeStrategyAction),
      processActions: array(source.processActions).map(normalizeProcessAction),
    };
    ensureAutomaticLocalIds(normalized);
    return normalized;
  }

  function nextAutomaticId(prefix, items) {
    const used = new Set(items.map(item => clean(item.localId)).filter(Boolean));
    let index = 1;
    let candidate = `${prefix}${index}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `${prefix}${index}`;
    }
    return candidate;
  }

  function ensureAutomaticLocalIds(documentValue) {
    // Internal IDs are UI references, not business input. Imported drafts that
    // omit them get stable short IDs before validation; explicit bad IDs stay
    // visible so the reviewer can fix the source rather than hiding an error.
    [
      [documentValue.nodes, "n"],
      [documentValue.edges, "e"],
      [documentValue.strategyActions, "sa"],
      [documentValue.processActions, "pa"],
    ].forEach(([items, prefix]) => {
      items.forEach(item => {
        if (!clean(item.localId)) item.localId = nextAutomaticId(prefix, items);
      });
    });
  }

  function defaultDocument() {
    return {
      schemaVersion: SCHEMA_VERSION,
      strategy: normalizeStrategy({ paradigm: "customer" }),
      nodes: [],
      edges: [],
      strategyActions: [],
      processActions: [],
    };
  }

  function issue(code, message, path) {
    return { code, message, path };
  }

  function validateDocument(input) {
    const doc = normalizeDocument(input);
    const errors = [];
    const warnings = [];
    const nodes = new Map(doc.nodes.map(node => [node.localId, node]));
    const edges = new Map(doc.edges.map(edge => [edge.localId, edge]));

    if (doc.schemaVersion !== SCHEMA_VERSION) {
      errors.push(issue("SCHEMA_VERSION_UNSUPPORTED", `仅支持 ${SCHEMA_VERSION}`, "schemaVersion"));
    }
    ["strategyName", "paradigm", "owner", "submitter"].forEach(key => {
      if (!clean(doc.strategy[key])) {
        errors.push(issue("STRATEGY_FIELD_REQUIRED", `策略字段缺失：${key}`, `strategy.${key}`));
      }
    });

    const duplicate = (items, kind, path) => {
      const seen = new Set();
      items.forEach((item, index) => {
        const id = clean(item.localId);
        if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) {
          errors.push(issue(`${kind}_ID_INVALID`, "ID 必须以字母开头，只能包含字母、数字、下划线和连字符", `${path}[${index}].localId`));
        } else if (seen.has(id)) {
          errors.push(issue(`${kind}_ID_DUPLICATE`, `ID 重复：${id}`, `${path}[${index}].localId`));
        }
        seen.add(id);
      });
    };
    duplicate(doc.nodes, "NODE", "nodes");
    duplicate(doc.edges, "EDGE", "edges");
    duplicate(doc.strategyActions, "ACTION", "strategyActions");
    duplicate(doc.processActions, "ACTION", "processActions");

    doc.nodes.forEach((node, index) => {
      const base = `nodes[${index}]`;
      if (!node.time) errors.push(issue("TIME_REQUIRED", "流程卡片缺少时间 / 阶段", `${base}.time`));
      if (!node.executor) errors.push(issue("EXECUTOR_REQUIRED", "流程卡片缺少负责执行的角色 / 人", `${base}.executor`));
      if (!node.subject.state) errors.push(issue("SUBJECT_STATE_REQUIRED", "流程卡片缺少对象状态", `${base}.subject.state`));
      if (!node.subject.name) errors.push(issue("SUBJECT_NAME_REQUIRED", "流程卡片缺少对象名称", `${base}.subject.name`));
      if (!Number.isFinite(node.layout.x) || !Number.isFinite(node.layout.y)) {
        errors.push(issue("LAYOUT_INVALID", "画布坐标无效", `${base}.layout`));
      }
    });

    const degrees = new Map(doc.nodes.map(node => [node.localId, 0]));
    doc.edges.forEach((edge, index) => {
      const base = `edges[${index}]`;
      const from = nodes.get(edge.from);
      const to = nodes.get(edge.to);
      if (!from) errors.push(issue("EDGE_ENDPOINT_MISSING", `流转规则的来源卡片不存在：${edge.from || "空"}`, `${base}.from`));
      if (!to) errors.push(issue("EDGE_ENDPOINT_MISSING", `流转规则的目标卡片不存在：${edge.to || "空"}`, `${base}.to`));
      if (edge.from === edge.to) errors.push(issue("EDGE_SELF_LOOP", "流转规则不能指回同一张卡片；收回重启请经过明确卡片", `${base}`));
      if (from && to) {
        degrees.set(edge.from, degrees.get(edge.from) + 1);
        degrees.set(edge.to, degrees.get(edge.to) + 1);
        if (["outcome", "terminal"].includes(to.nodeType) && edge.edgeType !== "outcome" && edge.edgeType !== "handoff") {
          errors.push(issue("OUTCOME_EDGE_TYPE_INVALID", "进入“目标达成 / 流程结束”卡片时，流转类型必须选“达成结果”或“责任人交接”", `${base}.edgeType`));
        }
        if (["outcome", "terminal"].includes(from.nodeType)) {
          errors.push(issue("TERMINAL_OUTGOING_EDGE", "“目标达成 / 流程结束”卡片不能再有后续流转", `${base}.from`));
        }
        if (from.executor !== to.executor && edge.edgeType !== "handoff") {
          errors.push(issue("EXECUTOR_HANDOFF_MISSING", "前后卡片负责人不同，流转类型必须选“责任人交接”", `${base}.edgeType`));
        }
      }
      if (!edge.actorBehavior.time) errors.push(issue("ACTOR_TIME_REQUIRED", "执行人做了什么：缺少时间", `${base}.actorBehavior.time`));
      if (!edge.actorBehavior.action) errors.push(issue("ACTOR_ACTION_REQUIRED", "执行人做了什么：缺少动作", `${base}.actorBehavior.action`));
      if (!edge.actorBehavior.status) errors.push(issue("ACTOR_STATUS_REQUIRED", "执行人做了什么：缺少执行状态", `${base}.actorBehavior.status`));
      if (!edge.subjectBehavior.time) errors.push(issue("SUBJECT_TIME_REQUIRED", "对象行为缺少时间", `${base}.subjectBehavior.time`));
      if (!edge.subjectBehavior.action) errors.push(issue("SUBJECT_ACTION_REQUIRED", "对象行为缺少发生行为", `${base}.subjectBehavior.action`));
      if (!edge.subjectBehavior.status) errors.push(issue("SUBJECT_STATUS_REQUIRED", "对象行为缺少发生状态", `${base}.subjectBehavior.status`));
      if (edge.confirmed !== true) warnings.push(issue("EDGE_NOT_CONFIRMED", "流转规则尚未业务确认", `${base}.confirmed`));
    });

    if (doc.nodes.length > 1) {
      doc.nodes.forEach((node, index) => {
        if ((degrees.get(node.localId) || 0) === 0) {
          errors.push(issue("NODE_ORPHAN", "孤立卡片必须先连线或删除", `nodes[${index}]`));
        }
      });
    }

    const actionNode = (kind, action, index, path) => {
      const base = `${path}[${index}]`;
      if (!nodes.has(action.nodeId)) errors.push(issue(`${kind}_NODE_MISSING`, `所属流程卡片不存在：${action.nodeId || "空"}`, `${base}.nodeId`));
      if (action.outgoingEdgeId) {
        const edge = edges.get(action.outgoingEdgeId);
        if (!edge) errors.push(issue(`${kind}_EDGE_MISSING`, `绑定的流转规则不存在：${action.outgoingEdgeId}`, `${base}.outgoingEdgeId`));
        if (edge && edge.from !== action.nodeId) errors.push(issue(`${kind}_EDGE_SOURCE_MISMATCH`, "绑定的流转规则必须从当前流程卡片流出", `${base}.outgoingEdgeId`));
      }
    };

    doc.strategyActions.forEach((action, index) => {
      const base = `strategyActions[${index}]`;
      actionNode("STRATEGY_ACTION", action, index, "strategyActions");
      [
        ["time", "时间"], ["subjectState", "对象状态"], ["judge", "进入条件"],
        ["touchScene", "触达场景"], ["touchMethod", "触达方式"], ["theme", "话术主题"],
        ["goal", "核心目标"], ["hook", "核心抓手"], ["copy", "文案"],
      ].forEach(([key, name]) => {
        if (!clean(action[key])) errors.push(issue("ACTION_FIELD_REQUIRED", `客户触达内容字段缺失：${name}`, `${base}.${key}`));
      });
      if (!action.metrics.length) errors.push(issue("ACTION_FIELD_REQUIRED", "客户触达内容至少需要一个考察指标", `${base}.metrics`));
    });

    doc.processActions.forEach((action, index) => {
      const base = `processActions[${index}]`;
      actionNode("PROCESS_ACTION", action, index, "processActions");
      [
        ["executor", "执行人 / 角色"], ["scene", "执行场景"], ["condition", "什么情况下执行"],
        ["result", "执行后的结果"], ["action", "具体执行动作"], ["hook", "执行抓手"],
        ["recipient", "接受对象"],
      ].forEach(([key, name]) => {
        if (!clean(action[key])) errors.push(issue("ACTION_FIELD_REQUIRED", `执行跟进动作字段缺失：${name}`, `${base}.${key}`));
      });
      if (!action.metrics.length) errors.push(issue("ACTION_FIELD_REQUIRED", "执行跟进动作至少需要一个过程管理指标", `${base}.metrics`));
    });

    if (!doc.strategyActions.length) warnings.push(issue("STRATEGY_ACTION_MISSING", "当前流程没有客户触达内容", "strategyActions"));
    if (!doc.processActions.length) warnings.push(issue("PROCESS_ACTION_MISSING", "当前流程没有执行跟进动作", "processActions"));
    doc.nodes.forEach((node, index) => {
      if (["process", "wait", "recycle", "reentry"].includes(node.nodeType)) {
        const hasProcess = doc.processActions.some(action => action.nodeId === node.localId);
        if (!hasProcess) warnings.push(issue("PROCESS_ACTION_UNMOUNTED", "中间跟进卡片尚未添加执行跟进动作", `nodes[${index}]`));
      }
    });

    return {
      status: errors.length ? "draft" : "ready_to_submit",
      errors,
      warnings,
    };
  }

  function toExportDocument(input) {
    const doc = normalizeDocument(input);
    return { ...doc, validation: validateDocument(doc) };
  }

  function toJSON(input) {
    return JSON.stringify(toExportDocument(input), null, 2);
  }

  function escapeMermaid(value) {
    return clean(value)
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, "<br/>");
  }

  function toMermaid(input) {
    const doc = normalizeDocument(input);
    const nodes = new Map(doc.nodes.map(node => [node.localId, node]));
    const lines = ["flowchart TD"];
    doc.nodes.forEach(node => {
      const label = `${node.time || "时间待确认"}｜${node.executor || "执行人待确认"}｜${node.subject.name || "对象待确认"}｜${node.subject.state || "状态待确认"}`;
      lines.push(`    ${node.localId}["${escapeMermaid(label)}"]`);
    });
    doc.edges.forEach(edge => {
      if (!nodes.has(edge.from) || !nodes.has(edge.to)) return;
      const actorStatus = labelOf(edge.actorBehavior.status, ACTOR_STATUSES);
      const subjectStatus = labelOf(edge.subjectBehavior.status, SUBJECT_STATUSES);
      const label = [
        `${edge.edgeType || "state_transition"}`,
        `执行人：${edge.actorBehavior.time || "时间待确认"}·${edge.actorBehavior.action || "动作待确认"}·${actorStatus}`,
        `对象：${edge.subjectBehavior.time || "时间待确认"}·${subjectStatus}·${edge.subjectBehavior.action || "行为待确认"}`,
      ].join("<br/>");
      const arrow = ["recycle", "reentry"].includes(edge.edgeType) ? "-.->" : edge.edgeType === "outcome" ? "==>" : "-->";
      lines.push(`    ${edge.from} ${arrow}|"${escapeMermaid(label)}"| ${edge.to}`);
    });
    lines.push("    classDef entryNode fill:#fff2f4,stroke:#c8102e,color:#8f0d21");
    lines.push("    classDef outcomeNode fill:#edfaf4,stroke:#08794c,color:#08794c");
    lines.push("    classDef recycleNode fill:#fff8e8,stroke:#a15c00,color:#a15c00");
    doc.nodes.forEach(node => {
      if (node.nodeType === "entry") lines.push(`    class ${node.localId} entryNode`);
      if (["outcome", "terminal"].includes(node.nodeType)) lines.push(`    class ${node.localId} outcomeNode`);
      if (["recycle", "reentry"].includes(node.nodeType)) lines.push(`    class ${node.localId} recycleNode`);
    });
    return lines.join("\n");
  }

  const publicApi = {
    SCHEMA_VERSION,
    NODE_TYPES,
    EDGE_TYPES,
    defaultDocument,
    normalizeDocument,
    validateDocument,
    toExportDocument,
    toJSON,
    toMermaid,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = publicApi;
  }
  if (typeof window !== "undefined") {
    window.StrategyFlowDesigner = publicApi;
  }

  function browserInit() {
    const root = document.getElementById("strategyFlowDesigner");
    if (!root) return;

    const el = id => document.getElementById(id);
    const canvasShell = el("canvasShell");
    const canvasSize = el("canvasSize");
    const canvas = el("canvas");
    const nodeLayer = el("nodeLayer");
    const edgeLabelLayer = el("edgeLabelLayer");
    const edgeSvg = el("edgeSvg");
    const inspector = el("inspector");
    const toastEl = el("toast");
    let documentState = defaultDocument();
    let selected = null;
    let nodeDrag = null;
    let canvasPan = null;
    let connecting = null;
    let edgeLabelDrag = null;
    let lastCanvasClick = null;
    let toastTimer = null;
    let saveStatusTimer = null;
    let clickOrigin = null;
    const layoutState = { left: true, right: true, bottom: true, zoom: 1 };
    const CANVAS_BASE = { width: 4800, height: 3200 };
    const CANVAS_ZOOM_LIMITS = { min: 0.25, max: 1.5 };

    const NODE_TYPE_LABELS = new Map([
      ["entry", "开始进入"], ["process", "中间跟进"], ["wait", "等待观察"], ["outcome", "目标达成"],
      ["recycle", "收回重启"], ["reentry", "重新进入"], ["terminal", "流程结束"],
    ]);
    const EDGE_TYPE_LABELS = new Map([
      ["state_transition", "正常流转"], ["handoff", "责任人交接"], ["outcome", "达成结果"],
      ["recycle", "收回重启"], ["reentry", "重新进入"], ["exception", "异常处理"],
    ]);
    const SUBJECT_TYPE_LABELS = new Map([
      ["customer", "客群"], ["scene", "场景"], ["event", "事件"], ["activity", "活动"],
    ]);

    function toast(message, isError = false) {
      toastEl.textContent = message;
      toastEl.className = `toast show${isError ? " error" : ""}`;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.className = "toast"; }, 2600);
    }

    function setSaveStatus(text, tone = "saved") {
      const status = el("saveStatus");
      if (!status) return;
      status.textContent = text;
      status.className = `save-status${tone === "saved" ? "" : ` ${tone}`}`;
      clearTimeout(saveStatusTimer);
      if (tone === "saved") {
        saveStatusTimer = setTimeout(() => {
          status.textContent = "自动保存已开启";
          status.className = "save-status";
        }, 1800);
      }
    }

    function saveDraft(manual = false) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(documentState));
        setSaveStatus(manual ? "草稿已保存" : "已自动保存");
        return true;
      } catch (_) {
        // file:// privacy settings may disable localStorage; in-memory editing still works.
        setSaveStatus("本机存储不可用，请导出 JSON", "error");
        return false;
      }
    }

    function loadDraft() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        documentState = normalizeDocument(JSON.parse(raw));
        return true;
      } catch (_) {
        return false;
      }
    }

    function loadLayout() {
      try {
        const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        ["left", "right", "bottom"].forEach(name => {
          if (typeof saved[name] === "boolean") layoutState[name] = saved[name];
        });
        if (Number.isFinite(Number(saved?.zoom))) {
          layoutState.zoom = Math.min(
            CANVAS_ZOOM_LIMITS.max,
            Math.max(CANVAS_ZOOM_LIMITS.min, Number(saved.zoom)),
          );
        }
      } catch (_) {
        // UI preference is non-critical; fall back to showing all panels.
      }
      renderLayout(false);
    }

    function saveLayout() {
      try {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutState));
      } catch (_) {
        // Ignore private-mode storage failures.
      }
    }

    function renderLayout(redrawEdges = true) {
      root.classList.toggle("left-collapsed", !layoutState.left);
      root.classList.toggle("right-collapsed", !layoutState.right);
      root.classList.toggle("bottom-collapsed", !layoutState.bottom);
      const buttons = {
        left: el("toggleLeftPanelBtn"),
        right: el("toggleRightPanelBtn"),
        bottom: el("toggleBottomPanelBtn"),
      };
      Object.entries(buttons).forEach(([name, button]) => {
        button?.classList.toggle("on", layoutState[name]);
        if (button) button.setAttribute("aria-pressed", String(layoutState[name]));
      });
      if (redrawEdges) {
        requestAnimationFrame(() => {
          // Grid track transition changes the visible canvas area; redraw once
          // on the next frame so connectors stay attached to their cards.
          renderEdges();
        });
      }
    }

    function setPanelVisible(name, visible) {
      if (!["left", "right", "bottom"].includes(name)) return;
      layoutState[name] = visible;
      renderLayout();
      saveLayout();
    }

    function openInspectorFor(kind, id) {
      selected = { kind, id };
      if (!layoutState.right) setPanelVisible("right", true);
      renderAll();
      requestAnimationFrame(() => {
        inspector.querySelector("input, select, textarea")?.focus?.();
      });
    }

    function markRepeatedCanvasClick(kind, id) {
      const now = performance.now();
      const repeated = Boolean(
        lastCanvasClick
        && lastCanvasClick.kind === kind
        && lastCanvasClick.id === id
        && now - lastCanvasClick.at <= 450
      );
      lastCanvasClick = { kind, id, at: now };
      return repeated;
    }

    function applyCanvasZoom() {
      const zoom = layoutState.zoom;
      canvasSize.style.width = `${Math.round(CANVAS_BASE.width * zoom)}px`;
      canvasSize.style.height = `${Math.round(CANVAS_BASE.height * zoom)}px`;
      canvas.style.transform = `scale(${zoom})`;
      canvas.dataset.zoom = String(zoom);
      el("zoomLevel").textContent = `${Math.round(zoom * 100)}%`;
      el("zoomOutBtn").disabled = zoom <= CANVAS_ZOOM_LIMITS.min + Number.EPSILON;
      el("zoomInBtn").disabled = zoom >= CANVAS_ZOOM_LIMITS.max - Number.EPSILON;
      el("zoomResetBtn").disabled = Math.abs(zoom - 1) < .01;
    }

    function setCanvasZoom(nextZoom, anchorEvent) {
      const oldZoom = layoutState.zoom;
      const zoom = Math.min(
        CANVAS_ZOOM_LIMITS.max,
        Math.max(CANVAS_ZOOM_LIMITS.min, Number(nextZoom.toFixed(3))),
      );
      if (zoom === oldZoom) return;

      const shellRect = canvasShell.getBoundingClientRect();
      // Buttons zoom around the visible center; wheel zoom keeps the pointer's
      // logical canvas point stationary.
      const pointerX = anchorEvent
        ? anchorEvent.clientX - shellRect.left
        : shellRect.width / 2;
      const pointerY = anchorEvent
        ? anchorEvent.clientY - shellRect.top
        : shellRect.height / 2;
      const logicalX = (canvasShell.scrollLeft + pointerX) / oldZoom;
      const logicalY = (canvasShell.scrollTop + pointerY) / oldZoom;

      layoutState.zoom = zoom;
      applyCanvasZoom();
      canvasShell.scrollLeft = Math.max(
        0,
        Math.round(logicalX * zoom - pointerX),
      );
      canvasShell.scrollTop = Math.max(
        0,
        Math.round(logicalY * zoom - pointerY),
      );
      renderEdges();
      saveLayout();
    }

    function nextId(prefix, items) {
      return nextAutomaticId(prefix, items);
    }

    function defaultSubjectType() {
      return documentState.strategy.paradigm === "scene" ? "scene" : "customer";
    }

    function selectedObject() {
      if (!selected) return null;
      if (selected.kind === "node") {
        return { kind: "node", value: documentState.nodes.find(item => item.localId === selected.id) || null };
      }
      if (selected.kind === "edge") {
        return { kind: "edge", value: documentState.edges.find(item => item.localId === selected.id) || null };
      }
      if (selected.kind === "strategyAction") {
        return { kind: "strategyAction", value: documentState.strategyActions.find(item => item.localId === selected.id) || null };
      }
      if (selected.kind === "processAction") {
        return { kind: "processAction", value: documentState.processActions.find(item => item.localId === selected.id) || null };
      }
      return null;
    }

    function getPath(path) {
      const keys = path.split(".");
      const collectionName = keys.shift();
      if (collectionName === "strategy") {
        return keys.reduce((value, key) => value?.[key], documentState.strategy);
      }
      const collection = {
        nodes: documentState.nodes,
        edges: documentState.edges,
        strategyActions: documentState.strategyActions,
        processActions: documentState.processActions,
      }[collectionName];
      const object = collection?.find(item => item.localId === keys[0]);
      return keys.slice(1).reduce((value, key) => value?.[key], object);
    }

    function setPath(path, value) {
      const keys = path.split(".");
      const last = keys.pop();
      const collectionName = keys.shift();
      let remainingKeys;
      if (collectionName === "strategy") {
        remainingKeys = keys;
      } else {
        const collection = {
          nodes: documentState.nodes,
          edges: documentState.edges,
          strategyActions: documentState.strategyActions,
          processActions: documentState.processActions,
        }[collectionName];
        const localId = keys.shift();
        remainingKeys = keys;
        const target = collection?.find(item => item.localId === localId);
        if (!target) return;
        const parent = remainingKeys.reduce((object, key) => object?.[key], target);
        if (!parent) return;
        parent[last] = value;
        return;
      }
      const parent = remainingKeys.reduce((object, key) => object?.[key], documentState.strategy);
      if (!parent) return;
      parent[last] = value;
    }

    function canvasPoint(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / layoutState.zoom,
        y: (event.clientY - rect.top) / layoutState.zoom,
      };
    }

    function addNode(type) {
      const shellRect = canvasShell.getBoundingClientRect();
      const centerX = (canvasShell.scrollLeft + shellRect.width / 2) / layoutState.zoom;
      const centerY = (canvasShell.scrollTop + shellRect.height / 2) / layoutState.zoom;
      const x = Math.max(20, centerX - 125 + documentState.nodes.length * 18);
      const y = Math.max(20, centerY - 60 + documentState.nodes.length * 18);
      const node = normalizeNode({
        localId: nextId("n", documentState.nodes),
        nodeType: type,
        time: "待确认",
        executor: "系统",
        subject: { type: defaultSubjectType(), name: "待确认", state: "待确认" },
        displayName: "",
        layout: { x, y },
      }, documentState.nodes.length);
      documentState.nodes.push(node);
      selected = { kind: "node", id: node.localId };
      renderAll();
    }

    function addStrategyAction() {
      const current = selectedObject();
      const nodeId = current?.kind === "node" ? current.value.localId : documentState.nodes[0]?.localId || "";
      if (!nodeId) return toast("请先创建流程卡片", true);
      const node = documentState.nodes.find(item => item.localId === nodeId);
      const action = normalizeStrategyAction({
        localId: nextId("sa", documentState.strategyActions),
        nodeId,
        time: node?.time || "",
        subjectState: node?.subject.state || "",
        judge: "待确认",
        touchScene: "待确认",
        touchMethod: "待确认",
        theme: "待确认",
        goal: "待确认",
        hook: "待确认",
        copy: "待确认",
        metrics: ["待确认"],
      });
      documentState.strategyActions.push(action);
      selected = { kind: "strategyAction", id: action.localId };
      renderAll();
    }

    function addProcessAction() {
      const current = selectedObject();
      const nodeId = current?.kind === "node" ? current.value.localId : documentState.nodes[0]?.localId || "";
      if (!nodeId) return toast("请先创建流程卡片", true);
      const node = documentState.nodes.find(item => item.localId === nodeId);
      const action = normalizeProcessAction({
        localId: nextId("pa", documentState.processActions),
        nodeId,
        executor: node?.executor || "待确认",
        scene: "待确认",
        condition: "待确认",
        result: "待确认",
        action: "待确认",
        hook: "待确认",
        recipient: "待确认",
        metrics: ["待确认"],
      });
      documentState.processActions.push(action);
      selected = { kind: "processAction", id: action.localId };
      renderAll();
    }

    function connectNodes(fromId, toId) {
      if (!fromId || !toId || fromId === toId) return;
      const from = documentState.nodes.find(item => item.localId === fromId);
      const to = documentState.nodes.find(item => item.localId === toId);
      if (!from || !to) return;
      const edge = normalizeEdge({
        localId: nextId("e", documentState.edges),
        from: fromId,
        to: toId,
        edgeType: from.executor !== to.executor ? "handoff" : "state_transition",
        actorBehavior: { time: from.time, action: "待确认", status: "executed" },
        subjectBehavior: { time: from.time, action: "待确认", status: "happened" },
        confirmed: false,
        label: "",
      });
      if (["outcome", "terminal"].includes(to.nodeType)) edge.edgeType = "outcome";
      documentState.edges.push(edge);
      selected = { kind: "edge", id: edge.localId };
      renderAll();
    }

    function deleteSelected() {
      const current = selectedObject();
      if (!current?.value) return;
      const id = current.value.localId;
      if (current.kind === "node") {
        documentState.nodes = documentState.nodes.filter(item => item.localId !== id);
        documentState.edges = documentState.edges.filter(item => item.from !== id && item.to !== id);
        documentState.strategyActions = documentState.strategyActions.filter(item => item.nodeId !== id);
        documentState.processActions = documentState.processActions.filter(item => item.nodeId !== id);
      } else if (current.kind === "edge") {
        documentState.edges = documentState.edges.filter(item => item.localId !== id);
        documentState.strategyActions.forEach(item => { if (item.outgoingEdgeId === id) item.outgoingEdgeId = ""; });
        documentState.processActions.forEach(item => { if (item.outgoingEdgeId === id) item.outgoingEdgeId = ""; });
      } else if (current.kind === "strategyAction") {
        documentState.strategyActions = documentState.strategyActions.filter(item => item.localId !== id);
      } else if (current.kind === "processAction") {
        documentState.processActions = documentState.processActions.filter(item => item.localId !== id);
      }
      selected = null;
      renderAll();
    }

    function renderNodes() {
      nodeLayer.innerHTML = documentState.nodes.map(node => {
        const strategyActions = documentState.strategyActions.filter(item => item.nodeId === node.localId);
        const processActions = documentState.processActions.filter(item => item.nodeId === node.localId);
        const chips = [
          ...strategyActions.map(item => `<button type="button" class="action-chip strategy${selected?.kind === "strategyAction" && selected.id === item.localId ? " selected" : ""}" data-select-kind="strategyAction" data-select-id="${escapeHtml(item.localId)}">触达·${escapeHtml(item.theme || "待确认")}</button>`),
          ...processActions.map(item => `<button type="button" class="action-chip process${selected?.kind === "processAction" && selected.id === item.localId ? " selected" : ""}" data-select-kind="processAction" data-select-id="${escapeHtml(item.localId)}">跟进·${escapeHtml(item.action || "待确认")}</button>`),
        ].join("");
        return `<article class="node-card${selected?.kind === "node" && selected.id === node.localId ? " selected" : ""}" data-id="${escapeHtml(node.localId)}" data-type="${escapeHtml(node.nodeType)}" style="transform:translate(${node.layout.x}px,${node.layout.y}px)" id="node-${escapeHtml(node.localId)}">
          <div><span class="node-type">${NODE_TYPE_LABELS.get(node.nodeType) || node.nodeType}</span><span class="node-time">${escapeHtml(node.time || "时间待确认")}</span></div>
          <div class="node-executor">${escapeHtml(node.executor || "执行人待确认")}</div>
          <div class="node-subject">对象：${escapeHtml(SUBJECT_TYPE_LABELS.get(node.subject.type) || node.subject.type)}｜${escapeHtml(node.subject.name || "名称待确认")}</div>
          <div class="node-state-label">对象状态</div>
          <div class="node-state">${escapeHtml(node.subject.state || "待确认")}</div>
          <div class="node-id">自动编号 ${escapeHtml(node.localId)}</div>
          <div class="node-actions">${chips || "<span class='action-chip'>尚未添加业务内容</span>"}</div>
          <span class="node-port input" data-port="input" title="目标锚点"></span>
          <span class="node-port output" data-port="output" title="拖拽到目标卡片创建流转规则"></span>
        </article>`;
      }).join("");
    }

    function nodeBox(id) {
      const element = document.getElementById(`node-${id}`);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const base = canvas.getBoundingClientRect();
      const zoom = layoutState.zoom;
      return {
        x: (rect.left - base.left) / zoom,
        y: (rect.top - base.top) / zoom,
        w: rect.width / zoom,
        h: rect.height / zoom,
        cx: (rect.left - base.left + rect.width / 2) / zoom,
        cy: (rect.top - base.top + rect.height / 2) / zoom,
      };
    }

    function edgeGeometry(fromBox, toBox, slot = {}) {
      const routeOffset = Math.max(
        -NORMAL_OFFSET_LIMIT,
        Math.min(NORMAL_OFFSET_LIMIT, (slot.autoOffset ?? 0) + (slot.normalOffset ?? 0)),
      );
      const shiftedControl = (x, y, x1, y1, x2, y2) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const vector = Math.hypot(dx, dy) || 1;
        return {
          x: x + (-dy / vector) * routeOffset,
          y: y + (dx / vector) * routeOffset,
        };
      };

      // Parallel edges intentionally share physical card anchors. Their visual
      // separation comes from control-point offsets, not from split anchors.
      if (toBox.cx > fromBox.cx + 25) {
        const x1 = fromBox.x + fromBox.w;
        const y1 = fromBox.cy;
        const x2 = toBox.x;
        const y2 = toBox.cy;
        const spread = Math.max(78, Math.min(180, Math.abs(x2 - x1) * .45));
        const c1 = shiftedControl(x1 + spread, y1, x1, y1, x2, y2);
        const c2 = shiftedControl(x2 - spread, y2, x1, y1, x2, y2);
        return {
          x1, y1, x2, y2,
          routeOffset,
          d: `M${x1} ${y1} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${x2} ${y2}`,
        };
      }

      if (toBox.cx < fromBox.cx - 25) {
        const x1 = fromBox.x;
        const y1 = fromBox.cy;
        const x2 = toBox.x + toBox.w;
        const y2 = toBox.cy;
        const c1 = shiftedControl(x1 - 100, y1, x1, y1, x2, y2);
        const c2 = shiftedControl(x2 + 100, y2, x1, y1, x2, y2);
        return {
          x1, y1, x2, y2,
          routeOffset,
          d: `M${x1} ${y1} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${x2} ${y2}`,
        };
      }

      const down = toBox.cy >= fromBox.cy;
      const x1 = fromBox.cx;
      const y1 = down ? fromBox.y + fromBox.h : fromBox.y;
      const x2 = toBox.cx;
      const y2 = down ? toBox.y : toBox.y + toBox.h;
      const c1 = shiftedControl(x1, y1 + (down ? 88 : -88), x1, y1, x2, y2);
      const c2 = shiftedControl(x2, y2 + (down ? -88 : 88), x1, y1, x2, y2);
      return {
        x1, y1, x2, y2,
        routeOffset,
        d: `M${x1} ${y1} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${x2} ${y2}`,
      };
    }

    function buildEdgeSlots() {
      const outgoing = new Map();
      const incoming = new Map();
      documentState.edges.forEach(edge => {
        if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
        outgoing.get(edge.from).push(edge);
        if (!incoming.has(edge.to)) incoming.set(edge.to, []);
        incoming.get(edge.to).push(edge);
      });

      const slots = new Map();
      documentState.edges.forEach(edge => {
        const sourceEdges = outgoing.get(edge.from) || [edge];
        const targetEdges = incoming.get(edge.to) || [edge];
        const sourceIndex = Math.max(0, sourceEdges.findIndex(item => item.localId === edge.localId));
        const targetIndex = Math.max(0, targetEdges.findIndex(item => item.localId === edge.localId));
        const sourcePosition = sourceEdges.length <= 1
          ? 0
          : sourceIndex - (sourceEdges.length - 1) / 2;
        const targetPosition = targetEdges.length <= 1
          ? 0
          : targetIndex - (targetEdges.length - 1) / 2;
        const fanSize = Math.max(sourceEdges.length, targetEdges.length);
        const spacing = Math.min(56, 34 + (fanSize - 1) * 8);
        const autoOffset = Math.max(
          -120,
          Math.min(120, (sourcePosition + targetPosition) * spacing),
        );
        slots.set(edge.localId, {
          sourceIndex,
          sourceCount: sourceEdges.length,
          sourcePosition,
          targetIndex,
          targetCount: targetEdges.length,
          targetPosition,
          autoOffset,
        });
      });
      return slots;
    }

    function renderEdges() {
      edgeSvg.innerHTML = "";
      edgeLabelLayer.innerHTML = "";
      const marker = `<defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#605e5c"></path></marker></defs>`;
      const paths = [];
      const slots = buildEdgeSlots();
      const labelEntries = [];

      documentState.edges.forEach(edge => {
        const from = nodeBox(edge.from);
        const to = nodeBox(edge.to);
        if (!from || !to) return;
        const slot = {
          ...(slots.get(edge.localId) || {}),
          normalOffset: edge.layout.normalOffset,
        };
        const geometry = edgeGeometry(from, to, slot);
        const edgeSelected = selected?.kind === "edge" && selected.id === edge.localId;
        paths.push(`<path class="hit" data-edge-id="${escapeHtml(edge.localId)}" d="${geometry.d}" stroke="transparent" stroke-width="14" fill="none"><title>${escapeHtml(edge.label || edge.localId)}</title></path><path class="visible edge ${escapeHtml(edge.edgeType)}${edgeSelected ? " selected" : ""}" data-edge-id="${escapeHtml(edge.localId)}" d="${geometry.d}" marker-end="url(#arrowhead)"></path>`);
      });
      edgeSvg.innerHTML = marker + paths.join("");

      documentState.edges.forEach(edge => {
        const path = [...edgeSvg.querySelectorAll("path.visible")]
          .find(item => item.dataset.edgeId === edge.localId);
        if (!path) return;

        const length = path.getTotalLength();
        const point = path.getPointAtLength(length * .5);
        const before = path.getPointAtLength(Math.max(0, length * .47));
        const after = path.getPointAtLength(Math.min(length, length * .53));
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        const vector = Math.hypot(dx, dy) || 1;
        const slot = slots.get(edge.localId) || {};
        const routeOffset = slot.autoOffset + edge.layout.normalOffset;
        const fallbackSide = slot.sourcePosition || slot.targetPosition || 0;
        const direction = routeOffset !== 0
          ? Math.sign(routeOffset)
          : fallbackSide === 0 ? 1 : Math.sign(fallbackSide);
        const preferredDistance = 29 + Math.abs(routeOffset) * .08;
        const normalX = -dy / vector;
        const normalY = dx / vector;

        const div = document.createElement("div");
        div.className = `edge-label${selected?.kind === "edge" && selected.id === edge.localId ? " selected" : ""}`;
        div.dataset.edgeId = edge.localId;
        div.title = "拖拽标签可沿法线方向调整曲线间距";
        const actorStatus = labelOf(edge.actorBehavior.status, ACTOR_STATUSES);
        const objectStatus = labelOf(edge.subjectBehavior.status, SUBJECT_STATUSES);
        div.innerHTML = `
          <b>${escapeHtml(edge.label || EDGE_TYPE_LABELS.get(edge.edgeType) || edge.edgeType)}${edge.confirmed ? " · 已确认" : " · 待确认"}</b>
          <span>执行人：${escapeHtml(edge.actorBehavior.time || "时间待确认")} ${escapeHtml(actorStatus)} ${escapeHtml(edge.actorBehavior.action || "动作待确认")}</span>
          <span>对象：${escapeHtml(edge.subjectBehavior.time || "时间待确认")} ${escapeHtml(objectStatus)} ${escapeHtml(edge.subjectBehavior.action || "行为待确认")}</span>`;
        edgeLabelLayer.appendChild(div);
        labelEntries.push({
          div,
          point,
          normalX,
          normalY,
          direction,
          preferredDistance,
        });
      });

      // Labels follow their own curve normal. If deterministic fan positions
      // still collide, push the later label further along that normal.
      const placedBoxes = [];
      const overlaps = (box) => placedBoxes.some(placed =>
        box.left < placed.right + 4
        && box.right > placed.left - 4
        && box.top < placed.bottom + 4
        && box.bottom > placed.top - 4
      );
      labelEntries.forEach(entry => {
        const width = entry.div.offsetWidth || 220;
        const height = entry.div.offsetHeight || 58;
        const candidates = [];
        for (const sign of [entry.direction, -entry.direction]) {
          for (let distance = entry.preferredDistance; distance <= 300; distance += 22) {
            const x = entry.point.x + entry.normalX * distance * sign;
            const y = entry.point.y + entry.normalY * distance * sign;
            const box = { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
            if (box.left < 0 || box.top < 0 || box.right > CANVAS_BASE.width || box.bottom > CANVAS_BASE.height) continue;
            candidates.push({ x, y, box });
            if (!overlaps(box)) break;
          }
        }
        const selectedPosition = candidates.find(candidate => !overlaps(candidate.box))
          || candidates[0]
          || {
            x: entry.point.x + entry.normalX * entry.preferredDistance * entry.direction,
            y: entry.point.y + entry.normalY * entry.preferredDistance * entry.direction,
          };
        entry.div.style.left = `${selectedPosition.x}px`;
        entry.div.style.top = `${selectedPosition.y}px`;
        placedBoxes.push({
          left: selectedPosition.x - width / 2,
          right: selectedPosition.x + width / 2,
          top: selectedPosition.y - height / 2,
          bottom: selectedPosition.y + height / 2,
        });
      });
    }

    function renderCanvas() {
      applyCanvasZoom();
      renderNodes();
      renderEdges();
    }

    function optionsHtml(options, value) {
      return options.map(([value_, label]) => `<option value="${escapeHtml(value_)}"${value_ === value ? " selected" : ""}>${escapeHtml(label)}</option>`).join("");
    }

    function inputField(label, path, value, type = "text", placeholder = "") {
      return `<label class="field"><span>${escapeHtml(label)}</span><input data-bind="${escapeHtml(path)}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></label>`;
    }

    function selectField(label, path, value, options) {
      return `<label class="field"><span>${escapeHtml(label)}</span><select data-bind="${escapeHtml(path)}">${optionsHtml(options, value)}</select></label>`;
    }

    function textareaField(label, path, value, placeholder = "") {
      return `<label class="field"><span>${escapeHtml(label)}</span><textarea data-bind="${escapeHtml(path)}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></label>`;
    }

    function checkboxField(label, path, checked) {
      return `<label class="checkbox-field"><input data-bind="${escapeHtml(path)}" type="checkbox"${checked ? " checked" : ""}>${escapeHtml(label)}</label>`;
    }

    function metricsField(label, path, values) {
      return textareaField(label, path, values.join("\n"), "每行一个指标；缺失填“待确认”");
    }

    function systemIdField(label, value, note) {
      return `<div class="system-field"><span>${escapeHtml(label)}（自动生成）</span><b>${escapeHtml(value || "待生成")}</b><small>${escapeHtml(note)}</small></div>`;
    }

    function renderStrategyInspector() {
      const strategy = documentState.strategy;
      inspector.innerHTML = `<div class="side-block">
        <div class="inspector-head"><div><b>策略基础信息</b><small>先填业务信息，再画流程。</small></div></div>
        <div class="inspector-form">
          ${inputField("策略名称", "strategy.strategyName", strategy.strategyName)}
          ${inputField("门户策略编号", "strategy.strategyId", strategy.strategyId, "text", "首次提交留空，注册后回填")}
          ${inputField("主要负责人", "strategy.owner", strategy.owner)}
          ${inputField("提交人", "strategy.submitter", strategy.submitter)}
          ${inputField("业务场景", "strategy.businessScene", strategy.businessScene)}
          ${inputField("策略类型", "strategy.strategyType", strategy.strategyType)}
          ${inputField("策略子类", "strategy.strategySubtype", strategy.strategySubtype)}
          ${selectField("版本状态", "strategy.versionStatus", strategy.versionStatus, [["draft", "draft"], ["candidate", "candidate"], ["registered", "registered"], ["deprecated", "deprecated"]])}
        </div>
      </div>`;
    }

    function renderNodeInspector(node) {
      inspector.innerHTML = `<div class="side-block">
        <div class="inspector-head">
          <div><b>流程卡片</b><small>系统编号自动生成</small></div>
          <button class="btn danger small" data-action="delete" type="button">删除</button>
        </div>
        <div class="inspector-form">
          <div class="wide">${systemIdField("卡片系统编号", node.localId, "系统自动维护，业务人员不需要填写或修改。")}</div>
          ${selectField("卡片类型", `nodes.${node.localId}.nodeType`, node.nodeType, NODE_TYPES.map(value => [value, NODE_TYPE_LABELS.get(value) || value]))}
          ${inputField("时间 / 阶段", `nodes.${node.localId}.time`, node.time, "text", "填写业务时间表达式")}
          ${inputField("负责执行的角色 / 人", `nodes.${node.localId}.executor`, node.executor)}
          <div class="wide field-section">
            <h3>对象</h3>
            ${selectField("对象类型", `nodes.${node.localId}.subject.type`, node.subject.type, SUBJECT_TYPES.map(value => [value, SUBJECT_TYPE_LABELS.get(value) || value]))}
            ${inputField("对象名称", `nodes.${node.localId}.subject.name`, node.subject.name, "text", "例如：目标客群名称、场景名称、事件名称")}
            <p class="field-help">先选择对象类型，再填写该类型下的具体对象名称。对象类型回答“这是哪一类对象”，对象名称回答“具体是哪一个”。</p>
          </div>
          <div class="wide field-section">
            <h3>对象状态</h3>
            ${inputField("对象状态", `nodes.${node.localId}.subject.state`, node.subject.state, "text", "例如：未触达、已触达、已转化")}
            <p class="field-help">对象状态是对象进入这张卡片时的业务状态。它描述“现在处于什么阶段”，不是对象类别，也不是执行人的处理进度。</p>
          </div>
          ${inputField("卡片展示名", `nodes.${node.localId}.displayName`, node.displayName, "text", "不填时按执行人和状态展示")}
        </div>
      </div>
      <div class="side-block">
        <h2 class="side-title">添加业务内容</h2>
        <div class="node-buttons">
          <button class="btn wide" type="button" data-action="add-strategy">新增客户触达内容</button>
          <button class="btn wide" type="button" data-action="add-process">新增执行跟进动作</button>
        </div>
      </div>`;
    }

    function renderEdgeInspector(edge) {
      inspector.innerHTML = `<div class="side-block">
        <div class="inspector-head">
          <div><b>流转规则</b><small>从一张卡片进入下一张卡片的业务条件</small></div>
          <button class="btn danger small" data-action="delete" type="button">删除</button>
        </div>
        <div class="inspector-form">
          <div class="wide">${systemIdField("规则系统编号", edge.localId, "系统自动维护；导出 JSON 时用于保持引用关系。")}</div>
          ${selectField("流转类型", `edges.${edge.localId}.edgeType`, edge.edgeType, EDGE_TYPES.map(value => [value, EDGE_TYPE_LABELS.get(value) || value]))}
          ${inputField("互斥分组", `edges.${edge.localId}.mutexGroup`, edge.mutexGroup, "text", "同一组里只能走一条分支")}
          ${inputField("业务说明", `edges.${edge.localId}.label`, edge.label, "text", "给业务同事看的短说明")}
          ${checkboxField("业务已确认", `edges.${edge.localId}.confirmed`, edge.confirmed)}
          ${checkboxField("客户离开原状态", `edges.${edge.localId}.overwriteSource`, edge.overwriteSource)}
        </div>
      </div>
      <div class="side-block">
        <h2 class="side-title">执行人做了什么</h2>
        <div class="inspector-form field-grid">
          ${inputField("时间", `edges.${edge.localId}.actorBehavior.time`, edge.actorBehavior.time, "text", "填写业务时间表达式")}
          ${selectField("执行状态", `edges.${edge.localId}.actorBehavior.status`, edge.actorBehavior.status, ACTOR_STATUSES)}
          <div class="field-grid wide">${inputField("执行动作", `edges.${edge.localId}.actorBehavior.action`, edge.actorBehavior.action)}</div>
        </div>
        <h2 class="side-title" style="margin-top:14px">对象发生了什么</h2>
        <div class="inspector-form field-grid">
          ${inputField("时间", `edges.${edge.localId}.subjectBehavior.time`, edge.subjectBehavior.time, "text", "填写业务时间表达式")}
          ${selectField("发生状态", `edges.${edge.localId}.subjectBehavior.status`, edge.subjectBehavior.status, SUBJECT_STATUSES)}
          <div class="field-grid wide">${inputField("发生的行为", `edges.${edge.localId}.subjectBehavior.action`, edge.subjectBehavior.action)}</div>
        </div>
      </div>`;
    }

    function renderActionInspector(kind, action) {
      const nodeOptions = documentState.nodes.map(node => [node.localId, `${node.executor || "执行人待确认"}｜${node.subject.name || "对象待确认"}｜${node.subject.state || "状态待确认"}`]);
      const edgeOptions = [["", "暂不绑定流转规则"], ...documentState.edges.filter(edge => edge.from === action.nodeId).map(edge => [edge.localId, `规则｜${edge.actorBehavior.action || "待确认"}`])];
      if (kind === "strategyAction") {
        inspector.innerHTML = `<div class="side-block">
          <div class="inspector-head"><div><b>客户触达内容</b><small>对客户说什么、用什么权益</small></div><button class="btn danger small" data-action="delete" type="button">删除</button></div>
          <div class="inspector-form field-grid">
            <div class="wide">${systemIdField("内容系统编号", action.localId, "系统自动维护，不需要业务填写。")}</div>
            ${selectField("所属流程卡片", `strategyActions.${action.localId}.nodeId`, action.nodeId, nodeOptions)}
            ${selectField("绑定的流转规则", `strategyActions.${action.localId}.outgoingEdgeId`, action.outgoingEdgeId, edgeOptions)}
            ${inputField("时间", `strategyActions.${action.localId}.time`, action.time, "text", "填写业务时间表达式")}
            ${inputField("对象状态", `strategyActions.${action.localId}.subjectState`, action.subjectState, "text", "该触达内容适用的对象状态")}
            ${inputField("进入条件", `strategyActions.${action.localId}.judge`, action.judge)}
            ${inputField("触达场景", `strategyActions.${action.localId}.touchScene`, action.touchScene)}
            ${inputField("触达方式", `strategyActions.${action.localId}.touchMethod`, action.touchMethod)}
            ${inputField("话术主题", `strategyActions.${action.localId}.theme`, action.theme)}
            ${inputField("核心目标", `strategyActions.${action.localId}.goal`, action.goal)}
            ${inputField("核心抓手", `strategyActions.${action.localId}.hook`, action.hook)}
            <div class="wide">${checkboxField("是否带链接", `strategyActions.${action.localId}.hasLink`, action.hasLink)}</div>
            <div class="wide">${textareaField("文案", `strategyActions.${action.localId}.copy`, action.copy)}</div>
            <div class="wide">${metricsField("考察指标", `strategyActions.${action.localId}.metrics`, action.metrics)}</div>
          </div>
        </div>`;
      } else {
        inspector.innerHTML = `<div class="side-block">
          <div class="inspector-head"><div><b>执行跟进动作</b><small>谁执行、执行什么、交给谁</small></div><button class="btn danger small" data-action="delete" type="button">删除</button></div>
          <div class="inspector-form field-grid">
            <div class="wide">${systemIdField("动作系统编号", action.localId, "系统自动维护，不需要业务填写。")}</div>
            ${selectField("所属流程卡片", `processActions.${action.localId}.nodeId`, action.nodeId, nodeOptions)}
            ${selectField("绑定的流转规则", `processActions.${action.localId}.outgoingEdgeId`, action.outgoingEdgeId, edgeOptions)}
            ${inputField("执行人 / 角色", `processActions.${action.localId}.executor`, action.executor)}
            ${inputField("执行场景", `processActions.${action.localId}.scene`, action.scene)}
            ${inputField("执行抓手", `processActions.${action.localId}.hook`, action.hook)}
            ${inputField("接受对象", `processActions.${action.localId}.recipient`, action.recipient)}
            <div class="wide">${textareaField("什么情况下执行", `processActions.${action.localId}.condition`, action.condition)}</div>
            <div class="wide">${textareaField("执行后的结果", `processActions.${action.localId}.result`, action.result)}</div>
            <div class="wide">${textareaField("具体执行动作", `processActions.${action.localId}.action`, action.action)}</div>
            <div class="wide">${metricsField("过程管理指标", `processActions.${action.localId}.metrics`, action.metrics)}</div>
          </div>
        </div>`;
      }
    }

    function renderInspector() {
      const current = selectedObject();
      if (!current?.value) {
        selected = null;
        renderStrategyInspector();
      } else if (current.kind === "node") {
        renderNodeInspector(current.value);
      } else if (current.kind === "edge") {
        renderEdgeInspector(current.value);
      } else {
        renderActionInspector(current.kind, current.value);
      }
    }

    function renderValidation() {
      const result = validateDocument(documentState);
      const statusEl = el("validationStatus");
      statusEl.textContent = result.status === "ready_to_submit" ? "ready_to_submit" : "draft";
      statusEl.className = `status ${result.status === "ready_to_submit" ? "ready" : "draft"}`;
      const issues = [
        ...result.errors.map(item => ({ ...item, severity: "error" })),
        ...result.warnings.map(item => ({ ...item, severity: "warning" })),
      ];
      el("issueList").innerHTML = issues.length ? issues.map(item => `<div class="issue${item.severity === "warning" ? " warning" : ""}"><b>${escapeHtml(item.code)}</b>${escapeHtml(item.message)}<br><span>${escapeHtml(item.path)}</span></div>`).join("") : `<div class="empty-issues">没有校验问题。</div>`;
      el("jsonOutput").value = toJSON(documentState);
      el("mermaidOutput").value = toMermaid(documentState);
    }

    function renderParadigm() {
      document.querySelectorAll("#paradigmSwitch button").forEach(button => {
        button.classList.toggle("on", button.dataset.paradigm === documentState.strategy.paradigm);
      });
    }

    function renderSoft() {
      renderCanvas();
      renderParadigm();
      renderValidation();
      saveDraft();
    }

    function renderAll() {
      renderSoft();
      renderInspector();
    }

    function autoLayout() {
      const incoming = new Map(documentState.nodes.map(node => [node.localId, 0]));
      const outgoing = new Map(documentState.nodes.map(node => [node.localId, []]));
      documentState.edges.forEach(edge => {
        if (outgoing.has(edge.from) && incoming.has(edge.to)) {
          incoming.set(edge.to, incoming.get(edge.to) + 1);
          outgoing.get(edge.from).push(edge.to);
        }
      });
      const queue = documentState.nodes.filter(node => incoming.get(node.localId) === 0).map(node => node.localId);
      const seen = new Set();
      const levels = [];
      while (queue.length) {
        const level = [...queue];
        queue.length = 0;
        levels.push(level);
        level.forEach(id => {
          seen.add(id);
          outgoing.get(id).forEach(target => {
            incoming.set(target, Math.max(0, incoming.get(target) - 1));
            if (!seen.has(target) && incoming.get(target) === 0) queue.push(target);
          });
        });
      }
      const remaining = documentState.nodes.map(node => node.localId).filter(id => !seen.has(id));
      if (remaining.length) levels.push(remaining);
      levels.forEach((level, levelIndex) => {
        level.forEach((id, index) => {
          const node = documentState.nodes.find(item => item.localId === id);
          if (node) node.layout = { x: 80 + levelIndex * 360, y: 80 + index * 180 };
        });
      });
      canvasShell.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      renderAll();
    }

    function applyImport(raw, silent = false) {
      try {
        const parsed = JSON.parse(raw);
        documentState = normalizeDocument(parsed);
        selected = null;
        renderAll();
        const result = validateDocument(documentState);
        if (!silent) toast(result.errors.length ? "已导入草稿；仍有校验错误" : "导入成功，校验通过");
      } catch (error) {
        if (!silent) toast(`JSON 解析失败：${error.message}`, true);
      }
    }

    async function copyText(text, message) {
      try {
        await navigator.clipboard.writeText(text);
        toast(message);
      } catch (_) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        toast(message);
      }
    }

    function download(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    inspector.addEventListener("input", event => {
      const target = event.target;
      const path = target.dataset?.bind;
      if (!path) return;
      const current = selectedObject();
      if (target.type === "checkbox") {
        setPath(path, target.checked);
      } else if (path.endsWith(".metrics")) {
        setPath(path, target.value.split(/\n|(、)/).map(clean).filter(Boolean));
      } else {
        setPath(path, target.value);
      }
      if (path.endsWith(".localId") && current?.value) {
        const nextId = clean(target.value);
        const oldId = current.value.localId;
        if (nextId && nextId !== oldId) {
          if (current.kind === "node") {
            documentState.edges.forEach(edge => {
              if (edge.from === oldId) edge.from = nextId;
              if (edge.to === oldId) edge.to = nextId;
            });
            documentState.strategyActions.forEach(action => {
              if (action.nodeId === oldId) action.nodeId = nextId;
            });
            documentState.processActions.forEach(action => {
              if (action.nodeId === oldId) action.nodeId = nextId;
            });
          } else if (current.kind === "edge") {
            documentState.strategyActions.forEach(action => {
              if (action.outgoingEdgeId === oldId) action.outgoingEdgeId = nextId;
            });
            documentState.processActions.forEach(action => {
              if (action.outgoingEdgeId === oldId) action.outgoingEdgeId = nextId;
            });
          }
          selected = { kind: current.kind, id: nextId };
        }
      }
      renderSoft();
    });

    inspector.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (button.dataset.action === "delete") deleteSelected();
      if (button.dataset.action === "add-strategy") addStrategyAction();
      if (button.dataset.action === "add-process") addProcessAction();
    });

    nodeLayer.addEventListener("click", event => {
      const chip = event.target.closest("[data-select-kind]");
      if (chip) {
        selected = { kind: chip.dataset.selectKind, id: chip.dataset.selectId };
        renderAll();
        return;
      }
      const card = event.target.closest(".node-card");
      if (card) {
        selected = { kind: "node", id: card.dataset.id };
        renderAll();
      }
    });

    nodeLayer.addEventListener("dblclick", event => {
      const card = event.target.closest(".node-card");
      if (!card) return;
      event.preventDefault();
      openInspectorFor("node", card.dataset.id);
    });

    nodeLayer.addEventListener("pointerdown", event => {
      if (event.button !== 0 || event.target.closest(".action-chip")) return;
      const port = event.target.closest(".node-port.output");
      if (port) {
        event.stopPropagation();
        const card = port.closest(".node-card");
        connecting = { from: card.dataset.id, point: canvasPoint(event) };
        renderEdges();
        return;
      }
      const card = event.target.closest(".node-card");
      if (!card) return;
      const node = documentState.nodes.find(item => item.localId === card.dataset.id);
      if (!node) return;
      if (markRepeatedCanvasClick("node", node.localId)) {
        openInspectorFor("node", node.localId);
        event.preventDefault();
        return;
      }
      selected = { kind: "node", id: node.localId };
      renderInspector();
      renderCanvas();
      const point = canvasPoint(event);
      nodeDrag = { id: node.localId, offsetX: point.x - node.layout.x, offsetY: point.y - node.layout.y };
      card.classList.add("dragging");
      try { card.setPointerCapture?.(event.pointerId); } catch (_) { /* pointer capture is best-effort */ }
      event.preventDefault();
    });

    edgeSvg.addEventListener("pointerdown", event => {
      const path = event.target.closest("path.hit");
      if (!path) return;
      selected = { kind: "edge", id: path.dataset.edgeId };
      renderAll();
    });

    edgeLabelLayer.addEventListener("pointerdown", event => {
      const label = event.target.closest(".edge-label");
      if (!label) return;
      const edgeId = label.dataset.edgeId;
      const edge = documentState.edges.find(item => item.localId === edgeId);
      if (!edge) return;
      if (markRepeatedCanvasClick("edge", edgeId)) {
        openInspectorFor("edge", edgeId);
        event.preventDefault();
        return;
      }
      selected = { kind: "edge", id: label.dataset.edgeId };
      const path = [...edgeSvg.querySelectorAll("path.visible")]
        .find(item => item.dataset.edgeId === edgeId);
      if (path) {
        const length = path.getTotalLength();
        const before = path.getPointAtLength(Math.max(0, length * .47));
        const after = path.getPointAtLength(Math.min(length, length * .53));
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        const vector = Math.hypot(dx, dy) || 1;
        edgeLabelDrag = {
          id: edgeId,
          startX: event.clientX,
          startY: event.clientY,
          startOffset: edge.layout.normalOffset,
          normalX: -dy / vector,
          normalY: dx / vector,
        };
        edgeLabelLayer.classList.add("dragging");
        try { edgeLabelLayer.setPointerCapture?.(event.pointerId); } catch (_) { /* pointer capture is best-effort */ }
        event.preventDefault();
      }
      renderAll();
    });

    edgeLabelLayer.addEventListener("dblclick", event => {
      const label = event.target.closest(".edge-label");
      if (!label) return;
      event.preventDefault();
      openInspectorFor("edge", label.dataset.edgeId);
    });

    canvasShell.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      if (event.target.closest(".node-card") || event.target.closest(".edge-label") || event.target.closest("path.hit")) return;
      canvasPan = { x: event.clientX, y: event.clientY, left: canvasShell.scrollLeft, top: canvasShell.scrollTop };
      canvasShell.classList.add("dragging");
    });

    document.addEventListener("pointermove", event => {
      if (
        clickOrigin
        && Math.hypot(event.clientX - clickOrigin.x, event.clientY - clickOrigin.y) > 3
      ) {
        clickOrigin.moved = true;
      }
      if (edgeLabelDrag) {
        const edge = documentState.edges.find(item => item.localId === edgeLabelDrag.id);
        if (edge) {
          const screenDeltaX = event.clientX - edgeLabelDrag.startX;
          const screenDeltaY = event.clientY - edgeLabelDrag.startY;
          const logicalNormalDelta = (
            screenDeltaX * edgeLabelDrag.normalX
            + screenDeltaY * edgeLabelDrag.normalY
          ) / layoutState.zoom;
          edge.layout.normalOffset = Math.max(
            -NORMAL_OFFSET_LIMIT,
            Math.min(
              NORMAL_OFFSET_LIMIT,
              Math.round(edgeLabelDrag.startOffset + logicalNormalDelta),
            ),
          );
          renderEdges();
        }
      } else if (nodeDrag) {
        const point = canvasPoint(event);
        const node = documentState.nodes.find(item => item.localId === nodeDrag.id);
        if (node) {
          node.layout.x = Math.max(0, Math.round(point.x - nodeDrag.offsetX));
          node.layout.y = Math.max(0, Math.round(point.y - nodeDrag.offsetY));
          const card = document.getElementById(`node-${node.localId}`);
          if (card) card.style.transform = `translate(${node.layout.x}px,${node.layout.y}px)`;
          renderEdges();
        }
      } else if (connecting) {
        connecting.point = canvasPoint(event);
        const existing = edgeSvg.querySelector("path.temp");
        if (!existing) {
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("class", "temp");
          edgeSvg.appendChild(path);
        }
        const from = nodeBox(connecting.from);
        const point = connecting.point;
        if (from) {
          edgeSvg.querySelector("path.temp").setAttribute("d", `M${from.x + from.w} ${from.cy} C ${from.x + from.w + 70} ${from.cy}, ${point.x - 70} ${point.y}, ${point.x} ${point.y}`);
        }
      } else if (canvasPan) {
        canvasShell.scrollLeft = canvasPan.left - (event.clientX - canvasPan.x);
        canvasShell.scrollTop = canvasPan.top - (event.clientY - canvasPan.y);
      }
    });

    document.addEventListener("pointerup", event => {
      if (edgeLabelDrag) {
        edgeLabelDrag = null;
        edgeLabelLayer.classList.remove("dragging");
        renderValidation();
        saveDraft();
      }
      if (nodeDrag) {
        const card = document.getElementById(`node-${nodeDrag.id}`);
        card?.classList.remove("dragging");
        nodeDrag = null;
        renderValidation();
        saveDraft();
      }
      if (connecting) {
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".node-card");
        if (target?.dataset?.id) {
          const from = connecting.from;
          connecting = null;
          connectNodes(from, target.dataset.id);
        } else {
          connecting = null;
          renderEdges();
        }
      }
      canvasPan = null;
      canvasShell.classList.remove("dragging");
    });

    document.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      clickOrigin = {
        x: event.clientX,
        y: event.clientY,
        moved: false,
      };
    });

    document.addEventListener("click", event => {
      const origin = clickOrigin;
      clickOrigin = null;
      // Dragging out of an input/select is still followed by a click on the
      // element under the pointer in some browsers. That is not an intentional
      // background click, so keep the current inspector selection.
      if (origin?.moved) return;
      if (event.target.closest(".topbar") || event.target.closest(".side-panel") || event.target.closest(".bottom-panel")) return;
      if (event.target.closest(".node-card") || event.target.closest(".edge-label") || event.target.closest("path.hit")) return;
      selected = null;
      renderAll();
    });

    el("nodeButtons").addEventListener("click", event => {
      const button = event.target.closest("[data-node-type]");
      if (button) addNode(button.dataset.nodeType);
    });
    el("toggleLeftPanelBtn").addEventListener("click", event => setPanelVisible("left", !layoutState.left));
    el("toggleRightPanelBtn").addEventListener("click", event => setPanelVisible("right", !layoutState.right));
    el("toggleBottomPanelBtn").addEventListener("click", event => setPanelVisible("bottom", !layoutState.bottom));
    el("paradigmSwitch").addEventListener("click", event => {
      const button = event.target.closest("[data-paradigm]");
      if (!button) return;
      documentState.strategy.paradigm = button.dataset.paradigm;
      renderSoft();
      renderInspector();
    });
    el("addStrategyActionBtn").addEventListener("click", addStrategyAction);
    el("addProcessActionBtn").addEventListener("click", addProcessAction);
    el("autoLayoutBtn").addEventListener("click", autoLayout);
    el("saveDraftBtn").addEventListener("click", () => {
      if (saveDraft(true)) toast("草稿已保存到本机浏览器");
      else toast("本机存储不可用，请导出 JSON 保存", true);
    });
    el("zoomInBtn").addEventListener("click", () => setCanvasZoom(layoutState.zoom + .1));
    el("zoomOutBtn").addEventListener("click", () => setCanvasZoom(layoutState.zoom - .1));
    el("zoomResetBtn").addEventListener("click", () => setCanvasZoom(1));
    canvasShell.addEventListener("wheel", event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : 1;
      const factor = Math.exp(-event.deltaY * unit * .0015);
      setCanvasZoom(layoutState.zoom * factor, event);
    }, { passive: false });
    el("loadExampleBtn").addEventListener("click", () => applyImport(JSON.stringify(sampleDocument())));
    el("resetBtn").addEventListener("click", () => {
      if (!window.confirm("确定清空当前草稿？此操作不可撤销。")) return;
      documentState = defaultDocument();
      selected = null;
      renderAll();
      toast("已清空草稿");
    });
    el("importBtn").addEventListener("click", () => el("importFile").click());
    el("importFile").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      applyImport(await file.text());
      event.target.value = "";
    });
    el("applyImportBtn").addEventListener("click", () => applyImport(el("importText").value));
    el("formatImportBtn").addEventListener("click", () => {
      try {
        const parsed = JSON.parse(el("importText").value);
        el("importText").value = JSON.stringify(parsed, null, 2);
        const result = validateDocument(normalizeDocument(parsed));
        toast(result.errors.length ? `仍有 ${result.errors.length} 个错误` : "结构可解析，校验通过");
      } catch (error) {
        toast(`JSON 解析失败：${error.message}`, true);
      }
    });
    el("copyJsonBtn").addEventListener("click", () => copyText(toJSON(documentState), "JSON 已复制"));
    el("copyJsonBottomBtn").addEventListener("click", () => copyText(toJSON(documentState), "JSON 已复制"));
    el("copyMermaidBtn").addEventListener("click", () => copyText(toMermaid(documentState), "Mermaid 已复制"));
    const exportName = extension => `${clean(documentState.strategy.strategyName) || "strategy-flow"}-${SCHEMA_VERSION.split("/").pop()}.${extension}`;
    el("downloadJsonBtn").addEventListener("click", () => download(exportName("json"), toJSON(documentState), "application/json"));
    el("downloadMermaidBtn").addEventListener("click", () => download(exportName("mmd"), toMermaid(documentState), "text/plain"));
    document.querySelector(".panel-tabs").addEventListener("click", event => {
      const button = event.target.closest("[data-panel]");
      if (!button) return;
      document.querySelectorAll(".panel-tabs button").forEach(item => item.classList.toggle("on", item === button));
      document.querySelectorAll(".panel-view").forEach(item => item.classList.toggle("on", item.id === button.dataset.panel));
    });

    function sampleDocument() {
      return normalizeDocument({
        schemaVersion: SCHEMA_VERSION,
        strategy: {
          strategyName: "通用客群激活策略",
          paradigm: "customer",
          owner: "张三",
          submitter: "李四",
          businessScene: "用户激活",
          strategyType: "用户激活",
          strategySubtype: "通用客群激活策略",
          version: "0.1",
        },
        nodes: [
          { localId: "n1", nodeType: "entry", time: "启动日", executor: "系统", subject: { type: "customer", name: "通用目标客群", state: "未触达" }, layout: { x: 80, y: 150 } },
          { localId: "n2", nodeType: "process", time: "启动后1日", executor: "系统", subject: { type: "customer", name: "通用目标客群", state: "已触达" }, layout: { x: 440, y: 150 } },
          { localId: "n3", nodeType: "outcome", time: "观察期结束前", executor: "责任执行人", subject: { type: "customer", name: "通用目标客群", state: "已转化" }, layout: { x: 800, y: 150 } },
        ],
        edges: [
          { localId: "e1", from: "n1", to: "n2", edgeType: "state_transition", actorBehavior: { time: "启动日", action: "多渠道触达", status: "executed" }, subjectBehavior: { time: "启动日", action: "点击链接", status: "happened" }, confirmed: true, mutexGroup: "g1", label: "点击后进入已触达" },
          { localId: "e2", from: "n2", to: "n3", edgeType: "handoff", actorBehavior: { time: "观察期结束前", action: "人工跟进", status: "executed" }, subjectBehavior: { time: "观察期结束前", action: "完成转化", status: "happened" }, confirmed: true, mutexGroup: "g2", label: "跟进并完成转化" },
        ],
        strategyActions: [
          { localId: "sa1", nodeId: "n1", outgoingEdgeId: "e1", time: "启动日", subjectState: "未触达", judge: "无前置判断（流程入口）", touchScene: "多渠道触达", touchMethod: "按实际渠道填写", theme: "引导完成关键行为", goal: "引导完成关键行为", hook: "通用权益", copy: "【通用示例文案】请按实际策略替换。", hasLink: true, metrics: ["触达数", "点击数", "点击率"] },
        ],
        processActions: [
          { localId: "pa1", nodeId: "n2", outgoingEdgeId: "", executor: "系统", scene: "按实际场景填写", condition: "客户已触达且需要人工跟进", result: "线索转交责任执行人", action: "转交线索给责任执行人", hook: "待确认", recipient: "责任执行人", metrics: ["任务数"] },
        ],
      });
    }

    if (!loadDraft()) documentState = sampleDocument();
    loadLayout();
    renderAll();
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", browserInit);
    else browserInit();
  }
})();
