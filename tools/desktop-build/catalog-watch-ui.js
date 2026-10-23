'use strict';
/* New, source-observed candidates are informational only: no installation or adapter approval. */
(function(){
 const list=window.CHALLENGER_CANDIDATE_WATCHLIST;
 if(!list||list.schema!=='challenger-candidate-watchlist.v1'||!Array.isArray(list.candidates))return;
 const entries=list.candidates.filter(a=>a.assessment==='new-unreviewed' &&
  /^https:\/\/github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(a.repoUrl||'')&&
  a.installable===false&&a.installerAdapter===null).slice(0,25);
 const explore=document.getElementById('exploreScreen');
 if(!explore||!entries.length)return;
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const section=document.createElement('section');
 section.className='new-candidates research-watch';
 section.setAttribute('aria-label','New software candidates - research only');
 section.innerHTML='<div class="candidate-head"><div><small>NEWLY SOURCED · NOT INSTALL-APPROVED</small>'+
  '<strong>'+entries.length+' additional projects to investigate</strong>'+
  '<p>Independent public GitHub facts. Not yet reviewed for runtime compatibility, installer safety or fit.</p></div>'+
  '<button type="button" id="candidateWatchToggle" class="control-button" aria-expanded="false" aria-controls="candidateWatchRows">View candidates</button></div>'+
  '<div id="candidateWatchRows" class="candidate-watch-rows" hidden></div>';
 const table=explore.querySelector('.table-wrap');if(table)explore.insertBefore(section,table);
 else explore.append(section);
 const toggle=section.querySelector('#candidateWatchToggle'),rows=section.querySelector('#candidateWatchRows');
 function draw(){
  rows.innerHTML=entries.map(x=>{
   const age=x.pushedAt?new Date(x.pushedAt).toISOString().slice(0,10):'Not verified';
   return '<article class="candidate-card"><div><strong>'+safe(x.title)+'</strong>'+
    '<small>'+safe(x.kind==='integration'?'Integration / MCP':'Application')+' · '+safe(x.category)+'</small>'+
    '<p>'+safe(x.description||x.whyReview)+'</p><p class="candidate-reason"><b>Why consider:</b> '+safe(x.whyReview)+'</p>'+
    '<span class="candidate-facts">GitHub push '+safe(age)+' · Licence '+safe(x.officialLicense||'not established')+
    ' · '+safe(x.latestPublishedStableTag?'GitHub release '+x.latestPublishedStableTag:'No stable GitHub Release confirmed')+
    '</span></div><a href="'+safe(x.repoUrl)+'" target="_blank" rel="noopener noreferrer" title="Open the original GitHub repository for source review">Official source ↗</a></article>';
  }).join('');
 }
 toggle.addEventListener('click',()=>{
  const open=rows.hidden;rows.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
  toggle.textContent=open?'Hide candidates':'View candidates';
  if(open&&!rows.children.length)draw();
 });
})();
