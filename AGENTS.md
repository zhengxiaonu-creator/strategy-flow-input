# strategy-flow-input Agent Rules

- 本项目是全项目通用策略编排器，仓库地址：<https://github.com/zhengxiaonu-creator/strategy-flow-input>。
- 在策略看板主仓库中，本目录只是集成副本；功能开发应在独立仓库完成，不在集成副本中长期分叉。
- 新功能必须先明确 `strategy-flow-input` Schema、示例、校验错误码和 round-trip 行为，再实现 UI / CLI。
- 页面导出的 JSON 是事实源；Mermaid 只是沟通投影，不承诺无损 round-trip。
- 布局字段只服务于画布呈现，不得参与业务语义和策略提交表口径。
- 保持通用性：不得加入具体策略专属客群、话术、指标或业务口径。
- 交付前至少运行 `npm test`；涉及页面交互时运行 Chrome E2E；涉及包安装时运行 `npm pack --dry-run`。
- 版本发布必须创建独立 commit 和 git tag；主策略看板只同步已验收 tag。

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for this strategy-flow-input repository. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default canonical triage labels without renaming. See `docs/agents/triage-labels.md`.

### Domain docs

This repository uses the single-context layout: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.
