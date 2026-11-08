import test from 'node:test';
import assert from 'node:assert/strict';
import {dateChoices,parseQuickTask,readWorkspace,writeWorkspace,validWorkspaceView} from '../src/productivity.js';
import {createInitialState,localDate,reducer,validateState} from '../src/model.js';
const now=()=>new Date(2026,10,8,10,30);

test('quick capture parses Chinese date and time, priority and duplicate tags into a valid task',()=>{
 const task=parseQuickTask('明天下午3点 开会 !高 #工作 #工作',{now:now(),listId:'work'});
 assert.equal(task.title,'开会');assert.equal(task.due,'2026-11-09');assert.equal(task.priority,3);assert.deepEqual(task.tags,['工作']);assert.equal(new Date(task.reminder).getHours(),15);
 const state=reducer(createInitialState(now()),{type:'TASK_ADD',task});assert.doesNotThrow(()=>validateState(state));
});
test('quick capture supports next Monday, date literal, half hours and time rollover without losing text',()=>{
 assert.equal(parseQuickTask('下周一 复盘',{now:now()}).due,'2026-11-09');
 assert.equal(parseQuickTask('2026-12-01 09:15 复盘 !2 #会议',{now:now()}).title,'复盘');
 const half=parseQuickTask('后天中午12点半 吃饭',{now:now()});assert.equal(half.due,'2026-11-10');assert.equal(new Date(half.reminder).getMinutes(),30);
 const next=parseQuickTask('09:00 晨会',{now:now()});assert.equal(next.due,'2026-11-09');
 const explicit=parseQuickTask('今天09:00 晨会',{now:now()});assert.equal(explicit.due,'2026-11-08');
 assert.equal(parseQuickTask('阅读第25章 !important',{now:now()}).title,'阅读第25章 !important');
 for(const text of ['25:00 开会','12:000 开会','3点60分 开会','25点 开会']){const task=parseQuickTask(text,{now:now()});assert.equal(task.title,text);assert.equal(task.reminder,'');}
 assert.throws(()=>parseQuickTask('2026-02-30 会议',{now:now()}),/日期无效/);
 assert.throws(()=>parseQuickTask('明天 #工作 !高',{now:now()}),/任务内容/);
 assert.deepEqual(parseQuickTask('计划 #标签',{now:now(),tags:['标签','继承']} ).tags,['标签','继承']);
});
test('date shortcuts always pick next Monday, including Monday itself and year boundaries',()=>{
 assert.equal(dateChoices(new Date(2026,10,9,8))[2].value,'2026-11-16');
 assert.equal(dateChoices(new Date(2026,11,31,8))[2].value,'2027-01-04');
});
test('workspace storage rejects malformed data and stale list/tag references without breaking task saving',()=>{
 const storage={data:null,getItem(){return this.data;},setItem(_,value){this.data=value;}};
 assert.equal(readWorkspace(storage),null);storage.data='{broken';assert.equal(readWorkspace(storage),null);
 writeWorkspace(storage,{view:'list:work',selected:'design-review',mode:'board',sort:'date',detailOpen:false,showCompleted:true,scrolls:{all:450,invalid:-2}});
 assert.deepEqual(readWorkspace(storage),{view:'list:work',selected:'design-review',mode:'board',sort:'date',detailOpen:false,showCompleted:true,scrolls:{all:450}});
 const state=createInitialState(now());assert.equal(validWorkspaceView(state,'list:missing'),'today');assert.equal(validWorkspaceView(state,'tag:missing'),'today');assert.equal(validWorkspaceView(state,'list:work'),'list:work');
 assert.doesNotThrow(()=>writeWorkspace({setItem(){throw Error('full');}},{view:'all'}));
});
test('batch operations are atomic on failure, reject duplicate IDs and preserve unrelated fields',()=>{
 const state=createInitialState(now()),snapshot=structuredClone(state);
 const result=reducer(state,{type:'TASK_BATCH',actions:[{type:'TASK_UPDATE',id:'design-review',patch:{due:'2026-11-10'}},{type:'TASK_DELETE',id:'flowers'}]});
 assert.equal(result.tasks.find(t=>t.id==='flowers').deleted,true);assert.equal(result.tasks.find(t=>t.id==='design-review').due,'2026-11-10');assert.deepEqual(state,snapshot);
 assert.throws(()=>reducer(state,{type:'TASK_BATCH',actions:[{type:'TASK_DELETE',id:'flowers'},{type:'TASK_UPDATE',id:'missing',patch:{priority:3}}]}));assert.deepEqual(state,snapshot);
 assert.throws(()=>reducer(state,{type:'TASK_BATCH',actions:[{type:'TASK_DELETE',id:'flowers'},{type:'TASK_DELETE',id:'flowers'}]}));
 assert.throws(()=>reducer(state,{type:'TASK_BATCH',actions:[{type:'TRASH_EMPTY'}]}));
});
test('undo batch completion removes newly generated repeat instance and rejects conflicting later edits',()=>{
 const before=createInitialState(now());const completed=reducer(before,{type:'TASK_BATCH',actions:[{type:'TASK_TOGGLE',id:'walk'},{type:'TASK_TOGGLE',id:'flowers'}]});
 const changed=completed.tasks.filter(t=>JSON.stringify(before.tasks.find(p=>p.id===t.id))!==JSON.stringify(t));const ids=new Set(changed.map(t=>t.id));
 const undo={type:'TASK_REVERT',before:before.tasks.filter(t=>ids.has(t.id)),after:changed};
 const restored=reducer(completed,undo);assert.deepEqual(restored,before);
 const edited=reducer(completed,{type:'TASK_UPDATE',id:'walk:next',patch:{title:'次日已经编辑'}});
 assert.throws(()=>reducer(edited,undo),/新改动/);assert.equal(edited.tasks.find(t=>t.id==='walk:next').title,'次日已经编辑');
});
test('changing due date moves reminder at same local clock time; clearing date clears reminder',()=>{
 let state=reducer(createInitialState(now()),{type:'TASK_UPDATE',id:'flowers',patch:{due:'2026-11-08',reminder:new Date(2026,10,8,15,30).toISOString()}});
 state=reducer(state,{type:'TASK_UPDATE',id:'flowers',patch:{due:'2026-11-09'}});
 const task=state.tasks.find(t=>t.id==='flowers');assert.equal(localDate(new Date(task.reminder)),'2026-11-09');assert.equal(new Date(task.reminder).getHours(),15);
 state=reducer(state,{type:'TASK_UPDATE',id:'flowers',patch:{due:''}});assert.equal(state.tasks.find(t=>t.id==='flowers').reminder,'');
});
