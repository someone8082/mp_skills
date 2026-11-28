import { readFile, writeFile } from 'node:fs/promises'
import { solveSpec } from './solve-lib.mjs'

const physics = (id, target, quantities) => ({
  domain: 'physics',
  task: 'physics.formula',
  givens: {
    id, target,
    knowns: Object.fromEntries(Object.entries(quantities).map(([key, [value, unit]]) => [key, { value, unit }])),
  },
})
const section = (solid, plane) => ({ domain: 'geometry', task: 'geometry.section', givens: { solid, plane } })
const lens = u => physics('optics.lens', 'v', { u: [u, 'cm'], f: [10, 'cm'] })
const examples = [
  ['solid-section', section({ kind: 'box', a: 2, b: 2, c: 2 }, { points: [[2,1,0], [2,0,1], [1,0,2]] }),
    { kind: 'section', title: '正方体的斜截面' }],
  ['kinematics-incline', physics('kinematics.displacement', 's', { v0: [0, 'm/s'], a: [5, 'm/s²'], t: [1.6, 's'] }),
    { kind: 'incline', title: '斜面滑块：位移', namedForces: ['G', 'N'], blockLabel: 'm' }],
  ['optics-lens', lens(30), { kind: 'optics', title: '凸透镜成像' }],
  ['circuit-series', physics('em.series', 'R', { R1: [10, 'Ω'], R2: [20, 'Ω'] }),
    { kind: 'circuit', title: '串联电路' }],
  ['anim-incline', physics('kinematics.velocity', 'v', { v0: [0, 'm/s'], a: [5, 'm/s²'], t: [2, 's'] }),
    { kind: 'motion', mode: 'incline', length: 12, vMax: 12, title: '斜面匀加速下滑' }],
  ['anim-freefall', physics('kinematics.free-fall', 'v', { g: [9.8, 'm/s²'], t: [2, 's'] }),
    { kind: 'motion', mode: 'freefall', dropHeight: 19.6, vMax: 22, title: '自由落体' }],
  ['anim-circuit-flow', physics('em.ohm', 'I', { U: [12, 'V'], R: [30, 'Ω'] }),
    { kind: 'circuit-flow', resistors: [10, 20], title: '串联电路：电流流动', hint: '红点表示约定电流方向' }],
  ['anim-optics-rays', lens(15), { kind: 'optics-anim', title: '凸透镜成像：光路绘制' }],
  ['anim-section-sweep', section({ kind: 'cylinder', radius: 2, height: 5 }, { point: [0,0,1.5], normal: [1,0,2] }),
    { kind: 'section', sweep: true, title: '圆柱斜截面：扫掠形成' }],
  ['anim-compass', { domain: 'geometry', task: 'geometry.three-point-circle', givens: { points: [[0,0], [6,0], [0,8]] } },
    { kind: 'plane-triangle', compass: true }],
]

const check = process.argv.includes('--check')
for (const [i, [name, spec, figure]] of examples.entries()) {
  const result = solveSpec({ ...spec, figure: { fig: i + 1, ...figure } })
  if (!result.ok || !result.figure?.svg) throw new Error(`${name}: ${result.summary}`)
  const path = new URL(`../examples/${name}.svg`, import.meta.url)
  const svg = result.figure.svg + '\n'
  if (check) {
    if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== svg) {
      throw new Error(`${name}.svg 与生成结果不同，请运行 node solver-lab/scripts/demo.mjs`)
    }
  } else {
    await writeFile(path, svg, 'utf8')
  }
}
console.log(`${check ? '已核对' : '已生成'} ${examples.length} 张 SVG 示例`)
