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

export function reviewedSource(projectId,{registry,adapters,
    platform=process.platform,arch=process.arch}){
  assert(typeof projectId==='string'&&projectId.startsWith('curated:'),
    'Only curated source projects can be installed');
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
  const source=reviewedSource(projectId,{
    registry:read(path.join(runtimeRoot,'challengers.json')),
    adapters:read(path.join(runtimeRoot,'adapters.json')),platform,arch
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
async function install(projectId,token){
  assert(hashOk(token),'Missing exact user-approved release token');
  requireNormalUser();
  const plan=await fetchPlan(projectId);
  assert(plan.approvalToken===token,'Release changed since approval; review again');
  const base=userState();
  fs.mkdirSync(base,{recursive:true,mode:0o700});
  assert(fs.lstatSync(base).isDirectory()&&!fs.lstatSync(base).isSymbolicLink(),
    'Unsafe native install state folder');
  const lock=path.join(base,'.install.lock');
  const fd=fs.openSync(lock,'wx',0o600);
  const sandbox=fs.mkdtempSync(path.join(base,'run-'));
  try{
    // Copy ORIGINAL vetted worker byte-for-byte to a separate user-owned
    // staging folder. No change to Production, Preview11 or packaged resources.
    for(const filename of ['Install-Challenger.js','challengers.json','adapters.json'])
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
    const child=spawn(process.execPath,[path.join(sandbox,'Install-Challenger.js'),plan.id],{
      cwd:sandbox,windowsHide:true,stdio:['ignore','pipe','pipe'],
      env:{...process.env,NODE_OPTIONS:'',NODE_PATH:''}
    });
    const copyLines=(stream,kind)=>new Promise((resolve,reject)=>{
      let partial='',count=0;
      stream.on('data',bytes=>{
        partial+=bytes.toString();
        if(partial.length>10000)partial=partial.slice(-10000);
        let n;
        while((n=partial.indexOf('\n'))>=0){
          const line=partial.slice(0,n);partial=partial.slice(n+1);
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
    assert(code===0,'Vetted installer reported failure (exit '+code+')');
    const state=read(path.join(sandbox,'managed-installs.json'));
    const verified=state?.installed?.[plan.id];
    assert(verified?.repository===plan.repository&&verified?.sha256===plan.sha256&&
      verified?.version===plan.tag&&verified?.managed===true,
      'Worker failed to record this exact verified app');
    const next=path.join(base,'managed-installs.next');
    fs.writeFileSync(next,JSON.stringify(state,null,2)+'\n',{mode:0o600});
    fs.renameSync(next,existing);
    console.log(JSON.stringify({schema:'challenger.native.install-result.v1',
      state:'success',projectId:plan.projectId,tag:plan.tag,sha256:plan.sha256,
      installedPath:verified.installedPath,sourceDigestVerified:true}));
  }finally{
    fs.rmSync(sandbox,{recursive:true,force:true});
    fs.closeSync(fd);fs.rmSync(lock,{force:true});
  }
}
async function cli(){
  const [mode,projectId,token,...extra]=process.argv.slice(2);
  assert(!extra.length,'Unexpected install arguments');
  if(mode==='plan'&&!token){console.log(JSON.stringify(await fetchPlan(projectId)));return;}
  if(mode==='install'&&token){await install(projectId,token);return;}
  throw Error('Usage: install-bridge.mjs plan <curated:id> | install <curated:id> <approved-token>');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  cli().catch(e=>{
    console.error('NATIVE_INSTALL_REFUSED '+String(e.message).slice(0,260));process.exitCode=1;
  });
