import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {selectMethodCards} from '../src/method-cards.mjs'
import {trials, composePrompt} from '../src/prompts.mjs'

const cards = JSON.parse(await readFile(new URL('../vendor/solver-lab/references/study/math.json', import.meta.url), 'utf8'))

test('set operations match the same card in textbook words, symbols and LaTeX', () => {
  for (const subject of ['basics', 'auto']) {
    for (const problem of [
      trials.sets[2],
      'A={1,2},B={2,3}，求 A∩B。',
      'A={1,2},B={2,3}，求 A∪B。',
      'A={1,2},B={2,3}，求 A 与 B 的交集。',
      String.raw`A=\{x\in\mathbb R\mid x>2\}, B=\{x\in\mathbb R\mid x\ge 1\}，求 A\cap B。`,
      String.raw`A=\{1,2\}, B=\{2,3\}，求 A\cup B。`,
      '判断 A⊆B 是否成立。',
      String.raw`判断 A\subseteq B 是否成立。`,
    ]) {
      const selected = selectMethodCards(cards, {subject, problem})
      assert.equal(selected[0]?.id, 'math-01', problem)
      assert.ok(!selected.some(card => card.id === 'math-02'))
      assert.match(composePrompt({subject, problem, model:'generic', mode:'study', methodCards:selected}), /【math-01 集合结论】/)
    }
  }
})

test('a domain symbol or sufficient-condition wording alone does not imply a set operation', () => {
  for (const problem of [
    'x∈ℝ，计算 x+1。',
    String.raw`x\in\mathbb R，计算 x+1。`,
    '物体静止是合力为零的充分条件还是必要条件？',
    '判断四边形为矩形的充分条件。',
    String.raw`解释 \caption 与 \cupboard。`,
  ]) assert.ok(!selectMethodCards(cards, {subject:'auto', problem}).some(card => card.id === 'math-01'), problem)
})
