import {test,expect} from '@playwright/test';
import {createInitialState} from '../src/model.js';

const nav=(page,name)=>page.getByRole('button',{name,exact:true}).click();
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-state-v1')));
const row=(page,id)=>page.locator(`.main-area .task-row[data-task-id="${id}"]`);
async function ready(page,state=createInitialState()){
 await page.addInitScript(state=>{if(!localStorage.getItem('shixu-state-v1'))localStorage.setItem('shixu-state-v1',JSON.stringify(state));},state);
 await page.goto('/');await expect(page.locator('.main-area h1')).toBeVisible();
}

for(const mode of ['list','board','matrix'])test(`completion feedback survives ${mode} removal while data saves immediately, and undo restores the task`,async({page})=>{
 await page.clock.install();await ready(page);
 if(mode==='board')await nav(page,'看板');if(mode==='matrix')await nav(page,'四象限');
 await page.clock.pauseAt(new Date(Date.now()+60000));
 await nav(page,'完成 给阳台的植物浇水');
 await expect(row(page,'flowers')).toHaveCount(0);
 expect((await saved(page)).tasks.find(task=>task.id==='flowers').completed).toBe(true);
 const effect=page.locator('.task-completion-feedback');
 await expect(effect).toHaveCount(1);
 expect(await effect.locator('button,input,[tabindex]').count()).toBe(0);
 expect(await effect.evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
 await page.clock.runFor(180);
 expect(await effect.evaluate(el=>Number(getComputedStyle(el).opacity))).toBeGreaterThan(0);
 await nav(page,'撤销');
 await expect(effect).toHaveCount(0);await expect(row(page,'flowers')).toBeVisible();
 expect((await saved(page)).tasks.find(task=>task.id==='flowers').completed).toBe(false);
});

test('completion feedback expires, supports the keyboard, and never replays after reload',async({page})=>{
 await page.clock.install();await ready(page);await page.clock.pauseAt(new Date(Date.now()+60000));
 await row(page,'flowers').locator('.task-content').click();await row(page,'flowers').focus();await page.keyboard.press('Space');
 expect((await saved(page)).tasks.find(task=>task.id==='flowers').completed).toBe(true);
 await expect(page.locator('.task-completion-feedback')).toHaveCount(1);
 await page.clock.runFor(601);await expect(page.locator('.task-completion-feedback')).toHaveCount(0);
 await page.reload();await expect(page.locator('.main-area h1')).toBeVisible();
 await expect(page.locator('.task-completion-feedback')).toHaveCount(0);
 expect((await saved(page)).tasks.find(task=>task.id==='flowers').completed).toBe(true);
});

test('batch completion retains separate feedback and undo restores both tasks',async({page})=>{
 await page.clock.install();await ready(page);await page.clock.pauseAt(new Date(Date.now()+60000));
 await nav(page,'批量选择');
 await page.getByRole('checkbox',{name:'选择 给阳台的植物浇水',exact:true}).click();await page.getByRole('checkbox',{name:'选择 读 20 页《深度工作》',exact:true}).click();
 await nav(page,'完成');
 await expect(page.locator('.task-completion-feedback')).toHaveCount(2);
 const state=await saved(page);
 for(const id of ['flowers','read-book'])expect(state.tasks.find(task=>task.id===id).completed).toBe(true);
 await nav(page,'撤销');await expect(page.locator('.task-completion-feedback')).toHaveCount(0);
 for(const id of ['flowers','read-book'])await expect(row(page,id)).toBeVisible();
});

test('completion feedback clears on navigation, scrolling and reduced motion',async({page})=>{
 await page.clock.install();await ready(page);await page.clock.pauseAt(new Date(Date.now()+60000));
 await nav(page,'完成 给阳台的植物浇水');await expect(page.locator('.task-completion-feedback')).toHaveCount(1);
 await nav(page,'所有任务');await expect(page.locator('.task-completion-feedback')).toHaveCount(0);
 await nav(page,'完成 读 20 页《深度工作》');await expect(page.locator('.task-completion-feedback')).toHaveCount(1);
 await page.locator('.main-body').dispatchEvent('scroll');await expect(page.locator('.task-completion-feedback')).toHaveCount(0);
 await page.emulateMedia({reducedMotion:'reduce'});
 const next=page.locator('.task-row:not(.is-completed) .check-box').first();await next.click();
 await expect(page.locator('.task-completion-feedback')).toHaveCount(0);
});

test('weekly bars use local completion dates, exclude deleted tasks, update on undo and show honest zero values',async({page})=>{
 await page.clock.install({time:new Date('2026-11-18T12:00:00+08:00')});
 const state=createInitialState(),template=state.tasks[0];
 state.tasks=[{...template,id:'active',title:'周统计验收',due:'2026-11-18',repeat:'none',completed:false,completedAt:null},
 ...[
  ['mon','2026-11-15T16:00:00Z',false],['tue1','2026-11-17T15:59:59Z',false],
  ['tue2','2026-11-17T04:00:00Z',false],['deleted','2026-11-18T02:00:00Z',true],
  ['last-week','2026-11-15T15:59:59Z',false],['next-week','2026-11-22T16:00:00Z',false]
 ].map(([id,completedAt,deleted])=>({...template,id,title:id,repeat:'none',completed:true,completedAt,deleted}))];
 await ready(page,state);
 const bars=page.locator('.mini-week>span');
 expect(await bars.evaluateAll(els=>els.map(el=>Number(el.dataset.count)))).toEqual([1,2,0,0,0,0,0]);
 await expect(page.getByRole('img',{name:/本周完成任务：周一 1 件，周二 2 件，周三 0 件/})).toBeVisible();
 const heights=await bars.locator('i').evaluateAll(els=>els.map(el=>el.style.height));
 expect(heights.slice(0,3)).toEqual(['13.5px','27px','2px']);
 expect(await bars.nth(2).locator('i').evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
 await nav(page,'完成 周统计验收');await expect(bars.nth(2)).toHaveAttribute('data-count','1');
 await nav(page,'撤销');await expect(bars.nth(2)).toHaveAttribute('data-count','0');
});

for(const theme of ['light','dark'])test(`focus gradient is on the visible main surface in ${theme}, and clears on pause and rest`,async({page})=>{
 const state=createInitialState();state.settings.theme=theme;
 await ready(page,state);await row(page,'flowers').hover();await nav(page,'开始专注 给阳台的植物浇水');
 const surface=page.locator('.main-area');
 await expect(surface).toHaveCSS('background-image',/radial-gradient/);
 await expect(page.locator('.focus-ring')).toHaveCSS('animation-name','focusPulse');
 await page.screenshot({path:`artifacts/enhancements-focus-${theme}.png`,animations:'disabled'});
 await nav(page,'暂停');await expect(surface).toHaveCSS('background-image','none');
 await nav(page,'继续专注');await expect(surface).toHaveCSS('background-image',/radial-gradient/);
 page.once('dialog',dialog=>dialog.accept());await nav(page,'结束计时');
 await expect(surface).toHaveCSS('background-image','none');
 await nav(page,'短暂休息');await nav(page,'开始休息');
 await expect(surface).toHaveCSS('background-image','none');
});
