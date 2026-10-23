'use strict';
/* Read-only, rate-aware, all-project source-media discovery; runs OFFLINE except authenticated
 * public GitHub API reads. Discovery is NOT license clearance or an installer allowlist. */
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(cp.execFile);
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'dist','all-project-media-audit.v1.json');
if(fs.existsSync(out))throw Error('Immutable audit report already present');
const p=require(path.join(root,'challengers.json')).projects,reg=JSON.parse(fs.readFileSync(path.join(__dirname,'seeds','curated-metadata.preview8.json'),'utf8')).items;
const EXTS=/\.(png|jpe?g|webp|svg)$/i;
const BAD=/(\b|\/)(node_modules|vendor|third_party|third-party|fixtures?|testdata|snapshots?|samples?\/training|__tests__|coverage|static\/fonts|fonts?|icons?\/flags|country-flags|emoji|shields|badge|donat(e|ion)|backgrounds?|wallpapers?|splash|avatars?\/|logos?\/partners?|logos?\/sponsors?)(\/|$)/i;
const RANK_SCREEN=[[/\bscreenshots?\b/i,110],[/screencap|screen[_-]?shot|screen[_-]?capture/i,100],[/(^|\/)docs?\/(images?|screenshots?)\//i,24],[/\b(dashboard|editor|interface|ui[-_.]|hero[-_.]|application|gui|overview|preview)\b/i,45],[/docs?\/assets/i,5]];
const RANK_ICON=[[/app[-_.]?icon|application[-_.]?icon/i,120],[/(^|\/)(resources?|assets?|docs?)\/(icons?|logos?)\//i,50],[/(^|\/)(logo|icon|appicon)([-_.@0-9]|\.)(png|svg|webp)/i,72],[/favicon|brand/i,28]];
function rate(p,type){
 let score=0;for(const [re,w] of type==='screen'?RANK_SCREEN:RANK_ICON)if(re.test(p))score+=w;
 if(type==='screen'){
  if(/(logo|icon|favicon|illustration|artwork|social|banner|poster|mockup|graph|workflow|architecture)/i.test(p))score-=110;
  if(/(thumb|small|mobile[-_.]|example[-_.]pixel)/i.test(p))score-=25;
 }else{
  if(/(social|logo[-_.]small|feature[-_.]icon|file[-_.]icon|tool[-_.]icon|test[-_.]|dist\/)/i.test(p))score-=95;
 }
 if(/readme|doc(s)?\//i.test(p))score+=5;
 if(/(\b|\/)(release|build|target|dist|compiled|cache|coverage)\//i.test(p))score-=40;
 return score;
}
function uniqueByPath(a){const seen=new Set();return a.filter(x=>!seen.has(x.path)&&seen.add(x.path))}
function candidatesFromTree(data,type){
 if(!Array.isArray(data?.tree))return [];
 const files=data.tree.filter(x=>x?.type==='blob'&&typeof x.path==='string'&&x.path.length<230&&EXTS.test(x.path)&&!BAD.test(x.path)&&
  x.size>450&&(type==='screen'?x.size<2200000:x.size<750000));
 return uniqueByPath(files.map(x=>({path:x.path,size:x.size,sha:x.sha,score:rate(x.path,type)}))
  .filter(x=>x.score>=(type==='screen'?55:58)).sort((a,b)=>b.score-a.score||a.size-b.size)).slice(0,8);
}
function fromReadme(md){
 const arr=[];
 for(const m of md.matchAll(/!\[([^\]\r\n]{0,130})\]\(([^)\s]{3,280})/g))
  arr.push({alt:m[1],url:m[2]});
 for(const m of md.matchAll(/<img\b[^>]*\bsrc\s*=\s*['"]([^'"]{3,280})['"][^>]*>/gi))
  arr.push({alt:(/alt\s*=\s*['"]([^'"]+)['"]/i.exec(m[0])||[])[1]||'',url:m[1]});
 return arr.slice(0,80).filter(x=>!/^data:|^\/\/|^https?:\/\/(?!raw\.githubusercontent\.com)/i.test(x.url))
  .map(x=>({...x,screenScore:rate(x.alt+' '+x.url,'screen'),iconScore:rate(x.alt+' '+x.url,'icon')}))
  .filter(x=>x.screenScore>=30||x.iconScore>=35).slice(0,24);
}
async function gh(url,seconds=16000){
 const {stdout}=await run('gh',['api',url],{windowsHide:true,maxBuffer:18*1024*1024,timeout:seconds});
 return JSON.parse(stdout);
}
async function one(app,index){
 const row=reg[app.id]||{},id=app.id,repository=app.repository,result={
  id,repository,reviewStatus:app.reviewStatus,license:row.officialLicense||app.license||null,
  description:row.sourceDescription||null,observedAt:row.lastObservedAt||null,
  tree:null,readme:null,errors:[],screenshots:[],icons:[],readmeImages:[]};
 try{
  const t=await gh('/repos/'+repository+'/git/trees/HEAD?recursive=1',23000);
  result.tree={commit:t.sha||null,truncated:!!t.truncated,files:t.tree?.length||0};
  result.screenshots=candidatesFromTree(t,'screen');result.icons=candidatesFromTree(t,'icon');
 }catch(e){result.errors.push('tree: '+String(e.message).slice(0,150))}
 try{
  const m=await gh('/repos/'+repository+'/readme',13000);
  if(m.encoding==='base64'&&typeof m.content==='string'&&m.content.length<=2000000){
   const md=Buffer.from(m.content,'base64').toString('utf8');
   result.readme={url:m.html_url||null,length:md.length};
   result.readmeImages=fromReadme(md);
  }else result.errors.push('readme: unexpected encoding or oversized');
 }catch(e){result.errors.push('readme: '+String(e.message).slice(0,150))}
 result.tier=(result.screenshots.length?'tree screenshot candidate ':'')+
  (result.icons.length?'tree icon candidate ':'')+(result.readmeImages.length?'README linked imagery':'');
 console.log('DEEP_MEDIA_SCAN '+JSON.stringify({i:index+1,id,files:result.tree?.files,shots:result.screenshots.length,icons:result.icons.length,readmeImages:result.readmeImages.length,errors:result.errors.length}));
 return result;
}
(async()=>{
 const all=new Array(p.length),threads=3;let cursor=0;
 async function worker(){while(cursor<p.length){const i=cursor++;all[i]=await one(p[i],i)}}
 await Promise.all(Array.from({length:threads},worker));
 const summary={scanned:all.length,treeOK:all.filter(x=>x.tree).length,truncated:all.filter(x=>x.tree?.truncated).length,
  treeImageCandidates:all.filter(x=>x.screenshots.length>0).length,
  iconCandidates:all.filter(x=>x.icons.length>0).length,
  readmeImageCandidates:all.filter(x=>x.readmeImages.length>0).length,
  withAnyCandidates:all.filter(x=>x.screenshots.length||x.icons.length||x.readmeImages.length).length,
  noCandidates:all.filter(x=>!x.screenshots.length&&!x.icons.length&&!x.readmeImages.length).map(x=>x.id),
  errors:all.filter(x=>x.errors.length).map(x=>({id:x.id,errors:x.errors})),
  reviewedWithScreens:all.filter(x=>x.reviewStatus==='repository-confirmed'&&x.screenshots.length).length};
 const report={schema:'challenger-media-deep-audit.v1',method:'GitHub official repository HEAD recursive tree + official README; metadata-only no installs',timestamp:new Date().toISOString(),summary,projects:all};
 fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
 console.log('DEEP_MEDIA_AUDIT_COMPLETE '+JSON.stringify({out,summary}));
})().catch(e=>{console.error('DEEP_MEDIA_AUDIT_ABORTED',e.stack||e);process.exitCode=1});
