'use strict';
/* Only adds actual source-repository README screenshots and proven creator avatars.
   Never calls third-party hosts from the browser and never brands avatars as app icons. */
(function(){
 const iconBase=mediaIcon,heroBase=mediaHero,hasBase=mediaHasScreenshot;
 const known=new Map(),pending=new Set();
 const escMedia=mEsc;
 const sourceIndex=window.CHALLENGER_INDEPENDENT_MEDIA?.apps||{};
 function vetted(app){
  if(!validId(app)||!signedRepo(app))return null;
  const m=sourceIndex[app.repo];
  return m?.repository?.toLowerCase()===app.repository.toLowerCase()?m:null;
 }
 function officialSource(url,app){
  if(!url||!app||!app.repository)return null;
  const prefix='https://github.com/'+app.repository+'/blob/';
  return url.startsWith(prefix)&&/^https:\/\/github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+\/blob\/[a-f0-9]{40}\//i.test(url)?
   url:null;
 }
 function validId(a){return a?.discovery===true&&/^[a-z][a-z0-9-]{1,79}$/.test(a.repo||'');}
 function signedRepo(a){return /^[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100}$/i.test(a.repository||'');}
 mediaIcon=function(app,size){
  const asset=vetted(app);
  if(asset?.icon && projectMedia[app.repo]?.icon?.status!=='approved'){
   const klass=size==='detail'?'detail':'row';
   return '<span class="project-icon-frame '+klass+' independent-official-icon" title="Application icon from '+escMedia(app.repository)+' source repository">'+
    '<img loading="lazy" decoding="async" alt="" data-domain="'+escMedia(domainOf(app))+'" data-source-icon="true" '+
    'src="/api/repository-media/official-icon?repo='+encodeURIComponent(app.repo)+'"></span>';
  }
  if(!validId(app)||!signedRepo(app)||!app.ownerAvatarUrl||
     !/^https:\/\/avatars\.githubusercontent\.com\/u\/[0-9]+(?:\?v=[0-9]+)?$/.test(app.ownerAvatarUrl))
   return iconBase(app,size);
  // Official bundled app logos keep their priority. Creator avatar is labeled separately.
  if(projectMedia[app.repo]?.icon?.status==='approved')return iconBase(app,size);
  const klass=size==='detail'?'detail':'row',name=escMedia(app.title||'Project');
  return '<span class="project-icon-frame '+klass+' creator-avatar" title="GitHub creator avatar for '+name+
    ' — not an official product logo"><img loading="lazy" decoding="async" alt="" '+
    'data-domain="'+escMedia(domainOf(app))+'" data-avatar-fallback="true" '+
    'src="/api/repository-media/avatar?repo='+encodeURIComponent(app.repo)+'"></span>';
 };
 mediaHasScreenshot=function(app){
  return hasBase(app)||!!vetted(app)?.screenshots?.length||!!known.get(app?.repo)?.available;
 };
 mediaHero=function(app){
  if(hasBase(app))return heroBase(app);
  const v=vetted(app);
  const gallery=(v?.screenshots||[]).filter(s=>officialSource(s.source,app)).slice(0,5);
  if(gallery.length){
   const name=escMedia(app.title||app.repo),id=encodeURIComponent(app.repo),hero=gallery[0];
   return '<figure class="project-media-figure craft-product-gallery vetted-source-gallery">'+
    '<div class="project-screenshot-frame"><img class="project-screenshot" loading="lazy" decoding="async" '+
    'data-source-image="true" src="/api/repository-media/official-screenshot?repo='+id+'&i=0" '+
    'alt="Source-pinned screenshot of '+name+' published in its official project repository"></div>'+
    '<figcaption><span>SCREENSHOT IN PROJECT SOURCE REPOSITORY</span>'+
    '<span>SHA-256 checked · <a href="'+escMedia(hero.source)+
    '" target="_blank" rel="noopener noreferrer">View exact upstream file ↗</a></span></figcaption>'+
    (gallery.length>1?'<details class="craft-gallery-more"><summary>View '+gallery.length+' source-verified interface images</summary>'+
     '<div class="craft-gallery-tiles">'+gallery.slice(1).map((s,i)=>
      '<figure><img data-source-image="true" loading="lazy" decoding="async" '+
      'src="/api/repository-media/official-screenshot?repo='+id+'&i='+(i+1)+
      '" alt="'+name+' project screenshot '+(i+2)+'"><figcaption>Upstream screenshot '+(i+2)+
      ' · <a target="_blank" rel="noopener noreferrer" href="'+escMedia(s.source)+'">Source ↗</a>'+
      '</figcaption></figure>').join('')+'</div></details>':'')+'</figure>';
  }
  const m=known.get(app?.repo);
  if(!validId(app)||!m?.available)return '';
  const source=/^https:\/\/github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+\/blob\/[a-z0-9._-]+\/[^ "'<>]+$/i.test(m.source||'')?
   m.source:'https://github.com/'+app.repository;
  const id=encodeURIComponent(app.repo);
  return '<figure class="project-media-figure live-repository-image">'+
   '<div class="project-screenshot-frame"><img class="project-screenshot" loading="lazy" decoding="async" '+
   'src="/api/repository-media/screenshot?repo='+id+'" alt="'+escMedia('Screenshot documented in '+app.title+' official source repository')+'"></div>'+
   '<figcaption><span>SCREENSHOT IN OFFICIAL PROJECT README</span><span>Creator-published source · '+
   '<a href="'+escMedia(source)+'" target="_blank" rel="noopener noreferrer">Verify original ↗</a></span></figcaption></figure>';
 };
 const documentBase=renderDocument;
 renderDocument=function(app){
  documentBase(app);
  if(!validId(app)||hasBase(app)||vetted(app)?.screenshots?.length||known.has(app.repo)||pending.has(app.repo))return;
  pending.add(app.repo);
  fetch('/api/repository-media/meta?repo='+encodeURIComponent(app.repo),{cache:'default'})
   .then(r=>r.ok?r.json():null)
   .then(meta=>{
    if(meta&&typeof meta.available==='boolean')known.set(app.repo,meta);
    if(meta?.available&&ui.screen==='project'&&ui.project===app.repo)
     documentBase(app);
   })
   .catch(()=>{})
   .finally(()=>pending.delete(app.repo));
 };
 document.addEventListener('error',event=>{
  const img=event.target;
  if(img instanceof HTMLImageElement&&img.dataset.sourceImage==='true'){
   const parent=img.closest('.project-screenshot-frame,.craft-gallery-tiles figure');
   if(parent){img.remove();parent.classList.add('verified-source-offline');
    parent.insertAdjacentHTML('afterbegin','<p>Official source screenshot unavailable offline. Use the upstream source link to verify.</p>');}
  }
  if(img instanceof HTMLImageElement&&img.dataset.sourceIcon==='true'){
   const frame=img.closest('.project-icon-frame');
   if(frame){frame.classList.add('icon-fallback');frame.innerHTML=domainIcon(img.dataset.domain||'');}
  }
  if(img instanceof HTMLImageElement&&img.dataset.avatarFallback==='true'){
   const frame=img.closest('.project-icon-frame');
   if(frame){frame.classList.add('icon-fallback');frame.innerHTML=domainIcon(img.dataset.domain||'');}
  }
 },true);
})();
