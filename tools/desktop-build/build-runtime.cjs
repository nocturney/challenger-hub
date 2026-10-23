'use strict';
/* Reproducible isolated Focus Desktop live runtime.
 * Wraps the EXISTING vetted Challenger backend, not a shadow installer API. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..','..'),mediaRoot=path.join(root,'tools','preview-build','media-source');
const preview=process.argv[2]||'4';
if(!['4','5','6','7','8','9','10'].includes(preview))throw Error('Unsupported desktop preview');
const out=path.join(root,'tools','desktop-build','dist',preview==='4'?'runtime':'runtime-preview'+preview);
const version='4.0.0-desktop.preview.'+preview,port=preview!=='4'?null:17964;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const one=(s,old,repl,label)=>{
 const count=s.split(old).length-1;
 if(count!==1)throw Error('Anchor for '+label+' matched '+count+' times');
 return s.replace(old,repl);
};
if(fs.existsSync(out))throw Error('Refusing to overwrite desktop runtime; remove the previous build only after verification');
fs.mkdirSync(path.dirname(out),{recursive:true});
const tmp=fs.mkdtempSync(out+'.build-');
const media=JSON.parse(fs.readFileSync(path.join(mediaRoot,'project-media.v1.json')));
if(media.schema!=='challenger-project-media.v1')throw Error('Unrecognized media manifest');
const files=new Map();let icons=0,screenshots=0;
try{
 const copy=(src,dst)=>{const dest=path.join(tmp,dst);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(src,dest)};
 for(const name of ['server.js','challenger-core.js','source-scanner.js','registry-live.js','hub-updates.js','repository-media.js','independent-source-media.js','independent-media.v1.json','managed-install-status.js','catalog-health.js','project-quality.js','Install-Challenger.js','adapters.json',
  'portable-assets.json','official-icons.json','official-icons.js','challengers.json','sources.json','brand-icon.png','favicon.ico'])
   copy(path.join(root,name),name);
 fs.cpSync(path.join(root,'brand','orbit'),path.join(tmp,'brand','orbit'),{recursive:true});
 fs.cpSync(path.join(root,'local-icons'),path.join(tmp,'local-icons'),{recursive:true});
 for(const [id,p] of Object.entries(media.projects)){
  for(const type of ['icon','screenshot']){
   const a=p[type];if(!a)continue;
   if(a.status!=='approved'||!a.path?.startsWith('/media/'))throw Error('Unapproved media '+id);
   const rel=a.path.slice(1);
   if(!/^media\/(icons\/[a-z0-9-]+\.(png|svg|ico|webp|jpg|jpeg)|screenshots\/[a-z0-9-]+\.png)$/.test(rel))
    throw Error('Unsafe media filename');
   const buf=fs.readFileSync(path.join(mediaRoot,'assets',rel.slice('media/'.length)));
   if(sha(buf)!==a.sha256||buf.length!==a.size)throw Error('Source byte digest mismatch '+rel);
   const ext=path.extname(rel);
   if(ext==='.svg'&&/<script|<foreignobject|\son\w+\s*=|javascript:|<iframe|<object|<embed|@import/i.test(buf.toString('utf8')))
    throw Error('Unsafe SVG '+rel);
   const target=path.join(tmp,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,buf);
   files.set('/'+rel,rel);if(type==='icon')icons++;else screenshots++;
  }
 }
 if(icons<10||screenshots<3)throw Error('Too few verified media assets');
 if(['8','9','10'].includes(preview)){
  const craft=JSON.parse(fs.readFileSync(path.join(mediaRoot,'craft-suite-media.v1.json'),'utf8'));
  if(craft.schema!=='challenger-craft-media.v1'||Object.keys(craft.apps||{}).length!==13)
   throw Error('Official Craft app coverage must be 13 source-audited app icons');
  const vetted={},seenPaths=new Set();let photos=0;
  function ship(id,p,kind){
   if(!/^[a-z]+craft$/.test(id)||typeof p.path!=='string'||
      !new RegExp('^/media/craft/'+kind+'/'+id+(kind==='icons'?'\\.png':'/[a-z0-9-]+\\.(jpg|png)')+'$').test(p.path)||
      !/^https:\/\/github\.com\/storytold\/[a-z0-9-]+\/blob\/[A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+$/.test(p.source||'')||
      !/^(MIT OR Apache-2\.0|Apache-2\.0)$/.test(p.license||'')||
      !/^[0-9a-f]{64}$/.test(p.sha256||'')||seenPaths.has(p.path))
    throw Error('Untrusted Craft source media '+id+':'+p.path);
   const rel=p.path.slice(1),buf=fs.readFileSync(path.join(mediaRoot,'assets',rel));
   if(buf.length!==p.size||sha(buf)!==p.sha256)throw Error('Unverified Craft image bytes '+rel);
   if(rel.endsWith('.png')&&!buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    throw Error('Craft PNG signature absent '+rel);
   if(rel.endsWith('.jpg')&&!(buf[0]===255&&buf[1]===216&&buf[2]===255))
    throw Error('Craft JPEG signature absent '+rel);
   copy(path.join(mediaRoot,'assets',rel),rel);files.set(p.path,rel);seenPaths.add(p.path);
   return {path:p.path,source:p.source,key:p.key||id,caption:p.caption||id};
  }
  for(const [id,entry] of Object.entries(craft.apps)){
   if(!entry.icon||!Array.isArray(entry.screenshots)||!entry.screenshots.length)
    throw Error('Missing original Craft application imagery '+id);
   vetted[id]={icon:ship(id,entry.icon,'icons'),
    screenshots:entry.screenshots.map(p=>{photos++;return ship(id,p,'screenshots')})};
  }
  if(photos!==47)throw Error('Expected 47 verified Craft UI screenshots, got '+photos);
  fs.writeFileSync(path.join(tmp,'craft-media-index.js'),
   'window.CHALLENGER_CRAFT_MEDIA=Object.freeze('+JSON.stringify(vetted)+');\n');
  copy(path.join(mediaRoot,'CRAFT_SUITE_MEDIA_NOTICES.md'),'CRAFT_SUITE_MEDIA_NOTICES.md');
  console.log('VERIFIED_CRAFT_APP_MEDIA_BUNDLED '+JSON.stringify({officialIcons:13,officialScreenshots:photos}));
 }
 if(['6','7','8','9','10'].includes(preview)){
  const managedSeed=JSON.parse(fs.readFileSync(path.join(__dirname,'seeds','managed-catalog.preview'+preview+'.json'),'utf8'));
  if(!Array.isArray(managedSeed.apps)||managedSeed.apps.some(a=>a.installedPath||a.installedVersion||a.needsUpdate))
   throw Error('Refusing to publish machine-specific installed-software data in shared catalog seed');
  // Immutable, source-audited snapshots for first launch without a credential.
  // Later refreshes write only to isolated per-user app data.
  for(const [src,dst] of [['managed-catalog.preview'+preview+'.json','catalog-cache.json'],
    ['curated-metadata.preview'+preview+'.json','registry-live-metadata.json'],
    ['source-signals.preview'+preview+'.json','source-signals.json']]){
   copy(path.join(__dirname,'seeds',src),dst);
  }
 }
 copy(path.join(mediaRoot,'THIRD_PARTY_MEDIA_NOTICES.md'),'THIRD_PARTY_MEDIA_NOTICES.md');
 fs.cpSync(path.join(mediaRoot,'licenses'),path.join(tmp,'licenses'),{recursive:true});
 let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 html=one(html,'data-app-version="4.0.0"','data-app-version="'+version+'"','release version');
 html=one(html,'<script src="/app.js" defer></script>',
  '<script src="/media-index.js" defer></script>\n <script src="/project-media-runtime.js" defer></script>\n <script src="/app.js" defer></script>\n <script src="/live-actions.js" defer></script>','script loading');
 html=one(html,'<div id="sourceNotice" class="source-notice" role="status" hidden></div>',
  '<div id="sourceNotice" class="source-notice" role="status" hidden></div>\n'+
  '<div class="live-toolbar" id="liveToolbar"><span id="focusStatus" aria-live="polite">Starting the local engine…</span>'+
  '<button type="button" data-operation="scan">Check network sources</button>'+
  '<button type="button" data-operation="verify">Verify local installs</button>'+
  '<button type="button" data-operation="update-all" id="focusUpdateAll" hidden>Update approved apps</button></div>'+
  '<div id="operationNotice" class="focus-operation-notice" hidden role="status"></div>','live action bar');
 html=one(html,'View only — installation, verification and source scans remain in the current production interface.',
  'This computer only. Installation and updates use existing vetted workers, with explicit approval.','library disclosure');
 html=one(html,'Refresh read-only data ↻','Refresh live status ↻','footer refresh');
 html=one(html,'DESIGN CANDIDATE 4.0 / NO SYSTEM WRITES',
  'DESKTOP PREVIEW · REAL LOCAL ENGINE · ACTIONS REQUIRE APPROVAL','footer state');
 if(['7','8','9','10'].includes(preview)){
  html=one(html,'<div class="header-utilities">',
   '<div class="header-utilities"><div class="hub-update-controls">'+
   '<span class="hub-version" id="hubVersion">v4.0.0 · Preview '+preview+'</span>'+
   '<button id="hubCheckUpdates" type="button" class="hub-update-button" title="Check updates for Challenger Hub itself">Check Hub updates</button>'+
   '<span id="hubUpdateState" class="hub-update-state" role="status">Not checked</span>'+
   '<a id="hubUpdateLink" class="hub-update-link" rel="noopener noreferrer" target="_blank" hidden>View official release ↗</a></div>',
   'visible Hub version and self-update');
  html=one(html,'<script src="/live-actions.js" defer></script>',
   (['8','9','10'].includes(preview)?'<script src="/project-quality-ui.js" defer></script>\n ':'')+
   '<script src="/live-project-media.js" defer></script>\n '+
   '<script src="/hub-update-ui.js" defer></script>\n '+
   '<script src="/live-actions.js" defer></script>','v7 client scripts');
 }
 if(['8','9'].includes(preview)){
  html=one(html,'<button type="button" id="filterToggle"',
   '<button type="button" id="researchToggle" class="control-button" aria-pressed="false" title="Show project research with missing details">Show research</button>\n    <button type="button" id="filterToggle"',
   'independent research quality opt-in');
 }
 if(['8','9','10'].includes(preview))html=one(html,
  '<script src="/live-project-media.js" defer></script>',
  '<script src="/independent-media-index.js" defer></script>\n '+
  '<script src="/live-project-media.js" defer></script>',
  'vetted source-media index before original project dossier resolver');
 if(['8','9','10'].includes(preview))html=one(html,
  '<script src="/project-media-runtime.js" defer></script>',
  '<script src="/project-media-runtime.js" defer></script>\n '+
  '<script src="/craft-media-index.js" defer></script>\n '+
  '<script src="/craft-suite-media-runtime.js" defer></script>',
  'official source-based Craft App media loaded before dossiers');
 if(preview==='9'){
  const watch=JSON.parse(fs.readFileSync(path.join(__dirname,'seeds','catalog-candidates.preview'+preview+'.json'),'utf8'));
  if(watch.schema!=='challenger-candidate-watchlist.v1'||watch.summary.verified<10||
      watch.candidates.some(x=>x.installable!==false))
    throw Error('Candidate watchlist must be source-verified, non-installable research');
  fs.writeFileSync(path.join(tmp,'candidate-watch-index.js'),
    'window.CHALLENGER_CANDIDATE_WATCHLIST=Object.freeze('+JSON.stringify(watch)+');\n');
  html=one(html,'<script src="/hub-update-ui.js" defer></script>',
    '<script src="/hub-update-ui.js" defer></script>\n '+
    '<script src="/candidate-watch-index.js" defer></script>\n '+
    '<script src="/catalog-watch-ui.js" defer></script>',
    'new research candidates visible in native UI');
 }
 if(preview==='10'){
  const watch=JSON.parse(fs.readFileSync(path.join(__dirname,'seeds','catalog-candidates.preview10.json'),'utf8'));
  if(watch.schema!=='challenger-candidate-watchlist.v1'||watch.summary.verified!==15||
     watch.candidates.length!==15||watch.candidates.some(x=>x.installable!==false||x.installerAdapter!==null))
   throw Error('Preview10 public source watchlist must have exactly 15 unapproved sources');
  fs.writeFileSync(path.join(tmp,'candidate-watch-index.js'),
   'window.CHALLENGER_CANDIDATE_WATCHLIST=Object.freeze('+JSON.stringify(watch)+');\n');
  html=one(html,'<script src="/app.js" defer></script>',
   '<script src="/candidate-watch-index.js" defer></script>\n <script src="/app.js" defer></script>',
   'new candidates loaded before primary search');
  const hub=html.match(/<div class="hub-update-controls">[\s\S]*?<\/div>/g);
  if(!hub||hub.length!==1)throw Error('Expected one original header update control');
  html=one(html,hub[0],'','remove expanding header update status');
  html=one(html,'<footer class="global-footer">',
   '<footer class="global-footer">'+hub[0],'version and update check in stable footer');
  html=one(html,
   '<button type="button" data-scope="independent" class="scope-chip">Independent</button>',
   '<button type="button" data-scope="independent" class="scope-chip">Independent</button>'+
   '<button type="button" data-scope="new" class="scope-chip">New finds</button>',
   'all new candidates filter');
 }
 fs.writeFileSync(path.join(tmp,'index.html'),html);
 let js=fs.readFileSync(path.join(root,'app.js'),'utf8');
 js=one(js,'No installation, launch, scan, settings writes or background actions.',
  'Uses the existing local Challenger backend with confirmation-gated actions.','comment');
 js=one(js,"'</span><span class=\"discipline-label\">'+esc(d[1])+'</span>'+",
  "'</span>'+domainIcon(d[0])+'<span class=\"discipline-label\">'+esc(d[1])+'</span>'+",'category icons');
 js=one(js,
  "const name='<button type=\"button\" class=\"project-hit\" data-project=\"'+esc(a.repo)+'\">'+esc(a.title)+\n  '<small>'+",
  "const name='<button type=\"button\" class=\"project-hit\" data-project=\"'+esc(a.repo)+'\">'+\n  '<span class=\"project-hit-title\">'+mediaIcon(a,'row')+'<span>'+esc(a.title)+'</span></span>'+ \n  '<small>'+",'official icons');
 js=one(js,"$('projectDocument').innerHTML='<header class=\"project-identity\"><div class=\"project-identity-copy\">'+",
  "$('projectDocument').innerHTML='<header class=\"project-identity'+(mediaHasScreenshot(a)?' with-media':'')+'\"><div class=\"project-identity-copy\">'+",
  'dossier media layout');
 js=one(js,"'<h1 class=\"project-name\">'+esc(a.title)+'</h1>'+",
  "'<div class=\"project-title-cluster\">'+mediaIcon(a,'detail')+'<h1 class=\"project-name\">'+esc(a.title)+'</h1></div>'+",
  'dossier icon');
 js=one(js,"'<small class=\"prototype-note\">VIEW-ONLY DESIGN PREVIEW. NO INSTALL, LAUNCH OR UPDATE ACTIONS.</small></div></header>'+",
  "'<small class=\"prototype-note\">LIVE LOCAL ENGINE · VERIFIED INSTALLERS ONLY</small>'+focusActions(a)+'</div>'+mediaHero(a)+'</header>'+",
  'dossier actions');
 js=one(js,'Live read-only device data','Live device and vetted installer data','device data label');
 js=one(js,'No action is available in this preview.','Installation requires approval and verified assets.','installer statement');
 js=one(js,"'Read-only preview cannot reach the local source. '+error.message+",
  "'Local engine cannot be reached. '+error.message+",'error context');
 if(['6','7','8','9','10'].includes(preview)){
  js=one(js,"['Latest source version',a.latestVersion||a.releaseTag||'Not verified']",
   "['Latest source version',a.latestVersion||a.releaseTag||(a.observedReleaseTag?'Observed '+a.observedReleaseTag+' (not install-verified)':'Not verified')]",'honest observed release tag');
  js=one(js,"['Release date',dateLabel(a.publishedAt)]",
   "['Release date',dateLabel(a.publishedAt||a.observedPublishedAt)]",'upstream release observed date');
  js=one(js,"['Installed on device',a.installedVersion||'Not installed']",
   "['GitHub repository checked',dateLabel(a.repositoryMetadataCheckedAt)],['Installed on device',a.installedVersion||'Not installed']",'metadata freshness');
  js=one(js,"$('footerUpdated').textContent=snapshot?.checkedAt?('Last source check '+dateLabel(snapshot.checkedAt)):'Release check time unavailable';",
   "$('footerUpdated').textContent=snapshot?.catalogStatus?.checkedAt?('Managed catalog refreshed '+dateLabel(snapshot.catalogStatus.checkedAt)):'Managed catalog not refreshed';",'no false freshness claim');
 }
 js=one(js,"function rerender(){\n renderShell();",
  "function rerender(){\n renderShell();focusToolbar();",'toolbar refresh');
 js=one(js,"function action(event){\n const node=event.target.closest('button');if(!node)return;",
  "function action(event){\n const node=event.target.closest('button');if(!node)return;\n if(node.dataset.operation){void runFocusOperation(node);return}",'action handler');
 if(preview==='10'){
  js=one(js,'async function refresh(){',
   fs.readFileSync(path.join(__dirname,'new-source-records-preview10.js'),'utf8')+'\nasync function refresh(){',
   'visible candidate normalization loaded in browser');
  js=one(js,
   'projects=[...data.apps.map(a=>({...a,discovery:false})),...data.discoveries.map(a=>({...a,discovery:true}))];',
   'const current=[...data.apps.map(a=>({...a,discovery:false})),...data.discoveries.map(a=>({...a,discovery:true}))];\n'+
   '  projects=[...current,...sourceCandidatesForDiscovery(current)];',
   'all source-linked candidate records in primary index');
  js=one(js,
   "ui.scope==='all'||ui.scope==='independent'&&!!a.discovery||ui.scope==='missing'&&!a.installedVersion",
   "ui.scope==='all'||ui.scope==='independent'&&!!a.discovery||ui.scope==='new'&&!!a.candidateWatch||ui.scope==='missing'&&!a.installedVersion",
   'new finds filter inside real software index');
 }
 fs.writeFileSync(path.join(tmp,'app.js'),js);
 let css=fs.readFileSync(path.join(root,'style.css'),'utf8')+'\n'+
  fs.readFileSync(path.join(root,'tools','preview-build','project-media.css'),'utf8')+'\n'+
  fs.readFileSync(path.join(__dirname,'live.css'),'utf8')+(['7','8','9','10'].includes(preview)?'\n'+fs.readFileSync(path.join(__dirname,preview==='10'?'viewport-fit-preview10.css':preview==='9'?'viewport-fit-preview9.css':['8','9','10'].includes(preview)?'viewport-fit-preview8.css':'viewport-fit.css'),'utf8'):'')+
   (['8','9','10'].includes(preview)?'\n'+fs.readFileSync(path.join(__dirname,'slice-shell.css'),'utf8')+'\n'+
     fs.readFileSync(path.join(__dirname,'craft-suite-media.css'),'utf8'):'')+
  (preview==='10'?'\n'+fs.readFileSync(path.join(__dirname,'quiet-footer-preview10.css'),'utf8'):'');
 fs.writeFileSync(path.join(tmp,'style.css'),css);
 const clientMedia=Object.fromEntries(Object.entries(media.projects).map(([id,p])=>
   [id,{icon:p.icon||null,screenshot:p.screenshot||null}]));
 fs.writeFileSync(path.join(tmp,'media-index.js'),
  'window.CHALLENGER_PROJECT_MEDIA=Object.freeze('+JSON.stringify(clientMedia)+');\n');
 copy(path.join(root,'tools','preview-build','project-media-runtime.js'),'project-media-runtime.js');
 if(['8','9','10'].includes(preview)){
  copy(path.join(__dirname,'craft-suite-media-runtime.js'),'craft-suite-media-runtime.js');
  const vetted=require(path.join(root,'independent-source-media.js')).clientIndex();
  if(Object.keys(vetted.apps).length<24)throw Error('Insufficient vetted independent source media');
  fs.writeFileSync(path.join(tmp,'independent-media-index.js'),
   'window.CHALLENGER_INDEPENDENT_MEDIA=Object.freeze('+JSON.stringify(vetted)+');\n');
  console.log('SOURCE_PINNED_INDEPENDENT_MEDIA_BUNDLED '+JSON.stringify({
   projects:Object.keys(vetted.apps).length,icons:Object.values(vetted.apps).filter(x=>x.icon).length,
   sourceScreenshots:Object.values(vetted.apps).reduce((n,x)=>n+x.screenshots.length,0)}));
 }
 copy(path.join(__dirname,'live-actions.js'),'live-actions.js');
 if(['7','8','9','10'].includes(preview)){
  copy(path.join(__dirname,preview==='10'?'hub-update-ui-preview10.js':preview==='9'?'hub-update-ui-preview9.js':['8','9','10'].includes(preview)?'hub-update-ui-preview8.js':'hub-update-ui.js'),'hub-update-ui.js');
  if(['8','9','10'].includes(preview))copy(path.join(__dirname,preview==='10'?'project-discovery-ui-preview10.js':'project-quality-ui.js'),'project-quality-ui.js');
  copy(path.join(__dirname,'live-project-media.js'),'live-project-media.js');
 }
 if(preview==='9')copy(path.join(__dirname,'catalog-watch-ui.js'),'catalog-watch-ui.js');
 let server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 server=one(server,"if(req.method==='GET' && route==='/'){sendStatic(res,'index.html','text/html; charset=utf-8');return;}",
  "if(req.method==='GET' && route==='/'){sendStatic(res,'index.html','text/html; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/favicon.ico'){sendStatic(res,'favicon.ico','image/x-icon');return;}\n"+
  "if(req.method==='GET' && route==='/media-index.js'){sendStatic(res,'media-index.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/project-media-runtime.js'){sendStatic(res,'project-media-runtime.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/live-actions.js'){sendStatic(res,'live-actions.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route.startsWith('/brand/orbit/')){const name=route.slice(1);if("+JSON.stringify(
    ['orbit-app-icon.svg','orbit-flat.svg','orbit-dark.svg','orbit-signature.svg'].map(x=>'brand/orbit/'+x))+
  ".includes(name)){sendStatic(res,name,'image/svg+xml');return;}}\n"+
  "if(req.method==='GET' && MEDIA_WHITELIST.has(route)){const name=MEDIA_WHITELIST.get(route);"+
  "sendStatic(res,name,name.endsWith('.svg')?'image/svg+xml':name.endsWith('.png')?'image/png':"+
  "name.endsWith('.ico')?'image/x-icon':'application/octet-stream');return;}",
  'live resource whitelist');
 if(['7','8','9','10'].includes(preview))server=one(server,
  "if(req.method==='GET' && route==='/live-actions.js'){sendStatic(res,'live-actions.js','text/javascript; charset=utf-8');return;}",
  "if(req.method==='GET' && route==='/live-actions.js'){sendStatic(res,'live-actions.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/hub-update-ui.js'){sendStatic(res,'hub-update-ui.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/live-project-media.js'){sendStatic(res,'live-project-media.js','text/javascript; charset=utf-8');return;}",
  'Hub version and media UI script routes');
 if(['8','9','10'].includes(preview))server=one(server,
  "if(req.method==='GET' && route==='/hub-update-ui.js'){sendStatic(res,'hub-update-ui.js','text/javascript; charset=utf-8');return;}",
  "if(req.method==='GET' && route==='/hub-update-ui.js'){sendStatic(res,'hub-update-ui.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/project-quality-ui.js'){sendStatic(res,'project-quality-ui.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/independent-media-index.js'){sendStatic(res,'independent-media-index.js','text/javascript; charset=utf-8');return;}",
  'quality UI script delivered solely by native app');
 if(['8','9','10'].includes(preview))server=one(server,
  "if(req.method==='GET' && route==='/project-media-runtime.js'){sendStatic(res,'project-media-runtime.js','text/javascript; charset=utf-8');return;}",
  "if(req.method==='GET' && route==='/project-media-runtime.js'){sendStatic(res,'project-media-runtime.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/craft-media-index.js'){sendStatic(res,'craft-media-index.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/craft-suite-media-runtime.js'){sendStatic(res,'craft-suite-media-runtime.js','text/javascript; charset=utf-8');return;}",
  'source-vetted Craft app media script routes');
 if(preview==='9')server=one(server,
  "if(req.method==='GET' && route==='/hub-update-ui.js'){sendStatic(res,'hub-update-ui.js','text/javascript; charset=utf-8');return;}",
  "if(req.method==='GET' && route==='/hub-update-ui.js'){sendStatic(res,'hub-update-ui.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/candidate-watch-index.js'){sendStatic(res,'candidate-watch-index.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/catalog-watch-ui.js'){sendStatic(res,'catalog-watch-ui.js','text/javascript; charset=utf-8');return;}",
  'new candidates served locally without installer rights');
 if(preview==='10')server=one(server,
  "if(req.method==='GET' && route==='/hub-update-ui.js'){sendStatic(res,'hub-update-ui.js','text/javascript; charset=utf-8');return;}",
  "if(req.method==='GET' && route==='/hub-update-ui.js'){sendStatic(res,'hub-update-ui.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/candidate-watch-index.js'){sendStatic(res,'candidate-watch-index.js','text/javascript; charset=utf-8');return;}",
  'visible source watch data served read-only by private app');
 server=one(server,"const ROOT=__dirname;",  "const ROOT=__dirname;\nconst MEDIA_WHITELIST=new Map("+
  JSON.stringify([...files.entries()])+");",'frozen media whitelist');
 server=one(server,"json(res,200,{ok:true,app:'Craft Update Center',platform:process.platform,version:'2.5.7'});",
  "json(res,200,{ok:true,app:'Challenger Focus Desktop',mode:'LIVE_LOCAL_PREVIEW',platform:process.platform,"+
  "version:'"+version+"',"+(preview!=='4'?"desktopSessionVerified:!!process.env.CHALLENGER_DESKTOP_SESSION&&req.headers['x-challenger-desktop-session']===process.env.CHALLENGER_DESKTOP_SESSION,":"")+"admin:isAdmin,networkEnabled:process.env.CHALLENGER_DISABLE_SCAN!=='1'});",
  'desktop health contract');
 if(preview!=='4')server=one(server,
  "const route=(req.url||'').split('?')[0];",
  "const route=(req.url||'').split('?')[0];\n"+
  "if(req.method==='POST'&&(!process.env.CHALLENGER_DESKTOP_SESSION||req.headers['x-challenger-desktop-session']!==process.env.CHALLENGER_DESKTOP_SESSION)){json(res,403,{error:'Desktop session required'});return;}",
  'private desktop write session');
 fs.writeFileSync(path.join(tmp,'server.js'),server);
 const manifest={schema:'challenger-focus-desktop.live-preview.v1',version,port,
  backend:'Original Challenger Hub vetted installer and source scanner',
  liveApi:true,readOnly:false,productionUntouched:true,icons,screenshots,
  trustedActions:['scan','verify','install','download-portable','update-all','launch'],
  requiresExplicitUserApproval:true};
 fs.writeFileSync(path.join(tmp,'desktop-manifest.json'),JSON.stringify(manifest,null,2));
 const hashes={};
 function walk(dir,rel=''){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
   const key=path.join(rel,e.name);
   if(e.isDirectory())walk(path.join(dir,e.name),key);
   else hashes[key.split(path.sep).join('/')]=sha(fs.readFileSync(path.join(dir,e.name)));
  }
 }
 walk(tmp);fs.writeFileSync(path.join(tmp,'SHA256-MANIFEST.json'),JSON.stringify(hashes,null,2));
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.renameSync(tmp,out);
 console.log('DESKTOP_RUNTIME_BUILT '+JSON.stringify({out,files:Object.keys(hashes).length,version,port,icons,screenshots}));
}catch(e){fs.rmSync(tmp,{recursive:true,force:true});throw e}
