import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('./dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp4':'video/mp4','.svg':'image/svg+xml','.txt':'text/plain'};
export function createApp(){
  return createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-cache');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end('Demo server: read-only.');}
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);return res.end();}
      const info=await stat(path);if(!info.isFile())throw Error('Not a file');
      res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');
      res.setHeader('Accept-Ranges','bytes');
      let start=0,end=info.size-1,status=200;
      if(req.headers.range){
        const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if(!range || (!range[1]&&!range[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}
        if(!range[1])start=Math.max(0,info.size-Number(range[2]));
        else {start=Number(range[1]);if(range[2])end=Math.min(end,Number(range[2]));}
        if(start>end||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`});return res.end();}
        status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${info.size}`);
      }
      res.setHeader('Content-Length',end-start+1);res.writeHead(status);
      if(req.method==='HEAD')return res.end();
      const stream=createReadStream(path,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res);
    }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found.');}
  });
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const option=(name,fallback)=>{const index=process.argv.indexOf(name);return index>=0?process.argv[index+1]:fallback;};
  const port=Number(option('--port',process.env.PORT||8094));
  const host=option('--host','127.0.0.1');
  const server=createApp();
  server.listen(port,host,()=>console.log(`Reactor MTV — http://${host}:${port}\nDemo mode: no API key needed. Stop with Ctrl+C.`));
  server.on('error',()=>{console.error('Could not start. Close another copy using port 8094, then try again.');process.exitCode=1;});
  process.on('SIGINT',()=>{server.close();server.closeAllConnections();});
}
