'use strict';
/* Builds a second, isolated and immutable preview from the verified Preview 1.
 * Does not modify Focus stage, production, live backends or Preview 1. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const version='4.0.0-orbit.preview.2',port=17962;
const base=process.platform==='win32'?'D:/Velvet/Installers/CraftSuite':'/Users/chris/Library/Application Support/OfficeOps/CraftSuite';
const source=path.join(base,'Center','Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.1');
const dest=path.join(base,'Center','Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.2');
const mediaBase=path.join(__dirname,'media-source');
const media=JSON.parse(fs.readFileSync(path.join(mediaBase,'project-media.v1.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function one(s,a,b,desc){const n=s.split(a).length-1;if(n!==1)throw Error(desc+' unique anchor missing: '+n);return s.replace(a,b)}
function validAsset(asset){
 if(asset.status!=='approved')throw Error('Unapproved media');
 const route=asset.path;
 if(!/^\/media\/(icons\/[a-z0-9-]+\.(png|svg|webp|jpg|jpeg|ico)|screenshots\/[a-z0-9-]+\.png)$/.test(route))throw Error('Invalid media route '+route);
 const rel=route.replace('/media/',''),file=path.join(mediaBase,'assets',rel),buf=fs.readFileSync(file);
 if(buf.length!==asset.size||sha(buf)!==asset.sha256)throw Error('Media SHA/size mismatch '+route);
 const ext=path.extname(rel);
 if(ext==='.png'&&!buf.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('PNG signature');
 if(ext==='.svg'){
  const text=buf.toString('utf8');
  if(!/<svg[\s>]/i.test(text)||/<script|<foreignobject|\son\w+\s*=|javascript:|<iframe|<object|<embed|@import|url\s*\(\s*["']?https?:/i.test(text))throw Error('Unsafe SVG');
 }
 return {route,rel,buf};
}
if(media.schema!=='challenger-project-media.v1')throw Error('Unexpected media schema');
if(fs.existsSync(dest))throw Error('Preview 2 destination already exists: '+dest);
const state=JSON.parse(fs.readFileSync(path.join(source,'preview-catalog.json'),'utf8'));
const m1=JSON.parse(fs.readFileSync(path.join(source,'test-manifest.json'),'utf8'));
if(state.previewMode!=='offline-cache'||state.apps?.length!==12||state.discoveries?.length!==152||
 m1.mode!=='READ_ONLY_OFFLINE_PREVIEW'||m1.version!=='4.0.0-orbit.preview.1')throw Error('Source preview mismatch');
const projectIds=new Set([...state.apps,...state.discoveries].map(p=>p.repo));
const routes={},assets=[];let icons=0,screenshots=0;
for(const [id,rec] of Object.entries(media.projects)){
 if(!projectIds.has(id))throw Error('Media ID not in archived catalog: '+id);
 for(const type of ['icon','screenshot']){
  if(!rec[type])continue;
  const entry=validAsset(rec[type]);
  if(routes[entry.route])throw Error('Duplicate route '+entry.route);
  routes[entry.route]='media/'+entry.rel;
  assets.push(entry);
  if(type==='icon')icons++;else screenshots++;
 }
}
if(!icons||!screenshots)throw Error('No genuine verified media; stop preview build');
let html=fs.readFileSync(path.join(source,'index.html'),'utf8');
let app=fs.readFileSync(path.join(source,'app.js'),'utf8');
let css=fs.readFileSync(path.join(source,'style.css'),'utf8');
let server=fs.readFileSync(path.join(source,'preview-server.cjs'),'utf8');
html=one(html,'data-app-version="4.0.0-orbit.preview.1"','data-app-version="'+version+'"','version');
html=one(html,'<script src="/app.js" defer></script>',
 '<script src="/media-index.js" defer></script>\n <script src="/project-media-runtime.js" defer></script>\n <script src="/app.js" defer></script>','script order');
app=one(app,"'</span><span class=\"discipline-label\">'+esc(d[1])+'</span>'+",
 "'</span>'+domainIcon(d[0])+'<span class=\"discipline-label\">'+esc(d[1])+'</span>'+",'home category icons');
app=one(app,
 "const name='<button type=\"button\" class=\"project-hit\" data-project=\"'+esc(a.repo)+'\">'+esc(a.title)+\n  '<small>'+",
 "const name='<button type=\"button\" class=\"project-hit\" data-project=\"'+esc(a.repo)+'\">'+\n  '<span class=\"project-hit-title\">'+mediaIcon(a,'row')+'<span>'+esc(a.title)+'</span></span>'+ \n  '<small>'+",'official icons in results');
app=one(app,
 "$('projectDocument').innerHTML='<header class=\"project-identity\"><div class=\"project-identity-copy\">'+",
 "$('projectDocument').innerHTML='<header class=\"project-identity'+(mediaHasScreenshot(a)?' with-media':'')+'\"><div class=\"project-identity-copy\">'+",
 'media dossier layout');
app=one(app,"'<h1 class=\"project-name\">'+esc(a.title)+'</h1>'+",
 "'<div class=\"project-title-cluster\">'+mediaIcon(a,'detail')+'<h1 class=\"project-name\">'+esc(a.title)+'</h1></div>'+",
 'dossier identity');
app=one(app,"</small></div></header>'+\n '<div class=\"project-content-grid\">",
 "</small></div>'+mediaHero(a)+'</header>'+\n '<div class=\"project-content-grid\">",
 'genuine screenshot in header');
css+='\n'+fs.readFileSync(path.join(__dirname,'project-media.css'),'utf8');
server=one(server,'function send(res,status',
 'files.set("/media-index.js","media-index.js");files.set("/project-media-runtime.js","project-media-runtime.js");\n'+
 'for(const [route,rel] of Object.entries('+JSON.stringify(routes)+'))files.set(route,rel);\n'+
 "mime['.webp']='image/webp';mime['.jpg']='image/jpeg';mime['.jpeg']='image/jpeg';\n"+
 'function send(res,status','media whitelist');
const temp=fs.mkdtempSync(dest+'.build-');
try{
 for(const name of ['brand-icon.png','favicon.ico','preview-catalog.json']){
  fs.copyFileSync(path.join(source,name),path.join(temp,name));
 }
 fs.cpSync(path.join(source,'brand','orbit'),path.join(temp,'brand','orbit'),{recursive:true});
 fs.writeFileSync(path.join(temp,'index.html'),html);
 fs.writeFileSync(path.join(temp,'app.js'),app);
 fs.writeFileSync(path.join(temp,'style.css'),css);
 fs.writeFileSync(path.join(temp,'preview-server.cjs'),server);
 fs.copyFileSync(path.join(__dirname,'project-media-runtime.js'),path.join(temp,'project-media-runtime.js'));
 const clientMedia=Object.fromEntries(Object.entries(media.projects).map(([id,x])=>[id,{
  icon:x.icon||null,screenshot:x.screenshot||null}]));
 fs.writeFileSync(path.join(temp,'media-index.js'),
  'window.CHALLENGER_PROJECT_MEDIA=Object.freeze('+JSON.stringify(clientMedia)+');\n');
 fs.writeFileSync(path.join(temp,'project-media.v1.json'),JSON.stringify(media,null,2));
 fs.copyFileSync(path.join(mediaBase,'THIRD_PARTY_MEDIA_NOTICES.md'),path.join(temp,'THIRD_PARTY_MEDIA_NOTICES.md'));
 if(fs.existsSync(path.join(mediaBase,'licenses')))fs.cpSync(path.join(mediaBase,'licenses'),path.join(temp,'licenses'),{recursive:true});
 for(const asset of assets){
  const target=path.join(temp,'media',asset.rel);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,asset.buf);
 }
 fs.writeFileSync(path.join(temp,'START-WINDOWS.cmd'),
  '@echo off\r\ncd /d "%~dp0"\r\nset FOCUS_ORBIT_TEST_PORT=17962\r\nnode preview-server.cjs\r\npause\r\n');
 fs.writeFileSync(path.join(temp,'START-MAC.command'),
  '#!/bin/sh\ncd "$(dirname "$0")"\nexport FOCUS_ORBIT_TEST_PORT=17962\nexec node preview-server.cjs\n');
 if(process.platform!=='win32')fs.chmodSync(path.join(temp,'START-MAC.command'),0o755);
 const next={...m1,version,createdAt:new Date().toISOString(),sourceVersion:'4.0.0-orbit.preview.1',
  media:{icons,screenshots,sourceCheckedAt:media.createdAt,signatureVerified:true},productionUntouched:true};
 fs.writeFileSync(path.join(temp,'test-manifest.json'),JSON.stringify(next,null,2));
 fs.writeFileSync(path.join(temp,'README-TEST.txt'),
  'CHALLENGER FOCUS 4.0 + ORBIT / '+version+'\nTEST ONLY, READ ONLY, NOT LIVE. PROJECT SCREENSHOTS ARE ORIGINAL UPSTREAM MEDIA.\n'+
  'Windows: START-WINDOWS.cmd. macOS: START-MAC.command. Open http://127.0.0.1:17962 on THIS machine.\n'+
  'No installs, updates, launch, local scanners or mutation endpoints. Source catalog dated '+new Date(state.checkedAt).toISOString().slice(0,10)+'.\n'+
  'Media provenance and third party project licenses: THIRD_PARTY_MEDIA_NOTICES.md.\n');
 const sums={};
 for(const name of ['index.html','app.js','style.css','preview-catalog.json','preview-server.cjs','brand-icon.png',
 'favicon.ico','project-media-runtime.js','media-index.js','project-media.v1.json','test-manifest.json']){
  sums[name]=sha(fs.readFileSync(path.join(temp,name)));
 }
 for(const a of assets)sums['media/'+a.rel]=sha(a.buf);
 sums['THIRD_PARTY_MEDIA_NOTICES.md']=sha(fs.readFileSync(path.join(temp,'THIRD_PARTY_MEDIA_NOTICES.md')));
 if(fs.existsSync(path.join(temp,'licenses'))){for(const name of fs.readdirSync(path.join(temp,'licenses'))){
  sums['licenses/'+name]=sha(fs.readFileSync(path.join(temp,'licenses',name)));
 }}
 fs.writeFileSync(path.join(temp,'SHA256-MANIFEST.json'),JSON.stringify(sums,null,2));
 fs.renameSync(temp,dest);
 console.log('MEDIA_PREVIEW_V2_BUILD_READY '+JSON.stringify({dest,version,icons,screenshots,port,readOnly:true}));
}catch(e){fs.rmSync(temp,{recursive:true,force:true});throw e}
