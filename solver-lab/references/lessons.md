# 三类交互课件：LessonSpec v1

本入口把 **AI 提取题设 → 固定模型计算 → 分步讲解 → 同源动画 → 分层核验** 连起来。它不解析任意自然语言、不自动证明整篇解法，也不覆盖所有高中数学物理题。旧 `ProblemSpec` 的 `domain/task/figure` 字段不能用于这里。

## 先选题型

| topic | 模型与必需条件 | 不应自动套用的题目 |
|---|---|---|
| `motion` | 选定正方向的一维恒加速度，给 `v0/a/t`，可给 `x0` | 分段变加速、碰撞、触地后继续运动、把位移当路程 |
| `circuit` | 理想直流电源与 1–8 个正电阻全部串联 | 并联/混联、含电源内阻、电容暂态、非线性元件 |
| `section` | 支持的标准实体尺寸和完整截平面 | 仅凭一张图猜平面、组合体、要求任意曲线截面的解析证明 |

不适用时说明原因，保留原题，不偷偷删条件以套进模型。字段不足时不要输出貌似完整的 JSON。

## 公共字段

```text
version: 1
topic: "motion" | "circuit" | "section"
problemText: 题干原文字符串（最多 12000 字；只有解法时可为空）
givens: 所选题型的对象
title?: 标题字符串
claims?: [{ quantity, value, unit, source? }]（最多 100 条）
solutionText?: 用户解法原文字符串
assumptions?: 字符串数组
```

`Quantity = { "value": 有限数字, "unit": 非空单位字符串, "source"?: 题干原文片段 }`。不把数字写成带单位字符串，不把 `NaN/Infinity` 当 JSON 数值。物理量按量纲换算到内部单位；量纲冲突拒绝计算。`givens` 的未知字段会被拒绝。

给定量的 `source` 必须逐字出现在 `problemText` 中，否则拒绝。它只定位原文，不能证明数值、单位、条件关系或目标提取得对。未提供来源会保留待核对提示。截面实体与平面的几何语义也需对照原图人工确认，不虚构逐参数自动溯源。

`claims.source` 可保留用户结论的出处说明，目前数值核验不校验这段出处。`claims` 只接受模型已输出、带单位的数值目标；数组目标使用点路径，如 `voltages.0`。无法核验的目标会报错。`solutionText` 中任意论证不会因几个数值吻合而得到认证。

数值比较采用换算后约 `1e-9` 的相对容限；运动公式接近零的抵消结果按运算项的尺度处理浮点误差。没有按有效数字或题目评分规则自动放宽。学生写出的四舍五入近似值可能触发失败；应保留原解法并说明当前核验容限，不能为了通过偷偷改写学生结论。没有结构化精确数时，可只保留 `solutionText` 并明确该结论尚未被数值自动核验。

常用可执行单位写法：速度 `m/s`、`km/h`，加速度 `m/s²` 或 `m/s^2`，时间 `s`、`min`，长度 `m`、`cm`、`mm`，电压 `V`、`mV`、`kV`，电阻 `Ω`、`kΩ`、`MΩ`；大小写有意义。更多单位解析见旧 [物理参考](physics.md#2-单位解析能力)，但其中“unit 可省略”仅适用于旧公式入口，LessonSpec 必须显式提供单位。不要假定任意中文单位或自行拼写的别名都可解析。

可选字段不需要时省略；不要用 `null` 代替对象、数组或字符串。本文说明生成器应输出的字段，不是可导入的 JSON Schema 文件。

以下均为自拟演示题，不声称来自教材。

## motion：一维匀变速运动

`v0` 用速度单位、`a` 用加速度单位、`t` 用时间单位且不小于零，`x0` 可选。省略 `x0` 只是把初始位置作为坐标原点，不补加物理条件。

```json
{
  "version": 1,
  "topic": "motion",
  "problemText": "物体沿正方向从静止开始，以 2 m/s² 的恒定加速度运动 3 s，求位移和末速度。",
  "givens": {
    "v0": { "value": 0, "unit": "m/s", "source": "从静止开始" },
    "a": { "value": 2, "unit": "m/s²", "source": "2 m/s²" },
    "t": { "value": 3, "unit": "s", "source": "3 s" }
  },
  "claims": [{ "quantity": "s", "value": 9, "unit": "m" }]
}
```

输出数值目标：`s/x/v/v0/a/t/x0`。此例终点 `s = 9 m`、`v = 6 m/s`；`stateAt(1)` 为 `t=1,x=1,s=1,v=2,a=2`。允许反向速度和负加速度，位移有符号；不计算总路程。时间夹到 `[0,t]`。

## circuit：理想直流串联电路

`voltage` 是电压 Quantity；`resistors` 为 1–8 个电阻 Quantity，电阻必须大于零。零电压有效。电压符号决定约定电流方向。

```json
{
  "version": 1,
  "topic": "circuit",
  "problemText": "60 V 理想直流电源与 10 Ω、20 Ω 两个电阻串联，求电流、分压和功率。",
  "givens": {
    "voltage": { "value": 60, "unit": "V", "source": "60 V" },
    "resistors": [
      { "value": 10, "unit": "Ω", "source": "10 Ω" },
      { "value": 20, "unit": "Ω", "source": "20 Ω" }
    ]
  },
  "claims": [{ "quantity": "current", "value": 2, "unit": "A" }]
}
```

输出目标：`voltage/resistance/current/voltages.0/powers.0/power` 等有效数组下标。此例总电阻 `30 Ω`，电流 `2 A`，分压 `20/40 V`，功率 `40/80 W`，总功率 `120 W`。核对 KVL、串联电流一致性、功率守恒。移动圆点是约定电流的示意，不是电子真实漂移速度。

## section：标准实体截面

`givens = { solid, plane, unit }`。尺寸和坐标是有限数字，共用显式长度单位 `unit`（如 `cm`）。

| solid.kind | 参数 |
|---|---|
| `cube` | `a` |
| `box` | `a,b,c` |
| `prism` / `pyramid` | `n,radius,height` |
| `frustum` | `n,rBottom,rTop,height` |
| `cylinder` / `cone` | `radius,height` |
| `conical-frustum` | `rBottom,rTop,height` |
| `sphere` | `radius` |

实体支持 `{ "kind":"cube", "a":2 }` 或 `{ "kind":"cube", "params":{"a":2} }`；不要同时给出矛盾的扁平/嵌套参数。尺寸必须为正有限数；教学模板的正多边形边数 `n` 限为 3–8。`radius` 在正棱柱/棱锥中指底面外接圆半径。

平面二选一且不得混用：`{ "point":[x,y,z], "normal":[nx,ny,nz] }`（非零法向量）或 `{ "points":[P1,P2,P3] }`（三个不共线点）。长方体位于 `[0,a]×[0,b]×[0,c]`；球心在原点；其他轴向标准实体底面在 `z=0`、轴为 z 轴。几何坐标映射本身是待审查的建模步骤。

```json
{
  "version": 1,
  "topic": "section",
  "problemText": "边长为 2 cm 的正方体，截平面经过 (2,1,0)、(2,0,1)、(1,0,2)，求截面面积；坐标单位为 cm。",
  "givens": {
    "solid": { "kind": "cube", "a": 2 },
    "plane": { "points": [[2,1,0],[2,0,1],[1,0,2]] },
    "unit": "cm"
  }
}
```

此例为正六边形，面积 `3√3 cm²`，页面以近似小数和 `≈` 显示。输出目标包括有数值时的 `area/perimeter/radius`。未相交或相切的退化情形按实际分类展示，面积可能为 `null`，不编造指标；不支持或数值非法则拒绝课件。曲线边界可能采样显示，动画旋转仅改变相机，不改变几何结论。

## 核验层级与报告

每项检查都有 `id/scope/status/detail`；`status` 为 `passed/failed/pending`。

| scope | 实际含义 |
|---|---|
| `input` | 结构、有限数值、单位等程序检查 |
| `statement` | 题设提取及原题对应关系，始终需人工核对 |
| `model` | 恒加速度、串联、截面坐标等模型适用性，需人工核对 |
| `mathematics` | 已实现模型中的公式/残差/几何交叉检查 |
| `user-work` | `claims` 数值重算；任意文字解法保持待审查 |
| `animation` | 图形与读数使用同一已求解模型；不证明平台成功播放 |

`ok: true` 表示没有失败项，可同时有待审查项。数值结论冲突、非法输入等失败时，不交付答案与可播放动画。报告应写“在这些输入与假设下，已实现的计算检查通过；题意/模型/文字推理待核对”。不得手动把 `pending` 改成 `passed`。

## 本地生成与复用

从仓库根目录，先按根 `package.json` 安装依赖并使用符合其 `engines` 的 Node.js。当前要求 `^22.22.2 || ^24.15.0 || >=26.0.0`；导出器构建时使用已安装的 Rolldown，生成的 HTML 运行时无需 Node.js 或外部库。

```sh
node skills/solver-lab/scripts/lesson.mjs skills/solver-lab/lesson/examples/motion.json --html lesson-motion.html
node skills/solver-lab/scripts/lesson.mjs skills/solver-lab/lesson/examples/circuit.json --html lesson-circuit.html
node skills/solver-lab/scripts/lesson.mjs skills/solver-lab/lesson/examples/section.json --html lesson-section.html
```

库入口：`import { compileLesson } from './lesson/compile.mjs'`；HTML 导出入口为 `buildLessonHtml`（`lesson/export.mjs`）。编译结果的 `stateAt(t)` 同时给图形和读数供数。无需让 AI 生成每一帧，也不需浏览器再次调用模型。

网页内复用先读 [提示词与操作步骤](../prompts/README.md)。每个 HTML 只承载对应题型；换题型换模板。保留一份原模板；若 AI 只能输出 JSON，就直接用原模板导入，无需让模型复写整份 HTML。
