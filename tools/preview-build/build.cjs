'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=process.platform==='win32'?'D:/Velvet/Installers/CraftSuite':'/Users/chris/Library/Application Support/OfficeOps/CraftSuite';
const stage=process.argv[2]||path.join(base,'Center','FocusCandidate-v4.0.0');
const dest=path.join(path.dirname(stage),'Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.1');
if(fs.existsSync(dest))throw Error('Build destination exists (no overwrite): '+dest);
let html=fs.readFileSync(path.join(stage,'index.html'),'utf8');
let js=fs.readFileSync(path.join(stage,'app.js'),'utf8');
if(!html.includes('data-app-version="4.0.0"')||!html.includes('brand/orbit/orbit-flat.svg'))throw Error('Approved Focus+Orbit stage missing');
if(!js.includes("fetch('/api/state',{method:'GET'"))throw Error('Expected GET-only UI missing');
const cache=JSON.parse(fs.readFileSync(path.join(stage,'catalog-cache.json'),'utf8'));
const reg=JSON.parse(fs.readFileSync(path.join(stage,'challengers.json'),'utf8'));
const sources=JSON.parse(fs.readFileSync(path.join(stage,'sources.json'),'utf8'));
if(!Array.isArray(cache.apps)||!Array.isArray(reg.projects)||!cache.checkedAt)throw Error('Real cached data unavailable');
const trim=(v,n=1500)=>typeof v==='string'?v.slice(0,n):null;
const apps=cache.apps.filter(a=>a&&/^[a-z0-9-]+$/.test(a.repo||'')).map(a=>{
 const allowed=['repo','title','original','group','description','isNew','repoUrl','pushedAt','repoUpdatedAt','latestVersion','releaseTag','publishedAt','releaseBody','releaseTitle','releaseUrl','installable','assetIssue','installedVersion','needsUpdate','license','createdAt','stars','issues'];
 const clean={};for(const k of allowed)if(a[k]!==undefined)clean[k]=typeof a[k]==='string'?trim(a[k],k==='releaseBody'?2400:700):a[k];
 return {...clean,creator:'Storytold',sourceId:'storytold',repository:'storytold/'+a.repo,challenges:a.original?[a.original]:[],discovery:false};
});
const discoveries=reg.projects.filter(p=>p&&/^[a-z][a-z0-9-]+$/.test(p.id||'')&&/^[\w.-]+\/[\w.-]+$/.test(p.repository||'')).map(p=>({
 repo:p.id,title:p.name,creator:p.creator,repository:p.repository,repoUrl:'https://github.com/'+p.repository,
 homepage:typeof p.homepage==='string'&&p.homepage.startsWith('https://')?p.homepage:null,
 sourceId:'research-curated',discovery:true,isNew:true,category:p.category||null,group:p.group,
 challenges:Array.isArray(p.challenges)?p.challenges.filter(x=>typeof x==='string').slice(0,10):[],
 original:Array.isArray(p.challenges)?p.challenges.join(', '):'',
 summary:trim(p.summary),description:trim(p.summary),competition:Array.isArray(p.competition)?p.competition.slice(0,8):[],
 replacementType:p.replacementType,reportedMaturity:p.reportedMaturity,
 reportedPlatforms:Array.isArray(p.reportedPlatforms)?p.reportedPlatforms.slice(0,8):[],
 caveats:trim(p.caveats),verifiedAt:p.verifiedAt,priority:p.priority,reviewStatus:p.reviewStatus,
 researchPendingVerification:p.reviewStatus==='research-candidate-unverified',releaseStrategy:'unverified',
 installable:false,installAdapter:null,installedVersion:null,needsUpdate:false,current:false,
 latestVersion:null,publishedAt:null,releaseTag:null,releaseUrl:null,pushedAt:p.githubLastPushAtReview||null,
 stars:Number.isFinite(p.githubStarsAtReview)?p.githubStarsAtReview:null,
 license:p.license==='NOASSERTION'?null:p.license,sourceSignal:null
}));
if(apps.length!==12||discoveries.length!==152)throw Error('Cached total mismatch '+apps.length+'/'+discoveries.length);
if(discoveries.filter(p=>p.researchPendingVerification).length!==73)throw Error('Research safety rule mismatch');
const snap={previewMode:'offline-cache',snapshotCapturedAt:cache.checkedAt,platform:process.platform,
 computer:'Archived local test catalog',admin:false,apps,discoveries,
 sources:Array.isArray(sources.sources)?sources.sources.map(x=>({id:x.id,label:x.label,mode:x.mode||'curated'})):[],
 sourceStatus:{error:'Archived catalog only; no live source checks.'},checkedAt:cache.checkedAt,scanning:false,
 scanError:'Archived catalog; no current source verification.',active:null,queue:[],history:[]};
const json=JSON.stringify(snap,null,2);
if(/C:\\Users\\|D:\\Velvet\\|\/Users\/chris\//i.test(json))throw Error('Private machine path found in preview data');
const capture=new Date(cache.checkedAt).toISOString().slice(0,10),version='4.0.0-orbit.preview.1';
function one(body,oldval,newval,label){const n=body.split(oldval).length-1;if(n!==1)throw Error(label+' expected one anchor, got '+n);return body.replace(oldval,newval)}
html=one(html,'</header>','</header>\n <div class="test-release-strip" role="status">FOCUS 4.0 + ORBIT · TEST PREVIEW · ARCHIVED CATALOG '+capture+' · READ ONLY · NOT LIVE</div>','notice');
html=one(html,'data-app-version="4.0.0"','data-app-version="'+version+'"','release version');
js=one(js,"+(snapshot?'Local data connected':'Connection unavailable');","+(snapshot?.previewMode==='offline-cache'?'Archived catalog · offline test':snapshot?'Local data connected':'Connection unavailable');",'status indicator');
js=one(js,"const warn=snapshot?.scanError||snapshot?.sourceStatus?.error;","const warn=snapshot?.previewMode==='offline-cache'?('OFFLINE PREVIEW: cached source information from '+dateLabel(snapshot.checkedAt)+'. No live installation, update, queue or verification data.'):snapshot?.scanError||snapshot?.sourceStatus?.error;",'warning');
const activityPatch=[
 "if(snapshot?.previewMode==='offline-cache'){",
 "  $('runningNumber').textContent='—';$('waitingNumber').textContent='—';$('issueNumber').textContent='—';",
 "  $('activityState').textContent='Offline catalog only';",
 "  $('currentActivity').textContent='Live operations are unavailable in this isolated test preview.';",
 "  $('pendingActivity').textContent='No queue or installation controls are connected.';",
 "  $('historyRows').innerHTML='<li><div>Activity history is not part of the archived catalog. Open the operational version for live status.</div></li>';",
 "  return;",
 " }",
 " $('runningNumber').textContent=active?'1':'0';"
].join('\n');
js=one(js,"$('runningNumber').textContent=active?'1':'0';",activityPatch,'activity status');
js=one(js,"$('footerDevice').textContent=snapshot?((snapshot.computer||'Local computer')+' · '+(snapshot.platform||'Unknown platform')):'Local data unavailable';",
 "$('footerDevice').textContent=snapshot?.previewMode==='offline-cache'?'OFFLINE TEST · archived '+dateLabel(snapshot.checkedAt):snapshot?((snapshot.computer||'Local computer')+' · '+(snapshot.platform||'Unknown platform')):'Local data unavailable';",'footer status');
js=one(js,"$('navInstalledCount').textContent=projects.filter(a=>!!a.installedVersion).length;","$('navInstalledCount').textContent=snapshot?.previewMode==='offline-cache'?'—':projects.filter(a=>!!a.installedVersion).length;",'nav installed truth');
js=one(js,"['Installed on device',a.installedVersion||'Not installed']","['Installed on device',snapshot?.previewMode==='offline-cache'?'Not checked in offline preview':a.installedVersion||'Not installed']",'dossier installed truth');
const libPatch=[
 "function renderLibrary(){",
 " if(snapshot?.previewMode==='offline-cache'){",
 "  $('localMachine').textContent='Archived catalog · installed applications and updates are not verified';",
 "  $('libraryInstalledCount').textContent='—';$('libraryUpdateCount').textContent='—';$('libraryCount').textContent='—';",
 "  $('libraryRows').innerHTML='';$('libraryEmpty').hidden=false;",
 "  $('libraryEmpty').querySelector('h2').textContent='Live installed software unavailable';",
 "  $('libraryEmpty').querySelector('p').textContent='This offline preview cannot determine which apps are installed or require updates.';",
 "  $('libraryCaution').textContent='Archived catalog only. Open the operational app for accurate installed versions and updates.';",
 "  for(const b of document.querySelectorAll('[data-library]')){const selected=b.dataset.library===ui.libraryTab;b.classList.toggle('selected',selected);b.setAttribute('aria-selected',String(selected))}",
 "  if(ui.screen==='library')rememberRoute(true);return;",
 " }"
].join('\n');
js=one(js,'function renderLibrary(){',libPatch,'library live-data guard');
let css=fs.readFileSync(path.join(stage,'style.css'),'utf8');
css+='\n/* Offline test release badge (not part of production). */\n.test-release-strip{padding:9px 20px;text-align:center;background:#e6ebe5;color:#284a3e;border-bottom:1px solid #cddbd0;font:600 11px/1.4 ui-sans-serif,system-ui,sans-serif;letter-spacing:.1em}\n:root[data-theme="dark"] .test-release-strip{background:#263b31;color:#c4decc;border-bottom-color:#3f5b4d}\n@media(max-width:430px){.test-release-strip{font-size:10px;padding:7px 12px;letter-spacing:.02em}}\n';
const temp=fs.mkdtempSync(dest+'.build-');
try{
 for(const n of ['brand-icon.png','favicon.ico'])fs.copyFileSync(path.join(stage,n),path.join(temp,n));
 fs.writeFileSync(path.join(temp,'index.html'),html);
 fs.writeFileSync(path.join(temp,'app.js'),js);
 fs.writeFileSync(path.join(temp,'style.css'),css);
 fs.cpSync(path.join(stage,'brand','orbit'),path.join(temp,'brand','orbit'),{recursive:true});
 fs.copyFileSync(path.join(__dirname,'preview-server.cjs'),path.join(temp,'preview-server.cjs'));
 fs.writeFileSync(path.join(temp,'preview-catalog.json'),json);
 const manifest={product:'Challenger Focus 4.0 + Orbit',version,mode:'READ_ONLY_OFFLINE_PREVIEW',
 createdAt:new Date().toISOString(),catalogAsOf:cache.checkedAt,projects:apps.length+discoveries.length,
 researchRestricted:73,platform:process.platform,productionUntouched:true,backendIncluded:false};
 fs.writeFileSync(path.join(temp,'test-manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(temp,'START-WINDOWS.cmd'),'@echo off\r\ncd /d "%~dp0"\r\nnode preview-server.cjs\r\npause\r\n');
 fs.writeFileSync(path.join(temp,'START-MAC.command'),'#!/bin/sh\ncd "$(dirname "$0")"\nexec node preview-server.cjs\n');
 if(process.platform!=='win32')fs.chmodSync(path.join(temp,'START-MAC.command'),0o755);
 const how=['CHALLENGER FOCUS 4.0 + ORBIT SIGNATURE / '+version,'',
 'TEST ONLY. No production or service modifications. Node.js must be installed.','',
 'Windows: Run START-WINDOWS.cmd. Mac: Run START-MAC.command.',
 'Then open http://127.0.0.1:17961/ on THIS computer.',
 'Test Explore, category browse, search, dossier, My Software, layout and light/dark.',
 'Archive captured: '+capture+'. Statuses are NOT current. Activity deliberately shows unavailable.',
 'No installer, update, launch, source scan or settings changes are supported.',
 'Stop the preview by closing its terminal or pressing Ctrl+C.','',
 'This server only accepts GET/HEAD and binds 127.0.0.1. No paid services or external API calls.'];
 fs.writeFileSync(path.join(temp,'README-TEST.txt'),how.join('\n'));
 const sha={};for(const n of ['index.html','app.js','style.css','preview-catalog.json','preview-server.cjs','brand-icon.png','favicon.ico'])sha[n]=crypto.createHash('sha256').update(fs.readFileSync(path.join(temp,n))).digest('hex');
 fs.writeFileSync(path.join(temp,'SHA256-MANIFEST.json'),JSON.stringify(sha,null,2));
 fs.renameSync(temp,dest);
 console.log('FOCUS_ORBIT_PREVIEW_BUILD_READY',JSON.stringify({path:dest,version,mode:manifest.mode,projects:164,restricted:73,archiveAt:cache.checkedAt,productionUntouched:true}));
}catch(e){fs.rmSync(temp,{recursive:true,force:true});throw e}
