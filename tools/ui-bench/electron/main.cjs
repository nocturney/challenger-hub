'use strict';
const {app,BrowserWindow,ipcMain}=require('electron');
const path=require('node:path'),os=require('node:os');
const started=process.hrtime.bigint();
const data=require('../data/challenger181.json');
if(data.entryCount!==181||data.entries.length!==181)throw Error('Wrong catalog');
const smoke=process.argv.includes('--bench-smoke');
app.setPath('userData',path.join(os.tmpdir(),'challenger-ui-bench-electron'));
function search(query,category){
 const term=String(query||'').trim().toLowerCase();
 return data.entries.filter(p=>
  (category==='All disciplines'||p.category===category)&&
  (!term||[p.name,p.maker,p.category,p.summary].some(s=>s.toLowerCase().includes(term)))
 );
}
ipcMain.handle('search_catalog',(_event,query,category)=>search(query,category));
ipcMain.handle('bench_ready',async(event,message)=>{
 if(!event.sender.getURL().startsWith('file://')||message.total!==181)
  throw Error('Invalid benchmark renderer');
 const elapsed=Number((process.hrtime.bigint()-started)/1000000n);
 console.log('BENCH_READY framework=electron total=181 renderer=chromium ms_since_main='+elapsed+' ui_ms='+message.uiMs);
 if(smoke)setTimeout(()=>app.quit(),900);
 return {ok:true};
});
app.whenReady().then(async()=>{
 const win=new BrowserWindow({
  width:1190,height:760,minWidth:900,minHeight:620,backgroundColor:'#f7f7f2',
  title:'Challenger · Electron Renderer Comparison',
  webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,
   preload:path.join(__dirname,'preload.cjs')}
 });
 const ses=win.webContents.session;
 ses.setPermissionRequestHandler((_wc,_perm,callback)=>callback(false));
 ses.webRequest.onBeforeRequest(({url},callback)=>{
  callback({cancel:!url.startsWith('file://')&&!url.startsWith('data:')&&!url.startsWith('about:')});
 });
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',event=>event.preventDefault());
 win.webContents.on('console-message',(_event,details)=>{if(details.level==='error')console.error('WEB_ERROR',details.message)});
 await win.loadFile(path.join(__dirname,'../web/index.html'));
}).catch(e=>{console.error('BENCH_FAILURE',e);app.exit(2)});
app.on('window-all-closed',()=>app.quit());
