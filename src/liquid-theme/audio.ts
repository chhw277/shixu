import { clamp, IMPACT } from './geometry';
import type { LiquidFrame, LiquidSoundAdapter, SoundSettings, StopReason, Theme } from './types';
let sharedContext: AudioContext | undefined;
export const SOUND_KEY='shixu-liquid-sound-v1';
// Calibrated for audible laptop playback; even 100% remains below full-scale peaks.
const OUTPUT_GAIN=6;
export function readSoundSettings(): SoundSettings {
  try { const s=JSON.parse(localStorage.getItem(SOUND_KEY)||'null'); return {enabled:s?.enabled===true,volume:typeof s?.volume==='number'&&Number.isFinite(s.volume)?clamp(s.volume):.28}; }
  catch { return {enabled:false,volume:.28}; }
}
interface Voice { source: AudioScheduledSourceNode; nodes: AudioNode[] }
/** Local synthesis only. An existing AudioContext may be injected; it is never closed here. */
export class LiquidAudio implements LiquidSoundAdapter {
  private context?: AudioContext;
  private master?: GainNode;
  private noise?: AudioBuffer;
  private voices = new Set<Voice>();
  private flow?: { gain: GainNode; filter: BiquadFilterNode };
  private stages = new Set<string>();
  private generation=0;
  private frame?: LiquidFrame;
  private target: Theme='light';
  private reduced=false;
  private active=false;
  private listening=false;
  private silence=(event:Event)=>{if(event.type==='pagehide'||document.hidden)this.stop('interrupted');};
  constructor(private settings: SoundSettings, private suppliedContext?: AudioContext) {}
  setSettings(settings: SoundSettings) {
    this.settings={...settings,volume:clamp(settings.volume)};
    if(!settings.enabled||settings.volume<=0)this.stop('interrupted');
    if(this.master&&this.context)this.master.gain.setTargetAtTime(this.settings.enabled?this.settings.volume*OUTPUT_GAIN:0,this.context.currentTime,.012);
  }
  setVolume(volume: number) { this.setSettings({...this.settings,volume}); }
  begin(target: Theme, reducedMotion: boolean) {
    this.stop('interrupted');
    if(!this.settings.enabled||this.settings.volume<=0||document.hidden)return;
    this.target=target;this.reduced=reducedMotion;this.active=true;this.stages.clear();
    if(!this.listening){document.addEventListener('visibilitychange',this.silence);window.addEventListener('pagehide',this.silence);this.listening=true;}
    const ticket=++this.generation;
    try {
      const Ctor=window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if(!Ctor&&!this.suppliedContext){this.active=false;return;}
      this.context=this.suppliedContext || (sharedContext?.state!=='closed'?sharedContext:undefined) || (sharedContext=new Ctor!());
      if(!this.master){this.master=this.context.createGain();this.master.connect(this.context.destination);}
      this.master.gain.setValueAtTime(this.settings.volume*OUTPUT_GAIN,this.context.currentTime);
      if(this.context.state!=='running')void this.context.resume().then(()=>{
        if(ticket===this.generation&&this.active&&this.frame)this.update(this.frame);
      }).catch(()=>{if(ticket===this.generation)this.stop('interrupted');});
    } catch { this.stop('interrupted'); }
  }
  private attach(source: AudioScheduledSourceNode, nodes: AudioNode[], duration?: number) {
    const voice={source,nodes};this.voices.add(voice);
    source.onended=()=>{this.voices.delete(voice);for(const node of [source,...nodes]){try{node.disconnect();}catch{ /* already disconnected */ }}};
    source.start();if(duration!==undefined)source.stop(this.context!.currentTime+duration);
  }
  private bubble(frequency: number, duration: number, gain=.09) {
    const c=this.context!,o=c.createOscillator(),g=c.createGain(),now=c.currentTime;
    o.type='sine';o.frequency.setValueAtTime(frequency,now);o.frequency.exponentialRampToValueAtTime(frequency*.48,now+duration);
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(gain,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    o.connect(g).connect(this.master!);this.attach(o,[g],duration+.015);
  }
  private water(duration: number, level: number, loop=false) {
    const c=this.context!,s=c.createBufferSource(),filter=c.createBiquadFilter(),g=c.createGain(),now=c.currentTime;
    if(!this.noise){
      this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);
      const data=this.noise.getChannelData(0);let last=0,seed=76123;
      for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;last=.94*last+.06*(seed/4294967296*2-1);data[i]=last*3;}
    }
    s.buffer=this.noise;s.loop=loop;filter.type='lowpass';filter.frequency.value=this.target==='dark'?900:1550;filter.Q.value=.65;
    g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(level,now+.035);
    if(!loop)g.gain.exponentialRampToValueAtTime(.0001,now+duration);
    s.connect(filter).connect(g).connect(this.master!);this.attach(s,[filter,g],loop?undefined:duration+.02);
    if(loop)this.flow={gain:g,filter};
  }
  update(frame: LiquidFrame) {
    this.frame=frame;
    if(!this.active||!this.context||this.context.state!=='running')return;
    try {
      if(this.reduced)return;
      const once=(key: string,action:()=>void)=>{if(!this.stages.has(key)){this.stages.add(key);action();}};
      if(frame.progress<IMPACT)once('pour',()=>{this.bubble(this.target==='dark'?380:620,.15);this.water(.19,.11);});
      if(frame.progress>=IMPACT&&frame.progress<.93){
        once('impact',()=>{this.water(.25,.2);this.bubble(this.target==='dark'?190:330,.22,.07);});
        once('rise',()=>this.water(0,.09,true));
        const now=this.context.currentTime;
        this.flow?.gain.gain.setTargetAtTime(.075+Math.sin(frame.progress*Math.PI)*.055,now,.06);
        this.flow?.filter.frequency.setTargetAtTime((this.target==='dark'?650:1100)+frame.progress*260,now,.08);
      }
      if(frame.progress>=.93&&this.flow)this.flow.gain.gain.setTargetAtTime(.0001,this.context.currentTime,.025);
    } catch { this.stop('interrupted'); }
  }
  stop(reason: StopReason) {
    const finish=reason==='complete'&&this.active&&this.settings.enabled&&this.settings.volume>0&&!document.hidden;
    this.active=false;this.generation++;this.frame=undefined;this.flow=undefined;
    for(const {source,nodes} of this.voices){source.onended=null;try{source.stop();}catch{ /* source already ended */ }for(const node of [source,...nodes]){try{node.disconnect();}catch{ /* best effort */ }}}
    this.voices.clear();
    if(finish&&this.context){
      const ticket=this.generation;
      const chime=()=>{if(ticket===this.generation&&this.context?.state==='running'&&!document.hidden){try{this.bubble(this.target==='dark'?310:720,.19,.065);}catch{ /* audio is optional */ }}};
      if(this.context.state==='running')chime();
      else void this.context.resume().then(chime).catch(()=>{});
    }
  }
  dispose() { this.stop('unmount');if(this.listening){document.removeEventListener('visibilitychange',this.silence);window.removeEventListener('pagehide',this.silence);this.listening=false;}this.master?.disconnect();this.master=undefined;this.noise=undefined; }
}
