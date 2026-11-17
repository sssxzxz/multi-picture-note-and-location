const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../app/src/main/assets/model.js'),ShelfMap=require('../app/src/main/assets/shelf-map.js');
const make=()=>{const state=M.fresh();state.photos=[{id:'photo',name:'货架照片',file:'img_shelf.jpg',marks:[]}];return state;};

test('货架绑定兼容旧资料及未绑定照片，完整备份往返保留每张照片的位置',()=>{
 const old=make();assert.doesNotThrow(()=>M.normalize(M.validate(JSON.parse(JSON.stringify(old)))));
 for(const shelfId of ['',...ShelfMap.shelves.map(s=>s.id)]){
  const state=make();state.photos[0].shelfId=shelfId;
  assert.equal(M.normalize(M.validate(JSON.parse(JSON.stringify(state)))).photos[0].shelfId,shelfId);
 }
 const state=make();state.photos[0].shelfId='b1-4';state.photos.push({id:'second',name:'另一张',file:'img_other.jpg',marks:[],shelfId:'B1-3'});
 const restored=M.normalize(M.validate(JSON.parse(JSON.stringify(state))));assert.deepEqual(restored.photos.map(p=>p.shelfId),['b1-4','B1-3']);
});

test('拒绝损坏、未知或大小写错误的货架绑定，不默默匹配到其他货架',()=>{
 for(const shelfId of [null,42,{},[],['A1'],'A7','a1','B1-4','b1-3',' A1','A1 ','<script>']){
  const state=make();state.photos[0].shelfId=shelfId;assert.throws(()=>M.validate(state),`应拒绝 ${JSON.stringify(shelfId)}`);
 }
});

test('布局完整包含图中十四个不同货架，预览不包含可见文字',()=>{
 assert.deepEqual(ShelfMap.shelves.map(s=>s.id).sort(),['D2','D1','C','b1-4','b5-7','B4-7','B1-3','E','A1','A2','A3','A4','A5','A6'].sort());
 for(const selected of ['',...ShelfMap.shelves.map(s=>s.id)]){
  const svg=ShelfMap.svg(selected);assert.doesNotMatch(svg,/<text\b|<foreignObject\b/i);
  assert.equal((svg.match(/\bdata-shelf=/g)||[]).length,14);
  assert.equal((svg.match(/\bis-selected\b/g)||[]).length,selected?1:0);
 }
});

test('小地图角度默认和备份往返，非法值回退',()=>{for(const value of [undefined,null,45,'90',0,90,180,270]){const s=M.fresh();s.settings.mapRotation=value;const restored=M.normalize(M.validate(JSON.parse(JSON.stringify(s))));assert.equal(restored.settings.mapRotation,[0,90,180,270].includes(value)?value:0);}});
