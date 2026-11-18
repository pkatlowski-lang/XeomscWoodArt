import {$,api,node,button,photo,bindForm,messages} from './common.js';
import {estimate,money} from './calculator.js';
let projects=[], edit=null, pictures=[], threads=[], current=null, loadingImages=false, dirty=false;
const form=$('#editor'), fields=form.elements;
function feedback(e) {$('#feedback').textContent=e.message || String(e);}
function tab(name) {
  for(const t of ['projects','inbox','calc']) $('#'+t).hidden=t!==name;
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===name)));
  $('#insert').hidden=!current || !!current.closed;
  if(name==='inbox') refreshInbox().catch(feedback);
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
async function enter() {
  projects=await api('admin/projects');$('#login').hidden=true;$('#desk').hidden=false;$('#logout').hidden=false;
  list(); await refreshInbox();tab('projects');
}
bindForm($('#loginform'),async f=>{await api('login',Object.fromEntries(f));await enter();$('#loginform').reset();});
$('#logout').onclick=async()=>{try{await api('logout',{});location.reload();}catch(e){feedback(e);}};
function list() {
  const q=$('#find').value.trim().toLowerCase();
  $('#list').replaceChildren(...projects.filter(p=>(p.title+' '+p.category).toLowerCase().includes(q)).map(p=>{
    const b=button('',()=>openEditor(p),'entry');
    b.append(photo(p.photos[0]),node('span',p.title+' · '+(p.published?'Opublikowano':'Szkic')));return b;
  }));
  $('#categories').replaceChildren(...[...new Set(projects.map(p=>p.category))].map(c=>{const opt=node('option');opt.value=c;return opt;}));
}
function openEditor(project,force=false) {
  if(loadingImages || (!force && dirty && !confirm('Porzucić niezapisane zmiany w realizacji?'))) return;
  form.reset();edit=project; pictures=(project?.photos||[]).map(p=>({...p}));
  if(project) {
    for(const k of ['title','category','material','description'])fields[k].value=project[k];
    fields.published.checked=!!project.published; fields.featured.checked=!!project.featured;
  }
  $('#edit-title').textContent=project?'Edytuj realizację':'Nowa realizacja';
  $('#delete').hidden=!project;form.querySelector('output').textContent='';dirty=false;drawPhotos();
}
form.oninput=()=>dirty=true;$('#new').onclick=()=>openEditor(null);$('#find').oninput=list;
function drawPhotos() {
  $('#pictures').replaceChildren(...pictures.map((p,i)=>{
    const row=node('div','','picrow'), label=node('label',i===0?'Okładka · opis zdjęcia':'Opis zdjęcia'),input=node('input');
    input.value=p.alt||'';input.maxLength=180;input.oninput=()=>{p.alt=input.value;dirty=true;};label.append(input);
    const move=offset=>{[pictures[i],pictures[i+offset]]=[pictures[i+offset],pictures[i]];dirty=true;drawPhotos();};
    const up=button('↑',()=>move(-1)),down=button('↓',()=>move(1));
    up.disabled=i===0;down.disabled=i===pictures.length-1;
    up.setAttribute('aria-label','Przesuń zdjęcie wcześniej');down.setAttribute('aria-label','Przesuń zdjęcie później');
    row.append(photo({url:p.url||p.data,alt:p.alt}),label,up,down,button('Usuń',()=>{pictures.splice(i,1);dirty=true;drawPhotos();}));return row;
  }));
}
async function compress(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>24*1024*1024) throw Error('Wybierz JPG, PNG lub WebP do 24 MB na zdjęcie.');
  const bitmap=await createImageBitmap(file);
  try {
    const scale=Math.min(1,1500/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    for(const quality of [.84,.69,.5]) {
      const data=canvas.toDataURL('image/webp',quality);
      if(data.length<1398000) return {data,alt:''};
    }
    throw Error('Zdjęcie po zmniejszeniu nadal jest za duże.');
  } finally {bitmap.close();}
}
async function addFiles(files) {
  if(loadingImages || !files.length)return;
  const out=form.querySelector('output');
  if(pictures.length+files.length>12){out.textContent='Możesz dodać do 12 zdjęć na projekt.';return;}
  loadingImages=true;out.textContent='Przygotowywanie zdjęć…';
  try {const ready=[];for(const file of files) ready.push(await compress(file));pictures.push(...ready);dirty=true;drawPhotos();out.textContent='Zdjęcia gotowe. Zapisz realizację.';}
  catch(e){out.textContent=e.message;}finally{loadingImages=false;$('#files').value='';}
}
$('#files').onchange=e=>addFiles([...e.target.files]);
$('#drop').ondragover=e=>e.preventDefault();
$('#drop').ondrop=e=>{e.preventDefault();addFiles([...e.dataTransfer.files]);};
bindForm(form,async f=>{
  if(loadingImages || !pictures.length)throw Error('Dodaj zdjęcia i zaczekaj na ich przygotowanie.');
  const saved=await api('admin/projects',{id:edit?.id,revision:edit?.revision,...Object.fromEntries(f),published:fields.published.checked,featured:fields.featured.checked,photos:pictures});
  projects=await api('admin/projects');list();openEditor(projects.find(p=>p.id===saved.id),true);return 'Zapisano realizację.';
});
$('#delete').onclick=async()=>{if(!edit||!confirm('Usunąć realizację wraz ze zdjęciami?'))return;try{await api('admin/remove',{id:edit.id,revision:edit.revision});projects=await api('admin/projects');list();openEditor(null,true);}catch(e){feedback(e);}};
async function refreshInbox(){threads=await api('admin/inbox');$('#badge').textContent=String(threads.filter(t=>t.unread).length);drawInbox();}
function drawInbox() {
  const filter=$('#inboxfilter').value;
  const rows=threads.filter(t=>filter==='all'||(filter==='new'&&t.unread)||(filter==='closed'&&t.closed)||(filter==='open'&&!t.closed));
  $('#threads').replaceChildren(...rows.map(t=>{
    const b=button('',()=>openThread(t).catch(feedback),'entry');b.append(node('span',(t.unread?'● ':'')+t.name+' · '+t.subject),node('small',t.closed?'Zamknięta':'Otwarta'));return b;
  }));
  if(!rows.length) $('#threads').textContent='Brak rozmów w tym widoku.';
}
async function openThread(t,action='view',text='') {
  const data=await api('admin/thread',{id:t.id,action,text});
  if(current?.id!==t.id) {$('#answer').reset();$('#answer output').textContent='';}
  current={...t,closed:data.closed};$('#choose').hidden=true;$('#conversation').hidden=false;
  $('#topic').textContent=t.subject;$('#sender').textContent=t.name+' · '+t.email;
  messages($('#history'),data.posts);$('#answer').hidden=data.closed;
  $('#close-thread').textContent=data.closed?'Otwórz ponownie':'Zamknij rozmowę';
  await refreshInbox();
}
$('#reload').onclick=()=>{(current?openThread(current):refreshInbox()).catch(feedback);};$('#inboxfilter').onchange=drawInbox;
bindForm($('#answer'),async f=>{await openThread(current,'reply',f.get('text'));$('#answer').reset();return 'Odpowiedź jest dostępna w rozmowie klienta.';});
$('#close-thread').onclick=()=>openThread(current,current.closed?'open':'close').catch(feedback);
$('#quote').onclick=()=>tab('calc');
const calc=$('#calcform');let quote='';
function calculate(){
  if(!calc.checkValidity()){quote='';$('#total').textContent='Uzupełnij poprawnie pola kalkulatora.';return;}
  const f=new FormData(calc),r=estimate(f);
  if(!Number.isFinite(r.total)){quote='';$('#total').textContent='Sprawdź wartości.';return;}
  quote='Wycena dla '+f.get('qty')+' szt.: '+money(r.total)+' łącznie ('+money(r.unit)+' za sztukę).';
  $('#total').replaceChildren(node('p','Materiał '+money(r.material)+' · Laser '+money(r.laser)+' · Dodatki '+money(r.extra)),node('h3',money(r.total)),node('p',money(r.unit)+' za sztukę'));
}
calc.oninput=calculate;calc.onsubmit=e=>e.preventDefault();calculate();
$('#insert').onclick=()=>{if(current&&!current.closed&&quote){tab('inbox');const box=$('#answer textarea');box.value=(box.value.trim()+'\n'+quote).trim();box.focus();}};
try{await enter();}catch(e){if(e.status!==401)feedback(e);}

