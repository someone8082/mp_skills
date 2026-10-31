import { createSolid, sectionOf, toPlane } from '../kit/geometry.mjs'
import { dot, polygonArea2, projectPointToPlane, subtract } from '../kit/vecmath.mjs'
import { assertFields, check, compileWith, fmt, quantity } from './validation.mjs'
import { SIDES_MIN, SIDES_MAX } from '../shared/geometry/types.mjs'
import { boxPointLabels, compileConstruction } from './section-construction.mjs'

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
    const construction = input.construction === undefined ? null : compileConstruction(input.construction, solid, plane, boundary)
    if (construction) checks.push(check('construction-geometry', 'mathematics', 'passed', '棱上给定点、同面连线、直线交点及闭合顺序均与题设截平面和真实边界核对；点名与原题对应关系仍需人工确认'))
    const answer = { shape: result.shape, degeneracy: result.degeneracy, area: result.area, perimeter: result.perimeter, ...(result.circleRadius ? { radius: result.circleRadius } : {}) }
    return {
      title: '标准实体截面', duration: construction?.duration ?? 6,
      assumptions: ['实体尺寸与截平面按输入建立，需人工核对是否对应原题', construction ? '作图进度控制辅助点和交线的出现；拖动只改变观察方向，不改变几何关系' : '旋转是相机观察过程，不表示实体或截平面在发生物理运动', '采样边界用于显示；≈ 表示近似数值，不构成几何证明'],
      answer, units: { area: `${unit}²`, perimeter: unit, radius: unit },
      model: { solid, plane, section: { ...result, vertices: boundary, samples: boundary }, unit, pointLabels: boxPointLabels(solid), ...(construction ? { construction } : {}) },
      stateAt: time => {
        if (!Number.isFinite(time)) throw new Error('时间必须为有限数值')
        const t = Math.max(0, Math.min(construction?.duration ?? 6, time))
        const stepIndex = construction ? Math.min(construction.steps.length-1, Math.floor(t/2)) : null
        const frame = construction?.frames[stepIndex]
        return { t, azimuth: construction ? 42 : 42 + t * 20, elevation: 28, boundary: boundary.map(p => [...p]),
          ...(frame ? { construction: { ...frame, stepIndex, points: construction.points.filter(p => frame.visible.includes(p.name)) } } : {}) }
      },
      steps: construction?.steps ?? [
        { id: 'model', title: '先找截平面经过的已知点', uses: [], formula: solid.polyhedral ? '同一个面内有两个截面上的点，就能确定这个面上的交线。' : '先判断截平面相对实体中心、轴线和底面的位置。', substitution: solid.kind === 'box' ? '对照题干和图形，确认截平面经过哪些点；长方体下底面按A、B、C、D顺序标记，上底面为A₁、B₁、C₁、D₁。' : '对照原题确认实体尺寸与截平面位置，不凭二维投影猜测实际距离或角度。', result: solid.polyhedral ? '沿相邻的面核对全部交点，再按边界顺序连接；不凭给定点的数量判断截面。' : '完整截面是平面与实体相交得到的图形，不应一律当成多边形。' },
        { id: 'classification', title: '找出完整的截面边界', uses: [], formula: solid.polyhedral ? '将各个面上的交线首尾相接，得到闭合图形。' : '检查交线是否完整，以及是否受到实体上下底面的裁切。', substitution: result.explanation, result: result.shape ?? result.degeneracy },
        { id: 'metrics', title: '核对截面，并按需要计算面积', uses: [], formula: '先确认边界完整，再讨论长度和面积。', substitution: '本题未提供逐步作图规格时，这里仅展示计算出的完整截面，不把观察旋转当作作图证明。', result: result.area === null ? '此情形不提供面积指标' : `面积 ≈ ${fmt(result.area)} ${unit}²${result.metricsApproximate ? '（近似）' : ''}` },
      ],
      checks,
    }
  })
}
