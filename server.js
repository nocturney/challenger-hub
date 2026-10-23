'use strict';
// Craft Update Center - local-only, dependency-free desktop web control.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {execFileSync, execFile, spawn} = require('node:child_process');
const {promisify}=require('node:util');
const runChild=promisify(execFile);
const challenger=require('./challenger-core');
const officialIcons=require('./official-icons');
const registryLive=require('./registry-live');
const selfUpdates=require('./hub-updates');
const repositoryMedia=require('./repository-media');
const independentSourceMedia=require('./independent-source-media');
const managedInstallStatus=require('./managed-install-status');
const projectQuality=require('./project-quality');
const catalogHealth=require('./catalog-health');
const hubChecker=selfUpdates.makeUpdateChecker({root:__dirname});

const HOST='127.0.0.1';
const PORT=(Number(process.env.CRAFT_CENTER_PORT)||17873);
const ROOT=__dirname;
const OWNER='storytold';
const CACHE_FILE=path.join(ROOT,'catalog-cache.json');
const ICON_CACHE_DIR=path.join(ROOT,'.icon-cache');
const ICON_MAX_BYTES=1900000;
const ICON_TTL_MS=12*60*60*1000;
const iconRequests=new Map();
const WIN_SCRIPT='D:\\Velvet\\Installers\\CraftSuite\\Install-CraftSuite.ps1';
const MAC_SCRIPT='/Users/chris/Library/Application Support/OfficeOps/CraftSuite/Install-CraftSuite.sh';
const KNOWN={
  photocraft:['PhotoCraft','Adobe Photoshop','Photography'],vectorcraft:['VectorCraft','Adobe Illustrator','Vector design'],
  lightcraft:['LightCraft','Adobe Lightroom','Photography'],filmcraft:['FilmCraft','Adobe Premiere Pro','Video'],
  effectcraft:['EffectCraft','Adobe After Effects','Motion graphics'],designcraft:['DesignCraft','Adobe InDesign','Publishing'],
  pdfcraft:['PdfCraft','Adobe Acrobat','Documents'],wordcraft:['WordCraft','Microsoft Word','Documents'],
  gridcraft:['GridCraft','Microsoft Excel','Spreadsheets'],deckcraft:['DeckCraft','Microsoft PowerPoint','Presentations'],
  cadcraft:['CADCraft','Autodesk AutoCAD','CAD'],soundcraft:['SoundCraft','Avid Pro Tools','Audio']
};
const EXCLUDED=new Set(['artcraft','artcraftx','placeholder-artcraft']);
const catalog={apps:[], checkedAt:null, scanning:false, scanError:'', lastForce:0, releaseFailures:0, refreshedReleases:0, lastAttempt:null};
const run={active:null, queue:[], history:[]};
const isWin=process.platform==='win32';
let isAdmin=!isWin;
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const semver=s=>String(s||'').replace(/^v/i,'').split(/[.-]/).slice(0,3).map(x=>parseInt(x,10)||0);
function cmp(a,b){const x=semver(a),y=semver(b);for(let i=0;i<3;i++){if(x[i]!==y[i])return x[i]-y[i]}return 0}
const COMMUNITY_FILE=path.join(ROOT,'challengers.json');
const SOURCE_FILE=path.join(ROOT,'sources.json');
function readCuratedDiscoveries(){
  let data;
  try{data=JSON.parse(fs.readFileSync(COMMUNITY_FILE,'utf8'));}
  catch(_){return [];}
  if(data.schema!=='challenger-registry.v1'||!Array.isArray(data.projects))return [];
  const collected=[],seen=new Set(),live=registryLive.read(ROOT).items;
  for(const p of data.projects){
    if(!p||!p.id||!/^[a-z][a-z0-9-]{1,79}$/.test(p.id))continue;
    if(!p.repository||!/^[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100}$/i.test(p.repository))continue;
    if(typeof p.name!=='string'||typeof p.creator!=='string'||!p.name.trim()||!p.creator.trim())continue;
    if(p.installAdapter||p.installable||catalog.apps.some(x=>x.repo===p.id)||seen.has(p.id))continue;
    seen.add(p.id);
    const observed=live[p.id]?.repository?.toLowerCase()===p.repository.toLowerCase()?live[p.id]:null;
    const challenges=Array.isArray(p.challenges)?p.challenges.filter(x=>typeof x==='string').slice(0,10).map(x=>x.slice(0,90)):[];
    collected.push({
      repo:p.id,title:p.name.slice(0,96),creator:p.creator.slice(0,100),
      repository:p.repository,repoUrl:'https://github.com/'+p.repository,
      sourceId:'research-curated',discovery:true,isNew:true,
      homepage:typeof p.homepage==='string'&&p.homepage.startsWith('https://')?p.homepage:null,
      group:String(p.group||'Emerging alternatives').slice(0,72),
      challenges,original:challenges.join(', '),
      summary:String(p.summary||'').slice(0,300),description:String(p.summary||'').slice(0,300),
      replacementType:String(p.replacementType||'Focused alternative').slice(0,50),
      reportedMaturity:String(p.reportedMaturity||'Not independently checked').slice(0,100),
      reportedPlatforms:Array.isArray(p.reportedPlatforms)?p.reportedPlatforms.filter(x=>typeof x==='string').slice(0,8).map(x=>x.slice(0,48)):[],
      caveats:String(p.caveats||'').slice(0,550),
      priority:[1,2,3].includes(p.priority)?p.priority:3,
      verifiedAt:typeof p.verifiedAt==='string'?p.verifiedAt:null,
      researchSources:Array.isArray(p.sourceReports)?p.sourceReports.filter(x=>typeof x==='string').slice(0,7).map(x=>x.slice(0,120)):[],
      reviewStatus:p.reviewStatus==='research-candidate-unverified'?'research-candidate-unverified':'repository-confirmed',
      researchPendingVerification:p.reviewStatus==='research-candidate-unverified',
      releaseStrategy:'unverified',installAdapter:null,installable:false,
      installedVersion:null,installedPath:null,needsUpdate:false,current:false,
      latestVersion:null,releaseTag:null,releaseUrl:null,publishedAt:null,
      pushedAt:observed?.pushedAt||(typeof p.githubLastPushAtReview==='string'&&Number.isFinite(Date.parse(p.githubLastPushAtReview))?p.githubLastPushAtReview:null),
      stars:Number.isSafeInteger(observed?.stars)?observed.stars:Number.isSafeInteger(p.githubStarsAtReview)&&p.githubStarsAtReview>=0?p.githubStarsAtReview:null,
      observedReleaseTag:observed?.observedTag||null,
      observedPublishedAt:observed?.observedPublishedAt||null,
      repositoryMetadataCheckedAt:observed?.lastObservedAt||null,
      archivedAtSource:observed?.isArchived||false,
      issues:null,license:typeof p.license==='string'&&p.license!=='NOASSERTION'?p.license:null,assetBytes:null
    });
  }
  return collected.map(a=>{
    const found=challenger.getMeta(a.repo),enriched=found?{...a,...found}:a;
    const observed=live[a.repo]?.repository?.toLowerCase()===a.repository.toLowerCase()?live[a.repo]:null;
    // Fresh upstream observation wins for public repository facts only.
    // Adapter and installation eligibility continue to come exclusively from reviewed policy.
    if(observed){
      enriched.stars=observed.stars;
      enriched.pushedAt=observed.pushedAt;
      enriched.observedReleaseTag=observed.observedTag;
      enriched.observedPublishedAt=observed.observedPublishedAt;
      enriched.repositoryMetadataCheckedAt=observed.lastObservedAt;
      enriched.archivedAtSource=!!observed.isArchived;
      enriched.ownerAvatarUrl=observed.ownerAvatarUrl||null;
      enriched.sourceDescription=observed.sourceDescription||null;
      enriched.officialHomepage=observed.officialHomepage||null;
      enriched.officialLicense=observed.officialLicense||null;
      enriched.primaryLanguage=observed.primaryLanguage||null;
      enriched.topics=observed.topics||[];
    }
    return {...enriched,repositoryHealth:catalogHealth.assess(observed),
      ...projectQuality.assess(enriched),...officialIcons.iconMeta(enriched)};
  });
}
function readSources(){
  try{
    const j=JSON.parse(fs.readFileSync(SOURCE_FILE,'utf8'));
    if(!Array.isArray(j.sources))return [];
    return j.sources.filter(s=>s&&typeof s.id==='string'&&typeof s.label==='string').slice(0,20)
      .map(s=>({id:s.id,label:s.label,mode:s.mode||'curated'}));
  }catch(_){return [];}
}

// All published applications and curated challengers receive one shared scan cadence.
// Full GitHub release verification has a separate strict request budget shared by all creators.
const releaseVerifyTimes=[];
const sourceScanner=require("./source-scanner");
const scanner=sourceScanner.makeScanner({
 root:ROOT,
 list:()=>[...catalog.apps.map(a=>({id:a.repo,repository:'storytold/'+a.repo,kind:'craft'})),
            ...readCuratedDiscoveries().map(a=>({id:a.repo,repository:a.repository,kind:"independent"}))],
 config:()=>challenger.config(),
 knownTag:entry=>entry.kind==='craft'?catalog.apps.find(a=>a.repo.toLowerCase()===entry.id)?.releaseTag||null:
   entry.kind==='independent'?challenger.getMeta(entry.id)?.releaseTag||null:null,
 logger:(kind,message)=>note(kind,message),
 discovery:async()=>{
  // Creator directory discovery is a single ordinary queue job, not a privileged scan of releases.
  const all=await getAllRepos();
  const found=all.filter(candidate),known=new Set(catalog.apps.map(a=>a.repo.toLowerCase()));
  const added=found.filter(a=>!known.has(a.name.toLowerCase())).map(publicRepoMeta);
  if(added.length){
   catalog.apps=[...catalog.apps,...added].sort((a,b)=>a.title.localeCompare(b.title,"en"));
   fs.writeFileSync(CACHE_FILE,JSON.stringify({checkedAt:catalog.checkedAt,apps:catalog.apps},null,2),"utf8");
   note("discovery",added.length+" new catalog entries discovered; no new installers authorized");
  }
  return true;
 },
 onChange:async event=>{
  if(event.type!=='release'||event.sourceHost!=='github.com')return false;
  const now=Date.now();for(let i=releaseVerifyTimes.length-1;i>=0;i--)if(now-releaseVerifyTimes[i]>3600000)releaseVerifyTimes.splice(i,1);
  if(releaseVerifyTimes.length>=8)return false;releaseVerifyTimes.push(now);
  // The same verification budget and release policy apply to every developer.
  const repo=event.repository;
  const url='https://api.github.com/repos/'+repo+'/releases/tags/'+encodeURIComponent(event.tag);
  const {data}=await getGithub(url);
  if(data.draft||data.prerelease||data.tag_name!==event.tag)return false;
  if(event.kind==="craft"){
   const app=catalog.apps.find(a=>a.repo.toLowerCase()===event.id);if(!app)return false;
   if(!String(data.html_url||'').startsWith('https://github.com/storytold/'+app.repo+'/releases/tag/'))return false;
   if(app.publishedAt&&data.published_at&&Date.parse(data.published_at)<Date.parse(app.publishedAt))return false;
   app.releaseTag=event.tag;app.latestVersion=event.tag.replace(/^v/,"");
   app.publishedAt=data.published_at||null;app.releaseTitle=String(data.name||"").slice(0,200);
   app.releaseBody=String(data.body||"").slice(0,45000);app.releaseUrl=data.html_url;
   releaseAssetStatus(app,data);
   fs.writeFileSync(CACHE_FILE,JSON.stringify({checkedAt:catalog.checkedAt,apps:catalog.apps},null,2),"utf8");
   return true;
  }
  return challenger.confirmGitHubRelease(event.id,data);
 }
});
const JOB_HISTORY_FILE=path.join(ROOT,'job-history.json');
function recoverJobHistory(){
 try{
  const saved=JSON.parse(fs.readFileSync(JOB_HISTORY_FILE,'utf8'));
  if(Array.isArray(saved)){run.history=saved.filter(x=>x&&typeof x.time==='string'&&typeof x.kind==='string').slice(-100);return}
 }catch(_){}
 // Import prior attempts from the install worker log, without running workers.
 try{
  const file=path.join(path.dirname(ROOT),isWin?'install-progress.jsonl':'install-progress.tsv');
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).slice(-100);
  run.history=lines.map(line=>{
   let rec;
   try{
    if(isWin){const x=JSON.parse(line);rec={time:x.date,repo:x.repo,state:x.state,detail:x.detail}}
    else{const x=line.split('\t');rec={time:x[0],repo:x[1],state:x[3],detail:x.slice(4).join(' ')}}
   }catch(_){return null}
   const kind=/error|fail/i.test(rec.state)?'error':/installed|already_current/i.test(rec.state)?'success':'progress';
   return {time:rec.time||new Date().toISOString(),repo:String(rec.repo||'').slice(0,80),kind,
     message:String(rec.state||'unknown')+' — '+String(rec.detail||'').slice(0,250)};
  }).filter(Boolean).slice(-100);
 }catch(_){}
}
recoverJobHistory();
function note(kind,msg,repo=''){
 run.history.push({time:new Date().toISOString(),kind,message:String(msg).slice(0,600),repo});
 if(run.history.length>250)run.history.shift();
 console.log('['+kind+'] '+repo+' '+String(msg).slice(0,280));
 if(['queue','install','download','success','error','stderr'].includes(kind)){
  try{fs.writeFileSync(JOB_HISTORY_FILE,JSON.stringify(run.history.slice(-100)),'utf8')}catch(_){}
 }
}
function safeRepo(repo){return /^[a-z][a-z0-9-]{1,79}$/i.test(repo)}
function candidate(r){
  if(!r || !safeRepo(r.name) || r.fork || r.archived || EXCLUDED.has(r.name.toLowerCase()))return false;
  if(r.owner && r.owner.login && r.owner.login.toLowerCase()!==OWNER)return false;
  const d=String(r.description||'');
  if(KNOWN[r.name.toLowerCase()])return true;
  // A newly published Craft desktop app is always surfaced for review.
  if(/^[a-z0-9]+craft$/i.test(r.name))return true;
  // Detect newly branded replacements, even if they do not end in "craft".
  return /(?:reimplementation|replacement|alternative|clone|compatible)/i.test(d) &&
    /(?:adobe|photoshop|illustrator|lightroom|premiere|after effects|acrobat|indesign|microsoft|excel|powerpoint|autodesk|autocad|avid|pro tools|solidworks|davinci resolve)/i.test(d);
}
async function readmeSuggestsReplacement(r){
  if(!r || r.fork || r.archived || !safeRepo(r.name) || EXCLUDED.has(r.name.toLowerCase()))return false;
  if(/(?:-services|-corpus|-fonts|-media|cloud-worker|infra|terraform|plugin)/i.test(r.name))return false;
  const created=Date.parse(r.created_at||'');
  if(!created || Date.now()-created>180*24*60*60*1000)return false;
  const branch=String(r.default_branch||'main');
  if(!/^[a-zA-Z0-9._-]{1,100}$/.test(branch))return false;
  try{
    const url='https://raw.githubusercontent.com/'+OWNER+'/'+r.name+'/'+branch+'/README.md';
    const res=await fetch(url,{signal:AbortSignal.timeout(7000)});
    if(!res.ok)return false;
    const body=(await res.text()).slice(0,14000).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
    return /(?:reimplementation|replacement|alternative|clean.room)/i.test(body) &&
      /(?:Adobe|Microsoft|Autodesk|AutoCAD|Avid|Photoshop|Illustrator|Premiere|After Effects|Lightroom|PowerPoint|Excel|SolidWorks|Pro Tools)/i.test(body) &&
      /(?:desktop|application|app|editor|software|workstation|processor|design|CAD)/i.test(body);
  }catch(_){return false;}
}
function publicRepoMeta(r){
  const k=KNOWN[r.name.toLowerCase()];
  return {repo:r.name,title:k?k[0]:r.name,original:k?k[1]:'Emerging alternative - review required',
    group:k?k[2]:'New discoveries',description:String(r.description||'').slice(0,280),
    isNew:!k,repoUrl:'https://github.com/'+OWNER+'/'+r.name,
    pushedAt:r.pushed_at||null,repoUpdatedAt:r.updated_at||null,createdAt:r.created_at||null,
    defaultBranch:/^[a-zA-Z0-9._-]{1,100}$/.test(String(r.default_branch||''))?r.default_branch:'main',
    stars:Number.isFinite(r.stargazers_count)?r.stargazers_count:null,
    issues:Number.isFinite(r.open_issues_count)?r.open_issues_count:null,
    forks:Number.isFinite(r.forks_count)?r.forks_count:null,
    license:r.license?.spdx_id&&r.license.spdx_id!=='NOASSERTION'?r.license.spdx_id:null,
    repoSizeKiB:Number.isFinite(r.size)?r.size:null,
    latestVersion:null,releaseTag:null,publishedAt:null,releaseBody:'',releaseTitle:'',releaseUrl:null,
    installable:false,assetIssue:'',
    installedVersion:null,installedPath:null,error:''};
}
function apiHeaders(){return {'User-Agent':'CraftUpdateCenter/1.0 (local; public GitHub releases)', 'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};}
async function getGithub(url){
  if(!url.startsWith('https://api.github.com/'))throw Error('Unsupported API host');
  // Prefer an existing authorized GitHub CLI for public read-only API queries.
  // Never read, print, persist, bundle or forward its credential to the desktop.
  // An installed/authorized gh CLI is optional: the public API remains the fallback.
  if(process.env.CHALLENGER_DISABLE_GH_CLI!=='1'){
    try{
      const endpoint=url.slice('https://api.github.com'.length);
      const {stdout}=await runChild('gh',['api',endpoint,'-H','Accept: application/vnd.github+json'],
        {timeout:18000,maxBuffer:9*1024*1024,windowsHide:true});
      return {data:JSON.parse(stdout),link:'',authenticated:true};
    }catch(_){ /* No compatible local gh login; fall back to anonymous public API. */ }
  }
  const response=await fetch(url,{headers:apiHeaders(),signal:AbortSignal.timeout(18000)});
  if(!response.ok){let hint='';
    if(response.status===403||response.status===429)hint=' (anonymous GitHub API limit; connect existing gh CLI or retry after reset)';
    throw Error('GitHub '+response.status+hint);
  }
  return {data:await response.json(),link:response.headers.get('link')||'',authenticated:false};
}
async function getAllRepos(){
  const all=[];let page=1;
  for(;page<=8;page++){
    const {data}=await getGithub('https://api.github.com/orgs/'+OWNER+'/repos?per_page=100&page='+page+'&type=public');
    if(!Array.isArray(data))throw Error('Invalid organization listing');
    all.push(...data);
    if(data.length<100)break;
  }
  return all;
}
function releaseAssetStatus(m,re){
  const a=Array.isArray(re.assets)?re.assets.map(x=>x.name):[];
  const v=String(re.tag_name||'').replace(/^v/,'');
  const artifact=isWin?(m.repo==='wordcraft'?m.repo+'-'+v+'-windows-x64-portable.zip':m.repo+'-'+v+'-windows-x64.msi'):m.repo+'-'+v+'-macos-universal.dmg';
  const sum=a.includes('SHA256SUMS.txt');
  m.installable=!!(sum && a.includes(artifact));
  const selected=Array.isArray(re.assets)?re.assets.find(x=>x.name===artifact):null;
  m.assetBytes=selected&&Number.isFinite(selected.size)?selected.size:null;
  m.platformAsset=selected?artifact:null;
  m.assetIssue=m.installable?'':(!sum?'SHA256SUMS.txt missing':'No matching installer for this computer');
}
async function scanCatalog(force=false){
  if(catalog.scanning)return;
  const now=Date.now();
  if(!force && catalog.apps.length && catalog.checkedAt && now-new Date(catalog.checkedAt).getTime()<25*60*1000)return;
  if(force && now-catalog.lastForce<90*1000 && catalog.apps.length){note('info','Using recently scanned data');return;}
  if(force)catalog.lastForce=now;
  catalog.scanning=true;catalog.scanError='';catalog.lastAttempt=new Date(now).toISOString();
  catalog.releaseFailures=0;catalog.refreshedReleases=0;
  note('scan','Scanning public repositories of '+OWNER);
  try{
    const listed=await getAllRepos();
    const repos=listed.filter(candidate);
    const unknown=listed.filter(r=>!candidate(r));
    // A newly created alternative may have no useful GitHub description yet.
    // Deep README discovery is a separate opt-in task, never block a normal version refresh.
    if(process.env.CHALLENGER_DEEP_DISCOVERY==='1')for(let i=0;i<unknown.length;i+=6){
      await Promise.all(unknown.slice(i,i+6).map(async r=>{
        if(await readmeSuggestsReplacement(r))repos.push(r);
      }));
    }
    const next=repos.map(publicRepoMeta);
    // Keep bounded concurrency and respect GitHub's public API limits.
    for(let i=0;i<next.length;i+=4){
      await Promise.all(next.slice(i,i+4).map(async m=>{
        let data=null;
        try{
          const response=await getGithub('https://api.github.com/repos/'+OWNER+'/'+m.repo+'/releases/latest');
          data=response.data;
        }catch(e){
          // A new repository without any published release is not a network failure.
          if(String(e.message)==='GitHub 404'){
            m.assetIssue='No published release yet';m.error='';
            return;
          }
          catalog.releaseFailures++;
          // Retain the last verified release metadata; never claim the cache is newly verified.
          const old=catalog.apps.find(p=>p.repo===m.repo && p.latestVersion);
          if(old){
            m.releaseTag=old.releaseTag;m.latestVersion=old.latestVersion;
            m.publishedAt=old.publishedAt;m.installable=old.installable;
            m.releaseBody=old.releaseBody||'';m.releaseTitle=old.releaseTitle||'';m.releaseUrl=old.releaseUrl||null;
            m.assetBytes=old.assetBytes??null;m.platformAsset=old.platformAsset||null;
            m.assetIssue=old.assetIssue||'';m.error='Cached release metadata';
          }else if(!isWin){
            try {
              const cachedFile=path.join(os.homedir(),'Library','Application Support','OfficeOps','CraftSuite','downloads',m.repo+'-release.json');
              const cached=JSON.parse(fs.readFileSync(cachedFile,'utf8'));
              if(cached && cached.tag_name && Array.isArray(cached.assets))data=cached;
            }catch(_){}
          }
          if(!data && !m.latestVersion){m.assetIssue='Release metadata unavailable right now';m.error=String(e.message).slice(0,160);}
        }
        if(data && data.tag_name && !data.draft && !data.prerelease){
          m.releaseTag=String(data.tag_name);
          m.latestVersion=m.releaseTag.replace(/^v/,'');
          m.publishedAt=data.published_at||null;
          m.releaseTitle=String(data.name||'').slice(0,200);
          m.releaseBody=String(data.body||'').slice(0,45000);
          m.releaseUrl=String(data.html_url||'').startsWith('https://github.com/storytold/')?data.html_url:null;
          releaseAssetStatus(m,data);
        }
      }));
    }
    catalog.apps=next.sort((a,b)=>(Number(a.isNew)-Number(b.isNew)) || a.title.localeCompare(b.title,'en'));
    await syncInstalled();
    catalog.refreshedReleases=next.filter(x=>x.latestVersion&&!x.error).length;
    catalog.checkedAt=new Date().toISOString();
    catalog.scanError=catalog.releaseFailures?catalog.releaseFailures+' release lookups unavailable; previous verified values retained':'';
    fs.writeFileSync(CACHE_FILE,JSON.stringify({checkedAt:catalog.checkedAt,apps:catalog.apps},null,2),'utf8');
    note(catalog.releaseFailures?'info':'success','Refreshed '+catalog.apps.length+' managed repositories; '+catalog.refreshedReleases+' releases verified; '+catalog.releaseFailures+' cached fallbacks');
  }catch(e){catalog.scanError=String(e.message);note('error','Catalog scan failed: '+catalog.scanError);}
  finally {catalog.scanning=false;}
}
function loadCache(){
  try{
    const saved=JSON.parse(fs.readFileSync(CACHE_FILE,'utf8'));
    if(Array.isArray(saved.apps) && saved.apps.length){
      catalog.apps=saved.apps.filter(x=>safeRepo(x.repo)).map(x=>{
        const a=Object.assign({},x,{installedVersion:null,installedPath:null});
        // Fill missing cached GitHub release metadata from the checksum-verified Mac installer history.
        if(!isWin && !a.latestVersion){
          try{
            const cachedFile=path.join(os.homedir(),'Library','Application Support','OfficeOps','CraftSuite','downloads',a.repo+'-release.json');
            const re=JSON.parse(fs.readFileSync(cachedFile,'utf8'));
            if(re.tag_name && Array.isArray(re.assets)){
              a.releaseTag=String(re.tag_name);a.latestVersion=a.releaseTag.replace(/^v/,'');
              a.publishedAt=re.published_at||null;releaseAssetStatus(a,re);a.error='';
            }
          }catch(_){}
        }
        return a;
      });
      catalog.checkedAt=saved.checkedAt||null;
    }
  }catch(_){}
}
function execText(file,args){
  try{return execFileSync(file,args,{encoding:'utf8',timeout:7000,windowsHide:true,stdio:['ignore','pipe','ignore']}).trim();}
  catch(_){return ''}
}
function locateInstalled(repo){
  if(isWin){
    const roots=['C:\\Program Files','C:\\Program Files (x86)'];
    for(const root of roots){
      let dirs=[];
      try{dirs=fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name)}catch(_){}
      const folder=dirs.find(d=>normalize(d)===normalize(repo));
      if(!folder)continue;
      const exe=path.join(root,folder,repo+'.exe');
      if(!fs.existsSync(exe))continue;
      const version=execText('powershell.exe',['-NoProfile','-NonInteractive','-Command',
        "(Get-Item -LiteralPath '"+exe.replace(/'/g,"''")+"').VersionInfo.ProductVersion"]);
      if(version)return {version,location:exe};
    }
  } else {
    for(const root of ['/Applications',path.join(os.homedir(),'Applications')]){
      let dirs=[];
      try{dirs=fs.readdirSync(root,{withFileTypes:true}).filter(d=>d.name.endsWith('.app')).map(d=>d.name)}catch(_){}
      const folder=dirs.find(d=>normalize(d.replace(/\.app$/i,''))===normalize(repo));
      if(!folder)continue;
      const app=path.join(root,folder);
      const plist=path.join(app,'Contents','Info.plist');
      const version=execText('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString',plist]);
      if(version)return {version,location:app};
    }
  }
  return {version:null,location:null};
}
async function syncInstalled(){
  for(const a of catalog.apps){
    const installed=locateInstalled(a.repo);
    a.installedVersion=installed.version;
    a.installedPath=installed.location;
    a.needsUpdate=!!(installed.version && a.latestVersion && cmp(installed.version,a.latestVersion)<0);
    a.current=!!(installed.version && a.latestVersion && cmp(installed.version,a.latestVersion)>=0);
  }
}
function appFor(repo){if(!safeRepo(String(repo||'')))return null;return catalog.apps.find(x=>x.repo.toLowerCase()===String(repo||'').toLowerCase())||challenger.getMeta(String(repo).toLowerCase())}
function enqueue(names){
  const accepted=[];
  for(const name of names){
    const a=appFor(name);
    if(!a || !a.installable || !safeRepo(name))continue;
    if(run.active && run.active.repo===name)continue;
    if(run.queue.includes(name))continue;
    if(a.installedVersion && a.latestVersion && cmp(a.installedVersion,a.latestVersion)>=0)continue;
    run.queue.push(name);accepted.push(name);
  }
  if(accepted.length)note('queue',accepted.length+' installation/update jobs queued');
  setImmediate(launchNext);
  return accepted;
}
function startPortableDownload(app){
 if(!(app?.discovery||app?.sourceId==='storytold')||!app.downloadablePortable)throw Error('No allowlisted SHA-256 verified portable asset for this platform');
 if(run.active||run.queue.length)throw Error('An installation or download is already in progress; retry when idle');
 const script=path.join(ROOT,'Install-Challenger.js');
 if(!fs.existsSync(script))throw Error('Portable download worker is missing');
 run.active={repo:app.repo,startedAt:new Date().toISOString(),state:'downloading',mode:'portable',messages:[]};
 note('download','Starting verified portable-only download',app.repo);
 const child=spawn(process.execPath,[script,app.repo,'--download-only'],{
   cwd:ROOT,windowsHide:true,stdio:['ignore','pipe','pipe'],
   env:{...process.env,CHALLENGER_INSTALL_MODE:'portable'}
 });
 let finished=false,workerFailed=false;
 function progress(chunk,kind){
   for(const line of String(chunk).split(/\r?\n/)){
     if(!line.trim())continue;
     let message=line.slice(0,290);
     try{
       const data=JSON.parse(line);
       if(data?.state){
         message=data.state+' — '+String(data.detail||'').slice(0,245);
         if(data.state==='failed')workerFailed=true;
       }
     }catch(_){}
     if(run.active?.mode==='portable')run.active.messages=(run.active.messages||[]).concat(message).slice(-12);
     note(kind,message,app.repo);
   }
 }
 child.stdout.on('data',x=>progress(x,'progress'));
 child.stderr.on('data',x=>progress(x,'stderr'));
 const finish=(ok,reason)=>{
   if(finished)return;finished=true;
   note(ok?'success':'error',ok?'Portable release downloaded and SHA-256 verified. No installation performed.':
      'Portable download failed: '+String(reason).slice(0,150),app.repo);
   run.active=null;
   if(run.queue.length)setImmediate(launchNext);
 };
 child.on('error',e=>finish(false,e.message));
 child.on('close',code=>finish(code===0&&!workerFailed,'Process exit '+code));
 return {repo:app.repo,asset:app.portableAsset,mode:'portable',started:true};
}
function launchNext(){
  if(run.active || !run.queue.length)return;
  const repo=run.queue.shift();
  const isResearch=!!challenger.getMeta(repo);
  const script=isResearch?path.join(ROOT,'Install-Challenger.js'):(isWin?WIN_SCRIPT:MAC_SCRIPT);
  if(!fs.existsSync(script)){note('error','Installation adapter was not found: '+script,repo);setImmediate(launchNext);return;}
  run.active={repo,startedAt:new Date().toISOString(),state:'running',mode:appFor(repo)?.installedVersion?'update':'install',messages:[]};
  note('install','Starting installation or update',repo);
  const binary=isResearch?process.execPath:(isWin?'powershell.exe':'/bin/bash');
  const args=isResearch?[script,repo]:isWin?['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script]:[script];
  const child=spawn(binary,args,{env:{...process.env,CRAFT_ONE:repo},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let detectedError='';
  const parseChunk=(chunk,kind)=>{
    const lines=chunk.toString().split(/\r?\n/);
    for(const line of lines){
      if(!line.trim())continue;
      let msg=line.trim();
      try {
        if(isWin||isResearch){const x=JSON.parse(msg);if(x.state){msg=x.state+' — '+x.detail;if(run.active)run.active.state=String(x.state).slice(0,55);if(/failed|error/i.test(x.state))detectedError=msg;}}
        else {const x=msg.split('\t');if(x.length>=5){msg=x[3]+' — '+x.slice(4).join(' ');if(/failed|error/i.test(x[3]))detectedError=msg;}}
      }catch(_){}
      if(run.active){run.active.messages.push(msg.slice(0,300));run.active.messages=run.active.messages.slice(-10);}
      note(kind,msg,repo);
    }
  };
  child.stdout.on('data',data=>parseChunk(data,'progress'));
  child.stderr.on('data',data=>parseChunk(data,'stderr'));
  child.on('error',e=>finish('failed','Could not start installer: '+e.message));
  child.on('close',code=>finish('closed',String(code)));
  let finished=false;
  async function finish(outcome,info){
    if(finished)return;finished=true;
    await syncInstalled();
    const a=appFor(repo);
    const okay=outcome==='closed' && info==='0' && !detectedError &&
      a && a.installedVersion && a.latestVersion && cmp(a.installedVersion,a.latestVersion)>=0;
    if(okay)note('success','Successfully installed version '+a.installedVersion,repo);
    else note('error','Installation incomplete: '+(detectedError||info)+'; installed version: '+(a&&a.installedVersion||'not detected'),repo);
    run.active=null;
    if(run.queue.length)setImmediate(launchNext);
  }
}
function validIconPath(repo,branch){
  return /^[a-z][a-z0-9-]{1,79}$/i.test(repo)&&/^[a-zA-Z0-9._-]{1,100}$/.test(branch);
}
async function downloadIcon(app){
  const repo=app.repo.toLowerCase();
  const branch=app.defaultBranch||'main';
  if(!validIconPath(repo,branch))return null;
  fs.mkdirSync(ICON_CACHE_DIR,{recursive:true});
  const cache=path.join(ICON_CACHE_DIR,repo+'.png');
  try{
    const stat=fs.statSync(cache);
    if(stat.size>80&&stat.size<ICON_MAX_BYTES&&Date.now()-stat.mtimeMs<ICON_TTL_MS)return fs.readFileSync(cache);
  }catch(_){}
  const names=[
    'assets/app-icon/'+repo+'-1024.png',
    'assets/app-icon/'+repo+'-macos-512.png',
    'assets/app-icon/'+repo+'-256.png',
    'assets/app-icon/'+repo+'-64.png',
    'assets/app-icon/icon.png','assets/icon.png','icon.png'
  ];
  for(const name of names){
    const url='https://raw.githubusercontent.com/'+OWNER+'/'+repo+'/'+branch+'/'+name;
    try{
      const response=await fetch(url,{headers:{'User-Agent':'CraftUpdateCenter/1.2'},signal:AbortSignal.timeout(15000)});
      if(!response.ok)continue;
      const size=Number(response.headers.get('content-length')||0);
      if(size>ICON_MAX_BYTES || (response.headers.get('content-type')||'').includes('text/html'))continue;
      const reader=response.body?.getReader();
      if(!reader)continue;
      const chunks=[];let bytes=0,tooLarge=false;
      while(true){
        const {value,done}=await reader.read();
        if(done)break;
        bytes+=value.byteLength;
        if(bytes>ICON_MAX_BYTES){tooLarge=true;await reader.cancel();break;}
        chunks.push(Buffer.from(value));
      }
      if(tooLarge||bytes<80)continue;
      const result=Buffer.concat(chunks);
      if(!result.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))continue;
      const tmp=cache+'.'+process.pid+'.tmp';
      fs.writeFileSync(tmp,result);
      fs.renameSync(tmp,cache);
      return result;
    }catch(_){/* fall through to another icon candidate */}
  }
  try{return fs.readFileSync(cache);}catch(_){return null;}
}
async function iconFor(app){
  if(app.discovery)return officialIcons.iconFor(app);
  const key=String(app.repo).toLowerCase();
  if(!iconRequests.has(key)){
    const pending=downloadIcon(app).finally(()=>iconRequests.delete(key));
    iconRequests.set(key,pending);
  }
  return iconRequests.get(key);
}
function imageResponse(res,data){
 if(!data){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private,max-age=240'});res.end('Official image not verified');return;}
 const bytes=Buffer.isBuffer(data)?data:data.bytes,mime=Buffer.isBuffer(data)?'image/png':data.mime;
 if(!bytes||!/^image\/(png|svg\+xml|webp|jpeg|x-icon)$/.test(mime||'')){res.writeHead(404);res.end('Unsupported image');return;}
 res.writeHead(200,{'Content-Type':mime,'Content-Length':bytes.length,
  'Cache-Control':'private,max-age=21600','X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox"});
 res.end(bytes);
}
async function getReleaseNotes(app){
  if(!app)return null;
  if(!app.releaseBody&&app.releaseTag){
    try{
      const {data}=await getGithub('https://api.github.com/repos/'+OWNER+'/'+app.repo+'/releases/latest');
      if(data&&data.tag_name===app.releaseTag){
        app.releaseBody=String(data.body||'').slice(0,45000);
        app.releaseTitle=String(data.name||'').slice(0,200);
        app.releaseUrl=String(data.html_url||'').startsWith('https://github.com/storytold/')?data.html_url:null;
        try{fs.writeFileSync(CACHE_FILE,JSON.stringify({checkedAt:catalog.checkedAt,apps:catalog.apps},null,2),'utf8');}catch(_){}
      }
    }catch(e){
      return {repo:app.repo,title:app.releaseTitle||app.title,
        tag:app.releaseTag||null,publishedAt:app.publishedAt||null,
        body:'',url:app.releaseUrl||'https://github.com/'+OWNER+'/'+app.repo+'/releases',
        error:String(e.message).slice(0,140)};
    }
  }
  return {repo:app.repo,title:app.releaseTitle||app.title,tag:app.releaseTag||null,
    publishedAt:app.publishedAt||null,body:app.releaseBody||'',
    url:app.releaseUrl||'https://github.com/'+OWNER+'/'+app.repo+'/releases',error:null};
}
const releaseHistoryCache=new Map(),releaseHistoryFailures=new Map();
const HISTORY_FILE=path.join(ROOT,'release-history-cache.json');
try{
  const saved=JSON.parse(fs.readFileSync(HISTORY_FILE,'utf8'));
  if(Array.isArray(saved.entries)){
    for(const row of saved.entries.slice(0,80)){
      if(!row||!safeRepo(row.repo)||!Array.isArray(row.releases))continue;
      const releases=row.releases.slice(0,8).filter(x=>x&&typeof x.tag==='string').map(x=>({
        tag:x.tag.slice(0,70),title:String(x.title||x.tag).slice(0,140),
        publishedAt:typeof x.publishedAt==='string'?x.publishedAt:null,
        url:typeof x.url==='string'&&x.url.startsWith('https://github.com/storytold/')?
          x.url:'https://github.com/storytold/'+row.repo+'/releases',
        prerelease:!!x.prerelease
      }));
      if(releases.length)releaseHistoryCache.set(row.repo.toLowerCase(),{
        time:0,payload:{repo:row.repo,releases,stale:true,error:null}});
    }
  }
}catch(_){}
function persistReleaseHistories(){
  try{
    const entries=[...releaseHistoryCache.values()].filter(x=>x.payload.releases?.length).map(x=>({
      repo:x.payload.repo,releases:x.payload.releases.slice(0,8)
    }));
    const temp=HISTORY_FILE+'.tmp';
    fs.writeFileSync(temp,JSON.stringify({schema:1,entries},null,2),'utf8');
    fs.renameSync(temp,HISTORY_FILE);
  }catch(e){note('error','Could not save release history cache: '+e.message);}
}
async function recentReleases(app){
  const key=app.repo.toLowerCase(),now=Date.now();
  const old=releaseHistoryCache.get(key);
  if(old&&old.time&&now-old.time<8*60*1000)return old.payload;
  const latest=app.releaseTag?[{tag:app.releaseTag,title:app.releaseTitle||app.releaseTag,
    publishedAt:app.publishedAt||null,url:app.releaseUrl||app.repoUrl+'/releases'}]:[];
  if(releaseHistoryFailures.has(key)&&now-releaseHistoryFailures.get(key)<15*60*1000){
    return old?.payload?.releases?.length?{...old.payload,stale:true,error:'GitHub rate limit; showing cached releases'}:
      {repo:app.repo,releases:latest,stale:true,error:'GitHub rate limit; showing cached release'};
  }
  try{
    const {data}=await getGithub('https://api.github.com/repos/'+OWNER+'/'+app.repo+'/releases?per_page=8');
    if(!Array.isArray(data))throw Error('GitHub releases did not return a list');
    const releases=data.filter(x=>x.tag_name&&!x.draft).slice(0,8).map(x=>({
      tag:String(x.tag_name).slice(0,70),title:String(x.name||x.tag_name).slice(0,140),
      publishedAt:x.published_at||null,
      url:String(x.html_url||'').startsWith('https://github.com/storytold/')?x.html_url:app.repoUrl+'/releases',
      prerelease:!!x.prerelease
    }));
    const payload={repo:app.repo,releases,stale:false,error:null};
    releaseHistoryFailures.delete(key);
    releaseHistoryCache.set(key,{time:now,payload});
    persistReleaseHistories();
    return payload;
  }catch(e){
    releaseHistoryFailures.set(key,now);
    return old?.payload?.releases?.length?{
      ...old.payload,stale:true,error:String(e.message).slice(0,120)
    }:{repo:app.repo,releases:latest,stale:true,error:String(e.message).slice(0,120)};
  }
}
function launchInstalledApp(app){
  if(isWin)throw Error('Use the native Craft Update Center window to open Windows apps in the interactive user session');
  const found=locateInstalled(app.repo);
  if(!found.version||!found.location)throw Error('Application is not installed on this computer');
  let real;
  try{real=fs.realpathSync(found.location);}catch(_){throw Error('The installed application cannot be located');}
  if(isWin){
    const roots=['C:\\Program Files\\','C:\\Program Files (x86)\\'];
    const lowered=real.toLowerCase();
    if(!roots.some(x=>lowered.startsWith(x.toLowerCase())))throw Error('Application path is not trusted');
    if(path.basename(real).toLowerCase()!==app.repo.toLowerCase()+'.exe')throw Error('Executable name does not match application');
    const child=spawn(real,[],{shell:false,detached:true,stdio:'ignore',windowsHide:false});
    child.on('error',e=>note('error','Could not open '+app.repo+': '+e.message,app.repo));child.unref();
  }else{
    if(!real.startsWith('/Applications/')&&!real.startsWith(path.join(os.homedir(),'Applications')+'/'))throw Error('Application path is not trusted');
    if(!real.toLowerCase().endsWith('.app'))throw Error('Only macOS app bundles can be launched');
    const child=spawn('/usr/bin/open',['-a',real],{shell:false,detached:true,stdio:'ignore'});
    child.on('error',e=>note('error','Could not open '+app.repo+': '+e.message,app.repo));child.unref();
  }
  note('launch','Opened locally installed application',app.repo);
  return true;
}
function json(res,status,data){
  const body=JSON.stringify(data);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(body);
}
function sendStatic(res,file,mime){
  try{
    const data=fs.readFileSync(path.join(ROOT,file));
    res.writeHead(200,{'Content-Type':mime,'Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"});
    res.end(data);
  }catch(_){json(res,500,{error:'Missing app assets'});}
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let data='';req.on('data',x=>{data+=x;if(data.length>12000){reject(Error('Payload too large'));req.destroy();}});
    req.on('end',()=>{try{resolve(data?JSON.parse(data):{})}catch(e){reject(e)}});
    req.on('error',reject);
  });
}
function publicDiscovery(app){
  if(!app)return app;
  const {researchSources,sourceReports,sourceId,priority,verifiedAt,reviewStatus,original,
    internalNotes,internalRank,curationNotes,...publicApp}=app;
  return publicApp;
}
const server=http.createServer(async(req,res)=>{
  const host=req.headers.host||'';
  if(host!=='127.0.0.1:'+PORT && host!=='localhost:'+PORT){json(res,403,{error:'Local host only'});return;}
  const route=(req.url||'').split('?')[0];
  if(req.method==='GET' && route==='/'){sendStatic(res,'index.html','text/html; charset=utf-8');return;}
  if(req.method==='GET' && route==='/app.js'){sendStatic(res,'app.js','application/javascript; charset=utf-8');return;}
  if(req.method==='GET' && route==='/ux-experience.js'){sendStatic(res,'ux-experience.js','application/javascript; charset=utf-8');return;}
  if(req.method==='GET' && route==='/shader-bundle.js'){sendStatic(res,'shader-bundle.js','application/javascript; charset=utf-8');return;}
  if(req.method==='GET' && route==='/shader-loader.js'){sendStatic(res,'shader-loader.js','application/javascript; charset=utf-8');return;}
  if(req.method==='GET' && route==='/style.css'){sendStatic(res,'style.css','text/css; charset=utf-8');return;}
  if(req.method==='GET' && route==='/brand-icon.png'){sendStatic(res,'brand-icon.png','image/png');return;}
  if(req.method==='GET' && route.startsWith('/api/icon/')){
    const repo=route.slice('/api/icon/'.length);
    const app=safeRepo(repo)?appFor(repo):null;
    if(!app){imageResponse(res,null);return;}
    try{imageResponse(res,await iconFor(app));}catch(_){imageResponse(res,null);}
    return;
  }
  if(req.method==='GET' && route==='/api/release-notes'){
    let repo='';try{repo=new URL(req.url,'http://127.0.0.1:'+PORT).searchParams.get('repo')||'';}catch(_){}
    const app=safeRepo(repo)?appFor(repo):null;
    if(!app){json(res,404,{error:'Unknown application'});return;}
    const notes=app.discovery?challenger.notes(repo):await getReleaseNotes(app);
    json(res,200,notes);return;
  }
  if(req.method==='GET' && route==='/api/releases'){
    let repo='';try{repo=new URL(req.url,'http://127.0.0.1:'+PORT).searchParams.get('repo')||'';}catch(_){}
    const app=safeRepo(repo)?appFor(repo):null;
    if(!app){json(res,404,{error:'Unknown application'});return;}
    json(res,200,app.discovery?challenger.history(repo):await recentReleases(app));return;
  }
  if(req.method==='GET' && route==='/api/health'){json(res,200,{ok:true,app:'Craft Update Center',platform:process.platform,version:'2.5.7'});return;}
  if(req.method==='GET' && route==='/api/hub-update'){
    const result=await hubChecker.check({force:(req.url||'').includes('force=1')});
    json(res,result.ok?200:503,result);return;
  }
  if(req.method==='GET' && ['/api/repository-media/meta','/api/repository-media/screenshot','/api/repository-media/avatar',
    '/api/repository-media/official-icon','/api/repository-media/official-screenshot'].includes(route)){
    const repo=new URL(req.url,'http://127.0.0.1:'+PORT).searchParams.get('repo')||'';
    const app=/^[a-z][a-z0-9-]{1,79}$/.test(repo)?readCuratedDiscoveries().find(x=>x.repo===repo):null;
    if(!app){json(res,404,{error:'Unknown curated project'});return;}
    if(route==='/api/repository-media/official-icon'||route==='/api/repository-media/official-screenshot'){
      const params=new URL(req.url,'http://127.0.0.1:'+PORT).searchParams;
      const n=params.get('i')||'0';
      if(!/^[0-4]$/.test(n)){json(res,400,{error:'Invalid vetted image index'});return;}
      const verified=await independentSourceMedia.get(app,
       route==='/api/repository-media/official-icon'?'icon':'screenshot',Number(n)).catch(()=>null);
      imageResponse(res,verified);return;
    }
    if(route==='/api/repository-media/avatar'){
      const img=await repositoryMedia.avatar(app).catch(()=>null);
      imageResponse(res,img);return;
    }
    const found=await repositoryMedia.probe(app).catch(()=>null);
    if(route==='/api/repository-media/meta'){
      json(res,200,{available:!!found?.available,type:found?.available?'official-readme-image':'none',
        caption:found?.caption||null,source:found?.source||null,
        width:found?.width||null,height:found?.height||null,
        productLogo:false,appScreenshotConfirmed:!!found?.available});return;
    }
    imageResponse(res,found?.available?found:null);return;
  }
  if(req.method==='GET' && route==='/api/state'){
    json(res,200,{platform:process.platform,computer:os.hostname(),admin:isAdmin,
      apps:catalog.apps.map(({releaseBody,...meta})=>({...meta,installEvidence:managedInstallStatus.assess(meta),creator:'Storytold',sourceId:'storytold',repository:'storytold/'+meta.repo,challenges:meta.original?[meta.original]:[],sourceSignal:scanner.publicSignal(meta.repo),...challenger.craftPortableMeta(meta.repo)})),
      discoveries:readCuratedDiscoveries().map(a=>publicDiscovery({...a,sourceSignal:scanner.publicSignal(a.repo)})),sources:readSources(),sourceStatus:scanner.status(),
      catalogStatus:{checkedAt:catalog.checkedAt,scanning:catalog.scanning,lastAttempt:catalog.lastAttempt,
        releaseFailures:catalog.releaseFailures,refreshedReleases:catalog.refreshedReleases,
        count:catalog.apps.length,error:catalog.scanError,registryUpdated:'2026-10-10'},
      registryStatus:{...registryLive.status(ROOT),health:catalogHealth.summary(registryLive.read(ROOT).items)},
      checkedAt:scanner.status().lastSyncAt||catalog.checkedAt,scanning:scanner.status().scanning||catalog.scanning,
      scanError:[scanner.status().error,catalog.scanError].filter(Boolean).join(' | '),
      active:run.active,queue:run.queue,history:run.history.slice(-45)});
    return;
  }
  if(req.method!=='POST' || !['/api/scan','/api/install','/api/download-portable','/api/update-all','/api/verify','/api/launch','/api/preferences'].includes(route)){
    json(res,404,{error:'Not found'});return;
  }
  const origin=req.headers.origin;
  if(req.headers['x-requested-with']!=='CraftUpdateCenter' ||
     (origin && origin!=='http://127.0.0.1:'+PORT && origin!=='http://localhost:'+PORT)){
    json(res,403,{error:'Request origin rejected'});return;
  }
  let body={};try{body=await readBody(req);}catch(_){json(res,400,{error:'Invalid JSON'});return;}
  try{
    if(route==='/api/scan'){
      const work=scanner.requestAll();
      registryLive.refresh({root:ROOT,force:true,logger:note}).catch(e=>note('error','Curated registry metadata refresh failed: '+String(e.message).slice(0,140)));
      scanner.drainRequested().catch(e=>note('error','Source scan stalled: '+String(e.message).slice(0,140)));
      if(!catalog.scanning)scanCatalog(true).catch(e=>note('error','Catalog refresh failed: '+String(e.message).slice(0,140)));
      json(res,202,{ok:true,scanning:true,sourceQueued:work.queued,cooldown:work.cooldown,
        catalogRefreshQueued:true,sourceTotal:scanner.status().total});return;
    }
    if(route==='/api/preferences'){
      const prefs=challenger.setConfig(body||{});json(res,200,{ok:true,preferences:prefs});return;
    }
    if(route==='/api/verify'){await syncInstalled();json(res,200,{ok:true});return;}
    if(route==='/api/download-portable'){
      const target=appFor(body.repo);
      const app=target&&!target.discovery?{...target,sourceId:'storytold',...challenger.craftPortableMeta(target.repo)}:target;
      if(!app?.downloadablePortable){json(res,400,{error:'No verified portable release for this computer'});return;}
      if(run.active||run.queue.length){json(res,409,{error:'Another installation or download is active'});return;}
      json(res,202,{ok:true,...startPortableDownload(app)});return;
    }
    if(route==='/api/launch'){
      const app=appFor(body.repo);
      if(!app || !safeRepo(body.repo)){json(res,404,{error:'Unknown application'});return;}
      try{
        if(app.discovery){
          const tracked=challenger.managedInfo(app.repo);
          if(!tracked)throw Error('This project is not installed or its managed path cannot be validated');
          if(isWin)throw Error('Use the native Windows app to launch managed challenger software');
          const real=fs.realpathSync(tracked.installedPath),root=path.resolve(challenger.APP_ROOT)+path.sep;
          if(!real.startsWith(root)||!real.endsWith('.app'))throw Error('Managed application path is not trusted');
          const child=spawn('/usr/bin/open',['-a',real],{shell:false,detached:true,stdio:'ignore'});child.unref();
          note('launch','Opened managed challenger application',app.repo);
          json(res,200,{ok:true,repo:app.repo,opened:true});
        }else{
          const launched=launchInstalledApp(app);json(res,200,{ok:true,repo:app.repo,opened:launched});
        }
      }catch(e){json(res,409,{error:String(e.message||e)});}
      return;
    }
    if(!isAdmin && isWin){json(res,403,{error:'Windows install requires administrator privileges; use the desktop launcher'});return;}
    if(route==='/api/install'){
      const a=appFor(body.repo);
      if(!a || !a.installable){json(res,400,{error:'App is not an approved installable release'});return;}
      json(res,202,{ok:true,queued:enqueue([a.repo])});return;
    }
    if(route==='/api/update-all'){
      const updating=[...catalog.apps,...readCuratedDiscoveries()].filter(a=>a.needsUpdate && a.installable).map(a=>a.repo);
      json(res,202,{ok:true,queued:enqueue(updating)});return;
    }
  }catch(e){json(res,500,{error:String(e.message||e)});}
});
function setup(){
  if(isWin){
    const test=execText('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)']);
    isAdmin=test.toLowerCase()==='true';
  }
  loadCache();
  server.listen(PORT,HOST,()=>{
    console.log('Craft Update Center: http://'+HOST+':'+PORT+' | platform='+process.platform+' | admin='+isAdmin);
    syncInstalled().catch(e=>note('error',e.message));
    scanner.start();
    // An old cache is not a successful scan. Refresh metadata on startup and
    // periodically while the native desktop is open; no Task Scheduler service.
    if(process.env.CHALLENGER_DISABLE_SCAN!=='1'){
      const refreshCatalog=()=>{
        scanCatalog(false).catch(e=>note('error','Catalog refresh: '+String(e.message).slice(0,130)));
        registryLive.refresh({root:ROOT,logger:note}).catch(e=>
          note('info','Independent repository metadata cached: '+String(e.message).slice(0,130)));
      };
      const initial=setTimeout(refreshCatalog,7000);initial.unref();
      const recurring=setInterval(refreshCatalog,6*60*60*1000);recurring.unref();
    }
  });
}
if(require.main===module)setup();
module.exports={candidate,cmp,publicRepoMeta,releaseAssetStatus,normalize};