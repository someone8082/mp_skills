import {composePrompt, exampleNames, models, subjects, trials} from './prompts.mjs'
import {selectMethodCards} from './method-cards.mjs'

export async function copyText(doc, field, message, text) {
  try {
    await doc.defaultView.navigator.clipboard.writeText(text)
    message.textContent = '已复制，可粘贴到 AI 对话。'
  } catch {
    field.hidden = false
    field.value = text
    field.focus()
    field.select()
    message.textContent = '请长按文本，选择全选并复制。'
  }
}

export function mountPromptPanel({doc, loadExample, loadMethodCards}) {
  const $ = id => doc.getElementById(id)
  const subject = $('prompt-subject')
  const model = $('prompt-model')
  const mode = $('prompt-mode')
  const method = $('prompt-method')
  const methodPicker = $('method-picker')
  const problem = $('prompt-problem')
  const output = $('prompt-output')
  const result = $('prompt-result')
  const message = $('prompt-message')
  const generate = $('generate-prompt')
  let revision = 0
  let cardsRequest

  function getCards() {
    cardsRequest ??= loadMethodCards().then(cards => {
      const groups = [
        ...Array.from({length:12}, (_, index) => [`高考必刷题 · 第 ${index + 1} 章`,
          cards.filter(card => card.collection === 'bishua-2027' && card.chapter === index + 1)]),
        ['数学讲义', cards.filter(card => card.subject === 'math' && !card.collection)],
        ['力学专题', cards.filter(card => card.subject === 'physics' && !card.category)],
        ...['磁场', '电磁感应', '交变电流与传感器', '光学', '热学'].map((label, index) =>
          [label, cards.filter(card => card.id.startsWith(`physics-${10 + index}.`))]),
      ]
      for (const [label, entries] of groups) {
        if (!entries.length) continue
        const group = doc.createElement('optgroup')
        group.label = label
        for (const card of entries) {
          const option = doc.createElement('option')
          option.value = card.id
          option.textContent = `${card.id} ${card.title}`
          group.append(option)
        }
        method.append(group)
      }
      method.disabled = false
      $('method-load-status').textContent = ''
      return cards
    }).catch(error => {
      cardsRequest = null
      $('method-load-status').textContent = '教材方法暂未加载。可关闭后再展开重试。'
      throw error
    })
    return cardsRequest
  }

  methodPicker.addEventListener('toggle', () => {
    if (methodPicker.open) getCards().catch(() => {})
  })

  for (const [select, choices] of [[subject, subjects], [model, models]]) {
    for (const [value, [label]] of Object.entries(choices)) {
      const option = doc.createElement('option')
      option.value = value
      option.textContent = label
      select.append(option)
    }
  }

  function selectPanel(compose) {
    $('prompt-panel').hidden = !compose
    $('preview-input').hidden = compose
    $('show-compose').setAttribute('aria-pressed', String(compose))
    $('show-preview-input').setAttribute('aria-pressed', String(!compose))
  }

  function resetOutput() {
    revision++
    generate.disabled = false
    result.hidden = true
    output.value = ''
    message.textContent = ''
  }

  $('show-compose').addEventListener('click', () => selectPanel(true))
  $('show-preview-input').addEventListener('click', () => selectPanel(false))
  $('go-to-paste').addEventListener('click', () => {
    selectPanel(false)
    $('show-preview-input').focus()
  })
  for (const field of [subject, model, mode, method, problem]) field.addEventListener('input', resetOutput)
  for (const [value, [label, category, text]] of Object.entries(trials)) {
    const button = doc.createElement('button')
    button.type = 'button'
    button.className = 'subtle'
    button.textContent = label
    button.dataset.trial = value
    button.addEventListener('click', () => {
      subject.value = category
      problem.value = text
      method.value = ''
      resetOutput()
      message.textContent = '已填入试用题。选择 AI 后可生成提示词。'
    })
    $('prompt-trials').append(button)
  }

  $('prompt-form').addEventListener('submit', async event => {
    event.preventDefault()
    resetOutput()
    if (!problem.value.trim()) {
      message.textContent = '请先输入题目，或选一道试用题。'
      return
    }
    const ticket = revision
    const selections = {subject:subject.value, model:model.value, mode:mode.value, problem:problem.value, manualId:method.value}
    generate.disabled = true
    problem.blur()
    try {
      const examples = selections.mode === 'diagram' ? exampleNames(selections.subject, selections.problem) : []
      const [cards, loaded] = await Promise.all([getCards(), Promise.all(examples.map(async name => [name, await loadExample(name)]))])
      if (ticket !== revision) return
      const methodCards = selectMethodCards(cards, selections)
      output.value = composePrompt({...selections, methodCards, examples:Object.fromEntries(loaded)})
      $('prompt-methods-used').textContent = methodCards.length
        ? `已附方法卡：${methodCards.map(card => card.title).join('、')}。请让 AI 核对适用前提。`
        : '本题未匹配教材方法卡。可手选专题，或使用此独立解题提示词。'
      result.hidden = false
      $('go-to-paste').hidden = selections.mode === 'study'
      message.textContent = selections.mode === 'study' ? '提示词已生成。复制到网页版 AI 的对话框。' : '提示词已生成。复制到 AI，拿到代码后回本页运行。'
      $('copy-prompt').focus()
    } catch {
      if (ticket === revision) message.textContent = '教材方法或课件范例暂时无法加载，请检查网络后重新生成。'
    } finally {
      if (ticket === revision) generate.disabled = false
    }
  })
  $('copy-prompt').addEventListener('click', () => copyText(doc, output, message, output.value))
  if (new URL(doc.defaultView.location.href).searchParams.get('mode') === 'study') selectPanel(true)
}
