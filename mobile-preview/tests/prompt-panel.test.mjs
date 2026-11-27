import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {JSDOM} from 'jsdom'
import {mountPromptPanel} from '../src/prompt-panel.mjs'

test('changing the topic updates the example questions without replacing the draft', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8')
  const {window} = new JSDOM(html, {url:'https://example.test/?mode=study'})
  try {
    const doc = window.document
    mountPromptPanel({doc})
    const subject = doc.getElementById('prompt-subject')
    const problem = doc.getElementById('prompt-problem')
    const visibleExamples = () => [...doc.querySelectorAll('#prompt-trials button:not([hidden])')]
    const chooseTopic = value => {
      subject.value = value
      subject.dispatchEvent(new window.Event('change', {bubbles:true}))
    }

    problem.value = '我自己输入的题目'
    chooseTopic('basics')
    assert.deepEqual(visibleExamples().map(button => button.textContent), ['集合与充分条件'])
    chooseTopic('mechanics')
    assert.deepEqual(visibleExamples().map(button => button.textContent), ['传送带共速', '匀变速入门', '竖直上抛'])
    for (const option of subject.options) {
      chooseTopic(option.value)
      assert.ok(visibleExamples().length > 0, `Missing examples for ${option.textContent}`)
    }
    assert.equal(problem.value, '我自己输入的题目')

    chooseTopic('auto')
    const ellipse = visibleExamples().find(button => button.textContent === '椭圆双弦')
    assert.ok(ellipse)
    ellipse.click()
    assert.equal(subject.value, 'conics')
    assert.match(problem.value, /椭圆 E/)
    assert.deepEqual(visibleExamples(), [ellipse])
  } finally {
    window.close()
  }
})

test('method cards are recommended before generation and follow the current question', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8')
  const {window} = new JSDOM(html, {url:'https://example.test/?mode=study'})
  try {
    const doc = window.document
    const cards = JSON.parse(await readFile(new URL('../vendor/solver-lab/references/study/math.json', import.meta.url), 'utf8'))
    let charges = 0
    mountPromptPanel({doc, methodCards:cards,
      authorizeUse:async () => { charges++ }})
    const subject = doc.getElementById('prompt-subject')
    const problem = doc.getElementById('prompt-problem')
    const change = value => {
      subject.value = value
      subject.dispatchEvent(new window.Event('change'))
    }
    const flush = () => new Promise(resolve => setImmediate(resolve))

    change('basics')
    change('functions')
    const recommendation = doc.getElementById('method-recommendations')
    assert.match(recommendation.textContent, /题型参考.*函数/)
    assert.doesNotMatch(recommendation.textContent, /集合/)

    doc.querySelector('#prompt-trials button[data-trial="piecewise"]').click()
    await flush()
    assert.match(recommendation.textContent, /按题目推荐.*分段函数/)
    assert.equal(charges, 0)
    assert.equal(doc.getElementById('prompt-result').hidden, true)

    doc.getElementById('prompt-form').dispatchEvent(new window.Event('submit', {cancelable:true}))
    await flush()
    assert.match(doc.getElementById('prompt-methods-used').textContent, /分段函数/)
    assert.equal(charges, 1)

    problem.value = '未给出具体条件。'
    problem.dispatchEvent(new window.Event('input'))
    await flush()
    assert.match(recommendation.textContent, /题型参考/)
    assert.doesNotMatch(recommendation.textContent, /按题目推荐/)
  } finally {
    window.close()
  }
})

test('the manual picker and its selected card work without a card request', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8')
  const cards = JSON.parse(await readFile(new URL('../vendor/solver-lab/references/study/math.json', import.meta.url), 'utf8'))
  const {window} = new JSDOM(html, {url:'https://example.test/?mode=study'})
  try {
    const doc = window.document
    window.fetch = async () => { throw Error('Network unavailable') }
    mountPromptPanel({doc, methodCards:cards})
    doc.querySelector('[data-trial="sets"]').click()
    assert.match(doc.getElementById('method-recommendations').textContent, /按题目推荐.*集合结论/)
    assert.doesNotMatch(doc.getElementById('method-recommendations').textContent, /暂无匹配|复数/)
    doc.getElementById('method-picker').open = true
    const method = doc.getElementById('prompt-method')
    assert.equal(method.disabled, false)
    assert.ok(method.querySelector('option[value="math-01"]'))
    method.value = 'math-01'
    method.dispatchEvent(new window.Event('change'))
    assert.match(doc.getElementById('method-recommendations').textContent, /已手选.*集合结论/)
    doc.getElementById('prompt-form').dispatchEvent(new window.Event('submit', {cancelable:true}))
    await new Promise(resolve => setImmediate(resolve))
    assert.match(doc.getElementById('prompt-output').value, /【math-01 集合结论】/)
    assert.equal(doc.getElementById('prompt-result').hidden, false)
  } finally {
    window.close()
  }
})
