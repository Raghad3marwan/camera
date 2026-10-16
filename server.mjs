/* INDEX: 01 Local static server | 02 Request handler */
/* 01 START: Local static server. No package installation required. */
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.task':'application/octet-stream','.json':'application/json','.md':'text/plain; charset=utf-8'};
/* 01 END: Local static server */
/* 02 START: Request handler. Localhost only. */
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  const decoded=decodeURIComponent(url.pathname);
  const filename=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));
  if(!filename.startsWith(root)||!['GET','HEAD'].includes(req.method)){res.writeHead(403);res.end('Forbidden');return}
  const info=await stat(filename);if(!info.isFile())throw new Error('not a file');
  res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':info.size,'X-Content-Type-Options':'nosniff'});
  res.end(req.method==='HEAD'?undefined:await readFile(filename));
 }catch{res.writeHead(404);res.end('Not found')}
}).on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port 5500 is busy. Stop the other local server, then retry.':e.message);process.exitCode=1}).listen(5500,'127.0.0.1',()=>console.log('Waqfa: http://127.0.0.1:5500 — Ctrl+C to stop'));
/* 02 END: Request handler */
