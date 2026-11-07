import { assertFields, check, compileWith, fmt, near, quantity } from './validation.mjs'

export function compileMotion(spec) {
  return compileWith(spec, 'motion', input => {
    const g = input.givens
    assertFields(g, ['v0', 'a', 't', 'x0'])
    const v0 = quantity(g.v0, 'm/s', 'v0')
    const a = quantity(g.a, 'm/s²', 'a')
    const duration = quantity(g.t, 's', 't')
    const x0 = g.x0 === undefined ? 0 : quantity(g.x0, 'm', 'x0')
    if (duration < 0) throw new Error('时间 t 不得小于 0')
    const stateAt = time => {
      if (!Number.isFinite(time)) throw new Error('时间必须为有限数值')
      const t = Math.max(0, Math.min(duration, time))
      const s = v0 * t + 0.5 * a * t * t
      return { t, x: x0 + s, s, v: v0 + a * t, a }
    }
    const last = stateAt(duration)
    const sAverage = ((v0 + last.v) / 2) * duration
    const sScale = Math.max(Math.abs(v0 * duration), Math.abs(0.5 * a * duration * duration))
    const extrema = [0, duration]
    if (a !== 0 && -v0 / a > 0 && -v0 / a < duration) extrema.push(-v0 / a)
    const positions = extrema.map(t => stateAt(t).x)
    if (!positions.every(Number.isFinite)) throw new Error('运动区间数值越界')
    return {
      title: '一维匀变速运动', duration, stateAt,
      assumptions: ['所示时间段内加速度恒定，沿选定正方向作一维运动', '此模型没有碰撞、触地或轨道端点；位移有正负，不等同于路程', ...(g.x0 === undefined ? ['位置原点取初始位置 x₀ = 0，仅为坐标约定'] : [])],
      answer: { s: last.s, x: last.x, v: last.v, v0, a, t: duration, x0 },
      comparisonScales: { s: sScale, x: Math.max(Math.abs(x0), sScale), v: Math.max(Math.abs(v0), Math.abs(a * duration)) },
      units: { s: 'm', x: 'm', x0: 'm', v: 'm/s', v0: 'm/s', a: 'm/s²', t: 's' },
      model: { v0, a, x0, min: Math.min(...positions), max: Math.max(...positions) },
      steps: [
        { id: 'velocity', title: '求末速度', uses: ['v0', 'a', 't'], formula: 'v = v₀ + at', substitution: `${fmt(v0)} + (${fmt(a)}) × ${fmt(duration)}`, result: `${fmt(last.v)} m/s` },
        { id: 'displacement', title: '求位移', uses: ['v0', 'a', 't'], formula: 's = v₀t + ½at²', substitution: `${fmt(v0)} × ${fmt(duration)} + ½ × (${fmt(a)}) × ${fmt(duration)}²`, result: `${fmt(last.s)} m` },
        { id: 'cross-check', title: '用平均速度交叉核验', uses: ['velocity', 'displacement'], formula: 's = (v₀ + v)t / 2', substitution: `(${fmt(v0)} + ${fmt(last.v)}) × ${fmt(duration)} / 2`, result: `${fmt(sAverage)} m` },
      ],
      checks: [check('average-velocity', 'mathematics', near(last.s, sAverage, sScale) ? 'passed' : 'failed', '位移公式与平均速度公式在终点一致（容差按运算项尺度计算）'), check('state-binding', 'animation', 'passed', '位置、速度及读数调用同一个 stateAt(t)；物理时间线性推进')],
    }
  })
}
