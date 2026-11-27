import { mountPlayer } from './app.mjs'
import { mountPromptPanel } from './prompt-panel.mjs'
import { mountQuotaPanel } from './quota-panel.mjs'
import { compileLesson } from './runtime/lesson/compile.mjs'

let storage
try {storage=localStorage} catch {storage={getItem(){return null},setItem(){throw Error('unavailable')},removeItem(){throw Error('unavailable')}}}
async function load(path) {
  const response=await fetch(new URL(path,import.meta.url))
  if(!response.ok)throw Error('模板暂时没有加载成功，请检查网络后重试。')
  return response.text()
}
const loadExample = name => load(`examples/${name}.json`)
const authorizeUse = mountQuotaPanel({doc:document,fetch:window.fetch.bind(window)})
mountPlayer({doc:document,storage,compile:compileLesson,loadTemplate:topic=>load(`templates/lesson-${topic}.html`),loadExample,authorizeUse})
const methodCards = JSON.parse(document.getElementById('method-card-data')?.textContent ?? '[]')
mountPromptPanel({doc:document,loadExample,methodCards,authorizeUse})
