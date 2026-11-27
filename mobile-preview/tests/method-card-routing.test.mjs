import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {resolveSubject, selectMethodCards} from '../src/method-cards.mjs'
import {composePrompt} from '../src/prompts.mjs'

const cards = (await Promise.all(['math', 'math-bishua-2027', 'physics'].map(async name =>
  JSON.parse(await readFile(new URL(`../vendor/solver-lab/references/study/${name}.json`, import.meta.url), 'utf8'))))).flat()

test('probability density wording retains the normal-distribution method in the generated prompt', () => {
  for (const problem of [
    '已知随机变量 X 服从正态分布，其概率密度函数关于 x=10 对称，求 P(X<10)。',
    '正态分布的密度函数为 f(x)，均值为 10，求小于均值的概率。',
  ]) {
    assert.equal(resolveSubject('auto', problem), 'probability')
    const selected = selectMethodCards(cards, {subject:'auto', problem})
    assert.ok(selected.some(card => card.id === 'bishua-2027-m12-s04'), problem)
    assert.ok(selected.every(card => card.category === 'probability' || /^math-5[4-8]$/.test(card.id)))
    const prompt = composePrompt({subject:'auto', problem, model:'generic', mode:'study', methodCards:selected})
    assert.match(prompt, /【bishua-2027-m12-s04 /)
  }
})

test('ordinary circle tangent questions select circle methods without requiring a colon', () => {
  for (const problem of [
    '求圆 x²+y²=4 在点 (0,2) 处的切线方程。',
    '求圆 C：x²+y²=4 在点 (0,2) 处的切线方程。',
    '求圆C: (x-1)^2+(y-2)^2=4 在点 (1,4) 处的切线。',
    '已知圆的切线经过点 P，求切线方程。',
  ]) {
    for (const subject of ['auto', 'geometry', 'conics']) {
      const selected = selectMethodCards(cards, {subject, problem})
      assert.equal(selected[0]?.id, 'math-49', `${subject}: ${problem}`)
      assert.ok(!selected.some(card => card.id === 'bishua-2027-m03-s01'))
      assert.ok(selected.every(card => card.id === 'math-49' || card.chapter === 9),
        `Circle supplements must also be circle methods: ${selected.map(card => card.id)}`)
      assert.ok(selected.some(card => ['bishua-2027-k36', 'bishua-2027-m09-s02'].includes(card.id)))
    }
  }
})

test('more specific probability and circle recognition preserves conic and function routing', () => {
  for (const [problem, expected] of [
    ['求椭圆 x²/4+y²=1 在点 (0,1) 处的切线。', 'math-53'],
    ['求函数 f(x)=x² 在 x=1 处的切线。', 'math-16'],
  ]) assert.equal(selectMethodCards(cards, {subject:'auto', problem})[0]?.id, expected)
  assert.equal(resolveSubject('auto', '粒子在匀强磁场中沿圆弧运动，求运动时间。'), 'circuits')
})

test('explicit subject and manual card choices still take precedence', () => {
  const problem = '正态分布的概率密度函数为 f(x)，求均值。'
  assert.equal(resolveSubject('functions', problem), 'functions')
  assert.deepEqual(selectMethodCards(cards, {subject:'auto', problem, manualId:'math-15'}).map(card => card.id), ['math-15'])
})
