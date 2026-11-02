# Agent 执行、订正与便携安装

## 定位与运行

`SKILL_ROOT` 是当前读取的 SKILL.md 所在文件夹，不是用户项目目录。用绝对路径调用 `scripts/agent.mjs`，无需切换 cwd。下文 `<...>` 是需替换的路径说明，不是可原样执行的命令参数。标准运行时是 Node.js 18+；本次实际测试使用 Node v22.22.2。

```text
node "<SKILL_ROOT>/scripts/agent.mjs" --doctor
node "<SKILL_ROOT>/scripts/agent.mjs" --capabilities
node "<SKILL_ROOT>/scripts/agent.mjs" "<TASK_ROOT>/problem.json" --out "<TASK_ROOT>/result-001" --html
```

只求答案可省略 `--out`，只返回紧凑 JSON。`--out` 必须是尚不存在的新目录，成功时写 `input.json`、`report.json`、`solution.md`；`--html` 仅用于三个 LessonSpec 题型；`--svg` 需要含受支持 `figure` 的 ProblemSpec。两种图形选项均需 `--out`。不请求图就不加图选项。帮助：`--help`。输入也可从 stdin 读取（源参数 `-`）；不要把未经正确 shell 转义的题目拼进命令。

相对输入/输出路径相对当前任务 cwd；skill 自己的依赖和模板按脚本地址定位。不要为安装版运行 references/lessons.md 尾部的仓库构建命令；那里描述的是开发者构建流程，安装版使用此处 agent.mjs，直接复用内置模板。

`--doctor` 检查 Node、必要文件、内核加载和安装包清单哈希。仓库源目录没有安装包清单时标记 development-checkout；已打包目录校验每个列出的文件。不需要 npm install，不访问网络；它不认证题意、模型或预览宿主，也不是数字签名或安全认证。缺文件或哈希不符时报告具体项，使用维护者重新生成的包，不让模型凭记忆补内核。

## 读题与选择规格

先只读 SKILL.md 的路由，再读相应参考。不要默认上传整本教材或读取所有模块源代码。

- LessonSpec：给定 v0/a/t 的一维恒加速度、理想串联电路、标准截面，可审查 claims。精确字段见 [lessons.md](lessons.md)。缺少 v0/a/t 的逆向运动题若现有物理公式能表达，改用 ProblemSpec；不要把手算出来的未知量写成题设已知。
- ProblemSpec：`--capabilities` 列出 9 个固定 task，按 [geometry.md](geometry.md) 或 [physics.md](physics.md) 提取 givens；有多个解时保留并解释适用条件，不擅自选根。
- 原题缺失时，可以检查局部运算，题意对应关系明确待核对。输入甚至不足以建立模型时，只说明缺哪项；不能为了出图发明长度、摩擦、重力加速度或正棱锥条件。
- 受支持的 claims 只核验数值结论，任意文字论证仍待审查。旧任务不支持 claims，CLI 会拒绝；可改用受支持 LessonSpec，或保留原解法并明确该结论未被自动核验。

综合题、完整范围/定值证明及教材对照试用另读 [advanced-problems.md](advanced-problems.md)。它描述Agent如何组织独立解答和证据，不新增CLI任务、claims类型或自动证明能力。参考答案与用户个人解法分别标注出处；只有确实在读答案前保存了独立解答，才描述为先独立求解。

## 错误解法与订正演示

例如原题 v0=10 m/s、a=2 m/s²、t=3 s，用户写末速度14 m/s：

1. 原规格保留 `solutionText` 与 `claims:[{"quantity":"v","value":14,"unit":"m/s"}]`，先执行。失败报告指出用户结论和程序重算的差异；退出码为1，不产生成功课件。
2. 报告原解法的可定位错误，不说“所有检查通过”。保留原 JSON 和实际失败报告/命令结果；原文件不覆盖。
3. 若用户同时要求订正、讲解或正确演示，可继续写**另一个明确命名的订正规格**。保持原题 givens 不变，保留原 `solutionText`，在订正说明中写出原 claim 与修正；这一份不再冒充“用户原解法核验通过”。不要把 Agent 新算的答案再塞进 claims 假装用户曾给出它们：订正演示可以省略 claims，由内核独立算出结果；原错误 claims 仍保留在第一份规格与失败报告。只有用户要求审查时，不必额外生成演示。
4. 对订正规格重新调用同一内核，生成新的输出目录。给用户同时说明原结论失败、订正计算结果及待审查范围。不能偷偷删除原 claim、覆盖原审查记录，或把修改后的 claim 说成原解法正确。

没有“Agent 自己确认过，所以可以绕过校验”的分支。题意提取错误可以依据原题修正规格，但需要说明修正位置；用户的错误解法本身不随之改写。

## 报告与交付

stdout 只给 answer、检查概况和文件路径，不输出完整 HTML/SVG、截面网格或逐帧数组。需要检查细节时读取 `report.json` 的对应部分，讲解依照 `solution.md` 的公式、代入和结果组织；不得给程序没验证的证明步骤贴已核验标签。

`passed` 是特定已执行计算，`pending` 是题意、模型假设或文字推理仍需核对，`failed` 阻止有效教学结论与演示文件。任意失败或非法 JSON 都返回非零。输出目录存在时拒绝覆盖；使用新的目录，不自动删除用户旧结果。遇到磁盘等写入错误可能有部分文件，CLI 明确报“未完成”，不得链接为成功交付。

固定LessonSpec的HTML使用打包时原模板，只替换JSON数据入口并转义文本，不改数理内核或输出逐帧坐标。超范围题可交付另行标注的独立推导和自定义图解报告，依 [图解参考](graphical-explanations.md) 内嵌查看器；不得将它说成原生CLI生成或经固定模板测试认证。网页视觉/交互和平台兼容状态沿用 [现有记录](../docs/browser-compatibility.md)，不把文件生成当作平台实测。

## 打包与安装位置

仓库维护者使用 `node scripts/package-solver-agent.mjs --out <新的发布目录>` 生成其中的 `solver-lab/`；它只包含运行时、参考、元数据、示例和模板，不含 node_modules、测试或 Rolldown 导出器。源码与模板更新后重新打包，不手改清单。

复制**整个** solver-lab 文件夹到目标 Agent 支持的 skill 目录。按当前官方说明，Codex 可使用项目级 `.agents/skills/solver-lab/` 或用户级 `~/.agents/skills/solver-lab/`；Claude Code 可使用项目级 `.claude/skills/solver-lab/` 或用户级 `~/.claude/skills/solver-lab/`。已有宿主配置指定其他位置时以实际识别结果为准。其他 Agent 使用其实际支持的 Agent Skills 目录，不能承诺所有产品都自动发现同一路径。复制与替换现有用户级 skill 由用户选择，本任务不自动安装到全局目录。

发现后可通过 `$solver-lab`（Codex）或 `/solver-lab`（支持该命令的宿主）明确调用；是否立即发现由宿主加载机制决定。安装后先运行包内 `--doctor`，再用 `lesson/examples/motion.json` 生成到一个新目录，确认真实产物。

安装位置依据（2026-10-31 核对）：[Codex 官方 skill 文档](https://learn.chatgpt.com/docs/build-skills)、[Claude Code 官方 skill 文档](https://code.claude.com/docs/en/skills)。位置说明不代表已经在这些宿主中完成自动发现实测。
