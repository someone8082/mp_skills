export function mountQuotaPanel({doc, fetch}) {
  const $ = id => doc.getElementById(id)
  const status = $('quota-status')
  const message = $('quota-message')
  let requested = 0
  let rendered = 0

  function render(state) {
    $('quota-redeem').hidden = state.unlimited
    $('quota-activate').hidden = state.admin
    $('quota-invite').hidden = !state.admin
    if (state.admin) status.textContent = '管理员 · 不限次数'
    else if (state.unlimited) status.textContent = '已兑换 · 不限次数'
    else status.textContent = `今日剩余 ${state.remaining} / ${state.limit} 次`
  }

  async function request(route = '', data, retry = true) {
    const revision = ++requested
    let payload, response
    try {
      response = await fetch('/api/quota' + route, {
        cache:'no-store', credentials:'same-origin',
        ...(data && {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(data)}),
      })
      payload = await response.json()
    } catch {
      throw Object.assign(new Error('暂时无法核对使用次数，请检查网络后重试。'), {code:'quota-unavailable'})
    }
    if (route && retry && payload.code === 'browser-session') {
      await request()
      return request(route, data, false)
    }
    if (revision >= rendered && Number.isInteger(payload.limit)) {
      rendered = revision
      render(payload)
    }
    if (!response.ok) throw Object.assign(new Error(payload.message), {code:'quota-' + payload.code})
    return payload
  }

  for (const [name, confirmation] of [
    ['redeem', '兑换成功，当前浏览器已解除次数限制。'],
    ['activate', '管理员已激活，可以更换邀请码。'],
    ['invite', '邀请码已更换，旧码无法继续兑换。'],
  ]) {
    const form = $(`quota-${name}-form`)
    form.addEventListener('submit', async event => {
      event.preventDefault()
      const input = form.elements.namedItem('code')
      const submit = form.querySelector('button')
      if (submit.disabled) return
      submit.disabled = true
      message.textContent = ''
      try {
        await request('/' + name, {code:input.value})
        form.reset()
        message.textContent = confirmation
      } catch (error) {
        message.textContent = error.message
      } finally {
        submit.disabled = false
      }
    })
  }

  const ready = request().catch(error => {if (!rendered) status.textContent = error.message})
  return async action => {
    await ready
    return request('/use', {action})
  }
}
