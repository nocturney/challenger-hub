'use strict';
/* Authentic Craft App media from audited ArtCraft Launcher and app repos.
 * Independent of (and different from) the trademark ArtCraft logo.
 * Bundled and SHA256-audited by build-runtime. Never makes external image requests.
 */
(function(){
 const catalog=window.CHALLENGER_CRAFT_MEDIA||{};
 const oldIcon=mediaIcon,oldHero=mediaHero,oldHas=mediaHasScreenshot;
 const known=(app)=>app&&!app.discovery&&Object.hasOwn(catalog,app.repo)&&catalog[app.repo];
 function safeSrc(s){return /^\/media\/craft\/(icons\/[a-z-]+\.png|screenshots\/[a-z-]+\/[a-z0-9-]+\.(jpg|png))$/.test(s||'')?s:null}
 function sourceLink(s){
  return /^https:\/\/github\.com\/storytold\/[a-z0-9-]+\/blob\/[a-z0-9.-]+\/[A-Za-z0-9._\/-]+$/.test(s||'')?s:null;
 }
 mediaIcon=function(app,size){
  const m=known(app),src=safeSrc(m?.icon?.path);
  if(!src)return oldIcon(app,size);
  const klass=size==='detail'?'detail':'row';
  return '<span class="project-icon-frame '+klass+'" title="Official '+mEsc(app.title)+' product icon, source-licensed">'+
   '<img class="official-project-icon" src="'+mEsc(src)+'" width="'+(klass==='detail'?64:28)+'" height="'+(klass==='detail'?64:28)+
   '" loading="lazy" decoding="async" alt="" data-domain="'+mEsc(domainOf(app))+'"></span>';
 };
 mediaHasScreenshot=function(app){
  const m=known(app);
  return oldHas(app)||!!(m?.screenshots?.some(s=>safeSrc(s.path)));
 };
 mediaHero=function(app){
  const m=known(app);
  if(!m?.screenshots?.length)return oldHero(app);
  const imgs=m.screenshots.filter(s=>safeSrc(s.path)&&sourceLink(s.source));
  if(!imgs.length)return oldHero(app);
  const main=imgs[0],id=mEsc(app.title),src=mEsc(main.path),url=mEsc(main.source);
  return '<figure class="project-media-figure craft-product-gallery">'+
   '<div class="project-screenshot-frame"><img class="project-screenshot" src="'+src+
   '" loading="lazy" decoding="async" alt="Authentic '+id+' application screenshot from its project source"></div>'+
   '<figcaption><span>OFFICIAL APPLICATION SCREENSHOT</span><span>Unmodified app image · <a href="'+url+
   '" target="_blank" rel="noopener noreferrer">Verify original ↗</a></span></figcaption>'+
   (imgs.length>1?'<details class="craft-gallery-more"><summary>View all '+imgs.length+' real '+id+
   ' screenshots</summary><div class="craft-gallery-tiles">'+imgs.slice(1).map(s=>
    '<figure><img src="'+mEsc(s.path)+'" alt="'+id+' interface · '+mEsc(s.key)+
    '" loading="lazy" decoding="async"><figcaption>'+mEsc(s.key.replaceAll('-',' '))+
    ' · <a href="'+mEsc(s.source)+'" target="_blank" rel="noopener noreferrer">Original ↗</a></figcaption></figure>'
   ).join('')+'</div></details>':'')+
   '</figure>';
 };
})();
