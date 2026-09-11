# Workbench protocol

本文件约束 Agent 与 `strategy-flow-input` 的交互。协议细节以仓库内 `references/agent-protocol.md` 和 `contracts/strategy-agent-*-0.1.*` 为准；本文件解决接入 Agent 的操作方式。

## 命令面

| 场景 | 命令 | 关键输入 |
|---|---|---|
| 解析材料 | `parse-sources` | 一个或多个 `file`、`requestId`；可省略 `caseId` |
| 生成草稿 | `generate-draft` | `caseId`、可选 `corpusId`、`requestId` |
| 读取草稿 | `get-draft` | `caseId`、`draftId`、`requestId` |
| 人工补齐 | `resolve-draft` | `caseId`、`draftId`、`resolvedFields`、`requestId` |
| 发起审计审批 | `request-approval` | `caseId`、`draftId`、`approver`、`requestId` |
| 消费一次性 token | `confirm-draft` | `caseId`、`draftId`、`approvalToken`、`confirmedBy`、`requestId` |
| 丢弃草稿 | `discard-draft` | `caseId`、`draftId`、`requestId` |
| 恢复状态 | `get-case` | `caseId`、`requestId` |

所有输出都是 `strategy-agent-response/0.1` envelope。`ok` 必须读 `data`；`error` 必须读 `error.code` 和 `error.message`，不要解析 CLI 进程输出之外自造结果。

## 启动前检查

1. 确认能调用 `strategy-agent --help`。不能调用时，向用户说明缺入口，并请求提供仓库 checkout 或安装授权。
2. 确认本次输入文件都存在且用户明确允许读取。
3. 不向业务人员询问本地工作区 ID；`parse-sources` 缺省时自动生成，并从响应的 `caseId` 继续传递。
4. 确认 store 路径。推荐使用用户提供的绝对路径；同一 case 后续命令不得换路径。
5. 预检扩展名。遇到 `.pdf`、图片、音频、压缩包等不支持类型，先说明 `E_SOURCE_FILE_UNSUPPORTED` 的可能结果，并请用户转成支持格式；不要伪造 corpus。

## 标准路径

```bash
strategy-agent parse-sources \
  --store "$STRATEGY_AGENT_STORE" \
  --file requirement.docx \
  --file flow.xlsx \
  --request-id req-ag-new-customer-001-parse-001
```

成功后从 `data.corpus` 记录 `corpusId`、`evidenceId` 和 fragment 位置；从 `data.manifest` 确认每个文件都有 sha256 与 parser 状态。

```bash
strategy-agent generate-draft \
  --store "$STRATEGY_AGENT_STORE" \
  --case <local-workspace-id> \
  --corpus ec-... \
  --request-id req-ag-new-customer-001-draft-001
```

成功后从 `data.draft` 记录 `draftId`、`candidate`、`registrationMetadataCandidate`、`provenance`、`openQuestions`、`reviewState`。当前默认模型是离线 stub；Agent 不得因为模型输出简陋而手改内部 artifact 或补造业务事实。

当前离线 stub 生成 Design 0.8，但不会自动生成 `classification`。若材料显示存在对象分类 / 分层意图，Agent 只能在审查汇报或 openQuestions 中提示；业务人员确认后在编辑器里显式添加或修改卡片。不要直接编辑 store 内部 draft。

## 幂等与错误处理

- `requestId` 是幂等键，格式必须为 `req-<slug>`。
- 网络或模型类可重试错误重试时复用原 `requestId`，期待 `replayed=true`。
- 修改文件集合、corpus、resolvedFields 或 token 输入时必须换新 `requestId`。
- 收到 `E_REQUEST_ID_CONFLICT`，说明同 ID 曾对应不同输入；保留审计事实并换新 ID，不要覆盖旧请求。
- 收到 `E_SOURCE_FILE_UNSUPPORTED`，请用户转换文件；转换后的文件是新的证据来源，需重新 `parse-sources`。
- 收到 `E_DRAFT_UNCONFIRMED_REQUIRED_FIELD`，先整理输出契约待办并让人工补齐，不得改错误码或绕过校验。
- 收到 `E_APPROVAL_TOKEN_EXPIRED` 或 `E_APPROVAL_TOKEN_REUSED`，必须重新走显式审批；不得复用旧授权。

## 状态恢复

```bash
strategy-agent get-case \
  --store "$STRATEGY_AGENT_STORE" \
  --case <local-workspace-id> \
  --request-id req-ag-new-customer-001-case-001
```

依据返回的 `case.status`、`case.nextAction`、`draftIds` 和 audit 决定下一步。聊天记录只能帮助沟通，不能作为状态依据。若用户只给 `draftId`，用 `get-draft` 读取；若 store / case / draft 缺失，向用户询问，不要扫描并编辑内部文件来“修复”。

## 人工补齐与编辑器交接

- `resolve-draft` 用于人工补齐事实，输入必须来自业务人员明确给出的值；Agent 不要替用户编一个默认值。
- `resolvedFields` 的 pointer 必须指向 draft candidate 或 metadata 的真实字段；一次只提交已确认的字段。
- 口头确认不能被 Agent 改写成带证据的 `supported`。通过 `resolve-draft` 会形成 `human_resolved` 审计；编辑器修正则进入 canonical 编辑状态。
- 页面顶栏「Agent 草稿」同时导入 draft JSON 与 corpus JSON，逐项核对 provenance / openQuestions / evidence 后导入候选。
- 默认路径是：待办可见 → 人工修正 → 导出边界校验 → 导出 Design 0.8 与 Metadata 2.0。证据待办本身不阻断编辑器导入。
- 新建策略导出时省略 `registrationCaseId` 与 `strategyId`。看板提交注册后返回 CaseID，正式注册后返回策略编号；只有用户明确要继续已有提交或更新已有正式策略时才询问对应看板返回值。
- 对象分类卡片导出前必须满足：至少一个 `processActions`、无 `strategyActions`、有出边、所有出边对象行为为 `no_requirement`；对应阻断码为 `CLASSIFICATION_PROCESS_ACTION_REQUIRED`、`CLASSIFICATION_STRATEGY_ACTION_FORBIDDEN`、`CLASSIFICATION_OUTGOING_EDGE_REQUIRED`、`CLASSIFICATION_SUBJECT_BEHAVIOR_INVALID`。
- 0.2 candidate 导入编辑器后仍保持原有 `process`；只有业务人员显式选择“对象分类”后，导出才使用 `classification`。

## 可选审计路径

只有用户明确要求审计时才走：

```bash
strategy-agent request-approval \
  --store "$STRATEGY_AGENT_STORE" \
  --case <local-workspace-id> \
  --draft sd-... \
  --approver Terry \
  --request-id req-ag-new-customer-001-approval-001

strategy-agent confirm-draft \
  --store "$STRATEGY_AGENT_STORE" \
  --case <local-workspace-id> \
  --draft sd-... \
  --token at-... \
  --confirmed-by Terry \
  --request-id req-ag-new-customer-001-confirm-001
```

Token 只显示和消费一次，10 分钟有效。不要把 token 写入业务材料、issue、长期笔记或最终 JSON。
