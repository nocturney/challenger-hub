// Explicitly approved native bridge for the existing Challenger verified worker.
// Plan is read-only; install requires a hash of the precise reviewed plan.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const defaultRuntime=path.resolve(root,'../../..','tools/desktop-build/dist/runtime-preview12');
const runtime=process.env.CHALLENGER_PREVIEW_RUNTIME
  ? path.resolve(process.env.CHALLENGER_PREVIEW_RUNTIME) : defaultRuntime;
const LIMIT=800*1024*1024;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const assert=(v,m)=>{if(!v)throw Error(m)};
const idOk=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{1,79}$/.test(x);
const repoOk=x=>typeof x==='string'&&/^[a-z0-9_.-]{1,85}\/[a-z0-9_.-]{1,100}$/i.test(x);
const hashOk=x=>typeof x==='string'&&/^[a-f0-9]{64}$/i.test(x);
function secureUrl(raw,host,prefix){
  const u=new URL(raw);
  assert(u.protocol==='https:'&&u.host===host&&!u.username&&!u.password
    &&!u.port&&!u.search&&!u.hash&&u.pathname.startsWith(prefix),
    'Unapproved release URL');
  return u;
}

export function reviewedSource(projectId,{registry,adapters,managed,portable,
    platform=process.platform,arch=process.arch}){
  // Exact source-reviewed exception for the managed PdfCraft Windows x64 portable ZIP.
  // Never promote generic managed entries or research candidates to installable.
  if(projectId==='managed:pdfcraft'){
    assert(platform==='win32'&&arch==='x64','PdfCraft native install requires Windows x64');
    const entries=managed?.apps?.filter(a=>a.repo==='pdfcraft'&&a.title==='PdfCraft'&&
      a.repoUrl==='https://github.com/storytold/pdfcraft');
    assert(entries?.length===1,'Missing or ambiguous pinned managed PdfCraft source');
    assert(portable?.schema==='challenger-portable.v1',
      'Missing reviewed portable asset allowlist');
    const spec=portable.projects?.pdfcraft?.win32;
    assert(spec?.kind==='zip' &&
      spec.asset===String.raw`^pdfcraft-[^/]+-windows-x64-portable\.zip$` &&
      spec.exeHint==='pdfcraft','PdfCraft Windows portable adapter is not reviewed');
    return {id:'pdfcraft',projectId,repository:'storytold/pdfcraft',
      name:'PdfCraft',spec,platform,arch};
  }
  assert(typeof projectId==='string'&&projectId.startsWith('curated:'),
    'Only curated sources or vetted managed PdfCraft can be installed');
  const id=projectId.slice(8);
  assert(idOk(id),'Invalid vetted project ID');
  assert(['win32','darwin'].includes(platform),'No vetted installer on this OS');
  assert(platform!=='darwin'||arch==='arm64','Mac installer requires Apple Silicon');
  assert(registry&&Array.isArray(registry.projects)&&adapters?.schema==='challenger-adapters.v1',
    'Missing reviewed registry or adapter manifest');
  const found=registry.projects.filter(p=>p?.id===id);
  assert(found.length===1&&repoOk(found[0].repository),
    'Missing or ambiguous source project repository');
  const project=found[0];
  assert(!project.installAdapter&&!project.installable,
    'Source record is not approved for direct install');
  const spec=adapters.projects?.[id]?.[platform];
  assert(spec&&['zip','dmg','zip-app','exe-portable'].includes(spec.kind),
    'No reviewed install adapter for this OS and source project');
  assert(typeof spec.asset==='string'&&spec.asset.startsWith('^')&&
    spec.asset.endsWith('$')&&spec.asset.length<200,'Unbounded asset selection');
  return {id,projectId,repository:project.repository,
    name:String(project.name||id).slice(0,100),spec,platform,arch};
}

export function reviewOfficialRelease(source,release){
  assert(release&&typeof release==='object'&&!release.draft&&!release.prerelease,
    'Draft or prerelease is not an installable approved release');
  const tag=String(release.tag_name||'');
  assert(/^[A-Za-z0-9][A-Za-z0-9._+-]{0,99}$/.test(tag),
    'Release tag not compatible with reviewed worker');
  const prefix='/'+source.repository+'/releases/';
  const releaseUrl=secureUrl(release.html_url,'github.com',prefix+'tag/');
  assert(decodeURIComponent(releaseUrl.pathname.slice((prefix+'tag/').length))===tag,
    'Official release page tag mismatch');
  const matching=(release.assets||[]).filter(a=>{
    if(!a||typeof a.name!=='string'||!/^[-A-Za-z0-9._+()]{1,175}$/.test(a.name)||
       !new RegExp(source.spec.asset,'i').test(a.name)||
       !/^sha256:[a-f0-9]{64}$/i.test(a.digest||'')||
       !(Number(a.size)>1000&&Number(a.size)<LIMIT))return false;
    try{
      const u=secureUrl(a.browser_download_url,'github.com',
        prefix+'download/'+encodeURIComponent(tag)+'/');
      return decodeURIComponent(u.pathname.split('/').at(-1))===a.name;
    }catch{return false;}
  });
  assert(matching.length===1,'No unique digest-verified compatible GitHub Release asset');
  const a=matching[0];
  const destination=source.platform==='darwin'
    ? path.join(os.homedir(),'Applications','ChallengerHub Apps')
    : 'D:\\Velvet\\Installers\\ChallengerHub\\Managed';
  const plan={schema:'challenger.native.install-plan.v1',projectId:source.projectId,
    id:source.id,name:source.name,repository:source.repository,
    platform:source.platform,arch:source.arch,tag,kind:source.spec.kind,
    assetName:a.name,assetSize:Number(a.size),sha256:a.digest.slice(7).toLowerCase(),
    downloadURL:a.browser_download_url,destination,
    requiresUserApproval:true,sourceDigestVerifiedAfterDownload:false};
  const approvalToken=crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return {...plan,approvalToken};
}

export async function fetchPlan(projectId,{runtimeRoot=runtime,releaseOverride=null,
    platform=process.platform,arch=process.arch}={}){
  const managedPdf=projectId==='managed:pdfcraft';
  const source=reviewedSource(projectId,{
    registry:read(path.join(runtimeRoot,'challengers.json')),
    adapters:read(path.join(runtimeRoot,'adapters.json')),platform,arch,
    managed:managedPdf?read(path.join(runtimeRoot,'catalog-cache.json')):null,
    portable:managedPdf?read(path.join(runtimeRoot,'portable-assets.json')):null
  });
  if(platform==='win32')assert(fs.existsSync('D:\\'),
    'Approved Windows application destination drive D: is unavailable');
  let release=releaseOverride;
  if(!release){
    const uri='https://api.github.com/repos/'+source.repository+'/releases/latest';
    const response=await fetch(uri,{redirect:'error',headers:{
      'User-Agent':'ChallengerNativePreview/0.1',
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'
    },signal:AbortSignal.timeout(15000)});
    assert(response.ok,'Official GitHub release lookup failed (HTTP '+response.status+')');
    const raw=await response.text();assert(raw.length<2_000_000,'Oversized metadata');
    release=JSON.parse(raw);
  }
  return reviewOfficialRelease(source,release);
}

function requireNormalUser(){
  assert(process.platform==='darwin'||process.platform==='win32',
    'No vetted installer for this operating system');
  if(typeof process.getuid==='function')assert(process.getuid()!==0,
    'Do not run the native installer as root');
  if(process.platform==='win32'){
    const who=execFileSync('whoami.exe',['/user'],{
      encoding:'utf8',windowsHide:true,timeout:5000});
    assert(!who.includes('S-1-5-18'),
      'Do not run the native installer as Windows SYSTEM Session 0');
  }
}
function userState(){
  const base=process.platform==='darwin'
    ? path.join(os.homedir(),'Library','Application Support','ChallengerNativePreview')
    : path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),
       'ChallengerNativePreview');
  return path.join(base,'install-state');
}
// Append-only records of approved native installs. This is NOT a live
// background worker queue or proof that a previously installed app still runs.
const HISTORY_SCHEMA='challenger.native.install-history.v1';
const HISTORY_LIMIT=512*1024;
const HISTORY_STATES=new Set(['STARTED','COMPLETED','FAILED','CANCELED']);
function historyFile(base){return path.join(base,'install-history.jsonl')}
function validateHistoryEvent(e){
  assert(e&&e.schema===HISTORY_SCHEMA&&
    typeof e.runId==='string'&&/^[a-f0-9-]{36}$/i.test(e.runId)&&
    typeof e.projectId==='string'&&
      /^(curated:[a-z][a-z0-9-]{1,79}|managed:pdfcraft)$/.test(e.projectId)&&
    typeof e.tag==='string'&&/^[A-Za-z0-9][A-Za-z0-9._+-]{0,99}$/.test(e.tag)&&
    hashOk(e.sha256)&&HISTORY_STATES.has(e.state)&&
    typeof e.timestamp==='string'&&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.timestamp),
    'Malformed installation history record');
}
function safeHistoryPath(base){
  if(!fs.existsSync(base))return historyFile(base);
  const parent=fs.lstatSync(base);
  assert(parent.isDirectory()&&!parent.isSymbolicLink(),
    'Untrusted installation history parent');
  const file=historyFile(base);
  if(fs.existsSync(file)){
    const st=fs.lstatSync(file);
    assert(st.isFile()&&!st.isSymbolicLink()&&st.size<=HISTORY_LIMIT,
      'Untrusted or oversized installation history file');
  }
  return file;
}
export function appendInstallHistory(base,event){
  // Explicit allowlist: never persist approval tokens, file paths or raw errors.
  const record={schema:HISTORY_SCHEMA,runId:event?.runId,
    projectId:event?.projectId,tag:event?.tag,sha256:event?.sha256,
    state:event?.state,timestamp:event?.timestamp};
  validateHistoryEvent(record);
  const file=safeHistoryPath(base);
  const line=JSON.stringify(record)+'\n';
  assert(Buffer.byteLength(line,'utf8')<=1024,'Oversized installation history event');
  const size=fs.existsSync(file)?fs.statSync(file).size:0;
  if(size){
    const reader=fs.openSync(file,'r'),last=Buffer.alloc(1);
    try{fs.readSync(reader,last,0,1,size-1);}finally{fs.closeSync(reader);}
    assert(last[0]===10,'History ends in an incomplete record; manual review required');
  }
  assert(size+Buffer.byteLength(line,'utf8')<=HISTORY_LIMIT,
    'Installation history is full; preserve and archive it before new installs');
  const flags=fs.constants.O_WRONLY|fs.constants.O_APPEND|fs.constants.O_CREAT|
    (fs.constants.O_NOFOLLOW||0);
  const fd=fs.openSync(file,flags,0o600);
  try{
    assert(fs.writeSync(fd,line)===Buffer.byteLength(line,'utf8'),
      'Short installation history append');
    fs.fsyncSync(fd);
  }finally{fs.closeSync(fd);}
}
export function readInstallHistory(base){
  const file=safeHistoryPath(base);
  if(!fs.existsSync(file))return {schema:HISTORY_SCHEMA,entries:[],incomplete:false};
  const raw=fs.readFileSync(file,'utf8');
  let lines=raw.split('\n'),incomplete=false;
  if(!raw.endsWith('\n')){incomplete=true;lines.pop();}
  const runs=new Map();
  for(const line of lines){
    if(!line)continue;
    assert(Buffer.byteLength(line,'utf8')<=1024,'Oversized history line');
    const item=JSON.parse(line);
    validateHistoryEvent(item);
    let current=runs.get(item.runId);
    if(current){
      assert(current.projectId===item.projectId &&
        current.tag===item.tag && current.sha256===item.sha256,
        'Inconsistent installation history run');
      assert(current.state==='STARTED','Duplicate terminal history record');
      current.state=item.state;
      current.timestamp=item.timestamp;
    }else{
      assert(item.state==='STARTED','History terminal record without approved start');
      runs.set(item.runId,{runId:item.runId,projectId:item.projectId,
        tag:item.tag,sha256:item.sha256,timestamp:item.timestamp,
        state:item.state});
    }
  }
  const entries=[...runs.values()].map(x=>({
    ...x,state:x.state==='STARTED'?'UNRESOLVED':x.state
  })).sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,30);
  return {schema:HISTORY_SCHEMA,entries,incomplete};
}
async function install(projectId,token){
  assert(hashOk(token),'Missing exact user-approved release token');
  requireNormalUser();
  let cancellationRequested=false,activeWorker=null,input='';
  const onCancelInput=bytes=>{
    // Local Native host pipe only. Never force-kill the child during commit.
    const chunk=bytes.toString('utf8');
    if(input.length+chunk.length>64){input='';return;}
    input+=chunk;
    if(!input.includes('cancel\n'))return;
    input='';
    cancellationRequested=true;
    if(activeWorker?.stdin?.writable){
      activeWorker.stdin.write('cancel\n',()=>{});
    }
  };
  process.stdin.on('data',onCancelInput);
  process.stdin.resume();
  try{
  const plan=await fetchPlan(projectId);
  assert(plan.approvalToken===token,'Release changed since approval; review again');
  if(cancellationRequested)throw Error('INSTALL_CANCELLED_BEFORE_COMMIT');
  const base=userState();
  fs.mkdirSync(base,{recursive:true,mode:0o700});
  assert(fs.lstatSync(base).isDirectory()&&!fs.lstatSync(base).isSymbolicLink(),
    'Unsafe native install state folder');
  const lock=path.join(base,'.install.lock');
  const fd=fs.openSync(lock,'wx',0o600);
  let sandbox=null,attemptStarted=false;
  const runId=crypto.randomUUID();
  const historyBase={runId,projectId:plan.projectId,tag:plan.tag,sha256:plan.sha256};
  try{
    sandbox=fs.mkdtempSync(path.join(base,'run-'));
    appendInstallHistory(base,{...historyBase,state:'STARTED',timestamp:new Date().toISOString()});
    attemptStarted=true;
    // Copy ORIGINAL vetted worker byte-for-byte to a separate user-owned
    // staging folder. No change to Production, Preview11 or packaged resources.
    const workerFiles=['Install-Challenger.js','challengers.json','adapters.json'];
    if(plan.projectId==='managed:pdfcraft')workerFiles.push('portable-assets.json');
    for(const filename of workerFiles)
      fs.copyFileSync(path.join(runtime,filename),path.join(sandbox,filename));
    const existing=path.join(base,'managed-installs.json');
    if(fs.existsSync(existing))
      fs.copyFileSync(existing,path.join(sandbox,'managed-installs.json'));
    const snapshot={schema:'challenger-releases.v1',collectedAt:new Date().toISOString(),
      repositories:{[plan.id]:{repository:plan.repository,available:true,
        tag:plan.tag,pendingTag:null,assets:[{name:plan.assetName,size:plan.assetSize,
          sha256:plan.sha256,url:plan.downloadURL}]}}};
    fs.writeFileSync(path.join(sandbox,'release-index.json'),JSON.stringify(snapshot),{mode:0o600});
    console.log(JSON.stringify({state:'approved',detail:'Explicit approved install: '+plan.name+' '+plan.tag}));
    const args=[path.join(sandbox,'Install-Challenger.js'),plan.id,'--native-approved-install'];
    if(plan.projectId==='managed:pdfcraft')args.push('--native-pdfcraft-install');
    const child=spawn(process.execPath,args,{
      cwd:sandbox,windowsHide:true,stdio:['pipe','pipe','pipe'],
      env:{...process.env,NODE_OPTIONS:'',NODE_PATH:''}
    });
    activeWorker=child;
    // An EPIPE after the worker has already committed must not crash the
    // trusted parent. Only the worker's own terminal record determines outcome.
    child.stdin.on('error',()=>{});
    if(cancellationRequested && child.stdin.writable)
      child.stdin.write('cancel\n',()=>{});
    let confirmedWorkerCancellation=false;
    const copyLines=(stream,kind)=>new Promise((resolve,reject)=>{
      let partial='',count=0;
      stream.on('data',bytes=>{
        partial+=bytes.toString();
        if(partial.length>10000)partial=partial.slice(-10000);
        let n;
        while((n=partial.indexOf('\n'))>=0){
          const line=partial.slice(0,n);partial=partial.slice(n+1);
          if(kind==='worker' && cancellationRequested){
            try {if(JSON.parse(line).state==='cancelled')confirmedWorkerCancellation=true;}
            catch {}
          }
          if(++count<=160)console.log(JSON.stringify({state:kind,detail:line.slice(0,300)}));
        }
      });
      stream.on('error',reject);stream.on('end',resolve);
    });
    const outputs=[copyLines(child.stdout,'worker'),copyLines(child.stderr,'worker-error')];
    const code=await new Promise((resolve,reject)=>{
      child.on('close',resolve);child.on('error',reject);
    });
    await Promise.all(outputs);
    if(code!==0 && cancellationRequested && confirmedWorkerCancellation)
      throw Error('INSTALL_CANCELLED_BEFORE_COMMIT');
    assert(code===0,'Vetted installer reported failure (exit '+code+')');
    const state=read(path.join(sandbox,'managed-installs.json'));
    const verified=state?.installed?.[plan.id];
    assert(verified?.repository===plan.repository&&verified?.sha256===plan.sha256&&
      verified?.version===plan.tag&&verified?.managed===true,
      'Worker failed to record this exact verified app');
    const next=path.join(base,'managed-installs.next');
    fs.writeFileSync(next,JSON.stringify(state,null,2)+'\n',{mode:0o600});
    fs.renameSync(next,existing);
    let historyPersisted=true;
    try {
      appendInstallHistory(base,{...historyBase,state:'COMPLETED',timestamp:new Date().toISOString()});
    }catch(e){
      historyPersisted=false;
      // The app and managed record were already committed. Never report a
      // false install failure just because the secondary history append failed.
      console.log(JSON.stringify({state:'history-warning',
        detail:'Install succeeded, but durable history could not be updated'}));
    }
    console.log(JSON.stringify({schema:'challenger.native.install-result.v1',
      state:'success',projectId:plan.projectId,tag:plan.tag,sha256:plan.sha256,
      installedPath:verified.installedPath,sourceDigestVerified:true,historyPersisted}));
  }catch(e){
    if(attemptStarted){
      const state=String(e.message).includes('INSTALL_CANCELLED_BEFORE_COMMIT')
        ?'CANCELED':'FAILED';
      try {appendInstallHistory(base,{...historyBase,state,timestamp:new Date().toISOString()});}
      catch(historyError){console.error('NATIVE_HISTORY_WRITE_FAILED '+String(historyError.message).slice(0,120));}
    }
    throw e;
  }finally{
    try{if(sandbox)fs.rmSync(sandbox,{recursive:true,force:true});}
    catch(e){console.error('NATIVE_STAGING_CLEANUP_WARNING '+String(e.message).slice(0,120));}
    try{fs.closeSync(fd);}finally{fs.rmSync(lock,{force:true});}
  }
  }finally{
    process.stdin.off('data',onCancelInput);
    process.stdin.pause();
  }
}
async function cli(){
  const [mode,projectId,token,...extra]=process.argv.slice(2);
  assert(!extra.length,'Unexpected install arguments');
  if(mode==='history'&&!projectId&&!token){
    console.log(JSON.stringify(readInstallHistory(userState())));return;
  }
  if(mode==='plan'&&!token){console.log(JSON.stringify(await fetchPlan(projectId)));return;}
  if(mode==='install'&&token){await install(projectId,token);return;}
  throw Error('Usage: install-bridge.mjs plan <reviewed-id> | install <reviewed-id> <approved-token>');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  cli().catch(e=>{
    console.error('NATIVE_INSTALL_REFUSED '+String(e.message).slice(0,260));process.exitCode=1;
  });
