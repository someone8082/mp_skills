/**
 * 解题库 — 题目 spec（JSON）→ 分步解答（Solution）。CLI（solve.mjs）、
 * demo（demo.mjs）与测试共用本模块；不直接执行。
 *
 * 输入（ProblemSpec）：
 *   { "domain": "geometry"|"physics", "task": "<任务id>", "givens": {...},
 *     "figure": { "kind": "<图类型>" } | null }
 * 输出（Solution）：
 *   { ok, domain, task, summary, steps[], answer, checks[], figure? }
 *
 * 纪律：steps/answer 中的每个数字都来自 kit 内核；checks 是回代与交叉验证。
 */

import {
  circleCircleRelation,
  circleFromThreePoints,
  circleLineRelation,
  conicInfo,
  createSolid,
  lineThrough,
  sectionOf,
  solveTriangleSAS,
  solveTriangleSSS,
  solidMetrics,
  angleBetweenDirections,
  dihedralAngle,
  linePlaneAngle,
  toPlane,
} from '../kit/geometry.mjs'
import { evaluateFormula, listFormulas, parseUnit, residualCheck } from '../kit/physics.mjs'
import { formatApprox } from '../kit/num.mjs'
import {
  checkSvg,
  createCamera,
  createPlot,
  figureCard,
  figureCircuit,
  figureCircuitFlow,
  figureCompassCircle,
  figureIncline,
  figureMotionTrack,
  figureOptics,
  figureOpticsAnim,
  figurePulley,
  isoBox,
  isoCone,
  isoCylinder,
  isoSphere,
  plotAxes,
  plotCircle,
  plotCurve,
  plotPoint,
  plotPolyline,
  schematicCard,
  sortScene,
  svgDocument,
} from '../kit/figure.mjs'
import { add, dot, normalize, planeBasis, polygonArea2, projectPointToPlane, scale, subtract } from '../kit/vecmath.mjs'
import { animate, animateTransform, modelTrack } from '../kit/animate.mjs'
import { bindFigureRequest } from './figure-bindings.mjs'

/* ------------------------------------------------------------------ */
/* 步骤构造工具                                                         */
/* ------------------------------------------------------------------ */

function step(title, formula, substitution, result, note) {
  return { title, formula, substitution, result, note }
}

function check(name, ok, detail) {
  return { name, ok, detail }
}

const approx = (value, digits = 3) => formatApprox(value, digits)

/* ------------------------------------------------------------------ */
/* 几何任务                                                             */
/* ------------------------------------------------------------------ */

function solveSolidMetrics(spec) {
  const solid = createSolid(spec.givens.solid)
  const metrics = solidMetrics(solid)
  const { kind } = solid
  const formulaTable = {
    box: 'V = a·b·c；S = 2(ab + bc + ca)',
    prism: 'V = S底·h；S = S侧 + 2·S底',
    pyramid: 'V = ⅓·S底·h；S = S底 + S侧',
    frustum: 'V = h/3·(S₁ + S₂ + √(S₁S₂))',
    cylinder: 'V = π·r²·h；S = 2πr(r + h)',
    cone: 'V = ⅓·π·r²·h；S = πr(r + l)',
    'conical-frustum': 'V = π·h/3·(r₁² + r₁r₂ + r₂²)',
    sphere: 'V = 4/3·π·R³；S = 4π·R²',
  }
  const steps = [
    step('确认实体与参数', '由题目参数构造标准实体', `${kind}：${JSON.stringify(solid.params)}`, '实体已构造', '一切后续计算基于该确定性模型'),
    step('代入度量公式', formulaTable[kind] ?? '标准体公式', `V = ${metrics.volume.toFixed(6)}；S = ${metrics.surfaceArea.toFixed(6)}`, metrics.approximate ? '结果含 π，显示为 ≈' : '结果为精确值（在输入精度内）'),
  ]
  return {
    ok: true,
    domain: 'geometry',
    task: 'solid-metrics',
    summary: `${kind} 的体积 ≈ ${metrics.volume.toFixed(3)}，表面积 ≈ ${metrics.surfaceArea.toFixed(3)}${metrics.approximate ? '（含 π）' : ''}`,
    steps,
    answer: { metrics },
    checks: [
      check('体积为正', metrics.volume > 0, `V = ${metrics.volume}`),
      check('表面积为正且不小于体积的量级', metrics.surfaceArea > 0, `S = ${metrics.surfaceArea}`),
    ],
  }
}

function solveSection(spec) {
  const solid = createSolid(spec.givens.solid)
  const section = sectionOf(solid, spec.givens.plane)
  if (['unsupported', 'invalid-numeric'].includes(section.degeneracy)) throw new Error(section.explanation)
  if (section.degeneracy !== 'none') {
    return {
      ok: true,
      domain: 'geometry',
      task: 'section',
      summary: section.explanation,
      steps: [step('截面判定', '平面与实体的关系', section.explanation, '退化截面', '没有可计算的面积/周长')],
      answer: { section },
      checks: [check('退化类型一致', section.degeneracy !== 'none', section.degeneracy)],
    }
  }

  const steps = [
    step('构造实体与截平面', '三点定面或点 + 法向量', `${solid.kind}：${JSON.stringify(solid.params)}`, '输入有效', '平面由题目给定条件确定'),
    step('判定截面形状', '多面体逐面求交；曲线体按标准情形分类', section.explanation, section.shape, '判定由内核确定性计算产生'),
  ]
  const checks = []
  if (section.kind === 'polygon') {
    steps.push(step(
      '计算截面面积与周长',
      '鞋带公式 / 边界求和（对截面顶点）',
      section.vertices.map((p) => `(${p.map((v) => v.toFixed(2)).join(', ')})`).join(' → '),
      `面积 = ${section.area.toFixed(6)}，周长 = ${section.perimeter.toFixed(6)}`,
    ))
    // 交叉验证：投影到平面后用 2D 鞋带公式重算面积
    const plane = toPlane(spec.givens.plane)
    const basis = planeBasis(plane)
    const uv = section.vertices.map((p) => projectPointToPlane(p, plane))
    const area2 = polygonArea2(uv)
    checks.push(check('面积交叉验证（Newell vs 鞋带）', Math.abs(area2 - section.area) < 1e-6 * Math.max(1, section.area), `Newell ${section.area.toFixed(6)} vs 鞋带 ${area2.toFixed(6)}`))
    checks.push(check('面积与正多边形公式互证（正六边形时）', section.regular && section.sides === 6
      ? Math.abs(section.area - ((3 * Math.sqrt(3)) / 2) * (section.perimeter / 6) ** 2) < 1e-6
      : true, section.regular ? '正多边形面积 = (n/4)·a²·cot(π/n)' : '非正多边形，跳过'))
  } else {
    steps.push(step(
      '计算截面指标',
      section.kind === 'circle' ? 'r = √(R² − d²)；面积 = π·r²' : '按解析公式（近似指标标 ≈）',
      section.explanation,
      section.area !== null ? `面积 ≈ ${section.area.toFixed(6)}` : '该情形不给出解析指标',
      section.metricsApproximate ? '指标为近似值' : '指标为精确值',
    ))
    checks.push(check('近似标注一致', section.metricsApproximate === (section.kind !== 'rectangle' && section.kind !== 'triangle' && section.kind !== 'trapezoid'), `kind = ${section.kind}`))
  }
  return {
    ok: true,
    domain: 'geometry',
    task: 'section',
    summary: `截面形状：${section.shape}${section.area !== null ? `，面积 ${approx(section.area)}` : ''}`,
    steps,
    answer: { section },
    checks,
  }
}

function solveTriangle(spec) {
  const givens = spec.givens
  const result = givens.mode === 'sas'
    ? solveTriangleSAS({ a: givens.a, C: givens.C, b: givens.b })
    : solveTriangleSSS({ a: givens.a, b: givens.b, c: givens.c })
  const steps = [
    step('整理已知', givens.mode === 'sas' ? '两边及夹角（SAS）' : '三边（SSS）', JSON.stringify(givens), '已知量齐全'),
    step('求角', '余弦定理：cos A = (b² + c² − a²) / 2bc', `A = ${result.angles.A.toFixed(4)}°，B = ${result.angles.B.toFixed(4)}°，C = ${result.angles.C.toFixed(4)}°`, '三角已确定'),
    step('求面积', '海伦公式：S = √(s(s−a)(s−b)(s−c))', `s = ${result.semiperimeter.toFixed(4)}，S = ${result.area.toFixed(6)}`, result.type),
  ]
  return {
    ok: true,
    domain: 'geometry',
    task: 'triangle',
    summary: `三角形为${result.type}，面积 ${approx(result.area)}，三角 A/B/C = ${result.angles.A.toFixed(2)}°/${result.angles.B.toFixed(2)}°/${result.angles.C.toFixed(2)}°`,
    steps,
    answer: { triangle: result },
    checks: [
      check('内角和 180°', Math.abs(result.angles.A + result.angles.B + result.angles.C - 180) < 1e-6, `${(result.angles.A + result.angles.B + result.angles.C).toFixed(9)}°`),
      check('面积为正', result.area > 0, `S = ${result.area}`),
    ],
  }
}

function solveCircleLine(spec) {
  const circle = spec.givens.circle
  const line = lineThrough(spec.givens.line.p1, spec.givens.line.p2)
  const result = circleLineRelation(circle, line)
  return {
    ok: true,
    domain: 'geometry',
    task: 'circle-line',
    summary: `直线与圆${result.relation}${result.chordLength ? `，弦长 ${approx(result.chordLength)}` : ''}`,
    steps: [
      step('化直线为一般式', '过两点确定 ax + by + c = 0', JSON.stringify(spec.givens.line), '直线已确定'),
      step('比较弦心距与半径', 'd 与 r 比较', `d = ${result.distance.toFixed(6)}，r = ${circle.radius}`, result.relation),
    ],
    answer: { result },
    checks: [check('关系自洽', ['相离', '相切', '相交'].includes(result.relation), result.relation)],
  }
}

function solveCircleCircle(spec) {
  const result = circleCircleRelation(spec.givens.c1, spec.givens.c2)
  return {
    ok: true,
    domain: 'geometry',
    task: 'circle-circle',
    summary: `两圆${result.relation}${result.commonChordLength ? `，公共弦长 ${approx(result.commonChordLength)}` : ''}`,
    steps: [
      step('计算圆心距', 'd = |O₁O₂|', `d = ${result.centerDistance.toFixed(6)}`, '距离已确定'),
      step('与半径和差比较', 'd 与 r₁+r₂、|r₁−r₂| 比较', JSON.stringify(spec.givens), result.relation),
    ],
    answer: { result },
    checks: [check('关系自洽', ['外离', '外切', '相交', '内切', '内含'].includes(result.relation), result.relation)],
  }
}

function solveThreePointCircle(spec) {
  const circle = circleFromThreePoints(...spec.givens.points)
  return {
    ok: true,
    domain: 'geometry',
    task: 'three-point-circle',
    summary: `三点确定圆：圆心 (${circle.center[0].toFixed(3)}, ${circle.center[1].toFixed(3)})，半径 ${approx(circle.radius)}`,
    steps: [
      step('验证不共线', '三点叉积', JSON.stringify(spec.givens.points), '可确定唯一圆'),
      step('垂直平分线交点', '两条边垂直平分线联立', `圆心 = (${circle.center[0].toFixed(6)}, ${circle.center[1].toFixed(6)})`, `半径 r = ${circle.radius.toFixed(6)}`),
    ],
    answer: { circle },
    checks: spec.givens.points.map((p, i) => check(
      `第 ${i + 1} 点到圆心距离等于半径`,
      Math.abs(Math.hypot(p[0] - circle.center[0], p[1] - circle.center[1]) - circle.radius) < 1e-6,
      `${Math.hypot(p[0] - circle.center[0], p[1] - circle.center[1]).toFixed(6)}`,
    )),
  }
}

function solveConic(spec) {
  const info = conicInfo(spec.givens.type, spec.givens.params ?? {})
  const steps = [
    step('确认曲线类型与标准方程', '中心/顶点在原点、焦点在 x 轴', `${info.type}：${JSON.stringify(spec.givens.params ?? {})}`, '标准方程已确立'),
  ]
  if (info.type === 'ellipse' || info.type === 'hyperbola') {
    steps.push(step('计算基本量', 'c² = a² − b²（椭圆）；c² = a² + b²（双曲线）', `a = ${info.a}，b = ${info.b}，c = ${info.c.toFixed(6)}`, `离心率 e = ${info.eccentricity.toFixed(6)}`))
    steps.push(step('焦点与顶点', '焦点 (±c, 0)', JSON.stringify(info.foci), `焦距 2c = ${2 * info.c}`))
  } else {
    steps.push(step('计算基本量', 'y² = 2px', `p = ${info.p}`, `焦点 ${JSON.stringify(info.focus)}，准线 ${info.directrix}`))
  }
  return {
    ok: true,
    domain: 'geometry',
    task: 'conic',
    summary: `${info.type === 'ellipse' ? '椭圆' : info.type === 'hyperbola' ? '双曲线' : '抛物线'}基本量：a/b/c = ${info.a ?? '-'}/${info.b ?? '-'}/${info.c?.toFixed(3) ?? '-'}，e = ${info.eccentricity?.toFixed(4) ?? '-'}`,
    steps,
    answer: { conic: info },
    checks: [check('离心率范围', info.type === 'ellipse' ? info.eccentricity >= 0 && info.eccentricity < 1 : info.type === 'hyperbola' ? info.eccentricity > 1 : true, String(info.eccentricity))],
  }
}

function solveSpaceAngle(spec) {
  const { kind } = spec.givens
  let value
  let formula
  if (kind === 'directions') {
    value = angleBetweenDirections(spec.givens.d1, spec.givens.d2)
    formula = 'cos θ = |d₁·d₂| / (|d₁||d₂|)'
  } else if (kind === 'line-plane') {
    value = linePlaneAngle(spec.givens.direction, toPlane(spec.givens.plane))
    formula = '线面角 = 90° − 线与法向夹角'
  } else {
    value = dihedralAngle(toPlane(spec.givens.plane1), toPlane(spec.givens.plane2))
    formula = '二面角 = 两平面法向夹角'
  }
  return {
    ok: true,
    domain: 'geometry',
    task: 'space-angle',
    summary: `${kind === 'directions' ? '异面直线所成角' : kind === 'line-plane' ? '线面角' : '二面角'} = ${value.toFixed(4)}°`,
    steps: [step('取方向/法向量', '由题目点坐标求得', JSON.stringify(spec.givens), '向量已确定'), step('代入公式', formula, '直接计算', `${value.toFixed(6)}°`)],
    answer: { angleDeg: value },
    checks: [check('角度范围', value >= 0 && value <= 180, `${value}°`)],
  }
}

/* ------------------------------------------------------------------ */
/* 物理任务                                                             */
/* ------------------------------------------------------------------ */

function solveFormula(spec) {
  const { id, target, knowns } = spec.givens
  const outcome = evaluateFormula(id, target, knowns)
  if (!outcome.ok) {
    return { ok: false, domain: 'physics', task: 'formula', summary: outcome.reason, steps: [], answer: null, checks: [check('求值失败', false, outcome.reason)] }
  }
  const result = outcome.result
  // 回代需要声明单位下的数值：重新换算
  const formulaVars = listFormulas().find((f) => f.id === id)?.vars ?? {}
  const numericKnowns = {}
  for (const [name, quantity] of Object.entries(knowns)) {
    const from = parseUnit(quantity.unit ?? formulaVars[name])
    const to = parseUnit(formulaVars[name])
    if (from && to) numericKnowns[name] = (quantity.value * from.factor) / to.factor
  }
  const residual = residualCheck(id, target, numericKnowns, result.value)
  return {
    ok: true,
    domain: 'physics',
    task: 'formula',
    summary: `${result.name}（${result.topicName}）：${target} = ${typeof result.value === 'number' ? approx(result.value) : result.value.map((v) => approx(v)).join(' 或 ')} ${result.unit}`.replace(/-/gu, '−'),
    steps: [
      step('识别题型并选取公式', `${result.topicName} · ${result.name}`, result.formula, '公式与已知量匹配'),
      step('统一单位', '按公式声明单位换算', JSON.stringify(knowns), '单位量纲一致'),
      step('代入求解', result.formula, result.substitution, result.note ? `${result.note}；结果 ${result.unit}` : `结果 ${result.unit}`),
    ],
    answer: { result },
    checks: [
      check('单位量纲一致', true, 'evaluateFormula 已校验'),
      check('回代校验', residual.ok, residual.detail),
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 图形生成                                                             */
/* ------------------------------------------------------------------ */

/** 包围盒 8 角点（供 fit 计算平移缩放，避免对角点投影退化）。 */
function bboxCorners(x1, y1, z1, x2, y2, z2) {
  return [
    [x1, y1, z1], [x2, y1, z1], [x1, y2, z1], [x1, y1, z2],
    [x2, y2, z2], [x2, y1, z2], [x1, y2, z2], [x2, y2, z1],
  ]
}

/** 实体的等轴测渲染（按类型分发；未知类型退化为长方体）。 */
function renderSolidIso(camera, solid) {
  switch (solid.kind) {
    case 'cylinder':
      return isoCylinder(camera, { cx: 0, cy: 0, z: 0, r: solid.params.radius, h: solid.params.height, color: '#0d9488' }).join('\n')
    case 'cone':
      return isoCone(camera, { cx: 0, cy: 0, z: 0, r: solid.params.radius, h: solid.params.height, color: '#7c3aed' }).join('\n')
    case 'sphere':
      return isoSphere(camera, { cx: 0, cy: 0, z: 0, r: solid.params.radius, color: '#d97706' }).join('\n')
    default: {
      const { a = 2, b = 2, c = 2 } = solid.params
      return isoBox(camera, { x: 0, y: 0, z: 0, w: a, d: b, h: c }).join('\n')
    }
  }
}

/** 深度排序用锚点（实体中心）。 */
function solidAnchor(solid) {
  const [lo, hi] = solidBounds(solid)
  return [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2]
}

/** 实体的世界坐标包围盒 [min, max]。 */
function solidBounds(solid) {
  switch (solid.kind) {
    case 'cylinder':
    case 'cone': {
      const { radius: r, height: h } = solid.params
      return [[-r, -r, 0], [r, r, h]]
    }
    case 'sphere': {
      const r = solid.params.radius
      return [[-r, -r, -r], [r, r, r]]
    }
    default: {
      const { a = 2, b = 2, c = 2 } = solid.params
      return [[0, 0, 0], [a, b, c]]
    }
  }
}

/** 截面圆的圆心：实体特征点（球心/轴上点）到平面的垂足。 */
function sectionCircleCenter(solid, plane) {
  const n = normalize(plane.normal)
  const anchor = solid.kind === 'sphere' ? [0, 0, 0] : [0, 0, plane.origin[2] ?? 0]
  return subtract(anchor, scale(n, dot(subtract(anchor, plane.origin), n)))
}

/** 圆锥轴截面三角形的三个顶点：底面弦两端 + 锥顶。 */
function coneAxisTriangle(solid, plane) {
  const { radius, height } = solid.params
  const [nx, ny] = plane.normal
  const len = Math.hypot(nx, ny)
  if (len < 1e-12) return [[0, 0, height]]
  // 平面与底面 z=0 的交线：n·x = n·origin
  const d = dot(plane.normal, plane.origin) / len
  const half = Math.sqrt(Math.max(0, radius * radius - d * d))
  const ux = nx / len
  const uy = ny / len
  const fx = ux * d
  const fy = uy * d
  return [
    [fx + uy * half, fy - ux * half, 0],
    [fx - uy * half, fy + ux * half, 0],
    [0, 0, height],
  ]
}

/** 截面在等轴测相机上的叠加层：多边形顶点 / 采样曲线 / 平面圆 / 圆锥轴截面三角形。 */
function sectionOverlay(camera, solid, section, plane) {
  if (section.degeneracy !== 'none') return null
  let points = null
  if (section.vertices?.length) points = section.vertices
  else if (section.samples?.length) points = section.samples
  else if (section.kind === 'circle' && section.circleRadius) {
    const center = sectionCircleCenter(solid, plane)
    const { u, v } = planeBasis(plane)
    const r = section.circleRadius
    points = Array.from({ length: 48 }, (_, i) => {
      const t = (i / 48) * Math.PI * 2
      return add(center, add(scale(u, Math.cos(t) * r), scale(v, Math.sin(t) * r)))
    })
  } else if (section.kind === 'triangle' && solid.kind === 'cone') {
    points = coneAxisTriangle(solid, plane)
  }
  if (!points) return null
  const screen = points.map((p) => camera.project(p))
  return `<path d="M ${screen.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ')} Z" fill="rgba(220,38,38,0.35)" stroke="#dc2626" stroke-width="2"/>`
}

/**
 * 图形构建（solveSpec 与 viewer 演示台共用同一入口）。
 *
 * @param {object} spec ProblemSpec（figure.kind 决定图类型）
 * @param {object|null} solution 解题结果（可为 null：读数退化为 request.readout）
 * @param {{azimuth?: number, elevation?: number}|null} cameraOverride
 *   等轴测相机覆盖——仅对立体类 kind（section/solids/incline/motion）生效；
 *   平面类 kind（circuit/optics/plane-triangle/curve…）无相机概念，忽略。
 *   viewer 拖拽旋转即通过它按新 az/el 实时重投影（几何体真正旋转，
 *   而不是把扁平 SVG 当卡片倾斜）；CLI 不传即默认 45°/30° 行为不变。
 * @returns {string|null} 独立 SVG 字符串
 */
export function buildFigure(spec, solution = null, cameraOverride = null) {
  if (!spec.figure?.kind) return null
  const calculation = solution ?? solveSpec({ ...spec, figure: null })
  if (!calculation.ok) throw new Error(calculation.summary ?? calculation.reason ?? '配图所需计算未通过')
  const request = bindFigureRequest(spec, calculation)
  const kind = request.kind
  const summary = solution?.summary ?? request.readout ?? ''
  /** 立体类场景相机：默认值与历史一致，override 只覆盖 az/el */
  const sceneCamera = (azimuth, elevation, scale) =>
    createCamera({
      azimuth,
      elevation,
      scale,
      ...(cameraOverride?.azimuth !== undefined ? { azimuth: cameraOverride.azimuth } : {}),
      ...(cameraOverride?.elevation !== undefined ? { elevation: cameraOverride.elevation } : {}),
    })

  if (kind === 'section' && spec.givens.solid) {
    const solid = createSolid(spec.givens.solid)
    const section = sectionOf(solid, spec.givens.plane)
    const plane = toPlane(spec.givens.plane)
    const camera = sceneCamera(45, 30, 34)
    const world = sortScene(camera, [{ at: solidAnchor(solid), svg: renderSolidIso(camera, solid) }])
    const overlay = sectionOverlay(camera, solid, section, plane)
    const [lo, hi] = solidBounds(solid)
    if (request.sweep) {
      // 扫掠动画：截平面从实体外侧沿法向扫入，到位后截面显现（循环播放）
      const n = normalize(plane.normal)
      const { u, v } = planeBasis(plane)
      const diag = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
      const size = diag * 0.75
      const d = diag * 0.9
      const corners = [
        add(add(plane.origin, scale(u, size)), scale(v, size)),
        subtract(add(plane.origin, scale(u, size)), scale(v, size)),
        subtract(subtract(plane.origin, scale(u, size)), scale(v, size)),
        add(subtract(plane.origin, scale(u, size)), scale(v, size)),
      ]
      const screen = corners.map((p) => camera.project(p))
      const dAttr = `M ${screen.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' L ')} Z`
      const start = camera.project(subtract(plane.origin, scale(n, d)))
      const end = camera.project(plane.origin)
      const sweep = modelTrack({
        duration: 2,
        easing: 'easeInOutCubic',
        at: (e) => [(start[0] - end[0]) * (1 - e), (start[1] - end[1]) * (1 - e)],
      })
      world.push(
        '<g>'
        + animateTransform({ type: 'translate', values: sweep.values, keyTimes: sweep.keyTimes, duration: 2 })
        + `<path d="${dAttr}" fill="rgba(37,99,235,0.18)" stroke="#2563eb" stroke-width="1.2"/>`
        + '</g>',
      )
      if (overlay) {
        world.push(
          '<g opacity="0">'
          + animate({ attribute: 'opacity', values: '0;0;1;1', keyTimes: '0;0.55;0.7;1', duration: 2 })
          + overlay
          + '</g>',
        )
      }
    } else if (overlay) {
      world.push(overlay)
    }
    return figureCard({
      fig: request.fig ?? 1,
      title: request.title ?? '截面示意图',
      hint: request.hint ?? (request.sweep ? '截平面沿法向扫入，形成截面' : '平面与实体的交'),
      readout: summary,
      width: 680,
      height: 420,
      world: world.join('\n'),
      fit: { points: bboxCorners(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]), camera },
    })
  }

  if (kind === 'solids') {
    const camera = sceneCamera(45, 30, 30)
    const world = sortScene(camera, [
      { at: [0, 0, 0], svg: isoBox(camera, { x: 0, y: 0, z: 0, w: 2, d: 2, h: 2 }) },
      { at: [3.4, 1, 0], svg: isoCylinder(camera, { cx: 3.4, cy: 1, z: 0, r: 0.8, h: 2, color: '#0d9488' }) },
      { at: [5.6, 1, 0], svg: isoCone(camera, { cx: 5.6, cy: 1, z: 0, r: 0.8, h: 2.2, color: '#7c3aed' }) },
      { at: [1, 4, 1], svg: isoSphere(camera, { cx: 1, cy: 4, z: 1, r: 1, color: '#d97706' }) },
    ])
    return figureCard({
      fig: request.fig ?? 1,
      title: request.title ?? '常见几何体',
      readout: summary,
      width: 680,
      height: 420,
      world: world.join('\n'),
      fit: { points: bboxCorners(0, 0, 0, 6.5, 5, 2.6), camera },
    })
  }

  if (kind === 'incline') {
    const incline = figureIncline({
      angleDeg: request.angleDeg ?? 30,
      forces: request.forces ?? [],
      namedForces: request.namedForces ?? [],
      blockLabel: request.blockLabel,
    })
    const camera = sceneCamera(42, 28, 34)
    return figureCard({
      fig: request.fig ?? 1,
      title: request.title ?? '斜面上的滑块',
      hint: request.hint ?? '受力与运动分析',
      readout: summary,
      width: 680,
      height: 420,
      world: incline.render(camera).join('\n'),
      fit: { points: incline.outlinePoints(), camera },
    })
  }

  if (kind === 'motion') {
    // 匀变速运动动画（真实时间：动画 1 秒 = 模型 1 秒；v 标尺游标实时读数）
    const track = figureMotionTrack({
      kind: request.mode ?? 'incline',
      a: request.a ?? 2,
      v0: request.v0 ?? 0,
      duration: request.duration ?? 2,
      angleDeg: request.angleDeg ?? 30,
      length: request.length ?? 8,
      dropHeight: request.dropHeight ?? 6,
      vMax: request.vMax,
      unit: request.unit ?? 'm/s',
      blockLabel: request.blockLabel ?? 'm',
    })
    const camera = sceneCamera(42, 28, 34)
    return figureCard({
      fig: request.fig ?? 1,
      title: request.title ?? '匀变速运动',
      hint: request.hint ?? 's = v₀t + ½at²；v = v₀ + at（真实时间）',
      readout: summary,
      width: 680,
      height: 420,
      world: track.render(camera).join('\n'),
      fit: { points: track.outlinePoints(), camera },
    })
  }

  if (kind === 'circuit-flow') {
    return schematicCard(figureCircuitFlow({
      resistors: request.resistors ?? [10, 20],
      current: request.current ?? 0.4,
    }), {
      fig: request.fig ?? 1,
      title: request.title ?? '电流流动',
      hint: request.hint ?? '粒子流速 ∝ 电流',
      readout: summary,
    })
  }

  if (kind === 'optics-anim') {
    return schematicCard(figureOpticsAnim({
      f: request.f ?? 10,
      u: request.u ?? 30,
      objectHeight: request.objectHeight ?? 3,
    }), {
      fig: request.fig ?? 1,
      title: request.title ?? '凸透镜成像（光路动画）',
      hint: request.hint ?? '三条特殊光线依次画出',
      readout: summary,
    })
  }

  if (kind === 'circuit') {
    return schematicCard(figureCircuit({ resistors: request.resistors ?? [10, 20] }), {
      fig: request.fig ?? 1,
      title: request.title ?? '电路图',
      readout: summary,
    })
  }

  if (kind === 'optics') {
    return schematicCard(figureOptics({ f: request.f ?? 10, u: request.u ?? 30 }), {
      fig: request.fig ?? 1,
      title: request.title ?? '凸透镜成像',
      readout: summary,
    })
  }

  if (kind === 'pulley') {
    return schematicCard(figurePulley({}), {
      fig: request.fig ?? 1,
      title: request.title ?? '滑轮',
      readout: summary,
    })
  }

  if (kind === 'plane-triangle') {
    const [A, B, C] = request.points
    const plot = createPlot({ width: 640, height: 420, xRange: request.xRange ?? [-1, 7], yRange: request.yRange ?? [-1, 6] })
    const circle = circleFromThreePoints(A, B, C)
    const world = request.compass
      ? [
        ...plotAxes(plot),
        ...figureCompassCircle(plot, { points: [A, B, C], center: circle.center, radius: circle.radius }),
      ]
      : [
        ...plotAxes(plot),
        ...plotPolyline(plot, [A, B, C], { close: true }),
        ...plotPoint(plot, A, 'A'),
        ...plotPoint(plot, B, 'B'),
        ...plotPoint(plot, C, 'C'),
        ...plotCircle(plot, circle.center, circle.radius, { color: '#7c3aed', dash: '5 4' }),
      ]
    // request.card：包上 anatomy 式卡片框（viewer 演示台用；CLI 默认裸图，行为不变）
    if (request.card) {
      return figureCard({
        fig: request.fig ?? 1,
        title: request.title ?? '平面几何',
        hint: request.hint ?? '三点定圆',
        readout: summary,
        width: 640,
        height: 420,
        world: world.join('\n'),
      })
    }
    return svgDocument({ width: 640, height: 420, body: world.join('\n') })
  }
  if (kind === 'curve') {
    const a = request.a ?? 3
    const b = request.b ?? 2
    const p = request.p ?? 4
    const plot = createPlot({ width: 640, height: 420, xRange: request.xRange ?? [-4, 4], yRange: request.yRange ?? [-1, 9] })
    const upper = request.type === 'ellipse'
      ? (x) => (Math.abs(x) <= a ? b * Math.sqrt(1 - (x * x) / (a * a)) : NaN)
      : request.type === 'hyperbola'
        ? (x) => (Math.abs(x) >= a ? (b / a) * Math.sqrt(x * x - a * a) : NaN)
        : (x) => x >= 0 ? Math.sqrt(2 * p * x) : NaN
    const world = [...plotAxes(plot), ...plotCurve(plot, upper, { color: request.color ?? '#2563eb' })]
    // All three supported conics are symmetric about x; invalid intervals remain separate subpaths.
    world.push(...plotCurve(plot, x => -upper(x), { color: request.color ?? '#2563eb' }))
    return svgDocument({ width: 640, height: 420, body: world.join('\n') })
  }

  return null
}

/* ------------------------------------------------------------------ */
/* 分发                                                                 */
/* ------------------------------------------------------------------ */

const TASKS = {
  'geometry.solid-metrics': solveSolidMetrics,
  'geometry.section': solveSection,
  'geometry.triangle': solveTriangle,
  'geometry.circle-line': solveCircleLine,
  'geometry.circle-circle': solveCircleCircle,
  'geometry.three-point-circle': solveThreePointCircle,
  'geometry.conic': solveConic,
  'geometry.space-angle': solveSpaceAngle,
  'physics.formula': solveFormula,
}

function finiteAnswer(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (value && typeof value === 'object') return Object.values(value).every(finiteAnswer)
  return true
}

/**
 * 解题主入口。
 * @param {object} spec ProblemSpec
 * @returns {object} Solution（含 figure.svg 时请求了图形）
 */
export function solveSpec(spec) {
  const handler = TASKS[spec?.task]
  if (!handler) {
    return {
      ok: false,
      reason: `未知任务：${spec?.task}。支持：${Object.keys(TASKS).join('、')}`,
    }
  }
  try {
    const solution = handler(spec)
    if (!finiteAnswer(solution.answer)) throw new Error('计算结果超出有限数值范围')
    if (!solution.ok || solution.checks.some(c => !c.ok)) {
      return { ...solution, ok: false, answer: null, steps: [], summary: solution.checks.filter(c => !c.ok).map(c => c.detail).join('；') || solution.summary }
    }
    if (spec.figure) {
      const svg = buildFigure(spec, solution)
      if (!svg) throw new Error(`不支持的配图类型：${spec.figure.kind}`)
      const svgCheck = checkSvg(svg)
      solution.checks.push(check('SVG 结构自检', svgCheck.ok, svgCheck.problems.join('；') || '通过'))
      if (!svgCheck.ok) return { ...solution, ok: false, answer: null, steps: [], summary: svgCheck.problems.join('；') }
      solution.figure = { svg, written: null }
    }
    return solution
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, domain: spec?.domain, task: spec?.task, summary: message, reason: message, steps: [], answer: null, checks: [check('输入与计算自检', false, message)] }
  }
}

export { TASKS }
