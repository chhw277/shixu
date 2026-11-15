import React, {useState} from 'react';
import {Plus,Trash2,Search,X,FileText} from 'lucide-react';

export default function MemosView({state,act}) {
 const [query,setQuery]=useState('');
 const [editingId,setEditingId]=useState(null);
 const filtered=state.memos.filter(memo=>memo.id===editingId||memo.content.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 const addMemo=()=>{
   const id=crypto.randomUUID();
   act({type:'MEMO_ADD',memo:{id}});
   setQuery('');
   setEditingId(id);
 };
 return <div className="memos-module">
   <div className="memos-toolbar">
     <div className="memos-search"><Search size={15}/><input aria-label="搜索备忘录" placeholder="搜索备忘录…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="清除备忘录搜索" onClick={()=>setQuery('')}><X size={14}/></button>}</div>
     <button className="primary" onClick={addMemo}><Plus size={15}/>新建备忘录</button>
   </div>
   <div className="memos-grid">{[...filtered].reverse().map(memo=><article key={memo.id} data-memo-id={memo.id} className={`memo-card ${editingId===memo.id?'editing':''}`}>
     {editingId===memo.id?<textarea autoFocus aria-label="备忘录内容" maxLength={50000} value={memo.content} onChange={e=>act({type:'MEMO_UPDATE',id:memo.id,patch:{content:e.target.value}})} onBlur={()=>setEditingId(null)} placeholder="写下你的想法…" rows={8}/>:<button className="memo-content" aria-label={`编辑备忘录 ${memo.content.slice(0,30)||'空白备忘录'}`} onClick={()=>setEditingId(memo.id)}>{memo.content||'空白备忘录'}</button>}
     <div className="memo-footer"><span>{new Date(memo.createdAt).toLocaleString('zh-CN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span><button aria-label="删除备忘录" onClick={()=>{if(confirm('确定永久删除这条备忘录？'))act({type:'MEMO_DELETE',id:memo.id});}}><Trash2 size={13}/></button></div>
   </article>)}</div>
   {!state.memos.length?<div className="empty-state"><FileText size={38}/><h3>快速记录灵感</h3><p>备忘录随输入自动保存在本机，也会包含在导出的备份中。</p><button className="primary" onClick={addMemo}><Plus size={14}/>创建第一条备忘录</button></div>:!filtered.length&&<div className="empty-state"><Search size={32}/><h3>没有匹配的备忘录</h3><button className="secondary" onClick={()=>setQuery('')}>清除搜索</button></div>}
 </div>;
}
