'use strict';
/* Challenger Focus + Orbit standalone read-only archived-data preview. No production service, installer, scanner or external network dependency. */
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const ROOT=__dirname,HOST='127.0.0.1',PORT=Number(process.env.FOCUS_ORBIT_TEST_PORT||17961);
if(!Number.isInteger(PORT)||PORT<1024||PORT>65535)throw Error('Invalid preview port');
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'test-manifest.json'),'utf8'));
if(manifest.mode!=='READ_ONLY_OFFLINE_PREVIEW')throw Error('Not a read-only test distribution');
const state=fs.readFileSync(path.join(ROOT,'preview-catalog.json')),valid=JSON.parse(state);
if(valid.previewMode!=='offline-cache'||!Array.isArray(valid.apps)||!Array.isArray(valid.discoveries))throw Error('Invalid archived data');
const files=new Map([['/','index.html'],['/index.html','index.html'],['/style.css','style.css'],['/app.js','app.js'],['/brand-icon.png','brand-icon.png'],['/favicon.ico','favicon.ico']]);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
function send(res,status,content,type,head){
 const bytes=Buffer.isBuffer(content)?content:Buffer.from(String(content));
 res.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
 res.end(head?undefined:bytes);
}
const server=http.createServer((req,res)=>{
 try{
  const head=req.method==='HEAD';
  if(!['GET','HEAD'].includes(req.method)){send(res,405,'This build is read-only','text/plain',head);return}
  const u=new URL(req.url,'http://127.0.0.1'),key=decodeURIComponent(u.pathname);
  if(key==='/api/state'){send(res,200,state,'application/json; charset=utf-8',head);return}
  if(key==='/api/health'){send(res,200,JSON.stringify({ok:true,mode:'READ_ONLY_OFFLINE_PREVIEW',version:manifest.version,snapshotAt:valid.checkedAt,live:false}),'application/json; charset=utf-8',head);return}
  let rel=files.get(key);
  if(!rel&&/^\/brand\/orbit\/orbit-[a-z-]+\.svg$/.test(key))rel=key.slice(1);
  if(!rel){send(res,404,'Not in test build','text/plain',head);return}
  const file=path.resolve(ROOT,rel);
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){send(res,404,'Missing test asset','text/plain',head);return}
  send(res,200,fs.readFileSync(file),mime[path.extname(file)]||'application/octet-stream',head);
 }catch(e){send(res,500,'Preview error; no system changes','text/plain',req.method==='HEAD')}
});
server.on('error',e=>{console.error('PREVIEW_LAUNCH_FAILED',e.message);process.exitCode=1});
server.listen(PORT,HOST,()=>console.log('CHALLENGER_FOCUS_ORBIT_TEST_READY http://'+HOST+':'+PORT+'/ mode=OFFLINE_ARCHIVED_CATALOG read_only=true entries='+(valid.apps.length+valid.discoveries.length)+' checkedAt='+valid.checkedAt));
