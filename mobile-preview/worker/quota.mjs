const DAILY_LIMIT = 20
const GUESS_LIMIT = 10
const VISITOR_SECONDS = 365 * 24 * 60 * 60
const ADMIN_SECONDS = 30 * 24 * 60 * 60
const PREFIX = '/api/quota'
const dayAt = now => new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)

function json(data, status = 200, cookie) {
  const headers = new Headers({'cache-control':'private, no-store'})
  if (cookie) headers.set('set-cookie', cookie)
  return Response.json(data, {status, headers})
}

const problem = (status, code, message) => json({code, message}, status)
const read = (db, sql, ...values) => db.prepare(sql).bind(...values).first()
const setting = async (db, name) => (await read(db, 'SELECT value FROM quota_settings WHERE name = ?', name))?.value

function increment(db, account, day, kind, limit) {
  return read(db, `
    INSERT INTO quota_counts (account_id, day, kind, count) VALUES (?, ?, ?, 1)
    ON CONFLICT (account_id, day, kind) DO UPDATE SET count = count + 1
    WHERE count < ? RETURNING count
  `, account, day, kind, limit)
}

async function summary(db, account, visitor, day, sessionAdmin) {
  const row = await read(db, `
    SELECT (SELECT value FROM quota_settings WHERE name = 'admin') AS owner,
      EXISTS (SELECT 1 FROM quota_unlocked WHERE account_id IN (?, ?)) AS redeemed,
      COALESCE((SELECT count FROM quota_counts WHERE account_id = ? AND day = ? AND kind = 'use'), 0) AS used
  `, account, visitor, account, day)
  const admin = sessionAdmin || row.owner === account
  const unlimited = admin || Boolean(row.redeemed)
  return {admin, unlimited, day, limit:DAILY_LIMIT,
    remaining:unlimited ? null : Math.max(0, DAILY_LIMIT - row.used)}
}

async function digest(secret, kind, code) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign'])
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${kind}:${code}`)))
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function sameDigest(first, second) {
  let difference = 0
  for (let index = 0; index < first.length; index++) difference |= first.charCodeAt(index) ^ second.charCodeAt(index)
  return first.length === second.length && difference === 0
}

function cookieName(url, kind) {
  const prefix = url.protocol === 'https:' ? '__Host-' : ''
  return `${prefix}solver-quota-${kind}`
}

function readCookie(request, name) {
  return request.headers.get('cookie')?.split(';').map(value => value.trim())
    .find(value => value.startsWith(name + '='))?.slice(name.length + 1) ?? ''
}

function setCookie(url, name, value, seconds) {
  const secure = url.protocol === 'https:' ? '; Secure' : ''
  return `${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; SameSite=Lax${secure}`
}

async function readVisitor(request, cookie, secret) {
  const match = /^([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(readCookie(request, cookie))
  if (!match) return null
  const [, id, signature] = match
  const expected = await digest(secret, 'visitor', id)
  return sameDigest(signature, expected) ? id : null
}

function adminSignature(secret, activation, visitor, expires) {
  return digest(secret, 'admin-session', `${visitor}:${expires}:${activation}`)
}

async function readAdmin(request, cookie, secret, activation, visitor, now) {
  const match = /^(\d{1,12})\.([a-f0-9]{64})$/.exec(readCookie(request, cookie))
  if (!match || Number(match[1]) <= now) return false
  const expected = await adminSignature(secret, activation, visitor, match[1])
  return sameDigest(match[2], expected)
}

export async function quotaResponse(request, env, now = new Date()) {
  try {
    const url = new URL(request.url)
    const route = url.pathname.slice(PREFIX.length)
    const day = dayAt(now)
    const nowSeconds = Math.floor(now.getTime() / 1000)
    const {DB, QUOTA_SIGNING_KEY, QUOTA_INITIAL_INVITE, QUOTA_ADMIN_ACTIVATION} = env
    if (!DB || !QUOTA_SIGNING_KEY || !QUOTA_INITIAL_INVITE || !QUOTA_ADMIN_ACTIVATION) throw new Error('quota unavailable')
    const isStatus = route === '' && request.method === 'GET'
    if (!isStatus) {
      if (request.method !== 'POST') return problem(405, 'method', '此操作需要提交表单。')
      if (request.headers.get('origin') !== url.origin) return problem(403, 'origin', '请从本站页面提交。')
    }
    const visitorCookie = cookieName(url, 'visitor')
    const adminCookie = cookieName(url, 'admin')
    let id = await readVisitor(request, visitorCookie, QUOTA_SIGNING_KEY)
    let issued
    if (!id) {
      if (!isStatus) return problem(409, 'browser-session', '请允许本站保存 Cookie，然后刷新页面再试。')
      id = crypto.randomUUID().replaceAll('-', '')
      const signature = await digest(QUOTA_SIGNING_KEY, 'visitor', id)
      issued = setCookie(url, visitorCookie, `${id}.${signature}`, VISITOR_SECONDS)
    }
    const visitor = `browser:${id}`
    // Recognize prior redemptions and the original administrator when the platform already has an identity.
    const account = request.headers.get('oai-authenticated-user-id') || visitor
    const admin = await readAdmin(request, adminCookie, QUOTA_SIGNING_KEY, QUOTA_ADMIN_ACTIVATION, id, nowSeconds)
    const getSummary = () => summary(DB, account, visitor, day, admin)
    if (isStatus) return json(await getSummary(), 200, issued)
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '') ||
      Number(request.headers.get('content-length')) > 1024) {
      return problem(400, 'input', '提交内容格式不正确。')
    }
    const body = await request.json().catch(() => null)
    if (route === '/use') {
      if (!['run', 'prompt'].includes(body?.action)) return problem(400, 'action', '无法识别此操作。')
      const current = await getSummary()
      if (current.unlimited) return json(current)
      const used = await increment(DB, account, day, 'use', DAILY_LIMIT)
      if (!used) {
        const latest = await getSummary()
        if (latest.unlimited) return json(latest)
        return json({...latest, code:'daily-limit', message:'今天的 20 次机会已用完。可兑换邀请码，或等北京时间零点刷新。'}, 429)
      }
      return json({...current, remaining:DAILY_LIMIT - used.count})
    }
    if (!['/redeem', '/activate', '/invite'].includes(route)) return problem(404, 'route', '没有这个操作。')
    const code = typeof body?.code === 'string' ? body.code.trim() : ''
    if (!/^[^\s]{4,64}$/u.test(code)) {
      return problem(400, 'code-format', '请输入 4–64 个不含空格的字符。')
    }
    const current = await getSummary()
    if (route === '/invite') {
      if (!current.admin) return problem(403, 'admin-only', '只有管理员可以更换邀请码。')
      const hash = await digest(QUOTA_SIGNING_KEY, 'invite', code)
      await read(DB, `INSERT INTO quota_settings (name, value) VALUES ('invite', ?)
        ON CONFLICT (name) DO UPDATE SET value = excluded.value RETURNING name`, hash)
      return json(current)
    }
    if (route === '/activate' ? current.admin : current.unlimited) return json(current)
    const network = route === '/activate' && request.headers.get('cf-connecting-ip')
    const attemptIdentity = network ? 'network:' + await digest(QUOTA_SIGNING_KEY, 'admin-guess', network) : account
    const attempt = await increment(DB, attemptIdentity, day, route, GUESS_LIMIT)
    if (!attempt) return problem(429, 'guess-limit', '今天尝试次数较多，请北京时间零点后再试。')
    if (route === '/activate') {
      const candidate = await digest(QUOTA_SIGNING_KEY, 'admin', code)
      const expected = await digest(QUOTA_SIGNING_KEY, 'admin', QUOTA_ADMIN_ACTIVATION)
      if (!sameDigest(candidate, expected)) return problem(403, 'bad-code', '管理员验证码不正确。')
      const expires = nowSeconds + ADMIN_SECONDS
      const signature = await adminSignature(QUOTA_SIGNING_KEY, QUOTA_ADMIN_ACTIVATION, id, expires)
      const session = setCookie(url, adminCookie, `${expires}.${signature}`, ADMIN_SECONDS)
      return json({...current, admin:true, unlimited:true, remaining:null}, 200, session)
    } else {
      const candidate = await digest(QUOTA_SIGNING_KEY, 'invite', code)
      const initial = await digest(QUOTA_SIGNING_KEY, 'invite', QUOTA_INITIAL_INVITE)
      const expected = await setting(DB, 'invite') ?? initial
      if (!sameDigest(candidate, expected)) return problem(403, 'bad-code', '邀请码不正确或已更换。')
      const granted = await read(DB, `INSERT INTO quota_unlocked (account_id)
        SELECT ? WHERE COALESCE((SELECT value FROM quota_settings WHERE name = 'invite'), ?) = ?
        ON CONFLICT (account_id) DO NOTHING RETURNING account_id`, visitor, initial, candidate)
      if (!granted && !(await getSummary()).unlimited) return problem(403, 'bad-code', '邀请码已更换，请使用新码。')
    }
    return json(await getSummary())
  } catch {
    return problem(503, 'unavailable', '暂时无法核对使用次数，请稍后再试。')
  }
}

export function siteWorker(assets) {
  return {
    fetch(request, env) {
      const {pathname} = new URL(request.url)
      if (pathname === PREFIX || pathname.startsWith(PREFIX + '/')) return quotaResponse(request, env)
      if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, {status:405})
      const path = pathname === '/' ? '/index.html' : pathname
      if (!Object.hasOwn(assets, path)) return new Response('Not found', {status:404})
      const [type, body] = assets[path]
      return new Response(request.method === 'HEAD' ? null : body, {headers:{
        'content-type':type, 'cache-control':'no-cache', 'x-content-type-options':'nosniff',
      }})
    },
  }
}
