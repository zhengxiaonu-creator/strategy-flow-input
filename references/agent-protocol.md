# strategy-agent/0.1 Protocol（M0 契约）

## 定位与不变量

本协议定义“非结构化材料 → 证据 → 草稿 → 人工确认 → 既有输出”的 Agent 通道。四条不变量：

1. **输出契约零改动。** `strategy-flow-input/0.2`、`strategy-flow-registration-metadata/2.0`、`strategy-taxonomy/2026-09` 保持原样；草稿在外层包装 candidate 与 provenance，不向输出 JSON 增加任何字段。
2. **草稿不是事实源。** Agent 产物永远是 draft；只有人工逐项确认后的字段才进入 canonical 编辑状态，最终仍以导出的 0.2 双文件为准。
3. **无证据不得确认。** `supported`/`conflict` 字段必须引用 corpus 中存在的 `evidenceId`；无证据的值只能 `missing` 并保持“待确认”或空值。
4. **Mermaid 不参与 round-trip。** 全链路只走 JSON 契约；Mermaid 仍是展示投影。

## 版本策略

- 本期契约：`strategy-agent-response/0.1`、`strategy-agent-source-manifest/0.1`、`strategy-agent-evidence-corpus/0.1`、`strategy-agent-strategy-draft/0.1`、`strategy-agent-errors/0.1`
- 未知版本一律拒绝，不做前向兼容猜测；升版必须先注册 adapter 和迁移规则。

## 命令与响应 envelope

命令注册表：

| 命令 | 输入 | 输出 data |
|---|---|---|
| `parse-sources` | source manifest | `{ manifest, corpus }` |
| `generate-draft` | `{ caseId, corpusId, corpusSha256, taxonomyVersion }` | `{ draft }` |
| `get-draft` | `{ caseId, draftId }` | `{ draft }` |
| `resolve-draft` | `{ caseId, draftId, resolvedFields }` | `{ draft }`（人工补齐事实，无需 token） |
| `request-approval` | `{ caseId, draftId, approver }` | `{ approvalTokenId, approvalToken, expiresAt }` |
| `confirm-draft` | `{ caseId, draftId, approvalToken }` | `{ draft }` + import-flow 模板（reviewState=confirmed） |
| `discard-draft` | `{ caseId, draftId }` | `{ draft }`（reviewState=discarded） |
| `get-case` | `{ caseId }` | `{ case, drafts, audit }` |

所有命令共用 `strategy-agent-response/0.1` envelope：

```json
{
  "schemaVersion": "strategy-agent-response/0.1",
  "requestId": "req-draft-20260830-001",
  "command": "generate-draft",
  "status": "ok",
  "replayed": false,
  "data": { "draft": {} }
}
```

规则：

1. `ok` 必须携带 `data` 且禁止 `error`；`error` 必须携带 `error` 且禁止 `data`。
2. `requestId` 由调用方生成，是幂等键；`replayed=true` 表示命中缓存，不是一次新执行。
3. 未知 command 拒绝处理，不得产生副作用。

## 幂等语义

| 命令 | 幂等键 | 行为 |
|---|---|---|
| `parse-sources` | requestId + 文件 sha256 有序集合 | 完全一致 → 返回缓存 corpus（`replayed=true`）；不一致 → `E_REQUEST_ID_CONFLICT` |
| `generate-draft` | requestId + corpusId + corpusSha256 + taxonomyVersion | 同上 |
| `resolve-draft` | requestId + draftId + resolvedFields | 同一补齐重复提交 → 返回缓存结果 |
| `confirm-draft` | requestId + draftId + approvalToken | token 一次性；重复消费 → `E_APPROVAL_TOKEN_REUSED` |
| `discard-draft` | requestId + draftId | 已 discarded 的重复请求返回缓存结果 |

会话记忆不是状态源：断点恢复只依赖持久化的 `caseId`、`reviewState`、`nextAction` 与审计记录。

## source manifest 语义

- `caseId` 是 Agent 会话内的本地编号（`AG-...`），与门户 `strategyId` 无关。
- 每个文件必须记录 `sha256`；解析前校验指纹，不一致即 `E_SOURCE_CHECKSUM_MISMATCH`。
- `parserStatus` 是唯一的状态口径：`pending`/`parsed`/`unsupported`/`failed`；`parsed` 必须带 `parsedAt` 和 `corpusIds`，`unsupported`/`failed` 必须带 `failureCode`，禁止静默跳过。

## evidence corpus 语义

- 解析是确定性过程：同一文件字节 + 同一 `parserVersion` 必须产出同一 corpus；解析阶段禁止调用模型。
- 每个 fragment 携带稳定 `evidenceId`（`ev-` 前缀），`ordinal` 记录文件内顺序。
- 表格和幻灯片必须同时给出结构化 `table`/`slide` 与扁平化 `text`，下游不得回读原始文件。
- corpus 规范指纹：对 corpus JSON 做键排序、无空白序列化后取 UTF-8 sha256；跨 `parserVersion` 的指纹不可比较。
- 引用完整性由校验器执行：`evidenceId` 全局唯一；`fileId` 必须存在于 manifest。

## strategy draft 语义

### 两段式校验

1. 形状校验：`strategy-agent-strategy-draft/0.1` Schema。
2. 语义校验：candidate 过既有 0.2 校验器；`registrationMetadataCandidate` 过既有 metadata 2.0 校验器；taxonomy 走既有字典规则。任何一段失败即拒绝，不允许“降级放行”。

### provenance 规则

| status | 语义 | 硬约束 |
|---|---|---|
| `supported` | 值有证据支撑 | `evidenceRefs ≥ 1`，必须给 `confidence` |
| `missing` | 材料中没有该事实 | `evidenceRefs = []`；candidate 对应值必须是“待确认”或空 |
| `conflict` | 证据互相矛盾 | `evidenceRefs ≥ 2`，必须给 `confidence` 和 `note`，人工裁决 |

- `pointer` 是 RFC 6901 JSON Pointer；`target=design` 解析到 candidate，`target=metadata` 解析到 registrationMetadataCandidate；指针必须可解析。
- 指向对象即覆盖该子树；子条目可用更精确的 pointer 覆盖父条目结论。
- 结构默认值（`paradigm`、内部 ID、`version`）不强制 provenance；业务事实字段强制。
- 确认硬门：存在任何 `missing`/`conflict` 项，或 candidate/metadata 未通过既有校验时，`request-approval` 与 `confirm-draft` 都必须拒绝（`E_DRAFT_UNCONFIRMED_REQUIRED_FIELD`）。

### 审批

- `confirm-draft` 必须携带一次性 token；token 与草稿绑定、过期作废、消费即弃。
- 授权只能来自显式确认动作，不得从自由对话推断；`reviewState.confirmed` 必须记录 `confirmedBy`、`confirmedAt`、`approvalTokenId`（只存引用，不存 token 值）。

## 错误码

错误码注册表：`contracts/strategy-agent-errors-0.1.json`。code 是契约的一部分，message 文案可变、code 不可变；新增 code 必须升协议版本。M0 注册的错误码覆盖 request/source/corpus/draft/review/approval/model/internal 八个阶段，关键码：

- `E_REQUEST_ID_CONFLICT`：幂等键被不同输入复用。
- `E_SOURCE_CHECKSUM_MISMATCH`：文件指纹不符，解析中止。
- `E_CORPUS_INVALID`：证据完整性失败。
- `E_DRAFT_CANDIDATE_INVALID`：Agent 试图绕过既有输出契约，拒绝。
- `E_DRAFT_PROVENANCE_EVIDENCE_MISSING`：无证据的值冒充 supported。
- `E_TAXONOMY_UNKNOWN_CODE`：字典外 code；新标签只能走 `customTagProposals` 审批。
- `E_DRAFT_UNCONFIRMED_REQUIRED_FIELD`：必填字段未确认，禁止批量放行。
- `E_APPROVAL_TOKEN_REUSED`：一次性 token 重复消费。

## round-trip 验收

```
材料文件
  → source-manifest（sha256 审计锚点）
  → evidence-corpus（确定性解析，evidenceId）
  → strategy-draft（candidate + provenance + openQuestions）
  → 人工逐项确认（显式审批 token）
  → canonical 编辑状态（现有导入路径，不变）
  → 导出 design 0.2 + metadata 2.0（现有导出，不变）
  → manage_case.py --json import-flow（现有唯一提交入口，不变）
```

验收断言（由 `npm test` 执行）：

1. manifest/corpus/draft/response 示例可解析且符合各自形状契约的关键约束。
2. corpus 引用完整：evidenceId 唯一，fileId ⊆ manifest。
3. draft 的 provenance/openQuestions 指针全部可解析；status 硬约束成立；evidenceRefs ⊆ corpus。
4. corpus 指纹与声明一致。
5. candidate 过 0.2 语义校验：`strategyId` 为空的草稿必须得到 `STRATEGY_FIELD_REQUIRED` 阻断——证明“缺事实不得编造”。
6. 确认后的 candidate 走现有 normalize/export round-trip，不丢失 strategy/nodes/edges/actions/taxonomy。

## 实现状态（M1–M4）

- **M1 解析**：`agent/parsers.js` + `agent/zip.js`，零依赖解析 docx/xlsx/pptx/csv/md；解析不调用模型，同字节 + 同 parserVersion 必产同 corpus。
- **M2 推理**：`agent/models/stub.js` 离线确定性模型；taxonomy 匹配完全由字典 label 派生，无硬编码业务词表；真实适配器必须返回同一 draft 形状，否则 `E_MODEL_OUTPUT_INVALID`。
- **M3 审查**：页面顶栏「Agent 草稿」抽屉：导入 draft/corpus → provenance / 待确认问题 / 证据预览 → blocked 清零才允许导入编辑器；Chrome E2E 覆盖阻断与放行两条路径。
- **M4 提交**：`resolve-draft`（人工补事实）→ `request-approval`（一次性 token，10 分钟）→ `confirm-draft`（消费 token、写审计、返回 `manage_case.py import-flow` 模板）；导出与提交路径不变。
- **状态**：`agent/store.js` 文件态存储 caseId/status/nextAction 与 manifests/corpora/drafts/tokens，外加 append-only `audit.jsonl`；恢复不依赖会话记忆。

CLI 快速路径：

```bash
npx strategy-agent parse-sources --case AG-demo-001 --file 需求.docx --file 流程.xlsx --request-id req-parse-1
npx strategy-agent generate-draft --case AG-demo-001 --request-id req-draft-1
npx strategy-agent resolve-draft --case AG-demo-001 --draft sd-... \
  --resolved 'design:/strategy/strategyId=WB-...' \
  --resolved 'metadata:/submitDate=2026-08-30'
npx strategy-agent request-approval --case AG-demo-001 --draft sd-... --approver Terry
npx strategy-agent confirm-draft --case AG-demo-001 --draft sd-... --token at-... --confirmed-by Terry
```
