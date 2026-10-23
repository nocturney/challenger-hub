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
 const id=String(input?.id||'').toLowerCase();
 if(!ID_PATTERN.test(id)||!REPO_PATTERN.test(input.repository||''))return null;
 return {id,repository:input.repository,kind:input.kind==='craft'?'craft':'independent'};
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
 const entries=[...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)(?:<\/entry>|(?=<entry\b)|(?=<\/feed>)|$)/g)].slice(0,20);
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
// Atom releases may contain multi-megabyte changelogs. Only the first release
// tag links are required; never download the entire body just to find a tag.
const MAX_ATOM_PREFIX=192*1024;
async function readAtomPrefix(response,url){
 const repository=url.slice('https://github.com/'.length).split('/releases.atom')[0];
 const stream=response.body?.getReader?.();
 if(!stream)return String(await response.text()).slice(0,MAX_ATOM_PREFIX);
 const decoder=new TextDecoder();let body="",count=0,completed=false;
 try{
  while(count<MAX_ATOM_PREFIX){
   const chunk=await stream.read();
   if(chunk.done){completed=true;body+=decoder.decode();break}
   const available=MAX_ATOM_PREFIX-count;
   const part=chunk.value.byteLength>available?chunk.value.subarray(0,available):chunk.value;
   count+=part.byteLength;body+=decoder.decode(part,{stream:true});
   if(body.includes('<entry')&&atomRelease(body,repository).type==='release')break;
   if(chunk.value.byteLength>available)break;
  }
 }finally{if(!completed)try{await stream.cancel()}catch(_){}}
 return body;
}
function makeScanner({root,list,config,fetcher,discovery,onChange,knownTag,logger,clock=()=>Date.now(),disableTimers=false}={}){
 if(!root||typeof list!=='function')throw Error('Scanner needs a root and project supplier');
 const file=path.join(root,'source-signals.json');
 const db=readCache(file);
 const getFetch=fetcher||fetch;
 let activeCount=0,timer=null,forceIds=new Set(),forceSince=0,lastError='',mostRecent=null,attempts=0,successes=0;
 let draining=false,manualProgress=null;const inFlight=new Set();
 const log=(type,msg)=>{if(logger)logger(type,msg)};
 const current=()=>allTasks(list());
 function prefs(){
  const user=config?config():{};
  const hours=[6,12,24].includes(Number(user.intervalHours))?Number(user.intervalHours):12;
  return {hours,enabled:user.autoCheck!==false};
 }
 function due(row,manual){
  const now=clock();
  // Explicit user refresh retries once even after an ordinary failure; host backoff is still enforced by request().
  if(manual)return true;
  if(row?.lastAttempt&&row.error&&now-Date.parse(row.lastAttempt)<60*60*1000)return false;
  return !row?.lastChecked||now-Date.parse(row.lastChecked)>=prefs().hours*3600*1000;
 }
 function pick(){
  const entries=current(),total=entries.length;
  for(let j=0;j<total;j++){
   const at=(Number(db.cursor||0)+j)%total,entry=entries[at],row=db.items[entry.id];
   if(inFlight.has(entry.id)||(forceIds.size>0&&!forceIds.has(entry.id)))continue;
   if(!due(row,forceIds.has(entry.id)))continue;
   db.cursor=(at+1)%total;
   return entry;
  }
  return null;
 }
 function publicSignal(id){
  const key=String(id||'').toLowerCase();
  const x=db.items[key]||db.items[id];if(!x)return null;
  return {sourceHost:x.sourceHost||null,sourceLabel:x.sourceLabel||null,checkedAt:x.lastChecked||null,
   signalTag:x.tag||null,signalType:x.signalType||null,unverified:x.signalType==='tag',verificationPending:!!x.pendingVerification,error:x.error||null};
 }
 function status(){
  const tasks=current(),rows=tasks.filter(x=>x.kind!=='directory'),lastSuccess=rows.map(x=>db.items[x.id]).filter(x=>x?.lastChecked).length;
  const dueCount=rows.filter(x=>due(db.items[x.id],forceIds.has(x.id))).length;
  const cfg=prefs(),failed=rows.filter(x=>!!db.items[x.id]?.error).length;
  const fresh=rows.filter(x=>{const at=Date.parse(db.items[x.id]?.lastChecked||'');return Number.isFinite(at)&&clock()-at<cfg.hours*3600000}).length;
  return {scanning:activeCount>0||forceIds.size>0,lastSyncAt:mostRecent||db.lastActivity||null,error:failed?failed+' source checks need retry; cached information remains available':lastError==='Could not save source signals'?lastError:'',failed,pendingUnverified:rows.filter(x=>db.items[x.id]?.signalType==='tag').length,
   checked:lastSuccess,fresh,total:rows.length,due:dueCount,queued:forceIds.size,
   scanProgress:manualProgress?{...manualProgress,queued:forceIds.size,active:activeCount}:null,intervalHours:cfg.hours,
   sourceProviders:['GitHub Atom','GitLab','KDE Invent','Codeberg'],preferences:config?config():{autoCheck:true,intervalHours:12}};
 }
 async function request(url,host,prev,kind){
  if(db.hostBackoff?.[host]>clock())return {kind:'backoff'};
  const headers={'User-Agent':'ChallengerHub/2.5.3 (+local release monitor)','Accept':'application/json, application/atom+xml;q=0.9'};
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
  if(kind!=='github-atom'&&bytes>MAX_BODY)return {kind:'network',reason:'Source response too large'};
  let payload;
  try{payload=kind==='github-atom'?await readAtomPrefix(response,url):await response.text()}
  catch(e){return {kind:'network',reason:'Could not read source'} }
  if(kind!=='github-atom'&&Buffer.byteLength(payload)>MAX_BODY)return {kind:'network',reason:'Source response too large'};
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
  const choices=sourcesFor(entry);
  for(let index=0;index<choices.length;index++){
   const source=choices[index];
   if(!['github.com','gitlab.com','invent.kde.org','codeberg.org'].includes(source.host))throw Error('Unapproved source host');
   const etagKey=source.url;
   // A conditional 304 is meaningful only with a prior successfully parsed signal.
   // Historical ETags without lastChecked/sourceUrl must be refetched unconditionally.
   const canRevalidate=old.sourceUrl===source.url&&!!old.lastChecked;
   const result=await request(source.url,source.host,canRevalidate?updated.etagByHost[etagKey]:null,source.kind);
   if(result.kind==='missing'&&source.kind==='github-atom'){
    got=true;used=source;signal=old.tag?{type:old.signalType||'none',tag:old.tag,url:old.url||null}:{type:'none',tag:null};break;
   }
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
   if(signal.type==='none'&&index<choices.length-1)continue;
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
  if(activeCount>=3||(!force&&activeCount>0)||(!prefs().enabled&&!force))return {skipped:true};
  const entry=pick();if(!entry)return {skipped:true,reason:'No eligible project'};
  activeCount++;inFlight.add(entry.id);
  try{await checkOne(entry)}
  catch(e){lastError=String(e.message).slice(0,125);log('error','Source probe failed for '+entry.id);
    db.items[entry.id]={...(db.items[entry.id]||{}),lastAttempt:new Date(clock()).toISOString(),error:lastError};
  }finally{
   attempts++;
   const inBatch=forceIds.delete(entry.id);
   if(inBatch&&manualProgress){
    manualProgress.completed++;
    if(db.items[entry.id]?.error)manualProgress.failed++;
    if(!forceIds.size)manualProgress.finishedAt=new Date(clock()).toISOString();
   }
   try{safePersist(file,db)}catch(e){lastError='Could not save source signals';log('error',lastError)}
   inFlight.delete(entry.id);activeCount--;
  }
  return {id:entry.id,status:db.items[entry.id]?.error?'unavailable':'checked',count:current().length};
 }
 function requestAll(){
  if(forceIds.size||clock()-forceSince<2*60*1000)return {queued:forceIds.size,cooldown:true};
  forceSince=clock();forceIds=new Set(current().map(x=>x.id));
  manualProgress={total:forceIds.size,completed:0,failed:0,startedAt:new Date(clock()).toISOString(),finishedAt:null};
  return {queued:forceIds.size,cooldown:false};
 }
 async function drainRequested(){
  if(draining)return {running:true,queued:forceIds.size};
  if(!forceIds.size)return {running:false,queued:0};
  draining=true;
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
   const workers=Array.from({length:3},(_,worker)=>(async()=>{
    if(worker)await pause(worker*350);
    let misses=0;
    while(forceIds.size){
     const result=await tick({force:true});
     if(result.skipped){
      if(activeCount===0&&++misses>15)break;
      await pause(180);continue;
     }
     misses=0;
     await pause(950); // bounded network burst; host rate-limits/backoff are honored
    }
   })());
   await Promise.all(workers);
   if(!forceIds.size){db.roundCompleted=(db.roundCompleted||0)+1;safePersist(file,db)}
  }finally{draining=false}
  return {running:false,queued:forceIds.size};
 }
 function start(){
  if(disableTimers||process.env.CHALLENGER_DISABLE_SCAN==='1')return;
  const initial=setTimeout(()=>tick().catch(e=>log('error',String(e))),2500);initial.unref();
  timer=setInterval(()=>tick().catch(e=>log('error',String(e))),CHECK_INTERVAL_MS);timer.unref();
 }
 function stop(){if(timer)clearInterval(timer);timer=null}
 return {start,stop,tick,requestAll,drainRequested,status,publicSignal,sourcesFor,allTasks,current,readSnapshot:()=>JSON.parse(JSON.stringify(db))};
}
module.exports={makeScanner,allTasks,sourcesFor,atomRelease,parseResponse,readCache};
