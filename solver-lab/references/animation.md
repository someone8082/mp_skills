# 现有简单SVG动画（SMIL）

本页描述ProblemSpec已有的简单动画：滑块下滑、电流流动、光路绘制、截面扫掠、圆规画圆。产物是**单个带动画的 SVG 文件**，不需要JavaScript；是否播放取决于打开它的宿主。

需要暂停、拖动时间轴、阶段跳转与动态文字读数的综合题，可按 [模型驱动的交互演示](model-driven-animation.md) 制作独立HTML/SVG。不要把本页的SVG文件选型当成禁止HTML，也不要将复杂电磁场题硬套 `motion`。

## 1. 技术选型：SVG 原生 SMIL

| 方案 | 结论 |
|---|---|
| SMIL（`<animate>`/`<animateTransform>`/`<animateMotion>`） | 现有SVG场景采用；不依赖JS，但静态图片或受限聊天预览未必播放 |
| requestAnimationFrame + JS | 独立HTML播放器可采用；适合时间轴、分段事件和同步读数，需允许执行内嵌脚本 |
| 逐帧静态 SVG 序列 | 通常不选：重复数据大；优先保存模型并在本地计算 |

现有CLI简单场景输出SMIL，自定义HTML保持同样的模型驱动原则；两者都可离线交付，但不代表任意聊天平台均可预览。

## 2. 核心纪律：模型驱动

与 anatomy「every number the figure shows comes from the same small model that moves its parts」同口径，并延续本 skill 的确定性纪律：

- **values 由模型函数采样产生**（`modelTrack({ at })`）；浏览器在样本间插值，需区别绘图近似与精确模型，不能手调轨迹凑答案；
- 运动学模型使用 `s(t) = v₀t + ½at²`、`v(t) = v₀ + at`，物理时间用linear。默认按模型秒播放；变速或归一化须标明，不能额外缓动时间来改变运动规律；
- 电路粒子是电流方向/大小的教学示意，循环周期有显示限幅，不表示电子实际运动速度；像点位置由透镜公式 `1/f = 1/u + 1/v` 定；截面扫掠起止由平面法向与实体包围盒定；
- 单元测试对末帧做**手算数值断言**（屏幕位移、游标位置、周期），模型改了测试会红。

## 3. figure kind 一览

| kind | 用途 | 关键参数 | 联动任务 |
|---|---|---|---|
| `motion`（mode: `incline`） | 斜面匀加速下滑：滑块 + G/N 随动 + v 标尺游标 | `a, v0, duration, angleDeg, length, vMax, unit, blockLabel` | 运动学/力学 |
| `motion`（mode: `freefall`） | 自由落体：释放点、下落小球和速度游标 | `a, v0, duration, dropHeight, vMax, unit` | 运动学 |
| `circuit-flow` | 串联电路电流流动：3 个错相粒子沿回路循环 | `resistors, current` | 电磁学 |
| `optics-anim` | 凸透镜光路：三条特殊光线依次画出 + 像点脉冲 | `f, u, objectHeight` | 光学 |
| `section` + `sweep: true` | 截面扫掠：截平面沿法向扫入，到位后截面显现 | `sweep` | `geometry.section` |
| `plane-triangle` + `compass: true` | 三点定圆：半径线旋转扫过 + 圆 0→R + 圆心脉冲 | `compass` | `geometry.three-point-circle` |

## 4. 通用行为约定

- **运动方向与时长**：下滑或下落为正方向，初速度须非负。播放区间在题设时长、到达底端或减速至静止三者中最早的时间结束。
- **速度标尺**：速度游标和刻度共用同一条标尺。速度值超出指定标尺上限时，生成器调整上限以容纳整个运动区间。
- **循环与单次**：运动、电流和扫掠循环播放。光线和圆规描线播放一次并保留完成画面。
- 上述循环是现有SVG场景的重演，终点回初态不是连续物理运动；自定义综合题播放器按交互参考默认暂停、终点停止。
- **减少动态**：在支持该设置的浏览器中，运动图显示初始状态，电路保留静态符号和方向，光路、圆规和截面图显示完成状态。
- **自检**：`checkSvg` 检查基本文档边界和异常数值字样。方向、计算模型和宿主播放需要单独测试。

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

从仓库根目录运行 `node solver-lab/scripts/solve.mjs spec.json --figure out.svg`，再用支持 SMIL 的浏览器打开 `out.svg`。

## 6. examples/ 动画清单

- `anim-incline.svg` — 斜面匀加速下滑（真实时间 + v 标尺游标）
- `anim-freefall.svg` — 自由落体（v = gt）
- `anim-circuit-flow.svg` — 串联电路电流流动（流速 ∝ I）
- `anim-optics-rays.svg` — 逐条展示凸透镜光路和像
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
