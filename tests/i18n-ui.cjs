const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.NODE_REPL_NODE_MODULE_DIRS,'playwright'));
const M=require('../app/src/main/assets/model.js');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/49482/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({locale:"bg-BG",viewport:{width:412,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const s=M.fresh();s.products={a:{model:'Ab12',price:'9',attrs:{材质:'木'},images:[]},b:{model:'ab12',price:'8',attrs:{}},c:{model:'C9',price:'7',attrs:{}}};
 const mark=(id,product,x,y)=>({id,product,x,y,shape:'dot',angle:0,w:.08,h:.06});
 s.photos=[{id:'p1',name:'第一张',file:'img_a.jpg',marks:[mark('right','a',.7,.4),mark('left','a',.05,.4),mark('middle','b',.4,.6),mark('other','c',.5,.7)]},{id:'p2',name:'第二张',file:'img_b.jpg',marks:[mark('last','a',.1,.4)]}];
 await page.addInitScript(s=>{window.saved=sessionStorage.getItem('saved')||JSON.stringify(s);window.Native={load:()=>window.saved,save:t=>{sessionStorage.setItem('saved',t);window.saved=t;return '';},importPrices:request=>window.priceToken=request};},s);
 await page.route('https://local.app/**',async route=>{const u=new URL(route.request().url());if(u.pathname.startsWith('/images'))return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#91877b"/><path d="M0 250H1200M0 650H1200" stroke="#51483d" stroke-width="16"/></svg>'});const file=u.pathname==='/'?'index.html':u.pathname.slice(1);await route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(path.join(__dirname,'../app/src/main/assets',file))});});
 await page.goto('https://local.app');await page.waitForFunction(()=>bitmap);assert.equal(await page.evaluate(()=>I18n.language),'bg');
 const baseline=await page.evaluate(()=>JSON.stringify({photos:state.photos,products:state.products}));
 const catalogs=JSON.parse(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/locales.json'),'utf8'));const keys=Object.keys(catalogs.en).sort();for(const dict of Object.values(catalogs)){assert.deepEqual(Object.keys(dict).sort(),keys);assert.ok(Object.values(dict).every(v=>typeof v==='string'&&v.trim()));}
 for(const lang of ['zh-CN','zh-TW','en','bg','ja','ko','ru','de','fr','es']){
  await page.evaluate(()=>{settings();});await page.locator('#languageSettings').click();await page.locator('#languageSelect').selectOption(lang);assert.equal(await page.evaluate(()=>I18n.language),lang);assert.equal(await page.locator('#menu').innerText(),await page.evaluate(()=>T('管理')));await page.evaluate(()=>goBack());assert.equal(await page.locator('#dialog h2').innerText(),await page.evaluate(()=>T('统一显示设置')));await page.evaluate(()=>products());await page.locator('#productSearch').fill('aB');assert.equal(await page.locator('#productList button').count(),2);await page.locator('#productList button').first().click();assert.equal(await page.locator('#dialog h2').innerText(),'Ab12');await page.locator('#deleteProduct').click();assert.equal(await page.locator('#deleteTitle').innerText(),await page.evaluate(()=>T('删除所选商品？')));await page.evaluate(()=>goBack());await page.locator('#locations button').first().click();assert.equal(await page.locator('#locationBack').innerText(),await page.evaluate(()=>T('返回')));await page.locator('#locationBack').click();await page.evaluate(()=>goBack());assert.equal(await page.locator('#productSearch').inputValue(),'aB');
  assert.equal(await page.evaluate(()=>JSON.stringify({photos:state.photos,products:state.products})),baseline);
  if(['bg','ja','en'].includes(lang)){await page.evaluate(()=>settings());await page.screenshot({path:path.join(__dirname,'../app/build/language-'+lang+'.png')});}
 }
 await page.reload();await page.waitForFunction(()=>bitmap);assert.equal(await page.evaluate(()=>I18n.language),'es');await page.evaluate(()=>{state.settings.language='ja';persist();state.settings.language='en';onRestored();});assert.equal(await page.evaluate(()=>I18n.language),'ja');
 assert.equal(await page.evaluate(()=>I18n.resolve('auto','pt-BR')),'en');assert.equal(await page.evaluate(()=>I18n.resolve('auto','zh-Hant-HK')),'zh-TW');assert.equal(await page.evaluate(()=>I18n.resolve('auto','ja-JP')),'ja');
 await page.evaluate(()=>{settings();languageSettings();});await page.locator('#languageSelect').selectOption('auto');assert.equal(await page.evaluate(()=>I18n.language),'bg');assert.deepEqual(errors,[]);console.log('通过：十种语言切换、系统语言与英语回退、原文保护、搜索/删除/定位返回、重启与备份恢复、语言包覆盖完整。');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
