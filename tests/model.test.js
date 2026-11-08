import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,localDate,nextOccurrence,validateState,reducer,selectTasks} from '../src/model.js';
const sample=()=>createInitialState(new Date());

test('calendar dates respect local time and reject impossible dates',()=>{
  assert.equal(localDate(new Date(2026,10,8,0,1)),'2026-11-08');
  assert.equal(nextOccurrence('2024-02-28','daily'),'2024-02-29');
  assert.equal(nextOccurrence('2025-02-28','daily'),'2025-03-01');
  assert.equal(nextOccurrence('2026-12-28','weekly'),'2027-01-04');
  assert.equal(nextOccurrence('2026-03-08','daily'),'2026-03-09');
  assert.throws(()=>nextOccurrence('2026-02-29','daily'));
  assert.throws(()=>nextOccurrence('2026-04-31','daily'));
  assert.throws(()=>nextOccurrence('9999-12-31','daily'));
});

test('monthly repetition clamps month end, including leap years',()=>{
  assert.equal(nextOccurrence('2024-01-31','monthly'),'2024-02-29');
  assert.equal(nextOccurrence('2025-01-31','monthly'),'2025-02-28');
  assert.equal(nextOccurrence('2026-12-31','monthly'),'2027-01-31');
});

test('seed and JSON persistence roundtrip are valid and detached',()=>{
  const original=sample(), restored=validateState(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(restored,original);restored.tasks[0].title='改动';
  assert.notEqual(original.tasks[0].title,restored.tasks[0].title);
});

test('completing recurring task preserves history and creates one next instance',()=>{
  const original=sample(), first=reducer(original,{type:'TASK_TOGGLE',id:'walk'});
  assert.equal(original.tasks.find(t=>t.id==='walk').completed,false);
  assert.equal(first.tasks.find(t=>t.id==='walk').completed,true);
  const future=first.tasks.find(t=>t.id==='walk:next');
  assert.equal(future.due,nextOccurrence(localDate(),'daily'));assert.equal(future.completed,false);
  const undone=reducer(first,{type:'TASK_TOGGLE',id:'walk'}), redone=reducer(undone,{type:'TASK_TOGGLE',id:'walk'});
  assert.equal(redone.tasks.filter(t=>t.id==='walk:next').length,1);
  const later=reducer(redone,{type:'TASK_TOGGLE',id:'walk:next'});
  assert.ok(later.tasks.find(t=>t.id==='walk:next:2'));
});

test('selection includes overdue today, bounded upcoming and excludes deleted/completed',()=>{
  let state=sample();
  state=reducer(state,{type:'TASK_ADD',task:{id:'overdue',title:'过去的事',due:'2020-01-01'}});
  state=reducer(state,{type:'TASK_ADD',task:{id:'future',title:'远期的事',due:'2090-01-01'}});
  assert.ok(selectTasks(state,'today').some(t=>t.id==='overdue'));
  assert.ok(!selectTasks(state,'upcoming').some(t=>t.id==='future'));
  assert.ok(selectTasks(state,'upcoming').some(t=>t.id==='tomorrow'));
  assert.ok(selectTasks(state,'list:work','评审').some(t=>t.id==='design-review'));
  assert.ok(selectTasks(state,'tag:阅读').every(t=>t.tags.includes('阅读')));
  state=reducer(state,{type:'TASK_DELETE',id:'overdue'});
  assert.ok(!selectTasks(state,'today').some(t=>t.id==='overdue'));
  assert.ok(selectTasks(state,'trash').some(t=>t.id==='overdue'));
  state=reducer(state,{type:'TASK_RESTORE',id:'overdue'});
  assert.ok(selectTasks(state,'today').some(t=>t.id==='overdue'));
});

test('deleting list keeps tasks; purging task preserves focus history without dangling reference',()=>{
  let state=sample();
  state=reducer(state,{type:'FOCUS_ADD',session:{id:'focus-1',taskId:'design-review',minutes:25}});
  state=reducer(state,{type:'LIST_DELETE',id:'work'});
  assert.equal(state.tasks.find(t=>t.id==='design-review').listId,'inbox');
  assert.throws(()=>reducer(state,{type:'TASK_PURGE',id:'design-review'}));
  state=reducer(state,{type:'TASK_DELETE',id:'design-review'});
  state=reducer(state,{type:'TASK_PURGE',id:'design-review'});
  assert.equal(state.focusSessions[0].taskId,null);
  assert.equal(state.focusSessions[0].minutes,25);
});

test('habit counts clamp to target and zero; invalid date does not mutate state',()=>{
  const original=sample(), date=localDate();
  let state=original;
  for(let i=0;i<20;i++) state=reducer(state,{type:'HABIT_CHECK',id:'water',date,delta:1});
  assert.equal(state.habits[0].history[date],8);
  for(let i=0;i<20;i++) state=reducer(state,{type:'HABIT_CHECK',id:'water',date,delta:-1});
  assert.equal(state.habits[0].history[date],0);assert.equal(original.habits[0].history[date],3);
  assert.throws(()=>reducer(state,{type:'HABIT_CHECK',id:'water',date:'2025-02-30',delta:1}));
});

test('import rejects malformed state, dangling references and duplicate IDs atomically',()=>{
  const state=sample();
  const mutate=(change)=>{const data=structuredClone(state);change(data);assert.throws(()=>reducer(state,{type:'IMPORT',state:data}));};
  mutate(data=>data.version=2);
  mutate(data=>data.tasks[0].due='2026-02-30');
  mutate(data=>data.tasks[0].listId='missing');
  mutate(data=>data.tasks[0].priority=4);
  mutate(data=>data.tasks[0].completed='false');
  mutate(data=>data.tasks[0].createdAt='2026-02-30T12:00:00.000Z');
  mutate(data=>data.tasks[0].createdAt='2026-02-28T25:00:00.000Z');
  mutate(data=>data.tasks.push({...data.tasks[0]}));
  mutate(data=>data.habits[0].history={'2026-02-30':1});
  mutate(data=>data.habits[0].target=Infinity);
  mutate(data=>data.tasks[0].subtasks=[{id:'a',title:'a',completed:false},{id:'a',title:'b',completed:false}]);
  mutate(data=>data.focusSessions.push({id:'focus-bad',taskId:'missing',minutes:25,endedAt:new Date().toISOString()}));
  mutate(data=>data.settings.unknown=true);
  mutate(data=>data.tasks[0].notes='x'.repeat(100001));
  assert.equal(state.version,1); assert.equal(state.tasks[0].listId,'life');
});

test('task updates cannot change immutable identity or allow unknown action',()=>{
  const state=sample();
  assert.throws(()=>reducer(state,{type:'TASK_UPDATE',id:'walk',patch:{id:'other'}}));
  assert.throws(()=>reducer(state,{type:'TASK_UPDATE',id:'walk',patch:{listId:'missing'}}));
  assert.throws(()=>reducer(state,{type:'UNKNOWN'}));
  const changed=reducer(state,{type:'TASK_UPDATE',id:'walk',patch:{notes:'新的备注',tags:['健康']}});
  assert.equal(changed.tasks.find(t=>t.id==='walk').notes,'新的备注');
});


test('hundreds of daily recurrences keep IDs bounded and distinct',()=>{
  let state=sample(), id='walk';
  for(let i=1;i<=200;i++) {
    state=reducer(state,{type:'TASK_TOGGLE',id});
    id=i===1?'walk:next':`walk:next:${i}`;
    assert.ok(state.tasks.find(t=>t.id===id));
  }
  assert.equal(state.tasks.filter(t=>t.id.startsWith('walk')).length,201);
});


test('habit supports bulk completion and cancellation with bounded nonzero integer delta',()=>{
  const date=localDate(), original=sample();
  let state=reducer(original,{type:'HABIT_CHECK',id:'water',date,delta:5});
  assert.equal(state.habits[0].history[date],8);
  state=reducer(state,{type:'HABIT_CHECK',id:'water',date,delta:-8});
  assert.equal(state.habits[0].history[date],0);
  state=reducer(state,{type:'HABIT_CHECK',id:'water',date,delta:100000});
  assert.equal(state.habits[0].history[date],8);
  state=reducer(state,{type:'HABIT_CHECK',id:'water',date,delta:-100000});
  assert.equal(state.habits[0].history[date],0);
  for (const delta of [0,0.5,100001,-100001,NaN,'8',Infinity]) {
    assert.throws(()=>reducer(state,{type:'HABIT_CHECK',id:'water',date,delta}));
  }
});

test('repeated focus completion with same session ID is idempotent',()=>{
  const original=sample(), session={id:'focus-idempotent',taskId:'design-review',minutes:25,endedAt:new Date().toISOString()};
  const once=reducer(original,{type:'FOCUS_ADD',session});
  const twice=reducer(once,{type:'FOCUS_ADD',session});
  assert.equal(twice,once);assert.equal(twice.focusSessions.length,1);
  assert.equal(twice.focusSessions[0].minutes,25);
});

test('malformed null array items give readable validation errors',()=>{
  for(const collection of ['tasks','lists','habits','focusSessions']) {
    const state=sample();state[collection].push(null);
    assert.throws(()=>validateState(state),/必须是对象/);
  }
  const state=sample();state.tasks[0].subtasks.push(null);
  assert.throws(()=>validateState(state),/必须是对象/);
});


test('monthly task lineage keeps original day across short months',()=>{
  for(const [first,second,third] of [
    ['2026-01-31','2026-02-28','2026-03-31'],
    ['2026-01-30','2026-02-28','2026-03-30'],
    ['2024-01-31','2024-02-29','2024-03-31'],
    ['2026-08-31','2026-09-30','2026-10-31'],
  ]) {
    let state=reducer(sample(),{type:'TASK_ADD',task:{id:'monthly',title:'月度任务',due:first,repeat:'monthly'}});
    state=reducer(state,{type:'TASK_TOGGLE',id:'monthly'});
    assert.equal(state.tasks.find(t=>t.id==='monthly:next').due,second);
    state=reducer(state,{type:'TASK_TOGGLE',id:'monthly:next'});
    assert.equal(state.tasks.find(t=>t.id==='monthly:next:2').due,third);
  }
});

test('monthly anchor follows earliest surviving lineage when root is purged',()=>{
  let state=reducer(sample(),{type:'TASK_ADD',task:{id:'monthly',title:'月度任务',due:'2026-01-31',repeat:'monthly'}});
  state=reducer(state,{type:'TASK_TOGGLE',id:'monthly'});
  state=reducer(state,{type:'TASK_TOGGLE',id:'monthly:next'});
  state=reducer(state,{type:'TASK_DELETE',id:'monthly'});
  state=reducer(state,{type:'TASK_PURGE',id:'monthly'});
  state=reducer(state,{type:'TASK_TOGGLE',id:'monthly:next:2'});
  // The original 31st anchor was irreversibly purged; retained February history anchors at 28.
  assert.equal(state.tasks.find(t=>t.id==='monthly:next:3').due,'2026-04-28');
});

test('empty trash removes only deleted tasks atomically and preserves focus history without dangling references',()=>{
  let state=sample();
  state=reducer(state,{type:'FOCUS_ADD',session:{id:'trash-focus',taskId:'design-review',minutes:25}});
  state=reducer(state,{type:'FOCUS_ADD',session:{id:'kept-focus',taskId:'read-book',minutes:15}});
  state=reducer(state,{type:'TASK_DELETE',id:'design-review'});
  state=reducer(state,{type:'TASK_DELETE',id:'done-demo'});
  const original=structuredClone(state), kept=state.tasks.filter(t=>!t.deleted);
  const emptied=reducer(state,{type:'TRASH_EMPTY'});
  assert.deepEqual(state,original);
  assert.deepEqual(emptied.tasks,kept);
  assert.equal(emptied.focusSessions.find(s=>s.id==='trash-focus').taskId,null);
  assert.deepEqual(emptied.focusSessions.find(s=>s.id==='kept-focus'),state.focusSessions.find(s=>s.id==='kept-focus'));
  assert.equal(emptied.focusSessions[0].minutes,25);
  assert.deepEqual(emptied.lists,state.lists);assert.deepEqual(emptied.habits,state.habits);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(emptied))),emptied);
  assert.equal(reducer(emptied,{type:'TRASH_EMPTY'}),emptied);
});
