/**
 * 几何内核 — 截面数学自动导出自几何实验室 src/domain/geometry（createSolid / section / analyticSection 口径）
 * 覆盖高中立体几何、平面几何、解析几何的确定性计算：
 *   - 标准实体：长方体、正 n 棱柱、正 n 棱锥、正 n 棱台、圆柱、圆锥、圆台、球
 *   - 截面：凸多面体精确裁剪分类；曲线体按「圆/矩形/三角形/梯形/椭圆/斜截曲线」诚实分级
 *   - 度量：体积、表面积（含 π 的指标约等于显示）
 *   - 平面几何：三角形求解、直线关系、圆与直线/圆
 *   - 解析几何：直线、圆、圆锥曲线基本量
 *   - 空间角：异面直线角、线面角、二面角
 * 纪律：一切结论由本文件确定性计算产生；近似值必须带 metricsApproximate/≈ 标记。
 * 零依赖，纯 ESM。
 */

import {
  cross,
  distance,
  distance2,
  dot,
  length,
  newellNormal,
  normalize,
  planeBasis,
  planeFromPoints,
  subtract,
} from './vecmath.mjs'
import { exact, exactDiv, exactMul } from './num.mjs'
import { sectionMaster } from './master-section.mjs'

/* ================================================================== */
/* 一、标准实体构造                                                     */
/* ================================================================== */

/**
 * @typedef {Object} Solid
 * @property {'box'|'prism'|'pyramid'|'frustum'|'cylinder'|'cone'|'conical-frustum'|'sphere'} kind
 * @property {Record<string, number>} params
 * @property {boolean} polyhedral 是否为凸多面体（有 vertices/faces）
 * @property {Vec3[]} [vertices]
 * @property {number[][]} [faces] 面索引（按顶点顺序，外法向）
 */

const TAU = Math.PI * 2

function regularPolygonVertices(n, radius, z = 0) {
  const points = []
  for (let i = 0; i < n; i += 1) {
    const angle = (i / n) * TAU
    points.push([radius * Math.cos(angle), radius * Math.sin(angle), z])
  }
  return points
}

/** 长方体：角点在原点，边沿坐标轴，params {a,b,c}。 */
export function createBox(a, b, c) {
  assertPositive(a, '长')
  assertPositive(b, '宽')
  assertPositive(c, '高')
  const vertices = [
    [0, 0, 0], [a, 0, 0], [a, b, 0], [0, b, 0],
    [0, 0, c], [a, 0, c], [a, b, c], [0, b, c],
  ]
  const faces = [
    [0, 3, 2, 1], // 底 z=0（外法向 -z）
    [4, 5, 6, 7], // 顶 z=c
    [0, 1, 5, 4], // 前 y=0
    [1, 2, 6, 5], // 右 x=a
    [2, 3, 7, 6], // 后 y=b
    [3, 0, 4, 7], // 左 x=0
  ]
  return { kind: 'box', params: { a, b, c }, polyhedral: true, vertices, faces }
}

/** 正 n 棱柱：底面为正 n 边形（外接圆半径 radius），高 h，底面在 z=0。 */
export function createRegularPrism(n, radius, height) {
  assertPositive(radius, '底面外接圆半径')
  assertPositive(height, '高')
  assertSides(n)
  const bottom = regularPolygonVertices(n, radius, 0)
  const top = regularPolygonVertices(n, radius, height)
  const vertices = [...bottom, ...top]
  const faces = [[...Array.from({ length: n }, (_, i) => i)].reverse()] // 底（外法向 -z）
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    faces.push([i, j, n + j, n + i])
  }
  faces.push(Array.from({ length: n }, (_, i) => n + i)) // 顶
  return { kind: 'prism', params: { n, radius, height }, polyhedral: true, vertices, faces }
}

/** 正 n 棱锥：底面正 n 边形（外接圆半径 radius），高 h，顶点在 (0,0,h)。 */
export function createRegularPyramid(n, radius, height) {
  assertPositive(radius, '底面外接圆半径')
  assertPositive(height, '高')
  assertSides(n)
  const bottom = regularPolygonVertices(n, radius, 0)
  const vertices = [...bottom, [0, 0, height]]
  const faces = [[...Array.from({ length: n }, (_, i) => i)].reverse()]
  for (let i = 0; i < n; i += 1) {
    faces.push([i, (i + 1) % n, n])
  }
  return { kind: 'pyramid', params: { n, radius, height }, polyhedral: true, vertices, faces }
}

/** 正 n 棱台：下底外接圆半径 r1、上底 r2、高 h。 */
export function createRegularFrustum(n, rBottom, rTop, height) {
  assertPositive(rBottom, '下底外接圆半径')
  assertPositive(rTop, '上底外接圆半径')
  assertPositive(height, '高')
  assertSides(n)
  const bottom = regularPolygonVertices(n, rBottom, 0)
  const top = regularPolygonVertices(n, rTop, height)
  const vertices = [...bottom, ...top]
  const faces = [[...Array.from({ length: n }, (_, i) => i)].reverse()]
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n
    faces.push([i, j, n + j, n + i])
  }
  faces.push(Array.from({ length: n }, (_, i) => n + i))
  return { kind: 'frustum', params: { n, rBottom, rTop, height }, polyhedral: true, vertices, faces }
}

/** 圆柱：半径 r、高 h，底面在 z=0，轴为 z 轴。 */
export function createCylinder(radius, height) {
  assertPositive(radius, '半径')
  assertPositive(height, '高')
  return { kind: 'cylinder', params: { radius, height }, polyhedral: false }
}

/** 圆锥：底面半径 r、高 h，顶点 (0,0,h)。 */
export function createCone(radius, height) {
  assertPositive(radius, '半径')
  assertPositive(height, '高')
  return { kind: 'cone', params: { radius, height }, polyhedral: false }
}

/** 圆台：下底 r1、上底 r2、高 h。 */
export function createConicalFrustum(rBottom, rTop, height) {
  assertPositive(rBottom, '下底半径')
  assertPositive(rTop, '上底半径')
  assertPositive(height, '高')
  return { kind: 'conical-frustum', params: { rBottom, rTop, height }, polyhedral: false }
}

/** 球：半径 R，球心在原点。 */
export function createSphere(radius) {
  assertPositive(radius, '半径')
  return { kind: 'sphere', params: { radius }, polyhedral: false }
}

/** 由题目参数表构造实体：{kind, ...params}。 */
export function createSolid(spec) {
  if (spec?.params !== undefined) {
    if (!spec.params || typeof spec.params !== 'object' || Array.isArray(spec.params)) throw new RangeError('实体 params 必须是参数对象')
    for (const [key, value] of Object.entries(spec.params)) {
      if (Object.hasOwn(spec, key) && spec[key] !== value) throw new RangeError(`实体参数冲突：${key}`)
    }
    spec = { ...spec.params, ...spec }
  }
  switch (spec?.kind) {
    case 'box': return createBox(spec.a, spec.b, spec.c)
    case 'cube': return createBox(spec.a, spec.a, spec.a)
    case 'prism': return createRegularPrism(spec.n, spec.radius, spec.height)
    case 'pyramid': return createRegularPyramid(spec.n, spec.radius, spec.height)
    case 'frustum': return createRegularFrustum(spec.n, spec.rBottom, spec.rTop, spec.height)
    case 'cylinder': return createCylinder(spec.radius, spec.height)
    case 'cone': return createCone(spec.radius, spec.height)
    case 'conical-frustum': return createConicalFrustum(spec.rBottom, spec.rTop, spec.height)
    case 'sphere': return createSphere(spec.radius)
    default: throw new RangeError(`不支持的实体类型：${spec?.kind}`)
  }
}

/* ================================================================== */
/* 二、实体度量（体积 / 表面积）                                        */
/* ================================================================== */

const PI_APPROXIMATE_NOTE = '含 π 的指标为近似值，用 ≈ 表示'

/**
 * @returns {{volume: number, surfaceArea: number, lateralArea: number|null,
 *            approximate: boolean, notes: string[]}}
 */
export function solidMetrics(solid) {
  switch (solid.kind) {
    case 'box':
    case 'cube': {
      const { a, b, c } = solid.params
      return {
        volume: a * b * c,
        surfaceArea: 2 * (a * b + b * c + c * a),
        lateralArea: 2 * (a * b + b * c + c * a) - 2 * a * b,
        approximate: false,
        notes: [],
      }
    }
    case 'prism': {
      const { n, radius, height } = solid.params
      const base = regularPolygonArea(n, radius)
      const side = 2 * radius * Math.sin(Math.PI / n)
      return {
        volume: base * height,
        surfaceArea: n * side * height + 2 * base,
        lateralArea: n * side * height,
        approximate: false,
        notes: [],
      }
    }
    case 'pyramid': {
      const { n, radius, height } = solid.params
      const base = regularPolygonArea(n, radius)
      const apothem = radius * Math.cos(Math.PI / n)
      const slant = Math.hypot(height, apothem)
      const side = 2 * radius * Math.sin(Math.PI / n)
      return {
        volume: (base * height) / 3,
        surfaceArea: base + (n * side * slant) / 2,
        lateralArea: (n * side * slant) / 2,
        approximate: false,
        notes: [],
      }
    }
    case 'frustum': {
      const { n, rBottom, rTop, height } = solid.params
      const b1 = regularPolygonArea(n, rBottom)
      const b2 = regularPolygonArea(n, rTop)
      const slant = Math.hypot(height, rBottom - rTop) // 正棱台斜高（对应面）
      const sideBottom = 2 * rBottom * Math.sin(Math.PI / n)
      const sideTop = 2 * rTop * Math.sin(Math.PI / n)
      return {
        volume: (height * (b1 + b2 + Math.sqrt(b1 * b2))) / 3,
        surfaceArea: b1 + b2 + (n * (sideBottom + sideTop) * slant) / 2,
        lateralArea: (n * (sideBottom + sideTop) * slant) / 2,
        approximate: false,
        notes: [],
      }
    }
    case 'cylinder': {
      const { radius, height } = solid.params
      return {
        volume: Math.PI * radius * radius * height,
        surfaceArea: 2 * Math.PI * radius * (radius + height),
        lateralArea: 2 * Math.PI * radius * height,
        approximate: true,
        notes: [PI_APPROXIMATE_NOTE],
      }
    }
    case 'cone': {
      const { radius, height } = solid.params
      const slant = Math.hypot(radius, height)
      return {
        volume: (Math.PI * radius * radius * height) / 3,
        surfaceArea: Math.PI * radius * (radius + slant),
        lateralArea: Math.PI * radius * slant,
        approximate: true,
        notes: [PI_APPROXIMATE_NOTE],
      }
    }
    case 'conical-frustum': {
      const { rBottom, rTop, height } = solid.params
      const slant = Math.hypot(height, rBottom - rTop)
      return {
        volume: (Math.PI * height * (rBottom * rBottom + rBottom * rTop + rTop * rTop)) / 3,
        surfaceArea: Math.PI * (rBottom * rBottom + rTop * rTop + (rBottom + rTop) * slant),
        lateralArea: Math.PI * (rBottom + rTop) * slant,
        approximate: true,
        notes: [PI_APPROXIMATE_NOTE],
      }
    }
    case 'sphere': {
      const { radius } = solid.params
      return {
        volume: (4 * Math.PI * radius ** 3) / 3,
        surfaceArea: 4 * Math.PI * radius * radius,
        lateralArea: null,
        approximate: true,
        notes: [PI_APPROXIMATE_NOTE],
      }
    }
    default:
      throw new RangeError(`不支持的实体类型：${solid.kind}`)
  }
}

/** 正 n 边形面积（外接圆半径 R）。 */
export function regularPolygonArea(n, radius) {
  assertSides(n)
  return (n * radius * radius * Math.sin(TAU / n)) / 2
}

/** 正 n 边形边长（外接圆半径 R）。 */
export function regularPolygonSide(n, radius) {
  assertSides(n)
  return 2 * radius * Math.sin(Math.PI / n)
}

/* ================================================================== */
/* 三、截面计算                                                         */
/* ================================================================== */

/**
 * 归一化平面输入：{point, normal} 或 {points:[a,b,c]} 或 {threePoints:[a,b,c]}。
 * @returns {{origin: Vec3, normal: Vec3}}
 */
export function toPlane(spec) {
  if (!spec || typeof spec !== 'object') throw new RangeError('平面参数缺失')
  const representations = [Object.hasOwn(spec, 'points'), Object.hasOwn(spec, 'threePoints'), Object.hasOwn(spec, 'point') || Object.hasOwn(spec, 'normal')].filter(Boolean).length
  if (representations !== 1) throw new RangeError('平面必须且只能给出一种表示，不能混用 points、threePoints 与 point/normal')
  if (Array.isArray(spec.points) && spec.points.length === 3) {
    return planeFromPoints(spec.points[0], spec.points[1], spec.points[2])
  }
  if (Array.isArray(spec.threePoints) && spec.threePoints.length === 3) {
    return planeFromPoints(spec.threePoints[0], spec.threePoints[1], spec.threePoints[2])
  }
  if (spec.point && spec.normal) {
    const normal = normalize(spec.normal)
    return { origin: spec.point, normal }
  }
  throw new RangeError('平面需要 {point, normal} 或三点 {points:[a,b,c]}')
}

/**
 * 截面主入口。对凸多面体走精确裁剪；对曲线体走解析分类。
 * @returns {SectionResult}
 */
export function sectionOf(solid, planeSpec) {
  const plane = toPlane(planeSpec)
  if (solid.polyhedral) return sectionPolyhedron(solid, plane)
  switch (solid.kind) {
    case 'sphere': return sectionSphere(solid, plane)
    case 'cylinder': return sectionCylinder(solid, plane)
    case 'cone': return sectionCone(solid, plane)
    case 'conical-frustum': return sectionConicalFrustum(solid, plane)
    default: throw new RangeError(`暂不支持该实体截面：${solid.kind}`)
  }
}

/* ---------------- 3.1 凸多面体截面（精确） ---------------- */

/**
 * Sutherland 式逐面求交 + 环状链接。
 * @returns {SectionResult}
 */
export function sectionPolyhedron(solid, plane) { return sectionMaster(solid, plane) }
export function sectionSphere(solid, plane) { return sectionMaster(solid, plane) }
export function sectionCylinder(solid, plane) { return sectionMaster(solid, plane) }
export function sectionCone(solid, plane) { return sectionMaster(solid, plane) }
export function sectionConicalFrustum(solid, plane) { return sectionMaster(solid, plane) }

/* ================================================================== */
/* 四、平面几何                                                        */
/* ================================================================== */

/**
 * 解三角形（SSS）。
 * @param {{a:number,b:number,c:number}} sides
 */
export function solveTriangleSSS({ a, b, c }) {
  assertTriangle(a, b, c)
  const angles = {
    A: angleFromCosines(b, c, a),
    B: angleFromCosines(c, a, b),
    C: angleFromCosines(a, b, c),
  }
  return triangleResult({ a, b, c, angles })
}

/** 解三角形（SAS：两边夹角）。 */
export function solveTriangleSAS({ a, C, b }) {
  const c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos((C * Math.PI) / 180))
  return solveTriangleSSS({ a, b, c })
}

function triangleResult({ a, b, c, angles }) {
  const s = (a + b + c) / 2
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c))
  const circumradius = (a * b * c) / (4 * area)
  const inradius = area / s
  return {
    ok: true,
    sides: { a, b, c },
    angles,
    area,
    heights: { ha: (2 * area) / a, hb: (2 * area) / b, hc: (2 * area) / c },
    medians: {
      ma: 0.5 * Math.sqrt(2 * b * b + 2 * c * c - a * a),
      mb: 0.5 * Math.sqrt(2 * c * c + 2 * a * a - b * b),
      mc: 0.5 * Math.sqrt(2 * a * a + 2 * b * b - c * c),
    },
    circumradius,
    inradius,
    semiperimeter: s,
    type: triangleType(a, b, c, angles),
    metricsApproximate: false,
  }
}

/** 直线一般式：过两点 → {a, b, c} 表示 ax + by + c = 0（已归一化）。 */
export function lineThrough(p1, p2) {
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  if (Math.hypot(dx, dy) < 1e-15) throw new RangeError('两点重合，无法确定直线')
  const raw = { a: dy, b: -dx, c: -(dy * p1[0] - dx * p1[1]) }
  const norm = Math.hypot(raw.a, raw.b)
  const line = { a: raw.a / norm, b: raw.b / norm, c: raw.c / norm }
  return {
    ...line,
    slope: Math.abs(line.b) < 1e-15 ? null : -line.a / line.b,
    points: [p1, p2],
  }
}

/** 两直线交点：返回 {point} / {parallel:true} / {coincident:true}。 */
export function lineIntersection(l1, l2) {
  const det = l1.a * l2.b - l2.a * l1.b
  if (Math.abs(det) < 1e-12) {
    const coincident = Math.abs(l1.a * l2.c - l2.a * l1.c) < 1e-12 && Math.abs(l1.b * l2.c - l2.b * l1.c) < 1e-12
    return coincident ? { coincident: true } : { parallel: true }
  }
  return {
    point: [
      (l1.b * l2.c - l2.b * l1.c) / det,
      (l2.a * l1.c - l1.a * l2.c) / det,
    ],
  }
}

/** 点到直线距离。 */
export function pointLineDistance(point, line) {
  return Math.abs(line.a * point[0] + line.b * point[1] + line.c) / Math.hypot(line.a, line.b)
}

/** 两直线夹角（锐角，角度制）。 */
export function angleBetweenLines(l1, l2) {
  const cos = Math.abs(l1.a * l2.a + l1.b * l2.b) / (Math.hypot(l1.a, l1.b) * Math.hypot(l2.a, l2.b))
  return (Math.acos(clampAbs(cos)) * 180) / Math.PI
}

/**
 * 圆与直线位置关系。
 * @param {{center:[number,number], radius:number}} circle
 */
export function circleLineRelation(circle, line) {
  const d = pointLineDistance(circle.center, line)
  const delta = d - circle.radius
  if (delta > 1e-12) return { relation: '相离', distance: d, points: [] }
  if (Math.abs(delta) <= 1e-12) {
    const foot = footOfPerpendicular(circle.center, line)
    return { relation: '相切', distance: d, points: [foot] }
  }
  // 弦方向
  const direction = [line.b, -line.a]
  const half = Math.sqrt(circle.radius * circle.radius - d * d)
  const foot = footOfPerpendicular(circle.center, line)
  const norm = Math.hypot(direction[0], direction[1])
  const u = [direction[0] / norm, direction[1] / norm]
  return {
    relation: '相交',
    distance: d,
    points: [
      [foot[0] + u[0] * half, foot[1] + u[1] * half],
      [foot[0] - u[0] * half, foot[1] - u[1] * half],
    ],
    chordLength: 2 * half,
  }
}

/** 两圆位置关系。 */
export function circleCircleRelation(c1, c2) {
  // 圆心是 2D 点，必须用 distance2——distance() 按 3D 求 hypot，
  // 2D 输入会得 NaN（圆心距比较全部落空，任何两圆都被误判为「相交」）。
  const d = distance2(c1.center, c2.center)
  const rsum = c1.radius + c2.radius
  const rdiff = Math.abs(c1.radius - c2.radius)
  if (d > rsum + 1e-12) return { relation: '外离', centerDistance: d }
  if (Math.abs(d - rsum) <= 1e-12) return { relation: '外切', centerDistance: d }
  if (d < rdiff - 1e-12) return { relation: '内含', centerDistance: d }
  if (Math.abs(d - rdiff) <= 1e-12) return { relation: '内切', centerDistance: d }
  // 相交：公共弦
  const a = (d * d + c1.radius * c1.radius - c2.radius * c2.radius) / (2 * d)
  const h2 = c1.radius * c1.radius - a * a
  const h = h2 > 0 ? Math.sqrt(h2) : 0
  const u = [(c2.center[0] - c1.center[0]) / d, (c2.center[1] - c1.center[1]) / d]
  const mid = [c1.center[0] + u[0] * a, c1.center[1] + u[1] * a]
  const perp = [-u[1], u[0]]
  return {
    relation: '相交',
    centerDistance: d,
    points: [
      [mid[0] + perp[0] * h, mid[1] + perp[1] * h],
      [mid[0] - perp[0] * h, mid[1] - perp[1] * h],
    ],
    commonChordLength: 2 * h,
  }
}

/** 三点定圆（垂直平分线交点）。 */
export function circleFromThreePoints(p1, p2, p3) {
  const ax = p1[0]
  const ay = p1[1]
  const bx = p2[0]
  const by = p2[1]
  const cx = p3[0]
  const cy = p3[1]
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-12) throw new RangeError('三点共线，无法确定圆')
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
  const center = [ux, uy]
  return { ok: true, center, radius: Math.hypot(ux - ax, uy - ay) }
}

/* ================================================================== */
/* 五、解析几何                                                        */
/* ================================================================== */

/**
 * 圆锥曲线基本量（标准方程，中心/顶点在原点，焦点在 x 轴）。
 * @param {'ellipse'|'hyperbola'|'parabola'} type
 * @param {Record<string, number>} params ellipse/hyperbola: {a,b}；parabola: {p}（y² = 2px）
 */
export function conicInfo(type, params) {
  if (type === 'ellipse') {
    const { a, b } = params
    assertPositive(a, 'a')
    assertPositive(b, 'b')
    if (b > a) return conicInfo('ellipse', { a: b, b: a, swapped: true })
    const c = Math.sqrt(a * a - b * b)
    return {
      ok: true,
      type: 'ellipse',
      a,
      b,
      c,
      eccentricity: c / a,
      foci: [[-c, 0], [c, 0]],
      vertices: [[-a, 0], [a, 0], [0, -b], [0, b]],
      focalLength: 2 * c,
      majorAxis: 2 * a,
      minorAxis: 2 * b,
      swapped: Boolean(params.swapped),
    }
  }
  if (type === 'hyperbola') {
    const { a, b } = params
    assertPositive(a, 'a')
    assertPositive(b, 'b')
    const c = Math.sqrt(a * a + b * b)
    return {
      ok: true,
      type: 'hyperbola',
      a,
      b,
      c,
      eccentricity: c / a,
      foci: [[-c, 0], [c, 0]],
      vertices: [[-a, 0], [a, 0]],
      asymptotes: ['y = (b/a)x', 'y = -(b/a)x'],
      realAxis: 2 * a,
      imaginaryAxis: 2 * b,
    }
  }
  if (type === 'parabola') {
    const { p } = params
    assertPositive(p, 'p')
    return {
      ok: true,
      type: 'parabola',
      p,
      focus: [p / 2, 0],
      directrix: `x = -p/2（即 x = ${fmt(-p / 2)}）`,
      focalLength: p,
      opening: 'right',
    }
  }
  throw new RangeError(`不支持的圆锥曲线类型：${type}`)
}

/* ================================================================== */
/* 六、空间角与经典精确量                                                */
/* ================================================================== */

/** 异面直线所成角（方向向量夹角，取锐角）。 */
export function angleBetweenDirections(d1, d2) {
  const cos = Math.abs(dot(d1, d2)) / (length(d1) * length(d2))
  return (Math.acos(clampAbs(cos)) * 180) / Math.PI
}

/** 线面角：直线方向与平面法向夹角的余角。 */
export function linePlaneAngle(direction, plane) {
  const n = normalize(plane.normal)
  const cos = Math.abs(dot(direction, n)) / (length(direction))
  return 90 - (Math.acos(clampAbs(cos)) * 180) / Math.PI
}

/** 二面角：两平面法向夹角（0–180°）。 */
export function dihedralAngle(plane1, plane2) {
  const cos = dot(normalize(plane1.normal), normalize(plane2.normal))
  return (Math.acos(clampAbs(cos)) * 180) / Math.PI
}

/** 正方体体对角线 a√3（精确值）。 */
export function cubeSpaceDiagonal(a) {
  return exactMul(exact(1, 3), exact(a))
}

/** 面对角线 a√2（精确值）。 */
export function cubeFaceDiagonal(a) {
  return exactMul(exact(1, 2), exact(a))
}

/** 等边三角形高 a√3/2（精确值）。 */
export function equilateralHeight(a) {
  return exactDiv(exact(a, 3), exact(2))
}

/* ================================================================== */
/* 内部工具                                                            */
/* ================================================================== */

function footOfPerpendicular(point, line) {
  const norm = Math.hypot(line.a, line.b)
  const t = (line.a * point[0] + line.b * point[1] + line.c) / (norm * norm)
  return [point[0] - line.a * t, point[1] - line.b * t]
}

function angleFromCosines(adjacent1, adjacent2, opposite) {
  const cos = (adjacent1 * adjacent1 + adjacent2 * adjacent2 - opposite * opposite) / (2 * adjacent1 * adjacent2)
  return (Math.acos(clampAbs(cos)) * 180) / Math.PI
}

function triangleType(a, b, c, angles) {
  const sides = [a, b, c]
  const maxSide = Math.max(...sides)
  const others = sides.filter((s) => s !== maxSide)
  const squareSum = others[0] * others[0] + others[1] * others[1]
  if (Math.abs(squareSum - maxSide * maxSide) < 1e-9) return '直角三角形'
  if (Math.abs(a - b) < 1e-9 && Math.abs(b - c) < 1e-9) return '等边三角形'
  if (Math.abs(a - b) < 1e-9 || Math.abs(b - c) < 1e-9 || Math.abs(a - c) < 1e-9) return '等腰三角形'
  if (squareSum > maxSide * maxSide) return '锐角三角形'
  return '钝角三角形'
}

function assertTriangle(a, b, c) {
  const sides = [a, b, c]
  if (sides.some((s) => !Number.isFinite(s) || s <= 0)) {
    throw new RangeError('三角形边长必须为正数')
  }
  if (a + b <= c || b + c <= a || c + a <= b) {
    throw new RangeError('不满足三角形两边之和大于第三边')
  }
}

function assertPositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label}必须是正数`)
  }
}

function assertSides(n) {
  if (!Number.isInteger(n) || n < 3) {
    throw new RangeError('底面边数必须是大于等于 3 的整数')
  }
}

function clampAbs(value) {
  return Math.min(1, Math.max(-1, value))
}

function fmt(value) {
  return String(Number(value.toFixed(6)))
}

// 供外部复用的小工具（避免循环依赖问题，显式再导出）
export { planeBasis, newellNormal }
