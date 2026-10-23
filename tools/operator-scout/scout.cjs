'use strict';
/*
 * Challenger Operator Scout (local, manual, read-only).
 * Not loaded by the Hub, not bundled into the desktop EXE and never modifies its registry.
 */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
const ROOT=path.resolve(__dirname,'../..');
const NO_OBVIOUS=new Set([
 'blender/blender','gimp/gimp','comfy-org/comfyui','freecad/freecad',
 'openscad/openscad','kde/kdenlive','inkscape/inkscape','obsproject/obs-studio',
 'godotengine/godot','ollama/ollama','microsoft/vscode','lmstudio-ai/lmstudio'
]);
const IDEAS=[
 ['AI-native editors','ai native editor'],
 ['Agent-driven creative software','agent design tool'],
 ['Local AI applications','local first ai'],
 ['Next generation video','ai video editor'],
 ['Image and graphics','ai image editor'],
 ['New CAD and 3D','ai cad 3d'],
 ['Procedural design','procedural design editor'],
 ['Desktop automation','agent desktop app'],
 ['Creative agent integrations','mcp creative app'],
 ['Local music production','ai music studio'],
 ['Document and office challengers','ai document editor'],
 ['Independent software','open source creative desktop']
];
function monthsAgo(months,now=new Date()){
 const at=new Date(now);at.setUTCMonth(at.getUTCMonth()-months);
 return at.toISOString().slice(0,10);
}
function queries(since=12,now=new Date()){
 const boundary=monthsAgo(since,now);
 return IDEAS.map(([focus,phrase])=>({focus,q:phrase+' in:name,description created:>='+boundary+
   ' fork:false archived:false'}));
}
function ageDays(value,now=Date.now()){
 const time=Date.parse(value||'');
 return Number.isFinite(time)?Math.max(0,Math.floor((now-time)/86400000)):null;
}
function kindOf(repo){
 const desc=String(repo.description||'').toLowerCase();
 const s=(desc+' '+(repo.topics||[]).join(' ')).toLowerCase();
 // A genuine desktop app stays a desktop app even when it also advertises MCP integration.
 if(/(desktop|native app|electron|tauri|macos|windows|note-taking app|3d modeller|3d modeler|slicer)/.test(desc))return 'desktop';
 if(/(^|\W)(mcp|plugin|extension|sdk|integration|agent server)(\W|$)/.test(s))return 'integration';
 if(/(web app|browser-based|self-hosted|web-based|saas)/.test(desc))return 'web';
 return 'unconfirmed';
}
function productSignal(desc){
 const s=String(desc||'').toLowerCase().trim();
 if(s.length<35)return false;
 if(/(awesome[- ]|curated directory|curated list|collection of|master curriculum|course for|study guide|ultimate .* guide|trainer .* guide|learning resources|tutorial|boilerplate|prompt collection|best root apps|dataset of|reference list)/.test(s))return false;
 if(/(crusader kings|midtown madness|hero siege|game mod|game overlay|bible study app)/.test(s))return false;
 return /(app|application|editor|studio|workspace|software|desktop|cad|slicer|modeller|modeler|design|drawing|image|video|audio|animation|automati|workflow|productivity|client|agent|mcp|gui|visual|platform|creative|tool)/.test(s);
}
function rank(repo,now=Date.now()){
 if(!repo||repo.fork||repo.archived||repo.disabled||
    !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repo.full_name||''))return null;
 const created=ageDays(repo.created_at,now),lastPush=ageDays(repo.pushed_at,now);
 const stars=Math.max(0,Number(repo.stargazers_count)||0);
 const desc=String(repo.description||'').trim();
 if(!productSignal(desc))return null;
 const hay=(desc+' '+(Array.isArray(repo.topics)?repo.topics.join(' '):'')).toLowerCase();
 const signals=[];
 let score=0;
 if(created!==null){
  if(created<=90){score+=34;signals.push('Created in the last 90 days')}
  else if(created<=180){score+=28;signals.push('Created within 6 months')}
  else if(created<=365){score+=19;signals.push('Created within 12 months')}
  else if(created<=540){score+=8}
  else score-=18;
 }
 if(lastPush!==null){
  if(lastPush<=14){score+=15;signals.push('Code updated within 14 days')}
  else if(lastPush<=45){score+=10;signals.push('Recently updated source')}
  else if(lastPush<=90){score+=4}
  else if(lastPush>180)score-=23;
 }
 if(stars>=8&&stars<=2000){score+=11;signals.push('Emerging repository')}
 else if(stars>2000&&stars<=12000){score+=5}
 else if(stars>20000)score-=18;
 else if(stars<=2)score-=12;
 const terms=[
  ['local-first',7],['offline',5],['agentic',8],['agent',4],
  ['generative',5],['procedural',7],['parametric',7],['workflow',3],
  ['editor',6],['desktop',4],['design',3],['creative',3],
  ['cad',7],['3d',3],['video',4],['audio',4],['drawing',5],
  ['mcp',5],['open source',3],['app',2]
 ];
 let termsScore=0;
 for(const [term,points] of terms)if(hay.includes(term))termsScore+=points;
 score+=Math.min(termsScore,25);
 if(/\b(ai|llm|agentic|generative)\b/.test(hay)){
  score+=9;signals.push('AI-related description/topic (not proof of AI-built origin)');
 }
 if(/\b(library|sdk|benchmark|dataset|boilerplate|template|awesome-list|paper reproduction)\b/.test(hay)){
  score-=16;signals.push('May be a component rather than usable software');
 }
 if(desc.length<24)score-=13;
 if(!repo.has_issues)score-=2;
 const kind=kindOf(repo);
 if(kind==='desktop')score+=8;
 if(kind==='integration')score+=2;
 const topic=Array.isArray(repo.topics)?repo.topics.slice(0,12):[];
 const fullName=repo.full_name;
 return {
  repository:fullName,url:'https://github.com/'+fullName,description:desc,
  createdAt:repo.created_at||null,lastCodePush:repo.pushed_at||null,
  stars,language:repo.language||null,topics:topic,
  licenseSPDX:repo.license?.spdx_id&&repo.license.spdx_id!=='NOASSERTION'?repo.license.spdx_id:null,
  website:typeof repo.homepage==='string'&&/^https:\/\//i.test(repo.homepage)?repo.homepage:null,
  kind,score,why:signals.slice(0,5),
  review:'pending-operator-review',installable:false,installerAdapter:null,
  note:'GitHub source observations only. Product quality, platforms, binaries and AI-built origin are NOT verified.'
 };
}
function knownRepos(root=ROOT){
 const known=new Set(NO_OBVIOUS);
 for(const file of ['challengers.json','tools/desktop-build/seeds/catalog-candidates.preview10.json']){
  try{
   const data=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
   for(const r of (data.projects||data.candidates||[])){
    if(typeof r.repository==='string')known.add(r.repository.toLowerCase());
   }
  }catch(e){if(e.code!=='ENOENT')throw e}
 }
 return known;
}
function shortlist(batches,{known=new Set(),max=35,now=Date.now()}={}){
 const dedup=new Map(),excluded=known instanceof Set?known:new Set(known);
 for(const batch of batches){
  for(const repo of batch.items||[]){
   if(!repo||excluded.has(String(repo.full_name).toLowerCase()))continue;
   const item=rank(repo,now);
   if(!item)continue;
   const id=item.repository.toLowerCase();
   const prev=dedup.get(id);
   if(!prev||item.score>prev.score)dedup.set(id,item);
  }
 }
 return [...dedup.values()].sort((a,b)=>b.score-a.score||a.repository.localeCompare(b.repository))
  .slice(0,max);
}
function argsOf(argv){
 const options={months:12,limit:35,perQuery:20,out:null,fixture:null};
 for(let i=0;i<argv.length;i++){
  const arg=argv[i],value=argv[i+1];
  if(arg==='--months'){options.months=Number(value);i++}
  else if(arg==='--limit'){options.limit=Number(value);i++}
  else if(arg==='--per-query'){options.perQuery=Number(value);i++}
  else if(arg==='--out'){options.out=path.resolve(value);i++}
  else if(arg==='--fixture'){options.fixture=path.resolve(value);i++}
  else if(arg==='--help'||arg==='-h')options.help=true;
  else throw Error('Unsupported option: '+arg);
 }
 if(!Number.isInteger(options.months)||options.months<1||options.months>24)throw Error('--months: 1..24');
 if(!Number.isInteger(options.limit)||options.limit<1||options.limit>100)throw Error('--limit: 1..100');
 if(!Number.isInteger(options.perQuery)||options.perQuery<1||options.perQuery>30)throw Error('--per-query: 1..30');
 return options;
}
function defaultOutput(){
 return path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),
  'ChallengerOperator','Scout');
}
function safeOutput(out){
 const target=path.resolve(out),relative=path.relative(ROOT,target);
 if(relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))
  throw Error('Private Scout output cannot be written inside the public Challenger repository');
 return target;
}
async function ghSearch(q,perQuery){
 const {stdout}=await exec('gh',['api','-X','GET','search/repositories','-f','q='+q,
  '-f','per_page='+perQuery,'-f','sort=updated','-f','order=desc'],
  {timeout:45000,maxBuffer:12*1024*1024,windowsHide:true});
 const result=JSON.parse(stdout);
 if(!Array.isArray(result.items))throw Error('No items array from official GitHub search API');
 return result.items;
}
function markdown(result){
 const lines=[
  '# Challenger Operator Scout — private research queue',
  '',
  'Generated: '+result.generatedAt,
  'Source: authenticated GitHub repository search, read-only. This is not a product endorsement.',
  '',
  'Nothing has been imported into the Challenger catalogue, installed or approved.',
  'AI-native indicators are signals from repository text, never proof that AI built the software.',
  '',
  '| Rank | Source project | Score | Type | Created | Stars | Why investigate |',
  '| ---: | --- | ---: | --- | --- | ---: | --- |'
 ];
 for(const [i,c] of result.candidates.entries()){
  const clean=s=>String(s||'').replace(/[|\n\r]/g,' ').slice(0,200);
  lines.push('| '+(i+1)+' | ['+clean(c.repository)+']('+c.url+') | '+c.score+' | '+
   c.kind+' | '+clean(c.createdAt?.slice(0,10))+' | '+c.stars+' | '+clean(c.why.join('; '))+' |');
 }
 lines.push('','## Follow-up review','',
  'Check official website/demo, product behavior, first real release, licensing, supported platforms, price/API dependence, and binary provenance.',
  'Review candidates manually. A source-verified repo must never auto-grant installation rights.',
  '');
 if(result.errors.length)lines.push('## Search errors','',...result.errors.map(e=>'- '+e.focus+': '+e.error),'');
 return lines.join('\n');
}
async function main(argv=process.argv.slice(2)){
 const options=argsOf(argv);
 if(options.help){
  console.log('node tools/operator-scout/scout.cjs [--months 12] [--limit 35] [--per-query 20] [--out ABSOLUTE_PRIVATE_DIR] [--fixture JSON]');
  return;
 }
 const wanted=queries(options.months),batches=[],errors=[];
 if(options.fixture){
  const data=JSON.parse(fs.readFileSync(options.fixture,'utf8'));
  if(!Array.isArray(data.batches))throw Error('Fixture must contain batches array');
  batches.push(...data.batches);
 }else{
  for(let i=0;i<wanted.length;i++){
   const {focus,q}=wanted[i];
   try{
    const items=await ghSearch(q,options.perQuery);
    batches.push({focus,items});
    console.log('SCOUT_SOURCE '+(i+1)+'/'+wanted.length+' '+focus+': '+items.length);
   }catch(e){
    const message=String(e.message).slice(0,300);
    errors.push({focus,error:message});
    console.error('SCOUT_SOURCE_ERROR '+focus+': '+message);
   }
  }
 }
 if(!batches.length)throw Error('No successful sources. No report was written.');
 const candidates=shortlist(batches,{known:knownRepos(),max:options.limit});
 const report={
  schema:'challenger-operator-scout.v1',generatedAt:new Date().toISOString(),
  visibility:'operator-local-only',status:'research-queue-no-automatic-import',
  basedOn:'Preview10 source list',queries:wanted,sourceCount:batches.length,
  errors,candidates
 };
 const directory=safeOutput(options.out||defaultOutput());
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const timestamp=report.generatedAt.replace(/[:.]/g,'-');
 const json=path.join(directory,'scout-'+timestamp+'.json');
 const md=path.join(directory,'scout-'+timestamp+'.md');
 fs.writeFileSync(json,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
 fs.writeFileSync(md,markdown(report),{mode:0o600,flag:'wx'});
 console.log('SCOUT_READY '+JSON.stringify({sources:batches.length,errors:errors.length,
  uniqueReviewed:candidates.length,privateReport:md,json}));
}
if(require.main===module)main().catch(e=>{console.error('SCOUT_FAILED '+e.message);process.exitCode=1});
module.exports={rank,shortlist,queries,knownRepos,argsOf,safeOutput,markdown,monthsAgo,kindOf};
