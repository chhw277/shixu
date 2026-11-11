import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import engine from 'web-audio-engine';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const directory=await mkdtemp(join(tmpdir(),'shixu-liquid-test-'));
execFileSync(process.execPath,[fileURLToPath(new URL('../node_modules/typescript/bin/tsc',import.meta.url)),'--ignoreConfig','--target','ES2022','--module','ES2022','--moduleResolution','Bundler','--skipLibCheck','--outDir',directory,'src/liquid-theme/audio.ts','src/liquid-theme/geometry.ts']);
for(const file of ['geometry','audio']){
 const source=await readFile(join(directory,`${file}.js`),'utf8');
 await writeFile(join(directory,`${file}.mjs`),source.replaceAll("'./geometry'","'./geometry.mjs'"));
}
const {LiquidAudio,readSoundSettings}=await import(pathToFileURL(join(directory,'audio.mjs')));
const {liquidPath,phaseAt}=await import(pathToFileURL(join(directory,'geometry.mjs')));
class Param { value=0; calls=[]; setValueAtTime(v){this.value=v;this.calls.push(v);}linearRampToValueAtTime(v){this.calls.push(v);}exponentialRampToValueAtTime(v){this.calls.push(v);}setTargetAtTime(v){this.calls.push(v);} }
class Node { disconnected=false;connect(node){return node;}disconnect(){this.disconnected=true;} }
class Source extends Node {frequency=new Param();started=false;stopped=false;start(){this.started=true;}stop(){this.stopped=true;} }
class Context {
 state='running';currentTime=0;sampleRate=1000;destination=new Node();sources=[];nodes=[];
 createGain(){const n=Object.assign(new Node(),{gain:new Param()});this.nodes.push(n);return n;}
 createBiquadFilter(){const n=Object.assign(new Node(),{frequency:new Param(),Q:new Param()});this.nodes.push(n);return n;}
 createOscillator(){const n=new Source();n.oscillator=true;this.sources.push(n);return n;}
 createBufferSource(){const n=new Source();this.sources.push(n);return n;}
 createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)};}
 async resume(){this.state='running';}
}
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.localStorage={getItem:()=>null};
const frame=(progress,target='dark')=>({progress,phase:phaseAt(progress),target,reducedMotion:false});
function make(settings={enabled:true,volume:.3}){const context=new Context(),audio=new LiquidAudio(settings,context);return {context,audio};}
test('sound is opt-in, validates storage and never constructs an AudioContext while disabled',()=>{
 assert.deepEqual(readSoundSettings(),{enabled:false,volume:.28});
 localStorage.getItem=()=>'{"enabled":true,"volume":99}';assert.deepEqual(readSoundSettings(),{enabled:true,volume:1});
 localStorage.getItem=()=>'{bad';assert.deepEqual(readSoundSettings(),{enabled:false,volume:.28});localStorage.getItem=()=>null;
 const {context,audio}=make({enabled:false,volume:.3});audio.begin('dark',false);audio.update(frame(.4));assert.equal(context.sources.length,0);
});
test('phases trigger once, and interruption stops/disconnects every voice without a finish sound',()=>{
 const {context,audio}=make();audio.begin('dark',false);audio.update(frame(.01));assert.equal(context.sources.length,2);
 audio.update(frame(.1));assert.equal(context.sources.length,2);
 audio.update(frame(.25));assert.equal(context.sources.length,5);
 audio.update(frame(.8));assert.equal(context.sources.length,5);
 audio.stop('interrupted');assert.equal(context.sources.length,5);assert.ok(context.sources.every(s=>s.stopped&&s.disconnected));assert.ok(context.nodes.slice(1).every(n=>n.disconnected));
 audio.dispose();assert.ok(context.nodes[0].disconnected);
});
test('successful completion has one short tail, a new run cancels all previous sources',()=>{
 const {context,audio}=make();audio.begin('light',false);audio.update(frame(.4,'light'));audio.stop('complete');
 assert.equal(context.sources.length,4);const tail=context.sources.at(-1);assert.equal(tail.frequency.calls[0],720);
 audio.stop('complete');assert.equal(context.sources.length,4);
 audio.begin('dark',false);audio.update(frame(.02));assert.ok(tail.stopped&&tail.disconnected);
 audio.dispose();assert.ok(context.sources.every(s=>s.stopped&&s.disconnected));
});
test('zero volume and disabling stop ongoing water immediately; reduced motion has only short feedback',()=>{
 for(const change of [{enabled:false,volume:.4},{enabled:true,volume:0}]){
  const {context,audio}=make();audio.begin('dark',false);audio.update(frame(.5));audio.setSettings(change);audio.stop('complete');assert.equal(context.sources.length,3);assert.ok(context.sources.every(s=>s.stopped&&s.disconnected));audio.dispose();
 }
 const {context,audio}=make();audio.begin('dark',true);audio.update({...frame(1),reducedMotion:true});assert.equal(context.sources.length,0);audio.stop('complete');assert.equal(context.sources.length,1);assert.equal(context.sources[0].frequency.calls[0],310);audio.dispose();
});
test('background, unlock rejection and unavailable audio never throw or leave flowing sources',async()=>{
 const {context,audio}=make();audio.begin('dark',false);audio.update(frame(.5));document.hidden=true;audio.stop('interrupted');assert.equal(context.sources.length,3);assert.ok(context.sources.every(s=>s.stopped));document.hidden=false;
 context.state='suspended';context.resume=()=>Promise.reject(Error('blocked'));audio.begin('dark',false);audio.update(frame(.5));await new Promise(resolve=>setImmediate(resolve));assert.equal(context.sources.length,3);audio.dispose();
 const unavailable=new LiquidAudio({enabled:true,volume:.3});assert.doesNotThrow(()=>{unavailable.begin('light',false);unavailable.update(frame(.5));unavailable.stop('complete');unavailable.dispose();});
});
test('reduced-motion feedback can unlock asynchronously and gets canceled by unmount',async()=>{
 for(const canceled of [false,true]){
  const {context,audio}=make();let unlock;context.state='suspended';context.resume=()=>new Promise(resolve=>{unlock=()=>{context.state='running';resolve();};});
  audio.begin('light',true);audio.stop('complete');if(canceled)audio.dispose();unlock();await new Promise(resolve=>setImmediate(resolve));assert.equal(context.sources.length,canceled?0:1);audio.dispose();
 }
});
test('liquid geometry stays finite across tall/narrow views and covers every corner on completion',()=>{
 for(const [w,h,x,y] of [[390,844,330,50],[1380,880,1100,60],[768,1024,4,940],[320,1200,500,-20]]){
  for(let i=0;i<=100;i++){const path=liquidPath(i/100,w,h,x,y);assert.ok(!/NaN|Infinity/.test(path));assert.ok(path.startsWith('M'));}
  assert.equal(liquidPath(1,w,h,x,y),`M0 0H${w}V${h}H0Z`);
 }
});

const bootstrap=await readFile(new URL('../public/theme-init.js',import.meta.url),'utf8');
test('blocking bootstrap resolves persisted light/dark/system before React and handles denied storage',()=>{
 for(const [stored,cached,dark,expected] of [[{theme:'dark',accent:'green'},null,false,'dark'],[{theme:'light'}, {theme:'dark'},true,'light'],[null,{theme:'system'},true,'dark'],[null,{theme:'system'},false,'light'],[null,null,true,'light']]){
  const html={dataset:{},style:{setProperty(name,value){this[name]=value;}}};
  runInNewContext(bootstrap,{document:{documentElement:html},matchMedia:()=>({matches:dark}),localStorage:{getItem:key=>JSON.stringify(key==='shixu-state-v1'?(stored?{settings:stored}:null):cached)}});
  assert.equal(html.dataset.theme,expected);if(stored?.accent==='green')assert.equal(html.style['--accent'],'#267d6b');
 }
 const html={dataset:{}};runInNewContext(bootstrap,{document:{documentElement:html},localStorage:{getItem(){throw Error('denied');}}});assert.equal(html.dataset.theme,'light');
});

test('actual offline Web Audio output is audible digitally at default volume and does not clip at maximum',async()=>{
 for(const target of ['dark','light'])for(const volume of [.28,1]){
  const context=new engine.RenderingAudioContext({sampleRate:44100,numberOfChannels:1});await context.resume();
  const sound=new LiquidAudio({enabled:true,volume},context);sound.begin(target,false);
  for(let i=0;i<168;i++){sound.update(frame(i/168,target));context.processTo((i+1)/60);}
  sound.stop('complete');context.processTo(3.05);sound.dispose();
  const samples=context.exportAsAudioData().channelData[0];let peak=0,power=0;
  for(const value of samples){peak=Math.max(peak,Math.abs(value));power+=value*value;}
  const rms=Math.sqrt(power/samples.length);
  assert.ok(rms>.006,`${target} ${volume}: insufficient digital RMS ${rms}`);
  assert.ok(peak<.95,`${target} ${volume}: clipping risk ${peak}`);
 }
});
