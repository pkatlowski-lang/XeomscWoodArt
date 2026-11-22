import {fileDownload} from '../zapytanie/pliki.js';
import {categoryKey,formatPrice} from '../realizacje/ceny.js?v=nowy-katalog';
import {defaultHome,defaultHomeImage} from './homepage.js?v=nowy-katalog';
import {$,node,button,bindForm,messages} from '../portfolio-studio/public/common.js?v=pliki2';
import {studioPhoto as photo} from './photos.js';
import {api,resetPassword,signedReply,requireOwner} from './backend.js?v=nowy-katalog';
import {estimate,money} from '../portfolio-studio/public/calculator.js';
let projects=[], edit=null, pictures=[], threads=[], current=null, loadingImages=false, dirty=false;
const form=$('#editor'), fields=form.elements;
function feedback(e) {$('#feedback').textContent=e.message || String(e);}
let quoteTarget=null,quoteAttempt=null,sendingQuote=false;
function tab(name,recipient=null) {
  quoteTarget=name==='calc' && recipient && !recipient.closed ? recipient : null;
  $('#quote-delivery').hidden=!quoteTarget;
  $('#quote-recipient').textContent=quoteTarget?'Wycena dla '+quoteTarget.name+' · '+quoteTarget.email:'';
  $('#quote-status').textContent='';
  if(name==='calc')calculate();
  for(const t of ['projects','pricing','homepage','inbox','calc']) $('#'+t).hidden=t!==name;
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===name)));

  if(name==='pricing') loadRates().catch(feedback);
  if(name==='homepage') loadHome();
  if(name==='inbox') refreshInbox().catch(feedback);
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
async function enter() {
  await requireOwner();
  $('#session-check').hidden=true;$('#login').hidden=true;$('#desk').hidden=false;$('#logout').hidden=false;
  tab('projects');
  refreshInbox().catch(feedback);
  try { projects=await api('admin/projects'); list(); }
  catch(error) { feedback(error); }
}
bindForm($('#loginform'),async f=>{await api('login',Object.fromEntries(f));await enter();$('#loginform').reset();});
$('#logout').onclick=async()=>{try{await api('logout',{});location.reload();}catch(e){feedback(e);}};
let removingProject = false;
const projectEditor = $('#project-editor');
const narrowGallery = matchMedia('(max-width:720px)');
function placeProjectEditor() {
  const list = $('#list');
  const selected = list.querySelector('.entry[aria-pressed="true"]')?.parentElement;
  if (narrowGallery.matches && selected) {
    if (projectEditor.parentElement !== selected) selected.append(projectEditor);
  } else if (projectEditor.parentElement !== $('#projects')) {
    $('#projects').append(projectEditor);
  }
}
narrowGallery.addEventListener('change', placeProjectEditor);
const rowDelete = button('🗑', removeSelectedProject, 'row-delete');
function markSelectedProject() {
  rowDelete.remove();
  for (const row of $('#list').children) {
    const selected = row.dataset.projectId === String(edit?.id);
    row.firstElementChild.setAttribute('aria-pressed', String(selected));
    if (selected) {
      const label = 'Usuń realizację „' + edit.title + '”';
      rowDelete.title = label;
      rowDelete.setAttribute('aria-label', label);
      row.firstElementChild.after(rowDelete);
    }
  }
  placeProjectEditor();
}
function list() {
  const q=$('#find').value.trim().toLowerCase();
  $('#list').replaceChildren(...projects.filter(p=>(p.title+' '+p.category).toLowerCase().includes(q)).map(p=>{
    const row=node('div','','project-row');
    row.dataset.projectId=p.id;
    const b=button('',()=>showEditor(p),'entry');
    b.setAttribute('aria-controls','project-editor');
    b.append(photo(p.photos[0]),node('span',p.title+' · '+(p.published?'Opublikowano':'Szkic')));row.append(b);return row;
  }));
  markSelectedProject();
  $('#categories').replaceChildren(...[...new Set(projects.map(p=>p.category))].map(c=>{const opt=node('option');opt.value=c;return opt;}));
}
function openEditor(project,force=false) {
  if(removingProject || loadingImages || (!force && form.querySelector('.btn').disabled)) return;
  if(!force && project && edit?.id===project.id) return true;
  if(!force && dirty && !confirm('Porzucić niezapisane zmiany w realizacji?')) return;
  form.reset();edit=project; pictures=(project?.photos||[]).map(p=>({...p}));
  if(project) {
    for(const k of ['title','category','material','description'])fields[k].value=project[k];
    fields.actualPrice.value = project.actualGrosze > 0 ? project.actualGrosze / 100 : '';
    fields.featured.checked=!!project.featured;
  }
  markSelectedProject();
  $('#edit-title').textContent=project?'Edytuj: '+project.title:'Nowa realizacja';
  $('#delete').hidden=!project;form.querySelector('output').textContent='';dirty=false;drawPhotos();
  return true;
}
function showEditor(project) {
  if (!openEditor(project)) return;
  projectEditor.scrollTop = 0;
  const title = $('#edit-title');
  title.focus({preventScroll:true});
  title.scrollIntoView({block:'nearest'});
}
form.oninput=()=>dirty=true;$('#new').onclick=()=>showEditor(null);$('#find').oninput=list;
function drawPhotos() {
  $('#pictures').replaceChildren(...pictures.map((p,i)=>{
    const row=node('div','','picrow'), label=node('label',i===0?'Okładka · opis zdjęcia':'Opis zdjęcia'),input=node('input');
    input.value=p.alt||'';input.maxLength=180;input.oninput=()=>{p.alt=input.value;dirty=true;};label.append(input);
    const move=offset=>{[pictures[i],pictures[i+offset]]=[pictures[i+offset],pictures[i]];dirty=true;drawPhotos();};
    const up=button('↑',()=>move(-1)),down=button('↓',()=>move(1));
    up.disabled=i===0;down.disabled=i===pictures.length-1;
    up.setAttribute('aria-label','Przesuń zdjęcie wcześniej');down.setAttribute('aria-label','Przesuń zdjęcie później');
    row.append(photo(p),label,up,down,button('Usuń',()=>{pictures.splice(i,1);dirty=true;drawPhotos();}));return row;
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
      if(data.startsWith("data:image/webp;base64,") && data.length<750000) return {data,alt:''};
    }
    throw Error('Zdjęcie po zmniejszeniu nadal jest za duże.');
  } finally {bitmap.close();}
}
const priceForm = $('#price-form');
const priceFields = priceForm.querySelector('fieldset');
let rates = null;
function fillRate() {
  const key = categoryKey(priceForm.elements.category.value);
  const rate = rates?.find(row => categoryKey(row.category) === key);
  priceForm.elements.amount.value = rate ? rate.amount / 100 : '';
  priceForm.elements.variant.value = rate?.variant || '';
}
function priceButtons() {
  $('#saved-rates').replaceChildren(...rates.map(rate => button(rate.category + ' · od ' + formatPrice(rate.amount), () => {
    priceForm.elements.category.value = rate.category;
    fillRate();
  })));
}
async function loadRates() {
  if (rates !== null) return;
  rates = await api('admin/prices');
  priceButtons();
  priceFields.disabled = false;
}
priceForm.elements.category.oninput = fillRate;
bindForm(priceForm,async data => {
  const values = Object.fromEntries(data);
  const previous = rates.find(row => categoryKey(row.category) === categoryKey(values.category)) || null;
  priceFields.disabled = true;
  try {
    rates = await api('admin/prices',{...values,previous});
    priceButtons();
    fillRate();
    return 'Zapisano cennik.';
  } finally {priceFields.disabled = false;}
});
const homeForm = $('#home-form');
const homeFields = homeForm.querySelector('fieldset');
const homeFile = $('#home-file');
const homePreview = $('#home-preview');
const homeStatus = homeForm.querySelector('output');
let homeRevision = null, homeLoading = false, homeImage = defaultHomeImage, previewUrl = '';
function showHomePreview() {
  const src = previewUrl || homeImage;
  homePreview.hidden = !src;
  if (src) homePreview.src = src;
  else homePreview.removeAttribute('src');
}
async function loadHome() {
  if (homeRevision !== null || homeLoading) return;
  homeLoading = true;
  $('#home-retry').hidden = true;
  homeStatus.textContent = 'Wczytywanie strony głównej…';
  try {
    const data = await api('admin/homepage');
    for (const [key, value] of Object.entries(defaultHome)) homeForm.elements[key].value = data[key] ?? value;
    homeImage = data.image || defaultHomeImage;
    showHomePreview();
    homeRevision = data.revision || 0;
    homeFields.disabled = false;
    homeStatus.textContent = '';
  } catch (error) {
    homeStatus.textContent = error.message;
    $('#home-retry').hidden = false;
  } finally { homeLoading = false; }
}
$('#home-retry').onclick = loadHome;
homeFile.onchange = () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = homeFile.files[0];
  previewUrl = file ? URL.createObjectURL(file) : '';
  showHomePreview();
  homeStatus.textContent = '';
};
bindForm(homeForm, async values => {
  const input = {...Object.fromEntries(values), revision:homeRevision};
  homeFields.disabled = true;
  try {
    if (homeFile.files[0]) input.image = (await compress(homeFile.files[0])).data;
    homeRevision = await api('admin/homepage', input);
    if (input.image) homeImage = input.image;
    homeFile.value = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    showHomePreview();
    return 'Opublikowano zmiany na stronie głównej.';
  } finally { homeFields.disabled = false; }
});
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
  const saved=await api('admin/projects',{id:edit?.id,revision:edit?.revision,...Object.fromEntries(f),published:true,featured:fields.featured.checked,photos:pictures});
  projects=await api('admin/projects');list();openEditor(projects.find(p=>p.id===saved.id),true);return 'Zapisano realizację.';
});
async function removeSelectedProject() {
  const target = edit;
  if (!target || removingProject || loadingImages || form.querySelector('button:not([type=button])').disabled) return;
  if (!confirm('Usunąć realizację „' + target.title + '” wraz ze zdjęciami?')) return;
  removingProject = true;
  rowDelete.disabled = true;
  form.inert = true;
  try {
    await api('admin/remove', {id: target.id, revision: target.revision});
    projects = projects.filter(project => project.id !== target.id);
    removingProject = false;
    openEditor(null, true);
    list();
    $('#feedback').textContent = 'Usunięto realizację „' + target.title + '”.';
  } catch (error) {
    feedback(error);
    alert(error.message || 'Nie udało się usunąć realizacji.');
  } finally {
    removingProject = false;
    form.inert = false;
    rowDelete.disabled = false;
  }
}
$('#delete').onclick = removeSelectedProject;
let inboxVersion = 0, threadVersion = 0;
async function refreshInbox() {
  const version = ++inboxVersion;
  const result = await api('admin/inbox');
  if (version !== inboxVersion) return;
  threads = result;
  searchInbox();
}
const drafts = new Map(), replyIndex = new Map();
const dateLabel = new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'});
let expandedId = null, searchVersion = 0, searchTimer;
const normalize = text => String(text || '').toLocaleLowerCase('pl').normalize('NFD').replace(/\p{M}/gu,'').replaceAll('ł','l');
function collapseThread() {
  if (current) drafts.set(current.id,$('#answer textarea').value);
  ++threadVersion;
  expandedId = null;
  current = null;
  const panel = $('#conversation');
  panel.hidden = true;
  $('#mail-parking').append(panel);
}
function inFilter(t) {
  const mode = $('#inboxfilter').value;
  return mode === 'all' || (mode === 'new' && (t.unread || t.id === expandedId)) ||
    (mode === 'open' && !t.closed) || (mode === 'closed' && t.closed);
}
function matchText(t,q) {
  return !q || normalize([t.name,t.email,t.subject,t.details].join('\n')).includes(q);
}
function drawInbox() {
  const list = $('#threads'), panel = $('#conversation');
  const q = normalize($('#mail-search').value.trim());
  const rows = threads.filter(t => {
    if (!inFilter(t)) return false;
    const cached = replyIndex.get(t.id);
    return matchText(t,q) || (cached?.version === t.lastClientId && cached?.text?.includes(q));
  });
  if (expandedId && !rows.some(t => t.id === expandedId)) collapseThread();
  $('#badge').textContent = String(threads.filter(t => t.unread).length);
  const old = new Map([...list.children].map(row => [row.dataset.id,row]));
  let previous = null;
  for (const t of rows) {
    let row = old.get(t.id);
    if (!row) {
      row = node('div','','mail-row');
      row.dataset.id = t.id;
      const toggle = button('',() => {
        if (expandedId === t.id) { collapseThread(); drawInbox(); }
        else {
          const thread = threads.find(item => item.id === t.id);
          if (thread) openThread(thread).catch(feedback);
        }
      },'mail-summary');
      toggle.setAttribute('aria-controls','conversation');
      toggle.append(node('span','','mail-name'),node('span','','mail-subject'),node('span','','mail-state'),node('time','','mail-date'));
      const trash = button('🗑',event => deleteThreadFromInbox(t.id,event.currentTarget),'mail-trash');
      row.append(toggle,trash);
    }
    old.delete(t.id);
    const next = previous ? previous.nextElementSibling : list.firstElementChild;
    if (row !== next) list.insertBefore(row,next);
    previous = row;
    const toggle = row.firstElementChild;
    const trash = row.children[1];
    trash.title = 'Usuń rozmowę: ' + t.name + ' · ' + t.subject;
    trash.setAttribute('aria-label',trash.title);
    const [name,subject,state,date] = toggle.children;
    name.textContent = t.name; subject.textContent = t.subject;
    state.textContent = [t.unread ? 'Nowa' : '', t.closed ? 'Zamknięta' : 'Otwarta'].filter(Boolean).join(' · ');
    date.dateTime = t.date;
    date.textContent = t.date ? dateLabel.format(new Date(t.date)) : '';
    toggle.classList.toggle('unread',t.unread);
    toggle.setAttribute('aria-expanded',String(expandedId === t.id));
    if (expandedId === t.id && panel.parentNode !== row) row.append(panel);
  }
  for (const row of old.values()) row.remove();
  $('#mail-status').textContent = rows.length ? '' : (q ? 'Brak pasujących rozmów.' : 'Brak rozmów w tym widoku.');
}
function searchInbox() {
  clearTimeout(searchTimer);
  const version = ++searchVersion;
  drawInbox();
  const q = normalize($('#mail-search').value.trim());
  if (!q) return;
  const missing = threads.filter(t => inFilter(t) && t.dialogKey && t.lastClientId &&
    !matchText(t,q) && replyIndex.get(t.id)?.version !== t.lastClientId);
  if (!missing.length) return;
  $('#mail-status').textContent = 'Przeszukiwanie treści rozmów…';
  searchTimer = setTimeout(async () => {
    let incomplete = false;
    for (const t of missing) {
      if (version !== searchVersion) return;
      try {
        const text = await api('admin/search-replies',{id:t.id,key:t.dialogKey});
        replyIndex.set(t.id,{version:t.lastClientId,text:normalize(text)});
      } catch { incomplete = true; }
    }
    if (version !== searchVersion) return;
    drawInbox();
    if (incomplete) $('#mail-status').textContent = 'Nie udało się przeszukać wszystkich wiadomości. Odśwież skrzynkę.';
  },250);
}
function showAttachment(source, threadId) {
  const area = $('#attachment');
  area.replaceChildren();
  if (source?.content && source.name) {
    area.append(fileDownload(source.name, () => source));
    return;
  }
  if (typeof source !== 'string') return;
  const inline = /^data:image\/(jpeg|png|webp);base64,/i.exec(source);
  if (!inline && !/^https:\/\//i.test(source)) return;

  const name = 'zalacznik-' + threadId.replace(/[^a-z0-9_-]/gi, '_').slice(0,80);
  const image = node('img');
  image.alt = 'Załącznik klienta';
  image.referrerPolicy = 'no-referrer';
  image.style.maxWidth = '100%';
  image.style.height = 'auto';
  image.src = source;
  const preview = node('details');
  preview.append(node('summary', 'Pokaż załącznik klienta'), image);
  const link = node('a', 'Pobierz załącznik', 'outline');
  link.href = source;
  if (inline) {
    const format = inline[1].toLowerCase();
    link.download = name + '.' + (format === 'jpeg' ? 'jpg' : format);
  } else {
    // The download attribute alone is ignored for cross-origin images.
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.onclick = async event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (link.getAttribute('aria-busy') === 'true') return;
      link.setAttribute('aria-busy', 'true');
      try {
        const response = await fetch(source, {credentials:'omit', referrerPolicy:'no-referrer'});
        if (!response.ok) throw Error();
        const blob = await response.blob();
        const extensions = {'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/gif':'gif', 'image/avif':'avif'};
        const ext = extensions[blob.type.toLowerCase()];
        if (!ext) throw Error();
        if (!link.isConnected) return;
        const copy = node('a');
        copy.href = URL.createObjectURL(blob);
        copy.download = name + '.' + ext;
        area.append(copy);
        copy.click();
        copy.remove();
        setTimeout(() => URL.revokeObjectURL(copy.href), 60000);
      } catch {
        if (!link.isConnected) return;
        link.onclick = null;
        link.textContent = 'Otwórz obraz, aby go zapisać';
        const note = node('p', 'Bezpośrednie pobranie jest niedostępne. Otwórz obraz i wybierz w przeglądarce „Zapisz obraz jako”.');
        note.setAttribute('role', 'status');
        area.append(note);
      } finally {
        link.removeAttribute('aria-busy');
      }
    };
  }
  area.append(link, preview);
}
async function openThread(t,action='view',text='') {
  const switching = expandedId !== t.id;
  if (switching) {
    collapseThread();
    expandedId = t.id;
    drawInbox();
  }
  if (expandedId !== t.id) return;
  const version = ++threadVersion;
  if (switching) $('#mail-status').textContent = 'Wczytywanie rozmowy…';
  let data;
  try { data = await api('admin/thread',{id:t.id,action,text}); }
  catch (error) {
    if (version === threadVersion && switching) { collapseThread(); drawInbox(); }
    throw error;
  }
  if (version !== threadVersion) return;
  if (switching) {
    $('#answer').reset();
    $('#answer textarea').value = drafts.get(t.id) || '';
    $('#answer output').textContent = '';
  }
  current={...t,addressable:data.addressable,closed:data.closed};
  $('#conversation').hidden=false;
  $('#sender').textContent=t.name+' · '+t.email;
  showAttachment(data.attachment, t.id);
  $('#answer button').textContent=data.addressable?'Wyślij do klienta':'Otwórz odpowiedź w poczcie';
  messages($('#history'),data.posts,post => post.fileName && fileDownload(post.fileName,post.loadFile));
  if (data.rulesPending) $('#history').append(node('p','Aby odbierać dalsze wiadomości klientów, opublikuj zaktualizowane reguły Firestore.'));
  $('#answer').hidden=data.closed;
  $('#quote').hidden=data.closed||!data.addressable;
  $('#close-thread').textContent=data.closed?'Otwórz ponownie':'Zamknij rozmowę';
  await refreshInbox().catch(feedback);
}
$('#reload').onclick=()=>{(current?openThread(current):refreshInbox()).catch(feedback);};$('#inboxfilter').onchange=()=>{collapseThread();searchInbox();};
$('#mail-search').oninput=searchInbox;
bindForm($('#answer'),async f=>{if(!current.addressable){
    if(!/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(current.email))throw Error('Brak poprawnego adresu e-mail klienta.');
    location.href='mailto:'+encodeURIComponent(current.email)+'?subject='+encodeURIComponent('Odpowiedź pracowni Xeomsc Laser')+'&body='+encodeURIComponent(signedReply(f.get('text')));
    return 'Dokończ wysyłanie w swojej poczcie.';
  }
  const id = current.id;
  await openThread(current,'reply',f.get('text'));
  drafts.delete(id);
  if (current?.id !== id) return '';
  $('#answer').reset();
  return 'Odpowiedź jest dostępna w rozmowie klienta.';});
$('#close-thread').onclick=()=>openThread(current,current.closed?'open':'close').catch(feedback);
async function deleteThreadFromInbox(id,trigger) {
  const target = threads.find(t => t.id === id);
  const inbox = $('#inbox');
  if (!target || inbox.inert) return;
  if (!confirm('Usunąć całą rozmowę z ' + target.name + ' dotyczącą „' + target.subject + '” wraz z załącznikami?')) return;
  const row = trigger.closest('.mail-row');
  const adjacent = row?.nextElementSibling || row?.previousElementSibling;
  inbox.inert = true;
  if (expandedId === id) ++threadVersion;
  try {
    await api('admin/delete-thread', {id});
    ++inboxVersion;
    threads = threads.filter(t => t.id !== id);
    if (expandedId === id) {
      collapseThread();
      $('#answer').reset();
      $('#history').replaceChildren();
    }
    drafts.delete(id);
    replyIndex.delete(id);
    searchInbox();
    $('#feedback').textContent = 'Usunięto rozmowę ze skrzynki.';
  } catch (error) {
    feedback(error);
  } finally {
    inbox.inert = false;
    if (trigger.isConnected && !trigger.closest('[hidden]')) trigger.focus();
    else (adjacent?.isConnected ? adjacent.firstElementChild : $('#inboxfilter')).focus();
  }
}
$('#delete-thread').onclick = event => {
  if (current) deleteThreadFromInbox(current.id,event.currentTarget);
};
$('#quote').onclick=()=>tab('calc',current);
const calc=$('#calcform');let quote='';
function calculate(){
  $('#send-quote').disabled=true;
  if(!calc.checkValidity()){quote='';$('#total').textContent='Uzupełnij poprawnie pola kalkulatora.';return;}
  const f=new FormData(calc),r=estimate(f);
  if(!Number.isFinite(r.total)){quote='';$('#total').textContent='Sprawdź wartości.';return;}
  quote='Wycena dla '+f.get('qty')+' szt.: '+money(r.total)+' łącznie ('+money(r.unit)+' za sztukę).';
  $('#send-quote').disabled=sendingQuote || !quoteTarget || r.total<=0 || (quoteAttempt?.delivered && quoteAttempt.target===quoteTarget.id && quoteAttempt.body===quote);
  $('#total').replaceChildren(node('p','Materiał '+money(r.material)+' · Laser '+money(r.laser)+' · Dodatki '+money(r.extra)),node('h3',money(r.total)),node('p',money(r.unit)+' za sztukę'));
}
$('#send-quote').onclick=async()=>{
  const target=quoteTarget,body=quote;
  if(!target || sendingQuote || !body || $('#send-quote').disabled)return;
  if(quoteAttempt?.target!==target.id || quoteAttempt?.body!==body)
    quoteAttempt={target:target.id,body,requestId:crypto.randomUUID(),delivered:false};
  const attempt=quoteAttempt;
  sendingQuote=true;calculate();
  $('#quote-status').textContent='Wysyłanie wyceny…';
  try{
    await api('admin/thread',{id:target.id,action:'reply',text:body,requestId:attempt.requestId});
    attempt.delivered=true;
    if(quoteTarget?.id===target.id)$('#quote-status').textContent='Wysłano do '+target.name+'. '+body;
    if(current?.id===target.id)await openThread(target).catch(feedback);
  }catch(error){if(quoteTarget?.id===target.id)$('#quote-status').textContent=error.message;}
  finally{sendingQuote=false;calculate();}
};
calc.oninput=()=>{$('#quote-status').textContent='';calculate();};calc.onsubmit=e=>e.preventDefault();calculate();
$('#insert').onclick=()=>{if(current&&!current.closed&&quote){tab('inbox');const box=$('#answer textarea');box.value=(box.value.trim()+'\n'+quote).trim();box.focus();}};
$('#reset-password').onclick=async()=>{
  const f=$('#loginform'),out=f.querySelector('output');
  try{await resetPassword(f.elements.login.value);out.textContent='Sprawdź wiadomość od Firebase w swojej skrzynce, także w spamie.';}
  catch(e){out.textContent=e.message;}
};
async function restoreSession() {
  const retry = $('#session-retry');
  retry.hidden = true;
  $('#session-message').textContent = 'Przywracanie sesji panelu…';
  try {
    await enter();
  } catch (error) {
    if (error.status === 401 || error.code === 'permission-denied') {
      $('#session-check').hidden = true;
      $('#login').hidden = false;
      if (error.code === 'permission-denied') $('#loginform output').textContent = 'To konto nie ma dostępu do panelu. Zaloguj się kontem administratora.';
      return;
    }
    $('#session-message').textContent = 'Nie udało się sprawdzić sesji. Sprawdź połączenie i spróbuj ponownie.';
    retry.hidden = false;
  }
}
$('#session-retry').onclick = restoreSession;
restoreSession();

