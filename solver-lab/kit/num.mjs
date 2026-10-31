/**
 * 数值表达内核 — 移植自几何实验室 src/domain/geometry/numericExpression.ts
 * 支持有限形式：整数/小数、分数、平方根、根式分数（如 3√5/2）。
 * 输出 canonical 规范化形式与数值近似；计算规则与主项目逐字对应。
 * 零依赖，纯 ESM。
 */

export const EXAMPLE_MESSAGE = '可输入有限数值，例如 1.25、3/2、√2 或 3√5/2。'

const NUMBER_SOURCE = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)'
const SIGNED_NUMBER = `[+-]?${NUMBER_SOURCE}`
const scalarPattern = new RegExp(`^${SIGNED_NUMBER}$`)
const rationalPattern = new RegExp(`^(${SIGNED_NUMBER})/(${SIGNED_NUMBER})$`)
const radicalPattern = new RegExp(
  `^([+-]?(?:${NUMBER_SOURCE})?)?(\\*)?(?:√(${SIGNED_NUMBER})|sqrt\\((${SIGNED_NUMBER})\\))(?:/(${SIGNED_NUMBER}))?$`,
)

/**
 * 解析题目/参数中的数值表达。
 * @param {string} source 原始输入（可含空白）
 * @returns {{ok: true, value: {source: string, canonical: string, exact: boolean, value: number}}
 *          | {ok: false, message: string}}
 */
export function parseNumericExpression(source) {
  const compact = String(source).replaceAll(/\s/gu, '')
  if (compact === '') return invalidExpression('输入不能为空。')

  if (scalarPattern.test(compact)) {
    const value = Number(compact)
    if (!isFiniteNumericComponent(compact, value)) return invalidExpression('数值必须是有限值。')
    return finiteExpression(source, canonicalScalar(compact), value)
  }

  const rational = rationalPattern.exec(compact)
  if (rational) {
    const numerator = Number(rational[1])
    const denominator = Number(rational[2])
    if (!isFiniteNumericComponent(rational[1], numerator) || !isFiniteNumericComponent(rational[2], denominator)) {
      return invalidExpression('分子和分母必须是有限值。')
    }
    if (denominator === 0) return invalidExpression('分母不能为 0。')

    const sign = denominator < 0 ? -1 : 1
    const canonical = `${canonicalScalar(rational[1], sign)}/${canonicalScalar(rational[2], sign)}`
    return finiteExpression(source, canonical, numerator / denominator)
  }

  const radical = radicalPattern.exec(compact)
  if (radical) {
    const [, coefficientSource, multiplication, squareRootSource, sqrtArgumentSource, denominatorSource] = radical
    if (multiplication && (!coefficientSource || coefficientSource === '+' || coefficientSource === '-')) {
      return invalidExpression('乘号前需要是数字系数。')
    }

    const radicandSource = squareRootSource ?? sqrtArgumentSource
    const radicand = Number(radicandSource)
    if (!isFiniteNumericComponent(radicandSource, radicand)) return invalidExpression('平方根内必须是有限值。')
    if (radicand < 0) return invalidExpression('平方根内不能为负数。')

    const coefficient = coefficientSource === undefined || coefficientSource === '' || coefficientSource === '+'
      ? 1
      : coefficientSource === '-'
        ? -1
        : Number(coefficientSource)
    const denominator = denominatorSource === undefined ? 1 : Number(denominatorSource)
    if (
      !isFiniteNumericComponent(coefficientSource || '1', coefficient)
      || (denominatorSource !== undefined && !isFiniteNumericComponent(denominatorSource, denominator))
    ) {
      return invalidExpression('根式系数和分母必须是有限值。')
    }
    if (denominator === 0) return invalidExpression('分母不能为 0。')

    const sign = denominator < 0 ? -1 : 1
    const canonicalCoefficient = canonicalRadicalCoefficient(coefficientSource, sign)
    const canonicalRadicand = canonicalScalar(radicandSource)
    const canonicalDenominator = denominatorSource === undefined ? '' : `/${canonicalScalar(denominatorSource, sign)}`
    return finiteExpression(
      source,
      `${canonicalCoefficient}√${canonicalRadicand}${canonicalDenominator}`,
      coefficient * Math.sqrt(radicand) / denominator,
    )
  }

  return invalidExpression('只支持指定的小数、分数和平方根形式。')
}

/** 解析并直接取值；失败时抛出带中文原因的 Error。 */
export function parseNumeric(source) {
  const result = parseNumericExpression(source)
  if (!result.ok) throw new RangeError(result.message)
  return result.value.value
}

function canonicalRadicalCoefficient(source, denominatorSign) {
  if (source === undefined || source === '' || source === '+') return denominatorSign < 0 ? '-' : ''
  if (source === '-') return denominatorSign < 0 ? '' : '-'

  const canonical = canonicalScalar(source, denominatorSign)
  return canonical === '1' ? '' : canonical === '-1' ? '-' : canonical
}

function canonicalScalar(source, multiplier = 1) {
  const value = Number(source) * multiplier
  const sign = value < 0 || Object.is(value, -0) ? '-' : ''
  const unsigned = String(source).replace(/^[+-]/u, '')
  const [integerSource, fractionSource] = unsigned.split('.')
  const integer = (integerSource || '0').replace(/^0+(?=\d)/u, '')
  const fraction = fractionSource?.replace(/0+$/u, '') ?? ''

  return value === 0 ? '0' : `${sign}${integer}${fraction ? `.${fraction}` : ''}`
}

function finiteExpression(source, canonical, value) {
  return Number.isFinite(value)
    ? { ok: true, value: { source, canonical, exact: true, value: Object.is(value, -0) ? 0 : value } }
    : invalidExpression('计算结果超出有限数值范围。')
}

function isFiniteNumericComponent(source, value) {
  return source !== undefined && Number.isFinite(value) && (value !== 0 || !/[1-9]/u.test(String(source)))
}

function invalidExpression(reason) {
  return { ok: false, message: `${reason}${EXAMPLE_MESSAGE}` }
}

/* ------------------------------------------------------------------ */
/* 精确数 c·√r：让“答案保留根式”成为可能，如立方体体对角线 a√3。        */
/* ------------------------------------------------------------------ */

/** @typedef {{c: number, r: number}} Exact 表示 c·√r；r=1 表示有理数。 */

/** @returns {Exact} */
export function exact(value, radicand = 1) {
  assertExactParts(value, radicand)
  return { c: value, r: radicand }
}

export function exactValue(e) {
  assertExact(e)
  return e.c * Math.sqrt(e.r)
}

export function exactAdd(a, b) {
  assertExact(a); assertExact(b)
  if (a.r !== b.r) return null // 不同被开方数不合并，调用方回退近似
  return { c: a.c + b.c, r: a.r }
}

export function exactMul(a, b) {
  assertExact(a); assertExact(b)
  return { c: a.c * b.c, r: a.r * b.r }
}

export function exactDiv(a, b) {
  assertExact(a); assertExact(b)
  if (b.c === 0) throw new RangeError('精确数除数不能为 0')
  return { c: a.c / b.c, r: a.r / b.r }
}

/** 化简根式：√12 → '2√3'；3√12 → '6√3'。 */
export function exactToString(e) {
  assertExact(e)
  if (e.c === 0) return '0'
  if (e.r === 1) return formatNumber(e.c)
  const { outside, inside } = extractSquareFactor(e.r)
  const coefficient = e.c * outside
  const sign = coefficient < 0 ? '-' : ''
  const magnitude = Math.abs(coefficient)
  const head = magnitude === 1 ? '' : formatNumber(magnitude)
  return `${sign}${head}√${inside}`
}

/** 提取最大平方因子：12 → {outside: 2, inside: 3}。 */
export function extractSquareFactor(radicand) {
  if (!Number.isInteger(radicand) || radicand < 0) {
    throw new RangeError('extractSquareFactor 需要非负整数')
  }
  if (radicand === 0) return { outside: 0, inside: 1 }
  let outside = 1
  let inside = radicand
  for (let factor = 2; factor * factor <= inside; factor += 1) {
    while (inside % (factor * factor) === 0) {
      outside *= factor
      inside /= factor * factor
    }
  }
  return { outside, inside }
}

/* ------------------------------------------------------------------ */
/* 显示格式化：近似值一律带 ≈，遵守“不把根式伪装成精确小数”的口径。      */
/* ------------------------------------------------------------------ */

/** 常规数字格式化（去掉 -0 与多余尾零）。 */
export function formatNumber(value) {
  if (!Number.isFinite(value)) return '无效数值'
  if (Object.is(value, -0)) value = 0
  return String(Number(value.toFixed(10)))
}

/** 近似显示：≈ 1.73（digits 控制小数位）。 */
export function formatApprox(value, digits = 2) {
  if (!Number.isFinite(value)) return '无效数值'
  const rounded = Number(value.toFixed(digits))
  return `≈ ${rounded}`
}

/** 按 tolerances 判断“接近临界”时调用方应披露；此处仅提供数值格式化。 */
export function formatWithUnit(value, unit, digits = 2) {
  return unit ? `${formatApprox(value, digits)} ${unit}` : formatApprox(value, digits)
}

function assertExact(e) {
  if (!e || typeof e.c !== 'number' || typeof e.r !== 'number' || !Number.isFinite(e.c) || !Number.isFinite(e.r)) {
    throw new RangeError('精确数必须是 {c, r} 且均为有限值')
  }
}

function assertExactParts(c, r) {
  if (!Number.isFinite(c) || !Number.isFinite(r) || r < 0) {
    throw new RangeError('精确数系数必须有限，被开方数必须非负')
  }
}
