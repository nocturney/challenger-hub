// Optional, offline WebGPU enhancement: never required for the catalog or installers.
const motion=matchMedia('(prefers-reduced-motion: reduce)');
const data=matchMedia('(prefers-reduced-data: reduce)');
async function eligible(){
 if(!navigator.gpu || motion.matches || data.matches || navigator.connection?.saveData)return false;
 if(document.visibilityState==='hidden'||innerWidth<850)return false;
 try{if(navigator.getBattery){const b=await navigator.getBattery();if(!b.charging&&b.level<0.28)return false}}catch(_){}
 return true;
}
if(await eligible()){
 const canvas=document.getElementById('heroShaderCanvas'),hero=canvas?.closest('.hero');
 if(hero){const load=async()=>{if(await eligible())import('/shader-bundle.js').catch(()=>{canvas.style.display='none'})};
  if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();load()}},{rootMargin:'120px'});observer.observe(hero)}
  else load();
 }
}
