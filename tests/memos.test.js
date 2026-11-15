import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createStore} from '../electron/store.cjs';
import {createInitialState,validateState,reducer} from '../src/model.js';
import {readWorkspace,WORKSPACE_KEY} from '../src/productivity.js';
const legacy=()=>{const state=createInitialState();delete state.memos;return state;};

test('old v1 state and JSON imports migrate without mutation or losing any original fields',()=>{
 const old=legacy(),copy=structuredClone(old),valid=validateState(old);
 assert.deepEqual(old,copy);assert.deepEqual(valid,{...copy,memos:[]});
 assert.deepEqual(validateState(valid),valid);
 assert.deepEqual(reducer(createInitialState(),{type:'IMPORT',state:JSON.parse(JSON.stringify(old))}),valid);
 for(const key of ['tasks','lists','habits','focusSessions','settings'])assert.deepEqual(valid[key],old[key]);
});

test('memo migration does not accept explicit null, invalid collections, unknown fields or future schema',()=>{
 for(const memos of [null,{},'lost',undefined,[null]])assert.throws(()=>validateState({...legacy(),memos}));
 assert.throws(()=>validateState({...legacy(),unknown:[]}));
 assert.throws(()=>validateState({...legacy(),version:2}));
 assert.throws(()=>validateState(null));assert.throws(()=>validateState([]));
});

test('memo CRUD roundtrips Unicode, multiline whitespace and empty drafts without affecting tasks',()=>{
 const original=createInitialState();
 let state=reducer(original,{type:'MEMO_ADD',memo:{id:'memo-test',content:'  灵感 📝\n第二行  '}});
 assert.deepEqual(state.tasks,original.tasks);assert.equal(original.memos.length,0);
 assert.equal(state.memos[0].content,'  灵感 📝\n第二行  ');
 state=reducer(state,{type:'MEMO_UPDATE',id:'memo-test',patch:{content:''}});
 assert.equal(state.memos.length,1);assert.equal(state.memos[0].content,'');
 state=reducer(state,{type:'MEMO_UPDATE',id:'memo-test',patch:{content:'保存后的正文'}});
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(state))),state);
 assert.equal(reducer(state,{type:'MEMO_DELETE',id:'memo-test'}).memos.length,0);
 assert.equal(state.memos[0].content,'保存后的正文');
});

test('memo rejects duplicates, oversize content, bad timestamps and identity edits atomically',()=>{
 const state=reducer(createInitialState(),{type:'MEMO_ADD',memo:{id:'memo-test'}}),copy=structuredClone(state);
 for(const action of [
  {type:'MEMO_ADD',memo:{id:'memo-test'}},
  {type:'MEMO_ADD',memo:{id:'bad-time',createdAt:'yesterday'}},
  {type:'MEMO_ADD',memo:{id:'bad-content',content:3}},
  {type:'MEMO_UPDATE',id:'memo-test',patch:{content:'x'.repeat(50001)}},
  {type:'MEMO_UPDATE',id:'memo-test',patch:{id:'overwrite'}},
  {type:'MEMO_UPDATE',id:'missing',patch:{content:'missing'}},
  {type:'MEMO_DELETE',id:'missing'},
 ])assert.throws(()=>reducer(state,action));
 assert.deepEqual(state,copy);
});

test('desktop store reads an old main without recovery, saves memos and retains every legacy entity',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'shixu-migrate-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const old=legacy(),raw=JSON.stringify(old);await writeFile(path.join(directory,'state.json'),raw);
 const store=createStore({directory,validate:validateState});
 const loaded=await store.load();assert.equal(store.recovery,null);assert.deepEqual(loaded,{...old,memos:[]});
 assert.equal(await readFile(store.filename,'utf8'),raw);
 const next=reducer(loaded,{type:'MEMO_ADD',memo:{id:'disk-memo',content:'磁盘重启'}});
 await store.save(next);await store.flush();
 assert.deepEqual(await createStore({directory,validate:validateState}).load(),next);
 assert.deepEqual(JSON.parse(await readFile(store.backup,'utf8')),{...old,memos:[]});
});

test('desktop store recovers old-format backups without discarding memo or task data silently',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'shixu-migrate-backup-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const old=legacy();await writeFile(path.join(directory,'state.backup.json'),JSON.stringify(old));
 const store=createStore({directory,validate:validateState});
 assert.deepEqual(await store.load(),{...old,memos:[]});assert.ok(store.recovery);
 const corrupt={...old,memos:null};await writeFile(store.filename,JSON.stringify(corrupt));
 await writeFile(store.backup,JSON.stringify(corrupt));
 await assert.rejects(createStore({directory,validate:validateState}).load());
 assert.deepEqual(JSON.parse(await readFile(store.filename,'utf8')),corrupt);
});

test('workspace restores the memos module',()=>{
 const storage={getItem:key=>key===WORKSPACE_KEY?JSON.stringify({version:1,view:'memos'}):null};
 assert.equal(readWorkspace(storage).view,'memos');
});
