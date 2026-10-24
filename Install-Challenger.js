'use strict';
// Challenger Hub: explicit SHA-256 verified GitHub release adapters for portable apps.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const ROOT=__dirname,ID=String(process.argv[2]||''),DRY=process.argv.includes('--verify-only'),PLATFORM=process.platform;
const PORTABLE=process.argv.includes('--download-only');
// A separate, explicit native UI approval can install the reviewed PdfCraft portable ZIP.
// No MSI execution, silent installer, elevated rights or generic managed-app exception.
const NATIVE_PDFCRAFT_INSTALL=process.argv.includes('--native-pdfcraft-install');
const NATIVE_CANCELABLE=process.argv.includes('--native-approved-install');
let cancelRequested=false,commitStarted=false;
const cancelController=new AbortController();
if(NATIVE_CANCELABLE){
 let input='';
 process.stdin.setEncoding('utf8');
 process.stdin.on('data',chunk=>{
  if(input.length+chunk.length>64){input='';return}
  input+=chunk;
  if(input.includes('cancel\n')){
   cancelRequested=true;
   if(!commitStarted)cancelController.abort(Error('INSTALL_CANCELLED_BEFORE_COMMIT'));
   input='';
  }
 });
 process.stdin.resume();
}
function checkCancelable(){
 if(NATIVE_CANCELABLE&&cancelRequested&&!commitStarted)
  fail('INSTALL_CANCELLED_BEFORE_COMMIT');
}
if(NATIVE_PDFCRAFT_INSTALL&&(PORTABLE||ID!=='pdfcraft'||PLATFORM!=='win32'||process.arch!=='x64'))
 throw Error('Managed PdfCraft install is only for Windows x64 with explicit native approval');
const DOWNLOAD_ROOT=PLATFORM==='win32'?'D:\\Downloads\\ChallengerHub\\Portable':path.join(os.homedir(),'Downloads','ChallengerHub','Portable');
const APP_ROOT=PLATFORM==='win32'?'D:\\Velvet\\Installers\\ChallengerHub\\Managed':path.join(os.homedir(),'Applications','ChallengerHub Apps');
const BACKUP_ROOT=path.join(APP_ROOT,'.backups'),WORK_ROOT=path.join(APP_ROOT,'.stage');
const META_FILE=path.join(ROOT,'managed-installs.json'),MAX_PACKAGE=800*1024*1024;
const out=(state,detail)=>console.log(JSON.stringify({state,detail:String(detail).slice(0,260)}));
function sha256File(file){return new Promise((resolve,reject)=>{const h=crypto.createHash('sha256');const r=fs.createReadStream(file);r.on('data',x=>h.update(x));r.on('error',reject);r.on('end',()=>resolve(h.digest('hex')));});}
function fail(msg){throw Error(msg)}
function safeJson(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function approved(){
 if(!/^[a-z][a-z0-9-]{1,79}$/.test(ID))fail('Invalid application ID');
 if(!['darwin','win32'].includes(PLATFORM))fail('Unsupported OS');
 const registry=safeJson(path.join(ROOT,'challengers.json'));
 const craftNames=new Set(['photocraft','vectorcraft','lightcraft','filmcraft','effectcraft','designcraft','pdfcraft','wordcraft','gridcraft','deckcraft','cadcraft','soundcraft']);
 const p=registry.projects.find(p=>p.id===ID)||((PORTABLE||NATIVE_PDFCRAFT_INSTALL)&&craftNames.has(ID)?{id:ID,name:ID,repository:'storytold/'+ID,installAdapter:null,installable:false}:null);
 if(!p||p.installAdapter||p.installable)fail('Unrecognized or unsafe discovery entry');
 const adapters=safeJson(path.join(ROOT,(PORTABLE||NATIVE_PDFCRAFT_INSTALL)?'portable-assets.json':'adapters.json'));
 const spec=adapters.projects?.[ID]?.[PLATFORM];
 if(PORTABLE&&!['zip','zip-app','exe-portable'].includes(spec?.kind))fail('No allowlisted portable package for this computer');
 if(!spec||!['zip','zip-app','dmg','exe-portable'].includes(spec.kind))fail('No reviewed adapter for this platform');
 const index=safeJson(path.join(ROOT,'release-index.json'));
 const rel=index.repositories?.[ID];
 if(!rel||!rel.available||!rel.tag||rel.repository!==p.repository||!Array.isArray(rel.assets))fail('No valid GitHub release metadata');
 const regexp=new RegExp(spec.asset,'i');
 const found=rel.assets.filter(a=>regexp.test(a.name)&&/^[a-f0-9]{64}$/.test(a.sha256||'')&&a.size>1000&&a.size<MAX_PACKAGE);
 if(found.length!==1)fail('Expected one digest-verified matching asset, found '+found.length);
 const asset=found[0],url=new URL(asset.url);
 if(url.protocol!=='https:'||url.hostname!=='github.com'||
    !url.pathname.startsWith('/'+p.repository+'/releases/download/')||asset.name!==decodeURIComponent(url.pathname.split('/').at(-1)))
    fail('Download does not come from the approved project release');
 const tag=String(rel.tag);
 if(tag.length>100||!/^[-A-Za-z0-9.+_]+$/.test(tag))fail('Invalid release tag');
 if(PLATFORM==='darwin'&&process.arch!=='arm64')fail('Mac adapter currently supports Apple Silicon only');
 return {p,spec,rel,asset};
}
function exec(file,args,timeout=120000){
 const r=spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:700000});
 if(r.error||r.status!==0)fail(path.basename(file)+' failed: '+String(r.stderr||r.stdout||r.error?.message).slice(0,250));
 return String(r.stdout||'').trim();
}
async function getRelease(asset,dest){
 out('download','Downloading '+asset.name+' ('+(asset.size/1048576).toFixed(1)+' MiB)');
 checkCancelable();
 const response=await fetch(asset.url,{redirect:'follow',headers:{'User-Agent':'ChallengerHub/2.4'},
  signal:AbortSignal.any([AbortSignal.timeout(6*60*1000),cancelController.signal])});
 if(!response.ok||!response.body)fail('Official release download HTTP '+response.status);
 const final=new URL(response.url);
 const allowed=['github.com','objects.githubusercontent.com','release-assets.githubusercontent.com','github-releases.githubusercontent.com'];
 if(final.protocol!=='https:'||!allowed.includes(final.hostname))fail('Release asset redirected to an unapproved host');
 const file=fs.openSync(dest,'wx',0o600);
 const hasher=crypto.createHash('sha256');let size=0,lastReported=0;
 try{
  const reader=response.body.getReader();
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>MAX_PACKAGE||size>asset.size+2048)fail('Download exceeded declared release asset size');
   hasher.update(value);fs.writeSync(file,value);
   // Report actual received bytes, not a timer-based or guessed percentage.
   // 100% is intentionally withheld until the complete SHA-256 check passes.
   const completed=Math.min(90,Math.floor(size/asset.size*10)*10);
   if(completed>lastReported){lastReported=completed;out('download-progress',String(completed));}
  }
 }finally{fs.closeSync(file)}
 if(size!==asset.size)fail('Release asset size mismatch ('+size+' vs '+asset.size+')');
 if(hasher.digest('hex')!==asset.sha256)fail('SHA-256 mismatch. Installation blocked.');
 out('verified','SHA-256 verified against published GitHub release digest');
}
function safeReadState(){try{return safeJson(META_FILE)}catch(_){return {schema:'challenger-installs.v1',installed:{}}}}
function saveState(s){
 const temp=META_FILE+'.'+process.pid+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(s,null,2)+'\n',{encoding:'utf8',mode:0o600});fs.renameSync(temp,META_FILE);
}
function walk(dir,predicate,depth=0,list=[]){
 if(depth>7||list.length>10000)return list;
 for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
  const f=path.join(dir,ent.name);
  if(ent.isSymbolicLink())continue;
  if(predicate(f,ent))list.push(f);
  if(ent.isDirectory())walk(f,predicate,depth+1,list);
 }
 return list;
}
function chosen(items,hint){
 if(!items.length)fail('No runnable application inside package');
 const norm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const desired=norm(hint);
 const score=f=>{
  const name=norm(path.basename(f,path.extname(f)));
  const match=name===desired?150:name.includes(desired)?90:desired.includes(name)?50:0;
  const reject=/(uninstall|updater|update|crash|helper|setup|install|service)/i.test(path.basename(f))?-200:0;
  return match+reject-f.split(path.sep).length;
 };
 return [...items].sort((a,b)=>score(b)-score(a))[0];
}
function unzipWindows(source,target){
 fs.mkdirSync(target,{recursive:true});
 const q=s=>String(s).replace(/'/g,"''");
 const first="$ErrorActionPreference='Stop';Add-Type -AssemblyName System.IO.Compression.FileSystem;";
 const second="$zip=[IO.Compression.ZipFile]::OpenRead('"+q(source)+"');";
 const third="try{$sum=0;$base=[IO.Path]::GetFullPath('"+q(target)+"')+[IO.Path]::DirectorySeparatorChar;if($zip.Entries.Count -gt 12000){throw 'Too many archive entries'};";
 const fourth="foreach($e in $zip.Entries){$sum+=$e.Length;if($sum -gt 4000000000){throw 'Expanded archive too large'};$fp=[IO.Path]::GetFullPath([IO.Path]::Combine('"+q(target)+"',$e.FullName));if(-not $fp.StartsWith($base,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe archive path'}}}finally{$zip.Dispose()};";
 const fifth="[IO.Compression.ZipFile]::ExtractToDirectory('"+q(source)+"','"+q(target)+"')";
 exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',first+second+third+fourth+fifth],240000);
}
// A failure after the approved files are swapped must not leave the prior
// managed installation displaced when its metadata cannot be committed.
// This handles synchronous errors; hard power loss remains a separate gap.
function rollbackSwap({appRoot,backupPath}){
 const safeParent=path.resolve(APP_ROOT)+path.sep;
 const target=path.resolve(appRoot);
 const safeBackup=path.resolve(BACKUP_ROOT)+path.sep;
 if(!target.startsWith(safeParent)||
    (backupPath&&!path.resolve(backupPath).startsWith(safeBackup)))
  fail('Refusing rollback outside the managed app roots');
 if(!fs.existsSync(target))fail('Cannot roll back: installed app folder is missing');
 const quarantined=path.join(WORK_ROOT,ID+'-failed-'+crypto.randomBytes(8).toString('hex'));
 fs.renameSync(target,quarantined);
 try{
  if(backupPath){
   if(!fs.existsSync(backupPath))fail('Cannot roll back: managed backup is missing');
   fs.renameSync(backupPath,target);
  }
 }catch(e){
  try{fs.renameSync(quarantined,target)}
  catch(restoreError){throw Error('Rollback and failed-app recovery both failed: '+restoreError.message)}
  throw e;
 }
 try{fs.rmSync(quarantined,{recursive:true,force:true})}
 catch(e){out('warning','Failed install quarantined for later cleanup: '+e.message)}
 out('rolled-back',backupPath?'Restored previous managed application':'Removed failed new application');
}
function ciOnlyStateFailure(){
 if(process.env.CHALLENGER_CI_FAIL_STATE_WRITE!=='1')return false;
 const runner=process.env.RUNNER_TEMP||'';
 const local=process.env.LOCALAPPDATA||'';
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_OS!=='Windows'||
   !runner||!local||!path.resolve(local).toLowerCase()
     .startsWith(path.resolve(runner).toLowerCase()+path.sep.toLowerCase()))
  fail('CI state-write fault injection refused outside disposable Windows runner');
 return true;
}
function installWindows({p,spec},src,stage){
 const build=path.join(stage,'payload');fs.mkdirSync(build,{recursive:true});
 let exe=null;
 if(spec.kind==='zip'){
  unzipWindows(src,build);
  exe=chosen(walk(build,(f,e)=>e.isFile()&&/\.exe$/i.test(f)),spec.exeHint||p.name);
  if(!/\.exe$/i.test(exe))fail('No expected Windows executable');
  if(NATIVE_PDFCRAFT_INSTALL&&path.basename(exe).toLowerCase()!=='pdfcraft.exe')
   fail('The reviewed PdfCraft GUI executable is missing from the verified archive');
 }else if(spec.kind==='exe-portable'){
  const stem=String(spec.exeHint||p.id).replace(/[^a-zA-Z0-9_-]/g,'');
  exe=path.join(build,stem+'.exe');fs.copyFileSync(src,exe);
 }else fail('Windows setup executables and MSI installations require separate adapter review');
 const folder=path.join(APP_ROOT,p.id);
 const relative=path.relative(build,exe);
 if(relative.startsWith('..')||path.isAbsolute(relative))fail('Executable escapes staging');
 let backup=null;
 if(fs.existsSync(folder)){backup=path.join(BACKUP_ROOT,p.id+'-'+Date.now());fs.renameSync(folder,backup)}
 try{fs.renameSync(build,folder)}
 catch(e){if(backup&&fs.existsSync(backup))fs.renameSync(backup,folder);throw e}
 const installedExe=path.join(folder,relative);
 if(!fs.existsSync(installedExe))fail('Installed executable not found');
 out('installed','Verified portable app saved to '+installedExe);
 return {installedPath:installedExe,appRoot:folder,backupPath:backup};
}
function macApp(source,spec,stage){
 const extraction=path.join(stage,'extracted');
 fs.mkdirSync(extraction,{recursive:true});
 let mount=null,sourceRoot=extraction;
 try{
  if(spec.kind==='dmg'){
   mount=path.join(stage,'mount');fs.mkdirSync(mount,{recursive:true});
   exec('/usr/bin/hdiutil',['attach',source,'-nobrowse','-readonly','-mountpoint',mount],120000);
   sourceRoot=mount;
  }else if(spec.kind==='zip-app'){
   exec('/usr/bin/ditto',['-x','-k',source,extraction],160000);
  }else fail('Mac adapter supports only DMG and app ZIP');
  const apps=walk(sourceRoot,(f,e)=>e.isDirectory()&&f.endsWith('.app'));
  if(!apps.length)fail('Archive does not contain a macOS .app bundle');
  const picked=chosen(apps,spec.appHint);
  exec('/usr/bin/codesign',['--verify','--deep',picked],100000);
  const bundle=path.join(stage,'verified-app');
  exec('/usr/bin/ditto',[picked,bundle],180000);
  exec('/usr/bin/codesign',['--verify','--deep',bundle],100000);
  return bundle;
 }finally{
  if(mount){try{exec('/usr/bin/hdiutil',['detach',mount,'-quiet'],30000)}
    catch(_){out('warning','Temporary DMG could not be detached immediately')}}
 }
}
function installMac({p,spec},src,stage){
 const verified=macApp(src,spec,stage);
 const bundleName=path.basename(spec.appHint||p.name).replace(/[^a-zA-Z0-9 ._-]/g,'').trim()||p.id;
 const dst=path.join(APP_ROOT,bundleName+'.app');
 const current=safeReadState().installed?.[p.id];
 if(fs.existsSync(dst)&&(!current||current.installedPath!==dst))fail('Existing unowned app would be overwritten; leaving it untouched');
 let backup=null;
 if(fs.existsSync(dst)){backup=path.join(BACKUP_ROOT,p.id+'-'+Date.now()+'.app');fs.renameSync(dst,backup)}
 try{fs.renameSync(verified,dst)}
 catch(e){if(backup&&fs.existsSync(backup))fs.renameSync(backup,dst);throw e}
 out('installed','Verified application bundle copied to '+dst);
 return {installedPath:dst,appRoot:dst,backupPath:backup};
}
(async()=>{
 const entry=approved();
 if(PORTABLE){fs.mkdirSync(DOWNLOAD_ROOT,{recursive:true});fs.mkdirSync(path.join(DOWNLOAD_ROOT,'.stage'),{recursive:true});}
 else{fs.mkdirSync(APP_ROOT,{recursive:true});fs.mkdirSync(WORK_ROOT,{recursive:true});fs.mkdirSync(BACKUP_ROOT,{recursive:true});}
 const stage=fs.mkdtempSync(path.join(PORTABLE?path.join(DOWNLOAD_ROOT,'.stage'):WORK_ROOT,ID+'-'));
 try{
  out('source','Approved '+entry.p.repository+' '+entry.rel.tag+' for '+PLATFORM);
  if(NATIVE_CANCELABLE)out('cancel-ready','Cancellation is permitted before package replacement');
  // Deterministic integration gate; permitted ONLY in a disposable Windows
  // Actions runner, never in a regular Windows user profile.
  if(process.env.CHALLENGER_CI_CANCEL_GATE==='1'){
   const runner=process.env.RUNNER_TEMP||'',local=process.env.LOCALAPPDATA||'';
   if(process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_OS!=='Windows'||
      !runner||!local||!path.resolve(local).toLowerCase()
        .startsWith(path.resolve(runner).toLowerCase()+path.sep.toLowerCase()))
     fail('CI cancel gate refused outside disposable Windows runner');
   if(!cancelRequested)await new Promise(resolve=>{
    const timer=setTimeout(resolve,8000);
    cancelController.signal.addEventListener('abort',()=>{
     clearTimeout(timer);resolve();
    },{once:true});
   });
   if(!cancelRequested)fail('CI cooperative cancellation never reached worker');
  }
  checkCancelable();
  const asset=path.join(stage,entry.asset.name);
  await getRelease(entry.asset,asset);
  if(PORTABLE){
    const filename=(ID+'-'+entry.rel.tag+'-'+entry.asset.name).replace(/[^A-Za-z0-9._+()-]/g,'_');
    const dst=path.join(DOWNLOAD_ROOT,filename);
    if(fs.existsSync(dst)){
      const current=await sha256File(dst);
      if(current!==entry.asset.sha256)fail('An existing portable download has a different hash; refusing to overwrite');
      out('success','Verified portable package already saved: '+dst);
    }else{
      fs.renameSync(asset,dst);out('success','Portable package saved: '+dst+' (not installed or executed)');
    }
    return;
  }
  if(DRY){out('verified','Verification-only preflight passed; no installation performed.');return}
  if(process.argv.includes('--inspect-only')){
    if(PLATFORM==='darwin')macApp(asset,entry.spec,stage);
    else if(entry.spec.kind==='zip'){
      const expanded=path.join(stage,'expanded');unzipWindows(asset,expanded);
      const exe=chosen(walk(expanded,(f,e)=>e.isFile()&&/\.exe$/i.test(f)),entry.spec.exeHint);
      out('verified','Portable Windows executable located: '+path.relative(expanded,exe));
    }else if(entry.spec.kind==='exe-portable')out('verified','Portable Windows executable verified.');
    else fail('No safe inspection for this package format');
    out('verified','Package structure and integrity inspected without installation.');return;
  }
  out('extract','Validating the downloaded application');
  checkCancelable();
  // The replacement is synchronous; after this boundary, cancellation
  // requests do not kill the worker or abandon a partially swapped app.
  commitStarted=true;
  out('committing','Applying verified package; cancellation is no longer safe');
  const installed=PLATFORM==='win32'?installWindows(entry,asset,stage):installMac(entry,asset,stage);
  try{
   const data=safeReadState();if(!data.installed||typeof data.installed!=='object')data.installed={};
   data.installed[ID]={id:ID,repository:entry.p.repository,version:entry.rel.tag,installedAt:new Date().toISOString(),
     installedPath:installed.installedPath,appRoot:installed.appRoot,assetName:entry.asset.name,
     sha256:entry.asset.sha256,kind:entry.spec.kind,managed:true,
     integrity:'SHA-256 from GitHub release metadata'};
   if(ciOnlyStateFailure())fail('CI-only injected managed install state-write failure');
   saveState(data);
  }catch(e){
   // The backup remains owned by this worker until metadata commits.
   // Restore it on a synchronous failure; never emit a false success.
   try{rollbackSwap(installed)}
   catch(rollback){throw Error('Install record failed ('+e.message+
     '); failed to restore previous application ('+rollback.message+')')}
   throw e;
  }
  out('success',entry.p.name+' '+entry.rel.tag+' installed and tracked');
 }finally{try{fs.rmSync(stage,{recursive:true,force:true})}catch(_){}}
})().catch(e=>{
 if(cancelRequested&&!commitStarted){
  out('cancelled','User cancellation confirmed before application replacement');
  process.exitCode=2;
 }else{
  out('failed',String(e.message));process.exitCode=1;
 }
}).finally(()=>{if(NATIVE_CANCELABLE)process.stdin.pause()});
