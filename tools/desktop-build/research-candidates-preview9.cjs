'use strict';
const fs=require('node:fs'),path=require('node:path'),{promisify}=require('node:util'),{execFile}=require('node:child_process');
const exec=promisify(execFile),root=path.resolve(__dirname,'../..');
const out=path.join(__dirname,'seeds','catalog-candidates.preview9.json');
if(fs.existsSync(out))throw Error('Immutable new-candidate snapshot exists');
const recorded=new Set(require(path.join(root,'challengers.json')).projects.map(x=>x.repository.toLowerCase()));
const proposed=[
 ['tangency-labs/solidcraft','SolidCraft','3D & Manufacturing','Parametric CAD, 3D printing and built-in MCP; high-priority VelvetOS CAD pipeline evaluation','desktop'],
 ['FreeCAD/FreeCAD','FreeCAD','3D & Manufacturing','Established CAD/B-Rep modelling and Python scripting; benchmark for local production CAD','desktop'],
 ['openscad/openscad','OpenSCAD','3D & Manufacturing','Scriptable deterministic parametric geometry, relevant to reproducible 3D-printing agents','desktop'],
 ['SoftFever/OrcaSlicer','OrcaSlicer','3D & Manufacturing','Slicer interoperability and documented preset formats; separate from active SliceBridge engine work','desktop'],
 ['GraphiteEditor/Graphite','Graphite','Design & Imaging','Local-first procedural/vector and graphic design alternative','desktop'],
 ['KDE/kdenlive','Kdenlive','Video & Animation','Mature open-source NLE with scriptable render pipeline','desktop'],
 ['dcc-mcp/dcc-mcp-core','DCC-MCP Core','Developer & Automation','Existing VelvetOS DCC integration pattern; adapter/CLI gateway candidate, not desktop application','integration'],
 ['ahujasid/mcp-for-blender','Blender MCP','Developer & Automation','Typed Blender agent bridge candidate; compare to the current DCC Gateway instead of duplicating','integration'],
 ['neka-nat/freecad-mcp','FreeCAD MCP','Developer & Automation','Agent control of FreeCAD; verify host-version compatibility and local tool contracts','integration'],
 ['earthtojake/text-to-cad','text-to-cad','3D & Manufacturing','Text-to-STEP/STL local CAD agent candidate; inspect subscription/API requirements before use','integration'],
 ['varvedesign/varve','Varve','Design & Imaging','Recent local-first integrated drawing/layout candidate; source-available licence requires review','desktop'],
 ['Paraxdev/FundaCAD','FundaCAD','3D & Manufacturing','New 3D-printing parametric CAD candidate, experimental; requires binary validation','desktop'],
 ['OpenCut-app/OpenCut','OpenCut','Video & Animation','Video-editing alternative; inspect release and real desktop install readiness','desktop'],
 ['Comfy-Org/ComfyUI','ComfyUI','AI & Agents','Node-based creative image/video generation for local GPU; useful for VelvetOS creative automation','desktop']
];
const clean=/^[a-zA-Z0-9-]{1,40}\/[A-Za-z0-9_.-]{1,100}$/;
async function gh(route){
 const {stdout}=await exec('gh',['api',route],{windowsHide:true,timeout:28000,maxBuffer:7e6});
 return JSON.parse(stdout);
}
(async()=>{
 let cursor=0,rows=new Array(proposed.length);
 async function worker(){while(cursor<proposed.length){
  const i=cursor++,[repository,title,category,reason,kind]=proposed[i];
  try{
   if(!clean.test(repository)||recorded.has(repository.toLowerCase()))throw Error('Already tracked or invalid repo');
   const m=await gh('/repos/'+repository),upstream=m.full_name;
   if(!upstream||!clean.test(upstream)||m.archived||m.disabled)throw Error('Repository unavailable or archived');
   let stable=null,releases=0;
   try{
    const a=await gh('/repos/'+upstream+'/releases?per_page=6');releases=a.length;
    stable=a.find(x=>!x.draft&&!x.prerelease)||null;
   }catch(_){}
   const license=m.license?.spdx_id==='NOASSERTION'?null:m.license?.spdx_id||null;
   rows[i]={id:upstream.toLowerCase().replace(/[^a-z0-9]+/g,'-'),title,repository:upstream,repoUrl:m.html_url,
    category,kind,whyReview:reason,description:(m.description||'').slice(0,360),language:m.language||null,
    stars:m.stargazers_count,pushedAt:m.pushed_at,repoUpdatedAt:m.updated_at,
    archived:!!m.archived,disabled:!!m.disabled,officialLicense:license,
    latestPublishedStableTag:stable?.tag_name||null,releaseDate:stable?.published_at||null,
    releaseUrl:stable?.html_url||null,checkedAt:new Date().toISOString(),
    assessment:'new-unreviewed',installable:false,installerAdapter:null,platformsConfirmed:false,
    source:'Public official GitHub repository + GitHub releases; not a certified binary or automatic installer'};
   console.log('NEW_CANDIDATE_VERIFIED '+JSON.stringify({repo:upstream,stars:rows[i].stars,stable:rows[i].latestPublishedStableTag,license,kind}));
  }catch(e){
   rows[i]={repository,title,assessment:'unavailable-research',error:String(e.message).slice(0,150),installable:false};
   console.log('NEW_CANDIDATE_UNAVAILABLE '+repository+' '+e.message);
  }
 }}
 await Promise.all(Array.from({length:3},worker));
 const successes=rows.filter(x=>x.assessment==='new-unreviewed');
 if(successes.length<10)throw Error('Insufficient current candidate sources');
 const summary={total:proposed.length,verified:successes.length,missing:proposed.length-successes.length,
  releasesKnown:successes.filter(x=>x.latestPublishedStableTag).length,
  licensesKnown:successes.filter(x=>x.officialLicense).length};
 const state={schema:'challenger-candidate-watchlist.v1',checkedAt:new Date().toISOString(),
  purpose:'Source-verified new applications and integration candidates; research only; no installer rights or automatic inclusion in vetted catalog',
  summary,candidates:rows};
 fs.writeFileSync(out,JSON.stringify(state,null,2)+'\n');
 console.log('WATCHLIST_SOURCE_VERIFIED '+JSON.stringify({output:out,summary}));
})().catch(e=>{console.error(e.stack);process.exitCode=1});
