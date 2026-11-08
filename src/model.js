/** Offline task domain. Dates use calendar arithmetic, never UTC date slicing. */
const TASK_KEYS = ['id','title','notes','listId','due','priority','important','repeat','completed','completedAt','createdAt','tags','subtasks','deleted','reminder'];
const REPEATS = ['none','daily','weekly','monthly'];
const LIMITS = { tasks: 20000, lists: 200, habits: 200, focusSessions: 20000 };
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const fail = message => { throw new Error(message); };
const object = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(`${label} 必须是对象`);
};
const fields = (value, expected, label) => {
  object(value, label);
  for (const key of Object.keys(value)) if (!expected.includes(key)) fail(`${label} 包含未知字段 ${key}`);
  for (const key of expected) if (!own(value, key)) fail(`${label} 缺少字段 ${key}`);
};
const string = (value, label, max = 200, empty = false) => {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail(`${label} 文本无效`);
};
const identifier = (value, label) => {
  string(value, label, 300);
  if (!/^[\p{L}\p{N}_:.\-]+$/u.test(value)) fail(`${label} ID 无效`);
};
const bool = (value, label) => { if (typeof value !== 'boolean') fail(`${label} 必须是布尔值`); };
const number = (value, label, min, max, integer = false) => {
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`${label} 数值无效`);
};
const enumeration = (value, values, label) => { if (!values.includes(value)) fail(`${label} 选项无效`); };
function dateParts(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y,m,d] = value.split('-').map(Number);
  if (y < 1900 || y > 9999 || m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y,m,0)).getUTCDate()) return null;
  return [y,m,d];
}
const day = (value, label, empty = false) => { if (!(empty && value === '') && !dateParts(value)) fail(`${label} 日期无效`); };
const instant = (value, label, empty = false, nullable = false) => {
  if ((empty && value === '') || (nullable && value === null)) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !dateParts(value.slice(0,10)) || !Number.isFinite(Date.parse(value))) fail(`${label} 时间无效`);
  const hour = Number(value.slice(11,13)), minute = Number(value.slice(14,16)), second = Number(value.slice(17,19));
  if (hour > 23 || minute > 59 || second > 59) fail(`${label} 时间无效`);
};
const color = (value, label) => { if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) fail(`${label} 颜色无效`); };
const unique = (array, label) => {
  for (const item of array) object(item,label);
  if (new Set(array.map(item => item.id)).size !== array.length) fail(`${label} ID 重复`);
};
const uid = () => globalThis.crypto.randomUUID();
const clone = value => JSON.parse(JSON.stringify(value));

export function localDate(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) fail('日期无效');
  return `${String(date.getFullYear()).padStart(4,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function nextOccurrence(value, repeat) {
  day(value, '重复日期');
  enumeration(repeat, REPEATS, '重复规则');
  if (repeat === 'none') return value;
  let [y,m,d] = dateParts(value);
  if (repeat === 'monthly') {
    if (++m === 13) { m = 1; y++; }
    d = Math.min(d, new Date(Date.UTC(y,m,0)).getUTCDate());
    const result = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    day(result, '下一次重复日期');
    return result;
  }
  const date = new Date(Date.UTC(y,m-1,d));
  date.setUTCDate(date.getUTCDate() + (repeat === 'weekly' ? 7 : 1));
  const result = `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
  day(result, '下一次重复日期');
  return result;
}

export function validateState(input) {
  fields(input, ['version','tasks','lists','habits','focusSessions','settings'], '数据');
  if (input.version !== 1) fail('不支持的数据版本');
  for (const [key, limit] of Object.entries(LIMITS)) {
    if (!Array.isArray(input[key]) || input[key].length > limit) fail(`${key} 数量无效，最多 ${limit} 条`);
    unique(input[key], key);
  }
  const listIds = new Set(input.lists.map(list => list?.id));
  for (const list of input.lists) {
    fields(list, ['id','name','color'], '清单'); identifier(list.id, '清单');
    if (list.id === 'inbox') fail('inbox 是保留 ID');
    string(list.name,'清单名称',80); color(list.color,'清单');
  }
  const taskIds = new Set(input.tasks.map(task => task?.id));
  for (const task of input.tasks) {
    fields(task,TASK_KEYS,'任务'); identifier(task.id,'任务'); string(task.title,'任务标题',500);
    string(task.notes,'任务备注',100000,true);
    if (task.listId !== 'inbox' && !listIds.has(task.listId)) fail('任务引用了不存在的清单');
    day(task.due,'任务日期',true); number(task.priority,'优先级',0,3,true); bool(task.important,'重要标记');
    enumeration(task.repeat,REPEATS,'重复规则'); bool(task.completed,'完成状态'); bool(task.deleted,'删除状态');
    instant(task.createdAt,'创建时间'); instant(task.completedAt,'完成时间',false,true); instant(task.reminder,'提醒时间',true);
    if (task.completed && task.completedAt === null) fail('已完成任务缺少完成时间');
    if (!Array.isArray(task.tags) || task.tags.length > 30 || new Set(task.tags).size !== task.tags.length) fail('任务标签无效');
    task.tags.forEach(tag => string(tag,'标签',60));
    if (!Array.isArray(task.subtasks) || task.subtasks.length > 500) fail('子任务数量无效');
    unique(task.subtasks,'子任务');
    for (const sub of task.subtasks) {
      fields(sub,['id','title','completed'],'子任务'); identifier(sub.id,'子任务'); string(sub.title,'子任务标题',500); bool(sub.completed,'子任务状态');
    }
  }
  for (const habit of input.habits) {
    fields(habit,['id','name','color','target','unit','history'],'习惯'); identifier(habit.id,'习惯'); string(habit.name,'习惯名称',100);
    color(habit.color,'习惯'); number(habit.target,'习惯目标',1,100000,true); string(habit.unit,'习惯单位',30);
    object(habit.history,'习惯记录');
    if (Object.keys(habit.history).length > 40000) fail('习惯记录过多');
    for (const [date,value] of Object.entries(habit.history)) { day(date,'打卡日期'); number(value,'打卡次数',0,100000,true); }
  }
  for (const session of input.focusSessions) {
    fields(session,['id','taskId','minutes','endedAt'],'专注记录'); identifier(session.id,'专注记录');
    if (session.taskId !== null && !taskIds.has(session.taskId)) fail('专注记录引用了不存在的任务');
    number(session.minutes,'专注分钟',0.01,1440); instant(session.endedAt,'专注结束时间');
  }
  fields(input.settings,['theme','accent','focusMinutes','breakMinutes'],'设置');
  enumeration(input.settings.theme,['light','dark','system'],'主题');
  enumeration(input.settings.accent,['blue','green','violet','amber','rose'],'强调色');
  number(input.settings.focusMinutes,'专注时长',1,180,true); number(input.settings.breakMinutes,'休息时长',1,60,true);
  return clone(input);
}

const baseTask = (task = {}) => ({
  id:uid(),title:'新任务',notes:'',listId:'inbox',due:'',priority:0,important:false,repeat:'none',completed:false,
  completedAt:null,createdAt:new Date().toISOString(),tags:[],subtasks:[],deleted:false,reminder:'',...task
});

export function createInitialState(now = new Date()) {
  const today = localDate(now), tomorrow = nextOccurrence(today,'daily');
  const createdAt = now.toISOString();
  const tasks = [
    {id:'welcome',title:'给今天留一点从容',notes:'把想做的事放在这里。一次专注一件，慢慢也会走很远。',listId:'life',due:today,priority:0,tags:['生活']},
    {id:'design-review',title:'完成新版本的设计评审',notes:'检查信息层级、阅读节奏和细节状态。\n\n让每一次点击，都有清晰的回应。',listId:'work',due:today,priority:3,important:true,tags:['设计'],subtasks:[{id:'review-layout',title:'确认核心页面布局',completed:true},{id:'review-states',title:'补齐空状态与交互细节',completed:false},{id:'review-feedback',title:'整理评审反馈',completed:false}]},
    {id:'weekly-plan',title:'整理本周项目进度',notes:'回顾已经完成的工作，规划下一步。',listId:'work',due:today,priority:2,important:true,tags:['工作']},
    {id:'read-book',title:'读 20 页《深度工作》',notes:'记下一条可以实践的想法。',listId:'reading',due:today,priority:0,tags:['阅读']},
    {id:'walk',title:'傍晚散步 30 分钟',notes:'带上耳机，也可以什么都不带。',listId:'life',due:today,priority:1,tags:['生活'],repeat:'daily'},
    {id:'flowers',title:'给阳台的植物浇水',listId:'life',due:today,priority:0},
    {id:'inspiration',title:'收集下一次旅行的灵感',listId:'inbox',priority:0},
    {id:'tomorrow',title:'准备下周的产品讨论',listId:'work',due:tomorrow,priority:2,important:true,tags:['工作']},
    {id:'done-demo',title:'清理桌面，泡一杯热茶',listId:'life',due:today,completed:true,completedAt:createdAt},
  ].map(task=>baseTask({createdAt,...task}));
  return validateState({version:1,tasks,lists:[{id:'work',name:'工作项目',color:'#5B7CFA'},{id:'life',name:'日常生活',color:'#49A58F'},{id:'reading',name:'阅读与成长',color:'#B48AD7'}],habits:[{id:'water',name:'认真喝水',color:'#5B8DEF',target:8,unit:'杯',history:{[today]:3}},{id:'reading',name:'每天阅读',color:'#AF8CC5',target:1,unit:'次',history:{}},{id:'exercise',name:'活动一下',color:'#64A88D',target:1,unit:'次',history:{}},{id:'sleep',name:'早一点休息',color:'#D4A05E',target:1,unit:'次',history:{}}],focusSessions:[],settings:{theme:'light',accent:'blue',focusMinutes:25,breakMinutes:5}});
}

function patchObject(original, patch, allowed, label) {
  object(patch,label);
  for (const key of Object.keys(patch)) if (!allowed.includes(key)) fail(`${label} 不允许修改 ${key}`);
  return {...original,...patch};
}
function requireItem(items,id,label) { const item=items.find(item=>item.id===id); if(!item) fail(`${label}不存在`); return item; }

function reduceAction(state, action) {
  if (!action || typeof action.type !== 'string') fail('操作无效');
  if (action.type === 'IMPORT') return validateState(action.state);
  let next = state;
  switch(action.type) {
    case 'TASK_BATCH': {
      if(!Array.isArray(action.actions)||!action.actions.length||action.actions.length>20000) fail('批量任务数量无效');
      const allowed=['TASK_UPDATE','TASK_TOGGLE','TASK_DELETE','TASK_RESTORE','TASK_PURGE'];
      const ids=new Set();
      for(const entry of action.actions){
        if(!entry||!allowed.includes(entry.type)||ids.has(entry.id))fail('批量操作无效或任务重复');
        ids.add(entry.id);
      }
      next=action.actions.reduce((current,entry)=>reduceAction(current,entry),state);break;
    }
    case 'TASK_REVERT': {
      if(!Array.isArray(action.before)||!Array.isArray(action.after))fail('撤销记录无效');
      const before=new Map(action.before.map(t=>[t.id,t])),after=new Map(action.after.map(t=>[t.id,t]));
      if(before.size!==action.before.length||after.size!==action.after.length||!after.size)fail('撤销记录无效');
      if([...before.keys()].some(id=>!after.has(id)))fail('永久删除不能撤销');
      for(const [id,expected] of after){if(JSON.stringify(state.tasks.find(t=>t.id===id))!==JSON.stringify(expected))fail('任务已有新改动，无法撤销这次操作');}
      const removed=new Set([...after.keys()].filter(id=>!before.has(id)));
      next={...state,tasks:state.tasks.filter(t=>!removed.has(t.id)).map(t=>before.get(t.id)||t),focusSessions:state.focusSessions.map(s=>removed.has(s.taskId)?{...s,taskId:null}:s)};break;
    }
    case 'TASK_ADD': next={...state,tasks:[...state.tasks,baseTask(action.task)]}; break;
    case 'TASK_UPDATE': {
      const original=requireItem(state.tasks,action.id,'任务');
      const patch={...action.patch};
      if(own(patch,'due')&&!own(patch,'reminder')&&original.reminder){
        day(patch.due,'任务日期',true);
        if(!patch.due)patch.reminder='';
        else{const time=new Date(original.reminder);const [y,m,d]=dateParts(patch.due);time.setFullYear(y,m-1,d);patch.reminder=time.toISOString();}
      }
      next={...state,tasks:state.tasks.map(task=>task.id===action.id?patchObject(task,patch,TASK_KEYS.filter(key=>!['id','createdAt'].includes(key)),'任务更新'):task)}; break;
    }
    case 'TASK_TOGGLE': {
      const task=requireItem(state.tasks,action.id,'任务');
      const completed=!task.completed, now=new Date().toISOString();
      let tasks=state.tasks.map(item=>item.id===task.id?{...item,completed,completedAt:completed?now:null}:item);
      if(completed && !task.deleted && task.repeat!=='none') {
        const lineage=task.id.match(/^(.*):next(?::(\d+))?$/);
        const nextId=lineage?`${lineage[1]}:next:${Number(lineage[2]||1)+1}`:`${task.id}:next`;
        let due=nextOccurrence(task.due||localDate(),task.repeat);
        if(task.repeat==='monthly') {
          const rootId=lineage?lineage[1]:task.id;
          const candidates=state.tasks.map(item=>{
            if(item.id===rootId) return {item,sequence:0};
            const match=item.id.match(/^(.*):next(?::(\d+))?$/);
            return match && match[1]===rootId ? {item,sequence:Number(match[2]||1)} : null;
          }).filter(candidate=>candidate && dateParts(candidate.item.due)).sort((a,b)=>a.sequence-b.sequence);
          // Without a retained root, the earliest surviving occurrence is the only available anchor.
          const anchor=candidates[0]?.item.due || task.due || localDate();
          const [y,m]=dateParts(due), anchorDay=dateParts(anchor)[2];
          due=`${y}-${String(m).padStart(2,'0')}-${String(Math.min(anchorDay,new Date(Date.UTC(y,m,0)).getUTCDate())).padStart(2,'0')}`;
        }
        if(!tasks.some(item=>item.id===nextId)) tasks.push(baseTask({...task,id:nextId,due,completed:false,completedAt:null,createdAt:now,reminder:'',subtasks:task.subtasks.map(sub=>({...sub,completed:false}))}));
      }
      next={...state,tasks}; break;
    }
    case 'TASK_DELETE': case 'TASK_RESTORE': {
      requireItem(state.tasks,action.id,'任务'); next={...state,tasks:state.tasks.map(task=>task.id===action.id?{...task,deleted:action.type==='TASK_DELETE'}:task)};break;
    }
    case 'TASK_PURGE': {
      const task=requireItem(state.tasks,action.id,'任务'); if(!task.deleted) fail('请先将任务移入垃圾桶');
      next={...state,tasks:state.tasks.filter(task=>task.id!==action.id),focusSessions:state.focusSessions.map(session=>session.taskId===action.id?{...session,taskId:null}:session)};break;
    }
    case 'TRASH_EMPTY': {
      const deletedIds=new Set(state.tasks.filter(task=>task.deleted).map(task=>task.id));
      if(!deletedIds.size) return state;
      next={...state,tasks:state.tasks.filter(task=>!deletedIds.has(task.id)),focusSessions:state.focusSessions.map(session=>deletedIds.has(session.taskId)?{...session,taskId:null}:session)};break;
    }
    case 'LIST_ADD': next={...state,lists:[...state.lists,{id:uid(),name:'新清单',color:'#5B7CFA',...action.list}]};break;
    case 'LIST_UPDATE': {
      requireItem(state.lists,action.id,'清单');next={...state,lists:state.lists.map(list=>list.id===action.id?patchObject(list,action.patch,['name','color'],'清单更新'):list)};break;
    }
    case 'LIST_DELETE': {
      requireItem(state.lists,action.id,'清单');next={...state,lists:state.lists.filter(list=>list.id!==action.id),tasks:state.tasks.map(task=>task.listId===action.id?{...task,listId:'inbox'}:task)};break;
    }
    case 'HABIT_ADD': next={...state,habits:[...state.habits,{id:uid(),name:'新习惯',color:'#49A58F',target:1,unit:'次',history:{},...action.habit}]};break;
    case 'HABIT_CHECK': {
      const habit=requireItem(state.habits,action.id,'习惯');day(action.date,'打卡日期');number(action.delta,'打卡增量',-100000,100000,true);if(action.delta===0) fail('打卡增量不能为零');
      const value=Math.min(habit.target,Math.max(0,(habit.history[action.date]||0)+action.delta));
      next={...state,habits:state.habits.map(item=>item.id===action.id?{...item,history:{...item.history,[action.date]:value}}:item)};break;
    }
    case 'HABIT_DELETE': requireItem(state.habits,action.id,'习惯');next={...state,habits:state.habits.filter(habit=>habit.id!==action.id)};break;
    case 'FOCUS_ADD': {
      if(action.session?.id && state.focusSessions.some(session=>session.id===action.session.id)) return state;
      next={...state,focusSessions:[...state.focusSessions,{id:uid(),taskId:null,minutes:25,endedAt:new Date().toISOString(),...action.session}]};break;
    }
    case 'SETTINGS_UPDATE': next={...state,settings:patchObject(state.settings,action.patch,['theme','accent','focusMinutes','breakMinutes'],'设置更新')};break;
    default: fail(`未知操作 ${action.type}`);
  }
  return next;
}

export function reducer(state,action){
  const next=reduceAction(state,action);
  return next===state?state:validateState(next);
}

export function selectTasks(state, view='all', query='') {
  const today=localDate();
  let end=today;for(let i=0;i<7;i++) end=nextOccurrence(end,'daily');
  const q=query.trim().toLocaleLowerCase();
  return state.tasks.filter(task=>{
    if(view==='trash') { if(!task.deleted) return false; }
    else {
      if(task.deleted) return false;
      if(view==='completed') { if(!task.completed) return false; }
      else if(task.completed) return false;
    }
    if(view==='today' && (!task.due || task.due>today)) return false;
    if(view==='upcoming' && (!task.due || task.due<=today || task.due>end)) return false;
    if(view==='inbox' && task.listId!=='inbox') return false;
    if(view.startsWith('list:') && task.listId!==view.slice(5)) return false;
    if(view.startsWith('tag:') && !task.tags.includes(view.slice(4))) return false;
    return !q || `${task.title}\n${task.notes}\n${task.tags.join(' ')}`.toLocaleLowerCase().includes(q);
  }).sort((a,b)=>b.priority-a.priority || (a.due||'9999-12-31').localeCompare(b.due||'9999-12-31') || a.createdAt.localeCompare(b.createdAt));
}
