(function(root){
 'use strict';
 const fresh=()=>({version:1,photos:[],products:{},settings:{font:14,fields:['model'],shape:'dot',width:.08,height:.06}});
 const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,10);
 function product(s,m){return s.products[m.product]||{model:'',price:'',attrs:{}};}
 function matches(s,p,q){return q?p.marks.filter(m=>product(s,m).model.includes(q)):[];}
 function results(s,q){return q?s.photos.filter(p=>matches(s,p,q).length):s.photos;}
 function saveProduct(s,m,model,price,attrs){
  model=model.trim(); let key=model?Object.keys(s.products).find(k=>s.products[k].model===model):null;
  if(!key) key=(m.product && !model && !product(s,m).model)?m.product:id();
  if(model && product(s,m).model===model) key=m.product;
  s.products[key]={model,price,attrs};m.product=key;
 }
 function validate(s){
  if(!s||s.version!==1||!Array.isArray(s.photos)||!s.products||!s.settings)throw Error('备份格式不正确');
  const models=new Set(),ids=new Set();
  Object.values(s.products).forEach(p=>{if(typeof p.model!=='string'||typeof p.price!=='string'||!p.attrs||typeof p.attrs!=='object')throw Error('商品资料损坏');if(p.model){if(models.has(p.model))throw Error('型号重复');models.add(p.model);}});
  s.photos.forEach(p=>{if(!p.id||ids.has(p.id)||!/^img_[a-zA-Z0-9-]+\.jpg$/.test(p.file)||typeof p.name!=='string'||!Array.isArray(p.marks))throw Error('照片资料损坏');ids.add(p.id);p.marks.forEach(m=>{if(!s.products[m.product]||!['dot','rect','ellipse'].includes(m.shape)||!['x','y','w','h','angle'].every(k=>Number.isFinite(m[k]))||m.x<0||m.x>1||m.y<0||m.y>1||m.w<=0||m.h<=0)throw Error('标记资料损坏');});});
  if(!Number.isFinite(s.settings.font)||s.settings.font<8||s.settings.font>40||!Array.isArray(s.settings.fields))throw Error('显示设置损坏');return s;
 }
 const api={fresh,id,product,matches,results,saveProduct,validate};if(typeof module!=='undefined')module.exports=api;root.Model=api;
})(typeof globalThis!=='undefined'?globalThis:this);
