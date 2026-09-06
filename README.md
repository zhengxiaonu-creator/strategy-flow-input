# EBSCN Strategy Flow Designer

全项目通用的策略编排设计器，用于把“责任人 + 对象状态 + 双行为条件”画成可校验的 `strategy-flow-input/0.5` JSON，并导出 Mermaid 沟通图。0.5 将客户触达内容的触达场景 / 方式改为动作局部 taxonomy 引用多选；taxonomy 仍由独立契约承载，并配套导出 `strategy-flow-registration-metadata/2.0`。页面内置示例只演示结构，不承载额外业务口径。

视觉层采用 Fluent Light：Acrylic 命令栏和流程卡片、Mica 侧栏、轻量光照画布、统一焦点环与动效曲线。业务交互色使用 Fluent Blue，EBSCN 红色仅保留品牌标识。

## 从 Git 安装和启动

项目版本：

```text
1.6.0
```

一次性运行：

```bash
npx github:zhengxiaonu-creator/strategy-flow-input#v1.6.0 --open
```

全局安装：

```bash
npm install -g github:zhengxiaonu-creator/strategy-flow-input#v1.6.0
strategy-flow-input --open
```

安装到当前项目：

```bash
npm install --save-dev github:zhengxiaonu-creator/strategy-flow-input#v1.6.0
npx strategy-flow-input --open
```

直接克隆运行：

```bash
git clone https://github.com/zhengxiaonu-creator/strategy-flow-input.git
cd strategy-flow-input
npm start
```

CLI 选项：

```text
--host <host>   监听地址，默认 127.0.0.1
--port <port>   监听端口，默认 4173
--open          启动后打开默认浏览器
--help          查看帮助
```

`package.json` 中 `private: true` 只用于防止误发布到 npm registry，不影响从 GitHub 安装。

## 当前边界

- 本地静态页面，无后端、无登录、不上传数据。
- 只写浏览器 localStorage 草稿，不写 `strategy-workbench` case、不写 registry、不生成 xlsx。
- 修改会自动保存到本机浏览器，也提供「保存草稿」按钮做显式确认；正式交付仍以导出 JSON 为准。
- JSON 是事实源；Mermaid 是投影，不承诺无损 round-trip。
- 拖拽坐标只存于 `layout`，不参与业务语义。

## 打开方式

```bash
open ebscn-strategy-flow-designer/index.html
```

或在 IDE / 浏览器中直接打开：

```text
ebscn-strategy-flow-designer/index.html
```

## 基本操作

1. 左侧选择策略范式。
2. 添加入口、对象分类、过程、结果、回收、重入、终态节点。
3. 从节点右侧红色锚点拖到目标节点，创建流转边。
4. 点击节点 / 边，在右侧编辑结构化属性。
5. 为节点挂接策略动作和过程动作。
6. 底部“校验”实时显示阻断错误和警告。
7. “导出 JSON”得到正式输入；“导出 Mermaid”得到业务沟通图。
8. 顶部“新增卡片和业务 / 卡片信息 / 代码和校验”按钮可收起或展开对应面板；该布局偏好会保存在本地。
9. 初始逻辑画布为 4800 × 3200；画布支持 25% ~ 150% 缩放、1:1 重置，以及 Ctrl/⌘ + 滚轮以鼠标位置为中心缩放；缩放状态保存在本地。
10. 同源出边和同目标入边共用卡片锚点；拖拽流转规则标签可沿曲线法线方向调整平行线间距，布局偏移保存在 `edges[].layout.normalOffset`，范围为 -4800 ~ 4800。
11. 双击流程卡片、流转规则标签或卡片内的动作气泡会自动展开右侧属性栏并聚焦首个可编辑字段。

### 编辑器信息架构

- 顶栏常驻“导入（下拉含 Design / 元数据）/ 本策略注册信息 / Agent 草稿 / 导出”；撤销、清空、自动布局等低频操作在“更多”菜单。
- 右侧属性栏专用于高频“当前对象”编辑：流程卡片、流转规则、客户触达内容和执行跟进动作。
- “基础信息 / 策略标签 / 元数据”属于低频全局配置，统一收进顶部“本策略注册信息”抽屉。
- 策略标签按“客群识别 / 业务场景与策略类型 / 触达配置 / 自定义标签提案”分组。
- 底部校验提供“提交准备度”，并按契约、基础信息、策略标签、元数据、流程图分组。
- 校验项可点击“定位”，自动跳到对应 Tab、分组或流程对象。
- 代码区分 Design 0.5、Metadata 2.0、Mermaid 三个子 Tab，避免三列互相挤压。
- “导出”打开抽屉，同时展示双文件状态、复制 / 下载入口和 Workbench CLI 模板。
- 新增卡片和业务、卡片信息、代码和校验面板支持拖拽和键盘拉伸，布局尺寸会保存在本机。
- 校验面板提供进度、域级事实摘要、结果筛选、JSON Path、来源文件与修复建议。
- 中英 UI 使用统一 Fluent 字体栈，代码与 ID 使用统一 mono 字体栈。

## 业务名称与技术字段对照

| 页面名称 | 含义 | 导出字段 |
|---|---|---|
| 流程卡片 | 谁负责 + 对象类型 + 对象名称 + 对象状态 | `nodes` |
| 对象分类卡片 | 对客群、场景、事件或活动做分类、分层或重新分层 | `nodes[].nodeType = classification` |
| 流转规则 | 执行人做了什么，对象发生了什么，然后进入哪张卡片 | `edges` |
| 客户触达内容 | 对客户说什么、用什么权益、看什么业务指标 | `strategyActions` |
| 执行跟进动作 | 谁执行、执行什么、看什么过程指标 | `processActions` |

内部编号自动生成：

```text
流程卡片：n1、n2、n3
流转规则：e1、e2、e3
客户触达内容：sa1、sa2
执行跟进动作：pa1、pa2
```

业务人员不需要填写或修改内部编号。0.1 导入缺少内部编号时会按兼容规则补齐；0.2 / 0.3 / 0.4 / 0.5 正式契约要求显式 ID。

### 策略编号与本地工作区

- `registrationCaseId` 是看板在提交注册时生成的 CaseID。0.4 / 0.5 新建策略导出时省略该字段；看板返回后携带，用于继续对应提交。
- `strategyId` 是看板在正式注册后生成的策略编号。0.4 / 0.5 新建策略导出时省略该字段；看板返回后携带，用于更新正式策略。
- Agent 的 `caseId` 是本地工作区 ID（`AG-...`），仅用于隔离材料、草稿和审计并支持恢复；由 `parse-sources` 自动生成，业务人员不需要填写。
- `AG-...` 不会进入 Design JSON、Metadata JSON 或 Workbench CLI，也不与看板 CaseID / 策略 ID 建立映射。
- 看板导入以 `requestId` 幂等：提交注册重放返回同一 CaseID，正式策略更新不重新生成 `strategyId`。

### 对象与对象状态

- 对象类型：流程卡片作用于哪一类对象，可选客群、场景、事件、活动。
- 对象名称：该类型下的具体业务对象，例如目标客群名称、触发场景名称、事件名称、活动名称。
- 对象状态：对象进入这张卡片时的业务状态，例如未触达、已触达、已转化；它不是对象类别，也不是执行人的处理进度。

流转规则里的“无动作”勾选项作用于执行人和对象两侧行为；导出时均固定为 `no_requirement + 无动作`。

### 对象分类卡片

“对象分类”是 0.3 引入、0.4 / 0.5 继续使用的 `classification` 卡片类型，用于对客群、场景、事件或活动做分类、分层或重新分层。分类卡片挂接 `processActions`，禁止挂接 `strategyActions`；所有出边的对象行为使用 `no_requirement`。完整约定见 [`references/object-classification-pattern.md`](references/object-classification-pattern.md)。

## 契约

- Design Schema：`schema/strategy-flow-input.schema.json`（`strategy-flow-input/0.5`）
- Metadata Schema：`schema/strategy-flow-registration-metadata-2.0.schema.json`
- Taxonomy Schema：`schema/strategy-taxonomy-2026-09.schema.json`
- Taxonomy 字典：`schema/strategy-taxonomy-2026-09.json`
- 0.2 示例：`examples/contracts/strategy-flow-input-0.2.json`
- 0.3 历史示例：`examples/contracts/strategy-flow-input-0.3.json`
- 0.4 历史示例：`examples/contracts/strategy-flow-input-0.4.json`
- 0.5 对象分类示例：`examples/contracts/strategy-flow-input-0.5.json`
- Metadata 示例：`examples/contracts/strategy-flow-registration-metadata-2.0.json`
- 0.1 历史 Schema：`schema/strategy-flow-input-0.1.schema.json`
- 0.2 历史 Schema：`schema/strategy-flow-input-0.2.schema.json`
- 0.3 历史 Schema：`contracts/strategy-flow-input-0.3.schema.json`
- 0.4 历史 Schema：`contracts/strategy-flow-input-0.4.schema.json`
- 当前导出版本：`strategy-flow-input/0.5`

核心结构：

```text
strategy           策略基础信息，不承载业务场景 / 策略类型 / 策略子类
taxonomy           策略标签唯一事实源
nodes              编排节点：责任执行人 + 对象类型 / 名称 / 对象状态 + 时间阶段
edges              流转边：执行人行为 + 对象行为
strategyActions    策略动作气泡，挂接节点 / 流出边
processActions     过程管理动作气泡，挂接节点 / 流出边
validation         导出时计算；导入时忽略并重算
```

### 0.4 动作继承

- `strategyActions` 的时间继承 `nodes[].time`，对象状态继承 `nodes[].subject.state`。
- `processActions` 的执行人 / 角色继承 `nodes[].executor`，接收对象继承 `nodes[].subject.name`。
- 这些继承值不写入 action JSON，页面按 `nodeId` 实时派生。
- `strategyActions[].judge` 仍是动作局部的进入条件，用于筛选触达内容，不表示流程入口。
- 0.4 删除 `nodes[].displayName`。

### 0.5 动作局部触达选择

- `strategyActions[].touchScenes` 是动作局部多选，存储 `{code}`。
- `strategyActions[].touchMethods` 是动作局部多选，存储 `{code, parentCode}`。
- 只能引用 `strategy-taxonomy/2026-09` 中已审批的 code，不保存 label 或自由文本。
- 动作选择必须落在全局策略标签已选范围内；每个已选触达场景至少选择一个触达方式。
- 页面使用自定义多选下拉框；取消场景会级联移除该场景下的方式，一次交互只生成一条撤销记录。
- 新增触达场景 / 方式仍走全局 `customTagProposals`，审批前不会出现在动作可选值中。

### Taxonomy 规则

- 契约版本：`strategy-taxonomy/2026-09`。
- `code` 是唯一持久化稳定值；`label` 只用于展示，提交时可不带。
- `lifecycle`、`customerClass`、`assetRange`、`riskLevel`、`touchScene`、`touchMethod` 为多选。
- `businessScene` 为单选。
- `strategyType` 是真正的二级策略类型，多选，不再等于业务场景。
- `assetRange` 挂接 `customerClass`；每个已选客群至少有一个匹配资产区间。
- `strategyType` 挂接 `businessScene`；每个已选业务场景至少有一个策略类型。
- `touchMethod` 挂接 `touchScene`；每个已选触达场景至少有一个触达方式。
- `strategySubtype` 是 `freeTextTags` 中的自由文本，不进入结构化标签字典。
- `businessScene`、`strategyType`、`touchScene`、`touchMethod` 允许自定义提案；调用方只提供 `proposalId + label + reason + parentRef`，code 由 Workbench 审批后生成。未审批前会阻断后续 `templates` / `process`。

### Metadata companion

`strategy-flow-input/0.5` 需要单独导出：

```text
strategy-flow-registration-metadata/2.0
```

该文件只承载 `businessUnit`、`submitDate`、`coreHook`、`effectiveFrom`、`baselineVersion`、`triggerScenes`。标签字段禁止写入 metadata；标签唯一事实源在 design JSON 的 `taxonomy`。

### Agent 工作台（M0–M4）

Agent 通道协议见 `references/agent-protocol.md`，契约只新增、不改动上述输出 Schema。当前已实现本地解析（docx/xlsx/pptx/csv/md，零依赖）、离线 stub 草稿生成、页面草稿审查、可选一次性 token 审计与审计状态机：

- Response envelope：`contracts/strategy-agent-response-0.1.schema.json`
- Source manifest：`contracts/strategy-agent-source-manifest-0.1.schema.json`
- Evidence corpus：`contracts/strategy-agent-evidence-corpus-0.1.schema.json`
- Strategy draft：`contracts/strategy-agent-strategy-draft-0.1.schema.json`
- 错误码注册表：`contracts/strategy-agent-errors-0.1.json`
- 示例：`examples/contracts/agent/`

#### Agent 接入 skill

仓库内置可复制的接入指引：[`skills/strategy-flow-agent/SKILL.md`](skills/strategy-flow-agent/SKILL.md)。该 skill 面向 Hermes、openclaw、Codex 等 Agent，覆盖材料拆解、证据引用、业务人员提问、状态恢复、编辑器交接和可选审计路径。

- 在本仓库内运行时，可直接让 Agent 读取上述 skill 路径。
- 接入外部 Agent 时，复制整个 `skills/strategy-flow-agent/` 目录到目标 Agent 约定的 skill 目录。
- 该 skill 只是操作指引，不改变 `strategy-agent/0.1` 命令协议，也不改变 Design / Metadata 输出契约。

硬规则：Agent 只产带证据引用的草稿；`missing` 字段保持“待确认”，不得编造。默认轻量 human-in-loop：`missing` / `conflict` / `openQuestions` 只作为待办，草稿可直接导入编辑器，人工修正后在导出边界校验 Design 0.2 / 0.3 / 0.4 / 0.5 与 Metadata 2.0。新草稿默认使用 Design 0.5。`request-approval` / `confirm-draft` 是可选审计路径，仍需要一次性 token。

```bash
# CLI 入口（状态默认落在 ./strategy-agent-store）
npx strategy-agent parse-sources --file 需求.docx --file 流程.xlsx --request-id req-parse-1
npx strategy-agent generate-draft --case <local-workspace-id> --request-id req-draft-1

# 可选审计路径；默认路径是导入编辑器、人工修正后导出双 JSON
npx strategy-agent resolve-draft --case <local-workspace-id> --draft <sd-id> --resolved 'metadata:/submitDate=2026-08-30'
npx strategy-agent request-approval --case <local-workspace-id> --draft <sd-id> --approver Terry
npx strategy-agent confirm-draft --case <local-workspace-id> --draft <sd-id> --token at-... --confirmed-by Terry
```

页面顶栏「Agent 草稿」导入 draft JSON 与 corpus JSON 后逐项核对证据；证据待办不阻断编辑器导入，人工修正后由导出边界保证双 JSON 契约。Chrome E2E：`NODE_PATH=<playwright node_modules> CHROME_PATH=<chrome> npm run test:e2e`。

## 时间与状态

时间：

```text
自由文本表达式
```

时间不绑定某个策略范式或生命周期，可填写相对时间、绝对日期或事件偏移。时间排序和解释由后续范式适配器处理，设计器只负责保留业务原文。

执行人动作状态：

```text
executed         已执行
not_executed     未执行
no_requirement   无动作要求
```

对象行为状态：

```text
happened         已发生
not_happened     未发生
no_requirement   无行为要求
```

## 画布操作

- `Shift + 空白拖拽`：框选流程卡片和流转规则。
- `Ctrl/⌘ + 点击`：追加选择；`Ctrl/⌘ + A` 全选；`Esc` 清空选择。
- 多选后拖动任一已选卡片：所有已选卡片保持相对布局整体移动；边与动作气泡跟随，整体最小 X/Y 不小于 0，一次拖动生成一条撤销记录。
- `Ctrl/⌘ + C / V`：批量复制、粘贴；复制卡片会同步复制挂接动作。
- `Ctrl/⌘ + Z / Shift + Z`：撤销、重做。
- 同一对卡片存在双向规则时，画布显示双向引导标识；两条规则仍独立保存。

## 校验错误码

### 阻断错误

| Code | 含义 |
|---|---|
| `SCHEMA_VERSION_REQUIRED` | 导入 JSON 缺少契约版本 |
| `SCHEMA_VERSION_INVALID` | 契约版本格式或命名空间非法 |
| `SCHEMA_VERSION_UNSUPPORTED` | 契约版本不支持 |
| `SCHEMA_FIELD_REQUIRED` | 正式契约必填结构字段缺失 |
| `SCHEMA_UNKNOWN_FIELD` | 契约禁止的未知字段 |
| `STRATEGY_FIELD_REQUIRED` | 策略基础字段缺失 |
| `STRATEGY_ID_INVALID` | 看板策略编号使用空值、占位文本或本地工作区 ID |
| `REGISTRATION_CASE_ID_INVALID` | 提交注册 CaseID 使用空值、占位文本、本地工作区 ID，或与策略编号相同 |
| `TAXONOMY_VERSION_UNSUPPORTED` | taxonomy 契约版本不支持 |
| `TAXONOMY_FIELD_REQUIRED` | taxonomy 必填字段缺失 |
| `TAG_FIELD_REQUIRED` | 必填标签缺失 |
| `TAG_FIELD_DUPLICATE` | taxonomy 字码重复 |
| `TAG_CODE_INVALID` / `TAG_CODE_INACTIVE` / `TAG_CODE_DUPLICATE` | 标签 code 非法、停用或重复 |
| `TAG_CARDINALITY_INVALID` | 标签单选 / 多选形态错误 |
| `TAG_PARENT_REQUIRED` / `TAG_PARENT_MISMATCH` | 子标签缺少父标签或父子不匹配 |
| `TAG_CHILD_REQUIRED` | 每个已选父标签缺少子标签 |
| `TAG_EXCLUSIVE_INVALID` | 互斥标签同选 |
| `TAG_LABEL_MISMATCH` | 标签展示名与字典不一致 |
| `TAG_FREE_TEXT_INVALID` | 自由文本标签使用占位值 |
| `TAG_PROPOSAL_FIELD_REQUIRED` / `TAG_PROPOSAL_FIELD_INVALID` | 自定义标签提案结构非法 |
| `TAG_PROPOSAL_DUPLICATE` / `TAG_PROPOSAL_PARENT_INVALID` | 自定义标签提案重复或父引用无效 |
| `METADATA_VERSION_UNSUPPORTED` | 注册元数据契约版本不支持 |
| `METADATA_FIELD_REQUIRED` / `METADATA_DATE_INVALID` | 注册元数据缺失或日期格式错误 |
| `METADATA_BASELINE_REQUIRED` | candidate 缺少基准版本 |
| `METADATA_TRIGGER_SCENE_REQUIRED` | 场景策略缺少触发场景 |
| `NODE_ID_INVALID` / `NODE_ID_DUPLICATE` | 节点 ID非法或重复 |
| `EDGE_ID_INVALID` / `EDGE_ID_DUPLICATE` | 边 ID 非法或重复 |
| `ACTION_ID_INVALID` / `ACTION_ID_DUPLICATE` | 动作 ID 非法或重复 |
| `TIME_REQUIRED` | 节点时间缺失 |
| `EXECUTOR_REQUIRED` | 责任执行人缺失 |
| `SUBJECT_STATE_REQUIRED` | 对象状态缺失 |
| `SUBJECT_NAME_REQUIRED` | 对象名称缺失 |
| `LAYOUT_INVALID` | 画布坐标无效 |
| `EDGE_ENDPOINT_MISSING` | 边端点不存在 |
| `EDGE_SELF_LOOP` | 不允许自环 |
| `OUTCOME_EDGE_TYPE_INVALID` | 进入结果 / 终态的边类型不合法 |
| `TERMINAL_OUTGOING_EDGE` | 结果 / 终态存在出边 |
| `EXECUTOR_HANDOFF_MISSING` | 执行人变化但未标记 handoff |
| `NODE_ORPHAN` | 正式编排存在孤立节点 |
| `ACTOR_TIME_REQUIRED` / `ACTOR_ACTION_REQUIRED` / `ACTOR_STATUS_REQUIRED` | 执行人行为缺失 |
| `SUBJECT_TIME_REQUIRED` / `SUBJECT_ACTION_REQUIRED` / `SUBJECT_STATUS_REQUIRED` | 对象行为缺失 |
| `STRATEGY_ACTION_NODE_MISSING` / `STRATEGY_ACTION_EDGE_MISSING` / `STRATEGY_ACTION_EDGE_SOURCE_MISMATCH` | 策略动作挂接无效 |
| `PROCESS_ACTION_NODE_MISSING` / `PROCESS_ACTION_EDGE_MISSING` / `PROCESS_ACTION_EDGE_SOURCE_MISMATCH` | 过程动作挂接无效 |
| `ACTION_FIELD_REQUIRED` | 动作必填字段缺失 |
| `ACTION_TOUCH_SCENE_REQUIRED` / `ACTION_TOUCH_METHOD_REQUIRED` | 客户触达内容缺少触达场景或触达方式 |
| `ACTION_TOUCH_CODE_INVALID` | 动作局部触达选择引用未知 taxonomy code |
| `ACTION_TOUCH_PARENT_MISMATCH` | 触达方式未挂在字典要求且当前动作已选的场景下 |
| `ACTION_TOUCH_TAXONOMY_SCOPE_MISMATCH` | 动作局部触达选择超出全局策略标签范围 |
| `ACTION_TOUCH_CHILD_REQUIRED` | 动作中某个已选触达场景缺少触达方式 |
| `ACTION_TOUCH_DUPLICATE` | 动作局部触达场景或方式重复 |
| `CLASSIFICATION_PROCESS_ACTION_REQUIRED` | 对象分类卡片缺少执行跟进动作 |
| `CLASSIFICATION_STRATEGY_ACTION_FORBIDDEN` | 对象分类卡片挂接了客户触达内容 |
| `CLASSIFICATION_OUTGOING_EDGE_REQUIRED` | 对象分类卡片缺少出边 |
| `CLASSIFICATION_SUBJECT_BEHAVIOR_INVALID` | 对象分类卡片出边要求对象发生行为 |

### 警告

| Code | 含义 |
|---|---|
| `EDGE_NOT_CONFIRMED` | 流转边尚未业务确认 |
| `SCHEMA_MIGRATED` | 0.1 / 0.2 / 0.3 / 0.4 已迁移到 0.5，旧契约字段按当前规则归一 |
| `MIGRATION_DERIVED_FIELD_DISCARDED` | 旧动作派生字段与所属卡片不一致，0.4 以卡片值为准并丢弃动作值 |
| `MIGRATION_DISPLAY_NAME_DISCARDED` | 0.4 删除卡片展示名，导入旧版本时丢弃非空值 |
| `MIGRATION_TOUCH_FIELD_DISCARDED` | 旧触达自由文本无法按 taxonomy 展示名精确匹配，迁移时丢弃 |
| `CUSTOM_TAG_APPROVAL_REQUIRED` | 自定义标签提案待审批 |
| `STRATEGY_ACTION_MISSING` | 编排没有策略动作 |
| `PROCESS_ACTION_MISSING` | 编排没有过程动作 |
| `PROCESS_ACTION_UNMOUNTED` | 过程节点未挂接过程动作 |

`errors` 清零时导出状态为 `ready_to_submit`；否则为 `draft`。

## 导入规则

1. 原生接受 `strategy-flow-input/0.5`。
2. 兼容导入 `strategy-flow-input/0.1` / `0.2` / `0.3` / `0.4` 并导出 `0.5`；0.1 未承载的 taxonomy 与 metadata 字段必须补齐，0.2 的 `process` 不会被自动猜成 `classification`，0.3 起的重复动作派生字段按卡片值归一，旧触达自由文本只按 taxonomy 展示名精确匹配迁移。
3. `validation` 会被忽略并重新计算。
4. 0.5 未知字段拒绝；0.1 / 0.2 / 0.3 / 0.4 兼容导入仍按各自 normalizer 处理。
5. 注册元数据通过“导入元数据”单独加载。
6. 导入后必须处理校验错误，再作为正式输入使用。

## 下一步

1. 为 0.5 增加独立 JSON Schema validator 执行器。
2. 增加 Mermaid 草稿导入（仅生成待确认草稿）。
3. 增加 `JSON -> 策略提交表 v1.2` 转换器。
4. 通过 `manage_case.py import-flow` 接入 Agent 工作台。
