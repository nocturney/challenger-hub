'use strict';
/*
 * Operator-only source evidence verifier. No file downloads, execution, app writes or approvals.
 * Only accesses official GitHub repository metadata, releases, and README via existing gh auth.
 */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
const {safeOutput}=require('./scout.cjs');
const NAME=/^[\w.-]{1,100}\/[\w.-]{1,100}$/;
const MAX_README=240000;
function repoName(v){
 const s=String(v||'').trim();
 if(!NAME.test(s)||s.includes('..'))throw Error('Invalid GitHub repository: '+s);
 return s;
}
function options(argv){
 const o={input:null,repos:[],limit:15,out:null};
 for(let i=0;i<argv.length;i++){
  const a=argv[i],v=argv[i+1];
  if(a==='--input'){o.input=path.resolve(v);i++}
  else if(a==='--repos'){o.repos=v.split(',').map(repoName);i++}
  else if(a==='--limit'){o.limit=Number(v);i++}
  else if(a==='--out'){o.out=path.resolve(v);i++}
  else if(a==='--help'||a==='-h'){o.help=true}
  else throw Error('Unknown option '+a);
 }
 if(!Number.isInteger(o.limit)||o.limit<1||o.limit>30)throw Error('Limit 1..30');
 if(!o.input&&o.repos.length===0&&!o.help)throw Error('Provide --input <private-scout.json> or --repos owner/repo,...');
 return o;
}
function choose(o){
 const seen=new Set(),all=[...o.repos];
 if(o.input){
  const j=JSON.parse(fs.readFileSync(o.input,'utf8'));
  if(j.schema!=='challenger-operator-scout.v1'||!Array.isArray(j.candidates))throw Error('Incorrect private Scout input schema');
  all.push(...j.candidates.map(x=>x.repository));
 }
 return all.map(repoName).filter(n=>{let key=n.toLowerCase();if(seen.has(key))return false;seen.add(key);return true}).slice(0,o.limit);
}
function platformAssets(names){
 const platforms={windows:[],macos:[],linux:[]};
 for(const a of (names||[])){
  const name=String(a||''),v=name.toLowerCase();
  if(!/\.(exe|msi|msix|dmg|pkg|appimage|deb|rpm|zip|tar\.(gz|zst)|tgz)$/.test(v))continue;
  if(/\.(blockmap|sig|sha256|asc)$/.test(v))continue;
  if(/\.(exe|msi|msix)$/.test(v)||/win(dows)?[-_.]|win32|win64|x86_64-pc-windows/.test(v))platforms.windows.push(name);
  if(/\.(dmg|pkg)$/.test(v)||/mac(os)?[-_.]|darwin|apple-darwin|osx|\.app\.tar/.test(v))platforms.macos.push(name);
  if(/\.(appimage|deb|rpm)$/.test(v)||/linux|unknown-linux/.test(v))platforms.linux.push(name);
 }
 return platforms;
}
function inspectReadme(markdown){
 const src=String(markdown||'').slice(0,MAX_README);
 const text=src.replace(/!\[[^\]]*\]\([^)]+\)/g,' ').replace(/\[[^\]]+\]\([^)]+\)/g,' ').replace(/[#*_>|]/g,' ');
 const looksScreenshot=/!\[[^\]]{0,140}\]\([^)]+\)|<img\b/i.test(src);
 const saysDemo=/\b(live demo|try online|demo video|screenshots?|screen recording)\b/i.test(src);
 const platformClaims={
  windows:/\bwindows\b|win(32|64)|\.exe\b|\.msi\b/i.test(src),
  macos:/\bmacos\b|\bmac os\b|\bmac\b|\.dmg\b/i.test(src),
  linux:/\blinux\b|\.appimage\b|\.deb\b/i.test(src)
 };
 const keyMention=/(OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY|GEMINI_API_KEY|API[_ -]?KEY|bring.your.own.key|BYOK|cloud inference|paid api)/i.test(src);
 return {
  markdownCharacters:src.length,words:text.trim()?text.trim().split(/\s+/).length:0,
  imageReferenced:looksScreenshot,demoMention:saysDemo,
  platformClaimsInDocs:platformClaims,potentialExternalAIKeyRequirement:keyMention
 };
}
function verifyEvidence(repository,metadata,releases,readme){
 const canonical=repoName(metadata?.full_name||repository);
 const stable=Array.isArray(releases)?releases.filter(r=>r&&!r.draft&&!r.prerelease):[];
 const latest=stable[0]||null;
 const names=Array.isArray(latest?.assets)?latest.assets.map(x=>String(x.name||'')):[];
 const platforms=platformAssets(names);
 const readmeSignals=inspectReadme(readme);
 const license=metadata?.license?.spdx_id;
 const sourceStatus=metadata?.archived?'archived':
  metadata?.disabled?'disabled':metadata?.fork?'fork':
  metadata?.is_template?'template':'source-accessible';
 const experimental=/\b(alpha|beta|preview|experimental|pre[- ]?alpha)\b/i.test(latest?.name||'')||
  /\b(alpha|beta|preview|rc)\b/i.test(latest?.tag_name||'');
 const checks=[
  {name:'Official GitHub repository',status:sourceStatus==='source-accessible'?'observed':'warning'},
  {name:'License classification',status:license&&license!=='NOASSERTION'?'observed':'unconfirmed'},
  {name:'Source README',status:readmeSignals.words>=100?'substantial':readmeSignals.words?'brief':'missing'},
  {name:'Published GitHub Release',status:latest?'observed':'none-observed'},
  {name:'Platform binary filenames',status:Object.values(platforms).some(x=>x.length)?'observed':'none-observed'}
 ];
 const warnings=[];
 if(sourceStatus!=='source-accessible')warnings.push('Repository status: '+sourceStatus);
 if(!license||license==='NOASSERTION')warnings.push('Repository does not provide recognized GitHub SPDX license metadata');
 if(!latest)warnings.push('No non-prerelease GitHub Release observed; distribution might exist elsewhere');
 if(experimental)warnings.push('Release name/tag indicates experimental maturity even if GitHub does not set prerelease flag');
 if(readmeSignals.words<100)warnings.push('README is short or unavailable; manually inspect product behavior');
 if(readmeSignals.potentialExternalAIKeyRequirement)warnings.push('Documentation mentions API keys or cloud; review real cost and provider dependencies');
 return {
  repository:canonical,requestedRepository:repository,
  url:'https://github.com/'+canonical,
  snapshotAt:new Date().toISOString(),
  sourceStatus,createdAt:metadata?.created_at||null,pushedAt:metadata?.pushed_at||null,
  stars:metadata?.stargazers_count??null,licenseSPDX:license&&license!=='NOASSERTION'?license:null,
  description:String(metadata?.description||'').slice(0,550),
  homepage:typeof metadata?.homepage==='string'&&/^https:\/\//.test(metadata.homepage)?metadata.homepage:null,
  language:metadata?.language||null,
  release:latest?{tag:latest.tag_name,publishedAt:latest.published_at||null,
   url:latest.html_url||('https://github.com/'+canonical+'/releases'),
   assetCount:names.length,experimentalName:experimental,platformAssetNames:platforms}:null,
  readme:readmeSignals,checks,warnings,
  assessment:'operator-review-required',installable:false,installerAdapter:null,
  caveat:'Official GitHub metadata and filename observations only. No app execution, binary integrity or product suitability checked.'
 };
}
async function api(route){
 const {stdout}=await exec('gh',['api','-X','GET',route],{windowsHide:true,timeout:35000,maxBuffer:8*1024*1024});
 return JSON.parse(stdout);
}
async function oneRepo(repository,client=api){
 const parts=repoName(repository);
 const meta=await client('repos/'+parts);
 if(!meta?.full_name)throw Error('GitHub repository response missing full_name');
 const canonical=repoName(meta.full_name);
 let releases=null,readme='',problems=[];
 try{releases=await client('repos/'+canonical+'/releases?per_page=8')}
 catch(e){problems.push('GitHub releases unavailable: '+String(e.message).slice(0,140))}
 try{
  const doc=await client('repos/'+canonical+'/readme');
  if(doc?.encoding==='base64'&&typeof doc.content==='string'&&doc.size<=MAX_README)
   readme=Buffer.from(doc.content.replace(/\s/g,''),'base64').toString('utf8');
  else problems.push('README unavailable or larger than safe text cap');
 }catch(e){problems.push('README API unavailable: '+String(e.message).slice(0,140))}
 const res=verifyEvidence(repository,meta,releases,readme);
 res.warnings.push(...problems);
 return res;
}
function md(report){
 const lines=[
  '# Challenger — private source evidence review', '',
  'Generated: '+report.generatedAt,
  'Private operator research. GitHub metadata, README text and release asset names only.',
  '**No product was run, downloaded, installed, automatically approved or published in the Hub.**',
  '',
  '| Project | Source | SPDX | Published release | GitHub release platform files | Notes |',
  '| --- | --- | --- | --- | --- | --- |'
 ];
 const clean=x=>String(x||'—').replace(/[|\n\r<>{}]/g,' ').slice(0,220);
 for(const a of report.results){
  if(a.error){lines.push('| '+clean(a.repository)+' | error | — | — | — | '+clean(a.error)+' |');continue}
  const ps=a.release?.platformAssetNames||{};
  const platforms=Object.entries(ps).filter(([,v])=>v.length>0).map(([k,v])=>k+' ('+v.length+')').join(', ');
  const n=a.warnings?.slice(0,2).join('; ')||'No immediate source-metadata warning';
  lines.push('| ['+clean(a.repository)+']('+a.url+') | '+clean(a.sourceStatus)+' | '+clean(a.licenseSPDX)+
   ' | '+clean(a.release?.tag)+(a.release?.experimentalName?' [experimental label]':'')+
   ' | '+clean(platforms)+' | '+clean(n)+' |');
 }
 lines.push('','## What human qualification still requires','','Verify the actual application with screenshots or a hands-on sandbox, product differences, its real platform support and installer provenance; evaluate license, maintenance and cloud/API costs. Never treat GitHub release filenames as vetted installers.','');
 for(const a of report.results.filter(x=>!x.error)){
  lines.push('### '+a.repository,'','- '+a.description,
   '- Source: '+a.url,
   '- Release: '+(a.release?.url||'No stable GitHub release observed'),
   '- README: '+a.readme.words+' words, image references '+(a.readme.imageReferenced?'found':'not observed')+
   ', demo mention '+(a.readme.demoMention?'yes':'no'),
   '- Flags: '+(a.warnings.join('; ')||'None from repository metadata')+
   '','');
 }
 return lines.join('\n');
}
function defaultOutput(){
 return path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),
  'ChallengerOperator','Scout');
}
async function main(argv=process.argv.slice(2)){
 const o=options(argv);
 if(o.help){console.log('node verify.cjs --input PRIVATE_SCOUT_JSON [--limit 15] [--out DIR] or --repos owner/repo,...');return}
 const names=choose(o);
 const results=[];
 for(let i=0;i<names.length;i++){
  const name=names[i];
  try{
   const evidence=await oneRepo(name);results.push(evidence);
   console.log('SCOUT_EVIDENCE '+(i+1)+'/'+names.length+' '+name+' release='+
    (evidence.release?.tag||'none')+' source='+evidence.sourceStatus+
    ' assets='+Object.values(evidence.release?.platformAssetNames||{}).reduce((n,x)=>n+x.length,0));
  }catch(e){
   results.push({repository:name,error:String(e.message).slice(0,350),assessment:'source-error',installable:false});
   console.error('SCOUT_EVIDENCE_ERROR '+name+' '+String(e.message).slice(0,200));
  }
 }
 const report={
  schema:'challenger-operator-evidence.v1',generatedAt:new Date().toISOString(),
  visibility:'operator-local-only',process:'source-review-not-approval',
  total:names.length,successful:results.filter(x=>!x.error).length,
  results
 };
 const dir=safeOutput(o.out||defaultOutput());
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const stamp=report.generatedAt.replace(/[:.]/g,'-');
 const json=path.join(dir,'evidence-'+stamp+'.json'),markdown=path.join(dir,'evidence-'+stamp+'.md');
 fs.writeFileSync(json,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
 fs.writeFileSync(markdown,md(report),{flag:'wx',mode:0o600});
 console.log('SCOUT_EVIDENCE_READY '+JSON.stringify({total:report.total,successful:report.successful,
  hasPublishedRelease:results.filter(x=>x.release).length,files:[markdown,json]}));
}
if(require.main===module)main().catch(e=>{console.error('SCOUT_VERIFY_FAILED '+e.stack);process.exitCode=1});
module.exports={repoName,platformAssets,inspectReadme,verifyEvidence,options,choose,oneRepo,md};
