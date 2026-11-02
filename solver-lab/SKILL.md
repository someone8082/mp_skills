---
name: solver-lab
description: Use when 用户提供高中数学或物理题，需要分步解答、检查个人解法的数值结论，或生成截面、受力、电路、光路及运动演示。适用于有本地工具的 Agent；不用于自动认证任意证明或猜测模糊题设。
---

# solver-lab — Agent 数理解题实验室

Agent负责读题和解释，受支持的计算交给固定内核。综合题可独立推导并单独说明证据。默认在本地完成，题目整理与模型选择仍需核对；不把数值检查当作整篇证明。

## Agent 入口

以本文件所在文件夹为 `SKILL_ROOT`，使用脚本的绝对路径；输入和输出放在当前任务目录。运行时需要 Node.js 18+，安装包不需要 npm、仓库源码、网络或 API Key。

```text
node "<SKILL_ROOT>/scripts/agent.mjs" --capabilities
node "<SKILL_ROOT>/scripts/agent.mjs" "<task-directory>/problem.json" --out "<task-directory>/new-result"
```

首次或安装异常时运行 `--doctor`。完整操作、错误解法订正和安装包用法见 [Agent 工作流](references/agent-workflow.md)。脚本输出紧凑 JSON；详细推导与检查写入产物，避免把网格和完整 HTML 灌入上下文。

## 选择最小入口

| 任务 | 输入与按需参考 | 产物 |
|---|---|---|
| 一维匀变速、理想串联电路、标准截面；检查用户数值结论 | [LessonSpec](references/lessons.md)：`version/topic/givens` | Markdown、JSON；要求交互演示时加 `--html` |
| 三角形、圆的位置关系、圆锥曲线、空间角、实体度量/截面 | [几何 ProblemSpec](references/geometry.md)：`domain/task/givens` | Markdown、JSON；按需加 `figure` 与 `--svg` |
| 单个物理公式的正反求值与单位换算 | [物理 ProblemSpec](references/physics.md) | Markdown、JSON；按需读 [配图](references/figures.md) / [SMIL 动画](references/animation.md) |

不要混用 `topic` 与 `task`。不需要图时不生成图；不要默认加载所有参考文件或要求用户切换到聊天网页版。

截面题要求“作图/讲解思路”时，按 [逐步作图规格](references/lessons.md#带点名的逐步作图) 提供点名与 construction。默认相机旋转和截面面积不能代替解题过程；图上的点名、交线与讲解必须对应原题。

复杂题超出固定接口时，按 [综合题与证明核验](references/advanced-problems.md) 分阶段建模、独立推导，受支持的局部计算仍可调用内核；不得把整题硬塞进一个 motion 或 physics.formula。图解交付读 [图解与查看交互](references/graphical-explanations.md)：点名、辅助关系和解题步骤对应；自定义报告可复用包内的SVG缩放查看器。

## 执行与核验

1. 保留完整题干、可辨认的图中条件、单位与原解法。截图模糊、缺少必要条件或超出支持范围时指出具体缺口，不编已知量、教材来源或额外物理条件。
2. 写入结构化规格。用户数值结论用 LessonSpec 的 `claims`；文字用 `solutionText`。ProblemSpec 不支持 claims，不能静默略过。推导量不冒充题设输入。
3. 执行 CLI，读取真实退出码与报告。失败时解释具体不一致；不改 claim、删条件或重写内核来凑通过。用户要求订正后演示时，按工作流保留原审查证据，再建立明确标注的独立订正规格。
4. 根据实际结果给出适合高中生的讲解，引用公式、代入和条件。`ok:true` 允许仍有 `pending`；说明哪些计算检查通过、哪些题意/假设/推理仍需核对。未执行时明确“未运行验证”。
5. 链接本次实际生成的文件。固定LessonSpec课件只替换原模板数据；自定义综合题报告单独标明独立推导与实际核验范围。区分图像缩放平移、构造步进、时间动画和参数联动，不用一种交互冒充另一种。生成成功不代表宿主已预览成功。

## 其他环境

用户明确要求聊天网页版时，保留现有 [网页提示词工作流](prompts/README.md)；其 [账号兼容状态](docs/browser-compatibility.md) 需实际测试。没有本地执行工具的 Agent 只能提供待验证规格或手工解释，不得声称已运行脚本。
