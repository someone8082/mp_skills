# Agent 版本验证记录

日期：2026-10-31。运行时：Windows、Node v22.22.2。目标是开发可安装的 Agent Skills 包，当前工作没有安装到任何用户全局目录，没有提交、合并或发布。原有网页脚本、模板、数理内核和待实测状态保持不变。

## 本次新增

- Agent 默认流程与 Codex 展示元数据，按题型渐进读取参考。
- `scripts/agent.mjs`：能力查询、安装诊断、LessonSpec/ProblemSpec 执行、紧凑 stdout、Markdown/JSON/HTML/SVG 产物。
- Agent HTML 通过原样预构建模板替换 JSON 生成，不调用 Rolldown、不需要 node_modules。
- 根目录 `scripts/package-solver-agent.mjs`：白名单打包与内容清单，拒绝覆盖现有包，不包含测试或构建期导出器。
- 原解法失败与独立订正演示的明确流程，原始 claim 和失败记录必须保留；程序自算的订正值不能伪装为用户 claim。

## 已执行检查

| 检查 | 结果 |
|---|---|
| 新增 CLI 测试先于实现运行 | 5 项失败，捕获缺少入口与产物能力 |
| 新增独立打包测试先于实现运行 | 捕获缺少打包脚本 |
| `npm.cmd run test:solver` | 209 项全部通过；日志 `tmp/archive/2026-11-03/logs/solver-agent-tests.log` |
| Agent CLI/打包聚焦复验 | 6 项通过，包括任意 cwd、空格路径、stdin、错误 claim、无覆盖、损坏包检查 |
| Skill Creator `quick_validate.py skills/solver-lab` | 通过 |
| 共享内核 `--check`、三份既有网页模板 `--examples --check` | 均通过；本轮未重生成或改写网页模板 |
| 独立安装目录、无 node_modules 的实际执行 | 包外 cwd 成功求解和生成 HTML；未安装依赖 |
| 缺文件/改写模块试验 | `--doctor` 返回非零并指明具体文件 |
| `git diff --check` | 通过 |

主应用与 TypeScript 数学源本轮未修改，因此不重复运行上一轮已通过的主应用构建与 1,096 项测试；本轮新增和受影响的 skill 测试全部执行。

## 行为测试

基线 Agent 仅依据旧 skill 说明，需要仓库根目录、npm/Rolldown，且遇到错误 claim 后没有明确的订正演示交付方法。

修订后，独立 Agent 仅使用独立打包目录，实际处理“初速度10m/s、加速度2m/s²、3秒，学生末速度写14m/s，并要求讲解与交互演示”：

1. 安装诊断退出0；原 claim 审查退出1，实际报告用户14与模型16不一致，没有成功课件。
2. 原输入与失败证据保留，独立订正规格保持 givens 与原 solutionText，不再添加自算 claims。
3. 订正执行退出0，计算末速度16m/s、位移39m，生成 Markdown、JSON 与 HTML；3项passed、0项failed、3项pending。
4. 静态产物检查退出0，内嵌规格一致、脚本可解析、无外部脚本、交互控件存在；没有宣称执行了浏览器预览。

实际证据位于 `tmp/archive/2026-11-03/validation/agent-skill-forward-output-v3/`，上一轮暴露 claim 归属措辞问题的输出保留在 `tmp/archive/2026-11-03/validation/agent-skill-forward-output/`。修订后重测确认不再将 Agent 自算答案称为用户给定结论。

独立代码审查检查了 CLI 输入、失败门控、目录与覆盖保护、依赖闭包、清单验证、报告和订正流程，未发现重要缺陷。

## 限制

运行时最低声明为 Node18+，本次实测只有 Node22.22.2；其他系统与 Node 版本需继续验证。未宣称完成 Codex/Claude Code 宿主自动发现的逐产品测试，也没有安装到全局目录。标准文件结构与安装位置参考官方资料，最终以宿主实际配置为准。

题意提取、模型适用性与任意文字证明保持待核对；数理覆盖沿用现有9类固定任务与3类课件，没有扩展成通用自动证明器。浏览器视觉与聊天平台账号实测由用户后续反馈。
