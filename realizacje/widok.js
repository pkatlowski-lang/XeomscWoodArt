import {createPhotoViewer} from './powiekszenie.js';
import {liveProjects,samples} from '/portfolio-catalog.js';
import {publishedChanges,mergeProjects,setPhoto,studioPhoto} from '/panel/photos.js?v=opisy2';
import {projectPath,rememberProjectLinks} from './adresy.js';

const $=selector=>document.querySelector(selector);
const article=$('.project-body'),thumbs=$('.thumbs'),notice=$('#notice');
const id=new URLSearchParams(location.search).get('id');
const dynamic=location.pathname==='/realizacja/';
let photos=[...thumbs.querySelectorAll('img')].map(img=>({url:img.getAttribute('src'),alt:img.alt}));
let index=0;

function showPhoto(which){
  if(!photos.length)return;
  index=(which+photos.length)%photos.length;
  setPhoto($('#cover'),photos[index]);
  [...thumbs.children].forEach((a,i)=>a.setAttribute('aria-current',String(i===index)));
  $('#counter').textContent=(index+1)+' / '+photos.length;
  $('#controls').hidden=photos.length<2;
}
const openViewer = createPhotoViewer();
function enlarge(trigger) {
  if (photos[index]) openViewer(trigger, image => setPhoto(image, photos[index]));
}
$('.viewer').onclick = event => enlarge(event.currentTarget);
thumbs.onclick=event=>{
  const a=event.target.closest('a');
  if(a && !event.ctrlKey && !event.metaKey){event.preventDefault();showPhoto([...thumbs.children].indexOf(a));enlarge(a);}
};
$('#prev').onclick=()=>showPhoto(index-1);
$('#next').onclick=()=>showPhoto(index+1);
document.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.key==='ArrowLeft')showPhoto(index-1);
  if(event.key==='ArrowRight')showPhoto(index+1);
});
showPhoto(0);
function meta(key,value){
  const name=key.startsWith('og:')?'property':'name';
  let tag=document.head.querySelector('meta['+name+'="'+key+'"]');
  if(!tag){tag=document.createElement('meta');tag.setAttribute(name,key);document.head.append(tag);}
  tag.content=value;
}
function missing(){
  meta('robots','noindex,follow');article.hidden=true;
  notice.textContent='Ta realizacja jest niedostępna. Wróć do galerii, aby zobaczyć aktualne projekty.';
}
async function load(){
  const [legacy,overlays]=await Promise.allSettled([liveProjects(),publishedChanges()]);
  const base=legacy.status==='fulfilled' && legacy.value.length?legacy.value:samples;
  rememberProjectLinks(base);
  const rows=mergeProjects(base,overlays.status==='fulfilled'?overlays.value:[]);
  const p=rows.find(item=>dynamic?item.id===id:projectPath(item)===location.pathname);
  if(!p){
    if(legacy.status==='fulfilled' && overlays.status==='fulfilled')missing();
    else if(dynamic)notice.textContent='Nie udało się wczytać realizacji. Odśwież stronę.';
    return;
  }
  if(dynamic && projectPath(p).startsWith('/realizacje/')){location.replace(projectPath(p));return;}
  photos=p.photos;thumbs.replaceChildren(...photos.map((ph,i)=>{
    const a=document.createElement('a');a.href=ph.url||'#cover';
    a.setAttribute('aria-label','Zdjęcie '+(i+1));a.append(studioPhoto(ph));return a;
  }));
  showPhoto(index);const ask=new URL('/zapytanie/',location.origin);
  ask.searchParams.set('zapytanie',p.title);if(p.code)ask.searchParams.set('kod',p.code);
  $('#ask').href=ask.href;
  const material = $('#project-material');
  if (material && p.material?.trim()) {
    material.querySelector('dd').textContent = p.material.trim();
    material.hidden = false;
  }
  const sampleSize = { 'sample-baza': 'Średnica 10 cm', 'sample-krazki': 'Średnica 5 cm' };
  if (dynamic && sampleSize[p.id] && !p.revision) $('.project-specs div:last-child dd').textContent = sampleSize[p.id];
  if(dynamic || p.revision || p.customDescription){
    $('h1').textContent=p.title;$('#category').textContent=p.category;
    const description=p.description||p.title+' – realizacja pracowni Xeomsc Laser. Zobacz zdjęcia i zapytaj o szczegóły.';
    $('.prose').textContent=description;document.title=p.title+' | Xeomsc Laser';
    const url=new URL(projectPath(p),location.origin).href;
    let canonical=$('link[rel=canonical]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.append(canonical);}canonical.href=url;
    meta('description',description);meta('og:title',document.title);meta('og:url',url);meta('og:description',description);meta('og:type','article');
    const images=photos.filter(ph=>ph.url && !ph.url.startsWith('data:')).map(ph=>new URL(ph.url,location.origin).href);
    if(images.length)meta('og:image',images[0]);else $('meta[property="og:image"]')?.remove();
    let schema=$('script[type="application/ld+json"]');
    if(!schema){schema=document.createElement('script');schema.type='application/ld+json';document.head.append(schema);}
    schema.textContent=JSON.stringify({'@context':'https://schema.org','@type':'CreativeWork',name:p.title,description,url,image:images,creator:{'@type':'Organization',name:'Xeomsc Laser'},inLanguage:'pl'});
  }
  notice.textContent='';article.hidden=false;
}
if(dynamic&&!id)missing();else load().catch(()=>{if(dynamic)notice.textContent='Nie udało się wczytać realizacji. Odśwież stronę.';});
