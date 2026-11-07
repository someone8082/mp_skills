import { mountPlayer } from './app.mjs'
import { compileLesson } from './runtime/lesson/compile.mjs'

let storage
try {storage=localStorage} catch {storage={getItem(){return null},setItem(){throw Error('unavailable')},removeItem(){throw Error('unavailable')}}}
async function load(path) {
  const response=await fetch(new URL(path,import.meta.url))
  if(!response.ok)throw Error('模板暂时没有加载成功，请检查网络后重试。')
  return response.text()
}
mountPlayer({doc:document,storage,compile:compileLesson,loadTemplate:topic=>load(`templates/lesson-${topic}.html`),loadExample:topic=>load(`examples/${topic}.json`)})
