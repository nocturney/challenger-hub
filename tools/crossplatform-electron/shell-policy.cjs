'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
function loopback(url,port){
 try{const u=new URL(url);return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port===String(port)&&!u.username&&!u.password;}
 catch{return false}
}
function safeExternal(url){
 try{
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
  const h=u.hostname.toLowerCase();
  if(!h||h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||
     /^(?:\d{1,3}\.){3}\d{1,3}$/.test(h)||h.includes(':'))return false;
  return true;
 }catch{return false}
}
function verifyBundled(runtime){
 const file=path.join(runtime,'SHA256-MANIFEST.json');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const all=Object.entries(manifest);
 if(all.length<100)throw Error('Incomplete source-pinned desktop payload');
 for(const [name,expected] of all){
  if(!/^[a-zA-Z0-9_.\/-]+$/.test(name)||name.includes('..'))throw Error('Unsafe packaged path');
  const full=path.resolve(runtime,name);
  if(!full.startsWith(path.resolve(runtime)+path.sep))throw Error('Path escapes packaged runtime');
  const got=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if(got!==expected)throw Error('Packaged app failed integrity check: '+name);
 }
 return {files:all.length,version:JSON.parse(fs.readFileSync(path.join(runtime,'desktop-manifest.json'))).version};
}
const mutable=new Set([
 'catalog-cache.json','source-signals.json','registry-live-metadata.json','managed-installs.json',
 'release-index.json','source-preferences.json'
]);
function verifyExisting(local,bundled){
 const manifest=JSON.parse(fs.readFileSync(path.join(bundled,'SHA256-MANIFEST.json'),'utf8'));
 for(const [name,expected] of Object.entries(manifest)){
  if(mutable.has(name))continue;
  const file=path.join(local,name);
  const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if(hash!==expected)throw Error('Local app code/media integrity check failed: '+name);
 }
 return true;
}
function deploymentRoot(appData){
 return path.join(appData,'VelvetOS','ChallengerFocusDesktop','CrossPlatformPilot12');
}
module.exports={loopback,safeExternal,verifyBundled,verifyExisting,deploymentRoot,mutable};
