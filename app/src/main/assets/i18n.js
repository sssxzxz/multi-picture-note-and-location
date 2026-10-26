'use strict';
const I18n=(()=>{
 const names={'zh-CN':'简体中文','zh-TW':'繁體中文',en:'English',bg:'Български',ja:'日本語',ko:'한국어',ru:'Русский',de:'Deutsch',fr:'Français',es:'Español'};
 let language='zh-CN',initialized=false;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function resolve(value,system){if(value&&value!=='auto'&&names[value])return value;const s=(system||window.Native?.systemLanguage?.()||navigator.language||'en').replace(/_/g,'-').toLowerCase();if(s.startsWith('zh'))return /tw|hk|mo|hant/.test(s)?'zh-TW':'zh-CN';const base=s.split('-')[0];return names[base]?base:'en';}
 function t(value){const text=String(value??'');return language==='zh-CN'?text:(window.TRANSLATIONS?.[language]?.[text]??window.TRANSLATIONS?.en?.[text]??text);}
 function html(s){return s.replace(/[\u3400-\u9fff][^<>"'`$\\\r\n]*/g,key=>escape(t(key)));}
 const staticNodes=[],staticAttrs=[];const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=walk.nextNode())if(/[\u3400-\u9fff]/.test(n.data))staticNodes.push([n,n.data]);
 for(const el of document.querySelectorAll('[placeholder],[aria-label],[alt]'))for(const a of ['placeholder','aria-label','alt'])if(el.hasAttribute(a))staticAttrs.push([el,a,el.getAttribute(a)]);
 function set(value){const next=resolve(value);if(initialized&&next===language)return;language=next;initialized=true;document.documentElement.lang=language;document.title=t('照片商品定位');for(const [node,source] of staticNodes)node.data=t(source)===source?html(source):t(source);for(const [el,a,source] of staticAttrs)el.setAttribute(a,t(source)===source?html(source):t(source));window.Native?.setLanguage?.(language);}
 return {names,resolve,t,html,escape,set,get language(){return language;}};
})();
const T=value=>I18n.t(value);
