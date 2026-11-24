import {diagnosticScript} from './diagnostics.mjs'

export const SANDBOX='allow-scripts'
export const MAX_LENGTH=500_000
export const RECENT_KEY='solver-mobile.recent.v1'
export const DRAFT_KEY='solver-mobile.draft.v1'
const TOPICS={motion:'运动图解',circuit:'串联电路',section:'立体截面'}
const POLICY="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

export function sandboxDocument(code, debug = false) {
  // The policy is parsed before any supplied markup. The iframe never gains same-origin access.
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${POLICY}">${debug ? diagnosticScript : ''}</head><body>${code}</body></html>`
}

function lessonError(code, message, kind) {
  return Object.assign(new Error(message), {code, kind})
}

function extractLesson(raw) {
  const input = raw.trim()
  if (/^[<\[{]/.test(input)) return input

  // Scan each fenced block once, including unlabelled blocks from chat exports.
  const lines = input.split(/\r?\n/)
  const lessons = []
  for (let i = 0; i < lines.length; i++) {
    const start = lines[i].match(/^ {0,3}(`{3,}|~{3,})[ \t]*([^`~]*)$/)
    if (!start) continue
    const marker = start[1]
    const language = start[2].trim().toLowerCase()
    const closing = new RegExp(`^ {0,3}${marker[0]}{${marker.length},}[ \\t]*$`)
    const from = ++i
    while (i < lines.length && !closing.test(lines[i])) i++
    const content = lines.slice(from, i).join('\n').trim()
    const kind = language === 'html' || language === 'json' ? language :
      !language && content.startsWith('<') ? 'html' : !language && /^[\[{]/.test(content) ? 'json' : null
    if (!kind) continue
    if (i === lines.length) throw lessonError('incomplete-block', '代码块没有结束，请重新复制完整代码，或让 AI 重发完整代码。', kind)
    lessons.push(content)
  }
  if (lessons.length > 1) throw lessonError('multiple-blocks', '找到多个 HTML 或 JSON 代码块。请只复制这一题要运行的那一个。')
  return lessons[0] ?? input
}

export async function prepareContent(raw,{compile,loadTemplate}) {
  if(typeof raw!=='string'||!raw.trim()) throw Error('先粘贴图解代码，再点运行。')
  if(raw.length>MAX_LENGTH) throw Error('这份代码太长了，请让模型只输出这一题的单文件图解。')
  const code=extractLesson(raw)
  if(/^[\[{]/.test(code)) {
    let spec
    try {spec=JSON.parse(code)} catch {throw lessonError('invalid-json', 'JSON 格式有误或被截断。请复制完整代码。', 'json')}
    if(!spec||Array.isArray(spec)||spec.version!==1||!Object.hasOwn(TOPICS, spec.topic)) throw lessonError('unsupported-spec', '支持 version=1 的 motion、circuit 或 section 模板，其他题型请用完整 HTML。')
    const result=compile(spec)
    if(!result.ok) throw lessonError('invalid-spec', result.errors.join('；'), 'json')
    let template
    try {template=await loadTemplate(spec.topic)} catch {throw lessonError('template-unavailable', '模板暂时无法加载，代码已保留。请检查网络后重试。', 'json')}
    const pattern=/(<script\s+id="lesson-data"\s+type="application\/json">)[\s\S]*?(<\/script>)/
    if(!pattern.test(template)) throw lessonError('template-unavailable', '模板没有加载完整，请稍后重新运行。', 'json')
    const data=JSON.stringify(spec).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')
    const html=template.replace(pattern,(_,start,end)=>start+data+end)
    return {kind:'json',code,title:spec.title||TOPICS[spec.topic],topic:spec.topic,answer:result.answer,document:sandboxDocument(html)}
  }
  if(!/^<[a-z!][\s\S]*>/i.test(code)) throw lessonError('missing-lesson', '没有找到 HTML 或模板 JSON。可粘贴一份完整代码，或包含一个代码块的聊天回复。')
  const title=code.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]*>/g,'').trim().slice(0,70)||'独立图解'
  return {kind:'html',code,title,document:sandboxDocument(code,true)}
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
