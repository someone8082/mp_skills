import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, dirname, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist')
const port=Number(process.argv[2]||8767)
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'}
createServer(async(req,res)=>{
  try {
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
    const path=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''))
    if(relative(root,path).startsWith('..'))throw Error('outside root')
    const bytes=await readFile(path)
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
    res.end(req.method==='HEAD'?undefined:bytes)
  }catch{res.writeHead(404);res.end('Not found')}
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/`))
