# 动画演示（motion）

面向“一个过程”而非“一个状态”的教学场景：滑块下滑、电流流动、光路绘制、截面扫掠、圆规画圆。产物是**单个带动画的 SVG 文件**，浏览器直接打开即播放，无需 JS 运行时。

## 1. 技术选型：SVG 原生 SMIL

| 方案 | 结论 |
|---|---|
| SMIL（`<animate>`/`<animateTransform>`/`<animateMotion>`） | ✅ 采用：浏览器全平台原生播放、零依赖、零运行时、文件即动画 |
| requestAnimationFrame + JS | ❌ 需要 HTML 宿主与 JS 运行时，违背“产物是文件”的轻量红线 |
| 逐帧静态 SVG 序列 | ❌ 体积大、需播放器、无法响应 reduced-motion |

 anatomy 的做法是“构建时生成几何 + JS 逐帧变换”（面向网页宿主）；solver-lab 面向 CLI/文件产物，因此取其思想（模型驱动每一帧）而换实现为 SMIL。

## 2. 核心纪律：模型驱动

与 anatomy「every number the figure shows comes from the same small model that moves its parts」同口径，并延续本 skill 的确定性纪律：

- **values 由模型函数逐帧采样产生**（`modelTrack({ at })`），浏览器只做线性播放，不存在“手调关键帧”；
- 运动学动画的模型就是题目公式：`s(t) = v₀t + ½at²`、`v(t) = v₀ + at`——动画 1 秒 = 模型 1 秒（真实时间）；
- 电流粒子周期 ∝ 1/I；像点位置由透镜公式 `1/f = 1/u + 1/v` 定；截面扫掠的起止由平面法向与实体包围盒定；
- 单元测试对末帧做**手算数值断言**（屏幕位移、游标位置、周期），模型改了测试会红。

## 3. figure kind 一览

| kind | 用途 | 关键参数 | 联动任务 |
|---|---|---|---|
| `motion`（mode: `incline`） | 斜面匀加速下滑：滑块 + G/N 随动 + v 标尺游标 | `a, v0, duration, angleDeg, length, vMax, unit, blockLabel` | 运动学/力学 |
| `motion`（mode: `freefall`） | 自由落体：下落小球 + 释放点闪烁 + v 标尺游标 | `a, v0, duration, dropHeight, vMax, unit` | 运动学 |
| `circuit-flow` | 串联电路电流流动：3 个错相粒子沿回路循环 | `resistors, current` | 电磁学 |
| `optics-anim` | 凸透镜光路：三条特殊光线依次画出 + 像点脉冲 | `f, u, objectHeight` | 光学 |
| `section` + `sweep: true` | 截面扫掠：截平面沿法向扫入，到位后截面显现 | `sweep` | `geometry.section` |
| `plane-triangle` + `compass: true` | 三点定圆：半径线旋转扫过 + 圆 0→R + 圆心脉冲 | `compass` | `geometry.three-point-circle` |

## 4. 通用行为约定

- **到达轨道末端即停**：`tEnd = min(duration, 到达底端/落地时刻)`。斜面上 `a=5、length=12` 最多演 2.19 s；超出duration 以 duration 为准，绝不滑块冲出斜面/小球穿地；
- **v 标尺游标表达实时读数**：SMIL 不能动画文本内容，故不用闪动的数字，而用“游标位置 ∝ v(t)”+ 静态刻度（游标指到几就是几 m/s），更适合教学对照；
- **循环与单次**：演示型（运动/流动/扫掠）`repeatCount="indefinite"` 循环播放；绘制型（光线/圆规/像点）播放一次并 `fill="freeze"` 保持终值；
- **reduced-motion**：所有 SVG 内置 `@media (prefers-reduced-motion: reduce)` 规则隐藏动画元素，系统开启减少动态时图形退化为静态首帧（运动学即 t=0 初始态）；
- **自检**：动画 SVG 与静态图一样过 `checkSvg`（闭合、无 NaN/undefined），并断言 SMIL 结构（values/keyTimes 等长、首末 0/1）。

## 5. 输入示例

```json
{
  "domain": "physics",
  "task": "physics.formula",
  "givens": {
    "id": "kinematics.velocity",
    "target": "v",
    "knowns": {
      "v0": { "value": 0, "unit": "m/s" },
      "a": { "value": 5, "unit": "m/s²" },
      "t": { "value": 2, "unit": "s" }
    }
  },
  "figure": {
    "kind": "motion",
    "mode": "incline",
    "angleDeg": 30,
    "length": 12,
    "a": 5,
    "v0": 0,
    "duration": 2,
    "vMax": 12,
    "blockLabel": "m"
  }
}
```

运行 `node scripts/solve.mjs spec.json --figure out.svg`，`out.svg` 打开即播。

## 6. examples/ 动画清单

- `anim-incline.svg` — 斜面匀加速下滑（真实时间 + v 标尺游标）
- `anim-freefall.svg` — 自由落体（v = gt）
- `anim-circuit-flow.svg` — 串联电路电流流动（流速 ∝ I）
- `anim-optics-rays.svg` — 凸透镜光路绘制 + 像点脉冲
- `anim-section-sweep.svg` — 圆柱斜截面扫掠形成
- `anim-compass.svg` — 三点定圆圆规绘制

## 7. 二次开发入口

`kit/animate.mjs` 导出原语（`EASINGS`/`modelTrack`/`animate`/`animateTransform`/`animateMotion`/`drawPolyline`/`pulse`/`blink`），`kit/figure.mjs` 导出场景（`figureMotionTrack`/`figureCircuitFlow`/`figureOpticsAnim`/`figureCompassCircle`）。自定义动画 = 给 `modelTrack` 一个模型函数，例如让游标跟随任意 `f(t)`：

```js
import { modelTrack, animateTransform } from './kit/animate.mjs'

const track = modelTrack({ duration: 2, easing: 'easeInOutCubic', at: (e) => [e * 100, 0] })
const el = `<g>${animateTransform({ type: 'translate', values: track.values, keyTimes: track.keyTimes, duration: track.duration })}…</g>`
```

已知边界：SMIL 不能动画 `text` 内容（故读数用游标/刻度表达）；`animateMotion` 的路径需调用方给出屏幕坐标 path 字符串。
