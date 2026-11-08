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

  const order=()=>page.evaluate(()=>state.photos.map(p=>p.id));
  const draft=()=>page.locator('#photoOrder > div').evaluateAll(rows=>rows.map(r=>r.dataset.id));
  const open=async()=>{await page.locator('#photos').click();await page.locator('#sortPhotos').click();};
  const snapshot=await page.evaluate(()=>Object.fromEntries(state.photos.map(p=>[p.id,JSON.stringify(p)])));
  await open();assert.deepEqual(await draft(),['p1','p2','p3']);await page.screenshot({path:path.join(__dirname,'../app/build/photo-order-preview.png')});
  await page.locator('.order-down').first().click();assert.deepEqual(await draft(),['p2','p1','p3']);assert.deepEqual(await order(),['p1','p2','p3']);
  await page.locator('#cancel').click();assert.deepEqual(await order(),['p1','p2','p3']);
  await open();await page.locator('.order-up').last().click();await page.evaluate(()=>goBack());assert.ok(await page.locator('#photoList').isVisible());await page.locator('#cancel').click();
  await open();
  const a=await page.locator('.order-handle').last().boundingBox(),b=await page.locator('.photo-order-row').first().boundingBox();
  const touch=await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a.x+a.width/2,y:a.y+a.height/2,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+a.width/2,y:b.y+3,id:1}]});
  await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.deepEqual(await draft(),['p3','p1','p2']);
  await page.evaluate(()=>window.failSave=true);await page.locator('#save').click();assert.ok(await page.locator('#photoOrder').isVisible());assert.deepEqual(await order(),['p1','p2','p3']);
  await page.evaluate(()=>window.failSave=false);await page.locator('#save').click();assert.deepEqual(await order(),['p3','p1','p2']);assert.equal(await page.evaluate(()=>current),'p1');
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(state.photos.map(p=>[p.id,JSON.stringify(p)]))),snapshot);
  await page.locator('#next').click();assert.equal(await page.evaluate(()=>current),'p2');await page.locator('#next').click();assert.equal(await page.evaluate(()=>current),'p3');
  await page.evaluate(()=>undo());assert.deepEqual(await order(),['p1','p2','p3']);await page.evaluate(()=>undo(true));assert.deepEqual(await order(),['p3','p1','p2']);
  await open();await page.locator('.order-up').last().click();await page.locator('.order-up').nth(1).click();await page.locator('#save').click();assert.deepEqual(await order(),['p2','p3','p1']);
  await page.locator('#search').fill('a100');assert.equal(await page.evaluate(()=>current),'p2');await page.locator('#targetNext').click();assert.equal(await page.evaluate(()=>current),'p1');
  await page.reload();await page.waitForFunction(()=>bitmap);assert.deepEqual(await order(),['p2','p3','p1']);
  await page.evaluate(()=>{const backup=JSON.stringify(state);state.photos.reverse();window.saved=backup;onRestored();});assert.deepEqual(await order(),['p2','p3','p1']);
  // A long list supports edge autoscroll, cancellation and narrow-screen controls.
  await page.evaluate(()=>{state.photos=Array.from({length:20},(_,i)=>({id:'x'+i,name:'Long photo name '+i,file:'img_a.jpg',marks:[]}));current='x0';refresh();});
  await page.setViewportSize({width:320,height:640});await open();
  assert.ok(await page.locator('#photoOrder').evaluate(e=>e.scrollWidth<=e.clientWidth));
  const first=await page.locator('.order-handle').first().boundingBox(),host=await page.locator('#photoOrder').boundingBox();
  await page.mouse.move(first.x+15,first.y+15);await page.mouse.down();await page.mouse.move(first.x+15,host.y+host.height-2,{steps:8});
  await page.waitForFunction(()=>document.querySelector('#photoOrder').scrollTop>70);
  await page.mouse.up();assert.notEqual((await draft())[0],'x0');await page.locator('#cancel').click();assert.equal((await order())[0],'x0');
  await page.evaluate(()=>{state.photos=state.photos.slice(0,1);refresh();});await page.locator('#photos').click();assert.ok(await page.locator('#sortPhotos').isDisabled());
  assert.deepEqual(errors,[]);console.log('通过：触摸拖动、长列表自动滚动、按钮排序、取消/返回、保存失败重试、撤销重做、切图/搜索顺序、重启/备份恢复及货架标记保持。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
