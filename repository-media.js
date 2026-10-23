'use strict';
// Own-repository screenshot previews and creator avatar fallback.
// Screenshot bytes are fetched only from the explicitly curated project's own GitHub repository.
// Creator avatar != product logo. Unverified marketing artwork is not shown as app UI.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {promisify}=require('node:util'),{execFile}=require('node:child_process');
const exec=promisify(execFile),REPO=/^[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100}$/i;
const ID=/^[a-z][a-z0-9-]{1,79}$/i,MAX_IMAGE=4200000;
const cache=new Map(),running=new Map(),avatars=new Map();
function safeImage(data,kind='screen'){
 if(!Buffer.isBuffer(data)||data.length<(kind==='avatar'?160:6000)||data.length>MAX_IMAGE)return null;
 if(data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
  const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
  if(width<(kind==='avatar'?32:480)||height<(kind==='avatar'?32:230)||width>15000||height>15000)return null;
  return {mime:'image/png',width,height};
 }
 if(data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP')
  return {mime:'image/webp',width:null,height:null};
 if(data[0]===255&&data[1]===216&&data[2]===255&&data.length>(kind==='avatar'?160:6000))
  return {mime:'image/jpeg',width:null,height:null};
 return null;
}
function candidates(markdown){
 const results=[];
 for(const m of markdown.matchAll(/!\[([^\]\r\n]{0,120})\]\(([^)\s]{3,290})(?:\s+"[^"]+")?\)/g))
  results.push({alt:m[1],url:m[2]});
 for(const m of markdown.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']{3,290})["'][^>]*>/gi)){
  const alt=/\balt\s*=\s*["']([^"']{0,120})["']/i.exec(m[0])?.[1]||'';
  results.push({alt,url:m[1]});
 }
 return results.sort((a,b)=>score(b)-score(a));
}
function score({alt='',url=''}) {
 const v=(alt+' '+url).toLowerCase();
 if(/badge|shields\.io|button|logo|brand|splash|donate|download|workflow/i.test(v))return -100;
 let n=0;if(/\bscreenshot\b|screen[_-]?shot|capture[_-]?screen/i.test(v))n+=85;
 if(/\binterface\b|\bapplication ui\b|\bapp ui\b/i.test(v))n+=75;
 if(/[_/-]screenshot[s/_-]/.test(v))n+=35;
 if(/(?:^|[\/_-])editor(?:[\/_.-]|$)|dashboard|desktop[_-]?ui/i.test(v))n+=50;
 if(/preview/i.test(v))n+=15;
 return n;
}
function rawUrl(repository,branch,src){
 if(!REPO.test(repository)||!/^[a-zA-Z0-9._-]{1,100}$/.test(branch))return null;
 let rel=String(src||'').trim();
 if(rel.startsWith('https://raw.githubusercontent.com/')){
  try{
   const u=new URL(rel);
   const prefix='/'+repository+'/'+branch+'/';
   if(u.hostname!=='raw.githubusercontent.com'||!decodeURI(u.pathname).toLowerCase().startsWith(prefix.toLowerCase()))return null;
   rel=decodeURI(u.pathname).slice(prefix.length);
  }catch{return null}
 }else if(/^[a-z]+:/i.test(rel)||rel.startsWith('//'))return null;
 rel=rel.replace(/^\.\/+/,'').replace(/#.*/,'').split('?')[0];
 if(!rel||rel.startsWith('/')||rel.includes('..')||rel.includes('\\')||
   !/^[a-z0-9_@.+/-]{5,230}\.(png|jpg|jpeg|webp)$/i.test(rel))return null;
 return 'https://raw.githubusercontent.com/'+repository+'/'+branch+'/'+rel.split('/').map(encodeURIComponent).join('/');
}
async function fromOfficial(url,max=MAX_IMAGE){
 const u=new URL(url);
 if(u.protocol!=='https:'||!['raw.githubusercontent.com','avatars.githubusercontent.com'].includes(u.hostname))return null;
 const response=await fetch(url,{signal:AbortSignal.timeout(11500),headers:{'User-Agent':'ChallengerHubOfficialMedia/1.0'}});
 if(!response.ok||new URL(response.url).hostname!==u.hostname||!response.body)return null;
 const type=response.headers.get('content-type')||'';
 if(!/^image\/(png|webp|jpeg)(?:;|$)/i.test(type))return null;
 let total=0,chunks=[];
 for await (const x of response.body){total+=x.length;if(total>max)throw Error('Official image too large');chunks.push(x)}
 const bytes=Buffer.concat(chunks),format=safeImage(bytes,u.hostname==='avatars.githubusercontent.com'?'avatar':'screen');
 return format?{bytes,mime:format.mime,width:format.width,height:format.height}:null;
}
async function getReadme(repository,cli='gh'){
 let response=null;
 try{
  const r=await exec(cli,['api','/repos/'+repository+'/readme'],{timeout:9000,windowsHide:true,maxBuffer:2500000});
  response=JSON.parse(r.stdout);
 }catch(_){
  const url='https://api.github.com/repos/'+repository+'/readme';
  const r=await fetch(url,{headers:{'Accept':'application/vnd.github+json','User-Agent':'ChallengerHubMedia/1.0'},signal:AbortSignal.timeout(9000)});
  if(!r.ok)return null;response=await r.json();
 }
 if(response.encoding!=='base64'||typeof response.content!=='string'||response.content.length>1800000)return null;
 const markdown=Buffer.from(response.content,'base64').toString('utf8');
 if(markdown.length>1100000)return null;
 const match=/^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/([^/]+)\/(.+)$/i.exec(response.html_url||'');
 if(!match||!/^[a-zA-Z0-9._-]{1,100}$/.test(match[1]))return null;
 return {markdown,branch:match[1],readmeUrl:response.html_url};
}
function safeApp(app){
 return app&&app.discovery===true&&ID.test(app.repo||'')&&REPO.test(app.repository||'');
}
async function probe(app,{cli='gh'}={}){
 if(!safeApp(app))return null;
 const id=app.repo.toLowerCase(),existing=cache.get(id);
 if(existing&&Date.now()-existing.checkedAt<7*24*3600000&&existing.repo===app.repository)return existing;
 if(running.has(id))return running.get(id);
 const promise=(async()=>{
  const repo=app.repository;
  const readme=await getReadme(repo,cli);
  let found=null;
  if(readme){
   for(const candidate of candidates(readme.markdown).slice(0,18)){
    if(score(candidate)<50)break;
    const url=rawUrl(repo,readme.branch,candidate.url);if(!url)continue;
    try{
     const image=await fromOfficial(url);
     if(!image)continue;
     found={repo,checkedAt:Date.now(),available:true,source:readme.readmeUrl,
      caption:('Screenshot from '+repo+' official README').slice(0,170),
      kind:'official-readme-image',bytes:image.bytes,mime:image.mime,
      width:image.width,height:image.height};
     break;
    }catch(_){}
   }
  }
  if(!found)found={repo,checkedAt:Date.now(),available:false};
  cache.set(id,found);return found;
 })().finally(()=>running.delete(id));
 running.set(id,promise);return promise;
}
function avatarSource(app){
 const url=app?.ownerAvatarUrl;
 if(!safeApp(app)||!url)return null;
 try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='avatars.githubusercontent.com'&&
  /^\/u\/[0-9]+$/.test(u.pathname)&&(!u.search||/^\?v=[0-9]+$/.test(u.search))?url:null}
 catch{return null}
}
async function avatar(app){
 const url=avatarSource(app);if(!url)return null;
 const cached=avatars.get(url);
 if(cached&&Date.now()-cached.at<7*24*3600000)return cached.value;
 const image=await fromOfficial(url,900000).catch(()=>null);
 if(image)avatars.set(url,{at:Date.now(),value:image});
 return image;
}
module.exports={safeImage,candidates,score,rawUrl,safeApp,avatarSource,avatar,probe};
