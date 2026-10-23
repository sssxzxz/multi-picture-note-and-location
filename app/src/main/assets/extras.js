'use strict';
let inkColor='#ff4949',inkWidth=4,textSize=24,priceRequest='';
function annotation(){return p()?.annotations?.find(a=>a.id===annotationSelected);}
function photoPoint(v){return [(v.x-tx)/bitmap.width/scale,(v.y-ty)/bitmap.height/scale];}
function insidePoint(pt){return pt.every(v=>v>=0&&v<=1);}
function boundedPoint(v){return photoPoint(v).map(n=>Math.max(0,Math.min(1,n)));}
function textBounds(a){const size=a.size*bitmap.width*scale;ctx.save();ctx.font=`${size}px sans-serif`;const lines=a.text.split('\n'),w=Math.max(...lines.map(t=>ctx.measureText(t).width));ctx.restore();return {x:tx+a.x*bitmap.width*scale,y:ty+a.y*bitmap.height*scale,w,h:lines.length*size*1.25,size};}
function drawAnnotations(){
 for(const a of [...(p()?.annotations||[]),...(strokeDraft?[strokeDraft]:[])]){
  ctx.save();ctx.strokeStyle=a.color;ctx.fillStyle=a.color;ctx.lineCap='round';ctx.lineJoin='round';
  if(a.type==='stroke'){
   ctx.lineWidth=a.width*bitmap.width*scale;ctx.beginPath();a.points.forEach(([x,y],i)=>{const px=tx+x*bitmap.width*scale,py=ty+y*bitmap.height*scale;if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);});
   if(a.points.length===1){const [x,y]=a.points[0];ctx.arc(tx+x*bitmap.width*scale,ty+y*bitmap.height*scale,ctx.lineWidth/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();
  }else{const b=textBounds(a);ctx.font=`${b.size}px sans-serif`;ctx.textBaseline='top';a.text.split('\n').forEach((line,i)=>ctx.fillText(line,b.x,b.y+i*b.size*1.25));if(editing&&a.id===annotationSelected){ctx.strokeStyle='#ffbe52';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);}}
  ctx.restore();
 }
}
function hitAnnotation(x,y){
 return [...(p()?.annotations||[])].reverse().find(a=>{
  if(a.type==='text'){const b=textBounds(a);return x>=b.x-8&&x<=b.x+b.w+8&&y>=b.y-8&&y<=b.y+b.h+8;}
  const points=a.points.map(pt=>({x:tx+pt[0]*bitmap.width*scale,y:ty+pt[1]*bitmap.height*scale})),r=Math.max(10,a.width*bitmap.width*scale/2);
  return points.some((b,i)=>{const v=points[Math.max(0,i-1)],dx=b.x-v.x,dy=b.y-v.y,t=Math.max(0,Math.min(1,((x-v.x)*dx+(y-v.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-v.x-dx*t,y-v.y-dy*t)<=r;});
 });
}
function updateEditTools(){for(const [id,tool] of [['selectTool','select'],['penTool','pen'],['textTool','text']])$(id).classList.toggle('primary',editTool===tool&&!adding);}
function editAnnotation(a,isNew=false){
 const text=a.type==='text';annotationSelected=a.id;selected=null;
 dialog('<h2>'+(isNew?'添加文字':text?'编辑文字':'编辑画笔')+'</h2>'+(text?'<label>文字内容</label><textarea id="annotationText" maxlength="2000" required>'+esc(a.text)+'</textarea>':'')+'<label>颜色</label><input id="annotationColor" type="color" value="'+a.color+'"><label>'+(text?'字号':'粗细')+'</label><input id="annotationSize" type="number" min="1" max="96" value="'+Math.max(1,Math.round((text?a.size:a.width)*bitmap.width*labelBaseScale))+'"><p class="note">保存或关闭后，可在“选择/移动”模式拖动选中的批注。双指可缩放照片。</p>'+(isNew?'':'<button type="button" id="deleteAnnotation" class="danger">删除此批注</button>'),()=>{
  const content=text?$('annotationText').value.trim():'';if(text&&!content)return false;
  if(isNew&&(p().annotations||[]).length>=5000){toast('这张照片的批注数量已达上限');return false;}
  checkpoint();a.color=$('annotationColor').value;const size=Math.min(1,Number($('annotationSize').value)/(bitmap.width*labelBaseScale));if(text){a.text=content;a.size=size;}else a.width=size;
  if(isNew)(p().annotations??=[]).push(a);annotationSelected=a.id;editTool='select';updateEditTools();persist();draw();
 });
 if(!isNew)$('deleteAnnotation').onclick=()=>{checkpoint();p().annotations=p().annotations.filter(x=>x.id!==a.id);annotationSelected=null;persist();$('dialog').close();draw();};
}
function initializeExtras(){
 $('targetPrev').onclick=()=>nextTarget(-1);$('targetNext').onclick=()=>nextTarget(1);
 for(const [id,tool] of [['selectTool','select'],['penTool','pen'],['textTool','text']])$(id).onclick=()=>{editTool=tool;adding=false;selected=null;annotationSelected=null;updateEditTools();$('add').className='';if(tool!=='select')toast(tool==='pen'?'单指绘画，双指移动或缩放照片':'点按照片添加文字');draw();};
 $('annotationStyle').onclick=()=>dialog('<h2>画笔与文字</h2><label>颜色</label><input type="color" id="inkColor" value="'+inkColor+'"><label>画笔粗细</label><input type="number" min="1" max="20" id="inkWidth" value="'+inkWidth+'"><label>文字字号</label><input type="number" min="8" max="96" id="textSize" value="'+textSize+'">',()=>{inkColor=$('inkColor').value;inkWidth=Number($('inkWidth').value);textSize=Number($('textSize').value);});
}
function startPriceImport(){
 if(!bridge?.importPrices){toast('表格导入请在安卓应用中使用');return;}
 priceRequest=M.id();dialog('<h2>导入价格</h2><p>请选择 .xlsx 表格，随后选择型号列和价格列。确认前不会修改资料。</p><p id="priceLoading">正在选择和读取表格…</p>',null);bridge.importPrices(priceRequest);
}
window.onPricesLoaded=result=>{
 if(result.request!==priceRequest||!$('dialog').open||!$('priceLoading'))return;
 if(result.error){$('priceLoading').textContent=result.error;return;}
 if(result.cancelled){$('dialog').close();return;}
 if(!result.sheets?.length){$('priceLoading').textContent='表格中没有可读取的工作表';return;}
 choosePriceColumns(result.sheets);
};
function choosePriceColumns(sheets){
 dialog('<h2>选择价格来源</h2><label>工作表</label><select id="priceSheet">'+sheets.map((s,i)=>'<option value="'+i+'">'+esc(s.name)+'</option>').join('')+'</select><label>表头行号</label><input type="number" id="headerRow" min="1" max="50000" value="1"><label>型号列</label><select id="modelColumn"></select><label>价格列</label><select id="priceColumn"></select><p class="note">型号完整匹配，忽略大小写与两端空格，不拆分单元格内的文字。空值、无效价格和公式单元格跳过。请选择要使用的价格列。</p><div id="sheetSample" class="import-preview"></div>',()=>{
  const sheet=sheets[Number($('priceSheet').value)],start=Number($('headerRow').value),mc=Number($('modelColumn').value),pc=Number($('priceColumn').value);
  if(mc===pc){toast('型号列与价格列不能相同');return false;}
  const plan=M.pricePlan(state,sheet.rows,mc,pc,start);
  // Defer opening the next dialog until the current submit handler finishes.
  setTimeout(()=>previewPrices(plan),0);
 },'预览匹配结果');
 const columns=()=>{
  const sheet=sheets[Number($('priceSheet').value)],index=Number($('headerRow').value)-1,header=sheet.rows[index]||[],n=Math.max(header.length,...sheet.rows.slice(index,index+10).map(r=>r.length),2);
  const letter=i=>{let t='';for(i++;i;i=Math.floor((i-1)/26))t=String.fromCharCode(65+(i-1)%26)+t;return t;};
  const options=Array.from({length:n},(_,i)=>'<option value="'+i+'">'+letter(i)+' · '+esc(header[i]||'无标题')+'</option>').join('');$('modelColumn').innerHTML=options;$('priceColumn').innerHTML=options;
  const model=header.findIndex(v=>/型号|model|sku/i.test(v)),price=header.findIndex(v=>/价格|单价|price/i.test(v));$('modelColumn').value=String(model<0?0:model);$('priceColumn').value=String(price<0?1:price);
  $('sheetSample').innerHTML='<p>前几行内容：</p>'+sheet.rows.slice(index,index+5).map(row=>'<p>'+row.map(esc).join(' ｜ ')+'</p>').join('');
 };$('priceSheet').onchange=columns;$('headerRow').onchange=columns;columns();
}
function previewPrices(plan){
 dialog('<h2>确认覆盖价格</h2><p>将更新 '+plan.updates.length+' 个商品。未匹配 '+plan.unmatched+' 个，价格相同 '+plan.unchanged+' 个，冲突跳过 '+plan.blocked+' 个。</p><p>表格中空白型号或无效价格行：'+plan.invalid+' 行。</p><div class="import-preview">'+plan.updates.map(u=>'<p>'+esc(u.model)+'：'+esc(u.before||'未填写')+' → '+esc(u.price)+'</p>').join('')+'</div>'+(plan.conflicts.length?'<h3>以下型号价格冲突，跳过</h3><div class="import-preview">'+plan.conflicts.map(c=>'<p>'+esc(c.model)+'：'+c.prices.map(esc).join(' / ')+'</p>').join('')+'</div>':'')+'<p class="note">只覆盖以上商品的价格，型号、位置、图片及其他资料保留。可通过撤销还原。</p>',plan.updates.length?()=>{
  const before=JSON.stringify(state);checkpoint();for(const u of plan.updates)if(state.products[u.id])state.products[u.id].price=u.price;
  if(!persist()){state=JSON.parse(before);history.pop();draw();return false;}draw();toast('已更新 '+plan.updates.length+' 个商品价格');
 }:null,'确认导入');
}
