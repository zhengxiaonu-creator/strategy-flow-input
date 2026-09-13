/*
 * EBSCN Strategy Flow Designer MVP.
 * Pure functions are kept at the top so Node tests can require this file; the
 * browser app is initialized only when the root element exists.
 */
(function () {
  "use strict";

  const SCHEMA_NAMESPACE = "strategy-flow-input";
  const SCHEMA_VERSION_0_1 = "strategy-flow-input/0.1";
  const SCHEMA_VERSION_0_2 = "strategy-flow-input/0.2";
  const SCHEMA_VERSION_0_3 = "strategy-flow-input/0.3";
  const SCHEMA_VERSION_0_4 = "strategy-flow-input/0.4";
  const SCHEMA_VERSION_0_5 = "strategy-flow-input/0.5";
  const SCHEMA_VERSION_0_6 = "strategy-flow-input/0.6";
  const SCHEMA_VERSION_0_7 = "strategy-flow-input/0.7";
  const SCHEMA_VERSION_0_8 = "strategy-flow-input/0.8";
  const SCHEMA_VERSION = SCHEMA_VERSION_0_8;
  const SUPPORTED_SCHEMA_VERSIONS = [SCHEMA_VERSION_0_1, SCHEMA_VERSION_0_2, SCHEMA_VERSION_0_3, SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8];
  const METADATA_SCHEMA_VERSION = "strategy-flow-registration-metadata/2.0";
  const TAXONOMY_SCHEMA_VERSION = "strategy-taxonomy/2026-09";
  const STORAGE_KEY = "ebscn.strategy-flow-designer.draft.v0";
  const LAYOUT_STORAGE_KEY = "ebscn.strategy-flow-designer.layout.v0";
  const NORMAL_OFFSET_LIMIT = 4800;
  // Keep enough room for a 220px rule label between 262px cards. The old 370px
  // rank pitch left only 108px, so every midpoint label covered both cards.
  const AUTO_LAYOUT_RANK_GAP = 580;
  // Card min-height is 188px; 320px leaves usable space for vertical labels.
  const AUTO_LAYOUT_LEVEL_GAP = 320;
  // The export boundary owns contract correctness. Review-level rules stay
  // warnings so a dirty real-world draft can still reach the human editor.
  const OUTPUT_CONTRACT_ERROR_CODES = new Set([
    "SCHEMA_VERSION_REQUIRED",
    "SCHEMA_VERSION_INVALID",
    "SCHEMA_VERSION_UNSUPPORTED",
    "SCHEMA_FIELD_REQUIRED",
    "SCHEMA_UNKNOWN_FIELD",
    "STRATEGY_FIELD_REQUIRED",
    "STRATEGY_ID_INVALID",
    "REGISTRATION_CASE_ID_INVALID",
    "ENUM_INVALID",
    "TAXONOMY_VERSION_UNSUPPORTED",
    "TAXONOMY_FIELD_REQUIRED",
    "TAG_FIELD_REQUIRED",
    "TAG_CODE_INVALID",
    "TAG_PROPOSAL_FIELD_REQUIRED",
    "TAG_PROPOSAL_FIELD_INVALID",
    "TIME_REQUIRED",
    "EXECUTOR_REQUIRED",
    "SUBJECT_NAME_REQUIRED",
    "SUBJECT_STATE_REQUIRED",
    "COLUMN_SORT_ORDER_INVALID",
    "COLUMN_SORT_ORDER_DUPLICATE",
    "NODE_COLUMN_MISSING",
    "TRACK_EMPTY",
    "TRACK_MODE_INVALID",
    "TRACK_NAME_REQUIRED",
    "TRACK_SORT_ORDER_INVALID",
    "TRACK_SORT_ORDER_DUPLICATE",
    "NODE_TRACK_MISSING",
    "NODE_TRACK_NOT_FOUND",
    "NODE_TRACK_NOT_ENABLED",
    "NODE_SORT_ORDER_INVALID",
    "NODE_SORT_ORDER_DUPLICATE",
    "LAYOUT_INVALID",
    "ACTOR_TIME_REQUIRED",
    "ACTOR_ACTION_REQUIRED",
    "ACTOR_STATUS_REQUIRED",
    "SUBJECT_TIME_REQUIRED",
    "SUBJECT_ACTION_REQUIRED",
    "SUBJECT_STATUS_REQUIRED",
    "EDGE_ENDPOINT_MISSING",
    "ACTION_FIELD_REQUIRED",
    "ACTION_TOUCH_SCENE_REQUIRED",
    "ACTION_TOUCH_METHOD_REQUIRED",
    "ACTION_TOUCH_CODE_INVALID",
    "ACTION_TOUCH_PARENT_MISMATCH",
    "ACTION_TOUCH_TAXONOMY_SCOPE_MISMATCH",
    "ACTION_TOUCH_CHILD_REQUIRED",
    "ACTION_TOUCH_DUPLICATE",
    "CLASSIFICATION_PROCESS_ACTION_REQUIRED",
    "CLASSIFICATION_STRATEGY_ACTION_FORBIDDEN",
    "CLASSIFICATION_OUTGOING_EDGE_REQUIRED",
    "CLASSIFICATION_SUBJECT_BEHAVIOR_INVALID",
    "METADATA_VERSION_UNSUPPORTED",
    "METADATA_FIELD_REQUIRED",
    "METADATA_DATE_INVALID",
    "METADATA_TRIGGER_SCENE_FIELD_REQUIRED",
  ]);
  const NODE_TYPES = ["entry", "classification", "process", "wait", "outcome", "recycle", "reentry", "terminal"];
  const LEGACY_NODE_TYPES = ["entry", "process", "wait", "outcome", "recycle", "reentry", "terminal"];
  const EDGE_TYPES = ["state_transition", "handoff", "outcome", "recycle", "reentry", "exception"];
  const SUBJECT_TYPES = ["customer", "scene", "event", "activity"];
  const ACTOR_STATUSES = [
    ["executed", "已执行"],
    ["not_executed", "未执行"],
    ["no_requirement", "无动作要求"],
  ];
  const SUBJECT_STATUSES = [
    ["happened", "已发生"],
    ["not_happened", "未发生"],
    ["no_requirement", "无行为要求"],
  ];
  const TAXONOMY_CONTRACT = typeof window !== "undefined" && window.STRATEGY_TAXONOMY_2026_09
    ? window.STRATEGY_TAXONOMY_2026_09
    : require("./contracts/strategy-taxonomy-2026-09");
  const TAXONOMY_FIELDS = new Map(TAXONOMY_CONTRACT.fields.map(field => [field.fieldCode, field]));
  const LEGACY_BUSINESS_SCENES = new Map([
    ["新客服务", "new_customer_service"],
    ["用户激活", "user_activation"],
    ["资产提升", "asset_promotion"],
    ["流失挽留", "churn_retention"],
    ["产品销售", "product_sales"],
    ["业务开通", "business_open"],
    ["用户运营", "user_operations"],
  ]);
  const LEGACY_STRATEGY_TYPES = new Map([...TAXONOMY_FIELDS.get("strategyType").values]
    .map(value => [value.label, value]));

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

  function parseSchemaVersion(value) {
    const raw = clean(value);
    if (!raw) {
      return { valid: false, missing: true, raw };
    }
    const match = /^strategy-flow-input\/(\d+)\.(\d+)$/.exec(raw);
    if (!match) return { valid: false, missing: false, raw };
    return {
      valid: true,
      missing: false,
      raw,
      major: Number(match[1]),
      minor: Number(match[2]),
      key: `${match[1]}.${match[2]}`,
    };
  }

  function normalizeStrategy(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      strategyName: string(source.strategyName),
      strategyId: string(source.strategyId),
      registrationCaseId: string(source.registrationCaseId),
      paradigm: source.paradigm === "customer" || source.paradigm === "scene" ? source.paradigm : "",
      owner: string(source.owner),
      submitter: string(source.submitter),
      version: string(source.version),
      versionStatus: ["draft", "candidate"].includes(source.versionStatus) ? source.versionStatus : "",
    };
  }

  function emptyTaxonomySelections() {
    return Object.fromEntries([...TAXONOMY_FIELDS.keys()].map(fieldCode => [fieldCode, []]));
  }

  function normalizeTagSelection(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      code: string(source.code),
      parentCode: typeof source.parentCode === "string" ? clean(source.parentCode) : null,
    };
  }

  function normalizeCustomTagProposal(value) {
    const source = value && typeof value === "object" ? value : {};
    const parentRef = source.parentRef && typeof source.parentRef === "object" ? source.parentRef : {};
    return {
      proposalId: string(source.proposalId),
      fieldCode: string(source.fieldCode),
      label: string(source.label),
      reason: string(source.reason),
      parentRef: source.parentRef === undefined ? null : {
        fieldCode: string(parentRef.fieldCode),
        code: string(parentRef.code),
        proposalId: string(parentRef.proposalId),
      },
    };
  }

  function normalizeTaxonomy(value) {
    const source = value && typeof value === "object" ? value : {};
    const selections = emptyTaxonomySelections();
    if (source.selections && typeof source.selections === "object") {
      Object.entries(source.selections).forEach(([fieldCode, values]) => {
        if (TAXONOMY_FIELDS.has(fieldCode) && fieldCode !== "strategySubtype") {
          selections[fieldCode] = array(values).map(normalizeTagSelection);
        }
      });
    }
    array(source.tagSelections).forEach(selection => {
      const fieldCode = clean(selection?.fieldCode);
      if (TAXONOMY_FIELDS.has(fieldCode) && fieldCode !== "strategySubtype") {
        selections[fieldCode] = array(selection.values).map(normalizeTagSelection);
      }
    });
    const freeText = array(source.freeTextTags).find(item => clean(item?.fieldCode) === "strategySubtype");
    return {
      schemaVersion: clean(source.schemaVersion) || TAXONOMY_SCHEMA_VERSION,
      selections,
      strategySubtype: source.strategySubtype === undefined ? string(freeText?.value) : string(source.strategySubtype),
      customTagProposals: array(source.customTagProposals).map(normalizeCustomTagProposal),
    };
  }

  function taxonomyFromLegacyStrategy(strategy) {
    const source = strategy && typeof strategy === "object" ? strategy : {};
    const businessScene = LEGACY_BUSINESS_SCENES.get(clean(source.businessScene)) || "";
    const legacyType = LEGACY_STRATEGY_TYPES.get(clean(source.strategyType));
    const strategyTypes = legacyType && legacyType.parentCode === businessScene
      ? [{ code: legacyType.code, parentCode: legacyType.parentCode }]
      : [];
    return normalizeTaxonomy({
      schemaVersion: TAXONOMY_SCHEMA_VERSION,
      tagSelections: [
        businessScene ? { fieldCode: "businessScene", values: [{ code: businessScene }] } : null,
        strategyTypes.length ? { fieldCode: "strategyType", values: strategyTypes } : null,
      ].filter(Boolean),
      freeTextTags: [{ fieldCode: "strategySubtype", value: string(source.strategySubtype) }],
      customTagProposals: [],
    });
  }

  function toTaxonomyContract(input) {
    const taxonomy = normalizeTaxonomy(input);
    const tagSelections = [...TAXONOMY_FIELDS.keys()]
      .filter(fieldCode => fieldCode !== "strategySubtype")
      .map(fieldCode => ({
        fieldCode,
        values: taxonomy.selections[fieldCode].map(value => {
          const definition = TAXONOMY_FIELDS.get(fieldCode).values.find(item => item.code === value.code);
          const result = { code: value.code };
          if (definition?.parentCode !== undefined) result.parentCode = value.parentCode;
          return result;
        }),
      }))
      .filter(selection => selection.values.length);
    return {
      schemaVersion: TAXONOMY_SCHEMA_VERSION,
      tagSelections,
      freeTextTags: [{
        fieldCode: "strategySubtype",
        value: taxonomy.strategySubtype,
      }],
      customTagProposals: taxonomy.customTagProposals.map(proposal => {
        const result = { ...proposal };
        if (!result.parentRef) delete result.parentRef;
        else {
          Object.keys(result.parentRef).forEach(key => {
            if (!clean(result.parentRef[key])) delete result.parentRef[key];
          });
          if (!Object.keys(result.parentRef).length) delete result.parentRef;
        }
        return result;
      }),
    };
  }

  function normalizeColumn(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      localId: string(source.localId),
      sortOrder: source.sortOrder,
    };
  }

  function normalizeTrack(value) {
    const source = value && typeof value === "object" ? value : {};
    const track = {
      localId: string(source.localId),
      name: string(source.name),
      sortOrder: source.sortOrder,
    };
    // Keep the key present only when supplied. An absent description is a
    // legitimate compact form; an empty string is not a business description.
    if (source.description !== undefined) track.description = string(source.description);
    return track;
  }

  function normalizeNode(value, index, allowedNodeTypes = NODE_TYPES, columnId = "", trackMode = false) {
    const source = value && typeof value === "object" ? value : {};
    const layout = source.layout && typeof source.layout === "object" ? source.layout : {};
    const subject = source.subject && typeof source.subject === "object" ? source.subject : {};
    const defaultY = 90 + index * 155;
    return {
      localId: string(source.localId),
      nodeType: allowedNodeTypes.includes(source.nodeType) ? source.nodeType : "process",
      time: string(source.time),
      executor: string(source.executor),
      columnId: clean(source.columnId) || columnId,
      // Older contracts have no explicit board order. Array position is used
      // once during migration; after that sortOrder is the authoritative order.
      sortOrder: source.sortOrder === undefined ? (index + 1) * 10 : source.sortOrder,
      subject: {
        type: SUBJECT_TYPES.includes(subject.type) ? subject.type : "customer",
        name: string(subject.name),
        state: string(subject.state),
      },
      // Preserve an invalid no-track assignment long enough for validation
      // and export gating; toExportDocument removes the field in no-track mode.
      trackId: source.trackId === undefined
        ? (trackMode ? "" : undefined)
        : clean(source.trackId),
      layout: {
        x: numberOr(layout.x, 90),
        y: numberOr(layout.y, defaultY),
      },
    };
  }

  function normalizeBehavior(value, kind) {
    const source = value && typeof value === "object" ? value : {};
    const noAction = source.status === "no_requirement";
    return {
      time: string(source.time),
      action: noAction ? "无动作" : string(source.action),
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

  function legacyTouchSelection(value) {
    const source = value && typeof value === "object" ? value : {};
    const sceneLabel = clean(source.touchScene);
    const methodLabel = clean(source.touchMethod);
    const scene = sceneLabel
      ? TAXONOMY_FIELDS.get("touchScene").values.find(item => item.label === sceneLabel)
      : null;
    const method = methodLabel
      ? TAXONOMY_FIELDS.get("touchMethod").values.find(item => item.label === methodLabel)
      : null;
    const scenes = scene ? [{code: scene.code}] : [];
    const methods = scene && method && method.parentCode === scene.code
      ? [{code: method.code, parentCode: method.parentCode}]
      : [];
    const discarded = [];
    if (sceneLabel && !scene) discarded.push("touchScene");
    if (methodLabel && (!method || !scene || method.parentCode !== scene.code)) discarded.push("touchMethod");
    return {scenes, methods, discarded};
  }

  function normalizeStrategyAction(value, sourceSchemaVersion = SCHEMA_VERSION) {
    const source = value && typeof value === "object" ? value : {};
    const legacy = [SCHEMA_VERSION_0_1, SCHEMA_VERSION_0_2, SCHEMA_VERSION_0_3, SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5].includes(sourceSchemaVersion)
      ? legacyTouchSelection(source)
      : null;
    return {
      localId: string(source.localId),
      nodeId: string(source.nodeId),
      outgoingEdgeId: string(source.outgoingEdgeId),
      judge: string(source.judge),
      touchScenes: legacy
        ? legacy.scenes
        : array(source.touchScenes)
          .map(item => ({code: clean(item?.code)}))
          .filter(item => item.code),
      touchMethods: legacy
        ? legacy.methods
        : array(source.touchMethods)
          .map(item => ({
            code: clean(item?.code),
            parentCode: clean(item?.parentCode),
          }))
          .filter(item => item.code && item.parentCode),
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
      scene: string(source.scene),
      condition: string(source.condition),
      result: string(source.result),
      action: string(source.action),
      hook: string(source.hook),
      metrics: array(source.metrics).map(clean).filter(Boolean),
    };
  }

  function documentMigrationIssues(source, sourceSchemaVersion) {
    // 0.4 makes the parent card own these facts. Equal legacy values are a
    // storage change only; conflicting values are reported so an upgrade never
    // silently rewrites a different business fact.
    if (![SCHEMA_VERSION_0_1, SCHEMA_VERSION_0_2, SCHEMA_VERSION_0_3, SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6].includes(sourceSchemaVersion)) return [];
    const issues = [];
    const nodes = new Map(array(source.nodes)
      .map(node => [clean(node?.localId), node]));
    array(source.nodes).forEach((node, index) => {
      if (clean(node?.displayName)) {
        issues.push(issue(
          "MIGRATION_DISPLAY_NAME_DISCARDED",
          `0.4 已删除卡片展示名，导入时丢弃：${clean(node.displayName)}`,
          `nodes[${index}].displayName`,
        ));
      }
    });
    if (array(source.nodes).length) {
      issues.push(issue(
        "MIGRATION_SORT_ORDER_GENERATED",
        "0.6 已按旧 nodes 数组位置生成看板排序：10、20、30…",
        "nodes",
      ));
    }
    if (sourceSchemaVersion !== SCHEMA_VERSION_0_7 && array(source.nodes).length) {
      issues.push(issue(
        "MIGRATION_DEFAULT_COLUMN_GENERATED",
        "0.7 已为旧节点生成默认看板列 c1（列排序 10），请人工确认同列分组",
        "columns",
      ));
    }
    array(source.strategyActions).forEach((action, index) => {
      const node = nodes.get(clean(action?.nodeId));
      const expected = {
        time: clean(node?.time),
        subjectState: clean(node?.subject?.state),
      };
      Object.entries(expected).forEach(([key, parentValue]) => {
        const value = clean(action?.[key]);
        if (value && value !== parentValue) {
          issues.push(issue(
            "MIGRATION_DERIVED_FIELD_DISCARDED",
            `0.4 以所属流程卡片为准，动作字段 ${key} 被丢弃：${value}（卡片值：${parentValue || "空"}）`,
            `strategyActions[${index}].${key}`,
          ));
        }
      });
      const legacyTouch = legacyTouchSelection(action);
      legacyTouch.discarded.forEach(key => {
        issues.push(issue(
          "MIGRATION_TOUCH_FIELD_DISCARDED",
          `0.5 只按 taxonomy 展示名精确匹配迁移，动作字段 ${key} 被丢弃：${clean(action?.[key])}`,
          `strategyActions[${index}].${key}`,
        ));
      });
    });
    array(source.processActions).forEach((action, index) => {
      const node = nodes.get(clean(action?.nodeId));
      const expected = {
        executor: clean(node?.executor),
        recipient: clean(node?.subject?.name),
      };
      Object.entries(expected).forEach(([key, parentValue]) => {
        const value = clean(action?.[key]);
        if (value && value !== parentValue) {
          issues.push(issue(
            "MIGRATION_DERIVED_FIELD_DISCARDED",
            `0.4 以所属流程卡片为准，动作字段 ${key} 被丢弃：${value}（卡片值：${parentValue || "空"}）`,
            `processActions[${index}].${key}`,
          ));
        }
      });
    });
    return issues;
  }

  function normalizeRegistrationMetadata(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      schemaVersion: METADATA_SCHEMA_VERSION,
      businessUnit: string(source.businessUnit),
      submitDate: string(source.submitDate),
      coreHook: string(source.coreHook),
      effectiveFrom: string(source.effectiveFrom),
      baselineVersion: string(source.baselineVersion),
      triggerScenes: array(source.triggerScenes).map(item => ({
        triggerSceneId: string(item?.triggerSceneId),
        triggerScene: string(item?.triggerScene),
        threshold: string(item?.threshold),
        frequency: string(item?.frequency),
        deduplication: string(item?.deduplication),
        cooldown: string(item?.cooldown),
        audienceScope: string(item?.audienceScope),
        qualification: string(item?.qualification),
        dataSource: string(item?.dataSource),
        confirmationStatus: string(item?.confirmationStatus),
      })),
    };
  }

  function normalizeDocument(value) {
    const source = value && typeof value === "object" ? value : {};
    const isCanonicalInput = Boolean(source.taxonomy?.selections);
    const parsedVersion = parseSchemaVersion(source.schemaVersion);
    const sourceSchemaVersion = isCanonicalInput
      ? clean(source.sourceSchemaVersion) || parsedVersion.raw
      : parsedVersion.raw;
    const isV0_1 = !isCanonicalInput && sourceSchemaVersion === SCHEMA_VERSION_0_1;
    const allowedNodeTypes = isCanonicalInput || [SCHEMA_VERSION_0_3, SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(sourceSchemaVersion)
      ? NODE_TYPES
      : LEGACY_NODE_TYPES;
    const sourceTracks = array(source.tracks);
    const trackMode = isCanonicalInput
      ? source.trackMode === true || sourceTracks.length > 0
      : sourceSchemaVersion === SCHEMA_VERSION_0_8 && source.tracks !== undefined;
    const migrationIssues = isCanonicalInput
      ? array(source.migrationIssues)
      : documentMigrationIssues(source, sourceSchemaVersion);
    const migrationAudit = isCanonicalInput
      ? array(source.migrationAudit)
      : sourceSchemaVersion !== SCHEMA_VERSION && SUPPORTED_SCHEMA_VERSIONS.includes(sourceSchemaVersion)
        ? [issue(
          "MIGRATION_TRACK_NOT_ENABLED",
          "0.8 未启用业务主线 Track；这不是待补全状态，复杂策略可在编辑器中显式开启",
          "tracks",
        )]
        : [];
    const normalized = {
      schemaVersion: SCHEMA_VERSION,
      sourceSchemaVersion,
      strategy: normalizeStrategy(source.strategy),
      taxonomy: isV0_1
        ? taxonomyFromLegacyStrategy(source.strategy)
        : normalizeTaxonomy(source.taxonomy),
      trackMode,
      tracks: trackMode ? sourceTracks.map(normalizeTrack) : [],
      columns: (isCanonicalInput || [SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(sourceSchemaVersion))
        ? array(source.columns).map(normalizeColumn)
        : (array(source.nodes).length ? [normalizeColumn({localId: "c1", sortOrder: 10})] : []),
      nodes: array(source.nodes).map((node, index) => normalizeNode(
        node,
        index,
        allowedNodeTypes,
        isCanonicalInput || [SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(sourceSchemaVersion) ? "" : "c1",
        trackMode,
      )),
      edges: array(source.edges).map(normalizeEdge),
      strategyActions: array(source.strategyActions).map(item => normalizeStrategyAction(
        item,
        isCanonicalInput ? SCHEMA_VERSION : sourceSchemaVersion,
      )),
      processActions: array(source.processActions).map(normalizeProcessAction),
      registrationMetadata: normalizeRegistrationMetadata(source.registrationMetadata),
      migrationIssues,
      migrationAudit,
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

  function nextSortOrder(items) {
    const used = new Set(items
      .map(item => item.sortOrder)
      .filter(value => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647));
    const max = used.size ? Math.max(...used) : 0;
    const appended = max + 10;
    if (appended <= 2147483647 && !used.has(appended)) return appended;
    for (let candidate = 0; candidate <= 2147483647; candidate += 1) {
      if (!used.has(candidate)) return candidate;
    }
    return 0;
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
      sourceSchemaVersion: SCHEMA_VERSION,
      strategy: normalizeStrategy({ paradigm: "customer" }),
      taxonomy: normalizeTaxonomy(),
      nodes: [],
      edges: [],
      strategyActions: [],
      processActions: [],
      columns: [],
      trackMode: false,
      tracks: [],
      registrationMetadata: normalizeRegistrationMetadata(),
      migrationIssues: [],
      migrationAudit: [],
    };
  }

  function issue(code, message, path) {
    return { code, message, path };
  }

  function unknownKeys(value, allowed) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const allowedSet = new Set(allowed);
    return Object.keys(value).filter(key => !allowedSet.has(key));
  }

  function validateExternalContractShape(raw, errors, version) {
    const source = raw && typeof raw === "object" ? raw : {};
    const v0_1 = version === SCHEMA_VERSION_0_1;
    const modernVersion = [SCHEMA_VERSION_0_3, SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(version);
    const hasColumns = [SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(version);
    const hasTracks = version === SCHEMA_VERSION_0_8;
    const allowedNodeTypes = modernVersion ? NODE_TYPES : LEGACY_NODE_TYPES;
    const requiredStrategyFields = modernVersion
      ? ["strategyName", "paradigm", "owner", "submitter", "version", "versionStatus"]
      : ["strategyName", "strategyId", "paradigm", "owner", "submitter", "version", "versionStatus"];
    const topLevelAllowed = [
      "schemaVersion", "strategy", ...(v0_1 ? [] : ["taxonomy"]), ...(hasColumns ? ["columns"] : []), ...(hasTracks ? ["tracks"] : []),
      "nodes", "edges", "strategyActions", "processActions", "validation",
    ];
    unknownKeys(source, topLevelAllowed).forEach(key => {
      errors.push(issue("SCHEMA_UNKNOWN_FIELD", `顶层未知字段：${key}`, key));
    });

    const strategyAllowed = v0_1
      ? ["strategyName", "strategyId", "paradigm", "owner", "submitter", "businessScene", "strategyType", "strategySubtype", "version", "versionStatus"]
      : modernVersion
        ? ["strategyName", "strategyId", "registrationCaseId", "paradigm", "owner", "submitter", "version", "versionStatus"]
        : ["strategyName", "strategyId", "paradigm", "owner", "submitter", "version", "versionStatus"];
    unknownKeys(source.strategy, strategyAllowed).forEach(key => {
      errors.push(issue("SCHEMA_UNKNOWN_FIELD", `strategy 未知字段：${key}`, `strategy.${key}`));
    });

    if (v0_1) return;
    ["schemaVersion", "strategy", "taxonomy", ...(hasColumns ? ["columns"] : []), "nodes", "edges", "strategyActions", "processActions"].forEach(key => {
      if (source[key] === undefined) errors.push(issue("SCHEMA_FIELD_REQUIRED", `顶层必填字段缺失：${key}`, key));
    });
    requiredStrategyFields.forEach(key => {
      if (clean(source.strategy?.[key]) === "") errors.push(issue("STRATEGY_FIELD_REQUIRED", `策略字段缺失：${key}`, `strategy.${key}`));
    });
    if (modernVersion && source.strategy?.strategyId !== undefined && clean(source.strategy.strategyId) === "") {
      errors.push(issue("STRATEGY_ID_INVALID", "看板策略编号不能为空；新建策略应省略该字段", "strategy.strategyId"));
    }
    if (modernVersion && clean(source.strategy?.strategyId) && !/^WB-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(clean(source.strategy.strategyId))) {
      errors.push(issue("STRATEGY_ID_INVALID", "看板策略编号必须以 WB- 开头且由看板返回", "strategy.strategyId"));
    }
    if (modernVersion && source.strategy?.registrationCaseId !== undefined && clean(source.strategy.registrationCaseId) === "") {
      errors.push(issue("REGISTRATION_CASE_ID_INVALID", "提交注册 CaseID 不能为空；新建策略应省略该字段", "strategy.registrationCaseId"));
    }
    if (modernVersion && clean(source.strategy?.registrationCaseId) && (
      ["待确认", "无", "暂无", "源表未填写"].includes(clean(source.strategy.registrationCaseId))
      || /^AG-[A-Za-z0-9_-]+$/.test(clean(source.strategy.registrationCaseId))
    )) {
      errors.push(issue("REGISTRATION_CASE_ID_INVALID", "提交注册 CaseID 必须由看板返回；禁止使用占位文本或 Agent 本地工作区 ID", "strategy.registrationCaseId"));
    }
    if (source.strategy && !["customer", "scene"].includes(source.strategy.paradigm)) {
      errors.push(issue("ENUM_INVALID", "策略范式只能是 customer 或 scene", "strategy.paradigm"));
    }
    if (source.strategy && !["draft", "candidate"].includes(source.strategy.versionStatus)) {
      errors.push(issue("ENUM_INVALID", "版本状态只能是 draft 或 candidate", "strategy.versionStatus"));
    }
    ["schemaVersion", "tagSelections", "freeTextTags", "customTagProposals"].forEach(key => {
      if (source.taxonomy?.[key] === undefined) errors.push(issue("TAXONOMY_FIELD_REQUIRED", `taxonomy 必填字段缺失：${key}`, `taxonomy.${key}`));
    });
    array(source.taxonomy?.tagSelections).forEach((selection, index) => {
      const base = `taxonomy.tagSelections[${index}]`;
      if (!clean(selection?.fieldCode)) errors.push(issue("TAG_FIELD_REQUIRED", "标签选择缺少 fieldCode", `${base}.fieldCode`));
      if (!Array.isArray(selection?.values) || !selection.values.length) errors.push(issue("TAG_FIELD_REQUIRED", "标签选择至少需要一个值", `${base}.values`));
      array(selection?.values).forEach((value, valueIndex) => {
        if (!clean(value?.code)) errors.push(issue("TAG_CODE_INVALID", "标签 code 不能为空", `${base}.values[${valueIndex}].code`));
        const field = TAXONOMY_FIELDS.get(clean(selection?.fieldCode));
        const definition = field?.values.find(item => item.code === clean(value?.code));
        if (definition && clean(value?.label) && clean(value?.label) !== definition.label) {
          errors.push(issue("TAG_LABEL_MISMATCH", `标签 label 与字典不一致：${value.label}`, `${base}.values[${valueIndex}].label`));
        }
      });
    });
    source.nodes?.forEach?.((item, index) => {
      ["localId", "nodeType", "time", "executor", "subject", ...([SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(version) ? ["sortOrder"] : []), ...(hasColumns ? ["columnId"] : []), "layout"].forEach(key => {
        if (item?.[key] === undefined) errors.push(issue("SCHEMA_FIELD_REQUIRED", `节点必填字段缺失：${key}`, `nodes[${index}].${key}`));
      });
      ["type", "name", "state"].forEach(key => {
        if (item?.subject?.[key] === undefined) errors.push(issue("SCHEMA_FIELD_REQUIRED", `对象必填字段缺失：${key}`, `nodes[${index}].subject.${key}`));
      });
      if (item && !allowedNodeTypes.includes(item.nodeType)) errors.push(issue("ENUM_INVALID", "节点类型不合法", `nodes[${index}].nodeType`));
      if (item?.subject && !SUBJECT_TYPES.includes(item.subject.type)) errors.push(issue("ENUM_INVALID", "对象类型不合法", `nodes[${index}].subject.type`));
    });
    source.edges?.forEach?.((item, index) => {
      ["localId", "from", "to", "edgeType", "actorBehavior", "subjectBehavior"].forEach(key => {
        if (item?.[key] === undefined) errors.push(issue("SCHEMA_FIELD_REQUIRED", `流转规则必填字段缺失：${key}`, `edges[${index}].${key}`));
      });
      ["actorBehavior", "subjectBehavior"].forEach(key => {
        ["time", "action", "status"].forEach(child => {
          if (item?.[key]?.[child] === undefined) errors.push(issue("SCHEMA_FIELD_REQUIRED", `行为必填字段缺失：${child}`, `edges[${index}].${key}.${child}`));
        });
      });
      if (item && !EDGE_TYPES.includes(item.edgeType)) errors.push(issue("ENUM_INVALID", "流转类型不合法", `edges[${index}].edgeType`));
      if (item?.actorBehavior && !ACTOR_STATUSES.some(pair => pair[0] === item.actorBehavior.status)) errors.push(issue("ENUM_INVALID", "执行人行为状态不合法", `edges[${index}].actorBehavior.status`));
      if (item?.subjectBehavior && !SUBJECT_STATUSES.some(pair => pair[0] === item.subjectBehavior.status)) errors.push(issue("ENUM_INVALID", "对象行为状态不合法", `edges[${index}].subjectBehavior.status`));
    });
    if (hasColumns) {
      source.columns?.forEach?.((item, index) => {
        ["localId", "sortOrder"].forEach(key => {
          if (item?.[key] === undefined) errors.push(issue("SCHEMA_FIELD_REQUIRED", `看板列必填字段缺失：${key}`, `columns[${index}].${key}`));
        });
      });
    }
    if (hasTracks) {
      source.tracks?.forEach?.((item, index) => {
        ["localId", "name", "sortOrder"].forEach(key => {
          if (item?.[key] === undefined) errors.push(issue("SCHEMA_FIELD_REQUIRED", `业务主线必填字段缺失：${key}`, `tracks[${index}].${key}`));
        });
      });
    }
    source.strategyActions?.forEach?.((item, index) => {
      ["localId", "nodeId", "outgoingEdgeId"].forEach(key => {
        if (item?.[key] === undefined) errors.push(issue("ACTION_FIELD_REQUIRED", `策略动作必填字段缺失：${key}`, `strategyActions[${index}].${key}`));
      });
    });
    source.processActions?.forEach?.((item, index) => {
      ["localId", "nodeId", "outgoingEdgeId"].forEach(key => {
        if (item?.[key] === undefined) errors.push(issue("ACTION_FIELD_REQUIRED", `过程动作必填字段缺失：${key}`, `processActions[${index}].${key}`));
      });
    });
    unknownKeys(source.taxonomy, ["schemaVersion", "tagSelections", "freeTextTags", "customTagProposals"]).forEach(key => {
      errors.push(issue("SCHEMA_UNKNOWN_FIELD", `taxonomy 未知字段：${key}`, `taxonomy.${key}`));
    });
    const seenTaxonomyFields = new Set();
    array(source.taxonomy?.tagSelections).forEach((selection, index) => {
      const base = `taxonomy.tagSelections[${index}]`;
      unknownKeys(selection, ["fieldCode", "values"]).forEach(key => {
        errors.push(issue("SCHEMA_UNKNOWN_FIELD", `标签选择未知字段：${key}`, `${base}.${key}`));
      });
      const fieldCode = clean(selection?.fieldCode);
      if (seenTaxonomyFields.has(fieldCode)) errors.push(issue("TAG_FIELD_DUPLICATE", `taxonomy 字段重复：${fieldCode}`, `${base}.fieldCode`));
      seenTaxonomyFields.add(fieldCode);
      array(selection?.values).forEach((value, valueIndex) => {
        unknownKeys(value, ["code", "parentCode", "label"]).forEach(key => {
          errors.push(issue("SCHEMA_UNKNOWN_FIELD", `标签值未知字段：${key}`, `${base}.values[${valueIndex}].${key}`));
        });
      });
    });
    array(source.taxonomy?.freeTextTags).forEach((item, index) => {
      unknownKeys(item, ["fieldCode", "value"]).forEach(key => {
        errors.push(issue("SCHEMA_UNKNOWN_FIELD", `自由文本标签未知字段：${key}`, `taxonomy.freeTextTags[${index}].${key}`));
      });
    });
    array(source.taxonomy?.customTagProposals).forEach((proposal, index) => {
      const base = `taxonomy.customTagProposals[${index}]`;
      unknownKeys(proposal, ["proposalId", "fieldCode", "label", "reason", "parentRef"]).forEach(key => {
        errors.push(issue("SCHEMA_UNKNOWN_FIELD", `自定义标签提案未知字段：${key}`, `${base}.${key}`));
      });
      unknownKeys(proposal?.parentRef, ["fieldCode", "code", "proposalId"]).forEach(key => {
        errors.push(issue("SCHEMA_UNKNOWN_FIELD", `父引用未知字段：${key}`, `${base}.parentRef.${key}`));
      });
    });

    const nodeKeys = ["localId", "nodeType", "time", "executor", "subject", ...([SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(version) ? ["sortOrder"] : []), ...(hasColumns ? ["columnId"] : []), ...(hasTracks ? ["trackId"] : []), ...([SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(version) ? [] : ["displayName"]), "layout"];
    const columnKeys = ["localId", "sortOrder"];
    const trackKeys = ["localId", "name", "description", "sortOrder"];
    const edgeKeys = ["localId", "from", "to", "edgeType", "actorBehavior", "subjectBehavior", "confirmed", "mutexGroup", "overwriteSource", "label", "layout"];
    const behaviorKeys = ["time", "action", "status"];
    const strategyActionKeys = [SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(version)
      ? ["localId", "nodeId", "outgoingEdgeId", "judge", "touchScenes", "touchMethods", "theme", "goal", "hook", "copy", "hasLink", "metrics"]
      : ["localId", "nodeId", "outgoingEdgeId", ...([SCHEMA_VERSION_0_4].includes(version) ? [] : ["time", "subjectState"]), "judge", "touchScene", "touchMethod", "theme", "goal", "hook", "copy", "hasLink", "metrics"];
    const processActionKeys = ["localId", "nodeId", "outgoingEdgeId", ...([SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(version) ? [] : ["executor"]), "scene", "condition", "result", "action", "hook", ...([SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(version) ? [] : ["recipient"]), "metrics"];
    source.nodes?.forEach?.((item, index) => {
      unknownKeys(item, nodeKeys).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `节点未知字段：${key}`, `nodes[${index}].${key}`)));
      unknownKeys(item?.subject, ["type", "name", "state"]).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `对象未知字段：${key}`, `nodes[${index}].subject.${key}`)));
      unknownKeys(item?.layout, ["x", "y"]).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `布局未知字段：${key}`, `nodes[${index}].layout.${key}`)));
    });
    if (hasColumns) {
      source.columns?.forEach?.((item, index) => {
        unknownKeys(item, columnKeys).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `看板列未知字段：${key}`, `columns[${index}].${key}`)));
      });
    }
    if (hasTracks) {
      source.tracks?.forEach?.((item, index) => {
        unknownKeys(item, trackKeys).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `业务主线未知字段：${key}`, `tracks[${index}].${key}`)));
      });
    }
    source.edges?.forEach?.((item, index) => {
      unknownKeys(item, edgeKeys).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `流转规则未知字段：${key}`, `edges[${index}].${key}`)));
      ["actorBehavior", "subjectBehavior"].forEach(key => {
        unknownKeys(item?.[key], behaviorKeys).forEach(child => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `行为未知字段：${child}`, `edges[${index}].${key}.${child}`)));
      });
      unknownKeys(item?.layout, ["normalOffset"]).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `布局未知字段：${key}`, `edges[${index}].layout.${key}`)));
    });
    source.strategyActions?.forEach?.((item, index) => {
      unknownKeys(item, strategyActionKeys).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `策略动作未知字段：${key}`, `strategyActions[${index}].${key}`)));
      if ([SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(version)) {
        array(item?.touchScenes).forEach((selection, selectionIndex) => {
          unknownKeys(selection, ["code"]).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `触达场景引用未知字段：${key}`, `strategyActions[${index}].touchScenes[${selectionIndex}].${key}`)));
        });
        array(item?.touchMethods).forEach((selection, selectionIndex) => {
          unknownKeys(selection, ["code", "parentCode"]).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `触达方式引用未知字段：${key}`, `strategyActions[${index}].touchMethods[${selectionIndex}].${key}`)));
        });
      }
    });
    source.processActions?.forEach?.((item, index) => {
      unknownKeys(item, processActionKeys).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `过程动作未知字段：${key}`, `processActions[${index}].${key}`)));
    });
  }

  function validateDocument(input) {
    const doc = normalizeDocument(input);
    const errors = [];
    const warnings = [];
    const nodes = new Map(doc.nodes.map(node => [node.localId, node]));
    const columns = new Map(doc.columns.map(column => [column.localId, column]));
    const tracks = new Map(doc.tracks.map(track => [track.localId, track]));
    const edges = new Map(doc.edges.map(edge => [edge.localId, edge]));

    const sourceVersion = parseSchemaVersion(doc.sourceSchemaVersion);
    if (sourceVersion.missing) {
      errors.push(issue("SCHEMA_VERSION_REQUIRED", "导入 JSON 缺少 schemaVersion", "schemaVersion"));
    } else if (!sourceVersion.valid) {
      errors.push(issue("SCHEMA_VERSION_INVALID", `schemaVersion 必须形如 ${SCHEMA_NAMESPACE}/<major>.<minor>`, "schemaVersion"));
    } else if (!SUPPORTED_SCHEMA_VERSIONS.includes(sourceVersion.raw)) {
      errors.push(issue("SCHEMA_VERSION_UNSUPPORTED", `不支持的策略契约版本：${sourceVersion.raw}；当前支持：${SUPPORTED_SCHEMA_VERSIONS.join("、")}`, "schemaVersion"));
    } else if (sourceVersion.raw !== SCHEMA_VERSION) {
      warnings.push(issue("SCHEMA_MIGRATED", `已从 ${sourceVersion.key} 迁移到 ${SCHEMA_VERSION.split("/").pop()}；旧契约字段按当前规则归一`, "schemaVersion"));
    }
    const isCanonicalInput = Boolean(input?.taxonomy?.selections);
    const knownExternalVersion = sourceVersion.valid && SUPPORTED_SCHEMA_VERSIONS.includes(sourceVersion.raw);
    if (!isCanonicalInput && knownExternalVersion) validateExternalContractShape(input, errors, sourceVersion.raw);
    if (!isCanonicalInput && sourceVersion.raw === SCHEMA_VERSION_0_8) {
      const rawTracksPresent = input?.tracks !== undefined;
      if (rawTracksPresent && !Array.isArray(input.tracks)) {
        errors.push(issue("TRACK_MODE_INVALID", "业务主线 tracks 必须是数组", "tracks"));
      }
      if (Array.isArray(input?.tracks)) {
        if (!input.tracks.length) errors.push(issue("TRACK_EMPTY", "启用业务主线后 tracks 至少包含一条 Track", "tracks"));
        array(input.nodes).forEach((node, index) => {
          if (node?.trackId === undefined) {
            errors.push(issue("NODE_TRACK_MISSING", `启用业务主线后每张流程卡片必须归属一个 primary Track：${clean(node?.localId) || `nodes[${index}]`}`, `nodes[${index}].trackId`));
          }
        });
      } else {
        array(input.nodes).forEach((node, index) => {
          if (node?.trackId !== undefined) {
            errors.push(issue("NODE_TRACK_NOT_ENABLED", "未启用业务主线时节点不能携带 trackId", `nodes[${index}].trackId`));
          }
        });
      }
    }
    if (doc.trackMode && !doc.tracks.length) {
      errors.push(issue("TRACK_EMPTY", "启用业务主线后 tracks 至少包含一条 Track", "tracks"));
    }
    ["strategyName", "paradigm", "owner", "submitter", "version", "versionStatus"].forEach(key => {
      if (!clean(doc.strategy[key])) {
        errors.push(issue("STRATEGY_FIELD_REQUIRED", `策略字段缺失：${key}`, `strategy.${key}`));
      }
    });
    if ([SCHEMA_VERSION_0_3, SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(sourceVersion.raw) && doc.strategy.strategyId && (
      ["待确认", "无", "暂无", "源表未填写"].includes(clean(doc.strategy.strategyId))
      || /^AG-[A-Za-z0-9_-]+$/.test(clean(doc.strategy.strategyId))
      || !/^WB-[A-Za-z0-9][A-Za-z0-9_-]*$/.test(clean(doc.strategy.strategyId))
    )) {
      errors.push(issue("STRATEGY_ID_INVALID", "看板策略编号必须是看板返回的正式编号；新建策略留空，禁止使用本地工作区 ID", "strategy.strategyId"));
    }
    if ([SCHEMA_VERSION_0_3, SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(sourceVersion.raw) && doc.strategy.registrationCaseId && (
      ["待确认", "无", "暂无", "源表未填写"].includes(clean(doc.strategy.registrationCaseId))
      || /^AG-[A-Za-z0-9_-]+$/.test(clean(doc.strategy.registrationCaseId))
    )) {
      errors.push(issue("REGISTRATION_CASE_ID_INVALID", "提交注册 CaseID 必须由看板返回；禁止使用占位文本或 Agent 本地工作区 ID", "strategy.registrationCaseId"));
    }
    if ([SCHEMA_VERSION_0_3, SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(sourceVersion.raw) && doc.strategy.registrationCaseId && doc.strategy.strategyId === doc.strategy.registrationCaseId) {
      errors.push(issue("REGISTRATION_CASE_ID_INVALID", "提交注册 CaseID 与正式策略编号必须是两个不同标识", "strategy.registrationCaseId"));
    }

    if (doc.taxonomy.schemaVersion !== TAXONOMY_SCHEMA_VERSION) {
      errors.push(issue("TAXONOMY_VERSION_UNSUPPORTED", `taxonomy 契约必须是 ${TAXONOMY_SCHEMA_VERSION}`, "taxonomy.schemaVersion"));
    }

    const selectedCodes = fieldCode => new Set(doc.taxonomy.selections[fieldCode].map(item => item.code));
    [...TAXONOMY_FIELDS.keys()].forEach(fieldCode => {
      if (fieldCode === "strategySubtype") return;
      const field = TAXONOMY_FIELDS.get(fieldCode);
      const values = doc.taxonomy.selections[fieldCode];
      if (field.required && !values.length) {
        errors.push(issue("TAG_FIELD_REQUIRED", `标签字段缺失：${field.label}`, `taxonomy.${fieldCode}`));
      }
      const seen = new Set();
      values.forEach((value, index) => {
        const definition = field.values.find(item => item.code === value.code);
        const path = `taxonomy.tagSelections.${fieldCode}[${index}]`;
        if (seen.has(value.code)) errors.push(issue("TAG_CODE_DUPLICATE", `标签重复：${value.code || "空"}`, `${path}.code`));
        seen.add(value.code);
        if (!definition) {
          errors.push(issue("TAG_CODE_INVALID", `${field.label}存在未知标签 code：${value.code || "空"}`, `${path}.code`));
          return;
        }
        if (definition.status !== "active") {
          errors.push(issue("TAG_CODE_INACTIVE", `${field.label}标签已停用：${value.code}`, `${path}.code`));
        }
        if (definition.parentCode !== undefined) {
          if (!value.parentCode) {
            errors.push(issue("TAG_PARENT_REQUIRED", `${field.label} ${value.code} 缺少 parentCode`, `${path}.parentCode`));
          } else if (value.parentCode !== definition.parentCode) {
            errors.push(issue("TAG_PARENT_MISMATCH", `${fieldCode}/${value.code} parentCode 不匹配：提交 ${value.parentCode}，字典 ${definition.parentCode}`, `${path}.parentCode`));
          }
          const parentField = TAXONOMY_FIELDS.get(field.parentFieldCode);
          const parentSelected = selectedCodes(field.parentFieldCode).has(value.parentCode);
          if (!parentSelected) {
            errors.push(issue("TAG_PARENT_REQUIRED", `${field.label} ${value.code} 的父标签未选择：${parentField.label} / ${value.parentCode}`, `${path}.parentCode`));
          }
        }
      });
      if (field.cardinality === "single" && values.length > 1) {
        errors.push(issue("TAG_CARDINALITY_INVALID", `${field.label}只能选择一个值`, `taxonomy.${fieldCode}`));
      }
    });

    const customerCodes = selectedCodes("customerClass");
    const assetCodes = selectedCodes("assetRange");
    if (assetCodes.has("unlimited") && assetCodes.size > 1) {
      errors.push(issue("TAG_EXCLUSIVE_INVALID", "不限资产不能与具体资产区间同选", "taxonomy.assetRange"));
    }
    [...customerCodes].forEach(customerCode => {
      const hasAsset = doc.taxonomy.selections.assetRange.some(value => value.parentCode === customerCode);
      if (!hasAsset) errors.push(issue("TAG_CHILD_REQUIRED", `客群 ${customerCode} 至少需要一个匹配资产区间`, "taxonomy.assetRange"));
    });
    doc.taxonomy.selections.assetRange.forEach((value, index) => {
      if (value.code !== "unlimited" && !customerCodes.has(value.parentCode)) {
        errors.push(issue("TAG_PARENT_REQUIRED", `资产区间 ${value.code} 必须挂到已选客群`, `taxonomy.tagSelections.assetRange[${index}].parentCode`));
      }
    });

    const riskCodes = selectedCodes("riskLevel");
    if (riskCodes.has("unspecified") && riskCodes.size > 1) {
      errors.push(issue("TAG_EXCLUSIVE_INVALID", "不设分风险等级不能与 C1-C5 同选", "taxonomy.riskLevel"));
    }

    const businessCodes = selectedCodes("businessScene");
    [...businessCodes].forEach(sceneCode => {
      const hasType = doc.taxonomy.selections.strategyType.some(value => value.parentCode === sceneCode);
      if (!hasType) errors.push(issue("TAG_CHILD_REQUIRED", `业务场景 ${sceneCode} 至少需要一个策略类型`, "taxonomy.strategyType"));
    });
    const touchCodes = selectedCodes("touchScene");
    [...touchCodes].forEach(sceneCode => {
      const hasMethod = doc.taxonomy.selections.touchMethod.some(value => value.parentCode === sceneCode);
      if (!hasMethod) errors.push(issue("TAG_CHILD_REQUIRED", `触达场景 ${sceneCode} 至少需要一个触达方式`, "taxonomy.touchMethod"));
    });

    const invalidFreeText = ["无", "暂无", "待确认", "源表未填写"];
    if (!clean(doc.taxonomy.strategySubtype)) {
      errors.push(issue("TAG_FIELD_REQUIRED", "标签字段缺失：策略子类", "taxonomy.freeTextTags.strategySubtype"));
    } else if (invalidFreeText.includes(clean(doc.taxonomy.strategySubtype))) {
      errors.push(issue("TAG_FREE_TEXT_INVALID", "策略子类不能是占位文本", "taxonomy.freeTextTags.strategySubtype"));
    }

    const proposalIds = new Set();
    const proposalFields = new Set(["businessScene", "strategyType", "touchScene", "touchMethod"]);
    const proposalLabels = new Set();
    doc.taxonomy.customTagProposals.forEach((proposal, index) => {
      const base = `taxonomy.customTagProposals[${index}]`;
      ["proposalId", "fieldCode", "label", "reason"].forEach(key => {
        if (!clean(proposal[key])) errors.push(issue("TAG_PROPOSAL_FIELD_REQUIRED", `自定义标签提案缺少 ${key}`, `${base}.${key}`));
      });
      if (proposal.proposalId.length < 8) errors.push(issue("TAG_PROPOSAL_FIELD_INVALID", "proposalId 至少 8 位", `${base}.proposalId`));
      if (proposalIds.has(proposal.proposalId)) errors.push(issue("TAG_PROPOSAL_DUPLICATE", `提案 ID 重复：${proposal.proposalId}`, `${base}.proposalId`));
      proposalIds.add(proposal.proposalId);
      if (proposal.label && proposalLabels.has(proposal.label)) errors.push(issue("TAG_PROPOSAL_DUPLICATE", `提案展示名重复：${proposal.label}`, `${base}.label`));
      proposalLabels.add(proposal.label);
      const field = TAXONOMY_FIELDS.get(proposal.fieldCode);
      if (!field || !proposalFields.has(proposal.fieldCode)) {
        errors.push(issue("TAG_PROPOSAL_FIELD_INVALID", `字段不允许自定义提案：${proposal.fieldCode || "空"}`, `${base}.fieldCode`));
      }
      if (field?.values.some(value => value.label === proposal.label)) {
        errors.push(issue("TAG_PROPOSAL_DUPLICATE", `提案展示名与字典重复：${proposal.label}`, `${base}.label`));
      }
      if (proposal.parentRef) {
        if (proposal.parentRef.code && proposal.parentRef.proposalId) {
          errors.push(issue("TAG_PROPOSAL_PARENT_INVALID", "父引用只能提供 code 或 proposalId，不能同时提供", `${base}.parentRef`));
        }
        const parentField = TAXONOMY_FIELDS.get(proposal.parentRef.fieldCode);
        if (field?.parentFieldCode && proposal.parentRef.fieldCode !== field.parentFieldCode) {
          errors.push(issue("TAG_PROPOSAL_PARENT_INVALID", `父字段必须是 ${field.parentFieldCode}`, `${base}.parentRef.fieldCode`));
        }
        const hasExistingParent = parentField?.values.some(value => value.code === proposal.parentRef.code);
        const hasProposalParent = proposalIds.has(proposal.parentRef.proposalId);
        if (!parentField || (!hasExistingParent && !hasProposalParent)) {
          errors.push(issue("TAG_PROPOSAL_PARENT_INVALID", "自定义标签提案的父引用无效", `${base}.parentRef`));
        }
      } else if (field?.parentFieldCode) {
        errors.push(issue("TAG_PROPOSAL_PARENT_INVALID", `${field.label}提案必须提供父引用`, `${base}.parentRef`));
      }
      warnings.push(issue("CUSTOM_TAG_APPROVAL_REQUIRED", "自定义标签提案需审批，未通过前会阻断后续处理", base));
    });

    const metadata = doc.registrationMetadata;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    [["businessUnit", "业务归属"], ["submitDate", "提交日期"], ["coreHook", "核心抓手"], ["effectiveFrom", "生效日期"]].forEach(([key, label]) => {
      if (!clean(metadata[key])) errors.push(issue("METADATA_FIELD_REQUIRED", `注册元数据缺失：${label}`, `registrationMetadata.${key}`));
    });
    ["submitDate", "effectiveFrom"].forEach(key => {
      if (clean(metadata[key]) && !datePattern.test(metadata[key])) {
        errors.push(issue("METADATA_DATE_INVALID", "日期必须使用 YYYY-MM-DD", `registrationMetadata.${key}`));
      }
    });
    if (doc.strategy.versionStatus === "candidate" && !clean(metadata.baselineVersion)) {
      errors.push(issue("METADATA_BASELINE_REQUIRED", "candidate 定义必须提供基准版本", "registrationMetadata.baselineVersion"));
    }
    if (doc.strategy.paradigm === "scene" && !metadata.triggerScenes.length) {
      errors.push(issue("METADATA_TRIGGER_SCENE_REQUIRED", "场景触发策略必须提供触发场景", "registrationMetadata.triggerScenes"));
    }

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
    duplicate(doc.columns, "COLUMN", "columns");
    duplicate(doc.tracks, "TRACK", "tracks");
    duplicate(doc.edges, "EDGE", "edges");
    duplicate(doc.strategyActions, "ACTION", "strategyActions");
    duplicate(doc.processActions, "ACTION", "processActions");

    doc.nodes.forEach((node, index) => {
      const base = `nodes[${index}]`;
      if (!node.time) errors.push(issue("TIME_REQUIRED", "流程卡片缺少时间 / 阶段", `${base}.time`));
      if (!node.executor) errors.push(issue("EXECUTOR_REQUIRED", "流程卡片缺少负责执行的角色 / 人", `${base}.executor`));
      if (!node.subject.state) errors.push(issue("SUBJECT_STATE_REQUIRED", "流程卡片缺少对象状态", `${base}.subject.state`));
      if (!node.subject.name) errors.push(issue("SUBJECT_NAME_REQUIRED", "流程卡片缺少对象名称", `${base}.subject.name`));
      if (!columns.has(node.columnId)) {
        errors.push(issue("NODE_COLUMN_MISSING", `流程卡片所属看板列不存在：${node.columnId || "空"}`, `${base}.columnId`));
      }
      if (!doc.trackMode && node.trackId !== undefined) {
        errors.push(issue("NODE_TRACK_NOT_ENABLED", "未启用业务主线时节点不能携带 trackId", `${base}.trackId`));
      }
      if (doc.trackMode && !clean(node.trackId)) {
        errors.push(issue("NODE_TRACK_MISSING", "启用业务主线后流程卡片必须归属一个 primary Track", `${base}.trackId`));
      }
      if (doc.trackMode && clean(node.trackId) && !tracks.has(node.trackId)) {
        errors.push(issue("NODE_TRACK_NOT_FOUND", `流程卡片所属业务主线不存在：${node.trackId}`, `${base}.trackId`));
      }
      if (
        !Number.isSafeInteger(node.sortOrder)
        || node.sortOrder < 0
        || node.sortOrder > 2147483647
      ) {
        errors.push(issue("NODE_SORT_ORDER_INVALID", "看板排序必须是不超过 2147483647 的非负整数", `${base}.sortOrder`));
      }
      if (!Number.isFinite(node.layout.x) || !Number.isFinite(node.layout.y)) {
        errors.push(issue("LAYOUT_INVALID", "画布坐标无效", `${base}.layout`));
      }
    });
    const columnSortOrders = new Map([...doc.columns].map(column => [column.localId, new Set()]));
    doc.nodes.forEach((node, index) => {
      if (!Number.isSafeInteger(node.sortOrder)) return;
      const sortOrders = columnSortOrders.get(node.columnId);
      if (!sortOrders) return;
      if (sortOrders.has(node.sortOrder)) {
        errors.push(issue("NODE_SORT_ORDER_DUPLICATE", `同一看板列内排序重复：${node.sortOrder}`, `nodes[${index}].sortOrder`));
        return;
      }
      sortOrders.add(node.sortOrder);
    });
    const columnOrders = new Set();
    doc.columns.forEach((column, index) => {
      const base = `columns[${index}]`;
      if (
        !Number.isSafeInteger(column.sortOrder)
        || column.sortOrder < 0
        || column.sortOrder > 2147483647
      ) {
        errors.push(issue("COLUMN_SORT_ORDER_INVALID", "看板列排序必须是不超过 2147483647 的非负整数", `${base}.sortOrder`));
        return;
      }
      if (columnOrders.has(column.sortOrder)) {
        errors.push(issue("COLUMN_SORT_ORDER_DUPLICATE", `看板列排序重复：${column.sortOrder}`, `${base}.sortOrder`));
        return;
      }
      columnOrders.add(column.sortOrder);
    });
    const trackOrders = new Set();
    doc.tracks.forEach((track, index) => {
      const base = `tracks[${index}]`;
      if (!clean(track.name)) {
        errors.push(issue("TRACK_NAME_REQUIRED", "业务主线名称不能为空", `${base}.name`));
      }
      if (
        !Number.isSafeInteger(track.sortOrder)
        || track.sortOrder < 0
        || track.sortOrder > 2147483647
      ) {
        errors.push(issue("TRACK_SORT_ORDER_INVALID", "业务主线排序必须是不超过 2147483647 的非负整数", `${base}.sortOrder`));
        return;
      }
      if (trackOrders.has(track.sortOrder)) {
        errors.push(issue("TRACK_SORT_ORDER_DUPLICATE", `业务主线排序重复：${track.sortOrder}`, `${base}.sortOrder`));
        return;
      }
      trackOrders.add(track.sortOrder);
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
      if (from?.nodeType === "classification" && edge.subjectBehavior.status !== "no_requirement") {
        errors.push(issue("CLASSIFICATION_SUBJECT_BEHAVIOR_INVALID", "对象分类卡片的出边不能要求对象发生行为；请使用无行为要求", `${base}.subjectBehavior.status`));
      }
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

    const globalTouchScenes = new Set(doc.taxonomy.selections.touchScene.map(item => item.code));
    const globalTouchMethods = new Set(doc.taxonomy.selections.touchMethod.map(item => `${item.code}:${item.parentCode}`));
    const validateActionTouchSelections = (action, base) => {
      if (!action.touchScenes.length) {
        errors.push(issue("ACTION_TOUCH_SCENE_REQUIRED", "客户触达内容至少需要一个触达场景", `${base}.touchScenes`));
      }
      if (!action.touchMethods.length) {
        errors.push(issue("ACTION_TOUCH_METHOD_REQUIRED", "客户触达内容至少需要一个触达方式", `${base}.touchMethods`));
      }

      const sceneCodes = new Set();
      action.touchScenes.forEach((item, itemIndex) => {
        const definition = TAXONOMY_FIELDS.get("touchScene").values.find(value => value.code === item.code);
        if (!definition) {
          errors.push(issue("ACTION_TOUCH_CODE_INVALID", `触达场景存在未知 taxonomy code：${item.code || "空"}`, `${base}.touchScenes[${itemIndex}].code`));
          return;
        }
        if (sceneCodes.has(item.code)) {
          errors.push(issue("ACTION_TOUCH_DUPLICATE", `触达场景重复：${item.code}`, `${base}.touchScenes[${itemIndex}].code`));
          return;
        }
        sceneCodes.add(item.code);
        if (!globalTouchScenes.has(item.code)) {
          errors.push(issue("ACTION_TOUCH_TAXONOMY_SCOPE_MISMATCH", `触达场景超出全局策略标签范围：${item.code}`, `${base}.touchScenes[${itemIndex}].code`));
        }
      });

      const methodCodes = new Set();
      action.touchMethods.forEach((item, itemIndex) => {
        const definition = TAXONOMY_FIELDS.get("touchMethod").values.find(value => value.code === item.code);
        if (!definition) {
          errors.push(issue("ACTION_TOUCH_CODE_INVALID", `触达方式存在未知 taxonomy code：${item.code || "空"}`, `${base}.touchMethods[${itemIndex}].code`));
          return;
        }
        if (methodCodes.has(item.code)) {
          errors.push(issue("ACTION_TOUCH_DUPLICATE", `触达方式重复：${item.code}`, `${base}.touchMethods[${itemIndex}].code`));
          return;
        }
        methodCodes.add(item.code);
        if (definition.parentCode !== item.parentCode) {
          errors.push(issue("ACTION_TOUCH_PARENT_MISMATCH", `触达方式 ${item.code} 的 parentCode 必须为 ${definition.parentCode}`, `${base}.touchMethods[${itemIndex}].parentCode`));
        }
        if (!sceneCodes.has(item.parentCode)) {
          errors.push(issue("ACTION_TOUCH_PARENT_MISMATCH", `触达方式 ${item.code} 必须挂在当前动作已选择的触达场景下`, `${base}.touchMethods[${itemIndex}].parentCode`));
        }
        if (!globalTouchMethods.has(`${item.code}:${item.parentCode}`)) {
          errors.push(issue("ACTION_TOUCH_TAXONOMY_SCOPE_MISMATCH", `触达方式超出全局策略标签范围：${item.code}`, `${base}.touchMethods[${itemIndex}].code`));
        }
      });

      sceneCodes.forEach(sceneCode => {
        if (!action.touchMethods.some(item => item.parentCode === sceneCode)) {
          errors.push(issue("ACTION_TOUCH_CHILD_REQUIRED", `触达场景 ${sceneCode} 至少需要一个触达方式`, `${base}.touchMethods`));
        }
      });
    };

    doc.strategyActions.forEach((action, index) => {
      const base = `strategyActions[${index}]`;
      actionNode("STRATEGY_ACTION", action, index, "strategyActions");
      [
        ["judge", "进入条件"], ["theme", "话术主题"],
        ["goal", "核心目标"], ["hook", "核心抓手"], ["copy", "文案"],
      ].forEach(([key, name]) => {
        if (!clean(action[key])) errors.push(issue("ACTION_FIELD_REQUIRED", `客户触达内容字段缺失：${name}`, `${base}.${key}`));
      });
      validateActionTouchSelections(action, base);
      if (!action.metrics.length) errors.push(issue("ACTION_FIELD_REQUIRED", "客户触达内容至少需要一个考察指标", `${base}.metrics`));
    });

    doc.processActions.forEach((action, index) => {
      const base = `processActions[${index}]`;
      actionNode("PROCESS_ACTION", action, index, "processActions");
      [
        ["scene", "执行场景"], ["condition", "什么情况下执行"],
        ["result", "执行后的结果"], ["action", "具体执行动作"], ["hook", "执行抓手"],
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
    doc.nodes.forEach((node, index) => {
      if (node.nodeType !== "classification") return;
      const base = `nodes[${index}]`;
      if (!doc.processActions.some(action => action.nodeId === node.localId)) {
        errors.push(issue("CLASSIFICATION_PROCESS_ACTION_REQUIRED", "对象分类卡片至少需要一个执行跟进动作来描述分类依据和结果", base));
      }
      if (doc.strategyActions.some(action => action.nodeId === node.localId)) {
        errors.push(issue("CLASSIFICATION_STRATEGY_ACTION_FORBIDDEN", "对象分类卡片不能挂接客户触达内容", base));
      }
      if (!doc.edges.some(edge => edge.from === node.localId && nodes.has(edge.to))) {
        errors.push(issue("CLASSIFICATION_OUTGOING_EDGE_REQUIRED", "对象分类卡片必须有出边承接分类后的处理", base));
      }
    });
    warnings.push(...doc.migrationIssues);

    return {
      status: errors.length ? "draft" : "ready_to_submit",
      errors,
      warnings,
    };
  }

  function toExportDocument(input) {
    const doc = normalizeDocument(input);
    const strategy = {...doc.strategy};
    if (!clean(strategy.strategyId)) delete strategy.strategyId;
    if (!clean(strategy.registrationCaseId)) delete strategy.registrationCaseId;
    const exported = {
      schemaVersion: SCHEMA_VERSION,
      strategy,
      taxonomy: toTaxonomyContract(doc.taxonomy),
      columns: doc.columns,
      nodes: doc.trackMode ? doc.nodes : doc.nodes.map(({trackId, ...node}) => node),
      edges: doc.edges,
      strategyActions: doc.strategyActions,
      processActions: doc.processActions,
      validation: validateDocument(doc),
    };
    if (doc.trackMode) exported.tracks = doc.tracks;
    return exported;
  }

  function toJSON(input) {
    return JSON.stringify(toExportDocument(input), null, 2);
  }

  function toRegistrationMetadataDocument(input) {
    return normalizeRegistrationMetadata(normalizeDocument(input).registrationMetadata);
  }

  function toRegistrationMetadataJSON(input) {
    return JSON.stringify(toRegistrationMetadataDocument(input), null, 2);
  }

  function validateRegistrationMetadata(input) {
    const source = input && typeof input === "object" ? input : {};
    const errors = [];
    if (source.schemaVersion !== METADATA_SCHEMA_VERSION) {
      errors.push(issue("METADATA_VERSION_UNSUPPORTED", `注册元数据契约必须是 ${METADATA_SCHEMA_VERSION}`, "schemaVersion"));
    }
    unknownKeys(source, ["schemaVersion", "businessUnit", "submitDate", "coreHook", "effectiveFrom", "baselineVersion", "triggerScenes"]).forEach(key => {
      errors.push(issue("SCHEMA_UNKNOWN_FIELD", `注册元数据未知字段：${key}`, key));
    });
    [["businessUnit", "业务归属"], ["submitDate", "提交日期"], ["coreHook", "核心抓手"], ["effectiveFrom", "生效日期"]].forEach(([key, label]) => {
      if (!clean(source[key])) errors.push(issue("METADATA_FIELD_REQUIRED", `注册元数据缺失：${label}`, key));
    });
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    ["submitDate", "effectiveFrom"].forEach(key => {
      if (clean(source[key]) && !datePattern.test(source[key])) errors.push(issue("METADATA_DATE_INVALID", "日期必须使用 YYYY-MM-DD", key));
    });
    array(source.triggerScenes).forEach((scene, index) => {
      const allowed = ["triggerSceneId", "triggerScene", "threshold", "frequency", "deduplication", "cooldown", "audienceScope", "qualification", "dataSource", "confirmationStatus"];
      unknownKeys(scene, allowed).forEach(key => errors.push(issue("SCHEMA_UNKNOWN_FIELD", `触发场景未知字段：${key}`, `triggerScenes[${index}].${key}`)));
      allowed.forEach(key => {
        if (!clean(scene?.[key])) errors.push(issue("METADATA_TRIGGER_SCENE_FIELD_REQUIRED", `触发场景缺少 ${key}`, `triggerScenes[${index}].${key}`));
      });
    });
    return { status: errors.length ? "draft" : "ready_to_submit", errors, warnings: [] };
  }

  function isOutputContractIssue(item) {
    // Unknown dictionary values are review warnings, not JSON Schema failures;
    // new labels belong in customTagProposals rather than blocking export shape.
    if (item.code === "TAG_CODE_INVALID" && item.message.includes("未知标签")) return false;
    // The same TAG_FIELD_REQUIRED code has two meanings: empty array/value is a
    // schema failure; a missing optional dictionary field is editorial advice.
    if (item.code === "TAG_FIELD_REQUIRED" && item.message.startsWith("标签字段缺失")) return false;
    if (OUTPUT_CONTRACT_ERROR_CODES.has(item.code)) return true;
    return /_(ID_INVALID|ID_DUPLICATE|NODE_MISSING|EDGE_MISSING|EDGE_SOURCE_MISMATCH)$/.test(item.code);
  }

  function outputContractGate(input) {
    const exportDocument = toExportDocument(input);
    // Normalization deliberately strips some illegal fields from the exported
    // shape (for example trackId in a no-track document). Gate the source too,
    // otherwise an imported malformed draft could launder itself through export.
    const sourceReview = validateDocument(input);
    const designReview = validateDocument(exportDocument);
    const metadataDocument = toRegistrationMetadataDocument(input);
    const metadataReview = validateRegistrationMetadata(metadataDocument);
    const issues = [
      ...sourceReview.errors.filter(item => item.path !== "registrationMetadata" && !item.path.startsWith("registrationMetadata.")),
      ...designReview.errors.filter(item => !item.path.startsWith("registrationMetadata.")),
      ...metadataReview.errors,
    ];
    if (!exportDocument.taxonomy.tagSelections.length) {
      issues.push({
        code: "TAXONOMY_FIELD_REQUIRED",
        message: "taxonomy.tagSelections 至少需要一个值",
        path: "taxonomy.tagSelections",
      });
    }

    const seen = new Set();
    const blocking = [];
    const warnings = [...designReview.warnings];
    for (const item of issues) {
      const key = `${item.code}:${item.path}:${item.message}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isOutputContractIssue(item)) blocking.push(item);
      else warnings.push(item);
    }
    return {
      ready: blocking.length === 0,
      blocking,
      warnings,
      designStatus: blocking.length ? "draft" : "ready_to_submit",
      metadataStatus: metadataReview.errors.length ? "draft" : "ready_to_submit",
    };
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
        `执行人：${edge.actorBehavior.time || "时间待确认"}·${actorStatus}${edge.actorBehavior.status === "no_requirement" ? "" : `·${edge.actorBehavior.action || "动作待确认"}`}`,
        `对象：${edge.subjectBehavior.time || "时间待确认"}·${subjectStatus}${edge.subjectBehavior.status === "no_requirement" ? "" : `·${edge.subjectBehavior.action || "行为待确认"}`}`,
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

  function autoLayoutDocument(input) {
    const doc = normalizeDocument(input);
    if (!doc.nodes.length) return doc;
    const ids = doc.nodes.map(node => node.localId);
    const idSet = new Set(ids);
    const allOutgoing = new Map(ids.map(id => [id, []]));
    const allIncoming = new Map(ids.map(id => [id, []]));
    doc.edges.forEach(edge => {
      if (idSet.has(edge.from) && idSet.has(edge.to) && edge.from !== edge.to) {
        allOutgoing.get(edge.from).push(edge.to);
        allIncoming.get(edge.to).push(edge.from);
      }
    });

    // Detect back edges first, then rank only the remaining forward graph.
    // Recycle / reentry therefore cannot collapse later stages onto stage one.
    const visitState = new Map(ids.map(id => [id, "unvisited"]));
    const backEdges = new Set();
    const finished = [];
    const visit = id => {
      if (visitState.get(id) !== "unvisited") return;
      visitState.set(id, "active");
      allOutgoing.get(id).forEach(target => {
        if (visitState.get(target) === "active") backEdges.add(`${id}>${target}`);
        else visit(target);
      });
      visitState.set(id, "done");
      finished.push(id);
    };
    ids.forEach(visit);
    const forwardOutgoing = new Map(ids.map(id => [
      id,
      allOutgoing.get(id).filter(target => !backEdges.has(`${id}>${target}`)),
    ]));
    const forwardIncoming = new Map(ids.map(id => [
      id,
      allIncoming.get(id).filter(source => !backEdges.has(`${source}>${id}`)),
    ]));

    const ranks = new Map(ids.map(id => [id, 0]));
    [...finished].reverse().forEach(id => {
      forwardOutgoing.get(id).forEach(target => {
        ranks.set(target, Math.max(ranks.get(target), ranks.get(id) + 1));
      });
    });

    const isolated = new Set(ids.filter(id => !allOutgoing.get(id).length && !allIncoming.get(id).length));
    let levels = new Map();
    ids.forEach(id => {
      if (isolated.has(id)) return;
      const rank = ranks.get(id);
      if (!levels.has(rank)) levels.set(rank, []);
      levels.get(rank).push(id);
    });
    const rankKeys = [...levels.keys()].sort((a, b) => a - b);
    if (isolated.size) {
      const isolatedRank = (rankKeys.at(-1) ?? -1) + 1;
      levels.set(isolatedRank, [...isolated]);
      rankKeys.push(isolatedRank);
    }

    const position = new Map();
    rankKeys.forEach(rank => levels.get(rank).forEach((id, index) => position.set(id, index)));
    const barycenter = (id, neighbors, fallback) => neighbors.length
      ? neighbors.reduce((sum, neighbor) => sum + position.get(neighbor), 0) / neighbors.length
      : fallback;
    for (let sweep = 0; sweep < 4; sweep += 1) {
      rankKeys.forEach(rank => {
        levels.get(rank).sort((a, b) =>
          barycenter(a, forwardIncoming.get(a), position.get(a))
          - barycenter(b, forwardIncoming.get(b), position.get(b)));
        levels.get(rank).forEach((id, index) => position.set(id, index));
      });
      [...rankKeys].reverse().forEach(rank => {
        levels.get(rank).sort((a, b) =>
          barycenter(a, forwardOutgoing.get(a), position.get(a))
          - barycenter(b, forwardOutgoing.get(b), position.get(b)));
        levels.get(rank).forEach((id, index) => position.set(id, index));
      });
    }

    rankKeys.forEach((rank, rankIndex) => {
      levels.get(rank).forEach((id, index) => {
        const node = doc.nodes.find(item => item.localId === id);
        if (node) node.layout = {
          x: 100 + rankIndex * AUTO_LAYOUT_RANK_GAP,
          y: 100 + index * AUTO_LAYOUT_LEVEL_GAP,
        };
      });
    });
    // Automatic layout owns geometry. Keeping old manual normal offsets would
    // let a previous drag push the regenerated curve/label back into a card.
    doc.edges.forEach(edge => {
      edge.layout = {...edge.layout, normalOffset: 0};
    });
    return doc;
  }

  function parseAgentDraft(value) {
    if (value?.schemaVersion !== "strategy-agent-strategy-draft/0.1") {
      return {ok: false, error: "草稿必须是 strategy-agent-strategy-draft/0.1"};
    }
    if (![SCHEMA_VERSION_0_2, SCHEMA_VERSION_0_3, SCHEMA_VERSION_0_4, SCHEMA_VERSION_0_5, SCHEMA_VERSION_0_6, SCHEMA_VERSION_0_7, SCHEMA_VERSION_0_8].includes(value.candidate?.schemaVersion)) {
      return {ok: false, error: "candidate 必须是 strategy-flow-input/0.2、0.3、0.4、0.5、0.6、0.7 或 0.8"};
    }
    if (value.registrationMetadataCandidate?.schemaVersion !== METADATA_SCHEMA_VERSION) {
      return {ok: false, error: "registrationMetadataCandidate 必须是 strategy-flow-registration-metadata/2.0"};
    }
    return {ok: true, draft: value};
  }

  function agentDraftGate(draft) {
    // A draft is deliberately allowed to be incomplete. The editor is the
    // human-in-loop workspace; contract correctness is enforced at export.
    const warnings = [];
    const seen = new Set();
    const push = (target, pointer, reason, questionId) => {
      const key = `${target}:${pointer}:${reason}`;
      if (seen.has(key)) return;
      seen.add(key);
      warnings.push({target, pointer, reason, ...(questionId ? {questionId} : {})});
    };
    for (const item of draft?.provenance ?? []) {
      if (item.status === "missing" || item.status === "conflict") {
        push(item.target ?? "design", item.pointer, item.status);
      }
    }
    for (const question of draft?.openQuestions ?? []) {
      push(question.target ?? "design", question.pointer, "open_question", question.questionId);
    }
    const contract = outputContractGate({
      ...draft.candidate,
      registrationMetadata: draft.registrationMetadataCandidate,
    });
    warnings.push(...contract.blocking.map(item => ({target: "design", pointer: item.path, reason: item.code})));
    return {
      blocked: [],
      warnings,
      ready: true,
      designStatus: contract.designStatus,
      metadataStatus: contract.metadataStatus,
    };
  }

  function agentEvidenceIndex(corpus) {
    const index = new Map();
    for (const fragment of corpus?.fragments ?? []) {
      index.set(fragment.evidenceId, fragment);
    }
    return index;
  }

  function migrateDocument(value, trackAssignment = null) {
    const source = value && typeof value === "object" ? value : {};
    const sourceVersion = parseSchemaVersion(source.schemaVersion);
    if (!sourceVersion.valid || !SUPPORTED_SCHEMA_VERSIONS.includes(sourceVersion.raw)) {
      return {ok: false, errors: [issue("SCHEMA_VERSION_UNSUPPORTED", `不支持的迁移来源版本：${sourceVersion.raw || "空"}`, "schemaVersion")]};
    }
    if (sourceVersion.raw === SCHEMA_VERSION_0_8) {
      return {ok: false, errors: [issue("SCHEMA_VERSION_UNSUPPORTED", "0.8 文档无需迁移；请直接导入", "schemaVersion")]};
    }
    if (trackAssignment === null || trackAssignment === undefined) {
      const documentValue = normalizeDocument(source);
      return {ok: true, document: documentValue, validation: validateDocument(documentValue)};
    }
    if (!trackAssignment || typeof trackAssignment !== "object" || Array.isArray(trackAssignment)) {
      return {ok: false, errors: [issue("MIGRATION_TRACK_ASSIGNMENT_INVALID", "显式 Track 分配必须是对象", "trackAssignment")]};
    }
    const errors = [];
    unknownKeys(trackAssignment, ["tracks", "nodeTrackIds"]).forEach(key => {
      errors.push(issue("MIGRATION_TRACK_ASSIGNMENT_INVALID", `显式 Track 分配未知字段：${key}`, `trackAssignment.${key}`));
    });
    const tracks = array(trackAssignment.tracks).map(normalizeTrack);
    const assignments = trackAssignment.nodeTrackIds && typeof trackAssignment.nodeTrackIds === "object"
      && !Array.isArray(trackAssignment.nodeTrackIds)
      ? trackAssignment.nodeTrackIds
      : null;
    if (!assignments) {
      return {ok: false, errors: [issue("MIGRATION_TRACK_ASSIGNMENT_INVALID", "nodeTrackIds 必须是节点 ID 到 Track ID 的对象", "trackAssignment.nodeTrackIds")]};
    }
    const trackIds = new Set(tracks.map(track => clean(track.localId)));
    const nodeIds = new Set(array(source.nodes).map(node => clean(node?.localId)));
    const assignedNodeIds = new Set(Object.keys(assignments));
    const missing = [...nodeIds].filter(id => id && !assignedNodeIds.has(id));
    const unknown = [...assignedNodeIds].filter(id => !nodeIds.has(id));
    if (errors.length) return {ok: false, errors};
    missing.forEach(id => errors.push(issue("MIGRATION_TRACK_ASSIGNMENT_INCOMPLETE", `显式 Track 分配缺少节点：${id}`, `trackAssignment.nodeTrackIds.${id}`)));
    unknown.forEach(id => errors.push(issue("MIGRATION_TRACK_ASSIGNMENT_UNKNOWN_NODE", `显式 Track 分配引用了不存在的节点：${id}`, `trackAssignment.nodeTrackIds.${id}`)));
    Object.entries(assignments).forEach(([nodeId, trackId]) => {
      if (!trackIds.has(clean(trackId))) {
        errors.push(issue("MIGRATION_TRACK_ASSIGNMENT_UNKNOWN_TRACK", `节点 ${nodeId} 引用了不存在的 Track：${clean(trackId) || "空"}`, `trackAssignment.nodeTrackIds.${nodeId}`));
      }
    });
    if (errors.length) return {ok: false, errors};

    const migratedSource = {
      ...source,
      schemaVersion: SCHEMA_VERSION_0_8,
      tracks,
      nodes: array(source.nodes).map(node => ({...node, trackId: assignments[clean(node?.localId)]})),
    };
    const documentValue = normalizeDocument(migratedSource);
    const validation = validateDocument(documentValue);
    return {ok: validation.errors.length === 0, document: documentValue, validation};
  }

  const publicApi = {
    SCHEMA_VERSION,
    SCHEMA_VERSION_0_1,
    SCHEMA_VERSION_0_2,
    SCHEMA_VERSION_0_3,
    SCHEMA_VERSION_0_4,
    SCHEMA_VERSION_0_5,
    SCHEMA_VERSION_0_6,
    SCHEMA_VERSION_0_7,
    SCHEMA_VERSION_0_8,
    SUPPORTED_SCHEMA_VERSIONS,
    TAXONOMY_SCHEMA_VERSION,
    TAXONOMY_FIELDS,
    NODE_TYPES,
    EDGE_TYPES,
    ACTOR_STATUSES,
    SUBJECT_STATUSES,
    defaultDocument,
    normalizeDocument,
    migrateDocument,
    validateDocument,
    validateRegistrationMetadata,
    outputContractGate,
    toExportDocument,
    toJSON,
    toRegistrationMetadataDocument,
    toRegistrationMetadataJSON,
    parseSchemaVersion,
    parseAgentDraft,
    agentDraftGate,
    agentEvidenceIndex,
    toTaxonomyContract,
    toMermaid,
    autoLayoutDocument,
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
    // Fluent Reveal: track cursor as CSS vars so cards can paint a radial highlight
    // without re-triggering layout. rAF-throttled to coalesce pointer storms.
    let revealQueued = false;
    document.addEventListener("mousemove", event => {
      if (revealQueued) return;
      revealQueued = true;
      requestAnimationFrame(() => {
        revealQueued = false;
        const target = event.target instanceof Element ? event.target.closest(".side-block,.taxonomy-group") : null;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        target.style.setProperty("--my", `${event.clientY - rect.top}px`);
      });
    }, { passive: true });
    const canvasShell = el("canvasShell");
    const canvasSize = el("canvasSize");
    const canvas = el("canvas");
    const nodeLayer = el("nodeLayer");
    const edgeLabelLayer = el("edgeLabelLayer");
    const edgeSvg = el("edgeSvg");
    const selectionBox = el("selectionBox");
    const inspector = el("inspector");
    const registrationDrawer = el("registrationDrawer");
    const registrationTabs = el("registrationTabs");
    const registrationDrawerContent = el("registrationDrawerContent");
    const toastEl = el("toast");
    let documentState = defaultDocument();
    let selected = null;
    let selection = new Set();
    let clipboard = null;
    let nodeDrag = null;
    let selectionDrag = null;
    let canvasPan = null;
    let connecting = null;
    let edgeLabelDrag = null;
    let panelResize = null;
    let lastCanvasClick = null;
    let toastTimer = null;
    let saveStatusTimer = null;
    let clickOrigin = null;
    let inspectorContent = null;
    let activeInspectorTab = "basic";
    let validationFilter = "all";
    let openTouchDropdown = null;
    let touchFocusCode = null;
    const historyState = { past: [], future: [], lastKey: null, lastAt: 0 };
    const layoutState = {
      left: true,
      right: true,
      bottom: true,
      leftWidth: 238,
      rightWidth: 340,
      bottomHeight: Math.max(260, Math.round(window.innerHeight * .32)),
      zoom: 1,
    };
    const CANVAS_BASE = { width: 4800, height: 3200 };
    const CANVAS_ZOOM_LIMITS = { min: 0.25, max: 1.5 };

    const NODE_TYPE_LABELS = new Map([
      ["entry", "开始进入"], ["classification", "对象分类"], ["process", "中间跟进"], ["wait", "等待观察"], ["outcome", "目标达成"],
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
        if (Number.isFinite(Number(saved?.leftWidth))) layoutState.leftWidth = Number(saved.leftWidth);
        if (Number.isFinite(Number(saved?.rightWidth))) layoutState.rightWidth = Number(saved.rightWidth);
        if (Number.isFinite(Number(saved?.bottomHeight))) layoutState.bottomHeight = Number(saved.bottomHeight);
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
      // 折叠时把轨道变量一并归零；内联变量优先级高于类规则，
      // 只改 class 不归零变量会让面板继续占住原宽度。
      root.style.setProperty("--left-col", layoutState.left ? `${Math.round(layoutState.leftWidth)}px` : "0px");
      root.style.setProperty("--right-col", layoutState.right ? `${Math.round(layoutState.rightWidth)}px` : "0px");
      root.style.setProperty("--bottom-row", layoutState.bottom ? `${Math.round(layoutState.bottomHeight)}px` : "0px");
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

    function activatePanelView(viewId) {
      document.querySelectorAll(".panel-tabs [data-panel]").forEach(button => {
        button.classList.toggle("on", button.dataset.panel === viewId);
      });
      document.querySelectorAll(".panel-view").forEach(view => {
        view.classList.toggle("on", view.id === viewId);
      });
    }

    function panelSizeLimits() {
      const effectiveRight = layoutState.right ? layoutState.rightWidth : 0;
      const effectiveLeft = layoutState.left ? layoutState.leftWidth : 0;
      return {
        left: { min: 190, max: Math.max(220, window.innerWidth - effectiveRight - 520) },
        right: { min: 300, max: Math.max(330, window.innerWidth - effectiveLeft - 520) },
        bottom: { min: 220, max: Math.max(250, window.innerHeight - 280) },
      };
    }

    function setPanelSize(name, size) {
      const limits = panelSizeLimits()[name];
      const value = Math.round(Math.min(limits.max, Math.max(limits.min, size)));
      if (name === "left") layoutState.leftWidth = value;
      if (name === "right") layoutState.rightWidth = value;
      if (name === "bottom") layoutState.bottomHeight = value;
      renderLayout();
      return value;
    }

    function startPanelResize(event) {
      const handle = event.target.closest("[data-panel-resizer]");
      if (!handle) return;
      event.preventDefault();
      panelResize = {
        name: handle.dataset.panelResizer,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: layoutState.leftWidth,
        startRight: layoutState.rightWidth,
        startBottom: layoutState.bottomHeight,
      };
      handle.setPointerCapture?.(event.pointerId);
      document.body.classList.add("panel-resizing", `resizing-${panelResize.name}`);
    }

    function openInspectorFor(kind, id) {
      selected = { kind, id };
      if (!layoutState.right) setPanelVisible("right", true);
      renderAll();
      requestAnimationFrame(() => {
        inspector.querySelector("input, select, textarea")?.focus?.();
      });
    }

    function selectionKey(kind, id) {
      return `${kind}:${id}`;
    }

    function isSelected(kind, id) {
      return selection.has(selectionKey(kind, id))
        || (selected?.kind === kind && selected.id === id);
    }

    function setSelection(entries = [], primary = null) {
      selection = new Set(entries.map(entry => selectionKey(entry.kind, entry.id)));
      selected = primary ? { kind: primary.kind, id: primary.id } : null;
      if (selected && !selection.has(selectionKey(selected.kind, selected.id))) {
        selection.add(selectionKey(selected.kind, selected.id));
      }
    }

    function toggleSelection(kind, id) {
      const key = selectionKey(kind, id);
      const next = new Set(selection);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      selection = next;
      selected = null;
    }

    function clearSelection() {
      selection = new Set();
      selected = null;
    }

    function selectedEntries() {
      const entries = [...selection].map(key => {
        const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
        return { kind, id };
      });
      if (!entries.length && selected) return [{ kind: selected.kind, id: selected.id }];
      return entries;
    }

    function selectedNodeIds() {
      return selectedEntries()
        .filter(entry => entry.kind === "node")
        .map(entry => entry.id)
        .filter(id => documentState.nodes.some(node => node.localId === id));
    }

    function applyBulkNodeAssignment(field, targetId) {
      if (!["columnId", "trackId"].includes(field)) return;
      const nodes = selectedNodeIds()
        .map(id => documentState.nodes.find(node => node.localId === id))
        .filter(Boolean);
      if (nodes.length < 2 || clean(targetId) === "") return;
      if (field === "columnId" && !documentState.columns.some(column => column.localId === targetId)) {
        toast("批量归属的目标看板列不存在", true);
        renderInspector();
        return;
      }
      if (field === "trackId" && (!documentState.trackMode || !documentState.tracks.some(track => track.localId === targetId))) {
        toast("批量归属的目标业务主线不存在", true);
        renderInspector();
        return;
      }
      if (!nodes.some(node => node[field] !== targetId)) {
        toast("所选卡片已全部归属该目标");
        return;
      }

      pushHistory(`bulk-assign-${field}.${targetId}`);
      nodes.forEach(node => {
        node[field] = targetId;
      });
      renderAll();
      toast(`已批量修改 ${nodes.length} 张卡片的所属${field === "columnId" ? "看板列" : "业务主线"}`);
    }

    function snapshotState() {
      return {
        document: JSON.parse(JSON.stringify(documentState)),
        selected: selected ? { ...selected } : null,
        selection: [...selection],
      };
    }

    function pushHistory(coalesceKey = "") {
      const now = Date.now();
      if (coalesceKey && coalesceKey === historyState.lastKey && now - historyState.lastAt < 900) {
        historyState.lastAt = now;
        return;
      }
      historyState.past.push(snapshotState());
      if (historyState.past.length > 100) historyState.past.shift();
      historyState.future = [];
      historyState.lastKey = coalesceKey;
      historyState.lastAt = now;
    }

    function restoreHistory(snapshot) {
      documentState = normalizeDocument(snapshot.document);
      selection = new Set(snapshot.selection || []);
      selected = snapshot.selected || null;
      const current = selectedObject();
      if (selected && !current?.value) {
        clearSelection();
      }
      renderAll();
    }

    function undo() {
      const previous = historyState.past.pop();
      if (!previous) return toast("没有可撤销的操作");
      historyState.future.push(snapshotState());
      historyState.lastKey = "";
      restoreHistory(previous);
      toast("已撤销");
    }

    function redo() {
      const next = historyState.future.pop();
      if (!next) return toast("没有可重做的操作");
      historyState.past.push(snapshotState());
      historyState.lastKey = "";
      restoreHistory(next);
      toast("已重做");
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
      if (selected.kind === "column") {
        return { kind: "column", value: documentState.columns.find(item => item.localId === selected.id) || null };
      }
      if (selected.kind === "track") {
        return { kind: "track", value: documentState.tracks.find(item => item.localId === selected.id) || null };
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
      if (collectionName === "taxonomy" || collectionName === "registrationMetadata") {
        return keys.reduce((value, key) => value?.[key], documentState[collectionName]);
      }
      if (collectionName === "strategy") {
        return keys.reduce((value, key) => value?.[key], documentState.strategy);
      }
      const collection = {
        nodes: documentState.nodes,
        columns: documentState.columns,
        tracks: documentState.tracks,
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
      if (collectionName === "taxonomy" || collectionName === "registrationMetadata") {
        remainingKeys = keys;
        let parent = documentState[collectionName];
        remainingKeys.forEach(key => {
          if (parent[key] === null || typeof parent[key] !== "object") parent[key] = {};
          parent = parent[key];
        });
        if (!parent) return;
        parent[last] = value;
        return;
      }
      if (collectionName === "strategy") {
        remainingKeys = keys;
      } else {
        const collection = {
          nodes: documentState.nodes,
          columns: documentState.columns,
          tracks: documentState.tracks,
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

    function addColumn() {
      pushHistory("add-column");
      const column = normalizeColumn({
        localId: nextId("c", documentState.columns),
        sortOrder: nextSortOrder(documentState.columns),
      });
      documentState.columns.push(column);
      selected = { kind: "column", id: column.localId };
      renderAll();
    }

    function setTrackMode(enabled) {
      pushHistory(enabled ? "enable-tracks" : "disable-tracks");
      documentState.trackMode = enabled === true;
      if (documentState.trackMode && !documentState.tracks.length) {
        documentState.tracks.push(normalizeTrack({
          localId: nextId("t", documentState.tracks),
          name: "业务主线一",
          sortOrder: 10,
        }));
      }
      if (!documentState.trackMode) {
        documentState.tracks = [];
        documentState.nodes.forEach(node => {
          delete node.trackId;
        });
      }
      renderAll();
      toast(documentState.trackMode ? "已启用业务主线；请为每张卡片显式选择归属" : "已关闭业务主线；导出将省略 tracks 和 trackId");
    }

    function addTrack() {
      if (!documentState.trackMode) return;
      pushHistory("add-track");
      const track = normalizeTrack({
        localId: nextId("t", documentState.tracks),
        name: `业务主线${documentState.tracks.length + 1}`,
        sortOrder: nextSortOrder(documentState.tracks),
      });
      documentState.tracks.push(track);
      selected = { kind: "track", id: track.localId };
      renderAll();
    }

    function addNode(type) {
      const shellRect = canvasShell.getBoundingClientRect();
      const centerX = (canvasShell.scrollLeft + shellRect.width / 2) / layoutState.zoom;
      const centerY = (canvasShell.scrollTop + shellRect.height / 2) / layoutState.zoom;
      const x = Math.max(20, centerX - 125 + documentState.nodes.length * 18);
      const y = Math.max(20, centerY - 60 + documentState.nodes.length * 18);
      const current = selectedObject();
      const columnId = current?.kind === "column"
        ? current.value.localId
        : current?.kind === "node"
          ? current.value.columnId
          : documentState.columns[0]?.localId || "";
      pushHistory("add-node");
      if (!columnId) {
        const column = normalizeColumn({localId: nextId("c", documentState.columns), sortOrder: 10});
        documentState.columns.push(column);
      }
      const targetColumnId = columnId || documentState.columns[0].localId;
      const node = normalizeNode({
        localId: nextId("n", documentState.nodes),
        nodeType: type,
        time: "待确认",
        executor: "系统",
        columnId: targetColumnId,
        sortOrder: nextSortOrder(documentState.nodes.filter(item => item.columnId === targetColumnId)),
        subject: {
          type: defaultSubjectType(),
          name: "待确认",
          state: type === "classification" ? "待分类" : "待确认",
        },
        layout: { x, y },
      }, documentState.nodes.length, NODE_TYPES, "", documentState.trackMode);
      if (type === "classification") documentState.sourceSchemaVersion = SCHEMA_VERSION;
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
        judge: "待确认",
        touchScenes: [],
        touchMethods: [],
        theme: "待确认",
        goal: "待确认",
        hook: "待确认",
        copy: "待确认",
        metrics: ["待确认"],
      });
      pushHistory("add-strategy-action");
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
        scene: "待确认",
        condition: "待确认",
        result: "待确认",
        action: "待确认",
        hook: "待确认",
        metrics: ["待确认"],
      });
      pushHistory("add-process-action");
      documentState.processActions.push(action);
      selected = { kind: "processAction", id: action.localId };
      renderAll();
    }

    function addCustomTagProposal() {
      pushHistory("add-custom-tag-proposal");
      documentState.taxonomy.customTagProposals.push(normalizeCustomTagProposal({
        proposalId: "",
        fieldCode: "businessScene",
        label: "",
        reason: "",
      }));
      renderAll();
    }

    function addTriggerScene() {
      pushHistory("add-trigger-scene");
      documentState.registrationMetadata.triggerScenes.push(normalizeRegistrationMetadata({
        triggerScenes: [{}],
      }).triggerScenes[0]);
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
      pushHistory("connect");
      documentState.edges.push(edge);
      selected = { kind: "edge", id: edge.localId };
      renderAll();
    }

    function deleteSelected() {
      const entries = selectedEntries().filter(entry => ["node", "edge", "strategyAction", "processAction", "column", "track"].includes(entry.kind));
      if (!entries.length) return;
      const columnIds = new Set(entries.filter(item => item.kind === "column").map(item => item.id));
      const nonemptyColumn = [...columnIds].find(id => documentState.nodes.some(node => node.columnId === id));
      if (nonemptyColumn) return toast("看板列内还有流程卡片，先移动或删除卡片", true);
      const trackIds = new Set(entries.filter(item => item.kind === "track").map(item => item.id));
      const nonemptyTrack = [...trackIds].find(id => documentState.nodes.some(node => node.trackId === id));
      if (nonemptyTrack) return toast("业务主线内还有流程卡片，先改派或删除卡片", true);
      pushHistory(`delete:${entries.map(item => item.id).sort().join(",")}`);
      const nodeIds = new Set(entries.filter(item => item.kind === "node").map(item => item.id));
      const edgeIds = new Set(entries.filter(item => item.kind === "edge").map(item => item.id));
      // A selected card also removes its connected edges and mounted actions.
      // Explicitly selected actions without a selected card are removed too.
      if (nodeIds.size) {
        documentState.nodes.forEach(node => {
          if (!nodeIds.has(node.localId)) return;
          documentState.edges.forEach(edge => {
            if (edge.from === node.localId || edge.to === node.localId) edgeIds.add(edge.localId);
          });
        });
      }
      if (edgeIds.size) {
        documentState.strategyActions.forEach(item => { if (edgeIds.has(item.outgoingEdgeId)) item.outgoingEdgeId = ""; });
        documentState.processActions.forEach(item => { if (edgeIds.has(item.outgoingEdgeId)) item.outgoingEdgeId = ""; });
      }
      const actionEntries = new Set(entries.filter(item => item.kind === "strategyAction" || item.kind === "processAction").map(item => `${item.kind}:${item.id}`));
      documentState.columns = documentState.columns.filter(item => !columnIds.has(item.localId));
      documentState.tracks = documentState.tracks.filter(item => !trackIds.has(item.localId));
      documentState.nodes = documentState.nodes.filter(item => !nodeIds.has(item.localId));
      documentState.edges = documentState.edges.filter(item => !edgeIds.has(item.localId));
      documentState.strategyActions = documentState.strategyActions.filter(item =>
        !nodeIds.has(item.nodeId) && !actionEntries.has(`strategyAction:${item.localId}`));
      documentState.processActions = documentState.processActions.filter(item =>
        !nodeIds.has(item.nodeId) && !actionEntries.has(`processAction:${item.localId}`));
      clearSelection();
      renderAll();
    }

    function copySelection() {
      const entries = selectedEntries().filter(entry => ["node", "edge"].includes(entry.kind));
      if (!entries.length) return toast("请先选择卡片或流转规则", true);
      const nodeIds = new Set(entries.filter(item => item.kind === "node").map(item => item.id));
      const edgeIds = new Set(entries.filter(item => item.kind === "edge").map(item => item.id));
      const nodes = JSON.parse(JSON.stringify(documentState.nodes.filter(item => nodeIds.has(item.localId))));
      const nodeColumnIds = new Set(nodes.map(item => item.columnId));
      const columns = JSON.parse(JSON.stringify(documentState.columns.filter(item => nodeColumnIds.has(item.localId))));
      const nodeTrackIds = new Set(nodes.map(item => item.trackId).filter(Boolean));
      const tracks = documentState.trackMode
        ? JSON.parse(JSON.stringify(documentState.tracks.filter(item => nodeTrackIds.has(item.localId))))
        : [];
      const edges = JSON.parse(JSON.stringify(documentState.edges.filter(item => edgeIds.has(item.localId))));
      const strategyActions = JSON.parse(JSON.stringify(
        documentState.strategyActions.filter(item => nodeIds.has(item.nodeId))
      ));
      const processActions = JSON.parse(JSON.stringify(
        documentState.processActions.filter(item => nodeIds.has(item.nodeId))
      ));
      if (!nodes.length && !edges.length) return toast("没有可复制的内容", true);
      clipboard = {
        columns,
        tracks,
        nodes,
        edges,
        strategyActions,
        processActions,
        origin: nodes.length ? {
          x: Math.min(...nodes.map(item => item.layout.x)),
          y: Math.min(...nodes.map(item => item.layout.y)),
        } : { x: 0, y: 0 },
      };
      toast(`已复制 ${nodes.length} 张卡片、${edges.length} 条流转规则`);
    }

    function pasteClipboard() {
      if (!clipboard?.nodes?.length && !clipboard?.edges?.length) return toast("剪贴板为空", true);
      pushHistory("paste");
      const nodeMap = new Map();
      const edgeMap = new Map();
      const nodes = [];
      const tracks = [];
      const existingColumnIds = new Set(documentState.columns.map(item => item.localId));
      const existingTrackIds = new Set(documentState.tracks.map(item => item.localId));
      const trackMap = new Map();
      if (documentState.trackMode) {
        clipboard.tracks?.forEach(item => {
          const localId = existingTrackIds.has(item.localId)
            ? item.localId
            : nextId("t", [...documentState.tracks, ...tracks]);
          trackMap.set(item.localId, localId);
          if (!existingTrackIds.has(localId)) {
            tracks.push(normalizeTrack({...item, localId, sortOrder: nextSortOrder([...documentState.tracks, ...tracks])}));
            existingTrackIds.add(localId);
          }
        });
      }
      clipboard.columns?.forEach(item => {
        if (!existingColumnIds.has(item.localId)) {
          documentState.columns.push(normalizeColumn(item));
          existingColumnIds.add(item.localId);
        }
      });
      clipboard.nodes.forEach(item => {
        const localId = nextId("n", [...documentState.nodes, ...nodes]);
        const columnNodes = [...documentState.nodes, ...nodes].filter(candidate => candidate.columnId === item.columnId);
        nodeMap.set(item.localId, localId);
        nodes.push(normalizeNode({
          ...item,
          localId,
          trackId: trackMap.get(item.trackId) || "",
          sortOrder: nextSortOrder(columnNodes),
          layout: { x: item.layout.x, y: item.layout.y },
        }, 0, NODE_TYPES, "", documentState.trackMode));
      });
      const edges = [];
      clipboard.edges.forEach(item => {
        const localId = nextId("e", [...documentState.edges, ...edges]);
        edgeMap.set(item.localId, localId);
        edges.push(normalizeEdge({
          ...item,
          localId,
          from: nodeMap.get(item.from) || item.from,
          to: nodeMap.get(item.to) || item.to,
        }));
      });
      const strategyActions = [];
      clipboard.strategyActions.forEach(item => {
        strategyActions.push(normalizeStrategyAction({
          ...item,
          localId: nextId("sa", [...documentState.strategyActions, ...strategyActions]),
          nodeId: nodeMap.get(item.nodeId) || item.nodeId,
          outgoingEdgeId: edgeMap.get(item.outgoingEdgeId) || "",
        }));
      });
      const processActions = [];
      clipboard.processActions.forEach(item => {
        processActions.push(normalizeProcessAction({
          ...item,
          localId: nextId("pa", [...documentState.processActions, ...processActions]),
          nodeId: nodeMap.get(item.nodeId) || item.nodeId,
          outgoingEdgeId: edgeMap.get(item.outgoingEdgeId) || "",
        }));
      });
      const offsetX = 36;
      const offsetY = clipboard.nodes.length ? 36 : 0;
      nodes.forEach(node => {
        node.layout = {
          x: Math.max(0, node.layout.x - clipboard.origin.x + offsetX),
          y: Math.max(0, node.layout.y - clipboard.origin.y + offsetY),
        };
      });
      documentState.nodes.push(...nodes);
      documentState.tracks.push(...tracks);
      documentState.edges.push(...edges);
      documentState.strategyActions.push(...strategyActions);
      documentState.processActions.push(...processActions);
      setSelection([
        ...nodes.map(item => ({ kind: "node", id: item.localId })),
        ...edges.map(item => ({ kind: "edge", id: item.localId })),
      ]);
      renderAll();
      toast(`已粘贴 ${nodes.length} 张卡片、${edges.length} 条流转规则`);
    }

    function renderColumns() {
      const list = el("columnList");
      if (!list) return;
      const columns = [...documentState.columns].sort((a, b) => a.sortOrder - b.sortOrder);
      list.innerHTML = columns.length ? columns.map(column => {
        const count = documentState.nodes.filter(node => node.columnId === column.localId).length;
        return `<button type="button" class="column-item${isSelected("column", column.localId) ? " selected" : ""}" data-select-column="${escapeHtml(column.localId)}">
          <b>${escapeHtml(column.localId)}</b>
          <small>列排序 ${escapeHtml(String(column.sortOrder ?? "待确认"))} · ${count} 卡</small>
        </button>`;
      }).join("") : `<p class="field-help">还没有看板列；新增流程卡片时会自动创建默认列 c1。</p>`;
    }

    function renderTracks() {
      const list = el("trackList");
      const modeButton = el("trackModeBtn");
      const addButton = el("addTrackBtn");
      if (!list || !modeButton || !addButton) return;
      modeButton.textContent = documentState.trackMode ? "已启用" : "未启用";
      modeButton.classList.toggle("on", documentState.trackMode);
      modeButton.setAttribute("aria-pressed", documentState.trackMode ? "true" : "false");
      list.hidden = !documentState.trackMode;
      addButton.hidden = !documentState.trackMode;
      if (!documentState.trackMode) return;
      const tracks = [...documentState.tracks].sort((a, b) => a.sortOrder - b.sortOrder);
      list.innerHTML = tracks.length ? tracks.map(track => {
        const count = documentState.nodes.filter(node => node.trackId === track.localId).length;
        return `<button type="button" class="track-item${isSelected("track", track.localId) ? " selected" : ""}" data-select-track="${escapeHtml(track.localId)}">
          <b>${escapeHtml(track.name || track.localId)}</b>
          <small>${escapeHtml(track.localId)} · 排序 ${escapeHtml(String(track.sortOrder ?? "待确认"))} · ${count} 卡</small>
        </button>`;
      }).join("") : `<p class="field-help">还没有业务主线；至少定义一条后才能完成归属。</p>`;
    }

    function renderNodes() {
      nodeLayer.innerHTML = documentState.nodes.map(node => {
        const strategyActions = documentState.strategyActions.filter(item => item.nodeId === node.localId);
        const processActions = documentState.processActions.filter(item => item.nodeId === node.localId);
        const chips = [
          ...strategyActions.map(item => `<button type="button" class="action-chip strategy${isSelected("strategyAction", item.localId) ? " selected" : ""}" data-select-kind="strategyAction" data-select-id="${escapeHtml(item.localId)}">触达·${escapeHtml(item.theme || "待确认")}</button>`),
          ...processActions.map(item => `<button type="button" class="action-chip process${isSelected("processAction", item.localId) ? " selected" : ""}" data-select-kind="processAction" data-select-id="${escapeHtml(item.localId)}">跟进·${escapeHtml(item.action || "待确认")}</button>`),
        ].join("");
        return `<article class="node-card${isSelected("node", node.localId) ? " selected" : ""}" data-id="${escapeHtml(node.localId)}" data-type="${escapeHtml(node.nodeType)}" style="transform:translate(${node.layout.x}px,${node.layout.y}px)" id="node-${escapeHtml(node.localId)}">
          <div><span class="node-type">${NODE_TYPE_LABELS.get(node.nodeType) || node.nodeType}</span><span class="node-time">${escapeHtml(node.time || "时间待确认")}</span></div>
          <div class="node-fact">
            <span class="node-fact-label">● 执行人</span>
            <strong>${escapeHtml(node.executor || "执行人待确认")}</strong>
          </div>
          <div class="node-fact">
            <span class="node-fact-label">● 对象</span>
            <strong>${escapeHtml(SUBJECT_TYPE_LABELS.get(node.subject.type) || node.subject.type)}｜${escapeHtml(node.subject.name || "名称待确认")}</strong>
          </div>
          <div class="node-fact">
            <span class="node-fact-label">● 对象状态</span>
            <strong>${escapeHtml(node.subject.state || "待确认")}</strong>
          </div>
          <div class="node-id">列 ${escapeHtml(node.columnId || "待确认")}${documentState.trackMode ? ` · 线 ${escapeHtml(node.trackId || "待选择")}` : ""} · 排序 ${escapeHtml(String(node.sortOrder ?? "待确认"))} · 自动编号 ${escapeHtml(node.localId)}</div>
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
      const paths = [];
      const slots = buildEdgeSlots();
      const labelEntries = [];
      const directedPairs = new Map();
      documentState.edges.forEach(edge => {
        const key = [edge.from, edge.to].sort().join("=>");
        if (!directedPairs.has(key)) directedPairs.set(key, new Set());
        directedPairs.get(key).add(`${edge.from}>${edge.to}`);
      });
      const bidirectionalEdges = new Set(documentState.edges.filter(edge => {
        const key = [edge.from, edge.to].sort().join("=>");
        return directedPairs.get(key)?.size > 1;
      }).map(edge => edge.localId));
      const marker = `<defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#605e5c"></path></marker></defs>`;

      documentState.edges.forEach(edge => {
        const from = nodeBox(edge.from);
        const to = nodeBox(edge.to);
        if (!from || !to) return;
        const slot = {
          ...(slots.get(edge.localId) || {}),
          normalOffset: edge.layout.normalOffset,
        };
        const geometry = edgeGeometry(from, to, slot);
        const edgeSelected = isSelected("edge", edge.localId);
        const bidirectional = bidirectionalEdges.has(edge.localId);
        const markers = bidirectional
          ? 'marker-start="url(#arrowhead)" marker-end="url(#arrowhead)"'
          : 'marker-end="url(#arrowhead)"';
        paths.push(`<path class="hit" data-edge-id="${escapeHtml(edge.localId)}" d="${geometry.d}" stroke="transparent" stroke-width="14" fill="none"><title>${escapeHtml(edge.label || edge.localId)}</title></path><path class="visible edge ${escapeHtml(edge.edgeType)}${bidirectional ? " bidirectional" : ""}${edgeSelected ? " selected" : ""}" data-edge-id="${escapeHtml(edge.localId)}" d="${geometry.d}" ${markers}></path>`);
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
        div.className = `edge-label${isSelected("edge", edge.localId) ? " selected" : ""}`;
        div.dataset.edgeId = edge.localId;
        div.title = "拖拽标签可沿法线方向调整曲线间距";
        const actorStatus = labelOf(edge.actorBehavior.status, ACTOR_STATUSES);
        const objectStatus = labelOf(edge.subjectBehavior.status, SUBJECT_STATUSES);
        const statusClass = status => {
          if (status === "executed" || status === "happened") return "done";
          if (status === "not_executed" || status === "not_happened") return "pending";
          return "none";
        };
        div.innerHTML = `
          <b>${escapeHtml(edge.label || EDGE_TYPE_LABELS.get(edge.edgeType) || edge.edgeType)}<i class="confirm ${edge.confirmed ? "yes" : "no"}">${edge.confirmed ? "已确认" : "待确认"}</i></b>
          <div class="edge-behavior actor">
            <em>执行人</em>
            <i class="status ${statusClass(edge.actorBehavior.status)}">${escapeHtml(actorStatus)}</i>
            <time>${escapeHtml(edge.actorBehavior.time || "时间待确认")}</time>
            <span class="action">${edge.actorBehavior.status === "no_requirement" ? "—" : escapeHtml(edge.actorBehavior.action || "动作待确认")}</span>
          </div>
          <div class="edge-behavior object">
            <em>对象</em>
            <i class="status ${statusClass(edge.subjectBehavior.status)}">${escapeHtml(objectStatus)}</i>
            <time>${escapeHtml(edge.subjectBehavior.time || "时间待确认")}</time>
            <span class="action">${edge.subjectBehavior.status === "no_requirement" ? "—" : escapeHtml(edge.subjectBehavior.action || "行为待确认")}</span>
          </div>`;
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

      // Labels follow their own curve normal. Cards are obstacles too: long
      // cross-rank edges can otherwise place a midpoint label on top of a block.
      const placedBoxes = documentState.nodes
        .map(node => nodeBox(node.localId))
        .filter(Boolean)
        .map(box => ({
          left: box.x - 8,
          right: box.x + box.w + 8,
          top: box.y - 8,
          bottom: box.y + box.h + 8,
        }));
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
          for (let distance = entry.preferredDistance; distance <= 360; distance += 18) {
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

    function inputField(label, path, value, type = "text", placeholder = "", disabled = false) {
      return `<label class="field"><span>${escapeHtml(label)}</span><input data-bind="${escapeHtml(path)}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${disabled ? " disabled" : ""}></label>`;
    }

    function selectField(label, path, value, options, disabled = false) {
      return `<label class="field"><span>${escapeHtml(label)}</span><select data-bind="${escapeHtml(path)}"${disabled ? " disabled" : ""}>${optionsHtml(options, value)}</select></label>`;
    }

    function textareaField(label, path, value, placeholder = "") {
      return `<label class="field"><span>${escapeHtml(label)}</span><textarea data-bind="${escapeHtml(path)}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></label>`;
    }

    function checkboxField(label, path, checked, dataAction = "") {
      return `<label class="checkbox-field"><input data-bind="${escapeHtml(path)}" type="checkbox"${checked ? " checked" : ""}${dataAction ? ` data-action="${escapeHtml(dataAction)}"` : ""}>${escapeHtml(label)}</label>`;
    }

    function metricsField(label, path, values) {
      return textareaField(label, path, values.join("\n"), "每行一个指标；缺失填“待确认”");
    }

    function systemIdField(label, value, note) {
      return `<div class="system-field"><span>${escapeHtml(label)}（自动生成）</span><b>${escapeHtml(value || "待生成")}</b><small>${escapeHtml(note)}</small></div>`;
    }

    function inheritedField(label, value, note = "继承所属流程卡片，修改卡片后自动更新。") {
      return `<label class="field inherited"><span>${escapeHtml(label)}（继承）</span><input type="text" value="${escapeHtml(value || "待确认")}" disabled><small>${escapeHtml(note)}</small></label>`;
    }

    function touchSelectionField(fieldCode, selected) {
      const taxonomyFieldCode = fieldCode === "touchScenes" ? "touchScene" : "touchMethod";
      const field = TAXONOMY_FIELDS.get(taxonomyFieldCode);
      const selectedCodes = new Set(selected.map(item => item.code));
      const globalCodes = new Set(documentState.taxonomy.selections[taxonomyFieldCode].map(item => item.code));
      const parentField = field.parentFieldCode ? TAXONOMY_FIELDS.get(field.parentFieldCode) : null;
      const parentLabels = new Map(parentField?.values.map(item => [item.code, item.label]) || []);
      const visibleValues = field.values.filter(value =>
        globalCodes.has(value.code) || selectedCodes.has(value.code));
      const isOpen = openTouchDropdown === fieldCode;
      const chips = selected.map(item => {
        const definition = field.values.find(value => value.code === item.code);
        return `<button type="button" class="multi-select-chip" data-touch-remove="${escapeHtml(item.code)}" title="删除 ${escapeHtml(definition?.label || item.code)}">${escapeHtml(definition?.label || item.code)}<span>×</span></button>`;
      }).join("");
      const options = visibleValues
        .map(value => `<label class="multi-select-option">
          <input type="checkbox" data-touch-field="${escapeHtml(fieldCode)}" data-touch-code="${escapeHtml(value.code)}"${selectedCodes.has(value.code) ? " checked" : ""}${touchFocusCode === value.code ? " data-touch-focus=\"true\"" : ""}>
          <span>${escapeHtml(parentField ? `${parentLabels.get(value.parentCode) || value.parentCode} · ${value.label}` : value.label)}</span>
          <small>${escapeHtml(value.code)}</small>
        </label>`)
        .join("");
      const html = `<div class="field wide multi-select${isOpen ? " open" : ""}" data-touch-container="${escapeHtml(fieldCode)}">
        <span>${escapeHtml(field.label)} *</span>
        <div class="multi-select-trigger" role="button" tabindex="0" aria-expanded="${isOpen ? "true" : "false"}" aria-controls="${escapeHtml(fieldCode)}Popover" data-touch-toggle="${escapeHtml(fieldCode)}">
          <span class="multi-select-values">${chips || "<em>请选择</em>"}</span>
          <i aria-hidden="true">▾</i>
        </div>
        <div class="multi-select-popover" id="${escapeHtml(fieldCode)}Popover" role="group" aria-label="${escapeHtml(field.label)}"${isOpen ? "" : " hidden"}>
          ${options || '<p class="field-help">请先在全局策略标签中选择可用选项。</p>'}
        </div>
        <small>多选；只能选择全局策略标签范围内已审批的 taxonomy code。${parentField ? "取消场景会同时移除该场景下的方式。" : ""}</small>
      </div>`;
      if (isOpen) {
        requestAnimationFrame(() => {
          document.querySelector(`[data-touch-container="${fieldCode}"] [data-touch-focus]`)?.focus();
        });
      }
      return html;
    }

    function taxonomySelectionField(fieldCode) {
      const field = TAXONOMY_FIELDS.get(fieldCode);
      const selected = documentState.taxonomy.selections[fieldCode] || [];
      const selectedCodes = new Set(selected.map(item => item.code));
      const parentCodes = field.parentFieldCode
        ? new Set((documentState.taxonomy.selections[field.parentFieldCode] || []).map(item => item.code))
        : null;
      const visibleValues = field.values.filter(value =>
        !parentCodes || parentCodes.has(value.parentCode) || selectedCodes.has(value.code));
      const inputType = field.cardinality === "single" ? "radio" : "checkbox";
      return `<div class="field wide tag-field" data-taxonomy-container="${escapeHtml(fieldCode)}">
        <span>${escapeHtml(field.label)}${field.required ? " *" : ""}</span>
        <div class="tag-options">
          ${visibleValues.length ? visibleValues.map(value => `<label class="tag-option">
            <input type="${inputType}" name="taxonomy.${escapeHtml(fieldCode)}" data-taxonomy-field="${escapeHtml(fieldCode)}" data-taxonomy-code="${escapeHtml(value.code)}"${selectedCodes.has(value.code) ? " checked" : ""}>
            <b>${escapeHtml(value.label)}</b><small>${escapeHtml(value.code)}</small>
          </label>`).join("") : `<p class="field-help">请先选择可用的${escapeHtml(TAXONOMY_FIELDS.get(field.parentFieldCode || fieldCode)?.label || "父标签")}。</p>`}
        </div>
        <p class="field-help">${field.parentFieldCode ? "先选父标签，再选子标签；切换父标签会同步移除不再可用的子标签。" : `${field.cardinality === "single" ? "单选" : "多选"}；code 是正式提交值。`}</p>
      </div>`;
    }

    function customProposalFields() {
      const proposals = documentState.taxonomy.customTagProposals;
      const allowedFields = ["businessScene", "strategyType", "touchScene", "touchMethod"];
      return `<div class="wide field-section">
        <h3>自定义标签提案</h3>
        ${proposals.map((proposal, index) => `<div class="proposal-card">
          <div class="field-grid">
            ${inputField("提案 ID（至少8位）", `taxonomy.customTagProposals.${index}.proposalId`, proposal.proposalId, "text", "proposal-type-001")}
            ${selectField("提案字段", `taxonomy.customTagProposals.${index}.fieldCode`, proposal.fieldCode, allowedFields.map(code => [code, TAXONOMY_FIELDS.get(code).label]))}
            ${inputField("展示名", `taxonomy.customTagProposals.${index}.label`, proposal.label)}
            ${inputField("父字段", `taxonomy.customTagProposals.${index}.parentRef.fieldCode`, proposal.parentRef?.fieldCode || "", "text", "businessScene / touchScene")}
            ${inputField("父 code 或父提案 ID", `taxonomy.customTagProposals.${index}.parentRef.code`, proposal.parentRef?.code || "", "text", "user_activation 或 proposal-scene-001")}
            ${inputField("父提案 ID", `taxonomy.customTagProposals.${index}.parentRef.proposalId`, proposal.parentRef?.proposalId || "", "text", "同请求内父提案")}
            <div class="wide">${textareaField("业务理由", `taxonomy.customTagProposals.${index}.reason`, proposal.reason, "说明为什么现有字典不覆盖")}</div>
          </div>
          <button class="btn danger small" type="button" data-action="delete-proposal" data-index="${index}">删除提案</button>
        </div>`).join("")}
        <button class="btn small" type="button" data-action="add-proposal">新增提案</button>
        <p class="field-help">调用方不能生成 code。提案审批通过前会阻断 Workbench 的 templates / process。</p>
      </div>`;
    }

    function triggerSceneFields() {
      const scenes = documentState.registrationMetadata.triggerScenes;
      const fields = [
        ["triggerSceneId", "触发场景 ID"], ["triggerScene", "触发场景"], ["threshold", "阈值"],
        ["frequency", "频率"], ["deduplication", "去重"], ["cooldown", "冷却"],
        ["audienceScope", "受众范围"], ["qualification", "资格条件"], ["dataSource", "数据源"],
        ["confirmationStatus", "确认状态"],
      ];
      return `<div class="wide field-section">
        <h3>触发场景</h3>
        ${scenes.map((scene, index) => `<div class="proposal-card">
          <div class="field-grid">
            ${fields.map(([key, label]) => inputField(label, `registrationMetadata.triggerScenes.${index}.${key}`, scene[key]))}
          </div>
          <button class="btn danger small" type="button" data-action="delete-trigger-scene" data-index="${index}">删除触发场景</button>
        </div>`).join("")}
        <button class="btn small" type="button" data-action="add-trigger-scene">新增触发场景</button>
      </div>`;
    }

    function updateTaxonomySelection(target) {
      const fieldCode = target.dataset.taxonomyField;
      const code = target.dataset.taxonomyCode;
      const field = TAXONOMY_FIELDS.get(fieldCode);
      if (!field || !code) return;
      const values = documentState.taxonomy.selections[fieldCode] || [];
      const definition = field.values.find(value => value.code === code);
      const nextValue = definition
        ? { code, parentCode: definition.parentCode ?? null}
        : { code, parentCode: null };
      if (field.cardinality === "single") {
        documentState.taxonomy.selections[fieldCode] = target.checked ? [nextValue] : [];
      } else if (target.checked) {
        values.push(nextValue);
      } else {
        documentState.taxonomy.selections[fieldCode] = values.filter(value => value.code !== code);
      }

      // Parent switches are destructive in the UI. Imported bad pairs are kept
      // for validation; an explicit user edit should not leave hidden children.
      const childrenByParent = {
        customerClass: "assetRange",
        businessScene: "strategyType",
        touchScene: "touchMethod",
      };
      if (childrenByParent[fieldCode]) {
        const childField = childrenByParent[fieldCode];
        const parentCodes = new Set(documentState.taxonomy.selections[fieldCode].map(value => value.code));
        documentState.taxonomy.selections[childField] = documentState.taxonomy.selections[childField]
          .filter(value => parentCodes.has(value.parentCode));
      }

      if (fieldCode === "assetRange") {
        if (target.checked && code === "unlimited") {
          documentState.taxonomy.selections.assetRange = [nextValue];
        } else if (target.checked && code !== "unlimited") {
          documentState.taxonomy.selections.assetRange = documentState.taxonomy.selections.assetRange
            .filter(value => value.code !== "unlimited");
        }
      }
      if (fieldCode === "riskLevel") {
        const selected = documentState.taxonomy.selections.riskLevel;
        if (target.checked && code === "unspecified") {
          documentState.taxonomy.selections.riskLevel = [nextValue];
        } else if (target.checked && code !== "unspecified") {
          documentState.taxonomy.selections.riskLevel = selected.filter(value => value.code !== "unspecified");
        }
      }
    }

    function syncTouchDropdownState() {
      document.querySelectorAll("[data-touch-container]").forEach(container => {
        const fieldCode = container.dataset.touchContainer;
        const isOpen = openTouchDropdown === fieldCode;
        container.classList.toggle("open", isOpen);
        const trigger = container.querySelector("[data-touch-toggle]");
        trigger?.setAttribute("aria-expanded", String(isOpen));
        const popover = container.querySelector(".multi-select-popover");
        if (popover) popover.hidden = !isOpen;
      });
    }

    function setTouchDropdown(fieldCode, isOpen) {
      openTouchDropdown = isOpen ? fieldCode : null;
      if (!isOpen && fieldCode === openTouchDropdown) openTouchDropdown = null;
      syncTouchDropdownState();
    }

    function closeTouchDropdowns(focusTrigger = false) {
      const trigger = openTouchDropdown
        ? document.querySelector(`[data-touch-container="${openTouchDropdown}"] [data-touch-toggle]`)
        : null;
      openTouchDropdown = null;
      syncTouchDropdownState();
      if (focusTrigger) trigger?.focus();
    }

    function updateActionTouchSelection(target, checked) {
      const current = selectedObject();
      if (current?.kind !== "strategyAction") return;
      const action = current.value;
      const fieldCode = clean(target.dataset.touchField);
      const code = clean(target.dataset.touchCode);
      const taxonomyFieldCode = fieldCode === "touchScenes" ? "touchScene" : "touchMethod";
      const definition = TAXONOMY_FIELDS.get(taxonomyFieldCode)?.values.find(item => item.code === code);
      if (!definition) return;

      if (fieldCode === "touchScenes") {
        if (checked) {
          action.touchScenes.push({code});
        } else {
          action.touchScenes = action.touchScenes.filter(item => item.code !== code);
          action.touchMethods = action.touchMethods.filter(item => item.parentCode !== code);
        }
      } else if (checked) {
        action.touchMethods.push({code, parentCode: definition.parentCode});
      } else {
        action.touchMethods = action.touchMethods.filter(item => item.code !== code);
      }
      openTouchDropdown = fieldCode;
      touchFocusCode = code;
    }

    function removeActionTouchSelection(fieldCode, code) {
      const current = selectedObject();
      if (current?.kind !== "strategyAction") return;
      const action = current.value;
      if (fieldCode === "touchScenes") {
        action.touchScenes = action.touchScenes.filter(item => item.code !== code);
        action.touchMethods = action.touchMethods.filter(item => item.parentCode !== code);
      } else {
        action.touchMethods = action.touchMethods.filter(item => item.code !== code);
      }
      openTouchDropdown = null;
      touchFocusCode = null;
    }

    function renderBasicInspector() {
      const strategy = documentState.strategy;
      inspectorContent.innerHTML = `<div class="side-block primary">
          <div class="inspector-head"><div><b>策略基础信息</b><small>strategy-flow-input/0.8 · 标签由 taxonomy 统一承载</small></div></div>
        <div class="inspector-form field-grid">
          ${inputField("策略名称", "strategy.strategyName", strategy.strategyName)}
          ${inputField("看板策略编号", "strategy.strategyId", strategy.strategyId, "text", "更新已有策略时填写；新建策略留空")}
          ${inputField("提交注册 CaseID", "strategy.registrationCaseId", strategy.registrationCaseId, "text", "看板提交注册后返回；新建策略留空")}
          ${inputField("主要负责人", "strategy.owner", strategy.owner)}
          ${inputField("提交人", "strategy.submitter", strategy.submitter)}
          ${inputField("策略业务版本", "strategy.version", strategy.version)}
          ${selectField("版本状态", "strategy.versionStatus", strategy.versionStatus, [["", "待选择"], ["draft", "draft"], ["candidate", "candidate"]])}
        </div>
      </div>`;
    }

    function renderTaxonomyInspector() {
      const taxonomyBlock = document.createElement("div");
      taxonomyBlock.className = "side-block primary";
      taxonomyBlock.innerHTML = `<h2 class="side-title">策略标签</h2>
        <details class="taxonomy-group" data-taxonomy-group="customer" open>
          <summary>客群识别<span>生命周期 / 客群 / 资产 / 风险</span></summary>
          <div class="inspector-form field-grid">
          ${taxonomySelectionField("lifecycle")}
          ${taxonomySelectionField("customerClass")}
          ${taxonomySelectionField("assetRange")}
          ${taxonomySelectionField("riskLevel")}
          </div>
        </details>
        <details class="taxonomy-group" data-taxonomy-group="business" open>
          <summary>业务场景与策略类型<span>场景 → 二级类型 → 子类</span></summary>
          <div class="inspector-form field-grid">
          ${taxonomySelectionField("businessScene")}
          ${taxonomySelectionField("strategyType")}
          ${inputField("策略子类", "taxonomy.strategySubtype", documentState.taxonomy.strategySubtype)}
          </div>
        </details>
        <details class="taxonomy-group" data-taxonomy-group="touch" open>
          <summary>触达配置<span>场景 → 真实触达方式</span></summary>
          <div class="inspector-form field-grid">
          ${taxonomySelectionField("touchScene")}
          ${taxonomySelectionField("touchMethod")}
          </div>
        </details>
        <details class="taxonomy-group" data-taxonomy-group="proposals">
          <summary>自定义标签提案<span>审批前不生成 code</span></summary>
          ${customProposalFields()}
        </details>`;
      inspectorContent.append(taxonomyBlock);
    }

    function renderMetadataInspector() {
      const metadata = documentState.registrationMetadata;
      const metadataBlock = document.createElement("div");
      metadataBlock.className = "side-block primary";
      metadataBlock.innerHTML = `<h2 class="side-title">注册元数据 Companion</h2>
        <div class="inspector-form field-grid">
          ${inputField("业务归属", "registrationMetadata.businessUnit", metadata.businessUnit)}
          ${inputField("提交日期", "registrationMetadata.submitDate", metadata.submitDate, "date")}
          ${inputField("核心抓手", "registrationMetadata.coreHook", metadata.coreHook)}
          ${inputField("生效日期", "registrationMetadata.effectiveFrom", metadata.effectiveFrom, "date")}
          ${inputField("基准版本", "registrationMetadata.baselineVersion", metadata.baselineVersion, "text", "candidate 必填")}
        </div>
        ${triggerSceneFields()}`;
      inspectorContent.append(metadataBlock);
    }


    function renderColumnInspector(column) {
      const nodeCount = documentState.nodes.filter(node => node.columnId === column.localId).length;
      inspectorContent.innerHTML = `<div class="side-block primary">
        <div class="inspector-head">
          <div><b>看板列</b><small>相同列的卡片在策略看板同列展示</small></div>
          <button class="btn danger small" data-action="delete" type="button"${nodeCount ? " disabled title=\"列内还有卡片，不能删除\"" : ""}>删除</button>
        </div>
        <div class="inspector-form field-grid">
          <div class="wide">${systemIdField("看板列系统编号", column.localId, "系统自动维护，业务人员不需要填写或修改。")}</div>
          ${inputField("看板列排序", `columns.${column.localId}.sortOrder`, column.sortOrder, "number", "列按升序展示")}
          <p class="field-help wide">看板列排序全局唯一；列内卡片再按各自看板排序升序展示。画布拖拽不会改变看板列。</p>
          <p class="field-help wide">当前列内卡片数：${nodeCount}。</p>
        </div>
      </div>`;
    }

    function renderTrackInspector(track) {
      const nodeCount = documentState.nodes.filter(node => node.trackId === track.localId).length;
      inspectorContent.innerHTML = `<div class="side-block primary">
        <div class="inspector-head">
          <div><b>业务主线</b><small>复杂策略的显式领域泳道</small></div>
          <button class="btn danger small" data-action="delete" type="button"${nodeCount ? " disabled title=\"主线内还有卡片，不能删除\"" : ""}>删除</button>
        </div>
        <div class="inspector-form field-grid">
          <div class="wide">${systemIdField("业务主线系统编号", track.localId, "系统自动维护，业务人员不需要填写或修改。")}</div>
          ${inputField("业务主线名称", `tracks.${track.localId}.name`, track.name)}
          ${inputField("业务主线排序", `tracks.${track.localId}.sortOrder`, track.sortOrder, "number", "主线按升序展示")}
          <div class="wide">${textareaField("业务说明", `tracks.${track.localId}.description`, track.description ?? "", "说明这条业务主线覆盖的显式业务交接")}</div>
          <p class="field-help wide">业务主线排序与看板列排序是两个独立空间；主线排序在自己范围内唯一。颜色、图标、折叠状态由渲染器决定，不进入契约。</p>
          <p class="field-help wide">当前主线内卡片数：${nodeCount}。</p>
        </div>
      </div>`;
    }

    function bulkAssignmentSelect(label, field, value, options, disabled = false) {
      const currentValue = clean(value) || "__MIXED__";
      const hasCurrentValue = options.some(([optionValue]) => optionValue === currentValue);
      const renderedOptions = [
        ...(hasCurrentValue ? [] : [[currentValue, value === undefined || clean(value) === "" ? "请选择归属" : "所选卡片归属不一致", true]]),
        ...options,
      ];
      return `<label class="field"><span>${escapeHtml(label)}</span><select data-bulk-assignment="${escapeHtml(field)}"${disabled ? " disabled" : ""}>${renderedOptions
        .map(([optionValue, optionLabel, optionDisabled = false]) => `<option value="${escapeHtml(optionValue)}"${optionValue === currentValue ? " selected" : ""}${optionDisabled ? " disabled" : ""}>${escapeHtml(optionLabel)}</option>`)
        .join("")}</select></label>`;
    }

    function renderMultiNodeInspector(nodes) {
      const sharedValue = field => nodes.reduce((result, node) => (
        result === undefined ? node[field] : (result === node[field] ? result : null)
      ), undefined);
      const columnValue = sharedValue("columnId");
      const trackValue = sharedValue("trackId");
      const columnOptions = [...documentState.columns]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(column => [column.localId, `列 ${column.localId} · 排序 ${column.sortOrder}`]);
      const trackOptions = [...documentState.tracks]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(track => [track.localId, `${track.name || track.localId} · 排序 ${track.sortOrder}`]);

      inspectorContent.innerHTML = `<div class="side-block primary">
        <div class="inspector-head">
          <div><b>多选卡片</b><small>${nodes.length} 张流程卡片</small></div>
        </div>
        <div class="inspector-form">
          ${bulkAssignmentSelect("批量设置所属看板列", "columnId", columnValue, columnOptions, !columnOptions.length)}
          ${documentState.trackMode ? bulkAssignmentSelect("批量设置所属业务主线", "trackId", trackValue, trackOptions, !trackOptions.length) : ""}
          <p class="field-help wide">批量修改只写入归属，不改变卡片排序，也不推断业务主线。目标必须已存在。</p>
        </div>
      </div>`;
    }

    function renderNodeInspector(node) {
      const columnOptions = [...documentState.columns]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(column => [column.localId, `列 ${column.localId} · 排序 ${column.sortOrder}`]);
      if (node.columnId && !documentState.columns.some(column => column.localId === node.columnId)) {
        columnOptions.push([node.columnId, `缺失列 ${node.columnId}`]);
      }
      const trackOptions = [["", "请选择 primary Track"]];
      if (documentState.trackMode) {
        [...documentState.tracks]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .forEach(track => trackOptions.push([track.localId, `${track.name || track.localId} · 排序 ${track.sortOrder}`]));
        if (node.trackId && !documentState.tracks.some(track => track.localId === node.trackId)) {
          trackOptions.push([node.trackId, `缺失主线 ${node.trackId}`]);
        }
      }
      inspectorContent.innerHTML = `<div class="side-block primary">
        <div class="inspector-head">
          <div><b>流程卡片</b><small>系统编号自动生成</small></div>
          <button class="btn danger small" data-action="delete" type="button">删除</button>
        </div>
        <div class="inspector-form">
          <div class="wide">${systemIdField("卡片系统编号", node.localId, "系统自动维护，业务人员不需要填写或修改。")}</div>
          ${selectField("卡片类型", `nodes.${node.localId}.nodeType`, node.nodeType, NODE_TYPES.map(value => [value, NODE_TYPE_LABELS.get(value) || value]))}
          ${inputField("时间 / 阶段", `nodes.${node.localId}.time`, node.time, "text", "填写业务时间表达式")}
          ${inputField("负责执行的角色 / 人", `nodes.${node.localId}.executor`, node.executor)}
          ${selectField("所属看板列", `nodes.${node.localId}.columnId`, node.columnId, columnOptions)}
          ${documentState.trackMode ? selectField("所属业务主线", `nodes.${node.localId}.trackId`, node.trackId, trackOptions) : ""}
          ${inputField("看板排序", `nodes.${node.localId}.sortOrder`, node.sortOrder, "number", "按升序展示")}
          <div class="wide field-section">
            <h3>对象</h3>
            ${selectField("对象类型", `nodes.${node.localId}.subject.type`, node.subject.type, SUBJECT_TYPES.map(value => [value, SUBJECT_TYPE_LABELS.get(value) || value]))}
            ${inputField("对象名称", `nodes.${node.localId}.subject.name`, node.subject.name, "text", "例如：目标客群名称、场景名称、事件名称")}
            <p class="field-help">先选择对象类型，再填写该类型下的具体对象名称。对象类型回答“这是哪一类对象”，对象名称回答“具体是哪一个”。</p>
          </div>
          <div class="wide field-section">
            <h3>对象状态</h3>
            ${inputField("对象状态", `nodes.${node.localId}.subject.state`, node.subject.state, "text", node.nodeType === "classification" ? "例如：待分类、已完成分类、已分层" : "例如：未触达、已触达、已转化")}
            <p class="field-help">对象状态是对象进入这张卡片时的业务状态。它描述“现在处于什么阶段”，不是对象类别，也不是执行人的处理进度。对象分类卡片用于对当前对象做分类或分层，对象本身不需要发生行为。</p>
          </div>
          <p class="field-help wide">所属看板列决定策略看板同列分组；看板排序在同一列内按升序展示流程卡片，同列内唯一且不要求连续。业务主线是可选增强，启用后每张卡片只能归属一条 primary Track。它们不代表画布坐标，也不参与流转方向判断。</p>
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
      inspectorContent.innerHTML = `<div class="side-block primary">
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
          ${selectField("执行状态", `edges.${edge.localId}.actorBehavior.status`, edge.actorBehavior.status, ACTOR_STATUSES, edge.actorBehavior.status === "no_requirement")}
          <div class="field-grid wide">${inputField("执行动作", `edges.${edge.localId}.actorBehavior.action`, edge.actorBehavior.action, "text", "", edge.actorBehavior.status === "no_requirement")}</div>
          <div class="wide">${checkboxField("无动作", `edges.${edge.localId}.actorBehavior.noAction`, edge.actorBehavior.status === "no_requirement", "toggle-no-action")}</div>
        </div>
        <h2 class="side-title" style="margin-top:14px">对象发生了什么</h2>
        <div class="inspector-form field-grid">
          ${inputField("时间", `edges.${edge.localId}.subjectBehavior.time`, edge.subjectBehavior.time, "text", "填写业务时间表达式")}
          ${selectField("发生状态", `edges.${edge.localId}.subjectBehavior.status`, edge.subjectBehavior.status, SUBJECT_STATUSES, edge.subjectBehavior.status === "no_requirement")}
          <div class="field-grid wide">${inputField("发生的行为", `edges.${edge.localId}.subjectBehavior.action`, edge.subjectBehavior.action, "text", "", edge.subjectBehavior.status === "no_requirement")}</div>
          <div class="wide">${checkboxField("无动作", `edges.${edge.localId}.subjectBehavior.noAction`, edge.subjectBehavior.status === "no_requirement", "toggle-no-action")}</div>
        </div>
      </div>`;
    }

    function renderActionInspector(kind, action) {
      const nodeOptions = documentState.nodes.map(node => [node.localId, `${node.executor || "执行人待确认"}｜${node.subject.name || "对象待确认"}｜${node.subject.state || "状态待确认"}`]);
      const edgeOptions = [["", "暂不绑定流转规则"], ...documentState.edges.filter(edge => edge.from === action.nodeId).map(edge => [edge.localId, `规则｜${edge.actorBehavior.action || "待确认"}`])];
      const node = documentState.nodes.find(item => item.localId === action.nodeId);
      if (kind === "strategyAction") {
        inspectorContent.innerHTML = `<div class="side-block primary">
          <div class="inspector-head"><div><b>客户触达内容</b><small>对客户说什么、用什么权益</small></div><button class="btn danger small" data-action="delete" type="button">删除</button></div>
          <div class="inspector-form field-grid">
            <div class="wide">${systemIdField("内容系统编号", action.localId, "系统自动维护，不需要业务填写。")}</div>
            ${selectField("所属流程卡片", `strategyActions.${action.localId}.nodeId`, action.nodeId, nodeOptions)}
            ${selectField("绑定的流转规则", `strategyActions.${action.localId}.outgoingEdgeId`, action.outgoingEdgeId, edgeOptions)}
            ${inheritedField("时间", node?.time)}
            ${inheritedField("对象状态", node?.subject.state)}
            ${inputField("进入条件", `strategyActions.${action.localId}.judge`, action.judge)}
            <p class="field-help wide">进入条件是这条触达内容被选用前的前置判断，用来筛“该用哪套内容”。它不决定流程是否进入下一张卡片；流程走向仍由流转规则的执行人行为和对象行为判断。</p>
            ${touchSelectionField("touchScenes", action.touchScenes)}
            ${touchSelectionField("touchMethods", action.touchMethods)}
            ${inputField("话术主题", `strategyActions.${action.localId}.theme`, action.theme)}
            ${inputField("核心目标", `strategyActions.${action.localId}.goal`, action.goal)}
            ${inputField("核心抓手", `strategyActions.${action.localId}.hook`, action.hook)}
            <div class="wide">${checkboxField("是否带链接", `strategyActions.${action.localId}.hasLink`, action.hasLink)}</div>
            <div class="wide">${textareaField("文案", `strategyActions.${action.localId}.copy`, action.copy)}</div>
            <div class="wide">${metricsField("考察指标", `strategyActions.${action.localId}.metrics`, action.metrics)}</div>
          </div>
        </div>`;
      } else {
        inspectorContent.innerHTML = `<div class="side-block primary">
          <div class="inspector-head"><div><b>执行跟进动作</b><small>谁执行、执行什么、交给谁</small></div><button class="btn danger small" data-action="delete" type="button">删除</button></div>
          <div class="inspector-form field-grid">
            <div class="wide">${systemIdField("动作系统编号", action.localId, "系统自动维护，不需要业务填写。")}</div>
            ${selectField("所属流程卡片", `processActions.${action.localId}.nodeId`, action.nodeId, nodeOptions)}
            ${selectField("绑定的流转规则", `processActions.${action.localId}.outgoingEdgeId`, action.outgoingEdgeId, edgeOptions)}
            ${inheritedField("执行人 / 角色", node?.executor)}
            ${inputField("执行场景", `processActions.${action.localId}.scene`, action.scene)}
            ${inputField("执行抓手", `processActions.${action.localId}.hook`, action.hook)}
            ${inheritedField("接收对象", node?.subject.name)}
            <div class="wide">${textareaField("什么情况下执行", `processActions.${action.localId}.condition`, action.condition)}</div>
            <div class="wide">${textareaField("执行后的结果", `processActions.${action.localId}.result`, action.result)}</div>
            <div class="wide">${textareaField("具体执行动作", `processActions.${action.localId}.action`, action.action)}</div>
            <div class="wide">${metricsField("过程管理指标", `processActions.${action.localId}.metrics`, action.metrics)}</div>
          </div>
        </div>`;
      }
    }

    function renderRegistrationInspector() {
      const tabs = [
        ["basic", "基础信息"],
        ["taxonomy", "策略标签"],
        ["metadata", "元数据"],
      ];
      registrationTabs.innerHTML = tabs.map(([id, label]) => `<button type="button" role="tab" data-inspector-tab="${id}"${activeInspectorTab === id ? ' class="on" aria-selected="true"' : ' aria-selected="false"'}>${escapeHtml(label)}</button>`).join("");
      registrationDrawerContent.innerHTML = "";
      inspectorContent = registrationDrawerContent;
      if (activeInspectorTab === "taxonomy") renderTaxonomyInspector();
      else if (activeInspectorTab === "metadata") renderMetadataInspector();
      else renderBasicInspector();
    }

    function renderCurrentObjectInspector(current) {
      if (current.kind !== "strategyAction") {
        openTouchDropdown = null;
        touchFocusCode = null;
      }
      if (current.kind === "column") renderColumnInspector(current.value);
      else if (current.kind === "track") renderTrackInspector(current.value);
      else if (current.kind === "node") renderNodeInspector(current.value);
      else if (current.kind === "edge") renderEdgeInspector(current.value);
      else renderActionInspector(current.kind, current.value);
    }

    function renderInspector() {
      const multiSelectedNodes = selectedNodeIds()
        .map(id => documentState.nodes.find(node => node.localId === id))
        .filter(Boolean);
      if (multiSelectedNodes.length > 1) {
        inspector.innerHTML = "";
        inspectorContent = inspector;
        renderMultiNodeInspector(multiSelectedNodes);
        return;
      }
      const current = selectedObject();
      if (!current?.value) {
        selected = null;
        inspector.innerHTML = `<div class="object-empty object-empty-sidebar">
          <b>当前对象</b>
          <p>点击流程卡片、流转规则标签或动作气泡，这里会立即显示对应的编辑表单。</p>
          <small>基础信息、策略标签和注册元数据在顶部“本策略注册信息”中维护。</small>
        </div>`;
        return;
      }
      inspector.innerHTML = "";
      inspectorContent = inspector;
      renderCurrentObjectInspector(current);
    }

    function issueDomain(path) {
      const value = clean(path);
      if (value.startsWith("schemaVersion") || value.startsWith("schema") || ["schemaVersion", "schema"].includes(value)) return "contract";
      if (value.startsWith("strategy.")) return "basic";
      if (value.startsWith("taxonomy.")) return "taxonomy";
      if (value.startsWith("registrationMetadata.")) return "metadata";
      return "flow";
    }

    function domainMeta(domain) {
      return {
        contract: ["契约与结构", "basic"],
        basic: ["策略基础信息", "basic"],
        taxonomy: ["策略标签", "taxonomy"],
        metadata: ["注册元数据", "metadata"],
        flow: ["流程图", ""],
      }[domain] || ["其他", "basic"];
    }

    function issueIcon(severity) {
      return severity === "warning" ? "!" : "×";
    }

    function issueSource(item) {
      const domain = issueDomain(item.path);
      if (domain === "metadata") return "Metadata 2.0";
      if (domain === "flow" || domain === "contract") return "Design 0.8";
      return domain === "taxonomy" ? "Design taxonomy" : "Design strategy";
    }

    function issueAdvice(item) {
      const advice = {
        SCHEMA_VERSION_REQUIRED: "补齐 schemaVersion 后重新导入。",
        SCHEMA_VERSION_INVALID: "使用 strategy-flow-input/<major>.<minor> 格式。",
        SCHEMA_VERSION_UNSUPPORTED: "改用当前已注册的 0.1 / 0.2 / 0.3 / 0.4 / 0.5 / 0.6 / 0.7 / 0.8 契约。",
        SCHEMA_UNKNOWN_FIELD: "删除契约未定义的字段，或升级到承载该字段的版本。",
        STRATEGY_FIELD_REQUIRED: "在基础信息 Tab 补齐策略事实。",
        TAG_FIELD_REQUIRED: "在策略标签 Tab 选择必填标签。",
        TAG_PARENT_MISMATCH: "按 taxonomy 字典重新选择父标签。",
        TAG_PARENT_REQUIRED: "先选父标签，再补子标签 parentCode。",
        TAG_CHILD_REQUIRED: "为每个已选父标签至少选择一个子标签。",
        TAG_EXCLUSIVE_INVALID: "互斥标签只能二选一。",
        METADATA_FIELD_REQUIRED: "在元数据 Tab 补齐 companion 字段。",
        METADATA_TRIGGER_SCENE_REQUIRED: "场景范式需要在 Metadata 2.0 中补充触发场景。",
        EDGE_ENDPOINT_MISSING: "检查边引用的卡片 ID，或重新连线。",
        EDGE_SELF_LOOP: "回收 / 重入必须经过显式卡片，不能自环。",
        COLUMN_SORT_ORDER_INVALID: "使用不超过 2147483647 的非负整数作为看板列排序。",
        COLUMN_SORT_ORDER_DUPLICATE: "调整看板列排序，保证全局唯一；允许留间隔。",
        NODE_COLUMN_MISSING: "先创建目标看板列，再把流程卡片移动到该列。",
        TRACK_EMPTY: "启用业务主线前先定义至少一条 Track，或关闭 Track 模式。",
        TRACK_NAME_REQUIRED: "为业务主线填写非空名称。",
        TRACK_SORT_ORDER_INVALID: "使用不超过 2147483647 的非负整数作为业务主线排序。",
        TRACK_SORT_ORDER_DUPLICATE: "调整业务主线排序，保证 Track 范围内唯一；它不受看板列排序影响。",
        NODE_TRACK_MISSING: "启用业务主线后，为每张流程卡片选择唯一 primary Track。",
        NODE_TRACK_NOT_FOUND: "先创建目标业务主线，再把流程卡片改派到该主线。",
        NODE_TRACK_NOT_ENABLED: "未启用业务主线时删除节点 trackId，或先显式启用 Track 模式。",
        NODE_SORT_ORDER_INVALID: "使用不超过 2147483647 的非负整数作为看板排序。",
        NODE_SORT_ORDER_DUPLICATE: "调整同一看板列内的卡片排序，保证列内唯一；允许留间隔。",
        EXECUTOR_HANDOFF_MISSING: "执行人变化时把流转类型改为 handoff。",
        NODE_ORPHAN: "为孤立卡片连线，或删除该卡片。",
        ACTION_FIELD_REQUIRED: "补齐动作业务字段和指标。",
        ACTION_TOUCH_SCENE_REQUIRED: "在客户触达内容中至少选择一个触达场景。",
        ACTION_TOUCH_METHOD_REQUIRED: "在客户触达内容中至少选择一个触达方式。",
        ACTION_TOUCH_CODE_INVALID: "改用 taxonomy 字典中已审批的触达 code。",
        ACTION_TOUCH_PARENT_MISMATCH: "重新选择触达方式，使其挂在正确的触达场景下。",
        ACTION_TOUCH_TAXONOMY_SCOPE_MISMATCH: "先在全局策略标签中选择对应触达范围，或在动作中移除超范围选项。",
        ACTION_TOUCH_CHILD_REQUIRED: "为每个已选触达场景至少选择一个触达方式。",
        ACTION_TOUCH_DUPLICATE: "删除重复的触达场景或触达方式。",
        MIGRATION_TOUCH_FIELD_DISCARDED: "旧自由文本无法精确匹配 taxonomy；请重新选择触达场景和方式。",
        MIGRATION_SORT_ORDER_GENERATED: "确认按旧节点顺序生成的看板排序是否符合业务展示顺序。",
        MIGRATION_DEFAULT_COLUMN_GENERATED: "确认旧节点是否都应留在默认看板列 c1；如需分组请移动卡片。",
        MIGRATION_TRACK_NOT_ENABLED: "这只是迁移审计记录；no-track 0.8 是完整合法形态，复杂策略可再显式开启。",
        MIGRATION_DERIVED_FIELD_DISCARDED: "确认所属流程卡片上的继承值；0.4 不再在动作内保存重复字段。",
        MIGRATION_DISPLAY_NAME_DISCARDED: "确认卡片业务事实仍完整；0.4 不再提供独立展示名。",
        CUSTOM_TAG_APPROVAL_REQUIRED: "保留提案等待 Workbench 审批；未批准前不要进入 process。",
      }[item.code];
      return advice || (item.severity === "error" ? "处理该项阻断后再导出正式输入。" : "评估该警告是否会影响业务确认。");
    }

    function domainDetail(domain) {
      const strategy = documentState.strategy;
      const taxonomy = documentState.taxonomy;
      const metadata = documentState.registrationMetadata;
      if (domain === "contract") return `${SCHEMA_VERSION} · ${documentState.nodes.length} 卡片`;
      if (domain === "basic") return clean(strategy.strategyName) || "缺少策略名称";
      if (domain === "taxonomy") {
        const selectedCount = Object.values(taxonomy.selections).reduce((sum, values) => sum + values.length, 0);
        return `${selectedCount} 个标签 · ${taxonomy.customTagProposals.length} 个提案`;
      }
      if (domain === "metadata") return clean(metadata.businessUnit) || "缺少业务归属";
      return `${documentState.nodes.length} 卡片 · ${documentState.edges.length} 规则 · ${documentState.strategyActions.length + documentState.processActions.length} 动作`;
    }

    function renderIssueGroups(issues) {
      const filteredIssues = issues.filter(item =>
        validationFilter === "all"
        || (validationFilter === "error" && item.severity === "error")
        || (validationFilter === "warning" && item.severity === "warning"));
      const groups = new Map();
      filteredIssues.forEach(item => {
        const domain = issueDomain(item.path);
        if (!groups.has(domain)) groups.set(domain, []);
        groups.get(domain).push(item);
      });
      const renderedGroups = [...groups.entries()].map(([domain, items]) => {
        const [title] = domainMeta(domain);
        const errorCount = items.filter(item => item.severity === "error").length;
        const warningCount = items.length - errorCount;
        return `<section class="issue-group" data-domain="${domain}">
          <header>
            <div><b>${escapeHtml(title)}</b><small>${escapeHtml(domainDetail(domain))}</small></div>
            <span>${errorCount} 阻断 · ${warningCount} 警告</span>
          </header>
          ${items.map(item => `<article class="issue${item.severity === "warning" ? " warning" : ""}" data-focus-path="${escapeHtml(item.path)}">
            <div class="issue-icon">${issueIcon(item.severity)}</div>
            <div class="issue-main">
              <div class="issue-top">
                <span class="issue-severity">${item.severity === "error" ? "阻断" : "警告"}</span>
                <b>${escapeHtml(item.code)}</b>
                <small>${escapeHtml(issueSource(item))}</small>
              </div>
              <p>${escapeHtml(item.message)}</p>
              <div class="issue-meta"><span>JSON Path</span><code>${escapeHtml(item.path)}</code></div>
              <p class="issue-advice">${escapeHtml(issueAdvice(item))}</p>
            </div>
            <div class="issue-actions">
              <button class="btn small" type="button" data-focus-path="${escapeHtml(item.path)}">定位</button>
              <button class="btn ghost small" type="button" data-copy-path="${escapeHtml(item.path)}" data-copy-code="${escapeHtml(item.code)}">复制</button>
            </div>
          </article>`).join("")}
        </section>`;
      }).join("");
      const errorCount = issues.filter(item => item.severity === "error").length;
      const warningCount = issues.length - errorCount;
      const toolbar = `<div class="issue-toolbar">
        <div class="issue-counts"><b>${issues.length}</b><span>条结果</span><em>${errorCount} 阻断</em><em>${warningCount} 警告</em></div>
        <div class="issue-filters">
          ${[["all", "全部"], ["error", "阻断"], ["warning", "警告"]].map(([value, label]) => `<button type="button" data-validation-filter="${value}"${validationFilter === value ? ' class="on"' : ""}>${label}</button>`).join("")}
        </div>
      </div>`;
      return toolbar + (renderedGroups || `<div class="empty-issues">当前筛选下没有校验问题。</div>`);
    }

    function renderReadinessSummary(result) {
      const domains = ["contract", "basic", "taxonomy", "metadata", "flow"];
      const items = domains.map(domain => {
        const errors = result.errors.filter(item => issueDomain(item.path) === domain).length;
        const warnings = result.warnings.filter(item => issueDomain(item.path) === domain).length;
        const state = errors ? "error" : warnings ? "warning" : "ready";
        const [title, tab] = domainMeta(domain);
        return {
          domain,
          html: `<button type="button" ${domain === "flow" ? 'data-object-focus="true"' : `data-inspector-tab="${tab}"`} data-domain="${domain}" class="${state}">
          <b>${escapeHtml(title)}</b><span>${errors ? `${errors} 个阻断` : warnings ? `${warnings} 个警告` : "完成"}</span>
          </button>`,
        };
      });
      const readyDomains = domains.filter(domain =>
        !result.errors.some(item => issueDomain(item.path) === domain)).length;
      const progress = Math.round(readyDomains / domains.length * 100);
      el("readinessSummary").innerHTML = `<header>
          <b>提交准备度</b>
          <span class="status ${result.status === "ready_to_submit" ? "ready" : "draft"}">${result.status}</span>
        </header>
        <div class="readiness-progress"><span style="width:${progress}%"></span></div>
        <div class="readiness-metrics">
          <div><b>${readyDomains}/${domains.length}</b><span>域无阻断</span></div>
          <div><b>${result.errors.length}</b><span>阻断</span></div>
          <div><b>${result.warnings.length}</b><span>警告</span></div>
          <div><b>${documentState.nodes.length + documentState.edges.length}</b><span>图对象</span></div>
          <div><b>${documentState.strategyActions.length + documentState.processActions.length}</b><span>动作</span></div>
        </div>
        <div>${items.map(item => `${item.html}<small>${escapeHtml(domainDetail(item.domain))}</small>`).join("")}</div>`;
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
      renderReadinessSummary(result);
      el("issueList").innerHTML = issues.length ? renderIssueGroups(issues) : `<div class="empty-issues">没有校验问题。</div>`;
      const editorPill = el("editorStatusPill");
      editorPill.textContent = result.status;
      editorPill.className = `status ${result.status === "ready_to_submit" ? "ready" : "draft"}`;
      el("editorIssueCount").textContent = `${result.errors.length} errors · ${result.warnings.length} warnings`;
      const exportState = result.status === "ready_to_submit" ? "ready_to_submit" : "draft";
      el("exportDesignStatus").textContent = exportState;
      const metadataErrors = result.errors.filter(item => issueDomain(item.path) === "metadata");
      el("exportMetadataStatus").textContent = metadataErrors.length ? "draft" : "ready_to_submit";
      const importCaseArgument = clean(documentState.strategy.registrationCaseId)
        ? `  --case ${clean(documentState.strategy.registrationCaseId)} \\\n`
        : "";
      el("exportCliTemplate").value = `python3 strategy-workbench/scripts/manage_case.py --json import-flow \\
${importCaseArgument}  --design ./${clean(documentState.strategy.strategyName) || "strategy-flow"}-0.8.json \\
  --metadata ./${clean(documentState.strategy.strategyName) || "strategy-flow"}-registration-metadata-2.0.json \\
  --actor 李四 \\
  --request-id REQ-IMPORT-FLOW-001`;
      el("jsonOutput").value = toJSON(documentState);
      el("mermaidOutput").value = toMermaid(documentState);
      const metadataOutput = el("metadataOutput");
      if (metadataOutput) metadataOutput.value = toRegistrationMetadataJSON(documentState);
    }

    function renderParadigm() {
      document.querySelectorAll("#paradigmSwitch button").forEach(button => {
        button.classList.toggle("on", button.dataset.paradigm === documentState.strategy.paradigm);
      });
      const status = el("paradigmStatus");
      if (status) status.textContent = documentState.strategy.paradigm === "scene" ? "场景" : "客群";
    }

    function renderSoft() {
      renderCanvas();
      renderColumns();
      renderTracks();
      renderParadigm();
      renderValidation();
      saveDraft();
    }

    function renderAll() {
      renderSoft();
      renderRegistrationInspector();
      renderInspector();
    }

    function autoLayout() {
      if (!documentState.nodes.length) return;
      pushHistory("auto-layout");
      documentState = autoLayoutDocument(documentState);
      canvasShell.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      renderAll();
    }

    function applyImport(raw, silent = false) {
      try {
        const parsed = JSON.parse(raw);
        pushHistory("import");
        documentState = normalizeDocument(parsed);
        clearSelection();
        renderAll();
        const result = validateDocument(documentState);
        if (!silent) toast(result.errors.length ? "已导入草稿；仍有校验错误" : "导入成功，校验通过");
      } catch (error) {
        if (!silent) toast(`JSON 解析失败：${error.message}`, true);
      }
    }

    function applyMetadataImport(raw, silent = false) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.schemaVersion !== METADATA_SCHEMA_VERSION) {
          if (!silent) toast(`注册元数据版本必须是 ${METADATA_SCHEMA_VERSION}`, true);
          return;
        }
        const metadataValidation = validateRegistrationMetadata(parsed);
        if (metadataValidation.errors.length && !silent) {
          toast(`注册元数据仍有 ${metadataValidation.errors.length} 个错误`, true);
        }
        pushHistory("import-metadata");
        documentState.registrationMetadata = normalizeRegistrationMetadata(parsed);
        renderAll();
        if (!silent) toast("注册元数据已导入");
      } catch (error) {
        if (!silent) toast(`注册元数据解析失败：${error.message}`, true);
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

    function ensureExportContract() {
      const gate = outputContractGate(documentState);
      if (gate.ready) return true;
      const first = gate.blocking[0];
      toast(`导出未达输出契约：${first.code} ${first.path}`, true);
      return false;
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

    function objectFromIssuePath(path) {
      const match = /^(nodes|edges|columns|tracks|strategyActions|processActions)\[(\d+)\]/.exec(clean(path));
      if (!match) return null;
      const collectionName = match[1];
      const index = Number(match[2]);
      const collection = {
        nodes: documentState.nodes,
        edges: documentState.edges,
        columns: documentState.columns,
        tracks: documentState.tracks,
        strategyActions: documentState.strategyActions,
        processActions: documentState.processActions,
      }[collectionName];
      const item = collection?.[index];
      if (!item) return null;
      const kind = {
        nodes: "node",
        edges: "edge",
        columns: "column",
        tracks: "track",
        strategyActions: "strategyAction",
        processActions: "processAction",
      }[collectionName];
      return { kind, id: item.localId };
    }

    function focusIssue(path) {
      const domain = issueDomain(path);
      if (domain === "taxonomy") activeInspectorTab = "taxonomy";
      else if (domain === "metadata") activeInspectorTab = "metadata";
      else if (domain === "flow") {
        const object = objectFromIssuePath(path);
        if (object) {
          selected = object;
          selection = new Set([selectionKey(object.kind, object.id)]);
          if (!layoutState.right) setPanelVisible("right", true);
        }
      } else activeInspectorTab = "basic";

      if (domain !== "flow") {
        registrationDrawer.hidden = false;
        renderRegistrationInspector();
      }
      renderInspector();
      if (domain === "taxonomy") {
        const fieldCode = clean(path).match(/taxonomy\.(?:tagSelections\.)?([a-zA-Z0-9_]+)/)?.[1];
        const groupByField = {
          lifecycle: "customer", customerClass: "customer", assetRange: "customer", riskLevel: "customer",
          businessScene: "business", strategyType: "business", strategySubtype: "business",
          touchScene: "touch", touchMethod: "touch",
        };
        const group = groupByField[fieldCode] || "proposals";
        const details = registrationDrawer.querySelector(`[data-taxonomy-group="${group}"]`);
        if (details) {
          details.open = true;
          details.scrollIntoView({ block: "nearest" });
        }
      }
    }

    function bindInspectorSurface(surface) {
      surface.addEventListener("click", event => {
      const touchChip = event.target.closest("[data-touch-remove]");
      if (touchChip) {
        const container = touchChip.closest("[data-touch-container]");
        const fieldCode = container?.dataset.touchContainer;
        pushHistory(`touch.${fieldCode}.${touchChip.dataset.touchRemove}`);
        removeActionTouchSelection(fieldCode, touchChip.dataset.touchRemove);
        renderAll();
        event.preventDefault();
        return;
      }
      const touchToggle = event.target.closest("[data-touch-toggle]");
      if (touchToggle) {
        const fieldCode = touchToggle.dataset.touchToggle;
        setTouchDropdown(fieldCode, openTouchDropdown !== fieldCode);
        if (openTouchDropdown === fieldCode) {
          document.querySelector(`[data-touch-container="${fieldCode}"] input[type="checkbox"]`)?.focus();
        }
        event.preventDefault();
        return;
      }
      const tabButton = event.target.closest("[data-inspector-tab]");
      if (!tabButton || tabButton.disabled) return;
      activeInspectorTab = tabButton.dataset.inspectorTab;
      // Keep the click target attached until document-level click handling is
      // finished; replacing the tab subtree mid-bubble can look like a background click.
      requestAnimationFrame(() => {
        if (surface === registrationDrawer) renderRegistrationInspector();
        else renderInspector();
      });
      });

      surface.addEventListener("input", event => {
        const target = event.target;
        const path = target.dataset?.bind;
        const bulkAssignmentField = target.dataset?.bulkAssignment;
        if (bulkAssignmentField) {
          applyBulkNodeAssignment(bulkAssignmentField, target.value);
          return;
        }
        if (target.dataset.touchField) {
          pushHistory(`touch.${target.dataset.touchField}.${target.dataset.touchCode}`);
          updateActionTouchSelection(target, target.checked);
          renderAll();
          return;
        }
        if (target.dataset.taxonomyField) {
        pushHistory(`taxonomy.${target.dataset.taxonomyField}.${target.dataset.taxonomyCode}`);
        updateTaxonomySelection(target);
        renderAll();
        return;
      }
      if (!path) return;
      const current = selectedObject();
      if (target.dataset.action === "toggle-no-action") {
        pushHistory(path);
        const behaviorName = path.includes(".subjectBehavior.") ? "subjectBehavior" : "actorBehavior";
        const behavior = selectedObject()?.value?.[behaviorName];
        if (target.checked) {
          setPath(`${path.replace(/\.noAction$/, "")}.action`, "无动作");
          setPath(`${path.replace(/\.noAction$/, "")}.status`, "no_requirement");
        } else {
          setPath(`${path.replace(/\.noAction$/, "")}.status`, behaviorName === "subjectBehavior" ? "happened" : "executed");
          if (behavior?.action === "无动作") {
            setPath(`${path.replace(/\.noAction$/, "")}.action`, "待确认");
          }
        }
        renderAll();
        return;
      }
      pushHistory(path);
      if (target.type === "checkbox") {
        setPath(path, target.checked);
      } else if (path.endsWith(".metrics")) {
        setPath(path, target.value.split(/\n|(、)/).map(clean).filter(Boolean));
      } else {
        setPath(path, path.endsWith(".sortOrder") && clean(target.value) !== ""
          ? Number(target.value)
          : target.value);
      }
      if (path.endsWith(".nodeType") && clean(target.value) === "classification") {
        documentState.sourceSchemaVersion = SCHEMA_VERSION;
      }
      if (path.endsWith(".nodeId")) {
        renderAll();
        return;
      }
      if (path.endsWith(".columnId") && current?.kind === "node") {
        current.value.sortOrder = nextSortOrder(documentState.nodes.filter(item =>
          item.columnId === current.value.columnId && item.localId !== current.value.localId));
        renderAll();
        return;
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

      surface.addEventListener("click", event => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      if (button.dataset.action === "delete") deleteSelected();
      if (button.dataset.action === "add-strategy") addStrategyAction();
      if (button.dataset.action === "add-process") addProcessAction();
      if (button.dataset.action === "add-proposal") addCustomTagProposal();
      if (button.dataset.action === "add-trigger-scene") addTriggerScene();
      if (button.dataset.action === "delete-proposal") {
        pushHistory("delete-custom-tag-proposal");
        documentState.taxonomy.customTagProposals.splice(Number(button.dataset.index), 1);
        renderAll();
      }
      if (button.dataset.action === "delete-trigger-scene") {
        pushHistory("delete-trigger-scene");
        documentState.registrationMetadata.triggerScenes.splice(Number(button.dataset.index), 1);
        renderAll();
      }
      });

      surface.addEventListener("keydown", event => {
        if (event.key === "Escape" && openTouchDropdown) {
          closeTouchDropdowns(true);
          event.preventDefault();
          return;
        }
        const trigger = event.target.closest("[data-touch-toggle]");
        if (!trigger || (event.key !== "Enter" && event.key !== " ")) return;
        const fieldCode = trigger.dataset.touchToggle;
        setTouchDropdown(fieldCode, openTouchDropdown !== fieldCode);
        if (openTouchDropdown === fieldCode) {
          document.querySelector(`[data-touch-container="${fieldCode}"] input[type="checkbox"]`)?.focus();
        }
        event.preventDefault();
      });
    }

    bindInspectorSurface(inspector);
    bindInspectorSurface(registrationDrawer);

    document.addEventListener("pointerdown", event => {
      if (!event.target.closest(".multi-select")) closeTouchDropdowns();
    }, true);

    nodeLayer.addEventListener("click", event => {
      const chip = event.target.closest("[data-select-kind]");
      if (chip) {
        // Detect double-click via detail count, not the dblclick event:
        // the first click's renderAll() replaces nodeLayer.innerHTML,
        // detaching the original target before dblclick can dispatch.
        if (event.detail >= 2) {
          event.preventDefault();
          openInspectorFor(chip.dataset.selectKind, chip.dataset.selectId);
          return;
        }
        if (event.ctrlKey || event.metaKey) toggleSelection(chip.dataset.selectKind, chip.dataset.selectId);
        else setSelection([{ kind: chip.dataset.selectKind, id: chip.dataset.selectId }], { kind: chip.dataset.selectKind, id: chip.dataset.selectId });
        renderAll();
        return;
      }
      const card = event.target.closest(".node-card");
      if (card) {
        if (clickOrigin?.moved) return;
        if (event.detail >= 2) {
          event.preventDefault();
          openInspectorFor("node", card.dataset.id);
          return;
        }
        if (event.ctrlKey || event.metaKey) toggleSelection("node", card.dataset.id);
        else setSelection([{ kind: "node", id: card.dataset.id }], { kind: "node", id: card.dataset.id });
        renderAll();
      }
    });

    nodeLayer.addEventListener("dblclick", event => {
      const chip = event.target.closest("[data-select-kind]");
      if (chip) {
        event.preventDefault();
        openInspectorFor(chip.dataset.selectKind, chip.dataset.selectId);
        return;
      }
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
      if (event.ctrlKey || event.metaKey) {
        toggleSelection("node", node.localId);
        renderAll();
        event.preventDefault();
        return;
      }
      let entries = selectedEntries();
      if (!entries.some(entry => entry.kind === "node" && entry.id === node.localId)) {
        entries = [{ kind: "node", id: node.localId }];
      }
      setSelection(entries, { kind: "node", id: node.localId });
      renderInspector();
      renderCanvas();
      const point = canvasPoint(event);
      const dragNodeIds = selectedNodeIds();
      const dragNodes = dragNodeIds
        .map(id => {
          const item = documentState.nodes.find(candidate => candidate.localId === id);
          return item ? { id, x: item.layout.x, y: item.layout.y } : null;
        })
        .filter(Boolean);
      nodeDrag = {
        id: node.localId,
        startPointerX: point.x,
        startPointerY: point.y,
        nodes: dragNodes,
      };
      dragNodeIds.forEach(id => document.getElementById(`node-${id}`)?.classList.add("dragging"));
      try { card.setPointerCapture?.(event.pointerId); } catch (_) { /* pointer capture is best-effort */ }
      event.preventDefault();
    });

    edgeSvg.addEventListener("pointerdown", event => {
      const path = event.target.closest("path.hit");
      if (!path) return;
      if (event.ctrlKey || event.metaKey) toggleSelection("edge", path.dataset.edgeId);
      else setSelection([{ kind: "edge", id: path.dataset.edgeId }], { kind: "edge", id: path.dataset.edgeId });
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
      if (event.ctrlKey || event.metaKey) toggleSelection("edge", edgeId);
      else setSelection([{ kind: "edge", id: edgeId }], { kind: "edge", id: edgeId });
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
      if (event.shiftKey) {
        const point = canvasPoint(event);
        selectionDrag = { startX: point.x, startY: point.y, x: point.x, y: point.y };
        selectionBox.hidden = false;
        selectionBox.style.left = `${point.x}px`;
        selectionBox.style.top = `${point.y}px`;
        selectionBox.style.width = "0px";
        selectionBox.style.height = "0px";
        event.preventDefault();
        return;
      }
      canvasPan = { x: event.clientX, y: event.clientY, left: canvasShell.scrollLeft, top: canvasShell.scrollTop };
      canvasShell.classList.add("dragging");
    });

    document.addEventListener("pointermove", event => {
      if (panelResize) {
        const deltaX = event.clientX - panelResize.startX;
        const deltaY = event.clientY - panelResize.startY;
        if (panelResize.name === "left") {
          setPanelSize("left", panelResize.startLeft + deltaX);
        } else if (panelResize.name === "right") {
          setPanelSize("right", panelResize.startRight - deltaX);
        } else if (panelResize.name === "bottom") {
          setPanelSize("bottom", panelResize.startBottom - deltaY);
        }
        event.preventDefault();
        return;
      }
      if (
        clickOrigin
        && Math.hypot(event.clientX - clickOrigin.x, event.clientY - clickOrigin.y) > 3
      ) {
        clickOrigin.moved = true;
      }
      if (edgeLabelDrag) {
        const edge = documentState.edges.find(item => item.localId === edgeLabelDrag.id);
        if (edge) {
          if (!edgeLabelDrag.pushed) {
            pushHistory(`edge-label:${edgeLabelDrag.id}`);
            edgeLabelDrag.pushed = true;
          }
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
        if (nodeDrag.nodes.length) {
          if (!nodeDrag.pushed) {
            pushHistory(`node-drag:${nodeDrag.nodes.map(item => item.id).sort().join(",")}`);
            nodeDrag.pushed = true;
          }
          // Clamp the group bounding box, not each card. Per-card clamping at
          // the top/left edge would compress a multi-card selection.
          const minX = Math.min(...nodeDrag.nodes.map(item => item.x));
          const minY = Math.min(...nodeDrag.nodes.map(item => item.y));
          const deltaX = Math.max(-minX, point.x - nodeDrag.startPointerX);
          const deltaY = Math.max(-minY, point.y - nodeDrag.startPointerY);
          nodeDrag.nodes.forEach(item => {
            const node = documentState.nodes.find(candidate => candidate.localId === item.id);
            if (!node) return;
            node.layout.x = Math.round(item.x + deltaX);
            node.layout.y = Math.round(item.y + deltaY);
            const card = document.getElementById(`node-${item.id}`);
            if (card) card.style.transform = `translate(${node.layout.x}px,${node.layout.y}px)`;
          });
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
      if (selectionDrag) {
        const point = canvasPoint(event);
        selectionDrag.x = point.x;
        selectionDrag.y = point.y;
        const left = Math.min(selectionDrag.startX, point.x);
        const top = Math.min(selectionDrag.startY, point.y);
        const width = Math.abs(point.x - selectionDrag.startX);
        const height = Math.abs(point.y - selectionDrag.startY);
        selectionBox.style.left = `${left}px`;
        selectionBox.style.top = `${top}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
      }
    });

    document.addEventListener("pointerup", event => {
      if (panelResize) {
        const name = panelResize.name;
        panelResize = null;
        document.body.classList.remove("panel-resizing", `resizing-${name}`);
        renderLayout();
        saveLayout();
        return;
      }
      if (edgeLabelDrag) {
        edgeLabelDrag = null;
        edgeLabelLayer.classList.remove("dragging");
        renderValidation();
        saveDraft();
      }
      if (nodeDrag) {
        nodeDrag.nodes.forEach(item => {
          document.getElementById(`node-${item.id}`)?.classList.remove("dragging");
        });
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
      if (selectionDrag) {
        const rect = {
          left: Math.min(selectionDrag.startX, selectionDrag.x),
          right: Math.max(selectionDrag.startX, selectionDrag.x),
          top: Math.min(selectionDrag.startY, selectionDrag.y),
          bottom: Math.max(selectionDrag.startY, selectionDrag.y),
        };
        const intersects = box => box
          && box.x < rect.right
          && box.x + box.w > rect.left
          && box.y < rect.bottom
          && box.y + box.h > rect.top;
        const entries = [
          ...documentState.nodes
            .map(node => ({ node, box: nodeBox(node.localId) }))
            .filter(item => intersects(item.box))
            .map(item => ({ kind: "node", id: item.node.localId })),
          ...[...edgeLabelLayer.querySelectorAll(".edge-label")].map(label => {
            const box = label.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            return {
              id: label.dataset.edgeId,
              box: {
                x: (box.left - canvasRect.left) / layoutState.zoom,
                y: (box.top - canvasRect.top) / layoutState.zoom,
                w: box.width / layoutState.zoom,
                h: box.height / layoutState.zoom,
              },
            };
          }).filter(item => intersects(item.box)).map(item => ({ kind: "edge", id: item.id })),
        ];
        selectionDrag = null;
        selectionBox.hidden = true;
        setSelection(entries);
        renderAll();
      }
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
      const protectedByStaticSurface = event.composedPath().some(node =>
        node instanceof Element
        && (node.closest(".topbar") || node.closest(".side-panel") || node.closest(".bottom-panel") || node.closest(".export-drawer")));
      const protectedByCanvasObject = event.composedPath().some(node =>
        node instanceof Element
        && (node.closest(".node-card") || node.closest(".edge-label") || node.closest("path.hit")));
      if (protectedByStaticSurface || protectedByCanvasObject) return;
      clearSelection();
      renderAll();
    });

    el("nodeButtons").addEventListener("click", event => {
      const button = event.target.closest("[data-node-type]");
      if (button) addNode(button.dataset.nodeType);
    });
    el("columnList").addEventListener("click", event => {
      const button = event.target.closest("[data-select-column]");
      if (!button) return;
      selected = { kind: "column", id: button.dataset.selectColumn };
      selection = new Set([selectionKey("column", button.dataset.selectColumn)]);
      renderAll();
    });
    el("addColumnBtn").addEventListener("click", addColumn);
    el("trackModeBtn").addEventListener("click", () => setTrackMode(!documentState.trackMode));
    el("trackList").addEventListener("click", event => {
      const button = event.target.closest("[data-select-track]");
      if (!button) return;
      selected = { kind: "track", id: button.dataset.selectTrack };
      selection = new Set([selectionKey("track", button.dataset.selectTrack)]);
      renderAll();
    });
    el("addTrackBtn").addEventListener("click", addTrack);
    el("copySelectionBtn").addEventListener("click", copySelection);
    el("pasteSelectionBtn").addEventListener("click", pasteClipboard);
    el("deleteSelectionBtn").addEventListener("click", deleteSelected);
    el("undoBtn").addEventListener("click", undo);
    el("redoBtn").addEventListener("click", redo);
    document.addEventListener("keydown", event => {
      const target = event.target;
      if (target?.closest?.("input, select, textarea")) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelection();
      } else if (modifier && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteClipboard();
      } else if (modifier && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelection([
          ...documentState.nodes.map(item => ({ kind: "node", id: item.localId })),
          ...documentState.edges.map(item => ({ kind: "edge", id: item.localId })),
        ]);
        renderAll();
      } else if (modifier && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      } else if ((modifier && event.shiftKey && event.key.toLowerCase() === "z")
        || (event.ctrlKey && event.key.toLowerCase() === "y")) {
        event.preventDefault();
        redo();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      } else if (event.key === "Escape") {
        clearSelection();
        renderAll();
      }
    });
    el("toggleLeftPanelBtn").addEventListener("click", event => setPanelVisible("left", !layoutState.left));
    el("toggleRightPanelBtn").addEventListener("click", event => setPanelVisible("right", !layoutState.right));
    el("toggleBottomPanelBtn").addEventListener("click", event => setPanelVisible("bottom", !layoutState.bottom));
    document.querySelectorAll("[data-panel-resizer]").forEach(handle => {
      handle.addEventListener("pointerdown", startPanelResize);
      handle.addEventListener("keydown", event => {
        const name = handle.dataset.panelResizer;
        const step = event.shiftKey ? 48 : 16;
        let handled = true;
        if (name === "left" && event.key === "ArrowLeft") setPanelSize(name, layoutState.leftWidth - step);
        else if (name === "left" && event.key === "ArrowRight") setPanelSize(name, layoutState.leftWidth + step);
        else if (name === "right" && event.key === "ArrowLeft") setPanelSize(name, layoutState.rightWidth + step);
        else if (name === "right" && event.key === "ArrowRight") setPanelSize(name, layoutState.rightWidth - step);
        else if (name === "bottom" && event.key === "ArrowUp") setPanelSize(name, layoutState.bottomHeight + step);
        else if (name === "bottom" && event.key === "ArrowDown") setPanelSize(name, layoutState.bottomHeight - step);
        else handled = false;
        if (handled) {
          event.preventDefault();
          saveLayout();
        }
      });
    });
    window.addEventListener("resize", () => {
      setPanelSize("left", layoutState.leftWidth);
      setPanelSize("right", layoutState.rightWidth);
      setPanelSize("bottom", layoutState.bottomHeight);
      saveLayout();
    });
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
      if (!window.confirm("确定清空当前草稿？可使用撤销恢复。")) return;
      pushHistory("reset");
      documentState = defaultDocument();
      clearSelection();
      renderAll();
      toast("已清空草稿");
    });
    el("importBtn").addEventListener("click", () => el("importFile").click());
    const importMenuButton = el("importMenuBtn");
    const importMenu = el("importMenu");
    const setImportMenu = visible => {
      importMenu.hidden = !visible;
      importMenuButton.classList.toggle("on", visible);
      importMenuButton.setAttribute("aria-expanded", String(visible));
    };
    importMenuButton.addEventListener("click", event => {
      event.stopPropagation();
      setImportMenu(importMenu.hidden);
    });
    importMenu.addEventListener("click", () => setImportMenu(false));
    document.addEventListener("click", event => {
      if (!event.target.closest(".import-actions")) setImportMenu(false);
    });
    el("importFile").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      applyImport(await file.text());
      event.target.value = "";
    });
    el("importMetadataBtn").addEventListener("click", () => el("importMetadataFile").click());
    el("importMetadataFile").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      applyMetadataImport(await file.text());
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
    const moreActionsButton = el("moreActionsBtn");
    const moreActionsMenu = el("moreActionsMenu");
    const setMoreActions = visible => {
      moreActionsMenu.hidden = !visible;
      moreActionsButton.classList.toggle("on", visible);
      moreActionsButton.setAttribute("aria-expanded", String(visible));
    };
    moreActionsButton.addEventListener("click", event => {
      event.stopPropagation();
      setMoreActions(moreActionsMenu.hidden);
    });
    moreActionsMenu.addEventListener("click", () => setMoreActions(false));
    document.addEventListener("click", event => {
      if (!event.target.closest(".more-actions")) setMoreActions(false);
    });

    el("openExportDrawerBtn").addEventListener("click", () => {
      el("exportDrawer").hidden = false;
    });
    el("closeExportDrawerBtn").addEventListener("click", () => {
      el("exportDrawer").hidden = true;
    });
    el("openRegistrationDrawerBtn").addEventListener("click", () => {
      registrationDrawer.hidden = false;
      renderRegistrationInspector();
    });
    el("closeRegistrationDrawerBtn").addEventListener("click", () => {
      registrationDrawer.hidden = true;
    });
    let agentDraft = null;
    let agentCorpus = null;
    const agentEvidence = evidenceId => {
      const fragment = agentCorpus?.fragments?.find(item => item.evidenceId === evidenceId);
      if (!fragment) return `证据 ${evidenceId}：未导入证据库，无法预览原文。`;
      return `【${fragment.evidenceId}】${fragment.fileId} · ${fragment.fragmentType}\n${fragment.text}`;
    };
    const renderAgentDrawer = () => {
      const meta = el("agentDraftMeta");
      const provenanceList = el("agentProvenanceList");
      const questionList = el("agentQuestionList");
      if (!agentDraft) {
        meta.textContent = "尚未导入草稿。先用 strategy-agent generate-draft 生成，再导入此处审查。";
        provenanceList.innerHTML = "";
        questionList.innerHTML = "";
        el("agentImportCandidateBtn").disabled = true;
        return;
      }
      const gate = agentDraftGate(agentDraft);
      meta.innerHTML = `草稿 <b>${escapeHtml(agentDraft.draftId)}</b> · ${agentCorpus ? "证据库已导入" : "证据库未导入"}`
        + `<br>轻量审查：可导入编辑器 · 待办 × ${gate.warnings.length}`;
      provenanceList.innerHTML = (agentDraft.provenance ?? []).map(item => `
        <div class="agent-item">
          <span class="agent-badge ${item.status}">${item.status}</span>
          <code>${escapeHtml(item.target ?? "design")}${escapeHtml(item.pointer)}</code>
          <span class="agent-refs">${(item.evidenceRefs ?? []).map(ref =>
            `<button type="button" class="agent-ref" data-evidence-id="${escapeHtml(ref)}">${escapeHtml(ref)}</button>`).join(" ")}</span>
        </div>`).join("") || "<p>无 provenance。</p>";
      questionList.innerHTML = (agentDraft.openQuestions ?? []).map(question => `
        <div class="agent-item">
          <code>${escapeHtml(question.target ?? "design")}${escapeHtml(question.pointer)}</code>
          <span>${escapeHtml(question.question)}</span>
        </div>`).join("") || "<p>无待确认问题。</p>";
      el("agentImportCandidateBtn").disabled = false;
    };
    el("openAgentDrawerBtn").addEventListener("click", () => {
      el("agentDrawer").hidden = false;
      renderAgentDrawer();
    });
    el("closeAgentDrawerBtn").addEventListener("click", () => {
      el("agentDrawer").hidden = true;
    });
    el("agentLoadDraftBtn").addEventListener("click", () => el("agentDraftFile").click());
    el("agentDraftFile").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = parseAgentDraft(JSON.parse(await file.text()));
        if (!parsed.ok) throw new Error(parsed.error);
        agentDraft = parsed.draft;
        renderAgentDrawer();
        toast("Agent 草稿已加载");
      } catch (error) {
        toast(`Agent 草稿加载失败：${error.message}`, true);
      }
      event.target.value = "";
    });
    el("agentLoadCorpusBtn").addEventListener("click", () => el("agentCorpusFile").click());
    el("agentCorpusFile").addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        if (parsed.schemaVersion !== "strategy-agent-evidence-corpus/0.1") throw new Error("证据库版本必须是 strategy-agent-evidence-corpus/0.1");
        agentCorpus = parsed;
        renderAgentDrawer();
        toast("Agent 证据库已加载");
      } catch (error) {
        toast(`Agent 证据库加载失败：${error.message}`, true);
      }
      event.target.value = "";
    });
    el("agentProvenanceList").addEventListener("click", event => {
      const button = event.target.closest("[data-evidence-id]");
      if (!button) return;
      el("agentEvidenceView").textContent = agentEvidence(button.dataset.evidenceId);
    });
    el("agentImportCandidateBtn").addEventListener("click", () => {
      if (!agentDraft) return;
      applyImport(JSON.stringify(agentDraft.candidate), true);
      applyMetadataImport(JSON.stringify(agentDraft.registrationMetadataCandidate), true);
      toast(`Agent 草稿已导入编辑器；待办 × ${agentDraftGate(agentDraft).warnings.length}，请人工裁决`);
      el("agentDrawer").hidden = true;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !moreActionsMenu.hidden) {
        setMoreActions(false);
        return;
      }
      if (event.key === "Escape" && !el("exportDrawer").hidden) el("exportDrawer").hidden = true;
      if (event.key === "Escape" && !registrationDrawer.hidden) registrationDrawer.hidden = true;
      if (event.key === "Escape" && !el("agentDrawer").hidden) el("agentDrawer").hidden = true;
    });

    el("issueList").addEventListener("click", event => {
      const filterButton = event.target.closest("[data-validation-filter]");
      if (filterButton) {
        validationFilter = filterButton.dataset.validationFilter;
        renderValidation();
        return;
      }
      const copyButton = event.target.closest("[data-copy-path]");
      if (copyButton) {
        copyText(`${copyButton.dataset.copyCode}\nJSON Path: ${copyButton.dataset.copyPath}`, "校验定位已复制");
        return;
      }
      const button = event.target.closest("[data-focus-path]");
      if (button) focusIssue(button.dataset.focusPath);
    });
    el("readinessSummary").addEventListener("click", event => {
      const button = event.target.closest("[data-inspector-tab], [data-object-focus]");
      if (!button || button.disabled) return;
      if (button.dataset.objectFocus === "true") {
        if (!layoutState.right) setPanelVisible("right", true);
        renderInspector();
        return;
      }
      activeInspectorTab = button.dataset.inspectorTab;
      registrationDrawer.hidden = false;
      renderRegistrationInspector();
    });
    el("copyJsonBtn").addEventListener("click", () => {
      if (ensureExportContract()) copyText(toJSON(documentState), "JSON 已复制");
    });
    el("copyJsonBottomBtn").addEventListener("click", () => {
      if (ensureExportContract()) copyText(toJSON(documentState), "JSON 已复制");
    });
    el("copyMetadataBtn").addEventListener("click", () => {
      if (ensureExportContract()) copyText(toRegistrationMetadataJSON(documentState), "注册元数据已复制");
    });
    el("copyMetadataBottomBtn").addEventListener("click", () => {
      if (ensureExportContract()) copyText(toRegistrationMetadataJSON(documentState), "注册元数据已复制");
    });
    el("copyMermaidBtn").addEventListener("click", () => copyText(toMermaid(documentState), "Mermaid 已复制"));
    const exportName = extension => `${clean(documentState.strategy.strategyName) || "strategy-flow"}-${SCHEMA_VERSION.split("/").pop()}.${extension}`;
    el("downloadJsonBtn").addEventListener("click", () => {
      if (ensureExportContract()) download(exportName("json"), toJSON(documentState), "application/json");
    });
    el("downloadMetadataBtn").addEventListener("click", () => {
      if (ensureExportContract()) download(`${clean(documentState.strategy.strategyName) || "strategy-flow"}-registration-metadata-2.0.json`, toRegistrationMetadataJSON(documentState), "application/json");
    });
    el("downloadMermaidBtn").addEventListener("click", () => download(exportName("mmd"), toMermaid(documentState), "text/plain"));
    document.querySelector(".panel-tabs").addEventListener("click", event => {
      const button = event.target.closest("[data-panel]");
      if (!button) return;
      document.querySelectorAll(".panel-tabs button").forEach(item => item.classList.toggle("on", item === button));
      document.querySelectorAll(".panel-view").forEach(item => item.classList.toggle("on", item.id === button.dataset.panel));
    });
    document.querySelector(".code-subtabs").addEventListener("click", event => {
      const button = event.target.closest("[data-code-pane]");
      if (!button) return;
      document.querySelectorAll(".code-subtabs button").forEach(item => item.classList.toggle("on", item === button));
      ["jsonCodePane", "metadataCodePane", "mermaidCodePane"].forEach(id => {
        el(id).classList.toggle("on", id === button.dataset.codePane);
      });
    });

    function sampleDocument() {
      return normalizeDocument({
        schemaVersion: SCHEMA_VERSION,
        strategy: {
          strategyName: "通用客群激活策略",
          paradigm: "customer",
          owner: "张三",
          submitter: "李四",
          version: "0.1",
          versionStatus: "draft",
        },
        taxonomy: {
          schemaVersion: TAXONOMY_SCHEMA_VERSION,
          tagSelections: [
            { fieldCode: "lifecycle", values: [{ code: "existing" }] },
            { fieldCode: "customerClass", values: [{ code: "generic" }] },
            { fieldCode: "assetRange", values: [{ code: "unlimited", parentCode: "generic" }] },
            { fieldCode: "riskLevel", values: [{ code: "unspecified" }] },
            { fieldCode: "businessScene", values: [{ code: "user_activation" }] },
            { fieldCode: "strategyType", values: [{ code: "tail_customer_operation", parentCode: "user_activation" }] },
            { fieldCode: "touchScene", values: [{ code: "app" }] },
            { fieldCode: "touchMethod", values: [{ code: "in_app_message", parentCode: "app" }] },
          ],
          freeTextTags: [{ fieldCode: "strategySubtype", value: "通用客群激活策略" }],
          customTagProposals: [],
        },
        registrationMetadata: {
          schemaVersion: METADATA_SCHEMA_VERSION,
          businessUnit: "数字金融总部客群经营与服务团队",
          submitDate: "2026-08-30",
          coreHook: "通用权益",
          effectiveFrom: "2026-08-30",
          baselineVersion: "",
          triggerScenes: [],
        },
        columns: [
          { localId: "c1", sortOrder: 10 },
        ],
        nodes: [
          { localId: "n1", nodeType: "entry", time: "启动日", executor: "系统", columnId: "c1", sortOrder: 10, subject: { type: "customer", name: "通用目标客群", state: "未触达" }, layout: { x: 80, y: 150 } },
          { localId: "n2", nodeType: "process", time: "启动后1日", executor: "系统", columnId: "c1", sortOrder: 20, subject: { type: "customer", name: "通用目标客群", state: "已触达" }, layout: { x: 440, y: 150 } },
          { localId: "n3", nodeType: "outcome", time: "观察期结束前", executor: "责任执行人", columnId: "c1", sortOrder: 30, subject: { type: "customer", name: "通用目标客群", state: "已转化" }, layout: { x: 800, y: 150 } },
        ],
        edges: [
          { localId: "e1", from: "n1", to: "n2", edgeType: "state_transition", actorBehavior: { time: "启动日", action: "多渠道触达", status: "executed" }, subjectBehavior: { time: "启动日", action: "点击链接", status: "happened" }, confirmed: true, mutexGroup: "g1", label: "点击后进入已触达" },
          { localId: "e2", from: "n2", to: "n3", edgeType: "handoff", actorBehavior: { time: "观察期结束前", action: "人工跟进", status: "executed" }, subjectBehavior: { time: "观察期结束前", action: "完成转化", status: "happened" }, confirmed: true, mutexGroup: "g2", label: "跟进并完成转化" },
        ],
        strategyActions: [
          { localId: "sa1", nodeId: "n1", outgoingEdgeId: "e1", judge: "无前置判断（流程入口）", touchScenes: [{ code: "app" }], touchMethods: [{ code: "in_app_message", parentCode: "app" }], theme: "引导完成关键行为", goal: "引导完成关键行为", hook: "通用权益", copy: "【通用示例文案】请按实际策略替换。", hasLink: true, metrics: ["触达数", "点击数", "点击率"] },
        ],
        processActions: [
          { localId: "pa1", nodeId: "n2", outgoingEdgeId: "", scene: "按实际场景填写", condition: "客户已触达且需要人工跟进", result: "线索转交责任执行人", action: "转交线索给责任执行人", hook: "待确认", metrics: ["任务数"] },
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
