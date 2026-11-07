import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { resolve, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const vendor=resolve(root,'vendor/solver-lab')
let skill=resolve(root,'../skills/solver-lab')
try {await access(resolve(skill,'lesson/compile.mjs'))}catch{skill=vendor}
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
console.log(JSON.stringify({ok:true,output:dist,runtimeModules:seen.size}))
