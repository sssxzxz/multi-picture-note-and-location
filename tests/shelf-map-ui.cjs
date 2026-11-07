const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.NODE_REPL_NODE_MODULE_DIRS,'playwright'));
const M=require('../app/src/main/assets/model.js');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/49482/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({locale:'en-US',viewport:{width:412,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const state=M.fresh();state.products={a:{model:'A100',price:'9',attrs:{},images:[]},b:{model:'B200',price:'8',attrs:{}}};
  const mark=(id,product,x)=>({id,product,x,y:.4,shape:'dot',angle:0,w:.08,h:.06});
  state.photos=[{id:'p1',name:'入口货架',file:'img_a.jpg',shelfId:'b1-4',marks:[mark('left','a',.2)]},{id:'p2',name:'走廊货架',file:'img_b.jpg',shelfId:'A3',marks:[mark('middle','b',.5),mark('right','a',.8)]},{id:'p3',name:'未绑定',file:'img_c.jpg',marks:[]}];
  await page.addInitScript(state=>{window.saved=sessionStorage.getItem('saved')||JSON.stringify(state);window.failSave=false;window.Native={load:()=>window.saved,save:text=>{if(window.failSave)return 'Storage unavailable';sessionStorage.setItem('saved',text);window.saved=text;return '';},dismissKeyboard:()=>{}};},state);
  await page.route('https://local.app/**',async route=>{const pathname=new URL(route.request().url()).pathname;if(pathname.startsWith('/images/'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#91877b"/><path d="M0 250H1200M0 650H1200" stroke="#51483d" stroke-width="16"/></svg>'});const file=pathname==='/'?'index.html':pathname.slice(1);return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets',file))});});
  await page.goto('https://local.app');await page.waitForFunction(()=>bitmap);
  const highlighted=async(host='#shelfMinimap')=>page.locator(host+' .map-shelf.is-selected').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-shelf')));
  const expectShelf=async id=>assert.deepEqual(await highlighted(),id?[id]:[]);
  const openBinding=async()=>{await page.locator('#menu').click();await page.locator('#bindShelf').click();};
  const savedShelf=()=>page.evaluate(()=>JSON.parse(window.saved).photos.find(p=>p.id==='p1').shelfId||'');
  assert.equal(await page.locator('html').getAttribute('lang'),'en');assert.equal(await page.locator('#fit,#zoomin,#zoomout').count(),0);assert.ok(await page.locator('#shelfMinimap').isVisible());await expectShelf('b1-4');
  assert.equal(await page.locator('#shelfMinimap text').count(),0);assert.equal((await page.locator('#shelfMinimap').innerText()).trim(),'');

  // A draft previews the selected shelf but cannot change the photo until Save.
  await openBinding();assert.equal(await page.locator('#shelfSelect').inputValue(),'b1-4');assert.equal(await page.locator('#shelfSelect option').count(),15);
  await page.locator('#shelfSelect').selectOption('B1-3');assert.deepEqual(await highlighted('#shelfPreview'),['B1-3']);await expectShelf('b1-4');assert.equal(await savedShelf(),'b1-4');
  await page.screenshot({path:path.join(__dirname,'../app/build/shelf-binding.png')});await page.locator('#cancel').click();await expectShelf('b1-4');
  await openBinding();await page.locator('#shelfSelect').selectOption('A6');await page.evaluate(()=>goBack());assert.ok(await page.locator('#bindShelf').isVisible());assert.equal(await savedShelf(),'b1-4');await page.locator('#cancel').click();
  await openBinding();await page.locator('#shelfSelect').selectOption('B1-3');await page.locator('#save').click();await expectShelf('B1-3');assert.equal(await savedShelf(),'B1-3');
  await page.evaluate(()=>undo());await expectShelf('b1-4');await page.evaluate(()=>undo(true));await expectShelf('B1-3');

  // A storage error preserves the saved relationship and allows retry.
  await openBinding();await page.locator('#shelfSelect').selectOption('E');await page.evaluate(()=>window.failSave=true);await page.locator('#save').click();assert.ok(await page.locator('#shelfSelect').isVisible());assert.equal(await savedShelf(),'B1-3');await expectShelf('B1-3');assert.equal(await page.evaluate(()=>state.photos.find(p=>p.id==='p1').shelfId),'B1-3');
  await page.evaluate(()=>window.failSave=false);await page.locator('#save').click();await expectShelf('E');
  await page.reload();await page.waitForFunction(()=>bitmap);await expectShelf('E');

  // Every way of changing the current photo updates the same miniature layout.
  await page.locator('#next').click();await page.waitForFunction(()=>loadedFile==='img_b.jpg');await expectShelf('A3');
  await page.locator('#next').click();await page.waitForFunction(()=>loadedFile==='img_c.jpg');await expectShelf('');assert.ok(await page.locator('#shelfMinimap').isVisible());
  await page.locator('#search').fill('b200');await page.waitForFunction(()=>loadedFile==='img_b.jpg');await expectShelf('A3');
  await page.locator('#search').fill('missing');assert.equal(await page.locator('#shelfMinimap').isVisible(),false);
  await page.locator('#clear').click();await page.waitForFunction(()=>bitmap);await openBinding();await page.locator('#shelfSelect').selectOption('');await page.locator('#save').click();await expectShelf('');assert.equal(await savedShelf(),'');
  await page.evaluate(()=>{products();});await page.locator('#productList button').first().click();await page.locator('#locations button').nth(1).click();await page.waitForFunction(()=>loadedFile==='img_b.jpg');await expectShelf('A3');await page.locator('#locationBack').click();assert.ok(await page.locator('#locations').isVisible());await page.locator('#cancel').click();

  // Backups preserve bindings, while old backups naturally display no highlight.
  await page.evaluate(()=>{const backup=JSON.parse(window.saved);backup.photos[0].shelfId='D2';window.saved=JSON.stringify(backup);onRestored();});await page.waitForFunction(()=>bitmap);await page.evaluate(()=>{current='p1';refresh();});await page.waitForFunction(()=>loadedFile==='img_a.jpg');await expectShelf('D2');
  await page.evaluate(()=>{const backup=JSON.parse(window.saved);for(const photo of backup.photos)delete photo.shelfId;window.saved=JSON.stringify(backup);onRestored();});await page.waitForFunction(()=>bitmap);await expectShelf('');
  await page.evaluate(()=>{state.photos[0].shelfId='A6';persist();current='p1';refresh();});await page.waitForFunction(()=>loadedFile==='img_a.jpg');
  await page.evaluate(()=>{state.settings.language='zh-CN';persist();refresh(false);});await openBinding();assert.match(await page.locator('#dialogBody').innerText(),/货架/);assert.equal(await page.locator('#shelfSelect').inputValue(),'A6');await page.locator('#cancel').click();

  // The compact map stays legible and stationary during canvas manipulation.
  const originalBox=await page.locator('#shelfMinimap').boundingBox();assert.ok(originalBox.width<=150&&originalBox.height<=160);assert.ok(originalBox.x<24&&originalBox.y+originalBox.height<=850);
  await page.evaluate(()=>{zoom(1.5);tx+=130;ty-=60;draw();});assert.deepEqual(await page.locator('#shelfMinimap').boundingBox(),originalBox);
  await page.evaluate(()=>setToolsHidden(true));assert.ok(await page.locator('#shelfMinimap').isVisible());await expectShelf('A6');await page.evaluate(()=>setToolsHidden(false));
  await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:path.join(__dirname,'../app/build/shelf-minimap.png')});
  for(const viewport of [{width:320,height:640},{width:320,height:480},{width:850,height:412}]){
   await page.setViewportSize(viewport);await page.locator('#edit').click();const map=await page.locator('#shelfMinimap').boundingBox(),bar=await page.locator('#editbar').boundingBox();assert.ok(map.x>=0&&map.y>=0&&map.x+map.width<=viewport.width&&map.y+map.height<=viewport.height);assert.ok(bar.y+bar.height<=map.y||bar.x>=map.x+map.width,'编辑工具不能覆盖小地图');assert.ok(await page.locator('#editbar').evaluate(el=>el.scrollWidth<=el.clientWidth),'编辑按钮不应被横向裁切');await page.locator('#edit').click();
  }
  await page.evaluate(()=>{state=M.fresh();persist();current=null;refresh();});assert.equal(await page.locator('#shelfMinimap').isVisible(),false);await page.locator('#menu').click();assert.ok(await page.locator('#bindShelf').isDisabled());
  assert.deepEqual(errors,[]);console.log('通过：货架选择预览、取消/返回、保存失败重试、撤销重做、切图/搜索/定位、重启与新旧备份、无文字小地图、双语、固定布局及横竖屏编辑避让。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
