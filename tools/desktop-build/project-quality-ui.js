'use strict';
/* Source-explained directory: default to useful profiles, keep incomplete research opt-in.
   Never alters the underlying project array, discovery registry or installation privileges. */
(function(){
 const originalFiltered=filtered,originalCounts=counts,originalHome=renderHome,
  originalSuggestions=renderSuggestions,originalBrowse=renderBrowse,
  originalRow=renderRow,originalStatus=installStatus,originalDocument=renderDocument;
 ui.includeIncomplete=false;
 function isDocumented(a){return a.discovery?
  (a.profileTier==='documented'&&!['archived','disabled','quiet-12m'].includes(a.repositoryHealth?.state)):
  !!(a.releaseTag||a.latestVersion||a.installedVersion||a.installable)}
 function isShown(a){return ui.includeIncomplete||isDocumented(a)}
 function useful(){return projects.filter(isShown)}
 function totals(){
  const kept=projects.filter(isDocumented),hidden=projects.filter(a=>!isDocumented(a));
  return {kept:kept.length,hidden:hidden.length,curated:projects.filter(a=>a.discovery).length};
 }
 filtered=function(){return originalFiltered().filter(isShown)};
 counts=function(){
  const output=new Map(DOMAINS.map(d=>[d[0],0]));
  for(const a of useful())output.set(domainOf(a),(output.get(domainOf(a))||0)+1);
  output.set('all',useful().length);return output;
 };
 renderHome=function(){
  originalHome();
  const n=totals();
  $('homeProjectCount').textContent=n.kept+' DOCUMENTED / MANAGED · '+n.hidden+' NEED MORE RESEARCH';
  const recent=useful().filter(a=>(dateOf(a.publishedAt||a.observedPublishedAt))>0&&a.repoUrl)
   .sort((a,b)=>dateOf(b.publishedAt||b.observedPublishedAt)-dateOf(a.publishedAt||a.observedPublishedAt)).slice(0,5);
  $('recentList').innerHTML=recent.length?recent.map(a=>
   '<button class="recent-item" type="button" data-project="'+esc(a.repo)+'">'+
   '<div class="recent-item-top"><strong>'+esc(a.title)+'</strong><small>'+esc(dateLabel(a.publishedAt||a.observedPublishedAt))+'</small></div>'+
   '<p>'+esc(a.discovery?'Official release observation · installation is separate':'Managed source release')+'</p></button>').join(''):
   '<p class="source-footnote">No recent official releases were observed.</p>';
 };
 renderSuggestions=function(){
  const all=projects;projects=useful();
  try{return originalSuggestions()}finally{projects=all}
 };
 installStatus=function(a){
  if(a.discovery){
   if(a.repositoryHealth?.state==='archived')return {text:'ARCHIVED upstream',kind:'caution'};
   if(a.repositoryHealth?.state==='disabled')return {text:'Source disabled',kind:'caution'};
   if(a.repositoryHealth?.state==='quiet-12m')return {text:'12+ months quiet',kind:'caution'};
   if(a.repositoryHealth?.state==='quiet-6m')return {text:'6+ months quiet',kind:'caution'};
  }
  if(!a.discovery&&a.installEvidence){
   const status=a.installEvidence.state;
   if(status==='Checking')return {text:'Checking official release',kind:''};
   if(status==='NoRelease')return {text:'No release published',kind:''};
   if(status==='SourceUnavailable')return {text:'Release check unavailable',kind:'caution'};
   if(status==='NoCompatibleAsset')return {text:'No compatible installer',kind:'caution'};
   if(status==='Available')return {text:'Available',kind:'ok'};
   if(status==='UpdateAvailable')return {text:'Update available',kind:'caution'};
   if(status==='UpToDate')return {text:'Up to date',kind:'ok'};
   if(status==='InstalledCheckUnavailable')return {text:'Installed · source unverified',kind:'caution'};
   if(status==='InstalledVersionUnknown')return {text:'Installed · version unknown',kind:'caution'};
  }
  if(a.discovery&&!a.installedVersion){
   return a.profileTier==='documented'?
    {text:'Documented profile',kind:'ok'}:{text:'More research needed',kind:'caution'};
  }
  return originalStatus(a);
 };
 renderRow=function(a,library=false){
  let row=originalRow(a,library);
  if(!library&&a.discovery){
   const label=a.observedPublishedAt?'Release '+dateLabel(a.observedPublishedAt):
    a.pushedAt?'Code '+dateLabel(a.pushedAt):'Date unavailable';
   row=row.replace(/<td class="end-cell">[^<]*<\/td><\/tr>$/,
    '<td class="end-cell">'+esc(label)+'</td></tr>');
  }
  return row;
 };
 renderBrowse=function(){
  originalBrowse();
  const n=totals(),button=$('researchToggle');
  if(button){
   button.textContent=ui.includeIncomplete?'Hide incomplete ('+n.hidden+')':'Show research ('+n.hidden+')';
   button.setAttribute('aria-pressed',String(ui.includeIncomplete));
   button.title=ui.includeIncomplete?'Keep only documented profiles':'Reveal projects with missing platforms or incomplete research evidence';
  }
  $('exploreSubline').textContent=ui.includeIncomplete?
   'Including incomplete profiles for research only; this does not authorize installation.':
   (ui.query?'Results in documented software profiles. ':'')+
   'Showing profiles with useful documented product and platform details. '+n.hidden+' research entries hidden.';
  if(!filtered().length&&!ui.includeIncomplete&&n.hidden){
   $('exploreEmpty').innerHTML='<h2>No documented match.</h2>'+
    '<p>Some projects still lack source-backed details. Select “Show research” if you need to inspect them.</p>'+
    '<button type="button" class="quiet-button" data-quality-research>Show research profiles</button>';
  }
  const cols=document.querySelectorAll('.explore-screen .project-table thead th');
  if(cols.length===5){cols[3].textContent='PROFILE';cols[4].textContent='SOURCE ACTIVITY'}
 };
 function safeWebsite(value){
  try{const u=new URL(value);return u.protocol==='https:'&&u.username===''&&u.password===''&&u.port===''?
   u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'').slice(0,40):null}catch{return null}
 }
 function describe(a){
  const host=safeWebsite(a.officialHomepage),
   parts=[
    a.sourceDescription?['Official repository description',a.sourceDescription]:null,
    a.officialLicense?['License classified by GitHub',a.officialLicense]:
     a.license?['License reported in curated review',a.license]:['License','Not established in source metadata'],
    a.reportedPlatforms?.length?['Reported platform support',a.reportedPlatforms.join(', ')]:['Platforms','Not established'],
    a.observedReleaseTag?['Latest observed published release',a.observedReleaseTag+' (not an install-approved package)']:
     ['Published stable release','None observed; do not infer no releases exist'],
    Number.isSafeInteger(a.stars)?['GitHub stars at last check',a.stars.toLocaleString('en-US')]:null,
    a.pushedAt?['Latest repository push',dateLabel(a.pushedAt)]:null,
    a.primaryLanguage?['Primary repository language',a.primaryLanguage]:null,
    host?['Official homepage reported on GitHub',host]:null,
    a.repositoryMetadataCheckedAt?['Last GitHub repository check',dateLabel(a.repositoryMetadataCheckedAt)]:null
   ].filter(Boolean);
  const facts='<dl class="doc-facts source-facts">'+parts.map(([k,v])=>
   '<div><dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>';
  const topics=Array.isArray(a.topics)?a.topics.slice(0,6):[];
  return '<section class="document-section source-profile-evidence">'+
   '<h2>FACTS FROM THE OFFICIAL SOURCE</h2>'+facts+
   (topics.length?'<p class="source-topics">Project topics · '+esc(topics.join(' / '))+'</p>':'')+
   '<p class="source-data-note">Repository facts come from GitHub. Product comparison and platform support are separately curated reports, not installation certification.</p></section>';
 }
 renderDocument=function(app){
  originalDocument(app);
  if(!app.discovery){
   if(window.CHALLENGER_CRAFT_MEDIA?.[app.repo]){
    const main=document.querySelector('#projectDocument .doc-main');
    if(main)main.insertAdjacentHTML('afterbegin',
      '<section class="document-section craft-distribution-note"><h2>OFFICIAL CRAFT APP DISTRIBUTION</h2>'+
      '<p>This product is in the Craft App Suite. Its creator provides ArtCraft Launcher for native '+
      'installation, detection, official SHA-256 verified updates and self-updates. Challenger offers '+
      'wider software discovery; it does not silently take over installations already managed elsewhere.</p>'+
      '<p><strong>Local install ownership:</strong> '+esc(app.installEvidence?.origin||'Not established')+
      '. Automatic replacement is not authorized by simple detection of an executable.</p>'+
      '<p><a href="https://github.com/storytold/craft-launcher/releases/latest" target="_blank" '+
      'rel="noopener noreferrer">Open official ArtCraft Launcher releases ↗</a></p></section>');
   }
   return;
  }
  const main=document.querySelector('#projectDocument .doc-main');
  if(main)main.insertAdjacentHTML('afterbegin',describe(app));
  const source=[...document.querySelectorAll('#projectDocument .doc-aside .document-section')]
   .find(x=>x.querySelector('h2')?.textContent==='SOURCE CONFIDENCE');
  if(source){
   const issue=app.profileCompleteness?.missing||[];
   source.innerHTML='<h2>INFORMATION / INSTALLATION</h2>'+
    (app.repositoryHealth?.state&&app.repositoryHealth.state!=='active'?'<p class="warning-note"><strong>Upstream activity:</strong> '+
       esc(app.repositoryHealth.state==='archived'?'GitHub repository archived by maintainer':
          app.repositoryHealth.state==='quiet-12m'?'No repository push for 12+ months; review maintenance status':
          app.repositoryHealth.state==='quiet-6m'?'No repository push for 6+ months; not proof of abandonment':
          app.repositoryHealth.state==='disabled'?'Repository disabled':'Activity not verified')+'</p>':'')+
    '<p>'+esc(app.profileTier==='documented'?
     'Product profile has a source-linked description, reviewed platforms and commercial context.':
     'Research profile is incomplete; it is excluded from standard browsing.')+'</p>'+
    (issue.length?'<p class="warning-note">Missing details: '+esc(issue.join(', '))+'.</p>':'')+
    '<p><strong>Software installation:</strong> '+esc(app.installable?'Approved adapter available on this device.':
     'Not approved or verified for this device. This is separate from repository authenticity.')+'</p>'+
    '<p><strong>Official repository:</strong> '+esc(dateLabel(app.repositoryMetadataCheckedAt))+' last checked.</p>';
  }
  const facts=document.querySelectorAll('#projectDocument .doc-facts:not(.source-facts)>div');
  for(const row of facts){
   const label=row.querySelector('dt')?.textContent||'',val=row.querySelector('dd');
   if(!val)continue;
   if(label==='License'&&app.officialLicense)val.textContent=app.officialLicense+' (GitHub)';
   if(label==='Platform(s)'&&!app.reportedPlatforms?.length)val.textContent='Not established';
   if((label==='Latest source version'||label==='Release date')&&
     /^(Not reported|Not verified)$/i.test(val.textContent.trim()))row.remove();
  }
  const releaseNotes=[...document.querySelectorAll('#projectDocument .doc-main .document-section')]
   .find(x=>x.querySelector('h2')?.textContent==='REPORTED RELEASE NOTES');
  if(releaseNotes&&!app.releaseBody)releaseNotes.remove();
 };
 document.addEventListener('click',e=>{
  if(e.target.closest('#researchToggle,[data-quality-research]')){
   ui.includeIncomplete=!ui.includeIncomplete;
   ui.limit=30;renderHome();renderBrowse();renderSuggestions();
  }
 },true);
})();
