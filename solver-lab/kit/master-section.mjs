/** Legacy z-axis coordinates <-> master centred y-axis coordinates.
 * Section mathematics lives exclusively in shared/geometry, generated from src/domain/geometry.
 */
import { sectionAnalyticSolid } from '../shared/geometry/analyticSection.mjs'
import { sectionPolyhedron } from '../shared/geometry/section.mjs'
import { cross, distance, dot, length, subtract } from '../shared/geometry/vector.mjs'

const halfHeight = (solid) => solid.kind === 'sphere' ? 0 : (solid.params.height ?? solid.params.c ?? 0) / 2
export const toMasterPoint = (solid, point) => [point[0], point[2] - halfHeight(solid), -point[1]]
export const toLegacyPoint = (solid, point) => [point[0], -point[2], point[1] + halfHeight(solid)]
export const toMasterPlane = (solid, plane) => ({ origin: toMasterPoint(solid, plane.origin), normal: [plane.normal[0], plane.normal[2], -plane.normal[1]] })

export function toMasterSolid(solid) {
  if (solid.polyhedral) {
    const vertices = solid.vertices.map((point, i) => ({ id: `v${i}`, position: toMasterPoint(solid, point) }))
    const edges = new Map()
    const faces = solid.faces.map((indices, i) => {
      for (let j = 0; j < indices.length; j++) {
        const a = indices[j], b = indices[(j + 1) % indices.length]
        const key = [a, b].sort((x, y) => x - y).join(':')
        edges.set(key, { id: `e${key}`, a: `v${a}`, b: `v${b}` })
      }
      return { id: `f${i}`, vertices: indices.map((index) => `v${index}`) }
    })
    return { representation: 'polyhedron', request: { kind: solid.kind }, vertices, edges: [...edges.values()], faces }
  }
  const { params, kind } = solid
  const request = kind === 'conical-frustum'
    ? { kind, bottomRadius: params.rBottom, topRadius: params.rTop, height: params.height }
    : { kind, ...params }
  return { representation: 'analytic', request }
}

/** Raw master result, in master coordinates; retains master sampled metrics. */
export function masterSection(solid, plane) {
  const model = toMasterSolid(solid)
  const converted = toMasterPlane(solid, plane)
  return model.representation === 'polyhedron' ? sectionPolyhedron(model, converted) : sectionAnalyticSolid(model, converted)
}

export function sectionMaster(solid, plane) {
  const result = masterSection(solid, plane)
  const family = solid.polyhedral ? 'polyhedron' : solid.kind
  const base = { ok: true, family, kind: result.kind ?? null, shape: null, degeneracy: result.degeneracy, area: result.area, perimeter: result.perimeter, metricsApproximate: result.metricsApproximate ?? false, explanation: result.explanation }
  if (solid.polyhedral) {
    const byId = new Map(result.points.map((point) => [point.id, point.position]))
    const vertices = (result.boundary.length ? result.boundary.map((id) => byId.get(id)) : result.points.map((point) => point.position)).map((point) => toLegacyPoint(solid, point))
    if (result.degeneracy !== 'none') return { ...base, shape: result.degeneracy === 'segment' ? '线段' : null, vertices: result.degeneracy === 'coplanar-face' ? [] : vertices, perimeter: result.degeneracy === 'segment' && vertices.length === 2 ? distance(...vertices) : null }
    const classified = classifyPolygon(vertices)
    return { ...base, kind: 'polygon', shape: classified.name, shapeKind: classified.kind, regular: classified.regular, sides: vertices.length, vertices, samples: [...vertices, vertices[0]] }
  }
  const samples = result.samples.map((point) => toLegacyPoint(solid, point))
  const vertices = samples.length > 2 && distance(samples[0], samples.at(-1)) === 0 ? samples.slice(0, -1) : samples
  if (result.degeneracy !== 'none') return { ...base, vertices, samples, circleRadius: result.circleRadius }
  let shape = { circle: '圆形', rectangle: '矩形', triangle: '等腰三角形（轴截面）', trapezoid: '等腰梯形（轴截面）', ellipse: '椭圆形', 'oblique-curve': '斜截曲线' }[result.kind]
  if (solid.kind === 'sphere') shape = Math.abs(dot(plane.origin, plane.normal)) < 1e-12 ? '圆形（大圆）' : '圆形（小圆）'
  if (result.kind === 'rectangle' && Math.abs(dot([plane.origin[0], plane.origin[1], 0], plane.normal)) < 1e-12) shape = '矩形（轴截面）'
  // Legacy solver deliberately does not offer metrics for general sampled curves.
  const unsupportedMetrics = result.kind === 'oblique-curve'
  return { ...base, shape, vertices, samples, circleRadius: result.circleRadius,
    area: unsupportedMetrics ? null : result.area,
    perimeter: unsupportedMetrics || result.kind === 'ellipse' ? null : result.perimeter,
    metricsApproximate: result.metricsApproximate || result.kind === 'circle',
  }
}

function classifyPolygon(loop) {
  const n = loop.length
  const edges = loop.map((p, i) => subtract(loop[(i + 1) % n], p))
  const lengths = edges.map(length)
  const tolerance = Math.max(...lengths) * 1e-8
  const equal = (a, b) => Math.abs(a - b) <= tolerance
  const allEqual = lengths.every((value) => equal(value, lengths[0]))
  const right = (a, b) => Math.abs(dot(a, b)) <= 1e-8 * length(a) * length(b)
  const allRight = edges.every((edge, i) => right(edge, edges[(i + 1) % n]))
  const parallel = (a, b) => length(cross(a, b)) <= 1e-8 * length(a) * length(b)
  if (n === 3) {
    const isosceles = equal(lengths[0], lengths[1]) || equal(lengths[1], lengths[2]) || equal(lengths[0], lengths[2])
    const hasRight = edges.some((edge, i) => right(edge, edges[(i + 1) % n]))
    return { kind: 'triangle', name: allEqual ? '等边三角形' : hasRight ? (isosceles ? '等腰直角三角形' : '直角三角形') : isosceles ? '等腰三角形' : '三角形', regular: allEqual }
  }
  if (n === 4) {
    const p01 = parallel(edges[0], edges[2]), p12 = parallel(edges[1], edges[3])
    let name = '四边形'
    if (p01 && p12) name = allRight ? (allEqual ? '正方形' : '矩形') : allEqual ? '菱形' : '平行四边形'
    else if (p01 || p12) name = (p01 ? equal(lengths[1], lengths[3]) : equal(lengths[0], lengths[2])) ? '等腰梯形' : '梯形'
    return { kind: 'quadrilateral', name, regular: allRight && allEqual }
  }
  const cosines = edges.map((edge, i) => dot(edge, edges[(i + 1) % n]) / (length(edge) * length(edges[(i + 1) % n])))
  const regular = allEqual && cosines.every((value) => Math.abs(value - cosines[0]) < 1e-8)
  const name = { 5: '五边形', 6: '六边形', 7: '七边形', 8: '八边形' }[n] ?? `${n}边形`
  return { kind: 'polygon', name: regular ? `正${name}` : name, regular }
}
