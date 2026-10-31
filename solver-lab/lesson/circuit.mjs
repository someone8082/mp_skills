import { assertFields, check, compileWith, fmt, near, quantity } from './validation.mjs'

export function compileCircuit(spec) {
  return compileWith(spec, 'circuit', input => {
    assertFields(input.givens, ['voltage', 'resistors'])
    const voltage = quantity(input.givens.voltage, 'V', 'voltage')
    const raw = input.givens.resistors
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) throw new Error('串联电路需要 1–8 个电阻')
    const resistors = raw.map((r, i) => quantity(r, 'Ω', `resistors.${i}`))
    if (resistors.some(r => r <= 0)) throw new Error('电阻必须大于 0')
    const resistance = resistors.reduce((a, b) => a + b, 0)
    const current = voltage / resistance
    const voltages = resistors.map(r => current * r)
    const powers = resistors.map(r => current * current * r)
    const power = voltage * current
    const sum = values => values.reduce((a, b) => a + b, 0)
    return {
      title: '理想直流串联电路', duration: 4,
      assumptions: ['理想直流电源，导线电阻与电源内阻忽略不计，全部电阻串联', '移动圆点表示约定电流方向与相对大小，不表示电子真实漂移速度'],
      answer: { voltage, resistance, current, voltages, powers, power },
      units: { voltage: 'V', resistance: 'Ω', current: 'A', voltages: 'V', powers: 'W', power: 'W' },
      model: { voltage, resistors, resistance, current },
      stateAt: time => {
        if (!Number.isFinite(time)) throw new Error('时间必须为有限数值')
        const t = Math.max(0, Math.min(4, time))
        return { t, current, voltage, voltages: [...voltages], powers: [...powers], phase: ((t * current * 0.2) % 1 + 1) % 1 }
      },
      steps: [
        { id: 'resistance', title: '求总电阻', uses: resistors.map((_, i) => `resistors.${i}`), formula: 'R = R₁ + R₂ + …', substitution: resistors.map(fmt).join(' + '), result: `${fmt(resistance)} Ω` },
        { id: 'current', title: '求串联电流', uses: ['voltage', 'resistance'], formula: 'I = U / R', substitution: `${fmt(voltage)} / ${fmt(resistance)}`, result: `${fmt(current)} A` },
        ...resistors.map((r, i) => ({ id: `voltage-${i}`, title: `求 R${i + 1} 的分压`, uses: ['current', `resistors.${i}`], formula: `U${i + 1} = IR${i + 1}`, substitution: `${fmt(current)} × ${fmt(r)}`, result: `${fmt(voltages[i])} V` })),
        { id: 'power', title: '检查能量转化', uses: ['voltage', 'current', ...resistors.map((_, i) => `resistors.${i}`)], formula: 'P = UI = ΣI²Rᵢ', substitution: `${fmt(voltage)} × ${fmt(current)}`, result: `${fmt(power)} W` },
      ],
      checks: [
        check('kvl', 'mathematics', near(sum(voltages), voltage) ? 'passed' : 'failed', '各电阻电压之和等于电源电压（KVL）'),
        check('kcl', 'mathematics', voltages.every((u, i) => near(u / resistors[i], current)) ? 'passed' : 'failed', '每个电阻电流等于串联电流（KCL）'),
        check('power-balance', 'mathematics', near(sum(powers), power) ? 'passed' : 'failed', '各电阻功率之和等于电源输出功率'),
        check('state-binding', 'animation', 'passed', '分压、读数与示意流动均读取同一已求解电路'),
      ],
    }
  })
}
