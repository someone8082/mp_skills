import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const entry = fileURLToPath(new URL('../solver-lab/scripts/study.mjs', import.meta.url))
function run(args, cwd = tmpdir()) {
  const proc = spawnSync(process.execPath, [entry, ...args], { cwd, encoding: 'utf8' })
  assert.ok(proc.stdout.trim(), `study CLI must return structured output: ${proc.stderr}`)
  return { status: proc.status, body: JSON.parse(proc.stdout) }
}

test('portable catalog covers 58 mathematics lectures and 15 mechanics topics', () => {
  const { status, body } = run(['--list'])
  assert.equal(status, 0)
  assert.equal(body.results.length, 73)
  assert.equal(body.results.filter(x => x.subject === 'math').length, 58)
  assert.equal(body.results.filter(x => x.subject === 'physics').length, 15)
  assert.equal(new Set(body.results.map(x => x.id)).size, 73)
})

test('exact card lookup carries preconditions, method, limits and verifiable source pages', () => {
  const { status, body } = run(['--id', 'math-34'])
  assert.equal(status, 0)
  assert.equal(body.card.id, 'math-34')
  assert.ok(body.card.conditions.some(x => /q\s*=\s*1/.test(x)))
  assert.ok(body.card.method.length >= 2)
  assert.ok(body.card.pitfalls.length)
  assert.ok(body.card.transferChecks.length)
  assert.equal(body.card.source.pages[0], 208)
  assert.equal(body.card.source.pages[1], 211)
  assert.equal(body.verification, 'reference-only')
})

const queries = [
  ['快车刹停前有没有追上', 'physics', ['physics-02']],
  ['货物和皮带共速以后摩擦力怎么变', 'physics', ['physics-05']],
  ['板子太短，物块会不会先掉下来', 'physics', ['physics-06']],
  ['轻杆能不能以零速过最高点', 'physics', ['physics-08']],
  ['冲量和功分别应该选什么观点', 'physics', ['physics-15']],
  ['每一段都递增，整个函数就递增吗', 'math', ['math-12', 'math-04']],
  ['已知前n项和求通项，第一项要单独算吗', 'math', ['math-30']],
  ['斜率不存在时怎样处理直线与圆锥曲线', 'math', ['math-53', 'math-46']],
  ['抽球不放回还能当作二项分布吗', 'math', ['math-58', 'math-57']],
  ['直线垂直于面内两条平行线能证明线面垂直吗', 'math', ['math-43']],
  ['最高点 速度 最小值', 'physics', ['physics-08']],
  ['一辆汽车制动到静止后，另一辆继续行驶，方程算出两个碰面时刻怎么办', 'physics', ['physics-02']],
  ['给出前n项总和，求这一列的第一个数和后面的数', 'math', ['math-30']],
]
for (const [query, subject, expected] of queries) {
  test(`routes a reworded question: ${query}`, () => {
    const { status, body } = run(['--query', query, '--subject', subject])
    assert.equal(status, 0)
    assert.ok(body.results.length <= 3)
    assert.ok(body.results.some(x => expected.includes(x.id)), JSON.stringify(body))
    assert.ok(body.results.every(x => x.subject === subject && x.matched.length))
    assert.equal(body.verification, 'reference-only')
  })
}

test('unrelated query has no forced closest match', () => {
  const { body } = run(['--query', '数据库索引和咖啡烘焙'])
  assert.deepEqual(body.results, [])
  assert.equal(body.matched, false)
})

test('multi-topic lookup keeps both mechanics models discoverable and is deterministic', () => {
  const args = ['--query', '传送带与滑块木板摩擦生热的相对位移', '--subject', 'physics', '--limit', '5']
  const first = run(args).body
  assert.deepEqual(run(args).body, first)
  assert.ok(first.results.some(x => x.id === 'physics-05'))
  assert.ok(first.results.some(x => x.id === 'physics-06'))
})

test('catalog and detailed cards have a one-to-one mapping, local paths are absent', () => {
  const { body } = run(['--list'])
  for (const topic of body.results) {
    const { status, body: detail } = run(['--id', topic.id])
    assert.equal(status, 0)
    const card = detail.card
    assert.equal(card.title, topic.title)
    for (const key of ['method', 'conditions', 'pitfalls', 'transferChecks']) {
      assert.ok(Array.isArray(card[key]) && card[key].length, `${topic.id}: ${key}`)
    }
    assert.ok(card.source.pages[0] >= 1 && card.source.pages[1] >= card.source.pages[0])
    assert.match(card.source.sha256, /^[a-f0-9]{64}$/)
    assert.ok(!/[A-Z]:[\\/]/i.test(JSON.stringify(card.source)))
  }
})

for (const args of [[], ['--query', ''], ['--id', '../../README.md'], ['--id', 'math-99'],
  ['--query', '力学', '--subject', 'history'], ['--list', '--limit', '0'],
  ['--list', '--query', '圆'], ['--query', '圆', '--limit', 'NaN'], ['--oops'], ['--list', '--list']]) {
  test(`rejects malformed request: ${JSON.stringify(args)}`, () => {
    const { status, body } = run(args)
    assert.notEqual(status, 0)
    assert.equal(body.ok, false)
    assert.ok(body.errors.length)
  })
}

test('source references contain synthesis and book-to-skill evaluation boundaries', () => {
  const guide = readFileSync(new URL('../solver-lab/references/study-guide.md', import.meta.url), 'utf8')
  assert.ok(guide.includes('book-to-skill'))
  const { body } = run(['--id', 'physics-07'])
  assert.ok(body.card.pitfalls.some(x => x.includes('夹角')))
})
