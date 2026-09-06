"use strict";

// Offline deterministic model. It is a protocol reference implementation, not
// a business brain: every filled business fact must cite evidence, everything
// else stays 待确认/missing and becomes an open question. A real adapter must
// return the same shape and will be rejected by the same validator.

const {buildMatcher} = require("../taxonomy");

const PENDING = "待确认";

function firstFragment(corpus, predicate) {
  return corpus.fragments.find(predicate);
}

function matchPerson(corpus, keywords) {
  const pattern = new RegExp(`(?:${keywords})[:：]\\s*([^\\s，,。；;]+)`);
  for (const fragment of corpus.fragments) {
    const match = fragment.text.match(pattern);
    if (match) return {value: match[1], fragment};
  }
  return null;
}

function selectTaxonomy(corpus, matcher) {
  const selections = new Map();
  const provenance = [];
  for (const fragment of corpus.fragments) {
    for (const hit of matcher.match(fragment.text)) {
      if (!selections.has(hit.fieldCode)) selections.set(hit.fieldCode, new Map());
      const values = selections.get(hit.fieldCode);
      if (!values.has(hit.code)) {
        values.set(hit.code, hit);
        provenance.push({hit, fragment});
      }
    }
  }
  return {selections, provenance};
}

function flowTable(corpus) {
  return corpus.fragments.find(fragment =>
    ["table", "sheet"].includes(fragment.fragmentType)
    && fragment.table?.columns?.some(column => /时间|阶段/.test(column))
    && fragment.table.columns.some(column => /执行人|负责人/.test(column))
    && fragment.table.columns.some(column => /状态/.test(column))
  );
}

function columnValue(columns, row, patterns, fallback = PENDING) {
  const index = columns.findIndex(column => patterns.test(column));
  return index >= 0 && row[index] ? row[index] : fallback;
}

function buildGraphFromTable(table, evidenceId) {
  const nodes = [];
  const edges = [];
  table.rows.forEach((row, index) => {
    const localId = `n${index + 1}`;
    const executor = columnValue(table.columns, row, /执行人|负责人/);
    const state = columnValue(table.columns, row, /状态/);
    nodes.push({
      localId,
      nodeType: index === 0 ? "entry" : index === table.rows.length - 1 ? "outcome" : "process",
      time: columnValue(table.columns, row, /时间|阶段/),
      executor,
      sortOrder: (index + 1) * 10,
      subject: {
        type: "customer",
        name: columnValue(table.columns, row, /对象|客群|客户/),
        state,
      },
      layout: {x: 80 + index * 350, y: 160},
    });
    if (index > 0) {
      const previous = nodes[index - 1];
      edges.push({
        localId: `e${index}`,
        from: previous.localId,
        to: localId,
        edgeType: previous.executor === executor ? "state_transition" : "handoff",
        actorBehavior: {time: nodes[index].time, action: columnValue(table.columns, row, /动作|行为/), status: "executed"},
        subjectBehavior: {time: nodes[index].time, action: columnValue(table.columns, row, /对象动作|客户动作|行为/), status: "happened"},
        confirmed: false,
        mutexGroup: `g${index}`,
        overwriteSource: false,
        label: `${previous.subject.state} → ${state}`,
      });
    }
  });
  return {nodes, edges, evidenceId};
}

function buildMinimalGraph() {
  return {
    nodes: [{
      localId: "n1",
      nodeType: "entry",
      time: PENDING,
      executor: PENDING,
      sortOrder: 10,
      subject: {type: "customer", name: PENDING, state: PENDING},
      layout: {x: 80, y: 160},
    }, {
      localId: "n2",
      nodeType: "outcome",
      time: PENDING,
      executor: PENDING,
      sortOrder: 20,
      subject: {type: "customer", name: PENDING, state: PENDING},
      layout: {x: 430, y: 160},
    }],
    edges: [{
      localId: "e1",
      from: "n1",
      to: "n2",
      edgeType: "state_transition",
      actorBehavior: {time: PENDING, action: PENDING, status: "executed"},
      subjectBehavior: {time: PENDING, action: PENDING, status: "happened"},
      confirmed: false,
      mutexGroup: "g1",
      overwriteSource: false,
      label: PENDING,
    }],
    evidenceId: null,
  };
}

function generateDraft({corpus, corpusFingerprint, taxonomy, draftId, caseId, requestId, now}) {
  const matcher = buildMatcher(taxonomy);
  const provenance = [];
  const openQuestions = [];
  let questionIndex = 0;
  const question = (target, pointer, text, evidenceRefs = []) => {
    questionIndex += 1;
    openQuestions.push({target, questionId: `q-${String(questionIndex).padStart(3, "0")}`, pointer, question: text, evidenceRefs});
  };
  const mark = (target, pointer, status, evidenceRefs, confidence) => {
    const entry = {target, pointer, status, evidenceRefs: evidenceRefs ?? []};
    if (typeof confidence === "number") entry.confidence = confidence;
    provenance.push(entry);
  };

  const heading = firstFragment(corpus, fragment => fragment.fragmentType === "heading" || fragment.fragmentType === "slide");
  const strategyName = heading?.text ?? PENDING;
  const owner = matchPerson(corpus, "负责人|策略负责人");
  const submitter = matchPerson(corpus, "提交人");

  const {selections, provenance: taxonomyProvenance} = selectTaxonomy(corpus, matcher);
  const tagSelections = [];
  for (const field of matcher.fields) {
    if (field.cardinality === "free_text") continue;
    const values = selections.get(field.fieldCode);
    if (!values?.size) continue;
    tagSelections.push({
      fieldCode: field.fieldCode,
      values: [...values.values()].map(hit => {
        const value = {code: hit.code};
        if (hit.parentCode !== null) value.parentCode = hit.parentCode;
        return value;
      }),
    });
  }
  const freeTextTag = heading ? [{fieldCode: "strategySubtype", value: heading.text}] : [];

  const table = flowTable(corpus);
  const graph = table ? buildGraphFromTable(table.table, table.evidenceId) : buildMinimalGraph();
  if (graph.evidenceId) {
    mark("design", "/nodes", "supported", [graph.evidenceId], 0.85);
    mark("design", "/edges", "supported", [graph.evidenceId], 0.8);
  } else {
    mark("design", "/nodes", "missing");
    mark("design", "/edges", "missing");
    question("design", "/nodes", "材料中未找到可解析的流程表（需包含时间/阶段、执行人/负责人、状态列），流程需人工设计。");
  }

  const candidate = {
    schemaVersion: "strategy-flow-input/0.6",
    strategy: {
      strategyName,
      paradigm: "customer",
      owner: owner?.value ?? PENDING,
      submitter: submitter?.value ?? PENDING,
      version: "0.1",
      versionStatus: "draft",
    },
    taxonomy: {
      schemaVersion: taxonomy.schemaVersion,
      tagSelections,
      freeTextTags: freeTextTag,
      customTagProposals: [],
    },
    nodes: graph.nodes,
    edges: graph.edges,
    strategyActions: [],
    processActions: [],
  };

  if (heading) mark("design", "/strategy/strategyName", "supported", [heading.evidenceId], 0.9);
  else {
    mark("design", "/strategy/strategyName", "missing");
    question("design", "/strategy/strategyName", "材料中没有可作为策略名称的标题，请人工命名。");
  }
  for (const [field, matched] of [["owner", owner], ["submitter", submitter]]) {
    if (matched) mark("design", `/strategy/${field}`, "supported", [matched.fragment.evidenceId], 0.85);
    else {
      mark("design", `/strategy/${field}`, "missing");
      question("design", `/strategy/${field}`, `材料中未识别${field === "owner" ? "负责人" : "提交人"}，请人工确认。`);
    }
  }
  if (taxonomyProvenance.length) mark("design", "/taxonomy/tagSelections", "supported", [taxonomyProvenance[0].fragment.evidenceId], 0.75);
  else {
    mark("design", "/taxonomy/tagSelections", "missing");
    question("design", "/taxonomy/tagSelections", "材料中未命中任何策略标签字典值，必选标签需人工选择。");
  }

  const businessUnit = matchPerson(corpus, "团队|业务单位");
  const registrationMetadataCandidate = {
    schemaVersion: "strategy-flow-registration-metadata/2.0",
    businessUnit: businessUnit?.value ?? PENDING,
    submitDate: "",
    coreHook: PENDING,
    effectiveFrom: "",
    baselineVersion: "",
    triggerScenes: [],
  };
  if (businessUnit) mark("metadata", "/businessUnit", "supported", [businessUnit.fragment.evidenceId], 0.8);
  else {
    mark("metadata", "/businessUnit", "missing");
    question("metadata", "/businessUnit", "材料中未识别提交团队，请人工确认。");
  }
  mark("metadata", "/submitDate", "missing");
  mark("metadata", "/effectiveFrom", "missing");
  question("metadata", "/submitDate", "提交日期需业务确认，格式 YYYY-MM-DD。");
  question("metadata", "/effectiveFrom", "生效日期需业务确认，格式 YYYY-MM-DD。");

  return {
    schemaVersion: "strategy-agent-strategy-draft/0.1",
    draftId,
    caseId,
    requestId,
    createdAt: now,
    evidenceCorpus: {
      corpusId: corpus.corpusId,
      sha256: corpusFingerprint,
      parserVersion: corpus.parserVersion,
    },
    taxonomyVersion: taxonomy.schemaVersion,
    candidate,
    registrationMetadataCandidate,
    provenance,
    openQuestions,
    reviewState: {status: "draft"},
  };
}

module.exports = {generateDraft};
