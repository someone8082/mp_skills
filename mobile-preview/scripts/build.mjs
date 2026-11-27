import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { resolve, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const vendor=resolve(root,'vendor/solver-lab')
let skill=vendor
for(const candidate of ['../skills/solver-lab','../solver-lab']) {
  try {await access(resolve(root,candidate,'lesson/compile.mjs'));skill=resolve(root,candidate);break}catch{}
}
const dist=resolve(root,'dist')
await mkdir(dist,{recursive:true})
await cp(resolve(root,'src'),dist,{recursive:true})
const seen=new Set()
async function copyModule(path) {
  if(seen.has(path))return
  seen.add(path)
  const rel=relative(skill,path)
  if(rel.startsWith('..'+sep)||rel==='..')throw Error('runtime dependency escaped skill directory')
  const content=await readFile(path,'utf8'),target=resolve(dist,'runtime',rel)
  await mkdir(dirname(target),{recursive:true});await writeFile(target,content)
  const vendored=resolve(vendor,rel)
  if(path!==vendored){await mkdir(dirname(vendored),{recursive:true});await writeFile(vendored,content)}
  for(const match of content.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
    if(!match[1].startsWith('.'))throw Error('Unexpected external runtime import: '+match[1])
    await copyModule(resolve(dirname(path),match[1]))
  }
}
await copyModule(resolve(skill,'lesson/compile.mjs'))
for(const topic of ['motion','circuit','section']) {
  await mkdir(resolve(dist,'templates'),{recursive:true});await mkdir(resolve(dist,'examples'),{recursive:true})
  await cp(resolve(skill,`examples/lesson-${topic}.html`),resolve(dist,`templates/lesson-${topic}.html`))
  await cp(resolve(skill,`lesson/examples/${topic}.json`),resolve(dist,`examples/${topic}.json`))
  if(skill!==vendor){
    await mkdir(resolve(vendor,'examples'),{recursive:true});await mkdir(resolve(vendor,'lesson/examples'),{recursive:true})
    await cp(resolve(skill,`examples/lesson-${topic}.html`),resolve(vendor,`examples/lesson-${topic}.html`))
    await cp(resolve(skill,`lesson/examples/${topic}.json`),resolve(vendor,`lesson/examples/${topic}.json`))
  }
}
let construction = resolve(skill, 'lesson/examples/section-construction.json')
const constructionSnapshot = resolve(vendor, 'lesson/examples/section-construction.json')
try { await access(construction) } catch { construction = constructionSnapshot }
await cp(construction, resolve(dist, 'examples/construction.json'))
if (construction !== constructionSnapshot) await cp(construction, constructionSnapshot)

// Publish only the synthesized cards and page references, without PDF extracts.
const studySnapshot = resolve(vendor, 'references/study')
await mkdir(studySnapshot, {recursive:true})
const cards = []
for (const dataset of ['math', 'math-bishua-2027', 'physics']) {
  const snapshot = resolve(studySnapshot, `${dataset}.json`)
  const original = resolve(skill, `references/study/${dataset}.json`)
  let file = original
  try { await access(file) } catch { file = snapshot }
  const data = await readFile(file, 'utf8')
  if (file !== snapshot) await writeFile(snapshot, data)
  const locator = ({title,pages,printed,section}) => ({title,pages,printed,section})
  for (const {id, subject, title, keywords, conditions, method, pitfalls, transferChecks, source,
    category, chapter, collection, relatedSources} of JSON.parse(data)) {
    cards.push({id, subject, title, keywords, conditions, method, pitfalls, transferChecks,
      category, chapter, collection, source:locator(source), relatedSources:relatedSources?.map(locator)})
  }
}
await mkdir(resolve(dist, 'study'), {recursive:true})
const courseware = JSON.parse(await readFile(resolve(root, 'study/physics-courseware.json'), 'utf8'))
cards.push(...courseware)
const cardData = JSON.stringify(cards)
const pagePath = resolve(dist, 'index.html')
const page = await readFile(pagePath, 'utf8')
const cardTag = '<script id="method-card-data" type="application/json">'
const cardSlot = cardTag + '[]</script>'
if (!cards.length || !page.includes(cardSlot)) throw Error('Missing method cards or page slot')
await writeFile(pagePath, page.replace(cardSlot, () => cardTag + cardData.replaceAll('<', '\\u003c') + '</script>'))
await writeFile(resolve(dist, 'study/cards.json'), cardData)
console.log(JSON.stringify({ok:true,output:dist,runtimeModules:seen.size}))
