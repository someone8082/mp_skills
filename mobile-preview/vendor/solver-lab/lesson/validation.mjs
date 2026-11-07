import { convertQuantity } from '../kit/physics.mjs'

export const near = (a, b, computationScale = 0) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b), Math.abs(computationScale), Number.MIN_VALUE)
export const check = (id, scope, status, detail) => ({ id, scope, status, detail })
export const fmt = value => Number.isInteger(value) ? String(value) : Number(value.toPrecision(7)).toString()
export function quantity(raw, unit, name) {
  if (!raw || typeof raw !== 'object' || typeof raw.value !== 'number' || !Number.isFinite(raw.value)) throw new Error(`${name} 必须包含有限数值 value`)
  if (typeof raw.unit !== 'string' || !raw.unit.trim()) throw new Error(`${name} 必须显式提供单位 unit（应为 ${unit}）`)
  const converted = convertQuantity(raw.value, raw.unit, unit)
  if (!converted.ok || !Number.isFinite(converted.value)) throw new Error(`${name} 单位不匹配或数值越界：${raw.unit} → ${unit}`)
  return converted.value
}

function validateBase(spec, topic) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('LessonSpec 必须是对象')
  if (spec.version !== 1) throw new Error('LessonSpec.version 必须为 1')
  if (spec.topic !== topic) throw new Error(`本模板只支持 ${topic}`)
  if (spec.construction !== undefined && topic !== 'section') throw new Error('construction作图规格仅用于section题型')
  if (typeof spec.problemText !== 'string' || spec.problemText.length > 12000) throw new Error('problemText 必须为不超过 12000 字的题干；仅有解法时填空字符串')
  if (!spec.givens || typeof spec.givens !== 'object' || Array.isArray(spec.givens)) throw new Error('缺少 givens 对象')
  if (spec.claims !== undefined && (!Array.isArray(spec.claims) || spec.claims.length > 100)) throw new Error('claims 必须为最多 100 条的数组')
  if (spec.solutionText !== undefined && typeof spec.solutionText !== 'string') throw new Error('solutionText 必须是待审查文本')
  if (spec.assumptions !== undefined && (!Array.isArray(spec.assumptions) || spec.assumptions.some(x => typeof x !== 'string'))) throw new Error('assumptions 必须为字符串数组')
  if (spec.title !== undefined && typeof spec.title !== 'string') throw new Error('title 必须为字符串')
}

function sourceRecords(spec) {
  const records = []
  for (const [id, input] of Object.entries(spec.givens)) {
    const entries = Array.isArray(input) ? input.map((v, i) => [`${id}.${i}`, v]) : [[id, input]]
    for (const [key, value] of entries) {
      const text = value && typeof value === 'object' ? value.source : undefined
      if (text !== undefined && (typeof text !== 'string' || !text || !spec.problemText.includes(text))) throw new Error(`${key}.source 必须是题干中真实存在的原文片段`)
      records.push({ id: key, text: text ?? '未提供题干定位，需人工对照', located: text !== undefined })
    }
  }
  return records
}

function claimChecks(spec, result) {
  return (spec.claims ?? []).map((claim, i) => {
    if (!claim || typeof claim.quantity !== 'string') throw new Error(`claims.${i} 缺少 quantity`)
    const keys = claim.quantity.split('.')
    let expected = result.answer
    for (const key of keys) expected = expected != null && Object.hasOwn(expected, key) ? expected[key] : undefined
    const unit = result.units[claim.quantity] ?? result.units[keys[0]]
    if (typeof expected !== 'number' || typeof unit !== 'string') throw new Error(`无法核验用户结论：${claim.quantity}`)
    const actual = quantity(claim, unit, `claims.${i}`)
    return check(`claim-${i}`, 'user-work', near(actual, expected, result.comparisonScales?.[claim.quantity]) ? 'passed' : 'failed', `${claim.quantity}：用户 ${fmt(actual)} ${unit}；模型重算 ${fmt(expected)} ${unit}`)
  })
}

function allFinite(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(allFinite)
  if (value && typeof value === 'object') return Object.values(value).every(allFinite)
  return true
}

function freezeDeep(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child)
    Object.freeze(value)
  }
  return value
}

function copyData(value, ancestors = new Set()) {
  if (value === null || typeof value !== 'object') {
    if (['function', 'symbol', 'bigint'].includes(typeof value)) throw new Error('LessonSpec 只能包含 JSON 数据')
    return value
  }
  if (ancestors.has(value)) throw new Error('LessonSpec 不能包含循环引用')
  ancestors.add(value)
  const copy = Array.isArray(value) ? value.map(item => copyData(item, ancestors)) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyData(item, ancestors)]))
  ancestors.delete(value)
  return copy
}

/** A passed calculation is conditional on the extracted problem and model, never a proof of either. */
export function compileWith(spec, topic, build) {
  let checks = []
  try {
    spec = copyData(spec)
    validateBase(spec, topic)
    const sources = sourceRecords(spec)
    const result = build(spec)
    if (!allFinite(result.answer)) throw new Error('计算结果超出有限数值范围')
    checks = [
      check('input', 'input', 'passed', '输入结构、有限数值与单位已经程序检查'),
      check('problem-review', 'statement', 'pending', spec.problemText ? '需对照原题确认提取完整、目标正确；原文定位不证明题意理解正确' : '未提供题干，无法核验是否符合原题'),
      check('model-review', 'model', 'pending', result.assumptions.join('；')),
      ...result.checks,
      ...claimChecks(spec, result),
    ]
    if (spec.solutionText) checks.push(check('prose-review', 'user-work', 'pending', '用户解法原文已保留；仅核验 claims 中可计算的结论，未自动证明任意文字推理'))
    const errors = checks.filter(c => c.status === 'failed').map(c => c.detail)
    if (errors.length) return { ok: false, topic, errors, checks }
    return freezeDeep({ ...result, ok: true, version: 1, topic, title: spec.title ?? result.title, problemText: spec.problemText, solutionText: spec.solutionText ?? '', sources, checks, assumptions: [...result.assumptions, ...(spec.assumptions ?? [])] })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, topic, errors: [message], checks: [...checks, check('validation', 'input', 'failed', message)] }
  }
}

export function assertFields(givens, fields) {
  for (const key of Object.keys(givens)) if (!fields.includes(key)) throw new Error(`未知已知量 ${key}；支持 ${fields.join('、')}，不得静默忽略条件`)
}
