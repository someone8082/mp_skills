#!/usr/bin/env node
/**
 * solver-lab CLI — 题目 spec（JSON）→ 分步解答（JSON）+ 可选 SVG 图。
 *
 * 用法：
 *   node scripts/solve.mjs spec.json                 # 从文件读 spec
 *   cat spec.json | node scripts/solve.mjs -         # 从 stdin 读 spec
 *   node scripts/solve.mjs spec.json --figure out.svg
 *   node scripts/solve.mjs --list-tasks
 *
 * 输入（ProblemSpec）：
 *   { "domain": "geometry"|"physics", "task": "<任务id>", "givens": {...},
 *     "figure": { "kind": "<图类型>" } | null }
 * 输出（Solution）：
 *   { ok, domain, task, summary, steps[], answer, checks[], figure? }
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { solveSpec, TASKS } from './solve-lib.mjs'

function readSpec(argv) {
  const figureIndex = argv.indexOf('--figure')
  const figurePath = figureIndex >= 0 ? argv[figureIndex + 1] : null
  if (figureIndex >= 0 && (!figurePath || figurePath.startsWith('--'))) throw new Error('--figure 需要输出文件路径')
  const args = argv.filter((a, i) => !a.startsWith('--') && !(figureIndex >= 0 && i === figureIndex + 1))
  if (argv.includes('--list-tasks')) return { listTasks: true, figurePath }
  const source = args[0]
  if (!source || source === '-') {
    return { spec: JSON.parse(readFileSync(0, 'utf8')), figurePath }
  }
  return { spec: JSON.parse(readFileSync(source, 'utf8')), figurePath }
}

function main() {
  const { spec, figurePath, listTasks: shouldList } = readSpec(process.argv.slice(2))
  if (shouldList) {
    console.log(JSON.stringify(Object.keys(TASKS), null, 2))
    return
  }
  const solution = solveSpec(spec)
  if (solution.ok && solution.figure && figurePath) {
    writeFileSync(figurePath, solution.figure.svg, 'utf8')
    solution.figure.written = figurePath
  }
  console.log(JSON.stringify(solution, null, 2))
  if (!solution.ok) process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.log(JSON.stringify({ ok: false, summary: error instanceof Error ? error.message : String(error) }))
  process.exitCode = 1
}
