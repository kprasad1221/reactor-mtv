export const VERSION='0.1.0';
export const GENRES={
  house:{name:'House',music:'Atmospheric progressive house, around 127 BPM in 4/4. A firm kick, warm pulsing bass, bright answering synth phrases and spacious chords. Instrumental.'},
  'synth-pop':{name:'Synth-pop',music:'Dreamy synth-pop, around 110 BPM in 4/4. A recognizable warm synth melody, rounded bass, crisp drums and shimmering answering phrases. Instrumental.'},
  synthwave:{name:'Synthwave',music:'Cinematic synthwave, around 100 BPM in 4/4. Analog arpeggios, deep bass, spacious drums and a luminous melody with room to breathe. Instrumental.'},
  rock:{name:'Psychedelic rock',music:'Psychedelic rock, around 95 BPM in 4/4. Echoing guitar, warm bass and a relaxed live drum groove. A recurring melodic figure grows and answers itself. Instrumental.'},
  ambient:{name:'Ambient',music:'Slow atmospheric ambient, around 70 BPM in 4/4. Evolving pads, delicate plucked notes and long breathing spaces. Soft swells return as a recognizable phrase. Instrumental.'},
  dnb:{name:'Drum and bass',music:'Liquid drum and bass, around 170 BPM in 4/4. Flowing breakbeats, rounded sub bass, airy chords and a recognizable gliding melody. Instrumental.'}
};
export const PRESETS=[
  {id:'caustics',number:'01',name:'Pool of light',world:'Deep Ocean',detail:'Water leads. Architecture answers.',genre:'house',image:'media/caustics.png',video:'media/caustics.mp4',visual:'A vast underwater conservatory with cyan pools, deep sapphire shadows, amber branches and a violet canopy.',direction:'Send a bright blue pulse across the pool. Let its light climb the surrounding arches, then answer with a warm golden glow.'},
  {id:'rays',number:'02',name:'Light from above',world:'Deep Ocean',detail:'A sunbeam takes the long way home.',genre:'ambient',image:'media/rays.png',video:'media/rays.mp4',visual:'An underwater hall filled with pale ice-blue sunbeams, sapphire water, amber stone and dimensional shadows.',direction:'Bring a broad shaft of sunlight through the distant doorway, across the columns and into the foreground. Let the water answer softly.'},
  {id:'fog',number:'03',name:'Violet afterhours',world:'Deep Ocean',detail:'A slower, stranger kind of dance.',genre:'synthwave',image:'media/fog.png',video:'media/fog.mp4',visual:'A radiant sunken conservatory with lavender mist drifting through cyan pools, golden lamps and dark stone arches.',direction:'Let violet mist breathe across the pool, curl around the terraces and open into a clear passage. Keep the golden lamps glowing through it.'}
];
export function composeRecipe({presetId,genre,direction,custom=false}){
  const preset=PRESETS.find(x=>x.id===presetId)||PRESETS[0];
  const choice=GENRES[genre]||GENRES.house;
  const text=String(direction||'').trim().slice(0,1800);
  const split=text.match(/(?:^|\n)\s*MUSIC\s*:\s*([\s\S]*)$/i);
  const explicit=split?.[1]?.trim();
  const visualDirection=split?text.slice(0,split.index).trim():text;
  const music=explicit||choice.music;
  const visual=custom?'Use the selected image as the visual reference. Preserve its recognizable subjects, setting and palette.':preset.visual;
  const prompt=`VISUAL\n${visual}\n${visualDirection||'Let one clear light gesture travel through the scene, then settle.'}\nDevelop one legible action with an onset, crest, decay and a pause. No text or whole-frame flashes.\n\nMUSIC\n${music}`;
  return {schemaVersion:1,mode:'demo',presetId:custom?null:preset.id,image:{kind:custom?'local-upload':'preset',assetId:custom?'local-image':preset.id,filename:custom?null:preset.image},genre,genreLabel:explicit?'Your music direction':choice.name,musicOverride:Boolean(explicit),direction:text,prompt,requestedSeconds:5.875,generated:false};
}
const STAGES=new Set(['ready','input_changed','preview_ready','request_accepted','generating','clip_ready','playback_requested','first_frame','audio_playing','audio_blocked','output_finished','cancel_requested','closing','closed','error','timeout','closure_unknown','closure_confirmed','duplicate_blocked','recording_started','capture_saved','capture_failed','exported']);
const MODES=new Set(['demo','recorded','synthetic']);
const CODES=new Set(['media_missing','invalid_image','image_too_large','audio_blocked','simulated_error','simulated_timeout','cleanup_unconfirmed','export_failed','recording_unavailable']);
export function diagnostic(event){
  const output={mode:MODES.has(event.mode)?event.mode:'demo',stage:STAGES.has(event.stage)?event.stage:'error'};
  if(Number.isFinite(event.elapsedMs))output.elapsedMs=Math.max(0,Math.round(event.elapsedMs));
  if(Number.isFinite(event.bytes))output.bytes=Math.max(0,Math.round(event.bytes));
  if(typeof event.attemptId==='string'&&/^mock-[a-f0-9-]{1,40}$/.test(event.attemptId))output.attemptId=event.attemptId;
  if(PRESETS.some(x=>x.id===event.assetId))output.assetId=event.assetId;
  if(CODES.has(event.code))output.code=event.code;
  return output;
}
export class MockAdapter{
  constructor(emit,{schedule=(fn,ms)=>setTimeout(fn,ms),unschedule=id=>clearTimeout(id),now=()=>performance.now(),id=()=> 'mock-'+(crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''))}={}){this.emit=emit;this.schedule=schedule;this.unschedule=unschedule;this.now=now;this.id=id;this.pending=[];this.active=false;this.unresolved=false;this.epoch=0;}
  send(stage,extra={}){this.emit(diagnostic({mode:'synthetic',stage,attemptId:this.attemptId,elapsedMs:this.started?this.now()-this.started:0,...extra}));}
  start(scenario='success'){
    if(this.active||this.unresolved){this.send('duplicate_blocked');return false;}
    this.attemptId=this.id();this.active=true;this.started=this.now();this.epoch++;const epoch=this.epoch;
    this.send('request_accepted');
    const later=(ms,fn)=>this.pending.push(this.schedule(()=>{if(this.epoch===epoch&&this.active)fn();},ms));
    later(500,()=>this.send('generating'));
    if(scenario==='error')later(1400,()=>{this.send('error',{code:'simulated_error'});this.close();});
    else if(scenario==='timeout')later(3500,()=>{this.send('timeout',{code:'simulated_timeout'});this.close();});
    else if(scenario==='closure')later(2000,()=>{this.send('closing');this.clear();this.active=false;this.unresolved=true;this.send('closure_unknown',{code:'cleanup_unconfirmed'});});
    else {later(1700,()=>this.send('clip_ready'));later(2100,()=>this.send('playback_requested'));later(5500,()=>{this.send('output_finished');this.close();});}
    return true;
  }
  clear(){this.epoch++;for(const timer of this.pending)this.unschedule(timer);this.pending=[];}
  close(){this.send('closing');this.clear();this.active=false;this.send('closed');}
  cancel(){if(!this.active)return;this.send('cancel_requested');this.close();}
  confirmMockClosure(){if(!this.unresolved)return;this.unresolved=false;this.send('closure_confirmed');this.send('closed');}
}
