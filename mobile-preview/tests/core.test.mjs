import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { compileLesson } from '../vendor/solver-lab/lesson/compile.mjs'
import { prepareContent, readRecent, remember, SANDBOX } from '../src/core.mjs'

const motion={version:1,topic:'motion',problemText:'从静止以2 m/s²运动3 s。',givens:{v0:{value:0,unit:'m/s'},a:{value:2,unit:'m/s²'},t:{value:3,unit:'s'}}}
const loadTemplate=topic=>readFile(new URL(`../vendor/solver-lab/examples/lesson-${topic}.html`,import.meta.url),'utf8')
const options={compile:compileLesson,loadTemplate}
test('a complete independent lesson keeps inline animation code behind a sandbox',async()=>{
  const code='<!doctype html><html><head><title>上抛实验</title></head><body><button onclick="this.textContent=1">播放</button><script>window.lessonReady=true</script></body></html>'
  const r=await prepareContent('```html\n'+code+'\n```',options)
  assert.equal(r.kind,'html'); assert.equal(r.code,code); assert.equal(r.title,'上抛实验')
  assert.ok(r.document.indexOf('Content-Security-Policy')<r.document.indexOf('window.lessonReady'))
  assert.match(r.document,/connect-src 'none'/); assert.equal(SANDBOX,'allow-scripts')
})
test('actual motion kernel validates inputs and embeds only this problem',async()=>{
  const r=await prepareContent(JSON.stringify(motion),options)
  assert.equal(r.kind,'json'); assert.equal(r.answer.s,9); assert.equal(r.answer.v,6)
  const data=r.document.match(/<script id="lesson-data" type="application\/json">([\s\S]*?)<\/script>/)[1]
  assert.deepEqual(JSON.parse(data),motion)
})
test('script-closing text in a JSON problem remains data',async()=>{
  const r=await prepareContent(JSON.stringify({...motion,problemText:'原文</script><script>alert(1)</script>'}),options)
  assert.ok(r.document.includes('\\u003c/script>')); assert.ok(!r.document.includes('原文</script>'))
})
test('wrong claims and wrong units cannot create a successful preview',async()=>{
  await assert.rejects(prepareContent(JSON.stringify({...motion,claims:[{quantity:'s',value:8,unit:'m'}]}),options),/8|位移|s：/)
  const bad=structuredClone(motion); bad.givens.a.unit='s'
  await assert.rejects(prepareContent(JSON.stringify(bad),options),/单位/)
})
test('malformed JSON, unsupported specs, plain prose and empty input explain failure',async()=>{
  for(const value of ['','这是解题说明','{"version":1,','{"domain":"physics"}','[]']) {
    await assert.rejects(prepareContent(value,options),Error)
  }
})
test('the original user-submitted page can load without changing its physics',async()=>{
  const code=await readFile(new URL('fixtures/throw.html',import.meta.url),'utf8')
  const r=await prepareContent(code,options)
  assert.ok(r.document.includes('function stateAt(tt)')); assert.ok(r.document.includes('const tGround=1+Math.sqrt(5)'))
})
const memory=()=>{const map=new Map(); return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}}
test('recent lessons are deduplicated and limited to three',()=>{
  const s=memory()
  for(const n of [1,2,3,4,3]) remember(s,{code:'<p>'+n+'</p>',title:'题'+n,kind:'html'})
  assert.deepEqual(readRecent(s).map(x=>x.title),['题3','题4','题2'])
})
test('storage corruption and unavailable storage do not crash current lesson',()=>{
  assert.deepEqual(readRecent({getItem:()=>'{broken'}),[])
  const bad={getItem:()=>{throw Error('denied')},setItem:()=>{throw Error('quota')}}
  assert.deepEqual(readRecent(bad),[]); assert.equal(remember(bad,{code:'<p>ok</p>',title:'ok',kind:'html'}).persisted,false)
})
