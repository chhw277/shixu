import React,{useMemo} from 'react';
import {localDate} from '../model.js';

const WEEK=['一','二','三','四','五','六','日'];

export default function WeekActivity({tasks,today}){
 const days=useMemo(()=>{
   const start=new Date(`${today}T12:00:00`);start.setDate(start.getDate()-(start.getDay()+6)%7);
   const counts=new Map();
   for(const task of tasks){
     if(!task.completed||task.deleted||!task.completedAt)continue;
     const date=localDate(new Date(task.completedAt));counts.set(date,(counts.get(date)||0)+1);
   }
   return WEEK.map((label,index)=>{
     const day=new Date(start);day.setDate(day.getDate()+index);
     const date=localDate(day);return {label,date,count:counts.get(date)||0};
   });
 },[tasks,today]);
 const max=Math.max(1,...days.map(day=>day.count));
 return <div className="mini-week" role="img" aria-label={`本周完成任务：${days.map(day=>`周${day.label} ${day.count} 件`).join('，')}`}>
   {days.map(day=><span key={day.date} title={`${day.date} 周${day.label} · 完成 ${day.count} 件`} data-count={day.count} className={`${day.date===today?'current':''} ${day.count?'':'empty'}`}><small>{day.label}</small><i style={{height:`${day.count?Math.max(4,day.count/max*27):2}px`}}/></span>)}
 </div>;
}
