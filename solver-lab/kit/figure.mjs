/**
 * 可视化图形库 — 移植自 anatomy（iso-kit / craft 规则）的轻量子集。
 * 面向高中数理题解的两类图：
 *   1) 等轴测图（iso）：立体几何实体、物理装置（斜面/滑轮/实验台），四色调着色 + 画家顺序；
 *   2) 平面示意图（2D）：平面几何、函数曲线、电路、光路图。
 * 输出为内联样式的独立 SVG 字符串，浏览器可直接打开；零依赖，纯 ESM。
 * Craft 口径（压缩版）：
 *   - 实体着色，不用线框；每个面按朝向取色（顶亮、右中、左暗）；
 *   - 遮挡按真实深度排序（画家算法），不靠肉眼调 key；
 *   - 图置于卡片框内：Fig n 左上、标题右上、提示左下、读数右下；
 *   - 读数数字必须来自计算内核，不允许手填。
 */

import {
  dot,
  newellNormal,
  normalize,
} from './vecmath.mjs'
import {
  animate,
  animateMotion,
  animateTransform,
  blink,
  drawPolyline,
  ease,
  modelTrack,
  pulse,
} from './animate.mjs'

/* ================================================================== */
/* 一、颜色（浅色 academic-clean 基调）                                  */
/* ================================================================== */

const PAPER = '#ffffff'
const PANEL = '#f6f7fb'
const INK = '#1f2937'
const INK_SOFT = '#6b7280'
const GRID = '#e5e7eb'
const ACCENT = '#2563eb'
const ACCENT_SOFT = '#93b4f5'

export const PALETTE = {
  paper: PAPER,
  panel: PANEL,
  ink: INK,
  inkSoft: INK_SOFT,
  grid: GRID,
  accent: ACCENT,
  accentSoft: ACCENT_SOFT,
  red: '#dc2626',
  green: '#059669',
  amber: '#d97706',
  purple: '#7c3aed',
  teal: '#0d9488',
}

function parseHex(hex) {
  const value = hex.replace('#', '')
  const full = value.length === 3 ? [...value].map((c) => c + c).join('') : value
  return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16))
}

function toHex([r, g, b]) {
  const clampByte = (v) => Math.min(255, Math.max(0, Math.round(v)))
  return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')}`
}

/** 混色：t=0 取 a，t=1 取 b。 */
export function mix(a, b, t) {
  const ca = parseHex(a)
  const cb = parseHex(b)
  return toHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ])
}

export const lighten = (hex, t) => mix(hex, '#ffffff', t)
export const darken = (hex, t) => mix(hex, INK, t)

/* ================================================================== */
/* 二、等轴测相机                                                       */
/* ================================================================== */

/**
 * 创建等轴测相机。世界坐标：x/y 在地面，z 向上。
 * @param {{azimuth?: number, elevation?: number, scale?: number}} options
 */
export function createCamera({ azimuth = 45, elevation = 30, scale = 1 } = {}) {
  const A = (azimuth * Math.PI) / 180
  const E = (elevation * Math.PI) / 180
  const cosA = Math.cos(A)
  const sinA = Math.sin(A)
  const cosE = Math.cos(E)
  const sinE = Math.sin(E)

  const camera = {
    azimuth,
    elevation,
    scale,
    /** 世界点 → 屏幕点（未含平移）。 */
    project(point) {
      const rx = (point[0] * cosA - point[1] * sinA) * scale
      const ry = (point[0] * sinA + point[1] * cosA) * scale
      return [rx, ry * sinE - point[2] * scale * cosE]
    },
    projectAll(points) {
      return points.map((p) => camera.project(p))
    },
    /** 深度：越大越靠近相机（画家顺序用）。 */
    depth(point) {
      const ry = (point[0] * sinA + point[1] * cosA) * scale
      return ry * sinE + point[2] * scale * cosE
    },
    /** 相机视线方向（场景 → 相机，世界坐标）。 */
    viewDirection() {
      return normalize([sinA * sinE, cosA * sinE, cosE])
    },
    /** 屏幕右方向（世界坐标），用于面朝向分色。 */
    rightDirection() {
      return normalize([cosA, -sinA, 0])
    },
    /** 屏幕横向 1 世界单位对应的像素（椭圆 rx 用）。 */
    unitX() {
      return scale
    },
    /** 屏幕纵向椭圆压缩比（椭圆 ry 用）。 */
    flatten() {
      return sinE
    },
    /** 由点集估算合适的 scale，使投影后宽高落在给定范围内。 */
    fitScale(points, width, height, pad = 40) {
      const projected = camera.projectAll(points)
      const xs = projected.map((p) => p[0])
      const ys = projected.map((p) => p[1])
      const spanX = Math.max(...xs) - Math.min(...xs) || 1
      const spanY = Math.max(...ys) - Math.min(...ys) || 1
      const usableX = Math.max(10, width - 2 * pad)
      const usableY = Math.max(10, height - 2 * pad)
      return Math.min(usableX / spanX, usableY / spanY) * (scale / (scale || 1))
    },
  }
  return camera
}

/* ================================================================== */
/* 三、SVG 基础                                                         */
/* ================================================================== */

function esc(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function polyPath(points, close = true) {
  if (!points.length) return ''
  const head = `M ${fmt(points[0][0])} ${fmt(points[0][1])}`
  const tail = points.slice(1).map((p) => `L ${fmt(p[0])} ${fmt(p[1])}`).join(' ')
  return close ? `${head} ${tail} Z` : `${head} ${tail}`
}

function fmt(value) {
  return Number(value.toFixed(2))
}

/** 屏幕空间椭圆（用于圆柱/球的顶底圆）。 */
function ellipse(cx, cy, rx, ry) {
  return { cx, cy, rx, ry }
}

function ellipsePath({ cx, cy, rx, ry }) {
  // 完整椭圆是镜像不变集，取绝对值后形状不变；A 命令半径按规范必须非负
  const ax = fmt(Math.abs(rx))
  const ay = fmt(Math.abs(ry))
  return `M ${fmt(cx - rx)} ${fmt(cy)} a ${ax} ${ay} 0 1 0 ${fmt(2 * rx)} 0 a ${ax} ${ay} 0 1 0 ${fmt(-2 * rx)} 0 Z`
}

/**
 * 椭圆周角弧段（屏幕空间）：从 fromDeg 到 toDeg 沿椭圆边界。
 * 屏幕坐标 y 向下：ry>0 时 θ 增大（右→下→左）即顺时针，对应 sweep-flag=1；
 * ry<0（相机俯仰为负、椭圆竖向镜像）时整体上下翻转，sweep 须取反。
 * A 命令半径必须非负，取绝对值；端点用带符号公式计算（真实屏幕位置）。
 * |Δθ|>180° 时置 large-arc 标志。所有调用点弧段 ≤180°，由角度唯一确定，
 * 杜绝手写 sweep 标志与「中途 M 另起子路径」两类路径 bug
 * （后者会让 Z 闭合到中途的 M 而非子路径起点，侧面留下三角空隙）。
 */
function ellipseArc(e, fromDeg, toDeg) {
  const rad = (d) => (d * Math.PI) / 180
  const end = [e.cx + e.rx * Math.cos(rad(toDeg)), e.cy + e.ry * Math.sin(rad(toDeg))]
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  const sweep = ((toDeg > fromDeg ? 1 : 0) ^ (e.ry < 0 ? 1 : 0))
  return `A ${fmt(Math.abs(e.rx))} ${fmt(Math.abs(e.ry))} 0 ${large} ${sweep} ${fmt(end[0])} ${fmt(end[1])}`
}

export function svgPath(d, { fill = 'none', stroke = 'none', strokeWidth = 1, opacity = 1, extra = '' } = {}) {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}" ${extra}/>`
}

export function svgCircle(cx, cy, r, { fill = 'none', stroke = 'none', strokeWidth = 1, opacity = 1, dash = '' } = {}) {
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ''
  return `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${opacity}"${dashAttr}/>`
}

export function svgLine(x1, y1, x2, y2, { stroke = INK, strokeWidth = 1, dash = '' } = {}) {
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ''
  return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}/>`
}

export function svgText(x, y, text, {
  size = 13,
  fill = INK,
  anchor = 'middle',
  weight = '400',
  opacity = 1,
} = {}) {
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}" opacity="${opacity}">${esc(text)}</text>`
}

export function svgRect(x, y, w, h, { fill = 'none', stroke = 'none', strokeWidth = 1, rx = 0 } = {}) {
  return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`
}

const SVG_STYLE = `
.iso-label { font-family: system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; }
.iso-readout { font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: reduce) { animate, animateTransform, animateMotion { display: none; } }
`

/**
 * 组装独立 SVG（内联样式，浏览器可直接打开）。
 * @param {{width: number, height: number, body: string, title?: string}} options
 */
export function svgDocument({ width, height, body, background = PAPER }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="system-ui, -apple-system, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif">
<rect x="0" y="0" width="${width}" height="${height}" fill="${background}"/>
<style>${SVG_STYLE}</style>
${body}
</svg>`
}

/**
 * 卡片框：Fig n 左上、标题右上、提示左下、读数右下（anatomy 构图口径）。
 * @param {{fig?: number, title?: string, hint?: string, readout?: string,
 *          width?: number, height?: number, world: string,
 *          fit?: {points: number[][], camera: ReturnType<typeof createCamera>, pad?: number},
 *          background?: string}} options
 * fit.points 为**世界坐标**，由 camera 投影后计算平移与缩放。
 */
export function figureCard({
  fig,
  title,
  hint,
  readout,
  width = 680,
  height = 460,
  world,
  fit,
  background = PAPER,
}) {
  const pad = 18
  const inner = []
  inner.push(svgRect(pad, pad, width - 2 * pad, height - 2 * pad, { fill: background, stroke: GRID, strokeWidth: 1, rx: 14 }))
  if (fig !== undefined) inner.push(svgText(pad + 16, pad + 28, `Fig ${fig}`, { size: 13, fill: INK_SOFT, anchor: 'start' }))
  if (title) inner.push(svgText(width - pad - 16, pad + 28, title, { size: 14, fill: INK, anchor: 'end', weight: '600' }))
  if (hint) inner.push(svgText(pad + 16, height - pad - 14, hint, { size: 12, fill: INK_SOFT, anchor: 'start' }))
  if (readout) {
    inner.push(svgText(width - pad - 16, height - pad - 14, readout, { size: 13, fill: ACCENT, anchor: 'end', weight: '600' }))
  }

  let transform = ''
  if (fit?.points?.length && fit.camera) {
    const projected = fit.points.map((p) => fit.camera.project(p))
    const xs = projected.map((p) => p[0])
    const ys = projected.map((p) => p[1])
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    const spanX = maxX - minX || 1
    const spanY = maxY - minY || 1
    const usableW = width - 2 * pad - 60
    const usableH = height - 2 * pad - 60
    const k = Math.min(usableW / spanX, usableH / spanY)
    const cx = pad + 30 + (usableW - spanX * k) / 2
    const cy = pad + 30 + (usableH - spanY * k) / 2
    transform = ` transform="translate(${fmt(cx - minX * k)} ${fmt(cy - minY * k)}) scale(${fmt(k)})"`
  }
  inner.push(`<g${transform} class="iso-label">${world}</g>`)
  return svgDocument({ width, height, body: inner.join('\n'), background })
}

/* ================================================================== */
/* 四、等轴测实体（四调着色 + 画家顺序）                                  */
/* ================================================================== */

/**
 * 通用凸多面体绘制：背面剔除 + 按面心深度排序 + 按朝向取色。
 * @param {ReturnType<typeof createCamera>} camera
 * @param {{vertices: number[][], faces: number[][]}} mesh
 * @param {{color?: string, accentColor?: string, opacity?: number, stroke?: string}} options
 * @returns {string[]} SVG path 片段（已按画家顺序排列）
 */
export function drawMesh(camera, mesh, options = {}) {
  const color = options.color ?? ACCENT
  const view = camera.viewDirection()
  const right = camera.rightDirection()
  const faces = []

  for (const face of mesh.faces) {
    const points = face.map((index) => mesh.vertices[index])
    if (points.length < 3) continue
    const normal = newellNormal(points)
    if (!normal) continue
    if (dot(normal, view) <= 1e-9) continue // 背面剔除
    const centroid = points
      .reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0])
      .map((c) => c / points.length)
    faces.push({ points, centroid, normal, depth: camera.depth(centroid) })
  }
  faces.sort((a, b) => a.depth - b.depth) // 远者先画

  return faces.map((face) => {
    const screen = face.points.map((p) => camera.project(p))
    const fill = toneFor(face.normal, color, right)
    return svgPath(polyPath(screen), {
      fill,
      stroke: options.stroke ?? darken(color, 0.35),
      strokeWidth: 0.8,
      opacity: options.opacity ?? 1,
    })
  })
}

/** 面朝向 → 色调：顶亮、右中、左暗。 */
function toneFor(normal, color, right) {
  if (normal[2] > 0.7) return lighten(color, 0.32)
  if (dot(normal, right) > 0) return color
  return darken(color, 0.2)
}

/** 等轴测立方体/长方体。 */
export function isoBox(camera, { x = 0, y = 0, z = 0, w = 1, d = 1, h = 1, color = ACCENT, opacity = 1 } = {}) {
  const vertices = [
    [x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z],
    [x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h],
  ]
  const faces = [
    [0, 3, 2, 1], [4, 5, 6, 7],
    [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
  ]
  return drawMesh(camera, { vertices, faces }, { color, opacity })
}

/**
 * 等轴测圆柱（解析绘制：侧面左右两调 + 顶面亮调）。
 *
 * 侧面沿正前方母线（底面前极值 → 顶面前极值）分左右两半，每半必须是
 * **单一闭合子路径**：历史 bug 曾用 M 开头的弧助手续接顶边，中途另起
 * 子路径，导致两半之间留下三角空隙（圆柱侧面可见缺口，能透过它看到
 * 场景中背后的物体），并多出一片多余的暗色透镜。
 * @param {{cx?: number, cy?: number, z?: number, r?: number, h?: number, color?: string, label?: string}} options
 */
export function isoCylinder(camera, { cx = 0, cy = 0, z = 0, r = 1, h = 1, color = ACCENT } = {}) {
  const rx = r * camera.unitX()
  const ry = r * camera.unitX() * camera.flatten()
  const bottom = camera.project([cx, cy, z])
  const top = camera.project([cx, cy, z + h])
  const be = ellipse(bottom[0], bottom[1], rx, ry)
  const te = ellipse(top[0], top[1], rx, ry)
  // 左半（暗色）：底左极值 → 底面前左弧（180°→90°）→ 前母线向上 →
  // 顶面前左弧（90°→180°）→ 沿左轮廓闭合
  const leftHalf = `M ${fmt(be.cx - be.rx)} ${fmt(be.cy)}`
    + ` ${ellipseArc(be, 180, 90)}`
    + ` L ${fmt(te.cx)} ${fmt(te.cy + te.ry)}`
    + ` ${ellipseArc(te, 90, 180)} Z`
  // 右半（基色）：底面前极值 → 底面前右弧（90°→0°）→ 右轮廓向上 →
  // 顶面前右弧（0°→90°）→ 沿前母线闭合
  const rightHalf = `M ${fmt(be.cx)} ${fmt(be.cy + be.ry)}`
    + ` ${ellipseArc(be, 90, 0)}`
    + ` L ${fmt(te.cx + te.rx)} ${fmt(te.cy)}`
    + ` ${ellipseArc(te, 0, 90)} Z`
  return [
    svgPath(leftHalf, { fill: darken(color, 0.2), stroke: darken(color, 0.4), strokeWidth: 0.8 }),
    svgPath(rightHalf, { fill: color, stroke: darken(color, 0.4), strokeWidth: 0.8 }),
    // 顶面
    svgPath(ellipsePath(te), { fill: lighten(color, 0.3), stroke: darken(color, 0.4), strokeWidth: 0.8 }),
  ]
}

/** 等轴测圆锥。 */
export function isoCone(camera, { cx = 0, cy = 0, z = 0, r = 1, h = 1, color = ACCENT } = {}) {
  const rx = r * camera.unitX()
  const ry = r * camera.unitX() * camera.flatten()
  const base = camera.project([cx, cy, z])
  const apex = camera.project([cx, cy, z + h])
  const be = ellipse(base[0], base[1], rx, ry)
  // 锥体：底左极值 → 锥顶 → 底右极值 → 底面前全弧（0°→180°，经过前方）→ 闭合
  const body = `M ${fmt(be.cx - be.rx)} ${fmt(be.cy)} L ${fmt(apex[0])} ${fmt(apex[1])} L ${fmt(be.cx + be.rx)} ${fmt(be.cy)} ${ellipseArc(be, 0, 180)} Z`
  const shade = `M ${fmt(be.cx - be.rx)} ${fmt(be.cy)} L ${fmt(apex[0])} ${fmt(apex[1])} L ${fmt(be.cx)} ${fmt(be.cy + be.ry)} Z`
  return [
    svgPath(body, { fill: color, stroke: darken(color, 0.4), strokeWidth: 0.8 }),
    svgPath(shade, { fill: darken(color, 0.2), stroke: 'none' }),
    svgPath(ellipsePath(be), { fill: lighten(color, 0.3), stroke: darken(color, 0.4), strokeWidth: 0.8 }),
  ]
}

/** 等轴测球（顶亮 crescent + 底面椭圆）。 */
export function isoSphere(camera, { cx = 0, cy = 0, z = 0, r = 1, color = ACCENT } = {}) {
  const center = camera.project([cx, cy, z])
  const rr = r * camera.unitX()
  const crescent = `M ${fmt(center[0] - rr * 0.72)} ${fmt(center[1] - rr * 0.28)} A ${fmt(rr * 0.95)} ${fmt(rr * 0.72)} 0 0 1 ${fmt(center[0] + rr * 0.72)} ${fmt(center[1] - rr * 0.28)} A ${fmt(rr * 0.95)} ${fmt(rr * 0.72)} 0 0 1 ${fmt(center[0] - rr * 0.72)} ${fmt(center[1] - rr * 0.28)} Z`
  return [
    svgCircle(center[0], center[1], rr, { fill: color, stroke: darken(color, 0.4), strokeWidth: 0.8 }),
    svgPath(crescent, { fill: lighten(color, 0.35), stroke: 'none' }),
    svgPath(`M ${fmt(center[0] - rr)} ${fmt(center[1])} A ${fmt(rr)} ${fmt(rr * 0.32)} 0 0 0 ${fmt(center[0] + rr)} ${fmt(center[1])}`, {
      fill: 'none',
      stroke: darken(color, 0.35),
      strokeWidth: 0.8,
    }),
  ]
}

/** 等轴测棱柱（任意 2D 足迹 + 顶底高度），用于斜面楔块等。 */
export function isoPrism(camera, footprint, z0, z1, { color = ACCENT } = {}) {
  const bottom = footprint.map(([x, y]) => [x, y, z0])
  const top = footprint.map(([x, y]) => [x, y, z1])
  const vertices = [...bottom, ...top]
  const n = footprint.length
  const faces = [[...Array.from({ length: n }, (_, i) => i)].reverse()]
  for (let i = 0; i < n; i += 1) {
    faces.push([i, (i + 1) % n, n + (i + 1) % n, n + i])
  }
  faces.push(Array.from({ length: n }, (_, i) => n + i))
  return drawMesh(camera, { vertices, faces }, { color })
}

/** 等轴测标签：世界坐标 → 屏幕文字。 */
export function isoLabel(camera, point, text, { size = 13, fill = INK, dy = -8, weight = '600' } = {}) {
  const [sx, sy] = camera.project(point)
  return svgText(sx, sy + dy, text, { size, fill, weight })
}

/**
 * 多物体场景的画家顺序：按每个物体的代表点深度排序（远者先画）。
 * @param {ReturnType<typeof createCamera>} camera
 * @param {Array<{at: number[], svg: string|string[]}>} items
 * @returns {string[]} 排序后的 SVG 片段
 */
export function sortScene(camera, items) {
  const decorated = items.map((item, index) => ({
    depth: camera.depth(item.at),
    index,
    parts: Array.isArray(item.svg) ? item.svg : [item.svg],
  }))
  decorated.sort((a, b) => a.depth - b.depth || a.index - b.index)
  return decorated.flatMap((item) => item.parts)
}

/** 等轴测箭头（世界坐标，用于受力/速度矢量）。 */
export function isoArrow(camera, from, to, { color = INK, label, labelOffset = [0, -10] } = {}) {
  const a = camera.project(from)
  const b = camera.project(to)
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0])
  const head = 7
  const wing = 0.42
  const p1 = [b[0] - head * Math.cos(angle - wing), b[1] - head * Math.sin(angle - wing)]
  const p2 = [b[0] - head * Math.cos(angle + wing), b[1] - head * Math.sin(angle + wing)]
  const parts = [
    svgLine(a[0], a[1], b[0], b[1], { stroke: color, strokeWidth: 1.6 }),
    svgPath(`M ${fmt(b[0])} ${fmt(b[1])} L ${fmt(p1[0])} ${fmt(p1[1])} L ${fmt(p2[0])} ${fmt(p2[1])} Z`, { fill: color }),
  ]
  if (label) {
    parts.push(svgText(b[0] + labelOffset[0], b[1] + labelOffset[1], label, { size: 12, fill: color, weight: '600' }))
  }
  return parts
}

/* ================================================================== */
/* 五、平面示意图（2D，y 向上）                                          */
/* ================================================================== */

/**
 * 创建 2D 坐标系（数学惯例 y 向上）。
 * @param {{width: number, height: number, xRange: [number,number], yRange: [number,number]}} options
 */
export function createPlot({ width = 640, height = 420, xRange = [-5, 5], yRange = [-5, 5] }) {
  const [x0, x1] = xRange
  const [y0, y1] = yRange
  const sx = width / (x1 - x0)
  const sy = height / (y1 - y0)
  return {
    width,
    height,
    xRange,
    yRange,
    to([x, y]) {
      return [(x - x0) * sx, height - (y - y0) * sy]
    },
    sx,
    sy,
  }
}

/** 坐标网格 + 轴。 */
export function plotAxes(plot, { xLabel = 'x', yLabel = 'y', grid = true } = {}) {
  const parts = []
  const [ox, oy] = plot.to([0, 0])
  if (grid) {
    for (let x = Math.ceil(plot.xRange[0]); x <= plot.xRange[1]; x += 1) {
      if (x === 0) continue
      const [px] = plot.to([x, 0])
      parts.push(svgLine(px, 0, px, plot.height, { stroke: GRID, strokeWidth: 0.6 }))
    }
    for (let y = Math.ceil(plot.yRange[1]); y <= plot.yRange[1]; y += 1) {
      if (y === 0) continue
      const [, py] = plot.to([0, y])
      parts.push(svgLine(0, py, plot.width, py, { stroke: GRID, strokeWidth: 0.6 }))
    }
  }
  parts.push(svgLine(0, oy, plot.width, oy, { stroke: INK, strokeWidth: 1.2 }))
  parts.push(svgLine(ox, 0, ox, plot.height, { stroke: INK, strokeWidth: 1.2 }))
  parts.push(svgText(plot.width - 8, oy - 8, xLabel, { size: 13, anchor: 'end' }))
  parts.push(svgText(ox + 10, 14, yLabel, { size: 13, anchor: 'start' }))
  return parts
}

/** 函数曲线（采样折线，足够密即可视作光滑）。 */
export function plotCurve(plot, f, { from, to, steps = 240, color = ACCENT, strokeWidth = 2, dash = '' } = {}) {
  const a = from ?? plot.xRange[0]
  const b = to ?? plot.xRange[1]
  const segments = []
  let points = []
  for (let i = 0; i <= steps; i += 1) {
    const x = a + ((b - a) * i) / steps
    const y = f(x)
    if (!Number.isFinite(y)) {
      if (points.length >= 2) segments.push(points)
      points = []
      continue
    }
    points.push(plot.to([x, y]))
  }
  if (points.length >= 2) segments.push(points)
  if (!segments.length) return []
  return [svgPath(segments.map(segment => polyPath(segment, false)).join(' '), { fill: 'none', stroke: color, strokeWidth, dash })]
}

/** 2D 点 + 标签。 */
export function plotPoint(plot, [x, y], label, { color = INK, r = 3.5, dy = -10 } = {}) {
  const [px, py] = plot.to([x, y])
  const parts = [svgCircle(px, py, r, { fill: color })]
  if (label) parts.push(svgText(px, py + dy, label, { size: 13, fill: color, weight: '600' }))
  return parts
}

/** 2D 线段/折线。 */
export function plotPolyline(plot, points, { color = INK, strokeWidth = 1.6, dash = '', close = false } = {}) {
  const screen = points.map((p) => plot.to(p))
  return [svgPath(polyPath(screen, close), { fill: 'none', stroke: color, strokeWidth, dash })]
}

/** 2D 圆（数学坐标系）。 */
export function plotCircle(plot, center, radius, { color = INK, strokeWidth = 1.6, fill = 'none', dash = '' } = {}) {
  const [cx, cy] = plot.to(center)
  const rx = radius * plot.sx
  const ry = radius * plot.sy
  if (Math.abs(rx - ry) < 0.01) {
    return [svgCircle(cx, cy, rx, { fill, stroke: color, strokeWidth, dash })]
  }
  return [svgPath(ellipsePath({ cx, cy, rx, ry }), { fill, stroke: color, strokeWidth, dash })]
}

/** 直角标记（顶点在 p，两边方向 u/v）。 */
export function plotRightAngle(plot, p, u, v, { size = 0.4, color = INK } = {}) {
  const a = [p[0] + u[0] * size, p[1] + u[1] * size]
  const b = [p[0] + u[0] * size + v[0] * size, p[1] + u[1] * size + v[1] * size]
  const c = [p[0] + v[0] * size, p[1] + v[1] * size]
  return plotPolyline(plot, [a, b, c], { color, strokeWidth: 1.2 })
}

/** 角度弧线标注。 */
export function plotAngleArc(plot, vertex, from, to, { radius = 1, color = INK, label } = {}) {
  const a0 = Math.atan2(from[1] - vertex[1], from[0] - vertex[0])
  const a1 = Math.atan2(to[1] - vertex[1], to[0] - vertex[0])
  const steps = 24
  const points = []
  for (let i = 0; i <= steps; i += 1) {
    const angle = a0 + ((a1 - a0) * i) / steps
    points.push([vertex[0] + radius * Math.cos(angle), vertex[1] + radius * Math.sin(angle)])
  }
  const parts = plotPolyline(plot, points, { color, strokeWidth: 1.2 })
  if (label) {
    const mid = a0 + (a1 - a0) / 2
    const [lx, ly] = plot.to([vertex[0] + (radius + 0.35) * Math.cos(mid), vertex[1] + (radius + 0.35) * Math.sin(mid)])
    parts.push(svgText(lx, ly + 4, label, { size: 12, color }))
  }
  return parts
}

/* ================================================================== */
/* 六、物理装置示意图                                                   */
/* ================================================================== */

/**
 * 斜面+滑块（等轴测）：直角三角形截面（x-z 平面，沿 y 宽度拉伸）的楔块 +
 * 贴在斜面上的滑块 + 受力箭头。斜边从 (0, y, 0) 升至 (L·cosθ, y, L·sinθ)，
 * 倾角即 angleDeg；滑块位于斜面中线 blockAt 处（0=底端，1=顶端）。
 *
 * 受力两种给法：
 *   forces: [{from, to, label, color}]       —— 世界坐标起末点（旧式）
 *   namedForces: ['G', 'N']                  —— 命名力，G 竖直向下、N 沿斜面外法向
 * showBlock: false 时不画滑块与滑块标签（供动画场景把滑块包进平移组）。
 * @param {{angleDeg?: number, length?: number, width?: number,
 *          forces?: Array<{from: number[], to: number[], label?: string, color?: string}>,
 *          namedForces?: string[], blockLabel?: string, blockAt?: number,
 *          showBlock?: boolean,
 *          color?: string, blockColor?: string}} options
 */
export function figureIncline({
  angleDeg = 30,
  length = 8,
  width = 3,
  forces = [],
  namedForces = [],
  blockLabel,
  blockAt = 0.5,
  showBlock = true,
  color = PALETTE.teal,
  blockColor = PALETTE.amber,
} = {}) {
  const theta = (angleDeg * Math.PI) / 180
  const sinT = Math.sin(theta)
  const cosT = Math.cos(theta)
  const run = length * cosT // 斜面水平投影长
  const rise = length * sinT // 斜面垂直高
  // 楔块六顶点：底面矩形（z=0）+ 垂直面顶棱（x=run, z=rise）
  const vertices = [
    [0, 0, 0], [run, 0, 0], [run, width, 0], [0, width, 0],
    [run, 0, rise], [run, width, rise],
  ]
  const faces = [
    [0, 3, 2, 1], // 底面（法线 −z）
    [0, 1, 4], // 背面 y=0（法线 −y）
    [2, 3, 5], // 正面 y=width（法线 +y）
    [0, 4, 5, 3], // 斜面（外向法线 (−sinθ, 0, cosθ)）
    [1, 2, 5, 4], // 垂直面 x=run（法线 +x）
  ]
  // 滑块：贴在斜面中线上，沿外法向抬升半个身位
  const t = Math.min(1, Math.max(0, blockAt))
  const surface = [t * run, width / 2, t * rise]
  const blockSize = 0.9
  const blockCenter = [
    surface[0] - sinT * (blockSize / 2 + 0.05),
    surface[1],
    surface[2] + cosT * (blockSize / 2 + 0.05),
  ]
  const normal = [-sinT, 0, cosT]
  const forceEnd = (dir, len = 1.5) => {
    const norm = Math.hypot(dir[0], dir[1], dir[2]) || 1
    return [
      blockCenter[0] + (dir[0] / norm) * len,
      blockCenter[1] + (dir[1] / norm) * len,
      blockCenter[2] + (dir[2] / norm) * len,
    ]
  }
  const NAMED_FORCE_DIRS = {
    G: () => [0, 0, -1],
    N: () => normal,
  }
  const NAMED_FORCE_COLORS = { G: PALETTE.red, N: PALETTE.accent }
  return {
    /** @param {ReturnType<typeof createCamera>} camera */
    render(camera) {
      const parts = []
      // 地面
      parts.push(...isoBox(camera, { x: -2, y: -1.5, z: 0, w: length + 6, d: width + 3, h: 0.25, color: PALETTE.panel }))
      // 斜面楔块
      parts.push(...drawMesh(camera, { vertices, faces }, { color }))
      // 斜面中线（辅助线）
      parts.push(...isoArrow(camera, [0, width / 2, 0], [run, width / 2, rise], { color: INK_SOFT }))
      // 滑块（贴在斜面上的小立方体；showBlock=false 时由动画场景自行包组）
      if (showBlock) {
        parts.push(...isoBox(camera, {
          x: blockCenter[0] - blockSize / 2,
          y: blockCenter[1] - blockSize / 2,
          z: blockCenter[2] - blockSize / 2,
          w: blockSize,
          d: blockSize,
          h: blockSize,
          color: blockColor,
        }))
        if (blockLabel) {
          parts.push(isoLabel(camera, [blockCenter[0], blockCenter[1], blockCenter[2] + blockSize * 0.9], blockLabel))
        }
      }
      for (const name of namedForces) {
        const dir = NAMED_FORCE_DIRS[name]
        if (!dir) continue
        parts.push(...isoArrow(camera, blockCenter, forceEnd(dir()), {
          color: NAMED_FORCE_COLORS[name] ?? PALETTE.red,
          label: name,
        }))
      }
      for (const force of forces) {
        parts.push(...isoArrow(camera, force.from, force.to, { color: force.color ?? PALETTE.red, label: force.label }))
      }
      return parts
    },
    /** 估算 fit 用点集（含地面范围与楔块最高点）。 */
    outlinePoints() {
      return [
        [-2, -1.5, 0], [length + 4, -1.5, 0], [-2, width + 1.5, 0], [length + 4, width + 1.5, 0],
        [-2, -1.5, rise], [length + 4, -1.5, rise], [-2, width + 1.5, rise], [length + 4, width + 1.5, rise],
      ]
    },
    /** 滑块中心（世界坐标）——供调用者按 from/to 挂受力箭头。 */
    blockCenter: () => [...blockCenter],
    /** 斜面外法向（单位向量）——支持力 N 的方向。 */
    normalDirection: () => [...normal],
    /** 从滑块中心沿 dir 方向伸出 len 的端点（世界坐标）。 */
    forceEnd: (dir, len) => forceEnd(dir, len),
    /** 几何数据（世界坐标）——供动画场景复用同一套楔块模型。 */
    geometry: () => ({
      vertices, faces, surface, run, rise, sinT, cosT, width, length,
      blockSize, blockCenter: [...blockCenter], normal: [...normal],
    }),
  }
}

/**
 * 串联电路示意（2D 电路图惯例）。
 * @param {{battery?: number, resistors?: number[], showAmmeter?: boolean, showVoltmeter?: boolean}} options
 */
export function figureCircuit({
  resistors = [10, 20],
  showAmmeter = true,
  showVoltmeter = false,
} = {}) {
  const W = 560
  const H = 320
  const parts = []
  const left = 120
  const right = 440
  const top = 70
  const bottom = 240
  // 外框导线
  parts.push(svgLine(left, top, right, top, { stroke: INK, strokeWidth: 1.8 }))
  parts.push(svgLine(left, top, left, bottom - 46, { stroke: INK, strokeWidth: 1.8 }))
  parts.push(svgLine(left, bottom - 32, left, bottom, { stroke: INK, strokeWidth: 1.8 }))
  parts.push(svgLine(right, top, right, bottom, { stroke: INK, strokeWidth: 1.8 }))
  parts.push(svgLine(left, bottom, right, bottom, { stroke: INK, strokeWidth: 1.8 }))
  // 电源（左侧，长正短负）
  parts.push(svgLine(left - 16, bottom - 46, left + 16, bottom - 46, { stroke: INK, strokeWidth: 3 }))
  parts.push(svgLine(left - 9, bottom - 32, left + 9, bottom - 32, { stroke: INK, strokeWidth: 3 }))
  parts.push(svgText(left, bottom - 58, '电源', { size: 12 }))
  // 电阻（顶部，n 个矩形——人教版课本符号，白底遮住下方导线）
  const count = Math.max(1, resistors.length)
  const segment = (right - left) / count
  resistors.forEach((_, index) => {
    const x0 = left + index * segment
    const x1 = x0 + segment
    const midY = top
    const rw = Math.min(56, segment * 0.4)
    const rh = 22
    const cx = (x0 + x1) / 2
    parts.push(svgRect(cx - rw / 2, midY - rh / 2, rw, rh, { fill: PAPER, stroke: INK, strokeWidth: 1.6 }))
    parts.push(svgText(cx, midY - rh / 2 - 8, `R${index + 1}`, { size: 12 }))
  })
  // 电流表（右下）
  if (showAmmeter) {
    parts.push(svgCircle(right, bottom - 60, 16, { fill: PAPER, stroke: INK, strokeWidth: 1.6 }))
    parts.push(svgText(right, bottom - 56, 'A', { size: 13, weight: '600' }))
  }
  // 电压表（与第一个电阻并联）
  if (showVoltmeter) {
    parts.push(svgLine(left + segment / 2, top, left + segment / 2, top - 50, { stroke: INK, strokeWidth: 1.4 }))
    parts.push(svgCircle(left + segment / 2, top - 66, 16, { fill: PAPER, stroke: INK, strokeWidth: 1.6 }))
    parts.push(svgText(left + segment / 2, top - 62, 'V', { size: 13, weight: '600' }))
  }
  // 电流方向箭头（左上角导线空白段，避开第一个电阻）
  parts.push(svgLine(left + 6, top, left + 36, top, { stroke: PALETTE.accent, strokeWidth: 1.4 }))
  return { width: W, height: H, parts }
}

/**
 * 凸透镜成像光路（2D）：主轴、透镜、平行光线、焦点、像。
 * @param {{f?: number, u?: number, objectHeight?: number}} options
 */
export function figureOptics({ f = 10, u = 30, objectHeight = 3 } = {}) {
  const W = 620
  const H = 300
  const axisY = 170
  const lensX = 300
  const focalOffset = 60 // f=10 → 60px
  const parts = []
  // 主轴
  parts.push(svgLine(20, axisY, W - 20, axisY, { stroke: INK_SOFT, strokeWidth: 1, dash: '6 4' }))
  // 透镜（双凸轮廓）
  const lensPath = `M ${lensX} ${axisY - 90} Q ${lensX + 26} ${axisY} ${lensX} ${axisY + 90} Q ${lensX - 26} ${axisY} ${lensX} ${axisY - 90} Z`
  parts.push(svgPath(lensPath, { fill: 'rgba(37,99,235,0.10)', stroke: ACCENT, strokeWidth: 1.8 }))
  parts.push(svgText(lensX, axisY - 100, '凸透镜', { size: 12, fill: ACCENT }))
  // 焦点
  const fLeft = lensX - focalOffset
  const fRight = lensX + focalOffset
  parts.push(svgCircle(fLeft, axisY, 3, { fill: INK }))
  parts.push(svgCircle(fRight, axisY, 3, { fill: INK }))
  parts.push(svgText(fLeft, axisY + 20, 'F', { size: 12 }))
  parts.push(svgText(fRight, axisY + 20, "F'", { size: 12 }))
  // 物体（主轴左侧箭头）
  const objectX = lensX - (u / 10) * focalOffset
  parts.push(svgLine(objectX, axisY, objectX, axisY - objectHeight * 18, { stroke: PALETTE.amber, strokeWidth: 2.4 }))
  parts.push(svgText(objectX, axisY - objectHeight * 18 - 8, '物', { size: 12, fill: PALETTE.amber }))
  // 三条特征光线
  const objectTop = [objectX, axisY - objectHeight * 18]
  // 1) 平行主轴 → 过右焦点
  parts.push(svgLine(objectTop[0], objectTop[1], lensX, objectTop[1], { stroke: PALETTE.red, strokeWidth: 1.4 }))
  const slope = (axisY - objectTop[1]) / (fRight - lensX)
  parts.push(svgLine(lensX, objectTop[1], fRight + 90, axisY + slope * 90, { stroke: PALETTE.red, strokeWidth: 1.4 }))
  // 2) 过左焦点 → 平行主轴
  const slope2 = (axisY - objectTop[1]) / (lensX - fLeft)
  parts.push(svgLine(fLeft, axisY, lensX, objectTop[1], { stroke: PALETTE.green, strokeWidth: 1.4 }))
  parts.push(svgLine(lensX, objectTop[1], lensX + 130, objectTop[1], { stroke: PALETTE.green, strokeWidth: 1.4 }))
  // 3) 过光心 → 方向不变
  parts.push(svgLine(objectTop[0], objectTop[1], lensX + 160, axisY + (axisY - objectTop[1]) * (160 / (lensX - objectX)), {
    stroke: PALETTE.purple,
    strokeWidth: 1.4,
  }))
  return { width: W, height: H, parts }
}

/**
 * 定滑轮组（2D）：支架、滑轮、绳、两重物。
 * @param {{leftMass?: string, rightMass?: string}} options
 */
export function figurePulley({ leftMass = 'm₁', rightMass = 'm₂' } = {}) {
  const W = 380
  const H = 300
  const parts = []
  const pulleyY = 70
  const pulleyX = 190
  // 支架
  parts.push(svgLine(60, 260, 60, pulleyY, { stroke: INK, strokeWidth: 2 }))
  parts.push(svgLine(320, 260, 320, pulleyY, { stroke: INK, strokeWidth: 2 }))
  parts.push(svgLine(60, pulleyY, 320, pulleyY, { stroke: INK, strokeWidth: 2 }))
  // 滑轮
  parts.push(svgCircle(pulleyX, pulleyY + 14, 16, { fill: PAPER, stroke: INK, strokeWidth: 2 }))
  parts.push(svgCircle(pulleyX, pulleyY + 14, 3, { fill: INK }))
  // 绳与重物
  parts.push(svgLine(pulleyX - 16, pulleyY + 14, 110, pulleyY + 14, { stroke: INK, strokeWidth: 1.6 }))
  parts.push(svgLine(pulleyX + 16, pulleyY + 14, 270, pulleyY + 14, { stroke: INK, strokeWidth: 1.6 }))
  parts.push(svgLine(110, pulleyY + 14, 110, pulleyY + 100, { stroke: INK, strokeWidth: 1.6 }))
  parts.push(svgLine(270, pulleyY + 14, 270, pulleyY + 100, { stroke: INK, strokeWidth: 1.6 }))
  parts.push(svgRect(88, pulleyY + 100, 44, 36, { fill: PALETTE.panel, stroke: INK, strokeWidth: 1.4, rx: 4 }))
  parts.push(svgRect(248, pulleyY + 100, 44, 36, { fill: PALETTE.panel, stroke: INK, strokeWidth: 1.4, rx: 4 }))
  parts.push(svgText(110, pulleyY + 124, leftMass, { size: 14, weight: '600' }))
  parts.push(svgText(270, pulleyY + 124, rightMass, { size: 14, weight: '600' }))
  return { width: W, height: H, parts }
}

/** 把 2D 装置图包装进卡片。 */
export function schematicCard(device, { fig, title, hint, readout, background = PAPER } = {}) {
  const body = [
    svgRect(18, 18, device.width - 36, device.height - 36, { fill: background, stroke: GRID, strokeWidth: 1, rx: 14 }),
    ...(fig !== undefined ? [svgText(34, 46, `Fig ${fig}`, { size: 13, fill: INK_SOFT, anchor: 'start' })] : []),
    ...(title ? [svgText(device.width - 34, 46, title, { size: 14, anchor: 'end', weight: '600' })] : []),
    ...(hint ? [svgText(34, device.height - 32, hint, { size: 12, fill: INK_SOFT, anchor: 'start' })] : []),
    ...(readout ? [svgText(device.width - 34, device.height - 32, readout, { size: 13, fill: ACCENT, anchor: 'end', weight: '600' })] : []),
    ...device.parts,
  ]
  return svgDocument({ width: device.width, height: device.height, body: body.join('\n'), background })
}

/* ================================================================== */
/* 七、动画场景（SMIL；模型驱动，零 JS 运行时）                            */
/* ================================================================== */

/**
 * 匀变速运动动画（真实时间：动画 1 秒 = 模型 1 秒）。
 * 模型：v(t) = v0 + a·t，s(t) = v0·t + ½·a·t²——values 由模型逐帧采样，
 * 浏览器只做线性播放。右侧 v 标尺游标实时指示速度（读数不闪动，
 * 用游标位置表达，对应刻度即当前值）。
 *
 * @param {{kind?: 'incline'|'freefall', a?: number, v0?: number, duration?: number,
 *          angleDeg?: number, length?: number, width?: number, fps?: number,
 *          easing?: string, vMax?: number, unit?: string, blockLabel?: string,
 *          dropHeight?: number, g?: number}} options
 */
export function figureMotionTrack({
  kind = 'incline',
  a = 2,
  v0 = 0,
  duration = 2,
  angleDeg = 30,
  length = 8,
  width = 3,
  fps = 30,
  easing = 'linear', // 物理时间用 linear：速度变化本身已含匀加速信息
  vMax,
  unit = 'm/s',
  blockLabel = 'm',
  dropHeight = 6,
} = {}) {
  const modelS = (t) => v0 * t + 0.5 * a * t * t
  const modelV = (t) => v0 + a * t
  // 轨道末端到达时间：到达斜面底端/地面即停（s(t*)=轨道长），
  // 避免滑块冲出斜面或小球穿地——动画只展示完整运动过程。
  const trackLength = kind === 'freefall' ? dropHeight : length
  let tEnd = duration
  if (a > 1e-12 && v0 >= 0) {
    const tStop = (-v0 + Math.sqrt(v0 * v0 + 2 * a * trackLength)) / a
    if (tStop > 1e-6 && tStop < duration) tEnd = Math.round(tStop * 1000) / 1000
  }
  const vEnd = v0 + a * tEnd
  const range = vMax ?? (Math.max(5, Math.ceil(Math.max(Math.abs(v0), Math.abs(vEnd)) / 5) * 5))

  if (kind === 'freefall') {
    // 自由落体：竖直轨道 + 下落小球 + v 标尺（世界 z 向）
    const trackX = 2
    return {
      render(camera) {
        const parts = []
        // 轨道与地面
        const top = camera.project([trackX, width / 2, dropHeight])
        const bottom = camera.project([trackX, width / 2, 0])
        parts.push(svgLine(top[0], top[1], bottom[0], bottom[1], { stroke: INK_SOFT, strokeWidth: 1, dash: '4 4' }))
        parts.push(...isoBox(camera, { x: -1.5, y: -1, z: 0, w: 6, d: width + 2, h: 0.25, color: PALETTE.panel }))
        // 释放点标记
        parts.push(blink(top[0], top[1], { r: 3, color: PALETTE.amber, duration: 1.4 }))
        parts.push(svgText(top[0] - 14, top[1] + 4, '释放点', { size: 11, fill: INK_SOFT, anchor: 'end' }))
        // 下落小球（世界 z = dropHeight − s(t)）
        const ballR = 0.45
        const track = modelTrack({
          duration: tEnd, fps, easing,
          at: (e) => {
            const z = dropHeight - modelS(e * tEnd)
            const p = camera.project([trackX, width / 2, z])
            return [p[0] - bottom[0], p[1] - bottom[1]]
          },
        })
      parts.push(
        `<g transform="translate(${bottom[0]} ${bottom[1]})">`
        + animateTransform({ type: 'translate', values: track.values, keyTimes: track.keyTimes, duration: track.duration })
          + svgCircle(0, 0, ballR * 34, { fill: PALETTE.amber, stroke: '#92400e', strokeWidth: 1 })
          + '</g>',
        )
        // v 标尺（右侧竖直）
        const rulerX = trackX + 3.2
        const rBase = camera.project([rulerX, width / 2, 0])
        const rTop = camera.project([rulerX, width / 2, dropHeight])
        parts.push(svgLine(rBase[0], rBase[1], rTop[0], rTop[1], { stroke: INK, strokeWidth: 1.4 }))
        for (let i = 0; i <= 5; i += 1) {
          const v = (range * i) / 5
          const p = camera.project([rulerX, width / 2, (dropHeight * v) / range])
          parts.push(svgLine(p[0], p[1], p[0] + 7, p[1], { stroke: INK_SOFT, strokeWidth: 1 }))
          parts.push(svgText(p[0] + 11, p[1] + 4, String(v), { size: 10, fill: INK_SOFT, anchor: 'start' }))
        }
        parts.push(svgText(rTop[0] - 6, rTop[1] - 10, `v/${unit}`, { size: 11, fill: INK_SOFT, anchor: 'start' }))
        // 游标（位置 ∝ v(t)）
        const cursorTrack = modelTrack({
          duration: tEnd, fps, easing,
          at: (e) => {
            const p = camera.project([rulerX + 0.55, width / 2, (dropHeight * modelV(e * tEnd)) / range])
            return [p[0] - rBase[0], p[1] - rBase[1]]
          },
        })
      parts.push(
        `<g>`
        + animateTransform({ type: 'translate', values: cursorTrack.values, keyTimes: cursorTrack.keyTimes, duration: cursorTrack.duration })
          + svgPath(`M -6 0 L 6 0 L 0 7 Z`, { fill: ACCENT })
          + '</g>',
        )
        return parts
      },
      outlinePoints() {
        return [
          [-1.5, -1, 0], [4.5, -1, 0], [-1.5, width + 1, 0], [4.5, width + 1, 0],
          [-1.5, -1, dropHeight], [4.5, -1, dropHeight], [-1.5, width + 1, dropHeight], [4.5, width + 1, dropHeight],
        ]
      },
    }
  }

  // 斜面版：楔块静态，滑块 + G/N 打包进平移组（沿坡位移 s(t)）
  const incline = figureIncline({ angleDeg, length, width, showBlock: false })
  const geo = incline.geometry()
  return {
    render(camera) {
      const parts = []
      // 地面 + 楔块 + 斜面中线（静态层）
      parts.push(...isoBox(camera, { x: -2, y: -1.5, z: 0, w: length + 6, d: width + 3, h: 0.25, color: PALETTE.panel }))
      parts.push(...drawMesh(camera, { vertices: geo.vertices, faces: geo.faces }, { color: PALETTE.teal }))
      parts.push(...isoArrow(camera, [0, width / 2, 0], [geo.run, width / 2, geo.rise], { color: INK_SOFT }))
      // 沿坡位移 → 屏幕位移（等轴测下非线性，故逐帧换算）
      const origin = camera.project([0, width / 2, 0])
      const screenDelta = (s) => {
        const p = camera.project([s * geo.cosT, width / 2, s * geo.sinT])
        return [p[0] - origin[0], p[1] - origin[1]]
      }
      const track = modelTrack({
        duration: tEnd, fps, easing,
        at: (e) => {
          const s = modelS(e * tEnd)
          const d = screenDelta(s)
          return [d[0], d[1]]
        },
      })
      // 滑块 + 受力（G 竖直、N 沿法向；随滑块平移）
      const center = geo.blockCenter
      const blockParts = [
        ...isoBox(camera, {
          x: center[0] - geo.blockSize / 2,
          y: center[1] - geo.blockSize / 2,
          z: center[2] - geo.blockSize / 2,
          w: geo.blockSize,
          d: geo.blockSize,
          h: geo.blockSize,
          color: PALETTE.amber,
        }),
      ]
      if (blockLabel) {
        blockParts.push(isoLabel(camera, [center[0], center[1], center[2] + geo.blockSize * 0.9], blockLabel))
      }
      blockParts.push(...isoArrow(camera, center, [
        center[0], center[1], center[2] - 1.6,
      ], { color: PALETTE.red, label: 'G' }))
      blockParts.push(...isoArrow(camera, center, [
        center[0] + geo.normal[0] * 1.5,
        center[1] + geo.normal[1] * 1.5,
        center[2] + geo.normal[2] * 1.5,
      ], { color: ACCENT, label: 'N' }))
      parts.push(
        `<g>`
        + animateTransform({ type: 'translate', values: track.values, keyTimes: track.keyTimes, duration: track.duration })
        + blockParts.join('\n')
        + '</g>',
      )
      // v 标尺（楔块右侧，世界 z 向）
      const rulerX = geo.run + 2.4
      const rBase = camera.project([rulerX, width / 2, 0])
      const rTop = camera.project([rulerX, width / 2, geo.rise])
      parts.push(svgLine(rBase[0], rBase[1], rTop[0], rTop[1], { stroke: INK, strokeWidth: 1.4 }))
      for (let i = 0; i <= 5; i += 1) {
        const v = (range * i) / 5
        const p = camera.project([rulerX, width / 2, (geo.rise * v) / range])
        parts.push(svgLine(p[0], p[1], p[0] + 7, p[1], { stroke: INK_SOFT, strokeWidth: 1 }))
        parts.push(svgText(p[0] + 11, p[1] + 4, String(v), { size: 10, fill: INK_SOFT, anchor: 'start' }))
      }
      parts.push(svgText(rTop[0] - 6, rTop[1] - 10, `v/${unit}`, { size: 11, fill: INK_SOFT, anchor: 'start' }))
      const cursorTrack = modelTrack({
        duration: tEnd, fps, easing,
        at: (e) => {
          const p = camera.project([rulerX + 0.55, width / 2, (geo.rise * modelV(e * tEnd)) / range])
          return [p[0] - rBase[0], p[1] - rBase[1]]
        },
      })
      parts.push(
        `<g>`
        + animateTransform({ type: 'translate', values: cursorTrack.values, keyTimes: cursorTrack.keyTimes, duration: cursorTrack.duration })
        + svgPath('M -6 0 L 6 0 L 0 7 Z', { fill: ACCENT })
        + '</g>',
      )
      return parts
    },
    outlinePoints: incline.outlinePoints,
  }
}

/**
 * 串联电路电流流动动画：发光粒子沿回路循环流动，周期 ∝ 1/I
 * （电流越大流动越快——由图同一个模型驱动）。
 * @param {{resistors?: number[], current?: number, duration?: number, showAmmeter?: boolean}} options
 */
export function figureCircuitFlow({
  resistors = [10, 20],
  current = 0.4,
  duration = 2.4,
  showAmmeter = true,
} = {}) {
  const left = 120
  const right = 440
  const top = 70
  const bottom = 240
  const parts = []
  // 外框导线（与 figureCircuit 同坐标）
  parts.push(svgLine(left, top, right, top, { stroke: INK, strokeWidth: 1.8 }))
  parts.push(svgLine(left, top, left, bottom - 46, { stroke: INK, strokeWidth: 1.8 }))
  parts.push(svgLine(left, bottom - 32, left, bottom, { stroke: INK, strokeWidth: 1.8 }))
  parts.push(svgLine(right, top, right, bottom, { stroke: INK, strokeWidth: 1.8 }))
  parts.push(svgLine(left, bottom, right, bottom, { stroke: INK, strokeWidth: 1.8 }))
  // 电源（长正短负，正极在左）
  parts.push(svgLine(left - 16, bottom - 46, left + 16, bottom - 46, { stroke: INK, strokeWidth: 3 }))
  parts.push(svgLine(left - 9, bottom - 32, left + 9, bottom - 32, { stroke: INK, strokeWidth: 3 }))
  parts.push(svgText(left, bottom - 58, '电源', { size: 12 }))
  // 电阻（人教版矩形符号）
  const count = Math.max(1, resistors.length)
  const segment = (right - left) / count
  resistors.forEach((_, index) => {
    const cx = left + (index + 0.5) * segment
    const rw = Math.min(56, segment * 0.4)
    parts.push(svgRect(cx - rw / 2, top - 11, rw, 22, { fill: PAPER, stroke: INK, strokeWidth: 1.6 }))
    parts.push(svgText(cx, top - 20, `R${index + 1}`, { size: 12 }))
  })
  if (showAmmeter) {
    parts.push(svgCircle(right, bottom - 60, 16, { fill: PAPER, stroke: INK, strokeWidth: 1.6 }))
    parts.push(svgText(right, bottom - 56, 'A', { size: 13, weight: '600' }))
  }
  // 回路路径（从电源正极出发，顺时针）
  const loopPath = `M ${left} ${bottom - 46} L ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} L ${left} ${bottom - 32}`
  // 电流粒子：3 个错相循环，速度 ∝ current（0.4A → 2.4s 一圈）
  const speed = Math.max(0.6, Math.min(6, 0.4 / Math.max(current, 0.05)))
  const dots = 3
  for (let i = 0; i < dots; i += 1) {
    const begin = Math.round(((i * speed) / dots) * 100) / 100
    parts.push(
      `<circle r="5" fill="${PALETTE.red}" opacity="0.9">`
      + animateMotion({ path: loopPath, duration: speed, begin: `${begin}s` })
      + '</circle>',
    )
  }
  // 电流方向 blink 箭头（顶部导线空白段）
  parts.push(svgLine(left + 6, top, left + 36, top, { stroke: PALETTE.accent, strokeWidth: 1.4 }))
  parts.push(svgPath(`M ${left + 36} ${top} l -7 -4 l 0 8 Z`, { fill: PALETTE.accent }))
  parts.push(blink(left + 52, top - 12, { r: 3, color: PALETTE.accent, duration: speed / 3 }))
  parts.push(svgText(left + 62, top - 8, `I ≈ ${current} A`, { size: 11, fill: INK_SOFT, anchor: 'start' }))
  return { width: 560, height: 320, parts }
}

/**
 * 凸透镜光路绘制动画：三条特殊光线依次画出（错相 begin），
 * 随后像点脉冲高亮。光线路径与 figureOptics 同一套几何。
 * @param {{f?: number, u?: number, objectHeight?: number}} options
 */
export function figureOpticsAnim({ f = 10, u = 30, objectHeight = 3 } = {}) {
  const W = 620
  const H = 300
  const axisY = 170
  const lensX = 300
  const focalOffset = 60
  const parts = []
  // 主轴 / 透镜 / 焦点 / 物体（静态层）
  parts.push(svgLine(20, axisY, W - 20, axisY, { stroke: INK_SOFT, strokeWidth: 1, dash: '6 4' }))
  const lensPath = `M ${lensX} ${axisY - 90} Q ${lensX + 26} ${axisY} ${lensX} ${axisY + 90} Q ${lensX - 26} ${axisY} ${lensX} ${axisY - 90} Z`
  parts.push(svgPath(lensPath, { fill: 'rgba(37,99,235,0.10)', stroke: ACCENT, strokeWidth: 1.8 }))
  parts.push(svgText(lensX, axisY - 100, '凸透镜', { size: 12, fill: ACCENT }))
  const fLeft = lensX - focalOffset
  const fRight = lensX + focalOffset
  parts.push(svgCircle(fLeft, axisY, 3, { fill: INK }))
  parts.push(svgCircle(fRight, axisY, 3, { fill: INK }))
  parts.push(svgText(fLeft, axisY + 20, 'F', { size: 12 }))
  parts.push(svgText(fRight, axisY + 20, "F'", { size: 12 }))
  const objectX = lensX - (u / 10) * focalOffset
  const objectTop = [objectX, axisY - objectHeight * 18]
  parts.push(svgLine(objectX, axisY, objectTop[0], objectTop[1], { stroke: PALETTE.amber, strokeWidth: 2.4 }))
  parts.push(svgText(objectX, objectTop[1] - 8, '物', { size: 12, fill: PALETTE.amber }))

  // 三条特征光线（依次画出）
  const slope = (axisY - objectTop[1]) / (fRight - lensX)
  const ray1End = [fRight + 90, axisY + slope * 90]
  parts.push(drawPolyline([objectTop, [lensX, objectTop[1]], ray1End], {
    duration: 1.1, begin: '0.2s', color: PALETTE.red, width: 1.4,
  }).svg)
  parts.push(drawPolyline([[fLeft, axisY], [lensX, objectTop[1]], [lensX + 130, objectTop[1]]], {
    duration: 1.1, begin: '1.1s', color: PALETTE.green, width: 1.4,
  }).svg)
  const ray3EndY = axisY + (axisY - objectTop[1]) * (160 / (lensX - objectX))
  parts.push(drawPolyline([objectTop, [lensX + 160, ray3EndY]], {
    duration: 1.1, begin: '2.0s', color: PALETTE.purple, width: 1.4,
  }).svg)

  // 像点（透镜公式 1/f = 1/u + 1/v；u>f 时成实像）
  if (u > f) {
    const v = (f * u) / (u - f)
    const imageX = lensX + (v / 10) * focalOffset
    const imageH = objectHeight * 18 * (v / u)
    parts.push(svgLine(imageX, axisY, imageX, axisY - imageH, { stroke: PALETTE.red, strokeWidth: 2.4 }))
    parts.push(svgText(imageX, axisY - imageH - 8, '像', { size: 12, fill: PALETTE.red }))
    parts.push(pulse(imageX, axisY - imageH, { r0: 3, r1: 16, color: PALETTE.red, begin: '3.1s', duration: 1.4 }))
  }
  return { width: W, height: H, parts }
}

/**
 * 三点定圆「圆规」动画：半径线旋转扫过 + 圆从 r=0 画到 R + 圆心脉冲。
 * @param {ReturnType<typeof createPlot>} plot
 * @param {{points: number[][], center: number[], radius: number}} circle 数学坐标
 */
export function figureCompassCircle(plot, { points, center, radius }) {
  const [cx, cy] = plot.to(center)
  const parts = []
  // 三角形（静态）
  parts.push(...plotPolyline(plot, points, { color: INK, strokeWidth: 1.8, close: true }))
  for (const [i, p] of points.entries()) {
    parts.push(...plotPoint(plot, p, String.fromCharCode(65 + i), { color: PALETTE.amber }))
  }
  // 圆心
  parts.push(svgCircle(cx, cy, 3, { fill: ACCENT }))
  parts.push(svgText(cx, cy + 18, 'O', { size: 12, fill: ACCENT, weight: '600' }))
  // 圆（r 0→R，播放一次后保持）
  const rPx = radius * plot.sx
  parts.push(
    `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="0" fill="none" stroke="${ACCENT}" stroke-width="1.8">`
    + animate({ attribute: 'r', values: `0;${fmt(rPx)}`, duration: 1.6, begin: '0.3s', repeat: 0 })
    + '</circle>',
  )
  // 半径线旋转扫过（repeat 0：画一圈即停）
  const start = plot.to(points[0])
  parts.push(
    `<g transform="translate(${fmt(cx)} ${fmt(cy)})">`
    + animateTransform({
      type: 'rotate',
      values: '0;360',
      duration: 1.6,
      begin: '0.3s',
      repeat: 0,
    })
    + svgLine(0, 0, start[0] - cx, start[1] - cy, { stroke: PALETTE.red, strokeWidth: 1.4 })
    + svgText((start[0] - cx) / 2, (start[1] - cy) / 2 - 6, 'R', { size: 11, fill: PALETTE.red })
    + '</g>',
  )
  parts.push(pulse(cx, cy, { r0: 2, r1: 12, color: ACCENT, begin: '2s', duration: 1.4, repeat: 0 }))
  return parts
}

/* ================================================================== */
/* 八、自检                                                             */
/* ================================================================== */

/** 结构自检：SVG 必须闭合、无 NaN/undefined（写图后的最低标准）。 */
export function checkSvg(svg) {
  const problems = []
  if (!svg.startsWith('<svg') || !svg.trimEnd().endsWith('</svg>')) {
    problems.push('SVG 文档不完整')
  }
  if (/NaN|undefined/.test(svg)) problems.push('SVG 含 NaN/undefined')
  const opens = (svg.match(/<path/g) ?? []).length
  const closes = (svg.match(/\/>/g) ?? []).length
  if (opens > closes) problems.push('path 标签未闭合')
  return { ok: problems.length === 0, problems }
}
