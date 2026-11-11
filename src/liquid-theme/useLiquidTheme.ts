import { useCallback, useEffect, useRef } from 'react';
import { clamp, liquidPath, phaseAt } from './geometry';
import { createSnapshot } from './snapshot';
import type { LiquidSoundAdapter, LiquidThemeOptions, StopReason, Theme } from './types';
let serial=0;
const safe=(action:()=>void)=>{try{action();}catch{ /* An optional sound adapter must never block a theme change. */ }};
export function useLiquidTheme(options: LiquidThemeOptions) {
  const latest=useRef(options);latest.current=options;
  const run=useRef<{ target:Theme; from:Theme; end:(reason:StopReason)=>void; preview:boolean }|null>(null);
  const begin=useCallback((target:Theme,anchor?:HTMLElement|null,preview=false)=>{
    if(run.current){if(run.current.preview&&!preview)run.current.end('interrupted');else return false;}
    const current=latest.current;
    if(!preview&&target===current.theme)return false;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sound:LiquidSoundAdapter|undefined=current.sound;
    const commit=()=>{document.documentElement.dataset.theme=target;current.onThemeChange(target);};
    const direct=()=>{safe(()=>sound?.begin(target,true));if(!preview)commit();safe(()=>sound?.update({progress:1,phase:'complete',target,reducedMotion:true}));safe(()=>sound?.stop('complete'));};
    if(document.hidden){if(!preview)commit();return true;}
    const root=current.root();
    if(reduced||!CSS.supports('clip-path','url("#liquid-support")')||!root||!('SVGClipPathElement' in window)) { direct();return true; }
    const w=window.innerWidth,h=window.innerHeight;
    // Exactly one layout measurement, at start. Every frame below writes one path attribute.
    const rect=(anchor||document.querySelector<HTMLElement>('[data-theme-toggle]'))?.getBoundingClientRect();
    const x=rect?rect.left+rect.width/2:w*.8,y=rect?rect.bottom:48;
    let snapshot:ReturnType<typeof createSnapshot>=null;
    try{snapshot=preview?null:createSnapshot(root,target);}catch{direct();return true;}
    if(!preview&&!snapshot){direct();return true;}
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    const defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),path=document.createElementNS(ns,'path');
    const id=`liquid-clip-${++serial}`;
    svg.classList.add('liquid-defs');svg.setAttribute('aria-hidden','true');
    clip.id=id;clip.setAttribute('clipPathUnits','userSpaceOnUse');path.setAttribute('d','M0 0Z');clip.append(path);defs.append(clip);svg.append(defs);
    if(snapshot){document.body.append(svg);snapshot.layer.style.clipPath=`url("#${id}")`;}
    let frame=0,ended=false;
    const listeners:Array<()=>void>=[];
    const listen=(target:EventTarget,type:string,handler:EventListener,options?:AddEventListenerOptions)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
    const end=(reason:StopReason)=>{
      if(ended)return;ended=true;cancelAnimationFrame(frame);listeners.forEach(off=>off());
      // Commit synchronously under the fully revealed copy, before removing it.
      try{if(!preview&&reason!=='unmount')commit();}
      finally{snapshot?.dispose();svg.remove();run.current=null;safe(()=>sound?.stop(reason));}
    };
    run.current={target,from:current.theme,end,preview};
    const interrupt=()=>end('interrupted');
    const pointer=(event:Event)=>{
      const el=event.target instanceof Element?event.target:null;
      if(el?.closest('[data-theme-toggle]'))return; // Repeated toggle clicks are intentionally ignored.
      interrupt();
    };
    listen(window,'resize',interrupt);listen(window,'orientationchange',interrupt);
    if(window.visualViewport){listen(window.visualViewport,'resize',interrupt);listen(window.visualViewport,'scroll',interrupt);}
    // Restoring the inert copy's scroll offsets queues native scroll events.
    // Only movement of the real page should interrupt the reveal.
    listen(document,'scroll',event=>{
      if(event.target instanceof Element&&event.target.closest('.liquid-reveal'))return;
      interrupt();
    },{capture:true,passive:true});
    listen(document,'visibilitychange',()=>{if(document.hidden)interrupt();});
    listen(window,'pagehide',interrupt);
    listen(document,'pointerdown',pointer,{capture:true});
    // Let React record a native input/change event before committing a theme update.
    // Committing from document capture can reset a controlled field before onChange runs.
    const afterInput=()=>queueMicrotask(interrupt);
    listen(document,'input',afterInput,{capture:true});listen(document,'change',afterInput,{capture:true});
    listen(document,'keydown',(event)=>{const e=event as KeyboardEvent;if(e.target instanceof Element&&e.target.closest('[data-theme-toggle]')&&['Enter',' '].includes(e.key))return;if(!['Shift','Control','Alt','Meta'].includes(e.key))interrupt();},{capture:true});
    const motion=matchMedia('(prefers-reduced-motion: reduce)');listen(motion,'change',interrupt);
    safe(()=>sound?.begin(target,false));
    const duration=preview?1450:clamp(Number.isFinite(current.duration)?current.duration!:2800,600,12000);
    const start=performance.now();
    const tick=(now:number)=>{
      if(ended)return;
      try{
        const progress=clamp((now-start)/duration);
        if(snapshot)path.setAttribute('d',liquidPath(progress,w,h,x,y));
        safe(()=>sound?.update({progress,phase:phaseAt(progress),target,reducedMotion:false}));
        if(progress>=1)end('complete');else frame=requestAnimationFrame(tick);
      }catch{end('interrupted');}
    };
    frame=requestAnimationFrame(tick);return true;
  },[]);
  useEffect(()=>()=>{run.current?.end('unmount');safe(()=>latest.current.sound?.stop('unmount'));},[]);
  // A controlled change from outside this hook supersedes the in-flight request.
  useEffect(()=>{if(run.current&&options.theme!==run.current.from)run.current.end('unmount');if(!run.current)document.documentElement.dataset.theme=options.theme;},[options.theme]);
  return {
    requestTheme:useCallback((target:Theme,anchor?:HTMLElement|null)=>begin(target,anchor),[begin]),
    previewSound:useCallback(()=>begin(latest.current.theme,undefined,true),[begin]),
    interrupt:useCallback(()=>run.current?.end('interrupted'),[]),
  };
}
