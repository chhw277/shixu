import {test,expect} from '@playwright/test';
import {createInitialState,localDate} from '../src/model.js';
const stateOf=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-state-v1')));
const nav=(page,name)=>page.getByRole('button',{name,exact:true}).click();
const row=(page,title)=>page.locator('.main-area .task-row').filter({has:page.locator('.task-title',{hasText:title})});
async function ready(page,state){
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 if(state)await page.addInitScript(state=>{if(!localStorage.getItem('shixu-state-v1'))localStorage.setItem('shixu-state-v1',JSON.stringify(state));},state);
 await page.goto('/');await expect(page.locator('.main-area h1')).toBeVisible();
 await expect.poll(()=>stateOf(page)).toBeTruthy();return errors;
}

test('old data and old backup import preserve original entities and produce an empty memo list',async({page})=>{
 const old=createInitialState();delete old.memos;
 const errors=await ready(page,old);
 const loaded=await stateOf(page);expect(loaded).toEqual({...old,memos:[]});
 await nav(page,'备忘录');await expect(page.locator('.main-area h1')).toHaveText('备忘录');
 await nav(page,'新建备忘录');await page.getByRole('textbox',{name:'备忘录内容'}).fill('导入前的记录');
 await nav(page,'设置');
 const chooser=page.waitForEvent('filechooser');await nav(page,'恢复备份');
 page.once('dialog',dialog=>dialog.accept());
 await (await chooser).setFiles({name:'old-shixu-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
 await expect.poll(()=>stateOf(page)).toEqual({...old,memos:[]});expect(errors).toEqual([]);
});

test('memo edits survive reload without blur, navigation, search, blank drafts, export and deletion cancellation',async({page})=>{
 const errors=await ready(page);await nav(page,'备忘录');
 await expect(page.locator('.main-body')).toHaveClass(/module-body/);
 await nav(page,'新建备忘录');const text='  多行灵感 📝\n保留空白  ';
 await page.getByRole('textbox',{name:'备忘录内容'}).fill(text);
 await expect.poll(async()=>(await stateOf(page)).memos[0].content).toBe(text);
 await page.reload();await expect(page.locator('.main-area h1')).toHaveText('备忘录');
 await expect(page.locator('.memo-content')).toHaveText(text.trim());
 await page.locator('.memo-content').click();await page.getByRole('textbox',{name:'备忘录内容'}).fill('切页保留');
 await nav(page,'今天');await nav(page,'备忘录');expect((await stateOf(page)).memos[0].content).toBe('切页保留');
 await page.getByRole('textbox',{name:'搜索备忘录'}).fill('不存在');await expect(page.getByRole('heading',{name:'没有匹配的备忘录'})).toBeVisible();
 await nav(page,'新建备忘录');await expect(page.getByRole('textbox',{name:'备忘录内容'})).toBeFocused();
 await page.getByRole('textbox',{name:'备忘录内容'}).fill('搜索时新建');
 await page.getByRole('textbox',{name:'搜索备忘录'}).fill('搜索时');
 await page.locator('.memo-content').click();await page.getByRole('textbox',{name:'备忘录内容'}).fill('不含原搜索词');
 await expect(page.getByRole('textbox',{name:'备忘录内容'})).toHaveValue('不含原搜索词');
 await page.getByRole('textbox',{name:'搜索备忘录'}).fill('');
 await nav(page,'新建备忘录');await nav(page,'今天');await nav(page,'备忘录');
 expect((await stateOf(page)).memos).toHaveLength(3);
 const before=await stateOf(page);
 await nav(page,'设置');const download=page.waitForEvent('download');await nav(page,'导出备份');
 const artifact=await download;const stream=await artifact.createReadStream();let json='';for await(const chunk of stream)json+=chunk;
 expect(JSON.parse(json)).toEqual(before);await nav(page,'关闭弹窗');
 page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'删除备忘录',exact:true}).first().click();
 expect((await stateOf(page)).memos).toHaveLength(3);
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'删除备忘录',exact:true}).first().click();
 await expect.poll(async()=>(await stateOf(page)).memos.length).toBe(2);
 await page.reload();expect((await stateOf(page)).tasks).toEqual(before.tasks);expect(errors).toEqual([]);
 await page.screenshot({path:'artifacts/repair-2026-11-15/memos.png',animations:'disabled'});
});

for(const mode of ['running','paused','break'])test(`quick focus preserves ${mode} timer across list, board and matrix`,async({page})=>{
 const timer={id:'existing-timer',kind:mode==='break'?'break':'focus',taskId:'read-book',total:1500,remaining:1111,endAt:mode==='paused'?null:Date.now()+1000000};
 await page.addInitScript(timer=>{localStorage.setItem('shixu-timer',JSON.stringify(timer));},timer);
 const errors=await ready(page);
 async function check(){
  await expect(page.locator('.main-area h1')).toHaveText('专注');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-timer')))).toEqual(timer);
  await expect(page.getByRole('status')).toContainText('已有计时');
 }
 await row(page,'给阳台的植物浇水').hover();await nav(page,'开始专注 给阳台的植物浇水');await check();
 await nav(page,'今天');await nav(page,'看板');await row(page,'给阳台的植物浇水').hover();await nav(page,'开始专注 给阳台的植物浇水');await check();
 await nav(page,'四象限');await row(page,'给阳台的植物浇水').hover();await nav(page,'开始专注 给阳台的植物浇水');await check();
 expect(errors).toEqual([]);
});

test('quick focus actually starts from board and focus atmosphere cleans up when paused or navigating away',async({page})=>{
 const errors=await ready(page);await nav(page,'看板');await row(page,'给阳台的植物浇水').hover();
 await nav(page,'开始专注 给阳台的植物浇水');
 await expect(page.locator('.main-area h1')).toHaveText('专注');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-timer')).taskId)).toBe('flowers');
 await expect(page.locator('body')).toHaveClass(/focus-atmosphere/);
 await nav(page,'暂停');await expect(page.locator('body')).not.toHaveClass(/focus-atmosphere/);
 await nav(page,'继续专注');await expect(page.locator('body')).toHaveClass(/focus-atmosphere/);
 await nav(page,'今天');await expect(page.locator('body')).not.toHaveClass(/focus-atmosphere/);
 expect(errors).toEqual([]);
});

test('habit celebration happens only on completion clicks, never on page entry, cancellation or partial counts',async({page})=>{
 const state=createInitialState();state.habits[0].history[localDate()]=8;
 await ready(page,state);await nav(page,'习惯');
 await expect(page.locator('.habit-cell.done')).toHaveCount(1);
 await expect(page.locator('.habit-cell.celebrating')).toHaveCount(0);
 const cell=page.locator('.habit-table-row').first().locator('.habit-cell').last();
 await cell.click();await expect(cell).not.toHaveClass(/celebrating/);
 await nav(page,'增加 认真喝水');await expect(cell).not.toHaveClass(/celebrating/);
 await cell.click();await expect(cell).toHaveClass(/celebrating/);
 expect(await cell.evaluate(el=>getComputedStyle(el).animationName)).toBe('habitPop');
 await nav(page,'今天');await nav(page,'习惯');
 await expect(page.locator('.habit-cell.celebrating')).toHaveCount(0);
});

test('today ripple and counter animate on completion, not on deletion, navigation or startup',async({page})=>{
 const state=createInitialState();state.tasks=[{...state.tasks[0],repeat:'none',completed:false,completedAt:null}];
 await ready(page,state);await expect(page.locator('.today-complete-overlay')).toHaveCount(0);
 await row(page,state.tasks[0].title).getByRole('button',{name:`完成 ${state.tasks[0].title}`,exact:true}).click();
 await expect(page.locator('.today-complete-overlay.show')).toHaveCount(1);
 await expect(page.locator('.today-progress .animated-counter')).toHaveClass(/updating/);
 expect(await page.locator('.today-complete-overlay').evaluate(el=>getComputedStyle(el,'::before').animationName)).toBe('completionRipple');
 await expect(page.locator('.today-complete-overlay')).toHaveCount(0);
 await page.reload();await expect(page.locator('.today-complete-overlay')).toHaveCount(0);
 await expect(page.locator('.animated-counter.updating')).toHaveCount(0);
 await page.getByRole('textbox',{name:'快速添加任务'}).fill('删除不庆祝');await page.getByRole('textbox',{name:'快速添加任务'}).press('Enter');
 await row(page,'删除不庆祝').hover();await nav(page,'删除 删除不庆祝');
 await expect(page.locator('.today-complete-overlay')).toHaveCount(0);
});

test('new animations respect reduced motion including pseudo elements',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await ready(page);await nav(page,'习惯');
 const cell=page.locator('.habit-table-row').first().locator('.habit-cell').last();await cell.click();
 expect(await cell.evaluate(el=>[getComputedStyle(el).animationName,getComputedStyle(el,'::after').animationName])).toEqual(['none','none']);
});

test('pausing a just-started focus never exceeds its duration and survives reload',async({page})=>{
 await page.clock.install();await ready(page);
 await page.clock.pauseAt(new Date());
 await page.clock.fastForward(500);
 await row(page,'给阳台的植物浇水').hover();await nav(page,'开始专注 给阳台的植物浇水');
 await nav(page,'暂停');
 const paused=await page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-timer')));
 expect(paused.endAt).toBeNull();expect(paused.remaining).toBeLessThanOrEqual(paused.total);
 expect(paused.remaining).toBeGreaterThan(0);
 await page.reload();await expect(page.getByRole('button',{name:'继续专注',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-timer')))).toEqual(paused);
});
