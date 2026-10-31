# 图形参考 — 等轴测 craft 与 2D 示意图

可视化层从 [anatomy](https://github.com/wheresryan22/anatomy) 轻量移植：等轴测投影、背面剔除 + 画家排序、四调着色、卡片框构图。零外部资源，输出纯 SVG 字符串。

## 1. 在 spec 中请求图形

```jsonc
{
  "domain": "geometry",
  "task": "geometry.section",
  "givens": { "solid": { "kind": "box", "a": 2, "b": 2, "c": 2 },
              "plane": { "points": [[2,1,0],[2,0,1],[1,0,2]] } },
  "figure": { "kind": "section", "fig": 1, "title": "正方体的斜截面", "hint": "平面与实体的交" }
}
```

`figure` 字段可选（省略不出图）。产出挂在 `solution.figure.svg`；CLI 加 `--figure out.svg` 落盘。**每张图都过 `checkSvg` 结构自检**（NaN 坐标、标签缺失、非法路径），自检记录进 `solution.checks`。

## 2. 图类型（静态 8 种 + 动画 6 种）

| kind | 用途 | 主要参数 | 联动任务 |
|---|---|---|---|
| `section` | 立体斜截面（等轴测实体 + 红色截面曲线） | `fig, title, hint`（加 `sweep: true` 变扫掠动画） | `geometry.section` |
| `solids` | 常见几何体阵列（box/cylinder/cone/sphere） | `fig, title` | 实体认识课 |
| `incline` | 斜面滑块受力（重力/支持力箭头） | `angleDeg, namedForces, forces, blockLabel` | 力学题 |
| `circuit` | 串联电路（电源 + 矩形电阻 + 电流表） | `resistors: [R1, R2, ...]` | 电磁学题 |
| `optics` | 凸透镜光路（物/像/焦点/三条特殊光线） | `f, u` | 光学题 |
| `pulley` | 定滑轮与绳 | — | 力学题 |
| `plane-triangle` | 三角形与外接圆（2D 坐标系） | `points, xRange, yRange`（加 `compass: true` 变圆规动画） | `geometry.three-point-circle` |
| `curve` | 圆锥曲线（2D 坐标系） | `type, a, b, p, xRange, yRange` | `geometry.conic` |
| `motion` | 🎬 匀变速运动动画（斜面/自由落体，真实时间 + v 标尺游标） | `mode: 'incline'\|'freefall', a, v0, duration, angleDeg, length, dropHeight, vMax, unit` | 运动学/力学 |
| `circuit-flow` | 🎬 串联电路电流流动（3 个错相粒子，流速 ∝ I） | `resistors, current` | 电磁学题 |
| `optics-anim` | 🎬 凸透镜光路绘制 + 像点脉冲 | `f, u, objectHeight` | 光学题 |

动画的完整口径（SMIL 方案、模型驱动纪律、reduced-motion、tEnd 截断）见 **[animation.md](animation.md)**。

**截面图口径**（2026-10-21 起支持曲线体）：实体按 `kind` 分发渲染（box→长方体、cylinder→圆柱、cone→圆锥、sphere→球），截面叠加层按结果类型取点——多面体多边形用 `vertices`、曲线体完整截线用 `samples`（如圆柱斜截椭圆）、圆用 `circleRadius` 在平面内采样 48 点、圆锥轴截面三角形由底面弦两端 + 锥顶推出。fit 用实体**精确包围盒**（不再假设正方体）。

**curve 参数**：椭圆/双曲线传 `a`、`b`（默认 3、2），抛物线传 `p`（默认 4，y² = 2px，上下两支都画）；不传则用默认值。

**斜面几何口径**：楔块为直角三角形截面（x-z 平面）沿 y 宽度拉伸，斜边从 `(0, y, 0)` 升至 `(L·cosθ, y, L·sinθ)`，倾角即 `angleDeg`；滑块贴在斜面中线 `blockAt` 处（0=底端，1=顶端）。

受力两种给法：

- `namedForces: ["G", "N"]` —— 命名力，**G 竖直向下、N 沿斜面外法向**（自动从滑块中心出发，推荐）；
- `forces: [{from, to, label, color}]` —— 世界坐标起末点（高级用法；配合 `figureIncline` 返回的 `blockCenter()` / `normalDirection()` / `forceEnd(dir, len)` 计算）。

## 3. 卡片框构图（anatomy craft 口径）

`figureCard` 产出统一 680×420 卡片：

- **Fig n** 编号在左上角；
- **标题**在右上角；
- **提示**（hint）在左下角；
- **读数**（readout，一行结论）在右下角；
- 等轴测图自动 fit：世界坐标 → 相机投影 → 归一化缩放居中（用包围盒 8 角点计算，避免投影退化）。

`schematicCard` 用于 2D 装置图（电路/光路/滑轮），同样构图。

## 4. 等轴测相机

```js
import { createCamera, isoBox, figureCard } from './kit/figure.mjs'

const camera = createCamera({ azimuth: 45, elevation: 30, scale: 34 })
// camera.project([x,y,z]) → [sx, sy]     世界坐标 → 屏幕坐标
// camera.depth([x,y,z])   → number      画家排序键（大者先画）
// camera.viewDirection / camera.rightDirection
```

- `azimuth`：水平方位角（度），`elevation`：仰角，`scale`：像素/世界单位；
- **画家排序**：`sortScene(camera, [{at, svg}, ...])` 按深度排序后拼接，保证遮挡正确；
- **背面剔除**：`drawMesh` 只画法向朝向相机的面。

## 5. 四调着色

每个实体三面取不同明度（顶亮 / 右中 / 左暗），来自 anatomy 的"四调"轻量化：

```js
import { lighten, darken, PALETTE } from './kit/figure.mjs'
const top = lighten(base, 0.18)   // 顶面
const right = base                // 右面
const left = darken(base, 0.16)   // 左面
```

`PALETTE` 提供 ink/paper/accent/teal/amber/violet/red 等色板；线稿一律 `INK`，截面强调用 `red`。

## 6. 2D 坐标系（平面几何/解析几何）

```js
const plot = createPlot({ width: 640, height: 420, xRange: [-1, 7], yRange: [-1, 6] })
plotAxes(plot)                       // 带网格的坐标轴
plotPolyline(plot, [A, B, C], { close: true })
plotPoint(plot, [2, 3], 'A')         // 点 + 标签
plotCircle(plot, center, radius, { dash: '5 4' })
plotCurve(plot, (x) => x * x, { color: '#2563eb' })   // 返回 NaN 自动断线
plotRightAngle(plot, p, u, v)        // 直角符号
plotAngleArc(plot, vertex, from, to, { label: 'θ' })
```

## 7. 直接调用示例

```js
import { figureIncline, figureCard, createCamera } from './kit/figure.mjs'

// namedForces：G 竖直向下、N 沿斜面外法向，自动从滑块中心出发
const incline = figureIncline({ angleDeg: 30, namedForces: ['G', 'N'], blockLabel: 'm' })
const camera = createCamera({ azimuth: 42, elevation: 28, scale: 34 })
const svg = figureCard({
  fig: 1, title: '斜面上的滑块', hint: '受力与运动分析',
  readout: 'a = g·sinθ − μg·cosθ',
  width: 680, height: 420,
  world: incline.render(camera).join('\n'),
  fit: { points: incline.outlinePoints(), camera },
})

// 高级：自定义受力（世界坐标），端点用 forceEnd 计算
const g = { from: incline.blockCenter(), to: incline.forceEnd([0, 0, -1], 1.5), label: 'G', color: '#dc2626' }
const n = { from: incline.blockCenter(), to: incline.forceEnd(incline.normalDirection(), 1.5), label: 'N', color: '#2563eb' }
```

## 8. 示例产物

`examples/` 下十张图（`node scripts/demo.mjs` 重新生成；🎬 为 SMIL 动画，浏览器打开即播放）：

静态：

- `solid-section.svg` — 正方体斜截面（正六边形，≈ 5.196）；
- `kinematics-incline.svg` — 斜面滑块运动学（含 G/N 受力箭头）；
- `optics-lens.svg` — 凸透镜成像光路；
- `circuit-series.svg` — 串联电阻电路（人教版矩形电阻符号）。

动画：

- `anim-incline.svg` — 🎬 斜面匀加速下滑（真实时间 + v 标尺游标）；
- `anim-freefall.svg` — 🎬 自由落体；
- `anim-circuit-flow.svg` — 🎬 串联电路电流流动；
- `anim-optics-rays.svg` — 🎬 凸透镜光路绘制 + 像点脉冲；
- `anim-section-sweep.svg` — 🎬 圆柱斜截面扫掠形成；
- `anim-compass.svg` — 🎬 三点定圆圆规绘制。
