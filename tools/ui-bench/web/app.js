'use strict';
const state={all:[],visible:[],category:'All disciplines',query:'',selected:null,firstPaintMs:null};
const el=id=>document.getElementById(id);
function sanitize(s){return String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}
async function source(query='',category='All disciplines'){
 if(window.benchmarkBridge?.search)return window.benchmarkBridge.search(query,category);
 if(window.__TAURI__?.core?.invoke)return window.__TAURI__.core.invoke('search_catalog',{query,category});
 throw Error('Native benchmark bridge unavailable; this is not a browser-only demo');
}
async function loadCategories(){
 const entries=await source('','All disciplines');
 const count=new Map();
 for(const a of entries)count.set(a.category,(count.get(a.category)||0)+1);
 state.all=entries;
 const top=[...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,11);
 const list=[['All disciplines',entries.length],...top];
 el('categories').innerHTML=list.map(([name,n])=>'<button class="category'+(state.category===name?' active':'')+'" data-category="'+sanitize(name)+'"><span>'+sanitize(name)+'</span><span class="category-count">'+n+'</span></button>').join('');
 for(const button of document.querySelectorAll('.category'))button.addEventListener('click',()=>{
   state.category=button.dataset.category;document.querySelectorAll('.category').forEach(b=>b.classList.toggle('active',b===button));void refresh()
 });
}
let generation=0;
async function refresh(){
 const run=++generation;
 const results=await source(state.query,state.category);if(run!==generation)return;
 state.visible=results;el('count').textContent=String(results.length);
 if(!results.some(a=>a.id===state.selected))state.selected=results[0]?.id||null;
 el('cards').innerHTML=results.map(a=>
  '<article role="listitem" tabindex="0" class="project'+(state.selected===a.id?' selected':'')+'" data-id="'+sanitize(a.id)+'">'+
  '<div class="card-head"><div class="app-icon">'+sanitize(a.name.slice(0,1))+'</div>'+
  '<div class="card-name"><strong>'+sanitize(a.name)+'</strong><small>'+sanitize(a.maker)+'</small></div></div>'+
  '<p>'+sanitize(a.summary)+'</p>'+
  '<div class="card-foot"><span>'+sanitize(a.category)+'</span><span class="tag">'+sanitize(a.evidence)+'</span></div>'+
  '</article>').join('');
 for(const a of document.querySelectorAll('.project')){
  const select=()=>{state.selected=a.dataset.id;renderDetail();document.querySelectorAll('.project').forEach(card=>card.classList.toggle('selected',card===a))};
  a.addEventListener('click',select);a.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select()}});
 }
 renderDetail();
}
function renderDetail(){
 const a=state.visible.find(x=>x.id===state.selected);
 el('detail-content').innerHTML=!a?'<p>No matching projects.</p>':
  '<div class="icon-large">'+sanitize(a.name.slice(0,1))+'</div>'+
  '<h2>'+sanitize(a.name)+'</h2><div class="maker">'+sanitize(a.maker)+'</div>'+
  '<span class="detail-chip">'+sanitize(a.evidence)+'</span>'+
  '<div class="mini-label">WHAT IT DOES</div><p>'+sanitize(a.summary)+'</p>'+
  '<div class="mini-label">CATEGORY</div><p>'+sanitize(a.category)+'</p>'+
  '<div class="mini-label">PLATFORMS REPORTED</div><p>'+sanitize(a.platforms)+'</p>'+
  '<div class="mini-label">SOURCE</div><div class="source-row">'+sanitize(a.source||'Not verified')+'</div>'+
  '<p class="trust">Demo is read-only. No installer action is exposed.</p>';
}
async function run(){
 const t=performance.now();
 const search=el('search');
 search.addEventListener('input',()=>{state.query=search.value;void refresh()});
 document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search.focus()}});
 await loadCategories();await refresh();
 el('renderer-name').textContent=window.benchmarkBridge?'ELECTRON · CHROMIUM':'TAURI · WEBVIEW';
 await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
 const ms=Math.round(performance.now()-t);state.firstPaintMs=ms;
 const msg={event:'BENCH_UI_READY',uiMs:ms,visible:state.visible.length,total:state.all.length,categoryCount:document.querySelectorAll('.category').length,selected:state.selected};
 if(window.benchmarkBridge?.ready)await window.benchmarkBridge.ready(msg);
 else if(window.__TAURI__?.core?.invoke)await window.__TAURI__.core.invoke('bench_ready',{message:msg});
}
run().catch(e=>{console.error('BENCH_UI_FAIL',String(e.stack||e));const x=el('cards');if(x)x.textContent=String(e.message)});
