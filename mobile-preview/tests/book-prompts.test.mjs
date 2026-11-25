import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {selectMethodCards} from '../src/method-cards.mjs'
import {composePrompt} from '../src/prompts.mjs'

const groups = await Promise.all(['math', 'physics'].map(async subject =>
  JSON.parse(await readFile(new URL(`../vendor/solver-lab/references/study/${subject}.json`, import.meta.url), 'utf8'))))
const cards = groups.flat()
const bishua = JSON.parse(await readFile(new URL('../vendor/solver-lab/references/study/math-bishua-2027.json', import.meta.url), 'utf8'))

test('the web card source covers both supplied books, with complete methods and page ranges', () => {
  assert.deepEqual(groups.map(group => group.length), [58, 15])
  assert.equal(new Set(cards.map(card => card.id)).size, 73)
  for (const card of cards) {
    for (const field of ['conditions', 'method', 'pitfalls', 'transferChecks']) assert.ok(card[field].length, card.id)
    const [start, end] = card.source.pages
    assert.ok(start > 0 && start <= end, card.id)
  }
})

test('paraphrased math and mechanics questions retrieve the applicable card', () => {
  assert.equal(selectMethodCards(cards, {subject:'functions', problem:'每一段都递增，整个函数就一定递增吗？'})[0]?.id, 'math-12')
  assert.equal(selectMethodCards(cards, {subject:'mechanics', problem:'斜皮带上的货物和皮带共速以后，摩擦力怎么变？'})[0]?.id, 'physics-05')
  assert.equal(selectMethodCards(cards, {subject:'mechanics', problem:'快车刹停之前有没有追上慢车？'})[0]?.id, 'physics-02')
})

test('analytic geometry distinguishes conic chords, ordinary circle tangents and conic definitions', () => {
  for (const subject of ['auto','geometry','conics']) {
    for (const [problem, expected] of [
      ['直线 y=kx+1 与椭圆 x²/4+y²=1 交于 A、B，求弦 AB 中点的轨迹方程。', 'math-53'],
      ['抛物线 Γ:y²=4x 上的 A、B 两点处切线垂直，判断直径圆与抛物线的交点数。', 'math-53'],
      ['直线 y=x+b 与圆 x²+y²=4 相切，求 b 的取值。', 'math-49'],
      ['已知双曲线 x²/9-y²/a²=1，求离心率。', 'math-51'],
      ['设曲线 C：x²/4+y²=1，动直线 l 与 C 交于 A、B，求两交点距离。', 'math-53'],
    ]) assert.equal(selectMethodCards(cards, {subject, problem})[0]?.id, expected)
  }
  assert.equal(selectMethodCards(cards, {subject:'geometry',problem:'正方体上给出两个中点，求指定平面的截面。'})[0]?.id, 'math-41')
  assert.ok(selectMethodCards(cards, {subject:'auto',problem:'讨论函数 f(x) 的定义域。'}).every(card => card.subject === 'math'))
  assert.equal(selectMethodCards(cards, {subject:'auto',problem:'已知抛物线 y=x²-4x+3，求顶点坐标和对称轴。'})[0]?.id, 'math-08')
})

test('uncovered topics and generic highest-point wording do not attach a misleading card', () => {
  assert.deepEqual(selectMethodCards(cards, {subject:'optics', problem:'求入射光与斜面法线的夹角。'}), [])
  assert.deepEqual(selectMethodCards(cards, {subject:'mechanics', problem:'小球竖直上抛，求最高点和到地时的速度。'}), [])
})

test('an explicit chapter overrides keyword routing and emits its full method in a text-only prompt', () => {
  const chosen = selectMethodCards(cards, {subject:'auto', problem:'请看我附的题图。', manualId:'math-30'})
  assert.deepEqual(chosen.map(x => x.id), ['math-30'])
  const prompt = composePrompt({subject:'auto', model:'deepseek', problem:'请看我附的题图。', mode:'study', methodCards:chosen})
  assert.match(prompt, /前提/)
  assert.ok(prompt.includes(chosen[0].method[0]))
  assert.ok(prompt.includes(chosen[0].pitfalls[0]))
  assert.ok(prompt.includes(chosen[0].transferChecks[0]))
  assert.match(prompt, /PDF 第 180–186 页/)
  assert.match(prompt, /不要声称.*原书/)
  assert.doesNotMatch(prompt, /LessonSpec|单文件 HTML/)
})

test('a graph prompt carries the same actual method, while an unmatched prompt carries no source claim', () => {
  const selected = selectMethodCards(cards, {subject:'mechanics', problem:'斜传送带上的滑块，与皮带共速后怎样运动？'})
  const prompt = composePrompt({subject:'mechanics', model:'qwen', problem:'斜传送带上的滑块，与皮带共速后怎样运动？', methodCards:selected})
  assert.ok(prompt.includes(selected[0].conditions[0]))
  assert.match(prompt, /单文件 HTML/)
  const unmatched = composePrompt({subject:'thermal', model:'generic', problem:'等温过程压强如何变化？', mode:'study'})
  assert.match(unmatched, /没有附教材方法卡/)
  assert.doesNotMatch(unmatched, /PDF 第/)
})

test('new-book non-graph methods can be selected, cited, and sent as text-only prompts', () => {
  const library = [...cards, ...bishua]
  const problem = '根据这个列联表做独立性检验，用卡方统计量描述结论。'
  const selected = selectMethodCards(library, {subject:'probability', problem})
  assert.equal(selected[0]?.id, 'bishua-2027-m12-s06')
  const prompt = composePrompt({subject:'probability', model:'generic', problem, mode:'study', methodCards:selected})
  assert.match(prompt, /必刷题.*主书.*PDF 第 177–178 页.*书内第 163–164 页/)
  assert.match(prompt, /对应资料.*答案及详细解析/)
  assert.doesNotMatch(prompt, /LessonSpec|单文件 HTML/)
  const conic = selectMethodCards(library, {subject:'conics', problem:'椭圆与直线相交，求弦长及弦中点。'})
  assert.equal(conic[0]?.id, 'math-53')
  assert.equal(conic[1]?.collection, 'bishua-2027')
})
