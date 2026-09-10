# strategy-flow-input/0.8 Protocol

## 版本策略

- 当前导出版本：`strategy-flow-input/0.8`
- 兼容导入版本：`strategy-flow-input/0.1`、`strategy-flow-input/0.2`、`strategy-flow-input/0.3`、`strategy-flow-input/0.4`、`strategy-flow-input/0.5`、`strategy-flow-input/0.6`、`strategy-flow-input/0.7`
- 拒绝版本：未知版本、格式非法版本
- 版本格式：`strategy-flow-input/<major>.<minor>`

解析器使用显式版本注册表，不把未来版本自动当作已知契约。后续版本必须先注册 adapter 和迁移规则。

## 顶层 envelope

```json
{
  "schemaVersion": "strategy-flow-input/0.8",
  "strategy": {},
  "taxonomy": {},
  "columns": [],
  "nodes": [],
  "edges": [],
  "strategyActions": [],
  "processActions": [],
  "validation": {
    "status": "draft",
    "errors": [],
    "warnings": []
  }
}
```

`validation` 只在导出时由设计器计算；导入方必须重新计算，不得信任该字段。

## strategy

`strategy` 只承载策略事实：

```text
strategyName
strategyId（0.3 起可选；正式注册后由看板返回）
registrationCaseId（0.3 起可选；提交注册后由看板返回）
paradigm
owner
submitter
version
versionStatus
```

`businessScene`、`strategyType`、`strategySubtype` 禁止放在 `strategy` 下，必须分别进入 `taxonomy.tagSelections` 或 `taxonomy.freeTextTags`。

## taxonomy

契约版本：

```text
strategy-taxonomy/2026-09
```

```json
{
  "schemaVersion": "strategy-taxonomy/2026-09",
  "tagSelections": [
    {
      "fieldCode": "strategyType",
      "values": [
        {
          "code": "asset_upgrade_deposit",
          "parentCode": "asset_promotion"
        }
      ]
    }
  ],
  "freeTextTags": [
    {
      "fieldCode": "strategySubtype",
      "value": "资产提升专项策略"
    }
  ],
  "customTagProposals": []
}
```

规则：

1. `code` 是唯一持久化稳定值；`label` 仅展示，可省略。
2. 未知 code 拒绝，不会自动转为自定义标签。
3. 子标签必须携带字典要求的 `parentCode`。
4. `assetRange -> customerClass`、`strategyType -> businessScene`、`touchMethod -> touchScene` 必须满足父子映射。
5. 每个已选父标签至少要有一个对应子标签。
6. `unlimited` 只能配 `generic`，且不能与具体资产区间同选。
7. `unspecified` 风险等级不能与 C1-C5 同选。
8. 自定义标签只允许提案，不允许调用方生成 code；审批前阻断后续处理。

## metadata companion

`strategy-flow-input/0.8` 必须搭配：

```text
strategy-flow-registration-metadata/2.0
```

metadata 不承载任何 taxonomy 标签。设计器将两份文件分开导出；`registrationMetadata` 只存在于内部编辑状态和 companion 输出，不会混入 design JSON。

### 看板 ID 创建 / 更新

0.3 起区分两个看板 ID：

- `registrationCaseId`：提交注册时生成的 CaseID，用于定位本次提交注册过程。
- `strategyId`：正式注册后生成的策略编号，用于定位正式策略。

新建策略导出时两个字段都必须省略。看板提交注册成功后先返回 `registrationCaseId`；正式注册成功后返回 `strategyId`。后续更新提交中的策略可只携带 `registrationCaseId`；更新已正式注册策略时携带 `strategyId`，并建议同时携带 `registrationCaseId` 以便定位来源提交。

两个字段出现时必须是非空看板返回值，禁止导出空字符串、占位文本或 Agent 本地工作区 ID（`AG-...`），且二者不能相同。0.1 / 0.2 导入仍按旧契约校验 `strategyId`；0.2 不识别 `registrationCaseId`。

看板 importer 必须以 `requestId` 做导入幂等键：`registrationCaseId` 缺失表示创建提交注册，重放同一创建请求必须返回同一个 CaseID；`registrationCaseId` 存在表示继续对应提交。`strategyId` 缺失表示尚未正式注册，存在则更新对应正式策略，不得重新生成新编号。

## 0.8 业务主线 Track

`tracks` 是文档级可选能力。整体省略 `tracks` 且节点省略 `trackId` 时，就是完整合法的 no-track 0.8 文档；这不是待补全状态，也不产生质量 warning。

```json
{
  "tracks": [
    {
      "localId": "acquisition",
      "name": "获客预约",
      "description": "从模型分层到预约添加企微",
      "sortOrder": 10
    }
  ],
  "nodes": [
    { "localId": "nA1", "trackId": "acquisition", "columnId": "c2" }
  ]
}
```

规则：

1. `tracks` 可以整体省略；一旦出现必须至少包含一条 Track，不允许空数组。
2. `tracks[].localId` 必填且在 Track 范围内全局唯一；`name` 必填且不得为空；`description` 可选。
3. `tracks[].sortOrder` 必须是 `0` 到 `2147483647` 的整数，并在 Track 范围内唯一；它与 `columns[].sortOrder` 是两个独立排序空间。
4. 启用 Track 后，每个节点必须携带一个合法 `trackId`；节点只能有一个 primary Track，不支持多主线归属。
5. `tracks` 省略时，节点不得携带 `trackId`，也不允许空字符串占位。
6. 边可以跨 Track；跨 Track 状态由两端节点 `trackId` 推导，不得在 edge 上持久化 `crossTrack`。
7. Track 不改变 Column、节点排序、边语义或 action link 校验，也不替代 Column。
8. `layout.x / y` 不得推导 Column、Track 或任何业务顺序。
9. Track 不携带颜色、宽度、图标、折叠状态等视觉属性；这些由渲染器决定。
10. 迁移或导入时不得根据节点 ID 前缀、节点名称、连通分量、layout 坐标、executor、touch method 或 strategy name 猜测 Track。

阻断错误码：

```text
TRACK_EMPTY
TRACK_MODE_INVALID
TRACK_ID_INVALID
TRACK_ID_DUPLICATE
TRACK_NAME_REQUIRED
TRACK_SORT_ORDER_INVALID
TRACK_SORT_ORDER_DUPLICATE
NODE_TRACK_MISSING
NODE_TRACK_NOT_FOUND
NODE_TRACK_NOT_ENABLED
```

0.7 升级 0.8 可以完全不启用 Track：只改 `schemaVersion`，不添加 `tracks` 和 `node.trackId`，并记录 `MIGRATION_TRACK_NOT_ENABLED` 审计。只有调用方显式提供全量 `tracks + nodeTrackIds` 分配时，才允许输出 track-enabled 0.8；缺少任一节点即迁移失败。

显式 Track 分配迁移的失败码：

```text
MIGRATION_TRACK_ASSIGNMENT_INVALID
MIGRATION_TRACK_ASSIGNMENT_INCOMPLETE
MIGRATION_TRACK_ASSIGNMENT_UNKNOWN_NODE
MIGRATION_TRACK_ASSIGNMENT_UNKNOWN_TRACK
```

## 0.7 看板列与列内排序

顶层 `columns` 定义看板列：

```json
{
  "columns": [
    { "localId": "c1", "sortOrder": 10 },
    { "localId": "c2", "sortOrder": 20 }
  ],
  "nodes": [
    { "localId": "n1", "columnId": "c1", "sortOrder": 10 },
    { "localId": "n2", "columnId": "c1", "sortOrder": 20 },
    { "localId": "n3", "columnId": "c2", "sortOrder": 10 }
  ]
}
```

规则：

1. `columns[].localId` 必须存在且全局唯一。
2. `columns[].sortOrder` 必须是 `0` 到 `2147483647` 的整数，且全局唯一。
3. `nodes[].columnId` 必须引用存在的 `columns[].localId`。
4. 相同 `columnId` 的节点属于同一列。
5. 看板先按 `columns[].sortOrder` 排列，再按列内 `nodes[].sortOrder` 升序排列。
6. 看板列和列内排序都不代表画布坐标，不参与流转方向、时间解释或策略优先级。
7. 空看板列可以存在；编辑器删除非空列前要求先移动或删除卡片。

阻断错误码：

```text
COLUMN_SORT_ORDER_INVALID
COLUMN_SORT_ORDER_DUPLICATE
NODE_COLUMN_MISSING
```

0.1–0.6 导入时自动创建默认列：

```json
{ "localId": "c1", "sortOrder": 10 }
```

所有旧节点设置 `columnId: "c1"`，并给非阻断 `MIGRATION_DEFAULT_COLUMN_GENERATED` warning。

## 0.6 流程卡片排序

每个节点必须携带显式看板排序：

```json
{
  "localId": "n1",
  "sortOrder": 10
}
```

规则：

1. `sortOrder` 是 `0` 到 `2147483647` 的整数。
2. 0.6 中全局唯一；0.7 起同一 `columnId` 内唯一，按列内升序解析。
3. 不要求连续；推荐间隔 10，便于中间插卡。
4. 不代表画布坐标，不参与流转方向、时间解释或策略优先级。
5. 拖拽只改变 `layout.x / y`，不改变 `sortOrder`。
6. 0.1–0.5 导入时按旧 `nodes` 数组位置生成 `10、20、30…`，并给非阻断 `MIGRATION_SORT_ORDER_GENERATED` warning。

阻断错误码：

```text
NODE_SORT_ORDER_INVALID
NODE_SORT_ORDER_DUPLICATE
```

## 0.4 派生字段与迁移

0.4 把重复的动作事实收敛到流程卡片单一事实源：

```text
strategyActions[].time       <- nodes[].time
strategyActions[].subjectState <- nodes[].subject.state
processActions[].executor    <- nodes[].executor
processActions[].recipient   <- nodes[].subject.name
```

这些字段不再出现在 0.4 action JSON 中；展示层按 `nodeId` 实时派生。`strategyActions[].judge` 仍是动作局部字段，用于筛选该用哪条触达内容，不表示流程入口条件。`nodes[].displayName` 在 0.4 删除。

0.1 / 0.2 / 0.3 导入时统一升级为当前 canonical model：

- 旧动作派生字段与所属卡片不一致时，以卡片值准，丢弃动作值，并给非阻断 `MIGRATION_DERIVED_FIELD_DISCARDED` warning。
- 非空 `displayName` 会被丢弃，并给非阻断 `MIGRATION_DISPLAY_NAME_DISCARDED` warning。
- 当前版本导出再导入必须保持策略、taxonomy、看板列、节点、边、动作、看板排序和布局的结构化 round-trip；`validation` 总是重算，Mermaid 不参与 round-trip。

## 0.5 动作局部触达选择

每条 `strategyActions` 独立选择触达场景和触达方式：

```json
{
  "touchScenes": [
    { "code": "wecom" },
    { "code": "app" }
  ],
  "touchMethods": [
    { "code": "wecom_private_chat", "parentCode": "wecom" },
    { "code": "in_app_message", "parentCode": "app" }
  ]
}
```

规则：

1. 只保存 taxonomy `code` / `parentCode`，不保存 label 或自由文本。
2. 动作局部选择必须落在全局 `taxonomy.selections.touchScene / touchMethod` 已选范围内。
3. 每个动作至少一个场景和一个方式；每个已选场景至少有一个方式。
4. 方式的 `parentCode` 必须符合字典，且必须属于当前动作已选场景。
5. 场景和方式均不允许重复。
6. 新增标签仍走全局 `customTagProposals`；审批前不能成为动作可选值。

旧 `touchScene` / `touchMethod` 自由文本迁移时只做 trim 后的中文展示名精确匹配。无法匹配、包含多个值或父子不匹配时丢弃，并给非阻断 `MIGRATION_TOUCH_FIELD_DISCARDED` warning；迁移后为空由动作触达必填错误阻断导出。

## ID 规则

```text
^[A-Za-z][A-Za-z0-9_-]*$
```

0.2 / 0.3 / 0.4 / 0.5 / 0.6 / 0.7 / 0.8 要求节点、边、动作 ID 显式存在。设计器新增对象时自动生成；导入缺失 ID 会按结构校验暴露。0.1 兼容导入沿用旧规则，可在迁移时补齐内部 ID。

## 语义规则

1. `outcome` / `terminal` 节点不得有出边。
2. 进入 `outcome` / `terminal` 的边必须是 `outcome` 或 `handoff`。
3. 源节点执行人与目标节点执行人不同，边必须标记 `handoff`。
4. `classification` 是对象分类卡片：至少挂接一个 `processActions`，禁止挂接 `strategyActions`，必须有出边，且所有出边的 `subjectBehavior.status` 必须为 `no_requirement`。
5. 不允许自环；回收和重入必须通过显式节点表达。
6. 每个非孤立业务节点必须至少有一条边连接。
7. 策略动作和过程动作必须挂接节点，可选择挂接该节点的流出边。
8. 动作挂接流出边时，边源节点必须等于动作挂接节点。
9. `no_requirement` 表示无动作 / 无行为要求，不等同于“未发生”。
10. 缺失业务事实填“待确认”，不得填 0 或由系统编造；动作局部触达选择不得为空或超出全局 taxonomy 范围。
11. Workbench 当前 Schema 阶段不完整校验图语义；设计器仍执行上述图完整性硬门，避免把坏图交给后续加工。

## 0.1 / 0.2 迁移

0.1 / 0.2 / 0.3 / 0.4 / 0.5 / 0.6 / 0.7 导入后会升级为 0.8 canonical model：

```text
strategy.businessScene -> taxonomy.businessScene
strategy.strategyType  -> taxonomy.strategyType（仅能识别 taxonomy 二级值）
strategy.strategySubtype -> taxonomy.freeTextTags.strategySubtype
```

0.1 没有承载 lifecycle、客群、资产、风险、触达标签，也没有 metadata 2.0；迁移后必须补齐。迁移会给出 `SCHEMA_MIGRATED` warning，不做静默编造。

0.2 没有承载 `classification`。导入时不得根据 `displayName` 或动作描述把 `process` 猜测为 `classification`；业务人员显式修改卡片类型后，才会以当前版本语义导出。

## 与 Workbench 的边界

本设计器只输出 design JSON 与 metadata JSON，不写 case、registry、dist 或 workbook。导入 Workbench 必须走唯一 CLI：

```text
manage_case.py --json import-flow \
  --design strategy-flow-0.8.json \
  --metadata strategy-flow-registration-metadata-2.0.json \
  --actor ... \
  --request-id ...
```

稳定错误码见 `../README.md`。0.3 起的看板 ID 语义由 `STRATEGY_ID_INVALID` 与 `REGISTRATION_CASE_ID_INVALID` 阻断：字段存在时必须是看板返回值，不能是空值、占位文本或 `AG-...` 本地工作区 ID，且两个看板 ID 不能相同。

### Workbench 与 Page Builder 的 Track 边界

1. Workbench contract registry 必须显式注册 `strategy-flow-input/0.8`；no-track 与 track-enabled 使用同一导入、加工、预览和注册通道。
2. 0.8 no-track 与 0.7 走同等处理，不得因缺少 Track 阻断或给出质量警告。
3. track-enabled 的 `tracks` 与 `nodes[].trackId` 必须进入 canonical model 和 orchestration artifact；若现有 `strategy-orchestration/1.0` 不接受新增字段，必须先升级 artifact 契约（例如 `strategy-orchestration/1.1`）并保持旧 artifact 可读。
4. Page Builder 对无 Track artifact 继续使用既有全局列图 A 布局；对完整 Track artifact 使用阶段 × 业务主线 B 布局。渲染器不得猜测 Track，也不得使用 `layout.x / y` 推导泳道。
5. 已注册旧策略不自动改版、不自动重发布；需要泳道化时必须走新的策略定义更新流程，由业务确认 Track 后发布新版本。
