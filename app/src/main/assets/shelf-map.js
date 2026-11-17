(function(root){
 'use strict';
 // Coordinates follow the supplied floor plan. Upper/lower-case shelf IDs are distinct.
 const shelves=Object.freeze([
  {id:'D2',label:'D2',x:22,y:10,w:500,h:32},
  {id:'D1',label:'D1',x:105,y:123,w:460,h:69},
  {id:'C',label:'C',x:10,y:43,w:32,h:332},
  {id:'b1-4',label:'b1-4',x:100,y:200,w:214,h:68},
  {id:'b5-7',label:'b5-7',x:324,y:203,w:245,h:63},
  {id:'B4-7',label:'B4-7',x:22,y:373,w:312,h:33},
  {id:'B1-3',label:'B1-3',x:340,y:364,w:277,h:42},
  {id:'E',label:'E',x:703,y:10,w:120,h:64},
  {id:'A1',label:'A1',x:764,y:203,w:69,h:152},
  {id:'A2',label:'A2',x:765,y:365,w:69,h:149},
  {id:'A3',label:'A3',x:770,y:524,w:64,h:142},
  {id:'A4',label:'A4',x:781,y:676,w:53,h:126},
  {id:'A5',label:'A5',x:655,y:776,w:116,h:26},
  {id:'A6',label:'A6',x:655,y:596,w:61,h:155}
 ].map(Object.freeze));
 function svg(selectedId,rotation=0){
  if(![0,90,180,270].includes(rotation))rotation=0;
  const blocks=shelves.map(s=>{
   const active=s.id===selectedId;
   return '<rect class="map-shelf'+(active?' is-selected':'')+'" data-shelf="'+s.id+'" x="'+s.x+'" y="'+s.y+'" width="'+s.w+'" height="'+s.h+'" rx="9" fill="'+(active?'#00a58f':'#c4d3d0')+'" stroke="'+(active?'#005d52':'#f8fbfa')+'" stroke-width="'+(active?'7':'4')+'"/>';
  }).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -28 868 868" aria-hidden="true" focusable="false" style="display:block;width:100%;height:100%">'+
   '<g transform="rotate('+rotation+' 422 406)"><path d="M0 0H844V812H645V416H0Z" fill="#f8fbfa"/>'+blocks+
   '<path d="M603 0H0V416H645V812H844V0H701" fill="none" stroke="#536e6a" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'+
   '<path d="M623 13L652 39L681 13" fill="none" stroke="#7e9691" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>'+
   '</g></svg>';
 }
 const api=Object.freeze({shelves,svg});
 if(typeof module!=='undefined')module.exports=api;
 root.ShelfMap=api;
})(typeof globalThis!=='undefined'?globalThis:this);
