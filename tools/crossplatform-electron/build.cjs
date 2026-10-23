'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const packageElectron=require('@electron/packager');
const policy=require('./shell-policy.cjs');
async function main(argv=process.argv.slice(2)){
 const [platform,arch]=argv;
 if(!['darwin','linux','win32'].includes(platform)||!['arm64','x64'].includes(arch))
  throw Error('Usage: node build.cjs darwin|linux|win32 arm64|x64');
 const name='Challenger Hub Cross Platform Pilot',slug='challenger-crossplatform-pilot12';
 const directory=__dirname,out=path.join(directory,'dist',platform+'-'+arch);
 const runtime=path.resolve(directory,'../desktop-build/dist/runtime-preview12');
 if(fs.existsSync(out))throw Error('Refusing to overwrite an existing pilot package: '+out);
 const manifest=policy.verifyBundled(runtime);
 if(manifest.version!=='4.0.0-desktop.preview.12')throw Error('Wrong preview source manifest');
 const icon=path.resolve(directory,'../../brand/orbit/export',
  platform==='darwin'?'challenger-orbit.icns':'challenger-orbit.ico');
 const paths=await packageElectron({
  dir:directory,out,platform,arch,electronVersion:'45.0.0',
  name,executableName:'ChallengerHubPilot12',
  appBundleId:'io.velvetos.challenger.crossplatform-pilot12',
  appVersion:'4.0.0',buildVersion:'4012',
  ...(platform==='darwin'||platform==='win32'?{icon}:{}),
  extraResource:[runtime],asar:true,prune:true,overwrite:false,
  ignore:[/[/\\]dist[/\\]/,/[/\\]package-lock\.json$/,/[/\\]build\.cjs$/]
 });
 if(paths.length!==1)throw Error('Expected one packaged app result');
 const folder=paths[0],extra=platform==='darwin'?
  path.join(folder,'Contents','Resources','runtime-preview12'):
  path.join(folder,'resources','runtime-preview12');
 if(!fs.existsSync(extra))throw Error('Verified backend missing from Electron resources');
 const result=policy.verifyBundled(extra);
 const proof={schema:'challenger-crossplatform-pilot-package.v1',platform,arch,
  app:folder,version:manifest.version,bundledFiles:result.files,
  signed:false,notarized:false,installApprovalAdded:false,requiresOperatorReview:true};
 fs.writeFileSync(path.join(out,'package-evidence.json'),JSON.stringify(proof,null,2)+'\n');
 console.log('CHALLENGER_ELECTRON_PILOT_PACKAGED '+JSON.stringify(proof));
}
main().catch(e=>{console.error('CHALLENGER_ELECTRON_PILOT_PACKAGE_FAIL '+(e.stack||e));process.exitCode=1});
