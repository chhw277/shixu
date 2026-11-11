import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {LiquidThemeToggle} from '../../src/liquid-theme';
import '../../src/styles.css';
const events:Array<unknown>=[];
const fixture=window as unknown as {fixtureEvents:Array<unknown>;fixtureUnmount:()=>void;fixtureSetTheme:(theme:'light'|'dark')=>void};
fixture.fixtureEvents=events;
function Harness(){
 const [theme,setTheme]=useState<'light'|'dark'>('light');fixture.fixtureSetTheme=setTheme;
 return <main style={{height:'100%',background:'var(--panel)',color:'var(--text)'}}>
  <LiquidThemeToggle theme={theme} onThemeChange={next=>{events.push(['commit',next]);setTheme(next);}}
   root={()=>document.getElementById('root')} sound={{begin(){events.push('begin');},update(){},stop(reason){events.push(['stop',reason]);}}/>
  <h1>Lifecycle fixture</h1><input defaultValue="preserve me"/>
 </main>;
}
const root=createRoot(document.getElementById('root')!);root.render(<Harness/>);fixture.fixtureUnmount=()=>root.unmount();
