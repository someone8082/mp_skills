import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import { compileLesson } from '../vendor/solver-lab/lesson/compile.mjs'
import { mountPlayer } from '../src/app.mjs'

async function setup(loadTemplate=()=>Promise.reject(Error('missing template')), authorizeUse) {
  const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8')
  const dom=new JSDOM(html,{url:'https://example.test/'})
  const app=mountPlayer({doc:dom.window.document,storage:dom.window.localStorage,compile:compileLesson,loadTemplate,authorizeUse})
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
test('invalid input never consumes quota and a denied run never mounts a frame', async () => {
  let charged = 0
  const {doc,app,dom} = await setup(undefined, async action => {
    assert.equal(action, 'run')
    charged++
    throw Object.assign(new Error('今天的 20 次机会已用完。'), {code:'quota-daily-limit'})
  })
  try {
    doc.querySelector('#source').value = 'invalid lesson'
    await app.run()
    assert.equal(charged, 0)
    doc.querySelector('#source').value = '<p>课件</p>'
    await app.run()
    assert.equal(charged, 1)
    assert.equal(doc.querySelector('#lesson').srcdoc, '')
    assert.match(doc.querySelector('#error').textContent, /20 次/)
    assert.equal(doc.querySelector('#copy-input-repair').hidden, true)
  } finally { dom.window.close() }
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

test('only the active isolated preview can report diagnostics, and changing content clears old reports',async()=>{
  const {doc,app,dom}=await setup()
  doc.querySelector('#source').value='<html><p>图解</p></html>'
  await app.run()
  const frame=doc.querySelector('#lesson').contentWindow
  const send=(source,origin,message)=>dom.window.dispatchEvent(new dom.window.MessageEvent('message',{
    source,origin,data:{channel:'solver-lab-preview',message},
  }))
  send(dom.window,'null','来自其他页面的消息')
  send(frame,'https://example.test','错误来源的消息')
  assert.equal(doc.querySelector('#preview-feedback').hidden,true)
  send(frame,'null','课件脚本缺少函数')
  assert.equal(doc.querySelector('#preview-feedback').hidden,false)
  assert.equal(doc.querySelector('#preview-diagnostic').textContent,'课件脚本缺少函数')
  await app.run()
  send(frame,'null','旧内容的消息')
  assert.equal(doc.querySelector('#preview-feedback').hidden,true)
})
