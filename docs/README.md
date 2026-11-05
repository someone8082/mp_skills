# 仓库目录导航

本仓库发布可直接安装的solver-lab技能，并保留少量演示、测试及验证记录。使用时复制完整`solver-lab/`；根目录的开发文件无需放进Agent的skill目录。

| 位置 | 用途 |
|---|---|
| [solver-lab/SKILL.md](../solver-lab/SKILL.md) | 技能入口与按需参考路由 |
| [solver-lab/scripts/](../solver-lab/scripts/) | `agent.mjs`解题、`study.mjs`查方法、课件与公式入口 |
| [solver-lab/references/](../solver-lab/references/) | 输入格式、综合题方法、图解、动画及使用边界 |
| [solver-lab/references/study/](../solver-lab/references/study/) | 数学58讲、力学15专题的目录和方法卡 |
| [solver-lab/kit/](../solver-lab/kit/) | 确定性的数理与图形工具 |
| [solver-lab/shared/](../solver-lab/shared/) | 开发仓库生成的共享数学内核 |
| [solver-lab/lesson/](../solver-lab/lesson/) | 课件运行模块与输入示例 |
| [solver-lab/examples/](../solver-lab/examples/) | 单文件课件与图形示例 |
| [solver-lab/prompts/](../solver-lab/prompts/) | 聊天网页版提示词 |
| [solver-lab/prompts/subjects/](../solver-lab/prompts/subjects/) | 七类按需题型补充词；与一个主入口组合 |
| [solver-lab/assets/](../solver-lab/assets/) | 可选图解查看器资源 |
| [solver-lab/agent-manifest.json](../solver-lab/agent-manifest.json) | 运行包文件哈希，供doctor检查 |
| [tests/study.test.mjs](../tests/study.test.mjs) | 无第三方依赖的检索、条件卡与参数测试 |
| [tests/prompt-contracts.mjs](../tests/prompt-contracts.mjs) | 11项编译器边界与错误映射反例检查 |
| [docs/demos/](demos/) / [docs/images/](images/) | README引用的演示和截图 |
| [docs/validation/](validation/) | 发布时的实际验证范围与限制 |

在克隆后的仓库根目录执行：

```sh
node solver-lab/scripts/agent.mjs --doctor
node solver-lab/scripts/study.mjs --list
node --test tests/study.test.mjs
node tests/prompt-contracts.mjs
```

运行时需要Node.js 18+。本次实际验证使用Node.js 24.22.1。测试只使用Node内置模块，会启动本地CLI子进程；不连接API或网络。

`solver-lab/docs/`中的历史开发记录可能提及源项目的npm命令和临时路径；这些不属于当前发布仓库的依赖。源项目临时文件已按安装包、发布校验、验证输出、视觉、资料、草稿、日志和缓存分类归档。发布仓库不复制这些历史临时副本，也不复制资料原文和逐页全文。
