'use strict';
/* Vetted independent developer media. Original images remain at pinned official
 * GitHub commits, are served only from localhost and validated against the
 * audited SHA256 from the original file before display. Nothing is installed.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'independent-media.v1.json'),'utf8'));
if(manifest.schema!=='challenger-independent-media.v1')throw Error('Unknown independent media audit');
const MAX_CONCURRENT=4,MAX_WAITING=40,MAX_CACHE_ITEMS=75;
const cache=new Map(),jobs=new Map(),waiting=[];let running=0;
const CACHE_DIR=path.join(__dirname,'.verified-independent-media-cache');
function localCacheFile(spec){
 return path.join(CACHE_DIR,spec.entry.sha256+'.'+spec.entry.format);
}
function fromDisk(spec){
 try{
  const data=fs.readFileSync(localCacheFile(spec)),e=spec.entry;
  if(data.length!==e.bytes||sha(data)!==e.sha256||!safeBytes(data,spec.type,e.format))return null;
  return {bytes:data,mime:e.format==='png'?'image/png':e.format==='jpg'?'image/jpeg':'image/webp',
   source:e.source,checkedAgainst:e.sha256};
 }catch{return null}
}
function saveDisk(spec,data){
 try {
  fs.mkdirSync(CACHE_DIR,{recursive:true});
  const file=localCacheFile(spec),temp=file+'.next';
  fs.writeFileSync(temp,data,{flag:'w'});
  try{fs.renameSync(temp,file)}catch{
   if(!fs.existsSync(file))throw Error('Unable to commit verified cache');
   fs.rmSync(temp,{force:true});
  }
 }catch{} // Cache is optional; uncacheable runtime still displays verified images.
}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hex=/^[a-f0-9]{64}$/i,commit=/^[a-f0-9]{40}$/,id=/^[a-z][a-z0-9-]{1,79}$/;
function listed(app) {
 if(!app||app.discovery!==true||!id.test(app.repo||''))return null;
 const a=manifest.apps?.[app.repo];
 if(!a||a.repository?.toLowerCase()!==String(app.repository||'').toLowerCase()||!commit.test(a.commit))return null;
 return a;
}
function item(app,type,index=0){
 const a=listed(app);if(!a)return null;
 const x=type==='icon'?a.icon:type==='screenshot'&&Number.isSafeInteger(index)&&index>=0&&index<5?
   a.screenshots[index]:null;
 if(!x||!hex.test(x.sha256||'')||!/^[a-f0-9]{40}$/.test(x.gitBlobSha||'')||
   !Number.isSafeInteger(x.bytes)||x.bytes<500||x.bytes>2400000||
   !/^[A-Za-z0-9 _@+./-]{1,230}\.(png|jpg|webp)$/.test(x.path||'')||
   x.path.startsWith('/')||x.path.includes('..')||x.path.includes('\\'))return null;
 const expected='https://github.com/'+a.repository+'/blob/'+a.commit+'/'+x.path.split('/').map(encodeURIComponent).join('/');
 if(x.source!==expected)return null;
 return {entry:x,repository:a.repository,commit:a.commit,type};
}
function tryPNG(b,kind){
 const png=Buffer.from([137,80,78,71,13,10,26,10]);
 if(b.length<32||!b.subarray(0,8).equals(png))return false;
 const w=b.readUInt32BE(16),h=b.readUInt32BE(20);
 return w>=(kind==='screenshot'?480:32)&&h>=(kind==='screenshot'?230:32)&&w<=15000&&h<=15000;
}
function safeBytes(data,type,ext){
 if(ext==='png')return tryPNG(data,type);
 if(ext==='jpg')return data.length>5000&&data[0]===255&&data[1]===216&&data[2]===255;
 if(ext==='webp')return data.length>7000&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP';
 return false;
}
function slot(fn){
 if(waiting.length>=MAX_WAITING)return Promise.resolve(null);
 return new Promise(resolve=>{waiting.push({fn,resolve});drain()});
}
function drain(){
 while(running<MAX_CONCURRENT&&waiting.length){
  const job=waiting.shift();running++;
  Promise.resolve().then(job.fn).then(job.resolve,()=>job.resolve(null))
   .finally(()=>{running--;drain()});
 }
}
async function get(app,type,index=0,fetcher=fetch){
 const spec=item(app,type,index);if(!spec)return null;
 const key=app.repo+':'+type+':'+index;
 const disk=fromDisk(spec);
 if(disk)return disk;
 const cached=cache.get(key);
 if(cached&&Date.now()-cached.at< (cached.value?3600000:60000))return cached.value;
 if(jobs.has(key))return jobs.get(key);
 const pending=slot(async()=>{
  const {entry,repository,commit}=spec;
  const src='https://raw.githubusercontent.com/'+repository+'/'+commit+'/'+
   entry.path.split('/').map(encodeURIComponent).join('/');
  try {
   const response=await fetcher(src,{headers:{'User-Agent':'Challenger-Hub-Pinned-Media/1.0'},
    redirect:'error',signal:AbortSignal.timeout(16000)});
   if(!response.ok||new URL(response.url).hostname!=='raw.githubusercontent.com')return null;
   if(Number(response.headers.get('content-length')||0)>2400000)return null;
   const bytes=Buffer.from(await response.arrayBuffer());
   const ext=entry.format,mime=ext==='png'?'image/png':ext==='jpg'?'image/jpeg':'image/webp';
   if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256||!safeBytes(bytes,type,ext))return null;
   saveDisk(spec,bytes);
   return {bytes,mime,source:entry.source,checkedAgainst:entry.sha256};
  }catch{return null}
 }).then(value=>{
  cache.set(key,{at:Date.now(),value});
  while(cache.size>MAX_CACHE_ITEMS)cache.delete(cache.keys().next().value);
  return value;
 }).finally(()=>jobs.delete(key));
 jobs.set(key,pending);return pending;
}
function clientIndex(){
 const entries={};
 for(const [id,a] of Object.entries(manifest.apps||{})){
  const app={repo:id,repository:a.repository,discovery:true};
  const icon=item(app,'icon');
  const screenshots=(a.screenshots||[]).slice(0,5).flatMap((_,i)=>item(app,'screenshot',i)?[
   {source:a.screenshots[i].source,path:a.screenshots[i].path}]:[]);
  if(icon||screenshots.length)entries[id]={repository:a.repository,icon:icon?{source:icon.entry.source}:null,screenshots};
 }
 return {schema:manifest.schema,reviewedAt:manifest.reviewedAt,apps:entries};
}
module.exports={listed,item,get,clientIndex,MAX_CONCURRENT};
