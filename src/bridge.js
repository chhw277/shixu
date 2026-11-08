const key = 'shixu-state-v1';
export const desktop = window.desktop;
export async function loadState() {
  if (desktop) return desktop.load();
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}
export async function saveState(state) {
  if (desktop) return desktop.save(state);
  const previous = localStorage.getItem(key);
  if (previous) localStorage.setItem(`${key}-backup`, previous);
  localStorage.setItem(key, JSON.stringify(state));
}
export async function exportState(state) {
  if (desktop) return desktop.exportData(state);
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type:'application/json'}));
  const a = document.createElement('a'); a.href = url; a.download = `拾序备份-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000); return true;
}
export async function importState() {
  if (desktop) return desktop.importData();
  return new Promise((resolve,reject)=>{
    const input=document.createElement('input'); input.type='file'; input.accept='.json';
    input.oncancel=()=>resolve(null);
    input.onchange=async()=>{try{const f=input.files?.[0]; if(!f)return resolve(null); if(f.size>16*1024*1024)throw Error('备份文件不能超过 16 MB');resolve(JSON.parse(await f.text()));}catch(e){reject(e);}};input.click();
  });
}
export async function notify(title,body) {
  if(desktop) return desktop.notify({title,body});
  if('Notification' in window && Notification.permission==='granted') new Notification(title,{body});
}
