#!/usr/bin/env node
import { readFile } from 'node:fs/promises'

const dataRoot = new URL('../references/study/', import.meta.url)
const notice = '检索提供方法参考，不是题意、假设、计算或完整证明的自动验证；适用条件需与原题逐项核对。'
const normalize = value => value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')

function parse(args) {
  const options = { limit: 3 }
  const allowed = new Set(['--list', '--id', '--query', '--subject', '--limit', '--help'])
  const seen = new Set()
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    if (!allowed.has(key) || seen.has(key)) throw new Error(`未知或重复参数：${key}`)
    seen.add(key)
    if (key === '--list' || key === '--help') options[key.slice(2)] = true
    else {
      const value = args[++i]
      if (value === undefined || value.startsWith('--') || !value.trim()) throw new Error(`${key} 需要非空值`)
      options[key.slice(2)] = value
    }
  }
  if (options.help) {
    if (seen.size !== 1) throw new Error('--help 需单独使用')
    return options
  }
  if ([options.list, options.id !== undefined, options.query !== undefined].filter(Boolean).length !== 1) {
    throw new Error('须且只能使用 --list、--id <id> 或 --query <题目关键词> 之一')
  }
  if (options.subject !== undefined && !['math', 'physics'].includes(options.subject)) throw new Error('--subject 仅支持 math 或 physics')
  if (!/^\d+$/.test(String(options.limit)) || Number(options.limit) < 1 || Number(options.limit) > 10) throw new Error('--limit 必须为1到10的整数')
  options.limit = Number(options.limit)
  if (options.query && (!normalize(options.query) || options.query.length > 4000)) throw new Error('查询须包含关键词，且长度不超过4000字符')
  return options
}

async function readJson(name) {
  return JSON.parse(await readFile(new URL(name, dataRoot), 'utf8'))
}

async function main(args) {
  const options = parse(args)
  if (options.help) return {
    ok: true,
    usage: ['study.mjs --list [--subject math|physics]', 'study.mjs --query "题目关键词" [--subject math|physics] [--limit 1..10]', 'study.mjs --id math-34'],
    notice,
  }
  const catalog = await readJson('catalog.json')
  const candidates = catalog.filter(card => !options.subject || card.subject === options.subject)
  const common = { ok: true, verification: 'reference-only', notice }
  if (options.list) return { ...common, mode: 'list', results: candidates.map(({ id, title, subject }) => ({ id, title, subject })) }
  if (options.id) {
    // IDs resolve through the catalog, never through user-controlled paths.
    const topic = candidates.find(card => card.id === options.id)
    if (!topic) throw new Error(`找不到该专题：${options.id}`)
    const cards = await readJson(`${topic.subject}.json`)
    const card = cards.find(item => item.id === topic.id)
    if (!card) throw new Error(`专题数据缺失：${topic.id}`)
    return { ...common, mode: 'card', card }
  }
  const query = normalize(options.query)
  const ranked = candidates.map(card => {
    const tokens = [...new Set([card.title, ...card.keywords].map(normalize))]
    const matched = tokens.filter(token => token && (token.length > 1 || query === token) && query.includes(token))
    const score = matched.reduce((sum, token) => sum + Math.min(token.length, 8), 0)
    return { id: card.id, subject: card.subject, title: card.title, matched, score }
  }).filter(card => card.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'en'))
  return {
    ...common, mode: 'query', matched: ranked.length > 0,
    results: ranked.slice(0, options.limit).map(({ score, ...item }) => ({ ...item, read: `--id ${item.id}` })),
    searchScope: '标题和显式别名的词面匹配；未命中可改用物理量、模型名或 --list，不表示题目不可解。',
  }
}

try {
  console.log(JSON.stringify(await main(process.argv.slice(2))))
} catch (error) {
  console.log(JSON.stringify({ ok: false, errors: [error.message] }))
  process.exitCode = 1
}
