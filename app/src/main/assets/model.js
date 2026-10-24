(function(root){
 'use strict';
 const fresh=()=>({version:1,photos:[],products:{},settings:{confirmDeletion:true,autoHideTools:true,labelsFollowZoom:true,font:14,fields:['model'],shape:'dot',width:.08,height:.06}});
 const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,10);
 function product(s,m){return s.products[m.product]||{model:'',price:'',attrs:{}};}
 function matches(s,p,q){const query=q.toLowerCase();return query?p.marks.filter(m=>product(s,m).model.toLowerCase().includes(query)):[];}
 function results(s,q){return q?s.photos.filter(p=>matches(s,p,q).length):s.photos;}
 function saveProduct(s,m,model,price,attrs,images){
  model=model.trim()||nextModel(s); let key=Object.keys(s.products).find(k=>s.products[k].model===model);
  if(!key) key=(m.product && !model && !product(s,m).model)?m.product:id();
  if(model && product(s,m).model===model) key=m.product;
  s.products[key]={model,price,attrs,images:[...(images===undefined?(s.products[key]?.images||[]):images)]};m.product=key;
 }
 function nextModel(s){
  const used=new Set(Object.values(s.products).map(p=>p.model));let n=Number.isSafeInteger(s.settings.nextModelNumber)?Math.max(1,s.settings.nextModelNumber):1;
  while(used.has('自动编号'+String(n).padStart(4,'0')))n++;
  s.settings.nextModelNumber=n+1;return '自动编号'+String(n).padStart(4,'0');
 }
 function normalize(s){
  const used=new Set(s.photos.flatMap(p=>p.marks.map(m=>m.product)));
  for(const [key,p] of Object.entries(s.products)){if(!used.has(key))delete s.products[key];else if(!p.model.trim())p.model=nextModel(s);}
  if(typeof s.settings.autoHideTools!=='boolean')s.settings.autoHideTools=true;
  if(typeof s.settings.labelsFollowZoom!=='boolean')s.settings.labelsFollowZoom=true;
  if(typeof s.settings.confirmDeletion!=='boolean')s.settings.confirmDeletion=true;
  return s;
 }
 function deleteProducts(s,ids){
  const keys=new Set(ids);for(const p of s.photos)p.marks=p.marks.filter(m=>!keys.has(m.product));
  for(const key of keys)delete s.products[key];normalize(s);
 }
 function validate(s){
  if(!s||s.version!==1||!Array.isArray(s.photos)||!s.products||!s.settings)throw Error('备份格式不正确');
  const models=new Set(),ids=new Set();
  Object.values(s.products).forEach(p=>{if(typeof p.model!=='string'||typeof p.price!=='string'||!p.attrs||typeof p.attrs!=='object')throw Error('商品资料损坏');if(p.images!==undefined&&(!Array.isArray(p.images)||p.images.some(f=>typeof f!=='string'||!/^img_[a-zA-Z0-9-]+\.jpg$/.test(f))||new Set(p.images).size!==p.images.length))throw Error('商品附图资料损坏');if(p.model){if(models.has(p.model))throw Error('型号重复');models.add(p.model);}});
  s.photos.forEach(p=>{validateAnnotations(p);if(!p.id||ids.has(p.id)||!/^img_[a-zA-Z0-9-]+\.jpg$/.test(p.file)||typeof p.name!=='string'||!Array.isArray(p.marks))throw Error('照片资料损坏');ids.add(p.id);p.marks.forEach(m=>{if(!s.products[m.product]||!['dot','rect','ellipse'].includes(m.shape)||!['x','y','w','h','angle'].every(k=>Number.isFinite(m[k]))||m.x<0||m.x>1||m.y<0||m.y>1||m.w<=0||m.h<=0)throw Error('标记资料损坏');});});
  if(!Number.isFinite(s.settings.font)||s.settings.font<8||s.settings.font>40||!Array.isArray(s.settings.fields))throw Error('显示设置损坏');return s;
 }
 function targets(s,q){return s.photos.flatMap(photo=>matches(s,photo,q).slice().sort((a,b)=>a.x-b.x||a.y-b.y).map(mark=>({photo,mark})));}
 function centeredView(w,h,cw,ch,m){
  const cover=Math.max(cw/w,ch/h),edgeX=Math.min(m.x,1-m.x)*w,edgeY=Math.min(m.y,1-m.y)*h;
  const fill=Math.max(edgeX>0?cw/2/edgeX:Infinity,edgeY>0?ch/2/edgeY:Infinity);
  // Fill when possible; cap at 1.5x normal cover to preserve context near edges.
  const scale=Math.min(fill,cover*1.5);
  return {scale,tx:cw/2-m.x*w*scale,ty:ch/2-m.y*h*scale};
 }
 function pricePlan(s,rows,modelCol,priceCol,start){
  const prices=new Map(),conflicts=new Map();let invalid=0;
  for(let i=start;i<rows.length;i++){
   const row=rows[i]||[],model=String(row[modelCol]??'').trim(),raw=String(row[priceCol]??'').trim();
   if(!model&&!raw)continue;
   if(!model||!/^\d+(?:\.\d+)?$/.test(raw)||!Number.isFinite(Number(raw))){invalid++;continue;}
   const price=raw.replace(/^0+(?=\d)/,'').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,''),key=model.toLowerCase();
   if(prices.has(key)&&prices.get(key).price!==price){const values=conflicts.get(key)||new Set([prices.get(key).price]);values.add(price);conflicts.set(key,values);}
   else prices.set(key,{model,price});
  }
  const updates=[];let unmatched=0,unchanged=0,blocked=0;
  for(const [id,p] of Object.entries(s.products)){
   const key=p.model.trim().toLowerCase(),found=prices.get(key);
   if(conflicts.has(key)){blocked++;continue;}if(!found){unmatched++;continue;}
   if(p.price===found.price){unchanged++;continue;}updates.push({id,model:p.model,before:p.price,price:found.price});
  }
  return {updates,invalid,unmatched,unchanged,blocked,conflicts:[...conflicts].map(([key,values])=>({model:prices.get(key).model,prices:[...values]}))};
 }
 function validateAnnotations(photo){
  if(photo.annotations===undefined)return;
  if(!Array.isArray(photo.annotations)||photo.annotations.length>5000)throw Error('照片批注损坏');
  const ids=new Set(),unit=v=>Number.isFinite(v)&&v>=0&&v<=1;
  for(const a of photo.annotations){
   if(!a||typeof a.id!=='string'||ids.has(a.id)||!/^#[0-9a-f]{6}$/i.test(a.color))throw Error('照片批注损坏');ids.add(a.id);
   if(a.type==='stroke'){
    if(!Number.isFinite(a.width)||a.width<=0||a.width>1||!Array.isArray(a.points)||!a.points.length||a.points.length>20000||a.points.some(pt=>!Array.isArray(pt)||pt.length!==2||!pt.every(unit)))throw Error('画笔数据损坏');
   }else if(a.type==='text'){
    if(!unit(a.x)||!unit(a.y)||typeof a.text!=='string'||!a.text.trim()||a.text.length>2000||!Number.isFinite(a.size)||a.size<=0||a.size>1)throw Error('文字数据损坏');
   }else throw Error('不支持的批注类型');
  }
 }
 const api={targets,centeredView,pricePlan,fresh,id,product,matches,results,saveProduct,validate,normalize,deleteProducts};if(typeof module!=='undefined')module.exports=api;root.Model=api;
})(typeof globalThis!=='undefined'?globalThis:this);
