'use strict';
/* Reproducible isolated Focus Desktop live runtime.
 * Wraps the EXISTING vetted Challenger backend, not a shadow installer API. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..','..'),mediaRoot=path.join(root,'tools','preview-build','media-source');
const preview=process.argv[2]||'4';
if(!['4','5','6','7'].includes(preview))throw Error('Unsupported desktop preview');
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
 for(const name of ['server.js','challenger-core.js','source-scanner.js','registry-live.js','hub-updates.js','repository-media.js','Install-Challenger.js','adapters.json',
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
 if(preview==='6'||preview==='7'){
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
 if(preview==='7'){
  html=one(html,'<div class="header-utilities">',
   '<div class="header-utilities"><div class="hub-update-controls">'+
   '<span class="hub-version" id="hubVersion">v4.0.0 · Preview 7</span>'+
   '<button id="hubCheckUpdates" type="button" class="hub-update-button" title="Check updates for Challenger Hub itself">Check Hub updates</button>'+
   '<span id="hubUpdateState" class="hub-update-state" role="status">Not checked</span>'+
   '<a id="hubUpdateLink" class="hub-update-link" rel="noopener noreferrer" target="_blank" hidden>View official release ↗</a></div>',
   'visible Hub version and self-update');
  html=one(html,'<script src="/live-actions.js" defer></script>',
   '<script src="/live-project-media.js" defer></script>\n '+
   '<script src="/hub-update-ui.js" defer></script>\n '+
   '<script src="/live-actions.js" defer></script>','v7 client scripts');
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
 if(preview==='6'||preview==='7'){
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
 fs.writeFileSync(path.join(tmp,'app.js'),js);
 let css=fs.readFileSync(path.join(root,'style.css'),'utf8')+'\n'+
  fs.readFileSync(path.join(root,'tools','preview-build','project-media.css'),'utf8')+'\n'+
  fs.readFileSync(path.join(__dirname,'live.css'),'utf8')+(preview==='7'?'\n'+fs.readFileSync(path.join(__dirname,'viewport-fit.css'),'utf8'):'');
 fs.writeFileSync(path.join(tmp,'style.css'),css);
 const clientMedia=Object.fromEntries(Object.entries(media.projects).map(([id,p])=>
   [id,{icon:p.icon||null,screenshot:p.screenshot||null}]));
 fs.writeFileSync(path.join(tmp,'media-index.js'),
  'window.CHALLENGER_PROJECT_MEDIA=Object.freeze('+JSON.stringify(clientMedia)+');\n');
 copy(path.join(root,'tools','preview-build','project-media-runtime.js'),'project-media-runtime.js');
 copy(path.join(__dirname,'live-actions.js'),'live-actions.js');
 if(preview==='7'){
  copy(path.join(__dirname,'hub-update-ui.js'),'hub-update-ui.js');
  copy(path.join(__dirname,'live-project-media.js'),'live-project-media.js');
 }
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
 if(preview==='7')server=one(server,
  "if(req.method==='GET' && route==='/live-actions.js'){sendStatic(res,'live-actions.js','text/javascript; charset=utf-8');return;}",
  "if(req.method==='GET' && route==='/live-actions.js'){sendStatic(res,'live-actions.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/hub-update-ui.js'){sendStatic(res,'hub-update-ui.js','text/javascript; charset=utf-8');return;}\n"+
  "if(req.method==='GET' && route==='/live-project-media.js'){sendStatic(res,'live-project-media.js','text/javascript; charset=utf-8');return;}",
  'Hub version and media UI script routes');
 server=one(server,"const ROOT=__dirname;","const ROOT=__dirname;\nconst MEDIA_WHITELIST=new Map("+
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
