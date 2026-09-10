# strategy-agent/0.1 Protocol（M0 契约）

## 定位与不变量

本协议定义“非结构化材料 → 证据 → 草稿 → 人工编辑 → 既有输出”的 Agent 通道。默认是轻量 human-in-loop 工作流：Agent 尽早把可编辑草稿交给画布，证据问题以待办呈现，最终只在导出边界检查输出契约。四条不变量：

1. **输出契约零改动。** candidate 可使用 `strategy-flow-input/0.2`、`0.3`、`0.4`、`0.5`、`0.6`、`0.7` 或 `0.8`，`strategy-flow-registration-metadata/2.0`、`strategy-taxonomy/2026-09` 保持原样；草稿在外层包装 candidate 与 provenance，不向输出 JSON 增加任何字段。
2. **草稿不是事实源。** Agent 产物永远是 draft；人工在 canonical 编辑状态中修改，最终仍以导出的 Design 0.8 与 Metadata 2.0 双文件为准。
3. **无证据不得冒充事实。** `supported`/`conflict` 字段必须引用 corpus 中存在的 `evidenceId`；无证据的值只能 `missing` 并保持“待确认”或空值。`missing`/`conflict`/`openQuestions` 是审查待办，不是导入编辑器的硬门。
4. **Mermaid 不参与 round-trip。** 全链路只走 JSON 契约；Mermaid 仍是展示投影。

## 版本策略

- 本期契约：`strategy-agent-response/0.1`、`strategy-agent-source-manifest/0.1`、`strategy-agent-evidence-corpus/0.1`、`strategy-agent-strategy-draft/0.1`、`strategy-agent-errors/0.1`
- 未知版本一律拒绝，不做前向兼容猜测；升版必须先注册 adapter 和迁移规则。

## 命令与响应 envelope

命令注册表：

| 命令 | 输入 | 输出 data |
|---|---|---|
| `parse-sources` | source manifest（可省略 `caseId`） | `{ caseId, manifest, corpus }` |
| `generate-draft` | `{ caseId, corpusId, corpusSha256, taxonomyVersion }` | `{ draft }` |
| `get-draft` | `{ caseId, draftId }` | `{ draft }` |
| `resolve-draft` | `{ caseId, draftId, resolvedFields }` | `{ draft }`（人工补齐事实，无需 token） |
| `request-approval` | `{ caseId, draftId, approver }` | `{ approvalTokenId, approvalToken, expiresAt }`（可选审计路径） |
| `confirm-draft` | `{ caseId, draftId, approvalToken }` | `{ draft }` + import-flow 模板（可选审计路径，reviewState=confirmed） |
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

- `caseId` 是 Agent 会话内的本地工作区 ID（`AG-...`），与看板 `registrationCaseId` / `strategyId` 均无关。`parse-sources` 缺省时自动生成并在响应中返回；业务人员不需要填写或理解它。
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

1. 草稿边界硬校验：`strategy-agent-strategy-draft/0.1` Schema、corpus 指纹、pointer 可解析、evidence 引用完整。
2. 导出边界硬校验：candidate 必须符合 `strategy-flow-input/0.2`、`0.3`、`0.4`、`0.5`、`0.6`、`0.7` 或 `0.8` 输出契约，metadata candidate 必须符合 `strategy-flow-registration-metadata/2.0`，并保持节点 / 边 / 动作引用完整。业务建议和证据待办在导出前以 warning 呈现。新草稿默认使用 no-track 0.8。
3. Design 0.8 的 `strategyActions[].touchScenes / touchMethods` 只能引用全局 taxonomy 已选范围内的已审批 code；Agent 不得生成自由文本触达值或伪造 taxonomy code。
4. Design 0.8 的 `columns` 与 `nodes[].columnId` 定义看板列；`nodes[].sortOrder` 在同一列内唯一。Agent 不得把画布布局坐标当作列或排序。
5. Agent 不得从材料结构、连通分量、节点名或坐标推断业务主线 Track。未拿到显式 Track 证据和全量节点归属时，只能生成 no-track 0.8，并把 Track 作为 openQuestion 提示。

### provenance 规则

| status | 语义 | 硬约束 |
|---|---|---|
| `supported` | 值有证据支撑 | `evidenceRefs ≥ 1`，必须给 `confidence` |
| `missing` | 材料中没有该事实 | `evidenceRefs = []`；candidate 对应值必须是“待确认”或空 |
| `conflict` | 证据互相矛盾 | `evidenceRefs ≥ 2`，必须给 `confidence` 和 `note`，人工裁决 |

- `pointer` 是 RFC 6901 JSON Pointer；`target=design` 解析到 candidate，`target=metadata` 解析到 registrationMetadataCandidate；指针必须可解析。
- 指向对象即覆盖该子树；子条目可用更精确的 pointer 覆盖父条目结论。
- 结构默认值（`paradigm`、内部 ID、`version`）不强制 provenance；业务事实字段强制。
- `missing`/`conflict` 与 `openQuestions` 不阻断导入编辑器；页面必须保留这些待办，人工在画布和属性栏中裁决。
- 可选审计路径中的 `request-approval` / `confirm-draft` 只在 candidate/metadata 未通过导出契约或引用完整性校验时拒绝（`E_DRAFT_UNCONFIRMED_REQUIRED_FIELD`），不得因 provenance 状态或 openQuestion 本身拒绝。

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
- `E_DRAFT_UNCONFIRMED_REQUIRED_FIELD`：candidate/metadata 未达到导出契约或引用完整性，禁止可选审计确认。
- `E_APPROVAL_TOKEN_REUSED`：一次性 token 重复消费。

## round-trip 验收

```
材料文件
  → source-manifest（sha256 审计锚点）
  → evidence-corpus（确定性解析，evidenceId）
  → strategy-draft（candidate + provenance + openQuestions）
  → canonical 编辑状态（missing / conflict / openQuestions 保留为待办）
  → 人工在画布 / 属性栏修改
  → 导出 design 0.8 + metadata 2.0
  → manage_case.py --json import-flow（现有唯一提交入口，不变）
```

验收断言（由 `npm test` 执行）：

1. manifest/corpus/draft/response 示例可解析且符合各自形状契约的关键约束。
2. corpus 引用完整：evidenceId 唯一，fileId ⊆ manifest。
3. draft 的 provenance/openQuestions 指针全部可解析；status 硬约束成立；evidenceRefs ⊆ corpus。
4. corpus 指纹与声明一致。
5. 新建策略草稿省略 `registrationCaseId` 与 `strategyId`，可以导入编辑器并导出；只有看板返回对应 ID 后才携带。
6. 带 `conflict` provenance 与 `openQuestion` 的 schema 合规草稿可以进入编辑器和可选审计路径。
7. 人工修正后的 candidate 走现有 normalize/export round-trip，不丢失 strategy/nodes/edges/actions/taxonomy；no-track 与 track-enabled 状态不得漂移。

## 实现状态（M1–M4）

- **M1 解析**：`agent/parsers.js` + `agent/zip.js`，零依赖解析 docx/xlsx/pptx/csv/md；解析不调用模型，同字节 + 同 parserVersion 必产同 corpus。
- **M2 推理**：`agent/models/stub.js` 离线确定性模型；taxonomy 匹配完全由字典 label 派生，无硬编码业务词表；真实适配器必须返回同一 draft 形状，否则 `E_MODEL_OUTPUT_INVALID`。
- **M3 审查**：页面顶栏「Agent 草稿」抽屉：导入 draft/corpus → provenance / 待确认问题 / 证据预览 → 直接导入编辑器；证据待办保留给人工处理。
- **M4 提交**：默认路径是编辑器人工修正 → 输出契约校验 → 导出双 JSON。`resolve-draft` → `request-approval`（一次性 token，10 分钟）→ `confirm-draft` 仅作为可选审计路径；导出与提交路径不变。
- **状态**：`agent/store.js` 文件态存储 caseId/status/nextAction 与 manifests/corpora/drafts/tokens，外加 append-only `audit.jsonl`；恢复不依赖会话记忆。

CLI 快速路径：

```bash
npx strategy-agent parse-sources --file 需求.docx --file 流程.xlsx --request-id req-parse-1
# Agent 从 parse-sources 响应读取本地工作区 ID，并在后续命令中内部传递。
npx strategy-agent generate-draft --case <local-workspace-id> --request-id req-draft-1
# 可选审计路径；默认路径是导入编辑器、人工修正后导出双 JSON
npx strategy-agent resolve-draft --case <local-workspace-id> --draft sd-... \
  --resolved 'metadata:/submitDate=2026-08-30'
npx strategy-agent request-approval --case <local-workspace-id> --draft sd-... --approver Terry
npx strategy-agent confirm-draft --case <local-workspace-id> --draft sd-... --token at-... --confirmed-by Terry
```
