'use strict';
/* Focus preview-only media helpers. Project media comes from bundled/hashed media-index.js,
   never a third-party browser fetch. */
const projectMedia=window.CHALLENGER_PROJECT_MEDIA||{};
const DOMAIN_MARKS={
 'Design & Imaging':'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m4 17 5-5 3.5 3.5 2.5-2.5 5 5"/>',
 'Video & Animation':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3zM7 5v14"/>',
 'Live Production':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 15 3-4 3 3 4-5M6 21v-2m12 2v-2"/>',
 '3D & Manufacturing':'<path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/>',
 'Science & GIS':'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/>',
 'Audio & Music':'<path d="M9 18V5l12-2v13M9 8l12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
 'Game Creation':'<path d="M6 8h12a4 4 0 0 1 4 4l-1 5a3 3 0 0 1-5 1l-2-2h-4l-2 2a3 3 0 0 1-5-1l-1-5a4 4 0 0 1 4-4ZM7 11v5m-2.5-2.5h5M16 12h.01M19 15h.01"/>',
 'Office & Productivity':'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 'CRM & Sales':'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 8h5M18.5 5.5v5"/>',
 'ERP & Operations':'<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><path d="M17 14v7m-4-3.5h8"/>',
 'Business & Legal':'<path d="M4 8h16M6 8v10m6-10v10m6-10v10M3 21h18M12 3l9 5H3l9-5Z"/>',
 'Data & Internal Tools':'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v7c0 4 18 4 18 0V5M3 12v7c0 4 18 4 18 0v-7"/>',
 'Marketing & Publishing':'<path d="m3 11 15-6v14L3 13v-2ZM18 9a3 3 0 0 1 0 6M7 14l2 6h3"/>',
 'AI & Agents':'<rect x="4" y="6" width="16" height="14" rx="3"/><path d="M12 2v4M8 12h.01M16 12h.01M9 16c2 1 4 1 6 0"/>',
 'Developer & Automation':'<path d="m8 8-5 4 5 4m8-8 5 4-5 4M14 5l-4 14"/>',
 'Security & Infrastructure':'<path d="m12 2 8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4Z"/><path d="m9 12 2 2 4-4"/>',
 'Finance & Accounting':'<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 10h18M7 15h4"/>'
};
function mEsc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function domainIcon(domain){
 const path=DOMAIN_MARKS[domain]||'<circle cx="12" cy="12" r="9"/><path d="M12 8v8m-4-4h8"/>';
 return '<svg class="discipline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+path+'</svg>';
}
function mediaIcon(app,size){
 const klass=size==='detail'?'detail':'row',m=projectMedia[app.repo],name=app.title||'Project';
 const fallback='<span class="project-icon-frame '+klass+' icon-fallback" aria-hidden="true">'+domainIcon(domainOf(app))+'</span>';
 if(!m||!m.icon||m.icon.status!=='approved')return fallback;
 return '<span class="project-icon-frame '+klass+'"><img class="official-project-icon" src="'+mEsc(m.icon.path)+
  '" width="'+(klass==='detail'?64:28)+'" height="'+(klass==='detail'?64:28)+'" loading="lazy" decoding="async" alt=""'+
  ' data-domain="'+mEsc(domainOf(app))+'" title="Official '+mEsc(name)+' icon"></span>';
}
function mediaHasScreenshot(app){return projectMedia[app.repo]?.screenshot?.status==='approved'}
function mediaHero(app){
 const m=projectMedia[app.repo],s=m?.screenshot;
 if(!s||s.status!=='approved'||s.type!=='application-ui-screenshot')return '';
 return '<figure class="project-media-figure">'+
  '<div class="project-screenshot-frame"><img class="project-screenshot" src="'+mEsc(s.path)+'" alt="'+
  mEsc('Actual '+app.title+' application interface')+'" width="'+s.width+'" height="'+s.height+
  '" loading="lazy" decoding="async"></div>'+
  '<figcaption><span>ACTUAL APPLICATION SCREENSHOT</span><span>'+mEsc(s.caption||'Project interface')+
  ' · <a href="'+mEsc(s.reference||s.source)+'" rel="noopener noreferrer" target="_blank">Official source ↗</a></span></figcaption></figure>';
}
document.addEventListener('error',event=>{
 const image=event.target;
 if(image instanceof HTMLImageElement&&image.classList.contains('official-project-icon')){
  const domain=image.dataset.domain;
  const parent=image.closest('.project-icon-frame');
  if(parent){parent.classList.add('icon-fallback');parent.innerHTML=domainIcon(domain)}
 }else if(image instanceof HTMLImageElement&&image.classList.contains('project-screenshot')){
  const figure=image.closest('.project-media-figure');
  if(figure)figure.remove();
 }
},true);
