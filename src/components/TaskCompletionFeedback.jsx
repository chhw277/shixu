import React,{useCallback,useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check} from 'lucide-react';

// Keep presentation separate from the saved task: completing a task must not wait for animation.
export function useTaskCompletionFeedback(view){
 const [effects,setEffects]=useState([]);
 const clear=useCallback(()=>setEffects([]),[]);
 useEffect(clear,[view,clear]);
 useEffect(()=>{
   if(!effects.length)return;
   const timeout=setTimeout(()=>setEffects(current=>current.filter(effect=>effect.until>Date.now())),Math.max(0,Math.min(...effects.map(effect=>effect.until))-Date.now()));
   return()=>clearTimeout(timeout);
 },[effects]);
 useEffect(()=>{
   const motion=matchMedia('(prefers-reduced-motion: reduce)');
   const interrupt=()=>clear();
   motion.addEventListener('change',interrupt);
   window.addEventListener('resize',interrupt);
   window.addEventListener('scroll',interrupt,true);
   return()=>{motion.removeEventListener('change',interrupt);window.removeEventListener('resize',interrupt);window.removeEventListener('scroll',interrupt,true);};
 },[clear]);
 const capture=useCallback(tasks=>{
   if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
   const items=new Map(tasks.filter(task=>!task.completed&&!task.deleted).map(task=>[task.id,task]));
   const next=[];
   for(const row of document.querySelectorAll('.task-row[data-task-id]')){
     const task=items.get(row.dataset.taskId);if(!task)continue;
     const rect=row.getBoundingClientRect(),check=row.querySelector('.check-box')?.getBoundingClientRect();
     const bounds=row.closest('.main-body,.overlay')?.getBoundingClientRect();
     if(!check||!rect.width||rect.bottom<=Math.max(0,bounds?.top||0)||rect.top>=Math.min(innerHeight,bounds?.bottom||innerHeight))continue;
     next.push({id:crypto.randomUUID(),title:task.title,until:Date.now()+600,
       style:{left:rect.left,top:rect.top,width:rect.width,height:rect.height,'--check-x':`${check.left-rect.left}px`,'--check-y':`${check.top-rect.top}px`}});
     if(next.length===8)break;
   }
   setEffects(current=>[...current,...next].slice(-8));
 },[]);
 return {effects,capture,clear};
}

export default function TaskCompletionFeedback({effects}){
 return createPortal(<div className="task-completion-effects" aria-hidden="true">{effects.map(effect=><div key={effect.id} className="task-completion-feedback" style={effect.style}>
   <span className="completion-check"><Check size={12} strokeWidth={2.7}/></span><span className="completion-title">{effect.title}</span>
 </div>)}</div>,document.body);
}
