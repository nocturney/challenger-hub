'use strict';
/* Explicit, read-only, cross-platform availability. This module never grants install authority.
 * Source platform claims, reviewed adapter definitions and actual local install readiness
 * are different facts. Never infer OS support from repository name, popularity or asset names. */
const fs=require('node:fs'),path=require('node:path');
const PLATFORMS=Object.freeze({
 win32:Object.freeze({label:'Windows',keys:/\bwindows\b|\bwin(?:32|64)\b/i}),
 darwin:Object.freeze({label:'macOS',keys:/\bmacos\b|\bmac\s*os\b|\bos\s*x\b|\bapple\s+silicon\b/i}),
 linux:Object.freeze({label:'Linux',keys:/\blinux\b|\bubuntu\b|\bdebian\b|\bfedora\b|\bappimage\b/i})
});
function safeManifest(directory,name,schema){
 try{
  const file=path.join(directory,name),data=JSON.parse(fs.readFileSync(file,'utf8'));
  if(data?.schema===schema && data.projects && typeof data.projects==='object' && !Array.isArray(data.projects))
   return data.projects;
 }catch{}
 return {};
}
function claimsFor(app){
 const names=[...(Array.isArray(app?.reportedPlatforms)?app.reportedPlatforms:[]),
  ...(Array.isArray(app?.platforms)?app.platforms:[])].filter(s=>typeof s==='string'&&s.length<150);
 return names;
}
function describe(app,{currentPlatform=process.platform,currentArch=process.arch,adapters={},portables={}}={}){
 const id=String(app?.repo||''),claims=claimsFor(app),policy=adapters[id]||{},download=portables[id]||{};
 const entries={};
 for(const [os,p] of Object.entries(PLATFORMS)){
  const claim=claims.filter(c=>p.keys.test(c));
  const reviewedInstaller=!!(policy[os]?.kind&&policy[os]?.asset);
  const reviewedPortable=!!(download[os]?.kind&&download[os]?.asset);
  const onComputer=os===currentPlatform;
  // Runtime approval remains exclusively owned by the audited backend and installer.
  const installReady=onComputer&&app?.installable===true&&app?.researchPendingVerification!==true;
  const portableReady=onComputer&&app?.downloadablePortable===true&&app?.researchPendingVerification!==true;
  const state=installReady?'install-ready':portableReady?'portable-ready':
   reviewedInstaller||reviewedPortable?'adapter-reviewed':claim.length?'reported':'unknown';
  entries[os]={
   label:p.label,state,reported:claim.length>0,reportedText:claim.slice(0,3),
   reviewedInstaller,reviewedPortable,
   installReady,portableReady,
   installApprovalRequired:true,
   evidence:installReady||portableReady?'verified-local-backend':
    reviewedInstaller||reviewedPortable?'reviewed-policy-only':claim.length?'curated-report-only':'not-established'
  };
 }
 return {
  schema:'challenger-platform-availability.v1',currentPlatform,currentArch,
  entries,autoInstallAllowed:false,
  note:'Claims, reviewed adapters and runnable install rights are distinct. Availability is not approval.'
 };
}
function create({root=__dirname,currentPlatform=process.platform,currentArch=process.arch}={}){
 const adapters=safeManifest(root,'adapters.json','challenger-adapters.v1'),
  portables=safeManifest(root,'portable-assets.json','challenger-portable.v1');
 return app=>describe(app,{currentPlatform,currentArch,adapters,portables});
}
module.exports={PLATFORMS,claimsFor,describe,create,safeManifest};
