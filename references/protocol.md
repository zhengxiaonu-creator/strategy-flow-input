# strategy-flow-input/0.2 Protocol

## 版本策略

- 当前导出版本：`strategy-flow-input/0.2`
- 兼容导入版本：`strategy-flow-input/0.1`
- 拒绝版本：未知版本、`strategy-flow-input/1.0`、格式非法版本
- 版本格式：`strategy-flow-input/<major>.<minor>`

解析器使用显式版本注册表，不把未来版本自动当作已知契约。后续版本必须先注册 adapter 和迁移规则。

## 顶层 envelope

```json
{
  "schemaVersion": "strategy-flow-input/0.2",
  "strategy": {},
  "taxonomy": {},
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
strategyId
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

`strategy-flow-input/0.2` 必须搭配：

```text
strategy-flow-registration-metadata/2.0
```

metadata 不承载任何 taxonomy 标签。设计器将两份文件分开导出；`registrationMetadata` 只存在于内部编辑状态和 companion 输出，不会混入 design JSON。

## ID 规则

```text
^[A-Za-z][A-Za-z0-9_-]*$
```

0.2 要求节点、边、动作 ID 显式存在。设计器新增对象时自动生成；导入缺失 ID 会按结构校验暴露。0.1 兼容导入沿用旧规则，可在迁移时补齐内部 ID。

## 语义规则

1. `outcome` / `terminal` 节点不得有出边。
2. 进入 `outcome` / `terminal` 的边必须是 `outcome` 或 `handoff`。
3. 源节点执行人与目标节点执行人不同，边必须标记 `handoff`。
4. 不允许自环；回收和重入必须通过显式节点表达。
5. 每个非孤立业务节点必须至少有一条边连接。
6. 策略动作和过程动作必须挂接节点，可选择挂接该节点的流出边。
7. 动作挂接流出边时，边源节点必须等于动作挂接节点。
8. `no_requirement` 表示无动作 / 无行为要求，不等同于“未发生”。
9. 缺失业务事实填“待确认”，不得填 0 或由系统编造。
10. Workbench 当前 Schema 阶段不完整校验图语义；设计器仍执行上述图完整性硬门，避免把坏图交给后续加工。

## 0.1 迁移

0.1 导入后会升级为 0.2 canonical model：

```text
strategy.businessScene -> taxonomy.businessScene
strategy.strategyType  -> taxonomy.strategyType（仅能识别 taxonomy 二级值）
strategy.strategySubtype -> taxonomy.freeTextTags.strategySubtype
```

0.1 没有承载 lifecycle、客群、资产、风险、触达标签，也没有 metadata 2.0；迁移后必须补齐。迁移会给出 `SCHEMA_MIGRATED` warning，不做静默编造。

## 与 Workbench 的边界

本设计器只输出 design JSON 与 metadata JSON，不写 case、registry、dist 或 workbook。导入 Workbench 必须走唯一 CLI：

```text
manage_case.py --json import-flow \
  --case WB-... \
  --design strategy-flow-0.2.json \
  --metadata strategy-flow-registration-metadata-2.0.json \
  --actor ... \
  --request-id ...
```

稳定错误码见 `../README.md`。
