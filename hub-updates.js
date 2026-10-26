'use strict';
// Source-trusted, read-only self-update discovery; never executes or installs a binary.
const fs=require('node:fs'),path=require('node:path');
const {promisify}=require('node:util'),{execFile}=require('node:child_process');
const run=promisify(execFile);
const OFFICIAL='https://github.com/velvet-workspace/challenger-hub';
const API='https://api.github.com/repos/velvet-workspace/challenger-hub/releases?per_page=30';
const TAG=/^v4\.0\.0-orbit-preview\.(\d{1,3})$/;
const MB=1024*1024,CACHE_MS=30*60*1000;
function localVersion(root){
 try {
  const j=JSON.parse(fs.readFileSync(path.join(root,'desktop-manifest.json'),'utf8'));
  const match=/^4\.0\.0-desktop\.preview\.(\d{1,3})$/.exec(j.version||'');
  if(match)return {version:j.version,tag:'v4.0.0-orbit-preview.'+match[1],preview:Number(match[1])};
 }catch(_){}
 return {version:'development',tag:null,preview:0};
}
function vettedReleases(input,platform='win32'){
 if(!Array.isArray(input))throw Error('GitHub release index not an array');
 const output=[];
 for(const release of input.slice(0,30)){
  if(!release||release.draft||release.prerelease!==true)continue;
  const match=TAG.exec(release.tag_name||'');if(!match)continue;
  const preview=Number(match[1]);
  const tag=release.tag_name,assetName=platform==='win32'?'ChallengerFocusDesktopPreview'+preview+'.exe':null;
  if(!assetName)continue; // only Windows channel supported
  const asset=release.assets?.find(a=>a.name===assetName);
  const expected=OFFICIAL+'/releases/download/'+tag+'/'+assetName;
  if(!asset||asset.browser_download_url!==expected||asset.size<25*MB||asset.size>350*MB)continue;
  if(!/^sha256:[a-f0-9]{64}$/i.test(asset.digest||''))continue; // no unverifiable automatic offer
  output.push({tag,preview,version:'4.0.0-desktop.preview.'+preview,
   publishedAt:release.published_at||null,releaseUrl:OFFICIAL+'/releases/tag/'+tag,
   downloadUrl:asset.browser_download_url,sha256:asset.digest.slice(7).toLowerCase(),
   bytes:asset.size});
 }
 return output.sort((a,b)=>b.preview-a.preview);
}
function makeUpdateChecker({root,fetcher,cli='gh',clock=()=>Date.now(),intervalMs=CACHE_MS}={}){
 if(!root)throw Error('Missing app directory');
 const current=localVersion(root);
 let snapshot=null,checked=0,pending=null;
 async function fetchReleases(){
  if(fetcher)return fetcher();
  try{
   const {stdout}=await run(cli,['api','/repos/velvet-workspace/challenger-hub/releases?per_page=30',
    '-H','Accept: application/vnd.github+json'],{windowsHide:true,timeout:19000,maxBuffer:7*MB});
   return JSON.parse(stdout);
  }catch(_){ /* Authenticated GitHub CLI optional on end-user machines. */ }
  const response=await fetch(API,{headers:{'Accept':'application/vnd.github+json',
    'User-Agent':'ChallengerHubSelfUpdate/1.0'},signal:AbortSignal.timeout(14000)});
  if(!response.ok)throw Error('GitHub releases unavailable (HTTP '+response.status+')');
  return response.json();
 }
 async function check({force=false}={}){
  if(pending)return pending;
  // A manual check bypasses the long cache after 90 seconds, without rate-limit spam.
  if(snapshot&&clock()-checked<(force?90000:intervalMs))return {...snapshot,cached:true};
  pending=(async()=>{
   try{
    const releases=vettedReleases(await fetchReleases());
    const newest=releases[0]||null;
    const upgrade=releases.find(x=>x.preview>current.preview)||null;
    snapshot={ok:true,currentVersion:current.version,currentTag:current.tag,
      updateAvailable:!!upgrade,latest:newest,upgrade,checkedAt:new Date(clock()).toISOString(),
      source:OFFICIAL+'/releases',channel:'windows-test-preview',installationAutomatic:false};
   }catch(e){
    snapshot={ok:false,currentVersion:current.version,currentTag:current.tag,
      updateAvailable:false,latest:null,upgrade:null,checkedAt:new Date(clock()).toISOString(),
      source:OFFICIAL+'/releases',channel:'windows-test-preview',
      installationAutomatic:false,error:String(e.message).slice(0,160)};
   }
   checked=clock();return {...snapshot,cached:false};
  })().finally(()=>{pending=null});
  return pending;
 }
 return {check,localVersion:()=>current};
}
module.exports={localVersion,vettedReleases,makeUpdateChecker};
