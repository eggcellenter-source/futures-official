import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public'),base='/futures-official/';
const types={'.html':'text/html;charset=utf-8','.mjs':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8'};
http.createServer(async(req,res)=>{
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(!pathname.startsWith(base)){res.writeHead(302,{Location:base}).end();return;}
    const file=path.resolve(root,pathname.slice(base.length)||'index.html');
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(file));
  }catch{res.writeHead(404).end('Not found');}
}).listen(5174,'127.0.0.1',()=>console.log('Preview http://127.0.0.1:5174/futures-official/'));
