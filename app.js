'use strict';
/* FOCUS v4.0 — independent, read-only IA prototype.
   No installation, launch, scan, settings writes or background actions.
   All content is derived from GET /api/state, never demo fixtures. */
const $=id=>document.getElementById(id);
const screenIds={home:'homeScreen',explore:'exploreScreen',project:'projectScreen',library:'libraryScreen',activity:'activityScreen'};
const DOMAINS=[
 ['all','All software'],
 ['Design & Imaging','Design & Imaging'],
 ['Video & Animation','Video & Motion'],
 ['Live Production','Live Production'],
 ['3D & Manufacturing','3D & CAD'],
 ['Science & GIS','Science & GIS'],
 ['Audio & Music','Audio & Music'],
 ['Game Creation','Game Creation'],
 ['Office & Productivity','Office & Productivity'],
 ['CRM & Sales','CRM & Sales'],
 ['ERP & Operations','ERP & Operations'],
 ['Business & Legal','Business & Legal'],
 ['Data & Internal Tools','Data & Apps'],
 ['Marketing & Publishing','Marketing'],
 ['AI & Agents','AI & Agents'],
 ['Developer & Automation','Dev & Automation'],
 ['Security & Infrastructure','Security & Infra'],
 ['Finance & Accounting','Finance']
];
let snapshot=null,projects=[],projectById=new Map();
let ui={screen:'home',domain:'all',query:'',scope:'all',sort:'activity',limit:30,
 project:null,returnTo:'explore',libraryTab:'installed',filtersOpen:false,theme:'light'};
let routeReady=false,restoringRoute=false;
function routeState(){
 return {screen:ui.screen,domain:ui.domain,query:ui.query,scope:ui.scope,sort:ui.sort,limit:ui.limit,
  project:ui.project,returnTo:ui.returnTo,libraryTab:ui.libraryTab,filtersOpen:ui.filtersOpen};
}
function routeUrl(){
 return '#/'+(ui.screen==='project'?'project/'+encodeURIComponent(ui.project||''):ui.screen);
}
function rememberRoute(replace=false){
 if(!routeReady||restoringRoute)return;
 const payload={focus4:routeState()};
 if(replace)history.replaceState(payload,'',routeUrl());
 else history.pushState(payload,'',routeUrl());
}

function esc(v){return String(v===null||v===undefined?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function domainOf(a){
 if(a.category&&DOMAINS.some(g=>g[0]===a.category))return a.category;
 const g=String(a.group||'').toLowerCase();
 if(/audio|music|sound|daw|synth/.test(g))return 'Audio & Music';
 if(/video|motion|animation|compositing|rigging/.test(g))return 'Video & Animation';
 if(/crm|sales/.test(g))return 'CRM & Sales';
 if(/erp|inventory|operations|supply|mrp|mes/.test(g))return 'ERP & Operations';
 if(/finance|accounting|bookkeep/.test(g))return 'Finance & Accounting';
 if(/marketing|publish|social/.test(g))return 'Marketing & Publishing';
 if(/ai|agent|memory|knowledge|rag|llm/.test(g))return 'AI & Agents';
 if(/dev|automati|workflow|gateway/.test(g))return 'Developer & Automation';
 if(/security|infrastructure|credential|secret/.test(g))return 'Security & Infrastructure';
 if(/database|internal|no.code|low.code/.test(g))return 'Data & Internal Tools';
 if(/image|vector|photo|typography|font|design|illustrat/.test(g))return 'Design & Imaging';
 if(/cad|draft|3d|material|engineering|point cloud|mesh|voxel|manufactur|electronic|pcb|cam/.test(g))return '3D & Manufacturing';
 return 'Office & Productivity';
}
const domainName=id=>DOMAINS.find(d=>d[0]===id)?.[1]||id;
function dateOf(v){const n=Date.parse(v||'');return Number.isFinite(n)?n:0}
function dateLabel(v){if(!dateOf(v))return 'Not reported';return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(v))}
function sourceLink(v){
 try{const u=new URL(v);return u.protocol==='https:'&&
 ['github.com','gitlab.com','codeberg.org','invent.kde.org'].includes(u.hostname.toLowerCase())&&
 !u.username&&!u.password&&!u.port?u.href:null}catch(_){return null}
}
function challengesOf(a){
 const names=(a.competition||[]).map(x=>[x.company,x.product].filter(Boolean).join(' '));
 if(Array.isArray(a.challenges))names.push(...a.challenges);
 if(a.original)names.push(a.original);
 return [...new Set(names.map(v=>String(v||'').trim()).filter(Boolean))];
}
function installStatus(a){
 if(a.researchPendingVerification)return {text:'Research unverified',kind:'caution'};
 if(a.needsUpdate)return {text:'Update available',kind:'caution'};
 if(a.installedVersion)return {text:'Installed',kind:'ok'};
 if(a.discovery)return {text:'Source listed',kind:''};
 if(a.installable)return {text:'Approved adapter',kind:'ok'};
 return {text:'Source only',kind:''};
}
function sourceMaturity(a){
 return a.reportedMaturity||a.developmentStage||'Independent verification not established';
}
function searchBlob(a){return [a.title,a.repo,a.group,a.category,a.summary,a.description,a.creator,
 a.repository,a.original,...challengesOf(a),...(a.reportedPlatforms||[])]
 .filter(Boolean).join(' ').toLocaleLowerCase()}
function relevance(a,q){
 const title=String(a.title||'').toLowerCase(),ch=challengesOf(a).join(' ').toLowerCase();
 return title===q?100:title.startsWith(q)?80:ch.includes(q)?63:title.includes(q)?55:searchBlob(a).includes(q)?15:0;
}
function filtered(){
 const q=ui.query.toLowerCase().trim();
 const data=projects.filter(a=>(ui.domain==='all'||domainOf(a)===ui.domain)&&
  (ui.scope==='all'||ui.scope==='independent'&&!!a.discovery||ui.scope==='missing'&&!a.installedVersion)&&
  (!q||searchBlob(a).includes(q)));
 data.sort((a,b)=>{
  if(q){const diff=relevance(b,q)-relevance(a,q);if(diff)return diff}
  if(ui.sort==='name')return String(a.title).localeCompare(b.title);
  const x=ui.sort==='release'?'publishedAt':'pushedAt';
  return dateOf(b[x])-dateOf(a[x])||String(a.title).localeCompare(String(b.title));
 });
 return data;
}
function counts(){
 const map=new Map(DOMAINS.map(d=>[d[0],0]));
 for(const a of projects)map.set(domainOf(a),(map.get(domainOf(a))||0)+1);
 map.set('all',projects.length);return map;
}
function setScreen(screen){
 if(!screenIds[screen])return;
 ui.screen=screen;
 for(const [key,id] of Object.entries(screenIds))$(id).hidden=screen!==key;
 const mainPage=screen==='project'?(ui.returnTo==='library'?'library':'home'):screen==='explore'?'home':screen;
 for(const b of document.querySelectorAll('[data-main]')){
  const selected=b.dataset.main===mainPage;
  b.classList.toggle('selected',selected);
  if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 }
 document.title=(screen==='project'?(projectById.get(ui.project)?.title||'Project')+' · ':'')+
   'Challenger — '+({home:'Explore',explore:'Index',library:'My software',activity:'Activity',project:'Project'}[screen]);
 rememberRoute(false);
 window.scrollTo({top:0,behavior:'instant'});
}
function goHome(){ui.project=null;ui.returnTo='home';setScreen('home')}
function goBrowse(opts={}){
 ui.domain=opts.domain===undefined?ui.domain:opts.domain;
 ui.query=opts.query===undefined?ui.query:String(opts.query).trim();
 ui.scope=opts.scope||'all';ui.limit=30;
 ui.project=null;ui.returnTo='explore';
 setScreen('explore');
 renderBrowse();
}
function goLibrary(){ui.returnTo='library';ui.project=null;setScreen('library');renderLibrary()}
function goActivity(){ui.project=null;setScreen('activity');renderActivity()}
function goProject(repo,returnTo){
 const a=projectById.get(repo);
 if(!a)return;
 ui.project=repo;ui.returnTo=returnTo||ui.screen;
 setScreen('project');renderDocument(a);
}
function goBack(){if(ui.returnTo==='library')goLibrary();else if(ui.returnTo==='home')goHome();else goBrowse()}
function renderHome(){
 $('homeProjectCount').textContent=projects.length+' SOURCE-LINKED PROJECTS';
 $('disciplineTotal').textContent=(DOMAINS.length-1)+' fields';
 const n=counts();
 const domains=DOMAINS.filter(d=>d[0]!=='all').sort((a,b)=>(n.get(b[0])||0)-(n.get(a[0])||0));
 $('disciplineList').innerHTML=domains.map((d,i)=>'<button type="button" class="discipline-row" data-domain="'+esc(d[0])+'">'+
  '<span class="discipline-no">'+String(i+1).padStart(2,'0')+'</span><span class="discipline-label">'+esc(d[1])+'</span>'+
  '<span class="discipline-count">'+(n.get(d[0])||0)+'</span><span class="discipline-arrow" aria-hidden="true">↗</span></button>').join('');
 const recent=projects.filter(a=>dateOf(a.publishedAt)>0&&a.repoUrl).sort((a,b)=>dateOf(b.publishedAt)-dateOf(a.publishedAt)).slice(0,5);
 $('recentList').innerHTML=recent.length?recent.map(a=>'<button type="button" class="recent-item" data-project="'+esc(a.repo)+'">'+
  '<div class="recent-item-top"><strong>'+esc(a.title)+'</strong><small>'+esc(dateLabel(a.publishedAt))+'</small></div>'+
  '<p>'+esc(domainName(domainOf(a)))+' · '+esc(a.creator||'Source not specified')+'</p></button>').join(''):
  '<p class="source-footnote">No source-reported release dates available.</p>';
 $('homeSearch').value=ui.query;
}
function renderSuggestions(){
 const target=$('homeSuggestions'),q=$('homeSearch').value.trim().toLowerCase();
 if(!q||!projects.length){target.hidden=true;target.innerHTML='';return}
 const hits=projects.filter(a=>searchBlob(a).includes(q)).sort((a,b)=>relevance(b,q)-relevance(a,q)).slice(0,5);
 target.innerHTML=hits.map(a=>'<button type="button" class="home-suggestion" role="option" data-project="'+esc(a.repo)+'">'+
   '<strong>'+esc(a.title)+'</strong><small>'+esc(domainName(domainOf(a)))+'</small></button>').join('');
 target.hidden=!hits.length;
}
function renderFilters(){
 const n=counts();
 $('filterDomainList').innerHTML=DOMAINS.map(d=>'<button class="filter-domain-button'+(ui.domain===d[0]?' active':'')+
  '" type="button" data-filter-domain="'+esc(d[0])+'" aria-pressed="'+(ui.domain===d[0])+'">'+esc(d[1])+
  '<small>'+(n.get(d[0])||0)+'</small></button>').join('');
 for(const b of document.querySelectorAll('[data-scope]')){
  const active=b.dataset.scope===ui.scope;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 }
 $('filterPanel').hidden=!ui.filtersOpen;
 $('filterToggle').setAttribute('aria-expanded',String(ui.filtersOpen));
}
function renderRow(a,library=false){
 const s=installStatus(a);
 const c=challengesOf(a).slice(0,2).join(', ')||'No established comparison';
 const name='<button type="button" class="project-hit" data-project="'+esc(a.repo)+'">'+esc(a.title)+
  '<small>'+esc(a.creator||a.repository||'Independent project')+'</small></button>';
 if(library)return '<tr><td>'+name+'</td><td>'+esc(a.installedVersion||'Not reported')+'</td><td>'+esc(a.latestVersion||a.releaseTag||'Not verified')+
 '</td><td class="status-cell '+s.kind+'">'+esc(s.text)+'</td></tr>';
 return '<tr><td>'+name+'</td><td>'+esc(c)+'</td><td>'+esc(domainName(domainOf(a)))+'</td>'+
  '<td class="status-cell '+s.kind+'">'+esc(s.text)+'</td><td class="end-cell">'+esc(dateLabel(a.publishedAt))+'</td></tr>';
}
function renderBrowse(){
 const list=filtered();
 $('exploreTitle').textContent=ui.query?('Results for “'+ui.query.slice(0,55)+(ui.query.length>55?'…':'')+'”'):
  ui.domain==='all'?'The full index':domainName(ui.domain);
 $('exploreBreadcrumb').textContent=ui.domain==='all'?'All disciplines':domainName(ui.domain);
 $('exploreSubline').textContent=ui.query?'Search across projects and the software they challenge.':
  ui.domain==='all'?'Every project available in the local index.':'One discipline, source by source.';
 $('resultCount').textContent=String(list.length).padStart(2,'0');
 $('exploreSearch').value=ui.query;$('sortSelect').value=ui.sort;
 $('exploreRows').innerHTML=list.slice(0,ui.limit).map(a=>renderRow(a)).join('');
 $('exploreEmpty').hidden=!!list.length;
 $('loadMore').hidden=list.length<=ui.limit;
 $('resultsShown').textContent=list.length?('Showing '+Math.min(list.length,ui.limit)+' of '+list.length+' projects'):'';
 renderFilters();
 if(ui.screen==='explore')rememberRoute(true);
}
function renderLibrary(){
 const installed=projects.filter(a=>!!a.installedVersion);
 const updated=projects.filter(a=>!!a.needsUpdate);
 const rows=ui.libraryTab==='updates'?updated:installed;
 $('localMachine').textContent=(snapshot?.computer||'Local computer')+' · '+(snapshot?.platform||'Operating system not reported')+
  ' · Live read-only device data';
 $('libraryInstalledCount').textContent=installed.length;
 $('libraryUpdateCount').textContent=updated.length;
 $('libraryCount').textContent=rows.length;
 $('libraryRows').innerHTML=rows.map(a=>renderRow(a,true)).join('');
 $('libraryEmpty').hidden=!!rows.length;
 for(const b of document.querySelectorAll('[data-library]')){
  const selected=b.dataset.library===ui.libraryTab;
  b.classList.toggle('selected',selected);
  b.setAttribute('aria-selected',String(selected));
 }
 if(ui.screen==='library')rememberRoute(true);
}
function releaseText(a){return String(a.releaseBody||'').trim()||'No source-provided release notes in the local index.'}
function renderDocument(a){
 const status=installStatus(a);
 const link=sourceLink(a.repoUrl),release=sourceLink(a.releaseUrl);
 const competition=challengesOf(a);
 const meta=[
  ['Creator',a.creator||'Not reported'],['Discipline',domainName(domainOf(a))],
  ['License',a.license||'Not reported'],['Maturity (reported)',sourceMaturity(a)],
  ['Platform(s)',(a.reportedPlatforms||[]).join(', ')||snapshot?.platform||'Not reported'],
  ['Latest source version',a.latestVersion||a.releaseTag||'Not verified'],
  ['Release date',dateLabel(a.publishedAt)],
  ['Installed on device',a.installedVersion||'Not installed']
 ];
 const section=(label,body)=>'<section class="document-section"><h2>'+label+'</h2>'+body+'</section>';
 $('detailCrumb').textContent=a.title;
 $('detailBack').textContent=ui.returnTo==='home'?'← Back to discovery':ui.returnTo==='library'?'← Back to my software':'← Back to results';
 $('projectDocument').innerHTML='<header class="project-identity"><div class="project-identity-copy">'+
 '<span class="project-label">'+esc(domainName(domainOf(a)).toUpperCase())+' / PROJECT DOSSIER</span>'+
 '<h1 class="project-name">'+esc(a.title)+'</h1>'+
 '<p class="project-summary">'+esc(a.summary||a.description||'Project description not provided by source.')+'</p></div>'+
 '<div class="project-identity-status"><span>LOCAL STATE / SOURCE STATUS</span><strong>'+esc(status.text)+'</strong>'+
 (link?'<a target="_blank" rel="noopener noreferrer" href="'+esc(link)+'">Open source repository ↗</a>':'')+
 (release?'<a target="_blank" rel="noopener noreferrer" href="'+esc(release)+'">Reported release ↗</a>':'')+
 '<small class="prototype-note">VIEW-ONLY DESIGN PREVIEW. NO INSTALL, LAUNCH OR UPDATE ACTIONS.</small></div></header>'+
 '<div class="project-content-grid"><div class="doc-main">'+
 section('WHAT THIS PROJECT DOES','<p>'+esc(a.description||a.summary||'No additional source description available.')+'</p>')+
 section('SOFTWARE IT CHALLENGES','<p>'+(competition.length?esc(competition.join(' · ')):'No established commercial comparison in current metadata.')+'</p>')+
 section('REPORTED RELEASE NOTES','<p class="release-notes">'+esc(releaseText(a))+'</p>')+
 (a.caveats?section('LIMITATIONS & CAVEATS','<p>'+esc(a.caveats)+'</p>'):'')+
 '</div><aside class="doc-aside">'+
 section('PROJECT FACTS','<dl class="doc-facts">'+meta.map(x=>'<div><dt>'+esc(x[0])+'</dt><dd>'+esc(x[1])+'</dd></div>').join('')+'</dl>')+
 section('SOURCE CONFIDENCE','<p>'+esc(a.researchPendingVerification?'Research candidate — not yet verified for installation.':
   a.discovery?'Independent source-listed project. Source presence does not establish safe installation.':
   a.installable?'Approved installation adapter reported by current backend. No action is available in this preview.':
   'Source information available; installation is not enabled in this preview.')+'</p>'+
 '<p>Source signal: '+esc(a.sourceSignal?.sourceLabel||'Not reported')+'</p>'+
 '<p>Checked: '+esc(dateLabel(a.sourceSignal?.checkedAt))+'</p>')+
 (a.researchPendingVerification?'<p class="warning-note">Research-only. This project must not be treated as approved for installation.</p>':'')+
 '</aside></div>';
}
function renderActivity(){
 const active=snapshot?.active,queue=Array.isArray(snapshot?.queue)?snapshot.queue:[],history=Array.isArray(snapshot?.history)?snapshot.history:[];
 const latest=new Map();
 for(const entry of history)if(entry?.repo&&(entry.kind==='success'||entry.kind==='error'))latest.set(entry.repo,entry);
 const unresolved=[...latest.values()].filter(e=>e.kind==='error'&&/install|download|forbidden|403|failed|error/i.test(e.message||''));
 $('runningNumber').textContent=active?'1':'0';
 $('waitingNumber').textContent=queue.length;
 $('issueNumber').textContent=unresolved.length;
 $('activityState').textContent=active?'Active job':queue.length?'Waiting jobs':'Queue idle';
 $('currentActivity').textContent=active?
  (active.repo||'Unknown project')+' · '+(active.state||'Worker running')+' — '+(active.messages?.at(-1)||'No worker message yet'):
  queue.length?'No job is running; '+queue.length+' queued.':'No installation or update is running.';
 $('pendingActivity').textContent=queue.length?'Waiting: '+queue.join(', '):'No pending work.';
 const latestFirst=history.slice(-60).reverse();
 $('historyRows').innerHTML=latestFirst.length?latestFirst.map(e=>{
  const recovered=!!e.repo&&e.kind==='error'&&latest.get(e.repo)?.kind==='success'&&
   dateOf(latest.get(e.repo).time)>=dateOf(e.time);
  const kind=e.kind==='error'?(recovered?'Recovered earlier error':'Error'):(e.kind||'Event');
  return '<li><time>'+esc(e.time?new Date(e.time).toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Unreported')+'</time>'+
   '<div><strong>'+esc(projectById.get(e.repo)?.title||e.repo||'System')+'</strong><p>'+esc(e.message||'No details provided.')+'</p></div>'+
   '<span class="history-kind '+esc(e.kind)+'">'+esc(kind)+'</span></li>';
 }).join(''):'<li><div>No recorded history on this device.</div></li>';
}
function renderShell(){
 $('navInstalledCount').textContent=projects.filter(a=>!!a.installedVersion).length;
 $('connectionState').className='connection-state '+(snapshot?'connected':'offline');
 $('connectionState').innerHTML='<i aria-hidden="true"></i>'+(snapshot?'Local data connected':'Connection unavailable');
 $('footerDevice').textContent=snapshot?((snapshot.computer||'Local computer')+' · '+(snapshot.platform||'Unknown platform')):'Local data unavailable';
 $('footerUpdated').textContent=snapshot?.checkedAt?('Last source check '+dateLabel(snapshot.checkedAt)):'Release check time unavailable';
 const warn=snapshot?.scanError||snapshot?.sourceStatus?.error;
 $('sourceNotice').hidden=!warn;
 $('sourceNotice').textContent=warn?'Source check warning · '+String(warn).replace(/[.]+$/,'').trim()+'.':'';
 $('themeSwitch').setAttribute('aria-label',ui.theme==='dark'?'Switch to light appearance':'Switch to dark appearance');
}
function rerender(){
 renderShell();renderHome();renderBrowse();renderLibrary();renderActivity();
 if(ui.project&&projectById.has(ui.project))renderDocument(projectById.get(ui.project));
}
async function refresh(){
 $('refreshState').disabled=true;$('connectionState').textContent='Reading local data…';
 try{
  const response=await fetch('/api/state',{method:'GET',cache:'no-store'});
  if(!response.ok)throw Error('Local read API returned HTTP '+response.status);
  const data=await response.json();
  if(!Array.isArray(data.apps)||!Array.isArray(data.discoveries))throw Error('Unexpected API data shape');
  snapshot=data;
  projects=[...data.apps.map(a=>({...a,discovery:false})),...data.discoveries.map(a=>({...a,discovery:true}))];
  projectById=new Map(projects.map(a=>[a.repo,a]));
  rerender();
 }catch(error){
  $('connectionState').className='connection-state offline';
  $('connectionState').textContent='Connection unavailable';
  $('sourceNotice').hidden=false;
  $('sourceNotice').textContent='Read-only preview cannot reach the local source. '+error.message+
    '. No placeholder products or simulated state will be shown.';
  if(!snapshot){projects=[];projectById.clear();renderHome();renderBrowse();renderLibrary();renderActivity()}
 }finally{$('refreshState').disabled=false}
}
function themeToggle(){ui.theme=ui.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=ui.theme;renderShell()}
function action(event){
 const node=event.target.closest('button');if(!node)return;
 if(node.dataset.project){goProject(node.dataset.project,ui.screen);return}
 if(node.dataset.domain){goBrowse({domain:node.dataset.domain,query:'',scope:'all'});return}
 if(node.dataset.filterDomain){ui.domain=node.dataset.filterDomain;ui.limit=30;renderBrowse();return}
 if(node.dataset.scope){ui.scope=node.dataset.scope;ui.limit=30;renderBrowse();return}
 if(node.hasAttribute('data-home')){goHome();return}
 if(node.dataset.main){
  if(node.dataset.main==='home')goHome();
  if(node.dataset.main==='library')goLibrary();
  if(node.dataset.main==='activity')goActivity();
  return;
 }
 if(node.dataset.library){ui.libraryTab=node.dataset.library;renderLibrary();return}
}
document.addEventListener('click',action);
$('homeSearchForm').addEventListener('submit',e=>{e.preventDefault();$('homeSuggestions').hidden=true;goBrowse({query:$('homeSearch').value,domain:'all'})});
$('homeSearch').addEventListener('input',renderSuggestions);
$('exploreSearchForm').addEventListener('submit',e=>{e.preventDefault();ui.query=$('exploreSearch').value.trim();ui.limit=30;renderBrowse()});
$('exploreSearch').addEventListener('input',()=>{
 ui.query=$('exploreSearch').value.trim();ui.limit=30;renderBrowse();
 $('exploreSearch').focus({preventScroll:true});
});
$('filterToggle').addEventListener('click',()=>{ui.filtersOpen=!ui.filtersOpen;renderFilters()});
$('filterClear').addEventListener('click',()=>{ui.domain='all';ui.scope='all';ui.query='';ui.limit=30;renderBrowse()});
$('emptyReset').addEventListener('click',()=>goBrowse({domain:'all',query:'',scope:'all'}));
$('sortSelect').addEventListener('change',()=>{ui.sort=$('sortSelect').value;ui.limit=30;renderBrowse()});
$('loadMore').addEventListener('click',()=>{ui.limit+=30;renderBrowse()});
$('brandHome').addEventListener('click',goHome);
$('detailBack').addEventListener('click',goBack);
$('refreshState').addEventListener('click',refresh);
$('themeSwitch').addEventListener('click',themeToggle);
document.addEventListener('keydown',e=>{
 if((e.key==='/'||e.key.toLowerCase()==='k'&&(e.metaKey||e.ctrlKey))&&!e.altKey){
  const tag=document.activeElement?.tagName||'';
  if(e.key==='/'&&['INPUT','TEXTAREA','SELECT'].includes(tag))return;
  e.preventDefault();if(ui.screen!=='home'&&ui.screen!=='explore')goHome();
  (ui.screen==='explore'?$('exploreSearch'):$('homeSearch')).focus();return;
 }
 if(e.key==='Escape'){
  if(ui.screen==='project'){goBack();return}
  if(ui.screen==='home'){$('homeSuggestions').hidden=true;$('homeSearch').blur();return}
  if(ui.screen==='explore'&&ui.filtersOpen){ui.filtersOpen=false;renderFilters();return}
 }
});
window.addEventListener('popstate',event=>{
 restoringRoute=true;
 const previous=event.state?.focus4;
 if(previous&&screenIds[previous.screen]){
  for(const key of Object.keys(routeState()))if(Object.prototype.hasOwnProperty.call(previous,key))ui[key]=previous[key];
  setScreen(ui.screen);rerender();
 }else{ui.project=null;setScreen('home')}
 restoringRoute=false;
});
history.replaceState({focus4:routeState()},'','#/home');
routeReady=true;
renderShell();refresh();