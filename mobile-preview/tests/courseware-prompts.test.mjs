import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {selectMethodCards} from '../src/method-cards.mjs'
import {composePrompt} from '../src/prompts.mjs'

const cards = JSON.parse(await readFile(new URL('../study/physics-courseware.json', import.meta.url), 'utf8'))

test('the 18 new cards preserve the teaching-deck source and structure', () => {
  assert.equal(cards.length, 18)
  assert.equal(new Set(cards.map(x => x.id)).size, 18)
  assert.deepEqual(cards.map(x => x.id.replace('physics-', '')), [
    '10.1','10.2','10.3','10.4','10.5','11.1','11.2','11.3','11.4',
    '12.1','12.2','12.3','12.4','13.1','13.2','14.1','14.2','14.3',
  ])
  for (const card of cards) {
    assert.match(card.source.title, /^1[0-4]．[1-5]/)
    assert.ok(card.source.slides.length >= 2 && card.source.slides.every(n => Number.isInteger(n) && n > 0))
    for (const field of ['keywords','conditions','method','pitfalls','transferChecks']) assert.ok(card[field].length, card.id)
  }
})

test('five units can route by problem wording, including paraphrased students’ questions', () => {
  const cases = [
    ['circuits','带电粒子飞进有界磁场，怎样用轨迹与边界相切找临界半径？','physics-10.3'],
    ['circuits','穿过线圈的磁通量正在增加，感应电流往哪边绕？用楞次定律判断。','physics-11.1'],
    ['circuits','先升压再远距离输电，怎么求输电线的功率损失？','physics-12.2'],
    ['optics','光从玻璃进入空气，怎样用全反射的临界角判断？','physics-13.1'],
    ['thermal','活塞封住一定质量的气体，等温压缩到一半时压强怎样变化？','physics-14.3'],
  ]
  for (const [subject, problem, id] of cases) {
    assert.equal(selectMethodCards(cards, {subject, problem})[0]?.id, id)
  }
})

test('deck cards use slide sources in both prompt modes and stay out of mechanics-only search', () => {
  const problem = '求玻璃射向空气时全反射的临界角。'
  assert.deepEqual(selectMethodCards(cards, {subject:'mechanics', problem}), [])
  const selected = selectMethodCards(cards, {subject:'optics', problem})
  for (const mode of ['study','diagram']) {
    const prompt = composePrompt({subject:'optics', model:'generic', problem, mode, methodCards:selected})
    assert.ok(prompt.includes(selected[0].method[0]))
    assert.match(prompt, /PPT 第 [\d、]+ 张/)
    assert.doesNotMatch(prompt, /PDF 第|undefined|[。！？]；/)
  }
})

test('subtopics within broader decks remain findable, while geometry alone does not imply a magnetic field', () => {
  for (const [subject, problem, id] of [
    ['optics','把第二片偏振片旋转90°，屏上亮度变化吗？','physics-13.2'],
    ['thermal','用油膜法求油酸分子直径，方格少算会怎样？','physics-14.1'],
    ['thermal','晶体和非晶体怎样用熔点区分？','physics-14.2'],
  ]) assert.equal(selectMethodCards(cards, {subject, problem})[0]?.id, id)
  assert.deepEqual(selectMethodCards(cards, {subject:'auto', problem:'一个圆的圆心和一条切线已知，求与这条直线相切的条件。'}), [])
})

test('auto keeps physical boundary problems in the applicable subject', () => {
  assert.equal(selectMethodCards(cards, {subject:'auto',problem:'电子垂直射入匀强磁场，求电子在磁场中运动的时间。'})[0]?.id, 'physics-10.2')
  assert.equal(selectMethodCards(cards, {subject:'auto',problem:'封闭气体温度不变，体积减半，压强怎样变化？'})[0]?.id, 'physics-14.3')
  assert.deepEqual(selectMethodCards(cards, {subject:'auto',problem:'平行光经过凸透镜汇聚在焦点，物距变化后求像距。'}), [])
})
