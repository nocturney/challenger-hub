import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const directory=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(directory,'../../..');
const defaultRuntime=path.join(repo,'tools','desktop-build','dist','runtime-preview12');
const candidatePath=path.join(repo,'tools','desktop-build','seeds','catalog-candidates.preview10.json');

function limited(s,n=300){return String(s??'').replace(/\s+/g,' ').trim().slice(0,n)}
async function choosePort(){
 const server=net.createServer();
 await new Promise((res,rej)=>server.once('error',rej).listen(0,'127.0.0.1',res));
 const port=server.address().port;
 await new Promise(res=>server.close(res));
 return port;
}
function normalize(item,kind){
 const name=limited(item.name||item.title||item.repo||item.id,110);
 const id=limited(item.id||item.repo||name,160);
 const maker=limited(item.creator||item.author||item.repository?.split('/')[0]||
  item.repoUrl?.split('/')[3]||(kind==='managed'?'storytold':'Independent'),110);
 const category=limited(item.group||item.category||'Independent software',90);
 return {
  id:kind+':'+id,name,initial:name[0]||'?',
  maker,category,
  summary:limited(item.summary||item.description||item.whyReview,340),
  platforms:limited(Array.isArray(item.reportedPlatforms)?item.reportedPlatforms.join(', '):
   Array.isArray(item.platforms)?item.platforms.join(', '):'Not yet verified',180),
  evidence:kind==='research'?'Research only':kind==='managed'?'Managed catalog':'Curated source',
  source:(()=>{
    const raw=limited(item.repoUrl||item.repository||(kind==='managed'?'storytold/'+item.repo:''),250);
    return raw.startsWith('https://')?raw:raw.includes('/')?'https://github.com/'+raw:'';
  })(),
  kind,
  // Only source-provided dossier facts. Missing values remain explicitly unknown.
  challenges:limited(item.original||(Array.isArray(item.challenges)?item.challenges.join(', '):''),180),
  license:limited(item.officialLicense||item.license||'',90),
  release:limited(item.latestPublishedStableTag||item.latestVersion||item.releaseTag||'',90)
 };
}
export function filterCatalog(items,term='',category='All disciplines'){
 const q=String(term).trim().toLocaleLowerCase('en-US');
 return items.filter(x=>
  (category==='All disciplines'||x.category===category)&&
  (!q||[x.name,x.maker,x.category,x.summary].some(y=>y.toLocaleLowerCase('en-US').includes(q)))
 );
}
export function categoriesOf(items){
 const counts=new Map();
 for(const item of items)counts.set(item.category,(counts.get(item.category)||0)+1);
 return ['All disciplines',...[...counts.entries()]
  .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,11).map(([name])=>name)];
}
export async function readFromRealEngine({runtime=defaultRuntime,timeoutMs=12000,candidateFilePath=candidatePath}={}){
 const manifest=JSON.parse(fs.readFileSync(path.join(runtime,'desktop-manifest.json'),'utf8'));
 if(manifest.version!=='4.0.0-desktop.preview.12')throw Error('Refusing unexpected runtime version');
 const port=await choosePort();
 const token=crypto.randomBytes(32).toString('hex');
 const child=spawn(process.execPath,[path.join(runtime,'server.js')],{
  cwd:runtime,stdio:['ignore','pipe','pipe'],
  env:{...process.env,CRAFT_CENTER_PORT:String(port),
   CHALLENGER_DISABLE_SCAN:'1',CHALLENGER_DESKTOP_SESSION:token}
 });
 let stderr='',stdout='';
 child.stdout.on('data',b=>{stdout=(stdout+b.toString()).slice(-900)});
 child.stderr.on('data',b=>{stderr=(stderr+b.toString()).slice(-1200)});
 const origin='http://127.0.0.1:'+port;
 const deadline=Date.now()+timeoutMs;
 try{
  let healthy=false;
  while(Date.now()<deadline){
   if(child.exitCode!==null)throw Error('Local engine terminated '+child.exitCode+' '+stderr);
   try{
    const response=await fetch(origin+'/api/health',{
     headers:{'X-Challenger-Desktop-Session':token},signal:AbortSignal.timeout(500)});
    if(response.ok){
     const health=await response.json();
     if(health.app!=='Challenger Focus Desktop'||
        health.version!==manifest.version||
        health.desktopSessionVerified!==true||
        health.platform!==process.platform||health.networkEnabled!==false)
      throw Error('Untrusted local endpoint or enabled network scanner');
     healthy=true;break;
    }
   }catch(e){
    if(String(e.message).includes('Untrusted local endpoint'))throw e;
   }
   await new Promise(r=>setTimeout(r,160));
  }
  if(!healthy)throw Error('Private Challenger health check timed out: '+stdout+' '+stderr);
  const res=await fetch(origin+'/api/state',{signal:AbortSignal.timeout(5000)});
  if(!res.ok)throw Error('Live catalog GET failed: '+res.status);
  const live=await res.json();
  if(!Array.isArray(live.apps)||!Array.isArray(live.discoveries))
   throw Error('Live catalog schema changed');
  if(live.apps.length!==14||live.discoveries.length!==152)
   throw Error('Live catalog count changed: '+live.apps.length+'/'+live.discoveries.length);
  // Research comes from the genuine source-pinned candidate seed, not from Scout or public promotion.
  const candidateFile=JSON.parse(fs.readFileSync(candidateFilePath,'utf8'));
  if(!Array.isArray(candidateFile.candidates)||candidateFile.candidates.length!==15)
   throw Error('Research candidate seed changed');
  const items=[
   ...live.apps.map(p=>normalize(p,'managed')),
   ...live.discoveries.map(p=>normalize(p,'curated')),
   ...candidateFile.candidates.map(p=>normalize(p,'research'))
  ];
  if(items.length!==181||new Set(items.map(p=>p.id)).size!==181)
   throw Error('Expected 181 unique source-linked items');
  return {items,counts:{managed:live.apps.length,curated:live.discoveries.length,
   research:candidateFile.candidates.length},
   engineVersion:manifest.version,hostPlatform:live.platform,hostArch:live.arch,
   source:'real local Challenger Preview12 /api/state; 15 pinned research candidates',
   networkScanDisabled:true,writeActionsExposed:false,sourceStatus:live.sourceStatus?.status||'unknown'};
 }finally{
  if(child.exitCode===null){
   child.kill('SIGTERM');
   await Promise.race([
    new Promise(r=>child.once('exit',r)),
    new Promise(r=>setTimeout(()=>{child.kill('SIGKILL');r()},1500))
   ]);
  }
 }
}
