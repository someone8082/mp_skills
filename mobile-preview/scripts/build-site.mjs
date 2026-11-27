import './build.mjs'
import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const output = new URL('dist/', root)
const types = {
  '.html':'text/html; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.svg':'image/svg+xml',
  '.json':'application/json; charset=utf-8',
}
const assets = {}
async function collect(directory, prefix = '/') {
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    if (entry.name.startsWith('.') || (prefix === '/' && entry.name === 'server')) continue
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
    const name = prefix + entry.name
    if (entry.isDirectory()) await collect(path, name + '/')
    else {
      const type = types[entry.name.slice(entry.name.lastIndexOf('.'))]
      if (!type) throw new Error(`Unexpected site asset ${name}`)
      assets[name] = [type, await readFile(path, 'utf8')]
    }
  }
}

await collect(output)
await mkdir(new URL('server/', output), {recursive:true})
await mkdir(new URL('.openai/', output), {recursive:true})
const worker = await readFile(new URL('worker/quota.mjs', root), 'utf8')
await writeFile(new URL('server/index.js', output), `${worker}\nexport default siteWorker(${JSON.stringify(assets)})\n`)
await cp(new URL('.openai/hosting.json', root), new URL('.openai/hosting.json', output))
