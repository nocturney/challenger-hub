'use strict';
// Resolve ONLY creator/project-source images; never guess a brand from a random dependency file.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=__dirname,manifestFile=path.join(ROOT,'official-icons.json');
const CACHE_DIR=path.join(ROOT,'.official-icon-cache'),TTL_MS=7*24*60*60*1000;
const inflight=new Map();
function manifest(){try{return JSON.parse(fs.readFileSync(manifestFile,'utf8')).projects||{}}catch(_){return {}}}
function accepted(app){
 if(!app||!/^[a-z][a-z0-9-]{1,79}$/i.test(app.repo||''))return null;
 const record=manifest()[app.repo],icon=record?.icon;
 if(!icon||!['official-file-confirmed','source-confirmed'].includes(record.status))return null;
 const expected=app.repository?.toLowerCase(),source=icon.repository?.toLowerCase();
 if(source!==expected&&!(app.repo==='cardinal'&&source==='distrho/cardinal-website'))return null;
 if(!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(source||''))return null;
 if(!/^[a-z0-9/_().+@ -]{2,260}\.(png|svg|jpg|jpeg|webp|ico|icns)$/i.test(icon.path||''))return null;
 if(icon.path.split('/').includes('..'))return null;
 const u=new URL(icon.rawUrl);
 if(u.protocol!=='https:'||u.hostname!=='raw.githubusercontent.com'||
   !decodeURIComponent(u.pathname).toLowerCase().startsWith('/'+source+'/'))return null;
 if(icon.extension==='icns'&&!icon.localDerived)return null; // only converted from official upstream file
 return icon;
}
function mimeFor(ext){
 switch(ext){case 'png':return 'image/png';case 'svg':return 'image/svg+xml';case 'webp':return 'image/webp';
 case 'jpg':case 'jpeg':return 'image/jpeg';case 'ico':return 'image/x-icon';default:return null;}
}
function check(bytes,ext){
 if(bytes.length<80||bytes.length>1900000)return false;
 if(ext==='png')return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(ext==='webp')return bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(ext==='jpeg'||ext==='jpg')return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(ext==='ico')return bytes[0]===0&&bytes[1]===0&&bytes[2]===1&&bytes[3]===0;
 if(ext==='svg'){
  const txt=bytes.toString('utf8');
  return /<svg[\s>]/i.test(txt)&&!/<script|<foreignobject|\son\w+\s*=|javascript:|<iframe|<object|<embed|@import|url\s*\(\s*["']?https?:/i.test(txt);
 }
 return false;
}
function filePath(id,ext){return path.join(CACHE_DIR,id+'.'+ext)}
function cached(id,ext){
 const p=filePath(id,ext);
 try{const stat=fs.statSync(p);if(stat.size<80||stat.size>1900000)return null;
  const bytes=fs.readFileSync(p);return check(bytes,ext)?{bytes,mime:mimeFor(ext),cached:true,expired:Date.now()-stat.mtimeMs>TTL_MS}:null;
 }catch(_){return null}
}
async function download(icon,id){
 const ext=icon.extension,mime=mimeFor(ext);if(!mime)return null;
 const old=cached(id,ext);if(old&&!old.expired)return old;
 try{
  const response=await fetch(icon.rawUrl,{headers:{'User-Agent':'ChallengerHub/2.5'},signal:AbortSignal.timeout(14000)});
  if(!response.ok||!response.body)throw Error('HTTP '+response.status);
  if(new URL(response.url).hostname!=='raw.githubusercontent.com')throw Error('Redirected icon host');
  let size=0;const parts=[];
  for await(const x of response.body){size+=x.length;if(size>1900000)throw Error('Icon is too large');parts.push(x)}
  const bytes=Buffer.concat(parts);
  if(!check(bytes,ext))throw Error('Logo image failed content validation');
  fs.mkdirSync(CACHE_DIR,{recursive:true});
  const dest=filePath(id,ext),tmp=dest+'.'+process.pid+'.tmp';
  fs.writeFileSync(tmp,bytes);fs.renameSync(tmp,dest);
  return {bytes,mime,source:icon.rawUrl};
 }catch(_){return old||null}
}
function iconMeta(app){
 const record=manifest()[app?.repo],icon=accepted(app);
 return {officialIconAvailable:!!icon,officialIconSource:icon?.path||null,
   officialIconStatus:icon?'Verified creator-controlled source file':record?.icon?'Source needs browser conversion':'Official icon not yet verified'};
}
async function iconFor(app){
 const icon=accepted(app);
 if(!icon)return null;
 if(icon.localDerived){
   if(!/^local-icons\/[a-z0-9-]+\.png$/.test(icon.localDerived))return null;
   try{
     const file=path.join(ROOT,icon.localDerived),bytes=fs.readFileSync(file);
     if(!check(bytes,'png'))return null;
     const expected=icon.derivedHashes?.[process.platform];
     if(!expected||crypto.createHash('sha256').update(bytes).digest('hex')!==expected)return null;
     return {bytes,mime:'image/png',source:'Converted from official project ICNS with verified SHA-256'};
   }catch(_){return null}
 }
 // Cache is bound to the verified upstream source URL, not just the project name.
 // A curator-approved icon replacement must never reuse stale image bytes.
 const key=String(app.repo)+'-'+crypto.createHash('sha256').update(icon.rawUrl).digest('hex').slice(0,16);
 if(!inflight.has(key))inflight.set(key,download(icon,key).finally(()=>inflight.delete(key)));
 return inflight.get(key);
}
module.exports={iconFor,iconMeta};
