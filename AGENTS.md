# strategy-flow-input Agent Rules

## 项目定位

- 本项目是全项目通用策略编排器，仓库地址：<https://github.com/zhengxiaonu-creator/strategy-flow-input>。
- 在策略看板主仓库中，`ebscn-strategy-flow-designer/` 只是集成副本；功能开发以本仓库为源头。
- 页面导出的 JSON 是事实源；Mermaid 只是沟通投影，不承诺无损 round-trip。
- 布局字段只服务于画布呈现，不得参与业务语义和策略提交表口径。
- 保持通用性：不得加入具体策略专属客群、话术、指标或业务口径。

## 协作与协议规则

- 动手前先说明方案、影响面和验收方式；Terry 确认后再执行。
- 修改 Schema 或导出 JSON 结构必须协议先行：先更新 Schema、示例、校验错误码和 round-trip 测试，再实现 UI / CLI。
- `package.json` 的 `version` 表示编排器产品版本；`schemaVersion` 表示数据契约版本。二者独立演进，不得互相替代。
- 不提交 `.DS_Store`、临时截图、日志、打包产物、本地草稿或无关文件。
- 版本 commit 只包含该版本相关变更；文档、测试、实现和 Schema 配套变更可以在同一版本 commit 内。

## 标准开发工作流

### 1. 准备分支

```bash
git switch main
git pull --ff-only
git switch -c feat/<short-feature>
```

分支命名：

```text
feat/<short-feature>      新功能
fix/<short-defect>        缺陷修复
docs/<short-topic>        文档
chore/<short-topic>       工程维护
schema/<short-change>     数据契约调整
```

### 2. 实现与自测

按变更类型完成验收：

```bash
npm test
```

涉及页面交互时：

```bash
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
NODE_PATH='<local-playwright-node-modules>' \
node tests/e2e/run-strategy-flow-designer-e2e.js
```

涉及 Git 安装、CLI 或包内容时：

```bash
npm pack --dry-run
```

修改 CLI 后还需启动本地服务并确认：

```text
/index.html 可访问
/app.js 可访问
CLI --help 输出正常
```

### 3. 提交

提交信息使用 Conventional Commits：

```text
feat: add auto layout presets
fix: keep edge labels inside canvas
docs: document release workflow
chore: update package metadata
schema: add subject name
```

提交前检查：

```bash
git status --short
git diff --check
```

只提交相关文件：

```bash
git add <related-files>
git commit -m "<type>: <summary>"
```

### 4. 推送分支并创建 PR

```bash
git push origin HEAD
```

然后创建 PR：

```text
https://github.com/zhengxiaonu-creator/strategy-flow-input/compare/main...<branch-name>
```

PR 描述必须包含：

```text
变更内容
影响面
验收命令和结果
是否影响 schemaVersion
是否需要同步策略看板
```

PR 通过并合入本仓库 `main` 后，删除远端 feature branch。

## 发布工作流

### 1. 确认 main 干净且已同步

```bash
git switch main
git pull --ff-only
git status --short
```

### 2. 运行验收

```bash
npm test
npm pack --dry-run
```

涉及页面交互的版本必须运行 Chrome E2E。

### 3. 更新版本

按语义化版本更新：

```text
patch：缺陷修复、局部交互优化
minor：向后兼容的新功能
major：破坏 CLI、安装方式或数据契约兼容性
```

同步更新：

```text
package.json
VERSION.md
index.html 的静态资源版本参数（如发生发布变更）
README.md 安装示例中的 tag
```

创建版本提交：

```bash
git add package.json VERSION.md index.html README.md
git commit -m "chore: release v<version>"
```

### 4. 打 tag

```bash
git tag -a v<version> -m "strategy-flow-input v<version>"
git push origin main v<version>
```

## 同步策略看板主仓库

只有已验收 tag 才能同步到策略看板。

在策略看板主仓库执行：

```bash
git switch main
git pull --ff-only
git fetch strategy-flow-input --tags

git subtree pull \
  --prefix=ebscn-strategy-flow-designer \
  strategy-flow-input \
  v<version> \
  --squash
```

然后运行：

```bash
cd ebscn-strategy-flow-designer
npm test
```

回到策略看板根目录运行全量测试：

```bash
rm -rf /tmp/wb-pycache && \
PYTHONPYCACHEPREFIX=/tmp/wb-pycache \
PYTHONDONTWRITEBYTECODE=1 \
python3 -m unittest discover -s strategy-workbench/tests -v
```

全部通过后，策略看板创建独立同步 commit 并推送其 `main`。

## 紧急修复规则

- 优先在本仓库 `fix/*` 分支修复并走 PR。
- 如必须在策略看板集成副本临时修复，修复后必须验证，再执行：

```bash
git subtree split \
  --prefix=ebscn-strategy-flow-designer \
  -b strategy-flow-input-from-dashboard

git push strategy-flow-input \
  strategy-flow-input-from-dashboard:refs/heads/hotfix/from-dashboard
```

- 该分支仍必须通过 PR 合回本仓库 `main`，再按 tag 同步回策略看板。
- 禁止把策略看板临时分支直接覆盖本仓库 `main`。
