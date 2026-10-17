(function(root){
 'use strict';
 const fresh=()=>({version:1,photos:[],products:{},settings:{autoHideTools:true,font:14,fields:['model'],shape:'dot',width:.08,height:.06}});
 const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,10);
 function product(s,m){return s.products[m.product]||{model:'',price:'',attrs:{}};}
 function matches(s,p,q){const query=q.toLowerCase();return query?p.marks.filter(m=>product(s,m).model.toLowerCase().includes(query)):[];}
 function results(s,q){return q?s.photos.filter(p=>matches(s,p,q).length):s.photos;}
 function saveProduct(s,m,model,price,attrs){
  model=model.trim()||nextModel(s); let key=Object.keys(s.products).find(k=>s.products[k].model===model);
  if(!key) key=(m.product && !model && !product(s,m).model)?m.product:id();
  if(model && product(s,m).model===model) key=m.product;
  s.products[key]={model,price,attrs};m.product=key;
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
  return s;
 }
 function deleteProducts(s,ids){
  const keys=new Set(ids);for(const p of s.photos)p.marks=p.marks.filter(m=>!keys.has(m.product));
  for(const key of keys)delete s.products[key];normalize(s);
 }
 function validate(s){
  if(!s||s.version!==1||!Array.isArray(s.photos)||!s.products||!s.settings)throw Error('备份格式不正确');
  const models=new Set(),ids=new Set();
  Object.values(s.products).forEach(p=>{if(typeof p.model!=='string'||typeof p.price!=='string'||!p.attrs||typeof p.attrs!=='object')throw Error('商品资料损坏');if(p.model){if(models.has(p.model))throw Error('型号重复');models.add(p.model);}});
  s.photos.forEach(p=>{if(!p.id||ids.has(p.id)||!/^img_[a-zA-Z0-9-]+\.jpg$/.test(p.file)||typeof p.name!=='string'||!Array.isArray(p.marks))throw Error('照片资料损坏');ids.add(p.id);p.marks.forEach(m=>{if(!s.products[m.product]||!['dot','rect','ellipse'].includes(m.shape)||!['x','y','w','h','angle'].every(k=>Number.isFinite(m[k]))||m.x<0||m.x>1||m.y<0||m.y>1||m.w<=0||m.h<=0)throw Error('标记资料损坏');});});
  if(!Number.isFinite(s.settings.font)||s.settings.font<8||s.settings.font>40||!Array.isArray(s.settings.fields))throw Error('显示设置损坏');return s;
 }
 const api={fresh,id,product,matches,results,saveProduct,validate,normalize,deleteProducts};if(typeof module!=='undefined')module.exports=api;root.Model=api;
})(typeof globalThis!=='undefined'?globalThis:this);
