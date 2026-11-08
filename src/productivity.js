import {localDate,nextOccurrence} from './model.js';

export function dateChoices(now=new Date()) {
  const today=localDate(now), monday=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  monday.setDate(monday.getDate()+((8-monday.getDay())%7||7));
  return [{label:'今天',value:today},{label:'明天',value:nextOccurrence(today,'daily')},{label:'下周一',value:localDate(monday)},{label:'清除日期',value:''}];
}

// Only recognized scheduling tokens are removed; ordinary prose is kept verbatim.
export function parseQuickTask(input,{now=new Date(),due='',listId='inbox',tags=[]}={}) {
  let title=input.trim(),dateExplicit=false,priority=0,reminder='';
  const dateMatch=title.match(/今天|明天|后天|下周一|(?:^|\s)(\d{4}-\d{2}-\d{2})(?=\s|$)/);
  if(dateMatch){
    let value;
    if(dateMatch[1]){
      value=dateMatch[1];const parsed=new Date(`${value}T12:00:00`);
      if(!Number.isFinite(parsed.getTime())||localDate(parsed)!==value)throw Error('日期无效，请使用正确的年月日');
    }else if(dateMatch[0]==='后天')value=nextOccurrence(nextOccurrence(localDate(now),'daily'),'daily');
    else value=dateChoices(now).find(d=>d.label===dateMatch[0]).value;
    due=value;dateExplicit=true;title=title.replace(dateMatch[0],' ');
  }
  const timeMatch=title.match(/(?<![\d:：])(?:凌晨|早上|上午|中午|下午|晚上)?\s*(?:([01]?\d|2[0-3])[:：]([0-5]\d)|([0-9]|1[0-9]|2[0-3])点(?:([0-5]?\d)分?|半)?)(?![\d:：])/);
  if(timeMatch){
    let hour=Number(timeMatch[1]??timeMatch[3]),minute=timeMatch[2]!==undefined?Number(timeMatch[2]):timeMatch[0].includes('半')?30:Number(timeMatch[4]||0);
    const period=timeMatch[0];
    if(/下午|晚上/.test(period)&&hour<12)hour+=12;
    if(/中午/.test(period)&&hour<11)hour+=12;
    if(/凌晨|早上|上午/.test(period)&&hour===12)hour=0;
    if(!dateExplicit&&!due)due=localDate(now);
    let stamp=new Date(`${due}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`);
    if(!Number.isFinite(stamp.getTime())||stamp.getHours()!==hour||stamp.getMinutes()!==minute)throw Error('该提醒时间不存在，请选择其他时间');
    // A time without a date schedules the next occurrence rather than an already elapsed reminder.
    if(!dateExplicit&&stamp<=now){due=nextOccurrence(due,'daily');stamp=new Date(`${due}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`);}
    reminder=stamp.toISOString();title=title.replace(timeMatch[0],' ');
  }
  title=title.replace(/(?:^|\s)[!！](高|中|低|无|[0-3])(?=\s|$)/g,(_,value)=>{priority=({高:3,中:2,低:1,无:0})[value]??Number(value);return ' ';});
  const foundTags=[...title.matchAll(/#([^\s#]+)/g)].map(m=>m[1]);
  title=title.replace(/#[^\s#]+/g,' ').replace(/\s+/g,' ').trim();
  if(!title)throw Error('请先写下任务内容');
  return {title,due,listId,priority,reminder,tags:[...new Set([...tags,...foundTags])]};
}

export const WORKSPACE_KEY='shixu-workspace-v1';
export function readWorkspace(storage) {
  try{
    const value=JSON.parse(storage.getItem(WORKSPACE_KEY));
    if(!value||value.version!==1)return null;
    const view=typeof value.view==='string'&&value.view.length<=200&&( ['today','upcoming','inbox','all','completed','trash','calendar','matrix','focus','habits'].includes(value.view)||/^(list|tag):.+/.test(value.view))?value.view:'today';
    return {view,selected:typeof value.selected==='string'?value.selected:null,mode:['list','board'].includes(value.mode)?value.mode:'list',sort:['default','priority','date','created'].includes(value.sort)?value.sort:'default',detailOpen:typeof value.detailOpen==='boolean'?value.detailOpen:true,showCompleted:value.showCompleted===true,scrolls:value.scrolls&&typeof value.scrolls==='object'?Object.fromEntries(Object.entries(value.scrolls).filter(([k,v])=>k.length<=200&&Number.isFinite(v)&&v>=0&&v<10000000)): {}};
  }catch{return null;}
}
export function writeWorkspace(storage,value){try{storage.setItem(WORKSPACE_KEY,JSON.stringify({version:1,...value}));}catch{/* UI preferences must never prevent task saving. */}}
export function validWorkspaceView(state,view){return view?.startsWith('list:')&&!state.lists.some(l=>l.id===view.slice(5))?'today':view?.startsWith('tag:')&&!state.tasks.some(t=>!t.deleted&&t.tags.includes(view.slice(4)))?'today':view||'today';}
