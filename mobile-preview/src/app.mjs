import { prepareContent, SANDBOX, MAX_LENGTH, DRAFT_KEY, RECENT_KEY, readRecent, remember, readDraft, saveDraft } from './core.mjs'
import {trackViewport} from './viewport.mjs'

export function mountPlayer({doc,storage,compile,loadTemplate,loadExample}) {
  const $=id=>doc.getElementById(id)
  const source=$('source'),error=$('error'),status=$('status')
  trackViewport(doc.defaultView)
  let frame=$('lesson')
  let generation=0,draftTimer,recent=readRecent(storage)
  frame.setAttribute('sandbox',SANDBOX)
  source.value=readDraft(storage)
  source.maxLength=MAX_LENGTH

  function announce(text) {status.textContent=text}
  function unload() {
    const clean=frame.cloneNode(false)
    clean.removeAttribute('src');clean.removeAttribute('srcdoc')
    frame.replaceWith(clean);frame=clean
  }
  function setBusy(busy) {$('run').disabled=busy;$('run').textContent=busy?'正在准备…':'运行图解';$('run').setAttribute('aria-busy',String(busy))}
  function count() {$('count').textContent=source.value.length?`${source.value.length.toLocaleString()} 字符`:'支持完整 HTML 或模板 JSON'}
  function edit(message='已返回编辑，刚才的图解已停止。') {
    generation++;unload();setBusy(false);doc.body.dataset.view='edit';announce(message)
    $('run').focus({preventScroll:true})
  }
  function history() {
    const list=$('recent-list');list.replaceChildren();$('recent-empty').hidden=recent.length>0
    for(const item of recent) {
      const button=doc.createElement('button');button.className='recent-item';button.type='button'
      const title=doc.createElement('span');title.textContent=item.title
      const type=doc.createElement('small');type.textContent=item.kind==='json'?'模板':'HTML'
      button.append(title,type)
      button.addEventListener('click',()=>{edit('已载入最近的图解，点击运行即可。');source.value=item.code;saveDraft(storage,source.value);count();source.focus()})
      list.append(button)
    }
  }
  async function run() {
    source.blur()
    const ticket=++generation
    unload();error.hidden=true;error.textContent='';setBusy(true);announce('正在准备图解…')
    saveDraft(storage,source.value)
    try {
      const lesson=await prepareContent(source.value,{compile,loadTemplate})
      if(ticket!==generation)return
      $('preview-title').textContent=lesson.title
      $('preview-kind').textContent=lesson.kind==='json'?'模板计算已执行 · 题意仍需核对':'独立 HTML · 结果请结合原题核对'
      doc.body.dataset.view='preview'
      // Mount after the preview has a layout; hidden frames may start with a zero-size viewport.
      frame.getBoundingClientRect()
      frame.srcdoc=lesson.document
      const saved=remember(storage,lesson);recent=saved.items;history()
      announce(saved.persisted?'图解已载入；最近记录保存在这台设备。':'图解已载入，但浏览器暂时无法保存记录。')
      $('back').focus()
    } catch(e) {
      if(ticket!==generation)return
      unload();doc.body.dataset.view='edit';error.textContent=e.message||'加载失败，请检查代码是否完整。';error.hidden=false;announce('没有运行成功，请检查上方提示。');error.focus()
    } finally {if(ticket===generation)setBusy(false)}
  }
  $('run').addEventListener('click',run)
  $('back').addEventListener('click',()=>edit())
  $('stop').addEventListener('click',()=>edit('图解已停止，代码仍保留。'))
  $('rerun').addEventListener('click',run)
  source.addEventListener('input',()=>{if($('run').disabled)edit('内容已更新，请重新运行。');else generation++;count();error.hidden=true;clearTimeout(draftTimer);draftTimer=setTimeout(()=>saveDraft(storage,source.value),350)})
  doc.defaultView.addEventListener('pagehide',()=>saveDraft(storage,source.value))
  $('clear').addEventListener('click',()=>{edit('输入已清空；最近记录仍可重新载入。');source.value='';saveDraft(storage,'');count();error.hidden=true;source.focus()})
  $('forget').addEventListener('click',()=>{
    if(!doc.defaultView.confirm('清除这台设备上保存的最近图解？当前编辑内容会保留。'))return
    try {storage.removeItem(RECENT_KEY);recent=[];history();announce('最近记录已清除。')}catch {announce('浏览器未允许清除记录。')}
  })
  $('paste').addEventListener('click',async()=>{
    try {
      const text=await doc.defaultView.navigator.clipboard.readText()
      if(text.length>MAX_LENGTH)throw Error('代码太长，请只复制这一题。')
      edit('已粘贴，点击运行图解。');source.value=text;saveDraft(storage,text);count();error.hidden=true
    } catch {source.focus();announce('请长按输入框，选择“粘贴”。浏览器可能未开放剪贴板读取。')}
  })
  for(const button of doc.querySelectorAll('[data-example]')) {
    button.addEventListener('click',async()=>{
      const ticket=++generation;unload();setBusy(false);doc.body.dataset.view='edit';error.hidden=true;announce('正在载入示例…')
      try {
        const text=await loadExample(button.dataset.example)
        if(ticket!==generation)return
        source.value=text;saveDraft(storage,text);count();announce('示例已放入输入框，点击运行即可。')
      } catch {if(ticket===generation)announce('示例暂时无法载入，仍可直接粘贴代码。')}
    })
  }
  doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&doc.body.dataset.view==='preview')edit();if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();run()}})
  count();history()
  return {run,edit}
}
