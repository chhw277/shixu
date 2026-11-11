import {test,expect} from '@playwright/test';
const stateOf=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-state-v1')));
async function ready(page){await page.goto('/');await expect(page.getByRole('heading',{name:'今天',exact:true})).toBeVisible();await expect.poll(()=>stateOf(page)).toBeTruthy();}
async function settings(page){await page.getByRole('button',{name:'设置',exact:true}).click();await expect(page.getByRole('dialog',{name:'偏好设置'})).toBeVisible();}
async function freezeAnimation(page){
 await page.evaluate(()=>{
  let id=0,time=performance.now(),frames=new Map();
  Object.defineProperty(performance,'now',{configurable:true,value:()=>time});
  window.requestAnimationFrame=cb=>{const key=++id;frames.set(key,cb);return key;};
  window.cancelAnimationFrame=key=>frames.delete(key);
  window.liquidStep=ms=>{time+=ms;const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(time));};
  window.liquidFrames=()=>frames.size;
 });
}
async function step(page,ms){await page.evaluate(ms=>window.liquidStep(ms),ms);}
const layer=page=>page.locator('.liquid-reveal');
async function assertNoLeaks(page){await expect(layer(page)).toHaveCount(0);await expect(page.locator('.liquid-defs')).toHaveCount(0);}

test('both directions: real content reveal, duplicate-click guard, complete cleanup and refresh',async({page})=>{
 await ready(page);await freezeAnimation(page);
 for(const [from,to] of [['light','dark'],['dark','light']]){
  await page.getByRole('button',{name:'切换主题',exact:true}).click();
  await expect(layer(page)).toHaveAttribute('data-liquid-theme',to);await expect(page.locator('html')).toHaveAttribute('data-theme',from);
  await step(page,400);
  const firstPath=await page.locator('clipPath path').getAttribute('d');expect(firstPath.length).toBeGreaterThan(100);
  await page.getByRole('button',{name:'切换主题',exact:true}).click();await expect(layer(page)).toHaveCount(1);
  const semantics=await page.evaluate(()=>({hidden:document.querySelector('.liquid-reveal').getAttribute('aria-hidden'),inert:document.querySelector('.liquid-reveal').inert,ids:[...document.querySelectorAll('[id]')].map(e=>e.id),clips:getComputedStyle(document.querySelector('.liquid-reveal')).clipPath}));
  expect(semantics.hidden).toBe('true');expect(semantics.inert).toBe(true);expect(new Set(semantics.ids).size).toBe(semantics.ids.length);expect(semantics.clips).toContain('liquid-clip');
  await step(page,1000);expect(await page.locator('clipPath path').getAttribute('d')).not.toBe(firstPath);
  await page.screenshot({path:`artifacts/liquid-${from}-to-${to}.png`});
  await step(page,1600);await assertNoLeaks(page);await expect(page.locator('html')).toHaveAttribute('data-theme',to);expect((await stateOf(page)).settings.theme).toBe(to);
 }
 await page.getByRole('button',{name:'切换主题',exact:true}).click();await step(page,2900);await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

for(const viewport of [{width:1380,height:880},{width:768,height:1024},{width:390,height:844}])test(`snapshot alignment, scrolled containers, fixed/sticky and form state ${viewport.width}`,async({page})=>{
 await page.setViewportSize(viewport);await ready(page);
 await page.getByRole('button',{name:'关闭任务详情',exact:true}).click();
 await page.getByRole('textbox',{name:'快速添加任务'}).fill('尚未提交的输入 #保留');
 await page.evaluate(()=>{
  const scroller=document.querySelector('.main-body');
  const fixture=document.createElement('section');fixture.dataset.fixture='true';fixture.innerHTML='<div style="position:sticky;top:0;background:var(--panel)">sticky fixture</div><div style="height:1800px"></div><span style="position:fixed;bottom:12px;right:12px">fixed fixture</span>';
  scroller.append(fixture);scroller.scrollTop=170;
 });
 await freezeAnimation(page);await page.getByRole('button',{name:'切换主题',exact:true}).click();await step(page,1400);
 const alignment=await page.evaluate(()=>{
  const original=document.querySelector('#root'),copy=document.querySelector('.liquid-root');
  const rect=el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];};
  return ['.topbar','.main-body','.quick-add','[data-fixture] > div:first-child','[data-fixture] > span'].map(selector=>({selector,a:rect(original.querySelector(selector)),b:rect(copy.querySelector(selector))}));
 });
 alignment.forEach(({a,b})=>a.forEach((n,i)=>expect(Math.abs(n-b[i])).toBeLessThan(.6)));
 expect(await page.evaluate(()=>document.querySelector('#root .main-body').scrollTop===document.querySelector('.liquid-root .main-body').scrollTop)).toBe(true);
 expect(await layer(page).locator('[aria-label="快速添加任务"]').inputValue()).toBe('尚未提交的输入 #保留');
 await page.screenshot({path:`artifacts/liquid-align-${viewport.width}.png`});
 await step(page,1600);await expect(page.getByRole('textbox',{name:'快速添加任务'})).toHaveValue('尚未提交的输入 #保留');await assertNoLeaks(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('window resize, scrolling and typing interrupt safely, commit target and allow later interaction',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'关闭任务详情',exact:true}).click();await freezeAnimation(page);
 for(const action of [()=>page.setViewportSize({width:1100,height:720}),()=>page.evaluate(()=>document.querySelector('.main-body').dispatchEvent(new Event('scroll'))),()=>page.getByRole('textbox',{name:'快速添加任务'}).fill('中断仍能输入')]){
  const from=await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button',{name:'切换主题',exact:true}).click();await step(page,900);await expect(layer(page)).toHaveCount(1);await action();await assertNoLeaks(page);await expect(page.locator('html')).toHaveAttribute('data-theme',from==='light'?'dark':'light');
 }
 await expect(page.getByRole('textbox',{name:'快速添加任务'})).toHaveValue('中断仍能输入');await page.getByRole('textbox',{name:'快速添加任务'}).press('Enter');expect((await stateOf(page)).tasks.some(t=>t.title==='中断仍能输入')).toBe(true);
});

test('reduced motion, unsupported clip and live raster content switch directly',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page);await page.getByRole('button',{name:'切换主题',exact:true}).click();await assertNoLeaks(page);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>document.querySelector('#root').append(document.createElement('canvas')));
 await page.getByRole('button',{name:'切换主题',exact:true}).click();await assertNoLeaks(page);await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.evaluate(()=>{document.querySelector('canvas').remove();CSS.supports=()=>false;});
 await page.getByRole('button',{name:'切换主题',exact:true}).click();await assertNoLeaks(page);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
});

test('sound settings persist, real AudioContext is gesture-only and sources stop on mute/background',async({page})=>{
 await page.addInitScript(()=>{
  const Native=window.AudioContext;window.audioAudit={contexts:0,live:0,starts:0};
  window.AudioContext=class extends Native{
   constructor(...args){super(...args);window.audioAudit.contexts++;
    for(const method of ['createOscillator','createBufferSource']){const original=this[method].bind(this);this[method]=()=>{
     const source=original(),start=source.start.bind(source),stop=source.stop.bind(source);let active=false;
     const off=()=>{if(active){active=false;window.audioAudit.live--;}};
     source.start=(...a)=>{start(...a);active=true;window.audioAudit.starts++;window.audioAudit.live++;};
     source.stop=(...a)=>{stop(...a);if(!a.length)off();};source.addEventListener('ended',off);return source;
    };}
   }
  };
 });
 await ready(page);expect(await page.evaluate(()=>window.audioAudit.contexts)).toBe(0);await settings(page);
 await expect(page.getByRole('checkbox',{name:'开启主题音效'})).not.toBeChecked();await page.getByRole('checkbox',{name:'开启主题音效'}).check();
 const volume=page.getByRole('slider',{name:'主题音效音量'});await volume.press('Home');for(let i=0;i<42;i++)await volume.press('ArrowRight');await page.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await page.getByRole('button',{name:'切换主题',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.audioAudit.live)).toBeGreaterThan(0);
 await page.waitForTimeout(950);expect(await page.evaluate(()=>window.audioAudit.contexts)).toBe(1);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await assertNoLeaks(page);expect(await page.evaluate(()=>window.audioAudit.live)).toBe(0);
 await page.evaluate(()=>Object.defineProperty(document,'hidden',{configurable:true,value:false}));
 await settings(page);await page.getByRole('button',{name:'试听水声',exact:true}).click();await page.waitForTimeout(500);
 await page.getByRole('checkbox',{name:'开启主题音效'}).uncheck();await expect.poll(()=>page.evaluate(()=>window.audioAudit.live)).toBe(0);
 await page.getByRole('checkbox',{name:'开启主题音效'}).check();await page.reload();await settings(page);await expect(page.getByRole('slider',{name:'主题音效音量'})).toHaveValue('42');await expect(page.getByRole('checkbox',{name:'开启主题音效'})).toBeChecked();expect(await page.evaluate(()=>window.audioAudit.contexts)).toBe(0);
});

test('unavailable or failed audio never blocks theme switching',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('shixu-liquid-sound-v1',JSON.stringify({enabled:true,volume:.3}));window.AudioContext=class {constructor(){throw Error('audio unavailable');}};});
 await ready(page);await page.getByRole('button',{name:'切换主题',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await assertNoLeaks(page);
});

test('scoped SVG ids retain local references, clone has no delegated handlers or focus targets',async({page})=>{
 await ready(page);await freezeAnimation(page);
 await page.evaluate(()=>{const span=document.createElement('span');span.innerHTML='<svg width="12" height="12"><defs><linearGradient id="fixture-gradient"><stop stop-color="red"/></linearGradient></defs><rect width="12" height="12" fill="url(#fixture-gradient)"/></svg>';document.querySelector('.topbar').append(span);});
 await page.getByRole('button',{name:'切换主题',exact:true}).click();
 expect(await page.evaluate(()=>{
  const layer=document.querySelector('.liquid-reveal'),rect=layer.querySelector('rect[fill^="url("]'),id=rect.getAttribute('fill').match(/#([^)]*)/)[1];
  return !!layer.querySelector(`[id="${id}"]`)&&id!=='fixture-gradient'&&[...layer.querySelectorAll('button,input,select,textarea,a,[tabindex]')].every(el=>el.tabIndex<0);
 })).toBe(true);
 await step(page,2900);await assertNoLeaks(page);
});

test('unmount and external controlled theme changes cancel frames without stale commits',async({page})=>{
 await page.goto('/tests/fixtures/liquid-harness.html');await expect(page.getByRole('heading',{name:'Lifecycle fixture'})).toBeVisible();await freezeAnimation(page);
 await page.getByRole('button',{name:'切换主题',exact:true}).click();await step(page,900);await expect(layer(page)).toHaveCount(1);
 await page.evaluate(()=>window.fixtureSetTheme('dark'));await assertNoLeaks(page);await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.evaluate(()=>window.fixtureEvents.filter(e=>Array.isArray(e)&&e[0]==='commit').length)).toBe(0);
 await page.getByRole('button',{name:'切换主题',exact:true}).click();await step(page,500);await expect(layer(page)).toHaveCount(1);
 await page.evaluate(()=>window.fixtureUnmount());await assertNoLeaks(page);expect(await page.evaluate(()=>window.liquidFrames())).toBe(0);
 expect(await page.evaluate(()=>window.fixtureEvents.filter(e=>Array.isArray(e)&&e[0]==='commit').length)).toBe(0);
 expect(await page.evaluate(()=>window.fixtureEvents.some(e=>Array.isArray(e)&&e[0]==='stop'&&e[1]==='unmount'))).toBe(true);
});
