import { useEffect, useMemo, useState } from 'react';
import { LiquidThemeToggle, LiquidAudio, readSoundSettings, SOUND_KEY, cacheTheme } from './index';
import type {Theme} from './types';
/** Alternative standalone usage; the running Shixu app uses the hook directly. */
export function Example() {
  const [theme,setTheme]=useState<Theme>(()=>document.documentElement.dataset.theme==='dark'?'dark':'light');
  const [sound,setSound]=useState(readSoundSettings);
  const audio=useMemo(()=>new LiquidAudio(readSoundSettings()),[]);
  useEffect(()=>{audio.setSettings(sound);try{localStorage.setItem(SOUND_KEY,JSON.stringify(sound));}catch{}},[sound,audio]);
  useEffect(()=>()=>audio.dispose(),[audio]);
  return <main style={{height:'100%',overflow:'auto',background:'var(--panel)',color:'var(--text)',padding:24}}>
    <LiquidThemeToggle theme={theme} onThemeChange={next=>{setTheme(next);cacheTheme(next);}}
      duration={2800} root={()=>document.getElementById('root')} sound={audio}/>
    <label><input type="checkbox" checked={sound.enabled} onChange={e=>setSound({...sound,enabled:e.target.checked})}/>水声</label>
    <label>音量<input type="range" min="0" max="1" step=".01" value={sound.volume} onChange={e=>setSound({...sound,volume:Number(e.target.value)})}/></label>
    <h1>保留原来的工作与生活</h1>
    <label>切换时保留输入<input aria-label="示例输入" defaultValue="尚未提交的内容"/></label>
    <section style={{border:'1px solid var(--line)',padding:24,marginTop:24}}>卡片、文字和边框与液面同步改变。</section>
  </main>;
}
