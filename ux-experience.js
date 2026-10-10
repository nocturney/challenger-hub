/* Challenger Hub 2.5.1 · accessible discovery controls
   Adds global search and fully styled, keyboard-friendly facet menus.
   Does not alter package verification, download or install actions. */
'use strict';
window.ChallengerUX=(()=>{
 const selectIds=['maturitySelect','availabilitySelect','platformSelect','categorySelect','creatorSelect'];
 const labels={maturitySelect:'Development stage',availabilitySelect:'Availability',platformSelect:'Platform',categorySelect:'Subcategory',creatorSelect:'Creator'};
 const stageTones={stable:'green',beta:'sky',alpha:'amber',prealpha:'rose',dormant:'muted',unknown:'muted'};
 const statusTones={install:'green',portable:'violet',deploy:'sky',source:'muted'};
 const platformTones={windows:'sky',mac:'violet',linux:'amber',hosted:'teal'};
 const domainTones={'Design & Imaging':'violet','Video & Animation':'rose','3D & Manufacturing':'teal','Audio & Music':'amber','Office & Productivity':'sky','CRM & Sales':'green','ERP & Operations':'amber','Data & Internal Tools':'sky','Marketing & Publishing':'violet','AI & Agents':'violet','Developer & Automation':'sky','Security & Infrastructure':'teal','Finance & Accounting':'amber'};
 let currentMenu=null,facets=[];
 function searchable(a){
  const comparisons=competitorTargets(a).map(x=>[x.company,x.product].filter(Boolean).join(' ')).join(' ');
  return [
   String(a.title||''),String(a.repo||''),String(a.creator||''),String(a.repository||''),
   String(a.group||''),String(domainOf(a)||''),String(a.summary||a.description||''),
   String(a.original||''),String(a.replacementType||''),comparisons,
   (a.reportedPlatforms||[]).join(' ')
  ].join(' ').toLowerCase();
 }
 function globalResults(query){
  const terms=String(query||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if(!terms.length)return [...state.apps];
  const rows=[];
  for(const app of state.apps){
   const text=searchable(app);
   if(!terms.every(word=>text.includes(word)))continue;
   const title=String(app.title||'').toLowerCase(),repo=String(app.repo||'').toLowerCase();
   const alternatives=competitorTargets(app).map(x=>[x.company,x.product].filter(Boolean).join(' ').toLowerCase()).join(' · ');
   const summary=String(app.summary||app.description||'').toLowerCase();
   const score=terms.reduce((n,word)=>n+(title===word?150:0)+(title.includes(word)?90:0)+(repo.includes(word)?75:0)+(alternatives.includes(word)?65:0)+(summary.includes(word)?20:0),0);
   rows.push({app,score});
  }
  rows.sort((a,b)=>b.score-a.score||a.app.title.localeCompare(b.app.title,'en',{sensitivity:'base'}));
  return rows.map(x=>x.app);
 }
 function highlight(value){
  const text=String(value||''),words=String(ui.search||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if(!words.length)return escapeHTML(text);
  let first=-1,needle='';
  for(const w of words){const i=text.toLowerCase().indexOf(w);if(i!==-1&&(first===-1||i<first)){first=i;needle=w}}
  if(first<0)return escapeHTML(text);
  return escapeHTML(text.slice(0,first))+'<mark class="search-hit">'+escapeHTML(text.slice(first,first+needle.length))+'</mark>'+escapeHTML(text.slice(first+needle.length));
 }
 function hasSearch(){return !!String(ui.search||'').trim()}
 function leaveSearch(){
  if(!hasSearch())return;
  ui.search='';$('searchInput').value='';
 }
 function setSearch(value){
  ui.search=String(value||'');
  $('searchInput').value=ui.search;
  cardSnapshot='';renderCards(true);
 }
 function present(count){
  const active=hasSearch(),context=$('globalSearchContext');
  if(context)context.hidden=!active;
  document.body.classList.toggle('global-search-mode',active);
  const sort=$('sortSelect');if(sort){sort.disabled=active;sort.title=active?'Search results are ranked by relevance':'Sort applications'}
  const clear=$('searchClear');if(clear)clear.hidden=!active;
  if(active){$('globalSearchMatchCount').textContent=String(count);
    $('pageTitle').textContent='Search results';
    $('pageSubtitle').textContent='Matching applications from the full catalog, ranked by relevance.';
  }else{
    const pageTitles={all:'pageTitle',updates:'navUpdates',installed:'navInstalled',new:'navNew',missing:'filterMissing'};
    $('pageTitle').textContent=t(pageTitles[ui.filter]||'pageTitle');
    $('pageSubtitle').textContent=t('pageSubtitle');
  }
  syncFacets();
  const shortcuts=document.querySelectorAll('[data-query-count]');
  for(const el of shortcuts){const n=globalResults(el.dataset.queryCount).length;
   el.textContent=n?n+' alternative'+(n===1?'':'s'):'Explore projects';
  }
 }
 function toneFor(id,value){
  if(!value||value==='all')return 'muted';
  if(id==='maturitySelect')return stageTones[value]||'muted';
  if(id==='availabilitySelect')return statusTones[value]||'muted';
  if(id==='platformSelect')return platformTones[value]||'muted';
  if(id==='creatorSelect')return 'violet';
  if(id==='categorySelect'){
   const a=state.apps.find(x=>x.group===value);
   return domainTones[a?domainOf(a):'']||'sky';
  }
  return 'muted';
 }
 function closeFacet(focus=false){
  if(!currentMenu)return;
  const {menu,trigger}=currentMenu;menu.hidden=true;trigger.setAttribute('aria-expanded','false');
  if(focus)trigger.focus();
  currentMenu=null;
 }
 function openFacet(f){
  if(currentMenu===f){closeFacet();return}
  closeFacet();f.menu.hidden=false;f.trigger.setAttribute('aria-expanded','true');currentMenu=f;
  const active=f.menu.querySelector('[aria-selected=true]')||f.menu.querySelector('.facet-option');
  active?.focus({preventScroll:true});
 }
 function refreshFacet(f){
  const options=[...f.select.options],signature=options.map(x=>x.value+'::'+x.textContent).join('|');
  if(f.menu.dataset.signature!==signature){
   f.menu.dataset.signature=signature;
   f.menu.innerHTML=options.map(o=>{
     const color=toneFor(f.id,o.value);
     return '<button type="button" role="option" tabindex="-1" class="facet-option facet-tone-'+color+'" data-value="'+escapeHTML(o.value)+'" aria-selected="false">'+
      '<span class="facet-dot" aria-hidden="true"></span><span class="facet-option-label">'+escapeHTML(o.textContent)+'</span>'+
      '<span class="facet-check" aria-hidden="true">✓</span></button>';
   }).join('');
  }
  const value=f.select.value,selected=options.find(o=>o.value===value);
  const color=toneFor(f.id,value),text=selected?.textContent||'All';
  f.trigger.innerHTML='<span class="facet-dot facet-tone-'+color+'" aria-hidden="true"></span><span class="facet-trigger-label">'+escapeHTML(text)+'</span><span class="facet-caret" aria-hidden="true">⌄</span>';
  f.trigger.setAttribute('aria-label',labels[f.id]+': '+text);
  for(const option of f.menu.querySelectorAll('[role=option]')){
    option.setAttribute('aria-selected',String(option.dataset.value===value));
  }
 }
 function syncFacets(){for(const f of facets)refreshFacet(f)}
 function resetView(){
  leaveSearch();
  ui.filter='all';ui.domain='all';ui.creator='all';ui.category='all';ui.maturity='all';ui.availability='all';ui.platform='all';
  for(const id of selectIds){const el=$(id);if(el)el.value='all'}
  categorySignature='';updateCategoryList();renderDomains();cardSnapshot='';render(true);
 }
 function initializeFacets(){
  for(const id of selectIds){
   const select=$(id);if(!select||select.closest('.facet-enhanced'))continue;
   const wrap=select.closest('.category-wrap');if(!wrap)continue;
   wrap.classList.add('facet-enhanced');
   select.classList.add('facet-native');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
   const trigger=document.createElement('button');trigger.type='button';trigger.className='facet-trigger';
   trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
   const menu=document.createElement('div');menu.className='facet-menu';menu.id='facet-list-'+id;
   menu.setAttribute('role','listbox');menu.setAttribute('aria-label',labels[id]);menu.hidden=true;
   trigger.setAttribute('aria-controls',menu.id);
   select.before(trigger);wrap.appendChild(menu);
   const f={id,select,trigger,menu};facets.push(f);
   trigger.addEventListener('click',()=>openFacet(f));
   trigger.addEventListener('keydown',e=>{
    if(['Enter',' ','ArrowDown','ArrowUp'].includes(e.key)){
      e.preventDefault();if(currentMenu!==f)openFacet(f);
      else if(e.key==='ArrowDown'||e.key==='ArrowUp'){menu.dispatchEvent(new KeyboardEvent('keydown',{key:e.key,bubbles:false}))}
    }
   });
   menu.addEventListener('click',e=>{
    const option=e.target.closest('.facet-option');if(!option)return;
    select.value=option.dataset.value;
    closeFacet(true);
    select.dispatchEvent(new Event('change',{bubbles:true}));
    syncFacets();
   });
   menu.addEventListener('keydown',e=>{
    const options=[...menu.querySelectorAll('.facet-option')];
    const at=options.indexOf(document.activeElement);
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeFacet(true);return}
    if(e.key==='Tab'){closeFacet();return}
    let next=null;
    if(e.key==='ArrowDown')next=options[(at+1)%options.length];
    if(e.key==='ArrowUp')next=options[(at-1+options.length)%options.length];
    if(e.key==='Home')next=options[0];
    if(e.key==='End')next=options.at(-1);
    if(next){e.preventDefault();next.focus();next.scrollIntoView({block:'nearest'});return}
    if(e.key==='Enter'||e.key===' '){e.preventDefault();if(document.activeElement?.matches('.facet-option'))document.activeElement.click();}
   });
   wrap.addEventListener('focusout',()=>requestAnimationFrame(()=>{if(currentMenu===f&&!wrap.contains(document.activeElement))closeFacet()}));
  }
  document.addEventListener('pointerdown',e=>{if(currentMenu&&!currentMenu.trigger.closest('.category-wrap').contains(e.target))closeFacet()});
  syncFacets();
 }
 function initialize(){
  initializeFacets();
  document.querySelectorAll('[data-global-query]').forEach(button=>button.addEventListener('click',()=>{
   setSearch(button.dataset.globalQuery);
   document.querySelector('.main-heading')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }));
  for(const id of ['searchClear','clearGlobalSearch']){
   $(id)?.addEventListener('click',()=>{setSearch('');$('searchInput').focus()});
  }
  $('clearAllFilters')?.addEventListener('click',resetView);
 }
 return {globalResults,highlight,hasSearch,setSearch,leaveSearch,present,syncFacets,resetView,initialize};
})();
