// Offline audition of the SAME LiquidAudio module. No browser, UI or network access.
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import engine from 'web-audio-engine';
const directory=await mkdtemp(join(tmpdir(),'shixu-audio-render-'));
execFileSync(process.execPath,[fileURLToPath(new URL('../node_modules/typescript/bin/tsc',import.meta.url)),'--ignoreConfig','--target','ES2022','--module','ES2022','--moduleResolution','Bundler','--skipLibCheck','--outDir',directory,'src/liquid-theme/audio.ts','src/liquid-theme/geometry.ts']);
for(const file of ['geometry','audio']){
 const source=await readFile(join(directory,`${file}.js`),'utf8');await writeFile(join(directory,`${file}.mjs`),source.replaceAll("'./geometry'","'./geometry.mjs'"));
}
const {LiquidAudio}=await import(pathToFileURL(join(directory,'audio.mjs')));
const {phaseAt}=await import(pathToFileURL(join(directory,'geometry.mjs')));
globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};
globalThis.window={addEventListener(){},removeEventListener(){}};
const output=resolve(process.argv[2]||'public/audio');await mkdir(output,{recursive:true});
for(const target of ['dark','light']){
 const context=new engine.RenderingAudioContext({sampleRate:44100,numberOfChannels:1});await context.resume();
 const sound=new LiquidAudio({enabled:true,volume:.28},context);sound.begin(target,false);
 const duration=2.8;
 for(let i=0;i<168;i++){const progress=i/168;sound.update({progress,phase:phaseAt(progress),target,reducedMotion:false});context.processTo((i+1)/60);}
 sound.stop('complete');context.processTo(duration+.25);sound.dispose();
 const data=context.exportAsAudioData(),samples=data.channelData[0],wav=Buffer.alloc(44+samples.length*2);
 wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(data.sampleRate,24);wav.writeUInt32LE(data.sampleRate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);
 let peak=0,power=0;for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));power+=samples[i]**2;wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);}
 const name=`liquid-to-${target}.wav`;await writeFile(join(output,name),wav);
 console.log(`${name}: ${(samples.length/data.sampleRate).toFixed(2)}s, peak ${peak.toFixed(4)}, RMS ${Math.sqrt(power/samples.length).toFixed(4)}`);
}
