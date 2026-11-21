import {getOwnerConfig} from '../panel/config.js';
import {newMailbox} from '../panel/letter.js';
import {prepareFile,packFile} from './pliki.js';

const form = document.querySelector('#request');
const btn = form.querySelector('[type="submit"]');
const status = form.querySelector('output');
const fileInput = form.elements.reference;
const clearFile = document.querySelector('#clear-file');
const params = new URLSearchParams(location.search);
const title = (params.get('zapytanie') || '').slice(0,150);
const code = (params.get('kod') || '').slice(0,80);
if (title) form.elements.message.value = 'Dzień dobry, interesuje mnie projekt „' + title + '”' + (code ? ' (' + code + ')' : '') + '. ';
fileInput.onchange = () => { clearFile.hidden = !fileInput.files.length; };
clearFile.onclick = () => { fileInput.value = ''; clearFile.hidden = true; fileInput.focus(); };
let pending = null;

async function submit(event) {
  event.preventDefault();
  if (btn.disabled) return;
  const m = Object.fromEntries(new FormData(form));
  const lines = [m.message.trim()];
  if (m.dimensions.trim()) lines.push('Przybliżony wymiar (cm): ' + m.dimensions.trim());
  if (m.quantity) lines.push('Liczba sztuk: ' + m.quantity);
  const message = lines.join('\n');
  if (!m.name.trim() || !m.message.trim()) {
    status.textContent = 'Uzupełnij imię i treść wiadomości.';
    return;
  }
  if (message.length > 3500) {
    status.textContent = 'Skróć wiadomość o ' + (message.length - 3500) + ' znaków, aby zmieścić dane wyceny.';
    return;
  }
  btn.disabled = true;
  const file = fileInput.files[0];
  let preview;
  try {
    status.textContent = file ? 'Przygotowywanie pliku…' : 'Wysyłanie zapytania…';
    preview = await prepareFile(file);
  } catch (error) {
    btn.disabled = false;
    status.textContent = error.message;
    return;
  }
  try {
    status.textContent = 'Wysyłanie zapytania…';
    const [{initializeApp}, {getAuth,signInAnonymously}, {getFirestore,doc,writeBatch,Bytes,serverTimestamp}] =
      await Promise.all(['app','auth','firestore'].map(name => import('https://www.gstatic.com/firebasejs/11.6.1/firebase-' + name + '.js')));
    const app = initializeApp(await getOwnerConfig(), 'portfolio-customer');
    const auth = getAuth(app);
    await auth.authStateReady();
    if (!auth.currentUser) await signInAnonymously(auth);
    pending ??= await newMailbox();
    const db = getFirestore(app);
    const ref = doc(db, 'portfolio_inquiries', pending.id);
    const batch = writeBatch(db);
    const inquiry = {name:m.name.trim(), email:m.email.trim(), message, date:serverTimestamp(),
      status:'new', read:false, mailboxId:pending.id, replyKey:pending.publicKey};
    if (preview) {
      inquiry.hasAttachment = true;
      batch.set(doc(ref, 'files', 'reference'), preview.format === 'jpg'
        ? {jpeg:Bytes.fromUint8Array(preview.bytes)}
        : packFile(preview, Bytes));
    }
    batch.set(ref, inquiry);
    await batch.commit();
    const link = document.createElement('a');
    link.href = pending.link + '.' + Date.now();
    link.textContent = 'Otwórz prywatny link do odpowiedzi';
    status.replaceChildren('Zapytanie wysłane. ', link);
    location.replace(link.href);
  } catch (error) {
    btn.disabled = false;
    status.textContent = preview && error.code === 'permission-denied'
      ? 'Wysyłka załącznika jest niedostępna. Możesz usunąć plik i wysłać zapytanie lub przesłać plik e-mailem.'
      : 'Nie udało się wysłać zapytania. Spróbuj ponownie lub skontaktuj się z pracownią telefonicznie albo e-mailem.';
  }
}
form.onsubmit = submit;
btn.disabled = false;
status.textContent = '';
