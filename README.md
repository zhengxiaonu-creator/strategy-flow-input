# EBSCN Strategy Flow Designer

全项目通用的策略编排设计器，用于把“责任人 + 对象状态 + 双行为条件”画成可校验的 `strategy-flow-input/0.1` JSON，并导出 Mermaid 沟通图。页面内置示例只演示结构，不承载任何具体业务口径。

视觉层采用 Fluent Light：Acrylic 命令栏和流程卡片、Mica 侧栏、轻量光照画布、统一焦点环与动效曲线。业务交互色使用 Fluent Blue，EBSCN 红色仅保留品牌标识。

## 从 Git 安装和启动

项目版本：

```text
1.0.0
```

一次性运行：

```bash
npx github:zhengxiaonu-creator/strategy-flow-input#v1.0.0 --open
```

全局安装：

```bash
npm install -g github:zhengxiaonu-creator/strategy-flow-input#v1.0.0
strategy-flow-input --open
```

安装到当前项目：

```bash
npm install --save-dev github:zhengxiaonu-creator/strategy-flow-input#v1.0.0
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
2. 添加入口、过程、结果、回收、重入、终态节点。
3. 从节点右侧红色锚点拖到目标节点，创建流转边。
4. 点击节点 / 边，在右侧编辑结构化属性。
5. 为节点挂接策略动作和过程动作。
6. 底部“校验”实时显示阻断错误和警告。
7. “导出 JSON”得到正式输入；“导出 Mermaid”得到业务沟通图。
8. 顶部“左栏 / 右栏 / 下栏”按钮可收起或展开对应面板；该布局偏好会保存在本地。
9. 初始逻辑画布为 4800 × 3200；画布支持 25% ~ 150% 缩放、1:1 重置，以及 Ctrl/⌘ + 滚轮以鼠标位置为中心缩放；缩放状态保存在本地。
10. 同源出边和同目标入边共用卡片锚点；拖拽流转规则标签可沿曲线法线方向调整平行线间距，布局偏移保存在 `edges[].layout.normalOffset`，范围为 -4800 ~ 4800。
11. 双击流程卡片或流转规则标签会自动展开右侧属性栏并聚焦首个可编辑字段。

## 业务名称与技术字段对照

| 页面名称 | 含义 | 导出字段 |
|---|---|---|
| 流程卡片 | 谁负责 + 对象类型 + 对象名称 + 对象状态 | `nodes` |
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

业务人员不需要填写或修改内部编号。导入 JSON 缺少编号时会自动补齐；显式非法编号不会被静默改写，而会进入校验错误。门户策略编号是注册系统回填的外部编号，首次提交可以留空，设计器不随机生成。

### 对象与对象状态

- 对象类型：流程卡片作用于哪一类对象，可选客群、场景、事件、活动。
- 对象名称：该类型下的具体业务对象，例如目标客群名称、触发场景名称、事件名称、活动名称。
- 对象状态：对象进入这张卡片时的业务状态，例如未触达、已触达、已转化；它不是对象类别，也不是执行人的处理进度。

## 契约

- Schema：`schema/strategy-flow-input.schema.json`
- 示例：`examples/customer-strategy.json`
- 版本：`strategy-flow-input/0.1`

核心结构：

```text
strategy           策略基础信息
nodes              编排节点：责任执行人 + 对象类型 / 名称 / 对象状态 + 时间阶段
edges              流转边：执行人行为 + 对象行为
strategyActions    策略动作气泡，挂接节点 / 流出边
processActions     过程管理动作气泡，挂接节点 / 流出边
validation         导出时计算；导入时忽略并重算
```

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
no_requirement   无行为要求
```

对象行为状态：

```text
happened         已发生
not_happened     未发生
no_requirement   无行为要求
```

## 校验错误码

### 阻断错误

| Code | 含义 |
|---|---|
| `SCHEMA_VERSION_UNSUPPORTED` | 契约版本不支持 |
| `STRATEGY_FIELD_REQUIRED` | 策略基础字段缺失 |
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

### 警告

| Code | 含义 |
|---|---|
| `EDGE_NOT_CONFIRMED` | 流转边尚未业务确认 |
| `STRATEGY_ACTION_MISSING` | 编排没有策略动作 |
| `PROCESS_ACTION_MISSING` | 编排没有过程动作 |
| `PROCESS_ACTION_UNMOUNTED` | 过程节点未挂接过程动作 |

`errors` 清零时导出状态为 `ready_to_submit`；否则为 `draft`。

## 导入规则

1. 仅接受 `strategy-flow-input/0.1`。
2. `validation` 会被忽略并重新计算。
3. 未知字段会被丢弃。
4. `layout` 缺失时自动补默认坐标。
5. 导入后必须处理校验错误，再作为正式输入使用。

## 下一步

1. 增加 JSON Schema 独立 validator。
2. 增加 Mermaid 草稿导入（仅生成待确认草稿）。
3. 增加 `JSON -> 策略提交表 v1.2` 转换器。
4. 通过 `manage_case.py import-flow` 接入 Agent 工作台。
