const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.NODE_REPL_NODE_MODULE_DIRS,'playwright'));
const M=require('../app/src/main/assets/model.js');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/49482/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({locale:"zh-CN",viewport:{width:412,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const s=M.fresh();s.products={a:{model:'Ab12',price:'9',attrs:{材质:'木'},images:[]},b:{model:'ab12',price:'8',attrs:{}},c:{model:'C9',price:'7',attrs:{}}};
 const mark=(id,product,x,y)=>({id,product,x,y,shape:'dot',angle:0,w:.08,h:.06});
 s.photos=[{id:'p1',name:'第一张',file:'img_a.jpg',marks:[mark('right','a',.7,.4),mark('left','a',.05,.4),mark('middle','b',.4,.6),mark('other','c',.5,.7)]},{id:'p2',name:'第二张',file:'img_b.jpg',marks:[mark('last','a',.1,.4)]}];
 await page.addInitScript(s=>{window.saved=sessionStorage.getItem('saved')||JSON.stringify(s);window.Native={load:()=>window.saved,save:t=>{sessionStorage.setItem('saved',t);window.saved=t;return '';},importPrices:request=>window.priceToken=request};},s);
 await page.route('https://local.app/**',async route=>{const u=new URL(route.request().url());if(u.pathname.startsWith('/images'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#91877b"/><path d="M0 250H1200M0 650H1200" stroke="#51483d" stroke-width="16"/></svg>'});const file=u.pathname==='/'?'index.html':u.pathname.slice(1);await route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets',file))});});
 await page.goto('https://local.app');await page.waitForFunction(()=>bitmap);

 const reset=async(enabled)=>{await page.evaluate(({initial,enabled})=>{document.querySelectorAll('dialog[open]').forEach(d=>d.close());state=JSON.parse(JSON.stringify(initial));state.settings.confirmDeletion=enabled;state.products.a.images=['img_one.jpg','img_two.jpg'];state.photos[0].annotations=[{id:'ink',type:'stroke',color:'#ff0000',width:.01,points:[[.1,.1],[.2,.2]]},{id:'txt',type:'text',color:'#00ff00',size:.02,x:.3,y:.3,text:'原文字'}];current='p1';q='';targetId=null;editing=true;history=[];future=[];persist();refresh();window.deletionToasts=[];window.toast=t=>window.deletionToasts.push(t);}, {initial:s,enabled});await page.waitForFunction(()=>bitmap);};
 await reset(true);await page.evaluate(()=>settings());assert.ok(await page.locator('#confirmDeletion').isChecked());await page.locator('#confirmDeletion').uncheck();await page.locator('#save').click();await page.reload();await page.waitForFunction(()=>bitmap);assert.equal(await page.evaluate(()=>state.settings.confirmDeletion),false);await page.evaluate(()=>onRestored());assert.equal(await page.evaluate(()=>state.settings.confirmDeletion),false);
 const ops=['mark','photo','product','batch','image','stroke','text'];
 for(const enabled of [true,false])for(const op of ops){
  await reset(enabled);const before=await page.evaluate(()=>JSON.stringify(state));
  if(op==='mark')await page.evaluate(()=>editMark(p().marks[0]));
  if(op==='photo')await page.evaluate(()=>manage());
  if(op==='product'||op==='batch'){await page.evaluate(()=>products());if(op==='product')await page.locator('#productList button').filter({hasText:/^Ab12 ·/}).click();else await page.locator('#selectAllProducts').click();}
  if(op==='image'){await page.evaluate(()=>editMark(p().marks[0]));await page.locator('#price').fill('未保存价格');}
  if(op==='stroke'||op==='text')await page.evaluate(op=>editAnnotation(p().annotations.find(a=>a.type===(op==='stroke'?'stroke':'text'))),op);
  const selector={mark:'#deleteMark',photo:'#removePhoto',product:'#deleteProduct',batch:'#deleteProducts',image:'#productImages .danger',stroke:'#deleteAnnotation',text:'#deleteAnnotation'}[op];
  await page.locator(selector).first().click();
  if(enabled){
   assert.ok(await page.locator('#deleteConfirm').evaluate(e=>e.open));assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
   if(op==='batch')assert.ok((await page.locator('#deleteMessage').innerText()).includes('3 个商品'));
   await page.locator('#cancelDelete').click();assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);assert.ok(await page.locator('#dialog').evaluate(e=>e.open));
   if(op==='image')assert.equal(await page.locator('#price').inputValue(),'未保存价格');
   await page.locator(selector).first().click();await page.locator('#confirmDelete').click();
  }else assert.equal(await page.locator('#deleteConfirm[open]').count(),0);
  if(op==='image'){
   assert.equal(await page.locator('#productImages img').count(),1);assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
   await page.locator('#cancel').click();assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
   await page.evaluate(()=>editMark(p().marks[0]));await page.locator(selector).first().click();if(enabled)await page.locator('#confirmDelete').click();await page.locator('#save').click();assert.deepEqual(await page.evaluate(()=>state.products.a.images),['img_two.jpg']);
  }else{
   assert.ok(!await page.locator('#dialog').evaluate(e=>e.open));
   if(op==='mark')assert.equal(await page.evaluate(()=>state.photos[0].marks.length),3);
   if(op==='photo')assert.equal(await page.evaluate(()=>state.photos.length),1);
   if(op==='product')assert.ok(await page.evaluate(()=>!state.products.a&&state.photos.every(p=>p.marks.every(m=>m.product!=='a'))));
   if(op==='batch')assert.ok(await page.evaluate(()=>Object.keys(state.products).length===0&&state.photos.every(p=>p.marks.length===0)));
   if(op==='stroke'||op==='text')assert.equal(await page.evaluate(()=>p().annotations.length),1);
  }
  assert.deepEqual(await page.evaluate(()=>window.deletionToasts),[]);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 }
 await reset(true);await page.evaluate(()=>editMark(p().marks[0]));await page.locator('#model').fill('未保存的型号');await page.locator('#deleteMark').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#model').inputValue(),'未保存的型号');assert.ok(await page.locator('#dialog').evaluate(e=>e.open));
 await page.locator('#deleteMark').click();await page.screenshot({path:path.join(__dirname,'../app/build/delete-confirm-preview.png')});
 assert.deepEqual(errors,[]);console.log('通过：七类删除开启/关闭、确认/取消、关联删除与撤销、批量只确认一次、附图草稿保留、无结果提示、Esc保留编辑、开关重启与恢复。');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
