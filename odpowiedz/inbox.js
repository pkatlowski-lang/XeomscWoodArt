import {publicRecord} from '../panel/photos.js';
import {unseal} from '../panel/letter.js';
import {prepareFile,packFile,fileDownload} from '../zapytanie/pliki.js';
const [id,secret,received]=location.hash.slice(1).split('.');
const status=document.querySelector('#status');
const form = document.querySelector('#followup');
const input = form.elements.reference;
const clearFile = form.querySelector('#clear-file');
input.onchange = () => { clearFile.hidden = !input.files.length; };
clearFile.onclick = () => { input.value = ''; clearFile.hidden = true; input.focus(); };
let connection, channel, pending, version = 0;
async function connect() {
  const [appSdk, authSdk, fs, config] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js'),
    import('../panel/config.js')
  ]);
  const app = appSdk.initializeApp(await config.getOwnerConfig(), 'portfolio-customer');
  const auth = authSdk.getAuth(app);
  await auth.authStateReady();
  if (!auth.currentUser) await authSdk.signInAnonymously(auth);
  const db = fs.getFirestore(app);
  return {db, fs, parent:fs.doc(db,'portfolio_inquiries',id)};
}
function bubble(post) {
  const box = document.createElement('article'), body = document.createElement('p'), label = document.createElement('small');
  box.className = 'bubble ' + post.role;
  label.textContent = (post.role === 'client' ? 'Ty' : 'Xeomsc Laser') + ' · ' + new Date(post.created).toLocaleString('pl-PL');
  body.textContent = post.body;
  box.append(label);
  if (post.body) box.append(body);
  if (post.fileName) box.append(fileDownload(post.fileName, post.loadFile));
  return box;
}
async function refresh(){
  const current = ++version;
  if(!/^[a-f0-9-]{36}$/.test(id)||!secret){status.textContent='Otwórz pełny link otrzymany po wysłaniu zapytania.';return;}
  if(/^\d{13}$/.test(received||'')){
    const date=new Date(Number(received));
    const receipt=document.querySelector('#receipt'),time=receipt.querySelector('time');
    time.dateTime=date.toISOString();time.textContent='· '+date.toLocaleString('pl-PL');receipt.hidden=false;
  }
  try{
    const fields=await publicRecord('pf-reply-'+id);
    const records=JSON.parse(fields?.letters?.stringValue||'[]');
    const posts = await Promise.all(records.map(async record => ({
      role:'studio', body:await unseal(secret,record), created:record.created
    })));
    if (current !== version) return;
    const showPosts = () => document.querySelector('#letters').replaceChildren(...posts.map(bubble));
    showPosts();
    channel = null;
    form.hidden = true;
    status.textContent = posts.length ? '' : (received ? '' : 'Tutaj pojawi się odpowiedź pracowni.');
    if (!fields?.dialog?.stringValue) return;
    const key = await unseal(secret,JSON.parse(fields.dialog.stringValue));
    connection ||= connect().catch(error => { connection = null; throw error; });
    const {db,fs,parent} = await connection;
    const messages = fs.collection(parent,'dialogs',key,'messages');
    const snapshots = await fs.getDocsFromServer(messages);
    if (current !== version) return;
    for (const post of snapshots.docs) {
      const data = post.data();
      posts.push({role:'client', body:data.body, created:data.created.toDate().toISOString(),
        fileName:data.fileName, loadFile:async () => (await fs.getDocFromServer(fs.doc(post.ref,'files','reference'))).data()});
    }
    posts.sort((a,b)=>a.created.localeCompare(b.created));
    showPosts();
    channel = {db,fs,parent,messages};
    form.hidden = fields.closed?.booleanValue === true;
    if (form.hidden) status.textContent = 'Pracownia zamknęła tę rozmowę.';
  } catch {
    if (current === version) status.textContent='Nie udało się wczytać pełnej rozmowy. Kliknij „Sprawdź odpowiedź”, aby spróbować ponownie.';
  }
}
form.onsubmit = async event => {
  event.preventDefault();
  const button = form.querySelector('[type=submit]'), output = form.querySelector('output');
  const body = form.elements.body.value.trim();
  if (!channel || button.disabled) return;
  const file = input.files[0];
  if (!body && !file) { output.textContent = 'Wpisz wiadomość lub dodaj plik.'; return; }
  const {db,fs,parent,messages} = channel;
  if (pending?.body !== body || pending.file !== file) pending = {id:crypto.randomUUID(), body, file};
  const ref = fs.doc(messages,pending.id);
  button.disabled = true;
  form.elements.body.readOnly = true;
  input.disabled = clearFile.disabled = true;
  output.textContent = file ? 'Przygotowywanie pliku…' : 'Wysyłanie…';
  let attachment;
  try {
    attachment = await prepareFile(file);
  } catch (error) {
    output.textContent = error.message;
    button.disabled = input.disabled = clearFile.disabled = form.elements.body.readOnly = false;
    return;
  }
  output.textContent = 'Wysyłanie…';
  try {
    await fs.runTransaction(db,async tx => {
      if ((await tx.get(ref)).exists()) return;
      const post = {body, created:fs.serverTimestamp()};
      if (attachment) {
        post.fileName = attachment.name;
        tx.set(fs.doc(ref,'files','reference'),packFile(attachment,fs.Bytes));
      }
      tx.set(ref,post);
      tx.update(parent,{read:false,lastClientAt:fs.serverTimestamp(),lastClientId:ref.id});
    });
    pending = null;
    form.reset();
    clearFile.hidden = true;
    output.textContent = 'Wiadomość wysłana.';
    await refresh();
  } catch (error) {
    output.textContent = file && error.code === 'permission-denied'
      ? 'Nie udało się wysłać załącznika. Odśwież rozmowę lub wyślij plik na katlowskii@gmail.com.'
      : 'Nie udało się wysłać wiadomości. Sprawdź połączenie i odśwież rozmowę.';
  } finally {
    button.disabled = input.disabled = clearFile.disabled = false;
    form.elements.body.readOnly = false;
  }
};
document.querySelector('#reload').onclick=refresh;
document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);status.textContent='Skopiowano prywatny link.';}catch{status.textContent='Skopiuj cały adres z paska przeglądarki.';}};
refresh();
