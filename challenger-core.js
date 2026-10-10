'use strict';
// Source-neutral catalog enrichment and conservative release tracking.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const ROOT=__dirname,REL_FILE=path.join(ROOT,'release-index.json'),ADAPTER_FILE=path.join(ROOT,'adapters.json');
const REG_FILE=path.join(ROOT,'challengers.json'),INST_FILE=path.join(ROOT,'managed-installs.json'),SET_FILE=path.join(ROOT,'source-preferences.json');
const MAC_ROOT=path.join(os.homedir(),'Applications','ChallengerHub Apps');
const WIN_ROOT='D:\\Velvet\\Installers\\ChallengerHub\\Managed';
const CLIENT_INSTALLER=path.join(ROOT,'Install-Challenger.js');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const defPrefs={autoCheck:true,intervalHours:12};
let scanBusy=false,lastSyncError='',lastSyncAt=null,sourcePending=0;
function config(){
 let x={};try{x=read(SET_FILE)}catch(_){}
 return {autoCheck:typeof x.autoCheck==='boolean'?x.autoCheck:true,
  intervalHours:[6,12,24].includes(Number(x.intervalHours))?Number(x.intervalHours):12};
}
function setConfig(user){
 const old=config(),v={...old};
 if(typeof user.autoCheck==='boolean')v.autoCheck=user.autoCheck;
 if([6,12,24].includes(Number(user.intervalHours)))v.intervalHours=Number(user.intervalHours);
 const tmp=SET_FILE+'.tmp';fs.writeFileSync(tmp,JSON.stringify(v,null,2)+'\n','utf8');fs.renameSync(tmp,SET_FILE);
 return v;
}
function releases(){try{const x=read(REL_FILE);return x?.schema==='challenger-releases.v1'?x:{repositories:{}}}catch(_){return {repositories:{}}}}
function adapters(){try{return read(ADAPTER_FILE).projects||{}}catch(_){return {}}}
function installs(){try{const v=read(INST_FILE);return v.installed||{}}catch(_){return {}}}
function projects(){try{return read(REG_FILE).projects||[]}catch(_){return []}}
function ensureUnder(file,root){
 if(typeof file!=='string'||typeof root!=='string')return false;
 const normalized=path.resolve(file),parent=path.resolve(root);
 return normalized.startsWith(parent+path.sep) && !normalized.includes('..'+path.sep);
}
function managedInfo(id){
 const row=installs()[id];
 const home=process.platform==='win32'?WIN_ROOT:MAC_ROOT;
 if(!row||!row.managed||!ensureUnder(row.installedPath,home)||!fs.existsSync(row.installedPath))return null;
 if(process.platform==='win32'&&!row.installedPath.toLowerCase().endsWith('.exe'))return null;
 if(process.platform==='darwin'&&!row.installedPath.toLowerCase().endsWith('.app'))return null;
 return row;
}
function assetFor(id,rel,kind){
 const spec=adapters()[id]?.[process.platform];
 if(!spec||!['zip','zip-app','dmg','exe-portable'].includes(spec.kind)||!rel?.available||!Array.isArray(rel.assets))return null;
 let re;try{re=new RegExp(spec.asset,'i')}catch(_){return null}
 const matches=rel.assets.filter(a=>a?.sha256&&/^[a-f0-9]{64}$/i.test(a.sha256)&&a.size>1000&&a.size<800*1024*1024&&re.test(a.name));
 return matches.length===1?{...matches[0],kind:spec.kind}:null;
}
function portableFor(id,rel){
 let map;try{map=read(path.join(ROOT,'portable-assets.json')).projects||{}}catch(_){return null}
 const spec=map[id]?.[process.platform];
 if(!spec||!['zip','zip-app','exe-portable'].includes(spec.kind)||!rel?.available||!Array.isArray(rel.assets))return null;
 let re;try{re=new RegExp(spec.asset,'i')}catch(_){return null}
 const selected=rel.assets.filter(a=>a&&/^[a-f0-9]{64}$/i.test(a.sha256||'')&&a.size>1000&&a.size<800*1024*1024&&re.test(a.name));
 if(selected.length!==1)return null;
 const asset=selected[0];
 if(!asset.url?.startsWith('https://github.com/'+rel.repository+'/releases/download/'))return null;
 return {...asset,kind:spec.kind,note:spec.note||''};
}
function enrich(a){
 const index=releases(),entry=index.repositories?.[a.repo];
 const managed=managedInfo(a.repo),available=!!entry?.available,asset=assetFor(a.repo,entry);
 const portable=portableFor(a.repo,entry);
 const serverReady=fs.existsSync(CLIENT_INSTALLER);
 a.releaseStatus=available?(entry.pendingTag?'new-release-unverified':'release-source-tracked'):'repository-only';
 a.pendingTag=entry?.pendingTag||null;
 a.releaseTag=available?entry.tag:null;
 a.latestVersion=available?String(entry.tag).replace(/^v/i,''):null;
 a.publishedAt=available?entry.publishedAt:null;
 a.releaseUrl=available?entry.url:null;
 a.releaseBody=available?String(entry.body||'').slice(0,13000):'';
 a.releaseTitle=available?entry.releaseName||a.title:a.title;
 a.prerelease=available?!!entry.prerelease:false;
 a.releaseCheckedAt=entry?.checkedAt||index.collectedAt||null;
 a.platformAsset=asset?.name||null;
 a.assetBytes=asset?.size||null;
 a.assetSha256=asset?.sha256||null;
 a.installerKind=asset?.kind||null;
 a.downloadablePortable=!!(portable&&serverReady);
 a.portableAsset=portable?.name||null;
 a.portableBytes=portable?.size||null;
 a.portableHint=portable?.note||null;
 a.installable=!!(asset&&serverReady&&!entry.pendingTag);
 a.assetIssue=a.installable?(entry?.pendingTag?'A newer tag awaits SHA-256 verification; this package is the last verified release':''):entry?.pendingTag?'A newer release needs refreshed digest verification':
  !available?'No published GitHub release was identified':
  !adapters()[a.repo]?.[process.platform]?'No safe install adapter for this operating system':
  'No matching digest-verified package was published';
 a.installedPath=managed?.installedPath||null;
 a.installedVersion=managed?String(managed.version).replace(/^v/i,''):null;
 a.current=!!(managed&&available&&String(managed.version)===String(entry.tag));
 a.needsUpdate=!!(managed&&available&&String(managed.version)!==String(entry.tag)&&a.installable);
 a.upgradeBlocked=!!(managed&&entry?.pendingTag);
 a.installSource='github-release-sha256';
 return a;
}
function entries(base){
 const repoSet=new Set(base.map(x=>x.repo));
 const selected=[];
 for(const p of projects()){
  if(!p?.id||repoSet.has(p.id))continue;
  // All catalog entries must be under curator-reviewed GitHub owners.
  if(!/^[a-z][a-z0-9-]{1,79}$/.test(p.id)||
   !/^[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100}$/i.test(p.repository||''))continue;
  selected.push(p);
 }
 return selected;
}
function getMeta(repo){
 const p=projects().find(p=>p.id===repo);
 if(!p)return null;
 return enrich({repo:p.id,title:p.name,repository:p.repository,creator:p.creator,
  repoUrl:'https://github.com/'+p.repository,discovery:true,sourceId:'research-curated',
  group:p.group,category:p.category||null,challenges:p.challenges||[],competition:p.competition||[],deploymentType:p.deploymentType||'Desktop application',summary:p.summary,description:p.summary,
  original:(p.challenges||[]).join(', '),replacementType:p.replacementType,reportedMaturity:p.reportedMaturity,
  reportedPlatforms:p.reportedPlatforms||[],caveats:p.caveats||'',priority:p.priority||3,
  developmentStage:p.developmentStage||null,developmentSignal:p.developmentSignal||null,
  releaseChannel:p.releaseChannel||null,bleedingEdge:p.releaseChannel==='bleeding-edge',
  verifiedAt:p.verifiedAt||null,researchSources:p.sourceReports||[],isNew:true,officialIconStatus:p.officialIconStatus||'checking',
  stars:p.githubStarsAtReview??null,pushedAt:p.githubLastPushAtReview||null,
  license:typeof p.license==='string'?p.license:null});
}
function catalog(base){
 return entries(base).map(p=>getMeta(p.id)).filter(Boolean);
}
async function remoteRelease(repository){
 // Try the standard public GitHub API; Windows can also use the user's existing gh authentication.
 const url='https://api.github.com/repos/'+repository+'/releases/latest';
 let result,rateLimited=false;
 try{
  const response=await fetch(url,{headers:{'User-Agent':'ChallengerHub/2.4','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(11000)});
  if(response.status===403||response.status===429)rateLimited=true;
  if(response.ok)result=await response.json();
  else if(response.status!==404&&!rateLimited)throw Error('GitHub '+response.status);
 }catch(e){if(!rateLimited)throw e}
 if(!result&&process.platform==='win32'){
  try{result=JSON.parse(execFileSync('gh',['api','repos/'+repository+'/releases/latest'],{windowsHide:true,encoding:'utf8',timeout:14000,maxBuffer:6000000}))}
  catch(_){}
 }
 return {result,rateLimited};
}
async function atomTag(repository){
 const url='https://github.com/'+repository+'/releases.atom';
 try{
  const response=await fetch(url,{headers:{'User-Agent':'ChallengerHub/2.4'},signal:AbortSignal.timeout(9000)});
  if(!response.ok)return null;
  const data=(await response.text()).slice(0,250000);
  const match=data.match(/<entry>[\s\S]*?<link[^>]*href="https:\/\/github\.com\/[^"]+\/releases\/tag\/([^"]+)"/);
  return match?decodeURIComponent(match[1]).replace(/&amp;/g,'&'):null;
 }catch(_){return null}
}
function normalizedRelease(rel,repo,old){
 const allowed='https://github.com/'+repo+'/releases/download/';
 const assets=(rel.assets||[]).filter(a=>a&&a.browser_download_url?.startsWith(allowed)&&
  /^[A-Za-z0-9._+()-]{1,175}$/.test(a.name||'')).map(a=>({
  name:a.name,size:Number(a.size)||0,
  sha256:typeof a.digest==='string'&&/^sha256:[a-f0-9]{64}$/i.test(a.digest)?a.digest.slice(7).toLowerCase():null,
  url:a.browser_download_url
 }));
 return {repository:repo,available:true,tag:String(rel.tag_name),releaseName:String(rel.name||'').slice(0,200),
  prerelease:!!rel.prerelease,publishedAt:rel.published_at||null,url:rel.html_url||'https://github.com/'+repo+'/releases',
  body:String(rel.body||'').slice(0,13000),assets,checkedAt:new Date().toISOString(),mode:'source-refresh'};
}
async function refresh(force=false,logger=()=>{}){
 const cfg=config(),snapshot=releases();
 if(scanBusy||(!cfg.autoCheck&&!force))return {skipped:true,reason:'Disabled or already scanning'};
 if(!force&&Date.now()-Date.parse(snapshot.collectedAt||'')<cfg.intervalHours*3600000)return {skipped:true,reason:'Fresh cache'};
 scanBusy=true;lastSyncError='';let checked=0,updated=0,unverified=0,rateLimit=false;
 try{
  for(const p of projects()){
   const old=snapshot.repositories?.[p.id]||{},repo=p.repository;
   if(!/^[a-z0-9-]+\/[a-z0-9_.-]+$/i.test(repo||''))continue;
   try{
    const {result,rateLimited}=rateLimit?{result:null,rateLimited:true}:await remoteRelease(repo);
    if(rateLimited)rateLimit=true;
    if(result?.tag_name&&!result.draft){
      const next=normalizedRelease(result,repo,old);
      if(old.tag&&old.tag!==next.tag)updated++;
      snapshot.repositories[p.id]=next;
      checked++;
    }else{
      const tag=await atomTag(repo);
      if(tag&&old.tag&&tag!==old.tag){
       snapshot.repositories[p.id]={...old,pendingTag:tag,checkedAt:new Date().toISOString()};
       unverified++;
      }
    }
   }catch(e){lastSyncError=String(e.message).slice(0,120)}
  }
  if(Object.keys(snapshot.repositories||{}).length){
   snapshot.collectedAt=new Date().toISOString();
   const temp=REL_FILE+'.tmp';fs.writeFileSync(temp,JSON.stringify(snapshot,null,2)+'\n','utf8');fs.renameSync(temp,REL_FILE);
  }
  lastSyncAt=new Date().toISOString();sourcePending=unverified;
  logger('source',checked+' GitHub release feeds refreshed; '+updated+' changed; '+unverified+' unverified newer tags');
  return {checked,updated,unverified,rateLimited:rateLimit};
 }catch(e){lastSyncError=String(e.message);logger('error','Release tracking: '+lastSyncError);return {error:lastSyncError}}
 finally{scanBusy=false}
}
function status(){return {scanning:scanBusy,lastSyncAt:lastSyncAt||releases().collectedAt||null,error:lastSyncError,pendingUnverified:sourcePending,preferences:config()}}
function notes(repo){
 const app=getMeta(repo);if(!app)return null;
 return {repo,title:app.releaseTitle,tag:app.releaseTag,publishedAt:app.publishedAt,body:app.releaseBody,url:app.releaseUrl,error:app.releaseTag?null:'No official GitHub release connected'};
}
function history(repo){
 const app=getMeta(repo);if(!app)return null;
 const item=app.releaseTag?[{tag:app.releaseTag,title:app.releaseTitle,publishedAt:app.publishedAt,url:app.releaseUrl,prerelease:app.prerelease}]:[];
 return {repo,releases:item,stale:app.releaseStatus==='new-release-unverified',error:app.releaseStatus==='new-release-unverified'?'A newer tag awaits hash verification':null};
}
function craftPortableMeta(repo){
 const entry=releases().repositories?.[repo],p=portableFor(repo,entry);
 return {downloadablePortable:!!(p&&fs.existsSync(CLIENT_INSTALLER)),portableAsset:p?.name||null,portableBytes:p?.size||null,portableHint:p?.note||null};
}
module.exports={catalog,getMeta,refresh,status,config,setConfig,notes,history,managedInfo,craftPortableMeta,APP_ROOT:process.platform==='win32'?WIN_ROOT:MAC_ROOT};
