# 几何参考 — 任务 spec 与口径

本文件说明旧 `ProblemSpec` 固定任务。各节 givens 片段需放入完整的 `domain/task/givens` 对象后才能喂给 `scripts/solve.mjs`。新交互 HTML 使用 [LessonSpec](lessons.md)，不要混用两种格式。

发布包自带生成好的 `shared/geometry/` 内核。`kit/master-section.mjs` 负责适配坐标、分类及指标。`shared/manifest.json` 记录内核的源文件和生成文件哈希。修改或重新导出内核时，在包含 `src/domain/geometry/` 和 `scripts/build-solver-core.mjs` 的原开发仓库执行构建与 `--check`。本发布仓库可运行 `node solver-lab/scripts/agent.mjs --doctor` 检查安装文件。

## 1. `geometry.solid-metrics` — 实体度量

求长方体/棱柱/棱锥/棱台/圆柱/圆锥/圆台/球的体积、表面积、侧面积。

**spec**

```jsonc
{
  "domain": "geometry",
  "task": "geometry.solid-metrics",
  "givens": { "solid": { "kind": "<kind>", "<参数>": ... } }
}
```

参数表（`kind` 决定参数名，多余参数忽略，缺失抛错）：

| kind | 参数 | 说明 |
|---|---|---|
| `box` | `a, b, c` | 长方体三边长 |
| `cube` | `a` | 正方体（等价 a=b=c） |
| `prism` | `n, radius, height` | 正 n 棱柱，radius 为底面外接圆半径 |
| `pyramid` | `n, radius, height` | 正 n 棱锥 |
| `frustum` | `n, rBottom, rTop, height` | 正 n 棱台 |
| `cylinder` | `radius, height` | 圆柱 |
| `cone` | `radius, height` | 圆锥 |
| `conical-frustum` | `rBottom, rTop, height` | 圆台 |
| `sphere` | `radius` | 球 |

**输出要点**：`answer.metrics = { volume, surfaceArea, lateralArea, approximate, notes }`。`approximate: true` 表示含 π，summary 中带 ≈。教材里"底面边长"与外接圆半径的换算由出题人负责（s = 2R·sin(π/n)），skill 只接受外接圆半径口径，避免歧义。

## 2. `geometry.section` — 截面

**spec 两种给平面方式**

```jsonc
// 三点定面（多面体推荐）
{ "solid": { "kind": "box", "a": 2, "b": 2, "c": 2 },
  "plane": { "points": [[2,1,0],[2,0,1],[1,0,2]] } }

// 点 + 法向量（曲线体推荐）
{ "solid": { "kind": "sphere", "radius": 5 },
  "plane": { "point": [0,0,3], "normal": [0,0,1] } }
```

**截面口径**

- 凸多面体（box/prism/pyramid/frustum）：使用主项目截面算法提取有序边界，以浮点数计算面积并进行交叉核验；不是任意符号精确证明。边长与角度满足容差时识别正多边形（例如边长 2 的正方体，被经过 (2,1,0)、(2,0,1)、(1,0,2) 的平面截得正六边形；过同一顶点三棱中点则是三角形）；
- 球：小圆，`r = √(R² − d²)`，d 为球心到平面距离；
- 圆柱：轴截面或平行轴截面可能为矩形；完整斜椭圆使用主项目分类与面积。受上下底裁切的斜截面可能归为 `oblique-curve`，不能统一套完整椭圆公式；
- 圆锥：标准过顶截面、平行底面圆等沿用主项目分类；一般斜截可能是有效的 `oblique-curve`，不应冒称“不相交”或其他退化；
- 圆台：平行底面圆、标准轴截梯形等沿用主项目分类，一般裁切曲线可能为 `oblique-curve`；
- 退化（不相交、切点、切顶）→ `degeneracy !== 'none'`，给 explanation，**不编面积**；
- 适配层对一般 `oblique-curve` 保留真实边界，但把 `area/perimeter` 收窄为 `null`，不提供一般解析指标；`ellipse` 的周长同样为 `null`。主项目采样得到的数值不会被这里包装成解析精确值；圆及近似指标保留 `metricsApproximate/≈` 说明。

**自检**：多边形面积 Newell 法与投影鞋带公式交叉验证；正六边形与面积公式互证。

## 3. `geometry.triangle` — 三角形求解

```jsonc
{ "givens": { "mode": "sss", "a": 3, "b": 4, "c": 5 } }
{ "givens": { "mode": "sas", "a": 5, "C": 90, "b": 5 } }   // C 为夹角（度）
```

输出：三角（余弦定理）、面积（海伦公式）、类型（直角/等腰/等边/锐角/钝角）。自检：内角和 = 180°。

## 4. `geometry.circle-line` / `geometry.circle-circle` — 圆与点线关系

```jsonc
{ "givens": { "circle": { "center": [0,0], "radius": 5 },
              "line": { "p1": [0,-3], "p2": [4,0] } } }
{ "givens": { "c1": { "center": [0,0], "radius": 5 },
              "c2": { "center": [8,0], "radius": 3 } } }
```

直线-圆：相离/相切/相交 + 弦长（弦心距 d 与 r 比较）。两圆：外离/外切/相交/内切/内含 + 公共弦长。

## 5. `geometry.three-point-circle` — 三点定圆

```jsonc
{ "givens": { "points": [[0,0],[4,0],[2,3]] } }
```

输出外接圆 `{center, radius}`；共线时抛错（不猜圆）。自检：三点到圆心距离都等于 r。

## 6. `geometry.conic` — 圆锥曲线基本量

```jsonc
{ "givens": { "type": "ellipse",   "params": { "a": 5, "b": 3 } } }
{ "givens": { "type": "hyperbola", "params": { "a": 3, "b": 4 } } }
{ "givens": { "type": "parabola",  "params": { "p": 4 } } }
```

口径：中心/顶点在原点、焦点在 x 轴。椭圆/双曲线输出 a/b/c/e、焦点 (±c,0)、焦距；抛物线输出 p、焦点、准线。

## 7. `geometry.space-angle` — 空间角

```jsonc
{ "givens": { "kind": "directions", "d1": [1,0,0], "d2": [1,1,0] } }
{ "givens": { "kind": "line-plane", "direction": [1,0,1],
              "plane": { "point": [0,0,0], "normal": [0,0,1] } } }
{ "givens": { "kind": "dihedral",
              "plane1": { "point": [0,0,0], "normal": [0,0,1] },
              "plane2": { "point": [0,0,0], "normal": [1,0,0] } } }
```

异面直线所成角取锐角（方向向量夹角绝对值）；线面角 = 90° − 线与法向夹角；二面角 = 法向夹角。度数输出。

## 8. 精确数口径

- ProblemSpec 的长度和坐标等数值字段用 JSON 数字填写。比如边长 `3/4` 写为 `0.75`，边长 `√2` 可填写数值近似 `1.4142135623730951`。原题中的精确式保留在题干或推导中。
- `kit/num.mjs` 提供独立的精确数运算。几何任务的数值接口主要使用浮点计算，不能据此承诺符号化结果。经 `formatApprox` 显示的近似值带 `≈`。
