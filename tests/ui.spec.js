import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// Playwright creates a fresh browser context for each test; only packaged sample data is used.
const stateOf=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-state-v1')));
const dateOffset=async(page,n=0)=>page.evaluate(n=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;},n);
async function ready(page){await page.goto('/');await expect(page.getByRole('heading',{name:'今天',exact:true})).toBeVisible();await expect.poll(async()=>!!(await stateOf(page))).toBe(true);}
async function clickNav(page,name){await page.getByRole('button',{name,exact:true}).click();}
async function confirmAction(page,action,accept=true){let message='';page.once('dialog',async dialog=>{message=dialog.message();await(accept?dialog.accept():dialog.dismiss());});await action();expect(message).toBeTruthy();return message;}
async function assertTask(page,title,patch){await expect.poll(async()=>{const task=(await stateOf(page)).tasks.find(t=>t.title===title);return task&&Object.fromEntries(Object.keys(patch).map(key=>[key,task[key]]));}).toEqual(patch);}
async function screenshot(page,name){await page.screenshot({path:`artifacts/ui-${name}.png`,fullPage:false,animations:'disabled'});}

test('快速添加、详细编辑、重复完成和刷新持久化',async({page})=>{
 await ready(page);
 const tomorrow=await dateOffset(page,1),dayAfter=await dateOffset(page,2);
 await page.getByRole('textbox',{name:'快速添加任务'}).fill('明天 UI 验证任务 #验收');
 await page.getByRole('textbox',{name:'快速添加任务'}).press('Enter');
 await clickNav(page,'最近 7 天');
 await page.locator('.task-content').filter({hasText:'UI 验证任务'}).click();
 await expect(page.getByRole('textbox',{name:'任务标题',exact:true})).toHaveValue('UI 验证任务');
 await assertTask(page,'UI 验证任务',{due:tomorrow,tags:['验收']});
 await page.getByRole('textbox',{name:'任务备注'}).fill('保存一段可搜索的备注：独立界面验收');
 await page.getByLabel('截止日期',{exact:true}).fill(tomorrow);
 await page.getByRole('combobox',{name:'任务优先级',exact:true}).selectOption('3');
 await page.getByRole('combobox',{name:'重复频率'}).selectOption('daily');
 await page.getByRole('combobox',{name:'所属清单'}).selectOption('work');
 await page.getByRole('checkbox',{name:'重要事项'}).check();
 await page.getByRole('textbox',{name:'添加检查事项'}).fill('验证子任务');
 await page.getByRole('textbox',{name:'添加检查事项'}).press('Enter');
 await page.getByRole('button',{name:'检查事项 验证子任务',exact:true}).click();
 await assertTask(page,'UI 验证任务',{notes:'保存一段可搜索的备注：独立界面验收',priority:3,repeat:'daily',listId:'work',important:true});
 const task=(await stateOf(page)).tasks.find(t=>t.title==='UI 验证任务');
 expect(task.subtasks).toEqual([expect.objectContaining({title:'验证子任务',completed:true})]);
 await page.getByRole('button',{name:'切换当前任务完成状态'}).click();
 await expect.poll(async()=>(await stateOf(page)).tasks.filter(t=>t.title==='UI 验证任务').length).toBe(2);
 let next=(await stateOf(page)).tasks.find(t=>t.id===`${task.id}:next`);
 expect(next).toMatchObject({due:dayAfter,completed:false,repeat:'daily',subtasks:[expect.objectContaining({completed:false})]});
 await page.reload();
 await expect(page.getByRole('heading',{name:'最近 7 天',exact:true})).toBeVisible();
 expect((await stateOf(page)).tasks.find(t=>t.id===task.id)).toMatchObject({completed:true,notes:task.notes});
 expect((await stateOf(page)).tasks.find(t=>t.id===next.id)).toMatchObject({due:dayAfter,completed:false});
});

test('删除、恢复、永久删除必须确认；搜索标题备注和空结果',async({page})=>{
 await ready(page);
 await page.getByRole('textbox',{name:'快速添加任务'}).fill('待删除的界面测试');
 await page.getByRole('textbox',{name:'快速添加任务'}).press('Enter');
 await page.locator('.task-content').filter({hasText:'待删除的界面测试'}).click();
 await page.getByRole('textbox',{name:'任务备注'}).fill('search-distinctive-note');
 await clickNav(page,'搜索任务');
 await page.getByRole('textbox',{name:'搜索关键词'}).fill('search-distinctive-note');
 await expect(page.getByRole('dialog',{name:'搜索任务'}).getByRole('button',{name:/待删除的界面测试/})).toHaveCount(1);
 await page.getByRole('textbox',{name:'搜索关键词'}).fill('不存在的结果-98765');
 await expect(page.getByText('没有找到匹配的任务',{exact:true})).toBeVisible();
 await page.getByRole('textbox',{name:'搜索关键词'}).fill('待删除的界面测试');
 await page.getByRole('dialog',{name:'搜索任务'}).getByRole('button',{name:/待删除的界面测试/}).click();
 await clickNav(page,'删除当前任务');
 await assertTask(page,'待删除的界面测试',{deleted:true});
 await page.getByRole('button',{name:/^废纸篓/}).click();
 await clickNav(page,'恢复当前任务');
 await assertTask(page,'待删除的界面测试',{deleted:false});
 await clickNav(page,'删除当前任务');
 expect(await confirmAction(page,()=>clickNav(page,'永久删除任务'),false)).toContain('无法撤销');
 await assertTask(page,'待删除的界面测试',{deleted:true});
 await confirmAction(page,()=>clickNav(page,'永久删除任务'));
 await expect.poll(async()=>(await stateOf(page)).tasks.some(t=>t.title==='待删除的界面测试')).toBe(false);
});

test('清单新增、修改颜色名称、删除确认并迁回收集箱',async({page})=>{
 await ready(page);
 await clickNav(page,'添加清单');
 await page.getByRole('textbox',{name:'清单名称'}).fill('界面验收清单');
 await clickNav(page,'颜色 #267d6b');
 await clickNav(page,'保存');
 await page.getByRole('button',{name:'界面验收清单',exact:true}).click();
 await page.getByRole('textbox',{name:'快速添加任务'}).fill('清单内部任务');
 await page.getByRole('textbox',{name:'快速添加任务'}).press('Enter');
 const list=(await stateOf(page)).lists.find(l=>l.name==='界面验收清单');
 await assertTask(page,'清单内部任务',{listId:list.id});
 await page.getByRole('button',{name:/^界面验收清单/}).hover();await clickNav(page,'编辑清单 界面验收清单');
 await page.getByRole('textbox',{name:'清单名称'}).fill('重命名后的清单');
 await clickNav(page,'颜色 #7255c5');
 await clickNav(page,'保存');
 expect((await stateOf(page)).lists.find(l=>l.id===list.id)).toMatchObject({name:'重命名后的清单',color:'#7255c5'});
 await page.getByRole('button',{name:/^重命名后的清单/}).hover();await clickNav(page,'编辑清单 重命名后的清单');
 await confirmAction(page,()=>clickNav(page,'删除清单'),false);
 expect((await stateOf(page)).lists.some(l=>l.id===list.id)).toBe(true);
 expect(await confirmAction(page,()=>clickNav(page,'删除清单'))).toContain('收集箱');
 await assertTask(page,'清单内部任务',{listId:'inbox'});
 expect((await stateOf(page)).lists.some(l=>l.id===list.id)).toBe(false);
});

test('习惯目标 8：按日期一次打满、取消、增减与刷新',async({page})=>{
 await ready(page);await clickNav(page,'习惯');
 await clickNav(page,'新建习惯');
 await page.getByRole('textbox',{name:'习惯名称'}).fill('验收喝水');
 await page.getByRole('spinbutton',{name:'每日目标'}).fill('8');
 await page.getByRole('textbox',{name:'目标单位'}).fill('杯');
 await clickNav(page,'创建习惯');
 const today=await dateOffset(page),yesterday=await dateOffset(page,-1);
 await clickNav(page,`验收喝水 ${yesterday} 打卡`);
 expect((await stateOf(page)).habits.find(h=>h.name==='验收喝水').history[yesterday]).toBe(8);
 await clickNav(page,`验收喝水 ${yesterday} 取消打卡`);
 expect((await stateOf(page)).habits.find(h=>h.name==='验收喝水').history[yesterday]).toBe(0);
 await clickNav(page,`验收喝水 ${today} 打卡`);
 await clickNav(page,'增加 验收喝水');
 expect((await stateOf(page)).habits.find(h=>h.name==='验收喝水').history[today]).toBe(8);
 await clickNav(page,'减少 验收喝水');
 expect((await stateOf(page)).habits.find(h=>h.name==='验收喝水').history[today]).toBe(7);
 await page.reload();await clickNav(page,'习惯');
 expect((await stateOf(page)).habits.find(h=>h.name==='验收喝水')).toMatchObject({target:8,unit:'杯',history:{[today]:7,[yesterday]:0}});
});

test('专注开始暂停、跨视图计时完成、同一计时不会重复记录',async({page})=>{
 await page.clock.install({time:new Date('2026-11-08T12:00:00+08:00')});
 await ready(page);await clickNav(page,'专注');
 await page.getByRole('combobox',{name:'专注关联任务'}).selectOption('design-review');
 await clickNav(page,'开始专注');
 await page.clock.runFor(3000);
 await clickNav(page,'暂停');
 await expect(page.getByRole('button',{name:'继续专注',exact:true})).toBeVisible();
 const paused=await page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-timer')));
 expect(paused.remaining).toBeLessThan(paused.total);expect(paused.endAt).toBeNull();
 await page.clock.runFor(5000);
 expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-timer')))).remaining).toBe(paused.remaining);
 await clickNav(page,'继续专注');
 await clickNav(page,'任务');
 // Advance wall time while another module is active; root controller must record completion there.
 await page.clock.fastForward((paused.remaining+1)*1000);
 await expect.poll(async()=>(await stateOf(page)).focusSessions.length).toBe(1);
 await clickNav(page,'专注');
 await expect.poll(async()=>(await stateOf(page)).focusSessions.length).toBe(1);
 expect((await stateOf(page)).focusSessions[0]).toMatchObject({id:paused.id,minutes:25,taskId:'design-review'});
 await clickNav(page,'任务');await clickNav(page,'专注');
 await page.clock.runFor(2000);await page.reload();await clickNav(page,'专注');
 expect((await stateOf(page)).focusSessions).toHaveLength(1);
 await expect(page.getByRole('button',{name:'开始专注',exact:true})).toBeVisible();
});

test('日历拖动改日期、月周切换、看板与四象限实际拖动',async({page})=>{
 await ready(page);await clickNav(page,'日历');
 await clickNav(page,'+4 项更多');
 const dayDialog=page.getByRole('dialog',{name:'今天的任务',exact:true});
 await expect(dayDialog.locator('.task-row')).toHaveCount(6);
 await expect(dayDialog.getByRole('button',{name:'完成 傍晚散步 30 分钟',exact:true})).toBeVisible();
 await dayDialog.getByRole('button',{name:'完成 给阳台的植物浇水',exact:true}).click();
 await assertTask(page,'给阳台的植物浇水',{completed:true});
 await expect(dayDialog.locator('.task-row')).toHaveCount(5);
 await dayDialog.getByRole('button',{name:'关闭弹窗',exact:true}).click();
 await page.getByRole('button',{name:/^已完成/}).click();
 await clickNav(page,'取消完成 给阳台的植物浇水');
 await assertTask(page,'给阳台的植物浇水',{completed:false});
 await clickNav(page,'日历');
 await expect(page.getByRole('button',{name:'+4 项更多',exact:true})).toBeVisible();
 const tomorrow=await dateOffset(page,1);
 const destination=page.locator('.calendar-day').filter({has:page.getByRole('button',{name:`在 ${tomorrow} 添加任务`,exact:true})});
 await page.getByRole('button',{name:'给今天留一点从容',exact:true}).dragTo(destination);
 await assertTask(page,'给今天留一点从容',{due:tomorrow});
 await clickNav(page,'周');await expect(page.locator('.calendar-day')).toHaveCount(7);await clickNav(page,'月');await expect(page.locator('.calendar-day')).toHaveCount(42);
 await clickNav(page,'任务');await page.getByRole('button',{name:/^所有任务/}).click();await clickNav(page,'看板');
 const card=page.locator('.task-row').filter({has:page.getByRole('button',{name:/^给今天留一点从容/})});
 const high=page.locator('.board-column').filter({has:page.getByText('高优先级',{exact:true})});
 await card.dragTo(high);await assertTask(page,'给今天留一点从容',{priority:3});
 await clickNav(page,'列表');await expect(page.getByRole('button',{name:'完成 给今天留一点从容',exact:true})).toBeVisible();
 await clickNav(page,'四象限');
 const seed=page.locator('.task-row').filter({has:page.getByRole('button',{name:/^收集下一次旅行的灵感/})});
 const firstQuad=page.locator('.quadrant').filter({has:page.getByRole('heading',{name:'重要且紧急',exact:true})});
 await seed.dragTo(firstQuad);
 await assertTask(page,'收集下一次旅行的灵感',{important:true,due:await dateOffset(page)});
});

test('设置主题与强调色、导出有效 JSON、拒绝无效导入并保留原数据',async({page})=>{
 await ready(page);await clickNav(page,'设置');
 await page.getByRole('combobox',{name:'界面主题'}).selectOption('dark');
 await clickNav(page,'强调色 green');
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 const downloadPromise=page.waitForEvent('download');await clickNav(page,'导出备份');const download=await downloadPromise;
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(exported).toMatchObject({version:1,settings:{theme:'dark',accent:'green'}});expect(exported.tasks.length).toBeGreaterThan(0);
 const before=await stateOf(page);
 const chooserPromise=page.waitForEvent('filechooser');await clickNav(page,'恢复备份');
 await(await chooserPromise).setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...before,version:99}))});
 await expect(page.getByRole('alert')).toContainText('恢复失败');
 expect(await stateOf(page)).toEqual(before);
 await clickNav(page,'关闭弹窗');await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');expect((await stateOf(page)).settings.accent).toBe('green');
});

test('样例页面截图与 1000×680 窗口布局验收',async({page})=>{
 await ready(page);await page.getByRole('button',{name:/^完成新版本的设计评审/}).click();await expect(page.getByRole('textbox',{name:'任务标题',exact:true})).toHaveValue('完成新版本的设计评审');await screenshot(page,'today');
 for(const [name,file] of [['日历','calendar'],['四象限','matrix'],['习惯','habits'],['专注','focus']]){await clickNav(page,name);await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();await screenshot(page,file);}
 await clickNav(page,'任务');await clickNav(page,'设置');await page.getByRole('combobox',{name:'界面主题'}).selectOption('dark');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await clickNav(page,'关闭弹窗');await screenshot(page,'dark');
 await page.setViewportSize({width:1000,height:680});
 for(const name of ['任务','日历','四象限','习惯','专注']){
  await clickNav(page,name);
  const dimensions=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
  expect(dimensions.document,`${name}: document 横向溢出`).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.body,`${name}: body 横向溢出`).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.getByRole('button',{name:'设置',exact:true})).toBeInViewport();
  await expect(page.getByRole('button',{name:'搜索任务',exact:true})).toBeInViewport();
 }
 await clickNav(page,'任务');await expect(page.getByRole('textbox',{name:'快速添加任务'})).toBeInViewport();
});

test('清空废纸篓需确认，取消与关闭不删除，清空后保留其他任务并持久化',async({page})=>{
 await ready(page);
 await page.getByRole('button',{name:/^废纸篓/}).click();
 await expect(page.getByRole('button',{name:'清空废纸篓',exact:true})).toBeDisabled();
 await clickNav(page,'任务');
 const before=await stateOf(page);
 for(const title of ['整批删除任务 A','整批删除任务 B']){
  await page.getByRole('textbox',{name:'快速添加任务'}).fill(title);
  await page.getByRole('textbox',{name:'快速添加任务'}).press('Enter');
  await page.locator('.task-content').filter({hasText:title}).click();
  await clickNav(page,'删除当前任务');
 }
 await page.getByRole('button',{name:/^废纸篓/}).click();
 await clickNav(page,'清空废纸篓');
 const dialog=page.getByRole('dialog',{name:'清空废纸篓',exact:true});
 await expect(dialog.getByRole('heading',{name:'永久删除废纸篓中的 2 项任务？'})).toBeVisible();
 await expect(dialog).toContainText('无法撤销');
 await dialog.getByRole('button',{name:'取消',exact:true}).click();
 expect((await stateOf(page)).tasks.filter(t=>t.deleted)).toHaveLength(2);
 await clickNav(page,'清空废纸篓');await page.keyboard.press('Escape');
 expect((await stateOf(page)).tasks.filter(t=>t.deleted)).toHaveLength(2);
 await page.setViewportSize({width:1000,height:680});
 await expect(page.getByRole('button',{name:'清空废纸篓',exact:true})).toBeInViewport();
 await clickNav(page,'清空废纸篓');
 await expect(dialog.getByRole('button',{name:'永久删除全部'})).toBeInViewport();
 await page.screenshot({path:'artifacts/ui-empty-trash-confirm.png',animations:'disabled'});
 await dialog.getByRole('button',{name:'永久删除全部'}).click();
 await expect(page.getByRole('button',{name:'清空废纸篓',exact:true})).toBeDisabled();
 await expect(page.getByRole('textbox',{name:'任务标题',exact:true})).toHaveCount(0);
 await expect(page.getByText('这里干干净净',{exact:true})).toBeVisible();
 await expect.poll(async()=>(await stateOf(page)).tasks).toEqual(before.tasks);
 await page.reload();await page.getByRole('button',{name:/^废纸篓/}).click();
 await expect(page.getByRole('button',{name:'清空废纸篓',exact:true})).toBeDisabled();
 expect((await stateOf(page)).tasks).toEqual(before.tasks);
});
