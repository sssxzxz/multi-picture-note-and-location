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

  const open=async()=>{await page.locator('#menu').click();await page.locator('#display').click();await page.locator('#mapSettings').click();};
  const angle=()=>page.evaluate(()=>state.settings.mapRotation);
  const map=page.locator('#shelfMinimap');const bounds=await map.boundingBox();
  await open();for(const n of [90,180,270,0]){await page.locator('#rotateMap').click();assert.equal(await page.locator('#rotationValue').innerText(),n+'°');assert.match(await page.locator('#shelfPreview g').getAttribute('transform'),new RegExp('rotate\\('+n+' '));}assert.equal(await angle(),0);
  await page.locator('#rotateMap').click();await page.screenshot({path:path.join(__dirname,'../app/build/map-rotation-preview.png')});await page.locator('#cancel').click();assert.equal(await angle(),0);
  await open();await page.locator('#rotateMap').click();await page.evaluate(()=>goBack());assert.equal(await angle(),0);await page.locator('#cancel').click();
  await open();await page.locator('#rotateMap').click();await page.evaluate(()=>window.failSave=true);await page.locator('#save').click();assert.equal(await angle(),0);assert.ok(await page.locator('#rotateMap').isVisible());await page.evaluate(()=>window.failSave=false);await page.locator('#save').click();assert.equal(await angle(),90);assert.deepEqual(await map.boundingBox(),bounds);assert.equal(await page.locator('#shelfMinimap .is-selected').getAttribute('data-shelf'),'b1-4');
  await page.reload();await page.waitForFunction(()=>bitmap);assert.equal(await angle(),90);
  await page.evaluate(()=>{state.settings.mapRotation=270;persist();onRestored();});assert.equal(await angle(),270);
  await page.evaluate(()=>{const s=JSON.parse(window.saved);delete s.settings.mapRotation;window.saved=JSON.stringify(s);onRestored();});assert.equal(await angle(),0);
  await page.evaluate(()=>{state.photos[0].marks.push({...state.photos[0].marks[0],id:'further-left',x:.01});refresh();});
  await page.locator('#search').fill('a100');assert.equal(await page.evaluate(()=>targetId),'further-left');
  await page.locator('#search').evaluate(e=>{e.dispatchEvent(new CompositionEvent('compositionstart'));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));e.dispatchEvent(new CompositionEvent('compositionend'));e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));});assert.equal(await page.evaluate(()=>targetId),'further-left');
  await page.locator('#search').press('Enter');assert.equal(await page.evaluate(()=>targetId),'left');
  await page.locator('#search').evaluate(e=>e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})));assert.equal(await page.evaluate(()=>targetId),'left');
  await page.locator('#search').press('Enter');assert.equal(await page.evaluate(()=>current),'p2');assert.equal(await page.evaluate(()=>targetId),'right');
  await page.locator('#search').press('Enter');assert.equal(await page.evaluate(()=>targetId),'right');
  assert.ok(await page.evaluate(()=>{const m=p().marks.find(m=>m.id===targetId);return Math.abs(tx+m.x*bitmap.width*scale-cw/2)<.01;}));
  await page.locator('#search').fill('missing');await page.locator('#search').press('Enter');assert.equal(await page.evaluate(()=>current),null);await page.locator('#search').fill('');await page.locator('#search').press('Enter');assert.equal(await page.evaluate(()=>current),'p1');
  assert.equal(await page.locator('#search').getAttribute('enterkeyhint'),'search');assert.deepEqual(errors,[]);
  console.log('通过：90度四方向预览/取消/返回/失败重试/重启/备份兼容、固定排版及高亮、回车同图/跨图跳转、末尾/空结果边界、输入法确认不跳转。');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
