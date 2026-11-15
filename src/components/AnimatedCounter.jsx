import React, {useEffect,useRef,useState} from 'react';

export default function AnimatedCounter({value}) {
 const previous=useRef(value);
 const [updating,setUpdating]=useState(false);
 useEffect(()=>{
   if(previous.current===value)return;
   previous.current=value;
   setUpdating(true);
   const timeout=setTimeout(()=>setUpdating(false),600);
   return ()=>clearTimeout(timeout);
 },[value]);
 return <span key={value} className={`animated-counter ${updating?'updating':''}`}>{value}</span>;
}
