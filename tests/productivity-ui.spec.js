import {test,expect} from '@playwright/test';

const stateOf=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-state-v1')));
const nav=(page,name)=>page.getByRole('button',{name,exact:true}).click();
const row=(page,title)=>page.locator('.main-area .task-row').filter({has:page.locator('.task-title',{hasText:title})});
const input=page=>page.getByRole('textbox',{name:'快速添加任务'});
async function ready(page){await page.goto('/');await expect(page.locator('.main-area h1')).toHaveText('今天');}
async function add(page,text){await input(page).fill(text);await input(page).press('Enter');await expect(input(page)).toHaveValue('');}
async function checkTask(page,title,patch){await expect.poll(async()=>{const task=(await stateOf(page)).tasks.find(t=>t.title===title);return task&&Object.fromEntries(Object.keys(patch).map(k=>[k,task[k]]));}).toEqual(patch);}
async function createList(page){await nav(page,'添加清单');await page.getByRole('textbox',{name:'清单名称'}).fill('捷径验收');await nav(page,'保存');await nav(page,'捷径验收');}
const bulk=page=>page.locator('.bulk-toolbar');

test('连续快速输入保持焦点和关闭的详情，识别时间优先级，错误输入可修改',async({page})=>{
 await ready(page);await nav(page,'收起详情');
 await add(page,'明天下午3点 捷径会议 !高 #工作 #工作');
 await expect(input(page)).toBeFocused();await expect(page.locator('.detail-panel')).toHaveCount(0);
 const task=(await stateOf(page)).tasks.find(t=>t.title==='捷径会议');
 expect(task.priority).toBe(3);expect(task.tags).toEqual(['工作']);
 const stamp=new Date(task.reminder);expect(stamp.getHours()).toBe(15);expect(stamp.getMinutes()).toBe(0);
 await add(page,'第二条连续任务');await expect(input(page)).toBeFocused();
 await input(page).fill('2026-02-30 无效日期任务');await input(page).press('Enter');
 await expect(input(page)).toHaveValue('2026-02-30 无效日期任务');
 await expect(page.getByRole('status')).toContainText('日期无效');
 expect((await stateOf(page)).tasks.some(t=>t.title==='无效日期任务')).toBe(false);
 await input(page).fill('下周一 15:00 预览排期 !中 #会议');
 await expect(page.locator('.quick-help')).toContainText('15:00');
 await page.screenshot({path:'artifacts/ui-quick-capture.png',animations:'disabled'});
});

test('悬停快捷操作不替换所选任务，改期联动提醒且可撤销',async({page})=>{
 await ready(page);await nav(page,'所有任务');await add(page,'明天15:00 行内操作验收');
 await row(page,'完成新版本的设计评审').locator('.task-content').click();
 const original=(await stateOf(page)).tasks.find(t=>t.title==='行内操作验收');
 await row(page,'行内操作验收').hover();await nav(page,'调整日期 行内操作验收');
 await page.getByRole('menuitem',{name:'下周一',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'任务标题',exact:true})).toHaveValue('完成新版本的设计评审');
 await nav(page,'撤销');await checkTask(page,'行内操作验收',{due:original.due,reminder:original.reminder});
 await row(page,'行内操作验收').hover();await nav(page,'调整优先级 行内操作验收');
 await page.getByRole('menuitem',{name:'高优先级',exact:true}).click();
 await checkTask(page,'行内操作验收',{priority:3});
 await row(page,'行内操作验收').locator('.task-content').click();await nav(page,'设为清除日期');
 await checkTask(page,'行内操作验收',{due:'',reminder:''});
 await nav(page,'设为明天');await checkTask(page,'行内操作验收',{due:original.due});
 await row(page,'行内操作验收').hover();await nav(page,'删除 行内操作验收');
 await checkTask(page,'行内操作验收',{deleted:true});await nav(page,'撤销');
 await checkTask(page,'行内操作验收',{deleted:false});
});

test('连续多选支持批量改期、移动、删除与撤销，批量永久删除需要确认',async({page})=>{
 await ready(page);await createList(page);
 for(const title of ['批量捷径一','批量捷径二','批量捷径三'])await add(page,title);
 const titles=await page.locator('.main-area .task-row .task-title').allTextContents();
 async function selectAll(){await row(page,titles[0]).locator('.task-content').click({modifiers:['Meta']});await row(page,titles[2]).locator('.task-content').click({modifiers:['Shift']});await expect(bulk(page)).toContainText('已选 3 项');}
 await selectAll();await bulk(page).getByRole('button',{name:'日期',exact:true}).click();
 await page.getByRole('menuitem',{name:'明天',exact:true}).click();
 expect((await stateOf(page)).tasks.filter(t=>titles.includes(t.title)).every(t=>t.due)).toBe(true);
 await nav(page,'撤销');expect((await stateOf(page)).tasks.filter(t=>titles.includes(t.title)).every(t=>!t.due)).toBe(true);
 await selectAll();await bulk(page).getByRole('button',{name:'移动',exact:true}).click();await page.getByRole('menuitem',{name:'工作项目',exact:true}).click();
 await expect(page.locator('.main-area .task-row')).toHaveCount(0);await nav(page,'撤销');await expect(page.locator('.main-area .task-row')).toHaveCount(3);
 await selectAll();await page.screenshot({path:'artifacts/ui-bulk-actions.png',animations:'disabled'});
 await bulk(page).getByRole('button',{name:'删除',exact:true}).click();await nav(page,'撤销');
 await expect(page.locator('.main-area .task-row')).toHaveCount(3);
 await selectAll();await bulk(page).getByRole('button',{name:'删除',exact:true}).click();await page.getByRole('button',{name:/^废纸篓/}).click();
 await nav(page,'批量选择');await bulk(page).getByRole('button',{name:'全选',exact:true}).click();await bulk(page).getByRole('button',{name:'永久删除',exact:true}).click();
 await page.getByRole('dialog',{name:'永久删除所选任务'}).getByRole('button',{name:'取消',exact:true}).click();
 expect((await stateOf(page)).tasks.filter(t=>t.deleted)).toHaveLength(3);
 await bulk(page).getByRole('button',{name:'永久删除',exact:true}).click();await nav(page,'永久删除所选');
 expect((await stateOf(page)).tasks.some(t=>titles.includes(t.title))).toBe(false);
});

test('批量完成重复任务后撤销，不留下重复实例；废纸篓可批量恢复',async({page})=>{
 await ready(page);const before=(await stateOf(page)).tasks;
 await row(page,'傍晚散步 30 分钟').locator('.task-content').click({modifiers:['Meta']});
 await row(page,'给阳台的植物浇水').locator('.task-content').click({modifiers:['Meta']});
 await bulk(page).getByRole('button',{name:'完成',exact:true}).click();
 expect((await stateOf(page)).tasks.some(t=>t.id==='walk:next')).toBe(true);
 await nav(page,'撤销');expect((await stateOf(page)).tasks).toEqual(before);
 await row(page,'给阳台的植物浇水').hover();await nav(page,'删除 给阳台的植物浇水');
 await page.getByRole('button',{name:/^废纸篓/}).click();await nav(page,'批量选择');await bulk(page).getByRole('button',{name:'全选',exact:true}).click();await bulk(page).getByRole('button',{name:'恢复',exact:true}).click();
 await checkTask(page,'给阳台的植物浇水',{deleted:false});await nav(page,'撤销');await checkTask(page,'给阳台的植物浇水',{deleted:true});
});

test('右键菜单复制移动和专注，靠近窗口边缘可用；废纸篓右键清空可取消',async({page})=>{
 await ready(page);await nav(page,'所有任务');await page.setViewportSize({width:1000,height:680});
 await row(page,'给阳台的植物浇水').evaluate(el=>el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:995,clientY:675})));
 const menu=page.getByRole('menu');await expect(menu).toBeInViewport();
 const bounds=await menu.boundingBox();expect(bounds.x).toBeGreaterThan(700);expect(bounds.y).toBeGreaterThan(300);expect(bounds.x+bounds.width).toBeLessThanOrEqual(1000);expect(bounds.y+bounds.height).toBeLessThanOrEqual(680);
 await page.screenshot({path:'artifacts/ui-context-menu.png',animations:'disabled'});
 await page.getByRole('menuitem',{name:'复制任务',exact:true}).click();
 await checkTask(page,'给阳台的植物浇水（副本）',{completed:false,deleted:false});
 await row(page,'完成新版本的设计评审').click({button:'right'});await page.getByRole('menuitem',{name:'移动到清单',exact:true}).click();await page.getByRole('menuitem',{name:'收集箱',exact:true}).click();
 await checkTask(page,'完成新版本的设计评审',{listId:'inbox'});
 await row(page,'完成新版本的设计评审').click({button:'right'});await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
 await row(page,'完成新版本的设计评审').click({button:'right'});await page.getByRole('menuitem',{name:'开始专注',exact:true}).click();
 await expect(page.locator('.main-area h1')).toHaveText('专注');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-timer')).taskId)).toBe('design-review');
 await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeVisible();
 await page.getByRole('button',{name:/^废纸篓/}).click({button:'right'});await page.getByRole('menuitem',{name:'清空废纸篓',exact:true}).click();
 await page.getByRole('dialog',{name:'清空废纸篓',exact:true}).getByRole('button',{name:'取消',exact:true}).click();
 expect((await stateOf(page)).tasks.filter(t=>t.deleted)).toHaveLength(0);
});

test('键盘逐项完成和编辑不干扰输入或按钮，命令面板支持方向键与直接执行',async({page})=>{
 await ready(page);const rows=page.locator('.main-area .task-row');const ids=await rows.evaluateAll(els=>els.map(el=>el.dataset.taskId));
 await rows.first().locator('.task-content').click();await page.keyboard.press('ArrowDown');
 await expect(rows.nth(1)).toBeFocused();await page.keyboard.press('Space');
 expect((await stateOf(page)).tasks.find(t=>t.id===ids[1]).completed).toBe(true);
 await input(page).fill('正在输入');await page.keyboard.press('Space');await expect(input(page)).toHaveValue('正在输入 ');
 await nav(page,'收起详情');await page.getByRole('button',{name:'展开详情',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('.detail-panel')).toBeVisible();
 await rows.first().locator('.task-content').click();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await expect(page.getByRole('textbox',{name:'任务标题',exact:true})).toBeFocused();
 await page.keyboard.press('Meta+k');await expect(page.getByRole('textbox',{name:'搜索关键词'})).toBeFocused();
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await expect(page.getByRole('textbox',{name:'清单名称'})).toBeVisible();await page.keyboard.press('Escape');
 await page.keyboard.press('Meta+k');await page.getByRole('textbox',{name:'搜索关键词'}).fill('日历');
 await page.screenshot({path:'artifacts/ui-command-palette.png',animations:'disabled'});
 await page.keyboard.press('Enter');await expect(page.locator('.main-area h1')).toHaveText('日历');
 await page.keyboard.press('Meta+k');await page.getByRole('textbox',{name:'搜索关键词'}).fill('开始专注');await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeVisible();
 await page.keyboard.press('Meta+k');await page.getByRole('textbox',{name:'搜索关键词'}).fill('开始专注');const timer=await page.evaluate(()=>localStorage.getItem('shixu-timer'));await page.keyboard.press('Enter');expect(await page.evaluate(()=>localStorage.getItem('shixu-timer'))).toBe(timer);
});

test('页面排序看板详情和滚动位置在刷新后恢复，失效清单回到今天',async({page})=>{
 await ready(page);await nav(page,'所有任务');await createList(page);
 for(let i=0;i<18;i++)await add(page,`恢复位置 ${i}`);
 await page.getByRole('combobox',{name:'排序方式'}).selectOption('created');
 await row(page,'恢复位置 10').locator('.task-content').click();
 const selected=await page.getByRole('textbox',{name:'任务标题',exact:true}).inputValue();
 await page.locator('.main-body').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 const scroll=await page.locator('.main-body').evaluate(el=>el.scrollTop);expect(scroll).toBeGreaterThan(100);
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-workspace-v1')).scrolls)).toMatchObject({[await page.evaluate(()=>JSON.parse(localStorage.getItem('shixu-workspace-v1')).view)]:scroll});
 await page.reload();await expect(page.locator('.main-area h1')).toHaveText('捷径验收');await expect(page.getByRole('combobox',{name:'排序方式'})).toHaveValue('created');await expect(page.getByRole('textbox',{name:'任务标题',exact:true})).toHaveValue(selected);
 await expect.poll(()=>page.locator('.main-body').evaluate(el=>el.scrollTop)).toBe(scroll);
 await nav(page,'看板');await nav(page,'收起详情');await page.reload();await expect(page.locator('.board')).toBeVisible();await expect(page.locator('.detail-panel')).toHaveCount(0);
 await page.addInitScript(()=>{const prefs=JSON.parse(localStorage.getItem('shixu-workspace-v1'));if(prefs){prefs.view='list:missing';localStorage.setItem('shixu-workspace-v1',JSON.stringify(prefs));}});
 await page.reload();await expect(page.locator('.main-area h1')).toHaveText('今天');
});
