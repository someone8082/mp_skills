import { listFormulas, parseUnit } from '../kit/physics.mjs'

function bind(request, key, value) {
  if (!Number.isFinite(value)) return
  if (request[key] !== undefined && (typeof request[key] !== 'number' || !Number.isFinite(request[key]) || Math.abs(request[key] - value) > 1e-8 * Math.max(1, Math.abs(value)))) throw new Error(`配图参数 ${key}=${request[key]} 与求解模型 ${value} 不一致`)
  request[key] = value
}

/** Bind semantic drawing parameters to computed quantities; visual-only layout parameters stay independent. */
export function bindFigureRequest(spec, solution) {
  const request = { ...spec.figure }
  const result = solution?.answer?.result
  const values = {}
  if (spec.task === 'physics.formula') {
    const units = listFormulas().find(formula => formula.id === spec.givens.id)?.vars ?? {}
    for (const [name, q] of Object.entries(spec.givens.knowns ?? {})) {
      const unit = parseUnit(q.unit ?? units[name])
      if (unit) values[name] = q.value * unit.factor
    }
    if (result && typeof result.value === 'number') values[result.target] = result.value * (parseUnit(result.unit)?.factor ?? 1)
  }
  if (['circuit-flow', 'circuit'].includes(request.kind)) {
    if (spec.givens.id === 'em.parallel') throw new Error('此配图只支持串联电路，不能用于并联电阻模型')
    bind(request, 'current', values.I)
    if (request.kind === 'circuit-flow' && !Number.isFinite(request.current)) throw new Error('生成电流动画需要明确的电流，不能使用默认值代替题设')
    if (spec.givens.id === 'em.series' && Number.isFinite(values.R1) && Number.isFinite(values.R2)) {
      const resistors = [values.R1, values.R2]
      if (request.resistors && (!Array.isArray(request.resistors) || request.resistors.length !== 2 || request.resistors.some((r, i) => Math.abs(r - resistors[i]) > 1e-8 * Math.max(1, Math.abs(resistors[i]))))) throw new Error('配图各电阻与题设串联电阻不一致')
      request.resistors = resistors
    }
    if (request.resistors !== undefined && (!Array.isArray(request.resistors) || !request.resistors.length || request.resistors.some(r => !Number.isFinite(r) || r <= 0))) throw new Error('配图电阻必须是正数数组')
    if (Number.isFinite(values.R)) {
      if (request.resistors && Math.abs(request.resistors.reduce((a, b) => a + b, 0) - values.R) > 1e-8 * Math.max(1, values.R)) throw new Error('配图电阻总和与题设总电阻不一致')
      request.resistors ??= [values.R]
    }
  }
  if (request.kind === 'motion') {
    const freefall = spec.givens.id === 'kinematics.free-fall'
    bind(request, 'v0', freefall ? 0 : values.v0)
    bind(request, 'a', freefall ? values.g : values.a)
    bind(request, 'duration', values.t)
  }
  if (['optics', 'optics-anim'].includes(request.kind) && spec.givens.id === 'optics.lens') {
    bind(request, 'f', values.f === undefined ? undefined : values.f * 100)
    bind(request, 'u', values.u === undefined ? undefined : values.u * 100)
  }
  if (request.kind === 'curve' && solution?.answer?.conic) {
    const conic = solution.answer.conic
    if (request.type !== undefined && request.type !== conic.type) throw new Error('配图曲线类型与求解曲线不一致')
    request.type = conic.type
    for (const key of ['a', 'b', 'p']) bind(request, key, conic[key])
  }
  if (request.kind === 'plane-triangle' && spec.givens.points) {
    if (request.points && JSON.stringify(request.points) !== JSON.stringify(spec.givens.points)) throw new Error('配图三点与题设三点不一致')
    request.points = spec.givens.points
  }
  return request
}
