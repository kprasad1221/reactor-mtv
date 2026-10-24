import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {PRESETS,GENRES,composeRecipe,diagnostic,MockAdapter} from '../dist/src/core.js';
function rig(){
  const jobs=[];const events=[];let clock=0;
  const adapter=new MockAdapter(e=>events.push(e),{schedule:(fn,at)=>{const job={fn,at};jobs.push(job);return job;},unschedule:job=>{job.cancelled=true;},now:()=>clock,id:()=> 'mock-1234-abcd'});
  return {adapter,events,jobs,run:()=>{for(const job of jobs){clock=job.at;if(!job.cancelled)job.fn();}}};
}
test('three preset images and recordings have actual bundled bytes',async()=>{
  for(const p of PRESETS){assert.ok((await stat(new URL('../dist/'+p.image,import.meta.url))).size>1000);assert.ok((await stat(new URL('../dist/'+p.video,import.meta.url))).size>100000);}
});
test('all genres produce stable VISUAL/MUSIC recipes without changing media',()=>{
  for(const genre of Object.keys(GENRES)){const args={presetId:'caustics',genre,direction:'Follow the blue light.'};assert.deepEqual(composeRecipe(args),composeRecipe(args));assert.match(composeRecipe(args).prompt,/VISUAL\n[\s\S]*MUSIC\n/);assert.equal(composeRecipe(args).generated,false);}
});
test('explicit music overrides conflicting dropdown and is visible in recipe',()=>{
  const r=composeRecipe({presetId:'fog',genre:'house',direction:'Mist rises.\nMUSIC: Slow jazz with a brushed snare.'});
  assert.equal(r.musicOverride,true);assert.match(r.prompt,/MUSIC\nSlow jazz/);assert.doesNotMatch(r.prompt,/Atmospheric progressive house/);
});
test('custom uploads serialize no filename, blob URL, bytes or original clip claim',()=>{
  const r=composeRecipe({presetId:'rays',genre:'ambient',direction:'Water moves.',custom:true});
  assert.equal(r.image.filename,null);assert.equal(r.presetId,null);assert.equal(r.image.kind,'local-upload');assert.equal(r.generated,false);
});
test('blank direction has a usable default',()=>assert.match(composeRecipe({direction:'',genre:'ambient'}).prompt,/one clear light gesture/));
test('original media metadata stays separate from new directions',async()=>{
  const originals=JSON.parse(await readFile(new URL('../dist/original-recipes.json',import.meta.url),'utf8'));
  for(const p of PRESETS){const original=originals.find(x=>x.id===p.id);assert.equal(original.selectedSeconds,5);assert.match(original.originalVideo,/^https:\/\/app-uploads.krea.ai\/public\//);assert.equal(original.prompt,undefined);assert.equal(original.source,undefined);}
});
test('diagnostics discard credentials, prompts, user filenames, nested fields and signed URLs',()=>{
  const secret='rk_FAKE_TEST_CREDENTIAL_DO_NOT_USE';
  const result=diagnostic({mode:'recorded',stage:'first_frame',apiKey:secret,jwt:secret,prompt:secret,filename:secret,url:'https://example.com/?token='+secret,request:{authorization:secret},attemptId:secret,code:secret,assetId:secret,bytes:10});
  assert.deepEqual(result,{mode:'recorded',stage:'first_frame',bytes:10});assert.ok(!JSON.stringify(result).includes(secret));
});
test('synthetic success distinguishes accepted, ready, playback, finished and closed',()=>{
  const r=rig();r.adapter.start();r.run();assert.deepEqual(r.events.map(e=>e.stage),['request_accepted','generating','clip_ready','playback_requested','output_finished','closing','closed']);assert.equal(r.adapter.active,false);assert.ok(r.events.every(e=>e.mode==='synthetic'));
});
test('duplicate starts are rejected',()=>{const r=rig();assert.equal(r.adapter.start(),true);assert.equal(r.adapter.start(),false);assert.equal(r.events.filter(x=>x.stage==='request_accepted').length,1);});
test('cancellation invalidates delayed callbacks, even after a new attempt',()=>{
  const r=rig();r.adapter.start();const old=[...r.jobs];r.adapter.cancel();r.adapter.start();const count=r.events.length;old.forEach(j=>j.fn());assert.equal(r.events.length,count);
});
test('mock errors close without automatic retries',()=>{const r=rig();r.adapter.start('error');r.run();assert.ok(r.events.some(e=>e.stage==='error'));assert.equal(r.events.at(-1).stage,'closed');assert.equal(r.events.filter(e=>e.stage==='request_accepted').length,1);});
test('mock timeouts close without automatic retries',()=>{const r=rig();r.adapter.start('timeout');r.run();assert.ok(r.events.some(e=>e.stage==='timeout'));assert.equal(r.events.at(-1).stage,'closed');});
test('unconfirmed closure blocks subsequent attempts until explicit resolution',()=>{
  const r=rig();r.adapter.start('closure');r.run();assert.equal(r.adapter.unresolved,true);assert.equal(r.adapter.start(),false);r.adapter.confirmMockClosure();assert.equal(r.adapter.unresolved,false);assert.equal(r.adapter.start(),true);
});
test('public build contains no generation SDK or session creation request',async()=>{
  const app=await readFile(new URL('../dist/src/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(app,/@reactor-team|api\.reactor|\/tokens|\/sessions|localStorage|sessionStorage/);
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));assert.equal(pkg.dependencies,undefined);
});
