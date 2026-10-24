import {VERSION,PRESETS,GENRES,composeRecipe,diagnostic,MockAdapter} from './core.js';

const $=id=>document.getElementById(id);
const video=$('video'),image=$('reference'),canvas=$('signal');
const events=[];const started=performance.now();
let selected=PRESETS[0],customUrl=null,customEpoch=0,sourcePreset=null,originals=[];
let muted=false,mediaEpoch=0,signalFrame=null,signalOscillator=null,audioContext=null,audioDestination=null,mediaAudio=null;
let recorder=null,recordCanvas=null,recordFrame=null,captureStream=null,takeUrl=null,recordChunks=[];
let mockLockRelease=null;
const status=text=>{$('status-text').textContent=text;};
const clearError=()=>{$('visible-error').hidden=true;$('visible-error').textContent='';};
function error(text,code,mode='demo'){$('visible-error').hidden=false;$('visible-error').textContent=text;log('error',mode,{code});}
function log(stage,mode='demo',extra={}){
  const entry=diagnostic({stage,mode,elapsedMs:performance.now()-started,...extra});events.push(entry);
  if(events.length>150)events.shift();renderLog();
}
function renderLog(){
  $('events').replaceChildren(...events.slice().reverse().map(e=>{
    const row=document.createElement('li');
    for(const [className,text] of [['event-time',(e.elapsedMs/1000).toFixed(1)+'s'],['event-mode',e.mode.toUpperCase()],['event-stage',e.stage.replaceAll('_',' ')+(e.code?' · '+e.code:'')]]){
      const span=document.createElement('span');span.className=className;span.textContent=text;row.append(span);
    }return row;
  }));$('log-count').textContent=events.length+' EVENTS';
}
function recipe(){return composeRecipe({presetId:selected.id,genre:$('genre').value,direction:$('direction').value,custom:Boolean(customUrl)});}
function updateRecipe(){
  const r=recipe();$('composed-prompt').textContent=r.prompt;$('override-note').hidden=!r.musicOverride;
  $('music-hint').textContent=r.musicOverride?'Your MUSIC section will be used instead of this genre.':'A starting point for your new scene. Instrumental by default.';
  $('preview-summary').hidden=true;
  if(sourcePreset&&!video.hidden)$('now-note').textContent='Recorded example · original '+sourcePreset.name+' picture and soundtrack. Your new direction is ready to preview.';
}
function mediaMode(mode,title,note){
  $('screen-mode').textContent=mode;$('now-title').textContent=title;$('now-note').textContent=note;
}
function stopCapture(){
  if(recorder?.state==='recording')recorder.stop();
}
function stopSignal(){
  cancelAnimationFrame(signalFrame);signalFrame=null;
  try{signalOscillator?.stop();}catch{}
  signalOscillator=null;
}
function stopPlayback(){
  mediaEpoch++;stopCapture();stopSignal();video.pause();video.hidden=true;canvas.hidden=true;
  image.hidden=false;$('screen-caption').hidden=false;$('media-badge').textContent='STILL FRAME';
  $('stop-playback').disabled=true;$('record').disabled=true;
}
function showStill(){
  stopPlayback();sourcePreset=null;
  image.src=customUrl||selected.image;
  image.alt=customUrl?'Your locally selected reference image.':selected.visual;
  $('screen-title').textContent=customUrl?'Your world, your direction.':selected.name;
  $('screen-subtitle').textContent=customUrl?'Start with one idea. Give it somewhere to go.':selected.detail;
  $('screen-caption').querySelector('span').textContent=customUrl?'LOCAL IMAGE / YOUR NEXT SCENE':'DEEP OCEAN / '+selected.number;
  $('channel-id').textContent=customUrl?'CUSTOM / LOCAL IMAGE':'CH '+selected.number+' / DEEP OCEAN';
  $('play-example').disabled=Boolean(customUrl)||mock.active||mock.unresolved;
  $('play-example').innerHTML=customUrl?'No recorded example yet':'<span aria-hidden="true">▶</span> Play recorded example';
  mediaMode('REFERENCE IMAGE',customUrl?'Your image · local preview':'Reference image · Deep Ocean / '+originalName(selected.id),customUrl?'This upload stays on your device. No generated result exists yet.':'Your direction creates a new recipe. The example keeps its original picture and soundtrack.');
}
function originalName(id){return {caustics:'Caustics',rays:'God rays',fog:'Fog'}[id]||id;}
function updateOriginal(){
  const original=originals.find(x=>x.id===selected.id);
  $('source-description').textContent='Deep Ocean / '+originalName(selected.id)+' · original Krea H3 performance, about 5 seconds. Its progressive house / techno soundtrack stays unchanged when you edit the music menu.';
  $('source-link').href=original?.originalVideo||selected.video;
  $('original-prompt').textContent=original?original.model+'\nSelected duration: '+original.selectedSeconds+' seconds\n'+original.note:'Original recording metadata is loading.';
  $('save-original').href=selected.video;$('save-original').download='deep-ocean-'+selected.id+'.mp4';
}
function choosePreset(preset){
  if(mock.active||mock.unresolved)return;
  customEpoch++;if(customUrl)URL.revokeObjectURL(customUrl);customUrl=null;
  selected=preset;$('image-upload').value='';$('upload-label').textContent='Or bring your own image';
  $('genre').value=preset.genre;$('direction').value=preset.direction;
  for(const button of document.querySelectorAll('.preset'))button.setAttribute('aria-pressed',String(button.dataset.id===preset.id));
  clearError();showStill();updateRecipe();updateOriginal();log('input_changed','demo',{assetId:preset.id});
  status('Image selected. Edit the direction, or play its original example.');
}
async function activateAudio(){
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return false;
  if(!audioContext)audioContext=new Context();
  if(audioContext.state!=='running')await audioContext.resume();
  return audioContext.state==='running';
}
async function playExample(){
  if(customUrl||mock.active||mock.unresolved)return;
  clearError();stopPlayback();const epoch=mediaEpoch;sourcePreset=selected;
  image.hidden=true;canvas.hidden=true;video.hidden=false;$('screen-caption').hidden=true;
  $('media-badge').textContent='DEMO / RECORDED';$('stop-playback').disabled=false;
  video.src=sourcePreset.video;video.muted=muted;video.loop=false;
  mediaMode('RECORDED EXAMPLE','Recorded example · Deep Ocean / '+originalName(sourcePreset.id),'Original Krea H3 picture + soundtrack. This recording was not generated from your edits.');
  log('playback_requested','recorded',{assetId:sourcePreset.id});status('Loading the original recorded example…');
  if(audioContext)activateAudio().catch(()=>{});
  try{
    await video.play();if(epoch!==mediaEpoch)return;
    $('record').disabled=false;
    status('Playing recorded example. Edit a direction for what you would make next.');
    if(!video.muted)log('audio_playing','recorded',{assetId:sourcePreset.id});
    if('requestVideoFrameCallback' in video)video.requestVideoFrameCallback(()=>{if(epoch===mediaEpoch)log('first_frame','recorded',{assetId:sourcePreset.id});});
    else log('first_frame','recorded',{assetId:sourcePreset.id});
  }catch(e){
    if(epoch!==mediaEpoch)return;
    $('record').disabled=true;
    if(e.name==='NotAllowedError'){error('Playback needs a tap. Use the video’s play control, or try Sound off and play again.','audio_blocked','recorded');log('audio_blocked','recorded');}
    else error('The recorded clip could not play. Try again, or return to the reference image with Stop.','media_missing','recorded');
    status('Playback needs attention. Your direction is safe.');
  }
}
video.addEventListener('ended',()=>{
  stopCapture();$('record').disabled=true;log('output_finished','recorded',{assetId:sourcePreset?.id});
  status('Recorded example finished. Replay is free.');
});
video.addEventListener('error',()=>{
  if(video.hidden)return;stopCapture();$('record').disabled=true;
  error('The video file is unavailable or unsupported. Stop returns to your image; your direction is unchanged.','media_missing','recorded');
});
video.addEventListener('playing',()=>{if(!video.hidden&&!mock.active)$('record').disabled=false;});
video.addEventListener('pause',()=>{if(!recorder||recorder.state!=='recording')$('record').disabled=true;});
image.addEventListener('error',()=>error('The reference image could not load. Choose another preset or upload a PNG, JPG or WebP.','invalid_image'));

async function loadImage(file){
  if(!file)return;
  const epoch=++customEpoch;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){error('Choose a PNG, JPG or WebP image.','invalid_image');$('image-upload').value='';return;}
  if(file.size>10*1024*1024){error('That image is over 10 MB. Try a smaller copy.','image_too_large');$('image-upload').value='';return;}
  const url=URL.createObjectURL(file),probe=new Image();
  try{
    probe.src=url;await probe.decode();
    if(epoch!==customEpoch){URL.revokeObjectURL(url);return;}
    if(probe.width*probe.height>40_000_000)throw Error('Too large');
    if(customUrl)URL.revokeObjectURL(customUrl);customUrl=url;
    $('upload-label').textContent='Replace your image';
    document.querySelectorAll('.preset').forEach(b=>b.setAttribute('aria-pressed','false'));
    clearError();showStill();updateRecipe();log('input_changed');
    status('Your image is ready. It stays on this device.');
  }catch{URL.revokeObjectURL(url);if(epoch===customEpoch){error('This image could not be decoded. Try a smaller PNG, JPG or WebP.','invalid_image');$('image-upload').value='';}}
}
function preview(){
  if(mock.active||mock.unresolved)return;
  clearError();showStill();const r=recipe();$('summary-title').textContent=(customUrl?'Your image':selected.name)+' / '+r.genreLabel;
  $('summary-direction').textContent=r.direction||'One clear gesture, then a pause.';$('preview-summary').hidden=false;
  status('Direction preview ready. No generation started.');log('preview_ready','demo',{assetId:customUrl?null:selected.id});
  if(matchMedia('(max-width:800px)').matches)$('preview-summary').scrollIntoView({behavior:'auto',block:'center'});
}
function download(data,name,type='application/json'){
  try{
    const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);
    log('exported');status('Download prepared. Your browser saves the file.');
  }catch{error('The download could not be prepared. Try Copy instead.','export_failed');}
}
async function copy(text){try{await navigator.clipboard.writeText(text);status('Copied.');}catch{error('Clipboard access is unavailable. Use the download button instead.','export_failed');}}
function exportedLog(){return JSON.stringify({application:'Reactor MTV',version:VERSION,mode:'demo',reactorSdk:'not-installed',reactorSessionRequests:0,events},null,2);}
function drawSignal(t){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors=['#eee9d9','#eceb49','#66e5e5','#46bb6f','#f85c9c','#ed5351','#4c65bb'];
  colors.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(i*w/7,0,w/7+1,h);});
  ctx.fillStyle='#111';ctx.fillRect(0,h*.67,w,h*.33);
  ctx.fillStyle='#f2f0e5';ctx.font='bold 34px monospace';ctx.fillText('PICTURE + SOUND TEST',44,h*.8);
  ctx.font='18px monospace';ctx.fillStyle='#a9b1a0';ctx.fillText('SYNTHETIC SIGNAL / NO REACTOR SESSION',44,h*.88);
  ctx.beginPath();ctx.arc(reduced?w*.5:(.5+.32*Math.sin(t/1800))*w,h*.33,40,0,Math.PI*2);ctx.fillStyle='#111';ctx.fill();
  signalFrame=requestAnimationFrame(drawSignal);
}
function startSignal(){
  stopPlayback();image.hidden=true;video.hidden=true;canvas.hidden=false;$('screen-caption').hidden=true;
  $('media-badge').textContent='SYNTHETIC TEST';mediaMode('SYNTHETIC SIGNAL','Synthetic picture + tone','Connection rehearsal only. This pattern is drawn locally, not generated from your direction.');
  signalFrame=requestAnimationFrame(t=>{drawSignal(t);log('first_frame','synthetic');});
  if(audioContext?.state==='running'&&!muted){
    const gain=audioContext.createGain();gain.gain.value=.025;gain.connect(audioContext.destination);
    signalOscillator=audioContext.createOscillator();signalOscillator.frequency.value=220;signalOscillator.connect(gain);signalOscillator.start();
    log('audio_playing','synthetic');
  }
}
function freezeInputs(frozen){
  for(const el of document.querySelectorAll('.preset,#image-upload,#preview,#play-example,#genre,#direction'))el.disabled=frozen||el.id==='play-example'&&Boolean(customUrl);
  $('run-mock').disabled=frozen;$('cancel-mock').disabled=!mock.active;$('resolve-mock').hidden=!mock.unresolved;
}
const mock=new MockAdapter(e=>{
  events.push(e);if(events.length>150)events.shift();renderLog();
  const messages={request_accepted:'Simulation: request accepted. No model session exists.',generating:'Simulation: preparing a passage…',clip_ready:'Simulation: clip ready; playback has not started.',playback_requested:'Simulation: playing a local test pattern.',closing:'Simulation: closing the mock attempt…',closed:'Simulation closed. No Reactor session was created.',error:'Simulated generation error. Closed without a retry.',timeout:'Simulated timeout. Closed without a retry.',closure_unknown:'Simulation: closure is unconfirmed. Another attempt is blocked.',duplicate_blocked:'Another simulation is active or its closure is unresolved.'};
  if(messages[e.stage])status(messages[e.stage]);
  if(e.stage==='request_accepted'){clearError();freezeInputs(true);}
  if(e.stage==='playback_requested')startSignal();
  if(e.stage==='error'||e.stage==='timeout'){$('visible-error').hidden=false;$('visible-error').textContent=e.stage==='error'?'Simulated failure: generation did not complete. This is a test; no credits were used.':'Simulated timeout: the result missed the limit. This is a test; no automatic retry follows.';}
  if(e.stage==='closure_unknown'){
    stopSignal();$('visible-error').hidden=false;$('visible-error').textContent='Synthetic cleanup failure. A new test is blocked until you click Confirm mock closure.';freezeInputs(true);
  }
  if(e.stage==='closed'){
    showStill();freezeInputs(false);mockLockRelease?.();mockLockRelease=null;
    if(events.slice(-5).some(x=>x.stage==='closure_confirmed'))clearError();
  }
});
async function runMock(){
  if(mock.active||mock.unresolved){log('duplicate_blocked','synthetic');return;}
  stopPlayback();clearError();
  activateAudio().catch(()=>log('audio_blocked','synthetic',{code:'audio_blocked'}));
  if(navigator.locks){
    await navigator.locks.request('reactor-mtv-mock',{ifAvailable:true},async lock=>{
      if(!lock){status('A simulation is running in another tab. Finish that test first.');log('duplicate_blocked','synthetic');return;}
      await new Promise(resolve=>{mockLockRelease=resolve;if(!mock.start($('scenario').value))resolve();});
    });
  }else mock.start($('scenario').value);
}
async function recordExample(){
  if(recorder?.state==='recording'){stopCapture();return;}
  if(video.hidden||video.paused||mock.active)return;
  clearError();const epoch=mediaEpoch;
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){error('Recording is not supported in this browser. Download the original example instead.','recording_unavailable');return;}
  try{
    const audioReady=await activateAudio();if(epoch!==mediaEpoch||video.paused)return;
    if(!audioReady)throw Error('Audio unavailable');
    if(!mediaAudio){mediaAudio=audioContext.createMediaElementSource(video);mediaAudio.connect(audioContext.destination);audioDestination=audioContext.createMediaStreamDestination();mediaAudio.connect(audioDestination);}
    recordCanvas=document.createElement('canvas');recordCanvas.width=video.videoWidth;recordCanvas.height=video.videoHeight;
    const ctx=recordCanvas.getContext('2d');
    const paint=()=>{ctx.drawImage(video,0,0,recordCanvas.width,recordCanvas.height);recordFrame=requestAnimationFrame(paint);};paint();
    captureStream=new MediaStream([...recordCanvas.captureStream(24).getVideoTracks(),...audioDestination.stream.getAudioTracks().map(t=>t.clone())]);
    const type=['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(x=>MediaRecorder.isTypeSupported(x));
    if(!type)throw Error('Encoding unavailable');
    recordChunks=[];recorder=new MediaRecorder(captureStream,{mimeType:type});
    recorder.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data);};
    recorder.onerror=()=>{log('capture_failed','recorded');error('Recording failed. The original example is still available to download.','recording_unavailable');stopCapture();};
    recorder.onstop=()=>{
      cancelAnimationFrame(recordFrame);captureStream?.getTracks().forEach(t=>t.stop());
      $('record').textContent='Record example';$('record').disabled=video.paused||video.hidden;recorder=null;
      const blob=new Blob(recordChunks,{type});recordChunks=[];
      if(blob.size){
        if(takeUrl)URL.revokeObjectURL(takeUrl);takeUrl=URL.createObjectURL(blob);$('save-take').href=takeUrl;$('save-take').download='reactor-mtv-take.'+(type.includes('mp4')?'mp4':'webm');$('save-take').hidden=false;
        log('capture_saved','recorded',{bytes:blob.size});status('Your local take is ready. Save it before closing the page.');
      }else{log('capture_failed','recorded');error('The recording was empty. Start recording while the example is playing.','recording_unavailable');}
    };
    recorder.start(200);$('record').textContent='Stop recording';log('recording_started','recorded');status('Recording the original example locally. The recording ends when the clip ends.');
  }catch{cancelAnimationFrame(recordFrame);captureStream?.getTracks().forEach(t=>t.stop());error('Recording could not start here. You can still download the original example.','recording_unavailable');log('capture_failed','recorded');}
}
for(const preset of PRESETS){
  const button=document.createElement('button');button.type='button';button.className='preset';button.dataset.id=preset.id;button.setAttribute('aria-label',preset.name);button.setAttribute('aria-pressed',String(preset===selected));
  const thumb=document.createElement('img');thumb.src=preset.image;thumb.alt='';
  const number=document.createElement('span');number.className='preset-num';number.textContent=preset.number;
  const name=document.createElement('span');name.className='preset-name';name.textContent=preset.name;
  button.append(thumb,number,name);button.addEventListener('click',()=>choosePreset(preset));document.querySelector('.presets').append(button);
}
for(const [value,genre] of Object.entries(GENRES)){const option=document.createElement('option');option.value=value;option.textContent=genre.name;$('genre').append(option);}
$('genre').value=selected.genre;$('direction').value=selected.direction;
$('genre').addEventListener('change',()=>{updateRecipe();log('input_changed');});
$('direction').addEventListener('input',updateRecipe);
$('image-upload').addEventListener('change',e=>loadImage(e.target.files?.[0]));
$('preview').addEventListener('click',preview);
$('play-example').addEventListener('click',playExample);
$('stop-playback').addEventListener('click',()=>{showStill();status('Playback stopped. Your direction is ready.');});
$('audio').addEventListener('click',()=>{
  muted=!muted;video.muted=muted;$('audio').textContent=muted?'Sound off':'Sound on';$('audio').setAttribute('aria-pressed',String(muted));
  if(muted&&signalOscillator){try{signalOscillator.stop();}catch{}signalOscillator=null;}
  if(!muted&&audioContext)activateAudio().catch(()=>log('audio_blocked'));
});
$('copy-prompt').addEventListener('click',()=>copy(recipe().prompt));
$('save-recipe').addEventListener('click',()=>download(JSON.stringify(recipe(),null,2),'reactor-mtv-recipe.json'));
$('copy-log').addEventListener('click',()=>copy(exportedLog()));
$('download-log').addEventListener('click',()=>download(exportedLog(),'reactor-mtv-diagnostics.json'));
$('run-mock').addEventListener('click',runMock);
$('cancel-mock').addEventListener('click',()=>mock.cancel());
$('resolve-mock').addEventListener('click',()=>mock.confirmMockClosure());
$('record').addEventListener('click',recordExample);
window.addEventListener('pagehide',()=>{mock.cancel();stopPlayback();mockLockRelease?.();if(customUrl)URL.revokeObjectURL(customUrl);if(takeUrl)URL.revokeObjectURL(takeUrl);audioContext?.close();});
updateRecipe();updateOriginal();log('ready');
fetch('original-recipes.json').then(r=>{if(!r.ok)throw Error('Unavailable');return r.json();}).then(data=>{originals=data;updateOriginal();}).catch(()=>{$('original-prompt').textContent='Recording metadata unavailable. The original video remains available above.';});
