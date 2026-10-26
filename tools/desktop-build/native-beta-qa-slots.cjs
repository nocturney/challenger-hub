#!/usr/bin/env node
'use strict';
// An isolated, explicit QA-only version selector. Does not install, update,
// download, start, kill or mutate any application. No production path accepted.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const MARKER='native-beta-qa-root.json';
const STATE='active-slot.json';
const SAFE=/^Challenger-Beta-Slots(?:-[a-zA-Z0-9_-]+)?$/;
const SLOT=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const HEX=/^[a-f0-9]{64}$/i;
const SHA=/^[a-f0-9]{40}$/i;
const ROOT_SCHEMA='challenger.native.beta-slots.v1';

function refuse(message) { throw Error(message); }
function permittedRoot(arg) {
  if(typeof arg!=='string' || !arg.trim()) refuse('Explicit beta slot root required');
  const root=path.resolve(arg);
  if(!SAFE.test(path.basename(root))) refuse('Refusing non-beta path; root must be named Challenger-Beta-Slots[-name]');
  if(/(?:^|[\\/])(?:CraftSuite[\\/]Center|ChallengerHub Apps|Program Files|Windows|System32)(?:[\\/]|$)/i.test(root))
    refuse('Refusing production or operating-system destination');
  return root;
}
function noLink(file) {
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()) refuse('Symlink refused: '+file);
  return stat;
}
function slotRoot(root,id) {
  if(!SLOT.test(id)||id==='.'||id==='..') refuse('Invalid slot identifier');
  const folder=path.join(root,'slots',id);
  if(noLink(folder).isDirectory()!==true) refuse('Slot must be a real directory');
  return folder;
}
function safeEntry(root,relative) {
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)) refuse('Path escapes QA root');
  const elements=path.relative(root,file).split(path.sep);
  let current=root;
  for(const segment of elements){current=path.join(current,segment);noLink(current);}
  return file;
}
function loadRoot(arg) {
  const root=permittedRoot(arg);
  if(noLink(root).isDirectory()!==true) refuse('QA root is not a directory');
  if(fs.realpathSync(root)!==root) refuse('Non-canonical QA root refused');
  const marker=safeEntry(root,MARKER);
  const meta=JSON.parse(fs.readFileSync(marker,'utf8'));
  if(meta.schema!==ROOT_SCHEMA||meta.scope!=='isolated-developer-qa'||meta.productionDeployment!==false)
    refuse('Missing valid developer-only QA root marker');
  if(noLink(path.join(root,'slots')).isDirectory()!==true) refuse('Slots missing');
  return root;
}
function initialize(arg) {
  const root=permittedRoot(arg);
  if(fs.existsSync(root)) {
    noLink(root);
    if(fs.readdirSync(root).length) refuse('Refusing to initialize nonempty path');
  } else fs.mkdirSync(root);
  if(fs.realpathSync(root)!==root) refuse('QA root resolves via symlink');
  const marker={schema:ROOT_SCHEMA,scope:'isolated-developer-qa',
    productionDeployment:false,automaticInstallation:false,automaticUpdate:false};
  fs.writeFileSync(path.join(root,MARKER),JSON.stringify(marker,null,2)+'\n',{flag:'wx',mode:0o600});
  fs.mkdirSync(path.join(root,'slots'));
  return {root,initialized:true,policy:marker};
}
function loadState(root) {
  const file=path.join(root,STATE);
  if(!fs.existsSync(file))return {schema:ROOT_SCHEMA,active:null,previous:null,revision:0};
  const data=JSON.parse(fs.readFileSync(safeEntry(root,STATE),'utf8'));
  if(data.schema!==ROOT_SCHEMA||!Number.isSafeInteger(data.revision)||data.revision<0)refuse('Invalid slot state');
  for(const id of [data.active,data.previous]) if(id!==null&&!SLOT.test(id))refuse('Invalid slot state identifier');
  return data;
}
async function digest(file) {
  const hash=crypto.createHash('sha256');
  for await(const part of fs.createReadStream(file)){hash.update(part);}
  return hash.digest('hex');
}
async function verify(root,id) {
  const folder=slotRoot(root,id);
  const metaPath=safeEntry(folder,'BUILD_INFO.json');
  if(fs.statSync(metaPath).size>16000) refuse('Unexpected oversized BUILD_INFO');
  const meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
  if(meta.schema!=='challenger.portable.build.v1' ||
     meta.repository!=='velvet-workspace/challenger-hub' ||
     meta.channel!=='temporary-developer-preview' ||
     meta.publicRelease!==false || meta.noUserInstallation!==true)
    refuse('Only canonical non-public developer artifacts are eligible');
  if(!SHA.test(meta.pullRequestHeadCommit)||!SHA.test(meta.checkoutCommit) ||
     !HEX.test(meta.archiveSha256) ||
     !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(meta.appVersion))
    refuse('Missing pinned source/version/archive identity');
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,210}\.zip$/.test(meta.archiveFilename))
    refuse('Unsafe or missing archive filename');
  const platform=meta.platform;
  let binaryRelative;
  if(platform==='windows-x64')
    binaryRelative=path.join('portable','ChallengerHubNativePreview-Win','challenger-slint-rust-host.exe');
  else if(platform==='macos-arm64')
    binaryRelative=path.join('extracted','ChallengerHubNativePreview.app','Contents','MacOS','challenger-slint-rust-host');
  else refuse('Unsupported QA bundle platform');
  const archive=safeEntry(folder,meta.archiveFilename);
  const bytes=fs.statSync(archive).size;
  if(bytes<1000000||bytes>500000000||meta.archiveSizeBytes!==bytes)
    refuse('Archive size metadata mismatch');
  const actual=await digest(archive);
  if(actual!==meta.archiveSha256.toLowerCase()) refuse('Archive SHA-256 mismatch');
  const binary=safeEntry(folder,binaryRelative);
  if(!noLink(binary).isFile()) refuse('QA binary missing');
  return {id,appVersion:meta.appVersion,platform,checkoutCommit:meta.checkoutCommit,
    pullRequestHeadCommit:meta.pullRequestHeadCommit,archiveSha256:actual,archiveSizeBytes:bytes,
    archive,binary,publicRelease:false,automaticInstallation:false};
}
async function stateReport(root) {
  const state=loadState(root);
  return {schema:ROOT_SCHEMA,root,revision:state.revision,
    active:state.active?await verify(root,state.active):null,
    previous:state.previous?await verify(root,state.previous):null,
    deployed:false,automaticUpdates:false};
}
async function transaction(root,desired) {
  const lock=path.join(root,'selection.lock');
  let descriptor;
  try{descriptor=fs.openSync(lock,'wx',0o600);}catch{refuse('QA selection locked; inspect before recovery');}
  try {
    const state=loadState(root);
    const active=state.active;
    const target=desired==='rollback'?state.previous:desired;
    if(target===null) refuse('No previous QA slot to roll back to');
    if(target!==active) {
      await verify(root,target);
      if(active) await verify(root,active);
      const next={schema:ROOT_SCHEMA,active:target,previous:active,revision:state.revision+1};
      const temp=path.join(root,'selection-next-'+process.pid+'.json');
      try {
        fs.writeFileSync(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:0o600});
        fs.renameSync(temp,path.join(root,STATE));
      } finally { if(fs.existsSync(temp))fs.unlinkSync(temp); }
    }
    return await stateReport(root);
  } finally {fs.closeSync(descriptor);fs.unlinkSync(lock);}
}
async function main(args) {
  const [command,rootArg,id,...extra]=args;
  if(extra.length)refuse('Unexpected arguments');
  if(command==='init'){if(id)refuse('Unexpected slot argument for init');return initialize(rootArg);}
  const root=loadRoot(rootArg);
  if(command==='verify'){if(!id)refuse('Slot required');return await verify(root,id);}
  if(command==='activate'){if(!id)refuse('Slot required');return await transaction(root,id);}
  if(command==='rollback'){if(id)refuse('Rollback takes no slot');return await transaction(root,'rollback');}
  if(command==='status'){if(id)refuse('Status takes no slot');return await stateReport(root);}
  if(command==='resolve'){
    if(id)refuse('Resolve takes no slot');
    const status=await stateReport(root);
    if(!status.active)refuse('No active QA slot');
    return {binary:status.active.binary,version:status.active.appVersion,checksum:status.active.archiveSha256,
      executableWasNotLaunched:true,productionUntouched:true};
  }
  refuse('Usage: node native-beta-qa-slots.cjs <init|verify|activate|rollback|status|resolve> <Challenger-Beta-Slots[-name] path> [slot]');
}
if(require.main===module)main(process.argv.slice(2)).then(x=>console.log(JSON.stringify(x,null,2)))
  .catch(e=>{console.error('QA_SLOT_REFUSED: '+e.message);process.exitCode=1;});
module.exports={initialize,loadRoot,verify,transaction,stateReport,permittedRoot};
