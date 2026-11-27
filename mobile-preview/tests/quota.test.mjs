import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { test } from 'node:test'
import { quotaResponse } from '../worker/quota.mjs'

function fixture() {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync(new URL('../drizzle/0000_quota.sql', import.meta.url), 'utf8'))
  const env = {
    QUOTA_SIGNING_KEY: 'test-key-not-for-deployment',
    QUOTA_INITIAL_INVITE: 'invite-for-tests',
    QUOTA_ADMIN_ACTIVATION: 'activate-for-tests',
    DB: {
      prepare(sql) {
        const statement = sqlite.prepare(sql)
        return { bind: (...params) => ({ first: async () => statement.get(...params) ?? null }) }
      },
    },
  }
  const sessions = new Map()
  const send = async (path, visitor, data, now = '2026-11-24T15:59:59Z', origin = 'https://test.example') => {
    const headers = new Headers({origin})
    if (!sessions.has(visitor)) sessions.set(visitor, new Map())
    const cookies = sessions.get(visitor)
    if (cookies.size) headers.set('cookie', [...cookies.values()].join('; '))
    if (data) headers.set('content-type', 'application/json')
    const response = await quotaResponse(new Request(`https://test.example/api/quota${path}`, {
      headers, method: data ? 'POST' : 'GET', body: data ? JSON.stringify(data) : undefined,
    }), env, new Date(now))
    const received = response.headers.getSetCookie()
    for (const value of received) {
      const [pair] = value.split(';')
      cookies.set(pair.split('=')[0], pair)
    }
    return {status:response.status, data:await response.json(), cookies:received}
  }
  return send
}

test('ordinary visitors use both activities without signing in and reset at Beijing midnight', async () => {
  const send = fixture()
  const first = await send('', 'student')
  assert.equal(first.status, 200)
  assert.equal(first.data.remaining, 20)
  assert.match(first.cookies[0], /HttpOnly/)
  assert.match(first.cookies[0], /Secure/)
  const attempts = await Promise.all(Array.from({length:24}, (_, index) => send('/use', 'student', {action:index % 2 ? 'run' : 'prompt'})))
  assert.equal(attempts.filter(result => result.status === 200).length, 20)
  assert.equal(attempts.filter(result => result.status === 429).length, 4)
  assert.equal((await send('', 'student')).data.remaining, 0)
  assert.equal((await send('', 'other-student')).data.remaining, 20)
  assert.equal((await send('', 'student', null, '2026-11-24T16:00:00Z')).data.remaining, 20)
})

test('a visitor can activate admin with the verification code and rotate the invite without signing in', async () => {
  const send = fixture()
  for (const visitor of ['owner','student','other','guest']) await send('', visitor)
  assert.equal((await send('/invite', 'guest', {code:'new-invite'})).status, 403)
  assert.equal((await send('/activate', 'owner', {code:'wrong'})).status, 403)
  assert.equal((await send('/activate', 'owner', {code:'activate-for-tests'})).data.admin, true)
  assert.equal((await send('', 'other')).data.admin, false)
  assert.equal((await send('/redeem', 'student', {code:'invite-for-tests'})).data.unlimited, true)
  assert.equal((await send('/invite', 'owner', {code:'new-invite'})).status, 200)
  assert.equal((await send('/redeem', 'other', {code:'invite-for-tests'})).status, 403)
  assert.equal((await send('/redeem', 'other', {code:'new-invite'})).data.unlimited, true)
  assert.equal((await send('/use', 'student', {action:'run'})).data.unlimited, true)
  assert.equal((await send('/use', 'owner', {action:'prompt'})).data.unlimited, true)
  assert.equal((await send('', 'owner', undefined, '2026-12-26T00:00:00Z')).data.admin, false)
  assert.equal((await send('/activate', 'owner', {code:'activate-for-tests'}, '2026-12-26T00:00:00Z')).data.admin, true)
})

test('writes require the site origin and code guesses have their own daily limit', async () => {
  const send = fixture()
  await send('', 'student')
  assert.equal((await send('/use', 'student', {action:'run'}, undefined, 'https://other.example')).status, 403)
  assert.equal((await send('/use', 'student', {action:'unknown'})).status, 400)
  const trials = await Promise.all(Array.from({length:11}, () => send('/redeem', 'student', {code:'wrong'})))
  assert.equal(trials.filter(result => result.status === 429).length, 1)
  assert.equal((await send('', 'student')).data.remaining, 20)
})
