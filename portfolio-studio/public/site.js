import {$,node,button,photo,api,bindForm,dialogControls} from './common.js';
let projects=[], selectedCategory='', inquiryProject=null;
function ask(project=null) {
  inquiryProject=project;
  if($('#detail').open) $('#detail').close();
  $('#inquirytitle').textContent=project?'Zapytaj o „'+project.title+'”':'Opowiedz o swoim pomyśle';
  $('#askform output').textContent='';
  $('#inquiry').showModal();
}
function openProject(project) {
  let index=0;
  const panel=$('#detailbody'), large=node('div','','viewer'), image=photo(project.photos[0]);
  const counter=node('span'), thumbs=node('div','','thumbs');
  function select(i) {
    index=(i+project.photos.length)%project.photos.length;
    image.src=project.photos[index].url; image.alt=project.photos[index].alt;
    counter.textContent=(index+1)+' / '+project.photos.length;
    [...thumbs.children].forEach((b,j)=>b.setAttribute('aria-pressed',String(j===index)));
  }
  for(const [i,p] of project.photos.entries()) {
    const thumb=button('',()=>select(i)); thumb.setAttribute('aria-label','Zdjęcie '+(i+1));thumb.append(photo(p));thumbs.append(thumb);
  }
  large.append(image);
  const row=node('div','','row');
  if(project.photos.length>1) row.append(button('← Poprzednie',()=>select(index-1)),counter,button('Następne →',()=>select(index+1)));
  const details=node('div','','pad');
  details.append(row,thumbs,node('p',project.category+' · '+project.material,'eyebrow'),node('h2',project.title),node('p',project.description,'prose'),button('Zapytaj o tę realizację ↗',()=>ask(project),'btn'));
  panel.replaceChildren(large,details);select(0);$('#detail').showModal();
  $('#detail').onkeydown=e=>{if(e.key==='ArrowLeft')select(index-1);if(e.key==='ArrowRight')select(index+1);};
}
function draw() {
  const q=$('#search').value.trim().toLocaleLowerCase('pl');
  const shown=projects.filter(p=>(!selectedCategory||p.category===selectedCategory)&&[p.title,p.description,p.material,p.category].join(' ').toLocaleLowerCase('pl').includes(q));
  $('#count').textContent=shown.length?'Liczba realizacji: '+shown.length:'Brak pasujących realizacji.';
  $('#grid').replaceChildren(...shown.map(p=>{
    const card=button('',()=>openProject(p),'card'), frame=node('div','','frame'), image=photo(p.photos[0]);
    image.loading='lazy';frame.append(image,node('span',p.photos.length+' zdj.','number'));
    card.append(frame,node('small',p.category),node('h3',p.title),node('p',p.material));return card;
  }));
}
function filters(){
  $('#filters').replaceChildren(...['',...new Set(projects.map(p=>p.category))].map(c=>{
    const b=button(c||'Wszystkie',()=>{selectedCategory=c;filters();draw();},'chip');
    b.setAttribute('aria-pressed',String(c===selectedCategory));return b;
  }));
}
dialogControls(); document.querySelectorAll('.ask').forEach(b=>b.onclick=()=>ask());
bindForm($('#askform'),async f=>{
  const data=await api('inquiry',{...Object.fromEntries(f),project:inquiryProject?.id || ''});
  location.assign('/rozmowa#'+data.token);
});
$('#search').oninput=draw;
try {projects=await api('projects');filters();draw();}catch(e){$('#count').textContent=e.message;}

