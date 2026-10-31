# mp_skills

面向高中数学、物理的 Agent skill 与聊天网页版提示词。

## solver-lab

[Agent skill 入口](solver-lab/SKILL.md) · [完整操作与安装说明](solver-lab/references/agent-workflow.md) · [网页版提示词](solver-lab/prompts/README.md)

Agent 负责读题、选择模型和组织讲解，内置确定性内核负责受支持的计算与数值检查。目前提供 9 类固定任务，以及匀变速运动、理想串联电路、标准截面 3 类交互课件。数值核验不等于自动证明；题意、模型条件与文字推理仍需核对。

### 在 Agent 中使用

需要 Node.js 18+，实际验证版本为 22.22.2；运行包无需 npm install、网络或 API Key。

下载或克隆仓库后，复制**整个** `solver-lab` 文件夹到 Agent 支持的 skill 目录。例如项目级 Codex 使用 `.agents/skills/solver-lab/`，Claude Code 使用 `.claude/skills/solver-lab/`；其他宿主按其实际配置安装。请保留脚本、内核、模板和参考文件，不能只复制 `SKILL.md`。

也可先在本仓库根目录验证和试用：

```sh
node solver-lab/scripts/agent.mjs --doctor
node solver-lab/scripts/agent.mjs --capabilities
node solver-lab/scripts/agent.mjs solver-lab/lesson/examples/motion.json --out ./motion-result --html
```

输出目录必须尚不存在。成功后查看 `motion-result/solution.md`、`report.json` 和 `lesson.html`；后续试用换一个新输出目录。安装后可在支持相应调用方式的宿主中输入 `$solver-lab` 或 `/solver-lab`。

### 在聊天网页版中使用

1. 选一份完整 HTML 模板：[运动](solver-lab/examples/lesson-motion.html)、[串联电路](solver-lab/examples/lesson-circuit.html)、[标准截面](solver-lab/examples/lesson-section.html)。在 GitHub 文件页通过下载按钮或 Raw 保存原文件，再附到聊天中。
2. 使用[通用提示词](solver-lab/prompts/web-common.md)，再附上 [ChatGPT](solver-lab/prompts/chatgpt.md)、[DeepSeek](solver-lab/prompts/deepseek.md)、[豆包](solver-lab/prompts/doubao.md) 或 [Qwen/千问](solver-lab/prompts/qwen.md) 对应提示词及原题。
3. 优先复用模板，只让模型生成题目 JSON，粘贴到课件输入框并“载入并核验”。播放、暂停和拖动均在本地计算，不消耗模型调用。

可先用[预览探针](solver-lab/examples/preview-probe.html)检查当前聊天页面能否执行脚本。各平台账号内预览尚待实测，文件生成或探针通过不能替代正式课件验收；详见[兼容状态与人工验收](solver-lab/docs/browser-compatibility.md)。GitHub 文件页本身不执行 HTML。

### 发布内容与验证范围

此仓库存放可直接使用的运行包与提示词，包含 `agent-manifest.json` 文件清单。`--doctor` 检查列出文件的完整性和内核加载，不是数字签名，也不认证题意或平台预览。

`solver-lab/docs/` 中的验证记录描述开发时的检查；其中源码构建、npm 测试和临时证据路径属于开发仓库环境，本运行包不包含相应开发工具。安装和使用以本页及 Agent 工作流为准。
