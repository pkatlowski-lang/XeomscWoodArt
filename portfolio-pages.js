import {homeDocument, defaultHome, renderHome} from './panel/homepage.js';
import {$,node,button,dialogControls} from './portfolio-studio/public/common.js';
import {samples, liveProjects} from './portfolio-catalog.js';
import {studioPhoto as photo,publishedChanges,mergeProjects,publicRecord} from './panel/photos.js?v=0c6b69a';
import {projectPath,rememberProjectLinks} from './realizacje/adresy.js';
let projects=[], selectedCategory='';
function ask(project=null) {
  const address = new URL('/zapytanie/', location.href);
  address.searchParams.set('zapytanie', project ? project.title : '');
  if (project?.code) address.searchParams.set('kod', project.code);
  location.assign(address.href);
}
function draw() {
  const q=$('#search').value.trim().toLocaleLowerCase('pl');
  const shown=projects.filter(p=>(!selectedCategory||p.category===selectedCategory)&&[p.title,p.description,p.material,p.category].join(' ').toLocaleLowerCase('pl').includes(q));
  $('#count').textContent=shown.length?'Liczba realizacji: '+shown.length:'Brak pasujących realizacji.';
  $('#grid').replaceChildren(...shown.map(p=>{
    const card=node('a','','card'), frame=node('div','','frame'), image=photo(p.photos[0]);
    card.href=projectPath(p);
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
$('#search').oninput=draw;
if (location.hash && !['#galeria','#start','#projekt-indywidualny'].includes(location.hash)) {
  location.replace(location.hash==='#admin'?'/panel/':'pracownia.html'+location.search+location.hash);
} else {
  publicRecord(homeDocument).then(fields => {
    if (!fields) return;
    const data = {...defaultHome};
    for (const key of Object.keys(data)) data[key] = fields[key]?.stringValue ?? data[key];
    data.image = fields.image?.stringValue;
    renderHome($('.hero'), data);
  }).catch(() => { /* The initial HTML already contains the workshop introduction. */ });
  projects=mergeProjects(samples,[]);filters();
  const [latest,changes]=await Promise.allSettled([liveProjects(),publishedChanges()]);
  const base=latest.status==='fulfilled' && latest.value.length?latest.value:samples;
  rememberProjectLinks(base);projects=mergeProjects(base,changes.status==='fulfilled'?changes.value:[]);filters();draw();
}

