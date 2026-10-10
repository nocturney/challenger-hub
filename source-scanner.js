'use strict';
// Fair, source-neutral, metadata-only polling for every catalog entry.
// Never grants installer rights or trusts alternate-host binaries/checksums.
const fs=require('node:fs'),path=require('node:path');
const SOURCE_SCHEMA='challenger-source-signals.v1';
const CHECK_INTERVAL_MS=20*1000;
const MAX_BODY=400000;
const ID_PATTERN=/^[a-z][a-z0-9-]{1,79}$/;
const REPO_PATTERN=/^[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100}$/i;
const VALID_TAG=/^[a-zA-Z0-9][a-zA-Z0-9.+_/-]{0,100}$/;
const UPSTREAMS={
  'glaxnimate':[
    {kind:'gitlab-release',host:'invent.kde.org',url:'https://invent.kde.org/api/v4/projects/graphics%2Fglaxnimate/releases?per_page=1',label:'KDE Invent · releases'},
    {kind:'github-atom',host:'github.com',repository:'KDE/glaxnimate',label:'GitHub · releases'}
  ],
  'zrythm':[
    {kind:'gitlab-release',host:'gitlab.com',url:'https://gitlab.com/api/v4/projects/zrythm%2Fzrythm/releases?per_page=1',label:'GitLab · releases'},
    {kind:'gitlab-tag',host:'gitlab.com',url:'https://gitlab.com/api/v4/projects/zrythm%2Fzrythm/repository/tags?per_page=1',label:'GitLab · source tags'},
    {kind:'github-atom',host:'github.com',repository:'zrythm/zrythm',label:'GitHub · releases'}
  ],
  'stargate-daw':[
    {kind:'github-atom',host:'github.com',repository:'stargatedaw/stargate',label:'GitHub · published releases'},
    {kind:'codeberg-tag',host:'codeberg.org',url:'https://codeberg.org/api/v1/repos/stargatedaw/stargate/tags?limit=1',label:'Codeberg · fallback tags'}
  ]
};
function safeEntry(input){
 if(!input || !ID_PATTERN.test(input.id||'') || !REPO_PATTERN.test(input.repository||''))return null;
 return {id:input.id,repository:input.repository,kind:input.kind==='craft'?'craft':'independent'};
}
function allTasks(rows){
 const map=new Map();
 for(const x of rows){const v=safeEntry(x);if(v&&!map.has(v.id))map.set(v.id,v)}
 // Repository-owner discovery is one ordinary, unprivileged scheduler slot.
 // It never scans all Craft releases or skips independent projects.
 map.set('zz:directory:storytold',{id:'zz:directory:storytold',kind:'directory',repository:'storytold'});
 return [...map.values()].sort((a,b)=>a.id.localeCompare(b.id,'en'));
}
function sourcesFor(entry){
 if(entry.kind==='directory')return [{kind:'directory',host:'api.github.com',label:'Creator directory · discovery'}];
 const configured=UPSTREAMS[entry.id];
 if(configured)return configured.map(x=>x.kind==='github-atom'?{...x,url:'https://github.com/'+x.repository+'/releases.atom'}:{...x});
 return [{kind:'github-atom',host:'github.com',url:'https://github.com/'+entry.repository+'/releases.atom',label:'GitHub · published releases'}];
}
function getTag(tag){
 const v=String(tag||'').trim();
 return VALID_TAG.test(v)?v:null;
}
function xmlUnescape(s){return String(s||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")}
function atomRelease(xml,repository){
 if(typeof xml!=='string'||!xml.includes('<feed'))throw Error('Invalid Atom feed');
 const entries=[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)].slice(0,20);
 const found=[];
 for(const [,body]of entries){
   const links=[...body.matchAll(/\bhref="([^"]+)"/g)].map(m=>xmlUnescape(m[1]));
   const prefix='https://github.com/'+repository+'/releases/tag/';
   const link=links.find(x=>x.startsWith(prefix));
   if(!link)continue;
   let tag=null;try{tag=getTag(decodeURIComponent(link.slice(prefix.length).split(/[?#]/)[0]))}catch(_){}
   if(!tag)continue;
   const prerelease=/(?:^|[-._])(alpha|beta|rc|preview|pre|nightly|canary)(?:[-._]?\d+|$)/i.test(tag);
   found.push({tag,prerelease,url:link});
 }
 const stable=found.find(x=>!x.prerelease);
 return stable?{...stable,type:'release'}:found.length?{...found[0],type:'tag'}:{type:'none',tag:null};
}
function parseResponse(source,raw){
 if(source.kind==='github-atom')return atomRelease(raw,source.repository||source.url.slice('https://github.com/'.length).split('/releases.atom')[0]);
 let data;
 try{data=JSON.parse(raw)}catch(_){throw Error('Invalid JSON source payload')}
 if(!Array.isArray(data))throw Error('Unexpected source response shape');
 if(!data.length)return {type:'none',tag:null};
 const first=data[0],tag=getTag(first.tag_name||first.name);
 if(!tag)return {type:'none',tag:null};
 if(source.kind==='gitlab-release'){
   return {type:first.upcoming_release?'tag':'release',tag,prerelease:!!first.upcoming_release,url:'https://'+source.host+'/'+decodeURIComponent(source.url.split('/projects/')[1].split('/releases')[0]).replace('%2F','/')+'/-/releases/'+encodeURIComponent(tag)};
 }
 if(source.kind==='gitlab-tag'||source.kind==='codeberg-tag')return {type:'tag',tag,prerelease:false,url:null};
 throw Error('Source type not supported');
}
function readCache(file){
 try{const j=JSON.parse(fs.readFileSync(file,'utf8'));if(j?.schema===SOURCE_SCHEMA&&j.items&&typeof j.items==='object')return j}catch(_){}
 return {schema:SOURCE_SCHEMA,items:{},hostBackoff:{},cursor:0,lastActivity:null,roundCompleted:0};
}
function safePersist(file,obj){
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temp=file+'.next';
 fs.writeFileSync(temp,JSON.stringify(obj,null,2)+'\n','utf8');
 try{fs.renameSync(temp,file)}catch(e){
  if(process.platform!=='win32')throw e;
  fs.copyFileSync(temp,file);fs.rmSync(temp,{force:true});
 }
}
function makeScanner({root,list,config,fetcher,discovery,onChange,knownTag,logger,clock=()=>Date.now(),disableTimers=false}={}){
 if(!root||typeof list!=='function')throw Error('Scanner needs a root and project supplier');
 const file=path.join(root,'source-signals.json');
 const db=readCache(file);
 const getFetch=fetcher||fetch;
 let active=false,timer=null,forceIds=new Set(),forceSince=0,lastError='',mostRecent=null,attempts=0,successes=0;
 const log=(type,msg)=>{if(logger)logger(type,msg)};
 const current=()=>allTasks(list());
 function prefs(){
  const user=config?config():{};
  const hours=[6,12,24].includes(Number(user.intervalHours))?Number(user.intervalHours):12;
  return {hours,enabled:user.autoCheck!==false};
 }
 function due(row,manual){
  const now=clock();
  if(row?.lastAttempt && now-Date.parse(row.lastAttempt)<(row.error?60*60*1000:0))return false;
  if(manual)return true;
  return !row?.lastChecked||now-Date.parse(row.lastChecked)>=prefs().hours*3600*1000;
 }
 function pick(){
  const entries=current(),total=entries.length;
  for(let j=0;j<total;j++){
   const at=(Number(db.cursor||0)+j)%total,entry=entries[at],row=db.items[entry.id];
   if(!due(row,forceIds.has(entry.id)))continue;
   db.cursor=(at+1)%total;
   return entry;
  }
  return null;
 }
 function publicSignal(id){
  const x=db.items[id];if(!x)return null;
  return {sourceHost:x.sourceHost||null,sourceLabel:x.sourceLabel||null,checkedAt:x.lastChecked||null,
   signalTag:x.tag||null,signalType:x.signalType||null,unverified:x.signalType==='tag',verificationPending:!!x.pendingVerification,error:x.error||null};
 }
 function status(){
  const tasks=current(),rows=tasks.filter(x=>x.kind!=='directory'),lastSuccess=rows.map(x=>db.items[x.id]).filter(x=>x?.lastChecked).length;
  const dueCount=rows.filter(x=>due(db.items[x.id],forceIds.has(x.id))).length;
  const cfg=prefs();
  return {scanning:active||forceIds.size>0,lastSyncAt:mostRecent||db.lastActivity||null,error:lastError,pendingUnverified:rows.filter(x=>db.items[x.id]?.signalType==='tag').length,
   checked:lastSuccess,total:rows.length,due:dueCount,queued:forceIds.size,intervalHours:cfg.hours,
   sourceProviders:['GitHub Atom','GitLab','KDE Invent','Codeberg'],preferences:config?config():{autoCheck:true,intervalHours:12}};
 }
 async function request(url,host,prev){
  if(db.hostBackoff?.[host]>clock())return {kind:'backoff'};
  const headers={'User-Agent':'ChallengerHub/2.5.2 (+local release monitor)','Accept':'application/json, application/atom+xml;q=0.9'};
  if(prev?.etag)headers['If-None-Match']=prev.etag;
  if(prev?.modified)headers['If-Modified-Since']=prev.modified;
  let response;
  try{response=await getFetch(url,{headers,signal:AbortSignal.timeout(12000)})}catch(e){return {kind:'network',reason:String(e.message).slice(0,90)}}
  if(response.status===304)return {kind:'unchanged'};
  if(response.status===403||response.status===429){
   const retry=Number(response.headers.get('retry-after'));
   db.hostBackoff[host]=clock()+(Number.isFinite(retry)&&retry>=60&&retry<=86400?retry*1000:60*60*1000);
   return {kind:'blocked',status:response.status};
  }
  if(response.status===404||response.status===204)return {kind:'missing'};
  if(!response.ok)return {kind:'network',reason:'HTTP '+response.status};
  const bytes=Number(response.headers.get('content-length')||0);
  if(bytes>MAX_BODY)return {kind:'network',reason:'Source response too large'};
  let payload;
  try{payload=await response.text()}catch(e){return {kind:'network',reason:'Could not read source'} }
  if(Buffer.byteLength(payload)>MAX_BODY)return {kind:'network',reason:'Source response too large'};
  return {kind:'ok',payload,etag:response.headers.get('etag')||null,modified:response.headers.get('last-modified')||null};
 }
 async function checkOne(entry){
  const old=db.items[entry.id]||{},now=new Date(clock()).toISOString();
  const updated={...old,lastAttempt:now,error:null,etagByHost:{...(old.etagByHost||{})}};
  if(entry.kind==='directory'){
   try{
    const ok=await discovery?.();
    if(ok===false){updated.error='Directory listing unavailable';}
    else{updated.lastChecked=now;updated.sourceHost='api.github.com';updated.sourceLabel='Owner directory';updated.signalType='directory';}
   }catch(e){updated.error='Directory index unavailable';log('info','Creator index unavailable; catalog cache retained')}
   db.items[entry.id]=updated;return;
  }
  let fail=null,got=false,signal=null,used=null;
  for(const source of sourcesFor(entry)){
   if(!['github.com','gitlab.com','invent.kde.org','codeberg.org'].includes(source.host))throw Error('Unapproved source host');
   const etagKey=source.url;
   const result=await request(source.url,source.host,updated.etagByHost[etagKey]);
   if(result.kind==='backoff'||result.kind==='blocked'||result.kind==='network'||result.kind==='missing'){
    fail=result.kind==='network'?result.reason:result.kind;continue;
   }
   if(result.kind==='unchanged'){
    // A 304 for a previously empty primary feed must not mask a secondary feed.
    if(old.sourceUrl!==source.url)continue;
    got=true;used=source;signal={type:old.signalType||'none',tag:old.tag||null,url:old.url||null};break;
   }
   try{signal=parseResponse(source,result.payload)}catch(e){fail=e.message;continue}
   updated.etagByHost[etagKey]={etag:result.etag,modified:result.modified};
   if(signal.type==='none'&&source!==sourcesFor(entry).at(-1))continue;
   got=true;used=source;break;
  }
  if(got){
   const trustedTag=typeof knownTag==='function'?getTag(knownTag(entry)):null;
   const previous=old.tag||trustedTag||null;
   if(signal.tag&&trustedTag===signal.tag){updated.verifiedTag=signal.tag;updated.pendingVerification=null;}
   updated.lastChecked=now;updated.sourceHost=used.host;updated.sourceLabel=used.label;updated.sourceUrl=used.url;
   updated.signalType=signal.type;updated.tag=signal.tag||null;updated.url=signal.url||null;
   if(signal.type==='tag'&&old.signalType==='release'&&old.tag){
     // A mirror tag cannot replace an already published upstream release.
     updated.mirrorTag=signal.tag;updated.tag=old.tag;updated.signalType=old.signalType;
     updated.sourceHost=old.sourceHost;updated.sourceLabel=old.sourceLabel;updated.sourceUrl=old.sourceUrl;
     updated.sourceCheckedFrom=used.host;updated.mirrorCheckedAt=now;
   }
   if(previous&&signal.tag&&previous!==signal.tag&&signal.type==='release')updated.pendingVerification=signal.tag;
   if(onChange&&updated.pendingVerification&&signal.type==='release'&&
      (!old.lastVerificationAttempt||clock()-Date.parse(old.lastVerificationAttempt)>6*3600*1000)){
     updated.lastVerificationAttempt=now;
     try{if(await onChange({...entry,previousTag:previous,...signal,sourceHost:used.host})===true){
       updated.verifiedTag=signal.tag;updated.pendingVerification=null;
     }}catch(e){log('info','Release metadata validation pending for '+entry.id)}
   }
   successes++;mostRecent=now;db.lastActivity=now;
  }else{updated.error=String(fail||'Source unavailable').slice(0,110);lastError='Some upstream checks are unavailable; cached information was preserved';}
  db.items[entry.id]=updated;
 }
 async function tick({force=false}={}){
  if(active||(!prefs().enabled&&!force))return {skipped:true};
  const entry=pick();if(!entry)return {skipped:true,reason:'All tracked projects refreshed'};
  active=true;
  try{await checkOne(entry)}catch(e){lastError=String(e.message).slice(0,125);log('error','Source probe failed for '+entry.id);}
  finally{
   attempts++;forceIds.delete(entry.id);
   try{safePersist(file,db)}catch(e){lastError='Could not save source signals';log('error',lastError)}
   active=false;
  }
  return {id:entry.id,status:db.items[entry.id]?.error?'unavailable':'checked',count:current().length};
 }
 function requestAll(){
  if(clock()-forceSince<30*60*1000)return {queued:forceIds.size,cooldown:true};
  forceSince=clock();forceIds=new Set(current().map(x=>x.id));
  return {queued:forceIds.size,cooldown:false};
 }
 function start(){
  if(disableTimers||process.env.CHALLENGER_DISABLE_SCAN==='1')return;
  const initial=setTimeout(()=>tick().catch(e=>log('error',String(e))),2500);initial.unref();
  timer=setInterval(()=>tick().catch(e=>log('error',String(e))),CHECK_INTERVAL_MS);timer.unref();
 }
 function stop(){if(timer)clearInterval(timer);timer=null}
 return {start,stop,tick,requestAll,status,publicSignal,sourcesFor,allTasks,current,readSnapshot:()=>JSON.parse(JSON.stringify(db))};
}
module.exports={makeScanner,allTasks,sourcesFor,atomRelease,parseResponse,readCache};
