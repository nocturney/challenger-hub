'use strict';
/* A versioned, fail-closed release process. Works with existing local GitHub CLI.
 * Only validated, read-only macOS/Windows preview ZIPs become GitHub prereleases.
 * Never installs, merges, replaces Production, or changes the existing previews. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto'),cp=require('node:child_process');
const preview=Number(process.argv[2]),action=process.argv[3];
const actions=new Set(['verify','archive','draft','upload','publish']);
if(!Number.isInteger(preview)||preview<3||preview>49||!actions.has(action))
 throw Error('Usage: node release-preview.cjs <3..49> <verify|archive|draft|upload|publish> [release notes file]');
if(!['win32','darwin'].includes(process.platform))throw Error('This project preview supports Windows and macOS only');
const base=process.platform==='win32'?'D:/Velvet/Installers/CraftSuite':
 '/Users/chris/Library/Application Support/OfficeOps/CraftSuite';
const stem='Challenger-FocusOrbit-PREVIEW-4.0.0-orbit.'+preview;
const root=path.join(base,'Center',stem),zip=path.join(base,'Center',stem+
 (process.platform==='win32'?'-Windows.zip':'-macOS.zip'));
const version='4.0.0-orbit.preview.'+preview,tag='v4.0.0-orbit-preview.'+preview;
const repo='nocturney/challenger-hub';
const source=path.resolve(__dirname,'..','..');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function file(name){return fs.readFileSync(path.join(root,name))}
function run(command,args){return cp.execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:2e6}).trim()}
function gh(args){return run('gh',args)}
function verify(directory=root){
 const m=JSON.parse(fs.readFileSync(path.join(directory,'test-manifest.json')));
 if(m.version!==version||m.mode!=='READ_ONLY_OFFLINE_PREVIEW'||m.productionUntouched!==true||
  m.backendIncluded!==false||m.projects!==164||m.researchRestricted!==73||
  m.media?.icons<10||m.media?.screenshots<3)throw Error('Manifest safety and media gate rejected');
 const catalogue=JSON.parse(fs.readFileSync(path.join(directory,'preview-catalog.json')));
 if(catalogue.previewMode!=='offline-cache'||catalogue.apps?.length!==12||catalogue.discoveries?.length!==152||
  catalogue.discoveries.filter(p=>p.researchPendingVerification).length!==73)
  throw Error('Offline archive safety gate rejected');
 const qa=JSON.parse(fs.readFileSync(path.join(directory,'_qa','browser-qa-media.json')));
 if(qa.status!=='PASS'||qa.release!==version||qa.cases!==10||qa.readOnly!==true||
  qa.noWrites!==true||qa.externalRequests!==0||qa.errors?.length||qa.writes?.length||
  qa.screenshots!==m.media.screenshots||qa.screenshotsCaptured<34)
  throw Error('Full local real-browser QA has not passed');
 const checks=JSON.parse(fs.readFileSync(path.join(directory,'SHA256-MANIFEST.json')));
 if(Object.keys(checks).length<30)throw Error('Incomplete SHA256 manifest');
 for(const [relative,expected] of Object.entries(checks)){
  if(relative.includes('..')||relative.startsWith('/')||path.isAbsolute(relative))throw Error('Invalid manifest key');
  const actual=sha(fs.readFileSync(path.join(directory,relative)));
  if(actual!==expected)throw Error('Package integrity mismatch at '+relative);
 }
 for(const id of ['dune3d','material-maker','real-video-enhancer'])
  if(!fs.existsSync(path.join(directory,'media','screenshots',id+'.png')))throw Error('Missing authentic screenshot '+id);
 return {platform:process.platform,version,verifiedFiles:Object.keys(checks).length,
  qaCases:qa.cases,screenshots:m.media.screenshots,icons:m.media.icons};
}
function archive(){
 const validated=verify();
 if(fs.existsSync(zip))throw Error('Refusing to overwrite versioned ZIP: '+zip);
 if(process.platform==='darwin')run('ditto',['-c','-k','--keepParent',root,zip]);
 else run('powershell.exe',['-NoProfile','-NonInteractive','-Command',
  'Compress-Archive -LiteralPath \''+root.replace(/'/g,"''")+'\' -DestinationPath \''+zip.replace(/'/g,"''")+'\' -CompressionLevel Optimal']);
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'challenger-preview-smoke-'));
 try{
  if(process.platform==='darwin')run('ditto',['-x','-k',zip,temp]);
  else run('powershell.exe',['-NoProfile','-NonInteractive','-Command',
   'Expand-Archive -LiteralPath \''+zip.replace(/'/g,"''")+'\' -DestinationPath \''+temp.replace(/'/g,"''")+'\'']);
  verify(path.join(temp,stem));
 }catch(error){fs.rmSync(zip,{force:true});throw error}
 finally{fs.rmSync(temp,{recursive:true,force:true})}
 return {...validated,zip,bytes:fs.statSync(zip).size,zipSHA256:sha(fs.readFileSync(zip))};
}
function requireArchive(){
 const v=verify();
 if(!fs.existsSync(zip)||fs.statSync(zip).size<500000)throw Error('Validated release ZIP missing; run archive first');
 return {...v,zipSHA256:sha(fs.readFileSync(zip)),zip};
}
function release(){
 return JSON.parse(gh(['api','repos/'+repo+'/releases/tags/'+tag]));
}
function requireCleanGit(){
 if(run('git',['-C',source,'status','--porcelain']))throw Error('Cannot release with dirty source checkout');
 return run('git',['-C',source,'rev-parse','HEAD']);
}
function createDraft(){
 if(process.platform!=='win32')throw Error('Draft creation starts on Windows; macOS ZIP is attached afterward');
 const v=requireArchive(),head=requireCleanGit();
 const notes=process.argv[4];
 if(!notes||!fs.existsSync(notes))throw Error('Release notes markdown required');
 const existing=cp.spawnSync('gh',['release','view',tag,'--repo',repo],{encoding:'utf8'});
 if(existing.status===0)throw Error('Release already exists; cannot overwrite or clobber assets');
 const url=gh(['release','create',tag,zip,'--repo',repo,'--target',head,
  '--title','Challenger Focus 4.0 + Orbit — TEST Preview '+preview+' (real project media)',
  '--prerelease','--draft','--notes-file',notes]);
 return {...v,draftURL:url,targetCommit:head};
}
function attach(){
 const v=requireArchive();
 if(process.platform!=='darwin')throw Error('Mac ZIP is attached from the tested Mac itself');
 const rel=release();
 if(!rel.draft||!rel.prerelease)throw Error('Release is not a draft prerelease');
 const target=run('git',['-C',source,'rev-parse','HEAD']);
 if(rel.target_commitish!==target)throw Error('Release commit does not match tested Mac branch');
 gh(['release','upload',tag,zip,'--repo',repo]);
 return {...v,assetUploaded:true};
}
function publish(){
 if(process.platform!=='win32')throw Error('Finish the release on Windows after Mac has attached its verified ZIP');
 const v=requireArchive(),rel=release(),shaHead=requireCleanGit();
 if(!rel.draft||!rel.prerelease||rel.target_commitish!==shaHead)throw Error('Release safety state changed');
 const assets=new Map((rel.assets||[]).map(x=>[x.name,x]));
 for(const suffix of ['Windows','macOS']){
  const name=stem+'-'+suffix+'.zip',asset=assets.get(name);
  if(!asset||asset.state!=='uploaded'||!/^sha256:[a-f0-9]{64}$/.test(asset.digest||''))
   throw Error('Missing fully uploaded SHA256-verified '+suffix+' artifact');
 }
 if(assets.size!==2)throw Error('Unexpected additional release assets; review before publish');
 if(assets.get(stem+'-Windows.zip').digest!=='sha256:'+v.zipSHA256)
  throw Error('GitHub digest differs from local validated Windows archive');
 gh(['release','edit',tag,'--repo',repo,'--draft=false','--prerelease']);
 const updated=release();
 if(updated.draft||!updated.prerelease||updated.assets.length!==2)
  throw Error('Release did not publish as prerelease');
 return {published:true,tag,webURL:updated.html_url,assets:updated.assets.map(a=>({name:a.name,sha256:a.digest,size:a.size}))};
}
let result;
if(action==='verify')result=verify();
else if(action==='archive')result=archive();
else if(action==='draft')result=createDraft();
else if(action==='upload')result=attach();
else if(action==='publish')result=publish();
console.log('CHALLENGER_PREVIEW_RELEASE_'+action.toUpperCase()+'_PASS '+JSON.stringify(result));
