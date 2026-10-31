import { createSolid, sectionOf, toPlane } from '../kit/geometry.mjs'
import { dot, polygonArea2, projectPointToPlane, subtract } from '../kit/vecmath.mjs'
import { assertFields, check, compileWith, fmt, quantity } from './validation.mjs'
import { SIDES_MIN, SIDES_MAX } from '../shared/geometry/types.mjs'

export function compileSection(spec) {
  return compileWith(spec, 'section', input => {
    assertFields(input.givens, ['solid', 'plane', 'unit'])
    const { unit, plane: planeSpec } = input.givens
    quantity({ value: 1, unit }, 'm', '长度单位')
    const rawSolid = input.givens.solid
    const n = rawSolid?.n ?? rawSolid?.params?.n
    if (['prism', 'pyramid', 'frustum'].includes(rawSolid?.kind) && (!Number.isInteger(n) || n < SIDES_MIN || n > SIDES_MAX)) throw new Error(`教学模板的正多边形边数须为 ${SIDES_MIN}–${SIDES_MAX}`)
    const solid = createSolid(input.givens.solid)
    const plane = toPlane(planeSpec)
    const result = sectionOf(solid, planeSpec)
    if (['unsupported', 'invalid-numeric'].includes(result.degeneracy)) throw new Error(result.explanation)
    const samples = result.vertices?.length ? result.vertices : result.samples ?? []
    const boundary = samples.map(p => [...p])
    if (boundary.length > 1 && boundary[0].every((v, i) => Math.abs(v - boundary.at(-1)[i]) < 1e-12)) boundary.pop()
    if (result.degeneracy !== 'none') boundary.length = 0
    if (result.degeneracy === 'none' && boundary.length < 3) throw new Error('截面缺少可核验的完整边界')
    const scale = Math.max(1, ...boundary.flat().map(Math.abs))
    const onPlane = boundary.every(p => Math.abs(dot(subtract(p, plane.origin), plane.normal)) <= 1e-8 * scale)
    const checks = [check('boundary-plane', 'mathematics', onPlane ? 'passed' : 'failed', '所有边界点满足同一截平面方程')]
    if (result.kind === 'polygon') {
      const area = polygonArea2(boundary.map(p => projectPointToPlane(p, plane)))
      checks.push(check('area-cross-check', 'mathematics', Math.abs(area - result.area) <= 1e-8 * Math.max(area, result.area, Number.MIN_VALUE) ? 'passed' : 'failed', '三维面积与投影鞋带公式交叉检查'))
    }
    checks.push(check('state-binding', 'animation', 'passed', '实体和截面读取同一个几何内核结果；旋转仅改变相机'))
    const answer = { shape: result.shape, degeneracy: result.degeneracy, area: result.area, perimeter: result.perimeter, ...(result.circleRadius ? { radius: result.circleRadius } : {}) }
    return {
      title: '标准实体截面', duration: 6,
      assumptions: ['实体尺寸与截平面按输入建立，需人工核对是否对应原题', '旋转是相机观察过程，不表示实体或截平面在发生物理运动', '采样边界用于显示；≈ 表示近似数值，不构成几何证明'],
      answer, units: { area: `${unit}²`, perimeter: unit, radius: unit },
      model: { solid, plane, section: { ...result, vertices: boundary, samples: boundary }, unit },
      stateAt: time => {
        if (!Number.isFinite(time)) throw new Error('时间必须为有限数值')
        const t = Math.max(0, Math.min(6, time))
        return { t, azimuth: 42 + t * 20, elevation: 28, boundary: boundary.map(p => [...p]) }
      },
      steps: [
        { id: 'model', title: '按题设构造实体和平面', uses: ['solid', 'plane'], formula: 'n · (X − P) = 0', substitution: JSON.stringify(planeSpec), result: '实体与平面已建立，题意对应关系待确认' },
        { id: 'classification', title: '判定截面', uses: ['model'], formula: '求实体与平面的公共边界', substitution: result.explanation, result: result.shape ?? result.degeneracy },
        { id: 'metrics', title: '读取内核度量', uses: ['classification'], formula: '多边形面积 / 标准截面公式', substitution: result.metricsApproximate ? '包含采样近似，保留 ≈ 标记' : '标准情形计算，显示小数时使用 ≈', result: result.area === null ? '此情形不提供面积指标' : `面积 ≈ ${fmt(result.area)} ${unit}²` },
      ],
      checks,
    }
  })
}
