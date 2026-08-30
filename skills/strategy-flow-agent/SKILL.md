---
name: strategy-flow-agent
description: 使用 strategy-flow-input 工作台解析非结构化策略材料、生成证据支撑的策略流程草稿，并引导业务人员确认和导出双 JSON；适用于 Hermes、openclaw、Codex 等 Agent 接入场景。
---

# strategy-flow-input Agent 接入

把业务人员提供的非结构化材料变成可审查、可编辑、可导出的策略流程，而不是让 Agent 直接产一份看似完整的业务结论。

## 目标

1. 用 `strategy-agent` 把本地材料解析成 evidence corpus。
2. 生成带 provenance / openQuestions 的策略草稿。
3. 把证据充分、证据冲突、信息缺失分清楚，交给业务人员裁决。
4. 协助人工在编辑器中完成 Design 0.2 与 Metadata 2.0，而不是绕过工作台提交。

## 硬规则

- 只通过 `strategy-agent` CLI 调用能力；不要直接编辑 `strategy-agent-store`、registry、dist 或其他内部 artifact。
- JSON 是事实源；Mermaid 只是沟通投影，不做 round-trip 事实源。
- 无证据不得冒充事实：`supported` / `conflict` 必须引用 corpus 中存在的 `evidenceId`；无证据字段保持 `missing` / “待确认”。
- 不要为让导出通过而编造 strategyId、taxonomy code、对象状态、时间、指标或业务口径。
- 会话记忆不是状态源；恢复执行只依赖 `caseId`、status、nextAction、持久化 draft/corpus 和审计记录。
- 审批只能来自显式动作和一次性 token，不得从自由对话推断授权。
- 材料保持在用户指定的本地工作流中处理；未经用户明确授权，不要把材料内容发送到额外外部服务。

## 工作流

### 1. 建立执行上下文

- 确认仓库 / CLI 可用。若不可用，先向用户询问已有 checkout 或安装方式，不要静默安装。
- 为本次业务材料确定 `caseId`，格式为 `AG-<slug>`。
- 选择一个明确的持久化 store 路径，并在同一 case 的所有命令中重复使用；路径不确定时先问用户，不要猜。
- 盘点文件名和扩展名。当前支持 `.docx`、`.xlsx`、`.pptx`、`.csv`、`.md`、`.txt`。

### 2. 解析与生成

按顺序执行：

```bash
strategy-agent parse-sources \
  --store <absolute-store-dir> \
  --case AG-demo-001 \
  --file 需求.docx \
  --file 流程.xlsx \
  --request-id req-ag-demo-001-parse-1

strategy-agent generate-draft \
  --store <absolute-store-dir> \
  --case AG-demo-001 \
  --request-id req-ag-demo-001-draft-1
```

本地包也可按项目 README 使用 `npx strategy-agent ...`。重试同一意图时复用同一 `requestId`；输入发生变化才换新 `requestId`。

### 3. 审查与协作

- 只从响应 envelope 的 `data` 中读取 manifest / corpus / draft，不从内部存储文件反推结论。
- 先整理 supported、conflict、missing、openQuestions，再引导业务人员分批确认。
- 需要材料拆解方法时读 `references/material-decomposition.md`。
- 需要提问、冲突裁决、审批或交付话术时读 `references/human-collaboration.md`。

### 4. 恢复执行

新会话不要凭记忆续跑。先用稳定 store 路径调用：

```bash
strategy-agent get-case \
  --store <absolute-store-dir> \
  --case AG-demo-001 \
  --request-id req-ag-demo-001-case-1
```

再按返回的 status / nextAction / draftIds 继续；缺 draftId 时用 `get-draft` 读取用户指定的草稿。

## Reference routing

- 命令、envelope、幂等、状态恢复、审批和编辑器交接：`references/workbench-protocol.md`
- 材料类型、事实抽取、taxonomy、冲突与证据账本：`references/material-decomposition.md`
- 业务人员沟通、分批提问、人工裁决和最终交付：`references/human-collaboration.md`
