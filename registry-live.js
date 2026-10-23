'use strict';
// Optional authenticated, metadata-ONLY refresh for already curated independent projects.
// Never changes approved adapters, repository membership, license decisions or install rights.
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile),TTL=12*60*60*1000,CHUNK=20,REPO=/^[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100}$/i;
let inflight=null,liveStatus={scanning:false,startedAt:null,checked:0,total:0,error:null};
function target(root){return path.join(root,'registry-live-metadata.json')}
function read(root){
 try{
  const x=JSON.parse(fs.readFileSync(target(root),'utf8'));
  if(x.schema==='challenger-registry-live.v1'&&x.items&&typeof x.items==='object')return x;
 }catch(_){}
 return {schema:'challenger-registry-live.v1',updatedAt:null,items:{},stats:{checked:0,failed:0,missing:0}};
}
function status(root){
 const saved=read(root),at=Date.parse(saved.updatedAt||'');
 return {...liveStatus,lastCompletedAt:saved.updatedAt,
  cachedItems:Object.keys(saved.items).length,
  stale:!Number.isFinite(at)||Date.now()-at>TTL,
  lastStatistics:saved.stats};
}
function safePersist(root,data){
 const file=target(root),tmp=file+'.'+process.pid+'.next';
 fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n','utf8');
 try{fs.renameSync(tmp,file)}catch(e){
  if(process.platform!=='win32')throw e;
  fs.copyFileSync(tmp,file);fs.rmSync(tmp,{force:true});
 }
}
function normalizeProjects(projects){
 const seen=new Set(),out=[];
 for(const p of projects){
  if(!p||!/^[a-z][a-z0-9-]{1,79}$/.test(p.id||'')||!REPO.test(p.repository||'')||seen.has(p.id))continue;
  seen.add(p.id);out.push({id:p.id,repository:p.repository});
 }
 return out;
}
async function lookupBatch(batch,cli){
 const aliases=batch.map((p,i)=>{
  const [owner,name]=p.repository.split('/');
  return 'p'+i+':repository(owner:'+JSON.stringify(owner)+',name:'+JSON.stringify(name)+')'+
   '{nameWithOwner pushedAt updatedAt stargazerCount isArchived url owner{avatarUrl} '+
   'releases(first:1,orderBy:{field:CREATED_AT,direction:DESC}){nodes{tagName isPrerelease isDraft publishedAt url}}}';
 });
 const query='query { '+aliases.join(' ')+' }';
 const {stdout}=await exec(cli,['api','graphql','-f','query='+query],
  {timeout:35000,maxBuffer:7*1024*1024,windowsHide:true});
 const response=JSON.parse(stdout);
 if(response.errors?.length||!response.data)throw Error('Authenticated repository metadata unavailable');
 return batch.map((p,i)=>{
  const v=response.data['p'+i];
  if(!v||v.nameWithOwner.toLowerCase()!==p.repository.toLowerCase())return {id:p.id,missing:true};
  const release=v.releases?.nodes?.find(x=>!x.isDraft&&!x.isPrerelease);
  return {id:p.id,repository:p.repository,stars:Number.isSafeInteger(v.stargazerCount)?v.stargazerCount:null,
   pushedAt:v.pushedAt||null,repoUpdatedAt:v.updatedAt||null,isArchived:!!v.isArchived,
   observedTag:release?.tagName||null,observedPublishedAt:release?.publishedAt||null,
   ownerAvatarUrl:/^https:\/\/avatars\.githubusercontent\.com\/u\/[0-9]+(?:\?v=[0-9]+)?$/.test(v.owner?.avatarUrl||'')?v.owner.avatarUrl:null,
   lastObservedAt:new Date().toISOString()};
 });
}
async function refresh({root,force=false,cli='gh',logger}={}){
 if(!root)throw Error('Missing metadata storage directory');
 if(inflight)return inflight;
 const cached=read(root),at=Date.parse(cached.updatedAt||'');
 if(!force&&Number.isFinite(at)&&Date.now()-at<TTL)return {skipped:true,reason:'fresh',...status(root)};
 inflight=(async()=>{
  const list=normalizeProjects(JSON.parse(fs.readFileSync(path.join(root,'challengers.json'),'utf8')).projects||[]);
  liveStatus={scanning:true,startedAt:new Date().toISOString(),checked:0,total:list.length,error:null};
  const next={...cached,items:{...cached.items}},stats={checked:0,failed:0,missing:0};
  for(let i=0;i<list.length;i+=CHUNK){
   const batch=list.slice(i,i+CHUNK);
   try{
    const results=await lookupBatch(batch,cli);
    for(const entry of results){
     if(entry.missing){stats.missing++;continue}
     next.items[entry.id]=entry;stats.checked++;
    }
   }catch(e){
    stats.failed+=batch.length;
    liveStatus.error='Some repository metadata could not be refreshed; cached rows retained';
    if(logger)logger('info','Registry metadata batch failed; retaining cached project state');
   }
   liveStatus.checked=i+batch.length;
  }
  if(!stats.checked)throw Error('Could not refresh any curated repository metadata; previous snapshot retained');
  next.updatedAt=new Date().toISOString();next.stats=stats;safePersist(root,next);
  return {updatedAt:next.updatedAt,...stats};
 })().catch(e=>{liveStatus.error=String(e.message).slice(0,160);throw e})
   .finally(()=>{liveStatus.scanning=false;inflight=null});
 return inflight;
}
module.exports={read,status,refresh,normalizeProjects};
