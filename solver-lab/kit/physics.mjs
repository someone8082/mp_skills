/**
 * 物理解题内核 — 面向高中物理（力学/运动学/电磁学/光学）的确定性公式求值器。
 * 设计纪律（与几何实验室一致）：一切数值结论由本文件计算产生；
 *   - 单位制 + 量纲校验：已知量单位与公式变量声明不一致时直接拒绝；
 *   - 量纲审计：每条公式注册时即可验证左右两边量纲一致（测试中强制执行）；
 *   - 代入串自动生成：每个结果都附带可核对的代入过程。
 * 零依赖，纯 ESM。
 */

/* ================================================================== */
/* 一、量纲与单位                                                       */
/* ================================================================== */

const BASE_DIMENSIONS = ['L', 'T', 'M', 'I']

/** @type {Record<string, number>} 量纲：{L:1,T:-2} 之类，缺省为 0。 */
function dim(entries = {}) {
  const result = {}
  for (const key of BASE_DIMENSIONS) {
    if (entries[key]) result[key] = entries[key]
  }
  return result
}

function dimMul(a, b) {
  const result = {}
  for (const key of BASE_DIMENSIONS) {
    const value = (a[key] ?? 0) + (b[key] ?? 0)
    if (value) result[key] = value
  }
  return result
}

function dimDiv(a, b) {
  const result = {}
  for (const key of BASE_DIMENSIONS) {
    const value = (a[key] ?? 0) - (b[key] ?? 0)
    if (value) result[key] = value
  }
  return result
}

function dimPow(a, exponent) {
  const result = {}
  for (const key of BASE_DIMENSIONS) {
    const value = (a[key] ?? 0) * exponent
    if (value) result[key] = value
  }
  return result
}

function dimEqual(a, b) {
  return BASE_DIMENSIONS.every((key) => (a[key] ?? 0) === (b[key] ?? 0))
}

function dimToString(d) {
  const parts = []
  for (const key of BASE_DIMENSIONS) {
    const value = d[key] ?? 0
    if (value === 0) continue
    parts.push(value === 1 ? key : `${key}^${value}`)
  }
  return parts.length ? parts.join('·') : '1（无量纲）'
}

/** 原子单位表：符号 → { dim, factor（折算到公式声明单位的基准由调用方处理） }。 */
const ATOMS = {
  // 长度
  m: { dim: dim({ L: 1 }), factor: 1 },
  cm: { dim: dim({ L: 1 }), factor: 0.01 },
  mm: { dim: dim({ L: 1 }), factor: 1e-3 },
  km: { dim: dim({ L: 1 }), factor: 1000 },
  // 时间
  s: { dim: dim({ T: 1 }), factor: 1 },
  ms: { dim: dim({ T: 1 }), factor: 1e-3 },
  min: { dim: dim({ T: 1 }), factor: 60 },
  h: { dim: dim({ T: 1 }), factor: 3600 },
  // 质量
  kg: { dim: dim({ M: 1 }), factor: 1 },
  g: { dim: dim({ M: 1 }), factor: 1e-3 },
  t: { dim: dim({ M: 1 }), factor: 1000 },
  // 电流
  A: { dim: dim({ I: 1 }), factor: 1 },
  mA: { dim: dim({ I: 1 }), factor: 1e-3 },
  μA: { dim: dim({ I: 1 }), factor: 1e-6 },
  kA: { dim: dim({ I: 1 }), factor: 1e3 },
  // 力 / 能量 / 功率 / 压强
  N: { dim: dim({ M: 1, L: 1, T: -2 }), factor: 1 },
  kN: { dim: dim({ M: 1, L: 1, T: -2 }), factor: 1e3 },
  J: { dim: dim({ M: 1, L: 2, T: -2 }), factor: 1 },
  kJ: { dim: dim({ M: 1, L: 2, T: -2 }), factor: 1e3 },
  W: { dim: dim({ M: 1, L: 2, T: -3 }), factor: 1 },
  kW: { dim: dim({ M: 1, L: 2, T: -3 }), factor: 1e3 },
  mW: { dim: dim({ M: 1, L: 2, T: -3 }), factor: 1e-3 },
  Pa: { dim: dim({ M: 1, L: -1, T: -2 }), factor: 1 },
  kPa: { dim: dim({ M: 1, L: -1, T: -2 }), factor: 1e3 },
  // 频率
  Hz: { dim: dim({ T: -1 }), factor: 1 },
  kHz: { dim: dim({ T: -1 }), factor: 1e3 },
  // 电荷 / 电压 / 电阻 / 电容
  C: { dim: dim({ I: 1, T: 1 }), factor: 1 },
  mC: { dim: dim({ I: 1, T: 1 }), factor: 1e-3 },
  μC: { dim: dim({ I: 1, T: 1 }), factor: 1e-6 },
  V: { dim: dim({ M: 1, L: 2, T: -3, I: -1 }), factor: 1 },
  mV: { dim: dim({ M: 1, L: 2, T: -3, I: -1 }), factor: 1e-3 },
  kV: { dim: dim({ M: 1, L: 2, T: -3, I: -1 }), factor: 1e3 },
  ohm: { dim: dim({ M: 1, L: 2, T: -3, I: -2 }), factor: 1 },
  Ω: { dim: dim({ M: 1, L: 2, T: -3, I: -2 }), factor: 1 },
  kΩ: { dim: dim({ M: 1, L: 2, T: -3, I: -2 }), factor: 1e3 },
  MΩ: { dim: dim({ M: 1, L: 2, T: -3, I: -2 }), factor: 1e6 },
  F: { dim: dim({ M: -1, L: -2, T: 4, I: 2 }), factor: 1 },
  mF: { dim: dim({ M: -1, L: -2, T: 4, I: 2 }), factor: 1e-3 },
  μF: { dim: dim({ M: -1, L: -2, T: 4, I: 2 }), factor: 1e-6 },
  nF: { dim: dim({ M: -1, L: -2, T: 4, I: 2 }), factor: 1e-9 },
  pF: { dim: dim({ M: -1, L: -2, T: 4, I: 2 }), factor: 1e-12 },
  // 磁
  T: { dim: dim({ M: 1, T: -2, I: -1 }), factor: 1 },
  mT: { dim: dim({ M: 1, T: -2, I: -1 }), factor: 1e-3 },
  G: { dim: dim({ M: 1, T: -2, I: -1 }), factor: 1e-4 },
  Wb: { dim: dim({ M: 1, L: 2, T: -2, I: -1 }), factor: 1 },
  mWb: { dim: dim({ M: 1, L: 2, T: -2, I: -1 }), factor: 1e-3 },
  // 体积 / 角度
  L: { dim: dim({ L: 3 }), factor: 1e-3 },
  mL: { dim: dim({ L: 3 }), factor: 1e-6 },
  rad: { dim: {}, factor: 1 },
  '°': { dim: {}, factor: 1 },
}

const SUPERSCRIPTS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }

/** 解析单位文本（如 'm/s²'、'km/h'、'N·m'、'kΩ'）→ {dimension, factor}。 */
export function parseUnit(text) {
  if (text === undefined || text === null) return null
  const trimmed = String(text).trim()
  if (trimmed === '' || trimmed === '1' || trimmed === '-') return { dimension: {}, factor: 1 }

  const segments = trimmed.split('/')
  if (segments.length > 2) return null
  const numerator = parseUnitProduct(segments[0])
  if (!numerator) return null
  if (segments.length === 1) return numerator
  const denominator = parseUnitProduct(segments[1])
  if (!denominator) return null
  return {
    dimension: dimDiv(numerator.dimension, denominator.dimension),
    factor: numerator.factor / denominator.factor,
  }
}

function parseUnitProduct(text) {
  const parts = String(text).split(/[·*]/u).filter(Boolean)
  let dimension = {}
  let factor = 1
  for (const part of parts) {
    const atom = parseUnitAtom(part)
    if (!atom) return null
    dimension = dimMul(dimension, atom.dimension)
    factor *= atom.factor
  }
  return { dimension, factor }
}

function parseUnitAtom(text) {
  const atom = String(text).trim()
  if (ATOMS[atom]) return { dimension: ATOMS[atom].dim, factor: ATOMS[atom].factor }
  // 处理上标指数：m²、s³
  const superscriptMatch = /^(.*?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/u.exec(atom)
  if (superscriptMatch) {
    const base = ATOMS[superscriptMatch[1]]
    const exponent = Number([...superscriptMatch[2]].map((ch) => SUPERSCRIPTS[ch]).join(''))
    if (base && Number.isInteger(exponent) && exponent >= 0) {
      return { dimension: dimPow(base.dim, exponent), factor: base.factor ** exponent }
    }
    return null
  }
  // 处理 ^ 指数：m^2
  const caretMatch = /^(.*?)\^(\d+)$/u.exec(atom)
  if (caretMatch) {
    const base = ATOMS[caretMatch[1]]
    const exponent = Number(caretMatch[2])
    if (base) return { dimension: dimPow(base.dim, exponent), factor: base.factor ** exponent }
    return null
  }
  return null
}

/* ================================================================== */
/* 二、常量                                                             */
/* ================================================================== */

export const CONSTANTS = {
  g: { value: 9.8, unit: 'm/s²', note: '重力加速度（可按题目取 10）' },
  G: { value: 6.67e-11, unit: 'N·m²/kg²', note: '万有引力常量' },
  k: { value: 9.0e9, unit: 'N·m²/C²', note: '静电力常量' },
  c: { value: 3.0e8, unit: 'm/s', note: '真空中光速' },
}

/* ================================================================== */
/* 三、公式库                                                           */
/* ================================================================== */

/**
 * @typedef {Object} Formula
 * @property {string} id
 * @property {string} topic
 * @property {string} name
 * @property {string} formula 展示用公式（Unicode）
 * @property {string} expr 量纲审计用表达式（ASCII 运算符）
 * @property {Record<string, string>} vars 变量 → 声明单位
 * @property {{expr: string, solutions: Record<string, string>}[]} [relations] 显式关系及受控逆式；每条关系的变量为 solutions 的键
 * @property {(target: string, knowns: Record<string, number>) => {value: number|number[], unit: string, note?: string}} [solve]
 */

/** @type {Formula[]} */
const FORMULAS = [
  /* ---------------- 运动学 ---------------- */
  {
    id: 'kinematics.velocity',
    topic: 'kinematics',
    name: '速度与时间',
    formula: 'v = v₀ + a·t',
    expr: 'v0 + a * t',
    vars: { v: 'm/s', v0: 'm/s', a: 'm/s²', t: 's' },
    solve(target, k) {
      if (target === 'v') return { value: k.v0 + k.a * k.t, unit: 'm/s' }
      if (target === 'v0') return { value: k.v - k.a * k.t, unit: 'm/s' }
      if (target === 'a') return { value: (k.v - k.v0) / k.t, unit: 'm/s²' }
      if (target === 't') return { value: (k.v - k.v0) / k.a, unit: 's' }
      throw unsolved('kinematics.velocity', target)
    },
  },
  {
    id: 'kinematics.displacement',
    topic: 'kinematics',
    name: '位移与时间',
    formula: 's = v₀·t + ½·a·t²',
    expr: 'v0 * t + 0.5 * a * t ^ 2',
    vars: { s: 'm', v0: 'm/s', a: 'm/s²', t: 's' },
    solve(target, k) {
      if (target === 's') return { value: k.v0 * k.t + 0.5 * k.a * k.t ** 2, unit: 'm' }
      if (target === 'v0') return { value: (k.s - 0.5 * k.a * k.t ** 2) / k.t, unit: 'm/s' }
      if (target === 'a') return { value: (2 * (k.s - k.v0 * k.t)) / k.t ** 2, unit: 'm/s²' }
      if (target === 't') {
        const A = 0.5 * k.a
        const B = k.v0
        const C = -k.s
        if (Math.abs(A) < 1e-15) return { value: -C / B, unit: 's' }
        const delta = B * B - 4 * A * C
        if (delta < 0) throw new RangeError('关于 t 的一元二次方程无实根（判别式 < 0）')
        const sqrtDelta = Math.sqrt(delta)
        return {
          value: [(-B + sqrtDelta) / (2 * A), (-B - sqrtDelta) / (2 * A)].sort((x, y) => x - y),
          unit: 's',
          note: '方程有两个根，请按题意取舍',
        }
      }
      throw unsolved('kinematics.displacement', target)
    },
  },
  {
    id: 'kinematics.velocity-displacement',
    topic: 'kinematics',
    name: '速度与位移',
    formula: 'v² = v₀² + 2·a·s',
    expr: 'v ^ 2 = v0 ^ 2 + 2 * a * s',
    vars: { v: 'm/s', v0: 'm/s', a: 'm/s²', s: 'm' },
    solve(target, k) {
      if (target === 'v') {
        const value = k.v0 ** 2 + 2 * k.a * k.s
        if (value < 0) throw new RangeError('v² 为负，该组已知量不自洽')
        return { value: Math.sqrt(value), unit: 'm/s' }
      }
      if (target === 'v0') {
        const value = k.v ** 2 - 2 * k.a * k.s
        if (value < 0) throw new RangeError('v₀² 为负，该组已知量不自洽')
        return { value: Math.sqrt(value), unit: 'm/s' }
      }
      if (target === 'a') return { value: (k.v ** 2 - k.v0 ** 2) / (2 * k.s), unit: 'm/s²' }
      if (target === 's') return { value: (k.v ** 2 - k.v0 ** 2) / (2 * k.a), unit: 'm' }
      throw unsolved('kinematics.velocity-displacement', target)
    },
  },
  {
    id: 'kinematics.average',
    topic: 'kinematics',
    name: '平均速度',
    formula: 's = (v₀ + v)·t / 2',
    expr: '(v0 + v) * t / 2',
    vars: { s: 'm', v0: 'm/s', v: 'm/s', t: 's' },
    solve(target, k) {
      if (target === 's') return { value: ((k.v0 + k.v) * k.t) / 2, unit: 'm' }
      if (target === 'v') return { value: (2 * k.s) / k.t - k.v0, unit: 'm/s' }
      if (target === 'v0') return { value: (2 * k.s) / k.t - k.v, unit: 'm/s' }
      if (target === 't') return { value: (2 * k.s) / (k.v0 + k.v), unit: 's' }
      throw unsolved('kinematics.average', target)
    },
  },
  {
    id: 'kinematics.free-fall',
    topic: 'kinematics',
    name: '自由落体',
    formula: 'v = g·t；h = ½·g·t²；v² = 2·g·h',
    expr: 'v = g * t',
    vars: { v: 'm/s', h: 'm', t: 's', g: 'm/s²' },
    relations: [
      { expr: 'v = g * t', solutions: { v: 'g * t', t: 'v / g', g: 'v / t' } },
      { expr: 'h = 0.5 * g * t ^ 2', solutions: { h: '0.5 * g * t ^ 2', t: 'sqrt(2 * h / g)', g: '2 * h / t ^ 2' } },
      { expr: 'v ^ 2 = 2 * g * h', solutions: { v: 'sqrt(2 * g * h)', h: 'v ^ 2 / (2 * g)', g: 'v ^ 2 / (2 * h)' } },
    ],
  },
  {
    id: 'kinematics.projectile',
    topic: 'kinematics',
    name: '平抛运动',
    formula: 'x = v₀·t；y = ½·g·t²',
    expr: 'x = v0 * t',
    vars: { x: 'm', y: 'm', v0: 'm/s', t: 's', g: 'm/s²' },
    relations: [
      { expr: 'x = v0 * t', solutions: { x: 'v0 * t', v0: 'x / t', t: 'x / v0' } },
      { expr: 'y = 0.5 * g * t ^ 2', solutions: { y: '0.5 * g * t ^ 2', t: 'sqrt(2 * y / g)', g: '2 * y / t ^ 2' } },
    ],
  },

  /* ---------------- 力学 ---------------- */
  {
    id: 'mechanics.newton',
    topic: 'mechanics',
    name: '牛顿第二定律',
    formula: 'F = m·a',
    expr: 'm * a',
    vars: { F: 'N', m: 'kg', a: 'm/s²' },
    solve(target, k) {
      if (target === 'F') return { value: k.m * k.a, unit: 'N' }
      if (target === 'm') return { value: k.F / k.a, unit: 'kg' }
      if (target === 'a') return { value: k.F / k.m, unit: 'm/s²' }
      throw unsolved('mechanics.newton', target)
    },
  },
  {
    id: 'mechanics.weight',
    topic: 'mechanics',
    name: '重力',
    formula: 'G = m·g',
    expr: 'm * g',
    vars: { G: 'N', m: 'kg', g: 'm/s²' },
    solve(target, k) {
      if (target === 'G') return { value: k.m * k.g, unit: 'N' }
      if (target === 'm') return { value: k.G / k.g, unit: 'kg' }
      if (target === 'g') return { value: k.G / k.m, unit: 'm/s²' }
      throw unsolved('mechanics.weight', target)
    },
  },
  {
    id: 'mechanics.friction',
    topic: 'mechanics',
    name: '滑动摩擦力',
    formula: 'f = μ·N',
    expr: 'mu * N',
    vars: { f: 'N', mu: '1', N: 'N' },
    symbols: { mu: 'μ' },
    solve(target, k) {
      if (target === 'f') return { value: k.mu * k.N, unit: 'N' }
      if (target === 'mu') return { value: k.f / k.N, unit: '1' }
      if (target === 'N') return { value: k.f / k.mu, unit: 'N' }
      throw unsolved('mechanics.friction', target)
    },
  },
  {
    id: 'mechanics.hooke',
    topic: 'mechanics',
    name: '胡克定律',
    formula: 'F = k·x',
    expr: 'k * x',
    vars: { F: 'N', k: 'N/m', x: 'm' },
    solve(target, k) {
      if (target === 'F') return { value: k.k * k.x, unit: 'N' }
      if (target === 'k') return { value: k.F / k.x, unit: 'N/m' }
      if (target === 'x') return { value: k.F / k.k, unit: 'm' }
      throw unsolved('mechanics.hooke', target)
    },
  },
  {
    id: 'mechanics.work',
    topic: 'mechanics',
    name: '功',
    formula: 'W = F·s',
    expr: 'F * s',
    vars: { W: 'J', F: 'N', s: 'm' },
    solve(target, k) {
      if (target === 'W') return { value: k.F * k.s, unit: 'J' }
      if (target === 'F') return { value: k.W / k.s, unit: 'N' }
      if (target === 's') return { value: k.W / k.F, unit: 'm' }
      throw unsolved('mechanics.work', target)
    },
  },
  {
    id: 'mechanics.power',
    topic: 'mechanics',
    name: '功率',
    formula: 'P = W / t',
    expr: 'W / t',
    vars: { P: 'W', W: 'J', t: 's' },
    solve(target, k) {
      if (target === 'P') return { value: k.W / k.t, unit: 'W' }
      if (target === 'W') return { value: k.P * k.t, unit: 'J' }
      if (target === 't') return { value: k.W / k.P, unit: 's' }
      throw unsolved('mechanics.power', target)
    },
  },
  {
    id: 'mechanics.power-velocity',
    topic: 'mechanics',
    name: '功率与速度',
    formula: 'P = F·v',
    expr: 'F * v',
    vars: { P: 'W', F: 'N', v: 'm/s' },
    solve(target, k) {
      if (target === 'P') return { value: k.F * k.v, unit: 'W' }
      if (target === 'F') return { value: k.P / k.v, unit: 'N' }
      if (target === 'v') return { value: k.P / k.F, unit: 'm/s' }
      throw unsolved('mechanics.power-velocity', target)
    },
  },
  {
    id: 'mechanics.kinetic',
    topic: 'mechanics',
    name: '动能',
    formula: 'Ek = ½·m·v²',
    expr: '0.5 * m * v ^ 2',
    vars: { Ek: 'J', m: 'kg', v: 'm/s' },
    solve(target, k) {
      if (target === 'Ek') return { value: 0.5 * k.m * k.v ** 2, unit: 'J' }
      if (target === 'm') return { value: (2 * k.Ek) / k.v ** 2, unit: 'kg' }
      if (target === 'v') return { value: Math.sqrt((2 * k.Ek) / k.m), unit: 'm/s' }
      throw unsolved('mechanics.kinetic', target)
    },
  },
  {
    id: 'mechanics.potential',
    topic: 'mechanics',
    name: '重力势能',
    formula: 'Ep = m·g·h',
    expr: 'm * g * h',
    vars: { Ep: 'J', m: 'kg', g: 'm/s²', h: 'm' },
    solve(target, k) {
      if (target === 'Ep') return { value: k.m * k.g * k.h, unit: 'J' }
      if (target === 'm') return { value: k.Ep / (k.g * k.h), unit: 'kg' }
      if (target === 'g') return { value: k.Ep / (k.m * k.h), unit: 'm/s²' }
      if (target === 'h') return { value: k.Ep / (k.m * k.g), unit: 'm' }
      throw unsolved('mechanics.potential', target)
    },
  },
  {
    id: 'mechanics.momentum',
    topic: 'mechanics',
    name: '动量',
    formula: 'p = m·v',
    expr: 'm * v',
    vars: { p: 'kg·m/s', m: 'kg', v: 'm/s' },
    solve(target, k) {
      if (target === 'p') return { value: k.m * k.v, unit: 'kg·m/s' }
      if (target === 'm') return { value: k.p / k.v, unit: 'kg' }
      if (target === 'v') return { value: k.p / k.m, unit: 'm/s' }
      throw unsolved('mechanics.momentum', target)
    },
  },
  {
    id: 'mechanics.impulse',
    topic: 'mechanics',
    name: '动量定理',
    formula: 'F·t = m·v − m·v₀',
    expr: 'F * t = m * v - m * v0',
    vars: { F: 'N', t: 's', m: 'kg', v: 'm/s', v0: 'm/s' },
    solve(target, k) {
      if (target === 'F') return { value: (k.m * k.v - k.m * k.v0) / k.t, unit: 'N' }
      if (target === 't') return { value: (k.m * k.v - k.m * k.v0) / k.F, unit: 's' }
      if (target === 'v') return { value: (k.F * k.t) / k.m + k.v0, unit: 'm/s' }
      if (target === 'v0') return { value: k.v - (k.F * k.t) / k.m, unit: 'm/s' }
      if (target === 'm') return { value: (k.F * k.t) / (k.v - k.v0), unit: 'kg' }
      throw unsolved('mechanics.impulse', target)
    },
  },
  {
    id: 'mechanics.centripetal',
    topic: 'mechanics',
    name: '向心力',
    formula: 'F = m·v² / r',
    expr: 'm * v ^ 2 / r',
    vars: { F: 'N', m: 'kg', v: 'm/s', r: 'm' },
    solve(target, k) {
      if (target === 'F') return { value: (k.m * k.v ** 2) / k.r, unit: 'N' }
      if (target === 'm') return { value: (k.F * k.r) / k.v ** 2, unit: 'kg' }
      if (target === 'v') return { value: Math.sqrt((k.F * k.r) / k.m), unit: 'm/s' }
      if (target === 'r') return { value: (k.m * k.v ** 2) / k.F, unit: 'm' }
      throw unsolved('mechanics.centripetal', target)
    },
  },
  {
    id: 'mechanics.gravitation',
    topic: 'mechanics',
    name: '万有引力',
    formula: 'F = G·M·m / r²',
    expr: 'G * M * m / r ^ 2',
    vars: { F: 'N', G: 'N·m²/kg²', M: 'kg', m: 'kg', r: 'm' },
    solve(target, k) {
      if (target === 'F') return { value: (k.G * k.M * k.m) / k.r ** 2, unit: 'N' }
      if (target === 'M') return { value: (k.F * k.r ** 2) / (k.G * k.m), unit: 'kg' }
      if (target === 'm') return { value: (k.F * k.r ** 2) / (k.G * k.M), unit: 'kg' }
      if (target === 'r') return { value: Math.sqrt((k.G * k.M * k.m) / k.F), unit: 'm' }
      if (target === 'G') return { value: (k.F * k.r ** 2) / (k.M * k.m), unit: 'N·m²/kg²' }
      throw unsolved('mechanics.gravitation', target)
    },
  },

  /* ---------------- 电磁学 ---------------- */
  {
    id: 'em.ohm',
    topic: 'em',
    name: '欧姆定律',
    formula: 'I = U / R',
    expr: 'U / R',
    vars: { I: 'A', U: 'V', R: 'Ω' },
    solve(target, k) {
      if (target === 'I') return { value: k.U / k.R, unit: 'A' }
      if (target === 'U') return { value: k.I * k.R, unit: 'V' }
      if (target === 'R') return { value: k.U / k.I, unit: 'Ω' }
      throw unsolved('em.ohm', target)
    },
  },
  {
    id: 'em.resistance',
    topic: 'em',
    name: '电阻定律',
    formula: 'R = ρ·L / S',
    expr: 'rho * L / S',
    vars: { R: 'Ω', rho: 'Ω·m', L: 'm', S: 'm²' },
    symbols: { rho: 'ρ' },
    solve(target, k) {
      if (target === 'R') return { value: (k.rho * k.L) / k.S, unit: 'Ω' }
      if (target === 'rho') return { value: (k.R * k.S) / k.L, unit: 'Ω·m' }
      if (target === 'L') return { value: (k.R * k.S) / k.rho, unit: 'm' }
      if (target === 'S') return { value: (k.rho * k.L) / k.R, unit: 'm²' }
      throw unsolved('em.resistance', target)
    },
  },
  {
    id: 'em.series',
    topic: 'em',
    name: '串联电阻',
    formula: 'R = R₁ + R₂',
    expr: 'R1 + R2',
    vars: { R: 'Ω', R1: 'Ω', R2: 'Ω' },
    solve(target, k) {
      if (target === 'R') return { value: k.R1 + k.R2, unit: 'Ω' }
      if (target === 'R1') return { value: k.R - k.R2, unit: 'Ω' }
      if (target === 'R2') return { value: k.R - k.R1, unit: 'Ω' }
      throw unsolved('em.series', target)
    },
  },
  {
    id: 'em.parallel',
    topic: 'em',
    name: '并联电阻',
    formula: '1/R = 1/R₁ + 1/R₂',
    expr: '1 / R = 1 / R1 + 1 / R2',
    vars: { R: 'Ω', R1: 'Ω', R2: 'Ω' },
    solve(target, k) {
      if (target === 'R') return { value: 1 / (1 / k.R1 + 1 / k.R2), unit: 'Ω' }
      if (target === 'R1') return { value: 1 / (1 / k.R - 1 / k.R2), unit: 'Ω' }
      if (target === 'R2') return { value: 1 / (1 / k.R - 1 / k.R1), unit: 'Ω' }
      throw unsolved('em.parallel', target)
    },
  },
  {
    id: 'em.power',
    topic: 'em',
    name: '电功率',
    formula: 'P = U·I',
    expr: 'U * I',
    vars: { P: 'W', U: 'V', I: 'A' },
    solve(target, k) {
      if (target === 'P') return { value: k.U * k.I, unit: 'W' }
      if (target === 'U') return { value: k.P / k.I, unit: 'V' }
      if (target === 'I') return { value: k.P / k.U, unit: 'A' }
      throw unsolved('em.power', target)
    },
  },
  {
    id: 'em.joule-heat',
    topic: 'em',
    name: '焦耳热',
    formula: 'Q = I²·R·t',
    expr: 'I ^ 2 * R * t',
    vars: { Q: 'J', I: 'A', R: 'Ω', t: 's' },
    solve(target, k) {
      if (target === 'Q') return { value: k.I ** 2 * k.R * k.t, unit: 'J' }
      if (target === 'I') return { value: Math.sqrt(k.Q / (k.R * k.t)), unit: 'A' }
      if (target === 'R') return { value: k.Q / (k.I ** 2 * k.t), unit: 'Ω' }
      if (target === 't') return { value: k.Q / (k.I ** 2 * k.R), unit: 's' }
      throw unsolved('em.joule-heat', target)
    },
  },
  {
    id: 'em.work',
    topic: 'em',
    name: '电流做功',
    formula: 'W = U·I·t',
    expr: 'U * I * t',
    vars: { W: 'J', U: 'V', I: 'A', t: 's' },
    solve(target, k) {
      if (target === 'W') return { value: k.U * k.I * k.t, unit: 'J' }
      if (target === 'U') return { value: k.W / (k.I * k.t), unit: 'V' }
      if (target === 'I') return { value: k.W / (k.U * k.t), unit: 'A' }
      if (target === 't') return { value: k.W / (k.U * k.I), unit: 's' }
      throw unsolved('em.work', target)
    },
  },
  {
    id: 'em.coulomb',
    topic: 'em',
    name: '库仑定律',
    formula: 'F = k·q₁·q₂ / r²',
    expr: 'k * q1 * q2 / r ^ 2',
    vars: { F: 'N', k: 'N·m²/C²', q1: 'C', q2: 'C', r: 'm' },
    solve(target, k) {
      if (target === 'F') return { value: (k.k * k.q1 * k.q2) / k.r ** 2, unit: 'N' }
      if (target === 'q1') return { value: (k.F * k.r ** 2) / (k.k * k.q2), unit: 'C' }
      if (target === 'q2') return { value: (k.F * k.r ** 2) / (k.k * k.q1), unit: 'C' }
      if (target === 'r') return { value: Math.sqrt((k.k * k.q1 * k.q2) / k.F), unit: 'm' }
      if (target === 'k') return { value: (k.F * k.r ** 2) / (k.q1 * k.q2), unit: 'N·m²/C²' }
      throw unsolved('em.coulomb', target)
    },
  },
  {
    id: 'em.field-force',
    topic: 'em',
    name: '电场力',
    formula: 'F = q·E',
    expr: 'q * E',
    vars: { F: 'N', q: 'C', E: 'N/C' },
    solve(target, k) {
      if (target === 'F') return { value: k.q * k.E, unit: 'N' }
      if (target === 'q') return { value: k.F / k.E, unit: 'C' }
      if (target === 'E') return { value: k.F / k.q, unit: 'N/C' }
      throw unsolved('em.field-force', target)
    },
  },
  {
    id: 'em.field-uniform',
    topic: 'em',
    name: '匀强电场',
    formula: 'E = U / d',
    expr: 'U / d',
    vars: { E: 'V/m', U: 'V', d: 'm' },
    solve(target, k) {
      if (target === 'E') return { value: k.U / k.d, unit: 'V/m' }
      if (target === 'U') return { value: k.E * k.d, unit: 'V' }
      if (target === 'd') return { value: k.U / k.E, unit: 'm' }
      throw unsolved('em.field-uniform', target)
    },
  },
  {
    id: 'em.lorentz',
    topic: 'em',
    name: '洛伦兹力',
    formula: 'F = q·v·B',
    expr: 'q * v * B',
    vars: { F: 'N', q: 'C', v: 'm/s', B: 'T' },
    solve(target, k) {
      if (target === 'F') return { value: k.q * k.v * k.B, unit: 'N' }
      if (target === 'q') return { value: k.F / (k.v * k.B), unit: 'C' }
      if (target === 'v') return { value: k.F / (k.q * k.B), unit: 'm/s' }
      if (target === 'B') return { value: k.F / (k.q * k.v), unit: 'T' }
      throw unsolved('em.lorentz', target)
    },
  },
  {
    id: 'em.ampere-force',
    topic: 'em',
    name: '安培力',
    formula: 'F = B·I·L',
    expr: 'B * I * L',
    vars: { F: 'N', B: 'T', I: 'A', L: 'm' },
    solve(target, k) {
      if (target === 'F') return { value: k.B * k.I * k.L, unit: 'N' }
      if (target === 'B') return { value: k.F / (k.I * k.L), unit: 'T' }
      if (target === 'I') return { value: k.F / (k.B * k.L), unit: 'A' }
      if (target === 'L') return { value: k.F / (k.B * k.I), unit: 'm' }
      throw unsolved('em.ampere-force', target)
    },
  },
  {
    id: 'em.flux',
    topic: 'em',
    name: '磁通量',
    formula: 'Φ = B·S',
    expr: 'B * S',
    vars: { phi: 'Wb', B: 'T', S: 'm²' },
    symbols: { phi: 'Φ' },
    solve(target, k) {
      if (target === 'phi') return { value: k.B * k.S, unit: 'Wb' }
      if (target === 'B') return { value: k.phi / k.S, unit: 'T' }
      if (target === 'S') return { value: k.phi / k.B, unit: 'm²' }
      throw unsolved('em.flux', target)
    },
  },
  {
    id: 'em.faraday',
    topic: 'em',
    name: '法拉第电磁感应',
    formula: 'E = ΔΦ / Δt',
    expr: 'dPhi / dt',
    vars: { emf: 'V', dPhi: 'Wb', dt: 's' },
    symbols: { emf: 'E', dPhi: 'ΔΦ', dt: 'Δt' },
    solve(target, k) {
      if (target === 'emf') return { value: k.dPhi / k.dt, unit: 'V' }
      if (target === 'dPhi') return { value: k.emf * k.dt, unit: 'Wb' }
      if (target === 'dt') return { value: k.dPhi / k.emf, unit: 's' }
      throw unsolved('em.faraday', target)
    },
  },
  {
    id: 'em.capacitance',
    topic: 'em',
    name: '电容',
    formula: 'C = Q / U',
    expr: 'Q / U',
    vars: { C: 'F', Q: 'C', U: 'V' },
    solve(target, k) {
      if (target === 'C') return { value: k.Q / k.U, unit: 'F' }
      if (target === 'Q') return { value: k.C * k.U, unit: 'C' }
      if (target === 'U') return { value: k.Q / k.C, unit: 'V' }
      throw unsolved('em.capacitance', target)
    },
  },

  /* ---------------- 光学 ---------------- */
  {
    id: 'optics.snell',
    topic: 'optics',
    name: '折射定律',
    formula: 'n₁·sin i = n₂·sin r',
    expr: 'n1 * sin(i) = n2 * sin(r)',
    vars: { n1: '1', n2: '1', i: '°', r: '°' },
    solve(target, k) {
      const toRad = (deg) => (deg * Math.PI) / 180
      const toDeg = (rad) => (rad * 180) / Math.PI
      if (target === 'i') return { value: toDeg(Math.asin((k.n2 * Math.sin(toRad(k.r))) / k.n1)), unit: '°' }
      if (target === 'r') return { value: toDeg(Math.asin((k.n1 * Math.sin(toRad(k.i))) / k.n2)), unit: '°' }
      if (target === 'n1') return { value: (k.n2 * Math.sin(toRad(k.r))) / Math.sin(toRad(k.i)), unit: '1' }
      if (target === 'n2') return { value: (k.n1 * Math.sin(toRad(k.i))) / Math.sin(toRad(k.r)), unit: '1' }
      throw unsolved('optics.snell', target)
    },
  },
  {
    id: 'optics.critical',
    topic: 'optics',
    name: '全反射临界角',
    formula: 'sin C = 1 / n',
    expr: 'sin(C) = 1 / n',
    vars: { C: '°', n: '1' },
    solve(target, k) {
      const toDeg = (rad) => (rad * 180) / Math.PI
      if (target === 'C') return { value: toDeg(Math.asin(1 / k.n)), unit: '°' }
      if (target === 'n') return { value: 1 / Math.sin((k.C * Math.PI) / 180), unit: '1' }
      throw unsolved('optics.critical', target)
    },
  },
  {
    id: 'optics.lens',
    topic: 'optics',
    name: '透镜成像公式',
    formula: '1/u + 1/v = 1/f',
    expr: '1 / u + 1 / v = 1 / f',
    vars: { u: 'm', v: 'm', f: 'm' },
    solve(target, k) {
      if (target === 'f') return { value: 1 / (1 / k.u + 1 / k.v), unit: 'm' }
      if (target === 'v') return { value: 1 / (1 / k.f - 1 / k.u), unit: 'm' }
      if (target === 'u') return { value: 1 / (1 / k.f - 1 / k.v), unit: 'm' }
      throw unsolved('optics.lens', target)
    },
  },
  {
    id: 'optics.magnification',
    topic: 'optics',
    name: '放大率',
    formula: 'k = |v| / u',
    expr: 'abs(v) / u',
    vars: { k: '1', u: 'm', v: 'm' },
    solve(target, k) {
      if (target === 'k') return { value: Math.abs(k.v) / k.u, unit: '1' }
      if (target === 'u') return { value: Math.abs(k.v) / k.k, unit: 'm' }
      if (target === 'v') return { value: k.k * k.u, unit: 'm' }
      throw unsolved('optics.magnification', target)
    },
  },
  {
    id: 'optics.refractive-speed',
    topic: 'optics',
    name: '折射率与光速',
    formula: 'n = c / v',
    expr: 'c / v',
    vars: { n: '1', c: 'm/s', v: 'm/s' },
    solve(target, k) {
      if (target === 'n') return { value: k.c / k.v, unit: '1' }
      if (target === 'c') return { value: k.n * k.v, unit: 'm/s' }
      if (target === 'v') return { value: k.c / k.n, unit: 'm/s' }
      throw unsolved('optics.refractive-speed', target)
    },
  },
]

const TOPIC_NAMES = {
  kinematics: '运动学',
  mechanics: '力学',
  em: '电磁学',
  optics: '光学',
}

function unsolved(id, target) {
  return new RangeError(`公式 ${id} 不能解出 ${target}（该变量组合不支持或缺少关系）`)
}

/** 选路只使用显式变量表，不从展示文本猜测依赖。顺序定义首选路径。 */
function selectRelation(formula, target, knowns) {
  return formula.relations?.find((relation) => relation.solutions[target] !== undefined
    && Object.keys(relation.solutions).every((name) => name === target || knowns[name] !== undefined))
}

/* ================================================================== */
/* 四、公式求值入口                                                     */
/* ================================================================== */

/**
 * 用公式解题。
 * @param {string} id 公式 id
 * @param {string} target 待求变量
 * @param {Record<string, {value: number, unit?: string}>} knowns 已知量（带单位）
 * @returns {{ok: true, result: object} | {ok: false, reason: string}}
 */
export function evaluateFormula(id, target, knowns) {
  const formula = FORMULAS.find((f) => f.id === id)
  if (!formula) return { ok: false, reason: `没有id为 ${id} 的公式` }
  const declared = formula.vars[target]
  if (!declared) return { ok: false, reason: `公式 ${id} 中没有变量 ${target}` }
  if (!knowns || typeof knowns !== 'object' || Array.isArray(knowns)) {
    return { ok: false, reason: '已知量必须为带数值和单位的对象' }
  }

  // 1. 收集并换算已知量（单位量纲必须一致）
  const converted = {}
  for (const [name, quantity] of Object.entries(knowns)) {
    const varUnit = formula.vars[name]
    if (!varUnit) return { ok: false, reason: `公式 ${id} 中没有变量 ${name}（疑似笔误或选错公式）` }
    if (!quantity || !Number.isFinite(quantity.value)) {
      return { ok: false, reason: `已知量 ${name} 必须是有限数值` }
    }
    const parsed = parseUnit(quantity.unit ?? varUnit)
    const declaredUnit = parseUnit(varUnit)
    if (!parsed || !declaredUnit) return { ok: false, reason: `无法解析单位：${quantity.unit ?? varUnit}` }
    if (!dimEqual(parsed.dimension, declaredUnit.dimension)) {
      return {
        ok: false,
        reason: `单位不一致：${name} 应为 ${varUnit}（量纲 ${dimToString(declaredUnit.dimension)}），收到 ${quantity.unit}（量纲 ${dimToString(parsed.dimension)}）`,
      }
    }
    converted[name] = (quantity.value * parsed.factor) / declaredUnit.factor
    if (!Number.isFinite(converted[name])) return { ok: false, reason: `已知量 ${name} 换算后不是有限值` }
  }

  // 2. 选定可解关系；缺量时报告首选路径。单关系公式要求其余声明变量齐全。
  const relation = selectRelation(formula, target, converted)
  const required = formula.relations
    ? Object.keys(formula.relations.find((entry) => entry.solutions[target] !== undefined)?.solutions ?? {})
    : Object.keys(formula.vars)
  const missing = required.filter((name) => name !== target && converted[name] === undefined)
  if ((!formula.relations || !relation) && missing.length) {
    return { ok: false, reason: `缺少已知量：${missing.join('、')}（解出 ${target} 需要它们）` }
  }

  // 3. 计算
  let outcome
  try {
    if (formula.relations) {
      if (!relation) throw unsolved(id, target)
      const expression = relation.solutions[target]
      outcome = { value: evaluateNumeric(expression, converted), unit: declared }
      if (expression.includes('sqrt(')) outcome.note = '取非负根（自由落体/平抛的时间或速率）'
    } else {
      outcome = formula.solve(target, converted)
    }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
  if (!Number.isFinite(outcome.value) && !Array.isArray(outcome.value)) {
    return { ok: false, reason: '计算结果不是有限值（检查已知量是否导致除零或负数开方）' }
  }
  if (Array.isArray(outcome.value) && outcome.value.some((v) => !Number.isFinite(v))) {
    return { ok: false, reason: '计算结果包含非有限值' }
  }

  if (relation) {
    const checked = residualCheck(id, target, converted, outcome.value)
    if (!checked.ok) return { ok: false, reason: `回代校验失败（已知量可能矛盾）：${checked.detail}` }
  }
  const substitution = relation
    ? buildRelationSubstitution(formula, relation, target, converted, outcome)
    : buildSubstitution(formula, target, converted, outcome)
  return {
    ok: true,
    result: {
      id: formula.id,
      name: formula.name,
      topic: formula.topic,
      topicName: TOPIC_NAMES[formula.topic],
      formula: formula.formula,
      target,
      value: outcome.value,
      unit: outcome.unit,
      note: outcome.note,
      substitution,
    },
  }
}

/** 展示实际求解逆式，避免把原方程某一边与另一量的答案连成假等式。 */
function buildRelationSubstitution(formula, relation, target, knowns, outcome) {
  const filled = relation.solutions[target].replace(/[A-Za-z][A-Za-z0-9]*/gu, (name) => (
    knowns[name] === undefined ? name : displayTerm(knowns[name])
  )).replace(/ \* /gu, '×').replace(/ \^ 2/gu, '²')
  return `${displaySymbol(formula, target)} = ${filled} = ${displayValue(outcome.value)} ${outcome.unit}`.replace(/-/gu, '−')
}

/** 生成可核对的代入串，如「v = 10 + 2×3 = 16 m/s」。 */
function buildSubstitution(formula, target, knowns, outcome) {
  const targetSymbol = displaySymbol(formula, target)
  const clauses = formula.formula.split('；')
  const clause = clauses.find((part) => part.includes(targetSymbol)) ?? formula.formula
  const symbols = Object.keys(formula.vars)
    .filter((name) => knowns[name] !== undefined)
    .sort((a, b) => b.length - a.length)
  let filled = clause
  for (const name of symbols) {
    const rendered = displayTerm(knowns[name])
    const symbol = escapeRegExp(displaySymbol(formula, name))
    // 词边界替换：避免把 sin 里的 i、n₁ 的 n 误替换。
    // 边界用 \p{Nd}（十进制数字）而非 \p{N}：上标 ²/³ 与下标 ₀/₁/₂ 属
    // \p{No}，若算"词内字符"会导致 v²、v₀² 这类带上标的变量无法代入。
    // 长符号（v₀/n₁/R₁）按长度降序先替换，替换后短符号（v）不会误伤。
    filled = filled.replace(new RegExp(`(?<![\\p{L}\\p{Nd}_])${symbol}(?![\\p{L}\\p{Nd}_])`, 'gu'), rendered)
  }
  const roots = Array.isArray(outcome.value) ? outcome.value : [outcome.value]
  const shown = roots.map((v) => displayValue(v)).join(' 或 ')
  const body = filled.replace(/·/gu, '×')
  // 裸目标检测：目标符号未带上标/下标（v²、v₀ 中的 v 都不算裸出现）。
  // \p{No} 覆盖 ²/³/₀/₁/₂/½ 等上下标，必须排除，否则 v₀ 会让 v² = … 求 v
  // 的句子被误判为"目标裸出现"而走错分支。
  const bareTarget = new RegExp(`(?<![\\p{L}\\p{Nd}_])${escapeRegExp(targetSymbol)}(?![\\p{L}\\p{Nd}\\p{No}_])`, 'u')
  let text
  if (roots.length === 1 && !bareTarget.test(clause) && clause.includes(targetSymbol)) {
    // 目标只以上标形式出现（v² = v₀² + 2as 求 v；Q = I²·R·t 求 I）：
    // 等号两边不是目标本身，把目标值代入后求值右式，再给出目标值，
    // 否则会写成 v² = … = 10 m/s 这类把 v 当 v² 的错误等式。
    const permissive = new RegExp(`(?<![\\p{L}\\p{Nd}_])${escapeRegExp(targetSymbol)}(?![\\p{L}\\p{Nd}_])`, 'gu')
    const forEval = filled.replace(permissive, String(roots[0]))
    const rhs = forEval.split('=').slice(1).join('=')
    let evaluated = null
    try {
      const value = evaluateNumeric(toEvaluable(rhs), {})
      if (Number.isFinite(value)) evaluated = displayValue(value)
    } catch {
      evaluated = null
    }
    text = evaluated === null
      ? `${body}；${targetSymbol} = ${shown} ${outcome.unit}`
      : `${body} = ${evaluated}；${targetSymbol} = ${shown} ${outcome.unit}`
  } else if (Array.isArray(outcome.value)) {
    // 多解：方程解集用 → 引出，避免写成「10 = … = −2 或 2 s」的假等式
    text = `${body} → ${targetSymbol} = ${shown} ${outcome.unit}`
  } else {
    text = `${body} = ${shown} ${outcome.unit}`
  }
  return text.replace(/-/gu, '−')
}

/** 把代入串中的数学记号归一化为 evaluateNumeric 可求值的形式。 */
function toEvaluable(text) {
  return text
    .replace(/·/gu, '*')
    .replace(/×/gu, '*')
    .replace(/½/gu, '0.5')
    .replace(/²/gu, '^2')
    .replace(/³/gu, '^3')
    .replace(/−/gu, '-')
}

/** 代入串中项显示：负值加括号（v = 20 + (−4)×2），6 位有效数字。 */
function displayTerm(value) {
  if (!Number.isFinite(value)) return String(value)
  const text = String(Number(value.toPrecision(6)))
  return text.startsWith('-') ? `(−${text.slice(1)})` : text
}

/** 代入串中的数值显示：6 位有效数字，去掉浮点尾差。 */
function displayValue(value) {
  if (!Number.isFinite(value)) return String(value)
  return String(Number(value.toPrecision(6)))
}

/** 公式展示串中的变量符号：R1 → R₁；symbols 字段可覆盖（μ/ρ/Φ/ΔΦ 等）。 */
function displaySymbol(formula, name) {
  if (formula.symbols?.[name]) return formula.symbols[name]
  const subscripts = { 0: '₀', 1: '₁', 2: '₂' }
  const match = /^([A-Za-z]+)(\d)$/u.exec(name)
  if (match) return `${match[1]}${subscripts[match[2]] ?? match[2]}`
  return name
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/* ================================================================== */
/* 五、量纲审计（注册期自检）                                            */
/* ================================================================== */

/**
 * 审计所有公式左右两边量纲是否一致。
 * @returns {{ok: boolean, problems: string[]}}
 */
export function auditFormulaDimensions() {
  const problems = []
  for (const formula of FORMULAS) {
    const varDims = {}
    for (const [name, unit] of Object.entries(formula.vars)) {
      const parsed = parseUnit(unit)
      if (!parsed) {
        problems.push(`${formula.id}: 无法解析变量单位 ${unit}`)
        continue
      }
      varDims[name] = parsed.dimension
    }
    const expressions = formula.relations ? formula.relations.flatMap((relation) => [
      relation.expr,
      ...Object.entries(relation.solutions).map(([target, expression]) => `${target} = ${expression}`),
    ]) : [formula.expr]
    for (const expression of expressions) {
      const parts = expression.split('=')
      if (parts.length > 2) {
        problems.push(`${formula.id}: expr 最多一个等号`)
        continue
      }
      try {
        if (parts.length === 2) {
          const left = evalDimExpression(parts[0].trim(), varDims)
          const right = evalDimExpression(parts[1].trim(), varDims)
          if (!dimEqual(left, right)) {
            problems.push(`${formula.id}: 左边量纲 ${dimToString(left)} ≠ 右边 ${dimToString(right)}`)
          }
        } else {
          // 只写右式：左边取展示公式首行的主变量
          const primary = primaryTargetVar(formula)
          if (!primary) {
            problems.push(`${formula.id}: 无法从展示公式推断主变量，请在 expr 中写等号`)
            continue
          }
          const right = evalDimExpression(parts[0].trim(), varDims)
          if (!dimEqual(varDims[primary], right)) {
            problems.push(`${formula.id}: ${primary} 量纲 ${dimToString(varDims[primary])} ≠ 右式 ${dimToString(right)}`)
          }
        }
      } catch (error) {
        problems.push(`${formula.id}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
  return { ok: problems.length === 0, problems }
}

/** 展示公式首行等号左边的变量名（用于右式-only 的量纲审计）。 */
function primaryTargetVar(formula) {
  const clause = formula.formula.split('；')[0]
  const eq = clause.indexOf('=')
  if (eq < 0) return null
  const symbol = clause.slice(0, eq).trim()
  for (const name of Object.keys(formula.vars)) {
    if (displaySymbol(formula, name) === symbol) return name
  }
  return null
}

const DIM_FUNCTIONS = { sin: (d) => d, cos: (d) => d, tan: (d) => d, asin: (d) => d, acos: (d) => d, atan: (d) => d, abs: (d) => d, sqrt: (d) => dimPow(d, 0.5) }

/**
 * 迷你量纲表达式求值：支持 + - * / ^ ( ) 与一元函数。
 * 数字（含 0.5、π）视为无量纲；变量查 varDims。
 */
export function evalDimExpression(expression, varDims) {
  const tokens = tokenizeDim(expression)
  let position = 0

  function peek() {
    return tokens[position]
  }

  function take() {
    return tokens[position++]
  }

  function parseExpression() {
    let left = parseTerm()
    while (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
      take()
      const right = parseTerm()
      if (!dimEqual(left, right)) {
        throw new Error(`加减法两侧量纲不一致：${dimToString(left)} 与 ${dimToString(right)}`)
      }
      left = left // 加减不改变量纲（已校验一致）
    }
    return left
  }

  function parseTerm() {
    let left = parseUnary()
    while (peek()?.type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const operator = take().value
      const right = parseUnary()
      left = operator === '*' ? dimMul(left, right) : dimDiv(left, right)
    }
    return left
  }

  function parseUnary() {
    if (peek()?.type === 'op' && (peek().value === '-' || peek().value === '+')) {
      take()
      return parseUnary()
    }
    return parsePower()
  }

  function parsePower() {
    const base = parseAtom()
    if (peek()?.type === 'op' && peek().value === '^') {
      take()
      const exponentToken = take()
      if (!exponentToken || exponentToken.type !== 'number') {
        throw new Error('指数必须是数字字面量')
      }
      const exponent = Number(exponentToken.value)
      if (!Number.isInteger(exponent)) throw new Error('指数必须是整数')
      return dimPow(base, exponent)
    }
    return base
  }

  function parseAtom() {
    const token = take()
    if (!token) throw new Error('表达式意外结束')
    if (token.type === 'number') return {}
    if (token.type === 'var') {
      const dimension = varDims[token.value]
      if (!dimension) throw new Error(`未知变量 ${token.value}`)
      return dimension
    }
    if (token.type === 'func') {
      // 括号已由 parseAtom 的 paren 分支消费，这里直接求值参数
      return DIM_FUNCTIONS[token.value](parseExpression())
    }
    if (token.type === 'paren' && token.value === '(') {
      const inner = parseExpression()
      const closing = take()
      if (!closing || closing.value !== ')') throw new Error('缺少右括号')
      return inner
    }
    throw new Error(`无法解析的记号：${token.value}`)
  }

  const result = parseExpression()
  if (position < tokens.length) throw new Error('表达式存在无法解析的尾部')
  return result
}

function tokenizeDim(expression) {
  const tokens = []
  let index = 0
  const source = String(expression)
  while (index < source.length) {
    const char = source[index]
    if (/\s/u.test(char)) {
      index += 1
      continue
    }
    if (/[0-9.]/u.test(char)) {
      let value = ''
      while (index < source.length && /[0-9.]/u.test(source[index])) value += source[index++]
      tokens.push({ type: 'number', value })
      continue
    }
    if (/[A-Za-zμρΦ]/u.test(char)) {
      let value = ''
      while (index < source.length && /[A-Za-z0-9μρΦ]/u.test(source[index])) value += source[index++]
      if (source[index] === '(' && DIM_FUNCTIONS[value]) {
        index += 1
        tokens.push({ type: 'func', value })
        tokens.push({ type: 'paren', value: '(' })
        continue
      }
      if (value === 'pi' || value === 'π') {
        tokens.push({ type: 'number', value: String(Math.PI) })
        continue
      }
      tokens.push({ type: 'var', value })
      continue
    }
    if ('+-*/^()'.includes(char)) {
      tokens.push({ type: char === '(' || char === ')' ? 'paren' : 'op', value: char })
      index += 1
      continue
    }
    throw new Error(`无法识别的字符：${char}`)
  }
  return tokens
}

/* ================================================================== */
/* 六、查询接口                                                         */
/* ================================================================== */

/**
 * 单位换算：把数值从 fromUnit 换到 toUnit（量纲必须一致）。
 * @returns {{ok: true, value: number} | {ok: false, reason: string}}
 */
export function convertQuantity(value, fromUnit, toUnit) {
  const from = parseUnit(fromUnit)
  const to = parseUnit(toUnit)
  if (!from || !to) return { ok: false, reason: `无法解析单位：${!from ? fromUnit : toUnit}` }
  if (!dimEqual(from.dimension, to.dimension)) {
    return { ok: false, reason: `单位量纲不一致：${fromUnit} 与 ${toUnit}` }
  }
  return { ok: true, value: (value * from.factor) / to.factor }
}

/**
 * 回代校验：把求出的结果代回公式表达式，验证两边一致。
 * 这是对 solve 实现的独立复核——任何一边写错都会在这里暴露。
 * @returns {{ok: boolean, detail: string}}
 */
export function residualCheck(id, target, knowns, result) {
  const formula = FORMULAS.find((f) => f.id === id)
  if (!formula) return { ok: false, detail: `没有id为 ${id} 的公式` }
  if (!formula.vars[target]) return { ok: false, detail: `公式 ${id} 中没有变量 ${target}` }
  if (!knowns || typeof knowns !== 'object' || Array.isArray(knowns)
    || Object.entries(knowns).some(([name, value]) => !formula.vars[name] || !Number.isFinite(value))) {
    return { ok: false, detail: '回代已知量必须是声明变量的有限数值（公式声明单位）' }
  }
  // 多解（如位移公式求 t 得 ±2）：每个根都须独立满足方程
  const roots = Array.isArray(result) ? result : [result]
  if (!roots.length || roots.some((root) => !Number.isFinite(root))) {
    return { ok: false, detail: '回代结果必须包含有限数值' }
  }
  const outcomes = roots.map((root) => residualCheckOne(formula, target, knowns, root))
  return { ok: outcomes.every((o) => o.ok), detail: outcomes.map((o) => o.detail).join('；') }
}

function residualCheckOne(formula, target, knowns, result) {
  if (knowns[target] !== undefined && !numericEqual(knowns[target], result)) {
    return { ok: false, detail: `${target} 的已知值 ${knowns[target]} 与结果 ${result} 不一致` }
  }
  if (formula.relations) {
    const selected = selectRelation(formula, target, knowns)
    if (!selected) return { ok: false, detail: `缺少已知量：没有可回代 ${target} 的支持关系` }
    const values = { ...knowns, [target]: result }
    // 必须包括实际选用关系；其它完全绑定关系也都复核，不能忽略冗余题设。
    const bound = formula.relations.filter((relation) => Object.keys(relation.solutions)
      .every((name) => values[name] !== undefined))
    const checks = bound.map((relation) => {
      try {
        const [leftExpr, rightExpr] = relation.expr.split('=')
        const left = evaluateNumeric(leftExpr, values)
        const right = evaluateNumeric(rightExpr, values)
        return { ok: numericEqual(left, right), detail: `${relation.expr}：左 ${left} ≈ 右 ${right}` }
      } catch (error) {
        return { ok: false, detail: error instanceof Error ? error.message : String(error) }
      }
    })
    return { ok: checks.every((check) => check.ok), detail: checks.map((check) => check.detail).join('；') }
  }
  const primary = primaryTargetVar(formula)
  const parts = formula.expr.split('=')
  const values = { ...knowns }
  values[target] = result
  try {
    if (parts.length === 2) {
      const left = evaluateNumeric(parts[0].trim(), values)
      const right = evaluateNumeric(parts[1].trim(), values)
      const scale = Math.max(1, Math.abs(left), Math.abs(right))
      return {
        ok: Math.abs(left - right) <= 1e-9 * scale,
        detail: `左 ${left} ≈ 右 ${right}`,
      }
    }
    if (!primary) return { ok: false, detail: '无法推断主变量' }
    const right = evaluateNumeric(parts[0].trim(), values)
    // 目标即主变量：右式应等于结果；目标非主变量（如 s = v₀t + ½at² 求 t）：
    // 代入后右式应与主变量的已知值相等，而不是与目标值比。
    const expected = knowns[primary] !== undefined ? knowns[primary] : result
    const scale = Math.max(1, Math.abs(expected), Math.abs(right))
    return {
      ok: Math.abs(expected - right) <= 1e-9 * scale,
      detail: expected === result ? `结果 ${result} ≈ 右式 ${right}` : `${primary} 的已知值 ${expected} ≈ 右式 ${right}`,
    }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}

function numericEqual(left, right) {
  return Number.isFinite(left) && Number.isFinite(right)
    && Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right))
}

const NUM_FUNCTIONS = {
  sin: (x) => Math.sin((x * Math.PI) / 180), // 公式中角度一律按度
  cos: (x) => Math.cos((x * Math.PI) / 180),
  tan: (x) => Math.tan((x * Math.PI) / 180),
  asin: (x) => (Math.asin(x) * 180) / Math.PI,
  acos: (x) => (Math.acos(x) * 180) / Math.PI,
  atan: (x) => (Math.atan(x) * 180) / Math.PI,
  abs: Math.abs,
  sqrt: Math.sqrt,
}

/**
 * 迷你数值表达式求值：支持 + - * / ^ ( ) 与 sin/cos/abs/sqrt（角度按度）。
 * 未提供的变量直接抛错；只接受此解析器支持的算术和白名单函数。
 */
export function evaluateNumeric(expression, values = {}) {
  const tokens = tokenizeNumeric(expression)
  let position = 0

  const peek = () => tokens[position]
  const take = () => tokens[position++]

  function parseExpression() {
    let left = parseTerm()
    while (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const operator = take().value
      const right = parseTerm()
      left = operator === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm() {
    let left = parseUnary()
    while (peek()?.type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const operator = take().value
      const right = parseUnary()
      left = operator === '*' ? left * right : left / right
    }
    return left
  }

  function parseUnary() {
    if (peek()?.type === 'op' && (peek().value === '-' || peek().value === '+')) {
      const sign = take().value
      const value = parseUnary()
      return sign === '-' ? -value : value
    }
    return parsePower()
  }

  function parsePower() {
    const base = parseAtom()
    if (peek()?.type === 'op' && peek().value === '^') {
      take()
      const exponent = parseUnary()
      return base ** exponent
    }
    return base
  }

  function parseAtom() {
    const token = take()
    if (!token) throw new Error('表达式意外结束')
    if (token.type === 'number') return Number(token.value)
    if (token.type === 'var') {
      const value = values[token.value]
      if (value === undefined) throw new Error(`表达式中变量 ${token.value} 未提供数值`)
      return value
    }
    if (token.type === 'func') {
      const argument = parseExpression()
      if (peek()?.type === 'paren' && peek().value === ')') take()
      return NUM_FUNCTIONS[token.value](argument)
    }
    if (token.type === 'paren' && token.value === '(') {
      const inner = parseExpression()
      const closing = take()
      if (!closing || closing.value !== ')') throw new Error('缺少右括号')
      return inner
    }
    throw new Error(`无法解析的记号：${token.value}`)
  }

  const result = parseExpression()
  if (position < tokens.length) throw new Error('表达式存在无法解析的尾部')
  if (!Number.isFinite(result)) throw new Error('表达式求值不是有限值')
  return result
}

function tokenizeNumeric(expression) {
  const tokens = []
  const source = String(expression)
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (/\s/u.test(char)) {
      index += 1
      continue
    }
    if (/[0-9.]/u.test(char)) {
      let value = ''
      while (index < source.length && /[0-9.]/u.test(source[index])) value += source[index++]
      tokens.push({ type: 'number', value })
      continue
    }
    if (/[A-Za-zμρΦ]/u.test(char)) {
      let value = ''
      while (index < source.length && /[A-Za-z0-9μρΦ]/u.test(source[index])) value += source[index++]
      if (source[index] === '(' && NUM_FUNCTIONS[value]) {
        index += 1
        tokens.push({ type: 'func', value })
        tokens.push({ type: 'paren', value: '(' })
        continue
      }
      tokens.push({ type: 'var', value })
      continue
    }
    if ('+-*/^()'.includes(char)) {
      tokens.push({ type: char === '(' || char === ')' ? 'paren' : 'op', value: char })
      index += 1
      continue
    }
    throw new Error(`无法识别的字符：${char}`)
  }
  return tokens
}

/** 列出公式（可按主题过滤）。 */
export function listFormulas(topic) {
  return FORMULAS
    .filter((formula) => !topic || formula.topic === topic)
    .map((formula) => ({
      id: formula.id,
      topic: formula.topic,
      topicName: TOPIC_NAMES[formula.topic],
      name: formula.name,
      formula: formula.formula,
      vars: formula.vars,
    }))
}

/** 主题清单。 */
export function listTopics() {
  return Object.entries(TOPIC_NAMES).map(([id, name]) => ({ id, name }))
}
