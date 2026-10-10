'use strict';
/* Craft Update Center 2.0 — mockup-quality functional desktop interface. */
const $=id=>document.getElementById(id);
const glyph=(id,cls='')=>'<svg class="'+cls+'" aria-hidden="true"><use href="#i-'+id+'"></use></svg>';
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const I18N={
 en:{
 workspace:'WORKSPACE',general:'GENERAL',navApps:'Applications',navUpdates:'Updates',navNew:'Discoveries',navInstalled:'Installed',
 preferences:'Preferences',about:'About',connected:'CONNECTED TO GITHUB',checkUpdates:'Check for updates',
 heroKicker:'INDEPENDENT SOFTWARE · MADE TO CHALLENGE',heroLine1:'Meet the challengers.',heroLine2:'Beyond the big names.',
 heroSubtitle:'Discover bold, independent alternatives to expensive professional software. Track the projects worth watching.',
 appsInstalled:'Apps installed',updatesAvailable:'Updates available',newDiscovered:'Independent projects',
 libraryEyebrow:'CHALLENGER CATALOG',pageTitle:'Applications',pageSubtitle:'Emerging alternatives, mapped by creator, category and the software they challenge.',
 sortBy:'Sort by',sortActivity:'Repository activity',sortName:'Name',sortRelease:'Latest release',sortStatus:'Updates first',
 filterAll:'All apps',filterInstalled:'Installed',filterUpdates:'Updates',filterNew:'Discoveries',filterMissing:'Not installed',
 category:'Category',allCategories:'All categories',
 appDetails:'APP DETAILS',detailWhatsNew:"What's new",detailInfo:'Details',detailReleases:'Releases',fullChangelog:'Full changelog',
 verifiedSource:'Install and update only through separately reviewed, source-verified adapters.',
 verify:'Verify installs',updateAll:'Update all',activityLog:'Activity log',cancel:'Cancel',continue:'Continue',
 confirmTitle:'Confirm action',prefsDescription:'Your preferences stay on this device.',language:'Language',
 appearance:'Appearance',light:'Light',dark:'Dark',system:'System',
 aboutDescription:'An independent hub for discovering lesser-known open-source challengers to expensive professional software. Not affiliated with any featured creator.',
 searchPlaceholder:'Search all apps, products and alternatives…',
 noApps:'Nothing here yet',noAppsHint:'Try another filter, search, or scan for new releases.',
 loading:'Loading the challenger catalog…',scanning:'Scanning GitHub repositories…',
 noScan:'Not scanned yet',lastChecked:'Last checked',scanFailed:'GitHub scanning is temporarily unavailable. Cached results remain available.',
 requiresAdmin:'Installing on Windows requires an elevated local service.',statusCurrent:'Up to date',
 statusInstalled:'Installed',statusUpdate:'Update available',statusMissing:'Not installed',statusNew:'Discovery only',
 open:'Open',install:'Install',update:'Update',queued:'Queued',working:'Installing',unavailable:'Unavailable',details:'Details',
 appVersion:'Installed version',latest:'Latest release',repository:'Repository',pushed:'Last commit',
 released:'Released',platform:'Platform',license:'License',stars:'Stars',issues:'Open issues',size:'Package size',
 installPath:'Install location',source:'Source code',noDetails:'No additional metadata is available for this repository.',
 noChangelog:'No release notes were published for this version.',loadingChangelog:'Loading the actual GitHub changelog…',
 loadFailed:'Could not load the changelog right now. The GitHub link is still available.',
 noReleases:'No verified release source is connected yet.',loadingReleases:'Loading the release history from GitHub…',
 releaseHistoryFailed:'GitHub release history is currently unavailable; showing the latest known release.',
 prerelease:'Pre-release',releaseOfficial:'Latest',noVersion:'Not released',unknown:'Unknown',appGroup:'Category',
 addedQueue:n=>n+' job'+(n===1?'':'s')+' queued.',scanningStarted:'Repository scan started.',
 verified:'Installed versions refreshed.',openQueued:'Launching application…',openFailed:'Could not open the application.',
 confirmApp:(verb,name)=>verb+' '+name+' using a reviewed, source-verified installation adapter?',
 confirmBulk:n=>'Update '+n+' installed app'+(n===1?'':'s')+'? Each update is verified and installed sequentially.',
 emptyActivity:'No recent activity.',latestLabel:'Latest',showing:n=>n+' app'+(n===1?'':'s')+' shown',
 youAreCurrent:'All installed apps are up to date.',notConnected:'Local update service disconnected.',
 logoTagline:'INSTALL · UPDATE · CREATE',onThisDevice:'on this computer',
 desktop:'Desktop',document:'Documents',video:'Video',vector:'Vector design',image:'Photography',audio:'Audio',
 more:'More information',noVerifiedInstall:'No reviewed installation adapter is available for this project.',selectApp:'Select an application',
 newCandidates:'New discoveries',showAll:'Show all apps',syncing:'Checking for updates…',
  queueRunning:'Installing or updating',queueWaiting:'Waiting for installation',queueScanning:'Scanning repositories',
  waitingCount:n=>n+' in queue',queueNoMessage:'Checking the latest installation status…',
  allCurrent:'You’re all caught up',allCurrentHint:'No updates available. Your installed tools are current.',
  newEmpty:'Research intake is ready',newEmptyHint:'No lesser-known projects have been imported yet. Findings from your research will appear here.',
  filterEmpty:'No matching applications',filterEmptyHint:'Try another creator, category or search.',
  clearFilters:'Clear filters',expandNotes:'Show full release notes',collapseNotes:'Show less',
  cachedMode:'USING CACHED DATA',connected:'CONNECTED TO GITHUB',statusScanning:'SCANNING GITHUB',
  openDesktopOnly:'Open apps from the native Craft Update Center window.'
 }
};
const CATEGORY_NAMES={
 'תמונות':{en:'Photography'},'וקטור':{en:'Vector design'},
 'וידאו':{en:'Video'},'אפקטים':{en:'Motion graphics'},
 'עימוד':{en:'Page layout'},'מסמכים':{en:'Documents'},
 'גיליונות':{en:'Spreadsheets'},'מצגות':{en:'Presentations'},
 'CAD':{en:'CAD & drafting'},'אודיו':{en:'Audio production'},
 'חדש / לסקירה':{en:'New / review'}
};
const PRODUCT_DESC={
 photocraft:{en:'Image editing and photo manipulation'},
 vectorcraft:{en:'Vector graphics and illustration'},
 lightcraft:{en:'RAW photo development and editing'},
 filmcraft:{en:'Video editing and production'},
 effectcraft:{en:'Motion graphics and visual effects'},
 designcraft:{en:'Page layout and publishing'},
 pdfcraft:{en:'PDF editing and document management'},
 wordcraft:{en:'Documents and word processing'},
 gridcraft:{en:'Spreadsheets and data analysis'},
 deckcraft:{en:'Presentations and slide design'},
 cadcraft:{en:'CAD design and technical drafting'},
 soundcraft:{en:'Audio recording, editing and mixing'}
};
const pref=(key,fallback)=>{try{return localStorage.getItem('craft.center.v2.'+key)||fallback}catch(_){return fallback}};
const savePref=(key,value)=>{try{localStorage.setItem('craft.center.v2.'+key,value)}catch(_){}};
const ui={language:'en',creator:'all',
 theme:['system','light','dark'].includes(pref('theme','system'))?pref('theme','system'):'system',
 sort:['activity','name','release','status'].includes(pref('sort','activity'))?pref('sort','activity'):'activity',
 view:['grid','list'].includes(pref('view','list'))?pref('view','list'):'list',
 filter:'all',category:'all',selectedRepo:null,detailTab:'changes',search:'',mobileNav:false,notesExpanded:false,
 showExperimental:pref('showExperimental','true')!=='false',domain:'all',maturity:'all',availability:'all',platform:'all',
 workspaceMode:pref('workspaceMode','explore')==='focus'?'focus':'explore',
 domainsExpanded:pref('domainsExpanded','false')==='true',
 facetsExpanded:pref('facetsExpanded','false')==='true'};
if(pref('layoutMigration','')!=='2.5'){ui.view='list';savePref('view','list');savePref('layoutMigration','2.5')}
const t=k=>I18N.en[k]??k;
let state={apps:[],queue:[],history:[],scanning:false,scanError:'',checkedAt:null,active:null,platform:'',computer:'',admin:false};
const notesCache=new Map(),historyCache=new Map();
const osTheme=window.matchMedia('(prefers-color-scheme: dark)');
let workingPoll=false,cardSnapshot='',detailSnapshot='',toastTimer=null,confirmResolve=null;
let initialDataLoaded=false,categorySignature='',lastFocusedCard=null;
let activeNoticeKey='';
const htmlDate=iso=>{const ms=Date.parse(iso||'');return Number.isFinite(ms)?ms:0};
function localDate(iso,full=false){
 if(!htmlDate(iso))return '—';
 return new Intl.DateTimeFormat('en-US',full?
 {year:'numeric',month:'short',day:'numeric'}:{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso));
}
function localTime(iso){
 if(!htmlDate(iso))return t('noScan');
 return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
}
function nativeAppName(app){return app.summary||PRODUCT_DESC[app.repo.toLowerCase()]?.en||app.description||''}
function catName(group){return CATEGORY_NAMES[group]?.en||group||t('unknown')}
const DOMAIN_GROUPS=[
 ['all','Everything','Every challenger','#6faeff'],
 ['Design & Imaging','Design & Imaging','Images, typography and UI','#ae8bff'],
 ['Video & Animation','Video & Motion','Editing, compositing, animation','#ff9c94'],
 ['Live Production','Live Production','Broadcast, show control and lighting','#f1a876'],
 ['3D & Manufacturing','3D & CAD','Modeling, engineering and makers','#65d4c6'],
 ['Science & GIS','Science & GIS','Mapping, scientific research and analysis','#96b9f2'],
 ['Audio & Music','Audio & Music','Production, instruments and sound','#ebb56b'],
 ['Game Creation','Game Creation','Engines and interactive experiences','#7ac9b4'],
 ['Office & Productivity','Office & Productivity','Documents, PDF and spreadsheets','#94c2ff'],
 ['CRM & Sales','CRM & Sales','Customers and sales pipelines','#88e3b3'],
 ['ERP & Operations','ERP & Operations','Manufacturing, inventory and ops','#edb26e'],
 ['Business & Legal','Business & Legal','Business workflows and legal documents','#d5a9ee'],
 ['Data & Internal Tools','Data & Apps','Databases, low-code, dashboards','#88c6fc'],
 ['Marketing & Publishing','Marketing','Social scheduling and content','#e6a9ff'],
 ['AI & Agents','AI & Agents','Memory, RAG and agent runtimes','#c59cfd'],
 ['Developer & Automation','Dev & Automation','Workflows, runtimes, APIs','#6ebeee'],
 ['Security & Infrastructure','Security & Infra','Credentials, gateways and control','#88d1ba'],
 ['Finance & Accounting','Finance','Bookkeeping and finance','#eac58c']
];
function domainOf(a){
 if(a.category&&DOMAIN_GROUPS.some(g=>g[0]===a.category))return a.category;
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
function domainLabel(value){return DOMAIN_GROUPS.find(g=>g[0]===value)?.[1]||value}
function renderDomains(){
 const bar=$('domainFilters');if(!bar)return;
 const counts=new Map(DOMAIN_GROUPS.map(g=>[g[0],0]));
 for(const a of state.apps){const domain=domainOf(a);counts.set(domain,(counts.get(domain)||0)+1)}
 counts.set('all',state.apps.length);
 const markup=DOMAIN_GROUPS.filter(g=>g[0]==='all'||counts.get(g[0])>0).map(g=>{
   const [id,name,desc,color]=g,active=ui.domain===id;
   return '<button type="button" class="domain-pill'+(active?' active':'')+'" data-domain="'+escapeHTML(id)+'"'+
     ' aria-pressed="'+active+'" title="'+escapeHTML(desc)+'">'+
     '<span class="domain-dot" aria-hidden="true"></span><span class="domain-label">'+escapeHTML(name)+'</span>'+
     '<span class="domain-count">'+(counts.get(id)||0)+'</span></button>';
 }).join('');
 if(bar.innerHTML!==markup)bar.innerHTML=markup;
 $('domainTotal').textContent=state.apps.length+' projects across '+(DOMAIN_GROUPS.length-1)+' disciplines';
 updateWorkspaceControls();
}
/* 2.7: user-controlled workspace density, built on the existing live catalog. */
function updateWorkspaceControls(){
 const expanded=!!ui.domainsExpanded,facets=!!ui.facetsExpanded;
 $('domainSection').classList.toggle('domains-expanded',expanded);
 $('domainExpandButton').setAttribute('aria-expanded',String(expanded));
 const count=$('domainFilters').querySelectorAll('.domain-pill').length-1;
 $('domainExpandButton').textContent=expanded?'Show fewer categories ↑':'Show all '+Math.max(0,count)+' categories ↓';
 $('catalogFilters').hidden=!facets;
 $('facetToggle').setAttribute('aria-expanded',String(facets));
 const active=['maturity','availability','platform','category','creator'].filter(k=>ui[k]!=='all').length;
 $('facetToggle').textContent=facets?'Hide advanced filters ↑':'Advanced filters'+(active?' · '+active+' active':'')+' ↓';
 for(const button of document.querySelectorAll('[data-workspace-mode]')){
  const selected=button.dataset.workspaceMode===ui.workspaceMode;
  button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
 }
 document.documentElement.dataset.workspaceMode=ui.workspaceMode;
 $('focusOverview').hidden=ui.workspaceMode!=='focus';
}
function setWorkspaceMode(mode){
 if(mode!=='explore'&&mode!=='focus')return;
 ui.workspaceMode=mode;savePref('workspaceMode',mode);
 updateWorkspaceControls();
}
function setDomainsExpanded(expanded){
 ui.domainsExpanded=!!expanded;savePref('domainsExpanded',String(ui.domainsExpanded));
 updateWorkspaceControls();
}
function setFacetsExpanded(expanded){
 ui.facetsExpanded=!!expanded;savePref('facetsExpanded',String(ui.facetsExpanded));
 updateWorkspaceControls();
}
function renderWorkspaceOverview(list){
 $('workspaceRailCount').textContent=state.apps.length+' catalogued tools · '+state.apps.filter(a=>!!a.installedVersion).length+' installed';
 const context=$('contextHero').dataset.context;
 $('focusOverviewTitle').textContent=context==='home'?'All your tools. One focused view.':
  [$('heroContextLine1').textContent,$('heroContextLine2').textContent].join(' ');
 $('focusOverviewDetail').textContent=context==='home'?
  'Explore '+state.apps.length+' catalogued tools, including '+state.apps.filter(a=>!!a.installedVersion).length+' installed applications. Discovery entries are not automatically approved for installation.':
  $('heroContextSubtitle').textContent;
 $('focusOverviewCount').textContent=list.length+' matching project'+(list.length===1?'':'s');
 $('focusDailyOpen').disabled=$('dailyPickOpen').disabled;
 updateWorkspaceControls();
}
function initializeWorkspaceNavigation(){
 updateWorkspaceControls();
 for(const button of document.querySelectorAll('[data-workspace-mode]'))button.addEventListener('click',()=>setWorkspaceMode(button.dataset.workspaceMode));
 $('domainExpandButton').addEventListener('click',()=>setDomainsExpanded(!ui.domainsExpanded));
 $('facetToggle').addEventListener('click',()=>setFacetsExpanded(!ui.facetsExpanded));
 $('focusDailyOpen').addEventListener('click',()=>{if(!$('dailyPickOpen').disabled)$('dailyPickOpen').click()});
}
function stageOf(app){
 const text=String(app.reportedMaturity||'').toLowerCase();
 if(app.developmentStage==='dormant'||/dormant|maintenance uncertain/.test(text))return {key:'dormant',label:'Dormant / watchlist'};
 if(/pre[- ]?alpha|prototype|experimental|very early/.test(text))return {key:'prealpha',label:'Early / experimental'};
 if(/alpha|early desktop|young project/.test(text))return {key:'alpha',label:'Alpha'};
 if(/beta|release candidate|\brc\b/.test(text))return {key:'beta',label:'Beta / RC'};
 if(/stable|established|mature|long-running/.test(text))return {key:'stable',label:'Stable'};
 return {key:'unknown',label:'Stage unverified'};
}
function maturityMarkup(app){const s=stageOf(app);const maturity='<span class="maturity-badge maturity-'+s.key+'" title="'+escapeHTML(app.reportedMaturity||'Project maturity has not been independently assessed')+'">'+escapeHTML(s.label)+'</span>';
 return maturity+(app.bleedingEdge?'<span class="edge-badge" title="Bleeding edge: experimental, rapidly changing development; not a stable release guarantee">Bleeding edge</span>':'');}
function capabilityOf(a){
 if(a.installable)return 'install';if(a.downloadablePortable)return 'portable';
 const mode=String(a.deploymentType||'').toLowerCase();
 if(mode.includes('docker')||mode.includes('self-host')||mode.includes('server')||mode.includes('cli'))return 'deploy';
 return 'source';
}
function platformFits(a,p){
 if(p==='all')return true;
 const mode=String(a.deploymentType||'').toLowerCase();
 if(p==='hosted')return mode.includes('docker')||mode.includes('self-host')||mode.includes('server')||mode.includes('web')||mode.includes('cli');
 if(mode.includes('docker')||mode.includes('self-host')||mode.includes('server')||mode.includes('cli'))return false;
 const platforms=(a.reportedPlatforms||[]).join(' ').toLowerCase();
 if(p==='windows')return /windows/.test(platforms)||(!a.discovery&&state.platform==='win32');
 if(p==='mac')return /macos|mac os|apple silicon/.test(platforms)||(!a.discovery&&state.platform==='darwin');
 if(p==='linux')return /linux/.test(platforms);
 return false;
}
function statusOf(app){
 if(app.researchPendingVerification)return {kind:'new',label:'Research only · unverified'};
 if(app.needsUpdate)return {kind:'update',label:'Update available'};
 if(app.installedVersion)return {kind:'ok',label:app.current?'Up to date':'Installed'};
 if(app.installable)return {kind:'ready',label:'Install available'};
 if(app.downloadablePortable)return {kind:'ready',label:'Portable download'};
 const mode=String(app.deploymentType||'').toLowerCase();
 if(mode.includes('docker')||mode.includes('self-host'))return {kind:'tracked',label:'Manual deployment'};
 if(mode.includes('server')||mode.includes('cli'))return {kind:'tracked',label:'Manual setup'};
 if(app.discovery&&app.releaseTag)return {kind:'tracked',label:'Manual install'};
 if(app.discovery)return {kind:'new',label:app.releaseStatus==='repository-only'?'No verified release':'Source only'};
 return {kind:'missing',label:'Not installed'};
}
function byteSize(n){if(!Number.isFinite(n))return '—';return n>=1e9?(n/1e9).toFixed(2)+' GB':(n/1e6).toFixed(1)+' MB'}
function safeGitHubUrl(value){
 if(typeof value!=='string')return null;
 let u;try{u=new URL(value)}catch(_){return null}
 if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.port)return null;
 return state.apps.some(a=>a.repoUrl&&(value===a.repoUrl||value.startsWith(a.repoUrl+'/')))?value:null;
}
function openGithub(url){const safe=safeGitHubUrl(url);if(safe)window.open(safe,'_blank','noopener,noreferrer')}
function showToast(message,error=false){
 const el=$('toast');clearTimeout(toastTimer);el.textContent=message;el.className='toast'+(error?' error':'');
 toastTimer=setTimeout(()=>el.classList.add('hidden'),4700);
}
async function api(method,url,data){
 const opts={method,cache:'no-store',headers:{}};
 if(method!=='GET'){opts.headers['Content-Type']='application/json';opts.headers['X-Requested-With']='CraftUpdateCenter';opts.body=JSON.stringify(data||{})}
 const r=await fetch(url,opts);let json={};
 try{json=await r.json()}catch(e){throw Error('Invalid response from local service')}
 if(!r.ok)throw Error(json.error||'HTTP '+r.status);
 return json;
}
function applyTheme(){
 const resolved=ui.theme==='system'?(osTheme.matches?'dark':'light'):ui.theme;
 document.documentElement.dataset.theme=resolved;
 for(const btn of document.querySelectorAll('[data-theme-choice]')){
   const selected=btn.dataset.themeChoice===ui.theme;
   btn.classList.toggle('active',selected);btn.setAttribute('aria-pressed',String(selected));
   const title=t(btn.dataset.themeChoice);
   btn.title=title;btn.setAttribute('aria-label',title);
 }
 try{window.chrome?.webview?.postMessage({type:'theme',value:resolved})}catch(_){}
 try{window.webkit?.messageHandlers?.craftTheme?.postMessage(resolved)}catch(_){}
}
function applyLanguage(){
 document.documentElement.lang='en';document.documentElement.dir='ltr';
 for(const node of document.querySelectorAll('[data-t]')){
   const translation=t(node.dataset.t);
   if(typeof translation==='string')node.textContent=translation;
 }
 /* UI uses English exclusively. */
 $('searchInput').placeholder=t('searchPlaceholder');
 $('searchInput').setAttribute('aria-label',t('searchPlaceholder'));
 $('searchShortcut').textContent=/Mac|iPhone|iPad/.test(navigator.platform||'')?'⌘ K':'Ctrl K';
 for(const btn of document.querySelectorAll('[data-stat-filter]')){
   btn.setAttribute('aria-label',t(btn.dataset.statFilter==='installed'?'navInstalled':btn.dataset.statFilter==='updates'?'navUpdates':'navNew'));
 }
 const pageTitles={all:'pageTitle',updates:'navUpdates',installed:'navInstalled',new:'navNew',missing:'filterMissing'};
 $('pageTitle').textContent=t(pageTitles[ui.filter]||'pageTitle');
 $('pageSubtitle').textContent=t('pageSubtitle');
 applyTheme();render(true);
}
function setTheme(mode){
 if(!['system','light','dark'].includes(mode))return;
 ui.theme=mode;savePref('theme',mode);applyTheme();
}
function getCounters(){
 return {all:state.apps.length,installed:state.apps.filter(a=>!!a.installedVersion).length,
 updates:state.apps.filter(a=>!!a.needsUpdate).length,
 new:state.apps.filter(a=>!!a.isNew).length,
 missing:state.apps.filter(a=>!a.installedVersion).length};
}
function queueLabel(repo){
 return state.apps.find(a=>a.repo===repo)?.title||repo||'Unknown application';
}
function latestQueueOutcomes(){
 const result=new Map();
 for(const row of state.history||[])if(row&&row.repo&&(row.kind==='success'||row.kind==='error'))result.set(row.repo,row);
 return result;
}
function queueErrors(){
 // An older failed attempt is not a current failure if this product succeeded afterwards.
 return [...latestQueueOutcomes().values()].filter(e=>e.kind==="error"&&/install|download|forbidden|403|failed|error/i.test(e.message||"")).sort((a,b)=>htmlDate(a.time)-htmlDate(b.time));
}
function queueErrorKey(e){return e?[e.repo,e.time,e.message].join("|"):""}
function queueStage(active){
 if(!active)return "Idle";
 const message=String(active.state||active.messages?.at(-1)||'').toLowerCase();
 if(/download/.test(message))return 'Downloading';
 if(/verif|checksum|sha256|signature/.test(message))return 'Verifying';
 if(/install|unpack|copy/.test(message))return 'Installing';
 if(active.mode==='portable')return 'Preparing portable download';
 return active.mode==='update'?'Updating':'Installing';
}
function renderQueueDialog(){
 const active=state.active,pending=state.queue||[],errors=queueErrors();
 const outcomes=latestQueueOutcomes();
 $('queueDialogSummary').textContent=(active?'1 running · ':'')+pending.length+' waiting · '+errors.length+' unresolved issue'+(errors.length===1?'':'s')+'. Previous attempts remain in History.';
 $('queueMetricActive').textContent=active?'1':'0';
 $('queueMetricWaiting').textContent=String(pending.length);
 $('queueMetricIssues').textContent=String(errors.length);
 const messages=active?.messages?.slice(-4)||[];
 $('queueCurrentDetail').textContent=active?queueLabel(active.repo)+' · '+queueStage(active)+(messages.length?'\n'+messages.join('\n'):'\nWaiting for installer output'):'Nothing is running. The queue is ready for new tasks.';
 $('queuePendingCount').textContent=String(pending.length);
 const pendingList=$('queuePendingList');pendingList.replaceChildren();
 if(!pending.length){const empty=document.createElement('li');empty.textContent='No pending tasks';pendingList.appendChild(empty)}
 pending.forEach((repo,index)=>{
  const item=document.createElement('li');item.textContent=String(index+1).padStart(2,'0')+' · '+queueLabel(repo);pendingList.appendChild(item);
 });
 const recent=$('queueRecentList');recent.replaceChildren();
 const previous=(state.history||[]).filter(e=>e.repo&&(e.kind==='error'||e.kind==='success')).slice(-24).reverse();
 if(!previous.length){const row=document.createElement('p');row.textContent='No completed installs or updates recorded yet';recent.appendChild(row)}
 for(const entry of previous){
  const followedBySuccess=entry.kind==='error'&&outcomes.get(entry.repo)?.kind==='success'&&htmlDate(outcomes.get(entry.repo).time)>=htmlDate(entry.time);
  const isOutstanding=entry.kind==='error'&&!followedBySuccess;
  const row=document.createElement('div');row.className='queue-history-row'+(isOutstanding?' queue-failed':followedBySuccess?' queue-resolved':' queue-succeeded');
  const label=document.createElement('strong');label.textContent=queueLabel(entry.repo)+' · '+(followedBySuccess?'Past failure · recovered':isOutstanding?'Needs attention':'Completed');
  const message=document.createElement('p');message.textContent=String(entry.message||'').slice(0,310);
  const when=document.createElement('small');when.textContent=localTime(entry.time);
  row.append(label,message,when);recent.appendChild(row);
 }
}
function renderQueue(){
 const active=state.active,pending=state.queue||[],issues=queueErrors();
 const latest=issues.at(-1);
 const key=queueErrorKey(latest);
 const recentIssue=!!latest&&Date.now()-htmlDate(latest.time)<30*60*1000&&pref('queueDismissedFailure','')!==key;
 const isRunning=!!active,isWaiting=!active&&pending.length>0;
 const activity=isRunning?"active":isWaiting?"waiting":recentIssue?"attention":"idle";
 const panel=$('workQueue');panel.classList.remove('hidden','queue-error');
 panel.classList.toggle('queue-idle',activity==='idle');
 panel.classList.toggle('queue-active',isRunning);
 panel.classList.toggle('queue-waiting',isWaiting);
 panel.classList.toggle('queue-attention',activity==='attention');
 panel.dataset.errorKey=recentIssue?key:'';
 document.body.classList.add('queue-dock-visible');
 const total=(active?1:0)+pending.length;
 const number=String(total);
 $('queueFooterCount').textContent=number;
 $('queueToolbarCount').textContent=number;
 $('queueNavCount').textContent=number;
 $('queueToolbarStatus').textContent=isRunning?'RUNNING':isWaiting?'WAITING':recentIssue?'REVIEW':'IDLE';
 $('queueToolbarButton').dataset.queueState=activity;
 $('queueToolbarButton').title=total?total+' active/waiting job(s) · Open queue':recentIssue?'An update needs attention · Open queue':'Open installations, updates and history';
 $('queueNavButton').setAttribute('aria-label','Open installation and update queue · '+(total?total+' active or waiting':'idle'));
 $('queueTitle').textContent=isRunning?queueStage(active)+' · '+queueLabel(active.repo):isWaiting?pending.length+' task'+(pending.length===1?'':'s')+' waiting':recentIssue?'An update needs attention':'Queue is clear';
 $('queueMessage').textContent=isRunning?String(active.messages?.at(-1)||'Waiting for installer output').slice(0,140):isWaiting?'Processing sequentially · '+queueLabel(pending[0]):recentIssue?queueLabel(latest.repo)+' · '+String(latest.message||'Review the latest error').slice(0,110):'No installations or updates running';
 $('queueCount').textContent=pending.length?pending.length+' waiting':isRunning?'1 running':'';
 $('queueProgress').hidden=!isRunning;
 $('queueProgress').classList.toggle('queue-progress-idle',!isRunning);
 $('queueProgress').setAttribute('aria-valuetext',isRunning?queueStage(active)+'; installer has not reported an exact percentage':'No job currently progressing');
 $('queueDockDismiss').hidden=!recentIssue||!!active||pending.length>0;
 $('queueIndicatorIcon').classList.toggle('is-working',isRunning);
 if($('queueDialog').open)renderQueueDialog();
}
function renderBulkUpdateBar(){
 const bar=$('bulkUpdateBar');if(!bar)return;
 const shown=initialDataLoaded&&ui.filter==='updates'&&!(window.ChallengerUX?.hasSearch?.());
 bar.hidden=!shown;
 const updates=state.apps.filter(a=>a.needsUpdate);
 const eligible=updates.filter(a=>a.installable);
 const blocked=updates.length-eligible.length;
 const busy=!!state.active||(state.queue?.length||0)>0;
 const needsAdmin=state.platform==='win32'&&!state.admin;
 $('bulkUpdateTitle').textContent=eligible.length?eligible.length+' verified update'+(eligible.length===1?'':'s')+' ready':'No approved updates ready';
 $('bulkUpdateDescription').textContent=eligible.length?
   'Queues vetted software updates sequentially on this computer.'+(blocked?' '+blocked+' update'+(blocked===1?'':'s')+' require manual handling.':''):
   blocked?blocked+' update'+(blocked===1?'':'s')+' do not have approved installation packages.':'No installed software needs a verified update.';
 $('bulkUpdateEligibleCount').textContent=String(eligible.length);
 const button=$('updateAllButton');
 button.disabled=!eligible.length||busy||needsAdmin;
 button.title=busy?'Wait for the current installation queue to finish':needsAdmin?'Administrator access is required on Windows':!eligible.length?'No eligible verified updates to queue':'Queue '+eligible.length+' verified update'+(eligible.length===1?'':'s')+' after confirmation';
}
function renderCounters(){
 const c=getCounters();
 $('sourceSummary').textContent=[...new Set(state.apps.map(a=>a.creator||'Storytold'))].length+' creators';
 const set=(id,n)=>{$(id).textContent=n};
 set('navCountAll',c.all);set('navCountInstalled',c.installed);
 set('navCountUpdates',c.updates);set('navCountNew',c.new);
 set('metricInstalled',c.installed);set('metricUpdates',c.updates);set('metricNew',c.new);
 set('filterCountUpdates',c.updates);set('filterCountNew',c.new);
 $('navCountUpdates').classList.toggle('zero',!c.updates);
 const checked=Number(state.sourceStatus?.checked||0),total=Number(state.sourceStatus?.total||0);
 const scanText=total?(checked+' / '+total+' sources checked'+(state.checkedAt?' · '+localTime(state.checkedAt):'')):
   state.checkedAt?t('lastChecked')+': '+localTime(state.checkedAt):t('noScan');
 $('lastScanText').textContent=scanText;$('footerScan').textContent=scanText;
 $('deviceLabel').textContent=(state.platform==='win32'?'Windows':'macOS')+' · '+(state.computer||t('desktop'));
 $('onlineDot').classList.toggle('connected',!state.scanError);
 $('footerDot').classList.toggle('connected',!state.scanError);
 document.querySelector('.connection-label [data-t=connected]').textContent=state.scanning?t('statusScanning'):
   state.scanError?t('cachedMode'):t('connected');
 const notices=[];
 if(state.scanError){
  const scanMessage=String(state.scanError).slice(0,155)
    .replace(/(?:[;,.]\s*)?cached (?:project )?information remains available\.?/ig,'')
    .replace(/^\s*1 source checks need retry/i,'1 source check needs retry')
    .trim().replace(/[.,;]+$/,'');
  notices.push('Release checks · '+scanMessage+'. Cached data remains available.');
 }
 if(state.platform==='win32'&&!state.admin)notices.push(t('requiresAdmin'));
 activeNoticeKey=notices.join("|");
 const dismissed=activeNoticeKey&&pref('noticeDismissedKey','')===activeNoticeKey;
 $('notice').className=notices.length&&!dismissed?'notice notice-informational':'notice hidden';
 $('notice').dataset.noticeKey=activeNoticeKey;
 $('noticeMessage').textContent=notices.join(' ');
 $('noticeDismiss').hidden=!notices.length;
 $('sidebarScan').disabled=!!state.sourceStatus?.queued;
 renderBulkUpdateBar();
}
function filteredApps(){
 const q=ui.search.toLowerCase().trim();
 if(q&&window.ChallengerUX?.globalResults)return window.ChallengerUX.globalResults(q);
 const apps=state.apps.filter(a=>{
   if(q&&![a.repo,a.title,a.original,a.description,a.group,domainOf(a),a.creator,a.repository,a.replacementType,a.reportedMaturity,a.caveats,(a.reportedPlatforms||[]).join(' '),(a.challenges||[]).join(' '),competitorTargets(a).map(x=>x.company+' '+x.product).join(' '),nativeAppName(a)].join(' ').toLowerCase().includes(q))return false;
   if(ui.filter==='installed'&&!a.installedVersion)return false;
   if(ui.filter==='updates'&&!a.needsUpdate)return false;
   if(ui.filter==='new'&&!a.isNew)return false;
   if(ui.filter==='missing'&&a.installedVersion)return false;
   if(ui.category!=='all'&&a.group!==ui.category)return false;
   if(ui.maturity!=='all'&&stageOf(a).key!==ui.maturity)return false;
   if(ui.availability!=='all'&&capabilityOf(a)!==ui.availability)return false;
   if(!platformFits(a,ui.platform))return false;
   if(ui.domain!=='all'&&domainOf(a)!==ui.domain)return false;
   if(ui.creator!=='all'&&(a.creator||'Storytold')!==ui.creator)return false;
   if(!ui.showExperimental&&a.discovery&&['alpha','prealpha'].includes(stageOf(a).key))return false;
   return true;
 });
 const alpha=(a,b)=>a.title.localeCompare(b.title,'en',{sensitivity:'base'});
 apps.sort((a,b)=>{
   if(ui.sort==='name')return alpha(a,b);
   if(ui.sort==='release')return (Date.parse(b.publishedAt||0)||0)-(Date.parse(a.publishedAt||0)||0)||alpha(a,b);
   if(ui.sort==='activity')return (Date.parse(b.pushedAt||0)||0)-(Date.parse(a.pushedAt||0)||0)||alpha(a,b);
   const rank=x=>x.needsUpdate?0:x.isNew?1:!x.installedVersion?2:3;
   return rank(a)-rank(b)||alpha(a,b);
 });
 return apps;
}
function productIcon(a,cls='app-icon'){
 const name=String(a.title||a.repo||'?');
 const segments=name.trim().split(/\s+/);
 const monogram=a.discovery?(segments.length>1?segments.slice(0,2).map(s=>s[0]).join(''):name.slice(0,2)).toUpperCase():name[0].toUpperCase();
 const fallback='<span class="fallback" aria-hidden="true">'+glyph('package')+'</span>';
 const icon=a.discovery&&!a.officialIconAvailable?'':'<img src="/api/icon/'+encodeURIComponent(a.repo.toLowerCase())+'" loading="lazy" decoding="async" alt="" title="Verified creator-controlled app icon">';
 const hue=[...String(a.repo)].reduce((s,c)=>s+c.charCodeAt(0),0)%300+24;
 return '<div class="'+cls+(a.discovery?' research-app-icon':'')+'"'+''+'>'+fallback+icon+'</div>';
}
function primaryAction(a){
 if(state.active?.repo===a.repo)return {verb:'Working',action:'wait',disabled:true};
 if(state.queue.includes(a.repo))return {verb:'Queued',action:'wait',disabled:true};
 if(a.needsUpdate&&a.installable)return {verb:'Update',action:'install',disabled:state.platform==='win32'&&!state.admin};
 if(a.installedVersion)return {verb:'Open',action:'launch',disabled:false};
 if(a.installable)return {verb:'Install',action:'install',disabled:state.platform==='win32'&&!state.admin};
 if(a.downloadablePortable)return {verb:'Portable',action:'portable',disabled:!!state.active};
 if(a.researchPendingVerification)return {verb:'Details',action:'details',disabled:false};
 return capabilityOf(a)==='deploy'?{verb:'Setup guide',action:'guide',disabled:false}:{verb:'Details',action:'details',disabled:false};
}

const COMMERCIAL_VENDORS=[
 ['Adobe',/^(adobe |photoshop|illustrator|lightroom|premiere|after effects|acrobat|indesign)/i],
 ['Microsoft',/^(microsoft |word$|excel$|powerpoint$)/i],
 ['Autodesk',/^(autodesk |autocad|fusion 360|eagle|meshmixer)/i],
 ['Avid',/^(avid |pro tools)/i],
 ['Dassault Systèmes',/^solidworks/i],
 ['Blackmagic Design',/^davinci resolve/i],
 ['Apple',/^(final cut pro|logic pro)/i],
 ['Ableton',/^ableton live/i],
 ['Bitwig',/^bitwig studio/i],
 ['Figma',/^figma/i],
 ['Canva / Affinity',/^affinity/i],
 ['Steinberg',/^(steinberg |cubase)/i],
 ['Image-Line',/^fl studio/i],
 ['Topaz Labs',/^topaz/i],
 ['Altium',/^altium/i],
 ['Toon Boom',/^toon boom/i],
 ['Leica Geosystems',/^leica cyclone/i],
 ['Geomagic / Oqton',/^geomagic/i],
 ['Native Instruments',/^(native instruments |reaktor)/i],
 ['VCV',/^vcv rack/i],
 ['Aseprite',/^aseprite/i],
 ['MagicaVoxel',/^magicavoxel/i],
 ['Simplify3D',/^simplify3d/i],
 ['Live2D',/^live2d/i],
 ['RoboFont',/^robofont/i],
 ['Glyphs',/^glyphs/i]
];
function competitorTargets(a){
 const targets=Array.isArray(a.competition)&&a.competition.length?
   a.competition.map(x=>({company:String(x.company||'').trim()||null,product:String(x.product||'').trim(),scope:x.scope||null})):
   (Array.isArray(a.challenges)&&a.challenges.length?a.challenges:
      a.original&&a.original!=='Emerging alternative - review required'?[a.original]:[]).map(s=>{
     const value=String(s).trim(),hit=COMMERCIAL_VENDORS.find(x=>x[1].test(value));
     const company=hit?.[0]||null;
     let product=value;
     for(const c of ['Adobe','Microsoft','Autodesk','Avid','Steinberg'])if(company===c)
       product=value.replace(new RegExp('^'+c+'\\s+','i'),'');
     return {company,product,scope:null};
   });
 return targets.filter(x=>x.product);
}

/* Challenger Hub 2.6.0 · Catalog-grounded contextual discovery.
   Uses only already loaded project metadata. No network calls or install actions. */
let discoverySignature='',heroFeature={type:'daily',repo:null};
function cleanCompetitorCompany(company){
 const value=String(company||'').trim();
 return /^(vendor (to verify|unverified)|unknown|unverified|not verified|tbd|n\/?a)$/i.test(value)?'':value;
}
function readableCompetitor(x){
 const company=cleanCompetitorCompany(x.company),product=String(x.product||'').trim();
 if(!company)return product;
 return product.toLowerCase().startsWith(company.toLowerCase()+' ')?product:company+' · '+product;
}
function competitorMarkup(a){
 const targets=competitorTargets(a);
 if(!targets.length)return '';
 return targets.slice(0,3).map(x=>{
  const company=cleanCompetitorCompany(x.company),name=readableCompetitor(x);
  const product=String(x.product||'').trim();
  const prefixed=company&&product.toLowerCase().startsWith(company.toLowerCase()+' ');
  const content=company&&!prefixed?
   '<strong>'+escapeHTML(company)+'</strong> <span class="competitor-product">'+(window.ChallengerUX?.highlight(product)||escapeHTML(product))+'</span>':
   '<span class="competitor-product">'+(window.ChallengerUX?.highlight(name)||escapeHTML(name))+'</span>';
  return '<span class="competitor-pair" title="'+escapeHTML(name+(x.scope?' · '+x.scope:''))+'">'+content+'</span>';
 }).join('')+
 (targets.length>3?'<small class="competitor-more" title="Open details for the full competitor list">+'+(targets.length-3)+' more in details</small>':'');
}
function discoveryDay(){
 const d=new Date();
 return {number:Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000),
  label:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d)};
}
function dailyRecommendation(dayNumber){
 const trusted=state.apps.filter(a=>a.discovery&&!a.researchPendingVerification&&a.repoUrl&&a.title);
 const candidates=trusted.length?trusted:state.apps.filter(a=>a.discovery&&a.repoUrl&&a.title);
 const pool=candidates.sort((x,y)=>x.title.localeCompare(y.title,'en',{sensitivity:'base'}));
 return pool.length?pool[((dayNumber%pool.length)+pool.length)%pool.length]:null;
}
function discoveryTopics(scope,dayNumber,selected){
 const items=new Map();
 function add(candidate,weight){
  const product=String(candidate?.product||'').trim(),company=cleanCompetitorCompany(candidate?.company);
  if(!product||product.length>32||/^(unspecified|unknown|other|n\/?a|proprietary)/i.test(product))return;
  const name=readableCompetitor({company,product});
  if(name.length>34)return;
  const query=company&&product.toLowerCase().startsWith(company.toLowerCase()+' ')?product:company?company+' '+product:product;
  const count=window.ChallengerUX?.globalResults(query)?.length||0;
  if(!count)return;
  const key=name.toLowerCase(),previous=items.get(key);
  if(previous){previous.weight+=weight+1;return}
  items.set(key,{name,query,company,weight:weight+count});
 }
 for(const app of scope)for(const target of competitorTargets(app))add(target,2);
 if(items.size<7)for(const app of state.apps.filter(a=>a.discovery))for(const target of competitorTargets(app))add(target,0);
 for(const title of ['Photoshop','After Effects','AutoCAD','Power Apps','Airtable','Figma','Illustrator','Notion','SolidWorks']){
  if(items.size>=4)break;
  add({company:null,product:title},0);
 }
 const sorted=[...items.values()].sort((x,y)=>y.weight-x.weight||x.name.localeCompare(y.name));
 if(!sorted.length)return [];
 const focused=selected?new Set(competitorTargets(selected).map(x=>readableCompetitor(x).toLowerCase())):new Set();
 const picks=sorted.filter(x=>focused.has(x.name.toLowerCase())).slice(0,2);
 const remaining=sorted.filter(x=>!picks.includes(x));
 const start=dayNumber%Math.max(1,remaining.length);
 for(let i=0;i<remaining.length&&picks.length<4;i++){
  const choice=remaining[(start+i)%remaining.length];
  if(!picks.some(x=>x.query.toLowerCase()===choice.query.toLowerCase())&&
     (!choice.company||!picks.some(x=>x.company===choice.company)))picks.push(choice);
 }
 // If a category is too narrow, still fill the row with catalog-supported options.
 for(let i=0;i<remaining.length&&picks.length<4;i++){
  const choice=remaining[(start+i)%remaining.length];
  if(!picks.some(x=>x.query.toLowerCase()===choice.query.toLowerCase()))picks.push(choice);
 }
 return picks.slice(0,4);
}
function renderDiscoveryStage(list){
 if(!initialDataLoaded)return;
 const day=discoveryDay(),daily=dailyRecommendation(day.number),selected=state.apps.find(a=>a.repo===ui.selectedRepo);
 const signature=[day.number,ui.filter,ui.domain,ui.category,ui.search,ui.selectedRepo||'',state.apps.length,
  state.apps.filter(a=>a.needsUpdate).length,state.apps.filter(a=>a.installedVersion).length].join('|');
 if(signature===discoverySignature)return;
 discoverySignature=signature;
 let kicker='INDEPENDENT SOFTWARE · CURATED DISCOVERY',headline='Find your next tool.',line='Beyond the usual.';
 let subtitle='Explore independent projects, compare familiar software and follow upstream activity.';
 let context='home',actionText='Explore today’s discovery',note='Daily rotation · '+day.label;
 heroFeature={type:'daily',repo:daily?.repo||null};
 const search=String(ui.search||'').trim();
 const updates=state.apps.filter(a=>a.needsUpdate).length,installed=state.apps.filter(a=>a.installedVersion).length;
 if(selected){
  context='selected';kicker='IN FOCUS · '+domainLabel(domainOf(selected)).toUpperCase();
  headline=selected.title;line='Explore the project.';
  subtitle=nativeAppName(selected)||'Review the source repository and alternatives.';
  note=selected.researchPendingVerification?'Research candidate · unverified':'Source-tracked project';
  heroFeature={type:'selected',repo:selected.repo};actionText='View project details';
 }else if(search){
  context='search';kicker='LIVE CATALOG SEARCH';
  headline='Exploring “'+search.slice(0,28)+(search.length>28?'…':'')+'”';
  line=list.length+' matching project'+(list.length===1?'':'s')+'.';
  subtitle='Matches across project names, descriptions and competing software from the entire catalog.';
  heroFeature={type:'project',repo:list[0]?.repo||null};actionText='Inspect first match';note='Results ranked by relevance';
 }else if(ui.filter==='updates'){
  context='updates';kicker='YOUR TOOLKIT · AVAILABLE UPDATES';
  headline=updates+' updates available.';line='Stay in control.';
  subtitle='Review approved packages first. Updates are only queued after your explicit confirmation.';
  heroFeature={type:'updates'};actionText='Review available updates';note='Installation requires confirmation';
 }else if(ui.filter==='installed'){
  context='installed';kicker='YOUR TOOLKIT · THIS DEVICE';
  headline=installed+' installed apps.';line='Your creative workspace.';
  subtitle='Inspect the applications on this computer, check releases and follow changes.';
  note='Independent discovery continues below';
 }else if(ui.filter==='new'){
  context='discoveries';kicker='RESEARCH DESK · INDEPENDENT PROJECTS';
  headline=state.apps.filter(a=>a.discovery).length+' independent projects.';line='Keep discovering.';
  subtitle='An independent software landscape from experiments to established alternatives.';
  note='Research-only entries cannot be installed automatically';
 }else if(ui.domain!=='all'||ui.category!=='all'){
  context='category';kicker='YOUR FOCUS · '+(ui.domain!=='all'?'CATEGORY':'SUBCATEGORY');
  headline=ui.domain!=='all'?domainLabel(ui.domain):catName(ui.category);
  line=list.length+' projects to explore.';
  subtitle='Compare related solutions and explore information linked to their source repositories.';
  note='Category exploration · '+day.label;
 }else if(ui.filter==='missing'){
  context='discoveries';kicker='NEW POSSIBILITIES · NOT INSTALLED';
  headline='Room for new ideas.';line=list.length+' projects to explore.';
  subtitle='Explore independent alternatives before deciding what is worth trying.';
  note='Explore first · install only after approval';
 }
 $('contextHero').dataset.context=context;
 $('heroContextKicker').textContent=kicker;
 $('heroContextLine1').textContent=headline;
 $('heroContextLine2').textContent=line;
 $('heroContextSubtitle').textContent=subtitle;
 $('heroContextNote').textContent=note;
 $('heroContextAction').querySelector('.hero-action-text').textContent=actionText;
 $('heroContextAction').disabled=!heroFeature.repo&&heroFeature.type!=='updates';
 $('dailyPick').hidden=!daily;
 if(daily){
  $('dailyPick').setAttribute('aria-busy','false');
  $('dailyPickOpen').disabled=false;
  $('dailyPickWhy').disabled=false;
  $('dailyPickTitle').textContent=daily.title;
  $('dailyPickSummary').textContent=nativeAppName(daily)||'Explore project information and the official source.';
  $('dailyPickCategory').textContent=domainLabel(domainOf(daily));
  $('dailyPickTrust').textContent=daily.researchPendingVerification?'Research · verification pending':
   'Source-tracked · '+stageOf(daily).label+' (reported)';
  $('dailyPickDate').textContent=day.label;
  $('dailyPickEmblem').textContent=daily.title.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  $('dailyPickOpen').dataset.repo=daily.repo;
  $('dailyPickReason').textContent='Rotates each local calendar day among repository-linked independent projects. This is an exploration prompt, not an endorsement, verification of features, or installation approval.';
  $('dailyPickReason').hidden=true;
  $('dailyPickWhy').setAttribute('aria-expanded','false');
 }
 const scope=selected?[selected,...state.apps.filter(a=>domainOf(a)===domainOf(selected))]:
  ui.domain!=='all'?state.apps.filter(a=>domainOf(a)===ui.domain):
  search?list:ui.filter==='updates'?state.apps.filter(a=>a.needsUpdate):state.apps.filter(a=>a.discovery);
 const topics=discoveryTopics(scope,day.number,selected);
 $('challengeEyebrow').textContent=selected?'MORE TOOLS FOR THE SAME NEED':
  search?'DISCOVER RELATED ALTERNATIVES':ui.domain!=='all'?'COMPARE IN THIS CATEGORY':'FRESH COMPARISONS FROM THE CATALOG';
 $('challengeHeading').textContent=selected?'Similar needs. Different tools.':search?'Keep exploring.':
  ui.domain!=='all'?'Go deeper in this field.':'Explore a different direction.';
 $('challengeCaption').textContent='Catalog-supported comparisons · updated with your context and day.';
 const shortcuts=[...$('challengeLinks').querySelectorAll('.challenge-link')];
 shortcuts.forEach((button,index)=>{
  const data=topics[index];button.hidden=!data;
  if(!data)return;
  button.dataset.globalQuery=data.query;
  button.setAttribute('aria-label','Search challengers for '+data.name);
  button.querySelector('.challenge-link-icon').textContent=data.name.replace(/[^a-zA-Z0-9 ]/g,'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').slice(0,2).toUpperCase();
  button.querySelector('.challenge-copy strong').textContent=data.name;
  const count=window.ChallengerUX?.globalResults(data.query)?.length||0;
  const item=button.querySelector('[data-query-count]');
  item.dataset.queryCount=data.query;
  item.textContent=count+' catalog match'+(count===1?'':'es');
 });
}
function openDiscoveryProject(repo){
 if(!repo||!state.apps.some(a=>a.repo===repo))return;
 setFilter('all');
 selectApp(repo);
 const card=[...$('cards').querySelectorAll('.app-card')].find(x=>x.dataset.repo===repo);
 if(card)card.scrollIntoView({behavior:'instant',block:'nearest'});
}
function activateHeroFeature(){
 if(heroFeature.type==='updates'){
  $('bulkUpdateBar').scrollIntoView({block:'center',behavior:'instant'});
  return;
 }
 if(heroFeature.type==='selected'&&ui.selectedRepo){
  changeDetailTab('details');$('detailPanel').scrollIntoView({block:'nearest'});return;
 }
 openDiscoveryProject(heroFeature.repo);
}

function cardMarkup(a){
 const working=state.active?.repo===a.repo;
 const place=state.queue.indexOf(a.repo);
 const job=working?'active':place>=0?'queued':'';
 const jobStatus=working?{kind:'job-working',label:queueStage(state.active)}:place>=0?{kind:'job-waiting',label:'Queued · #'+(place+1)}:null;
 const s=jobStatus||statusOf(a),p=primaryAction(a),selected=ui.selectedRepo===a.repo;
 const version=a.installedVersion||a.latestVersion||'';
 const domain=domainOf(a);
 const versionText=version?'v'+version:(a.releaseTag||'Version not verified');
 const competition=competitorMarkup(a);
 const button='<button class="card-action '+(p.action==='install'?'primary':'')+
  '" data-action="'+p.action+'" data-repo="'+escapeHTML(a.repo)+'"'+(p.disabled?' disabled':'')+'>'+
  (p.action==='launch'?glyph('play'):p.action==='install'||p.action==='portable'?glyph('down'):'')+
  escapeHTML(p.verb)+'</button>';
 return '<article class="app-card'+(selected?' selected':'')+'" data-job="'+(job||'none')+'" data-repo="'+escapeHTML(a.repo)+
 '" tabindex="0" role="group" title="Click to view application details" aria-label="'+escapeHTML(a.title+(job?', '+s.label:''))+'">'+
 '<div class="card-head">'+productIcon(a)+'<div class="card-id"><h3>'+(window.ChallengerUX?.highlight(a.title)||escapeHTML(a.title))+'</h3>'+
 '<p>'+(window.ChallengerUX?.highlight(nativeAppName(a))||escapeHTML(nativeAppName(a)))+'</p></div>'+
 '</div>'+
 (competition?'<div class="card-competitors"><span class="card-field-label">Competes with</span>'+competition+'</div>':'')+
 '<div class="card-area"><span class="card-field-label">Category</span><span class="area-pill">'+escapeHTML(domainLabel(domain))+'</span></div>'+
 '<div class="card-maturity"><span class="card-field-label">Maturity</span>'+maturityMarkup(a)+'</div>'+
 '<div class="card-availability"><span class="card-field-label">Availability</span><span class="status-tag '+s.kind+'">'+escapeHTML(s.label)+'</span>'+
 '<small>'+escapeHTML(versionText)+'</small></div>'+
 '<div class="card-release"><span class="card-field-label">Latest release</span><strong title="'+escapeHTML(a.releaseTag||'No verified release')+'">'+escapeHTML(a.publishedAt?localDate(a.publishedAt):'Not verified')+'</strong></div>'+
 '<div class="card-bottom">'+button+'</div></article>';
}
function updateCategoryList(){
 const select=$('categorySelect'),values=[...new Set(state.apps.filter(a=>ui.domain==='all'||domainOf(a)===ui.domain).map(a=>a.group).filter(Boolean))].sort((a,b)=>catName(a).localeCompare(catName(b)));
 const current=ui.category;
 const signature=ui.language+'|'+ui.domain+'|'+values.join('|');
 if(signature===categorySignature)return;
 categorySignature=signature;
 select.replaceChildren();
 for(const [value,label] of [['all','All subcategories'],...values.map(v=>[v,catName(v)])]){
   const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);
 }
 if(values.includes(current))select.value=current;
 else{ui.category='all';select.value='all';}
}
function renderCards(force=false){
 if(!initialDataLoaded){
   $('resultSummary').textContent=t('loading');
   const skeleton='<div class="loading-skeleton"><div class="skeleton-row"><div class="skeleton-box"></div><div class="skeleton-info"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div><div class="skeleton-gap"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>';
   if(!cardSnapshot){$('cards').innerHTML=skeleton.repeat(6);cardSnapshot=skeleton.repeat(6)}
   $('cards').setAttribute('aria-busy','true');
   return;
 }
 const list=filteredApps();
 // Inspector selection is explicit, never the first search/filter result.
 if(ui.selectedRepo&&!list.some(a=>a.repo===ui.selectedRepo))resetInspector();
 document.body.classList.toggle('detail-empty',!list.length);
 const isUpdates=ui.filter==='updates',isNew=ui.filter==='new';
 const title=isUpdates?t('allCurrent'):isNew?t('newEmpty'):t('filterEmpty');
 const subtitle=isUpdates?t('allCurrentHint'):isNew?t('newEmptyHint'):t('filterEmptyHint');
 const empty='<div class="empty-list">'+glyph(isUpdates?'check':isNew?'spark':'search')+
   '<strong>'+escapeHTML(title)+'</strong><p>'+escapeHTML(subtitle)+'</p>'+
   '<div><button class="empty-reset" data-reset-filters="true">'+t('clearFilters')+'</button></div></div>';
 const html=list.length?list.map(cardMarkup).join(''):empty;
 $('resultSummary').textContent=t('showing')(list.length);
 window.ChallengerUX?.present(list.length);
 renderDiscoveryStage(list);
 renderWorkspaceOverview(list);
 renderBulkUpdateBar();
 $('cards').setAttribute('aria-busy','false');
 if(force||html!==cardSnapshot){cardSnapshot=html;$('cards').innerHTML=html;}
 $('cards').classList.toggle('list-view',ui.view==='list');
 document.body.classList.toggle('view-list',ui.view==='list');
 document.body.classList.toggle('view-grid',ui.view==='grid');
 $('catalogTableHead').hidden=ui.view!=='list'||!list.length;
 $('gridButton').classList.toggle('active',ui.view==='grid');$('listButton').classList.toggle('active',ui.view==='list');
 $('gridButton').setAttribute('aria-pressed',String(ui.view==='grid'));
 $('listButton').setAttribute('aria-pressed',String(ui.view==='list'));
 for(const btn of document.querySelectorAll('[data-filter]')){
   const active=btn.dataset.filter===ui.filter;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
 }
 for(const btn of document.querySelectorAll('[data-nav]')){
   const active=btn.dataset.nav===ui.filter;btn.classList.toggle('active',active);
   if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
 }
 $('sortSelect').value=ui.sort;
}
function updateCreators(){
 const select=$('creatorSelect');
 const names=[...new Set(state.apps.map(a=>a.creator||'Storytold'))].sort((a,b)=>a.localeCompare(b,'en'));
 const fingerprint=names.join('|');if(select.dataset.fingerprint===fingerprint)return;
 select.dataset.fingerprint=fingerprint;
 select.replaceChildren();
 for(const name of ['all',...names]){
   const o=document.createElement('option');o.value=name;o.textContent=name==='all'?'All creators':name;select.appendChild(o);
 }
 ui.creator=names.includes(ui.creator)?ui.creator:'all';select.value=ui.creator;
}
function render(force=false){
 renderCounters();renderQueue();
 updateCategoryList();updateCreators();renderDomains();
 renderCards(force);
 if(ui.selectedRepo)renderDetail(false,force);
}
function setFilter(filter){
 if(!['all','installed','updates','missing','new'].includes(filter))return;
 // Status quick scopes are catalog-wide navigation, so previous refinements
 // must not silently hide Installed, Updates, Discoveries or Not installed.
 window.ChallengerUX?.leaveSearch();
 resetInspector();
 ui.filter=filter;
 ui.domain='all';ui.category='all';ui.creator='all';
 ui.maturity='all';ui.availability='all';ui.platform='all';
 categorySignature='';updateCategoryList();
 for(const id of ['categorySelect','creatorSelect','maturitySelect','availabilitySelect','platformSelect']){
   const control=$(id);if(control)control.value='all';
 }
 window.ChallengerUX?.syncFacets();
 renderDomains();
 ui.mobileNav=false;document.body.classList.remove('mobile-nav-open');
 const pageTitles={all:'pageTitle',updates:'navUpdates',installed:'navInstalled',new:'navNew',missing:'filterMissing'};
 $('pageTitle').textContent=t(pageTitles[filter]||'pageTitle');
 cardSnapshot='';renderCards(true);
}
function setView(value){
 if(!['grid','list'].includes(value))return;
 ui.view=value;savePref('view',value);renderCards(true);
}
function setSort(value){
 if(!['name','release','activity','status'].includes(value))return;
 resetInspector();ui.sort=value;savePref('sort',value);cardSnapshot='';renderCards(true);
}
function resetInspector(){
 ui.selectedRepo=null;ui.notesExpanded=false;detailSnapshot='';
 document.body.classList.remove('detail-open','detail-collapsed');
 const panel=$('detailPanel');
 panel.removeAttribute('aria-modal');
 panel.setAttribute('aria-hidden','true');
 panel.setAttribute('role','region');
 panel.setAttribute('aria-label','Application details (closed)');
}
function selectApp(repo,openOnMobile=true){
 const app=state.apps.find(a=>a.repo===repo);
 if(!app)return;
 ui.selectedRepo=repo;ui.detailTab='changes';ui.notesExpanded=false;detailSnapshot='';
 const panel=$('detailPanel');
 document.body.classList.remove('detail-collapsed');
 document.body.classList.add('detail-open');
 panel.setAttribute('aria-hidden','false');
 panel.setAttribute('aria-label','Details for '+app.title);
 const overlay=(window.innerWidth<=1250||ui.view==='list')&&openOnMobile;
 panel.setAttribute('role',overlay?'dialog':'region');
 if(overlay)panel.setAttribute('aria-modal','true');else panel.removeAttribute('aria-modal');
 renderCards(true);renderDetail(true,true);
 $('closeDetail').focus({preventScroll:true});
}
function closeDetail(restoreFocus=true){
 const repo=ui.selectedRepo;
 const wasOpen=document.body.classList.contains('detail-open')||!!repo;
 resetInspector();
 if(!wasOpen)return;
 if(initialDataLoaded){cardSnapshot='';renderCards(true);}
 if(restoreFocus&&repo){
   const card=[...$('cards').querySelectorAll('.app-card')].find(node=>node.dataset.repo===repo);
   if(card)card.focus({preventScroll:true});
 }
}
function getSelected(){return state.apps.find(a=>a.repo===ui.selectedRepo)||null}
function detailField(label,value){
 if(value===undefined||value===null||value==='')value='—';
 return '<div class="detail-field"><span>'+escapeHTML(label)+'</span><strong>'+escapeHTML(value)+'</strong></div>';
}
function renderDetail(force=false,forceContent=false){
 const a=getSelected();if(!a)return;
 const s=statusOf(a),p=primaryAction(a);
 const fingerprint=[a.repo,a.installedVersion,a.latestVersion,a.needsUpdate,a.pushedAt,a.assetBytes,a.stars,
   a.verifiedAt,a.reportedMaturity,a.developmentStage,a.bleedingEdge,a.downloadablePortable,a.portableAsset,a.caveats,ui.detailTab,ui.language,state.active?.repo,state.queue.includes(a.repo)].join('|');
 if(!force&&fingerprint===detailSnapshot)return;
 detailSnapshot=fingerprint;
 $('detailIcon').innerHTML=productIcon(a,'detail-app-icon-child');
 const img=$('detailIcon').querySelector('img');
 if(img)img.addEventListener('error',()=>{img.hidden=true},{once:true});
 $('detailName').textContent=a.title;
 $('detailDescription').textContent=nativeAppName(a);
 $('detailMaturity').innerHTML=maturityMarkup(a);
 $('detailStatus').textContent=s.label;
 $('detailStatus').className='detail-status'+(a.discovery?' discovery':s.kind==='update'?' warning':'');
 $('detailActionText').textContent=p.verb;
 $('detailAction').disabled=p.disabled;
 $('detailAction').dataset.action=p.action;
 $('detailAction').dataset.repo=a.repo;
 $('detailAction').querySelector('svg use').setAttribute('href','#i-'+(p.action==='install'?'down':'play'));
 $('detailPortableRow').hidden=!a.downloadablePortable;
 $('detailPortable').disabled=!a.downloadablePortable||!!state.active;
 $('detailPortable').dataset.repo=a.repo;
 $('detailPortableNote').textContent=a.portableAsset?'SHA-256 checked · '+byteSize(a.portableBytes)+' · '+a.portableAsset:'Manual extraction';
 $('detailPortable').title=a.portableHint||'Download '+(a.portableAsset||'package')+' (SHA-256 verified; never auto-installed)';
 $('detailGithub').dataset.repo=a.repo;
 $('detailReleaseLink').dataset.repo=a.repo;
 $('detailReleaseLink').disabled=!!(a.discovery&&!a.releaseTag);
 $('detailReleaseLink').hidden=!!(a.discovery&&!a.releaseTag);
 document.querySelector('[data-detail-tab="changes"]').textContent=a.discovery?(a.releaseTag?"What's new":'Research notes'):t('detailWhatsNew');
 document.querySelector('[data-detail-tab="releases"]').textContent=a.discovery?'Release status':t('detailReleases');
 $('detailSourceText').textContent=(a.creator||'Source')+' · GitHub';
 for(const tab of document.querySelectorAll('[data-detail-tab]')){
   const isActive=tab.dataset.detailTab===ui.detailTab;
   tab.classList.toggle('active',isActive);tab.setAttribute('aria-selected',String(isActive));
 }
 if(ui.detailTab==='details')renderDetailsTab(a);
 if(ui.detailTab==='changes')renderNotesTab(a);
 if(ui.detailTab==='releases')renderReleasesTab(a);
}
function notesInline(text){
 // Escape ALL remote Markdown before adding our limited inline formatting.
 return escapeHTML(text)
   .replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>')
   .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
   .replace(/__([^_]+)__/g,'<strong>$1</strong>')
   .replace(/(^|[\s(])\*([^*\n]+)\*/g,'$1<em>$2</em>');
}
function notesMarkup(text){
 const source=String(text||'').slice(0,44500);
 if(!source.trim())return '<p>'+escapeHTML(t('noChangelog'))+'</p>';
 const fullLines=source.split(/\r?\n/);
 const limit=ui.notesExpanded?Math.min(fullLines.length,700):Math.min(fullLines.length,54);
 const lines=fullLines.slice(0,limit);
 const sections=[];let bullets=[],code=[],inCode=false;
 const closeBullets=()=>{if(bullets.length){sections.push('<ul>'+bullets.map(x=>'<li>'+notesInline(x)+'</li>').join('')+'</ul>');bullets=[]}};
 const closeCode=()=>{if(code.length){sections.push('<pre>'+escapeHTML(code.join('\n'))+'</pre>');code=[]}};
 for(const raw of lines){
   const line=raw.trim();
   if(line.startsWith('\x60\x60\x60')){closeBullets();if(inCode)closeCode();inCode=!inCode;continue}
   if(inCode){code.push(raw);continue}
   if(!line){closeBullets();continue}
   if(/^#{1,5}\s/.test(line)){closeBullets();sections.push('<h4>'+notesInline(line.replace(/^#{1,5}\s+/,''))+'</h4>');continue}
   if(/^[-*+]\s+/.test(line)){bullets.push(line.slice(2).replace(/^\[[ x]\]\s*/i,''));continue}
   if(/^\d{1,3}\.\s/.test(line)){bullets.push(line.replace(/^\d{1,3}\.\s+/,''));continue}
   if(/^---+$/.test(line)){closeBullets();sections.push('<hr>');continue}
   closeBullets();sections.push('<p>'+notesInline(line)+'</p>');
 }
 closeBullets();closeCode();
 const expandable=fullLines.length>54;
 const button=expandable?'<button class="notes-more" data-expand-notes="true" aria-expanded="'+
     String(ui.notesExpanded)+'">'+escapeHTML(t(ui.notesExpanded?'collapseNotes':'expandNotes'))+'</button>':'';
 return (sections.join('')||'<p>'+escapeHTML(t('noChangelog'))+'</p>')+button;
}
async function renderNotesTab(a){
 const content=$('detailBody');
 if(a.discovery){
   content.innerHTML='<div class="detail-release-head"><strong>'+(a.researchPendingVerification?'Research candidate · pending verification':'Project overview')+'</strong><span class="release-latest">Public repository</span></div>'+
     '<div class="notes-content research-notes"><h4>What the project is building</h4><p>'+escapeHTML(a.summary||a.description||'No summary available')+'</p>'+
     '<h4>Competes with</h4><p>'+escapeHTML((a.challenges||[]).join(', ')||'Unspecified')+'</p>'+
     '<h4>Development and scope</h4><p>'+escapeHTML([a.replacementType,a.reportedMaturity].filter(Boolean).join(' · '))+'</p>'+
     '<h4>Known limitations</h4><p>'+escapeHTML(publicCaveats(a.caveats))+'</p>'+
     '<p class="research-note-foot">'+(a.researchPendingVerification?'Imported research claim, not independently verified. Review current licensing, source activity and platform compatibility before use.':'Public project information is summarized here; please confirm platform compatibility and feature completeness before deploying.')+'</p>'+
     (a.releaseTag?'<div class="research-official-release"><h4>Latest published release · '+escapeHTML(a.releaseTag)+'</h4>'+
       '<small>GitHub snapshot checked '+escapeHTML(localDate(a.releaseCheckedAt,true))+'</small>'+notesMarkup(a.releaseBody||'No changelog text provided for this release.')+'</div>':
       '<p class="research-note-foot">No official release feed is connected yet.</p>')+'</div>';
   return;
 }
 const key=a.repo+'|'+(a.releaseTag||'');
 const cached=notesCache.get(key);
 const html='<div class="detail-release-head"><strong>'+escapeHTML(a.releaseTag||t('noVersion'))+'</strong>'+
   '<span class="release-latest">'+t('releaseOfficial')+'</span></div>'+
   '<div class="notes-content">'+(cached?notesMarkup(cached.body):'<p class="notes-loading">'+t('loadingChangelog')+'</p>')+'</div>';
 content.innerHTML=html;
 if(!a.releaseTag){content.querySelector('.notes-content').innerHTML='<p>'+t('noReleases')+'</p>';return}
 if(cached)return;
 try{
   const note=await api('GET','/api/release-notes?repo='+encodeURIComponent(a.repo));
   if(!note.error||note.body)notesCache.set(key,note);
   if(ui.selectedRepo===a.repo&&ui.detailTab==='changes'){
     content.querySelector('.notes-content').innerHTML=note.error&&!note.body?
        '<p>'+escapeHTML(t('loadFailed'))+'</p>':notesMarkup(note.body);
   }
 }catch(e){
   if(ui.selectedRepo===a.repo&&ui.detailTab==='changes')content.querySelector('.notes-content').innerHTML='<p>'+escapeHTML(t('loadFailed'))+'</p>';
 }
}
async function openWhatsNewDialog(){
 const a=getSelected();if(!a)return;
 $('whatsNewTitle').textContent='What’s new · '+a.title;
 $('whatsNewSubtitle').textContent=a.releaseTag?'Release '+a.releaseTag:'Repository tracking / research notes';
 $('whatsNewBody').innerHTML='<p>Loading release notes…</p>';
 openDialog('whatsNewDialog');
 if(a.discovery&&!a.releaseTag){$('whatsNewBody').innerHTML='<p>No verified release notes are available. This is a tracked source repository, not a published install package.</p>';return;}
 try{const note=a.discovery?{body:a.releaseBody||''}:await api('GET','/api/release-notes?repo='+encodeURIComponent(a.repo));
  if($('whatsNewDialog').open)$('whatsNewBody').innerHTML=notesMarkup(note.body||a.releaseBody||'No official release notes were published.');
 }catch(e){if($('whatsNewDialog').open)$('whatsNewBody').textContent='Could not retrieve official release notes. Try the repository release link.';}
}
function sameNeed(a){
 const key=x=>[x.company||'',x.product||''].join('::').toLowerCase().replace(/[^a-z0-9:]/g,'');
 const targets=new Set(competitorTargets(a).map(key).filter(Boolean));
 const area=String(a.group||'').toLowerCase().replace(/[^a-z]/g,'');
 const rows=state.apps.filter(b=>b.repo!==a.repo).map(b=>{
  const common=competitorTargets(b).filter(x=>targets.has(key(x))).map(x=>[x.company,x.product].filter(Boolean).join(' → '));
  const sameArea=!!(area&&String(b.group||'').toLowerCase().replace(/[^a-z]/g,'')===area);
  return {app:b,common,sameArea,weight:common.length*100+(sameArea?8:0)};
 }).filter(x=>x.weight>0).sort((x,y)=>y.weight-x.weight||x.app.title.localeCompare(y.app.title,'en'));
 return {direct:rows.filter(x=>x.common.length).slice(0,5),related:rows.filter(x=>!x.common.length).slice(0,3)};
}
function similarMarkup(app){
 const matches=sameNeed(app);
 const render=(row,label)=>{
  const b=row.app,common=row.common;
  const sub=common.length?'Also challenges '+common.join(', '):'Related '+(b.group||'category')+' workflow';
  return '<button class="similar-app" data-related-repo="'+escapeHTML(b.repo)+'" aria-label="View '+escapeHTML(b.title)+'">'+
   '<span class="similar-app-info"><strong>'+escapeHTML(b.title)+'</strong><small>'+escapeHTML(sub)+'</small></span>'+
   '<span class="similar-right">'+maturityMarkup(b)+'<span aria-hidden="true">→</span></span></button>';
 };
 let html='<section class="similar-section"><div class="similar-heading"><h4>Other tools for the same need</h4><span>'+matches.direct.length+' direct matches</span></div>';
 if(matches.direct.length)html+=matches.direct.map(x=>render(x)).join('');
 else html+='<p class="similar-empty">No other direct alternative is listed for the same commercial tool yet.</p>';
 if(matches.related.length)html+='<div class="similar-subtitle">Related workflows</div>'+matches.related.map(x=>render(x)).join('');
 return html+'</section>';
}

function publicCaveats(value){
 return String(value||'No specific limitations documented.')
   .replace(/research reports/gi,'available sources')
   .replace(/research claim/gi,'reported status')
   .replace(/needs hands-on verification/gi,'has not been independently tested')
   .replace(/research classification/gi,'reported classification');
}
function upstreamSummary(a){
 const s=a.sourceSignal;
 if(!s)return 'Waiting for first source check';
 const type=s.signalType==='release'?'Published release signal':s.signalType==='tag'?'Source tag — not a verified release':'No published release detected';
 return [s.sourceLabel||s.sourceHost||'Official source',type,s.checkedAt?localDate(s.checkedAt,true):'Not yet checked'].filter(Boolean).join(' · ');
}
function renderDetailsTab(a){
 if(a.discovery){
   const items=[
     ['Research status',a.researchPendingVerification?'Candidate · pending verification':'Repository reviewed'],
     ['Creator',a.creator],['Repository',a.repository],['Category',domainLabel(domainOf(a))],
     ['Subcategory',a.group],['Deployment model',a.deploymentType||'Desktop application'],
     ['Competing companies',[...new Set(competitorTargets(a).map(x=>x.company).filter(Boolean))].join(', ')],
     ['Competing products',competitorTargets(a).map(x=>x.product).join(', ')],
     ['Development stage',stageOf(a).label],
     ['Platforms (reported)',(a.reportedPlatforms||[]).join(', ')||'Not verified'],
     ['Last repository activity',localDate(a.pushedAt)],['License',a.license||'Not verified'],
     ['GitHub stars (last known)',Number.isFinite(a.stars)?a.stars.toLocaleString('en-US'):'Not checked'],
     ['Known limitations',publicCaveats(a.caveats)],
     ['Latest verified release',a.releaseTag||'Not verified'],
     ['Source status',upstreamSummary(a)],
     ['Latest upstream signal',a.sourceSignal?.signalTag?(a.sourceSignal.signalTag+(a.sourceSignal.verificationPending?' · package verification pending':a.sourceSignal.unverified?' · tag only':' · informational')):'Not available'],
     ['Installation',a.researchPendingVerification?'Research only — no installation approved':a.installable?'Verified package available after confirmation':a.deploymentType?'Manual '+a.deploymentType+'; no one-click installer approved':'No approved installer']
   ];
      $('detailBody').innerHTML=items.filter(([label,value])=>label!=='Competing companies'||!!value).map(x=>detailField(...x)).join('')+similarMarkup(a);
   return;
 }
 const items=[
  ['Creator',a.creator||'Storytold'],['Domain',domainLabel(domainOf(a))],
  ['Competing companies',[...new Set(competitorTargets(a).map(x=>x.company).filter(Boolean))].join(', ')],
  ['Competing products',competitorTargets(a).map(x=>x.product).join(', ')],
  ['Availability',a.discovery?'Discovery / tracking only':'Managed app'],
  [t('appVersion'),a.installedVersion],
  [t('latest'),a.latestVersion],
  [t('repository'),a.repository||'storytold/'+a.repo],
  ['Source status',upstreamSummary(a)],
  ['Latest upstream signal',a.sourceSignal?.signalTag?(a.sourceSignal.signalTag+(a.sourceSignal.verificationPending?' · verification pending':a.sourceSignal.unverified?' · tag only':'')):'Not available'],
  [t('appGroup'),catName(a.group)],
  [t('platform'),state.platform==='win32'?'Windows x64':'macOS'],
  [t('released'),localDate(a.publishedAt)],
  [t('pushed'),localDate(a.pushedAt)],
  [t('size'),byteSize(a.assetBytes)],
  [t('license'),a.license],
  [t('stars'),Number.isFinite(a.stars)?a.stars.toLocaleString():null],
  [t('issues'),Number.isFinite(a.issues)?a.issues.toLocaleString():null],
  [t('installPath'),a.installedPath]
 ];
 $('detailBody').innerHTML=items.filter(([label,value])=>label!=='Competing companies'||!!value).map(x=>detailField(...x)).join('')+similarMarkup(a);
}
async function renderReleasesTab(a){
 const content=$('detailBody'),key=a.repo;
 if(a.discovery){
   if(a.releaseTag){
     content.innerHTML='<div class="research-release-state"><strong>Official GitHub release</strong><p>'+escapeHTML(a.releaseStatus==='new-release-unverified'?'New tag detected; its package digest still needs verification.':'SHA-256-verified package'+(a.installable?' available on this device.':' not available for automatic installation on this device.'))+'</p></div>'+
       '<div class="release-row"><div><strong>'+escapeHTML(a.releaseTag)+'</strong><small class="release-date">'+escapeHTML(localDate(a.publishedAt,true))+'</small></div>'+
       '<button class="release-link" data-release-url="'+escapeHTML(a.releaseUrl||a.repoUrl+'/releases')+'" aria-label="Open official release">'+glyph('external')+'</button></div>';
   }else{
    const signal=a.sourceSignal;
    const pending=signal?.signalTag?'<div class="release-row"><div><strong>'+escapeHTML(signal.signalTag)+'</strong><small class="release-date">'+escapeHTML(signal.signalType==='tag'?'Unverified source tag':'Published source signal (package unverified)')+'</small></div></div>':'';
    content.innerHTML='<div class="research-release-state"><strong>No package-verified release connected</strong><p>An upstream signal does not authorize a download or an automatic installation.</p></div>'+pending;
   }
   return;
 }
 const draw=data=>{
   if(!data.releases?.length){content.innerHTML='<p class="notes-loading">'+t('noReleases')+'</p>';return}
   content.innerHTML=(data.stale?'<p class="notes-loading">'+t('releaseHistoryFailed')+'</p>':'')+
    data.releases.map((v,i)=>'<div class="release-row"><div><strong>'+escapeHTML(v.tag)+'</strong>'+
     '<small class="release-date">'+escapeHTML(localDate(v.publishedAt))+'</small></div>'+
     (i===0?'<span class="release-latest">'+t('latestLabel')+'</span>':'')+
     '<button class="release-link" data-release-url="'+escapeHTML(v.url)+'" aria-label="'+escapeHTML(t('more'))+'">'+glyph('external')+'</button></div>').join('');
 };
 const cachedHistory=historyCache.get(key);
 if(cachedHistory&&(!cachedHistory.data.stale||Date.now()-cachedHistory.checkedAt<15*60*1000)){
   draw(cachedHistory.data);return;
 }
 content.innerHTML='<p class="notes-loading">'+t('loadingReleases')+'</p>';
 try{
   const history=await api('GET','/api/releases?repo='+encodeURIComponent(a.repo));
   historyCache.set(key,{data:history,checkedAt:Date.now()});
   if(ui.selectedRepo===a.repo&&ui.detailTab==='releases')draw(history);
 }catch(e){
   if(ui.selectedRepo===a.repo&&ui.detailTab==='releases')draw({
     stale:true,releases:a.releaseTag?[{tag:a.releaseTag,publishedAt:a.publishedAt,url:a.releaseUrl||a.repoUrl+'/releases'}]:[]
   });
 }
}
function changeDetailTab(name){
 if(!['changes','details','releases'].includes(name))return;
 ui.detailTab=name;detailSnapshot='';renderDetail(true,true);
}
function openDialog(id){
 const el=$(id);if(!el)return;
 if(!el.open)el.showModal();
}
function closeDialog(id){const el=$(id);if(el?.open)el.close()}
function confirmAction(message){
 $('confirmMessage').textContent=message;
 return new Promise(resolve=>{
   if($('confirmDialog').open)$('confirmDialog').close();
   confirmResolve=resolve;openDialog('confirmDialog');$('confirmAccept').focus();
 });
}
function resolveConfirm(yes){
 if(!confirmResolve)return;
 const resolve=confirmResolve;confirmResolve=null;closeDialog('confirmDialog');resolve(yes);
}
function showSetupGuide(a){
 if(!a)return;
 const dialog=$('setupGuideDialog');
 $('setupGuideTitle').textContent='Manual setup · '+a.title;
 const mode=String(a.deploymentType||'').trim();
 $('setupGuideType').textContent=mode||'Installation type not independently confirmed';
 $('setupGuideStatus').textContent=a.researchPendingVerification?'Research candidate · setup and compatibility not verified':
   a.installable?'Verified installer available separately':'No approved one-click installer';
 $('setupGuidePlatform').textContent=(a.reportedPlatforms||[]).length?
   (a.reportedPlatforms||[]).join(', '):'Platform compatibility has not been independently verified';
 $('setupGuideCaveats').textContent=publicCaveats(a.caveats)||'Check project requirements and compatibility in upstream documentation.';
 $('setupGuideSource').textContent='github.com/'+a.repository;
 $('setupGuideOpenSource').disabled=!safeGitHubUrl(a.repoUrl);
 $('setupGuideOpenSource').dataset.url=safeGitHubUrl(a.repoUrl)||'';
 $('setupGuideSteps').replaceChildren();
 const steps=[
   'Open the official project repository and find its README or installation documentation.',
   'Confirm the current installation instructions, dependencies and operating-system support directly with the developer.',
   'Review release status, licensing and security before choosing a manual deployment method.',
   'Follow the project’s current upstream instructions. Challenger Hub will not download, install or execute anything for this project.'
 ];
 for(const step of steps){const li=document.createElement('li');li.textContent=step;$('setupGuideSteps').appendChild(li)}
 openDialog('setupGuideDialog');
}
async function doAppAction(a,action){
 if(!a)return;
 if(action==='launch'){
   if(state.platform==='win32'){
     const native=window.chrome?.webview;
     if(native?.postMessage){native.postMessage({type:'launch',repo:a.repo});return}
     showToast(ui.language==='he'?'לפתיחת תוכנות, השתמש באפליקציית Craft Update Center המותקנת.':'To open apps, use the installed Craft Update Center desktop window.',true);
     return;
   }
   try{await api('POST','/api/launch',{repo:a.repo});showToast(t('openQueued'))}
   catch(e){showToast(t('openFailed')+' '+e.message,true)}
   return;
 }
 if(action!=='install')return;
 const verb=a.needsUpdate?t('update'):t('install');
 if(!await confirmAction(t('confirmApp')(verb,a.title)))return;
 try{
   const data=await api('POST','/api/install',{repo:a.repo});
   showToast(t('addedQueue')(data.queued?.length||0));
   await poll();
 }catch(e){showToast(e.message,true)}
}
async function doPortableDownload(a){
 if(!a||!a.downloadablePortable)return;
 if(!await confirmAction('Download SHA-256 verified portable package for '+a.title+'? The archive will be saved to this computer without installation, extraction, or execution.'))return;
 try{
   const result=await api('POST','/api/download-portable',{repo:a.repo});
   showToast('Portable download started: '+result.asset);
   await poll();
 }catch(e){showToast('Portable download failed: '+e.message,true)}
}
async function doBulkUpdate(){
 const candidates=state.apps.filter(a=>a.needsUpdate&&a.installable);
 if(!candidates.length){showToast('No approved updates are available to queue.');return}
 if(state.active||(state.queue?.length||0)){showToast('Wait for the current update or installation to finish.',true);return}
 if(state.platform==='win32'&&!state.admin){showToast(t('requiresAdmin'),true);return}
 const names=candidates.slice(0,7).map(a=>'• '+a.title).join('\n');
 const extra=candidates.length>7?'\n… and '+(candidates.length-7)+' more':'';
 const message=t('confirmBulk')(candidates.length)+'\n\n'+names+extra+'\n\nOnly approved, hash-verified packages can be installed. No research-only project is included.';
 if(!await confirmAction(message))return;
 try{const data=await api('POST','/api/update-all');showToast(t('addedQueue')(data.queued?.length||0));await poll()}
 catch(e){showToast(e.message,true)}
}
async function doScan(){
 try{await api('POST','/api/scan');showToast(t('scanningStarted'));await poll()}
 catch(e){showToast(e.message,true)}
}
async function doVerify(){
 try{await api('POST','/api/verify');showToast(t('verified'));await poll()}
 catch(e){showToast(e.message,true)}
}
function renderActivity(){
 const rows=(state.history||[]).slice(-60).reverse();
 const content=$('activityContent');
 if(!rows.length){content.innerHTML='<p>'+t('emptyActivity')+'</p>';return}
 content.innerHTML=rows.map(e=>{
   let message=e.message;
   if(ui.language==='en'){
     if(e.kind==='scan')message='Scanning public Storytold repositories';
     else if(e.kind==='success'&&/נמצאו/.test(message))message='Repository scan completed';
     else if(e.kind==='queue')message='Install / update jobs added to queue';
     else if(e.kind==='install')message='Starting verified installation';
     else if(e.kind==='launch')message='Application opened';
     else if(/עודכן בהצלחה/.test(message))message='Installation completed successfully';
   }
   return '<div class="activity-entry '+(e.kind==='error'?'error':'')+'">'+
     escapeHTML((e.repo?e.repo+' · ':'')+message)+'<span>'+localTime(e.time)+'</span></div>';
 }).join('');
}
async function poll(){
 if(workingPoll)return;
 workingPoll=true;
 try{
   const data=await api('GET','/api/state');
   data.apps=[...data.apps,...(Array.isArray(data.discoveries)?data.discoveries:[])];
   state=data;initialDataLoaded=true;
   if(ui.selectedRepo&&!state.apps.some(a=>a.repo===ui.selectedRepo))resetInspector();
   render();if($('activityDialog').open)renderActivity();
 }catch(e){
   $('onlineDot').classList.remove('connected');$('footerDot').classList.remove('connected');
   $('notice').className='notice error';$('noticeMessage').textContent=t('notConnected')+' · '+e.message;
   $('noticeDismiss').hidden=true;
 }finally{workingPoll=false}
}
function wireEvents(){
 for(const stat of document.querySelectorAll('[data-stat-filter]'))stat.addEventListener('click',()=>setFilter(stat.dataset.statFilter));
 if(window.chrome?.webview?.addEventListener){
   window.chrome.webview.addEventListener('message',event=>{
     const response=event.data;
     if(response?.type==='launch-result')showToast(response.ok?t('openQueued'):
       t('openFailed')+' '+String(response.error||''),!response.ok);
   });
 }
 for(const button of document.querySelectorAll('[data-nav]'))button.addEventListener('click',()=>setFilter(button.dataset.nav));
 $('filterChips').addEventListener('click',event=>{
   const chip=event.target.closest('button[data-filter]');
   if(chip&&event.currentTarget.contains(chip))setFilter(chip.dataset.filter);
 });
 $('sidebarScan').addEventListener('click',doScan);
 $('verifyButton').addEventListener('click',doVerify);
 $('updateAllButton').addEventListener('click',doBulkUpdate);
 $('sortSelect').addEventListener('change',e=>setSort(e.target.value));
 $('gridButton').addEventListener('click',()=>{resetInspector();setView('grid')});
 $('listButton').addEventListener('click',()=>{resetInspector();setView('list')});
 $('categorySelect').addEventListener('change',e=>{resetInspector();window.ChallengerUX?.leaveSearch();ui.category=e.target.value;cardSnapshot='';renderCards(true)});
 for(const [id,field] of [['maturitySelect','maturity'],['availabilitySelect','availability'],['platformSelect','platform']]) $(id).addEventListener('change',e=>{resetInspector();window.ChallengerUX?.leaveSearch();ui[field]=e.target.value;cardSnapshot='';renderCards(true)});
 $('domainFilters').addEventListener('click',e=>{const b=e.target.closest('[data-domain]'); if(!b)return;resetInspector();window.ChallengerUX?.leaveSearch();ui.domain=b.dataset.domain;ui.category='all';categorySignature='';updateCategoryList();cardSnapshot='';renderDomains();renderCards(true);});
 $('creatorSelect').addEventListener('change',e=>{resetInspector();window.ChallengerUX?.leaveSearch();ui.creator=e.target.value;cardSnapshot='';renderCards(true)});
 $('searchInput').addEventListener('input',e=>{resetInspector();if(window.ChallengerUX)window.ChallengerUX.setSearch(e.target.value);else{ui.search=e.target.value;cardSnapshot='';renderCards(true)}});
 for(const btn of document.querySelectorAll('[data-theme-choice]'))btn.addEventListener('click',()=>setTheme(btn.dataset.themeChoice));
 osTheme.addEventListener('change',()=>{if(ui.theme==='system')applyTheme()});
 $('settingsButton').addEventListener('click',()=>{
   ui.mobileNav=false;document.body.classList.remove('mobile-nav-open');
   const prefs=state.sourceStatus?.preferences||{autoCheck:true,intervalHours:12};
   $('prefsAutoCheck').checked=prefs.autoCheck!==false;
   $('prefsInterval').value=String(prefs.intervalHours||12);
   $('prefsEarly').checked=ui.showExperimental;
   $('prefsSourceState').textContent='Last project feed check: '+localTime(state.sourceStatus?.lastSyncAt)+' · Installation always requires confirmation.';
   openDialog('prefsDialog');
 });
 async function persistSourcePreferences(){
   try{
     const next={autoCheck:$('prefsAutoCheck').checked,intervalHours:Number($('prefsInterval').value)};
     const result=await api('POST','/api/preferences',next);
     state.sourceStatus={...state.sourceStatus,preferences:result.preferences};
     showToast('Release-check preferences saved');
   }catch(e){showToast('Could not save release-check settings: '+e.message,true)}
 }
 $('prefsAutoCheck').addEventListener('change',persistSourcePreferences);
 $('prefsInterval').addEventListener('change',persistSourcePreferences);
 $('prefsEarly').addEventListener('change',e=>{ui.showExperimental=e.target.checked;savePref('showExperimental',String(ui.showExperimental));cardSnapshot='';renderCards(true)});
 $('aboutButton').addEventListener('click',()=>{
   ui.mobileNav=false;document.body.classList.remove('mobile-nav-open');openDialog('aboutDialog')
 });
 $('activityButton').addEventListener('click',()=>{renderActivity();openDialog('activityDialog')});
 const openQueue=()=>{renderQueueDialog();openDialog('queueDialog')};
 $('queueViewButton').addEventListener('click',openQueue);
 $('queueToolbarButton').addEventListener('click',openQueue);
 $('queueNavButton').addEventListener('click',()=>{ui.mobileNav=false;document.body.classList.remove('mobile-nav-open');openQueue()});
 $('noticeDismiss').addEventListener('click',()=>{if(activeNoticeKey){savePref('noticeDismissedKey',activeNoticeKey);renderCounters()}});
 $('queueDockDismiss').addEventListener('click',()=>{const key=$('workQueue').dataset.errorKey;if(key){savePref('queueDismissedFailure',key);renderQueue()}});
 $('queueDockOpen').addEventListener('click',openQueue);
 for(const button of document.querySelectorAll('[data-dialog-close]'))button.addEventListener('click',()=>closeDialog(button.dataset.dialogClose));
 $('confirmCancel').addEventListener('click',()=>resolveConfirm(false));
 $('confirmAccept').addEventListener('click',()=>resolveConfirm(true));
 $('confirmDialog').addEventListener('close',()=>{
   if(confirmResolve){const resolve=confirmResolve;confirmResolve=null;resolve(false)}
 });
 $('setupGuideOpenSource').addEventListener('click',()=>openGithub($('setupGuideOpenSource').dataset.url));
 for(const name of ['prefsDialog','aboutDialog','activityDialog','whatsNewDialog','setupGuideDialog','queueDialog']){
   $(name).addEventListener('click',e=>{if(e.target===$(name))closeDialog(name)});
 }
 $('cards').addEventListener('click',e=>{
   const reset=e.target.closest('[data-reset-filters]');
   if(reset){window.ChallengerUX?.resetView();$('searchInput').focus();return;}
   const button=e.target.closest('[data-action]');
   if(button){
     e.stopPropagation();
     if(button.disabled)return;
     const app=state.apps.find(a=>a.repo===button.dataset.repo);
     if(button.dataset.action==='details')selectApp(app?.repo);
     else if(button.dataset.action==='guide')showSetupGuide(app);
     else if(button.dataset.action==='portable')doPortableDownload(app);
     else doAppAction(app,button.dataset.action);
     return;
   }
   const card=e.target.closest('.app-card');
   if(card)selectApp(card.dataset.repo);
 });
 $('heroContextAction').addEventListener('click',activateHeroFeature);
 $('dailyPickOpen').addEventListener('click',()=>openDiscoveryProject($('dailyPickOpen').dataset.repo));
 $('dailyPickWhy').addEventListener('click',()=>{const info=$('dailyPickReason');info.hidden=!info.hidden;$('dailyPickWhy').setAttribute('aria-expanded',String(!info.hidden));});
 $('cards').addEventListener('keydown',e=>{
   const card=e.target.closest('.app-card');
   if(!card||e.target!==card)return;
   if(e.key==='Enter'||e.key===' '){e.preventDefault();selectApp(card.dataset.repo);return;}
   if(e.key==='ArrowDown'||e.key==='ArrowRight'||e.key==='ArrowUp'||e.key==='ArrowLeft'){
     const cards=[...$('cards').querySelectorAll('.app-card')];const index=cards.indexOf(card);
     const next=index+((e.key==='ArrowDown'||e.key==='ArrowRight')?1:-1);
     if(cards[next]){e.preventDefault();cards[next].focus();}
   }
 });
 $('openWhatsNew').addEventListener('click',openWhatsNewDialog);
 $('cards').addEventListener('error',e=>{
   if(e.target.tagName==='IMG'&&e.target.closest('.app-icon'))e.target.hidden=true;
 },true);
 $('detailAction').addEventListener('click',()=>{
   const app=getSelected();const p=primaryAction(app);if(p.disabled)return;
   if(p.action==='details')changeDetailTab('details');else if(p.action==='guide')showSetupGuide(app);else if(p.action==='portable')doPortableDownload(app);
   else doAppAction(app,p.action);
 });
 $('detailPortable').addEventListener('click',()=>doPortableDownload(getSelected()));
 $('detailGithub').addEventListener('click',()=>{
   const app=getSelected();if(app)openGithub(app.repoUrl)
 });
 $('detailReleaseLink').addEventListener('click',()=>{
   const app=getSelected();if(app)openGithub(app.releaseUrl||app.repoUrl+'/releases')
 });
 for(const tab of document.querySelectorAll('[data-detail-tab]'))tab.addEventListener('click',()=>changeDetailTab(tab.dataset.detailTab));
 $('detailBody').addEventListener('click',e=>{
   const related=e.target.closest('[data-related-repo]');
   if(related){
     const repo=related.dataset.relatedRepo;
     window.ChallengerUX?.leaveSearch();
     ui.search='';ui.category='all';ui.creator='all';ui.filter='all';ui.domain='all';ui.maturity='all';ui.availability='all';ui.platform='all';for(const id of ['maturitySelect','availabilitySelect','platformSelect'])$(id).value='all';renderDomains();
     $('searchInput').value='';$('categorySelect').value='all';$('creatorSelect').value='all';
     selectApp(repo);changeDetailTab('details');return;
   }
   const expand=e.target.closest('[data-expand-notes]');
   if(expand){ui.notesExpanded=!ui.notesExpanded;const a=getSelected();if(a)renderNotesTab(a);
     $('detailBody').querySelector('[data-expand-notes]')?.focus();return;}
   const btn=e.target.closest('[data-release-url]');if(btn)openGithub(btn.dataset.releaseUrl);
 });
 $('closeDetail').addEventListener('click',closeDetail);
 $('detailScrim').addEventListener('click',closeDetail);
 $('mobileMenu').addEventListener('click',()=>document.body.classList.add('mobile-nav-open'));
 $('mobileClose').addEventListener('click',()=>document.body.classList.remove('mobile-nav-open'));
 $('sidebarScrim').addEventListener('click',()=>document.body.classList.remove('mobile-nav-open'));
 document.addEventListener('keydown',e=>{
   const mod=(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k';
   if(mod){e.preventDefault();$('searchInput').focus();$('searchInput').select();return}
   if(e.key==='Escape'){
     if(document.activeElement===$('searchInput')&&$('searchInput').value){
       if(window.ChallengerUX)window.ChallengerUX.setSearch('');else{$('searchInput').value='';ui.search='';renderCards(true)}return;}
     closeDetail();document.body.classList.remove('mobile-nav-open');
   }
 });
}
function start(){
 $('sortSelect').value=ui.sort;
 document.documentElement.lang='en';document.documentElement.dir='ltr';
 wireEvents();initializeWorkspaceNavigation();resetInspector();window.ChallengerUX?.initialize();applyLanguage();setView(ui.view);poll();
 setInterval(poll,6500);
}
document.addEventListener('DOMContentLoaded',start);
