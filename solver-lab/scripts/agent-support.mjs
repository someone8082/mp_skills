import { createHash } from 'node:crypto'
import { readFile, access, mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SKILL_ROOT = fileURLToPath(new URL('..', import.meta.url))
export const TOPICS = ['motion', 'circuit', 'section']
export const TASK_IDS = ['geometry.solid-metrics', 'geometry.section', 'geometry.triangle', 'geometry.circle-line', 'geometry.circle-circle', 'geometry.three-point-circle', 'geometry.conic', 'geometry.space-angle', 'physics.formula']
export const REQUIRED_FILES = ['SKILL.md', 'scripts/agent.mjs', 'scripts/agent-support.mjs', 'lesson/compile.mjs', 'lesson/validation.mjs', 'lesson/motion.mjs', 'lesson/circuit.mjs', 'lesson/section.mjs', 'kit/master-section.mjs', 'shared/geometry/analyticSection.mjs', 'shared/geometry/section.mjs', 'scripts/solve-lib.mjs', 'scripts/figure-bindings.mjs', ...TOPICS.map(topic => `examples/lesson-${topic}.html`)]

export async function installationReport() {
  const errors = []
  if (Number(process.versions.node.split('.')[0]) < 18) errors.push('运行时需要 Node.js 18 或以上')
  for (const file of REQUIRED_FILES) {
    try { await access(resolve(SKILL_ROOT, file)) } catch { errors.push(`缺少文件：${file}`) }
  }
  let manifest = null
  try { manifest = JSON.parse(await readFile(resolve(SKILL_ROOT, 'agent-manifest.json'), 'utf8')) } catch (error) {
    if (error.code !== 'ENOENT') errors.push(`安装清单不可读：${error.message}`)
  }
  if (manifest) {
    if (manifest.version !== 1 || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) errors.push('安装清单格式无效')
    else for (const [file, expected] of Object.entries(manifest.files)) {
      const fullPath = resolve(SKILL_ROOT, file)
      const local = relative(SKILL_ROOT, fullPath)
      if (isAbsolute(local) || local === '..' || local.startsWith('..' + sep)) { errors.push(`安装清单路径越界：${file}`); continue }
      try {
        const actual = createHash('sha256').update(await readFile(fullPath)).digest('hex')
        if (actual !== expected) errors.push(`文件内容已改变：${file}`)
      } catch { errors.push(`清单文件缺失：${file}`) }
    }
    for (const file of REQUIRED_FILES) if (!Object.hasOwn(manifest.files ?? {}, file)) errors.push(`安装清单缺少必需项：${file}`)
  }
  if (!errors.length) {
    try { await Promise.all([import('../lesson/compile.mjs'), import('./solve-lib.mjs')]) } catch (error) { errors.push(`数理内核无法加载：${error.message}`) }
  }
  return { ok: errors.length === 0, node: process.versions.node, skillRoot: SKILL_ROOT, manifest: manifest ? 'checked' : 'development-checkout', errors, note: '检查本地文件完整性与内核加载；不认证题意、模型或宿主预览。无需 npm install。' }
}

function semanticChecks(spec) {
  return [
    { id: 'problem-review', scope: 'statement', status: 'pending', detail: spec.problemText ? '题干已保留，提取与坐标对应关系仍需对照原题' : '未提供完整原题，无法核验题意对应关系' },
    { id: 'model-review', scope: 'model', status: 'pending', detail: '公式适用条件与建模假设需要人工核对；计算检查不证明模型选择正确' },
    ...(spec.solutionText ? [{ id: 'prose-review', scope: 'user-work', status: 'pending', detail: '用户解法原文已保留；此入口没有自动证明文字推理' }] : []),
  ]
}

export async function evaluateRequest(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('输入必须为 LessonSpec 或 ProblemSpec JSON 对象')
  if (spec.topic !== undefined && spec.task !== undefined) throw new Error('不能混用 topic 与 task 两种规格')
  if (spec.topic !== undefined) {
    const { compileLesson } = await import('../lesson/compile.mjs')
    const result = compileLesson(spec)
    return { ...result, mode: 'lesson' }
  }
  if (!TASK_IDS.includes(spec.task)) throw new Error('没有支持的 topic/task；运行 --capabilities 查看范围')
  if (spec.claims !== undefined) throw new Error('ProblemSpec 不支持 claims 自动核验，不能静默忽略；请使用支持的 LessonSpec 或保留 solutionText 并明确未核验')
  for (const key of ['problemText', 'solutionText']) if (spec[key] !== undefined && typeof spec[key] !== 'string') throw new Error(`${key} 必须是原文字符串`)
  const { solveSpec } = await import('./solve-lib.mjs')
  const result = solveSpec(spec)
  const checks = [...(result.checks ?? []).map((check, i) => ({ id: `calculation-${i}`, scope: 'mathematics', status: check.ok ? 'passed' : 'failed', detail: `${check.name}：${check.detail}` })), ...semanticChecks(spec)]
  return { ...result, mode: 'task', problemText: spec.problemText ?? '', solutionText: spec.solutionText ?? '', checks, ...(!result.ok ? { errors: [result.summary ?? result.reason ?? '计算未通过'] } : {}) }
}

export function compactReport(result, artifacts = {}) {
  const checks = result.checks ?? []
  return {
    ok: result.ok, mode: result.mode, ...(result.topic ? { topic: result.topic } : {}), ...(result.task ? { task: result.task } : {}),
    ...(result.ok ? { answer: compactAnswer(result.answer), ...(result.units ? { units: result.units } : {}) } : { errors: result.errors ?? ['计算未通过'] }),
    ...(result.summary ? { summary: result.summary } : {}),
    checks: { passed: checks.filter(c => c.status === 'passed').length, failed: checks.filter(c => c.status === 'failed'), pending: checks.filter(c => c.status === 'pending') },
    artifacts,
  }
}

function compactAnswer(value) {
  if (Array.isArray(value)) return value.length <= 10 ? value.map(compactAnswer) : { count: value.length, detail: '见 report.json' }
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !['vertices', 'samples', 'svg'].includes(key)).map(([key, item]) => [key, compactAnswer(item)]))
}

function fenced(text, language = '') {
  const longest = Math.max(2, ...[...String(text).matchAll(/`+/g)].map(match => match[0].length))
  const marker = '`'.repeat(longest + 1)
  return `${marker}${language}\n${text}\n${marker}`
}

export function solutionMarkdown(result) {
  const lines = [`# ${result.title ?? '数理解题报告'}`, '', '结论基于以下输入与模型。数值检查通过不等于题意、建模假设或文字证明全部正确。', '', '## 原题', '', fenced(result.problemText || '未提供完整题干。'), '', '## 计算结论', '', result.summary ?? fenced(JSON.stringify({ answer: compactAnswer(result.answer), units: result.units }, null, 2), 'json'), '', '## 分步讲解', '']
  for (const [i, step] of (result.steps ?? []).entries()) lines.push(`### ${i + 1}. ${step.title}`, '', fenced([step.formula, step.substitution, step.result, step.note].filter(Boolean).join('\n')), '')
  lines.push('## 核验范围', '')
  const names = { passed: '已核验', failed: '失败', pending: '待核对' }
  for (const check of result.checks ?? []) lines.push(`- ${names[check.status] ?? check.status}（${check.scope}）：${check.detail}`)
  if (result.assumptions?.length) lines.push('', '## 模型假设', '', ...result.assumptions.map(text => `- ${text}`))
  if (result.solutionText) lines.push('', '## 用户解法原文（未自动证明）', '', fenced(result.solutionText))
  return lines.join('\n') + '\n'
}

async function offlineHtml(spec) {
  const path = resolve(SKILL_ROOT, `examples/lesson-${spec.topic}.html`)
  const html = await readFile(path, 'utf8')
  const pattern = /(<script id="lesson-data" type="application\/json">)([\s\S]*?)(<\/script>)/g
  const matches = [...html.matchAll(pattern)]
  if (matches.length !== 1) throw new Error('预构建模板的数据入口无效；需要重新打包，不能由 Agent 改写内核')
  const json = JSON.stringify(spec).replace(/[<>&\u2028\u2029]/g, ch => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)
  return html.replace(pattern, (_, open, data, close) => open + json + close)
}

/** Validate and prepare every payload before touching the output directory. Never overwrite prior work. */
export async function writeArtifacts(spec, result, options) {
  if (options.html && result.mode !== 'lesson') throw new Error('--html 仅用于三个 LessonSpec 题型；旧任务使用 --svg')
  if (options.svg && (result.mode !== 'task' || !result.figure?.svg)) throw new Error('--svg 需要带受支持 figure 的 ProblemSpec')
  const { stateAt, figure, ...report } = result
  const files = {
    'input.json': JSON.stringify(spec, null, 2) + '\n',
    'report.json': JSON.stringify({ ...report, ...(figure ? { figure: { available: true } } : {}) }, null, 2) + '\n',
    'solution.md': solutionMarkdown(result),
    ...(options.html ? { 'lesson.html': await offlineHtml(spec) } : {}),
    ...(options.svg ? { 'figure.svg': result.figure.svg } : {}),
  }
  const output = resolve(options.out)
  await mkdir(dirname(output), { recursive: true })
  try { await mkdir(output) } catch (error) {
    if (error.code === 'EEXIST') throw new Error('输出目录已存在；请使用新的目录，已有文件不会被覆盖')
    throw error
  }
  const artifacts = {}
  try {
    for (const [name, contents] of Object.entries(files)) {
      const target = resolve(output, name)
      await writeFile(target, contents, { encoding: 'utf8', flag: 'wx' })
      artifacts[name] = target
    }
  } catch (error) {
    throw new Error(`产物写入未完成，目录 ${output} 可能有部分文件；请勿视为成功交付。${error.message}`)
  }
  return artifacts
}
