export const SANDBOX='allow-scripts'
export const MAX_LENGTH=500_000
export const RECENT_KEY='solver-mobile.recent.v1'
export const DRAFT_KEY='solver-mobile.draft.v1'
const TOPICS={motion:'运动图解',circuit:'串联电路',section:'立体截面'}
const POLICY="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

export function sandboxDocument(code) {
  // The policy is parsed before any supplied markup. The iframe never gains same-origin access.
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${POLICY}"></head><body>${code}</body></html>`
}

export async function prepareContent(raw,{compile,loadTemplate}) {
  if(typeof raw!=='string'||!raw.trim()) throw Error('先粘贴图解代码，再点运行。')
  if(raw.length>MAX_LENGTH) throw Error('这份代码太长了，请让模型只输出这一题的单文件图解。')
  let code=raw.trim()
  const fence=code.match(/^```(?:html|json)?\s*\n([\s\S]*?)\n```$/i)
  if(fence) code=fence[1].trim()
  if(/^[\[{]/.test(code)) {
    let spec
    try {spec=JSON.parse(code)} catch {throw Error('JSON格式不完整。请复制完整代码，不要包含代码块外的说明。')}
    if(!spec||Array.isArray(spec)||spec.version!==1||!TOPICS[spec.topic]) throw Error('这不是支持的模板JSON。请使用version=1的motion、circuit或section题目，其他题型粘贴完整HTML。')
    const result=compile(spec)
    if(!result.ok) throw Error(result.errors.join('；'))
    const template=await loadTemplate(spec.topic)
    const pattern=/(<script\s+id="lesson-data"\s+type="application\/json">)[\s\S]*?(<\/script>)/
    if(!pattern.test(template)) throw Error('模板没有加载完整，请稍后重新运行。')
    const data=JSON.stringify(spec).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')
    const html=template.replace(pattern,(_,start,end)=>start+data+end)
    return {kind:'json',code,title:spec.title||TOPICS[spec.topic],topic:spec.topic,answer:result.answer,document:sandboxDocument(html)}
  }
  if(!/<[a-z!][\s\S]*>/i.test(code)) throw Error('这里需要HTML代码或模板JSON。请复制模型输出的代码，而不是解题说明。')
  const title=code.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g,'').trim().slice(0,70)||'独立图解'
  return {kind:'html',code,title,document:sandboxDocument(code)}
}

export function readRecent(storage) {
  try {
    const value=JSON.parse(storage.getItem(RECENT_KEY)||'[]')
    return Array.isArray(value)?value.filter(x=>x&&typeof x.code==='string'&&x.code.length<=MAX_LENGTH&&typeof x.title==='string').slice(0,3):[]
  } catch {return []}
}
export function remember(storage,lesson) {
  const item={code:lesson.code,title:lesson.title,kind:lesson.kind,time:Date.now()}
  const items=[item,...readRecent(storage).filter(x=>x.code!==item.code)].slice(0,3)
  try {storage.setItem(RECENT_KEY,JSON.stringify(items)); return {items,persisted:true}} catch {return {items,persisted:false}}
}
export function saveDraft(storage,code) {try {storage.setItem(DRAFT_KEY,code);return true} catch {return false}}
export function readDraft(storage) {try {return (storage.getItem(DRAFT_KEY)||'').slice(0,MAX_LENGTH)} catch {return ''}}
