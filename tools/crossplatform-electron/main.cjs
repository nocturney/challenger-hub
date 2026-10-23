'use strict';
/* One cross-platform shell for the existing verified Challenger Node backend.
 * Isolated pilot: never changes any Preview 11 user data or installed production apps. */
const {app,BrowserWindow,utilityProcess,shell}=require('electron');
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto');
const policy=require('./shell-policy.cjs');
const VERSION='4.0.0-desktop.preview.12',smoke=process.argv.includes('--challenger-smoke');
const standalone=process.argv.includes('--challenger-offline');
const profile=policy.deploymentRoot(app.getPath('appData'));
app.setPath('userData',profile);
if(!app.requestSingleInstanceLock()){app.exit(0)}
let child=null,window=null,port=null;
const sourceRuntime=app.isPackaged?
 path.join(process.resourcesPath,'runtime-preview12'):
 path.resolve(__dirname,'../desktop-build/dist/runtime-preview12');
const userRuntime=path.join(profile,'runtime');
function record(level,message){
 fs.mkdirSync(profile,{recursive:true});
 fs.appendFileSync(path.join(profile,'startup.log'),
  new Date().toISOString()+' ['+level+'] '+String(message).replace(/[\r\n]/g,' ').slice(0,500)+'\n');
}
function prepare(){
 if(!fs.existsSync(sourceRuntime))throw Error('Packaged Preview 12 runtime not found');
 const proof=policy.verifyBundled(sourceRuntime);
 if(proof.version!==VERSION)throw Error('Shell and bundled engine version mismatch');
 if(!fs.existsSync(userRuntime)){
  fs.mkdirSync(profile,{recursive:true});
  const temp=userRuntime+'.build-'+crypto.randomBytes(5).toString('hex');
  try{
   fs.cpSync(sourceRuntime,temp,{recursive:true,force:false});
   policy.verifyExisting(temp,sourceRuntime);
   fs.renameSync(temp,userRuntime);
  }finally{fs.rmSync(temp,{recursive:true,force:true})}
 }else policy.verifyExisting(userRuntime,sourceRuntime);
 record('info','Integrity verified for '+proof.files+' bundled files; OS '+process.platform+'/'+process.arch);
}
async function freePort(){
 const server=net.createServer();
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 await new Promise(resolve=>server.close(resolve));
 return port;
}
async function startEngine(){
 const token=crypto.randomBytes(32).toString('hex');
 port=await freePort();
 const env={...process.env,
  CRAFT_CENTER_PORT:String(port),CHALLENGER_DESKTOP_SESSION:token,
  ...(standalone?{CHALLENGER_DISABLE_SCAN:'1'}:{})};
 child=utilityProcess.fork(path.join(userRuntime,'server.js'),[],{
  cwd:userRuntime,env,stdio:'pipe',serviceName:'Challenger private local engine'
 });
 child.on('exit',code=>record('backend-exit','exit '+code));
 if(child.stdout)child.stdout.on('data',data=>record('backend',data.toString()));
 if(child.stderr)child.stderr.on('data',data=>record('backend-error',data.toString()));
 for(let i=0;i<65;i++){
  if(!child)throw Error('Owned backend died during startup');
  try{
   const resp=await fetch('http://127.0.0.1:'+port+'/api/health',{
    headers:{'X-Challenger-Desktop-Session':token},signal:AbortSignal.timeout(550)});
   if(resp.ok){
    const health=await resp.json();
    if(health.app==='Challenger Focus Desktop'&&health.version===VERSION&&
       health.desktopSessionVerified===true&&health.platform===process.platform){
      record('info','Private engine verified on loopback; platform '+health.platform);
      return token;
    }
    throw Error('Foreign/unverified local service refused');
   }
  }catch(e){if(String(e.message).includes('Foreign/unverified'))throw e}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error('Private engine health check timed out');
}
function createWindow(token){
 const base='http://127.0.0.1:'+port+'/';
 const browsingSession=require('electron').session.fromPartition('persist:challenger-crossplatform-pilot12');
 browsingSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 browsingSession.webRequest.onBeforeRequest((details,done)=>{
  const url=details.url;
  const allowed=policy.loopback(url,port)||url.startsWith('data:')||url.startsWith('about:');
  done({cancel:!allowed});
 });
 browsingSession.webRequest.onBeforeSendHeaders((details,done)=>{
  const headers={...details.requestHeaders};
  if(policy.loopback(details.url,port)&&details.method==='POST')
   headers['X-Challenger-Desktop-Session']=token;
  done({requestHeaders:headers});
 });
 window=new BrowserWindow({
  width:1100,height:760,minWidth:720,minHeight:500,show:!smoke,backgroundColor:'#f7f6f2',
  title:'Challenger Hub · Cross-platform Pilot',
  webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,
   partition:'persist:challenger-crossplatform-pilot12'}
 });
 const allowExternal=url=>{if(policy.safeExternal(url))void shell.openExternal(url)};
 window.webContents.setWindowOpenHandler(({url})=>{allowExternal(url);return {action:'deny'}});
 window.webContents.on('will-navigate',(event,url)=>{
  if(!policy.loopback(url,port)){event.preventDefault();allowExternal(url)}
 });
 window.on('closed',()=>{window=null;app.quit()});
 return window.loadURL(base);
}
async function smokeCheck(){
 for(let i=0;i<40;i++){
  const facts=await window.webContents.executeJavaScript(
   "({page:document.title,disciplines:document.querySelectorAll('.discipline-row').length,"+
   "projects:document.querySelector('#homeProjectCount')?.textContent||''," +
   "platformUI:!!document.querySelector('script[src=\"/platform-availability-ui.js\"]')})");
  if(facts.projects.includes('181')){
   if(facts.disciplines!==17||!facts.platformUI)throw Error('Renderer features missing');
   const result={ok:true,platform:process.platform,arch:process.arch,version:VERSION,
    entries:181,disciplines:17,sourceIntegrity:'verified',nodeIntegration:false,
    contextIsolation:true,sandbox:true};
   fs.writeFileSync(path.join(profile,'smoke.json'),JSON.stringify(result,null,2)+'\n');
   console.log('CHALLENGER_ELECTRON_CROSSPLATFORM_SMOKE_PASS '+JSON.stringify(result));
   return;
  }
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('Renderer did not load all 181 source entries');
}
app.whenReady().then(async()=>{
 try{
  prepare();
  const token=await startEngine();
  await createWindow(token);
  if(smoke){await smokeCheck();app.quit()}
 }catch(e){
  record('error',e.stack||e);
  console.error('CHALLENGER_ELECTRON_PILOT_FAILED '+String(e.stack||e));
  app.exit(2);
 }
});
app.on('before-quit',()=>{if(child){try{child.kill()}catch{}child=null}});
app.on('window-all-closed',()=>app.quit());
app.on('second-instance',()=>{if(window){window.show();window.focus()}});
