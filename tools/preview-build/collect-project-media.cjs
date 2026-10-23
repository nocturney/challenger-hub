'use strict';
/* Collect only creator-owned source assets already allowlisted in official-icons.json.
 * Source audit is distinct from software installability/review status. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..','..');
const OUT=path.join(__dirname,'media-source'),IMAGE=path.join(OUT,'assets');
const ICONS=require(path.join(ROOT,'official-icons.js'));
const ICON_MANIFEST=require(path.join(ROOT,'official-icons.json')).projects;
const registry=require(path.join(ROOT,'challengers.json')).projects;
const IDS=['compositor','composa','dune3d','material-maker','kiri-moto','friction',
 'real-video-enhancer','infinite','zrythm','espocrm','docuseal','activepieces','meshcentral','openhands'];
const SCREENSHOTS=[
 {id:'dune3d',repository:'dune3d/dune3d',commit:'d01faaf16f309e55834c3b93dddce5c852453cfe',path:'screenshot.png',caption:'Dune 3D main window',
  evidencePath:'org.dune3d.dune3d.metainfo.xml'},
 {id:'material-maker',repository:'RodZill4/material-maker',commit:'424dec64a75478f22267ba9281a5cbe7a236b802',path:'material_maker/doc/images/screenshot.png',caption:'Material Maker node editor and material previews',
  evidencePath:'README.md'},
 {id:'real-video-enhancer',repository:'TNTwise/REAL-Video-Enhancer',commit:'8541c46ca14e6f84fc86c5b9d3b75373e25732e5',path:'screenshots/settings.png',caption:'REAL Video Enhancer application settings',
  evidencePath:'screenshots/settings.png'}
];
const ALLOWED=new Set(['MIT','Apache-2.0','BSD-2-Clause','BSD-3-Clause','MPL-2.0',
 'GPL-2.0','GPL-2.0-or-later','GPL-3.0','GPL-3.0-or-later','AGPL-3.0','AGPL-3.0-or-later',
 'LGPL-2.1','LGPL-2.1-or-later','LGPL-3.0','LGPL-3.0-or-later']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const asNum=v=>Number.isInteger(v)&&v>0&&v<=8192?v:null;
function pngDimensions(b){if(b.length<24||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Not PNG');return {width:asNum(b.readUInt32BE(16)),height:asNum(b.readUInt32BE(20))}}
async function getBytes(url,max=8000000){
 const u=new URL(url);
 if(u.protocol!=='https:'||!['raw.githubusercontent.com','dune3d.org'].includes(u.hostname))throw Error('Unapproved source host');
 const res=await fetch(url,{headers:{'User-Agent':'Challenger-Hub-Media-Audit/1'},signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!res.ok)throw Error('HTTP '+res.status);
 const parts=[];let n=0;
 for await(const x of res.body){n+=x.length;if(n>max)throw Error('Oversize asset');parts.push(x)}
 return Buffer.concat(parts);
}
async function repoLicense(repo){
 const u='https://api.github.com/repos/'+repo+'/license';
 try{
  const r=await fetch(u,{headers:{'User-Agent':'Challenger-Hub-Media-Audit/1','Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!r.ok)return null;
  const body=await r.json();
  const id=body.license?.spdx_id;
  return ALLOWED.has(id)?{spdx:id,url:body.html_url||'https://github.com/'+repo+'/blob/HEAD/LICENSE',download:body.download_url||null}:null;
 }catch(_){return null}
}
async function run(){
 fs.mkdirSync(IMAGE,{recursive:true});
 const manifest={schema:'challenger-project-media.v1',createdAt:new Date().toISOString(),
  sources:'creator-controlled repository files from official-icons.json; no hotlinking',
  screenshotPolicy:'Only authentic software UI from project-controlled files',
  projects:{}};
 const notes=['# Media provenance — Focus Orbit Preview 2','',
 'Source screenshots are screenshots of real applications, not generated artwork.',
 'The repository license is cited where known; trademarks remain with their respective owners.',
 'Images are bundled only when the project repository publishes them under an identified license.',''];
 const report=[];
 for(const id of IDS){
  const project=registry.find(p=>p.id===id);
  const record=ICON_MANIFEST[id];
  const out={title:project?.name||id,repo:project?.repository||null,status:'pending'};
  manifest.projects[id]=out;
  if(!project||!record){report.push({id,result:'no-manifest'});continue}
  const license=await repoLicense(project.repository);
  if(!license){report.push({id,result:'license-not-confirmed'});continue}
  out.license={spdx:license.spdx,url:license.url,basis:'Project repository license; no separate media exception found in manifest'};
  if(license.download){
   try{const bytes=await getBytes(license.download,200000);if(bytes.includes(0))throw Error('Binary license');
    fs.mkdirSync(path.join(OUT,'licenses'),{recursive:true});
    fs.writeFileSync(path.join(OUT,'licenses',id+'.txt'),bytes);
    out.license.localCopy='licenses/'+id+'.txt';
   }catch(err){report.push({id,result:'license-copy-unavailable',error:String(err.message)})}
  }
  const icon=await ICONS.iconFor({repo:id,repository:project.repository});
  if(!icon?.bytes){report.push({id,result:'icon-unavailable'});continue}
  const official=record.icon;
  const ext=official.localDerived?'png':official.extension.toLowerCase();
  if(!['png','svg','webp','jpg','jpeg','ico'].includes(ext)){report.push({id,result:'extension-unsupported'});continue}
  const rel='icons/'+id+'.'+ext;
  fs.mkdirSync(path.join(IMAGE,'icons'),{recursive:true});
  fs.writeFileSync(path.join(IMAGE,rel),icon.bytes);
  out.icon={path:'/media/'+rel,format:ext,source:official.rawUrl,repository:official.repository,
   sourcePath:official.path,licenseSpdx:license.spdx,size:icon.bytes.length,
   sha256:sha(icon.bytes),status:'approved',checkedAt:manifest.createdAt};
  out.status='icon-only';
  notes.push('* '+id+' icon: '+official.rawUrl+' — repository license '+license.spdx+' ('+license.url+')');
  report.push({id,result:'approved-icon',size:icon.bytes.length});
 }
 for(const entry of SCREENSHOTS){
  const project=manifest.projects[entry.id];
  if(!project?.icon||project.repo?.toLowerCase()!==entry.repository.toLowerCase()||!project.license?.spdx){
   report.push({id:entry.id,result:'screenshot-not-authorized-by-project-icon-and-license'});continue;
  }
  const source='https://raw.githubusercontent.com/'+entry.repository+'/'+entry.commit+'/'+entry.path;
  const evidence='https://github.com/'+entry.repository+'/blob/'+entry.commit+'/'+entry.evidencePath;
  try{
   const bytes=await getBytes(source,8000000),dim=pngDimensions(bytes);
   if(!dim.width||!dim.height||dim.width<600||dim.height<350||
     dim.width*dim.height>18000000)throw Error('Screenshot size/dimensions invalid');
   fs.mkdirSync(path.join(IMAGE,'screenshots'),{recursive:true});
   const rel='screenshots/'+entry.id+'.png';
   fs.writeFileSync(path.join(IMAGE,rel),bytes);
   project.screenshot={path:'/media/'+rel,source,sourceRepository:entry.repository,
    sourceCommit:entry.commit,reference:evidence,caption:entry.caption,
    provenance:'Developer-controlled repository screenshot; visually checked as real application UI',
    type:'application-ui-screenshot',status:'approved',
    licenseSpdx:project.license.spdx,licenseUrl:project.license.url,
    width:dim.width,height:dim.height,size:bytes.length,sha256:sha(bytes),checkedAt:manifest.createdAt};
   project.status='approved';
   notes.push('* '+entry.id+' authentic app UI: '+source+' — evidenced at '+evidence+
    ' — repository license '+project.license.spdx+' ('+project.license.url+')');
   report.push({id:entry.id,result:'authentic-screenshot',dimensions:dim,sha256:sha(bytes)});
  }catch(err){report.push({id:entry.id,result:'screenshot-unavailable',reason:String(err.message)})}
 }
 fs.writeFileSync(path.join(OUT,'project-media.v1.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(OUT,'THIRD_PARTY_MEDIA_NOTICES.md'),notes.join('\n')+'\n');
 console.log('MEDIA_AUDIT_RESULT '+JSON.stringify({icons:Object.values(manifest.projects).filter(x=>x.icon).length,
  screenshots:Object.values(manifest.projects).filter(x=>x.screenshot).length,report}));
}
run().catch(e=>{console.error('MEDIA_AUDIT_FAILED',e);process.exitCode=1});
