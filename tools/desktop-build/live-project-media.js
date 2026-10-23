'use strict';
/* Only adds actual source-repository README screenshots and proven creator avatars.
   Never calls third-party hosts from the browser and never brands avatars as app icons. */
(function(){
 const iconBase=mediaIcon,heroBase=mediaHero,hasBase=mediaHasScreenshot;
 const known=new Map(),pending=new Set();
 const escMedia=mEsc;
 function validId(a){return a?.discovery===true&&/^[a-z][a-z0-9-]{1,79}$/.test(a.repo||'');}
 function signedRepo(a){return /^[a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100}$/i.test(a.repository||'');}
 mediaIcon=function(app,size){
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
  return hasBase(app)||!!known.get(app?.repo)?.available;
 };
 mediaHero=function(app){
  if(hasBase(app))return heroBase(app);
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
  if(!validId(app)||hasBase(app)||known.has(app.repo)||pending.has(app.repo))return;
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
  if(img instanceof HTMLImageElement&&img.dataset.avatarFallback==='true'){
   const frame=img.closest('.project-icon-frame');
   if(frame){frame.classList.add('icon-fallback');frame.innerHTML=domainIcon(img.dataset.domain||'');}
  }
 },true);
})();
