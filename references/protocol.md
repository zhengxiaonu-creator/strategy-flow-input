# strategy-flow-input/0.1 Protocol

## 目标

定义跨策略范式的策略编排输入，统一表达：

```text
节点 = 责任执行人 + 对象类型 / 对象名称 / 对象状态 + 时间阶段
边 = 责任执行人行为 + 对象行为条件
动作 = 策略动作 / 过程动作，通过稳定 localId 挂接
```

## 顶层 envelope

```json
{
  "schemaVersion": "strategy-flow-input/0.1",
  "strategy": {},
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

## ID 规则

```text
^[A-Za-z][A-Za-z0-9_-]*$
```

- 设计器自动生成节点 `n1`、`n2`。
- 设计器自动生成边 `e1`、`e2`。
- 设计器自动生成策略动作 `sa1`。
- 设计器自动生成过程动作 `pa1`。
- `outgoingEdgeId` 允许空字符串，表示动作只挂节点，不绑定流出边。
- 外部导入缺少内部 ID 时由设计器补齐；显式非法 ID 保留给校验暴露，不做静默修复。

## 语义规则

1. `outcome` / `terminal` 节点不得有出边。
2. 进入 `outcome` / `terminal` 的边必须是 `outcome` 或 `handoff`。
3. 源节点执行人与目标节点执行人不同，边必须标记 `handoff`。
4. 不允许自环；回收和重入必须通过显式节点表达。
5. 每个非孤立业务节点必须至少有一条边连接。
6. 策略动作必须挂接节点，可选择挂接该节点的流出边。
7. 过程动作必须挂接节点，可选择挂接该节点的流出边。
8. 动作挂接流出边时，边源节点必须等于动作挂接节点。
9. `no_requirement` 表示无行为要求，不等同于“未发生”。
10. 缺失业务事实填“待确认”，不得填 0 或由系统编造。

## 稳定错误码

错误码以大写蛇形命名，并携带 `message` 与 `path`。完整清单见 `../README.md`。

## 与后续工单的边界

本版本只输出文件，不操作工单。后续如接入 Agent 工作台，必须通过唯一 CLI 入口，例如：

```text
manage_case.py import-flow --case WB-... --file strategy-flow.json
```

在设计器内不得直接写 case artifact、registry 或 dist。
