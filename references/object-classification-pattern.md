# 对象分类卡片模式（strategy-flow-input/0.5）

## 定位

`classification` 是 0.3 引入、0.4 / 0.5 继续使用的流程卡片类型，中文展示名为“对象分类”。它表示执行人对当前对象做分类、分层或重新分层；对象本身没有行为要求，也不因此被触达。

对象类型沿用现有 `subject.type`：

```text
customer / scene / event / activity
```

卡片语义由“卡片类型 + 对象类型”共同决定，例如“客群对象分类”“场景对象分类”。

## 图形与字段约定

`classification` 是通用流程阶段，可以放在流程任意位置，不强制只能放在入口前。常见前置用法是：

```text
对象分类卡片（classification）
  -> 统一策略入口
  -> 后续触达 / 跟进
  -> 结果
```

字段约定：

| 位置 | 约定 |
| --- | --- |
| `nodes[].nodeType` | 使用 `classification`。 |
| `nodes[].time` | 填分类执行的时间 / 阶段。 |
| `nodes[].executor` | 填负责分类规则计算和产出的角色 / 人。 |
| `nodes[].subject.type` | 选择被分类的客群、场景、事件或活动。 |
| `nodes[].subject.name` | 填具体对象名称，不预置任何业务对象。 |
| `nodes[].subject.state` | 填“待分类”“已完成分类”“已分层”等对象状态。 |

分类依据、动作、结果和指标继续复用 `processActions`。0.4 中执行人继承 `nodes[].executor`，接收对象继承 `nodes[].subject.name`，不在动作 JSON 中重复存储：

| `processActions` 字段 | 建议口径 |
| --- | --- |
| `scene` | 对象分类执行场景。 |
| `condition` | 对象内存在可区分的行为特征或状态差异。 |
| `action` | 按特征计算并标记分类 / 分层结果。 |
| `result` | 产出互斥分类清单和后续入口分配口径。 |
| `hook` | 分类维度、阈值、优先级和兜底规则。 |
| `metrics` | 使用过程指标，例如分类覆盖率、分类重叠率、未分类率、规则命中率。 |

## 硬校验

- 每张 `classification` 卡片至少挂接一个 `processActions`。
- `classification` 禁止挂接 `strategyActions`。
- `classification` 必须有出边承接分类后的处理。
- 所有出边的 `subjectBehavior.status` 必须为 `no_requirement`；设计器导出为 `无动作`。
- 执行人变化仍必须使用 `handoff`。

对应错误码：

```text
CLASSIFICATION_PROCESS_ACTION_REQUIRED
CLASSIFICATION_STRATEGY_ACTION_FORBIDDEN
CLASSIFICATION_OUTGOING_EDGE_REQUIRED
CLASSIFICATION_SUBJECT_BEHAVIOR_INVALID
```

## 0.2 兼容

0.2 没有 `classification`。如需在 0.2 中表达类似业务，只能用 `process + processActions + no_requirement` 的业务模式，并在 `displayName` 中说明；该写法不会被机器识别为对象分类，也不会获得上述硬校验。

0.2 / 0.3 / 0.4 导入 0.5 编辑器后仍保持 `process`。业务人员显式把卡片类型改为“对象分类”后，导出才使用 `classification`。

通用完整示例见 [`../examples/contracts/strategy-flow-input-0.5.json`](../examples/contracts/strategy-flow-input-0.5.json)。
