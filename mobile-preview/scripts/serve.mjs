import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { DatabaseSync } from 'node:sqlite'
import { Readable } from 'node:stream'
import worker from '../dist/server/index.js'

const db = new DatabaseSync(':memory:')
db.exec(await readFile(new URL('../drizzle/0000_quota.sql', import.meta.url), 'utf8'))
const env = {
  QUOTA_SIGNING_KEY: 'loopback-development-only',
  QUOTA_INITIAL_INVITE: 'local-invite',
  QUOTA_ADMIN_ACTIVATION: 'local-admin',
  DB: {prepare: sql => ({bind: (...params) => ({first: async () => db.prepare(sql).get(...params) ?? null})})},
}
const port = Number(process.argv[2] || 8767)
const origin = `http://127.0.0.1:${port}`

createServer(async (req, res) => {
  try {
    const headers = new Headers(req.headers)
    const body = req.method === 'POST' ? Readable.toWeb(req) : undefined
    const result = await worker.fetch(new Request(origin + req.url, {method:req.method, headers, body, duplex:'half'}), env)
    res.writeHead(result.status, Object.fromEntries(result.headers))
    res.end(Buffer.from(await result.arrayBuffer()))
  } catch {
    res.writeHead(500).end('Local preview error')
  }
}).listen(port, '127.0.0.1', () => console.log(`Local: ${origin}/`))
