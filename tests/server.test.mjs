import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
test('local server serves playable media and exposes no generation routes',async()=>{
  const server=createApp();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    const page=await fetch(origin);assert.equal(page.status,200);assert.match(await page.text(),/What's next/);
    assert.match(page.headers.get('content-security-policy'),/connect-src 'self'/);
    const partial=await fetch(origin+'/media/caustics.mp4',{headers:{Range:'bytes=0-31'}});
    assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,32);
    const suffix=await fetch(origin+'/media/caustics.mp4',{headers:{Range:'bytes=-20'}});assert.equal(suffix.status,206);assert.equal((await suffix.arrayBuffer()).byteLength,20);
    const bad=await fetch(origin+'/media/caustics.mp4',{headers:{Range:'bytes=999999999-'}});assert.equal(bad.status,416);
    assert.equal((await fetch(origin+'/api/token',{method:'POST'})).status,405);
    assert.equal((await fetch(origin+'/api/token')).status,404);
    assert.equal((await fetch(origin+'/.env.local')).status,404);
    assert.equal((await fetch(origin+'/..%2fpackage.json')).status,403);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
