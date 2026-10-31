#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { compactReport, evaluateRequest, installationReport, SKILL_ROOT, TASK_IDS, TOPICS, writeArtifacts } from './agent-support.mjs'

const usage = `solver-lab Agent CLI\nnode <skill-root>/scripts/agent.mjs <input.json|-> [--out <new-directory>] [--html|--svg]\nnode <skill-root>/scripts/agent.mjs --capabilities\nnode <skill-root>/scripts/agent.mjs --doctor\n\n输入为现有 LessonSpec 或 ProblemSpec。默认仅返回紧凑 JSON；--out 写入 input.json、report.json、solution.md。\n--html 使用预构建课件模板，无构建依赖；--svg 保存旧任务的 figure。失败退出1，不生成成功产物。\n需要 Node.js 18+，路径相对当前工作目录；skill 资源相对脚本定位。`

async function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) { console.log(usage); return }
  if (args.length === 1 && args[0] === '--capabilities') {
    console.log(JSON.stringify({ version: 1, skillRoot: SKILL_ROOT, runtime: 'Node.js >=18; no npm dependencies', lessonTopics: TOPICS, tasks: TASK_IDS, inputs: ['LessonSpec v1', 'ProblemSpec'], outputs: ['stdout compact JSON', 'report.json', 'input.json', 'solution.md', 'lesson.html (--html)', 'figure.svg (--svg)'], limitations: ['自然语言由 Agent 转为结构化规格', '题意与模型保持待核对', '文字证明不自动认证', '不自动修改用户错误结论'] }))
    return
  }
  if (args.length === 1 && args[0] === '--doctor') {
    const report = await installationReport()
    console.log(JSON.stringify(report))
    if (!report.ok) process.exitCode = 1
    return
  }
  const options = { html: false, svg: false }
  let source = null
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--out') {
      if (options.out || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('--out 需要唯一的新输出目录')
      options.out = args[++i]
    } else if (arg === '--html' || arg === '--svg') options[arg.slice(2)] = true
    else if (arg.startsWith('--') || source !== null) throw new Error(`未知或多余参数：${arg}`)
    else source = arg
  }
  if (!source) throw new Error(usage)
  if ((options.html || options.svg) && !options.out) throw new Error('--html/--svg 需要 --out 指定新输出目录')
  const installation = await installationReport()
  if (!installation.ok) throw new Error(`skill 安装不完整：${installation.errors.join('；')}`)
  let json = ''
  if (source === '-') {
    process.stdin.setEncoding('utf8')
    for await (const chunk of process.stdin) json += chunk
  } else json = await readFile(source, 'utf8')
  const spec = JSON.parse(json)
  const result = await evaluateRequest(spec)
  const artifacts = result.ok && options.out ? await writeArtifacts(spec, result, options) : {}
  console.log(JSON.stringify(compactReport(result, artifacts)))
  if (!result.ok) process.exitCode = 1
}

try { await main(process.argv.slice(2)) } catch (error) {
  console.log(JSON.stringify({ ok: false, errors: [error instanceof Error ? error.message : String(error)], artifacts: {} }))
  process.exitCode = 1
}
