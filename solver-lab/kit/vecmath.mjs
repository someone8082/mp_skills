/**
 * 向量与平面内核 — 移植自几何实验室 src/domain/geometry/vector.ts
 * 2D/3D 向量运算、平面表示与基、容差比较；附多边形面积/法线工具。
 * 零依赖，纯 ESM。
 */

export const DEFAULT_EPSILON = 1e-9

/** @typedef {readonly [number, number, number]} Vec3 */
/** @typedef {readonly [number, number]} Vec2 */
/** @typedef {{origin: Vec3, normal: Vec3}} Plane */

/* ---------------- 3D ---------------- */

export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

export function scale(vector, factor) {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor]
}

export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

export function length(vector) {
  return Math.hypot(vector[0], vector[1], vector[2])
}

export function distance(a, b) {
  return length(subtract(a, b))
}

/** 数值稳定的归一化：先按最大分量缩放，避免大分量吃满精度。 */
export function normalize(vector) {
  if (!vector.every(Number.isFinite)) {
    throw new RangeError('Vector components must be finite')
  }

  const maximumComponent = Math.max(Math.abs(vector[0]), Math.abs(vector[1]), Math.abs(vector[2]))

  if (maximumComponent === 0) {
    throw new Error('零向量没有方向')
  }

  const scaled = [vector[0] / maximumComponent, vector[1] / maximumComponent, vector[2] / maximumComponent]
  const magnitude = Math.hypot(scaled[0], scaled[1], scaled[2])

  return [scaled[0] / magnitude, scaled[1] / magnitude, scaled[2] / magnitude]
}

export function isApproximatelyEqual(a, b, epsilon = DEFAULT_EPSILON) {
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new RangeError('Epsilon must be a non-negative finite number')
  }

  return Number.isFinite(a) && Number.isFinite(b) && (a === b || Math.abs(a - b) <= epsilon)
}

export function arePointsApproximatelyEqual(a, b, epsilon = DEFAULT_EPSILON) {
  return (
    isApproximatelyEqual(a[0], b[0], epsilon) &&
    isApproximatelyEqual(a[1], b[1], epsilon) &&
    isApproximatelyEqual(a[2], b[2], epsilon)
  )
}

export function clamp(value, minimum, maximum) {
  if (![value, minimum, maximum].every(Number.isFinite)) {
    throw new RangeError('Clamp values must be finite')
  }
  if (minimum > maximum) {
    throw new RangeError('Minimum cannot exceed maximum')
  }

  return Math.min(Math.max(value, minimum), maximum)
}

/** 构造单位法向的平面；origin 原样保留。 */
export function createPlane(origin, normal) {
  const unit = normalize(normal)
  return { origin, normal: unit }
}

/** 由单位法向构造正交基 {u, v, normal}。 */
export function createPlaneBasisFromUnitNormal(normal) {
  if (!normal.every(Number.isFinite)) {
    throw new RangeError('Plane normal components must be finite')
  }

  const normalLength = length(normal)
  if (normalLength === 0) {
    throw new Error('A plane normal cannot be the zero vector')
  }
  if (!isApproximatelyEqual(normalLength, 1)) {
    throw new RangeError('Plane basis requires a unit normal')
  }

  const unitNormal = normalize(normal)
  const referenceAxis =
    Math.abs(unitNormal[0]) <= Math.abs(unitNormal[1]) && Math.abs(unitNormal[0]) <= Math.abs(unitNormal[2])
      ? [1, 0, 0]
      : Math.abs(unitNormal[1]) <= Math.abs(unitNormal[2])
        ? [0, 1, 0]
        : [0, 0, 1]
  const u = normalize(cross(referenceAxis, unitNormal))
  const v = cross(unitNormal, u)

  return { u, v, normal: unitNormal }
}

export function planeBasis(plane) {
  return createPlaneBasisFromUnitNormal(normalize(plane.normal))
}

/** 点到平面的带符号距离（平面法向已归一化）。 */
export function signedDistanceToPlane(point, plane) {
  const unit = normalize(plane.normal)
  return dot(subtract(point, plane.origin), unit)
}

/** 点到平面的距离（绝对值）。 */
export function distanceToPlane(point, plane) {
  return Math.abs(signedDistanceToPlane(point, plane))
}

/** 点投影到平面，返回平面二维坐标 {u, v}。 */
export function projectPointToPlane(point, plane) {
  const basis = planeBasis(plane)
  const displacement = subtract(point, plane.origin)
  return [dot(displacement, basis.u), dot(displacement, basis.v)]
}

/** 平面二维坐标还原为 3D 点。 */
export function planePointToWorld(uv, plane) {
  const basis = planeBasis(plane)
  return add(plane.origin, add(scale(basis.u, uv[0]), scale(basis.v, uv[1])))
}

/** 三点定面（右手法则，normal 已归一化）。 */
export function planeFromPoints(a, b, c) {
  const normal = cross(subtract(b, a), subtract(c, a))
  if (length(normal) === 0) {
    throw new Error('三点共线，无法确定平面')
  }
  return createPlane(a, normal)
}

/* ---------------- 2D ---------------- */

export function add2(a, b) {
  return [a[0] + b[0], a[1] + b[1]]
}

export function subtract2(a, b) {
  return [a[0] - b[0], a[1] - b[1]]
}

export function dot2(a, b) {
  return a[0] * b[0] + a[1] * b[1]
}

export function cross2(a, b) {
  return a[0] * b[1] - a[1] * b[0]
}

export function length2(vector) {
  return Math.hypot(vector[0], vector[1])
}

export function distance2(a, b) {
  return length2(subtract2(a, b))
}

/** 2D 多边形面积（鞋带公式，顶点顺序给出时为正值）。 */
export function polygonArea2(points) {
  if (!Array.isArray(points) || points.length < 3) return 0
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    total += x1 * y2 - x2 * y1
  }
  return Math.abs(total) / 2
}

/** Newell 法：对任意绕序都稳定的多边形法线。 */
export function newellNormal(points) {
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    nx += (current[1] - next[1]) * (current[2] + next[2])
    ny += (current[2] - next[2]) * (current[0] + next[0])
    nz += (current[0] - next[0]) * (current[1] + next[1])
  }
  const normal = [nx, ny, nz]
  return length(normal) === 0 ? null : normalize(normal)
}

/** 3D 多边形面积：Newell 法 × ½。 */
export function polygonArea3(points) {
  const normal = newellNormal(points)
  if (!normal) return 0
  let nx = 0
  let ny = 0
  let nz = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    nx += (current[1] - next[1]) * (current[2] + next[2])
    ny += (current[2] - next[2]) * (current[0] + next[0])
    nz += (current[0] - next[0]) * (current[1] + next[1])
  }
  return Math.hypot(nx, ny, nz) / 2
}

/** 3D 多边形周长。 */
export function polygonPerimeter3(points) {
  let total = 0
  for (let i = 0; i < points.length; i += 1) {
    total += distance(points[i], points[(i + 1) % points.length])
  }
  return total
}
