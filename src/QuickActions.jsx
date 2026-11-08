import React,{createContext,useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {CalendarDays,Flag,Trash2,Copy,Layers,Timer,Check,RotateCcw,ChevronRight} from 'lucide-react';
import {dateChoices} from './productivity.js';
export const TaskActionsContext=createContext(null);
export const useTaskActions=()=>useContext(TaskActionsContext);

export function DateShortcuts({value,onChange,disabled=false}){
 return <div className="date-shortcuts" aria-label="日期快捷选项">{dateChoices().map(choice=><button type="button" key={choice.label} disabled={disabled} className={value===choice.value?'chosen':''} aria-label={`设为${choice.label}`} onClick={()=>onChange(choice.value)}>{choice.label}</button>)}</div>;
}

export function TaskActionMenu({menu,lists,tasks,onAction,onClose,onChangeMenu}){
 const ref=useRef(null),previous=useRef(document.activeElement),[position,setPosition]=useState({left:menu.x,top:menu.y});
 useLayoutEffect(()=>{const rect=ref.current.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(menu.x,innerWidth-rect.width-8)),top:Math.max(8,Math.min(menu.y,innerHeight-rect.height-8))});},[menu.kind,menu.x,menu.y]);
 useEffect(()=>{const outside=e=>{if(!ref.current?.contains(e.target))onClose();};const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}else if(['ArrowDown','ArrowUp'].includes(e.key)&&!['INPUT','SELECT'].includes(e.target.tagName)){e.preventDefault();const buttons=[...ref.current.querySelectorAll('button:not(:disabled),input,select')];const current=buttons.indexOf(document.activeElement);buttons[(current+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key,true);const first=ref.current.querySelector('button,input,select');first?.focus();return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key,true);if(previous.current?.isConnected)previous.current.focus({preventScroll:true});};},[onClose]);
 const first=tasks.find(t=>t.id===menu.ids?.[0]),deleted=first?.deleted;
 const item=(label,Icon,action,danger=false)=> <button type="button" role="menuitem" className={danger?'danger-text':''} onClick={action}><Icon size={15}/><span>{label}</span></button>;
 const submenu=kind=>onChangeMenu({...menu,kind});
 return <div ref={ref} className="task-action-menu" role="menu" aria-label={menu.kind==='date'?'调整日期':menu.kind==='priority'?'调整优先级':menu.kind==='move'?'移动到清单':'任务操作'} style={position}>
 {menu.kind==='date'?<><div className="action-menu-label">安排日期{menu.ids.length>1&&` · ${menu.ids.length} 项`}</div>{dateChoices().map(c=><React.Fragment key={c.label}>{item(c.label,CalendarDays,()=>onAction('update',{due:c.value}))}</React.Fragment>)}<label className="menu-custom-date">自定义日期<input type="date" aria-label="快捷自定义日期" value={first?.due||''} onChange={e=>onAction('update',{due:e.target.value})}/></label></>:
 menu.kind==='priority'?<><div className="action-menu-label">优先级</div>{[3,2,1,0].map((p)=><React.Fragment key={p}>{item(['无优先级','低优先级','中优先级','高优先级'][p],Flag,()=>onAction('update',{priority:p}))}</React.Fragment>)}</>:
 menu.kind==='move'?<><div className="action-menu-label">移动到清单</div>{[{id:'inbox',name:'收集箱'},...lists].map(list=><React.Fragment key={list.id}>{item(list.name,Layers,()=>onAction('update',{listId:list.id}))}</React.Fragment>)}</>:
 menu.kind==='trash'?item('清空废纸篓',Trash2,()=>onAction('empty-trash'),true):
 deleted?<>{item('恢复任务',RotateCcw,()=>onAction('restore'))}{item('永久删除',Trash2,()=>onAction('purge'),true)}</>:
 <>{item(first?.completed?'取消完成':'完成任务',Check,()=>onAction('complete'))}{item('调整日期',CalendarDays,()=>submenu('date'))}{item('调整优先级',Flag,()=>submenu('priority'))}{item('移动到清单',Layers,()=>submenu('move'))}<div className="menu-separator"/>{menu.ids.length===1&&<>{item('复制任务',Copy,()=>onAction('copy'))}{item('开始专注',Timer,()=>onAction('focus'))}</>}{item('移到废纸篓',Trash2,()=>onAction('delete'),true)}</>}
 </div>;
}
