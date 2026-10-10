import { test,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
const board='/kanban/11111111-1111-4111-8111-111111111111',drawing='/whiteboard/22222222-2222-4222-8222-222222222222';
test.beforeEach(async({request})=>{await request.post('/api/fixture-reset',{headers:{Authorization:'Bearer fixture:admin'}});});
test('inline/sidebar synchronization, move, delete/undo and accessible mobile',async({page})=>{
 await page.goto(board);await expect(page.getByRole('heading',{name:'Laboratory priorities',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Settings for Review swab results'}).first().click();
 const card=page.getByRole('textbox',{name:'Body of Review swab results'}).first(),sidebar=page.getByRole('textbox',{name:'Sidebar note body'});
 await card.fill('Shared note from the card');await expect(sidebar).toHaveValue('Shared note from the card');
 await sidebar.fill('Edited in the open sidebar');await expect(card).toHaveValue('Edited in the open sidebar');
 await page.getByLabel('Note column',{exact:true}).selectOption({label:'Done'});await expect(page.getByRole('region',{name:'Done'}).getByRole('textbox',{name:'Body of Review swab results'})).toHaveValue('Edited in the open sidebar');
 await page.getByRole('button',{name:'Delete note',exact:true}).click();await page.getByRole('button',{name:'Undo delete',exact:true}).click();await expect(page.getByRole('region',{name:'Done'}).getByRole('textbox',{name:'Body of Review swab results'})).toBeVisible();
 const audit=await new AxeBuilder({page}).analyze();expect(audit.violations.filter(v=>['serious','critical'].includes(v.impact||''))).toEqual([]);
 await page.screenshot({path:'output/playwright/kanban-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.getByLabel('Go to column',{exact:true}).selectOption({label:'Done'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'output/playwright/kanban-mobile.png',fullPage:true});
 await page.setViewportSize({width:1036,height:578});await page.screenshot({path:'output/playwright/kanban-measured-viewport.png',fullPage:true});
 await page.setViewportSize({width:320,height:740});await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'output/playwright/kanban-narrow-dark.png',fullPage:true});
});
test('two editors converge and viewer mutations are rejected',async({browser,request})=>{
 const a=await browser.newContext(),b=await browser.newContext(),v=await browser.newContext();try{
 const pa=await a.newPage(),pb=await b.newPage(),pv=await v.newPage();await Promise.all([pa.goto(board+'?role=editor'),pb.goto(board+'?role=editor2'),pv.goto(board+'?role=viewer')]);
 const ta=pa.getByRole('textbox',{name:'Body of Review swab results'}).first(),tb=pb.getByRole('textbox',{name:'Body of Review swab results'}).first();await Promise.all([ta.fill('Alpha'),tb.fill('Beta')]);await expect(ta).toHaveValue(/Alpha/);await expect(ta).toHaveValue(/Beta/);await expect(tb).toHaveValue(await ta.inputValue());
 await expect(pv.getByRole('textbox',{name:'Body of Review swab results'}).first()).toHaveAttribute('readonly','');
 const rejected=await request.post('/api/collaboration',{headers:{Authorization:'Bearer fixture:viewer'},data:{operation:{type:'resource.delete'}}});expect(rejected.status()).toBe(403);
 await pa.reload();await expect(pa.getByRole('textbox',{name:'Body of Review swab results'}).first()).toHaveValue(/Alpha/);
 }finally{await Promise.all([a.close(),b.close(),v.close()]);}
});
test('official editor remote updates preserve local undo and fullscreen mount',async({page})=>{
 await page.goto('/spike');await page.waitForFunction(()=>Boolean((window as any).editorAPI));
 await page.evaluate(()=>{const w=window as any;const elements=w.spike.make([{type:'rectangle',id:'local',x:100,y:100,width:100,height:80}]);w.editorAPI.updateScene({elements,captureUpdate:w.spike.CaptureUpdateAction.IMMEDIATELY});});
 await page.evaluate(()=>{const w=window as any;const local=w.editorAPI.getSceneElementsIncludingDeleted();const remote=w.spike.make([{type:'ellipse',id:'remote',x:300,y:100,width:80,height:80}]);w.spike.setRemote([...local,...remote]);});
 await page.waitForFunction(()=>Boolean((window as any).editorAPI.getSceneElements().find((e:any)=>e.id==='remote')));
 await page.locator('.excalidraw').click({position:{x:500,y:300}});await page.keyboard.press('Control+z');
 await expect.poll(()=>page.evaluate(()=>(window as any).editorAPI.getSceneElements().map((e:any)=>e.id))).toEqual(['remote']);
 await page.keyboard.press('Control+Shift+z');await expect.poll(()=>page.evaluate(()=>(window as any).editorAPI.getSceneElements().map((e:any)=>e.id).sort())).toEqual(['local','remote']);
 await page.evaluate(()=>{(window as any).beforeFullscreen=(window as any).editorAPI;});
 const full=page.getByRole('button',{name:'Fullscreen',exact:true});await full.click();await expect(page.getByRole('button',{name:'Exit fullscreen',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(full).toBeVisible();expect(await page.evaluate(()=>(window as any).beforeFullscreen===(window as any).editorAPI)).toBe(true);await expect(full).toBeFocused();
 await page.screenshot({path:'output/playwright/whiteboard-desktop.png',fullPage:true});
});
test('same-element remote styling survives undo of a local movement',async({page})=>{
 await page.goto('/spike');await page.waitForFunction(()=>Boolean((window as any).editorAPI));
 await page.evaluate(()=>{const w=window as any;w.spike.setRemote(w.spike.make([{type:'rectangle',id:'shared',x:100,y:100,width:100,height:80}]));});
 await page.waitForFunction(()=>(window as any).editorAPI.getSceneElements().some((e:any)=>e.id==='shared'));
 await page.evaluate(()=>{const w=window as any,e=w.editorAPI.getSceneElements()[0];w.editorAPI.updateScene({elements:[{...e,x:200,version:e.version+1,versionNonce:100}],captureUpdate:w.spike.CaptureUpdateAction.IMMEDIATELY});});
 await page.evaluate(()=>{const w=window as any,e=w.editorAPI.getSceneElements()[0];w.spike.setRemote([{...e,strokeColor:'#e03131',version:e.version+1,versionNonce:101}]);});
 await page.waitForFunction(()=>(window as any).editorAPI.getSceneElements()[0]?.strokeColor==='#e03131');
 await page.locator('.excalidraw').click({position:{x:600,y:300}});await page.keyboard.press('Control+z');
 await expect.poll(()=>page.evaluate(()=>{const e=(window as any).editorAPI.getSceneElements()[0];return {x:e?.x,color:e?.strokeColor};})).toEqual({x:100,color:'#e03131'});
});
test('pending note edit survives an offline connection and retries',async({page,context})=>{
 await page.goto(board);const card=page.getByRole('textbox',{name:'Body of Review swab results'}).first();await expect(card).toBeVisible();await context.setOffline(true);await card.fill('Retained offline draft');await expect(page.getByRole('status').filter({hasText:/pending/})).toContainText('pending');
 await context.setOffline(false);await page.reload();await expect(page.getByRole('textbox',{name:'Body of Review swab results'}).first()).toHaveValue('Retained offline draft');await expect(page.getByRole('status').filter({hasText:/pending/})).toContainText('No pending changes');
});
test('full header pointer drag and keyboard dragging work',async({page})=>{
 await page.goto(board);const header=page.getByRole('button',{name:'Move Review swab results',exact:true}).first(),target=page.getByRole('region',{name:'Done'});await expect(header).toBeVisible();
 const from=await header.boundingBox(),to=await target.boundingBox();expect(from&&to).toBeTruthy();await page.mouse.move(from!.x+from!.width/2,from!.y+from!.height/2);await page.mouse.down();await page.mouse.move(to!.x+to!.width/2,to!.y+100,{steps:12});await page.mouse.up();await expect(target.getByRole('button',{name:'Move Review swab results',exact:true})).toBeVisible();
 const moved=target.getByRole('button',{name:'Move Review swab results',exact:true});await moved.focus();await page.keyboard.press('Space');await page.keyboard.press('ArrowDown');await page.keyboard.press('Space');await expect(page.locator('p[role="status"]').filter({hasText:'moved to Done'})).toHaveText('Review swab results moved to Done.');
});
test('viewer drawing supports pan/zoom, exports and fullscreen exits',async({page})=>{
 await page.goto(drawing+'?role=viewer');await expect(page.getByRole('button',{name:'Fit drawing',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Rename',exact:true})).toHaveCount(0);await expect(page.locator('.excalidraw')).toBeVisible();await page.getByRole('button',{name:'Fullscreen',exact:true}).click();await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();await expect(page.getByRole('button',{name:'Fullscreen',exact:true})).toBeFocused();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Fit drawing',exact:true}).click();await page.screenshot({path:'output/playwright/whiteboard-mobile-viewer.png',fullPage:true});
});
test('drawing import retains image assets through refresh and canonical/PNG/SVG export',async({page})=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB4kAAAAASUVORK5CYII=';
 const snapshot={type:'excalidraw',version:2,elements:[{type:'image',id:'saved-image',x:100,y:100,width:100,height:100,fileId:'pixel',status:'saved',scale:[1,1],version:1,versionNonce:1}],files:{pixel:{id:'pixel',mimeType:'image/png',dataURL:png,created:1}}};
 await page.goto('/whiteboard');await page.locator('input[type=file]').setInputFiles({name:'Image recovery.excalidraw',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(snapshot))});await expect(page.getByRole('heading',{name:'Image recovery',exact:true})).toBeVisible();await expect(page.locator('.excalidraw')).toBeVisible();await page.reload();await expect(page.locator('.excalidraw')).toBeVisible();
 const canonicalPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export .excalidraw',exact:true}).click();const restored=JSON.parse(await readFile(await (await canonicalPromise).path(),'utf8'));expect(restored.files.pixel.dataURL).toBe(png);expect(restored.elements.some((e:any)=>e.id==='saved-image')).toBe(true);
 const pngPromise=page.waitForEvent('download');await page.getByRole('button',{name:'PNG',exact:true}).click();expect((await readFile(await (await pngPromise).path())).subarray(1,4).toString()).toBe('PNG');
 const svgPromise=page.waitForEvent('download');await page.getByRole('button',{name:'SVG',exact:true}).click();expect(await readFile(await (await svgPromise).path(),'utf8')).toContain('<svg');
});
test('remote reconciliation waits for pointer release and remote deletion survives undo',async({page})=>{
 await page.goto('/spike');await page.waitForFunction(()=>Boolean((window as any).editorAPI));await page.evaluate(()=>{const w=window as any;w.spike.setRemote(w.spike.make([{type:'rectangle',id:'shared',x:100,y:100,width:100,height:80}]));});await page.waitForFunction(()=>(window as any).editorAPI.getSceneElements().length===1);
 await page.locator('.canvas-frame').dispatchEvent('pointerdown');await page.evaluate(()=>{const w=window as any,e=w.editorAPI.getSceneElements()[0];w.spike.setRemote([{...e,strokeColor:'#e03131',version:e.version+1,versionNonce:12}]);});await expect.poll(()=>page.evaluate(()=>(window as any).editorAPI.getSceneElements()[0].strokeColor)).not.toBe('#e03131');await page.locator('.canvas-frame').dispatchEvent('pointerup');await page.waitForFunction(()=>(window as any).editorAPI.getSceneElements()[0].strokeColor==='#e03131');
 await page.evaluate(()=>{const w=window as any,e=w.editorAPI.getSceneElements()[0];w.editorAPI.updateScene({elements:[{...e,x:200,version:e.version+1,versionNonce:13}],captureUpdate:w.spike.CaptureUpdateAction.IMMEDIATELY});});await page.evaluate(()=>{const w=window as any,e=w.editorAPI.getSceneElements()[0];w.spike.setRemote([{...e,isDeleted:true,version:e.version+1,versionNonce:14}]);});await page.waitForFunction(()=>(window as any).editorAPI.getSceneElements().length===0);await page.locator('.excalidraw').click({position:{x:600,y:300}});await page.keyboard.press('Control+z');expect(await page.evaluate(()=>(window as any).editorAPI.getSceneElements().length)).toBe(0);
});
