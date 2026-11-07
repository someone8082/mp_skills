import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { compileLesson } from '../vendor/solver-lab/lesson/compile.mjs'
import { mountPlayer } from '../src/app.mjs'

async function setup(loadTemplate=()=>Promise.reject(Error('missing template'))) {
  const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8')
  const dom=new JSDOM(html,{url:'https://example.test/'})
  const app=mountPlayer({doc:dom.window.document,storage:dom.window.localStorage,compile:compileLesson,loadTemplate})
  return {dom,doc:dom.window.document,app}
}
test('run, return to editing, rerun and stop unload the previous document',async()=>{
  const {doc,app}=await setup()
  doc.querySelector('#source').value='<html><body><h1>第一题</h1></body></html>'
  await app.run(); assert.equal(doc.body.dataset.view,'preview'); assert.ok(doc.querySelector('iframe').srcdoc.includes('第一题'))
  doc.querySelector('#back').click(); assert.equal(doc.body.dataset.view,'edit'); assert.equal(doc.querySelector('iframe').srcdoc,'')
  doc.querySelector('#source').value='<html><body><h1>第二题</h1></body></html>'
  await app.run(); assert.ok(!doc.querySelector('iframe').srcdoc.includes('第一题'))
  doc.querySelector('#stop').click(); assert.equal(doc.querySelector('iframe').srcdoc,''); assert.equal(doc.body.dataset.view,'edit')
})
test('invalid input clears the last successful frame and keeps editable source',async()=>{
  const {doc,app}=await setup()
  doc.querySelector('#source').value='<p>可运行</p>'; await app.run()
  doc.querySelector('#source').value='{"topic":'; await app.run()
  assert.equal(doc.querySelector('iframe').srcdoc,''); assert.equal(doc.body.dataset.view,'edit')
  assert.ok(doc.querySelector('#error').textContent); assert.equal(doc.querySelector('#source').value,'{"topic":')
})
test('returning to edit cancels an in-flight template load',async()=>{
  let resolveTemplate
  const {doc,app}=await setup(()=>new Promise(r=>resolveTemplate=r))
  doc.querySelector('#source').value=JSON.stringify({version:1,topic:'motion',problemText:'',givens:{v0:{value:0,unit:'m/s'},a:{value:2,unit:'m/s²'},t:{value:3,unit:'s'}}})
  const running=app.run(); await Promise.resolve(); app.edit()
  resolveTemplate('<script id="lesson-data" type="application/json">{}</script>'); await running
  assert.equal(doc.body.dataset.view,'edit'); assert.equal(doc.querySelector('iframe').srcdoc,'')
})
test('editing source cancels an older template response',async()=>{
  let complete
  const {doc,app,dom}=await setup(()=>new Promise(r=>complete=r))
  doc.querySelector('#source').value=JSON.stringify({version:1,topic:'motion',problemText:'',givens:{v0:{value:0,unit:'m/s'},a:{value:2,unit:'m/s²'},t:{value:3,unit:'s'}}})
  const pending=app.run(); await Promise.resolve()
  doc.querySelector('#source').value='<p>已改成新题</p>'
  doc.querySelector('#source').dispatchEvent(new dom.window.Event('input'))
  complete('<script id="lesson-data" type="application/json">{}</script>'); await pending
  assert.equal(doc.body.dataset.view,'edit'); assert.equal(doc.querySelector('iframe').srcdoc,''); assert.equal(doc.querySelector('#run').disabled,false)
})
test('stopping physically detaches the previous execution context',async()=>{
  const {doc,app}=await setup()
  doc.querySelector('#source').value='<p>第一题</p>';await app.run()
  const old=doc.querySelector('iframe');doc.querySelector('#stop').click()
  assert.equal(old.isConnected,false)
  assert.equal(doc.querySelector('iframe').srcdoc,'')
})

test('running dismisses the editor keyboard and returning does not reopen it',async()=>{
  const {doc,app}=await setup()
  const source=doc.querySelector('#source');source.value='<p>手机图解</p>';source.focus()
  const pending=app.run()
  assert.notEqual(doc.activeElement,source)
  await pending;doc.querySelector('#back').click()
  assert.notEqual(doc.activeElement,source)
  assert.equal(doc.activeElement,doc.querySelector('#run'))
})

test('an error announces the problem without forcing the phone keyboard open',async()=>{
  const {doc,app}=await setup()
  doc.querySelector('#source').value='错误代码';await app.run()
  assert.notEqual(doc.activeElement,doc.querySelector('#source'))
  assert.equal(doc.activeElement,doc.querySelector('#error'))
})
